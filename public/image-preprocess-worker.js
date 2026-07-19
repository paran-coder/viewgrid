/* Off-main-thread image resize and compression. No network or persistent storage access. */
const MODES = {
  source: {
    maxBytes: 1650000,
    maxEdge: 1536,
    mimeType: "image/jpeg",
    initialQuality: 0.9,
    minQuality: 0.68,
    qualityStep: 0.07,
    scaleStep: 0.86,
    background: "#ffffff",
  },
  reference: {
    maxBytes: 820000,
    maxEdge: 1024,
    mimeType: "image/webp",
    initialQuality: 0.86,
    minQuality: 0.68,
    qualityStep: 0.06,
    scaleStep: 0.88,
    background: "#080b0f",
  },
};

self.addEventListener("message", async (event) => {
  const { id, blob: sourceBlob, mode } = event.data || {};
  const config = MODES[mode];
  if (!id || !(sourceBlob instanceof Blob) || !config) {
    self.postMessage({
      id,
      ok: false,
      message: "이미지 처리 요청이 올바르지 않습니다.",
    });
    return;
  }

  let bitmap;
  try {
    bitmap = await createImageBitmap(sourceBlob, {
      imageOrientation: "from-image",
    });
    const sourceWidth = bitmap.width;
    const sourceHeight = bitmap.height;
    if (!sourceWidth || !sourceHeight)
      throw new Error("이미지 크기를 확인할 수 없습니다.");

    let scale = Math.min(
      1,
      config.maxEdge / Math.max(sourceWidth, sourceHeight),
    );
    let quality = config.initialQuality;
    let outputBlob = null;
    let width = Math.max(1, Math.round(sourceWidth * scale));
    let height = Math.max(1, Math.round(sourceHeight * scale));

    for (let attempt = 0; attempt < 6; attempt += 1) {
      width = Math.max(1, Math.round(sourceWidth * scale));
      height = Math.max(1, Math.round(sourceHeight * scale));
      const canvas = new OffscreenCanvas(width, height);
      const context = canvas.getContext("2d", { alpha: false });
      if (!context)
        throw new Error("이미지 처리용 OffscreenCanvas를 만들 수 없습니다.");
      context.fillStyle = config.background;
      context.fillRect(0, 0, width, height);
      context.imageSmoothingEnabled = true;
      context.imageSmoothingQuality = "high";
      context.drawImage(bitmap, 0, 0, width, height);
      outputBlob = await canvas.convertToBlob({
        type: config.mimeType,
        quality,
      });
      if (outputBlob.size <= config.maxBytes) break;
      quality = Math.max(config.minQuality, quality - config.qualityStep);
      scale *= config.scaleStep;
    }

    if (!outputBlob || outputBlob.size > config.maxBytes) {
      throw new Error("이미지를 전송 가능한 크기로 줄이지 못했습니다.");
    }

    self.postMessage({
      id,
      ok: true,
      blob: outputBlob,
      width,
      height,
      byteSize: outputBlob.size,
    });
  } catch (error) {
    self.postMessage({
      id,
      ok: false,
      message:
        error instanceof Error ? error.message : "이미지 처리에 실패했습니다.",
    });
  } finally {
    bitmap?.close?.();
  }
});
