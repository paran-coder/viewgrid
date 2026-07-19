import { describe, expect, it } from "vitest";

import {
  buildCameraPrompt,
  describeFov,
  describePitch,
  describeYaw,
} from "@/lib/camera-prompt";
import type { CameraConfig } from "@/types/camera";

const camera: CameraConfig = {
  id: 3,
  label: "C3",
  yaw: 30,
  pitch: 10,
  roll: 0,
  fov: 50,
  distance: 1,
  active: true,
};

describe("camera prompt", () => {
  it("converts camera parameters into explicit photographic language", () => {
    expect(describeYaw(30)).toContain("30 degrees");
    expect(describeYaw(30)).toContain("right side");
    expect(describePitch(10)).toContain("looking down");
    expect(describeFov(50)).toContain("standard-lens");
  });

  it("includes preservation and prohibition instructions", () => {
    const prompt = buildCameraPrompt(camera);
    expect(prompt).toContain("Preserve the same subject identity");
    expect(prompt).toContain("Do not redesign");
    expect(prompt).toContain("30 degrees");
    expect(prompt).not.toContain("Image 2 is a rough");
    expect(prompt.length).toBeGreaterThan(500);
  });

  it("separates the source and guide roles for multi-image generation", () => {
    const prompt = buildCameraPrompt(camera, { hasGuide: true });
    expect(prompt).toContain("Image 1 is the exact identity");
    expect(prompt).toContain(
      "Image 2 is a rough virtual-camera composition guide",
    );
    expect(prompt).toContain("Do not copy Image 2's frame edges, blur");
    expect(prompt).toContain("Rebuild the final image cleanly from Image 1");
  });
  it("assigns a separate role to a neighboring generated reference", () => {
    const prompt = buildCameraPrompt(camera, {
      hasGuide: true,
      hasReference: true,
      referenceCameraLabel: "C6",
    });
    expect(prompt).toContain(
      "Image 3 is a previously approved neighboring view (C6)",
    );
    expect(prompt).toContain("Do not copy Image 3's camera angle");
    expect(prompt).toContain("Multi-view consistency requirements");
  });
});
