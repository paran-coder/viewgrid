import { clamp } from "@/lib/utils";
import type { CameraConfig } from "@/types/camera";

export type OrbitViewState = {
  yaw: number;
  pitch: number;
  zoom: number;
};

export type OrbitVector = { x: number; y: number; z: number };

export type OrbitProjection = {
  leftPercent: number;
  topPercent: number;
  depth: number;
  scale: number;
  zIndex: number;
  opacity: number;
};

export type OrbitRingPlane = "xy" | "xz" | "yz";

const radians = (degrees: number) => (degrees * Math.PI) / 180;
const degrees = (radiansValue: number) => (radiansValue * 180) / Math.PI;

export function cameraToOrbitVector(
  camera: Pick<CameraConfig, "yaw" | "pitch" | "distance">,
): OrbitVector {
  const yaw = radians(camera.yaw);
  const pitch = radians(camera.pitch);
  const radius = clamp(camera.distance, 0.6, 2);

  return {
    x: radius * Math.sin(yaw) * Math.cos(pitch),
    y: radius * Math.sin(pitch),
    z: radius * Math.cos(yaw) * Math.cos(pitch),
  };
}

export function rotateOrbitVector(
  vector: OrbitVector,
  view: Pick<OrbitViewState, "yaw" | "pitch">,
): OrbitVector {
  const yaw = radians(view.yaw);
  const pitch = radians(view.pitch);

  const cosYaw = Math.cos(yaw);
  const sinYaw = Math.sin(yaw);
  const cosPitch = Math.cos(pitch);
  const sinPitch = Math.sin(pitch);

  const yawRotated = {
    x: vector.x * cosYaw - vector.z * sinYaw,
    y: vector.y,
    z: vector.x * sinYaw + vector.z * cosYaw,
  };

  return {
    x: yawRotated.x,
    y: yawRotated.y * cosPitch - yawRotated.z * sinPitch,
    z: yawRotated.y * sinPitch + yawRotated.z * cosPitch,
  };
}

export function projectOrbitVector(
  vector: OrbitVector,
  view: OrbitViewState,
): OrbitProjection {
  const rotated = rotateOrbitVector(vector, view);
  const zoom = clamp(view.zoom, 0.72, 1.45);
  const perspectiveDistance = 5.2;
  const perspective = perspectiveDistance / (perspectiveDistance - rotated.z);

  const leftPercent = 50 + rotated.x * 18 * perspective * zoom;
  const topPercent = 50 - rotated.y * 18 * perspective * zoom;
  const depth = clamp(rotated.z / 2, -1, 1);
  const proximity = (depth + 1) / 2;
  const scale = 0.62 + proximity * 0.46;

  return {
    leftPercent: clamp(leftPercent, 4, 96),
    topPercent: clamp(topPercent, 6, 94),
    depth,
    scale,
    zIndex: Math.round(20 + proximity * 40),
    opacity: 0.3 + proximity * 0.7,
  };
}

export function projectCameraToOrbit(
  camera: Pick<CameraConfig, "yaw" | "pitch" | "distance">,
  view: OrbitViewState = { yaw: -22, pitch: 12, zoom: 1 },
): OrbitProjection {
  return projectOrbitVector(cameraToOrbitVector(camera), view);
}

export function buildRingPath(
  plane: OrbitRingPlane,
  view: OrbitViewState,
  radius = 1.28,
  steps = 84,
) {
  const points = Array.from({ length: steps + 1 }, (_, index) => {
    const angle = (Math.PI * 2 * index) / steps;
    const base =
      plane === "xy"
        ? { x: Math.cos(angle) * radius, y: Math.sin(angle) * radius, z: 0 }
        : plane === "xz"
          ? {
              x: Math.cos(angle) * radius,
              y: 0,
              z: Math.sin(angle) * radius,
            }
          : {
              x: 0,
              y: Math.sin(angle) * radius,
              z: Math.cos(angle) * radius,
            };

    const projected = projectOrbitVector(base, view);
    return `${index === 0 ? "M" : "L"}${projected.leftPercent.toFixed(2)} ${projected.topPercent.toFixed(2)}`;
  });

  return `${points.join(" ")} Z`;
}

export function cameraFromOrbitDrag(input: {
  startYaw: number;
  startPitch: number;
  deltaX: number;
  deltaY: number;
}) {
  return {
    yaw: normalizeYaw(input.startYaw + input.deltaX * 0.55),
    pitch: clamp(input.startPitch - input.deltaY * 0.35, -80, 80),
  };
}

export function orbitViewFromDrag(input: {
  startYaw: number;
  startPitch: number;
  deltaX: number;
  deltaY: number;
}) {
  return {
    yaw: normalizeYaw(input.startYaw + input.deltaX * 0.42),
    pitch: clamp(input.startPitch + input.deltaY * 0.28, -70, 70),
  };
}

export function normalizeYaw(value: number) {
  let next = value;
  while (next > 180) next -= 360;
  while (next < -180) next += 360;
  return Math.round(next);
}

export function inferBackside(camera: Pick<CameraConfig, "yaw">) {
  return Math.abs(normalizeYaw(camera.yaw)) > 90;
}

export function orbitViewLabel(view: Pick<OrbitViewState, "yaw" | "pitch">) {
  const horizontal =
    Math.abs(view.yaw) < 5
      ? "정면"
      : `${Math.abs(Math.round(view.yaw))}° ${view.yaw > 0 ? "우회전" : "좌회전"}`;
  const vertical =
    Math.abs(view.pitch) < 5
      ? "수평"
      : `${Math.abs(Math.round(view.pitch))}° ${view.pitch > 0 ? "상향" : "하향"}`;

  return `${horizontal} · ${vertical}`;
}

export function vectorToCameraOrientation(vector: OrbitVector) {
  const radius = Math.hypot(vector.x, vector.y, vector.z) || 1;
  return {
    yaw: normalizeYaw(degrees(Math.atan2(vector.x, vector.z))),
    pitch: Math.round(clamp(degrees(Math.asin(vector.y / radius)), -80, 80)),
  };
}
