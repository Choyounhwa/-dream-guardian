[BOSS-ASSAULT-REC-11]
등록: https://github.com/Choyounhwa/-dream-guardian/issues/596 | 직접 선행: REC-06 #591. 개별 승인 필수.
제목: 실측 라운드 요약·완료/중단 계약 복구
목적: 개별 모듈의 요약 집계를 실제 round 결과·receipt·활성시간과 연결할 Game 포트를 제공한다.
수정 대상:
- `dream_guardian/src/game/assault/AssaultRoundController.ts`
- `dream_guardian/src/game/assault/AssaultRoundSummary.ts` (Game, src/config2개).
구현 내용:
- Round→SummaryAggregator에 실제 pair 정오/timeout/리듬·회피 결과를 고유 attackId로 기록하고 applied receipt 수신 API를 제공한다.
- 각 라운드 활성 duration을 실측하여 불변 요약을 정상완료1/중단0·사망우선·최대1회 발행한다. 이벤트 결과와 receipt의 반영순서를 명시해 마지막피해 전 요약확정 방지.
- 기존 success-only onRoundComplete와 호환될 additive 포트로 완료의도와 요약확정을 구분한다. Core가 명령정산/HP0 확인 후 finalize/abort할 수 있게 한다.
- 요청피해가 아닌 actualDamage, 콤보/타격/완료문제 분리; stale/duplicate receipt와 finalize후 입력은 무영향.
유지 사항: Summary 불변성·HP계산/변경0·기존 집계 의미·정오와 리듬 분리.
변경 금지: Core 연결/config/저장/보상·상수 운동량·HP사본·요약에서 재차감.
완료 조건:
- [ ] 3쌍+스쿼트 실제 round 결과에서 문제완료1, 정오/timeout/회피·실제피해·시간이 일치한다.
- [ ] 강제중단/마지막치명피해는 완료0/defeated, 중복완료콜백/receipt 후에도 동일 요약객체1회.
테스트: `dream_guardian/tests/unit/assault-recovery-summary.test.ts` 신규. Baseline→실제 controller결과/receipt/완료전피해/중단/중복 Red→최소구현 Green→전체 npm test100%Pass/build; summary/round 회귀.
관련 파일: DOC-14 §§9,11; DOC-16; SummaryAggregator.ts가 아닌 실제 `AssaultRoundSummary.ts` 내부 클래스; Settlement receipt (읽기 전용).
선행 카드: REC-06. 상태: OPEN / 개별 구현 승인 대기.
위험 방지: 영수증 도착 전 성공을 추정하지 않는다. 가설 미재현이면 증거보고·계획 재승인, 다른레이어 필요 시 분리.
관리: DOC-16 공통 계약; 실제 완료 gh issue comment(TDD/전체100%Pass/build/파일/조건), HANDOVER/Rule13 서버. 현재 실행/커밋/푸시 금지·NEXT 불변.
