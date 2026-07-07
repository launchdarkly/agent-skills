# Classification Schema & Handoff Brief

This defines the fields the triage skill produces. The **classification** is shared by both artifacts (PR comment and brief). The **structured brief** is the machine-readable handoff consumed by [launchdarkly-pr-flag-apply](../../launchdarkly-pr-flag-apply/SKILL.md).

Keep the brief stable and labeled — the apply step parses it. Never leave a required field blank; write `none` or `N/A` explicitly so the next step can tell you checked rather than forgot.

## Classification fields

| Field | Values |
|-------|--------|
| `pr_type` | `feature` \| `bugfix` \| `refactor` \| `config_change` \| `dependency_update` \| `infrastructure` \| `test_only` \| `documentation` |
| `risk_level` | `low` \| `medium` \| `high` |
| `change_scope` | `single_file` \| `few_files` \| `cross_cutting` \| `monolithic` |
| `primary_domain` | `frontend-ui` \| `frontend-library` \| `backend-api` \| `backend-service` \| `database` \| `infrastructure` \| `testing` |
| `change_patterns` | any of: `new_component`, `new_endpoint`, `modified_business_logic`, `api_contract_change`, `database_migration`, `feature_flag_addition`, `feature_flag_removal`, `refactor_extract`, `refactor_restructure`, `ui_copy_change`, `ui_visual_change`, `default_behavior_change` |
| `has_user_facing_behavior_change` | `true` \| `false` |

Treat changes touching auth, billing, migrations, or PII as at least `medium` risk by default.

## Structured brief (the handoff)

Emit this as your final machine-facing artifact. YAML is a convenient shape; the exact serialization matters less than the field names being present and labeled.

```yaml
classification:
  pr_type: <...>
  risk_level: <low|medium|high>
  change_scope: <...>
  primary_domain: <...>
  change_patterns: [<...>]
  has_user_facing_behavior_change: <true|false>

flag_decision:
  ancestor_flag_analysis: |
    Required for every PR. Each ancestor flag key, its current state (rollout %, targeting),
    whether it is a rollout flag or a permanent config/entitlement flag, and how that factors
    into the decision. If none: "No ancestor flag — change reaches production unguarded."
  flag_worthy: <true|false>
  flag_worthy_justification: |
    Required either way. Name (a) the rubric bucket, (b) the ancestor-flag context
    (key + state, or "none"), and (c) why that combination resolves to the chosen answer.
  flag_key_suggestion: <verb-descriptive-name, e.g. enable-team-usage; or "N/A" when not flagging>
  intent_summary: |
    1-3 sentences: what the PR accomplishes and old-vs-new behavior, so the implementer can
    choose the right forking strategy (gate a whole new path / switch a default / toggle a param).
  files_to_modify:            # only when flag_worthy=true; else "N/A"
    - file: <path>
      functions: [<...>]
      line_range: <start-end>
      wrap_note: <where to read the flag and how to thread the decision through>
  existing_patterns_found: |
    The SDK evaluation pattern this codebase already uses near the changed code (wrapper,
    constants file, direct variation calls), so the implementer matches it.
  risks: |
    Edge cases, multi-language concerns, frontend+backend spanning (one flag must gate both
    sides consistently). "none" if truly none.

test_brief:
  untested_production_files: [<paths, excluding pure style files>]
  test_patterns_nearby: <framework, assertion style, file naming>
  suggested_test_focus: |
    Which behavior changes and edge cases need coverage. If flag_worthy=true, include
    flag-on vs flag-off coverage of the wrapped paths.

review_brief:
  areas_of_concern:
    - file: <path>
      lines: <range>
      concern: <what to read carefully>
  complexity_hotspots: [<functions with high branching / deep nesting>]
  error_handling_gaps: [<places where error paths may be missing>]

research_context:
  code_paths: <what changed and who calls it>
  consumers: <downstream files depending on changed interfaces>
  blast_radius: <directly changed vs transitively affected>
  uncertainty: [<things you could not determine>]
```

## Routing signal

If your pipeline gates downstream steps on the decision, emit a single explicit signal alongside the brief so the orchestrator doesn't have to parse prose — for example a `skip_flagging: true|false` field (and, when skipping, a short reason: `rubric_skip` \| `ancestor_protected`). How you transport that signal (a tag, an output variable, a status field) is up to your runner; the apply step only needs `flag_worthy` and the `flag_*` fields above.
