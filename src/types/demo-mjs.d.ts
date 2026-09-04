declare module "@/lib/demo.mjs" {
  export function resetDemoDataFromEnv(): Promise<{ accounts: { email: string; role: string }[]; tools: number; transactions: string[] }>;
}
