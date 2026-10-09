import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

// Potluck Nook (POT-002..008) and dietary needs (PROF-004), enforced in
// Postgres. A Potluck is the food part of a Gathering (GATH-004): its guests,
// hosts and RSVPs are the Gathering's. Same setup as gift-nook-rls.test.ts
// (needs .env plus SUPABASE_SERVICE_ROLE_KEY in .env.test.local); skipped
// without them.

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL;
const ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const canRun = Boolean(SUPABASE_URL && ANON_KEY && SERVICE_ROLE_KEY);
const endOfDayIn = (days: number) => {
  const d = new Date(Date.now() + days * 864e5);
  d.setHours(23, 59, 59, 0);
  return d.toISOString();
};

describe.runIf(canRun)("Potluck: only the Gathering's guests see it, only its hosts change it", () => {
  let admin: SupabaseClient;
  const runId = Date.now();
  // host, guest and admin share a Burrow (admin is its creator). outsider
  // is in a different Burrow, with a cousin who shares nothing with them.
  const people = ["admin", "host", "guest", "outsider", "cousin"] as const;
  type Person = (typeof people)[number];
  const ids = {} as Record<Person, string>;
  const clients = {} as Record<Person, SupabaseClient>;

  let burrowId: string;
  let otherBurrowId: string;
  let gatheringId: string;
  let potluckId: string;
  let slotId: string;
  let kidId: string;

  const plan = (who: Person, burrows: string[], guests: string[] = [], cohosts: string[] = []) =>
    clients[who].rpc("plan_gathering", {
      gathering_title: "Christmas dinner",
      gathering_kind: "dinner",
      gathering_ends_at: endOfDayIn(7),
      gathering_starts_at: new Date(Date.now() + 7 * 864e5).toISOString(),
      gathering_place: "",
      gathering_notes: "",
      with_gifts: false,
      with_food: true,
      burrow_ids: burrows,
      guest_ids: guests,
      honoree_ids: [],
      cohost_ids: cohosts,
    });

  beforeAll(async () => {
    admin = createClient(SUPABASE_URL!, SERVICE_ROLE_KEY!, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    for (const person of people) {
      const email = `potluck-${person}-${runId}@example.com`;
      const password = `potluck-${person}-pw!`;
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

    const { data: burrow } = await clients.admin.rpc("create_burrow", { burrow_name: `Potluck ${runId}` });
    burrowId = burrow;
    const { data: code } = await clients.admin.rpc("create_knock", { target_burrow: burrowId });
    await clients.host.rpc("answer_knock", { knock_code: code });
    await clients.guest.rpc("answer_knock", { knock_code: code });

    const { data: other } = await clients.outsider.rpc("create_burrow", { burrow_name: `Elsewhere ${runId}` });
    otherBurrowId = other;
    const { data: otherCode } = await clients.outsider.rpc("create_knock", { target_burrow: otherBurrowId });
    await clients.cousin.rpc("answer_knock", { knock_code: otherCode });

    // The guest manages a kid in the Burrow.
    const { data: kid } = await clients.guest.rpc("create_managed_profile", {
      profile_name: "Mia",
      burrow_ids: [burrowId],
    });
    kidId = kid;

    const { data: gathering, error } = await plan("host", [burrowId]);
    if (error) throw error;
    gatheringId = gathering;
    const { data: potluck } = await admin.from("potlucks").select("id, title").eq("gathering_id", gatheringId).single();
    potluckId = potluck!.id;

    const { data: slot, error: slotError } = await clients.host
      .from("potluck_slots")
      .insert({ potluck_id: potluckId, label: "Dessert", wanted: 1 })
      .select("id")
      .single();
    if (slotError || !slot) throw slotError;
    slotId = slot.id;
  });

  afterAll(async () => {
    for (const person of people) await admin.auth.admin.deleteUser(ids[person]);
    if (kidId) await admin.from("profiles").delete().eq("id", kidId);
  });

  it("takes its name and time from the Gathering, whose planner hosts it", async () => {
    const { data: potluck } = await clients.guest.from("potlucks").select("title").eq("id", potluckId).single();
    expect(potluck?.title).toBe("Christmas dinner");
    const { data } = await clients.guest.from("gathering_hosts").select("profile_id").eq("gathering_id", gatheringId);
    expect(data?.map((h) => h.profile_id)).toEqual([ids.host]);
  });

  it("someone not invited sees nothing at all", async () => {
    const checks: [string, string, string][] = [
      ["potlucks", "id", potluckId],
      ["potluck_slots", "potluck_id", potluckId],
      ["potluck_dishes", "potluck_id", potluckId],
      ["gatherings", "id", gatheringId],
      ["gathering_rsvps", "gathering_id", gatheringId],
      ["gathering_hosts", "gathering_id", gatheringId],
      ["gathering_burrows", "gathering_id", gatheringId],
    ];
    for (const [table, column, value] of checks) {
      const { data, count } = await clients.outsider.from(table).select("*", { count: "exact" }).eq(column, value);
      expect(data, table).toEqual([]);
      expect(count, table).toBe(0);
    }
    const { data: list } = await clients.outsider.rpc("gathering_guest_list", { target_gathering: gatheringId });
    expect(list).toEqual([]);
  });

  it("someone not invited can't sign up to bring something, or RSVP", async () => {
    const dish = await clients.outsider
      .from("potluck_dishes")
      .insert({ potluck_id: potluckId, name: "Sneaky pie", brought_by: ids.outsider });
    expect(dish.error).not.toBeNull();
    const rsvp = await clients.outsider
      .from("gathering_rsvps")
      .insert({ gathering_id: gatheringId, profile_id: ids.outsider, status: "going" });
    expect(rsvp.error).not.toBeNull();
  });

  it("guests can't change the Gathering or its spots; hosts and Burrow admins can", async () => {
    await clients.guest.from("gatherings").update({ title: "Hijacked" }).eq("id", gatheringId);
    await clients.guest.from("potluck_slots").update({ wanted: 9 }).eq("id", slotId);
    const guestSlot = await clients.guest.from("potluck_slots").insert({ potluck_id: potluckId, label: "Mine" });
    expect(guestSlot.error).not.toBeNull();
    const { data: unchanged } = await admin.from("gatherings").select("title").eq("id", gatheringId).single();
    expect(unchanged?.title).toBe("Christmas dinner");
    const { data: slot } = await admin.from("potluck_slots").select("wanted").eq("id", slotId).single();
    expect(slot?.wanted).toBe(1);

    // The Burrow's admin steps in; the Potluck follows the Gathering.
    await clients.admin.from("gatherings").update({ place: "Grandma's" }).eq("id", gatheringId);
    const { data: edited } = await admin.from("potlucks").select("place").eq("id", potluckId).single();
    expect(edited?.place).toBe("Grandma's");
  });

  it("a co-host can change it once added; kids and outsiders can't co-host", async () => {
    const args = (cohosts: string[]) => ({
      target_gathering: gatheringId,
      gathering_title: "Christmas dinner",
      gathering_kind: "dinner",
      gathering_ends_at: endOfDayIn(7),
      gathering_starts_at: null,
      gathering_place: "Grandma's",
      gathering_notes: "",
      with_gifts: false,
      burrow_ids: [burrowId],
      guest_ids: [],
      honoree_ids: [],
      cohost_ids: cohosts,
    });
    expect((await clients.host.rpc("update_gathering", args([ids.host, ids.outsider]))).error).not.toBeNull();
    expect((await clients.host.rpc("update_gathering", args([ids.host, kidId]))).error).not.toBeNull();

    expect((await clients.host.rpc("update_gathering", args([ids.host, ids.guest]))).error).toBeNull();
    await clients.guest.from("gatherings").update({ notes: "Bring chairs" }).eq("id", gatheringId);
    const { data } = await admin.from("potlucks").select("notes").eq("id", potluckId).single();
    expect(data?.notes).toBe("Bring chairs");
    expect((await clients.host.rpc("update_gathering", args([ids.host]))).error).toBeNull();
  });

  it("you can only bring dishes as yourself, and a full spot takes no more", async () => {
    const asSomeoneElse = await clients.guest
      .from("potluck_dishes")
      .insert({ potluck_id: potluckId, name: "Pie", brought_by: ids.host });
    expect(asSomeoneElse.error).not.toBeNull();

    const first = await clients.guest
      .from("potluck_dishes")
      .insert({ potluck_id: potluckId, slot_id: slotId, name: "Pie", brought_by: ids.guest, tags: ["dairy"] })
      .select("id")
      .single();
    expect(first.error).toBeNull();

    const second = await clients.admin
      .from("potluck_dishes")
      .insert({ potluck_id: potluckId, slot_id: slotId, name: "Cake", brought_by: ids.admin });
    expect(second.error).not.toBeNull();

    // Without a spot, anyone invited can still add a dish.
    const free = await clients.admin
      .from("potluck_dishes")
      .insert({ potluck_id: potluckId, name: "Cake", brought_by: ids.admin });
    expect(free.error).toBeNull();

    // Only the person bringing it can rename it; a host can take it off.
    await clients.admin.from("potluck_dishes").update({ name: "Renamed" }).eq("id", first.data!.id);
    const { data: still } = await admin.from("potluck_dishes").select("name").eq("id", first.data!.id).single();
    expect(still?.name).toBe("Pie");
    const { error: hostRemoves } = await clients.host.from("potluck_dishes").delete().eq("id", first.data!.id);
    expect(hostRemoves).toBeNull();
    const { data: gone } = await admin.from("potluck_dishes").select("id").eq("id", first.data!.id);
    expect(gone).toEqual([]);
  });

  it("RSVPs: for yourself or a kid you manage, never for anyone else", async () => {
    const self = await clients.guest
      .from("gathering_rsvps")
      .insert({ gathering_id: gatheringId, profile_id: ids.guest, status: "going", extra_guests: 2 });
    expect(self.error).toBeNull();
    const kid = await clients.guest
      .from("gathering_rsvps")
      .insert({ gathering_id: gatheringId, profile_id: kidId, status: "going" });
    expect(kid.error).toBeNull();
    const forHost = await clients.guest
      .from("gathering_rsvps")
      .insert({ gathering_id: gatheringId, profile_id: ids.host, status: "no" });
    expect(forHost.error).not.toBeNull();
  });

  it("only a Gathering's hosts can add a Potluck to it", async () => {
    const { data: theirs } = await plan("outsider", [otherBurrowId]);
    const crossed = await clients.host.from("potlucks").insert({ gathering_id: theirs, title: "x", starts_at: new Date().toISOString(), created_by: ids.host });
    expect(crossed.error).not.toBeNull();
    const asGuest = await clients.cousin.rpc("add_potluck", { target_gathering: theirs });
    expect(asGuest.error).not.toBeNull();
  });

  it("allergies reach your Burrow family and a kid's managers — nobody else", async () => {
    const own = await clients.guest
      .from("dietary_needs")
      .upsert({ profile_id: ids.guest, allergies: ["peanuts"], diets: [] });
    expect(own.error).toBeNull();
    const forKid = await clients.guest
      .from("dietary_needs")
      .upsert({ profile_id: kidId, allergies: ["sesame"], diets: ["vegetarian"] });
    expect(forKid.error).toBeNull();
    const forOthers = await clients.admin
      .from("dietary_needs")
      .upsert({ profile_id: ids.guest, allergies: [], diets: [] });
    expect(forOthers.error).not.toBeNull();

    const { data: family } = await clients.host.from("dietary_needs").select("profile_id").in("profile_id", [ids.guest, kidId]);
    expect(family).toHaveLength(2);
    const { data: stranger } = await clients.cousin
      .from("dietary_needs")
      .select("profile_id")
      .in("profile_id", [ids.guest, kidId]);
    expect(stranger).toEqual([]);
  });

  it("only hosts (or Burrow admins) can delete the Potluck; the Gathering stays", async () => {
    await clients.guest.from("potlucks").delete().eq("id", potluckId);
    const { data: kept } = await admin.from("potlucks").select("id").eq("id", potluckId);
    expect(kept).toHaveLength(1);
    const { error } = await clients.admin.from("potlucks").delete().eq("id", potluckId);
    expect(error).toBeNull();
    const { data: gone } = await admin.from("potlucks").select("id").eq("id", potluckId);
    expect(gone).toEqual([]);
    const { data: gathering } = await admin.from("gatherings").select("id").eq("id", gatheringId);
    expect(gathering).toHaveLength(1);
  });
});
