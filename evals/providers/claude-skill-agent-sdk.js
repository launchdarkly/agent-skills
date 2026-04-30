/**
 * Promptfoo provider that runs a Claude agent via @anthropic-ai/claude-agent-sdk
 * with the skill loaded the way a real Claude Code session would load it: by
 * dropping it into `.claude/skills/<slug>/SKILL.md` and letting the SDK preload
 * it through the agent definition's `skills` field.
 *
 * Why we use the SDK loader instead of packing SKILL.md as a system prompt:
 *  - Real Claude Code reads SKILL.md off disk, prepends its own system
 *    prompt, has its own tool naming, and triggers skills through agent
 *    definitions. Inlining SKILL.md as the `system` slot would measure
 *    the skill content in a clean room but bypass every one of those
 *    real-world mechanics. The SDK provider keeps the eval harness on
 *    the same path users hit when they install the skill.
 *  - Tool calls go through SDK MCP plumbing into our in-process mock
 *    server, so the trajectory output is `{ response, trajectory,
 *    tools_called, turn_count }` and every existing assertion keeps
 *    working without modification.
 *
 * Skill scoping:
 *  - Each provider instance gets its own isolated cwd
 *    (`evals/.tmp-skill-fixtures/<slug>/`) containing ONLY a symlink
 *    to the target skill at `.claude/skills/<slug>/`. That way the SDK
 *    only discovers the one skill we're evaluating instead of every
 *    sibling skill that happens to live in the repo. Built-in skills
 *    bundled inside Claude Code's CLI (`debug`, `simplify`, `loop`,
 *    etc.) still load - those are part of the runtime and not
 *    something we can suppress without forking the SDK; they don't
 *    activate on AI-Config prompts so they don't influence behaviour,
 *    they just consume some baseline context tokens.
 *  - `CLAUDE_CONFIG_DIR` is also redirected to a throwaway dir so any
 *    machine-level "policy" skills installed at
 *    `<config>/.claude/skills/` don't leak in either.
 *
 * Promptfoo provider config (set via `config:` in promptfooconfig.yaml):
 *   skill_slug             - REQUIRED. Folder name of the skill to load.
 *                            The provider resolves it under
 *                            skills/<category>/<slug>/ or skills/<slug>/
 *                            (whichever exists) and symlinks it into the
 *                            isolated cwd.
 *   allow_builtins         - When true, also expose Claude Code's built-in
 *                            tools (Read/Grep/Glob/Bash/Edit/Write/...).
 *                            Default false so the agent only sees the
 *                            LaunchDarkly MCP tools we mock.
 *   expose_mcp_tools       - Default true. Set false for skills that
 *                            should NEVER call LaunchDarkly MCP tools
 *                            (routing/advisory skills). Removes the
 *                            mock LD MCP server entirely so the agent
 *                            has nothing to reach for. The harness
 *                            system prompt itself is intentionally
 *                            minimal in either mode - it only tells
 *                            the model whether tools are available,
 *                            never how to behave; that is the
 *                            SKILL.md's job.
 *   force_skill_invocation - Default false. When true, the agent
 *                            definition's `initialPrompt` is set to
 *                            `/<skill_slug>` so the SDK's slash-command
 *                            parser invokes the skill explicitly,
 *                            forcing the SKILL.md body into the
 *                            agent's context. Use for skills whose
 *                            description-based activation is unreliable
 *                            in eval — typically routing/advisory
 *                            skills where the user request would
 *                            otherwise be answered directly from base
 *                            knowledge without ever reading the SKILL.md
 *                            body. In production, the orchestrator (or
 *                            the user typing `/<slug>`) plays the
 *                            equivalent role.
 *
 * Test-level vars:
 *   user_request      - the user turn the agent sees
 *   codebase_context  - optional snippets appended in a <codebase_context> tag
 *   max_turns         - per-test override, clamped to 1..30 (default 15)
 *
 * Environment variables:
 *   AGENT_MODEL          - SUT model (default claude-sonnet-4-20250514).
 *   ANTHROPIC_API_KEY    - Auth for the SDK's child Claude Code process.
 *   SKILL_EVAL_DEBUG=1   - Dump every SDK message to
 *                          <fixture-cwd>/_debug-messages.json for the
 *                          last test that ran. Off by default.
 */

const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const { renderMockResponse, createMockState } = require("./_mock");
const { inputSchemaToZodShape } = require("./_jsonschema-to-zod");

const DEFAULT_MAX_TURNS = 15;
const MODEL =
  process.env.AGENT_MODEL ||
  process.env.EVAL_MODEL ||
  "claude-sonnet-4-20250514";

