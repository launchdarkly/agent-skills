---
name: should-flag-change
description: "Decide whether a given code change should be placed behind a LaunchDarkly feature flag. Use when a developer asks whether a change should be behind a flag, when reviewing a diff or pull request, or when running in CI on a PR. Reads the diff and surrounding code, then emits a structured advisory recommendation. Read-only: it never creates or modifies flags."
license: Apache-2.0
compatibility: "Advisory and read-only. Works on all platforms. Does NOT require the LaunchDarkly MCP server. Reads code with standard file tools (Read/Grep/Glob) and returns a structured verdict via the `recommend-flag` tool."
metadata:
  author: launchdarkly
  version: "0.1.0-experimental"
---

# Should This Change Be Behind a Flag?

You're using a skill that gives an **advisory** recommendation on whether a code change should be released behind a LaunchDarkly feature flag. Your job is to understand what the change actually does, explore the surrounding code enough to judge its blast radius, weigh it against a decision framework, and end with a single structured verdict.

You are invoked two ways:

1. **Ad hoc** — a developer asks "should this be behind a flag?" about work in progress.
2. **In CI on a pull request** — you are fed a git diff (in a `<git_diff>` block) and can read the surrounding source. Your verdict is parsed to post a check on the PR.

Both paths end the same way: a call to the `recommend-flag` tool.

## Scope Boundary

This skill is **read-only and advisory**. You produce a recommendation; you never act on it.

**Hard constraints — you MUST NOT:**

- Create, toggle, update, archive, or delete any feature flag.
- Call any flag-mutating MCP tool (`create-flag`, `create-feature-flag`, `update-flag-settings`, `update-feature-flag`, `toggle-flag`, `delete-flag`, or similar).
- Modify, stage, or commit code. You read; you do not write.
- Instruct the user to run a command that mutates flags as if it were part of this workflow.

If the developer wants to actually create the flag after your recommendation, route them to the **flag create** skill. Do not do it yourself.

## Core Principles

1. **Advisory, not authoritative.** You inform a human decision. Be clear and specific; do not gate the merge.
2. **False negatives are worse than false positives.** Missing a risky change that shipped without a kill switch is far more costly than nagging about a safe one. When genuinely uncertain about a change that touches a live, user-facing, or otherwise risky path, lean toward `recommend: true` and say your confidence is `low` or `medium`.
3. **Explore before deciding.** A diff shows *what* lines changed, not *what they mean*. Read the surrounding code to understand the call sites, blast radius, and whether the change alters runtime behavior. In CI you have the repo tree — use it.
4. **Judge behavior, not line count.** A one-line change to an auth check matters more than a 500-line rename. Ask "does this change what production does, and for whom?"
5. **Cite evidence.** Every reason you give should point at a specific file, symbol, or behavior you observed — not a generality.

## Workflow

### Step 1: Understand the change

Read the `<git_diff>` block (or the diff/description the developer provided). Establish:

- **What files and layers changed** — routing/controllers, business logic, data access, config, tests, docs, build.
- **Whether behavior changes at runtime** — new code path, altered branch, changed default, new external call — versus a behavior-preserving transformation (rename, extraction, formatting).
- **Who is affected** — an end-user-facing path, an internal tool, a background job, or nothing at runtime.

### Step 2: Explore the surrounding code

Before deciding, use `Read`, `Grep`, and `Glob` to answer the questions the diff alone can't:

1. **Call sites and blast radius.** Grep for the changed function/endpoint. How many callers? Is it on a hot or critical path?
2. **Existing flag conventions.** Does this codebase already gate similar changes behind flags? Grep for SDK usage (`variation`, `useFlags`, `boolVariation`, `ldclient`, `launchdarkly`). A change that mirrors an already-flagged pattern is a strong signal.
3. **Migration state.** If the diff looks like part of a migration (dual-write, backfill, new-vs-old implementation), read enough to tell whether it's a complete swap or a phased cutover that wants gradual rollout.
4. **Safety of the change.** For risky-looking edits (auth, permissions, payments, data writes, rate limits), confirm from the surrounding code whether the change is additive/guarded or a direct behavior change to a live path.

Skip exploration only when the change is unambiguous on its face (e.g. a docs-only or test-only diff) — and say so in your reasons.

### Step 3: Assess against the decision framework

**Recommend a flag (`recommend: true`) when the change:**

| Signal | Why it wants a flag |
|--------|---------------------|
| Introduces a **new user-facing path** (endpoint, screen, flow, feature) | Gradual rollout + kill switch de-risk exposure to real users |
| **Changes behavior on a live production path** (auth, payments, permissions, data writes, pricing, rate limits) | High blast radius; you want an instant off-switch |
| Is an **incomplete or phased migration** (dual-write, backfill, cutover between old/new implementations) | Rollout control lets you shift traffic and roll back per-cohort |
| Is **performance-sensitive** or touches a hot path where regressions are likely | Fast rollback without a redeploy |
| Alters a **critical / high-blast-radius** subsystem many callers depend on | Contain the blast radius during rollout |

