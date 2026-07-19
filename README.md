# ViewGrid

> 프롬프트로 구도를 설명하는 대신, 카메라를 직접 배치합니다.

ViewGrid는 이미지 한 장 위에 9개의 가상 카메라를 배치하고 `Yaw`, `Pitch`, `Roll`, `FOV`, `Distance`를 조절해 멀티앵글 이미지 세트를 생성하는 브라우저 스튜디오입니다.

현재 저장소는 **Stage 6을 완료한 ViewGrid 1.0.0 공개 운영 버전**입니다. 사용자가 자신의 OpenAI 또는 Google Gemini API 키를 현재 탭 메모리에 입력하면, 로컬 카메라 가이드와 인접 생성 결과를 참조해 활성 카메라를 중앙 기준 순서로 생성합니다. 결과는 1,024×1,024로 정규화하고 3×3 PNG 및 ZIP으로 내려받을 수 있습니다.

전역 보안 헤더, API 요청 방어, PWA 앱 셸, 이미지 전처리 Worker, GitHub Actions 품질·E2E·Lighthouse 파이프라인과 공개 운영 문서를 포함합니다.

## 핵심 차별점

- 채팅 문장 대신 9개 카메라와 수치 파라미터로 구도를 설계합니다.
- 원본은 외형 기준, 로컬 가이드는 구도 기준, 인접 결과는 멀티뷰 일관성 기준으로 분리합니다.
- 중앙 기준 뷰를 먼저 만든 뒤 같은 열과 중앙 결과를 다음 생성의 참조로 사용합니다.
- 결과 크기와 제한된 색상 게인을 브라우저에서 정규화합니다.
- 카메라·가이드·일관성 설정을 JSON 프리셋으로 저장하고 불러올 수 있습니다.
- API 키, 원본, 결과 이미지는 영구 저장하지 않습니다.

## 현재 기능

### 카메라 스튜디오

- 이미지 클릭 업로드와 드래그 앤 드롭
- PNG, JPEG, WebP 및 최대 12MB 검증
- 내장 데모 제품 이미지
- 9개 카메라 선택·활성화
- Yaw, Pitch, Roll, FOV, Distance 조절
- 안전한 9뷰, 제품 기본, 측면 강조, 광고 구도 프리셋
- 안정적·주의·실험적 각도 안내
- 설정 변경 결과를 `STALE`로 판정

### 로컬 카메라 가이드

- Canvas 2D 기반 목표 구도 가이드
- Yaw·Pitch·Roll·FOV·Distance 반영
- 원본과 가이드 나란히 비교
- API 요청에 가이드 포함·제외
- 최대 1,024px·950KB JPEG 가이드
- 가이드 생성 실패 시 원본 단독 폴백
- 결과에 `GUIDE`, `FALLBACK`, `SOURCE` 상태 기록

가이드는 완전한 3D 복원이 아니라, 목표 카메라 방향·피사체 크기·화각·프레이밍을 모델에 더 구체적으로 전달하는 2D 힌트입니다.

### 멀티뷰 일관성

기본 생성 순서는 다음과 같습니다.

```text
C5 → C4 → C6 → C2 → C8 → C1 → C3 → C7 → C9
```

참조 계보:

```text
C5: 참조 없음
C4, C6: C5 참조
C2, C8: C5 참조
C1, C7: C4 참조
C3, C9: C6 참조
```

- 원본: 형태·비율·색상·재질·로고의 최우선 기준
- 가이드: 목표 카메라 구도 기준
- 인접 결과: 이미 생성된 구조·재질·조명 일관성 기준
- 참조 압축 실패 또는 크기 초과 시 원본+가이드로 자동 폴백
- 결과에 `REF C#`, `NO REF`, `NORM`, `RAW` 상태 표시
- 참조·정규화 설정 변경 시 기존 결과를 `STALE`로 판정

참조 이미지는 일관성을 높이는 보조 수단입니다. 큰 각도에서는 로고, 문자, 작은 부품이 여전히 변형될 수 있으므로 확대 검토가 필요합니다.

### 출력 정규화

