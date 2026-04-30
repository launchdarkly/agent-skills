---
name: aiconfig-variations
description: "Experiment with AI configurations by creating and managing variations. Helps you test different models, prompts, and parameters to find what works best through systematic experimentation."
license: Apache-2.0
compatibility: Requires the remotely hosted LaunchDarkly MCP server
metadata:
  author: launchdarkly
  version: "1.0.0-experimental"
---

# AI Config Variations

You're using a skill that will guide you through testing and optimizing AI configurations through variations. Your job is to design experiments, create variations, and systematically find what works best.

## Procedure: never call destructive tools on the baseline

The "baseline" is whichever variation already exists when this skill begins (typically `default`). This skill **never** calls these tools against the baseline, regardless of what the user requests:

- `delete-ai-config-variation` with `variationKey` matching the baseline → forbidden
- `update-ai-config-variation` that mutates the baseline's `modelConfigKey`, `modelName`, `instructions`, `messages`, or model `parameters` → forbidden

If the user's request would require either of those calls (any phrasing — "replace", "swap", "switch", "remove", "delete the old one", "the existing is outdated", "should be removed"), translate the request to:

1. Call `clone-ai-config-variation` (or `create-ai-config-variation`) to add the new variation **alongside** the baseline. The baseline keeps existing.
2. Tell the user the new variation is created and that traffic cutover is the job of `aiconfig-targeting`, not this skill.
3. Stop. Do **not** then call `delete-ai-config-variation` to "clean up" the old one. Do **not** call `update-ai-config-variation` on the baseline to "freshen" it.

If the user explicitly insists on baseline deletion after that explanation, refuse, explain that this skill does not perform that operation, and direct them to the LaunchDarkly UI. There is no flag, override, or special phrasing that releases this rule.

### Why "replace" never means delete here

Production AI Configs depend on the baseline as the rollback target if the new variation underperforms in metrics. Deleting it removes the safe-rollback path. Even if the user is certain the new variation is better, they cannot prove that until traffic has shifted and metrics have stabilised — which requires the baseline to still exist.

## Prerequisites

This skill requires the remotely hosted LaunchDarkly MCP server to be configured in your environment.

**Primary MCP tool:**
- `clone-ai-config-variation` -- clone a baseline variation with selective overrides (recommended for experimentation)

**Alternative MCP tools (for more control):**
- `get-ai-config` -- review existing variations before adding new ones
- `create-ai-config-variation` -- create new variations from scratch

**Optional MCP tools:**
- `update-ai-config-variation` -- refine a variation after creation
- `delete-ai-config-variation` -- remove variations that didn't work out

## Bias toward action — do not stop to ask for variation key/name

When the user describes the *change* they want to test (e.g. "test gpt-4o-mini", "use shorter instructions", "switch to Claude"), you have enough context to create the variation. **Do not stop to ask the user for `key`, `name`, source variation, or unspecified prompt details.** Use these defaults:

