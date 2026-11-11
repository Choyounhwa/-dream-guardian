[ASSAULT-LOOP-15a]
등록: https://github.com/Choyounhwa/-dream-guardian/issues/709 | 직접 선행: #702,#705,#706,#707,#708.
제목:
실제 루프 HUD·구간스냅샷 Core 전달

목적:
새 HUD를 테스트에서만 수동주입하는 미연결 상태로 남기지 않는다.

수정 대상:
- `dream_guardian/src/core/director/AssaultSceneHandler.ts`
Core 표시전달 단일 책임, src/config1개.

구현 내용:
- 실제 활성round의 읽기전용 loop스냅샷을 LOOP-15 HUD additive포트에 전달한다. 기존 HP/완료문제 snapshot 전달은 유지하고 계산을 복제하지 않는다.
- snapshot을 render에 이미 전달하는 실제경로를 확인하고 loop합성필드 보존. `?mode=boss_assault` UI 기본 시작/restart는 loop 파라미터 없이 새안내를 전달한다. **loop계획 없는 범용 Factory 직접호출 fixture**/끝난세션/stale토큰만 새안내를 제거하며 URL의 loop 파라미터 부재를 제거조건으로 사용하지 않는다. 이전pair/hazard가휴식에잔류하지 않는지 확인한다.
- 오디오에는 기존 Factory.updateAudio가 같은 Game스냅샷을 받는지 회귀확인한다. 휴식에 공격pair/hazard가없어 발사/피해음신규발행0, 메트로놈허용. 새로운효과음/Audio내부추정버그는별도카드.

유지 사항:
기존HUD/scene/VFX/바닥레이어·음향시계 전달, legacy/결전경로.

변경 금지:
UI/Render/Audio/Game/config 수정, 전달을위한가짜snapshot 생성, #609/#608 기능재구현.

완료 조건:
- [ ] 실제session→handler→HUD/scene의 loop필드/박수/기회가일치, 휴식공격표시/발사음0.
- [ ] loop계획 없는 직접호출 fixture 동등/stale표시0, boss_assault UI 기본URL의 새구간 HUD 전달을 확인, 전체100%Pass/build,1,000줄 미만.

테스트:
신규 `dream_guardian/tests/unit/assault-loop-display-wiring.test.ts`. Baseline npm test → `npx vitest run tests/unit/assault-loop-display-wiring.test.ts` Red(HUD신규포트미전달) → 별도최소Green → 전체npm test/npm run build. 실제factory/session과HUD/scene/audio spy검증, 수동가짜계획만으로대체금지. Pass/Fail분리.

관련 파일:
DOC-19; REC-15 #608/REC-16 #609, AssaultHUD/AssaultSceneRenderer/AssaultSoundCue (읽기전용).

선행 카드: LOOP-09,12,13,14,15. 상태: OPEN / 개별 구현 승인 대기.
관리: 범위밖중단. 실제완료 Rule12 gh issue comment(파일/TDD/전체100%Pass/build/조건), HANDOVER, Rule13 서버·http://localhost:3000/. 커밋별도요청. 현재구현/테스트/빌드/커밋/푸시/PR/서버금지.
