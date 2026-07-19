"use client";

import type { CameraConfig, GenerationCell } from "@/types/camera";
import type {
  ImageModelId,
  ProviderId,
  ResultContext,
} from "@/types/generation";

export const CONTACT_SHEET_CELL_SIZE = 768;
export const CONTACT_SHEET_GAP = 12;
export const CONTACT_SHEET_COLUMNS = 3;

export type ContactSheetLayout = {
  width: number;
  height: number;
  cellSize: number;
  gap: number;
  columns: number;
  rows: number;
};

type ExportInput = {
  cameras: CameraConfig[];
  generation: GenerationCell[];
  projectName?: string;
  resultContext?: ResultContext & { provider: ProviderId; model: ImageModelId };
};

type ContactSheetOptions = ExportInput & {
  cellSize?: number;
  gap?: number;
  includeLabels?: boolean;
};

type ZipOptions = ExportInput & {
  contactSheet?: Blob;
  fetchBlob?: (url: string) => Promise<Blob>;
};

function sanitizeName(value: string) {
  return (
    value
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9가-힣_-]+/g, "-")
      .replace(/^-+|-+$/g, "") || "viewgrid"
  );
}

function extensionForMime(mimeType?: string) {
  if (mimeType === "image/webp") return "webp";
  if (mimeType === "image/jpeg") return "jpg";
  return "png";
}

export function createExportStamp(date = new Date()) {
  return date.toISOString().replace(/[:.]/g, "-");
}

export function resultFilename(
  cameraLabel: string,
  mimeType?: string,
  createdAt?: string,
) {
  const stamp = createdAt
    ? createdAt.replace(/[:.]/g, "-")
    : createExportStamp();
  return `viewgrid-${sanitizeName(cameraLabel)}-${stamp}.${extensionForMime(mimeType)}`;
}

export function getContactSheetLayout(
  count = 9,
  cellSize = CONTACT_SHEET_CELL_SIZE,
  gap = CONTACT_SHEET_GAP,
): ContactSheetLayout {
  const columns = CONTACT_SHEET_COLUMNS;
  const rows = Math.max(1, Math.ceil(count / columns));
  return {
    width: columns * cellSize + (columns - 1) * gap,
    height: rows * cellSize + (rows - 1) * gap,
    cellSize,
    gap,
    columns,
    rows,
  };
}

export function cameraMatchesResult(
  camera: CameraConfig,
  cell?: GenerationCell,
  context?: ResultContext & { provider: ProviderId; model: ImageModelId },
) {
  const snapshot = cell?.metadata?.camera;
  if (!snapshot) return false;
  if (context) {
    const metadata = cell?.metadata;
    if (
      !metadata ||
      metadata.provider !== context.provider ||
      metadata.model !== context.model ||
      metadata.guideRequested !== context.guideEnabled ||
      metadata.referencePolicyEnabled !== context.referenceEnabled ||
      metadata.normalizationRequested !== context.normalizationEnabled
    ) {
      return false;
    }
  }
  return (
    snapshot.yaw === camera.yaw &&
    snapshot.pitch === camera.pitch &&
    snapshot.roll === camera.roll &&
    snapshot.fov === camera.fov &&
    snapshot.distance === camera.distance
  );
}

export function getExportReadiness(
  cameras: CameraConfig[],
  generation: GenerationCell[],
  context?: ResultContext & { provider: ProviderId; model: ImageModelId },
) {
  const activeCameras = cameras.filter((camera) => camera.active);
  const availableCells = generation.filter(
    (cell) =>
      cell.status === "complete" &&
      cell.source === "api" &&
      Boolean(cell.resultUrl),
  );
  const availableIds = new Set(availableCells.map((cell) => cell.cameraId));
  const completed = activeCameras.filter((camera) => {
    const cell = generation.find((item) => item.cameraId === camera.id);
    return (
      availableIds.has(camera.id) && cameraMatchesResult(camera, cell, context)
    );
  }).length;

  return {
    active: activeCameras.length,
    available: availableCells.length,
    completed,
    canDownloadZip: availableCells.length > 0,
    canDownloadContactSheet:
      activeCameras.length > 0 && completed === activeCameras.length,
  };
}

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.decoding = "async";
    image.onload = () => resolve(image);
    image.onerror = () =>
      reject(new Error("생성 결과 이미지를 시트에 불러오지 못했습니다."));
    image.src = url;
  });
}

function canvasToPng(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error("3×3 PNG 시트를 만들지 못했습니다."));
    }, "image/png");
  });
}

function drawContainedImage(
  context: CanvasRenderingContext2D,
  image: HTMLImageElement,
  x: number,
  y: number,
  size: number,
) {
  const width = image.naturalWidth || image.width;
  const height = image.naturalHeight || image.height;
  const scale = Math.min(size / width, size / height);
  const drawWidth = width * scale;
  const drawHeight = height * scale;
  context.drawImage(
    image,
    x + (size - drawWidth) / 2,
    y + (size - drawHeight) / 2,
    drawWidth,
    drawHeight,
  );
}

