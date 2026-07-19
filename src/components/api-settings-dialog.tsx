"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  CheckCircle2,
  Eye,
  EyeOff,
  KeyRound,
  LoaderCircle,
  ShieldCheck,
  X,
  XCircle,
} from "lucide-react";

import { getModelsForProvider } from "@/lib/providers/models";
import { cn } from "@/lib/utils";
import { useStudioStore } from "@/store/use-studio-store";
import type { ImageModelId, ProviderId } from "@/types/generation";

const providerOptions: Array<{
  id: ProviderId;
  title: string;
  description: string;
}> = [
  {
    id: "openai",
    title: "OpenAI",
    description: "GPT Image 2의 고충실도 이미지 편집",
  },
  {
    id: "gemini",
    title: "Google Gemini",
    description: "Nano Banana 계열의 이미지 생성·편집",
  },
];

export function ApiSettingsDialog() {
  const open = useStudioStore((state) => state.settingsOpen);
  const settings = useStudioStore((state) => state.apiSettings);
  const close = useStudioStore((state) => state.closeSettings);
  const setProvider = useStudioStore((state) => state.setProvider);
  const setModel = useStudioStore((state) => state.setModel);
  const setApiKey = useStudioStore((state) => state.setApiKey);
  const setKeepForTab = useStudioStore((state) => state.setKeepForTab);
  const testConnection = useStudioStore((state) => state.testConnection);
  const [showKey, setShowKey] = useState(false);
  const dialogRef = useRef<HTMLElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const models = useMemo(
    () => getModelsForProvider(settings.provider),
    [settings.provider],
  );

  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement as HTMLElement | null;
    const timer = window.setTimeout(() => closeButtonRef.current?.focus(), 0);
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        close();
        return;
      }
      if (event.key !== "Tab" || !dialogRef.current) return;

      const focusable = Array.from(
        dialogRef.current.querySelectorAll<HTMLElement>(
          "button:not([disabled]), input:not([disabled]), select:not([disabled]), [href]",
        ),
      ).filter((element) => element.offsetParent !== null);
      if (focusable.length === 0) return;

      const first = focusable[0];
      const last = focusable.at(-1)!;
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKeyDown);
    document.body.style.overflow = "hidden";
    return () => {
      window.clearTimeout(timer);
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = "";
      previous?.focus?.();
    };
  }, [close, open]);

  if (!open) return null;

  const statusIcon =
    settings.connectionStatus === "checking" ? (
      <LoaderCircle className="size-4 animate-spin motion-reduce:animate-none" />
    ) : settings.connectionStatus === "connected" ? (
      <CheckCircle2 className="size-4" />
    ) : settings.connectionStatus === "failed" ? (
      <XCircle className="size-4" />
    ) : (
      <ShieldCheck className="size-4" />
    );

  return (
    <div className="fixed inset-0 z-[100] grid place-items-center p-3 sm:p-6">
      <button
        type="button"
        aria-label="API 설정 닫기"
        className="absolute inset-0 bg-black/72 backdrop-blur-sm"
        onClick={close}
      />
      <section
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="api-settings-title"
        className="panel relative z-10 flex max-h-[92dvh] w-full max-w-2xl flex-col overflow-hidden"
      >
        <div className="border-hairline flex items-start justify-between gap-4 border-b px-5 py-4 sm:px-6">
          <div className="flex min-w-0 items-start gap-3">
            <span className="border-hairline bg-elevated text-signal grid size-10 shrink-0 place-items-center rounded-[10px] border">
              <KeyRound className="size-5" aria-hidden="true" />
            </span>
            <div>
              <p className="text-muted text-xs font-semibold tracking-[0.12em] uppercase">
                Bring your own key
              </p>
              <h2
                id="api-settings-title"
                className="text-strong mt-1 text-xl font-bold"
              >
                이미지 생성 모델 연결
              </h2>
              <p className="text-muted mt-1 text-sm leading-6">
                키는 현재 브라우저 탭의 메모리에만 보관되며 요청마다 Vercel
                Function을 통해 공급자에게 전달됩니다.
              </p>
            </div>
          </div>
          <button
            ref={closeButtonRef}
            type="button"
            className="icon-button shrink-0"
            onClick={close}
            aria-label="설정 닫기"
          >
            <X className="size-4" aria-hidden="true" />
          </button>
        </div>

        <div className="overflow-y-auto px-5 py-5 sm:px-6">
          <fieldset>
            <legend className="text-strong text-sm font-semibold">
              공급자
            </legend>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              {providerOptions.map((provider) => {
                const selected = settings.provider === provider.id;
                return (
                  <label
                    key={provider.id}
                    className={cn(
                      "border-hairline bg-canvas-subtle flex cursor-pointer gap-3 rounded-[10px] border p-4 transition",
                      selected && "border-signal bg-signal/[0.06]",
                    )}
                  >
                    <input
                      type="radio"
                      name="provider"
                      value={provider.id}
                      checked={selected}
                      onChange={() => setProvider(provider.id)}
                      className="mt-1 accent-[var(--signal)]"
                    />
                    <span>
                      <span className="text-strong block text-sm font-semibold">
                        {provider.title}
                      </span>
                      <span className="text-muted mt-1 block text-xs leading-5">
                        {provider.description}
                      </span>
                    </span>
                  </label>
                );
              })}
            </div>
          </fieldset>

          <label className="mt-5 block">
            <span className="text-strong text-sm font-semibold">모델</span>
            <select
              value={settings.model}
              onChange={(event) => setModel(event.target.value as ImageModelId)}
              className="text-input mt-2 w-full"
            >
              {models.map((model) => (
                <option key={model.id} value={model.id}>
                  {model.label} — {model.description}
                </option>
              ))}
            </select>
          </label>

          <label className="mt-5 block">
            <span className="text-strong text-sm font-semibold">API 키</span>
            <span className="relative mt-2 block">
              <input
                type={showKey ? "text" : "password"}
                value={settings.apiKey}
                onChange={(event) => setApiKey(event.target.value)}
                className="text-input w-full pr-12 font-mono text-xs"
                placeholder={
                  settings.provider === "openai"
                    ? "sk-..."
                    : "Google AI Studio 키"
                }
                autoComplete="off"
                spellCheck={false}
                aria-describedby="api-key-help"
              />
              <button
                type="button"
                className="text-muted hover:text-strong absolute top-1/2 right-1 grid size-9 -translate-y-1/2 place-items-center rounded-[7px]"
                onClick={() => setShowKey((value) => !value)}
                aria-label={showKey ? "API 키 숨기기" : "API 키 표시"}
              >
                {showKey ? (
                  <EyeOff className="size-4" aria-hidden="true" />
                ) : (
                  <Eye className="size-4" aria-hidden="true" />
                )}
              </button>
            </span>
            <span
              id="api-key-help"
              className="text-muted mt-2 block text-xs leading-5"
            >
              localStorage, 쿠키, 데이터베이스에 저장하지 않습니다. 브라우저를
              새로고침하면 삭제됩니다.
            </span>
            {settings.apiKey ? (
              <button
                type="button"
                className="text-muted hover:text-danger mt-2 text-xs font-semibold underline underline-offset-4"
                onClick={() => setApiKey("")}
              >
                메모리에서 키 즉시 지우기
              </button>
            ) : null}
          </label>

          <label className="border-hairline bg-canvas-subtle mt-4 flex items-start gap-3 rounded-[9px] border p-3.5">
            <input
              type="checkbox"
              checked={settings.keepForTab}
              onChange={(event) => setKeepForTab(event.target.checked)}
              className="mt-0.5 size-4 accent-[var(--signal)]"
            />
            <span>
              <span className="text-strong block text-sm font-medium">
                현재 탭에서 다음 요청까지 키 유지
              </span>
              <span className="text-muted mt-1 block text-xs leading-5">
                해제하면 생성 요청이 끝난 직후 메모리에서도 키를 비웁니다.
              </span>
            </span>
          </label>

          <div
            role="status"
            className={cn(
              "border-hairline bg-canvas-subtle mt-4 flex min-h-12 items-center gap-2.5 rounded-[9px] border px-3.5 py-3 text-xs leading-5",
              settings.connectionStatus === "connected" && "text-stable",
              settings.connectionStatus === "failed" && "text-danger",
              (settings.connectionStatus === "idle" ||
                settings.connectionStatus === "checking") &&
                "text-muted",
            )}
          >
            {statusIcon}
            <span>
              {settings.connectionMessage ??
                "연결 확인은 이미지 생성 비용을 발생시키지 않는 모델 조회 요청을 사용합니다."}
            </span>
          </div>
        </div>

        <div className="border-hairline bg-canvas-subtle flex flex-col-reverse gap-2 border-t px-5 py-4 sm:flex-row sm:justify-end sm:px-6">
          <button type="button" className="secondary-button" onClick={close}>
            닫기
          </button>
          <button
            type="button"
            className="primary-button justify-center"
            onClick={() => void testConnection()}
            disabled={settings.connectionStatus === "checking"}
          >
            {settings.connectionStatus === "checking" ? (
              <LoaderCircle
                className="size-4 animate-spin motion-reduce:animate-none"
                aria-hidden="true"
              />
            ) : (
              <ShieldCheck className="size-4" aria-hidden="true" />
            )}
            연결 확인
          </button>
        </div>
      </section>
    </div>
  );
}
