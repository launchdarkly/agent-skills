# Feature Preview Component Structure

This document describes the structure of feature previews in the gonfalon codebase.

## Core File

Feature previews are defined in:
```
packages/feature-previews/src/internal/availableFeaturePreviews.tsx
```

## Feature Preview Object Structure

Each feature preview is an object with the following properties:

```typescript
{
  id: string;           // Unique identifier (kebab-case)
  name: string;         // Display name shown to users
  description: string;  // Brief description of the feature
  imageUrl: {
    default: string;    // Light mode image URL or import
    dark: string;       // Dark mode image URL or import
  };
  status: 'Alpha' | 'Beta' | 'Stable';  // Maturity level
  enabled?: boolean;    // Optional: controlled by dogfood flag
  feedbackUrl: string;  // URL for user feedback
}
```

## Example: Full Feature Preview

```typescript
import { enablePredictiveTargetingFeaturePreview } from '@gonfalon/dogfood-flags';
import predictiveTargetingPreviewWebp from '@gonfalon/img/predictive-targeting/predictive-targeting-preview.webp';
import predictiveTargetingPreviewDarkWebp from '@gonfalon/img/predictive-targeting/predictive-targeting-preview-dark.webp';

export const availableFeaturePreviews = [
  {
    id: 'predictive-targeting',
    name: 'Test run',
    description: 'Preview the potential impact of a feature flag change',
    imageUrl: {
      default: predictiveTargetingPreviewWebp,
      dark: predictiveTargetingPreviewDarkWebp,
    },
    status: 'Beta',
    enabled: enablePredictiveTargetingFeaturePreview(),
    feedbackUrl: 'https://docs.google.com/forms/d/1CmhXMxioIb86OQXYpbPfBbQ7Mg0Pw_20cAZgJkEhri8/edit',
  },
  // IMPORTANT: The following comment is used by our code generation tools do not remove or modify this line
] as const;
```

## Type Exports

The file also exports utility types and functions:

```typescript
// Type representing valid feature preview IDs
export type FeaturePreview = (typeof availableFeaturePreviews)[number]['id'];

// Type guard to check if a value is a valid feature preview ID
export function isFeaturePreview(v: unknown): v is FeaturePreview;

// Assertion function for feature preview validation
export function assertFeaturePreview(v: unknown): asserts v is FeaturePreview;

// Helper to get a validated feature preview or fallback
export const getValidatedFeaturePreview = (key: string | null) => FeaturePreview | null;
```

## Image Handling

Images can be specified in two ways:

### 1. String Paths (Generated Default)
```typescript
imageUrl: {
  default: 'img/feature-previews/my-feature.webp',
  dark: 'img/feature-previews/my-feature-dark.webp',
},
```

### 2. Imported Modules (Recommended)
```typescript
import myFeatureWebp from '@gonfalon/img/my-feature/preview.webp';
import myFeatureDarkWebp from '@gonfalon/img/my-feature/preview-dark.webp';

// ...
imageUrl: {
  default: myFeatureWebp,
  dark: myFeatureDarkWebp,
},
```

Using imported modules is recommended because:
- Better type safety
- Webpack/Rspack can optimize and hash the images
- Build-time validation that images exist

## Dogfood Flag Integration

To gate a feature preview with a dogfood flag:

1. Create the flag in LaunchDarkly
2. Add it to `packages/dogfood-flags/src/dogfood-flags.ts`:
   ```typescript
   export const enableMyFeaturePreview = createFlagFunction('enable-my-feature-preview', false);
   ```
3. Import and use in the feature preview:
   ```typescript
   import { enableMyFeaturePreview } from '@gonfalon/dogfood-flags';
   
   // In the feature preview object:
   enabled: enableMyFeaturePreview(),
   ```

When `enabled` is `false` or the flag evaluates to `false`, the feature preview won't be shown to users.
