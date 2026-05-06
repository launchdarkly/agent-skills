---
name: launchdarkly-experiment-setup
description: "Set up and run experiments in LaunchDarkly. Create experiments with metrics and treatments, start iterations to collect data, and monitor results."
license: Apache-2.0
compatibility: Requires the remotely hosted LaunchDarkly MCP server
metadata:
  author: launchdarkly
  version: "0.1.0"
---

# LaunchDarkly Experiment Setup

You're using a skill that will guide you through setting up and running experiments in LaunchDarkly. Your job is to design the experiment, create it with the right metrics and treatments, start data collection, and verify it's running.

## Prerequisites

This skill requires the remotely hosted LaunchDarkly MCP server to be configured in your environment.

**Required MCP tools:**
- `create-experiment` -- create a new experiment with metrics and treatments
- `start-experiment-iteration` -- begin collecting data for the experiment
- `get-experiment` -- check experiment status and configuration

**Optional MCP tools:**
- `list-experiments` -- browse existing experiments in the project
- `update-experiment` -- modify experiment name or description
- `create-metric` -- create metrics if they don't exist yet
- `list-metrics` -- browse available metrics

## Core Concepts

### What Are Experiments?

Experiments in LaunchDarkly let you measure the impact of feature flag variations on key metrics. An experiment consists of:

- **Treatments**: The flag variations being compared (control vs. test)
- **Metrics**: What you're measuring (conversion rate, latency, revenue, etc.)
- **Iterations**: Data collection periods — start an iteration to begin collecting data
- **Holdout** (optional): A percentage of traffic excluded from the experiment for baseline measurement

### Experiment Lifecycle

1. **Create** the experiment with metrics and treatments
2. **Start an iteration** to begin data collection
3. **Monitor** results as data accumulates
4. **Stop** the iteration when you have statistical significance
5. **Ship** the winning variation

## Core Principles

1. **Metrics First**: Ensure your metrics exist before creating the experiment
2. **Clear Hypothesis**: Know what you expect to improve and by how much
3. **Proper Controls**: Always include a control treatment (the current behavior)
4. **Sufficient Sample Size**: Let experiments run long enough for statistical significance
5. **One Change at a Time**: Test one variable per experiment for clear attribution

## Workflow

### Step 1: Prepare Metrics

Before creating an experiment, ensure the metrics you want to measure exist:

1. Use `list-metrics` to check for existing metrics
2. If needed, use `create-metric` to create new ones
3. Note the metric keys — you'll need them for the experiment

Common metric types:
| Goal | Metric Type | Example |
|------|-------------|---------|
| Conversion | Custom conversion | `checkout-completed` |
| Performance | Custom numeric | `page-load-time-ms` |
| Engagement | Custom conversion | `feature-clicked` |
| Revenue | Custom numeric | `order-value` |

### Step 2: Create the Experiment

Use `create-experiment` with:
- `projectKey` and `environmentKey` -- where to run the experiment
- `name` -- descriptive name for the experiment
- `flagKey` -- the feature flag being experimented on
- `metrics` -- array of metric objects with `key` and `isGroup` fields
- `treatments` -- array of treatments, each with a `name`, `baseline` flag, and `parameters`
- `holdout` (optional) -- percentage of traffic to exclude

```json
{
  "projectKey": "my-project",
  "environmentKey": "production",
  "name": "Checkout Flow v2 Experiment",
  "flagKey": "checkout-flow-v2",
  "metrics": [
    {"key": "checkout-completed", "isGroup": false},
    {"key": "checkout-time-seconds", "isGroup": false}
  ],
  "treatments": [
    {
      "name": "Control",
      "baseline": true,
      "parameters": {
        "flagKey": "checkout-flow-v2",
        "variationId": "variation-a-id"
      }
    },
    {
      "name": "New Checkout",
      "baseline": false,
      "parameters": {
        "flagKey": "checkout-flow-v2",
        "variationId": "variation-b-id"
      }
    }
  ]
}
```

### Step 3: Start Data Collection

Use `start-experiment-iteration` to begin collecting data:

```json
{
  "projectKey": "my-project",
  "environmentKey": "production",
  "experimentKey": "checkout-flow-v2-experiment"
}
```

Optionally set `reshuffle: true` to redistribute traffic across treatments.

### Step 4: Verify

1. Use `get-experiment` to confirm the experiment is running
2. Check that all treatments are listed correctly
3. Verify metrics are attached
4. Confirm the iteration status shows as active

**Report results:**
- Experiment created and iteration started
- N treatments with M metrics configured
- Data collection is active

## Edge Cases

| Situation | Action |
|-----------|--------|
| Metric doesn't exist | Create it first with `create-metric` |
| Flag has no variations | Create flag variations before setting up treatments |
| Experiment already exists | Use `list-experiments` to find it, then `get-experiment` for details |
| Need to change metrics mid-experiment | Stop the current iteration, update, then start a new one |

## What NOT to Do

- Don't start an experiment without clearly defined metrics
- Don't stop experiments too early — wait for statistical significance
- Don't run multiple experiments on the same flag simultaneously without careful holdout design
- Don't forget to set a baseline treatment — one treatment must be marked `baseline: true`
