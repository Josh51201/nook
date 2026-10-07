import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

// GIFT-007 across the round-3 features: suggestions (GIFT-022), removing
// tucked gifts (GIFT-025), kids' managed profiles + hand-off (GIFT-019/021),
// and notifications (GIFT-029). Same setup requirements as
// gift-nook-rls.test.ts; skipped without them.

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL;
const ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const canRun = Boolean(SUPABASE_URL && ANON_KEY && SERVICE_ROLE_KEY);

describe.runIf(canRun)("GIFT-007 holds for suggestions, removals, kids, notifications", () => {
  let admin: SupabaseClient;
  const runId = Date.now();
  const people = ["owner", "parent", "giver", "kid"] as const;
  type Person = (typeof people)[number];
  const ids = {} as Record<Person, string>;
  const clients = {} as Record<Person, SupabaseClient>;

  let burrowId: string;
  let ownerWishbook: string;
  let shelfId: string;

  async function addGift(who: Person, wishbook: string, title: string, suggestedBy?: string) {
    const { data, error } = await clients[who]
      .from("gifts")
      .insert({ wishbook_id: wishbook, shelf_id: shelfId, title, suggested_by: suggestedBy ?? null })
      .select("id")
      .single();
    if (error || !data) throw error;
    return data.id as string;
  }

  beforeAll(async () => {
    admin = createClient(SUPABASE_URL!, SERVICE_ROLE_KEY!, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    for (const person of people) {
      const email = `rls3-${person}-${runId}@example.com`;
      const password = `rls3-${person}-pw!`;
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

    // owner, parent and giver share a Burrow. "kid" signs up later to take
    // over a managed profile.
    const { data: burrow } = await clients.owner.rpc("create_burrow", { burrow_name: `RLS3 ${runId}` });
    burrowId = burrow;
    const { data: code } = await clients.owner.rpc("create_knock", { target_burrow: burrowId });
    await clients.parent.rpc("answer_knock", { knock_code: code });
    await clients.giver.rpc("answer_knock", { knock_code: code });

    const { data: wishbook } = await clients.owner
      .from("wishbooks")
      .select("id")
      .eq("owner_id", ids.owner)
      .single();
    ownerWishbook = wishbook!.id;
    const { data: shelf } = await clients.owner.from("shelves").select("id").eq("key", "other").single();
    shelfId = shelf!.id;
  });

  afterAll(async () => {
    for (const person of people) await admin.auth.admin.deleteUser(ids[person]);
  });

  it("a suggestion on the owner's list is invisible to the owner, rows and count", async () => {
    const before = await clients.owner
      .from("gifts")
      .select("*", { count: "exact", head: true })
      .eq("wishbook_id", ownerWishbook);
    const suggestion = await addGift("giver", ownerWishbook, "Surprise", ids.giver);

    const after = await clients.owner
      .from("gifts")
      .select("*", { count: "exact", head: true })
      .eq("wishbook_id", ownerWishbook);
    expect(after.count).toBe(before.count);

    const { data } = await clients.owner.from("gifts").select("id").eq("id", suggestion);
    expect(data).toEqual([]);

    const { data: familyView } = await clients.parent.from("gifts").select("id").eq("id", suggestion);
    expect(familyView).toHaveLength(1);
  });

  it("removing a tucked gift looks exactly like removing an untucked one to the owner", async () => {
    const tucked = await addGift("owner", ownerWishbook, "Tucked");
    const untucked = await addGift("owner", ownerWishbook, "Untucked");
    const { error: tuckError } = await clients.giver
      .from("claims")
      .insert({ gift_id: tucked, claimed_by: ids.giver });
    expect(tuckError).toBeNull();

    const removeTucked = await clients.owner.rpc("remove_gift", { target_gift: tucked });
    const removeUntucked = await clients.owner.rpc("remove_gift", { target_gift: untucked });
    expect(removeTucked.error).toBeNull();
    expect(removeUntucked.error).toBeNull();

    const { data: ownerView } = await clients.owner.from("gifts").select("id").in("id", [tucked, untucked]);
    expect(ownerView).toEqual([]);
    const { data: picks } = await clients.owner
      .from("gathering_gifts")
      .select("gift_id")
      .in("gift_id", [tucked, untucked]);
    expect(picks).toEqual([]);

    // The giver still sees it, flagged as removed, and got a heads-up.
    const { data: giverView } = await clients.giver.from("gifts").select("removed_at").eq("id", tucked).single();
    expect(giverView?.removed_at).not.toBeNull();
    const { data: notices } = await clients.giver
      .from("notifications")
      .select("title")
      .eq("kind", "tuck_changed");
    expect(notices?.some((n) => n.title.includes("removed"))).toBe(true);
  });

  it("the owner gets no notifications that mention tucks", async () => {
    const { data } = await clients.owner.from("notifications").select("kind");
    expect(data?.filter((n) => n.kind === "tuck_changed")).toEqual([]);
  });

  it("kids: managers see tucks; after hand-off the kid sees none", async () => {
    const { data: kidProfile, error } = await clients.parent.rpc("create_managed_profile", {
      profile_name: "Lily",
      burrow_ids: [burrowId],
    });
    expect(error).toBeNull();
    const { data: kidWishbook } = await clients.parent
      .from("wishbooks")
      .select("id")
      .eq("owner_id", kidProfile)
      .single();
    const bike = await addGift("parent", kidWishbook!.id, "Bike");
    await addGift("owner", kidWishbook!.id, "Lego", ids.owner); // a suggestion

    await clients.giver.from("claims").insert({ gift_id: bike, claimed_by: ids.giver });
    const { data: managerView } = await clients.parent.from("claims").select("id").eq("gift_id", bike);
    expect(managerView).toHaveLength(1);

    const { data: code } = await clients.parent.rpc("create_handoff", { target_profile: kidProfile });
    const { error: handoffError } = await clients.kid.rpc("answer_code", { any_code: code });
    expect(handoffError).toBeNull();

    const { data: kidGifts } = await clients.kid
      .from("gifts")
      .select("id, title, wishbooks!inner(owner_id)")
      .eq("wishbooks.owner_id", ids.kid);
    expect(kidGifts?.map((g) => g.title)).toEqual(["Bike"]); // no Lego suggestion

    const { data: kidClaims, count } = await clients.kid
      .from("claims")
      .select("id", { count: "exact" })
      .eq("gift_id", bike);
    expect(kidClaims).toEqual([]);
    expect(count).toBe(0);
  });
});
