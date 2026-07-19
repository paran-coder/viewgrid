import { describe, expect, it } from "vitest";

import { getPreset, PRESETS } from "@/lib/presets";

const unique = <T>(values: T[]) => new Set(values).size === values.length;

describe("camera presets", () => {
  it("contains four named presets with nine unique cameras", () => {
    expect(PRESETS).toHaveLength(4);
    for (const preset of PRESETS) {
      expect(preset.cameras).toHaveLength(9);
      expect(unique(preset.cameras.map((camera) => camera.id))).toBe(true);
    }
  });

  it("returns the product preset for an unknown id fallback", () => {
    expect(getPreset("product").name).toBe("제품 기본");
  });
});
