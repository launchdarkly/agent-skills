# LaunchDarkly AI Config Create Skill

An Agent Skill for creating AI Configs in LaunchDarkly. Guides choosing agent vs completion mode, creating the config and variations, and verifying the result.

## Overview

This skill teaches agents how to:
- Understand the use case and choose agent vs completion mode
- Create AI Configs via the two-step API process (config then variations)
- Set up model configuration with the correct modelConfigKey
- Verify creation via API fetch

## Installation (Local)

Copy `skills/ai-configs/aiconfig-create/` into your agent client's skills path.

## Prerequisites

- LaunchDarkly API access token with `ai-configs:write` permission or MCP server
- LaunchDarkly project (use `aiconfig-projects` skill if needed)

## Usage

```
Create an AI config for our customer support agent
```

```
Set up an AI config for content generation using Claude
```

## Structure

```
aiconfig-create/
├── SKILL.md
├── README.md
└── references/
    └── api-quickstart.md
```

## Related

- [AI Config Projects](../aiconfig-projects/) — Create projects first
- [AI Config Tools](../aiconfig-tools/) — Add tools after creating config
- [AI Config Variations](../aiconfig-variations/) — Add more variations for experimentation
- [LaunchDarkly AI Configs Docs](https://docs.launchdarkly.com/home/ai-configs)

## License

Apache-2.0
