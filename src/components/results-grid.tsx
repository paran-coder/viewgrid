"use client";

import { useEffect, useRef, useState } from "react";
import {
  Download,
  Expand,
  FileArchive,
  Images,
  LoaderCircle,
  RefreshCw,
  Settings2,
  Trash2,
  WandSparkles,
  X,
} from "lucide-react";

import { formatBytes } from "@/lib/image-preprocess";
import { getCameraQuality } from "@/lib/quality";
import {
  cameraMatchesResult,
  createContactSheetBlob,
  createExportStamp,
  createResultsZip,
  downloadBlob,
  downloadUrl,
  getExportReadiness,
  resultFilename,
} from "@/lib/result-export";
import { cn } from "@/lib/utils";
import { useStudioStore } from "@/store/use-studio-store";

function transformFor(camera: {
  yaw: number;
  pitch: number;
  roll: number;
  fov: number;
  distance: number;
}) {
  const x = camera.yaw * -0.22;
  const y = camera.pitch * 0.25;
  const scale = Math.max(
    0.72,
    Math.min(1.38, 1.16 / camera.distance + (camera.fov - 50) * 0.002),
  );
  return `translate(${x}%, ${y}%) rotate(${camera.roll}deg) scale(${scale})`;
}

function statusCopy(status?: string) {
  if (status === "queued") return "생성 대기 중";
  if (status === "generating") return "공급자 생성 중";
  if (status === "cancelled") return "생성 중단";
  return "";
}

