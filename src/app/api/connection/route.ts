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
import { checkGeminiConnection } from "@/lib/providers/gemini";
import {
  isAllowedModel,
  isGeminiModel,
  isOpenAIModel,
  isProvider,
} from "@/lib/providers/models";
import { checkOpenAIConnection } from "@/lib/providers/openai";

export const runtime = "nodejs";
export const maxDuration = 30;

const MAX_CONNECTION_BODY_BYTES = 12_000;
const RATE_LIMIT = 20;
const RATE_WINDOW_MS = 60_000;

export async function POST(request: Request) {
  const requestId = createRequestId();
  let responseHeaders = noStoreApiHeaders(requestId);

  const sourceError = validateBrowserRequest(request);
  if (sourceError) {
    return NextResponse.json(
      {
        error: {
          code: sourceError.code,
          message: sourceError.message,
          retryable: false,
        },
      },
      { status: sourceError.status, headers: responseHeaders },
    );
  }

  const contentTypeError = validateContentType(request, "application/json");
  if (contentTypeError) {
    return NextResponse.json(
      {
        error: {
          code: contentTypeError.code,
          message: contentTypeError.message,
          retryable: false,
        },
      },
      { status: contentTypeError.status, headers: responseHeaders },
    );
  }

  const contentLength = Number(request.headers.get("content-length") ?? 0);
  if (contentLength > MAX_CONNECTION_BODY_BYTES) {
    return NextResponse.json(
      {
        error: {
          code: "payload_too_large",
          message: "연결 확인 요청이 허용 크기를 초과했습니다.",
          retryable: false,
        },
      },
      { status: 413, headers: responseHeaders },
    );
  }

  if (shouldEnforceLocalRateLimit()) {
    const limit = consumeRateLimit(
      `connection:${getClientIdentifier(request)}`,
      RATE_LIMIT,
      RATE_WINDOW_MS,
    );
    responseHeaders = noStoreApiHeaders(requestId, rateLimitHeaders(limit));
    if (!limit.allowed) {
      return NextResponse.json(
        {
          error: {
            code: "rate_limit_exceeded",
            message:
              "연결 확인 요청이 너무 많습니다. 잠시 후 다시 시도해 주세요.",
            retryable: true,
          },
        },
        { status: 429, headers: responseHeaders },
      );
    }
  }

  const apiKey = request.headers.get("x-viewgrid-api-key")?.trim();
  if (!apiKey || apiKey.length < 8 || apiKey.length > 512) {
    return NextResponse.json(
      {
        error: {
          code: "missing_api_key",
          message: "API 키를 입력해 주세요.",
          retryable: false,
        },
      },
      { status: 400, headers: responseHeaders },
    );
  }

  try {
    const body = (await request.json().catch(() => null)) as {
      provider?: string;
      model?: string;
    } | null;
    if (!body) {
      throw new ProviderRequestError(
        400,
        "invalid_json",
        "요청 본문이 올바른 JSON이 아닙니다.",
      );
    }
    if (!body.provider || !isProvider(body.provider)) {
      throw new ProviderRequestError(
        400,
        "invalid_provider",
        "지원하지 않는 공급자입니다.",
      );
    }
    if (!body.model || !isAllowedModel(body.provider, body.model)) {
      throw new ProviderRequestError(
        400,
        "invalid_model",
        "지원하지 않는 모델입니다.",
      );
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15_000);
    try {
      if (body.provider === "openai" && isOpenAIModel(body.model)) {
        await checkOpenAIConnection(apiKey, body.model, controller.signal);
      } else if (body.provider === "gemini" && isGeminiModel(body.model)) {
        await checkGeminiConnection(apiKey, body.model, controller.signal);
      }
    } finally {
      clearTimeout(timeout);
    }

    return NextResponse.json(
      { ok: true, message: "API 키와 모델 연결을 확인했습니다." },
      { headers: responseHeaders },
    );
  } catch (error) {
    const normalized =
      error instanceof ProviderRequestError
        ? error
        : error instanceof DOMException && error.name === "AbortError"
          ? new ProviderRequestError(
              504,
              "connection_timeout",
              "공급자 연결 확인 시간이 초과되었습니다.",
              true,
            )
          : new ProviderRequestError(
              500,
              "connection_error",
              "공급자 연결을 확인하지 못했습니다.",
              true,
            );
    return NextResponse.json(errorPayload(normalized), {
      status: normalized.status,
      headers: responseHeaders,
    });
  }
}
