# Install LaunchDarkly AI Config Skills

Install all AI Config skills from the development branches.

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

Create an AI config called "customer-support-agent" in the project "default"
with two variations:
- "standard": uses gpt-4o-mini with a helpful customer service prompt
- "premium": uses gpt-4o with a more detailed, personalized prompt
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
