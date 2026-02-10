# LaunchDarkly AI Config Variations Skill

An Agent Skill for creating and managing AI Config variations to experiment with different models, prompts, and parameters.

## Overview

This skill teaches agents how to:
- Design experiments (model comparison, prompt optimization, parameter tuning)
- Create variations via the API
- Attach tools to variations
- Verify variations exist with correct configuration

## Installation (Local)

Copy `skills/ai-configs/aiconfig-variations/` into your agent client's skills path.

## Prerequisites

- LaunchDarkly API access token with `ai-configs:write` permission
- Existing AI Config (use `aiconfig-create` skill first)

## Usage

```
Add a GPT-4o-mini variation to test cost savings
```

```
Create variations to compare Claude vs GPT-4 for our agent
```

## Structure

```
aiconfig-variations/
├── SKILL.md
├── README.md
└── references/
    └── api-quickstart.md
```

## Related

- [AI Config Create](../aiconfig-create/) — Create the config first
- [AI Config Update](../aiconfig-update/) — Modify existing variations
- [AI Config Tools](../aiconfig-tools/) — Attach tools to variations
- [LaunchDarkly AI Configs Docs](https://docs.launchdarkly.com/home/ai-configs)

## License

Apache-2.0
