import { describe, expect, it } from "vitest";

import { MAX_CUSTOM_THEMES, type CustomTheme } from "../lib/custom-theme";
import { defaultHearthLayout, type HearthItem, type HearthLayout } from "../lib/hearth-layout";
import { addAndSwitch, MAX_SCENES, type ScenesState } from "../lib/hearth-scenes";
import {
  cleanCode,
  isFullCode,
  isHearthLook,
  lookAsSnapshot,
  lookSummary,
  packLook,
  receiveTheme,
  sceneNameFor,
  type SharedHearth,
} from "../lib/hearth-share";
import { defaultWidget, type WidgetConfig } from "../lib/widgets";

// Share a look (CORE-055).

const widget = (id: string, config: WidgetConfig): HearthItem => ({ id, kind: "widget", x: 0, y: 0, w: 2, h: 2, widget: config });

const reminders = { ...defaultWidget("reminders"), settings: { hideDone: false, items: [{ id: "r1", text: "Call the doctor", done: false }] } } as WidgetConfig;
const streak = { ...defaultWidget("streak"), settings: { name: "Walk", days: ["2026-10-08"] } } as WidgetConfig;
const frame = { ...defaultWidget("frame"), settings: { photos: ["me/a.jpg"], style: "wood", seconds: 12, caption: "Us" } } as WidgetConfig;
const pet = { ...defaultWidget("companion"), settings: { ...(defaultWidget("companion").settings as object), petId: "pet-1", photo: true } } as WidgetConfig;
const note = { ...defaultWidget("note"), settings: { text: "Be kind", textSize: "medium", align: "left" } } as WidgetConfig;

const myTheme: CustomTheme = { id: "custom-1", name: "Cocoa", dark: false, background: "#f6eadb", accent: "#7a4a2e" };

const layout: HearthLayout = {
  ...defaultHearthLayout,
  theme: "custom-1",
  customThemes: [myTheme],
  wallpaper: { kind: "photo", path: "me/wall.jpg", dim: 0.4 },
  ambience: "snow",
  pages: [
    { id: "main", name: "Everyday" },
    { id: "p2", name: "Holidays" },
  ],
  activePage: "main",
  items: [
    widget("w1", reminders),
    widget("w2", streak),
    widget("w3", frame),
    widget("w4", note),
    {
      id: "h1",
      kind: "hollow",
      name: "Den",
      look: "stump",
      wallpaper: { kind: "photo", path: "me/den.jpg", dim: 0.3 },
      items: [widget("w5", pet)],
      x: 0,
      y: 2,
      w: 2,
      h: 2,
    } as HearthItem,
  ],
  otherPages: { p2: [widget("w6", reminders)] },
};

describe("packing a look", () => {
  it("just the theme carries colors, wallpaper and ambience, never your photo", () => {
    const look = packLook(layout, "theme");
    expect(isHearthLook(look)).toBe(false);
    expect(look.custom).toEqual({ name: "Cocoa", dark: false, background: "#f6eadb", accent: "#7a4a2e" });
    expect(look.wallpaper).toEqual({ kind: "none" });
    expect(look.ambience).toBe("snow");
  });

  it("a whole Hearth leaves private things behind", () => {
    const look = packLook(layout, "hearth") as SharedHearth;
    const json = JSON.stringify(look);
    expect(json).not.toContain("Call the doctor");
    expect(json).not.toContain("2026-10-08");
    expect(json).not.toContain("me/");
    expect(json).not.toContain("pet-1");
    // Decoration stays: a note's words, the Hollow, every page.
    expect(json).toContain("Be kind");
    expect(look.pages).toHaveLength(2);
    expect(look.otherPages.p2).toHaveLength(1);
    const hollow = look.items.find((i) => i.kind === "hollow");
    expect(hollow && hollow.kind === "hollow" && hollow.wallpaper).toBeUndefined();
    expect(lookSummary(look)).toBe("2 pages, 7 things on them, in the Cocoa theme");
  });

  it("doesn't change your own Hearth", () => {
    packLook(layout, "hearth");
    expect(layout.items[0].kind === "widget" && JSON.stringify(layout.items[0].widget)).toContain("Call the doctor");
  });
});

describe("receiving a theme", () => {
  it("a built-in theme is just switched on", () => {
    expect(receiveTheme({ theme: "sage", wallpaper: { kind: "none" }, ambience: "off" }, [], "Sarah")).toEqual({ theme: "sage", customThemes: [] });
    expect(receiveTheme({ theme: "glitter", wallpaper: { kind: "none" }, ambience: "off" }, [], "Sarah")?.theme).toBe("hearth");
  });

  it("a custom theme is added to yours, or reused if you have the same one", () => {
    const look = packLook(layout, "theme");
    const added = receiveTheme(look, [], "Sarah")!;
    expect(added.customThemes).toHaveLength(1);
    expect(added.theme).toBe(added.customThemes[0].id);
    expect(added.customThemes[0].name).toBe("Cocoa");

    const again = receiveTheme(look, added.customThemes, "Sarah")!;
    expect(again.customThemes).toHaveLength(1);
    expect(again.theme).toBe(added.theme);
  });

  it("a name you already use gets theirs added", () => {
    const mine = [{ ...myTheme, id: "custom-x", background: "#ffffff" }];
    const added = receiveTheme(packLook(layout, "theme"), mine, "Sarah")!;
    expect(added.customThemes[1].name).toBe("Cocoa (Sarah)");
  });

  it("no room for another custom theme says so", () => {
    const full = Array.from({ length: MAX_CUSTOM_THEMES }, (_, i) => ({ ...myTheme, id: `c${i}`, accent: `#10203${i}` }));
    expect(receiveTheme(packLook(layout, "theme"), full, "Sarah")).toBeNull();
  });
});

describe("trying a whole Hearth as a scene", () => {
  const look = packLook(layout, "hearth") as SharedHearth;
  const snapshot = lookAsSnapshot(look, "sage");

  it("is a tidy snapshot in the theme you were given", () => {
    expect(snapshot.theme).toBe("sage");
    expect(snapshot.pages.map((p) => p.name)).toEqual(["Everyday", "Holidays"]);
    expect(snapshot.ambience).toBe("snow");
  });

  it("switches on, and the Hearth you were on is kept", () => {
    const empty: ScenesState = { scenes: [], active: null };
    const result = addAndSwitch(empty, { ...defaultHearthLayout, title: "Mine" }, sceneNameFor("Sarah Smith"), snapshot)!;
    expect(result.state.active).toBe(result.id);
    expect(result.state.scenes.map((s) => s.name).sort()).toEqual(["My Hearth", "Sarah's Hearth"]);
    expect(result.show).toBe(snapshot);
  });

  it("needs room for both", () => {
    const scenes = Array.from({ length: MAX_SCENES - 1 }, (_, i) => ({ id: `s${i}`, name: `S${i}`, snapshot }));
    // Not on a saved scene: needs two spots, only one left.
    expect(addAndSwitch({ scenes, active: null }, defaultHearthLayout, "X", snapshot)).toBeNull();
    // On a saved scene: it's updated in place, so one spot is enough.
    expect(addAndSwitch({ scenes, active: "s0" }, defaultHearthLayout, "X", snapshot)).not.toBeNull();
  });
});

describe("codes", () => {
  it("are cleaned up as typed", () => {
    expect(cleanCode(" k7p-m3q ")).toBe("K7PM3Q");
    expect(isFullCode("K7PM3Q")).toBe(true);
    // Look-alikes aren't in codes.
    expect(isFullCode("K7PM3O")).toBe(false);
    expect(isFullCode("K7PM3")).toBe(false);
  });
});
