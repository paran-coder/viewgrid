"use client";

import { create } from "zustand";

import { buildCameraPrompt } from "@/lib/camera-prompt";
import {
  CAMERA_GUIDE_VERSION,
  createCameraGuideFile,
  loadCameraGuideSource,
} from "@/lib/camera-guide";
import {
  prepareReferenceImage,
  prepareSourceImage,
} from "@/lib/image-preprocess";
import {
  findReferenceResult,
  MULTIVIEW_PLAN_VERSION,
  orderCameraIds,
  PREFERRED_REFERENCE_CAMERA,
} from "@/lib/multiview-consistency";
import {
  normalizeGeneratedImage,
  OUTPUT_NORMALIZATION_VERSION,
} from "@/lib/output-normalization";
import {
  DEFAULT_MODEL_BY_PROVIDER,
  isAllowedModel,
} from "@/lib/providers/models";
import {
  cloneCameras,
  getPreset,
  type PresetId,
  type PresetSelection,
} from "@/lib/presets";
import { clamp } from "@/lib/utils";
import type { CameraConfig, GenerationCell, StudioView } from "@/types/camera";
import type {
  ApiSettings,
  CameraGuideSettings,
  ConsistencySettings,
  GenerationMode,
  GenerationRun,
  ImageModelId,
  ProviderErrorPayload,
  ProviderId,
} from "@/types/generation";

type ImageSource = {
  url: string;
  name: string;
  kind: "object-url" | "static";
};

type StudioState = {
  image: ImageSource | null;
  cameras: CameraConfig[];
  selectedCameraId: number;
  selectedPresetId: PresetSelection;
  view: StudioView;
  generation: GenerationCell[];
  isGenerating: boolean;
  generationProgress: number;
  generationRun: GenerationRun;
  settingsOpen: boolean;
  apiSettings: ApiSettings;
  cameraGuide: CameraGuideSettings;
  consistency: ConsistencySettings;
  setImage: (image: ImageSource) => void;
  clearImage: () => void;
  selectCamera: (id: number) => void;
  updateCamera: (
    id: number,
    key: keyof Pick<
      CameraConfig,
      "yaw" | "pitch" | "roll" | "fov" | "distance"
    >,
    value: number,
  ) => void;
  toggleCamera: (id: number) => void;
  resetCamera: (id: number) => void;
  copyCameraToAll: (id: number) => void;
  applyPreset: (id: PresetId) => void;
  startFakeGeneration: () => void;
  regenerateCell: (cameraId: number) => void;
  setView: (view: StudioView) => void;
  resetProject: () => void;
  openSettings: () => void;
  closeSettings: () => void;
  setProvider: (provider: ProviderId) => void;
  setModel: (model: ImageModelId) => void;
  setApiKey: (apiKey: string) => void;
  setKeepForTab: (keepForTab: boolean) => void;
  setGuideEnabled: (enabled: boolean) => void;
  setGuidePreviewVisible: (visible: boolean) => void;
  setReferenceEnabled: (enabled: boolean) => void;
  setNormalizationEnabled: (enabled: boolean) => void;
  applyImportedPreset: (input: {
    cameras: CameraConfig[];
    guideEnabled: boolean;
    consistency: ConsistencySettings;
  }) => void;
  testConnection: () => Promise<void>;
  generateSelectedCamera: (cameraId?: number) => Promise<void>;
  generateAllCameras: () => Promise<void>;
  retryIncompleteCameras: () => Promise<void>;
  cancelGeneration: () => void;
  clearGenerationError: (cameraId: number) => void;
  deleteGenerationResult: (cameraId: number) => void;
};

const LIMITS = {
  yaw: [-180, 180],
  pitch: [-80, 80],
  roll: [-20, 20],
  fov: [20, 100],
  distance: [0.6, 2],
} as const;

const defaultCameras = cloneCameras(getPreset("product").cameras);
let activeGenerationController: AbortController | null = null;
let connectionController: AbortController | null = null;
let prototypeTimers: number[] = [];

