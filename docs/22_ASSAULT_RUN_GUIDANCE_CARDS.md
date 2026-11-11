# DOC-22 — Boss Assault 달리기 페이즈 비언어(시각) 가이드 트랙 원장

> 이 문서는 **어떤 AI/세션이 이어받아도 동일하게 작업할 수 있도록** 배경·확정 결정·코드 위치·공통 검증 게이트를 한 곳에 모은 원장이다.
> 각 GitHub Issue 본문은 이 문서를 근거로 작성되며, 카드 본문과 이 문서가 충돌하면 **이 문서의 §2 확정 결정**이 우선한다.

---

## 1. 배경 (2026-11-10 분석)

`?mode=boss_assault`의 `run_question` 구간(8박)에서 유저는 **무엇을, 왜, 어떻게, 어떤 박자로** 달려야 하는지 알 수 없다. 원인:

| # | 현황 | 위치 |
|---|---|---|
| F1 | 러닝 구간은 시간(8박)만으로 진행. 스텝 여부와 무관하게 다음 구간 전환 | `config/assault-loop.config.ts:24`, `src/game/assault/AssaultRoundPresentationBuilder.ts:277-317` |
| F2 | 스텝은 통계 카운트만. 게이지/연출/문제 표시 영향 0 | `src/game/assault/AssaultExerciseTally.ts` |
| F3 | 일반 모드에 있는 스텝 피드백(버스트·매트 히트)이 assault 에서 **억제** | `src/core/director/SceneMotionCoordinator.ts:202-220` (`!isAssault`) |
| F4 | 유일한 안내는 텍스트 `'문제를 읽으며 달리세요'` | `src/render/AssaultSceneRenderer.ts:239-263`, `AssaultRoundPresentationBuilder.ts:371-374` |
| F5 | 그리드 맥동 박자가 실제 BPM이 아닌 `gridPulseSecondsPerBeat: 0.5` 고정값 | `src/core/director/AssaultSceneHandler.ts:432-436`, `config/assault-visual.config.ts:194` |
| F6 | 감지는 양 어깨 평균 Y 상하 반전(바운스)만. 좌/우 발 구분·박자 판정 없음 | `src/motion/RunDetector.ts:65-120` |
| F7 | 문제 텍스트는 루프 모드에서 항상 alpha 1 / scale 1 상단 고정 | `src/render/AssaultSceneRenderer.ts:114-157` |

## 2. 확정 결정 (사용자 승인 2026-11-10)

| ID | 결정 |
|---|---|
| D1 | **문제 카드 선명도는 달리기와 연동**한다. 단, 시간 하한(time floor)으로 8박째에는 반드시 100% 표시(접근성 보장). |
| D2 | 달리기 결과는 **연출 전용**. 마나·HP·데미지·점수·보상 **변경 0**. |
| D3 | 고스트 가이드는 **첫 루프(라운드 1의 run_question) + 러닝 중 정지 감지 시**에만 표시. |
| D4 | 고스트 형태: **플레이어 졸라맨과 겹친 반투명 오라 복제본**이 박자에 맞춰 위아래로 바운스(정박 착지, squash). 텍스트 0. |
| D5 | 텍스트 안내(F4)는 이번 트랙에서 **변경하지 않는다**(제거 여부는 QA 카드 이후 별도 결정). |
| D6 | 루프 타임라인(8박 + 답안 4×4박), TTS, 판정기(`AssaultPairJudge`), 스쿼트, HP 규칙 **불변**. |

## 3. 시각 언어 설계 (텍스트 0)

| 질문 | 답(시각) | 카드 |
|---|---|---|
| 왜 달리나 | 달릴수록 문제 카드가 다가와 선명해짐, 멈추면 멀어지고 흐려짐 | RUN-004 |
| 무엇을 하나 | 졸라맨과 겹친 오라 고스트가 제자리 바운스 시범 | RUN-008/009/010 |
| 어떻게 뛰나 | 고스트의 상하 바운스 = 감지 기준(어깨 상하)과 일치 | RUN-010 |
| 박자 | 바닥 발판 좌/우 교대 점등 + 수축 접근 링 + 첫 루프 카운트인 | RUN-006 |
| 잘하고 있나 | 판정 등급별 버스트/매트 파문/SFX, 모멘텀 따라 그리드 속도·채도·속도선 | RUN-005/007 |

## 4. 카드 목록 (순서 = 의존 순서)

