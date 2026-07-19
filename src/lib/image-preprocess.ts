export const MAX_CLIENT_IMAGE_BYTES = 1_650_000;
export const MAX_CLIENT_EDGE = 1536;
export const MAX_REFERENCE_IMAGE_BYTES = 820_000;
export const MAX_REFERENCE_EDGE = 1024;

export type PreparedImage = {
  file: File;
  width: number;
  height: number;
  byteSize: number;
  workerUsed?: boolean;
};

type WorkerMode = "source" | "reference";
type WorkerResponse =
  | {
      id: string;
      ok: true;
      blob: Blob;
      width: number;
      height: number;
      byteSize: number;
    }
  | { id: string; ok: false; message: string };

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.decoding = "async";
    image.onload = () => resolve(image);
    image.onerror = () =>
      reject(new Error("이미지를 브라우저에서 읽을 수 없습니다."));
    image.src = url;
  });
}

function canvasToBlob(
  canvas: HTMLCanvasElement,
  type: string,
  quality: number,
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) =>
        blob ? resolve(blob) : reject(new Error("이미지 압축에 실패했습니다.")),
      type,
      quality,
    );
  });
}

function safeFileName(filename: string, fallback: string) {
  return filename.replace(/\.[^.]+$/, "") || fallback;
}

async function processWithWorker(
  url: string,
  mode: WorkerMode,
): Promise<Omit<PreparedImage, "file"> & { blob: Blob }> {
  if (typeof Worker === "undefined" || typeof fetch === "undefined") {
    throw new Error("이미지 Worker를 지원하지 않는 브라우저입니다.");
  }

  const response = await fetch(url);
  if (!response.ok) throw new Error("이미지 원본을 읽지 못했습니다.");
  const sourceBlob = await response.blob();
  const worker = new Worker("/image-preprocess-worker.js");
  const id =
    globalThis.crypto?.randomUUID?.() ??
    `viewgrid-${Date.now()}-${Math.random().toString(36).slice(2)}`;

  return new Promise((resolve, reject) => {
    const timeout = window.setTimeout(() => {
      worker.terminate();
      reject(new Error("이미지 Worker 처리 시간이 초과되었습니다."));
    }, 30_000);

    worker.addEventListener(
      "message",
      (event: MessageEvent<WorkerResponse>) => {
        if (event.data.id !== id) return;
        window.clearTimeout(timeout);
        worker.terminate();
        if (!event.data.ok) {
          reject(new Error(event.data.message));
          return;
        }
        resolve({
          blob: event.data.blob,
          width: event.data.width,
          height: event.data.height,
          byteSize: event.data.byteSize,
          workerUsed: true,
        });
      },
      { once: true },
    );
    worker.addEventListener(
      "error",
      () => {
        window.clearTimeout(timeout);
        worker.terminate();
        reject(new Error("이미지 Worker 실행에 실패했습니다."));
      },
      { once: true },
    );
    worker.postMessage({ id, blob: sourceBlob, mode });
  });
}

async function prepareSourceOnMainThread(
  url: string,
  filename: string,
): Promise<PreparedImage> {
  const image = await loadImage(url);
  const sourceWidth = image.naturalWidth || image.width;
  const sourceHeight = image.naturalHeight || image.height;
  if (!sourceWidth || !sourceHeight) {
    throw new Error("이미지 크기를 확인할 수 없습니다.");
  }

  let scale = Math.min(
    1,
    MAX_CLIENT_EDGE / Math.max(sourceWidth, sourceHeight),
  );
  let quality = 0.9;
  let blob: Blob | null = null;
  let width = Math.max(1, Math.round(sourceWidth * scale));
  let height = Math.max(1, Math.round(sourceHeight * scale));

  for (let attempt = 0; attempt < 6; attempt += 1) {
    width = Math.max(1, Math.round(sourceWidth * scale));
    height = Math.max(1, Math.round(sourceHeight * scale));
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d", { alpha: false });
    if (!context) throw new Error("이미지 처리용 Canvas를 만들 수 없습니다.");

    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, width, height);
    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = "high";
    context.drawImage(image, 0, 0, width, height);
    blob = await canvasToBlob(canvas, "image/jpeg", quality);
    canvas.width = 1;
    canvas.height = 1;

    if (blob.size <= MAX_CLIENT_IMAGE_BYTES) break;
    quality = Math.max(0.68, quality - 0.07);
    scale *= 0.86;
  }

  if (!blob || blob.size > MAX_CLIENT_IMAGE_BYTES) {
    throw new Error("이미지를 전송 가능한 크기로 줄이지 못했습니다.");
  }

  return {
    file: new File([blob], `${safeFileName(filename, "source-image")}.jpg`, {
      type: "image/jpeg",
    }),
    width,
    height,
    byteSize: blob.size,
    workerUsed: false,
  };
}

