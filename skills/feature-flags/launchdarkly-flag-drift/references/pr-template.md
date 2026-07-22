# PR Template for Flag Default Drift

Use this template when opening a pull request that reconciles an in-code SDK fallback default with the LaunchDarkly default rule (fallthrough). The change is intentionally narrow: only the default argument moves. The flag and its evaluation stay.

```markdown
## Sync in-code default: `{flag-key}`

### Summary
- **Flag**: `{flag-key}`
- **Source environment**: `{environment}`
- **Old in-code default**: `{old value}`
- **New in-code default**: `{new value}` (matches current default rule / fallthrough)
- **Scope**: Only the SDK fallback default changed. The flag and its evaluation are preserved.

### Why
The flag's default rule (fallthrough) in `{environment}` serves `{new value}`, but the
hardcoded fallback in code returned `{old value}` when LaunchDarkly is unreachable.
This drift meant an outage would serve a different value than normal operation. This PR
reconciles the fallback so the outage value matches the default rule.

### Changes
- Files modified: `{list files}`
- Occurrences updated: `{count}`
- Requires code generation: `{yes/no}` {if yes, note the command run, e.g. `make generate`}

### Not changed
- Flag evaluation and branching logic
- Off-path behavior (`offVariation`)
- The flag itself (not removed, not archived)

### Reviewer checklist
- [ ] New default matches the fallthrough value from `get-flag` for `{environment}`
- [ ] Only the default argument changed (no logic/branching edits)
- [ ] Default type matches the flag's variation type
- [ ] Generated files (if any) were regenerated, not hand-edited
- [ ] Format, lint, type-check, build, and tests pass
```

## Example

```markdown
## Sync in-code default: `new-checkout-flow`

### Summary
- **Flag**: `new-checkout-flow`
- **Source environment**: `production`
- **Old in-code default**: `false`
- **New in-code default**: `true` (matches current default rule / fallthrough)
- **Scope**: Only the SDK fallback default changed. The flag and its evaluation are preserved.

### Why
The default rule in `production` now serves `true`, but the code fallback returned `false`
during outages. This PR reconciles the fallback to `true` so behavior is consistent when
LaunchDarkly is unreachable.

### Changes
- Files modified: `CheckoutService.ts`
- Occurrences updated: 1
- Requires code generation: no

### Not changed
- The `if (enabled) { renderNew() } else { renderOld() }` branching
- `offVariation` behavior
- The flag itself

### Reviewer checklist
- [x] New default matches the fallthrough value from `get-flag` for `production`
- [x] Only the default argument changed (no logic/branching edits)
- [x] Default type matches the flag's variation type
- [x] No generated files involved
- [x] Format, lint, type-check, build, and tests pass
```
