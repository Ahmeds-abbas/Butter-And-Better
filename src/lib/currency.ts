export function formatGBP(priceInPence: number): string {
  const normalizedPence = Math.round(priceInPence);

  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
    minimumFractionDigits: normalizedPence % 100 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(normalizedPence / 100);
}

export function formatGBPFromPounds(priceInPounds: number): string {
  return formatGBP(Math.round(priceInPounds * 100));
}
