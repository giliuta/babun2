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
