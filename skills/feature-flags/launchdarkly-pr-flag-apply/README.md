# LaunchDarkly PR Flag Apply Skill

An Agent Skill that acts on a flag-triage decision: it creates the LaunchDarkly feature flag and wires a pull request's code behind it, autonomously and safely. The second half of an automated flagging pipeline.

## Overview

This skill teaches agents how to:
- Consume a triage brief and stop cleanly when it says no flag is needed
- Create (or idempotently reuse) the feature flag via `create-flag` / `get-flag`
- Wire the changed code behind the flag, matching the codebase's existing SDK pattern
- Preserve the flag-off control path exactly (the core safety invariant)
- Validate before committing, and run unattended in CI without leaving the branch worse off

Pair it with [launchdarkly-pr-flag-triage](../launchdarkly-pr-flag-triage/), which produces the brief this skill consumes.

## Installation (Local)

For now, install by placing this skill directory where your agent client loads skills.

- **Generic**: copy `skills/feature-flags/launchdarkly-pr-flag-apply/` into your client's skills path

## Prerequisites

Requires the remotely hosted LaunchDarkly MCP server (`create-flag`, `get-flag`; `list-flags` optional) and write access to the PR branch.

## Usage

```
Act on this triage brief: create the flag and wire the PR's code behind it
```

## Structure

```
launchdarkly-pr-flag-apply/
├── SKILL.md
├── marketplace.json
├── README.md
└── references/
    ├── control-path-safety.md
    └── autonomous-operation.md
```

## Evaluation

<!-- eval-score:start -->
_Eval score not yet recorded._
<!-- eval-score:end -->

Run the eval suite from `evals/`:

```bash
npm run eval:pr-flag-apply          # full suite
npm run eval:pr-flag-apply:single   # first case only (quick smoke)
```

## Related

- [LaunchDarkly PR Flag Triage](../launchdarkly-pr-flag-triage/): Produce the flag/no-flag decision this skill acts on
- [LaunchDarkly Flag Create](../launchdarkly-flag-create/): Flag kinds and SDK evaluation patterns this skill builds on
- [LaunchDarkly Flag Targeting](../launchdarkly-flag-targeting/) / [Guarded Rollout](../launchdarkly-guarded-rollout/): Turn the flag on after wiring
- [LaunchDarkly MCP Server](https://github.com/launchdarkly/mcp-server)

## License

Apache-2.0
