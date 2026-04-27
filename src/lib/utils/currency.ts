export function formatCurrency(
  amount: number,
  currency = "CLP",
  locale = "es-CL"
): string {
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
    minimumFractionDigits: currency === "CLP" ? 0 : 2,
    maximumFractionDigits: currency === "CLP" ? 0 : 2,
  }).format(amount);
}

export function formatPct(value: number, decimals = 2): string {
  const sign = value >= 0 ? "+" : "";
  return `${sign}${value.toFixed(decimals)}%`;
}

export function formatCompact(amount: number, currency = "CLP"): string {
  const locale = currency === "CLP" ? "es-CL" : "en-US";
  const formatted = new Intl.NumberFormat(locale, {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(amount);
  return currency === "CLP" ? `$${formatted}` : `${formatted} ${currency}`;
}
