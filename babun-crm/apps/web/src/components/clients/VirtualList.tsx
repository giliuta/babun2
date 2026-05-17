"use client";

// clients-99 F2.11 — virtualized list for /dashboard/clients.
//
// Kicks in when the filtered set exceeds VIRTUAL_THRESHOLD (≈80
// clients). Below the threshold the parent renders a plain map() so
// scroll restoration on iOS Safari keeps working for small tenants.
//
// The caller owns renderRow — it carries every handler + state it
// needs from the page scope. This component only handles position +
// size measurement.

import { useVirtualizer } from "@tanstack/react-virtual";
import type { ReactNode, RefObject } from "react";
import type { Client } from "@babun/shared/local/clients";

export const VIRTUAL_THRESHOLD = 80;

interface Props {
  items: ReadonlyArray<Client>;
  /** The outer scroll container (same one the rest of the page scrolls in). */
  scrollRef: RefObject<HTMLDivElement | null>;
  renderRow: (client: Client) => ReactNode;
  /** Best-guess row height in px; the virtualizer self-corrects via measureElement. */
  estimatedRowHeight?: number;
}

export function VirtualList({
  items,
  scrollRef,
  renderRow,
  estimatedRowHeight = 110,
}: Props) {
  const virtualizer = useVirtualizer({
    count: items.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => estimatedRowHeight,
    overscan: 6,
    // Stable identity per client so re-orders (pinned toggle) don't
    // remount cards.
    getItemKey: (i) => items[i]?.id ?? i,
  });

  const virtualItems = virtualizer.getVirtualItems();
  const totalSize = virtualizer.getTotalSize();

  return (
    <div
      style={{ height: totalSize, position: "relative", width: "100%" }}
      aria-label={`Список клиентов (${items.length})`}
    >
      {virtualItems.map((vi) => {
        const client = items[vi.index];
        if (!client) return null;
        return (
          <div
            key={client.id}
            data-index={vi.index}
            ref={virtualizer.measureElement}
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              width: "100%",
              transform: `translateY(${vi.start}px)`,
              paddingBottom: 8, // matches space-y-2 in the non-virtual branch
            }}
          >
            {renderRow(client)}
          </div>
        );
      })}
    </div>
  );
}
