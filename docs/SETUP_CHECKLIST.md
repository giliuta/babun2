# Setup Checklist — manual steps the autopilot can't do for you

This is the punch list. Walk top to bottom; stop at the first checkbox you can't tick. Each section calls out where to do the work and what to paste / select.

> No `ANTHROPIC_API_KEY` is required and none is referenced anywhere — the autopilot uses your Claude Code Max plan locally + cloud Routines, with the `security-auditor` agent as the mandatory pre-merge reviewer instead of a GitHub Action.

---

## 1. GitHub repository secrets

`giliuta/babun2` → **Settings** → **Secrets and variables** → **Actions** → **New repository secret**.

| Secret name | Where to get it | Required for |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase → Project `rdtokosbqvgemicqeqwz` → Settings → API → "Project URL" | CI e2e |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Same screen → "Project API keys" → `anon public` | CI e2e |
| `SUPABASE_SERVICE_ROLE_KEY` | Same screen → "Project API keys" → `service_role` (⚠ secret) | `e2e/global.setup.ts` user provisioning |
| `E2E_TEST_PASSWORD` | Generate any random string ≥ 12 chars (e.g. `openssl rand -base64 24`) | Login flow in setup |
| `VERCEL_AUTOMATION_BYPASS_SECRET` *(recommended)* | Vercel → Project `babun` → Settings → Deployment Protection → "Protection Bypass for Automation" → generate | Playwright reaching preview URLs |
| `TELEGRAM_BOT_URL` *(recommended)* | Full URL `https://api.telegram.org/bot<TOKEN>/sendMessage` from your bot | Post-deploy auto-revert pings |
| `TELEGRAM_CHAT_ID` *(recommended)* | Your chat ID (e.g. from `@userinfobot`) | Same |

- [ ] All four required secrets added
- [ ] All three recommended secrets added (or noted as deferred)

---

## 2. Vercel environment variables (production + preview)

Vercel → Project `babun` → **Settings** → **Environment Variables**.

