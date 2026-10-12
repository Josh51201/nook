import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

// Notes Nook (NOTE-006, NOTE-009), enforced in Postgres: a note is just
// yours unless you share it with your Home; then the people you live with
// can read it and change its words, but only you pin, file, unshare or
// delete it. Same setup as gift-nook-rls.test.ts (needs .env plus
// SUPABASE_SERVICE_ROLE_KEY in .env.test.local); skipped without them.

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL;
const ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const canRun = Boolean(SUPABASE_URL && ANON_KEY && SERVICE_ROLE_KEY);

describe.runIf(canRun)("Notes: private by default, shared with the Home when asked", () => {
  let admin: SupabaseClient;
  const runId = Date.now();
  // josh and sarah share a Home. cousin shares a Burrow but not the Home.
  const people = ["josh", "sarah", "cousin"] as const;
  type Person = (typeof people)[number];
  const ids = {} as Record<Person, string>;
  const clients = {} as Record<Person, SupabaseClient>;

  let privateNote: string;
  let sharedNote: string;

  beforeAll(async () => {
    admin = createClient(SUPABASE_URL!, SERVICE_ROLE_KEY!, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    for (const person of people) {
      const email = `notes-${person}-${runId}@example.com`;
      const password = `notes-${person}-pw!`;
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

    const { data: burrow } = await clients.josh.rpc("create_burrow", { burrow_name: `Notes ${runId}` });
    const { data: code } = await clients.josh.rpc("create_knock", { target_burrow: burrow });
    for (const person of ["sarah", "cousin"] as const) await clients[person].rpc("answer_knock", { knock_code: code });

    const { data: invite } = await clients.josh.rpc("invite_to_home", { target: ids.sarah });
    await clients.sarah.rpc("accept_home_invite", { invite_id: invite });

    // Read back in the same statement that adds it.
    const mine = await clients.josh.from("notes").insert({ body: "Surprise party ideas" }).select("id").single();
    if (mine.error) throw mine.error;
    privateNote = mine.data!.id;

    const shared = await clients.josh.from("notes").insert({ body: "Packing\n☐ Socks", shared: true }).select("id").single();
    if (shared.error) throw shared.error;
    sharedNote = shared.data!.id;
  });

  afterAll(async () => {
    for (const person of people) await admin.auth.admin.deleteUser(ids[person]);
  });

  const sees = async (person: Person, id: string) =>
    ((await clients[person].from("notes").select("id").eq("id", id)).data ?? []).length === 1;

  it("a note is just yours until you share it, even from people you live with", async () => {
    expect(await sees("josh", privateNote)).toBe(true);
    expect(await sees("sarah", privateNote)).toBe(false);
    expect(await sees("cousin", privateNote)).toBe(false);
    const edit = await clients.sarah.from("notes").update({ body: "Peeked" }).eq("id", privateNote).select("id");
    expect(edit.data ?? []).toHaveLength(0);
  });

  it("a shared note is seen by the Home, and nobody outside it", async () => {
    expect(await sees("sarah", sharedNote)).toBe(true);
    expect(await sees("cousin", sharedNote)).toBe(false);
  });

  it("the Home can change the words, and the note says who did", async () => {
    const edit = await clients.sarah.from("notes").update({ body: "Packing\n☑ Socks" }).eq("id", sharedNote).select("body, edited_by");
    expect(edit.data?.[0]).toMatchObject({ body: "Packing\n☑ Socks", edited_by: ids.sarah });
  });

  it("only the owner pins, files, unshares or deletes it, and it can't change hands", async () => {
    expect((await clients.sarah.from("notes").update({ pinned: true }).eq("id", sharedNote)).error).not.toBeNull();
    expect((await clients.sarah.from("notes").update({ folder: "Mine" }).eq("id", sharedNote)).error).not.toBeNull();
    expect((await clients.sarah.from("notes").update({ shared: false }).eq("id", sharedNote)).error).not.toBeNull();
    const remove = await clients.sarah.from("notes").delete().eq("id", sharedNote).select("id");
    expect(remove.data ?? []).toHaveLength(0);
    expect((await clients.josh.from("notes").update({ owner_id: ids.sarah }).eq("id", sharedNote)).error).not.toBeNull();
    expect((await clients.josh.from("notes").insert({ body: "Hers", owner_id: ids.sarah })).error).not.toBeNull();

    const pin = await clients.josh.from("notes").update({ pinned: true, folder: "Trips" }).eq("id", sharedNote).select("pinned, folder");
    expect(pin.data?.[0]).toEqual({ pinned: true, folder: "Trips" });
  });

  it("a save made from an old copy finds nothing to change (NOTE-009)", async () => {
    const { data: before } = await clients.josh.from("notes").select("updated_at").eq("id", sharedNote).single();
    await clients.sarah.from("notes").update({ body: "Packing\n☑ Socks\n☐ Hats" }).eq("id", sharedNote);
    const stale = await clients.josh.from("notes").update({ body: "Old copy" }).eq("id", sharedNote).eq("updated_at", before!.updated_at).select("id");
    expect(stale.data ?? []).toHaveLength(0);
  });

  it("unsharing hides it again, and moving out of the Home stops seeing it", async () => {
    await clients.josh.from("notes").update({ shared: false }).eq("id", sharedNote);
    expect(await sees("sarah", sharedNote)).toBe(false);
    await clients.josh.from("notes").update({ shared: true }).eq("id", sharedNote);
    expect(await sees("sarah", sharedNote)).toBe(true);

    await clients.sarah.rpc("leave_home");
    expect(await sees("sarah", sharedNote)).toBe(false);
  });
});
