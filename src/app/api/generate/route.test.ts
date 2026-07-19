// @vitest-environment node

import { afterEach, describe, expect, it, vi } from "vitest";

import { POST } from "@/app/api/generate/route";

const onePixelPng =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wl2nWQAAAAASUVORK5CYII=";

afterEach(() => {
  vi.restoreAllMocks();
});

function makeRequest(overrides?: {
  provider?: string;
  model?: string;
  key?: string;
  includeGuide?: boolean;
  includeReference?: boolean;
}) {
  const form = new FormData();
  form.append("provider", overrides?.provider ?? "openai");
  form.append("model", overrides?.model ?? "gpt-image-2");
  form.append(
    "prompt",
    "A sufficiently long camera prompt that preserves all product details and changes the viewpoint.",
  );
  form.append(
    "image",
    new File([new Uint8Array([1, 2, 3])], "source.jpg", { type: "image/jpeg" }),
  );
  if (overrides?.includeGuide) {
    form.append(
      "guide",
      new File([new Uint8Array([4, 5, 6])], "guide.jpg", {
        type: "image/jpeg",
      }),
    );
  }
  if (overrides?.includeReference) {
    form.append(
      "reference",
      new File([new Uint8Array([7, 8, 9])], "reference.webp", {
        type: "image/webp",
      }),
    );
  }
  return new Request("http://localhost/api/generate", {
    method: "POST",
    headers: { "x-viewgrid-api-key": overrides?.key ?? "sk-test-key-123456" },
    body: form,
  });
}

describe("POST /api/generate", () => {
  it("rejects a provider/model mismatch before forwarding", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    const response = await POST(
      makeRequest({ model: "gemini-3.1-flash-image" }),
    );
    expect(response.status).toBe(400);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("forwards an OpenAI edit request and returns binary image data", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ data: [{ b64_json: onePixelPng }] }), {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          "x-request-id": "req_test",
        },
      }),
    );

    const response = await POST(
      makeRequest({ includeGuide: true, includeReference: true }),
    );
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toContain("no-store");
    expect(response.headers.get("content-type")).toBe("image/webp");
    expect(response.headers.get("x-viewgrid-guide-used")).toBe("true");
    expect(response.headers.get("x-viewgrid-reference-used")).toBe("true");
    expect(response.headers.get("x-viewgrid-request-id")).toBeTruthy();
    expect(response.headers.get("server-timing")).toContain("provider");
    expect((await response.arrayBuffer()).byteLength).toBeGreaterThan(10);
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const [, init] = fetchSpy.mock.calls[0];
    expect(init?.headers).toEqual({
      Authorization: "Bearer sk-test-key-123456",
    });
    const forwarded = init?.body as FormData;
    expect(forwarded.get("model")).toBe("gpt-image-2");
    expect(forwarded.get("output_format")).toBe("webp");
    expect(forwarded.get("output_compression")).toBe("85");
    expect(forwarded.getAll("image[]")).toHaveLength(3);
  });

  it("does not reflect the API key in normalized errors", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ error: { message: "bad key" } }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      }),
    );
    const response = await POST(makeRequest({ key: "sk-super-secret-value" }));
    const text = await response.text();
    expect(response.status).toBe(401);
    expect(text).not.toContain("sk-super-secret-value");
    expect(text).toContain("API 키가 유효하지 않거나");
  });
  it("rejects a preprocessed image above the route limit", async () => {
    const form = new FormData();
    form.append("provider", "openai");
    form.append("model", "gpt-image-2");
    form.append(
      "prompt",
      "A sufficiently long camera prompt that preserves all product details and changes the viewpoint.",
    );
    form.append(
      "image",
      new File([new Uint8Array(2_300_001)], "oversized.jpg", {
        type: "image/jpeg",
      }),
    );
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    const response = await POST(
      new Request("http://localhost/api/generate", {
        method: "POST",
        headers: { "x-viewgrid-api-key": "sk-test-key-123456" },
        body: form,
      }),
    );
    expect(response.status).toBe(413);
    expect(await response.text()).toContain("1.8MB");
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("rejects an oversized camera guide before forwarding", async () => {
    const form = new FormData();
    form.append("provider", "openai");
    form.append("model", "gpt-image-2");
    form.append(
      "prompt",
      "A sufficiently long camera prompt that preserves all product details and changes the viewpoint.",
    );
    form.append(
      "image",
      new File([new Uint8Array([1, 2, 3])], "source.jpg", {
        type: "image/jpeg",
      }),
    );
    form.append(
      "guide",
      new File([new Uint8Array(1_050_001)], "guide.jpg", {
        type: "image/jpeg",
      }),
    );
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    const response = await POST(
      new Request("http://localhost/api/generate", {
        method: "POST",
        headers: { "x-viewgrid-api-key": "sk-test-key-123456" },
        body: form,
      }),
    );
    expect(response.status).toBe(413);
    expect(await response.text()).toContain("1.05MB");
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("rejects an oversized neighboring reference before forwarding", async () => {
    const form = new FormData();
    form.append("provider", "openai");
    form.append("model", "gpt-image-2");
    form.append(
      "prompt",
      "A sufficiently long camera prompt that preserves all product details and changes the viewpoint.",
    );
    form.append(
      "image",
      new File([new Uint8Array([1, 2, 3])], "source.jpg", {
        type: "image/jpeg",
      }),
    );
    form.append(
      "reference",
      new File([new Uint8Array(900_001)], "reference.webp", {
        type: "image/webp",
      }),
    );
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    const response = await POST(
      new Request("http://localhost/api/generate", {
        method: "POST",
        headers: { "x-viewgrid-api-key": "sk-test-key-123456" },
        body: form,
      }),
    );
    expect(response.status).toBe(413);
    expect(await response.text()).toContain("900KB");
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("rejects the wrong content type before reading a body", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    const response = await POST(
      new Request("http://localhost/api/generate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-viewgrid-api-key": "sk-test-key-123456",
        },
        body: "{}",
      }),
    );
    expect(response.status).toBe(415);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("normalizes a provider network interruption", async () => {
    vi.spyOn(globalThis, "fetch").mockRejectedValue(
      new TypeError("private network detail"),
    );
    const response = await POST(makeRequest());
    const text = await response.text();
    expect(response.status).toBe(502);
    expect(text).toContain("공급자와 통신하지 못했습니다");
    expect(text).not.toContain("private network detail");
  });

  it("aborts a provider request before the Vercel function deadline", async () => {
    vi.useFakeTimers();
    vi.spyOn(globalThis, "fetch").mockImplementation(
      (_url, init) =>
        new Promise((_resolve, reject) => {
          init?.signal?.addEventListener(
            "abort",
            () => reject(new DOMException("aborted", "AbortError")),
            { once: true },
          );
        }),
    );

    try {
      const pending = POST(makeRequest());
      await vi.advanceTimersByTimeAsync(240_000);
      const response = await pending;
      expect(response.status).toBe(504);
      expect(await response.text()).toContain("응답 시간이 초과");
    } finally {
      vi.useRealTimers();
    }
  });
});
