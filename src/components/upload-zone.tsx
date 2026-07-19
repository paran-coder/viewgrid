"use client";

import Link from "next/link";
import { useRef, useState, type ChangeEvent, type DragEvent } from "react";
import { FileImage, ImagePlus, LockKeyhole, WandSparkles } from "lucide-react";

import { cn } from "@/lib/utils";
import { useStudioStore } from "@/store/use-studio-store";

const MAX_SIZE = 12 * 1024 * 1024;
const ACCEPTED_TYPES = ["image/png", "image/jpeg", "image/webp"];

export function UploadZone() {
  const inputRef = useRef<HTMLInputElement>(null);
  const setImage = useStudioStore((state) => state.setImage);
  const [isDragging, setIsDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function processFile(file?: File) {
    setError(null);
    if (!file) return;

    if (!ACCEPTED_TYPES.includes(file.type)) {
      setError("PNG, JPEG 또는 WebP 이미지만 사용할 수 있습니다.");
      return;
    }

    if (file.size > MAX_SIZE) {
      setError("파일 크기는 12MB 이하여야 합니다.");
      return;
    }

    setImage({
      url: URL.createObjectURL(file),
      name: file.name,
      kind: "object-url",
    });
  }

  function handleChange(event: ChangeEvent<HTMLInputElement>) {
    processFile(event.target.files?.[0]);
    event.target.value = "";
  }

  function handleDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setIsDragging(false);
    processFile(event.dataTransfer.files?.[0]);
  }

  return (
    <section className="mx-auto flex min-h-[calc(100dvh-4rem)] max-w-6xl items-center px-4 py-12 sm:px-6 lg:px-8">
      <div className="grid w-full gap-8 lg:grid-cols-[minmax(0,1.04fr)_minmax(340px,.96fr)] lg:items-center">
        <div>
          <div className="eyebrow">
            <WandSparkles className="size-4" aria-hidden="true" />
            Prompt less. Direct the camera.
          </div>
          <h1 className="text-strong mt-5 max-w-3xl text-4xl font-bold tracking-[-0.055em] text-balance sm:text-5xl lg:text-[62px] lg:leading-[1.06]">
            카메라를 배치하고,
            <br />
            원하는 시점을 만드세요.
          </h1>
          <p className="text-muted-strong mt-6 max-w-2xl text-base leading-7 sm:text-lg">
            이미지 한 장 위에 9개의 가상 카메라를 배치하고 각도와 화각을 수치로
            조절합니다. 사용자 API 키를 연결하면 원본·구도 가이드·인접 결과를
            활용해 실제 멀티앵글 시트를 생성합니다.
          </p>
          <div className="text-muted mt-8 flex flex-wrap gap-3 text-sm">
            <span className="feature-chip">9개 카메라</span>
            <span className="feature-chip">Yaw · Pitch · FOV</span>
            <span className="feature-chip">3×3 결과 시트</span>
            <span className="feature-chip">브라우저 로컬 설정</span>
          </div>
        </div>

        <div className="border-hairline bg-card shadow-panel rounded-[16px] border p-3">
          <div
            aria-label="이미지를 업로드하거나 파일을 끌어 놓는 영역"
            onDragEnter={(event) => {
              event.preventDefault();
              setIsDragging(true);
            }}
            onDragOver={(event) => event.preventDefault()}
            onDragLeave={() => setIsDragging(false)}
            onDrop={handleDrop}
            className={cn(
              "group grid min-h-[390px] cursor-pointer place-items-center rounded-[12px] border border-dashed p-7 text-center transition duration-300 outline-none",
              "border-hairline-strong bg-canvas-subtle hover:border-signal/70 hover:bg-signal/[0.025] focus-visible:ring-signal focus-visible:ring-offset-card focus-visible:ring-2 focus-visible:ring-offset-2",
              isDragging && "border-signal bg-signal/[0.05]",
            )}
          >
            <div>
              <span className="border-hairline bg-elevated text-signal shadow-inner-soft mx-auto grid size-16 place-items-center rounded-[18px] border transition-transform duration-300 group-hover:-translate-y-1 motion-reduce:transform-none">
                <ImagePlus className="size-7" aria-hidden="true" />
              </span>
              <h2 className="text-strong mt-6 text-xl font-semibold tracking-[-0.02em]">
                이미지를 여기에 놓으세요
              </h2>
              <p className="text-muted mt-2 text-sm leading-6">
                PNG, JPEG, WebP · 최대 12MB
              </p>
              <button
                type="button"
                className="primary-button mt-6"
                onClick={() => inputRef.current?.click()}
              >
                <FileImage className="size-4" aria-hidden="true" />
                이미지 선택
              </button>
              <button
                type="button"
                className="text-muted-strong decoration-hairline-strong hover:text-strong mt-3 block w-full text-xs font-semibold underline underline-offset-4 transition"
                onClick={() => {
                  setImage({
                    url: "/sample-product.svg",
                    name: "viewgrid-demo-product.svg",
                    kind: "static",
                  });
                }}
              >
                데모 이미지로 시작
              </button>
            </div>
          </div>

          <input
            ref={inputRef}
            type="file"
            className="sr-only"
            accept="image/png,image/jpeg,image/webp"
            onChange={handleChange}
          />

          <div className="border-hairline bg-canvas text-muted mt-3 rounded-[10px] border px-3 py-2.5 text-xs leading-5">
            <div className="flex items-start gap-2">
              <LockKeyhole
                className="text-stable mt-0.5 size-4 shrink-0"
                aria-hidden="true"
              />
              <span>
                이미지는 생성 요청 때만 Vercel Function을 거쳐 선택한 공급자로
                전송되며 저장하지 않습니다.
              </span>
            </div>
            <div className="border-hairline mt-2 flex gap-3 border-t pt-2 pl-6">
              <Link className="text-link font-semibold" href="/privacy">
                개인정보 처리
              </Link>
              <Link className="text-link font-semibold" href="/security">
                보안 안내
              </Link>
            </div>
          </div>
          {error ? (
            <p role="alert" className="text-danger mt-3 text-sm font-medium">
              {error}
            </p>
          ) : null}
        </div>
      </div>
    </section>
  );
}
