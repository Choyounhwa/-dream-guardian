[BOSS-ASSAULT-REC-14]
등록: https://github.com/Choyounhwa/-dream-guardian/issues/599 | 직접 선행: REC-06 #591, REC-11 #596, REC-13 #590. 개별 승인 필수.
제목: Game 공격 표시 스냅샷 생성 복구
목적: 실제 pair/취소/도착/회피 상태를 렌더러가 추론하지 않고 읽도록 제공한다.
수정 대상:
- `dream_guardian/src/game/assault/AssaultRoundController.ts` (Game, src/config1개).
구현 내용:
- REC-13 DTO로 공급된 좌우 보기텍스트·pair/attack ID·선택잠금·쌍전체취소·오답도착·회피의 실제 판정 상태를 snapshot에 포함한다.
- 활성시간으로 throw/비행/도착 진행을 산출하고 표시상 도착과170ms 판정유예를 구분한다. 취소된 반대탄환을 새 miss/hit로 표현하지 않는다.
- 깊은 불변snapshot·동일상태 반복조회 무부작용·abort/종료표시를 보장한다. HP/완료수는 해당 권위/요약을 Core에서 합성한다.
유지 사항: Game 순수 진행·판정권위·기존 presentation 호환·문제상시표시.
변경 금지: Render/UI/Core/config 수정, Canvas직접호출, snapshot조회로 정산·입력소비.
완료 조건:
- [ ] 우측정답/취소/오답잠금→도착/timeout/회피 상태가 실제 judge결과와 일치한다.
- [ ] 반복 snapshot 조회와 renderer 모의호출 후 게임상태·명령수가 변하지 않는다.
테스트: `dream_guardian/tests/unit/assault-recovery-presentation.test.ts` 신규. Baseline→실제round 상태별 snapshot 누락 Red→최소구현 Green→전체 npm test100%Pass/build; presentation/round 회귀.
관련 파일: DOC-16; RoundController.getPresentationSnapshot; REC-13 DTO; PairJudge/SquatJudge (읽기 전용).
선행 카드: REC-06,11,13. 상태: OPEN / 개별 구현 승인 대기.
위험 방지: 정답방향을 renderer에 넘겨 거기서 판정하게 하지 않는다. 타레이어 필요 시 별도카드.
관리: DOC-16 공통 계약; 실제 완료 gh issue comment(파일/실제TDD/전체100%Pass/build/조건)·HANDOVER·Rule13 서버. 현재 실행/커밋/푸시·NEXT 이동 금지.
