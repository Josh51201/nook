import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

// Sitter Sheet Nook (SIT-002..008), enforced in Postgres. Same setup as
// gift-nook-rls.test.ts (needs .env plus SUPABASE_SERVICE_ROLE_KEY in
// .env.test.local); skipped without them.
//
// The point of these: a sitter with a link sees exactly what it was made
// with and nothing else, and a made-up, switched-off or expired link shows
// nothing at all.

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL;
const ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const canRun = Boolean(SUPABASE_URL && ANON_KEY && SERVICE_ROLE_KEY);
const dayFromNow = (days: number) => new Date(Date.now() + days * 864e5).toISOString().slice(0, 10);

describe.runIf(canRun)("Sitter Sheet: the Home writes it, a link shows only what it was made with", () => {
  let admin: SupabaseClient;
  // The sitter's page: no account, just the public key.
  let sitter: SupabaseClient;
  const runId = Date.now();
  // josh and sarah share a Home. stranger has their own Home and kid.
  const people = ["josh", "sarah", "stranger"] as const;
  type Person = (typeof people)[number];
  const ids = {} as Record<Person, string>;
  const clients = {} as Record<Person, SupabaseClient>;

  let homeId: string;
  let kidId: string;
  let otherKidId: string;
  let petId: string;
  let strangerKidId: string;

  async function makeLink(fields: Record<string, unknown> = {}) {
    const { data, error } = await clients.josh
      .from("sitter_links")
      .insert({ home_id: homeId, label: "Grandma", starts_on: dayFromNow(0), ends_on: dayFromNow(2), tz: "America/Chicago", ...fields })
      .select("id, token")
      .single();
    if (error) throw error;
    return data as { id: string; token: string };
  }

  const view = async (token: string) => (await sitter.rpc("sitter_sheet_for_link", { link: token })).data;

  beforeAll(async () => {
    admin = createClient(SUPABASE_URL!, SERVICE_ROLE_KEY!, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    sitter = createClient(SUPABASE_URL!, ANON_KEY!, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    for (const person of people) {
      const email = `sitter-${person}-${runId}@example.com`;
      const password = `sitter-${person}-pw!`;
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

    const { data: burrow } = await clients.josh.rpc("create_burrow", { burrow_name: `Sitter ${runId}` });
    const { data: code } = await clients.josh.rpc("create_knock", { target_burrow: burrow });
    await clients.sarah.rpc("answer_knock", { knock_code: code });
    const { data: invite } = await clients.josh.rpc("invite_to_home", { target: ids.sarah });
    await clients.sarah.rpc("accept_home_invite", { invite_id: invite });

    const { data: home } = await clients.josh.rpc("my_home");
    homeId = home as string;

    // Two of sarah's kids (so managed by someone in the Home), one picked.
    const { data: kid } = await clients.sarah.rpc("create_managed_profile", { profile_name: "Lily Smith", burrow_ids: [burrow] });
    kidId = kid as string;
    const { data: other } = await clients.sarah.rpc("create_managed_profile", { profile_name: "Max Smith", burrow_ids: [burrow] });
    otherKidId = other as string;
    await clients.sarah.from("dietary_needs").insert({ profile_id: kidId, allergies: ["peanuts"], diets: ["vegetarian"] });
    await clients.sarah.from("dietary_needs").insert({ profile_id: otherKidId, allergies: ["shellfish"], diets: [] });

    const { data: strangerBurrow } = await clients.stranger.rpc("create_burrow", { burrow_name: `Elsewhere ${runId}` });
    const { data: strangerKid } = await clients.stranger.rpc("create_managed_profile", {
      profile_name: "Theo",
      burrow_ids: [strangerBurrow],
    });
    strangerKidId = strangerKid as string;

    const { data: pet, error } = await clients.josh
      .from("pets")
      .insert({ home_id: homeId, name: "Biscuit", species: "dog", food: "Kibble", microchip: "985-SECRET", created_by: ids.josh })
      .select("id")
      .single();
    if (error) throw error;
    petId = pet!.id;
    await clients.josh.from("pet_meals").insert({ pet_id: petId, label: "Dinner", remind_at: "18:00" });
    await clients.josh.from("pet_health").insert({ pet_id: petId, kind: "medication", title: "Allergy pill", due_on: dayFromNow(1), repeat_days: 1 });
    await clients.josh.from("pet_health").insert({ pet_id: petId, kind: "vaccine", title: "Rabies", due_on: dayFromNow(90) });

    const { error: sheetError } = await clients.josh.from("sitter_sheets").insert({
      home_id: homeId,
      address: "12 Oak Lane",
      contacts: [{ name: "Josh", phone: "555-0100", note: "Dad" }],
      doctor_name: "Dr. Patel",
      doctor_phone: "555-0199",
      bedtime: "8pm, one story",
      rules: "No screens after dinner",
      food: "Pasta in the fridge",
      notes: "Wi-Fi: nooknook",
    });
    if (sheetError) throw sheetError;
  });

  afterAll(async () => {
    await admin.from("homes").delete().eq("id", homeId);
    for (const kid of [kidId, otherKidId, strangerKidId]) if (kid) await admin.from("profiles").delete().eq("id", kid);
    for (const person of people) await admin.auth.admin.deleteUser(ids[person]);
  });

  it("the whole Home can read and change the sheet; a stranger and a no-account visitor can't", async () => {
    const reads = async (client: SupabaseClient) =>
      ((await client.from("sitter_sheets").select("home_id").eq("home_id", homeId)).data ?? []).length;
    expect(await reads(clients.josh)).toBe(1);
    expect(await reads(clients.sarah)).toBe(1);
    expect(await reads(clients.stranger)).toBe(0);
    expect(await reads(sitter)).toBe(0);

    const { error } = await clients.sarah.from("sitter_sheets").update({ bedtime: "8:30pm" }).eq("home_id", homeId);
    expect(error).toBeNull();
    await clients.stranger.from("sitter_sheets").update({ bedtime: "Midnight" }).eq("home_id", homeId);
    const { data } = await admin.from("sitter_sheets").select("bedtime, updated_by").eq("home_id", homeId).single();
    expect(data).toEqual({ bedtime: "8:30pm", updated_by: ids.sarah });
  });

  it("links are the Home's alone: a stranger and a no-account visitor can't list them or make one", async () => {
    await makeLink();
    const list = async (client: SupabaseClient) => ((await client.from("sitter_links").select("token").eq("home_id", homeId)).data ?? []).length;
    expect(await list(clients.sarah)).toBeGreaterThan(0);
    expect(await list(clients.stranger)).toBe(0);
    expect(await list(sitter)).toBe(0);

    const strangerMade = await clients.stranger
      .from("sitter_links")
      .insert({ home_id: homeId, label: "Sneaky", starts_on: dayFromNow(0), ends_on: dayFromNow(1) });
    expect(strangerMade.error).not.toBeNull();
  });

  it("the secret is always made by the database, never chosen by the app", async () => {
    const chosen = "a".repeat(43);
    const { data, error } = await clients.josh
      .from("sitter_links")
      .insert({ home_id: homeId, label: "Chosen", starts_on: dayFromNow(0), ends_on: dayFromNow(1), token: chosen } as never)
      .select("token")
      .single();
    // Either the column can't be written at all, or the trigger replaces it.
    if (!error) expect(data!.token).not.toBe(chosen);
    expect(await view(chosen)).toBeNull();
  });

  it("only the Home's own kids and pets can be picked", async () => {
    await expect(makeLink({ kid_ids: [strangerKidId] })).rejects.toBeTruthy();
    const { data: strangerHome } = await clients.stranger.rpc("my_home");
    const { data: strangerPet } = await clients.stranger
      .from("pets")
      .insert({ home_id: strangerHome, name: "Rex", created_by: ids.stranger })
      .select("id")
      .single();
    await expect(makeLink({ pet_ids: [strangerPet!.id] })).rejects.toBeTruthy();
  });

  it("a link shows only its chosen sections, kids and pets, and nothing extra about them", async () => {
    const link = await makeLink({ sections: ["contacts", "bedtime"], kid_ids: [kidId], pet_ids: [petId] });
    const sheet = await view(link.token);
    expect(sheet).not.toBeNull();

    expect(sheet.contacts).toEqual([{ name: "Josh", phone: "555-0100", note: "Dad" }]);
    expect(sheet.bedtime).toBe("8:30pm");
    for (const left of ["address", "doctor_name", "doctor_phone", "rules", "food", "notes"]) expect(sheet).not.toHaveProperty(left);

    // The picked kid: first name, allergies, diets. No last name, no id, nothing else.
    expect(sheet.kids).toEqual([{ name: "Lily", allergies: ["peanuts"], diets: ["vegetarian"] }]);
    expect(JSON.stringify(sheet)).not.toContain("Max");
    expect(JSON.stringify(sheet)).not.toContain("shellfish");
    expect(JSON.stringify(sheet)).not.toContain("Smith");
    expect(JSON.stringify(sheet)).not.toContain(kidId);

    expect(sheet.pets).toHaveLength(1);
    expect(sheet.pets[0]).toMatchObject({ name: "Biscuit", food: "Kibble", meals: [{ label: "Dinner", time: "18:00" }] });
    expect(sheet.pets[0].medications).toEqual([{ title: "Allergy pill", notes: null }]);
    expect(JSON.stringify(sheet)).not.toContain("985-SECRET");
    expect(JSON.stringify(sheet)).not.toContain("Rabies");

    // Nothing that identifies the Home or who made it.
    for (const key of ["home_id", "id", "token", "created_by", "views"]) expect(sheet).not.toHaveProperty(key);
  });

  it("with nothing picked, no kids or pets come through", async () => {
    const link = await makeLink();
    const sheet = await view(link.token);
    expect(sheet.kids).toEqual([]);
    expect(sheet.pets).toEqual([]);
    expect(sheet.address).toBe("12 Oak Lane");
  });

  it("a made-up, switched-off or expired link shows nothing", async () => {
    expect(await view("not-a-real-link-but-long-enough-to-check")).toBeNull();
    expect(await view("")).toBeNull();

    const off = await makeLink({ kid_ids: [kidId] });
    expect(await view(off.token)).not.toBeNull();
    await clients.sarah.from("sitter_links").update({ revoked_at: new Date().toISOString() }).eq("id", off.id);
    expect(await view(off.token)).toBeNull();

    const old = await makeLink();
    await admin.from("sitter_links").update({ expires_at: new Date(Date.now() - 1000).toISOString() }).eq("id", old.id);
    expect(await view(old.token)).toBeNull();
  });

  it("everyone in the Home can list the Home's kids to pick from; a stranger sees none of them", async () => {
    const { data: joshSees } = await clients.josh.rpc("home_kids");
    expect((joshSees as { id: string }[]).map((k) => k.id).sort()).toEqual([kidId, otherKidId].sort());
    const { data: strangerSees } = await clients.stranger.rpc("home_kids");
    expect((strangerSees as { id: string }[]).map((k) => k.id)).toEqual([strangerKidId]);
    const { error } = await sitter.rpc("home_kids");
    expect(error).not.toBeNull();
  });

  it("a stay that has already ended can't be made, and can't run past 60 days", async () => {
    await expect(makeLink({ starts_on: dayFromNow(-5), ends_on: dayFromNow(-3) })).rejects.toBeTruthy();
    await expect(makeLink({ ends_on: dayFromNow(61) })).rejects.toBeTruthy();
  });

  it("a kid who leaves the Home drops off the link, and the link can still be switched off", async () => {
    const link = await makeLink({ kid_ids: [kidId] });
    await admin.from("profile_managers").delete().eq("profile_id", kidId);
    expect((await view(link.token)).kids).toEqual([]);
    const { error } = await clients.josh.from("sitter_links").update({ revoked_at: new Date().toISOString() }).eq("id", link.id);
    expect(error).toBeNull();
    expect(await view(link.token)).toBeNull();
    await admin.from("profile_managers").insert({ profile_id: kidId, manager_id: ids.sarah });
  });

  it("the Home sees how often a link was opened, but can't fake the count", async () => {
    const link = await makeLink();
    await view(link.token);
    await view(link.token);
    // Someone in the Home previewing it doesn't count.
    await clients.sarah.rpc("sitter_sheet_for_link", { link: link.token });
    await clients.josh.from("sitter_links").update({ views: 0 } as never).eq("id", link.id);
    const { data } = await clients.josh.from("sitter_links").select("views, last_viewed_at").eq("id", link.id).single();
    expect(data!.views).toBe(2);
    expect(data!.last_viewed_at).not.toBeNull();
  });
});
