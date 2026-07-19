import { NextResponse } from "next/server";

import { ProviderRequestError, errorPayload } from "@/lib/provider-error";
import {
  consumeRateLimit,
  createRequestId,
  getClientIdentifier,
  noStoreApiHeaders,
  rateLimitHeaders,
  shouldEnforceLocalRateLimit,
  validateBrowserRequest,
  validateContentType,
} from "@/lib/request-security";
import {
  isAllowedModel,
  isGeminiModel,
  isOpenAIModel,
  isProvider,
} from "@/lib/providers/models";
import { generateWithGemini } from "@/lib/providers/gemini";
import { generateWithOpenAI } from "@/lib/providers/openai";

export const runtime = "nodejs";
export const maxDuration = 300;

const MAX_REQUEST_BYTES = 4_200_000;
const MAX_IMAGE_BYTES = 1_800_000;
const MAX_GUIDE_BYTES = 1_050_000;
const MAX_REFERENCE_BYTES = 900_000;
const MAX_COMBINED_IMAGE_BYTES = 3_750_000;
const GENERATION_TIMEOUT_MS = 240_000;
const RATE_LIMIT = 24;
const RATE_WINDOW_MS = 60_000;
const ALLOWED_MIME_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

function isUploadedFile(value: FormDataEntryValue | null): value is File {
  return value !== null && typeof value !== "string";
}

function validationError(
  message: string,
  headers: HeadersInit,
  code = "invalid_request",
  status = 400,
) {
  return NextResponse.json(
    { error: { code, message, retryable: false } },
    { status, headers },
  );
}