- 모든 생성 결과를 1,024×1,024 WebP로 정규화
- 원본 또는 사용된 기준 결과의 평균 색상을 참고
- 과도한 색 변화를 막는 제한된 RGB·휘도 게인
- 픽셀 접근이 제한되면 색상 게인 없이 크기 정규화로 폴백
- 정규화 버전과 게인을 결과 메타데이터에 기록

정규화는 의미론적 배경 교체나 제품 마스크 재합성이 아니라, 시트에서 크기·톤 차이를 줄이는 보수적 후처리입니다.

### 실제 이미지 생성

- OpenAI와 Google Gemini 공급자 선택
- 지원 모델
  - `gpt-image-2`
  - `gemini-3.1-flash-image`
  - `gemini-3-pro-image`
- API 키 표시·숨김, 연결 확인, 즉시 삭제
- API 키를 브라우저 메모리에만 보관
- 선택 카메라 한 장 생성
- 활성 카메라 전체 순차 생성
- 카메라별 대기·생성·완료·실패·중단 상태
- 전체 진행률과 현재 참조 카메라 표시
- 큐 중단 및 실패·중단 셀 선택 재시도
- 개별 결과 확대·재생성·삭제·다운로드

### 프리셋과 세션

- 전체 카메라·가이드·일관성 설정 JSON 내보내기
- JSON 스키마 검증 후 불러오기
- 카메라 범위 자동 보정
- 현재 탭의 `sessionStorage`에 설정만 임시 저장
- API 키, 원본 이미지, 결과 이미지, Blob URL은 프리셋과 세션에서 제외

### 공개 운영과 PWA

- CSP, HSTS, Referrer Policy, Permissions Policy와 클릭재킹 방어
- API 동일 출처·콘텐츠 형식·모델·MIME·파일 크기 검증
- 요청 ID, `no-store`, 인스턴스 단위 속도 제한과 Vercel WAF 가이드
- `/api/health` 운영 상태 확인
- 앱 설치용 Manifest와 Service Worker
- Service Worker의 `/api/`·사용자 이미지 캐시 금지
- 오프라인 상태 안내
- OffscreenCanvas 이미지 전처리 Worker와 메인 스레드 폴백
- 본문 바로가기, 슬라이더 값 낭독, 모달 포커스 트랩과 44px 터치 대상
- 번들 예산, 보안 정적 검사와 운영 의존성 감사

### 결과 내보내기

- 현재 공급자·모델·카메라·가이드·참조·정규화 설정과 일치하는 결과 검증
- 768px 셀과 12px 간격의 3×3 PNG
- 카메라 번호·Yaw·Pitch·FOV 라벨
- 완료된 개별 이미지 ZIP
- 모든 활성 결과가 최신이면 ZIP에 3×3 시트 포함
- 생성 계보와 정규화 메타데이터 JSON 포함

## 실행 방법

필요 환경:

- Node.js 22 이상 권장
- npm 10 이상

```bash
npm install
npm run dev
```

브라우저에서 `http://localhost:3000`을 엽니다.

공급자 키는 환경변수로 설정하지 않습니다. 각 사용자가 UI에서 직접 입력하며 Vercel 프로젝트에도 OpenAI·Gemini 키를 등록할 필요가 없습니다.

## 검증 명령어

```bash
npm run format:check
npm run lint
npm run typecheck
npm run test
npm run build
npm run analyze:bundle
npm run verify:security
npm run audit:prod
npm run test:e2e
```

포맷·린트·타입·단위·통합 검사는 다음 명령으로 실행합니다.

```bash
npm run check
```

릴리스 전에는 `npm run check:build`, `npm run verify:security`, `npm run audit:prod`도 각각 실행합니다.

현재 자동 검증은 다음을 포함합니다.

- 카메라 프롬프트와 로컬 가이드 계산
- 중앙 기준 생성 순서와 참조 선택
- 공급자별 원본→가이드→참조 순서
- 참조·가이드 폴백
- 결과 1,024px 정규화와 색상 게인 제한
- 9개 큐 전체 성공·부분 실패·중단·재시도
- 카메라·공급자·모델·가이드·참조·정규화 `STALE` 판정
- JSON 프리셋 검증
- ZIP 구성과 결과 삭제

