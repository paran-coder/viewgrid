import { act, fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { StudioScreen } from "@/components/studio-screen";
import { getPreset } from "@/lib/presets";
import { useStudioStore } from "@/store/use-studio-store";

beforeEach(() => {
  vi.useFakeTimers();
  const cameras = getPreset("product").cameras.map((camera) => ({ ...camera }));
  useStudioStore.setState({
    image: null,
    cameras,
    selectedCameraId: 5,
    selectedPresetId: "product",
    view: "editor",
    generation: cameras.map((camera) => ({
      cameraId: camera.id,
      status: "idle",
      revision: 0,
    })),
    generationProgress: 0,
    isGenerating: false,
    cameraGuide: { enabled: true, previewVisible: true },
    consistency: { referenceEnabled: true, normalizationEnabled: true },
    generationRun: {
      mode: "idle",
      total: 0,
      processed: 0,
      completed: 0,
      failed: 0,
      cancelled: 0,
      currentCameraId: null,
      currentReferenceCameraId: null,
      startedAt: null,
      endedAt: null,
    },
  });
});

describe("StudioScreen workflow", () => {
  it("moves from demo upload through camera editing to virtual results", () => {
    render(<StudioScreen />);

    fireEvent.click(screen.getByRole("button", { name: "데모 이미지로 시작" }));
    expect(
      screen.getByRole("heading", { name: "멀티앵글 카메라 스튜디오" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "로컬 카메라 가이드" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("switch", { name: /API에 사용/ })).toHaveAttribute(
      "aria-checked",
      "true",
    );
    expect(
      screen.getByRole("heading", { name: "멀티뷰 일관성" }),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /C1 카메라 선택/ }));
    fireEvent.change(screen.getByLabelText("좌우 각도 숫자 입력"), {
      target: { value: "42" },
    });
    expect(useStudioStore.getState().cameras[0].yaw).toBe(42);
    expect(screen.getAllByText("주의", { exact: true }).length).toBeGreaterThan(
      0,
    );

    fireEvent.click(screen.getByRole("button", { name: /안전한 9뷰/ }));
    expect(useStudioStore.getState().cameras[0].yaw).toBe(-15);

    fireEvent.click(screen.getByRole("button", { name: /가상 미리보기/ }));
    expect(
      screen.getByRole("heading", { name: "멀티앵글 생성 결과" }),
    ).toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(3_000);
    });

    expect(screen.getByAltText("C9 가상 결과")).toBeInTheDocument();
    expect(useStudioStore.getState().generationProgress).toBe(100);
    expect(useStudioStore.getState().isGenerating).toBe(false);
  });
});
