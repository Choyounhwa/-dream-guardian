[BOSS-ASSAULT-REC-15]
등록: https://github.com/Choyounhwa/-dream-guardian/issues/608 | 직접 선행: REC-12 #607, REC-14 #599. 개별 승인 필수.
제목: 접근전 장면·HUD 실측 전달 복구
목적: 이미 존재하는 scene renderer/HUD API에 실제 표시snapshot과 통계를 연결한다.
수정 대상:
- `dream_guardian/src/core/AssaultSessionFactory.ts`
- `dream_guardian/src/core/AppBootstrap.ts`
- `dream_guardian/src/core/SceneDirector.ts` (Core, src/config3개).
구현 내용:
- REC-14 snapshot을 기존 AssaultSceneRenderer에 전달하고 hud.setSnapshot/명시snapshot 인자 중 한 경로로 공급한다. null내부snapshot 때문에 HUD가 return하는 경로를 검증한다.
- 단일권위HP, 실측 completedQuestions/targetRounds/strikeCount/combo, pause/tracking/reprep/error를 분리해 표시한다. 실측 활성시간/운동량 제공하며 상수로 대체하지 않는다.
- 기존 AssaultApproachRenderer API를 연결해 실제 progress를 사용한다. MVP 보스HP바/보상·마나 숨김, kcal 미지원 정책 유지.
- 진입실패가 세션부재여도 기존 오류표시 포트로 전달되는지 확인한다. 표시시 Game/정산을 호출하지 않는다.
유지 사항: Render/UI내부·좌표config·legacy HUD·DEVUI/LAYOUT 기존경로.
변경 금지: Render/UI/Game/config 수정·UI_LAYOUT로 assault좌표 이전·미지원수치를0으로 위조.
완료 조건:
- [ ] 실제 조립경로에서 장면 pair·취소/도착·회피와 HUD HP/문제수/타격수가 올바르게 전달된다.
- [ ] repeat render 후 정산/진행0, 오류/정지상태 가시성·미지원숨김 보존.
테스트: `dream_guardian/tests/unit/assault-recovery-display-wiring.test.ts` 신규. Baseline→실제renderer/HUD 포트 spy/null snapshot/실측분리 Red→최소구현 Green→전체 npm test100%Pass/build; 브라우저 가독성·스크린샷은 승인 후 별도 증거.
관련 파일: DOC-16; SceneDirector:1240~1257; AssaultHUD.setSnapshot/render; AssaultApproachRenderer (읽기 전용).
선행 카드: REC-12,14. 상태: OPEN / 개별 구현 승인 대기.
위험 방지: 내부 API가 부족하면 직접수정하지 말고 Render/UI 별도 후속카드 등록·승인. 4번째파일 금지.
관리: DOC-16 공통 계약; 실제 완료 gh issue comment(파일/TDD/전체100%Pass/build/브라우저/조건), HANDOVER/Rule13 서버. 현재 실행/커밋/푸시·NEXT 이동 금지.
