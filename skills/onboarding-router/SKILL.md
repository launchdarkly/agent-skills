---
name: onboarding-router
description: "Decide which LaunchDarkly product to onboard FIRST: Feature Flags, AI Configs, Experiments, or Observability. Use this skill BEFORE any other LaunchDarkly setup whenever the user wants to add LaunchDarkly to a codebase, including: 'wrap in a feature flag', 'add a feature flag', 'create a feature flag', 'set up a kill switch', 'do a percentage rollout', 'manage LLM prompts', 'set up AI Configs', 'use OpenAI / Anthropic / Claude / GPT with LaunchDarkly', 'A/B test', 'run an experiment', 'measure a metric', 'add session replay', 'track errors', 'add observability / OTel / RUM', 'get started with LaunchDarkly', 'onboard me to LaunchDarkly', 'set up LaunchDarkly', 'help me start with LaunchDarkly', 'add LaunchDarkly to my project'. Reads the user's intent and codebase signals (LLM SDKs, OTel packages, frontend frameworks, analytics events), picks ONE route, names the destination skill (onboarding for flags, aiconfig-create for AI Configs, etc.), and stops. Never installs SDKs, creates flags, calls MCP tools, or runs setup itself - that is the destination skill's job."
license: Apache-2.0
compatibility: Works on any MCP-capable coding agent. No LaunchDarkly account or API token needed for routing itself; the path you hand off to may require one.
metadata:
  author: launchdarkly
  version: "0.1.0"
---

# LaunchDarkly Onboarding Router

This is a **routing skill**. Your only job is to pick one of the four LaunchDarkly onboarding paths and name the destination skill the user should run next. You do not install anything, create anything, write any code, or describe any setup steps.

**Length budget for your reply: ~120 words, max ~150.** A 300-word reply with a multi-step roadmap is a routing failure even if the chosen route is correct. Keep it tight.

## Output contract — your entire reply must be one of these two shapes

> The destination skill is responsible for SDK installs, package names, code snippets, dashboard tours, rollout strategy, and every other implementation detail. **Including any of those in your reply is a bug.**

### Shape A — confident handoff (use when one route is clear)

Two paragraphs. That's it.

```
Going to start you on **<Route>** — <one-sentence reason, plain English>.<optional: one secondary call-out, one short sentence>

Next step: run the **`<destination-skill>`** skill.<optional: one sentence about a critical follow-up, e.g. "After that, run aiconfig-targeting to make the config servable.">
```

Real examples (copy this shape, do not extend it):

> Going to start you on **Feature Flags** — that's the foundation, and your Next.js + Express repo is a clean fit.
>
> Next step: run the **`onboarding`** skill (e.g. `/onboarding` if your agent supports slash commands). It will set up the LaunchDarkly MCP server, install the right SDK for your stack, and create your first flag.

> Going to start you on **AI Configs** — your repo is full of `openai` calls and that's the highest-leverage starting point. If you'd rather start with feature flags, say so and I'll switch.
>
> Next step: run the **`aiconfig-create`** skill. After it creates your config, also run **`aiconfig-targeting`** — fresh AI Configs default to a disabled fallthrough and the SDK returns `enabled=False` until targeting is set.

> Going to start you on **Experiments** — heads up, this is a multi-skill path because there's no single experiments-onboarding skill yet.
>
> Next step: run **`launchdarkly-flag-create`** to make the flag we'll vary on, then **`launchdarkly-metric-choose`** + **`launchdarkly-metric-create`** for the metrics. Experimentation docs: https://launchdarkly.com/docs/home/experimentation.

> Going to start you on **Observability** — heads up, there's no agent-driven onboarding skill for this surface yet, so this is a docs-led walkthrough.
>
> Next step: I'll grab the LaunchDarkly Observability docs (https://launchdarkly.com/docs/home/observability) and the right SDK install page for your React stack, and we'll wire up session replay + error tracking together.

### Shape B — clarifying question (use ONLY when there is no signal at all)

```
<one short sentence acknowledging there's not enough signal yet>

1. **Feature Flags** — wrap code behind a toggle, percentage rollouts, kill switches.
2. **AI Configs** — manage LLM prompts and models from LaunchDarkly.
3. **Experiments** — A/B test changes and measure metrics.
4. **Observability** — session replay, errors, logs, traces.
```

Real example:

