// @vitest-environment node

import { describe, expect, it } from "vitest";

import { GET } from "@/app/api/health/route";

describe("GET /api/health", () => {
  it("returns a cache-free operational summary without secrets", async () => {
    const response = GET();
    const text = await response.text();
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toContain("no-store");
    expect(response.headers.get("x-viewgrid-request-id")).toBeTruthy();
    expect(text).toContain("viewgrid");
    expect(text).toContain("gpt-image-2");
    expect(text).not.toContain("apiKey");
  });
});
