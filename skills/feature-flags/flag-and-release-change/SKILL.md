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

You're using a skill that takes a pull request whose change should ship behind a feature flag, and does the work end to end: create the guarding flag in LaunchDarkly, wire the new behavior behind it on the PR's branch, and register an **automated rollout** so the change releases safely once the PR merges.

This is the **"apply"** half of a two-step pipeline:

1. **Decide** — [`should-flag-change`](../should-flag-change/SKILL.md) reads the diff and returns an advisory verdict on *whether* the change should be flagged. (Read-only. It never creates anything.)
2. **Apply** — *this skill* acts on a "yes": it creates the flag, wires the code, and sets up the auto-release.

If nobody has run the decision step, make the call yourself using the same judgment (favor a flag for user-facing or risky changes; skip it for config-only, dependency-bump, infra, test-only, or docs changes). If a flag clearly isn't warranted, say so and stop — don't create one just because you were invoked.

You work in two phases — **plan**, then **implement** — and you check in with the user in between. **Never create or modify anything during the plan phase.**

## Prerequisites

This skill requires the remotely hosted LaunchDarkly MCP server and a `git` CLI that can read (and push to) the PR's repository.

**Required MCP tools:**
- `create-flag` — create the guarding feature flag
- `create-automated-rollout-config` — register the auto-release for the flag against the PR
- `get-flag` — verify the flag after creation

**Recommended MCP tools:**
- `match-release-policies` — preview which release policy will govern each environment (call this *before* proposing the release plan)
- `list-release-policies` — see the project's configured release policies and what metrics auto-attach
- `list-flags` — learn the project's naming and tagging conventions

**Optional MCP tools:**
- `update-flag-settings` — adjust flag name, description, or tags
- `toggle-flag` — only if you deliberately need the flag on in a lower environment

## Core Concepts

### The flag is a gate, created OFF
`create-flag` creates the flag with **targeting off in every environment**, serving its off variation. That is exactly what you want: the merged code evaluates the flag, gets the safe/old behavior, and nothing changes for users until the release turns it on. Dark launch by default.

### Auto-release = a rollout that fires on merge
`create-automated-rollout-config` records a **per-environment** rollout plan bound to this flag and PR. Each environment gets a release type:

| Release type | Behavior |
|--------------|----------|
| `simple` (default) | Serves `true` in that environment as soon as the config is created. Because the flag is brand new and not yet evaluated anywhere, this is effectively a no-op until the merged code ships — useful for lower environments you want fully on. |
| `policy` | Waits until the PR merges and the flag starts evaluating, then resolves that environment's configured **release policy** and performs the matching release — immediate, progressive, or guarded — automatically. |

Use `policy` for production and any environment where you want a governed, monitored rollout. Use `simple` for dev/staging environments you just want turned on.

See [references/auto-release.md](references/auto-release.md) for the release-policy model, precedence rules, and how to choose per environment.

## Working With the Pull Request

Work from a clone so you can read the change and push the flag wiring back to its branch. Credentials are provided by the environment — never ask for, print, or store tokens.

```bash
git clone https://github.com/<owner>/<repo>.git && cd <repo>
git fetch origin pull/<pr_number>/head
git diff origin/HEAD...<head_sha>
```

The **three-dot** diff (`base...head`) shows exactly what the PR changes relative to its base. Read the changed files you need to understand the change and its risk. Stay in this same clone through both phases — in the implement phase you edit, commit, and push here. See [references/pr-wiring.md](references/pr-wiring.md) for the full PR workflow and guarding patterns.

## Plan Phase

**Create nothing in this phase.**

