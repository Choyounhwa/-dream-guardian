[BOSS-ASSAULT-REC-02]
등록: https://github.com/Choyounhwa/-dream-guardian/issues/592 | 직접 선행: REC-01 #589. 개별 승인 필수.
제목: 문항 정규화와 원자적 진입 복구
목적: 실제 준비→접근전 경로에서 문항 텍스트·식별자·정답·읽기 메타데이터가 손실되지 않도록 조립한다.
수정 대상:
- `dream_guardian/src/core/AssaultSessionFactory.ts`
- `dream_guardian/src/core/AppBootstrap.ts` (Core, src/config 합계2개).
구현 내용:
- REC-01 포트를 사용해 선택된 문항만 가져온다. 생성이 필요한 템플릿은 QuestionEvaluator 공개 API로 1회 생성하고 shapeCode/level/subLevel/id를 보존해 기존 적격성 필터에 전달한다.
- Factory 중심으로 `questionText`를 RoundController의 `{id,text}`에 변환하고 정답값/minReadSeconds/유형을 보존한다. AppBootstrap은 공급/시작 연결만 한다(DOC-14 D3).
- 0개/지원외/생성 실패는 설명 가능한 진입 오류로 반환하고 하드코딩 예제 대체·부분 세션·legacy 자동 전환을 제거한다. 레거시 기본 fallback은 수정하지 않는다.
유지 사항: #587의 READY_POSITION→ASSAULT_ROUND 및 screenMode 연결, CSV/기존 문제 생성 의미·legacy 기본.
변경 금지: Question/Game/Render/UI/config 수정, 문항 재생성을 pair마다 호출, 타입 강제 캐스트로 텍스트 누락 은폐.
완료 조건:
- [ ] 실제 준비 경로에서 텍스트 undefined가 없고 원본식별자·도형 제외·선택범위가 유지된다.
- [ ] 적격0이면 HP/구독/세션 상태를 남기지 않고 기존 오류 표시 포트에 이유를 전달한다.
- [ ] 하나의 문제 인스턴스 생성 횟수1, 보기 교체 시 추가 생성0.
테스트: `dream_guardian/tests/unit/assault-recovery-question-wiring.test.ts` 신규. Baseline→실제 준비콜백/템플릿/후보0·도형·서브레벨 fixture Red→최소구현 Green→전체 npm test100%Pass/build 및 assault-boot-bug 회귀. 현재 실행 금지.
관련 파일: DOC-14 §15 A5/A6/D3; DOC-16; AppBootstrap.ts:447~500,2011~2017; Factory:276~284; RoundController:58~63 (읽기 전용).
선행 카드: REC-01. 상태: OPEN / 개별 구현 승인 대기.
위험 방지: 오류 UI 내부 수정 필요 시 별도 UI 카드로 중단·분리. 단일 Core/2파일 밖 확장 금지.
관리: 실제 완료 후 gh issue comment(변경파일/Red·Green/전체100%Pass/build/조건), HANDOVER 최소 증거, Rule13 npm run dev/http://localhost:3000/. 현재 커밋/푸시·테스트·서버 금지, NEXT 불변. DOC-16 공통 계약 적용.
