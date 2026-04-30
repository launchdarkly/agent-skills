#!/usr/bin/env node
/**
 * Local smoke test for the SDK provider.
 *
 * Not wired into npm scripts on purpose - this is a developer aid for
 * iterating on evals/providers/claude-skill-agent-sdk.js without paying
 * promptfoo + grader cost on every iteration. Prints the provider's
 * trajectory + final response for one canned user request.
 *
 * Usage:
 *   node scripts/_smoke-sdk.js [skill-slug]
 *   (defaults to aiconfig-create)
 */

const path = require("node:path");

require("dotenv").config({ path: path.join(__dirname, "..", ".env") });

const Provider = require("../providers/claude-skill-agent-sdk.js");

/**
 * Reuses the same fixture-and-env scoping the real provider applies,
 * so `init.skills` matches what production-grade eval runs see.
 */
async function dumpSdkInit(slug) {
  const Provider = require("../providers/claude-skill-agent-sdk.js");
  const provider = new Provider({ config: { skill_slug: slug } });
  const sdk = await import("@anthropic-ai/claude-agent-sdk");
  const tinyMcp = sdk.createSdkMcpServer({ name: "noop", tools: [] });
  const q = sdk.query({
    prompt: "ping",
    options: {
      cwd: provider.cwd,
      settingSources: ["project"],
      mcpServers: { noop: tinyMcp },
      maxTurns: 1,
      permissionMode: "bypassPermissions",
      allowDangerouslySkipPermissions: true,
      tools: [],
      env: {
        ...process.env,
        CLAUDE_CONFIG_DIR: provider.isolatedConfig,
      },
      agent: "diag-agent",
      agents: {
        "diag-agent": {
          description: "diagnostic",
          prompt: "Reply with the literal word DONE and nothing else.",
          skills: [slug],
        },
      },
    },
  });
  for await (const msg of q) {
    if (msg.type === "system" && msg.subtype === "init") {
      console.error("[diag] init.skills:", msg.skills);
      console.error("[diag] init.tools:", msg.tools);
      console.error("[diag] init.mcp_servers:", msg.mcp_servers);
      console.error("[diag] init.cwd:", msg.cwd);
    }
    if (msg.type === "result") break;
  }
}

async function main() {
  const slug = process.argv[2] || "aiconfig-create";

  if (process.env.DIAG_ONLY) {
    await dumpSdkInit(slug);
    return;
  }

  console.error("[smoke] running diagnostic init dump first...");
  try {
    await dumpSdkInit(slug);
  } catch (e) {
    console.error("[smoke] diag failed:", e?.message || e);
  }

  const provider = new Provider({ config: { skill_slug: slug } });

  console.error(`[smoke] starting with skill_slug=${slug}, model=${process.env.AGENT_MODEL}`);
  const t0 = Date.now();
  const result = await provider.callApi("(unused)", {
    vars: {
      user_request:
        'Create an AI Config in agent mode for a customer-support chatbot using GPT-4o. Project key is "support-bot".',
      codebase_context:
        "The codebase uses the LaunchDarkly Node.js server SDK. AI Config keys are kebab-case.",
      max_turns: 8,
    },
  });
  const dt = Date.now() - t0;

  console.error(`[smoke] finished in ${dt}ms`);
  if (result.error) {
    console.error("[smoke] ERROR:", result.error);
    process.exit(1);
  }

  let parsed;
  try {
    parsed = JSON.parse(result.output);
  } catch (e) {
    console.error("[smoke] could not parse output as JSON:", e.message);
    console.error(result.output);
    process.exit(1);
  }

  console.error("[smoke] tools_called:", parsed.tools_called);
  console.error("[smoke] turn_count:", parsed.turn_count);
  console.error("[smoke] cost (USD):", result.cost);
  console.error("[smoke] tokens:", result.tokenUsage);
  console.error("[smoke] response (first 500 chars):");
  console.error(parsed.response.slice(0, 500));
  console.error("[smoke] full trajectory:");
  console.error(JSON.stringify(parsed.trajectory, null, 2));
}

main().catch((err) => {
  console.error("[smoke] unhandled error:", err);
  process.exit(1);
});
