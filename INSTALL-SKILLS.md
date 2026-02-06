# Install LaunchDarkly AI Config Skills

Install all AI Config skills from the development branches.

## New User Quick Start

### Step 1: Get a LaunchDarkly API Key
1. Go to **Account settings > Authorization** in LaunchDarkly
2. Click **Create token** with **Writer** role
3. Add to your shell profile:
```bash
echo 'export LAUNCHDARKLY_API_KEY="api-xxx-your-key-here"' >> ~/.zshrc
source ~/.zshrc
```

### Step 2: Set Up the MCP Server
Add to `~/.claude/config.json`:
```json
{
  "mcpServers": {
    "launchdarkly": {
      "command": "npx",
      "args": ["-y", "@launchdarkly/mcp-server"],
      "env": {
        "LAUNCHDARKLY_API_KEY": "your-api-key-here"
      }
    }
  }
}
```

### Step 3: Install the Skills
```bash
git clone https://github.com/launchdarkly/agent-skills.git
cd agent-skills
git checkout scarlett/do-not-merge
./install-scarlett-skills.sh --global
```

### Step 4: Restart Claude Code

### Step 5: Use the Skills

**Just ask naturally** - Claude automatically uses the right skill:
```
"Create an AI config for a customer support chatbot"
"Set up A/B testing for my AI config"
"Add metrics tracking to my AI config"
```

Or invoke explicitly with `/skill-name`:
```
/aiconfig-create
/aiconfig-sdk
/aiconfig-targeting
```

---

## Prerequisites

### LaunchDarkly API Key

You need an API key with **write access** to use these skills:

1. Go to **Account settings > Authorization** in LaunchDarkly
2. Click **Create token**
3. Give it a name (e.g., "AI Config Skills")
4. Select a role with write permissions:
   - **Writer** role for full access, or
   - **Custom role** with `createAIConfig`, `updateAIConfig`, `deleteAIConfig` actions
5. Copy the token and set it as an environment variable:

```bash
export LAUNCHDARKLY_API_KEY="api-xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
```

Or add to your shell profile (`~/.zshrc` or `~/.bashrc`) for persistence.

### LaunchDarkly MCP Server

Some skills require the LaunchDarkly MCP server. Add to your Claude config:

```json
{
  "mcpServers": {
    "launchdarkly": {
      "command": "npx",
      "args": ["-y", "@launchdarkly/mcp-server"],
      "env": {
        "LAUNCHDARKLY_API_KEY": "your-api-key-here"
      }
    }
  }
}
```

---

## Quick Start

```bash
git clone https://github.com/launchdarkly/agent-skills.git
cd agent-skills
git checkout scarlett/do-not-merge
./install-scarlett-skills.sh
```

### Installation Options

```bash
# Interactive prompt (asks global vs local)
./install-scarlett-skills.sh

# Install globally (available in all projects)
./install-scarlett-skills.sh --global

# Install locally (current project only)
./install-scarlett-skills.sh --local
```

---

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

**Total: 16 skills**

---

## Test Cases

After installation, try these test cases to verify the skills work correctly.

### Test Case 1: Create a Basic AI Config

```
/aiconfig-create

Create an AI config called "test-basic-config" in the project "support-ai"
with two variations:
- "standard": uses gpt-4o-mini with a helpful customer service prompt
- "premium": uses gpt-4o with a more detailed, personalized prompt
```

**Expected UI Verification:**

Navigate to: `https://app.launchdarkly.com/projects/support-ai/ai-configs/test-basic-config`

| Item | Expected |
|------|----------|
| **AI Config** | `test-basic-config` |
| **Mode** | Agent |
| **Variations** | 2 |

**Step-by-step verification:**

1. Click on **Variations** tab
2. You should see `standard` and `premium` variations listed
3. **Click on `standard` variation** to expand/edit it
4. Verify:
   - Model: `gpt-4o-mini`
   - Temperature: `0.7`
   - Max Tokens: `1000`
5. **Click on `premium` variation** to expand/edit it
6. Verify:
   - Model: `gpt-4o`
   - Temperature: `0.8`
   - Max Tokens: `2000`

**If model or parameters are missing:**

The model and parameters must be set on each variation. If they appear empty in the UI:

