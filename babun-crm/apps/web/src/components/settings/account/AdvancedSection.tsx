"use client";

// STORY-076 — collapsed wrapper around rarely-used owner tools.
//
// User feedback (v400 review): Demo data + Data export looked like
// clutter on the main account page. Demo data dropped completely
// (tenants who want to see a populated CRM can just create a few
// clients). Export kept — GDPR right-to-portability is promised in
// /privacy and removing it would break the policy. We hide it behind
// a toggle so it doesn't shout for attention.

import { useState } from "react";
import { ChevronDown, ChevronUp } from "@babun/shared/icons";
import DataExportSection from "./DataExportSection";

export default function AdvancedSection() {
  const [open, setOpen] = useState(false);
  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between px-4 py-3 text-[13px] font-semibold uppercase tracking-wider text-[var(--label-secondary)] active:opacity-60"
      >
        <span>Дополнительно</span>
        {open ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
      </button>
      {open && (
        <div className="space-y-4">
          <DataExportSection />
        </div>
      )}
    </div>
  );
}
