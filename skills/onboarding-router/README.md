# LaunchDarkly Onboarding Router Skill

A thin dispatcher that picks the right LaunchDarkly onboarding path for a new user — **Feature Flags**, **AI Configs**, **Experiments**, or **Observability** — before any product-specific setup runs. Use it as the first step when the user asks to onboard, get started, or set up LaunchDarkly without specifying which product they want.

## Why this exists

LaunchDarkly is four products under one roof. The right "first 30 minutes" looks different depending on which one a user is here for:

- An engineer wrapping a checkout button in a flag wants the SDK install + first-flag flow.
- An AI team taking a hardcoded prompt out of source wants AI Configs.
- A growth team wants flags + metrics + an experiment to measure the impact.
- A frontend team debugging production wants session replay + error tracking.

This skill reads the user's request and the codebase, picks one of those four paths, and hands off to the destination skill (or doc set) that owns it.

## What it does

- Reads the user's stated intent for explicit phrases ("feature flag", "AI config", "A/B test", "session replay").
- Scans the codebase for product-stack signals (LLM SDKs, OTel packages, frontend frameworks, existing LaunchDarkly integration).
- Picks one of four routes and hands off to the right downstream skill / docs.
- Asks **one** structured question only when no signal exists.

It does **not** install SDKs, create flags, configure AI Configs, or wire up observability itself. Once it picks a route, the destination skill takes over.

## Routes

| Route | Destination | Status |
| --- | --- | --- |
| `flags` | [`onboarding`](../onboarding/SKILL.md) | Live (full path) |
| `ai-configs` | [`aiconfig-create`](../ai-configs/aiconfig-create/SKILL.md) | Live (full path) |
| `experiments` | Composed: `launchdarkly-flag-create` → `launchdarkly-metric-choose` → `launchdarkly-metric-create` | Partial (multi-skill path) |
| `observability` | LaunchDarkly Observability docs + observability SDK install | Stub (docs-led for now) |

## Installation

This skill is part of the `launchdarkly/ai-tooling` plugin and ships alongside the existing `onboarding` skill.

- **Claude Code / Cursor:** install the LaunchDarkly plugin and call `/onboarding-router` (or just say "onboard me to LaunchDarkly" — the description triggers the router automatically).
- **Other agents:** copy `skills/onboarding-router/` into your agent's skills path, or `npx skills add launchdarkly/ai-tooling --skill onboarding-router -y --agent <agent-id>`.

## Usage

```
Help me get started with LaunchDarkly
```

```
Set me up with LaunchDarkly — I have a Next.js app with a chatbot
```

```
I want to ship a feature gradually with LaunchDarkly
```

```
We use OpenAI and want to manage prompts in LaunchDarkly
```

In each case the router picks the matching surface and hands off. If the request is generic and the codebase has no signals (e.g. an empty repo), the router asks one structured question with the four routes as options.

## Structure

```
onboarding-router/
├── SKILL.md                    # main router workflow
├── README.md                   # this file
├── marketplace.json            # plugin metadata
└── references/
    ├── surfaces.md             # what each LaunchDarkly product is
    ├── decision-signals.md     # signals → surface mapping
    └── dispatch.md             # surface → next skill / docs
```

## Related

- [Onboarding (Feature Flags path)](../onboarding/) — the destination for the `flags` route
- [AI Config Create](../ai-configs/aiconfig-create/) — the destination for the `ai-configs` route
- [LaunchDarkly Experimentation docs](https://launchdarkly.com/docs/home/experimentation)
- [LaunchDarkly Observability docs](https://launchdarkly.com/docs/home/observability)

## License

Apache-2.0
<!-- eval-score:start -->
**Eval score:** 98/100 (7/7 passing, passing) - last run 2026-04-29
<!-- eval-score:end -->
