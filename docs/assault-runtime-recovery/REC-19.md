[BOSS-ASSAULT-REC-19]
등록: https://github.com/Choyounhwa/-dream-guardian/issues/605 | 직접 선행: REC-18 #600; REC-00 #588 G4 승인 필수. G4 차단·개별 승인 대기.
제목: 결전 피해 해석 원인 검증·복구
목적: 결전 player damage가 접근전10/5로 잘못해석되는지 재현하고 승인프로필로 분리한다.
수정 대상:
- `dream_guardian/src/game/assault/AssaultSettlement.ts`
- `dream_guardian/src/game/assault/AssaultFinaleController.ts` (Game, src/config2개).
구현 내용:
- 현재 finale 명령.damage와 settle의 player 분기를 서로 다른 시험용 프로필 fixture로 추적한다. 같은10/5 상수로 우연히통과하는 테스트금지. 재현전확정버그로단정하지않는다.
- REC-18 typed명령을사용하고 승인phase/profile/action별 피해를 정산기가해석한다. raw damage/attackId문자열추론으로권위를위임하지않는다.
- 보스/플레이어 피해 actual receipt반영·applied만·멱등키·stale거부·동시HP0패배우선보존. 결전컨트롤러 표시HP는 영수증투영이지별도변경권위가아님을고정.
유지 사항: 접근피해10/5·정답보스HP불변·legacy밸런스·단일자원포트.
변경 금지: config/Core/보상·저장수정, 결전수치후보확정, 무조건명령.damage 신뢰.
완료 조건:
- [ ] 원인재현또는미재현증거, 승인프로필의결전행동별 requested/actualDamage일치.
- [ ] 접근전·legacy값불변, 중복/stale명령0피해·양측HP0패배1·요약재차감0.
테스트: `dream_guardian/tests/unit/assault-recovery-finale-damage.test.ts` 신규. Baseline→상이프로필/실제Finale→Settlement회귀 Red→최소구현 Green→전체 npm test100%Pass/build. 미재현이면임의수정중단·증거보고.
관련 파일: DOC-16; FinaleController:630~665; Settlement.resolveSettlementDamage (읽기 전용근거).
선행 카드: REC-18; REC-00 G4 승인. 상태: OPEN / G4 차단·개별 구현 승인 대기.
위험 방지: profile주입 Core변경은 REC-20로분리. 다른레이어/4번째파일필요시중단.
관리: DOC-16 공통 계약; 실제완료 gh issue comment(원인/파일/실제TDD/전체100%Pass/build/조건)·HANDOVER·Rule13 서버. 현재실행/커밋/푸시·NEXT 이동금지.
