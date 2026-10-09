import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

// The newer inbox notices (Gathering invites and changes, Potlucks), enforced
// in Postgres. Same setup as gift-nook-rls.test.ts (needs .env plus
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

  // One fixed day, so changing other things never looks like the day moved.
  const day = soon();
  const plan = (title: string, withFood = false) =>
    clients.host.rpc("plan_gathering", {
      gathering_title: title,
      gathering_kind: "game_night",
      gathering_ends_at: day,
      gathering_starts_at: null,
      gathering_place: "Our place",
      gathering_notes: "",
      with_gifts: false,
      with_food: withFood,
      burrow_ids: [burrowId],
      guest_ids: [],
      honoree_ids: [],
      cohost_ids: [],
    });

  it("a new Gathering tells everyone invited, not whoever planned it or strangers", async () => {
    const { error } = await plan("Game night");
    expect(error).toBeNull();
    expect((await notices("guest", "gatherings", "gathering_invite")).map((n) => n.title.includes("Game night"))).toEqual([true]);
    expect(await notices("host", "gatherings", "gathering_invite")).toEqual([]);
    expect(await notices("stranger", "gatherings", "gathering_invite")).toEqual([]);
  });

  it("automatic birthday Gatherings stay quiet", async () => {
    const before = await notices("guest", "gatherings", "gathering_invite");
    await clients.host.rpc("plan_birthday", {
      target_burrow: burrowId,
      target_profile: ids.guest,
      birthday_year: new Date().getFullYear(),
      gathering_title: "Guest's birthday",
      gathering_ends_at: soon(),
    });
    expect((await notices("guest", "gatherings", "gathering_invite")).length).toBe(before.length);
  });

  it("the switch for invites is respected", async () => {
    await admin.from("nook_settings").upsert({ profile_id: ids.guest, nook: "gatherings", settings: { notifyInvites: false } });
    await plan("Quiet one");
    const titles = (await notices("guest", "gatherings", "gathering_invite")).map((n) => n.title);
    expect(titles.some((t) => t.includes("Quiet one"))).toBe(false);
    await admin.from("nook_settings").delete().eq("profile_id", ids.guest).eq("nook", "gatherings");
  });

  let gatheringId: string;
  let potluckId: string;

  it("a Potluck planned with its Gathering is in the invite; one added later is news", async () => {
    await plan("Fall feast", true);
    expect(await notices("guest", "potluck", "potluck_new")).toEqual([]);

    const { data } = await plan("Winter feast");
    gatheringId = data;
    const { data: potluck, error } = await clients.host.rpc("add_potluck", { target_gathering: gatheringId });
    expect(error).toBeNull();
    potluckId = potluck;
    expect((await notices("guest", "potluck", "potluck_new")).length).toBe(1);
    expect(await notices("host", "potluck", "potluck_new")).toEqual([]);
    expect(await notices("stranger", "potluck", "potluck_new")).toEqual([]);
  });

  it("changes go to people invited who haven't said no, not the one who changed it", async () => {
    const change = (place: string, notes: string) =>
      clients.host.rpc("update_gathering", {
        target_gathering: gatheringId,
        gathering_title: "Winter feast",
        gathering_kind: "game_night",
        gathering_ends_at: day,
        gathering_starts_at: null,
        gathering_place: place,
        gathering_notes: notes,
        with_gifts: false,
        burrow_ids: [burrowId],
        guest_ids: [],
        honoree_ids: [],
        cohost_ids: [ids.host],
      });
    await clients.guest.from("gathering_rsvps").insert({ gathering_id: gatheringId, profile_id: ids.guest, status: "going" });
    expect((await change("The park", "")).error).toBeNull();
    const changed = (await notices("guest", "gatherings", "gathering_changed")).filter((n) => (n.data as { gathering_id?: string }).gathering_id === gatheringId);
    expect(changed.map((n) => n.body)).toEqual(["The place changed"]);
    expect(await notices("host", "gatherings", "gathering_changed")).toEqual([]);
    // Changing the notes alone isn't news.
    await change("The park", "Bring a chair");
    expect((await notices("guest", "gatherings", "gathering_changed")).length).toBe(1);
  });

  it("answers tell the hosts (unless switched off); dishes once they turn those on", async () => {
    await clients.guest.from("gathering_rsvps").update({ status: "maybe" }).eq("gathering_id", gatheringId).eq("profile_id", ids.guest);
    expect((await notices("host", "gatherings", "gathering_rsvp")).map((n) => n.title)).toContain("guest might come");

    expect(await notices("host", "potluck", "potluck_dish")).toEqual([]);
    await admin.from("nook_settings").upsert({ profile_id: ids.host, nook: "potluck", settings: { notifyDishes: true } });
    await clients.guest.from("potluck_dishes").insert({ potluck_id: potluckId, name: "Apple pie", brought_by: ids.guest });
    expect((await notices("host", "potluck", "potluck_dish")).map((n) => n.title)).toEqual(["guest is bringing Apple pie"]);
    expect(await notices("guest", "potluck", "potluck_dish")).toEqual([]);
  });
});
