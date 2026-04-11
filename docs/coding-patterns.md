# Coding Patterns — Babun2

## TypeScript
- **Strict mode ON.** `any` is forbidden. If a type is hard, write an interface.
- **Named exports** for components, default exports only for pages (`app/**/page.tsx`) where Next requires them.
- **Type imports** with `import type {...}` where possible — helps tree-shaking.
- **No `ts-ignore`**, no `@ts-expect-error` without a comment explaining why.

```ts
// ✅ Good
import type { Appointment } from "@/lib/appointments";
export function formatStart(apt: Appointment): string { ... }

// ❌ Bad
export default function formatStart(apt: any): any { ... }
```

## State persistence (localStorage phase)

Every `lib/*.ts` data file exposes the same shape:

```ts
const STORAGE_KEY = "babun-{entity}";

export function load{Entity}(): Entity[] {
  if (typeof window === "undefined") return DEFAULT_{ENTITY};
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_{ENTITY};
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) && parsed.length > 0 ? parsed : DEFAULT_{ENTITY};
  } catch {
    return DEFAULT_{ENTITY};
  }
}

export function save{Entity}(list: Entity[]): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
  } catch {
    // ignore quota errors
  }
}
```

**Why:** uniform API makes future Supabase swap trivial — just replace bodies, keep signatures.

## Context providers

`src/app/dashboard/layout.tsx` is the ONE place that wires all contexts. When you add a new entity:

1. Add `load`/`save` helpers in a `lib/{entity}.ts`
2. Create a `{Entity}Context` in `layout.tsx` with `{entities}, set{Entities}, upsert{Entity}, delete{Entity}` shape
3. Wire the provider in the nested JSX (they're deeply nested — append inside existing stack)
4. Export a `use{Entity}()` hook

Do NOT create per-page contexts. One shared provider tree = one shared view.

## Components

```tsx
// ✅ Named export, typed props interface, Tailwind only
interface AppointmentBlockProps {
  appointment: Appointment;
  hourHeight?: number;  // optional with default
  onClick: (apt: Appointment) => void;
}

export default function AppointmentBlock({
  appointment,
  hourHeight = 60,
  onClick,
}: AppointmentBlockProps) {
  return (
    <button
      onClick={() => onClick(appointment)}
      className="absolute left-0.5 right-0.5 rounded-sm hover:brightness-110"
    >
      {appointment.time_start}
    </button>
  );
}
```

**Rules:**
- Max 400 lines per file. Split sub-components into private functions in the same file or move to `components/{area}/`.
- Props interface is typed, optional props have defaults.
- Event handlers use `handle{Event}` naming.
- No inline objects in JSX unless trivial — memo via `useMemo` if it matters.

## Styling

- **Tailwind v4** only. No CSS modules, no styled-components, no `.css` files (except `globals.css`).
- Use `lg:` breakpoint for desktop, everything else mobile-first.
- `bg-indigo-700` for primary brand color, `emerald-500` for success, `red-500` for danger, `amber-400` for incomplete.
- Safe-area on fixed/sticky elements: `style={{ bottom: "calc(env(safe-area-inset-bottom) + 0.25rem)" }}`

## Next.js 16 gotchas (read `babun-crm/apps/web/AGENTS.md`)

- `useSearchParams()` is sync in 14, async-capable in 16 — check the docs inside `node_modules/next/dist/docs/` before assuming.
- `cookies()`, `headers()` are now async — `await cookies()`
- App Router is default, no `pages/` directory
- Metadata API stays the same

## API Routes (when we add them with Supabase)

```ts
// app/api/clients/route.ts
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data, error } = await supabase.from("clients").select("*");

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}
```

**Never pass `tenant_id` from the client.** RLS + JWT claim handles isolation.

## Supabase RLS (when we migrate — STORY-001)

```sql
-- Every table MUST have tenant_id + RLS
ALTER TABLE clients ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant isolation" ON clients
  FOR ALL USING (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid);
```

## Error handling

```ts
// ✅ Explicit, recoverable
try {
  const data = JSON.parse(raw);
  return Array.isArray(data) ? data : DEFAULTS;
} catch {
  return DEFAULTS;
}

// ✅ Propagate with context
if (error) {
  throw new Error(`Failed to fetch clients: ${error.message}`);
}

// ❌ Swallow silently
try { doThing(); } catch (e) { /* nothing */ }
```

## Naming

| What | Style | Example |
|---|---|---|
| Components | PascalCase | `ClientCard.tsx` |
| Utilities, hooks | camelCase | `formatCurrency.ts`, `useAppointments.ts` |
| Types, interfaces | PascalCase | `type ClientWithAppointments` |
| DB columns (future) | snake_case | `first_contact_date` |
| Route folders | kebab-case | `app/dashboard/sms-templates/` |
| localStorage keys | kebab-case with `babun-` prefix | `babun-appointments` |
| Context names | `{Entity}Context` + `use{Entity}` hook | `ClientsContext`, `useClients()` |

## Commits

```
feat: add client acquisition source field
fix: iOS pinch-zoom didn't forward to JS
refactor: replace HTML5 drag with dnd-kit
docs: add architecture.md
chore: bump SW cache to v14
```

- Imperative mood, lowercase type prefix
- One logical change per commit
- Body explains WHY when not obvious from diff

## When in doubt
- Read the existing file in the same folder — match its style
- Check `.reference/nextcrm/` for Next 16 + shadcn patterns
- Check `.reference/calcom/packages/lib/availability.ts` for scheduling logic
- Don't invent new patterns when an established one exists
