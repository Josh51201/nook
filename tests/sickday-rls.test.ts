import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

// Sick Day Nook (SICK-002, SICK-004, SICK-009, SICK-010, SICK-013), enforced
// in Postgres. Same setup as gift-nook-rls.test.ts (needs .env plus
// SUPABASE_SERVICE_ROLE_KEY in .env.test.local); skipped without them.

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL;
const ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const canRun = Boolean(SUPABASE_URL && ANON_KEY && SERVICE_ROLE_KEY);
const day = (offset = 0) => new Date(Date.now() + offset * 864e5).toISOString().slice(0, 10);

describe.runIf(canRun)("Sick Day: the Home and its helpers see it, nobody else; no double doses", () => {
  let admin: SupabaseClient;
  const runId = Date.now();
  // josh and sarah share a Home and look after Mia (a kid profile). grandma
  // and cousin share a Burrow with them but don't live there.
  const people = ["josh", "sarah", "grandma", "cousin"] as const;
  type Person = (typeof people)[number];
  const ids = {} as Record<Person, string>;
  const clients = {} as Record<Person, SupabaseClient>;

  let homeId: string;
  let miaId: string;
  let spellId: string;
  let tylenolId: string;
  let motrinId: string;

  beforeAll(async () => {
    admin = createClient(SUPABASE_URL!, SERVICE_ROLE_KEY!, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    for (const person of people) {
      const email = `sick-${person}-${runId}@example.com`;
      const password = `sick-${person}-pw!`;
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

    const { data: burrow } = await clients.josh.rpc("create_burrow", { burrow_name: `Sick ${runId}` });
    const { data: code } = await clients.josh.rpc("create_knock", { target_burrow: burrow });
    for (const person of ["sarah", "grandma", "cousin"] as const) await clients[person].rpc("answer_knock", { knock_code: code });

    const { data: invite } = await clients.josh.rpc("invite_to_home", { target: ids.sarah });
    await clients.sarah.rpc("accept_home_invite", { invite_id: invite });
    const { data: home } = await clients.josh.rpc("my_home");
    homeId = home;
    const { data: kid } = await clients.josh.rpc("create_home_kid", { profile_name: "Mia Test", burrow_ids: [burrow] });
    miaId = kid;

    // Read back in the same statement that adds it (the Pet Care bug).
    const spell = await clients.josh
      .from("sick_spells")
      .insert({ home_id: homeId, patient_id: miaId, title: "Flu", started_on: day(-1), missed_from: "school" })
      .select("id")
      .single();
    if (spell.error) throw spell.error;
    spellId = spell.data!.id;

    const tylenol = await clients.josh
      .from("sick_medicines")
      .insert({ home_id: homeId, name: "Children's Tylenol", ingredients: ["acetaminophen"], amount: "5 mL", every_hours: 4, max_per_day: 5 })
      .select("id")
      .single();
    if (tylenol.error) throw tylenol.error;
    tylenolId = tylenol.data!.id;
    const motrin = await clients.sarah
      .from("sick_medicines")
      .insert({ home_id: homeId, name: "Motrin", ingredients: ["ibuprofen"], amount: "5 mL", every_hours: 6 })
      .select("id")
      .single();
    if (motrin.error) throw motrin.error;
    motrinId = motrin.data!.id;

    const logged = await clients.josh.from("sick_log").insert({ spell_id: spellId, temp_c: 39.2, symptoms: ["Cough"] });
    if (logged.error) throw logged.error;
  });

  afterAll(async () => {
    if (miaId) await admin.from("profiles").delete().eq("id", miaId);
    for (const person of people) await admin.auth.admin.deleteUser(ids[person]);
  });

  const sees = async (person: Person, table: string, column: string, id: string) =>
    ((await clients[person].from(table).select(column).eq(column, id)).data ?? []).length > 0;

  it("the Home sees the sick spell, its log and cabinet; family outside the Home don't, not even a count (SICK-002)", async () => {
    expect(await sees("josh", "sick_spells", "id", spellId)).toBe(true);
    expect(await sees("sarah", "sick_spells", "id", spellId)).toBe(true);
    for (const outsider of ["grandma", "cousin"] as const) {
      expect(await sees(outsider, "sick_spells", "id", spellId)).toBe(false);
      expect(await sees(outsider, "sick_log", "spell_id", spellId)).toBe(false);
      expect(await sees(outsider, "sick_medicines", "id", tylenolId)).toBe(false);
      const { count } = await clients[outsider].from("sick_spells").select("id", { count: "exact", head: true });
      expect(count).toBe(0);
      const { data: names } = await clients[outsider].rpc("sick_people");
      expect(((names ?? []) as { id: string }[]).some((p) => p.id === miaId)).toBe(false);
    }
  });

  it("only someone in the Home (or a kid it looks after) can be the sick one, and only the Home starts one", async () => {
    const notHome = await clients.josh.from("sick_spells").insert({ home_id: homeId, patient_id: ids.cousin, started_on: day() });
    expect(notHome.error).not.toBeNull();
    const fromOutside = await clients.cousin.from("sick_spells").insert({ home_id: homeId, patient_id: miaId, started_on: day() });
    expect(fromOutside.error).not.toBeNull();
    const twice = await clients.sarah.from("sick_spells").insert({ home_id: homeId, patient_id: miaId, started_on: day() });
    expect(twice.error).not.toBeNull();
    const { data: cousinHome } = await clients.cousin.rpc("my_home");
    await clients.josh.from("sick_spells").update({ home_id: cousinHome, patient_id: ids.josh } as never).eq("id", spellId);
    const { data } = await admin.from("sick_spells").select("home_id, patient_id").eq("id", spellId).single();
    expect(data).toEqual({ home_id: homeId, patient_id: miaId });
  });

  it("refuses a second dose that's too soon, even of another medicine with the same thing in it (SICK-004)", async () => {
    const first = await clients.josh.rpc("give_sick_dose", { target_spell: spellId, medicine: tylenolId });
    expect(first.error).toBeNull();

    const again = await clients.sarah.rpc("give_sick_dose", { target_spell: spellId, medicine: tylenolId });
    expect(again.error?.message).toBe("too_soon");
    expect(again.error?.hint).toBe("gap");
    const okAt = new Date(again.error!.details).getTime();
    expect(okAt - Date.now()).toBeGreaterThan(3.9 * 3600_000);

    // NyQuil, typed in, has acetaminophen too.
    const nyquil = await clients.sarah.rpc("give_sick_dose", { target_spell: spellId, medicine_name: "NyQuil", amount: "10 mL" });
    expect(nyquil.error).toBeNull(); // a typed one has no ingredients, so the database can't know
    const { data: cabinetNyquil } = await clients.sarah
      .from("sick_medicines")
      .insert({ home_id: homeId, name: "NyQuil", ingredients: ["acetaminophen", "dextromethorphan"], every_hours: 6 })
      .select("id")
      .single();
    const shared = await clients.sarah.rpc("give_sick_dose", { target_spell: spellId, medicine: cabinetNyquil!.id });
    expect(shared.error?.message).toBe("too_soon");

    // "Give it anyway" goes through, marked as early.
    const anyway = await clients.sarah.rpc("give_sick_dose", { target_spell: spellId, medicine: tylenolId, anyway: true });
    expect(anyway.error).toBeNull();
    const { data: early } = await clients.josh.from("sick_doses").select("early").eq("id", anyway.data).single();
    expect(early?.early).toBe(true);
  });

  it("two phones giving at the same moment: only one gets through", async () => {
    const [a, b] = await Promise.all([
      clients.josh.rpc("give_sick_dose", { target_spell: spellId, medicine: motrinId }),
      clients.sarah.rpc("give_sick_dose", { target_spell: spellId, medicine: motrinId }),
    ]);
    expect([a.error, b.error].filter((e) => e === null)).toHaveLength(1);
    const { count } = await admin.from("sick_doses").select("id", { count: "exact", head: true }).eq("medicine_id", motrinId);
    expect(count).toBe(1);
  });

  it("doses are only written by give_sick_dose, as yourself", async () => {
    const direct = await clients.josh.from("sick_doses").insert({ spell_id: spellId, medicine_name: "Sneaky", given_by: ids.sarah });
    expect(direct.error).not.toBeNull();
    const outsider = await clients.cousin.rpc("give_sick_dose", { target_spell: spellId, medicine: motrinId, anyway: true });
    expect(outsider.error).not.toBeNull();
    const job = await clients.josh.rpc("sick_day_ticks");
    expect(job.error).not.toBeNull();
  });

  it("tells the others in the Home when a dose is given, and nobody outside it (SICK-009)", async () => {
    const { data: sarahs } = await clients.sarah.from("notifications").select("kind, title").eq("nook", "sickday");
    expect((sarahs ?? []).some((n) => n.kind === "sick_dose_given" && n.title.includes("Children's Tylenol"))).toBe(true);
    const { data: cousins } = await clients.cousin.from("notifications").select("id").eq("nook", "sickday");
    expect(cousins).toEqual([]);
  });

  it("a helper from a Burrow sees and logs, but can't change the spell or the cabinet (SICK-002)", async () => {
    // Only the Home hands out helpers, and never someone who lives there.
    const byOutsider = await clients.cousin.from("sick_helpers").insert({ spell_id: spellId, profile_id: ids.cousin });
    expect(byOutsider.error).not.toBeNull();
    const housemate = await clients.josh.from("sick_helpers").insert({ spell_id: spellId, profile_id: ids.sarah });
    expect(housemate.error).not.toBeNull();

    const added = await clients.josh.from("sick_helpers").insert({ spell_id: spellId, profile_id: ids.grandma, until: day(1) });
    expect(added.error).toBeNull();

    expect(await sees("grandma", "sick_spells", "id", spellId)).toBe(true);
    expect(await sees("grandma", "sick_log", "spell_id", spellId)).toBe(true);
    expect(await sees("grandma", "sick_doses", "spell_id", spellId)).toBe(true);
    expect(await sees("grandma", "sick_medicines", "id", tylenolId)).toBe(true);
    expect(await sees("cousin", "sick_spells", "id", spellId)).toBe(false);

    const { data: notice } = await clients.grandma.from("notifications").select("kind").eq("nook", "sickday");
    expect((notice ?? []).map((n) => n.kind)).toContain("sick_helper");

    const temp = await clients.grandma.from("sick_log").insert({ spell_id: spellId, temp_c: 38.4 });
    expect(temp.error).toBeNull();
    const asSomeoneElse = await clients.grandma.from("sick_log").insert({ spell_id: spellId, temp_c: 38.4, logged_by: ids.josh });
    expect(asSomeoneElse.error).not.toBeNull();
    // Same double-dose check for her.
    const tooSoon = await clients.grandma.rpc("give_sick_dose", { target_spell: spellId, medicine: motrinId });
    expect(tooSoon.error?.message).toBe("too_soon");

    await clients.grandma.from("sick_spells").update({ title: "Changed" }).eq("id", spellId);
    await clients.grandma.from("sick_spells").delete().eq("id", spellId);
    await clients.grandma.from("sick_medicines").update({ every_hours: 1 }).eq("id", tylenolId);
    const added2 = await clients.grandma.from("sick_medicines").insert({ home_id: homeId, name: "Grandma's remedy" });
    expect(added2.error).not.toBeNull();
    const { data: spell } = await admin.from("sick_spells").select("title").eq("id", spellId).single();
    expect(spell?.title).toBe("Flu");
    const { data: cabinet } = await admin.from("sick_medicines").select("every_hours").eq("id", tylenolId).single();
    expect(Number(cabinet?.every_hours)).toBe(4);
  });

  it("a helper loses access when their day has passed", async () => {
    await admin.from("sick_helpers").update({ until: day(-1) }).eq("spell_id", spellId).eq("profile_id", ids.grandma);
    expect(await sees("grandma", "sick_spells", "id", spellId)).toBe(false);
    expect(await sees("grandma", "sick_medicines", "id", tylenolId)).toBe(false);
    const late = await clients.grandma.from("sick_log").insert({ spell_id: spellId, temp_c: 38 });
    expect(late.error).not.toBeNull();
  });

  it("a sitter link shows the sick part only when ticked, and only for kids on it (SICK-010)", async () => {
    const make = async (showSick: boolean, kids: string[]) => {
      const { data, error } = await clients.josh
        .from("sitter_links")
        .insert({ home_id: homeId, label: "Grandpa", starts_on: day(), ends_on: day(1), sections: ["notes"], kid_ids: kids, show_sick: showSick, created_by: ids.josh })
        .select("token")
        .single();
      if (error) throw error;
      const anon = createClient(SUPABASE_URL!, ANON_KEY!, { auth: { autoRefreshToken: false, persistSession: false } });
      const { data: view } = await anon.rpc("sitter_sheet_for_link", { link: data!.token });
      return view as { sick?: { name: string; temp: unknown; medicines: { name: string; next_ok: string | null }[] }[] };
    };

    const off = await make(false, [miaId]);
    expect(off.sick).toBeUndefined();
    const noKid = await make(true, []);
    expect(noKid.sick).toEqual([]);
    const on = await make(true, [miaId]);
    expect(on.sick).toHaveLength(1);
    expect(on.sick![0].name).toBe("Mia");
    const tylenol = on.sick![0].medicines.find((m) => m.name === "Children's Tylenol");
    expect(tylenol?.next_ok).not.toBeNull();
    // Nothing about who gave what, or the notes.
    expect(JSON.stringify(on.sick)).not.toContain(ids.josh);
    expect(JSON.stringify(on.sick)).not.toContain("given_by");
  });
});
