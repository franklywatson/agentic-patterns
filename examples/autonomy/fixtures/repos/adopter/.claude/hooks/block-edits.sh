#!/bin/sh
# Deny edits to governance files.
input=$(cat)
case "$input" in
  *.autonomy.yaml*|*CODEOWNERS*) echo "governance file" >&2; exit 2 ;;
esac
exit 0
