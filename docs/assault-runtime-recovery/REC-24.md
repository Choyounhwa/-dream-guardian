[BOSS-ASSAULT-REC-24]
등록: https://github.com/Choyounhwa/-dream-guardian/issues/612 | 직접 선행: REC-20 #611, REC-21 #601, REC-22 #602, REC-23 #603; REC-00 #588 G4 승인 필수.
제목: 결전 장면·HUD·음향 Core 전달
목적: 별도로완료된결전표시/음향포트에실제결전snapshot·receipt를연결한다.
수정 대상:
- `dream_guardian/src/core/AssaultSessionFactory.ts`
- `dream_guardian/src/core/AppBootstrap.ts`
- `dream_guardian/src/core/SceneDirector.ts` (Core, src/config3개).
구현 내용:
- finale활성일때REC-21 render포트·REC-22 HUD포트·REC-23 sound포트로실제단계/행동/권위HP투영/정산receipt를전달한다.
- 현재finaleSnapshot에questionText:''을붙여approach렌더러에그대로넣는우회를교체한다. 접근전과결전표시를배타적으로소비하되같은메인루프를유지한다.
- pause/reprep/종료·dispose상태일치, 반복update/render중SFX1회·정산부작용0. 결전종료의최종실측통계보존, 보상/저장은연결하지않는다.
유지 사항: legacy결전피버/군단배제·기본finale false·공용GameEngine·assault좌표config.
변경 금지: Game/Render/UI/Audio/config내부수정·기본활성화·G5보상/저장·새루프.
완료 조건:
- [ ] 실제준비→접근완료→승인옵트인결전에서장면/HUD/효과음이동일한실측단계를소비한다.
- [ ] HP0패배우선·종료1회·결전이후문항0·legacy/접근전표시회귀0.
테스트: `dream_guardian/tests/unit/assault-recovery-finale-display-wiring.test.ts` 신규. Baseline→실제renderer/HUD/SFX포트·배타전달 Red→최소구현 Green→전체 npm test100%Pass/build; 브라우저통합REC-25로증거확보.
관련 파일: DOC-16; SceneDirector:1240~1257; REC-21~23공개포트 (읽기전용).
선행 카드: REC-20,21,22,23; REC-00 G4승인. 상태: OPEN / G4차단·개별구현승인대기.
위험 방지: 하위포트부족시새도메인카드/승인없이수정금지. Core3파일이외확장금지.
관리: DOC-16공통계약; 실제완료 gh issue comment(파일/실제TDD/전체100%Pass/build/증거/조건)·HANDOVER·Rule13서버. 현재실행/커밋/푸시·NEXT이동금지.
