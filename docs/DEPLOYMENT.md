# Vercel 배포 가이드

## 1. 사전 점검

```bash
npm ci
npm run check
npm run check:build
npm run verify:security
npm run audit:prod
```

`npm run check`는 포맷, 린트, 타입과 69개 단위·통합 테스트를 수행합니다. `check:build`는 프로덕션 빌드와 번들 예산을 확인합니다. 보안 정적 검사와 운영 의존성 감사는 별도 명령으로 분리되어 있으며 GitHub Actions에서는 모두 실행합니다.

## 2. GitHub 저장소

1. 새 GitHub 저장소에 프로젝트를 푸시합니다.
2. 기본 브랜치를 `main`으로 설정합니다.
3. GitHub Security Advisories를 활성화합니다.
4. Actions가 CI, Playwright와 Lighthouse를 실행할 수 있도록 허용합니다.
5. 저장소의 Security 탭에서 Dependabot alerts와 security updates를 활성화합니다.

## 3. Vercel 프로젝트 생성

1. Vercel에서 GitHub 저장소를 가져옵니다.
2. Framework Preset은 Next.js를 사용합니다.
3. Install Command는 `npm ci`, Build Command는 `npm run build`를 사용합니다.
4. Node.js 22를 선택합니다.
5. OpenAI 또는 Gemini 서비스 소유 키를 환경변수에 추가하지 않습니다.

권장 환경변수:

```text
NEXT_TELEMETRY_DISABLED=1
NEXT_PUBLIC_GITHUB_URL=https://github.com/<owner>/<repo>
VIEWGRID_RATE_LIMIT_ENABLED=true
```

`VIEWGRID_RATE_LIMIT_ENABLED`는 Vercel Function 인스턴스 안의 보조 제한입니다. 여러 인스턴스에 걸친 전역 방어는 Vercel Firewall에서 별도로 설정해야 합니다.

## 4. Vercel Firewall

권장 기본 규칙:

| 경로              | 메서드        | 기준        | 권장 시작값 |
| ----------------- | ------------- | ----------- | ----------: |
| `/api/generate`   | POST          | IP          |  1분당 24회 |
| `/api/connection` | POST          | IP          |  1분당 20회 |
| `/api/*`          | 비정상 메서드 | 경로·메서드 |        차단 |

실제 트래픽과 공급자 지연을 관찰한 뒤 제한을 조정합니다. 한 번의 전체 생성은 최대 9개의 `/api/generate` 요청을 순차 사용합니다.

## 5. 배포 후 확인

```bash
curl -I https://<domain>/
curl https://<domain>/api/health
```

확인할 헤더:

- `Content-Security-Policy`
- `Strict-Transport-Security`
- `Referrer-Policy`
- `Permissions-Policy`
- `X-Frame-Options: DENY`
- `X-Content-Type-Options: nosniff`
- `Cross-Origin-Opener-Policy: same-origin`

API 응답에서는 다음도 확인합니다.

- `Cache-Control: no-store`
- `X-ViewGrid-Request-Id`
- 제한 적용 시 `RateLimit-*`

## 6. 기능 스모크 테스트

1. 새 시크릿 브라우저 세션에서 데모 이미지로 시작합니다.
2. 9개 카메라, 슬라이더, 프리셋, JSON 저장·불러오기를 확인합니다.
3. 개인 OpenAI 또는 Gemini 키로 연결 확인을 수행합니다.
4. 안전한 각도의 한 장 생성을 실행합니다.
5. 결과 확대, 재생성, 삭제와 다운로드를 확인합니다.
6. 전체 9개 생성 후 PNG와 ZIP을 확인합니다.
7. 네트워크를 오프라인으로 전환해 앱 셸과 오프라인 안내를 확인합니다.
8. 탭을 닫고 다시 열어 API 키와 이미지가 복구되지 않는지 확인합니다.

## 7. 배포할 수 없는 상태

다음 중 하나라도 해당하면 프로덕션 승격을 중지합니다.

- `npm run check` 또는 `npm run check:build` 실패
- 보안 정적 검사 실패
- 높음 또는 치명적 운영 의존성 취약점
- API 키나 이미지 본문 로그 발견
- CSP 또는 no-store 헤더 누락
- 공급자 원문 오류가 클라이언트에 노출
- 3×3 내보내기에 STALE 결과 혼입
