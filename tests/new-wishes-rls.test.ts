import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { loadNewWishes } from "../lib/new-wishes";

// Proves the New in Wishbooks widget (CORE-107) keeps GIFT-007: the list
// owner's widget never shows their own gifts, claimed or not, and what a
// family member's widget gets back has nothing about claims in it, while
// someone outside every shared Burrow sees nothing at all.
//
// Needs a real Supabase project, like tests/gift-nook-rls.test.ts:
// EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY from .env, plus
// SUPABASE_SERVICE_ROLE_KEY from .env.test.local. Without them this skips.

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL;
const ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const canRun = Boolean(SUPABASE_URL && ANON_KEY && SERVICE_ROLE_KEY);

describe.runIf(canRun)("GIFT-007: New in Wishbooks never leaks claims", () => {
  let admin: SupabaseClient;
  const runId = Date.now();
  const users = {
    owner: { email: `wishes-owner-${runId}@example.com`, password: "rls-test-pw-1!" },
    family: { email: `wishes-family-${runId}@example.com`, password: "rls-test-pw-2!" },
    outsider: { email: `wishes-outsider-${runId}@example.com`, password: "rls-test-pw-3!" },
  };
  let ownerId: string;
  let familyId: string;
  let outsiderId: string;
  let ownerClient: SupabaseClient;
  let familyClient: SupabaseClient;
  let outsiderClient: SupabaseClient;
  let claimedId: string;
  let openId: string;

  async function createUser(email: string, password: string) {
    const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
    if (error || !data.user) throw error ?? new Error(`Failed to create ${email}`);
    return data.user.id;
  }
  async function signIn(email: string, password: string) {
    const client = createClient(SUPABASE_URL!, ANON_KEY!, { auth: { autoRefreshToken: false, persistSession: false } });
    const { error } = await client.auth.signInWithPassword({ email, password });
    if (error) throw error;
    return client;
  }

  beforeAll(async () => {
    admin = createClient(SUPABASE_URL!, SERVICE_ROLE_KEY!, { auth: { autoRefreshToken: false, persistSession: false } });
    ownerId = await createUser(users.owner.email, users.owner.password);
    familyId = await createUser(users.family.email, users.family.password);
    outsiderId = await createUser(users.outsider.email, users.outsider.password);
    ownerClient = await signIn(users.owner.email, users.owner.password);
    familyClient = await signIn(users.family.email, users.family.password);
    outsiderClient = await signIn(users.outsider.email, users.outsider.password);

    const { data: burrowId, error: burrowError } = await ownerClient.rpc("create_burrow", { burrow_name: `Wishes test ${runId}` });
    if (burrowError || !burrowId) throw burrowError;
    const { data: code, error: knockError } = await ownerClient.rpc("create_knock", { target_burrow: burrowId });
    if (knockError || !code) throw knockError;
    const { error: joinError } = await familyClient.rpc("answer_knock", { knock_code: code });
    if (joinError) throw joinError;

    const { data: wishbook } = await ownerClient.from("wishbooks").select("id").eq("owner_id", ownerId).single();
    const { data: shelf } = await ownerClient.from("shelves").select("id").eq("key", "other").single();
    const add = async (title: string) => {
      const { data, error } = await ownerClient
        .from("gifts")
        .insert({ wishbook_id: wishbook!.id, shelf_id: shelf!.id, title })
        .select("id")
        .single();
      if (error || !data) throw error;
      return data.id as string;
    };
    claimedId = await add("Wishes test claimed gift");
    openId = await add("Wishes test open gift");
    const { error: claimError } = await familyClient.from("claims").insert({ gift_id: claimedId, claimed_by: familyId });
    if (claimError) throw claimError;
  });

  afterAll(async () => {
    await admin.auth.admin.deleteUser(ownerId);
    await admin.auth.admin.deleteUser(familyId);
    await admin.auth.admin.deleteUser(outsiderId);
  });

  it("the owner's widget never shows their own gifts", async () => {
    const wishes = await loadNewWishes(ownerClient, ownerId, 14);
    expect(wishes.map((w) => w.id)).not.toContain(claimedId);
    expect(wishes.map((w) => w.id)).not.toContain(openId);
  });

  it("a family member sees both new gifts the same way, with nothing about the claim", async () => {
    const wishes = (await loadNewWishes(familyClient, familyId, 14)).filter((w) => w.ownerId === ownerId);
    expect(wishes.map((w) => w.id).sort()).toEqual([claimedId, openId].sort());
    // Claimed and unclaimed look exactly alike: same fields, nothing derived.
    for (const wish of wishes) {
      expect(Object.keys(wish).sort()).toEqual(["created_at", "id", "image_url", "ownerId", "ownerName", "title"]);
      expect(JSON.stringify(wish)).not.toMatch(/claim|tuck/i);
    }
  });

  it("someone outside the Burrow sees none of them", async () => {
    const wishes = await loadNewWishes(outsiderClient, outsiderId, 14);
    expect(wishes.filter((w) => w.ownerId === ownerId)).toEqual([]);
  });
});
