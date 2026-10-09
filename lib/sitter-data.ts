import { useFocusEffect } from "expo-router";
import { useCallback, useEffect, useState } from "react";

import { guarded } from "./feedback";
import { displayName } from "./gift-nook";
import { localDay } from "./pets";
import { linkState, type SitterLink, type SitterSheet } from "./sitter";
import { supabase } from "./supabase";

// Loads your Home's Sitter Sheet and its links (SIT-001..008). Row level
// security means only your Home's come back.

export type SitterData = {
  homeId: string;
  // Null until someone in the Home fills it in.
  sheet: SitterSheet | null;
  links: SitterLink[];
  // What can be picked onto a link (SIT-006).
  kids: { id: string; name: string }[];
  pets: { id: string; name: string; species: string }[];
  names: Map<string, string>;
  today: string;
};

export async function loadSitter(): Promise<SitterData> {
  const { data: homeId, error: homeError } = await supabase.rpc("my_home");
  if (homeError) throw homeError;

  const [sheetResult, linksResult, kidsResult, petsResult] = await Promise.all([
    supabase.from("sitter_sheets").select("*").eq("home_id", homeId).maybeSingle(),
    supabase.from("sitter_links").select("*").eq("home_id", homeId).order("created_at", { ascending: false }).limit(100),
    supabase.rpc("home_kids"),
    supabase.from("pets").select("id, name, species").eq("home_id", homeId).order("name"),
  ]);
  if (sheetResult.error) throw sheetResult.error;
  if (linksResult.error) throw linksResult.error;

  const links = (linksResult.data ?? []) as SitterLink[];
  const ids = [...new Set(links.map((l) => l.created_by).filter(Boolean) as string[])];
  const { data: profiles } = ids.length
    ? await supabase.from("profiles").select("id, display_name").in("id", ids)
    : { data: [] };

  return {
    homeId,
    sheet: (sheetResult.data as SitterSheet | null) ?? null,
    links,
    kids: ((kidsResult.data ?? []) as { id: string; display_name: string | null }[]).map((k) => ({ id: k.id, name: displayName(k) })),
    pets: (petsResult.data ?? []) as SitterData["pets"],
    names: new Map(((profiles ?? []) as { id: string; display_name: string | null }[]).map((p) => [p.id, displayName(p)])),
    today: localDay(),
  };
}

// The Home's sheet for a screen, fresh each time it comes into view.
export function useSitter(userId: string | undefined) {
  const [data, setData] = useState<SitterData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const reload = useCallback(
    () =>
      userId
        ? guarded(
            async () => {
              setData(await loadSitter());
              setError(null);
            },
            setError,
            () => setIsLoading(false)
          )
        : Promise.resolve(),
    [userId]
  );

  useFocusEffect(
    useCallback(() => {
      reload();
    }, [reload])
  );

  return { data, error, isLoading, reload };
}

// --- Changes -------------------------------------------------------------------------------

export type SheetFields = Pick<
  SitterSheet,
  "address" | "contacts" | "doctor_name" | "doctor_phone" | "routine" | "bedtime" | "rules" | "food" | "wifi_name" | "wifi_password" | "places" | "codes" | "notes"
>;

export async function saveSheet(homeId: string, fields: SheetFields, exists: boolean) {
  const { error } = exists
    ? await supabase.from("sitter_sheets").update(fields).eq("home_id", homeId)
    : await supabase.from("sitter_sheets").insert({ home_id: homeId, ...fields });
  return { error };
}

export async function switchOffLink(linkId: string) {
  const { error } = await supabase.from("sitter_links").update({ revoked_at: new Date().toISOString() }).eq("id", linkId);
  return { error };
}

export async function removeLink(linkId: string) {
  const { error } = await supabase.from("sitter_links").delete().eq("id", linkId);
  return { error };
}

// What the sitter sees, exactly as their page gets it (SIT-007). Opening it
// from inside the Home doesn't count as a visit.
export type SitterView = {
  label: string;
  starts_on: string;
  ends_on: string;
  expires_at: string;
  address?: string | null;
  contacts?: { name: string; phone: string; note?: string }[];
  doctor_name?: string | null;
  doctor_phone?: string | null;
  routine?: { time: string; what: string }[];
  bedtime?: string | null;
  wifi_name?: string | null;
  wifi_password?: string | null;
  places?: string | null;
  codes?: string | null;
  rules?: string | null;
  food?: string | null;
  notes?: string | null;
  kids: { name: string; allergies: string[]; diets: string[] }[];
  // Kids on the link who are sick right now (SICK-010), if ticked.
  sick?: {
    name: string;
    what: string | null;
    since: string;
    temp: { temp_c: number; at: string } | null;
    medicines: { name: string; amount: string | null; every_hours: number | null; last_given: string; next_ok: string | null }[];
  }[];
  pets: {
    name: string;
    species: string;
    food: string | null;
    notes: string | null;
    vet_name: string | null;
    vet_phone: string | null;
    meals: { label: string; time: string | null }[];
    medications: { title: string; notes: string | null }[];
  }[];
};

export async function previewLink(token: string) {
  const { data, error } = await supabase.rpc("sitter_sheet_for_link", { link: token });
  return { view: (data as SitterView | null) ?? null, error };
}

// --- What the Hearth shows (SIT-009) -------------------------------------------------------

export type SitterSummary = {
  // Whether anything's written on the sheet yet.
  started: boolean;
  // Links out now or starting soon, ending soonest first.
  live: { id: string; label: string; ends_on: string; starts_on: string; views: number; upcoming: boolean }[];
};

export async function loadSitterSummary(): Promise<SitterSummary> {
  const { data: homeId, error } = await supabase.rpc("my_home");
  if (error) throw error;
  const [sheet, links] = await Promise.all([
    supabase.from("sitter_sheets").select("home_id").eq("home_id", homeId).maybeSingle(),
    supabase
      .from("sitter_links")
      .select("id, label, starts_on, ends_on, expires_at, revoked_at, views")
      .eq("home_id", homeId)
      .is("revoked_at", null)
      .gt("expires_at", new Date().toISOString())
      .order("ends_on"),
  ]);
  const live = ((links.data ?? []) as Pick<SitterLink, "id" | "label" | "starts_on" | "ends_on" | "expires_at" | "revoked_at" | "views">[])
    .map((l) => ({ ...l, state: linkState(l) }))
    .filter((l) => l.state === "active" || l.state === "upcoming")
    .map((l) => ({ id: l.id, label: l.label, ends_on: l.ends_on, starts_on: l.starts_on, views: l.views, upcoming: l.state === "upcoming" }));
  return { started: Boolean(sheet.data), live };
}

export function useSitterSummary(userId: string | undefined, refreshKey: number) {
  const [summary, setSummary] = useState<SitterSummary | null>(null);

  useEffect(() => {
    if (!userId) return;
    let live = true;
    loadSitterSummary()
      .then((s) => live && setSummary(s))
      .catch(() => live && setSummary(null));
    return () => {
      live = false;
    };
  }, [userId, refreshKey]);

  return summary;
}
