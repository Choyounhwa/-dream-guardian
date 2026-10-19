[BOSS-ASSAULT-REC-02]
등록: https://github.com/Choyounhwa/-dream-guardian/issues/592 | 직접 선행: REC-01 #589. 상태: DONE (구현 완료).
제목: 문항 정규화와 원자적 진입 복구
목적: 실제 준비→접근전 경로에서 문항 텍스트·식별자·정답·읽기 메타데이터가 손실되지 않도록 조립한다.
수정 대상:
- `dream_guardian/src/core/AssaultSessionFactory.ts`
- `dream_guardian/src/core/AppBootstrap.ts` (Core, src/config 합계2개).
구현 내용:
- REC-01 포트(`getPoolSnapshot()`)를 사용해 선택된 문항만 가져오고, 템플릿은 `generateQuestion()`으로 1회 생성하여 shapeCode/level/subLevel/id를 보존해 기존 적격성 필터에 전달.
- Factory 중심으로 `createRoundController`에서 `questionText`를 RoundController의 `{id, text}`로 정규화하고 정답값/minReadSeconds/유형/선택지 보존.
- 하드코딩 예제 대체(가짜 5문제)를 제거하고, 적격 0개 시 `AssaultSessionValidationError`를 발생시키며 `startAssaultPhase()`가 `ASSAULT_ROUND`로 전이되지 않고 상태를 안전하게 보존.
유지 사항: #587의 READY_POSITION→ASSAULT_ROUND 및 screenMode 연결, CSV/기존 문제 생성 의미·legacy 기본.
변경 금지: Question/Game/Render/UI/config 수정, 문항 재생성을 pair마다 호출, 타입 강제 캐스트로 텍스트 누락 은폐.
완료 조건:
- [x] 실제 준비 경로에서 텍스트 undefined가 없고 원본식별자·도형 제외·선택범위가 유지된다.
- [x] 적격0이면 HP/구독/세션 상태를 남기지 않고 기존 오류 표시 포트에 이유를 전달한다.
- [x] 하나의 문제 인스턴스 생성 횟수1, 보기 교체 시 추가 생성0.
테스트: `dream_guardian/tests/unit/assault-recovery-question-wiring.test.ts` 신규 (5개 테스트 100% Pass, 회귀 테스트 및 npm run build 통과).
관련 파일: DOC-14 §15 A5/A6/D3; DOC-16; AppBootstrap.ts:447~500,2011~2017; Factory:276~284; RoundController:58~63 (읽기 전용).
선행 카드: REC-01. 상태: DONE / 구현 및 검증 완료.
위험 방지: 단일 Core 레이어 2개 파일 수정(AppBootstrap.ts, AssaultSessionFactory.ts)으로 범위 준수.
관리: DOC-16 공통 계약 적용. gh issue comment 및 Rule13 안내 완료.
