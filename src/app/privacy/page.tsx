import Link from "next/link";

export const metadata = {
  title: "개인정보 처리 안내 | ViewGrid",
  description:
    "ViewGrid의 이미지, API 키와 브라우저 저장 데이터 처리 방식입니다.",
};

export default function PrivacyPage() {
  return (
    <main className="mx-auto min-h-dvh max-w-3xl px-5 py-12 sm:px-8 sm:py-16">
      <Link className="text-link text-sm font-semibold" href="/">
        ← ViewGrid로 돌아가기
      </Link>
      <p className="eyebrow mt-10 w-fit">Privacy</p>
      <h1 className="text-strong mt-5 text-4xl font-bold tracking-[-0.045em] sm:text-5xl">
        개인정보 처리 안내
      </h1>
      <p className="text-muted-strong mt-5 text-base leading-7">
        ViewGrid는 계정, 데이터베이스와 자체 이미지 저장소 없이 동작하도록
        설계되었습니다. 사용자가 입력한 API 키와 이미지는 선택한 생성 공급자에
        요청을 전달하는 데만 사용됩니다.
      </p>

      <div className="mt-10 space-y-8">
        <section className="legal-section">
          <h2>API 키</h2>
          <p>
            API 키는 브라우저 메모리에만 유지되며 localStorage, 쿠키, IndexedDB,
            서버 데이터베이스 또는 로그에 저장하지 않습니다. 탭 유지 옵션을 끄면
            생성 요청이 끝난 뒤 메모리에서 제거됩니다.
          </p>
        </section>
        <section className="legal-section">
          <h2>이미지</h2>
          <p>
            업로드 이미지와 로컬 가이드는 생성 시 HTTPS를 통해 Vercel Function을
            거쳐 사용자가 선택한 OpenAI 또는 Google API로 전달됩니다. ViewGrid는
            이를 영구 저장하지 않으며 API 응답에도 캐시 금지 헤더를 적용합니다.
          </p>
        </section>
        <section className="legal-section">
          <h2>브라우저 저장</h2>
          <p>
            카메라 설정과 비민감 프로젝트 옵션만 같은 탭의 sessionStorage에
            저장될 수 있습니다. 이미지, 생성 결과, API 키와 Blob URL은 저장
            대상이 아닙니다. PWA Service Worker도 정적 앱 파일만 캐시합니다.
          </p>
        </section>
        <section className="legal-section">
          <h2>외부 공급자</h2>
          <p>
            실제 생성 요청은 사용자가 선택한 공급자의 약관과 데이터 처리 정책을
            따릅니다. 생성 전에 공급자와 모델을 확인하고, 공개 권한이 없는
            이미지나 민감한 개인정보가 포함된 이미지는 업로드하지 마십시오.
          </p>
        </section>
        <section className="legal-section">
          <h2>운영자 배포 시 확인 사항</h2>
          <p>
            공개 배포자는 저장소의 PRIVACY.md를 서비스 운영 방식에 맞게
            갱신하고, 분석 도구·오류 추적·추가 프록시를 도입할 경우 그 데이터
            흐름을 별도로 고지해야 합니다.
          </p>
        </section>
      </div>
    </main>
  );
}
