# LaunchDarkly Flag Cleanup Skill

An Agent Skill for safely automating feature flag cleanup workflows using LaunchDarkly as the source of truth.

## Overview

This skill teaches agents how to:
- Determine if a feature flag is ready for removal
- Calculate the correct forward value to preserve production behavior
- Safely remove flag references from code
- Create well-documented pull requests

## Installation (Local)

For now, install by placing this skill directory where your agent client loads skills.

Examples:

- **Generic**: copy `skills/feature-flags/launchdarkly-flag-cleanup/` into your client's skills path

## Prerequisites

This skill requires the LaunchDarkly MCP server to be configured in your environment.

### Configure MCP Server

**Claude Code (`~/.claude/mcp.json`):**
```json
{
  "mcpServers": {
    "launchdarkly": {
      "command": "npx",
      "args": ["-y", "@launchdarkly/mcp-server", "start"],
      "env": {
        "LD_ACCESS_TOKEN": "your-api-key"
      }
    }
  }
}
```

**Cursor (`.cursor/mcp.json`):**
```json
{
  "mcpServers": {
    "launchdarkly": {
      "command": "npx",
      "args": ["-y", "@launchdarkly/mcp-server", "start"],
      "env": {
        "LD_ACCESS_TOKEN": "your-api-key"
      }
    }
  }
}
```

## Usage

Once installed, the skill activates automatically when you ask about flag cleanup:

```
Remove the `new-checkout-flow` feature flag
```

```
Is the `dark-mode` flag ready to be cleaned up?
```

```
Clean up stale feature flags in this codebase
```

## Structure

```
launchdarkly-flag-cleanup/
├── SKILL.md
├── marketplace.json
├── README.md
└── references/
    ├── pr-template.md
    └── sdk-patterns.md
```

## Related

- [LaunchDarkly MCP Server](https://github.com/launchdarkly/mcp-server)
- [LaunchDarkly Docs](https://docs.launchdarkly.com)
- [Agent Skills Specification](https://agentskills.io/specification)

## License

Apache-2.0
