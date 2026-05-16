#!/usr/bin/env bash
# PreToolUse guard for mcp__supabase__execute_sql. Blocks destructive SQL via MCP.
INPUT=$(cat)
SQL=$(echo "$INPUT" | jq -r '.tool_input.query // .tool_input.sql // ""' 2>/dev/null)
if [ -z "$SQL" ]; then exit 0; fi

if echo "$SQL" | grep -qiE 'drop table|truncate|delete from [a-z_]+ *(;|$|where 1=1)'; then
  echo "Blocked: destructive SQL via MCP. Use a versioned migration in babun-crm/supabase/migrations/." >&2
  exit 2
fi
exit 0