const REPO_ROOT = path.resolve(__dirname, "..", "..");
const SKILLS_ROOT = path.join(REPO_ROOT, "skills");
// Fixture cwds live OUTSIDE the repo tree (under os.tmpdir()) so the
// Claude Agent SDK does not walk up and discover the repo-root .mcp.json.
// That .mcp.json points at the real hosted LaunchDarkly MCP servers and,
// when discovered, makes the agent emit "please open this URL to
// authenticate with LaunchDarkly" prompts in the response - which masks
// whatever the skill was supposed to do. Anchoring fixtures in a system
// temp dir keeps the SDK's project-discovery scope clean.
const FIXTURES_ROOT = path.join(os.tmpdir(), "ld-skill-eval-fixtures");

const toolDefs = JSON.parse(
  fs.readFileSync(path.join(__dirname, "../tools/definitions.json"), "utf-8"),
);

const mockTemplates = JSON.parse(
  fs.readFileSync(path.join(__dirname, "../mocks/tool-responses.json"), "utf-8"),
);

/**
 * Find the on-disk path to the skill folder named `slug`. Skills live
 * under either `skills/<category>/<slug>/SKILL.md` (e.g.
 * skills/ai-configs/aiconfig-create) or `skills/<slug>/SKILL.md` for
 * uncategorised skills. Returns the absolute directory or null.
 */
function resolveSkillSource(slug) {
  const direct = path.join(SKILLS_ROOT, slug);
  if (fs.existsSync(path.join(direct, "SKILL.md"))) return direct;

  for (const category of fs.readdirSync(SKILLS_ROOT, { withFileTypes: true })) {
    if (!category.isDirectory()) continue;
    const candidate = path.join(SKILLS_ROOT, category.name, slug);
    if (fs.existsSync(path.join(candidate, "SKILL.md"))) return candidate;
  }
  return null;
}

/**
 * Build (or reuse) an isolated cwd for the given skill slug:
 *   <fixtures>/<slug>/.claude/skills/<slug>  -> symlink to skill source
 *
 * Uses an idempotent symlink so concurrent test workers reusing the
 * same provider instance don't fight each other. The directory is
 * gitignored.
 */
function ensureFixtureCwd(slug, source) {
  const cwd = path.join(FIXTURES_ROOT, slug);
  const skillsDir = path.join(cwd, ".claude", "skills");
  const link = path.join(skillsDir, slug);

  fs.mkdirSync(skillsDir, { recursive: true });
  let needsLink = true;
  try {
    const existing = fs.readlinkSync(link);
    if (path.resolve(skillsDir, existing) === source) needsLink = false;
  } catch {
    // not a symlink yet; will create
  }
  if (needsLink) {
    try {
      fs.rmSync(link, { recursive: true, force: true });
    } catch {}
    fs.symlinkSync(source, link, "dir");
  }

  // Empty placeholder for CLAUDE_CONFIG_DIR so we don't pick up
  // machine-level managed/policy skills either.
  const isolatedConfig = path.join(cwd, ".isolated-claude-config");
  fs.mkdirSync(isolatedConfig, { recursive: true });

  // Drop an empty .mcp.json in the fixture cwd so the SDK does NOT
  // walk up the directory tree and load the repo-root .mcp.json (which
  // points at the *real* hosted LaunchDarkly MCP servers and triggers
  // an OAuth flow). The eval harness exposes a mocked LD MCP server
  // via createSdkMcpServer; the only place that should provide MCP
  // tools is that mock. Without this, skills whose body does not name
  // a specific mocked tool can fall back to the real server and emit
  // "please authorize" prompts in their response.
  const mcpStub = path.join(cwd, ".mcp.json");
  if (!fs.existsSync(mcpStub)) {
    fs.writeFileSync(mcpStub, JSON.stringify({ mcpServers: {} }, null, 2));
  }

  return { cwd, isolatedConfig };
}

function clampMaxTurns(raw) {
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0) return DEFAULT_MAX_TURNS;
  return Math.min(30, Math.max(1, Math.floor(n)));
}

function previewMock(mock) {
  return JSON.stringify(mock).slice(0, 200) + "...";
}

let sdkPromise = null;
function loadSdk() {
  if (!sdkPromise) {
    sdkPromise = import("@anthropic-ai/claude-agent-sdk");
  }
  return sdkPromise;
}

