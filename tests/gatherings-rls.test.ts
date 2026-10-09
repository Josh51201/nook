import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

// The Gathering Nook (GATH-001..008), enforced in Postgres: guest lists of
// whole Burrows and people picked one by one, hosts, RSVPs and notices — and
// GIFT-007: inviting someone from another Burrow never shows them anyone's
// Wishbook or tucks, and the honoree still sees no claims. Same setup as
// gift-nook-rls.test.ts (needs .env plus SUPABASE_SERVICE_ROLE_KEY in
// .env.test.local); skipped without them.

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL;
const ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const canRun = Boolean(SUPABASE_URL && ANON_KEY && SERVICE_ROLE_KEY);
const endOfDayIn = (days: number) => {
  const d = new Date(Date.now() + days * 864e5);
  d.setHours(23, 59, 59, 0);
  return d.toISOString();
};

describe.runIf(canRun)("Gatherings: invited guests only, hosts change it, Wishbooks stay with the Burrow", () => {
  let admin: SupabaseClient;
  const runId = Date.now();
  // owner and giver share the Family Burrow; giver and friend share the
  // Friends Burrow (friend shares nothing with owner). stranger shares
  // nothing with anyone.
  const people = ["owner", "giver", "friend", "stranger"] as const;
  type Person = (typeof people)[number];
  const ids = {} as Record<Person, string>;
  const clients = {} as Record<Person, SupabaseClient>;

  let family: string;
  let friends: string;
  let gatheringId: string;
  let giftId: string;

  const planArgs = (overrides: Record<string, unknown> = {}) => ({
    gathering_title: `Owner's birthday ${runId}`,
    gathering_kind: "birthday",
    gathering_ends_at: endOfDayIn(10),
    gathering_starts_at: null,
    gathering_place: "The park",
    gathering_notes: "",
    with_gifts: true,
    with_food: false,
    burrow_ids: [family],
    guest_ids: [ids.friend],
    honoree_ids: [ids.owner],
    cohost_ids: [],
    ...overrides,
  });
  const updateArgs = (overrides: Record<string, unknown> = {}) => {
    const { with_food: _food, ...rest } = planArgs(overrides);
    return { target_gathering: gatheringId, ...rest };
  };
  const notices = async (who: Person, kind: string) =>
    ((await admin.from("notifications").select("title, data").eq("profile_id", ids[who]).eq("nook", "gatherings").eq("kind", kind)).data ?? []).filter(
      (n) => (n.data as { gathering_id?: string }).gathering_id === gatheringId
    );

  beforeAll(async () => {
    admin = createClient(SUPABASE_URL!, SERVICE_ROLE_KEY!, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    for (const person of people) {
      const email = `gather-${person}-${runId}@example.com`;
      const password = `gather-${person}-pw!`;
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

    const { data: familyBurrow } = await clients.owner.rpc("create_burrow", { burrow_name: `Family ${runId}` });
    family = familyBurrow;
    const { data: familyCode } = await clients.owner.rpc("create_knock", { target_burrow: family });
    await clients.giver.rpc("answer_knock", { knock_code: familyCode });

    const { data: friendsBurrow } = await clients.giver.rpc("create_burrow", { burrow_name: `Friends ${runId}` });
    friends = friendsBurrow;
    const { data: friendsCode } = await clients.giver.rpc("create_knock", { target_burrow: friends });
    await clients.friend.rpc("answer_knock", { knock_code: friendsCode });

    const { data: wishbook } = await clients.owner.from("wishbooks").select("id").eq("owner_id", ids.owner).single();
    const { data: shelf } = await clients.owner.from("shelves").select("id").eq("key", "other").single();
    const { data: gift, error: giftError } = await clients.owner
      .from("gifts")
      .insert({ wishbook_id: wishbook!.id, shelf_id: shelf!.id, title: "Kite" })
      .select("id")
      .single();
    if (giftError || !gift) throw giftError;
    giftId = gift.id;

    // giver plans it: the Family Burrow, plus friend picked one by one.
    const { data, error } = await clients.giver.rpc("plan_gathering", planArgs());
    if (error) throw error;
    gatheringId = data;
  });

  afterAll(async () => {
    for (const person of people) await admin.auth.admin.deleteUser(ids[person]);
  });

  it("everyone invited sees it — whole Burrows and people picked one by one — and nobody else", async () => {
    for (const person of ["owner", "giver", "friend"] as const) {
      const { data } = await clients[person].from("gatherings").select("id").eq("id", gatheringId);
      expect(data, person).toHaveLength(1);
    }
    const { data: hidden, count } = await clients.stranger.from("gatherings").select("id", { count: "exact" }).eq("id", gatheringId);
    expect(hidden).toEqual([]);
    expect(count).toBe(0);
    const { data: list } = await clients.stranger.rpc("gathering_guest_list", { target_gathering: gatheringId });
    expect(list).toEqual([]);
  });

  it("you can only invite your own Burrows and people you share one with", async () => {
    const strangerBurrow = (await clients.stranger.rpc("create_burrow", { burrow_name: `Alone ${runId}` })).data;
    expect((await clients.giver.rpc("plan_gathering", planArgs({ burrow_ids: [strangerBurrow], guest_ids: [] }))).error).not.toBeNull();
    expect((await clients.giver.rpc("plan_gathering", planArgs({ guest_ids: [ids.stranger] }))).error).not.toBeNull();
    // Who it's for has to be invited.
    expect((await clients.giver.rpc("plan_gathering", planArgs({ burrow_ids: [friends], guest_ids: [], honoree_ids: [ids.owner] }))).error).not.toBeNull();
    // And nobody can make one without the guest list.
    const direct = await clients.giver.from("gatherings").insert({ title: "Sneaky", ends_at: endOfDayIn(3) });
    expect(direct.error).not.toBeNull();
  });

  it("GIFT-007: a guest from another Burrow sees no Wishbook, gifts or tucks of the honoree", async () => {
    // giver tucks the owner's gift for this Gathering.
    const tuck = await clients.giver.from("claims").insert({ gift_id: giftId, claimed_by: ids.giver, gathering_id: gatheringId });
    expect(tuck.error).toBeNull();

    for (const table of ["wishbooks", "gifts", "claims"] as const) {
      const column = table === "wishbooks" ? "owner_id" : table === "gifts" ? "id" : "gift_id";
      const value = table === "wishbooks" ? ids.owner : giftId;
      const { data, count } = await clients.friend.from(table).select("*", { count: "exact" }).eq(column, value);
      expect(data, table).toEqual([]);
      expect(count, table).toBe(0);
    }
    // The friend can't tuck it either, even pointing at the shared Gathering.
    const sneaky = await clients.friend.from("claims").insert({ gift_id: giftId, claimed_by: ids.friend, gathering_id: gatheringId });
    expect(sneaky.error).not.toBeNull();

    // The guest list says whose Wishbooks you may open.
    const { data: list } = await clients.friend.rpc("gathering_guest_list", { target_gathering: gatheringId });
    const row = (who: Person) => (list as { profile_id: string; can_see_wishbook: boolean }[]).find((g) => g.profile_id === ids[who]);
    expect(row("owner")?.can_see_wishbook).toBe(false);
    expect(row("giver")?.can_see_wishbook).toBe(true);
  });

  it("GIFT-007: the honoree sees no claims, counts or hints through the Gathering", async () => {
    const { data: claims, count } = await clients.owner.from("claims").select("*", { count: "exact" }).eq("gift_id", giftId);
    expect(claims).toEqual([]);
    expect(count).toBe(0);
    const { data: viaGathering } = await clients.owner.from("claims").select("id").eq("gathering_id", gatheringId);
    expect(viaGathering).toEqual([]);
    // Nothing on the guest list, the Gathering or its notices mentions a tuck.
    const { data: list } = await clients.owner.rpc("gathering_guest_list", { target_gathering: gatheringId });
    expect(JSON.stringify(list)).not.toMatch(/claim|tuck/i);
    const { data: gathering } = await clients.owner.from("gatherings").select("*").eq("id", gatheringId).single();
    expect(JSON.stringify(gathering)).not.toMatch(/claim|tuck/i);
    const { data: ownerNotices } = await admin.from("notifications").select("title, body, kind").eq("profile_id", ids.owner);
    expect(JSON.stringify(ownerNotices)).not.toMatch(/tuck|claim/i);
  });

  it("only hosts change it; a co-host can once added", async () => {
    expect((await clients.friend.rpc("update_gathering", updateArgs({ gathering_title: "Mine now" }))).error).not.toBeNull();
    await clients.owner.from("gatherings").update({ title: "Hijacked" }).eq("id", gatheringId);
    const { data: same } = await admin.from("gatherings").select("title").eq("id", gatheringId).single();
    expect(same?.title).toBe(`Owner's birthday ${runId}`);

    expect((await clients.giver.rpc("update_gathering", updateArgs({ cohost_ids: [ids.giver, ids.friend] }))).error).toBeNull();
    expect((await clients.friend.rpc("update_gathering", updateArgs({ cohost_ids: [ids.giver, ids.friend], gathering_place: "The beach" }))).error).toBeNull();
    const { data: moved } = await admin.from("gatherings").select("place").eq("id", gatheringId).single();
    expect(moved?.place).toBe("The beach");
    // Everyone still coming hears that the place changed; the one who changed it doesn't.
    expect((await notices("owner", "gathering_changed")).length).toBe(1);
    expect(await notices("friend", "gathering_changed")).toEqual([]);
  });

  it("RSVPs are for yourself only, and go away with your invitation", async () => {
    expect((await clients.friend.from("gathering_rsvps").insert({ gathering_id: gatheringId, profile_id: ids.friend, status: "going" })).error).toBeNull();
    expect((await clients.friend.from("gathering_rsvps").insert({ gathering_id: gatheringId, profile_id: ids.owner, status: "no" })).error).not.toBeNull();
    expect((await clients.stranger.from("gathering_rsvps").insert({ gathering_id: gatheringId, profile_id: ids.stranger, status: "going" })).error).not.toBeNull();
    // The hosts hear about it.
    expect((await notices("giver", "gathering_rsvp")).length).toBe(1);

    // Taking friend off the list (and off the hosts) takes their answer and their view away.
    expect((await clients.giver.rpc("update_gathering", updateArgs({ guest_ids: [], cohost_ids: [ids.giver] }))).error).toBeNull();
    const { data: rsvp } = await admin.from("gathering_rsvps").select("status").eq("gathering_id", gatheringId).eq("profile_id", ids.friend);
    expect(rsvp).toEqual([]);
    const { data: gone } = await clients.friend.from("gatherings").select("id").eq("id", gatheringId);
    expect(gone).toEqual([]);
  });

  it("everyone invited hears about it once, but not the person who planned it", async () => {
    expect((await notices("owner", "gathering_invite")).length).toBe(1);
    expect((await notices("friend", "gathering_invite")).length).toBe(1);
    expect(await notices("giver", "gathering_invite")).toEqual([]);
    expect(await notices("stranger", "gathering_invite")).toEqual([]);
  });

  it("guests can't delete it; hosts can", async () => {
    await clients.owner.from("gatherings").delete().eq("id", gatheringId);
    expect((await admin.from("gatherings").select("id").eq("id", gatheringId)).data).toHaveLength(1);
    expect((await clients.giver.from("gatherings").delete().eq("id", gatheringId)).error).toBeNull();
    expect((await admin.from("gatherings").select("id").eq("id", gatheringId)).data).toEqual([]);
  });
});
