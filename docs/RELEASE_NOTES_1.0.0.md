# ViewGrid 1.0.0 릴리스 노트

ViewGrid 1.0.0은 카메라 수치로 이미지 생성 모델을 지휘하고 3×3 멀티앵글 결과를 만드는 첫 공개 운영 버전입니다.

## 주요 기능

- 9개 카메라와 5개 카메라 파라미터
- GPT Image 2, Nano Banana 2, Nano Banana Pro 사용자 키 연결
- 로컬 구도 가이드와 인접 결과 참조
- 중앙 기준 생성 순서와 결과 정규화
- 중단·재시도·STALE 검증
- 3×3 PNG, 개별 ZIP과 생성 계보 JSON
- PWA, 오프라인 앱 셸과 이미지 처리 Worker
- 프로덕션 보안 헤더, 입력 방어와 운영 문서

## 업그레이드 참고

Stage 5 프로젝트에서 업그레이드할 때 `npm ci`로 잠금 파일을 다시 적용하십시오. Next.js 내부 PostCSS는 보안 패치 버전으로 override됩니다. Service Worker 캐시 이름이 `viewgrid-shell-v1`이므로 이후 앱 셸 변경 시 버전을 올려야 합니다.

## 아직 필요한 운영자 검증

- 자신의 Vercel Production 배포
- 실제 OpenAI·Gemini 키 단일 및 9뷰 호출
- GitHub Actions Playwright·Lighthouse 결과
- iOS Safari와 Android Chrome 실기기 확인
