#!/usr/bin/env bash
# PreToolUse Bash guard. Exits 2 to deny when a destructive pattern is matched.
INPUT=$(cat)
CMD=$(echo "$INPUT" | jq -r '.tool_input.command // ""' 2>/dev/null)
if [ -z "$CMD" ]; then exit 0; fi

if echo "$CMD" | grep -qiE 'rm -rf|DROP TABLE|TRUNCATE|DELETE FROM [^ ]+($|[^W])|git push --force|git reset --hard origin/master'; then
  echo "Blocked by policy: destructive command pattern. Move this to a reviewed migration file." >&2
  exit 2
fi
if echo "$CMD" | grep -qiE '^supabase migration new |^pnpm supabase db push|^npm run supabase|^npx supabase '; then
  exit 0
fi
exit 0
