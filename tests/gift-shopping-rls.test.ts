import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

// Shopping for a Gathering (GIFT-038..040), enforced in Postgres: "not
// getting them a gift" is private to whoever set it, and only your own tuck
// can be counted for another Gathering. GIFT-007: the person a gift is for
// learns nothing. Same setup as gift-nook-rls.test.ts (needs .env plus
// SUPABASE_SERVICE_ROLE_KEY in .env.test.local); skipped without them.

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL;
const ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const canRun = Boolean(SUPABASE_URL && ANON_KEY && SERVICE_ROLE_KEY);
const endOfDayIn = (days: number) => {
  const d = new Date(Date.now() + days * 864e5);
  d.setHours(23, 59, 59, 0);
  return d.toISOString();
};

describe.runIf(canRun)("Gathering shopping: private skips, your own tucks only", () => {
  let admin: SupabaseClient;
  const runId = Date.now();
  // owner, giver and cousin share a Burrow; stranger shares nothing.
  const people = ["owner", "giver", "cousin", "stranger"] as const;
  type Person = (typeof people)[number];
  const ids = {} as Record<Person, string>;
  const clients = {} as Record<Person, SupabaseClient>;
  let burrowId: string;
  let christmas: string;
  let birthday: string;
  let strangersParty: string;
  let tuckId: string;

  const plan = async (who: Person, title: string, burrows: string[]) => {
    const { data, error } = await clients[who].rpc("plan_gathering", {
      gathering_title: title,
      gathering_kind: "christmas",
      gathering_ends_at: endOfDayIn(20),
      gathering_starts_at: null,
      gathering_place: "",
      gathering_notes: "",
      with_gifts: true,
      with_food: false,
      burrow_ids: burrows,
      guest_ids: [],
      honoree_ids: [],
      cohost_ids: [],
    });
    if (error) throw error;
    return data as string;
  };

  beforeAll(async () => {
    admin = createClient(SUPABASE_URL!, SERVICE_ROLE_KEY!, { auth: { autoRefreshToken: false, persistSession: false } });
    for (const person of people) {
      const email = `shop-${person}-${runId}@example.com`;
      const password = `shop-${person}-pw!`;
      const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
      if (error || !data.user) throw error;
      ids[person] = data.user.id;
      const client = createClient(SUPABASE_URL!, ANON_KEY!, { auth: { autoRefreshToken: false, persistSession: false } });
      const { error: signInError } = await client.auth.signInWithPassword({ email, password });
      if (signInError) throw signInError;
      clients[person] = client;
    }
    const { data: burrow } = await clients.owner.rpc("create_burrow", { burrow_name: `Shop ${runId}` });
    burrowId = burrow;
    const { data: code } = await clients.owner.rpc("create_knock", { target_burrow: burrowId });
    await clients.giver.rpc("answer_knock", { knock_code: code });
    await clients.cousin.rpc("answer_knock", { knock_code: code });
    const strangerBurrow = (await clients.stranger.rpc("create_burrow", { burrow_name: `Alone ${runId}` })).data;

    christmas = await plan("owner", "Christmas", [burrowId]);
    birthday = await plan("owner", "Owner's birthday", [burrowId]);
    strangersParty = await plan("stranger", "Elsewhere", [strangerBurrow]);

    const { data: wishbook } = await clients.owner.from("wishbooks").select("id").eq("owner_id", ids.owner).single();
    const { data: shelf } = await clients.owner.from("shelves").select("id").eq("key", "other").single();
    const { data: gift } = await clients.owner
      .from("gifts")
      .insert({ wishbook_id: wishbook!.id, shelf_id: shelf!.id, title: "Kite" })
      .select("id")
      .single();
    // giver tucks it for the birthday.
    const { data: claim, error } = await clients.giver
      .from("claims")
      .insert({ gift_id: gift!.id, claimed_by: ids.giver, gathering_id: birthday })
      .select("id")
      .single();
    if (error) throw error;
    tuckId = claim!.id;
  });

  afterAll(async () => {
    for (const person of people) await admin.auth.admin.deleteUser(ids[person]);
  });

  it("a skip is seen only by whoever set it — never by the person skipped (GIFT-007)", async () => {
    const { error } = await clients.giver.from("gathering_skips").insert({ gathering_id: christmas, giver_id: ids.giver, profile_id: ids.cousin });
    expect(error).toBeNull();
    const { data: mine } = await clients.giver.from("gathering_skips").select("profile_id").eq("gathering_id", christmas);
    expect(mine?.map((r) => r.profile_id)).toEqual([ids.cousin]);
    for (const other of ["cousin", "owner", "stranger"] as const) {
      const { data, count } = await clients[other].from("gathering_skips").select("*", { count: "exact" }).eq("gathering_id", christmas);
      expect(data, other).toEqual([]);
      expect(count, other).toBe(0);
    }
    // And it tells nobody.
    const { data: notices } = await admin.from("notifications").select("title").eq("profile_id", ids.cousin);
    expect(JSON.stringify(notices)).not.toMatch(/skip|not getting/i);
  });

  it("you can't skip on someone else's behalf, yourself, or for a Gathering you're not at", async () => {
    expect((await clients.giver.from("gathering_skips").insert({ gathering_id: christmas, giver_id: ids.cousin, profile_id: ids.owner })).error).not.toBeNull();
    expect((await clients.giver.from("gathering_skips").insert({ gathering_id: christmas, giver_id: ids.giver, profile_id: ids.giver })).error).not.toBeNull();
    expect((await clients.giver.from("gathering_skips").insert({ gathering_id: strangersParty, giver_id: ids.giver, profile_id: ids.stranger })).error).not.toBeNull();
    expect((await clients.giver.from("gathering_skips").insert({ gathering_id: christmas, giver_id: ids.giver, profile_id: ids.stranger })).error).not.toBeNull();
  });

  it("only you can count your tuck for another Gathering, and only one you're both at", async () => {
    expect((await clients.cousin.rpc("set_tuck_gathering", { claim_id: tuckId, target_gathering: christmas })).error).not.toBeNull();
    expect((await clients.owner.rpc("set_tuck_gathering", { claim_id: tuckId, target_gathering: christmas })).error).not.toBeNull();
    expect((await clients.giver.rpc("set_tuck_gathering", { claim_id: tuckId, target_gathering: strangersParty })).error).not.toBeNull();

    expect((await clients.giver.rpc("set_tuck_gathering", { claim_id: tuckId, target_gathering: christmas })).error).toBeNull();
    const { data } = await admin.from("claims").select("gathering_id").eq("id", tuckId).single();
    expect(data?.gathering_id).toBe(christmas);
  });

  it("GIFT-007: the owner still sees no tuck, through either Gathering", async () => {
    for (const gathering of [christmas, birthday]) {
      const { data, count } = await clients.owner.from("claims").select("*", { count: "exact" }).eq("gathering_id", gathering);
      expect(data).toEqual([]);
      expect(count).toBe(0);
    }
    const { data: notices } = await admin.from("notifications").select("title, body").eq("profile_id", ids.owner);
    expect(JSON.stringify(notices)).not.toMatch(/tuck|claim/i);
  });
});
