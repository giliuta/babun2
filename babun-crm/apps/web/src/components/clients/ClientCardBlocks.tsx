"use client";

// Reference blocks for the unified client card, driven by the user's
// per-tenant block order (loadBlockConfig). Extracted from ClientCardPage
// to keep that component under the 400-line ceiling. Same render in view
// and create — edits route through `onUpdate` (store in view, draft in
// create); empty/new clients simply show each block's empty state.

import type { Client } from "@babun/shared/local/clients";
import type { Appointment } from "@babun/shared/local/appointments";
import type { Service } from "@babun/shared/local/services";
import type { ClientStats } from "@babun/shared/local/selectors/client-stats";
import { loadBlockConfig } from "@babun/shared/local/business-blocks";
import ObjectsBlock from "./blocks/ObjectsBlock";
import VisitsBlock from "./blocks/VisitsBlock";
import FinanceBlock from "./blocks/FinanceBlock";
import NotesBlock from "./blocks/NotesBlock";
import ContactsBlock from "./blocks/ContactsBlock";
import PersonalBlock from "./blocks/PersonalBlock";
import MetaBlock from "./blocks/MetaBlock";
import AttachmentsBlock from "./blocks/AttachmentsBlock";

interface ClientCardBlocksProps {
  client: Client;
  stats: ClientStats | undefined;
  appointments: Appointment[];
  services: Service[];
  onUpdate: (next: Client) => void;
}

export default function ClientCardBlocks({
  client,
  stats,
  appointments,
  services,
  onUpdate,
}: ClientCardBlocksProps) {
  const blockConfig = loadBlockConfig();

  return (
    <div className="mt-2">
      {blockConfig.map((cfg) => {
        switch (cfg.kind) {
          case "objects":
            return (
              <ObjectsBlock
                key={cfg.kind}
                client={client}
                onUpdate={onUpdate}
                appointments={appointments.filter((a) => a.client_id === client.id)}
              />
            );
          case "visits":
            return (
              <VisitsBlock
                key={cfg.kind}
                clientId={client.id}
                appointments={appointments}
                services={services}
              />
            );
          case "finance":
            return (
              <FinanceBlock
                key={cfg.kind}
                clientId={client.id}
                stats={stats}
                appointments={appointments}
              />
            );
          case "notes":
            return (
              <NotesBlock
                key={cfg.kind}
                client={client}
                onUpdate={onUpdate}
                focusToken={0}
              />
            );
          case "attachments":
            return <AttachmentsBlock key={cfg.kind} client={client} />;
          case "contacts":
            return <ContactsBlock key={cfg.kind} client={client} onUpdate={onUpdate} />;
          case "personal":
            return <PersonalBlock key={cfg.kind} client={client} onUpdate={onUpdate} />;
          case "meta":
            return <MetaBlock key={cfg.kind} client={client} onUpdate={onUpdate} />;
          default:
            return null;
        }
      })}
    </div>
  );
}
