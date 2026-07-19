import {
  normalizeProviderError,
  ProviderRequestError,
} from "@/lib/provider-error";
import type { OpenAIModelId } from "@/types/generation";

type GenerateInput = {
  apiKey: string;
  model: OpenAIModelId;
  image: File;
  guide?: File;
  reference?: File;
  prompt: string;
  signal: AbortSignal;
};

export async function checkOpenAIConnection(
  apiKey: string,
  model: OpenAIModelId,
  signal: AbortSignal,
) {
  const response = await fetch(`https://api.openai.com/v1/models/${model}`, {
    headers: { Authorization: `Bearer ${apiKey}` },
    signal,
    cache: "no-store",
  });
  if (!response.ok) {
    const body = await response.json().catch(() => null);
    throw normalizeProviderError(response.status, "openai", body);
  }
}

export async function generateWithOpenAI(input: GenerateInput) {
  const body = new FormData();
  body.append("model", input.model);
  body.append("image[]", input.image, input.image.name);
  if (input.guide) {
    body.append("image[]", input.guide, input.guide.name);
  }
  if (input.reference) {
    body.append("image[]", input.reference, input.reference.name);
  }
  body.append("prompt", input.prompt);
  body.append("size", "1024x1024");
  body.append("quality", "medium");
  body.append("output_format", "webp");
  body.append("output_compression", "85");

  const response = await fetch("https://api.openai.com/v1/images/edits", {
    method: "POST",
    headers: { Authorization: `Bearer ${input.apiKey}` },
    body,
    signal: input.signal,
    cache: "no-store",
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    throw normalizeProviderError(response.status, "openai", payload);
  }

  const data =
    payload && typeof payload === "object"
      ? (payload as { data?: Array<{ b64_json?: string }> }).data
      : undefined;
  const base64 = data?.[0]?.b64_json;
  if (!base64) {
    throw new ProviderRequestError(
      502,
      "missing_image",
      "OpenAI 응답에 생성된 이미지가 없습니다.",
      true,
    );
  }

  return {
    bytes: Buffer.from(base64, "base64"),
    mimeType: "image/webp",
    requestId: response.headers.get("x-request-id"),
  };
}
