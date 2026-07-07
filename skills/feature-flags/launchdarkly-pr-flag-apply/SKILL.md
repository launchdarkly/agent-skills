---
name: launchdarkly-pr-flag-apply
description: "Act on a flag-triage decision: create the LaunchDarkly feature flag and wire the pull request's code behind it, autonomously and safely. Use as the second half of an automated flagging pipeline, after launchdarkly-pr-flag-triage recommends a flag. Creates the flag, wraps the changed behavior so the flag-off path preserves existing behavior exactly, validates, and commits. Designed to run unattended in CI."
license: Apache-2.0
compatibility: Requires the remotely hosted LaunchDarkly MCP server and write access to the pull request branch
metadata:
  author: launchdarkly
  version: "0.1.0-experimental"
---

# LaunchDarkly PR Flag Apply

You're using a skill that takes a flag-worthiness decision and executes it: create the feature flag, wire the pull request's changed code behind it, verify, and commit — with the control (flag-off) path preserving existing behavior exactly. This is the second half of an automated flagging pipeline. Its input is the structured brief produced by [launchdarkly-pr-flag-triage](../launchdarkly-pr-flag-triage/SKILL.md).

This skill **writes code and creates a flag**. It is designed to run unattended, so its guardrails are strict: never push a branch in a worse state than you found it.

## Prerequisites

- The structured brief from [launchdarkly-pr-flag-triage](../launchdarkly-pr-flag-triage/SKILL.md) (or an equivalent decision with `flag_worthy`, a suggested key, files to modify, and the existing SDK pattern).
- Write access to the PR branch (clone/checkout, commit, push).
- The remotely hosted LaunchDarkly MCP server.

**Required MCP tools:**
- `create-flag` — create the feature flag
- `get-flag` — verify creation and reuse a flag that already exists

**Optional MCP tools:**
- `list-flags` — check for an existing flag before creating (idempotency)
- `update-flag-settings` — add tags/description to a flag you reused

For the mechanics of choosing a flag kind and writing evaluation code that fits the codebase, this skill defers to [launchdarkly-flag-create](../launchdarkly-flag-create/SKILL.md). This skill adds what an *automated PR* step needs on top: consuming the brief, the control-path safety invariant, and the unattended-operation guardrails.

## Core Principles

