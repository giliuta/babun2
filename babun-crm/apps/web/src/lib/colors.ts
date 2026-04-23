// Unified colour palette used everywhere a user picks a colour —
// brigade tile, city/Метка tile, service-group tile, service tile.
// 14 iOS system colours laid out as a clean 7×2 grid. Each carries
// a Russian label for a11y.

export interface ColorPreset {
  name: string;
  value: string;
}

export const PRESET_COLORS: ColorPreset[] = [
  { name: "Голубой",     value: "#32ADE6" },
  { name: "Синий",       value: "#007AFF" },
  { name: "Индиго",      value: "#5856D6" },
  { name: "Фиолетовый",  value: "#AF52DE" },
  { name: "Сиреневый",   value: "#BF5AF2" },
  { name: "Розовый",     value: "#FF2D55" },
  { name: "Красный",     value: "#FF3B30" },
  { name: "Оранжевый",   value: "#FF9500" },
  { name: "Жёлтый",      value: "#FFCC00" },
  { name: "Зелёный",     value: "#34C759" },
  { name: "Мята",        value: "#00C7BE" },
  { name: "Бирюзовый",   value: "#30B0C7" },
  { name: "Коричневый",  value: "#A2845E" },
  { name: "Серый",       value: "#8E8E93" },
];

export const PRESET_COLOR_VALUES: string[] = PRESET_COLORS.map((c) => c.value);
