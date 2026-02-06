# Install LaunchDarkly AI Config Skills

Install all AI Config skills from the development branches.

## Quick Start

```bash
git clone https://github.com/launchdarkly/agent-skills.git
cd agent-skills
git checkout scarlett/do-not-merge
./install-scarlett-skills.sh
```

## What Gets Installed

| Branch | Skills |
|--------|--------|
| `scarlett/aiconfig-1-foundation` | aiconfig-projects |
| `scarlett/aiconfig-2-create-manage` | aiconfig-create, aiconfig-tools, aiconfig-update, aiconfig-variations |
| `scarlett/aiconfig-3-sdk-usage` | aiconfig-context-advanced, aiconfig-context-basic, aiconfig-sdk |
| `scarlett/aiconfig-4-targeting` | aiconfig-segments, aiconfig-targeting |
| `scarlett/aiconfig-5-metrics` | aiconfig-ai-metrics, aiconfig-custom-metrics, aiconfig-online-evals |
| `scarlett/aiconfig-6-api` | aiconfig-api |
| `main` | launchdarkly-flag-cleanup, create-skill |

**Total: 14 skills**

## Custom Install Location

By default, skills install to `~/.claude/commands`. Override with:

```bash
CLAUDE_SKILLS_DIR=~/my-custom-path ./install-scarlett-skills.sh
```

## Note

These skills are from development branches and may change before being merged to main.
