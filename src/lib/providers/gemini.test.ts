// @vitest-environment node

import { afterEach, describe, expect, it, vi } from "vitest";

import { __test__, generateWithGemini } from "@/lib/providers/gemini";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("Gemini image response parsing", () => {
  it("finds the convenience output_image shape", () => {
    expect(
      __test__.findImageBlock({
        output_image: { data: "YWJj", mime_type: "image/png" },
      }),
    ).toEqual({ data: "YWJj", mimeType: "image/png" });
  });

  it("finds an image block nested in interaction steps", () => {
    expect(
      __test__.findImageBlock({
        steps: [
          {
            type: "model_output",
            content: [
              { type: "text", text: "done" },
              { type: "image", data: "eHl6", mime_type: "image/jpeg" },
            ],
          },
        ],
      }),
    ).toEqual({ data: "eHl6", mimeType: "image/jpeg" });
  });

  it("sends source, guide, and neighboring reference as ordered image inputs", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          output_image: { data: "YWJj", mime_type: "image/jpeg" },
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    );
    const source = new File([new Uint8Array([1, 2, 3])], "source.jpg", {
      type: "image/jpeg",
    });
    const guide = new File([new Uint8Array([4, 5, 6])], "guide.jpg", {
      type: "image/jpeg",
    });
    const reference = new File([new Uint8Array([7, 8, 9])], "reference.webp", {
      type: "image/webp",
    });

    await generateWithGemini({
      apiKey: "gemini-test-key",
      model: "gemini-3.1-flash-image",
      image: source,
      guide,
      reference,
      prompt: "Image 1 is the source and Image 2 is the camera guide.",
      signal: new AbortController().signal,
    });

    const [, init] = fetchSpy.mock.calls[0];
    const payload = JSON.parse(String(init?.body)) as {
      input: Array<{ type: string; text?: string; data?: string }>;
    };
    expect(payload.input.map((item) => item.type)).toEqual([
      "text",
      "image",
      "image",
      "image",
    ]);
    expect(payload.input[0]?.text).toContain("Image 2");
    expect(payload.input[1]?.data).toBe("AQID");
    expect(payload.input[2]?.data).toBe("BAUG");
    expect(payload.input[3]?.data).toBe("BwgJ");
  });
});
