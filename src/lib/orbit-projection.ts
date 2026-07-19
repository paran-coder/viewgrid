import type { CameraConfig } from "@/types/camera";

export type OrbitProjection = {
  leftPercent: number;
  topPercent: number;
  depth: number;
  scale: number;
  zIndex: number;
  opacity: number;
};

const radians = (degrees: number) => (degrees * Math.PI) / 180;

/**
 * Projects a camera's yaw/pitch onto an oblique 2D view of a virtual orbit.
 * The projection is intentionally visual rather than physically rendered: it
 * gives users a stable sphere-like editor while the numeric camera parameters
 * remain the source of truth for generation.
 */
export function projectCameraToOrbit(
  camera: Pick<CameraConfig, "yaw" | "pitch" | "distance">,
): OrbitProjection {
  const yaw = radians(camera.yaw);
  const pitch = radians(camera.pitch);
  const distanceScale = Math.max(0.72, Math.min(1.25, camera.distance));

  const x = Math.sin(yaw) * Math.cos(pitch);
  const y = -Math.sin(pitch);
  const depth = Math.cos(yaw) * Math.cos(pitch);

  // Oblique projection: depth slightly lowers front-facing cameras and raises
  // rear-facing cameras, making the orbit read as a 3D cage rather than a grid.
  const leftPercent = 50 + x * 38 * distanceScale;
  const topPercent = 49 + y * 36 * distanceScale + depth * 5;
  const scale = 0.78 + ((depth + 1) / 2) * 0.24;

  return {
    leftPercent: Math.max(7, Math.min(93, leftPercent)),
    topPercent: Math.max(8, Math.min(92, topPercent)),
    depth,
    scale,
    zIndex: Math.round(30 + depth * 10),
    opacity: 0.66 + ((depth + 1) / 2) * 0.34,
  };
}
