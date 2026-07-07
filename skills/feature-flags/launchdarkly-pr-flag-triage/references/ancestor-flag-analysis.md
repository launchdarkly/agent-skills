# Ancestor Flag Analysis

Before applying the [rubric](flag-worthiness-rubric.md), determine whether the modified code is *already* gated by an existing feature flag, and if so, what protection that flag currently provides. A change inside an already-flagged region behaves very differently from a change in unflagged production code — and the right call depends on the parent flag's **current rollout state**, not just its existence.

## Procedure

For every modified file or code path:

1. **Find the nearest gating flag.** Read the surrounding code — function, component tree, route, middleware — and walk *up* render trees, route guards, middleware, and conditional branches to find the nearest flag check that controls whether this code path runs. Don't stop at the immediate function.
2. **Read its state.** If you find an ancestor flag, call `get-flag` to retrieve its current per-environment state: targeting on/off, rollout percentage, targeting rules, and whether it's marked temporary (a rollout flag) or permanent (a config/entitlement gate).
3. **Reason about the protection it currently provides** using the table below.
4. **Surface it in both artifacts.** If the change is not flag-worthy *because* of ancestor protection, say so explicitly — don't silently rely on it.

## Decision table

| Ancestor flag state | What it means | Usual call |
|---------------------|---------------|-----------|
| **Off for everyone** (targeting off / 0% / kill-switch off) | The modified code reaches no user today; the parent flag is the kill switch | Skip the nested flag — unless the change is risky enough that the parent-rollout owners need an independent dial |
| **Active partial rollout** (e.g. 5–95%, or targeted segments) | Both cohorts see this change as soon as the parent enables them | If the change adds incremental risk on top of the parent rollout, nest a flag so owners can disable just this piece without rolling back the whole parent |
| **Fully rolled out** (100% on / ramp complete) | The ancestor no longer provides protection | Treat as unflagged production code; apply the rubric normally |
| **Permanent / config-style** (entitlement check, plan gate, environment guard) | Not a rollout flag | Ignore it for this analysis; treat the change as unflagged |
| **No ancestor flag found** | Change reaches production unguarded | Apply the rubric normally |

## What to write

Record, for each modified path, an `ancestor_flag_analysis` entry containing: the flag key (or "none"), its current state, whether it's a rollout or permanent flag, and a one-sentence assessment of the protection it provides. This goes in the structured brief and (collapsed) in the PR comment.

If you cannot retrieve an ancestor flag's per-environment state from the API, say so, and state whether the decision depends on it. Often it doesn't — e.g. if a second, ungated entry point also reaches the changed code, the change is effectively unguarded regardless of the ancestor's rollout percentage.
