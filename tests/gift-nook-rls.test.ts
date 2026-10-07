import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

// Proves GIFT-007: a Gift Nook list owner can never see claims on their own
// gifts — not as rows, not as a count — while another member of a shared
// Burrow can, and someone outside every shared Burrow can't either.
//
// Needs a real Supabase project (RLS can't be meaningfully tested without
// real Postgres roles + auth.uid()): EXPO_PUBLIC_SUPABASE_URL and
// EXPO_PUBLIC_SUPABASE_ANON_KEY from .env, plus SUPABASE_SERVICE_ROLE_KEY
// from .env.test.local (see .env.test.example). Missing any of them skips
// this whole suite instead of failing the run.

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL;
const ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const canRun = Boolean(SUPABASE_URL && ANON_KEY && SERVICE_ROLE_KEY);

describe.runIf(canRun)("GIFT-007: owner never sees claims on their own gifts", () => {
  let admin: SupabaseClient;

  const runId = Date.now();
  const testUsers = {
    owner: { email: `rls-owner-${runId}@example.com`, password: "rls-test-pw-1!" },
    familyMember: { email: `rls-family-${runId}@example.com`, password: "rls-test-pw-2!" },
    outsider: { email: `rls-outsider-${runId}@example.com`, password: "rls-test-pw-3!" },
  };

  let ownerId: string;
  let familyMemberId: string;
  let outsiderId: string;
  let ownerClient: SupabaseClient;
  let familyClient: SupabaseClient;
  let outsiderClient: SupabaseClient;
  let giftId: string;
  let unclaimedGiftId: string;
  let claimId: string;
  let burrowId: string;

  async function createConfirmedUser(email: string, password: string) {
    const { data, error } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });
    if (error || !data.user) throw error ?? new Error(`Failed to create user ${email}`);
    return data.user.id;
  }

  async function signIn(email: string, password: string) {
    const client = createClient(SUPABASE_URL!, ANON_KEY!, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const { error } = await client.auth.signInWithPassword({ email, password });
    if (error) throw error;
    return client;
  }

  beforeAll(async () => {
    admin = createClient(SUPABASE_URL!, SERVICE_ROLE_KEY!, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    ownerId = await createConfirmedUser(testUsers.owner.email, testUsers.owner.password);
    familyMemberId = await createConfirmedUser(
      testUsers.familyMember.email,
      testUsers.familyMember.password
    );
    outsiderId = await createConfirmedUser(testUsers.outsider.email, testUsers.outsider.password);

    ownerClient = await signIn(testUsers.owner.email, testUsers.owner.password);
    familyClient = await signIn(testUsers.familyMember.email, testUsers.familyMember.password);
    outsiderClient = await signIn(testUsers.outsider.email, testUsers.outsider.password);

    // Owner starts a Burrow (becoming its admin) and sends a Knock; the
    // family member answers it. The outsider never joins any shared Burrow.
    const { data: newBurrowId, error: burrowError } = await ownerClient.rpc("create_burrow", {
      burrow_name: `RLS test burrow ${runId}`,
    });
    if (burrowError || !newBurrowId) throw burrowError;
    burrowId = newBurrowId;

    const { data: knockCode, error: knockError } = await ownerClient.rpc("create_knock", {
      target_burrow: burrowId,
    });
    if (knockError || !knockCode) throw knockError;

    const { error: familyJoinError } = await familyClient.rpc("answer_knock", {
      knock_code: knockCode,
    });
    if (familyJoinError) throw familyJoinError;

    // Owner adds a gift to their own (auto-created) Wishbook.
    const { data: wishbook, error: wishbookError } = await ownerClient
      .from("wishbooks")
      .select("id")
      .eq("owner_id", ownerId)
      .single();
    if (wishbookError || !wishbook) throw wishbookError;

    const { data: shelf, error: shelfError } = await ownerClient
      .from("shelves")
      .select("id")
      .eq("key", "other")
      .single();
    if (shelfError || !shelf) throw shelfError;

    const { data: gift, error: giftError } = await ownerClient
      .from("gifts")
      .insert({ wishbook_id: wishbook.id, shelf_id: shelf.id, title: "RLS test gift" })
      .select("id")
      .single();
    if (giftError || !gift) throw giftError;
    giftId = gift.id;

    // A second, never-claimed gift, to compare the owner's errors against.
    const { data: unclaimedGift, error: unclaimedError } = await ownerClient
      .from("gifts")
      .insert({ wishbook_id: wishbook.id, shelf_id: shelf.id, title: "RLS untouched gift" })
      .select("id")
      .single();
    if (unclaimedError || !unclaimedGift) throw unclaimedError;
    unclaimedGiftId = unclaimedGift.id;

    // Family member claims it.
    const { data: claim, error: claimError } = await familyClient
      .from("claims")
      .insert({ gift_id: giftId, claimed_by: familyMemberId })
      .select("id")
      .single();
    if (claimError || !claim) throw claimError;
    claimId = claim.id;
  });

  afterAll(async () => {
    await admin.auth.admin.deleteUser(ownerId);
    await admin.auth.admin.deleteUser(familyMemberId);
    await admin.auth.admin.deleteUser(outsiderId);
  });

  it("the owner sees zero claim rows on their own gift", async () => {
    const { data, error } = await ownerClient.from("claims").select("*").eq("gift_id", giftId);
    expect(error).toBeNull();
    expect(data).toEqual([]);
  });

  it("the owner's claim count on their own gift is zero (no count-based hint)", async () => {
    const { count, error } = await ownerClient
      .from("claims")
      .select("*", { count: "exact", head: true })
      .eq("gift_id", giftId);
    expect(error).toBeNull();
    expect(count).toBe(0);
  });

  it("the owner cannot claim their own gift either", async () => {
    const { error } = await ownerClient
      .from("claims")
      .insert({ gift_id: giftId, claimed_by: ownerId });
    expect(error).not.toBeNull();
  });

  it("the owner's error claiming a claimed gift is identical to an unclaimed one (no oracle)", async () => {
    const onClaimed = await ownerClient
      .from("claims")
      .insert({ gift_id: giftId, claimed_by: ownerId });
    const onUnclaimed = await ownerClient
      .from("claims")
      .insert({ gift_id: unclaimedGiftId, claimed_by: ownerId });
    expect(onClaimed.error).not.toBeNull();
    expect(onClaimed.error?.code).toBe(onUnclaimed.error?.code);
    expect(onClaimed.error?.message).toBe(onUnclaimed.error?.message);
  });

  it("the owner sees no claims when embedding them through their own gifts", async () => {
    const { data, error } = await ownerClient
      .from("gifts")
      .select("id, claims(id)")
      .in("id", [giftId, unclaimedGiftId]);
    expect(error).toBeNull();
    expect(data).toHaveLength(2);
    for (const gift of data ?? []) expect(gift.claims).toEqual([]);
  });

  it("the owner's view of their gift is identical before and after the claim (no updated_at hint)", async () => {
    const { data } = await ownerClient
      .from("gifts")
      .select("created_at, updated_at")
      .eq("id", giftId)
      .single();
    expect(data?.updated_at).toBe(data?.created_at);
  });

  it("a family member (shares a Burrow with the owner) sees the claim", async () => {
    const { data, error } = await familyClient.from("claims").select("*").eq("gift_id", giftId);
    expect(error).toBeNull();
    expect(data).toHaveLength(1);
    expect(data?.[0]?.claimed_by).toBe(familyMemberId);
  });

  it("a claimant can't repoint their claim at another gift", async () => {
    const { data } = await familyClient
      .from("claims")
      .update({ gift_id: unclaimedGiftId })
      .eq("id", claimId)
      .select("id");
    expect(data ?? []).toEqual([]);
  });

  it("an outsider can't join the Burrow without a Knock", async () => {
    const { error } = await outsiderClient
      .from("burrow_members")
      .insert({ burrow_id: burrowId, profile_id: outsiderId });
    expect(error).not.toBeNull();
  });

  it("an outsider can't claim the gift (same error as the owner gets)", async () => {
    const { error } = await outsiderClient
      .from("claims")
      .insert({ gift_id: giftId, claimed_by: outsiderId });
    expect(error?.code).toBe("42501");
  });

  it("an outsider who shares no Burrow with the owner sees nothing", async () => {
    const { data, error } = await outsiderClient
      .from("claims")
      .select("*")
      .eq("gift_id", giftId);
    expect(error).toBeNull();
    expect(data).toEqual([]);
  });
});

if (!canRun) {
  // eslint-disable-next-line no-console
  console.warn(
    "Skipping GIFT-007 RLS tests: set EXPO_PUBLIC_SUPABASE_URL / EXPO_PUBLIC_SUPABASE_ANON_KEY " +
      "in .env and SUPABASE_SERVICE_ROLE_KEY in .env.test.local to run them."
  );
}
