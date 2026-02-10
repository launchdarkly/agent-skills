# LaunchDarkly AI Config Update Skill

An Agent Skill for updating, archiving, and deleting AI Configs and their variations.

## Overview

This skill teaches agents how to:
- Update config metadata (name, description)
- Modify variation instructions, messages, models, and parameters
- Archive configs (reversible) or delete them (permanent)
- Verify changes via API fetch

## Installation (Local)

Copy `skills/ai-configs/aiconfig-update/` into your agent client's skills path.

## Prerequisites

- LaunchDarkly API access token with write permissions
- Existing AI Config to modify

## Usage

```
Update the instructions for our support agent config
```

```
Switch the content writer config to use Claude instead of GPT-4
```

```
Archive the old chatbot config
```

## Structure

```
aiconfig-update/
├── SKILL.md
├── README.md
└── references/
    └── api-quickstart.md
```

## Related

- [AI Config Create](../aiconfig-create/) — Create configs
- [AI Config Variations](../aiconfig-variations/) — Add or test variations
- [LaunchDarkly AI Configs Docs](https://docs.launchdarkly.com/home/ai-configs)

## License

Apache-2.0
