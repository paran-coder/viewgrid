import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/camera-guide", async () => {
  const actual =
    await vi.importActual<typeof import("@/lib/camera-guide")>(
      "@/lib/camera-guide",
    );
  return {
    ...actual,
    loadCameraGuideSource: vi.fn(async () => ({
      naturalWidth: 1024,
      naturalHeight: 1024,
    })),
    createCameraGuideFile: vi.fn(
      async (_image, camera) =>
        new File([new Uint8Array([4, 5, 6])], `camera-${camera.id}-guide.jpg`, {
          type: "image/jpeg",
        }),
    ),
  };
});

vi.mock("@/lib/image-preprocess", async () => {
  const actual = await vi.importActual<typeof import("@/lib/image-preprocess")>(
    "@/lib/image-preprocess",
  );
  return {
    ...actual,
    prepareSourceImage: vi.fn(async () => ({
      file: new File([new Uint8Array([1, 2, 3])], "prepared.jpg", {
        type: "image/jpeg",
      }),
      width: 1024,
      height: 1024,
      byteSize: 3,
    })),
    prepareReferenceImage: vi.fn(async (_url, filename) => ({
      file: new File([new Uint8Array([7, 8, 9])], filename, {
        type: "image/webp",
      }),
      width: 1024,
      height: 1024,
      byteSize: 3,
    })),
  };
});

vi.mock("@/lib/output-normalization", async () => {
  const actual = await vi.importActual<
    typeof import("@/lib/output-normalization")
  >("@/lib/output-normalization");
  return {
    ...actual,
    normalizeGeneratedImage: vi.fn(
      async (blob, _referenceUrl, referenceKind) => ({
        blob: new Blob([await blob.arrayBuffer()], { type: "image/webp" }),
        width: 1024,
        height: 1024,
        colorGains: { r: 1, g: 1, b: 1 },
        referenceKind,
      }),
    ),
  };
});

import { prepareSourceImage } from "@/lib/image-preprocess";
import { cloneCameras, getPreset } from "@/lib/presets";
import { useStudioStore } from "@/store/use-studio-store";

