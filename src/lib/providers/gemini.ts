import {
  normalizeProviderError,
  ProviderRequestError,
} from "@/lib/provider-error";
import type { GeminiModelId } from "@/types/generation";

type GenerateInput = {
  apiKey: string;
  model: GeminiModelId;
  image: File;
  guide?: File;
  reference?: File;
  prompt: string;
  signal: AbortSignal;
};

type ImageBlock = { data: string; mimeType: string };

function findImageBlock(value: unknown): ImageBlock | null {
  if (!value || typeof value !== "object") return null;
  if (Array.isArray(value)) {
    for (const entry of value) {
      const found = findImageBlock(entry);
      if (found) return found;
    }
    return null;
  }

  const record = value as Record<string, unknown>;
  const type = record.type;
  const data = record.data;
  if (type === "image" && typeof data === "string") {
    return {
      data,
      mimeType:
        (typeof record.mime_type === "string" && record.mime_type) ||
        (typeof record.mimeType === "string" && record.mimeType) ||
        "image/png",
    };
  }

  const outputImage = record.output_image ?? record.outputImage;
  if (outputImage && typeof outputImage === "object") {
    const image = outputImage as Record<string, unknown>;
    if (typeof image.data === "string") {
      return {
        data: image.data,
        mimeType:
          (typeof image.mime_type === "string" && image.mime_type) ||
          (typeof image.mimeType === "string" && image.mimeType) ||
          "image/png",
      };
    }
  }

  for (const nested of Object.values(record)) {
    const found = findImageBlock(nested);
    if (found) return found;
  }
  return null;
}

export async function checkGeminiConnection(
  apiKey: string,
  model: GeminiModelId,
  signal: AbortSignal,
) {
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}`,
    {
      headers: { "x-goog-api-key": apiKey },
      signal,
      cache: "no-store",
    },
  );
  if (!response.ok) {
    const body = await response.json().catch(() => null);
    throw normalizeProviderError(response.status, "gemini", body);
  }
}

export async function generateWithGemini(input: GenerateInput) {
  const bytes = Buffer.from(await input.image.arrayBuffer());
  const guideBytes = input.guide
    ? Buffer.from(await input.guide.arrayBuffer())
    : null;
  const referenceBytes = input.reference
    ? Buffer.from(await input.reference.arrayBuffer())
    : null;
  const response = await fetch(
    "https://generativelanguage.googleapis.com/v1beta/interactions",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": input.apiKey,
      },
      body: JSON.stringify({
        model: input.model,
        input: [
          { type: "text", text: input.prompt },
          {
            type: "image",
            mime_type: input.image.type,
            data: bytes.toString("base64"),
          },
          ...(input.guide && guideBytes
            ? [
                {
                  type: "image",
                  mime_type: input.guide.type,
                  data: guideBytes.toString("base64"),
                },
              ]
            : []),
          ...(input.reference && referenceBytes
            ? [
                {
                  type: "image",
                  mime_type: input.reference.type,
                  data: referenceBytes.toString("base64"),
                },
              ]
            : []),
        ],
        response_format: {
          type: "image",
          mime_type: "image/jpeg",
          aspect_ratio: "1:1",
          image_size: "1K",
        },
      }),
      signal: input.signal,
      cache: "no-store",
    },
  );

  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    throw normalizeProviderError(response.status, "gemini", payload);
  }
  const image = findImageBlock(payload);
  if (!image) {
    throw new ProviderRequestError(
      502,
      "missing_image",
      "Gemini 응답에 생성된 이미지가 없습니다.",
      true,
    );
  }

  return {
    bytes: Buffer.from(image.data, "base64"),
    mimeType: image.mimeType,
    requestId: response.headers.get("x-request-id"),
  };
}

export const __test__ = { findImageBlock };
