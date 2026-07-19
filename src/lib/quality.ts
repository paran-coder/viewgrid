import type { CameraConfig, QualityLevel } from "@/types/camera";

export type QualitySummary = {
  level: QualityLevel;
  label: string;
  description: string;
};

const rank: Record<QualityLevel, number> = {
  stable: 0,
  caution: 1,
  experimental: 2,
};

function highest(levels: QualityLevel[]): QualityLevel {
  return levels.reduce<QualityLevel>(
    (current, candidate) =>
      rank[candidate] > rank[current] ? candidate : current,
    "stable",
  );
}

export function getParameterQuality(
  parameter: "yaw" | "pitch" | "roll" | "fov",
  value: number,
): QualityLevel {
  const absolute = Math.abs(value);

  if (parameter === "yaw") {
    if (absolute <= 25) return "stable";
    if (absolute <= 45) return "caution";
    return "experimental";
  }

  if (parameter === "pitch") {
    if (absolute <= 10) return "stable";
    if (absolute <= 20) return "caution";
    return "experimental";
  }

  if (parameter === "roll") {
    if (absolute <= 10) return "stable";
    if (absolute <= 15) return "caution";
    return "experimental";
  }

  if (value >= 35 && value <= 65) return "stable";
  if (value >= 25 && value <= 80) return "caution";
  return "experimental";
}

export function getCameraQuality(camera: CameraConfig): QualitySummary {
  const level = highest([
    getParameterQuality("yaw", camera.yaw),
    getParameterQuality("pitch", camera.pitch),
    getParameterQuality("roll", camera.roll),
    getParameterQuality("fov", camera.fov),
  ]);

  const content: Record<QualityLevel, Omit<QualitySummary, "level">> = {
    stable: {
      label: "안정적",
      description: "원본에서 크게 벗어나지 않는 권장 구도입니다.",
    },
    caution: {
      label: "주의",
      description: "새로 노출되는 면이 있어 결과 확인이 필요합니다.",
    },
    experimental: {
      label: "실험적",
      description: "원본에 없는 영역을 많이 추론할 수 있습니다.",
    },
  };

  return { level, ...content[level] };
}
