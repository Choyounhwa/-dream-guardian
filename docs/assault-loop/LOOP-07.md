[ASSAULT-LOOP-07]
등록: https://github.com/Choyounhwa/-dream-guardian/issues/700 | 직접 선행: #694.
제목:
러닝 실측 입력 운동량 집계 포트 추가

목적:
러닝8박이라는 계획을 실제 걸음8회로 위조하지 않고 측정된 입력만 집계한다.

수정 대상:
- `dream_guardian/src/game/assault/AssaultExerciseTally.ts`
Game 운동량 단일 책임, src/config1개.

구현 내용:
- loop 전용 내부 집계 옵션과 recordRunStep 공개포트를 추가한다. boss_assault UI 기본 루프의 Core 조립에서 활성화하며 사용자에게 추가 loop URL/opt-in을 요구하지 않는다. inputId/roundId·유효성·활성시각 증거로 실측걸음만 멱등 집계한다.
- 기존 getSummary/legacy patch 필드집합은 기본옵션에서 그대로 유지. 새 루프 측정치는 별도 읽기 전용 getLoopExerciseSummary 포트로 반환해 저장 validator를 깨뜨리지 않는다.
- 활성운동시간은 기존 clock포트 재사용, run/rest/공격의 계획길이와 실제동작횟수를 분리한다. 총칼로리 미지원(kcalSupported=false/estimatedKcal=null) 정책 유지; 이번 카드에서 running/punch 신규계수나 총kcal를 확정하지 않는다.

유지 사항:
펀치/스쿼트/가드 집계·중복차단·partialSquatKcal 및 기존 summary 출력.

변경 금지:
Core/Motion/UI/Storage/config 수정, 계획8박을8걸음으로 산입, HP/보상/성장 연동.

완료 조건:
- [ ] 유효 실제 runStep만 집계, duplicate/invalid입력0증가, reset/새세션 독립.
- [ ] 기본 출력 필드집합 불변, 새 포트 동결 및 실측시간/동작 분리.
- [ ] 전체100%Pass/build,1,000줄 미만.

테스트:
신규 `dream_guardian/tests/unit/assault-loop-exercise.test.ts`. Baseline npm test → `npx vitest run tests/unit/assault-loop-exercise.test.ts` Red(실측러닝 포트 부재) → 별도 최소 Green → 전체 npm test/npm run build. 유효0/3회, 중복ID/다음round, 기본요약동등, kcal미지원 검증. Pass/Fail 분리.

관련 파일:
DOC-19; #546, REC-11 #596, ExerciseTally 공개포트, GDD 운동량 원칙 (읽기 전용).

선행 카드: LOOP-01. 상태: OPEN / 개별 구현 승인 대기. 실제 배선은 LOOP-10/11.
관리: 범위 밖 중단. 실제 완료 Rule12 gh issue comment(구현/파일/TDD/전체100%Pass/build/조건), HANDOVER, Rule13 npm run dev·http://localhost:3000/. 커밋 별도 요청. 현재 구현/테스트/빌드/커밋/푸시/PR/서버 금지.
