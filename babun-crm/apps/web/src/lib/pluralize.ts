// Russian pluralization: 1 кондиционер, 2 кондиционера, 5 кондиционеров
export function pluralize(n: number, one: string, few: string, many: string): string {
  const abs = Math.abs(n);
  const last2 = abs % 100;
  const last1 = abs % 10;
  if (last2 >= 11 && last2 <= 19) return `${n} ${many}`;
  if (last1 === 1) return `${n} ${one}`;
  if (last1 >= 2 && last1 <= 4) return `${n} ${few}`;
  return `${n} ${many}`;
}

export function pluralizeAC(n: number): string {
  return pluralize(n, "кондиционер", "кондиционера", "кондиционеров");
}

/**
 * Returns just the word form (without the leading number). Useful when
 * the number lives in its own DOM node (e.g. coloured chip + label).
 *
 *   countWordRu(1, "запись", "записи", "записей") === "запись"
 *   countWordRu(5, "запись", "записи", "записей") === "записей"
 */
export function countWordRu(n: number, one: string, few: string, many: string): string {
  const abs = Math.abs(n);
  const last2 = abs % 100;
  const last1 = abs % 10;
  if (last2 >= 11 && last2 <= 19) return many;
  if (last1 === 1) return one;
  if (last1 >= 2 && last1 <= 4) return few;
  return many;
}

// Common app vocabulary so call sites stay typo-free.
export const pluralRecord = (n: number) =>
  pluralize(n, "запись", "записи", "записей");
export const pluralClient = (n: number) =>
  pluralize(n, "клиент", "клиента", "клиентов");
export const pluralVisit = (n: number) =>
  pluralize(n, "визит", "визита", "визитов");
export const pluralMessage = (n: number) =>
  pluralize(n, "сообщение", "сообщения", "сообщений");