export async function POST(request: Request) {
  const requestId = createRequestId();
  let responseHeaders = noStoreApiHeaders(requestId);
  let providerTimedOut = false;
  let providerTimeout: ReturnType<typeof setTimeout> | null = null;
  let detachRequestAbort: (() => void) | null = null;

  const sourceError = validateBrowserRequest(request);
  if (sourceError) {
    return validationError(
      sourceError.message,
      responseHeaders,
      sourceError.code,
      sourceError.status,
    );
  }

  const contentTypeError = validateContentType(request, "multipart/form-data");
  if (contentTypeError) {
    return validationError(
      contentTypeError.message,
      responseHeaders,
      contentTypeError.code,
      contentTypeError.status,
    );
  }

  if (shouldEnforceLocalRateLimit()) {
    const limit = consumeRateLimit(
      `generate:${getClientIdentifier(request)}`,
      RATE_LIMIT,
      RATE_WINDOW_MS,
    );
    responseHeaders = noStoreApiHeaders(requestId, rateLimitHeaders(limit));
    if (!limit.allowed) {
      return NextResponse.json(
        {
          error: {
            code: "rate_limit_exceeded",
            message: "생성 요청이 너무 많습니다. 잠시 후 다시 시도해 주세요.",
            retryable: true,
          },
        },
        { status: 429, headers: responseHeaders },
      );
    }
  }

  const contentLength = Number(request.headers.get("content-length") ?? 0);
  if (contentLength > MAX_REQUEST_BYTES) {
    return NextResponse.json(
      {
        error: {
          code: "payload_too_large",
          message: "전송 데이터가 Vercel Function 안전 한도를 초과했습니다.",
          retryable: false,
        },
      },
      { status: 413, headers: responseHeaders },
    );
  }

  const apiKey = request.headers.get("x-viewgrid-api-key")?.trim();
  if (!apiKey || apiKey.length < 8 || apiKey.length > 512) {
    return validationError(
      "API 키를 입력해 주세요.",
      responseHeaders,
      "missing_api_key",
    );
  }

  try {
    const form = await request.formData();
    const providerValue = form.get("provider");
    const modelValue = form.get("model");
    const promptValue = form.get("prompt");
    const imageValue = form.get("image");
    const guideValue = form.get("guide");
    const referenceValue = form.get("reference");

    if (typeof providerValue !== "string" || !isProvider(providerValue)) {
      return validationError(
        "지원하지 않는 이미지 공급자입니다.",
        responseHeaders,
      );
    }
    if (
      typeof modelValue !== "string" ||
      !isAllowedModel(providerValue, modelValue)
    ) {
      return validationError(
        "공급자와 모델 조합이 올바르지 않습니다.",
        responseHeaders,
      );
    }
    if (
      typeof promptValue !== "string" ||
      promptValue.length < 20 ||
      promptValue.length > 6000
    ) {
      return validationError(
        "카메라 프롬프트 길이가 올바르지 않습니다.",
        responseHeaders,
      );
    }
    if (!isUploadedFile(imageValue)) {
      return validationError(
        "생성에 사용할 이미지가 없습니다.",
        responseHeaders,
      );
    }
    if (!ALLOWED_MIME_TYPES.has(imageValue.type)) {
      return validationError(
        "JPEG, PNG 또는 WebP 이미지만 전송할 수 있습니다.",
        responseHeaders,
      );
    }
    if (imageValue.size > MAX_IMAGE_BYTES) {
      return NextResponse.json(
        {
          error: {
            code: "image_too_large",
            message: "전처리된 원본 이미지가 1.8MB를 초과했습니다.",
            retryable: false,
          },
        },
        { status: 413, headers: responseHeaders },
      );
    }
    const guide = isUploadedFile(guideValue) ? guideValue : undefined;
    if (guide && !ALLOWED_MIME_TYPES.has(guide.type)) {
      return validationError(
        "카메라 가이드는 JPEG, PNG 또는 WebP 형식이어야 합니다.",
        responseHeaders,
      );
    }
    if (guide && guide.size > MAX_GUIDE_BYTES) {
      return NextResponse.json(
        {
          error: {
            code: "guide_too_large",
            message: "카메라 가이드가 1.05MB를 초과했습니다.",
            retryable: false,
          },
        },
        { status: 413, headers: responseHeaders },
      );
    }
    const reference = isUploadedFile(referenceValue)
      ? referenceValue
      : undefined;
    if (reference && !ALLOWED_MIME_TYPES.has(reference.type)) {
      return validationError(
        "인접 결과 참조는 JPEG, PNG 또는 WebP 형식이어야 합니다.",
        responseHeaders,
      );
    }
    if (reference && reference.size > MAX_REFERENCE_BYTES) {
      return NextResponse.json(
        {
          error: {
            code: "reference_too_large",
            message: "인접 결과 참조가 900KB를 초과했습니다.",
            retryable: false,
          },
        },
        { status: 413, headers: responseHeaders },
      );
    }
    if (
      imageValue.size + (guide?.size ?? 0) + (reference?.size ?? 0) >
      MAX_COMBINED_IMAGE_BYTES
    ) {
      return NextResponse.json(
        {
          error: {
            code: "combined_images_too_large",
            message:
              "원본·카메라 가이드·인접 결과 참조의 합산 크기가 안전 한도를 초과했습니다.",
            retryable: false,
          },
        },
        { status: 413, headers: responseHeaders },
      );
    }

    const startedAt = Date.now();
    const providerController = new AbortController();
    const forwardRequestAbort = () => providerController.abort();
    request.signal.addEventListener("abort", forwardRequestAbort, {
      once: true,
    });
    detachRequestAbort = () =>
      request.signal.removeEventListener("abort", forwardRequestAbort);
    providerTimeout = setTimeout(() => {
      providerTimedOut = true;
      providerController.abort();
    }, GENERATION_TIMEOUT_MS);
    const signal = providerController.signal;
    const result =
      providerValue === "openai" && isOpenAIModel(modelValue)
        ? await generateWithOpenAI({
            apiKey,
            model: modelValue,
            image: imageValue,
            guide,
            reference,
            prompt: promptValue,
            signal,
          })
        : providerValue === "gemini" && isGeminiModel(modelValue)
          ? await generateWithGemini({
              apiKey,
              model: modelValue,
              image: imageValue,
              guide,
              reference,
              prompt: promptValue,
              signal,
            })
          : null;

    if (!result) {
      return validationError("지원하지 않는 모델입니다.", responseHeaders);
    }
    if (result.bytes.byteLength > 4_200_000) {
      throw new ProviderRequestError(
        502,
        "output_too_large",
        "생성 이미지가 Vercel 응답 한도를 초과했습니다. 더 낮은 출력 설정이 필요합니다.",
        true,
      );
    }

    const durationMs = Date.now() - startedAt;
    return new Response(result.bytes, {
      status: 200,
      headers: {
        ...responseHeaders,
        "Content-Type": result.mimeType,
        "Content-Length": String(result.bytes.byteLength),
        "Content-Disposition": 'inline; filename="viewgrid-generated-image"',
        "X-ViewGrid-Provider": providerValue,
        "X-ViewGrid-Model": modelValue,
        "X-ViewGrid-Duration-Ms": String(durationMs),
        "X-ViewGrid-Guide-Used": guide ? "true" : "false",
        "X-ViewGrid-Reference-Used": reference ? "true" : "false",
        "Server-Timing": `provider;dur=${durationMs}`,
        ...(result.requestId
          ? { "X-Provider-Request-Id": result.requestId }
          : {}),
      },
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      return NextResponse.json(
        {
          error: {
            code: providerTimedOut ? "generation_timeout" : "request_cancelled",
            message: providerTimedOut
              ? "이미지 공급자 응답 시간이 초과되었습니다."
              : "이미지 생성 요청이 취소되었습니다.",
            retryable: true,
          },
        },
        {
          status: providerTimedOut ? 504 : 499,
          headers: responseHeaders,
        },
      );
    }
    const normalized =
      error instanceof ProviderRequestError
        ? error
        : error instanceof TypeError
          ? new ProviderRequestError(
              502,
              "provider_network_error",
              "이미지 공급자와 통신하지 못했습니다.",
              true,
            )
          : new ProviderRequestError(
              500,
              "internal_error",
              "이미지 생성 중 내부 오류가 발생했습니다.",
              true,
            );
    return NextResponse.json(errorPayload(normalized), {
      status: normalized.status,
      headers: responseHeaders,
    });
  } finally {
    if (providerTimeout) clearTimeout(providerTimeout);
    detachRequestAbort?.();
  }
}
