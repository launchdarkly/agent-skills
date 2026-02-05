---
name: launchpad-icon-workflow
description: "Add new icons from Tabler Icons to LaunchDarkly's @launchpad-ui/icons package and propagate them to gonfalon. Use when a user needs to add a new icon to the LaunchDarkly design system, bump icon package versions, or understand the icon contribution process."
license: Apache-2.0
compatibility: Requires git, gh CLI, Node.js, and GitHub access. Optional Figma MCP for read operations. Visual QA requires jest-image-snapshot.
metadata:
  author: launchdarkly
  version: "1.1.0-alpha"
---

# LaunchPad UI Icon Addition Workflow

A workflow for adding new icons from Tabler Icons to LaunchDarkly's `@launchpad-ui/icons` package and propagating them across the gonfalon monorepo. This workflow includes automated SVG normalization, visual QA, and naming convention validation.

## Prerequisites

- Write access to `launchdarkly/launchpad-ui` repository
- Write access to `launchdarkly/gonfalon` repository
- GitHub CLI (`gh`) authenticated
- Node.js with npm/pnpm
- Optional: Figma MCP server for design context (read-only operations)
- Optional: Access to LaunchDarkly's Figma workspace (for manual design steps)

## Overview

The icon addition workflow has three phases:

1. **Automated Preprocessing** (SVG normalization, naming validation, visual QA)
2. **Figma Phase** (may require human intervention for edge cases)
3. **Code Phase** (fully automated)

## Icon Addition Workflow

### Step 1: Find and Fetch the Icon from Tabler

1. Navigate to https://tabler.io/icons
2. Search for the desired icon by name or category
3. Note the exact icon name (e.g., `clock-counterclockwise`)
4. Fetch the SVG directly from Tabler's CDN:

```bash
# Fetch SVG from Tabler
ICON_NAME="clock-counterclockwise"
curl -o "${ICON_NAME}.svg" "https://raw.githubusercontent.com/tabler/tabler-icons/main/icons/outline/${ICON_NAME}.svg"
```

### Step 2: Automated SVG Normalization

Run the SVG through SVGO to normalize dimensions, viewBox, and attributes:

```javascript
// normalize-icon.js
const { optimize } = require('svgo');
const fs = require('fs');

const svg = fs.readFileSync(process.argv[2], 'utf8');

const result = optimize(svg, {
  plugins: [
    'preset-default',
    'removeDimensions',  // Remove fixed width/height
    {
      name: 'addAttributesToSVGElement',
      params: {
        attributes: [
          { viewBox: '0 0 24 24' },  // Normalize viewBox
          { fill: 'none' },
          { stroke: 'currentColor' },  // Enable CSS color control
          { 'stroke-width': '2' },
          { 'stroke-linecap': 'round' },
          { 'stroke-linejoin': 'round' }
        ]
      }
    }
  ]
});

fs.writeFileSync(process.argv[2].replace('.svg', '-normalized.svg'), result.data);
console.log('Normalized:', process.argv[2]);
```

```bash
node normalize-icon.js clock-counterclockwise.svg
```

### Step 3: Naming Convention Validation

Apply and validate naming conventions:

```javascript
// validate-icon-name.js
const NAMING_SCHEMA = {
  // Pattern: {category}-{object}-{action/state}-{direction/variant}
  pattern: /^[a-z]+(-[a-z0-9]+)*$/,
  
  // Directional suffixes
  directions: ['up', 'down', 'left', 'right', 'tl', 'tr', 'bl', 'br', 'cw', 'ccw'],
  
  // Required transformations from Tabler naming
  transformations: {
    'counterclockwise': 'ccw',
    'clockwise': 'cw',
    'top-left': 'tl',
    'top-right': 'tr',
    'bottom-left': 'bl',
    'bottom-right': 'br'
  }
};

function transformName(tablerName) {
  let name = tablerName.toLowerCase();
  
  // Apply transformations
  for (const [from, to] of Object.entries(NAMING_SCHEMA.transformations)) {
    name = name.replace(from, to);
  }
  
  // Validate pattern
  if (!NAMING_SCHEMA.pattern.test(name)) {
    console.warn(`Warning: Name "${name}" may not follow conventions`);
  }
  
  return name;
}

const tablerName = process.argv[2];
const launchpadName = transformName(tablerName);
console.log(`Tabler: ${tablerName} -> LaunchPad: ${launchpadName}`);
```

### Step 4: Visual QA with Snapshot Testing

Automated visual comparison to ensure icon renders correctly:

```javascript
// visual-qa.test.js
const { toMatchImageSnapshot } = require('jest-image-snapshot');
const sharp = require('sharp');
const fs = require('fs');

expect.extend({ toMatchImageSnapshot });

async function renderSvgToPng(svgPath, size = 48) {
  const svg = fs.readFileSync(svgPath);
  return sharp(svg)
    .resize(size, size)
    .png()
    .toBuffer();
}

describe('Icon Visual QA', () => {
  test('icon matches expected rendering', async () => {
    const iconPng = await renderSvgToPng('clock-ccw-normalized.svg');
    
    expect(iconPng).toMatchImageSnapshot({
      failureThreshold: 0.01,  // 1% pixel difference allowed
      failureThresholdType: 'percent',
      customSnapshotIdentifier: 'clock-ccw'
    });
  });
  
  test('icon dimensions are correct', async () => {
    const metadata = await sharp('clock-ccw-normalized.svg').metadata();
    expect(metadata.width).toBe(24);
    expect(metadata.height).toBe(24);
  });
});
```

