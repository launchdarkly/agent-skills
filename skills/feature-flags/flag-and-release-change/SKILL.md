---
name: flag-and-release-change
description: "Gate a pull request's change behind a LaunchDarkly feature flag and set up its automated release. Use once a change has been judged flag-worthy (e.g. by should-flag-change) to create the flag, wire the new code path behind it on the PR branch, and register an automated rollout so the change releases safely when the PR merges. Keywords: flag a PR, wrap change in a flag, dark launch, kill switch, auto-release, automated rollout, release policy, staged rollout."
license: Apache-2.0
compatibility: Requires the remotely hosted LaunchDarkly MCP server and a git CLI with access to the PR's repository
metadata:
  author: launchdarkly
  version: "0.1.0"
---

# Flag & Release a PR Change

You're using a skill that takes a pull request whose change should ship behind a feature flag, and drives it end to end: create the guarding flag, wire the new behavior behind it on the PR's branch, and register an **automated rollout** so the change releases safely once the PR merges.

This skill is a **PR-scoped orchestrator**. It composes two existing skills and adds the release step — its own job is the PR workflow (read the diff, work in a clone, push to the branch), the plan→implement sequencing, and the auto-release:

| Step | Owned by | This skill's role |
|------|----------|-------------------|
| Decide *whether* to flag | [`should-flag-change`](../should-flag-change/SKILL.md) (advisory, read-only) | Act on a "yes"; make the call yourself if it wasn't run |
| Create the flag + wire the code | [`launchdarkly-flag-create`](../launchdarkly-flag-create/SKILL.md) | Invoke it against the change; don't re-teach flag creation or SDK patterns |
| Register the auto-release | **this skill** ([references/auto-release.md](references/auto-release.md)) | The new capability |

Don't duplicate the flag-create mechanics here — defer to that skill for how flags are created (OFF by default, `temporary`, naming) and how the new path is guarded per SDK. This skill adds the PR/CI wrapper and the release.

You work in two phases — **plan**, then **implement** — and you check in with the user in between. **Never create or modify anything during the plan phase.**

## Prerequisites

- The remotely hosted LaunchDarkly MCP server.
- A `git` CLI that can read and push to the PR's repository.
- The [`launchdarkly-flag-create`](../launchdarkly-flag-create/SKILL.md) skill available (this skill delegates flag creation and code wiring to it).

**MCP tools this skill relies on directly:**
- `create-automated-rollout-config` — register the auto-release for the flag against the PR *(unique to this skill)*
- `match-release-policies` — preview which release policy governs each environment (call before proposing the release plan)
- `list-release-policies` — see the project's release policies and the metrics they auto-attach

`create-flag` / `get-flag` / `list-flags` are used too, but via the flag-create flow — see that skill.

## What's unique here (vs. flag-create)

`launchdarkly-flag-create` creates a flag and wires it into a codebase you're editing directly. This skill differs in three ways, and that's all it adds:

1. **It's driven by a PR.** You read the change as a three-dot diff and push the flag wiring back to the PR's branch, rather than editing a working copy in place.
2. **It plans first.** A plan phase proposes the flag + release with no side effects; you implement only after approval.
3. **It sets up the release.** After the flag exists and the code is wired, it registers an automated rollout so the merge triggers the right release automatically — see [references/auto-release.md](references/auto-release.md).

Everything else — created-OFF semantics, `temporary` defaults, naming conventions, safe in-code defaults, per-SDK guarding patterns — is flag-create's job. Use it.

## Working With the Pull Request

Work from a clone so you can read the change and push the flag wiring back to its branch. Credentials are provided by the environment — never ask for, print, or store tokens.

```bash
git clone https://github.com/<owner>/<repo>.git && cd <repo>
git fetch origin pull/<pr_number>/head
git diff origin/HEAD...<head_sha>       # three-dot: change relative to the PR's base
```

The three-dot diff (`base...head`) shows exactly what the PR introduces. Read the changed files you need to understand the change and its risk. Stay in this clone through both phases — in implement you edit, commit, and push here. Full PR mechanics (clone, three-dot diff, commit/push to the branch): [references/pr-wiring.md](references/pr-wiring.md).

## Plan Phase

**Create nothing in this phase.**