1. **The control path is sacred.** With the flag off, behavior must be byte-for-byte the existing behavior. Do not call new functions, hit new endpoints, or change defaults on the off-path. This is the single most important property — a broken control path defeats the entire point of flagging.
2. **The default value is the safety net.** The in-code default (fallback when the SDK can't reach LaunchDarkly) must be the existing/safe behavior. Flags are created with targeting off, so the flag serves off to everyone until someone turns it on.
3. **Leave the branch more mergeable, never less.** Validate before you commit. If lint, formatting, type-checking, build, or tests fail on what you touched and you can't fix it, do not commit or push. See [Autonomous Operation](references/autonomous-operation.md).
4. **Match the codebase, don't invent a pattern.** Use the SDK evaluation pattern the triage brief found (`existing_patterns_found`) — the wrapper, constants file, or direct call the team already uses.
5. **Be idempotent.** The pipeline may re-run on the same PR. Reuse an existing flag instead of failing on a duplicate; don't double-wrap code already behind the flag.

## Workflow

### Step 1: Parse the brief

From the triage brief, read: `flag_worthy`, `flag_key_suggestion`, `intent_summary`, `files_to_modify` (files, functions, line ranges, wrap notes), `existing_patterns_found`, and `risks`.

**If `flag_worthy` is false, stop.** There is nothing to wire. Emit a short note explaining that triage decided no flag and pass through the test/review briefs to the next step. Do not create a flag "just in case."

### Step 2: Create (or reuse) the flag

1. If you have `list-flags`, check whether the suggested key already exists (a prior run, or a human beat you to it).
2. Create with `create-flag`: `boolean` kind, `temporary: true` unless the brief says otherwise, a `{verb}-{descriptive-name}` key (`enable-`, `allow-`, `show-`, `disable-`), and tags that let the team find pipeline-created flags later (e.g. an `auto-generated` tag plus your pipeline's own tag).
3. On a conflict/duplicate, use `get-flag` to fetch the existing flag and reuse it — do not fail. Optionally reconcile tags with `update-flag-settings`.

The flag is created with **targeting off in every environment**; it serves the off variation to everyone until turned on. See [launchdarkly-flag-create](../launchdarkly-flag-create/SKILL.md) for flag-kind and configuration detail.

### Step 3: Wire the code behind the flag

For each entry in `files_to_modify`, wrap the new behavior behind an evaluation of the flag, matching `existing_patterns_found`:

- **Reuse the codebase's SDK pattern** — its wrapper/service if it has one, its constants file if flag keys are centralized, otherwise a direct `variation`-style call. See [SDK Evaluation Patterns](../launchdarkly-flag-create/references/sdk-evaluation-patterns.md).
- **Evaluate at the consumer/decision site**, not deep inside shared library code, so the branch is legible and the off-path is easy to verify.
- **Preserve the control path exactly.** Structure the conditional so flag-off runs only the pre-existing code. Read [Control-Path Safety](references/control-path-safety.md) before you write the branch — it's the most common way these changes go wrong.
- **Use a safe default** in the evaluation call (the existing behavior), so an SDK outage fails closed to today's behavior.
- If the change spans multiple languages/surfaces (per `risks`), gate all of them behind the **same** flag key, consistently.

### Step 4: Validate

Run the project's checks for what you changed — formatting, lint, type-check, build, and the relevant tests. Fix anything you broke. **Hard stop:** if a check still fails and the failure is from your wiring, narrow or revert your change rather than push broken code. See [Autonomous Operation](references/autonomous-operation.md) for the full gate.

### Step 5: Commit and hand off

1. Commit the flag wiring with a clear, scoped message (e.g. `feat: wire <change> behind <flag-key>`), and push to the PR branch.
2. Report a structured result the next step can consume: `flag_key`, `flag_created` (true/false), `files_modified`, `evaluation_pattern`, `control_path_preserved` (confirmed), and pass through the triage `test_brief` / `review_brief`.
3. **Turning the flag on is a separate, deliberate act.** This skill never enables targeting. Point the operator at [launchdarkly-flag-targeting](../launchdarkly-flag-targeting/SKILL.md) to toggle it on, or [launchdarkly-guarded-rollout](../launchdarkly-guarded-rollout/SKILL.md) to ramp it progressively with metric monitoring.

## Edge Cases

| Situation | Action |
|-----------|--------|
| Brief says `flag_worthy: false` | Stop; emit a no-op note and pass through the briefs. Never create a flag anyway. |
| Suggested flag key already exists | Reuse it via `get-flag`; reconcile tags; don't fail. |
| Code is already wrapped in this flag (re-run) | Leave it; don't double-wrap. Idempotency over eagerness. |
| Backend + frontend both change | One flag key, gate both sides consistently; note it in the result. |
| Only file to wrap turns out to be pure style/generated | There's nothing meaningful to gate — report it and skip rather than force a flag around a stylesheet. |
| Validation fails and you can't fix it | Do not commit/push. Report the failure and the minimal-scope option. |

## What NOT to Do

- **Don't call new code on the off-path.** The control path must be unchanged.
- **Don't turn the flag on.** Creation and targeting are separate; enabling is a human/rollout decision.
- **Don't push code that fails formatting, lint, type-check, build, or tests.** Leaving the branch less mergeable than you found it is the primary failure mode to avoid.
- **Don't invent a new flag pattern** when the codebase already has one.
- **Don't create a flag when triage said no**, and don't guess a flag kind the brief didn't ask for.

## References

- [Control-Path Safety](references/control-path-safety.md): How to wrap code so flag-off is exactly the existing behavior, with language examples
- [Autonomous Operation](references/autonomous-operation.md): The validation gate, idempotency, and commit discipline for running unattended in CI
- [launchdarkly-flag-create](../launchdarkly-flag-create/SKILL.md): Flag kinds, configuration, and SDK evaluation patterns this skill builds on
- [launchdarkly-flag-targeting](../launchdarkly-flag-targeting/SKILL.md) / [launchdarkly-guarded-rollout](../launchdarkly-guarded-rollout/SKILL.md): Turning the flag on after it's wired
