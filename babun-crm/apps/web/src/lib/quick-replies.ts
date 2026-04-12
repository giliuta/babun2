// Quick reply templates for the chat input. Tapping a template
// inserts its text into the message input (does NOT auto-send).

export interface QuickReply {
  id: string;
  emoji: string;
  title: string;
  text: string;
  sort_order: number;
}

export const QUICK_REPLIES: QuickReply[] = [
  {
    id: "qr-1",
    emoji: "👋",
    title: "Приветствие",
    text: "Добрый день! Чем могу помочь?",
    sort_order: 1,
  },
  {
    id: "qr-2",
    emoji: "💰",
    title: "Цена чистки",
    text: "Стоимость чистки: €50 за единицу, от 3 шт — €45/шт. Включает промывку фильтров, дезинфекцию и проверку.",
    sort_order: 2,
  },
  {
    id: "qr-3",
    emoji: "📍",
    title: "Запрос адреса",
    text: "Подскажите, пожалуйста, ваш адрес и удобное время для визита?",
    sort_order: 3,
  },
  {
    id: "qr-4",
    emoji: "✅",
    title: "Подтверждение",
    text: "Отлично! Мастер будет у вас в назначенное время. Пожалуйста, обеспечьте доступ к кондиционерам.",
    sort_order: 4,
  },
  {
    id: "qr-5",
    emoji: "🕐",
    title: "Перенос",
    text: "К сожалению, нужно перенести визит. Какая дата и время вам подойдут?",
    sort_order: 5,
  },
  {
    id: "qr-6",
    emoji: "🌡",
    title: "Районы",
    text: "Мы обслуживаем Лимассол, Пафос, Ларнаку и Никосию.",
    sort_order: 6,
  },
  {
    id: "qr-7",
    emoji: "⭐",
    title: "Просьба отзыва",
    text: "Спасибо что выбрали AirFix! Будем очень благодарны за отзыв на Google Maps ❤️",
    sort_order: 7,
  },
];
