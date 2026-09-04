import type { ItemStatus, TransactionStatus } from "@/types/app";

export function appendUniqueScan<T extends { token: string }>(items: T[], item: T) {
  if (items.some((existing) => existing.token === item.token)) throw new Error("Duplicate scan");
  return [...items, item];
}

export function deriveTransactionStatus(itemStatuses: ItemStatus[]): TransactionStatus {
  if (itemStatuses.length > 0 && itemStatuses.every((status) => status === "returned")) return "returned";
  if (itemStatuses.includes("missing")) return "incomplete";
  if (itemStatuses.includes("returned")) return "partial";
  return "borrowed";
}
