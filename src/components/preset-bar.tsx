"use client";

import { useRef, useState } from "react";
import {
  Download,
  FileJson,
  FlaskConical,
  Grid3X3,
  Upload,
} from "lucide-react";

import { PRESETS } from "@/lib/presets";
import {
  createPresetDocument,
  parsePresetDocument,
  presetFilename,
} from "@/lib/project-preset";
import { downloadBlob } from "@/lib/result-export";
import { cn } from "@/lib/utils";
import { useStudioStore } from "@/store/use-studio-store";

export function PresetBar() {
  const selectedPresetId = useStudioStore((state) => state.selectedPresetId);
  const applyPreset = useStudioStore((state) => state.applyPreset);
  const cameras = useStudioStore((state) => state.cameras);
  const cameraGuide = useStudioStore((state) => state.cameraGuide);
  const consistency = useStudioStore((state) => state.consistency);
  const applyImportedPreset = useStudioStore(
    (state) => state.applyImportedPreset,
  );
  const inputRef = useRef<HTMLInputElement>(null);
  const [message, setMessage] = useState<string | null>(null);

  function exportPreset() {
    const document = createPresetDocument({
      name: "ViewGrid custom preset",
      cameras,
      cameraGuide,
      consistency,
    });
    downloadBlob(
      new Blob([JSON.stringify(document, null, 2)], {
        type: "application/json",
      }),
      presetFilename(document.name),
    );
    setMessage("현재 카메라와 일관성 설정을 JSON으로 저장했습니다.");
  }

  async function importPreset(file?: File) {
    if (!file) return;
    try {
      if (file.size > 200_000) {
        throw new Error("프리셋 파일은 200KB 이하여야 합니다.");
      }
      const document = parsePresetDocument(await file.text());
      applyImportedPreset({
        cameras: document.cameras,
        guideEnabled: document.cameraGuide.enabled,
        consistency: document.consistency,
      });
      setMessage(`“${document.name}” 프리셋을 불러왔습니다.`);
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "프리셋을 불러오지 못했습니다.",
      );
    } finally {
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <section className="panel p-3 sm:p-4" aria-labelledby="preset-heading">
      <div className="mb-3 flex flex-col gap-3 px-1 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <Grid3X3 className="text-signal size-4" aria-hidden="true" />
          <h2 id="preset-heading" className="text-strong text-sm font-semibold">
            카메라 프리셋
          </h2>
          <span className="text-muted hidden text-xs md:inline">
            적용 즉시 기존 설정을 교체합니다.
          </span>
        </div>
        <div className="flex flex-wrap gap-2">
          <input
            ref={inputRef}
            type="file"
            accept="application/json,.json"
            className="sr-only"
            onChange={(event) => void importPreset(event.target.files?.[0])}
          />
          <button
            type="button"
            className="secondary-button"
            onClick={() => inputRef.current?.click()}
          >
            <Upload className="size-4" aria-hidden="true" />
            JSON 불러오기
          </button>
          <button
            type="button"
            className="secondary-button"
            onClick={exportPreset}
          >
            <Download className="size-4" aria-hidden="true" />
            JSON 저장
          </button>
        </div>
      </div>
      <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
        {PRESETS.map((preset) => {
          const active = preset.id === selectedPresetId;
          return (
            <button
              key={preset.id}
              type="button"
              onClick={() => applyPreset(preset.id)}
              className={cn("preset-card", active && "preset-card-active")}
              aria-pressed={active}
            >
              <span className="flex items-center justify-between gap-2">
                <span className="text-strong font-semibold">{preset.name}</span>
                {preset.experimental ? (
                  <FlaskConical
                    className="text-danger size-4"
                    aria-label="실험적 프리셋"
                  />
                ) : null}
              </span>
              <span className="text-muted mt-1.5 block text-left text-xs leading-5">
                {preset.description}
              </span>
            </button>
          );
        })}
      </div>
      {message ? (
        <p
          className="border-hairline bg-canvas-subtle text-muted mt-3 flex items-center gap-2 rounded-[8px] border px-3 py-2 text-xs"
          aria-live="polite"
        >
          <FileJson
            className="text-signal size-4 shrink-0"
            aria-hidden="true"
          />
          {message}
        </p>
      ) : null}
    </section>
  );
}
