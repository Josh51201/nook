import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

// HOME-006: a Home holds at most 6 people. Same setup as the other *-rls
// tests (needs .env plus SUPABASE_SERVICE_ROLE_KEY in .env.test.local);
// skipped without them.

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL;
const ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const canRun = Boolean(SUPABASE_URL && ANON_KEY && SERVICE_ROLE_KEY);

describe.runIf(canRun)("A Home holds up to 6 people", () => {
  let admin: SupabaseClient;
  const runId = Date.now();
  const ids: string[] = [];
  const clients: SupabaseClient[] = [];
  let homeId: string;

  beforeAll(async () => {
    admin = createClient(SUPABASE_URL!, SERVICE_ROLE_KEY!, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    // Eight people: 0 owns the Home, 1–5 fill it, 6 and 7 are left over.
    for (let i = 0; i < 8; i++) {
      const email = `homecap-${i}-${runId}@example.com`;
      const password = `homecap-${i}-pw!`;
      const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
      if (error || !data.user) throw error;
      ids.push(data.user.id);
      const client = createClient(SUPABASE_URL!, ANON_KEY!, {
        auth: { autoRefreshToken: false, persistSession: false },
      });
      const { error: signInError } = await client.auth.signInWithPassword({ email, password });
      if (signInError) throw signInError;
      clients.push(client);
    }

    const { data: burrow } = await clients[0].rpc("create_burrow", { burrow_name: `Cap ${runId}` });
    const { data: code } = await clients[0].rpc("create_knock", { target_burrow: burrow });
    for (let i = 1; i < 8; i++) await clients[i].rpc("answer_knock", { knock_code: code });

    const { data: home } = await clients[0].rpc("my_home");
    homeId = home;
    for (let i = 1; i <= 5; i++) {
      const { data: invite, error } = await clients[0].rpc("invite_to_home", { target: ids[i] });
      if (error) throw error;
      const { error: joinError } = await clients[i].rpc("accept_home_invite", { invite_id: invite });
      if (joinError) throw joinError;
    }
  });

  afterAll(async () => {
    for (const id of ids) await admin.auth.admin.deleteUser(id);
  });

  it("six people fit", async () => {
    const { count } = await admin.from("home_members").select("*", { count: "exact", head: true }).eq("home_id", homeId);
    expect(count).toBe(6);
  });

  it("a seventh can't be invited", async () => {
    const { error } = await clients[0].rpc("invite_to_home", { target: ids[6] });
    expect(error?.message).toMatch(/full/i);
  });

  it("a seventh can't join even with an invite already out", async () => {
    // An invite that predates the Home filling up (added directly).
    const { data: invite } = await admin
      .from("home_invites")
      .insert({ home_id: homeId, invited: ids[7], invited_by: ids[0] })
      .select("id")
      .single();
    // The invite itself is refused while full; if it somehow existed, joining is too.
    if (invite) {
      const { error } = await clients[7].rpc("accept_home_invite", { invite_id: invite.id });
      expect(error?.message).toMatch(/full/i);
    }
    const { count } = await admin.from("home_members").select("*", { count: "exact", head: true }).eq("home_id", homeId);
    expect(count).toBe(6);
  });

  it("someone leaving makes room again", async () => {
    const { error: leaveError } = await clients[5].rpc("leave_home");
    expect(leaveError).toBeNull();
    const { data: invite, error } = await clients[0].rpc("invite_to_home", { target: ids[6] });
    expect(error).toBeNull();
    const { error: joinError } = await clients[6].rpc("accept_home_invite", { invite_id: invite });
    expect(joinError).toBeNull();
  });
});
