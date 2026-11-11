[ASSAULT-LOOP-04]
등록: https://github.com/Choyounhwa/-dream-guardian/issues/697 | 직접 선행: #694,#695,#696.
제목:
명시 구간 루프 활성시계 진행과 8박 내 읽기·TTS 통합

목적:
투척1초/별도 읽기 가산 없이 총36/40박만 진행하는 선택적 실행 경로를 제공한다.

수정 대상:
- `dream_guardian/src/game/assault/AssaultRoundController.ts`
- `dream_guardian/src/game/assault/AssaultLoopTimeline.ts` (신규)
- `dream_guardian/src/game/assault/AssaultRoundTypes.ts`
Game 시간 진행 단일 책임, src/config3개.

구현 내용:
- LOOP-02의 불변 계획을 내부 선택 옵션으로 주입하고 신규 타임라인이 구간/경계/완료시각 권위를 가진다. 미주입 **Controller/범용 Factory 직접 호출**은 기존 그대로 보존한다. boss_assault UI 시작/restart는 LOOP-12 Core가 추가 loop URL 없이 이 계획을 기본 주입하므로 UI 미지정=구형동작이라는 뜻이 아니다.
- run_question 8박 안에서 처음부터 문제 가독성/TTS1회 보장. 기존 1초 투척은 이 경로에서 추가대기0(삭제/즉시 고정 표시), calculateReadingDurationSeconds 결과를 재가산하지 않는다. 늦음/실패/종료 없는 TTS도 시간 진행을 막지 않는다. run 종료 신호를 제공해 Core가 필요시 발화를 취소한다.
- answer4는 조기 선택에도 고정, rest2 네 번 완료 후에만 라운드 완료 신호1회. encounter 종료가 전체 라운드 종료라는 기존 가정을 새 경로에서는 사용하지 않는다.
- 최초 준비/중단/추적손실/재개는 기존 안전시계와 협력. 무중단 기본길이36/40박과 안전 재준비로 실제 늘어난 시간을 구분한다. 재개 시 미확정 공격만 기존1박 준비 정책을 적용하고 이후 전체 구간 및 마지막휴식도 같은 delta로 이동한다. run/rest 재개는 남은구간 보존, TTS재발화0.
- 긴 dt에도 시간순으로 경계 처리; 외부 사망/abort 후 후속 경계·완료·공격 실행0. Game은 HP를 소유하지 않으며 Core의 abort를 소비한다.

유지 사항:
legacy controller 경로/읽기 계산, pause 중 시간동결, 기존 정산 명령·판정기 공개 계약, 사망 최우선.

변경 금지:
PairJudge·Motion·Core·config·UI/Render 수정, run8을 동작8회 대기 게이트로 변경, 타이머/새 게임루프, 새 보상/마나/결전.

완료 조건:
- [ ] t0~8박 run1회, 추가 투척/읽기대기0, 최종rest 끝에서만 완료1회.
- [ ] 무중단36/40박; pause제외/재준비 별도 기록, 다중경계/abort 이후 실행0.
- [ ] 기존 옵션 미주입 동등, 소스1,000줄 미만, 전체100%Pass/build.

테스트:
신규 `dream_guardian/tests/unit/assault-loop-timeline.test.ts`. Baseline npm test → `npx vitest run tests/unit/assault-loop-timeline.test.ts` Red(계획 옵션/구간 실행 부재) → 별도 최소 Green → 전체 npm test/npm run build. TTS throw/무응답/늦음, 연속update, early답, 마지막휴식 직전/정각, pause/run/rest/squat 재개, 큰dt/abort fixture 검증. Pass/Fail 분리.

관련 파일:
DOC-19; REC-05 #594(기존 additive 읽기 유지), REC-08 #595, REC-09 #606 (읽기 전용).

선행 카드: LOOP-01,02,03. 상태: OPEN / 개별 구현 승인 대기. 입력창 세부 검증은 LOOP-05, 요약은 LOOP-06, 실제 Core 연결은 LOOP-09 이후.
관리: 4번째 파일 필요 시 중단·카드분리. 실제 완료 Rule12 gh issue comment(TDD/파일/전체100%Pass/build/조건), HANDOVER, Rule13 서버·http://localhost:3000/. 커밋 명시 요청 시만. 현재 구현/테스트/빌드/커밋/푸시/PR/서버 금지.
