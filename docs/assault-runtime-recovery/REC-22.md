[BOSS-ASSAULT-REC-22]
등록: https://github.com/Choyounhwa/-dream-guardian/issues/602 | 직접 선행: REC-00 #588 G4 표시 승인. G4 차단·개별 승인 필수.
제목: 결전 HUD 읽기 전용 소비
목적: 접근전HUD를훼손하지않고결전상태/단일권위HP의읽기전용표시포트를제공한다.
수정 대상:
- `dream_guardian/src/ui/AssaultHUD.ts` (UI, src/config1개).
구현 내용:
- 기존AssaultHUDSnapshot과별개additive결전표시입력으로플레이어HP·승인된보스HP표시정책·현재행동/단계·pause/reprep·승패를표현한다.
- 완료문제/타격수구분과미지원보상·마나·kcal정책을유지한다. 없는통계/최대HP를임의상수로만들지않고명시입력을요구한다.
- 기존render/getSnapshot/setSnapshot및접근전보스HP바숨김은보존한다. 결과·보상영수증화면은#536원래범위로남긴다.
유지 사항: MVP보스HP불변/바숨김·읽기전용·legacyHUD·현재레이아웃규칙.
변경 금지: Core/Game/Render/config수정·HP계산/변경·보상/저장·#534재사용/제목변경.
완료 조건:
- [ ] 접근전에서는보스HP/미지원기능숨김, 결전은승인입력만표시하고상수위조0.
- [ ] 반복render후snapshot/자원불변·작은화면/큰글자가독성·HP0/정지/승패표시검증.
테스트: `dream_guardian/tests/unit/assault-recovery-finale-hud.test.ts` 신규. Baseline→모드분리/실측입력/미지원숨김 Canvas Red→최소구현 Green→전체 npm test100%Pass/build. 브라우저증거별도.
관련 파일: DOC-16; AssaultHUD.ts실제snapshot·render공개API; FinaleSnapshot (읽기전용).
선행 카드: REC-00 G4표시정책승인. 상태: OPEN / G4차단·개별구현승인대기.
위험 방지: 수치/좌표새설정필요시Config별도카드, 단일UI범위밖수정금지.
관리: DOC-16공통계약; 실제완료 gh issue comment(파일/TDD/전체100%Pass/build/증거/조건)·HANDOVER·Rule13서버. 현재실행/커밋/푸시·NEXT이동금지.
