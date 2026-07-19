"use client";

import { GitBranch, KeyRound, RotateCcw, Sparkles } from "lucide-react";

import { BrandMark } from "@/components/brand-mark";
import { PwaInstallButton } from "@/components/pwa-install-button";
import { useStudioStore } from "@/store/use-studio-store";

export function AppHeader() {
  const githubUrl = process.env.NEXT_PUBLIC_GITHUB_URL ?? "https://github.com/";
  const resetProject = useStudioStore((state) => state.resetProject);
  const openSettings = useStudioStore((state) => state.openSettings);
  const connectionStatus = useStudioStore(
    (state) => state.apiSettings.connectionStatus,
  );

  return (
    <header className="border-hairline bg-canvas/90 sticky top-0 z-40 border-b backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-[1600px] items-center justify-between px-4 sm:px-6 lg:px-8">
        <BrandMark />

        <div className="flex items-center gap-2">
          <span className="border-hairline bg-card text-muted hidden items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold md:flex">
            <Sparkles className="text-signal size-3.5" aria-hidden="true" />
            Stage 6 · Production ready
          </span>
          <button
            type="button"
            onClick={openSettings}
            className="secondary-button hidden sm:inline-flex"
          >
            <span
              className={`size-2 rounded-full ${
                connectionStatus === "connected"
                  ? "bg-stable"
                  : connectionStatus === "failed"
                    ? "bg-danger"
                    : "bg-muted"
              }`}
            />
            <KeyRound className="size-4" aria-hidden="true" />
            API 설정
          </button>
          <button
            type="button"
            onClick={openSettings}
            className="icon-button sm:hidden"
            aria-label="API 설정 열기"
            title="API 설정"
          >
            <KeyRound className="size-[18px]" aria-hidden="true" />
          </button>
          <button
            type="button"
            onClick={resetProject}
            className="icon-button"
            aria-label="새 프로젝트로 초기화"
            title="새 프로젝트"
          >
            <RotateCcw className="size-[18px]" aria-hidden="true" />
          </button>
          <PwaInstallButton />
          <a
            className="icon-button"
            href={githubUrl}
            target="_blank"
            rel="noreferrer"
            aria-label="GitHub 열기"
            title="GitHub"
          >
            <GitBranch className="size-[18px]" aria-hidden="true" />
          </a>
        </div>
      </div>
    </header>
  );
}
