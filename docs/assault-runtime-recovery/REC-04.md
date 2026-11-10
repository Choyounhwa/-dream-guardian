[BOSS-ASSAULT-REC-04]
등록: https://github.com/Choyounhwa/-dream-guardian/issues/597 | 직접 선행: REC-02 #592, REC-03 #593, REC-05 #594, REC-06 #591. 개별 승인 필수.
제목: 시드 보기 공급·목표 설정 Core 조립
목적: 이미 생성된 문제의 정답값으로 반복 보기 쌍을 공급하고 동일한 승인 목표를 런타임에 주입한다.
수정 대상:
- `dream_guardian/src/core/AssaultSessionFactory.ts` (Core, src/config 1개).
구현 내용:
- REC-03 설정을 소비해 세션/progress의 목표를 같은 값으로 주입하고 유효 옵션 override를 원자 검증한다. 5→10 무단 변경 금지.
- 기존 AssaultAnswerPairFactory 공개 API에 seed/roundId/questionId/필요 pairCount/이미 확정된 correctAnswer를 전달한다. 생성 결과를 REC-06 Game 포트의 encounter별 pairId/correctSide/표시 라벨에 연결한다.
- REC-02 정규화 문제와 REC-05 읽기 메타데이터 전달. pair별 수학 문제 재생성·Math.random 재호출 금지. 좌우강제교대 금지.
유지 사항: Question 레이어의 오답/동치 배제 권위, 원본 계획/문제 불변, legacy 경로.
변경 금지: Question/Game/config 타입 내부 수정, seed를 숨겨 재현 불가로 만들기, 보상·보스 HP 실차감.
완료 조건:
- [ ] 같은 문제/seed에서 동일한 쌍 순서, 우측정답도 실제 판정 포트에 도달한다.
- [ ] 각 쌍에 유일정답1개, 모든 encounter에 정확한 pair 매칭, 원본 문제생성 호출 증가0.
- [ ] 목표 설정·override가 세션과 progress에서 일치하며 invalid 값은 부분 세션 없이 거부된다.
테스트: `dream_guardian/tests/unit/assault-recovery-factory.test.ts` 신규. Baseline→우측정답/seed/target/읽기전달/원자실패 Red→최소 구현 Green→전체 npm test100%Pass/build; 기존 answer-pairs/bootstrap 회귀.
관련 파일: DOC-16; Factory:370~387; AssaultAnswerPairFactory.ts 공개 계약; RoundController (읽기 전용).
선행 카드: REC-02, REC-03, REC-05, REC-06. 상태: OPEN / 개별 구현 승인 대기.
위험 방지: 하위 레이어 추가 변경 필요 시 즉시 별도 카드/재승인. 생성 문제를 재계산하여 정답이 바뀌는 우회 금지.
관리: DOC-16 공통 계약; 실제 완료 후 gh issue comment(파일/실제TDD/전체100%Pass/build/조건), HANDOVER/Rule13 서버 안내. 현재 테스트/서버/커밋/푸시/NEXT 이동 금지.
