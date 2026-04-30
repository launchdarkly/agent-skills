# LaunchDarkly product surfaces

Reference for the four onboarding routes. Used by the parent [SKILL.md](../SKILL.md) when explaining the route choice to the user, and by Branch D's structured question.

Each entry has the same shape:

- **What it is** — one-sentence pitch.
- **Pick this when** — the conditions under which this is the right starting surface.
- **Don't pick this when** — common false positives.
- **Pairs well with** — adjacent surfaces the user is likely to add later.

---

## Feature Flags (`flags`)

**What it is.** Wrap code behind a runtime toggle so you can ship features dark, roll out by percentage, target specific users / contexts, kill broken paths instantly, and keep environment-specific behavior out of `if (env === 'prod')` blocks.

**Pick this when**

- The user wants to ship a feature gradually, run a kill switch, or gate code behind a toggle.
- Codebase has no LaunchDarkly integration yet and no obvious AI / observability tilt.
- Codebase has frontend (`react`, `next`, `vue`) plus a backend, mobile clients, edge workers, or pretty much any general-purpose runtime.
- The user is generally onboarding to LaunchDarkly with no other strong signal — flags are the foundation.

**Don't pick this when**

- The user explicitly says they want to start with AI Configs / Experiments / Observability.
- The codebase is dominated by LLM / AI calls and the user wants to start there.
- The user already has flags wired up and is asking what to do next — that's a different conversation (route to the relevant follow-on skill instead).

**Pairs well with**

- `experiments` — flags are the substrate experiments run on.
- `observability` — flag changes are events worth observing.

---

## AI Configs (`ai-configs`)

**What it is.** Manage LLM prompts, models, parameters, tools, and judges from LaunchDarkly so the application code calls a single `evaluate(...)` and gets back the live config — swap providers, A/B prompts, or roll out a new model without redeploying.

**Pick this when**

- The user mentions LLMs / prompts / models / GPT / Claude / Bedrock / Gemini / agents / function calling / RAG.
- Codebase has `openai`, `anthropic`, `@anthropic-ai/sdk`, `langchain`, `llama-index`, `@vercel/ai`, `mistralai`, `cohere`, or any LLM SDK as a dependency, especially with `chat.completions.create`, `messages.create`, or `generate_content` call sites.
- The user wants to take a hardcoded prompt out of source and into LaunchDarkly so non-engineers can edit it.
- The user wants to A/B test prompts or models without code changes.

**Don't pick this when**

- The user only mentions "AI" in passing (e.g. "we use AI for ranking" but no actual LLM call sites and no prompt-management need).
- The user wants to start with feature flags and add AI Configs later — respect that.

**Pairs well with**

- `experiments` — LaunchDarkly's experimentation product runs on top of AI Configs the same way it runs on top of flags.
- `flags` — gating the AI feature itself behind a flag is common.

---

## Experiments (`experiments`)

**What it is.** Run controlled A/B and multivariate experiments — a flag splits traffic between variations, metrics measure the outcome, statistics tell you which variation won. Also covers guarded rollouts (release that auto-rolls back on a metric regression) and release policies (project-level metric defaults).

**Pick this when**

- The user mentions A/B testing, multivariate testing, conversion uplift, statistical significance, or measuring the effect of a change.
- The user mentions guarded rollouts, release policies, or auto-rollback on a metric.
- Codebase has analytics events flowing already (`mixpanel`, `amplitude`, `segment`, `gtag`, `posthog`, custom event endpoints) — they have telemetry to lean on.

**Don't pick this when**

- They don't yet have flags or AI Configs to experiment on. Experiments are not a foundation; they sit on top of flags or AI Configs. Route to `flags` first if there's nothing to experiment on yet.
- They want simple percentage rollouts without measurement — that's `flags`, not `experiments`.

**Pairs well with**

- `flags` (prerequisite — experiments need a flag to vary on, or an AI Config).
- `ai-configs` (when experimenting on prompts / models).

**Skill status.** No single "experiments-onboarding" skill exists yet. Compose:

1. `launchdarkly-flag-create` (or `aiconfig-create`) to make the thing being tested.
2. `launchdarkly-metric-choose` to pick the right primary + guardrail metrics.
3. `launchdarkly-metric-create` + `launchdarkly-metric-instrument` to wire up tracking.
4. Point the user at experimentation docs to actually start the experiment in the dashboard.

---

## Observability (`observability`)

**What it is.** LaunchDarkly's observability product — session replay, error tracking, structured logs, distributed traces, RUM. Built on the [LaunchDarkly observability platform](https://launchdarkly.com/docs/home/observability) (a fork of highlight.io).

**Pick this when**

- The user mentions session replay, error tracking, frontend errors, RUM, OTel, logs, or traces in a "we want to start collecting this" framing.
- Codebase has `@opentelemetry/*` packages or shows tracer / span / metric instrumentation but no observability backend wired up.
- The user wants to debug production issues end-to-end (replay + error + trace correlated by session).

**Don't pick this when**

- They already have a different observability vendor (Datadog, Sentry, etc.) and are not asking to migrate. This skill set is for adding LD observability, not replacing arbitrary tooling.
- They asked for "logging" in the application-debug sense (e.g. "should I use winston or pino"). That's not what LD Observability is for.

**Pairs well with**

- `flags` — flag changes show up as deployment markers and can be correlated with replays / traces.
- `experiments` — metrics from observability events can be used as experiment metrics.

**Skill status.** No observability-onboarding skill exists in this repo yet. Hand off to:

- LaunchDarkly Observability docs: https://launchdarkly.com/docs/home/observability
- The observability SDK install for the user's stack (web, mobile, server).
- The observability MCP server when it ships.

If the user wants a guided agent-driven setup, tell them honestly that this path is doc-led for now and offer to walk through the docs with them step-by-step rather than pretend the skill exists.
