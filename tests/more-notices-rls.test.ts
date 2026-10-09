import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

// The newer inbox notices (new Gatherings, Potluck invites and changes),
// enforced in Postgres. Same setup as gift-nook-rls.test.ts (needs .env plus
// SUPABASE_SERVICE_ROLE_KEY in .env.test.local); skipped without them.

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL;
const ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const canRun = Boolean(SUPABASE_URL && ANON_KEY && SERVICE_ROLE_KEY);
const soon = () => new Date(Date.now() + 5 * 864e5).toISOString();

describe.runIf(canRun)("Inbox notices: the right people hear, and never the person who did it", () => {
  let admin: SupabaseClient;
  const runId = Date.now();
  // host and guest share a Burrow; stranger shares nothing.
  const people = ["host", "guest", "stranger"] as const;
  type Person = (typeof people)[number];
  const ids = {} as Record<Person, string>;
  const clients = {} as Record<Person, SupabaseClient>;
  let burrowId: string;

  const notices = async (person: Person, nook: string, kind: string) =>
    (await clients[person].from("notifications").select("title, body, data").eq("nook", nook).eq("kind", kind)).data ?? [];

  beforeAll(async () => {
    admin = createClient(SUPABASE_URL!, SERVICE_ROLE_KEY!, { auth: { autoRefreshToken: false, persistSession: false } });
    for (const person of people) {
      const email = `notices-${person}-${runId}@example.com`;
      const password = `notices-${person}-pw!`;
      const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { display_name: person } });
      if (error || !data.user) throw error;
      ids[person] = data.user.id;
      const client = createClient(SUPABASE_URL!, ANON_KEY!, { auth: { autoRefreshToken: false, persistSession: false } });
      const { error: signInError } = await client.auth.signInWithPassword({ email, password });
      if (signInError) throw signInError;
      clients[person] = client;
    }
    const { data: burrow } = await clients.host.rpc("create_burrow", { burrow_name: `Notices ${runId}` });
    burrowId = burrow;
    const { data: code } = await clients.host.rpc("create_knock", { target_burrow: burrow });
    await clients.guest.rpc("answer_knock", { knock_code: code });
  });

  afterAll(async () => {
    for (const person of people) await admin.auth.admin.deleteUser(ids[person]);
  });

  it("a new Gathering tells the rest of the Burrow, not whoever planned it or strangers", async () => {
    const { error } = await clients.host.from("gatherings").insert({ burrow_id: burrowId, title: "Game night", kind: "other", ends_at: soon() });
    expect(error).toBeNull();
    expect((await notices("guest", "gift-nook", "gathering_new")).map((n) => n.title.includes("Game night"))).toEqual([true]);
    expect(await notices("host", "gift-nook", "gathering_new")).toEqual([]);
    expect(await notices("stranger", "gift-nook", "gathering_new")).toEqual([]);
  });

  it("automatic birthday Gatherings stay quiet", async () => {
    const { data: before } = await clients.guest.from("notifications").select("id").eq("kind", "gathering_new");
    await clients.host.rpc("plan_birthday", {
      target_burrow: burrowId,
      target_profile: ids.guest,
      birthday_year: new Date().getFullYear(),
      gathering_title: "Guest's birthday",
      gathering_ends_at: soon(),
    });
    const { data: after } = await clients.guest.from("notifications").select("id").eq("kind", "gathering_new");
    expect(after?.length).toBe(before?.length);
  });

  it("the switch for new Gatherings is respected", async () => {
    await admin.from("nook_settings").upsert({ profile_id: ids.guest, nook: "gift-nook", settings: { notifyGatheringNew: false } });
    await clients.host.from("gatherings").insert({ burrow_id: burrowId, title: "Quiet one", kind: "other", ends_at: soon() });
    const titles = (await notices("guest", "gift-nook", "gathering_new")).map((n) => n.title);
    expect(titles.some((t) => t.includes("Quiet one"))).toBe(false);
    await admin.from("nook_settings").delete().eq("profile_id", ids.guest).eq("nook", "gift-nook");
  });

  let potluckId: string;

  it("a new Potluck invites the Burrow", async () => {
    const { data, error } = await clients.host
      .from("potlucks")
      .insert({ burrow_id: burrowId, title: "Fall feast", starts_at: soon(), place: "Our place" })
      .select("id")
      .single();
    expect(error).toBeNull();
    potluckId = data!.id;
    expect((await notices("guest", "potluck", "potluck_new")).length).toBe(1);
    expect(await notices("host", "potluck", "potluck_new")).toEqual([]);
    expect(await notices("stranger", "potluck", "potluck_new")).toEqual([]);
  });

  it("changes go to people going or bringing something, not the one who changed it", async () => {
    await clients.guest.from("potluck_rsvps").insert({ potluck_id: potluckId, profile_id: ids.guest, status: "going" });
    await clients.host.from("potlucks").update({ place: "The park" }).eq("id", potluckId);
    expect((await notices("guest", "potluck", "potluck_changed")).map((n) => n.body)).toEqual(["The place changed"]);
    expect(await notices("host", "potluck", "potluck_changed")).toEqual([]);
    // Changing the notes alone isn't news.
    await clients.host.from("potlucks").update({ notes: "Bring a chair" }).eq("id", potluckId);
    expect((await notices("guest", "potluck", "potluck_changed")).length).toBe(1);
  });

  it("RSVPs and dishes tell the host only once they turn those on", async () => {
    expect(await notices("host", "potluck", "potluck_rsvp")).toEqual([]);
    expect(await notices("host", "potluck", "potluck_dish")).toEqual([]);
    await admin.from("nook_settings").upsert({ profile_id: ids.host, nook: "potluck", settings: { notifyRsvps: true, notifyDishes: true } });
    await clients.guest.from("potluck_rsvps").update({ status: "maybe" }).eq("potluck_id", potluckId).eq("profile_id", ids.guest);
    await clients.guest.from("potluck_dishes").insert({ potluck_id: potluckId, name: "Apple pie", brought_by: ids.guest });
    expect((await notices("host", "potluck", "potluck_rsvp")).map((n) => n.title)).toEqual(["guest might come"]);
    expect((await notices("host", "potluck", "potluck_dish")).map((n) => n.title)).toEqual(["guest is bringing Apple pie"]);
    expect(await notices("guest", "potluck", "potluck_dish")).toEqual([]);
  });
});
