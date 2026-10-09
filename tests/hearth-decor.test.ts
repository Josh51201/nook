import { describe, expect, it } from "vitest";

import { deepOf, hexToHsl, hslToHex, isHex, pickerColor, pickerGreys, pickerHues, pickerTiers, shade } from "../lib/colors";
import {
  activeAmbience,
  autoAmbience,
  cornerRadius,
  effectiveWallpaper,
  liftLevel,
  wallpaperPath,
} from "../lib/decor";
import {
  addItem,
  copyItem,
  deepColor,
  defaultHearthLayout,
  migrateLayout,
  photoPathsInUse,
  shadowAtLevel,
  sizePresets,
  tilePalette,
  type HearthLayout,
} from "../lib/hearth-layout";
import { trinketInfo, trinkets } from "../lib/trinkets";
import { defaultWidget, widgetKinds, type WidgetConfig } from "../lib/widgets";

const layoutWith = (items: HearthLayout["items"], extra: Partial<HearthLayout> = {}): HearthLayout => ({
  ...defaultHearthLayout,
  ...extra,
  items,
});

describe("colors (CORE-042)", () => {
  it("round-trips a color through hue/saturation/lightness", () => {
    for (const hex of ["#f6d9c4", "#4f6b45", "#a3425f"]) {
      const { h, s, l } = hexToHsl(hex);
      const back = hexToHsl(hslToHex(h, s, l));
      expect(Math.abs(back.h - h)).toBeLessThan(2);
      expect(Math.abs(back.l - l)).toBeLessThan(0.01);
    }
  });

  it("every picker color is light enough for dark text, and its deep partner dark enough for white", () => {
    for (const hue of pickerHues) {
      for (let tier = 0; tier < pickerTiers.length; tier++) {
        const soft = pickerColor(hue, tier);
        expect(isHex(soft)).toBe(true);
        expect(hexToHsl(soft).l).toBeGreaterThan(0.74);
        expect(hexToHsl(deepOf(soft)).l).toBeLessThan(0.4);
      }
    }
  });

  it("Light, Soft and Rich give different deep colors for text and Bold looks (CORE-083)", () => {
    for (const hue of pickerHues) {
      const [light, soft, rich] = [0, 1, 2].map((tier) => deepOf(pickerColor(hue, tier)));
      expect(new Set([light, soft, rich]).size).toBe(3);
      // Rich is darker and more vivid than Light.
      expect(hexToHsl(rich).l).toBeLessThan(hexToHsl(light).l);
      expect(hexToHsl(rich).s).toBeGreaterThan(hexToHsl(light).s);
    }
  });

  it("greys get lighter and darker deep partners too", () => {
    const deeps = pickerGreys.map(deepOf);
    expect(new Set(deeps).size).toBe(pickerGreys.length);
    for (const deep of deeps) expect(hexToHsl(deep).l).toBeLessThan(0.43);
  });

  it("keeps the hand-picked deep colors for the classic seven, and works one out for any other", () => {
    expect(deepColor(tilePalette[1])).toBe("#b0552d");
    const custom = pickerColor(200, 1);
    expect(deepColor(custom)).toBe(deepOf(custom));
    expect(deepColor(undefined)).toBe("#8a5a3b");
    expect(deepColor("not a color")).toBe("#8a5a3b");
  });

  it("lightens and darkens without changing hue", () => {
    const base = "#6f9a5c";
    expect(hexToHsl(shade(base, 0.4)).l).toBeGreaterThan(hexToHsl(base).l);
    expect(hexToHsl(shade(base, -0.4)).l).toBeLessThan(hexToHsl(base).l);
    expect(Math.abs(hexToHsl(shade(base, 0.4)).h - hexToHsl(base).h)).toBeLessThan(3);
  });
});

describe("wallpaper (CORE-041)", () => {
  const hearth = { kind: "pattern", pattern: "dots", color: "#dfe8d6" } as const;

  it("a Hollow with none of its own wears the Hearth's; one with its own keeps it", () => {
    expect(effectiveWallpaper(hearth, undefined, true)).toBe(hearth);
    const own = { kind: "none" } as const;
    expect(effectiveWallpaper(hearth, own, true)).toBe(own);
    expect(effectiveWallpaper(hearth, own, false)).toBe(hearth);
    expect(effectiveWallpaper(undefined, undefined, false)).toEqual({ kind: "none" });
  });

  it("knows which photo a wallpaper uses", () => {
    expect(wallpaperPath({ kind: "photo", path: "u/a.jpg", dim: 0.4 })).toBe("u/a.jpg");
    expect(wallpaperPath(hearth)).toBeNull();
    expect(wallpaperPath(undefined)).toBeNull();
  });

  it("an older Hearth with no wallpaper or ambience gets the plain defaults", () => {
    const migrated = migrateLayout({ title: "Mine", items: [] });
    expect(migrated.wallpaper).toEqual({ kind: "none" });
    expect(migrated.ambience).toBe("off");
    const kept = migrateLayout({ wallpaper: hearth, ambience: "snow", items: [] });
    expect(kept.wallpaper).toEqual(hearth);
    expect(kept.ambience).toBe("snow");
  });
});

