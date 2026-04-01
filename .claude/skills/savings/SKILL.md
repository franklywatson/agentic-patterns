---
name: savings
description: "Report rtk and jcodemunch token savings for the current session."
argument-hint: ""
user-invocable: true
---

# savings — Session Savings Report

Report token savings from rtk and jcodemunch usage during this session.

## Procedure

1. Run `rtk gain --format json` to get current savings data. If rtk is not
   available, skip rtk reporting.
2. Run `cat .rig-session.json 2>/dev/null` to read the session baseline and
   counters written by the hooks. If the file does not exist, report all-time
   totals instead of session deltas.
3. Compute the session delta: `current total_saved - baseline totalSaved`.
4. Format and print the report (see Output Format below). Do NOT write any
   explanatory text before or after the report — output ONLY the report lines.

## Output Format

With session data (baseline + delta available):

```
[rig] Session Savings
  rtk: 6.4M saved (42 calls, +340K this session)
  jcodemunch: 28 queries
```

Without session data (all-time totals only):

```
[rig] Session Savings (all-time)
  rtk: 6.4M saved (3114 commands, 9.0% avg savings)
```

If rtk is not installed:

```
[rig] Session Savings
  rtk: not installed
```

## Formatting Rules

- Format token counts: >=1M as `X.XM`, >=1K as `XK`, else raw number.
- Round percentages to 1 decimal.
- Output the report and nothing else.
