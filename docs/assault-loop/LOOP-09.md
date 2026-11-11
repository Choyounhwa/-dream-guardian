[ASSAULT-LOOP-09]
등록: https://github.com/Choyounhwa/-dream-guardian/issues/702 | 직접 선행: #695,#697,#698,#699,#700.
제목:
라운드별 루프 계획·numeric_repeat 4기회 공급 Core 조립

목적:
기존 questions.csv 문제1개/정답1개를 네 번 선택할 수 있게 기존 공급 포트를 연결한다.

수정 대상:
- `dream_guardian/src/core/AssaultSessionFactory.ts`
- `dream_guardian/src/core/AssaultLoopRoundAssembler.ts` (신규)
Core 라운드 조립 단일 책임, src/config2개.

구현 내용:
- Factory의 선택 옵션 loopProfile을 추가하고 신규 assembler가 기존 Game 빌더를 호출하여 seed+roundNumber별 계획을 시작 전1회 생성한다. **boss_assault UI는 LOOP-12에서 loop URL 없이도 이 옵션을 기본 주입**한다. 옵션이 선택적이라는 것은 범용 Factory 직접 호출 호환을 뜻하며 UI opt-in 요구가 아니다. session.compiledPlan의 고정 패턴을 새 라운드에 무조건 재사용하지 않는다. 현재라운드 읽기전용계획 공개포트를 제공한다.
- 기본 RoundSourcePort/defaultNumericRepeatSource 재사용, pairCount는 새계획의 answer_pair4개에서 산출하고 providePairs는 문제당1회. 동일문제/정답을 유지하되 보기좌우·오답은 기존 시드공급 정책 유지, pairId/attackId를 세션·라운드 범위로 매핑한다. challenge 공급은 거부/미연결.
- 신규 루프에는 difficulty answerBeats override를 적용하지 않고 answer4 고정. 선택 config/profile/seed/BPM/목표를 동결하고 다음 라운드에도 전달한다. 기존 pattern/loopProfile 충돌 시 명시오류로 원자적 거부한다.
- LOOP-07의 내부 운동량 집계 옵션을 새 루프 조립시에 전달한다(boss_assault UI 기본 경로 포함). 추가 사용자 opt-in은 없다. 범용 Factory 직접 호출의 기존 summary 출력은 보존한다.
- LOOP-04 옵션·LOOP-06 요약·기존 ProgressController를 연결한다. run 종료/abort/dispose에서 기존 TTS cancel 포트를 사용, 재발화/추가대기0.
- 정산 receipt→권위 HP검사→사망시 즉시 abort→요약→진행 순서를 보장한다. 같은 큰dt 안에서 사망뒤 후속명령/다음문제0. 생존10문제까지만 완료, 결전/승리/보상 활성화0.
- Factory 현930줄이므로 신규 조립 책임은 assembler에 배치하고 두파일 모두1,000줄 미만. 기존 정상 조립을 대규모 이전하지 않는다.

유지 사항:
REC-04/07/10/12의 공급·시계·멱등정산·직립상태 인계, targetRounds10 및 HP100/10/5, loopProfile 없는 범용 Factory 직접 호출 출력·비boss legacy·기존 패턴 데이터. boss_assault UI 기본 선택은 LOOP-12에서 새 루프로 바꾼다.

변경 금지:
Question/Game/Storage/config/WireHelper 수정, CSV변경/챌린지로더 구현(#658~660), fake정답42 대체를 신규 요구 해결에 사용, 전체정답 강제, G4/G5/마나 자동연결.

완료 조건:
- [ ] 라운드마다 계획1회/문제공급1회/기회4, 고유ID·원점·시드 재현·정답유지.
- [ ] 혼합결과 생존시 다음문제, 최종휴식까지 완료1회, HP0즉시중단/11번째문제0.
- [ ] loopProfile 미지정 **범용 Factory 직접 호출**은 동등하고 UI에서는 LOOP-12가 새 프로필을 기본 주입한다는 경계를 검증한다. 원자적오류/전체100%Pass/build,1,000줄 미만.

테스트:
신규 `dream_guardian/tests/unit/assault-loop-factory.test.ts`. Baseline npm test → `npx vitest run tests/unit/assault-loop-factory.test.ts` Red(라운드별loop 조립 부재) → 별도 최소 Green → 전체 npm test/npm run build. source spy(pairCount4/호출1), 두round시드/ID, 옵션충돌, TTS취소, 초기HP10/큰dt/최종사망·10라운드 검증. Pass/Fail 분리.

관련 파일:
DOC-19; REC #597/#604/#598/#607, #660(챌린지 보류), `AssaultAnswerPairFactory.ts` 및 `questions.csv` (읽기 전용).

선행 카드: LOOP-02,04,05,06,07. 상태: OPEN / 개별 구현 승인 대기.
관리: allowlist 밖 변경 중단. 실제완료 Rule12 gh issue comment(파일/실제TDD/전체100%Pass/build/조건), HANDOVER, Rule13 npm run dev·http://localhost:3000/. 커밋 명시요청 시만. 현재 구현/테스트/빌드/커밋/푸시/PR/서버 금지.
