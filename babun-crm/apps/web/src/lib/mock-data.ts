// Mock data for visual testing while database is empty

export interface MockAppointment {
  id: string;
  date: string; // YYYY-MM-DD
  time_start: string; // HH:MM
  time_end: string; // HH:MM
  client_name: string;
  client_phone: string;
  service_name: string;
  amount: number;
  comment: string;
  color: "blue" | "green" | "red" | "purple";
  team_id: string;
}

export interface MockTeam {
  id: string;
  name: string;
  color: string;
}

export const MOCK_TEAMS: MockTeam[] = [
  { id: "team-1", name: "Y&D", color: "#6366f1" },
  { id: "team-2", name: "D&K", color: "#8b5cf6" },
];

// Helper to get current week dates
function getWeekDates(baseDate: Date): string[] {
  const dates: string[] = [];
  const day = baseDate.getDay();
  const monday = new Date(baseDate);
  monday.setDate(baseDate.getDate() - (day === 0 ? 6 : day - 1));

  for (let i = 0; i < 7; i++) {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    dates.push(d.toISOString().split("T")[0]);
  }
  return dates;
}

export function getMockAppointments(weekStartDate: Date): MockAppointment[] {
  const dates = getWeekDates(weekStartDate);

  return [
    {
      id: "apt-1",
      date: dates[0],
      time_start: "09:00",
      time_end: "11:00",
      client_name: "Иванов Андрей",
      client_phone: "+357 99 123456",
      service_name: "x4 A/C Чистка",
      amount: 160,
      comment: "4 внутренних блока, 1 наружный. Лимассол, ул. Макариос 42",
      color: "blue",
      team_id: "team-1",
    },
    {
      id: "apt-2",
      date: dates[0],
      time_start: "12:00",
      time_end: "13:30",
      client_name: "Петрова Мария",
      client_phone: "+357 96 654321",
      service_name: "x2 A/C Чистка",
      amount: 80,
      comment: "Квартира, 2-й этаж",
      color: "blue",
      team_id: "team-1",
    },
    {
      id: "apt-3",
      date: dates[1],
      time_start: "10:00",
      time_end: "12:00",
      client_name: "Козлов Дмитрий",
      client_phone: "+357 97 111222",
      service_name: "x3 A/C Установка",
      amount: 450,
      comment: "Новая квартира, установка 3 сплит-систем",
      color: "purple",
      team_id: "team-1",
    },
    {
      id: "apt-4",
      date: dates[1],
      time_start: "14:00",
      time_end: "15:00",
      client_name: "Смирнова Елена",
      client_phone: "+357 99 333444",
      service_name: "x1 A/C Диагностика",
      amount: 40,
      comment: "Кондиционер не охлаждает",
      color: "green",
      team_id: "team-1",
    },
    {
      id: "apt-5",
      date: dates[2],
      time_start: "08:00",
      time_end: "10:00",
      client_name: "Николаев Сергей",
      client_phone: "+357 96 555666",
      service_name: "x6 A/C Чистка",
      amount: 240,
      comment: "Офис, 6 блоков. Пафос",
      color: "blue",
      team_id: "team-2",
    },
    {
      id: "apt-6",
      date: dates[2],
      time_start: "11:00",
      time_end: "12:30",
      client_name: "Орлова Анна",
      client_phone: "+357 99 777888",
      service_name: "x2 A/C Заправка",
      amount: 120,
      comment: "Заправка фреоном R410A",
      color: "green",
      team_id: "team-2",
    },
    {
      id: "apt-7",
      date: dates[3],
      time_start: "09:00",
      time_end: "10:30",
      client_name: "Федоров Алексей",
      client_phone: "+357 97 999000",
      service_name: "x2 A/C Чистка",
      amount: 80,
      comment: "",
      color: "blue",
      team_id: "team-1",
    },
    {
      id: "apt-8",
      date: dates[3],
      time_start: "13:00",
      time_end: "14:00",
      client_name: "",
      client_phone: "",
      service_name: "Обед / перерыв",
      amount: 0,
      comment: "Перерыв между клиентами",
      color: "red",
      team_id: "team-1",
    },
    {
      id: "apt-9",
      date: dates[4],
      time_start: "10:00",
      time_end: "13:00",
      client_name: "Белов Виктор",
      client_phone: "+357 96 222333",
      service_name: "x4 A/C Установка",
      amount: 600,
      comment: "Вилла, 4 инверторных сплит-системы Daikin",
      color: "purple",
      team_id: "team-2",
    },
    {
      id: "apt-10",
      date: dates[4],
      time_start: "15:00",
      time_end: "16:30",
      client_name: "Кузнецова Ольга",
      client_phone: "+357 99 444555",
      service_name: "x1 A/C Ремонт",
      amount: 90,
      comment: "Замена компрессора, утечка фреона",
      color: "green",
      team_id: "team-2",
    },
    {
      id: "apt-11",
      date: dates[5],
      time_start: "09:00",
      time_end: "11:00",
      client_name: "Морозов Павел",
      client_phone: "+357 97 666777",
      service_name: "x3 A/C Чистка",
      amount: 120,
      comment: "Таунхаус, 3 сплита",
      color: "blue",
      team_id: "team-1",
    },
    {
      id: "apt-12",
      date: dates[6],
      time_start: "10:00",
      time_end: "11:00",
      client_name: "",
      client_phone: "",
      service_name: "Встреча с поставщиком",
      amount: 0,
      comment: "Обсуждение новых моделей",
      color: "red",
      team_id: "team-1",
    },
  ];
}

