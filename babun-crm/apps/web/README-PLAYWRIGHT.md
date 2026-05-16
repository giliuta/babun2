# Playwright E2E Tests

End-to-end specs for the v513-v517 P0 fixes, located in `e2e/`.

## Setup

### 1. Install dependencies

From `babun-crm/apps/web/`:

```bash
npm install
npm run e2e:install
```

`e2e:install` downloads the Chromium browser binary used by all specs.
If you only need Chromium (the default project), you can also run:

```bash
npx playwright install chromium
```

### 2. Environment

By default the tests run against **https://babun.app** (production).
To run against a local dev server:

```bash
BABUN_E2E_BASE_URL=http://localhost:3001 npm run e2e
```

Start the dev server first in a separate terminal:

```bash
npm run dev
```

### 3. Test credentials

Most specs use the shared AirFix test account:

| Field    | Value                        |
| -------- | ---------------------------- |
| Email    | anubis0027.traf@gmail.com    |
| Password | Emergent                     |

## Running the tests

```bash
# All specs (headless)
npm run e2e

# Headed (visible browser window) — set PWHEADED=1
PWHEADED=1 npm run e2e

# Single spec
npx playwright test e2e/register.spec.ts

# Show HTML report after a run
npx playwright show-report
```

## Spec inventory

| File                    | Scenario                                          | Status  |
| ----------------------- | ------------------------------------------------- | ------- |
| `register.spec.ts`      | Submit disabled without terms checkbox (runs)     | active  |
| `register.spec.ts`      | Happy-path registration redirect                  | skipped |
| `inline-client.spec.ts` | Inline client create → persists in /clients       | active  |
| `onboarding.spec.ts`    | Onboarded tenant: no first-run reprompt           | active  |
| `onboarding.spec.ts`    | Fresh tenant: first-run once then gone            | skipped |
| `empty-state.spec.ts`   | Personal tab CTA: «Добавить событие»              | skipped |
| `empty-state.spec.ts`   | Team tab CTA: «Добавить первую запись»            | skipped |
| `close-confirm.spec.ts` | Empty form: X closes silently                     | active  |
| `close-confirm.spec.ts` | Dirty form: X shows confirm with red button       | active  |

### Why some tests are skipped

Tests marked `.skip` require one of the following infrastructure pieces that
are not yet available:

- **Test-only sign-up endpoint / tenant factory** — needed for the register
  happy-path and the fresh-tenant onboarding spec. Without it every run
  would create a real Supabase user in production, polluting the database.
- **Zero-appointment test tenant** — needed for the empty-state CTA specs.
  The shared AirFix account has existing appointments so
  `<CalendarEmptyState>` never renders for it.

When these are ready, remove the `.skip` calls and update this table.

## Configuration

`playwright.config.ts` at the root of `babun-crm/apps/web/`:

- **Browser**: Chromium only (headless by default)
- **Base URL**: `BABUN_E2E_BASE_URL` env var, defaults to `https://babun.app`
- **Retries**: 1 in CI, 0 locally
- **Artifacts**: screenshot + video on failure, trace on first retry
