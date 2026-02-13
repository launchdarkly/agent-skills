# Frontmatter & Metadata

Required and optional fields for SKILL.md frontmatter.

## Required Fields

### name

- **Format:** `lowercase-with-hyphens` only
- **Must match:** The directory name (`skills/<category>/<name>/`)
- **Pattern:** `^[a-z0-9]+(?:-[a-z0-9]+)*$`
- **Max length:** 64 characters

```yaml
name: launchdarkly-flag-create
```

### description

- **Purpose:** Helps the agent identify when to use this skill
- **Include:** Keywords, use cases, and "when to use" language
- **Max length:** 1024 characters

```yaml
description: "Create and configure LaunchDarkly feature flags in a way that fits the existing codebase. Use when the user wants to create a new flag, wrap code in a flag, or set up an experiment."
```

### compatibility

- **Purpose:** What the skill requires to work
- **Examples:**
  - `Requires the remotely hosted LaunchDarkly MCP server`
  - `Requires LaunchDarkly API token with ai-configs:write permission`
  - `Works on all platforms`
- **Max length:** 500 characters

```yaml
compatibility: Requires the remotely hosted LaunchDarkly MCP server
```

## Optional Fields

### license

```yaml
license: Apache-2.0
```

### metadata

```yaml
metadata:
  author: launchdarkly
  version: "0.1.0"
```

### metadata.version

- Use semantic versioning: `MAJOR.MINOR.PATCH`
- Update when skill behavior changes
- Experimental skills may use: `1.0.0-experimental`

## Full Example

```yaml
---
name: launchdarkly-flag-create
description: "Create and configure LaunchDarkly feature flags in a way that fits the existing codebase. Use when the user wants to create a new flag, wrap code in a flag, add a feature toggle, or set up an experiment."
license: Apache-2.0
compatibility: Requires the remotely hosted LaunchDarkly MCP server
metadata:
  author: launchdarkly
  version: "1.0.0-experimental"
---
```

## Common Mistakes

| Mistake | Fix |
|---------|-----|
| `name` has uppercase | Use lowercase only |
| `name` has underscores | Use hyphens |
| `name` doesn't match folder | Rename folder or fix frontmatter |
| Description too vague | Add keywords and "when to use" |
| Missing `compatibility` | Add requirement or "Works on all platforms" |

## Validation

Run `python3 scripts/validate_skills.py` to check:

- Opening and closing `---` delimiters
- Required fields present
- Name pattern and length
- Description and compatibility length
