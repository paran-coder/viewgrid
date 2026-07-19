import type { CameraConfig, GenerationCell } from "@/types/camera";
import type {
  ImageModelId,
  ProviderId,
  ResultContext,
} from "@/types/generation";

export const MULTIVIEW_PLAN_VERSION = "viewgrid-multiview-v1";

export const PREFERRED_GENERATION_ORDER = [5, 4, 6, 2, 8, 1, 3, 7, 9];

export const PREFERRED_REFERENCE_CAMERA: Record<number, number | null> = {
  1: 4,
  2: 5,
  3: 6,
  4: 5,
  5: null,
  6: 5,
  7: 4,
  8: 5,
  9: 6,
};

export function orderCameraIds(cameraIds: number[]) {
  const unique = [...new Set(cameraIds)];
  const rank = new Map(
    PREFERRED_GENERATION_ORDER.map((cameraId, index) => [cameraId, index]),
  );
  return unique.sort(
    (left, right) =>
      (rank.get(left) ?? Number.MAX_SAFE_INTEGER) -
      (rank.get(right) ?? Number.MAX_SAFE_INTEGER),
  );
}

export function buildGenerationPlan(cameraIds: number[]) {
  return orderCameraIds(cameraIds).map((cameraId, index) => ({
    cameraId,
    order: index + 1,
    preferredReferenceCameraId: PREFERRED_REFERENCE_CAMERA[cameraId] ?? null,
  }));
}

function matchesCameraSnapshot(camera: CameraConfig, cell: GenerationCell) {
  const snapshot = cell.metadata?.camera;
  return Boolean(
    snapshot &&
    snapshot.yaw === camera.yaw &&
    snapshot.pitch === camera.pitch &&
    snapshot.roll === camera.roll &&
    snapshot.fov === camera.fov &&
    snapshot.distance === camera.distance,
  );
}

function matchesContext(
  cell: GenerationCell,
  context: ResultContext & { provider: ProviderId; model: ImageModelId },
) {
  const metadata = cell.metadata;
  return Boolean(
    metadata &&
    metadata.provider === context.provider &&
    metadata.model === context.model &&
    metadata.guideRequested === context.guideEnabled &&
    metadata.referencePolicyEnabled === context.referenceEnabled &&
    metadata.normalizationRequested === context.normalizationEnabled,
  );
}

export function findReferenceResult(
  cameraId: number,
  cameras: CameraConfig[],
  generation: GenerationCell[],
  context: ResultContext & { provider: ProviderId; model: ImageModelId },
) {
  if (!context.referenceEnabled) return null;
  const preferredId = PREFERRED_REFERENCE_CAMERA[cameraId] ?? null;
  if (!preferredId) return null;
  const referenceCamera = cameras.find(
    (camera) => camera.id === preferredId && camera.active,
  );
  const referenceCell = generation.find(
    (cell) => cell.cameraId === preferredId,
  );
  if (
    !referenceCamera ||
    !referenceCell ||
    referenceCell.status !== "complete" ||
    referenceCell.source !== "api" ||
    !referenceCell.resultUrl ||
    !matchesCameraSnapshot(referenceCamera, referenceCell) ||
    !matchesContext(referenceCell, context)
  ) {
    return null;
  }
  return { camera: referenceCamera, cell: referenceCell };
}
