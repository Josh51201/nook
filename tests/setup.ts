import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

// Minimal .env loader so `vitest` picks up the same EXPO_PUBLIC_* vars the
// app uses, plus test-only secrets from .env.test.local. No dependency on
// dotenv — this repo has no other reason to need it.
function loadEnvFile(filename: string) {
  const fullPath = path.resolve(process.cwd(), filename);
  if (!existsSync(fullPath)) return;

  for (const line of readFileSync(fullPath, "utf-8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;

    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;

    const key = trimmed.slice(0, eq).trim();
    const value = trimmed.slice(eq + 1).trim();
    if (!(key in process.env)) process.env[key] = value;
  }
}

loadEnvFile(".env");
loadEnvFile(".env.test.local");
