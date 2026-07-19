# Stage 6 자체 점검 보고서

> 완료일: 2026-07-19  
> 버전: ViewGrid 1.0.0  
> 범위: 공개 운영 보안, 접근성, 성능, PWA, 배포·운영 문서와 릴리스 준비

## 1. 완료 판단

Stage 6의 코드 범위는 완료했습니다. ViewGrid는 GitHub 공개 저장소에 올리고 Vercel에 배포할 수 있는 1.0.0 릴리스 후보입니다.

다음 외부 검증은 코드 완료와 분리해 남겨 두었습니다.

- 저장소 소유자의 실제 GitHub 푸시와 Vercel Production 배포
- 개인 OpenAI·Gemini 키를 이용한 라이브 생성
- 배포 URL에서 Playwright·Lighthouse 실행
- NVDA·VoiceOver와 iOS·Android 실기기 검증

## 2. 구현 결과

### 2.1 보안 헤더와 API 방어

- 전역 Content Security Policy
- Production HSTS
- Referrer Policy와 Permissions Policy
- 클릭재킹, MIME 스니핑, 교차 출처 창·리소스 방어
- `/api/connection`, `/api/generate` 동일 출처·콘텐츠 형식 검사
- 요청 본문, 키 길이, 이미지 MIME·개별 크기·합산 크기 검증
- API 응답 `Cache-Control: no-store`
- 요청별 `X-ViewGrid-Request-Id`
- 인스턴스 단위 방어적 속도 제한
- Vercel Firewall 전역 제한 운영 절차
- 정적 키·민감 로그 패턴 검사
- Service Worker의 API·업로드·생성 결과 캐시 금지

### 2.2 개인정보와 공개 안내

- 저장소 `PRIVACY.md`, `SECURITY.md`
- 앱에서 접근 가능한 `/privacy`, `/security`
- 업로드 화면의 개인정보·보안 링크
- API 키는 탭 메모리에만 보관
- 프로젝트 세션 저장에서 키·이미지·Blob URL 제외
- 공급자 전송 범위와 운영자 추가 고지 의무 문서화

### 2.3 접근성

- 본문 바로가기
- 슬라이더 레이블, 도움말 연결, 현재 값 읽기
- 생성 영역 `aria-busy`, 진행률 `progressbar`
- 모달 Escape, 포커스 트랩과 호출 지점 복귀
- 상태·오류·다운로드 live region
- 색상 외 텍스트·아이콘·배지 상태 전달
- 거친 포인터 환경 최소 44px 조작 대상
- 축소 모션 지원
- axe serious·critical 차단 E2E 시나리오

### 2.4 성능과 PWA

- 원본·참조 이미지 OffscreenCanvas Worker 전처리
- Worker 실패·미지원 시 기존 Canvas 폴백
- Worker, ImageBitmap, Canvas와 Blob URL 정리
- 결과 비동기 디코딩과 아래 행 지연 로딩
- PWA Manifest, 192·512·Maskable·Apple 아이콘
- 정적 앱 셸 Service Worker
- 오프라인 상태 알림과 설치 버튼
- API와 사용자 데이터는 오프라인 캐시에서 제외
- JavaScript 번들 예산 자동 검사
- Lighthouse CI 설정

### 2.5 공개 운영 준비

- GitHub Actions 품질·E2E·Lighthouse 작업
- Dependabot
- 버그·기능 이슈 템플릿과 PR 템플릿
- `CONTRIBUTING.md`, `CHANGELOG.md`
- Vercel 배포, 운영·장애·롤백, 모델 변경, 접근성 문서
- `/api/health`
- 1.0.0 릴리스 노트

## 3. 자체 점검 중 발견한 문제와 수정

### 3.1 Next.js 하위 PostCSS 취약점

운영 감사에서 Next.js가 사용하는 PostCSS 하위 버전에 중간 등급 항목이 발견됐습니다. Next.js 메이저 다운그레이드 대신 npm override로 PostCSS 8.5.10을 고정했고, 최종 운영 의존성 감사에서 취약점 0건을 확인했습니다.

### 3.2 다수 테스트 프로세스의 불안정한 종료

제한된 실행 환경에서 여러 Vitest 프로세스를 연속 실행할 때 일부 워커가 불규칙하게 종료를 지연했습니다. 전체 20개 파일을 단일 스레드·비병렬 파일 모드로 실행하도록 기본 `npm test`를 변경해 69개 테스트가 안정적으로 종료되도록 수정했습니다. 테스트 전에는 일시적인 `.next` 산출물을 제거하며, 빌드·감사처럼 성격이 다른 검증은 별도 명령으로 분리해 로컬 환경과 CI에서 실패 원인을 명확히 확인하도록 했습니다.

### 3.3 중단된 빌드의 잠금 파일

강제 중단된 Next.js 빌드가 `.next/lock`을 남길 가능성에 대비해 `prebuild`에서 해당 잠금 파일만 안전하게 제거하도록 보완했습니다.

### 3.4 번들 보고서 포맷 회귀

자동 생성된 `BUNDLE_REPORT.md`가 다음 실행의 Prettier 검사에서 실패할 수 있었습니다. 번들 분석 명령이 보고서 생성 후 Prettier를 적용하도록 수정했습니다.