// ─── Mock Clients ────────────────────────────────────────────────────────────

export interface MockClient {
  id: string;
  full_name: string;
  phone: string;
  sms_name: string;
  balance: number;
  discount: number;
  comment: string;
}

export const MOCK_CLIENTS: MockClient[] = [
  { id: "1", full_name: "Анастасия Петрова", phone: "+35799352086", sms_name: "Анастасия", balance: 0, discount: 0, comment: "Повторная чистка" },
  { id: "2", full_name: "John Thompson", phone: "+35796123456", sms_name: "John", balance: 45, discount: 0, comment: "4 гри, заправка" },
  { id: "3", full_name: "Александр Сидоров", phone: "+35797654321", sms_name: "Александр", balance: 0, discount: 5, comment: "" },
  { id: "4", full_name: "Светлана Козлова", phone: "+35798765432", sms_name: "Светлана", balance: 0, discount: 0, comment: "2 Lg, заправка верхнего" },
  { id: "5", full_name: "Angela Martinez", phone: "+35791234567", sms_name: "Angela", balance: 0, discount: 0, comment: "Мадам, раньше 15.00 не может" },
  { id: "6", full_name: "Johannes Weber", phone: "+35792345678", sms_name: "Johannes", balance: 0, discount: 0, comment: "" },
  { id: "7", full_name: "Сергей Морозов", phone: "+35793456789", sms_name: "Сергей", balance: 135, discount: 10, comment: "Пиргос" },
  { id: "8", full_name: "Ольга Новикова", phone: "+35794567890", sms_name: "Ольга", balance: 0, discount: 0, comment: "3 аукс" },
  { id: "9", full_name: "Laima Berzina", phone: "+35795678901", sms_name: "Laima", balance: 0, discount: 0, comment: "Говорит на англ." },
  { id: "10", full_name: "Руслан Абрамов", phone: "+35796789012", sms_name: "Руслан", balance: 0, discount: 0, comment: "" },
  { id: "11", full_name: "Надежда Волкова", phone: "+35797890123", sms_name: "Надежда", balance: 0, discount: 0, comment: "Никосия" },
  { id: "12", full_name: "Marina Antoniou", phone: "+35798901234", sms_name: "Marina", balance: 0, discount: 0, comment: "5шт кабинет" },
];

// ─── Mock Client Appointments (for Client Card "Записи" tab) ────────────────

export interface MockClientAppointment {
  id: string;
  client_id: string;
  date: string;
  master: string;
  service: string;
  address: string;
  amount: number;
  status: "completed" | "cancelled" | "new" | "online";
}

export const MOCK_CLIENT_APPOINTMENTS: MockClientAppointment[] = [
  { id: "ca-1", client_id: "1", date: "09.04.2026", master: "Y&D", service: "x2 A/C Чистка", address: "Лимассол", amount: 80, status: "completed" },
  { id: "ca-2", client_id: "1", date: "15.01.2026", master: "Y&D", service: "x3 A/C Чистка", address: "Лимассол", amount: 120, status: "completed" },
  { id: "ca-3", client_id: "2", date: "02.03.2026", master: "D&K", service: "x4 A/C Заправка", address: "Ларнака", amount: 160, status: "completed" },
  { id: "ca-4", client_id: "7", date: "20.02.2026", master: "Y&D", service: "x1 A/C Диагностика", address: "Пиргос", amount: 40, status: "cancelled" },
  { id: "ca-5", client_id: "7", date: "11.03.2026", master: "Y&D", service: "x2 A/C Чистка", address: "Пиргос", amount: 80, status: "completed" },
];

