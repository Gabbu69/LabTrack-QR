export const PAGE_SIZE = 50;
export const HISTORY_STATUSES = ["active", "borrowed", "partial", "incomplete", "returned"] as const;
export const TOOL_STATUSES = ["available", "borrowed", "missing", "unavailable", "archived"] as const;
export type SearchParams = Record<string, string | undefined>;

export function pageNumber(value?: string) {
  const number = Number(value);
  return Number.isSafeInteger(number) && number > 0 && number <= 1_000_000 ? number : 1;
}

// Quoted PostgREST values keep punctuation in user text out of the filter grammar.
export function containsPattern(value: string) {
  const escaped = value.replace(/[\\%_]/g, "\\$&");
  return `"%${escaped.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}%"`;
}

export function manilaDateRange(from?: string, to?: string) {
  for (const date of [from, to]) {
    if (!date) continue;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || Number.isNaN(Date.parse(`${date}T00:00:00Z`)) || new Date(`${date}T00:00:00Z`).toISOString().slice(0, 10) !== date) throw new Error("Enter a valid calendar date.");
  }
  if (from && to && from > to) throw new Error("The From date must be on or before the To date.");
  return { from: from ? new Date(`${from}T00:00:00+08:00`).toISOString() : undefined,
    until: to ? new Date(Date.parse(`${to}T00:00:00+08:00`) + 86_400_000).toISOString() : undefined };
}

export function parseHistoryFilters(params: SearchParams) {
  const q = (params.q ?? params.student ?? "").trim();
  if (q.length > 120) throw new Error("Keep searches to 120 characters or fewer.");
  const status = params.status ?? "";
  if (status && !HISTORY_STATUSES.some((value) => value === status)) throw new Error("Choose a valid transaction status.");
  return { q, status, page: pageNumber(params.page), ...manilaDateRange(params.from, params.to) };
}

export function pageHref(path: string, params: SearchParams, page: number) {
  const query = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => { if (value && key !== "page" && key !== "error" && key !== "message") query.set(key, value); });
  query.set("page", String(page));
  return `${path}?${query}`;
}

export function formatLabDate(value: string) {
  return new Intl.DateTimeFormat("en-PH", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Manila" }).format(new Date(value));
}
