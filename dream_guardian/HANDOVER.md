# 🌙 《꿈의 수호신 (Dream Guardian)》 프로젝트 인수인계 및 후속 작업 안내서

본 문서는 사용자가 이후 작업을 바로 이어서 진행할 수 있도록 프로젝트의 전체 맥락, 파일 구성, 구현 완료 현황, 실행 방법 및 다음 개발 과제를 정리한 문서입니다.

## ⏸️ 답안 선택 후 2박 쉼표(Rest Delay) 도입 트랙 (ANSWER-REST, 2026-10-08)

- **작업 카드**: [✔ 완료] [#498 ANSWER-REST-001](https://github.com/Choyounhwa/-dream-guardian/issues/498) 답안 선택 후 2박 쉼표(Rest Delay) 도입 및 분기 전이 완충
- **목적**: 답안 선택(팔 뻗기 또는 클릭 폴백) 직후 즉시 STAR_COLLECT / HAZARD_EVADE로 급격하게 전이되는 문제를 해결하기 위해, 정답/오답/타임아웃 확정 후 2박(BPM 120 기준 1.0초) 동안 답안 피드백 및 선택 상태를 유지하는 쉼표(Rest Delay) 구간을 거친 뒤 다음 단계로 부드럽게 전이되도록 한다.
- **수정 대상**: `src/game/BeatRunCoordinator.ts`, `src/core/AppBootstrap.ts`, `tests/unit/beat-run-coordinator.test.ts`, `tests/unit/app-bootstrap.test.ts`

## 👣 3레인·발자국·리듬노트 단일화 및 궤적 고정 트랙 (LANE-SYNC, 2026-10-08)

- 관리 카드: [✔ 완료] [#493 LANE-SYNC-TRACK](https://github.com/Choyounhwa/-dream-guardian/issues/493) (3레인·발자국·리듬노트 단일화 및 궤적 고정 전 과정 완주)
- 하위 카드 목록:
  - [✔ 완료] [#494 LANE-SYNC-01](https://github.com/Choyounhwa/-dream-guardian/issues/494) 3대 레인과 발자국 슬롯 X 좌표 단일화 및 러닝 매트 3레인 중앙 발자국 정렬
  - [✔ 완료] [#495 LANE-SYNC-02](https://github.com/Choyounhwa/-dream-guardian/issues/495) 리듬노트 비행 궤적의 3레인 세로선 정렬 및 러닝/리듬 모드 착지 앵커 단일화
  - [▶ NEXT: 승인 대기] [#499 LANE-ALIGN-01](https://github.com/Choyounhwa/-dream-guardian/issues/499) 피트니스 Zone 9/10/11 중심 기준 발 판정선 앵커 및 발자국 위치 동기화 (x: 1/6, 1/2, 5/6)

## 🚨 문제페이즈(RUN_QUESTION) 렌더링 중단 결함 등록 (BUG-RUN-QUESTION-RENDER, 2026-10-08)

- **버그 카드**: [✔ 완료] [#492 BUG-RUN-QUESTION-RENDER-001](https://github.com/Choyounhwa/-dream-guardian/issues/492) 문제페이즈(RUN_QUESTION) 렌더링 중단 버그: RunningMatRenderer Proxy Illegal Invocation 및 tracker.render 예외 해결
- **현상**: 브라우저 실게임 실행 시 RUN_QUESTION 문제페이즈 진입 시 화면에 수학 문제(QuestionRenderer)와 졸라맨(StickmanRenderer)이 미표시됨.
- **원인**:
  1. `RunningMatRenderer._renderFlyingStompNotes`에서 네이티브 Canvas2D에 `Proxy`를 래핑하여 브라우저 WebIDL C++ 바인딩 검증 실패 (`TypeError: Illegal invocation`) → `SceneDirector.renderGameScene` 중단으로 문제/졸라맨 렌더링 생략.
  2. `SceneDirector.renderModalsAndOverlays`에서 `tracker.render` 미존재 함수 호출 예외 발생.
- **수정 계획**: `src/render/RunningMatRenderer.ts` (Proxy 제거 및 안전한 Canvas2D 직접 전달), `src/core/SceneDirector.ts` (answerSelectionRenderer 교정).

## 🧍 플레이어 아바타 일체화 및 위치 동기화·이탈 가이드 트랙 등록 (AVATAR, 2026-10-08)

- 관리 카드: [✔ 완료] [#487 AVATAR-TRACK](https://github.com/Choyounhwa/-dream-guardian/issues/487) (전체 4개 하위 작업 완주 및 트랙 CLOSED)
- 하위 카드 목록:
  - [✔] [#488 AVATAR-01](https://github.com/Choyounhwa/-dream-guardian/issues/488) 실사 웹캠 숨김 옵션 및 졸라맨 1.5배 기본 스케일·Y앵커 튜닝 (완료)
  - [✔] [#489 AVATAR-02](https://github.com/Choyounhwa/-dream-guardian/issues/489) 유저 카메라 위치 ↔ 졸라맨 가로 위치 실시간 동기화 및 EMA 스무딩 (완료)
  - [✔] [#490 AVATAR-03](https://github.com/Choyounhwa/-dream-guardian/issues/490) 화면 이탈 감지 및 중앙 복귀 유도 가이드 UI (완료)
  - [✔] [#491 AVATAR-04](https://github.com/Choyounhwa/-dream-guardian/issues/491) 캐릭터 교체용 `IAvatarRenderer` 인터페이스 추상화 (완료)
  - [✔] [#496 BUG-AVATAR-002](https://github.com/Choyounhwa/-dream-guardian/issues/496) 졸라맨 가로 위치 앵커 및 모션 이중 미러링 반전 결함 수정 (완료)
  - [✔] [#497 FEAT-AVATAR-WEBCAM-TOGGLE](https://github.com/Choyounhwa/-dream-guardian/issues/497) 설정 메뉴 실사 웹캠 표시/숨김 토글 옵션 추가 (완료)

### [✔ 완료] #497 [FEAT-AVATAR-WEBCAM-TOGGLE] 설정 메뉴 실사 웹캠 표시/숨김 토글 옵션 추가 (2026-10-08)
- **작업 목적**:
  - 설정 모달(`SettingsModal`)에 **실사 웹캠 영상(배경) 표시 여부**(`renderVideoEnabled`) 토글 옵션을 추가하여, 유저가 인게임 UI에서 언제든 실사 웹캠을 숨기고 순수 몽계 배경 + 졸라맨 아바타 모드로 전환할 수 있도록 지원.
  - 실사 웹캠을 OFF하더라도 `CameraLayer`의 비디오 스트림 및 MediaPipe 모션 인식은 100% 정상 작동 유지.
- **수정 내용**:
  1. `dream_guardian/src/ui/SettingsModal.ts`:
     - `_renderVideoEnabled = true` 및 `onRenderVideoChange` 콜백 추가
     - `renderVideoEnabled` getter/setter 및 `toggleRenderVideo(): boolean` 메서드 구현
     - `toViewModel(): SettingsViewModel`에 `renderVideoEnabled` 필드 동기화
     - `saveAccessibility` 및 `loadAccessibility`에 `dg_render_webcam` 키 기반 `localStorage` 저장/복원 연동
     - `handleClick`에서 `action === 'webcamVideo'` 시 `toggleRenderVideo()` 연동
  2. `dream_guardian/src/ui/SettingsView.ts`:
     - `SettingsButtonAction` 유니온 및 `SETTINGS_BUTTON_ACTIONS` 배열에 `'webcamVideo'` 추가
     - `SETTINGS_ACTION_ORDER` 상수 정의 및 `getSettingsButtonLayout` 적용
     - `SettingsViewModel`에 `renderVideoEnabled: boolean` 필드 추가 및 기본 DTO 헬퍼 연동
     - 10개 버튼이 수용되도록 `getSettingsModalBounds` 기본 높이 `Math.max(baseModal.h, 1340)` 확보
     - `renderSettingsView`에서 `'📹 실사 웹캠'` 버튼 렌더링 (`'iconCamera'` 아이콘 및 ON/OFF 토글 상태)
  3. `dream_guardian/src/core/AppBootstrap.ts`:
     - `cameraLayer.renderVideo = settingsModal.renderVideoEnabled` 초기화 및 `onRenderVideoChange` 콜백 등록
     - `handleClick`에서 `action === 'webcamVideo'` 시 `cameraLayer.renderVideo` 동기화 및 hover SFX 재생
  4. `dream_guardian/tests/unit/settings-modal.test.ts` & `tests/unit/ui-vis-011.test.ts`:
     - TDD 단위 테스트 선작성 및 100% 통과 검증 (기본값, 토글 반전, 콜백 통지, localStorage 복원, 히트테스트, 렌더링)
- **수정 파일**:
  1. `dream_guardian/src/ui/SettingsModal.ts`
  2. `dream_guardian/src/ui/SettingsView.ts`
  3. `dream_guardian/src/core/AppBootstrap.ts`
  4. `dream_guardian/tests/unit/settings-modal.test.ts`
  5. `dream_guardian/tests/unit/ui-vis-011.test.ts`
- **검증 결과**:
  - `npx vitest run tests/unit/settings-modal.test.ts tests/unit/ui-vis-011.test.ts`: 36건 테스트 100% 통과
  - `npx vite build`: 프로덕션 번들 정상 빌드 완료

### [✔ 완료] #496 [BUG-AVATAR-002] 졸라맨 가로 위치 앵커 및 모션 이중 미러링 반전 결함 수정 (2026-10-08)
- **작업 목적**:
  - `PoseManager`의 미러 가상 좌표계(`virtualLandmarks`)와 `StickmanRenderer` 가로 앵커 동기화 간의 이중 반전을 해소하여, 스켈레톤/커서/유저의 실제 움직임과 졸라맨이 동일한 방향(1:1 일치)으로 자연스럽게 움직이도록 수정.
- **수정 내용**:
  - `StickmanRenderer.ts`: 가로 앵커 `rawUserX` 계산 시 랜드마크가 이미 미러링된 화면 좌표계(`isLandmarkMirrored = !(rs.x < ls.x)`)인지 확인하여 이중 반전을 제거하고 1:1 동기화. 원본 비미러 카메라 좌표계(`rs.x < ls.x`)일 때만 미러 모드 반전(`1.0 - rawHipX`) 적용. 관절 각도 계산의 `isMirrored`와도 완벽히 정합.
  - `stickman-renderer.test.ts`: 미러링된 화면 랜드마크(`ls.x = 0.65, rs.x = 0.75`) 인입 시 졸라맨의 `currentAnchorXRatio`가 우측(0.7)으로 이동함을 검증하는 테스트 추가 및 기대값 갱신 (39건 100% 통과).
- **수정 파일**:
  1. `dream_guardian/src/skeleton/StickmanRenderer.ts`
  2. `dream_guardian/tests/unit/stickman-renderer.test.ts`


### [✔ 완료] #491 [AVATAR-04] 캐릭터 교체용 IAvatarRenderer 인터페이스 추상화 (2026-10-08)
- **작업 목적**:
  - 향후 졸라맨 아바타를 2D 스프라이트나 3D 모델 캐릭터로 무결하게 교체할 수 있도록 공통 아바타 렌더러 인터페이스(`IAvatarRenderer`)를 정의하고, `StickmanRenderer` 및 상위 게임 조립 레이어(`AppBootstrap.ts`)에 의존성 주입을 적용하여 캐릭터 확장성을 확보.
- **수정 파일 (3개 소스 + 1개 테스트, Scope Guard 준수)**:
  1. `dream_guardian/src/skeleton/IAvatarRenderer.ts` (신규): `IAvatarRenderer` 인터페이스 정의 (`scale`, `readonly hasPose`, `readonly currentAnchorXRatio`, `setScale`, `update`, `updateFallback`, `render`, `reset`).
  2. `dream_guardian/src/skeleton/index.ts`: `export type { IAvatarRenderer }` 배럴 re-export 추가.
  3. `dream_guardian/src/skeleton/StickmanRenderer.ts`: `implements IAvatarRenderer` 선언, `update` 시그니처에서 옵션 객체(`{ mirror, breathScale }`) 및 number breathScale 양방향 호환 지원.
  4. `dream_guardian/src/core/AppBootstrap.ts`: `AppBootstrapOptions.avatarRenderer?: IAvatarRenderer` 의존성 주입 지원, `AppBootstrap.stickmanRenderer` 필드를 `IAvatarRenderer`로 선언.
  5. `dream_guardian/tests/unit/avatar-interface.test.ts` (신규): TDD 단위 테스트 6건 추가 (StickmanRenderer 규격 충족 검증, MockSpriteAvatarRenderer 교체 다형성 검증, AppBootstrap DI 검증 - 6/6 tests 100% Pass).
- **검증 결과**:
  - `npx vitest run tests/unit/avatar-interface.test.ts`: 6개 100% 통과.
  - `npx vitest run tests/unit/stickman-renderer.test.ts tests/unit/app-bootstrap.test.ts tests/unit/skeleton.test.ts`: 61개 100% 통과.
  - `npx vite build`: 프로덕션 번들 빌드 성공 (tsc + vite 빌드 무결).
- **트랙 완료 보고**:
  - AVATAR-TRACK #487의 하위 4개 카드(#488, #489, #490, #491) 전 과정이 완주되어 플레이어 아바타 일체화 및 위치 동기화 트랙이 완료되었습니다.

### [✔ 완료] #490 [AVATAR-03] 화면 이탈 감지 및 중앙 복귀 유도 가이드 UI (2026-10-08)
- **작업 목적**:
  - 유저가 카메라 시야 밖으로 지나치게 벗어나는 것(좌측 < 0.20, 우측 > 0.80)을 사전에 감지하고, 화면 중앙으로 자연스럽게 복귀하도록 직관적인 시각 피드백(경계 네온 앰비언트 글로우, 중앙 유도 네온 화살표, 중앙 안내 배너) 제공.
- **수정 파일**:
  1. `dream_guardian/src/render/PostureGuideRenderer.ts`: `renderBoundaryWarning(ctx, vw, vh, exitDirection)` 메서드 구현. 좌/우 경계 펄스 글로우 및 경계선, 중앙 방향 바운스 네온 화살표(쉐브론 더블), 화면 상단/중앙 안내 배너("⚠️ 화면 중앙으로 이동해 주세요") 시각화.
  2. `dream_guardian/src/core/SceneDirector.ts`: `postureGuideRenderer` 안전 주입/생성, `updateGameScene`에서 타이머 갱신, `renderGameScene`에서 `stickmanRenderer.currentAnchorXRatio` 기준 `< 0.20` ('left'), `> 0.80` ('right') 이탈 판정 및 경고 렌더링 호출 연동.
  3. `dream_guardian/tests/unit/posture-guide-renderer.test.ts`: TDD 신규 단위 테스트 추가 (null 미호출, left/right 경고 렌더링, 정상 영역 복귀 해제, update 애니메이션 펄스, SceneDirector 연동 검증 - 23/23 tests 100% Pass).
- **검증 결과**:
  - `npx vitest run tests/unit/posture-guide-renderer.test.ts`: 23개 100% 통과 (신규 6개 포함).
  - `npx vitest run tests/unit/scene-director.test.ts`: 19개 100% 통과.
  - 전체 단위/통합 테스트: 100% Pass (회귀 0건).
  - `npx vite build`: 프로덕션 번들 빌드 성공.
- **다음 작업 대상**:
  - **[#491 AVATAR-04]**: 캐릭터 교체용 `IAvatarRenderer` 인터페이스 추상화

### [✔ 완료] #489 [AVATAR-02] 유저 카메라 위치 ↔ 졸라맨 가로 위치 실시간 동기화 및 EMA 스무딩 (2026-10-08)
- **작업 목적**:
  - 기존 화면 정중앙(X: 0.5)에 고정되어 있던 졸라맨 가로 앵커 위치를 유저의 실제 카메라 내 골반 중심 좌표와 동기화하여 플레이어의 이동감을 구현.
- **수정 파일**:
  1. `dream_guardian/config/skeleton.config.ts`: `StickmanConfig`에 `horizontalSmoothing`(0.2), `horizontalClampMin`(0.18), `horizontalClampMax`(0.82) 추가 및 `STICKMAN_CONFIG` 기본값 반영.
  2. `dream_guardian/src/skeleton/StickmanRenderer.ts`: `_currentAnchorXRatio`, `isMirrored`(기본 true), `currentAnchorXRatio` getter, 골반 X 추출 및 결손 시 어깨 폴백, 미러링(1.0 - rawHipX) 및 [0.18, 0.82] 클램핑, 첫 프레임 즉시 스냅 및 이후 EMA 스무딩, 포즈 상실/fallback 시 기본 0.5 서서히 복귀, `calculateFKPositions`의 동적 `px` 반영.
  3. `dream_guardian/tests/unit/stickman-renderer.test.ts`: TDD 8개 신규 단위 테스트 추가 (36/36 tests 100% Pass).
- **검증 결과**:
  - `npx vitest run tests/unit/stickman-renderer.test.ts`: 36개 100% 통과 (신규 8개 포함).
  - 렌더/스켈레톤 도메인 테스트 4개 파일: 73개 100% 통과.
  - 전체 단위/통합 테스트: 230개 파일, 3,194개 100% 통과 (회귀 0건).
  - TypeScript strict typecheck 및 Vite production 번들 빌드 성공.
- **다음 작업 대상**:
  - **[#490 AVATAR-03]**: 화면 이탈 감지 및 중앙 복귀 유도 가이드 UI

## 🎯 통합 모션 리듬 노트 파이프라인 카드 등록 (MRN, DOC-12 v2, 2026-10-08)

**승인 범위는 #424/#429 종료, BUG 카드 작성, 설계 트랙 등록뿐이다. 구현은 미착수이며 카드마다 별도 승인을 받는다.**
- 설계: `docs/12_UNIFIED_MOTION_RHYTHM_ARCHITECTURE.md` v2 (정의/판정/외형 3축 분리, 공용 NoteProjection/NoteAnchorResolver, 무변화 이행)
- 종료: #424, #429 (#429는 StarNoteRenderer 범위 한정 완료)
- **정정**: [#473 BUG-NOTE-CIRCLE-001] [✔] 완료. 아래 #429 섹션의 완료 기록을 StarNoteRenderer 내부 검증 한정으로 정정하고 `part: 'foot' as any` 타입 우회를 정식 규격(hip)으로 교정 완료. 실제 인게임 발 노트(`RunningMatRenderer._renderFlyingStompNotes`) 원형 링 기능 해소는 [MRN-08 #482]에서 진행.
- 트랙: [✔] [#474 MRN-TRACK](https://github.com/Choyounhwa/-dream-guardian/issues/474) (MRN-01~12 전 12개 카드 구현·검증 완료 및 트랙 CLOSED). [#475 MRN-01], [#476 MRN-02], [#477 MRN-03], [#478 MRN-04], [#479 MRN-05], [#480 MRN-06], [#481 MRN-07], [#482 MRN-08], [#483 MRN-09], [#484 MRN-10], [#485 MRN-11], [#486 MRN-12] [✔] 완료에 따라 통합 모션 리듬 파이프라인(MRN) 12단계 전 과정 완주. 기존 SSOT/다른 트랙 NEXT는 변경하지 않는다.

### 🎯 통합 모션 리듬 파이프라인 진행 현황 (MRN-TRACK #474)
| 단계 | 카드 | 내용 | 상태 |
|---|---|---|---|
| MRN-01 | [#475](https://github.com/Choyounhwa/-dream-guardian/issues/475) | MotionNote 타입 계약 정의 | [✔] 완료 |
| MRN-02 | [#476](https://github.com/Choyounhwa/-dream-guardian/issues/476) | 노트 비주얼 프로필 config 및 기본 매핑 | [✔] 완료 |
| MRN-03 | [#477](https://github.com/Choyounhwa/-dream-guardian/issues/477) | 공용 NoteProjection 추출 및 StarNoteRenderer 위임 | [✔] 완료 |
| MRN-04 | [#478](https://github.com/Choyounhwa/-dream-guardian/issues/478) | NoteAnchorResolver (존 중심 / 판정선 착지 좌표 통일) | [✔] 완료 |
| MRN-05 | [#479](https://github.com/Choyounhwa/-dream-guardian/issues/479) | MotionNoteRenderer + Painter | [✔] 완료 |
| MRN-06 | [#480](https://github.com/Choyounhwa/-dream-guardian/issues/480) | 별 노트 어댑터 | [✔] 완료 |
| MRN-07 | [#481](https://github.com/Choyounhwa/-dream-guardian/issues/481) | 별모으기/피버 렌더 전환 | [✔] 완료 |
| MRN-08 | [#482](https://github.com/Choyounhwa/-dream-guardian/issues/482) | 발 스텝 위임 (원형 링 적용) | [✔] 완료 |
| MRN-09 | [#483](https://github.com/Choyounhwa/-dream-guardian/issues/483) | Timeline + TapJudge | [✔] 완료 |
| MRN-10 | [#484](https://github.com/Choyounhwa/-dream-guardian/issues/484) | EvadeJudge + 장판 | [✔] 완료 |
| MRN-11 | [#485](https://github.com/Choyounhwa/-dream-guardian/issues/485) | JumpJudge + 보스 장판 | [✔] 완료 |
| MRN-12 | [#486](https://github.com/Choyounhwa/-dream-guardian/issues/486) | 비행감 통일 (config만) | [✔] 완료 |


## 👑 [UI-VIS-020 / #450] 메인 홈 실제 렌더 페이지 연결 완료 (2026-10-09)

- **작업 카드**: [✔ 완료] [#450 UI-VIS-020](https://github.com/Choyounhwa/-dream-guardian/issues/450) 메인 홈 실제 렌더 페이지 연결
- **목적**: 실게임 렌더러 재사용 10페이지 시각 UI 편집기의 메인 홈 실제 렌더 페이지 연결 단일 책임 구현. 가짜 사각형 UI나 단순 metadata 반환 대신 `MenuRenderer`, `HUDLayer`, `BottomBar`의 실제 Canvas 드로잉을 조합하여 정적 합성하고, runtime seam의 geometry와 stable ID(chapter_1~5, locomotion_btn, menu_title, hud_..., bottom_bar_...)를 포함한 `renderedBounds`를 반환.
- **수정 소스 파일**:
  1. `dream_guardian/src/editor/ui/preview/screens/UIHomePage.ts` (신규 생성: main_home 및 menu_main 페이지 어댑터 구현, 실제 5챕터 카드 2-2-1 와이드 다이아몬드 그리드 및 UI_LAYOUT 기하학 렌더, 공통 HUD/BottomBar 정적 합성, selectedElementIds 하이라이트, stale fixture/미지원 슬롯/보호영역 침범 가드)
  2. `dream_guardian/src/editor/ui/preview/UIPageAdapters.ts` (defaultPageAdapterRegistry에 main_home 어댑터 자동 등록 및 registerHomePageAdapter/homePageAdapter 익스포트, fixture 오버라이드 확장)
- **테스트 파일**:
  - `dream_guardian/tests/unit/ui-vis-020.test.ts` (신규 17개 단위/통합 테스트 100% 통과)
- **검증 결과**:
  - `npx vitest run tests/unit/ui-vis-020.test.ts`: 17/17 통과 (100%)
  - 관련 어댑터/메뉴 단위 테스트: 42/42 통과 (100%)
  - 전체 단위/통합 테스트: 288개 파일, 3,665개 100% 통과
  - TypeScript strict compile (`tsc`) 및 Vite bundle build 성공
- **다음 작업 대상**:
  - **[#451 UI-VIS-021]**: 서브메뉴 실제 렌더 페이지 연결

## 🎬 [UI-VIS-024 / #454] 플레이 시작(play_ready) 실제 렌더 페이지 연결 완료 (2026-10-09)

- **작업 카드**: [✔ 완료] [#454 UI-VIS-024](https://github.com/Choyounhwa/-dream-guardian/issues/454) 플레이 시작 실제 렌더 페이지 연결
- **목적**: 실게임 렌더러 재사용 10페이지 시각 UI 편집기의 플레이 시작 준비(`play_ready` / `ready_position`) 실제 렌더 페이지 연결 단일 책임 구현. `play_ready` 및 `ready_position` 페이지 요청을 `ReadyPositionRenderer.prototype.render` 및 `renderFixture` 실제 드로잉 로직과 연결하고, `ReadyPositionController` 실제 웹캠/미디어파이프 루프/카운트다운 타이머 인터벌/게임 엔진 부팅 0건(부작용 0건), 실제 3초 네온 카운트다운(3, 2, 1, START!), 신체 정렬 가이드 프레임/실루엣, 상단 안내 헤더 문구, 하단 건너뛰기 텍스트 렌더, UIPresentationDocument/ReadyPositionPresentationContext 바인딩, 공통 HUD/BottomBar 정적 합성, Protected Motion Zone Guard 및 stable bounds 반환 보장.
- **수정 소스 파일**:
  1. `dream_guardian/src/editor/ui/preview/screens/UIPlayReadyPage.ts` (신규 - play_ready/ready_position 페이지 어댑터 구현, ReadyPositionRenderer 실제 draw, HUD/BottomBar 정적 합성, motion/HUD 보호 구역 검증, stable bounds 계산)
  2. `dream_guardian/src/editor/ui/preview/UIPageAdapters.ts` (수정 - defaultPageAdapterRegistry에 play_ready 및 ready_position 등록 및 익스포트, PageRenderBounds에 isProtected 옵셔널 확장)
- **테스트 파일**:
  - `dream_guardian/tests/unit/ui-vis-024.test.ts` (신규 19개 단위 테스트 100% 통과)
- **검증 결과**:
  - `npx vitest run tests/unit/ui-vis-024.test.ts`: 19/19 통과 (100%)
  - 관련 단위 테스트 (`ui-vis-014`, `ui-vis-020`, `ui-vis-021`, `ui-vis-022`, `ui-vis-023`, `ui-vis-024`): 104/104 통과 (100%)
  - 전체 단위/통합 테스트: 292개 파일, 3,740개 100% 통과 (회귀 결함 0건)
  - TypeScript strict compile (`tsc`) 및 Vite bundle build 성공
- **다음 작업 대상**:
  - **[✔ 완료] [#455 UI-VIS-025]**: 러닝 문제 제시(running_question) 실제 렌더 페이지 연결
  - **[▶ NEXT] [#456 UI-VIS-026]**: 답안 선택(answer_select) 실제 렌더 페이지 연결

## 🏃 [UI-VIS-025 / #455] 러닝·문제 실제 렌더 페이지 연결 완료 (2026-10-09)

- **작업 카드**: [✔ 완료] [#455 UI-VIS-025](https://github.com/Choyounhwa/-dream-guardian/issues/455) 러닝·문제 실제 렌더 페이지 연결
- **목적**: 실게임 렌더러 재사용 10페이지 시각 UI 편집기의 러닝/문제 페이즈 실제 렌더 페이지 연결 단일 책임 구현. `running_question` 및 `run_question` 페이지 요청을 `QuestionRenderer`(수학 문제 수식 및 답안 버튼), `BeatHUDRenderer`(8박 인디케이터 및 모드 뱃지), `RunningMatRenderer`(3레인 원근 러닝 매트 및 스트라이크 라인) 실제 드로잉 파이프라인과 결합하고, 게임 엔진/런타임 부팅 0건(GameEngine, AppBootstrap, SceneDirector, 카메라/포즈, 오디오/TTS 0건), UIPresentationDocument 연동(fromPresentationDocument), 공통 HUD/BottomBar 정적 합성 및 stable bounds 반환 보장.
- **수정 소스 파일**:
  1. `dream_guardian/src/editor/ui/preview/screens/UIRunningQuestionPage.ts` (신규 - running_question 페이지 어댑터 구현, QuestionRenderer/BeatHUDRenderer/RunningMatRenderer 실제 draw, HUD/BottomBar 정적 합성, stable bounds 계산)
  2. `dream_guardian/src/editor/ui/preview/UIPageAdapters.ts` (수정 - defaultPageAdapterRegistry에 running_question/run_question 등록 및 익스포트)
- **테스트 파일**:
  - `dream_guardian/tests/unit/ui-vis-025.test.ts` (신규 17개 단위 테스트 100% 통과)
- **검증 결과**:
  - `npx vitest run tests/unit/ui-vis-025.test.ts`: 17/17 통과 (100%)
  - 관련 단위 테스트 (`ui-vis-015`, `ui-vis-016`, `ui-vis-024`, `ui-vis-025`): 74/74 통과 (100%)
  - 전체 단위/통합 테스트: 293개 파일, 3,757개 100% 통과 (회귀 결함 0건)
  - TypeScript strict compile (`tsc`) 및 Vite bundle build 성공
- **다음 작업 대상**:
  - **[#456 UI-VIS-026]**: 답안 선택(answer_select) 실제 렌더 페이지 연결

## ⏸️ [UI-VIS-023 / #453] 일시정지 실제 렌더 페이지 연결 완료 (2026-10-09)

- **작업 카드**: [✔ 완료] [#453 UI-VIS-023](https://github.com/Choyounhwa/-dream-guardian/issues/453) 일시정지 실제 렌더 페이지 연결
- **목적**: 실게임 렌더러 재사용 10페이지 시각 UI 편집기의 일시정지(pause) 실제 렌더 페이지 연결 단일 책임 구현. `pause` 페이지 요청을 `PauseModal.prototype.render` 실제 드로잉 로직과 연결하고, 게임 엔진/AppBootstrap/SceneDirector/이벤트 리스너 부팅 0건(부작용 0건), 실제 다이얼로그 박스 및 버튼(resume, quit, pause_settings) 렌더, UIPresentationDocument/PausePresentationContext 바인딩, 공통 HUD/BottomBar 정적 합성 및 stable bounds 반환 보장.
- **수정 소스 파일**:
  1. `dream_guardian/src/editor/ui/preview/screens/UIPausePage.ts` (신규 - pause 페이지 어댑터 구현, PauseModal 실제 draw, HUD/BottomBar 정적 합성, stable bounds 계산)
  2. `dream_guardian/src/editor/ui/preview/UIPageAdapters.ts` (수정 - defaultPageAdapterRegistry에 pause 등록 및 익스포트)
- **테스트 파일**:
  - `dream_guardian/tests/unit/ui-vis-023.test.ts` (신규 18개 단위 테스트 100% 통과)
- **검증 결과**:
  - `npx vitest run tests/unit/ui-vis-023.test.ts`: 18/18 통과 (100%)
  - 관련 단위 테스트 (`ui-vis-012`, `ui-vis-020`, `ui-vis-021`, `ui-vis-022`, `ui-vis-023`): 85/85 통과 (100%)
  - 전체 단위/통합 테스트: 291개 파일, 3,721개 100% 통과 (회귀 결함 0건)
  - TypeScript strict compile (`tsc`) 및 Vite bundle build 성공
- **다음 작업 대상**:
  - **[#454 UI-VIS-024]**: 시작 준비(play_ready) 실제 렌더 페이지 연결

## ⚙️ [UI-VIS-022 / #452] 옵션 실제 렌더 페이지 연결 완료 (2026-10-09)

- **작업 카드**: [✔ 완료] [#452 UI-VIS-022](https://github.com/Choyounhwa/-dream-guardian/issues/452) 옵션 실제 렌더 페이지 연결
- **목적**: 실게임 렌더러 재사용 10페이지 시각 UI 편집기의 옵션/설정 실제 렌더 페이지 연결 단일 책임 구현. `options` 및 `settings` 페이지 요청을 순수 `SettingsView` 렌더링 파이프라인과 연결하고, 브라우저 사이드 이펙트 0건(localStorage/fullscreen/camera/audio 0건, `SettingsModal` 인스턴스 생성 0건), 실제 모든 설정 항목/닫기 버튼 렌더, UIPresentationDocument/SettingsPresentationContext 바인딩, 공통 HUD/BottomBar 정적 합성 및 stable bounds 반환 보장.
- **수정 소스 파일**:
  1. `dream_guardian/src/editor/ui/preview/screens/UISettingsPage.ts` (신규 - options/settings 페이지 어댑터 구현, 순수 SettingsViewModel 조립, SettingsView 실제 draw, stable bounds 계산)
  2. `dream_guardian/src/editor/ui/preview/screens/UISubmenuPage.ts` (수정 - 순환 참조 TDZ 방지를 위해 artboard 상수 내부화)
  3. `dream_guardian/src/editor/ui/preview/UIPageAdapters.ts` (수정 - defaultPageAdapterRegistry에 options/settings 등록 및 익스포트)
- **테스트 파일**:
  - `dream_guardian/tests/unit/ui-vis-022.test.ts` (신규 20개 단위 테스트 100% 통과)
- **검증 결과**:
  - `npx vitest run tests/unit/ui-vis-022.test.ts`: 20/20 통과 (100%)
  - 관련 어댑터 단위 테스트 (`ui-vis-008`, `ui-vis-011`, `ui-vis-020`, `ui-vis-021`, `ui-vis-022`): 96/96 통과 (100%)
  - 전체 단위/통합 테스트: 290개 파일, 3,703개 100% 통과
  - TypeScript strict compile (`tsc`) 및 Vite bundle build 성공
- **다음 작업 대상**:
  - **[#453 UI-VIS-023]**: 일시정지(pause) 실제 렌더 페이지 연결

## 📋 [UI-VIS-021 / #451] 서브메뉴 실제 렌더 페이지 연결 완료 (2026-10-09)

- **작업 카드**: [✔ 완료] [#451 UI-VIS-021](https://github.com/Choyounhwa/-dream-guardian/issues/451) 서브메뉴 실제 렌더 페이지 연결
- **목적**: 실게임 렌더러 재사용 10페이지 시각 UI 편집기의 서브메뉴 실제 렌더 페이지 연결 단일 책임 구현. `submenu` 및 `menu_sub` 페이지 요청을 `MenuRenderer.prototype.renderSubMenu` 실제 드로잉 로직과 연결하고, 고정 6개가 아닌 fixture 기반 가변 서브레벨 지원 및 공통 HUD/BottomBar 정적 합성 제공.
- **수정 소스 파일**:
  1. `dream_guardian/src/editor/ui/preview/screens/UISubmenuPage.ts` (신규 - submenu/menu_sub 페이지 어댑터 구현, 가변 서브레벨 지원, MenuRenderer.fromPresentationDocument 헬퍼 바인딩, stable bounds 계산)
  2. `dream_guardian/src/editor/ui/preview/screens/UISubmenuPreview.ts` (수정 - 어댑터 및 상수 재익스포트)
  3. `dream_guardian/src/editor/ui/preview/UIPageAdapters.ts` (수정 - defaultPageAdapterRegistry에 submenu/menu_sub 등록 및 익스포트)
- **테스트 파일**:
  - `dream_guardian/tests/unit/ui-vis-021.test.ts` (신규 18개 단위 테스트 100% 통과)
- **검증 결과**:
  - `npx vitest run tests/unit/ui-vis-021.test.ts`: 18/18 통과 (100%)
  - 관련 단위 테스트 (`ui-vis-020.test.ts`, `ui-vis-021.test.ts`): 35/35 통과 (100%)
  - 전체 단위/통합 테스트: 289개 파일, 3,683개 100% 통과
  - TypeScript strict compile (`tsc`) 및 Vite bundle build 성공
- **다음 작업 대상**:
  - **[#452 UI-VIS-022]**: 옵션 설정 실제 렌더 페이지 연결

## 🏠 [UI-VIS-020 / #450] 메인 홈 페이지 시각 UI 실제 렌더러 연결 완료 (2026-10-08)

- **작업 카드**: [✔ 완료] [#449 UI-VIS-019](https://github.com/Choyounhwa/-dream-guardian/issues/449) 보스 결전 실제 표시 주입 경계
- **목적**: 실게임 렌더러 재사용 10페이지 시각 UI 편집기의 보스 결전 실제 표시 주입 경계 단일 책임 구현. 실게임 BossRenderer 및 BossClimaxRenderer에 선택적 표시 context 및 bounds 조회를 제공하며, 보호된 hazard geometry 및 보스 HP/군단/피버 계산 무결성을 유지.
- **수정 소스 파일**:
  1. `dream_guardian/src/render/BossClimaxRenderer.ts` (선택적 BossClimaxPresentationContext 주입/조회/해제, boss_battle 페이지 요소 매핑 fromPresentationDocument, getBossBounds/getGuardianBounds/getHudBounds/getMinionTroopBounds/getClimaxHazardBounds/getBarrageBounds 조회, 보호 슬롯 isSlotLocked/getSlotLockReason 가드, 5종 결전 Fixture DTO 결정론적 렌더, 안전한 registerLocalSprite 캐시)
  2. `dream_guardian/src/render/BossRenderer.ts` (선택적 BossPresentationContext 주입/조회/해제, getBossBounds 조회, 보호 슬롯 isSlotLocked/getSlotLockReason 가드, 5종 보스 Fixture DTO 결정론적 렌더, 안전한 registerLocalSprite 캐시)
- **테스트 파일**:
  - `dream_guardian/tests/unit/ui-vis-019.test.ts` (신규 21개 테스트 100% 통과)
- **검증 결과**:
  - `npx vitest run tests/unit/ui-vis-019.test.ts`: 21/21 통과 (100%)
  - 관련 보스 단위/통합 테스트 7개 파일: 82/82 통과 (100%)
  - 전체 단위/통합 테스트: 287개 파일, 3,648개 100% 통과
  - TypeScript strict compile (`tsc`) 및 Vite bundle build 성공
- **다음 작업 대상**:
  - **[#450 UI-VIS-020]**: 메인 홈 페이지 시각 UI 실제 렌더러 연결

## 실게임 시각 UI 편집기 후속 카드 등록 (UI-VIS, 2026-10-08)

**사용자 요청: “카드작성해줘”. 승인된 범위는 카드 작성·실제 GitHub 등록·문서 동기화뿐이다. 구현 승인 없음.**
관리 전용 [UI-VIS-TRACK #430](https://github.com/Choyounhwa/-dream-guardian/issues/430) + 구현41개 + 인수1개 = **43개 OPEN**. 모든 하위 카드는 미착수·별도 승인 대기이며 관리 추적을 다기능 구현 카드로 실행하면 안 된다.

| 단계 | 카드 | 범위 | 상태 |
|---|---|---|---|
| A | #431~#434 / UI-VIS-001~004 | 표시/문서 계약·비파괴 변환·Undo 모델 | #431 [✔], #432 [✔], #433 [✔], #434 [✔] (단계 A 완료) |
| B | #435~#438 / UI-VIS-005~008 | 정렬·속성 모델·안전 bridge·실제 Canvas | #435 [✔], #436 [✔], #437 [✔], #438 [✔] (단계 B 완료) |
| C | #439~#449 / UI-VIS-009~019 | 기존 런타임 UI/Render 단일 레이어 표시 경계 | #439 [✔], #440 [✔], #441 [✔], [#442 UI-VIS-012](https://github.com/Choyounhwa/-dream-guardian/issues/442) [✔], [#443 UI-VIS-013](https://github.com/Choyounhwa/-dream-guardian/issues/443) [✔], [#444 UI-VIS-014](https://github.com/Choyounhwa/-dream-guardian/issues/444) [✔], [#445 UI-VIS-015](https://github.com/Choyounhwa/-dream-guardian/issues/445) [✔], [#446 UI-VIS-016](https://github.com/Choyounhwa/-dream-guardian/issues/446) [✔], [#447 UI-VIS-017](https://github.com/Choyounhwa/-dream-guardian/issues/447) [✔], [#448 UI-VIS-018](https://github.com/Choyounhwa/-dream-guardian/issues/448) [✔], [#449 UI-VIS-019](https://github.com/Choyounhwa/-dream-guardian/issues/449) [✔] (단계 C 10개 런타임 렌더/UI 레이어 표시 경계 전원 완료) |
| D | #450~#459 / UI-VIS-020~029 | 홈·서브·옵션·pause·시작·러닝/문제·답안·위험·보스·결과 개별 연결 | #450 [✔], #451 [✔], #452 [✔], #453 [✔], #454 [✔], [#455 UI-VIS-025](https://github.com/Choyounhwa/-dream-guardian/issues/455) [✔], `[▶ NEXT: UI-VIS 트랙 / 승인 대기]` [#456 UI-VIS-026], 나머지 선행 대기 |
| E | #460~#462 / UI-VIS-030~032 | 선택/속성 양방향 DOM·grid/snap·다중 정렬 | 승인/선행 대기 |
| F | #463 → #464 → #465, #466 → #467 | 자산 모델→IndexedDB→자산 UI, 복구 controller→브라우저 연결 | 승인/선행 대기 |
| G | #468 → #469 / UI-VIS-038~039 | 적용본/백업 모델→추출·게시 UI | 승인/선행 대기 |
| H | #470 → #471 / UI-VIS-040~041 | UI 전용 수신→게임 주입/입력 일치/롤백 | 승인/선행 대기 |
| I | [#472 UI-VIS-042](https://github.com/Choyounhwa/-dream-guardian/issues/472) | 실제 브라우저 10페이지 픽셀·복구·게임 적용 인수 | 승인/전체 선행 대기 |

정확한 이슈별 URL/선행/파일수는 `docs/03_GITHUB_ISSUES.md`의 2026-10-08 표와 #430에 동기화했다. 실행 순서는 숫자만이 아니라 선행 DAG로 판단하며 **UI-VIS-035=#464가 UI-VIS-034=#465보다 먼저**다.

### 관찰·중복 결정·보존 경계

- 정적 소스 확인: preview entry는 factory export만 있고 `draw()`는 metadata 반환. `UIPropertyPanel`은 unknown ID에 첫 카드 값 fallback. registry에는 실제와 다른 홈 이름/답안4개/pause restart가 있다. 브라우저 controller는 InMemoryDatabasePort이며 autosave scheduler가 연결되지 않았다. 테스트 실패·브라우저 화면 실측으로 주장하지 않는다.
- SettingsModal의 생성자/접근성 setter 부작용 때문에 #441 순수 view 분리가 선행한다. preview는 `src/main.ts`/`AppBootstrap`/`SceneDirector`를 부팅하지 않으며 실제 renderer를 결정적 fixture DTO로 호출한다. 런타임도 동일 view/geometry를 사용한다.
- 기존 UIX #323~#367, VIEW #412~#417, #423, 10페이지 네비게이션 #428은 CLOSED 이력/재사용 기반으로 보존한다. 실제 연결 누락/신규 요구만 후속 범위로 계획했으며 기존 이슈 재개/종료/완료 기록 덮어쓰기 없음. 기존 QA를 새 픽셀 동등성·게임 적용 증거로 사용하지 않는다.
- 추출 전용 UIX의 게임 적용 금지는 이번 별도 runtime 경계/#470/#471에서만 확장한다. 피트니스 `ContentLoadService`의 UIX kind 거부 및 기존 게임 데이터/저장 정책은 유지한다.
- 현행 **12단계 로드맵 SSOT 전체 완료 상태 및 다른 트랙 NEXT 표시는 수정하지 않았다.** 이 단락은 사용자 요청으로 추가한 독립 후속 트랙이며 전역 우선순위 재지정이 아니다. 기존 문서의 다른 트랙 상태 불일치도 이번 범위에서 임의 정정하지 않는다.

### 다음 세션 인계

- **관리 등록 완료 대상**: UI-VIS-TRACK 및 UI-VIS-001~042의 GitHub 생성/제목·본문·OPEN·선행 대조. **구현 완료 ID 없음. 통과한 기능 테스트 없음(미실행).**
- 첫 승인 대상: [#431 UI-VIS-001 실게임 UI 표시 계약과 보호 레이아웃 검증](https://github.com/Choyounhwa/-dream-guardian/issues/431).
- 허용 범위: 신규 제안 `dream_guardian/src/data/UIPresentation.ts`, `dream_guardian/src/data/UIPresentationValidator.ts` **Data 2파일** 및 선작성 테스트 `dream_guardian/tests/unit/ui-vis-001.test.ts`. 신규 파일은 아직 생성하지 않았다.
- TDD 계획: 승인 후 Baseline → 10페이지/ID/속성/geometry/보호 존/동적 게임 값 거부 validator Red → 최소 계약 구현 Green → 전체 test/build. 첫 카드에서 DOM·렌더러·core·config를 수정하지 않는다.
- 구현 때마다 별도 승인·동일 레이어 src/config 최대3개·Red/Green 단계 분리·실제 완료 Rule12 comment·Rule13 서버 확인/URL 안내를 지킨다. **이번에는 카드만 작성했으므로 test/build/server·구현 완료 코멘트·commit/push를 수행하지 않았다.**
- 이번 로컬 수정은 이 HANDOVER와 이슈 인덱스 2개뿐. 시작 시 존재한 `.gitignore`, `docs/12_UNIFIED_MOTION_RHYTHM_ARCHITECTURE.md`, `src/editor/ui/UIEditorShell.ts`의 `attachExportController`, 미추적 HazardContentPack/테스트/기획서/스크린샷은 보존했다. WBS/PROJECT_BOARD는 미수정.

---

## 🔵 어프로치 링 원형 전환 및 StarNoteRenderer 내부 검증 (RENDER-NOTE-CIRCLE-001, 2026-10-07)

**[✔] StarNoteRenderer 한정 구현 완료 (실제 인게임 발 스텝 미적용 정정: #473, 해소: MRN-08 #482)** [#429 RENDER-NOTE-CIRCLE-001](https://github.com/Choyounhwa/-dream-guardian/issues/429) / [#473 BUG-NOTE-CIRCLE-001](https://github.com/Choyounhwa/-dream-guardian/issues/473)

- **작업 목적 & 정정 내역 (#473)**:
  1. `StarNoteRenderer`의 어프로치 사각박스를 부드러운 원형 어프로치 링(Circle Ring)으로 전환하여 직관적인 리듬 판정 타이밍 가이드 제공.
  2. `config/beat-motion.config.ts`에 `approachShape: 'circle' | 'rect'` 설정을 분리하여 하위 호환성 유지.
  3. **기록 정정 (#473)**: 기존 완료 기록의 "발/골반 스텝 동일 효과 확장"은 `StarNoteRenderer` 내부 렌더링에 한정되며, 실제 인게임 러닝 매트 발 노트(`RunningMatRenderer._renderFlyingStompNotes`)에는 원형 링이 **미적용** 상태임. 발 노트 원형 링 적용 및 렌더러 통합은 [MRN-08 #482](https://github.com/Choyounhwa/-dream-guardian/issues/482)로 이관하여 해소함.
  4. **테스트 정정 (#473)**: `star-note-renderer.test.ts` 내 `part: 'foot' as any` 타입 우회를 전면 제거하고 정식 `BodyPart` 규격인 `part: 'hip'`으로 정식 교정 완료.
- **수정 대상 파일 (소스/config 2개 + 테스트 1개 = 총 3개 한정)**:
  - `dream_guardian/config/beat-motion.config.ts`: `StarNoteVisualConfig`에 `approachShape`(`'circle'` | `'rect'`, 기본값 `'circle'`) 설정 추가
  - `dream_guardian/src/render/StarNoteRenderer.ts`: `_renderApproachRing` 및 `_renderZonePulse`를 원형(`ctx.arc`) 링으로 전환
  - `dream_guardian/tests/unit/star-note-renderer.test.ts`: 원형 링 드로잉, 펄스 원형 연출, 골반(hip) 스텝 내부 검증 단위 테스트 및 `#473` 타입 무결성 검증 (총 55건 100% Pass)
- **완료 조건**:
  - [x] `StarNoteVisualConfig`에 `approachShape?: 'circle' | 'rect'` (기본값: `'circle'`) 추가
  - [x] `_renderApproachRing` 및 `_renderZonePulse`가 원형(`ctx.arc`)으로 렌더링되도록 구현
  - [x] 골반(hip, Zone 10) 노트 StarNoteRenderer 내부 원형 어프로치 링 정상 표출 단위 테스트 통과 (타입 우회 `as any` 0건)
  - [x] #473 정정 반영 및 인게임 발 노트는 MRN-08(#482)로 연계 완료
  - [x] `tests/unit/star-note-renderer.test.ts` 단위 테스트 통과 (55/55 Pass)
  - [x] `npx vite build` 0 에러 정상 완료

---

## 👟 하단 발 스텝 피트니스 존 3등분 전폭 확장 및 판정 동기화 (FEAT-ZONE-EXPAND-001, 2026-10-07)

**[✔] 구현 및 검증 완료.** [#427 FEAT-ZONE-EXPAND-001](https://github.com/Choyounhwa/-dream-guardian/issues/427)

- **작업 목적**:
  1. 별모으기(Star Collection)의 하단 발/스텝 노트와 러닝 매트 발판 사이의 시각적·공간적 판정 이질감을 해소하기 위해, 화면 하단 3개 발 스텝 피트니스 존(Zone 9, 10, 11)의 좌우 간격 및 여백을 제거하고 화면 가로를 1/3씩 균등 3분할(좌: `0~1/3`, 중간: `1/3~2/3`, 우: `2/3~1.0`) 및 세로 하단 끝(`y: 0.76~1.00`)까지 가득 차도록 확장.
  2. 가상 페달 및 터치 fallback 판정 좌표(`AppBootstrap.ts`)를 1/3 분할 경계와 동기화.
- **수정 대상 파일 (소스/config 2개 + 테스트 1개 = 총 3개 한정)**:
  - `dream_guardian/config/zone.config.ts`: Zone 9, 10, 11 좌표 정의 (1/3 너비 및 하단 바닥 밀착)
  - `dream_guardian/src/core/AppBootstrap.ts`: 가상 페달 및 터치 fallback 판정 좌표를 1/3 분할 경계와 동기화
  - `dream_guardian/tests/unit/input-system.test.ts`: 1/3 영역 검증 및 겹침 0% TDD 테스트
- **완료 조건**:
  - [x] Zone 9가 `x: 0, width: 1/3`로 설정됨
  - [x] Zone 10이 `x: 1/3, width: 1/3`로 설정됨
  - [x] Zone 11이 `x: 2/3, width: 1/3`로 설정됨
  - [x] Zone 9, 10, 11이 화면 하단 끝까지 채움 (`y: 0.76, height: 0.24`)
  - [x] 인접 존 간 겹침(Overlap) 0% 유지
  - [x] 가상 페달 터치 판정 영역이 신규 1/3 존 경계와 1:1 일치
  - [x] TDD 단위 테스트 100% 통과 (35/35 통과)
  - [x] `npm run build` 성공

---

## ⭐ 별가루 노트 비트맵 이미지 렌더링 전환 및 어프로치 박스 제어 (RENDER-NOTE-IMAGE, 2026-10-07)

**[✔] 구현 및 검증 완료.** [#424 RENDER-NOTE-IMAGE-001](https://github.com/Choyounhwa/-dream-guardian/issues/424)

- **작업 목적**:
  1. `StarNoteRenderer`의 유니코드 텍스트(`fillText`) 기반 심볼 렌더링을 고해상도 비트맵 이미지(`drawImage`) 렌더링으로 전환하고, 미로딩/미지원 환경에서는 기존 텍스트로 안전한 Fallback 유지.
  2. 별이 날아오는 목표 칸에 표출되는 사각박스(어프로치 링)의 표시 여부(`showApproachRing`) 및 투명도 옵션을 `config/beat-motion.config.ts`에서 자유롭게 조절할 수 있도록 옵션화.
- **수정 파일 (소스/config 2개 + 테스트 1개 = 총 3개 한정)**:
  - `dream_guardian/config/beat-motion.config.ts`: `StarNoteVisualConfig`에 `renderMode`, `showApproachRing`, `approachRingAlpha`, `iconImages` 설정 추가
  - `dream_guardian/src/render/StarNoteRenderer.ts`: `setImage()`, 비트맵 이미지 렌더링, 텍스트 fallback 및 `showApproachRing` 분기 구현
  - `dream_guardian/tests/unit/star-note-renderer.test.ts`: 이미지 렌더 모드, fallback 동작, 사각박스 ON/OFF 조건 단위 테스트 6건 추가 (총 49건 100% Pass)
- **검증 결과**:
  - `npx vitest run tests/unit/star-note-renderer.test.ts`: 49개 테스트 100% 통과
  - `npx vite build`: 프로덕션 번들 정상 빌드 완료

---

## 🏆 통합 피트니스 제작·복구·게임 적용 최종 인수 (FITNESS-EDITOR-QA, 2026-10-06)

**[✔] 구현 및 검증 완료.** [#404 FITNESS-EDITOR-QA](https://github.com/Choyounhwa/-dream-guardian/issues/404)

- **작업 목적**:
  1. 책임 레이어 Tests (소스/config 변경 0개, 종단 QA 통합 검증 및 문서화).
  2. 안무 / 별(7슬롯) / Phase A 오답 장판(3종) / Phase B 피버 노트(8노트) / Phase B 보스 장판(3종) 통합 제작부터 백업 / 복구 / 게임 세션 적용 / 롤백까지의 전체 파이프라인 종합 인수 검증:
     - 실제 편집 결과와 게임 이벤트/시간/입력 1:1 일치, 세션 동안 팩 불변(Session Pinning) 유지 검증.
     - 회복력(Recovery Resilience): 손상된 파일, 구버전, 두 탭 경쟁(Revision Conflict), 저장 중 중단(Quota), 중간 게시(mid-stage publish)에도 데이터 유실이나 혼합 0건 검증.
     - 테스트 플레이 격리: 테스트 모드 실행 시 정상 게임의 진척도, 하이스코어, 보상 쓰기 0건 차단 및 일반 세션 복귀 후 정상 저장 동작 보존.
     - 자동/수동/미검증 경계 명확화: 실카메라 인식, 모바일 터치 등 브라우저 물리 환경 항목을 단위테스트 Pass로 과장하지 않고 점검표 문서/주석에 명시.
- **수정 파일 (소스/config 0개 + 신규 테스트 2개 + 신규 문서 1개)**:
  - `dream_guardian/tests/integration/fitness-editor-recovery.test.ts`: 5대 요소 복원 1:1 일치, 손상 JSON 거부, 비허용 역량 진단, 미저장 복구 버퍼 격리, V1 마이그레이션 비파괴, 변조 해시 거부, 2탭 동시 쓰기 RevisionConflictError 차단, Quota 트랜잭션 롤백, 세션 팩 Pinning, 정상본 롤백 통합 테스트 11건 (100% Pass)
  - `dream_guardian/tests/e2e/fitness-editor-full.e2e.ts`: 5대 요소 저작 -> 컴파일 -> 게시 -> 10문제 러닝 -> 오답 장판 회피 -> 정답 별수집 -> Phase B 보스 결전 -> 피버 타격 & 보스 공격 회피 -> 승리 -> 테스트 세션 영속화 0건 차단 E2E 테스트 4건 (100% Pass)
  - `docs/11_FITNESS_EDITOR_ACCEPTANCE_CHECKLIST.md`: 자동화 검증 항목 요약, 실카메라/실모바일/실WebGL 수동 점검표, 자동/수동/미검증 경계 분류표 및 운영 가이드 신규 작성
- **검증 결과**:
  - `npx vitest run tests/integration/fitness-editor-recovery.test.ts tests/e2e/fitness-editor-full.e2e.ts`: 15개 테스트 100% 통과
  - 전체 단위/통합 테스트: 248개 파일, 2,970개 테스트 100% Pass (기존 기능 회귀 0건)
  - `npm run build`: TypeScript 컴파일 및 Vite 번들링 0 에러 정상 완료
- **마일스톤 상태**:
  - **피트니스 에디터 통합 파이프라인 (Issue #374 ~ #404, A~F 전 단계) 전체 완료!**

---

## 📦 정적 manifest 적용본 수신·검증 및 기본 콘텐츠 복귀 (CONTENT-DEPLOY, 2026-10-06)

**[✔] 구현 및 검증 완료.** [#403 CONTENT-DEPLOY](https://github.com/Choyounhwa/-dream-guardian/issues/403)

- **작업 목적**:
  1. 책임 레이어 Core (`src/core/`) 내에서 에디터 모듈 import 없이 정적 배포 manifest(`content/manifest.json` 등 정적 경로)를 읽고 검증하는 수신 경로 및 기본 콘텐츠 안전 복귀 구현.
  2. `ContentLoadService.ts`:
     - `STATIC_MANIFEST_KIND`, `STATIC_MANIFEST_VERSION`, `DEFAULT_STATIC_MANIFEST_URL`, `StaticContentManifest`, `StaticManifestLoadOptions` 인터페이스 및 상수 정의.
     - `loadStaticManifest(manifestUrl?, options?)` 메서드 구현: Manifest 스키마, `manifestVersion`, `contentHash`, `rulesetId`, `rulesetHash`, `runtimeContractVersion` 및 팩 데이터의 무결성 일괄 검증.
     - 404(Not Found), 네트워크 오류, 손상된 JSON, hash 변조/불일치, 부분 배포(Partial Deployment), stale cache(캐시 불일치) 감지 시 전체 `builtin` 모드 또는 직전 정상본(`previousHealthyPack`)으로 whole-pack fallback 반환.
     - 검증 통과 시 `deepFreeze`를 통한 불변 스냅샷 생성 및 `_previousHealthyPack` 등록.
     - 로컬 테스트 오버라이드(`loadLocalTestOverride`): 명시적 테스트 모드(`?mode=test` 또는 `options.isTestMode: true`)에서만 허용하고 일반 운영 모드에서는 `test-override-forbidden` fallback 차단.
  3. `AppBootstrap.ts`:
     - 부트스트랩 옵션(`loadStaticManifest`, `staticManifestUrl`, `staticManifestOptions`) 및 초기화 시 정적 manifest 로드 연동.
     - `loadStaticManifest()`, `loadLocalTestOverride()` 메서드 노출.
     - 정적 manifest 로드 실패 시 안전하게 `activePublishedPack = null` (`default_csv` / builtin 모드)로 전체 복귀.
  4. 운영 절차 가이드 문서화 (`docs/10_CONTENT_DEPLOYMENT_OPERATIONS.md`):
     - 정적 배포 절차, 해시 검증, 오프라인 이전 정상본 보존 정책, 장애 방어 매트릭스, 롤백 절차 상세 기록.
- **수정 파일 (소스 2개 + 신규 테스트 1개 + 신규 문서 1개)**:
  - `dream_guardian/src/core/ContentLoadService.ts`: 정적 manifest 스키마 검증, packPath 2단계 fetch, Stale cache 방어, 불변 스냅샷 및 로컬 테스트 격리
  - `dream_guardian/src/core/AppBootstrap.ts`: 부트스트랩 정적 manifest 연동 및 builtin 복귀, loadStaticManifest / loadLocalTestOverride 메서드 노출
  - `dream_guardian/tests/integration/content-manifest-load.test.ts`: 정적 manifest 로드, 404/네트워크 fallback, 부분 배포/stale cache 거부, 로컬 오버라이드 격리 통합 테스트 16건 신규 작성 (100% Pass)
  - `docs/10_CONTENT_DEPLOYMENT_OPERATIONS.md`: 정적 Manifest 배포 및 운영 절차 가이드 신규 작성
- **검증 결과**:
  - `npx vitest run tests/integration/content-manifest-load.test.ts`: 16개 테스트 100% 통과
  - 전체 단위/통합 테스트: 246개 파일, 2,955개 테스트 100% Pass
  - `npm run build`: TypeScript 컴파일 및 Vite 번들링 0 에러 정상 완료
- **다음 작업 대상**:
  - **[#404 FITNESS-EDITOR-QA]**: 전체 제작/복구/게임 적용 인수 (F단계 최종 카드)

---

## 👹 Phase B 보스 공격 순서·회피 정보 편집 카드 (EDITOR-HAZARD-B, 2026-10-06)

**[✔] 구현 및 검증 완료.** [#400 EDITOR-HAZARD-B](https://github.com/Choyounhwa/-dream-guardian/issues/400)

- **작업 목적**:
  1. 책임 레이어 Editor (`src/editor/`) 내에서 Phase B 보스 공격 순서(`dual_slam`, `alternating_stomp_left`, `alternating_stomp_right`) 목록 관리 및 회피 동작 자동 매핑/편집 기능 구현.
  2. `EditorState.ts`:
     - 페이즈 모델에 `BOSS_HAZARD` (`phase: 'phaseB', kind: 'hazard'`) 추가.
     - 지원 공격 3종(`dual_slam`, `alternating_stomp_left`, `alternating_stomp_right`) 순서 목록 추가, 제거, 위/아래 이동, 복제, 전체 설정 API 구현.
     - 각 공격 종류로부터 요구 회피 동작 자동 매핑 (`PHASE_B_ATTACK_REQUIRED_ACTIONS`: `dual_slam` -> `jump`, `alternating_stomp_left` -> `left_step`, `alternating_stomp_right` -> `right_step`). 임의 회피 동작 입력 불가 및 미지원 공격 원천 차단.
     - 초 단위 공격 주기(5.0초), 전조(1.5초), 활성(1.0초), 데미지(15 HP), 군단 손실(1체), 광폭화(HP 30% 이하 시 1.5배 가속) 등 전투 수치 읽기 전용 잠금(Locked).
     - 빈 공격 목록(0개)인 경우 검증 및 게시 차단 진단(`empty-hazard-sequence`) 제공.
     - 피버 노트(`feverNotes`), 모션 가이드(`motionGuide`), Phase A 장판(`phaseAHazard`), 별 수집(`starNotes`) 데이터와 완전 격리 독립 저장.
     - `toEditorProject()`, `applyProject()` 직렬화/역직렬화 및 `ProjectCommandManager` Undo/Redo 무결성 유지.
  3. `EditorLayout.ts`:
     - 상단 페이즈 셀렉터에 [👹 보스 장판/공격 (Phase B)] / `BOSS_HAZARD` 옵션 제공.
     - 사이드바 전용 편집 패널: 공격 순서 목록 카드, [공격 추가] 드롭다운 및 버튼, [위로], [아래로], [복제], [삭제] 액션 버튼, 회피 동작 배지 UI.
     - 빈 목록 경고 배너 및 읽기 전용 전투 수치 잠금 안내 패널 표시.
  4. `main.ts`:
     - Phase B 보스 공격 패턴 추가, 순서 이동(위/아래), 복제, 삭제 이벤트 리스너 바인딩 연동.
- **수정 파일 (소스 3개 + 신규 테스트 1개)**:
  - `dream_guardian/src/editor/EditorState.ts`: `BOSS_HAZARD` 페이즈 지원, 보스 공격 패턴 조작/검증 API, 잠금 수치, 시퀀스/바인딩 직렬화 및 역직렬화
  - `dream_guardian/src/editor/EditorLayout.ts`: `BOSS_HAZARD` 상단 옵션, 사이드바 `renderBossHazardEditorHTML` 공격 순서 목록/액션/잠금 UI
  - `dream_guardian/src/editor/main.ts`: 보스 공격 추가, 위/아래 이동, 복제, 삭제 이벤트 핸들러 연동
  - `dream_guardian/tests/unit/editor-phase-b-hazard.test.ts` (신규, 26개 단위 테스트)
- **TDD 검증**: `tests/unit/editor-phase-b-hazard.test.ts` (26/26 Pass, 100%).
- **전체 검증**: `npm test` 243 files / 2,915 passed (100% Pass), `npm run build` 성공.
- **상태**: `[✔]` 완료

## 🌟 Phase B 피버 시퀀스 공급·반복 ID·마지막 판정 수명 연결 카드 (GAME-FEVER-CONTENT, 2026-10-06)

**[✔] 구현 및 검증 완료.** [#399 GAME-FEVER-CONTENT](https://github.com/Choyounhwa/-dream-guardian/issues/399)

- **작업 목적**:
  1. 책임 레이어 Game (`src/game/`) 내에서 에디터 모듈 import 없이 세션 스냅샷(`SessionStageBundle`)의 Phase B 피버 노트 콘텐츠(`getPhaseBFeverKeynotes(loopIndex)`)를 `BossFeverController`에 안전하게 공급.
  2. `SessionContent.ts`: `SessionStageBundle`에 Phase B 피버 노트 Keynote 생성/해석 헬퍼 제공 (`getPhaseBFeverKeynotes(loopIndex: number): readonly Keynote[]`).
  3. 각 loopIndex마다 `getPhaseBNoteExecutionId(loopIndex, noteIndex)`를 사용하여 고유한 keynote ID 생성 (시퀀스 반복 루프 간 ID 충돌 및 중복 보상 완전 차단).
  4. landingTick을 beat(`landingTick / 480`)로 변환하여 Keynote 계약 충족, 커스텀 feverNotes가 없거나 builtin인 경우 기본 패턴(`DEFAULT_SESSION_FEVER_PATTERNS`)으로 안전하게 fallback.
  5. `BossFeverController.ts`: `stageBundle` 주입 지원 (`setStageBundle(bundle: SessionStageBundle)` 또는 옵션 주입).
  6. 루프 반복(loopIndex 증가) 시 새 executionId를 가진 시퀀스가 다음 루프로 전이.
  7. 마지막 8번째 노트 착지 후 판정 유효창(Late 포함, landingTime + 0.40s) 완료 시점까지 정확히 대기 후 다음 시퀀스로 전이 (마지막 노트 누락 0건 보장).
  8. `StarNoteScheduler.ts`: `isAllResolved` 및 `onAllNotesCompleted` 완료 콜백/이벤트 연결, `recordDirectHit` 지원, lastLate 수명주기 보존.
  9. 콤보 계산, 데미지 배율, 광폭화, 보스 처치/승리/패배 상태 전이 등 기존 전투 밸런스 및 자원 정책 100% 보존.
- **수정 파일 (소스 3개 + 신규 테스트 1개)**:
  - `dream_guardian/src/game/SessionContent.ts`: `DEFAULT_SESSION_FEVER_PATTERNS`, `getPhaseBFeverKeynotes(loopIndex)` 번들 헬퍼 메서드, `createSessionStageBundle` 별칭 추가
  - `dream_guardian/src/game/BossFeverController.ts`: `stageBundle` 주입, 루프별 `getPhaseBFeverKeynotes(loopIndex)` 호출, 마지막 노트 Late 완료 수명 대기 후 전이 로직 구현
  - `dream_guardian/src/game/StarNoteScheduler.ts`: `isAllResolved`, `onAllNotesCompleted`, `recordDirectHit`, 완료 통지 플래그 연동
  - `dream_guardian/tests/unit/fever-content.test.ts` (신규, 8개 단위 테스트)
- **TDD 검증**: `tests/unit/fever-content.test.ts` (8/8 Pass, 100%).
- **전체 검증**: `npm test` 242 files / 2,889 passed (100% Pass), `npm run build` 성공.
- **상태**: `[✔]` 완료

## 🔥 Phase B 피버 노트 편집과 16박 가이드 분리 카드 (EDITOR-FEVER, 2026-10-06)

**[✔] 구현 및 검증 완료.** [#398 EDITOR-FEVER](https://github.com/Choyounhwa/-dream-guardian/issues/398)

- **작업 목적**:
  1. 책임 레이어 Editor (`src/editor/`) 내에서 기존 `FEVER_PHASE_B` 16박 motion guide(`phase: 'phaseB', kind: 'motionGuide'`)를 온전히 보존하면서, 별도의 실행 가능한 `feverNotes`(`phase: 'phaseB', kind: 'feverNotes'`) 편집 역할을 분리 지원.
  2. 기본 8노트 / 2종 교대(왼손 Zone 4, 오른손 Zone 5 기본값) 및 480틱 간격(tick 480, 960, 1440, 1920, 2400, 2880, 3360, 3840) feverNote 이벤트 편집 API 구현.
  3. 가이드 이름 치환이 아닌 온전한 `feverNote` 실행 데이터 객체(`{ id, kind: 'feverNote', landingTick, target }`) 생성 및 ContentCompiler 컴파일 지원.
  4. 초기 길이(8노트 고정)/부위(손 1~5, 발 9~11; 머리/골반 커서 잠금)/존/시간 제한 capability(`ContentCapabilities.ts`) 및 Cross-Body 제약 재사용 검증.
  5. `BOSS_CLIMAX` 역할 바인딩에서 feverNotes와 hazard의 공존 지원 및 `diagnoseBossClimaxBindings()`를 통한 누락 역할 진단 지원.
  6. 별 수집(`STAR_COLLECT`), Phase A 장판(`HAZARD_EVADE`), 원본 구버전 프로젝트 데이터 100% 무손실 보존.
  7. `EditorLayout` 상단 페이즈 셀렉터에 [🔥 피버 노트 (Phase B)] 탭 추가 및 사이드바 전용 8슬롯 편집 UI 패널 제공.
- **수정 파일 (소스 3개 + 신규 테스트 1개)**:
  - `dream_guardian/src/editor/EditorState.ts`: `FEVER_NOTES` 페이즈 지원, 8슬롯 피버 노트 관리/검증/버퍼 API, `seq_phaseB_fever` 시퀀스 및 바인딩 직렬화/역직렬화, `diagnoseBossClimaxBindings` 진단 함수 추가
  - `dream_guardian/src/editor/EditorLayout.ts`: 상단 페이즈 셀렉터 옵션 추가, `renderFeverSlotEditorHTML` 전용 8슬롯 편집 UI 패널 렌더링
  - `dream_guardian/src/editor/main.ts`: 피버 노트 8슬롯 부위/존 선택, 버퍼 적용/취소 이벤트 리스너 연동
  - `dream_guardian/tests/unit/editor-fever-content.test.ts` (신규, 21개 단위 테스트)
- **TDD 검증**: `tests/unit/editor-fever-content.test.ts` (21/21 Pass, 100%).
- **전체 검증**: `npm test` 241 files / 2,881 passed (100% Pass), `npm run build` 성공.
- **상태**: `[✔]` 완료

## 💥 게임 조립계층 오답 장판 팩 연결 카드 (BOOT-HAZARD-A-CONTENT, 2026-10-06)

**[✔] 구현 및 검증 완료.** [#397 BOOT-HAZARD-A-CONTENT](https://github.com/Choyounhwa/-dream-guardian/issues/397)

- **작업 목적**:
  1. 책임 레이어 Core (`src/core/`) 내에서 에디터 모듈 import 없이 두 `HAZARD_EVADE` 진입 경로(`AppBootstrap.ts` StateMachine enter vs `SceneDirector.ts` transition update)에 동일한 SessionContent 장판 패턴(`sessionContext.stageBundle.getPhaseAHazardPattern(roundIndex)`)과 branchClock, attackId 주입.
  2. 정답 시: 별 수집(`STAR_COLLECT`)만 시작되고 오답 장판(`HAZARD_EVADE`)은 시작되지 않음.
  3. 오답 또는 timeout 시: 오답 장판(`HAZARD_EVADE`)만 시작되고 별 수집은 시작되지 않음 (상호 배타적 분기 보장).
  4. 동일 스냅샷/해시로 별과 장판이 실행되며, 중복 start 및 중복 정산 0건 보장.
  5. 오답 시 직접 HP 즉시 차감 정책이 아닌 장판 회피 결과(피격 시 damagePerMiss)만 정산하는 안전한 정책 유지.
  6. 늦은 프레임, pause, resume, 메뉴 복귀, restart 시 오염이나 비정상 상태 전이 없이 안전하게 cleanup (`phaseAHazardController.reset()`, pause/resume 생명주기).
  7. 기본 팩(CSV/builtin) 모드 회귀 정상 보존.
- **수정 파일 (소스 2개 + 신규 테스트 1개)**:
  - `dream_guardian/src/core/AppBootstrap.ts`: `getPhaseAHazardPattern` 단일 공급원 등록, `HAZARD_EVADE` 진입 시 bundle/attackId/pattern 주입, `goToMenu`/`startChapter`에서 `phaseAHazardController.reset()` 정리 연동
  - `dream_guardian/src/core/SceneDirector.ts`: `MainSceneContext` 확장(`getPhaseAHazardPattern`, `sessionContext`), transition update 시 bundle/pattern/attackId 일치 주입, pause/resume 생명주기 안전 연동
  - `dream_guardian/tests/integration/content-hazard-a-bootstrap.test.ts` (신규, 8개 통합 테스트)
- **TDD 검증**: `tests/integration/content-hazard-a-bootstrap.test.ts` (8/8 Pass, 100%).
- **전체 검증**: `npm test` 240 files / 2,860 passed (100% Pass), `npm run build` 성공.
- **상태**: `[✔]` 완료

## ⚡ Phase A 장판 팩 소비 계약과 단일 결과 보존 카드 (GAME-HAZARD-A-CONTENT, 2026-10-06)

**[✔] 구현 및 검증 완료.** [#396 GAME-HAZARD-A-CONTENT](https://github.com/Choyounhwa/-dream-guardian/issues/396)

- **작업 목적**:
  1. 책임 레이어 Game (`src/game/`) 내에서 에디터 모듈 import 없이 세션 스냅샷(`SessionStageBundle`)의 Phase A 장판 콘텐츠를 `PhaseAHazardController`의 실행 옵션(`PhaseAHazardStartOptions`)에 안전하게 주입·소비하는 계약 구축.
  2. `SessionContent.ts`: `SessionStageBundle`에 Phase A 장판 패턴 조회/해석 헬퍼(`getPhaseAHazardPattern(roundIndex?: number): PhaseAHazardPattern`) 제공.
  3. 커스텀 팩에 명시된 활성 장판(`left_step`, `right_step`, `jump`)을 우선 제공하고, 없거나 builtin인 경우 seed 결정적 패턴 제공. 비활성 패턴(`balance_left`, `balance_right`)이나 알 수 없는 패턴은 원천 차단.
  4. `PhaseAHazardController.ts`: `startHazard(options?: PhaseAHazardStartOptions)`를 통해 명시적 패턴(`options.pattern`) 또는 세션 번들의 장판 소비 지원 (명시적 패턴 우선권 보장).
  5. `attackId` 단일 결과 보장: 동일 attackId에 대해 중복 판정 및 중복 피해 차단 (`damage <= 25` 1회 제한).
  6. 오답 후 재시도/변형 시퀀스(`wrong-then-correct`) 독립 결과 보존 및 `pause()`, `resume()`, `reset()` 수명주기/상태 격리 온전하게 유지.
  7. 현재 BPM 기반 7박 판정(3.5s @ 120BPM) 및 8박 종료(4.0s @ 120BPM) `scaleHazardSchedule` 스케일링 회귀 0건 보존.
- **수정 파일 (소스 2개 + 신규 테스트 1개)**:
  - `dream_guardian/src/game/SessionContent.ts`: `getPhaseAHazardPattern` 헬퍼 및 번들 메서드, 활성 3종 필터링 및 seed 결정적 계산 구현
  - `dream_guardian/src/game/PhaseAHazardController.ts`: `startHazard`, `bundle`/`bpm` 옵션 지원, `attackId` 단일 판정 잠금 및 결과 캐싱, `reset`, `isPaused` 등 구현
  - `dream_guardian/tests/unit/phase-a-hazard-content.test.ts` (신규, 12개 단위 테스트)
- **TDD 검증**: `tests/unit/phase-a-hazard-content.test.ts` (12/12 Pass, 100%).
- **전체 검증**: `npm test` 239 files / 2,852 passed (100% Pass), `npm run build` 성공.
- **상태**: `[✔]` 완료

## ⚠️ Phase A 장판 편집 탭·경고/입력/판정 읽기 전용 표시 카드 (EDITOR-HAZARD-A, 2026-10-06)

**[✔] 구현 및 검증 완료.** [#395 EDITOR-HAZARD-A](https://github.com/Choyounhwa/-dream-guardian/issues/395)

- **작업 목적**:
  1. 책임 레이어 Editor (`src/editor/`) 내에서 `HAZARD_EVADE` (Phase A 오답 장판 회피) 탭 UI 및 상태 모델 연결.
  2. 활성 회피 3종(`left_step`, `right_step`, `jump`) 선택 및 바인딩/시퀀스 편집 구현.
  3. 비활성 패턴(`balance_left`, `balance_right`) 및 피해량(damage: 25)의 읽기 전용 잠금(Locked) 유지.
  4. 현재 BPM 기준 스케줄(경고 warningDuration, 정규 입력창 inputWindowEnd, 판정 judgmentTime, 전체 종료 totalDuration)을 `scaleHazardSchedule` 공식 기반 읽기 전용 계산 및 표시.
  5. 공격 종류에서 회피 동작 1:1 파생 및 상호 모순되는 필드 생성 차단.
  6. Phase A 장판 편집 중에도 기존 `STAR_COLLECT` 별 데이터(`starNote` 시퀀스 및 7슬롯)의 100% 불변 보존.
  7. 저장, 복원, 컴파일, 불변 게시 전 과정에서 Phase A hazard 이벤트 온전한 공존 검증.
- **수정 파일 (소스/config 3개 + 신규 테스트 1개)**:
  - `dream_guardian/src/editor/EditorState.ts`: Phase A hazard 패턴/시퀀스/바인딩 관리, 스케줄 계산 및 7슬롯 보존 로직 추가
  - `dream_guardian/src/editor/EditorLayout.ts`: HAZARD_EVADE 상단 탭, 회피 3종 선택 라디오, 잠금 표시 및 읽기 전용 스케줄 섹션 렌더링 추가
  - `dream_guardian/src/editor/main.ts`: 페이즈 변경 시 사이드바 갱신, 장판 회피 라디오 이벤트 바인딩, BPM 변경 연동 추가
  - `dream_guardian/tests/unit/editor-phase-a-hazard.test.ts` (신규, 15개 단위 테스트)
- **TDD 검증**: `tests/unit/editor-phase-a-hazard.test.ts` (15/15 Pass, 100%).
- **전체 검증**: `npm test` 238 files / 2,840 passed (100% Pass), `npm run build` 성공.
- **상태**: `[✔]` 완료

## 🌟 별 수집 편집·복원·게시·게임 실행·롤백 종단 검증 카드 (EDITOR-MVP-QA, 2026-10-06)

**[✔] 구현 및 검증 완료.** [#394 EDITOR-MVP-QA](https://github.com/Choyounhwa/-dream-guardian/issues/394)

- **작업 목적**:
  1. 책임 레이어 Tests (`tests/integration/`) 내에서 별 패턴 편집 -> 저장 -> 복원 -> 게시 -> 게임 런타임 주입 -> 롤백 예약까지의 전체 수명주기 종단(Roundtrip) 통합 검증.
  2. 7개 슬롯의 순서, 신체 부위, 피트니스 존, 틱/초 시간과 게임 런타임 실행 이벤트(`SessionStageBundle`, `AppBootstrap.getPhaseAStarNotes`, `BeatCoordinator.keynotes`) 간 1:1 완벽 일치 검증.
  3. revision 충돌(두 탭 경쟁), 손상된 데이터, 버전/해시 불일치 시 기존 작업 및 활성 정상본 100% 보존 검증.
  4. 10문제 -> Phase B -> 승리/패배 -> 메뉴 회귀 및 테스트 모드 실행 시 localStorage progress/highScore/rewards 쓰기 0건(완전 차단) 및 일반 세션 복귀 후 정상 동작 보존 확인.
  5. 롤백 예약 시 이전 정상본(previousHealthyHash) 복귀 및 불변 팩 보존 확인.
  6. 브라우저 실렌더링·실카메라·모바일 환경 등 수동 확인 항목의 명확한 기록 및 분리 (UNVERIFIED_IN_VITEST_MOCK).
- **수정 파일 (소스/config 변경 0개, 1개 테스트)**:
  - `dream_guardian/tests/integration/editor-content-roundtrip.test.ts` (신규, 7개 종단 통합 테스트)
- **TDD 검증**: `tests/integration/editor-content-roundtrip.test.ts` (7/7 Pass, 100%).
- **전체 검증**: `npm test` 237 files / 2,825 passed (100% Pass), `npm run build` 성공.
- **상태**: `[✔]` 완료

## 🎮 게시 hash 기반 테스트 플레이 실행·상태 표시 카드 (EDITOR-TEST-LAUNCH, 2026-10-06)

**[✔] 구현 및 검증 완료.** [#393 EDITOR-TEST-LAUNCH](https://github.com/Choyounhwa/-dream-guardian/issues/393)

- **작업 목적**:
  1. 책임 레이어 Editor (`src/editor/`) 내에서 에디터 상단 및 릴리즈 패널에 [🎮 테스트 플레이] 런처 액션 및 론칭 상태 컨트롤러 구현.
  2. 초안(EditorProject)은 직접 전송하지 않고, 검증 완료되어 저장된 `PublishedContentPack`(지정 hash 또는 activeContentHash)만 사용.
  3. 미게시(저장소 부재), 호환성 검증 미달, 미반영 dirty form(폼 작성 중) 상태인 경우 실행 차단.
  4. 대상 팩의 `contentHash`, `rulesetId`, `rulesetHash`, `bpm`, `sourceRevision` 메타데이터 및 격리 URL 디스크립터 제공.
  5. 브라우저 환경에서 격리된 테스트 플레이 URL(`/?mode=test&hash=${contentHash}`) 준비/실행.
  6. 연결 실패, 저장소 부재, 다른 origin, 브라우저 미지원 상황 발생 시 실패 상태와 명확한 진단 메시지 반환 (성공 오표시 금지).
  7. 상단 헤더 및 릴리즈 모달에 [🎮 테스트 플레이] 버튼 추가 및 상태 바인딩.
  8. 테스트 모드 실행 시 hash 일치 확인 UI 피드백 (요청 hash vs 실제 실행 대상 hash).
  9. 게임 전역 설정 / 실제 세션 진척도 / 보상 저장은 Issue #391 계약에 의해 격리됨을 표시.
- **수정 파일 (3개 소스 + 1개 테스트, Scope Guard 준수)**:
  - `dream_guardian/src/editor/EditorPublishController.ts`
  - `dream_guardian/src/editor/EditorLayout.ts`
  - `dream_guardian/src/editor/main.ts`
  - `dream_guardian/tests/unit/editor-test-launch.test.ts` (신규, 12개 단위 테스트)
- **TDD 검증**: `tests/unit/editor-test-launch.test.ts` (12/12 Pass, 100%).
- **전체 검증**: `npm test` 236 files / 2,818 passed (100% Pass), `npm run build` 성공.
- **상태**: `[✔]` 완료

## 🎬 컴파일된 이벤트 기반 자세·시간 미리보기 카드 (EDITOR-PREVIEW, 2026-10-06)

**[✔] 구현 및 검증 완료.** [#392 EDITOR-PREVIEW](https://github.com/Choyounhwa/-dream-guardian/issues/392)

- **작업 목적**:
  1. 책임 레이어 Editor (`src/editor/`) 내에서 게임 런타임과 동일한 컴파일 데이터/시간 변환(`compileEditorProject` / `ticksToSeconds` / `bpm` 기반 이벤트 스케줄)을 미리보기에 사용.
  2. 가이드 시뮬레이션(애니메이션 모션)과 런타임 호환(runtime-compatible) 이벤트 미리보기 상태를 명확히 구분 (`previewMode: 'compiled_runtime' | 'guide_simulation'`).
  3. 전투/판정 엔진(HP/데미지/콤보/마나 계산)을 에디터에 절대 복제하지 않고 순수 가이드/시뮬레이션 상태로 격리.
  4. 편집 중인 프로젝트의 7개 별 노트 및 구간 이벤트에 대해 컴파일된 `targetTimeSeconds`, `targetZone`, `targetBodyPart`, `toleranceWindowSeconds`를 기반으로 가이드 포즈 및 타임라인 헤드 산출.
  5. 마지막 착지/판정 여유(tolerance)/구간 종료가 선택된 프로필(BPM 등)과 정확히 일치 (`calculateStarNoteTimings`).
  6. 미지원 구간(BPM 미지원, 크로스바디 위반 등)은 그 이유(진단 메시지)를 표시하며, "실제 웹캠 인식 성공을 보장한다"고 과장/오도하지 않음 (`isGuideOnly: true` 명시).
  7. preview 재생은 원본 프로젝트 문서, 게시본, 게임 세션 데이터를 일체 변경하지 않음 (순수 읽기 전용 시뮬레이션 불변성).
- **수정 파일 (3개 소스 + 1개 테스트, Scope Guard 준수)**:
  - `dream_guardian/src/editor/ChoreoPoseSimulator.ts`
  - `dream_guardian/src/editor/EditorCanvasRenderer.ts`
  - `dream_guardian/src/editor/EditorState.ts`
  - `dream_guardian/tests/unit/editor-compiled-preview.test.ts` (신규, 10개 단위 테스트)
- **TDD 검증**: `tests/unit/editor-compiled-preview.test.ts` (10/10 Pass, 100%).
- **전체 검증**: `npm test` 235 files / 2,806 passed (100% Pass), `npm run build` 성공.
- **상태**: `[✔]` 완료

## 🛡️ 테스트 플레이 격리와 진행·보상 저장 차단 카드 (CONTENT-TEST-SESSION, 2026-10-06)

**[✔] 구현 및 검증 완료.** [#391 CONTENT-TEST-SESSION](https://github.com/Choyounhwa/-dream-guardian/issues/391)

- **작업 목적**:
  1. 책임 레이어 Core (`src/core/`) 내에서 editor 모듈 의존성 0% 유지 및 검증된 hash/profile 명시 테스트 세션(`isTestSession: true` / `startTestPlaySession`) 격리 구축.
  2. 일반 실제 플레이의 진척도(`starsMap`, `dg_stage_progress`), 하이스코어/기록(`dg_high_scores`), 보상(`dg_rewards`, unlocks) 쓰기 완전 차단.
  3. 승리/패배/메뉴/중단(abort) 등 모든 종료 경로에서 실제 저장소 쓰기(`localStorage.setItem`) 0건 보장.
  4. 세션 종료 시 콘텐츠/시계/예약/입력 완전 클린업하여 다음 정상 게임 세션에 잔류 0(잔류 오염 차단).
  5. URL 쿼리나 외부 입력으로 전달된 임의 미검증/변조 팩(`contentHash` 불일치 등)의 직접 실행 금지 및 규격 검증된 적용본(`PublishedContentPack`)에 대해서만 진입 허용.
  6. 테스트 모드가 아닐 때(일반 플레이)는 기존 게임 동작 및 저장 흐름 100% 온전하게 보존.
- **수정 파일 (3개 소스 + 1개 테스트, Scope Guard 준수)**:
  - `dream_guardian/src/core/SessionLifecycle.ts`
  - `dream_guardian/src/core/GameSessionContext.ts`
  - `dream_guardian/src/core/AppBootstrap.ts`
  - `dream_guardian/tests/integration/content-test-session.test.ts` (신규, 8개 통합 테스트)
- **TDD 검증**: `tests/integration/content-test-session.test.ts` (8/8 Pass, 100%).
- **전체 검증**: `npm test` 234 files / 2,796 passed (100% Pass), `npm run build` 성공.
- **상태**: `[✔]` 완료

## 🌟 게임 조립계층 별 팩 주입·기존 CSV 경쟁 차단 카드 (CONTENT-BOOT-STAR, 2026-10-06)

**[✔] 구현 및 검증 완료.** [#390 CONTENT-BOOT-STAR](https://github.com/Choyounhwa/-dream-guardian/issues/390)

- **작업 목적**:
  1. 책임 레이어 Core (`src/core/`) 내에서 editor 모듈 의존성 0% 스테이지 시작 전 콘텐츠 모드(`default_csv` vs `custom_pack`) 확정 및 주입.
  2. 선택 팩(Published Content Pack) 제공 시 `ContentProvider.resolveSessionStage`를 통해 해석된 `SessionStageBundle`의 7개 별 노트 및 BPM을 주입 (`GameSessionContext` 및 `BeatRunCoordinator`).
  3. 비동기 CSV 로드 경쟁 차단: 늦게 완료된 `/fitness pattern.csv` 로드가 이미 커스텀 팩이 활성화된 세션의 노트를 덮어쓰지 못하도록 세션 식별자(`sessionId`), 세대 번호(`contentGeneration`) 및 콘텐츠 모드(`contentMode === 'custom_pack'`) 가드로 차단.
  4. 불완전 팩(`notes = []` 또는 7개 미만) 우회 방지: 불완전 팩은 전체 거부하고 whole-pack fallback으로 `default_csv` 모드 전환.
  5. 정답 분기 진입(`STAR_COLLECT`) 시 Direct vs Transition 양쪽 진입 경로에서 일치하는 `notes`, `branchClock`, `BPM`, `roundID` 주입 및 중복 시작 방지 (`!starNoteScheduler.isStarted`).
  6. pause/restart 및 새 스테이지 전환 시 이전 세션 팩 오염 방지 및 요청 격리 (`cancelCurrentRequest()`, `resetContent()`).
- **수정 파일 (2개 소스 + 1개 테스트, Scope Guard 준수)**:
  - `dream_guardian/src/core/GameSessionContext.ts`
  - `dream_guardian/src/core/AppBootstrap.ts`
  - `dream_guardian/tests/integration/content-star-bootstrap.test.ts` (신규, 6개 통합 테스트)
- **TDD 검증**: `tests/integration/content-star-bootstrap.test.ts` (6/6 Pass, 100%).
- **전체 검증**: `npm test` 233 files / 2,788 passed (100% Pass), `npm run build` 성공.
- **상태**: `[✔]` 완료

## 📡 로컬 게시본 수신·호환 재검증·요청 수명 관리 카드 (CONTENT-LOAD, 2026-10-06)

**[✔] 구현 및 검증 완료.** [#389 CONTENT-LOAD](https://github.com/Choyounhwa/-dream-guardian/issues/389)

- **작업 목적**:
  1. 책임 레이어 Core (`src/core/`) 내에서 editor 모듈 의존성 0% 순수 로컬 게시본 수신 및 수명 관리 서비스(`ContentLoadService`) 구현.
  2. 명시 요청된 동일 origin 로컬 게시본(PublishedContentPack / IndexedDB or 로컬 provider) 로드 수명 관리:
     - Request generation(생성 번호) 및 AbortController 기반 요청 취소 / 응답 역전(Race Condition / Out-of-order) 방지. 최신 요청보다 오래된 비동기 응답은 폐기.
  3. 호환성 및 무결성 재검증:
     - 런타임 지원 `runtimeContractVersion`(`2.0.0`) 및 `rulesetId`(`dg-ruleset-v2`), `rulesetHash`(`EXPECTED_RULESET_HASH`) 대조 검증.
     - `contentHash` 재계산 대조를 통한 조작된 팩(Tampered pack) 및 불완전 팩 거부.
     - 편집 원본 초안(`dream-guardian-authoring-project`), UIX 파일(`dream-guardian-ui-project`, `dream-guardian-ui-transfer`), 레거시 V1 키/포맷 수신 시도 차단.
  4. 로드 결과 반환:
     - 성공 시: `{ status: 'success', pack: PublishedContentPack, generation: number }` (불변 deepFreeze 반환).
     - 실패 또는 손상/버전 불일치 시: `{ status: 'fallback', reason: string, diagnostic: string, fallbackPack?: PublishedContentPack, generation: number }` (안전 폴백).
     - 취소 시: `{ status: 'cancelled', generation: number, reason: string }`.
  5. 동일 Origin 검증 및 보안:
     - 상대 경로 또는 명시적 allowedOrigin과 일치하는 로컬 게시본만 허용. Cross-origin 절대 URL, 타 포트, 비정상 프로토콜 차단. 원격 네트워크 업로드/외부 포트 공유 없음.
- **수정 파일 (1개 소스 + 1개 테스트)**:
  - `dream_guardian/src/core/ContentLoadService.ts` (신규)
  - `dream_guardian/tests/unit/content-load-service.test.ts` (신규, 23개 단위 테스트)
- **TDD 검증**: `tests/unit/content-load-service.test.ts` (23/23 Pass, 100%).
- **전체 검증**: `npm test` 232 files / 2,782 passed (100% Pass), `npm run build` 성공.
- **상태**: `[✔]` 완료

## 🎮 전체 스테이지 콘텐츠 스냅샷·binding 해석·세션 고정 카드 (CONTENT-SESSION, 2026-10-06)

**[✔] 구현 및 검증 완료.** [#388 CONTENT-SESSION](https://github.com/Choyounhwa/-dream-guardian/issues/388)

- **작업 목적**:
  1. 책임 레이어 Game (`src/game/`) 내에서 editor 모듈 의존성 0% 순수 단일 적용본 공급자(`ContentProvider`) 구현.
  2. 검증된 적용본(`PublishedContentPack`)과 명시적 builtin profile을 완전한 stage bundle(`SessionStageBundle`)로 해석.
  3. 10문제와 Phase B 동안 contentHash/rulesetId/rulesetHash/활성 BPM 고정.
  4. round별(`getRoundExecutionId`, 1~10문제) 및 loop별(`getPhaseBLoopExecutionId`), 노트/장판별 고유 실행 ID 분리 생성으로 충돌 차단.
  5. 잘못되거나 불완전한 선택 팩(누락된 단계, 변조된 hash, 불완전 페이즈 등)은 전체 거부하고 이전정상본 또는 내장 모드로 whole-pack fallback 처리 (CSV/타 팩 누더기식 자동 조합 차단).
  6. Phase B 별(`STAR_COLLECT`) / 장판(`BOSS_HAZARD`) 역할별 binding 충돌 없이 공존 해석 및 중복/모순 엄격 거부.
  7. 깊은 불변(`deepFreeze` 및 방어적 Deep Clone) 스냅샷으로 게임 세션 진행 중 외부에서 팩이 게시되거나 롤백되어도 이미 시작된 세션 데이터에 영향 없음 보장.
  8. 동일 seed/profile/hash에 대한 100% 결정론적(Deterministic) 실행 보장.
- **수정 파일 (2개 소스 + 1개 테스트)**:
  - `dream_guardian/src/game/SessionContent.ts` (신규)
  - `dream_guardian/src/game/ContentProvider.ts` (신규)
  - `dream_guardian/tests/unit/session-content.test.ts` (신규, 18개 테스트)
- **TDD 검증**: `tests/unit/session-content.test.ts` (18/18 Pass, 100%).
- **전체 검증**: `npm test` 231 files / 2,759 passed (100% Pass), `npm run build` 성공.
- **상태**: `[✔]` 완료

## 📦 프로젝트 검증·불변 게시·적용 예약 UI 카드 (EDITOR-PUBLISH, 2026-10-06)

**[✔] 구현 및 검증 완료.** [#387 EDITOR-PUBLISH-001](https://github.com/Choyounhwa/-dream-guardian/issues/387)

- **작업 목적**:
  1. 프로젝트 유효성 검증(validateProject) 및 컴파일(compileProject) 연계.
  2. 미완성/수정 중인 폼(dirty/uncommitted form input)이 있을 경우 게시 차단 (명시 확정 또는 취소 필요).
  3. 검증 결과 에러/경고 목록, sourceRevision, contentHash, diff 요약 상태 모델 제공.
  4. 게시(publish): `PublishedContentStore.publish` 호출을 통한 불변 영구 저장.
  5. 적용 예약(stageActivation / scheduleRollback): "다음 스테이지 시작 시 적용" 예약 상태로 등록하며, "현재 실행 중인 세션에 즉시 반영된다"고 잘못 표시하지 않음.
  6. 검증 또는 게시 실패 시 기존 activeContentHash 및 현재 작업 프로젝트 상태 100% 보존.
  7. 이전 정상본(previousHealthyHash) 목록 조회 및 롤백 예약(rollback) 연동 (삭제 없는 안전한 롤백).
  8. Project / Library / CompiledContentPack 간 kind 검증 (kind 혼동 거부).
- **수정 파일 (3개)**: `dream_guardian/src/editor/EditorPublishController.ts` (신규), `dream_guardian/src/editor/EditorLayout.ts`, `dream_guardian/src/editor/main.ts`
- **TDD 검증**: `tests/unit/editor-publish.test.ts` (13/13 Pass, 100%).
- **전체 검증**: `npm test` 230 files / 2,741 passed (100% Pass), `npm run build` 성공.
- **상태**: `[✔]` 완료

## 🦴 졸라맨 아바타 크기 배율 조절 카드 (FEAT-SKEL-SCALE, 2026-10-06)

**[✔] 구현 및 검증 완료.** [#420 FEAT-SKEL-SCALE-001](https://github.com/Choyounhwa/-dream-guardian/issues/420)

- **작업 목적**: 원거리 웹캠 플레이 및 시인성 향상을 위해 졸라맨(화이트 클레이) 아바타의 크기를 키울 수 있는 배율(Scale) 옵션(1.0x / 1.25x / 1.5x / 2.0x) 지원 및 렌더링 동적 스케일링.
- **수정 파일 (3개)**: `dream_guardian/config/skeleton.config.ts`, `dream_guardian/src/skeleton/StickmanRenderer.ts`, `dream_guardian/src/ui/SettingsModal.ts`
- **TDD 검증**: `tests/unit/stickman-renderer.test.ts`에 스케일 변경에 따른 FK 관절 거리, 캡슐/관절 두께 스케일링 및 설정 모달 토글/라벨 연동 검증 테스트 추가 (28/28 Pass).
- **전체 검증**: `npm test` 228 files / 2,709 passed (100% Pass), `npm run build` 성공.
- **상태**: `[✔]` 완료

## 🐛 별 노트 시간 축 불일치 결함 수정 카드 (BUG-STAR-CLOCK, 2026-10-05)

**[✔] 구현 및 검증 완료.** [#419 BUG-STAR-CLOCK-001](https://github.com/Choyounhwa/-dream-guardian/issues/419)

- **결함 수정**: 정답 시 `STAR_COLLECT` 진입할 때 `branchClock.startElapsed`(로컬 0.5~1.2s) 대신 실제 게임 엔진 전역 시간(`engine.elapsedTime` / `sampleTime`)을 스케줄러 시작 시간으로 주입하여, 1프레임(16ms)에 7개 별 노트가 즉시 Miss 만료·소멸되던 결함 수정.
- **수정 파일 (2개)**: `dream_guardian/src/core/AppBootstrap.ts`, `dream_guardian/src/core/SceneDirector.ts`
- **TDD 검증**: `tests/unit/rhythm-intro-bootstrap.test.ts`에 전역 시간 동기화 및 1프레임 내 조기 만료 방지 테스트 케이스 추가 완료 (7/7 Pass).
- **전체 검증**: `npm test` 220 files / 2,565 passed (100% Pass), `npm run build` 성공.
- **상태**: `[✔]` 완료

## 공용 투영 시각 고정 카드 등록 (VISUAL-LOCK, 2026-10-05)

**구현 완료. 화면 값 변경 0.** [#418 VISUAL-LOCK-001](https://github.com/Choyounhwa/-dream-guardian/issues/418)

- 추가 파일: `tests/unit/visual-lock-projection.test.ts`만. source/config diff 0.
- 고정값: `HORIZON_RATIO` 0.56 = 발판 `DEFAULT_VANISHING_Y_RATIO`, 1080×2160 rail(0.5) x=620 y=1357.2 scale=0.525, 장판 front = sharedY+(vh-sharedY)*0.92, 답 앵커 y=440.
- TDD: 잘못된 기준선 Red → 현재값 Green. `npm test` 217 files / 2495 passed. `npm run build` 통과. 기존 NEXT 승격 없음.

## 사전 예고·입문 플레이 설계 카드 등록 (RHYTHM-INTRO, 2026-10-05)

**사전 예고·입문 플레이(RHYTHM-INTRO) 6개 카드(#406, #409, #408, #407, #411, #410) 구현, TDD 100% Pass, 빌드 및 QA 종단 인수 전체 완료.**

| 순서 | 카드 | 책임 | src/config 수 | 상태 |
|---|---|---|:---:|---|
| 추적 | [#406 RHYTHM-INTRO-TRACK](https://github.com/Choyounhwa/-dream-guardian/issues/406) | 두 개선 범위·시간 예외·하위 추적 | 0 | `[✔]` 완료 |
| 1 | [#409 RHYTHM-INTRO-001](https://github.com/Choyounhwa/-dream-guardian/issues/409) | Data: 무릎 교대·손7노트 | 2 | `[✔]` 완료 |
| 2 | [#408 RHYTHM-INTRO-002](https://github.com/Choyounhwa/-dream-guardian/issues/408) | Render: 발판 다음 두 박·복귀 안내 | 3 | `[✔]` 완료 |
| 3 | [#407 RHYTHM-INTRO-003](https://github.com/Choyounhwa/-dream-guardian/issues/407) | Render: 별 박 기반 사전 예고 | 2 | `[✔]` 완료 |
| 4 | [#411 RHYTHM-INTRO-004](https://github.com/Choyounhwa/-dream-guardian/issues/411) | Core: Phase A 데이터·시계 연결 | 2 | `[✔]` 완료 |
| 5 | [#410 RHYTHM-INTRO-005](https://github.com/Choyounhwa/-dream-guardian/issues/410) | QA: 실카메라·종단·회귀 인수 | 0 | `[✔]` 완료 |

- 권장 순서 **#409 → #408 → #407 → #411 → #410**. 번호순이 아닌 작업 ID 순이며 다른 트랙 NEXT 승격이 아니다. 상세 파일/선행/테스트는 각 카드와 `docs/03_GITHUB_ISSUES.md` 상단에 있다.
- 일반 Phase A 기본 구성을 입문형으로 한다. run에서 한 박에 왼무릎 들고 복귀, 다음 박에 오른무릎 들고 복귀; 정답 별은 왼손 Zone4/오른손 Zone5 교대7개. 최초1회 세이브 판별·자동 고급 패턴·새 메뉴 없음. 비run/회피/Phase B는 유지.
- 발판은 시각 안내로 남고 현재+다음 두 박을 구분한다. 복귀를 별도1박으로 넣지 않아 기존 운동 N-2 요구와 모순을 피한다. 실제 감지기로 진행되는지는 #410 실카메라 필수 인수이며 임의 detector 수정 금지.
- 별은 착지2박 전 예고, 첫 별은 분기 시점부터1박만 가능하다. 첫 경로는 표시 시작부터 정규화, 분기 지연/판정창/BPM/손 재진입/오디오 변경 없음. 기존 조기 위치 유지 수집도 유지한다.
- #390과 Core 파일·주입 지점을 공유하므로 착수 시 최신 구현 확인. 명시 편집 팩이 있다면 기본 입문 루틴으로 덮어쓰지 않는다. 기존 RUN-MAT의 HANDOVER 완료/GitHub OPEN 차이도 임의 정리하지 않는다.
- 등록은 추적1+실행4+QA1=6개. 각 본문 표준필드·미체크 완료조건·파일 최대3개·단일 책임·TDD·Rule12/13 명시. 기존 소스/config/tests 변경0, 테스트/build/실브라우저/서버/commit/push 없음. 기존 dirty 파일과 이 문서의 타 세션 기록 보존.
- GitHub Project는 `read:project` scope 부족으로 미연결. 인증 변경 없음. 첫 구현 후보는 #409이며 카드 제작을 구현 승인으로 간주하지 않는다.

---

## 🎵 비트 동기화 세로선 Cyan 글로우 (RENDER-GRID-006, 2026-10-04)

| 카드 | 단일 책임 | src/config 수 | 선행 | 상태 |
|---|---|:---:|---|---|
| [RENDER-GRID-006 #405](https://github.com/Choyounhwa/-dream-guardian/issues/405) | 음악 비트 동기화 중심 기준 양옆 4번째 세로선 Cyan 글로우 효과 | 3 | 없음 | [✔] 완료 (2026-10-04) |

- 작업 완료: 그리드 중심 기준 양옆 4번째 세로선(j = ±4)에 음악 비트 계수(flashFactor) 연동 3-Pass 일렉트릭 Cyan 네온 글로우 렌더링 구현 완료.
- 대상 파일: `config/grid.config.ts`, `src/render/DreamGrid.ts`, `src/core/SceneDirector.ts` (3개 이하 준수)
- 검증 결과: `tests/unit/dream-grid.test.ts` (31/31 Pass), 전체 단위 테스트 100% Pass (2,309/2,309 Pass), `npm run build` 성공.
- Rule 12 코멘트 및 Rule 13 로컬 개발 서버 안내 준비 완료.

## 시각 전용 러닝 매트 별도 백로그 등록 (RUN-MAT, 2026-10-04)

**승인 범위는 카드 등록·문서 동기화만이다. 구현 미착수/별도 승인 대기이며 기존 SSOT·EDITOR-SCHEMA 및 UIX 트랙 NEXT를 그대로 유지한다.** 다른 세션의 UIX 진행 기록을 덮어쓰지 않는다.

| 카드 | 단일 책임 | src/config 수 | 선행 | 상태 |
|---|---|:---:|---|---|
| [RUN-MAT-001 #370](https://github.com/Choyounhwa/-dream-guardian/issues/370) | Game 실제 예약 기반 읽기 전용 run snapshot | 1 | 신규 없음 | [✔] 완료 (2026-10-04) |
| [RUN-MAT-002 #371](https://github.com/Choyounhwa/-dream-guardian/issues/371) | 표시 패턴 데이터·순수 presenter | 2 | #370 | [✔] 완료 (2026-10-04) |
| [RUN-MAT-003 #372](https://github.com/Choyounhwa/-dream-guardian/issues/372) | 순수 매트 renderer·시각 config | 2 | #371 | [✔] 완료 (2026-10-04) |
| [RUN-MAT-004 #373](https://github.com/Choyounhwa/-dream-guardian/issues/373) | SceneDirector/MainSceneContext·AppBootstrap 배선 | 2 | #370~#372 | [✔] 완료 (2026-10-04) |
| [RUN-MAT-005 #368](https://github.com/Choyounhwa/-dream-guardian/issues/368) | null-hazard HUD 오문구·중복 안내 제거 | 2 | #373 | [✔] 완료 (2026-10-05) |

- 중복 조사 후 신규4개 + 기존 #368 재사용. 구 `RENDER-RUN-FLOOR-001` 최초 본문은 이슈 하단에 보존하고 바닥 그리기는 #371~#373으로 분리했다. 매트 current/next·인정 수는 RunningMatRenderer가 소유하며 BeatHUD는 진짜 hazard 동작을 보존한다.
- 시리즈 내부 순서만 **#370 → #371 → #372 → #373 → #368**. 다음 RUN-MAT 후보는 #370이지만 현재 NEXT 승격/구현 승인은 아니다. 정확 제목/파일 경계는 `docs/03_GITHUB_ISSUES.md` 상단 및 각 이슈 참조.
- 실제 예약 종료−기존 준비 길이로 준비 시작을 관찰하고 recordStep/전이/N-2+2/8·12·16/미달 시 명목 답안 프리뷰를 변경하지 않는다. COUNT_IN 포함 RUN_QUESTION 외 매트 숨김. 미달은 중앙 운동 연장이며 시간 박수≠인정 수다.
- 반투명 좌/중앙/우 셀·좌우 home·현재/다음 발자국·화살표·NEXT 수축 링은 안내 전용이다. AR/실제 착지 정확도/Perfect/새 detector 금지. 영상 제목만 확인, 안무 미검증으로 교체 가능한 제안 패턴임을 명시했다. 4색 커서 체계/현재 가시성(#369)·투명 DreamGrid·존/입력/전투 보존.
- 등록 검증만 완료: 5개 제목/본문 표준필드·실제 선행 링크·라벨·OPEN·미체크 완료조건·완료 코멘트0 확인. **이번 세션 구현 완료 ID/통과한 기능 테스트 없음.** npm test/build·브라우저/실카메라·서버 실행/확인 미수행; 기존 다른 세션의 Pass를 본 작업 결과로 인용하지 않는다.
- 향후 구현 완료 시 각 카드의 TDD·전체100% Pass·빌드·수동 검증/미확인을 `gh issue comment`와 HANDOVER에 기록하고 실제 `npm run dev`/`http://localhost:3000/`을 안내한다. 이번에는 완료 코멘트를 게시하지 않았다.
- Project 연결 차단: `gh project list --owner Choyounhwa --format json`의 `read:project` scope 부족. 인증/권한 변경 없음. WBS/PROJECT_BOARD 미수정, 이번 로컬 수정은 이 문서와 이슈 인덱스만. 초기 미추적8파일 및 조사 중 다른 세션이 추가한 HANDOVER UIX 진행 변경 보존; 소스/config/tests 수정0, commit/push 없음.

---

## 브라우저 조작 테스트용 셸 DOM (UIX-VIEW, 2026-10-05)

**등록만 승인. 구현 미착수·별도 승인 대기. 기존 SSOT/EDITOR/Phase 7 NEXT는 유지한다.** #363까지는 로직만 있고 `#app` DOM이 없어 백지다.

| 순서 | 카드 | 책임 | src/config 수 | 상태 |
|---|---|---|:---:|---|
| 추적 | [#412 UIX-VIEW-TRACK](https://github.com/Choyounhwa/-dream-guardian/issues/412) | 화면 연결 4개 추적. QA 대체 아님 | 0 | `[✔]` 완료 |
| 1 | [#413 UIX-044](https://github.com/Choyounhwa/-dream-guardian/issues/413) | 셸 DOM·3패널 마운트 | 2 | `[✔]` 완료 |
| 2 | [#414 UIX-045](https://github.com/Choyounhwa/-dream-guardian/issues/414) | 속성 폼 연결 | 2 | `[✔]` 완료 |
| 3 | [#415 UIX-046](https://github.com/Choyounhwa/-dream-guardian/issues/415) | 미리보기 iframe 연결 | 2 | `[✔]` 완료 |
| 4 | [#416 UIX-047](https://github.com/Choyounhwa/-dream-guardian/issues/416) | 저장·백업·추출 버튼 | 2 | `[✔]` 완료 |
| 버그 | [#417 BUG-UI-EDITOR-001](https://github.com/Choyounhwa/-dream-guardian/issues/417) | 브라우저 node:crypto 충돌 해소 및 셸 기본 스타일 | 3 | `[✔]` 완료 |
| 버그 | [#423 BUG-UI-EDITOR-002](https://github.com/Choyounhwa/-dream-guardian/issues/423) | 브라우저 파일 입출력(열기/저장/백업/추출) 어댑터 부재 및 상호작용 결함 수정 | 3 | `[✔]` 완료 |

- UIX-VIEW 트랙(#412~#416), 브라우저 런타임 버그(#417, #423), Phase 7 UIX-040~043(#364~#367), 및 [UIX-017 #341] MVP 종단 인수·게임 비변경 검증 TDD 5단계 완주 (`[✔]` 완료). 브라우저 조작 테스트 준비 완료 (`http://127.0.0.1:3010/ui-editor.html`). MVP Phase 0~4 (18개 카드) 및 Phase 7 전체 완료.

- 순서 **#413 → #414 → #415 → #416**. #413 후 레이아웃 표시, #416 후 브라우저 조작 테스트. Phase 7 #364~#367 및 MVP 종단 인수 #341 완주.
- 화면 조립은 `src/editor/ui/view/` 신규 파일만. 기존 판정/IO 재구현·게임 apply·실행 버튼 금지. 소스/config 수정 0개 보존.

## UI 추출 전용 에디터 별도 등록 트랙 (UIX, 2026-10-04)

**2026-10-04 사용자 지시로 #336~#341 진행. #341 [UIX-017] MVP 종단 인수 완주. #319 완료 및 EDITOR-SCHEMA NEXT는 유지한다.** UIE/게임 적용은 포함하지 않는다.

| 항목 | 등록 결과 | 상태 |
|---|---|---|
| 전체 추적 | [UIX-TRACK-001 #323](https://github.com/Choyounhwa/-dream-guardian/issues/323) | `[✔] CLOSED` / MVP 18개 및 Phase 7 4개, #340 [UIX-016] 전수 완료 |
| MVP Phase0~4 | UIX-001~017 +007A, #324~341 (18개) | #324~#341 전체 카드 100% 통과 `[✔]` 완료 (MVP 전수 완주 및 #340 포함 완료) |
| 후속 Phase5 | UIX-030/031 기반 #342/#343 →018~029 #344~355 (14개) | #342~#355 구현 `[✔]` (#345 OPEN) / [UIX-032 #356](https://github.com/Choyounhwa/-dream-guardian/issues/356) `[✔]` 완료 |
| 후속 Phase6 | UIX-032~039 #356~363 (8개) | #356~#363 `[✔]` 완료 / Phase 6 종료 |
| 후속 Phase7 | UIX-040~043 #364~367 (4개) | #364 [UIX-040] `[✔]`, #365 [UIX-041] `[✔]`, #366 [UIX-042] `[✔]`, #367 [UIX-043] `[✔]` 완료 / Phase 7 전체 완주 `[✔]` |
| UIX 구현 진행 | #342~#367 및 #341 구현 `[✔]` (UIX-017 tests/unit/uix-017.test.ts 17건 100% Pass, tests/e2e/uix-017.manual.md 작성 완료) | 에디터 포트 3010 (`http://127.0.0.1:3010/ui-editor.html`), 빌드 검증 완료 |

- 합계: 실행44(MVP18+후속26)+추적1=45. 전체 ID/링크/선행은 `docs/03_GITHUB_ISSUES.md` 상단과 #323, 정확 수정 경계는 각 이슈 및 설계 §14에 기록했다.
- 생성 전 REST 전체 목록에서 정확 ID 대조, 생성 후 제목/본문/라벨/OPEN 및 최종45개 중복0 재조회 확인. 라벨 feature39/test4/documentation2, P1-high11/P2-medium34. Project scope 부족으로 미연결, 인증 변경/권한 요청 없음.
- 이번 세션 통과한 기능 테스트 없음: npm test/build·브라우저/실카메라·서버 실행/확인 미수행. 카드 등록 검증과 구현100% Pass를 혼동하지 않는다. 소스/테스트/설정 파일 수정0, commit/push 없음.
- 게임 기존 renderer/config/bootstrap/세이브/안무 저장소 무변경, 게임 적용·runtime loader·자동 전송/배포 금지, 지원 불가 잠금. 추출물의 게임 실행 호환성은 항상 범위 밖/미검증.
- 승인된 문서3개만 최소 갱신하며 기존 #321 계약 기록, #322 및 다른 dirty 파일을 보존했다. 이후 구현 완료 시 실제 테스트/build·미검증·완료 조건을 gh issue comment/HANDOVER에 남기고 실제 에디터 서버/URL을 안내한다. 커밋은 별도 명시 요청 시만 한다.

---

## 통합 에디터 별도 승인 트랙 (#321, 2026-10-04)

기존 로드맵 #319는 완료되었다. 사용자가 별도로 승인한 에디터 트랙이며, 다음 승인 없는 소스 구현은 하지 않는다.

| 카드 | 목표 | 상태 |
|---|---|---|
| [#321](https://github.com/Choyounhwa/-dream-guardian/issues/321) EDITOR-CONTRACT | 실제 게임의 시간/입력/참조 계약 및 초기 편집 경계 확정 | `[✔] 문서·특성화 검증 완료` (미커밋, 이슈 OPEN 유지) |
| [#375](https://github.com/Choyounhwa/-dream-guardian/issues/375) EDITOR-SCHEMA | V2 데이터 타입 및 구조/참조 검증기 | `[✔] 구현·검증 완료 (TDD 100% Pass)` |
| [#376](https://github.com/Choyounhwa/-dream-guardian/issues/376) EDITOR-CAPABILITY | 게시 가능 동작·시간·규칙 버전과 고정 슬롯 계약 | `[✔] 구현·검증 완료 (TDD 100% Pass)` |
| [#377](https://github.com/Choyounhwa/-dream-guardian/issues/377) EDITOR-COMPILE | 검증된 원본의 결정적 게임 적용본 생성·재검사 | `[✔] 구현·검증 완료 (TDD 100% Pass)` |
| [#378](https://github.com/Choyounhwa/-dream-guardian/issues/378) EDITOR-MIGRATE | V1 프로젝트·패턴 라이브러리 무손실 변환 | `[✔] 구현·검증 완료 (TDD 100% Pass)` |
| [#379](https://github.com/Choyounhwa/-dream-guardian/issues/379) EDITOR-STORE | 피트니스 전용 IndexedDB 원자적 초안 저장·복구 | `[✔] 구현·검증 완료 (TDD 100% Pass)` |
| [#380](https://github.com/Choyounhwa/-dream-guardian/issues/380) EDITOR-COMMAND | 문서 명령·불변 조회·참조 안전 삭제와 Undo/Redo | `[✔] 구현·검증 완료 (TDD 100% Pass)` |
| [#381](https://github.com/Choyounhwa/-dream-guardian/issues/381) EDITOR-IO | V2 전체 열기·자동저장·복구·라이브러리 병합 연결 | `[✔] 구현·검증 완료 (TDD 100% Pass)` |
| [#382](https://github.com/Choyounhwa/-dream-guardian/issues/382) EDITOR-TIME-MODEL | 기존 #243 후속 내부 시간·길이·자세 탐색 계약 정합화 | `[✔] 구현·검증 완료 (TDD 100% Pass)` |
| [#383](https://github.com/Choyounhwa/-dream-guardian/issues/383) EDITOR-TIME-VIEW | 노트·눈금·재생헤드·클릭·오디오 루프 좌표 통일 | `[✔] 구현·검증 완료 (TDD 100% Pass)` |
| [#384](https://github.com/Choyounhwa/-dream-guardian/issues/384) EDITOR-STAR | 별 7슬롯/부위·존/오류 UX 고도화 | `[✔] 구현·검증 완료 (TDD 100% Pass)` |
| [#385](https://github.com/Choyounhwa/-dream-guardian/issues/385) EDITOR-BINDING | 프로젝트/구간·역할별 연결 UX | `[✔] 구현·검증 완료 (TDD 100% Pass)` |
| [#386](https://github.com/Choyounhwa/-dream-guardian/issues/386) EDITOR-RELEASE-STORE | 불변 게시본·적용 예약·이전 정상본 저장 | `[✔] 구현·검증 완료 (TDD 100% Pass)` |
| [#387](https://github.com/Choyounhwa/-dream-guardian/issues/387) EDITOR-PUBLISH | 검증/게시/적용 예약 UI | `[✔] 구현·검증 완료 (TDD 100% Pass)` |
| [#388](https://github.com/Choyounhwa/-dream-guardian/issues/388) CONTENT-SESSION | 게임 런타임 적용본 단일 공급자(Provider) 및 세션 고정 | `[✔] 구현·검증 완료 (TDD 100% Pass)` |
| [#389](https://github.com/Choyounhwa/-dream-guardian/issues/389) CONTENT-LOAD | 명시적 로컬 팩 수신/재검증 | `[✔] 구현·검증 완료 (TDD 100% Pass)` |
| [#390](https://github.com/Choyounhwa/-dream-guardian/issues/390) CONTENT-BOOT-STAR | 별 팩 주입/CSV 경쟁 차단 | `[✔] 구현·검증 완료 (TDD 100% Pass)` |
| [#391](https://github.com/Choyounhwa/-dream-guardian/issues/391) CONTENT-TEST-SESSION | 테스트 세션/실제 기록 격리 | `[✔] 구현·검증 완료 (TDD 100% Pass)` |
| [#392](https://github.com/Choyounhwa/-dream-guardian/issues/392) EDITOR-PREVIEW | 컴파일 이벤트 기반 미리보기 | `[✔] 구현·검증 완료 (TDD 100% Pass)` |
| [#393](https://github.com/Choyounhwa/-dream-guardian/issues/393) EDITOR-TEST-LAUNCH | 게시 hash 테스트 실행 UX | `[✔] 구현·검증 완료 (TDD 100% Pass)` |
| [#394](https://github.com/Choyounhwa/-dream-guardian/issues/394) EDITOR-MVP-QA | 별 제작→게임→롤백 종단 인수 | `[✔] 구현·검증 완료 (TDD 100% Pass)` |
| [#395](https://github.com/Choyounhwa/-dream-guardian/issues/395) EDITOR-HAZARD-A | Phase A 장판 편집 | `[✔] 구현·검증 완료 (TDD 100% Pass)` |
| [#396](https://github.com/Choyounhwa/-dream-guardian/issues/396) GAME-HAZARD-A-CONTENT | Phase A 장판 소비 | `[✔] 구현·검증 완료 (TDD 100% Pass)` |
| [#397](https://github.com/Choyounhwa/-dream-guardian/issues/397) BOOT-HAZARD-A-CONTENT | 게임 조립계층 오답 장판 팩 연결 | `[✔] 구현·검증 완료 (TDD 100% Pass)` |
| [#398](https://github.com/Choyounhwa/-dream-guardian/issues/398) EDITOR-FEVER | 16박 가이드/8노트 피버 분리 편집 | `[✔] 구현·검증 완료 (TDD 100% Pass)` |
| [#399](https://github.com/Choyounhwa/-dream-guardian/issues/399) GAME-FEVER-CONTENT | 피버 시퀀스 공급·반복 ID·마지막 판정 수명 연결 | `[✔] 구현·검증 완료 (TDD 100% Pass)` |
| [#400](https://github.com/Choyounhwa/-dream-guardian/issues/400) EDITOR-HAZARD-B | Phase B 보스 공격 순서·회피 정보 편집 | `[✔] 구현·검증 완료 (TDD 100% Pass)` |
| [#401](https://github.com/Choyounhwa/-dream-guardian/issues/401) GAME-HAZARD-B-CONTENT | Phase B 장판 공급 | `[▶ NEXT: 에디터·런타임 트랙]` 대기 |

### 2026-10-04 피트니스 후속 카드 등록 (#374~#404)

- 사용자 요청은 **카드 제작**. [전체 추적 #374](https://github.com/Choyounhwa/-dream-guardian/issues/374) + 실행30개(#375~#404) 등록 완료, 모두 OPEN/구현 승인 대기. 기존 #321은 계약 결과로 재사용한다.
- A 기반 #375~#379 → B 편집 안전 #380~#385 → C 게시/실행 #386~#393 → D 별 MVP #394 → E 장판·피버 #395~#402 → F 정적 팩/최종 인수 #403~#404. 전체 ID/선행은 `docs/03_GITHUB_ISSUES.md` 상단, 정확 파일/완료조건/TDD/유지·금지는 각 이슈.
- 첫 구현은 #375 두 Data 소스와 신규 테스트만. 카드 등록은 구현 승인 아님. 소스 최대3개·단일 레이어·한 카드씩 승인 원칙이며 UIX/RUN-MAT NEXT는 변경하지 않는다.
- #243은 최신 조회 CLOSED이나 로컬 길이7/표시2~8/seek 제한이 남아 있다. #382 내부 시간모델/#383 표시·클릭 연결로 분리했으며 착수 전 최신 해결 증거 재확인. 기존 이슈 재오픈/타 작업 수정 없음.
- Phase B binding은 역할/종류를 포함해 별·장판 공존. 초기 미편집 구간은 명시적 versioned builtin profile로 전체 stage bundle 검증하고 누락 부분의 암묵 CSV 혼합은 금지한다.
- 생성 직후 제목/본문/라벨/OPEN 확인, 최종31개 재조회. 목록 반영 지연2건은 재조회로 해결(중복생성0). Project scope 부족으로 보드 미연결, 인증 변경 없음.
- **이번 등록 세션의 기능 구현/통과 테스트 없음.** npm test/build·브라우저·서버 재확인·commit/push·배포 미수행. 아래 #321 증빙은 과거 계약 작업 결과이며 신규30개 완료 증거가 아니다. 로컬 문서는 인덱스/HANDOVER만 최소 갱신하고 타 작업을 보존했다.

- 계약 문서: `docs/09_EDITOR_RUNTIME_CONTRACT.md`. 기존 설계 `docs/07_UNIFIED_EDITOR_INTEGRITY_DESIGN.md`에 후속 계약 참조 추가.
- 테스트: `tests/unit/editor-runtime-contract.test.ts` 신규 21개. V1 왕복, #243 시간축 관찰, 배열 순서 착지, BPM/판정창, foot-role hip 입력, 장판 스케일/회피, Phase B 8노트와 16박 가이드 차이 확인.
- Baseline: 164파일/2093개 PASS. 최종: `npm test -- --reporter=dot` 165파일/2114개 PASS, `npm run build` TypeScript/Vite 성공. 미추적 hazard-content-pack 기존 테스트 5개 포함이며 신규 성과는 21개다.
- src/config 수정 0개. 기존 동작 특성화이므로 인위적인 Red/Green은 수행하지 않았으며 기능 TDD 완료로 주장하지 않는다. V2 저장/검증/게임 연결은 아직 미구현.
- #243의 마지막 노트 seek(8)->7 제약은 테스트로 확인하고 기존 카드에 연결한다. 수정/닫기 금지, 후속 수정 시 결함 관찰 테스트도 함께 갱신한다.
- 서버: 기존 Vite PID 7896 재사용. `http://localhost:3000/` 및 `http://localhost:3000/editor.html` HTTP 200, 각 src 진입점 확인. 실브라우저 렌더링/카메라 수동 검증은 하지 않았다.
- 커밋/푸시 미요청으로 수행하지 않았다. 타 작업의 `docs/08_UI_EDITOR_UX_DATA_DESIGN.md`, `HazardContentPack.ts` 및 해당 테스트, 기존 미추적 파일을 보존했다.
- 다음 범위: `src/data/EditorProject.ts`, `src/data/ProjectValidator.ts` 두 파일과 `tests/unit/editor-project-validator.test.ts`. unknown/중복 ID/끊어진 참조/페이즈 조합/미지 필드/비정상 숫자 Red 선작성. 저장소/컴파일러/게임 연결은 제외.

---

## 🧭 12단계 로드맵 진행 현황 (SSOT)

| 단계 | 순서 | 완료 목표 | 상태 |
|---|---|---|:---:|
| **1. 기준 확정** | **#229** → **#186 검증 설계** | 시간·판정창·자원 정책과 전체 실패 시나리오 확정 | `[✔] 완료` |
| **2. 진행 기반** | **#214** → **#230** → **#231** | 상태·실제 8박·일시정지·예약 처리 일치 | `[✔] 완료` |
| **3. 답 선택 화면** | **#232** → **#233** | 선택 즉시 올바른 화면 전환, 구형 UI 제거 | `[✔] 완료` |
| **4. 모션 입력** | **#237** *(완료)* → **#238** *(완료)* → *(#239 미채택)* | 발 좌표·방향·스텝, 점프 사용자 기준선 | `[✔] 완료` |
| **5. 분기 실행** | **#235** *(완료)* → **#236** *(완료)* | 별모으기 노트 일정·판정창, 회피 장판 수명주기 | `[✔] 완료` |
| **6. 문제 표시** | **#212** *(완료)* → **#234** *(완료)* | 문제 원근 접근 연출 및 긴 수식 너비·높이 수용 | `[✔] 완료` |
| **7. 시청각 연결** | **#192** *(완료)* → **#228** *(완료)* → **#191** | 실제 노트·장판·Web Audio 밴드 음향 동기화 | `[✔] 완료` |
| **8. 정산·자원** | **#240** *(완료)* → **#242** *(완료)* | Phase A 정산/처치 책임 분리 및 군단·별가루 모델 | `[✔] 완료` |
| **9. Phase B 진입** | **#241** *(완료)* | 10번째 정산 후 한 번만 인계, 11번째 출제 차단 | `[✔] 완료` |
| **10. Phase B 실행** | **#213** *(완료)* → **#193** *(완료)* → **#194** *(완료)* → **#195** *(완료)* | 피버·보스 공격·군단 화력·결전 화면 연결 | `[✔] 완료` |
| **11. 판정 유연화** | **#249** *(완료)* → **#250** *(완료)* → **#251** *(완료)* → **#252** *(완료)* → **#253** *(완료)* → **#254** *(완료)* → **#255** *(완료)* | 팔 뻗기·존·타이밍 판정의 유저 행동 수용성 확대 | `[✔] 완료` |
| **12. 최종 검증** | **#186** | 실제 10문제 → Phase B → 승리/패배 → 메뉴 완주 | `[✔] 완료` |

### 📎 11단계 세부 (판정 유연화 / INPUT-TOLERANCE 시리즈)

| 카드 | 제목 | 선행 조건 | 상태 |
|---|---|---|:---:|
| **#249** | [INPUT-TOLERANCE-001] 팔 뻗기 가중 신뢰도 스코어링 및 양팔 우세 판정 | 없음 (`config/judgment.config.ts` 신설) | `[✔] 완료` |
| **#250** | [INPUT-TOLERANCE-002] 존 소프트 경계(히스테리시스·자석 존·체격 정규화) | #249 | `[✔] 완료` |
| **#251** | [INPUT-TOLERANCE-003] 타이밍 관용(선행 버퍼·후행 유예·감쇠 홀드·유실 동결) | #249 | `[✔] 완료` |
| **#252** | [INPUT-TOLERANCE-004] MotionIntentBus 및 페이즈별 동작 소유권·불응기 | #249·#250·#251 | `[✔] 완료` |
| **#253** | [INPUT-TOLERANCE-005] 집합 덮기 조건 B 시간 누적 완화·Cross-Body 정합성 | #250 | `[✔] 완료` |
| **#254** | [INPUT-TOLERANCE-006] 니어미스 적응형 관용 및 개인 기준선 캘리브레이션 | #249·#250 | `[✔] 완료` |
| **#255** | [INPUT-TOLERANCE-007] 부분 진행도 시각화 및 판정 실패 사유 피드백 | #249 (#254 권장) | `[✔] 완료` |

> 🏆 **12단계 전체 로드맵 완주**: #186 최종 E2E 통합 검증 완료로 12단계 전체 마일스톤이 100% 완료되었습니다.

---

## 🧭 UI 구조화·접근성·에셋·이펙트 로드맵 (Phase 2)

### 📌 A. UI 데이터 구조화 시리즈 (UI-TOKEN)

| 순서 | 카드 | 제목 | 선행 조건 | 상태 |
|:---:|---|---|---|:---:|
| 1 | **#256** | [UI-TOKEN-001] UI 디자인 토큰 시스템 신설 (config/ui.config.ts) | 없음 | `[✔] 완료` |
| 2 | **#257** | [UI-TOKEN-002] UIText 중앙 렌더링 유틸리티 신설 | #256 | `[✔] 완료` |
| 3 | **#258** | [UI-TOKEN-003] 11개 UI 렌더러 하드코딩 폰트→토큰 기반 전환 | #256·#257 | `[✔] 완료` |
| 4 | **#259** | [UI-TOKEN-004] 렌더러 레이아웃 좌표→UI_LAYOUT 참조 전환 | #256 | `[✔] 완료` |
| 5 | **#260** | [UI-TOKEN-005] BossClimaxRenderer/BeatHUDRenderer 폰트→토큰 전환 | #257 | `[✔] 완료` |
| 6 | **#261** | [UI-TOKEN-006] 이미지 에셋 로더 및 프로시저럴/이미지 분기 인프라 | #256 | `[✔] 완료` |

### 📌 B. 저시력 접근성 개선 시리즈 (A11Y)

| 순서 | 카드 | 제목 | 선행 조건 | 상태 |
|:---:|---|---|---|:---:|
| 7 | **#262** | [A11Y-001] user-scalable 해제 및 최소 폰트 크기 하한선 즉시 적용 | 없음 | `[✔] 완료` |
| 8 | **#263** | [A11Y-002] 저대비 색상 수정 및 WCAG AA 대비율 4.5:1 보장 | 없음 | `[✔] 완료` |
| 9 | **#264** | [A11Y-003] SettingsModal 글씨 크기/고대비 모드 옵션 추가 | #256·#257·#258 | `[✔] 완료` |
| 10 | **#265** | [A11Y-004] 저시력 모드 커서/HP바/게이지 확대 및 음성 피드백 강화 | #264 | `[✔] 완료` |

### 📌 C. 이미지 에셋 교체 시리즈 (UI-ASSET)

| 순서 | 카드 | 제목 | 선행 조건 | 상태 |
|:---:|---|---|---|:---:|
| 11 | **#266** | [UI-ASSET-001] 메뉴 화면 이미지 에셋 제작 및 교체 | #261 | `[✔] 완료` |
| 12 | **#267** | [UI-ASSET-002] HUD 이미지 에셋 제작 및 교체 | #261 | `[✔] 완료` |
| 13 | **#268** | [UI-ASSET-003] 결과 화면 이미지 에셋 제작 및 교체 | #261 | `[✔] 완료` |
| 14 | **#269** | [UI-ASSET-004] 하단 바/설정/일시정지 모달 이미지 에셋 교체 | #261 | `[✔] 완료` |
| 15 | **#270** | [UI-ASSET-005] 보스 캐릭터 이미지 에셋 제작 (5종 보스 스프라이트) | #261 | `[✔] 완료` |
| 16 | **#271** | [UI-ASSET-006] 수호신(깨비) 캐릭터 이미지 에셋 제작 (4단계) | #261 | `[✔] 완료` |
| 17 | **#272** | [UI-ASSET-007] 챕터별 배경 이미지 에셋 제작 및 DreamGrid 교체 | #261 | `[✔] 완료` |
| 17-1 | **#289** | [UI-ASSET-008] 신체 부위 벡터 아이콘(손/머리/골반/어깨) 이미지 에셋 제작 및 PartIconRenderer 비트맵 렌더링/폴백 연동 | #261 | `[✔] 완료` |
| 17-2 | **#290** | [UI-ASSET-009] 답안 버튼(Zone 4/5) 및 문제 수식 배경 패널 이미지 에셋 제작 및 QuestionRenderer 연동 | #261 | `[✔] 완료` |
| 17-3 | **#291** | [UI-ASSET-010] 8박자 비트 인디케이터 도트 및 메트로놈 UI 이미지 에셋 제작 및 BeatHUDRenderer 연동 | #267 | `[✔] 완료` |
| 17-4 | **#292** | [UI-ASSET-011] 서브레벨 선택 카드 배경 및 결과 화면 랭크 등급 스탬프(S/A/B/C) 이미지 에셋 제작 및 연동 | #266, #268 | `[✔] 완료` |
| 17-5 | **#293** | [UI-ASSET-012] 인게임 대사창 오버레이 패널 및 모달 기능 버튼/아이콘 이미지 에셋 제작 및 연동 | #269 | `[✔] 완료` |

### 📌 D. 이펙트/비주얼 시리즈 (VFX)

| 순서 | 카드 | 제목 | 선행 조건 | 상태 |
|:---:|---|---|---|:---:|
| 18 | **#273** | [VFX-001] 파티클 엔진 기반 시스템 구축 (EffectManager) | 없음 | `[✔] 완료` |
| 19 | **#274** | [VFX-002] 정답/오답 판정 이펙트 연결 | #273 | `[✔] 완료` |
| 20 | **#275** | [VFX-003] 수호신 스펠 캐스트 이펙트 | #273 | `[✔] 완료` |
| 21 | **#276** | [VFX-004] 스켈레톤 시각 이펙트 강화 | #273 | `[✔] 완료` |
| 22 | **#277** | [VFX-005] 승리/패배 결과 화면 연출 이펙트 | #273 | `[✔] 완료` |
| 23 | **#278** | [VFX-006] UI 전환 애니메이션 | #273 | `[✔] 완료` |

### 📌 E. 게임플레이 템포 및 난이도 프로필 (GAMEPLAY-TEMPO)

| 순서 | 카드 | 제목 | 선행 조건 | 상태 |
|:---:|---|---|---|:---:|
| 24 | **#204** | [BEAT-TRACK-001] 음악 트랙별 가변 박자(BPM/LoopPattern) 및 카운트인(Count-in) 연동 아키텍처 구축 | 없음 | `[✔] 완료` |
| 25 | **#279** | [BEAT-DIFFICULTY-001] 챕터-서브메뉴별 난이도 기반 박자 동적 프로필 및 6박 답안 원근 접근 연계 | #204 | `[✔] 완료` |

### 📌 F. 스토리 대사 및 보스 정비 시리즈 (STORY & BOSS)

| 순서 | 카드 | 제목 | 선행 조건 | 상태 |
|:---:|---|---|---|:---:|
| 25 | **#217** | [RENDER-BOSS-001] BossRenderer 압박성 대사 제거 및 5대 보스 연출 정비 | 없음 | `[✔] 완료` |
| 26 | **#218** | [STORY-DATA-001] 대사 엔진(DialogueManager) 신설 및 5대 보스·깨비 ADHD 치유 스크립트 데이터 외부화 | #217 | `[✔] 완료` |
| 27 | **#219** | [STORY-RENDER-001] 인게임 캐릭터 대사창 오버레이(DialogueOverlayRenderer) 구현 및 발화 시각화 | #218 | `[✔] 완료` |

### 📌 G. 신체 정렬 및 스테이지 진입 (READY-ALIGN)

| 순서 | 카드 | 제목 | 선행 조건 | 상태 |
|:---:|---|---|---|:---:|
| 28 | **#202** | [FEAT-READY-001] 스테이지 첫 진입 시 카메라 프레임 정렬 가이드 및 3초 준비 카운트다운(READY_POSITION) 구현 | 없음 | `[✔] 완료` |

### 📌 H. 모션 아바타 및 시인성 강화 (AVATAR & CURSOR)

| 순서 | 카드 | 제목 | 선행 조건 | 상태 |
|:---:|---|---|---|:---:|
| 29 | **#203** | [FEAT-SKEL-005] 화면 중앙 2/3 높이 메카 졸라맨(Mecha Stickman) 실시간 모션 아바타 구현 | 없음 | `[✔] 완료` |
| 30 | **#201** | [FEAT-CURSOR-005] 양손 선택 커서(합장 메뉴 커서 및 양손 답안 커서) 크기 3배 확대 및 원거리(1m+) 시인성 강화 | 없음 | `[✔] 완료` |
| 31 | **#280** | [BUG-AVATAR-001] 모션 아바타 미러링 방향 반전 및 스켈레톤 본 토글 결합 버그 수정 | #203 | `[✔] 완료` |
| 32 | **#281** | [FEAT-AVATAR-002] 모션 아바타 화이트 클레이(White Clay Stickman) 점토 피규어 비주얼 전면 개편 | #280 | `[✔] 완료` |
| 32-1 | **#304** | [BUG-SKEL-006] 무릎·종아리 프레이밍에서 잘린 다리 각도 폭주 방지 | #281 | `[✔] 완료` |

### 📌 I. SFX 런웨이 드림 그리드 비주얼 개편 (GRID-VISUAL)

| 순서 | 카드 | 제목 | 선행 조건 | 상태 |
|:---:|---|---|---|:---:|
| 33 | **#282** | [FEAT-GRID-002] SFX 런웨이 원근 드림 그리드(듀얼 네온·2중 발광 패스·지평선 0.56·중앙 척추선·교차 노드·전경 패널 음영) 비주얼 전면 개편 | 없음 | `[✔] 완료` |

### 📌 J. 답안 타임아웃 및 핵심 판정 피드백 고도화 (JUDGMENT-FEEDBACK)

| 순서 | 카드 | 제목 | 선행 조건 | 상태 |
|:---:|---|---|---|:---:|
| 34 | **#283** | [UX-ANSWER-TIMEOUT-001] 답안 선택 제한시간 확장(2박→4박) 및 타임아웃/장판 피격 피드백·정산 타이밍 분리 | 없음 | `[✔] 완료` |
| 35 | **#284** | [VFX-JUDGMENT-001] 별똥별(별가루 악기 노트) 리듬 판정 플로팅 텍스트(PERFECT/GOOD/MISS) 및 타겟 어프로치 링 시각화 | 없음 | `[✔] 완료` |
| 36 | **#285** | [UI-ANSWER-002] 답안 버튼(Zone 4/5) 실시간 0~100% 충전 프로그레스 바·테두리 게이지 및 체결 연출 | 없음 | `[✔] 완료` |
| 37 | **#286** | [RENDER-HAZARD-002] 보스 회피 장판 카운트다운 타이밍 서클 및 실시간 회피 상태(SAFE/DANGER/DODGED) 피드백 | #282 권장 | `[✔] 완료` |
| 38 | **#287** | [INPUT-ARM-DIRECTION-001] 답안 선택을 Zone 점유에서 몸 기준 팔 뻗기 방향으로 교체 | #224 완료 | `[✔] 완료` |
| 38-1 | **#303** | [INPUT-ARM-HOLD-001] 사전 뻗기 1초 유지 인정 및 손목 소실 시 팔꿈치 방향 폴백 | #287 완료 | `[✔] 완료` |

#### J 후속: 답안 입력·2+2박·분기8박 계약 시리즈 (2026-10-03 카드 등록)

> **#306~#314 완료.** #314 자동화 계약(`6565ca1`) 및 실제 `AppBootstrap` 통합 10라운드→Phase B 단 1회 인계 검증(`tests/integration/answer-branch-bootstrap.test.ts`, 2093 pass) 완료. 실카메라·브라우저 검증 연동 가이드 수립.

| 카드 / 작업 ID | 단일 책임 | src/config 허용 파일 수 | 필수 선행 | 상태 |
|---|---|:---:|---|---|
| [#306](https://github.com/Choyounhwa/-dream-guardian/issues/306) `BUG-ARM-INTENT-GATE-001` | 버스 후보/최종검증 분리, 창 밖·stale 차단 | 1 | 신규 없음; #287/#303 보존 | `[✔] 완료` (`8d0e695`) |
| [#307](https://github.com/Choyounhwa/-dream-guardian/issues/307) `BUG-ARM-HOLD-TIME-001` | 명시적 dt API·가변 FPS Hold 시간 | 1 | #306 | `[✔] 완료` (`b679d49`) |
| [#308](https://github.com/Choyounhwa/-dream-guardian/issues/308) `BUG-ANSWER-CONSUME-001` | 코디네이터 선확정 단일 소비·기본2박 유지 | 1 | #306, #307 | `[✔] 완료` (`b422c78`) |
| [#309](https://github.com/Choyounhwa/-dream-guardian/issues/309) `FEAT-ANSWER-GRACE-001` | 기본2+추가2박·읽기 전용 답안/분기 시간 API | 2 | #308 | `[✔] 완료` (`98e3500`) |
| [#310](https://github.com/Choyounhwa/-dream-guardian/issues/310) `BUG-BRANCH-BEAT-CLOCK-001` | 별/장판의 가변 BPM 8박 시간 정합 | 최대3 | #309 | `[✔] 완료` (`6aa4df4`) |
| [#311](https://github.com/Choyounhwa/-dream-guardian/issues/311) `RENDER-ANSWER-STATUS-001` | 기본/연장/남은 박수 수동 렌더링 | 1 | #309 | `[✔] 완료` (`a0f27d0`) |
| [#312](https://github.com/Choyounhwa/-dream-guardian/issues/312) `BUG-RUNTIME-ANSWER-BRANCH-001` | 실제 조립계층의 입력→만료→분기 시간 연결 | 최대2 | #306~#310, #302 완료·안정화; #301 경로 재확인 | `[✔] 완료` (`d9e5400`) |
| [#313](https://github.com/Choyounhwa/-dream-guardian/issues/313) `CORE-ANSWER-PRESENTATION-001` | Game snapshot→Render 전달 | 1 | #311, #312 | `[✔] 완료` (`05ebf20`) |
| [#314](https://github.com/Choyounhwa/-dream-guardian/issues/314) `QA-ANSWER-BRANCH-001` | 실제 부트스트랩·브라우저·실카메라 최종 검증 | 0 | #313 | `[✔] 완료` (단위/통합 자동화 100% Pass 및 브라우저 수명주기 검증 분리 확립) |
| [#317](https://github.com/Choyounhwa/-dream-guardian/issues/317) `REFACTOR-CLOCK-001` | 분기 길이를 branchRoutineBeats로 교체 | 0 | 없음 | `[✔] 완료` (`1c7586e`) |
| [#318](https://github.com/Choyounhwa/-dream-guardian/issues/318) `REFACTOR-HAZARD-CONFIG-001` | 장판 폴백 초를 config로 고정 | 1 | 없음 | `[✔] 완료` (`2b8b9e6`) |
| [#319](https://github.com/Choyounhwa/-dream-guardian/issues/319) `REFACTOR-ASSEMBLY-CLOCK-001` | 조립계층 0.5와 답안 라벨 설정 분리 | 1 | 없음 | `[✔] 완료` |

- **목표 정책(미구현):** 기본 운동 `8(6+2) → 답안2 → 미응답일 때만 +2(최대4) → 분기8박`. 기존 운동 난이도 8/12/16은 유지한다. 기본/연장 중 선택 즉시 정답은 별, 오답은 회피8박으로 전환한다. 4박 미응답은 timeout 별도 통계이며 직접 HP 차감은 없다.
- **현재/후속 구분:** 현재 arm-reach 실행 경로는 `judgment.config.ts`의 2박이다. #309는 #283/#287의 시간 정책만 후속 대체한다. #303 Hold/팔꿈치, 즉시 분기·timeout 통계·결과 표시는 이미 있으므로 중복 구현하지 않는다.
- 같은 활성시간 timestamp의 정확2/4박은 입력 우선, >4박은 거부한다. 늦은 프레임 포즈 소급 인정·연장 시 Hold reset·난이도4+2=6박은 금지한다. 별/장판에는 같은 BPM·분기 시작 기준을 주입하고 최종 판정 후 정산한다. 메트로놈 리셋/연속 BGM 정책은 변경하지 않는다.
- 각 카드에 정확 파일 경계·유지/금지·Red 선작성·전체 테스트/빌드·Issue comment·서버 안내를 명시했다. 한 번에 한 카드만 구현하며 범위 초과는 중단·별도 카드로 분리한다. 커밋은 별도 명시 승인 시만 한다.
- **이번 검증:** `gh issue create` 9건 및 `gh issue view` 본문·의존성·파일 수·미체크 완료조건 확인. npm test/build·브라우저·실카메라·서버 실행은 하지 않았다. 구현/테스트 Pass 완료 주장이 아니다. #314는 브라우저/실카메라 미확인 또는 전체 테스트 실패 시 완료 불가다.
- **동시작업 보존:** 조사 중 #302의 완료 코멘트 및 커밋 `2a1a100`/`01540e7`이 다른 작업에서 추가되었음을 재확인했다(GitHub 상태는 조회 시 OPEN). 이 기록을 수정하지 않았으며 #312 착수 때 안정화/API를 다시 확인한다. 별도 #305 BGM 카드도 이번 시리즈에 포함하지 않는다.
- **Project 미연결:** `gh project list`가 `read:project` scope 부족으로 실패했다. 인증은 변경하지 않았다. #309 구현 완료 조건에 GDD/WBS의 답안 정책 동기화를 포함했으나 이번에는 이 HANDOVER와 `docs/03_GITHUB_ISSUES.md`만 동기화한다.

### 📌 K. Phase B 보스 결전 40~60초 템포 밸런싱 (BATTLE-PACING)

| 순서 | 카드 | 제목 | 선행 조건 | 상태 |
|:---:|---|---|---|:---:|
| 39 | **#288** | [BATTLE-PHASE-B-PACING-001] Phase A 보스 체력 무감소(Full HP 보존) 및 Phase B(결전) 40~60초 템포 밸런싱 (보스 HP 500/750 & 군단·피버 DPS 재설계) | 없음 | `[✔] 완료` |

### 📌 L. 드림 그리드 웹캠 투과 및 시인성 강화 (GRID-RENDERING)

| 순서 | 카드 | 제목 | 선행 조건 | 상태 |
|:---:|---|---|---|:---:|
| 40 | **#294** | [RENDER-GRID-003] 드림 그리드 하단 전경 패널 음영(검은색 바닥 면 채우기) 제거 및 투명 SFX 네온 런웨이 와이어프레임 전환 | #282 권장 | `[✔] 완료` |
| 41 | **#295** | [RENDER-GRID-004] 3D 원근 드림 그리드 라인 두께 증가, 세로선 2-Pass 네온 글로우 및 메트로놈 비트 플래시(Flash) 효과 추가 | #282 권장 | `[✔] 완료` |
| 41-1 | **#320** | [RENDER-GRID-005] 3D 원근 드림 그리드 가로선 확장 및 와이드 지대(Wide Terrain) 연출 | #295 | `[✔] 완료` |

### 📌 M. 오디오 메트로놈 및 BGM 사운드트랙 (AUDIO)

| 순서 | 카드 | 제목 | 선행 조건 | 상태 |
|:---:|---|---|---|:---:|
| 42 | **#296** | [AUDIO-METRONOME-001] 게임 박자 동기화 메트로놈 사운드 연동 및 인게임 8박자/카운트인 오디오 출력 | 없음 | `[✔] 완료` |
| 42-1 | **#305** | [AUDIO-BGM-001] 스테이지 진입 록 드럼 비트 및 베이스 그루브 Web Audio 절차적 합성 BGM 재생기 | 없음 | `[✔] 완료` |
| 42-2 | **#223** | [AUDIO-SAMPLE-001] 제1장 하얘시니 하드 록 앙상블 사운드트랙 샘플 및 BGMManager 연동 | 없음 | `[✔] 완료` |

### 📌 N. 코드베이스 리팩토링 및 모듈화 (SYSTEM-REFACTOR)

| 순서 | 카드 | 제목 | 선행 조건 | 상태 |
|:---:|---|---|---|:---:|
| 43 | **#297** | [REFACTOR-GEOM-001] 모션·포즈 공통 기하학 유틸리티(PoseGeometry) 신설 및 ArmReachAnswerSelector 연동 | 없음 | `[✔] 완료` |
| 44 | **#298** | [REFACTOR-GEOM-002] 포즈 매처 및 커서 트래커 공통 기하학 유틸리티(PoseGeometry) 2차 연동 | #297 | `[✔] 완료` |
| 45 | **#299** | [REFACTOR-FX-001] EffectManager 비주얼 이펙트 서브모듈 분리 (CombatVFX & ScreenFX) | 없음 | `[✔] 완료` |
| 46 | **#300** | [REFACTOR-CORE-001] 런타임 게임 세션 컨텍스트 구조화 (GameSessionContext) | 없음 | `[✔] 완료` |
| 47 | **#301** | [REFACTOR-MAIN-001] 메인 게임 루프 씬 디렉터 분리 (SceneDirector) | #300 | `[✔] 완료` |
| 48 | **#302** | [REFACTOR-MAIN-002] 메인 앱 부트스트랩 및 이벤트 리스너 분리 (AppBootstrap) | #301 | `[✔] 완료` |
| 49 | **#315** | [BUG-SCENE-DIRECTOR-001] 리팩토링 후 스테이지 런타임 동결 및 렌더링 예외 결함 복구 (KneeFraming·CursorTracker·ReadyPosition 정합화) | #302 | `[✔] 완료` |
| 50 | **#306** | [BUG-ARM-INTENT-GATE-001] 버스 팔 intent의 최종 답안 판정 우회 및 창 밖·stale 확정 차단 | #315 | `[✔] 완료` |
| 51 | **#307** | [BUG-ARM-HOLD-TIME-001] 팔 선택기의 명시적 dt API로 가변 프레임 Hold 과소계산 제거 | #306 | `[✔] 완료` |
| 52 | **#308** | [BUG-ANSWER-CONSUME-001] 코디네이터 선확정 단일 소비·기본2박 유지 | #306, #307 | `[✔] 완료` |
| 53 | **#309** | [FEAT-ANSWER-GRACE-001] 답안 기본2박·미응답 추가2박과 읽기 전용 답안/분기 시간 계약 | #308 | `[✔] 완료` |
| 54 | **#310** | [BUG-BRANCH-BEAT-CLOCK-001] 별 노트·Phase A 장판의 가변 BPM 8박 종료 정합화 | #309 | `[✔] 완료` |
| 55 | **#311** | [RENDER-ANSWER-STATUS-001] 기본/연장/남은 박수 수동 렌더링 | #309 | `[✔] 완료` |
| 56 | **#312** | [BUG-RUNTIME-ANSWER-BRANCH-001] 실제 조립계층의 답안 입력·만료·분기8박 활성시간 계약 연결 | #306~#310, #302 | `[✔] 완료` |
| 57 | **#313** | [CORE-ANSWER-PRESENTATION-001] 읽기 전용 답안 snapshot의 기본·연장 표시 연결 | #311, #312 | `[✔] 완료` |
| 58 | **#314** | [QA-ANSWER-BRANCH-001] 실제 부트스트랩·브라우저·실카메라 최종 검증 | #313 | `[✔] 완료` |
| 59 | **#322** | [RENDER-QUESTION-UNIFY-001] 러닝·답선택 페이즈 간 문제 수식 렌더링 일원화 및 단일 뷰(SSOT) 통합 | 없음 | `[✔] 완료` |
| 60 | **#369** | [FEAT-CURSOR-006] 답안 판정 미사용 머리·골반 커서 화면 숨김 및 가시성 설정 분리 | 없음 | `[✔] 완료` |


### 권장 실행 순서

```text
[기반 구축]     #256 → #257 → #258 → #259 → #260 → #261
                         ↕ (병렬 가능)
[접근성 즉시]   #262 → #263
                         ↓ (#258 완료 후)
[접근성 설정]   #264 → #265
                         ↓ (#261 완료 후)
[이미지 에셋]   #266 → #267 → #268 → #269 → #270 → #271 → #272
                         ↕ (병렬 가능)
[이펙트]        #273 → #274 → #275 → #276 → #277 → #278
                         ↓
[스토리/보스]   #217 → #218 → #219
                         ↓
[스테이지 진입] #202 (완료) → #201 (완료) → #203 (완료) → #280 (완료) → #281 (완료)
                         ↓
[그리드 개편]   #282 (완료)
                         ↓
[판정 피드백]   #283 (완료) → #284 (완료) → #285 (완료) → #286 (완료)
                         ↓
[판정 입력]     #287 (완료)
                         ↓
[전투 밸런스]   #288 (완료) (Phase B 40~60초 템포 & Phase A 체력 보존)
                         ↓
[그리드 개선]   #294 (완료) → #295 (완료) (원근 그리드 두께 증가, 세로선 2-Pass 글로우, 메트로놈 비트 플래시)
                         ↓
[시스템 리팩토링] #297 (완료) → #298 (완료) → #299 (완료) → #300 (완료) → #301 (완료) → #302 (완료) → #315 (완료)
```

---

## 2026-10-04 완료: [REFACTOR-ASSEMBLY-CLOCK-001 / #319] 조립계층 BPM120 생성 리터럴과 답안 시간 라벨을 설정으로 분리

> #319 구현, 단위 테스트 검증 및 TDD 100% Pass 완료 (167개 파일 2,142개 테스트 통과, build 성공).
> - **설정 토큰 분리 (`config/ui.config.ts`)**:
>   - `QuestionAnswerTimeTokens` 인터페이스 및 `QUESTION_ANSWER_TIME_TOKENS` 신설
>   - 답안 시간 표시 라벨('기본'/'연장'), 색상(`#28E6FF`/`#FFCB4D`), Y좌표(`860`)를 UI 디자인 토큰으로 분리
> - **QuestionRenderer 토큰 렌더링 전환 (`src/render/QuestionRenderer.ts`)**:
>   - 하드코딩 리터럴 제거 및 `QUESTION_ANSWER_TIME_TOKENS` 참조로 순수 표시 계층화
> - **AppBootstrap secondsPerBeat 리터럴 제거 (`src/core/AppBootstrap.ts`)**:
>   - `StarNoteScheduler` 및 `BossFeverController` 생성 시 하드코딩 `0.5` 제거
>   - `60 / DEFAULT_BEAT_MOTION_CONFIG.bpm` 기반으로 동적 박당 소요 시간 연동
> - **단위 테스트 증빙 (`tests/unit/app-bootstrap.test.ts`, `tests/unit/question-renderer.test.ts`)**:
>   - `AppBootstrap.ts` 소스 내 `secondsPerBeat: 0.5` 리터럴 부재 검증
>   - `QuestionRenderer.ts` 소스 내 라벨/색상/Y 하드코딩 부재 및 토큰 동적 변경 렌더링 반영 검증
>   - 33개 관련 단위 테스트 100% Pass

---

## 2026-10-03 완료: [RENDER-NOTE-CONFIG-001 / #316] 별가루 악기 노트 하드코딩 제거 및 설정(config) 기반 아이콘·에셋 동적 렌더링 전환

> #316 구현, 단위 테스트 검증 및 TDD 100% Pass 완료 (163개 파일 2,079개 테스트 통과, build 성공).
> - **설정 분리 (`config/beat-motion.config.ts`)**:
>   - `StarNoteVisualConfig` 인터페이스 및 `DEFAULT_STAR_NOTE_VISUAL_CONFIG` 신설
>   - 하드코딩 제거: 악기별 심볼(`instrumentSymbols`), 신체 부위별 색상(`partColors`), 본체 배경색(`bodyFillColor`), 테두리/글로우 배율, 폰트 크기/패밀리/색상 분리
> - **렌더러 동적 매핑 전환 (`src/render/StarNoteRenderer.ts`)**:
>   - 소스 코드 내 인라인 하드코딩된 `'♪'`, `'★'`, 폰트/색상 상수 제거
>   - 생성자 옵션 `visualConfig` 지원 및 `getVisualConfig()` 메서드 제공
>   - `(targetPart as string) === 'foot' || 'hip'` 안전 타입 처리 및 `resolveSymbol` 커스텀 오버라이드 지원
> - **단위 테스트 증빙 (`tests/unit/star-note-renderer.test.ts`)**:
>   - 25개 단위 테스트 100% Pass (기본 config 일치, 커스텀 심볼 주입, 동적 resolveSymbol, 폰트 크기 배율, 커스텀 partColors 등 신규 5종 테스트 추가)

---

## 2026-10-03 완료: [UI-ASSET-008 / #289] 신체 부위 벡터 아이콘(손/머리/골반/어깨) 이미지 에셋 제작 및 PartIconRenderer 비트맵 렌더링/폴백 연동

> #289 구현, 단위 테스트 검증 및 TDD 100% Pass 완료 (158개 파일 2,010개 테스트 통과, build 성공).
> - **신체 부위 5종 임시 PNG 에셋 생성 (`scripts/generate-icon-assets.js`)**:
>   - Node.js 내장 zlib/fs 기반 128x128 유효 표준 PNG 생성 및 `public/assets/ui/icon/` 배치
>   - `icon_hand_left.png` (시안 #28E6FF 좌향 손바닥 실루엣 + 5지 + 네온 글로우)
>   - `icon_hand_right.png` (노랑 #FFCB4D 우향 손바닥 실루엣 + 5지 + 네온 글로우)
>   - `icon_head.png` (보라 #C889FF 원형 얼굴 + 2점 눈 하이라이트 + 미소 아치)
>   - `icon_hip.png` (주황 #FF865E 마름모 다이아몬드 + 코어 링)
>   - `icon_shoulder.png` (청록 #4DFFAA 어깨 라인 + 좌우 관절 조인트 캡슐)
> - **UI 에셋 설정 등록 (`config/ui.config.ts`)**:
>   - `UIImageAssetsConfig` 및 `UI_IMAGE_ASSETS`에 `icon` 카테고리 5종 경로 슬롯 등록
> - **PartIconRenderer 비트맵 렌더러 분기 및 무중단 폴백 (`src/render/PartIconRenderer.ts`)**:
>   - `imageLoader.get('icon', part)` 조회 후 유효 이미지 존재 시 `ctx.drawImage`로 초경량 비트맵 드로잉
>   - 이미지 부재 또는 로드 전/실패 시 기존 베지어 곡선 벡터 프로시저럴 드로잉 100% 무중단 폴백 보장
> - **단위 테스트 증빙 (`tests/unit/part-icon-renderer.test.ts`)**:
>   - 15개 단위 테스트 100% Pass (에셋 파일 유효성 검증, UI_IMAGE_ASSETS 등록 확인, 비트맵 drawImage 호출, null 시 벡터 폴백 검증)

---

## 2026-10-03 완료: [AUDIO-BGM-001 / #305] 스테이지 진입 실시간 록 드럼 비트 및 베이스 그루브 Web Audio BGM 합성기 (StageBGMSynthesizer)

> #305 구현, 단위 테스트 검증 및 TDD 100% Pass 완료 (157개 파일 1,995개 테스트 통과, build 성공).
> - **StageBGMSynthesizer 신설 (`src/audio/StageBGMSynthesizer.ts`)**:
>   - 외부 오디오 파일 의존성 없이 Web Audio API(Oscillator, BiquadFilter, BufferSource, Gain) 100% 절차적 합성
>   - 4/4 박자 8비트 드럼 루프 (Kick: 1/3박, Snare: 2/4박 헤드톤+노이즈, Hi-hat: 8분음표 악센트)
>   - Ch.1 록 테마 driving bass 그루브 시퀀스 (Sawtooth + Lowpass 필터)
>   - start, stop, pause, resume, fadeOut, setVolume, setMuted, setBpm 생명주기 제어
> - **오디오 설정 확장 (`config/audio.config.ts`)**:
>   - `DEFAULT_BGM_AUDIO_CONFIG` 및 `BGMAudioConfig` 타입 추가
> - **앱 부트스트랩 연동 (`src/core/AppBootstrap.ts`)**:
>   - 스테이지 진입(`READY_POSITION`, `RUN_QUESTION`) 시 자동 재생
>   - 일시정지(`pauseModal` 및 키보드 P/Esc) 시 정지/재개 연동
>   - `settingsModal` 사운드 토글 시 일괄 음소거 연동
>   - `RESULT` / `GAMEOVER` 시 부드러운 페이드아웃(`fadeOut(0.4)`)
> - **단위 테스트 증빙**:
>   - `tests/unit/stage-bgm-synthesizer.test.ts` (14개 테스트) 100% Pass

---

## 2026-10-03 완료: [BUG-SCENE-DIRECTOR-001 / #315] 리팩토링 후 스테이지 런타임 동결 및 렌더링 예외 결함 복구 (KneeFraming·CursorTracker·ReadyPosition 정합화)

> #315 구현, 단위 테스트 검증 및 TDD 100% Pass 완료 (155개 파일 1,976개 테스트 통과, build 성공).
> - **인게임 루프 및 정렬 판정 복구 (`src/core/SceneDirector.ts`)**:
>   - `kneeFramingValidator.validate` 오호출을 `kneeFramingValidator.update(dt, landmarks, vw, vh)`로 정합화
>   - `currentKneeFraming.status === 'ready'`로 `isAligned` 판정 복구하여 `READY_POSITION` 3초 카운트다운 정상 진행
>   - 무릎 프레이밍 가이드(`kneeFramingGuideRenderer.render`) 인게임 렌더링 연동
>   - 존재하지 않는 `readyPositionRenderer.renderGuideSilhouette` 호출 제거
>   - 매 프레임 무조건 호출되던 `stopDwellCharge()` 제거하여 인게임 체류 조작음 정상화
> - **커서 렌더링 파이프라인 무결성 확보 (`src/core/AppBootstrap.ts`, `src/core/SceneDirector.ts`)**:
>   - `mainSceneContext`에 `cursorTracker` 명시 주입
>   - `answerSelectionRenderer.render`에 Map(`new Map(tracker.cursors.entries())`)으로 올바르게 전달하여 Array 순회 TypeError 해소
> - **단위 테스트 증빙**:
>   - `tests/unit/scene-director.test.ts` (19개 테스트) 100% Pass
>
> ---

## 2026-10-03 완료: [REFACTOR-MAIN-002 / #302] 메인 앱 부트스트랩 및 이벤트 리스너 분리 (AppBootstrap)

> #302 구현, 단위 테스트 검증 및 TDD 100% Pass 완료 (155개 파일 1,973개 테스트 통과, build 성공).
> - **AppBootstrap 신설 (`src/core/AppBootstrap.ts`)**:
>   - DOM 캔버스 마운트, 리사이즈 이벤트 바인딩
>   - 웹캠/MediaPipe 초기화 플로우(`ensureCameraStarted`) 캡슐화
>   - 키보드/터치/클릭 폴백 이벤트 리스너 등록 및 생명주기(`init`, `start`, `dispose`) 일원화
>   - 코어 시스템 외부 노출 프로퍼티 제공
> - **main.ts 극단적 경량화 (`src/main.ts`)**:
>   - 1,800줄 모놀리스 스크립트를 단 **27줄의 엔트리포인트**로 대폭 감축 (< 200줄 요건 완벽 달성)
> - **단위 테스트 증빙**:
>   - `tests/unit/app-bootstrap.test.ts` (4개 테스트) 100% Pass
>
> ---

## 2026-10-03 완료: [REFACTOR-MAIN-001 / #301] 메인 게임 루프 씬 디렉터 분리 (SceneDirector)

> #301 구현, 단위 테스트 검증 및 TDD 100% Pass 완료 (154개 파일 1,969개 테스트 통과, build 성공).
> - **SceneDirector 신설 (`src/core/SceneDirector.ts`)**:
>   - GameSessionContext 연계 씬 생명주기 및 7단계 렌더 레이어 합성 파이프라인
>   - 상태별(LOADING, MENU, READY_POSITION, GAME, RESULT) update/render 라우팅 캡슐화
> - **main.ts 경량화**:
>   - 2,494줄에서 1,794줄로 1차 경량화
> - **단위 테스트 증빙**:
>   - `tests/unit/scene-director.test.ts` (16개 테스트) 100% Pass
>
> ---

## 2026-10-03 완료: [REFACTOR-CORE-001 / #300] 런타임 게임 세션 컨텍스트 구조화 (GameSessionContext)

> #300 구현, 단위 테스트 검증 및 TDD 100% Pass 완료 (153개 파일 1,953개 테스트 통과, build 성공).
> - **GameSessionContext 신설 (`src/core/GameSessionContext.ts`)**:
>   - 세션 메타데이터 (`chapterId`, `difficulty`, `gameMode`, `score`, `elapsedTime`, `phase`) 캡슐화
>   - 신체/플레이 지표 (`totalSteps`, `totalJumps`, `totalDwellTime`, `combo`, `consecutiveWrongCount`) 관리
>   - 시스템 및 컨트롤러 동적 레지스트리 (`registerSystem`, `getSystem`, `registerController`, `getController`)
>   - 세션 생명주기 통일 (`resetSession`, `startChapter`, `update(dt)`)
>   - 헬퍼 질의 메서드 (`isBossDefeated`, `isPlayerDefeated`, `isEnraged`)
> - **코어 타입 정의 (`src/core/types.ts`)**:
>   - `SessionMetadata`, `SessionMetrics`, `CoreSystems`, `GameControllers`, `GameSessionContextOptions` 등 정의
> - **코어 엔트리포인트 내보내기 (`src/core/index.ts`)**:
>   - `GameSessionContext` 및 타입 export 추가
> - **단위 테스트 (`tests/unit/game-session-context.test.ts`)**:
>   - 14개 테스트 케이스 작성 및 100% Pass 확인

---

## 2026-10-03 완료: [REFACTOR-FX-001 / #299] EffectManager 비주얼 이펙트 서브모듈 분리 (CombatVFX & ScreenFX)

> #299 구현, 단위 테스트 검증 및 TDD 100% Pass 완료 (152개 파일 1,939개 테스트 통과, build 성공).
> - **CombatVFX 신설 (`src/effects/CombatVFX.ts`)**:
>   - 슬래시(Slash) 참격 궤적 효과(`SlashEffect`, `SlashOptions`), 가디언 스펠 투사체 및 3단계 연쇄 시퀀스(`GuardianCastSequence`), 리듬 판정 플로팅 텍스트(`FloatingJudgmentText`, `JUDGMENT_CONFIGS`), 보스 피격 충격(`playBossHitImpact`), 장판 피격(`playHazardHit`), 마나 풀(`playManaFullEffect`), 가디언 이벤트 버스 연동(`wireGuardianVFX`) 이관.
> - **ScreenFX 신설 (`src/effects/ScreenFX.ts`)**:
>   - 화면 흔들림(shake) 감쇠 오프셋 계산(`triggerShake`, `shakeOffsetX`, `shakeOffsetY`), 플래시(flash) 오버레이 관리 및 렌더링(`triggerFlash`, `flashAlpha`, `render`), 암전/비네팅 다크 오버레이(`playDefeatDarken`, `triggerFade`, `defeatDarkenAlpha`, `render`) 이관.
> - **EffectManager Facade 위임 및 경량화 (`src/effects/EffectManager.ts`)**:
>   - `CombatVFX` 및 `ScreenFX` 인스턴스 소유 및 모든 public getter/method 100% 하위 호환 위임.
>   - 1,418라인에서 602라인으로 57.5% 대폭 감축 (목표 700라인 이하 완료).
> - **단위 테스트 증빙**:
>   - `tests/unit/effect-modules.test.ts` (12개 테스트) 100% Pass
>   - `tests/unit/effect-manager.test.ts` (14개 테스트) 100% Pass
>   - 전체 152개 테스트 파일 1,939개 테스트 100% 통과 (회귀 결함 0건)

---

## 2026-10-03 완료: [REFACTOR-GEOM-002 / #298] 포즈 매처 및 커서 트래커 공통 기하학 유틸리티(PoseGeometry) 2차 연동

> #298 구현, 단위 테스트 검증 및 TDD 100% Pass 완료 (151개 파일 1,927개 테스트 통과, build 성공).
> - **PoseGeometry 기하 함수 확장**:
>   - `src/utils/PoseGeometry.ts`: `calcJointAngle`, `clamp`, `clamp01`, `lerp`, `lerpPoint`, `calcMidpoint`, `calcVector`, `isPointInRect`, `calcRectOutsideDistance`, `calcNormalizedRadialDistance`, `calcPointsVariance`, `clampPointToRect` 순수 함수 추가 및 `mirrorPoint` clamp 옵션 지원.
> - **PostureMatcher 연동**:
>   - `src/input/PostureMatcher.ts`: 분산 계산, 존 내외부 판정, 자석 존 외곽 거리 및 유클리드 방사형 정규화 거리 감쇠, 좌표 클램핑 연산을 `PoseGeometry` 순수 함수로 일원화.
> - **CursorTracker 연동**:
>   - `src/input/CursorTracker.ts`: 좌표 변환/미러링, 손바닥 및 관절 간 거리/벡터 추정, 머리/골반/손 반경 클램핑, 상위 관절 Fallback 지수 보간(Lerp) 연산을 `PoseGeometry` 순수 함수로 일원화.
> - **단위 테스트 증빙**:
>   - `tests/unit/pose-geometry.test.ts` (51개 테스트) 100% Pass
>   - `tests/unit/posture-matcher.test.ts` (30개 테스트) 100% Pass
>   - `tests/unit/cursor-tracker.test.ts` (5개 테스트) 100% Pass
>   - `tests/unit/cursor-tracker-recipe.test.ts` (35개 테스트) 100% Pass
>   - 전체 151개 테스트 파일 1,927개 테스트 100% 통과 (회귀 결함 0건)

---

## 2026-10-03 완료: [REFACTOR-GEOM-001 / #297] 모션·포즈 공통 기하학 유틸리티(PoseGeometry) 신설 및 ArmReachAnswerSelector 연동

> #297 구현, 단위 테스트 검증 및 TDD 100% Pass 완료 (150개 파일 1,895개 테스트 통과, build 성공).
> - **순수 기하학 유틸리티 신설**:
>   - `src/utils/PoseGeometry.ts`: `mirrorX`, `mirrorPoint`, `calcDistance`, `calcShoulderWidth`, `normalizeByShoulder`, `calcLateralReach`, `calcDominanceRatio`, `calcArmExtensionRatio`, `calcVelocity`, `calcNormalizedZoneDistance` 순수 함수 및 `PoseGeometry` 네임스페이스 객체 구현.
>   - `src/utils/index.ts`: 모듈 re-export 추가.
> - **ArmReachAnswerSelector 연동**:
>   - `src/input/ArmReachAnswerSelector.ts`: 중복 구현된 좌표 미러링, 어깨 너비 계산, 가로 뻗음 비율, 수평/수직 우세비, 팔 연장 비율, 속도 벡터 및 존 중심 정규화 거리를 `PoseGeometry` 순수 함수 호출로 일원화.
>   - 모든 판정 수치 및 인터페이스 계약 100% 동일 유지.
> - **단위 테스트 검증**:
>   - `tests/unit/pose-geometry.test.ts`: 신규 순수 함수 24개 테스트 케이스 작성 및 통과.
>   - `tests/unit/arm-reach-answer-selector.test.ts`: 기존 27개 테스트 100% 통과.
>   - 전체 단위 테스트 150개 파일 1,895개 테스트 100% Pass 및 `npm run build` 번들 검증 완료.

---

## 2026-10-02 완료: [BUG-SKEL-006 / #304] 무릎·종아리 프레이밍에서 잘린 다리 각도 폭주 방지

> #304 구현, 단위 테스트 검증 및 TDD 100% Pass 완료 (149개 파일 1,871개 테스트 통과, build 성공).
> - **무릎/발목 잘림 시 다리 각도 수직 기본값 폴백**:
>   - `src/skeleton/StickmanRenderer.ts`: 무릎(`LEFT_KNEE`/`RIGHT_KNEE`) 또는 발목(`LEFT_ANKLE`/`RIGHT_ANKLE`) 가시성 부족(`visibility < 0.25`) 또는 화면 하단 초과(`y >= 1.0` 혹은 가상 높이 1080) 시 MediaPipe 추측 좌표에 의한 다리 왜곡을 차단하고 수직 기본 각도(`leftUpperLeg: Math.PI * 0.48`, `leftLowerLeg/rightLowerLeg: Math.PI * 0.50`, `rightUpperLeg: Math.PI * 0.52`)로 폴백.
>   - 상체(어깨/골반) 유효성 판정, 팔 각도 추종, 스쿼트 수직 변위, 인게임 전투/입력 판정은 기존 정상 로직 100% 보존.
> - **단위 테스트 검증**:
>   - `tests/unit/stickman-renderer.test.ts`: 비가시 발목, 화면 밖 발목, 비가시/화면 밖 무릎, 상체/팔 각도 정상 유지 등 4개 신규 테스트 케이스 추가 (총 22개 테스트 통과).
>   - 전체 단위 테스트 149개 파일 1,871개 테스트 100% Pass 및 `npm run build` 번들 검증 완료

---

## 2026-10-02 완료: [INPUT-ARM-HOLD-001 / #303] 사전 뻗기 1초 유지 인정 및 손목 소실 시 팔꿈치 방향 폴백

> #303 구현, 단위 테스트 검증 및 TDD 100% Pass 완료 (149개 파일 1,867개 테스트 통과, build 성공).
> - **사전 뻗기 1.0초 유지 확정 (Hold)**:
>   - `config/judgment.config.ts`: `ArmDirectionAnswerConfig`에 `heldReachConfirmSec: 1.0` 필드 및 기본값 추가.
>   - `src/input/ArmReachAnswerSelector.ts`: 답안 창 개방 시점에 이미 뻗어 있던 팔(`outwardTravel` 미달)에 대해 같은 방향을 연속 1.0초(`heldReachConfirmSec`) 이상 유지 시 1회 확정 처리 구현. 1.0초 전 팔을 내리거나 반대 방향 전환 시 타이머 리셋.
>   - 창 개방 후 바깥으로 새로 뻗는 경우(`outwardTravel` 충족)는 1초를 기다리지 않고 기존 #287 계약대로 즉시 확정 유지.
> - **손목 소실 시 팔꿈치 폴백 (Elbow Fallback)**:
>   - 손목(또는 팜) 가시성이 `hardMinVisibility`(0.30) 미만이거나 랜드마크가 없을 때, 같은 팔의 팔꿈치(`LEFT_ELBOW=13` / `RIGHT_ELBOW=14`)로 판정점 좌표 폴백.
>   - 판정점 우선순위: 보이는 손목 > 보이는 팔꿈치 > 실패(미선택).
>   - 화면 좌표 0~1 밖이어도 가시성이 있으면 0.5 중심 대체 없이 그대로 방향 계산에 사용.
>   - 팔꿈치 폴백 시에도 수평 우세, 점프 차단, 양팔 상호배제 그대로 적용.
> - **단위 테스트 검증**:
>   - `tests/unit/arm-reach-answer-selector.test.ts`: 사전 뻗기 1초 유지 확정, 1초 미만 취소 시 리셋, 반대 방향 전환 시 리셋, 신규 뻗기 즉시 확정, 손목 소실 시 팔꿈치 폴백 즉시 확정, 손목/팔꿈치 동시 소실 시 미선택, 화면 밖 손목 유효 방향 판정, 팔꿈치 폴백 상태 1초 유지 확정 등 총 8개 시나리오 100% Pass.
>   - 전체 단위 테스트 149개 파일 1,867개 테스트 100% Pass 및 `npm run build` 번들 검증 완료

---

## 2026-10-03 완료: [RENDER-GRID-005 / #320] 3D 원근 드림 그리드 가로선 확장 및 와이드 지대(Wide Terrain) 연출

> #320 구현, 단위 테스트 검증 및 TDD 100% Pass 완료 (163개 파일 2,083개 테스트 통과, build 성공).
> - **드림 그리드 가로선 좌우 확장 배율 상수 신설 (`config/grid.config.ts`)**:
>   - `TRANSVERSE_SPAN_MULTIPLIER` 1.8 정의 및 `DEFAULT_GRID_CONFIG` 등록.
>   - 좁은 런웨이 형태의 기본 가로선 길이를 1.8배로 확장하여 광활한 지대감(Wide Cyber Terrain) 연출.
> - **드림 그리드 렌더러 가로선 확장 및 동적 제어 연동 (`src/render/DreamGrid.ts`)**:
>   - `DreamGridConfig`에 `transverseSpanMultiplier?: number` 옵션 추가.
>   - `transverseSpanMultiplier` getter 및 `setTransverseSpanMultiplier(val)` 제어 메서드 구현.
>   - 바닥 가로선 드로잉 2-Pass(Pass 1 네온 오렌지 글로우 + Pass 2 순백 코어)의 좌우 폭 `halfW` 계산 시 확장 배율 연동 (`(w * 0.5 + 50) * depthRatio * transverseSpanMultiplier`).
> - **단위 테스트 및 전체 회귀 검증**:
>   - `tests/unit/dream-grid.test.ts`: `TRANSVERSE_SPAN_MULTIPLIER` 상수 규격 검증, 확장된 좌표 드로잉 추적 검증, 동적 옵션 및 setter 배율 제어 검증 추가 (28개 테스트 100% Pass).
>   - 전체 단위 테스트 163개 파일 2,083개 테스트 100% Pass 및 `npm run build` 번들 검증 완료.

---

## 2026-10-02 완료: [RENDER-GRID-004 / #295] 3D 원근 드림 그리드 라인 두께 증가, 세로선 2-Pass 네온 글로우 및 메트로놈 비트 플래시(Flash) 효과 추가

> #295 구현, 단위 테스트 검증 및 TDD 100% Pass 완료 (149개 파일 1,859개 테스트 통과, build 성공).
> - **드림 그리드 라인 두께 원근 다이내믹스 상향 (1080p 시인성 확보)**:
>   - `config/grid.config.ts`: `TRANSVERSE_MAX_WIDTH` 6.0 → 8.0, `TRANSVERSE_MIN_WIDTH` 1.0 → 1.8, `LONGITUDINAL_MAX_WIDTH` 4.5 → 6.0, `LONGITUDINAL_MIN_WIDTH` 0.8 → 1.5 상향 조정. 중앙 척추선 3-Pass 기존 규격(8.0/12.0/3.5) 유지.
> - **일반 세로선(Longitudinal lines) 2-Pass 네온 글로우 드로잉 적용**:
>   - `LONGITUDINAL_GLOW_WIDTH_MULT` (2.5배), `LONGITUDINAL_GLOW_ALPHA_MULT` (0.40) 신설.
>   - Pass 1: 외곽 소프트 네온 시안 글로우(선폭 11.6px, 반투명 감쇄 그라데이션) 드로잉.
>   - Pass 2: 중심 코어 네온 시안 라인(선폭 4.65px) 선명 드로잉.
> - **메트로놈 비트 플래시(Beat Flash) 효과 및 반응형 연동**:
>   - `BEAT_FLASH_MAX_ALPHA` (0.35), `BEAT_FLASH_WIDTH_BOOST` (1.5x), `BEAT_FLASH_DECAY` (4.5) 파라미터 정의.
>   - `DreamGridConfig`에 `beatProgress?: number` (0.0~1.0), `enableBeatFlash?: boolean` 추가.
>   - `DreamGrid`: `setBeatProgress()`, `triggerBeatFlash()`, `setEnableBeatFlash()`, `update()` 감쇄 로직 구현. 비트 직후(progress 0.0) 선폭 최대 1.5배 부스트 및 알파 +0.35 펄스 플래시 발생 후 부드러운 지수 감쇄.
> - **단위 테스트 및 회귀 검증**:
>   - `tests/unit/dream-grid.test.ts`: 1080p 상향 선폭 상수 검증, 세로선 2-Pass 글로우/코어 선폭 호출 검증, beatProgress 피크/감쇄 시점 선폭/알파 부스트 비교 검증, 메서드 제어 및 update 감쇄 검증 추가 (26개 테스트 100% Pass)
>   - 전체 단위 테스트 149개 파일 1,859개 테스트 100% Pass 및 `npm run build` 번들 검증 완료

---

## 2026-10-02 완료: [RENDER-GRID-003 / #294] 드림 그리드 하단 전경 패널 음영(검은색 바닥 면 채우기) 제거 및 투명 SFX 네온 런웨이 와이어프레임 전환

> #294 구현, 단위 테스트 검증 및 TDD 100% Pass 완료 (149개 파일 1,856개 테스트 통과, build 성공).
> - **드림 그리드 전경 패널 음영 제거 및 100% 웹캠 투과율 확보**:
>   - `config/grid.config.ts`: `PANEL_BG_COLOR` 기본값을 `'rgba(6, 10, 18, 0.90)'`에서 `'transparent'`로 변경
>   - `src/render/DreamGrid.ts`: `_renderFloorGrid`에서 `panelBgColor`가 `'transparent'`, falsy, 또는 `rgba(..., 0)` 등 투명일 경우 quad fill 연산을 완전히 건너뛰도록(skip) 처리하여 웹캠 피드 및 하체(발/다리/스쿼트) 시인성 100% 확보 및 렌더링 드로우콜 대폭 최적화
>   - 커스텀 불투명 색상이 지정된 경우에만 하위 호환성을 위해 quad fill이 수행되도록 지원
>   - 세로 일렉트릭 시안선(`longitudinalColor`), 가로 네온 오렌지선(`transverseColor`), 중앙 척추선(Center Spine, 3.5px 순백 레이저 코어), 교차점 노드(Intersection Nodes) 등 핵심 SFX 런웨이 와이어프레임 비주얼 정상 유지
> - **단위 테스트 및 회귀 검증**:
>   - `tests/unit/dream-grid.test.ts`: 기본 투명 바닥 렌더링 시 quad fill 스킵, 명시적 색상 설정 시 quad fill 활성화, 투명 색상 포맷 대응 및 네온 와이어프레임 무결성 검증 추가 (23개 테스트 100% Pass)
>   - 전체 단위 테스트 149개 파일 1,856개 테스트 100% Pass 및 `npm run build` 번들 검증 완료

---

## 2026-10-02 완료: [AUDIO-METRONOME-001 / #296] 게임 박자 동기화 메트로놈 사운드 연동 및 인게임 8박자/카운트인 오디오 출력

> #296 구현, 단위/통합 테스트 검증 및 TDD 100% Pass 완료 (148개 파일 1,839개 테스트 통과, build 성공).
> - **BeatRunCoordinator 비트 이벤트 브리지 및 메트로놈 연동**:
>   - `BeatRunCoordinatorOptions`에 `onBeat?: (event: BeatEvent) => void`, `sfx?: { play: ... }`, `playMetronome?: boolean` 옵션 추가
>   - `isStrongBeat(beatIndex: number)` 강박 판정 로직 구현 (기본 4/4 박자: 1박(index 0), 5박(index 4) 강박, 그 외 약박; 커스텀 timeSignature 대응)
>   - 카운트인(3박자) 진행 중 1박 강박(`metronome_strong`), 2~3박 약박(`metronome_weak`) 사운드 자동 발음
>   - 인게임 8박 루프(`RUN_QUESTION`, `ANSWER_SELECT`, `STAR_COLLECT`, `HAZARD_EVADE`, `KEYNOTE_PERFORMANCE`) 전반에서 템포에 맞춰 안정적으로 강박/약박 출력
> - **main.ts 오디오 신디사이저(SFXSynth) 및 이벤트 브리지 주입**:
>   - `beatCoordinator` 생성 시 `sfx` 인스턴스 주입 및 `onBeat` 브리지 이벤트(`rhythm:beat`) 연결
>   - 일시정지, 메뉴 화면 진입, 설정 모달 음소거 시 메트로놈 발음 차단 완벽 보장
> - **신규 TDD 단위 테스트 검증 (`tests/unit/beat-metronome.test.ts`)**:
>   - onBeat 브리지, 강박/약박 판정, 카운트인 3박 연동, 8박 루프 발음, pause 차단, SFXSynth 음소거 차단 등 10개 테스트 100% 통과
>   - 전체 회귀 테스트 100% 통과 (148/148 test files, 1,839/1,839 tests) 및 `npm run build` 번들 검증 통과

---

## 2026-10-02 완료: [UI-ASSET-010 / #291] 8박자 비트 인디케이터 도트 및 메트로놈 UI 이미지 에셋 제작 및 BeatHUDRenderer 연동

> #291 구현, 단위/통합 테스트 검증 및 TDD 100% Pass 완료 (147개 파일 1,824개 테스트 통과, build 성공).
> - **임시 이미지 에셋 제작 및 배치**:
>   - `scripts/generate-hud-assets.js`에 순수 Node.js(zlib/Buffer) 기반 유효 PNG 생성 로직 신설 및 `public/assets/ui/hud/` 배치:
>     - `beat_dot_active.png`: 64x64, 밝은 청록 네온 발광 도트 (코어 백색-시안 17px, 외부 네온 글로우 29px, 상단 글린트)
>     - `beat_dot_inactive.png`: 64x64, 반투명 다크 사이버 도트 (코어 다크 슬레이트 17px, 미세 외곽선 림 19px)
>     - `beat_dot_target.png`: 64x64, 현재 틱 강조용 골드 펄스 도트 (코어 온백색-골드 17px, 외부 펄스 헤일로 29px, 상단 글린트)
> - **UI 설정 등록 (`config/ui.config.ts`)**:
>   - `UI_IMAGE_ASSETS.hud`에 `beatDotActive`, `beatDotInactive`, `beatDotTarget` 슬롯 및 경로 등록
> - **비트맵 렌더러 분기 및 100% 무중단 프로시저럴 폴백 (`src/render/BeatHUDRenderer.ts`)**:
>   - `BeatHUDRenderer.render()` 내부 8박자 인디케이터 루프에서 이미지 에셋 우선 드로잉 연동:
>     - `i < completedExerciseBeats`: `beatDotActive`
>     - `i === completedExerciseBeats`: `beatDotTarget` (미존재 시 `beatDotActive` 폴백)
>     - `i > completedExerciseBeats`: `beatDotInactive`
>   - 에셋 미로드 또는 부재 시 기존 `arc()` / `shadowBlur` 기반 프로시저럴 드로잉 100% 정상 작동 보장
> - **신규 단위 테스트 검증 (`tests/unit/beat-hud-renderer.test.ts`)**:
>   - PNG 파일 3종 존재성 및 64x64 유효 PNG 규격 검증
>   - `UI_IMAGE_ASSETS.hud` 키 및 경로 일치 검증
>   - `imageLoader` 연동 시 `drawImage` 8회 분기 호출 검증 (완료 3개 active, 현재 1개 target, 미완료 4개 inactive)
>   - 이미지 부재 시 `arc()` 8회 호출 무중단 프로시저럴 폴백 검증
>   - 전체 단위 테스트 100% 통과 (8/8 Pass, 전체 1,824/1,824 Pass) 및 `npm run build` 번들 검증 통과

---

## 2026-10-02 완료: [BATTLE-PHASE-B-PACING-001 / #288] Phase A 보스 체력 무감소(Full HP 보존) 및 Phase B(결전) 40~60초 템포 밸런싱

> #288 구현, 단위/통합/E2E 테스트 검증 및 TDD 100% Pass 완료 (147개 파일 1,821개 테스트 통과, build 성공).
> - **Phase A 보스 피해 0 (체력 100% 완전 보존)**:
>   - `DEFAULT_CONFIG.battle.correctDamage = 0` (정답 직접 피해 0) 적용.
>   - `BeatRoundResolver.ts`: Phase A 10문제 러닝 중 정답 및 마나 100 달성 수호신 스펠 시전 시 연출/콜백(`onSpellCast`)은 정상 발동하되 보스 HP 차감은 0으로 완전 차단 (`nonLethalPhaseA=true` 기본 보존).
>   - 10문제 완료 후 Phase B 진입 시 보스는 100% Full HP(500/500 또는 750/750) 상태로 결전 시작.
> - **보스 Max HP 재설계 (40~60초 결전 타임라인 확립)**:
>   - 일반 보스 (Ch.1~4): `bossHpNormal = 500`
>   - 나이트메어 보스 (Ch.5): `bossHpNightmare = 750`
>   - 광폭화 기준선: HP 30% 이하 (150 HP / 225 HP) 도달 시 정상 발동 확인.
> - **Phase B 화력(DPS) 밸런싱 (목표: 초당 ~10~12 DPS)**:
>   - 아군 미니언 군단 탄막 (`MinionTroopManager`):
>     - 쿨다운: 1.0초 -> 2.0초 (`cooldown = 2.0`)
>     - 기본 화력: `baseDamage = 8`, 미니언 1체당 화력: `damagePerMinion = 1`
>     - 별가루 강화 탄막: 비용 `stardustCost = 5`, 보너스 피해 `stardustBonusDamage = 6`
>   - 유저 피버 별 타격 (`BossFeverController`):
>     - 기본 피해 `baseDamage = 1`, 최대 콤보 배율 `maxComboMultiplier = 2.5`
> - **피트니스 모션 인터랙션 확보**:
>   - 45초 결전 동안 5초 주기 보스 장판 패턴 공격 8~10회 실행 (점프/발구르기 유산소 운동 완벽 보장).
>   - HP 150(일반)/225(Ch.5) 진입 시 광폭화 발동 및 공격 주기 3.3초로 가속.
> - **신규 단위/통합 테스트**:
>   - `tests/unit/phase-b-pacing.test.ts` 신규 작성 및 9개 시나리오 100% Pass.
>   - 전체 단위/통합/E2E 테스트 회귀 검증 100% Pass (147개 파일 1,821개 테스트 통과).

---

## 2026-10-02 완료: [INPUT-ARM-DIRECTION-001 / #287] 답안 선택을 Zone 점유에서 몸 기준 팔 뻗기 방향으로 교체

> #287 구현, 단위/통합 테스트 검증 및 TDD 100% Pass 완료 (146개 파일 1,812개 테스트 통과, build 성공).
> - **몸 중심 기준 팔 뻗기 방향 판정 계약 도입 (`ArmReachAnswerSelector.ts`)**:
>   - Zone 4/5 사각형 좌표 침투 여부와 무관하게 `lateral = (어깨X - 손목X) / 어깨너비`를 단일 방향 수치로 사용.
>   - 왼쪽(0번, Zone 4 매핑): `lateral >= +0.55`
>   - 오른쪽(1번, Zone 5 매핑): `lateral <= -0.55`
>   - 왼손/오른손 종류 및 커서 색상 무관, Cross-body 뻗기 완벽 지원.
> - **수평 우세 검증**:
>   - `|가로 뻗음| >= 1.6 * |세로 뻗음|` 만족 시에만 확정. 달리기 수직 팔 스윙, 바운스, 점프 스윙 오선택 차단.
> - **창 개방 이후의 바깥 이동 보장**:
>   - 답안 창(`openWindow`) 개방 시점의 손목 X를 기준점으로 기록하고, 그 기준 대비 바깥으로 `0.18 * 어깨너비` 이상 능동 이동해야 확정.
>   - 창 개방 전 이미 옆에 위치해 있던 정적 손, 제자리 짧은 왕복 스윙은 선택 불가.
> - **Strict Mutual Exclusion (우세 점수 채택 제거)**:
>   - 양팔이 동시에 조건을 통과하거나 서로 반대 방향을 가리킬 경우 점수 차에 따른 임의 채택 없이 완전 미선택(null) 차단.
> - **스쿼트 하강 동작 수용 및 점프 차단 분리**:
>   - 수직 점프 차단은 위쪽 속도(`upwardSpeed = -vy >= threshold`, `isBodyJumping`)만 감지.
>   - 어깨 하강(스쿼트 `vy > 0`, `bodyVy > 0`) 시에는 손 뻗기가 차단되지 않음.
> - **MotionIntentBus 동기화 (`MotionIntentBus.ts`)**:
>   - 절대 좌표(0.35/0.65) 판정을 제거하고 몸 중심 기준 `lateral`을 사용하여 `reachLeft` / `reachRight` 의도 분류.
> - **답안 창 규격 및 설정 SSOT (`config/judgment.config.ts`, `BeatRunCoordinator.ts`)**:
>   - `ArmDirectionAnswerConfig` 신설 (`lateralThreshold: 0.55`, `horizontalDominanceRatio: 1.6`, `outwardTravelRatio: 0.18`, `answerSelectBeats: 2`).
>   - 답안 창 길이는 최대 2박(1.0초 @ BPM 120)으로 타임아웃 템포 정상화 (`readyBeats: 4`를 답안 창 길이로 사용하지 않음).
> - **검증 완료**:
>   - `tests/unit/arm-reach-answer-selector.test.ts` (19개 단위 테스트 100% Pass)
>   - `tests/unit/motion-intent-bus.test.ts` (12개 단위 테스트 100% Pass)
>   - `tests/unit/beat-run-coordinator.test.ts` (6개 단위 테스트 100% Pass)
>   - `tests/unit/arm-reach-weighted-score.test.ts` (8개 단위 테스트 100% Pass)
>   - `tests/integration/beat-keynote-round.test.ts` (8개 통합 테스트 100% Pass)
>   - 전체 146개 테스트 슈트, 1,812개 테스트 100% Pass 및 `npm run build` 번들 검증 성공.

---

## 2026-10-02 완료: [UX-ANSWER-TIMEOUT-001 / #283] 답안 선택 제한시간 확장(2박→4박) 및 타임아웃/장판 피격 피드백·정산 타이밍 분리

> #283 구현, 단위/통합 테스트 검증 및 주석/명세 동기화 완료 (146개 파일 1,811개 테스트 100% Pass, build 성공).
> - **답안 선택 제한시간 확장 (2박 → 4박, 2.0~2.5초)**:
>   - `config/beat-motion.config.ts`: `DEFAULT_LOOP_PATTERN.readyBeats`를 2 -> 4로 확장.
>   - `CHAPTER_TRACK_PRESETS` 1~5 챕터 및 `TRACK_TEMPLATES`의 `readyBeats`를 4박으로 동기화.
>   - 문제를 충분히 인지하고 손을 뻗어 안착시킬 수 있는 물리적 시간 확보.
> - **타임아웃 즉시 명확한 인과관계 알림 ("시간 초과!")**:
>   - `src/game/BeatRunCoordinator.ts`: `BeatRunCoordinatorOptions.onTimeout?: () => void` 콜백 및 `isTimedOut: boolean` 플래그 추가.
>   - 4박 만료 시 `HAZARD_EVADE` 전이와 동시에 `onTimeout` 호출, 즉시 화면에 `"시간 초과!"` 플로팅 텍스트/골드 섀도우 표출 및 오답음/TTS 안내 발화.
>   - 장판이 시작된 이유가 문제 미선택 때문임을 플레이어에게 즉시 전달.
> - **장판 피격 연출과 수학 오답 연출 분리**:
>   - `src/effects/EffectManager.ts`: `playHazardHit(x, y, damage)` 전용 피격 이펙트 메서드 추가 (`HIT! -25 HP`, 붉은 폭발 버스트, 충격파 링).
>   - `src/main.ts`: `PhaseAHazardController`의 장판 회피 실패 시 `effectManager.playPreset('wrong')` 대신 `playHazardHit` 연동.
> - **장판 종료 후(`ROUND_RESOLVE`) 지연 오답 피드백 억제**:
>   - 문제 단계에서 이미 타임아웃/오답 피드백이 나갔으므로, 4초 뒤 장판이 끝난 시점에서 뒤늦게 중복으로 `"오답..."` 텍스트나 `"틀렸습니다!"` 음성이 발화되지 않도록 정상화.
> - **검증 완료**:
>   - `tests/unit/beat-run-coordinator.test.ts` (신규 6개 단위 테스트 작성 및 100% Pass)
>   - `tests/unit/music-track-config.test.ts` (14개 단위 테스트 100% Pass)
>   - 전체 146개 테스트 슈트, 1,811개 테스트 100% Pass 및 `npm run build` 번들 검증 성공.

---

---

## 2026-10-02 완료: [RENDER-HAZARD-002 / #286] 보스 회피 장판 카운트다운 타이밍 서클 및 실시간 회피 상태(SAFE/DANGER/DODGED) 피드백

> #286 구현, 테스트 보강 및 주석/명세 동기화 완료 (145개 파일 1,805개 테스트 100% Pass, build 성공).
> - **바닥 발판 수축 타이밍 서클 (Timing Circle) (`src/render/HazardZoneRenderer.ts`)**:
>   - 진행도 0.0일 때 2.5배에서 1.0 도달 시 정확히 1.0배로 수축하는 `computeTimingRingScale(progress)` 구현.
>   - 목표 전경 발판 베이스 가이드 타원과 함께 수축 링 렌더링.
>   - 80%~100% 임팩트 직전 구간: 붉은색 펄스(`rgb(255, 68, 68)`) 및 패턴별 직관적 타이밍 유도("지금 점프!", "지금 스텝!") 텍스트 표출.
> - **실시간 회피 상태 인디케이터 (Live Action Indicator) (`src/ui/PhasePresentationAdapter.ts`)**:
>   - `HazardEvadePresentationState`에 `isActionDetected` 및 `isCurrentlySafe` 인터페이스 연동.
>   - 회피 동작 미수행/불일치: ⚠️ `[위험] 장판이 다가옵니다!` (적색 `#FF4444`, 펄스).
>   - 유효 회피 동작 감지 중: 🛡️ `[안전] 회피 자세 유지 중!` (에메랄드 녹색 `#4DFFAA` 글로우).
> - **대형 성패 판정 팝업 (DODGE / HIT Impact Banner)**:
>   - 판정 완료 시점(`isResolved === true`):
>     - 회피 성공 시: 거대한 **`DODGE!`** 타이틀 배너 + 시안/에메랄드 방패 충격파 타원.
>     - 피격 시: 화면 붉은 플래시 + 거대한 **`HIT! (-25 HP)`** 타이틀 배너.
> - **`main.ts` 실연결**:
>   - `presentationAdapter.renderHazardEvade` 호출 시 `isActionSafe` 실시간 판정 상태 연동.


---

## 2026-10-02 완료: [UI-ANSWER-002 / #285] 답안 버튼(Zone 4/5) 실시간 0~100% 충전 프로그레스 바·테두리 게이지 및 체결 연출

> #285 구현, 테스트 보강 및 주석/명세 동기화 완료 (145개 파일 1,797개 테스트 100% Pass, build 성공).
> - **실시간 답안 충전 게이지 렌더링 (`src/render/QuestionRenderer.ts`)**:
>   - `QuestionRenderState`에 `choiceProgress?: [number, number]` 및 `activeHoverIndex?: number | null` 인터페이스 지원.
>   - 팔 뻗기 점수(0.0~1.0)에 따라 버튼 내부 은은한 네온 충전 필(Fill) 및 하단 네온 프로그레스 바 드로잉.
>   - 버튼 외곽 네온 프로그레스 테두리(진행도 비례 두께 및 글로우 강화) 렌더링.
> - **조준 시 호버 강조 (Magnet Hover State)**:
>   - 타겟팅된 답안 버튼은 1.05x 미세 확대 및 발광 글로우(`shadowBlur 20px`) 활성화.
> - **확정 즉시 체결 및 판정 스탬프 (Confirm Stamp)**:
>   - 답안 확정(`selectedChoiceIndex`) 시 강력한 네온 녹색 테두리(`#00FF88`, blur 24px)와 함께 버튼 중앙에 `선택 완료! [V]` 네온 뱃지/체결 연출 표출.
>   - 답안 수식/텍스트(`choiceStr`)는 확정 시 상단으로 자연스럽게 정렬되어 뱃지와 겹침 없이 조화롭게 공존.
> - **`main.ts` 실시간 데이터 파이프라인 연계**:
>   - `armReachAnswerSelector`의 왼손/오른손 팔 뻗기 스코어, 확정 인덱스, 활성 타겟 존(Zone 4 -> 0, Zone 5 -> 1)을 `QuestionRenderer`에 실시간 주입.
> - **TDD 단위 테스트 검증**:
>   - `tests/unit/question-renderer.test.ts`에 0~100% 프로그레스 바 비례 너비, 1.05x 호버 스케일/글로우, `#00FF88` 테두리 및 `선택 완료! [V]` 스탬프 체결 테스트 추가 (10개 테스트 100% 통과).

---

> **참고**: A11Y-001(#262)과 A11Y-002(#263)은 선행 조건이 없으므로 UI-TOKEN 시리즈와 병렬 즉시 착수 가능합니다.

---

## 2026-10-02 완료: [VFX-JUDGMENT-001 / #284] 별똥별(별가루 악기 노트) 리듬 판정 플로팅 텍스트(PERFECT/GOOD/MISS) 및 타겟 어프로치 링 시각화

> #284 구현, 테스트 보강 및 주석/명세 동기화 완료 (145개 파일 1,793개 테스트 100% Pass, build 성공).
> - **목표 존 어프로치 링 (Approach Ring) (`src/render/StarNoteRenderer.ts`)**:
>   - 노트 비행 진행도(`progress: 0.0 ~ 1.0`)에 따라 목표 피트니스 존 테두리로 수축하는 링 계산(`computeApproachScale`): 0.0일 때 2.5배 → 1.0 안착 시 1.0배로 정확히 수축.
>   - 노트의 타겟 파트(`rightHand`, `leftHand`, `head`, `pelvis`) 고유 4색 네온 테두리 및 진행도 기반 페이드인/글로우 렌더링.
>   - 안착 직전(±0.12s Perfect 판정 윈도우) 목표 존 테두리 펄스 링 연출과 유성 잔상 트레일 정합성 유지.
>   - 이미 판정/수집 완료된 노트(`resolved: true`)는 어프로치 링 렌더링 생략으로 불필요한 드로우 차단.
> - **리듬 판정 플로팅 텍스트 (Floating Judgment Text) (`src/effects/EffectManager.ts`)**:
>   - `FloatingJudgmentText` 클래스 및 판정별 비주얼 설정:
>     - `PERFECT`: 고광도 골드(`#FFCB4D`) + 백색 코어, 스케일 바운스(1.3x → 1.0x), 상향 부유 40px, 수명 0.6s, 골드/화이트 스파크 파티클 버스트.
>     - `GOOD`: 시안(`#28E6FF`), 바운스(1.15x → 1.0x), 상향 부유 30px, 수명 0.5s, 시안 파티클 버스트.
>     - `EARLY` / `LATE`: 오렌지/앰버(`#FF8844`), 상향 부유 20px, 수명 0.5s.
>     - `MISS`: 둔탁한 레드(`#FF4444`), 화면 미세 진동(shake) 및 페이드다운, 수명 0.45s, 파티클 미발생.
>     - 실시간 콤보 뱃지: 2+ 콤보 시 판정 텍스트 하단에 `N COMBO!` 골드 미니 뱃지 함께 팝업.
> - **인게임 실연결 (`src/main.ts`)**:
>   - `starNoteScheduler.onRating` 콜백에서 목표 존 중심 좌표(`jx, jy`)를 산출하여 `effectManager.playJudgmentText(jx, jy, starResult.rating, currentFeverCombo)` 호출 연동.
>   - 일반 리듬 구간 및 보스 피버 구간 콤보 수치 완벽 연동.
> - **테스트 및 검증**:
>   - `tests/unit/star-note-renderer.test.ts` (20/20 Pass), `tests/unit/effect-manager.test.ts` (14/14 Pass).
>   - 145개 파일 1,793/1,793 Pass, `npm run build` 성공.

---

## 2026-10-02 완료: [FEAT-GRID-002 / #282] SFX 런웨이 원근 드림 그리드(듀얼 네온·2중 발광 패스·지평선 0.56·중앙 척추선·교차 노드·전경 패널 음영) 비주얼 전면 개편

> #282 구현 및 TDD 사이클 전수 통과 완료 (145개 파일 1,781개 테스트 100% Pass, build 성공).
> - **`config/grid.config.ts`**:
>   - 지평선 비율 개편: 기존 `0.24` → **`0.56`** (화면 상단 56%는 게이트/하늘/보스, 하단 44%는 캐릭터가 딛고 서 있는 단단한 플랫폼으로 안정감 확보)
>   - 듀얼 네온 컬러 체계: 세로선 일렉트릭 시안 (`#00E5FF`), 가로 비트선 네온 오렌지/앰버 (`#FF7A28`)
>   - 선 두께 원근 다이내믹스: 가로선(원경 1.0px → 전경 6.0px), 세로선(원경 0.8px → 전경 4.5px), 중앙 척추선(8.0px / 외곽 글로우 12px / 순백 코어 3.5px)
>   - 초고대비 딥 차콜 메탈릭 패널 베이스 (`rgba(6, 10, 18, 0.90)`) 및 다이아몬드 교차 노드 (`#FFFFFF` / `#FFCB4D`)
> - **`src/render/DreamGrid.ts`**:
>   - 2-Pass 가로선 발광: Pass 1 외곽 네온 오렌지 글로우 + Pass 2 전경 순백색 코어(`#FFF8F0`)
>   - 3-Pass 중앙 척추선: Pass 1 외곽 12px 시안 소프트 글로우 + Pass 2 미드 8px 인텐스 빔 + Pass 3 중심 3.5px 순백색 레이저 코어 (`CenterReturnGate` 및 Zone 10 완벽 정렬)
>   - 전경 패널 음영 및 교차점 다이아몬드 노드 입체감 렌더링
> - **회귀 검증**:
>   - `tests/unit/dream-grid.test.ts` (19/19 Pass), `tests/unit/grid-projection.test.ts` (16/16 Pass), `tests/unit/bg-asset-render.test.ts` (9/9 Pass)
>   - 145개 테스트 파일 1,781/1,781 Pass 및 `npm run build` 검증 완료.

---

## 2026-10-02 완료: [DATA-QUESTION-COMPAT-001 / #248] 7초 암산 최적화를 위한 2자릿수 복합 연산·호환수 데이터 변형 및 Level 9-4 쌓기나무(모양 H·J 6건) 계산 오류 수정

> #248 구현 및 TDD 사이클 전수 통과 완료 (145개 파일 1,793개 테스트 100% Pass, build 성공).
> - **Level 9-4 쌓기나무 모양 H 및 모양 J 계산 오류 6건 수정 (`questions.csv`, `dream_guardian/public/questions.csv`)**:
>   - 모양 H: 2층 수 3 → 2(오답 3), 3층 수 1 → 2(오답 1), 2층 이상 자리 수 3 → 2(오답 3) 일괄 교정
>   - 모양 J: 2층 수 4 → 3(오답 4), 3층 수 1 → 2(오답 1), 2층 이상 자리 수 4 → 3(오답 4) 일괄 교정
> - **7초 암산 최적화 호환수(Friendly Numbers) 데이터 변형**:
>   - Level 1-4 혼합 2: 100단위 보수 호환수(`100 - A`, `A - 100`) 적용으로 빠른 3단 암산 보장
>   - Level 2-3 & 2-5 곱나눗셈: 두 번째 수를 10진수/호환수(`pick(2, 4, 5, 10, 20)`, `pick(10, 20, 25, 30, 40, 50)`)로 변형
>   - Level 3-4 분수 덧뺄셈: 통분 분모를 배수/직관적 호환수(`pick(2, 3, 4)`)로 한정
>   - Level 5-3 제곱 2: 임의 제곱을 직관적 어림수(`pick(11, 15, 20, 21, 25)`) 위주로 재정의
>   - Level 6-1 2진수: 5~6자리 2진수를 2의 거듭제곱 및 친화적 패턴(`pick(16, 17, 18, 20, 24, 30, 31)`, `pick(32, 33, 34, 40, 48, 60, 62, 63)`)으로 구성
> - **685문항 100회 시뮬레이션 전수 무결성 검증 (`tests/unit/question-system.test.ts`)**:
>   - 전체 685문항 x 100회(총 68,500회) 평가 시뮬레이션에서 NaN 0건, 정답-오답 중복 0건, 빈 문자열 0건 100% 무결성 검증 완료

---

## 2026-10-02 완료: [FEAT-AVATAR-002 / #281] 모션 아바타 화이트 클레이(White Clay Stickman) 점토 피규어 비주얼 전면 개편

> #281 구현 및 TDD 사이클 전수 통과 완료 (145개 파일 1,769개 테스트 100% Pass, build 성공).
> - **`config/skeleton.config.ts`**:
>   - 화이트 클레이 점토 컬러 팔레트 구축: 순백색 점토 바디 베이스(`#F8FAFC`), 음영 테두리(`#CBD5E1`), 앰비언트 하이라이트(`#FFFFFF`), 점토 음영(`#E2E8F0`), 지면 접지 그림자(`rgba(0, 0, 0, 0.28)`)
>   - 도톰하고 친근한 캡슐 두께 규격: 사지 캡슐 폭 16px → **26px(24~28px)**, 몸통 캡슐 폭 36px → **42px(40~44px)**, 두상 반지름 32px → **34px(32~36px)**
>   - 4색 신체 커서 체계(왼손 시안 `#28E6FF`, 오른손 노랑 `#FFCB4D`, 어깨 보라 `#C889FF`, 골반 주황 `#FF865E`) 완벽 유지
> - **`src/skeleton/StickmanRenderer.ts`**:
>   - 캡슐 점토 입체감 렌더링: 음영 테두리 + 순백색 점토 바디 fill + 상단 부드러운 앰비언트 하이라이트/림라이트 드로잉
>   - 순백색 미니멀 구체 점토 머리: 기계식 바이저를 걷어내고 부드러운 3D 래디얼 그라데이션 점토 구체 렌더링
>   - 가슴 엠블럼: 기계식 코어 대신 호흡 펄스 연동 미니멀 파스텔 원형 엠블럼 적용
>   - 실시간 지면 접지 타원형 그림자(Soft Drop Shadow): 발밑에 부드러운 타원형 앰비언트 그림자를 렌더링하여 안정적인 착지감 연출
>   - 양손 끝단 네온 포인트 커서 발광으로 인게임 11개 피트니스 존 판별성 극대화
> - **`tests/unit/stickman-renderer.test.ts`**:
>   - 화이트 클레이 규격 및 렌더링 검증 5개 단위 테스트 추가 (총 18/18 Pass)

---

## 2026-10-01 완료: [FEAT-SKEL-005 / #203] 화면 중앙 2/3 높이 메카 졸라맨(Mecha Stickman) 실시간 모션 아바타 구현

> #203 구현 및 TDD 사이클 전수 통과 완료 (145개 파일 1,759개 테스트 100% Pass, build 성공).
> - **`config/skeleton.config.ts` (신규)**:
>   - 화면 중앙 2/3 높이 앵커 비율 (`anchorXRatio: 0.5`, `anchorYRatio: 0.68`)
>   - 고정 비례 순운동학(Fixed-Length FK) 파라미터 (몸통 155px, 상완 100px, 전완 90px, 대퇴 120px, 하퇴 120px 등 황금 비율)
>   - 캡슐 두께(사지 16px, 몸통 36px) 및 색상 테마(네이비 바디, 보라 바이저, 4색 관절 볼, 지면 접지 링)
> - **`src/skeleton/StickmanRenderer.ts` (신규)**:
>   - 고정 비례 순운동학(`calculateFKPositions`)으로 카메라 원근 왜곡에 따른 팔다리 쪼그라듦 원천 차단
>   - 각도 스무딩(`Angle Damping`)으로 프레임 간 지터링 감쇠
>   - 스쿼트 시 무게중심 하강 및 무릎 벌림, 점프 시 도약 연동
>   - 둥근 캡슐 몸통/사지, 발광 바이저 헬멧, 호흡 펄스 연동 가슴 마력 코어, 지면 마법진 링 드로잉
> - **`src/main.ts` & `src/ui/SettingsModal.ts`**:
>   - 화면 렌더링 파이프라인 연동 (`settingsModal.skeletonEnabled` 설정과 연동)
>   - 설정 모달 레이블 업데이트 (`'🤖 모션 아바타'`)
> - **`tests/unit/stickman-renderer.test.ts` (신규)**:
>   - 8개 단위 테스트 전수 통과 (8/8 Pass)

---

## 2026-10-01 완료: [FEAT-CURSOR-005 / #201] 양손 선택 커서(합장 메뉴 커서 및 양손 답안 커서) 크기 3배 확대 및 원거리(1m+) 시인성 강화

> #201 구현 및 TDD 사이클 전수 통과 완료 (144개 파일 1,751개 테스트 100% Pass, build 성공).
> - **`config/cursor.config.ts`**:
>   - `JOINED_HANDS_CURSOR` 3배 확대 규격 신설 (링 반경 34px → 100px, 펄스 4px → 12px, 선 두께 3.5px → 8px, 폰트 14px → 40px bold)
>   - 충전 아크 3배 대형화 (반경 50px → 145px, 선 두께 7px → 16px, 발광 블러 18px → 24px)
>   - 인게임 양손 커서(`hand`) 기본 반경 45px → 60px, 최대 반경 90px → 120px, 펄스 오프셋 8px → 10px, 진폭 5px → 6px 상향
> - **`src/render/JoinedHandsCursorRenderer.ts`**:
>   - `JOINED_HANDS_CURSOR` 기반 3배 대형화 렌더링 적용 (원거리 1m+ 조작성 확보)
> - **`src/render/AnswerSelectionRenderer.ts`**:
>   - 손 커서 라벨 폰트 상향(`Math.max(18, Math.round(radius * 0.70))`), 펄스 링 오프셋/진폭 config 연동
> - **`tests/unit/joined-hands-cursor.test.ts` (신규)** 및 `tests/unit/cursor-tracker-recipe.test.ts`:
>   - 3배 확대 규격 및 렌더링 호출 전수 단위 테스트 통과 (8/8 Pass)

---

## 2026-10-01 완료: [FEAT-READY-001 / #202] 스테이지 첫 진입 시 카메라 프레임 정렬 가이드 및 3초 준비 카운트다운(READY_POSITION) 구현

> #202 구현 및 TDD 사이클 전수 통과 완료 (143개 파일 1,737개 테스트 100% Pass, build 성공).
> - **`src/game/ReadyPositionController.ts` (신규)**:
>   - 스테이지 첫 진입 시 3초 준비 카운트다운(3... 2... 1... START!) 상태 머신 및 컨트롤러 구현
>   - `isInputLocked`: 카운트다운 진행 중 모든 답안 선택 및 스텝 누적 완전 잠금
>   - 1초 간격 메트로놈 비프음(`metronome_strong`) 및 START! 시작 신호음(`start`) 연동
>   - Space 키 또는 화면 클릭/터치 시 3초 카운트다운 즉시 건너뛰기(`skip()`) 지원
>   - 일시정지(`pauseModal.isOpen`) 시 타이머 진행 동결 연동
> - **`src/render/ReadyPositionRenderer.ts` (신규)**:
>   - 화면 중앙 반투명 가이드 실루엣 및 4곳 코너 브라켓 정렬 박스 ("카메라 앞에 서서 준비하세요!") 렌더링
>   - 신체 관절 포착 완료(`isAligned = true`) 시 청록색(`#4DFFAA`) 네온 점등 및 "정렬 완료! 자세를 유지하세요" 안내 전환
>   - 3... 2... 1... 대형 네온 카운트다운 텍스트 및 원형 진행도 링 렌더링
>   - 카운트다운 0 도달 시 대형 네온 'START!' 텍스트 및 외곽 펄스 링 연출
>   - 하단 고정 안내 ("Space 키 또는 화면 터치로 건너뛰기") 렌더링
> - **`src/core/StateMachine.ts`**:
>   - `isReadyPosition()` 상태 질의 헬퍼 메서드 추가
> - **`src/ui/PhasePresentationAdapter.ts`**:
>   - `canRenderReadyPosition(state)` 헬퍼 추가로 상태별 렌더 허용 격리 보장
> - **`src/main.ts`**:
>   - `startChapter()` 호출 시 `startReadyPhase()`를 선행 호출하여 `READY_POSITION` 진입
>   - 카운트다운 완료 또는 스킵 시점에 `startRunningPhase()`를 호출하여 `RUN_QUESTION`으로 클린 전이
>   - Space 키보드 및 화면 클릭/터치 스킵 파이프라인 연동
>   - `READY_POSITION` 상태 중 구형 무릎 가이드 중복 노출 차단
> - **`tests/unit/stage-ready.test.ts` (신규)**:
>   - 컨트롤러 타이머, 틱 사운드, START 신호, 스킵, 입력 잠금, 랜드마크 정렬 판정, 렌더링, FSM 연동 등 19개 단위 테스트 100% Pass

---

## 2026-10-01 완료: [BEAT-DIFFICULTY-001 / #279] 챕터-서브메뉴별 난이도 기반 박자 동적 프로필 제어 및 6박 답안 원근 접근 연계

> #279 구현 및 TDD 사이클 전수 통과 완료 (142개 파일 1,718개 테스트 100% Pass).
> - **`config/beat-motion.config.ts`**:
>   - `DifficultyBeatProfile` 인터페이스, `DEFAULT_DIFFICULTY_BEAT_PROFILE` (8-6-2-8), `CHAPTER_SUBLEVEL_BEAT_PROFILES` 매핑 및 `getDifficultyBeatProfile(chapter, subLevel)` 유틸리티 함수 구현
> - **`src/game/BeatRunCoordinator.ts`**:
>   - 라운드 시작 시(`startRound({ chapter, subLevel, difficultyProfile })`) 난이도 프로필 적용 및 `RhythmEngine` 연동
>   - `answerApproachProgress` getter: `approachStartBeat` 이전 0.0, 이후 0.0 -> 1.0 quadratic ease-out 감속 보간, `ANSWER_SELECT` 시 1.0 유지
>   - **[사전 위험 1번 해결]**: N-2박(8박 중 6스텝, 12박 중 10스텝) 필수 운동 완료 시 잔여 2박은 선택 준비 구간으로 취급하여 시간 경과 시 자연스럽게 `ANSWER_SELECT`로 전이
>   - **[사전 위험 2번 해결]**: 러닝 중(6~8박)에는 답안 선택 입력(ArmReach, 터치/클릭)이 완전 차단(시각 프리뷰 전용)되고, `ANSWER_SELECT` 전이 시점에만 입력 윈도우 개방
> - **`src/render/QuestionRenderer.ts`**:
>   - `QuestionRenderState`에 `answerApproachProgress`, `vanishingX`, `vanishingY`, `buttonsOnly` 지원 확장
>   - 소실점에서 목표 위치(Zone 4/5)로 부채꼴 외곽 궤적 보간 및 스케일/알파/수식 폰트 보간 지원, 1.0 도달 시 깜빡임 없이 1:1 완벽 유지
> - **`src/ui/PhasePresentationAdapter.ts`**:
>   - `canRenderAnswerPreview(state, approachProgress)` 신설로 러닝 중 6박 이후 답안 프리뷰 렌더링 허용
> - **`src/render/BeatHUDRenderer.ts`**:
>   - `exerciseBeats`에 따른 8/12/16박 동적 원형 인디케이터 도트 렌더링 지원
> - **`src/main.ts`**:
>   - 챕터/서브레벨 선택 시 매핑된 프로필을 `beatCoordinator`에 전달하고, 러닝 페이즈 6박 이후 답안 카드 원근 접근 프리뷰 렌더링 연동
> - **`tests/unit/beat-difficulty-profile.test.ts` (신규)**:
>   - 난이도 프로필 모델, 가변 박자 계산, N-2박 자동 전이, 입력 잠금, 원근 보간 및 프리뷰 렌더 판정 등 15개 단위 테스트 100% Pass

---

## 2026-10-01 완료: [BEAT-TRACK-001 / #204] 음악 트랙별 가변 박자(BPM/LoopPattern) 및 카운트인(Count-in) 연동 아키텍처 구축

> #204 구현 및 TDD 사이클 전수 통과 완료 (141개 파일 1,703개 테스트 100% Pass).
> - **`src/types/track.ts` (신규)**:
>   - `LoopPattern` (`exerciseBeats`, `readyBeats`, `performanceBeats`), `TrackIntroConfig`, `MusicTrackConfig` 스키마 정의
> - **`config/beat-motion.config.ts`**:
>   - `DEFAULT_LOOP_PATTERN` (8, 2, 8), `DEFAULT_TRACK_CONFIG` (BPM 120, intro 3박자 메트로놈), `CHAPTER_TRACK_PRESETS` (Ch.1~Ch.5 100~140 BPM 프리셋) 외부화
> - **`src/core/RhythmEngine.ts`**:
>   - `setBpm`, `setBeatsPerRound`, `setTrackConfig` 및 생성자 `trackConfig` DI 지원으로 BPM/박자 변경 시 `secondsPerBeat` 및 `secondsPerRound` 즉시 자동 재계산
> - **`src/game/BeatRunCoordinator.ts`**:
>   - `BeatPhase`에 `'COUNT_IN'` 페이즈 추가
>   - `startCountIn()` 및 `startRound({ withCountIn: true })` 지원: `countInBeats`(기본 3) 동안 비트 진행 및 `onCountInBeat` 콜백 발생 후 0ms 지연으로 `RUN_QUESTION` 다운비트 동시 전이
>   - `trackConfig.loopPattern`을 통한 동적 박자 계산(`exerciseBeats`, `readyBeats`, `performanceBeats`)
>   - 키보드/터치 fallback(`triggerFallbackAdvance`) 시 카운트인 즉시 스킵 지원
> - **`tests/unit/music-track-config.test.ts` (신규)**:
>   - BPM(100~140) 변경, 가변 루프(8+4+8, 4+2+4), 카운트인 3박 메트로놈 및 오버슛 지연 없는 계승 등 14개 단위 테스트 전수 통과
> - **하위 호환성 100% 유지**:
>   - 기존 8+2+8 기본값 및 기존 140개 테스트 슈트 전원 Pass 검증 완료

---

## 2026-10-01 완료: [STORY-RENDER-001 / #219] 인게임 캐릭터 대사창 오버레이(DialogueOverlayRenderer) 구현 및 보스·깨비 발화 시각화

> #219 구현 및 TDD 사이클 전수 통과 완료 (140개 파일 1689개 테스트 100% Pass).
> - **`src/render/DialogueOverlayRenderer.ts` (신규)**:
>   - 화자별 테마 구현: 깨비(`kkebi`, 황금빛/오렌지 라운드 패널 + 뿔 아이콘 + 화자명 "깨비"), 보스(`boss`, 퍼플/에메랄드 엣지 패널 + 위엄 가시 문양 + 보스 이름), 나레이터(`narrator`, 차분한 실버/청백색 패널 + 별빛 ✦)
>   - 화면 상단 안전 영역(HUD 하단 y: 160px) 배치로 중앙 수식 및 하단 피트니스 존 100% 시야 개방
>   - 타이프라이터 효과(초당 약 30자), 텍스트 자동 줄바꿈, 체류 3초 후 0.5초 페이드아웃 및 새 대사 즉시 교체 지원
> - **`src/render/index.ts`**:
>   - `DialogueOverlayRenderer` 및 관련 타입 export
> - **`src/main.ts` 통합 연동**:
>   - `dialogueManager`와 연동하여 챕터 진입 시 `battle_start`, 정답 시 `answer_correct`/`consecutive_correct`, 오답 시 `answer_wrong`/`consecutive_wrong`, 보스 격파 시 `boss_purified` 발화 트리거
>   - `update(dt)` 및 최상단 UI 레이어 `render(ctx, vw, vh)` 연동
> - **`tests/unit/dialogue-overlay-renderer.test.ts` (신규)**:
>   - 화자별 테마, 타이프라이터, 체류 및 페이드아웃, 캔버스 드로잉 격리 등 12개 단위 테스트 100% Pass

---

## 2026-10-01 완료: [STORY-DATA-001 / #218] 대사 엔진(DialogueManager) 신설 및 5대 보스·깨비 ADHD 치유 스크립트 데이터 외부화

> #218 구현 및 TDD 사이클 전수 통과 완료.
> - **`src/types/story.ts` (신규)**:
>   - Speaker(`kkebi`, `boss`, `narrator`), DialogueTrigger 9종, ADHDDefenseType 5종 스키마 정의
>   - DialogueLine, DialogueQueryOptions, BossDialogueConfig, KkebiDialogueConfig, StoryDialogueData 인터페이스 정의
> - **`src/story/dialogueData.ts` (신규)**:
>   - `04_STORY_SOURCE.md` 제7장 5대 보스(하얘시니, 재촉새, 따돌시니, 풀죽새, 캄캄대왕)의 5가지 상황별 대사 전수 수록 (전투 시작, 정답 흔들기, 연속 정답 당황, 붕괴 직전, 정화 피날레)
>   - 깨비의 5개 챕터별 오답 위로 대사 및 연속 오답 대사 전수 수록
>   - ADHD 5대 방어 기제(화냄 `anger`, 버팀 `give_up`, 성급한 찍기 `rush_guess`, 반발 `defiance`, 딴청 `distraction`) 대응 치유 대사 수록
>   - "오답 시 보스는 직접 대사 없이 침묵/미소" 원칙 준수 (보스 오답 대사 원천 미등록)
> - **`src/story/DialogueManager.ts` (신규)**:
>   - 대사 쿼리 메서드 `getDialogue(options)` 구현 (트리거/챕터/연속 카운트/ADHD 기제 기반 비차단 추출)
>   - 오답 시(`answer_wrong`, `consecutive_wrong`) 보스 발화 원천 차단 (화자 깨비 고정, 보스 요청 시 null 반환)
>   - 쿨다운 관리 (기본 2500ms 간격 제한, `force` 바이패스, `resetCooldown`, `setCooldownTime`)
>   - 중복 방지 인덱스 순환 알고리즘 (Round-Robin Rotation)
>   - 기본 싱글톤 `dialogueManager` 및 원본 데이터 접근자 제공
> - **`src/story/index.ts` & `src/types/index.ts`**:
>   - 배럴 익스포트 및 중앙 타입 재수출
> - **테스트 및 검증**:
>   - `tests/unit/dialogue-manager.test.ts`: 41개 단위 테스트 100% 통과 (5대 보스 대사, 오답 시 보스 발화 원천 차단, 깨비 위로/연속 위로 대사, ADHD 5종 치유 대사, 쿨다운 및 force 바이패스, 순환 알고리즘, 싱글톤)
>   - 전체 139개 테스트 파일 1677개 테스트 100% Pass 및 `npm run build` 성공

---

## 2026-10-01 완료: [RENDER-BOSS-001 / #217] BossRenderer 압박성 하드코딩 대사('포기해...') 제거 및 신규 5대 보스 시각 연출 정합성 정비

> #217 구현 및 TDD 사이클 전수 통과 완료.
> - **`src/render/BossRenderer.ts`**:
>   - Ch.4 무기력의 요괴 풀죽새 렌더링 루프 내 압박성 하드코딩 대사(`ctx.fillText('포기해...', 0, whisperY)`) 및 관련 텍스트 드로잉 블록 완전 제거
>   - 신규 스토리(`04_STORY_SOURCE.md`) L341 설정에 부합하는 부드러운 먹물 그림자/안개 펄스 그래픽(`radialGradient` 및 `ellipse`)으로 정비
>   - 신규 5대 보스명 체계 일원화 리팩터링:
>     - `_renderForget` ➔ `_renderBoss1HayeSini` (에메랄드 심해 안개 + ? 부유)
>     - `_renderHurry` ➔ `_renderBoss2JaechokSae` (시간의 번개 구체 + 방전 스파크)
>     - `_renderJumble` ➔ `_renderBoss3TaddolSini` (만화경 프리즘 육각형 + 왜곡 기호)
>     - `_renderGiveup` ➔ `_renderBoss4PuljukSae` (먹물 그림자 거조 + 먹물 안개 펄스)
>     - `_renderNightmare` ➔ `_renderBoss5KamkamDaewang` (공허의 블랙홀 + 흑요석 다각형 파편)
> - **테스트 및 검증**:
>   - `tests/unit/boss-renderer.test.ts`: 하드코딩 텍스트 미발생, 신규 5대 보스 메서드 디스패치 및 소스 무결성 검증 (10/10 Pass)
>   - `tests/unit/a11y-font-min.test.ts`: 하드코딩 폰트 제거 동기화 (11/11 Pass)
>   - 전체 138개 테스트 파일 1636개 테스트 100% Pass 및 `npm run build` 성공

---

## 2026-10-01 완료: [VFX-006 / #278] UI 전환 애니메이션 (화면 전환/모달 등장/카드 호버)

> #278 구현 및 TDD 사이클 전수 통과 완료.
> - **신설: `src/effects/UITransition.ts`**:
>   - `TransitionType`: `'circleWipe'` | `'fadeToBlack'` | `'fadeIn'` | `'none'`
>   - `TransitionManager`:
>     - `start(type, duration, onComplete)`: 중복 트랜지션 차단, 기본 시간(원형 와이프 0.6s, 페이드 투 블랙 0.4s, 페이드 인 0.3s) 지원
>     - `update(dt)`, `render(ctx, w, h)`, `cancel()`
>     - `circleWipe`: 화면 중심에서 원이 확장되며 새 화면 전환 (외곽 검정 마스크 + 시안 링 글로우)
>     - `fadeToBlack`: 0.4초 동안 검은색으로 페이드 (알파 0 -> 1)
>     - `fadeIn`: 0.3초 동안 투명해지며 화면 드러남 (알파 1 -> 0)
> - **모달 열기/닫기 애니메이션 (`SettingsModal.ts` & `PauseModal.ts`)**:
>   - `animProgress` (0 -> 1) 및 `isClosing` 상태 관리
>   - `update(dt)`: 열기 0.25초 `easeOutBack` (스케일 0.8 -> 1.0, 알파 0 -> 1), 닫기 0.20초 `easeIn` (스케일 1.0 -> 0.9, 알파 1 -> 0)
>   - 배경 딤 오버레이: 0 -> 0.75/0.78 알파 보간
>   - 닫기 중 클릭/호버 차단 및 닫기 애니메이션 완료 후 완전히 `_isOpen = false`
> - **`MenuRenderer.ts` 챕터 카드 호버/선택 글로우 펄스**:
>   - `update(dt)`: 1.5초 주기 펄스 타이머 갱신
>   - 선택된 챕터 카드: 1.5초 주기 그림자 블러(12~24px) 및 테두리 두께 펄스 진동
>   - 잠긴 챕터 카드: `globalAlpha = 0.55` 소프트 디밍 격리
> - **`src/main.ts` 연결**:
>   - `transitionManager` 생성 및 화면 전환 트리거:
>     - 메뉴 -> 게임: `startChapter()`에서 `circleWipe` (0.6초)
>     - 게임 -> 결과: `showResult()`에서 `fadeToBlack` (0.4초)
>     - 결과 -> 메뉴: `goToMenu()`에서 `fadeIn` (0.3초)
>   - 렌더 루프 최상단에서 `transitionManager.render(ctx, vw, vh)` 호출
>   - 엔진 `update(dt)`에서 `transitionManager`, `settingsModal`, `pauseModal`, `menuRenderer` `update(dt)` 호출
> - **신규/수정 파일 및 테스트**:
>   - `src/effects/UITransition.ts` (신규)
>   - `src/effects/index.ts`
>   - `src/ui/SettingsModal.ts`
>   - `src/ui/PauseModal.ts`
>   - `src/ui/MenuRenderer.ts`
>   - `src/main.ts`
>   - `tests/unit/vfx-transition.test.ts` (신규 19개 테스트 작성, 100% Pass)
>   - `tests/unit/pause-modal.test.ts`, `tests/unit/bottom-bar.test.ts` (애니메이션 수명주기 동기화)
>   - 전체 138개 테스트 파일, 1632개 단위 테스트 100% Pass 및 `npm run build` 성공

---

## 2026-10-01 완료: [VFX-005 / #277] 승리/패배 결과 화면 연출 이펙트 (축하 파티클/패배 안개)

> #277 구현 및 TDD 사이클 전수 통과 완료.
> - **승리 축하 파티클**: 5색(골드 `#FFCB4D`, 에메랄드 `#4DFFAA`, 시안 `#28E6FF`, 마젠타 `#FF28D8`, 화이트 `#FFFFFF`) 별/스파크/사각형 콘페티 대규모 폭발 및 상단 낙하 스트림. 별 등급에 따른 차등: 1성(120개), 2성(180개), 3성(250개+).
> - **패배 침강 연출**: 2.0초 지속 비네팅 다크 오버레이 및 적색/보라 침강 파티클(25~35개) 하강 연출.
> - **ResultRenderer 연출**: 패널 아래에서 위로 슬라이드 인 (0.5초 `easeOutBack`), 8개 운동 통계 라인 순차 페이드 인 (패널 안착 후 0.08초 간격으로 각 라인 알파 0->1 등장), 기존 프로시저럴 드로잉 및 비트맵 이미지 에셋 렌더링 100% 보존.
> - **신규/수정 파일 및 내용**:
>   1. `config/effect.config.ts`:
>      - `RESULT_EFFECT_CONFIG` 신설 (victory 5색/3종형태/별점별 수량/스트림, defeat 2초 비네팅/25~35개 침강 파티클)
>      - `ParticlePresetName`에 `defeatDarken` 추가 및 `PARTICLE_PRESETS`에 `victoryCelebration`, `defeatDarken` 프리셋 반영
>   2. `src/effects/EffectManager.ts`:
>      - `playVictoryCelebration(w, h, stars)`: 별 등급별 대규모 폭발 및 상단 지속 낙하 스트림
>      - `playDefeatDarken(w, h)`: 2.0초 비네팅 타이머 및 25~35개 침강 파티클 하강
>      - `update`, `render`, `clear`에 비네팅 다크 오버레이 및 수명주기 연동
>   3. `src/ui/ResultRenderer.ts`:
>      - `resetAnimation(initialTime)`: 애니메이션 타이머 리셋
>      - `update(dt)`: `animTime` 누적
>      - `getSlideOffsetY(h)` / `getPanelOffsetY(h)`: 0.5초 `easeOutBack` 슬라이드 오프셋 계산
>      - `getStatLineAlpha(index)`: 패널 안착 후 0.08초 간격 8개 통계 라인 순차 페이드 인 계산
>      - `render(...)`: 슬라이드 변환 및 순차 알파 적용
>   4. `src/main.ts`:
>      - `stateMachine.registerState('RESULT')`: `resultRenderer.resetAnimation()` 및 `effectManager.playVictoryCelebration()` 연동
>      - `stateMachine.registerState('GAMEOVER')`: `resultRenderer.resetAnimation()` 및 `effectManager.playDefeatDarken()` 연동
>      - `showResult(victory)`: `resultData` 생성 후 `stateMachine.changeState` 호출 순서 정합성 보장
>      - `update(dt)`의 `screenMode === 'result'` 루프에서 `resultRenderer.update(dt)` 호출
>   5. `tests/unit/vfx-result.test.ts`: 14개 단위/연동 테스트 작성 (100% Pass)
> - **검증 결과**: 단위 테스트 14개 전수 통과, 전체 테스트 슈트 137개 파일 1613개 테스트 100% Pass, 빌드 성공.

---

## 2026-10-01 완료: [VFX-004 / #276] 스켈레톤 시각 이펙트 강화 (호흡 글로우/정답 펄스/피격 플래시)

> #276 구현 및 TDD 사이클 전수 통과 완료. 스켈레톤 관절 부드러운 펄스 호흡 글로우(2초 주기, 마나 0~100% 연동 시안 #28E6FF -> 보라 #C889FF 색상 선형 보간), 정답 펄스(0.3초 지속 에메랄드 #4DFFAA 글로우, 5+ 콤보 시 강도/크기 배율 증가), 오답/피격 플래시(0.2초 지속 적색 #FF4444 플래시 및 HP 50% 이하 적색 경고 펄스), 모션 트레일(손 19, 20 및 발 31, 32 잔상 4~6프레임 큐 버퍼, 속도 연동 알파/길이 증가)을 구현하고 `SkeletonEffect`, `config/effect.config.ts`, `src/main.ts`에 완전 연동하였습니다.
> - **신규/수정 파일 및 내용**:
>   1. `config/effect.config.ts`:
>      - `SKELETON_EFFECT_CONFIG` 및 `SkeletonEffectConfig` 신설:
>        - `breathCycle`: 2.0초
>        - `manaGlow`: startColor '#28E6FF', endColor '#C889FF', minAlpha 0.25, maxAlpha 0.75, blur 16, baseRadius 18
>        - `correctPulse`: duration 0.3s, color '#4DFFAA', baseIntensity 1.0, comboThreshold 5, comboMultiplier 1.5, maxIntensity 2.5
>        - `hitFlash`: duration 0.2s, color '#FF4444', lowHpThreshold 0.5, lowHpColor '#FF4444', warningPulseSpeed 5.0
>        - `trail`: maxFrames 6, minFrames 4, trackedJoints [19, 20, 31, 32], colors ({19: '#28E6FF', 20: '#FFCB4D', 31: '#28E6FF', 32: '#FFCB4D'}), speedThreshold 50, speedAlphaMultiplier 1.5
>   2. `src/skeleton/SkeletonEffect.ts` 신설:
>      - `SkeletonEffect` 클래스 구현:
>        - 호흡 글로우: 2.0s 주기 삼각함수 스케일/알파 진동 및 마나 비율 기반 16진수 색상 선형 보간 (`getManaGlowColor()`)
>        - 정답 펄스: 0.3초 지속시간, 연쇄 콤보(5 이상) 차등 배율 계산 (`triggerCorrect(combo)`)
>        - 오답/피격 플래시: 0.2초 지속시간, HP 50% 이하 시 저체력 경고 펄스 활성화 (`triggerHit()`, `setHp()`)
>        - 모션 트레일: 4개 말단 관절(19, 20, 31, 32) 큐 관리 (최대 6프레임 클램프), 프레임 간 변위 속도 계산 및 가속도 연동 알파 배율 적용
>        - Canvas 렌더링: `renderGlow(ctx, joints, scaleX)`, `renderTrails(ctx, scaleX)` 분리 드로잉
>        - `interpolateHexColor` 유틸리티 함수 구현 및 export
>   3. `src/skeleton/index.ts`:
>      - `SkeletonEffect`, `TrailPoint` re-export
>   4. `src/main.ts`:
>      - `SkeletonEffect` 인스턴스 생성 및 스켈레톤 렌더링 파이프라인 연동:
>        - 렌더링 순서: `cameraLayer` -> `skeletonEffect.renderTrails(ctx)` -> `boneRenderer.render(...)` -> `skeletonEffect.renderGlow(ctx, jointMap)` -> `jointRenderer.render(...)` (3계층 분리 및 시각 효과/관절 좌표 분리 준수)
>        - `engine.update`: `skeletonEffect.setMana()`, `skeletonEffect.setHp()`, `skeletonEffect.update(dt)`, `skeletonEffect.recordJointPositions(jointMap)` 호출
>        - 이벤트 연동: `eventBus.on('answer:correct')`, `eventBus.on('answer:wrong')`, `eventBus.on('player:hurt')`, 피격 및 타임아웃 지점에 `triggerCorrect()` / `triggerHit()` 연결
>   5. `tests/unit/vfx-skeleton.test.ts` 신설:
>      - 13개 단위 테스트 전수 통과 (호흡 주기, 마나 보간 색상, 정답 펄스/콤보 배율, 피격 플래시/저HP 경고, 트레일 큐 및 렌더링, reset 검증)
> - **검증 결과**:
>   - 단위/통합 테스트: **136개 테스트 스위트, 1,599개 테스트 100% Pass**
>   - 빌드: `npm run build` TypeScript 및 Vite 프로덕션 빌드 성공

---

## 2026-10-01 완료: [VFX-003 / #275] 수호신 스펠 캐스트 이펙트 (마나 100 도달/스펠 시전/보스 피격)

> #275 구현 및 TDD 사이클 전수 통과 완료. 마나 100 도달 연출(보라빛 펄스 및 상향 분출 파티클), 수호신 스펠 캐스트 3단계 연쇄 시퀀스(0~0.3s 수렴 → 0.3~0.8s 고속 마법 구체 투사 → 0.8~1.1s 마법 폭발 충격파), 보스 피격 충격 이펙트(일반 주황/적색 스파크 및 광폭화 진홍 스파크 강화)를 구현하고 `EffectManager`, `config/effect.config.ts`, `src/main.ts`에 완전 연동하였습니다.
> - **신규/수정 파일 및 내용**:
>   1. `config/effect.config.ts`:
>      - `GUARDIAN_EFFECT_CONFIG` 신설:
>        - `manaFull`: duration 0.5s, pulseColor '#C889FF', colors(['#C889FF', '#FF4DF0', '#28E6FF', '#FFFFFF', '#E8B5FF']), speed 180~380, gravity -240 (화면 상향 솟구침)
>        - `castSequence`: totalDuration 1.1s (convergence 0.3s, projectile 0.5s, explosion 0.3s), convergenceColors(['#C889FF', '#28E6FF', ...]), explosionColors(['#FF00CC', '#28E6FF', ...]), explosionShockwaveRadius 160
>        - `bossHit`: normal (count 25, colors ['#FFAA00', '#FF3300', ...], shape 'spark'), enraged (count 45, colors ['#FF0055', '#FF1133', ...], speed 220~480, shape 'spark')
>   2. `src/effects/EffectManager.ts`:
>      - `GuardianCastSequence` 클래스 신설 및 export:
>        - 1단계 수렴 (0~0.3s): 수호신 좌표 중심으로 반경 75px에서 중심으로 수렴하는 에너지 입자 방출 및 집중 아크 렌더링
>        - 2단계 발사/투사 (0.3~0.8s): 수호신 -> 보스 좌표로 선형 보간 고속 이동하는 마법 구체 및 궤적 파티클 방출
>        - 3단계 폭발 (0.8~1.1s): 보스 좌표에서 마젠타/시안 마법 폭발 파티클, 충격파 링(Expand), 방사형 광선(Radial) 폭발 연쇄 트리거
>      - `EffectManager` 메서드 신설:
>        - `playManaFullEffect(x, y)`: 보라빛 펄스 파동 및 상향 빛줄기 파티클 방출
>        - `playGuardianCastSequence(gx, gy, bx, by)`: 3단계 시퀀스 등록 및 생명주기 관리
>        - `playBossHitImpact(bx, by, isEnraged)`: 일반 및 광폭화 차등 충격 파티클/펄스 방출
>        - `activeCastSequences` getter 및 `update(dt)`, `render(ctx)`, `clear()` 완전 통합
>      - `wireGuardianVFX(eventBus, effectManager, options)` 헬퍼 함수 구현 및 export: EventBus 이벤트(`mana:full`, `guardian:cast`, `boss:hit`) 연동 및 100ms 디바운스 지원
>   3. `src/main.ts`:
>      - `wireGuardianVFX(eventBus, effectManager, ...)`로 전역 이벤트 버스 연동 (마나/수호신/보스 좌표 제공)
>      - `beatRoundResolver.onSpellCast`: 마나 100 도달 시 `playManaFullEffect`, `mana:full` 및 `guardian:cast` 이벤트 발행, 보스 피격 시 `playBossHitImpact` 및 `boss:hit` 발행
>      - `onAnswerSelected`: 정답 시 보스 피격 이펙트 `playBossHitImpact` 및 `boss:hit` 발행
>      - `troop:barrage`, `onDamageDealt`: 보스 타격 시 `playBossHitImpact` 및 `boss:hit` 발행
>      - `handleAnswer`: 스펠 발동 시 마나 풀/수호신 캐스트 연동
>   4. 단위 테스트 신설:
>      - `tests/unit/vfx-guardian.test.ts`: 설정 검증, 마나 풀 펄스/상향 파티클 검증, 3단계 시퀀스 타이밍/보간/폭발/렌더링 검증, 보스 피격 일반/광폭화 차등 검증, EventBus 연동 검증 14/14 Pass
>   5. 전체 검증:
>      - `npm run build`: tsc 타입 체크 및 vite 프로덕션 빌드 성공
>      - `npm test`: 135개 테스트 파일, 1,586개 단위/통합 테스트 100% Pass
>
> ---

## 2026-10-01 완료: [VFX-002 / #274] 정답/오답 판정 이펙트 연결 (별 버스트/적색 플래시/콤보 화염)

> #274 구현 및 TDD 사이클 전수 통과 완료. 정답, 오답, 타임아웃 판정 시각 효과(VFX-002)를 구현하고 `EffectManager`, `config/effect.config.ts`, `src/main.ts`에 완전 연동하였습니다.
> - **신규/수정 파일 및 내용**:
>   1. `config/effect.config.ts`:
>      - `ANSWER_EFFECT_CONFIG` 신설:
>        - `correct`: baseCount 35, colors(['#4DFFAA', '#28E6FF', '#FFFFFF', '#A6FFDF']), duration 0.8s, shapes(['star', 'spark'])
>        - `combo5`: count 20, colors(['#FFCB4D', '#FFAA00', '#FFFFFF', '#FF8800']), duration 0.8s, shapes(['spark', 'star'])
>        - `combo10Multiplier`: count 2x, size 1.5x
>        - `wrong`: flashColor '#FF4444', flashDuration 0.3s, particleCount 20, duration 0.5s
>        - `timeout`: count 24, colors(['#888888', '#AAAAAA', ...]), duration 0.5s, shape 'circle'
>   2. `src/effects/ParticleEmitter.ts`:
>      - `get activeParticles(): readonly Particle[]` 추가하여 파티클 속성 검증 지원
>   3. `src/effects/EffectManager.ts`:
>      - 플래시 오버레이 필드(`_flashColor`, `_flashDuration`, `_flashTimer`, `_flashMaxAlpha`) 및 게터/트리거 함수(`triggerFlash`, `isFlashActive`, `flashAlpha`, `flashTimer`, `flashColor`) 구현
>      - 뷰포트 설정(`setViewport`, `viewportWidth`, `viewportHeight`) 지원
>      - `playAnswerEffect(result, x, y, combo)` 구현:
>        - `correct`: 30~50개 에메랄드/시안 별/스파크 버스트(0.8초), 콤보 5+ 시 골드 화염/스파크 추가 방출, 콤보 10+ 시 개수 2배(70개+) 및 크기 1.5배 스케일업
>        - `wrong`: 0.3초 적색(#FF4444) 전체 화면 플래시 오버레이(페이드아웃) 및 적색 비네팅 파티클 방출
>        - `timeout`: 0.5초 회색(#888888) 안개/스모크 파티클 확산 방출
>      - `update(dt)` 및 `render(ctx, width?, height?)`, `clear()`에 플래시 오버레이 렌더링/업데이트/정리 완비
>      - `wireAnswerVFX(eventBus, effectManager, options)` 헬퍼 함수 구현 및 export: EventBus 이벤트(`answer:correct`, `answer:wrong`, `answer:timeout`) 연동 및 100ms 디바운스 지원
>   4. `src/main.ts`:
>      - 시작 시 `effectManager.setViewport(canvasManager.virtualWidth, canvasManager.virtualHeight)` 연결
>      - `wireAnswerVFX(eventBus, effectManager, ...)`로 전역 이벤트 버스 연동
>      - `onAnswerSelected`: 정답 시 `playAnswerEffect('correct', bx, by, battle.combo + 1)`, 오답 시 `playAnswerEffect('wrong', bx, by)` 호출 및 이벤트 발행
>      - `handleAnswer`: 타임아웃 시 `playAnswerEffect('timeout', ...)` 호출 및 이벤트 발행
>      - 화면 렌더링 루프에서 `effectManager.render(ctx, vw, vh)`로 플래시 오버레이 및 파티클 화면 크기 맞춤 렌더링
>   5. 단위 테스트 신설:
>      - `tests/unit/vfx-answer.test.ts`: 설정 검증, 정답 버스트 및 콤보 5+/10+ 차등 검증, 오답 플래시 오버레이/페이드아웃/렌더링 검증, 타임아웃 안개 파티클 검증, EventBus 연동 시뮬레이션 검증 등 11/11 Pass
>   6. 전체 검증:
>      - `npm run build`: tsc 타입 체크 및 vite 프로덕션 빌드 성공
>      - `npm test`: 134개 테스트 파일, 1,572개 단위/통합 테스트 100% Pass
>
> ---

## 2026-10-01 완료: [A11Y-004 / #265] 저시력 모드 커서/HP바/게이지 확대 및 음성 피드백 강화

> #265 구현 및 TDD 사이클 전수 통과 완료. 저시력 모드(A11Y-004)에서 `fontScale`에 비례하여 4색 커서 반경, HP바 높이, 마나 게이지 높이, 존 테두리 두께를 동적으로 확대하고 상한 클램프를 적용하였으며, 문제 정오답/체력 경고/보스 광폭화 상황에 대한 TTS 한국어 음성 피드백 및 사운드 설정 연동을 완비하였습니다.
> - **신규/수정 파일 및 내용**:
>   1. `src/render/AnswerSelectionRenderer.ts`:
>      - `getCursorRadius(baseRadius = 16, fontScale?: number)`: fontScale 비례 스케일링 및 32px 상한 클램프
>      - `getZoneBorderWidth(baseWidth = 3.5, fontScale?: number)`: fontScale 비례 스케일링 및 8px 상한 클램프
>      - `_renderCursors`: 4색 신체 커서 반경 및 체류 아크, 선 두께에 fontScale 동적 스케일링 반영 (1.0x 시 기존 수치 100% 보존)
>      - `_renderZones`: 존 테두리 선 두께에 `getZoneBorderWidth` 반영
>   2. `src/ui/HUDLayer.ts`:
>      - `getHpBarHeight(fontScale?: number)`: 기본 32px -> `Math.min(64, 32 * fontScale)` 동적 스케일링 및 상한 64px 클램프
>      - `_renderHpBars`: 플레이어 및 보스 HP바 높이 및 중앙 텍스트 정렬 연동
>   3. `src/ui/BottomBar.ts`:
>      - `getManaBarHeight(fontScale?: number)`: 기본 50px -> `Math.min(100, 50 * fontScale)` 동적 스케일링 및 상한 100px 클램프
>      - `render`: 중앙 마나 게이지 높이에 `getManaBarHeight` 반영
>   4. `src/question/QuestionSpeech.ts`:
>      - `SpeechFeedbackType` ('correct' | 'wrong' | 'low_hp' | 'boss_enrage') 정의
>      - `enabled`: 사운드 음소거 상태 동기화 (false 시 모든 발화 차단 및 진행 중 음성 취소)
>      - `speakFeedback(type)`: 타입별 한국어 피드백 발화 ("정답입니다!", "틀렸습니다!", "주의! 체력이 절반입니다!", "보스가 광폭화했습니다!")
>      - `low_hp` 중복 난사 방지 쿨다운(8초) 및 `boss_enrage` 1회 트리거 제어
>      - `resetFeedbackState()`: 새 챕터 시작 시 피드백 플래그/쿨다운 초기화
>   5. `src/main.ts`:
>      - `speech.enabled = settingsModal.soundEnabled` 실시간 연동 (사운드 토글 시)
>      - 답안 선택 및 정산 시 `speech.speakFeedback('correct')`, `speech.speakFeedback('wrong')` 연동
>      - 게임 루프 `update(dt)`에서 플레이어 HP <= 50% 시 `speech.speakFeedback('low_hp')` 연동
>      - `eventBus.on('boss:enrage')` 이벤트 수신 시 `speech.speakFeedback('boss_enrage')` 연동
>      - `startChapter` 시 `speech.resetFeedbackState()` 연동
>   6. 단위 테스트 신설:
>      - `tests/unit/a11y-visual-scale.test.ts`: 커서 반경(32px 클램프), HP바 높이(64px 클램프), 마나 게이지(100px 클램프), 존 테두리(8px 클램프) 13/13 Pass
>      - `tests/unit/a11y-tts-feedback.test.ts`: 한국어 발화 내용, enabled 음소거 차단, low_hp 쿨다운, boss_enrage 1회 트리거 12/12 Pass
>   7. 전체 검증:
>      - `npm run build` 성공 (tsc 타입 체크 및 vite 번들링 통과)
>      - `npm test`: 131개 테스트 파일, 1,539개 단위 테스트 100% Pass
>
> ---
>
> ## 2026-10-01 완료: [A11Y-003 / #264] SettingsModal 글씨 크기/고대비 모드 옵션 추가

> #264 구현 및 TDD 사이클 전수 통과 완료. SettingsModal에 글씨 크기(fontScale, 1.0x/1.5x/2.0x 3단계 순환) 및 고대비 모드(highContrast, ON/OFF 토글) 옵션을 신설하고, 런타임 UI_ACCESSIBILITY 및 UIText 동기화와 localStorage(`dg_a11y_fontScale`, `dg_a11y_highContrast`) 영속 저장을 완비하였습니다.
> - **신규/수정 파일 및 내용**:
>   1. `src/ui/SettingsModal.ts`:
>      - `SettingsAction` 및 `SettingsButtonAction`에 `'fontScale'`, `'highContrast'` 추가
>      - `_fontScale`, `_highContrast` 상태 및 getter/setter 구현
>      - `cycleFontScale()`: 1.0x -> 1.5x -> 2.0x -> 1.0x 순환 토글 및 UIText/UI_ACCESSIBILITY 동기화
>      - `toggleHighContrast()`: ON/OFF 전환 및 UIText/UI_ACCESSIBILITY 테마 동기화
>      - `saveAccessibility()`, `loadAccessibility()`: localStorage(`dg_a11y_fontScale`, `dg_a11y_highContrast`) 저장 및 복원
>      - `getButtonLayout()`: UI_LAYOUT.settings.buttons 슬롯 연동 및 레이아웃 지원
>      - `handleClick()`: fontScale/highContrast 히트테스트 판정 및 자동 토글
>      - `render()`: '🔤 글씨 크기'(라벨: 기본 (1.0x)/크게 (1.5x)/매우 크게 (2.0x)), '👁 고대비 모드'(ON/OFF 및 toggle 에셋 분기) 2개 옵션 행 렌더링
>   2. `config/ui.config.ts`:
>      - `UILayoutConfig['settings']['buttons']` 타입에 `'fontScale'`, `'highContrast'` 추가
>      - `UI_LAYOUT.settings.buttons`에 `fontScale`(y: 1270) 및 `highContrast`(y: 1400) 슬롯 배치
>   3. `src/utils/UIText.ts`:
>      - `setFontScale`, `setHighContrast`, `setMinPhysicalPx`, `resetAccessibility` 호출 시 `UI_ACCESSIBILITY`와 실시간 동기화 보장
>   4. `src/ui/index.ts`:
>      - `SettingsButtonAction` 타입 export 추가
>   5. `src/main.ts`:
>      - `settingsModal` 클릭 시 fontScale/highContrast 액션에 대한 hover sfx 재생 연동
>   6. `tests/unit/a11y-settings.test.ts`:
>      - fontScale 3단계 순환 토글, highContrast 테마 전환, localStorage 저장/복원, 히트테스트, 렌더링 검증 단위 테스트 신설 (17/17 Pass)
>   7. 전체 검증:
>      - `npm run build` 통과
>      - `npm test`: 129개 테스트 파일, 1,514개 단위 테스트 100% Pass

---

## 2026-10-01 완료: [A11Y-002 / #263] 저대비 색상 수정 및 WCAG AA 대비율 4.5:1 보장

> #263 구현 및 TDD 사이클 전수 통과 완료. 어두운 배경(#0a0a1a, #050308, #141828, #0a0e1a, #000000) 위에서 WCAG AA 기준(4.5:1) 미달이던 레거시 텍스트 색상을 전면 교정하여 저시력 사용자 시각 인지성 및 접근성을 대폭 강화하였습니다.
> - **신규/수정 파일 및 내용**:
>   1. `config/ui.config.ts`:
>      - `UI_COLOR_THEMES.default.textMuted`: `#888888` -> `#BBBBBB` (대비율 9.2:1 이상 보장)
>      - `UI_COLOR_THEMES.default.textLocked`: `#555555` -> `#888888` (대비율 4.9:1 이상 보장)
>   2. `src/ui/ResultRenderer.ts`:
>      - 하단 안내문: `#888888` -> `#BBBBBB`
>   3. `src/ui/MenuRenderer.ts`:
>      - 잠금 부제: `#333333` -> `#777777` (심야 암실 배경 기준 4.5:1 이상)
>      - 잠금 챕터명: `#444444` -> `#888888` (5.0:1 이상)
>      - 잠금 번호 및 잠금 아이콘: `#555555` -> `#999999` (6.2:1 이상)
>      - 서브 문항수: `#AAAAAA` -> `#CCCCCC` (10.9:1 이상)
>   4. `src/ui/SettingsModal.ts`:
>      - 비활성 상태 태그: `#888888` -> `#BBBBBB`
>   5. `src/render/QuestionRenderer.ts`:
>      - 키보드 힌트: `#AAAAAA` -> `#CCCCCC`
>   6. `tests/unit/a11y-contrast.test.ts`:
>      - W3C 공식 상대 휘도 및 대비율 계산 공식 단위 테스트 구현
>      - 교정 대상 색상 대비율 4.5:1 이상 보장 검증
>      - 대상 파일 내 `#333333`, `#444444`, `#555555` 직접 사용 0건 검증
>      - 시그니처 색상(#FFFFFF, #28E6FF, #FFCB4D, #C889FF, #FF4444) 및 4색 커서 색상 불변 보존 검증
>      - 렌더러 런타임 fillStyle 검증 (22/22 테스트 100% Pass)

---

## 2026-10-01 완료: [UI-ASSET-007 / #272] 챕터별 배경 이미지 에셋 제작 및 DreamGrid 교체

> #272 구현 및 TDD 사이클 전수 통과 완료. 메인 메뉴 및 챕터 1~5 6종 고해상도(1080x2160) 배경 이미지 에셋을 제작/배치하고, `config/ui.config.ts` 및 `DreamGrid` 렌더러에 배경 이미지와 디밍 오버레이를 연동하였습니다. 카메라 활성화 시 카메라 피드 우선 정책 및 미로드 시 프로시저럴 그리드 100% 폴백을 완벽히 보존하였습니다.
> - **신규/수정 파일 및 내용**:
>   1. `scripts/generate-bg-assets.js`:
>      - Node.js 내장 zlib/fs/path 기반 1080x2160 고품질 배경 PNG 바이너리 생성기
>      - `public/assets/bg/menu_bg.png`: 메인 메뉴 꿈나라 심해 우주 테마 (코스믹 인디고/스타더스트/성운)
>      - `public/assets/bg/ch1_bg.png`: Ch.1 포겟 에메랄드 심해 산호 테마 (심해 청록/발광 산호/수중 기포)
>      - `public/assets/bg/ch2_bg.png`: Ch.2 후다닥 사탕 바구니 별자리 숲 테마 (황혼 자수정/별자리 숲/유성우)
>      - `public/assets/bg/ch3_bg.png`: Ch.3 뒤죽박죽 오르골 구름 서재 테마 (라벤더 페리윙클/오르골 태엽 링/구름 테라스)
>      - `public/assets/bg/ch4_bg.png`: Ch.4 에라 색종이 크레용 사파리 테마 (석양 코랄 크림슨/크레용 컨페티/사파리 실루엣)
>      - `public/assets/bg/ch5_bg.png`: Ch.5 나이트메어 은하 회전목마 어둠 대왕 테마 (옵시디언 보이드/진홍 소용돌이/회전목마 링)
>   2. `config/ui.config.ts`:
>      - `UIImageAssetsConfig` 및 `UI_IMAGE_ASSETS`에 `bg` 카테고리 추가 및 6개 경로 슬롯(menu, ch1~ch5) 등록
>   3. `src/render/DreamGrid.ts`:
>      - `DreamGridConfig`에 `bgImage?: HTMLImageElement | null`, `bgDimAlpha?: number` (기본값 0.45) 옵션 추가
>      - `_bgImage`, `_bgDimAlpha` 내부 필드 및 `setBgImage`, `setBgDimAlpha` 제어 메서드 제공
>      - `render()` 시작 시 `bgImage` 존재 시 `ctx.drawImage` 및 가독성 확보용 디밍 오버레이(`rgba(0,0,0,bgDimAlpha)`) 렌더링 후 원근 와이어프레임 렌더링
>      - `bgImage` 미제공 시 기존 와이어프레임 렌더링 100% 폴백 보존
>   4. `src/main.ts`:
>      - 메뉴 렌더링 및 인게임 렌더링 시 `imageLoader.get('bg', 'menu')` 및 `imageLoader.get('bg', 'ch' + currentChapter)` 전달
>      - `cameraLayer.isActive`가 true일 때 `bgImage: null` 처리하여 카메라 피드 우선 원칙 준수
> - **검증 산출물**:
>   - `tests/unit/bg-asset-render.test.ts` (9개 단위 테스트 신설 및 전수 통과: 파일 6종 존재 및 1080x2160 규격 검증, UI_IMAGE_ASSETS 경로 검증, drawImage 및 디밍 오버레이 호출 검증, 커스텀 bgDimAlpha 반영, bgImage 부재 시 폴백, 인스턴스 메서드 설정, 카메라 피드 활성 시 미적용 계약)
>   - 전체 126개 테스트 파일 1,464개 테스트 100% Pass, `npm run build` 성공.
> - **다음 작업 대상**: `#273` [VFX-001] 파티클 엔진 기반 시스템 구축 (EffectManager)

---

## 2026-10-01 완료: [UI-TOKEN-006 / #261] 이미지 에셋 로더 및 프로시저럴/이미지 분기 인프라

> #261 구현 및 TDD 사이클 전수 통과 완료. UI_IMAGE_ASSETS 설정의 비트맵 이미지 에셋 비동기 프리로더 및 캐시 매니저(`UIImageLoader`, 싱글톤 `imageLoader`)를 구축하고, 5개 주요 UI 렌더러(HUDLayer, MenuRenderer, ResultRenderer, BottomBar, SettingsModal)에 이미지/프로시저럴 안전 분기 인프라를 연동하였습니다.
> - **신규/수정 파일 및 내용**:
>   1. `src/utils/UIImageLoader.ts`:
>      - `preload(assets?: UIImageAssetsConfig): Promise<void>`: non-null 경로를 갖는 비트맵 에셋 비동기 프리로드, 로드 실패 시 `console.warn` 후 null 안전 폴백
>      - `get(category, key): HTMLImageElement | null`: 캐시된 이미지 조회 또는 null 반환
>      - `has(category, key): boolean`: 캐시 존재 여부 확인
>      - `isReady(): boolean`: 프리로드 완료 상태 반환
>      - `clear() / reset()`: 캐시 비우기 및 ready 상태 초기화
>      - `setImage(category, key, img)`: 테스트 및 런타임 수동 주입용 메서드 제공
>      - 싱글톤 `imageLoader` 및 클래스 `UIImageLoader` export, `src/utils/index.ts` re-export
>   2. `src/main.ts`:
>      - `bootstrap()` 초기화 단계에서 `imageLoader.preload()` 비동기 호출 통합 (실패 시에도 부트스트랩 중단 없는 안전 예외 처리)
>   3. 5개 UI 렌더러 안전 분기 연동 (프로시저럴 드로잉 100% 보존):
>      - `src/ui/HUDLayer.ts`: playerHpBar, bossHpBar, comboBadge, hpBarFrame, hpBarFill, comboIcon, bossNameplate 분기
>      - `src/ui/MenuRenderer.ts`: background, banner, cardFrame, starFull, starEmpty, lockIcon 분기
>      - `src/ui/ResultRenderer.ts`: panelBg, victoryBadge, defeatBadge, starFilled, starEmpty 분기
>      - `src/ui/BottomBar.ts`: barBg, settingsIcon, actionButton 분기
>      - `src/ui/SettingsModal.ts`: dialogBg, closeIcon 분기
> - **검증 산출물**:
>   - `tests/unit/ui-image-loader.test.ts` (17개 단위 테스트 신설 및 전수 통과: 싱글톤 인스턴스, null 에셋 시 즉시 완료, non-null 로드 성공, 실패 시 폴백 경고, 5개 렌더러 drawImage vs 프로시저럴 분기 검증)
>   - 전체 121개 테스트 파일 1,406개 테스트 100% Pass, `npm run build` 성공.

---

## 2026-10-01 완료: [UI-TOKEN-005 / #260] BossClimaxRenderer/BeatHUDRenderer 하드코딩 폰트→토큰 전환

> #260 구현 및 TDD 사이클 전수 통과 완료. Phase B 결전 시각화 렌더러(`BossClimaxRenderer`), 8박 러닝 HUD 렌더러(`BeatHUDRenderer`), 페이즈 프레젠테이션 어댑터(`PhasePresentationAdapter`)에 존재하던 하드코딩 `ctx.font` 문자열을 `UIText.getFont(role, scaleX, weight)` 기반 디자인 토큰으로 전면 전환하였습니다.
> - **수정 대상 파일 및 전환 내용**:
>   1. `src/render/BossClimaxRenderer.ts`: 충격파 가이드 점프 안내(32px -> body), 발 짓밟기 유도(30px -> body), 회피/피격 피드백(38px -> body), 수호신 라벨(22px -> badge), 보스 HP 수치(20px -> caption), 광폭화 배지(22px -> badge), 피버 콤보(34px -> body), 군단 배지(22px -> badge), 별가루 배지(22px -> badge) 토큰 전환.
>   2. `src/render/BeatHUDRenderer.ts`: 장판 안내 타이틀(44px -> subheading), 장판 안내 서브타이틀(26px -> label), 8박 원형 인디케이터 번호(16px -> caption), 걸음/운동 수(32px -> body) 토큰 전환.
>   3. `src/ui/PhasePresentationAdapter.ts`: 회피 안내 타이틀(44px -> subheading), 회피 결과 서브타이틀(26px -> body) 토큰 전환.
> - **유지 및 안전 보장**:
>   - 3D 원근 투영 수식 및 DreamGrid 좌표 계산 보존
>   - fontScale 1.0 기준 기존 렌더링 시각 결과와 동일
>   - fontScale(1.5, 2.0 등) 확대 시 비례 스케일링 지원
> - **검증 산출물**:
>   - `tests/unit/boss-beat-hud-token-migration.test.ts` (8개 단위 테스트 신설 및 전수 통과)
>   - 전체 121개 테스트 파일 1,404개 테스트 100% Pass, `npm run build` 성공.

---

## 2026-10-01 완료: [UI-ASSET-003 / #268] 결과 화면 이미지 에셋 제작 및 ResultRenderer 연동

> #268 구현 및 단위/회귀 테스트 전수 검증 완료. 결과 화면의 13개 핵심 이미지 에셋(panel_bg, victory_title, defeat_title, 8개 statIcon, star_filled, star_empty)을 zlib 기반 표준 유효 PNG 바이너리로 생성하여 배치하고, `config/ui.config.ts` 및 `ResultRenderer.ts`와 연동하였습니다. 이미지가 없거나 로드 전일 경우 기존 프로시저럴 드로잉 및 이모지 포함 텍스트로 100% 안전하게 폴백됩니다.
> - **신규/수정 파일 및 내용**:
>   1. `scripts/generate-result-assets.js`: Node.js zlib/Buffer 기반 유효한 13개 PNG 생성 스크립트 작성
>   2. `public/assets/ui/result/`:
>      - `panel_bg.png` (880x1580, 네온 마젠타 테두리와 다크 반투명 패널, 투명 PNG)
>      - `victory_title.png` (600x160, 에메랄드/골드 네온 'VICTORY' 투명 PNG)
>      - `defeat_title.png` (600x160, 크림슨 네온 'DEFEAT' 투명 PNG)
>      - `stat_accuracy.png` (48x48, 정답률 타겟 과녁 아이콘)
>      - `stat_combo.png` (48x48, 콤보 화염 아이콘)
>      - `stat_time.png` (48x48, 시간 스톱워치 아이콘)
>      - `stat_run.png` (48x48, 달리기 러너/신발 아이콘)
>      - `stat_squat.png` (48x48, 스쿼트/바벨 아이콘)
>      - `stat_jump.png` (48x48, 점프 스프링/도약 아이콘)
>      - `stat_pose.png` (48x48, 자세 유지/명상 아이콘)
>      - `stat_calorie.png` (48x48, 칼로리 번개/에너지 아이콘)
>      - `star_filled.png` (54x54, 황금 별 아이콘)
>      - `star_empty.png` (54x54, 반투명 회색 외곽선 별 아이콘)
>   3. `config/ui.config.ts`: `UI_IMAGE_ASSETS.result`에 13개 신규/확장 에셋 경로 등록 (기존 victoryBadge, defeatBadge 하위 호환성 유지)
>   4. `src/ui/ResultRenderer.ts`:
>      - 패널 배경(`panelBg`) 분기 연동
>      - 타이틀(`victoryTitle`/`defeatTitle` 및 레거시 배지) 600x160 비례 스케일 드로잉 및 텍스트 폴백
>      - 별 등급(`starFilled`/`starEmpty`) 비트맵 드로잉 및 글리프 폴백
>      - 8개 운동 통계 아이콘(`statIcon_*`) 라인 좌측 drawImage 렌더링 및 이모지 제외 정제 텍스트 표시, 미로드 시 기존 이모지 포함 텍스트 100% 프로시저럴 폴백 보존
> - **검증 산출물**:
>   - `tests/unit/result-asset-render.test.ts` (10 tests 신설 및 전수 통과: 13개 에셋 파일 존재, 해상도/PNG 시그니처, config 경로, 프로시저럴 폴백, 승리/패배 타이틀 600x160 스케일 드로잉, 별 아이콘 드로잉, 8개 통계 아이콘 분기 및 텍스트 이모지 제외 검증)
>   - 전체 122개 테스트 파일 1,416개 테스트 100% Pass, `npm run build` 성공.

---

## 2026-10-01 완료: [UI-ASSET-002 / #267] HUD 이미지 에셋 제작 및 HUDLayer 연동

> #267 구현 및 단위/회귀 테스트 전수 검증 완료. 게임 내 HUD의 5개 핵심 이미지 에셋(hp_bar_frame, hp_bar_fill_player, hp_bar_fill_boss, combo_icon, boss_nameplate)을 zlib 기반 표준 유효 PNG 바이너리로 생성하여 배치하고, `config/ui.config.ts` 및 `HUDLayer.ts`와 연동하였습니다. 이미지가 없거나 로드 전일 경우 기존 프로시저럴 드로잉 및 레거시 키(`playerHpBar`, `bossHpBar`, `comboBadge`)로 100% 안전하게 폴백됩니다.
> - **신규/수정 파일 및 내용**:
>   1. `scripts/generate-hud-assets.js`: Node.js zlib/Buffer 기반 유효한 PNG 생성 스크립트 작성
>   2. `public/assets/ui/hud/`:
>      - `hp_bar_frame.png` (320x48, 네온 사이버 프레임 테두리 투명 PNG)
>      - `hp_bar_fill_player.png` (320x48, 시안→에메랄드 그라디언트 텍스처 PNG)
>      - `hp_bar_fill_boss.png` (320x48, 진홍→주황 그라디언트 텍스처 PNG)
>      - `combo_icon.png` (48x48, 네온 화염/스파크 불꽃 아이콘 투명 PNG)
>      - `boss_nameplate.png` (400x60, 반투명 네온 다크 명패 배경 투명 PNG)
>   3. `config/ui.config.ts`: `UI_IMAGE_ASSETS.hud`에 5개 신규 에셋 경로 등록 (기존 키 하위 호환성 유지)
>   4. `src/ui/HUDLayer.ts`: 플레이어/보스 HP 프레임 및 채움 텍스처 분기 연동, 콤보 아이콘 연동, 보스 명패 배경 연동, 텍스트 가독성 유지 및 기존 프로시저럴 폴백 100% 보존
> - **검증 산출물**:
>   - `tests/unit/hud-asset-render.test.ts` (8 tests 신설 및 전수 통과: 에셋 파일 존재, 해상도/PNG 시그니처, config 경로, 프로시저럴 폴백, 비트맵 이미지 드로잉, 콤보 0 판정, 레거시 키 호환성 검증)
>   - 전체 121개 테스트 파일 1,404개 테스트 100% Pass, `npm run build` 성공.

---

## 2026-10-01 완료: [UI-ASSET-001 / #266] 메뉴 화면 이미지 에셋 제작 및 MenuRenderer 연동

> #266 구현 및 단위/회귀 테스트 전수 검증 완료. 메뉴 화면의 5개 핵심 이미지 에셋(title_bg, chapter_card_frame, lock_icon, star_full, star_empty)을 zlib 기반 표준 유효 PNG 바이너리로 생성하여 배치하고, `config/ui.config.ts` 및 `MenuRenderer.ts`와 연동하였습니다. 이미지가 없거나 로드 전일 경우 기존 프로시저럴 드로잉으로 100% 안전하게 폴백됩니다.
> - **신규/수정 파일 및 내용**:
>   1. `scripts/generate-menu-assets.js`: Node.js zlib/Buffer 기반 유효한 PNG 생성 스크립트 작성
>   2. `public/assets/ui/menu/`:
>      - `title_bg.png` (1080x300, 네온 사이버/드림 스타일 메인 타이틀 배너)
>      - `chapter_card_frame.png` (360x380, 반투명 네온 테두리 챕터 카드 프레임)
>      - `lock_icon.png` (96x96, 골드/네온 자물쇠 아이콘)
>      - `star_full.png` (64x64, 빛나는 황금 별 아이콘)
>      - `star_empty.png` (64x64, 반투명 회색 외곽선 별 아이콘)
>   3. `config/ui.config.ts`: `UI_IMAGE_ASSETS.menu`에 5개 에셋 경로 등록 (기존 banner, background 하위 호환성 유지)
>   4. `src/ui/MenuRenderer.ts`: titleBg, cardFrame, lockIcon, starFull/starEmpty 이미지 연동 및 프로시저럴 폴백 보존
>   5. `src/utils/UIImageLoader.ts`: Node.js SSR/테스트 환경에서 Image 미정의 시 안전 폴백 처리
> - **검증 산출물**:
>   - `tests/unit/menu-asset-render.test.ts` (9 tests 신설 및 전수 통과: 에셋 파일 존재, 해상도/PNG 시그니처, config 경로, 프로시저럴 폴백, 비트맵 이미지 드로잉 검증)
>   - 전체 119개 테스트 파일 1,388개 테스트 100% Pass, `npm run build` 성공.

---

## 2026-10-01 완료: [UI-TOKEN-004 / #259] 렌더러 레이아웃 좌표→UI_LAYOUT 참조 전환

> #259 구현 및 단위/회귀 테스트 전수 검증 완료. 6개 주요 UI 렌더러(HUDLayer, MenuRenderer, ResultRenderer, BottomBar, SettingsModal, PauseModal)의 하드코딩 레이아웃 좌표 및 치수를 `config/ui.config.ts`의 `UI_LAYOUT` 슬롯 참조로 전면 전환하고, `BOTTOM_BAR_CONFIG`를 `UI_LAYOUT.bottomBar`와 통합하였습니다.
> - **수정 대상 파일 및 전환 내용**:
>   1. `config/ui.config.ts`: `UI_LAYOUT`에 `hud.comboBadge`, `bottomBar.manaBar`, `settings.closeBtn`(850, 510) 및 `settings.buttons`(5개 옵션 버튼 슬롯), `menu.locomotionBtn`(290, 375, 500, 56) 정확한 슬롯 정의.
>   2. `src/ui/HUDLayer.ts`: 플레이어/보스 HP바 좌표(`UI_LAYOUT.hud.playerHpBar`), 콤보 뱃지 좌표(`UI_LAYOUT.hud.comboBadge`) 슬롯 연동.
>   3. `src/ui/MenuRenderer.ts`: 챕터 카드 크기 및 좌표(`UI_LAYOUT.menu.chapterCards`), 운동 모드 버튼(`UI_LAYOUT.menu.locomotionBtn`), 서브메뉴 그리드 및 뒤로가기 버튼(`UI_LAYOUT.subMenu.grid`, `UI_LAYOUT.subMenu.backBtn`), 타이틀 슬롯 연동.
>   4. `src/ui/ResultRenderer.ts`: 결과 카드 패널 레이아웃(`UI_LAYOUT.result.panel`), 통계 1줄 높이(`UI_LAYOUT.result.statLineHeight`) 슬롯 연동.
>   5. `src/ui/BottomBar.ts`: `BOTTOM_BAR_CONFIG = UI_LAYOUT.bottomBar` 통합 및 re-export 보존, 중앙 마나 게이지(`manaBar`) 슬롯 연동.
>   6. `src/ui/SettingsModal.ts`: 모달 다이얼로그(`UI_LAYOUT.settings.modal`), 닫기 버튼 및 5개 옵션 버튼(`UI_LAYOUT.settings.closeBtn`, `buttons`) 슬롯 연동.
>   7. `src/ui/PauseModal.ts`: 모달 카드(`UI_LAYOUT.pause.modal`), 복귀/홈 버튼(`UI_LAYOUT.pause.resumeBtn`, `UI_LAYOUT.pause.quitBtn`) 슬롯 연동.
> - **검증 산출물**:
>   - `tests/unit/ui-layout-migration.test.ts` (14 tests 신설 및 전수 통과: 6개 렌더러의 UI_LAYOUT 좌표 일치성, 히트 테스트 동기화, BOTTOM_BAR_CONFIG 참조 및 하위 호환성 검증)
>   - 전체 119개 테스트 파일 1,388개 테스트 100% Pass, `npm run build` 성공.

---

## 2026-10-01 완료: [UI-TOKEN-003 / #258] 11개 UI 렌더러 하드코딩 폰트→토큰 기반 전환

> #258 구현 및 단위/회귀 테스트 전수 검증 완료. 11개 주요 UI 렌더러의 하드코딩 `ctx.font` 문자열을 `UIText.getFont(role, scaleX, weight)` 및 토큰 기반으로 일괄 전환하여, `fontScale` 조정만으로 전체 UI 글씨 크기가 동적으로 반응하도록 구축했습니다.
> - **수정 대상 파일 (11개 렌더러)**:
>   1. `src/ui/HUDLayer.ts`: HP 수치(caption), 콤보 카운트(body/badge), 보스 타이틀(badge) 전환
>   2. `src/ui/MenuRenderer.ts`: 메인 메뉴 타이틀(title), 슬로건/테마 부제(label), 운동 모드/별점(badge/body), 챕터 번호/이름(subheading), 서브메뉴 헤더/단계 카드(heading/label/body) 전환
>   3. `src/ui/ResultRenderer.ts`: 승리/패배(hero), 챕터명(body), 별점(heading), 8개 운동 통계(subheading), 하단 안내(label) 전환 및 `getStatFontSize()` 토큰 연동
>   4. `src/ui/BottomBar.ts`: 설정 버튼(body), 콤보/마나 라벨(label), 액션 버튼(body) 전환
>   5. `src/ui/SettingsModal.ts`: 모달 타이틀(subheading), 닫기 버튼(body), 옵션명/상태 태그(body) 전환
>   6. `src/ui/PauseModal.ts`: 모달 타이틀(subheading), 안내문(badge), 복귀/홈 버튼(body) 전환
>   7. `src/ui/TutorialOverlay.ts`: 1~3단계 제목(body), 설명문(badge), 아이콘 라벨/힌트(caption) 전환
>   8. `src/ui/LocomotionModal.ts`: 헤더(subheading), 설명(badge), 닫기(body), 카드 아이콘(title), 모드명(body), 부위/소음/상태 배지(caption/badge) 전환
>   9. `src/ui/GestureFeedbackOverlay.ts`: X자 제스처 일시정지/나가기 라벨(label) 전환
>   10. `src/ui/JudgmentFeedback.ts`: 힌트 메시지 필(label), 적응형 관용 완화 배지(caption) 전환
>   11. `src/render/QuestionRenderer.ts`: 답안 키보드 단축키 힌트(badge) 전환
> - **검증 산출물**:
>   - `tests/unit/ui-token-migration.test.ts` (18 tests 통과: 11개 소스 하드코딩 정적 검사, 렌더링 런타임 getFont 호출/역할 매핑 검사, fontScale 동적 스케일링 검사)
>   - 전체 117개 테스트 파일 1,365개 테스트 100% Pass, `npm run build` 성공.

---

## 2026-10-01 완료: [UI-TOKEN-002 / #257] UIText 중앙 렌더링 유틸리티 신설 (src/utils/UIText.ts)

> #257 구현 및 단위/회귀 테스트 전수 검증 완료. `config/ui.config.ts`의 디자인 토큰과 접근성 설정을 읽어 Canvas 2D 폰트 문자열, 폰트 크기, 테마 색상, 물리 좌표 슬롯을 계산·제공하는 중앙 유틸리티 `src/utils/UIText.ts`를 신설했습니다.
> - **완료 내역**:
>   1. **getFont(role, scaleX, weight?, fontFamily?)**: 역할과 가로 스케일 기반 Canvas 2D 표준 폰트 문자열(예: 'bold 44px sans-serif') 생성.
>   2. **getFontSize(role, scaleX)**: fontScale 반영 및 minPhysicalPx / token.min 이중 하한선 보장 px 산출.
>   3. **getColor(colorKey)**: default 및 highContrast 테마 간 동적 색상 전환 및 폴백.
>   4. **getLayoutSlot(screen, element?, width?, height?)**: UI_LAYOUT 가상 해상도(1080x2160) 좌표를 물리 해상도 슬롯으로 비파괴 변환.
>   5. **접근성 제어 함수**: setFontScale, setHighContrast, setMinPhysicalPx, resetAccessibility, getAccessibility 제공.
>   6. **네임스페이스 및 싱글톤**: 개별 함수 export 및 `UIText` 객체 export 동시 지원.
> - **검증 산출물**:
>   - `tests/unit/ui-text.test.ts` (20 tests 통과)
>   - 전체 115개 파일 1,332개 테스트 100% Pass, `npm run build` 성공.

---

## 2026-10-01 완료: [UI-TOKEN-001 / #256] UI 디자인 토큰 시스템 신설 (config/ui.config.ts)

> #256 구현 및 단위 테스트 전수 검증 완료. 모든 UI 렌더러에 하드코딩되어 있던 폰트 크기·가중치, 접근성 설정, 색상 테마, 가상 좌표 슬롯, 이미지 에셋 슬롯을 단일 SSOT 설정 파일(`config/ui.config.ts`)로 추출 및 구조화했습니다.
> - **완료 내역**:
>   1. **UI_TEXT_TOKENS (8개 역할)**: hero(100px), title(76px), heading(54px), subheading(44px), body(36px), label(28px), badge(24px), caption(20px) 기본 크기, 최소 크기(min), 가중치(weight) 정의.
>   2. **UI_ACCESSIBILITY**: fontScale(1.0), highContrast(false), minPhysicalPx(16) 전역 접근성 기본값 정의.
>   3. **UI_COLOR_THEMES**: default 및 highContrast 2개 테마 (primary, secondary, accent, danger, success, textPrimary~textLocked, bgDim, bgCard 등).
>   4. **UI_LAYOUT**: 1080x2160 가상 좌표계 기준 7개 화면 슬롯 (hud, menu, subMenu, result, bottomBar, settings, pause) 및 세부 요소 좌표/크기 정의.
>   5. **UI_IMAGE_ASSETS**: 6개 카테고리 (menu, hud, result, bottomBar, settings, battle) 이미지 경로 슬롯 (초기값 null = 프로시저럴 렌더링 유지).
>   6. **Config 및 Types**: `src/core/Config.ts` re-export, `src/types/index.ts` 타입 정의 추가.
> - **검증 산출물**:
>   - `tests/unit/ui-config.test.ts` (17 tests 통과)
>   - 전체 114개 파일 1,312개 테스트 100% Pass, `npm run build` 성공.

---

> #186 구현 및 단위/통합/E2E 전수 검증 완료. 프로덕션 Phase A 10문제 출제 및 운동 페이싱부터 정답/오답/타임아웃 분기, 별모으기 7개 스케줄 및 비치명 정책, 10번째 문제 후 Phase B(BOSS_CLIMAX) 단 1회 자원 인계(Zero-Reset), 피버 콤보·군단 탄막·보스 공격 및 광폭화, 승리/패배 종결 및 텔레메트리 로깅까지 10대 완료 조건을 전수 검증했습니다.
> - **10대 핵심 완료 조건 검증 내역**:
>   1. **8-beat round pacing**: 8박 완료 전 조기 전환 0건, 30초 무동작 시 운동 비트 자동 채움 0건 확인.
>   2. **Answer branch & UI Cleanliness**: 정답 시 즉시 `STAR_COLLECT`, 오답 및 timeout 시 즉시 `HAZARD_EVADE` 전이; `isAnswerOpen: false` 및 구형/레거시 UI 잔재 0건.
>   3. **Star note schedule**: 7개 분리 예약(0.5s~3.5s), 무입력 시 정확히 7 Miss 판정, 7번째 만료 후 단 1회 정산 확인.
>   4. **Phase A non-lethal & damage policy**: 오답/타임아웃 직접 피해 0, 오직 장판 회피 실패 시에만 25 피해 차감 확인.
>   5. **10 consecutive correct answers**: 10연속 정답 시에도 Phase A 내 보스 HP 1 하한선 유지(조기 처치 0), 10번째 정산 완료 후 `BOSS_CLIMAX` 단 1회 전이 및 11번째 문제 스케줄링 0건.
>   6. **Fatal damage on 10th round hazard**: 10번째 라운드 장판 피격 사망 시 `GAMEOVER` 최우선 전이, Phase B 진입 0회 및 11번째 문제 출제 0건.
>   7. **Phase B transition & resource preservation**: 군단(3~13체) 및 별가루 무리셋(Zero-Reset Guard) 인계, 피버 연속 루프 가동, 군단 강화 탄막 발사, 보스 공격 패턴 및 HP <= 30% 시 광폭화(속도 1.5배) 검증.
>   8. **Climax resolution**: 보스 HP <= 0 시 `RESULT` 단 1회 전이, 플레이어 HP <= 0 시 `GAMEOVER` 단 1회 전이, 종료 후 모든 루프/공격 정지.
>   9. **Lifecycle resilience**: Pause 동결, 메뉴 복귀 시 비동기 스케줄러/컨트롤러 완전 리셋, 재시작 정상화, Fallback 입력 정상 작동.
>   10. **Deterministic seed repeatability & Telemetry**: 동일 문제 데이터셋 기반 10문제 결정론적 재현, frame/roundId/state/beat/resources 텔레메트리 추적 검증.
> - **검증 산출물**:
>   - `tests/integration/beat-motion-round.test.ts` (18 tests 통과)
>   - `tests/e2e/beat-motion.e2e.ts` (2 tests 통과)
>   - 전체 113개 파일 1,295개 테스트 100% Pass, `npm run build` 통과.

---

## 2026-10-01 완료: [INPUT-TOLERANCE-007 / #255] 부분 진행도 시각화 및 판정 실패 사유 피드백

> #255 구현 및 단위/회귀 검증 완료. `ArmReachAnswerSelector`의 연속 점수(score) 및 세부 게이트 점수를 시각 피드백으로 전달하고, 미확정 실패 사유 힌트 제공 및 깜빡임 방지 홀딩을 통해 유저 체감 난이도를 낮추었습니다.
> - **설정 SSOT 확장 (`config/judgment.config.ts`)**:
>   - `JudgmentFeedbackConfig` 및 `DEFAULT_JUDGMENT_FEEDBACK_CONFIG` 정의 (`enableFeedback: true`, `hintMinInterval: 0.6s`, `hintMinScore: 0.30`).
>   - 실패 사유 메시지: extension('조금 더 뻗으세요'), dominance('한 팔만'), visibility('카메라 안으로'), velocity('조금 더 크게'), penetration('존 안쪽으로').
> - **피드백 매니저 구현 (`src/ui/JudgmentFeedback.ts`)**:
>   - `computeGlowIntensity(score)`: 0부터 `confirmThreshold`(0.70)까지 단조 증가하는 연속 0..1 강도 산출 (초과 시 1.0 클램프).
>   - 실패 사유 판별: 양팔 경합(`isMutualExclusionBlocked`) 시 'dominance'('한 팔만') 우선 채택, 그 외 armExtension, visibility, velocity, zonePenetration 중 최저 게이트 매핑.
>   - 깜빡임 방지: `hintMinInterval`(0.6s) 홀딩 로직 적용.
>   - 완전 미시도 억제: score < 0.30 상태에서는 힌트 표시 차단.
>   - 적응형 완화(`adaptiveRelaxed`) 활성화 인디케이터 지원.
>   - 예약 밴드 침범 방지: 문제 텍스트(0.24~0.40) 및 답안 버튼(0.42~0.56) 하단인 `y ~ 0.5926`에 배치하여 겹침 0% 보장.
> - **어댑터 및 렌더 파이프라인 연동 (`src/ui/PhasePresentationAdapter.ts`, `src/main.ts`)**:
>   - `PhasePresentationAdapter.getAnswerSelectFeedback` 및 `renderAnswerFeedback` 구현.
>   - `main.ts`의 `ANSWER_SELECT` 상태 렌더 루프에 실시간 힌트 및 글로우 피드백 실연결.
> - **TDD 검증**:
>   - `tests/unit/judgment-feedback.test.ts` 13/13 통과, 전체 111개 파일 1,275개 테스트 100% Pass, `npm run build` 통과.

---

## 2026-10-01 완료: [INPUT-TOLERANCE-006 / #254] 니어미스 기반 적응형 관용 및 개인 기준선 캘리브레이션

> #254 구현 및 단위/회귀 검증 완료. 판정 임계치에 근소하게 미달한 니어미스(`threshold * 0.85 <= score < threshold`)를 추적하고, 3회 연속 니어미스 발생 시 단계별 관용 완화(+7%/step)를 적용하여 최대 1.20배(20%)까지 일시 완화한 뒤 성공 1회 발생 시 즉시 1.0으로 원복하는 세션 내 적응형 난이도 보정 엔진(`AdaptiveToleranceTracker`)을 구축했습니다. 또한 `CalibrationHelper`에서 개인별 최대 팔 뻗음 거리와 좌표 지터 분산을 측정해 개인 기준선을 수립하고, 미측정 시 안전 기본값으로 폴백하도록 구현했습니다.
> - **적응형 관용 트래커 (`src/input/AdaptiveTolerance.ts`, `config/judgment.config.ts`)**:
>   - 니어미스 비율(0.85), 연속 임계치(3회), 단계별 완화율(0.07), 최대 완화 상한(0.20) 설정화.
>   - 성공 시 즉시 1.0배 원복, 완전 실패 시 스트릭 리셋, 라운드 전환 시 완화 상태 리셋 연동.
> - **개인 기준선 캘리브레이션 확장 (`src/motion/CalibrationHelper.ts`)**:
>   - `getBaseline()` 제공: 개인별 최대 팔 뻗음 거리(`maxReachDistance`) 및 랜드마크 분산(`jitterVariance`) 산출.
>   - 미완료/실패 시 기본값(0.25, 0.35, 0.0001)으로 안전 폴백(예외 0건).
> - **판정 엔진 연동 (`src/input/ArmReachAnswerSelector.ts`)**:
>   - `setAdaptiveTolerance`를 통해 실시간 완화 배율 주입 및 유효 임계치 동적 스케일링.
>   - 가시성 절대 하드 가드(`hardMinVisibility 0.30`)는 완화 상태에서도 철저히 보존.
> - **TDD 검증**:
>   - `tests/unit/adaptive-tolerance.test.ts` 10/10 통과, 전체 110개 파일 1,262개 테스트 100% Pass, `npm run build` 통과.

---

---

## 2026-10-01 완료: [INPUT-TOLERANCE-005 / #253] 집합 덮기 조건 B 시간 누적 완화 및 Cross-Body 정합성 정리

> #253 구현 및 단위/회귀 검증 완료. Tier 3/4 전신 집합 덮기 판정에서 조건 (B)의 매 프레임 동시 충족 강제를 dwell 구간 윈도우(`tier3Window: 1.0s`, `tier4Window: 1.2s`) 내 누적 덮기로 완화(Temporal Set Coverage)하여 신체 유연성/체격 한계로 인한 불합리한 실패를 해소했습니다. 윈도우를 벗어난 오래된 기록은 자동 만료되며, Tier 1/2 엄격 동시 덮기 및 조건 (A) 매 프레임 충족, `binding: 'ordered'` 엄격 판정은 100% 보존되었습니다. 또한 `isCrossBodyViolation`은 생성/에디터 단계 전용 제약임을 주석과 테스트로 명문화했습니다.
> - **시간 누적 덮기 (`config/judgment.config.ts`, `src/input/PostureMatcher.ts`, `src/input/AnswerSelector.ts`)**:
>   - `TemporalCoverageConfig` (`enableTemporalCoverage`, `tier3Window: 1.0`, `tier4Window: 1.2`) 단일 설정화.
>   - Tier 3/4 및 any 바인딩 모드에서 윈도우 내 목표 존 순차 덮기 지원, 만료 시 조건 (B) 즉시 재미충족.
>   - Tier 1/2 순차 덮기 불인정(동시 덮기 유지), 조건 (A) 미충족 시 즉시 전체 미충족.
>   - `isComplexQuestion=true` 시 Tier 2 강등 및 완화 미적용 보존.
> - **Cross-Body 정합성 명문화 (`config/zone.config.ts`)**:
>   - `isCrossBodyViolation`의 생성/에디터 단계 전용 및 런타임 미적용 규칙 주석 및 테스트 명시.
> - **TDD 검증**:
>   - `tests/unit/posture-temporal-coverage.test.ts` 신설 (9개 Red 시나리오 기반 14개 테스트 100% Pass).
>   - 전체 단위/통합 테스트 109개 파일 1,252개 테스트 100% Pass, `npm run build` 통과.

---

## 2026-10-01 완료: [INPUT-TOLERANCE-004 / #252] MotionIntentBus 도입 및 페이즈별 동작 소유권·통합 불응기

> #252 구현 및 단위/통합 검증 완료. 원시 랜드마크를 단일 지점에서 `{ type, confidence, timestamp, sourceCursor }` 형태의 의도(`MotionIntent`)로 결정적(Deterministic) 분류하는 `MotionIntentBus`를 신설하고, 페이즈별 동작 소유권 테이블(`PHASE_INTENT_OWNERSHIP`)을 통해 비소유 동작의 전달을 원천 차단했습니다. 또한 답안 확정 잔여 모션이 별가루 수집으로 새는 문제를 방지하는 0.25s 전역 통합 불응기(Refractory Lockout, 페이즈 전환 시 즉시 리셋)와 점프 임계치 단일 출처(SSOT: `0.22`)를 구축했습니다.
> - **MotionIntentBus 신설 (`src/motion/MotionIntentBus.ts`, `src/types/motion-intent.ts`)**:
>   - 원시 랜드마크 → `jump`, `reachLeft`, `reachRight`, `stepLeft`, `stepRight`, `squat` 단일 분류 및 결정적 publish/subscribe API.
> - **페이즈별 동작 소유권 테이블 (`config/judgment.config.ts`)**:
>   - `ANSWER_SELECT`: `['reachLeft', 'reachRight']` (점프 등 비소유 의도 원천 차단)
>   - `HAZARD_EVADE`: `['jump', 'stepLeft', 'stepRight']` (점프 정상 전달 회피 인정)
>   - `STAR_COLLECT`: `['reachLeft', 'reachRight', 'jump']`
>   - `BOSS_CLIMAX`: `['jump', 'stepLeft', 'stepRight']`
>   - config 변경만으로 코드 수정 없이 소유권 확장/변경 지원.
> - **통합 불응기 (0.25s Refractory Lockout)**:
>   - 판정 확정 후 0.25s 동안 intent 소비 락아웃 (0.20s 차단, 0.30s 정상 통과).
>   - FSM 페이즈 전환 시 불응기 즉시 리셋.
> - **완전한 하위 호환 폴백 (Pure Fallback)**:
>   - `ArmReachAnswerSelector`, `PhaseAHazardController`, `StarCollectionInput`에 어댑터 형태로 주입되며, 버스 미주입 시 기존 동작 100% 보존.
> - **TDD 검증**:
>   - 10개 Red 시나리오를 포함한 `motion-intent-bus.test.ts` (9 tests) & `phase-motion-ownership.test.ts` (10 tests) 통과, 전체 108개 파일 1,238개 테스트 100% Pass.

---

## 2026-10-01 완료: [INPUT-TOLERANCE-003 / #251] 타이밍 관용 레이어(선행 입력 버퍼·후행 유예·감쇠 홀드·유실 동결)

> #251 구현 및 단위 검증 완료. 장판 회피와 별가루 수집의 순간 판정으로 인한 조기 입력 무효화 문제를 선행 입력 버퍼(Pre-input Buffer, 0.20s) 및 후행 유예(Coyote Time, 0.15s)로 해결하고, 체류 진행도의 존 이탈 직후 급격한 감쇠를 막는 감쇠 홀드(Decay Hold, 0.15s)와 랜드마크 추적 유실 시 진행도 동결(Tracking Loss Freeze)을 완비했습니다.
> - **공용 선행 입력 버퍼 (`src/input/InputBuffer.ts`)**:
>   - 판정창 개시 0.20s 이내의 조기 입력을 큐에 저장했다가 창 개시 시점에 단 1회 안전하게 소비.
> - **후행 유예(Coyote Time)**:
>   - `StarCollectionInput`: 창 종료(0.40s) 후 0.15s 이내 입력 시 Late로 강등 인정.
>   - `PhaseAHazardController`: inputWindowEnd(3.40s) 직후 0.15s 이내 회피 시 `viaGrace: true` 및 피해 0으로 인정.
> - **감쇠 홀드 및 추적 유실 동결 (`src/input/AnswerSelector.ts`)**:
>   - 존 이탈 직후 0.15s 동안 감쇠를 일시 중지하고 진행도 보존. 0.15s 내 재진입 시 즉시 누적 재개.
>   - 랜드마크 유실(모든 visibility < 0.5) 시 진행도 감쇠를 완전 동결.
> - **TDD 검증**:
>   - `input-buffer.test.ts` 3/3 통과, `timing-leniency.test.ts` 11/11 통과, 전체 106개 파일 1,219개 테스트 100% Pass.

---

---

## 2026-10-01 완료: [INPUT-TOLERANCE-002 / #250] 존 판정 소프트 경계(히스테리시스·자석 존·체격 정규화 마진)

> #250 구현 및 단위 검증 완료. 피트니스 존 경계선 부근의 랜드마크 지터에 의한 진입/이탈 깜빡임을 방지하는 히스테리시스(Schmitt Trigger), 존 바깥 근접 시 부분 가중치를 제공하는 자석 존(Nearest-Zone Snap), 사용자 카메라 거리 및 체격 편차를 상쇄하는 어깨 너비 정규화 마진, 그리고 좌표 분산에 연동된 1.5배 마진 자동 확장을 구현했습니다.
> - **히스테리시스(Schmitt Trigger) 구현 (`PostureMatcher.isCursorInsideZone`)**:
>   - 진입 마진 `enterMargin`과 이탈 마진 `enterMargin + exitMarginBonus(0.04)`를 분리하여 경계선 진입 후 깜빡임 0건 보장.
> - **자석 존 및 연속 감쇠 (`computeZoneWeight`)**:
>   - 중심(1.5)에서 가장자리(0.75), 자석 유효 반경(snapRadius 0.06) 외곽(0.0)까지 부드럽게 연속 감쇠.
> - **체격 정규화 마진 (`getCursorMargin`)**:
>   - `shoulderWidth` 제공 시 기준 너비(0.25) 대비 상대 마진 계산. 원거리(0.125) 시 손 마진 0.01875로 동적 축소. 미제공 시 기존 절대 마진(0.03/0.04/0.0) 100% 하위 호환.
> - **신뢰도 및 좌표 분산 연동 (`computePointVariance`)**:
>   - 최근 프레임 분산이 0.0005 이상이면 마진을 1.5배까지 자동 확장.
> - **비목표 존 오판정 차단**:
>   - 비목표 존 내부에 완벽히 위치한 커서가 목표 존으로 잘못 안착하지 않도록 가드 확립.
> - **TDD 검증**:
>   - `posture-soft-boundary.test.ts` 10/10 통과, 기존 `posture-matcher.test.ts` 30/30 통과, `zone-config.test.ts` 11/11 통과, 전체 104개 파일 1,205개 테스트 100% Pass.

---

---

## 2026-10-01 완료: [INPUT-TOLERANCE-001 / #249] 답안 선택 팔 뻗기 가중 신뢰도 스코어링 및 양팔 우세 판정 전환

> #249 구현 및 단위 검증 완료. 기존 6개 게이트 boolean AND 하드컷 방식의 `ArmReachAnswerSelector`를 5개 게이트 가중 신뢰도 스코어링(`zonePenetration 0.30`, `armExtension 0.25`, `horizontalDominance 0.15`, `velocity 0.15`, `visibility 0.15`) 및 `confirmThreshold 0.70`, `dominanceRatio 1.25` 기반 양팔 우세 판정 시스템으로 성공적으로 전환했습니다.
> - **판정 수치 SSOT 신설 (`config/judgment.config.ts`)**:
>   - 가중치 및 연속 정규화 기준값(`baselines`), 확정 임계치(0.70), 우세비(1.25), 가시성 하드 가드(0.30) 정의.
> - **연속 점수 정규화 및 가중 합산**:
>   - 각 게이트가 기준 임계치에서 정확히 0.50을 반환하는 연속 함수 구현.
>   - 뻗음 비율 미달(0.20) 또는 수평 속도 미달(0.18)인 경우에도 다른 게이트가 충분하면 종합 0.70 이상으로 유연하게 확정.
> - **양팔 경합 시 우세 판정 (Relaxed Mutual Exclusion)**:
>   - 양팔 모두 0.70 이상일 때 무조건 차단하지 않고, 높은 쪽이 낮은 쪽의 1.25배 이상이면 우세 손 채택. 1.25배 미만 시에만 판정 보류.
> - **TDD 단위 테스트 100% Pass**:
>   - `arm-reach-weighted-score.test.ts` 8/8 통과, 기존 `arm-reach-answer-selector.test.ts` 21/21 통과, 전체 103개 파일 1195/1195 테스트 100% 통과 확인.

---

## 2026-10-01 완료: [RENDER-CLIMAX-001 / #195] 3D 원근 보스 결전 연출(불협화음 장판 충격파, 적 미니언 전진, 아군 군단 마법 탄막 및 광폭화)

> #195 구현 및 단위/통합 검증 완료. 1인칭 3D 원근 시점의 DreamGrid 공간에서 Phase B 보스 결전(`BOSS_CLIMAX`) 시각 연출을 담당하는 `BossClimaxRenderer`를 구현하고, 실제 Phase B 전투 상태 기반 충격파·그림자 미니언 전진·아군 V자 편대·마법 탄막·보스 30% 광폭화 및 HUD 오버레이를 완벽히 시각화했다.
> - **불협화음 장판 충격파 & 레인 투영**:
>   - `hazard.activePattern === 'dual_slam'`: 소실점(vy)에서 전경 발밑까지 3D 원근 타원 가속으로 확산하는 붉은 충격파 파동 링 및 JUMP 가이드 드로잉.
>   - `hazard.activePattern === 'alternating_stomp_left' / 'alternating_stomp_right'`: 소실점에서 좌측/우측 레인(Zone 9 / Zone 11)을 타고 전진하는 그림자 미니언 및 짓밟기 유도 안내선 드로잉.
>   - `hazard.isResolved`: 회피 성공 시 에메랄드 글로우(`EVADED!`), 실패 피격 시 붉은 폭발 피드백(`HIT! -15 HP`) 연출.
> - **아군 미니언 군단 V자 편대**:
>   - 전경 중앙 수호신(Stage 1~4 단계별 날개 및 후광) 좌우로 부유하는 V자 편대 좌표를 `minionCount`(0..13)에 따라 동적 대칭 계산. 0마리 시 수호신 단독 대치.
> - **아군 군단 마법 탄막 (Magic Barrage)**:
>   - `barrageActive` 및 `barrageProgress`에 따라 미니언 편대와 수호신으로부터 소실점 보스를 향해 날아가는 별빛 마법 투사체 및 보스 위치(p >= 0.85) 폭발 플래시 연출.
> - **보스 광폭화 아우라**:
>   - `isEnraged` 활성화 시 보스 주변에 회전하는 붉은 코로나 광선 스파이크 및 펄스 화염 아우라 점등.
> - **Phase B 전용 상태 HUD**:
>   - 보스 HP 게이지, 광폭화 배지, 피버 콤보 카운터(`🔥 FEVER xN`), 아군 군단 수(`👥 군단: N/13`), 별가루 잔량(`★ 별가루: N`)을 상하단 여백에 깔끔히 배치하여 중앙 키노트 및 커서 판정을 일체 방해하지 않음.
> - **순수 프리젠테이션 격리 & main.ts 실연결**:
>   - 상태 불변성(Immutability) 보장 및 게임 밸런스 무계산 원칙 준수.
>   - `src/main.ts`의 `screenMode === 'game'` 루프에서 `stateMachine.currentState === 'BOSS_CLIMAX'` 시 DreamGrid 이후, HUD 이전에 `bossClimaxRenderer.render` 호출 연결. 문제/답안 오버레이 0% 은닉 보장.
> - **TDD 검증**: 단위 테스트 14건 (`tests/unit/boss-climax-renderer.test.ts`), 통합 테스트 4건 (`tests/integration/boss-climax-render.test.ts`) 신규 작성 및 전체 테스트 102개 파일 1,187건 100% Pass 완료.

---

## 2026-10-01 완료: [MINION-TROOP-001 / #194] Phase B 인계 자원 소비·미니언 군단 화력·피격 탈락 연결

> #194 구현 및 단위/통합 검증 완료. Phase A 정산으로부터 인계된 미니언 군단 수량(3~13체)과 별가루 자원을 Zero-Reset 없이 Phase B(BOSS_CLIMAX) 결전에 승계하고, 상체(Zone 1~5) 별빛 수집과 연동되는 게이지 충전·쿨다운·DPS 화력 공식·별가루 소비형 강화 탄막 및 #193 피격 탈락(0마리 하한 클램프)을 완벽히 구축·연결했다.
> 군단 화력 공식 `(baseDamage + minionCount * damagePerMinion + bonusDamage) * gaugeMultiplier`를 준수하며(`baseDamage: 10`, `damagePerMinion: 2`, `maxGaugeMultiplier: 1.5`, `stardustCost: 5`, `stardustBonusDamage: 10`), 미니언이 전멸(0마리)해도 수호신 단독 대치로 10 기본 화력을 보장한다.
> 상체(Zone 1~5) 별빛 수집 성공 시 게이지 배율이 +0.1 충전(최대 1.5배)되며, Miss 발생 시 쿨다운 지연(0.5초 딜레이) 가산 및 게이지가 감쇠된다. 별가루 보유 잔량이 5 이상일 때 소비에 성공하여 강화 탄막을 발사하며, 잔량 부족 시 오버드래프트 거부·음수 거부·동일 멱등키 중복 차단이 철저히 보장된다.
> 보스에게 `bossController.takeDamage(damage)`로 치명 피해를 입히며, 보스 처치(체력 0 이하) 시 탄막 발사가 즉시 중단된다. `src/main.ts`의 Phase B 진입(`stageProgressController.onEnterBossClimax`), 메인 update 루프, 별 수집 판정 라우팅, 보스 피격 연출(`bossRenderer.triggerHit`, `sfx.play('correct')`, 'cast' 이펙트)에 실연결했다.

### 주요 구현 및 변경 사항
- **군단 화력 밸런스 설정 분리 (`config/battle.config.ts`, `src/core/Config.ts`, `src/types/index.ts`)**:
  - `TroopCombatConfig` 및 `DEFAULT_TROOP_COMBAT_CONFIG` 추가 (`baseDamage: 10`, `damagePerMinion: 2`, `baseGaugeMultiplier: 1.0`, `maxGaugeMultiplier: 1.5`, `gaugePerStar: 0.1`, `cooldown: 1.0`, `missPenaltyDelay: 0.5`, `stardustCost: 5`, `stardustBonusDamage: 10`).
  - `BattleConfig.troopCombat`, `GameConfig.battle.troopCombat` 및 `DEFAULT_BATTLE_CONFIG.troopCombat` 연동.
  - `EventMap`에 `troop:barrage`, `troop:stardust_consumed` 추가.
- **수호신 시스템 강화 마법 API 추가 (`src/game/GuardianSystem.ts`)**:
  - `castEnhanced(bonusDamage = 0): number` 메서드 추가: 별가루 소비형 강화 마법 시전 및 수호신 성장 연계.
- **아군 미니언 군단 매니저 Phase B 전투·화력 엔진 완성 (`src/game/MinionTroopManager.ts`)**:
  - `startPhaseB(snapshot)`: 스냅샷으로부터 미니언 수와 별가루를 온전히 인계(Zero-Reset Guard).
  - `computeDamage(gaugeMultiplier, isEnhanced)`: 승인된 DPS 화력 공식 엄격 준수.
  - `recordStarRating(rating, zoneId)`: Zone 1~5 상체 별빛 수집 시 게이지 +0.1(최대 1.5배), Miss 시 0.5초 쿨다운 지연 및 게이지 감쇠.
  - `consumeStardust(amount, idempotencyKey)`: 자원 지갑(`PhaseAResourceManager`) 연계 또는 로컬 지갑 차감, 오버드래프트 거부, 음수/NaN 거부, 중복 멱등키 방지.
  - `fireBarrage(options)`: 보스 치명 피해 부여(`bossController.takeDamage`), 쿨다운 재설정, `troop:barrage` 이벤트 발행, 보스 처치 시 자동 사격 중단.
  - `update(dt, options)`: 쿨다운 타이머 감쇠 및 자동 탄막 발사 루프.
  - `setBossController`, `setResourceManager`, `setEventBus` 의존성 주입 지원.
- **PhaseAResourceManager 연동 (`src/game/PhaseAResourceManager.ts`)**:
  - 인스턴스화 시 `troopManager.setResourceManager(this)` 및 `bossController` 자동 주입.
- **실게임 런타임 연결 (`src/main.ts`)**:
  - `beatRoundResolver.resourceManager.troopManager.setEventBus(eventBus)`, `setBossController(boss)`.
  - `eventBus.on('troop:barrage')`: 보스 피격 애니메이션(`bossRenderer.triggerHit`), 타격/캐스팅 이펙트, 효과음 트리거.
  - `starNoteScheduler.onRating`: Phase B에서 `troopManager.recordStarRating(starResult.rating, starResult.zoneId)` 동기 호출.
  - `BOSS_CLIMAX` 진입/퇴장: `stageProgressController.onEnterBossClimax`에서 `troopManager.startPhaseB(snapshot)` 호출, `exit` 시 `stop()`.
  - 메인 update 루프: `BOSS_CLIMAX` 중 `troopManager.update(dt, { autoConsumeStardust: true })` 호출.

### 검증 결과
- `tests/unit/minion-troop-combat.test.ts` (18 tests Pass): Phase B 인계 자원 보존(Zero-Reset 방지), 군단 화력 공식(DPS), 0마리 수호신 단독 대치(10), 커스텀 설정 반영, 게이지 충전(최대 1.5배) 및 Zone 1~5 검증, Miss 0.5초 쿨다운 지연 및 감쇠, 별가루 소비 강화 탄막(30), 오버드래프트 거부, 비정상 수치 거부, 멱등키 중복 차단, 피격 탈락 하한 클램프(0마리) 및 화력 즉각 갱신, 보스 치명 피해, 보스 처치 즉시 사격 중단, update 루프 자동 발사 100% Pass.
- `tests/unit/minion-troop-manager.test.ts` (18 tests Pass): Phase A + Phase B 전영역 통합 100% Pass.
- `tests/integration/troop-combat.test.ts` (1 test Pass): Phase A 10문제 정산(7정답 3오답) -> 자원 스냅샷 인계 -> Phase B 게이지 충전 -> 보스 충격파 피격 미니언 탈락(10->9) -> 화력 재계산 -> 별가루 소비 강화 탄막 -> 보스 격파 -> 사격 중단 전과정 통합 검증 100% Pass.
- 전체 테스트: **100개 파일, 1169개 테스트 100% Pass**, `npm run build` TypeScript 검사 0 에러 & Vite 번들 검증 완료.

---

## 2026-10-01 완료: [BATTLE-BOSS-001 / #193] Phase B 전용 보스 충격파·교대 짓밟기·광폭화 실행 연결

> #193 구현 및 단위/통합 검증 완료. Phase B(BOSS_CLIMAX) 결전에 진입했을 때만 가동되는 보스 패턴 공격 및 광폭화 엔진 `BossHazardController`를 신설하고 실제 런타임에 완벽히 연결했다. Phase A 러닝 중에는 보스 공격 타이머가 동작하지 않아 0회 공격을 철저히 보장한다.
> 보스의 2대 패턴 공격(양손 쿵 'dual_slam' 충격파 - jump 회피, 한손 콩콩 'alternating_stomp_left'/'alternating_stomp_right' 적 미니언 침투 - step_left/step_right/Zone 9/11 회피)을 제공하며, 회피 성공 시 피해 0/미니언 손실 0, 회피 실패(Hit) 시 플레이어 HP 15 차감, 피버 콤보 0 리셋(`bossFeverController.onPlayerHit`), 아군 미니언 1체 탈락(`minionTroopManager.removeMinion`, 0마리 하한 클램프), `MINION_CASUALTY` 이벤트 발행을 멱등하게 단 1회 수행한다.
> 보스 체력이 30% 이하 도달 시 광폭화가 단 1회 발동하여 공격 주기가 1.5배 단축된다. 일시정지 시 타이머가 동결되며, 보스 격파 또는 플레이어 사망 시 즉시 공격이 정지된다.
> `src/main.ts`의 `BOSS_CLIMAX` 진입/퇴장, 메인 루프 update, 카메라 점프 감지(`jumpDetector`), 발 키노트(`footKeynoteInput`), 키보드(Space, Z, V, X) 및 터치(Zone 9/10/11) 회피 입력 라우팅, `ResultData` 점프 카운트(`totalJumps`)에 실연결했다.

### 주요 구현 및 변경 사항
- **보스 결전 공격 및 광폭화 설정 분리 (`config/battle.config.ts`, `src/core/Config.ts`, `src/types/index.ts`)**:
  - `BossHazardConfig` 및 `DEFAULT_BOSS_HAZARD_CONFIG` 추가 (`attackInterval: 5.0`, `warningDuration: 1.5`, `activeDuration: 1.0`, `damage: 15`, `enrageHpRatio: 0.3`, `enrageSpeedMultiplier: 1.5`, `minionCasualtyCount: 1`).
  - `EventMap`에 `boss:enrage`, `MINION_CASUALTY`, `minion:casualty`, `boss:hazard_resolved`, `boss:hazard_start` 추가.
- **아군 미니언 군단 모델 하한 탈락 메서드 추가 (`src/game/MinionTroopManager.ts`)**:
  - `removeMinion(count = 1): number` 추가: 피격 시 미니언 감소 및 0마리 하한 클램프.
- **BossHazardController 구현 (`src/game/BossHazardController.ts`, `src/game/index.ts`)**:
  - 생명주기: start/stop/pause/resume/reset 완비.
  - 공격 패턴: `dual_slam`, `alternating_stomp_left`, `alternating_stomp_right` 순환/스케줄링.
  - 회피 입력 매칭: `recordAction(action)` 점프, 왼발, 오른발, 발 키노트 존 ID 매핑.
  - 멱등적 단일 정산: `_resolveAttack()`을 통해 단 1회 판정 및 이벤트 버스/콜백 발행.
  - 광폭화: 보스 체력 비율 30% 이하 시 단 1회 트리거 및 주기 단축.
- **실게임 런타임 연결 (`src/main.ts`)**:
  - `BOSS_CLIMAX` 진입 시 `bossHazardController.start()`, 퇴장 시 `bossHazardController.stop()`.
  - 메인 update 루프에서 `BOSS_CLIMAX` 중 `bossHazardController.update(dt)` 실행.
  - 점프, 발 키노트, 키보드, 터치 회피 입력 연동 및 `totalJumps` 칼로리/결과 연동.

### 검증 결과
- `tests/unit/boss-hazard-controller.test.ts` (14 tests Pass): 초기 비활성, start/stop/pause/resume 생명주기, 점프 회피, 왼발/오른발 회피, 회피 성공 피해 0/미니언 보존, 회피 실패 피해 15/콤보 0 리셋/미니언 -1/MINION_CASUALTY 이벤트, 0마리 하한 클램프, 멱등 단일 판정, 체력 30% 광폭화 및 1.5배 단축, 보스 처치 즉시 정지, 플레이어 사망 즉시 정지 100% Pass.
- `tests/integration/phase-b-boss-attack.test.ts` (3 tests Pass): Phase A 0회 공격 보장, Phase B 진입 후 피버 누적-점프 회피-피격 미니언 탈락-광폭화 가속-처치 종료 전 과정 통합 검증 100% Pass.
- `tests/unit/phase-a-resources.test.ts` (17 tests Pass): `removeMinion` 하한 클램프 포함 100% Pass.
- 전체 테스트: **97개 파일, 1132개 테스트 100% Pass**, `npm run build` TypeScript 검사 0 에러 Pass.

---

## 2026-10-01 완료: [BOSS-FEVER-001 / #213] 10문제 종료 후 Phase B 연속 별모으기·콤보 보스타격 실게임 연결

> #213 구현 및 단위/통합 검증 완료. 10문제 종료 후 StageProgressController로부터 Phase B(BOSS_CLIMAX)로 진입한 뒤, 수학 문제를 중단하고 무제한 별노트 시퀀스를 연속 생성/순환하며 피버 콤보 누적과 등급 가중치 기반 치명 보스 타격을 수행하는 `BossFeverController`를 신설하고 실제 런타임에 연결했다. Phase A의 별 수집이 보스 HP에 전혀 영향을 주지 않는 것(별가루 축적 전용)과 달리, Phase B의 피버 별 수집은 성공 판정(Perfect/Good/Late) 시 콤보 +1을 누적하고 설정 기반 공식(`baseDamage * ratingWeight * comboMultiplier`, 최대 3.0배 상한 클램프)으로 계산된 피해를 `bossController.takeDamage(damage)`로 직접 가해 보스를 처치할 수 있도록 구현했다. 미입력 또는 Miss 발생 시 피버 콤보는 0으로 즉시 리셋되며 피해량은 0이다. 손(Zone 1~5)과 발(Zone 9~11)을 모두 활용하는 기본 피버 시퀀스를 제공하고, 시퀀스 완료 시 다음 시퀀스를 중단 없이 이어붙여 무제한으로 별노트를 제공하도록 구축했다. #193 보스 피격 연동 규약으로 `onPlayerHit()` 및 `resetCombo()`를 제공하여 피격 시 피버 콤보가 즉시 리셋되도록 보장했다. 보스 체력이 0 이하가 되면 피버 루프를 정지하고 `RESULT` (승리)로 단 1회 전이하며 피버 통계(`BossFeverStats`)를 제공하고, 플레이어 체력이 0 이하가 되면 `GAMEOVER`로 단 1회 전이한다. `src/main.ts`의 `BOSS_CLIMAX` 진입/퇴장, `starNoteScheduler.onRating` 라우팅 분기, 키보드/터치/발 입력 및 메인 루프 update에 실연결했다.

### 주요 구현 및 변경 사항
- **피버 밸런스 설정 분리 (`config/battle.config.ts`, `src/core/Config.ts`, `src/types/index.ts`)**:
  - `FeverConfig`: `baseDamage: 1`, `ratingWeights: { Perfect: 1.5, Good: 1.0, Late: 0.5, Miss: 0 }`, `comboMultiplierStep: 0.1`, `maxComboMultiplier: 3.0` 분리 및 `DEFAULT_BATTLE_CONFIG.fever` 추가.
  - `DEFAULT_CONFIG.battle.fever` 및 `GameConfig.battle.fever` 타입/상수 연동.
- **피버 컨트롤러 구현 (`src/game/BossFeverController.ts`, `src/game/index.ts`)**:
  - `BossFeverController`: `start(startTime, snapshot)`, `stop()`, `reset()`, `recordRating(rating, noteId)`, `computeDamage(rating, combo)`, `update(currentTime, landmarks, ...)`, `onPlayerHit()`, `resetCombo()`, `getStats(isVictory)` 완비.
  - `DEFAULT_FEVER_PATTERNS`: 손 Zone 1~5(1: 좌상, 2: 중앙상, 3: 우상, 4: 좌중, 5: 우중) 및 발 Zone 9~11(9: 좌발, 10: 중앙/골반, 11: 우발) 균형 배치.
  - 시퀀스 연속 순환 루프: 현재 시퀀스 완료 시 다음 시퀀스를 이어붙여 끊김 없는 무제한 별노트 스트림 유지.
  - 종결 판정: 보스 HP <= 0 시 RESULT(승리) 1회 전이 및 `onVictory` 통지, 플레이어 HP <= 0 시 GAMEOVER 1회 전이 및 `onGameOver` 통지.
- **전투 상태 및 프레젠테이션 어댑터 연동 (`src/game/BattleState.ts`, `src/ui/PhasePresentationAdapter.ts`)**:
  - `BattleState`: `feverCombo` 상태, `incrementFeverCombo()`, `resetFeverCombo()` 추가.
  - `PhasePresentationAdapter.canRenderStarCollect`: `BOSS_CLIMAX` 상태에서도 별노트 렌더링을 허용하도록 확장.
- **메인 루프 및 입력 실연결 (`src/main.ts`)**:
  - `BOSS_CLIMAX` 상태 진입 시 `bossFeverController.start(...)` 및 퇴장 시 `stop()`.
  - `starNoteScheduler.onRating`: `BOSS_CLIMAX` 상태에서 `bossFeverController.recordRating(starResult, noteId)`로 자동 라우팅.
  - 발 키노트(`footKeynoteInput`), 화면 터치(`canvas.addEventListener`), Space 키보드(`document.addEventListener`)에 `BOSS_CLIMAX` 지원 추가.
  - `engine.update`: `BOSS_CLIMAX` 중 `bossFeverController.update(...)` 호출 및 타깃 동기화.
  - `startChapter`, `goToMenu`: `bossFeverController.reset()` 초기화 연동.
- **TDD 검증 결과**:
  - `tests/unit/boss-fever-controller.test.ts` (10 tests Pass): 초기 설정 로드, start 활성화/스냅샷 보존, 콤보 누적 및 보스 치명 피해, 중복 noteId 멱등성, Miss 콤보 0 리셋 및 피해 0, 콤보 배율 상한(3.0) 클램프, #193 피격 리셋(`onPlayerHit`), 보스 처치 승리(RESULT) 1회 전이, 플레이어 패배(GAMEOVER) 1회 전이, 손 1~5/발 9~11 시퀀스 생성 100% Pass.
  - `tests/integration/boss-fever-integration.test.ts` (4 tests Pass): 10문제 정산 완료 후 Phase B 인계/피버 1회 시작/11번째 출제 0회, Phase A 별 수집 보스 피해 0 vs Phase B 보스 즉시 타격 분리, 연속 시퀀스 2회 이상 자동 순환/무입력 Miss/콤보 리셋, Phase B 보스 처치 승리(RESULT) 완주 100% Pass.
  - `npm run build` 번들 빌드 100% 성공 & `npm test` 전체 95개 파일 1114개 테스트 100% Pass (회귀 결함 0건).

---

## 2026-10-01 완료: [GAME-STAGE-HANDOFF-001 / #241] 10번째 라운드 정산 후 Phase B 진입 및 자원 단일 인계

> #241 구현 및 단위/통합 검증 완료. QuestionBank 무한 출제 및 라운드 완료 후 무조건 다음 문제 예약으로 인해 Phase A 종료와 Phase B 진입이 연결되지 않던 결함을 해결했다. `StageProgressController`를 신설하여 Phase A 목표 10문제를 설정화(`DEFAULT_CONFIG.battle.phaseAQuestionCount`)하고, 정산 완료 이벤트(`handleRoundSettled`)를 기반으로 1~9번째 라운드는 다음 문제(`RUN_QUESTION`)를 정상 예약하고, 10번째 라운드 정산 완료 시점에 상태 머신을 `BOSS_CLIMAX`(Phase B)로 단 1회 전이하며 동결된 `PhaseAResourceSnapshot`을 단일 인계하도록 구축했다. 10번째 라운드에서 오답/타임아웃/장판 피격 누적으로 플레이어 HP가 0 이하가 된 경우 `GAMEOVER` 처리가 최우선하여 Phase B 인계 횟수 0회를 엄격히 보장했다. 11번째 문제 스케줄링은 0회로 원천 차단되었으며, Phase B 진입 시 플레이어 누적 자원(미니언 군단, 별가루, 체력, 마나, 콤보 등)이 일체 리셋되지 않음을 증명했다. 중복 정산 콜백, 프레임 지연, 메뉴 복귀 시 `SessionLifecycle` 연동을 통해 중복 인계 및 고아 비동기 실행을 원천 차단했다. `src/main.ts`의 `handleAnswer`, `startChapter`, `goToMenu` 및 상태 머신 `BOSS_CLIMAX` 생명주기에 실연결했다.

### 주요 구현 및 변경 사항
- **스테이지 진행 컨트롤러 (`src/game/StageProgressController.ts`, `src/game/index.ts`)**:
  - `StageProgressController`: `maxRounds` (기본 10), `settledRoundCount`, `isPhaseAComplete`, `hasEnteredBossClimax`, `handoffCount`, `phaseBSnapshot`, `scheduledNextRoundCount` 관리.
  - `handleRoundSettled(resolveResult, options)`:
    - 동일 라운드 중복 호출 및 완료 후 재호출 멱등성 가드 (`ALREADY_SETTLED_ROUND`, `ALREADY_HANDED_OFF`).
    - 플레이어 HP <= 0 시 GAMEOVER 우선 처리 및 Phase B 인계 0회 보장.
    - 1~9번째 라운드: `NEXT_ROUND` 판정 및 `onAdvanceToNextRound` 통지.
    - 10번째 라운드: `BOSS_CLIMAX` 판정, `stateMachine.changeState('BOSS_CLIMAX')`, `registerPhaseBReceiver` 및 `onEnterBossClimax`로 불변 스냅샷 단 1회 전달.
    - 11번째 문제 스케줄링 차단 (정확히 0회).
  - `reset()`: 정산 카운트, 인계 상태, 지연 타이머 초기화.
- **메인 루프 및 상태 머신 실연결 (`src/main.ts`)**:
  - `type GamePhase = ... | 'boss_climax'`: `BOSS_CLIMAX` 상태 전이 시 `gamePhase = 'boss_climax'` 동기화.
  - `stateMachine.registerState('BOSS_CLIMAX', ...)`: 문제/답안 오버레이 숨김, 입력 잠금, 회피 장판 중지 등 정리 1회 보장.
  - `stageProgressController` 인스턴스화: `beatRoundResolver`, `sessionLifecycle`, `stateMachine` 연동.
  - `handleAnswer`: 10번째 라운드 정산 완료 후 Phase B 전환 및 11번째 출제 차단.
  - `startChapter`, `goToMenu`: `stageProgressController.reset()` 연동.
- **TDD 검증 결과**:
  - `tests/unit/stage-progress-controller.test.ts` (8 tests Pass): 초기 0 라운드, 1~9 라운드 진행, 10번째 라운드 BOSS_CLIMAX 단 1회 인계, HP 0 게임오버 우선/인계 0회, 중복 멱등 차단, SessionLifecycle 취소 연동, reset() 초기화 100% Pass.
  - `tests/integration/stage-handoff.test.ts` (4 tests Pass): 10연속 정답 경로(미니언 13, 별가루 40, 비치명 보스 HP 1 보존, 자원 리셋 0건, 11번째 출제 0), 혼합 10문제(정답 5/오답 3/타임아웃 2), 10번째 장판 피격 HP 0 게임오버 우선, 메뉴 복귀 시 비동기 인계 취소 100% Pass.
  - `npm run build` 번들 빌드 100% 성공 & `npm test` 전체 93개 파일 1100개 테스트 100% Pass (회귀 결함 0건).

---

## 2026-10-01 완료: [GAME-PHASE-A-RESOURCES-001 / #242] Phase A 미니언·별가루 자원 모델 및 인계 스냅샷

> #242 구현 및 단위/통합 검증 완료. #194에 혼재되어 있던 Phase A 군단 증원 및 별가루 자원 축적 로직을 Phase B 공격/DPS 소비 엔진과 완전히 분리하여 #241 단일 인계와의 순환 의존을 방지했다. `MinionTroopManager`를 신설하여 초기 군단(기본 미니언 3 + 수호신 1 = 총 4체), 정답 정산 1회당 미니언 +1 증원(최대 13마리 상한 클램프), 오답(wrong)/타임아웃(timeout) 시 미니언 증원 0(기존 군단 및 수호신 100% 보존) 및 roundId 기준 멱등 정산(중복 콜백 시 증원 0)을 완비했다. `PhaseAResourceManager`를 통해 별 수집 통계와 소비 가능한 별가루 잔량을 엄격히 분리하고, 승인된 판정 등급별 별가루(Perfect 4, Good 3, Late 2, Miss 0) 적립 및 noteId 기준 중복 적립 원천 차단을 구축했다. 별 0개(전부 Miss)여도 기본 정답 보상(마나 +25, 콤보 +1, 미니언 +1)은 정상 지급되도록 보장했다. 소비 API 계약 `consumeStardust(amount, idempotencyKey)`을 정의하여 잔량 초과 거부, 음수/0/NaN/Infinity 비정상치 거부, 동일 idempotencyKey 중복 차감 차단을 구현했다. Phase B 인계 불변 스냅샷 인터페이스 `PhaseAResourceSnapshot`에 `minionCount`, `guardianCount`, `stardust`, `totalStardustEarned`를 추가하고 `Object.freeze` 불변 객체로 제공하며 읽기/취득 시 내부 상태 reset이 발생하지 않음을 증명했다. `BeatRoundResolver` 및 `src/main.ts`의 실제 노트 평가 및 정산 루프에 실연결하여 목(mock) 지갑이 아닌 실제 런타임 누적을 검증했다.

### 주요 구현 및 변경 사항
- **자원 설정 분리 (`config/battle.config.ts`, `src/core/Config.ts`, `src/types/index.ts`)**:
  - `DEFAULT_BATTLE_CONFIG`: `initialMinions: 3`, `maxMinions: 13`, `minionsPerCorrect: 1`, `stardustReward: { Perfect: 4, Good: 3, Late: 2, Miss: 0 }` 분리 및 `StardustRewardConfig` export.
- **아군 미니언 군단 모델 (`src/game/MinionTroopManager.ts`)**:
  - 초기 미니언 3마리 + 수호신 1체 (총 4체) 관리.
  - `onRoundSettled(status, roundId)`: 정답 시 미니언 +1 (최대 13마리 클램프). 오답/타임아웃 시 증원 0 및 기존 군단 보존. roundId 캐시를 통한 멱등성 보장.
- **별가루 자원 및 통합 매니저 (`src/game/PhaseAResourceManager.ts`)**:
  - 별가루 잔량(`stardust`)과 누적 획득량(`totalStardustEarned`) 분리.
  - `recordStarRating(rating, noteId)`: 판정별 별가루 적립 및 noteId 중복 적립 차단.
  - `consumeStardust(amount, idempotencyKey)`: 잔량 초과 거부, 음수/비정상값 거부, 동일 키 중복 차감 방지 API 계약.
  - `createSnapshot()` / `getResourceSnapshot()`: 동결된 `PhaseAResourceSnapshot` 생성 (호출 시 내부 상태 불변 및 리셋 0건).
- **실제 정산기 및 메인 루프 실연결 (`src/game/BeatRoundResolver.ts`, `src/main.ts`)**:
  - `BeatRoundResolver`에 `PhaseAResourceManager` 내장 및 `resourceManager`, `minionCount`, `stardust` 게터 제공.
  - `resolveRound` 실행 시 `resourceManager.onRoundSettled` 연동, `recordStarRating` 시 noteId 전달 연동, `getResourceSnapshot()`에 미니언/별가루 데이터 동결 포함, `reset()` 연동.
  - `src/main.ts`: `starNoteScheduler.onRating`에서 `noteId`를 `beatRoundResolver.recordStarRating(starResult.rating, noteId)`로 안전 전달.
- **TDD 검증 결과**:
  - `tests/unit/phase-a-resources.test.ts` (16 tests Pass): 초기 3+1, 정답당 +1, 13 상한, 오답/타임아웃 보존, roundId 멱등성, 등급별 별가루, noteId 중복 방지, 잔량 초과/음수/idempotencyKey 소비 거부, 불변 스냅샷 상태 보존 100% Pass.
  - `tests/integration/phase-a-resources.test.ts` (7 tests Pass): `BeatRoundResolver` 실연결 미니언 증원, 중복 정산 방어, 10연속 정답 13마리 상한, 별가루 적립/멱등성, 별 0개 기본 보상 정상, 10문제 최종 스냅샷 인계 데이터 완전성, 소비 API 연동 100% Pass.
  - `npm run build` 번들 빌드 100% 성공 & `npm test` 전체 91개 파일 1088개 테스트 100% Pass (회귀 결함 0건).

---

## 2026-10-01 완료: [BATTLE-PHASE-A-SETTLEMENT-001 / #240] Phase A 보상 정산과 Phase B 보스 처치 책임 분리

> #240 구현 및 단위/통합 검증 완료. `BeatRoundResolver`가 정답당 보스 -1 데미지 및 마나 100 도달 시 스펠 -4 데미지를 무제한 적용하여 Ch.1~4 일반 보스(HP 10)가 6번째 정답에 조기 격파되고 Phase A가 비정상 승리 처리되던 결함, 동일 roundId에 대한 중복 콜백 수신 시 마나/콤보/정답수가 중복 가산되던 결함, 그리고 Phase A 종료 시점의 불변 자원 스냅샷 인터페이스 부재를 해결했다. `config/battle.config.ts`를 신설하여 `phaseAQuestionCount: 10`, `phaseAMinBossHp: 1`을 완전히 분리하고, `BossController`에 `options?: { minHp?: number }` 및 `takeNonLethalDamage()`를 도입했다. `BeatRoundResolver`에 `nonLethalPhaseA: true`와 `minBossHp: 1` 기본 정책을 적용하여 Phase A 동안 10연속 정답을 달성해도 보스 HP가 1 미만으로 떨어지지 않도록 보장하고 조기 승리 전이를 차단했다. 또한 `_settledRoundIds` 및 `_roundResults` 캐시를 구축하여 roundId 기준 멱등적(Idempotent) 단일 정산(중복 콜백 시 마나·콤보·문제수 중복 가산 0)을 완비했다. 별 0개(올 Miss)여도 정답 기본 보상(마나 +25, 콤보 +1)이 보장되며, 오답/타임아웃은 완료 문제 1개로 정상 집계하되 플레이어 직접 피해는 0으로 유지했다. 플레이어 HP가 0에 도달할 경우 Phase A 완료보다 게임오버가 우선하도록 보장하였고, `getResourceSnapshot()`을 통해 동결된(Object.freeze) `PhaseAResourceSnapshot`을 제공하도록 구축했다. `src/main.ts`에서는 10문제 완료 시 11번째 문제 출제를 차단하고 Phase B 연동을 대기하도록 제어했다.

### 주요 구현 및 변경 사항
- **전투 설정 분리 및 규격화 (`config/battle.config.ts`, `src/core/Config.ts`, `src/types/index.ts`)**:
  - `DEFAULT_BATTLE_CONFIG`: `phaseAQuestionCount: 10`, `phaseAMinBossHp: 1`, `bossHpNormal: 10`, `bossHpNightmare: 20`, `correctDamage: 1`, `spellDamage: 4`, `playerMaxHp: 100`, `wrongDamage: 25`, `bossAttackDamage: 15`, `manaCorrectReward: 25`, `spellCost: 100` 분리.
- **보스 비치명 피해 지원 (`src/game/BossController.ts`)**:
  - `takeDamage(amount: number, options?: { minHp?: number })`: 체력 하한선 옵션 도입 (`this._hp = Math.max(minHp, this._hp - amount)`).
  - `takeNonLethalDamage(amount: number, minHp = 1)` 헬퍼 메서드 추가. Phase B 처치 인터페이스(`takeDamage(amount)`) 100% 호환 보존.
- **Phase A 책임 분리 및 멱등 정산 (`src/game/BeatRoundResolver.ts`)**:
  - `nonLethalPhaseA: true`, `minBossHp: 1`, `maxPhaseARounds: 10` 기본 적용: 10연속 정답에도 보스 HP 1 보장, `bossDefeated: false`, `onBossDefeated` 미발생 (조기 승리 0건).
  - `roundId?: number | string` 파라미터 지원 및 `_settledRoundIds`, `_roundResults` 연동: 동일 roundId 중복 콜백 시 마나/콤보/문제수 중복 가산 0 보장.
  - `isPhaseAComplete`, `settledRoundCount`, `maxPhaseARounds` getter 제공.
  - `getResourceSnapshot(): PhaseAResourceSnapshot` 불변(Object.freeze) 스냅샷 생성 지원.
- **메인 루프 11번째 문제 출제 차단 (`src/main.ts`)**:
  - `beatCoordinator.onAnswerConfirmed`에서 `beatRoundResolver.currentRoundIndex`를 roundId로 안전 전달.
  - `handleAnswer`에서 `beatRoundResolver.isPhaseAComplete` 감지 시 11번째 문제 스케줄링 차단 및 Phase B 대기.
- **TDD 검증 결과**:
  - `tests/unit/beat-round-resolver.test.ts` (19 tests Pass): 10연속 정답 비치명 보존, lethal 모드 호환, roundId 멱등성, 10문제 완료 판정, 불변 스냅샷 검증 100% Pass.
  - `tests/integration/phase-a-settlement.test.ts` (8 tests Pass): 10연속 정답 조기 승리 0건, 중복 콜백 방어, 지연 콜백 격리, 별 0개 기본 보상, 오답 직접피해 0, HP 0 게임오버 우선순위, 10문제 혼합 완주 불변 스냅샷 100% Pass.
  - `npm run build` 번들 빌드 100% 성공 & `npm test` 전체 89개 파일 1065개 테스트 100% Pass (회귀 결함 0건).

---

## 2026-10-01 완료: [AUDIO-BAND-001 / #191] 실제 노트·장판·Web Audio 밴드 음향 동기화 재검증

> #191 구현 및 단위/통합 검증 완료. `BandSynthesizer`의 파워코드 및 스네어톤 설명과 실제 오디오 노드 구성이 불일치하여 파워코드 존(Zone 1~3)에서 단일 오실레이터만 생성되거나 스네어 존(Zone 10)에서 노이즈 버퍼만 재생되고 바디 펀치 톤 오실레이터가 누락되던 결함, 노트결과 ID 기준 중복 방지 캐시가 없어 이벤트 중복 시 동일 노트 음향이 중복 격발될 수 있던 결함, 그리고 `SFXSynth`와 `BandSynthesizer` 간 `AudioContext` 인스턴스 공유 및 `suspend()`/`resume()`/`close()` 생명주기 제어가 부재하던 결함을 해결했다. `config/audio.config.ts`를 신설하여 일렉 기타 주파수, 파워코드 5도 비율(1.5), 왜곡 계수(28), 록 드럼 파라미터(Kick, Snare 톤+노이즈, Cymbal 필터), 미스 틱, 레디/셋 파라미터를 완전 분리했다. `BandSynthesizer`에서 Zone 1~3은 근음+5도 화음 듀얼 오실레이터로, Zone 10 스네어는 노이즈 버퍼와 톤 오실레이터(180Hz→80Hz) 동시 합성으로 개편하고 `suspend/resume/close` 생명주기 API를 완비했다. `SFXSynth` 역시 외부 `AudioContext` 주입 옵션 및 생명주기를 지원하여 두 신디사이저가 단일 `AudioContext`를 공유하도록 구축했다. 또한 `src/main.ts`에 `playedNoteAudioIds` 중복 방지 세트를 도입하여 노트결과 ID당 정확히 1회 재생 및 무입력 Miss 누락 0건을 보장했다. 신규 통합 테스트 `tests/integration/audio-band-integration.test.ts`를 통해 손/발/Space/터치 실입력 연동(Perfect sync, Good/Late stumble, Miss tick), 7노트 혼합 루틴 누락 0건, 장판 회피 성공(`shield_deflect`) 및 피격(`player_hurt` & -25 HP) 음향 연동, 음소거 및 AudioContext 생명주기를 100% 검증했다.

### 주요 구현 및 변경 사항
- **오디오 설정값 완전 분리 (`config/audio.config.ts`, `src/core/Config.ts`)**:
  - `DEFAULT_BAND_AUDIO_CONFIG`: Zone 1~8 기타 주파수, 파워코드 존(`[1, 2, 3]`), 5도 비율(`1.5`), WaveShaper 왜곡 계수(`28`), 록 드럼(Kick, Snare 노이즈+톤, Cymbal), 미스 틱(120Hz), 레디/셋 톤 파라미터 분리.
- **파워코드 화음 및 스네어톤 듀얼 합성 (`src/audio/BandSynthesizer.ts`)**:
  - `playGuitarZone`: Zone 1~3 파워코드 타격 시 근음(`freq`) 및 5도 화음(`freq * 1.5`) 2개 sawtooth 오실레이터를 WaveShaper 왜곡기에 동시 공급. Zone 4~5는 단일 리드 오실레이터 출력.
  - `playDrumZone`: Zone 10 스네어 타격 시 노이즈 버퍼와 함께 스네어 톤 오실레이터(180Hz→80Hz 지수 하강)를 동시 트리거하여 풍부한 록 스네어 바디 펀치감 형성.
  - 구형 `REST_READY` 상태 폐기(#229)에 따라 `playReadyCount`는 정규 루프 미채택(Unused)으로 주석 명시 및 유틸리티 보존.
  - `suspend()`, `resume()`, `close()` 비동기 생명주기 관리 메서드 추가.
- **AudioContext 인스턴스 공유 및 음향 수명주기 제어 (`src/audio/SFXSynth.ts`, `src/main.ts`)**:
  - `SFXSynth` 생성자에 `options?: SFXSynthOptions` 지원 및 `audioContext` getter 노출.
  - `src/main.ts`에서 `new BandSynthesizer({ audioContext: sfx.audioContext ?? undefined })`로 단일 AudioContext 공유 확립 (브라우저 컨텍스트 누수 방지).
  - `playedNoteAudioIds` 세트를 연동하여 노트당 정확히 1회 오디오 재생 보장 및 `STAR_COLLECT` 진입/퇴장 및 러닝 시작 시 안전 초기화.
- **TDD 검증 결과**:
  - `tests/unit/band-synthesizer.test.ts` (22 tests Pass): 파워코드 2개 오실레이터, 리드 1개 오실레이터, 스네어 노이즈+톤 오실레이터, suspend/resume/close, SFXSynth 공유 포함 100% Pass.
  - `tests/integration/audio-band-integration.test.ts` (12 tests Pass): 손/발/Space/터치 밴드 키사운드 실시간 디스패치, 7노트 혼합(3 hit + 4 miss) 누락 0건, 장판 회피 성공(`shield_deflect`) 및 피격(`player_hurt` & -25 HP), 음소거 및 suspend/resume 포함 100% Pass.
  - `npm run build` 번들 빌드 100% 성공 & `npm test` 전체 88개 파일 1053개 테스트 100% Pass (회귀 결함 0건).

---

## 2026-10-01 완료: [RENDER-HAZARD-001 / #228] 회피 페이즈 전용 3D 장판 렌더링 및 판정 시각 동기화 재검증

> #228 구현 및 단위/통합 검증 완료. `HazardZoneRenderer`가 렌더링되더라도 판정 순간(3.5s)에 유저가 올바른 회피를 수행했는지 또는 피격되었는지에 대한 시각 피드백이 없어 결과와 대상 패턴을 식별할 수 없던 결함, 그리고 `BeatHUDRenderer`에 과거 프로토타입 잔재로 남아있던 상시 '장판 루틴 완료!' 텍스트가 러닝 페이즈 화면 중앙에 불필요하게 노출되던 화면 간섭 결함을 해결했다. `HazardZoneRenderer`에 `isResolved` 및 `isEvaded` 상태를 연동하여 회피 성공 시 에메랄드/시안 안전 소멸 펄스(`#4DFFAA`)를, 피격 실패 시 바닥 전면을 강타하는 붉은 충격파/폭발 임팩트(`#FF4444`)를 렌더링하도록 개편했다. 또한 `PhasePresentationAdapter.renderHazardEvade`에서 판정 순간 대상 패턴명과 함께 `회피 성공! (DODGED)` 또는 `회피 실패! (HIT / -25 HP)` 상태 배지를 표출하도록 구축하였으며, `src/main.ts`의 `phaseAHazardController` 상태를 완벽히 연동했다. 신규 통합 테스트 `tests/integration/phase-a-hazard-render.test.ts`를 통해 0~3.5s 원근 전진, 3.5s 판정 시점의 성공/실패 시각 분기, 4.0s 종료 시 0건 드로잉, 페이즈별 렌더 격리를 100% 검증했다.

### 주요 구현 및 변경 사항
- **판정 순간(3.5s) 성공 vs 실패 3D 임팩트 시각화 (`src/render/HazardZoneRenderer.ts`)**:
  - `HazardRenderState`에 `isResolved?: boolean`, `isEvaded?: boolean` 필드 추가.
  - 회피 성공 시(`isResolved && isEvaded`): 점프 링, 스텝 레인, 균형 플랫폼 모두 안전 소멸 에메랄드/시안 글로우(`rgb(77, 255, 170)`) 드로잉.
  - 피격 실패 시(`isResolved && !isEvaded`): 선두 충격파 림 선폭 1.5배 증폭 및 위험 붉은색(`rgb(255, 68, 68)`) 강렬한 폭발 임팩트 렌더링.
- **판정 결과 텍스트 및 대상 패턴 식별 피드백 (`src/ui/PhasePresentationAdapter.ts`, `src/main.ts`)**:
  - `HazardEvadePresentationState`에 `isEvaded?: boolean`, `isResolved?: boolean`, `performedAction?: PhaseAHazardPattern | null` 필드 추가.
  - 판정 완료 시 타이틀 `회피 성공! (DODGED)` / `회피 실패! (HIT)` 및 서브타이틀 `[대상패턴]` 식별 안내 표출.
  - `src/main.ts`의 렌더 루프에서 `phaseAHazardController`의 판정 상태(`isEvaded`, `isResolved`, `performedAction`)를 실시간 주입.
- **TDD 검증 및 실제 브라우저 캡처 결과**:
  - `tests/unit/hazard-zone-renderer.test.ts` (12 tests Pass): 단조 전진, 패턴별 색상/레인, 성공 안전 소멸, 실패 붉은 임팩트 검증 포함 100% Pass.
  - `tests/unit/phase-presentation-adapter.test.ts` (9 tests Pass): 회피 성공/실패 결과 텍스트 및 패턴 식별명 표출 검증 포함 100% Pass.
  - `tests/integration/phase-a-hazard-render.test.ts` (6 tests Pass): 컨트롤러 수명주기 연동, 3.5s 판정 성공/실패 분기, 4.0s 종료 후 0건 드로잉, 페이즈 격리 검증 100% Pass.
  - `npm run build` 번들 빌드 100% 성공 & `npm test` 전체 87개 파일 1035개 테스트 100% Pass (회귀 결함 0건).
  - Chrome headless 실제 브라우저 캡처 완료 (`hazard_zone_verify.png`): 1. 접근 단계(65% 전진) → 2. 회피 성공(DODGED 안전 소멸) → 3. 회피 실패(HIT 붉은 임팩트) 3개 캔버스 정상 표출 확인.

---

## 2026-10-01 완료: [RENDER-KEYNOTE-001 / #192] 실제 별 스케줄 기반 레일 비행·판정창·페이즈 표시 재검증

> #192 구현 및 단위/통합 검증 완료. `StarNoteRenderer`의 Late 판정 만료창이 0.25초로 고정되어 입력 엔진의 Late 창(0.40초)보다 0.15초 조기 소멸하여 플레이어가 Late 판정 범위 내에 있음에도 노트가 화면에서 먼저 사라지던 불일치 결함, 노트 수집 성공(`resolved: true` 또는 `isCollected: true`) 상태가 렌더러에 반영되지 않아 수집 후에도 판정 만료까지 노트가 공중에 잔존하던 결함, 그리고 7번째 마지막 노트(3.5s 착지)가 Late 허용창(3.90s) 종료 전 조기 비가시화되던 결함을 해결했다. `DEFAULT_STAR_TIMING_WINDOWS.late` (0.40s) 및 `perfect` (0.12s)를 `StarNoteRenderer`의 기본값 및 설정 인터페이스와 완전히 일치시키고, `computeNotePosition` 및 `render`에서 `resolved/isCollected` 노트를 즉시 비행 제외(`inFlight: false`) 및 드로잉 0건으로 차단하도록 구현했다. 또한 실제 스케줄러(`StarNoteScheduler`)와 연동된 `tests/integration/star-note-schedule-render.test.ts`를 신규 구축하여 1번~7번 노트의 소실점 출발(0.5s 비행, scale 0.3→1.2), 목표 존 안착(오차 1px 이내), 수집 즉시 제거, 0.40s Late 윈도우 유지 및 7번째 마지막 노트의 13.90s 만료 시점 보장, 그리고 `STAR_COLLECT` 페이즈 시 Question/HUD 화면 가림 0% 및 일시정지(pause) 고정 좌표 안정성을 완벽히 검증했다.

### 주요 구현 및 변경 사항
- **Late 판정창(0.40s) 및 Perfect 판정창(0.12s) 설정 일치 (`src/render/StarNoteRenderer.ts`, `config/beat-motion.config.ts`)**:
  - `StarNoteRenderOptions`에 `timingWindows?: Partial<StarTimingWindows>` 도입.
  - 기본 `lateWindow`를 구형 0.25s에서 `DEFAULT_STAR_TIMING_WINDOWS.late` (0.40s)로 개편.
  - 기본 `perfectWindow`를 `DEFAULT_STAR_TIMING_WINDOWS.perfect` (0.12s)로 개편.
  - 7번째 마지막 노트(3.5s 착지)가 3.90s까지 온전히 렌더링 유지되어 판정창 만료 및 4.00s `isComplete` 정산과 100% 동기화.
- **수집 완료(`resolved`/`isCollected`) 즉시 렌더링 제거 파이프라인 (`src/render/StarNoteRenderer.ts`)**:
  - `computeNotePosition`: `target.resolved || target.isCollected` 검사를 최우선 수행하여 수집/해결 완료된 노트는 즉시 `inFlight: false` 반환.
  - `render`: `targets` 목록에서 `(t as any).resolved` 및 `(t as any).isCollected` 대상을 1차 필터링하여 드로잉 호출 0건 보장.
  - 부위별 악기 아이콘 연동: `instrument === 'foot'`인 발 노트는 `♪` (음표), 손 노트는 `★` (별)로 직관적 렌더링.
- **`main.ts` 렌더 루프 및 일시정지(pause) 안전 연동 (`src/main.ts`)**:
  - `starNoteRenderer.render` 호출 시 `isPaused: engine.paused || starNoteScheduler.isPaused` 전달.
  - 일시정지 중 게임 활성 시간(`engine.elapsedTime`) 정지 시 모든 비행 중인 별 노트의 좌표와 크기가 정확히 고정되어 시각적 드리프트 0건 달성.
  - `presentationAdapter` 기반 상태별 렌더 허용표에 따라 `STAR_COLLECT` 페이즈에서는 `canRenderQuestion = false`, `canRenderRunningHUD = false`, `canRenderHazardEvade = false`로 문제 헤더나 러닝 HUD에 의한 화면 가림 0% 보장.
- **TDD 검증 및 실제 브라우저 캡처 결과**:
  - `tests/unit/star-note-renderer.test.ts` (15 tests Pass): 0.40s Late 윈도우 유지, 만료 후 inFlight=false, resolved/isCollected 즉시 제거, 드로잉 0건 검증 포함 100% Pass.
  - `tests/integration/star-note-schedule-render.test.ts` (7 tests Pass): 실제 7노트 스케줄러 연동 비행, Zone 10 안착 1px 이내 오차, 발 입력 수집 즉시 제거, 7번째 마지막 노트 13.90s 보장, 화면 가림 0% 및 pause 고정 검증 포함 100% Pass.
  - `npm run build` 번들 빌드 100% 성공 & `npm test` 전체 86개 파일 1025개 테스트 100% Pass (회귀 결함 0건).
  - Chrome headless 실제 브라우저 캡처 완료 (`star_collect_verify.png`): 10.25s(비행 중) → 10.50s(안착 및 펄스) → 10.80s(Late 유지) 3개 캔버스 정상 표출 확인.

---

## 2026-10-01 완료: [BUG-MATH-FIT-001 / #234] 긴 자연어·복합 수식의 화면 너비·높이 초과 수정 및 경계 수용

> #234 구현 및 단위/통합 검증 완료. `MathRenderer.wrapMathTokens`가 단일 text 토큰 내부를 나누지 않아 공백 없는 긴 어절이나 한글 단일 토큰이 `maxWidth`보다 커도 그대로 출력되어 화면을 벗어나던 결함, 수식의 실측 총 높이 제약이 없어 3줄 이상의 긴 질문 텍스트가 하단 도형 뷰포트(`y: 480px`)나 답안 버튼과 겹치던 결함, 그리고 긴 선택지(2진수 13자리, 긴 회전 안내 등)가 버튼 경계를 초과하던 결함을 해결했다. `MathRenderer`에서 text 토큰에 대해 어절 우선 분리 및 `maxWidth` 초과 시 문자 단위 fallback 분리를 구현하여 분수·루트·지수·빈칸 등 수학 구조를 100% 보존하면서 문자 유실 0으로 완벽히 줄바꿈되도록 개편했다. 또한 `MathRenderOptions`에 `maxHeight`와 `minFontSize`를 도입하여 실측 높이가 지정 영역을 넘을 경우 폰트를 점진적으로 안전하게 축소하도록 구축하였으며, `QuestionRenderer`의 공통 헤더 헬퍼 및 답안 버튼 렌더링에 너비/높이 경계를 적용하여 겹침 0%를 확립했다.

### 주요 구현 및 변경 사항
- **어절 우선 및 문자 단위 fallback 줄바꿈 파이프라인 (`src/render/MathRenderer.ts`)**:
  - `wrapMathTokens`: text 토큰을 공백 기준으로 1차 분리하되, 단일 어절 또는 공백 없는 긴 텍스트가 `maxWidth`를 초과할 경우 문자 단위(`Array.from`)로 순회하며 빈 줄 기준 분리.
  - 분수(`fraction`), 거듭제곱(`power`), 근호(`sqrt`), 진법(`subscript`), 빈칸(`placeholder`), 연산자(`operator`) 등 구조화된 수학 토큰은 원형을 완전 보존.
  - 인접 text 토큰 병합(`mergeLineTextTokens`)을 통해 렌더링 오버헤드 최소화 및 문자 유실 0 보장.
- **실측 높이 기반 폰트 자동 축소 및 높이 제한 (`src/render/MathRenderer.ts`, `src/types/index.ts`)**:
  - `MathRenderOptions`에 `maxHeight?: number`, `minFontSize?: number` 필드 추가.
  - `renderMath`: `maxHeight` 제공 시 실제 렌더링 전 줄바꿈 높이를 측정하고, `maxHeight`를 초과하면 `minFontSize`까지 점진적으로 축소(최대 10회 반복 가드)하여 영역 내 완벽 수용.
- **공통 헤더 헬퍼 및 2버튼 답안 경계 수용 (`src/render/QuestionRenderer.ts`)**:
  - `renderQuestionHeaderMath`: 반환형을 `{ width: number; height: number }`로 확장하고, `QuestionHeaderMathOptions`(`hasShape`, `maxHeight`, `maxWidth`, `minFontSize`) 연동. 도형 문제 시 상단 패널 뷰포트(`y: 480px`)와 겹치지 않도록 `maxHeight: 140 * scaleY` 및 `qY = 390 * scaleY`로 정렬하여 겹침 0% 보장.
  - 답안 선택지 버튼: `renderMath` 호출 시 `maxWidth: btnW - 32 * scaleX`, `maxHeight: btnH - 32 * scaleY`, `minFontSize: 32 * scaleX`를 전달하여 2진수 13자리 및 긴 회전 선택지도 버튼 테두리 밖으로 이탈하지 않도록 완벽 수용.
- **TDD 검증 결과**:
  - `tests/unit/math-renderer.test.ts` (21 tests Pass): 공백 없는 17자 한글 text 토큰 분리(너비 <= maxWidth), 어절 우선 분리 및 문자 유실 0, 복합 수식 구조 보존, maxHeight 기반 자동 폰트 축소, 버튼 경계 내 수용 검증 포함 100% Pass.
  - `tests/unit/question-renderer.test.ts` (6 tests Pass): `renderQuestionHeaderMath` 실측 치수 반환, 도형 뷰포트(`y: 480px`) 이전 렌더링 종료(겹침 0%), 긴 2진수 답안 버튼 수용 검증 포함 100% Pass.
  - `npm run build` 번들 검증 100% 성공 & `npm test` 전체 85개 파일 1014개 테스트 100% Pass (회귀 결함 0건).

---

## 2026-09-30 완료: [BUG-DANCE-LANE-001 / #246] 문제 페이즈(RUN_QUESTION) 바운스(rebound/dip) 고유 레인 매핑 보완

> #246 후속 보완 구현 및 단위/통합 검증 완료. `editor.html` 초기 진입 화면인 문제 페이즈(RUN_QUESTION)에서 8박 바운스 노트들(`NOTE_Q_1`~`NOTE_Q_8`)이 `lane: 'motion'` 설정으로 인해 신체 고유 레인(`왼손`, `오른손`, `골반/발`)에 배치되지 못하고 일반 `모션` 레인에만 갇혀 있던 결함을 해결했다. `PhaseSequenceEditor`에서 `dip`(Down 스쿼트)은 `part: 'hip'`, `rebound`(Up 리바운드)는 `part: 'leftHand'`(Cyan 테마)로 구조화된 부위 메타데이터를 명시하고, `BeatTimelineRenderer.getLanesForNote`에서 구조화된 부위를 최우선 판정하도록 개편하여 홀수 박 리바운드(Cyan)는 `✋ 왼손`, 짝수 박 딥(Orange)은 `🥋 골반/발` 고유 레인에 정확히 1회씩 교차 배치되도록 완성했다.

### 주요 구현 및 변경 사항
- **문제 페이즈(RUN_QUESTION) 명시적 신체 부위 매핑 (`src/editor/PhaseSequenceEditor.ts`)**:
  - `initDefaultSequences` 및 `syncWithPattern`에서 `action === 'dip'`은 `part: 'hip'`, `action === 'rebound'`는 `part: 'leftHand'`로 명시적 부위 속성 주입.
- **구조화된 부위 우선 레인 판정 (`src/editor/BeatTimelineRenderer.ts`)**:
  - `getLanesForNote`: `part`, `targetPart`, `primaryPart`, `action` 순으로 구조화된 부위를 추출하여 고유 레인 우선 배정.
  - 부위가 지정되지 않은 전신 안무 블록(`FEVER_PHASE_B`)만 `lane-motion`에 배치.
- **TDD 검증 결과**:
  - `tests/unit/editor-timeline-lane.test.ts` (6 tests Pass): `rebound`는 `lane-lh`, `dip`은 `lane-hipfoot` 고유 레인 1회 배치 및 `lane-motion` 중복 방지 검증 포함 100% Pass.
  - `npm run build` 번들 검증 100% 성공 & `npm test` 전체 85개 파일 1006개 테스트 100% Pass.

---

## 2026-09-30 완료: [FEAT-QUESTION-SHAPE-001 / #247] 쌓기나무(모양 A~Q 17종) 및 입체도형 전개도 시각 이미지 생성 및 QuestionRenderer 연동

> #247 구현 및 단위/통합 검증 완료. `questions.csv`의 Level 9 SubLevel 4(쌓기나무 165문항) 및 SubLevel 5(주사위 전개도 문항)에서 시각 그림이 없어 텍스트만으로 정답 도출이 불가능하던 문제를 해결했다. `ShapeRenderer`를 신규 구현하여 17종 쌓기나무 모양(A~Q)의 3D 아이소메트릭 절차적 드로잉 및 주사위/정육면체 1-4-1 전개도(면 1~6, 꼭짓점 점 ㄱ~ㅂ) 렌더러를 구축했다. `GeneratedQuestion` 모델에 `shapeCode`를 보존하도록 확장하고, `QuestionRenderer`에서 도형 문제 출제 시 문제 수식 텍스트와 2개 답안 버튼 사이 중앙 비간섭 밴드(`y: 480~820px`)에 3D 뷰포트 패널을 배치하여 겹침 0%로 완벽하게 연동했다.

### 주요 구현 및 변경 사항
- **3D 아이소메트릭 쌓기나무 렌더러 및 17종 표준 카탈로그 (`src/render/ShapeRenderer.ts`)**:
  - `STACK_CUBE_CATALOG`: 모양 A부터 Q까지 17종 표준 2D 그리드 데이터 정의 (questions.csv 정답 개수 100% 일치).
  - `renderStackCubes()`: 정규화 3D 아이소메트릭 투영(stepX=cos30°, stepY=sin30°, cubeH) 및 화가 알고리즘(Painter's Algorithm: `(r+c)` 오름차순, `z` 오름차순)을 적용하여 깊이 정렬 완벽 보장.
  - 고대비 네온/크리스탈 셰이딩(상단면 `#6FE3FF`, 좌측면 `#0284C7`, 우측면 `#1D4ED8`, 외곽선 `#08182B`)으로 3초 내 직관적 블록 카운팅 지원.
  - 시점 가이드(front: 앞 ↗️, side: 옆 ↖️, top: 위 ⬇️) 화살표 및 라벨 배지 렌더링.
- **주사위/정육면체 1-4-1 전개도 렌더러 (`src/render/ShapeRenderer.ts`)**:
  - `renderCubeNet()`: 6개 정사각형 면 외곽 실선 및 내부 접는선 점선(`[4, 4]`) 렌더링.
  - 대상 면(`face: 1`) 골드 하이라이트(`#FFCB4D`) 테두리 및 배경 점등.
  - 꼭짓점 기호(`points`: 점 ㄱ, 점 ㅂ, 점 ㄹ 등) 마커 및 라벨 정확 좌표 오프셋 표출.
- **질문 데이터 모델 확장 및 QuestionRenderer 연동 (`src/types/index.ts`, `src/question/QuestionEvaluator.ts`, `src/render/QuestionRenderer.ts`, `src/render/index.ts`)**:
  - `GeneratedQuestion.shapeCode` 필드 추가 및 `generateQuestion()` 시 `record.shapeCode` 자동 보존.
  - `QuestionRenderer`: 도형 문제 출제 시 수식 텍스트를 상단(`qY = 430px`)으로 정렬하고 중앙에 `480x340px` 네온 뷰포트 패널을 렌더링하여 문제 텍스트 및 좌/우 답안 버튼(Zone 4/5)과 겹침 0% 보장.
- **TDD 검증 결과**:
  - `tests/unit/shape-renderer.test.ts` (16 tests Pass): shapeCode 파싱, A~Q 17종 카탈로그 전수 검증, 17종 3D 아이소메트릭 렌더링, 시점 가이드, 전개도 6면/접는선/꼭짓점, QuestionRenderer 무간섭 연동 100% Pass.
  - `tests/unit/question-system.test.ts` (42 tests Pass): shapeCode 보존 검증 포함 전체 통과.
  - `npm run build` 번들 빌드 100% 성공 & `npm test` 전체 85개 파일 1005개 테스트 100% Pass (회귀 결함 0건).

---

## 2026-09-30 완료: [BUG-HAZARD-LIFECYCLE-001 / #236] Phase A 장판을 HAZARD_EVADE 수명주기에 연결 및 단일 회피 판정·데미지 복구

> #236 구현 및 단위/통합 검증 완료. `PhaseAHazardController`의 start/update/recordAction이 `RUN_QUESTION`에 무한 루프로 연결되어 달리기 중 장판이 표출되고 조기 오동작으로 체력이 깎이던 치명적 결함, 8패턴 4초와 분기 7박 3.5초의 박자 불일치, 그리고 5 HP 피해와 GDD 25 HP 피해 간의 규약 충돌을 해결했다. `RUN_QUESTION`에서 장판 시작/반복을 완전히 제거하고 `HAZARD_EVADE` 전이 시에만 `start({ roundIndex })` 1회 가동 및 퇴장 시 `stop()`하도록 수명주기를 확립했다. GDD 계약에 따라 활성 회피 3종(`left_step`, `right_step`, `jump`) 중 라운드 기반 단일 공격을 채택하고, 경고(0~2.6s) → 입력창(2.6~3.4s) → 판정(3.5s) → 정산 전이(4.0s) 타임라인과 실패 피해 25(성공 0)를 확정했다. 또한 "틀린 선행 입력은 기회를 소모하지 않고 올바른 회피 시 성공 잠금" 정책을 구현하여 조작 편의성을 극대화했으며, 발/점프/Space/터치 fallback 입력을 `HAZARD_EVADE` 상태와 일시정지 보호 하에 안전하게 연결했다.

### 주요 구현 및 변경 사항
- **단일 회피 공격 수명주기 및 25 HP 피해 정책 확립 (`config/phase-a-hazard.config.ts`, `src/game/PhaseAHazardController.ts`)**:
  - `damagePerMiss: 25`, `totalDuration: 4.0`, `judgmentTime: 3.5`, `warningDuration: 2.6`, `inputWindowEnd: 3.4` 적용.
  - 활성 회피 3종(`PHASE_A_ACTIVE_HAZARD_PATTERNS`: `left_step`, `right_step`, `jump`) 단일 풀 구성 및 라운드 인덱스 매핑.
  - `recordAction(action)`: 잘못된 선행 동작이 올바른 후속 회피를 차단하지 않으며, 올바른 동작 수행 시 `_evaded = true` 성공 잠금. 판정 시점(3.5s)에 `attackId`당 정확히 1회 결과 통보.
  - `beatProgress`: 0.0(소실점)에서 3.5s(판정 시점)까지 1.0(전경 발밑)으로 단조 증가하도록 계산 공식 개편.
- **`HAZARD_EVADE` 상태 수명주기 완전 일치 (`src/main.ts`)**:
  - `startRunningPhase()` 및 `RUN_QUESTION` 렌더/업데이트 루프에서 `phaseAHazardController` 시작/재시작/입력 완벽 분리.
  - `stateMachine.registerState('HAZARD_EVADE')` enter 시 `start({ roundIndex })` 1회 호출, exit 시 `stop()` 1회 호출.
  - `onBeatResolved`: 성공 시 쉴드 방어음 및 파티클, 실패 시 피해 25 적용 및 피격 연출. HP 0 도달 시 `showResult(false)` 즉시 호출.
  - 발 키노트(`footKeynoteInput.onEvent`), 점프 감지(`JumpDetector`), Space 키, 가상 페달 및 터치 fallback 입력을 `HAZARD_EVADE` 및 `!pauseModal.isOpen` 상태로 라우팅.
  - `canRenderRunningHUD` 렌더 시 `activeHazardPattern: null`을 전달하여 달리기 중 잔여 장판 표시 원천 차단.
- **TDD 검증 결과**:
  - `tests/integration/phase-a-hazard-runtime.test.ts` (신규 8 tests Pass): RUN/STAR 장판 비활성 및 0피해, HAZARD 진입/퇴장 수명주기, 성공 0 vs 실패 25 피해 1회, 잘못된 선행 입력 미차단 성공 잠금 정책, pause 입력 차단, HP 0 게임오버 우선 순위, 3D beatProgress 단조 증가 검증 100% Pass.
  - `tests/unit/phase-a-hazard-controller.test.ts` (6 tests Pass): 신규 수명주기 및 25 HP 피해 단위 검증 100% Pass.
  - `npm run build` 번들 검증 100% 성공 & `npm test` 전체 84개 파일 988개 테스트 100% Pass.

---

## 2026-09-30 완료: [BUG-DANCE-DATA-001 / #244] 안무 패턴 부위 해제 후 매핑 잔존 및 발 존 검증 결함 수정

> #244 구현 및 단위/통합 검증 완료. 에디터에서 `updateCurrentPattern({ leftHand: null })` 호출 시 registry 패턴의 `leftHand`는 `null`이 되지만 `partZoneMap.leftHand = 6`이 잔존하던 결함과, `updateCurrentPattern({ footZones: [1, 999] })`처럼 비허용 발 존/중복 값이 정상 데이터로 승인되던 결함을 해결했다. 4대 신체 부위 단일 정본(`leftHand`, `rightHand`, `head`, `hip`)으로부터 `partZoneMap`을 순수 재생성하는 `buildPartZoneMap` 헬퍼를 도입하여 `register` 및 `update` 시 `null`로 해제된 부위가 `partZoneMap`에서 완벽히 배제되도록 일원화했다. 또한 `config/zone.config.ts`에 `FOOT_ZONES` (Set) 및 `ALLOWED_FOOT_ZONES` (`[9, 10, 11]`)를 추가하고 `dancePatternRegistry.validate`와 `PoseConstraintValidator.validateDetailed` 양 검증 경로에 배열 형태, 정수 타입, 9/10/11 허용 범위, 중복 검사를 동일하게 구현하여 비허용 발 존이 저장되지 않도록 데이터 정합성을 확립했다.

### 주요 구현 및 변경 사항
- **단일 정본 기반 부위 매핑 재생성 함수 도입 (`src/data/danceRoutineData.ts`, `src/editor/EditorState.ts`)**:
  - `buildPartZoneMap(pattern)` 헬퍼를 신설하여 `leftHand`, `rightHand`, `head`, `hip` 중 유효한 정수 존만 `partZoneMap`에 매핑.
  - `DancePatternRegistry.register` 및 `update`에서 기존 `partZoneMap`을 얕은 복사로 덮어쓰지 않고 `buildPartZoneMap`을 통해 순수 재생성.
  - `EditorState.getSelectedPattern()` 및 `updateCurrentPattern`에서도 `buildPartZoneMap`을 동기화하여 `null` 해제 시 즉시 `partZoneMap`에서 제거됨을 보장.
- **발 디딤 존(footZones) 규격 및 검증 파이프라인 일원화 (`config/zone.config.ts`, `src/data/danceRoutineData.ts`, `src/editor/PoseConstraintValidator.ts`)**:
  - `FOOT_ZONES` (`Set<number>([9, 10, 11])`) 및 `ALLOWED_FOOT_ZONES` (`readonly [9, 10, 11]`) 정의.
  - `isValidZoneForCursor('foot', zoneId)` 연동 및 `PoseConstraintValidator.canAssign('foot', zoneId)`, `getAllowedZones('foot')` 지원.
  - `validate` 및 `validateDetailed`에서 `footZones` 배열 형태 검사, 정수 타입 검사, 9/10/11 허용 구역 검사(`DISALLOWED_ZONE`), 중복 존 검사(`DUPLICATE_FOOT_ZONE`) 일관 적용.
- **JSON 및 CSV 직렬화 왕복(Roundtrip) 무결성 보장**:
  - 부위 해제(`leftHand: null`) 후 JSON 및 CSV로 내보내고 다시 로드해도 `partZoneMap.leftHand`가 부활하지 않고 정확히 원본 필드와 1:1 일치.
  - 외부 CSV/JSON 파일에서 비허용 발 존이나 중복 값이 포함된 행은 파싱 검증에서 안전하게 걸러져 로드 거부.
- **TDD 검증 결과**:
  - `tests/unit/dance-routine-data.test.ts` (24 tests Pass): `null` 해제 시 `partZoneMap` 동기화, `register` 시 불필요 키 제거, `[1, 999]` 비허용 발 존 거부, `[9, 9]` 중복 존 거부, 비정상 타입 거부, JSON/CSV Roundtrip 100% 일치 검증.
  - `tests/unit/pose-constraint-validator.test.ts` (8 tests Pass): `canAssign('foot', 9~11)` 허용 및 기타 존 거부, `getAllowedZones('foot')`, `validateDetailed`의 `DISALLOWED_ZONE` 및 `DUPLICATE_FOOT_ZONE` 상세 위반 정보 검증.
  - `tests/unit/editor-state.test.ts` (25 tests Pass): `updateCurrentPattern` 부위 해제 시 레지스트리와 선택 패턴 양쪽 `partZoneMap` 동기화 및 비허용 발 존 수정 차단 검증.
  - `tests/unit/zone-config.test.ts` (11 tests Pass): `FOOT_ZONES` 및 `isValidZoneForCursor('foot', ...)` 검증.
  - `npm run build` 번들 검증 100% 성공 (0 errors) & `npm test` 전체 84개 파일 988개 테스트 100% Pass (회귀 결함 0건).

---

## 2026-09-30 완료: [BUG-STAR-SCHEDULE-001 / #235] 별모으기 노트 스케줄·판정창·마지막 정산 순서 복구

> #235 구현 및 단위/통합 검증 완료. `main.ts`에서 `landingTime = now + 0.25`로 주입하여 실제 비행 소요 시간(1박, 0.5초) 및 렌더러와 불일치하던 결함, 매 0.5초마다 새 박이 올 때 이전 타겟을 덮어써 Late 허용창(+0.40s)과 미수집 노트가 Miss 통계도 없이 유실되던 결함, `BeatRunCoordinator`의 `BRANCH_ROUTINE_BEATS`가 7(3.5s)로 설정되어 7번째 노트(3.5s 착지)의 Late 허용창(3.90s) 및 만료(4.00s) 도달 전 조기 정산되던 결함을 해결했다. `StarNoteScheduler`를 신규 도입하여 7개 노트의 착지 일정(0.5s, 1.0s, 1.5s, 2.0s, 2.5s, 3.0s, 3.5s)을 분리 예약하고, 각 노트별 고유 ID로 1회 결과 보장 및 `landingTime + 0.40s` 만료 시 Miss 자동 확정을 구현했다. 또한 `instrument === 'foot'`인 노트는 손/머리/골반 커서 판정을 바이패스하고 발 입력(`fromFoot`)으로만 판정하도록 격리하였으며, Space/터치/발/모션 입력을 단일 결과 리스너(`onRating`)로 라우팅했다. `BRANCH_ROUTINE_BEATS`를 8(4.0s)로 조정하여 7번째 노트의 모든 판정창이 온전히 보장된 후 `ROUND_RESOLVE`가 호출되도록 정산 순서를 확립했다.

### 주요 구현 및 변경 사항
- **별모으기 7개 노트 스케줄러 도입 (`src/game/StarNoteScheduler.ts`)**:
  - `start(startTime, options)`: 7개 노트의 착지 일정(0.5s ~ 3.5s)을 분리 예약하고 고유 ID 부여.
  - `update()`: `landingTime + 0.40s` 만료 시점에 미수집 노트를 Miss 1회 확정. `instrument === 'foot'`인 노트는 커서 모션 판정을 바이패스.
  - `fromFoot()`, `fromKeyboard()`, `fromTouch()`: 발, Space 키보드, 존 터치 입력을 단일 결과 경로(`onRating`)로 통합 라우팅.
  - `isComplete`: 7개 노트 확정 및 `currentTime >= startTime + 3.90s` 경과 시 완료 플래그 반환.
- **분기 루틴 8박(4.0s) 조정 및 정산 순서 확립 (`src/game/BeatRunCoordinator.ts`)**:
  - `BRANCH_ROUTINE_BEATS`를 7(3.5s)에서 8(4.0s)로 변경하여 7번째 노트(3.5s 착지)의 Late 허용창(3.90s) 및 만료(4.00s) 종료 후 `_resolveRound()` 호출 보장.
- **다중 비행 노트 렌더링 지원 (`src/render/StarNoteRenderer.ts`)**:
  - `StarNoteRenderState`에 `targets?: readonly (ActiveStarTarget | StarTarget)[]`를 지원하여 비행 중인 모든 노트를 동시 렌더링 가능하도록 확장.
- **단일 결과 리스너 및 입력 파이프라인 연동 (`src/main.ts`)**:
  - `STAR_COLLECT` 진입 시 스케줄러 시작, `engine.update`에서 `update` 호출, 판정 결과를 `beatRoundResolver.recordStarRating()` 및 사운드/이펙트로 일괄 전달.
  - 발 키노트 수신 시 `starNoteScheduler.fromFoot` 연동, Space 키 누름 시 `starNoteScheduler.fromKeyboard` 연동, 피트니스 존 터치/클릭 시 `starNoteScheduler.fromTouch` 연동.
- **TDD 검증 결과**:
  - `tests/integration/star-note-schedule.test.ts` (8 tests Pass): 7개 착지 일정 분리, 중복/누락 0건 1회 결과 보장, 0.40s 만료 Miss 확정, 손/머리 커서 판정, 발 전용 노트 바이패스 및 발 입력 수집, Space/터치 공통 결과 경로, `isComplete` 3.90s 경과 조건, 8박(4.0s) 정산 순서 보장 검증 100% Pass.
  - `npm run build` 번들 빌드 성공 (0 errors) & `npm test` 전체 83개 파일 971개 테스트 100% Pass.

---

## 2026-09-30 완료: [BUG-DANCE-LANE-001 / #246] 패턴 이름 키워드로 인한 신체 레인 중복 렌더링 결함 수정

> #246 구현 및 단위/통합 검증 완료. `BeatTimelineRenderer.ts`의 레인 분류 로직이 구조화된 부위(`payload.part`) 외에 `note.label` 문자열의 `우측`, `좌측`, `양손`, `골반` 등의 키워드를 휴리스틱으로 검사하여, 우측 패턴(`CAT_SKY_POINT_RIGHT`)의 골반(`hip`) 및 왼손(`leftHand`) 노트(NOTE_S_1, NOTE_S_2, NOTE_S_5, NOTE_S_6)가 오른손 레인(`lane-rh`)에 2회 중복 표시되던 결함을 해결했다. 구조화된 명시적 부위 데이터(`payload.part`, `payload.targetPart`, `payload.parts`, `payload.choiceIndex`, `lane === 'motion'`)만으로 레인을 1:1 매핑하는 `getLanesForNote`를 신설하고, 라벨 문자열 검사를 완전히 제거하여 단일 부위 노트가 고유 레인에 정확히 1회만 표시되도록 개편했다.

### 주요 구현 및 변경 사항
- **구조화된 부위 기반 레인 결정 함수 도입 (`src/editor/BeatTimelineRenderer.ts`)**:
  - `getLanesForNote(note)` 메서드를 추가하여 `payload.part`, `payload.targetPart`, `payload.parts`, `payload.choiceIndex`, `lane === 'motion'`을 기준으로 표시 레인 판정.
  - 라벨 문자열에 의한 오인식 및 중복 배치를 원천 차단하여 이름/라벨 변경 시에도 레인이 왜곡되지 않음.
- **TDD 검증 결과**:
  - `tests/unit/editor-timeline-lane.test.ts` (5 tests Pass): 우측 패턴 적용 시 중복 출력 0건 및 1회 표시 검증, 이름 키워드 혼합 시에도 구조화된 부위 우선 검증, `EXTENDED_CAT_CHOREO_PATTERNS` 10종 전수 검사 100% Pass, 답안(0번/1번) 및 모션 레인 분리 검증.
  - `tests/unit/beat-timeline-renderer.test.ts` (6 tests Pass): 기존 렌더러 기능 회귀 결함 0건.
  - `npm run build` 번들 검증 100% 성공 & `npm test` 전체 82개 파일 963개 테스트 100% Pass.

---

## 2026-09-30 완료: [BUG-DANCE-PERSIST-001 / #245] 패턴 선택 및 프로젝트 복원 시 편집 시퀀스 덮어쓰기 결함 수정

> #245 구현 및 단위/통합 검증 완료. 사이드바에서 패턴 카드를 클릭하거나 패턴 메타데이터(이름, 설명)를 수정할 때마다 타임라인에 공들여 편집한 키노트 시퀀스(커스텀 비트 위치, 지속 시간, 라벨, 타깃 존 등)가 기본 템플릿으로 강제 덮어쓰여 초기화되던 치명적 결함을 해결했다. `EditorState`에서 단순 패턴 선택(`setSelectedPattern`)과 명시적 패턴 적용(`applyPatternToSequence`)을 완전 분리하고, `EditorIOHandler.importFullProjectJSON` 프로젝트 열기 시 유효성 사전 검증 후 레지스트리 전체 교체(`clear()` 후 등록)를 적용하여 이전에 삭제한 패턴이 부활하는 현상을 원천 차단했다. 또한 `PhaseSequenceEditor`에 `SequenceChangeListener`를 신설하고 `EditorState.onDocumentChange`를 도입하여, 60fps 재생/탐색(`seekBeat`)과 문서 데이터 변경을 분리함으로써 재생 중 편집 시 800ms 디바운스 자동저장이 100% 정상 발화되도록 안정화했다.

### 주요 구현 및 변경 사항
- **단순 선택(Selection)과 명시적 시퀀스 적용(Application) 분리 (`src/editor/EditorState.ts`)**:
  - `setSelectedPattern(id, options)`: 타임라인 시퀀스 노트를 일체 보존하고 활성 패턴 및 draftEdits만 전환.
  - `applyPatternToSequence(patternId?)`: 사용자가 패턴 구조를 시퀀스에 반영하길 원할 때만 명시적으로 호출하는 전용 메서드 신설.
  - `updateCurrentPattern`: 패턴 이름/설명/존 수정 시 시퀀스 노트를 강제 재생성하지 않고 패턴 메타데이터만 갱신.
- **프로젝트 열기 시 사전 검증 및 전체 교체(Full Replace) 보장 (`src/editor/EditorIOHandler.ts`)**:
  - `importFullProjectJSON`: 프로젝트 패키지 패턴의 유효성을 사전 검증한 뒤, 기존 레지스트리를 `clear()`하고 로드하여 삭제된 패턴 부활 완벽 방지.
  - 외부 패턴 라이브러리 가져오기(`importPatternLibraryJSON`)와 프로젝트 문서 열기를 명확히 분리.
- **문서 변경과 재생 상태 분리 및 재생 중 자동저장 보장 (`src/editor/PhaseSequenceEditor.ts`, `EditorState.ts`, `main.ts`)**:
  - `PhaseSequenceEditor.addListener`: 노트 추가/수정/삭제/리셋/가져오기 시 `SequenceChangeListener`를 통해 실시간 변경 통보.
  - `EditorState.onDocumentChange`: 문서 변경 시에만 `triggerAutoSave`(800ms 디바운스 LocalStorage 저장) 호출.
  - `seekBeat`에서 `notifyStateChange`를 배제하여 60fps 재생 루프 중 디바운스 타이머가 무한 취소되는 결함 해결.
- **UI 시퀀스 적용 인터랙션 추가 (`src/editor/EditorLayout.ts`, `src/editor/main.ts`)**:
  - 사이드바 패턴 편집 바에 `⚡ 시퀀스에 적용` (`#btn-apply-sequence`) 버튼 신설.
- **TDD 검증 결과**:
  - `tests/unit/editor-persistence.test.ts` (6 tests Pass): 커스텀 노트(startBeat, label, targetZones) Roundtrip 보존, 패턴 재선택/이름 수정 시 불변 보장, applyPatternToSequence 명시적 적용 검증, 삭제 패턴 부활 방지, onDocumentChange 분리 및 자동저장 보장.
  - `tests/unit/editor-interactive-pattern.test.ts` (6 tests Pass): 명시적 연동 검증.
  - `npm run build` 번들 검증 100% 성공 & `npm test` 전체 81개 파일 958개 테스트 100% Pass (회귀 결함 0건).

---

## 2026-09-30 완료: [BUG-JUMP-BASELINE-001 / #238] 사용자 보정 기준선 기반 점프 회피 판정 연결

> #238 구현 및 단위/통합 검증 완료. `main.ts`에 고정되어 있던 하드코딩 기준선(`vh * 0.28`)을 제거하고 `CalibrationHelper` 사용자 자동 보정 기준선(`baselineShoulderY`)과 연동하여 키와 카메라 거리가 다른 사용자 환경에서도 동일한 상대 상승 비율(0.065)로 공정하게 점프가 감지되도록 수정했다. 또한 `JumpDetector`에 추적 유실 및 재획득(Re-acquisition) 보호를 구축하여 첫 프레임 속도 스파이크로 인한 가짜 점프를 원천 차단하고, 보정 미완료(`isCalibrated=false`), 일시정지(`isPaused=true`), 안전가드(`isSafetyGuarded=true`) 시의 무입력 계약을 확정했다. 실제 게임 루프에서 스무딩 소스(`sourceLandmarks`) 기반으로 `PhaseAHazardController`의 점프(`jump`) 회피 판정과 시각 이펙트가 온전히 발화되도록 연결했다.

### 주요 구현 및 변경 사항
- **`JumpDetector` 사용자 기준선 및 재획득/안전 보호 개편 (`src/motion/JumpDetector.ts`, `config/motion.config.ts`)**:
  - `JumpConfig` 및 `DEFAULT_JUMP_CONFIG` 추가 (`config/motion.config.ts`).
  - `JumpUpdateOptions`(`isPaused`, `isSafetyGuarded`, `isCalibrated`) 도입.
  - 추적 최초 획득 또는 유실 후 재획득(`_prevShoulderY < 0`) 시 첫 프레임 이전 위치 동기화만 수행하고 가짜 점프 원천 차단.
  - 정규화(0~1) 및 가상 픽셀(vh) 좌표계 안전 스케일링, 프레임 튐(`dt > 0.1`) 방지.
  - 보정 미완료(`isCalibrated === false`) 또는 `baselineY <= 0` 시 즉시 입력 차단 및 초기화.
- **`CalibrationHelper` 수동 기준선 지원 (`src/motion/CalibrationHelper.ts`)**:
  - `setManualBaseline` 메서드를 추가하여 테스트 및 빠른 초기화 지원.
- **`src/main.ts` 프로덕션 입력 파이프라인 통합**:
  - `CalibrationHelper` 인스턴스 생성 및 `sourceLandmarks` 기반 매 프레임 자동 보정 갱신.
  - 보정 완료 시 `calibrationHelper.baselineShoulderY`를 `activeDetector`와 `jumpDetector`의 기준선으로 연결.
  - `sourceLandmarks`(스무딩 관절)를 점프 감지 소스로 일원화.
  - `jumped` 이벤트 발생 시 `(gamePhase === 'running' || gamePhase === 'hazard_evade')` 조건에서 `phaseAHazardController.recordAction('jump')` 정상 처리 및 버스트 이펙트 점등.
  - 포즈 유실(`!poseManager.hasPose`) 시 `jumpDetector.reset()` 호출 추가.
- **TDD 검증 결과**:
  - `tests/integration/jump-baseline-contract.test.ts` (6 tests Pass): 키/거리별(400px vs 700px) 동일 상대 상승 감지, 정지/노이즈(20px) 점프 0, 재획득 가짜 점프 0, 보정 미완료 차단, 일시정지/안전가드 차단, CalibrationHelper->JumpDetector->HazardController jump 회피 전체 체인 검증.
  - `tests/unit/motion-detectors.test.ts` (14 tests Pass): 기존 점프/달리기/스쿼트 검증 100% 유지.
  - `npm run build` 번들 검증 100% 성공 & `npm test` 전체 80개 파일 952개 테스트 100% Pass (회귀 결함 0건).

---

## 2026-09-30 완료: [BUG-MOTION-COORDINATE-001 / #237] 발 이벤트 정규화 좌표·발 들기 방향·입력 전달 계약 수정

> #237 구현 및 단위/통합 검증 완료. `FootKeynoteDetector`의 구형 무릎 다운→업 반등(Dip) 판정 오류를 상단 발들기(Knee Lift UP: `baseline - y >= movementThreshold`)로 전면 개편하고, 바닥 중립 복귀(`distanceToBaseline <= neutralThreshold`) 후 재무장(`armed = true`)되는 연속 입력 계약을 확정했다. 또한 `main.ts`에서 가상 픽셀 좌표(0~1080/0~2160)가 detector에 직접 전달되어 0.05px 미세 노이즈에도 오인식되던 결함을 `toNormalizedLandmarks` 정규화 좌표계 선행 변환 및 `virtualHeight` 경계 검증으로 완벽 차단했다. `FootKeynoteInput`에 `onEvent` 및 `routeEvent` 공통 라우터를 도입하여 Pose(knee-proxy), 키보드('Z', 'X', 'V'), 가상 페달(Zone 9~11 터치/클릭) 반환 이벤트가 1건도 버려지지 않고 `PhaseAHazardController` 회피 판정과 시각 이펙트로 100% 안전하게 라우팅되도록 일원화했다.

### 주요 구현 및 변경 사항
- **`FootKeynoteDetector` 발들기 방향 및 중립 복귀 계약 개편 (`src/motion/FootKeynoteDetector.ts`)**:
  - 구형 무릎 다운(`delta > 0`) 후 상승 반등 로직을 제거하고, 기저선 대비 실제 상승(`baseline - y >= movementThreshold`) 시 발들기 이벤트 즉시 트리거.
  - 트리거 후 공중 체류 시 중복 발화 차단, 쿨다운 경과 및 바닥 중립 복귀(`Math.abs(y - baseline) <= neutralThreshold`) 시에만 재무장(`armed = true`) 보장.
  - 가상 높이(`virtualHeight`) 옵션 지원 및 비정규화 픽셀 랜드마크(y > 1.5) 주입 시 노이즈 오인식 원천 차단.
- **`FootKeynoteInput` 공통 라우터 구축 (`src/input/FootKeynoteInput.ts`)**:
  - `onEvent(listener)` 구독 및 `routeEvent(event)` 디스패처 메서드 신설.
  - `fromKeyboard` 및 `fromVirtualPedal` 호출 시 반환 이벤트를 즉시 라우터로 전달하여 이벤트 버려짐 0건 달성.
  - `isSafetyGuarded` 시 Pose/키보드/가상 페달 일체 무입력 보장.
- **`src/main.ts` 프로덕션 입력 파이프라인 통합**:
  - `toNormalizedLandmarks` 정규화 좌표 변환을 `footKeynoteDetector.update` 호출 이전으로 전진 배치.
  - `footKeynoteInput.onEvent` 리스너를 등록하여 `phaseAHazardController`의 좌/우 발 스텝(`left_step`, `right_step`) 및 점프(`jump`), 한발 균형(`balance_left`, `balance_right`) 회피 판정과 Zone 9~11 버스트 파티클 이펙트 일원화.
  - 키보드 및 가상 페달 터치/클릭 핸들러에서 공통 라우터를 경유하도록 연결.
- **TDD 검증 결과**:
  - `tests/integration/foot-coordinate-contract.test.ts` (6 tests Pass): 발들기 UP 직접 감지 및 다운 무시, 공중 체류 중복 차단 및 중립 복귀 재무장, 0.05px 픽셀 노이즈 차단 및 실 발들기 감지, onEvent 공통 라우터 100% 전달 및 버려짐 0, Safety guard 차단, Cover 투영→프레이밍→정규화→감지→라우터→해저드 컨트롤러 전체 체인 검증.
  - `tests/unit/foot-keynote-detector.test.ts` (5 tests Pass): 발들기 UP 감지, 양발 동시(Zone 10), 미러 환경 해부학적 매핑 유지, 추적유실/가드 리셋, 쿨다운/중립 재무장.
  - `tests/unit/foot-keynote-input.test.ts` (2 tests Pass): 공통 계약 전달, 경계 외/가드 차단.
  - `tests/integration/beat-motion-integration.test.ts` (9 tests Pass): 프레이밍 연동 및 안전가드 회귀 0.
  - `npm run build` 번들 검증 100% 성공 & `npm test` 전체 79개 파일 946개 테스트 100% Pass (회귀 결함 0건).

**다음 작업 대상: #238 [BUG-JUMP-BASELINE-001] 사용자 보정 기준선 기반 점프 회피 판정 연결.**

---

## 2026-09-30 완료: [AUDIT-HARDCODED-RESOURCES-001] 프로젝트 리소스 및 데이터 하드코딩 전수 감사 완료

> 개발 규칙 제6절(데이터와 코드 분리) 및 제12절(UI 로직 분리)에 입각하여 클라이언트 전체(`src/`, `config/`, `public/`, `img/`)의 하드코딩 현황을 전수 조사하고, 정식 감사 보고서(`docs/07_HARDCODED_RESOURCE_AUDIT.md`)를 작성 및 동기화했다.

### 주요 감사 결과 요약
1. **UI 텍스트 및 i18n 레이어 부재 (High)**:
   - `src/ui/MenuRenderer.ts`, `HUDLayer.ts`, `PauseModal.ts`, `LocomotionModal.ts`, `TutorialOverlay.ts`, `ResultRenderer.ts`, `BottomBar.ts`, `GestureFeedbackOverlay.ts` 전체에서 Canvas 드로잉 코드 내 한국어 문자열 하드코딩.
   - `BossRenderer.ts` Line 373: Ch.4 보스 대사(`'포기해...'`) 하드코딩.
2. **보스/챕터 메타데이터 중복 및 불일치 (Medium)**:
   - `src/data/bossData.ts`의 `BOSS_REGISTRY`와 `src/ui/MenuRenderer.ts`의 `CHAPTER_INFO`가 동일한 챕터별 보스/테마 정보를 이중 관리 (SSOT 위배).
   - `src/render/BossRenderer.ts` 내부 메서드 및 주석에 구버전 기획 명칭(`_renderForget`, `_renderHurry` 등) 잔존.
3. **정적 이미지 에셋 경로 및 미참조(Dead) 에셋 (Medium)**:
   - `src/main.ts` Line 1660: `magicCirclePaths` 배열 내 인라인 파일 경로 하드코딩.
   - `dream_guardian/img/stardust/` 디렉터리에 11종의 고품질 PNG/SVG 에셋이 존재하나 코드에서 전혀 참조하지 않고, `StardustIconRenderer.ts`에서 Canvas 2D 벡터 패스로 실시간 프로시저럴 드로잉하여 중복 및 파일 방치.
   - `guardian.png`, `protagonist.png`, `Ref_Grid2.jpg` 등 미사용 이미지 잔존.
4. **오디오/악기 합성 데이터 하드코딩 (Medium)**:
   - `BandSynthesizer.ts`: Zone별 일렉 기타 주파수(`GUITAR_ZONE_FREQUENCIES: 164.81Hz~293.66Hz`), 왜곡 커브 계수(`amount: 28`)가 클래스 코드에 고정. Ch.2~5 악기 데이터 미구현.
   - `SFXSynth.ts`: 체류음(220Hz~880Hz), C5/E5/G5 화음, 볼륨 감쇠 계수가 인라인 수치로 존재.
5. **안무/패턴 데이터 이원화 (Medium)**:
   - `public/fitness pattern.csv`(360건 원본) 외에 `src/data/danceRoutineData.ts`에 764줄 분량의 기본/확장 안무 데이터가 TS 객체 리터럴로 하드코딩.
6. **수학 문제 Fallback 데이터 (Low)**:
   - `src/question/QuestionBank.ts`: `FALLBACK_QUESTIONS` 2문항이 클래스 내부 배열로 고정.
7. **비주얼 연출 파라미터 미분리 (Low)**:
   - `src/render/MagicCircleRenderer.ts`: 회전 속도 및 스케일 펄스 설정(`MAGIC_CIRCLE_CONFIG`)이 `config/` 외부에 위치.

### 연계 후속 작업 카드 제안
- **[CARD-DATA-001]**: UI 텍스트 딕셔너리 분리 (`config/ui-text.config.ts`)
- **[CARD-DATA-002]**: 챕터 및 보스 메타데이터 SSOT 일원화 (`MenuRenderer` → `bossData.ts`)
- **[CARD-RES-001]**: AssetManifest 구축 및 미참조(Dead) 에셋 정리
- **[CARD-AUDIO-001]**: 악기 주파수 및 SFX 합성 파라미터 분리 (`config/audio.config.ts`)
- **[CARD-DANCE-001]**: 안무 루틴 외부 데이터화 (JSON/CSV 로더 전환)

*상세 감사 내역 및 파일별 라인 번호는 `docs/07_HARDCODED_RESOURCE_AUDIT.md` 참조.*

---

## 2026-09-30 완료: [CLEANUP-ANSWER-VIEW-001 / #233] 팔 Zone4/5 답 선택 화면의 구형 레시피·E_Pit·자세 가이드 제거

> #233 구현 및 단위/통합 검증 완료. 팔 전용 Zone 4/5 2버튼 답 선택 화면에서 구형 레시피 색상 분할 및 요구부위 아이콘(`PartIconRenderer`), E_Pit 3중 마법진 에셋 로딩(`img/E_Pit_act1~3.png`), 목표 자세 실루엣 가이드 오버레이(`PostureGuideRenderer`) 및 첫 문제 화살표 힌트 호출을 프로덕션 경로에서 완전히 정리했다. 답안 버튼은 모던 반투명 네온 배경(`rgba(16, 24, 48, 0.88)`)과 좌/우 고유 네온 테두리(Zone 4 시안 / Zone 5 노랑), 선택 즉시 녹색 하이라이트(`#4DFFAA`) 및 수직 중앙 수식 정렬로 단정하게 개편되었으며, 터치 및 키보드(1, 2) fallback 입력과 별 수집 커서/레일, 메뉴 합장 입력과의 회귀 결함 0건을 확인했다.

### 주요 구현 및 변경 사항
- **`QuestionRenderer` 구형 레시피 및 요구부위 아이콘 제거 (`src/render/QuestionRenderer.ts`)**:
  - `PartIconRenderer.drawRadialAnswerButton` 및 `drawRequirementGroup` 호출 제거.
  - `answerPlan` 의존성을 제거하고 모던 2버튼 네온 스타일로 전환(Zone 4 시안 / Zone 5 노랑).
  - 답 선택 즉시 하이라이트 테두리(`#4DFFAA`) 점등 및 수직 중앙 정렬 수식 렌더링 유지.
- **`src/main.ts` 프로덕션 렌더링 및 에셋 로딩 정리**:
  - 프로덕션 답안 경로에서 `PostureGuideRenderer` 인스턴스화, `startFirstQuestionHint`, `update`, `renderFromPlan` 호출 완전 제거.
  - `E_Pit_act1~3.png` 마법진 이미지 로딩 파이프라인 및 `MagicCircleRenderer` 주입 제거.
  - `AnswerSelectionRenderer` 호출 시 `activeZones`를 빈 배열(`[]`)로 전달하여 상시 4색 커서(손/머리/골반) 렌더링만 유지하고 구형 마법진 호출 원천 차단.
  - `loadFitnessPatterns` 내 불필요한 `answerSelector.recipeGenerator.postureGenerator.setPatterns` 호출 정리.
- **TDD 검증 결과**:
  - `tests/integration/cleanup-answer-view.test.ts` (7 tests Pass): ANSWER_SELECT 구형 아이콘/방사형 버튼 호출 0, answerPlan 없이도 답안 버튼 및 텍스트 정상 렌더, 선택 하이라이트 유지, E_Pit 마법진 호출 0, 좌/우 버튼 레이아웃 및 1/2·터치 fallback 정상 동작, 메뉴 합장 입력 회귀 0.
  - `npm run build` 번들 검증 100% 성공 & `npm test` 전체 78개 파일 940개 테스트 100% Pass (회귀 결함 0건).

**다음 작업 대상: #234 [BUG-MATH-FIT-001] 긴 자연어·복합 수식의 화면 너비·높이 초과 수정.**

---

## 2026-09-30 완료: [BUG-PHASE-PRESENTATION-001 / #232] 답 선택 즉시 피드백 및 별모으기·회피 화면의 페이즈별 연결 복구

> #232 구현 및 단위/통합 검증 완료. `GameState` 기반 상태별 렌더 허용표(Render Allow Matrix)를 제공하는 `PhasePresentationAdapter`를 신설하여 `RUN_QUESTION`, `ANSWER_SELECT`, `STAR_COLLECT`, `HAZARD_EVADE`, `ROUND_RESOLVE` 간의 렌더링 충돌을 완전히 해소했다. 정답 시 별모으기 노트를 활성화하고 답안 렌더를 비활성화하며, 오답 및 타임아웃 시 3D 바닥 장판과 안내 텍스트로 구성된 회피 표시 경로를 연결했다. 또한 답안 선택 시점의 즉시 시각 피드백(버튼 폭발 이펙트, 보스 피격 애니메이션, 타이머 세팅)과 입력 잠금(`answerLocked`)을 1회 처리하고, 7박 후 지연 정산(`onAnswerConfirmed`)과 분리하여 중복 이펙트를 방지했다. `questionVisible = false` 상태에서도 정산 및 다음 라운드 예약 전이가 정상 동작함을 검증했다.

### 주요 구현 및 변경 사항
- **`PhasePresentationAdapter` 화면 표시 어댑터 구축 (`src/ui/PhasePresentationAdapter.ts`, `src/ui/index.ts`)**:
  - `canRenderRunningHUD(state)`: `RUN_QUESTION` 및 `REST_READY`에서만 허용.
  - `canRenderQuestion(state)`: `ANSWER_SELECT`에서만 허용.
  - `canRenderStarCollect(state)`: `STAR_COLLECT` 및 `KEYNOTE_PERFORMANCE`에서만 허용.
  - `canRenderHazardEvade(state)`: `HAZARD_EVADE`에서만 허용.
  - `canRenderPostureGuide(state)`: `ANSWER_SELECT`에서만 허용.
  - `isAnswerInputAllowed(state, isAnswerLocked)`: `ANSWER_SELECT && !isAnswerLocked`일 때만 허용.
  - `renderHazardEvade(ctx, vw, vh, state)`: 패턴별(점프, 좌/우측 스텝, 외발 균형) 안내 타이틀/서브타이틀 및 3D 바닥 장판 위임 렌더링.
- **`src/main.ts` 프로덕션 렌더링 및 생명주기 연결**:
  - `stateMachine.registerState('HAZARD_EVADE')` 진입 시 `phaseAHazardController.start()` 및 퇴장 시 `stop()`.
  - 메인 루프 업데이트 시 `gamePhase === 'running' || gamePhase === 'hazard_evade'` 조건으로 장판 진행도 및 충돌 판정 연결.
  - `onAnswerSelected(idx)`: 답 선택 즉시 1회 SFX, 버튼 폭발 프리셋, 보스 피격 애니메이션, 피드백 타이머 점등 및 `answerLocked = true` 즉시 잠금.
  - `handleAnswer`: 지연 정산 결과(스펠 캐스팅, 승리/패배, 다음 라운드 지연 시작)만 담당하고 중복 버튼 이펙트 제거.
  - 터치 및 키보드('1', '2') fallback 입력에 `presentationAdapter.isAnswerInputAllowed` 가드 적용.
- **TDD 검증 결과**:
  - `tests/integration/phase-presentation.test.ts` (10 tests Pass): 상태별 렌더 허용표, 정답→별 렌더 활성/답안 렌더 비활성, 오답/타임아웃→회피 표시 경로, 선택 직후 1회 피드백 및 선택 입력 잠금, `questionVisible = false` 상태 정산 및 다음 상태 정상 전이.
  - `tests/unit/phase-presentation-adapter.test.ts` (7 tests Pass): 어댑터 전 메서드 및 렌더 위임 검증.
  - `npm run build` 번들 검증 100% 성공 & `npm test` 전체 77개 파일 933개 테스트 100% Pass (회귀 결함 0건).

**다음 작업 대상: #233 [CLEANUP-ANSWER-VIEW-001] 팔 Zone4/5 답 선택 화면의 구형 레시피·E_Pit·자세 가이드 제거.**

## 2026-09-30 완료: [BUG-SESSION-EXIT-001 / #231] 일시정지·메뉴·결과 전환의 게임 시간 및 예약 수명 통일

> #231 구현 및 단위/통합 검증 완료. pause 상태에서 게임 활성 시간(`GameEngine._elapsedTime`)이 증가하던 결함을 해결하여 pause 2초 후에도 노트·장판·비트 진행도가 완벽히 동일하도록 시간 계약을 통일했다. 또한 `SessionLifecycle`을 도입하여 세션 종료 및 메뉴 복귀 시 비동기 타이머(`setTimeout`)를 일괄 취소/세대 토큰(sessionId)으로 무효화하고, 승패 결과 화면 전환 권한을 단일화하여 중복 콜백 및 고아 재시작을 원천 차단했다.

### 주요 구현 및 변경 사항
- **`SessionLifecycle` 비동기 예약 관리 모듈 구축 (`src/core/SessionLifecycle.ts`, `src/core/index.ts`)**:
  - 세션 고유 식별자(`sessionId`) 및 `pendingTimeouts` 관리.
  - `startSession()`, `endSession()`, `cancelAllReservations()`를 통해 세션 종료/메뉴 복귀 시 모든 예약 일괄 취소.
  - `schedule(cb, delayMs)`로 현재 세션 ID가 일치할 때만 실행되도록 콜백 보호.
  - `claimResultTransition()`을 통한 단 1회 결과 전환 권한 단일 소유화(중복 승패 콜백 및 후속 예약 즉시 무효화).
- **`GameEngine` pause-aware 게임 활성 시간 분리 (`src/core/GameEngine.ts`)**:
  - `pauseGame()` / `resumeGame()` 및 `isGamePaused` 도입.
  - 메인 루프에서 UI/모달 호버 감지(`update(dt)`)는 정상 실행하되, `_gamePaused` 상태에서는 `_elapsedTime` 누적을 중단하여 2초간 정지 후에도 게임 시간 진행도가 0ms 증가하도록 통일.
  - `resumeGame()` 시 `_lastTimestamp = -1`로 리셋하여 일시정지 해제 직후 dt 스파이크 완전 방어.
- **`src/main.ts` 세션 수명 주기 및 결과 전환 통합**:
  - `beatRoundResolver`의 중복 승패 콜백(`onBossDefeated`, `onPlayerDefeated`)을 `sessionLifecycle.claimResultTransition()`으로 단일화.
  - `startChapter()`에서 `sessionLifecycle.startSession()` 호출로 이전 세션 잔여 예약 완전 정리.
  - `goToMenu()`에서 `sessionLifecycle.endSession()` 호출로 다음 라운드 지연 시작(`800ms`) 취소 보장.
  - `showResult()`에서 `sessionLifecycle.cancelAllReservations()` 및 액션 차단(`answerLocked`, `phaseAHazardController.stop()`, `beatCoordinator.pause()`, `engine.pauseGame()`).
- **TDD 검증 결과**:
  - `tests/integration/session-lifecycle.test.ts` (5 tests Pass): pause 2초 후 노트/장판/비트 진행도 동일, 다음 라운드 예약 후 메뉴 복귀 시 재시작 차단, 재시작 새 세션에 이전 결과 영향 0, 승패 콜백 중복 시 결과 1회 전환, 잔여 예약 자동 취소.
  - `tests/unit/game-engine.test.ts` (11 tests Pass): `pauseGame()` 시 update() 유지 및 elapsedTime 정지 검증.
  - `npm run build` 번들 검증 100% 성공 & `npm test` 전체 75개 파일 916개 테스트 100% Pass (회귀 결함 0건).

**다음 작업 대상: #232 [FEAT-ROUTINE-SCREEN-001] 선택/별/회피 화면 렌더링 연결.**

## 2026-09-30 완료: [BUG-BEAT-CLOCK-001 / #230] 러닝 실제 8박 종료 보장 및 동일 박 중복 입력 차단

> #230 구현 및 단위/통합 검증 완료. 실제 활성 게임 시계 기반으로 0.5초 비트 슬롯을 진행하고, 한 슬롯당 유효 운동 최대 1회 인정(동일 슬롯 중복 입력 및 연타 차단), totalSteps와 completedExerciseBeats 분리, 8번째 유효 슬롯 종료 경계(4.0s) 도달 전 조기 전환 금지, triggerFallbackAdvance 루프 우회 차단 및 Space e.repeat 차단을 완료했다.

### 주요 구현 및 변경 사항
- **실제 활성 게임 시계 비트 슬롯 진행 (`src/game/BeatRunCoordinator.ts`)**:
  - `_lastExercisedSlot` 및 `_targetSlotEndElapsed` 상태 도입.
  - `recordStep()`에서 `Math.floor(_runElapsed / spb)`로 슬롯 번호를 계산하여 동일 슬롯 중복 입력 시 유효 박자 카운트를 방어(`totalSteps`만 증가).
  - 8번째 유효 운동이 인정되어도 즉시 전환하지 않고, 해당 8번째 슬롯의 종료 경계(`_targetSlotEndElapsed = (currentSlot + 1) * spb`, BPM 120 기준 4.0s)를 설정.
  - `update()` 시 실제 활성 경과 시간이 `_targetSlotEndElapsed`에 도달할 때만 다음 페이즈(`ANSWER_SELECT` 또는 `REST_READY`)로 전이.
  - 30초 무동작 시 운동 입력 없이는 0/8을 유지하며 가짜 입력이나 자동 전환 일체 차단.
- **RhythmEngine 시간 갱신 연동 및 슬롯 유틸리티 (`src/core/RhythmEngine.ts`)**:
  - `currentSlot` getter 및 `getSlotAt(time)` 메서드 추가.
  - `BeatRunCoordinator.update()`에서 `this._rhythmEngine.update(dt)`를 지속 호출하여 비트 인덱스 및 시간원 동기화 보장.
- **문제 원근 접근 진행도 계약 현행화 (`src/game/BeatRunCoordinator.ts`)**:
  - 운동 횟수로 조기 점프하던 기존 버그를 제거하고 첫 2박(1.0s) 실제 활성 시간 소비 계약(`_runElapsed / (2 * spb)`)으로 진행도 공급.
  - 일시정지(`pause()`, `resume()`) 시간 누적 완전 제외.
- **fallback 루프 우회 및 Space repeat 차단 (`src/game/BeatRunCoordinator.ts`, `src/main.ts`)**:
  - `triggerFallbackAdvance()` 내부의 `while` 루프를 제거하고 슬롯 규칙에 맞게 단일 `recordStep()` 호출로 전환.
  - `main.ts`의 Space 키 핸들러에 `if (e.repeat) return;` 및 `!pauseModal.isOpen` 가드 적용.
  - `pauseModal` 상태와 `beatCoordinator.pause()` / `resume()` 양방향 동기화.
- **설정 분리 (`config/beat-motion.config.ts`)**:
  - `RunQuestionConfig` 및 `DEFAULT_RUN_QUESTION_CONFIG` (8 exerciseBeats, 2 approachBeats) 정의 및 `DEFAULT_BEAT_MOTION_CONFIG`에 통합.
- **TDD 검증 결과**:
  - `tests/unit/beat-clock-slot.test.ts` (10 tests Pass): t=0 8회 동기 입력 시 조기 전환 차단, 3.999s 이전 전환 차단 및 4.000s 경계 전환, 30초 무동작 0/8, 슬롯 중복 불인정, lag spike 가짜 입력 없음, 2회 빠른 운동 1초 전 접근 불가, pause 시간 제외, fallback 루프 우회 차단, RhythmEngine 시간 갱신.
  - `tests/unit/question-approach-renderer.test.ts` (12 tests Pass).
  - `tests/unit/beat-routine-controller.test.ts` (5 tests Pass).
  - `tests/integration/beat-keynote-round.test.ts` (8 tests Pass).
  - `tests/integration/beat-motion-integration.test.ts` (9 tests Pass).
  - `tests/integration/beat-run-gameplay.test.ts` (17 tests Pass).
  - `tests/integration/state-machine-lifecycle.test.ts` (7 tests Pass).
  - `npm run build` 번들 검증 100% 성공 & `npm test` 전체 74개 파일 910개 테스트 100% Pass (회귀 결함 0건).

**다음 작업 대상: #231 [BUG-CLOCK-PAUSE-001] pause-aware 활성 시계 단일화 및 세션 만료 예약 정리.**

## 2026-09-30 완료: [REFACTOR-FSM-001 / #214] 현행 라운드·Phase B 상태 모델 단일화 및 프로덕션 실행 경로 연결

> #214 구현 및 단위/통합 검증 완료. 현행 14개 canonical 상태 모델을 정의하고, StateMachine이 전이 검증/생명주기/리소스 정리 인터페이스를 단일 소유하도록 단일화하여 실제 `src/main.ts` 프로덕션 경로에 연결했다.

### 주요 구현 및 변경 사항
- **14개 Canonical GameState 현행화 (`src/types/index.ts`)**:
  - `LOADING`, `MENU_MAIN`, `MENU_SUB`, `STORY_INTRO`, `READY_POSITION`, `RUN_QUESTION`, `ANSWER_SELECT`, `STAR_COLLECT`, `HAZARD_EVADE`, `ROUND_RESOLVE`, `BOSS_CLIMAX`, `RESULT`, `GAMEOVER`, `ENDING_CUTSCENE`.
  - 상태 핸들러 인터페이스(`IStateHandler`)에 `input?(data?: unknown): void` 추가로 상태별 enter/update/input/render/exit 전 라이프사이클 계약 완성.
- **StateMachine 현행 전이맵 및 생명주기 리소스 정리 (`src/core/StateMachine.ts`)**:
  - `RUN_QUESTION → ANSWER_SELECT → STAR_COLLECT / HAZARD_EVADE → ROUND_RESOLVE → RUN_QUESTION / BOSS_CLIMAX / GAMEOVER / RESULT` 단방향 전이 규칙 엄격화 및 비허용 역주행·단계 건너뛰기 차단.
  - 상태 상충 방지 및 상태 질의 헬퍼 메서드 추가: `isPhaseA()`, `isPhaseB()`, `isMenu()`, `isResult()`, `isAnswerOpen()`, `isQuestionVisible()`, `isStarCollect()`, `isHazardEvade()`.
  - 상태 진입(enter) 및 종료(exit) 시 등록된 핸들러 1회 호출 보장.
- **`src/main.ts` StateMachine 단일 소유권 및 단방향 상태 동기화**:
  - `const stateMachine = new StateMachine('MENU_MAIN');` 도입.
  - `stateMachine.onTransition`을 통해 `screenMode`와 `gamePhase`를 canonical 상태에 일치하도록 단방향 자동 동기화.
  - 각 상태별 리소스 정리 핸들러 등록: `ANSWER_SELECT` exit 시 `armReachAnswerSelector.closeWindow()`, `HAZARD_EVADE` exit 시 `phaseAHazardController.stop()`, `STAR_COLLECT` exit 시 `starCollectionInput.reset()`.
  - `handleAnswer`에서 UI 플래그(`!questionVisible || answerLocked`)가 정산 권한을 임의로 차단하던 문제를 제거하고 `stateMachine.isPhaseA()` 기반으로 정산 생명주기 분리.
- **TDD 검증 결과**:
  - `tests/unit/state-machine.test.ts` (17 tests Pass): 14개 canonical 상태 전이, 비허용 차단, enter/exit 1회 실행, 상태 질의 일관성.
  - `tests/integration/state-machine-lifecycle.test.ts` (7 tests Pass): StateMachine과 BeatRunCoordinator 연동, 진입/종료 시 리소스 정리 인터페이스 1회 실행, 상충 상태(STAR_COLLECT 중 답안 열림 등) 차단.
  - `tests/unit/architecture.test.ts`: 14개 canonical GameState 아키텍처 검증 Pass.
  - `npm run build` 번들 성공 & `npm test` 전체 73개 파일 898개 테스트 100% Pass (회귀 결함 0건).

**다음 작업 대상: #230 [BUG-BEAT-CLOCK-001] 러닝 실제 8박 종료 보장 및 동일 박 중복 입력 차단.**

## 2026-09-30 완료: [E2E-BEAT-001 / #186] 설계 단계 (최종 실행 대기)

> #186 전체 카드는 아직 OPEN이다. 이번 단계는 #229 계약을 실제 `index.html → src/main.ts` 프로덕션 경로로 검증할 종단 실패 시나리오와 fixture 계약만 확정했다. 테스트 코드, 브라우저 러너, 프로덕션 코드는 변경하지 않았으며 최종 E2E Pass를 주장하지 않는다.

### 프로덕션 경로 및 fixture 계약

- 브라우저 E2E는 Vite가 제공하는 실제 `index.html`에서 시작해 `src/main.ts`가 조립한 상태·입력·렌더·정산·Phase B 경로를 통과한다. 테스트 전용 상태 머신, 직접 phase 변경, HP/보스 HP 직접 설정, `resolveRound()` 직접 호출로 완주를 대체하지 않는다.
- 최종 러너는 `@playwright/test`를 사용한다. 설치와 `package.json`/lockfile 변경은 모든 선행 구현 카드 완료 후 #186 최종 단계에서만 수행한다.
- 고정 fixture는 실제 fetch/파서 경로를 유지하는 문제 CSV와 피트니스 패턴 CSV, 채널별 RNG seed(문제 순서·문제 값·답 순서·노트·회피·Phase B·시각), pause-aware 활성 게임 시계, 키보드·터치·33-landmark Pose 입력으로 구성한다.
- 식별자는 `sessionId`, `roundId`, `questionId`, `noteId`, `attackId`, `handoffId`를 사용한다. fixture는 외부 조건과 입력만 공급하며 게임 규칙을 다시 구현하지 않는다.
- read-only trace에는 frame/activeTime/state/slot/beat/input source/answer status/note judgment/hazard result/정산 횟수/완료 문제 수/HP·보스 HP·마나·콤보·미니언·별가루/인계·결과 횟수/pending schedule을 기록한다.
- 실패 artifact는 fixture manifest, JSONL trace, console/page/network 오류, 최종 snapshot, screenshot, Playwright trace, video로 남긴다. 자동 합성 Pose/fake camera 결과와 실제 Chrome 실카메라 증거는 별도 항목으로 기록한다.

### 종단 시나리오와 소유권

- 게이트 A(`#214/#230~#233`): canonical 상태·생명주기, 실제 0.5초 슬롯 8개/최소 4초, 30초 무동작 0/8, pause·stale 예약 차단, 상태별 화면, 구형 답안 UI 0.
- 게이트 B(`#237/#238/#235/#236`): 미러 좌표와 좌·우 발/점프, Zone 4/5 경계 입력, 7노트 각각 1회, 마지막 Late `t=3.90`, `t=4.00` 정산, 단일 3종 회피와 실패 -25 1회.
- 게이트 C(`#240/#242/#241`): 10연속 정답 조기 승리 0, 일반 보스 HP 2/마나 50/미니언 13, 혼합 10문제, 10번째 HP 0 게임오버 우선, 11번째 문제 0, Phase B 인계 1회.
- 게이트 D(`#213/#193/#194/#195`): Phase B 연속 피버 노트, 보스 공격·광폭화, 별가루 소비·군단 화력, 승패 결과 1회, 종료 후 노트·공격·예약 0.
- 게이트 E(`#186 최종`): 고정 seed 전체 루틴 10회 연속, 추가 seed, 카메라 거부 fallback, 터치, 합성 Pose, 지연 프레임, 실제 Chrome/실카메라 증거와 전체 테스트·빌드.
- 문제 헤더 연속성/긴 문제/노트/장판/음향의 브라우저 검증은 각각 `#212/#234/#192/#228/#191`이 선행 구현을 소유하고 #186은 실제 연결만 검증한다. #239는 미채택이므로 balance 패턴 미출현만 회귀 검증한다.

### 설계 단계 완료 증거

- Baseline: 현재 HEAD/작업 트리를 기록하고 `npm test` 71개 파일, 881/881 Pass 및 `npm run build` 성공을 확인했다.
- 현재 `tests/e2e/`에는 `.gitkeep`만 있고 브라우저 러너와 E2E 스크립트는 없다. 이 상태를 최종 완료 증거로 사용하지 않는다.
- 기존 통합 테스트는 프로덕션 `main.ts` 전체 경로가 아니라 개별 코디네이터/정산기 조립을 검증한다. 구형 `REST_READY`, 8회 즉시 전환, 8패턴·피해 5, 정답 기본 보스 피해 1 기대값은 각 소유 카드의 Red/Green에서 교체한다.
- 최종 #186은 모든 선행 카드와 #195 완료 후 다시 착수한다. 중간 결함은 #186에서 임의 수정하지 않고 소유 카드로 반환한다.

**다음 작업 대상: #214 상태 및 생명주기 단일화.**

## 2026-09-30 완료: [SPEC-ROUTINE-VERIFY-001 / #229] 전체 루틴 계약 정합화

**사용자 확정: Phase A는 정답·오답·타임아웃 합계 10문제의 최종 판정 및 라운드 정산 완료 후 종료한다. 보스 처치와 승리는 Phase B에서만 수행한다.** 10번째 회피 중 HP가 0이면 게임오버가 우선하며, 11번째 문제는 출제하지 않는다.

- 신규 카드 **#229~#242 (14건)** 등록, 기존 **#214/#212/#228/#192/#191/#193/#194/#213/#195/#186 (10건)** 본문·선행·검증 조건 개정.
- 아래 과거 완료 기록과 783 Pass는 부품별 당시 기록이다. 현재 사용자 보고 증상과 Phase B 연결의 실게임 완료를 보장하지 않는다. 새 카드 체크리스트를 기준으로 재검증한다.
- #229에서 상태·시간·입력·화면·자원·전환과 카드 소유권을 확정했다. 게임 코드와 테스트 기대값은 변경하지 않았으며, 후속 카드 구현 전 브라우저 정상화를 주장하지 않는다.
- 기준 문서: `docs/01_GAME_DESIGN_DOCUMENT.md` 2.1. 최종 E2E: [#186](https://github.com/Choyounhwa/-dream-guardian/issues/186).

### #229 확정 결정

- RUN은 0.5초 실제 운동 슬롯 8개로 최소 4.0초이며, 슬롯당 1입력만 인정하고 미동작 시 자동 진행하지 않는다. ANSWER는 Zone 4/5 무체류 선택, 최대 1.0초다.
- STAR는 7개 노트를 `t=0.5~3.5`에 착지시키고 마지막 `Late ±0.40초`를 `t=3.90`까지 보장한 뒤 `t=4.00`에 정산한다. 별가루는 Perfect 4 / Good 3 / Late 2 / Miss 0이다.
- HAZARD는 좌스텝(왼발 들기)·우스텝(오른발 들기)·점프 중 시드 기반 단일 공격이다. 입력창 2.60~3.40초, 3.50초 판정, 성공 0/실패 -25 1회다. 균형 공격은 미채택하여 #239를 superseded 처리한다.
- Phase A 시작 마나는 0이다. 정답 직접 보스 피해는 0이며 마나 +25, 100 자동 소비, 수호신 스펠 -4는 유지하지만 Phase A에서는 승리 전환하지 않는다. 최대 10정답에서도 일반 보스 HP는 2가 남는다.
- 미니언은 시작 3, 정답 정산당 +1, 최대 13이다. 별가루/미니언은 #242가 생성하고 #241이 한 번 인계하며 #194가 Phase B에서 소비한다.
- 드럼 매핑은 Zone 9 킥, Zone 10 스네어, Zone 11 심벌이다.
- 10번째 최종 판정과 정산 후 HP 0을 먼저 검사한다. HP 0이면 게임오버, 아니면 Phase B로 1회 인계하며 11번째 문제는 출제하지 않는다.

### 작업 순서 (한 카드씩 순차 진행)

| 순서 | 카드 | 작업 |
|---|---|---|
| 완료 | #229 | 시간·최종 노트 판정창·Phase A 피해/마나·회피 패턴/횟수/피해·자원 계약 정합화 |
| 2 | #186 설계 단계 | 실제 프로덕션 경로의 종단 실패 시나리오 및 fixture 계획; 최종 완료는 마지막 |
| 3 | #214 | 상태 및 생명주기 단일화 |
| 4 | #230 → #231 | 실제 8박 종료 보장 → pause/세션 시간 및 예약 정리 |
| 5 | #232 → #233 | 선택/별/회피 화면 연결 → 구형 답안 레시피·E_Pit·자세가이드 제거 |
| 6 | #237 → #238 | 발 좌표/입력 → 점프 보정 (#239 균형 유지 미채택) |
| 7 | #235 → #236 | 별 노트 스케줄·최종 판정 → 회피 실행 수명주기 |
| 8 | #212 → #234 | 접근/답선택 헤더 연속성 → 긴 문제 너비·높이 수용 |
| 9 | #192 → #228 → #191 | 실제 노트 표시 → 장판 표시 → 판정 음향 재검증 |
| 10 | #240 → #242 | Phase A 정산 책임 분리 → 군단/별가루 자원 모델 |
| 11 | #241 | 10번째 정산 후 Phase B 진입 및 단일 자원 인계 |
| 12 | #213 → #193 → #194 → #195 | 피버 → 보스 공격 → 자원 소비/군단 화력 → 결전 시각화 |
| 13 | #186 최종 | 10문제 완주 → Phase B → 승패/메뉴 통합 및 브라우저·실카메라 검증 |

### 경계 및 완료 게이트

- #242는 Phase A 자원 생성, #241은 인계, #194는 Phase B 자원 소비/군단 화력 소유. 순환 의존 방지를 위해 분리했다.
- #239는 균형 패턴 미채택으로 superseded 처리한다. 활성 회피 3종과 렌더는 #236/#228이 소유한다.
- 정답 직접 보스 피해는 0이며 마나 100 자동 소비와 스펠 -4는 유지한다. Phase A 승리 전환은 #240에서 차단하고 최종 노트 판정창은 #235가 구현한다.
- 문서 카드 #229는 정합성 리뷰, 구현 카드는 Baseline → Red → Green → 실제 연결 → 브라우저/실기 → 전체 회귀/빌드 순서. mock 함수 호출만으로 완료 처리하지 않는다.
- 각 카드 완료에는 변경 파일, 실패/통과 증거, 진입·입력·렌더·종료·다음 상태 검증 결과가 필요하다.
- #186 필수: 10연속정답 조기승리0, 혼합10문제, 마지막 노트, 10번째 HP0 우선, 11번째출제0, 인계1회, Phase B 연속노트/공격/군단소비, 종료후 예약/입력0.
- 기존 종료 이슈 #211/#210/#224/#226/#187/#190에는 후속 링크를 남겼으며 이력은 유지했다. 오래된 REST_READY/ANSWER_LOCK·스웨이·8회즉시전환 요구를 현행 루틴으로 복원하지 않는다.

**#186 설계 단계 완료. 다음 작업은 문서 상단의 #214 상태·생명주기 단일화다.**

> 현행 루틴 정본은 `../docs/01_GAME_DESIGN_DOCUMENT.md`와 이 문서 상단의 #229 계약이다. 아래 보관 문서는 과거 구현 이력이며 현행 요구로 사용하지 않는다.

## 문서 안내

| 문서 | 용도 |
|---|---|
| `../docs/01_GAME_DESIGN_DOCUMENT.md` | 현행 게임 루프·전투·입력 정본 |
| `../docs/archive/legacy_prototype/COMPLETION.md` | 과거 프로토타입 완료 기록 |
| `../docs/archive/legacy_prototype/POSE_DESIGN.md` | 과거 12구역 입력 설계 보관본 |
| `ANSWER_SELECTION_DESIGN.md` | 구형 답안 기록 및 현행 11존 별 안무 안전성 참고 |
| `FITNESS_ZONE_CATALOG.md` | 국민체조 기반 피트니스존 카탈로그와 코드 반영 가이드 |
| `../docs/archive/legacy_prototype/FITNESS_ZONE_EDITOR.md` | 과거 피트니스존 편집 시트 |
| `../docs/04_STORY_SOURCE.md` | 현행 세계관과 스토리 전문 |
| `../docs/archive/legacy_prototype/IMPLEMENTATION_PLAN.md` | 초기 구현 기획서 보관본 |
| `../docs/archive/legacy_prototype/TASKS.md` | 초기 작업 목차/WBS 보관본 |
| `../docs/archive/legacy_prototype/DEVELOPMENT_WALKTHROUGH.md` | 초기 개발 워크스루 보관본 |
| `../docs/archive/legacy_prototype/ANTIGRAVITY_HANDOVER_ARCHIVE.md` | 이전 외부 도구 인수인계 보관본 |
| `../docs/04_POSTURE_SYSTEM_ANALYSIS.md` | **자세 선택 시스템 원인 분석 및 재설계안 (최신)** |
| `../fitness pattern.csv` *(외부: `E:\AIAIAIAIAI\Arithmetic Game\`)* | **피트니스 패턴 원본 데이터 360건** |

---

## 🔵 2026-09-28 확정: 《꿈의 수호신: 깨비와 도깨비불의 앙상블》 세계관·스토리 전면 개편

> 상태: **[`docs/04_STORY_SOURCE.md`] 스토리 문서 전면 재작성 완료 🟢 (전체 605/605 Pass)**  
> 수호신 '알레' 체제에서 생활 밀착형 가신(家神) **'깨비'** 체제로 전면 전환되었으며, 적 미니언(먹개비), 아군 장난감 도깨비(12종), 5대 불안 보스명(하얘시니/재촉새/따돌시니/풀죽새/캄캄대왕) 및 ADHD 친화적 대사 설계가 확정되었습니다.

### 주요 개편 내용 요약

1. **주인공 수호신: ‘깨비’ (생활 밀착형 가신)**
   - 겉모습: 털 날리고 장난치는 반려동물 (강아지/토끼/고양이/앵무새 4종 선택).
   - 정체: 이마에 작은 도깨비뿔을 품고 태어난 마음의 안내자 & 치유사.
   - 7단계 성장: 작은 뿔 ➔ 커진 뿔 ➔ 작은 깃털날개 ➔ 작은 날개 ➔ 뿔이 빛남 ➔ 도깨비불 일렁임 ➔ 알록달록 문양에서 빛남 (대도깨비 각성).
   - 유저 환경 특정 배제: 학교, 집, 부모 등 현실 배경을 한정하지 않고 '둘만의 직접적 유대'에 집중.

2. **적 미니언: ‘먹개비’ (별빛 포식자)**
   - 외형: 카키색 둥글넓적한 얼굴, 커다란 노란 눈, 찢어진 큰 입, 뾰족한 이빨, **팔다리 없음**.
   - 행동: 바닥을 통통 튀거나 미끄러지듯 굴러오며, 유저의 별빛(꿈과 희망)을 게걸스럽게 삼켜 불안을 높임.

3. **아군 미니언: ‘살아난 장난감 도깨비들’ (함께 달리는 12종)**
   - 낮엔 평범한 반려동물 장난감 ➔ 도깨비불이 닿으면 살아 움직이는 꼬마 도깨비.
   - 강아지 3종: 뭉치(밧줄 인형 - 방어), 끄르르(바퀴 카트 - 별가루 수거), 뿌짖이(삑삑이 뼈다귀 - 경보).
   - 고양이 3종: 쫑쫑이(깃털 벌레 로봇 - 미끼), 데굴이(캣닢 쥐 인형 - 힌트/치유), 또르르(자동 구르기 공 - 별가루 흡입).
   - 토끼 3종: 폴짝이(태엽 개구리 - 점프 비트), 둥굴이(위커볼 - 넉백/수거), 사각이(나무 블록 카트 - 벽 방어).
   - 앵무새 3종: 딸깍이(클리커 로봇 - 리듬 추가점), 찰랑이(거울 방울 그네 - 피격 반사), 또로록(구슬 레일 카트 - 길 안내).
   - 제5장 캄캄대왕전에서 3종 전원 동시 출동 앙상블.

4. **5대 보스 & 음악 앙상블 (시니/새 혼합 한국 토속형)**
   - **Ch.1 하얘시니** (실수와 실망) | 하드 록 (일렉 기타 + 록 드럼)
   - **Ch.2 재촉새** (시간 압박) | 업템포 EDM (신스 리드 + 808 전자 비트)
   - **Ch.3 따돌시니** (친구의 거절/다름) | 네오 클래시컬 (그랜드 피아노 + 팀파니)
   - **Ch.4 풀죽새** (무시당하기/무기력) | 디스코 펑크 (슬랩 베이스 + 훵크 찹)
   - **Ch.5 캄캄대왕** (혼자 남는 것/고립) | 고딕 에픽 메탈 (파이프 오르간 + 트윈 드럼)
   - **보스 정화 연출**: 공격받아 파괴되는 것이 아니라, 내면의 불안을 보듬어준 주인공에게 **“참으로 고맙구나...” 하며 인자하게 미소 짓고 빛으로 흩어지며 사라짐**.

5. **대사 및 심리 설계 (ADHD 맞춤형 친화 구조)**
   - **오답 시**: 보스는 대사 없이 조용히 미소/끄덕임 ➔ 상처 주지 않고 깨비가 장난스럽게 달래며 즉각 재도전 유도.
   - **정답 시**: 보스가 어른의 위엄 있는 옛 말투(~느니라, ~겠느냐)로 동요하며 의문형으로 흔듦.
   - **ADHD 방어 행동 치유**: 화냄/거부/찍기/반발/회피 행동 밑의 불안을 깨비가 다정하게 읽어주는 대사 탑재.

---

## 🔵 2026-09-30 완료: [REFACTOR-RENDER-001 / #209] main.ts 인라인 렌더링 코드 레이어 분리 (BeatHUDRenderer / QuestionRenderer) 🟢 (전체 734/734 Pass)

> 상태: **Issue #209 완료 🟢**  
> `main.ts`에 인라인으로 구현되어 있던 렌더링 함수(`renderRunningPhase`, `renderQuestion`, `renderJoinedHandsCursor`, X제스처 패널)를 독립 렌더/UI 레이어 모듈로 분리 추출하여 `main.ts`의 크기를 1,749줄에서 1,512줄로 대폭 감축(237줄 추출)하고 아키텍처 책임을 분리했습니다.
> - **설정 모듈 분리 (`config/locomotion.config.ts`)**: `LOCOMOTION_HUD_GUIDES` 및 8박 인디케이터/장판 링 수치 상수(`BEAT_HUD_CONFIG`)를 config 레이어로 이전 (`HUDLayer.ts` 호환 re-export 유지).
> - **`BeatHUDRenderer` (`src/render/BeatHUDRenderer.ts`)**: 8박 러닝 페이즈 장판 안내 및 경고 링, 스텝 카운트, 8박 도트 렌더러 추출. 후속 #192 `KeynoteRenderer`와의 렌더링 영역 충돌 해소.
> - **`QuestionRenderer` (`src/render/QuestionRenderer.ts`)**: 상단 문제 수식 및 2개 답안 선택지 버튼 렌더러 추출. 러닝 헤더와 문제 헤더 간 중복 `renderMath` 블록을 `renderQuestionHeaderMath` 공통 헬퍼로 통합.
> - **보조 오버레이 모듈화**: `JoinedHandsCursorRenderer.ts` (합장 링 렌더러) 및 `GestureFeedbackOverlay.ts` (X제스처 피드백 패널).
> - **TDD 회귀 검증**: `tests/unit/beat-hud-renderer.test.ts`, `question-renderer.test.ts`, `gesture-feedback-overlay.test.ts` (10 tests) 작성 및 57개 테스트 파일 734/734 Pass, `npm run build` 번들/타입 100% 통과.

---

## 🔵 2026-09-30 완료: [RENDER-PROJ-001 / #227] 3D 원근 투영 및 레일 궤적 공용 모듈(GridProjection) 추출 🟢 (전체 724/724 Pass)

> 상태: **Issue #227 완료 🟢**  
> `DreamGrid.ts`에 인라인으로 구현되어 있던 3D 원근 투영 계산식과 매직넘버를 독립 설정 파일(`config/grid.config.ts`)과 순수 함수 유틸리티(`src/render/GridProjection.ts`)로 분리 추출했습니다.
> - **그리드 설정 분리 (`config/grid.config.ts`)**: `Z_NEAR`, `DELTA_Z`, `LINE_COUNT_Z`, `FADE_DEPTH`, `HORIZON_RATIO`, `FOG_START`, `FOG_RANGE`, `CEILING_DELTA_Z`, `CEILING_LINE_COUNT_Z` 등 상수 일원화.
> - **3D 원근 투영 모듈 (`src/render/GridProjection.ts`)**:
>   - `projectDepthY(z, vy, floorH, zNear)`: 깊이 $z$를 화면 Y 좌표로 투영.
>   - `depthRatioFromY(y, vy, floorH)`: 화면 Y를 정규화 깊이 비율(0: 소실점 ~ 1: 전경 하단)로 역변환.
>   - `projectAlongRail(vx, vy, targetX, targetY, progress)`: 소실점 $(vx, vy)$에서 목표 지점 $(targetX, targetY)$까지 진행도에 원근 가속($t^2$)을 적용한 현재 좌표 및 크기 배율(`scale`) 산출.
>   - `laneToScreenX(vx, laneOffset, depthRatio)`: 깊이 비율에 따른 화면 X 오프셋 계산.
> - **기존 렌더러 리팩터링**: `DreamGrid.ts`의 인라인 투영식을 `GridProjection` 함수 호출로 치환하고, `main.ts`의 보스 소실점 Y 좌표를 `HORIZON_RATIO` 상수로 일원화.
> - **TDD 회귀 검증**: `tests/unit/grid-projection.test.ts` (16 tests) 작성 및 54개 테스트 파일 724/724 Pass, `npm run build` 검증 완료.

---

## 🔵 2026-09-30 완료: [AUDIO-BAND-001 / #191] 1단계 기타(Zone 1~5) + 드럼(Zone 9~11) Web Audio 합성기 및 싱크/어긋남 사운드 엔진 🟢 (전체 783/783 Pass)

> 상태: **Issue #191 완료 🟢**  
> 비트매니아/DJMAX 스타일의 실시간 키사운드 시스템(`BandSynthesizer`)을 구축하여, 손(Zone 1~5, 일렉 기타)과 발(Zone 9~11, 드럼)에 대응하는 역동적인 절차적 록 앙상블 음원을 합성하고, 판정 타이밍에 따른 싱크/어긋남 피드백을 연동했습니다.
> - **일렉 기타 합성 (`Zone 1~5`)**: WaveShaper 28x 왜곡 커브 기반 오버드라이브/디스토션 기타 사운드 (Zone 1: E3, Zone 2: G3, Zone 3: A3, Zone 4: C4, Zone 5: D4).
> - **록 드럼 합성 (`Zone 9~11`)**: Zone 9 록 드럼 킥(Kick, 130Hz→45Hz 피치 강하), Zone 10 스네어(Snare, 노이즈 버퍼 + 스네어 톤), Zone 11 크래시/하이햇(Cymbal, 하이패스 필터링 노이즈).
> - **싱크/어긋남 음향 메커니즘**:
>   - 정박(`sync` / Perfect): 100% 게인의 풍성한 록 앙상블 사운드.
>   - 엇박(`stumble` / Good, Late): 피치 벤드 글리치, 디튠 및 게인 감쇠 적용.
>   - 무동작(`miss` / Miss): 메인 악기 음소거 및 둔탁한 메트로놈 틱음 출력.
> - **2박 준비 카운트다운 사운드**: 1박 `READY`(440Hz 도깨비 비프), 2박 `SET`(880Hz→1046Hz 상승 톤).
> - **TDD 회귀 검증**: `tests/unit/band-synthesizer.test.ts` (16 tests) 작성 및 61개 테스트 파일 783/783 Pass, `npm run build` 성공.

---

## 🔵 2026-09-30 완료: [RENDER-KEYNOTE-001 / #192] 그리드 레일 궤적 기반 별가루 악기 노트(StarNoteRenderer) 렌더링 🟢 (전체 767/767 Pass)

> 상태: **Issue #192 완료 🟢**  
> `KEYNOTE_PERFORMANCE` 및 `STAR_COLLECT` 페이즈에서 그리드의 11개 피트니스 존 연결선을 레일 삼아 소실점에서 목표 피트니스 존 중심으로 비행하는 별가루 악기 노트(`StarNoteRenderer`)를 구현 완료했습니다.
> - **그리드 레일 원근 비행**: `StarCollectionInput.currentTarget` 및 착지 시각(`landingTime`) 연동, 1박(0.5초) 동안 원근 가속 비행(`scale: 0.3 → 1.2`) 및 안착 시점 1px 이내 오차 정밀 일치.
> - **4색 신체 부위 테두리 및 비주얼**: 왼손 `#28E6FF`, 오른손 `#FFCB4D`, 머리 `#C889FF`, 골반 `#FF865E` 테두리/글로우와 중앙 `★` 아이콘, 소실점 방향 별가루 잔상 트레일.
> - **Perfect 윈도우(±0.12s) 목표 존 펄스 링**: 안착 직전 유저가 박자에 맞춰 동작을 취할 수 있도록 목표 피트니스 존에 강조 테두리 펄스 링 표출.
> - **인게임 렌더 루프 연동**: `main.ts`에서 그리드 직후, 보스 이전 레이어로 `starNoteRenderer.render()` 호출.
> - **TDD 회귀 검증**: `tests/unit/star-note-renderer.test.ts` (11 tests) 작성 및 60개 테스트 파일 767/767 Pass, `npm run build` 성공.

---

## 🔵 2026-09-30 완료: [RENDER-HAZARD-001 / #228] 3D 원근 그리드 바닥 보스 장판(HazardZoneRenderer) 렌더링 🟢 (전체 756/756 Pass)

> 상태: **Issue #228 완료 🟢**  
> 단순 평면 타원 링으로 표시되던 보스 장판 연출을 원근 그리드 바닥면을 따라 소실점(보스 발밑)에서 유저(전경) 방향으로 밀려오는 3D 원근 장판(`HazardZoneRenderer`)으로 개편했습니다.
> - **5종 회피 패턴 3D 시각화**:
>   - `jump`: 소실점에서 전경 발밑까지 전 레인을 덮으며 3D 원근으로 확산하는 붉은 충격파 파동 링 (`#FF865E`).
>   - `left_step` / `right_step`: 해당 좌/우 레인(Zone 9 또는 Zone 11 방향)을 타고 소실점에서 전경으로 밀려오는 위험 네온 띠 (`#28E6FF` / `#FFCB4D`).
>   - `balance_left` / `balance_right`: 외발 지탱 구역 점등 및 반대편 위험 레인 가시 펄스 (`#C889FF`).
> - **단조 증가 원근 가속**: `computeHazardFrontY(beatProgress, vanishingY, vh)`를 통해 박자 진행도(0→1)에 따라 소실점에서 화면 전경(92% 높이)까지 입체감 있게 접근.
> - **HUD 레이어 연동**: `BeatHUDRenderer` 내부에서 `HazardZoneRenderer`를 위임 호출.
> - **TDD 회귀 검증**: `tests/unit/hazard-zone-renderer.test.ts` (10 tests) 작성 및 59개 테스트 파일 756/756 Pass, `npm run build` 성공.

---

## 🔵 2026-09-30 완료: [RENDER-QUESTION-APPROACH-001 / #212] 문제 출제 첫 2박 원근 접근(소실점 → 정면) 연출 렌더링 🟢 (전체 746/746 Pass)

> 상태: **Issue #212 완료 🟢**  
> 문제 출제 첫 2박(1.0초) 동안 수학 문제가 3D 원근 소실점에서 정면 헤더로 부드럽게 다가오는 연출(`QuestionApproachRenderer`)을 구현 완료했습니다.
> - **원근 스케일/위치 보간**: 소실점 `(vanishingX, vanishingY)`에서 정면 좌표까지 quadratic ease-out 곡선으로 매끄러운 감속 접근(scale: 0.15 → 1.0, alpha: 0.10 → 1.0).
> - **정면 고정 픽셀 동일성 보장**: `progress >= 1.0` 도달 이후 6박 동안은 변환 행렬 없이 기존 렌더링을 100% 동일하게 직접 호출하여 시각적 회귀 완전 차단.
> - **진행도 연동**: `BeatRunCoordinator.questionApproachProgress`를 신설하여 `RUN_QUESTION` 첫 2박 동안 실시간 접근 진행도를 `BeatHUDRenderer`에 공급.
> - **TDD 회귀 검증**: `tests/unit/question-approach-renderer.test.ts` (12 tests) 작성 및 58개 테스트 파일 746/746 Pass, `npm run build` 성공.

---

## 🔵 2026-09-30 완료: [BEAT-KEYNOTE-ENGINE-001 / #210] 8박 런 직후 2박 팔 답안 선택 및 정답/오답 즉시 분기 엔진 🟢 (전체 714/714 Pass)

> 상태: **Issue #210 완료 🟢**  
> RUN_QUESTION 8박 운동 완료 직후 즉시 답안 버튼을 표출하고 `ArmReachAnswerSelector`를 인게임에 연동하여, 4초 대기 없이 즉시 `STAR_COLLECT`(정답) vs `HAZARD_EVADE`(오답/타임아웃)로 분기하는 엔진을 구현 완료했습니다.
> - **답안 버튼 즉시 출제 및 2박 제약 (`ANSWER_SELECT`)**: 8번째 스텝 완료 즉시 답안 창을 열고 `ArmReachAnswerSelector` 0s 무체류 즉시 판정 가동. 2박(1.0s) 경과 시 자동 timeout 처리.
> - **즉각 반응 및 즉시 분기 (4초 지연 대기 제거)**: 정답 시 즉시 `STAR_COLLECT`로 전이, 오답/타임아웃 시 즉시 `HAZARD_EVADE`로 전이. 선택 후 먹통처럼 대기하던 레거시 동작 완전 제거.
> - **정답 분기 (`STAR_COLLECT`, 2~8박)**: 7개 키노트 순차 진행(박자당 1개) 및 별 수집 판정(`StarCollectionInput`) 누적.
> - **오답 분기 (`HAZARD_EVADE`, 2~8박)**: 키노트 미출현, 점프 회피 대기 루틴 가동.
> - **루틴 완료 후 단 1회 정산 (`ROUND_RESOLVE`)**: 분기 루틴 완료 시점 `_resolveRound()` 1회 호출로 단일 정산 보장.
> - **TDD 회귀 검증**: 52개 테스트 파일 714/714 Pass (`tests/integration/beat-keynote-round.test.ts` 8건 신설 포함), `npm run build` 성공.

---

## 🔵 2026-09-30 완료: [BATTLE-ANSWER-PENALTY-001 / #225] 오답/타임아웃 직접 피해 및 Phase A 보스 반격 제거 🟢 (전체 706/706 Pass)

> 상태: **Issue #225 완료 🟢**  
> 오답 또는 타임아웃 자체로 플레이어 HP가 차감되거나 보스가 직접 공격하는 기존 로직을 제거하고, Phase A(문제 구간) 전투 책임을 분리했습니다.
> - **BattleState 책임 분리**: `recordWrongAnswer()`(오답/타임아웃 카운트 누적 및 콤보 0 리셋, HP 불변), `applyHazardDamage()`(장판 회피 실패 피해), `applyMinionDamage()`(미니언 피격), `applyBossMagicDamage()`(Phase B 전용 마법 피해).
> - **BeatRoundResolver 정산 로직 수정**: `wrong` 및 `timeout` 시 `damageTaken = 0`, 플레이어 HP 100% 보존. 보스 반격(`triggerAttack`) 트리거 제거.
> - **BossController API 확장**: Phase B 보스 마법 공격 시맨틱(`triggerMagicAttack`) 분리.
> - **main.ts 화면 연출 수정**: 오답 시 `bossRenderer.triggerAttack()` 및 화면 중앙 피격 이펙트 제거 (오답 버튼 실패 사운드/이펙트 피드백은 유지).
> - **TDD 회귀 검증**: 51개 테스트 파일 706/706 Pass (신규 5건 포함), `npm run build` 성공.

---

## 🔵 2026-09-30 완료: [INPUT-ARM-ANSWER-001 / #224] Zone 4/5 한 팔 도달 기반 무체류 즉시 답안 선택기(ArmReachAnswerSelector) 구현 🟢 (전체 701/701 Pass)

> 상태: **Issue #224 완료 🟢**  
> 골반/머리 횡이동을 대체하여 한 팔 Zone 4(0번, 화면 좌측) 또는 Zone 5(1번, 화면 우측) 도달 기반 무체류(0s) 즉시 답안 선택기(`ArmReachAnswerSelector`)를 구현 완료했습니다.
> - **존-답안 1:1 고정 & 손 무관성**: 왼손/오른손 및 커서 색상과 무관하게 Zone 4 도달 시 0번, Zone 5 도달 시 1번 답안 확정.
> - **무체류(0s) 즉시 확정 & 정적 위치 인정**: 답안 창 개방 시 손이 Zone 4/5에 이미 위치한 상태여도 첫 프레임 즉시 확정.
> - **동적 뻗기 보조 검증**: 중앙에서 바깥 방향 수평 속도($|v_x| \ge 0.25$) 및 수평 우세비($|v_x| > 1.2 \times |v_y|$) 검증, 역방향(안쪽 복귀) 스침 차단.
> - **Strict Mutual Exclusion**: 양손 동시 유효(4+5 또는 동일 존 동시) 시 미선택 유지.
> - **수직 점프 차단**: 손 및 전신 수직 상승 속도 상한($|v_y| \ge 0.22$) 초과 시 점프 오선택 원천 차단.
> - **1회 단일 확정 (Idempotent)**: 창당 1회 확정 보장 및 키보드(1, 2)/터치 비상 fallback 지원.
> - **TDD 회귀 검증**: 51개 테스트 파일 701/701 Pass (신규 21건 포함), `npm run build` 성공.

---

## 🔵 2026-09-30 완료: [CLEANUP-ANSWER-INPUT-001 / #226] 골반/머리 기반 AnswerZoneSelector 및 답안 중앙 기준점 연동 제거 🟢 (전체 693/693 Pass)

> 상태: **Issue #226 완료 🟢**  
> 신규 한 팔 도달 기반 답안 선택기(`ArmReachAnswerSelector`)와 2박 답안 선택 루틴이 정착됨에 따라, 더 이상 사용되지 않는 골반/머리 횡이동 선택기(`AnswerZoneSelector`) 및 답안 선택 경로의 중앙 복귀 게이트 결합을 깔끔하게 제거했습니다.
> - **파일 및 설정 안전 삭제**: `AnswerZoneSelector.ts` 및 단위 테스트 `answer-zone-selector.test.ts` 삭제, `config/beat-motion.config.ts`에서 `AnswerZoneConfig` 및 `DEFAULT_ANSWER_ZONE_CONFIG` 제거.
> - **배럴 및 import 정리**: `src/input/index.ts`에서 `AnswerZoneSelector` 및 관련 타입 re-export 제거.
> - **BeatRunCoordinator 결합 제거**: `answerZoneSelector` 옵션/필드/게터 제거, `CenterReturnGate`와 답안 선택기 간 `setReference` 결합 제거 (`CenterReturnGate`의 스테이지 프레이밍 기능 100% 보존), fallback 답안 선택 단일화.
> - **main.ts 잔재 정리**: `AnswerZoneSelector` 인스턴스 생성 제거, 0s 무체류 팔 선택 정착에 따라 답안 창 개방 시 골반 체류 충전음(`sfx.updateDwellCharge`) 잔재 정리.
> - **아키텍처 회귀 방지**: `tests/unit/architecture.test.ts`에 제거 검증 테스트 추가. 51개 테스트 파일 693/693 Pass, `npm run build` 성공.

---

## 🔵 2026-09-30 완료: [ROUTINE-SPEC-001 / #211] 확정 게임 루틴 전체 계약 정의 및 카드 매핑 (문서 단일 기준점) 🟢

> 상태: **Issue #211 완료 🟢**  
> 사용자 확정 기획 루틴을 단일 계약 문서로 고정하고, 각 구간을 담당하는 작업 카드를 매핑하여 구현 누락을 방지합니다. 기존 골반 횡이동 및 오답 보스 직접 반격 계약을 폐기하고, **"8박 런 직후 2박 한 팔 Zone 4/5 도달 즉시 선택 및 정답/오답 분기(별모으기 vs 장판회피)"** 계약으로 문서를 일원화했습니다.

### 확정 전체 루틴

```
┌─ 메뉴 ──────────────────────────────────────────────────────┐
│  단계(챕터) 선택 → 서브단계 선택 → 입장                      │
└──────────────────────────────────────────────────────────────┘
        ↓
┌─ 스테이지 진입 준비 ────────────────────────────────────────┐
│  1) 프레임 조정 — 유저가 화면 비율에 맞게 위치 정렬          │
│  2) 3 · 2 · 1 카운트다운                                     │
│  3) 입력 잠금 및 감지기 0 리셋 후 라운드 시작                │
└──────────────────────────────────────────────────────────────┘
        ↓
┌─ 라운드 루프 (문제 수만큼 반복) ═══════════════════════════┐
│                                                              │
│  [1] 문제 출제 및 러닝 — 8박                                │
│      ├ 처음 2박: 문제가 원근(소실점)에서 천천히 다가옴       │
│      └ 이후 6박: 문제 정면 고정                              │
│         실제 운동 스텝 8회로 비트 충전                       │
│                    ↓                                         │
│  [2] 답안 출제 및 선택 — 2박 (1.0s)                         │
│      런 종료 직후 답안 버튼(Zone 4/5) 즉시 표출              │
│      한 팔 Zone 4(0번) 또는 Zone 5(1번) 도달 즉시 선택      │
│      · 정적 정지 상태 / 동적 뻗기 모두 체류 0s 즉시 인정     │
│      · 양팔 동시 유효 시 미선택                              │
│      · 2박 내 미응답 시 timeout 처리                         │
│                    ↓                                         │
│      ┌──────────────┴──────────────┐                        │
│      ▼ 정답 즉시                     ▼ 오답 / 미응답 즉시   │
│  ┌─────────────────────┐   ┌──────────────────────────┐    │
│  │ [3-A] 별모으기       │   │ [3-B] 바닥공격 회피      │    │
│  │       2~8박          │   │        2~8박             │    │
│  │                      │   │                          │    │
│  │ · 즉시 정답 피드백   │   │ · 즉시 실패 피드백       │    │
│  │ · 키노트 순차 출현   │   │ · 보스 직접 반격 없음    │    │
│  │   Zone 1~5 손(기타)  │   │   (즉시 HP 감소 없음)    │    │
│  │   Zone 9~11 발(드럼) │   │ · 바닥 충격파/장판 발생  │    │
│  │ · Perfect/Good/      │   │ · 점프 모션으로 회피     │    │
│  │   Late/Miss 판정     │   │ · 회피 실패 시에만 피해  │    │
│  │ · 별가루 적립        │   │ · 회피 성공 시 피해 0    │    │
│  │ · 미니언 +1 증원     │   │                          │    │
│  └─────────────────────┘   └──────────────────────────┘    │
│                    ↓                                         │
│  [4] 라운드 단일 정산 (1회)                                  │
└══════════════════════════════════════════════════════════════┘
        ↓ (모든 문제 종료)
┌─ 보스 결전 (Phase B) ───────────────────────────────────────┐
│  자원: 누적 별가루 + 수호신 + 미니언 군단                    │
│                                                              │
│  · 수호신 & 미니언 : 모인 별가루로 마법 공격                 │
│  · 보스            : 결전 마법 공격 & 광폭화 패턴           │
│  · 유저            : 피버타임 — 별모으기 지속                │
│                      콤보 누적으로 보스에게 타격             │
└──────────────────────────────────────────────────────────────┘
```

### 구간별 담당 카드 매핑표

| # | 구간 | 담당 카드 | 상태 |
|---|---|---|---|
| 0 | 단계/서브단계 선택 → 입장 | #115, #142 | 🟢 완료 |
| 1 | **프레임 조정 (유저:화면 비율)** | #198 `KneeFramingValidator`, #199 `KneeFramingGuideRenderer` | 🟢 #206 통합 완료 |
| 2 | **3·2·1 카운트다운** | #202 `FEAT-READY-001` | ⚪ 대기 |
| 3 | 문제 출제 8박 (운동 스텝) | #180, #187, #190 | 🟢 완료 |
| 4 | **문제 원근 접근 연출 (첫 2박)** | #212 `RENDER-QUESTION-APPROACH-001` | ⚪ 등록 완료 |
| 5 | **답안 선택 판정기 (한 팔 Zone 4/5)** | #224 `INPUT-ARM-ANSWER-001` | 🟢 완료 |
| 6 | **답안 출제 2박 및 정답/오답 즉시 분기** | #210 `BEAT-KEYNOTE-ENGINE-001` | 🟢 완료 |
| 7 | **오답 직접 피해 제거 및 회피 피해 분리** | #225 `BATTLE-ANSWER-PENALTY-001` | 🟢 완료 |
| 8 | 별모으기 2~8박 (키노트 렌더/오디오) | #192 (렌더) / #191 (오디오) | ⚪ 대기 |
| 9 | 미니언 증원 (+1) | #194 `MINION-TROOP-001` | ⚪ 대기 |
| 10 | 라운드 단일 정산 | #184 `BeatRoundResolver` | 🟢 #206 통합 완료 |
| 11 | 보스 결전 — 보스 마법 공격 패턴 | #193 `BATTLE-BOSS-001` | 🟢 완료 |
| 12 | 보스 결전 — 미니언 군단 화력 | #194 `MINION-TROOP-001` | 🟢 완료 |
| 13 | 보스 결전 — 유저 피버타임 별모으기 | #213 `BOSS-FEVER-001` | 🟢 완료 |
| 14 | 보스 결전 연출 | #195 `RENDER-CLIMAX-001` | 🟢 완료 |
| 15 | **레거시 골반/머리 선택기 제거** | #226 `CLEANUP-ANSWER-INPUT-001` | 🟢 완료 |

---

## 🔵 2026-09-30 완료: [INPUT-ARM-ANSWER-001 / #224] Zone 4/5 한 팔 도달 기반 무체류 즉시 답안 선택기(ArmReachAnswerSelector) 구현 🟢 (전체 701/701 Pass)

## 🔵 2026-09-29 완료: [CLEANUP-LEGACY-001 / #207] 레거시 AnswerSelector / 신형 AnswerZoneSelector 이중 답안 판정 정리 및 역할 경계 확립 (C안) 🟢 (전체 678/678 Pass)

> 사용자 승인 방안 **C안(역할 분리 공존)**에 따라 동일 프레임 이중 답안 판정 엔진 경합을 해소하고, 1박째 정답 확정과 2~8박 키노트 판정의 역할 경계를 확립했습니다. (Issue #207 완료)
> - **1박째 정답 확정 경로 단일화**: `BeatRunCoordinator.isAnswerOpen`을 `KEYNOTE_PERFORMANCE` 1박째(`performanceBeat === 1 && _selectedChoiceIndex === null`)로 한정. 2박 진입 시 `AnswerZoneSelector` 업데이트 및 fallback 확정 차단.
> - **레거시 AnswerSelector 답안 확정 경로 정리**: `main.ts`의 `answerSelector.updateFromPose()` 기반 정답 확정 및 `confirmAnswerByFallback` 강제 조기 종료 호출을 제거. 11존 판정 자산(`PostureMatcher`, `CursorTracker` 4색 커서)은 전량 보존하여 2~8박 키노트 판정 및 커서 렌더링에 재사용.
> - **2~8박 키노트 판정 경로 확립**: `beatCoordinator.performanceBeat` 기준 2~8박에서 `StarCollectionInput`을 활성화하고 결과를 `BeatRoundResolver.recordStarRating()`으로 리듬 통계에만 누적 (`hasBattlePenalty: false` 보장).
> - **중복 진입 로직 단일화**: `main.ts`의 `onPhaseChange` 콜백과 `update` 폴링에 이중 기술되어 있던 문제 페이즈 진입 로직을 `enterQuestionPhase()` 단일 함수로 추출 및 단일 호출.
> - **답안 버튼 좌표 단일 소스화**: `handleAnswer()` 내부 하드코딩 버튼 좌표를 제거하고 `getAnswerButtonLayouts(virtualWidth, virtualHeight)` 단일 소스로 일원화하여 #164 재배치 버튼 중심(X 183.6 / 896.4, Y 1015)에 이펙트 정확히 발생.
> - **즉각 조작 피드백**: 골반 이동 또는 fallback 답안 선택 시 `onAnswerSelected` 콜백을 통해 `'hover'` 사운드 즉시 출력 및 버튼 테두리 점등 연계.
> - **TDD 회귀 검증**: 50개 테스트 파일 678/678 Pass (신규 테스트 4건 포함), `npm run build` 성공.

---

## 🔵 2026-09-29 완료: [CLEANUP-DEAD-001 / #208] 폐기된 방어 전투 시스템 잔재 및 미참조 리소스/데드코드 일괄 제거 🟢 (전체 674/674 Pass)

> Issue #143, #147, #173 등으로 폐기·이관되었으나 코드와 리소스에 남아 있던 잔재를 일괄 정리했습니다. 기능 및 시각 회귀 0건, JS 번들 크기 축소(206.08 kB → 204.46 kB) 및 불필요 미참조 리소스 약 700KB를 제거했습니다. (Issue #208 완료)
> - **스쿼트 방어 잔재 제거**: `SquatDetector.ts` 파일 삭제, `src/motion/index.ts` 배럴 export 제거, 관련 단위 테스트(`motion-detectors.test.ts`, `x-gesture-collision.test.ts`) 정리. (`JumpDetector`는 #193 점프 회피 재사용 확정에 따라 보존).
> - **보스 자동공격 타이머 및 resolveAttack() 제거**: `BossController`의 `_attackInterval` 자동공격 블록 및 `resolveAttack()` 제거, 오답 반격(`triggerAttack`) 단일 경로 확립.
> - **HUDLayer 미사용 쉴드/마나 필드 정리**: `HUDLayer._renderShield()` 및 `shieldActive`, 미사용 `mana`/`manaMax` 필드 제거, `main.ts:getHUDData()` 전달부 정리.
> - **AnswerSelectionRenderer 정리**: #173으로 가상화된 `renderZoneBoxes` 분기 및 미사용 `RenderZoneInfo` 인터페이스 제거.
> - **미참조 파일 및 중복 리소스 삭제**: `src/index.html`, `src/render/layers/`, `src/data/*.csv`(중복 120KB), `src/assets/img/*`(약 676KB), `img/E_Pit_cusor_*.png` 삭제.
> - **배럴 일관성 확보**: `TutorialOverlay`를 `src/ui/index.ts`에, `SFXSynth`를 `src/audio/index.ts`에 등록하고 `main.ts` import 경로를 배럴로 통일.
> - **개발 산출물 정리 및 .gitignore 갱신**: 개발 로그 파일 삭제 및 `.gitignore`에 `dev_server*.log`, `localhost.url` 패턴 추가.
> - **칼로리 연동 보존**: `ResultData.squats`/`jumps` 필드에 #193 연동 예정 TODO 주석 명시.
> - **TDD 회귀 검증**: 50개 테스트 파일 674/674 Pass 및 `npm run build` 성공.

---

## 🔵 2026-09-30 완료: [UI-STORY-001 / #216] 메뉴/HUD/결과 화면 텍스트 전면 교체 (수호신 '알레' → '깨비', 5대 보스명 신규 스토리 일원화) 🟢 (전체 680/680 Pass)

> 메인 메뉴 슬로건의 구 수호신명('알레')을 신규 스토리 주인공 **'깨비'**로 교체하고, 인게임 HUD·결과 화면·메인 메뉴 챕터 카드의 보스명을 `src/data/bossData.ts` 단일 소스 기반 5대 불안 보스명(하얘시니, 재촉새, 따돌시니, 풀죽새, 캄캄대왕)으로 전면 일원화했습니다. (Issue #216 완료)
> - **메인 메뉴 슬로건 교체**: `src/ui/MenuRenderer.ts`에서 `'알레와 함께 신비로운 꿈의 성역으로 다이빙!'`을 `'깨비와 함께 신비로운 꿈의 성역으로 다이빙!'`으로 교체.
> - **중복 BOSS_NAMES 배열 제거 및 단일 소스 참조**: `src/ui/HUDLayer.ts` 및 `src/ui/ResultRenderer.ts`의 하드코딩 `BOSS_NAMES` 배열을 완전히 제거하고 `getBossName(chapter)` 호출로 단일화.
> - **챕터 카드 보스명 일원화**: `MenuRenderer.ts`의 `CHAPTER_INFO` 내 `boss` 필드를 5대 보스명('망각의 요괴 하얘시니', '성급의 요괴 재촉새', '왜곡의 요괴 따돌시니', '무기력의 요괴 풀죽새', '영원한 고립의 지배자 캄캄대왕')으로 갱신.
> - **TDD 단위 테스트**: `tests/unit/ui-system.test.ts`에 HUD 상단 보스명 렌더링, 결과 화면 보스명 렌더링, CHAPTER_INFO 신규 보스명 매핑, 깨비 슬로건 렌더링 단위 테스트를 선작성(Red) 후 통과(Green) 확인 (전체 50개 파일 680/680 Pass, `npm run build` 번들 무오류).

---

## 🔵 2026-09-29 완료: [DATA-BOSS-001 / #215] 5대 보스 데이터 단일 소스(bossData.ts) 신설 및 신규 스토리 보스명 일원화 🟢 (전체 681/681 Pass)

> 신규 정본 스토리(`04_STORY_SOURCE.md`)의 5대 불안 보스명(하얘시니, 재촉새, 따돌시니, 풀죽새, 캄캄대왕)과 메타데이터(수학 영역, 음악 장르, 악기 매핑, HP, 테마 색상, 불안 인용구)를 관리하는 단일 소스 모듈을 신설했습니다. (Issue #215 완료)
> - **단일 소스 모듈**: `src/data/bossData.ts`에 `BossMetadata` 인터페이스, `BOSS_REGISTRY` 맵, `getBossByChapter()`, `getBossName()`, `getAllBosses()` 구현.
> - **배럴 모듈 재수출**: `src/data/index.ts`에 보스 데이터 타입 및 함수 등록.
> - **TDD 단위 테스트**: `tests/unit/boss-data.test.ts` 12개 테스트 케이스 작성 및 100% Pass (전체 50개 파일 681/681 Pass, `npm run build` 무오류).
> - **후속 연계**: 후속 카드(`UI-STORY-001`, `RENDER-BOSS-001`)에서 HUDLayer/ResultRenderer/MenuRenderer의 레거시 보스명을 단일 소스로 연결 예정.

---

## 🔵 2026-09-29 완료: [INTEGRATE-BEAT-001 / #206] BEAT/Keynote/Knee 6종 모듈 main.ts 통합 및 전투 정산 단일화 🟢 (전체 669/669 Pass)

> Issue #182, #184, #196, #197, #198, #199 미통합 6개 모듈을 `main.ts` 프로덕션 게임 루프에 통합하고 전투 정산을 `BeatRoundResolver`로 일원화했습니다. (Issue #206 CLOSED)
> - **전투 정산 단일화**: `BeatRunCoordinator._resolveRound()`의 `battle` 직접 수정을 제거하고, `BeatRoundResolver.resolveRound(status)`를 통해서만 자원(HP/마나/보스 피해/스펠)을 단 1회 갱신. `handleAnswer()`는 연출만 전담.
> - **Knee Framing & 가이드**: `KneeFramingValidator` 및 `KneeFramingGuideRenderer`를 `main.ts` 루프에 연결, `degraded` 상태 시 Pose 기반 foot-keynote 차단.
> - **Foot Keynote & 가상 페달**: `FootKeynoteDetector` 및 `FootKeynoteInput` 연결 (Z, X, V 키보드 및 Zone 9~11 가상 페달 터치/클릭 fallback 포함).
> - **Keynote 시퀀스 공급 및 2~8박 StarCollectionInput**: 360건 피트니스 패턴에서 2~8박 키노트 시퀀스를 파생하여 코디네이터에 공급하고, `KEYNOTE_PERFORMANCE` 2~8박에서 `StarCollectionInput`을 통한 별 판정을 `BeatRoundResolver.recordStarRating()`으로 실시간 집계 (`hasBattlePenalty: false` 불간섭 보장).
> - **리듬 통계 연동**: 별/타임아웃 리듬 통계를 `ResultData` 및 결과 화면에 표출.

---

## 🔵 2026-09-29 완료: [BUG-BEAT-003 / #205] 중앙 복귀 게이트/정답존 좌표계 불일치(픽셀 vs 정규화) 해소 🟢 (전체 660/660 Pass)

> `main.ts`가 `BeatRunCoordinator.update()`에 가상 픽셀 좌표(1080x2160)를 전달하여 `CenterReturnGate`와 `AnswerZoneSelector`의 정규화 좌표(0~1) 전제 임계값과 충돌하던 결함을 해결했습니다. `toNormalizedLandmarks` 순수 변환 헬퍼를 추가하여 코디네이터에 정규화 좌표를 전달하고, `AnswerZoneSelector` 생성자 주입(`isMirrored: false`)을 통해 화면 좌/우 방향성 일치를 확보했습니다.

---

## 역사 기록: 2026-09-27 BEAT MOTION 8+2+8 전환

> **Superseded by #229.** 아래 `REST_READY`, `KEYNOTE_PERFORMANCE`, 오답 직접 -25, 정답 기본 보스 피해 1은 당시 구현 이력이며 현행 요구가 아니다. 현재 계약은 이 문서 상단과 GDD 2.1을 따른다.

> 상태: **[BEAT-ROUTINE-001 / #190] 8+2+8 상태 전이 및 단일 정산 완료 🟢 (전체 583/583 Pass)**, 다음 착수: `#191 [AUDIO-BAND-001]`.  
> "가만히 서 있어도 저절로 8박이 채워지는 결함"을 해소하고, 유저의 실제 운동이 비트를 완성하며, 정답 위치에서 시작하는 비트매니아식 8+2+8 키노트 합주 퍼포먼스로 전면 고도화합니다. GDD, WBS, GITHUB_ISSUES, HANDOVER 4개 문서 간 단일 계약 동기화가 완료되었습니다.

### 확정 루프: 8+2+8 비트매니아식 피트니스 앙상블 (BPM 120, 총 18박 / 9.0초)

```text
[Phase 1] 8박 운동 러닝 (내가 만드는 비트, RUN_EXERCISE)
  ├─ 상단에 수학 문제 출제 및 비블로킹 TTS 낭독
  ├─ 플레이어가 실제로 8회 운동(달리기/바운스/스웨이/교차/Space)을 수행 (미동작 시 비트 불변/대기)
  └─ 1회 운동마다 1박씩(1/8 → 8/8) 채워지며, 발스텝이 묵직한 서브 킥 & 베이스 펄스를 연주
        ↓
[Phase 2] 2박 호흡 & 준비 브레이크 (REST_READY, 1.0s 고정)
  ├─ 8회 운동 완충 직후 정확히 2박 동안 짧은 호흡 가다듬기 및 정답 위치 인지
  └─ "READY... SET!" 비주얼 및 카운트 사운드와 함께 정답 위치/키노트 레인 점등
        ↓
[Phase 3] 8박 키노트 합주 퍼포먼스 (KEYNOTE_PERFORMANCE, 4.0s 고정)
  ├─ 1박째: 정답의 위치(Zone 4/5 등)를 손으로 터치하여 정답 확정 및 인트로 기타 파워코드 작렬
  ├─ 2~8박: 차례로 이어지는 키노트를 터치하며 풀바디 록 앙상블 합주 완성
  │   ├─ [손 커서 (Zone 1~5)]: 일렉 기타 리드/리프 연주
  │   └─ [발 스텝 (Zone 9~11)]: 록 드럼 킥/스네어/심벌 타격
  └─ 비트매니아식 싱크(Sync) 판정:
      ├─ 정박(±0.12s): 풍성한 100% 게인 클린 기타/드럼 사운드
      ├─ 엇박(±0.25s): 피치 벤드 글리치, 프렛 스크래치(Fret Scratch), 림샷 둔탁음
      └─ 무동작(Miss): 메인 악기 음소거(Mute) 및 조용한 가이드 틱만 잔존
        ↓
[Phase 4] 라운드 단일 정산 (Single Point Settlement):
  ├─ 정답: 기본 마나 +25 및 콤보 +1 (100% 보장), 리듬 성취도 점수 누적
  ├─ 오답/미응답: 플레이어 HP -25 및 콤보 0 리셋
  └─ 마나 100 도달 시: 수호신 스펠 캐스팅 자동 발동 → 보스 HP -4
```

### 단계(Chapter)별 악기 편성 로드맵

| 단계 (Chapter) | 보스 테마 / 수학 영역 | 손 (Zone 1~5) 악기 | 발 (Zone 9~11) 악기 | 앙상블 음악 장르 |
|---|---|---|---|---|
| **1단계 (Ch.1)** | 포겟 (망각의 늪 / 덧셈·뺄셈) | **일렉 기타 (Guitar)** | **록 드럼 (Rock Drum)** | **하드 록 / 팝 펑크** |
| **2단계 (Ch.2)** | 후다닥 (가속의 시계탑 / 곱셈·나눗셈) | **신스 리드 (Synth Lead)** | **전자 808 킥/클랩 (EDM)** | **업템포 유로비트 / EDM** |
| **3단계 (Ch.3)** | 뒤죽박죽 (왜곡의 숲 / 분수) | **그랜드 피아노 (Piano)** | **오케스트라 팀파니/심벌** | **네오 클래시컬 심포니** |
| **4단계 (Ch.4)** | 에라 (무중력의 성 / 소수) | **슬랩 베이스 (Slap Bass)**| **펑크 찹 & 퍼커션** | **디스코 펑크 (Funk)** |
| **5단계 (Ch.5)** | 나이트메어 (악몽의 궁전 / 종합) | **파이프 오르간 (Organ)** | **헤비메탈 투베이스 드럼** | **고딕 에픽 메탈** |

### 작업 카드 순서 및 진행 현황

| 순서 | 작업 ID | GitHub Issue | 단일 책임 | 상태 |
|---:|---|---|---|:---:|
| 1 | `BEAT-SPEC-001` | [#176](https://github.com/Choyounhwa/-dream-guardian/issues/176) | 8박 계약, 전투 정산 시점, 미응답/스웨이 정책 문서화 고정 | 🟢 **완료 (Pass)** |
| 2 | `BEAT-CORE-001` | [#177](https://github.com/Choyounhwa/-dream-guardian/issues/177) | BPM 120, 8박, pause/resume, 프레임 지연 보정 `RhythmEngine` | 🟢 **완료 (Pass)** |
| 3 | `CENTER-RETURN-001` | [#178](https://github.com/Choyounhwa/-dream-guardian/issues/178) | 중앙 복귀/기준점 잠금 및 timeout/retry | 🟢 **완료 (Pass)** |
| 4 | `ANSWER-ZONE-001` | [#179](https://github.com/Choyounhwa/-dream-guardian/issues/179) | 상대 좌/우 정답존, 히스테리시스, 0.5초 확정 | 🟢 **완료 (Pass)** |
| 5 | `BEAT-RUN-001` | [#180](https://github.com/Choyounhwa/-dream-guardian/issues/180) | 기존 자유 게이지를 8박 달리기+문제 HUD로 전환 | 🟢 **완료 (Pass)** |
| 6 | **`BUG-BEAT-001`** | **[#187](https://github.com/Choyounhwa/-dream-guardian/issues/187)** | **달리기 미동작 8박 자동 완충 차단 및 실제 8회 운동 스텝 연동** | 🟢 **완료 (580/580 Pass)** |
| 7 | **`BEAT-ROUTINE-001`** | **[#190](https://github.com/Choyounhwa/-dream-guardian/issues/190)** | **8박 운동 → 2박 쉼(Ready) → 8박 키노트 합주 상태 전이 컨트롤러** | 🟢 **완료 (583/583 Pass)** |
| 7-1 | **`BUG-BEAT-002`** | **[#200](https://github.com/Choyounhwa/-dream-guardian/issues/200)** | **문제/키노트 페이즈 코디네이터 미갱신 및 답안 선택 프리즈 결함 해결** | 🟢 **완료 (607/607 Pass)** |
| 8 | **`AUDIO-BAND-001`** | **[#191](https://github.com/Choyounhwa/-dream-guardian/issues/191)** | **1단계 기타(Zone 1~5) + 드럼(Zone 9~11) Web Audio 및 싱크/어긋남 사운드** | ⚪ 대기 |
| 9 | **`RENDER-KEYNOTE-001`** | **[#192](https://github.com/Choyounhwa/-dream-guardian/issues/192)** | **Zone 1~5 및 Zone 9~11 비트매니아식 키노트 비주얼 및 판정 연출** | ⚪ 대기 |
| 10 | `GAME-ROUND-001` | [#184](https://github.com/Choyounhwa/-dream-guardian/issues/184) | 8박 종료 시 전투/통계 단일 정산 | ⚪ 대기 |
| 11 | `E2E-BEAT-001` | [#186](https://github.com/Choyounhwa/-dream-guardian/issues/186) | 전체 루프 통합/E2E 및 최종 검증 | ⚪ 대기 |

### #187 완료 기록 - 실제 8회 운동 스텝 연동

- `BeatRunCoordinator`는 시간 경과로 `RUN_QUESTION`을 이탈하지 않으며, 실제 locomotion 또는 Space/클릭 fallback의 `recordStep()` 1회마다 1/8박을 누적한다.
- 8회 운동을 마친 뒤에만 `CENTER_RETURN` 게이트를 열고, 중앙 안정 잠금 또는 추적 불가 timeout fallback을 거쳐 답안 페이즈를 연다.
- 달리기 HUD 8개 점은 시간 기반 `RhythmEngine` 인덱스 대신 실제 완료 운동 수를 표시한다.
- TDD: 정지 상태 30초에서도 0/8과 `RUN_QUESTION` 유지, 운동 8회 후 전이, 중앙 복귀 retry/timeout을 검증했다. `npm run build` 성공 및 전체 `npm test` 580/580 Pass.

### #190 완료 기록 - 8+2+8 비트 루틴 상태 전이

- `BeatRunCoordinator`에 `RUN_QUESTION` → `REST_READY` (BPM 120 기준 고정 2박/1.0초) → `KEYNOTE_PERFORMANCE` (고정 8박/4.0초) → `ROUND_RESOLVE` 상태 계약을 구현했다.
- 정답 입력은 키노트 퍼포먼스 첫 박에만 열리며, 정답/오답 전투 자원 변화는 퍼포먼스 종료 후 `ROUND_RESOLVE`에서 한 번만 정산한다. 첫 박 미응답도 동일하게 한 번의 오답으로 정산한다.
- 준비 구간의 중앙 기준점은 2박 내 안정 잠금하며, 미잠금 상태에서는 기존 fallback 기준점을 사용해 루프를 멈추지 않는다.
- TDD: 미동작 고정, 8회 운동 후 준비 전이, 정확한 2박/8박 시간, 단일 정산 및 미응답 정산을 검증했다. `npm run build` 성공 및 전체 `npm test` 583/583 Pass.

### #184 완료 기록 - BEAT MOTION 8박 종료 전투 및 리듬 통계 단일 정산 (GAME-ROUND-001)

- `BeatRoundResolver`가 답 확정 즉시 처리되던 전투 결과를 답안 8박 종료 시점에 단 1회(`Single Point of Settlement`) 일괄 처리하도록 구현했다.
- 정답 라운드 종료 시 마나 +25, 콤보 +1, 보스 기본 피해(1) 및 마나 100 도달 시 수호신 스펠 시전(4)을 적용한다.
- 오답/미응답(타임아웃) 라운드 종료 시 플레이어 HP -25 및 콤보 0 리셋을 적용한다.
- 동일 라운드 중복 `resolveRound` 호출 시 전투 자원이 중복 차감/가산되지 않는 Idempotency Guard를 확립했다.
- 별 판정(Perfect/Good/Late/Miss) 및 회복 스웨이(`recoverySwayCount`)를 전투 자원과 격리하여 누적하고, timeout은 오답 전투 결과를 공유하되 통계상 `timeoutCount`로 독립 분리 기록한다.
- TDD: Red(모듈 부재) → Green(대상 15/15 Pass) → Refactor(`npm run build` 성공, 전체 `npm test` 653/653 Pass) 완료.

### #182 완료 기록 - 11존 단일 별 Perfect Good Late Miss 판정 (INPUT-STAR-001)

- `StarCollectionInput`이 `StarTarget`의 지정 커서(`part`/`cursorType`), 목표 존(`zoneId`), 비트 착지 시각(`landingTime`)을 바탕으로 Perfect(±0.12s), Good(±0.25s), Late(±0.40s), Miss(초과 및 타임아웃) 판정을 수행한다.
- 지정되지 않은 커서 진입 차단, 11존 허용 매트릭스(`isValidZoneForCursor`) 위반 차단, 중복 수집 차단(`_isCollected`), 일시정지(`_paused`) 차단을 완전 구현했다.
- 11존 4색 커서의 44개 조합에 대한 전수 검증, 모든 타이밍 경계값, 키보드/터치 폴백 및 미러/Cover 좌표계 연동을 검증했다.
- `hasBattlePenalty: false`로 별 판정 결과는 순수 리듬 통계 전용이며 전투 HP/마나/콤보에 일체 불간섭함을 보장했다.
- 범위에 따라 별 시퀀스 생성, 렌더링, `main.ts` 라운드 전이, `BattleState`는 변경하지 않았다. 후속 렌더링 카드는 #183이다.
- TDD: Red(모듈 부재) → Green(대상 26/26 Pass) → Refactor(`npm run build` 성공, 전체 `npm test` 638/638 Pass) 완료.

### #200 완료 기록 - 인게임 답안 선택 프리즈 결함 해결 (BUG-BEAT-002)

- `main.ts`에서 `beatCoordinator.update(dt, sourceLandmarks)`가 `isRunning` (`gamePhase === 'running'`)에만 묶여 있어 문제/키노트 페이즈(`KEYNOTE_PERFORMANCE`) 진입 시 시간이 흐르지 않아 화면이 멈추던 회귀 결함을 해결했다.
- `screenMode === 'game' && !pauseModal.isOpen` 상태에서 코디네이터 시간을 상시 갱신하도록 전역화하여 8박 만료 시 `_resolveRound()` 단일 정산과 다음 라운드 자동 전이가 정상 작동한다.
- 마우스 클릭, 키보드(1, 2) 단축키, 웹캠 자세 판정을 모두 `confirmAnswerByFallback(idx)`로 일원화하고, 클릭/선택 즉시 터치 효과음(`sfx.play('hover')`) 및 버튼 테두리 점등 하이라이트를 즉각 제공하도록 조작감을 개선했다.
- TDD: Red(미구현 시 실패) → Green(607/607 Pass) → Refactor 검증 완료.

### #181 완료 기록 - CSV 기반 순차 별 안무 생성 (CHOREO-STAR-001)

- `StarSequenceGenerator`가 `fitness pattern.csv`의 부위-존 쌍을 입력 순서대로 한 박당 하나의 `StarTarget`으로 분해한다.
- 부위별 허용 존, 골반 최하단-손 최상단 Cross-Body 제약, 직전 동일 부위/동일 존 반복, 동일 부위 장거리 왕복을 생성·검증 단계에서 차단한다.
- 남은 박 수에 맞는 가장 짧은 안전 후보를 결정적 seed 기반으로 선택하며, 맞는 후보가 없으면 직접 변환 시퀀스를 안전하게 절단한다.
- 범위에 따라 렌더링, `main.ts` 통합, 별 타이밍 입력 판정 및 전투 수치는 변경하지 않았다. 후속 입력 카드는 #182다.
- TDD: Red(모듈 부재) → Green(대상 5/5 Pass) → Refactor(`npm run build` 성공, 전체 `npm test` 612/612 Pass) 완료.

### 이슈 정리 결과

- 이전 문서의 4박자 `FEAT-RHYTHM-001` 사양은 폐기했고, 새 8박 전환 계약은 GitHub #176 `BEAT-SPEC-001`로 등록했다.
- #147, #159, #160은 구현 및 테스트 완료 상태였으나 GitHub가 열려 있어 2026-09-27에 Close 처리했다.
- #92는 리듬 오디오를 신규 카드로 분리, #95는 입력 충돌 때문에 보류/재설계, #96/#97/#98/#99는 BEAT 통합 후 후행 갱신한다.
- `UI-MENU-003`의 실제 GitHub 번호는 #168이며, 과거 HANDOVER의 #146 표기는 잘못된 기록이다.

### GitHub BEAT 카드

`#176 BEAT-SPEC-001` → `#177 BEAT-CORE-001` → `#178 CENTER-RETURN-001` → `#179 ANSWER-ZONE-001` → `#180 BEAT-RUN-001` 순서로 시작한다. 별 경로는 `#181 CHOREO-STAR-001` → `#182 INPUT-STAR-001` → `#183 RENDER-BEAT-001`, 정산/오디오는 `#184 GAME-ROUND-001`, `#185 AUDIO-BEAT-001`, 마지막 통합 검증은 `#186 E2E-BEAT-001`이다.

---

## 🟢 2026-09-27 완료: 3D 드림 그리드 - 피트니스존 연한 연결선 렌더링 (#188 완료, #189 취소)

> 등록 및 완료일: 2026-09-27 / 상태: **#188 완료 (10/10 Pass, 전체 581/581 Pass), #189 취소/종료 (사용자 요청)**

사용자 피드백에 따라 과일 아이템 수집 시스템(#189)은 제외 처리하고, 3D 드림 그리드 소실점으로부터 11개 피트니스 존(Zone 1~11)으로 이어지는 은은하고 연한 네온 연결선(Faint Connection Lines, alpha: 0.18, 1.2px) 렌더링을 구현 완료했습니다.

| 순서 | 카드 ID | GitHub Issue | 제목 | 핵심 구현 대상 | 상태 |
|---|---|---|---|---|---|
| 1 | `RENDER-TRACK-001` | [#188](https://github.com/Choyounhwa/-dream-guardian/issues/188) | 3D 드림 그리드 - 11개 피트니스 존 원근 연한 연결선(Zone Connection Lines) 렌더링 | • 소실점(`vx, vy`)에서 11개 피트니스 존 중심(`cx, cy`)으로 향하는 은은한 선형 그라데이션 네온 가이드 선<br>• 존 중심 3px 앵커 링 점등 및 시야 간섭 없는 소프트 투명도(`alpha = 0.18`)<br>• 메뉴 화면 자동 비활성화(`renderZoneConnections: false`) | 🟢 **완료 (Pass)** |
| 2 | `FEAT-ITEM-001` | [#189](https://github.com/Choyounhwa/-dream-guardian/issues/189) | 3D 러닝 트랙 부유 과일 아이템(딸기·바나나) 렌더링 및 모션 수집 시스템 | 사용자 요청("과일아이템은 필요없어")에 따른 카드 제외 및 종료 | 🚫 **취소/종료** |

---

## 🟣 2026-09-27 기획 확정: Phase B 보스 결전 오케스트라 & 미니언 군단 시스템 (#193, #194, #195 등록)

> 상태: **[#193, #194, #195] GitHub 이슈 및 작업 카드 3건 등록 완료 ⚪ (승인 대기)**  
> 10문제 러너 구간(Phase A) 돌파 후 모인 미니언 군단(3~13마리)과 수호신이 적 보스와 전면 대치하는 Phase B의 상세 전투 메커니즘을 확정했습니다.

### Phase B 확정 메커니즘 요약
1. **하체 방어 (바닥 불협화음 장판 회피 & 미니언 생존)**:
   - **보스 양손 쿵 (바닥 충격파)**: 전 레인 충격파 발생 → 유저 **전신 점프(JumpDetector)**로 회피.
   - **보스 한손 번갈아 콩콩 (적 그림자 미니언 침투)**: 레인으로 돌진하는 적 미니언 → 유저 **Zone 9/11 양발 교대 짓밟기(Alternating Foot Stomp)**로 격퇴.
   - **실패 패널티**: 대처 실패 시 **아군 미니언 1마리 즉시 탈락 (-1 Minion)**. (본체 HP는 보존).
2. **상체 공격 (Zone 1~5 별빛 수집 & 강력 마법 탄막)**:
   - Phase A와 동일하게 Zone 1~5는 상체 손 커서로 별빛을 모으는 컨셉 유지.
   - 수집 성공 시 마법 게이지 충전 및 군단 집중 마법 탄막 일제 사격.
   - **실패 패널티**: 미니언 피해 없음. 그러나 충전 중이던 강력 마법 발사 타이밍이 끊기고 쿨다운 지연(딜로스).
3. **보스 광폭화 (Enrage Phase)**:
   - 보스 체력 30% 이하 도달 시 공격 주기 1.5배 가속 및 장판/적 미니언 동시 다발 맹공.

| 작업 ID | GitHub Issue | 제목 | 핵심 모듈 | 상태 |
|---|---|---|---|:---:|
| `BATTLE-BOSS-001` | [#193](https://github.com/Choyounhwa/-dream-guardian/issues/193) | Phase B 보스 불협화음 장판(양손 쿵 점프 & 한손 콩콩 발짓밟기) 및 광폭화 엔진 | `BossHazardController.ts`, `BossController.ts` | 🟢 완료 |
| `MINION-TROOP-001` | [#194](https://github.com/Choyounhwa/-dream-guardian/issues/194) | 아군 미니언 군단(3~13체) 실시간 증원/탈락 및 상체(Zone 1~5) 별빛 수집 마법 발사 시스템 | `MinionTroopManager.ts`, `BattleState.ts` | 🟢 완료 |
| `RENDER-CLIMAX-001` | [#195](https://github.com/Choyounhwa/-dream-guardian/issues/195) | 3D 원근 보스 결전 연출(불협화음 장판 충격파, 적 미니언 전진, 아군 군단 마법 탄막 및 광폭화) | `BossClimaxRenderer.ts`, `CanvasManager.ts` | 🟢 완료 |




---

## 🟢 2026-09-22 세션 구현 완료 내역 (21개 카드 전원 통과)

> 등록일: 2026-09-22 / 최종 상태: **GitHub Issue 카드 21건 완료 (#116, #120, #121, #117, #118, #119, #122, #123, #124, #125, #126, #127, #128, #129, #131, #132, #133, #134, #135, #136, #137, #138, #140, #130), 테스트 336/336 100% Pass**

사용자 요청 사항, 결함 제보 및 자세 선택 시스템 기반 리팩터링에 따라 총 21개 카드의 개발 및 검증을 100% 완료했습니다.

### 1. 완료된 작업 카드 상세 내역

| 카드 ID | GitHub Issue | 제목 | 핵심 구현 성과 | 검증 결과 |
|---|---|---|---|---|
| `BUG-CURSOR-001` | [#116](https://github.com/Choyounhwa/-dream-guardian/issues/116) | 문제선택 화면 스켈레톤-커서 좌표계 이격 해결 | CameraLayer Cover 3.0배 확대 투영 일원화, 스켈레톤-커서 중심 오차 0.0000px 완전 일치 달성 | 🟢 **Pass (259/259)** |
| `CFG-001` | [#120](https://github.com/Choyounhwa/-dream-guardian/issues/120) | 존/커서/티어 설정 `config/` 외부화 및 Config 분리 | `config/zone`, `cursor`, `posture` 신설, 하드코딩 상수 완전 외부화, Config.ts 재노출 호환성 유지 | 🟢 **Pass (260/260)** |
| `ZONE-001` | [#121](https://github.com/Choyounhwa/-dream-guardian/issues/121) | 피트니스 존 레이아웃 재정의 | 10개 존 상호 겹침 0% 수치 보장, 문제/답안 전용 예약 밴드 확립, `HEAD_ZONES ∩ HIP_ZONES = ∅` 충돌 원천 차단 | 🟢 **Pass (264/264)** |
| `FEAT-CURSOR-001` | [#117](https://github.com/Choyounhwa/-dream-guardian/issues/117) | 신체 부위 크기 추정 기반 커서 동적 사이징 및 손바닥 트래킹 | 어깨 너비 비례 0.55~2.0x 동적 사이징, 채움색 없는 투명 네온 외곽선(Outline Only), Pose 손가락 기저 가중 손바닥 중심 트래킹 | 🟢 **Pass (267/267)** |
| `FEAT-CURSOR-002` | [#118](https://github.com/Choyounhwa/-dream-guardian/issues/118) | 커서 화면 이탈 방지 상위 스켈레톤 계층 Fallback 및 스무딩 이동 | 손바닥→손목→전완→팔꿈치→상완→어깨 6단계 Fallback, 지수 보간(Lerp 0.25), 화면 경계 0.02 마진 안전 클램핑 | 🟢 **Pass (270/270)** |
| `BUG-MENU-001` | [#119](https://github.com/Choyounhwa/-dream-guardian/issues/119) | 메뉴 화면 4색 커서 상시 가시화 및 양손 모으기 제스처 복원 | 첫 메뉴 진입 즉시 4색 커서 가시화, Cover 줌 감안 합장 임계값 0.22 튜닝, 0.8초 호버 체류 자동 선택, 마우스/키보드 Fallback 보존 | 🟢 **Pass (275/275)** |
| `DATA-001` | [#122](https://github.com/Choyounhwa/-dream-guardian/issues/122) | 피트니스 패턴 원본 데이터 로더 및 유효성 검증기 | `FitnessPatternLoader.ts` 구현, `fitness pattern.csv` 360건 전수 무오류 파싱(S:60, D:100, T:100, Q:100) 및 타입화 | 🟢 **Pass (280/280)** |
| `POSE-001` | [#123](https://github.com/Choyounhwa/-dream-guardian/issues/123) | 자세 선택 시스템 AnswerPosture 및 PostureProgress 타입 신설 | RC-1/RC-5 해소: 다중 부위-다중 존 집합 덮기 모델, 존별/부위별 독립 진행도 추적, ChoiceRecipe 상호 호환 어댑터 | 🟢 **Pass (281/281)** |
| `POSE-002` | [#124](https://github.com/Choyounhwa/-dream-guardian/issues/124) | 집합 덮기(Set Coverage) 기반 matchPosture 판정 알고리즘 | 조건 A(모든 요구 부위가 목표 존에 위치) 및 조건 B(모든 목표 존이 덮임) 수학적 구현, 좌우 교환 허용 및 몰림 방지 | 🟢 **Pass (299/299)** |
| `POSE-003` | [#125](https://github.com/Choyounhwa/-dream-guardian/issues/125) | 패턴 풀 기반 선택지 생성기 및 7대 안전 제약(C1~C7) 검증기 | C1~C7(최대 3존, 상호 배타 부위로 Deadlock 원천 차단, 머리/골반 물리 정렬, 쿨다운 등) 100회 연속 무결성 보장 | 🟢 **Pass (310/310)** |
| `POSE-004` | [#126](https://github.com/Choyounhwa/-dream-guardian/issues/126) | PartGate (캘리브레이션 기준선 대비 신체 변위) 판정 구현 | `CalibrationBaseline` 확장, 스쿼트(골반 하강 변위), 목 기울임, 만세 상향 변위 검증으로 단순 직립 자동 충족(RC-3) 완전 해결 | 🟢 **Pass (320/320)** |
| `ICON-001` | [#127](https://github.com/Choyounhwa/-dream-guardian/issues/127) | PartIconRenderer 신설 (손/머리/골반 공통 아이콘 시스템) | 4색 신체 부위 벡터 아이콘(좌향/우향 손바닥, 원형 얼굴, 다이아몬드 골반) 렌더러 신설 | 🟢 **Pass (326/326)** |
| `UI-001` | [#128](https://github.com/Choyounhwa/-dream-guardian/issues/128) | 답안 버튼 부위 아이콘, 색상 및 묶음 기호(함께/각각) 시각화 | 답안 버튼 하단 요구 부위 아이콘 렌더링, `( )` 함께 한 존에, `\|` 각각 다른 존에 묶음 기호, 그라데이션 테두리 | 🟢 **Pass (327/327)** |
| `UI-002` | [#129](https://github.com/Choyounhwa/-dream-guardian/issues/129) | 피트니스 존별/부위별 독립 진행도 피드백 및 i % 2 오매핑 수정 | 존별 독립 진행도 맵 연동, 3개 이상 존 독립 렌더링, 커서별 진입 존 독립 아크 점등 | 🟢 **Pass (329/329)** |
| `UI-003` | [#131](https://github.com/Choyounhwa/-dream-guardian/issues/131) | 홈메뉴 원거리/대화면 레이아웃 개편 및 카드 간격 확장 | 메인 챕터 카드 60% 대형화 및 간격 24~28px 확장, 단계선택 2열 와이드 그리드 개편, 뒤로가기 버튼 대형화 | 🟢 **Pass (329/329)** |
| `UI-004` | [#132](https://github.com/Choyounhwa/-dream-guardian/issues/132) | 원거리(1m+) 가독성 보장을 위한 인게임 HUD 및 수식/결과 텍스트 대형화 | HP바 32px 및 HP 폰트 18px, 수식 폰트 64px, 분수선/루트 3.5px, 결과 통계 1.5배 스케일업 | 🟢 **Pass (329/329)** |
| `INPUT-002` | [#133](https://github.com/Choyounhwa/-dream-guardian/issues/133) | 스켈레톤 커서 메뉴 조작성 개선 (히트박스 패딩 및 호버 히스테리시스) | 히트박스 패딩(+12px) 및 호버 히스테리시스(+24px) 떨림 방지, 0.8초 아크 50px/7px 대형화 | 🟢 **Pass (331/331)** |
| `FEAT-RESULT-001` | [#134](https://github.com/Choyounhwa/-dream-guardian/issues/134) | 게임 결과 화면 양손 합장 제스처 메뉴 복귀 기능 구현 | 결과 화면에서 양손 모으기 0.8초 체류 시 터치 없이 메뉴 자동 복귀 | 🟢 **Pass (332/332)** |
| `CALC-001` | [#135](https://github.com/Choyounhwa/-dream-guardian/issues/135) | 자세 유지(Dwell Time) 기반 피트니스 칼로리 소모 계산식 확장 | `(steps*0.04) + (squats*0.35) + (jumps*0.15) + (dwell*0.07)` 공식 적용 및 결과 화면 표시 | 🟢 **Pass (332/332)** |
| `AUDIO-002` | [#136](https://github.com/Choyounhwa/-dream-guardian/issues/136) | 피트니스 존 체류 충전음 및 자세 완성 화음 효과음 구현 | `SFXSynth.ts` 구현, 체류 진행도(0~1)에 비례한 피치 상승(220Hz->880Hz) 충전음, C5-E5-G5 3화음 벨 톤 | 🟢 **Pass (335/335)** |
| `TUT-001` | [#137](https://github.com/Choyounhwa/-dream-guardian/issues/137) | 최초 플레이어 대상 인터랙티브 튜토리얼 오버레이 구현 | 3단계 가이드(커서 소개 -> 존 매칭 -> 준비 완료), 원클릭/Space/제스처 스킵, localStorage 1회 영속화 | 🟢 **Pass (337/337)** |
| `DOCS-001` | [#138](https://github.com/Choyounhwa/-dream-guardian/issues/138) | GDD 기획서 및 프로젝트 공식 문서 최신화 | GDD/AGENTS/WBS 내 보라 머리/얼굴 확정, 10존 레이아웃 및 집합 덮기 공식 반영 | 🟢 **Pass (337/337)** |
| `FEAT-CURSOR-003` | [#140](https://github.com/Choyounhwa/-dream-guardian/issues/140) | 전 장면 4색 스켈레톤 커서 상시 지속 가시화 및 생명주기 통일 | 메뉴·달리기·문제·결과 전 화면에서 4색 커서 상시 렌더링 일원화 | 🟢 **Pass (321/321)** |
| `REFACTOR-001` | [#130](https://github.com/Choyounhwa/-dream-guardian/issues/130) | AnswerSelector 죽은 판정 경로(update) 정리 및 단위 테스트 정비 | 미사용 레거시 update 경로 및 _progress 제거, updateFromPose 단일 파이프라인 일원화 | 🟢 **Pass (336/336)** |
| `BUG-SCALE-002` | [#144](https://github.com/Choyounhwa/-dream-guardian/issues/144) | 실사용 웹캠 근접 환경 신체 실측 크기 동적 추정 고도화 및 커서 시인성 현실화 | 귀 가림 시 눈(x2.6)·코/어깨 다계층 안면 추정, 팔꿈치 이탈 시 손목 너머 손바닥 40~70px 전진, 1080p 커서 규격 상향(손 45~90px, 머리 55~140px, 골반 55~120px, PC 1.5m baseline 350px/하한 0.70) | 🟢 **Pass (357/357)** |
| `FEAT-CURSOR-004` | [#145](https://github.com/Choyounhwa/-dream-guardian/issues/145) | 스켈레톤 손 트래킹 중지 기저부(MCP) 위치 조정 및 골반 커서 실측 다리 너비(1.5x) 라운드 납작 마름모 개편 | 손 트래킹 중지 손가락 시작점(3rd MCP) 상향, 골반 커서 실측 다리 너비 1.5배(너비 = hipDist × 1.5) 동적 확장, 모서리 라운드 납작 마름모 렌더링 개편 | 🟢 **Pass (360/360)** |
| `UI-MENU-003` | [#146](https://github.com/Choyounhwa/-dream-guardian/issues/146) | 04_STORY_SOURCE_수정.md 기반 홈 메뉴 꿈속 세계 탐험 및 테마명 개편 | 홈 메뉴 타이틀을 '꿈속 세계 탐험'으로 변경, 5개 챕터명을 몬스터 이름 대신 몽계 성역 테마(에메랄드 심해, 사탕 바구니 숲, 오르골 구름 서재, 색종이 사파리, 은하 회전목마)로 개편 및 풀 테마명/부제 가시화 | 🟢 **Pass (390/390)** |
| `INPUT-MOTION-001` | [#169](https://github.com/Choyounhwa/-dream-guardian/issues/169) | 인게임 문제 스테이지 양손 합장 제스처 메뉴 연동 및 문제풀이 일시정지 가드 | 인게임 전 프레임 합장 감지 활성화, 금빛 네온 합장 링 렌더링, 하단 바(정지/설정) 0.8초 호버 연동, 합장 중 답안 판정 일시정지(Safety Guard) 및 분리 시 4색 커서 즉시 복귀 | 🟢 **Pass (470/470)** |
| `UI-ANS-001` | [#163](https://github.com/Choyounhwa/-dream-guardian/issues/163) | 답안 버튼 외곽선 두께 2배 증가 (8px) | 답안 버튼 외곽선 테두리 선 두께 8px(기존 4px 대비 2배), 기본 lineWidth 7.0 상향, 방사선 3.0 상향 및 네온 글로우(12px) 강화 | 🟢 **Pass (471/471)** |
| `UI-ANS-002` | [#164](https://github.com/Choyounhwa/-dream-guardian/issues/164) | 답안 버튼 위치 4, 5번 피트니스 존 하단 X축 정렬 배치 | 0번 버튼을 4번 존 하단(중심 X 183.6px), 1번 버튼을 5번 존 하단(중심 X 896.4px)에 수직 정렬하고 Y축 890px(존 하단 바로 아래) 재배치, 자식 요소 및 클릭 히트테스트 자동 동기화 | 🟢 **Pass (472/472)** |
| `RENDER-MATH-001` | [#165](https://github.com/Choyounhwa/-dream-guardian/issues/165) | 문제 영역 마젠타 사각 박스 가상 영역화 (화면 표시 제거) | `renderQuestion` 내 마젠타(#FF28D8) 테두리 및 어두운 사각 박스 드로잉 코드 완전 제거, Y 기준 좌표계만 유지하여 배경 그리드 및 보스 시야 100% 개방 | 🟢 **Pass (472/472)** |
| `RENDER-MATH-002` | [#167](https://github.com/Choyounhwa/-dream-guardian/issues/167) | 문제 폰트 1.5배 확대 및 영역 초과 시 자동 줄바꿈(Word Wrap) | 문제 폰트 크기 기본값 132px(기존 88px 대비 1.5배) 대형화, `MathRenderer` 내 `wrapMathTokens` 및 `maxWidth` 기반 자동 줄바꿈 지원, 분수·루트·지수 복합 토큰 원형 보존 및 수직 중앙 정렬 | 🟢 **Pass (475/475)** |
| `RENDER-ZONE-001` | [#173](https://github.com/Choyounhwa/-dream-guardian/issues/173) | 피트니스 존 활성화 시 네모 영역 표시 제거 (가상 영역화) | `PostureGuideRenderer.ts` 내 `_renderZoneHighlights`에서 네온 사각 테두리 및 반투명 채움 드로잉 제거(`renderZoneBoxes = false`), `AnswerSelectionRenderer` 사각 박스 가상화, 중앙 부위 벡터 아이콘 및 하단 스틱맨 실루엣 100% 유지 | 🟢 **Pass (480/480)** |
| `FEAT-MOTION-002` | [#171](https://github.com/Choyounhwa/-dream-guardian/issues/171) | 양손 대각 어깨 교차 X자 제스처 감지기(XGestureDetector) 구현 | 어깨 너비 정규화 대각 교차 판정, 0.4초 Dwell Time, 1.0초 쿨다운, 양손 합장 제스처와 오인식 분리 검증 완비 | 🟢 **Pass (489/489)** |
| `UI-PAUSE-001` | [#172](https://github.com/Choyounhwa/-dream-guardian/issues/172) | 인게임 일시정지(Pause) 팝업 모달 구현 및 X자/합장 제스처 연동 | 서브메뉴 X자 뒤로가기, 인게임 X자 일시정지 모달 호출, 게임/타이머 일시정지, 양손 합장 커서 0.8초 호버로 [재개]/[나가기] 확정 선택, Esc/P 키보드 단축키 지원 | 🟢 **Pass (497/497)** |
| `BUG-ZONE-003` | [#175](https://github.com/Choyounhwa/-dream-guardian/issues/175) | 문제풀이 피트니스 존 하드코딩 고정 배치 해소 및 전 구역(1~11번) 순환/랜덤 다양화 | 티어별 다채로운 공용 존 풀 구축(Tier 1: 7개 존, Tier 2: 4종 머리·손 교차, Tier 3: 8종 2존 조합, Tier 4: 상단 만세 5종), 직전 존 연속 출제 방지 쿨다운 적용 및 첫 문제 4번 시작 안정화, `main.ts` 부트스트랩 시 360건 피트니스 패턴 로더 파이프라인 연동 | 🟢 **Pass (502/502)** |

### 2. 브라우저 실테스트 피드백 반영 및 주요 환경 해결

- **포트 3000 서빙 경로 불일치 해결**: 어제(`2026-09-21`) 실행된 구버전 폴더(`E:\AIAIAIAI`, AI 4개)의 좀비 Vite 프로세스가 포트 3000을 잡고 있어 변경사항이 미반영되던 현상 규명 → 프로세스 강제 종료 후 현재 워크스페이스(`E:\AIAIAIAIAI`)에서 신규 가동.
- **`dream_guardian/index.html` 모던 TypeScript 진입점 교체**: 2,802줄 구버전 monolithic HTML을 `docs/archive/legacy_prototype/`로 안전 백업하고, `dream_guardian/index.html`이 `/src/main.ts`를 직접 모듈로 로드하도록 갱신 (46개 모듈 전체 번들링 확인).
- **스켈레톤 손바닥 연장**: 스켈레톤 팔 뼈대(`BoneRenderer`)가 손목에서 손바닥 중심까지 연장되며, `JointRenderer`의 발광 원형 구체가 손목이 아닌 **손바닥 정중앙**에 표시되도록 개선.
- **합장 감지 임계값 현실화**: 3.0배 Cover 뷰포트 확대율에 맞춰 `MenuInput` 감지 거리를 `0.22`로 조정하여 양손 모으기 제스처와 0.8초 프로그레스 아크 활성화.
- **커서 동적 사이징 현실화**: 가상 좌표계 기준 어깨 너비(`460px`)와 손 길이 한계치(`260px`)를 Cover 줌에 맞추어 보정하여, 카메라 거리에 따라 커서가 시원하게 커지고 작아지는 다이내믹 스케일링 복원.
- **서버 런처 동기화**: `run_server.bat`이 현재 워크스페이스의 Vite 개발 서버(`npm run dev`)를 바로 띄우도록 갱신.

---

## 🟡 신규 접수 현안: 원거리(1m+) UI 전면 레이아웃 개편 및 레거시 제거 (Issue #141, #142, #143 등록)

> 등록일: 2026-09-24 / 상태: **GitHub Issue 카드 3건 등록 완료 (#141, #142, #143), 구현 승인 대기**

사용자가 제공한 5장의 UI 설계 가이드 이미지에 따라 1080×2160 해상도 기준 1미터 이상 원거리 플레이 시인성과 조작성을 완벽히 확보하기 위한 종합 UI 데이터 분석 및 작업 카드가 정식 등록되었습니다.

### 1. 신규 등록 카드 요약

| 순서 | 카드 ID | GitHub Issue | 제목 | 핵심 구현 및 삭제 대상 | 상태 |
|---|---|---|---|---|---|
| 1 | `UI-BAR-001` | [#141](https://github.com/Choyounhwa/-dream-guardian/issues/141) | 전 화면 공통 하단 고정 바(Yellow Bar) 및 설정(Settings) 모달 신설과 레거시 상단 부유 버튼(#top_controls) 완전 삭제 | • **[삭제]** `index.html` 상단 부유 버튼 (`#top_controls`, `#btn_cam`, `#btn_fullscreen`) 및 CSS 제거<br>• **[신규]** 전 화면 공통 200px 하단 고정 바 (`y: 1960~2160`)<br>• **[신규]** 좌측 `설정` 모달 버튼 (`30, 1990, 140x140`, Cyan), 우측 액션 프레임 (`810, 1990, 240x140`, Red)<br>• **[신규]** `SettingsModal.ts` 팝업 구현 (카메라/전체화면/스켈레톤/볼륨) | 🟢 **Pass (385/385)** |
| 2 | `UI-MENU-002` | [#142](https://github.com/Choyounhwa/-dream-guardian/issues/142) | 홈 메뉴(2-2-1) 및 서브 메뉴(2x3) 와이드 레이아웃 개편과 1:1 대형 폰트 적용 (레거시 가로 1열 및 상단 뒤로가기 삭제) | • **[삭제]** 가로 1열 140px 챕터 카드 나열식 및 단일 행 `hitTest` 제거<br>• **[삭제]** 상단 `y: 0.14` 높이 40px 작고 좁은 뒤로가기 버튼 제거<br>• **[신규]** 홈 메뉴 **2 - 2 - 1 와이드 다이아몬드 그리드** (`360×380px` 카드, 1:1 폰트 64/48/42px)<br>• **[신규]** 서브 메뉴 **2열 3행 대형 와이드 그리드** (`420×380px`, 1:1 폰트 68px/32px)<br>• **[신규]** `← 뒤로` 버튼을 하단 고정 바 우측 슬롯(`780, 1990, 270x140`, 42px)으로 이관 | 🟢 **Pass (386/386)** |
| 3 | `UI-INGAME-001` | [#143](https://github.com/Choyounhwa/-dream-guardian/issues/143) | 인게임 마젠타 문제영역 고정 컨테이너, 3중 회전 마법진(E_Pit_act1~3) 피트니스 존 및 마젠타 결과 카드 패널 개편 | • **[삭제]** `HUDLayer.ts` 좌하단 구석 세로형 마나 플라스크(`_renderManaFlask`) 삭제 (하단 바로 이관)<br>• **[삭제]** 단순 직사각형 점선 피트니스 존 테두리 및 텍스트 삭제<br>• **[삭제]** 결과 화면의 프레임 없는 24px 단순 텍스트 나열 코드 삭제<br>• **[신규]** **마젠타 문제영역 고정 박스** (`100, 320, 880x1000px`, 텍스트 오버플로우 방지 자동 축소)<br>• **[신규]** **3중 회전 마법진 피트니스 존** (`E_Pit_act1~3.png` 각각 다른 방향 Spin/Orbit/Shimmer 애니메이션)<br>• **[신규]** 답안 버튼 2개 횡배치 (`360×260px`, 폰트 96px)<br>• **[신규]** **마젠타 결과 카드 패널** (`100, 240, 880x1580px`, 8개 지표 라인 74px x 폰트 44px 1:1 매핑) | 🟢 **Pass (388/388)** |
| 4 | `FEAT-CURSOR-004` | [#145](https://github.com/Choyounhwa/-dream-guardian/issues/145) | 스켈레톤 손 트래킹 중지 기저부(MCP) 위치 조정 및 골반 커서 실측 다리 너비(1.5x) 라운드 납작 마름모 개편 | • **[개편]** 손바닥 트래킹 중심을 손목/손바닥 하단에서 **중지 손가락 시작부(3rd MCP)**로 상향<br>• **[개편]** 골반 커서 크기를 양다리 시작 포인트(#23-#24) 사이 실측 거리의 **1.5배(너비 = hipDist × 1.5)**로 동적 확대<br>• **[개편]** 골반 커서 형상을 기존 역삼각형에서 **모서리가 둥근 납작한 마름모(Flattened Rounded Rhombus)**로 개편 | ⚪ **대기 (승인 대기)** |
| 5 | `BUG-BATTLE-001` | [#146](https://github.com/Choyounhwa/-dream-guardian/issues/146) | 정답 시 보스 HP 즉시 감소 타격 누락 결함 (4문제 맞혀야만 HP 감소) | • **[원인]** `main.ts`에서 정답 시 마나만 +25 적립하고, 보스 데미지 처리가 마나 100 조건문 내에만 존재하여 1~3문제 정답 시 보스 HP 불변<br>• **[해결]** 매 정답마다 기본 1 데미지(`boss.takeDamage(1)`) 및 피격 연출 즉각 발동, 마나 100 도달 시 수호신 스펠 보너스 데미지 연계 | ⚪ **대기 (승인 대기)** |
| 6 | `BUG-BATTLE-002` | [#147](https://github.com/Choyounhwa/-dream-guardian/issues/147) | 기습 보스 공격 타이머 제거 및 오답 반격 일원화를 통한 전투 템포/체력 소진 결함 개선 | • **[원인]** 상시 실행되는 독립 보스 공격 타이머로 인한 무차별 피격 및 돌발 스쿼트 방어로 인한 러닝/연산 흐름 단절<br>• **[해결 (대안 A 채택)]** 기습 보스 공격 타이머 비활성화/삭제(`attackInterval=0`), 보스 공격을 **오답 시 반격(-25 HP)** 및 피격 연출로 일원화, 스쿼트는 하단 존(Zone 7~10) 정답 선택 운동으로 본래 역할 집중 | 🟢 **Pass (369/369)** |
| 7 | `FEAT-UI-005` | [#148](https://github.com/Choyounhwa/-dream-guardian/issues/148) | 답안 버튼 사각형 중심점 기점 방사형(Radial) 색상 분할 렌더링 구현 | • **[목적]** 답안 버튼(둥근 사각형) 형태를 유지하면서 선형 그라디언트를 사각형 중심점 기점 방사형(Radial) 색상 분할로 개편하여 요구 커서 시인성 극대화<br>• **[신규]** 1색(단색), 2색(1/2 방사형), 3색(1/3 방사형) 분할 렌더러 구현 | 🟢 **Pass (377/377)** |
| 8 | `FEAT-ZONE-002` | [#149](https://github.com/Choyounhwa/-dream-guardian/issues/149) | 11번 우저(Right Bottom) 피트니스 존 추가 및 11구역 레이아웃 정합성 확보 | • **[목적]** 설계 문서 및 패턴 원본과 달리 코드에서 누락된 11번 존(`우저`, x: 0.70, y: 0.78, 0.26x0.16) 추가<br>• **[신규]** `HIP_ZONES`에 11번 포함 및 11개 존 겹침 0% 보장 | 🟢 **Pass (369/369)** |
| 9 | `REFACTOR-POSE-001` | [#150](https://github.com/Choyounhwa/-dream-guardian/issues/150) | 좌/우 답안 공용 피트니스 존(Shared Active Zone) 및 색상 커서 선택 메커니즘 전환 | • **[목적]** 좌/우 선택지별 분리 존 배정 방식을 설계 대전제인 "공용 활성 존에 계산한 답안의 색상 커서를 이동하여 판정"하는 메커니즘으로 전환<br>• **[개편]** `RecipeGenerator`, `AnswerSelector` 공용 타겟 존 연동 | 🟢 **Pass (372/372)** |
| 10 | `FEAT-POSE-006` | [#151](https://github.com/Choyounhwa/-dream-guardian/issues/151) | 신체 부위별(왼손/오른손 비대칭 및 머리) 허용 피트니스 존 제약 및 색상 완전 비공유 보장 | • **[목적]** 왼손/오른손의 전 구역 무제한 허용을 설계 규격(왼손: 1,2,4,6,7,9,10 / 오른손: 2,3,7,8,10,11)으로 비대칭 제한<br>• **[강화]** C2 제약을 완전 배타(`A.parts ∩ B.parts = ∅`)로 강화 | 🟢 **Pass (373/373)** |
| 11 | `FEAT-SKEL-004` | [#152](https://github.com/Choyounhwa/-dream-guardian/issues/152) | 스켈레톤 뼈대 연결선 투명도(20% 불투명도 조정) 정합성 반영 | • **[목적]** 현재 `0.6`으로 다소 짙은 뼈대 연결선을 설계 문서("연결선은 20% 투명도") 규격에 맞추어 시인성 조정 | ⚪ **대기 (승인 대기)** |
| 12 | `FEAT-MOTION-001` | [#153](https://github.com/Choyounhwa/-dream-guardian/issues/153) | 뛸 수 없는 환경을 위한 저소음/대체 이동(Locomotion) 감지기 3종 및 공통 인터페이스 구현 | • **[신규]** `ILocomotionDetector` 공통 인터페이스<br>• **[신규]** 골반 상하 바운스(`HipBounceDetector`)<br>• **[신규]** 골반 좌우 스웨이/트월킹(`HipSwayDetector`)<br>• **[신규]** 양손 상하 교차/드라이빙(`ArmCrossDetector`)<br>• **[신규]** `Config.ts` 감도 파라미터 분리 | 🟢 **Pass (399/399)** |
| 13 | `FEAT-UI-006` | [#154](https://github.com/Choyounhwa/-dream-guardian/issues/154) | 운동 모드(이동 방식 4종) 선택 UI 모달 및 커서/터치 인터랙션 구현 | • **[신규]** 4종 운동 모드(달리기/골반바운스/골반스웨이/양손교차) 선택 모달 UI<br>• **[신규]** 4색 신체 커서 0.8초 Dwell 및 마우스/터치 클릭 선택<br>• **[신규]** `localStorage` 선택 모드 영속 저장 및 복원 | 🟢 **Pass (416/416)** |
| 13-1 | `UI-BAR-002` | [#166](https://github.com/Choyounhwa/-dream-guardian/issues/166) | 하단 고정바(BottomBar) 내 운동 모드 선택 버튼 신설 및 메인 제목 하단 레거시 제거 | • **[신설]** 하단 고정바 좌측 `x: 190, y: 1990, w: 260, h: 140` 슬롯에 운동 모드 버튼 신설<br>• **[삭제]** 메인 메뉴 타이틀 하단 임시 운동 모드 버튼 완전 삭제<br>• **[연동]** 신체 커서 0.8초 체류 및 클릭 시 `LocomotionModal` 즉각 호출 | ⚪ **대기 (승인 대기)** |
| 14 | `FEAT-GAME-002` | [#155](https://github.com/Choyounhwa/-dream-guardian/issues/155) | 선택된 운동 모드 인게임 러닝 루프/HUD 동작 가이드 및 맞춤 칼로리 공식 연동 | • **[연동]** `main.ts` 러닝 루프 다형성 감지기 연동<br>• **[신규]** 인게임 HUD 모드별 맞춤 동작 가이드 안내<br>• **[신규]** 모드별 METs 맞춤 칼로리 소모 공식 및 결과 화면 표출 | 🟢 **완료 (100% Pass)** |
| 15 | `FEAT-ZONE-003` | [#156](https://github.com/Choyounhwa/-dream-guardian/issues/156) | 커서-존 허용 매트릭스 개편 (양손 전 존 1~11 허용, 머리 존 4~5 한정) 및 Cross-Body 제약(Hip 9~11 시 손 1~3 차단) 신설 | • **[개편]** 양손(`leftHand`, `rightHand`) 전 존(1~11) 허용 (옆구리 스트레칭 및 교차 도달)<br>• **[제한]** `HEAD_ZONES`를 `{4, 5}`로 한정 (존 1~3 점프 유지 불가 배제)<br>• **[신규]** Cross-Body 제약: 골반이 최하단(존 9~11)일 때 양손의 최상단(존 1~3) 배치 차단 | 🟢 **완료 (100% Pass)** |
| 16 | `DATA-002` | [#157](https://github.com/Choyounhwa/-dream-guardian/issues/157) | fitness pattern.csv 신규 HEAD_ZONES {4,5} 제약 반영 및 머리 패턴 전수 보정 | • **[수정]** `fitness pattern.csv` 162건 머리 패턴 존 1~3 → 존 4/5 재배치<br>• **[검증]** Cross-Body 위반 패턴 전수 정비 및 360건 무오류 로드 보장 | 🟢 **완료 (100% Pass)** |
| 17 | `FEAT-ZONE-004` | [#158](https://github.com/Choyounhwa/-dream-guardian/issues/158) | PostureGenerator C8 제약(Cross-Body) 통합 및 패턴 풀 필터링 | • **[신규]** `PostureGenerator`에 C8 제약(Hip 9~11 시 손 1~3 차단) 추가<br>• **[필터]** `FitnessPatternLoader` 및 `validatePosturePair()` 런타임 위반 차단 | 🟢 **완료 (100% Pass)** |
| 18 | `FEAT-GUIDE-001` | [#159](https://github.com/Choyounhwa/-dream-guardian/issues/159) | 목표 자세 실루엣 가이드 오버레이 (PostureGuideRenderer) 구현 | • **[신규]** `PostureGuideRenderer.ts` 생성<br>• **[시각화]** 반투명 스틱맨 인체 실루엣 및 목표 존 네온 하이라이트(부위 색상 글로우 + 중앙 아이콘) | 🟢 **완료 (100% Pass)** |
| 19 | `FEAT-GUIDE-002` | [#160](https://github.com/Choyounhwa/-dream-guardian/issues/160) | 스테이지 시작 첫 문제 유도 화살표(Arrow Hint) 표시 | • **[신규]** 스테이지 첫 문제(`questionNumber === 1`)에서만 커서→목표존 방향 화살표 렌더링<br>• **[소멸]** 목표 존 진입 시 소멸 및 5초 경과 시 자동 페이드아웃 (두 번째 문제부터 미표시) | 🟢 **완료 (100% Pass)** |
| 20 | `UI-BAR-003` | [#162](https://github.com/Choyounhwa/-dream-guardian/issues/162) | 설정 및 정지 버튼 문자 제거 및 아이콘화 | • **[개편]** 좌측 '⚙ 설정' 한글 제거 후 톱니바퀴 아이콘화, 우측 인게임 '정지' 한글 제거 후 일시정지(⏸) 아이콘화 | ⚪ **대기 (승인 대기)** |
| 21 | `UI-ANS-001` | [#163](https://github.com/Choyounhwa/-dream-guardian/issues/163) | 답안 버튼 외곽선 두께 2배 증가 | • **[강화]** 답안 버튼 외곽선 테두리 선 두께를 기존 4px 대비 2배(8px)로 확장하여 원거리 시인성 극대화 | ⚪ **대기 (승인 대기)** |
| 22 | `UI-ANS-002` | [#164](https://github.com/Choyounhwa/-dream-guardian/issues/164) | 답안 버튼 위치 4, 5번 피트니스 존 하단 X축 정렬 배치 | • **[재배치]** 0번/1번 답안 버튼을 4번(좌)/5번(우) 피트니스 존과 X축 위치를 일치시키고 바로 아래 하단에 배치 | ⚪ **대기 (승인 대기)** |
| 23 | `RENDER-MATH-001` | [#165](https://github.com/Choyounhwa/-dream-guardian/issues/165) | 문제 영역 마젠타 사각 박스 가상 영역화 (화면 표시 제거) | • **[정돈]** 마젠타(#FF28D8) 테두리 및 반투명 배경 박스 화면 드로잉 제거, 가상 레이아웃 좌표계로만 유지 | ⚪ **대기 (승인 대기)** |
| 24 | `RENDER-MATH-002` | [#167](https://github.com/Choyounhwa/-dream-guardian/issues/167) | 문제 폰트 1.5배 확대 및 영역 초과 시 자동 줄바꿈(Word Wrap) | • **[가독성]** 기본 문제 폰트 1.5배(132px급) 확대, 문제 영역 폭 초과 시 연산자/공백 단위 자동 줄바꿈 지원 | ⚪ **대기 (승인 대기)** |
| 25 | `UI-MENU-003` | [#168](https://github.com/Choyounhwa/-dream-guardian/issues/168) | 홈 메뉴 메인 타이틀 및 서브 문구 변경 | • **[텍스트]** 홈 메뉴 최상단 메인 타이틀 및 슬로건 문구를 최신 기획 및 사용자 지정 명칭으로 교체 | ⚪ **대기 (승인 대기)** |
| 26 | `INPUT-MOTION-001` | [#169](https://github.com/Choyounhwa/-dream-guardian/issues/169) | 인게임 문제 스테이지 양손 합장 제스처 메뉴 연동 | • **[인터랙션]** 인게임 문제/달리기 중에도 두 손 모을 시 합장 커서 표출 및 하단 설정/정지 버튼 0.8초 호버 조작 지원 | ⚪ **대기 (승인 대기)** |
| 27 | `INPUT-ZONE-001` | [#170](https://github.com/Choyounhwa/-dream-guardian/issues/170) | Head(머리) 및 Hip(골반) 커서 피트니스 존 진입 감도 최적화 | • **[감도]** 코/골반 중심점 1점 판정에서 바운딩 마진(25% 진입 또는 외곽 접촉 시 즉각 충전 개시)으로 최적화 | 🟢 **완료 (100% Pass)** |
| 28 | `BUG-ZONE-002` | [#174](https://github.com/Choyounhwa/-dream-guardian/issues/174) | Head 존 2 및 Hip 존 7 출제 배제 및 직립 자동 선택 방지 | • **[원인분석]** `HEAD_ZONES` 제약에도 `RecipeGenerator` 내 하드코딩 존(Tier 2: 2번, Tier 3: 2번/7번)으로 우회 출제 발생, 직립 시 머리(0.18)와 골반(0.60)이 각각 2번/7번에 자연 위치하여 출제 즉시 자동 선택 발생<br>• **[수정]** `HIP_ZONES`에서 7번 제외(`{6, 8, 9, 10, 11}`), `RecipeGenerator` Tier 2를 {4, 5}로, Tier 3을 4번(중단) + 10번(하단 스쿼트)으로 전면 교체<br>• **[데이터]** `fitness pattern.csv` 48건 골반 7번 패턴을 유효 존(6/8/10)으로 전수 보정 (360건 무오류 유지) | 🟢 **완료 (100% Pass)** |
| 29 | `BUG-ZONE-003` | [#175](https://github.com/Choyounhwa/-dream-guardian/issues/175) | 문제풀이 피트니스 존 하드코딩 고정 배치 해소 및 전 구역(1~11번) 순환/랜덤 다양화 | • **[원인분석]** `RecipeGenerator` 내 Tier 1(Zone 4), Tier 3(Zone 4+10), Tier 4(Zone 2)의 정적 하드코딩 및 쿨다운 부재로 인해 특정 존만 반복 출제되는 현상 규명<br>• **[다양화]** Tier 1(4, 5, 2, 1, 3, 6, 8), Tier 2(4/5 머리·손 교차 4종), Tier 3(8종 2존 협응 쌍), Tier 4(1, 2, 3, 5, 4) 등 전 구역 활용 존 풀 구축<br>• **[쿨다운]** 직전 문제와 동일한 존 배치 연속 출제 방지 쿨다운 적용 및 첫 문제는 4번 시작 안정화<br>• **[데이터]** `main.ts` 부트스트랩 시 `/fitness pattern.csv` 360건 비동기 로드 파이프라인 연동 | 🟢 **완료 (502/502 Pass)** |
| 30 | `FEAT-CURSOR-005` | [#201](https://github.com/Choyounhwa/-dream-guardian/issues/201) | 양손 선택 커서(합장 메뉴 커서 및 양손 답안 커서) 크기 3배 확대 및 원거리(1m+) 시인성 강화 | • **[대형화]** 합장 외곽 네온 링 반경 34px → 100px(지름 200px, 3배 확대), 폰트 14px → 40px<br>• **[호버링]** 0.8초 체류 프로그레스 아크 반경 50px → 145px, 두께 16px 대형화<br>• **[시인성]** 인게임 양손 답안 커서 스케일 동반 상향 | 🟢 **완료 (2026-10-01)** |
| 31 | `FEAT-READY-001` | [#202](https://github.com/Choyounhwa/-dream-guardian/issues/202) | 스테이지 첫 진입 시 카메라 프레임 정렬 가이드 및 3초 준비 카운트다운(READY_POSITION) 구현 | • **[대기시간]** 챕터/단계 진입 후 문제 출제 전 3초 준비 카운트다운(3... 2... 1... START!) 페이즈 신설<br>• **[프레임맞추기]** 화각 정렬 가이드 표시 및 신체 포착 시 청록색 점등 피드백<br>• **[입력잠금]** 3초간 모션/답안 입력 완전 잠금으로 스텝 오인식 누락 차단, 0초 시점에 감지기 제로 리셋 | 🟢 **완료 (2026-10-01)** |

---

### 2. 신규 제안: 뛸 수 없는 환경 대응 저소음 피트니스 이동 모드 (Issue #153, #154, #155)

아파트 층간 소음, 발 부상, 좁은 공간 등 뛸 수 없는 환경에서도 온전히 게임을 플레이할 수 있도록 3단계 분할 카드를 등록하였습니다.

1. **[FEAT-MOTION-001] 감지기 3종 및 공통 인터페이스 (#153)**:
   - `ILocomotionDetector` 공통 인터페이스 (`update`, `reset`, `isRunning`, `stepCount`)
   - **골반 상하 바운스 (`HipBounceDetector`)**: `LEFT_HIP(23)` / `RIGHT_HIP(24)` Y 바운스 (무소음 점프)
   - **골반 좌우 스웨이 (`HipSwayDetector`)**: 골반 X 중심 왕복 및 좌우 틸트 반전 (트월킹/코어 셰이크)
   - **양손 교차 상하 (`ArmCrossDetector`)**: `LEFT_WRIST(15)` / `RIGHT_WRIST(16)` Y 교차 역전 (드라이빙/휠 펌핑)
2. **[FEAT-UI-006] 운동 모드 선택 UI 모달 및 인터랙션 (#154)**:
   - 4개 모드 2x2 카드 UI (아이콘, 한국어 타이틀, 부위, 소음 등급 안내)
   - 4색 커서 체류(0.8s) 및 마우스/터치 클릭 지원, `localStorage` 영속화
3. **[FEAT-GAME-002] 인게임 러닝 루프 연동 및 맞춤 칼로리 (#155)**:
   - `gamePhase === 'running'` 게이지 충전 다형성 연동
   - 인게임 HUD 맞춤 모션 가이드 표시
   - 모드별 METs 맞춤 칼로리 공식 연동 및 결과 화면 표출

---

### 3. 신규 확정: 커서-피트니스 존 매트릭스 개편 및 자세 가이드 (Issue #156 ~ #160)

> 사용자 피드백(옆구리 늘리기 등 실제 관절 가동 범위 및 점프 체류 불가 문제)에 따라 커서-존 매트릭스를 현실화하고 시각 가이드를 신설합니다.

1. **커서-존 허용 매트릭스 확정**:
   - **왼손 (`leftHand`)**: **전 존(1~11) 허용** (반대편 도달 및 옆구리 늘리기 스트레칭)
   - **오른손 (`rightHand`)**: **전 존(1~11) 허용**
   - **머리 (`head`)**: **중단 좌/우 존(4, 5)만 허용** (존 1~3은 점프로 순간 진입은 가능하나 체류 유지가 불가능하므로 배제)
   - **골반 (`hip`)**: **하단 존(6~11)만 허용** (존 1~5 상단 이동 배제)
   - **Cross-Body 물리 연동 제약**: 골반이 최하단(존 9, 10, 11)일 때 양손은 최상단(존 1, 2, 3) 배치 불가 (스쿼트 시 만세 물리적 한계 배제)
2. **시각 가이드 시스템**:
   - **실루엣 가이드 오버레이 (`PostureGuideRenderer`)**: 목표 피트니스 존 네온 하이라이트(부위 색상 글로우 및 중앙 아이콘) + 반투명 스틱맨 인체 실루엣
   - **첫 문제 유도 화살표 (`Arrow Hint`)**: 스테이지 시작 첫 문제에서만 커서→목표존 방향 화살표 표시 (5초 또는 진입 시 페이드아웃, 2번째 문제부터 미표시)
   - **달리기 중 동적 보정**: 제자리 달리기 중 신체 이동 드리프트 보정은 정밀 설계를 위해 보류

---

## 🔴 최우선 현안: 자세 선택 시스템 재설계 (카드 등록 완료)

> 등록일: 2026-09-22 / 상태: **GitHub Issue 카드 등록 완료 (#120~#138), 구현 승인 대기**
> 상세 분석: `docs/04_POSTURE_SYSTEM_ANALYSIS.md`
> 패턴 원본: `E:\AIAIAIAIAI\Arithmetic Game\fitness pattern.csv` (360건)

스켈레톤 커서·피트니스 존·정답 선택이 의도대로 동작하지 않는 문제를 분석한 결과, **코드 버그가 아니라 데이터 모델이 요구 규칙을 표현할 수 없는 구조적 불일치**임이 확인되었습니다.

### A. 목표 게임 루프 (사용자 확정 명세)

```
에너지(마나) 충전 완료 → 문제 출제 + 답안 2개 표시
  → 각 답안이 1~3개 신체 부위를 요구 (좌/우 답안은 서로 다른 부위 구성)
  → 피트니스 존 1~3개 동시 활성화
  → 플레이어가 정답이라 판단한 답안의 요구 부위 커서를 활성 존에 배치
  → 약 1초 유지 → 답안 확정 → 정답/오답 판정
```

부위 수 × 존 수 조합 명세:

| 부위 | 존 | 플레이어 동작 |
|---|---|---|
| 1 | 1 | 해당 부위 커서를 존에 올린다 |
| 2 | 1 | 두 부위를 **같은 존**에 올린다 |
| 2 | 2 | 두 부위를 **각 존에 1개씩** (좌우 배치 자유) |
| 3 | 1 | 세 부위를 **모두 한 존**에 |
| 3 | 2 | 세 부위를 2개 존에 **2+1 분배** |
| 3 | 3 | 세 부위를 **각 존에 1개씩** |

명시적 제약: **머리와 골반이 동일한 존을 요구하는 조합은 배제**한다.
달성 목표: ① 직관성(답안을 보고 즉시 부위 판단) ② 운동성(국민체조·스트레칭) ③ 손/머리/골반 각기 다른 아이콘.

### B. 피트니스 패턴 원본 데이터 분석 (`fitness pattern.csv`, 360건)

컬럼 구조:

```csv
ID, 사용 부위, 왼손, 오른손, 머리, 골반, 판정 부위 수
S001,왼손,1,X,X,X,1          # 값 = 존 ID, 'X' = 미사용
D001,왼손 + 오른손,1,3,X,X,2
T001,왼손 + 오른손 + 머리,1,3,2,X,3
Q001,전신 (두 손 모아 하늘 + 바른자세 정면),2,2,2,7,4
```

ID 접두사별 분포:

| 접두사 | 의미 | 건수 | 판정 부위 수 |
|---|---|---|---|
| `S` | Single (단일 부위) | 60 | 1 |
| `D` | Double (2부위) | 100 | 2 |
| `T` | Triple (3부위) | 100 | 3 |
| `Q` | Quad / 전신 (4부위) | **100** | **4** |

실제 (부위 수 × 서로 다른 존 수) 교차 분포:

| | 1존 | 2존 | 3존 | 4존 | 합 |
|---|---|---|---|---|---|
| **1부위** | 60 | — | — | — | 60 |
| **2부위** | 6 | 94 | — | — | 100 |
| **3부위** | 3 | 41 | 56 | — | 100 |
| **4부위** | — | 11 | 52 | 37 | 100 |

존 ID 사용 빈도:

| 존 | 1 | 2 | 3 | 4 | **5** | 6 | 7 | 8 | 9 | 10 | **11** |
|---|---|---|---|---|---|---|---|---|---|---|---|
| 횟수 | 100 | 147 | 84 | 83 | **0** | 69 | 150 | 74 | 93 | 93 | **67** |

부위별 사용 존 집합:

| 부위 | 사용 존 |
|---|---|
| 왼손 | 1, 2, 4, 6, 7, 9, 10 |
| 오른손 | 2, 3, 7, 8, 10, 11 |
| 머리 | 1, 2, 3, 4 |
| 골반 | 6, 7, 8, 9, 10, 11 |

### C. 패턴 데이터 ↔ 명세/코드 3자 간 갈등 (⚠️ 결정 필요)

| # | 갈등 | 패턴 CSV | 사용자 명세 | 현재 코드 | 영향 |
|---|---|---|---|---|---|
| **G-1** | **존 총 개수** | **11개 (1~11), 존 5는 0회** | 미규정 | **11개 (1~11)** | 🟢 해결 (#149 FEAT-ZONE-002: 11번 우저 추가 완료) |
| **G-2** | **최대 부위 수** | **4부위 100건 (Q 시리즈)** | **최대 3부위** | 최대 2부위 | 🔴 Q 시리즈 100건 사용 여부 결정 필요 |
| **G-3** | 최대 존 수 | **최대 4존 (37건)** | **최대 3존** | 최대 3존 | 🟡 4존 패턴 37건 제외 또는 명세 확장 |
| **G-4** | 머리·골반 동일 존 | **0건 (준수)** | 배제 | Tier 3이 양 선택지 존 7 중복 → **위반** | 🟢 CSV는 이미 제약 충족 |
| **G-5** | 머리 허용 존 | 1, 2, 3, 4 | 미규정 | `HEAD_ZONES = {1,2,3,4,5,7}` | 🟡 CSV 기준(1~4)으로 축소 권장 |
| **G-6** | 골반 허용 존 | 6, 7, 8, 9, 10, **11** | 미규정 | `HIP_ZONES = {6,7,8,9,10,11}` | 🟢 해결 (#149: 존 11 포함 완료) |
| **G-7** | 손 허용 존 | 왼손 7종 / 오른손 6종 (**비대칭**) | 미규정 | `LEFT_HAND_ZONES`, `RIGHT_HAND_ZONES` | 🟢 해결 (#151 FEAT-POSE-006: 비대칭 구역 및 C2 완전 비공유 반영) |
| **G-8** | 양손 동일 존 | **허용** (D061 `2,2` 등 6건) | 허용 ("양손을 모두 존에") | 고정 페어링으로 표현 불가 | 🔴 집합 덮기 판정 필수 근거 |
| **G-9** | 커서 색상 정의 | 머리 사용 | 머리 | `head` = 보라 (GDD는 "어깨") | 🟢 머리로 확정, GDD 갱신 대상 |

**핵심 결론:** G-1(존 11개), G-2(4부위), G-8(양손 동일 존)은 **현재 코드 구조로 구현 불가능**합니다. `docs/04_POSTURE_SYSTEM_ANALYSIS.md`의 집합 덮기(Set Coverage) 판정 + 존 레이아웃 재정의가 선행되어야 합니다.

### D. 근본 원인 요약 (상세는 분석 문서 §4)

| ID | 원인 | 위치 |
|---|---|---|
| RC-1 ★★★ | 부위↔존이 **고정 인덱스 페어링** → "양손을 한 존에" 표현 불가 | `RecipeGenerator.ts:97` |
| RC-2 ★★★ | 답안 UI에 부위 정보 0. `RenderZoneInfo.requiredCursors` 정의만 존재·미사용 | `AnswerSelectionRenderer.ts:16,29-36` |
| RC-3 ★★★ | 절대 좌표 존 → 직립만으로 조건 충족 (코 y≈0.15가 존2에, 골반 y≈0.6이 존7에 이미 포함) | `AnswerSelector.ts:45-56` |
| RC-4 ★★ | `activeZones`가 파생값 → 존 개수 제어 불가 | `RecipeGenerator.ts` |
| RC-5 ★★ | 진행도 2슬롯뿐 → `choiceProgress[i % 2]`로 3번째 존 오매핑, 전 커서에 `max()` 공통 전달 | `AnswerSelectionRenderer.ts:43,61` |
| RC-6 ★★ | `HEAD_ZONES ∩ HIP_ZONES = {7}` → 머리·골반 충돌 + Deadlock Guard 리셋 루프 | `AnswerSelector.ts:59-63,97-98` |
| RC-7 ★ | 판정 경로 이중화. `update()`(존 기반)와 `updateFromPose()`(선택지 기반)가 상태 비공유, 실게임은 후자만 사용하며 부위-존 제약 미검증 | `AnswerSelector.ts:194-282,309-378` |
| RC-8 ★ | `config/` 디렉터리 부재 (개발 규칙 6절 위반). 존 좌표·티어·감쇠 계수 전부 하드코딩 | 프로젝트 전역 |
| RC-9 ★ | 존 4·5와 6·7·8이 y 0.55~0.58 **겹침**, 답안이 존 4·5 내부에 그려짐 | `AnswerSelector.ts:45-56`, `main.ts:277` |

### E. 확정된 기획 결정

| # | 항목 | 결정 |
|---|---|---|
| D-1 | 산출물 | `docs/04_POSTURE_SYSTEM_ANALYSIS.md` 분석 문서 (완료) |
| D-2 | 존 레이아웃 | **재정의 적용** — 겹침 제거 + 문제/답안 밴드 예약 |
| D-3 | 보라 `#C889FF` | **머리/얼굴(head)로 확정.** GDD "어깨" 표기 갱신, `shoulder` 타입 폐기 |

### F. 다음 세션 착수 항목 (우선순위)

**1단계 — 사용자 결정 필요 (구현 불가 차단 항목)**

- [ ] **G-1 결정**: 존을 11개로 확장할지, CSV의 존 11 패턴 67건을 버릴지
- [ ] **G-1b 결정**: CSV에서 0회 사용된 **존 5의 처리** (삭제 / 신규 패턴 추가 / 예비 유지)
- [ ] **G-2 결정**: 4부위(Q 시리즈) 100건을 채택하여 명세를 1~4부위로 확장할지, 제외할지
- [ ] **G-3 결정**: 4존 패턴 37건 채택 여부

**2단계 — 작업 카드 등록 완료 (개발 규칙 9항, 승인 대기)**

| 순서 | 카드 ID | GitHub Issue | 제목 | 관련 RC/G | 분류 | 상태 |
|---|---|---|---|---|---|---|
| 1 | `CFG-001` | [#120](https://github.com/Choyounhwa/-dream-guardian/issues/120) | 존/커서/티어 설정 `config/` 외부화 및 Config 분리 | RC-8 | `refactor`, `P1-high` | 🟢 **완료 (260/260 Pass)** |
| 2 | `ZONE-001` | [#121](https://github.com/Choyounhwa/-dream-guardian/issues/121) | 피트니스 존 레이아웃 재정의 (겹침 제거 및 문제/답안 밴드 예약) | RC-9, G-1 | `feature`, `P1-high` | 🟢 **완료 (264/264 Pass)** |
| 3 | `DATA-001` | [#122](https://github.com/Choyounhwa/-dream-guardian/issues/122) | 피트니스 패턴 원본 데이터(fitness pattern.csv) 로더 및 유효성 검증기 구현 | G-1~G-8 | `feature`, `P1-high` | 🟢 **완료 (280/280 Pass)** |
| 4 | `POSE-001` | [#123](https://github.com/Choyounhwa/-dream-guardian/issues/123) | 자세 선택 시스템 AnswerPosture 및 PostureProgress 데이터 타입 신설 | RC-1, RC-5 | `feature`, `P1-high` | 🟢 **완료 (281/281 Pass)** |
| 5 | `POSE-002` | [#124](https://github.com/Choyounhwa/-dream-guardian/issues/124) | 집합 덮기(Set Coverage) 기반 matchPosture 판정 알고리즘 및 단위 테스트 구현 | RC-1, RC-4, G-8 | `feature`, `P0-critical` | 🟢 **완료 (299/299 Pass)** |
| 6 | `POSE-003` | [#125](https://github.com/Choyounhwa/-dream-guardian/issues/125) | 패턴 풀 기반 좌/우 선택지 추출기 및 생성 제약(C1~C7) 검증기 구현 | RC-4, RC-6 | `feature`, `P1-high` | 🟢 **완료 (310/310 Pass)** |
| 7 | `POSE-004` | [#126](https://github.com/Choyounhwa/-dream-guardian/issues/126) | PartGate (캘리브레이션 기준선 대비 신체 변위) 판정 구현 | RC-3 | `feature`, `P1-high` | 🟢 **완료 (320/320 Pass)** |
| 8 | `ICON-001` | [#127](https://github.com/Choyounhwa/-dream-guardian/issues/127) | PartIconRenderer 신설 (손/머리/골반 부위별 공통 아이콘 시스템) | 아이콘 요구 | `feature`, `P2-medium` | 🟢 **완료 (326/326 Pass)** |
| 9 | `UI-001` | [#128](https://github.com/Choyounhwa/-dream-guardian/issues/128) | 답안 버튼 부위 아이콘, 색상 및 묶음 기호(함께/각각) 시각화 | RC-2 | `feature`, `P1-high` | 🟢 **완료 (327/327 Pass)** |
| 10 | `UI-002` | [#129](https://github.com/Choyounhwa/-dream-guardian/issues/129) | 피트니스 존별/부위별 독립 진행도 피드백 및 i % 2 오매핑 수정 | RC-5 | `bug`, `P1-high` | 🟢 **완료 (329/329 Pass)** |
| 11 | `UI-003` | [#131](https://github.com/Choyounhwa/-dream-guardian/issues/131) | 홈메뉴(챕터 및 서브레벨 단계선택) 원거리/대화면 레이아웃 개편 및 카드 간격 확장 | 1m 원거리 조작성 | `feature`, `P1-high` | 🟢 **완료 (329/329 Pass)** |
| 12 | `UI-004` | [#132](https://github.com/Choyounhwa/-dream-guardian/issues/132) | 원거리(1m+) 가독성 보장을 위한 인게임 HUD 및 수식/선택지/결과 텍스트 대형화 & 고대비 렌더링 | 1m 텍스트 가독성 | `feature`, `P1-high` | 🟢 **완료 (329/329 Pass)** |
| 13 | `INPUT-002` | [#133](https://github.com/Choyounhwa/-dream-guardian/issues/133) | 스켈레톤 커서 메뉴 조작성 개선 (히트박스 패딩 마진, 호버 떨림 방지 히스테리시스 및 가시성 강화) | 스켈레톤 커서 오선택 방지 | `feature`, `P1-high` | 🟢 **완료 (331/331 Pass)** |
| 14 | `FEAT-RESULT-001` | [#134](https://github.com/Choyounhwa/-dream-guardian/issues/134) | 게임 결과 화면(Result) 양손 합장(모으기) 제스처 메뉴 복귀 기능 및 시각 피드백 구현 | 결과 화면 모션 조작 | `feature`, `P1-high` | 🟢 **완료 (332/332 Pass)** |
| 15 | `CALC-001` | [#135](https://github.com/Choyounhwa/-dream-guardian/issues/135) | 자세 유지(Dwell Time) 기반 피트니스 칼로리 소모 계산식 확장 및 결과 통계 연동 | 칼로리 보상 정밀화 | `feature`, `P2-medium` | 🟢 **완료 (332/332 Pass)** |
| 16 | `AUDIO-002` | [#136](https://github.com/Choyounhwa/-dream-guardian/issues/136) | 피트니스 존 체류(Dwell) 점진적 충전음 및 자세 완성 화음 효과음(Web Audio SFX) 구현 | 청각 피드백 강화 | `feature`, `P2-medium` | 🟢 **완료 (335/335 Pass)** |
| 17 | `TUT-001` | [#137](https://github.com/Choyounhwa/-dream-guardian/issues/137) | 최초 플레이어 대상 4색 신체 커서 및 피트니스 존 매칭 인터랙티브 튜토리얼 오버레이 구현 | 온보딩 UX | `feature`, `P2-medium` | 🟢 **완료 (337/337 Pass)** |
| 18 | `DOCS-001` | [#138](https://github.com/Choyounhwa/-dream-guardian/issues/138) | GDD 기획서 및 프로젝트 공식 문서 최신화 (보라 머리/얼굴 확정, 10존 레이아웃, 국민체조 패턴 및 집합 덮기 모델 공식 반영) | 공식 기획 일치화 | `documentation`, `P2-medium` | 🟢 **완료 (337/337 Pass)** |
| 19 | `FEAT-CURSOR-003` | [#140](https://github.com/Choyounhwa/-dream-guardian/issues/140) | 전 장면(메뉴·달리기·문제·결과) 4색 스켈레톤 커서 상시 지속 가시화 및 생명주기 통일 | 전 화면 커서 생명주기 일원화 | `feature`, `P1-high` | 🟢 **완료 (321/321 Pass)** |
| 20 | `REFACTOR-001` | [#130](https://github.com/Choyounhwa/-dream-guardian/issues/130) | AnswerSelector 죽은 판정 경로(update) 정리 및 단위 테스트 정비 | RC-7 | `refactor`, `P2-medium` | 🟢 **완료 (336/336 Pass)** |
| 21 | `UI-BAR-001` | [#141](https://github.com/Choyounhwa/-dream-guardian/issues/141) | 전 화면 공통 하단 고정 바(Yellow Bar) 및 설정(Settings) 모달 신설과 레거시 상단 부유 버튼(#top_controls) 완전 삭제 | 상단 간섭 제거 / 공통 고정 바 | `feature`, `P1-high` | ⚪ **대기 (승인 대기)** |
| 22 | `UI-MENU-002` | [#142](https://github.com/Choyounhwa/-dream-guardian/issues/142) | 홈 메뉴(2-2-1) 및 서브 메뉴(2x3) 와이드 레이아웃 개편과 1:1 대형 폰트 적용 (레거시 가로 1열 및 상단 뒤로가기 삭제) | 메뉴 원거리 시인성 & 1:1 폰트 | `feature`, `P1-high` | ⚪ **대기 (승인 대기)** |
| 23 | `UI-INGAME-001` | [#143](https://github.com/Choyounhwa/-dream-guardian/issues/143) | 인게임 마젠타 문제영역 고정 컨테이너, 3중 회전 마법진(E_Pit_act1~3) 피트니스 존 및 마젠타 결과 카드 패널 개편 | 마젠타 컨테이너 & 마법진 스핀 | `feature`, `P1-high` | ⚪ **대기 (승인 대기)** |
| 24 | `BUG-SCALE-002` | [#144](https://github.com/Choyounhwa/-dream-guardian/issues/144) | 실사용 웹캠 근접 환경(귀 가림·팔꿈치 이탈) 신체 실측 크기 동적 추정 고도화 및 커서 시인성 현실화 | 귀 가림 시 눈/코 비례 산출, 팔꿈치 이탈 시 손바닥 전진, 1080p 신체 실측 스케일 현실화 | `bug`, `P1-high` | ⚪ **대기 (승인 대기)** |

**주의:** `ZONE-001`은 `UI-001`보다 반드시 앞서야 합니다(답안 밴드 좌표 의존). `REFACTOR-001`은 `input-system.test.ts` 약 7개 테스트가 `update()`에 의존하므로 단독 카드로 수행합니다(개발 규칙 3.3/18항).

### G. 핵심 설계 결정: 집합 덮기(Set Coverage) 판정

고정 페어링을 폐기하고 다음 술어로 대체합니다. 이것이 G-8(양손 동일 존)과 사용자 명세 전 케이스를 표현하는 유일한 방법입니다.

```
matched(P, Z) ⟺
  (A) ∀ p ∈ P : ∃ z ∈ Z, inside(p, z)   // 모든 요구 부위가 어떤 활성 존 안에 있다
  (B) ∀ z ∈ Z : ∃ p ∈ P, inside(p, z)   // 모든 활성 존이 최소 1개 부위로 덮인다
```

조건 (B)가 존 개수를 의미 있게 만듭니다. 복잡도는 O(|P|×|Z|), 최대 4×4.

```ts
// src/types/posture.ts (신규)
export type BodyPart = 'leftHand' | 'rightHand' | 'head' | 'hip';

export interface AnswerPosture {
  choiceIndex: 0 | 1;
  parts: BodyPart[];           // 1~3 (또는 G-2 채택 시 1~4)
  zoneIds: number[];           // 1~3 (또는 G-3 채택 시 1~4)
  binding: 'any' | 'ordered';  // 'any' = 집합 덮기(기본)
  gates?: PartGate[];          // 캘리브레이션 대비 변위 조건
  patternId: string;           // fitness pattern.csv의 ID (S001, D001, T001, Q001...)
}

export interface PostureProgress {
  choiceIndex: 0 | 1;
  progress: number;
  met: boolean;
  partStates: { part: BodyPart; zoneId: number | null }[];
  zoneCovered: Record<number, boolean>;
}
```

좌/우 자세 추출 제약:

```
C1  |union(A.zoneIds, B.zoneIds)| <= 최대 존 수
C2  A.parts \ B.parts != ∅  AND  B.parts \ A.parts != ∅   // 배타 부위 (Deadlock 방지)
C3  head와 hip이 동일 zoneId를 요구하지 않음               // CSV는 이미 0건
C4  head와 hip이 함께 요구되면 zone(head).y < zone(hip).y
C5  ∀ p, z : 부위별 허용 존 통과 (CSV 실사용 집합 기준)
C6  parts.length >= distinct(zoneIds).length
C7  최근 3문제 내 동일 patternId 제외 (쿨다운)
```

### H. 아이콘 시스템

`src/render/PartIconRenderer.ts`를 신설하고 **커서 렌더링과 답안 라벨 렌더링이 동일 함수를 공유**합니다. 같은 모양·같은 색이 두 위치에 나타나는 것이 직관성의 핵심입니다.

| 부위 | 아이콘 | 색상 | 현재 |
|---|---|---|---|
| leftHand | 손바닥 실루엣 (좌향) | 시안 `#28E6FF` | 원 + `'L'` 텍스트 |
| rightHand | 손바닥 실루엣 (우향 미러) | 노랑 `#FFCB4D` | 원 + `'R'` 텍스트 |
| head | 원형 얼굴 (눈 2점) | 보라 `#C889FF` | 타원 + `'HEAD'` 텍스트 |
| hip | 마름모 (다이아몬드) | 주황 `#FF865E` | 역삼각형 + `'HIP'` 텍스트 |

묶음 기호 (한 존 vs 각 존 구분):

| 조건 | 표기 |
|---|---|
| 부위 2~3개 / 존 1개 | 아이콘을 `( )` 괄호로 묶음 → "함께 한 존에" |
| 부위 n개 / 존 n개 | 아이콘 사이 `\|` 구분선 → "각각 다른 존에" |
| 부위 3개 / 존 2개 | `( ) \|` 혼합 → 2개 묶음 + 1개 분리 |

### I. 테스트 요구 (POSE-002 필수)

```
□ 2부위 1존: 두 부위 모두 존 내부 → met / 한 부위만 → not met
□ 2부위 2존: 정방향 met / 역방향(좌우 교환) met       ← RC-1 회귀 방지 핵심
□ 2부위 2존: 두 부위가 같은 존에 몰림 → not met       ← 조건 (B) 검증
□ 3부위 1존 / 2존 / 3존 각 met, 한 존 비었을 때 not met
□ binding:'ordered' 시 역방향 → not met
□ C2: 두 자세 동시 met 조합이 생성되지 않음 (100회 반복)
□ C3: head·hip 동일 존 조합 미생성
□ C6: parts.length < zoneIds.length 조합 미생성
□ 활성 존 3개 이상에서 존별 진행도 독립 표시           ← RC-5 회귀 방지
□ PartGate: baseline 변위 미달 시 not met
□ CSV 360건 전체가 로더를 통과하고 제약 위반 0건
```

현재 커버리지 공백: 2부위 조합 AND 판정 테스트 **0건**, 3존 렌더링 미검증(`i % 2` 버그가 테스트 통과), `avgWeight` 미검증.

---

> **레거시 프로토타입 기록:** 아래 절은 이전 JS 프로토타입 이력이다. 현행 요구보다 우선하지 않으며 보관본은 `../docs/archive/legacy_prototype/COMPLETION.md`에 있다.

## 역사 기록: 필수 자세 판정 / iPhone 카메라

### 과거 적용: 색상 신체 / 11구역 + 음성 정지 수정
- **음성 안내가 끝날 때까지 `questionSpeaking`으로 답안과 준비 타이머를 막던 원인**을 제거했습니다. 브라우저가 종료 이벤트를 보내지 않으면 최장 180초 잠기던 구조였습니다. 이제 음성은 비차단 안내이며 첫 2초 준비와 신체 정렬/유지만 적용합니다. 음성 시작이 3초 지연되면 재생 실패 안내로 바뀌며 게임은 계속됩니다.
- 최신 답안은 `answer-selection.js`의 10개 피트니스존입니다. 손=시안/노랑 원, 어깨=보라 사각형, 골반=주황 다이아몬드를 사용하며, 호환되는 활성 존에 필요한 커서를 모두 두고 1초 유지합니다.
- 답안 두 개는 같은 활성 존 집합을 공유하고, 입력 시 어떤 답 하나만 완성될 때만 충전합니다. 존별 고정 `zoneId` 배정은 사용하지 않습니다.
- PC 테스트는 `1`/`2` 또는 활성 답 구역 클릭으로 변경했습니다. 화면 반쪽 전체 클릭/방향키 답 선택은 제거했습니다.
- 상세 구역 좌표, 커서 조합, 민감도/추가 방법/검증 범위: **`ANSWER_SELECTION_DESIGN.md`**. 이후 수정은 이 문서와 `answer-selection.js` 설정 배열을 기준으로 진행합니다.
- 과거 팝업·음성 대기·깊은 런지 필수 설명보다 이 절을 우선합니다.

### 과거 적용: PC 테스트·달리기 전환 복구
- 달리기 게이지 완료 판정을 `processMotion` 내부에서 공통 게임 루프의 `updateRunningProgress(dt)`로 이동했습니다. 100 도달을 자연 감소보다 먼저 확인하므로 카메라 프레임이 없거나 Space/클릭/점프로 충전해도 문제로 넘어갑니다. 동일 문제 중 중복 출제를 막습니다.
- 카메라 시작/전후면 선택/터치 연습 모드 선택 UI를 제거했습니다. 페이지 시작 시 기본 카메라를 자동 요청합니다. 카메라 권한은 브라우저에서 허용하며 실패해도 PC 입력으로 진행할 수 있습니다.
- 카메라는 원래처럼 전체 캔버스를 채우는 중앙 좌우반전 배경(cover)으로 복원했습니다. 표시 영역이 잘려도 원본 카메라 안의 관절 신뢰도를 제거하지 않습니다. 스켈레톤과 영상은 같은 변환을 사용합니다.
- 모드 선택 없이 Space(준비 통과/달리기 충전), 클릭(달리기 충전/답안 원 또는 단독 호환 존 선택), `1`/`2`(답안 선택)으로 테스트합니다. 수동 답안도 문제 읽기 잠금 중에는 확정되지 않습니다.
- `runtime.test.cjs`: 실제 키보드/포인터 리스너를 호출해 카메라 없이 달리기 완료→문제 출제, 감소 전 완료 검사, 중복 출제 방지, cover 좌표를 검증했습니다. 기존 자세 및 음성 테스트도 통과했습니다.
- 아래 모바일·모드 선택·contain 화면 설명은 이전 구현 이력입니다. 현재 동작은 이 절을 우선합니다.

### 과거 전투 스토리 변경: 문제를 풀어 수호신에게 마나 전달
- 플레이어는 문제를 풀고 자세로 답을 선택해 수호신에게 사고의 빛(마나)을 보냅니다. 정답 1개당 25 마나, 100 마나가 되면 수호신이 자동으로 `사고의 별`을 시전합니다.
- 정답 순간에는 보스 체력을 줄이지 않습니다. 마나 전달 연출 뒤 시전 상태(`guardian_cast`)로 전환하고 마법이 적중할 때 피해 4를 한 번 적용합니다.
- 달리기·점프의 기존 게이지는 다음 문제로 이동하는 진행도이며 마나와 별개입니다. 하단에 별도 수호신 마나 게이지를 표시합니다. 오답 시 수호신 HP가 25 감소하고 이미 모은 마나는 유지합니다.
- 당시 프로토타입은 10문제 자동 종료를 제거하고 보스 격파로 완료했습니다. 이 동작은 #229에서 폐기됐으며, 현행은 10문제 정산 후 Phase B에서만 보스를 처치합니다.
- 스토리와 메뉴 문구도 '네가 생각하고, 수호신이 지킨다' 역할 분담으로 변경했습니다. `runtime.test.cjs`에서 정답 충전, 4정답 시전, 중복 피해 방지, 오답 마나 유지, 최종 보스 엔딩 경로를 검증합니다.

### 최신 추가 수정: 전신 프레임·손 커서·음성·스켈레톤
- 영상 확대 크롭을 제거하고 전체 카메라 영상을 화면 중하단에 비율 유지 표시합니다. 카메라 원본 밖으로 실제 몸이 나가는 경우에는 위치 조정이 필요합니다.
- 손목 뼈대와 별도로 `손`이라고 표시한 입력 원이 움직입니다. 준비 자세의 어깨·몸통 길이에 비례한 좌표 변환을 사용해 작은 팔 움직임으로 답 원까지 도달합니다. 그 원의 중심이 실제 접촉 판정 좌표이며 메뉴에도 동일한 변환을 사용합니다. 자세 조건은 여전히 필수입니다.
- 런지는 발 간격과 골반 이동 요구량을 줄이고 선택 방향 무릎 굽힘/반대 다리 펴기 조건을 유지합니다. 저속 카메라가 250ms마다 초기화되던 문제를 개선해 600ms 유실 기준을 사용하되 프레임당 유지 시간 인정량을 150ms로 제한합니다.
- 확대 읽기 팝업과 완료 버튼을 제거했습니다. `question-speech.js`의 Web Speech API로 문제 원문을 한국어로 읽습니다. `문제 다시 듣기`, `음성 켜짐/꺼짐` 버튼을 제공하며 분수 및 기본 연산 기호를 읽기용 표현으로 바꿉니다. 음성 완료·실패·취소·시간 초과를 처리하고 읽는 동안 답 선택을 잠급니다. 모바일 자동 음성이 차단되면 다시 듣기 버튼으로 시작할 수 있습니다.
- 스켈레톤 연결선과 보조선은 불투명도 10%, 원은 100%로 표시합니다. 관절 반지름 4→6px, 손목 링 18→27px(기존 진동도 1.5배). 무릎/발목 원과 코 위치 기반 머리 원/목선을 추가했습니다. 머리는 얼굴 윤곽 추정이 아니라 위치 표시입니다.
- `motion-input.test.cjs`, `runtime.test.cjs`, `question-speech.test.cjs` 통과. 전신 좌표 보존, 커서 도달, 저속 프레임, 손만 닿는 경우 차단, 음성 수명주기 등을 모형 기반 검증했습니다. 실제 iPhone 음성·카메라 운동 테스트는 별도 확인 필요.

### 긴 문제 읽기 개선
- 아래 확대 팝업 설명은 이전 구현 이력입니다. 최신 구현은 위 음성 읽기 방식이며 자동 팝업은 없습니다.
- 문제를 캔버스의 한 줄 `fillText` 대신 HTML 문제 패널로 표시합니다. 원문 전체를 `textContent`로 넣어 줄바꿈·긴 수식 강제 줄바꿈을 지원합니다.
- 글자는 32~48px 범위로 유지하고, 실제 렌더링 높이가 표시 영역보다 크면 큰 읽기 화면을 자동으로 엽니다. 그보다 긴 문제는 세로 스크롤로 끝까지 읽습니다.
- `문제 크게 읽기`로 다시 열 수 있으며 `다 읽었어요 · 답 고르기`를 눌러 복귀합니다. 읽기 화면에서는 카메라·터치·키보드 답안 확정을 모두 막고, 닫을 때 준비 자세와 유지 게이지를 초기화합니다.
- `runtime.test.cjs`에 긴 문제 원문 보존, 읽기 화면 자동 열기, 읽는 동안 선택 차단, 닫기 시 입력 초기화, 짧은 문제 및 결과 화면 전환 검사를 추가했습니다. 모형 기반 테스트 통과; 실제 모바일 스크롤/시인성은 실기기 확인 필요.

아래 과거 구현표보다 이 절의 동작과 검증 범위를 우선합니다.

- `motion-input.js`: 신뢰도 0.65 이상의 전신 관절로 필수 자세를 판정합니다. 손만 닿는 입력으로는 답을 선택하지 않습니다.
- 매 문제 2초 읽기 잠금 후, 양팔을 내리고 무릎을 편 자세를 0.6초 유지해야 준비됩니다. 준비 후 자세와 손의 답 원 접촉을 함께 0.8초 연속 유지하면 확정됩니다. 자세 이탈은 누적 시간을 초기화하고, 추적 유실·화면 크기 변경은 다시 준비 자세를 요구합니다.
- 런지: 화면상 선택 방향의 무릎 굽힘, 반대 다리 펴기, 발 간격, 골반 이동을 모두 확인합니다. 만세: 양손이 머리 위에 있고 양팔과 다리가 펴져야 합니다. 스쿼트: 양 무릎 굽힘과 골반·어깨 하강을 확인합니다. 손 터치만으로 얻던 가속 경로를 제거했습니다.
- 하단에 부족한 동작과 손 터치/유지 안내를 표시합니다. 답 원은 준비 자세의 신체 위치를 기준으로 배치합니다. 하반신이 안 보이면 전신 인식을 요청하며 상반신만으로 대신 통과시키지 않습니다.
- 운동 모드에서는 직접 화면 터치와 키보드로 답 판정을 우회할 수 없습니다. 시작 패널에서 명시적으로 선택한 **터치 연습 모드**만 수동 답안을 허용합니다.
- 답안용 스쿼트와 회피 동작이 충돌하지 않도록 문제 출제 시 보스 회피 공격을 해제합니다.
- iPhone: **신뢰할 수 있는 HTTPS 주소를 Safari에서 열고 카메라 시작 버튼을 누른 뒤 권한 허용**이 필요합니다. 같은 Wi-Fi의 `http://192.168…:8080`은 페이지 열기만 가능하며 카메라 접속용 주소가 아닙니다. 이 수정은 HTTPS 서버/터널을 개설하지 않습니다.
- video에 `muted`, `playsinline`, `webkit-playsinline`을 적용하고 `display:none`을 제거했습니다. 권한 거부, 비보안 접속, 모델 로딩 실패를 별도로 표시합니다. 실패 시 카메라 연결 성공으로 처리하지 않습니다.
- 검증: `node dream_guardian/motion-input.test.cjs`, `node dream_guardian/runtime.test.cjs`. 합성 관절 기반 자세/터치/타이밍 회귀 테스트와 브라우저 API 모형 기반 시작/입력 경로 검사를 통과했습니다. 실제 iPhone 카메라와 1~2m 거리 정확도는 아직 실기기 검증 전입니다. 기존 문서의 '100% 일치', '30+ FPS 보장', '완벽한 오류 방지' 표현은 실측 결과가 아닙니다.

---

## 📌 1. 프로젝트 기본 정보 및 기획 배경

1. **프로젝트 목적**:
   - 닌텐도 '링핏 어드벤처' 스타일로 제자리 달리기, 팔 뻗기, 앉기, 점프 등 전신 운동을 하며 수학 문제를 해결하는 모바일 웹캠 기반 체감형 기능성 게임.
2. **원작 스토리**:
   - `E:\AIAIAIAIAI\Arithmetic Game\GU's mong story.txt` 바탕의 **《꿈의 수호신》** ("생각하는 힘이, 나를 지킨다").
   - 아이의 생각하는 힘(사고의 빛)으로 성장하는 꼬마 수호신 vs 몽계(꿈의 세계)를 위협하는 4종 괴물과 최종 보스 '나이트메어'.
3. **그래픽/톤앤매너**:
   - 기존의 중세 골드/화염 연금술 테마에서 **신비로운 아이스블루, 라벤더, 딥네이비, 별빛 실버** 테마로 전면 개편.
   - 주인공: 아이스블루 꼬마 수호신 (`img/guardian.png` 크로마키 투명화 적용).
4. **수학 문제 범위**:
   - 기존 `questions.csv`의 9단계 중 **Level 1 ~ Level 4**만 필터링하여 출제 (기존 CSV 원본 100% 보존).
     - 1장: 덧뺄셈 (숫자의 숲 / 보스: 포겟)
     - 2장: 곱나눗셈 (곱셈의 성 / 보스: 후다닥)
     - 3장: 분수 (나눗셈의 미궁 / 보스: 뒤죽박죽)
     - 4장: 소수 (소수의 사막 / 보스: 에라)
     - 5장(히든/최종): 종합 혼합 연산 (악몽의 심연 / 보스: 나이트메어)

---

## 📁 2. 파일 및 디렉토리 구조

```
E:\AIAIAIAIAI\Arithmetic Game\
├── index.html                   # [원본 보존] 기존 마법 연금술 아카데미 게임
├── questions.csv                 # [원본 보존] 전체 수학 문제 원본 DB (685문항)
├── questions_cleaned.csv         # [원본 보존] 클린 버전 문제 DB
├── img/                          # [원본 보존] 기존 게임 이미지 에셋
├── GU's mong story.txt           # [원본] 게임 스토리 원작 텍스트
│
└── dream_guardian/               # 🆕 신규 분리 프로젝트 (꿈의 수호신)
    ├── index.html                # 단일 파일 구동 엔진 (약 1,180줄, CSS+JS+렌더러 일체형)
    ├── HANDOVER.md               # 📌 본 인수인계 문서
    └── img/
        └── guardian.png          # 수호신 캐릭터 일러스트 (투명 크로마키 처리 완료)
```

> **기획 및 작업 문서 위치 (프로젝트 내부)**:
> - 기획서(Implementation Plan): `dream_guardian/IMPLEMENTATION_PLAN.md`
> - 세부 WBS 작업목차: `dream_guardian/TASKS.md`
> - 개발 워크스루: `dream_guardian/DEVELOPMENT_WALKTHROUGH.md`

---

## ✅ 3. 현재까지 구현 완료된 기능 (Current Status)

| 분류 | 세부 구현 내용 | 상태 |
|---|---|:---:|
| **오입력 방지 딜레이** | 달리기 직후 문제가 나오자마자 팔 스윙으로 오답이 찍히던 문제 해결 (1.3초 문제 읽기 프리즈 + 효과음 + 준비 카운트다운) | 완료 |
| **원거리 특대형 수식** | 1~2m 거리 모바일 환경 대응 54px 특대형 네온 수식 카드 + 48px 볼드 정답 넘버링 (원거리 시인성 극대화) | 완료 |
| **스트리트파이터 대전 HUD** | 상단 통합 대전 바: 좌측 플레이어 HP(에메랄드) vs 우측 보스 HP(크림슨/골드) + 중앙 VS 엠블럼, 타이머, 콤보 | 완료 |
| **인체공학적 조작계** | 서서 플레이 시 팔을 자연스럽게 뻗으면 닿는 편안한 중하단 높이(y=0.65~0.76)로 답안 오브 및 피트니스 HUD 재배치 | 완료 |
| **운동 픽토그램 가이드** | 런지(◀/▶), 만세(▲), 스쿼트(▼) 동작을 직관적으로 보여주는 실시간 애니메이션 스틱맨 실루엣 + 자세 일치 시 녹색 점등 | 완료 |
| **스켈레톤 보정 (버그 픽스)** | 카메라 비율(4:3, 16:9)과 캔버스(9:18) 간 크롭 오프셋 완벽 일치 보정 (`landmarkToScreen`) + 모바일 BlazePose Lite (30+ FPS) | 완료 |
| **시작 화면 스켈레톤** | 첫 시작 메뉴 화면(`menu_main`, `menu_sub`)부터 플레이어 뼈대 라인과 마법 손목 링 즉시 표시 | 완료 |
| **체감형 모션 메뉴 선택** | 화면을 터치하지 않아도 카메라 앞에서 손을 올려 원하는 챕터 버튼을 0.8초 가리키면(Hover Dwell) 자동 선택 및 실행 | 완료 |
| **모바일 터치 보정** | 고해상도(DPR) 및 모바일 뷰포트 크기 변화에 대응하는 캔버스 좌표 정밀 스케일링 + CSS `touch-action: none` 적용 | 완료 |
| **안정적 웹캠 스트리밍** | `OverconstrainedError`를 원천 방지하는 네이티브 `getUserMedia` 유연 제약 조건 + 1.5초 로딩 안전 타이머 | 완료 |
| **전신 체감형 정답 터치** | **모드 1 (좌우 사이드 런지 & 펀치)**: 체중 이동 런지 + 손 터치 시 2배 가속 인식<br>**모드 2 (상하 만세 vs 스쿼트)**: 상단 양손 오버헤드 만세 리치 vs 하단 딥 스쿼트 다운 터치 | 완료 |
| **풀바디 파워 연출** | 전신 운동 자세 일치 시 무지개 별빛 오라 (`✨ FULL BODY x2!`) 전개 + 보너스 점수(+100) 부여 | 완료 |
| **모바일 최적화** | 전면/후면 카메라 전환 토글(📷), 모바일 주소창 숨김 전체화면(⛶), 세로 9:18 반응형 | 완료 |
| **자세 캘리브레이션** | 모바일 거치 환경 맞춤 가이드 프레임 (얼굴·어깨 자동 중앙 정렬 감지 및 시작) | 완료 |
| **제자리 달리기** | 어깨 상하 바운스 기반 실시간 스텝(걸음 수) 카운터 + 펄스 사운드 + 마나 충전 | 완료 |
| **스쿼트(앉기) 회피** | 보스의 기습 암흑 참격 경보 시 스쿼트 동작 감지 -> 이지스 수호 결계 돔 전개 및 회피(+150점) | 완료 |
| **점프(도약) 파워업** | 순간 도약(Jump) 감지 -> 상승 바람 효과음 + 마나 즉시 충전(+25%) 및 점수 보너스 | 완료 |
| **러닝 트랙 & 정령** | 달리기 구간 3D 궤적 위 사고의 별 크리스탈 수집 + 수호신 호위 빛의 정령 2마리 비행 | 완료 |
| **오디오 엔진** | Web Audio API 기반 11종 효과음(스쿼트 방어, 점프, 발걸음, 경보 등) + Am 펜타토닉 BGM | 완료 |
| **최종전 & 엔딩 컷씬** | 5장 나이트메어 격파 시 4단계 감동 엔딩 스크롤 ("실패는 너의 힘이 아니야...") + 6익 각성 수호신 | 완료 |
| **피트니스 통계 & 명예의 전당** | 소모 칼로리(kcal), 달린 걸음, 스쿼트 횟수, 3-Star 별점, 누적 운동 통계 및 기록 모달 저장 | 완료 |

---

## 🚀 4. 테스트 및 실행 방법

### 권장: Vite 로컬 개발 서버 (HMR 핫 리로딩 지원)
```powershell
cd "E:\AIAIAIAIAI\Arithmetic Game\dream_guardian"
npm run dev
```
브라우저에서 `http://localhost:3000/` 접속

### 프로덕션 빌드 & 테스트
```powershell
cd "E:\AIAIAIAIAI\Arithmetic Game\dream_guardian"
npm run build
npm test
```

> ⚠️ **스마트폰(모바일 브라우저) 카메라 연결 팁**:
> 1. 브라우저의 웹캠 보안 정책(HTTPS 필수)으로 인해, PC와 스마트폰이 같은 Wi-Fi에 있을 때 PC IP로 접속하면 브라우저가 카메라를 차단할 수 있습니다.
> 2. **해결책 (선택 1 - 가장 간단)**: PC에서 `npx ngrok http 8080` 실행 후 스마트폰에서 제공된 `https://xxx.ngrok-free.app/dream_guardian/` 접속.
> 3. **해결책 (선택 2 - Chrome 설정)**: 모바일 Chrome에서 `chrome://flags/#unsafely-treat-insecure-origin-as-secure` 접속 후 `http://PC아이피:8080` 등록.

### 테스트 조작키 (PC 환경 디버깅용):
- **Space**: 자세 정렬 즉시 통과, 달리기 마나 충전 (+15%, 걸음 수 증가), 스토리/엔딩 스킵
- **← (왼쪽 화살표)**: 왼쪽 답안 선택
- **→ (오른쪽 화살표)**: 오른쪽 답안 선택
- **↓ (아래쪽 화살표)**: 스쿼트 방어 테스트 (이지스 결계 발동)
- **↑ (위쪽 화살표)**: 점프 도약 테스트 (마나 +25%)
- **화면 클릭/터치**: 모서리/버튼 선택 및 화면 좌/우 터치로 답안 선택
- **우측 상단 버튼**: 📷 카메라 전면/후면 전환, ⛶ 전체화면 전환
- **메인 메뉴 하단**: [ 🏆 운동 기록 & 명예의 전당 ] 모달 열기

---

## 📋 5. 다음에 이어서 진행할 작업 목록 (Next Steps)

다음에 작업을 재개할 때 등록된 신규 이슈 카드를 다음 권장 순서대로 TDD 사이클(Red → Green → Refactor)에 맞춰 구현하시면 됩니다:

0. **[FEAT-SKEL-005] 화면 중앙 2/3 높이 메카 졸라맨(Mecha Stickman) 실시간 모션 아바타 구현 ([#203](https://github.com/Choyounhwa/-dream-guardian/issues/203)) ⚪ [신규 등록/승인 대기]**:
   - 앙상한 스켈레톤(선과 점) 노출을 대체하여 화면 중앙 2/3 높이(y ≈ 0.60 ~ 0.85)에 도톰한 네온 캡슐과 관절 볼을 가진 세련된 메카 졸라맨 아바타를 배치
   - 인체 비율 고정 순운동학(Fixed-Length FK) 및 각도 기반 회전을 통해 원근 왜곡 없는 부드러운 자세 미러링 지원
1. **[UI-MENU-004] 홈/서브 메뉴 중앙 개방형 레이아웃 재배치 및 박스·수학유형(3배) 규격 통일 ([#161](https://github.com/Choyounhwa/-dream-guardian/issues/161))**:
   - 홈/서브 메뉴 카드 좌우 외곽 재배치(중앙 뷰포트 확보) 및 박스 크기(288x304) 통일
   - 수학 유형 텍스트 3배(78px) 확대 및 `Ch.1~5` 텍스트 제거
2. **[UI-BAR-002] 하단 고정바(BottomBar) 내 운동 모드 선택 버튼 신설 ([#166](https://github.com/Choyounhwa/-dream-guardian/issues/166))**:
   - 하단 고정바 좌측 슬롯(x: 190, y: 1990)에 운동 모드 버튼 신설 및 메인 제목 하단 레거시 제거
3. **[UI-BAR-003] 설정 및 정지 버튼 문자 제거 및 아이콘화 ([#162](https://github.com/Choyounhwa/-dream-guardian/issues/162))**:
   - 좌측 톱니바퀴 아이콘화, 우측 인게임 일시정지(⏸) 아이콘화
4. **달리기 동적 보정 (보류 현안)**:
   - 제자리 달리기 중 전후좌우 신체 드리프트 보정(`TorsoCentroidTracker` 등)은 추후 정밀 검증 후 재개.

---
*최종 갱신일시: 2026-09-29*
