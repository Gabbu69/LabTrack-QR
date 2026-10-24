import { readFile, writeFile, mkdir } from "node:fs/promises";
import { resolve, dirname } from "node:path";
import { createClient } from "@supabase/supabase-js";
import { createCustodianInvitation, readCustodianInvitation } from "../src/lib/custodian-invitation.ts";

// Owner-side tool only: no public endpoint can issue staff setup links.
// Usage: node --env-file=.env.local scripts/create-custodian-invitation.mjs request.json
const requestPath = process.argv[2];
if (!requestPath) throw new Error("Provide a private JSON file with name, email, and siteUrl.");
const input = JSON.parse(await readFile(requestPath, "utf8"));
const site = new URL(input.siteUrl);
if (site.username || site.password || !(["localhost", "127.0.0.1"].includes(site.hostname) || site.origin === "https://labtrack-qr.vercel.app")) throw new Error("Use the verified local application or LabTrack production URL.");
if (process.env.NEXT_PUBLIC_SUPABASE_URL !== "https://tsusogeqjduyahoskteb.supabase.co") throw new Error("Unexpected Supabase project.");
const secret = process.env.SUPABASE_SECRET_KEY;
if (!secret) throw new Error("Server credentials are required.");
const token = createCustodianInvitation({ name: input.name, email: input.email }, secret);
const invitation = readCustodianInvitation(token, secret);
const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, secret, { auth: { persistSession: false, autoRefreshToken: false } });
const { data, error } = await admin.from("profiles").select("id").eq("email", invitation.email).maybeSingle();
if (error) throw new Error("Existing-account check failed. No setup link was created.");
if (data) throw new Error("This email already has a LabTrack account. Use its existing sign-in or authorized recovery; setup cannot replace it.");
const url = new URL("/setup-custodian", site.origin);
url.searchParams.set("invitation", token);
const output = resolve("output/private/custodian-setup-link.json");
await mkdir(dirname(output), { recursive: true });
await writeFile(output, JSON.stringify({ name: invitation.name, email: invitation.email, expiresAt: new Date(invitation.expires * 1000).toISOString(), url: url.href }, null, 2), { flag: "w" });
console.log(JSON.stringify({ name: invitation.name, email: invitation.email, expiresAt: new Date(invitation.expires * 1000).toISOString(), privateLinkFile: output }));