describe("ambience (CORE-047)", () => {
  const at = (month: number, hour: number) => new Date(2026, month, 15, hour);

  it("follows the season by day", () => {
    expect(autoAmbience(at(0, 12))).toBe("snow");
    expect(autoAmbience(at(11, 12))).toBe("snow");
    expect(autoAmbience(at(3, 12))).toBe("petals");
    expect(autoAmbience(at(6, 12))).toBe("motes");
    expect(autoAmbience(at(9, 12))).toBe("leaves");
  });

  it("is fireflies at night, whatever the season", () => {
    expect(autoAmbience(at(0, 22))).toBe("fireflies");
    expect(autoAmbience(at(6, 3))).toBe("fireflies");
    expect(autoAmbience(at(6, 5))).toBe("motes");
  });

  it("off shows nothing, a pick shows that, auto follows the clock", () => {
    expect(activeAmbience("off", at(0, 12))).toBeNull();
    expect(activeAmbience(undefined, at(0, 12))).toBeNull();
    expect(activeAmbience("leaves", at(0, 12))).toBe("leaves");
    expect(activeAmbience("auto", at(0, 12))).toBe("snow");
  });
});

describe("shape: corners and shadow (CORE-042)", () => {
  it("corners are never bigger than half the tile", () => {
    expect(cornerRadius("soft", 200, 200)).toBe(24);
    expect(cornerRadius("square", 200, 200)).toBe(10);
    expect(cornerRadius("round", 200, 200)).toBe(38);
    expect(cornerRadius("round", 60, 60)).toBe(30);
    expect(cornerRadius(undefined, 40, 40)).toBe(20);
  });

  it("shadow follows the pick, or the usual for the kind", () => {
    expect(liftLevel(undefined, true)).toBe(2);
    expect(liftLevel(undefined, false)).toBe(1);
    expect(liftLevel("flat", true)).toBe(0);
    expect(liftLevel("floating", false)).toBe(3);
  });

  it("flat has no shadow and floating is deeper than raised", () => {
    expect(shadowAtLevel("hearth", 0)).toBeUndefined();
    expect(shadowAtLevel("hearth", 1)).toContain("rgba");
    expect(shadowAtLevel("hearth", 3)).not.toBe(shadowAtLevel("hearth", 2));
  });
});

describe("Trinkets (CORE-045)", () => {
  it("every piece has a name, a color and a starting size", () => {
    for (const t of trinkets) {
      expect(t.label.length).toBeGreaterThan(0);
      expect(isHex(t.color)).toBe(true);
      expect(t.size.w).toBeGreaterThan(0);
      expect(trinketInfo(t.key).key).toBe(t.key);
    }
    expect(new Set(trinkets.map((t) => t.key)).size).toBe(trinkets.length);
  });

  it("can be added, sized and copied like anything else on the Hearth", () => {
    const info = trinketInfo("cat");
    let layout = layoutWith([]);
    layout = layoutWith(addItem(layout, { id: "t-1", kind: "trinket", piece: "cat", color: info.color, ...info.size }));
    expect(layout.items).toHaveLength(1);
    expect(sizePresets.trinket.length).toBeGreaterThan(0);

    const { items, copyId } = copyItem(layout, "t-1", null);
    expect(copyId).toMatch(/^t-/);
    expect(items).toHaveLength(2);
    expect(items.find((i) => i.id === copyId)).toMatchObject({ kind: "trinket", piece: "cat" });
  });
});

describe("Photo frame (CORE-046)", () => {
  it("is offered as a widget with no pictures and a wooden frame", () => {
    expect(widgetKinds.some((k) => k.kind === "frame")).toBe(true);
    const widget = defaultWidget("frame");
    expect(widget.kind).toBe("frame");
    if (widget.kind === "frame") {
      expect(widget.settings.photos).toEqual([]);
      expect(widget.settings.style).toBe("wood");
    }
  });

  it("knows every photo in use, so one is only deleted when nothing shows it", () => {
    const frame = (path: string[]) => ({
      id: `w-${path.join("")}`,
      kind: "widget" as const,
      x: 0,
      y: 0,
      w: 2,
      h: 2,
      widget: {
        kind: "frame",
        title: "",
        showTitle: false,
        look: "soft",
        settings: { photos: path, style: "wood", seconds: 12, caption: "" },
      } as WidgetConfig,
    });
    const layout = layoutWith(
      [
        frame(["u/a.jpg", "u/b.jpg"]),
        {
          id: "h-1",
          kind: "hollow",
          name: "Den",
          look: "house",
          x: 2,
          y: 0,
          w: 2,
          h: 2,
          wallpaper: { kind: "photo", path: "u/c.jpg", dim: 0.4 },
          items: [frame(["u/a.jpg", "u/d.jpg"])],
        },
      ],
      { wallpaper: { kind: "photo", path: "u/e.jpg", dim: 0.4 } }
    );
    expect([...photoPathsInUse(layout)].sort()).toEqual(["u/a.jpg", "u/b.jpg", "u/c.jpg", "u/d.jpg", "u/e.jpg"]);
  });
});

describe("fireplace sound (CORE-047)", () => {
  it("is off unless chosen, and never loud", async () => {
    const { fireVolume, fireSounds } = await import("../lib/decor");
    const { migrateLayout } = await import("../lib/hearth-layout");
    expect(fireVolume(undefined)).toBe(0);
    expect(fireVolume("off")).toBe(0);
    expect(Math.max(...fireSounds.map((f) => f.volume))).toBeLessThanOrEqual(0.5);
    expect(migrateLayout({}).fireSound).toBeUndefined();
    expect(migrateLayout({ fireSound: "soft" }).fireSound).toBe("soft");
  });
});
