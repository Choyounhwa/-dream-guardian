[BOSS-ASSAULT-REC-10]
등록: https://github.com/Choyounhwa/-dream-guardian/issues/598 | 직접 선행: REC-11 #596. 개별 승인 필수.
제목: 정산 실행 단일 경로·영수증 전달 복구
목적: 멱등성에 의존한 이중 settle 진입을 제거하고 실제 적용 영수증을 Game 집계에 전달한다.
수정 대상:
- `dream_guardian/src/core/AssaultSessionFactory.ts`
- `dream_guardian/src/core/AppBootstrap.ts` (Core, src/config2개).
구현 내용:
- Factory onSettlementCommand→settle 및 App update drain→settle 두 진입을 계측하고 **실행 소유자 한 곳**을 정한다. 콜백/큐 중 하나만 실제 settle을 호출한다.
- 명령별 receipt를 REC-11 Game 수신 포트에 전달한다. applied=true 실제 receipt만 집계하고 stale/duplicate/invalid는 기록/폐기한다.
- 정산→HP0 확인→중단/완료요약→진행 순서를 연결한다. 요약 처리에서 HP를 재차감하거나 권위HP를 복제하지 않는다.
유지 사항: AssaultSettlement 멱등 방어, BattleState/BossController 단일권위, 접근피해10/5·보스HP불변.
변경 금지: Game 정산기/요약 내부 수정, BattleState.onWrong/onCorrect 사용, 보상·마나 지급, private HP 쓰기 추가.
완료 조건:
- [ ] 고유명령1개당 settle 호출1·자원적용1·applied receipt집계1 (중복방어 자체는 별도 유지).
- [ ] HP상한/치명피해의 실제차이만 요약에 반영, 중복/stale receipt집계0·요약재차감0.
- [ ] 완료콜백이 update 도중 와도 최종명령/HP0를 처리하기 전에 진행하지 않는다.
테스트: `dream_guardian/tests/unit/assault-recovery-settlement-wiring.test.ts` 신규. Baseline→두 settle 호출 spy/receipt실측/마지막HP0/콜백재진입 Red→최소구현 Green→전체 npm test100%Pass/build. 이중차감 발생은 재현 전 단정하지 않는다.
관련 파일: DOC-16; Factory:385~386; AppBootstrap:554~558; AssaultSettlement/REC-11 Game 포트 (읽기 전용).
선행 카드: REC-11. 상태: OPEN / 개별 구현 승인 대기.
위험 방지: 명령큐를 비웠다는 이유로 Game완료/피해를 누락하지 않는다. 타레이어 필요 시 중단·분리.
관리: DOC-16 공통 계약; 실제 완료 gh issue comment(파일/TDD/전체100%Pass/build/조건), HANDOVER 및 Rule13 서버. 현재 테스트/서버/커밋/푸시·NEXT 이동 금지.
