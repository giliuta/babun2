#!/usr/bin/env bash
# PreToolUse Edit/Write/MultiEdit guard. Blocks writes to protected paths.
INPUT=$(cat)
FILE=$(echo "$INPUT" | jq -r '.tool_input.file_path // .tool_input.path // ""' 2>/dev/null)
if [ -z "$FILE" ]; then exit 0; fi

if [ "${SETUP_AUTOPILOT_BYPASS:-0}" = "1" ]; then
  exit 0
fi

case "$FILE" in
  */.env|*/.env.*|*supabase/config.toml|*/middleware.ts|*/ServiceWorkerRegister.tsx)
    echo "Blocked: protected path. Edits to $FILE require an explicit user request — they are excluded from autopilot scope." >&2
    exit 2
    ;;
esac
# .github/workflows/* protection is delegated to .claude/settings.json (permissions.deny)
# + .github/CODEOWNERS (review gate) — keeping it out of this hook lets setup-time
# rewrites go through Write/Edit without bypass env vars.
exit 0