function emptyGenerationRun(): GenerationRun {
  return {
    mode: "idle",
    total: 0,
    processed: 0,
    completed: 0,
    failed: 0,
    cancelled: 0,
    currentCameraId: null,
    currentReferenceCameraId: null,
    startedAt: null,
    endedAt: null,
  };
}

function blankGeneration(cameras: CameraConfig[]): GenerationCell[] {
  return cameras.map((camera) => ({
    cameraId: camera.id,
    status: "idle",
    revision: 0,
  }));
}

function revokeIfNeeded(image: ImageSource | null) {
  if (
    image?.kind === "object-url" &&
    typeof URL !== "undefined" &&
    typeof URL.revokeObjectURL === "function"
  ) {
    URL.revokeObjectURL(image.url);
  }
}

function revokeCellUrl(cell?: GenerationCell) {
  if (
    cell?.source === "api" &&
    cell.resultUrl?.startsWith("blob:") &&
    typeof URL !== "undefined" &&
    typeof URL.revokeObjectURL === "function"
  ) {
    URL.revokeObjectURL(cell.resultUrl);
  }
}

function revokeGenerationUrls(cells: GenerationCell[]) {
  for (const cell of cells) revokeCellUrl(cell);
}

async function readProviderError(response: Response) {
  const payload = (await response
    .json()
    .catch(() => null)) as ProviderErrorPayload | null;
  return {
    code: payload?.error?.code ?? `http_${response.status}`,
    message:
      payload?.error?.message ?? `요청에 실패했습니다. (${response.status})`,
    retryable: payload?.error?.retryable ?? response.status >= 500,
  };
}

class ClientGenerationError extends Error {
  code: string;
  retryable: boolean;

  constructor(code: string, message: string, retryable: boolean) {
    super(message);
    this.name = "ClientGenerationError";
    this.code = code;
    this.retryable = retryable;
  }
}

function progressFor(processed: number, total: number, fraction = 0) {
  if (total <= 0) return 0;
  return Math.min(99, Math.round(((processed + fraction) / total) * 100));
}

function markRemainingCancelled(cameraIds: number[], message: string) {
  const targets = new Set(cameraIds);
  useStudioStore.setState((state) => ({
    generation: state.generation.map((cell) =>
      targets.has(cell.cameraId) &&
      (cell.status === "queued" || cell.status === "generating")
        ? {
            ...cell,
            status: "cancelled",
            source: "api",
            error: message,
          }
        : cell,
    ),
  }));
}

