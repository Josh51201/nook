import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

// Rhythms Nook (RHY-002..007), enforced in Postgres. Same setup as
// gift-nook-rls.test.ts (needs .env plus SUPABASE_SERVICE_ROLE_KEY in
// .env.test.local); skipped without them.

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL;
const ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const canRun = Boolean(SUPABASE_URL && ANON_KEY && SERVICE_ROLE_KEY);
const day = (offset = 0) => new Date(Date.now() + offset * 864e5).toISOString().slice(0, 10);

describe.runIf(canRun)("Rhythms: the Home shares them, nobody else sees them", () => {
  let admin: SupabaseClient;
  const runId = Date.now();
  // josh and sarah share a Home. cousin shares a Burrow but not the Home.
  const people = ["josh", "sarah", "cousin"] as const;
  type Person = (typeof people)[number];
  const ids = {} as Record<Person, string>;
  const clients = {} as Record<Person, SupabaseClient>;

  let homeId: string;
  let rhythmId: string;

  beforeAll(async () => {
    admin = createClient(SUPABASE_URL!, SERVICE_ROLE_KEY!, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    for (const person of people) {
      const email = `rhythms-${person}-${runId}@example.com`;
      const password = `rhythms-${person}-pw!`;
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

    const { data: burrow } = await clients.josh.rpc("create_burrow", { burrow_name: `Rhythms ${runId}` });
    const { data: code } = await clients.josh.rpc("create_knock", { target_burrow: burrow });
    for (const person of ["sarah", "cousin"] as const) await clients[person].rpc("answer_knock", { knock_code: code });

    const { data: invite } = await clients.josh.rpc("invite_to_home", { target: ids.sarah });
    await clients.sarah.rpc("accept_home_invite", { invite_id: invite });

    const { data: home } = await clients.josh.rpc("my_home");
    homeId = home;
    // Read back in the same statement that adds it (the Pet Care bug).
    const { data: rhythm, error } = await clients.josh
      .from("rhythms")
      .insert({ home_id: homeId, title: "Change the furnace filter", area: "heating", due_on: day(), repeat_months: 3 })
      .select("id")
      .single();
    if (error) throw error;
    rhythmId = rhythm!.id;
  });

  afterAll(async () => {
    for (const person of people) await admin.auth.admin.deleteUser(ids[person]);
  });

  it("the whole Home sees it; someone outside the Home doesn't", async () => {
    const sees = async (person: Person) =>
      ((await clients[person].from("rhythms").select("id").eq("id", rhythmId)).data ?? []).length === 1;
    expect(await sees("josh")).toBe(true);
    expect(await sees("sarah")).toBe(true);
    expect(await sees("cousin")).toBe(false);
  });

  it("anyone in the Home can change it; nobody else can", async () => {
    const { error } = await clients.sarah.from("rhythms").update({ notes: "16x25x1" }).eq("id", rhythmId);
    expect(error).toBeNull();
    await clients.cousin.from("rhythms").update({ notes: "hacked" }).eq("id", rhythmId);
    const { data } = await admin.from("rhythms").select("notes").eq("id", rhythmId).single();
    expect(data?.notes).toBe("16x25x1");
  });

  it("can't add one to someone else's Home or move one there", async () => {
    const { error } = await clients.cousin.from("rhythms").insert({ home_id: homeId, title: "Sneaky" });
    expect(error).not.toBeNull();
    const { data: cousinHome } = await clients.cousin.rpc("my_home");
    await clients.josh.from("rhythms").update({ home_id: cousinHome } as never).eq("id", rhythmId);
    const { data } = await admin.from("rhythms").select("home_id").eq("id", rhythmId).single();
    expect(data?.home_id).toBe(homeId);
  });

  it("an owner has to live in the Home (RHY-005)", async () => {
    const outsider = await clients.josh.from("rhythms").update({ owner: ids.cousin }).eq("id", rhythmId);
    expect(outsider.error).not.toBeNull();
    const housemate = await clients.josh.from("rhythms").update({ owner: ids.sarah }).eq("id", rhythmId);
    expect(housemate.error).toBeNull();
  });

  it("marking it done logs who did it and rolls the date forward (RHY-004, RHY-006)", async () => {
    const { error } = await clients.sarah.rpc("complete_rhythm", { target_rhythm: rhythmId, on_day: day(), note: "used the pleated one" });
    expect(error).toBeNull();
    const { data } = await admin.from("rhythms").select("due_on, last_done_on, last_done_by").eq("id", rhythmId).single();
    expect(data?.last_done_on).toBe(day());
    expect(data?.last_done_by).toBe(ids.sarah);
    expect(data!.due_on > day(80)).toBe(true);

    const { data: log } = await clients.josh.from("rhythm_log").select("done_by, note").eq("rhythm_id", rhythmId);
    expect(log).toEqual([{ done_by: ids.sarah, note: "used the pleated one" }]);
    const { data: hidden } = await clients.cousin.from("rhythm_log").select("id").eq("rhythm_id", rhythmId);
    expect(hidden).toEqual([]);
  });

  it("can't be done twice on the same day, or by someone outside the Home", async () => {
    const twice = await clients.josh.rpc("complete_rhythm", { target_rhythm: rhythmId, on_day: day() });
    expect(twice.error?.code).toBe("23505");
    const outsider = await clients.cousin.rpc("complete_rhythm", { target_rhythm: rhythmId, on_day: day(-1) });
    expect(outsider.error).not.toBeNull();
  });

  it("the log can't be written directly, so nobody logs a chore as someone else", async () => {
    const { error } = await clients.josh
      .from("rhythm_log")
      .insert({ rhythm_id: rhythmId, done_by: ids.sarah, done_on: day(-3) });
    expect(error).not.toBeNull();
  });

  it("undo puts the dates back the way they were", async () => {
    const { data: entry } = await admin.from("rhythm_log").select("id").eq("rhythm_id", rhythmId).single();
    const outsider = await clients.cousin.rpc("undo_rhythm", { target_entry: entry!.id });
    expect(outsider.error).not.toBeNull();
    const { error } = await clients.josh.rpc("undo_rhythm", { target_entry: entry!.id });
    expect(error).toBeNull();
    const { data } = await admin.from("rhythms").select("due_on, last_done_on").eq("id", rhythmId).single();
    expect(data).toEqual({ due_on: day(), last_done_on: null });
  });

  it("leaving the Home hands your rhythms back to anyone", async () => {
    await admin.from("rhythms").update({ owner: ids.sarah }).eq("id", rhythmId);
    const { error } = await clients.sarah.rpc("leave_home");
    expect(error).toBeNull();
    const { data } = await admin.from("rhythms").select("owner, home_id").eq("id", rhythmId).single();
    expect(data).toEqual({ owner: null, home_id: homeId });
    const gone = await clients.sarah.from("rhythms").select("id").eq("id", rhythmId);
    expect(gone.data).toEqual([]);
  });
});
