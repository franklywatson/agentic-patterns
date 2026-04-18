---
name: savings
description: "Report rtk and jcodemunch token savings for the current session."
argument-hint: ""
user-invocable: true
---

<!-- rig-generated -->

# savings — Session Savings Report

Report token savings from rtk and jcodemunch usage during this session.

## Procedure

1. Run `rtk gain --format json` to get current savings data. If rtk is not
   available, skip rtk reporting.
2. Find the session cache file: `ls /tmp/rig-session-*.json`. Read the most
   recent one (by modification time). It contains `metricsBaseline`,
   `metricCounters` (rtkCalls, jmCalls, efficientCalls), and `environment`
   (rtkAvailable, jcodemunchAvailable).
3. Compute the rtk session delta: `current total_saved - baseline totalSaved`.
4. For jcodemunch: call `mcp__jcodemunch__get_session_stats` and read
   `session_tokens_saved`, `session_calls`, `total_tokens_saved`, and
   `tool_breakdown` directly. These are reliable per-session counters
   maintained by the MCP server process. If jcodemunch MCP is not available,
   skip jcodemunch reporting.
5. Format and print the report (see Output Format below). Do NOT write any
   explanatory text before or after the report — output ONLY the report lines.

## Output Format

With session data (baseline + delta available):

```
[rig] Session Savings
  rtk: X.XM saved (N calls, +XK this session)
  jcodemunch: XK saved (N queries, 150M total all-time)
```

Without session data (no cache file found):

```
[rig] Session Savings (all-time)
  rtk: X.XM saved (N commands, XX.X% avg savings)
```

If rtk is not installed:

```
[rig] Session Savings
  rtk: not installed
```

## Formatting Rules

- Format token counts: >=1M as `X.XM`, >=1K as `XK`, else raw number.
- Round percentages to 1 decimal.
- jcodemunch `session_tokens_saved` and `session_calls` come directly from
  `get_session_stats`. `total_tokens_saved` is the all-time cumulative.
- Output the report and nothing else.
