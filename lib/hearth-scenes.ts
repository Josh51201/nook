import type { Ambience, Wallpaper } from "./decor";
import type { HearthItem, HearthLayout, HearthPage, HearthThemeKey } from "./hearth-layout";
import { wallpaperPath } from "./decor";
import { inSeason, type ShowIn } from "./widget-extras";

// Scenes (CORE-052): save how your whole Hearth looks (its pages and
// everything on them, the theme, wallpaper and ambience) under a name, like
// Morning, Evening or Christmas, and swap it in by hand or on a schedule.
//
// Scenes work like wardrobes: the Hearth you see is the active scene. When
// you switch, the one you're leaving is saved back into its scene, so nothing
// is ever lost. If the Hearth you're on isn't a scene yet, it's saved as one
// first. Scenes are kept in their own saved row, so editing your Hearth
// doesn't rewrite them. Pure helpers, no React.

export const MAX_SCENES = 6;

export type SceneSnapshot = {
  theme: HearthThemeKey;
  wallpaper: Wallpaper;
  ambience: Ambience;
  pages: HearthPage[];
  activePage: string;
  otherPages: Record<string, HearthItem[]>;
  items: HearthItem[];
};

export type DayPart = "morning" | "afternoon" | "evening" | "night";

// When a scene switches on by itself: a part of the day, some months, or both.
export type SceneSchedule = { part?: DayPart; months?: ShowIn };

export type Scene = { id: string; name: string; snapshot: SceneSnapshot; schedule?: SceneSchedule };

export type ScenesState = { scenes: Scene[]; active: string | null };

export const defaultScenes: ScenesState = { scenes: [], active: null };

export const dayParts: { part: DayPart; label: string; hours: string }[] = [
  { part: "morning", label: "Morning", hours: "5 AM – noon" },
  { part: "afternoon", label: "Afternoon", hours: "noon – 5 PM" },
  { part: "evening", label: "Evening", hours: "5 PM – 10 PM" },
  { part: "night", label: "Night", hours: "10 PM – 5 AM" },
];

export function dayPartOf(now: Date): DayPart {
  const hour = now.getHours();
  if (hour >= 5 && hour < 12) return "morning";
  if (hour >= 12 && hour < 17) return "afternoon";
  if (hour >= 17 && hour < 22) return "evening";
  return "night";
}

let counter = 0;
function newSceneId() {
  counter += 1;
  return `sc-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}${counter}`;
}

const cleanName = (name: string) => name.trim().replace(/\s+/g, " ").slice(0, 20);

export function snapshotOf(layout: HearthLayout): SceneSnapshot {
  return {
    theme: layout.theme,
    wallpaper: layout.wallpaper,
    ambience: layout.ambience,
    pages: layout.pages,
    activePage: layout.activePage,
    otherPages: layout.otherPages,
    items: layout.items,
  };
}

// What to save to the Hearth to show this scene.
export function layoutChangesOf(snapshot: SceneSnapshot): SceneSnapshot {
  return { ...snapshot };
}

// Saves how the Hearth looks right now as a new scene, which becomes the
// active one. Null if there are already as many as allowed.
export function saveScene(state: ScenesState, layout: HearthLayout, name: string): { state: ScenesState; id: string } | null {
  if (state.scenes.length >= MAX_SCENES) return null;
  const id = newSceneId();
  const scene: Scene = { id, name: cleanName(name) || `Scene ${state.scenes.length + 1}`, snapshot: snapshotOf(layout) };
  return { state: { scenes: [...state.scenes, scene], active: id }, id };
}

// Switch to a scene. The Hearth you're leaving is stored back into its scene
// (or, if it isn't one yet, saved as a new one called "My Hearth"). Returns
// the new scenes and what the Hearth should become; null if the scene isn't
// there, it's already active, or there's no room to keep the current one.
export function switchScene(
  state: ScenesState,
  layout: HearthLayout,
  targetId: string
): { state: ScenesState; show: SceneSnapshot } | null {
  const target = state.scenes.find((s) => s.id === targetId);
  if (!target || state.active === targetId) return null;
  let scenes = state.scenes;
  const current = snapshotOf(layout);
  if (state.active && scenes.some((s) => s.id === state.active)) {
    scenes = scenes.map((s) => (s.id === state.active ? { ...s, snapshot: current } : s));
  } else {
    if (scenes.length >= MAX_SCENES) return null;
    scenes = [...scenes, { id: newSceneId(), name: "My Hearth", snapshot: current }];
  }
  return { state: { scenes, active: targetId }, show: target.snapshot };
}

export function renameScene(state: ScenesState, id: string, name: string): ScenesState {
  const clean = cleanName(name);
  if (!clean) return state;
  return { ...state, scenes: state.scenes.map((s) => (s.id === id ? { ...s, name: clean } : s)) };
}

export function setSchedule(state: ScenesState, id: string, schedule: SceneSchedule | undefined): ScenesState {
  const empty = !schedule || (!schedule.part && !schedule.months);
  return {
    ...state,
    scenes: state.scenes.map((s) => (s.id === id ? { ...s, schedule: empty ? undefined : schedule } : s)),
  };
}

// Removing a scene doesn't touch the Hearth you're looking at; if it was the
// active one, the Hearth just isn't a saved scene any more.
export function removeScene(state: ScenesState, id: string): ScenesState {
  return { scenes: state.scenes.filter((s) => s.id !== id), active: state.active === id ? null : state.active };
}

export function scheduleMatches(schedule: SceneSchedule | undefined, now: Date): boolean {
  if (!schedule || (!schedule.part && !schedule.months)) return false;
  if (schedule.part && dayPartOf(now) !== schedule.part) return false;
  if (schedule.months && !inSeason(schedule.months, now)) return false;
  return true;
}

// The scene whose schedule fits right now. With several, the most specific
// (part of day and months both) wins, then the first made.
export function sceneForNow(state: ScenesState, now: Date): Scene | null {
  const matching = state.scenes.filter((s) => scheduleMatches(s.schedule, now));
  const specific = (s: Scene) => (s.schedule?.part ? 1 : 0) + (s.schedule?.months ? 1 : 0);
  return [...matching].sort((a, b) => specific(b) - specific(a))[0] ?? null;
}

export function scheduleWords(schedule: SceneSchedule | undefined, monthsText: (m: ShowIn | undefined) => string): string {
  if (!schedule || (!schedule.part && !schedule.months)) return "By hand only";
  const part = schedule.part ? dayParts.find((d) => d.part === schedule.part)?.label : null;
  const months = schedule.months ? monthsText(schedule.months) : null;
  return [part, months].filter(Boolean).join(", ");
}

// Wallpaper photos kept in scenes that aren't showing, so they aren't
// cleaned up as "unused" while a scene still needs them.
export function scenePhotoPaths(state: ScenesState): string[] {
  const paths: string[] = [];
  const walk = (items: HearthItem[]) => {
    for (const item of items) {
      if (item.kind === "hollow") {
        const own = wallpaperPath(item.wallpaper);
        if (own) paths.push(own);
        walk(item.items);
      } else if (item.kind === "widget" && item.widget.kind === "frame") {
        paths.push(...item.widget.settings.photos);
      }
    }
  };
  for (const scene of state.scenes) {
    const wp = wallpaperPath(scene.snapshot.wallpaper);
    if (wp) paths.push(wp);
    walk([...scene.snapshot.items, ...Object.values(scene.snapshot.otherPages).flat()]);
  }
  return paths;
}
