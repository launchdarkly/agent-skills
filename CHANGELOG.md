# Changelog

All notable changes to this repository will be documented in this file.

## Unreleased

- Add `okr-factory` skill — automates monthly/bi-weekly OKR check-ins: finds the user's Atlas goals, gathers evidence from GitHub PRs, Jira, Slack, and Atlas, drafts a scored status update (🟢/🟠/🔴), and posts it with approval via `ld atlas goal-update`.
- Refine `experiments/launchdarkly-experiment-setup` skill to match the LaunchDarkly REST API tool shapes: nested `iteration` on create, `mutableFieldsByStatus`-aware `update-experiment`, and the new `save-and-start-experiment-iteration` + `stop-experiment-iteration` tools.
- Initial public release of LaunchDarkly agent skills
