# LaunchDarkly PR Flag Triage Skill

An Agent Skill that analyzes a pull request and decides whether the change should ship behind a LaunchDarkly feature flag. The first half of an automated flagging pipeline.

## Overview

This skill teaches agents how to:
- Explore a PR diff and its surrounding codebase to understand what actually changed
- Classify the change (type, risk, scope, change patterns)
- Apply a flag-worthiness rubric to decide flag / no-flag
- Analyze ancestor flags (is the code already gated?) via `get-flag` / `list-flags`
- Emit a structured brief (for the apply step) plus a concise, reviewer-facing PR comment

It is **read-only**: it never creates or mutates flags. Pair it with [launchdarkly-pr-flag-apply](../launchdarkly-pr-flag-apply/), which acts on the brief.

## Installation (Local)

For now, install by placing this skill directory where your agent client loads skills.

- **Generic**: copy `skills/feature-flags/launchdarkly-pr-flag-triage/` into your client's skills path

## Prerequisites

Requires the remotely hosted LaunchDarkly MCP server (`list-flags`, `get-flag` for ancestor-flag analysis) and read access to the PR diff.

## Usage

```
Triage this PR and decide whether it should ship behind a feature flag
```

## Structure

```
launchdarkly-pr-flag-triage/
├── SKILL.md
├── marketplace.json
├── README.md
└── references/
    ├── flag-worthiness-rubric.md
    ├── classification-schema.md
    └── ancestor-flag-analysis.md
```

## Evaluation

<!-- eval-score:start -->
_Eval score not yet recorded._
<!-- eval-score:end -->

Run the eval suite from `evals/`:

```bash
npm run eval:pr-flag-triage          # full suite
npm run eval:pr-flag-triage:single   # first case only (quick smoke)
```

## Related

- [LaunchDarkly PR Flag Apply](../launchdarkly-pr-flag-apply/): Act on the triage decision — create the flag and wire the code
- [LaunchDarkly Flag Create](../launchdarkly-flag-create/): Flag kinds and SDK evaluation patterns
- [LaunchDarkly MCP Server](https://github.com/launchdarkly/mcp-server)
- [LaunchDarkly Docs](https://docs.launchdarkly.com)

## License

Apache-2.0
