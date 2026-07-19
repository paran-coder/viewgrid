import { describe, expect, it } from "vitest";

import {
  cameraFromOrbitDrag,
  inferBackside,
  orbitViewFromDrag,
  projectCameraToOrbit,
} from "@/lib/orbit-projection";

describe("projectCameraToOrbit", () => {
  it("places the front camera near the visual center", () => {
    const point = projectCameraToOrbit({ yaw: 0, pitch: 0, distance: 1 });
    expect(point.leftPercent).toBeGreaterThan(52);
    expect(point.topPercent).toBeGreaterThan(45);
    expect(point.topPercent).toBeLessThan(60);
    expect(point.depth).toBeGreaterThan(0);
  });

  it("moves positive yaw right and positive pitch upward", () => {
    const right = projectCameraToOrbit({ yaw: 45, pitch: 0, distance: 1 });
    const upper = projectCameraToOrbit({ yaw: 0, pitch: 25, distance: 1 });
    expect(right.leftPercent).toBeGreaterThan(50);
    expect(upper.topPercent).toBeLessThan(50);
  });

  it("keeps extreme values inside the editable stage", () => {
    const point = projectCameraToOrbit({ yaw: 180, pitch: 80, distance: 2 });
    expect(point.leftPercent).toBeGreaterThanOrEqual(4);
    expect(point.leftPercent).toBeLessThanOrEqual(96);
    expect(point.topPercent).toBeGreaterThanOrEqual(6);
    expect(point.topPercent).toBeLessThanOrEqual(94);
  });
});

describe("orbit drag helpers", () => {
  it("rotates the editor view from drag deltas", () => {
    const next = orbitViewFromDrag({
      startYaw: -20,
      startPitch: 12,
      deltaX: 100,
      deltaY: -50,
    });
    expect(next.yaw).toBeGreaterThan(-20);
    expect(next.pitch).toBeLessThan(12);
  });

  it("updates a camera angle and detects rear views", () => {
    const next = cameraFromOrbitDrag({
      startYaw: 100,
      startPitch: 0,
      deltaX: 80,
      deltaY: -30,
    });
    expect(next.yaw).toBeGreaterThan(100);
    expect(next.pitch).toBeGreaterThan(0);
    expect(inferBackside({ yaw: next.yaw })).toBe(true);
  });
});
