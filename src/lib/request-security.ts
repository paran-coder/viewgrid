type RateLimitBucket = {
  count: number;
  resetAt: number;
};

type GlobalRateLimitStore = typeof globalThis & {
  __viewgridRateLimitStore?: Map<string, RateLimitBucket>;
};

export type RateLimitResult = {
  allowed: boolean;
  limit: number;
  remaining: number;
  resetAt: number;
  retryAfterSeconds: number;
};

export type RequestGuardError = {
  status: number;
  code: string;
  message: string;
};

function getStore() {
  const globalStore = globalThis as GlobalRateLimitStore;
  globalStore.__viewgridRateLimitStore ??= new Map();
  return globalStore.__viewgridRateLimitStore;
}

export function resetRateLimitStore() {
  getStore().clear();
}

export function consumeRateLimit(
  key: string,
  limit: number,
  windowMs: number,
  now = Date.now(),
): RateLimitResult {
  const store = getStore();
  const previous = store.get(key);
  const bucket =
    !previous || previous.resetAt <= now
      ? { count: 0, resetAt: now + windowMs }
      : previous;

  bucket.count += 1;
  store.set(key, bucket);

  if (store.size > 5_000) {
    for (const [storedKey, value] of store) {
      if (value.resetAt <= now) store.delete(storedKey);
    }
  }

  const allowed = bucket.count <= limit;
  return {
    allowed,
    limit,
    remaining: Math.max(0, limit - bucket.count),
    resetAt: bucket.resetAt,
    retryAfterSeconds: Math.max(1, Math.ceil((bucket.resetAt - now) / 1000)),
  };
}

export function shouldEnforceLocalRateLimit() {
  if (process.env.VIEWGRID_RATE_LIMIT_ENABLED === "false") return false;
  if (process.env.VIEWGRID_RATE_LIMIT_ENABLED === "true") return true;
  return process.env.VERCEL_ENV === "production";
}

export function getClientIdentifier(request: Request) {
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0];
  return (
    forwarded?.trim() ||
    request.headers.get("x-real-ip")?.trim() ||
    request.headers.get("cf-connecting-ip")?.trim() ||
    "unknown-client"
  );
}

export function validateBrowserRequest(
  request: Request,
): RequestGuardError | null {
  const fetchSite = request.headers.get("sec-fetch-site");
  if (fetchSite === "cross-site") {
    return {
      status: 403,
      code: "cross_site_request_blocked",
      message: "다른 사이트에서 시작한 요청은 허용하지 않습니다.",
    };
  }

  const origin = request.headers.get("origin");
  if (!origin) return null;

  try {
    const requestUrl = new URL(request.url);
    const forwardedHost = request.headers.get("x-forwarded-host");
    const forwardedProto = request.headers.get("x-forwarded-proto") ?? "https";
    const expectedOrigins = new Set([requestUrl.origin]);
    if (forwardedHost) {
      expectedOrigins.add(`${forwardedProto}://${forwardedHost}`);
    }
    if (!expectedOrigins.has(new URL(origin).origin)) {
      return {
        status: 403,
        code: "origin_mismatch",
        message: "요청 출처를 확인할 수 없습니다.",
      };
    }
  } catch {
    return {
      status: 403,
      code: "invalid_origin",
      message: "요청 출처가 올바르지 않습니다.",
    };
  }

  return null;
}

export function validateContentType(
  request: Request,
  expectedPrefix: string,
): RequestGuardError | null {
  const contentType = request.headers.get("content-type")?.toLowerCase() ?? "";
  if (!contentType.startsWith(expectedPrefix.toLowerCase())) {
    return {
      status: 415,
      code: "unsupported_content_type",
      message: "요청 형식이 올바르지 않습니다.",
    };
  }
  return null;
}

export function createRequestId() {
  return crypto.randomUUID();
}

export function noStoreApiHeaders(
  requestId: string,
  extra?: HeadersInit,
): Record<string, string> {
  return {
    "Cache-Control": "no-store, no-cache, max-age=0, must-revalidate",
    Pragma: "no-cache",
    "X-Content-Type-Options": "nosniff",
    "X-ViewGrid-Request-Id": requestId,
    ...Object.fromEntries(new Headers(extra).entries()),
  };
}

export function rateLimitHeaders(result: RateLimitResult) {
  return {
    "RateLimit-Limit": String(result.limit),
    "RateLimit-Remaining": String(result.remaining),
    "RateLimit-Reset": String(Math.ceil(result.resetAt / 1000)),
    ...(result.allowed
      ? {}
      : { "Retry-After": String(result.retryAfterSeconds) }),
  };
}
