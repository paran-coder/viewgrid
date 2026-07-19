import { AlertTriangle, CheckCircle2, FlaskConical } from "lucide-react";

import { cn } from "@/lib/utils";
import type { QualitySummary } from "@/lib/quality";

const iconMap = {
  stable: CheckCircle2,
  caution: AlertTriangle,
  experimental: FlaskConical,
};

export function QualityBadge({
  quality,
  compact = false,
}: {
  quality: QualitySummary;
  compact?: boolean;
}) {
  const Icon = iconMap[quality.level];

  return (
    <div
      className={cn("quality-badge", `quality-${quality.level}`)}
      title={quality.description}
    >
      <Icon className="size-3.5" aria-hidden="true" />
      <span>{quality.label}</span>
      {!compact ? (
        <span className="hidden font-normal opacity-80 xl:inline">
          · {quality.description}
        </span>
      ) : null}
    </div>
  );
}
