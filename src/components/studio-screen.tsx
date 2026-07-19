"use client";

import { ApiSettingsDialog } from "@/components/api-settings-dialog";
import { AppHeader } from "@/components/app-header";
import { CameraCanvas } from "@/components/camera-canvas";
import { CameraControls } from "@/components/camera-controls";
import { CameraGuidePanel } from "@/components/camera-guide-panel";
import { ConsistencyPanel } from "@/components/consistency-panel";
import { PresetBar } from "@/components/preset-bar";
import { ProjectSessionSync } from "@/components/project-session-sync";
import { PwaRegistration } from "@/components/pwa-registration";
import { ResultsGrid } from "@/components/results-grid";
import { StudioToolbar } from "@/components/studio-toolbar";
import { UploadZone } from "@/components/upload-zone";
import { useStudioStore } from "@/store/use-studio-store";

export function StudioScreen() {
  const image = useStudioStore((state) => state.image);
  const view = useStudioStore((state) => state.view);

  return (
    <div className="bg-canvas text-body min-h-dvh">
      <a className="skip-link" href="#main-content">
        본문으로 건너뛰기
      </a>
      <ProjectSessionSync />
      <PwaRegistration />
      <AppHeader />
      <div id="main-content" tabIndex={-1}>
        {!image ? (
          <UploadZone />
        ) : view === "results" ? (
          <ResultsGrid />
        ) : (
          <main className="mx-auto w-full max-w-[1600px] px-4 py-5 sm:px-6 sm:py-6 lg:px-8">
            <div className="mb-5">
              <h1 className="text-strong text-2xl font-bold tracking-[-0.035em] sm:text-3xl">
                멀티앵글 카메라 스튜디오
              </h1>
              <p className="text-muted mt-1.5 text-sm leading-6">
                카메라 수치를 조절하고 로컬 구도 가이드를 확인한 뒤, 원본과
                가이드를 함께 사용해 한 장 또는 전체 시점을 생성합니다.
              </p>
            </div>

            <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_380px] xl:grid-cols-[minmax(0,1fr)_410px]">
              <div className="min-w-0 space-y-4">
                <CameraCanvas />
                <CameraGuidePanel />
                <ConsistencyPanel />
                <PresetBar />
                <StudioToolbar />
              </div>
              <CameraControls />
            </div>
          </main>
        )}
      </div>
      <ApiSettingsDialog />
    </div>
  );
}
