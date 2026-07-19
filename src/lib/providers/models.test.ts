import { describe, expect, it } from "vitest";

import { getModelsForProvider, isAllowedModel } from "@/lib/providers/models";

describe("provider model registry", () => {
  it("keeps provider and model combinations explicit", () => {
    expect(isAllowedModel("openai", "gpt-image-2")).toBe(true);
    expect(isAllowedModel("openai", "gemini-3.1-flash-image")).toBe(false);
    expect(getModelsForProvider("gemini")).toHaveLength(2);
  });
});
