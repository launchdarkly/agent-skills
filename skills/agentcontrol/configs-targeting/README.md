# LaunchDarkly AI Config Targeting Skill

An Agent Skill for configuring AI Config targeting rules via the LaunchDarkly API.

## Overview

This skill teaches agents how to:
- Turn targeting on/off for AI Configs
- Add attribute-based targeting rules
- Configure percentage rollouts for A/B testing
- Set fallthrough (default) variations
- Target individual contexts or segments

## Installation (Local)

Copy `skills/agentcontrol/configs-targeting/` into your agent client's skills path.

## Prerequisites

- LaunchDarkly API access token with `ai-configs:write` permission
- Existing AI Config with variations (use `configs-create` skill)
- Understanding of contexts (see `context-basic` skill)

## Usage

```
Set up targeting rules for model-selector: route sonnet requests to the Sonnet variation, mistral to Mistral, and default to Opus
```

```
Add a percentage rollout: 60% to variation A, 40% to variation B for premium users
```

## Structure

```
configs-targeting/
├── SKILL.md
└── README.md
```

## Related

- [AI Config Create](../configs-create/) - Create AI Configs first
- [AI Config Variations](../configs-variations/) - Create variations to target
- [AI Config Online Evals](../configs-online-evals/) - Attach judges
- [Targeting Docs](https://docs.launchdarkly.com/home/ai-configs/target)

## License

Apache-2.0
