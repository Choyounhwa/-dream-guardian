[ASSAULT-LOOP-06]
등록: https://github.com/Choyounhwa/-dream-guardian/issues/699 | 직접 선행: #697,#698.
제목:
마지막 휴식 기준 완료1문제·실측 시간 요약 정합화

목적:
선택기회4개와 완료문제1개를 분리하고 4번째 답 직후 조기 완료를 막는다.

수정 대상:
- `dream_guardian/src/game/assault/AssaultRoundController.ts`
- `dream_guardian/src/game/assault/AssaultRoundSummary.ts`
Game 요약 단일 책임, src/config2개.

구현 내용:
- 새 루프 완료는 마지막rest2 종료+정산 확인 후1문제. 맞힌 횟수0~4와 무관하며 생존하면 진행한다. 사망/중단은 완료문제0, 실제 시도/피해/시간만 보존한다.
- attemptedAnswerHits는 판정된4기회(완주), totalEncounters는 answer4+squat N(5/6)만 센다. run/rest는 정답타격/회피/조우에 산입하지 않는다.
- 완료 callback 전에 실제 경계 활성시간을 summary에 반영한다. 큰dt의 overshoot를 완료 뒤 시간으로 부풀리지 않고 pause제외·재준비 포함 실측시간을 기록한다. 중복 finalize 멱등 유지.
- 기존 summary 필드집합·저장 검증 호환을 유지한다. 별도 exercise/run 데이터는 LOOP-07로 분리하며 저장스키마를 묵시 확장하지 않는다.

유지 사항:
receipt기반 실제피해/중복정산차단, 기존 요약 API/필드집합, 기존 ProgressController의 사망우선/targetRounds10.

변경 금지:
Storage/Core/config/ProgressController 수정, 보상/마나/결전, 전부정답 조건, 가짜 기회/운동량 통계.

완료 조건:
- [ ] 마지막선택 직후 completedQuestions0, 마지막휴식 후1, abort/death0.
- [ ] 완주 기회4/조우5또는6, 요약시간18/20초(120BPM무중단), overshoot0.
- [ ] 기존요약/필드집합동등, 전체100%Pass/build,1,000줄 미만.

테스트:
신규 `dream_guardian/tests/unit/assault-loop-summary.test.ts`. Baseline npm test → `npx vitest run tests/unit/assault-loop-summary.test.ts` Red(마지막휴식/완료경계 요약 미지원) → 별도 최소 Green → 전체 npm test/npm run build. 0~4정답/혼합결과/마지막피해사망/중간abort/정각·긴dt/중복완료 검증. Pass/Fail 분리.

관련 파일:
DOC-19; REC-11 #596, REC-12 #607, `AssaultResultStore.ts` countKeys/roundKeys 검증 (읽기 전용).

선행 카드: LOOP-04,05. 상태: OPEN / 개별 구현 승인 대기.
관리: 범위 초과 중단. 실제 완료 Rule12 gh issue comment(파일/TDD/전체100%Pass/build/조건), HANDOVER, Rule13 서버·http://localhost:3000/. 커밋 명시 요청 시만. 현재 구현/테스트/빌드/커밋/푸시/PR/서버 금지.
