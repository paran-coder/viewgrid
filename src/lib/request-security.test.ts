import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  consumeRateLimit,
  getClientIdentifier,
  resetRateLimitStore,
  validateBrowserRequest,
  validateContentType,
} from "@/lib/request-security";

beforeEach(() => {
  resetRateLimitStore();
  vi.unstubAllEnvs();
});

describe("request security", () => {
  it("limits repeated requests inside one window", () => {
    expect(consumeRateLimit("client", 2, 60_000, 1_000).allowed).toBe(true);
    expect(consumeRateLimit("client", 2, 60_000, 1_001).allowed).toBe(true);
    const blocked = consumeRateLimit("client", 2, 60_000, 1_002);
    expect(blocked.allowed).toBe(false);
    expect(blocked.remaining).toBe(0);
    expect(blocked.retryAfterSeconds).toBeGreaterThan(0);
  });

  it("resets the counter after the window", () => {
    consumeRateLimit("client", 1, 100, 1_000);
    expect(consumeRateLimit("client", 1, 100, 1_050).allowed).toBe(false);
    expect(consumeRateLimit("client", 1, 100, 1_101).allowed).toBe(true);
  });

  it("rejects cross-site browser requests and mismatched origins", () => {
    const crossSite = new Request("https://viewgrid.example/api/generate", {
      headers: { "sec-fetch-site": "cross-site" },
    });
    expect(validateBrowserRequest(crossSite)?.code).toBe(
      "cross_site_request_blocked",
    );

    const mismatch = new Request("https://viewgrid.example/api/generate", {
      headers: { origin: "https://malicious.example" },
    });
    expect(validateBrowserRequest(mismatch)?.code).toBe("origin_mismatch");
  });

  it("accepts a matching forwarded origin and validates content type", () => {
    const request = new Request("http://internal/api/connection", {
      headers: {
        origin: "https://viewgrid.example",
        "x-forwarded-host": "viewgrid.example",
        "x-forwarded-proto": "https",
        "content-type": "application/json; charset=utf-8",
      },
    });
    expect(validateBrowserRequest(request)).toBeNull();
    expect(validateContentType(request, "application/json")).toBeNull();
    expect(validateContentType(request, "multipart/form-data")?.status).toBe(
      415,
    );
  });

  it("uses the first forwarded IP without storing raw request data", () => {
    const request = new Request("https://viewgrid.example", {
      headers: { "x-forwarded-for": "203.0.113.8, 10.0.0.1" },
    });
    expect(getClientIdentifier(request)).toBe("203.0.113.8");
  });
});
