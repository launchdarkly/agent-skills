---
name: aiconfig-online-evals
description: Use Online Evaluations (LLM-as-a-judge) to automatically score AI Config responses for accuracy, relevance, and toxicity.
compatibility: Works with AI Configs in completion mode only. Requires judges configured via LaunchDarkly UI.
metadata:
  author: launchdarkly
  version: "0.5.0"
---

# AI Config Online Evaluations

Automatically score AI Config responses using LLM-as-a-judge methodology.

## Prerequisites

- LaunchDarkly SDK initialized (see `aiconfig-sdk`)
- AI Config in **completion mode** (judges don't work with agent mode)
- Judges enabled in LaunchDarkly UI (AI Configs → your config → Variations → Attach judges)

## Core Concepts

Three built-in judges are available:
- **Accuracy** - Scores 0.0-1.0 for correctness
- **Relevance** - Scores 0.0-1.0 for addressing the request
- **Toxicity** - Scores 0.0-1.0 where lower is safer

Judges evaluate asynchronously (1-2 minute delay). Results appear in the **Monitoring tab**.

## SDK: Check Judge Configuration

```python
from ldclient import Context
from ldclient.config import Config
from ldai.client import LDAIClient, AICompletionConfigDefault
import ldclient

# Initialize (see aiconfig-sdk)
ldclient.set_config(Config("your-sdk-key"))
ld_client = ldclient.get()
ai_client = LDAIClient(ld_client)

def check_judges(ai_client, config_key: str, user_id: str):
    """Check which judges are attached to a config."""
    context = Context.builder(user_id).build()
    config = ai_client.completion_config(
        config_key,
        context,
        AICompletionConfigDefault(enabled=False),
        {}
    )

    if config.judge_configuration and config.judge_configuration.judges:
        print("[OK] Judges attached:")
        for judge in config.judge_configuration.judges:
            print(f"     - {judge.key}: {int(judge.sampling_rate * 100)}% sampling")
    else:
        print("[INFO] No judges configured")

    return config.judge_configuration
```

## SDK: Automatic Evaluation with create_chat

For automatic judge evaluation, use the `create_chat()` method. This handles the full conversation flow and triggers judges automatically.

> **Important:** `create_chat()` passes model parameters directly to the provider. LaunchDarkly uses camelCase (`maxTokens`), but OpenAI expects snake_case (`max_tokens`). If your variation has `maxTokens` set, `create_chat()` will fail with OpenAI. Either:
> - Omit `maxTokens` from the variation's model parameters, OR
> - Use `completion_config()` + `track_openai_metrics()` instead (but judges won't auto-evaluate)

```python
from ldai.client import AICompletionConfigDefault, ModelConfig, ProviderConfig, LDMessage

async def generate_with_automatic_evaluation(ai_client, config_key: str, user_id: str, prompt: str):
    """Generate AI response with automatic judge evaluation using create_chat."""
    context = Context.builder(user_id).build()

    chat = await ai_client.create_chat(
        config_key,
        context,
        AICompletionConfigDefault(
            enabled=True,
            model=ModelConfig("gpt-4"),
            provider=ProviderConfig("openai"),
            messages=[LDMessage(role='system', content='You are a helpful assistant.')]
        )
    )

    if not chat:
        return None

    # Invoke chat - judges evaluate automatically (1-2 min delay)
    response = await chat.invoke(prompt)

    # Results appear in Monitoring tab as:
    # $ld:ai:judge:accuracy, $ld:ai:judge:relevance, $ld:ai:judge:toxicity
    return response.message.content
```

## Sampling Rate Guidelines

Configure sampling rates in the LaunchDarkly UI:

| Environment | Rate | Use Case |
|-------------|------|----------|
| Development | 100% | Full evaluation for testing |
| Staging | 50% | Validation coverage |
| Production (initial) | 10% | Start conservatively |
| Production (stable) | 20% | Ongoing monitoring |
| Critical features | 30% | Important flows |

## Viewing Results

1. Go to **AI Configs** in LaunchDarkly
2. Select your config
3. Click **Monitoring** tab
4. View judge scores by variation and time range

## Best Practices

1. **Completion Mode Only** - Judges don't work with agent mode configs
2. **Async Results** - Evaluation takes 1-2 minutes; don't wait for results
3. **Monitor Costs** - Judge evaluations use LLM tokens
4. **Start Low** - Begin with 10% sampling, increase as needed
5. **Flush Events** - Call `ld_client.flush()` in serverless environments

## Related Skills

- `aiconfig-sdk` - SDK setup and config retrieval
- `aiconfig-ai-metrics` - Automatic AI metrics tracking
- `aiconfig-variations` - Manage variations

## References

- [Online Evaluations Documentation](https://docs.launchdarkly.com/home/ai-configs/online-evaluations)
- [Node.js judge-evaluation example](https://github.com/launchdarkly/js-core/tree/main/packages/sdk/server-ai/examples/judge-evaluation)
