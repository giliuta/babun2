"use client";

import { useState } from "react";
import type { Client, ACUnit, ClientNote, ACType } from "@/lib/clients";
import { PROPERTY_LABELS, AC_TYPE_LABELS } from "@/lib/clients";
import type { Appointment } from "@/lib/appointments";
import { getPaidAmount } from "@/lib/appointments";
import { generateId } from "@/lib/masters";
import { haptic } from "@/lib/haptics";
import MessengerButtons from "./MessengerButtons";

interface ClientPanelProps {
  client: Client;
  appointments: Appointment[];
  onUpdate: (updated: Client) => void;
  onClose: () => void;
}

export default function ClientPanel({
  client,
  appointments,
  onUpdate,
  onClose,
}: ClientPanelProps) {
  const [noteText, setNoteText] = useState("");
  const [showNoteInput, setShowNoteInput] = useState(false);
  const [showEquipForm, setShowEquipForm] = useState(false);
  const [equipRoom, setEquipRoom] = useState("");
  const [equipBrand, setEquipBrand] = useState("");
  const [equipType, setEquipType] = useState<ACType>("split");

  const clientApts = appointments.filter(
    (a) => a.client_id === client.id && a.status !== "cancelled"
  );
  const completedApts = clientApts.filter((a) => a.status === "completed");
  const totalPaid = completedApts.reduce((s, a) => s + getPaidAmount(a), 0);
  const avgCheck = completedApts.length > 0 ? Math.round(totalPaid / completedApts.length) : 0;
  const lastOrder = completedApts.sort(
    (a, b) => b.date.localeCompare(a.date)
  )[0];

  const addNote = () => {
    if (!noteText.trim()) return;
    haptic("tap");
    const note: ClientNote = {
      id: generateId("note"),
      text: noteText.trim(),
      created_at: new Date().toISOString(),
    };
    onUpdate({ ...client, notes: [note, ...client.notes] });
    setNoteText("");
    setShowNoteInput(false);
  };

  const removeNote = (noteId: string) => {
    onUpdate({ ...client, notes: client.notes.filter((n) => n.id !== noteId) });
  };

  const addEquipment = () => {
    if (!equipRoom.trim()) return;
    haptic("tap");
    const unit: ACUnit = {
      id: generateId("unit"),
      room: equipRoom.trim(),
      brand: equipBrand.trim() || undefined,
      ac_type: equipType,
      has_indoor: true,
      has_outdoor: true,
    };
    onUpdate({ ...client, equipment: [...client.equipment, unit] });
    setEquipRoom("");
    setEquipBrand("");
    setShowEquipForm(false);
  };

  const removeEquipment = (unitId: string) => {
    onUpdate({ ...client, equipment: client.equipment.filter((u) => u.id !== unitId) });
  };

  const toggleTag = (tagId: string) => {
    haptic("tap");
    const next = client.tag_ids.includes(tagId)
      ? client.tag_ids.filter((t) => t !== tagId)
      : [...client.tag_ids, tagId];
    onUpdate({ ...client, tag_ids: next });
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard?.writeText(text);
    haptic("success");
  };

  const initials = client.full_name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <div className="h-full flex flex-col bg-white border-l border-gray-200">
      {/* Header */}
      <div className="flex-shrink-0 px-4 pt-4 pb-3 border-b border-gray-100">
        <div className="flex items-start justify-between mb-3">
          <div className="text-[10px] uppercase tracking-wider text-gray-400 font-semibold">
            Карточка клиента
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center text-gray-400 hover:text-gray-600 rounded-lg"
          >
            ✕
          </button>
        </div>

        <div className="flex flex-col items-center text-center">
          <div className="w-16 h-16 rounded-full bg-violet-500 text-white flex items-center justify-center text-[20px] font-bold mb-2">
            {initials || "?"}
          </div>
          <div className="text-[17px] font-semibold text-gray-900">
            {client.full_name}
          </div>
          {client.city && (
            <div className="text-[12px] text-gray-500 mt-0.5">
              {client.city}
              {client.property_type && ` · ${PROPERTY_LABELS[client.property_type]}`}
            </div>
          )}
          <div className="mt-3">
            <MessengerButtons
              phone={client.phone}
              telegramUsername={client.telegram_username}
              instagramUsername={client.instagram_username}
            />
          </div>
        </div>
      </div>

      {/* Scrollable sections */}
      <div className="flex-1 overflow-y-auto">
        {/* Contacts */}
        {(client.phone || client.email || client.address) && (
          <Section title="Контакты">
            {client.phone && (
              <CopyRow icon="📱" value={client.phone} onCopy={() => copyToClipboard(client.phone)} />
            )}
            {client.email && (
              <CopyRow icon="📧" value={client.email} onCopy={() => copyToClipboard(client.email)} />
            )}
            {client.address && (
              <a
                href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(client.address)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 px-4 py-1.5 text-[13px] text-gray-900 active:bg-gray-50"
              >
                <span className="text-[14px]">📍</span>
                <span className="truncate text-blue-600 underline underline-offset-2">{client.address}</span>
              </a>
            )}
          </Section>
        )}

        {/* Equipment */}
        <Section title={`Оборудование${client.equipment.length > 0 ? ` (${client.equipment.length})` : ""}`}>
          {client.equipment.length > 0 && (
            <div className="px-4 space-y-1.5">
              {client.equipment.map((unit) => (
                <div key={unit.id} className="flex items-center justify-between bg-gray-50 rounded-lg px-3 py-2">
                  <div>
                    <div className="text-[13px] font-medium text-gray-900">
                      {unit.room}
                      <span className="text-[10px] font-normal text-gray-400 ml-1.5">
                        {AC_TYPE_LABELS[unit.ac_type || "split"]}
                      </span>
                    </div>
                    <div className="text-[11px] text-gray-500">
                      {unit.brand || "Бренд не указан"}
                      {unit.model && ` · ${unit.model}`}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => removeEquipment(unit.id)}
                    className="text-[12px] text-gray-400 hover:text-red-500"
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
          )}
          {showEquipForm ? (
            <div className="px-4 mt-2 space-y-2">
              <input
                type="text"
                value={equipRoom}
                onChange={(e) => setEquipRoom(e.target.value)}
                placeholder="Комната (Гостиная, Спальня...)"
                className="w-full h-9 px-3 rounded-lg bg-gray-50 border border-gray-200 text-[13px] focus:outline-none focus:ring-1 focus:ring-violet-500"
                autoFocus
              />
              <input
                type="text"
                value={equipBrand}
                onChange={(e) => setEquipBrand(e.target.value)}
                placeholder="Бренд (Daikin, Mitsubishi...)"
                className="w-full h-9 px-3 rounded-lg bg-gray-50 border border-gray-200 text-[13px] focus:outline-none focus:ring-1 focus:ring-violet-500"
              />
              <div className="flex gap-1.5">
                {(Object.entries(AC_TYPE_LABELS) as [ACType, string][]).map(([key, label]) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setEquipType(key)}
                    className={`flex-1 h-9 rounded-lg text-[12px] font-medium transition ${
                      equipType === key ? "bg-violet-600 text-white" : "bg-gray-100 text-gray-600"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
              <div className="flex gap-2">
                <button type="button" onClick={() => setShowEquipForm(false)} className="flex-1 h-9 text-[13px] text-gray-600">
                  Отмена
                </button>
                <button type="button" onClick={addEquipment} disabled={!equipRoom.trim()} className="flex-1 h-9 bg-violet-600 text-white rounded-lg text-[13px] font-medium disabled:bg-gray-300">
                  Добавить
                </button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setShowEquipForm(true)}
              className="mx-4 mt-2 w-[calc(100%-2rem)] h-9 border border-dashed border-gray-300 rounded-lg text-[12px] text-violet-600 font-medium active:bg-violet-50"
            >
              + Добавить кондиционер
            </button>
          )}
        </Section>

        {/* Finance summary */}
        <Section title="Финансы">
          <div className="px-4 grid grid-cols-2 gap-3">
            <Metric label="Оплачено" value={`€${totalPaid}`} color="text-green-600" />
            <Metric label="Заказов" value={String(completedApts.length)} />
            <Metric label="Средний чек" value={`€${avgCheck}`} />
            <Metric label="Последний" value={lastOrder?.date.split("-").reverse().join(".") ?? "—"} />
          </div>
        </Section>

        {/* Service history */}
        {completedApts.length > 0 && (
          <Section title="История">
            <div className="px-4 space-y-1.5">
              {completedApts.slice(0, 3).map((apt) => (
                <div key={apt.id} className="flex items-center justify-between text-[12px] bg-gray-50 rounded-lg px-3 py-2">
                  <div>
                    <span className="text-gray-500">{apt.date.split("-").reverse().join(".")}</span>
                    <span className="text-gray-700 ml-1.5">{apt.comment?.split("—")[0]?.trim() || "Запись"}</span>
                  </div>
                  <span className="font-semibold text-gray-900">€{getPaidAmount(apt)}</span>
                </div>
              ))}
            </div>
          </Section>
        )}

        {/* Notes */}
        <Section title="Заметки">
          {client.notes.length > 0 && (
            <div className="px-4 space-y-1.5">
              {client.notes.map((note) => (
                <div key={note.id} className="flex items-start gap-2 text-[12px]">
                  <div className="flex-1">
                    <span className="text-gray-400">
                      {new Date(note.created_at).toLocaleDateString("ru-RU")}
                    </span>
                    <span className="text-gray-700 ml-1.5">{note.text}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => removeNote(note.id)}
                    className="text-gray-300 hover:text-red-500 text-[10px] mt-0.5"
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
          )}
          {showNoteInput ? (
            <div className="px-4 mt-2 space-y-2">
              <textarea
                value={noteText}
                onChange={(e) => setNoteText(e.target.value)}
                placeholder="Введите заметку..."
                rows={2}
                className="w-full px-3 py-2 rounded-lg bg-gray-50 border border-gray-200 text-[13px] resize-none focus:outline-none focus:ring-1 focus:ring-violet-500"
                autoFocus
              />
              <div className="flex gap-2">
                <button type="button" onClick={() => { setShowNoteInput(false); setNoteText(""); }} className="flex-1 h-9 text-[13px] text-gray-600">
                  Отмена
                </button>
                <button type="button" onClick={addNote} disabled={!noteText.trim()} className="flex-1 h-9 bg-violet-600 text-white rounded-lg text-[13px] font-medium disabled:bg-gray-300">
                  Сохранить
                </button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setShowNoteInput(true)}
              className="mx-4 mt-2 w-[calc(100%-2rem)] h-9 border border-dashed border-gray-300 rounded-lg text-[12px] text-violet-600 font-medium active:bg-violet-50"
            >
              + Добавить заметку
            </button>
          )}
        </Section>

        {/* Tags */}
        <Section title="Теги">
          <div className="px-4 flex flex-wrap gap-1.5">
            {PRESET_TAGS.map((tag) => {
              const active = client.tag_ids.includes(tag.id);
              return (
                <button
                  key={tag.id}
                  type="button"
                  onClick={() => toggleTag(tag.id)}
                  className={`px-2.5 py-1 rounded-full text-[11px] font-medium transition ${
                    active ? tag.activeClass : "bg-gray-100 text-gray-500"
                  }`}
                >
                  {active && "✓ "}{tag.label}
                </button>
              );
            })}
          </div>
        </Section>

        <div className="h-8" />
      </div>
    </div>
  );
}

const PRESET_TAGS = [
  { id: "tag-vip", label: "VIP", activeClass: "bg-amber-100 text-amber-700" },
  { id: "tag-regular", label: "Постоянный", activeClass: "bg-purple-100 text-purple-700" },
  { id: "tag-b2b", label: "B2B", activeClass: "bg-blue-100 text-blue-700" },
  { id: "tag-problem", label: "Проблемный", activeClass: "bg-red-100 text-red-700" },
  { id: "tag-new", label: "Новый", activeClass: "bg-green-100 text-green-700" },
  { id: "tag-referral", label: "Рекомендация", activeClass: "bg-gray-200 text-gray-700" },
];

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="py-3 border-b border-gray-100">
      <div className="px-4 text-[10px] uppercase tracking-wider text-gray-400 font-semibold mb-2">
        {title}
      </div>
      {children}
    </div>
  );
}

function Metric({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div>
      <div className={`text-[18px] font-bold ${color || "text-gray-900"}`}>{value}</div>
      <div className="text-[10px] text-gray-400 uppercase tracking-wide">{label}</div>
    </div>
  );
}

function CopyRow({ icon, value, onCopy }: { icon: string; value: string; onCopy: () => void }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={() => {
        onCopy();
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      }}
      className="w-full flex items-center gap-2 px-4 py-1.5 text-[13px] text-gray-900 active:bg-gray-50"
    >
      <span className="text-[14px]">{icon}</span>
      <span className="flex-1 text-left truncate">{value}</span>
      <span className="text-[11px] text-gray-400">
        {copied ? "✓" : "📋"}
      </span>
    </button>
  );
}