> I don't have enough signal yet to pick the right path — which would you like to start with?
>
> 1. **Feature Flags** — wrap code behind a toggle, percentage rollouts, kill switches.
> 2. **AI Configs** — manage LLM prompts and models from LaunchDarkly.
> 3. **Experiments** — A/B test changes and measure metrics.
> 4. **Observability** — session replay, errors, logs, traces.

## Forbidden in your reply

- **No section headings** like `## 1. Account Setup`, `## Recommended Onboarding Path`, `## Summary`, `## Implementation Pattern`, `## Assessment`, `## Frontend Integration`. The router output is two paragraphs — no headings beyond the bold route name.
- **No SDK install commands.** Do not type `npm install launchdarkly-...` or `pip install launchdarkly...`. The destination skill does that.
- **No code snippets.** No `useFlags()`, no JSX examples, no provider wrap examples. The destination skill does that.
- **No multi-step roadmaps.** No "Start with internal testing, then 5%, then 25%, then 100%". No "Step 1, Step 2, Step 3". The destination skill does that.
- **No documentation tours.** Don't link more than one or two docs URLs, and only when the route is `experiments` or `observability` (where docs are part of the dispatch).
- **No meta-narration.** Do not start with "I'll follow the onboarding-router skill workflow." Do not end with "Summary: I analyzed your request and provided a tailored path." Just route.
- **No internal labels.** No "Branch A", "Step 2", "D7", "Per the SKILL.md".
- **No MCP authentication prompts.** Do not emit "Please open this URL to authenticate". MCP setup belongs to the destination skill.
- **No tool calls.** This skill has no tools available. Read-only context analysis only.

## How to decide which shape to use

1. **Stated intent wins.** If the user named a surface, pick that route → Shape A. Phrases like "feature flag", "wrap in a flag" → `flags`. "LLM", "prompt", "GPT", "Claude", "OpenAI" → `ai-configs`. "A/B test", "experiment", "metric" → `experiments`. "session replay", "error tracking", "OTel", "RUM" → `observability`.
2. **Codebase tilt picks for ambiguous requests.** If the user's request is generic ("set me up", "where do I start", "help me get started") and the `<codebase_context>` (or actual repo) shows clear LLM SDKs (`openai`, `anthropic`, `langchain`) → `ai-configs`. Heavy `@opentelemetry/*` or stated observability intent → `observability`. Otherwise default to `flags`. → Shape A. **REQUIRED when routing from codebase tilt:** include a one-sentence switch offer phrased as "If you'd rather start with X, say so and I'll switch." or "Happy to switch to X if you'd prefer." This acknowledges that you guessed from the codebase and gives the user an out. Skip the switch offer only when the user's stated intent already named the surface.
3. **Multiple intents.** Pick the primary by precedence: `ai-configs` > `flags` > `experiments` > `observability`. Mention the secondary in one sentence. → Shape A.
4. **No signal at all** (generic request + no usable codebase hints): → Shape B. Do not guess.

## Routes and destinations

| Route           | Destination skill                                                                                                                                            | Critical follow-up to mention                                                                                                                                                            |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `flags`         | `onboarding` (slash command `/onboarding` or via `npx skills add launchdarkly/ai-tooling --skill onboarding`)                                                | None — `onboarding` handles MCP, SDK install, and the first flag.                                                                                                                        |
| `ai-configs`    | `aiconfig-create`                                                                                                                                            | After creation, run `aiconfig-targeting`. Fresh AI Configs default to a disabled fallthrough variation and the SDK returns `enabled=False` until targeting is configured. **Always say this when routing to ai-configs.** |
| `experiments`   | Multi-skill: start with `launchdarkly-flag-create` (or `aiconfig-create` for AI experiments), then `launchdarkly-metric-choose`, then `launchdarkly-metric-create` / `launchdarkly-metric-instrument` | Tell the user this is a composed path with no single experiments-onboarding skill yet. Link https://launchdarkly.com/docs/home/experimentation.                                       |
| `observability` | No skill exists yet — docs-led path                                                                                                                          | Be honest: no agent-driven onboarding skill. Offer to walk through https://launchdarkly.com/docs/home/observability together. Identify the user's stack so you link the right SDK page. |

## References (read on demand, do NOT inline)

- [references/surfaces.md](references/surfaces.md) — what each LaunchDarkly product is, with detailed "pick this when" / "don't pick this when" lists.
- [references/decision-signals.md](references/decision-signals.md) — full signal-to-surface mapping for stated phrases, dependencies, code patterns.
- [references/dispatch.md](references/dispatch.md) — exact phrasing for each handoff and edge cases.