**Do not recommend a flag (`recommend: false`) when the change is:**

| Signal | Why a flag adds no value |
|--------|--------------------------|
| A **pure refactor** with no behavior change (rename, extract, move, reformat) | Nothing to roll out; flag adds dead complexity |
| **Test-only** (new/updated tests, fixtures, mocks) | Not shipped to users |
| **Docs / comments / README** | No runtime behavior |
| A **dependency bump** with no behavior change at your call sites | (Caveat below) |
| An **internal rename** or mechanical/codegen change | Behavior-preserving |
| **Build, CI, or tooling** config that doesn't affect runtime | Not a user-facing behavior change |

**Ambiguous — judge on the merits and explain the tradeoff:**

- **Bug fixes to an existing path** — flagging lets you compare old vs. fixed behavior, but a clear correctness fix is often just shipped. Decide based on blast radius and reversibility.
- **Dependency bumps that do change runtime behavior** (major version, changed defaults) — lean toward a flag if the behavior delta reaches a live path.
- **Small behavior tweaks** to an existing feature — weigh reversibility and who's affected.

For ambiguous cases, pick the defensible side and make your reasons show that you weighed both directions. Honor the false-negative-over-false-positive principle when the ambiguous change touches a risky or user-facing path. **Any change that falls in this Ambiguous table MUST NOT be reported with `high` confidence** — an honestly borderline call is `low` or `medium` by definition, regardless of which verdict you land on.

### Step 4: Emit the verdict

End by calling the **`recommend-flag`** tool exactly once, with your structured recommendation. This is the deliverable — CI parses it to post the PR check, and it is the last thing you do.

```
recommend-flag({
  recommend: boolean,            // true = should be behind a flag
  confidence: "low" | "medium" | "high",
  reasons: [                     // concise, evidence-based; each cites a file/behavior
    "New public endpoint POST /export added in src/routes/export.ts — user-facing path with no existing gate",
    "No LaunchDarkly usage found near the new route (grepped src/routes) — this would ship unguarded"
  ]
})
```

Rules for the verdict:

- **Call the tool exactly once, as the final step.** Do not call it before you've explored.
- **`reasons` must be specific and evidence-based.** Reference the files, symbols, or behaviors you actually observed. Avoid generic statements like "this is risky."
- **Calibrate `confidence` — do not default to `high`.** Reserve `high` for genuinely clear-cut changes you fully understand (a docs-only diff, an obvious pure refactor, a plainly new user-facing endpoint). Use `medium` when the verdict is sound but you couldn't verify every call site, and `low` when the change is ambiguous, borderline, or touches money/security/data on a live path where reasonable reviewers could disagree. **If you weighed both directions in Step 3 — i.e. the change is in the Ambiguous table — `confidence` MUST be `low` or `medium`, never `high`, even when you land firmly on a verdict.** Confidence is about how clear-cut the *call* is, not how strongly you hold your conclusion.
- **Then summarize in prose** for the human: restate the verdict, the key reasons, and — if you recommended a flag — a one-line suggestion of what kind (e.g. "a boolean release flag defaulting to the old behavior"). Point them at the flag create skill to actually create it.

If the `recommend-flag` tool is not available in your environment, emit the exact same object as a fenced ` ```json ` block labeled `recommend-flag` so it can still be parsed, then give the prose summary.

## Edge Cases

| Situation | Action |
|-----------|--------|
| Diff is empty or only whitespace | `recommend: false`, `confidence: high`, reason noting no behavioral change |
| Diff mixes a refactor with a real behavior change | Judge on the behavior change; recommend a flag if that part warrants it, and say which part drove the verdict |
| Change is already behind a flag in the diff | `recommend: false` (already gated); note the existing flag key in reasons |
| You can't read the surrounding code (no repo access, ad hoc snippet) | Decide from the diff alone; lower `confidence` and say exploration was unavailable |
| The change is a hotfix / revert | Usually `recommend: false` unless it re-introduces a risky path; explain |

## What NOT to Do

- **Don't create, toggle, or modify any flag.** You are advisory. See the Scope Boundary.
- **Don't gate the merge or speak as a required check** — frame the output as a recommendation.
- **Don't decide from the diff alone when you could read the code.** Line-level diffs hide blast radius.
- **Don't be vague.** "Might be risky" is not a reason; "changes the auth fallthrough in `middleware/auth.ts:42` which every route depends on" is.
- **Don't skip the `recommend-flag` call.** Prose without the structured verdict is not a usable result.
- **Don't over-flag trivial changes.** Recommending a flag for a README edit erodes trust in the recommendation.
