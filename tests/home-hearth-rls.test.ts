import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

// The Home page (CORE-054), enforced in Postgres. Same setup as
// gift-nook-rls.test.ts (needs .env plus SUPABASE_SERVICE_ROLE_KEY in
// .env.test.local); skipped without them.

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL;
const ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const canRun = Boolean(SUPABASE_URL && ANON_KEY && SERVICE_ROLE_KEY);
const PNG = Uint8Array.from([137, 80, 78, 71, 13, 10, 26, 10]);

describe.runIf(canRun)("Home page: the Home shares it, nobody else sees it", () => {
  let admin: SupabaseClient;
  const runId = Date.now();
  // josh and sarah share a Home. cousin shares a Burrow but not the Home.
  const people = ["josh", "sarah", "cousin"] as const;
  type Person = (typeof people)[number];
  const ids = {} as Record<Person, string>;
  const clients = {} as Record<Person, SupabaseClient>;
  let homeId: string;
  const item = (id: string, text: string) => ({ id, kind: "widget", x: 0, y: 0, w: 2, h: 2, widget: { kind: "note", title: "", showTitle: false, look: "soft", settings: { text, textSize: "medium", align: "left" } } });

  beforeAll(async () => {
    admin = createClient(SUPABASE_URL!, SERVICE_ROLE_KEY!, { auth: { autoRefreshToken: false, persistSession: false } });
    for (const person of people) {
      const email = `homepage-${person}-${runId}@example.com`;
      const password = `homepage-${person}-pw!`;
      const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
      if (error || !data.user) throw error;
      ids[person] = data.user.id;
      const client = createClient(SUPABASE_URL!, ANON_KEY!, { auth: { autoRefreshToken: false, persistSession: false } });
      const { error: signInError } = await client.auth.signInWithPassword({ email, password });
      if (signInError) throw signInError;
      clients[person] = client;
    }
    const { data: burrow } = await clients.josh.rpc("create_burrow", { burrow_name: `Home page ${runId}` });
    const { data: code } = await clients.josh.rpc("create_knock", { target_burrow: burrow });
    for (const person of ["sarah", "cousin"] as const) await clients[person].rpc("answer_knock", { knock_code: code });
    const { data: invite } = await clients.josh.rpc("invite_to_home", { target: ids.sarah });
    await clients.sarah.rpc("accept_home_invite", { invite_id: invite });
    await clients.cousin.rpc("my_home");
    const { data } = await clients.josh.rpc("my_home");
    homeId = data;

    const { error } = await clients.josh
      .from("home_hearth_items")
      .insert({ home_id: homeId, id: "w-groceries", item: item("w-groceries", "Milk, eggs"), updated_by: ids.josh });
    if (error) throw error;
  });

  afterAll(async () => {
    if (homeId) await admin.storage.from("hearth").remove([`home/${homeId}/a.png`]);
    for (const person of people) await admin.auth.admin.deleteUser(ids[person]);
  });

  it("everyone in the Home sees what's on it", async () => {
    const { data } = await clients.sarah.from("home_hearth_items").select("id, item").eq("home_id", homeId);
    expect(data?.map((r) => r.id)).toEqual(["w-groceries"]);
  });

  it("someone outside the Home sees nothing, even sharing a Burrow", async () => {
    const { data } = await clients.cousin.from("home_hearth_items").select("id").eq("home_id", homeId);
    expect(data).toEqual([]);
  });

  it("anyone in the Home can change things, as themselves only", async () => {
    const { error } = await clients.sarah
      .from("home_hearth_items")
      .update({ item: item("w-groceries", "Milk, eggs, bread"), updated_by: ids.sarah })
      .eq("home_id", homeId)
      .eq("id", "w-groceries");
    expect(error).toBeNull();
    const spoof = await clients.sarah
      .from("home_hearth_items")
      .update({ updated_by: ids.josh })
      .eq("home_id", homeId)
      .eq("id", "w-groceries");
    expect(spoof.error).not.toBeNull();
  });

  it("outsiders can't add to it or change it", async () => {
    const added = await clients.cousin
      .from("home_hearth_items")
      .insert({ home_id: homeId, id: "w-sneaky", item: item("w-sneaky", "hi"), updated_by: ids.cousin });
    expect(added.error).not.toBeNull();
    const { data } = await clients.cousin
      .from("home_hearth_items")
      .update({ removed: true, updated_by: ids.cousin })
      .eq("home_id", homeId)
      .select("id");
    expect(data ?? []).toEqual([]);
  });

  it("things are marked removed, never deleted", async () => {
    await clients.josh.from("home_hearth_items").delete().eq("home_id", homeId);
    const { data } = await admin.from("home_hearth_items").select("id").eq("home_id", homeId);
    expect(data?.length).toBe(1);
  });

  it("photos on the Home page are for the Home only; your own stay yours", async () => {
    const upload = await clients.josh.storage.from("hearth").upload(`home/${homeId}/a.png`, PNG, { contentType: "image/png" });
    expect(upload.error).toBeNull();
    expect((await clients.sarah.storage.from("hearth").download(`home/${homeId}/a.png`)).error).toBeNull();
    expect((await clients.cousin.storage.from("hearth").download(`home/${homeId}/a.png`)).error).not.toBeNull();
    const sneaky = await clients.cousin.storage.from("hearth").upload(`home/${homeId}/b.png`, PNG, { contentType: "image/png" });
    expect(sneaky.error).not.toBeNull();

    await clients.josh.storage.from("hearth").upload(`${ids.josh}/mine.png`, PNG, { contentType: "image/png" });
    expect((await clients.sarah.storage.from("hearth").download(`${ids.josh}/mine.png`)).error).not.toBeNull();
    await clients.josh.storage.from("hearth").remove([`${ids.josh}/mine.png`]);
  });
});
