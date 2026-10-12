import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

// Menu Board (MENU-002, MENU-009) and Grocery List (GROC-002, GROC-009),
// enforced in Postgres: the menu is the Home's and nobody else's; a grocery
// list is just its owner's unless shared with their Home, and then the Home
// can add, tick and remove items but only the owner changes the list. Same
// setup as gift-nook-rls.test.ts (needs .env plus SUPABASE_SERVICE_ROLE_KEY
// in .env.test.local); skipped without them.

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL;
const ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const canRun = Boolean(SUPABASE_URL && ANON_KEY && SERVICE_ROLE_KEY);

describe.runIf(canRun)("Menu Board and grocery lists: the Home's, and nobody else's", () => {
  let admin: SupabaseClient;
  const runId = Date.now();
  // josh and sarah share a Home. cousin shares a Burrow but not the Home.
  const people = ["josh", "sarah", "cousin"] as const;
  type Person = (typeof people)[number];
  const ids = {} as Record<Person, string>;
  const clients = {} as Record<Person, SupabaseClient>;

  let homeId: string;
  let cousinHome: string;
  let dinner: string;
  let privateList: string;
  let sharedList: string;

  beforeAll(async () => {
    admin = createClient(SUPABASE_URL!, SERVICE_ROLE_KEY!, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    for (const person of people) {
      const email = `menu-${person}-${runId}@example.com`;
      const password = `menu-${person}-pw!`;
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

    const { data: burrow } = await clients.josh.rpc("create_burrow", { burrow_name: `Menu ${runId}` });
    const { data: code } = await clients.josh.rpc("create_knock", { target_burrow: burrow });
    for (const person of ["sarah", "cousin"] as const) await clients[person].rpc("answer_knock", { knock_code: code });

    // Sarah plans a meal in her own Home first, so joining shows it coming along.
    const { data: sarahHome } = await clients.sarah.rpc("my_home");
    await clients.sarah.from("menu_meals").insert({ home_id: sarahHome, day: "2026-11-02", meal: "dinner", title: "Sarah's soup" });

    const { data: home } = await clients.josh.rpc("my_home");
    homeId = home as string;
    const { data: invite } = await clients.josh.rpc("invite_to_home", { target: ids.sarah });
    await clients.sarah.rpc("accept_home_invite", { invite_id: invite });
    const { data: theirs } = await clients.cousin.rpc("my_home");
    cousinHome = theirs as string;

    const meal = await clients.josh.from("menu_meals").insert({ home_id: homeId, day: "2026-11-03", meal: "dinner", title: "Tacos" }).select("id").single();
    if (meal.error) throw meal.error;
    dinner = meal.data!.id;

    const mine = await clients.josh.from("grocery_lists").insert({ name: "Surprise party" }).select("id").single();
    if (mine.error) throw mine.error;
    privateList = mine.data!.id;
    const shared = await clients.josh.from("grocery_lists").insert({ name: "Groceries", shared: true }).select("id").single();
    if (shared.error) throw shared.error;
    sharedList = shared.data!.id;
    await clients.josh.from("grocery_items").insert([
      { list_id: privateList, name: "Balloons" },
      { list_id: sharedList, name: "Milk" },
    ]);
  });

  afterAll(async () => {
    for (const person of people) await admin.auth.admin.deleteUser(ids[person]);
  });

  const rows = async (person: Person, table: string, column: string, value: string) =>
    ((await clients[person].from(table).select("id").eq(column, value)).data ?? []).length;

  it("the Home shares one menu, and anyone in it can plan and change it", async () => {
    expect(await rows("sarah", "menu_meals", "id", dinner)).toBe(1);
    const edit = await clients.sarah.from("menu_meals").update({ title: "Fish tacos" }).eq("id", dinner).select("title");
    expect(edit.data?.[0]).toEqual({ title: "Fish tacos" });
    const add = await clients.sarah.from("menu_meals").insert({ home_id: homeId, day: "2026-11-04", meal: "dinner", kind: "out", title: "Pizza" });
    expect(add.error).toBeNull();
  });

  it("a Home that was only yours brings its menu along (MENU-009)", async () => {
    const { data } = await clients.josh.from("menu_meals").select("title").eq("home_id", homeId).eq("day", "2026-11-02");
    expect(data).toEqual([{ title: "Sarah's soup" }]);
  });

  it("nobody outside the Home sees or touches the menu", async () => {
    expect(await rows("cousin", "menu_meals", "home_id", homeId)).toBe(0);
    const edit = await clients.cousin.from("menu_meals").update({ title: "Hacked" }).eq("id", dinner).select("id");
    expect(edit.data ?? []).toHaveLength(0);
    const add = await clients.cousin.from("menu_meals").insert({ home_id: homeId, day: "2026-11-05", meal: "dinner", title: "Nope" });
    expect(add.error).not.toBeNull();
    // And a meal can't be moved into someone else's Home.
    expect((await clients.josh.from("menu_meals").update({ home_id: cousinHome }).eq("id", dinner)).error).not.toBeNull();
  });

  it("a grocery list is just yours until you share it, even from people you live with", async () => {
    expect(await rows("sarah", "grocery_lists", "id", privateList)).toBe(0);
    expect(await rows("sarah", "grocery_items", "list_id", privateList)).toBe(0);
    expect((await clients.sarah.from("grocery_items").insert({ list_id: privateList, name: "Peek" })).error).not.toBeNull();
  });

  it("the Home can add, tick and remove things on a shared list; outsiders can't see it", async () => {
    expect(await rows("sarah", "grocery_lists", "id", sharedList)).toBe(1);
    expect((await clients.sarah.from("grocery_items").insert({ list_id: sharedList, name: "Bread" })).error).toBeNull();
    const tick = await clients.sarah.from("grocery_items").update({ checked: true }).eq("list_id", sharedList).eq("name", "Milk").select("checked");
    expect(tick.data?.[0]).toEqual({ checked: true });
    const remove = await clients.sarah.from("grocery_items").delete().eq("list_id", sharedList).eq("name", "Bread").select("id");
    expect(remove.data ?? []).toHaveLength(1);

    expect(await rows("cousin", "grocery_lists", "id", sharedList)).toBe(0);
    expect(await rows("cousin", "grocery_items", "list_id", sharedList)).toBe(0);
  });

  it("only the owner renames, unshares or deletes a list, and it can't change hands", async () => {
    const rename = await clients.sarah.from("grocery_lists").update({ name: "Mine now" }).eq("id", sharedList).select("id");
    expect(rename.data ?? []).toHaveLength(0);
    const remove = await clients.sarah.from("grocery_lists").delete().eq("id", sharedList).select("id");
    expect(remove.data ?? []).toHaveLength(0);
    expect((await clients.josh.from("grocery_lists").update({ owner_id: ids.sarah }).eq("id", sharedList)).error).not.toBeNull();
    expect((await clients.josh.from("grocery_lists").insert({ name: "Hers", owner_id: ids.sarah })).error).not.toBeNull();
    // Items can't be moved onto a list you can't use.
    const { data: milk } = await clients.sarah.from("grocery_items").select("id").eq("list_id", sharedList).eq("name", "Milk").single();
    expect((await clients.sarah.from("grocery_items").update({ list_id: privateList }).eq("id", milk!.id)).error).not.toBeNull();
  });

  it("unsharing hides it again, and moving out of the Home stops seeing the menu and lists", async () => {
    await clients.josh.from("grocery_lists").update({ shared: false }).eq("id", sharedList);
    expect(await rows("sarah", "grocery_lists", "id", sharedList)).toBe(0);
    await clients.josh.from("grocery_lists").update({ shared: true }).eq("id", sharedList);
    expect(await rows("sarah", "grocery_lists", "id", sharedList)).toBe(1);

    await clients.sarah.rpc("leave_home");
    expect(await rows("sarah", "grocery_lists", "id", sharedList)).toBe(0);
    expect(await rows("sarah", "menu_meals", "home_id", homeId)).toBe(0);
  });
});
