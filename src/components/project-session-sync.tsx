"use client";

import { useEffect, useRef } from "react";

import {
  createPresetDocument,
  parsePresetDocument,
} from "@/lib/project-preset";
import { useStudioStore } from "@/store/use-studio-store";

const SESSION_KEY = "viewgrid-project-settings-v1";

export function ProjectSessionSync() {
  const cameras = useStudioStore((state) => state.cameras);
  const cameraGuide = useStudioStore((state) => state.cameraGuide);
  const consistency = useStudioStore((state) => state.consistency);
  const applyImportedPreset = useStudioStore(
    (state) => state.applyImportedPreset,
  );
  const restored = useRef(false);

  useEffect(() => {
    try {
      const saved = window.sessionStorage.getItem(SESSION_KEY);
      if (saved) {
        const preset = parsePresetDocument(saved);
        applyImportedPreset({
          cameras: preset.cameras,
          guideEnabled: preset.cameraGuide.enabled,
          consistency: preset.consistency,
        });
      }
    } catch {
      window.sessionStorage.removeItem(SESSION_KEY);
    } finally {
      restored.current = true;
    }
  }, [applyImportedPreset]);

  useEffect(() => {
    if (!restored.current) return;
    const preset = createPresetDocument({
      name: "ViewGrid session preset",
      cameras,
      cameraGuide,
      consistency,
    });
    window.sessionStorage.setItem(SESSION_KEY, JSON.stringify(preset));
  }, [cameraGuide, cameras, consistency]);

  return null;
}