1. **Confirm it should be flagged.** If [`should-flag-change`](../should-flag-change/SKILL.md) already ran, act on its verdict. Otherwise apply the same judgment: favor a flag for user-facing or risky changes; skip config-only, dependency-bump, infra, test-only, or docs changes. If a flag clearly isn't warranted, say so and stop.
2. **Understand the change and conventions.** Read the three-dot diff and changed files — what does it do, what's the blast radius? Then follow **flag-create's Step 1** to learn how this codebase already uses flags (SDK, wrapper, key constants, naming). Don't reinvent that exploration here.
3. **Preview the release policy.** For each target environment, call `match-release-policies` (by `flagTags` before the flag exists, or `flagKey` after) to see which policy would govern it and what metrics auto-attach. This tells you what a `policy` release will actually do on merge.
4. **Design the minimal gate + release plan.** Usually a single boolean kill-switch around the new path (flag-create's [flag-types](../launchdarkly-flag-create/references/flag-types.md) covers the choice). Decide the per-environment release plan — which envs are `simple`, which are `policy`. Don't propose more flags than the change needs.
5. **Present the plan and stop.** Summarize: the flag (`key`, `name`, boolean, tags) and why it gates *this* change; the per-environment release plan and what each `policy` env's matched policy will do; where in the code the guard goes. Then wait. Revise on feedback; proceed only on clear approval. Ask a focused question if you're genuinely missing something (project key, environments, a missing policy) rather than guessing.

## Implement Phase

Only after approval:

1. **Create the flag and wire the code** using [`launchdarkly-flag-create`](../launchdarkly-flag-create/SKILL.md) (its Steps 3–4). That skill creates the flag OFF with the agreed key/tags and adds the guarding evaluation with a safe default matching the codebase's pattern. Treat an "already exists" flag result as success.
2. **Commit and push to the PR branch.** This is the PR-specific part flag-create doesn't cover: commit the wiring and push to the PR's existing branch so it lands in the same PR — don't open a new PR or touch the base branch. See [references/pr-wiring.md](references/pr-wiring.md).
3. **Register the auto-release.** Call `create-automated-rollout-config` with `projectKey`, `flagKey`, the per-environment `environments` array (each with its `releaseType`), and the PR reference (`repoFullName` + `prNumber`, or `prUrl`). This binds the rollout to the merge. Details: [references/auto-release.md](references/auto-release.md).
4. **Verify.** `get-flag` shows the flag created and OFF; the code compiles/lints; both variation paths are complete; the rollout config was created (record the returned `config_id`).
5. **Report** what you created and why: flag key + LaunchDarkly link (created OFF); the file(s)/code path wired; the per-environment release plan + `config_id`; and what happens on merge (e.g. "production resolves policy X → guarded rollout on merge; staging serves true immediately").

## Edge Cases

| Situation | Action |
|-----------|--------|
| Change isn't flag-worthy | Explain why (config-only, dep bump, infra, test-only, docs) and stop. Don't create a flag. |
| Flag already exists | Reuse it — "already exists" is success. Wire the existing key; don't duplicate. |
| No release policy matches an env | `policy` falls back to defaults (often immediate). Tell the user; offer `simple`, or point at release-policy setup. |
| Guarding needs more than a boolean | Prefer a boolean kill-switch. Only go multivariate if the change serves distinct variants; see flag-create's [flag-types](../launchdarkly-flag-create/references/flag-types.md). |
| Codebase has no LaunchDarkly SDK | Wiring can't evaluate a flag — SDK install is separate ([onboarding/sdk-install](../../onboarding/sdk-install/SKILL.md)). |
| Approval required in an environment | The MCP tool returns an approval URL — relay it; don't bypass it. |

## What NOT to Do

- **Don't create anything in the plan phase.** Plan proposes; implement creates.
- **Don't re-document flag creation or SDK guarding here** — that's [`launchdarkly-flag-create`](../launchdarkly-flag-create/SKILL.md). Link to it.
- **Don't turn the flag on for production yourself.** The automated rollout owns that; creating the flag OFF is the point.
- **Don't over-flag.** One kill-switch beats several speculative flags.
- **Don't handle or print credentials.** Git access is injected.
- **Don't skip `match-release-policies`.** Proposing `policy` without knowing what it resolves to is guessing.

## References

- [references/auto-release.md](references/auto-release.md): the automated-rollout / release-policy model, `simple` vs `policy`, precedence, per-environment choices. *(Core of this skill.)*
- [references/pr-wiring.md](references/pr-wiring.md): PR mechanics — clone, three-dot diff, committing to the PR branch.
- [`launchdarkly-flag-create`](../launchdarkly-flag-create/SKILL.md): flag creation + per-SDK guarding patterns this skill delegates to.
