"use client";

import { MOCK_WAITLIST } from "@/lib/mock-data";

interface WaitlistDialogProps {
  open: boolean;
  onClose: () => void;
}

export default function WaitlistDialog({ open, onClose }: WaitlistDialogProps) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white rounded-xl shadow-lg w-full max-w-lg max-h-[85vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="bg-indigo-600 text-white px-4 py-3 flex items-center gap-2">
          <h2 className="flex-1 text-base font-semibold">
            Лист ожидания ({MOCK_WAITLIST.length})
          </h2>
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto">
          {MOCK_WAITLIST.map((item) => (
            <div
              key={item.id}
              className="px-4 py-3 border-b border-gray-100 space-y-1"
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
                <div className="text-xs text-gray-500">
                  Время: {item.time}
                </div>
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

        {/* Bottom */}
        <div className="px-4 py-3 border-t border-gray-200 flex items-center">
          <button
            onClick={onClose}
            className="flex-1 text-center text-sm text-gray-600 hover:text-gray-900"
          >
            Закрыть
          </button>
        </div>

        {/* FAB */}
        <button className="absolute bottom-20 right-8 w-12 h-12 bg-indigo-600 text-white rounded-full shadow-lg flex items-center justify-center text-2xl hover:bg-indigo-700 transition-colors">
          +
        </button>
      </div>
    </div>
  );
}
