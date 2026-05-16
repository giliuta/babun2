#!/usr/bin/env bash
# Stop hook — pings Telegram if the last assistant message contains a known
# failure / completion marker. Requires TG_BOT_TOKEN and TG_CHAT_ID env vars.
INPUT=$(cat)
TRANSCRIPT_PATH=$(echo "$INPUT" | jq -r '.transcript_path // ""' 2>/dev/null)
if [ -z "$TRANSCRIPT_PATH" ] || [ ! -f "$TRANSCRIPT_PATH" ]; then exit 0; fi

LAST_LINE=$(tail -1 "$TRANSCRIPT_PATH" 2>/dev/null | jq -r '.message.content[0].text // empty' 2>/dev/null | head -c 1000)
[ -z "$LAST_LINE" ] && exit 0

if echo "$LAST_LINE" | grep -qE 'SECURITY_BLOCK|PERF_BLOCK|BUGS_FOUND|gate failed|Auto-reverted|READY_TO_MERGE'; then
  if [ -n "$TG_BOT_TOKEN" ] && [ -n "$TG_CHAT_ID" ]; then
    SNIPPET=$(echo "$LAST_LINE" | head -c 400)
    curl -sS -X POST "https://api.telegram.org/bot${TG_BOT_TOKEN}/sendMessage" \
      -d "chat_id=${TG_CHAT_ID}" \
      -d "parse_mode=Markdown" \
      --data-urlencode "text=*Babun autopilot:* ${SNIPPET}" >/dev/null 2>&1 || true
  fi
fi
exit 0
