import { clamp } from "@/lib/utils";
import type { CameraConfig } from "@/types/camera";

export const CAMERA_GUIDE_VERSION = "perspective-strips-v1";
export const CAMERA_GUIDE_MAX_EDGE = 1024;
export const CAMERA_GUIDE_MAX_BYTES = 950_000;

export type CameraGuideGeometry = {
  canvasSize: number;
  sourceAspect: number;
  subjectScale: number;
  yawCompression: number;
  yawPerspective: number;
  pitchCompression: number;
  pitchPerspective: number;
  offsetX: number;
  offsetY: number;
  rollRadians: number;
};

export type CameraGuideOptions = {
  maxEdge?: number;
  maxBytes?: number;
  quality?: number;
  stripCount?: number;
};

function canvasToBlob(
  canvas: HTMLCanvasElement,
  type: string,
  quality: number,
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) =>
        blob
          ? resolve(blob)
          : reject(new Error("카메라 가이드 압축에 실패했습니다.")),
      type,
      quality,
    );
  });
}

export function loadCameraGuideSource(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.decoding = "async";
    image.onload = () => resolve(image);
    image.onerror = () =>
      reject(new Error("카메라 가이드용 원본 이미지를 읽지 못했습니다."));
    image.src = url;
  });
}

export function calculateCameraGuideGeometry(
  camera: CameraConfig,
  sourceWidth: number,
  sourceHeight: number,
  canvasSize = CAMERA_GUIDE_MAX_EDGE,
): CameraGuideGeometry {
  const yawRatio = clamp(camera.yaw / 180, -1, 1);
  const pitchRatio = clamp(camera.pitch / 80, -1, 1);
  const fovScale = clamp(50 / camera.fov, 0.62, 1.48);
  const distanceScale = clamp(1 / camera.distance, 0.56, 1.62);

  return {
    canvasSize,
    sourceAspect: sourceWidth / Math.max(1, sourceHeight),
    subjectScale: clamp(fovScale * distanceScale, 0.5, 1.7),
    yawCompression: clamp(
      Math.cos((Math.abs(camera.yaw) * Math.PI) / 180) * 0.9 + 0.1,
      0.55,
      1,
    ),
    yawPerspective: yawRatio * 0.24,
    pitchCompression: clamp(
      Math.cos((Math.abs(camera.pitch) * Math.PI) / 180) * 0.94 + 0.06,
      0.72,
      1,
    ),
    pitchPerspective: pitchRatio * 0.2,
    offsetX: -yawRatio * canvasSize * 0.075,
    offsetY: pitchRatio * canvasSize * 0.075,
    rollRadians: (camera.roll * Math.PI) / 180,
  };
}

function createCanvas(size: number) {
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  return canvas;
}

function getContext(canvas: HTMLCanvasElement) {
  const context = canvas.getContext("2d");
  if (!context) throw new Error("카메라 가이드용 Canvas를 만들 수 없습니다.");
  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = "high";
  return context;
}

function drawCover(
  context: CanvasRenderingContext2D,
  image: HTMLImageElement,
  size: number,
) {
  const width = image.naturalWidth || image.width;
  const height = image.naturalHeight || image.height;
  const scale = Math.max(size / width, size / height);
  const drawWidth = width * scale;
  const drawHeight = height * scale;
  context.drawImage(
    image,
    (size - drawWidth) / 2,
    (size - drawHeight) / 2,
    drawWidth,
    drawHeight,
  );
}

function renderSourcePlane(
  image: HTMLImageElement,
  size: number,
  geometry: CameraGuideGeometry,
) {
  const canvas = createCanvas(size);
  const context = getContext(canvas);
  const sourceWidth = image.naturalWidth || image.width;
  const sourceHeight = image.naturalHeight || image.height;
  const fitScale =
    Math.min((size * 0.78) / sourceWidth, (size * 0.78) / sourceHeight) *
    geometry.subjectScale;
  const drawWidth = sourceWidth * fitScale;
  const drawHeight = sourceHeight * fitScale;
  context.drawImage(
    image,
    (size - drawWidth) / 2,
    (size - drawHeight) / 2,
    drawWidth,
    drawHeight,
  );
  return canvas;
}

function warpYaw(
  source: HTMLCanvasElement,
  geometry: CameraGuideGeometry,
  stripCount: number,
) {
  const size = source.width;
  const canvas = createCanvas(size);
  const context = getContext(canvas);
  const projectedWidth = size * geometry.yawCompression;
  const leftScale = 1 - geometry.yawPerspective;
  const rightScale = 1 + geometry.yawPerspective;

  for (let index = 0; index < stripCount; index += 1) {
    const u0 = index / stripCount;
    const u1 = (index + 1) / stripCount;
    const middle = (u0 + u1) / 2;
    const heightScale = leftScale + (rightScale - leftScale) * middle;
    const curve =
      Math.sin((middle - 0.5) * Math.PI) *
      geometry.yawPerspective *
      size *
      0.07;
    const destinationX =
      (size - projectedWidth) / 2 + u0 * projectedWidth + curve;
    const destinationWidth = projectedWidth / stripCount + 1.5;
    const destinationHeight = size * heightScale;
    const destinationY = (size - destinationHeight) / 2;

    context.drawImage(
      source,
      Math.floor(u0 * size),
      0,
      Math.ceil((u1 - u0) * size) + 1,
      size,
      destinationX,
      destinationY,
      destinationWidth,
      destinationHeight,
    );
  }
  return canvas;
}