class ClaudeSkillAgentSdk {
  constructor(options = {}) {
    const config = options.config || {};
    if (!config.skill_slug) {
      throw new Error(
        "claude-skill-agent-sdk requires `config.skill_slug` (the folder name under skills/).",
      );
    }
    this.skillSlug = config.skill_slug;
    this.allowBuiltins = Boolean(config.allow_builtins);
    // expose_mcp_tools defaults to true so existing suites keep working.
    // Set false in promptfooconfig.yaml for skills that should NEVER call
    // LaunchDarkly MCP tools (routing skills, advisory skills, etc.) -
    // having the tools available at all is a Chekhov's-gun situation, so
    // the surest guarantee that a skill won't call them is to not expose
    // them in the first place.
    this.exposeMcpTools = config.expose_mcp_tools !== false;
    // force_skill_invocation prepends `/<skill_slug>` to the user message
    // so the SDK's slash-command parser invokes the skill explicitly
    // (loading the SKILL.md body into context). Use for skills whose
    // description-based activation is unreliable in eval - typically
    // routing/advisory skills where the user request would otherwise
    // be answered directly from base knowledge without ever reading
    // the SKILL.md body. In real production use, users would either
    // type the slash command themselves or the orchestrator would
    // pick the skill; this provider option simulates that explicit
    // invocation in eval. Default false so other suites keep working.
    this.forceSkillInvocation = Boolean(config.force_skill_invocation);

    const source = resolveSkillSource(this.skillSlug);
    if (!source) {
      throw new Error(
        `claude-skill-agent-sdk: could not find SKILL.md for slug "${this.skillSlug}" under ${SKILLS_ROOT}/`,
      );
    }
    const { cwd, isolatedConfig } = ensureFixtureCwd(this.skillSlug, source);
    this.cwd = cwd;
    this.isolatedConfig = isolatedConfig;
  }

  id() {
    return `claude-skill-agent-sdk:${this.skillSlug}`;
  }

  async callApi(_prompt, context) {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return { error: "ANTHROPIC_API_KEY environment variable is not set" };
    }

    const userRequest =
      context?.vars?.user_request || "Help me with LaunchDarkly";
    const codebaseContext = context?.vars?.codebase_context || "";
    const maxTurns = clampMaxTurns(context?.vars?.max_turns);

    let userMessage = userRequest;
    if (codebaseContext) {
      userMessage += `\n\n<codebase_context>\n${codebaseContext}\n</codebase_context>`;
    }

    const sdk = await loadSdk();
    const { query, createSdkMcpServer, tool } = sdk;

    const trajectory = [];
    let currentTurn = 0;
    // Per-test mock state. The stateful overlay in _mock.js threads writes
    // (create/setup/clone/update/delete) into this map and reads them back
    // when the agent later calls get-ai-config / get-ai-config-health /
    // list-* . Without this, the agent often retries operations because
    // the static template made them look unsuccessful.
    const mockState = createMockState();

    const mcpTools = this.exposeMcpTools
      ? toolDefs.map((def) =>
          tool(
            def.name,
            def.description,
            inputSchemaToZodShape(def.input_schema),
            async (args) => {
              const template = mockTemplates[def.name];
              const mock = template
                ? renderMockResponse(template, args, def.name, mockState)
                : { error: `No mock configured for tool: ${def.name}` };

              trajectory.push({
                tool: def.name,
                arguments: args,
                turn: currentTurn,
                mock_response_preview: previewMock(mock),
              });

              return {
                content: [{ type: "text", text: JSON.stringify(mock) }],
              };
            },
          ),
        )
      : [];

    const mockServer = this.exposeMcpTools
      ? createSdkMcpServer({
          name: "launchdarkly-mocks",
          tools: mcpTools,
        })
      : null;

    const allowedMcpToolNames = this.exposeMcpTools
      ? toolDefs.map((def) => `mcp__launchdarkly-mocks__${def.name}`)
      : [];

    const agentTools = this.allowBuiltins ? undefined : allowedMcpToolNames;

    // Harness system prompt. Strictly load-bearing mechanics only:
    //   1. Frame the run (eval mode, skill preloaded) so the model
    //      doesn't have to infer it.
    //   2. State tool availability so the model doesn't pause to ask
    //      the (non-existent) user for confirmation. permissionMode
    //      bypasses SDK-level prompts; this stops chat-level "should
    //      I proceed?" turns.
    //   3. Bridge the eval var convention: <codebase_context> is a
    //      harness invention, but skills talk about scanning the repo,
    //      so map one to the other.
    //
    // Anything else - "follow the workflow exactly", "respond with a
    // short summary", "do not append meta-narration", output-contract
    // reinforcement - is the SKILL.md's job. Putting it here measures
    // skill+harness instead of skill, and hides skill defects that
    // would surface in production.
    const harnessPrompt = [
      `You are running under an evaluation harness. The skill "${this.skillSlug}" is loaded into your context.`,
      this.exposeMcpTools
        ? "LaunchDarkly MCP tools are exposed as in-process mocks for this run; treat them as pre-authorized and call them when the skill directs you to."
        : "No LaunchDarkly MCP tools are available for this run.",
      "If the user message includes a <codebase_context> block, treat it as the result of any codebase scan the skill would otherwise perform.",
    ].join("\n\n");

