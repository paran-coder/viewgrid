import type { GeneratedImageMetadata } from "@/types/generation";

export type QualityLevel = "stable" | "caution" | "experimental";

export type CameraConfig = {
  id: number;
  label: string;
  yaw: number;
  pitch: number;
  roll: number;
  fov: number;
  distance: number;
  active: boolean;
};

export type StudioView = "editor" | "results";

export type GenerationCell = {
  cameraId: number;
  status:
    "idle" | "queued" | "generating" | "complete" | "failed" | "cancelled";
  revision: number;
  source?: "prototype" | "api";
  resultUrl?: string;
  error?: string;
  metadata?: GeneratedImageMetadata;
};
