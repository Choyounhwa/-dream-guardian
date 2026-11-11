[ASSAULT-LOOP-11]
등록: https://github.com/Choyounhwa/-dream-guardian/issues/704 | 직접 선행: #700,#702,#703.
제목:
러닝8박 전용 실측 동작·폴백 소유권 Core 전달

목적:
기존 러닝 감지기를 재사용하되 legacy BeatRun/전투 입력과 중복 소비하지 않는다.

수정 대상:
- `dream_guardian/src/core/director/SceneMotionCoordinator.ts`
- `dream_guardian/src/core/director/AssaultSceneHandler.ts`
- `dream_guardian/src/core/bootstrap/AssaultInputRouter.ts`
Core 러닝 이벤트 전달 단일 책임, src/config3개.

구현 내용:
- 이미 계산하는 activeDetector stepped 결과를 assault handler→session/router의 공개 러닝포트로 전달한다. 새 detector/임계값·MotionIntentType을 만들지 않는다. 기존 MotionIntentBus의 ASSAULT_ROUND jump/step 공격금지는 그대로 둔다.
- 루프 run_question8박에서만 실제러닝을 LOOP-07 recordRunStep에 기록한다. 유효inputId/round/session·활성시각으로 중복차단. run/rest/선택창별 소유권을 분리해 legacy totalSteps/BeatRun/마나/전투공격 동시소비0.
- 신규 루프 run 동안 기존 fallback의 left/right punch 동작을 runStep 증거로만 변환, answer동안은 기존답안, squat동안은 기존회피를 사용한다. hold/repeat는 기존어댑터차단 유지. 새 키매핑0, UI에 현재행동 안내는 LOOP-15 담당.
- run8은 시간슬롯이며 러닝실패로 무기한 연장/추가피해0. 실측0걸음도0으로 보고. 추적손실/정지/재준비중 fake걸음0.
- SceneHandler의 기존 update 경로에서 exerciseTally.syncWithClock 공개포트로 세션 활성시간을 전달한다. round 원점이 바뀌어도 시간을0으로 되돌리거나 dt를 중복가산하지 않는다. 측정 수신은 기존 session.exerciseTally 공개포트를 사용하며 Factory/Wire에 별도 신규포트를 요구하지 않는 최소 배선을 우선한다.
- 함수/포트가 필요한 경우 이3개 파일 내 합성·위임으로 제공한다. WireHelper4번째파일 필요시 중단·분리승인.

유지 사항:
legacy running 감지/기록과 결전동작 소유권, MotionIntentBus 필터/RunDetector 구현, 4색커서/스켈레톤 출력.

변경 금지:
Motion/Input/config/Game/타입전역 union 변경, jump/step를 assault 공격으로 소비, 8박=8걸음 위조, 칼로리·보상 추가.

완료 조건:
- [ ] 실제run/fallback가 run8에서만 집계, 동시 legacy 소비0, 정지/홀드/중복0.
- [ ] 무동작이어도8박 뒤 진행, 답안·스쿼트 입력과 분리, 다른모드동등.
- [ ] 전체100%Pass/build,1,000줄 미만.

테스트:
신규 `dream_guardian/tests/unit/assault-loop-running-routing.test.ts`. Baseline npm test → `npx vitest run tests/unit/assault-loop-running-routing.test.ts` Red(러닝포트 미배선) → 별도 최소 Green → 전체 npm test/npm run build. detector spy/run0·3걸음/같은ID/키repeat·touch-release/경계·pause/legacy불변 검증. Pass/Fail 분리.

관련 파일:
DOC-19; `motion/MotionIntentBus.ts`, `config/judgment.config.ts` ASSAULT_ROUND ownership, `RunDetector.ts`, #675 (읽기 전용).

선행 카드: LOOP-07,09,10. 상태: OPEN / 개별 구현 승인 대기.
관리: 범위 밖 수정 중단. 실제완료 Rule12 gh issue comment(구현/파일/TDD/전체100%Pass/build/조건), HANDOVER, Rule13 서버·http://localhost:3000/. 커밋 별도요청. 현재 구현/테스트/빌드/커밋/푸시/PR/서버 금지.
