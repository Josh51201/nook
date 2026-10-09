import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

// Share a look (CORE-055), enforced in Postgres. Same setup as
// gift-nook-rls.test.ts (needs .env plus SUPABASE_SERVICE_ROLE_KEY in
// .env.test.local); skipped without them.

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL;
const ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const canRun = Boolean(SUPABASE_URL && ANON_KEY && SERVICE_ROLE_KEY);

describe.runIf(canRun)("Share a look: family can open your code, nobody else", () => {
  let admin: SupabaseClient;
  const runId = Date.now();
  // josh and sarah share a Burrow; stranger doesn't.
  const people = ["josh", "sarah", "stranger"] as const;
  type Person = (typeof people)[number];
  const ids = {} as Record<Person, string>;
  const clients = {} as Record<Person, SupabaseClient>;
  const look = { theme: "sage", wallpaper: { kind: "none" }, ambience: "snow" };
  let code: string;

  beforeAll(async () => {
    admin = createClient(SUPABASE_URL!, SERVICE_ROLE_KEY!, { auth: { autoRefreshToken: false, persistSession: false } });
    for (const person of people) {
      const email = `looks-${person}-${runId}@example.com`;
      const password = `looks-${person}-pw!`;
      const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
      if (error || !data.user) throw error;
      ids[person] = data.user.id;
      const client = createClient(SUPABASE_URL!, ANON_KEY!, { auth: { autoRefreshToken: false, persistSession: false } });
      const { error: signInError } = await client.auth.signInWithPassword({ email, password });
      if (signInError) throw signInError;
      clients[person] = client;
    }
    await admin.from("profiles").update({ display_name: "Josh" }).eq("id", ids.josh);
    const { data: burrow } = await clients.josh.rpc("create_burrow", { burrow_name: `Looks ${runId}` });
    const { data: knock } = await clients.josh.rpc("create_knock", { target_burrow: burrow });
    await clients.sarah.rpc("answer_knock", { knock_code: knock });
    const { data, error } = await clients.josh.rpc("share_look", { look_kind: "theme", look_data: look });
    if (error) throw error;
    code = data;
  });

  afterAll(async () => {
    for (const person of people) await admin.auth.admin.deleteUser(ids[person]);
  });

  it("makes a clean 6-letter code", () => {
    expect(code).toMatch(/^[A-HJKMNP-Z2-9]{6}$/);
  });

  it("family in a Burrow can open it, typed any old way", async () => {
    const { data } = await clients.sarah.rpc("open_look", { look_code: ` ${code.slice(0, 3).toLowerCase()}-${code.slice(3)} ` });
    expect(data).toHaveLength(1);
    expect(data[0]).toMatchObject({ kind: "theme", look, from_name: "Josh" });
  });

  it("someone who isn't family gets nothing", async () => {
    const { data } = await clients.stranger.rpc("open_look", { look_code: code });
    expect(data).toEqual([]);
    const { data: rows } = await clients.stranger.from("shared_looks").select("code");
    expect(rows).toEqual([]);
  });

  it("nobody can read the table directly except for their own codes", async () => {
    const { data: sarahRows } = await clients.sarah.from("shared_looks").select("code");
    expect(sarahRows).toEqual([]);
    const { data: joshRows } = await clients.josh.from("shared_looks").select("code");
    expect(joshRows?.map((r) => r.code)).toEqual([code]);
  });

  it("codes can't be made or changed by hand", async () => {
    const made = await clients.sarah.from("shared_looks").insert({ code: "ABCDEF", kind: "theme", look });
    expect(made.error).not.toBeNull();
    await clients.josh.from("shared_looks").update({ look: { theme: "dusk" } }).eq("code", code);
    const { data } = await clients.sarah.rpc("open_look", { look_code: code });
    expect(data[0].look.theme).toBe("sage");
  });

  it("an old code stops working", async () => {
    await admin.from("shared_looks").update({ expires_at: new Date(Date.now() - 1000).toISOString() }).eq("code", code);
    const { data } = await clients.sarah.rpc("open_look", { look_code: code });
    expect(data).toEqual([]);
  });

  it("signed-out visitors can't make or open codes", async () => {
    const anon = createClient(SUPABASE_URL!, ANON_KEY!, { auth: { autoRefreshToken: false, persistSession: false } });
    expect((await anon.rpc("share_look", { look_kind: "theme", look_data: look })).error).not.toBeNull();
    expect((await anon.rpc("open_look", { look_code: code })).error).not.toBeNull();
  });
});
