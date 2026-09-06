import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";

const project = JSON.parse(readFileSync(".vercel/project.json", "utf8"));
if (project.projectName !== "labtrack-qr") throw new Error("Link the labtrack-qr Vercel project before configuring it.");
const keys = ["NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "SUPABASE_SECRET_KEY", "NEXT_PUBLIC_SITE_URL", "DEMO_ACCOUNT_PASSWORD"];
for (const key of keys) if (!process.env[key]) throw new Error(`Missing ${key}`);
if (new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).hostname !== "tsusogeqjduyahoskteb.supabase.co") {
  throw new Error("Expected the client-selected Gabs Project backend.");
}
for (const key of keys) {
  // Values travel over stdin, never in shell text or process arguments.
  const args = ["vercel@59.11.7", "env", "add", key, "production,preview", "--yes", "--force"];
  args.push(key.startsWith("NEXT_PUBLIC_") ? "--no-sensitive" : "--sensitive");
  const result = spawnSync(process.platform === "win32" ? "npx.cmd" : "npx", args, {
    shell: process.platform === "win32", input: process.env[key], encoding: "utf8", timeout: 60000,
  });
  if (result.status !== 0) {
    const detail = (result.stderr || result.stdout || result.error?.message || "Vercel command failed")
      .replaceAll(process.env[key], "[REDACTED]").replace(/eyJ[\w.-]+|sb_(?:secret|publishable)_[\w-]+/g, "[REDACTED]");
    throw new Error(`Could not configure ${key}: ${detail}`);
  }
  console.log(`Configured ${key} for Preview and Production.`);
}
