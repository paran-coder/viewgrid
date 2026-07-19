"use client";

import { Copy, Power, RotateCcw, SlidersHorizontal } from "lucide-react";

import { ParameterControl } from "@/components/parameter-control";
import { QualityBadge } from "@/components/quality-badge";
import { getCameraQuality } from "@/lib/quality";
import { cn } from "@/lib/utils";
import { useStudioStore } from "@/store/use-studio-store";

export function CameraControls() {
  const cameras = useStudioStore((state) => state.cameras);
  const selectedCameraId = useStudioStore((state) => state.selectedCameraId);
  const updateCamera = useStudioStore((state) => state.updateCamera);
  const resetCamera = useStudioStore((state) => state.resetCamera);
  const copyCameraToAll = useStudioStore((state) => state.copyCameraToAll);
  const toggleCamera = useStudioStore((state) => state.toggleCamera);

  const camera =
    cameras.find((candidate) => candidate.id === selectedCameraId) ??
    cameras[4];
  const quality = getCameraQuality(camera);

  return (
    <aside
      className="panel h-fit overflow-hidden lg:sticky lg:top-20"
      aria-label="카메라 설정"
    >
      <div className="border-hairline flex items-center justify-between border-b px-4 py-4 sm:px-5">
        <div className="flex items-center gap-3">
          <span className="border-hairline bg-elevated text-signal grid size-9 place-items-center rounded-[9px] border">
            <SlidersHorizontal className="size-4" aria-hidden="true" />
          </span>
          <div>
            <p className="text-muted text-xs font-semibold tracking-[0.12em] uppercase">
              Selected camera
            </p>
            <h2 className="text-strong mt-0.5 text-lg font-semibold">
              {camera.label} 설정
            </h2>
          </div>
        </div>
        <button
          type="button"
          onClick={() => toggleCamera(camera.id)}
          className={cn(
            "icon-button",
            !camera.active && "border-signal/30 text-signal",
          )}
          aria-pressed={camera.active}
          aria-label={camera.active ? "카메라 비활성화" : "카메라 활성화"}
          title={camera.active ? "비활성화" : "활성화"}
        >
          <Power className="size-4" aria-hidden="true" />
        </button>
      </div>

      <div className="border-hairline border-b px-4 py-3 sm:px-5">
        <QualityBadge quality={quality} />
      </div>

      <div
        className={cn(
          "px-4 sm:px-5",
          !camera.active && "pointer-events-none opacity-45",
        )}
      >
        <ParameterControl
          id="yaw"
          label="좌우 각도"
          hint="정면부터 후면까지 자유롭게 회전하는 수평 궤도"
          value={camera.yaw}
          min={-180}
          max={180}
          step={1}
          suffix="°"
          onChange={(value) => updateCamera(camera.id, "yaw", value)}
        />
        <ParameterControl
          id="pitch"
          label="상하 각도"
          hint="아래에서 올려보거나 위에서 내려보는 수직 궤도"
          value={camera.pitch}
          min={-80}
          max={80}
          step={1}
          suffix="°"
          onChange={(value) => updateCamera(camera.id, "pitch", value)}
        />
        <ParameterControl
          id="roll"
          label="카메라 기울기"
          hint="수평선을 기준으로 카메라 회전"
          value={camera.roll}
          min={-20}
          max={20}
          step={1}
          suffix="°"
          onChange={(value) => updateCamera(camera.id, "roll", value)}
        />
        <ParameterControl
          id="fov"
          label="화각"
          hint="망원에서 광각까지 렌즈 시야 조절"
          value={camera.fov}
          min={20}
          max={100}
          step={1}
          suffix="°"
          onChange={(value) => updateCamera(camera.id, "fov", value)}
        />
        <ParameterControl
          id="distance"
          label="카메라 거리"
          hint="화면에서 피사체가 차지하는 크기"
          value={camera.distance}
          min={0.6}
          max={2}
          step={0.05}
          suffix="×"
          onChange={(value) => updateCamera(camera.id, "distance", value)}
        />
      </div>

      <div className="border-hairline grid grid-cols-2 gap-2 border-t p-3 sm:p-4">
        <button
          type="button"
          className="secondary-button"
          onClick={() => resetCamera(camera.id)}
        >
          <RotateCcw className="size-4" aria-hidden="true" />값 초기화
        </button>
        <button
          type="button"
          className="secondary-button"
          onClick={() => copyCameraToAll(camera.id)}
        >
          <Copy className="size-4" aria-hidden="true" />
          전체 복사
        </button>
      </div>
    </aside>
  );
}
