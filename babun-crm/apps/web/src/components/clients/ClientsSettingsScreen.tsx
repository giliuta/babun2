"use client";

// v811 — «Настройки клиентов». Full-screen sheet opened from the gear in
// the clients header (mockup clients-current.html). Groups:
//   • Отображение — Что показывать (→ live card-fields) · Сортировка /
//     Фильтры (→ open the «Фильтры» panel)
//   • Редактирование — stubs («в разработке»)
//   • Данные — Импорт / Экспорт CSV (existing handlers)
// Card-field toggles are the only fully-wired section; the rest mirror
// the mockup's stubbed state.

import { useEffect } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Eye,
  ArrowUpDown,
  Filter,
  Pencil,
  List,
  Upload,
  Download,
  AlertTriangle,
} from "@babun/shared/icons";
import { haptic } from "@/lib/haptics";
import { registerModalBack } from "@/lib/history-stack";
import type { CardFieldPrefs } from "@/lib/client-card-prefs";

interface ClientsSettingsScreenProps {
  cardFields: CardFieldPrefs;
  sortLabel: string;
  canImport: boolean;
  onClose: () => void;
  onOpenCardFields: () => void;
  onOpenSort: () => void;
  onOpenFilters: () => void;
  onImport: () => void;
  onExport: () => void;
  /** Called when a not-yet-built row is tapped (parent shows a toast). */
  onStub: (label: string) => void;
}

/** Short live summary of which card fields are on (for the row subtitle). */
function cardSummary(p: CardFieldPrefs): string {
  const parts = ["Имя"];
  if (p.exp) parts.push("ожид. прибыль");
  if (p.inc) parts.push("доход");
  if (p.debt) parts.push("долг");
  if (p.last) parts.push("посл. запись");
  if (p.meta) parts.push("команда/метка/тег");
  return parts.join(" · ");
}

export function ClientsSettingsScreen({
  cardFields,
  sortLabel,
  canImport,
  onClose,
  onOpenCardFields,
  onOpenSort,
  onOpenFilters,
  onImport,
  onExport,
  onStub,
}: ClientsSettingsScreenProps) {
  useEffect(() => {
    const popClose = registerModalBack("clients-settings", onClose);
    return popClose;
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-[80] flex flex-col bg-[var(--surface-grouped)] animate-slide-in-right">
      {/* nav */}
      <div className="h-12 shrink-0 flex items-center justify-between px-1.5 bg-[var(--surface-card)] border-b border-[var(--separator)]">
        <button
          type="button"
          onClick={() => {
            haptic("light");
            onClose();
          }}
          className="flex items-center h-10 px-1 text-[15px] font-medium text-[var(--accent)] active:opacity-60"
        >
          <ChevronLeft size={22} strokeWidth={2.4} />
          Клиенты
        </button>
        <span className="text-[17px] font-semibold tracking-[-0.01em] text-[var(--label)]">
          Настройки клиентов
        </span>
        <span className="w-[64px]" />
      </div>

      {/* body */}
      <div className="flex-1 overflow-y-auto scrollbar-hide px-3.5 pt-1.5 pb-6">
        <GroupTitle>Отображение</GroupTitle>
        <Group>
          <Row
            tile="#3E88F7"
            icon={<Eye size={16} strokeWidth={2} />}
            title="Что показывать на карточке"
            sub={cardSummary(cardFields)}
            onClick={onOpenCardFields}
          />
          <Row
            tile="#5E5CE6"
            icon={<ArrowUpDown size={16} strokeWidth={2} />}
            title="Сортировка списка"
            sub={sortLabel}
            onClick={onOpenSort}
          />
          <Row
            tile="#30B0C7"
            icon={<Filter size={16} strokeWidth={2} />}
            title="Фильтры списка"
            sub="Команда · метка · тег · период"
            onClick={onOpenFilters}
          />
        </Group>

        <GroupTitle>Редактирование</GroupTitle>
        <Group>
          <Row
            tile="#34C759"
            icon={<Pencil size={16} strokeWidth={2} />}
            title="Какие поля можно редактировать"
            soon
            onClick={() => onStub("Какие поля можно редактировать")}
          />
          <Row
            tile="#FF9500"
            icon={<List size={16} strokeWidth={2} />}
            title="Поля и блоки профиля"
            sub="Объекты · визиты · финансы · заметки"
            soon
            onClick={() => onStub("Поля и блоки профиля")}
          />
        </Group>

        <GroupTitle>Данные</GroupTitle>
        <Group>
          {canImport && (
            <Row
              tile="#3E88F7"
              icon={<Upload size={16} strokeWidth={2} />}
              title="Импорт из CSV"
              sub="Загрузить клиентов из файла"
              onClick={onImport}
            />
          )}
          <Row
            tile="#30B0C7"
            icon={<Download size={16} strokeWidth={2} />}
            title="Экспорт в CSV"
            sub="Выгрузить список (с учётом фильтров)"
            onClick={onExport}
          />
        </Group>

        <div className="mt-4 flex items-start gap-2 px-3.5 py-3 rounded-[12px] bg-[rgba(255,149,0,0.10)] text-[var(--system-orange)] text-[13px] leading-snug">
          <span className="shrink-0 mt-px">
            <AlertTriangle size={16} strokeWidth={2.2} />
          </span>
          Раздел в разработке. «Что показывать на карточке» уже работает — остальное настроим дальше.
        </div>
      </div>
    </div>
  );
}

function GroupTitle({ children }: { children: React.ReactNode }) {
  return (
    <div className="text-[13px] font-semibold uppercase tracking-wider text-[var(--label-secondary)] px-1.5 pt-4 pb-1.5">
      {children}
    </div>
  );
}

function Group({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-[var(--surface-card)] rounded-[14px] overflow-hidden shadow-[var(--shadow-card)]">
      {children}
    </div>
  );
}

function Row({
  tile,
  icon,
  title,
  sub,
  soon,
  onClick,
}: {
  tile: string;
  icon: React.ReactNode;
  title: string;
  sub?: string;
  soon?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={() => {
        haptic("tap");
        onClick();
      }}
      className="w-full flex items-center gap-3 min-h-[50px] px-3.5 py-2.5 border-b border-[var(--separator)] last:border-b-0 text-left active:bg-[var(--fill-quaternary)] transition-colors"
    >
      <span
        className="w-7 h-7 rounded-[7px] flex items-center justify-center text-white shrink-0"
        style={{ background: tile }}
      >
        {icon}
      </span>
      <span className="flex-1 min-w-0">
        <span className="flex items-center gap-1.5">
          <span className="text-[15px] text-[var(--label)] truncate">{title}</span>
          {soon && (
            <span className="shrink-0 text-[10px] font-semibold uppercase tracking-wide text-[var(--label-tertiary)] bg-[var(--fill-tertiary)] rounded-full px-1.5 py-px">
              скоро
            </span>
          )}
        </span>
        {sub && (
          <span className="block text-[12px] text-[var(--label-tertiary)] mt-px truncate">
            {sub}
          </span>
        )}
      </span>
      <span className="text-[var(--label-tertiary)] shrink-0">
        <ChevronRight size={18} strokeWidth={2.2} />
      </span>
    </button>
  );
}
