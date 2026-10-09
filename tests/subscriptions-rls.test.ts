import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

// Subscriptions Nook (SUB-002, SUB-005, SUB-008, SUB-011, SUB-012), enforced
// in Postgres. Same setup as gift-nook-rls.test.ts (needs .env plus
// SUPABASE_SERVICE_ROLE_KEY in .env.test.local); skipped without them.

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL;
const ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const canRun = Boolean(SUPABASE_URL && ANON_KEY && SERVICE_ROLE_KEY);
const day = (offset = 0) => new Date(Date.now() + offset * 864e5).toISOString().slice(0, 10);

describe.runIf(canRun)("Subscriptions: the Home shares them, Just me stays yours, nobody else sees them", () => {
  let admin: SupabaseClient;
  const runId = Date.now();
  // josh and sarah share a Home. cousin shares a Burrow but not the Home.
  const people = ["josh", "sarah", "cousin"] as const;
  type Person = (typeof people)[number];
  const ids = {} as Record<Person, string>;
  const clients = {} as Record<Person, SupabaseClient>;

  let homeId: string;
  let sharedId: string;
  let privateId: string;
  let sarahPrivateId: string;

  beforeAll(async () => {
    admin = createClient(SUPABASE_URL!, SERVICE_ROLE_KEY!, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    for (const person of people) {
      const email = `subs-${person}-${runId}@example.com`;
      const password = `subs-${person}-pw!`;
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

    const { data: burrow } = await clients.josh.rpc("create_burrow", { burrow_name: `Subs ${runId}` });
    const { data: code } = await clients.josh.rpc("create_knock", { target_burrow: burrow });
    for (const person of ["sarah", "cousin"] as const) await clients[person].rpc("answer_knock", { knock_code: code });

    const { data: invite } = await clients.josh.rpc("invite_to_home", { target: ids.sarah });
    await clients.sarah.rpc("accept_home_invite", { invite_id: invite });

    const { data: home } = await clients.josh.rpc("my_home");
    homeId = home;
    // Read back in the same statement that adds it (the Pet Care bug).
    const shared = await clients.josh
      .from("subscriptions")
      .insert({ home_id: homeId, name: "Netflix", category: "streaming", price_cents: 1549, cycle: "monthly", renews_on: day(10) })
      .select("id")
      .single();
    if (shared.error) throw shared.error;
    sharedId = shared.data!.id;

    const mine = await clients.josh
      .from("subscriptions")
      .insert({ home_id: homeId, name: "Secret hobby", price_cents: 999, renews_on: day(5), private: true, payer: ids.josh })
      .select("id")
      .single();
    if (mine.error) throw mine.error;
    privateId = mine.data!.id;

    const hers = await clients.sarah
      .from("subscriptions")
      .insert({ home_id: homeId, name: "Audible", price_cents: 1495, renews_on: day(20), private: true })
      .select("id")
      .single();
    if (hers.error) throw hers.error;
    sarahPrivateId = hers.data!.id;
  });

  afterAll(async () => {
    for (const person of people) await admin.auth.admin.deleteUser(ids[person]);
  });

  const sees = async (person: Person, id: string) =>
    ((await clients[person].from("subscriptions").select("id").eq("id", id)).data ?? []).length === 1;

  it("the whole Home sees a shared one; someone outside the Home doesn't (SUB-002)", async () => {
    expect(await sees("josh", sharedId)).toBe(true);
    expect(await sees("sarah", sharedId)).toBe(true);
    expect(await sees("cousin", sharedId)).toBe(false);
  });

  it("a Just me one is seen by nobody but whoever added it, even in the same Home", async () => {
    expect(await sees("josh", privateId)).toBe(true);
    expect(await sees("sarah", privateId)).toBe(false);
    expect(await sees("cousin", privateId)).toBe(false);
    // Not even a count of them leaks.
    const { count } = await clients.sarah.from("subscriptions").select("id", { count: "exact", head: true }).eq("home_id", homeId);
    expect(count).toBe(2);
  });

  it("nobody else can change or remove a Just me one", async () => {
    await clients.sarah.from("subscriptions").update({ name: "Found it" }).eq("id", privateId);
    await clients.sarah.from("subscriptions").delete().eq("id", privateId);
    const { data } = await admin.from("subscriptions").select("name").eq("id", privateId).single();
    expect(data?.name).toBe("Secret hobby");
  });

  it("only whoever added a shared one can make it Just me", async () => {
    const { error } = await clients.sarah.from("subscriptions").update({ private: true }).eq("id", sharedId);
    expect(error).not.toBeNull();
    const { data } = await admin.from("subscriptions").select("private").eq("id", sharedId).single();
    expect(data?.private).toBe(false);
  });

  it("anyone in the Home can change a shared one; nobody else can", async () => {
    const { error } = await clients.sarah.from("subscriptions").update({ notes: "Premium plan" }).eq("id", sharedId);
    expect(error).toBeNull();
    await clients.cousin.from("subscriptions").update({ notes: "hacked" }).eq("id", sharedId);
    const { data } = await admin.from("subscriptions").select("notes").eq("id", sharedId).single();
    expect(data?.notes).toBe("Premium plan");
  });

  it("can't add one to someone else's Home, move one, or pretend someone else added it", async () => {
    const sneaky = await clients.cousin.from("subscriptions").insert({ home_id: homeId, name: "Sneaky", renews_on: day() });
    expect(sneaky.error).not.toBeNull();
    const asSarah = await clients.josh.from("subscriptions").insert({ home_id: homeId, name: "Framed", renews_on: day(), created_by: ids.sarah });
    expect(asSarah.error).not.toBeNull();
    const { data: cousinHome } = await clients.cousin.rpc("my_home");
    await clients.josh.from("subscriptions").update({ home_id: cousinHome } as never).eq("id", sharedId);
    await clients.josh.from("subscriptions").update({ created_by: ids.sarah } as never).eq("id", sharedId);
    const { data } = await admin.from("subscriptions").select("home_id, created_by").eq("id", sharedId).single();
    expect(data).toEqual({ home_id: homeId, created_by: ids.josh });
  });

  it("whoever pays has to live in the Home, and a Just me one can only be paid by its owner (SUB-005)", async () => {
    const outsider = await clients.josh.from("subscriptions").update({ payer: ids.cousin }).eq("id", sharedId);
    expect(outsider.error).not.toBeNull();
    const housemate = await clients.josh.from("subscriptions").update({ payer: ids.sarah }).eq("id", sharedId);
    expect(housemate.error).toBeNull();
    const privateForSarah = await clients.josh.from("subscriptions").update({ payer: ids.sarah }).eq("id", privateId);
    expect(privateForSarah.error).not.toBeNull();
  });

  it("never holds a full card number (SUB-005)", async () => {
    const longLast4 = await clients.josh.from("subscriptions").update({ card_last4: "4111111111111111" }).eq("id", sharedId);
    expect(longLast4.error).not.toBeNull();
    const numberAsName = await clients.josh.from("subscriptions").update({ card_name: "4111 111111111111" }).eq("id", sharedId);
    expect(numberAsName.error).not.toBeNull();
    const fine = await clients.josh.from("subscriptions").update({ card_name: "Chase Visa", card_last4: "1234" }).eq("id", sharedId);
    expect(fine.error).toBeNull();
  });

  it("keeps every price, written only by the database (SUB-008)", async () => {
    await clients.sarah.from("subscriptions").update({ price_cents: 1799 }).eq("id", sharedId);
    const { data: history } = await clients.josh
      .from("subscription_prices")
      .select("price_cents, changed_by")
      .eq("subscription_id", sharedId)
      .order("created_at");
    expect(history).toEqual([
      { price_cents: 1549, changed_by: ids.josh },
      { price_cents: 1799, changed_by: ids.sarah },
    ]);
    const forged = await clients.josh.from("subscription_prices").insert({ subscription_id: sharedId, price_cents: 1, cycle: "monthly" });
    expect(forged.error).not.toBeNull();
    const hidden = await clients.cousin.from("subscription_prices").select("id").eq("subscription_id", sharedId);
    expect(hidden.data).toEqual([]);
    const privateHistory = await clients.sarah.from("subscription_prices").select("id").eq("subscription_id", privateId);
    expect(privateHistory.data).toEqual([]);
  });

  it("pausing keeps it, with the day it stopped (SUB-010)", async () => {
    const { error } = await clients.sarah.from("subscriptions").update({ status: "paused", stopped_on: day() }).eq("id", sharedId);
    expect(error).toBeNull();
    const noDay = await clients.sarah.from("subscriptions").update({ status: "cancelled", stopped_on: null }).eq("id", sharedId);
    expect(noDay.error).not.toBeNull();
    await clients.sarah.from("subscriptions").update({ status: "active", stopped_on: null }).eq("id", sharedId);
  });

  it("the reminder job and its bookkeeping are the database's own", async () => {
    const job = await clients.josh.rpc("subscriptions_daily");
    expect(job.error).not.toBeNull();
    await clients.josh.from("subscriptions").update({ reminded_for: day(10) } as never).eq("id", sharedId);
    const { data } = await admin.from("subscriptions").select("reminded_for").eq("id", sharedId).single();
    expect(data?.reminded_for).toBeNull();
  });

  it("leaving the Home takes your Just me ones with you and stops you paying for shared ones (SUB-011)", async () => {
    await admin.from("subscriptions").update({ payer: ids.sarah }).eq("id", sharedId);
    const { data: newHome, error } = await clients.sarah.rpc("leave_home");
    expect(error).toBeNull();
    const { data: shared } = await admin.from("subscriptions").select("payer, home_id").eq("id", sharedId).single();
    expect(shared).toEqual({ payer: null, home_id: homeId });
    const { data: hers } = await admin.from("subscriptions").select("home_id").eq("id", sarahPrivateId).single();
    expect(hers?.home_id).toBe(newHome);
    expect(await sees("sarah", sharedId)).toBe(false);
    expect(await sees("sarah", sarahPrivateId)).toBe(true);
  });
});
