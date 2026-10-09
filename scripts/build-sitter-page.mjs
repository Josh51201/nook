// Builds the Sitter Sheet web page (SIT-001) into web/sitter/dist/, ready to
// upload to any static web host. Fills in the Supabase URL and public anon
// key from .env (the same two the app uses, safe to be public), so neither
// is ever committed. Run with: npm run build:sitter

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/(\w:)/, "$1")), "..");

const env = {};
const envFile = path.join(root, ".env");
if (existsSync(envFile)) {
  for (const line of readFileSync(envFile, "utf-8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq !== -1) env[trimmed.slice(0, eq).trim()] = trimmed.slice(eq + 1).trim();
  }
}

const url = (process.env.EXPO_PUBLIC_SUPABASE_URL ?? env.EXPO_PUBLIC_SUPABASE_URL ?? "").replace(/\/+$/, "");
const key = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? "";

if (!/^https:\/\/[\w.-]+$/.test(url) || !key) {
  console.error("Set EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY in .env first.");
  process.exit(1);
}
// The page is public, so only the publishable (anon) key may go in it. A
// secret / service_role key there would hand anyone the whole database.
function isSecretKey(value) {
  if (value.startsWith("sb_secret_")) return true;
  try {
    const payload = JSON.parse(Buffer.from(value.split(".")[1] ?? "", "base64url").toString("utf-8"));
    return payload.role === "service_role";
  } catch {
    return false;
  }
}
if (isSecretKey(key)) {
  console.error(
    "EXPO_PUBLIC_SUPABASE_ANON_KEY in .env is a SECRET key. Never put it in the app or this page.\n" +
      "Use the publishable key instead (Supabase → Project Settings → API Keys, starts with sb_publishable_)."
  );
  process.exit(1);
}
if (!/^[\w.-]+$/.test(key)) {
  console.error("EXPO_PUBLIC_SUPABASE_ANON_KEY doesn't look like a key.");
  process.exit(1);
}

const template = readFileSync(path.join(root, "web", "sitter", "index.html"), "utf-8");
const page = template.replaceAll("__SUPABASE_URL__", url).replaceAll("__SUPABASE_ANON_KEY__", key);

const out = path.join(root, "web", "sitter", "dist");
mkdirSync(out, { recursive: true });
writeFileSync(path.join(out, "index.html"), page);
console.log(`Built ${path.relative(root, path.join(out, "index.html"))}. Upload the web/sitter/dist folder to your web host.`);
