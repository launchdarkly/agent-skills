# Skill Evaluations

Automated evaluations for LaunchDarkly agent skills using [promptfoo](https://promptfoo.dev).

Each skill gets a set of test cases that verify an agent follows the skill's workflow correctly when given realistic user requests. The evals run Claude through the [Claude Agent SDK](https://www.npmjs.com/package/@anthropic-ai/claude-agent-sdk) so SKILL.md is loaded the way a real Claude Code session loads it (off disk, via `.claude/skills/<slug>/`), present it with mocked LaunchDarkly MCP tools, and assert on both the tool-call trajectory and response quality.

## Setup

```bash
cd evals
npm install
cp .env.example .env  # then fill in ANTHROPIC_API_KEY (and optionally AGENT_MODEL / RUBRIC_MODEL)
```

Scripts invoke the **locally installed** `promptfoo` from `node_modules` (not `npx promptfoo@latest`) so a supported Node range matches the package you install. If `npx promptfoo@latest` complains about Node version, use `npm run` from this directory after `npm install`.

## Running Evals

```bash
npm run eval:aiconfig-create         # Run all test cases for aiconfig-create
npm run eval:aiconfig-create:single  # Run just the first test case (quick check)
npm run eval:all                     # Run every suite and rebuild ../eval-scores.json
npm run eval:aggregate               # Rebuild ../eval-scores.json from existing results.json files (no API calls)
npm run eval:diff                    # List skills whose source has changed since their last recorded score
npm run eval:badges                  # Sync per-skill README score badges from eval-scores.json
npm run eval:view                    # Open the results UI at localhost:15500
```

`eval:<suite>` and `eval:<suite>:single` exist for every suite registered in `scripts/_manifest.js` (currently `aiconfig-create`, `aiconfig-update`, `aiconfig-tools`, `aiconfig-variations`, `onboarding-router`).

All run scripts pass `--no-cache` so dev iterations always reflect the current SKILL.md and provider.

### Cross-model runs (haiku / sonnet / opus / matrix)

To answer "does my skill still pass on a different agent model?" without juggling `.env` edits:

```bash
npm run eval:haiku         # All suites, agent = Haiku 4.5  (cheapest, weakest reasoning)
npm run eval:sonnet        # All suites, agent = Sonnet 4   (canonical baseline)
npm run eval:opus          # All suites, agent = Opus 4     (strongest, most expensive)
npm run eval:matrix        # All suites × all 3 models, prints a comparison table
```

Each run writes per-(model, suite) results to `<suite>/results.<alias>.json` — the canonical `<suite>/results.json` and `../eval-scores.json` produced by `eval:all` are **not** touched, so PR-blocking thresholds remain anchored to Sonnet 4. To promote a particular model run into the canonical scores, copy `<suite>/results.<alias>.json` over `<suite>/results.json` and run `npm run eval:aggregate`.

Subset and ad-hoc model overrides are supported via the dispatcher directly:

```bash
node scripts/run-models.js --model=haiku --only=aiconfig-create,aiconfig-tools
node scripts/run-models.js --model=claude-something-newer-2026 --only=aiconfig-create
```

Model aliases live in `scripts/_models.js`; edit there when newer Anthropic models ship. The rubric grader (`RUBRIC_MODEL`) is independent and stays on a cheap model regardless of which agent you pick.

## Architecture

```
evals/
  shared/
    defaults.yaml            # defaultTest block merged into every suite via -c shared/defaults.yaml
    transform.js             # parses agent output once so assertions skip JSON.parse
    output-valid.js          # weight-0 sanity assertion for the parse step
    assertions.js            # FIRST/LAST trajectory helpers (used by scripts; convention reference for inline assertions)
  providers/
    claude-skill-agent-sdk.js # The agent loop: loads the skill via @anthropic-ai/claude-agent-sdk
                              # from a per-skill `.claude/skills/<slug>/` fixture and routes
                              # mocked LD tools through an in-process MCP server.
    _mock.js                  # object-walker mock-response renderer
    _jsonschema-to-zod.js     # JSON Schema -> Zod raw shape (used by the provider)
  .tmp-skill-fixtures/        # Generated at runtime by the provider, gitignored.
                              # One isolated cwd per skill slug, containing only
                              # .claude/skills/<slug>/ symlinked back to ../../skills/...
                              # so the SDK only discovers the one skill being evaluated.
  scripts/
    aggregate.js             # runs every suite (or just changed ones) and writes ../eval-scores.json
    diff-changed-skills.js   # git-log diff to compute which suites need re-running
    render-badges.js         # writes the eval-score block in each skill's README
    _smoke-sdk.js            # local smoke runner / SDK init dump (developer aid, not in npm scripts)
    _diag-isolation.js       # local diagnostic for skill-discovery isolation (developer aid)
  tools/
    definitions.json         # Anthropic-format tool definitions for all LD MCP tools
  mocks/
    tool-responses.json      # Canned responses returned when Claude calls a tool
  <skill-name>/
    promptfooconfig.yaml     # One directory per skill, e.g. aiconfig-create/promptfooconfig.yaml
```

### Shared defaults (`shared/defaults.yaml`)

Every suite is run with two `-c` flags:

```bash
promptfoo eval -c shared/defaults.yaml -c <skill>/promptfooconfig.yaml
```

promptfoo's `combineConfigs` deep-merges `defaultTest.options`, concatenates `defaultTest.assert`, and dedupes providers, so the suite config only declares what's specific to it (description, prompts, provider config, tests, suite-specific assertions). The shared defaults supply:

- `defaultTest.options.provider: "{{env.RUBRIC_MODEL}}"` - rubric grader (cheap model).
- `defaultTest.options.transform: file://./transform.js` - parses the agent's JSON output once. Every javascript assertion downstream receives `output` as an object with `{ response, trajectory, tools_called, turn_count }` instead of a string. **Do not call `JSON.parse(output)` inside assertions.**
- `defaultTest.assert: [output_valid, cost, latency]` - cheap regression detection. `output_valid` is weight 0 so it does not affect the score, just surfaces transform failures clearly.

### Model strategy

Two distinct models, two env vars:

| Variable | Used by | Default | Why |
|----------|---------|---------|-----|
| `AGENT_MODEL` | the provider (system under test) | `claude-sonnet-4-20250514` | Stays on Claude because that's representative of what users actually run. |
| `RUBRIC_MODEL` | `defaultTest.options.provider` (rubric grader) | `anthropic:messages:claude-haiku-4-5-20251001` | Cheaper grader cuts cost roughly 10x without changing what's measured. |

`EVAL_MODEL` (the legacy variable) is still honoured as a fallback for `AGENT_MODEL` so existing `.env` files keep working.

### Trajectory ordering convention

The agent provider returns `{ trajectory, tools_called }`. Inline javascript assertions follow this convention when checking "X happens after Y":

- **Use the FIRST occurrence of the prerequisite** (`tools.indexOf(prerequisite)`).
- **Use the LAST occurrence of the verifier** (`tools.lastIndexOf(verifier)`).

Rationale: agents commonly call `get-foo` once before mutating and once after to verify. With `indexOf` for both, a "post-mutation get" assertion would silently pass against the pre-mutation call. The convention closes that hole.

`shared/assertions.js` exports helper functions (`firstCallOf`, `lastCallOf`, `expectAfter`, etc.) for use from scripts that consume the trajectory; promptfoo's inline `type: javascript` assertions cannot `require` modules (they run via `new Function`), so inline assertions implement the convention by hand using `indexOf` / `lastIndexOf`.

### How a test case runs

1. Promptfoo loads the suite's `promptfooconfig.yaml` and the `shared/defaults.yaml` overlay.
2. The provider builds an isolated cwd at `.tmp-skill-fixtures/<slug>/` containing only `.claude/skills/<slug>/` symlinked to the real skill source, redirects `CLAUDE_CONFIG_DIR` to a throwaway directory, and calls `query()` from `@anthropic-ai/claude-agent-sdk` with `agents.eval-agent.skills: [<slug>]` so the SDK preloads the skill body.
3. Mocked LaunchDarkly MCP tools are exposed through an in-process MCP server (`createSdkMcpServer`). Their inputs come from the test's `user_request` + `codebase_context` vars, and their outputs come from `mocks/tool-responses.json` with template placeholders substituted from the tool input.
4. Each tool call is recorded into a trajectory. When the agent finishes, the provider returns:
   ```json
   {
     "response": "The agent's final text...",
     "trajectory": [
       { "tool": "list-ai-configs", "arguments": {...}, "turn": 1 },
       { "tool": "create-ai-config", "arguments": {...}, "turn": 2 }
     ],
     "tools_called": ["list-ai-configs", "create-ai-config"],
     "turn_count": 3
   }
   ```
5. `shared/transform.js` parses that into an object before assertions see it. Suite assertions read fields directly: `output.tools_called`, `output.trajectory`, etc.

## Aggregated quality artifact (`eval-scores.json`)

Running `npm run eval:all` invokes every suite and writes a summary file at the repo root (`../eval-scores.json` from this directory). Schema:

```json
{
  "schemaVersion": 1,
  "updatedAt": "2026-04-28T00:00:00Z",
  "skills": {
    "ai-configs/aiconfig-create": {
      "score": 100,
      "passed": 5,
      "total": 5,
      "status": "passing",
      "lastCommit": "abc1234",
      "lastRun": "2026-04-28T00:00:00Z",
      "perTest": [{ "description": "...", "pass": true, "score": 1.0 }]
    }
  }
}
```

The CI workflow at `.github/workflows/eval-skills.yml` keeps this file fresh by re-running only the suites whose source has changed since the last recorded `lastCommit`, computed by `scripts/diff-changed-skills.js`.

`npm run eval:badges` synchronises a small `<!-- eval-score:start --> ... <!-- eval-score:end -->` block in each skill's README from `eval-scores.json` so the score is visible before installation. Manual edits outside that block are preserved.

## Adding Evals for a New Skill

### Step 1: Check tool coverage

Read the SKILL.md and note every MCP tool it references (in its "Required MCP tools" and "Optional MCP tools" sections). Verify each tool exists in `tools/definitions.json` and has a mock response in `mocks/tool-responses.json`. If not, add them (see sections below).

### Step 2: Create the eval directory

```bash
mkdir <skill-name>
```

Use the same directory name as the skill (e.g., `aiconfig-create`).

### Step 3: Write `promptfooconfig.yaml`

Use the following template (suite configs no longer carry their own `defaultTest` block - that comes from `shared/defaults.yaml`):

```yaml
# yaml-language-server: $schema=https://promptfoo.dev/config-schema.json
description: "End-to-end evaluation of the <skill-name> skill"

prompts:
  - file://../../skills/<domain>/<skill-name>/SKILL.md

providers:
  - id: file://../providers/claude-skill-agent-sdk.js
    label: claude-skill-agent-sdk
    config:
      skill_slug: <skill-name>

tests:
  - description: "<describe the scenario>"
    vars:
      user_request: >
        <what the user asks the agent to do>
      codebase_context: >
        <simulated info about the user's codebase -- SDK, naming conventions, etc.>
    assert:
      # ... assertions (see below)
```

`config.skill_slug` is the directory name of the skill under `skills/` (the provider auto-resolves both `skills/<slug>/` and `skills/<area>/<slug>/` layouts). The `prompts:` field is still required by promptfoo and points at the same SKILL.md for documentation; the provider itself ignores the prompt parameter and lets the SDK load the skill from disk.

#### Provider config options

| Option | Default | Effect |
|--------|---------|--------|
| `skill_slug` | (required) | Folder name of the skill under `skills/` |
| `allow_builtins` | `false` | When `true`, expose Claude Code's built-in tools (Read/Grep/Glob/Bash/Edit/Write/...). Otherwise the agent only sees the LaunchDarkly mock MCP tools. |
| `expose_mcp_tools` | `true` | When `false`, do not expose any LaunchDarkly mock MCP tools to the agent. Use for routing skills, advisory skills, and others that produce text-only output and should not call LD tools. The harness system prompt is also adjusted so the agent isn't nudged toward tool use. |
| `force_skill_invocation` | `false` | When `true`, set the agent's `initialPrompt` to `/<skill_slug>` so the SDK's slash-command parser invokes the skill explicitly and the SKILL.md body is loaded into the agent's context. Use for skills whose description-based auto-activation is unreliable — typically routing or advisory skills where the agent would otherwise answer the user's question from base knowledge without ever reading the SKILL.md body. In production, the orchestrator (or the user typing `/<slug>`) plays the equivalent role. |

Add a matching pair of npm scripts in `package.json` (`eval:<skill>` and `eval:<skill>:single`) so the suite picks up the shared defaults via `-c shared/defaults.yaml`.

### Step 4: Write test cases

Aim for 3-5 test cases per skill covering:

1. **Happy path** -- the most common use case the skill is designed for.
2. **Variant input** -- a different config shape, mode, or user intent that exercises a decision branch in the skill.
3. **Exploration** -- a scenario where the user is uncertain and the agent should investigate before acting.
4. **Edge case or metadata** -- tests that specific inputs (tags, descriptions, custom fields) get passed through correctly.
5. **Safety** -- a scenario that tempts the agent to do something the skill warns against.

Each test case has two `vars`:

| Variable | Required | Purpose |
|----------|----------|---------|
| `user_request` | Yes | What the user asks. Write it naturally, as a real user would. Include the project key and enough detail for the agent to act. |
| `codebase_context` | No | Simulated codebase info: SDK in use, naming conventions, file structure. Set to `""` to test exploration behavior when the agent has no context. |
| `max_turns` | No | Override the default 15-turn cap (clamped 1..30). |

### Step 5: Write assertions

Inline `type: javascript` assertions receive `output` already parsed (no `JSON.parse(output)` needed) and must return `{ pass: boolean, score: number, reason: string }`. Promptfoo rejects objects missing `score`.

#### Assertion categories

Use a mix of deterministic and LLM-judged assertions:

**Tool presence** -- did the agent call the right tools?

```yaml
- type: javascript
  value: |
    const tools = output.tools_called || [];
    const pass = tools.includes('create-ai-config');
    return { pass, score: pass ? 1 : 0, reason: 'Tools: ' + tools.join(' -> ') };
  metric: calls_create_ai_config
  weight: 3
```

**Tool ordering** (FIRST prerequisite, LAST verifier) -- were tools called in the expected sequence?

```yaml
- type: javascript
  value: |
    const tools = output.tools_called || [];
    const aIdx = tools.indexOf('list-ai-configs');
    const bIdx = tools.lastIndexOf('create-ai-config');
    const pass = aIdx >= 0 && bIdx > aIdx;
    return { pass, score: pass ? 1 : 0, reason: 'list@' + aIdx + ' create@' + bIdx };
  metric: explores_before_creating
  weight: 3
```

**Tool arguments** -- were the arguments correct?

```yaml
- type: javascript
  value: |
    const call = (output.trajectory || []).find(t => t.tool === 'create-ai-config');
    if (!call) return { pass: false, score: 0, reason: 'No create-ai-config call' };
    const a = call.arguments;
    const isAgent = a.mode === 'agent';
    const hasName = typeof a.name === 'string' && a.name.length > 0;
    const score = (isAgent ? 0.5 : 0) + (hasName ? 0.5 : 0);
    return { pass: score >= 0.5, score, reason: 'mode=' + (a.mode || '?') + ' name=' + (a.name || '?') };
  metric: create_args_correct
  weight: 3
```

**Forbidden tools** -- did the agent avoid tools it should not call?

```yaml
- type: javascript
  value: |
    const tools = output.tools_called || [];
    const forbidden = ['delete-ai-config'];
    const called = forbidden.filter(f => tools.includes(f));
    const pass = called.length === 0;
    return { pass, score: pass ? 1 : 0, reason: pass ? 'No forbidden tools' : 'Called: ' + called.join(', ') };
  metric: no_destructive_tools
  weight: 3
```

**LLM rubric** -- semantic evaluation of the agent's overall response:

```yaml
- type: llm-rubric
  value: |
    Evaluate whether the agent followed the skill workflow correctly.
    Score based on these criteria:
    1. <criterion derived from the skill's workflow steps>
    2. <criterion>
    3. <criterion>
    Score 1.0 if all criteria are met, deduct proportionally for each miss.
  metric: workflow_quality
  weight: 2
```

#### Weight guidelines

| Weight | Use for |
|--------|---------|
| 3 | Core behavior -- the tool call that is the entire point of the skill |
| 2 | Important supporting behavior -- verification steps, safety checks, workflow quality |
| 1 | Nice-to-have -- metadata, formatting, optional steps |
| 0 | Sanity checks that should not affect the overall score (e.g., `output_valid`) |

#### Metric naming

Use lowercase `snake_case` metric names. Reuse these names across skills when the concept is the same:

- `calls_<tool_name>` -- tool was called
- `<tool>_args_correct` -- tool arguments are valid
- `no_destructive_tools` -- forbidden tool avoidance
- `explores_before_creating` -- exploration happened before mutation
- `naming_convention` -- flag/config key matches codebase convention
- `workflow_quality` -- LLM rubric for overall skill adherence
- `safety_focus` -- LLM rubric for safety-specific scenarios

## Adding Tools to `tools/definitions.json`

When a skill references an MCP tool that is not yet in `tools/definitions.json`, add it. The format is Anthropic's tool definition schema:

```json
{
  "name": "tool-name",
  "description": "Copied from the tool's description in launchdarkly-gram-functions/src/tools/*.ts",
  "input_schema": {
    "type": "object",
    "properties": {
      "param": { "type": "string", "description": "..." }
    },
    "required": ["param"]
  }
}
```

Derive the schema from the corresponding Zod `inputSchema` in `launchdarkly-gram-functions/src/tools/`. Convert `z.string()` to `"type": "string"`, `z.optional(...)` means the field is not in `required`, `z.enum([...])` becomes `"enum": [...]`, etc.

## Adding Mock Responses to `mocks/tool-responses.json`

Each tool needs a mock response keyed by tool name. The mock should resemble what the real LaunchDarkly API returns (use the fixtures in `launchdarkly-gram-functions/src/__tests__/fixtures/` as reference).

Template placeholders like `{{configKey}}` and `{{configName}}` are substituted by `providers/_mock.js` at runtime. Substitution walks the parsed mock object and only replaces placeholders inside string leaves, so quote/backslash characters in tool inputs are safe. Add new placeholders by extending `buildReplacements` in `providers/_mock.js`.

Important: make sure mock data for `list-*` tools does not contain items that match the test case's expected creation target. If `list-ai-configs` returns a config named `support-bot` and the test asks the agent to create a support bot config, the agent will skip creation because it thinks the config already exists.

## Conventions

- One `promptfooconfig.yaml` per skill, in its own directory under `evals/`.
- 3-5 test cases per skill.
- Every JavaScript assertion returns `{ pass, score, reason }`.
- `shared/defaults.yaml` is always merged in via the npm scripts; assertions assume `output` is already a parsed object.
- Trajectory ordering uses FIRST occurrence of the prerequisite and LAST occurrence of the verifier (see "Trajectory ordering convention" above).
- Prefer deterministic JavaScript assertions for tool trajectory checks. Use `llm-rubric` only for semantic quality that cannot be checked programmatically.
- Keep `llm-rubric` criteria derived directly from the skill's workflow steps -- if the skill says "do X before Y," the rubric should check for it.
- Do not hardcode flag keys or config names in assertions. Check patterns (kebab-case, snake_case) and argument presence, not exact values.
- Set `codebase_context` to `""` when testing the agent's ability to explore on its own.

## Environment Variables

| Variable | Required | Purpose |
|----------|----------|---------|
| `ANTHROPIC_API_KEY` | Yes | Authenticates the agent with Anthropic. Also used by the rubric grader if `RUBRIC_MODEL` is an Anthropic model (the default). |
| `OPENAI_API_KEY` | If `RUBRIC_MODEL` is an OpenAI model | Authenticates the rubric grader. |
| `AGENT_MODEL` | No | Override the system-under-test model (default: `claude-sonnet-4-20250514`). |
| `RUBRIC_MODEL` | No (recommended) | Rubric grader model used for `llm-rubric` assertions (default in `.env.example`: `anthropic:messages:claude-haiku-4-5-20251001`). |
| `EVAL_MODEL` | No (legacy) | Pre-existing alias still honoured as a fallback for `AGENT_MODEL`. |
