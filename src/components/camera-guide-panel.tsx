"use client";

import {
  Eye,
  EyeOff,
  Image as ImageIcon,
  LoaderCircle,
  Route,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import {
  CAMERA_GUIDE_VERSION,
  createCameraGuideFile,
  loadCameraGuideSource,
} from "@/lib/camera-guide";
import { formatBytes } from "@/lib/image-preprocess";
import { cn } from "@/lib/utils";
import { useStudioStore } from "@/store/use-studio-store";

export function CameraGuidePanel() {
  const image = useStudioStore((state) => state.image);
  const cameras = useStudioStore((state) => state.cameras);
  const selectedCameraId = useStudioStore((state) => state.selectedCameraId);
  const guide = useStudioStore((state) => state.cameraGuide);
  const isGenerating = useStudioStore((state) => state.isGenerating);
  const setGuideEnabled = useStudioStore((state) => state.setGuideEnabled);
  const setGuidePreviewVisible = useStudioStore(
    (state) => state.setGuidePreviewVisible,
  );
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewBytes, setPreviewBytes] = useState(0);
  const [status, setStatus] = useState<"idle" | "loading" | "ready" | "error">(
    "idle",
  );
  const [message, setMessage] = useState<string | null>(null);

  const camera = useMemo(
    () => cameras.find((item) => item.id === selectedCameraId),
    [cameras, selectedCameraId],
  );

  useEffect(() => {
    if (!image || !camera || !guide.previewVisible) return;
    let disposed = false;
    let pendingUrl: string | null = null;
    const timer = window.setTimeout(() => {
      setStatus("loading");
      setMessage(null);
      void (async () => {
        try {
          const source = await loadCameraGuideSource(image.url);
          const file = await createCameraGuideFile(source, camera, image.name, {
            maxEdge: 720,
            maxBytes: 520_000,
            quality: 0.82,
            stripCount: 72,
          });
          pendingUrl = URL.createObjectURL(file);
          if (disposed) {
            URL.revokeObjectURL(pendingUrl);
            pendingUrl = null;
            return;
          }
          setPreviewUrl(pendingUrl);
          pendingUrl = null;
          setPreviewBytes(file.size);
          setStatus("ready");
        } catch (error) {
          if (disposed) return;
          setStatus("error");
          setMessage(
            error instanceof Error
              ? error.message
              : "카메라 가이드 미리보기를 만들지 못했습니다.",
          );
        }
      })();
    }, 180);

    return () => {
      disposed = true;
      window.clearTimeout(timer);
      if (pendingUrl) URL.revokeObjectURL(pendingUrl);
    };
  }, [camera, guide.previewVisible, image]);

  useEffect(
    () => () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    },
    [previewUrl],
  );

  if (!image || !camera) return null;

  return (
    <section className="panel overflow-hidden" aria-label="로컬 카메라 가이드">
      <div className="border-hairline flex flex-col gap-3 border-b px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-5">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <Route className="text-signal size-4" aria-hidden="true" />
            <h2 className="text-strong text-sm font-semibold">
              로컬 카메라 가이드
            </h2>
            <span className="text-muted rounded-full border border-white/8 px-2 py-0.5 font-mono text-[10px]">
              {CAMERA_GUIDE_VERSION}
            </span>
          </div>
          <p className="text-muted mt-1 text-xs leading-5">
            생성 전에 Yaw·Pitch·화각·거리·Roll을 브라우저에서 거친 구도로
            변환합니다.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            role="switch"
            aria-checked={guide.enabled}
            className={cn(
              "secondary-button min-w-[148px] shrink-0 justify-center gap-2 px-3 whitespace-nowrap",
              { "border-signal/45 text-signal": guide.enabled },
            )}
            onClick={() => setGuideEnabled(!guide.enabled)}
            disabled={isGenerating}
          >
            <span
              className={cn(
                "relative h-5 w-9 shrink-0 rounded-full border transition-colors",
                guide.enabled
                  ? "border-signal bg-signal"
                  : "border-hairline-strong bg-elevated",
              )}
              aria-hidden="true"
            >
              <span
                className={cn(
                  "absolute top-0.5 size-3.5 rounded-full bg-white transition-transform",
                  guide.enabled ? "translate-x-[17px]" : "translate-x-0.5",
                )}
              />
            </span>
            <span className="shrink-0">
              API에 {guide.enabled ? "사용" : "미사용"}
            </span>
          </button>
          <button
            type="button"
            className="icon-button"
            onClick={() => setGuidePreviewVisible(!guide.previewVisible)}
            aria-label={guide.previewVisible ? "가이드 숨기기" : "가이드 보기"}
            title={guide.previewVisible ? "가이드 숨기기" : "가이드 보기"}
          >
            {guide.previewVisible ? (
              <EyeOff className="size-4" aria-hidden="true" />
            ) : (
              <Eye className="size-4" aria-hidden="true" />
            )}
          </button>
        </div>
      </div>

      {guide.previewVisible ? (
        <div className="bg-hairline grid gap-px md:grid-cols-2">
          <div className="bg-canvas-subtle p-3 sm:p-4">
            <div className="mb-2 flex items-center justify-between gap-3">
              <span className="text-muted flex items-center gap-2 text-xs font-semibold">
                <ImageIcon className="size-3.5" aria-hidden="true" />
                Image 1 · 외형 기준
              </span>
              <span className="text-muted font-mono text-[10px]">ORIGINAL</span>
            </div>
            <div className="border-hairline relative aspect-square overflow-hidden rounded-[9px] border bg-[#07090c]">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={image.url}
                alt="외형 기준 원본 이미지"
                decoding="async"
                className="absolute inset-0 size-full object-contain p-4"
              />
            </div>
          </div>

          <div className="bg-canvas-subtle p-3 sm:p-4">
            <div className="mb-2 flex items-center justify-between gap-3">
              <span className="text-muted flex items-center gap-2 text-xs font-semibold">
                <Route className="size-3.5" aria-hidden="true" />
                Image 2 · 구도 기준
              </span>
              <span className="text-muted font-mono text-[10px]">
                {status === "ready" ? formatBytes(previewBytes) : "GUIDE"}
              </span>
            </div>
            <div className="border-hairline relative aspect-square overflow-hidden rounded-[9px] border bg-[#07090c]">
              {status === "loading" ? (
                <div className="absolute inset-0 grid place-items-center">
                  <span className="text-muted flex flex-col items-center gap-2 text-xs">
                    <LoaderCircle
                      className="text-signal size-5 animate-spin motion-reduce:animate-none"
                      aria-hidden="true"
                    />
                    가이드 계산 중
                  </span>
                </div>
              ) : previewUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={previewUrl}
                  alt={`${camera.label} 로컬 카메라 가이드`}
                  decoding="async"
                  className="absolute inset-0 size-full object-contain"
                />
              ) : (
                <div className="text-muted absolute inset-0 grid place-items-center p-6 text-center text-xs leading-5">
                  {message ?? "가이드 미리보기를 준비하고 있습니다."}
                </div>
              )}
            </div>
          </div>
        </div>
      ) : (
        <div className="text-muted flex items-center justify-between gap-4 px-4 py-3 text-xs sm:px-5">
          <span>미리보기는 숨겨졌지만 API 가이드 사용 설정은 유지됩니다.</span>
          <button
            type="button"
            className="text-signal font-semibold hover:underline"
            onClick={() => setGuidePreviewVisible(true)}
          >
            다시 보기
          </button>
        </div>
      )}
    </section>
  );
}
