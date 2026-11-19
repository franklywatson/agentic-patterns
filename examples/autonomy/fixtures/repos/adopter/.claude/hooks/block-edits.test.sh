#!/bin/sh
# Test: the hook denies a governance edit and allows a source edit.
set -e
if echo '{"tool_input":{"file_path":"CODEOWNERS"}}' | sh .claude/hooks/block-edits.sh 2>/dev/null; then
  echo "expected the hook to deny CODEOWNERS" >&2
  exit 1
fi
echo '{"tool_input":{"file_path":"src/app.ts"}}' | sh .claude/hooks/block-edits.sh
