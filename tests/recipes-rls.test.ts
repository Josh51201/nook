import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

// Recipe Box (REC-002/009/012), enforced in Postgres: your recipes reach
// family in your Burrows and nobody else; "Just me" recipes reach nobody;
// only the owner can change or delete one; a Potluck dish can only point at
// the bringer's own recipe. Same setup as gift-nook-rls.test.ts (needs .env
// plus SUPABASE_SERVICE_ROLE_KEY in .env.test.local); skipped without them.

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL;
const ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const canRun = Boolean(SUPABASE_URL && ANON_KEY && SERVICE_ROLE_KEY);

describe.runIf(canRun)("Recipe Box: shared with Burrow family only", () => {
  let admin: SupabaseClient;
  const runId = Date.now();
  // mom owns the recipes; josh shares her Burrow; stranger shares nothing.
  const people = ["mom", "josh", "stranger"] as const;
  type Person = (typeof people)[number];
  const ids = {} as Record<Person, string>;
  const clients = {} as Record<Person, SupabaseClient>;
  let burrowId: string;
  let sharedId: string;
  let privateId: string;

  beforeAll(async () => {
    admin = createClient(SUPABASE_URL!, SERVICE_ROLE_KEY!, { auth: { autoRefreshToken: false, persistSession: false } });
    for (const person of people) {
      const email = `recipes-${person}-${runId}@example.com`;
      const password = `recipes-${person}-pw!`;
      const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
      if (error || !data.user) throw error;
      ids[person] = data.user.id;
      const client = createClient(SUPABASE_URL!, ANON_KEY!, { auth: { autoRefreshToken: false, persistSession: false } });
      const { error: signInError } = await client.auth.signInWithPassword({ email, password });
      if (signInError) throw signInError;
      clients[person] = client;
    }
    const { data: burrow } = await clients.mom.rpc("create_burrow", { burrow_name: `Recipes ${runId}` });
    burrowId = burrow as string;
    const { data: code } = await clients.mom.rpc("create_knock", { target_burrow: burrowId });
    await clients.josh.rpc("answer_knock", { knock_code: code });

    const shared = await clients.mom
      .from("recipes")
      .insert({ title: "Grandma's chili", ingredients: ["1 lb beef"], steps: ["Simmer 1 hour"], tags: ["meat"] })
      .select("id")
      .single();
    if (shared.error) throw shared.error;
    sharedId = shared.data.id;
    const hidden = await clients.mom.from("recipes").insert({ title: "Secret fudge", private: true }).select("id").single();
    if (hidden.error) throw hidden.error;
    privateId = hidden.data.id;
  });

  afterAll(async () => {
    for (const person of people) await admin.auth.admin.deleteUser(ids[person]);
  });

  it("the owner sees both of her recipes", async () => {
    const { data } = await clients.mom.from("recipes").select("title").order("title");
    expect(data?.map((r) => r.title)).toEqual(["Grandma's chili", "Secret fudge"]);
  });

  it("Burrow family sees the shared one but not the Just me one: no row, no count", async () => {
    const { data } = await clients.josh.from("recipes").select("id, title");
    expect(data?.map((r) => r.title)).toEqual(["Grandma's chili"]);
    const { count } = await clients.josh.from("recipes").select("id", { count: "exact", head: true });
    expect(count).toBe(1);
    const direct = await clients.josh.from("recipes").select("id").eq("id", privateId);
    expect(direct.data).toEqual([]);
  });

  it("a stranger sees nothing", async () => {
    const { data } = await clients.stranger.from("recipes").select("id");
    expect(data).toEqual([]);
    const { count } = await clients.stranger.from("recipes").select("id", { count: "exact", head: true });
    expect(count).toBe(0);
  });

  it("nobody else can change or delete a recipe", async () => {
    for (const person of ["josh", "stranger"] as const) {
      const updated = await clients[person].from("recipes").update({ title: "hacked" }).eq("id", sharedId).select("id");
      expect(updated.data ?? []).toEqual([]);
      const removed = await clients[person].from("recipes").delete().eq("id", sharedId).select("id");
      expect(removed.data ?? []).toEqual([]);
    }
    const { data } = await admin.from("recipes").select("title").eq("id", sharedId).single();
    expect(data?.title).toBe("Grandma's chili");
  });

  it("a recipe can't be written as someone else, or handed over", async () => {
    const forged = await clients.josh.from("recipes").insert({ owner_id: ids.mom, title: "x" });
    expect(forged.error).not.toBeNull();
    const handed = await clients.mom.from("recipes").update({ owner_id: ids.josh }).eq("id", sharedId);
    expect(handed.error).not.toBeNull();
  });

  it("family can save a copy of a shared recipe, never of a Just me one", async () => {
    const copy = await clients.josh
      .from("recipes")
      .insert({ title: "Grandma's chili", from_name: "Mom", from_recipe_id: sharedId })
      .select("id, owner_id")
      .single();
    expect(copy.error).toBeNull();
    expect(copy.data?.owner_id).toBe(ids.josh);
    const sneaky = await clients.josh.from("recipes").insert({ title: "fudge", from_recipe_id: privateId });
    expect(sneaky.error).not.toBeNull();
    const outsider = await clients.stranger.from("recipes").insert({ title: "chili", from_recipe_id: sharedId });
    expect(outsider.error).not.toBeNull();
  });

  it("saving a copy tells nobody anything", async () => {
    const { data } = await clients.mom.from("notifications").select("title, body");
    expect((data ?? []).filter((n) => /chili|recipe|saved/i.test(`${n.title} ${n.body}`))).toEqual([]);
  });

  it("a Potluck dish can point only at the bringer's own recipe", async () => {
    // A Potluck is part of a Gathering (GATH-004).
    const { data: gatheringId, error } = await clients.mom.rpc("plan_gathering", {
      gathering_title: "Supper",
      gathering_kind: "dinner",
      gathering_ends_at: new Date(Date.now() + 7 * 86400000).toISOString(),
      gathering_starts_at: null,
      gathering_place: "",
      gathering_notes: "",
      with_gifts: false,
      with_food: true,
      burrow_ids: [burrowId],
      guest_ids: [],
      honoree_ids: [],
      cohost_ids: [],
    });
    if (error) throw error;
    const { data: potluck } = await clients.mom.from("potlucks").select("id").eq("gathering_id", gatheringId).single();
    if (!potluck) throw new Error("No Potluck");
    const own = await clients.mom
      .from("potluck_dishes")
      .insert({ potluck_id: potluck.id, brought_by: ids.mom, name: "Chili", recipe_id: sharedId });
    expect(own.error).toBeNull();
    const borrowed = await clients.josh
      .from("potluck_dishes")
      .insert({ potluck_id: potluck.id, brought_by: ids.josh, name: "Chili", recipe_id: sharedId });
    expect(borrowed.error).not.toBeNull();
  });
});
