---
name: aiconfig-update
description: "Update, archive, and delete LaunchDarkly AI Configs and their variations. Use when you need to modify config properties, change model parameters, update instructions or messages, archive unused configs, or permanently remove them."
license: Apache-2.0
compatibility: Requires the remotely hosted LaunchDarkly MCP server
metadata:
  author: launchdarkly
  version: "1.0.0-experimental"
---

# AI Config Update & Lifecycle

You're using a skill that will guide you through updating, archiving, and deleting AI Configs and their variations. Your job is to understand the current state of the config, make the changes, and verify the result.

## Procedure when the user mentions deletion (first message of the conversation)

If the **first** user message you are responding to contains the word "delete", "remove", "obsolete", "no longer", "retire", "decommission", "get rid of", or any equivalent — even if it also contains hedges like "probably" / "should" / "let's just", and even if it contains an apparently direct phrase like "delete it entirely" — your **only** allowed first action is:

```
call update-ai-config({ archived: true })
```

That is the entire response to the first turn. The skill never calls `delete-ai-config` or `delete-ai-config-variation` on the first turn. There is no exception. Do not "interpret intent". Do not weigh the user's tone. Archive first, always.

After archiving, your reply to the user should:
1. Confirm the config is archived (and recoverable with `archived: false`).
2. Note that archiving is the safe default and that permanent deletion is a separate, irreversible step.
3. Ask whether they want permanent deletion in a follow-up message, with the explicit phrasing "delete it permanently — I understand this is irreversible".

Only on a **subsequent** turn (i.e. after the user replies again) where the user gives that explicit phrase may you call `delete-ai-config` or `delete-ai-config-variation`.

### Why the rule is unconditional

The phrasing "delete it entirely" is the most common form of this request and is *still* covered by this rule. Real users frequently say "delete" when they mean "make it stop showing up in active lists" — archiving satisfies that intent without the irreversible cost. Anyone who actually wants permanent deletion will say so on the second turn; you will not have lost any time, and you will have saved every other user from a destructive mistake.

## Prerequisites

This skill requires the remotely hosted LaunchDarkly MCP server to be configured in your environment.

**Required MCP tools:**
- `get-ai-config-health` -- assess config health before making changes (detects missing models, orphaned tools, empty configs)
- `get-ai-config` -- understand current state before making changes
- `update-ai-config` -- update config metadata (name, description, tags, archive)
- `update-ai-config-variation` -- update variation model, prompts, or parameters

**Optional MCP tools:**
- `delete-ai-config` -- permanently delete a config (irreversible)
- `delete-ai-config-variation` -- permanently delete a variation (irreversible)

## Core Principles

1. **Fetch Before Changing**: Always check the current state before modifying
2. **Verify After Changing**: Fetch the config again to confirm updates were applied
3. **Archive Before Deleting**: Archival is reversible; deletion is not

## Workflow

### Step 0 — Always check this first (delete/remove guard)

Before anything else: scan the user's first message for any of: "delete", "remove", "obsolete", "outdated", "no longer", "retire", "decommission", "get rid of", "old config", "useless config".

If you see **any** of those words on this turn, your only legal first action is:

```
update-ai-config({ archived: true })
```

That is the entire turn. Do **not** call `delete-ai-config`. Do **not** call `delete-ai-config-variation`. Do **not** call `get-ai-config-health` or `get-ai-config` first — just archive. Do **not** ask for confirmation. The skill archives unconditionally on the first turn whenever any of those words appear, regardless of how directly the user phrased the rest of the sentence (including "delete it entirely", "delete it for good"-sounding phrases — those still archive on this turn; permanent deletion is only allowed if the user comes back with the same intent on a follow-up turn).

If you find yourself about to call `delete-ai-config` as the first tool call of this skill, you are wrong; replace it with `update-ai-config({ archived: true })`.

### Step 1: Assess Health and Understand Current State

Start with `get-ai-config-health` to get a structured health assessment. This detects:
- Variations with no model (show as "NO MODEL" in the UI)
- Variations with neither instructions nor messages
- Orphaned tool references (tools attached that don't exist in the project)
- Configs with no variations at all

The health verdict (`healthy`, `warning`, `unhealthy`) helps you prioritize what to fix.

Then use `get-ai-config` to review the full detail:
- Current mode (agent or completion)
- Existing variations and their models
- Current instructions or messages
- Attached tools and parameters

### Step 2: Make the Update

**Update config metadata** -- Use `update-ai-config`:
- Change name or description
- Add or replace tags
- Archive with `archived: true` (reversible)

**Update a variation** -- Use `update-ai-config-variation`:
- Switch model (provide new `modelConfigKey` and `modelName`)
- Change instructions or messages
- Tune parameters (temperature, max_tokens, etc.)
- Attach or detach tools via the parameters object

**Archive a config** -- Use `update-ai-config` with `archived: true`. Archiving is the **preferred** way to retire a config:
- It is reversible (unarchive with `archived: false`)
- The config is hidden from active lists but preserved
- After calling the archive, treat a successful response as confirmation and proceed to verification
- When a user says "remove", "retire", "decommission", or "no longer need", default to archiving unless they explicitly say "delete permanently"

**Delete** -- Use `delete-ai-config` or `delete-ai-config-variation` (irreversible, requires `confirm: true`). **Step 0 (the delete/remove guard) at the top of this workflow applies before this step.**

If your planned first tool call is `delete-ai-config` or `delete-ai-config-variation`, **stop**: that plan is wrong. Replace the call with `update-ai-config({ archived: true })`, run that, and end your turn. Even strong-sounding phrasings like "delete it entirely", "delete it for good", "completely obsolete", "we should just delete it" do not release the gate on the first turn. Permanent deletion is only allowed on a separate, subsequent turn where the user has explicitly acknowledged the irreversibility (e.g. "yes, delete it permanently — I understand it's gone forever").

A useful self-check before any `delete-*` tool call: "Did the user say something like 'yes, delete it permanently — I understand it's gone forever' on **this** turn? If no, archive instead."

### Step 3: Verify

Use `get-ai-config` to confirm the response shows your updated values.

**Report results:**
- Update applied successfully
- Config reflects changes
- Flag any issues or rollback if needed

## What NOT to Do

- Don't update production configs without testing in another variation first
- Don't change multiple things at once -- make incremental changes
- Don't skip verification
- Don't delete on the same turn the user first mentions deletion. Suggest archiving, explain reversibility, ask for explicit affirmation, and wait for a subsequent turn before calling any delete tool. Hedge words ("probably", "should", "let's just") and descriptive phrasings ("is obsolete", "no longer needed") are never confirmation — they're archive requests.
- Don't retry an update because the API response doesn't echo back the exact values you sent -- verify with `get-ai-config` instead

## Related Skills

- `aiconfig-variations` -- Create variations to test changes side-by-side
- `aiconfig-tools` -- Update tool attachments
