import { QueryClient } from "@tanstack/react-query";

// Client-side data layer (replaces Next.js RSC server loads). Sits on top of
// the @babun/shared repositories; Phase 2 wires offline cache + sync under it.
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: 2,
      refetchOnWindowFocus: false,
    },
  },
});
