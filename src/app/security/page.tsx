import Link from "next/link";

export const metadata = {
  title: "보안 안내 | ViewGrid",
  description: "ViewGrid의 API 키 보호와 취약점 제보 방법입니다.",
};

export default function SecurityPage() {

  return (
    <main className="mx-auto min-h-dvh max-w-3xl px-5 py-12 sm:px-8 sm:py-16">
      <Link className="text-link text-sm font-semibold" href="/">
        ← ViewGrid로 돌아가기
      </Link>
      <p className="eyebrow mt-10 w-fit">Security</p>
      <h1 className="text-strong mt-5 text-4xl font-bold tracking-[-0.045em] sm:text-5xl">
        보안 안내
      </h1>
      <p className="text-muted-strong mt-5 text-base leading-7">
        ViewGrid는 사용자 키를 저장하지 않는 중계 구조, 엄격한 요청 검증과 보안
        헤더를 기본값으로 사용합니다. 보안은 배포 환경과 함께 유지해야 하는 운영
        항목입니다.
      </p>

      <div className="mt-10 space-y-8">
        <section className="legal-section">
          <h2>기본 보호</h2>
          <p>
            Content Security Policy, HSTS, 클릭재킹 방어, MIME 스니핑 방어,
            Permissions Policy, 동일 출처 검사, 요청 크기·형식 제한과 캐시 금지
            정책을 적용합니다.
          </p>
        </section>
        <section className="legal-section">
          <h2>API 키 취급</h2>
          <p>
            키는 요청 헤더에서만 읽으며 응답, 오류 메시지 또는 서버 로그에
            포함하지 않습니다. 저장소와 Vercel 환경변수에도 사용자 키를 넣지
            않습니다.
          </p>
        </section>
        <section className="legal-section">
          <h2>속도 제한</h2>
          <p>
            함수 인스턴스 단위의 방어적 제한을 포함하지만, 분산 트래픽에 대한
            최종 방어는 Vercel Firewall 또는 배포 플랫폼의 전역 속도 제한
            규칙으로 구성해야 합니다.
          </p>
        </section>
        <section className="legal-section">
          <h2>취약점 제보</h2>
          <p>
            API 키 노출, 출처 검증 우회, 요청 위조나 기타 취약점은 공개 이슈에
            민감정보를 작성하지 말고 서비스 운영자가 안내한 비공개 보안 채널을 통해 제보해 주십시오.
          </p>
        </section>
      </div>
    </main>
  );
}
