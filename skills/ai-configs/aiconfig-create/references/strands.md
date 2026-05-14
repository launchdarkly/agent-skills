# Strands Agents Integration

Strands ([strandsagents.com](https://strandsagents.com)) builds agents with pluggable model classes (`OpenAIModel`, `AnthropicModel`, `BedrockModel`). LaunchDarkly picks *which* variation to serve at runtime; Strands instantiates the matching model class. The result: swap providers from the LaunchDarkly UI without changing application code.

## Provider dispatch

Map an `AIAgentConfig` to the right Strands model class with a single helper. Dispatch on `config.provider.name` (set by `modelConfigKey` on the variation) and fall back to model-id prefixes for Bedrock variations, which intentionally omit `modelConfigKey`:

```python
from strands.models.openai import OpenAIModel
from strands.models.anthropic import AnthropicModel
from strands.models.bedrock import BedrockModel

def create_strands_model(cfg):
    provider = (cfg.provider.name if cfg.provider else "").lower()
    model_id = cfg.model.name
    params = dict(cfg.model.to_dict().get("parameters") or {})
    # Tools surface via parameters.tools — Strands takes them through the
    # Agent constructor, not the model. Drop them here.
    params.pop("tools", None)

    is_bedrock = provider == "bedrock" or model_id.startswith(
        ("us.", "eu.", "apac.", "anthropic.", "amazon.", "meta.")
    )
    if is_bedrock:
        # BedrockModel takes flat kwargs; route known inference fields out of params.
        known = {k: params.pop(k) for k in ("max_tokens", "temperature", "top_p", "stop_sequences") if k in params}
        if "max_tokens" not in known:
            known["max_tokens"] = 1024
        return BedrockModel(model_id=model_id, additional_request_fields=params or None, **known)
    if provider == "anthropic":
        # AnthropicModel requires max_tokens as a kwarg, not in params.
        max_tokens = int(params.pop("max_tokens", None) or params.pop("maxTokens", None) or 1024)
        return AnthropicModel(model_id=model_id, max_tokens=max_tokens, params=params or None)
    if provider == "openai":
        # gpt-5 wants max_completion_tokens; gpt-4o wants max_tokens. Keep that
        # choice in the LD variation parameters and pass through as-is.
        return OpenAIModel(model_id=model_id, params=params)
    raise ValueError(f"Unsupported provider for Strands: {provider!r}")
```

## Variation parameter conventions

LaunchDarkly stores parameters under `model.parameters`. Per-provider gotchas:

| Provider | `modelConfigKey` | Key parameter |
|---|---|---|
| OpenAI gpt-5 | `OpenAI.gpt-5` | `max_completion_tokens` (NOT `max_tokens`; non-default temperature also rejected) |
| OpenAI gpt-4o / gpt-4 | `OpenAI.gpt-4o` | `max_tokens`, `temperature` |
| Anthropic | `Anthropic.claude-sonnet-4-6` | `max_tokens` (extracted as kwarg, not passed in `params`) |
| Bedrock-hosted Anthropic | *(omit)* | `model.modelName` like `us.anthropic.claude-sonnet-4-6`; requires AWS credentials |

## Build the agent

```python
from strands import Agent
from strands.agent.conversation_manager.sliding_window_conversation_manager import SlidingWindowConversationManager
from ldai.client import LDAIClient
import ldclient

ldclient.set_config(ldclient.config.Config(SDK_KEY))
ai_client = LDAIClient(ldclient.get())
context = ldclient.Context.builder("user-123").kind("user").build()
config = ai_client.agent_config("strands-agent", context)

agent = Agent(
    name="order-assistant",
    model=create_strands_model(config),
    system_prompt=config.instructions,
    tools=resolved_tools,                            # see aiconfig-tools/references/strands.md
    conversation_manager=SlidingWindowConversationManager(window_size=40),
    callback_handler=None,                           # suppress default stdout streaming
)
```

## Tracking async invocations correctly

`tracker.track_duration_of(...)` is **synchronous-only**. Feeding it `lambda: agent.invoke_async(...)` only times the coroutine factory, not the awaited execution — duration is recorded as ~0ms and metrics look broken. Use `track_metrics_of_async` instead:

```python
from ldai.providers.types import LDAIMetrics
from ldai.tracker import TokenUsage

def strands_metrics_extractor(result):
    usage = getattr(result.metrics, "accumulated_usage", {}) or {}
    inp = usage.get("inputTokens", 0)
    out = usage.get("outputTokens", 0)
    total = usage.get("totalTokens", 0) or (inp + out)
    return LDAIMetrics(
        success=True,
        usage=TokenUsage(input=inp, output=out, total=total) if total > 0 else None,
        duration_ms=None,  # SDK uses wall-clock elapsed
    )

tracker = config.create_tracker()
result = await tracker.track_metrics_of_async(
    strands_metrics_extractor,
    lambda: agent.invoke_async(user_input),
)
```

This fires `track_duration`, `track_success`/`track_error`, and `track_tokens` atomically with the real elapsed time. Tool-call tracking stays in the `@tool` body (see `aiconfig-tools` Strands reference).

## Self-heal pattern for re-runs

`ldclient.is_initialized()` is a one-way latch: it stays True even after `close()`. In notebooks where the cleanup cell calls `close()`, re-running a downstream cell evaluates against the closed client and returns stale cached state with `[WARN] evaluation attempted before client has initialized`. Either drop the `close()` call (let kernel shutdown handle it) or self-heal at entry:

```python
async def run_turn(user_input):
    global ai_client, agent_config
    _ld = ldclient.get()
    closed = getattr(_ld, "_closed", False) or getattr(_ld, "_LDClient__closed", False)
    if (not _ld.is_initialized()) or closed:
        ldclient.set_config(Config(SDK_KEY))
        ai_client = LDAIClient(ldclient.get())
        agent_config = ai_client.agent_config(CONFIG_KEY, context)
    # ...proceed
```

## Reference implementation

The full pattern (3 provider variations + governed tools + agent graph + dispatcher) is published as a sample at [strands-agents/samples/python/03-integrate/runtime-control/launchdarkly](https://github.com/strands-agents/samples/tree/main/python/03-integrate/runtime-control/launchdarkly) and as a cookbook at [launchdarkly-labs/agentcontrol-cookbooks/strands.ipynb](https://github.com/launchdarkly-labs/agentcontrol-cookbooks/blob/main/strands.ipynb).