    const queryOptions = {
      cwd: this.cwd,
      settingSources: ["project"],
      ...(mockServer ? { mcpServers: { "launchdarkly-mocks": mockServer } } : { mcpServers: {} }),
      model: MODEL,
      maxTurns,
      permissionMode: "bypassPermissions",
      allowDangerouslySkipPermissions: true,
      // Disable on-disk session state. Promptfoo runs tests with
      // concurrency >1 by default; two parallel queries sharing the
      // same per-skill cwd would otherwise both try to write to
      // <cwd>/.claude/projects/.../session.jsonl and deadlock. We
      // also don't need session resumption for single-shot evals.
      persistSession: false,
      env: {
        ...process.env,
        // Redirect machine-level managed/policy skills lookup so we
        // don't accidentally inherit anything an admin installed at
        // ~/Library/Application Support/ClaudeCode/.claude/skills/.
        CLAUDE_CONFIG_DIR: this.isolatedConfig,
      },
      agent: "eval-agent",
      agents: {
        "eval-agent": {
          description: "Evaluation harness agent for LaunchDarkly skills.",
          prompt: harnessPrompt,
          skills: [this.skillSlug],
          ...(this.forceSkillInvocation
            ? { initialPrompt: `/${this.skillSlug}` }
            : {}),
          ...(agentTools ? { tools: agentTools } : {}),
        },
      },
    };

    if (!this.allowBuiltins) {
      queryOptions.tools = [];
    }

    let finalText = "";
    let resultMessage = null;
    const debug = process.env.SKILL_EVAL_DEBUG === "1";
    const allMessages = [];

    try {
      const q = query({ prompt: userMessage, options: queryOptions });
      for await (const msg of q) {
        if (debug) allMessages.push(msg);
        if (msg.type === "assistant") {
          currentTurn += 1;
        } else if (msg.type === "result") {
          resultMessage = msg;
          if (msg.subtype === "success" && typeof msg.result === "string") {
            finalText = msg.result;
          }
        }
      }
    } catch (err) {
      return {
        error: `claude-skill-agent-sdk failed: ${err && err.message ? err.message : err}`,
      };
    }

    if (debug) {
      const debugDump = path.join(this.cwd, "_debug-messages.json");
      try {
        fs.writeFileSync(
          debugDump,
          JSON.stringify(allMessages, (_k, v) => {
            if (v && typeof v === "object" && typeof v.then === "function") return "[Promise]";
            return v;
          }, 2),
        );
        console.error(`[skill-eval-debug] wrote ${debugDump}`);
      } catch (e) {
        console.error(`[skill-eval-debug] failed to write dump: ${e.message}`);
      }
    }

    // Sum per-model usage so the totals reflect every turn, including
    // cache reads/creations. `resultMessage.usage` only carries the
    // last turn's numbers, which made the promptfoo CLI's per-provider
    // token totals look ~30x smaller than reality on multi-turn runs.
    const modelUsage = resultMessage?.modelUsage || {};
    let inputTokens = 0;
    let outputTokens = 0;
    for (const entry of Object.values(modelUsage)) {
      inputTokens +=
        (entry?.inputTokens || 0) +
        (entry?.cacheReadInputTokens || 0) +
        (entry?.cacheCreationInputTokens || 0);
      outputTokens += entry?.outputTokens || 0;
    }
    if (inputTokens === 0 && outputTokens === 0) {
      inputTokens = resultMessage?.usage?.input_tokens || 0;
      outputTokens = resultMessage?.usage?.output_tokens || 0;
    }

    const cost =
      typeof resultMessage?.total_cost_usd === "number"
        ? resultMessage.total_cost_usd
        : 0;
    const turnCount =
      typeof resultMessage?.num_turns === "number"
        ? resultMessage.num_turns
        : currentTurn;

    return {
      output: JSON.stringify({
        response: finalText || "(no final response captured)",
        trajectory,
        tools_called: trajectory.map((t) => t.tool),
        turn_count: turnCount,
      }),
      tokenUsage: {
        total: inputTokens + outputTokens,
        prompt: inputTokens,
        completion: outputTokens,
      },
      cost,
    };
  }
}

module.exports = ClaudeSkillAgentSdk;
