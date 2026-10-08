import * as ImagePicker from "expo-image-picker";
import { useEffect, useState } from "react";
import { Alert } from "react-native";

import { photoPathsInUse, type HearthLayout } from "./hearth-layout";
import { supabase } from "./supabase";

// Your own photos on the Hearth (CORE-041, CORE-046): wallpaper pictures and
// the pictures in Photo frame widgets. Private to you, in the "hearth"
// storage bucket under your own user id.

const BUCKET = "hearth";

// Pick a photo from the library and upload it. Returns its storage path, or
// null if you backed out or it couldn't be added.
// `folder` is your own (your user id) unless the photo is for the Home page
// (CORE-054), whose photos everyone in the Home can see.
export async function pickAndUploadPhoto(userId: string, folder: string = userId): Promise<string | null> {
  const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!permission.granted) {
    Alert.alert("Photos are off", "Allow Nook to use your photos in your phone's Settings to add one.");
    return null;
  }
  const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], quality: 0.6 });
  if (result.canceled || !result.assets[0]) return null;
  const asset = result.assets[0];

  const type = asset.mimeType && asset.mimeType.startsWith("image/") ? asset.mimeType : "image/jpeg";
  const extension = type === "image/png" ? "png" : type === "image/heic" ? "heic" : type === "image/webp" ? "webp" : "jpg";
  const path = `${folder}/${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}.${extension}`;
  try {
    const body = await (await fetch(asset.uri)).arrayBuffer();
    const { error } = await supabase.storage.from(BUCKET).upload(path, body, { contentType: type });
    if (error) throw error;
    return path;
  } catch (error) {
    Alert.alert("Couldn't add that photo", (error as Error).message || "Check your connection and try again.");
    return null;
  }
}

export async function removePhotos(paths: string[]) {
  const unique = [...new Set(paths.filter(Boolean))];
  if (unique.length) await supabase.storage.from(BUCKET).remove(unique);
}

// Copy photos between your folder and the Home's (CORE-054). Returns the
// copies that couldn't be made; one that's already there counts as made.
export async function copyPhotos(copies: { from: string; to: string }[]): Promise<Set<string>> {
  const failed = new Set<string>();
  await Promise.all(
    copies.map(async ({ from, to }) => {
      const { error } = await supabase.storage.from(BUCKET).copy(from, to);
      if (error && !/exist|duplicate/i.test(error.message)) failed.add(to);
    })
  );
  return failed;
}

// Photos that scenes (CORE-052) that aren't showing still need. The Hearth
// screen keeps this up to date, so they aren't cleaned up as unused.
let keptForScenes = new Set<string>();
export function keepPhotosForScenes(paths: string[]) {
  keptForScenes = new Set(paths);
}

// Delete photos that nothing uses any more (a copied widget shares its
// photos, so a photo is only deleted once no copy still shows it).
export async function removeUnusedPhotos(candidates: string[], layout: Pick<HearthLayout, "wallpaper" | "items"> & { otherPages?: HearthLayout["otherPages"] }) {
  const used = photoPathsInUse(layout);
  for (const path of keptForScenes) used.add(path);
  await removePhotos(candidates.filter((path) => !used.has(path)));
}

// --- Showing them ----------------------------------------------------------------------

const urlCache = new Map<string, { url: string; expires: number }>();

// Short-lived links to private photos, remembered for most of an hour.
export async function photoUrls(paths: string[]): Promise<Map<string, string>> {
  const now = Date.now();
  const wanted = [...new Set(paths.filter(Boolean))];
  const missing = wanted.filter((path) => (urlCache.get(path)?.expires ?? 0) < now);
  if (missing.length) {
    const { data } = await supabase.storage.from(BUCKET).createSignedUrls(missing, 3600);
    for (const entry of data ?? []) {
      if (entry.signedUrl && entry.path) urlCache.set(entry.path, { url: entry.signedUrl, expires: now + 50 * 60 * 1000 });
    }
  }
  return new Map(wanted.flatMap((path) => (urlCache.get(path) ? [[path, urlCache.get(path)!.url] as const] : [])));
}

export function usePhotoUrls(paths: string[]) {
  const [urls, setUrls] = useState<Map<string, string>>(new Map());
  const key = paths.join("|");
  useEffect(() => {
    let live = true;
    if (!paths.length) {
      setUrls(new Map());
      return;
    }
    photoUrls(paths).then((found) => live && setUrls(found));
    return () => {
      live = false;
    };
  }, [key]);
  return urls;
}
