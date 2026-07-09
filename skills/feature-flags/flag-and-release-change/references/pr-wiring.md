# PR wiring: reading the change and guarding it in code

The skill edits the PR's own branch: it clones the repo, reads exactly what the PR changes,
wraps the new behavior behind the flag, and pushes back to the branch so the flag wiring
lands in the same PR.

## Clone and read the change

Credentials are injected by the environment — never ask for, print, or store tokens.

```bash
git clone https://github.com/<owner>/<repo>.git && cd <repo>
git fetch origin pull/<pr_number>/head
git diff origin/HEAD...<head_sha>      # three-dot: change relative to the PR's base
```

Use the **three-dot** form (`base...head`). It shows only what this PR introduces, not
unrelated commits that landed on the base since the branch forked. Read the changed source
files (not just the diff) to understand the new path and pick the right seam to guard.

Stay in this same clone for both phases. In the implement phase you commit and push here.

## Find the codebase's flag pattern first

Match what already exists rather than inventing a style:

- **SDK / wrapper** — does code call the SDK directly (`variation()`, `boolVariation()`, `useFlags()`), or through a project wrapper/service? Use whatever's there.
- **Key constants** — are flag keys string literals at the call site, or centralized in a constants file/enum? Add the new key where the others live.
- **Context construction** — how is the user/context object built and passed to evaluation? Reuse it.
- **Default values** — what fallback do existing evaluations pass?

## Guard the new path

Wrap the new or rewritten behavior so it only runs when the flag is on. **The in-code default
must be the safe, pre-change behavior** — if LaunchDarkly is unreachable, users get the old
path, not the new one.

```ts
// Server-side Node example — match the codebase's actual pattern.
const useNewCheckout = await client.boolVariation('new-checkout-flow', context, false);
//                                                                     default ↑ = old behavior
if (useNewCheckout) {
  return newCheckoutFlow(order);   // the PR's new path
}
return legacyCheckoutFlow(order);  // preserved existing path
```

Principles that hold across languages:

- **Both branches complete.** The flag-off path must fully preserve today's behavior; the flag-on path is the PR's change.
- **Guard at a clean seam.** Prefer one branch point around the new path over scattering flag checks through the change.
- **Don't delete the old path.** The kill-switch needs something to fall back to.
- **Keep it minimal.** You're adding a gate, not refactoring the PR.

## Commit and push

```bash
git add -A
git commit -m "Gate <change> behind LaunchDarkly flag new-checkout-flow"
git push origin HEAD:<pr_branch>
```

Push to the PR's existing branch so the wiring appears in the same PR. Don't open a new PR,
force-push, or touch the base branch.

## After wiring

Register the auto-release (`create-automated-rollout-config`) so the merge triggers the
rollout — see [auto-release.md](auto-release.md). Then verify the code compiles/lints and
`get-flag` shows the flag created and OFF before reporting.
