[ASSAULT-LOOP-15]
등록: https://github.com/Choyounhwa/-dream-guardian/issues/708 | 직접 선행: #694,#706.
제목:
루프 구간·기회·러닝 폴백 안내 HUD 읽기 전용 표시

목적:
완료문제10개 목표와 문제당선택4기회를 구분해 안내한다.

수정 대상:
- `dream_guardian/src/ui/AssaultHUD.ts`
UI 표시 단일 책임, src/config1개.

구현 내용:
- 기존 render 입력에 별도 선택 loop snapshot 인자를 받을 수 있는 additive 포트를 제공한다. Core HUD snapshot 타입을 강제로 바꾸거나 UI가 session 내부를 읽지 않는다.
- 구간명/잔여박/선택기회n/4/러닝·휴식·회피·직립 행동과 현 fallback 안내를 표시한다. 완료문제/목표10과 혼용0, 정답강제문구0. 기존fallback은 run중 좌우키/클릭이러닝, answer중 답선택임을 안내한다.
- Game에서 받은 수치만 표시하고 BPM/시간/스쿼트랜덤을 UI에서 계산하지 않는다. 기존일시정지/추적/재준비/오류배너 우선, 보스HP/마나/별가루/보상 미지원숨김 유지.
- 기존render시그니처/loop표시 없는 직접호출 fixture 결과는 동등 보존. boss_assault UI 기본URL에서는 추가 loop URL 없이도 LOOP-15a Core가 loop표시를 전달해야 한다. 실제 배선 구현은 LOOP-15a, 기본URL 종단 인수는 LOOP-16이 담당한다.

유지 사항:
HUD HP/진행도/타격수 분리·상태배너·스케일, 기존UI레이아웃.

변경 금지:
Core/Game/config/Storage/Render 수정, 정답·피해·진행계산, 전체칼로리/보상/마나 표시 추가.

완료 조건:
- [ ] 새표시 입력으로 각구간안내/기회/잔여박 구분, 기존render호출하위호환.
- [ ] UI만으로 시간전진/판정0, 반복render불변, 전체100%Pass/build,1,000줄 미만.

테스트:
신규 `dream_guardian/tests/unit/assault-loop-hud.test.ts`. Baseline npm test → `npx vitest run tests/unit/assault-loop-hud.test.ts` Red(loop안내포트 부재) → 별도 최소 Green → 전체 npm test/npm run build. ctx텍스트spy/전구간/우선배너/기존render동등 검증. Pass/Fail 분리.

관련 파일:
DOC-19; REC-15 #608, `types/assault-loop.ts`, `AssaultSceneHandler.ts` (읽기 전용).

선행 카드: LOOP-01,13. 상태: OPEN / 개별 구현 승인 대기.
관리: 범위 밖 중단. 실제완료 Rule12 gh issue comment(파일/TDD/전체100%Pass/build/조건), HANDOVER, Rule13 서버·http://localhost:3000/. 커밋 별도요청. 현재 구현/테스트/빌드/커밋/푸시/PR/서버 금지.
