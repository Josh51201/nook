import { describe, expect, it } from "vitest";

import { parsePreview } from "../lib/link-preview";

// GIFT-030: pulling a title + picture out of a product page.

describe("link preview parsing", () => {
  it("reads Open Graph tags", () => {
    const html = `<head><meta property="og:title" content="Wool Socks &amp; More">
      <meta property="og:image" content="https://shop.test/socks.jpg"></head>`;
    expect(parsePreview(html, "https://shop.test/p/1")).toEqual({
      title: "Wool Socks & More",
      imageUrl: "https://shop.test/socks.jpg",
    });
  });

  it("handles content-before-property order and relative images", () => {
    const html = `<meta content="/img/a.png" property="og:image"><title> Lamp </title>`;
    expect(parsePreview(html, "https://shop.test/p/1")).toEqual({
      title: "Lamp",
      imageUrl: "https://shop.test/img/a.png",
    });
  });

  it("falls back to Amazon's own markup", () => {
    const html = `<title>Amazon.com: LEGO Classic Bricks : Toys &amp; Games</title>
      <span id="productTitle" class="a-size-large">   LEGO Classic Medium Creative Brick Box   </span>
      <img data-old-hires="https://m.media-amazon.com/images/I/lego.jpg">`;
    expect(parsePreview(html, "https://www.amazon.com/dp/B00NHQFA1I")).toEqual({
      title: "LEGO Classic Medium Creative Brick Box",
      imageUrl: "https://m.media-amazon.com/images/I/lego.jpg",
    });
  });

  it("strips the Amazon prefix from a plain <title>", () => {
    const html = `<title>Amazon.com: Cozy Socks : Clothing</title>`;
    expect(parsePreview(html, "https://www.amazon.com/dp/X").title).toBe("Cozy Socks");
  });

  it("returns nulls for a robot-check page", () => {
    expect(parsePreview("<html><body>Sorry</body></html>", "https://a.test")).toEqual({
      title: null,
      imageUrl: null,
    });
  });
});
