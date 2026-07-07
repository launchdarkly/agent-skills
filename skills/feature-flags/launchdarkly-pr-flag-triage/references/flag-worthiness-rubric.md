# Flag-Worthiness Rubric

Use this to decide whether a change should ship behind a feature flag. It is a **case-by-case** assessment — not a "flag everything" stance and not a "flag nothing" stance. Combine the bucket below with the [ancestor-flag analysis](ancestor-flag-analysis.md): an existing parent flag in a suitable rollout state can flip an otherwise-flag-worthy change to no-flag.

When a change is **not** flag-worthy, that is not a judgment that it's safe. The downstream testing and review steps still run — route quality concerns there via the test and review briefs instead of wrapping the change in a flag it doesn't need.

## Always flag-worthy

- New components, modals, panels, tabs, or routes that introduce visible product surface area
- New or changed user workflows: a new step, a reordered flow, a removed confirmation, a changed multi-screen interaction
- New or changed API parameters, endpoints, request/response fields, or contract shape
- Pagination, filtering, or sorting changes (preserve old behavior for existing consumers via the flag)
- Default changes that observably affect what a user gets without opting in (default sort, default page size, a behavior previously off now on)
- Business-logic changes with observable effects (numbers or results a user sees differ)
- Backend service behavior changes (cache strategy, retry policy, feature limits) with user-observable consequences
- Bug fixes at `risk_level` medium or high, especially in cross-cutting code paths

## Not flag-worthy (skip the flag; route to tests/review instead)

- Pure style-only diffs (spacing, color, visual polish) that don't change what is rendered or how it functions → nudge testing toward render-snapshot / accessibility checks
- Copy edits under one sentence that don't change meaning (typos, grammar, label tweaks). If the meaning shifts, treat as flag-worthy.
- Comment-only, docstring-only, or documentation-file changes
- Dependency version bumps with no runtime behavior change
- Test-only changes (production code untouched)
- Pure refactors (rename, extract, move) with no external contract or behavior change
- Auto-generated file updates
- CI config, build tooling, or linter-rule changes
- **Already adequately protected by an ancestor flag** in an appropriate rollout state (see [Ancestor Flag Analysis](ancestor-flag-analysis.md)). Document the ancestor flag key and state so the decision is auditable.

## Borderline cases

When you're not sure, prefer the option that gives the team the most leverage.

| Borderline change | Resolve toward |
|-------------------|----------------|
| Multi-line copy change that shifts meaning (error message reword, CTA change, instruction reorder) | flag |
| Style change large enough that a screenshot would look meaningfully different (new layout, new affordance, removed element) | flag |
| Style change that's pure polish (spacing, color, hover state on an existing control) | no flag → tests/review |
| Bug fix at low risk | no flag → tests/review with regression coverage |
| Change inside an actively-rolling-out parent flag where the new behavior is incrementally risky | flag (the parent is no longer pure protection once it's letting users in) |
| Anything else genuinely borderline | no flag → use the test/review briefs to point at the right files |

## How to record the decision

Whatever you decide, the brief must carry a `flag_worthy_justification` that names:

1. the **rubric bucket** that applies,
2. the **ancestor-flag context** (key + state, "none", or "held/redundant"), and
3. **why** that combination resolves to the chosen answer.

A bare "not flag-worthy" with no reasoning is a failure. So is flagging without saying which bucket triggered it.

## Note on "held" rewrites (optional convention)

Some teams run large in-flight rewrites behind a single long-lived flag and deliberately treat *any* change inside that gated tree as not-flag-worthy while the rewrite is open — the rewrite flag is the one kill switch, and nesting more flags inside it just creates cleanup churn. If your org maintains such a list, treat a match as not-flag-worthy regardless of the rewrite flag's current rollout percentage, and name the held flag in the justification. If a change inside a held tree is risky enough to deserve its own dial, don't silently nest one — flag it in `risks` and let a human decide.
