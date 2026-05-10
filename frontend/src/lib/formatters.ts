type CurrencyOptions = {
  currency?: string;
  locale?: string;
};

export function formatCurrency(
  value: number | string | null | undefined,
  options: CurrencyOptions = {},
) {
  const amount = Number(value ?? 0);
  const currency = options.currency ?? "NGN";
  const locale = options.locale ?? "en-NG";

  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
    maximumFractionDigits: 2,
  }).format(Number.isFinite(amount) ? amount : 0);
}

export function formatNumber(value: number | string | null | undefined) {
  const amount = Number(value ?? 0);

  return new Intl.NumberFormat("en-NG").format(
    Number.isFinite(amount) ? amount : 0,
  );
}

export function formatDate(value: string | Date | null | undefined) {
  if (!value) return "—";

  const date = value instanceof Date ? value : new Date(value);

  if (Number.isNaN(date.getTime())) return "—";

  return new Intl.DateTimeFormat("en-NG", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
}

export function formatDateTime(value: string | Date | null | undefined) {
  if (!value) return "—";

  const date = value instanceof Date ? value : new Date(value);

  if (Number.isNaN(date.getTime())) return "—";

  return new Intl.DateTimeFormat("en-NG", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

export function formatPercent(value: number | string | null | undefined) {
  const amount = Number(value ?? 0);

  return `${Number.isFinite(amount) ? amount : 0}%`;
}

export function truncateText(value: string | null | undefined, maxLength = 80) {
  const text = value ?? "";

  if (text.length <= maxLength) return text;

  return `${text.slice(0, maxLength).trim()}...`;
}
