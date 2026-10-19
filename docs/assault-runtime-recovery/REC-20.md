[BOSS-ASSAULT-REC-20]
등록: https://github.com/Choyounhwa/-dream-guardian/issues/611 | 직접 선행: REC-12 #607, REC-17 #610, REC-19 #605; REC-00 #588 G4 승인 필수.
제목: 실측 결전 인계·실행 재개 복구
목적: 가짜10문제/10정답 인계를없애고 실제집계·단일HP로결전을1회실행한다.
수정 대상:
- `dream_guardian/src/core/AssaultSessionFactory.ts`
- `dream_guardian/src/core/AppBootstrap.ts`
- `dream_guardian/src/core/SessionLifecycle.ts` (Core, src/config3개).
구현 내용:
- snapshot없음/다른session/규칙버전불일치/목표미도달/이미인계/HP0을거부한다. hardcoded10문제10정답fallback제거, 실측요약·현재권위HP검증필수.
- private `_hp`/Lifecycle flag복사로권위를재생성하지않고공개포트를사용한다. BossController.reset명시옵션은승인G4프로필만사용.
- handleAssaultIntent에서 engine.pauseGame후 실제update가재개되는지 검증하고 하나의루프안에서결전시계원점·입력·정산profile을연결한다. 결전시작once/추가문항0.
- pause/hidden/복구안전포트가결전에서도충분한지검증한다. Game결전수명API부족시 임의Core타이머로우회하지말고별도Game카드로차단한다.
유지 사항: finale기본false·legacy피버/군단배제·SessionLifecycle종료권위·HP0우선.
변경 금지: Game/config/보상/저장·기본활성화, 실제진행없는승리위조, 새rAF/setTimeout.
완료 조건:
- [ ] 실제준비→목표정산→살아있는경우실측인계1→정상update진행; 위조/중복/stale거부.
- [ ] 최종HP0에서는GAMEOVER1/결전0, 결전중/종료후새문항0·privateHP쓰기0.
테스트: `dream_guardian/tests/unit/assault-recovery-finale-handoff.test.ts` 신규. Baseline→실제루프정지/재개·실측snapshot필수·중복/HP0/원점 Red→최소구현 Green→전체 npm test100%Pass/build; 브라우저실행별도증거.
관련 파일: DOC-16; AppBootstrap:689~762; Factory:430~445; GameEngine공개pause/resume (읽기전용).
선행 카드: REC-12,17,19 및 REC-00 G4승인. 상태: OPEN / G4차단·개별구현승인대기.
위험 방지: Game API추가필요시즉시별도카드/승인. G4증거없이이미있는프로필을확정값으로가동금지.
관리: DOC-16공통계약; 실제완료 gh issue comment(파일/실제TDD/전체100%Pass/build/조건)·HANDOVER·Rule13서버. 현재실행/커밋/푸시·NEXT이동금지.
