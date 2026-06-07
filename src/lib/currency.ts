export const CURRENCIES = [
  { code: "ZAR", symbol: "R", label: "South African Rand" },
  { code: "USD", symbol: "$", label: "US Dollar" },
  { code: "MWK", symbol: "MK", label: "Malawi Kwacha" },
] as const;

export type CurrencyCode = (typeof CURRENCIES)[number]["code"];

export function formatMoney(amount: number, currency: string) {
  const c = CURRENCIES.find((x) => x.code === currency) ?? CURRENCIES[0];
  const n = (amount ?? 0).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 });
  return `${c.symbol}${n}`;
}
