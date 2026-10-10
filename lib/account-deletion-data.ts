import type { DeletionPreview } from "./account-deletion";
import { supabase } from "./supabase";

// Deleting your account (AUTH-003): asking the database what will happen,
// tidying the photos it can't reach, and deleting. The words are in
// account-deletion.ts.

export async function loadDeletionPreview(): Promise<DeletionPreview> {
  const { data, error } = await supabase.rpc("my_account_deletion_preview");
  if (error) throw error;
  const raw = (data ?? {}) as Partial<DeletionPreview>;
  return {
    kids: Array.isArray(raw.kids) ? raw.kids : [],
    burrows: Array.isArray(raw.burrows) ? raw.burrows : [],
    tucks: Number(raw.tucks ?? 0),
  };
}

// Photos live in storage, which the database function can't reach, so clear
// them first. Best effort: a photo left behind only takes up space, and must
// never stop someone deleting their account.
async function removeFolder(bucket: string, folder: string) {
  try {
    const { data } = await supabase.storage.from(bucket).list(folder, { limit: 1000 });
    const paths = (data ?? []).filter((file) => file.name).map((file) => `${folder}/${file.name}`);
    if (paths.length) await supabase.storage.from(bucket).remove(paths);
  } catch {
    // ignore
  }
}

export async function deleteMyAccount(userId: string, preview: DeletionPreview) {
  await Promise.all([
    removeFolder("hearth", userId),
    removeFolder("avatars", userId),
    ...preview.kids.map((kid) => removeFolder("avatars", kid.id)),
  ]);
  const { error } = await supabase.rpc("delete_my_account");
  if (error) throw error;
  // The login no longer exists, so only clear this phone's copy of it.
  await supabase.auth.signOut({ scope: "local" });
}
