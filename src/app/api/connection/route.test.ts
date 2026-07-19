// @vitest-environment node

import { afterEach, describe, expect, it, vi } from "vitest";

import { POST } from "@/app/api/connection/route";

afterEach(() => {
  vi.restoreAllMocks();
});

function makeRequest(body: unknown, key = "test-api-key-123456"): Request {
  return new Request("http://localhost/api/connection", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-viewgrid-api-key": key,
    },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

describe("POST /api/connection", () => {
  it("rejects malformed JSON without contacting a provider", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    const response = await POST(makeRequest("{not-json"));
    expect(response.status).toBe(400);
    expect(await response.text()).toContain("올바른 JSON");
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("checks the selected OpenAI model without exposing the key", async () => {
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(new Response("{}", { status: 200 }));
    const response = await POST(
      makeRequest({ provider: "openai", model: "gpt-image-2" }),
    );
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toContain("no-store");
    expect(response.headers.get("x-content-type-options")).toBe("nosniff");
    expect(response.headers.get("x-viewgrid-request-id")).toBeTruthy();
    expect(fetchSpy).toHaveBeenCalledWith(
      "https://api.openai.com/v1/models/gpt-image-2",
      expect.objectContaining({
        headers: { Authorization: "Bearer test-api-key-123456" },
      }),
    );
    expect(await response.text()).not.toContain("test-api-key-123456");
  });

  it("blocks cross-site browser calls before reading the API key", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    const response = await POST(
      new Request("https://viewgrid.example/api/connection", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          origin: "https://malicious.example",
          "sec-fetch-site": "cross-site",
          "x-viewgrid-api-key": "private-key-value",
        },
        body: JSON.stringify({ provider: "openai", model: "gpt-image-2" }),
      }),
    );
    expect(response.status).toBe(403);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("normalizes invalid Gemini credentials", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ error: { message: "private detail" } }), {
        status: 403,
        headers: { "Content-Type": "application/json" },
      }),
    );
    const response = await POST(
      makeRequest(
        { provider: "gemini", model: "gemini-3.1-flash-image" },
        "private-gemini-key",
      ),
    );
    const text = await response.text();
    expect(response.status).toBe(403);
    expect(text).toContain("Gemini API 키가 유효하지 않거나");
    expect(text).not.toContain("private-gemini-key");
    expect(text).not.toContain("private detail");
  });
});
