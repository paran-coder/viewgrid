import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ApiSettingsDialog } from "@/components/api-settings-dialog";
import { useStudioStore } from "@/store/use-studio-store";

beforeEach(() => {
  useStudioStore.setState({
    settingsOpen: true,
    apiSettings: {
      provider: "gemini",
      model: "gemini-3.1-flash-image",
      apiKey: "",
      keepForTab: true,
      connectionStatus: "idle",
      connectionMessage: null,
    },
  });
});

describe("ApiSettingsDialog", () => {
  it("changes provider and keeps the key only in Zustand memory", () => {
    render(<ApiSettingsDialog />);

    fireEvent.click(screen.getByRole("radio", { name: /OpenAI/ }));
    expect(useStudioStore.getState().apiSettings.model).toBe("gpt-image-2");

    fireEvent.change(screen.getByPlaceholderText("sk-..."), {
      target: { value: "sk-test-secret" },
    });
    expect(useStudioStore.getState().apiSettings.apiKey).toBe("sk-test-secret");
    expect(window.localStorage.getItem("apiKey")).toBeNull();
  });

  it("shows a local validation error without making a request", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    render(<ApiSettingsDialog />);
    fireEvent.click(screen.getByRole("button", { name: "연결 확인" }));
    expect(
      await screen.findByText("API 키를 입력해 주세요."),
    ).toBeInTheDocument();
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
