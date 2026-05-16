#!/usr/bin/env bash
# SessionStart hook — inject branch, active story, last CI status into context.
set -e
PROJECT_ROOT="${CLAUDE_PROJECT_DIR:-$(pwd)}"
cd "$PROJECT_ROOT" 2>/dev/null || true

BRANCH=$(git branch --show-current 2>/dev/null || echo "unknown")
STORY=$(ls docs/stories/STORY-*.md 2>/dev/null | tail -1 | sed 's|.*/||')
LAST_CI="(gh not configured)"
if command -v gh >/dev/null 2>&1; then
  LAST_CI=$(gh run list --limit 1 --json status,conclusion,name 2>/dev/null --jq '.[0]' || echo "(no runs)")
fi

# Use printf+jq to safely build JSON so quotes/newlines don't break it.
CONTEXT=$(printf "Branch: %s\nActive story: %s\nLast CI: %s\nReminder: master is protected; push to story/* only." \
  "$BRANCH" "${STORY:-none}" "$LAST_CI")

jq -n --arg ctx "$CONTEXT" '{additionalContext: $ctx}' 2>/dev/null || printf '{"additionalContext": "%s"}\n' "$CONTEXT"
