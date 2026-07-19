"use client";

import { Camera, ImageOff, Info, Replace, Rotate3D, Target, Trash2 } from "lucide-react";
import { useMemo, useRef, useState, type PointerEvent, type WheelEvent } from "react";

import { QualityBadge } from "@/components/quality-badge";
import {
  buildRingPath,
  cameraFromOrbitDrag,
  inferBackside,
  orbitViewFromDrag,
  orbitViewLabel,
  projectCameraToOrbit,
  type OrbitViewState,
} from "@/lib/orbit-projection";
import { getCameraQuality } from "@/lib/quality";
import { cn, clamp } from "@/lib/utils";
import { useStudioStore } from "@/store/use-studio-store";

const DEFAULT_ORBIT_VIEW: OrbitViewState = {
  yaw: -22,
  pitch: 12,
  zoom: 1,
};

type InteractionState =
  | {
      mode: "orbit";
      pointerId: number;
      startX: number;
      startY: number;
      startYaw: number;
      startPitch: number;
    }
  | {
      mode: "camera";
      pointerId: number;
      cameraId: number;
      startX: number;
      startY: number;
      startYaw: number;
      startPitch: number;
    }
  | null;

export function CameraCanvas() {
  const image = useStudioStore((state) => state.image);
  const cameras = useStudioStore((state) => state.cameras);
  const selectedCameraId = useStudioStore((state) => state.selectedCameraId);
  const selectCamera = useStudioStore((state) => state.selectCamera);
  const clearImage = useStudioStore((state) => state.clearImage);
  const updateCamera = useStudioStore((state) => state.updateCamera);

  const stageRef = useRef<HTMLDivElement>(null);
  const interactionRef = useRef<InteractionState>(null);
  const [orbitView, setOrbitView] = useState<OrbitViewState>(DEFAULT_ORBIT_VIEW);

  const orbitPaths = useMemo(
    () => ({
      xy: buildRingPath("xy", orbitView),
      xz: buildRingPath("xz", orbitView),
      yz: buildRingPath("yz", orbitView),
    }),
    [orbitView],
  );

  const selectedCamera =
    cameras.find((camera) => camera.id === selectedCameraId) ?? cameras[4];
  const selectedQuality = getCameraQuality(selectedCamera);
  const selectedBackside = inferBackside(selectedCamera);

  function startOrbitDrag(event: PointerEvent<HTMLDivElement>) {
    if (event.target !== event.currentTarget) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    interactionRef.current = {
      mode: "orbit",
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      startYaw: orbitView.yaw,
      startPitch: orbitView.pitch,
    };
  }

  function startCameraDrag(
    event: PointerEvent<HTMLButtonElement>,
    cameraId: number,
    cameraYaw: number,
    cameraPitch: number,
  ) {
    event.stopPropagation();
    selectCamera(cameraId);
    stageRef.current?.setPointerCapture(event.pointerId);
    interactionRef.current = {
      mode: "camera",
      pointerId: event.pointerId,
      cameraId,
      startX: event.clientX,
      startY: event.clientY,
      startYaw: cameraYaw,
      startPitch: cameraPitch,
    };
  }

  function endPointerInteraction(pointerId: number) {
    const stage = stageRef.current;
    if (stage?.hasPointerCapture(pointerId)) {
      stage.releasePointerCapture(pointerId);
    }
    interactionRef.current = null;
  }

  function handlePointerMove(event: PointerEvent<HTMLDivElement>) {
    const current = interactionRef.current;
    if (!current || current.pointerId !== event.pointerId) return;

    const deltaX = event.clientX - current.startX;
    const deltaY = event.clientY - current.startY;

    if (current.mode === "orbit") {
      const next = orbitViewFromDrag({
        startYaw: current.startYaw,
        startPitch: current.startPitch,
        deltaX,
        deltaY,
      });
      setOrbitView((previous) => ({ ...previous, ...next }));
      return;
    }

    const next = cameraFromOrbitDrag({
      startYaw: current.startYaw,
      startPitch: current.startPitch,
      deltaX,
      deltaY,
    });
    updateCamera(current.cameraId, "yaw", next.yaw);
    updateCamera(current.cameraId, "pitch", next.pitch);
  }

  function handleWheel(event: WheelEvent<HTMLDivElement>) {
    event.preventDefault();
    setOrbitView((previous) => ({
      ...previous,
      zoom: clamp(previous.zoom - event.deltaY * 0.0008, 0.72, 1.45),
    }));
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
          <p className="text-strong truncate text-sm font-semibold">{image.name}</p>
          <p className="text-muted mt-0.5 text-xs">
            배경을 드래그하면 궤도를 회전하고, 카메라를 드래그하면 각도를 조절합니다.
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
        className="border-hairline relative isolate m-3 min-h-[480px] touch-none overflow-hidden rounded-[11px] border bg-[#05070a] [perspective:1400px] sm:m-4 lg:min-h-[620px]"
        onPointerDown={startOrbitDrag}
        onPointerMove={handlePointerMove}
        onPointerUp={(event) => endPointerInteraction(event.pointerId)}
        onPointerCancel={(event) => endPointerInteraction(event.pointerId)}
        onWheel={handleWheel}
      >
        <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(rgba(255,255,255,.035)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,.035)_1px,transparent_1px)] [mask-image:linear-gradient(to_bottom,transparent,black_18%,black_82%,transparent)] bg-[size:32px_32px]" />
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_26%,rgba(2,4,7,.72)_100%)]" />

        <svg
          className="pointer-events-none absolute inset-0 z-10 size-full"
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
          aria-hidden="true"
        >
          <path d={orbitPaths.xy} fill="none" stroke="rgba(252,213,53,.35)" strokeWidth="0.15" />
          <path d={orbitPaths.xz} fill="none" stroke="rgba(16,185,129,.32)" strokeWidth="0.15" />
          <path d={orbitPaths.yz} fill="none" stroke="rgba(245,158,11,.28)" strokeWidth="0.15" />
        </svg>

        <div className="pointer-events-none absolute top-3 left-3 z-30 rounded-md border border-white/8 bg-black/45 px-2.5 py-1.5 text-[10px] text-white/65 backdrop-blur-sm">
          ORBIT EDITOR · {orbitViewLabel(orbitView)}
        </div>

        <div className="pointer-events-none absolute right-3 top-3 z-30 hidden max-w-[320px] rounded-md border border-white/8 bg-black/45 px-3 py-2 text-[11px] leading-5 text-white/72 backdrop-blur-sm lg:block">
          <div className="flex items-center gap-1.5 font-semibold text-white/82">
            <Rotate3D className="size-3.5" aria-hidden="true" />
            360° 궤도 편집
          </div>
          <p className="mt-1 text-white/62">
            빈 공간 드래그: 뷰 회전 · 카메라 드래그: Yaw/Pitch 조절 · 휠: 확대/축소
          </p>
        </div>

        <div
          className="pointer-events-none absolute left-1/2 top-1/2 z-20 flex size-[min(64vw,420px)] max-h-[74%] max-w-[40%] -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-[18px] border border-white/8 bg-black/10 shadow-[0_28px_90px_rgba(0,0,0,.42)] backdrop-blur-[1px] sm:max-w-[36%]"
          style={{
            transform: `translate(-50%, -50%) rotateX(${-orbitView.pitch * 0.6}deg) rotateY(${orbitView.yaw * 0.8}deg) scale(${0.94 + orbitView.zoom * 0.06})`,
            transformStyle: "preserve-3d",
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={image.url}
            alt="업로드한 원본"
            decoding="async"
            className="size-full rounded-[14px] object-contain"
          />
        </div>

        <span className="border-signal/55 bg-canvas/78 text-signal pointer-events-none absolute left-1/2 top-1/2 z-30 grid size-8 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full border shadow-[0_0_20px_rgba(252,213,53,.18)] backdrop-blur-sm">
          <Target className="size-3.5" aria-hidden="true" />
        </span>

        {cameras
          .map((camera) => ({
            camera,
            point: projectCameraToOrbit(camera, orbitView),
            quality: getCameraQuality(camera),
          }))
          .sort((left, right) => left.point.zIndex - right.point.zIndex)
          .map(({ camera, point, quality }) => {
            const selected = camera.id === selectedCameraId;
            const backside = inferBackside(camera);
            return (
              <button
                key={camera.id}
                type="button"
                onClick={() => selectCamera(camera.id)}
                onPointerDown={(event) =>
                  startCameraDrag(event, camera.id, camera.yaw, camera.pitch)
                }
                className={cn(
                  "camera-marker absolute transition-[left,top,transform,opacity] duration-200 motion-reduce:transition-none",
                  selected && "camera-marker-selected",
                  !camera.active && "grayscale",
                  backside && "border-dashed",
                )}
                style={{
                  left: `${point.leftPercent}%`,
                  top: `${point.topPercent}%`,
                  zIndex: point.zIndex,
                  opacity: camera.active ? point.opacity : 0.34,
                  transform: `translate(-50%, -50%) scale(${selected ? point.scale * 1.12 : point.scale})`,
                }}
                aria-pressed={selected}
                aria-label={`${camera.label} 카메라 선택 및 궤도 이동, ${quality.label}, 좌우 ${camera.yaw}도, 상하 ${camera.pitch}도${backside ? ", AI 추정 후면 뷰" : ""}`}
                title={backside ? "드래그해 후면까지 조절 · AI 추정 뷰" : "드래그해 Yaw와 Pitch를 조절"}
              >
                <span className="camera-marker-icon">
                  <Camera className="size-4" aria-hidden="true" />
                </span>
                <span className="font-mono text-[11px] font-bold tabular-nums">{camera.label}</span>
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

        <div className="pointer-events-none absolute bottom-3 left-3 z-30 flex flex-wrap items-center gap-2">
          <div className="rounded-full border border-white/10 bg-black/48 px-2.5 py-1 text-[11px] font-semibold text-white/72 backdrop-blur-sm">
            생성 범위: Yaw ±180° · Pitch ±80°
          </div>
          {selectedBackside ? (
            <div className="rounded-full border border-amber-400/30 bg-amber-400/10 px-2.5 py-1 text-[11px] font-semibold text-amber-200 backdrop-blur-sm">
              AI 추정 후면 뷰
            </div>
          ) : null}
        </div>

        <div className="absolute bottom-3 right-3 z-30 flex items-center gap-2">
          {selectedBackside ? (
            <div className="hidden max-w-[240px] items-center gap-1.5 rounded-[11px] border border-white/10 bg-black/52 px-3 py-2 text-[11px] text-white/68 backdrop-blur-sm sm:flex">
              <Info className="size-3.5 text-amber-300" aria-hidden="true" />
              후면에 가까울수록 원본에 없는 영역은 AI가 일관성 있게 추정합니다.
            </div>
          ) : null}
          <QualityBadge compact quality={selectedQuality} />
        </div>
      </div>
    </section>
  );
}
