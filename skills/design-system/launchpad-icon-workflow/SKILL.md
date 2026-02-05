---
name: launchpad-icon-workflow
description: "Add new icons from Tabler Icons to LaunchDarkly's @launchpad-ui/icons package and propagate them to gonfalon. Use when a user needs to add a new icon to the LaunchDarkly design system, bump icon package versions, or understand the icon contribution process."
license: Apache-2.0
compatibility: Requires git, gh CLI, and GitHub access. Figma steps require human intervention for design review.
metadata:
  author: launchdarkly
  version: "1.0.0-alpha"
---

# LaunchPad UI Icon Addition Workflow

A workflow for adding new icons from Tabler Icons to LaunchDarkly's `@launchpad-ui/icons` package and propagating them across the gonfalon monorepo.

## Prerequisites

- Access to LaunchDarkly's Figma workspace (for design steps)
- Write access to `launchdarkly/launchpad-ui` repository
- Write access to `launchdarkly/gonfalon` repository
- GitHub CLI (`gh`) authenticated

## Overview

The icon addition workflow has two phases:

1. **Figma Phase** (requires human intervention for design review)
2. **Code Phase** (can be largely automated)

## Icon Addition Workflow

### Step 1: Find the Icon in Tabler

1. Navigate to https://tabler.io/icons
2. Search for the desired icon by name or category
3. Note the exact icon name (e.g., `clock-counterclockwise`)
4. Verify the icon matches the intended use case

### Step 2: Add Icon to Figma Library (HUMAN REQUIRED)

This step requires human intervention and cannot be automated.

**Process:**
1. Open the LaunchDarkly Icons Figma library
2. Create a new branch in Figma
3. Add the icon following these guidelines:
   - Use 20x20 frame size
   - Ensure stroke width matches existing icons (typically 2px)
   - Center the icon within the frame
   - Use `currentColor` for stroke/fill
4. Name the icon following conventions:
   - Use lowercase with hyphens
   - Be descriptive (e.g., `arrows-diagonal-expand-tl-br` not `arrows-diagonal-expand-1`)
5. Request design review from the Design team
6. Merge the Figma branch after approval

**Note:** Design review may require manual edits to fix sizing inconsistencies, correct alignment issues, improve naming clarity, or fix componentization issues.

### Step 3: Sync Icons to launchpad-ui

Once the Figma branch is merged, trigger the sync workflow:

```bash
# Trigger the sync icons workflow
gh workflow run sync-icons.yml --repo launchdarkly/launchpad-ui

# Wait for the workflow to complete and check for PR
gh run list --repo launchdarkly/launchpad-ui --workflow=sync-icons.yml --limit 1
gh pr list --repo launchdarkly/launchpad-ui --head "sync-icons" --state open
```

Review and merge the generated PR.

### Step 4: Release New launchpad-ui Version

After the sync PR is merged:

```bash
cd launchpad-ui

# Create changeset for the icons package
pnpm changeset

# Commit and create release PR
git checkout -b release/icons-update
git add .
git commit -m "chore: add changeset for new icons"
git push origin release/icons-update
gh pr create --title "chore: release new icons" --body "Adds new icons from Figma sync"
```

### Step 5: Bump launchpad-ui in Gonfalon

Once the new launchpad-ui version is published:

```bash
cd gonfalon

# Create a new branch
git checkout -b devin/$(date +%s)-bump-launchpad-icons

# Find all packages that depend on @launchpad-ui/icons
grep -r "@launchpad-ui/icons" --include="package.json" packages/ static/

# Update the version in each package.json (typically 15+ packages)
# Then regenerate lockfile
pnpm install

# Commit and create PR
git add .
git commit -m "chore: bump @launchpad-ui/icons to vX.Y.Z"
git push origin HEAD
gh pr create --title "chore: bump @launchpad-ui/icons" --body "Updates icons package to include new icons"
```

### Step 6: Use the New Icon

Once the gonfalon PR is merged:

```tsx
import { IconButton } from '@launchpad-ui/components';

<IconButton icon="new-icon-name" aria-label="Description" />
```

## Guidelines

- Always verify the icon exists in Tabler before starting the workflow
- Follow existing naming conventions in the icon library
- Keep PR descriptions clear about which icons were added
- Test icon rendering in gonfalon after version bump

## Edge Cases

| Situation | Action |
|-----------|--------|
| Icon needs design modifications | Work with Design team during Figma review |
| Sync workflow fails | Check Figma API credentials and library access |
| Version conflicts in gonfalon | Run `pnpm install` to regenerate lockfile |
| Icon not appearing after bump | Verify the icon was included in the launchpad-ui release |

## Automation Opportunities

**Fully automatable:**
- Finding icons in Tabler
- Triggering the sync workflow
- Bumping versions in gonfalon
- Creating PRs

**Requires human intervention:**
- Figma work and design review
- Release approval (may have automation in place)

## References

- [Tabler Icons](https://tabler.io/icons) - Source icon library
- [LaunchPad UI Repository](https://github.com/launchdarkly/launchpad-ui)
- [Gonfalon Repository](https://github.com/launchdarkly/gonfalon)