function resetStore() {
  const cameras = cloneCameras(getPreset("product").cameras);
  useStudioStore.setState({
    image: { url: "blob:source", name: "source.png", kind: "static" },
    cameras,
    selectedCameraId: 5,
    selectedPresetId: "product",
    view: "editor",
    generation: cameras.map((camera) => ({
      cameraId: camera.id,
      status: "idle",
      revision: 0,
    })),
    isGenerating: false,
    generationProgress: 0,
    generationRun: {
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
    },
    settingsOpen: false,
    cameraGuide: { enabled: true, previewVisible: true },
    consistency: { referenceEnabled: true, normalizationEnabled: true },
    apiSettings: {
      provider: "openai",
      model: "gpt-image-2",
      apiKey: "sk-store-test-key",
      keepForTab: false,
      connectionStatus: "connected",
      connectionMessage: null,
    },
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  resetStore();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("useStudioStore generation queue", () => {
  it("stores one generated result and clears a one-request API key", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(new Uint8Array([82, 73, 70, 70]), {
        status: 200,
        headers: {
          "Content-Type": "image/webp",
          "X-ViewGrid-Duration-Ms": "1250",
          "X-ViewGrid-Guide-Used": "true",
          "X-ViewGrid-Reference-Used": "false",
        },
      }),
    );

    await useStudioStore.getState().generateSelectedCamera(5);

    const state = useStudioStore.getState();
    const result = state.generation.find((cell) => cell.cameraId === 5);
    expect(state.view).toBe("results");
    expect(state.isGenerating).toBe(false);
    expect(state.generationProgress).toBe(100);
    expect(state.apiSettings.apiKey).toBe("");
    expect(result).toMatchObject({
      status: "complete",
      source: "api",
      resultUrl: "blob:viewgrid-test",
      metadata: {
        provider: "openai",
        model: "gpt-image-2",
        mimeType: "image/webp",
        durationMs: 1250,
      },
    });

    const [, init] = fetchSpy.mock.calls[0];
    expect(init?.headers).toEqual({
      "x-viewgrid-api-key": "sk-store-test-key",
    });
    const body = init?.body as FormData;
    expect(body.get("provider")).toBe("openai");
    expect(body.get("model")).toBe("gpt-image-2");
    expect(body.get("guide")).toBeInstanceOf(File);
    expect(String(body.get("prompt"))).toContain("Image 2 is a rough");
    expect(result?.metadata).toMatchObject({
      guideRequested: true,
      guideUsed: true,
      guideByteSize: 3,
      guideVersion: "perspective-strips-v1",
      referencePolicyEnabled: true,
      referenceRequested: false,
      referenceUsed: false,
      normalizationRequested: true,
      normalized: true,
      normalizedWidth: 1024,
      normalizedHeight: 1024,
    });
  });

  it("opens settings instead of calling the API when the key is missing", async () => {
    useStudioStore.setState((state) => ({
      apiSettings: { ...state.apiSettings, apiKey: "" },
    }));
    const fetchSpy = vi.spyOn(globalThis, "fetch");

    await useStudioStore.getState().generateSelectedCamera(5);

    expect(useStudioStore.getState().settingsOpen).toBe(true);
    expect(useStudioStore.getState().apiSettings.connectionMessage).toContain(
      "API 키가 필요",
    );
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("moves a provider error into the selected result cell", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          error: {
            code: "rate_limit",
            message: "공급자 사용량 제한에 도달했습니다.",
            retryable: true,
          },
        }),
        {
          status: 429,
          headers: { "Content-Type": "application/json" },
        },
      ),
    );

    await useStudioStore.getState().generateSelectedCamera(5);

    const result = useStudioStore
      .getState()
      .generation.find((cell) => cell.cameraId === 5);
    expect(result).toMatchObject({
      status: "failed",
      source: "api",
      error: "공급자 사용량 제한에 도달했습니다.",
    });
  });
  it("restores the selected cell after the user cancels generation", async () => {
    vi.spyOn(globalThis, "fetch").mockImplementation(
      (_url, init) =>
        new Promise((_resolve, reject) => {
          init?.signal?.addEventListener(
            "abort",
            () => reject(new DOMException("aborted", "AbortError")),
            { once: true },
          );
        }),
    );

    const pending = useStudioStore.getState().generateSelectedCamera(5);
    await Promise.resolve();
    useStudioStore.getState().cancelGeneration();
    await pending;

    const state = useStudioStore.getState();
    const result = state.generation.find((cell) => cell.cameraId === 5);
    expect(state.isGenerating).toBe(false);
    expect(state.generationProgress).toBe(0);
    expect(result).toMatchObject({
      status: "cancelled",
      source: "api",
      error: "사용자가 생성 큐를 중단했습니다.",
    });
  });

  it("preprocesses once and generates all active cameras sequentially", async () => {
    const requestedIds: number[] = [];
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockImplementation(async (_url, init) => {
        const body = init?.body as FormData;
        const camera = JSON.parse(String(body.get("camera"))) as { id: number };
        requestedIds.push(camera.id);
        return new Response(new Uint8Array([82, 73, 70, 70]), {
          status: 200,
          headers: {
            "Content-Type": "image/webp",
            "X-ViewGrid-Duration-Ms": "900",
            "X-ViewGrid-Guide-Used": "true",
            "X-ViewGrid-Reference-Used": body.get("reference")
              ? "true"
              : "false",
          },
        });
      });

    await useStudioStore.getState().generateAllCameras();

    const state = useStudioStore.getState();
    expect(vi.mocked(prepareSourceImage)).toHaveBeenCalledTimes(1);
    expect(fetchSpy).toHaveBeenCalledTimes(9);
    expect(requestedIds).toEqual([5, 4, 6, 2, 8, 1, 3, 7, 9]);
    expect(
      fetchSpy.mock.calls.every(
        ([, init]) =>
          (init?.headers as Record<string, string>)["x-viewgrid-api-key"] ===
          "sk-store-test-key",
      ),
    ).toBe(true);
    expect(state.apiSettings.apiKey).toBe("");
    expect(state.generation.every((cell) => cell.status === "complete")).toBe(
      true,
    );
    expect(state.generationRun).toMatchObject({
      mode: "batch",
      total: 9,
      processed: 9,
      completed: 9,
      failed: 0,
      cancelled: 0,
    });
    expect(state.generationProgress).toBe(100);
    expect(
      state.generation.find((cell) => cell.cameraId === 5)?.metadata,
    ).toMatchObject({
      referenceRequested: false,
      referenceUsed: false,
      normalized: true,
    });
    expect(
      state.generation.find((cell) => cell.cameraId === 4)?.metadata,
    ).toMatchObject({
      referenceRequested: true,
      referenceUsed: true,
      referenceCameraId: 5,
      normalized: true,
      normalizationReference: "generated",
    });
  });

  it("continues the queue after a retryable provider failure", async () => {
    let request = 0;
    vi.spyOn(globalThis, "fetch").mockImplementation(async () => {
      request += 1;
      if (request === 1) {
        return new Response(
          JSON.stringify({
            error: {
              code: "rate_limit",
              message: "공급자 사용량 제한에 도달했습니다.",
              retryable: true,
            },
          }),
          { status: 429, headers: { "Content-Type": "application/json" } },
        );
      }
      return new Response(new Uint8Array([1, 2, 3]), {
        status: 200,
        headers: {
          "Content-Type": "image/webp",
          "X-ViewGrid-Guide-Used": "true",
          "X-ViewGrid-Reference-Used": "false",
        },
      });
    });

    await useStudioStore.getState().generateAllCameras();

    const state = useStudioStore.getState();
    expect(state.generationRun).toMatchObject({
      completed: 8,
      failed: 1,
      processed: 9,
    });
    expect(state.generation.find((cell) => cell.cameraId === 5)).toMatchObject({
      status: "failed",
      error: "공급자 사용량 제한에 도달했습니다.",
    });
    expect(
      state.generation
        .filter((cell) => cell.cameraId !== 5)
        .every((cell) => cell.status === "complete"),
    ).toBe(true);
  });

  it("cancels the active request and marks the remaining batch as cancelled", async () => {
    vi.spyOn(globalThis, "fetch").mockImplementation(
      (_url, init) =>
        new Promise((_resolve, reject) => {
          init?.signal?.addEventListener(
            "abort",
            () => reject(new DOMException("aborted", "AbortError")),
            { once: true },
          );
        }),
    );

    const pending = useStudioStore.getState().generateAllCameras();
    await Promise.resolve();
    useStudioStore.getState().cancelGeneration();
    await pending;

    const state = useStudioStore.getState();
    expect(state.isGenerating).toBe(false);
    expect(state.generationRun.cancelled).toBe(9);
    expect(state.generation.every((cell) => cell.status === "cancelled")).toBe(
      true,
    );
  });

  it("retries only failed and cancelled active cameras", async () => {
    useStudioStore.setState((state) => ({
      generation: state.generation.map((cell) =>
        cell.cameraId === 2
          ? { ...cell, status: "failed", source: "api", error: "failed" }
          : cell.cameraId === 7
            ? {
                ...cell,
                status: "cancelled",
                source: "api",
                error: "cancelled",
              }
            : {
                ...cell,
                status: "complete",
                source: "api",
                resultUrl: "blob:old",
              },
      ),
    }));
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockImplementation(
      async () =>
        new Response(new Uint8Array([1, 2, 3]), {
          status: 200,
          headers: {
            "Content-Type": "image/webp",
            "X-ViewGrid-Guide-Used": "true",
            "X-ViewGrid-Reference-Used": "false",
          },
        }),
    );

    await useStudioStore.getState().retryIncompleteCameras();

    expect(fetchSpy).toHaveBeenCalledTimes(2);
    expect(useStudioStore.getState().generationRun.mode).toBe("retry");
    expect(
      useStudioStore
        .getState()
        .generation.filter((cell) => cell.cameraId === 2 || cell.cameraId === 7)
        .every((cell) => cell.status === "complete"),
    ).toBe(true);
  });

  it("falls back to source-only generation when the guide is disabled", async () => {
    useStudioStore.setState({
      cameraGuide: { enabled: false, previewVisible: true },
    });
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(new Uint8Array([1, 2, 3]), {
        status: 200,
        headers: {
          "Content-Type": "image/webp",
          "X-ViewGrid-Guide-Used": "false",
          "X-ViewGrid-Reference-Used": "false",
        },
      }),
    );

    await useStudioStore.getState().generateSelectedCamera(5);

    const body = fetchSpy.mock.calls[0]?.[1]?.body as FormData;
    expect(body.get("guide")).toBeNull();
    expect(String(body.get("prompt"))).not.toContain("Image 2 is a rough");
    expect(
      useStudioStore.getState().generation.find((cell) => cell.cameraId === 5)
        ?.metadata,
    ).toMatchObject({ guideRequested: false, guideUsed: false });
  });

  it("deletes one generated result and revokes its Blob URL", () => {
    useStudioStore.setState((state) => ({
      generation: state.generation.map((cell) =>
        cell.cameraId === 5
          ? {
              ...cell,
              status: "complete",
              source: "api",
              resultUrl: "blob:delete-me",
            }
          : cell,
      ),
    }));
    const revokeSpy = vi.spyOn(URL, "revokeObjectURL");

    useStudioStore.getState().deleteGenerationResult(5);

    expect(revokeSpy).toHaveBeenCalledWith("blob:delete-me");
    expect(
      useStudioStore.getState().generation.find((cell) => cell.cameraId === 5),
    ).toMatchObject({ status: "idle", revision: 0 });
  });
});