async function executeGenerationQueue(
  requestedCameraIds: number[],
  mode: Exclude<GenerationMode, "idle" | "prototype">,
) {
  const initial = useStudioStore.getState();
  if (initial.isGenerating || !initial.image) return;

  const cameraIds = orderCameraIds(
    [...new Set(requestedCameraIds)].filter((id) =>
      initial.cameras.some((camera) => camera.id === id && camera.active),
    ),
  );
  if (cameraIds.length === 0) return;

  const apiKey = initial.apiSettings.apiKey.trim();
  if (!apiKey) {
    useStudioStore.setState((state) => ({
      settingsOpen: true,
      apiSettings: {
        ...state.apiSettings,
        connectionStatus: "failed",
        connectionMessage: "실제 생성을 시작하려면 API 키가 필요합니다.",
      },
    }));
    return;
  }

  activeGenerationController?.abort();
  activeGenerationController = new AbortController();
  const controller = activeGenerationController;
  const startedAt = new Date().toISOString();
  const targetSet = new Set(cameraIds);

  useStudioStore.setState((state) => ({
    isGenerating: true,
    generationProgress: 1,
    view: "results",
    generationRun: {
      mode,
      total: cameraIds.length,
      processed: 0,
      completed: 0,
      failed: 0,
      cancelled: 0,
      currentCameraId: null,
      currentReferenceCameraId: null,
      startedAt,
      endedAt: null,
    },
    generation: state.generation.map((cell) =>
      targetSet.has(cell.cameraId)
        ? {
            ...cell,
            status: "queued",
            source: "api",
            error: undefined,
          }
        : cell,
    ),
  }));

  let processed = 0;
  let completed = 0;
  let failed = 0;
  let cancelled = 0;

  try {
    const source = initial.image;
    const prepared = await prepareSourceImage(source.url, source.name);
    let guideSource: HTMLImageElement | null = null;
    let guideSourceWarning: string | undefined;
    if (initial.cameraGuide.enabled) {
      try {
        guideSource = await loadCameraGuideSource(source.url);
      } catch (error) {
        guideSourceWarning =
          error instanceof Error
            ? error.message
            : "카메라 가이드를 만들지 못해 원본만 사용합니다.";
      }
    }
    useStudioStore.setState({
      generationProgress: progressFor(0, cameraIds.length, 0.08),
    });

    for (let index = 0; index < cameraIds.length; index += 1) {
      const cameraId = cameraIds[index];
      if (controller.signal.aborted) {
        const remaining = cameraIds.slice(index);
        cancelled += remaining.length;
        markRemainingCancelled(remaining, "사용자가 생성 큐를 중단했습니다.");
        break;
      }

      const latest = useStudioStore.getState();
      const camera = latest.cameras.find((item) => item.id === cameraId);
      if (!camera?.active) {
        cancelled += 1;
        useStudioStore.setState((state) => ({
          generation: state.generation.map((cell) =>
            cell.cameraId === cameraId
              ? {
                  ...cell,
                  status: "cancelled",
                  source: "api",
                  error: "카메라가 비활성화되어 큐에서 제외됐습니다.",
                }
              : cell,
          ),
        }));
        continue;
      }

      const previousCell = latest.generation.find(
        (cell) => cell.cameraId === cameraId,
      );
      revokeCellUrl(previousCell);
      useStudioStore.setState((state) => ({
        generationProgress: progressFor(processed, cameraIds.length, 0.12),
        generationRun: {
          ...state.generationRun,
          currentCameraId: cameraId,
          currentReferenceCameraId: null,
          processed,
          completed,
          failed,
          cancelled,
        },
        generation: state.generation.map((cell) =>
          cell.cameraId === cameraId
            ? {
                ...cell,
                status: "generating",
                source: "api",
                resultUrl: undefined,
                metadata: undefined,
                error: undefined,
              }
            : cell,
        ),
      }));

      let guideFile: File | undefined;
      let guideWarning = guideSourceWarning;
      if (initial.cameraGuide.enabled && guideSource) {
        try {
          guideFile = await createCameraGuideFile(
            guideSource,
            camera,
            source.name,
          );
        } catch (error) {
          guideWarning =
            error instanceof Error
              ? error.message
              : "카메라 가이드를 만들지 못해 원본만 사용합니다.";
        }
      }

      const resultContext = {
        provider: initial.apiSettings.provider,
        model: initial.apiSettings.model,
        guideEnabled: initial.cameraGuide.enabled,
        referenceEnabled: initial.consistency.referenceEnabled,
        normalizationEnabled: initial.consistency.normalizationEnabled,
      };
      const preferredReferenceCameraId =
        PREFERRED_REFERENCE_CAMERA[cameraId] ?? null;
      const referenceResult = findReferenceResult(
        cameraId,
        latest.cameras,
        latest.generation,
        resultContext,
      );
      let referenceFile: File | undefined;
      let referenceWarning: string | undefined;
      if (initial.consistency.referenceEnabled && referenceResult) {
        try {
          const preparedReference = await prepareReferenceImage(
            referenceResult.cell.resultUrl!,
            `${referenceResult.camera.label}-reference.webp`,
          );
          referenceFile = preparedReference.file;
        } catch (error) {
          referenceWarning =
            error instanceof Error
              ? error.message
              : "인접 결과 참조를 준비하지 못했습니다.";
        }
      } else if (
        initial.consistency.referenceEnabled &&
        preferredReferenceCameraId
      ) {
        referenceWarning = `${preferredReferenceCameraId}번 기준 결과가 없어 원본과 가이드만 사용합니다.`;
      }

      useStudioStore.setState((state) => ({
        generationRun: {
          ...state.generationRun,
          currentReferenceCameraId: referenceFile
            ? (referenceResult?.camera.id ?? null)
            : null,
        },
      }));

      const prompt = buildCameraPrompt(camera, {
        hasGuide: Boolean(guideFile),
        hasReference: Boolean(referenceFile),
        referenceCameraLabel: referenceResult?.camera.label,
      });
      const form = new FormData();
      form.append("provider", initial.apiSettings.provider);
      form.append("model", initial.apiSettings.model);
      form.append("prompt", prompt);
      form.append("camera", JSON.stringify(camera));
      form.append("image", prepared.file, prepared.file.name);
      if (guideFile) form.append("guide", guideFile, guideFile.name);
      if (referenceFile) {
        form.append("reference", referenceFile, referenceFile.name);
      }

      try {
        useStudioStore.setState({
          generationProgress: progressFor(processed, cameraIds.length, 0.28),
        });
        const response = await fetch("/api/generate", {
          method: "POST",
          headers: { "x-viewgrid-api-key": apiKey },
          body: form,
          signal: controller.signal,
          cache: "no-store",
        });
        if (!response.ok) {
          const error = await readProviderError(response);
          throw new ClientGenerationError(
            error.code,
            error.message,
            error.retryable,
          );
        }

        useStudioStore.setState({
          generationProgress: progressFor(processed, cameraIds.length, 0.88),
        });
        const rawBlob = await response.blob();
        const durationMs = Number(
          response.headers.get("x-viewgrid-duration-ms") ?? 0,
        );
        const guideUsed =
          response.headers.get("x-viewgrid-guide-used") === "true";
        const referenceUsed =
          response.headers.get("x-viewgrid-reference-used") === "true";
        let finalBlob = rawBlob;
        let normalization:
          Awaited<ReturnType<typeof normalizeGeneratedImage>> | undefined;
        let normalizationWarning: string | undefined;
        if (initial.consistency.normalizationEnabled) {
          try {
            normalization = await normalizeGeneratedImage(
              rawBlob,
              referenceResult?.cell.resultUrl ?? source.url,
              referenceResult ? "generated" : "source",
            );
            finalBlob = normalization.blob;
          } catch (error) {
            normalizationWarning =
              error instanceof Error
                ? error.message
                : "출력 정규화를 적용하지 못했습니다.";
          }
        }
        const resultUrl = URL.createObjectURL(finalBlob);
        processed += 1;
        completed += 1;

        useStudioStore.setState((state) => ({
          generationProgress: Math.round((processed / cameraIds.length) * 100),
          generationRun: {
            ...state.generationRun,
            processed,
            completed,
            failed,
            cancelled,
            currentCameraId: null,
            currentReferenceCameraId: null,
          },
          generation: state.generation.map((cell) =>
            cell.cameraId === cameraId
              ? {
                  ...cell,
                  status: "complete",
                  source: "api",
                  resultUrl,
                  revision: cell.revision + (previousCell?.metadata ? 1 : 0),
                  metadata: {
                    provider: initial.apiSettings.provider,
                    model: initial.apiSettings.model,
                    camera: { ...camera },
                    prompt,
                    mimeType: finalBlob.type || rawBlob.type || "image/png",
                    byteSize: finalBlob.size,
                    durationMs,
                    createdAt: new Date().toISOString(),
                    guideRequested: initial.cameraGuide.enabled,
                    guideUsed,
                    guideByteSize: guideFile?.size,
                    guideVersion: guideUsed ? CAMERA_GUIDE_VERSION : undefined,
                    guideWarning: guideUsed ? undefined : guideWarning,
                    referencePolicyEnabled:
                      initial.consistency.referenceEnabled,
                    referenceRequested: Boolean(
                      initial.consistency.referenceEnabled &&
                      preferredReferenceCameraId,
                    ),
                    referenceUsed,
                    referenceCameraId: referenceUsed
                      ? referenceResult?.camera.id
                      : undefined,
                    referenceByteSize: referenceUsed
                      ? referenceFile?.size
                      : undefined,
                    referenceWarning: referenceUsed
                      ? undefined
                      : referenceWarning,
                    multiviewPlanVersion: MULTIVIEW_PLAN_VERSION,
                    normalizationRequested:
                      initial.consistency.normalizationEnabled,
                    normalized: Boolean(normalization),
                    normalizationVersion: normalization
                      ? OUTPUT_NORMALIZATION_VERSION
                      : undefined,
                    normalizedWidth: normalization?.width,
                    normalizedHeight: normalization?.height,
                    colorGains: normalization?.colorGains,
                    normalizationReference: normalization?.referenceKind,
                    normalizationWarning,
                  },
                }
              : cell,
          ),
        }));
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") {
          processed += 0;
          const remaining = cameraIds.slice(index);
          cancelled += remaining.length;
          markRemainingCancelled(remaining, "사용자가 생성 큐를 중단했습니다.");
          break;
        }

        processed += 1;
        failed += 1;
        const message =
          error instanceof Error
            ? error.message
            : "이미지 생성에 실패했습니다.";
        const retryable =
          error instanceof ClientGenerationError ? error.retryable : true;
        useStudioStore.setState((state) => ({
          generationProgress: Math.round((processed / cameraIds.length) * 100),
          generationRun: {
            ...state.generationRun,
            processed,
            completed,
            failed,
            cancelled,
            currentCameraId: null,
            currentReferenceCameraId: null,
          },
          generation: state.generation.map((cell) =>
            cell.cameraId === cameraId
              ? {
                  ...cell,
                  status: "failed",
                  source: "api",
                  resultUrl: undefined,
                  metadata: undefined,
                  error: message,
                }
              : cell,
          ),
        }));

        if (!retryable) {
          const remaining = cameraIds.slice(index + 1);
          cancelled += remaining.length;
          markRemainingCancelled(
            remaining,
            "복구할 수 없는 공급자 오류로 나머지 큐가 중단됐습니다.",
          );
          break;
        }
      }
    }
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "원본 이미지 전처리에 실패했습니다.";
    const pending = cameraIds.filter((cameraId) => {
      const cell = useStudioStore
        .getState()
        .generation.find((item) => item.cameraId === cameraId);
      return cell?.status === "queued" || cell?.status === "generating";
    });
    failed += pending.length;
    processed += pending.length;
    const pendingSet = new Set(pending);
    useStudioStore.setState((state) => ({
      generation: state.generation.map((cell) =>
        pendingSet.has(cell.cameraId)
          ? {
              ...cell,
              status: "failed",
              source: "api",
              resultUrl: undefined,
              metadata: undefined,
              error: message,
            }
          : cell,
      ),
    }));
  } finally {
    const endedAt = new Date().toISOString();
    useStudioStore.setState((state) => ({
      isGenerating: false,
      generationProgress:
        processed === cameraIds.length
          ? 100
          : Math.round((processed / cameraIds.length) * 100),
      generationRun: {
        ...state.generationRun,
        processed,
        completed,
        failed,
        cancelled,
        currentCameraId: null,
        currentReferenceCameraId: null,
        endedAt,
      },
      apiSettings: {
        ...state.apiSettings,
        apiKey: state.apiSettings.keepForTab ? state.apiSettings.apiKey : "",
      },
    }));
    activeGenerationController = null;
  }
}

