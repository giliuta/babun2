"use client";

import { useState } from "react";
import Link from "next/link";
import PageHeader from "@/components/layout/PageHeader";
import { useFormSettings } from "@/app/dashboard/layout";
import type {
  FormFieldVisibility,
  RequiredFields,
} from "@/lib/appointments";

type FontSize = "small" | "medium" | "large";

const FONT_SIZE_LABELS: Record<FontSize, string> = {
  small: "Мелкий",
  medium: "Средний",
  large: "Крупный",
};

const FIELD_VIS_LABELS: Record<keyof FormFieldVisibility, string> = {
  show_address: "Адрес",
  show_comment: "Комментарий",
  show_prepaid: "Аванс / предоплата",
  show_payments: "Способы оплаты",
  show_source: "Источник заявки (скоро)",
  show_reminder: "Напоминание клиенту (скоро)",
};

const REQUIRED_LABELS: Record<keyof RequiredFields, string> = {
  require_client: "Клиент обязателен",
  require_phone: "Телефон клиента обязателен",
  require_services: "Услуги обязательны",
  require_address: "Адрес обязателен",
  require_comment: "Комментарий обязателен",
};

const DISABLED_FIELD_VIS: (keyof FormFieldVisibility)[] = [
  "show_source",
  "show_reminder",
];

// ─── Nav cards for sub-settings ────────────────────────────────────────────

const NAV_SECTIONS = [
  {
    href: "/dashboard/settings/calendar",
    icon: "🗓",
    title: "Календарь",
    desc: "Часы работы, шаг сетки, часовой пояс",
  },
  {
    href: "/dashboard/settings/cities",
    icon: "📍",
    title: "Города",
    desc: "Справочник городов для клиентов и записей",
  },
  {
    href: "/dashboard/brigades",
    icon: "👥",
    title: "Финансовые бригады",
    desc: "Состав, оплата, рабочие часы бригад",
  },
  {
    href: "/dashboard/schedule",
    icon: "⏰",
    title: "Расписание команд",
    desc: "Рабочие часы по дням недели для каждой бригады",
  },
  {
    href: "/dashboard/sms-templates",
    icon: "💬",
    title: "Шаблоны SMS",
    desc: "Тексты напоминаний и подтверждений",
  },
  {
    href: "/dashboard/services",
    icon: "🔧",
    title: "Услуги и категории",
    desc: "Каталог услуг, цены, длительность",
  },
];

