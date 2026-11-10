# DOC-17 — 전체 소스 코드 중복 제거(DRY) 및 단일 책임(SRP) 모듈화 리팩터링 작업 카드

- **브랜치**: `refactor/modularize-large-files`
- **작성일**: 2026-10-20
- **근거 규정**: `docs/Dream_Guardian_개발_규칙.md` 제14조(작업카드 규격), 제15조(1,000줄 초과 대형 파일 금지 및 SRP 분리), 제16조(중복 코드 작성 금지 DRY 원칙)
- **상태**: 전체 카드 **COMPLETED / 전 카드 구현 및 TDD 100% Pass 완료**
- **전체 목표**:
  1. 11개 이상 파일에 분산된 동일 유틸리티 및 암호화/사운드 로직을 `src/utils/` 및 `src/audio/`의 단일 진실 공급원(SSOT)으로 통합 (DRY 준수)
  2. 1,000줄을 초과하는 6개 거대 파일(총 8,487줄)을 서브 모듈 및 헬퍼 컴포넌트로 분리하여 전 소스 파일 1,000줄 이하 유지 (SRP 준수)
  3. 모든 기존 테스트 100% Pass 및 `npm run build` tsc 타입 검사 통과 보장

---

## 🧭 리팩터링 로드맵 및 카드 목록

