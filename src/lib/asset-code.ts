export function normalizeAssetPrefix(value: string) {
  return value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 10);
}

export function formatAssetCode(prefix: string, sequence: number) {
  const normalized = normalizeAssetPrefix(prefix);
  if (normalized.length < 2) throw new Error("Asset prefix must contain at least two letters or numbers.");
  if (!Number.isInteger(sequence) || sequence < 1 || sequence > 999999) throw new Error("Asset sequence is outside the supported range.");
  return `${normalized}-${String(sequence).padStart(3, "0")}`;
}
