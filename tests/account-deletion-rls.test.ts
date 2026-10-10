import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

// Deleting your account (AUTH-003, Q-020), enforced in Postgres. Same setup
// as gift-nook-rls.test.ts (needs .env plus SUPABASE_SERVICE_ROLE_KEY in
// .env.test.local); skipped without them.
//
// Also covers GIFT-007: when someone who had tucked a gift deletes their
// account, the gift's owner must still see no claims, no counts and no
// hints, before or after, while another family member sees the gift as
// available again.

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL;
const ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const canRun = Boolean(SUPABASE_URL && ANON_KEY && SERVICE_ROLE_KEY);

describe.runIf(canRun)("Delete account: clean, and nothing leaks", () => {
  let admin: SupabaseClient;
  const runId = Date.now();
  // sue starts the Burrow and deletes her account. tom owns the gift sue
  // tucked. amy is the third grown-up, so the Burrow carries on.
  const people = ["sue", "tom", "amy"] as const;
  type Person = (typeof people)[number];
  const ids = {} as Record<Person, string>;
  const clients = {} as Record<Person, SupabaseClient>;
  let sharedBurrow: string;
  let soloBurrow: string;
  let tomGift: string;
  let loneKid: string;
  let sharedKid: string;

  beforeAll(async () => {
    admin = createClient(SUPABASE_URL!, SERVICE_ROLE_KEY!, { auth: { autoRefreshToken: false, persistSession: false } });
    for (const person of people) {
      const email = `delete-${person}-${runId}@example.com`;
      const password = `delete-${person}-pw!`;
      const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
      if (error || !data.user) throw error;
      ids[person] = data.user.id;
      const client = createClient(SUPABASE_URL!, ANON_KEY!, { auth: { autoRefreshToken: false, persistSession: false } });
      const { error: signInError } = await client.auth.signInWithPassword({ email, password });
      if (signInError) throw signInError;
      clients[person] = client;
    }

    const { data: shared } = await clients.sue.rpc("create_burrow", { burrow_name: `Shared ${runId}` });
    sharedBurrow = shared;
    const { data: code } = await clients.sue.rpc("create_knock", { target_burrow: shared });
    for (const person of ["tom", "amy"] as const) await clients[person].rpc("answer_knock", { knock_code: code });

    const { data: solo } = await clients.sue.rpc("create_burrow", { burrow_name: `Solo ${runId}` });
    soloBurrow = solo;

    // Tom's gift, tucked by Sue.
    const { data: wishbook } = await clients.tom.from("wishbooks").select("id").eq("owner_id", ids.tom).single();
    const { data: shelf } = await clients.tom.from("shelves").select("id").eq("key", "other").single();
    const { data: gift, error: giftError } = await clients.tom
      .from("gifts")
      .insert({ wishbook_id: wishbook!.id, shelf_id: shelf!.id, title: "Delete test gift" })
      .select("id")
      .single();
    if (giftError || !gift) throw giftError;
    tomGift = gift.id;
    const { error: claimError } = await clients.sue.from("claims").insert({ gift_id: tomGift, claimed_by: ids.sue });
    if (claimError) throw claimError;

    // One kid only Sue looks after, one that Amy looks after too.
    const { data: lone } = await clients.sue.rpc("create_managed_profile", { profile_name: "Lone Kid", burrow_ids: [sharedBurrow] });
    loneKid = lone;
    const { data: both } = await clients.sue.rpc("create_managed_profile", { profile_name: "Shared Kid", burrow_ids: [sharedBurrow] });
    sharedKid = both;
    const { error: managerError } = await clients.sue.rpc("add_profile_manager", { target_profile: sharedKid, new_manager: ids.amy });
    if (managerError) throw managerError;
  });

  afterAll(async () => {
    for (const person of people) await admin.auth.admin.deleteUser(ids[person]);
    await admin.from("profiles").delete().in("id", [loneKid, sharedKid].filter(Boolean));
    await admin.from("burrows").delete().in("id", [sharedBurrow, soloBurrow].filter(Boolean));
  });

  async function ownerSeesNoClaims() {
    const direct = await clients.tom.from("claims").select("*").eq("gift_id", tomGift);
    expect(direct.error).toBeNull();
    expect(direct.data).toEqual([]);
    const embedded = await clients.tom.from("gifts").select("id, claims(id)").eq("id", tomGift);
    for (const gift of embedded.data ?? []) expect(gift.claims).toEqual([]);
  }

  it("an anonymous visitor can't delete anything or preview a deletion", async () => {
    const anonymous = createClient(SUPABASE_URL!, ANON_KEY!, { auth: { autoRefreshToken: false, persistSession: false } });
    expect((await anonymous.rpc("delete_my_account")).error).not.toBeNull();
    expect((await anonymous.rpc("my_account_deletion_preview")).error).not.toBeNull();
  });

  it("before deleting, Tom (the gift's owner) sees no claim on his gift", async () => {
    await ownerSeesNoClaims();
  });

  it("the preview says what Sue would lose: her solo Burrow, the kid only she looks after, and her tuck", async () => {
    const { data, error } = await clients.sue.rpc("my_account_deletion_preview");
    expect(error).toBeNull();
    expect(data.burrows).toEqual([`Solo ${runId}`]);
    expect(data.kids.map((kid: { id: string }) => kid.id)).toEqual([loneKid]);
    expect(data.tucks).toBe(1);
  });

  it("Sue deleting her account removes her, and only what should go", async () => {
    const { error } = await clients.sue.rpc("delete_my_account");
    expect(error).toBeNull();

    // She, her solo Burrow and the kid only she looked after are gone.
    const { data: sue } = await admin.from("profiles").select("id").eq("id", ids.sue);
    expect(sue).toEqual([]);
    const { data: solo } = await admin.from("burrows").select("id").eq("id", soloBurrow);
    expect(solo).toEqual([]);
    const { data: lone } = await admin.from("profiles").select("id").eq("id", loneKid);
    expect(lone).toEqual([]);

    // The shared Burrow carries on, with someone else running it.
    const { data: burrow } = await admin.from("burrows").select("id, created_by").eq("id", sharedBurrow).single();
    expect(burrow?.created_by).toBeNull();
    const { data: admins } = await admin
      .from("burrow_members")
      .select("profile_id")
      .eq("burrow_id", sharedBurrow)
      .eq("role", "admin");
    expect(admins?.length).toBeGreaterThan(0);
    expect(admins?.map((row) => row.profile_id)).not.toContain(ids.sue);

    // The kid Amy also looks after stays, with Amy still in charge.
    const { data: kept } = await admin.from("profile_managers").select("manager_id").eq("profile_id", sharedKid);
    expect(kept?.map((row) => row.manager_id)).toEqual([ids.amy]);
  });

  it("Sue's tuck is released, and Tom still sees nothing (GIFT-007)", async () => {
    const { data: claims } = await admin.from("claims").select("id").eq("gift_id", tomGift);
    expect(claims).toEqual([]);
    await ownerSeesNoClaims();
    const { data: seenByAmy } = await clients.amy.from("claims").select("id").eq("gift_id", tomGift);
    expect(seenByAmy).toEqual([]);
  });

  it("Tom got no notice about any of it", async () => {
    const { data } = await admin.from("notifications").select("kind, title, body").eq("profile_id", ids.tom);
    for (const notice of data ?? []) {
      expect(JSON.stringify(notice).toLowerCase()).not.toMatch(/tuck|claim/);
    }
  });
});
