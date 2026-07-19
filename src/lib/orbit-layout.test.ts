import { describe, expect, it } from "vitest";

import { calculateOrbitLayout } from "@/lib/orbit-layout";

describe("calculateOrbitLayout", () => {
  it("centers a portrait image inside a wider orbit viewport", () => {
    const layout = calculateOrbitLayout({
      stageWidth: 1000,
      stageHeight: 620,
      imageWidth: 800,
      imageHeight: 1200,
    });

    expect(layout.imageHeight).toBeLessThanOrEqual(434);
    expect(layout.orbitWidth).toBeGreaterThan(layout.imageWidth);
    expect(layout.orbitHeight).toBeGreaterThan(layout.imageHeight);
  });

  it("keeps a landscape image and orbit inside the stage", () => {
    const layout = calculateOrbitLayout({
      stageWidth: 960,
      stageHeight: 600,
      imageWidth: 1600,
      imageHeight: 900,
    });

    expect(layout.imageWidth).toBeLessThanOrEqual(480);
    expect(layout.orbitWidth).toBeLessThanOrEqual(922);
    expect(layout.orbitHeight).toBeLessThanOrEqual(564);
  });
});
