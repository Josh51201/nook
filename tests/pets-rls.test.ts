import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

// Pet Care Nook (PET-002..007), enforced in Postgres. Same setup as
// gift-nook-rls.test.ts (needs .env plus SUPABASE_SERVICE_ROLE_KEY in
// .env.test.local); skipped without them.

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL;
const ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const canRun = Boolean(SUPABASE_URL && ANON_KEY && SERVICE_ROLE_KEY);
const today = () => new Date().toISOString().slice(0, 10);

describe.runIf(canRun)("Pet Care: the Home looks after it, helpers help, strangers see nothing", () => {
  let admin: SupabaseClient;
  const runId = Date.now();
  // josh and sarah share a Home. sitter shares a Burrow with josh. nana is
  // a helper whose time has run out. stranger shares nothing.
  const people = ["josh", "sarah", "sitter", "nana", "stranger"] as const;
  type Person = (typeof people)[number];
  const ids = {} as Record<Person, string>;
  const clients = {} as Record<Person, SupabaseClient>;

  let petId: string;
  let mealId: string;

  beforeAll(async () => {
    admin = createClient(SUPABASE_URL!, SERVICE_ROLE_KEY!, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    for (const person of people) {
      const email = `pets-${person}-${runId}@example.com`;
      const password = `pets-${person}-pw!`;
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

    // A Burrow for josh, sarah, sitter and nana; sarah joins josh's Home.
    const { data: burrow } = await clients.josh.rpc("create_burrow", { burrow_name: `Pets ${runId}` });
    const { data: code } = await clients.josh.rpc("create_knock", { target_burrow: burrow });
    for (const person of ["sarah", "sitter", "nana"] as const) await clients[person].rpc("answer_knock", { knock_code: code });

    const { data: invite } = await clients.josh.rpc("invite_to_home", { target: ids.sarah });
    await clients.sarah.rpc("accept_home_invite", { invite_id: invite });

    const { data: homeId } = await clients.josh.rpc("my_home");
    const { data: pet, error } = await clients.josh
      .from("pets")
      .insert({ home_id: homeId, name: "Biscuit", species: "dog", created_by: ids.josh })
      .select("id")
      .single();
    if (error) throw error;
    petId = pet!.id;
    const { data: meal } = await clients.josh
      .from("pet_meals")
      .insert({ pet_id: petId, label: "Breakfast" })
      .select("id")
      .single();
    mealId = meal!.id;

    await clients.josh.from("pet_helpers").insert({ pet_id: petId, profile_id: ids.sitter, added_by: ids.josh });
    // nana's access ended yesterday (added directly so the test can set it).
    await admin
      .from("pet_helpers")
      .insert({ pet_id: petId, profile_id: ids.nana, added_by: ids.josh, until: new Date(Date.now() - 864e5).toISOString().slice(0, 10) });
  });

  afterAll(async () => {
    for (const person of people) await admin.auth.admin.deleteUser(ids[person]);
  });

  it("the whole Home and an active helper see the pet; an ended helper and strangers don't", async () => {
    const sees = async (person: Person) =>
      ((await clients[person].from("pets").select("id").eq("id", petId)).data ?? []).length === 1;
    expect(await sees("josh")).toBe(true);
    expect(await sees("sarah")).toBe(true);
    expect(await sees("sitter")).toBe(true);
    expect(await sees("nana")).toBe(false);
    expect(await sees("stranger")).toBe(false);
  });

  it("everyone in the Home can change the pet; a helper can't", async () => {
    const { error: sarahError } = await clients.sarah.from("pets").update({ food: "Kibble" }).eq("id", petId);
    expect(sarahError).toBeNull();
    await clients.sitter.from("pets").update({ food: "Steak" }).eq("id", petId);
    const { data } = await clients.josh.from("pets").select("food").eq("id", petId).single();
    expect(data?.food).toBe("Kibble");
    const { error: mealError } = await clients.sitter.from("pet_meals").insert({ pet_id: petId, label: "Midnight snack" });
    expect(mealError).not.toBeNull();
  });

  it("a pet can't be moved to someone else's Home", async () => {
    const { data: strangerHome } = await clients.stranger.rpc("my_home");
    await clients.josh.from("pets").update({ home_id: strangerHome } as never).eq("id", petId);
    const { data } = await admin.from("pets").select("home_id").eq("id", petId).single();
    expect(data?.home_id).not.toBe(strangerHome);
  });

  it("a meal is fed once a day: the second person is turned away", async () => {
    const first = await clients.sitter.from("pet_care_log").insert({ pet_id: petId, kind: "meal", meal_id: mealId, day: today() });
    expect(first.error).toBeNull();
    const second = await clients.sarah.from("pet_care_log").insert({ pet_id: petId, kind: "meal", meal_id: mealId, day: today() });
    expect(second.error?.code).toBe("23505");
  });

  it("you can only check things off as yourself", async () => {
    const { error } = await clients.sitter
      .from("pet_care_log")
      .insert({ pet_id: petId, kind: "walk", day: today(), done_by: ids.josh });
    expect(error).not.toBeNull();
    const ended = await clients.nana.from("pet_care_log").insert({ pet_id: petId, kind: "walk", day: today() });
    expect(ended.error).not.toBeNull();
  });

  it("a helper can undo their own entry, not someone else's", async () => {
    const { data: walk } = await clients.sitter
      .from("pet_care_log")
      .insert({ pet_id: petId, kind: "treat", day: today() })
      .select("id")
      .single();
    await clients.sitter.from("pet_care_log").delete().eq("id", walk!.id);
    const { data: gone } = await admin.from("pet_care_log").select("id").eq("id", walk!.id);
    expect(gone).toEqual([]);

    const { data: meal } = await admin.from("pet_care_log").select("id").eq("meal_id", mealId).single();
    await clients.sitter.from("pet_care_log").delete().eq("id", meal!.id).eq("done_by", ids.josh);
    const { data: kept } = await admin.from("pet_care_log").select("id").eq("id", meal!.id);
    expect(kept).toHaveLength(1);
  });

  it("a helper can mark a medication done, which rolls it forward", async () => {
    const { data: item } = await clients.josh
      .from("pet_health")
      .insert({ pet_id: petId, kind: "medication", title: "Heartworm", due_on: today(), repeat_days: 30 })
      .select("id")
      .single();
    const { error } = await clients.sitter.rpc("complete_pet_health", { target_item: item!.id, on_day: today() });
    expect(error).toBeNull();
    const { data: after } = await admin.from("pet_health").select("due_on, last_done_on").eq("id", item!.id).single();
    expect(after?.last_done_on).toBe(today());
    expect(after?.due_on).not.toBe(today());

    const stranger = await clients.stranger.rpc("complete_pet_health", { target_item: item!.id, on_day: today() });
    expect(stranger.error).not.toBeNull();
  });

  it("only people you share a Burrow with can be made helpers", async () => {
    const { error } = await clients.josh
      .from("pet_helpers")
      .insert({ pet_id: petId, profile_id: ids.stranger, added_by: ids.josh });
    expect(error).not.toBeNull();
  });
});