// ─── Mock Financial Data ─────────────────────────────────────────────────────

export interface MockReport {
  period: string;
  income: number;
  expenses: number;
  profit: number;
}

export const MOCK_REPORTS: MockReport[] = [
  { period: "Янв 2026", income: 8180, expenses: 2955, profit: 5225 },
  { period: "Фев 2026", income: 3430, expenses: 2025, profit: 1405 },
  { period: "Мар 2026", income: 7445, expenses: 6385, profit: 1060 },
  { period: "Апр 2026", income: 5190, expenses: 2275, profit: 2915 },
];

// ─── Mock Income Entries ─────────────────────────────────────────────────────

export interface MockIncomeEntry {
  id: string;
  date: string;
  description: string;
  amount: number;
  team: string;
  category: string;
}

export const MOCK_INCOME: MockIncomeEntry[] = [
  { id: "inc-1", date: "09.04.2026", description: "x4 A/C Чистка — Иванов А.", amount: 160, team: "Y&D", category: "Услуги" },
  { id: "inc-2", date: "09.04.2026", description: "x2 A/C Чистка — Петрова М.", amount: 80, team: "Y&D", category: "Услуги" },
  { id: "inc-3", date: "08.04.2026", description: "x3 A/C Установка — Козлов Д.", amount: 450, team: "Y&D", category: "Услуги" },
  { id: "inc-4", date: "08.04.2026", description: "x1 A/C Диагностика — Смирнова Е.", amount: 40, team: "Y&D", category: "Услуги" },
  { id: "inc-5", date: "07.04.2026", description: "x6 A/C Чистка — Николаев С.", amount: 240, team: "D&K", category: "Услуги" },
  { id: "inc-6", date: "07.04.2026", description: "x2 A/C Заправка — Орлова А.", amount: 120, team: "D&K", category: "Услуги" },
  { id: "inc-7", date: "06.04.2026", description: "x2 A/C Чистка — Федоров А.", amount: 80, team: "Y&D", category: "Услуги" },
  { id: "inc-8", date: "05.04.2026", description: "x4 A/C Установка — Белов В.", amount: 600, team: "D&K", category: "Услуги" },
];

// ─── Mock Expense Entries ────────────────────────────────────────────────────

export interface MockExpenseEntry {
  id: string;
  date: string;
  description: string;
  amount: number;
  team: string;
  category: string;
}

export const MOCK_EXPENSES: MockExpenseEntry[] = [
  { id: "exp-1", date: "09.04.2026", description: "Бензин", amount: 55, team: "Y&D", category: "Транспорт" },
  { id: "exp-2", date: "08.04.2026", description: "Фреон R410A (5 кг)", amount: 180, team: "Y&D", category: "Материалы" },
  { id: "exp-3", date: "07.04.2026", description: "Бензин", amount: 60, team: "D&K", category: "Транспорт" },
  { id: "exp-4", date: "06.04.2026", description: "Запчасти — компрессор", amount: 320, team: "D&K", category: "Материалы" },
  { id: "exp-5", date: "05.04.2026", description: "Бензин", amount: 50, team: "Y&D", category: "Транспорт" },
  { id: "exp-6", date: "04.04.2026", description: "Химия для чистки", amount: 95, team: "Y&D", category: "Материалы" },
];

// ─── Mock Waitlist ───────────────────────────────────────────────────────────

export interface MockWaitlistItem {
  id: string;
  client_name: string;
  services: string;
  master: string;
  deadline: string;
  time: string;
  location: string;
  status: string;
}

export const MOCK_WAITLIST: MockWaitlistItem[] = [
  { id: "1", client_name: "Руслан", services: "Услуги: 1 (2 ч. 30 мин.)", master: "AirFix", deadline: "08.10.2025", time: "любое время", location: "", status: "Не актуально" },
  { id: "2", client_name: "Илья", services: "Услуги: 1 (2 ч.)", master: "AirFix", deadline: "01.09.2025", time: "любое время", location: "Ларнака", status: "Не актуально" },
  { id: "3", client_name: "Надежда", services: "Услуги: 1 (3 ч. 30 мин.)", master: "AirFix", deadline: "30.11.2025", time: "любое время", location: "Никосия", status: "Не актуально" },
];
