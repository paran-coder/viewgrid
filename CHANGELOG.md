# Changelog


## 1.1.4

- 로컬 카메라 가이드의 API 사용 토글과 라벨이 겹치던 문제 수정
- 라벨과 스위치를 독립된 두 열로 배치
- 스위치 손잡이가 트랙 밖으로 나오지 않도록 overflow와 이동 범위 보정

## 1.1.1

- 업로드 이미지의 실제 렌더링 크기와 비율을 기준으로 오비트 중심과 반경을 계산하도록 수정
- 세로·가로·정사각 이미지에서 궤도가 이미지 중심을 벗어나는 문제 수정
- 편집기 크기 변경 시 ResizeObserver로 이미지와 궤도를 자동 재정렬
- 이미지 표시 영역과 카메라 궤도를 하나의 공통 좌표계로 통합

# 변경 기록

이 프로젝트는 의미 있는 사용자 변경을 버전별로 기록합니다.

## [1.0.1] - 2026-07-19

### Fixed

- Replaced the flat 3×3 camera marker layout with a subject-centered orbit visualization.
- Camera markers now move from their Yaw, Pitch, and Distance values and can be dragged to update Yaw/Pitch.
- Added three orbit rings, depth scaling, and front/back visual ordering for clearer spatial editing.
- Prevented the local guide API switch label from overlapping its toggle on narrow layouts.
- Added orbit projection regression tests.

## 1.0.0 — 2026-07-19

### 추가

- 9개 가상 카메라와 Yaw·Pitch·Roll·FOV·Distance 편집
- OpenAI GPT Image 2 및 Google Gemini 이미지 모델 사용자 키 연결
- 활성 카메라 순차 생성, 중단, 재시도와 결과 상태
- 로컬 카메라 가이드와 원본·가이드·인접 결과 다중 입력
- 중앙 기준 멀티뷰 생성 순서와 인접 참조 계보
- 1,024×1,024 출력 정규화, 3×3 PNG와 ZIP 내보내기
- JSON 프리셋과 탭 단위 비민감 설정 복구
- PWA 앱 셸, 오프라인 상태 안내와 설치 지원
- 이미지 전처리 Worker와 메인 스레드 폴백
- CSP·HSTS·Permissions Policy·출처 검증·요청 ID·속도 제한
- 보안·개인정보·배포·운영·접근성·기여 문서

### 변경

- 프로젝트 상태를 Stage 5 후보에서 정식 1.0.0으로 전환
- Next.js 내장 PostCSS를 8.5.10으로 고정해 알려진 중간 등급 취약점 제거
- 확대 모달 Escape·포커스 트랩·포커스 복귀 적용
- 모바일 터치 대상과 결과 이미지 지연 디코딩 보완

### 알려진 한계

- 생성 각도는 수학적으로 보장되는 3D 렌더가 아닙니다.
- 실제 공급자 품질과 비용은 모델 정책 및 입력에 따라 달라집니다.
- 프로덕션 Vercel 배포와 개인 공급자 키 라이브 호출은 저장소 소유자가 별도로 검증해야 합니다.