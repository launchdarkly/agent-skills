---
name: aiconfig-create
description: "Create and configure AI Configs in LaunchDarkly. Helps you choose between agent vs completion mode, create the config, add variations with models and prompts, and verify the setup."
license: Apache-2.0
compatibility: Requires the remotely hosted LaunchDarkly MCP server
metadata:
  author: launchdarkly
  version: "1.0.0-experimental"
---

# Create AI Config

You're using a skill that will guide you through creating an AI Config in LaunchDarkly. Your job is to understand the use case, choose the right mode, create the config and its variations, and verify everything is set up correctly.

> **⚠️ This skill creates a config — it does not make it servable.** A freshly-created AI Config has its **fallthrough pointing at an auto-generated disabled variation**, not at the variation you just created. The SDK will return `ai_config.enabled=False` on every evaluation until you flip targeting on and point the fallthrough at your new variation. This is not a bug — it's the default state. **You must run `/aiconfig-targeting` (or the equivalent REST / CLI call shown in Step 5) before verifying against the SDK**, or verification will look like the LD-served path is broken when it isn't. The single most common failure mode users hit with this skill is skipping the targeting step and spending time debugging `enabled=False` in their application code.

## Prerequisites

This skill requires the remotely hosted LaunchDarkly MCP server to be configured in your environment.

**Primary MCP tool:**
- `setup-ai-config` -- create a config with its first variation in one step (recommended)

**Alternative MCP tools (for more control):**
- `create-ai-config` -- create just the config shell (key, name, mode)
- `create-ai-config-variation` -- add a variation with model, prompts, and parameters
- `get-ai-config` -- verify the config was created correctly

**Optional MCP tools (enhance workflow):**
- `list-ai-configs` -- browse existing configs to understand naming conventions
- `create-project` -- create a project if one doesn't exist yet

## Important: Bias Towards Action

When the user names a use case (e.g. "summarization", "support chatbot", "product descriptions"), that alone is enough context to proceed through the entire workflow. Do not stop to ask follow-up questions for fields you can fill in with the defaults below. Complete create + verify in one pass and surface the choices you made in your final reply so the user can correct any of them with a follow-up message.

### Defaults for under-specified fields

When the user does not name a particular field, fill it in from this table rather than asking:

