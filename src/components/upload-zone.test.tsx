import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it } from "vitest";

import { UploadZone } from "@/components/upload-zone";
import { getPreset } from "@/lib/presets";
import { useStudioStore } from "@/store/use-studio-store";

beforeEach(() => {
  useStudioStore.setState({
    image: null,
    cameras: getPreset("product").cameras.map((camera) => ({ ...camera })),
    selectedCameraId: 5,
    selectedPresetId: "product",
    view: "editor",
    generationProgress: 0,
    isGenerating: false,
  });
});

describe("UploadZone", () => {
  it("starts the studio with the bundled demo image", async () => {
    const user = userEvent.setup();
    render(<UploadZone />);

    await user.click(
      screen.getByRole("button", { name: "데모 이미지로 시작" }),
    );

    expect(useStudioStore.getState().image?.url).toBe("/sample-product.svg");
  });

  it("reports unsupported file types", () => {
    render(<UploadZone />);

    const input = document.querySelector(
      'input[type="file"]',
    ) as HTMLInputElement;
    fireEvent.change(input, {
      target: {
        files: [new File(["text"], "notes.txt", { type: "text/plain" })],
      },
    });

    expect(screen.getByRole("alert")).toHaveTextContent(
      "PNG, JPEG 또는 WebP 이미지만 사용할 수 있습니다.",
    );
  });
});