Run visual QA:
```bash
npx jest visual-qa.test.js --updateSnapshot  # First run: create baseline
npx jest visual-qa.test.js                    # Subsequent: compare against baseline
```

**Visual QA Thresholds:**
- `failureThreshold: 0.01` (1%) - Allows for anti-aliasing differences
- If threshold exceeded, icon is flagged for human review

### Step 5: Add Icon to Figma Library (CONDITIONAL)

**If automated QA passes:** The icon can proceed directly to the sync workflow.

**If automated QA fails or edge cases detected:** Human intervention required.

**Manual Process (when needed):**
1. Open the LaunchDarkly Icons Figma library
2. Create a new branch in Figma
3. Add the icon following these guidelines:
   - Use 20x20 frame size
   - Ensure stroke width matches existing icons (typically 2px)
   - Center the icon within the frame
   - Use `currentColor` for stroke/fill
4. Apply the validated name from Step 3
5. Request design review from the Design team
6. Merge the Figma branch after approval

**Figma MCP Integration (if available):**
```javascript
// Use Figma MCP for read operations (validation only)
// Note: Official Figma MCP is read-only, cannot create/modify designs
const figmaMcp = require('figma-mcp');

// Check if icon already exists in library
const existingIcons = await figmaMcp.getDesignContext({ fileKey: 'ICON_LIBRARY_KEY' });
const iconExists = existingIcons.components.some(c => c.name === 'clock-ccw');

if (iconExists) {
  console.log('Icon already exists in Figma library');
} else {
  console.log('Icon needs to be added to Figma library');
}
```

### Step 6: Sync Icons to launchpad-ui

Once the Figma branch is merged (or automated QA passes), trigger the sync workflow:

```bash
# Trigger the sync icons workflow
gh workflow run sync-icons.yml --repo launchdarkly/launchpad-ui

# Wait for the workflow to complete and check for PR
gh run list --repo launchdarkly/launchpad-ui --workflow=sync-icons.yml --limit 1
gh pr list --repo launchdarkly/launchpad-ui --head "sync-icons" --state open
```

Review and merge the generated PR.

### Step 7: Release New launchpad-ui Version

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

### Step 8: Bump launchpad-ui in Gonfalon

Once the new launchpad-ui version is published:

```bash
cd gonfalon

# Create a new branch
git checkout -b devin/$(date +%s)-bump-launchpad-icons

# Update ALL @launchpad-ui packages to latest across the entire monorepo
# This single command handles all 15+ packages automatically
pnpm up "@launchpad-ui/*" --latest -r

# Commit and create PR
git add .
git commit -m "chore: bump @launchpad-ui packages to latest"
git push origin HEAD
gh pr create --title "chore: bump @launchpad-ui packages" --body "Updates launchpad-ui packages to include new icons"
```

### Step 9: Use the New Icon

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
- Run visual QA tests before and after normalization

## Edge Cases

| Situation | Action |
|-----------|--------|
| Visual QA threshold exceeded | Flag for human review, check for alignment/sizing issues |
| Naming validation fails | Use LLM to suggest appropriate name following conventions |
| Icon needs design modifications | Work with Design team during Figma review |
| Sync workflow fails | Check Figma API credentials and library access |
| Version conflicts in gonfalon | Run `pnpm install` to regenerate lockfile |
| Icon not appearing after bump | Verify the icon was included in the launchpad-ui release |

## Automation Summary

**Fully Automated (Steps 1-4, 6-9):**
- Fetching icons from Tabler CDN
- SVG normalization with SVGO (viewBox, dimensions, currentColor)
- Naming convention validation and transformation
- Visual QA with jest-image-snapshot (1% threshold)
- Triggering the sync workflow
- Bumping versions in gonfalon (15+ packages)
- Creating PRs

**Conditional Human Review (Step 5):**
- Only required when:
  - Visual QA threshold exceeded (>1% pixel difference)
  - Naming validation fails and LLM suggestion is ambiguous
  - Complex alignment issues detected
- Most icons (~95%) should pass automated QA

**Required Dependencies:**
```json
{
  "devDependencies": {
    "svgo": "^3.0.0",
    "sharp": "^0.33.0",
    "jest": "^29.0.0",
    "jest-image-snapshot": "^6.0.0"
  }
}
```

## References

- [Tabler Icons](https://tabler.io/icons) - Source icon library (4950+ free icons)
- [SVGO](https://github.com/svg/svgo) - SVG optimization library
- [jest-image-snapshot](https://github.com/americanexpress/jest-image-snapshot) - Visual regression testing
- [LaunchPad UI Repository](https://github.com/launchdarkly/launchpad-ui)
- [Gonfalon Repository](https://github.com/launchdarkly/gonfalon)
