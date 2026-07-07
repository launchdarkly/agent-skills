---
name: launchdarkly-pr-flag-triage
description: "Analyze a pull request and decide whether the change should ship behind a LaunchDarkly feature flag. Use when building an automated pipeline that classifies incoming PRs, assesses release risk, and produces a flag/no-flag recommendation. Explores the diff and codebase, classifies the change, applies a flag-worthiness rubric, checks for existing ancestor flags, and emits a structured brief plus a human-readable PR comment. Pairs with launchdarkly-pr-flag-apply, which acts on the brief."
license: Apache-2.0
compatibility: Requires the remotely hosted LaunchDarkly MCP server and read access to the pull request diff
metadata:
  author: launchdarkly
  version: "0.1.0-experimental"
---

# LaunchDarkly PR Flag Triage

You're using a skill that decides whether a pull request should be released behind a feature flag. Your job is to explore the change, classify it, weigh it against a flag-worthiness rubric, account for any flag that already gates the code, and emit two artifacts: a **structured brief** that a downstream agent (or human) can act on, and a **concise PR comment** for reviewers.

This is the first half of an automated flagging pipeline. It only *decides and recommends* — it does not create flags or edit code. The [launchdarkly-pr-flag-apply](../launchdarkly-pr-flag-apply/SKILL.md) skill consumes the brief this skill produces and does the wiring.

You are **read-only** in this role. Do not create flags, edit source, or push commits.

## Prerequisites

- Read access to the pull request: the diff, the changed files, and enough of the surrounding codebase to trace callers. Typically `git`, a GitHub/GitLab CLI, or the platform API.
- The remotely hosted LaunchDarkly MCP server, for ancestor-flag analysis.

**Required MCP tools:**
- `list-flags` — browse existing flags to learn naming/tag conventions and locate candidate ancestor flags
- `get-flag` — read a specific flag's configuration and per-environment state (used to judge whether an existing flag already protects the change)

## Core Principles

1. **Case-by-case, not flag-everything.** Every unnecessary flag adds review overhead, registry churn, and cleanup debt. Every missed flag ships a behavior change with no kill switch. Use the rubric; don't default to either extreme.
2. **"Not flag-worthy" is not "safe."** A no-flag decision is a routing decision, not a quality verdict. Send quality concerns to tests and review instead.
3. **Verify against real code.** Read the actual diff and callers. Never infer behavior from a filename — a `.tsx` file that only changed a class name is not a behavior change.
4. **An existing flag can make a new one redundant.** If the code already runs inside a parent flag in an appropriate rollout state, a nested flag usually adds churn without leverage. Read the parent flag's state before deciding.
5. **Every decision is auditable.** Whatever you decide, record *why* — the rubric bucket, the ancestor-flag context, and the reasoning — so a reader six months later can reconstruct it.

## Workflow

### Step 1: Explore the change

Understand what the PR actually does before judging it.

1. Get the diff (e.g. `git diff <base>...<head>`) and list the changed files.
2. For each meaningful file: read the changed functions/components, find their callers, and identify what code paths flow through them. Prioritize production code over tests, config, and generated files.
3. Look for existing feature-flag usage near the changed code — both the SDK evaluation pattern and any parent flag that already gates this path.
4. Assess blast radius: how many files change directly vs. are transitively affected.

Capture what you find as internal notes — you'll fold it into the artifacts in Step 4. See [Classification Schema](references/classification-schema.md) for the fields to populate.

### Step 2: Analyze ancestor flags

Before applying the rubric, determine whether the modified code is *already* gated by a feature flag, and if so, what that flag currently provides. A change inside an already-flagged region behaves very differently from a change in unflagged production code.

Walk up render trees, route guards, middleware, and conditional branches — not just the immediate function — to find the nearest flag check controlling whether this code runs. If you find one, use `get-flag` to read its current state and reason about the protection it provides. See [Ancestor Flag Analysis](references/ancestor-flag-analysis.md) for the decision table.

### Step 3: Classify and apply the rubric

Classify the change (`pr_type`, `risk_level`, `change_scope`, `primary_domain`, `change_patterns`, `has_user_facing_behavior_change`) per the [Classification Schema](references/classification-schema.md).

Then decide flag-worthiness using the [Flag-Worthiness Rubric](references/flag-worthiness-rubric.md), combining the rubric bucket with the ancestor-flag context from Step 2.

**Quick orientation** (the rubric reference is authoritative):

| Signal | Leans |
|--------|-------|
| New user-facing surface, workflow, or API contract change | flag |
| Behavior/business-logic change with observable effects | flag |
| Bug fix at medium/high risk in a cross-cutting path | flag |
| Pure style/copy tweak, docs, tests, deps, refactor with no contract change | no flag |
| Already protected by an ancestor flag in a suitable rollout state | no flag (document it) |

### Step 4: Emit the two artifacts

Produce both. They state the same facts, formatted for two readers.

**Artifact 1 — PR comment (human-facing).** Post to the PR. Keep the visible portion short and verdict-first; move reasoning into collapsible sections if your platform supports them.
- Verdict line: flag / no-flag, suggested key (if flagging), `risk_level`, `pr_type`.
- A short decision table: type, risk, ancestor flag, why-or-why-not.
- The full flag-worthiness justification and ancestor-flag analysis (collapsed is fine, but present).
- When **not** flagging: point reviewers/tests at the specific `file:line` ranges that deserve attention, so the change isn't left unattended.

**Artifact 2 — structured brief (machine-facing).** This is the handoff to [launchdarkly-pr-flag-apply](../launchdarkly-pr-flag-apply/SKILL.md). Emit the labeled schema in [Classification Schema](references/classification-schema.md) — classification, `flag_worthy` + justification, `flag_key_suggestion`, `files_to_modify` (only when flagging), `existing_patterns_found`, `risks`, and briefs to route testing and review. Never leave a required field blank — write `none` / `N/A` so the next step can tell you checked.

## Edge Cases

| Situation | Action |
|-----------|--------|
| Can't retrieve an ancestor flag's per-env state from the API | Note it in the brief; decide on the flag's existence + type, and say the decision doesn't depend on the missing detail (or why it does) |
| Change spans frontend + backend | One flag should gate both sides consistently — call this out in `risks` and `files_to_modify` |
| Frontend file changed but only styling | Apply the rubric to the actual diff, not the extension; usually no flag, route to visual/a11y checks |
| Borderline and genuinely unsure | Prefer the option that gives the team the most leverage; if still unsure, no flag + direct testing/review at the right files |

## What NOT to Do

- Don't create flags, edit source, or push commits — this skill is read-only. That's [launchdarkly-pr-flag-apply](../launchdarkly-pr-flag-apply/SKILL.md).
- Don't emit a bare "not flag-worthy" with no reasoning — the justification is mandatory either way.
- Don't rely on a filename or extension to judge behavior — read the diff.
- Don't silently lean on an ancestor flag — if it's the reason you're not flagging, say so explicitly.

## References

- [Flag-Worthiness Rubric](references/flag-worthiness-rubric.md): Always / never / borderline buckets and how ancestor context shifts the call
- [Classification Schema](references/classification-schema.md): The classification fields and the structured brief schema handed to the apply step
- [Ancestor Flag Analysis](references/ancestor-flag-analysis.md): How to find the nearest gating flag and judge whether it already protects the change
