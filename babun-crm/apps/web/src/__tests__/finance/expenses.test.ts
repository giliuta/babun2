import { describe, it, expect, beforeEach } from "vitest";
import { createExpense, filterExpenses, sumExpensesCents, brigadeExpensesTotal } from "@/lib/expenses";

const EXPENSES_KEY = "babun2:finance:expenses";

describe("expenses", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("filterExpenses by scope returns only matching records", () => {
    localStorage.setItem(EXPENSES_KEY, JSON.stringify([]));
    createExpense({ scope: "company", brigadeId: null, appointmentId: null, category: "supplies", description: "Office ink", amountCents: 500, date: "2025-06-01" });
    createExpense({ scope: "brigade", brigadeId: "br_yd", appointmentId: null, category: "lunch", description: "Lunch", amountCents: 1500, date: "2025-06-01" });
    createExpense({ scope: "brigade", brigadeId: "br_dk", appointmentId: null, category: "fuel", description: "Gas", amountCents: 2000, date: "2025-06-01" });

    const company = filterExpenses({ scope: "company" });
    expect(company).toHaveLength(1);
    expect(company[0].description).toBe("Office ink");

    const ydOnly = filterExpenses({ brigadeId: "br_yd" });
    expect(ydOnly).toHaveLength(1);
    expect(ydOnly[0].description).toBe("Lunch");
  });

  it("filterExpenses by date range excludes out-of-range records", () => {
    localStorage.setItem(EXPENSES_KEY, JSON.stringify([]));
    createExpense({ scope: "brigade", brigadeId: "br_yd", appointmentId: null, category: "fuel", description: "June fuel", amountCents: 3000, date: "2025-06-15" });
    createExpense({ scope: "brigade", brigadeId: "br_yd", appointmentId: null, category: "fuel", description: "July fuel", amountCents: 4000, date: "2025-07-15" });

    const june = filterExpenses({ brigadeId: "br_yd", dateFrom: "2025-06-01", dateTo: "2025-06-30" });
    expect(june).toHaveLength(1);
    expect(june[0].description).toBe("June fuel");
  });

  it("sumExpensesCents totals all provided expense amounts", () => {
    localStorage.setItem(EXPENSES_KEY, JSON.stringify([]));
    createExpense({ scope: "company", brigadeId: null, appointmentId: null, category: "supplies", description: "a", amountCents: 1000, date: "2025-06-01" });
    createExpense({ scope: "company", brigadeId: null, appointmentId: null, category: "supplies", description: "b", amountCents: 2500, date: "2025-06-01" });

    const all = filterExpenses({ scope: "company" });
    expect(sumExpensesCents(all)).toBe(3500);
  });

  it("brigadeExpensesTotal sums only expenses for a given brigade", () => {
    localStorage.setItem(EXPENSES_KEY, JSON.stringify([]));
    createExpense({ scope: "brigade", brigadeId: "br_yd", appointmentId: null, category: "lunch", description: "yd lunch", amountCents: 1200, date: "2025-06-01" });
    createExpense({ scope: "brigade", brigadeId: "br_dk", appointmentId: null, category: "lunch", description: "dk lunch", amountCents: 800, date: "2025-06-01" });

    expect(brigadeExpensesTotal("br_yd", "2025-01-01", "2025-12-31")).toBe(1200);
    expect(brigadeExpensesTotal("br_dk", "2025-01-01", "2025-12-31")).toBe(800);
  });
});
