export function escapeCsv(value: unknown) {
  const text = value == null ? "" : String(value);
  return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

export function toCsv(headers: string[], rows: unknown[][]) {
  return [headers, ...rows].map((row) => row.map(escapeCsv).join(",")).join("\r\n");
}
