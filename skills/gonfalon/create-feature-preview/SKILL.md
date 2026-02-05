---
name: create-feature-preview
description: "Add a new feature preview to the gonfalon codebase using the plop generator. Use when creating feature previews that allow users to opt-in to experimental features in the LaunchDarkly UI."
license: Apache-2.0
compatibility: Requires access to the launchdarkly/gonfalon repository
metadata:
  author: launchdarkly
  version: "0.1.0"
---

# Create Feature Preview

A workflow for adding new feature previews to the gonfalon codebase. Feature previews allow users to opt-in to experimental features in the LaunchDarkly UI before they are generally available.

## Prerequisites

- Access to the `launchdarkly/gonfalon` repository
- Node.js and pnpm installed
- A dogfood flag created for gating the feature preview (optional but recommended)

## What is a Feature Preview?

Feature previews are opt-in experimental features that users can enable from the LaunchDarkly UI. Each feature preview has:
- A unique identifier (kebab-case)
- A display name
- A description
- Preview images (light and dark mode)
- A status (Alpha, Beta, or Stable)
- A feedback URL for collecting user feedback
- An optional dogfood flag for additional gating

## Workflow

### Step 1: Prepare Required Assets

Before running the generator, ensure you have:

1. **Preview images**: Two WebP images for the feature preview card
   - `{imageName}.webp` - Light mode image
   - `{imageName}-dark.webp` - Dark mode image
   - Place these in `packages/img/feature-previews/` or the appropriate image directory

2. **Feedback URL**: A Google Form or similar feedback collection URL
   - Default: `https://docs.google.com/forms/d/1CmhXMxioIb86OQXYpbPfBbQ7Mg0Pw_20cAZgJkEhri8/edit`

3. **Dogfood flag** (optional): If the feature preview should be gated by a feature flag
   - Create the flag in LaunchDarkly first
   - Add it to `packages/dogfood-flags/src/dogfood-flags.ts`

### Step 2: Run the Plop Generator

Execute the feature preview generator:

```bash
pnpm create:feature-preview
```

The generator will prompt for:

| Prompt | Description | Example |
|--------|-------------|---------|
| Name | Display name of the feature preview | "Test run" |
| Description | Brief description shown to users | "Preview the potential impact of a feature flag change" |
| Status | Current maturity level | Alpha, Beta, or Stable |
| Feedback URL | URL for user feedback | Google Form URL |
| Image name | Base name for preview images (without extension) | "predictive-targeting-preview" |

### Step 3: Update the Generated Code

The generator modifies `packages/feature-previews/src/internal/availableFeaturePreviews.tsx`.

After generation, you may need to:

1. **Add dogfood flag integration** (if using a flag):
   ```typescript
   import { enableMyFeaturePreview } from '@gonfalon/dogfood-flags';
   
   // In the feature preview object:
   enabled: enableMyFeaturePreview(),
   ```

2. **Update image imports** if using imported images instead of string paths:
   ```typescript
   import myFeaturePreviewWebp from '@gonfalon/img/my-feature/preview.webp';
   import myFeaturePreviewDarkWebp from '@gonfalon/img/my-feature/preview-dark.webp';
   
   // In the feature preview object:
   imageUrl: {
     default: myFeaturePreviewWebp,
     dark: myFeaturePreviewDarkWebp,
   },
   ```

### Step 4: Verify the Feature Preview

1. Run type checking:
   ```bash
   pnpm ts
   ```

2. Run linting:
   ```bash
   pnpm oxlint:js --fix
   pnpm lint:js:fix
   ```

3. Start the app and verify the feature preview appears in the UI settings

## Guidelines

- **Naming**: Use clear, descriptive names that explain what the feature does
- **Status**: Start with "Alpha" or "Beta" for new features; use "Stable" only for fully validated features
- **Images**: Provide both light and dark mode images for consistent UI experience
- **Feedback**: Always include a feedback URL to collect user input
- **Gating**: Consider using a dogfood flag to control who can see the feature preview

## Examples

### Example 1: Basic Feature Preview

**User**: "Add a feature preview for the new dashboard layout"

**Expected behavior**:
1. Run `pnpm create:feature-preview`
2. Enter name: "New Dashboard Layout"
3. Enter description: "Try the redesigned dashboard with improved navigation"
4. Select status: "Beta"
5. Enter feedback URL (or use default)
6. Enter image name: "new-dashboard-preview"
7. Verify the generated code in `availableFeaturePreviews.tsx`

### Example 2: Feature Preview with Dogfood Flag

**User**: "Add a feature preview for predictive targeting that's gated by a flag"

**Expected behavior**:
1. First, ensure the dogfood flag exists (e.g., `enablePredictiveTargetingFeaturePreview`)
2. Run `pnpm create:feature-preview`
3. Fill in the prompts
4. After generation, update the code to add:
   - Import for the dogfood flag
   - `enabled: enablePredictiveTargetingFeaturePreview()` property

## Edge Cases

- **Missing images**: The generator accepts image names but doesn't validate they exist. Ensure images are added before deployment.
- **Duplicate IDs**: The generator creates IDs from the name using kebab-case. Ensure names are unique.
- **Flag not found**: If referencing a dogfood flag, verify it exists in `@gonfalon/dogfood-flags` first.

## File Structure

After running the generator, the feature preview is added to:

```
packages/feature-previews/src/internal/availableFeaturePreviews.tsx
```

Related files:
- `packages/dogfood-flags/src/dogfood-flags.ts` - Dogfood flag definitions
- `packages/img/` - Preview images
- `.plop/templates/feature-preview.hbs` - Generator template

## References

- [Plop Generator Configuration](references/plop-config.md)
- [Feature Preview Component Structure](references/component-structure.md)
