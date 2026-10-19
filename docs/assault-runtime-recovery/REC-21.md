[BOSS-ASSAULT-REC-21]
등록: https://github.com/Choyounhwa/-dream-guardian/issues/601 | 직접 선행: REC-00 #588 G4 행동/표시 승인. G4 차단·개별 승인 필수.
제목: 결전 단계 읽기 전용 장면 소비
목적: 존재하는 접근전렌더러와legacy결전렌더러를대조하여결전snapshot을정확히표시한다.
수정 대상:
- `dream_guardian/src/render/AssaultSceneRenderer.ts` (Render, src/config1개).
구현 내용:
- 실제FinaleSnapshot(currentEncounterKind/currentStage/isResolved/승패)을받는additive render포트를정의한다. 기존render/PairPainter계약보존.
- punch/squat/jump·저충격안내·예고/window/recovery/승패를승인된행동/표시정책범위에서구분한다. 접근전questionText빈값을임시주입해결전화면처럼보이게하지않는다.
- BossClimaxRenderer는실제로존재하나군단/피버/별가루DTO라그대로결전으로간주하지않는다. 필요한순수표시만재사용가능성검토, 위조legacy상태공급금지.
유지 사항: 기존접근전throw/라벨/취소표현·assault-visual좌표·읽기전용표시·legacy렌더경로.
변경 금지: Core/Game/UI/config·신규에셋제작·판정창계산/HP변경·기본모드전환.
완료 조건:
- [ ] 실제FinaleSnapshot fixture별로예고/판정/복귀·동작안내가구분되고수식문항/legacy군단이잘못표시되지않는다.
- [ ] frozen snapshot반복render후불변·자원변경0, 접근전시각회귀0·반응형가독성증거.
테스트: `dream_guardian/tests/unit/assault-recovery-finale-render.test.ts` 신규. Baseline→실제snapshot Canvas spy Red→최소구현 Green→전체 npm test100%Pass/build; 브라우저전후이미지별도확인.
관련 파일: DOC-16; AssaultSceneRenderer/PairPainter/BossClimaxRenderer 실제포트; FinaleController snapshot (읽기전용).
선행 카드: REC-00 G4행동/표시승인. 상태: OPEN / G4차단·개별구현승인대기.
위험 방지: 원이슈#533을렌더카드로재사용하지않는다. 신규설정/별도파일필요시다른카드로분리·재승인.
관리: DOC-16공통계약; 실제완료 gh issue comment(파일/TDD/전체100%Pass/build/시각증거/조건)·HANDOVER·Rule13서버. 현재실행/커밋/푸시·NEXT이동금지.
