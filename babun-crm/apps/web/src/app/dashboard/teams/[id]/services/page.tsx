"use client";

// Sprint 033 Phase H — Brigade services subroute.

import { use, useState } from "react";
import { Check, Pencil, Plus, Trash2 } from "lucide-react";
import { haptic } from "@/lib/haptics";
import { useConfirm } from "@/components/ui/ConfirmProvider";
import { useServices, useTeams } from "@/app/dashboard/layout";
import { createBlankService, type Service } from "@/lib/services";
import BrigadeSectionShell, {
  SectionCard,
} from "@/components/teams/BrigadeSectionShell";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export default function BrigadeServicesPage({ params }: RouteParams) {
  const { id } = use(params);
  const confirm = useConfirm();
  const { teams } = useTeams();
  const { services, categories, upsertService } = useServices();

  const team = teams.find((t) => t.id === id);

  // Add-service form
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState("");
  const [newMin, setNewMin] = useState(60);
  const [newPrice, setNewPrice] = useState(0);

  // Edit-service state
  const [editId, setEditId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editMin, setEditMin] = useState(60);
  const [editPrice, setEditPrice] = useState(0);

  if (!team) {
    return (
      <BrigadeSectionShell brigadeId={id} title="Услуги" onSave={() => true}>
        <SectionCard>
          <div className="text-[13px] text-[var(--label-tertiary)] py-4 text-center">
            Бригада не найдена.
          </div>
        </SectionCard>
      </BrigadeSectionShell>
    );
  }

  const hasService = (svc: Service) => svc.brigade_ids.includes(team.id);

  const toggle = (svc: Service) => {
    haptic("tap");
    const next: Service = {
      ...svc,
      brigade_ids: hasService(svc)
        ? svc.brigade_ids.filter((b) => b !== team.id)
        : [...svc.brigade_ids, team.id],
    };
    upsertService(next);
  };

  const addNew = () => {
    if (!newName.trim()) return;
    haptic("tap");
    upsertService(
      createBlankService({
        name: newName.trim(),
        duration_minutes: Math.max(1, newMin),
        price: Math.max(0, newPrice),
        brigade_ids: [team.id],
      }),
    );
    setNewName("");
    setNewMin(60);
    setNewPrice(0);
    setAdding(false);
  };

  const beginEdit = (svc: Service) => {
    haptic("tap");
    setEditId(svc.id);
    setEditName(svc.name);
    setEditMin(svc.duration_minutes);
    setEditPrice(svc.price);
  };

  const saveEdit = (svc: Service) => {
    if (!editName.trim()) return;
    haptic("tap");
    upsertService({
      ...svc,
      name: editName.trim(),
      duration_minutes: Math.max(1, editMin),
      price: Math.max(0, editPrice),
    });
    setEditId(null);
  };

  const del = async (svc: Service) => {
    const usedElsewhere = svc.brigade_ids.filter((b) => b !== team.id).length > 0;
    if (usedElsewhere) {
      haptic("tap");
      upsertService({ ...svc, brigade_ids: svc.brigade_ids.filter((b) => b !== team.id) });
      setEditId(null);
      return;
    }
    const ok = await confirm({
      title: `Удалить услугу «${svc.name}»?`,
      message: "Используется только этой бригадой — будет удалена полностью.",
      confirmLabel: "Удалить",
    });
    if (!ok) return;
    upsertService({ ...svc, is_active: false, brigade_ids: [] });
    setEditId(null);
  };

  return (
    <BrigadeSectionShell brigadeId={id} title="Услуги" onSave={() => true} saveLabel="Готово">
      <SectionCard subtitle="Какие услуги делает бригада. При записи клиента показываются только они. Не выбрано ничего — доступны все.">
        {adding ? (
          <div className="bg-[var(--fill-tertiary)] rounded-[10px] p-3 space-y-3">
            <input
              autoFocus
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") addNew();
                if (e.key === "Escape") setAdding(false);
              }}
              placeholder="Название услуги"
              className="w-full h-11 px-3 rounded-[10px] bg-[var(--surface-card)] text-[15px] text-[var(--label)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
            />
            <div className="grid grid-cols-2 gap-2">
              <div>
                <div className="text-[12px] font-medium uppercase tracking-wide text-[var(--label-secondary)] mb-1">Длительность</div>
                <div className="flex items-center gap-1.5">
                  <input type="number" min={1} step={5} value={newMin} onChange={(e) => setNewMin(Number(e.target.value) || 0)} className="flex-1 h-11 px-3 rounded-[10px] bg-[var(--surface-card)] text-[15px] text-[var(--label)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]" />
                  <span className="text-[14px] text-[var(--label-secondary)]">мин</span>
                </div>
              </div>
              <div>
                <div className="text-[12px] font-medium uppercase tracking-wide text-[var(--label-secondary)] mb-1">Цена</div>
                <div className="flex items-center gap-1.5">
                  <span className="text-[15px] text-[var(--label-secondary)]">€</span>
                  <input type="number" min={0} step={1} value={newPrice} onChange={(e) => setNewPrice(Number(e.target.value) || 0)} className="flex-1 h-11 px-3 rounded-[10px] bg-[var(--surface-card)] text-[15px] text-[var(--label)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]" />
                </div>
              </div>
            </div>
            <div className="flex gap-2">
              <button type="button" onClick={() => { setAdding(false); setNewName(""); }} className="flex-1 h-10 rounded-[10px] bg-[var(--fill-secondary)] text-[14px] font-medium text-[var(--label)] press-scale">Отмена</button>
              <button type="button" onClick={addNew} disabled={!newName.trim()} className="flex-1 h-10 rounded-[10px] bg-[var(--accent)] text-[14px] font-semibold text-[var(--label-on-accent)] press-scale disabled:opacity-40">Добавить</button>
            </div>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setAdding(true)}
            className="w-full h-11 flex items-center justify-center gap-2 rounded-[10px] bg-[var(--accent-tint)] text-[var(--accent)] text-[14px] font-semibold press-scale"
          >
            <Plus size={16} strokeWidth={2.5} />
            Добавить услугу
          </button>
        )}

        {categories.map((cat) => {
          const catSvcs = services.filter(
            (s) => s.category_id === cat.id && s.is_active !== false,
          );
          if (catSvcs.length === 0) return null;
          return (
            <div key={cat.id} className="mt-3 first:mt-0">
              <div className="text-[12px] font-semibold uppercase tracking-wider text-[var(--label-secondary)] mb-1.5">
                {cat.name}
              </div>
              <div className="flex flex-col divide-y divide-[var(--separator)]">
                {catSvcs.map((s) => {
                  const checked = hasService(s);
                  if (editId === s.id) {
                    return (
                      <div key={s.id} className="bg-[var(--fill-tertiary)] rounded-[10px] p-3 space-y-3 my-1">
                        <input autoFocus type="text" value={editName} onChange={(e) => setEditName(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") saveEdit(s); if (e.key === "Escape") setEditId(null); }} placeholder="Название услуги" className="w-full h-11 px-3 rounded-[10px] bg-[var(--surface-card)] text-[15px] text-[var(--label)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]" />
                        <div className="grid grid-cols-2 gap-2">
                          <div className="flex items-center gap-1.5">
                            <input type="number" min={1} step={5} value={editMin} onChange={(e) => setEditMin(Number(e.target.value) || 0)} className="flex-1 h-11 px-3 rounded-[10px] bg-[var(--surface-card)] text-[15px] text-[var(--label)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]" />
                            <span className="text-[14px] text-[var(--label-secondary)]">мин</span>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <span className="text-[15px] text-[var(--label-secondary)]">€</span>
                            <input type="number" min={0} step={1} value={editPrice} onChange={(e) => setEditPrice(Number(e.target.value) || 0)} className="flex-1 h-11 px-3 rounded-[10px] bg-[var(--surface-card)] text-[15px] text-[var(--label)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]" />
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <button type="button" onClick={() => del(s)} className="h-10 px-3 rounded-[10px] bg-[rgba(255,59,48,0.12)] text-[var(--system-red)] text-[14px] font-medium press-scale flex items-center gap-1"><Trash2 size={14} strokeWidth={2} />Удалить</button>
                          <button type="button" onClick={() => setEditId(null)} className="flex-1 h-10 rounded-[10px] bg-[var(--fill-secondary)] text-[14px] font-medium text-[var(--label)] press-scale">Отмена</button>
                          <button type="button" onClick={() => saveEdit(s)} disabled={!editName.trim()} className="flex-1 h-10 rounded-[10px] bg-[var(--accent)] text-[14px] font-semibold text-[var(--label-on-accent)] press-scale disabled:opacity-40">Сохранить</button>
                        </div>
                      </div>
                    );
                  }
                  return (
                    <div key={s.id} className="flex items-center gap-3 py-3">
                      <button type="button" onClick={() => toggle(s)} aria-label={checked ? "Убрать из бригады" : "Добавить в бригаду"} className={`w-6 h-6 rounded-md flex items-center justify-center press-scale shrink-0 ${checked ? "bg-[var(--accent)]" : "border-2 border-[var(--separator-opaque)]"}`}>
                        {checked && <Check size={14} className="text-[var(--label-on-accent)]" strokeWidth={3} />}
                      </button>
                      <button type="button" onClick={() => beginEdit(s)} className="flex-1 min-w-0 text-left active:opacity-70">
                        <div className="text-[15px] text-[var(--label)] truncate">{s.name}</div>
                        <div className="text-[12px] text-[var(--label-secondary)]">{s.duration_minutes} мин · €{s.price}</div>
                      </button>
                      <button type="button" onClick={() => beginEdit(s)} aria-label="Редактировать" className="w-9 h-9 flex items-center justify-center rounded-lg text-[var(--label-tertiary)] active:bg-[var(--fill-quaternary)] press-scale"><Pencil size={16} strokeWidth={2} /></button>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </SectionCard>
    </BrigadeSectionShell>
  );
}
