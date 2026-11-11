# DOC-23 — Boss Assault 브랜치 정상화 및 3단계 PR 분할 작업 카드 원장

> 이 문서는 `boss-assault` 브랜치가 192개 커밋 및 340개 이상의 변경 파일로 거대화됨에 따라 발생할 수 있는 결합 회귀 리스크를 차단하고, 프로젝트 원칙(작은 단위 개발, main 상시 안정성, 단일 기능 격리)에 맞춰 코드를 체계적으로 정돈·분할하여 `main`에 안전하게 흡수시키기 위한 종합 작업 원장이다.

---

## 1. 배경 및 문제 분석

1. **브랜치 비대화**: `boss-assault` 브랜치가 `main` 대비 192개 커밋, 342개 변경 파일(+74,699 / -17,330)로 누적되어 단일 PR 검토 및 안전한 병합이 불가능한 상태.
2. **복합 도메인 결합**: 하나의 브랜치 내에 (1) Core 아키텍처 리팩터링, (2) 문제 챌린지 엔진, (3) 스틱맨 캐릭터 리그, (4) 24박 루프 게임플레이, (5) BGM/VFX, (6) UI/정산 등 6개 도메인이 뒤섞여 있어 문제 발생 시 원인 추적이 난해함.
3. **후속 트랙 대기**: A1~A3 난이도 트랙(#735~#743), 달리기 시각 가이드 트랙(#746~#757) 등 신규 트랙이 이 거대 브랜치 위에서 대기 중이므로, 베이스라인의 안정적 고정과 단계적 분할이 시급함.

---

## 2. 6대 도메인 분류 및 분할 매핑

| 도메인 | 주요 포함 작업 | 관련 파일 / 모듈 | 분할 목표 |
|---|---|---|---|
| **① Core / Architecture** | 1,000줄 초과 모놀리스 파일 SRP 분리, deepFreeze 단일화 | `src/core/bootstrap/*`, `src/core/director/*`, `src/editor/*` | **PR-1 (Core)** |
| **② Question / Math Engine** | 4대 챌린지 생성기, Rational 유리수 연산, 280개 CSV | `src/question/challenge/*`, `assault_challenges.csv` | **PR-2 (Math & Rig)** |
| **③ Character / Stickman Rig** | CharacterRig, RigSolver, 스프링 물리, 펀치 스트로크 감지 | `src/skeleton/rig/*`, `src/skeleton/anim/*`, `src/input/StickmanPunchStroke.ts` | **PR-2 (Math & Rig)** |
| **④ Assault Gameplay Loop** | 24박 루프, 타이밍 판정기, EarlyMiss, 스쿼트 정책 | `src/game/assault/*`, `config/assault.config.ts` | **PR-3 (Assault & Audio)** |
| **⑤ Audio & VFX** | BGMManager 동적 트랙, 108/115 BPM BGM, 비주얼 연출 | `src/audio/BGMManager.ts`, `src/effects/assault/*`, `public/audio/bgm/*` | **PR-3 (Assault & Audio)** |
| **⑥ UI / Result & Storage** | AssaultHUD 비트 표시, AssaultResultView 정산, 저장소 포트 | `src/ui/Assault*`, `src/game/assault/AssaultResultStore.ts` | **PR-3 (Assault & Audio)** |

---

## 3. 작업 로드맵 및 카드 목록

| 작업 ID | GitHub Issue | 카드 제목 | 분리 브랜치 | 우선순위 | 상태 |
|---|---|---|---|---|---|
| **REFACTOR-BRANCH-001** | [#758](https://github.com/Choyounhwa/-dream-guardian/issues/758) | boss-assault 브랜치 100% Green 베이스라인 고정 및 미커밋 자산 정리 | `boss-assault` | P1-high | `[✔ 완료]` |
| **REFACTOR-BRANCH-002** | [#759](https://github.com/Choyounhwa/-dream-guardian/issues/759) | [PR-1] Core/Architecture 모놀리스 분할 및 공통 인프라 독립 브랜치 분리 | `pr/assault-core-arch` | P1-high | `[✔ 완료]` |
| **REFACTOR-BRANCH-003** | [#760](https://github.com/Choyounhwa/-dream-guardian/issues/760) | [PR-2] Question Challenge 수학 엔진 & Stickman Character Rig 독립 브랜치 분리 | `pr/assault-math-rig` | P1-high | `[✔ 완료]` |
| **REFACTOR-BRANCH-004** | [#761](https://github.com/Choyounhwa/-dream-guardian/issues/761) | [PR-3] Boss Assault 24박 루프, 타이밍 판정, Audio/VFX 및 UI 정산 브랜치 분리 | `pr/assault-gameplay-loop` | P1-high | `[▶ NEXT]` |
| **QA-BRANCH-005** | [#762](https://github.com/Choyounhwa/-dream-guardian/issues/762) | [QA] main 병합 단계별 회귀 검증 및 후속 트랙 격리 환경 검증 (제품 수정 0) | `main` | P1-high | `[ ] 대기` |

---

## 4. 세부 카드 명세

### [REFACTOR-BRANCH-001]
- **제목**: `boss-assault 브랜치 100% Green 베이스라인 고정 및 미커밋 자산 정리`
- **목적**:
  - 브랜치 분할 작업에 앞서 현재 워킹 트리의 BGMManager 동적 트랙 설정, audio.config, 오디오 에셋 등 미커밋 변경사항을 정리하고 500개 파일 / 6,907개 테스트 100% Green 통과 및 빌드 성공 상태를 안정적 체크포인트로 보존한다.
- **수정 대상**:
  - `config/audio.config.ts`
  - `src/audio/BGMManager.ts`
  - `src/core/bootstrap/BootstrapStateMachineBuilder.ts`
  - `tests/unit/bgm-manager.test.ts`
  - `HANDOVER.md`
- **구현 내용**:
  1. `BGMManager`의 `setTrack()` 모드별 동적 트랙 전환 기능 안정화
  2. `config/audio.config.ts`의 기본 어설트 BGM 상수 설정 정리
  3. 전체 테스트 및 빌드 검증 후 단일 체크포인트 커밋
- **유지 사항**: 기존 BGM 재생 및 볼륨 페이드 기능 정상 작동
- **변경 금지**: 판정 로직(`AssaultPairJudge`), 게임 루프 타임라인
- **완료 조건**:
  - [ ] `npm test` 전체 500개 파일 / 6,907개 테스트 100% Pass (실패 0건)
  - [ ] `npm run build` 성공
  - [ ] 변경 사항 커밋 완료
- **테스트**:
  - `npx vitest run tests/unit/bgm-manager.test.ts`
  - `npm test`
  - `npm run build`

---

### [REFACTOR-BRANCH-002]
- **제목**: `[PR-1] Core/Architecture 모놀리스 분할 및 공통 인프라 독립 브랜치 분리`
- **목적**:
  - `boss-assault` 브랜치에서 진행된 순수 아키텍처 리팩터링 및 공통 인프라(SRP 준수 모놀리스 분리, deepFreeze 단일화 등)를 `main` 브랜치에 안전하게 선병합할 수 있도록 독립 PR 브랜치(`pr/assault-core-arch`)로 분리한다.
- **분리 대상**:
  - `src/core/bootstrap/*` (AppEventListenerManager, AppCombatAnimationBinder 등)
  - `src/core/director/*` (SceneDirector 및 하위 코디네이터)
  - `src/editor/*` (모놀리스 분할 모듈)
  - `src/utils/deepFreeze.ts`
  - 관련 단위 테스트 슈트
- **구현 내용**:
  1. `main` 브랜치 기반 신규 분기 브랜치 `pr/assault-core-arch` 생성
  2. 아키텍처/모놀리스 분할 커밋(DOC-17 계열)만 체리픽 또는 파일 추출
  3. 게임플레이 로직에 일체 영향 없이 `main`에 즉시 병합 가능한 상태 확보
- **유지 사항**: 기존 게임 엔진 진입점 및 에디터 기능 100% 동일 동작
- **변경 금지**: 어설트 게임플레이 규칙, 수식 판정 로직
- **완료 조건**:
  - [ ] `main` 브랜치와 충돌 없이 병합 가능한 PR 생성
  - [ ] 해당 브랜치에서 `npm test` 100% Pass 및 `npm run build` 통과
- **테스트**:
  - `npm test`
  - `npm run build`

---

### [REFACTOR-BRANCH-003]
- **제목**: `[PR-2] Question Challenge 수학 엔진 & Stickman Character Rig 독립 브랜치 분리`
- **목적**:
  - 어설트 전용 챌린지 문제 출제 엔진(DOC-18, DOC-21)과 스틱맨 캐릭터 리그 및 물리 애니메이션 시스템(DOC-20)을 2차 독립 PR 브랜치(`pr/assault-math-rig`)로 분리한다.
- **분리 대상**:
  - `src/question/challenge/*` (Rational 연산, 4대 챌린지 생성기, 쌍 생성 팩토리)
  - `assault_challenges.csv`
  - `src/skeleton/rig/*` (CharacterRig, RigSolver, 스프링 물리)
  - `src/skeleton/anim/*` (ClipPlayer, 모션 블렌딩)
  - `src/input/StickmanPunchStroke.ts`
  - 관련 단위 테스트 슈트
- **구현 내용**:
  1. PR-1 완료 후 기반 브랜치에서 `pr/assault-math-rig` 분기
  2. 수학 엔진 및 캐릭터 리그 관련 커밋 및 소스 분리 집약
  3. 독립 서브시스템으로서의 인터페이스 무결성 검증
- **유지 사항**: 기존 questions.csv 및 기존 스켈레톤 렌더러 호환성 유지
- **변경 금지**: 어설트 씬 렌더링 파이프라인
- **완료 조건**:
  - [ ] 수학 챌린지 및 스틱맨 리그 단위 테스트 전건 통과
  - [ ] `npm test` 100% Pass 및 `npm run build` 통과
  - [ ] PR-1 대상 베이스에서 깔끔한 병합 보장
- **테스트**:
  - `npx vitest run tests/unit/challenge-*.test.ts`
  - `npx vitest run tests/unit/character-rig-*.test.ts`
  - `npm test`

---

### [REFACTOR-BRANCH-004]
- **제목**: `[PR-3] Boss Assault 24박 루프, 타이밍 판정, Audio/VFX 및 UI 정산 브랜치 분리`
- **목적**:
  - 24박 루프 게임플레이(8박 러닝 + 16박 답안), AssaultPairJudge 타이밍 판정, 동적 BGM/SFX, AssaultHUD 및 정산 화면/저장 포트를 3차 최종 PR 브랜치(`pr/assault-gameplay-loop`)로 통합 분리한다.
- **분리 대상**:
  - `src/game/assault/*` (AssaultLoopRunner, AssaultPairJudge, AssaultResultStore 등)
  - `config/assault.config.ts`, `config/assault-loop.config.ts`
  - `src/ui/AssaultHUD.ts`, `src/ui/AssaultResultView.ts`
  - `src/effects/assault/*`
  - `src/audio/BGMManager.ts` 및 어설트 BGM 에셋
  - 관련 통합/단위 테스트 슈트
- **구현 내용**:
  1. PR-2 기반에서 `pr/assault-gameplay-loop` 분기
  2. 24박 루프, 판정기, VFX/HUD, 결과 정산 최종 연동
  3. `?mode=boss_assault` 실경로 게임플레이 루프 무결성 보장
- **유지 사항**: 플레이어 HP 100, 오답/미스 피해 규칙, 정답 수집 규칙
- **변경 금지**: 스토리 모드 및 메인 게임 루프 상태 머신
- **완료 조건**:
  - [ ] `tests/integration/assault-loop.test.ts` 등 어설트 통합 테스트 전건 통과
  - [ ] `?mode=boss_assault` 실경로 플레이 100% 정상 작동
  - [ ] `npm test` 100% Pass 및 `npm run build` 성공
- **테스트**:
  - `npx vitest run tests/integration/assault-loop.test.ts`
  - `npm test`
  - `npm run build`

---

### [QA-BRANCH-005]
- **제목**: `[QA] main 병합 단계별 회귀 검증 및 후속 트랙 격리 환경 검증 (제품 수정 0)`
- **목적**:
  - PR 1~3이 `main` 브랜치에 순차적으로 병합된 후, `main` 브랜치의 상시 안정성(Rule 11)을 증명하고, 대기 중인 후속 트랙(#735~#743 A1~A3 난이도, #746~#757 달리기 시각 가이드)이 개별 독립 브랜치에서 안전하게 진행될 수 있는 베이스라인을 최종 승인한다.
- **수정 대상**:
  - 제품 코드(`src/`, `config/`, `CSV`) 수정 0
- **완료 조건**:
  - [ ] `main` 브랜치에서 `npm test` 100% Pass (500+ 파일, 6,900+ 테스트 실패 0건)
  - [ ] `main` 브랜치에서 `npm run build` 무오류 통과
  - [ ] `http://localhost:3000/` 스토리 모드 및 `?mode=boss_assault` 모드 실플레이 정상 가동 확인
  - [ ] 향후 작업 시 단일 기능/단일 브랜치 격리 원칙 확립
- **테스트**:
  - `npm test`
  - `npm run build`
  - `http://localhost:3000/` 브라우저 수동 검증
