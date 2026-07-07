# Control-Path Safety

The whole value of shipping a change behind a flag is that turning the flag **off** yields exactly the behavior that existed before the PR. If the off-path is even slightly different, the flag is not a real kill switch. This is the invariant to protect above all others when wiring code.

## The invariant

> With the flag serving its off/default value, the code executes **only** the pre-existing behavior — no new function calls, no new endpoints, no changed defaults, no new side effects.

The in-code default value passed to the evaluation call must itself be the safe/existing behavior, so that if the SDK cannot reach LaunchDarkly the code *also* falls back to today's behavior.

## Fork at the decision site, keep the old path intact

Wrap so the new behavior is the *added* branch and the existing behavior is untouched:

```ts
// GOOD — old path preserved verbatim; new behavior is purely additive
const useNewFlow = ldClient.variation('enable-new-checkout', false);
if (useNewFlow) {
  return renderNewCheckout();   // new code, only reached when flag is on
}
return renderCheckout();        // unchanged existing code
```

```ts
// BAD — the "off" path now runs new code, so the flag is not a kill switch
const useNewFlow = ldClient.variation('enable-new-checkout', false);
return renderCheckout({ variant: useNewFlow ? 'new' : 'legacy' });
// renderCheckout was modified to branch internally; flag-off no longer means "old behavior"
```

Prefer gating at the call site / render site over threading a boolean deep into a shared function that both paths now call — the latter makes it very easy to accidentally change the off-path.

## Backend example

```go
// GOOD
if flags.BoolVariation(ctx, "enable-fast-count", false) {
    return fastCount(ctx)   // new path
}
return legacyCount(ctx)      // unchanged
```

Keep the legacy function callable and unmodified. If you must refactor shared code the old path also uses, verify field-for-field that the old path's inputs and outputs are unchanged.

## Defaults and failure modes

- **Default = existing behavior.** `variation(key, <default>)` — the default is served on SDK errors, initialization races, and missing flags. Make it the value that reproduces today's behavior.
- **Don't rely on the flag existing at evaluation time.** With a safe default, a not-yet-propagated or deleted flag degrades to the existing behavior instead of breaking.

## Cross-surface consistency

If the change spans frontend + backend (or multiple services), gate every side behind the **same flag key** with the same semantics. A flag that's on for the API but off for the UI (or vice versa) produces states neither the old nor new behavior anticipated.

## How to verify

- Read the final diff and trace the flag-off path: confirm it calls only pre-existing code.
- Where practical, exercise both variations (see the testing guidance in the triage `test_brief`): flag-off should match the pre-PR behavior; flag-on should exhibit the new behavior.
- Confirm the default argument in every evaluation call is the safe/existing value.