## 사용자 흐름

```text
이미지 업로드 또는 데모 선택
→ 카메라 배치와 각도·화각 조절
→ 원본 / 로컬 가이드 확인
→ 멀티뷰 참조와 정규화 옵션 확인
→ API 공급자·모델·키 설정
→ 중앙 기준 순서로 선택 또는 전체 생성
→ REF·NORM·GUIDE 상태 검토
→ 실패·중단·STALE 셀 재생성
→ 3×3 PNG 또는 ZIP 다운로드
```

## 생성 입력 우선순위

```text
Image 1: 원본
Image 2: 로컬 카메라 가이드(옵션)
Image 3: 인접 완성 결과(옵션)
```

프롬프트 정책:

1. 원본 외형과 세부 구조를 최우선으로 보존합니다.
2. 가이드의 카메라 방향과 프레이밍을 따릅니다.
3. 인접 결과의 재질·조명·구조 일관성을 참고합니다.
4. 가이드의 블러·스트립 경계·늘어짐은 복사하지 않습니다.
5. 참조 이미지에 생긴 오류보다 원본을 우선합니다.

## 큐 처리 정책

- 동시 실행 수는 1개입니다.
- 원본 전처리는 큐 시작 시 한 번만 수행합니다.
- 참조가 필요한 카메라는 선행 결과가 완료된 뒤 처리합니다.
- 가이드와 참조는 카메라별로 생성·압축합니다.
- 재시도 가능한 오류는 해당 셀을 실패로 남기고 다음 카메라를 계속 처리합니다.
- 인증·권한처럼 복구할 수 없는 오류는 남은 큐를 중단합니다.
- 사용자가 중단하면 완료 결과를 유지합니다.
- `현재 탭 동안 키 유지`를 끈 경우 키는 전체 큐 종료 후 삭제됩니다.

## 아키텍처

```text
브라우저
├─ 이미지 업로드와 카메라 편집
├─ PWA 앱 셸과 오프라인 상태
├─ API 키 메모리 상태
├─ Worker 우선 원본 리사이즈·압축
├─ Canvas 2D 카메라 가이드
├─ 중앙 기준 생성 계획
├─ 인접 결과 참조 압축
├─ 순차 생성 큐
├─ 1,024px 출력 정규화
├─ sessionStorage 설정 복구
├─ Canvas 3×3 합성
└─ JSZip 결과 패키징
        │ HTTPS same-origin
        ▼
Vercel Functions
├─ /api/connection
├─ /api/generate
├─ /api/health
├─ 출처·형식·속도·원본·가이드·참조·모델 검증
├─ OpenAI/Gemini 다중 이미지 어댑터
└─ 요청 ID가 포함된 no-store 응답
```

DB, 로그인, 서버 이미지 저장소와 서비스 운영자용 공급자 API 키는 사용하지 않습니다.

## 프로젝트 구조

```text
src/
├─ app/
│  ├─ api/connection/
│  ├─ api/generate/
│  ├─ api/health/
│  ├─ manifest.ts
│  └─ robots.ts
├─ components/
│  ├─ camera-guide-panel.tsx
│  ├─ consistency-panel.tsx
│  ├─ project-session-sync.tsx
│  ├─ pwa-registration.tsx
│  └─ ...
├─ lib/
│  ├─ providers/
│  ├─ camera-guide.ts
│  ├─ multiview-consistency.ts
│  ├─ output-normalization.ts
│  ├─ project-preset.ts
│  ├─ request-security.ts
│  ├─ security-headers.ts
│  └─ result-export.ts
├─ store/
├─ test/
└─ types/

e2e/
docs/
scripts/
public/sw.js
SECURITY.md
PRIVACY.md
.github/workflows/ci.yml
```

## 개인정보 및 API 키 원칙

