[ASSAULT-LOOP-12]
등록: https://github.com/Choyounhwa/-dream-guardian/issues/705 | 직접 선행: #701,#702,#703,#704.
제목:
boss_assault UI 기본 루프 선택·시작·재시작 보존

목적:
일반 개발URL `http://localhost:3000/?mode=boss_assault`만으로 새 루프가 정상 실행되고 UI 재시작에서도 유지되도록 Core 진입 기본값을 연결한다. 추가 loop URL이나 사용자의 loopProfile 지정은 필수가 아니다.

수정 대상:
- `dream_guardian/src/core/bootstrap/AssaultSessionWireHelper.ts`
- `dream_guardian/src/core/bootstrap/AssaultLoopEntryOptions.ts` (신규)
Core 진입옵션 단일 책임, src/config2개.

구현 내용:
- `http://localhost:3000/?mode=boss_assault`의 UI 첫 시작/READY_POSITION/startAssaultPhase→assemble에서 Core가 새 loopProfile을 기본 선택하여 Factory에 전달한다. `loop` 파라미터 부재를 구형 루프 선택 사유로 사용하지 않는다. 명시 mode=boss_assault UI 진입도 같은 계약이다.
- UI 기본 선택 권위는 이 카드의 Core 진입 resolver다. 프로필 ID/값은 LOOP-01 SSOT를 참조한다. DEFAULT_APPROACH_PATTERN 데이터 및 loopProfile 없는 범용 Factory 직접 호출의 기존 테스트 계약은 유지하며 Factory 전역 기본값을 바꾸지 않는다.
- 첫 시작·UI 직접 assemble·메뉴왕복·restart 모두 같은 resolver를 사용하고 loopProfile/seed/BPM을 전달한다. 추가 loop URL 지원은 필수 구현/인수 조건이 아니다. 기존 명시입력 또는 필요해 별도 지원한 입력이 있으면 검증 후 사용하고, 미지정은 boss_assault UI에서 새 루프 기본값을 선택한다. unknown loop/profile·충돌pattern·source=challenge는 원자적 오류로 거부하며 오류를 구형 루프로 숨기지 않는다.
- restart에서 같은seed+round번호계획 재현, 새로운session token/HP100/진행0/round1 및 기존손회수·직립안전정책. 종료뒤 이전 callback/입력은새세션 영향0.
- 허용된 루프선택을 동결된 마지막옵션에 보존하되 enableFinale/보상/기록설정을 몰래 켜지 않는다. 기존testSession저장차단 유지.

유지 사항:
기존 mode 판별/개발환경제한/DEVUI 병행, 비boss legacy 기본경로, DEFAULT_APPROACH_PATTERN 데이터, 범용 Factory 직접 호출 호환, REC-17 종료권위·토큰, targetRounds10. boss_assault UI 기본 루프 선택 변경은 보존 대상의 예외가 아니라 본 카드의 필수 요구다.

변경 금지:
AppBootstrap/StateMachine/config/Game/Storage 변경, 비boss 메뉴 기본모드 전환, Factory 전역 기본값/패턴 데이터 변경, 자동결전/마나/보상/기록저장. boss_assault UI의 새 루프 기본 선택은 금지 대상이 아니다.

완료 조건:
- [ ] `http://localhost:3000/?mode=boss_assault`만으로 실제 UI 준비→첫 시작에서 새 루프 계획이 조립된다. loop 파라미터/테스트의 loopProfile 수동주입 없이 run8+(answer4+rest2)×4 및 squat1~2회가 실행된다.
- [ ] 동일 기본URL의 UI restart/메뉴왕복 후에도 새 루프가 기본 선택되고 seed·round계획 재현, stale/중복dispose 안전, invalid입력 원자적 오류를 검증한다.
- [ ] 비boss legacy·범용 Factory 직접 호출 테스트·DEFAULT_APPROACH_PATTERN 데이터는 보존, 전체100%Pass/build. 추가 loop URL만 성공한 증거로 기본경로 완료를 주장하지 않는다.
- [ ] 두파일1,000줄 미만.

테스트:
신규 `dream_guardian/tests/unit/assault-loop-entry.test.ts`. Baseline npm test → `npx vitest run tests/unit/assault-loop-entry.test.ts` Red(`?mode=boss_assault`만 전달한 실제 UI 시작/restart에서 새 루프 기본 주입 누락) → 별도 최소 Green → 전체 npm test/npm run build. loop 파라미터/loopProfile 수동주입 없는 준비완료·직접 UI assemble·restart·메뉴왕복을 검증하고, 비boss legacy/범용 Factory 직접호출 동등·unknown profile/loop·challenge·충돌pattern 오류를 분리 검증한다. 선택적 추가URL 지원은 필요시에만 검증하며 기본경로 테스트를 대체하지 않는다. Pass/Fail 분리.

관련 파일:
DOC-19; #610, #537(결과저장 별도), AppBootstrap 공개위임/SessionLifecycle (읽기 전용).

선행 카드: LOOP-08,09,10,11. 상태: OPEN / 개별 구현 승인 대기.
관리: 범위 밖 중단. 실제완료 Rule12 gh issue comment(구현/파일/TDD/전체100%Pass/build/조건), HANDOVER, Rule13 npm run dev·http://localhost:3000/. 커밋 별도요청. 현재 구현/테스트/빌드/커밋/푸시/PR/서버 금지.
