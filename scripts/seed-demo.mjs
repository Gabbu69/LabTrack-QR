import { resetDemoDataFromEnv } from "../src/lib/demo.mjs";

try {
  const result = await resetDemoDataFromEnv();
  process.stdout.write(`Demo reset complete: ${result.accounts.length} accounts, ${result.tools} tools, ${result.transactions.length} transactions.\n`);
} catch (error) {
  process.stderr.write(`Demo reset failed: ${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
}