export default function SettingsPage() {
  const { fieldVisibility, setFieldVisibility, requiredFields, setRequiredFields } =
    useFormSettings();

  const [appointmentFontSize, setAppointmentFontSize] = useState<FontSize>("medium");
  const [timeFontSize, setTimeFontSize] = useState<FontSize>("medium");
  const [use12HourFormat, setUse12HourFormat] = useState(false);
  const [firstDayOfWeek, setFirstDayOfWeek] = useState<"monday" | "sunday">("monday");

  const toggleFieldVis = (key: keyof FormFieldVisibility) => {
    if (DISABLED_FIELD_VIS.includes(key)) return;
    setFieldVisibility({ ...fieldVisibility, [key]: !fieldVisibility[key] });
  };

  const toggleRequired = (key: keyof RequiredFields) => {
    setRequiredFields({ ...requiredFields, [key]: !requiredFields[key] });
  };

  return (
    <>
      <PageHeader title="Настройки" />

      <div className="flex-1 overflow-y-auto bg-gray-50">
        <div className="max-w-3xl mx-auto p-3 lg:p-4 space-y-4">

          {/* Sub-settings navigation */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="px-4 pt-3 pb-2 text-xs font-semibold text-gray-400 uppercase">
              Разделы
            </div>
            <div className="divide-y divide-gray-50">
              {NAV_SECTIONS.map((s) => (
                <Link
                  key={s.href}
                  href={s.href}
                  className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50 active:bg-gray-100 transition-colors"
                >
                  <span className="text-xl w-7 text-center shrink-0">{s.icon}</span>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-gray-900">{s.title}</div>
                    <div className="text-[11px] text-gray-400 mt-0.5">{s.desc}</div>
                  </div>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-gray-300 shrink-0">
                    <path d="M9 18l6-6-6-6" />
                  </svg>
                </Link>
              ))}
            </div>
          </div>

          {/* Display settings */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-[0_1px_2px_0_rgba(15,23,42,0.04),0_1px_3px_0_rgba(15,23,42,0.06)] p-4 space-y-5">
            <div>
              <div className="text-xs font-semibold text-gray-400 uppercase mb-2">
                Учетная запись
              </div>
              <div className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-600">
                airfix.cy@gmail.com
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Размер шрифта в записях
              </label>
              <select
                value={appointmentFontSize}
                onChange={(e) => setAppointmentFontSize(e.target.value as FontSize)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent bg-white"
              >
                {(Object.keys(FONT_SIZE_LABELS) as FontSize[]).map((size) => (
                  <option key={size} value={size}>
                    {FONT_SIZE_LABELS[size]}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Размер шрифта времени
              </label>
              <select
                value={timeFontSize}
                onChange={(e) => setTimeFontSize(e.target.value as FontSize)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent bg-white"
              >
                {(Object.keys(FONT_SIZE_LABELS) as FontSize[]).map((size) => (
                  <option key={size} value={size}>
                    {FONT_SIZE_LABELS[size]}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-center justify-between">
              <label className="text-sm font-medium text-gray-700">
                12-часовой формат времени
              </label>
              <button
                type="button"
                onClick={() => setUse12HourFormat(!use12HourFormat)}
                className={`relative w-11 h-6 rounded-full transition-colors ${
                  use12HourFormat ? "bg-indigo-600" : "bg-gray-300"
                }`}
                aria-label="Переключить 12-часовой формат"
              >
                <span
                  className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${
                    use12HourFormat ? "translate-x-5" : "translate-x-0"
                  }`}
                />
              </button>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Первый день недели
              </label>
              <select
                value={firstDayOfWeek}
                onChange={(e) =>
                  setFirstDayOfWeek(e.target.value as "monday" | "sunday")
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent bg-white"
              >
                <option value="monday">Понедельник</option>
                <option value="sunday">Воскресенье</option>
              </select>
            </div>
          </div>

          {/* Form field visibility */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-[0_1px_2px_0_rgba(15,23,42,0.04),0_1px_3px_0_rgba(15,23,42,0.06)] p-4">
            <div className="text-sm font-semibold text-gray-700 mb-3">
              Поля записи
            </div>
            <div className="space-y-3">
              {(Object.keys(FIELD_VIS_LABELS) as (keyof FormFieldVisibility)[]).map(
                (key) => {
                  const disabled = DISABLED_FIELD_VIS.includes(key);
                  return (
                    <div
                      key={key}
                      className={`flex items-center justify-between ${
                        disabled ? "opacity-50" : ""
                      }`}
                    >
                      <label className="text-sm font-medium text-gray-700">
                        {FIELD_VIS_LABELS[key]}
                      </label>
                      <button
                        type="button"
                        onClick={() => toggleFieldVis(key)}
                        disabled={disabled}
                        className={`relative w-11 h-6 rounded-full transition-colors ${
                          fieldVisibility[key] ? "bg-indigo-600" : "bg-gray-300"
                        } ${disabled ? "cursor-not-allowed" : ""}`}
                        aria-label={FIELD_VIS_LABELS[key]}
                      >
                        <span
                          className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${
                            fieldVisibility[key] ? "translate-x-5" : "translate-x-0"
                          }`}
                        />
                      </button>
                    </div>
                  );
                }
              )}
            </div>
          </div>

          {/* Required fields */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-[0_1px_2px_0_rgba(15,23,42,0.04),0_1px_3px_0_rgba(15,23,42,0.06)] p-4">
            <div className="text-sm font-semibold text-gray-700 mb-3">
              Обязательные поля
            </div>
            <div className="space-y-3">
              {(Object.keys(REQUIRED_LABELS) as (keyof RequiredFields)[]).map(
                (key) => (
                  <div key={key} className="flex items-center justify-between">
                    <label className="text-sm font-medium text-gray-700">
                      {REQUIRED_LABELS[key]}
                    </label>
                    <button
                      type="button"
                      onClick={() => toggleRequired(key)}
                      className={`relative w-11 h-6 rounded-full transition-colors ${
                        requiredFields[key] ? "bg-indigo-600" : "bg-gray-300"
                      }`}
                      aria-label={REQUIRED_LABELS[key]}
                    >
                      <span
                        className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${
                          requiredFields[key] ? "translate-x-5" : "translate-x-0"
                        }`}
                      />
                    </button>
                  </div>
                )
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
