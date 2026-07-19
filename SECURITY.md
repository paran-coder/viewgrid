# ViewGrid 보안 정책

## 지원 버전

| 버전 | 보안 업데이트 |
| ---- | ------------- |
| 1.x  | 지원          |
| 0.x  | 지원 종료     |

## 취약점 제보

공개 이슈에 API 키, 원본 이미지, 생성 결과, 공급자 응답 전문 또는 재현 가능한 공격 코드를 올리지 마십시오.

1. GitHub 저장소의 **Security → Report a vulnerability**를 사용해 비공개 보안 권고를 작성합니다.
2. 영향 범위, 재현 절차, 예상 결과, 실제 결과와 최소한의 증거를 포함합니다.
3. API 키나 개인정보가 포함됐다면 모두 마스킹합니다.

유지관리자는 제보를 확인한 뒤 영향도와 수정 계획을 보안 권고 안에서 공유합니다. 수정이 배포되기 전에는 공개 논의를 피합니다.

## 보안 설계

- 서비스 소유 OpenAI·Gemini 키를 사용하지 않습니다.
- 사용자 키는 브라우저 메모리에만 두며 `localStorage`, 쿠키, IndexedDB, DB에 저장하지 않습니다.
- API 요청 본문과 키를 애플리케이션 로그에 기록하지 않습니다.
- 브라우저는 동일 출처 Vercel Function만 호출합니다.
- API Route는 출처, 콘텐츠 형식, 모델, MIME, 개별·합산 크기를 검증합니다.
- API 응답은 `no-store`이며 요청 ID만 운영 추적에 사용합니다.
- CSP, HSTS, 클릭재킹 방어, Referrer Policy, Permissions Policy를 적용합니다.
- Service Worker는 `/api/` 요청과 사용자 이미지를 캐시하지 않습니다.
- 인스턴스 단위 속도 제한과 Vercel WAF 전역 제한을 함께 사용합니다.

## 운영자 체크리스트

- 배포 전 `npm run check`를 실행합니다.
- GitHub와 Vercel에 공급자 API 키를 저장하지 않습니다.
- Vercel Firewall에서 `/api/generate`와 `/api/connection` 속도 제한을 설정합니다.
- 배포 후 보안 헤더, `/api/health`, API 오류 정규화를 확인합니다.
- 공급자 SDK나 API 스키마를 바꾸면 원문 오류가 사용자에게 반사되지 않는지 재검증합니다.
