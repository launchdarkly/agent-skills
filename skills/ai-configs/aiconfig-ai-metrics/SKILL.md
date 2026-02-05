---
name: aiconfig-ai-metrics
description: Track AI metrics automatically with LaunchDarkly SDK. Monitor tokens, duration, costs, and quality for AI Configs with simple SDK integration.
compatibility: Requires LaunchDarkly SDK with AI Config support (Python, Node.js, Go, .NET, Ruby).
metadata:
  author: launchdarkly
  version: "0.3.0"
---

# AI Metrics Tracking

Automatically track AI metrics using LaunchDarkly's SDK. The SDK captures tokens, duration, success rates, and costs without manual instrumentation.

## Prerequisites

- LaunchDarkly SDK initialized (see `aiconfig-sdk`)
- AI Config created in LaunchDarkly (see `aiconfig-create`)

## What Gets Tracked Automatically

When you use the LaunchDarkly AI SDK, these metrics are captured automatically:

1. **Token Usage** - Input tokens, output tokens, total tokens per request
2. **Performance** - End-to-end duration, time to first token (TTFT), success/failure rates
3. **Cost** - Calculated based on model and token usage, aggregated by variation and context
4. **Quality** (with Online Evaluations) - Accuracy, relevance, toxicity scores

## Tracker Methods

The config object returned by `completion_config()` or `agent_config()` includes a `.tracker` attribute with these methods:

| Method | Purpose |
|--------|---------|
| `track_openai_metrics(fn)` | Wrap OpenAI calls for automatic tracking |
| `track_bedrock_converse_metrics(res)` | Track Bedrock metrics from response dict |
| `track_duration_of(fn)` | Track duration of any callable |
| `track_tokens(TokenUsage)` | Manually track token usage |
| `track_duration(int)` | Manually track duration in milliseconds |
| `track_time_to_first_token(int)` | Track TTFT in milliseconds |
| `track_success()` | Mark request as successful |
| `track_error()` | Mark request as failed |

## OpenAI Automatic Tracking

```python
import openai
from ldai.tracker import TokenUsage

def track_openai_completion(config, prompt: str):
    """Track OpenAI completion with automatic metrics."""
    if not config.enabled:
        return None

    tracker = config.tracker

    # Wrap OpenAI call - automatically captures tokens, duration, success/failure
    response = tracker.track_openai_metrics(
        lambda: openai.chat.completions.create(
            model=config.model.name,
            messages=[
                {"role": "system", "content": config.messages[0].content},
                {"role": "user", "content": prompt}
            ]
        )
    )

    return response.choices[0].message.content
```

## Manual Token Tracking

For providers without automatic tracking, use `TokenUsage` and manual methods:

```python
from ldai.tracker import TokenUsage

def track_anthropic_completion(config, prompt: str):
    """Track Anthropic completion with manual metrics."""
    import anthropic
    client = anthropic.Anthropic()

    if not config.enabled:
        return None

    tracker = config.tracker

    # Track duration of the call
    response = tracker.track_duration_of(
        lambda: client.messages.create(
            model=config.model.name,
            max_tokens=1024,
            messages=[{"role": "user", "content": prompt}]
        )
    )

    # Manually track tokens using TokenUsage object
    if hasattr(response, 'usage'):
        tokens = TokenUsage(
            total=response.usage.input_tokens + response.usage.output_tokens,
            input=response.usage.input_tokens,
            output=response.usage.output_tokens
        )
        tracker.track_tokens(tokens)

    tracker.track_success()
    return response.content[0].text
```

## Streaming Metrics