| 순서 | 카드 ID | 레이어 | 유형 | 실경로 연결 카드? |
|---|---|---|---|---|
| 0 | BUG-ASSAULT-010 그리드 맥동 BPM 불일치 | core/director | bug | 예 |
| 1 | FEAT-ASSAULT-RUN-001 스텝 박자 판정기 | game + config | 순수 모듈 | 아니오(→RUN-003) |
| 2 | FEAT-ASSAULT-RUN-002 러닝 모멘텀 트래커 | game | 순수 모듈 | 아니오(→RUN-003) |
| 3 | FEAT-ASSAULT-RUN-003 스텝→판정→모멘텀 실경로 연결 + 스냅샷 + `[assault-run]` 로그 | core + game | 연결 | **예** |
| 4 | FEAT-ASSAULT-RUN-004 문제 카드 접근/선명도 모멘텀 연동 | game → render | 연결 | **예** |
| 5 | FEAT-ASSAULT-RUN-005 assault 스텝 피드백(버스트·매트·SFX) 복원 | effects/core | 연결 | **예** |
| 6 | FEAT-ASSAULT-RUN-006 박자 발판 + 접근 링 + 카운트인 | render | 연결 | **예** |
| 7 | FEAT-ASSAULT-RUN-007 모멘텀 월드 반응(그리드 속도·채도·속도선) | render | 연결 | **예** |
| 8 | FEAT-ASSAULT-RUN-008 StickmanRenderer 색/오프셋 오버라이드 옵션 | skeleton | 순수(회귀 핵심) | 아니오(→RUN-010) |
| 9 | FEAT-ASSAULT-RUN-009 고스트 가이드 표시 규칙 | game | 순수 모듈 | 아니오(→RUN-010) |
| 10 | FEAT-ASSAULT-RUN-010 오라 고스트 바운스 렌더 실연결 | core/director + render | 연결 | **예** |
| 11 | QA-ASSAULT-RUN-011 최종 인수(제품 수정 0) | test | G-F | 예 |

이슈 번호 매핑은 §8.

## 5. 핵심 코드 지도 (2026-11-10 기준, 착수 시 라인 재확인 필수)