Make sure both **Production** and **Preview** scopes have:
- [ ] `NEXT_PUBLIC_SUPABASE_URL`
- [ ] `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- [ ] All Supabase auth / SMS / Stripe vars that the app already uses (these should already be set — verify they apply to preview too)

> Don't put `SUPABASE_SERVICE_ROLE_KEY` here. It only lives in GitHub Actions for e2e seeding. The web app never needs it.

---

## 3. Vercel deployment protection

Vercel → **Project** → **Settings** → **Deployment Protection**.

- [ ] Keep deployment protection ON for previews (so random people can't hit your PR previews).
- [ ] Enable **Protection Bypass for Automation** so Playwright + the GitHub Action can reach preview URLs with the `x-vercel-protection-bypass` header. The token you generate becomes `VERCEL_AUTOMATION_BYPASS_SECRET` in step 1.

---

## 4. GitHub branch protection on `master`

`giliuta/babun2` → **Settings** → **Branches** → **Add rule** for `master`:

- [ ] Require pull request before merging
- [ ] Require status checks: `typecheck`, `test`, `e2e` (added by `ci.yml`)
- [ ] Require review from Code Owners (CODEOWNERS file already in repo)
- [ ] Do **NOT** allow force pushes
- [ ] Do **NOT** require linear history (squash merges are fine)

---

## 5. Claude Code MCP authentication

Each session needs OAuth into the HTTP MCP servers. First time only:

- [ ] `claude` (open Claude Code) → trigger any Supabase tool → follow the device-code link → consent. Token persists across sessions.
- [ ] Same for Sentry MCP → opens browser, authorize the `giliuta/babun` org.
- [ ] Same for GitHub MCP → opens browser, authorize `giliuta/babun2` only.
- [ ] Same for Vercel MCP → opens browser, authorize the `babun` project only.

After this, `mcp__supabase__list_tables`, `mcp__sentry__search_issues`, `mcp__github__list_pull_requests`, etc., work.

---

## 6. Claude Code on the web — `/install-github-app`

In any Claude Code terminal session on the repo:

- [ ] Run `claude` then type `/install-github-app`.
- [ ] Pick `giliuta/babun2`. Confirm permissions.
- [ ] This installs the GitHub App that the cloud `/schedule` Routines need to read your repo, push branches, and open PRs.

---

## 7. Cloud `/schedule` Routine

From any Claude Code session (web or CLI):

- [ ] Run `/schedule daily babun autopilot at 06:00 Europe/Nicosia`
- [ ] When prompted, choose repo `giliuta/babun2`, branch `master`, push to `story/*` allowed.
- [ ] Prompt: `Run /full-pipeline-autopilot --max-pages=3. Stop on the first red gate. Post final summary to Telegram via the stop-telegram hook.`
- [ ] Connectors: Supabase MCP, Sentry MCP, GitHub MCP, Playwright MCP.
- [ ] Env vars on the Routine: `TG_BOT_TOKEN`, `TG_CHAT_ID`, `VERCEL_BYPASS_TOKEN`, `SUPABASE_SERVICE_ROLE_KEY`, `E2E_TEST_PASSWORD` (same values as GitHub Secrets).

Plan cap: Max 20× plan = up to 15 routines/day. We only need 1 daily plus an optional hourly Sentry sweep, so headroom is fine.

---

## 8. Telegram bot for notifications

If you don't already have one:

- [ ] Talk to `@BotFather` in Telegram → `/newbot` → pick a name → copy the bot token.
- [ ] Message your new bot at least once.
- [ ] Find your chat ID via `@userinfobot` (or `https://api.telegram.org/bot<TOKEN>/getUpdates` after sending a message).
- [ ] Paste into GitHub Secrets (`TELEGRAM_BOT_URL = https://api.telegram.org/bot<TOKEN>/sendMessage`, `TELEGRAM_CHAT_ID = <id>`) and into the Routine env vars (`TG_BOT_TOKEN`, `TG_CHAT_ID`).

---

## 9. Local test setup (optional but recommended)

If you ever want to run e2e locally:

- [ ] In `babun-crm/apps/web/.env.local`, add the same `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `E2E_TEST_PASSWORD`.
- [ ] Run `cd babun-crm/apps/web && npm run e2e:install` once (downloads Chromium + WebKit, ~200 MB).
- [ ] Then `npm run e2e` to run the full suite, or `npm run e2e:smoke` for the smoke subset.

---

## 10. After everything is set up — first interactive dry run

The plan recommends starting with the lowest-risk page so you can watch the state machine end-to-end:

- [ ] In a fresh Claude Code session, run `/full-pipeline-autopilot --page=/dashboard/sms-templates` interactively.
- [ ] Watch each state marker fire (`READY_FOR_ARCH` → `READY_FOR_BUILD` → …).
- [ ] If it gets stuck or surprises you, kill it (`Ctrl-C`), tune the agent prompt in `.claude/agents/<name>.md`, retry.
- [ ] Only after this works end-to-end, enable the daily Routine.

---

## 11. Optional cleanup (any time)

- [ ] Delete the weird empty root files: `0`, `s`, `` `${n} `` — they look like accidental terminal redirect output. (D-011 in `AUTOPILOT_DEVIATIONS.md`.) Run `git rm -- 0 s '${n}` then commit.
- [ ] When ready, delete the `babun-crm/supabase/migrations/001_initial_schema.sql` draft if it's truly superseded by the apps/web migrations (D-013). Confirm with the architect first.
- [ ] Run `/audit-all-pages` once Sentry MCP is OAuth-authenticated to populate the Sentry users column in `BACKLOG.md` — final priority ranking may shift.

---

## When something feels wrong

1. Read `docs/AUTOPILOT_DEVIATIONS.md` — every place this setup deviated from the literal plan is documented there with the reason.
2. Check `.claude/hooks/*.sh` — your own hooks are the most common silent blocker.
3. Verify your Claude Code version: `claude --version`. You need ≥ 2.1.32. We installed 2.1.143.
4. Ping in chat — the autopilot is conservative by design and will stop on anything it doesn't understand rather than guess.
