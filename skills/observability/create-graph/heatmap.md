# Heatmap creation

Load this file only when building a heatmap graph via `create-graph` or `preview-graph`. Heatmaps require three session-specific parameters that no other chart type needs; without all three, the heatmap renders empty.

## Required heatmap parameters

```
type: "Heatmap"
heatmap_secure_session_id: <secure_id of a session that visited the target page>
heatmap_session_timestamp: <ISO 8601, e.g. "2026-03-09T17:15:50.522Z">
query: url="*<path>*"    (e.g. url="*/traces*", url="*/dashboards*")
```

Without **all three** of `heatmap_secure_session_id`, `heatmap_session_timestamp`, and a URL-path `query`, the heatmap will be empty.

## Finding the session and timestamp

1. **Find a session that visited the target page.** Use `query-sessions`:
   ```
   query="visited-url=*/traces*"
   ```
   with a reasonable time window. Any session that visited the page works; pick one that's reasonably recent.

2. **Get the exact Navigate timestamp.** Use `query-timeline-events` on the matching session, filter for the Navigate event targeting the page you care about. The event carries the millisecond-epoch timestamp.

3. **Convert the epoch timestamp to ISO 8601** for the `heatmap_session_timestamp` parameter:
   - Input: `1741540550522` (ms since epoch)
   - Output: `"2026-03-09T17:15:50.522Z"`

## URL-path query format

The `query` for a heatmap uses wildcard path matching:
- `url="*/traces*"` — matches any URL with `/traces` in the path
- `url="*/dashboards*"` — matches any URL with `/dashboards` in the path
- Wildcards (`*`) on both sides are important — exact-match without wildcards often misses pages.

## Common mistakes

- Omitting the `query` parameter because other chart types don't need it. Heatmaps DO need it.
- Using a bare epoch timestamp for `heatmap_session_timestamp`. Must be ISO 8601 with milliseconds.
- Picking a session that didn't actually visit the target page. Confirm via `query-timeline-events` before committing.
- Using the session's `created_at` as the timestamp. That's when the session started, not when the user reached the target page.
