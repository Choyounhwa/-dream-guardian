[BOSS-ASSAULT-REC-23]
등록: https://github.com/Choyounhwa/-dream-guardian/issues/603 | 직접 선행: REC-00 #588 G4 행동/음향 승인. G4 차단·개별 승인 필수.
제목: 결전 경계 효과음 소비
목적: 실제결전stage/행동/receipt로음향을표현하며접근전게임시계를보존한다.
수정 대상:
- `dream_guardian/src/audio/AssaultSoundCue.ts` (Audio, src/config1개).
구현 내용:
- 기존경계이벤트와SFX매핑을재사용해결전예고/행동성공/회피/실제피격/종료입력을받는additive소비포트를정의한다.
- session/attack/stage/receipt등고유키로1회재생·정지/숨김/복귀소급재생0·종료후무음을보장한다. 피해량/판정계산은하지않는다.
- 새BGM/자산/AudioContext판정시계·음성큐는도입하지않는다. 기존접근전SFX의중복방어/게임시계를유지한다.
유지 사항: #544효과음큐구현·SFXSynth공개계약·legacy오디오·문제TTS비대기.
변경 금지: Core/Game/config/Render/UI수정·보상효과·#535를음향카드로재사용.
완료 조건:
- [ ] 결전경계별1회·중복snapshot/receipt후추가0·정지복귀/종료후소급음0.
- [ ] 접근전박자/피격/TTS회귀0, 오디오는HP/판정/시간을바꾸지않는다.
테스트: `dream_guardian/tests/unit/assault-recovery-finale-audio.test.ts` 신규. Baseline→SFX spy/결전경계·중복·숨김·종료 Red→최소구현 Green→전체 npm test100%Pass/build; 실청취승인후별도.
관련 파일: DOC-16; AssaultSoundCue.ts기존이벤트/매핑; FinaleSnapshot/SettlementReceipt (읽기전용).
선행 카드: REC-00 G4행동/음향범위승인. 상태: OPEN / G4차단·개별구현승인대기.
위험 방지: 새로운SFX유형/설정필요하면별도카드로중단·분리. 단일Audio밖수정금지.
관리: DOC-16공통계약; 실제완료 gh issue comment(TDD/전체100%Pass/build/파일/조건)·HANDOVER·Rule13서버. 현재실행/커밋/푸시·NEXT이동금지.