```python
import time
from ldai.tracker import TokenUsage

def track_streaming_completion(config, prompt: str):
    """Track metrics for streaming responses."""
    import openai

    if not config.enabled:
        return None

    tracker = config.tracker
    start_time = time.time()
    first_token_time = None

    stream = openai.chat.completions.create(
        model=config.model.name,
        messages=[{"role": "user", "content": prompt}],
        stream=True
    )

    response_text = ""
    for chunk in stream:
        if first_token_time is None and chunk.choices[0].delta.content:
            first_token_time = time.time()
            ttft_ms = int((first_token_time - start_time) * 1000)
            tracker.track_time_to_first_token(ttft_ms)

        if chunk.choices[0].delta.content:
            response_text += chunk.choices[0].delta.content

    # Track final metrics (milliseconds)
    duration_ms = int((time.time() - start_time) * 1000)
    tracker.track_duration(duration_ms)
    tracker.track_success()

    # Estimate tokens (or use tiktoken for accuracy)
    estimated_input = len(prompt.split()) * 2
    estimated_output = len(response_text.split()) * 2
    tokens = TokenUsage(
        total=estimated_input + estimated_output,
        input=estimated_input,
        output=estimated_output
    )
    tracker.track_tokens(tokens)

    return response_text
```

## Retrieving Metrics via API

```python
import requests
import time
import os

def get_ai_config_metrics(project_key: str, config_key: str, env: str = "production", hours: int = 24):
    """Get AI Config metrics for the last N hours."""
    API_TOKEN = os.environ.get("LAUNCHDARKLY_API_TOKEN")

    now = int(time.time())
    start = now - (hours * 3600)

    url = f"https://app.launchdarkly.com/api/v2/projects/{project_key}/ai-configs/{config_key}/metrics"

    params = {
        "from": start,
        "to": now,
        "env": env
    }

    headers = {
        "Authorization": API_TOKEN,
        "LD-API-Version": "beta"
    }

    response = requests.get(url, headers=headers, params=params)

    if response.status_code == 200:
        metrics = response.json()
        print(f"[OK] Metrics for {config_key} (last {hours} hours, {env}):")
        print(f"     Generations: {metrics.get('generationCount', 0):,}")
        print(f"     Success: {metrics.get('generationSuccessCount', 0):,}")
        print(f"     Errors: {metrics.get('generationErrorCount', 0):,}")
        print(f"     Input Tokens: {metrics.get('inputTokens', 0):,}")
        print(f"     Output Tokens: {metrics.get('outputTokens', 0):,}")
        print(f"     Total Tokens: {metrics.get('totalTokens', 0):,}")
        print(f"     Input Cost: ${metrics.get('inputCost', 0):.4f}")
        print(f"     Output Cost: ${metrics.get('outputCost', 0):.4f}")
        print(f"     Duration (ms): {metrics.get('durationMs', 0):,}")
        print(f"     TTFT (ms): {metrics.get('timeToFirstTokenMs', 0):,}")
        print(f"     Thumbs Up: {metrics.get('thumbsUp', 0)}")
        print(f"     Thumbs Down: {metrics.get('thumbsDown', 0)}")
        return metrics
    else:
        print(f"[ERROR] Failed to get metrics: {response.status_code}")
        return None
```

**Response Fields:**
| Field | Description |
|-------|-------------|
| `generationCount` | Total number of generations |
| `generationSuccessCount` | Successful generations |
| `generationErrorCount` | Failed generations |
| `inputTokens` | Total input tokens used |
| `outputTokens` | Total output tokens generated |
| `totalTokens` | Sum of input + output tokens |
| `inputCost` | Cost for input tokens |
| `outputCost` | Cost for output tokens |
| `durationMs` | Total duration in milliseconds |
| `timeToFirstTokenMs` | Time to first token (streaming) |
| `thumbsUp` | Positive feedback count |
| `thumbsDown` | Negative feedback count |

## Best Practices

1. **Always Check `config.enabled`** - Skip tracking if config is disabled
2. **Track Errors** - Call `track_error()` in exception handlers
3. **Flush in Serverless** - Call `ld_client.flush()` before Lambda/Function terminates

## Related Skills

- `aiconfig-sdk` - SDK setup and config retrieval
- `aiconfig-custom-metrics` - Track business metrics
- `aiconfig-online-evals` - Automatic quality evaluation

## References

- [AI Metrics Documentation](https://docs.launchdarkly.com/sdk/features/ai-config)
- [Python AI SDK](https://docs.launchdarkly.com/sdk/ai/python)
