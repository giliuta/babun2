import { describe, it, expect, beforeEach } from "vitest";
import { renderTemplate, DEFAULT_NOTIFICATION_TEMPLATES } from "@/lib/notifications";
import type { NotificationContext } from "@/lib/notifications";

describe("notifications.renderTemplate", () => {
  const smsTemplate = DEFAULT_NOTIFICATION_TEMPLATES.find((t) => t.id === "ntpl-reminder-sms")!;
  const waTemplate = DEFAULT_NOTIFICATION_TEMPLATES.find((t) => t.id === "ntpl-reminder-wa")!;

  const fullContext: NotificationContext = {
    clientName: "Иван",
    serviceList: "Чистка кондиционера",
    date: "20.06.2025",
    time: "10:00",
    address: "ул. Лимассол, 12",
    brigadeName: "Y&D",
    totalEur: "€80",
  };

  beforeEach(() => {
    localStorage.clear();
  });

  it("substitutes all placeholders in SMS template", () => {
    const result = renderTemplate(smsTemplate, fullContext);
    expect(result).toContain("Иван");
    expect(result).toContain("Чистка кондиционера");
    expect(result).toContain("20.06.2025");
    expect(result).toContain("10:00");
    expect(result).toContain("ул. Лимассол, 12");
    expect(result).toContain("€80");
    expect(result).not.toContain("{clientName}");
    expect(result).not.toContain("{serviceList}");
  });

  it("substitutes brigadeName in WhatsApp template", () => {
    const result = renderTemplate(waTemplate, fullContext);
    expect(result).toContain("Y&D");
    expect(result).not.toContain("{brigadeName}");
  });

  it("leaves unresolved placeholders as-is when context key is missing", () => {
    const partialContext: NotificationContext = {
      clientName: "Анна",
      date: "21.06.2025",
    };
    const result = renderTemplate(smsTemplate, partialContext);
    expect(result).toContain("Анна");
    expect(result).toContain("21.06.2025");
    // missing fields remain
    expect(result).toContain("{time}");
    expect(result).toContain("{address}");
    expect(result).toContain("{serviceList}");
    expect(result).toContain("{totalEur}");
  });

  it("handles empty string context values by leaving placeholder as-is", () => {
    const ctx: NotificationContext = { ...fullContext, address: "" };
    const result = renderTemplate(smsTemplate, ctx);
    expect(result).toContain("{address}");
  });
});
