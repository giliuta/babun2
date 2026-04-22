"use client";

// Sprint 033 Phase H — Brigade masters subroute (leads + helpers).

import { use, useEffect, useState } from "react";
import { Check } from "lucide-react";
import { haptic } from "@/lib/haptics";
import { useMasters, useTeams } from "@/app/dashboard/layout";
import { getTeamLeadIds, type Master } from "@/lib/masters";
import BrigadeSectionShell, {
  SectionCard,
  FieldRow,
} from "@/components/teams/BrigadeSectionShell";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export default function BrigadeMastersPage({ params }: RouteParams) {
  const { id } = use(params);
  const { teams, upsertTeam } = useTeams();
  const { masters, setMasters } = useMasters();

  const team = teams.find((t) => t.id === id);
  const [leadIds, setLeadIds] = useState<string[]>(team ? getTeamLeadIds(team) : []);
  const [helperIds, setHelperIds] = useState<string[]>(team?.helper_ids ?? []);

  useEffect(() => {
    if (team) {
      setLeadIds(getTeamLeadIds(team));
      setHelperIds(team.helper_ids);
    }
  }, [team]);

  if (!team) {
    return (
      <BrigadeSectionShell brigadeId={id} title="Мастера" onSave={() => true}>
        <SectionCard>
          <div className="text-[13px] text-[var(--label-tertiary)] py-4 text-center">
            Бригада не найдена.
          </div>
        </SectionCard>
      </BrigadeSectionShell>
    );
  }

  const availableMasters = masters.filter(
    (m) => m.team_id === null || m.team_id === team.id || leadIds.includes(m.id) || helperIds.includes(m.id),
  );

  const toggleLead = (mid: string) => {
    haptic("tap");
    if (leadIds.includes(mid)) {
      setLeadIds(leadIds.filter((x) => x !== mid));
    } else {
      setLeadIds([...leadIds, mid]);
      setHelperIds(helperIds.filter((x) => x !== mid));
    }
  };

  const toggleHelper = (mid: string) => {
    haptic("tap");
    if (helperIds.includes(mid)) {
      setHelperIds(helperIds.filter((x) => x !== mid));
    } else {
      setHelperIds([...helperIds, mid]);
      setLeadIds(leadIds.filter((x) => x !== mid));
    }
  };

  const handleSave = () => {
    haptic("tap");
    const deduped = Array.from(new Set(leadIds));
    const cleanedHelpers = helperIds.filter((hid) => !deduped.includes(hid));
    upsertTeam({
      ...team,
      lead_id: deduped[0] ?? null,
      lead_ids: deduped.length > 0 ? deduped : undefined,
      helper_ids: cleanedHelpers,
    });
    // Sync master.team_id so newly-attached masters see the brigade.
    const memberIds = new Set<string>([...deduped, ...cleanedHelpers]);
    const updatedMasters = masters.map<Master>((m) => {
      const wasHere = m.team_id === team.id;
      const nowHere = memberIds.has(m.id);
      if (nowHere && m.team_id !== team.id) return { ...m, team_id: team.id };
      if (wasHere && !nowHere) return { ...m, team_id: null };
      return m;
    });
    setMasters(updatedMasters);
    return true;
  };

  const renderList = (
    current: string[],
    onToggle: (id: string) => void,
  ) => (
    <div className="flex flex-col divide-y divide-[var(--separator)] -my-2">
      {availableMasters.map((m) => {
        const checked = current.includes(m.id);
        return (
          <label
            key={m.id}
            className="flex items-center gap-3 py-3 cursor-pointer active:bg-[var(--fill-quaternary)] transition"
          >
            <div
              className={`w-6 h-6 rounded-md flex items-center justify-center press-scale ${
                checked ? "bg-[var(--accent)]" : "border-2 border-[var(--separator-opaque)]"
              }`}
            >
              {checked && <Check size={14} className="text-[var(--label-on-accent)]" strokeWidth={3} />}
            </div>
            <div className="flex-1 text-[15px] text-[var(--label)]">{m.full_name}</div>
            <input type="checkbox" checked={checked} onChange={() => onToggle(m.id)} className="sr-only" />
          </label>
        );
      })}
    </div>
  );

  return (
    <BrigadeSectionShell brigadeId={id} title="Мастера" onSave={handleSave}>
      <SectionCard subtitle="Бригадиров и помощников может быть несколько. Отметь галочкой — мастер закрепится за бригадой и увидит её в календаре.">
        {availableMasters.length === 0 ? (
          <div className="text-[13px] text-[var(--label-tertiary)] py-2">
            Нет свободных мастеров. Создайте их в разделе Мастера.
          </div>
        ) : (
          <>
            <FieldRow label="Бригадиры">{renderList(leadIds, toggleLead)}</FieldRow>
            <FieldRow label="Помощники">{renderList(helperIds, toggleHelper)}</FieldRow>
          </>
        )}
      </SectionCard>
    </BrigadeSectionShell>
  );
}