| Field | Default when unspecified |
|-------|--------------------------|
| `mode` | `completion` (it's the more flexible default; switch to `agent` only if the user names an agent framework like LangGraph / CrewAI / Strands or says "agent") |
| `modelConfigKey` | `OpenAI.gpt-4o-mini` (cheap, capable, broadly compatible) |
| `modelName` | `gpt-4o-mini` |
| `parameters` | `{ "temperature": 0.7 }` for general use, `{ "temperature": 0.3 }` if the use case is summarization / extraction / classification |
| `instructions` (agent mode) | A 2–3 sentence draft derived from the use case |
| `messages` (completion mode) | One system message with a 2–3 sentence draft derived from the use case |
| `key` | kebab-case derived from the use case (e.g. "summarization feature" → `content-summarizer`) |
| `name` | Title-case version of the key |
| `variationKey` | `default` |
| `variationName` | `Default` |

### When it IS okay to ask

Only ask a clarifying question if one of these is true:

1. The user named a constraint that conflicts with the defaults and didn't resolve it (e.g. "use one of our existing approved models for compliance" without telling you which models qualify).
2. The user explicitly asked you to confirm before creating.

In every other case — including when the user says "I'm not sure", "I don't know which mode/model/key to pick", or "let's do this step by step" — apply the defaults table and proceed. "I'm not sure" is not a question to bounce back to the user; it's a signal to use the defaults and report what you chose. **"Step by step" means "execute the workflow in order in a single pass", not "pause between each step to ask for confirmation".**

### Tools belong to a separate skill — non-negotiable

This skill **never** calls `create-ai-tool` and **never** passes `tools: [...]` to `setup-ai-config` or `create-ai-config-variation`. Period. Forbidden tool calls in this skill:

- `create-ai-tool` → forbidden
- `setup-ai-config` with `tools` field populated → forbidden (omit the `tools` field entirely)
- `create-ai-config-variation` with `tools` field populated → forbidden

This is true even when the user names the tools their agent will need ("search the knowledge base", "create tickets", "fetch weather"). When you see those phrases, your action is:

1. Create the config and variation with **no** `tools` field.
2. In your final reply, say something like: "I left tool attachment for the next step — run `/aiconfig-tools` (or just ask) to create and attach `<tool-name-1>` and `<tool-name-2>`."

Do not try to "save the user a turn" by attaching tools at create time. The skill that creates tools (`aiconfig-tools`) is owned separately because tool creation has its own validation, error modes, and confirmation steps. Bundling them here breaks that separation.

## Workflow

### Step 0 — Always check this first (no-tool-creation guard)

Before anything else: scan the user's first message for descriptions of tool functionality the agent will eventually need — phrases like "search the knowledge base", "create a ticket", "fetch weather", "look up X", "query the database", "send an email".

If you see any such phrase, **do not** call `create-ai-tool` and **do not** include `tools: [...]` in your `setup-ai-config` / `create-ai-config-variation` call. Instead:

1. Create the config + first variation with **no** `tools` field.
2. In your final reply, list the tools the user mentioned and say something like: "I'll handle tool creation as a follow-up — say 'add the tools' and I'll create `<tool-name-1>` and `<tool-name-2>` and attach them."

If your planned trajectory contains `create-ai-tool` or a `tools` field on a write call, your reasoning is wrong — drop those and proceed without tools. Tool creation lives in the separate `aiconfig-tools` skill, and bundling it here breaks the separation.

### Step 1: Understand the Use Case

Before creating, identify what you're building:

- **What framework?** LangGraph, LangChain, CrewAI, Strands, OpenAI SDK, Anthropic SDK, custom
- **What does the AI need?** Just text generation, or tools/function calling?
- **Agent or completion?** See the decision matrix below

### Step 2: Choose Agent vs Completion Mode

This choice is about **input schema and framework compatibility**, not execution behavior. Agent mode returns an `instructions` string; completion mode returns a `messages` array. Both provide provider abstraction, A/B testing, and metrics tracking.

| Your Need | Mode | Why |
|-----------|------|-----|
| LangGraph, CrewAI, Strands, AutoGen frameworks | **Agent** | Frameworks expect goal/instruction input |
| Persistent instructions across interactions | **Agent** | Single instructions string, SDK method: `agent_config()` (Python) / `agentConfig()` (Node) |
| Direct OpenAI/Anthropic API calls | **Completion** | Messages array maps directly to provider APIs |
| Full control of message structure | **Completion** | System/user/assistant role-based messages |
| One-off text generation | **Completion** | Standard chat format |
| Need online evaluations (LLM-as-judge) | **Completion** | Online evals are only available in completion mode |

**Both modes support tools.** Not all models support agent mode -- check model compatibility if using agent mode. If unsure, start with completion mode (it's the API default and more flexible).

### Step 3: Create the Config (Recommended: One Step)

Use `setup-ai-config` to create the config and its first variation in one call. This is the recommended approach: it handles creation, variation setup, and verification automatically.

**Config fields:**
- `key` -- unique identifier (lowercase, hyphens)
- `name` -- human-readable name
- `mode` -- `"agent"` or `"completion"`
- Optional: `description`, `tags`

**Variation fields:**
- `variationKey`, `variationName` -- identifiers for the first variation
- `modelConfigKey` -- must be `Provider.model-id` format (e.g., `OpenAI.gpt-4o`, `Anthropic.claude-sonnet-4-5`)
- `modelName` -- the model identifier (e.g., `gpt-4o`). **Always pass this in the initial call** — leaving it off produces a variation that displays "NO MODEL" and forces a second PATCH to set it. The field is `modelName`; it is **not** `name` or `model.name` on this endpoint.

**For agent mode**, provide:
- `instructions` -- a string with the agent's system instructions

Example agent-mode call:
```json
{
  "projectKey": "my-project", "key": "support-agent", "name": "Support Agent",
  "mode": "agent", "variationKey": "default", "variationName": "Default",
  "modelConfigKey": "OpenAI.gpt-4o", "modelName": "gpt-4o",
  "instructions": "You are a customer support agent. Help users resolve their issues."
}
```

**For completion mode**, provide:
- `messages` -- an array of `{role, content}` objects (system, user, assistant)

Example completion-mode call:
```json
{
  "projectKey": "my-project", "key": "product-descriptions", "name": "Product Descriptions",
  "mode": "completion", "variationKey": "default", "variationName": "Default",
  "modelConfigKey": "Anthropic.claude-sonnet-4-5", "modelName": "claude-sonnet-4-5",
  "messages": [
    {"role": "system", "content": "You are a product copywriter. Write compelling descriptions."},
    {"role": "user", "content": "Write a description for: {{product_name}}"}
  ]
}
```

**Optional:**
- `parameters` -- model parameters like `{temperature: 0.7, max_tokens: 2000}` (match the UI's snake_case keys)

The tool returns the full verified config detail with the variation attached.

### Step 3 (Alternative): Two-Step Creation

If the user asks for more control or a step-by-step approach, use the individual tools:

1. `create-ai-config` -- create the config shell
2. `create-ai-config-variation` -- add the variation with model, prompts, and parameters
3. `get-ai-config` -- verify the result (this call is **not** optional)

**Execute all three steps in a single pass without stopping to ask for details.** Infer the variation key (`default`), name (`Default`), instructions/messages, and model from the user's request context. If the user asked for GPT-4o agent mode, you have enough to complete the entire flow. Only ask clarifying questions if the mode or model is truly ambiguous.

**Step 3 (the `get-ai-config` call) is mandatory regardless of how convincing the create response looks.** The two write tools may return what looks like a complete object, but only `get-ai-config` confirms the config was actually persisted with both the shell and variation linked. Skipping this step is a workflow violation — make the call even when you "feel" the previous responses already showed everything.

### Step 4: Verify

If you used `setup-ai-config`, verification is automatic: the response includes the full config with variations. Check:

1. Config exists with the correct mode
2. Variation has a model assigned (not "NO MODEL")
3. Instructions or messages are present
4. Parameters are set

**Use `get-ai-config` for the verification call — do not drop to raw `curl` + `jq`.** The MCP tool returns a typed object you can inspect directly. Hand-rolled `jq` filters against the REST response routinely break: the AI Configs detail endpoint returns the variation list under different keys depending on `expand`, and a filter like `.variations.items[]` will fail with `Cannot index array with string "items"` when the response shape is a bare array. If you must call the REST API, use `jq -e .` first to inspect the actual shape before drilling in.

**Report results:**
- Config created with correct structure
- Variation has model assigned
- Flag any missing model or parameters
- Provide config URL: `https://app.launchdarkly.com/projects/{projectKey}/ai-configs/{configKey}`

### Step 5: Make the variation servable

`setup-ai-config` and `create-ai-config-variation` create the variation but **do not promote it to fallthrough**. The new config will return `enabled=False` to every consumer until targeting is updated. This is the single most common "I created a config but my SDK still gets the fallback" failure. **The workflow is not complete until this step is done.**

#### What to tell the user

Print this checklist verbatim to the user after Step 4, then wait for confirmation. Do not claim the skill succeeded until the user confirms the fallthrough was flipped.

> ✅ Config and variation are created.
>
> 🔴 **The SDK will return `enabled=False` until you flip targeting on.** The fallthrough is currently pointing at an auto-generated disabled variation, not at the `{variationKey}` you just created.
>
> **Next step — run `/aiconfig-targeting`** with these inputs:
> - Project key: `{projectKey}`
> - Config key: `{configKey}`
> - Environment key: the env whose SDK key is in your `.env` (usually `test` or `production`)
> - Fallthrough variation: `{variationKey}` (the one this skill just created)
>
> Verify after targeting is flipped by:
> 1. Opening the AI Config in the LD UI, switching to the correct environment, and confirming "Default rule serves: `{variationName}`" is shown with targeting **On**.
> 2. Running a quick test: `ai_config = ai_client.{completion|agent}_config(...)` and asserting `ai_config.enabled is True`.

#### Direct shortcut if the user wants to flip targeting without invoking the sibling skill

`aiconfig-targeting` is the canonical path — it handles percentage rollouts, targeted rules, and variation-ID lookups. But for the simplest case ("promote the new variation to fallthrough in one environment"), you can run the underlying semantic PATCH yourself once you know the new variation's `_id`.

Get the variation ID (use `get-ai-config` MCP, or):
```bash
curl -s "https://app.launchdarkly.com/api/v2/projects/$PROJECT/ai-configs/$CONFIG_KEY/targeting?env=$ENV" \
  -H "Authorization: $LD_API_KEY" -H "LD-API-Version: beta" \
  | jq '.variations[] | {key, _id}'
```

Flip the fallthrough to point at it:
```bash
curl -X PATCH "https://app.launchdarkly.com/api/v2/projects/$PROJECT/ai-configs/$CONFIG_KEY/targeting?env=$ENV" \
  -H "Authorization: $LD_API_KEY" \
  -H "Content-Type: application/json; domain-model=launchdarkly.semanticpatch" \
  -H "LD-API-Version: beta" \
  -d '{"instructions":[{"kind":"updateFallthroughVariationOrRollout","variationId":"<id-from-step-above>"}]}'
```

Or the same thing via the LD CLI if it's installed locally:
```bash
ldcli resources ai-configs update-ai-config-targeting \
  --projectKey $PROJECT --configKey $CONFIG_KEY --envKey $ENV \
  --data '{"instructions":[{"kind":"updateFallthroughVariationOrRollout","variationId":"<id>"}]}'
```

Do not use `turnTargetingOn` — that semantic-patch instruction does **not** work for AI Configs. `updateFallthroughVariationOrRollout` is the only instruction that actually flips the fallthrough.

## modelConfigKey Format

Required for models to display in the UI. Format: `{Provider}.{model-id}`

- `OpenAI.gpt-4o`
- `OpenAI.gpt-4o-mini`
- `Anthropic.claude-sonnet-4-5`
- `Anthropic.claude-3-5-sonnet`

The `create-ai-config-variation` tool validates this format and rejects invalid values.

## Edge Cases

| Situation | Action |
|-----------|--------|
| Config already exists | Ask if user wants to update instead |
| Variation shows "NO MODEL" | Use `update-ai-config-variation` to set modelConfigKey |
| Need to attach tools | Create tools first (`aiconfig-tools` skill), then update the variation |

## What NOT to Do

- Don't create configs without understanding the use case
- Don't skip the two-step process (config then variation)
- Don't try to attach tools during initial creation -- update the variation afterward
- Don't forget modelConfigKey (models won't show in the UI)
- Don't omit `modelName` from the initial variation call. It is required at create time; setting it via a follow-up PATCH is a workaround for a bug, not the intended flow. The PATCH field is also `modelName`, not `name`.
- Don't drop to raw `curl` + `jq` for verification. Use `get-ai-config` (MCP) — it returns a typed object and avoids brittle `jq` filters that break on response-shape variation.
- Don't consider the workflow complete until the user has been told to run `aiconfig-targeting`. A created variation that isn't promoted to fallthrough returns `enabled=False` to every consumer.

## Related Skills

- `aiconfig-tools` -- Create tools before attaching
- `aiconfig-variations` -- Add more variations for experimentation
- `aiconfig-update` -- Modify configs based on learnings