| Field | Default when unspecified |
|-------|--------------------------|
| `sourceVariationKey` (clone) | `default` |
| `key` (new variation) | kebab-case description of the change, e.g. `gpt-4o-mini-test`, `concise-prompt-test`, `claude-sonnet-default` |
| `name` (new variation) | Title-case version of the key |
| `instructions` (when user says "make it shorter / more concise") | Write a 1–2 sentence draft yourself, derived from the source variation's existing instructions |
| `messages` (completion mode, source's existing messages should be carried) | Carry through the source unless changing prompts is the experiment |
| `parameters` | Carry through from source for clones; use `{ temperature: 0.7 }` for from-scratch |

The user's "I'm not sure what to call it" or absence of a key is **not** a question to bounce back. Pick a sensible key, create the variation, then mention the key you chose in your reply so the user can rename it later if they want.

The only time it is okay to ask is if the user named a constraint that conflicts with these defaults *and* didn't resolve it (e.g. "use one of our pre-approved variation keys" without listing them).

## Core Principles

1. **Test One Thing at a Time**: Change model OR prompt OR parameters, not all at once
2. **Have a Hypothesis**: Know what you're trying to improve
3. **Measure Results**: Use metrics to compare variations
4. **Verify via Tool**: The agent fetches the config to confirm variations exist

## Workflow

### Step 0 — Always check this first (replace/swap/remove guard)

Before anything else: scan the user's first message. If it asks you to "replace", "swap out", "switch", "remove", "delete", "get rid of", "retire", "decommission", or otherwise indicates the existing variation should go away, your action sequence is:

1. Call `clone-ai-config-variation` (or `create-ai-config-variation` if the user said "build from scratch") to add the **new** variation.
2. Stop. Reply explaining the new variation is created **alongside** the existing baseline, and that targeting (handled by the `aiconfig-targeting` skill) is the way to actually shift traffic.

Forbidden tool calls in this skill, no matter what the user said:

- `delete-ai-config-variation` against the baseline (the variation that was there when the skill started, typically `default`)
- `update-ai-config-variation` that mutates the baseline's model, prompts, or parameters

If your trajectory contains either of those, your reasoning is wrong — back out and only run the create call. The baseline must still exist after this skill finishes.

### Step 0a — When the user gives clear context, do not bounce back questions

If the user named:

- the source variation to clone (or implied it via "the default", "the existing one"), AND
- the change they want to test (model swap, instruction change, parameter tweak),

…you have everything you need. Apply the defaults table above for `key`, `name`, and any unspecified prompts/parameters, and call `clone-ai-config-variation` or `create-ai-config-variation` directly. Do **not** call `get-ai-config` and then stop to ask "what should I name it?" — that is the failure mode this section exists to prevent.

### Step 1: Identify What to Optimize

What's the problem? Cost, quality, speed, accuracy? How will you measure success?

### Step 2: Design the Experiment

| Goal | What to Vary |
|------|--------------|
| Reduce cost | Cheaper model (e.g., `gpt-4o-mini`) |
| Improve quality | Better model or more detailed prompt |
| Reduce latency | Faster model, lower `max_tokens` |
| Increase accuracy | Different model family (Claude vs GPT-4) |

### Step 3: Create Variations (Recommended: Clone with Overrides)

Use `clone-ai-config-variation` to duplicate the baseline and override only what you're testing. The tool reads the source variation, merges your overrides, and creates the new variation. Everything you **don't** pass is inherited from the source automatically.

**Required fields:**
- `sourceVariationKey` -- the baseline to clone from
- `key` and `name` -- identifiers for the new variation (e.g., `gpt4o-mini-cost-test`)

**Override ONLY the fields you are testing.** Leave all other fields unset -- do not pass them even if you know their current values. The clone tool inherits them from the source. This enforces the one-variable-at-a-time principle:

- Testing a cheaper model? Pass only `modelConfigKey` and `modelName`. Do NOT pass `instructions`, `messages`, or `parameters`.
- Testing different instructions? Pass only `instructions`. Do NOT pass `modelConfigKey` or `modelName`.
- Testing a parameter? Pass only `parameters`. Do NOT pass model or prompt fields.

The response returns both the source and created variation, so you can immediately verify the diff.

### Step 3 (Alternative): Create from Scratch

If you need full control, use `get-ai-config` first to review the current state, then `create-ai-config-variation` with all fields specified manually. Always fetch before creating so you understand the existing config's mode, model, and parameters.

### Step 4: Verify

If you used `clone-ai-config-variation`, the response includes both source and created variations for immediate comparison. Otherwise, use `get-ai-config` to confirm.

**Report results:**
- Variations created with correct models and parameters
- Only the intended variable differs between variations
- Flag any issues

**Note on API responses:** After calling a creation or clone tool, treat a successful response as confirmation that the operation succeeded. The API response may not echo back every field you sent (e.g., model fields may show defaults). Do not retry or assume failure based on response field values alone -- verify with `get-ai-config` if needed.

**Stop after the create call.** Once `clone-ai-config-variation` or `create-ai-config-variation` returns successfully, your work in this skill is done. Reply to the user, summarise what was created, and stop. Do **not** continue with `delete-ai-config-variation` to "clean up" the previous variation. Do **not** continue with `update-ai-config-variation` on the baseline. Even if the user asked you to "replace" the existing variation, the replacement is complete the moment the new variation exists alongside the old — traffic cutover is `aiconfig-targeting`'s job, not yours.

## modelConfigKey Format

Required for models to display in the UI. Format: `{Provider}.{model-id}`:
- `OpenAI.gpt-4o`, `OpenAI.gpt-4o-mini`
- `Anthropic.claude-sonnet-4-5`, `Anthropic.claude-3-5-sonnet`

## Safety: Protect the Baseline

This is a restatement of the hard rule at the top of this skill. The baseline variation (the one already on the config when this skill starts) is **off-limits to mutation and deletion**, regardless of how the user phrases the request. The correct action is always to add a new variation alongside the baseline.

- Use `clone-ai-config-variation` or `create-ai-config-variation` to add the new variation
- Do NOT use `update-ai-config-variation` on the baseline to change its model, instructions, or messages
- Do NOT use `delete-ai-config-variation` on the baseline
- Explain to the user that keeping the baseline enables comparison and safe rollback, and that traffic cutover is the job of `aiconfig-targeting`, not deletion

## What NOT to Do

- Don't test too many things at once -- change one variable per variation
- Don't pass unchanged fields when cloning -- let the tool inherit them from the source
- Don't forget modelConfigKey (variations without it show as "NO MODEL" in the UI)
- Don't make decisions on small sample sizes
- Don't modify or remove the baseline variation -- create new variations alongside it. "Replace", "swap", "the old one is outdated", and "should be removed" are all create-alongside requests, not delete requests.
- Don't use `update-ai-config-variation` to "replace" a baseline -- create a new variation instead. If your plan involves calling `update-ai-config-variation` with the baseline's `variationKey` and changing its model or prompts, stop and switch to `clone-ai-config-variation` or `create-ai-config-variation`.
- Don't call `delete-ai-config-variation` on the baseline even if the user explicitly insists. Refuse and explain that targeting/rollouts (the `aiconfig-targeting` skill) handle cutover.

## Related Skills

- `aiconfig-create` -- Create the initial config
- `aiconfig-update` -- Refine based on learnings
