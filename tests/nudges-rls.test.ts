import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

// Nudges (CORE-101), enforced in Postgres: only people who should can send
// one, the right people hear, once a day, never if they've turned nudges
// off, and a Wishbook nudge leaks nothing about tucks (GIFT-007). Same setup
// as gift-nook-rls.test.ts (needs .env plus SUPABASE_SERVICE_ROLE_KEY in
// .env.test.local); skipped without them.

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL;
const ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const canRun = Boolean(SUPABASE_URL && ANON_KEY && SERVICE_ROLE_KEY);
const day = (days: number) => new Date(Date.now() + days * 864e5).toISOString().slice(0, 10);

describe.runIf(canRun)("Nudges: the right people, once a day, and no hints about tucks", () => {
  let admin: SupabaseClient;
  const runId = Date.now();
  // host, guest and other share a Burrow; host and guest share a Home;
  // stranger shares nothing.
  const people = ["host", "guest", "other", "stranger"] as const;
  type Person = (typeof people)[number];
  const ids = {} as Record<Person, string>;
  const clients = {} as Record<Person, SupabaseClient>;
  let burrowId: string;
  let hostKid: string;
  let guestKid: string;
  let gatheringId: string;
  let potluckId: string;

  const nudge = (person: Person, kind: string, target: string, extra: Record<string, unknown> = {}) =>
    clients[person].rpc("send_nudge", { nudge_kind: kind, target, ...extra });
  const notices = async (person: Person, kind: string) =>
    (await clients[person].from("notifications").select("title, body, data").eq("kind", kind).order("created_at")).data ?? [];

  beforeAll(async () => {
    admin = createClient(SUPABASE_URL!, SERVICE_ROLE_KEY!, { auth: { autoRefreshToken: false, persistSession: false } });
    for (const person of people) {
      const email = `nudges-${person}-${runId}@example.com`;
      const password = `nudges-${person}-pw!`;
      const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { display_name: person } });
      if (error || !data.user) throw error;
      ids[person] = data.user.id;
      const client = createClient(SUPABASE_URL!, ANON_KEY!, { auth: { autoRefreshToken: false, persistSession: false } });
      const { error: signInError } = await client.auth.signInWithPassword({ email, password });
      if (signInError) throw signInError;
      clients[person] = client;
    }
    const { data: burrow } = await clients.host.rpc("create_burrow", { burrow_name: `Nudges ${runId}` });
    burrowId = burrow;
    const { data: code } = await clients.host.rpc("create_knock", { target_burrow: burrow });
    await clients.guest.rpc("answer_knock", { knock_code: code });
    await clients.other.rpc("answer_knock", { knock_code: code });
    const { data: invite } = await clients.host.rpc("invite_to_home", { target: ids.guest });
    await clients.guest.rpc("accept_home_invite", { invite_id: invite });
    ({ data: hostKid } = await clients.host.rpc("create_managed_profile", { profile_name: "Lily", burrow_ids: [burrowId] }));
    ({ data: guestKid } = await clients.guest.rpc("create_managed_profile", { profile_name: "Max", burrow_ids: [burrowId] }));
  });

  afterAll(async () => {
    for (const person of people) await admin.auth.admin.deleteUser(ids[person]);
    for (const kid of [hostKid, guestKid]) if (kid) await admin.auth.admin.deleteUser(kid).catch(() => {});
  });

  describe("Wishbooks", () => {
    it("reaches the Wishbook's owner, once a day", async () => {
      const first = await nudge("guest", "wishbook", ids.host);
      expect(first.error).toBeNull();
      expect(first.data).toBe(1);
      const again = await nudge("guest", "wishbook", ids.host);
      expect(again.data).toBe(0);
      const got = await notices("host", "nudge_wishbook");
      expect(got).toHaveLength(1);
      expect(got[0].title).toBe("guest would love more gift ideas");
    });

    it("can't be sent by a stranger, or to yourself", async () => {
      expect((await nudge("stranger", "wishbook", ids.host)).error).not.toBeNull();
      expect((await nudge("host", "wishbook", ids.host)).error).not.toBeNull();
      expect(await notices("host", "nudge_wishbook")).toHaveLength(1);
    });

    it("GIFT-007: says exactly the same after a gift is tucked, and the owner sees no claims or nudge log", async () => {
      const { data: wishbook } = await clients.host.from("wishbooks").select("id").eq("owner_id", ids.host).single();
      const { data: shelf } = await clients.host.from("shelves").select("id").eq("key", "other").single();
      const { data: gift } = await clients.host
        .from("gifts")
        .insert({ wishbook_id: wishbook!.id, shelf_id: shelf!.id, title: "Puzzle" })
        .select("id")
        .single();
      expect((await clients.other.from("claims").insert({ gift_id: gift!.id, claimed_by: ids.other })).error).toBeNull();

      expect((await nudge("other", "wishbook", ids.host)).data).toBe(1);
      const got = await notices("host", "nudge_wishbook");
      expect(got).toHaveLength(2);
      expect(got[1].body).toBe(got[0].body);
      expect(Object.keys(got[1].data).sort()).toEqual(["owner_id"]);
      expect(JSON.stringify(got)).not.toMatch(/tuck|claim|taken|bought/i);

      const { data: claims, count } = await clients.host.from("claims").select("id", { count: "exact" }).eq("gift_id", gift!.id);
      expect(claims).toEqual([]);
      expect(count).toBe(0);
      expect((await clients.host.from("nudges").select("id")).data).toEqual([]);
      expect((await clients.other.from("nudges").select("sent_to")).data).toEqual([{ sent_to: ids.host }]);
    });

    it("a kid's Wishbook nudges the grown-ups who look after it", async () => {
      expect((await nudge("guest", "wishbook", hostKid)).data).toBe(1);
      const got = await notices("host", "nudge_wishbook");
      expect(got.at(-1)!.title).toBe("guest would love more gift ideas for Lily");
      expect(got.at(-1)!.data).toEqual({ owner_id: hostKid, kid: true });
    });

    it("nothing arrives for someone who turned nudges off, and the sender isn't told", async () => {
      await clients.guest.from("nook_settings").upsert({ profile_id: ids.guest, nook: "nudges", settings: { notifyNudges: false } });
      const sent = await nudge("host", "wishbook", ids.guest);
      expect(sent.data).toBe(1);
      expect(await notices("guest", "nudge_wishbook")).toEqual([]);
      await clients.guest.from("nook_settings").delete().eq("profile_id", ids.guest).eq("nook", "nudges");
    });
  });

  describe("Gatherings and Potlucks", () => {
    beforeAll(async () => {
      const { data, error } = await clients.host.rpc("plan_gathering", {
        gathering_title: "Christmas",
        gathering_kind: "christmas",
        gathering_ends_at: new Date(Date.now() + 10 * 864e5).toISOString(),
        gathering_starts_at: null,
        gathering_place: null,
        gathering_notes: "",
        with_gifts: true,
        with_food: true,
        burrow_ids: [burrowId],
        guest_ids: [],
        honoree_ids: [],
        cohost_ids: [],
      });
      if (error) throw error;
      gatheringId = data;
      const { data: potluck } = await clients.host.from("potlucks").select("id").eq("gathering_id", gatheringId).single();
      potluckId = potluck!.id;
    });

    it("only a host can nudge people to answer", async () => {
      expect((await nudge("guest", "rsvp", gatheringId)).error).not.toBeNull();
      expect((await nudge("stranger", "rsvp", gatheringId)).error).not.toBeNull();
    });

    it("nudges everyone who hasn't answered, except the host's own kids; kids' go to their grown-ups", async () => {
      await clients.other.from("gathering_rsvps").insert({ gathering_id: gatheringId, profile_id: ids.other, status: "going" });
      const { data, error } = await nudge("host", "rsvp", gatheringId);
      expect(error).toBeNull();
      expect(data).toBe(2); // guest, and guest's kid Max (not other, who answered, or Lily)
      const got = await notices("guest", "nudge_rsvp");
      expect(got.map((n) => n.title).sort()).toEqual(["host is asking: are you coming?", "host is asking: is Max coming?"]);
      expect(await notices("other", "nudge_rsvp")).toEqual([]);
      expect((await nudge("host", "rsvp", gatheringId)).data).toBe(0); // once a day
    });

    it("hosts nudge people coming who haven't picked a dish", async () => {
      await clients.guest.from("gathering_rsvps").insert({ gathering_id: gatheringId, profile_id: ids.guest, status: "going" });
      await clients.other.from("potluck_dishes").insert({ potluck_id: potluckId, name: "Pie" });
      expect((await nudge("guest", "dish", potluckId)).error).not.toBeNull();
      const { data } = await nudge("host", "dish", potluckId);
      expect(data).toBe(1); // guest; other is bringing pie
      expect((await notices("guest", "nudge_dish")).map((n) => n.data)).toEqual([{ potluck_id: potluckId }]);
      expect(await notices("other", "nudge_dish")).toEqual([]);
    });
  });

  describe("Home jobs", () => {
    it("Rhythms: reminds whoever's job it is, only from inside the Home", async () => {
      const { data: home } = await clients.host.rpc("my_home");
      const { data: rhythm } = await clients.host
        .from("rhythms")
        .insert({ home_id: home, title: "Change the furnace filter", owner: ids.guest })
        .select("id")
        .single();
      expect((await nudge("stranger", "rhythm", rhythm!.id)).error).not.toBeNull();
      expect((await nudge("host", "rhythm", rhythm!.id)).data).toBe(1);
      expect((await notices("guest", "nudge_rhythm")).map((n) => n.title)).toEqual(["host is reminding you: Change the furnace filter"]);
    });

    it("Getaways: reminds whoever's doing a before-you-go task, only from someone going", async () => {
      const { data: trip, error } = await clients.host.rpc("create_getaway", {
        title: "Beach week",
        place: null,
        kind: "beach",
        starts_on: day(20),
        ends_on: day(27),
        notes: null,
        tz: "America/Chicago",
        people: [ids.guest],
      });
      expect(error).toBeNull();
      const { data: todo } = await clients.host
        .from("getaway_items")
        .insert({ getaway_id: trip, kind: "todo", text: "Book the dog sitter", for_person: ids.guest })
        .select("id")
        .single();
      expect((await nudge("stranger", "todo", todo!.id)).error).not.toBeNull();
      expect((await nudge("host", "todo", todo!.id)).data).toBe(1);
      expect((await notices("guest", "nudge_todo")).map((n) => n.body)).toEqual(["Before Beach week."]);
    });
  });
});