```bash
# Verify via API
curl -s "https://app.launchdarkly.com/api/v2/projects/support-ai/ai-configs/test-basic-config" \
  -H "Authorization: $LAUNCHDARKLY_API_KEY" | python3 -c "
import sys, json
data = json.load(sys.stdin)
for v in data.get('variations', []):
    print(f\"{v['key']}: {v.get('model', {}).get('modelName', 'MISSING')} - {v.get('model', {}).get('parameters', 'MISSING')}\")"

# Fix via PATCH if needed
curl -X PATCH "https://app.launchdarkly.com/api/v2/projects/support-ai/ai-configs/test-basic-config/variations/standard" \
  -H "Authorization: $LAUNCHDARKLY_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"model": {"name": "openai", "modelName": "gpt-4o-mini", "parameters": {"temperature": 0.7, "maxTokens": 1000}}}'
```

### Test Case 2: Multi-Tool Agent with Function Calling

```
/aiconfig-create

Create an AI config called "order-lookup-agent" with:
- Model: gpt-4o
- Agent mode enabled
- Three tools:
  1. get_order_status(order_id: string) - looks up order status
  2. get_customer_info(customer_id: string) - retrieves customer details
  3. create_support_ticket(subject: string, priority: "low"|"medium"|"high") - creates a ticket
- System prompt that instructs the agent to help customers with order inquiries
```

**Expected UI Verification:**

Navigate to: `https://app.launchdarkly.com/projects/support-ai/ai-configs/order-lookup-agent`

| Item | Expected |
|------|----------|
| **AI Config** | `order-lookup-agent` |
| **Mode** | Agent |
| **Variations** | 1 |

| Variation | Model | Tools Attached |
|-----------|-------|----------------|
| `default` | gpt-4o | 3 tools |

**Tools (verify in AI Config > Variation > Tools section):**

| Tool Key | Description |
|----------|-------------|
| `get_order_status` | Looks up order status |
| `get_customer_info_v2` | Retrieves customer details |
| `create_support_ticket` | Creates support ticket |

**Tools in Project** (navigate to: AI Configs > Tools):

| Tool | Schema |
|------|--------|
| `get_order_status` | `order_id: string` (required) |
| `get_customer_info_v2` | `customer_id: string` (required) |
| `create_support_ticket` | `subject: string`, `priority: enum[low,medium,high]` (required) |

### Test Case 3: A/B Test with Targeting Rules

```
/aiconfig-create

Create an AI config called "product-recommender" with:
- Variation A: claude-3-5-sonnet, temperature 0.7, creative recommendations
- Variation B: gpt-4o-mini, temperature 0.3, conservative recommendations

Then use /aiconfig-targeting to:
- Serve variation A to users in segment "beta-testers"
- Split remaining traffic 50/50 between variations
```

**Expected UI Verification:**

Navigate to: `https://app.launchdarkly.com/projects/support-ai/ai-configs/product-recommender`

| Item | Expected |
|------|----------|
| **AI Config** | `product-recommender` |
| **Mode** | Completion |
| **Variations** | 2 (plus disabled) |

| Variation | Model | Temperature | Max Tokens |
|-----------|-------|-------------|------------|
| `variation-a` | claude-3-5-sonnet | 0.7 | 1000 |
| `variation-b` | gpt-4o-mini | 0.3 | 800 |

**Segment** (navigate to: Segments > production):

| Segment Key | Name |
|-------------|------|
| `beta-testers` | Beta Testers |

**Targeting** (navigate to: AI Config > Targeting > production):

| Rule | Condition | Serves |
|------|-----------|--------|
| Rule 1 | Segment match: `beta-testers` | (see note) |
| Default | Fallthrough | 50% variation-a, 50% variation-b |

> **Note:** There is a known limitation where `addRule` with `variationId` may not properly assign the variation. Verify the fallthrough rollout is set to 50/50.

### Test Case 4: Full Agent Workflow with Metrics

```
/aiconfig-create

Create a sophisticated AI config called "sales-assistant" with:
- Agent mode with max 5 tool calls
- Tools for: search_products, check_inventory, calculate_discount, create_quote
- Three variations targeting different customer tiers (basic, pro, enterprise)
- Each variation uses progressively more capable models

Then:
1. Use /aiconfig-sdk to integrate it into a Python application
2. Use /aiconfig-ai-metrics to add token and latency tracking
3. Use /aiconfig-custom-metrics to track "quotes_generated" and "conversion_rate"
```

