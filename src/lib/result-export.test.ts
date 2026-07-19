import JSZip from "jszip";
import { describe, expect, it } from "vitest";

import { cloneCameras, getPreset } from "@/lib/presets";
import {
  buildExportManifest,
  createResultsZip,
  getContactSheetLayout,
  getExportReadiness,
  resultFilename,
} from "@/lib/result-export";
import type { GenerationCell } from "@/types/camera";

const resultContext = {
  provider: "openai" as const,
  model: "gpt-image-2" as const,
  guideEnabled: true,
  referenceEnabled: true,
  normalizationEnabled: true,
};

function completeGeneration(): GenerationCell[] {
  return cloneCameras(getPreset("product").cameras).map((camera) => ({
    cameraId: camera.id,
    status: "complete",
    revision: 0,
    source: "api",
    resultUrl: `blob:camera-${camera.id}`,
    metadata: {
      provider: "openai",
      model: "gpt-image-2",
      camera,
      prompt: `camera ${camera.id}`,
      mimeType: "image/webp",
      byteSize: 3,
      durationMs: 1000,
      createdAt: "2026-07-19T01:02:03.000Z",
      guideRequested: true,
      guideUsed: true,
      guideByteSize: 1200,
      guideVersion: "perspective-strips-v1",
      referencePolicyEnabled: true,
      referenceRequested: camera.id !== 5,
      referenceUsed: camera.id !== 5,
      referenceCameraId: camera.id === 5 ? undefined : 5,
      multiviewPlanVersion: "viewgrid-multiview-v1",
      normalizationRequested: true,
      normalized: true,
      normalizationVersion: "viewgrid-normalize-v1",
      normalizedWidth: 1024,
      normalizedHeight: 1024,
    },
  }));
}

describe("result export helpers", () => {
  it("calculates a fixed 3x3 contact sheet layout", () => {
    expect(getContactSheetLayout(9, 768, 12)).toEqual({
      width: 2328,
      height: 2328,
      cellSize: 768,
      gap: 12,
      columns: 3,
      rows: 3,
    });
  });

  it("requires all active API results for contact sheet export", () => {
    const cameras = cloneCameras(getPreset("product").cameras);
    const generation = completeGeneration();
    expect(getExportReadiness(cameras, generation, resultContext)).toEqual({
      active: 9,
      available: 9,
      completed: 9,
      canDownloadZip: true,
      canDownloadContactSheet: true,
    });

    generation[0] = {
      ...generation[0],
      status: "failed",
      resultUrl: undefined,
    };
    expect(
      getExportReadiness(cameras, generation, resultContext),
    ).toMatchObject({
      available: 8,
      completed: 8,
      canDownloadZip: true,
      canDownloadContactSheet: false,
    });
  });

  it("marks a result stale when the current camera no longer matches its snapshot", () => {
    const cameras = cloneCameras(getPreset("product").cameras);
    const generation = completeGeneration();
    cameras[0] = { ...cameras[0], yaw: cameras[0].yaw + 5 };

    expect(
      getExportReadiness(cameras, generation, resultContext),
    ).toMatchObject({
      active: 9,
      available: 9,
      completed: 8,
      canDownloadZip: true,
      canDownloadContactSheet: false,
    });
  });

  it("marks guide-mode changes as stale for contact sheet readiness", () => {
    const cameras = cloneCameras(getPreset("product").cameras);
    const generation = completeGeneration();

    expect(
      getExportReadiness(cameras, generation, resultContext),
    ).toMatchObject({
      completed: 9,
      canDownloadContactSheet: true,
    });
    expect(
      getExportReadiness(cameras, generation, {
        ...resultContext,
        guideEnabled: false,
      }),
    ).toMatchObject({
      completed: 0,
      canDownloadZip: true,
      canDownloadContactSheet: false,
    });
  });

  it("creates a ZIP with completed images, a manifest, and an optional sheet", async () => {
    const cameras = cloneCameras(getPreset("product").cameras);
    const generation = completeGeneration();
    const zipBlob = await createResultsZip({
      cameras,
      generation,
      projectName: "sample product",
      resultContext,
      contactSheet: new Blob([new Uint8Array([9, 9])], { type: "image/png" }),
      fetchBlob: async () =>
        new Blob([new Uint8Array([1, 2, 3])], { type: "image/webp" }),
    });

    const zip = await JSZip.loadAsync(await zipBlob.arrayBuffer());
    const names = Object.keys(zip.files);
    expect(
      names.filter((name) => name.startsWith("images/") && !name.endsWith("/")),
    ).toHaveLength(9);
    expect(names).toContain("viewgrid-contact-sheet.png");
    expect(names).toContain("viewgrid-manifest.json");

    const manifest = JSON.parse(
      await zip.file("viewgrid-manifest.json")!.async("string"),
    ) as ReturnType<typeof buildExportManifest>;
    expect(manifest.projectName).toBe("sample product");
    expect(manifest.resultContext).toEqual(resultContext);
    expect(manifest.cameras).toHaveLength(9);
    expect(JSON.stringify(manifest)).not.toContain("blob:camera");
  });

  it("uses the real MIME extension in individual filenames", () => {
    expect(resultFilename("C1", "image/jpeg", "2026-07-19T01:02:03.000Z")).toBe(
      "viewgrid-c1-2026-07-19T01-02-03-000Z.jpg",
    );
  });
});
