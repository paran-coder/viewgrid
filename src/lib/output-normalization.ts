export const OUTPUT_NORMALIZATION_VERSION = "viewgrid-normalize-v1";
export const NORMALIZED_OUTPUT_SIZE = 1024;
export const MAX_NORMALIZED_OUTPUT_BYTES = 3_900_000;

export type RgbMean = { r: number; g: number; b: number };
export type ColorGains = { r: number; g: number; b: number };

export type NormalizationResult = {
  blob: Blob;
  width: number;
  height: number;
  colorGains: ColorGains;
  referenceKind: "source" | "generated";
};

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

export function computeColorGains(
  generated: RgbMean,
  reference: RgbMean,
): ColorGains {
  const luminanceGenerated =
    generated.r * 0.2126 + generated.g * 0.7152 + generated.b * 0.0722;
  const luminanceReference =
    reference.r * 0.2126 + reference.g * 0.7152 + reference.b * 0.0722;
  const luminanceGain = clamp(
    luminanceReference / Math.max(1, luminanceGenerated),
    0.9,
    1.1,
  );

  return {
    r: clamp(
      (reference.r / Math.max(1, generated.r)) * luminanceGain,
      0.84,
      1.16,
    ),
    g: clamp(
      (reference.g / Math.max(1, generated.g)) * luminanceGain,
      0.84,
      1.16,
    ),
    b: clamp(
      (reference.b / Math.max(1, generated.b)) * luminanceGain,
      0.84,
      1.16,
    ),
  };
}

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.decoding = "async";
    image.onload = () => resolve(image);
    image.onerror = () =>
      reject(new Error("정규화할 이미지를 읽지 못했습니다."));
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
        blob
          ? resolve(blob)
          : reject(new Error("정규화 이미지를 저장하지 못했습니다.")),
      type,
      quality,
    );
  });
}

function drawContained(
  context: CanvasRenderingContext2D,
  image: HTMLImageElement,
  size: number,
) {
  const width = image.naturalWidth || image.width;
  const height = image.naturalHeight || image.height;
  const scale = Math.min(size / width, size / height);
  const drawWidth = width * scale;
  const drawHeight = height * scale;
  context.fillStyle = "#080b0f";
  context.fillRect(0, 0, size, size);
  context.drawImage(
    image,
    (size - drawWidth) / 2,
    (size - drawHeight) / 2,
    drawWidth,
    drawHeight,
  );
}

function sampledMean(image: HTMLImageElement, sampleSize = 32): RgbMean {
  const canvas = document.createElement("canvas");
  canvas.width = sampleSize;
  canvas.height = sampleSize;
  const context = canvas.getContext("2d", { alpha: false });
  if (!context) return { r: 128, g: 128, b: 128 };
  context.drawImage(image, 0, 0, sampleSize, sampleSize);
  try {
    const pixels = context.getImageData(0, 0, sampleSize, sampleSize).data;
    let r = 0;
    let g = 0;
    let b = 0;
    let count = 0;
    for (let index = 0; index < pixels.length; index += 16) {
      r += pixels[index];
      g += pixels[index + 1];
      b += pixels[index + 2];
      count += 1;
    }
    return {
      r: r / Math.max(1, count),
      g: g / Math.max(1, count),
      b: b / Math.max(1, count),
    };
  } catch {
    return { r: 128, g: 128, b: 128 };
  }
}

function applyGains(
  context: CanvasRenderingContext2D,
  size: number,
  gains: ColorGains,
) {
  try {
    const imageData = context.getImageData(0, 0, size, size);
    const pixels = imageData.data;
    for (let index = 0; index < pixels.length; index += 4) {
      pixels[index] = clamp(Math.round(pixels[index] * gains.r), 0, 255);
      pixels[index + 1] = clamp(
        Math.round(pixels[index + 1] * gains.g),
        0,
        255,
      );
      pixels[index + 2] = clamp(
        Math.round(pixels[index + 2] * gains.b),
        0,
        255,
      );
    }
    context.putImageData(imageData, 0, 0);
  } catch {
    // Canvas 픽셀 접근이 제한된 환경에서는 크기 정규화만 유지합니다.
  }
}

export async function normalizeGeneratedImage(
  generatedBlob: Blob,
  referenceUrl: string,
  referenceKind: "source" | "generated",
): Promise<NormalizationResult> {
  const generatedUrl = URL.createObjectURL(generatedBlob);
  try {
    const [generatedImage, referenceImage] = await Promise.all([
      loadImage(generatedUrl),
      loadImage(referenceUrl),
    ]);
    const canvas = document.createElement("canvas");
    canvas.width = NORMALIZED_OUTPUT_SIZE;
    canvas.height = NORMALIZED_OUTPUT_SIZE;
    const context = canvas.getContext("2d", { alpha: false });
    if (!context) throw new Error("정규화용 Canvas를 만들 수 없습니다.");
    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = "high";
    drawContained(context, generatedImage, NORMALIZED_OUTPUT_SIZE);

    const gains = computeColorGains(
      sampledMean(generatedImage),
      sampledMean(referenceImage),
    );
    applyGains(context, NORMALIZED_OUTPUT_SIZE, gains);

    let blob = await canvasToBlob(canvas, "image/webp", 0.9);
    if (blob.size > MAX_NORMALIZED_OUTPUT_BYTES) {
      blob = await canvasToBlob(canvas, "image/webp", 0.78);
    }
    return {
      blob,
      width: NORMALIZED_OUTPUT_SIZE,
      height: NORMALIZED_OUTPUT_SIZE,
      colorGains: gains,
      referenceKind,
    };
  } finally {
    URL.revokeObjectURL(generatedUrl);
  }
}
