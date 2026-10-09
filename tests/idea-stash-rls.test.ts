import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

// Idea Stash (GIFT-036), enforced in Postgres: a note is visible to the
// person who wrote it and nobody else, including the person it's about.
// Same setup as gift-nook-rls.test.ts (needs .env plus SUPABASE_SERVICE_ROLE_KEY
// in .env.test.local); skipped without them.

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL;
const ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const canRun = Boolean(SUPABASE_URL && ANON_KEY && SERVICE_ROLE_KEY);

describe.runIf(canRun)("Idea Stash: only the writer ever sees a note", () => {
  let admin: SupabaseClient;
  const runId = Date.now();
  // josh writes about mom. dad shares the Burrow. stranger shares nothing.
  const people = ["josh", "mom", "dad", "stranger"] as const;
  type Person = (typeof people)[number];
  const ids = {} as Record<Person, string>;
  const clients = {} as Record<Person, SupabaseClient>;
  let ideaId: string;

  beforeAll(async () => {
    admin = createClient(SUPABASE_URL!, SERVICE_ROLE_KEY!, { auth: { autoRefreshToken: false, persistSession: false } });
    for (const person of people) {
      const email = `stash-${person}-${runId}@example.com`;
      const password = `stash-${person}-pw!`;
      const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
      if (error || !data.user) throw error;
      ids[person] = data.user.id;
      const client = createClient(SUPABASE_URL!, ANON_KEY!, { auth: { autoRefreshToken: false, persistSession: false } });
      const { error: signInError } = await client.auth.signInWithPassword({ email, password });
      if (signInError) throw signInError;
      clients[person] = client;
    }
    const { data: burrow } = await clients.josh.rpc("create_burrow", { burrow_name: `Stash ${runId}` });
    const { data: code } = await clients.josh.rpc("create_knock", { target_burrow: burrow });
    for (const person of ["mom", "dad"] as const) await clients[person].rpc("answer_knock", { knock_code: code });

    const { data, error } = await clients.josh
      .from("idea_stash")
      .insert({ about_id: ids.mom, title: "The blue teapot", notes: "She mentioned it twice", price: 40 })
      .select("id")
      .single();
    if (error) throw error;
    ideaId = data!.id;
  });

  afterAll(async () => {
    for (const person of people) await admin.auth.admin.deleteUser(ids[person]);
  });

  it("the writer sees their note", async () => {
    const { data } = await clients.josh.from("idea_stash").select("id, title").eq("id", ideaId);
    expect(data?.map((r) => r.title)).toEqual(["The blue teapot"]);
  });

  it("the person it's about sees nothing: no rows, no count", async () => {
    const { data } = await clients.mom.from("idea_stash").select("id");
    expect(data).toEqual([]);
    const { count } = await clients.mom.from("idea_stash").select("id", { count: "exact", head: true });
    expect(count).toBe(0);
  });

  it("others in the Burrow and strangers see nothing either", async () => {
    for (const person of ["dad", "stranger"] as const) {
      const { data } = await clients[person].from("idea_stash").select("id");
      expect(data).toEqual([]);
    }
  });

  it("nobody else can change or remove it", async () => {
    for (const person of ["mom", "dad", "stranger"] as const) {
      const updated = await clients[person].from("idea_stash").update({ title: "hacked" }).eq("id", ideaId).select("id");
      expect(updated.data ?? []).toEqual([]);
      const removed = await clients[person].from("idea_stash").delete().eq("id", ideaId).select("id");
      expect(removed.data ?? []).toEqual([]);
    }
    const { data } = await admin.from("idea_stash").select("title").eq("id", ideaId).single();
    expect(data?.title).toBe("The blue teapot");
  });

  it("notes can only be about people you share a Burrow with, never yourself", async () => {
    const stranger = await clients.josh.from("idea_stash").insert({ about_id: ids.stranger, title: "x" });
    expect(stranger.error).not.toBeNull();
    const self = await clients.josh.from("idea_stash").insert({ about_id: ids.josh, title: "x" });
    expect(self.error).not.toBeNull();
    const forged = await clients.dad.from("idea_stash").insert({ owner_id: ids.josh, about_id: ids.mom, title: "x" });
    expect(forged.error).not.toBeNull();
  });

  it("writing a note tells nobody anything", async () => {
    for (const person of ["mom", "dad"] as const) {
      const { data } = await clients[person].from("notifications").select("id, title, body");
      expect((data ?? []).filter((n) => /teapot|stash|idea/i.test(`${n.title} ${n.body}`))).toEqual([]);
    }
  });
});
