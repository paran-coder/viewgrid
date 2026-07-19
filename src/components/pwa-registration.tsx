"use client";

import { useEffect, useState } from "react";
import { CloudOff } from "lucide-react";

export function PwaRegistration() {
  const [online, setOnline] = useState(() =>
    typeof navigator === "undefined" ? true : navigator.onLine,
  );

  useEffect(() => {
    const handleOnline = () => setOnline(true);
    const handleOffline = () => setOnline(false);
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    if (process.env.NODE_ENV === "production" && "serviceWorker" in navigator) {
      void navigator.serviceWorker
        .register("/sw.js", { scope: "/" })
        .catch(() => undefined);
    }

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  if (online) return null;

  return (
    <div
      className="border-caution/40 bg-canvas text-caution fixed right-4 bottom-4 z-[80] flex max-w-sm items-center gap-2 rounded-lg border px-3 py-2 text-xs font-semibold shadow-2xl"
      role="status"
      aria-live="polite"
    >
      <CloudOff className="size-4 shrink-0" aria-hidden="true" />
      오프라인입니다. 편집과 기존 결과 다운로드는 가능하지만 새 API 생성은 연결
      후 실행됩니다.
    </div>
  );
}
