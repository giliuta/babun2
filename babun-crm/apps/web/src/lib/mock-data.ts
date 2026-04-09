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
