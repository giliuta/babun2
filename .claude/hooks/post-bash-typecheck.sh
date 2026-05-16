#!/usr/bin/env bash
# PostToolUse Bash hook — placeholder for typecheck-on-commit gating.
# Intentionally a no-op for now; real gate lives in the Stop hook + husky pre-commit
# to avoid running slow tsc on every individual bash invocation.
exit 0
