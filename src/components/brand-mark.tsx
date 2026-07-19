import Link from "next/link";
import { Aperture } from "lucide-react";

export function BrandMark() {
  return (
    <Link
      href="/"
      aria-label="ViewGrid 메인으로 이동"
      className="focus-visible:ring-info-ring flex items-center gap-2.5 rounded-[10px] outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--canvas-dark)]"
    >
      <span className="bg-signal text-ink grid size-9 place-items-center rounded-[10px] shadow-[0_0_0_1px_rgba(245,196,81,.25)]">
        <Aperture aria-hidden="true" className="size-5" strokeWidth={2.2} />
      </span>
      <span className="leading-none">
        <span className="text-strong block text-[17px] font-bold tracking-[-0.03em]">
          ViewGrid
        </span>
        <span className="text-muted mt-1 block text-[10px] font-semibold tracking-[0.16em] uppercase">
          Camera Studio
        </span>
      </span>
    </Link>
  );
}
