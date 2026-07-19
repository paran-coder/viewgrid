# 이미지 모델 변경 대응 가이드

## 변경 지점

- 모델 목록과 공급자 매핑: `src/lib/providers/models.ts`
- OpenAI 요청·응답: `src/lib/providers/openai.ts`
- Gemini 요청·응답: `src/lib/providers/gemini.ts`
- 허용 스키마: `/api/connection`, `/api/generate`
- UI 모델 설명: `src/components/api-settings-dialog.tsx`
- 카메라 프롬프트: `src/lib/camera-prompt.ts`

## 추가 또는 교체 절차

1. 공급자의 공식 API 문서에서 모델 ID, 이미지 입력 수, 출력 형식, 가격과 폐기 일정을 확인합니다.
2. `ImageModelId` 타입과 `MODEL_DEFINITIONS`를 갱신합니다.
3. 공급자 어댑터의 endpoint, 인증, 이미지 순서와 응답 파싱을 갱신합니다.
4. 원본→가이드→참조 역할 순서가 유지되는지 테스트합니다.
5. 출력 MIME과 Vercel 응답 한도를 확인합니다.
6. 401, 403, 429, 5xx와 스키마 오류가 정규화되는지 확인합니다.
7. Mock 단위 테스트와 개인 키 단일 호출을 실행합니다.
8. 최소 3개 대표 입력으로 원본 단독·가이드·참조 A/B를 비교합니다.
9. README, 사용자 매뉴얼, 개인정보 안내와 변경 기록을 갱신합니다.

## 폐기 대응

모델이 폐기되면 UI에서 선택을 제거하기 전에 기존 프리셋 로드 시 안전한 대체 모델로 정규화되는지 확인합니다. 공급자 변경을 자동으로 수행하지 말고 사용자에게 명확히 알립니다.
