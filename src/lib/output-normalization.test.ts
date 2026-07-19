import { describe, expect, it } from "vitest";

import { computeColorGains } from "@/lib/output-normalization";

describe("output normalization", () => {
  it("keeps identical color means neutral", () => {
    expect(
      computeColorGains({ r: 120, g: 130, b: 140 }, { r: 120, g: 130, b: 140 }),
    ).toEqual({ r: 1, g: 1, b: 1 });
  });

  it("limits aggressive exposure and channel corrections", () => {
    const gains = computeColorGains(
      { r: 20, g: 30, b: 240 },
      { r: 240, g: 220, b: 20 },
    );
    expect(gains.r).toBeLessThanOrEqual(1.16);
    expect(gains.g).toBeLessThanOrEqual(1.16);
    expect(gains.b).toBeGreaterThanOrEqual(0.84);
  });
});