export const useStudioStore = create<StudioState>((set, get) => ({
  image: null,
  cameras: defaultCameras,
  selectedCameraId: 5,
  selectedPresetId: "product",
  view: "editor",
  generation: blankGeneration(defaultCameras),
  isGenerating: false,
  generationProgress: 0,
  generationRun: emptyGenerationRun(),
  settingsOpen: false,
  cameraGuide: {
    enabled: true,
    previewVisible: true,
  },
  consistency: {
    referenceEnabled: true,
    normalizationEnabled: true,
  },
  apiSettings: {
    provider: "gemini",
    model: DEFAULT_MODEL_BY_PROVIDER.gemini,
    apiKey: "",
    keepForTab: true,
    connectionStatus: "idle",
    connectionMessage: null,
  },

  setImage: (image) => {
    revokeIfNeeded(get().image);
    revokeGenerationUrls(get().generation);
    set({
      image,
      view: "editor",
      generation: blankGeneration(get().cameras),
      generationProgress: 0,
      generationRun: emptyGenerationRun(),
    });
  },

  clearImage: () => {
    revokeIfNeeded(get().image);
    revokeGenerationUrls(get().generation);
    set({
      image: null,
      view: "editor",
      generation: blankGeneration(get().cameras),
      generationProgress: 0,
      generationRun: emptyGenerationRun(),
    });
  },

  selectCamera: (id) => set({ selectedCameraId: id }),

  updateCamera: (id, key, value) => {
    const [min, max] = LIMITS[key];
    set((state) => ({
      cameras: state.cameras.map((camera) =>
        camera.id === id
          ? { ...camera, [key]: clamp(value, min, max) }
          : camera,
      ),
      selectedPresetId: "custom",
    }));
  },

  toggleCamera: (id) =>
    set((state) => ({
      cameras: state.cameras.map((camera) =>
        camera.id === id ? { ...camera, active: !camera.active } : camera,
      ),
    })),

  resetCamera: (id) => {
    const baseline = getPreset("product").cameras.find(
      (camera) => camera.id === id,
    );
    if (!baseline) return;
    set((state) => ({
      cameras: state.cameras.map((camera) =>
        camera.id === id ? { ...baseline } : camera,
      ),
      selectedPresetId: "custom",
    }));
  },

  copyCameraToAll: (id) => {
    const source = get().cameras.find((camera) => camera.id === id);
    if (!source) return;
    set((state) => ({
      cameras: state.cameras.map((camera) => ({
        ...camera,
        yaw: source.yaw,
        pitch: source.pitch,
        roll: source.roll,
        fov: source.fov,
        distance: source.distance,
      })),
      selectedPresetId: "custom",
    }));
  },

  applyPreset: (id) => {
    revokeGenerationUrls(get().generation);
    const cameras = cloneCameras(getPreset(id).cameras);
    set({
      cameras,
      selectedPresetId: id,
      selectedCameraId: 1,
      view: "editor",
      generation: blankGeneration(cameras),
      generationProgress: 0,
      generationRun: emptyGenerationRun(),
    });
  },

  startFakeGeneration: () => {
    const activeIds = get()
      .cameras.filter((camera) => camera.active)
      .map((camera) => camera.id);
    if (!get().image || activeIds.length === 0 || get().isGenerating) return;

    revokeGenerationUrls(get().generation);
    prototypeTimers.forEach((timer) => window.clearTimeout(timer));
    prototypeTimers = [];
    set((state) => ({
      isGenerating: true,
      view: "results",
      generationProgress: 0,
      generationRun: {
        mode: "prototype",
        total: activeIds.length,
        processed: 0,
        completed: 0,
        failed: 0,
        cancelled: 0,
        currentCameraId: activeIds[0] ?? null,
        currentReferenceCameraId: null,
        startedAt: new Date().toISOString(),
        endedAt: null,
      },
      generation: state.generation.map((cell) =>
        activeIds.includes(cell.cameraId)
          ? {
              ...cell,
              status: "queued",
              source: "prototype",
              resultUrl: undefined,
              metadata: undefined,
              error: undefined,
            }
          : { ...cell, status: "idle" },
      ),
    }));

    activeIds.forEach((cameraId, index) => {
      const startTimer = window.setTimeout(() => {
        set((state) => ({
          generationRun: {
            ...state.generationRun,
            currentCameraId: cameraId,
          },
          generation: state.generation.map((cell) =>
            cell.cameraId === cameraId
              ? { ...cell, status: "generating" }
              : cell,
          ),
        }));
      }, 220 * index);
      const completeTimer = window.setTimeout(
        () => {
          set((state) => ({
            generation: state.generation.map((cell) =>
              cell.cameraId === cameraId
                ? { ...cell, status: "complete", source: "prototype" }
                : cell,
            ),
            generationProgress: Math.round(
              ((index + 1) / activeIds.length) * 100,
            ),
            isGenerating: index + 1 < activeIds.length,
            generationRun: {
              ...state.generationRun,
              processed: index + 1,
              completed: index + 1,
              currentCameraId:
                index + 1 < activeIds.length ? activeIds[index + 1] : null,
              endedAt:
                index + 1 === activeIds.length
                  ? new Date().toISOString()
                  : null,
            },
          }));
        },
        220 * (index + 1),
      );
      prototypeTimers.push(startTimer, completeTimer);
    });
  },

  regenerateCell: (cameraId) => {
    const cell = get().generation.find((item) => item.cameraId === cameraId);
    if (
      cell?.source === "api" ||
      cell?.status === "failed" ||
      cell?.status === "cancelled"
    ) {
      void executeGenerationQueue([cameraId], "single");
      return;
    }
    if (get().isGenerating) return;
    set((state) => ({
      generation: state.generation.map((item) =>
        item.cameraId === cameraId ? { ...item, status: "generating" } : item,
      ),
    }));
    window.setTimeout(() => {
      set((state) => ({
        generation: state.generation.map((item) =>
          item.cameraId === cameraId
            ? {
                ...item,
                status: "complete",
                source: "prototype",
                revision: item.revision + 1,
              }
            : item,
        ),
      }));
    }, 700);
  },

  setView: (view) => set({ view }),

  resetProject: () => {
    activeGenerationController?.abort();
    prototypeTimers.forEach((timer) => window.clearTimeout(timer));
    prototypeTimers = [];
    revokeIfNeeded(get().image);
    revokeGenerationUrls(get().generation);
    const cameras = cloneCameras(getPreset("product").cameras);
    set((state) => ({
      image: null,
      cameras,
      selectedCameraId: 5,
      selectedPresetId: "product",
      view: "editor",
      generation: blankGeneration(cameras),
      isGenerating: false,
      generationProgress: 0,
      generationRun: emptyGenerationRun(),
      settingsOpen: false,
      cameraGuide: {
        enabled: true,
        previewVisible: true,
      },
      consistency: {
        referenceEnabled: true,
        normalizationEnabled: true,
      },
      apiSettings: {
        ...state.apiSettings,
        apiKey: state.apiSettings.keepForTab ? state.apiSettings.apiKey : "",
        connectionStatus: "idle",
        connectionMessage: null,
      },
    }));
  },

  openSettings: () => set({ settingsOpen: true }),
  closeSettings: () => set({ settingsOpen: false }),

  setProvider: (provider) =>
    set((state) => ({
      apiSettings: {
        ...state.apiSettings,
        provider,
        model: DEFAULT_MODEL_BY_PROVIDER[provider],
        connectionStatus: "idle",
        connectionMessage: null,
      },
    })),

  setModel: (model) => {
    const { provider } = get().apiSettings;
    if (!isAllowedModel(provider, model)) return;
    set((state) => ({
      apiSettings: {
        ...state.apiSettings,
        model,
        connectionStatus: "idle",
        connectionMessage: null,
      },
    }));
  },

  setApiKey: (apiKey) =>
    set((state) => ({
      apiSettings: {
        ...state.apiSettings,
        apiKey,
        connectionStatus: "idle",
        connectionMessage: null,
      },
    })),

  setKeepForTab: (keepForTab) =>
    set((state) => ({
      apiSettings: { ...state.apiSettings, keepForTab },
    })),

  setGuideEnabled: (enabled) =>
    set((state) => ({
      cameraGuide: { ...state.cameraGuide, enabled },
    })),

  setGuidePreviewVisible: (previewVisible) =>
    set((state) => ({
      cameraGuide: { ...state.cameraGuide, previewVisible },
    })),

  setReferenceEnabled: (referenceEnabled) =>
    set((state) => ({
      consistency: { ...state.consistency, referenceEnabled },
    })),

  setNormalizationEnabled: (normalizationEnabled) =>
    set((state) => ({
      consistency: { ...state.consistency, normalizationEnabled },
    })),

  applyImportedPreset: ({ cameras, guideEnabled, consistency }) => {
    const normalizedCameras = cloneCameras(cameras);
    set((state) => ({
      cameras: normalizedCameras,
      selectedPresetId: "custom",
      selectedCameraId: 5,
      view: "editor",
      cameraGuide: { ...state.cameraGuide, enabled: guideEnabled },
      consistency: { ...consistency },
    }));
  },

  testConnection: async () => {
    const { apiSettings } = get();
    if (!apiSettings.apiKey.trim()) {
      set((state) => ({
        apiSettings: {
          ...state.apiSettings,
          connectionStatus: "failed",
          connectionMessage: "API 키를 입력해 주세요.",
        },
      }));
      return;
    }

    connectionController?.abort();
    connectionController = new AbortController();
    set((state) => ({
      apiSettings: {
        ...state.apiSettings,
        connectionStatus: "checking",
        connectionMessage: "연결을 확인하고 있습니다.",
      },
    }));

    try {
      const response = await fetch("/api/connection", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-viewgrid-api-key": apiSettings.apiKey,
        },
        body: JSON.stringify({
          provider: apiSettings.provider,
          model: apiSettings.model,
        }),
        signal: connectionController.signal,
        cache: "no-store",
      });
      if (!response.ok) {
        const error = await readProviderError(response);
        throw new Error(error.message);
      }
      const payload = (await response.json()) as { message?: string };
      set((state) => ({
        apiSettings: {
          ...state.apiSettings,
          connectionStatus: "connected",
          connectionMessage:
            payload.message ?? "API 키와 모델 연결을 확인했습니다.",
        },
      }));
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      set((state) => ({
        apiSettings: {
          ...state.apiSettings,
          connectionStatus: "failed",
          connectionMessage:
            error instanceof Error
              ? error.message
              : "연결을 확인하지 못했습니다.",
        },
      }));
    }
  },

  generateSelectedCamera: async (cameraId) => {
    const targetId = cameraId ?? get().selectedCameraId;
    await executeGenerationQueue([targetId], "single");
  },

  generateAllCameras: async () => {
    const activeIds = get()
      .cameras.filter((camera) => camera.active)
      .map((camera) => camera.id);
    await executeGenerationQueue(activeIds, "batch");
  },

  retryIncompleteCameras: async () => {
    const state = get();
    const incomplete = state.generation
      .filter(
        (cell) =>
          (cell.status === "failed" || cell.status === "cancelled") &&
          state.cameras.some(
            (camera) => camera.id === cell.cameraId && camera.active,
          ),
      )
      .map((cell) => cell.cameraId);
    await executeGenerationQueue(incomplete, "retry");
  },

  cancelGeneration: () => {
    activeGenerationController?.abort();
  },

  clearGenerationError: (cameraId) =>
    set((state) => ({
      generation: state.generation.map((cell) =>
        cell.cameraId === cameraId
          ? {
              ...cell,
              status: "idle",
              error: undefined,
              source: undefined,
            }
          : cell,
      ),
    })),

  deleteGenerationResult: (cameraId) => {
    const cell = get().generation.find((item) => item.cameraId === cameraId);
    revokeCellUrl(cell);
    set((state) => ({
      generation: state.generation.map((item) =>
        item.cameraId === cameraId
          ? { cameraId, status: "idle", revision: item.revision }
          : item,
      ),
    }));
  },
}));
