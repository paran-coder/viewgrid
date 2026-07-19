"use client";

import { Camera, ImageOff, Replace, Target, Trash2 } from "lucide-react";
import { useRef, type PointerEvent } from "react";

import { QualityBadge } from "@/components/quality-badge";
import { projectCameraToOrbit } from "@/lib/orbit-projection";
import { getCameraQuality } from "@/lib/quality";
import { cn } from "@/lib/utils";
import { useStudioStore } from "@/store/use-studio-store";

export function CameraCanvas() {
  const image = useStudioStore((state) => state.image);
  const cameras = useStudioStore((state) => state.cameras);
  const selectedCameraId = useStudioStore((state) => state.selectedCameraId);
  const selectCamera = useStudioStore((state) => state.selectCamera);
  const clearImage = useStudioStore((state) => state.clearImage);
  const updateCamera = useStudioStore((state) => state.updateCamera);
  const stageRef = useRef<HTMLDivElement>(null);

  function updateFromPointer(
    event: PointerEvent<HTMLButtonElement>,
    cameraId: number,
  ) {
    const stage = stageRef.current;
    if (!stage) return;
    const rect = stage.getBoundingClientRect();
    const normalizedX =
      (event.clientX - (rect.left + rect.width / 2)) / (rect.width * 0.38);
    const normalizedY =
      (event.clientY - (rect.top + rect.height / 2)) / (rect.height * 0.36);
    const yaw = Math.max(-60, Math.min(60, Math.round(normalizedX * 60)));
    const pitch = Math.max(-30, Math.min(30, Math.round(-normalizedY * 30)));
    updateCamera(cameraId, "yaw", yaw);
    updateCamera(cameraId, "pitch", pitch);
  }

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

      <div
        ref={stageRef}
        className="border-hairline relative isolate m-3 min-h-[440px] touch-none overflow-hidden rounded-[11px] border bg-[#05070a] sm:m-4 lg:min-h-[560px]"
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={image.url}
          alt="업로드한 원본"
          decoding="async"
          className="absolute inset-0 size-full object-contain p-5 sm:p-8"
        />
        <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(rgba(255,255,255,.035)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,.035)_1px,transparent_1px)] [mask-image:linear-gradient(to_bottom,transparent,black_18%,black_82%,transparent)] bg-[size:32px_32px]" />
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_30%,rgba(2,4,7,.72)_100%)]" />

        <div
          className="pointer-events-none absolute inset-[5%] z-10"
          aria-hidden="true"
        >
          <div className="border-signal/34 absolute inset-[8%] rounded-[50%] border shadow-[0_0_34px_rgba(252,213,53,.06)]" />
          <div className="border-caution/34 absolute inset-x-[8%] top-1/2 h-[58%] -translate-y-1/2 rounded-[50%] border" />
          <div className="border-stable/34 absolute inset-y-[8%] left-1/2 w-[58%] -translate-x-1/2 rounded-[50%] border" />
          <div className="absolute inset-[20%] rounded-[50%] border border-white/8" />
          <span className="absolute top-1/2 left-1/2 h-px w-[84%] -translate-x-1/2 bg-gradient-to-r from-transparent via-white/16 to-transparent" />
          <span className="absolute top-1/2 left-1/2 h-[84%] w-px -translate-y-1/2 bg-gradient-to-b from-transparent via-white/16 to-transparent" />
        </div>

        <span className="border-signal/55 bg-canvas/78 text-signal pointer-events-none absolute top-1/2 left-1/2 z-20 grid size-8 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full border shadow-[0_0_20px_rgba(252,213,53,.18)] backdrop-blur-sm">
          <Target className="size-3.5" aria-hidden="true" />
        </span>

        <div className="pointer-events-none absolute top-3 left-3 z-20 rounded-md border border-white/8 bg-black/45 px-2.5 py-1.5 text-[10px] text-white/65 backdrop-blur-sm">
          ORBIT VIEW · YAW / PITCH
        </div>

        {cameras.map((camera) => {
          const selected = camera.id === selectedCameraId;
          const quality = getCameraQuality(camera);
          const point = projectCameraToOrbit(camera);
          return (
            <button
              key={camera.id}
              type="button"
              onClick={() => selectCamera(camera.id)}
              onPointerDown={(event) => {
                selectCamera(camera.id);
                event.currentTarget.setPointerCapture(event.pointerId);
                updateFromPointer(event, camera.id);
              }}
              onPointerMove={(event) => {
                if (!event.currentTarget.hasPointerCapture(event.pointerId))
                  return;
                updateFromPointer(event, camera.id);
              }}
              onPointerUp={(event) => {
                if (event.currentTarget.hasPointerCapture(event.pointerId)) {
                  event.currentTarget.releasePointerCapture(event.pointerId);
                }
              }}
              className={cn(
                "camera-marker absolute transition-[left,top,transform,opacity] duration-300 motion-reduce:transition-none",
                selected && "camera-marker-selected",
                !camera.active && "grayscale",
              )}
              style={{
                left: `${point.leftPercent}%`,
                top: `${point.topPercent}%`,
                zIndex: point.zIndex,
                opacity: camera.active ? point.opacity : 0.38,
                transform: `translate(-50%, -50%) scale(${selected ? point.scale * 1.08 : point.scale})`,
              }}
              aria-pressed={selected}
              aria-label={`${camera.label} 카메라 선택 및 궤도 이동, ${quality.label}, 좌우 ${camera.yaw}도, 상하 ${camera.pitch}도`}
              title="드래그해 Yaw와 Pitch를 조절"
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
