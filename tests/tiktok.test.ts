import { describe, expect, it } from "vitest";

import { isTikTok, parseCaption, tiktokPlayerUrl, tiktokVideoId } from "../lib/tiktok";

describe("TikTok links (REC-013)", () => {
  it("knows a TikTok link, including share links", () => {
    expect(isTikTok("https://www.tiktok.com/@cook/video/7301234567890123456")).toBe(true);
    expect(isTikTok("https://vm.tiktok.com/ZMabc123/")).toBe(true);
    expect(isTikTok("https://www.tiktok.com/t/ZTabc123/")).toBe(true);
    expect(isTikTok("https://www.allrecipes.com/recipe/1")).toBe(false);
    expect(isTikTok("https://nottiktok.com/video/1")).toBe(false);
    expect(isTikTok(null)).toBe(false);
  });

  it("finds the video id and builds the player address", () => {
    expect(tiktokVideoId("https://www.tiktok.com/@cook/video/7301234567890123456?is_from_webapp=1")).toBe("7301234567890123456");
    expect(tiktokVideoId("https://vm.tiktok.com/ZMabc123/")).toBeNull();
    expect(tiktokPlayerUrl("123456789")).toMatch(/^https:\/\/www\.tiktok\.com\/player\/v1\/123456789\?/);
  });
});

describe("reading a TikTok caption (REC-013)", () => {
  it("takes a name and the listed ingredients, dropping hashtags", () => {
    const caption =
      "Easy garlic noodles 🍜 Ingredients: 8oz noodles, 4 cloves garlic, 2 tbsp butter, 1 tbsp soy sauce. Instructions: boil the noodles and toss. #pasta #fyp @chef";
    expect(parseCaption(caption)).toEqual({
      title: "Easy garlic noodles",
      ingredients: ["8oz noodles", "4 cloves garlic", "2 tbsp butter", "1 tbsp soy sauce"],
      notes: "Easy garlic noodles 🍜 Ingredients: 8oz noodles, 4 cloves garlic, 2 tbsp butter, 1 tbsp soy sauce. Instructions: boil the noodles and toss.",
    });
  });

  it("keeps a caption without ingredients as notes", () => {
    const result = parseCaption("The best cookies you'll ever make!! #baking #cookies");
    expect(result.title).toBe("The best cookies you'll ever make");
    expect(result.ingredients).toEqual([]);
    expect(result.notes).toBe("The best cookies you'll ever make!!");
  });

  it("copes with a caption that's only hashtags", () => {
    expect(parseCaption("#recipe #fyp")).toEqual({ title: null, ingredients: [], notes: null });
  });
});