### 3.5 법적·보안 안내의 웹 접근성

개인정보와 보안 문서가 저장소에만 있어 실제 서비스 사용자가 찾기 어려웠습니다. `/privacy`, `/security` 정적 페이지와 업로드 화면 링크를 추가했습니다.

### 3.6 인스턴스 속도 제한의 범위

메모리 기반 제한은 Vercel 인스턴스 하나 안에서만 유효하므로 이를 전역 방어로 과장하지 않았습니다. Production에서는 Vercel Firewall 경로별 속도 제한을 필수 운영 단계로 문서화했습니다.

## 4. 검증 결과

### 4.1 정적·단위·통합 검증

| 항목                     | 결과                           |
| ------------------------ | ------------------------------ |
| Prettier                 | 통과                           |
| ESLint                   | 통과                           |
| TypeScript strict        | 통과                           |
| Vitest                   | **20개 파일·69개 테스트 통과** |
| UI·API                   | 6개 파일·19개 테스트 통과      |
| 내보내기                 | 1개 파일·6개 테스트 통과       |
| 코어                     | 13개 파일·44개 테스트 통과     |
| Next.js Production build | 통과                           |
| 정적 페이지              | **10개 생성 단계 통과**        |
| 운영 의존성 감사         | 취약점 0건                     |
| 민감정보 정적 검사       | 49개 파일·패턴 이상 없음       |

### 4.2 빌드·번들

- Next.js: 16.2.10
- 정적 경로: `/`, `/privacy`, `/security`, Manifest, Robots와 오류 페이지
- 동적 API: `/api/connection`, `/api/generate`, `/api/health`
- JavaScript 청크: 12개
- 원본 청크 합계: 약 944.7KB
- gzip 추정 합계: 약 281.1KB
- 최대 단일 gzip 청크: 약 69.3KB
- 설정 예산: 합계 950KB, 단일 320KB — 통과

### 4.3 로컬 Production 스모크 테스트

- `/`: HTTP 200
- `/privacy`: HTTP 200
- `/security`: HTTP 200
- `/manifest.webmanifest`: HTTP 200
- `/api/health`: HTTP 200, 버전·공급자·모델 정보 반환
- CSP, HSTS, Referrer Policy, Permissions Policy 확인
- `X-Frame-Options: DENY`
- `X-Content-Type-Options: nosniff`
- API `Cache-Control: no-store`
- API `X-ViewGrid-Request-Id` 확인

### 4.4 브라우저 자동화 상태

Playwright에는 다음 시나리오가 작성되어 있습니다.

- 업로드→카메라 편집→가상 결과
- 사용자 키 Mock 연결→단일 실제 생성
- 9개 생성 큐와 ZIP 다운로드
- 가이드 사용·미사용 A/B
- axe serious·critical 접근성 검사
- 360px·768px·1440px 반응형 검사

현재 실행 환경에서는 Playwright 전용 Chromium 다운로드가 DNS 제한으로 실패했고, 시스템 Chromium은 localhost를 조직 정책으로 차단해 assertion 이전에 `ERR_BLOCKED_BY_ADMINISTRATOR`로 중단됐습니다. 애플리케이션 오류로 판정하지 않았으며 GitHub Actions에서 전용 Chromium을 설치하도록 구성했습니다.

## 5. 남은 위험

- 실제 배포 URL의 CSP가 Vercel Preview·Production 및 추가 분석 도구와 충돌하는지 확인이 필요합니다.
- 실제 OpenAI·Gemini 9뷰 생성의 지연·비용·품질과 오류율은 개인 키로 검증해야 합니다.
- 인스턴스 속도 제한은 분산 전역 제한이 아니므로 Vercel Firewall 구성이 필요합니다.
- PWA의 iOS 설치·업데이트·오프라인 복귀는 실기기 검증이 필요합니다.
- 큰 결과 9개와 ZIP 생성의 저사양 모바일 메모리 사용량은 실측하지 못했습니다.
- 로고·문자·얇은 구조의 멀티뷰 일관성은 생성 모델의 추론 한계를 그대로 가집니다.

## 6. 자체 평가

| 평가 항목            |     배점 |    점수 |
| -------------------- | -------: | ------: |
| 요구사항 충족        |      2.0 |    1.95 |
| 기능 정확성          |      2.0 |    1.85 |
| UX·시각 완성도       |      1.5 |    1.40 |
| 코드 품질            |      1.5 |    1.45 |
| 테스트 안정성        |      1.5 |    1.30 |
| 보안·개인정보·접근성 |      1.0 |    0.90 |
| 문서 최신성          |      0.5 |    0.45 |
| **합계**             | **10.0** | **9.3** |

## 7. 최종 판단

**자체 평가: 9.3 / 10**

코드, 문서와 자동화 범위는 1.0.0 공개 릴리스 후보로 승인합니다. 10점에 도달하려면 실제 Vercel Production 배포, 라이브 공급자 A/B, Playwright·Lighthouse, 모바일·스크린리더 실기기 검증이 필요합니다.
