---
name: flag-release
description: "Record an automated rollout for an existing LaunchDarkly flag that guards a pull request's change, so the change releases safely when the PR merges. Honors a stated release intent (release now / hold / notBefore / segment / prerequisite) and defers per-environment to the project's release policies. Use as the release step once the guarding flag exists and its code is wired. Keywords: record release, automated rollout, release policy, guarded rollout, staged rollout, simple vs policy, release intent, hold release, dark launch."
license: Apache-2.0
compatibility: Requires the remotely hosted LaunchDarkly MCP server. Operates on a flag that already exists; does not create flags or edit code.
metadata:
  author: launchdarkly
  version: "0.1.0"
---

# Record a Flag's Automated Release

You're using a skill that takes an **existing** feature flag (created OFF) that guards a pull request's change, and records an **automated rollout** so the change releases safely once the PR merges — no human toggling a flag. It defers per-environment to the team's release policies and honors any human-stated release intent.

This is the **release step** of the PR flag workflow, and it's deliberately atomic:

| Step | Owned by |
|------|----------|
| Decide *whether* to flag | [`should-flag-change`](../should-flag-change/SKILL.md) (advisory) |
| Create the flag + wire the code | [`launchdarkly-flag-create`](../launchdarkly-flag-create/SKILL.md) |
| **Record the release** | **this skill** |

By the time this skill runs, the flag exists (OFF) and the guarding code is wired and pushed. This skill only records the rollout — it never creates flags or edits code. It can be driven directly by an automation harness, or as the final step of the [`flag-and-release-change`](../flag-and-release-change/SKILL.md) orchestrator.

**The deploy is not the release.** The merge ships the control path (flag OFF); the *release* is the flag operation this rollout performs afterward, governed by the environment's policy.

> **Honoring a hold is the one thing you must get right — and there is a specific wrong belief to unlearn first.** You may assume a `policy` / guarded rollout *waits for manual approval* and therefore "holds" an environment. **That is false, and it is the mistake that ships a hold early.** A guarded rollout **starts automatically the instant the PR merges** — it begins ramping traffic to real users with **no approval step and no human action**. So recording a held environment as `policy` does the **opposite** of holding it: it releases it on merge, before any sign-off or `notBefore` date — an unintended production release. There is no "hold" release type. The **only** way to hold an environment is to **omit it from the `environments` array entirely** (the flag stays OFF there). Never reach for `policy` to express a hold.

## Prerequisites

- The remotely hosted LaunchDarkly MCP server.
- The guarding flag already exists in LaunchDarkly, created OFF, with the agreed key/tags.
- A pull-request reference (`repoFullName` + `prNumber`, or `prUrl`) so the rollout binds to the right merge.

**MCP tools this skill uses:**
- `create-automated-rollout-config` — record the rollout for the flag against the PR *(the deliverable)*
- `match-release-policies` — resolve which release policy governs each environment (call before proposing the plan)
- `list-release-policies` — see the project's release policies and the metrics they auto-attach
- `get-flag` — confirm the flag exists and is OFF before recording

Full release model — `simple` vs `policy`, precedence, previewing, prerequisites, metric adequacy: [references/auto-release.md](references/auto-release.md).

## Plan Phase

**Record nothing in this phase.**

1. **Confirm the flag.** `get-flag` to verify the guarding flag exists and is OFF. If it doesn't exist yet, stop — creation is [`launchdarkly-flag-create`](../launchdarkly-flag-create/SKILL.md)'s job, and recording a rollout for a missing flag fails confusingly.
2. **Pick the target environments.** Use the environments named by the user or harness. Don't hardcode a set — a given change can't always release to every environment. If none are named, enumerate the project's real keys and confirm the set rather than assuming.
3. **Preview EVERY target environment's policy — mandatory, before you decide anything.** For **each** target environment (including any you might hold), call `match-release-policies` (by `flagKey` + `environmentKey`). This is not skippable and not "obvious": you cannot decide whether an environment releases on merge or must be held until you have seen what releasing it would actually do. Read the response's `winningReleaseMethod` **and its release timing** — e.g. a guarded rollout `releaseTiming: automatic-on-merge`, meaning it starts on its own the moment the PR merges, with no approval step. Never infer policy scope or timing by hand; take it from the response. **Do not call `create-automated-rollout-config` until you have previewed every target environment.** For a **guarded** winner, check the auto-attached metrics can actually compare this change (see the metric-adequacy note in [references/auto-release.md](references/auto-release.md)).
4. **Capture the human's release intent.** Ask (briefly, only if not already stated): release **on merge**, **hold** (recorded but not released yet), or wait until a **`notBefore`** date? A **cohort/segment** to target first? A **prerequisite** parent flag this must not precede? Intent sits above the policy in precedence and is **honored or explicitly held — never silently dropped**.
5. **Present the per-environment plan and stop.** For each environment, state either the `releaseType` it will be recorded with (`simple` / `policy`, and what that does on merge) **or** that it will be **held** — omitted from the recorded config so the flag stays OFF there — with the reason. Wait for confirmation; revise on feedback.

