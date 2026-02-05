# LaunchDarkly Agent Skills

LaunchDarkly's public collection of AI agent skills and playbooks. These skills encode repeatable workflows for working with LaunchDarkly, so coding agents can execute common tasks safely and consistently.

## What Is This Repo?

Agent Skills are modular, text-based playbooks that teach an agent how to perform a workflow. This repo is designed to be a public, open-source home for LaunchDarkly skills and to align with the emerging Agent Skills Open Standard.

## Available Skills

### Feature Flags

| Skill | Description |
|-------|-------------|
| `feature-flags/launchdarkly-flag-cleanup` | Safely remove flags from code using LaunchDarkly as the source of truth |

### AI Configs

| Skill | Description |
|-------|-------------|
| `ai-configs/aiconfig-targeting` | Configure targeting rules for controlled rollout |
| `ai-configs/aiconfig-segments` | Create segments for AI Config targeting |

### Skill Authoring

| Skill | Description |
|-------|-------------|
| `skill-authoring/create-skill` | Add a new skill to the LaunchDarkly agent-skills repo following conventions |

## Quick Start (Local)

```bash
# Clone the repo
git clone https://github.com/launchdarkly/agent-skills.git
cd agent-skills

# If your agent supports skills.sh installs:
npx skills add launchdarkly/agent-skills

# Or manually copy a skill into your agent's skills path:
cp -r skills/feature-flags/launchdarkly-flag-cleanup <your-agent-skills-dir>/
```

Then ask your agent something like:

```
Remove the `new-checkout-flow` feature flag from this codebase
```

## Install via skills.sh CLI

```bash
npx skills add <owner/repo>
```

## Contributing

See `CONTRIBUTING.md` for how to add new skills and the conventions we follow.

## License

Apache-2.0
