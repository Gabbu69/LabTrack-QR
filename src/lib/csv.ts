export function escapeCsv(value: unknown) {
  const raw = value == null ? "" : String(value);
  // Spreadsheet applications interpret formula prefixes even inside quoted CSV cells.
  const text = /^[\s]*[=+@-]|^[\t\r\n]/.test(raw) ? `'${raw}` : raw;
  return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

export function toCsv(headers: string[], rows: unknown[][]) {
  return [headers, ...rows].map((row) => row.map(escapeCsv).join(",")).join("\r\n");
}