## Implement Phase

Only after confirmation:

1. **Decide each environment by the user's intent, not by its policy — then record.** Map intent to action with this rule. Do **not** reason about what an environment's policy would do in order to decide whether to hold it — that decision belongs to the user's intent alone:

   | The user's intent for an environment | What you do |
   |---|---|
   | Release **on merge** | **Include** it: `{ environmentKey, releaseType }` — `simple` or `policy` per its previewed policy |
   | **Hold** / wait / "until `<date>`" / `notBefore` / pending sign-off / **unsure** | **Omit** it entirely. Never `policy`. |

   The hold is decided by intent, full stop — the environment's release policy is irrelevant to it, because **both `simple` and `policy` release on merge.** If you catch yourself thinking *"I'll record production as `policy` so it holds"* — **stop.** `policy` releases production on merge; that is the exact mistake. The hold is the **absence** of an entry, nothing more.

   Then call `create-automated-rollout-config` with `projectKey`, `flagKey`, the resulting `environments` array (only the release-on-merge environments), and the PR reference. Details: [references/auto-release.md](references/auto-release.md).

   **Worked examples** — match the request's shape to one of these and mirror its `environments` array. Notice the invariant: **every held environment is simply absent; no held env ever appears with a `releaseType`.**

   | Request | `environments` array |
   |---|---|
   | Release on staging **and** production on merge | `[{"environmentKey":"staging","releaseType":"simple"}, {"environmentKey":"production","releaseType":"policy"}]` |
   | Staging on merge, **hold production until a date** (e.g. compliance sign-off) | `[{"environmentKey":"staging","releaseType":"simple"}]` — production **omitted** |
   | Staging on merge, **don't release production yet** (pending a launch, no date) | `[{"environmentKey":"staging","releaseType":"simple"}]` — production **omitted** |
   | Release `dev` + `staging` on merge, **hold `prod` and `eu-prod`** for a coordinated launch | `[{"environmentKey":"dev","releaseType":"simple"}, {"environmentKey":"staging","releaseType":"simple"}]` — `prod` and `eu-prod` **omitted** |

   Report every held environment (and why) in your summary. Use the exact environment keys the user named — don't substitute (`staging` is not `test`).

   **Final check before the call:** no environment the user asked to hold appears anywhere in the array. When intent is unclear, omit — fail closed.

   If a **prerequisite** parent flag was agreed, wire it if the MCP surface supports it; otherwise report it as a manual step.
2. **Verify.** The call returns `created`, `config_id`, and the normalized per-environment plan — record `config_id`. Report only what you verified; flag anything you couldn't confirm rather than asserting it.
3. **Report** the per-environment release plan + `config_id`; what was **held** (and why) versus what releases on merge; and what happens on merge (e.g. "production resolves policy X → guarded rollout on merge; staging serves true immediately; production held until 2026-08-01 per intent").

## Edge Cases

| Situation | Action |
|-----------|--------|
| Flag doesn't exist yet | Stop — creation is `launchdarkly-flag-create`. Recording a rollout for a missing flag fails confusingly. |
| A rollout config already exists for this flag + PR | Don't record a second one — a duplicate confuses the scheduler. Point the user at the existing config to change the plan. |
| Registering before the PR exists | `simple` envs work without a PR, but `policy` envs need `repoFullName`/`prNumber` to trigger on merge. Prefer recording *after* the PR is open; if you record early, say `policy` won't fire until the PR is wired. |
| No release policy matches an env | `policy` falls back to defaults (often immediate). Tell the user; offer `simple`, or point at release-policy setup. |
| User wants to hold, or set a `notBefore` date | Skip the releasing plan for those environments; report them as held with the reason. Never silently release against stated intent. |
| Change depends on a parent flag not yet live | Couple them with a prerequisite (set it if the MCP surface supports it); otherwise report the coupling as a required manual step. Don't let this flag release before its parent. |
| A `policy` env resolves to guarded but has no relevant metric | Say so — a guarded rollout with no meaningful metric guards nothing. Recommend `simple`, or point at metric setup. |

## What NOT to Do

- **Don't create the flag or edit code** — that's `launchdarkly-flag-create`. This skill only records the release.
- **Don't turn the flag on yourself, or toggle it after recording the config.** The rollout owns that; double-toggling causes audit noise and confuses the scheduler.
- **Don't skip `match-release-policies`.** Proposing `policy` without knowing what it resolves to is guessing.
- **Don't silently release against a stated hold/`notBefore`.** Honor intent or hold — never drop it.
- **Don't handle or print credentials.** Access is injected by the environment.

## References

- [references/auto-release.md](references/auto-release.md): the automated-rollout / release-policy model, `simple` vs `policy`, precedence (intent → override → policy → default), previewing, prerequisites, metric adequacy. *(Core of this skill.)*
- [`launchdarkly-guarded-rollout`](../launchdarkly-guarded-rollout/SKILL.md): for a *bespoke* rollout no policy expresses — set that env to `simple` here and drive the guarded rollout by hand after merge.
