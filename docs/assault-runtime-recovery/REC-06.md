[BOSS-ASSAULT-REC-06]
등록: https://github.com/Choyounhwa/-dream-guardian/issues/591 | 직접 선행: #514, #517. 상태: DONE (구현 완료).
제목: 답 쌍 조우 판정·도착 생명주기 복구
목적: Game 라운드가 공급받은 보기 쌍의 실제 정답 방향과 쌍 단위 도착/취소 의미를 소비하게 한다.
수정 대상:
- `dream_guardian/src/game/assault/AssaultRoundController.ts` (Game, src 1개).
구현 내용:
- encounter별 불변 pair 입력 포트(`correctSide`, `correctAnswerSide`, `options.pairs`)를 명시하고 무조건적인 left 폴백 제거(strictCorrectSide 시 명시 예외).
- 정답 시 `boss_negate` 1건 발행 및 도착/마감 시 추가 피해/timeout 0건 보장.
- 오답 시 `wrong_locked` 및 `player_damage(miss)` 1건 발행, 이후 반대 손 입력 무시 및 마감 시 추가 timeout 중복 0건 보장.
- 미선택 시 arrival 시각에는 피해가 없고, lateGrace 마감(deadline) 초과 시점에 timeout 피해 1건 정확히 발행.
- 양손 동시 타격(simultaneousPunchGraceMs 이내) 시 단일 손 잠금을 롤백하고 conflict 보류 후 마감 전 재시도 허용.
- inputId 1회 귀속 멱등성 및 동일 deadline 입력 우선(priority 2 < 3) 정렬 보장.
유지 사항: 손↔같은쪽 답 계약, 정오와 리듬 분리, 기존 HP 정산 권위·손회수 상태.
변경 금지: Core/Question/config 수정, HP 직접변경, 쌍을 좌우 독립 miss로 계산, 스쿼트 성공으로 이전피해 취소.
완료 조건:
- [x] 우측정답/정답후도착0피해/오답후반대손무시/미선택1피해/양손보류가 라운드 경유로 검증된다.
- [x] 유예 마감 직전·동일·직후와 프레임누락에서도 정산명령 누락·중복0.
테스트: `dream_guardian/tests/unit/assault-recovery-pair-round.test.ts` 신규 (7개 테스트 100% Pass, 기존 pair-judge/round 회귀 100% Pass, npm run build 성공).
관련 파일: DOC-14 §7/§5.3; DOC-16; RoundController:481~501,698~720; PairJudge 공개 API.
선행 카드: #514/#517 완료 이력 참고. 상태: DONE / 구현 및 검증 완료.
위험 방지: 단일 Game 레이어 파일(`AssaultRoundController.ts`)만 수정하여 범위 준수.
관리: DOC-16 공통 계약 적용. gh issue comment 및 Rule13 안내 완료.
