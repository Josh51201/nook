import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

// Getaway Nook (TRIP-002, TRIP-003, TRIP-008, TRIP-009, TRIP-013), enforced
// in Postgres. Same setup as gift-nook-rls.test.ts (needs .env plus
// SUPABASE_SERVICE_ROLE_KEY in .env.test.local); skipped without them.

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL;
const ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const canRun = Boolean(SUPABASE_URL && ANON_KEY && SERVICE_ROLE_KEY);
const day = (offset = 0) => new Date(Date.now() + offset * 864e5).toISOString().slice(0, 10);

describe.runIf(canRun)("Getaways: only the people going see them", () => {
  let admin: SupabaseClient;
  const runId = Date.now();
  // josh and sarah share a Home; grandma and cousin share a Burrow with
  // josh; stranger knows nobody. josh, sarah and grandma are going.
  const people = ["josh", "sarah", "grandma", "cousin", "stranger"] as const;
  type Person = (typeof people)[number];
  const ids = {} as Record<Person, string>;
  const clients = {} as Record<Person, SupabaseClient>;

  let tripId: string;

  beforeAll(async () => {
    admin = createClient(SUPABASE_URL!, SERVICE_ROLE_KEY!, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    for (const person of people) {
      const email = `trip-${person}-${runId}@example.com`;
      const password = `trip-${person}-pw!`;
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

    const { data: burrow } = await clients.josh.rpc("create_burrow", { burrow_name: `Trip ${runId}` });
    const { data: code } = await clients.josh.rpc("create_knock", { target_burrow: burrow });
    for (const person of ["sarah", "grandma", "cousin"] as const) await clients[person].rpc("answer_knock", { knock_code: code });
    const { data: invite } = await clients.josh.rpc("invite_to_home", { target: ids.sarah });
    await clients.sarah.rpc("accept_home_invite", { invite_id: invite });

    const { data, error } = await clients.josh.rpc("create_getaway", {
      title: "Beach week",
      place: "Gulf Shores",
      kind: "beach",
      starts_on: day(20),
      ends_on: day(27),
      notes: null,
      tz: "America/Chicago",
      people: [ids.sarah, ids.grandma],
    });
    if (error) throw error;
    tripId = data as string;
  });

  afterAll(async () => {
    for (const person of people) await admin.auth.admin.deleteUser(ids[person]);
  });

  const sees = async (person: Person, table: string, column = "getaway_id") =>
    ((await clients[person].from(table).select("*").eq(column, tripId)).data ?? []).length;

  it("everyone going sees it; family not going and strangers don't (TRIP-002)", async () => {
    for (const person of ["josh", "sarah", "grandma"] as const) expect(await sees(person, "getaways", "id")).toBe(1);
    for (const person of ["cousin", "stranger"] as const) {
      expect(await sees(person, "getaways", "id")).toBe(0);
      expect(await sees(person, "getaway_people")).toBe(0);
    }
  });

  it("can't start one with someone you don't know", async () => {
    const { error } = await clients.josh.rpc("create_getaway", {
      title: "Sneaky",
      place: null,
      kind: "other",
      starts_on: day(1),
      ends_on: day(2),
      notes: null,
      tz: "UTC",
      people: [ids.stranger],
    });
    expect(error).not.toBeNull();
  });

  it("nobody can add themselves, and only family or housemates can be added", async () => {
    const self = await clients.cousin.from("getaway_people").insert({ getaway_id: tripId, profile_id: ids.cousin });
    expect(self.error).not.toBeNull();
    const stranger = await clients.josh.from("getaway_people").insert({ getaway_id: tripId, profile_id: ids.stranger });
    expect(stranger.error).not.toBeNull();
    const cousin = await clients.grandma.from("getaway_people").insert({ getaway_id: tripId, profile_id: ids.cousin });
    expect(cousin.error).toBeNull();
    expect(await sees("cousin", "getaways", "id")).toBe(1);
    // …and the cousin hears about it (TRIP-011).
    const { data: notices } = await admin.from("notifications").select("kind").eq("profile_id", ids.cousin).eq("nook", "getaways");
    expect(notices?.map((n) => n.kind)).toContain("getaway_added");
  });

  it("only whoever started it can take someone else off", async () => {
    await clients.grandma.from("getaway_people").delete().eq("getaway_id", tripId).eq("profile_id", ids.sarah);
    expect(await sees("sarah", "getaways", "id")).toBe(1);
    const { error } = await clients.josh.from("getaway_people").delete().eq("getaway_id", tripId).eq("profile_id", ids.cousin);
    expect(error).toBeNull();
    expect(await sees("cousin", "getaways", "id")).toBe(0);
  });

  it("lists, confirmations, plans and costs are for the people going only", async () => {
    const pack = await clients.sarah.from("getaway_items").insert({ getaway_id: tripId, kind: "pack", text: "Swimsuit", for_person: ids.sarah });
    expect(pack.error).toBeNull();
    const booking = await clients.josh.from("getaway_bookings").insert({ getaway_id: tripId, kind: "stay", title: "Seaside Inn", code: "ZX9", starts_on: day(20) });
    expect(booking.error).toBeNull();
    const plan = await clients.grandma.from("getaway_plans").insert({ getaway_id: tripId, on_day: day(21), title: "Aquarium" });
    expect(plan.error).toBeNull();
    const cost = await clients.josh.from("getaway_costs").insert({
      getaway_id: tripId, what: "The house", amount_cents: 90000, paid_by: ids.josh, split_among: [ids.josh, ids.sarah, ids.grandma],
    });
    expect(cost.error).toBeNull();

    for (const table of ["getaway_items", "getaway_bookings", "getaway_plans", "getaway_costs"]) {
      expect(await sees("grandma", table)).toBe(1);
      expect(await sees("cousin", table)).toBe(0);
      expect(await sees("stranger", table)).toBe(0);
      const sneaky = await clients.stranger.from(table).insert({ getaway_id: tripId } as never);
      expect(sneaky.error).not.toBeNull();
    }
  });

  it("a list line can only be for someone going, and records who ticked it", async () => {
    const outsider = await clients.josh.from("getaway_items").insert({ getaway_id: tripId, kind: "pack", text: "Hat", for_person: ids.stranger });
    expect(outsider.error).not.toBeNull();
    const { data: line } = await clients.josh
      .from("getaway_items")
      .insert({ getaway_id: tripId, kind: "todo", text: "Hold the mail", done_by: ids.grandma, done_at: null } as never)
      .select("id, done_by")
      .single();
    expect(line?.done_by).toBeNull();
    await clients.sarah.from("getaway_items").update({ done_at: new Date().toISOString() }).eq("id", line!.id);
    const { data } = await admin.from("getaway_items").select("done_by").eq("id", line!.id).single();
    expect(data?.done_by).toBe(ids.sarah);
  });

  it("costs can only be paid by and split between people going (TRIP-009)", async () => {
    const paidByOutsider = await clients.josh.from("getaway_costs").insert({
      getaway_id: tripId, what: "Gas", amount_cents: 5000, paid_by: ids.stranger, split_among: [ids.josh],
    });
    expect(paidByOutsider.error).not.toBeNull();
    const splitWithOutsider = await clients.josh.from("getaway_costs").insert({
      getaway_id: tripId, what: "Gas", amount_cents: 5000, paid_by: ids.josh, split_among: [ids.josh, ids.cousin],
    });
    expect(splitWithOutsider.error).not.toBeNull();
  });

  it("saved packing lists are yours alone (TRIP-008)", async () => {
    const { error } = await clients.josh.from("getaway_pack_lists").insert({ name: "Beach", items: ["Towel", "Sunscreen"] });
    expect(error).toBeNull();
    expect(((await clients.josh.from("getaway_pack_lists").select("id")).data ?? []).length).toBe(1);
    expect(((await clients.sarah.from("getaway_pack_lists").select("id")).data ?? []).length).toBe(0);
  });

  it("only whoever started it can remove it, and the reminder job is the database's own", async () => {
    await clients.sarah.from("getaways").delete().eq("id", tripId);
    expect(await sees("josh", "getaways", "id")).toBe(1);
    const job = await clients.josh.rpc("getaways_daily");
    expect(job.error).not.toBeNull();
  });

  it("leaving takes your packing list with you; when the last person leaves, it's gone", async () => {
    await clients.sarah.from("getaway_people").delete().eq("getaway_id", tripId).eq("profile_id", ids.sarah);
    const { data: hers } = await admin.from("getaway_items").select("id").eq("getaway_id", tripId).eq("for_person", ids.sarah);
    expect(hers).toEqual([]);

    const { data: solo } = await clients.stranger.rpc("create_getaway", {
      title: "Alone time", place: null, kind: "other", starts_on: day(3), ends_on: day(4), notes: null, tz: "UTC", people: [],
    });
    await clients.stranger.from("getaway_people").delete().eq("getaway_id", solo).eq("profile_id", ids.stranger);
    const { data: gone } = await admin.from("getaways").select("id").eq("id", solo);
    expect(gone).toEqual([]);
  });
});
