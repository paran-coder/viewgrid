import { describe, expect, it, vi } from "vitest";

import {
  calculateCameraGuideGeometry,
  createCameraGuideFile,
} from "@/lib/camera-guide";
import type { CameraConfig } from "@/types/camera";

const baseCamera: CameraConfig = {
  id: 5,
  label: "C5",
  yaw: 0,
  pitch: 0,
  roll: 0,
  fov: 50,
  distance: 1,
  active: true,
};

function geometry(overrides: Partial<CameraConfig>) {
  return calculateCameraGuideGeometry(
    { ...baseCamera, ...overrides },
    1200,
    800,
    900,
  );
}

describe("camera guide geometry", () => {
  it("compresses the plane and shifts framing as yaw increases", () => {
    const centered = geometry({ yaw: 0 });
    const right = geometry({ yaw: 45 });
    const left = geometry({ yaw: -45 });

    expect(right.yawCompression).toBeLessThan(centered.yawCompression);
    expect(right.yawPerspective).toBeGreaterThan(0);
    expect(left.yawPerspective).toBeLessThan(0);
    expect(right.offsetX).toBeLessThan(0);
    expect(left.offsetX).toBeGreaterThan(0);
  });

  it("changes vertical perspective and framing with pitch", () => {
    const centered = geometry({ pitch: 0 });
    const elevated = geometry({ pitch: 20 });
    const lowered = geometry({ pitch: -20 });

    expect(elevated.pitchCompression).toBeLessThan(centered.pitchCompression);
    expect(elevated.pitchPerspective).toBeGreaterThan(0);
    expect(lowered.pitchPerspective).toBeLessThan(0);
    expect(elevated.offsetY).toBeGreaterThan(0);
    expect(lowered.offsetY).toBeLessThan(0);
  });

  it("maps narrower FOV and shorter distance to a larger subject", () => {
    const telephoto = geometry({ fov: 30, distance: 1 });
    const wide = geometry({ fov: 80, distance: 1 });
    const close = geometry({ fov: 50, distance: 0.7 });
    const far = geometry({ fov: 50, distance: 1.8 });

    expect(telephoto.subjectScale).toBeGreaterThan(wide.subjectScale);
    expect(close.subjectScale).toBeGreaterThan(far.subjectScale);
  });

  it("keeps roll as a deterministic local rotation", () => {
    expect(geometry({ roll: 10 }).rollRadians).toBeCloseTo(Math.PI / 18, 6);
    expect(geometry({ roll: -10 }).rollRadians).toBeCloseTo(-Math.PI / 18, 6);
  });

  it("renders a bounded JPEG guide file through the strip pipeline", async () => {
    const originalCreateElement = document.createElement.bind(document);
    const drawImage = vi.fn();
    const context = {
      drawImage,
      fillRect: vi.fn(),
      save: vi.fn(),
      restore: vi.fn(),
      translate: vi.fn(),
      rotate: vi.fn(),
      fillStyle: "",
      globalAlpha: 1,
      filter: "none",
      imageSmoothingEnabled: true,
      imageSmoothingQuality: "high",
    } as unknown as CanvasRenderingContext2D;

    const createElementSpy = vi
      .spyOn(document, "createElement")
      .mockImplementation((tagName: string) => {
        if (tagName !== "canvas") return originalCreateElement(tagName);
        return {
          width: 0,
          height: 0,
          getContext: () => context,
          toBlob: (callback: BlobCallback, type?: string) =>
            callback(
              new Blob([new Uint8Array(24)], {
                type: type ?? "image/jpeg",
              }),
            ),
        } as unknown as HTMLCanvasElement;
      });

    try {
      const image = {
        naturalWidth: 1200,
        naturalHeight: 800,
        width: 1200,
        height: 800,
      } as HTMLImageElement;
      const file = await createCameraGuideFile(
        image,
        { ...baseCamera, yaw: 25, pitch: 10, roll: 5 },
        "product.png",
        { maxEdge: 720, maxBytes: 1000, stripCount: 32 },
      );

      expect(file.name).toBe("product-5-guide.jpg");
      expect(file.type).toBe("image/jpeg");
      expect(file.size).toBe(24);
      expect(drawImage.mock.calls.length).toBeGreaterThan(60);
    } finally {
      createElementSpy.mockRestore();
    }
  });
});
