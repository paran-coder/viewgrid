import { describe, expect, it } from "vitest";

import {
  buildGenerationPlan,
  findReferenceResult,
  orderCameraIds,
} from "@/lib/multiview-consistency";
import { cloneCameras, getPreset } from "@/lib/presets";
import type { GenerationCell } from "@/types/camera";

const context = {
  provider: "openai" as const,
  model: "gpt-image-2" as const,
  guideEnabled: true,
  referenceEnabled: true,
  normalizationEnabled: true,
};

function completedCell(cameraId: number): GenerationCell {
  const camera = cloneCameras(getPreset("product").cameras).find(
    (item) => item.id === cameraId,
  )!;
  return {
    cameraId,
    status: "complete",
    revision: 0,
    source: "api",
    resultUrl: `blob:c${cameraId}`,
    metadata: {
      provider: "openai",
      model: "gpt-image-2",
      camera,
      prompt: "test prompt",
      mimeType: "image/webp",
      byteSize: 100,
      durationMs: 1000,
      createdAt: "2026-07-19T00:00:00.000Z",
      guideRequested: true,
      guideUsed: true,
      referencePolicyEnabled: true,
      referenceRequested: cameraId !== 5,
      referenceUsed: cameraId !== 5,
      normalizationRequested: true,
      normalized: true,
    },
  };
}

describe("multi-view consistency planning", () => {
  it("orders a full grid from the center anchors outward", () => {
    expect(orderCameraIds([1, 2, 3, 4, 5, 6, 7, 8, 9])).toEqual([
      5, 4, 6, 2, 8, 1, 3, 7, 9,
    ]);
    expect(buildGenerationPlan([1, 4, 5])[1]).toEqual({
      cameraId: 4,
      order: 2,
      preferredReferenceCameraId: 5,
    });
  });

  it("selects the preferred completed neighboring result", () => {
    const cameras = cloneCameras(getPreset("product").cameras);
    const reference = findReferenceResult(
      1,
      cameras,
      [completedCell(4)],
      context,
    );
    expect(reference?.camera.id).toBe(4);
    expect(reference?.cell.resultUrl).toBe("blob:c4");
  });

  it("rejects a reference generated under a different model context", () => {
    const cameras = cloneCameras(getPreset("product").cameras);
    const cell = completedCell(4);
    cell.metadata = { ...cell.metadata!, model: "gpt-image-2" };
    expect(
      findReferenceResult(1, cameras, [cell], {
        ...context,
        provider: "gemini",
        model: "gemini-3.1-flash-image",
      }),
    ).toBeNull();
  });
});
