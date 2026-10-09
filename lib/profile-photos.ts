import * as ImagePicker from "expo-image-picker";
import { useEffect, useReducer } from "react";
import { Alert } from "react-native";

import { supabase } from "./supabase";

// Profile photos (PROF-006): a real photo as your picture, instead of the
// icon or initials on a color. They live in the private "avatars" bucket at
// "<profile id>/<file>"; whoever can see a profile can see its photo, and
// only that person (or a kid's grown-ups) can change it.

const BUCKET = "avatars";

// Take or choose a square photo. Returns it (not uploaded yet), or null if
// they backed out.
export async function pickProfilePhoto(from: "camera" | "library"): Promise<{ uri: string; mimeType?: string | null } | null> {
  const permission =
    from === "camera" ? await ImagePicker.requestCameraPermissionsAsync() : await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!permission.granted) {
    Alert.alert("Nook can't reach your " + (from === "camera" ? "camera" : "photos"), "You can allow it in your phone's Settings.");
    return null;
  }
  const options: ImagePicker.ImagePickerOptions = { mediaTypes: ["images"], quality: 0.5, allowsEditing: true, aspect: [1, 1] };
  const result = from === "camera" ? await ImagePicker.launchCameraAsync(options) : await ImagePicker.launchImageLibraryAsync(options);
  const asset = result.canceled ? null : result.assets[0];
  return asset ? { uri: asset.uri, mimeType: asset.mimeType } : null;
}

export async function uploadProfilePhoto(profileId: string, uri: string, mimeType?: string | null) {
  const type = mimeType && /^image\/(jpeg|png|heic|webp)$/.test(mimeType) ? mimeType : "image/jpeg";
  const extension = type === "image/png" ? "png" : type === "image/heic" ? "heic" : type === "image/webp" ? "webp" : "jpg";
  const path = `${profileId}/${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}.${extension}`;
  const body = await (await fetch(uri)).arrayBuffer();
  const { error } = await supabase.storage.from(BUCKET).upload(path, body, { contentType: type });
  if (error) throw error;
  return path;
}

// Best effort: a photo left behind only takes up space.
export async function removeProfilePhoto(path: string | null | undefined) {
  if (path) await supabase.storage.from(BUCKET).remove([path]).catch(() => {});
}

// --- Showing them ----------------------------------------------------------------------
// A screen can show dozens of faces, so links are asked for together (one
// request per moment, not one per face) and remembered for most of an hour.
// A photo you can't see (or that's gone) is remembered as missing, and the
// face falls back to the icon or initials.

type Entry = { url: string | null; expires: number };
const cache = new Map<string, Entry>();
const pending = new Set<string>();
const listeners = new Set<() => void>();
let flushing: ReturnType<typeof setTimeout> | null = null;

function flush() {
  flushing = null;
  const paths = [...pending];
  pending.clear();
  if (!paths.length) return;
  supabase.storage
    .from(BUCKET)
    .createSignedUrls(paths, 3600)
    .then(({ data }) => {
      const now = Date.now();
      const found = new Map((data ?? []).filter((d) => d.path && d.signedUrl && !d.error).map((d) => [d.path!, d.signedUrl]));
      // Missing ones are tried again after a few minutes, in case it was the connection.
      for (const path of paths) {
        const url = found.get(path) ?? null;
        cache.set(path, { url, expires: now + (url ? 50 : 5) * 60 * 1000 });
      }
      listeners.forEach((listener) => listener());
    })
    .catch(() => {
      for (const path of paths) cache.set(path, { url: null, expires: Date.now() + 60 * 1000 });
      listeners.forEach((listener) => listener());
    });
}

function request(path: string) {
  const entry = cache.get(path);
  if (entry && entry.expires > Date.now()) return;
  pending.add(path);
  if (!flushing) flushing = setTimeout(flush, 0);
}

// A link to show this photo: a string once it's ready, null if it can't be
// shown, undefined while it's on its way.
export function useProfilePhotoUrl(path: string | null | undefined): string | null | undefined {
  const [, rerender] = useReducer((n: number) => n + 1, 0);
  useEffect(() => {
    if (!path) return;
    listeners.add(rerender);
    request(path);
    return () => {
      listeners.delete(rerender);
    };
  }, [path]);
  if (!path) return null;
  const entry = cache.get(path);
  return entry ? entry.url : undefined;
}

// A photo you just chose shows straight away, before the round trip.
export function rememberProfilePhoto(path: string, localUri: string) {
  cache.set(path, { url: localUri, expires: Date.now() + 50 * 60 * 1000 });
}
