[BOSS-ASSAULT-REC-06]
등록: https://github.com/Choyounhwa/-dream-guardian/issues/591 | 직접 선행: #514, #517 완료 이력 참고. 개별 승인 필수.
제목: 답 쌍 조우 판정·도착 생명주기 복구
목적: Game 라운드가 공급받은 보기 쌍의 실제 정답 방향과 쌍 단위 도착/취소 의미를 소비하게 한다.
수정 대상:
- `dream_guardian/src/game/assault/AssaultRoundController.ts`
- `dream_guardian/src/game/assault/AssaultPairJudge.ts` (Game, src/config2개).
구현 내용:
- encounter별 불변 pair 입력 포트를 정의하고 pairId/correctSide를 요구한다. 프로덕션 경로의 무조건 left 정답 폴백 제거; 기존 순수 판정기 의미는 보존.
- 정답은 쌍 전체취소·피해0, 오답은 잠금 후 승인된 도착/유예 정산 경계에서 피해1, timeout1을 보장한다. 시각도착과 판정deadline을 구분하고 늦은정답 유예를 훼손하지 않는다.
- arrival/tick 호출 누락·wrong_locked 후 tick 생략 의심을 먼저 재현한다. 양손 batch 입력을 함께 판정해 보류/재시도를 보장한다.
- inputId 1회 귀속, 동일deadline 입력우선·다중경계 시간순을 고정한다. 동시손/리듬 config를 주입받되 값 변경 금지.
유지 사항: 손↔같은쪽 답 계약, 정오와 리듬 분리, 기존 HP 정산 권위·손회수 상태.
변경 금지: Core/Question/config 수정, HP 직접변경, 쌍을 좌우 독립 miss로 계산, 스쿼트 성공으로 이전피해 취소.
완료 조건:
- [ ] 우측정답/정답후도착0피해/오답후반대손무시/미선택1피해/양손보류가 라운드 경유로 검증된다.
- [ ] 유예 마감 직전·동일·직후와 프레임누락에서도 정산명령 누락·중복0.
테스트: `dream_guardian/tests/unit/assault-recovery-pair-round.test.ts` 신규. Baseline→실제 라운드·pair judge 조합 테스트 Red→최소구현 Green→전체 npm test100%Pass/build; 기존 pair-judge/round 회귀. 가설 미재현 시 임의 수정 금지.
관련 파일: DOC-14 §7/§5.3; DOC-16; RoundController:481~501,698~720; PairJudge 공개 API (읽기 전용 근거).
선행 카드: #514/#517 완료 이력 재사용 참고(재완료 아님). 상태: OPEN / 개별 구현 승인 대기.
위험 방지: 보정130ms는 이 카드에서 다시 빼지 않는다. 타레이어/3개 밖 소스 필요 시 중단·분리.
관리: DOC-16 공통 계약; 실제 완료 gh issue comment(파일/TDD/전체100%Pass/build/조건)·HANDOVER·Rule13 서버. 현재 실행/커밋/푸시·NEXT 이동 금지.