export async function prepareSourceImage(
  url: string,
  filename = "source-image.jpg",
): Promise<PreparedImage> {
  try {
    const prepared = await processWithWorker(url, "source");
    return {
      file: new File(
        [prepared.blob],
        `${safeFileName(filename, "source-image")}.jpg`,
        { type: "image/jpeg" },
      ),
      width: prepared.width,
      height: prepared.height,
      byteSize: prepared.byteSize,
      workerUsed: true,
    };
  } catch {
    return prepareSourceOnMainThread(url, filename);
  }
}

export function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

async function prepareReferenceOnMainThread(
  url: string,
  filename: string,
): Promise<PreparedImage> {
  const image = await loadImage(url);
  const sourceWidth = image.naturalWidth || image.width;
  const sourceHeight = image.naturalHeight || image.height;
  if (!sourceWidth || !sourceHeight) {
    throw new Error("인접 결과 참조의 크기를 확인할 수 없습니다.");
  }

  let scale = Math.min(
    1,
    MAX_REFERENCE_EDGE / Math.max(sourceWidth, sourceHeight),
  );
  let quality = 0.86;
  let blob: Blob | null = null;
  let width = Math.max(1, Math.round(sourceWidth * scale));
  let height = Math.max(1, Math.round(sourceHeight * scale));

  for (let attempt = 0; attempt < 6; attempt += 1) {
    width = Math.max(1, Math.round(sourceWidth * scale));
    height = Math.max(1, Math.round(sourceHeight * scale));
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d", { alpha: false });
    if (!context)
      throw new Error("참조 이미지 처리용 Canvas를 만들 수 없습니다.");
    context.fillStyle = "#080b0f";
    context.fillRect(0, 0, width, height);
    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = "high";
    context.drawImage(image, 0, 0, width, height);
    blob = await canvasToBlob(canvas, "image/webp", quality);
    canvas.width = 1;
    canvas.height = 1;
    if (blob.size <= MAX_REFERENCE_IMAGE_BYTES) break;
    quality = Math.max(0.68, quality - 0.06);
    scale *= 0.88;
  }

  if (!blob || blob.size > MAX_REFERENCE_IMAGE_BYTES) {
    throw new Error("인접 결과를 참조 가능한 크기로 줄이지 못했습니다.");
  }
  return {
    file: new File([blob], `${safeFileName(filename, "reference-view")}.webp`, {
      type: "image/webp",
    }),
    width,
    height,
    byteSize: blob.size,
    workerUsed: false,
  };
}

export async function prepareReferenceImage(
  url: string,
  filename = "reference-view.webp",
): Promise<PreparedImage> {
  try {
    const prepared = await processWithWorker(url, "reference");
    return {
      file: new File(
        [prepared.blob],
        `${safeFileName(filename, "reference-view")}.webp`,
        { type: "image/webp" },
      ),
      width: prepared.width,
      height: prepared.height,
      byteSize: prepared.byteSize,
      workerUsed: true,
    };
  } catch {
    return prepareReferenceOnMainThread(url, filename);
  }
}
