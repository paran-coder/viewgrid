"use client";

import {
  Images,
  KeyRound,
  Layers3,
  LoaderCircle,
  Play,
  ShieldCheck,
  Square,
  WandSparkles,
} from "lucide-react";

import { MODEL_DEFINITIONS } from "@/lib/providers/models";
import { useStudioStore } from "@/store/use-studio-store";

function runLabel(mode: string) {
  if (mode === "batch") return "멀티앵글 생성 큐 진행 중";
  if (mode === "retry") return "실패·중단 카메라 재시도 중";
  if (mode === "prototype") return "가상 미리보기 생성 중";
  return "선택 카메라 실제 생성 중";
}

export function StudioToolbar() {
  const cameras = useStudioStore((state) => state.cameras);
  const selectedCameraId = useStudioStore((state) => state.selectedCameraId);
  const isGenerating = useStudioStore((state) => state.isGenerating);
  const progress = useStudioStore((state) => state.generationProgress);
  const run = useStudioStore((state) => state.generationRun);
  const settings = useStudioStore((state) => state.apiSettings);
  const guideEnabled = useStudioStore((state) => state.cameraGuide.enabled);
  const startFakeGeneration = useStudioStore(
    (state) => state.startFakeGeneration,
  );
  const generateSelectedCamera = useStudioStore(
    (state) => state.generateSelectedCamera,
  );
  const generateAllCameras = useStudioStore(
    (state) => state.generateAllCameras,
  );
  const cancelGeneration = useStudioStore((state) => state.cancelGeneration);
  const openSettings = useStudioStore((state) => state.openSettings);
  const activeCount = cameras.filter((camera) => camera.active).length;
  const selectedCamera = cameras.find(
    (camera) => camera.id === selectedCameraId,
  );
  const currentCamera = cameras.find(
    (camera) => camera.id === run.currentCameraId,
  );
  const model = MODEL_DEFINITIONS.find((item) => item.id === settings.model);
  const configured = Boolean(settings.apiKey.trim());

  return (
    <section className="panel overflow-hidden" aria-busy={isGenerating}>
      <div className="flex flex-col gap-4 p-4 sm:p-5 xl:flex-row xl:items-center xl:justify-between">
        <div className="flex min-w-0 items-center gap-3">
          <span className="border-hairline bg-elevated text-signal grid size-10 shrink-0 place-items-center rounded-[10px] border">
            <WandSparkles className="size-5" aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <h2 className="text-strong text-sm font-semibold">
                멀티앵글 실제 생성
              </h2>
              <span className="status-dot">
                <ShieldCheck
                  className={
                    settings.connectionStatus === "connected"
                      ? "text-stable size-3.5"
                      : "text-muted size-3.5"
                  }
                  aria-hidden="true"
                />
                {model?.label ?? settings.model}
              </span>
            </div>
            <p className="text-muted mt-1 text-xs leading-5">
              {configured
                ? `${guideEnabled ? "원본 + 로컬 구도 가이드" : "원본만"} 사용 · 활성 카메라 ${activeCount}개를 순차 생성합니다.`
                : "사용자 API 키를 연결하면 선택 카메라 또는 활성 카메라 전체를 실제로 생성합니다."}
            </p>
          </div>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap xl:justify-end">
          <button
            type="button"
            className="secondary-button"
            onClick={openSettings}
            disabled={isGenerating}
          >
            <KeyRound className="size-4" aria-hidden="true" />
            API 설정
          </button>
          <button
            type="button"
            className="secondary-button"
            onClick={startFakeGeneration}
            disabled={isGenerating || activeCount === 0}
          >
            <Images className="size-4" aria-hidden="true" />
            가상 미리보기
          </button>
          {isGenerating ? (
            <button
              type="button"
              className="secondary-button border-danger/40 text-danger"
              onClick={cancelGeneration}
              disabled={run.mode === "prototype"}
              title={
                run.mode === "prototype"
                  ? "가상 미리보기는 짧게 완료되므로 중단하지 않습니다."
                  : undefined
              }
            >
              <Square className="size-4 fill-current" aria-hidden="true" />큐
              중단
            </button>
          ) : (
            <>
              <button
                type="button"
                className="secondary-button"
                onClick={() => void generateSelectedCamera()}
                disabled={!selectedCamera?.active}
              >
                <Play className="size-4 fill-current" aria-hidden="true" />
                {selectedCamera?.label ?? "선택 뷰"} 한 장 생성
              </button>
              <button
                type="button"
                className="primary-button min-w-44 justify-center"
                onClick={() => void generateAllCameras()}
                disabled={activeCount === 0}
              >
                <Layers3 className="size-4" aria-hidden="true" />
                활성 {activeCount}개 실제 생성
              </button>
            </>
          )}
        </div>
      </div>

      {isGenerating ? (
        <div
          className="border-hairline bg-canvas-subtle border-t px-4 py-3 sm:px-5"
          aria-live="polite"
        >
          <div className="text-muted flex items-center justify-between gap-4 text-xs font-medium">
            <span className="flex min-w-0 items-center gap-2">
              <LoaderCircle
                className="text-signal size-4 shrink-0 animate-spin motion-reduce:animate-none"
                aria-hidden="true"
              />
              <span className="truncate">
                {runLabel(run.mode)}
                {currentCamera ? ` · ${currentCamera.label}` : ""}
              </span>
            </span>
            <span className="font-mono tabular-nums">{progress}%</span>
          </div>
          <div
            className="bg-elevated mt-2 h-1.5 overflow-hidden rounded-full"
            role="progressbar"
            aria-label="멀티앵글 생성 진행률"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={progress}
          >
            <div
              className="bg-signal h-full rounded-full transition-[width] duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
          <div className="text-muted mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[11px]">
            <span>
              처리 {run.processed}/{run.total}
            </span>
            <span className="text-stable">완료 {run.completed}</span>
            <span className="text-danger">실패 {run.failed}</span>
            <span>중단 {run.cancelled}</span>
          </div>
        </div>
      ) : null}
    </section>
  );
}
