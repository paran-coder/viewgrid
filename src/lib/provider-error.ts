import type { ProviderErrorPayload } from "@/types/generation";

export class ProviderRequestError extends Error {
  status: number;
  code: string;
  retryable: boolean;

  constructor(
    status: number,
    code: string,
    message: string,
    retryable = false,
  ) {
    super(message);
    this.name = "ProviderRequestError";
    this.status = status;
    this.code = code;
    this.retryable = retryable;
  }
}

export function normalizeProviderError(
  status: number,
  provider: "openai" | "gemini",
  body: unknown,
) {
  const record =
    body && typeof body === "object" ? (body as Record<string, unknown>) : {};
  const nested =
    record.error && typeof record.error === "object"
      ? (record.error as Record<string, unknown>)
      : {};
  const rawMessage =
    (typeof nested.message === "string" && nested.message) ||
    (typeof record.message === "string" && record.message) ||
    "이미지 생성 요청을 처리하지 못했습니다.";

  if (status === 401 || status === 403) {
    return new ProviderRequestError(
      status,
      "invalid_api_key",
      `${provider === "openai" ? "OpenAI" : "Gemini"} API 키가 유효하지 않거나 해당 모델을 사용할 권한이 없습니다.`,
      false,
    );
  }
  if (status === 429) {
    return new ProviderRequestError(
      status,
      "rate_limit",
      "공급자 사용량 또는 속도 제한에 도달했습니다. 잠시 후 다시 시도해 주세요.",
      true,
    );
  }
  if (status >= 500) {
    return new ProviderRequestError(
      502,
      "provider_unavailable",
      "이미지 공급자 서비스가 일시적으로 응답하지 않습니다.",
      true,
    );
  }

  return new ProviderRequestError(
    status >= 400 && status < 500 ? status : 502,
    "provider_error",
    rawMessage.slice(0, 320),
    status >= 500,
  );
}

export function errorPayload(
  error: ProviderRequestError,
): ProviderErrorPayload {
  return {
    error: {
      code: error.code,
      message: error.message,
      retryable: error.retryable,
    },
  };
}