export async function createContactSheetBlob({
  cameras,
  generation,
  cellSize = CONTACT_SHEET_CELL_SIZE,
  gap = CONTACT_SHEET_GAP,
  includeLabels = true,
  resultContext,
}: ContactSheetOptions) {
  const readiness = getExportReadiness(cameras, generation, resultContext);
  if (!readiness.canDownloadContactSheet) {
    throw new Error("활성 카메라의 실제 생성 결과가 모두 필요합니다.");
  }

  const layout = getContactSheetLayout(cameras.length, cellSize, gap);
  const canvas = document.createElement("canvas");
  canvas.width = layout.width;
  canvas.height = layout.height;
  const context = canvas.getContext("2d", { alpha: false });
  if (!context) throw new Error("시트 생성용 Canvas를 만들 수 없습니다.");

  context.fillStyle = "#080b0f";
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = "high";

  for (let index = 0; index < cameras.length; index += 1) {
    const camera = cameras[index];
    const column = index % layout.columns;
    const row = Math.floor(index / layout.columns);
    const x = column * (cellSize + gap);
    const y = row * (cellSize + gap);

    context.fillStyle = "#07090c";
    context.fillRect(x, y, cellSize, cellSize);

    if (!camera.active) {
      context.fillStyle = "#778292";
      context.font = "600 24px Pretendard, sans-serif";
      context.textAlign = "center";
      context.textBaseline = "middle";
      context.fillText(
        `${camera.label} · OFF`,
        x + cellSize / 2,
        y + cellSize / 2,
      );
      continue;
    }

    const cell = generation.find((item) => item.cameraId === camera.id);
    if (!cell?.resultUrl) continue;
    const image = await loadImage(cell.resultUrl);
    drawContainedImage(context, image, x, y, cellSize);

    if (includeLabels) {
      const labelHeight = 58;
      const gradient = context.createLinearGradient(
        0,
        y + cellSize - labelHeight,
        0,
        y + cellSize,
      );
      gradient.addColorStop(0, "rgba(0,0,0,0)");
      gradient.addColorStop(1, "rgba(0,0,0,0.82)");
      context.fillStyle = gradient;
      context.fillRect(x, y + cellSize - labelHeight, cellSize, labelHeight);
      context.fillStyle = "#ffffff";
      context.font = "700 20px Pretendard, sans-serif";
      context.textAlign = "left";
      context.textBaseline = "alphabetic";
      context.fillText(
        `${camera.label}  Y ${camera.yaw}° · P ${camera.pitch}° · FOV ${camera.fov}°`,
        x + 18,
        y + cellSize - 16,
      );
    }
  }

  return canvasToPng(canvas);
}

async function defaultFetchBlob(url: string) {
  const response = await fetch(url);
  if (!response.ok) throw new Error("결과 파일을 읽지 못했습니다.");
  return response.blob();
}

export function buildExportManifest({
  cameras,
  generation,
  projectName = "ViewGrid project",
  resultContext,
}: ExportInput) {
  return {
    schemaVersion: 1,
    exportedAt: new Date().toISOString(),
    projectName,
    resultContext: resultContext ?? null,
    cameras: cameras.map((camera) => {
      const cell = generation.find((item) => item.cameraId === camera.id);
      return {
        ...camera,
        generation: cell
          ? {
              status: cell.status,
              revision: cell.revision,
              source: cell.source ?? null,
              metadata: cell.metadata ?? null,
              error: cell.error ?? null,
            }
          : null,
      };
    }),
  };
}

export async function createResultsZip({
  cameras,
  generation,
  projectName = "viewgrid",
  contactSheet,
  fetchBlob = defaultFetchBlob,
  resultContext,
}: ZipOptions) {
  const readiness = getExportReadiness(cameras, generation, resultContext);
  if (!readiness.canDownloadZip) {
    throw new Error("ZIP에 포함할 실제 생성 결과가 없습니다.");
  }

  const { default: JSZip } = await import("jszip");
  const zip = new JSZip();
  const images = zip.folder("images");
  if (!images) throw new Error("ZIP 이미지 폴더를 만들지 못했습니다.");

  for (const camera of cameras) {
    const cell = generation.find((item) => item.cameraId === camera.id);
    if (
      cell?.status !== "complete" ||
      cell.source !== "api" ||
      !cell.resultUrl
    ) {
      continue;
    }
    const blob = await fetchBlob(cell.resultUrl);
    images.file(
      resultFilename(
        camera.label,
        cell.metadata?.mimeType || blob.type,
        cell.metadata?.createdAt,
      ),
      blob,
    );
  }

  if (contactSheet) zip.file("viewgrid-contact-sheet.png", contactSheet);
  zip.file(
    "viewgrid-manifest.json",
    JSON.stringify(
      buildExportManifest({
        cameras,
        generation,
        projectName,
        resultContext,
      }),
      null,
      2,
    ),
  );

  return zip.generateAsync({
    type: "blob",
    compression: "DEFLATE",
    compressionOptions: { level: 6 },
  });
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1_000);
}

export function downloadUrl(url: string, filename: string) {
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
}
