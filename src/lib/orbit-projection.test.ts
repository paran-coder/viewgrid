import { describe, expect, it } from "vitest";

import { projectCameraToOrbit } from "@/lib/orbit-projection";

describe("projectCameraToOrbit", () => {
  it("places the front camera near the visual center", () => {
    const point = projectCameraToOrbit({ yaw: 0, pitch: 0, distance: 1 });
    expect(point.leftPercent).toBeCloseTo(50);
    expect(point.topPercent).toBeGreaterThan(50);
    expect(point.depth).toBeCloseTo(1);
  });

  it("moves positive yaw right and positive pitch upward", () => {
    const right = projectCameraToOrbit({ yaw: 25, pitch: 0, distance: 1 });
    const upper = projectCameraToOrbit({ yaw: 0, pitch: 15, distance: 1 });
    expect(right.leftPercent).toBeGreaterThan(50);
    expect(upper.topPercent).toBeLessThan(50);
  });

  it("keeps extreme values inside the editable stage", () => {
    const point = projectCameraToOrbit({ yaw: 180, pitch: 90, distance: 3 });
    expect(point.leftPercent).toBeGreaterThanOrEqual(7);
    expect(point.leftPercent).toBeLessThanOrEqual(93);
    expect(point.topPercent).toBeGreaterThanOrEqual(8);
    expect(point.topPercent).toBeLessThanOrEqual(92);
  });
});
