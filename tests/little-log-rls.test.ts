import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

// Little Log (LOG-006), enforced in Postgres: a log is just yours unless you
// share it with your Home; then the people you live with see it and can add
// to it, but only you change or remove the log. Same setup as
// gift-nook-rls.test.ts (needs .env plus SUPABASE_SERVICE_ROLE_KEY in
// .env.test.local); skipped without them.

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL;
const ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const canRun = Boolean(SUPABASE_URL && ANON_KEY && SERVICE_ROLE_KEY);

describe.runIf(canRun)("Little Log: private by default, shared with the Home when asked", () => {
  let admin: SupabaseClient;
  const runId = Date.now();
  // josh and sarah share a Home. cousin shares a Burrow but not the Home.
  const people = ["josh", "sarah", "cousin"] as const;
  type Person = (typeof people)[number];
  const ids = {} as Record<Person, string>;
  const clients = {} as Record<Person, SupabaseClient>;

  let privateLog: string;
  let sharedLog: string;
  let joshEntry: string;

  beforeAll(async () => {
    admin = createClient(SUPABASE_URL!, SERVICE_ROLE_KEY!, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    for (const person of people) {
      const email = `log-${person}-${runId}@example.com`;
      const password = `log-${person}-pw!`;
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

    const { data: burrow } = await clients.josh.rpc("create_burrow", { burrow_name: `Logs ${runId}` });
    const { data: code } = await clients.josh.rpc("create_knock", { target_burrow: burrow });
    for (const person of ["sarah", "cousin"] as const) await clients[person].rpc("answer_knock", { knock_code: code });

    const { data: invite } = await clients.josh.rpc("invite_to_home", { target: ids.sarah });
    await clients.sarah.rpc("accept_home_invite", { invite_id: invite });

    // Read back in the same statement that adds it.
    const mine = await clients.josh.from("little_logs").insert({ name: "Weight", kind: "number", unit: "lbs" }).select("id").single();
    if (mine.error) throw mine.error;
    privateLog = mine.data!.id;

    const shared = await clients.josh
      .from("little_logs")
      .insert({ name: "Ella's height", kind: "number", unit: "in", shared: true })
      .select("id")
      .single();
    if (shared.error) throw shared.error;
    sharedLog = shared.data!.id;

    const entry = await clients.josh.from("little_log_entries").insert({ log_id: sharedLog, value: 41 }).select("id").single();
    if (entry.error) throw entry.error;
    joshEntry = entry.data!.id;
    await clients.josh.from("little_log_entries").insert({ log_id: privateLog, value: 182 });
  });

  afterAll(async () => {
    for (const person of people) await admin.auth.admin.deleteUser(ids[person]);
  });

  const sees = async (person: Person, id: string) =>
    ((await clients[person].from("little_logs").select("id").eq("id", id)).data ?? []).length === 1;
  const entriesSeen = async (person: Person, logId: string) =>
    ((await clients[person].from("little_log_entries").select("id").eq("log_id", logId)).data ?? []).length;

  it("a log is just yours until you share it, even from people you live with", async () => {
    expect(await sees("josh", privateLog)).toBe(true);
    expect(await sees("sarah", privateLog)).toBe(false);
    expect(await sees("cousin", privateLog)).toBe(false);
    expect(await entriesSeen("sarah", privateLog)).toBe(0);
    const sneak = await clients.sarah.from("little_log_entries").insert({ log_id: privateLog, value: 1 });
    expect(sneak.error).not.toBeNull();
  });

  it("a shared log is seen by the Home, and nobody outside it", async () => {
    expect(await sees("sarah", sharedLog)).toBe(true);
    expect(await entriesSeen("sarah", sharedLog)).toBe(1);
    expect(await sees("cousin", sharedLog)).toBe(false);
    expect(await entriesSeen("cousin", sharedLog)).toBe(0);
  });

  it("the Home can add to a shared log, and change only their own entries", async () => {
    const hers = await clients.sarah.from("little_log_entries").insert({ log_id: sharedLog, value: 41.5 }).select("id").single();
    expect(hers.error).toBeNull();
    const changeHers = await clients.sarah.from("little_log_entries").update({ value: 41.25 }).eq("id", hers.data!.id).select("id");
    expect(changeHers.data).toHaveLength(1);

    const changeHis = await clients.sarah.from("little_log_entries").update({ value: 99 }).eq("id", joshEntry).select("id");
    expect(changeHis.data ?? []).toHaveLength(0);
    const removeHis = await clients.sarah.from("little_log_entries").delete().eq("id", joshEntry).select("id");
    expect(removeHis.data ?? []).toHaveLength(0);

    // The owner can tidy up anyone's entry in their log.
    const ownerRemoves = await clients.josh.from("little_log_entries").delete().eq("id", hers.data!.id).select("id");
    expect(ownerRemoves.data).toHaveLength(1);
  });

  it("only the owner changes or removes the log, and it can't change hands or kind", async () => {
    const rename = await clients.sarah.from("little_logs").update({ name: "Mine now" }).eq("id", sharedLog).select("id");
    expect(rename.data ?? []).toHaveLength(0);
    const remove = await clients.sarah.from("little_logs").delete().eq("id", sharedLog).select("id");
    expect(remove.data ?? []).toHaveLength(0);
    const takeIt = await clients.josh.from("little_logs").update({ owner_id: ids.sarah }).eq("id", sharedLog);
    expect(takeIt.error).not.toBeNull();
    const changeKind = await clients.josh.from("little_logs").update({ kind: "text" }).eq("id", sharedLog);
    expect(changeKind.error).not.toBeNull();
    const makeForHer = await clients.josh.from("little_logs").insert({ name: "Hers", kind: "number", owner_id: ids.sarah });
    expect(makeForHer.error).not.toBeNull();
  });

  it("an entry has to fit its log", async () => {
    const pair = await clients.josh.from("little_logs").insert({ name: "BP", kind: "pair", labels: ["Top", "Bottom"] }).select("id").single();
    expect((await clients.josh.from("little_log_entries").insert({ log_id: pair.data!.id, value: 120 })).error).not.toBeNull();
    expect((await clients.josh.from("little_log_entries").insert({ log_id: pair.data!.id, value: 120, value2: 80 })).error).toBeNull();
    const scale = await clients.josh.from("little_logs").insert({ name: "Mood", kind: "scale" }).select("id").single();
    expect((await clients.josh.from("little_log_entries").insert({ log_id: scale.data!.id, value: 7 })).error).not.toBeNull();
  });

  it("unsharing hides it again, and moving out of the Home stops seeing it", async () => {
    await clients.josh.from("little_logs").update({ shared: false }).eq("id", sharedLog);
    expect(await sees("sarah", sharedLog)).toBe(false);
    await clients.josh.from("little_logs").update({ shared: true }).eq("id", sharedLog);
    expect(await sees("sarah", sharedLog)).toBe(true);

    await clients.sarah.rpc("leave_home");
    expect(await sees("sarah", sharedLog)).toBe(false);
    expect(await entriesSeen("sarah", sharedLog)).toBe(0);
  });
});
