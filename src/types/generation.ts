import type { CameraConfig } from "@/types/camera";

export type ProviderId = "openai" | "gemini";

export type OpenAIModelId = "gpt-image-2";
export type GeminiModelId = "gemini-3.1-flash-image" | "gemini-3-pro-image";
export type ImageModelId = OpenAIModelId | GeminiModelId;

export type ConnectionStatus = "idle" | "checking" | "connected" | "failed";

export type CameraGuideSettings = {
  enabled: boolean;
  previewVisible: boolean;
};

export type ConsistencySettings = {
  referenceEnabled: boolean;
  normalizationEnabled: boolean;
};

export type ResultContext = {
  guideEnabled: boolean;
  referenceEnabled: boolean;
  normalizationEnabled: boolean;
};

export type ApiSettings = {
  provider: ProviderId;
  model: ImageModelId;
  apiKey: string;
  keepForTab: boolean;
  connectionStatus: ConnectionStatus;
  connectionMessage: string | null;
};

export type GenerationMode =
  "idle" | "single" | "batch" | "retry" | "prototype";

export type GenerationRun = {
  mode: GenerationMode;
  total: number;
  processed: number;
  completed: number;
  failed: number;
  cancelled: number;
  currentCameraId: number | null;
  currentReferenceCameraId: number | null;
  startedAt: string | null;
  endedAt: string | null;
};

export type GeneratedImageMetadata = {
  provider: ProviderId;
  model: ImageModelId;
  camera: CameraConfig;
  prompt: string;
  mimeType: string;
  byteSize: number;
  durationMs: number;
  createdAt: string;
  guideRequested: boolean;
  guideUsed: boolean;
  guideByteSize?: number;
  guideVersion?: string;
  guideWarning?: string;
  referencePolicyEnabled: boolean;
  referenceRequested: boolean;
  referenceUsed: boolean;
  referenceCameraId?: number;
  referenceByteSize?: number;
  referenceWarning?: string;
  multiviewPlanVersion?: string;
  normalizationRequested: boolean;
  normalized: boolean;
  normalizationVersion?: string;
  normalizedWidth?: number;
  normalizedHeight?: number;
  colorGains?: { r: number; g: number; b: number };
  normalizationReference?: "source" | "generated";
  normalizationWarning?: string;
};

export type ProviderErrorPayload = {
  error: {
    code: string;
    message: string;
    retryable: boolean;
  };
};
