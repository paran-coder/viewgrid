import { Aperture } from "lucide-react";

export function BrandMark() {
  return (
    <div className="flex items-center gap-2.5" aria-label="ViewGrid 홈">
      <span className="bg-signal text-ink grid size-9 place-items-center rounded-[10px] shadow-[0_0_0_1px_rgba(245,196,81,.25)]">
        <Aperture aria-hidden="true" className="size-5" strokeWidth={2.2} />
      </span>
      <div className="leading-none">
        <div className="text-strong text-[17px] font-bold tracking-[-0.03em]">
          ViewGrid
        </div>
        <div className="text-muted mt-1 text-[10px] font-semibold tracking-[0.16em] uppercase">
          Camera Studio
        </div>
      </div>
    </div>
  );
}