- API 키는 Zustand 메모리 상태에만 둡니다.
- `localStorage`, 쿠키, IndexedDB, DB에 저장하지 않습니다.
- `sessionStorage`에는 카메라·가이드·일관성 설정만 저장합니다.
- API 키, 원본·가이드·참조·결과 이미지를 서버 저장소에 기록하지 않습니다.
- 공급자 응답과 프록시 응답에 캐시 금지 헤더를 적용합니다.
- Service Worker는 API 요청과 사용자 이미지 Blob을 캐시하지 않습니다.
- Vercel Function의 인스턴스 단위 제한과 Vercel Firewall 전역 제한을 병행합니다.
- API 키나 공급자 원문 오류를 클라이언트 오류에 반사하지 않습니다.
- ZIP 메타데이터에는 API 키와 Blob URL을 포함하지 않습니다.
- 결과는 브라우저 Blob URL로 유지되므로 탭을 닫기 전에 내려받아야 합니다.

## 디자인 방향

- 구조와 정보 계층을 장식보다 우선
- 어두운 편집 캔버스와 노란색 단일 핵심 액센트
- 평평한 색면과 얇은 경계선 중심의 계층
- Pretendard와 tabular numerals
- 상태를 색상뿐 아니라 텍스트·아이콘·배지로 표현
- 짧고 절제된 전환과 `prefers-reduced-motion` 지원

## 개발 로드맵

| 단계    | 내용                           | 상태         |
| ------- | ------------------------------ | ------------ |
| Stage 1 | UI 프로토타입                  | 완료         |
| Stage 2 | 사용자 키 기반 단일 실제 생성  | 완료         |
| Stage 3 | 9개 생성 큐와 3×3 다운로드     | 완료         |
| Stage 4 | 로컬 카메라 가이드와 다중 입력 | 완료         |
| Stage 5 | 멀티뷰 일관성 개선             | 완료         |
| Stage 6 | 보안·접근성·운영 완성          | 완료 — 1.0.0 |

## 알려진 한계

- 생성 모델은 실제 3D 렌더러가 아니므로 입력 각도를 수학적으로 보장하지 않습니다.
- 깊이 기반 3D 재구성이 아닌 2D 가이드입니다.
- 색상 정규화는 전역 평균 기반으로, 의미론적 배경 통일을 수행하지 않습니다.
- 참조 결과 자체에 오류가 있으면 후속 결과에도 영향을 줄 수 있습니다.
- 실제 OpenAI·Gemini 유료 9뷰 A/B는 저장소에 사용자 키가 없어 자동 실행하지 않습니다.
- 최종 Vercel Production 배포, 실브라우저 Lighthouse와 모바일 실기기 검증은 저장소 소유자의 배포 환경에서 수행해야 합니다.
- 인스턴스 내 속도 제한은 전역 제한이 아니므로 공개 배포에서는 Vercel Firewall 규칙이 필요합니다.

## 문서

- [컨텍스트 노트](./docs/CONTEXT_NOTE.md)
- [개발 체크리스트](./docs/CHECKLIST.md)
- [사용자 매뉴얼](./docs/USER_MANUAL.md)
- [Stage 1 자체 점검](./docs/STAGE_1_REVIEW.md)
- [Stage 2 자체 점검](./docs/STAGE_2_REVIEW.md)
- [Stage 3 자체 점검](./docs/STAGE_3_REVIEW.md)
- [Stage 4 자체 점검](./docs/STAGE_4_REVIEW.md)
- [Stage 5 자체 점검](./docs/STAGE_5_REVIEW.md)
- [Stage 6 자체 점검](./docs/STAGE_6_REVIEW.md)
- [Vercel 배포 가이드](./docs/DEPLOYMENT.md)
- [운영 가이드](./docs/OPERATIONS.md)
- [접근성 기록](./docs/ACCESSIBILITY.md)
- [모델 변경 대응](./docs/MODEL_UPDATE_GUIDE.md)
- [번들 보고서](./docs/BUNDLE_REPORT.md)
- [보안 정책](./SECURITY.md)
- [개인정보 처리 안내](./PRIVACY.md)
- [기여 가이드](./CONTRIBUTING.md)
- [변경 기록](./CHANGELOG.md)
