import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

export default defineConfig({
  resolve: { alias: { "@": fileURLToPath(new URL("./src", import.meta.url)), "server-only": fileURLToPath(new URL("./tests/support/server-only.ts", import.meta.url)) } },
  // Keep jsdom's per-test storage instead of Node's experimental process storage.
  test: { execArgv: ["--no-experimental-webstorage"], environment: "node", include: ["tests/unit/**/*.test.ts"], coverage: { reporter: ["text"] } },
});