1. **Understand the change.** Read the three-dot diff and the changed files. What does it do? What's the blast radius if it misbehaves — user-facing? data-writing? a new external call?
2. **Learn the conventions.** Skim existing flags (`list-flags`) for naming (`kebab-case` vs `snake_case`), tags, and temporary-vs-permanent norms. Look at how the codebase already evaluates flags (SDK, wrapper, key constants) so your wiring will match.
3. **Preview the release policy.** For each target environment, call `match-release-policies` (by `flagTags` before the flag exists, or by `flagKey` after) to see which policy would govern it and what metrics auto-attach. This tells you whether `policy` will yield a guarded/progressive/immediate release in prod.
4. **Design the minimal gate.** Usually a single boolean kill-switch around the new or rewritten code path. Don't propose more flags than the change needs. Decide the per-environment release plan (which envs are `simple`, which are `policy`).
5. **Present the plan and stop.** Summarize for the user:
   - the flag (`key`, `name`, `type` — usually boolean, default/off variation, tags) and why it gates *this* change;
   - the per-environment release plan and, for `policy` environments, what the matched release policy will do;
   - where in the code you'll add the guard.

   Then wait. Revise on feedback. Proceed only on a clear approval. If you're missing something you genuinely need (target project key, environments, a policy that doesn't exist yet), ask a focused question rather than guessing.

## Implement Phase

Only after approval:

1. **Create the flag.** Use `create-flag` with the agreed key, name, boolean kind, and tags. Set `temporary: true` unless it's meant to be long-lived. Treat an "already exists" result as success. Verify with `get-flag`.
2. **Wire the code on the PR branch.** In your clone, guard the new behavior behind the flag, matching the codebase's existing evaluation pattern. The **default/fallback value in code must be the safe, pre-change behavior**, so the feature stays off if LaunchDarkly is unreachable. Keep both branches complete. Commit and push to the PR's branch. Details and per-language patterns: [references/pr-wiring.md](references/pr-wiring.md).
3. **Register the auto-release.** Call `create-automated-rollout-config` with the `projectKey`, the `flagKey`, the per-environment `environments` array (each with its `releaseType`), and the PR reference (`repoFullName`, `prNumber`, or `prUrl`). This binds the rollout to the merge.
4. **Verify.** Confirm the flag exists and is off (`get-flag`), the code compiles/lints, both variation paths are complete, and the rollout config was created (note the returned `config_id`).
5. **Report** what you created and why:
   - flag key + LaunchDarkly link, and that it's created OFF;
   - the file(s) and code path you wired;
   - the per-environment release plan and the `config_id`;
   - what will happen on merge (e.g. "production resolves policy X → guarded rollout on merge; staging serves true immediately").

## Edge Cases

| Situation | Action |
|-----------|--------|
| Change isn't flag-worthy | Explain why (config-only, dep bump, infra, test-only, docs) and stop. Don't create a flag. |
| Flag already exists | Reuse it — treat "already exists" as success. Don't create a duplicate. Wire the existing key. |
| No release policy matches an env | `policy` would fall back to defaults (often immediate). Tell the user; offer `simple`, or point them at the release-policy setup. |
| Guarding needs more than a boolean | Prefer a boolean kill-switch anyway. Only propose a multivariate flag if the change genuinely serves distinct variants; explain the tradeoff first. |
| Codebase has no LaunchDarkly SDK | The wiring can't evaluate a flag. Surface this — SDK install is a separate step ([onboarding/sdk-install](../../onboarding/sdk-install/SKILL.md)). |
| Approval required in an environment | The MCP tool returns an approval URL — relay it; don't try to bypass it. |

## What NOT to Do

- **Don't create anything in the plan phase.** Plan proposes; implement creates.
- **Don't turn the flag on for production yourself.** The automated rollout owns that. Creating the flag OFF is the point.
- **Don't wire a code default that enables the new behavior.** The fallback must be the old/safe path.
- **Don't over-flag.** One kill-switch for the change beats several speculative flags.
- **Don't handle or print credentials.** Git access is injected.
- **Don't skip `match-release-policies`.** Proposing `policy` without knowing what it resolves to is guessing.

## References

- [references/auto-release.md](references/auto-release.md): the automated-rollout / release-policy model, `simple` vs `policy`, precedence, and per-environment choices.
- [references/pr-wiring.md](references/pr-wiring.md): cloning, the three-dot diff, guarding patterns by SDK, and committing to the PR branch.
