import { describe, expect, it } from "vitest";

import { cloneCameras, getPreset } from "@/lib/presets";
import {
  createPresetDocument,
  parsePresetDocument,
  presetFilename,
} from "@/lib/project-preset";

describe("ViewGrid JSON preset", () => {
  it("round-trips nine camera and consistency settings", () => {
    const document = createPresetDocument({
      name: "Product hero views",
      cameras: cloneCameras(getPreset("advertising").cameras),
      cameraGuide: { enabled: true, previewVisible: false },
      consistency: {
        referenceEnabled: true,
        normalizationEnabled: false,
      },
    });
    const parsed = parsePresetDocument(JSON.stringify(document));
    expect(parsed.name).toBe("Product hero views");
    expect(parsed.cameras).toHaveLength(9);
    expect(parsed.cameras[0].fov).toBe(38);
    expect(parsed.consistency.normalizationEnabled).toBe(false);
  });

  it("clamps unsafe imported camera values", () => {
    const document = createPresetDocument({
      name: "Unsafe",
      cameras: cloneCameras(getPreset("product").cameras),
      cameraGuide: { enabled: true, previewVisible: true },
      consistency: {
        referenceEnabled: true,
        normalizationEnabled: true,
      },
    });
    const raw = JSON.parse(JSON.stringify(document));
    raw.cameras[0].yaw = 999;
    raw.cameras[0].fov = -5;
    const parsed = parsePresetDocument(JSON.stringify(raw));
    expect(parsed.cameras[0].yaw).toBe(180);
    expect(parsed.cameras[0].fov).toBe(20);
  });

  it("rejects foreign JSON files", () => {
    expect(() => parsePresetDocument('{"hello":"world"}')).toThrow(
      "지원하지 않는 ViewGrid 프리셋",
    );
    expect(presetFilename("Product Hero")).toBe("product-hero.viewgrid.json");
  });
});
