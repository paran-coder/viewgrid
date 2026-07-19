"use client";

import { Camera, ImageOff, Replace, Target, Trash2 } from "lucide-react";

import { QualityBadge } from "@/components/quality-badge";
import { getCameraQuality } from "@/lib/quality";
import { cn } from "@/lib/utils";
import { useStudioStore } from "@/store/use-studio-store";

const markerPositions = [
  "left-[10%] top-[12%]",
  "left-1/2 top-[8%] -translate-x-1/2",
  "right-[10%] top-[12%]",
  "left-[7%] top-1/2 -translate-y-1/2",
  "left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2",
  "right-[7%] top-1/2 -translate-y-1/2",
  "left-[10%] bottom-[12%]",
  "left-1/2 bottom-[8%] -translate-x-1/2",
  "right-[10%] bottom-[12%]",
];

export function CameraCanvas() {
  const image = useStudioStore((state) => state.image);
  const cameras = useStudioStore((state) => state.cameras);
  const selectedCameraId = useStudioStore((state) => state.selectedCameraId);
  const selectCamera = useStudioStore((state) => state.selectCamera);
  const clearImage = useStudioStore((state) => state.clearImage);

  if (!image) {
    return (
      <div className="border-hairline bg-canvas-subtle text-muted grid aspect-[4/3] min-h-[360px] place-items-center rounded-[14px] border">
        <ImageOff className="size-8" aria-hidden="true" />
      </div>
    );
  }

  return (
    <section aria-label="가상 카메라 캔버스" className="panel overflow-hidden">
      <div className="border-hairline flex min-h-14 items-center justify-between gap-4 border-b px-4 sm:px-5">
        <div className="min-w-0">
          <p className="text-strong truncate text-sm font-semibold">
            {image.name}
          </p>
          <p className="text-muted mt-0.5 text-xs">
            카메라를 선택해 설정을 조절하세요.
          </p>
        </div>
        <div className="flex shrink-0 gap-1">
          <button
            className="icon-button"
            type="button"
            onClick={clearImage}
            aria-label="이미지 교체"
            title="이미지 교체"
          >
            <Replace className="size-4" aria-hidden="true" />
          </button>
          <button
            className="icon-button danger-hover"
            type="button"
            onClick={clearImage}
            aria-label="이미지 제거"
            title="이미지 제거"
          >
            <Trash2 className="size-4" aria-hidden="true" />
          </button>
        </div>
      </div>

      <div className="border-hairline relative isolate m-3 min-h-[440px] overflow-hidden rounded-[11px] border bg-[#05070a] sm:m-4 lg:min-h-[560px]">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={image.url}
          alt="업로드한 원본"
          decoding="async"
          className="absolute inset-0 size-full object-contain p-5 sm:p-8"
        />
        <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(rgba(255,255,255,.035)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,.035)_1px,transparent_1px)] [mask-image:linear-gradient(to_bottom,transparent,black_18%,black_82%,transparent)] bg-[size:32px_32px]" />
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_32%,rgba(2,4,7,.68)_100%)]" />

        <span className="border-signal/55 bg-canvas/70 text-signal pointer-events-none absolute top-1/2 left-1/2 z-10 grid size-9 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full border backdrop-blur-sm">
          <Target className="size-4" aria-hidden="true" />
        </span>

        {cameras.map((camera, index) => {
          const selected = camera.id === selectedCameraId;
          const quality = getCameraQuality(camera);
          return (
            <button
              key={camera.id}
              type="button"
              onClick={() => selectCamera(camera.id)}
              className={cn(
                "camera-marker absolute z-20",
                markerPositions[index],
                selected && "camera-marker-selected",
                !camera.active && "opacity-45 grayscale",
              )}
              aria-pressed={selected}
              aria-label={`${camera.label} 카메라 선택, ${quality.label}, 좌우 ${camera.yaw}도, 상하 ${camera.pitch}도`}
            >
              <span className="camera-marker-icon">
                <Camera className="size-4" aria-hidden="true" />
              </span>
              <span className="font-mono text-[11px] font-bold tabular-nums">
                {camera.label}
              </span>
              <span
                className={cn("size-1.5 rounded-full", {
                  "bg-stable": quality.level === "stable",
                  "bg-caution": quality.level === "caution",
                  "bg-danger": quality.level === "experimental",
                })}
              />
            </button>
          );
        })}

        <div className="absolute right-3 bottom-3 z-20 hidden sm:block">
          <QualityBadge
            compact
            quality={getCameraQuality(
              cameras.find((camera) => camera.id === selectedCameraId) ??
                cameras[4],
            )}
          />
        </div>
      </div>
    </section>
  );
}
