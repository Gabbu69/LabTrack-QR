import type { DashboardMetrics, Tool, Transaction } from "@/types/app";

export function calculateDashboardMetrics(tools: Pick<Tool, "status">[], transactions: Pick<Transaction, "status">[]): DashboardMetrics {
  const visible = tools.filter((tool) => tool.status !== "archived");
  return {
    total: visible.length,
    available: visible.filter((tool) => tool.status === "available").length,
    borrowed: visible.filter((tool) => tool.status === "borrowed").length,
    missing: visible.filter((tool) => tool.status === "missing").length,
    activeTransactions: transactions.filter((transaction) => transaction.status !== "returned").length,
  };
}
