# ViewGrid 기여 가이드

## 개발 환경

- Node.js 22 이상
- npm 10 이상

```bash
npm ci
npm run dev
```

공급자 키를 `.env`에 넣지 마십시오. 실제 생성 검증은 UI에서 개인 키를 현재 탭에 입력해 수행합니다.

## 변경 절차

1. 작은 범위의 브랜치를 만듭니다.
2. 구조와 상태 로직을 먼저 정의한 뒤 스타일을 수정합니다.
3. UI 변경에는 키보드, 포커스, 축소 모션과 360·768·1440px 레이아웃을 함께 검토합니다.
4. API 변경에는 허용 모델, 입력 크기, 오류 정규화, 키 비노출 테스트를 추가합니다.
5. 관련 문서와 체크리스트를 갱신합니다.
6. `npm run check`, `npm run check:build`, `npm run verify:security`, `npm run audit:prod`와 가능한 경우 `npm run test:e2e`를 통과시킵니다.

## 코드 원칙

- TypeScript strict를 유지합니다.
- 공급자별 API 구현은 `src/lib/providers/`에 격리합니다.
- UI는 Pretendard와 ViewGrid 디자인 토큰을 사용합니다.
- 노란색은 핵심 액션과 중요한 상태에 제한합니다.
- 애니메이션은 opacity와 transform 중심으로 짧게 사용합니다.
- API 키, 이미지, 공급자 원문 오류를 로그에 출력하지 않습니다.
- 새 영구 저장 기능은 개인정보 문서와 위협 모델을 먼저 갱신해야 합니다.

## 커밋과 PR

PR에는 변경 목적, 사용자 영향, 테스트 결과, 스크린샷 또는 녹화, 남은 위험을 기록합니다. 보안 취약점은 공개 PR이나 이슈 대신 `SECURITY.md`의 비공개 제보 절차를 사용합니다.