| 작업 ID | GitHub Issue | 카드 제목 | 대상 파일 | 우선순위 | 진행 상태 |
|---|---|---|---|---|---|
| **REFACTOR-DRY-001** | [#628](https://github.com/Choyounhwa/-dream-guardian/issues/628) | `deepFreeze` 유틸리티 단일화 및 11개 파일 중복 제거 | `src/utils/deepFreeze.ts` (신규) | P1-High | `[✔] 완료` |
| **REFACTOR-DRY-002** | [#629](https://github.com/Choyounhwa/-dream-guardian/issues/629) | SHA-256 암호화 해시 및 16진수 변환 유틸리티 단일화 | `src/utils/crypto.ts` (신규) | P1-High | `[✔] 완료` |
| **REFACTOR-DRY-003** | [#630](https://github.com/Choyounhwa/-dream-guardian/issues/630) | Web AudioContext 팩토리 및 사운드 합성기 공통 로직 추출 | `src/audio/AudioContextFactory.ts` (신규) | P2-Medium | `[✔] 완료` |
| **REFACTOR-DRY-004** | [#631](https://github.com/Choyounhwa/-dream-guardian/issues/631) | 프레젠테이션 슬롯 오버라이드 베이스 인터페이스 공통화 | `src/types/presentation.ts` (신규) | P2-Medium | `[✔] 완료` |
| **REFACTOR-SRP-001** | [#632](https://github.com/Choyounhwa/-dream-guardian/issues/632) | `AppBootstrap` 전역 DOM/윈도우 이벤트 리스너 관리자 분리 | `src/core/bootstrap/AppEventListenerManager.ts` (신규) | P1-High | `[✔] 완료` |
| **REFACTOR-SRP-002** | [#633](https://github.com/Choyounhwa/-dream-guardian/issues/633) | `AppBootstrap` 전투·스펠·보스 피격 애니메이션 이벤트 바인더 분리 | `src/core/bootstrap/AppBattleEventBinder.ts` (신규) | P1-High | `[✔] 완료` |
| **REFACTOR-SRP-003** | [#634](https://github.com/Choyounhwa/-dream-guardian/issues/634) | `AppBootstrap` 스테이지 진행도 및 하이스코어 영속성 관리자 분리 | `src/core/bootstrap/AppPersistenceManager.ts` (신규) | P1-High | `[✔] 완료` |
| **REFACTOR-SRP-004** | [#635](https://github.com/Choyounhwa/-dream-guardian/issues/635) | `SceneDirector` 모션 인식 파이프라인 및 신체 프레이밍 처리기 분리 | `src/core/director/SceneMotionCoordinator.ts` (신규) | P1-High | `[✔] 완료` |
| **REFACTOR-SRP-005** | [#636](https://github.com/Choyounhwa/-dream-guardian/issues/636) | `SceneDirector` 7계층 캔버스 레이어 렌더링 디스패처 분리 | `src/core/director/SceneRenderOrchestrator.ts` (신규) | P1-High | `[✔] 완료` |
| **REFACTOR-SRP-006** | [#637](https://github.com/Choyounhwa/-dream-guardian/issues/637) | `ContentLoadService` 스키마 무결성 검증기 및 캐시 관리자 분리 | `src/core/content/ContentPackValidator.ts` (신규) | P1-High | `[✔] 완료` |
| **REFACTOR-SRP-007** | [#638](https://github.com/Choyounhwa/-dream-guardian/issues/638) | `MenuRenderer` 3대 메뉴 서브 렌더러 및 충돌 판정기(HitTester) 분리 | `src/ui/menu/MenuHitTester.ts` (신규) 등 | P1-High | `[✔] 완료` |
| **REFACTOR-SRP-008** | [#639](https://github.com/Choyounhwa/-dream-guardian/issues/639) | `HazardZoneRenderer` 3D 원근 투영 기하 계산기 분리 | `src/render/hazard/HazardGeometryCalculator.ts` (신규) | P1-High | `[✔] 완료` |
| **REFACTOR-SRP-009** | [#640](https://github.com/Choyounhwa/-dream-guardian/issues/640) | `BeatRunCoordinator` 비트 동기화 및 모션 노트 평가 오케스트레이터 분리 | `src/game/beat/BeatTimelineSynchronizer.ts` (신규) | P1-High | `[✔] 완료` |
| **REFACTOR-SRP-010** | [#641](https://github.com/Choyounhwa/-dream-guardian/issues/641) | `AppBootstrap` 게임 세션 진행 및 라운드 전환 흐름(`AppSessionFlowCoordinator`) 분리 | `src/core/bootstrap/AppSessionFlowCoordinator.ts` (신규) | P1-High | `[✔] 완료` |
| **REFACTOR-SRP-011** | [#642](https://github.com/Choyounhwa/-dream-guardian/issues/642) | `AppBootstrap` 인게임 라운드 이벤트 바인더 및 모션 입력 라우터(`AppRoundEventBinder`) 분리 | `src/core/bootstrap/AppRoundEventBinder.ts` (신규) | P1-High | `[✔] 완료` |
| **REFACTOR-SRP-012** | [#643](https://github.com/Choyounhwa/-dream-guardian/issues/643) | `AppBootstrap` UI 프레젠테이션 동기화 및 콘텐츠 프리로더(`AppUIPresentationSyncManager`) 분리 | `src/core/bootstrap/AppUIPresentationSyncManager.ts` (신규) | P1-High | `[✔] 완료` |

---

# [Track 1] DRY (중복 코드 제거 및 SSOT 통합) 카드

---

### [REFACTOR-DRY-001]

**제목**: `deepFreeze` 유틸리티 단일화 및 11개 파일 중복 제거

**목적**:
11개 소스 파일(`ContentLoadService`, `UIPresentationLoadService`, `PublishedContentStore`, `AssaultExerciseTally`, `AssaultRoundSummary`, `AssaultPlanCompiler`, `SessionContent`, `AssaultAnswerPairFactory`, `approachPatterns`, `tutorialPatterns`, `finalePatterns`)에 복제된 중복 `deepFreeze` 구현을 단일 모듈로 통합하여 DRY 원칙을 확립하고 번들 크기를 최적화한다.

**수정 대상**:
- `dream_guardian/src/utils/deepFreeze.ts` (신규)
- `dream_guardian/src/utils/index.ts` (수정)
- 11개 소스 파일(기존 개별 deepFreeze 제거 및 공통 util import로 대체)

**구현 내용**:
1. `src/utils/deepFreeze.ts` 구현:
   - `null`, `undefined`, 프리미티브 타입 안전 가드
   - `Object.isFrozen` 재귀 스킵 및 순환 참조 방지
   - `Readonly<T>` 불변 타입 매핑
2. 11개 소스 파일에서 개별 `function deepFreeze` 삭제 및 `import { deepFreeze } from '../../utils/deepFreeze.js'`로 교체.

**유지 사항**:
- 기존 호출부의 런타임 불변 객체 동결 동작 100% 동일 유지
- 타입 추론 시그니처(`Readonly<T>`) 완벽 호환

**변경 금지**:
- 동결 대상 객체의 내부 프로퍼티 구조나 비즈니스 로직 수정 금지

**완료 조건**:
- [x] `src/utils/deepFreeze.ts`가 생성되고 11개 파일에서 로컬 중복 함수가 완전히 제거된다.
- [x] 단위 테스트 `tests/unit/deep-freeze.test.ts` 작성 및 100% Pass.
- [x] 전체 단위 테스트 100% Pass 및 `npm run build` 통과.

**테스트**:
- `npx vitest run tests/unit/deep-freeze.test.ts`
- `npm test`
- `npm run build`

**관련 파일**:
- `src/utils/deepFreeze.ts`
- `src/core/ContentLoadService.ts`
- `src/game/assault/AssaultExerciseTally.ts`
- `src/game/assault/AssaultRoundSummary.ts`
- `src/storage/PublishedContentStore.ts`

---

### [REFACTOR-DRY-002]

**제목**: SHA-256 암호화 해시 및 16진수 변환 유틸리티 단일화

**목적**:
`src/data/ContentCanonical.ts`와 `src/core/UIPresentationLoadService.ts`에 독립적으로 복제되어 있는 순수 TS SHA-256 상수 테이블(`K_SHA256`) 및 해시 계산 함수(`sha256Hex`, `sha256BytesHex`)를 공통 암호화 유틸리티로 통합하여 중복 코드를 제거한다.

**수정 대상**:
- `dream_guardian/src/utils/crypto.ts` (신규)
- `dream_guardian/src/data/ContentCanonical.ts` (수정)
- `dream_guardian/src/core/UIPresentationLoadService.ts` (수정)

**구현 내용**:
1. `src/utils/crypto.ts` 구현:
   - `SHA256_K` 단일 상수 테이블 정의 (Object.freeze / Uint32Array)
   - `sha256Bytes(bytes: Uint8Array): Uint8Array` 코어 해시 함수
   - `sha256BytesHex(bytes: Uint8Array): string` 16진수 변환 함수
   - `sha256Utf8Hex(str: string): string` 문자열 해시 헬퍼
2. `ContentCanonical.ts` 및 `UIPresentationLoadService.ts`에서 중복 압축 함수를 제거하고 `src/utils/crypto.ts` 호출로 대체.

**유지 사항**:
- 기존 콘텐츠 팩(`PublishedContentPack`) 해시 산출 결과값(해시 다이제스트) 100% 일치
- 무결성 검증 실패/성공 런타임 동작 보존

**변경 금지**:
- 기존 해시 규격(canonical JSON 정렬 방식 및 UTF-8 인코딩) 수정 금지

**완료 조건**:
- [x] `crypto.ts` 신규 생성 및 기존 2개 파일의 약 180줄 중복 해시 로직 제거.
- [x] 표준 SHA-256 테스트 벡터(빈 문자열, 특정 텍스트, 바이트열) 검증 테스트 100% Pass.
- [x] 기존 콘텐츠 해시 및 무결성 검증 테스트 100% Pass.

**테스트**:
- `npx vitest run tests/unit/crypto.test.ts`
- `npx vitest run tests/unit/content-canonical.test.ts`
- `npm test`

**관련 파일**:
- `src/utils/crypto.ts`
- `src/data/ContentCanonical.ts`
- `src/core/UIPresentationLoadService.ts`

---

### [REFACTOR-DRY-003]

**제목**: Web AudioContext 팩토리 및 사운드 합성기 공통 로직 추출

**목적**:
`BGMManager`, `StageBGMSynthesizer`, `SFXSynth`, `BandSynthesizer` 4개 파일에 중복된 `window.AudioContext || window.webkitAudioContext` 초기화 루틴 및 웨이브셰이퍼 디스토션 커브 계산 함수(`makeDistortionCurve`)를 단일 팩토리로 추출한다.

**수정 대상**:
- `dream_guardian/src/audio/AudioContextFactory.ts` (신규)
- `dream_guardian/src/audio/BGMManager.ts` (수정)
- `dream_guardian/src/audio/StageBGMSynthesizer.ts` (수정)
- `dream_guardian/src/audio/SFXSynth.ts` (수정)
- `dream_guardian/src/audio/BandSynthesizer.ts` (수정)

**구현 내용**:
1. `src/audio/AudioContextFactory.ts` 신규 구현:
   - `getOrCreateAudioContext(options?: AudioContextOptions): AudioContext | null` 브라우저/SSR 환경 판정 및 지연 초기화 제공
   - `createDistortionCurve(amount: number): Float32Array` 공통 디스토션 커브 생성 함수
2. 4개 오디오 신디사이저 클래스에서 중복 사운드 초기화 코드를 `AudioContextFactory`로 대체.

**유지 사항**:
- 음원 재생 품질, 디스토션 이펙트 톤, 오디오 음소거/볼륨 조절 100% 동일 유지
- 브라우저 정책(유저 제스처 후 AudioContext resume) 플로우 보존

**변경 금지**:
- 사운드 생성 주파수, 오실레이터 타입, 엔벨로프 파라미터 변경 금지

**완료 조건**:
- [x] 4개 오디오 클래스에서 `AudioContext` 중복 검사 로직이 제거된다.
- [x] 사운드 재생 및 Web Audio 단위 테스트 100% Pass.

**테스트**:
- `npx vitest run tests/unit/audio-bgm-manager.test.ts`
- `npx vitest run tests/unit/stage-bgm-synthesizer.test.ts`
- `npm test`

**관련 파일**:
- `src/audio/AudioContextFactory.ts`
- `src/audio/BGMManager.ts`
- `src/audio/StageBGMSynthesizer.ts`
- `src/audio/SFXSynth.ts`
- `src/audio/BandSynthesizer.ts`

---

### [REFACTOR-DRY-004]

**제목**: 프레젠테이션 슬롯 오버라이드 베이스 인터페이스 공통화

**목적**:
`HazardZoneRenderer`, `BossRenderer`, `BossClimaxRenderer`, `RunningMatRenderer` 등 4개 이상의 렌더러에 복제된 슬롯 오버라이드 인터페이스(15개 동일 프로퍼티: text, color, fillColor, borderColor, opacity, x, y, w, h 등)를 베이스 타입으로 통합하여 유지보수성을 극대화한다.

**수정 대상**:
- `dream_guardian/src/types/presentation.ts` (신규)
- `dream_guardian/src/render/HazardZoneRenderer.ts` (수정)
- `dream_guardian/src/render/BossRenderer.ts` (수정)
- `dream_guardian/src/render/BossClimaxRenderer.ts` (수정)
- `dream_guardian/src/render/RunningMatRenderer.ts` (수정)

**구현 내용**:
1. `src/types/presentation.ts` 신규 정의:
   - `export interface BaseSlotOverride { text?: string; color?: string; textColor?: string; fillColor?: string; borderColor?: string; borderWidth?: number; glowColor?: string; fontSize?: number; visible?: boolean; opacity?: number; x?: number; y?: number; w?: number; h?: number; }`
   - 각 렌더러별 특화 속성은 `BaseSlotOverride`를 상속(extends)하여 선언.
2. 개별 파일의 장황한 반복 선언문 제거.

**유지 사항**:
- 기존 렌더러들의 슬롯 프로퍼티 접근성 및 타입 체킹 100% 유지

**완료 조건**:
- [x] 중복 인터페이스 선언이 `BaseSlotOverride` 상속으로 정리된다.
- [x] `npm run build` tsc 타입 검사 100% 통과.

**테스트**:
- `npm run build`
- `npm test`

---

# [Track 2] SRP & 1,000줄 초과 모듈 분해 (단일 책임 원칙 확립) 카드

---

### [REFACTOR-SRP-001]

**제목**: `AppBootstrap` 전역 DOM/윈도우 이벤트 리스너 관리자 분리

**목적**:
`AppBootstrap.ts` (2,705줄) 내의 키보드(1, 2, Space, Escape 등), 터치, 마우스 클릭, 윈도우 리사이즈, 브라우저 탭 가시성 변경(`visibilitychange`) 등 DOM 이벤트 리스너 등록·해제 및 fallback 트리거 로직을 `AppEventListenerManager`로 분리하여 300줄 이상의 코드 크기를 감축한다.

**수정 대상**:
- `dream_guardian/src/core/bootstrap/AppEventListenerManager.ts` (Core, 신규)
- `dream_guardian/src/core/AppBootstrap.ts` (Core, 수정)

**구현 내용**:
1. `AppEventListenerManager.ts` 신규 구현:
   - `attachListeners()`, `detachListeners()` 생명주기 관리
   - 키보드 폴백(1: 왼쪽 답, 2: 오른쪽 답, Space: 점프/스쿼트 폴백) 디스패치
   - 윈도우 리사이즈 및 가시성 변경 핸들링 캡슐화
2. `AppBootstrap.ts`에서 이벤트 등록 블록을 `AppEventListenerManager` 인스턴스 호출로 대체.

**유지 사항**:
- 기존 키보드 단축키, 마우스 클릭, 캔버스 자동 리사이징 동작 100% 유지

**변경 금지**:
- 게임 엔진 루프(`GameEngine`) 및 상태 머신 전이 규칙 변경 금지

**완료 조건**:
- [x] `AppBootstrap.ts`의 라인 수가 300줄 이상 감축된다.
- [x] `AppEventListenerManager.ts`가 500줄 이하로 작성된다.
- [x] 키보드 및 마우스 입력 관련 단위 테스트 100% 통과.

**테스트**:
- `npx vitest run tests/unit/app-bootstrap.test.ts`
- `npm test`

---

### [REFACTOR-SRP-002]

**제목**: `AppBootstrap` 전투·스펠·보스 피격 애니메이션 이벤트 바인더 분리

**목적**:
`AppBootstrap.ts` 생성자 내부에 인라인으로 결합되어 있는 마나 풀 이펙트(`playManaFullEffect`), 수호신 스펠 시전(`guardian:cast`), 보스 피격 임팩트(`playBossHitImpact`), 화면 플래시 연출 및 승리/패배 세션 전환 콜백을 `AppBattleEventBinder`로 분리한다.

**수정 대상**:
- `dream_guardian/src/core/bootstrap/AppBattleEventBinder.ts` (Core, 신규)
- `dream_guardian/src/core/AppBootstrap.ts` (Core, 수정)

**구현 내용**:
1. `AppBattleEventBinder.ts` 신규 구현:
   - `bindBattleEvents(options: BattleEventBindingOptions): void`
   - `onSpellCast`, `onBossDefeated`, `onPlayerDamaged` 콜백 조립 및 EffectManager/Sound/EventBus 중계 캡슐화
2. `AppBootstrap.ts`에서 수백 줄의 인라인 콜백 선언부를 `AppBattleEventBinder` 위임으로 대체.

**유지 사항**:
- 수호신 스펠 데미지 산출, 보스 체력 차감, 타격 사운드/이펙트 재생 타이밍 100% 보존

**완료 조건**:
- [x] `AppBootstrap.ts`의 인라인 전투 콜백이 분리되어 250줄 이상 감축된다.
- [x] 전투 시스템 연동 단위 테스트 100% 통과.

**테스트**:
- `npx vitest run tests/unit/battle-state.test.ts`
- `npx vitest run tests/unit/boss-controller.test.ts`
- `npm test`

---

### [REFACTOR-SRP-003]

**제목**: `AppBootstrap` 스테이지 진행도 및 하이스코어 영속성 관리자 분리

**목적**:
`AppBootstrap.ts`에 포함된 `localStorage` 키 관리(`STORAGE_KEY_STAGE_PROGRESS`, `STORAGE_KEY_HIGH_SCORES`, `STORAGE_KEY_REWARDS`), 별점 진행도 갱신, 최고 점수 저장 및 조회 로직을 `AppPersistenceManager`로 분리하여 Core 부트스트랩의 SRP를 완성하고 최종 1,000줄 이하로 경량화한다.

**수정 대상**:
- `dream_guardian/src/core/bootstrap/AppPersistenceManager.ts` (Core, 신규)
- `dream_guardian/src/core/AppBootstrap.ts` (Core, 수정)

**구현 내용**:
1. `AppPersistenceManager.ts` 신규 구현:
   - `loadProgress()`, `saveProgress(ch, stars)`, `loadHighScores()`, `saveHighScore(score)` 메서드 캡슐화
   - 안전한 JSON 직렬화 및 예외 처리
2. `AppBootstrap.ts`의 로컬 스토리지 관련 프로퍼티 및 헬퍼를 `AppPersistenceManager`로 위임.

**유지 사항**:
- 브라우저에 저장되는 로컬 스토리지 키 명칭 및 저장 데이터 구조 100% 호환 보존

**완료 조건**:
- [x] `AppBootstrap.ts`가 **1,000줄 이하**로 최종 슬림화 완료된다.
- [x] 영속성 관리 단위 테스트 작성 및 100% 통과.

**테스트**:
- `npx vitest run tests/unit/app-persistence.test.ts`
- `npm test`

---

### [REFACTOR-SRP-004]

**제목**: `SceneDirector` 모션 인식 파이프라인 및 신체 프레이밍 처리기 분리

**목적**:
`SceneDirector.ts` (1,603줄) 내의 `_processMotionPipeline`에 결합된 웹캠 랜드마크 정규화(`toNormalizedLandmarks`), 무릎 프레이밍 판정기(`kneeFramingValidator`), 발 키노트 감지(`footKeynoteDetector`), X 제스처 감지(`xGestureDetector`)를 `SceneMotionCoordinator`로 분리하여 350줄 이상의 코드 크기를 감축한다.

**수정 대상**:
- `dream_guardian/src/core/director/SceneMotionCoordinator.ts` (Core/Motion, 신규)
- `dream_guardian/src/core/SceneDirector.ts` (Core, 수정)

**구현 내용**:
1. `SceneMotionCoordinator.ts` 신규 구현:
   - `process(dt: number, ctx: MainSceneContext): void` 메서드 정의
   - 포즈 좌표 추출, 정규화 변환, 프레이밍 가이드 업데이트, 제스처 평가 로직 캡슐화
2. `SceneDirector.ts`의 `_processMotionPipeline` 내부 구현을 `SceneMotionCoordinator` 호출로 대체.

**유지 사항**:
- 웹캠 기반 신체 인식, 4색 커서 위치 추적, 무릎 프레이밍 감지 주기 100% 동일 유지

**완료 조건**:
- [x] `SceneDirector.ts`에서 모션 파이프라인 세부 구현이 분리되어 350줄 이상 감축된다.
- [x] 모션 및 제스처 연동 단위 테스트 100% 통과.

**테스트**:
- `npx vitest run tests/unit/pose-manager.test.ts`
- `npx vitest run tests/unit/scene-director.test.ts`
- `npm test`

---

### [REFACTOR-SRP-005]

**제목**: `SceneDirector` 7계층 캔버스 레이어 렌더링 디스패처 분리

**목적**:
`SceneDirector.ts`에 직접 구현되어 있는 7개 렌더링 레이어(`renderClear`, `renderBackground`, `renderAvatarAndSkeleton`, `renderHUD`, `renderModalsAndOverlays`, `renderTransitions`)의 캔버스 그래픽 드로잉 로직을 `SceneRenderOrchestrator`로 분리하여 `SceneDirector.ts`를 **1,000줄 이하**로 정상화한다.

**수정 대상**:
- `dream_guardian/src/core/director/SceneRenderOrchestrator.ts` (Core/Render, 신규)
- `dream_guardian/src/core/SceneDirector.ts` (Core, 수정)

**구현 내용**:
1. `SceneRenderOrchestrator.ts` 신규 구현:
   - `RENDER_LAYER_ORDER`에 따른 계층별 드로잉 위임 관리
   - 배경/그리드, 스켈레톤, HUD, 모달, 트랜지션 호출 캡슐화
2. `SceneDirector.ts`는 프레임 델타타임 업데이트와 씬 오케스트레이션만 담당하고, 드로잉 루틴은 `SceneRenderOrchestrator`에 위임.

**유지 사항**:
- 7개 레이어 렌더링 순서(`RENDER_LAYER_ORDER`), 블렌딩 모드, 시각적 출력 100% 동일 유지

**완료 조건**:
- [x] `SceneDirector.ts`가 **1,000줄 이하**로 최종 슬림화된다.
- [x] 씬 렌더링 통합 테스트 100% 통과.

**테스트**:
- `npx vitest run tests/unit/scene-director.test.ts`
- `npm test`

---

### [REFACTOR-SRP-006]

**제목**: `ContentLoadService` 스키마 무결성 검증기 및 캐시 관리자 분리

**목적**:
`ContentLoadService.ts` (1,074줄)에서 비동기 요청 세대 관리(Generation Counter) 및 생명주기 관리 외에 결합되어 있는 룰셋/스키마 호환성 검증기(`ContentPackValidator`)와 팩 인메모리 캐시 관리자(`ContentCacheManager`)를 분리하여 1,000줄 이하로 슬림화한다.

**수정 대상**:
- `dream_guardian/src/core/content/ContentPackValidator.ts` (신규)
- `dream_guardian/src/core/content/ContentCacheManager.ts` (신규)
- `dream_guardian/src/core/ContentLoadService.ts` (수정)

**구현 내용**:
1. `ContentPackValidator.ts` 신규 구현:
   - `validateRulesetCompatibility()`, `validateIntegrityHash()`
2. `ContentCacheManager.ts` 신규 구현:
   - 활성 팩 캐싱, Generation 번호 기반 불변 캐시 보관
3. `ContentLoadService.ts`를 비동기 로드 요청 조율자로 단순화.

**유지 사항**:
- 게시본 로컬 스토리지 로드, 무결성 검증, fallback 반환 로직 100% 동일 보존

**완료 조건**:
- [x] `ContentLoadService.ts`가 **1,000줄 이하**로 감축된다.
- [x] 콘텐츠 로드 단위/통합 테스트 100% 통과.

**테스트**:
- `npx vitest run tests/integration/content-manifest-load.test.ts`
- `npm test`

---

### [REFACTOR-SRP-007]

**제목**: `MenuRenderer` 3대 메뉴 서브 렌더러 및 충돌 판정기(HitTester) 분리

**목적**:
`MenuRenderer.ts` (1,054줄)에서 메인 메뉴, 챕터 선택, 서브레벨 선택 화면 드로잉과 마우스/터치 충돌 판정(`MenuHitTester`)을 분리하여 UI 레이어의 단일 책임 원칙을 확립하고 1,000줄 이하로 슬림화한다.

**수정 대상**:
- `dream_guardian/src/ui/menu/MenuHitTester.ts` (UI/Input, 신규)
- `dream_guardian/src/ui/menu/ChapterSelectView.ts` (UI, 신규)
- `dream_guardian/src/ui/MenuRenderer.ts` (UI, 수정)

**구현 내용**:
1. `MenuHitTester.ts` 신규 구현:
   - 버튼 바운딩 박스 적중 판정 및 호버 좌표 계산 분리
2. `ChapterSelectView.ts` 신규 구현:
   - 챕터 카드, 별점, 난이도 인디케이터 드로잉 분리
3. `MenuRenderer.ts`는 최상위 뷰 라우팅 및 애니메이션 상태 전파만 담당.

**유지 사항**:
- 메뉴 버튼 클릭 및 호버 애니메이션, 사운드 인디케이터, 챕터 선택 동작 100% 동일 유지

**완료 조건**:
- [x] `MenuRenderer.ts`가 **1,000줄 이하**로 감축된다.
- [x] 메뉴 렌더링 및 UI 단위 테스트 100% 통과.

**테스트**:
- `npx vitest run tests/unit/menu-renderer.test.ts`
- `npm test`

---

### [REFACTOR-SRP-008]

**제목**: `HazardZoneRenderer` 3D 원근 투영 기하 계산기 분리

**목적**:
`HazardZoneRenderer.ts` (1,049줄)에서 3D 바닥 원근 매핑 및 사다리꼴 슬롯 기하 연산부(`HazardGeometryCalculator`)를 분리하여 렌더러는 순수 그래픽 드로잉에만 집중하도록 단일 책임을 확립한다.

**수정 대상**:
- `dream_guardian/src/render/hazard/HazardGeometryCalculator.ts` (Render, 신규)
- `dream_guardian/src/render/HazardZoneRenderer.ts` (Render, 수정)

**구현 내용**:
1. `HazardGeometryCalculator.ts` 신규 구현:
   - 소실점 기반 원근 변환, 구역별 꼭짓점 좌표 계산 및 폴리곤 경로 생성 캡슐화
2. `HazardZoneRenderer.ts`에서 지오메트리 계산 코드를 분리 모듈 호출로 단순화.

**유지 사항**:
- 3D 위험 구역 레인 시각적 원근감, 위험 경고 펄스 및 파티클 연출 100% 동일 유지

**완료 조건**:
- [x] `HazardZoneRenderer.ts`가 **1,000줄 이하**로 감축된다.
- [x] 해저드 렌더러 단위 테스트 100% 통과.

**테스트**:
- `npx vitest run tests/unit/hazard-zone-renderer.test.ts`
- `npm test`

---

### [REFACTOR-SRP-009]

**제목**: `BeatRunCoordinator` 비트 동기화 및 모션 노트 평가 오케스트레이터 분리

**목적**:
`BeatRunCoordinator.ts` (1,002줄)에서 BPM 메트로놈 타임라인 동기화 및 모션 문제 은행 쿼리 조율부를 `BeatTimelineSynchronizer`로 분리하여 1,000줄 이하로 슬림화한다.

**수정 대상**:
- `dream_guardian/src/game/beat/BeatTimelineSynchronizer.ts` (Game, 신규)
- `dream_guardian/src/game/BeatRunCoordinator.ts` (Game, 수정)

**구현 내용**:
1. `BeatTimelineSynchronizer.ts` 신규 구현:
   - 8박자 비트 사이클, 카운트다운 타이머, BPM 스케일링 로직 캡슐화
2. `BeatRunCoordinator.ts`에서 타임라인 계산부를 위임하여 러닝/전투 판정 코디네이션에 집중.

**유지 사항**:
- 비트 동기화 음악 재생 타이밍, 별 노트 생성 주기, 판정 적중 윈도우 100% 동일 유지

**완료 조건**:
- [x] `BeatRunCoordinator.ts`가 **1,000줄 이하**로 감축된다.
- [x] 비트 러닝 관련 단위/통합 테스트 100% 통과.

**테스트**:
- `npx vitest run tests/unit/beat-run-coordinator.test.ts`
- `npm test`

---

### [REFACTOR-SRP-010]

**제목**: `AppBootstrap` 게임 세션 진행 및 라운드 전환 흐름(`AppSessionFlowCoordinator`) 분리

**목적**:
`AppBootstrap.ts` (현재 2,043줄) 내에 결합된 챕터/스테이지 시작(`startChapter`), 챕터 선택(`selectChapter`, `selectSubLevel`), 정답/오답/타임아웃 정산 및 대사 발화 연동(`handleAnswer`), 결과 화면 전이(`showResult`), 메뉴 복귀/중단(`goToMenu`, `abortSession`), 준비/러닝 페이즈 전환(`startReadyPhase`, `startRunningPhase`) 로직을 `AppSessionFlowCoordinator`로 분리하여 약 450줄을 감축한다.

**수정 대상**:
- `dream_guardian/src/core/bootstrap/AppSessionFlowCoordinator.ts` (Core/Bootstrap, 신규)
- `dream_guardian/src/core/AppBootstrap.ts` (Core, 수정)
- `dream_guardian/tests/unit/app-session-flow-coordinator.test.ts` (Tests, 신규)

**구현 내용**:
1. `AppSessionFlowCoordinator.ts` 신규 구현:
   - `startChapter()`, `selectChapter()`, `selectSubLevel()`, `handleAnswer()`, `showResult()`, `goToMenu()`, `abortSession()` 캡슐화
   - 세션 라이프사이클(`sessionLifecycle`), 대사 오버레이(`dialogueOverlayRenderer`), BGM/전환 효과 연동
2. `AppBootstrap.ts`에서 세션 흐름 로직을 `AppSessionFlowCoordinator` 호출로 위임.

**유지 사항**:
- 챕터 시작, 문제 출제, 결과 화면 표시, 오답 카운트 및 대사 발화 등 모든 인게임 플로우 100% 동일 유지

**변경 금지**:
- 상태머신 상태 식별자 및 기존 사운드/이펙트 발동 시퀀스 변경 금지

**완료 조건**:
- [x] `AppSessionFlowCoordinator.ts`가 독립 모듈로 구현되고 500줄 이하를 유지한다.
- [x] `AppBootstrap.ts`에서 400줄 이상 감축된다.
- [x] 세션 흐름 및 결과 처리 관련 단위 테스트 100% Pass.

**테스트**:
- `npx vitest run tests/unit/app-session-flow-coordinator.test.ts`
- `npx vitest run tests/unit/app-bootstrap.test.ts`
- `npm test`

---

### [REFACTOR-SRP-011]

**제목**: `AppBootstrap` 인게임 라운드 이벤트 바인더 및 모션 입력 라우터(`AppRoundEventBinder`) 분리

**목적**:
`AppBootstrap.ts`에서 `BeatRoundResolver` 이벤트 결합, `ArmReachAnswerSelector` 정답 확정 및 체류 콜백, `PhaseAHazardController` 피격/회피 처리, `StageProgressController` 라운드 진행/보스 클라이맥스 진입 콜백, `footKeynoteInput` 발 키노트 라우팅 로직을 `AppRoundEventBinder`로 분리하여 약 350줄을 감축한다.

**수정 대상**:
- `dream_guardian/src/core/bootstrap/AppRoundEventBinder.ts` (Core/Bootstrap, 신규)
- `dream_guardian/src/core/AppBootstrap.ts` (Core, 수정)
- `dream_guardian/tests/unit/app-round-event-binder.test.ts` (Tests, 신규)

**구현 내용**:
1. `AppRoundEventBinder.ts` 신규 구현:
   - `bindRoundEvents(host: AppRoundEventHost): void`
   - 비트 리졸버, 암리치 셀렉터, 장판 컨트롤러, 스테이지 프로그레스 컨트롤러, 발 키노트 라우터 바인딩 로직 분리
2. `AppBootstrap.ts`의 생성자 내 컨트롤러 콜백 및 라우터 코드를 헬퍼 호출로 대체.

**유지 사항**:
- 발 키노트 및 팔 뻗기 입력 반응, 장판 피격 시 HP 감소 및 콤보 초기화 100% 동일 유지

**변경 금지**:
- 컨트롤러 간 이벤트 전파 순서 변경 금지

**완료 조건**:
- [x] `AppRoundEventBinder.ts`가 500줄 이하로 작성된다.
- [x] `AppBootstrap.ts`에서 300줄 이상 감축된다.
- [x] 라운드 이벤트 및 모션 입력 연동 테스트 100% Pass.

**테스트**:
- `npx vitest run tests/unit/app-round-event-binder.test.ts`
- `npx vitest run tests/unit/beat-motion-round.test.ts`
- `npm test`

---

### [REFACTOR-SRP-012]

**제목**: `AppBootstrap` UI 프레젠테이션 동기화 및 콘텐츠 프리로더(`AppUIPresentationSyncManager`) 분리

**목적**:
`AppBootstrap.ts`에 포함된 UI 프리젠테이션 문서 적용/롤백(`applyUIPresentation`, `rollbackUIPresentation`, `flushPendingUIPresentation`, `setUIPresentationArtifact`, `computeContentHash`) 및 정적 매니페스트/테스트 오버라이드 로더(`loadQuestions`, `loadFitnessPatterns`, `loadStaticManifest`, `loadLocalTestOverride`)를 분리하여 `AppBootstrap.ts`를 **최종 1,000줄 이하**로 슬림화 완료한다.

**수정 대상**:
- `dream_guardian/src/core/bootstrap/AppUIPresentationSyncManager.ts` (Core/Bootstrap, 신규)
- `dream_guardian/src/core/AppBootstrap.ts` (Core, 수정)
- `dream_guardian/tests/unit/app-ui-presentation-sync-manager.test.ts` (Tests, 신규)

**구현 내용**:
1. `AppUIPresentationSyncManager.ts` 신규 구현:
   - UI 표시 스냅샷 런타임 주입, 캐시/롤백, 콘텐츠 해시 연산 로직 캡슐화
   - 질문 및 피트니스 CSV 로드, 정적 매니페스트 로드 위임
2. `AppBootstrap.ts`에서 UI 프레젠테이션 및 콘텐츠 로드 인터페이스를 위임 관리자로 연결.

**유지 사항**:
- UI 레이아웃 핫 리로드, 롤백 안전망, CSV 문제/피트니스 패턴 로드 동작 100% 보존

**변경 금지**:
- UI 프리젠테이션 아티팩트 스키마 및 해시 검증 로직 변경 금지

**완료 조건**:
- [x] `AppBootstrap.ts`가 **최종 1,000줄 이하**로 슬림화 완료된다. (전체 프로젝트 소스 파일 1,000줄 이하 달성)
- [x] UI 프레젠테이션 동기화 및 콘텐츠 로더 단위 테스트 100% Pass.
- [x] 전체 빌드(`npm run build`) 및 전체 테스트(`npm test`) 100% 통과.

**테스트**:
- `npx vitest run tests/unit/app-ui-presentation-sync-manager.test.ts`
- `npx vitest run tests/integration/content-manifest-load.test.ts`
- `npm test`

---

## 🛠️ 작업 실행 및 TDD 검증 원칙

1. **승인 게이트 (Approval Gate)**: 각 카드는 사용자의 명시적 승인 후 순차적으로 1개씩 착수한다.
2. **TDD 5단계 사이클**:
   - `[Step 1]` 기존 테스트 100% Pass 베이스라인 확인
   - `[Step 2]` 신규 유틸/모듈에 대한 실패하는 테스트 선작성 (Red)
   - `[Step 3]` 최소 모듈화 및 위임 코드 구현 (Green)
   - `[Step 4]` 전체 테스트 및 `npm run build` 회귀 결함 0건 검증 (Refactor)
   - `[Step 5]` Git 커밋 및 GitHub Issue 작업 코멘트(Rule 12) / 개발 서버 가동 보고(Rule 13)
3. **엄격한 1,000줄 상한 준수**: 리팩터링 후 신규 분리된 파일 및 원본 파일 모두 반드시 1,000줄 이하를 충족해야 완료된다.
