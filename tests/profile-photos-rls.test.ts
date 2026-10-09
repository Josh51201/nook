import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

// Profile photos (PROF-006), enforced in Postgres and Storage. Same setup as
// gift-nook-rls.test.ts (needs .env plus SUPABASE_SERVICE_ROLE_KEY in
// .env.test.local); skipped without them.

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL;
const ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const canRun = Boolean(SUPABASE_URL && ANON_KEY && SERVICE_ROLE_KEY);
const PNG = Uint8Array.from([137, 80, 78, 71, 13, 10, 26, 10]);

describe.runIf(canRun)("Profile photos: seen by whoever sees the profile, changed only by its person", () => {
  let admin: SupabaseClient;
  const runId = Date.now();
  // josh and sarah share a Burrow; josh looks after Mia (a kid profile in
  // it). teen is Mia's own new account. stranger shares nothing.
  const people = ["josh", "sarah", "teen", "stranger"] as const;
  type Person = (typeof people)[number];
  const ids = {} as Record<Person, string>;
  const clients = {} as Record<Person, SupabaseClient>;
  let miaId: string;
  const uploaded: string[] = [];

  const sees = async (person: Person, path: string) => !(await clients[person].storage.from("avatars").download(path)).error;
  const upload = async (person: Person, path: string) => {
    const result = await clients[person].storage.from("avatars").upload(path, PNG, { contentType: "image/png" });
    if (!result.error) uploaded.push(path);
    return result.error;
  };

  beforeAll(async () => {
    admin = createClient(SUPABASE_URL!, SERVICE_ROLE_KEY!, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    for (const person of people) {
      const email = `photos-${person}-${runId}@example.com`;
      const password = `photos-${person}-pw!`;
      const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
      if (error || !data.user) throw error;
      ids[person] = data.user.id;
      const client = createClient(SUPABASE_URL!, ANON_KEY!, {
        auth: { autoRefreshToken: false, persistSession: false },
      });
      const { error: signInError } = await client.auth.signInWithPassword({ email, password });
      if (signInError) throw signInError;
      clients[person] = client;
    }

    const { data: burrow } = await clients.josh.rpc("create_burrow", { burrow_name: `Photos ${runId}` });
    const { data: code } = await clients.josh.rpc("create_knock", { target_burrow: burrow });
    await clients.sarah.rpc("answer_knock", { knock_code: code });
    const { data: mia, error } = await clients.josh.rpc("create_managed_profile", { profile_name: "Mia", burrow_ids: [burrow] });
    if (error) throw error;
    miaId = mia as string;
  });

  afterAll(async () => {
    if (uploaded.length) await admin.storage.from("avatars").remove(uploaded);
    for (const person of people) await admin.auth.admin.deleteUser(ids[person]);
  });

  it("family sees your photo once it's your picture; strangers never do", async () => {
    const path = `${ids.josh}/a.png`;
    expect(await upload("josh", path)).toBeNull();
    expect(await sees("josh", path)).toBe(true);
    // Not anyone's picture yet: only josh can see it.
    expect(await sees("sarah", path)).toBe(false);

    const { error } = await clients.josh.from("profiles").update({ avatar_path: path }).eq("id", ids.josh);
    expect(error).toBeNull();
    expect(await sees("sarah", path)).toBe(true);
    expect(await sees("stranger", path)).toBe(false);
  });

  it("nobody can put photos in your folder or take yours as their own", async () => {
    expect(await upload("stranger", `${ids.josh}/sneaky.png`)).not.toBeNull();
    expect(await upload("sarah", `${ids.josh}/sneaky.png`)).not.toBeNull();

    // Pointing your picture at someone else's photo would show it to your family.
    const { error } = await clients.sarah.from("profiles").update({ avatar_path: `${ids.josh}/a.png` }).eq("id", ids.sarah);
    expect(error).not.toBeNull();
    const { error: junk } = await clients.sarah.from("profiles").update({ avatar_path: "../etc/passwd" }).eq("id", ids.sarah);
    expect(junk).not.toBeNull();
  });

  it("only you can remove your photo", async () => {
    const path = `${ids.josh}/old.png`;
    await upload("josh", path);
    await clients.stranger.storage.from("avatars").remove([path]);
    await clients.sarah.storage.from("avatars").remove([path]);
    expect(await sees("josh", path)).toBe(true);
    await clients.josh.storage.from("avatars").remove([path]);
    expect(await sees("josh", path)).toBe(false);
  });

  it("a kid's grown-ups choose the kid's photo, and the kid keeps it when they take over (HOME-010)", async () => {
    const path = `${miaId}/mia.png`;
    expect(await upload("sarah", path)).not.toBeNull(); // family, but doesn't look after Mia
    expect(await upload("josh", path)).toBeNull();
    const { error } = await clients.josh.from("profiles").update({ avatar_path: path }).eq("id", miaId);
    expect(error).toBeNull();
    expect(await sees("sarah", path)).toBe(true);
    expect(await sees("stranger", path)).toBe(false);

    const { data: code } = await clients.josh.rpc("create_handoff", { target_profile: miaId });
    const { error: handoffError } = await clients.teen.rpc("answer_code", { any_code: code });
    expect(handoffError).toBeNull();

    const { data: teen } = await admin.from("profiles").select("avatar_path").eq("id", ids.teen).single();
    expect(teen?.avatar_path).toBe(path);
    expect(await sees("teen", path)).toBe(true);
    expect(await sees("sarah", path)).toBe(true);
    expect(await sees("stranger", path)).toBe(false);
  });
});
