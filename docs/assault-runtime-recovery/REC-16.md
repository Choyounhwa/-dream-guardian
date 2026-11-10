[BOSS-ASSAULT-REC-16]
등록: https://github.com/Choyounhwa/-dream-guardian/issues/609 | 직접 선행: REC-09 #606, REC-14 #599. 개별 승인 필수.
제목: 접근전 활성시계 효과음 Core 연결
목적: 존재하는 AssaultSoundCue를 실제 라운드 경계·일시정지 신호로 갱신한다.
수정 대상:
- `dream_guardian/src/core/AssaultSessionFactory.ts`
- `dream_guardian/src/core/AppBootstrap.ts` (Core, src/config2개).
구현 내용:
- 동일 session/round origin·BPM과 REC-14 표시/경계 이벤트로 soundCue.update를 호출한다. 투척/발사/취소/회피/피격은 고유ID당1회, 시각피격은 적용receipt와 일치시킨다.
- pause/hidden/tracking/reprep에서는 무음, 복귀후 과거박자/SFX 소급폭풍0. 기존음향API 재사용·새Audio시계/루프0.
- 초기 접근전 BGM 정책은 #503 및 실제 승인기록을 대조해 승인된 동작만 보존한다. 후보 BGM on/off를 새로 확정하지 않는다.
유지 사항: #544 구현 이력·게임활성시계·legacy BGM/SFX 경로.
변경 금지: Audio/Game/config 내부 수정, 효과음을 판정권위로 사용, 결전음향/보상 추가.
완료 조건:
- [ ] 실제 준비→round에서 경계별1회 SFX, 중복snapshot/update는 추가재생0.
- [ ] 숨김/정지/복귀·restart에서 묵은 SFX0, audio시계가 gameplay시간을 변경하지 않는다.
테스트: `dream_guardian/tests/unit/assault-recovery-audio-wiring.test.ts` 신규. Baseline→SFX spy/중복경계/정지복귀 Red→최소구현 Green→전체 npm test100%Pass/build; 실제청취는 승인후 브라우저 증거로 분리.
관련 파일: DOC-16; AssaultSoundCue.ts 실제공개계약; #544 (읽기 전용).
선행 카드: REC-09,14. 상태: OPEN / 개별 구현 승인 대기.
위험 방지: 음향소비 API 부족 시 Audio카드로 분리, 미승인BGM정책은 REC-00에서 결정 전 차단.
관리: DOC-16 공통 계약; 실제 완료 gh issue comment(파일/실제TDD/전체100%Pass/build/조건), HANDOVER 및 Rule13 서버. 현재 실행/커밋/푸시 금지·NEXT 불변.
