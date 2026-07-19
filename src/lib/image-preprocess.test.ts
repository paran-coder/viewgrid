import { afterEach, describe, expect, it, vi } from "vitest";

import {
  formatBytes,
  prepareReferenceImage,
  prepareSourceImage,
} from "@/lib/image-preprocess";

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

class SuccessfulWorker {
  static instances: SuccessfulWorker[] = [];
  listeners = new Map<string, (event: MessageEvent) => void>();
  terminated = false;

  constructor() {
    SuccessfulWorker.instances.push(this);
  }

  addEventListener(type: string, listener: EventListenerOrEventListenerObject) {
    this.listeners.set(type, listener as (event: MessageEvent) => void);
  }

  postMessage(message: { id: string; mode: "source" | "reference" }) {
    queueMicrotask(() => {
      const type = message.mode === "source" ? "image/jpeg" : "image/webp";
      this.listeners.get("message")?.({
        data: {
          id: message.id,
          ok: true,
          blob: new Blob([new Uint8Array([1, 2, 3])], { type }),
          width: 800,
          height: 600,
          byteSize: 3,
        },
      } as MessageEvent);
    });
  }

  terminate() {
    this.terminated = true;
  }
}

describe("image preprocess worker", () => {
  it("prepares source and reference files off the main thread", async () => {
    vi.stubGlobal("Worker", SuccessfulWorker as unknown as typeof Worker);
    vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      blob: async () =>
        new Blob([new Uint8Array([9, 8, 7])], { type: "image/png" }),
    } as Response);

    const source = await prepareSourceImage("blob:source", "product.png");
    const reference = await prepareReferenceImage(
      "blob:reference",
      "C5-reference.png",
    );

    expect(source.file.name).toBe("product.jpg");
    expect(source.file.type).toBe("image/jpeg");
    expect(source.workerUsed).toBe(true);
    expect(reference.file.name).toBe("C5-reference.webp");
    expect(reference.file.type).toBe("image/webp");
    expect(reference.workerUsed).toBe(true);
    expect(
      SuccessfulWorker.instances.every((worker) => worker.terminated),
    ).toBe(true);
  });

  it("formats operational byte sizes", () => {
    expect(formatBytes(512)).toBe("512 B");
    expect(formatBytes(2048)).toBe("2 KB");
    expect(formatBytes(2 * 1024 * 1024)).toBe("2.00 MB");
  });
});
