"use client";

// Категории доходов и расходов. Lists global defaults (read-only) plus
// tenant-owned categories the user can rename, re-icon, add, and delete.
// The same categories drive the «Операция» chip-rows and templates.

import { useMemo, useState } from "react";
import PageHeader from "@/components/layout/PageHeader";
import DialogModal from "@/components/appointment/DialogModal";
import { useTenantId } from "@/components/layout/DashboardClientLayout";
import { useFinanceCategories } from "@/lib/finance/hooks";
import type {
  FinanceCategory,
  FinanceCategoryKind,
} from "@babun/shared/db/repositories/finance-categories";

export default function FinanceCategoriesPage() {
  const tenantId = useTenantId();
  const { categories, add, update, remove } = useFinanceCategories(tenantId);
  const [editing, setEditing] = useState<FinanceCategory | null>(null);
  const [creating, setCreating] = useState<FinanceCategoryKind | null>(null);

  const income = useMemo(
    () => categories.filter((c) => c.type === "income"),
    [categories],
  );
  const expense = useMemo(
    () => categories.filter((c) => c.type === "expense"),
    [categories],
  );

  return (
    <>
      <PageHeader title="Категории" backHref="/dashboard/settings/finance" />
      <div className="flex-1 overflow-y-auto bg-[var(--surface-grouped)]">
        <div className="max-w-xl mx-auto px-4 py-4 space-y-5">
          <p className="text-[12px] text-[var(--label-secondary)] leading-snug">
            Категории помогают раскладывать доходы и расходы по полочкам —
            они видны в форме «Операция» и в аналитике. Системные категории
            изменить нельзя, но можно добавить свои.
          </p>

          <CategoryGroup
            title="Доходы"
            list={income}
            tenantId={tenantId}
            onEdit={setEditing}
            onAdd={() => setCreating("income")}
          />
          <CategoryGroup
            title="Расходы"
            list={expense}
            tenantId={tenantId}
            onEdit={setEditing}
            onAdd={() => setCreating("expense")}
          />
        </div>
      </div>

      {creating && (
        <CategoryEditor
          open
          kind={creating}
          initial={null}
          onClose={() => setCreating(null)}
          onSave={async (name, icon) => {
            await add(name, creating, icon);
            setCreating(null);
          }}
        />
      )}

      {editing && (
        <CategoryEditor
          open
          kind={editing.type}
          initial={editing}
          onClose={() => setEditing(null)}
          onSave={async (name, icon) => {
            await update(editing.id, { name, icon });
            setEditing(null);
          }}
          onDelete={async () => {
            await remove(editing.id);
            setEditing(null);
          }}
        />
      )}
    </>
  );
}

