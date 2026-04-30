# Decision signals

Map of stated phrases, code patterns, and dependency entries to the surface they suggest. Used by the parent [SKILL.md](../SKILL.md) Step 2 (codebase scan) and Step 3 (decide).

Signals are weighted into a small score per surface. When you read this, treat the strongest signal class (Stated → Dependency → Code pattern → Repo shape) as roughly 4 → 3 → 2 → 1 weight. You're not running a real classifier — these are guidelines for an LLM to break ties consistently.

## Stated-intent signals (weight 4)

The user literally names the surface or one of its features.

| Phrase                                                                                                                  | Surface         |
| ----------------------------------------------------------------------------------------------------------------------- | --------------- |
| "feature flag", "feature toggle", "kill switch", "dark launch", "rollout", "release this", "ship a feature", "gate"     | `flags`         |
| "percentage rollout", "environment-specific", "production toggle", "wrap in a flag", "behind a flag"                    | `flags`         |
| "AI config", "AI configs", "LLM", "prompt", "model config", "GPT", "Claude", "Anthropic", "OpenAI", "Bedrock", "Gemini" | `ai-configs`    |
| "agent (in the LLM sense)", "function calling", "tool calling", "judge", "RAG", "chatbot prompts", "system prompt"      | `ai-configs`    |
| "experiment", "A/B test", "multivariate test", "metric", "uplift", "conversion rate", "statistical significance"        | `experiments`   |
| "guarded rollout", "release policy", "primary metric", "guardrail metric", "auto-rollback"                              | `experiments`   |
| "session replay", "error tracking", "errors", "logs", "trace", "OTel", "OpenTelemetry", "RUM", "real user monitoring"   | `observability` |
| "performance monitoring (web)", "frontend errors", "browser errors", "uncaught exceptions"                              | `observability` |

## Dependency signals (weight 3)

What's in `package.json`, `requirements.txt`, `pyproject.toml`, `go.mod`, etc.

### `ai-configs`

```
openai
anthropic
@anthropic-ai/sdk
@anthropic-ai/bedrock-sdk
@anthropic-ai/vertex-sdk
langchain
@langchain/core
llama-index
llamaindex
@vercel/ai
ai           # (vercel ai sdk in package.json)
mistralai
cohere
google-genai
@google/generative-ai
boto3        # paired with bedrock-runtime usage
```

### `flags`

```
# any frontend / general-purpose runtime is plausibly flags-first; weak signal on its own
react
next
vue
@angular/core
expo
react-native
fastify
express
@nestjs/core
django
fastapi
gin            # go web framework
chi            # go web framework, also used by LD itself
```

### `experiments`

Indirect — presence of analytics SDKs means they already track events, so an experiment can re-use them.

```
mixpanel
amplitude
@segment/analytics-node
@segment/analytics-next
posthog-js
posthog-node
@sentry/nextjs    # double-edged: also an observability signal
gtag              # via google analytics
```

### `observability`

```
@opentelemetry/api
@opentelemetry/sdk-node
@opentelemetry/sdk-trace-node
@opentelemetry/auto-instrumentations-node
opentelemetry-api          # python
opentelemetry-sdk          # python
opentelemetry-distro       # python
@sentry/node
@sentry/react
@sentry/nextjs
pino
winston
```

### Already-onboarded for `flags`

```
launchdarkly-server-sdk          # node, python depending on package set
launchdarkly-node-server-sdk
@launchdarkly/node-server-sdk
@launchdarkly/react-client-sdk
@launchdarkly/react-native-client-sdk
@launchdarkly/js-client-sdk
launchdarkly-go-server-sdk
LaunchDarkly.ServerSdk           # .NET
launchdarkly-server-sdk-ai       # signal that the user is on flags AND AI Configs already
@launchdarkly/server-sdk-ai
```

If any LaunchDarkly SDK is already a dependency, treat the user's "onboard me" as "what's the next product surface to add" rather than a first-time setup.

## Code-pattern signals (weight 2)

Quick `Grep` checks. Don't pull file contents into the chat — just count hits.

### `ai-configs`

```
OpenAI(
new OpenAI(
Anthropic(
new Anthropic(
client.chat.completions.create
chat.completions.create
messages.create
generate_content(
generateContent(
streamText(
generateText(
bedrock_runtime
ChatCompletion.create
```

### `observability`

```
tracer.startSpan
trace.getTracer(
opentelemetry
captureException
console.error\(
recordException
```

### `experiments` (analytics-event signal)

```
analytics.track(
mixpanel.track(
amplitude.track(
posthog.capture(
gtag('event'
window.dataLayer.push(
```

### Already-using-flags signal

```
LDClient
ldclient.boolVariation
ldclient.variation
useFlag\(
useFlags\(
```

## Repo-shape signals (weight 1)

These tilt the destination skill's behavior more than the routing itself. Note them in the handoff so the destination can pick the right SDK / recipe.

| Repo shape                                                                                       | Tilt                                              |
| ------------------------------------------------------------------------------------------------ | ------------------------------------------------- |
| Single backend service (Express / FastAPI / Gin / Spring) and nothing else                        | `flags` (server SDK) by default                   |
| Frontend SPA (Vite + React, Vue, Angular)                                                         | `flags` or `observability` (frontend perspective) |
| Mobile project (`Info.plist`, `AndroidManifest.xml`, `pubspec.yaml`, `expo`)                      | `flags` (mobile SDK)                              |
| Next.js mixed (server + client)                                                                  | `flags` dual-SDK; LD onboarding skill knows this  |
| Monorepo with explicit AI / agent package (`packages/agents`, `packages/ai`, `services/llm`)      | `ai-configs` (start where the LLM code lives)     |
| Repo with a `.observability/`, `otel-collector.yaml`, or `otel-config.json`                       | `observability`                                   |

## How to combine the signals

This is informal — you're letting the LLM pattern-match, not running an algorithm. But for ties, here's a sensible ordering:

1. **Stated intent always wins.** If the user said "AI Configs," that's the route, full stop.
2. **Strong dependency match in a single class beats codebase-wide scans.** If `package.json` has `openai` and `anthropic` and there's `client.chat.completions.create` everywhere, that's `ai-configs`.
3. **If two surfaces tie**, fall back to the precedence order: `ai-configs` > `flags` > `experiments` > `observability`. Reasoning:
   - AI teams have the strongest immediate-value moment from AI Configs.
   - Flags is the default foundation.
   - Experiments and observability are easier to add after one of the first two is in place.
4. **If nothing tilts at all**, ask. Don't pretend to a confident pick. (Branch D in the parent skill.)

## What the router does NOT do

Even when signals are strong, the router does not:

- Read source files in order to write code suggestions.
- Confirm the user's tech stack in detail (the destination skill does that).
- Install packages or modify dependency files.
- Call any LaunchDarkly write APIs (`create-flag`, `setup-ai-config`, etc.).

The router can read repo metadata (file names, dependency manifest contents, line counts, grep hits). Anything that mutates the repo or LaunchDarkly belongs to the destination skill.
