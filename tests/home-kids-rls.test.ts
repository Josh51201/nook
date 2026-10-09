import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

// Kids in a Home (HOME-006..011), enforced in Postgres. Same setup as
// gift-nook-rls.test.ts (needs .env plus SUPABASE_SERVICE_ROLE_KEY in
// .env.test.local); skipped without them.

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL;
const ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const canRun = Boolean(SUPABASE_URL && ANON_KEY && SERVICE_ROLE_KEY);
const today = () => new Date().toISOString().slice(0, 10);

describe.runIf(canRun)("Kids live in one Home, count toward its 6, and keep their place when they get a phone", () => {
  let admin: SupabaseClient;
  const runId = Date.now();
  // josh and sarah share a Home. grandma shares their Burrow but lives
  // elsewhere. teen is the account Mia signs up with when she gets a phone.
  const people = ["josh", "sarah", "grandma", "teen"] as const;
  type Person = (typeof people)[number];
  const ids = {} as Record<Person, string>;
  const clients = {} as Record<Person, SupabaseClient>;
  const kids: string[] = [];

  let burrow: string;
  let homeId: string;
  let miaId: string;

  beforeAll(async () => {
    admin = createClient(SUPABASE_URL!, SERVICE_ROLE_KEY!, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    for (const person of people) {
      const email = `kids-${person}-${runId}@example.com`;
      const password = `kids-${person}-pw!`;
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

    const { data: b } = await clients.josh.rpc("create_burrow", { burrow_name: `Kids ${runId}` });
    burrow = b;
    const { data: code } = await clients.josh.rpc("create_knock", { target_burrow: burrow });
    for (const person of ["sarah", "grandma"] as const) await clients[person].rpc("answer_knock", { knock_code: code });
    const { data: invite } = await clients.josh.rpc("invite_to_home", { target: ids.sarah });
    await clients.sarah.rpc("accept_home_invite", { invite_id: invite });
    const { data: home } = await clients.josh.rpc("my_home");
    homeId = home;
  });

  afterAll(async () => {
    for (const kid of kids) await admin.from("profiles").delete().eq("id", kid);
    for (const person of people) await admin.auth.admin.deleteUser(ids[person]);
  });

  const addKid = async (who: Person, name: string, livesHere = true) => {
    const { data, error } = await clients[who].rpc("create_home_kid", { profile_name: name, burrow_ids: [burrow], lives_here: livesHere });
    if (!error) kids.push(data);
    return { id: data as string, error };
  };
  const kidHome = async (kid: string) => (await admin.from("home_kids").select("home_id").eq("kid_id", kid).maybeSingle()).data?.home_id ?? null;
  const headcount = async (home: string) =>
    ((await admin.from("home_members").select("profile_id", { count: "exact", head: true }).eq("home_id", home)).count ?? 0) +
    ((await admin.from("home_kids").select("kid_id", { count: "exact", head: true }).eq("home_id", home)).count ?? 0);

  it("adding a kid puts them in your Home, seen by the Home and nobody else (HOME-007, HOME-008)", async () => {
    const mia = await addKid("josh", "Mia Collins");
    expect(mia.error).toBeNull();
    miaId = mia.id;
    expect(await kidHome(miaId)).toBe(homeId);

    const { data: sarahSees } = await clients.sarah.from("home_kids").select("kid_id").eq("home_id", homeId);
    expect((sarahSees ?? []).map((k) => k.kid_id)).toContain(miaId);
    const { data: picker } = await clients.sarah.rpc("home_kids");
    expect(((picker ?? []) as { id: string }[]).map((k) => k.id)).toContain(miaId);
    const { data: grandmaSees } = await clients.grandma.from("home_kids").select("kid_id");
    expect(grandmaSees).toEqual([]);

    // Only through the functions: nobody writes the table directly.
    const direct = await clients.josh.from("home_kids").insert({ kid_id: miaId, home_id: homeId });
    expect(direct.error).not.toBeNull();
    // And grown-ups can't be put in as kids.
    const grownUp = await clients.josh.rpc("set_kid_home", { target_kid: ids.sarah, lives_here: true });
    expect(grownUp.error).not.toBeNull();
  });

  it("a kid lives in one Home at a time (HOME-007)", async () => {
    await clients.josh.rpc("add_profile_manager", { target_profile: miaId, new_manager: ids.grandma });
    const second = await clients.grandma.rpc("set_kid_home", { target_kid: miaId, lives_here: true });
    expect(second.error).not.toBeNull();
    expect(await kidHome(miaId)).toBe(homeId);
    // Someone who doesn't look after her can't add her anywhere.
    await clients.josh.rpc("remove_profile_manager", { target_profile: miaId, old_manager: ids.grandma });
    const notTheirs = await clients.grandma.rpc("set_kid_home", { target_kid: miaId, lives_here: false });
    expect(notTheirs.error).not.toBeNull();
  });

  it("kids made before can be marked \"Lives here\", or stay out (HOME-009)", async () => {
    const great = await addKid("josh", "Great-grandpa", false);
    expect(await kidHome(great.id)).toBeNull();
    const { data: mine } = await clients.josh.rpc("my_kids");
    const row = ((mine ?? []) as { id: string; home_id: string | null }[]).find((k) => k.id === great.id);
    expect(row?.home_id).toBeNull();
    const { error } = await clients.josh.rpc("set_kid_home", { target_kid: great.id, lives_here: true });
    expect(error).toBeNull();
    expect(await kidHome(great.id)).toBe(homeId);
  });

  it("kids count toward the 6, and a full Home turns away kids and invites (HOME-006)", async () => {
    expect(await headcount(homeId)).toBe(4); // josh, sarah, Mia, Great-grandpa
    const five = await addKid("josh", "Five");
    const six = await addKid("josh", "Six");
    expect(five.error).toBeNull();
    expect(six.error).toBeNull();
    expect(await headcount(homeId)).toBe(6);

    const seven = await clients.josh.rpc("create_home_kid", { profile_name: `Seven ${runId}`, burrow_ids: [burrow] });
    expect(seven.error).not.toBeNull();
    // All or nothing: no half-made kid left behind.
    const { data: leftover } = await admin.from("profiles").select("id").eq("display_name", `Seven ${runId}`);
    expect(leftover).toEqual([]);
    const invite = await clients.josh.rpc("invite_to_home", { target: ids.grandma });
    expect(invite.error).not.toBeNull();

    await clients.josh.rpc("delete_managed_profile", { target_profile: five.id });
    await clients.josh.rpc("delete_managed_profile", { target_profile: six.id });
    expect(await headcount(homeId)).toBe(4);
  });

  it("moving out takes the kids only you look after; kids with a grown-up staying stay (HOME-011)", async () => {
    const sam = await addKid("sarah", "Sam");
    expect(await kidHome(sam.id)).toBe(homeId);

    const { data: sarahsNew } = await clients.sarah.rpc("leave_home");
    expect(await kidHome(sam.id)).toBe(sarahsNew);
    expect(await kidHome(miaId)).toBe(homeId);

    // Back together: a Home that was only hers brings Sam along.
    const { data: invite } = await clients.josh.rpc("invite_to_home", { target: ids.sarah });
    const { error } = await clients.sarah.rpc("accept_home_invite", { invite_id: invite });
    expect(error).toBeNull();
    expect(await kidHome(sam.id)).toBe(homeId);
    expect(await headcount(homeId)).toBe(5);
  });

  it("a hand-off keeps the kid's place in the Home and everything that was theirs (HOME-010)", async () => {
    await clients.josh.from("dietary_needs").upsert({ profile_id: miaId, allergies: ["peanuts"], diets: [] });
    await clients.josh.from("profiles").update({ birthday: "2014-05-01" }).eq("id", miaId);
    const spell = await clients.josh
      .from("sick_spells")
      .insert({ home_id: homeId, patient_id: miaId, title: "Strep throat", started_on: today() })
      .select("id")
      .single();
    expect(spell.error).toBeNull();

    const { data: code } = await clients.josh.rpc("create_handoff", { target_profile: miaId });
    const { data: teenHome } = await clients.teen.rpc("my_home"); // a brand-new account has its own empty Home
    const { error } = await clients.teen.rpc("answer_code", { any_code: code });
    expect(error).toBeNull();

    // Same Home, same seat: a member now, not a kid.
    const { data: membership } = await admin.from("home_members").select("home_id").eq("profile_id", ids.teen).single();
    expect(membership?.home_id).toBe(homeId);
    expect(await kidHome(miaId)).toBeNull();
    expect(await headcount(homeId)).toBe(5);
    const { data: oldHome } = await admin.from("homes").select("id").eq("id", teenHome);
    expect(oldHome).toEqual([]);

    // Everything that was hers came along.
    const { data: profile } = await admin.from("profiles").select("display_name, birthday").eq("id", ids.teen).single();
    expect(profile).toEqual({ display_name: "Mia Collins", birthday: "2014-05-01" });
    const { data: needs } = await admin.from("dietary_needs").select("allergies").eq("profile_id", ids.teen).single();
    expect(needs?.allergies).toEqual(["peanuts"]);
    const { data: sick } = await admin.from("sick_spells").select("patient_id").eq("id", spell.data!.id).single();
    expect(sick?.patient_id).toBe(ids.teen);
    const { data: burrows } = await admin.from("burrow_members").select("burrow_id").eq("profile_id", ids.teen);
    expect((burrows ?? []).map((b) => b.burrow_id)).toContain(burrow);

    // The managed profile is gone, so nobody manages her any more.
    const { data: gone } = await admin.from("profiles").select("id").eq("id", miaId);
    expect(gone).toEqual([]);
    // Josh hears she's joined.
    const { data: notices } = await clients.josh.from("notifications").select("kind").eq("kind", "home_joined");
    expect((notices ?? []).length).toBeGreaterThan(0);
  });
});