function CategoryGroup({
  title,
  list,
  tenantId,
  onEdit,
  onAdd,
}: {
  title: string;
  list: FinanceCategory[];
  tenantId: string;
  onEdit: (c: FinanceCategory) => void;
  onAdd: () => void;
}) {
  return (
    <div className="space-y-2">
      <div className="text-[12px] font-semibold uppercase tracking-wide text-[var(--label-tertiary)] px-1">
        {title}
      </div>
      {list.length > 0 && (
        <div className="bg-[var(--surface-card)] rounded-2xl shadow-[var(--shadow-card)] overflow-hidden">
          {list.map((c, idx) => {
            const own = c.tenant_id === tenantId;
            return (
              <button
                key={c.id}
                type="button"
                disabled={!own}
                onClick={() => own && onEdit(c)}
                className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-colors ${
                  idx > 0 ? "border-t border-[var(--separator)]" : ""
                } ${own ? "active:bg-[var(--fill-quaternary)]" : "cursor-default"}`}
              >
                <span className="text-[18px] w-6 text-center flex-shrink-0">
                  {c.icon ?? "🏷️"}
                </span>
                <span className="flex-1 min-w-0 text-[14px] text-[var(--label)] truncate">
                  {c.name}
                </span>
                {own ? (
                  <span className="text-[var(--label-tertiary)] text-[18px]">›</span>
                ) : (
                  <span className="text-[11px] text-[var(--label-quaternary)]">
                    системная
                  </span>
                )}
              </button>
            );
          })}
        </div>
      )}
      <button
        type="button"
        onClick={onAdd}
        className="w-full h-11 rounded-[var(--radius-pill)] text-[13px] font-semibold border border-dashed border-[var(--accent)]/40 text-[var(--accent)] active:scale-[0.98]"
      >
        + Своя категория
      </button>
    </div>
  );
}

interface CategoryEditorProps {
  open: boolean;
  kind: FinanceCategoryKind;
  initial: FinanceCategory | null;
  onClose: () => void;
  onSave: (name: string, icon: string) => Promise<void>;
  onDelete?: () => Promise<void>;
}

const ICON_CHOICES = [
  "🏷️", "💼", "🔧", "🚗", "🏠", "🍽️", "⛽", "🧰",
  "📦", "💡", "🧾", "📱", "🎁", "💵", "🛠️", "🧴",
];

function CategoryEditor({
  open,
  kind,
  initial,
  onClose,
  onSave,
  onDelete,
}: CategoryEditorProps) {
  const [name, setName] = useState(initial?.name ?? "");
  const [icon, setIcon] = useState(initial?.icon ?? "🏷️");
  const [confirmDel, setConfirmDel] = useState(false);
  const [busy, setBusy] = useState(false);

  const canSave = name.trim().length > 0 && !busy;

  const handleSave = async () => {
    if (!canSave) return;
    setBusy(true);
    try {
      await onSave(name.trim(), icon);
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = async () => {
    if (!onDelete || busy) return;
    if (!confirmDel) {
      setConfirmDel(true);
      return;
    }
    setBusy(true);
    try {
      await onDelete();
    } finally {
      setBusy(false);
    }
  };

  return (
    <DialogModal
      open={open}
      onClose={onClose}
      title={
        initial
          ? "Категория"
          : kind === "income"
            ? "Новая категория дохода"
            : "Новая категория расхода"
      }
      footer={
        <div className="flex gap-2">
          {onDelete && (
            <button
              type="button"
              onClick={handleDelete}
              disabled={busy}
              className={`h-12 px-4 rounded-[var(--radius-pill)] text-[13px] font-semibold disabled:opacity-50 transition-colors ${
                confirmDel
                  ? "bg-[var(--system-red)] text-[var(--label-on-accent)]"
                  : "text-[var(--system-red)] border border-[var(--system-red)]/40"
              }`}
            >
              {confirmDel ? "Точно?" : "Удалить"}
            </button>
          )}
          <button
            type="button"
            onClick={handleSave}
            disabled={!canSave}
            className="flex-1 h-12 rounded-[var(--radius-pill)] text-[14px] font-semibold bg-[var(--accent)] text-[var(--label-on-accent)] disabled:opacity-50"
          >
            {busy ? "Сохраняю…" : "Сохранить"}
          </button>
        </div>
      }
    >
      <div className="px-3 py-3 space-y-4">
        <div>
          <div className="text-[12px] font-medium text-[var(--label-secondary)] mb-1 tracking-wide">
            Название
          </div>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={kind === "income" ? "Например: Чаевые" : "Например: Топливо"}
            autoFocus
            className="w-full h-11 px-3.5 bg-[var(--fill-tertiary)] border border-transparent rounded-[10px] text-[15px] text-[var(--label)] placeholder:text-[var(--label-tertiary)] focus:outline-none focus:bg-[var(--surface-card)] focus:border-[var(--accent)] transition"
          />
        </div>

        <div>
          <div className="text-[12px] font-medium text-[var(--label-secondary)] mb-1.5 tracking-wide">
            Иконка
          </div>
          <div className="grid grid-cols-8 gap-1.5">
            {ICON_CHOICES.map((ic) => (
              <button
                key={ic}
                type="button"
                onClick={() => setIcon(ic)}
                className={`h-9 rounded-[10px] text-[18px] flex items-center justify-center transition ${
                  icon === ic
                    ? "bg-[var(--accent-tint)] ring-2 ring-[var(--accent)]"
                    : "bg-[var(--fill-tertiary)]"
                }`}
              >
                {ic}
              </button>
            ))}
          </div>
        </div>
      </div>
    </DialogModal>
  );
}
