# LaunchDarkly AI Config Tools Skill

An Agent Skill for creating tools (function calling) and attaching them to AI Config variations. Guides identifying capabilities, creating tool schemas, and verifying attachment.

## Overview

This skill teaches agents how to:
- Identify what capabilities the AI needs
- Create tool definitions with JSON schemas via the API
- Attach tools to AI Config variations
- Verify tools are properly connected

## Installation (Local)

Copy `skills/ai-configs/aiconfig-tools/` into your agent client's skills path.

## Prerequisites

- LaunchDarkly API token with `/*:ai-tool/*` permission
- Existing AI Config (use `aiconfig-create` skill first)

## Usage

```
Add a database search tool to our support agent config
```

```
Create tools for the content assistant to call our API
```

## Structure

```
aiconfig-tools/
├── SKILL.md
├── README.md
└── references/
    └── api-quickstart.md
```

## Related

- [AI Config Create](../aiconfig-create/) — Create the config before adding tools
- [AI Config Variations](../aiconfig-variations/) — Manage variations that tools attach to
- [LaunchDarkly AI Configs Docs](https://docs.launchdarkly.com/home/ai-configs)

## License

Apache-2.0
