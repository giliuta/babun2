// Re-export of the generated Database type so apps/web imports stay
// stable. The source of truth lives in packages/shared (regenerated
// via `npm run db:types`).

export type { Database, Json } from "@babun/shared/db/database.types";
