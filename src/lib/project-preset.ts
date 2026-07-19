import type { CameraConfig } from "@/types/camera";
import type {
  CameraGuideSettings,
  ConsistencySettings,
} from "@/types/generation";

export const VIEWGRID_PRESET_SCHEMA_VERSION = 1;

export type ViewGridPresetDocument = {
  schemaVersion: 1;
  kind: "viewgrid-camera-preset";
  name: string;
  createdAt: string;
  cameras: CameraConfig[];
  cameraGuide: Pick<CameraGuideSettings, "enabled">;
  consistency: ConsistencySettings;
};

const LIMITS = {
  yaw: [-180, 180],
  pitch: [-80, 80],
  roll: [-20, 20],
  fov: [20, 100],
  distance: [0.6, 2],
} as const;

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function asNumber(value: unknown, fallback: number) {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function sanitizeCamera(value: unknown, index: number): CameraConfig {
  const record =
    value && typeof value === "object"
      ? (value as Record<string, unknown>)
      : {};
  const id = index + 1;
  return {
    id,
    label: `C${id}`,
    yaw: clamp(asNumber(record.yaw, 0), ...LIMITS.yaw),
    pitch: clamp(asNumber(record.pitch, 0), ...LIMITS.pitch),
    roll: clamp(asNumber(record.roll, 0), ...LIMITS.roll),
    fov: clamp(asNumber(record.fov, 50), ...LIMITS.fov),
    distance: clamp(asNumber(record.distance, 1), ...LIMITS.distance),
    active: record.active !== false,
  };
}

export function createPresetDocument(input: {
  name: string;
  cameras: CameraConfig[];
  cameraGuide: CameraGuideSettings;
  consistency: ConsistencySettings;
}): ViewGridPresetDocument {
  return {
    schemaVersion: VIEWGRID_PRESET_SCHEMA_VERSION,
    kind: "viewgrid-camera-preset",
    name: input.name.trim() || "ViewGrid custom preset",
    createdAt: new Date().toISOString(),
    cameras: input.cameras.map((camera) => ({ ...camera })),
    cameraGuide: { enabled: input.cameraGuide.enabled },
    consistency: { ...input.consistency },
  };
}

export function parsePresetDocument(text: string): ViewGridPresetDocument {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error("올바른 JSON 프리셋 파일이 아닙니다.");
  }
  if (!parsed || typeof parsed !== "object") {
    throw new Error("프리셋 구조를 읽을 수 없습니다.");
  }
  const record = parsed as Record<string, unknown>;
  if (
    record.kind !== "viewgrid-camera-preset" ||
    record.schemaVersion !== VIEWGRID_PRESET_SCHEMA_VERSION ||
    !Array.isArray(record.cameras) ||
    record.cameras.length !== 9
  ) {
    throw new Error("지원하지 않는 ViewGrid 프리셋 형식입니다.");
  }
  const guide =
    record.cameraGuide && typeof record.cameraGuide === "object"
      ? (record.cameraGuide as Record<string, unknown>)
      : {};
  const consistency =
    record.consistency && typeof record.consistency === "object"
      ? (record.consistency as Record<string, unknown>)
      : {};

  return {
    schemaVersion: 1,
    kind: "viewgrid-camera-preset",
    name:
      typeof record.name === "string" && record.name.trim()
        ? record.name.trim().slice(0, 80)
        : "Imported ViewGrid preset",
    createdAt:
      typeof record.createdAt === "string"
        ? record.createdAt
        : new Date().toISOString(),
    cameras: record.cameras.map(sanitizeCamera),
    cameraGuide: { enabled: guide.enabled !== false },
    consistency: {
      referenceEnabled: consistency.referenceEnabled !== false,
      normalizationEnabled: consistency.normalizationEnabled !== false,
    },
  };
}

export function presetFilename(name: string) {
  const safe =
    name
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9가-힣_-]+/g, "-")
      .replace(/^-+|-+$/g, "") || "viewgrid-preset";
  return `${safe}.viewgrid.json`;
}