| 대상 | 위치 |
|---|---|
| 실경로 부팅 예시 테스트 | `tests/integration/assault-loop.test.ts:130-214` (`window.location.search='?mode=boss_assault'` → `new AppBootstrap({canvas, autoStartCamera:false, preloadAssets:false})` → `init()` → `startReadyPhase()` → `readyPositionController.skip()` → `ASSAULT_ROUND`) |
| 스텝 입력 라우팅 | `src/core/director/SceneMotionCoordinator.ts:191-200` → `AssaultSceneHandler.handleStep` (`AssaultSceneHandler.ts:612`) |
| assault 렌더 순서 | `AssaultSceneHandler.ts:426-510` (DreamGrid → FloorMat → Approach → AssaultSceneRenderer → **Stickman(498)** → 경계 경고 → EffectManager) |
| 실제 BPM/박 | `AssaultLoopTimeline.ts:46-59` (`secondsPerBeat = 60/bpm`), `AssaultRoundPresentationBuilder.ts:283,316` |
| 문제 텍스트 위치/알파 | `AssaultSceneRenderer.ts:114-157, 347-360` |
| 졸라맨 렌더 옵션 | `src/skeleton/StickmanRenderer.ts:57-65` (`alpha, showGroundRing, showGroundShadow, showCore, showVisor, scale, alwaysRender`), `render()` 356-420 |
| 캐릭터 스킨 분기 | `src/core/bootstrap/BootstrapSubsystemFactory.ts:218-227` (`CharacterAvatarRenderer`) |
| 기존 타이밍 판정 함수 | `src/input/StarCollectionInput.ts:87` `judgeStarTiming`, `config/beat-motion.config.ts:87-100` (DRY: 재사용 우선 검토) |
| 러닝 매트 | `src/render/RunningMatRenderer.ts`, `src/render/assault/AssaultFloorMatAdapter.ts` |
| 이펙트 | `ctx.effectManager.playBurst`, `src/render/assault/AssaultImpactVFX.ts` |
| 진단 로그 플래그 | `config/dev-ui.config.ts` (현재 로그 플래그 없음. #739 `[assault-tier]`가 추가 예정 — **먼저 생긴 쪽 유틸을 공유**, 중복 로거 작성 금지) |

**파일 크기 경고(1,000줄 제한)**: `AssaultSceneHandler.ts` 695줄, `StickmanRenderer.ts` 700줄, `AssaultRoundPresentationBuilder.ts` 564줄. 신규 로직은 기존 파일에 덧붙이지 말고 `src/game/assault/run/`, `src/render/assault/` 신규 모듈로 분리하고 기존 파일에는 호출 1~수 줄만 추가한다.

## 6. 공통 설정 SSOT

신규 `config/assault-run.config.ts` (RUN-001에서 생성, 이후 카드는 **필드 추가만**):

```ts
// 초기 제안값 — 카드 착수 시 테스트로 고정
stepTiming:   { perfect: 0.10, good: 0.20 }          // 초, 정박 기준 ±
momentum:     { gain: { perfect: 0.25, good: 0.15, off: 0.05 }, decayPerBeat: 0.30, graceBeats: 2 }
idle:         { idleBeatsForStop: 1.0 }              // 마지막 스텝 후 N박 무스텝 = 정지
approach:     { floorEndBeat: 8, fullAtMomentumBeats: 4 }
ghost:        { alpha: 0.35, fadeSeconds: 0.3, bounceHeightRatio: 0.04, squash: 0.08, color: '#9FF6FF' }
world:        { gridSpeedMin: 0.6, gridSpeedMax: 1.6, desaturateWhenIdle: 0.5 }
diagnostics:  { logTag: '[assault-run]' }
```

## 7. 공통 실경로 적용 검증 게이트 (모든 카드 필수)

> 과거 카드에서 모듈·단위 테스트만 완성되고 실제 `?mode=boss_assault` 플레이에 연결되지 않은 사례(#718 등)가 반복되었다. 아래 게이트를 통과하지 못하면 **DONE 금지**.

- **G-A 연결 증명**: 단위 테스트 외에 `AppBootstrap` 실경로 통합 테스트 1건 이상. `window.location.search = '?mode=boss_assault'`로 부팅하고, 중간 부품(판정기·모멘텀·렌더러·세션)을 **가짜 객체나 수동 주입으로 대체하지 않는다**. 스텝 입력은 `SceneMotionCoordinator` 이전의 공개 입력 경로(포즈 랜드마크 시퀀스 또는 기존 통합 테스트가 쓰는 공개 API)로 넣는다. 순수 모듈 카드는 "해당 없음 — 연결 카드 #번호에서 검증"으로 명시.
- **G-B 결과 관찰**: 내부 함수 반환값이 아니라 **화면에 넘어가는 최종 데이터**(예: `app.assaultSession.presentation` 스냅샷, 렌더러에 전달된 인자, mock canvas 2D 호출 기록 `globalAlpha`/`fillText`/좌표)를 검증한다.
- **G-C 연결 전 실패 확인**: 연결 작업 전에 G-A/G-B 테스트를 실행해 **Red(실패)** 를 기록한다. 연결 전에도 통과하면 실제 경로를 보지 않는 테스트이므로 재작성한다. Red 로그(테스트명 + 에러 메시지)를 이슈 코멘트에 첨부.
- **G-D 직접 플레이**: `http://localhost:3000/?mode=boss_assault`에서 직접 플레이하고 카드별 관찰 항목을 이슈 코멘트에 기록한다. 확인 못 한 항목은 **"미검증"** 으로 적고 완료 처리하지 않는다(카메라 없는 환경이면 키보드 fallback 여부와 함께 "카메라 미검증" 명시).
- **G-E 진단 로그**: 개발 빌드 콘솔에 **라운드마다(run_question 종료 시) 1줄** `[assault-run]` 로그를 출력한다. 형식:
  `[assault-run] r=<round> bpm=<bpm> steps=<n> P/G/O=<p>/<g>/<o> momentum(avg/end)=<a>/<e> idleBeats=<i> reveal(b4/b8)=<x>/<y> ghost=<on|off>(<reason>)`
  카드는 자기 담당 필드만 채우고 나머지는 `-`. `config/dev-ui.config.ts` 플래그로 on/off, 프로덕션 빌드 off. 콘솔 캡처를 이슈 코멘트에 첨부. (`[assault-tier]`는 답안 난이도 트랙 #735~#743 전용 태그이므로 이 트랙은 `[assault-run]` 사용)
- **G-F 최종 인수**: QA-ASSAULT-RUN-011에서 제품 수정 0으로 자동 테스트 + 다회차 직접 플레이로 전 파이프라인 최종 확인.

### 공통 완료 체크 (모든 카드)
- [ ] TDD: Red 기록 → Green → Refactor
- [ ] `npm test` 100% Pass (성공/실패 건수 분리 보고, 실패 0건 명시)
- [ ] `npm run build` 성공
- [ ] D2/D6 불변 회귀 테스트 통과 (마나/HP/점수/타임라인/TTS/판정기)
- [ ] 신규·수정 파일 1,000줄 미만, 중복 로직 0
- [ ] Rule 12 이슈 코멘트(변경 파일, 테스트 결과, G-A~G-E 증빙), Rule 13 `http://localhost:3000/?mode=boss_assault` 안내

## 8. 이슈 번호 매핑

| 순서 | 이슈 | 카드 ID | 의존 |
|---|---|---|---|
| 0 | #746 | BUG-ASSAULT-010 | — |
| 1 | #747 | FEAT-ASSAULT-RUN-001 StepTimingJudge | #746 |
| 2 | #748 | FEAT-ASSAULT-RUN-002 RunMomentumTracker | #747 |
| 3 | #749 | FEAT-ASSAULT-RUN-003 실경로 연결 + 스냅샷 + 로그 | #746 #747 #748 |
| 4 | #750 | FEAT-ASSAULT-RUN-004 문제 카드 접근·선명도 | #749 |
| 5 | #751 | FEAT-ASSAULT-RUN-005 스텝 피드백 복원 | #749 |
| 6 | #752 | FEAT-ASSAULT-RUN-006 박자 발판·링·카운트인 | #746 #749 |
| 7 | #753 | FEAT-ASSAULT-RUN-007 모멘텀 월드 반응 | #749 |
| 8 | #754 | FEAT-ASSAULT-RUN-008 StickmanRenderer 오라 옵션 | — |
| 9 | #755 | FEAT-ASSAULT-RUN-009 GhostGuidePolicy | #749 |
| 10 | #756 | FEAT-ASSAULT-RUN-010 오라 고스트 렌더 실연결 | #754 #755 |
| 11 | #757 | QA-ASSAULT-RUN-011 최종 인수(제품 수정 0) | #746~#756 |
