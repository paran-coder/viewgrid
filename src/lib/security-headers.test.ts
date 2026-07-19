import { describe, expect, it } from "vitest";

import {
  buildContentSecurityPolicy,
  buildSecurityHeaders,
} from "@/lib/security-headers";

describe("security headers", () => {
  it("uses a restrictive production CSP", () => {
    const csp = buildContentSecurityPolicy(false);
    expect(csp).toContain("default-src 'self'");
    expect(csp).toContain("object-src 'none'");
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).toContain("img-src 'self' blob: data:");
    expect(csp).not.toContain("'unsafe-eval'");
  });

  it("adds HSTS only outside development", () => {
    const production = new Map(
      buildSecurityHeaders(false).map((entry) => [entry.key, entry.value]),
    );
    const development = new Map(
      buildSecurityHeaders(true).map((entry) => [entry.key, entry.value]),
    );

    expect(production.get("Strict-Transport-Security")).toContain(
      "includeSubDomains",
    );
    expect(development.has("Strict-Transport-Security")).toBe(false);
    expect(development.get("Content-Security-Policy")).toContain(
      "'unsafe-eval'",
    );
  });
});
