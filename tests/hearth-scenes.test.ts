import { describe, expect, it } from "vitest";

import { defaultHearthLayout, type HearthItem, type HearthLayout } from "../lib/hearth-layout";
import {
  dayPartOf,
  defaultScenes,
  MAX_SCENES,
  removeScene,
  renameScene,
  saveScene,
  sceneForNow,
  scenePhotoPaths,
  setSchedule,
  snapshotOf,
  switchScene,
  type ScenesState,
} from "../lib/hearth-scenes";
import { defaultWidget } from "../lib/widgets";

// Scenes (CORE-052).

const card = (id: string): HearthItem => ({ id, kind: "nook", nookId: id, x: 0, y: 0, w: 2, h: 2 });
const hearthWith = (items: HearthItem[], extra: Partial<HearthLayout> = {}): HearthLayout => ({ ...defaultHearthLayout, items, ...extra });
const at = (hour: number, month = 6) => new Date(2026, month - 1, 15, hour, 0, 0);

describe("Scenes (CORE-052)", () => {
  it("saves how the Hearth looks as a scene and makes it the active one", () => {
    const layout = hearthWith([card("a")], { theme: "dusk" });
    const saved = saveScene(defaultScenes, layout, "  Evening  ")!;
    expect(saved.state.active).toBe(saved.id);
    expect(saved.state.scenes[0].name).toBe("Evening");
    expect(saved.state.scenes[0].snapshot.theme).toBe("dusk");
    expect(saved.state.scenes[0].snapshot.items.map((i) => i.id)).toEqual(["a"]);
  });

  it("names an unnamed scene, and stops at the most scenes", () => {
    let state: ScenesState = defaultScenes;
    for (let i = 0; i < MAX_SCENES; i++) state = saveScene(state, hearthWith([]), "")!.state;
    expect(state.scenes[0].name).toBe("Scene 1");
    expect(saveScene(state, hearthWith([]), "one more")).toBeNull();
  });

  it("switching stores the Hearth you're leaving back into its scene, so nothing is lost", () => {
    const morning = saveScene(defaultScenes, hearthWith([card("a")], { theme: "hearth" }), "Morning")!;
    const evening = saveScene(morning.state, hearthWith([card("b")], { theme: "dusk" }), "Evening")!;
    // Now on Evening; change the Hearth, then go back to Morning.
    const edited = hearthWith([card("b"), card("b2")], { theme: "dusk" });
    const result = switchScene(evening.state, edited, morning.id)!;
    expect(result.show.items.map((i) => i.id)).toEqual(["a"]);
    expect(result.state.active).toBe(morning.id);
    const storedEvening = result.state.scenes.find((s) => s.id === evening.id)!;
    expect(storedEvening.snapshot.items.map((i) => i.id)).toEqual(["b", "b2"]);
  });

  it("saves a Hearth that isn't a scene yet before switching away from it", () => {
    const first = saveScene(defaultScenes, hearthWith([card("a")]), "Holiday")!;
    const loose: ScenesState = { ...first.state, active: null };
    const result = switchScene(loose, hearthWith([card("mine")]), first.id)!;
    const kept = result.state.scenes.find((s) => s.name === "My Hearth")!;
    expect(kept.snapshot.items.map((i) => i.id)).toEqual(["mine"]);
    expect(result.state.scenes).toHaveLength(2);
  });

  it("won't switch if the current Hearth would have nowhere to be kept", () => {
    let state: ScenesState = defaultScenes;
    for (let i = 0; i < MAX_SCENES; i++) state = saveScene(state, hearthWith([card(`s${i}`)]), `S${i}`)!.state;
    const loose: ScenesState = { ...state, active: null };
    expect(switchScene(loose, hearthWith([card("mine")]), state.scenes[0].id)).toBeNull();
  });

  it("does nothing for the scene that's already on, or one that isn't there", () => {
    const one = saveScene(defaultScenes, hearthWith([]), "A")!;
    expect(switchScene(one.state, hearthWith([]), one.id)).toBeNull();
    expect(switchScene(one.state, hearthWith([]), "nope")).toBeNull();
  });

  it("renames, removes, and un-activates a removed active scene", () => {
    const one = saveScene(defaultScenes, hearthWith([]), "A")!;
    expect(renameScene(one.state, one.id, "Cozy").scenes[0].name).toBe("Cozy");
    expect(renameScene(one.state, one.id, "   ")).toBe(one.state);
    const gone = removeScene(one.state, one.id);
    expect(gone.scenes).toEqual([]);
    expect(gone.active).toBeNull();
  });

  it("finds the scene for the time of day and the months", () => {
    expect([5, 11, 12, 16, 17, 21, 22, 4].map((h) => dayPartOf(at(h)))).toEqual([
      "morning", "morning", "afternoon", "afternoon", "evening", "evening", "night", "night",
    ]);
    let state: ScenesState = defaultScenes;
    const a = saveScene(state, hearthWith([]), "Everyday")!;
    const b = saveScene(a.state, hearthWith([]), "Evening")!;
    const c = saveScene(b.state, hearthWith([]), "Christmas evenings")!;
    state = setSchedule(c.state, b.id, { part: "evening" });
    state = setSchedule(state, c.id, { part: "evening", months: { from: 12, to: 12 } });
    expect(sceneForNow(state, at(19, 6))!.name).toBe("Evening");
    expect(sceneForNow(state, at(19, 12))!.name).toBe("Christmas evenings");
    expect(sceneForNow(state, at(9, 6))).toBeNull();
    // A scene with no schedule is by hand only.
    expect(sceneForNow(setSchedule(state, b.id, undefined), at(19, 6))).toBeNull();
  });

  it("keeps wallpaper and frame photos from scenes that aren't showing", () => {
    const frame = defaultWidget("frame");
    if (frame.kind === "frame") frame.settings.photos = ["u/frame.jpg"];
    const layout = hearthWith([{ id: "f", kind: "widget", widget: frame, x: 0, y: 0, w: 2, h: 2 }], {
      wallpaper: { kind: "photo", path: "u/wall.jpg", strength: "medium" } as never,
    });
    const state = saveScene(defaultScenes, layout, "A")!.state;
    expect(scenePhotoPaths(state).sort()).toEqual(["u/frame.jpg", "u/wall.jpg"]);
    expect(snapshotOf(layout).items).toHaveLength(1);
  });
});
