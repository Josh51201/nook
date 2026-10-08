import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

// Letterbox Nook (HOME-001..005, LET-002..011) and mailing addresses (PROF-005), enforced
// in Postgres. Same setup as gift-nook-rls.test.ts (needs .env plus
// SUPABASE_SERVICE_ROLE_KEY in .env.test.local); skipped without them.

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL;
const ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const canRun = Boolean(SUPABASE_URL && ANON_KEY && SERVICE_ROLE_KEY);

describe.runIf(canRun)("Letterbox: one Home shares one list, addresses only where shared", () => {
  let admin: SupabaseClient;
  const runId = Date.now();
  // josh and sarah are a couple; cousin shares the family Burrow with them.
  // boss shares only a work Burrow with josh. outsider shares nothing.
  const people = ["josh", "sarah", "cousin", "boss", "outsider"] as const;
  type Person = (typeof people)[number];
  const ids = {} as Record<Person, string>;
  const clients = {} as Record<Person, SupabaseClient>;

  let familyBurrow: string;
  let workBurrow: string;
  let joshBox: string;
  let sarahBox: string;
  let sarahContact: string;
  let joshGift: string;

  beforeAll(async () => {
    admin = createClient(SUPABASE_URL!, SERVICE_ROLE_KEY!, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    for (const person of people) {
      const email = `letterbox-${person}-${runId}@example.com`;
      const password = `letterbox-${person}-pw!`;
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

    const { data: family } = await clients.josh.rpc("create_burrow", { burrow_name: `Family ${runId}` });
    familyBurrow = family;
    const { data: code } = await clients.josh.rpc("create_knock", { target_burrow: familyBurrow });
    await clients.sarah.rpc("answer_knock", { knock_code: code });
    await clients.cousin.rpc("answer_knock", { knock_code: code });

    const { data: work } = await clients.boss.rpc("create_burrow", { burrow_name: `Work ${runId}` });
    workBurrow = work;
    const { data: workCode } = await clients.boss.rpc("create_knock", { target_burrow: workBurrow });
    await clients.josh.rpc("answer_knock", { knock_code: workCode });

    // Josh shares his address, but not with the work Burrow.
    await clients.josh.from("profile_addresses").insert({ profile_id: ids.josh, line1: "1 Elm St", city: "Springfield" });
    await clients.josh.from("address_hidden_burrows").insert({ profile_id: ids.josh, burrow_id: workBurrow });

    const { data: box1 } = await clients.josh.rpc("my_home");
    joshBox = box1;
    const { data: box2 } = await clients.sarah.rpc("my_home");
    sarahBox = box2;

    const { data: contact } = await clients.sarah
      .from("letterbox_contacts")
      .insert({ home_id: sarahBox, name: "The Johnsons", line1: "9 Oak Ave", city: "Shelbyville" })
      .select("id")
      .single();
    sarahContact = contact!.id;
    await clients.sarah.from("letterbox_cards").insert({
      home_id: sarahBox,
      contact_id: sarahContact,
      direction: "sent",
      occasion: "holiday",
      season: 2025,
    });

    // One of Josh's gifts, received (GIFT-026).
    const { data: wishbook } = await clients.josh.from("wishbooks").select("id").eq("owner_id", ids.josh).single();
    const { data: shelf } = await clients.josh.from("shelves").select("id").eq("key", "other").single();
    const { data: gift } = await admin
      .from("gifts")
      .insert({ wishbook_id: wishbook!.id, shelf_id: shelf!.id, title: "Scarf", received_at: new Date().toISOString() })
      .select("id")
      .single();
    joshGift = gift!.id;
  });

  afterAll(async () => {
    for (const person of people) await admin.auth.admin.deleteUser(ids[person]);
  });

  it("family sees your address; a Burrow you left out doesn't; strangers don't", async () => {
    const seen = async (person: Person) =>
      (await clients[person].from("profile_addresses").select("line1").eq("profile_id", ids.josh)).data ?? [];
    expect(await seen("josh")).toHaveLength(1);
    expect(await seen("cousin")).toHaveLength(1);
    expect(await seen("boss")).toHaveLength(0);
    expect(await seen("outsider")).toHaveLength(0);
  });

  it("which Burrows you left out stays private to you", async () => {
    const { data } = await clients.cousin.from("address_hidden_burrows").select("burrow_id").eq("profile_id", ids.josh);
    expect(data).toEqual([]);
    const { data: own } = await clients.josh.from("address_hidden_burrows").select("burrow_id");
    expect(own?.map((r) => r.burrow_id)).toEqual([workBurrow]);
  });

  it("nobody can write someone else's address", async () => {
    const { error } = await clients.cousin
      .from("profile_addresses")
      .insert({ profile_id: ids.sarah, line1: "Nope", city: "Nowhere" });
    expect(error).not.toBeNull();
  });

  it("nobody outside a Home sees its Letterbox", async () => {
    for (const person of ["josh", "cousin", "outsider"] as const) {
      const { data } = await clients[person].from("letterbox_contacts").select("id").eq("home_id", sarahBox);
      expect(data).toEqual([]);
      const { data: cards } = await clients[person].from("letterbox_cards").select("id").eq("home_id", sarahBox);
      expect(cards).toEqual([]);
    }
    const { error } = await clients.cousin
      .from("letterbox_contacts")
      .insert({ home_id: sarahBox, name: "Sneaky" });
    expect(error).not.toBeNull();
  });

  it("a contact can't use an address it isn't allowed to see", async () => {
    const { data: bossBox } = await clients.boss.rpc("my_home");
    const { error } = await clients.boss
      .from("letterbox_contacts")
      .insert({ home_id: bossBox, name: "Josh", address_from: ids.josh });
    expect(error).not.toBeNull();
  });

  it("you can only invite family from your Burrows", async () => {
    const { error } = await clients.josh.rpc("invite_to_home", { target: ids.outsider });
    expect(error).not.toBeNull();
  });

  it("you can't thank for a gift that isn't yours", async () => {
    const { error } = await clients.sarah
      .from("letterbox_thanks")
      .insert({ home_id: sarahBox, from_name: "Grandma", what: "Scarf", gift_id: joshGift });
    expect(error).not.toBeNull();
    const { error: ownError } = await clients.josh
      .from("letterbox_thanks")
      .insert({ home_id: joshBox, from_name: "Grandma", what: "Scarf", gift_id: joshGift });
    expect(ownError).toBeNull();
  });

  it("accepting a Home invite brings your list along into one shared Home", async () => {
    const { data: invite, error } = await clients.josh.rpc("invite_to_home", { target: ids.sarah });
    expect(error).toBeNull();

    // Only the invitee can accept it.
    const { error: wrongPerson } = await clients.cousin.rpc("accept_home_invite", { invite_id: invite });
    expect(wrongPerson).not.toBeNull();

    const { data: joined, error: acceptError } = await clients.sarah.rpc("accept_home_invite", { invite_id: invite });
    expect(acceptError).toBeNull();
    expect(joined).toBe(joshBox);

    const { data: joshSees } = await clients.josh.from("letterbox_contacts").select("id").eq("home_id", joshBox);
    expect(joshSees?.map((h) => h.id)).toContain(sarahContact);
    const { data: cards } = await clients.josh.from("letterbox_cards").select("id").eq("home_id", joshBox);
    expect(cards).toHaveLength(1);

    // Sarah's old, now-empty Letterbox is gone.
    const { data: old } = await admin.from("homes").select("id").eq("id", sarahBox);
    expect(old).toEqual([]);

    // Josh got a heads-up in the inbox.
    const { data: notices } = await clients.josh.from("notifications").select("kind").eq("nook", "home");
    expect(notices?.map((n) => n.kind)).toContain("home_joined");
  });

  it("leaving takes a copy of the addresses, not the cards", async () => {
    const { data: newBox, error } = await clients.sarah.rpc("leave_home");
    expect(error).toBeNull();
    expect(newBox).not.toBe(joshBox);
    const { data: copied } = await clients.sarah.from("letterbox_contacts").select("name").eq("home_id", newBox);
    expect(copied?.map((h) => h.name)).toContain("The Johnsons");
    const { data: cards } = await clients.sarah.from("letterbox_cards").select("id").eq("home_id", newBox);
    expect(cards).toEqual([]);
    // And she no longer sees the shared one.
    const { data: shared } = await clients.sarah.from("letterbox_contacts").select("id").eq("home_id", joshBox);
    expect(shared).toEqual([]);
  });
});