**Expected UI Verification:**

Navigate to: `https://app.launchdarkly.com/projects/support-ai/ai-configs/sales-assistant`

| Item | Expected |
|------|----------|
| **AI Config** | `sales-assistant` |
| **Mode** | Agent |
| **Variations** | 3 |

| Variation | Model | Tools | Max Tokens |
|-----------|-------|-------|------------|
| `basic-tier` | gpt-4o-mini | 2 | 500 |
| `pro-tier` | gpt-4o | 4 | 1000 |
| `enterprise-tier` | claude-3-5-sonnet | 4 | 2000 |

**Tools per Variation:**

| Variation | Tools Attached |
|-----------|----------------|
| `basic-tier` | `search_products`, `check_inventory` |
| `pro-tier` | `search_products`, `check_inventory`, `calculate_discount`, `create_quote` |
| `enterprise-tier` | `search_products`, `check_inventory`, `calculate_discount`, `create_quote` |

**Tools in Project** (navigate to: AI Configs > Tools):

| Tool Key | Description |
|----------|-------------|
| `search_products` | Search product catalog |
| `check_inventory` | Check inventory levels |
| `calculate_discount` | Calculate discount |
| `create_quote` | Create sales quote |

**Custom Metrics** (navigate to: Metrics):

| Metric Key | Name | Type | Unit |
|------------|------|------|------|
| `quotes-generated` | Quotes Generated | Custom (numeric) | count |
| `conversion-rate` | Conversion Rate | Custom (numeric) | percent |

### Test Case 5: Context-Aware Personalization

```
/aiconfig-context-basic

Create a context for a B2B scenario with:
- Organization context with subscription tier and industry
- User context with role and permissions
- Device context for mobile vs desktop

Then use /aiconfig-targeting to:
- Serve different model configurations based on organization tier
- Adjust token limits based on subscription level
- Use lighter models for mobile contexts
```

**Expected UI Verification:**

This test case generates **SDK-side code patterns** for building contexts. There is no direct UI verification - the skill provides Python code examples for:

- Single-context creation (`Context.builder()`)
- Multi-context creation (`Context.multi_builder()`)
- Context attributes for targeting

**Verify SDK Key is retrievable** (navigate to: Project Settings > Environments):

| Environment | SDK Key Format |
|-------------|----------------|
| `production` | `sdk-xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx` |
| `test` | `sdk-xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx` |

### Test Case 6: Complex Segment-Based Rollout

```
/aiconfig-segments

Create segments for:
1. "enterprise-customers" - organizations with plan = "enterprise"
2. "ai-power-users" - users with ai_requests_30d > 100
3. "new-users" - users created in last 7 days

Then use /aiconfig-targeting to create a rollout:
- Enterprise customers: full access to gpt-4o
- AI power users: gpt-4o with rate limiting
- New users: gpt-4o-mini only (gradual rollout 10% -> 50% -> 100%)
```

**Expected UI Verification:**

Navigate to: Segments > production (`https://app.launchdarkly.com/support-ai/production/segments`)

| Segment Key | Name | Description |
|-------------|------|-------------|
| `enterprise-customers` | Enterprise Customers | Organizations with enterprise plan |
| `ai-power-users` | AI Power Users | Users with high AI usage |
| `new-users` | New Users | Users created in the last 7 days |

**Segment Rules (click each segment to verify):**

| Segment | Rule |
|---------|------|
| `enterprise-customers` | `plan` in `["enterprise"]` |
| `ai-power-users` | `ai_requests_30d` > `100` |
| `new-users` | (no rules - manually managed or time-based) |

**Also verify these segments exist:**

| Segment Key | Name |
|-------------|------|
| `beta-testers` | Beta Testers (from Test Case 3) |

---

## Custom Install Location

Override the default location with an environment variable:

```bash
CLAUDE_SKILLS_DIR=~/my-custom-path ./install-scarlett-skills.sh --global
```

---

## Troubleshooting

### "API key not found" errors
Make sure `LAUNCHDARKLY_API_KEY` is set in your environment.

### "Permission denied" errors
Your API key needs write permissions. Check the role assigned to your token.

### Skills not appearing
Restart Claude Code after installing skills. Run `/help` to see available commands.

---

## Note

These skills are from development branches and may change before being merged to main.