export function ResultsGrid() {
  const image = useStudioStore((state) => state.image);
  const cameras = useStudioStore((state) => state.cameras);
  const generation = useStudioStore((state) => state.generation);
  const isGenerating = useStudioStore((state) => state.isGenerating);
  const progress = useStudioStore((state) => state.generationProgress);
  const run = useStudioStore((state) => state.generationRun);
  const guideEnabled = useStudioStore((state) => state.cameraGuide.enabled);
  const consistency = useStudioStore((state) => state.consistency);
  const apiSettings = useStudioStore((state) => state.apiSettings);
  const regenerateCell = useStudioStore((state) => state.regenerateCell);
  const retryIncompleteCameras = useStudioStore(
    (state) => state.retryIncompleteCameras,
  );
  const cancelGeneration = useStudioStore((state) => state.cancelGeneration);
  const clearGenerationError = useStudioStore(
    (state) => state.clearGenerationError,
  );
  const deleteGenerationResult = useStudioStore(
    (state) => state.deleteGenerationResult,
  );
  const setView = useStudioStore((state) => state.setView);
  const [previewCameraId, setPreviewCameraId] = useState<number | null>(null);
  const previewDialogRef = useRef<HTMLElement>(null);
  const previewCloseRef = useRef<HTMLButtonElement>(null);
  const [exporting, setExporting] = useState<"sheet" | "zip" | null>(null);
  const [exportMessage, setExportMessage] = useState<string | null>(null);

  useEffect(() => {
    if (previewCameraId === null) return;
    const previousFocus = document.activeElement as HTMLElement | null;
    previewCloseRef.current?.focus();

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        setPreviewCameraId(null);
        return;
      }
      if (event.key !== "Tab") return;
      const focusable = previewDialogRef.current?.querySelectorAll<HTMLElement>(
        'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
      );
      if (!focusable?.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      previousFocus?.focus();
    };
  }, [previewCameraId]);

  if (!image) return null;
  const sourceImage = image;

  const incompleteCount = generation.filter(
    (cell) => cell.status === "failed" || cell.status === "cancelled",
  ).length;
  const resultContext = {
    provider: apiSettings.provider,
    model: apiSettings.model,
    guideEnabled,
    referenceEnabled: consistency.referenceEnabled,
    normalizationEnabled: consistency.normalizationEnabled,
  };
  const readiness = getExportReadiness(cameras, generation, resultContext);
  const previewCell = generation.find(
    (cell) => cell.cameraId === previewCameraId,
  );
  const previewCamera = cameras.find((camera) => camera.id === previewCameraId);
  const currentCamera = cameras.find(
    (camera) => camera.id === run.currentCameraId,
  );
  const currentReferenceCamera = cameras.find(
    (camera) => camera.id === run.currentReferenceCameraId,
  );

  async function downloadContactSheet() {
    setExportMessage(null);
    setExporting("sheet");
    try {
      const sheet = await createContactSheetBlob({
        cameras,
        generation,
        resultContext,
      });
      downloadBlob(sheet, `viewgrid-contact-sheet-${createExportStamp()}.png`);
      setExportMessage("3×3 PNG 시트를 만들었습니다.");
    } catch (error) {
      setExportMessage(
        error instanceof Error ? error.message : "시트 생성에 실패했습니다.",
      );
    } finally {
      setExporting(null);
    }
  }

  async function downloadZip() {
    setExportMessage(null);
    setExporting("zip");
    try {
      const contactSheet = readiness.canDownloadContactSheet
        ? await createContactSheetBlob({
            cameras,
            generation,
            resultContext,
          })
        : undefined;
      const zip = await createResultsZip({
        cameras,
        generation,
        projectName: sourceImage.name,
        contactSheet,
        resultContext,
      });
      downloadBlob(zip, `viewgrid-results-${createExportStamp()}.zip`);
      setExportMessage(
        contactSheet
          ? "개별 이미지와 3×3 시트를 ZIP으로 묶었습니다."
          : "완료된 개별 이미지를 ZIP으로 묶었습니다.",
      );
    } catch (error) {
      setExportMessage(
        error instanceof Error ? error.message : "ZIP 생성에 실패했습니다.",
      );
    } finally {
      setExporting(null);
    }
  }

  return (
    <main className="mx-auto w-full max-w-[1600px] px-4 py-6 sm:px-6 lg:px-8">
      <div className="mb-5 flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <div className="eyebrow w-fit">
            <Images className="size-4" aria-hidden="true" />
            Contact sheet workspace
          </div>
          <h1 className="text-strong mt-3 text-3xl font-bold tracking-[-0.045em] sm:text-4xl">
            멀티앵글 생성 결과
          </h1>
          <p className="text-muted mt-2 max-w-3xl text-sm leading-6">
            활성 카메라를 순차 처리하며, 완료된 결과는 브라우저 메모리에만
            유지됩니다. 실패하거나 중단된 셀만 다시 실행할 수 있습니다.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className="secondary-button"
            onClick={() => setView("editor")}
            disabled={isGenerating}
          >
            <Settings2 className="size-4" aria-hidden="true" />
            카메라 수정
          </button>
          {incompleteCount > 0 ? (
            <button
              type="button"
              className="secondary-button"
              onClick={() => void retryIncompleteCameras()}
              disabled={isGenerating}
            >
              <RefreshCw className="size-4" aria-hidden="true" />
              실패·중단 {incompleteCount}개 재시도
            </button>
          ) : null}
          <button
            type="button"
            className="secondary-button"
            disabled={
              isGenerating ||
              exporting !== null ||
              !readiness.canDownloadContactSheet
            }
            onClick={() => void downloadContactSheet()}
          >
            {exporting === "sheet" ? (
              <LoaderCircle
                className="size-4 animate-spin motion-reduce:animate-none"
                aria-hidden="true"
              />
            ) : (
              <Download className="size-4" aria-hidden="true" />
            )}
            3×3 PNG
          </button>
          <button
            type="button"
            className="primary-button"
            disabled={
              isGenerating || exporting !== null || !readiness.canDownloadZip
            }
            onClick={() => void downloadZip()}
          >
            {exporting === "zip" ? (
              <LoaderCircle
                className="size-4 animate-spin motion-reduce:animate-none"
                aria-hidden="true"
              />
            ) : (
              <FileArchive className="size-4" aria-hidden="true" />
            )}
            결과 ZIP
          </button>
        </div>
      </div>

      <section
        className="panel overflow-hidden"
        aria-label="생성 결과 시트"
        aria-busy={isGenerating}
      >
        {isGenerating || run.total > 0 ? (
          <div className="border-hairline border-b px-4 py-3 sm:px-5">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div className="text-muted flex min-w-0 items-center gap-2 text-xs font-medium">
                {isGenerating ? (
                  <LoaderCircle
                    className="text-signal size-4 shrink-0 animate-spin motion-reduce:animate-none"
                    aria-hidden="true"
                  />
                ) : (
                  <span
                    className={cn("size-2.5 shrink-0 rounded-full", {
                      "bg-stable": run.failed === 0 && run.cancelled === 0,
                      "bg-caution": run.failed > 0 || run.cancelled > 0,
                    })}
                    aria-hidden="true"
                  />
                )}
                <span className="truncate">
                  {isGenerating
                    ? `${currentCamera?.label ?? "원본"} 처리 중${currentReferenceCamera ? ` · ${currentReferenceCamera.label} 참조` : ""}`
                    : `최근 큐 완료 · 성공 ${run.completed} · 실패 ${run.failed} · 중단 ${run.cancelled}`}
                </span>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-muted font-mono text-xs tabular-nums">
                  {run.processed}/{run.total} · {progress}%
                </span>
                {isGenerating && run.mode !== "prototype" ? (
                  <button
                    type="button"
                    className="text-danger text-xs font-semibold hover:underline"
                    onClick={cancelGeneration}
                  >
                    큐 중단
                  </button>
                ) : null}
              </div>
            </div>
            <div
              className="bg-elevated mt-2 h-1.5 overflow-hidden rounded-full"
              role="progressbar"
              aria-label="결과 생성 진행률"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={progress}
            >
              <div
                className="bg-signal h-full rounded-full transition-[width] duration-300"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        ) : null}

        <div className="bg-hairline grid grid-cols-1 gap-px sm:grid-cols-2 lg:grid-cols-3">
          {cameras.map((camera, cameraIndex) => {
            const cell = generation.find((item) => item.cameraId === camera.id);
            const isComplete = cell?.status === "complete";
            const isWorking =
              cell?.status === "queued" || cell?.status === "generating";
            const isApiResult =
              cell?.source === "api" && Boolean(cell.resultUrl);
            const quality = getCameraQuality(camera);
            const isStale =
              isApiResult && !cameraMatchesResult(camera, cell, resultContext);
            const resultSrc = isApiResult ? cell?.resultUrl : sourceImage.url;

            return (
              <article
                key={camera.id}
                className="result-cell group relative min-h-[280px] overflow-hidden bg-[#07090c] sm:min-h-[320px]"
              >
                {camera.active ? (
                  <>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={resultSrc}
                      alt={`${camera.label} ${isApiResult ? "실제 생성 결과" : "가상 결과"}`}
                      loading={cameraIndex > 2 ? "lazy" : "eager"}
                      decoding="async"
                      className={cn(
                        "absolute inset-0 size-full object-contain p-7 transition duration-700 ease-out motion-reduce:transition-none",
                        !isComplete &&
                          !cell?.resultUrl &&
                          "scale-95 opacity-25 blur-md",
                      )}
                      style={{
                        transform: isApiResult
                          ? undefined
                          : transformFor(camera),
                      }}
                    />
                    {!isApiResult ? (
                      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_25%,rgba(5,7,10,0.62)_100%)]" />
                    ) : null}
                  </>
                ) : (
                  <div className="absolute inset-0 grid place-items-center bg-[#0b0e12]">
                    <span className="text-muted text-xs font-semibold">
                      카메라 비활성
                    </span>
                  </div>
                )}

                {isWorking ? (
                  <div className="bg-canvas/82 absolute inset-0 z-10 grid place-items-center backdrop-blur-sm">
                    <span className="text-strong flex flex-col items-center gap-3 text-xs font-semibold">
                      {cell?.status === "generating" ? (
                        <LoaderCircle
                          className="text-signal size-7 animate-spin motion-reduce:animate-none"
                          aria-hidden="true"
                        />
                      ) : (
                        <span className="border-signal/50 size-7 rounded-full border-2 border-dashed" />
                      )}
                      {camera.label} {statusCopy(cell?.status)}
                    </span>
                  </div>
                ) : null}

                {cell?.status === "failed" || cell?.status === "cancelled" ? (
                  <div className="bg-canvas/88 absolute inset-0 z-20 grid place-items-center p-6 text-center backdrop-blur-sm">
                    <div>
                      <p
                        className={cn("text-sm font-semibold", {
                          "text-danger": cell.status === "failed",
                          "text-caution": cell.status === "cancelled",
                        })}
                      >
                        {cell.status === "failed" ? "생성 실패" : "생성 중단"}
                      </p>
                      <p className="text-muted mt-2 max-w-xs text-xs leading-5">
                        {cell.error}
                      </p>
                      <div className="mt-4 flex justify-center gap-2">
                        <button
                          type="button"
                          className="secondary-button"
                          onClick={() => clearGenerationError(camera.id)}
                          disabled={isGenerating}
                        >
                          닫기
                        </button>
                        <button
                          type="button"
                          className="primary-button"
                          onClick={() => regenerateCell(camera.id)}
                          disabled={isGenerating}
                        >
                          <RefreshCw className="size-4" aria-hidden="true" />
                          다시 시도
                        </button>
                      </div>
                    </div>
                  </div>
                ) : null}

                <div className="absolute inset-x-0 top-0 z-20 flex items-start justify-between gap-3 p-3">
                  <span className="rounded-[7px] border border-white/10 bg-black/60 px-2.5 py-1.5 font-mono text-xs font-bold text-white tabular-nums backdrop-blur-md">
                    {camera.label}
                    <span className="ml-2 font-normal text-white/60">
                      {camera.yaw}° · {camera.pitch}°
                    </span>
                  </span>
                  <div className="flex items-center gap-2">
                    {isApiResult ? (
                      <>
                        <span
                          className={cn(
                            "rounded-full border px-2 py-1 text-[10px] font-bold tracking-wide uppercase backdrop-blur-md",
                            isStale
                              ? "border-caution/40 bg-caution/10 text-caution"
                              : "border-signal/30 bg-signal/10 text-signal",
                          )}
                        >
                          {isStale ? "STALE" : "API"}
                        </span>
                        {cell?.metadata?.guideRequested ? (
                          <span
                            className={cn(
                              "rounded-full border px-2 py-1 text-[10px] font-bold tracking-wide uppercase backdrop-blur-md",
                              cell.metadata.guideUsed
                                ? "border-stable/35 bg-stable/10 text-stable"
                                : "border-caution/40 bg-caution/10 text-caution",
                            )}
                            title={
                              cell.metadata.guideUsed
                                ? "로컬 카메라 가이드를 함께 사용했습니다."
                                : (cell.metadata.guideWarning ??
                                  "가이드 없이 원본만 사용했습니다.")
                            }
                          >
                            {cell.metadata.guideUsed ? "GUIDE" : "FALLBACK"}
                          </span>
                        ) : null}
                        {cell?.metadata?.referencePolicyEnabled ? (
                          <span
                            className={cn(
                              "rounded-full border px-2 py-1 text-[10px] font-bold tracking-wide uppercase backdrop-blur-md",
                              cell.metadata.referenceUsed
                                ? "border-info/35 bg-info/10 text-info"
                                : "border-hairline bg-black/45 text-white/55",
                            )}
                            title={
                              cell.metadata.referenceUsed
                                ? `C${cell.metadata.referenceCameraId} 결과를 인접 참조로 사용했습니다.`
                                : (cell.metadata.referenceWarning ??
                                  "이 카메라는 인접 결과 참조 없이 생성했습니다.")
                            }
                          >
                            {cell.metadata.referenceUsed
                              ? `REF C${cell.metadata.referenceCameraId}`
                              : "NO REF"}
                          </span>
                        ) : null}
                        {cell?.metadata?.normalizationRequested ? (
                          <span
                            className={cn(
                              "rounded-full border px-2 py-1 text-[10px] font-bold tracking-wide uppercase backdrop-blur-md",
                              cell.metadata.normalized
                                ? "border-stable/35 bg-stable/10 text-stable"
                                : "border-caution/40 bg-caution/10 text-caution",
                            )}
                            title={
                              cell.metadata.normalized
                                ? "1,024px 크기와 제한된 색상 게인을 적용했습니다."
                                : (cell.metadata.normalizationWarning ??
                                  "출력 정규화를 적용하지 못했습니다.")
                            }
                          >
                            {cell.metadata.normalized ? "NORM" : "RAW"}
                          </span>
                        ) : null}
                      </>
                    ) : null}
                    <span
                      className={cn("result-quality-dot", {
                        "bg-stable": quality.level === "stable",
                        "bg-caution": quality.level === "caution",
                        "bg-danger": quality.level === "experimental",
                      })}
                      title={quality.label}
                    />
                  </div>
                </div>

                {isComplete ? (
                  <div className="absolute inset-x-0 bottom-0 z-20 flex translate-y-1 items-center justify-between gap-2 bg-gradient-to-t from-black/85 to-transparent p-3 pt-10 opacity-100 transition motion-reduce:transform-none motion-reduce:transition-none sm:translate-y-3 sm:opacity-0 sm:group-focus-within:translate-y-0 sm:group-focus-within:opacity-100 sm:group-hover:translate-y-0 sm:group-hover:opacity-100">
                    <span className="text-xs font-medium text-white/70">
                      {isApiResult
                        ? `${cell?.metadata?.model ?? "API"} · ${cell?.metadata?.guideUsed ? "GUIDE" : "SOURCE"} · ${cell?.metadata ? formatBytes(cell.metadata.byteSize) : ""}`
                        : cell && cell.revision > 0
                          ? `가상 재생성 ${cell.revision}회`
                          : "가상 미리보기"}
                    </span>
                    <div className="flex gap-1">
                      <button
                        className="result-action"
                        type="button"
                        onClick={() => setPreviewCameraId(camera.id)}
                        aria-label={`${camera.label} 확대`}
                      >
                        <Expand className="size-4" aria-hidden="true" />
                      </button>
                      {isApiResult && cell?.resultUrl ? (
                        <button
                          className="result-action"
                          type="button"
                          onClick={() =>
                            downloadUrl(
                              cell.resultUrl!,
                              resultFilename(
                                camera.label,
                                cell.metadata?.mimeType,
                                cell.metadata?.createdAt,
                              ),
                            )
                          }
                          aria-label={`${camera.label} 이미지 다운로드`}
                        >
                          <Download className="size-4" aria-hidden="true" />
                        </button>
                      ) : null}
                      {isApiResult ? (
                        <button
                          className="result-action"
                          type="button"
                          onClick={() => deleteGenerationResult(camera.id)}
                          aria-label={`${camera.label} 결과 삭제`}
                          disabled={isGenerating}
                        >
                          <Trash2 className="size-4" aria-hidden="true" />
                        </button>
                      ) : null}
                      <button
                        className="result-action"
                        type="button"
                        onClick={() => regenerateCell(camera.id)}
                        aria-label={`${camera.label} 다시 생성`}
                        disabled={isGenerating}
                      >
                        <RefreshCw className="size-4" aria-hidden="true" />
                      </button>
                    </div>
                  </div>
                ) : null}
              </article>
            );
          })}
        </div>
      </section>

      <div className="border-hairline bg-card mt-4 flex flex-col gap-3 rounded-[12px] border p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <WandSparkles
            className="text-signal mt-0.5 size-4 shrink-0"
            aria-hidden="true"
          />
          <div>
            <p className="text-strong text-xs font-semibold">
              현재 설정과 일치 {readiness.completed}/{readiness.active}개 · 보관
              결과 {readiness.available}개
            </p>
            <p className="text-muted mt-1 text-xs leading-5">
              3×3 PNG는 모든 활성 카메라가 완료되면 활성화됩니다. ZIP은 완료된
              결과만으로도 만들 수 있으며 참조·정규화 메타데이터 JSON을 함께
              포함합니다.
            </p>
          </div>
        </div>
        <span
          className={cn("text-xs font-semibold", {
            "text-stable": readiness.canDownloadContactSheet,
            "text-muted": !readiness.canDownloadContactSheet,
          })}
        >
          {readiness.canDownloadContactSheet
            ? "시트 다운로드 준비 완료"
            : `${readiness.active - readiness.completed}개 결과 필요`}
        </span>
      </div>

      {exportMessage ? (
        <p
          className="border-hairline bg-canvas-subtle text-muted mt-3 rounded-[8px] border px-4 py-3 text-xs"
          aria-live="polite"
        >
          {exportMessage}
        </p>
      ) : null}

      {previewCamera && previewCell?.status === "complete" ? (
        <div className="fixed inset-0 z-[90] grid place-items-center bg-black/80 p-3 backdrop-blur-md sm:p-6">
          <button
            type="button"
            className="absolute inset-0"
            aria-label="확대 이미지 닫기"
            onClick={() => setPreviewCameraId(null)}
          />
          <section
            ref={previewDialogRef}
            role="dialog"
            aria-modal="true"
            aria-label={`${previewCamera.label} 확대 이미지`}
            className="panel relative z-10 max-h-[92dvh] w-full max-w-5xl overflow-hidden"
          >
            <div className="border-hairline flex items-center justify-between border-b px-4 py-3 sm:px-5">
              <div>
                <p className="text-strong text-sm font-semibold">
                  {previewCamera.label} 확대 결과
                </p>
                <p className="text-muted mt-0.5 text-xs">
                  Yaw {previewCamera.yaw}° · Pitch {previewCamera.pitch}° · FOV{" "}
                  {previewCamera.fov}°
                </p>
              </div>
              <button
                ref={previewCloseRef}
                type="button"
                className="icon-button"
                onClick={() => setPreviewCameraId(null)}
                aria-label="확대 이미지 닫기"
              >
                <X className="size-4" aria-hidden="true" />
              </button>
            </div>
            <div className="grid max-h-[75dvh] place-items-center overflow-auto bg-[#05070a] p-4 sm:p-6">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={previewCell.resultUrl ?? sourceImage.url}
                alt={`${previewCamera.label} 확대 결과`}
                decoding="async"
                className="max-h-[68dvh] max-w-full object-contain"
                style={{
                  transform:
                    previewCell.source === "api"
                      ? undefined
                      : transformFor(previewCamera),
                }}
              />
            </div>
            {previewCell.metadata ? (
              <div className="border-hairline bg-canvas-subtle grid gap-2 border-t px-4 py-3 text-xs sm:grid-cols-3 sm:px-5 lg:grid-cols-6">
                <span>
                  <b className="text-strong">모델</b>{" "}
                  <span className="text-muted">
                    {previewCell.metadata.model}
                  </span>
                </span>
                <span>
                  <b className="text-strong">파일</b>{" "}
                  <span className="text-muted">
                    {formatBytes(previewCell.metadata.byteSize)}
                  </span>
                </span>
                <span>
                  <b className="text-strong">공급자 처리</b>{" "}
                  <span className="text-muted">
                    {previewCell.metadata.durationMs > 0
                      ? `${(previewCell.metadata.durationMs / 1000).toFixed(1)}초`
                      : "측정되지 않음"}
                  </span>
                </span>
                <span>
                  <b className="text-strong">카메라 가이드</b>{" "}
                  <span
                    className={
                      previewCell.metadata.guideUsed
                        ? "text-stable"
                        : previewCell.metadata.guideRequested
                          ? "text-caution"
                          : "text-muted"
                    }
                  >
                    {previewCell.metadata.guideUsed
                      ? `사용 · ${previewCell.metadata.guideByteSize ? formatBytes(previewCell.metadata.guideByteSize) : "전송됨"}`
                      : previewCell.metadata.guideRequested
                        ? "폴백"
                        : "미사용"}
                  </span>
                </span>
                <span>
                  <b className="text-strong">인접 참조</b>{" "}
                  <span
                    className={
                      previewCell.metadata.referenceUsed
                        ? "text-info"
                        : "text-muted"
                    }
                  >
                    {previewCell.metadata.referenceUsed
                      ? `C${previewCell.metadata.referenceCameraId} · ${previewCell.metadata.referenceByteSize ? formatBytes(previewCell.metadata.referenceByteSize) : "전송됨"}`
                      : "미사용"}
                  </span>
                </span>
                <span>
                  <b className="text-strong">출력 정규화</b>{" "}
                  <span
                    className={
                      previewCell.metadata.normalized
                        ? "text-stable"
                        : previewCell.metadata.normalizationRequested
                          ? "text-caution"
                          : "text-muted"
                    }
                  >
                    {previewCell.metadata.normalized
                      ? `${previewCell.metadata.normalizedWidth}×${previewCell.metadata.normalizedHeight}`
                      : previewCell.metadata.normalizationRequested
                        ? "폴백"
                        : "미사용"}
                  </span>
                </span>
                {previewCell.metadata.guideWarning ? (
                  <p className="text-caution sm:col-span-3 lg:col-span-6">
                    {previewCell.metadata.guideWarning}
                  </p>
                ) : null}
                {previewCell.metadata.referenceWarning ? (
                  <p className="text-caution sm:col-span-3 lg:col-span-6">
                    {previewCell.metadata.referenceWarning}
                  </p>
                ) : null}
                {previewCell.metadata.normalizationWarning ? (
                  <p className="text-caution sm:col-span-3 lg:col-span-6">
                    {previewCell.metadata.normalizationWarning}
                  </p>
                ) : null}
              </div>
            ) : null}
          </section>
        </div>
      ) : null}
    </main>
  );
}
