"use client";

import { Link2, Palette, Route } from "lucide-react";

import { PREFERRED_GENERATION_ORDER } from "@/lib/multiview-consistency";
import { useStudioStore } from "@/store/use-studio-store";

function ToggleRow({
  checked,
  onChange,
  icon,
  title,
  description,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  icon: React.ReactNode;
  title: string;
  description: string;
}) {
  return (
    <label className="border-hairline bg-canvas-subtle flex cursor-pointer items-start gap-3 rounded-[10px] border p-3">
      <span className="text-signal mt-0.5" aria-hidden="true">
        {icon}
      </span>
      <span className="min-w-0 flex-1">
        <span className="text-strong block text-sm font-semibold">{title}</span>
        <span className="text-muted mt-1 block text-xs leading-5">
          {description}
        </span>
      </span>
      <input
        type="checkbox"
        className="toggle-input mt-0.5"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
      />
    </label>
  );
}

export function ConsistencyPanel() {
  const consistency = useStudioStore((state) => state.consistency);
  const setReferenceEnabled = useStudioStore(
    (state) => state.setReferenceEnabled,
  );
  const setNormalizationEnabled = useStudioStore(
    (state) => state.setNormalizationEnabled,
  );

  return (
    <section className="panel p-3 sm:p-4" aria-labelledby="consistency-heading">
      <div className="mb-3 flex flex-col gap-2 px-1 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <Route className="text-signal size-4" aria-hidden="true" />
          <h2
            id="consistency-heading"
            className="text-strong text-sm font-semibold"
          >
            멀티뷰 일관성
          </h2>
        </div>
        <span className="text-muted font-mono text-[11px] tabular-nums">
          생성 순서{" "}
          {PREFERRED_GENERATION_ORDER.map((id) => `C${id}`).join(" → ")}
        </span>
      </div>
      <div className="grid gap-2 md:grid-cols-2">
        <ToggleRow
          checked={consistency.referenceEnabled}
          onChange={setReferenceEnabled}
          icon={<Link2 className="size-4" />}
          title="인접 결과 참조"
          description="중앙 기준 뷰를 먼저 만들고, 이후 카메라가 같은 열 또는 중앙의 완성 결과를 구조·재질 기준으로 사용합니다."
        />
        <ToggleRow
          checked={consistency.normalizationEnabled}
          onChange={setNormalizationEnabled}
          icon={<Palette className="size-4" />}
          title="크기·색상 정규화"
          description="생성 결과를 1,024×1,024로 맞추고, 원본 또는 기준 결과에 가깝도록 제한된 색상 게인을 적용합니다."
        />
      </div>
      <p className="text-muted mt-3 px-1 text-xs leading-5">
        두 옵션을 바꾸면 기존 결과는 현재 생성 조건과 다른 결과로 판정되어
        `STALE`로 표시됩니다. 큰 각도에서는 참조 이미지를 사용해도 로고와 문자가
        변형될 수 있으므로 확대 검토가 필요합니다.
      </p>
    </section>
  );
}
