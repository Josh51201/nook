import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

// The Fridge door (CORE-086), enforced in Postgres. Same setup as
// gift-nook-rls.test.ts (needs .env plus SUPABASE_SERVICE_ROLE_KEY in
// .env.test.local); skipped without them.

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL;
const ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const canRun = Boolean(SUPABASE_URL && ANON_KEY && SERVICE_ROLE_KEY);

describe.runIf(canRun)("Fridge door: only the Home or Burrow sees its fridge", () => {
  let admin: SupabaseClient;
  const runId = Date.now();
  // josh and sarah share a Home. cousin shares their Burrow but not the
  // Home. stranger is in neither.
  const people = ["josh", "sarah", "cousin", "stranger"] as const;
  type Person = (typeof people)[number];
  const ids = {} as Record<Person, string>;
  const clients = {} as Record<Person, SupabaseClient>;
  let homeId: string;
  let burrowId: string;

  beforeAll(async () => {
    admin = createClient(SUPABASE_URL!, SERVICE_ROLE_KEY!, { auth: { autoRefreshToken: false, persistSession: false } });
    for (const person of people) {
      const email = `fridge-${person}-${runId}@example.com`;
      const password = `fridge-${person}-pw!`;
      const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
      if (error || !data.user) throw error;
      ids[person] = data.user.id;
      const client = createClient(SUPABASE_URL!, ANON_KEY!, { auth: { autoRefreshToken: false, persistSession: false } });
      const { error: signInError } = await client.auth.signInWithPassword({ email, password });
      if (signInError) throw signInError;
      clients[person] = client;
      await admin.from("profiles").update({ display_name: person[0].toUpperCase() + person.slice(1) }).eq("id", ids[person]);
    }
    const { data: burrow } = await clients.josh.rpc("create_burrow", { burrow_name: `Fridge ${runId}` });
    burrowId = burrow;
    const { data: code } = await clients.josh.rpc("create_knock", { target_burrow: burrow });
    for (const person of ["sarah", "cousin"] as const) await clients[person].rpc("answer_knock", { knock_code: code });
    const { data: invite } = await clients.josh.rpc("invite_to_home", { target: ids.sarah });
    await clients.sarah.rpc("accept_home_invite", { invite_id: invite });
    await clients.cousin.rpc("my_home");
    await clients.stranger.rpc("my_home");
    const { data } = await clients.josh.rpc("my_home");
    homeId = data;
  });

  afterAll(async () => {
    for (const person of people) await admin.auth.admin.deleteUser(ids[person]);
  });

  async function stick(person: Person, where: { home_id?: string; burrow_id?: string }, body: string, extra: Record<string, unknown> = {}) {
    return clients[person].from("fridge_notes").insert({ ...where, kind: "note", body, ...extra }).select("id, expires_at, created_at").single();
  }

  it("the Home sees its fridge; family outside the Home and strangers don't", async () => {
    const { data: note, error } = await stick("josh", { home_id: homeId }, "Pizza night!");
    expect(error).toBeNull();
    const { data: sarahSees } = await clients.sarah.from("fridge_notes").select("id, body").eq("home_id", homeId);
    expect(sarahSees?.map((n) => n.body)).toContain("Pizza night!");
    for (const person of ["cousin", "stranger"] as const) {
      const { data: theySee } = await clients[person].from("fridge_notes").select("id").eq("id", note!.id);
      expect(theySee).toEqual([]);
    }
  });

  it("a Burrow's fridge is seen by the Burrow only", async () => {
    const { data: note, error } = await stick("cousin", { burrow_id: burrowId }, "Hi all!");
    expect(error).toBeNull();
    const { data: joshSees } = await clients.josh.from("fridge_notes").select("id").eq("id", note!.id);
    expect(joshSees).toHaveLength(1);
    const { data: strangerSees } = await clients.stranger.from("fridge_notes").select("id").eq("id", note!.id);
    expect(strangerSees).toEqual([]);
  });

  it("nobody sticks things on a fridge that isn't theirs, or as someone else", async () => {
    const outsider = await stick("cousin", { home_id: homeId }, "Let me in");
    expect(outsider.error).not.toBeNull();
    const stranger = await stick("stranger", { burrow_id: burrowId }, "Hello?");
    expect(stranger.error).not.toBeNull();
    const spoof = await stick("sarah", { home_id: homeId }, "From Josh, honest", { author_id: ids.josh });
    expect(spoof.error).not.toBeNull();
  });

  it("the database sets how long it stays up, not the phone", async () => {
    const { data, error } = await stick("sarah", { home_id: homeId }, "Back at 5", {
      lasts_days: 3,
      expires_at: "2099-01-01T00:00:00Z",
      created_at: "2000-01-01T00:00:00Z",
    });
    expect(error).toBeNull();
    const lasts = new Date(data!.expires_at).getTime() - new Date(data!.created_at).getTime();
    expect(Math.round(lasts / 86400000)).toBe(3);
    expect(Math.abs(new Date(data!.created_at).getTime() - Date.now())).toBeLessThan(5 * 60000);
    const tooLong = await stick("sarah", { home_id: homeId }, "Forever", { lasts_days: 30 });
    expect(tooLong.error).not.toBeNull();
  });

  it("a note whose time is up is gone for everyone", async () => {
    const { data: note } = await stick("josh", { home_id: homeId }, "Old news");
    await admin.from("fridge_notes").update({ expires_at: new Date(Date.now() - 1000).toISOString() }).eq("id", note!.id);
    const { data } = await clients.sarah.from("fridge_notes").select("id").eq("id", note!.id);
    expect(data).toEqual([]);
  });

  it("everyone else on the fridge gets a notice; the writer and outsiders don't", async () => {
    const { data: note } = await stick("josh", { home_id: homeId }, "Dentist at 3");
    const notices = async (person: Person) =>
      (await clients[person].from("notifications").select("title, body, data").eq("nook", "fridge").is("read_at", null)).data ?? [];
    const sarahs = await notices("sarah");
    // One unread notice per fridge: the newest note replaces the last.
    expect(sarahs.filter((n) => n.data.home_id === homeId)).toHaveLength(1);
    expect(sarahs.find((n) => n.data.home_id === homeId)).toMatchObject({
      title: "Josh left a note on the Home fridge",
      body: "Dentist at 3",
      data: { note_id: note!.id },
    });
    expect((await notices("josh")).filter((n) => n.data.home_id === homeId)).toEqual([]);
    expect((await notices("cousin")).filter((n) => n.data.home_id === homeId)).toEqual([]);
  });

  it("notices can be switched off", async () => {
    await clients.cousin.from("nook_settings").upsert({ profile_id: ids.cousin, nook: "fridge", settings: { notifyBurrow: false } });
    await clients.cousin.from("notifications").delete().eq("nook", "fridge");
    await stick("josh", { burrow_id: burrowId }, "Anyone home?");
    const { data } = await clients.cousin.from("notifications").select("id").eq("nook", "fridge");
    expect(data).toEqual([]);
  });

  it("only the writer takes a Burrow note down; anyone in the Home can take a Home note down", async () => {
    const { data: burrowNote } = await stick("josh", { burrow_id: burrowId }, "Mine");
    const { count: cousinTook } = await clients.cousin.from("fridge_notes").delete({ count: "exact" }).eq("id", burrowNote!.id);
    expect(cousinTook).toBe(0);

    const { data: homeNote } = await stick("josh", { home_id: homeId }, "Feed the cat");
    const { count: sarahTook } = await clients.sarah.from("fridge_notes").delete({ count: "exact" }).eq("id", homeNote!.id);
    expect(sarahTook).toBe(1);
    // Its notice goes with it.
    const { data: left } = await admin.from("notifications").select("id").eq("nook", "fridge").eq("data->>note_id", homeNote!.id);
    expect(left).toEqual([]);
  });

  it("notes can't be changed once they're up", async () => {
    const { data: note } = await stick("josh", { home_id: homeId }, "Original");
    await clients.josh.from("fridge_notes").update({ body: "Changed" }).eq("id", note!.id);
    const { data } = await clients.josh.from("fridge_notes").select("body").eq("id", note!.id).single();
    expect(data?.body).toBe("Original");
  });
});
