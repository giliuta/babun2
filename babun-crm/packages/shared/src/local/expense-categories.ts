// Custom expense categories with icon + color.

import { generateId } from "./masters";

export interface ExpenseCategory {
  id: string;
  name: string;
  icon: string; // emoji
  color: string; // hex
}

export const DEFAULT_EXPENSE_CATEGORIES: ExpenseCategory[] = [
  { id: "exp-fuel", name: "Бензин", icon: "⛽", color: "#f59e0b" },
  { id: "exp-materials", name: "Материалы", icon: "📦", color: "#3b82f6" },
  { id: "exp-parts", name: "Запчасти", icon: "🔧", color: "#8b5cf6" },
  { id: "exp-salary", name: "Зарплата", icon: "💰", color: "#10b981" },
  { id: "exp-rent", name: "Аренда", icon: "🏢", color: "#ef4444" },
  { id: "exp-other", name: "Прочее", icon: "📋", color: "#6b7280" },
];

const STORAGE_KEY = "babun-expense-categories";

export function loadExpenseCategories(): ExpenseCategory[] {
  if (typeof window === "undefined") return DEFAULT_EXPENSE_CATEGORIES;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_EXPENSE_CATEGORIES;
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) && parsed.length > 0 ? parsed : DEFAULT_EXPENSE_CATEGORIES;
  } catch {
    return DEFAULT_EXPENSE_CATEGORIES;
  }
}

export function saveExpenseCategories(list: ExpenseCategory[]): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
  } catch {
    // ignore
  }
}

export function createBlankExpenseCategory(): ExpenseCategory {
  return {
    id: generateId("exp"),
    name: "",
    icon: "📋",
    color: "#6b7280",
  };
}
