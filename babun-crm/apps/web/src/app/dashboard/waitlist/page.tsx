"use client";

import PageHeader from "@/components/layout/PageHeader";
import { MOCK_WAITLIST } from "@/lib/mock-data";

export default function WaitlistPage() {
  return (
    <>
      <PageHeader title={`Лист ожидания (${MOCK_WAITLIST.length})`} />

      <div className="flex-1 overflow-y-auto bg-gray-50 relative">
        <div className="max-w-3xl mx-auto p-3 lg:p-4">
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            {MOCK_WAITLIST.map((item, index) => (
              <div
                key={item.id}
                className={`px-4 py-3 space-y-1 ${
                  index < MOCK_WAITLIST.length - 1
                    ? "border-b border-gray-100"
                    : ""
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-amber-400 text-white flex items-center justify-center font-bold text-sm shrink-0">
                    {item.client_name.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-semibold text-gray-900">
                      {item.client_name}
                    </div>
                    <div className="text-xs text-gray-500">{item.services}</div>
                  </div>
                </div>
                <div className="pl-[52px] space-y-0.5">
                  <div className="text-xs text-gray-500">
                    Мастер: {item.master}
                  </div>
                  <div className="text-xs text-gray-500">
                    До указанной даты: {item.deadline}
                  </div>
                  <div className="text-xs text-gray-500">Время: {item.time}</div>
                  {item.location && (
                    <div className="text-xs text-gray-500">{item.location}</div>
                  )}
                  <div className="text-xs text-red-500 font-medium">
                    {item.status}
                  </div>
                </div>
              </div>
            ))}
            {MOCK_WAITLIST.length === 0 && (
              <div className="text-center text-gray-400 py-10 text-sm">
                Лист ожидания пуст
              </div>
            )}
          </div>
        </div>

        {/* FAB */}
        <button
          type="button"
          aria-label="Добавить в лист ожидания"
          className="fixed bottom-6 right-6 w-14 h-14 bg-indigo-600 text-white rounded-full shadow-lg flex items-center justify-center text-3xl hover:bg-indigo-700 transition-colors z-20"
        >
          +
        </button>
      </div>
    </>
  );
}
