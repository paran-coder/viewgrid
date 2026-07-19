import type { CameraConfig } from "@/types/camera";

export type PresetId = "safe" | "product" | "side" | "advertising";
export type PresetSelection = PresetId | "custom";

export type CameraPreset = {
  id: PresetId;
  name: string;
  description: string;
  experimental?: boolean;
  cameras: CameraConfig[];
};

const yawGrid = [-25, 0, 25];
const pitchGrid = [10, 0, -10];

function grid(
  yawValues: number[],
  pitchValues: number[],
  options?: {
    fovByIndex?: number[];
    distanceByIndex?: number[];
  },
): CameraConfig[] {
  return Array.from({ length: 9 }, (_, index) => {
    const column = index % 3;
    const row = Math.floor(index / 3);

    return {
      id: index + 1,
      label: `C${index + 1}`,
      yaw: yawValues[column] ?? 0,
      pitch: pitchValues[row] ?? 0,
      roll: 0,
      fov: options?.fovByIndex?.[index] ?? 50,
      distance: options?.distanceByIndex?.[index] ?? 1,
      active: true,
    };
  });
}

export const PRESETS: CameraPreset[] = [
  {
    id: "safe",
    name: "안전한 9뷰",
    description: "작은 각도로 원본 충실도를 우선합니다.",
    cameras: grid([-15, 0, 15], [8, 0, -8]),
  },
  {
    id: "product",
    name: "제품 기본",
    description: "입체감과 안정성의 균형을 맞춘 기본값입니다.",
    cameras: grid(yawGrid, pitchGrid),
  },
  {
    id: "side",
    name: "측면 강조",
    description: "옆면을 적극적으로 보여주는 실험적 구성입니다.",
    experimental: true,
    cameras: grid([-45, 0, 45], [8, 0, -8], {
      fovByIndex: [48, 52, 48, 45, 50, 45, 48, 52, 48],
    }),
  },
  {
    id: "advertising",
    name: "광고 구도",
    description: "각도보다 렌즈와 여백 변화를 크게 사용합니다.",
    cameras: grid([-18, 0, 18], [7, 0, -7], {
      fovByIndex: [38, 55, 68, 45, 50, 58, 36, 52, 72],
      distanceByIndex: [0.86, 1, 1.18, 1.08, 0.92, 1.12, 0.9, 1.05, 1.22],
    }),
  },
];

export function getPreset(id: PresetId): CameraPreset {
  return PRESETS.find((preset) => preset.id === id) ?? PRESETS[1];
}

export function cloneCameras(cameras: CameraConfig[]): CameraConfig[] {
  return cameras.map((camera) => ({ ...camera }));
}