function warpPitch(
  source: HTMLCanvasElement,
  geometry: CameraGuideGeometry,
  stripCount: number,
) {
  const size = source.width;
  const canvas = createCanvas(size);
  const context = getContext(canvas);
  const projectedHeight = size * geometry.pitchCompression;
  const topScale = 1 + geometry.pitchPerspective;
  const bottomScale = 1 - geometry.pitchPerspective;

  for (let index = 0; index < stripCount; index += 1) {
    const v0 = index / stripCount;
    const v1 = (index + 1) / stripCount;
    const middle = (v0 + v1) / 2;
    const widthScale = topScale + (bottomScale - topScale) * middle;
    const curve =
      Math.sin((middle - 0.5) * Math.PI) *
      geometry.pitchPerspective *
      size *
      0.055;
    const destinationY =
      (size - projectedHeight) / 2 + v0 * projectedHeight + curve;
    const destinationHeight = projectedHeight / stripCount + 1.5;
    const destinationWidth = size * widthScale;
    const destinationX = (size - destinationWidth) / 2;

    context.drawImage(
      source,
      0,
      Math.floor(v0 * size),
      size,
      Math.ceil((v1 - v0) * size) + 1,
      destinationX,
      destinationY,
      destinationWidth,
      destinationHeight,
    );
  }
  return canvas;
}

export function renderCameraGuideCanvas(
  image: HTMLImageElement,
  camera: CameraConfig,
  options: CameraGuideOptions = {},
) {
  const size = Math.max(
    320,
    Math.min(CAMERA_GUIDE_MAX_EDGE, Math.round(options.maxEdge ?? 900)),
  );
  const strips = Math.max(32, Math.min(160, options.stripCount ?? 96));
  const sourceWidth = image.naturalWidth || image.width;
  const sourceHeight = image.naturalHeight || image.height;
  const geometry = calculateCameraGuideGeometry(
    camera,
    sourceWidth,
    sourceHeight,
    size,
  );
  const plane = renderSourcePlane(image, size, geometry);
  const yaw = warpYaw(plane, geometry, strips);
  const pitch = warpPitch(yaw, geometry, strips);
  const canvas = createCanvas(size);
  const context = getContext(canvas);

  context.fillStyle = "#11161c";
  context.fillRect(0, 0, size, size);
  context.save();
  context.globalAlpha = 0.22;
  context.filter = "blur(28px) saturate(0.7)";
  drawCover(context, image, size);
  context.restore();
  context.fillStyle = "rgba(5, 8, 12, 0.34)";
  context.fillRect(0, 0, size, size);

  context.save();
  context.translate(size / 2 + geometry.offsetX, size / 2 + geometry.offsetY);
  context.rotate(geometry.rollRadians);
  context.drawImage(pitch, -size / 2, -size / 2, size, size);
  context.restore();

  return { canvas, geometry };
}

export async function createCameraGuideFile(
  image: HTMLImageElement,
  camera: CameraConfig,
  filename = "camera-guide.jpg",
  options: CameraGuideOptions = {},
) {
  let edge = Math.min(
    CAMERA_GUIDE_MAX_EDGE,
    Math.round(options.maxEdge ?? CAMERA_GUIDE_MAX_EDGE),
  );
  let quality = options.quality ?? 0.84;
  const maxBytes = options.maxBytes ?? CAMERA_GUIDE_MAX_BYTES;
  let blob: Blob | null = null;

  for (let attempt = 0; attempt < 5; attempt += 1) {
    const { canvas } = renderCameraGuideCanvas(image, camera, {
      ...options,
      maxEdge: edge,
    });
    blob = await canvasToBlob(canvas, "image/jpeg", quality);
    if (blob.size <= maxBytes) break;
    quality = Math.max(0.68, quality - 0.06);
    edge = Math.max(640, Math.round(edge * 0.86));
  }

  if (!blob || blob.size > maxBytes) {
    throw new Error("카메라 가이드를 전송 가능한 크기로 줄이지 못했습니다.");
  }

  const safeName = filename.replace(/\.[^.]+$/, "") || "camera-guide";
  return new File([blob], `${safeName}-${camera.id}-guide.jpg`, {
    type: "image/jpeg",
  });
}
