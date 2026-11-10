[BOSS-ASSAULT-REC-26]
등록: https://github.com/Choyounhwa/-dream-guardian/issues/614 | 직접 선행: #515, #517 완료 이력 참고. 개별 승인 필수.
제목: 스쿼트 직립 복귀·가드 판정 상태 계약 검증
목적: 조우마다새판정기를만드는경로에서직립세대소비가끊기는지검증하고자세증거를보존한다.
수정 대상:
- `dream_guardian/src/game/assault/AssaultRoundController.ts`
- `dream_guardian/src/game/assault/AssaultSquatJudge.ts` (Game, src/config2개).
구현 내용:
- RoundController.submitSquat의축약posture/standGeneration=0/가짜deltaY구성과새SquatJudge생성경로를검증한다. 실제유효성·정규화증거·직립세대를수신할additive포트로보존한다.
- 한직립세대는한회피에만소비하며계속앉기/가드유지로다음공격자동성공0. 라운드경계를넘는소비상태를Core가보관/재주입할읽기전용포트를제공하고손/직립강제reset은하지않는다.
- 승인저충격가드는같은회피계약의증거로취급하고미승인동작을추가하지않는다. 스쿼트성공이이전오답피해를취소하지않는다.
유지 사항: 기존Motion어댑터단위/임계값·Game순수성·HP직접변경0·접근피해5.
변경 금지: Motion/Input/Core/config수정, 가드/스쿼트임계값후보확정, 추적복구시가짜직립세대생성.
완료 조건:
- [ ] 실제자세결과의isValid/standGeneration을손실없이소비, 무효추적/가짜축약결과로회피성공0.
- [ ] 연속두스쿼트·가드유지·다음라운드에서직립복귀없이다시성공0; 복귀후새유효세대만성공.
테스트: `dream_guardian/tests/unit/assault-recovery-squat-round.test.ts` 신규. Baseline→새judge간상태소실·실제자세fixture·가드/계속앉기/라운드경계 Red(재현시)→최소구현 Green→전체 npm test100%Pass/build. 미재현이면임의수정없이증거보고.
관련 파일: DOC-14 A12/A13; DOC-16; RoundController:481~518,670~688; SquatJudge.state.consumedGenerations; Squat/GuardAdapter실제결과 (읽기전용).
선행 카드: #515/#517 완료이력참고. 상태: OPEN / 개별구현승인대기.
위험 방지: Core소비연결은REC-09/12로분리. Input/Motion포트부족시별도카드/승인필수.
관리: DOC-16공통계약; 실제완료 gh issue comment(원인/파일/실제TDD/전체100%Pass/build/조건)·HANDOVER·Rule13서버. 현재실행/커밋/푸시·NEXT이동금지.
