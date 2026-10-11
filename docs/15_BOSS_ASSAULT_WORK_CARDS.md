# DOC-15 — 보스 접근전 상세 작업 카드 및 등록 원장

- 작성일: 2026-10-10 / 기준: DOC-14 v0.2, 특히 §6.4~6.7.
- 효력: **문서화·GitHub 등록만 승인**. 아래 모든 카드는 OPEN / 계획 / 개별 실행 승인 대기다. 구현·일괄 실행·기본 모드 전환 승인이 아니다.
- 관리 이슈: [BOSS-ASSAULT-TRACK #502](https://github.com/Choyounhwa/-dream-guardian/issues/502). 기존 하위 카드 37개(최초 등록 시 단일 책임 분리를 위해 목표 범위보다 2개 추가). 이번 상세화에서는 새 이슈 없이 기존 URL을 재사용한다.
- 현재 테스트/빌드: 실행하지 않음. 통과·구현 완료를 주장하지 않는다. 기존 SSOT 순서와 NEXT 표시는 변경하지 않는다.
- **2026-10-11 v0.3 보완**: DOC-14 §15(결함 A1~A8, 충돌 B1~B8, 추가 C1~C10, 절차 D1~D4, 인수 A24~A31)를 반영했다. 기존 카드에는 §4.1 보완 조항을 추가했고, 신규 카드 38~46(선택 47은 미등록 후보)을 §4.2에 등록했다. 등록은 구현 승인이 아니다.

## 1. 공통 실행 계약과 경로 조사

카드의 `수정 대상`만 소스/config 허용 목록이다. 상세 본문의 경로는 저장소 루트 기준이다. `신규 제안`은 아직 존재하지 않으며 이번 개정에서 생성하지 않는다. tests는 소스 3개 제한과 별도로 기재한다. barrel/index 파일도 묵시적으로 허용하지 않는다. 착수 시 경로와 API를 재확인하고 다른 레이어 또는 4번째 파일이 필요하면 중단·카드 분리·재승인을 받는다.

2026-10-10 도구 조사에서 기존 경로를 확인했다: `src/core/{AppBootstrap,SceneDirector,SessionLifecycle,GameSessionContext,StateMachine,types,GameEngine,EventBus}.ts`, `src/game/{MotionNoteTimeline,BattleState,BossController,BeatRoundResolver,BeatRunCoordinator,StageProgressController}.ts`, `src/game/interaction/{EvadeJudge,JumpJudge}.ts`, `src/input/{ArmReachAnswerSelector,KeyboardInput,InputBuffer}.ts`, `src/motion/{MotionIntentBus,JumpDetector,CalibrationHelper}.ts`, `src/question/{QuestionBank,QuestionEvaluator,QuestionSpeech}.ts`, `src/render/{MotionNoteRenderer,NoteProjection,NoteAnchorResolver,QuestionRenderer}.ts`, `src/types/motion-note.ts`. assault 파일은 검색에서 발견되지 않았다. 나머지 아래 assault 경로는 모두 신규 제안이다.

확인한 재사용 제약:
- MotionNoteTimeline.loadNotes는 reset을 호출하고 beat는 1-based다. assault 콘텐츠는 0-based이며 변환은 어댑터 한 곳에서 한다. 라운드 전체를 한 번 적재하고 pair마다 다시 load하지 않는다.
- 좌우 답은 **논리 노트 한 개, 시각 객체 두 개**다. 미선택 탄환 Miss를 만들지 않는다. pair 정오의 권위는 신규 순수 판정기, Timeline은 재사용 어댑터를 통해 생명주기·스냅샷을 제공한다. 타입 확장이 필요하면 02에서 additive 계약으로 확정하고 기존 판정 의미를 바꾸지 않는다.
- BattleState.applyHazardDamage(amount)는 HP 전용 변경 경로이며 onWrong/onCorrect는 기존 통계와 결합되어 있다. 신규 정산은 전자를 명시적 수치로 사용하고 후자를 pair마다 호출하지 않는다.
- SessionLifecycle은 세션 토큰/종료 권위를 재사용하지만 schedule의 setTimeout을 신규 공격 예약에 사용하지 않는다. 새 엔진/전역 EventBus를 만들지 않는다.

### 모든 이슈에 적용할 검증 및 승인 규칙

- 구현·데이터·config 카드: 별도 승인 → `npm test` Baseline → 기재 테스트 선작성 → 대상 테스트 Red 실제 확인 → 허용 목록 최소 구현 → Green → 전체 `npm test` 및 `npm run build`. 데이터 카드도 동일하며 읽기 전용/유효성/legacy 불변을 검사한다. 타입 카드는 부정 타입 테스트(negative type tests)와 컴파일 계약 테스트로 Red를 확인한다.
- DOC 카드(01)는 문서만 수정: 실행 TDD 예외. 결정표·API 대조·A01~A23 추적성 검토로 검증하고 실행 테스트 미실시를 명시한다.
- QA 카드(25,36)는 제품 소스 0개: 통합/인수 테스트와 수동 증거만 작성한다. 기존 구현에 대한 characterization은 억지 Red를 만들지 않는다. 실패는 제품을 고치지 않고 별도 버그 카드/승인을 요구한다. Baseline·대상 테스트·전체 테스트·빌드와 실기기 결과를 분리 기록한다.
- 승인된 구현 완료 시에만 실제 테스트 결과, 변경 파일, 완료 조건을 `gh issue comment`로 기록하고 로컬 서버를 확인해 안내한다. 이번 등록은 이 완료 절차를 실행하지 않는다. (v0.3 D1) 카드 완료 커밋은 AGENTS.md Step 5에 따라 승인된 카드 완료 시 수행한다. 푸시·기본 모드 전환은 별도 명시 승인 없이 하지 않는다.
- 아래 각 카드의 유지 사항에는 legacy 기본 모드·CSV·기존 저장·공용 엔진/버스 보존이 공통 포함된다. 변경 금지는 허용 목록 밖 파일, 다른 레이어, 후보 수치의 무단 확정, 미래 기능 확장이다.

## 2. 단계·의존성·게이트

| 단계 | 카드 | 종료 게이트 | 상태 |
|---|---|---|---|
| G0 계약 승인 | 01 (#503) | 이름/단위/API·소유권 및 MVP 수치 결정; 결전/보상은 차단 유지 | **해제 완료 (DONE)**: G1 착수 허용 |
| G1 데이터 준비 | 02~07, 39, 40 | 타입 → 조정값/콘텐츠 → 검증 → 순수 계획; 실행·HP·저장 없음 | 착수 가능 (G0 해제) |
| G2 MVP 구성 요소 | 08~20, 41, 43, 44 | 활성 시계, 입력, 순수 판정, 반복 진행, 정산, 접근, 읽기 전용 화면 | 대기 (G1 선행) |
| G3 MVP core loop | 21~25, 42 | 내부 테스트 진입만. A01~A20/A23 및 대표 3쌍 교대 시나리오. 보상·저장·결전 자동 실행 없음 | 대기 (G2 선행) |
| G4 근접 결전 | 26 → 37 → 27~30 | 별도 결전 수치 승인 후 HP 주입 포트·패턴·점프/저충격·사망 우선 인계. 30에서 A22 통합 검증 | **미결 차단 유지** (별도 승인 전 착수 금지) |
| G5 보상/결과/저장 | 31~35 | 별도 보상·비교 조건 승인, 순수 정책 → 저장 어댑터 → 표시 → core 연결 | **미결 차단 유지** (별도 승인 전 착수 금지) |
| G6 인수 | 36, 45 | 실기기/회귀 증거 검토. 통과해도 기본 모드 전환은 별도 미등록 카드/승인 필요 | 대기 (G3~G5 후속) |

**v0.3 신규 카드 배치**: 38(G0, 01 결정 입력용 실측 완료) → 01 (MVP 계약 결정 완료) → 02~07, 39, 40 → 08~20, 41, 43, 44 → 21~24, 42 → 25 → 45 → 26 → 37 → 27~36 (46은 B3 시간 기반 채택으로 제외/선택). 갱신된 위상 순서: 38(✔) → 01(✔) → 02~07, 39, 40 → 08~20, 41, 43, 44 → 21~24, 42 → 25 → 45 → 26 → 37 → 27~36.

실행 순서는 01~26 → 37 → 27~36이며 실행 큐 승인이 아니다. 37은 API 추가 조사로 분리한 카드다. 각 카드의 선행 목록이 정확한 DAG다. 01은 MVP 계약 승인 기록([#503 코멘트](https://github.com/Choyounhwa/-dream-guardian/issues/503))으로 MVP 선행 게이트(G0)를 해제하고 G1(#504~#509, #542, #543)의 착수를 허용한다. 단, 결전(G4) 및 보상/저장(G5) 결정은 해당 단계 전 별도로 승인하기 전까지 엄격히 차단 상태를 유지한다. G3를 넘기 전 결전/보상 구현을 시작하지 않는다. G3 종료 시 결전은 **미구현 인계 스냅샷**으로 멈추며 승리를 위조하지 않는다.

게이트 증거: 승인자 Choyounhwa, 기준 문서 DOC-14 v0.3 / DOC-15 v0.31, 실측 근거 [#541 실측 보고 코멘트](https://github.com/Choyounhwa/-dream-guardian/issues/541#issuecomment-6110815280) 및 [#503 결정 코멘트](https://github.com/Choyounhwa/-dream-guardian/issues/503). MVP 부분 승인 증거로 G0를 해제하고 G1 카드를 착수 가능 상태로 전환한다. G4 결전/HP, G5 보상/저장 비교 결정은 별도 증거가 없으므로 차단을 유지한다.

추가 API 대조 확인:
- `dream_guardian/src/question/QuestionSpeech.ts`: 공개 계약은 `speak(): void`, `status`, `enabled`, `isSupported`이며 완료/실패 콜백이 없다. status의 3초 안전 타이머로 인해 발화 중 idle 전이가 가능하므로, 01에서는 콜백 대기 대신 **시간 기반 비대기 정책(DEC-B3: 글자수 비례 추정 낭독 시간 가산)**을 확정 채택한다. (선택 카드 #547/46 API 확장은 기각)
- `dream_guardian/src/types/index.ts:4`: `GameState` 타입이 정의되어 있으나 `GameMode`는 `src/core/types.ts`에 분리되어 있음. mode 정의는 `src/types/assault.ts`로 신규 분리하고 상태 전이는 #523에서 `src/types/index.ts`, `StateMachine.ts`, `GameSessionContext.ts` 3개 파일로 한정하여 연결한다.
- `dream_guardian/src/core/SessionLifecycle.ts`: 세션 종료 단일 권위자. HP 0 도달 시 중복 `showResult` 방지 및 단일 종료 경로 확정.

### MVP 결정 원장 (01 확정 및 잔여 단계 게이트 원장)

- **승인 근거**:
  - 실측 스파이크: [BOSS-ASSAULT-38 / Issue #541 실측 보고](https://github.com/Choyounhwa/-dream-guardian/issues/541#issuecomment-6110815280)
  - 설계 기준: DOC-14 §14, §15 (v0.3)
  - 승인 상태: **G0 게이트 해제 (MVP 결정 완료)** / G1(#504~#509, #542, #543) 착수 허용. G4/G5 미결 차단 유지.

#### 1. 현행 코드 대조 결함 결정 (DEC-A1 ~ DEC-A8)

| 결정 ID | 항목 | 확정 내용 및 실측/API 대조 근거 | 위임/적용 카드 | 상태 |
|---|---|---|---|---|
| DEC-A1 | GameState 위치 | `GameState`는 `src/types/index.ts:4`에 위치함. 모드 타입은 `src/types/assault.ts`로 분리 확정. 상태 전이는 `src/types/index.ts`, `StateMachine.ts`, `GameSessionContext.ts` 3개 파일로 수정 대상 교체 확정. | 02 (#504), 21 (#523) | **확정 (MVP)** |
| DEC-A2 | ASSAULT_ROUND 동작 소유권 | `config/judgment.config.ts:253` `PHASE_INTENT_OWNERSHIP`에 `ASSAULT_ROUND: ['reachLeft', 'reachRight', 'squat']` 명시 등록 확정. | 40 (#543) | **확정 (MVP)** |
| DEC-A3 | 펀치 화면 판정 방식 | **2D 목표 영역 뻗기 확정**: 화면 상단 좌/우 타깃 박스 진입 + 팔 신전(팔꿈치 각도 임계치) + 손목-어깨 거리(`shoulderWidth * k` 상대비율). (#541 실측: 검출률 95.8%, 가드/X자 오검출 0.0% 증명. 속도 기반 78.3% 기각) | 03 (#505), 09 (#511) | **확정 (MVP)** |
| DEC-A4 | 손–답 매핑 | **같은 쪽 손만 확정**: 왼손→왼쪽 답, 오른손→오른쪽 답. 팔 교차 금지로 X자 오발 원천 차단. | 09 (#511), 12 (#514) | **확정 (MVP)** |
| DEC-A5 | 반복 보기 쌍 생성기 | **시드 RNG 주입 순수 함수 확정**: `QuestionEvaluator`의 `Math.random` 우회, 시드 기반 결정적 오답(±1, ±2, ±10, 자릿수 치환 등) 쌍 생성. | 07 (#509) | **확정 (MVP)** |
| DEC-A6 | MVP 문항 범위 | **Ch.1~2 한정, 유한 정수/소수 정답, shapeCode 없음, 라벨 길이 상한(6자 이내)** 확정. 부적격 문항 사전 필터링 위임. | 39 (#542) | **확정 (MVP)** |
| DEC-A7 | MVP 정답 타격 보스 효과 | **보스 HP 불변 확정**: MVP 단계에서는 보스 HP를 직접 깎지 않고 접근 진행도(거리/스케일 연출) 및 타격 스턴 피드백만 제공. HUD 보스 HP바 숨김. | 16 (#518), 19 (#521), 20 (#522) | **확정 (MVP)** |
| DEC-A8 | 플레이어 HP 정책 | **기존 100 불변 유지**: `BattleState.DEFAULT_CONFIG` 변경 없이 기존 100 고정, 피해량만 `assault.config.ts`에서 별도 주입 관리. | 03 (#505), 22 (#524) | **확정 (MVP)** |

#### 2. 런타임 충돌 대응 결정 (DEC-B1 ~ DEC-B8)

| 결정 ID | 항목 | 확정 내용 및 실측/API 대조 근거 | 위임/적용 카드 | 상태 |
|---|---|---|---|---|
| DEC-B1 | 세션 종료 단일 권위 | `SessionLifecycle.ts`를 단일 종료 권위로 확정. HP 0 시 `showResult(false)` 중복 호출 차단. | 23 (#525) | **확정 (MVP)** |
| DEC-B2 | low_hp TTS 발화 정책 | HP 20 이하 시 `QuestionSpeech`의 `low_hp` 자동 발화 억제, 시각적 HUD 경고로 대체 확정. | 24 (#526) | **확정 (MVP)** |
| DEC-B3 | TTS 정책 | **시간 기반 비대기(non-blocking) 확정**: 문제 글자수 비례 추정 낭독 시간(`chars * rateMs`) 가산 방식 채택. `QuestionSpeech.status` 3초 타이머 의존 차단. | 15 (#517), 22 (#524), 23 (#525) | **확정 (MVP)** |
| DEC-B4 | X자 일시정지 제스처 | assault 모드 실행 중 X자 인식 일시정지 비활성화 확정. 화면 UI 일시정지 버튼 및 키보드 Escape 키 사용. | 23 (#525) | **확정 (MVP)** |
| DEC-B5 | 비트 클록 드리프트 방지 | AudioContext 시간 또는 requestAnimationFrame 델타 누적 기반 고정 타임라인 채택. 비트 SFX 재생, BGM은 옵션. | 41 (#544) | **확정 (MVP)** |
| DEC-B6 | 입력 지연 보정 | **실측 기반 보정 확정**: `#541` 실측 중앙값 126ms, p90 165ms 반영하여 `inputLatencyMs = 130ms`, 판정 유예창 `lateGraceWindowMs = 170ms` 확정. | 03 (#505), 08 (#510), 12 (#514) | **확정 (MVP)** |
| DEC-B7 | 백그라운드 탭 전환 | `visibilitychange` 발생 시 오디오/비트 즉시 일시정지 및 복귀 시 유예 카운트 적용. | 24 (#526) | **확정 (MVP)** |
| DEC-B8 | 공격 중 재개 정책 | 일시정지 해제 시 진행 중이던 공격 예고부터 재시작 + 1박 카운트 유예 제공 확정. | 08 (#510), 15 (#517) | **확정 (MVP)** |

#### 3. 추가 세부 설계 및 밸런스 결정 (DEC-C1 ~ DEC-C10)

| 결정 ID | 항목 | 확정 내용 및 실측/API 대조 근거 | 위임/적용 카드 | 상태 |
|---|---|---|---|---|
| DEC-C1 | 읽기 시간 하한 계산 | 연산 유형별 초 단위 하한 + 글자수 비례 가산(기본 8박 보장). | 39 (#542) | **확정 (MVP)** |
| DEC-C2 | 보스 공격 손 시각 앵커 | 보스 스프라이트 고정 앵커 좌표를 config로 분리. | 03 (#505) | **확정 (MVP)** |
| DEC-C3 | 보스 접근 스케일 피드백 | 라운드 진행도에 비례한 보스 거리 좁히기 및 확대 렌더링. | 42 (#545) | **확정 (MVP)** |
| DEC-C4 | 콤보/리듬 판정 등급 | 연속 정답 타격 시 콤보 누적, 오답/Miss 시 리셋. 판정 등급: Perfect(±50ms), Good(±120ms), Late(+170ms). | 03 (#505), 17 (#519) | **확정 (MVP)** |
| DEC-C5 | 운동량 지표 표시 | 실측 스쿼트/펀치 횟수만 집계 표시. 모드 특성상 kcal 계산은 미지원 표시. | 26 (#528) | **확정 (MVP)** |
| DEC-C6 | 스쿼트 저충격 대체 | **양팔 가드(Dual-Arm Guard) 채택**: #541 실측 검출률 96.7%, X자 간섭 0건 검증 완료. | 43 (#546) | **확정 (MVP)** |
| DEC-C7 | 개발자 테스트 진입 URL | URL 쿼리 파라미터 `?mode=boss_assault`로 직접 세션 진입 허용. | 25 (#527) | **확정 (MVP)** |
| DEC-C8 | 튜토리얼 및 연습 모드 | G3 인수 완료 후 후속 배치. | 45 (#548) | **확정 (MVP 후속)** |
| DEC-C9 | 보기 라벨 글자수 상한 | 한글/숫자/기호 포함 최대 6글자로 제한하여 화면 오버플로 방지. | 03 (#505), 39 (#542) | **확정 (MVP)** |
| DEC-C10 | 피해량 밸런스 | 오답/미선택 피해량: 10, 스쿼트 회피 실패 피해량: 5 (플레이어 HP 100 기준). | 03 (#505), 16 (#518) | **확정 (MVP)** |

#### 4. 미결 및 차단 유지 항목 (G4, G5 게이트)

| 단계 | 항목 | 내용 | 상태 |
|---|---|---|---|
| G4 | 근접 결전 전환 및 보스 HP 실차감 | 결전 페이즈 진입 조건, 보스 HP 차감/사망 처리, 보스 공격 패턴 루프 | **미결 (차단 유지)**: #528 착수 전 별도 결정 필요 |
| G4 | 피버 모드 및 보스 스펠 | 피버 게이지 충전 공식, 피버 타임 효과음/이펙트, 보스 특수 반격 스펠 | **미결 (차단 유지)**: #530 착수 전 별도 결정 필요 |
| G5 | 보상 및 재화 연동 | 별가루/미니언 보상량 산출 공식, 가디언 성장치 반영 여부 | **미결 (차단 유지)**: #533 착수 전 별도 결정 필요 |
| G5 | 기록 저장 및 순위 비교 | 프로필별 최고 기록, 랭킹 저장 스키마, 난이도별 비교 조건 | **미결 (차단 유지)**: #534 착수 전 별도 결정 필요 |

수식형 보기·온라인/오프라인 랭킹 알고리즘·새 편집기 지원·전 챕터 콘텐츠·기본값 전환은 **미등록 후속 백로그**다. 이번 37개 카드에 몰래 포함하지 않는다.

## 3. 등록 원장

관리: https://github.com/Choyounhwa/-dream-guardian/issues/502 (OPEN). 하위 37개 등록 완료(구현 완료 아님). 모든 상태: OPEN / 계획 / 개별 승인 대기.

| 작업 ID | 실제 GitHub URL | 상태 |
|---|---|---|
| BOSS-ASSAULT-01 | https://github.com/Choyounhwa/-dream-guardian/issues/503 | DONE (MVP 계약·수치 결정 완료, G0 해제, G1 착수 허용) |
| BOSS-ASSAULT-02 | https://github.com/Choyounhwa/-dream-guardian/issues/504 | DONE (타입 계약 완료) |
| BOSS-ASSAULT-03 | https://github.com/Choyounhwa/-dream-guardian/issues/505 | DONE (MVP 프로필 데이터 분리 완료) |
| BOSS-ASSAULT-04 | https://github.com/Choyounhwa/-dream-guardian/issues/506 | OPEN / 승인 대기 |
| BOSS-ASSAULT-05 | https://github.com/Choyounhwa/-dream-guardian/issues/507 | OPEN / 승인 대기 |
| BOSS-ASSAULT-06 | https://github.com/Choyounhwa/-dream-guardian/issues/508 | OPEN / 승인 대기 |
| BOSS-ASSAULT-07 | https://github.com/Choyounhwa/-dream-guardian/issues/509 | OPEN / 승인 대기 |
| BOSS-ASSAULT-08 | https://github.com/Choyounhwa/-dream-guardian/issues/510 | OPEN / 승인 대기 |
| BOSS-ASSAULT-09 | https://github.com/Choyounhwa/-dream-guardian/issues/511 | OPEN / 승인 대기 |
| BOSS-ASSAULT-10 | https://github.com/Choyounhwa/-dream-guardian/issues/512 | OPEN / 승인 대기 |
| BOSS-ASSAULT-11 | https://github.com/Choyounhwa/-dream-guardian/issues/513 | OPEN / 승인 대기 |
| BOSS-ASSAULT-12 | https://github.com/Choyounhwa/-dream-guardian/issues/514 | OPEN / 승인 대기 |
| BOSS-ASSAULT-13 | https://github.com/Choyounhwa/-dream-guardian/issues/515 | OPEN / 승인 대기 |
| BOSS-ASSAULT-14 | https://github.com/Choyounhwa/-dream-guardian/issues/516 | OPEN / 승인 대기 |
| BOSS-ASSAULT-15 | https://github.com/Choyounhwa/-dream-guardian/issues/517 | OPEN / 승인 대기 |
| BOSS-ASSAULT-16 | https://github.com/Choyounhwa/-dream-guardian/issues/518 | OPEN / 승인 대기 |
| BOSS-ASSAULT-17 | https://github.com/Choyounhwa/-dream-guardian/issues/519 | OPEN / 승인 대기 |
| BOSS-ASSAULT-18 | https://github.com/Choyounhwa/-dream-guardian/issues/520 | OPEN / 승인 대기 |
| BOSS-ASSAULT-19 | https://github.com/Choyounhwa/-dream-guardian/issues/521 | OPEN / 승인 대기 |
| BOSS-ASSAULT-20 | https://github.com/Choyounhwa/-dream-guardian/issues/522 | OPEN / 승인 대기 |
| BOSS-ASSAULT-21 | https://github.com/Choyounhwa/-dream-guardian/issues/523 | OPEN / 승인 대기 |
| BOSS-ASSAULT-22 | https://github.com/Choyounhwa/-dream-guardian/issues/524 | OPEN / 승인 대기 |
| BOSS-ASSAULT-23 | https://github.com/Choyounhwa/-dream-guardian/issues/525 | OPEN / 승인 대기 |
| BOSS-ASSAULT-24 | https://github.com/Choyounhwa/-dream-guardian/issues/526 | OPEN / 승인 대기 |
| BOSS-ASSAULT-25 | https://github.com/Choyounhwa/-dream-guardian/issues/527 | OPEN / 승인 대기 |
| BOSS-ASSAULT-26 | https://github.com/Choyounhwa/-dream-guardian/issues/528 | OPEN / 승인 대기 |
| BOSS-ASSAULT-27 | https://github.com/Choyounhwa/-dream-guardian/issues/529 | OPEN / 승인 대기 |
| BOSS-ASSAULT-28 | https://github.com/Choyounhwa/-dream-guardian/issues/530 | OPEN / 승인 대기 |
| BOSS-ASSAULT-29 | https://github.com/Choyounhwa/-dream-guardian/issues/531 | OPEN / 승인 대기 |
| BOSS-ASSAULT-30 | https://github.com/Choyounhwa/-dream-guardian/issues/532 | OPEN / 승인 대기 |
| BOSS-ASSAULT-31 | https://github.com/Choyounhwa/-dream-guardian/issues/533 | OPEN / 승인 대기 |
| BOSS-ASSAULT-32 | https://github.com/Choyounhwa/-dream-guardian/issues/534 | OPEN / 승인 대기 |
| BOSS-ASSAULT-33 | https://github.com/Choyounhwa/-dream-guardian/issues/535 | OPEN / 승인 대기 |
| BOSS-ASSAULT-34 | https://github.com/Choyounhwa/-dream-guardian/issues/536 | OPEN / 승인 대기 |
| BOSS-ASSAULT-35 | https://github.com/Choyounhwa/-dream-guardian/issues/537 | OPEN / 승인 대기 |
| BOSS-ASSAULT-36 | https://github.com/Choyounhwa/-dream-guardian/issues/538 | OPEN / 승인 대기 |
| BOSS-ASSAULT-37 | https://github.com/Choyounhwa/-dream-guardian/issues/539 | OPEN / 승인 대기 |
| BOSS-ASSAULT-38 | https://github.com/Choyounhwa/-dream-guardian/issues/541 | DONE (실측 스파이크 완료, 01 결정 입력 증거 제출) |
| BOSS-ASSAULT-39 | https://github.com/Choyounhwa/-dream-guardian/issues/542 | OPEN / 승인 대기 (v0.3) |
| BOSS-ASSAULT-40 | https://github.com/Choyounhwa/-dream-guardian/issues/543 | OPEN / 승인 대기 (v0.3) |
| BOSS-ASSAULT-41 | https://github.com/Choyounhwa/-dream-guardian/issues/544 | OPEN / 승인 대기 (v0.3) |
| BOSS-ASSAULT-42 | https://github.com/Choyounhwa/-dream-guardian/issues/545 | OPEN / 승인 대기 (v0.3) |
| BOSS-ASSAULT-43 | https://github.com/Choyounhwa/-dream-guardian/issues/546 | OPEN / 승인 대기 (v0.3) |
| BOSS-ASSAULT-44 | https://github.com/Choyounhwa/-dream-guardian/issues/547 | OPEN / 승인 대기 (v0.3) |
| BOSS-ASSAULT-45 | https://github.com/Choyounhwa/-dream-guardian/issues/548 | OPEN / 승인 대기 (v0.3) |
| BOSS-ASSAULT-46 | https://github.com/Choyounhwa/-dream-guardian/issues/549 | OPEN / 선택 카드, DEC-B3 대안 채택 시만 (v0.3) |

(#540은 TTS-VOICE-003으로 이 트랙과 무관하다.)

## 4. 상세 카드

아래 본문은 #470 형식의 상세 실행 계약이다. 각 카드의 관리 기록 허용 범위는 해당 이슈 코멘트와 `dream_guardian/HANDOVER.md`의 완료 증거 최소 기록뿐이다(SSOT/NEXT 변경 권한 없음). 관련 파일은 읽기 전용 참고이며 수정 허용 목록이 아니다. 공통 검증 절차는 각 카드 테스트 절에 적용되며 이번 개정에서는 전부 미실행이다.

### 원격 본문에 함께 적용하는 공통 계약

표기 규칙: 수정 허용 파일은 경로별 글머리표로, `src/` 및 `config/` 합계는 별도 행으로, 테스트는 별도 목록으로 표시한다. 이 절의 축약 디렉터리는 각각 `dream_guardian/src/`, `dream_guardian/config/`를 뜻한다. 관리 기록 허용 범위는 모든 카드에 동일하게 적용한다. 관련 문서는 중복 나열하지 않으며 명령은 번호까지 한 줄 인라인 코드로 표기한다. 카드별 상세 검증과 의존성의 의미는 서식 정리로 변경하지 않는다.

- 경로는 저장소 루트 기준. 신규 제안은 현재 존재하는 API/파일이 아니다. `dream_guardian/src/` 및 `dream_guardian/config/`의 합계는 최대 3개다. 허용 목록 밖·다른 레이어·네 번째 파일·barrel/HTML/빌드 설정은 수정 금지. 테스트는 별도 목록만, 관리 기록은 해당 이슈 코멘트/HANDOVER 최소 증거만 허용한다.
- 유지 사항: legacy 기본 모드/CSV/기존 저장/공용 GameEngine·EventBus·MotionNote와 동시 작업을 보존한다. config는 수치, 콘텐츠는 순서, runtime은 상태/진행, 정산은 자원 변경, effects/화면은 표시를 소유한다. 각 카드의 추가 유지/금지 조건도 모두 적용한다.
- 관련 파일: `docs/14_BOSS_ASSAULT_GAMEPLAY_DESIGN.md` v0.2, `docs/15_BOSS_ASSAULT_WORK_CARDS.md`, `docs/Dream_Guardian_개발_규칙.md`, `docs/01_GAME_DESIGN_DOCUMENT.md`, `docs/03_GITHUB_ISSUES.md`, `dream_guardian/HANDOVER.md` 및 각 카드 참조는 읽기 전용 참고이지 수정 allowlist가 아니다. 아래 잔존 축약 `src/`, `tests/` 참조는 `dream_guardian/` 아래 참고 경로다.
- 구현/데이터 카드 테스트는 승인 후 dream_guardian에서 npm test Baseline → 지정 테스트 선작성 → npx vitest run <대상> Red 실제 확인 → 별도 턴 최소 구현 → Green → 전체 npm test 100% Pass/npm run build 순서다. 타입은 실제 컴파일 부정 테스트도 확인한다. DOC/QA 예외는 각 카드대로 기록하며 가짜 Red 금지. 무관한 에디터 빌드는 요구하지 않는다.
- 완료 조건 공통: 필수 검증 미실행/실패/브라우저 증거 누락이면 DONE 금지. 실제 승인 작업 완료 시 `gh issue comment <해당 번호>`로 구현/변경 파일/실제 테스트·빌드/완료 조건 증거를 등록하고 HANDOVER에 최소 완료 기록을 남긴다. 예: `gh issue comment 507`, `gh issue comment 527`. 구현 완료 시 Rule13 `npm run dev` 또는 기존 서버 확인 후 http://localhost:3000/ 및 실제 서버 상태를 안내한다. DOC-only는 실행 테스트/서버 해당 없음으로 정직하게 기록한다. 이번 상세화는 test/build/server/완료 코멘트/커밋/푸시를 실행하지 않는다.
- 선행 구현은 실제 완료 증거와 별도 착수 승인이 필요하다. #503은 MVP 부분 승인 URL·승인자·버전·적용 카드 증거로 MVP 게이트를 해제할 수 있어 OPEN 유지 가능하다. 결전/보상/저장 수치는 각각 별도 승인 없으면 차단한다. 이 개정은 어떤 후보값/실행 큐도 승인하지 않는다.

### [BOSS-ASSAULT-01]
제목: 단계별 계약·수치 및 기존 API 대조 결정서
상태: DONE (MVP 계약·수치 결정 완료, G0 해제, G1 착수 허용). 결전/보상 수치는 미결 차단 유지.
책임 레이어: 문서/계약 관리 단일 책임. 제품 소스(`src/`) 및 설정(`config/`) 수정 0개. 테스트 파일 생성 없음.
목적: 추정 API와 후보 수치로 구현하는 것을 차단한다. mode/state, pair→MotionNote, TTS 완료 신호, HP 주입, 시계 정규화, 종료 소유자를 현행 API와 대조하고 승인자·값·단위·미결 사유·차단 카드를 기록한다. MVP 결정과 결전/보상 결정을 분리한다.
수정 대상:
- `docs/15_BOSS_ASSAULT_WORK_CARDS.md` — 결정 원장 및 §2 결정표 갱신.
- `dream_guardian/HANDOVER.md` — BOSS-ASSAULT 트랙 진행 상태 갱신.
- `docs/03_GITHUB_ISSUES.md` — #503 상태 갱신.

파일 수: `src/` 및 `config/` 합계 0개. 테스트 파일 없음. 관리 기록은 공통 계약에 한정한다.
구현 내용:
1. DOC-14 §14의 각 항목을 MVP/결전/보상·저장으로 나누고 승인자·일시·계약 버전·값·단위·근거 코멘트 URL·차단 카드를 기록했다.
2. mode/state와 세션 종료 권위, 0→1-based 및 pair 논리 노트 하나 계약을 현행 코드와 대조했다. 제안 포트와 기존 API를 구분했다.
3. QuestionSpeech는 공개 status만으로 완료/실패를 구분할 수 없음을 기록하고, 시간 기반 비대기 정책(DEC-B3: 추정 낭독 시간 가산)을 확정했다.
4. MVP 승인 증거(#541 실측 보고 https://github.com/Choyounhwa/-dream-guardian/issues/541#issuecomment-6110815280)로 선행 게이트(G0)를 해제하고 G1(#504~#509, #542, #543) 착수를 허용했다. 결전 HP/피버(G4) 및 보상/저장(G5) 미결은 계속 차단한다.
5. A01~A23 소유 카드와 자동/실기기 증거 위치를 대조하고 DEC-A1~A8, DEC-B1~B8, DEC-C1~C10에 대한 MVP 수치를 확정했다.
데이터 입력→출력: DOC-14 v0.3 / 현행 API 대조 / #541 실측 증거 → 확정된 MVP 승인 계약 원장; 소스 생성 없음.
유지 사항: DOC-14 원문과 GDD 현행 동작을 보존한다.
변경 금지: DOC-14 편집, 후보의 임의 승인, 구현·테스트 파일 생성.
완료 조건:
- [x] A01~A23 각각의 소유 카드/증거 경로가 있고 참조 단위·API 이름이 실제 코드와 일치한다.
- [x] MVP 부분 승인 기록에는 승인자·버전·URL·해제 카드가 있고, 승인 누락 시 해당 카드는 차단된다.
- [x] 결전/보상/저장 미결과 중복·상충 결정을 식별했다. MVP 결정 완료로 G0를 해제하고 잔여 G4/G5는 차단을 유지한다.
- [x] 실제 문서 작업 완료 때 변경 문서·수동 대조 결과·잔여 게이트를 #503 코멘트/HANDOVER에 기록했다. 실행 테스트 통과를 주장하지 않는다.
테스트: 문서 전용 예외. 승인 URL 누락, 단위 없는 값, 상충 버전, MVP 승인만 있는 상태의 G4/G5 진입 시도를 수동 대조 완료. Baseline/Red/Green/npm test/build는 해당 없음·미실행(Step 1 Baseline 정상 동작 확인은 완료).
관련 파일: DOC-14 §§2,5,6,14,15; 개발 규칙; 위 경로 조사 목록(읽기 전용).
선행 카드: 없음 (#541 실측 증거 반영 완료).
추적 및 중복 정책: [TRACK #502](https://github.com/Choyounhwa/-dream-guardian/issues/502). 기존 API/legacy 이력을 재사용하며 재완료·중복 카드 생성·SSOT/NEXT 이동 금지.

### [BOSS-ASSAULT-02]
제목: 불변 정의·런타임·결과·표시 타입 계약
상태: DONE (타입 계약 및 테스트 완료)
책임 레이어: Types. config 수치/콘텐츠 순서/runtime 상태/시각 효과 실행을 타입 파일에 넣지 않는다.
목적: 데이터와 가변 상태 및 부작용 요청의 경계를 고정한다.
수정 대상:
- `dream_guardian/src/types/assault.ts` — 신규 제안.
- `dream_guardian/src/types/motion-note.ts` — 기존 파일.

파일 수: `src/` 및 `config/` 합계 2개.
테스트 파일(별도):
- `dream_guardian/tests/unit/assault-types.test.ts` — 신규 제안.
구현 내용:
1. session/round/pair/attack/input 식별자와 규칙·프로필 버전 필수 필드를 정의한다.
2. readonly 정의/실행 계획과 가변 런타임, 판정 결과, 피해량 없는 정산 명령, 읽기 전용 표시 DTO를 분리한다.
3. 01 합의된 MotionNote additive 필드만 추가하고 기존 star/stomp/evade/jump 소비자의 필수 필드는 바꾸지 않는다.
4. 결전 kind는 승인된 계약만 표현하며 신규 의미가 필요하면 계약 재승인 전 중단한다.
데이터 입력→출력: 01 계약 → 타입 전용 DTO/포트; 숫자 기본값/함수 없음.
유지 사항: 기존 MotionNote 소비자의 타입 호환.
변경 금지: 런타임 가드·프로필 상수·실행 함수·HP 복사본.
완료 조건:
- [ ] 정의/중첩 계획/표시 DTO 쓰기와 sessionId 누락, 잘못된 kind 조합을 부정 타입 테스트에서 거부한다(A14,A16).
- [ ] 유효 DTO 및 기존 MotionNote 사용 코드는 컴파일되고 타입 파일에 실행/HP/config 기본값이 없다.
- [ ] Red→Green 및 전체 npm test/build 실제 결과, 변경 파일, 완료 조건을 #504 코멘트/HANDOVER에 기록한다. 미검증 DONE 금지.
테스트: 같은 테스트 파일의 negative type tests로 readonly 쓰기·식별자 누락·정의/상태 혼용을 검사한다. Vitest 실행만으로 타입 검증을 주장하지 않으며 해당 fixture가 실제 타입 검사에 포함되는지 확인한다. Baseline npm test → 타입 실패 Red/대상 테스트 확인 → 별도 최소 구현 Green → 전체 npm test/npm run build. 타입 검사 도구/설정 변경 필요 시 범위 확장 없이 차단한다.
관련 파일: DOC-14 §6.1~6.6, 기존 motion-note.ts.
선행 카드: [01 #503](https://github.com/Choyounhwa/-dream-guardian/issues/503)의 MVP 계약 승인 증거. 01 OPEN이어도 해당 부분 승인으로 해제 가능; 결전/보상 승인은 별개다.
추적 및 중복 정책: [TRACK #502](https://github.com/Choyounhwa/-dream-guardian/issues/502). 기존 MotionNote 재사용, legacy/NEXT/SSOT 및 기존 완료 이력 불변.

### [BOSS-ASSAULT-03]
제목: MVP 조정 프로필 데이터
상태: DONE (MVP 프로필 데이터 분리 및 단위 테스트 완료)
책임 레이어: Config 데이터. 콘텐츠 순서·runtime 분기·효과 실행은 소유하지 않는다.
목적: 읽기·피해·입력·표현 조정값의 단일 출처를 만든다.
수정 대상:
- `dream_guardian/config/assault.config.ts` — 신규 제안.
- `dream_guardian/config/assault-input.config.ts` — 신규 제안.
- `dream_guardian/config/assault-visual.config.ts` — 신규 제안.

파일 수: `src/` 및 `config/` 합계 3개.
테스트 파일(별도):
- `dream_guardian/tests/unit/assault-config.test.ts` — 신규 제안.
구현 내용:
1. 01 MVP 결정 증거의 timing/balance 값을 첫 파일에, 회수/자세/동시 손 임계값을 입력 파일에, 표시 수치를 visual 파일에 둔다.
2. Beats/Seconds/Ms 등 단위와 profileId/버전을 명시하고 최소 8박 및 유형별 읽기 초 하한을 독립 필드로 보존한다.
3. TTS 상한·안전 정지/추적 상실·복귀 값을 승인표와 대조한다. 누락값을 legacy 기본값이나 후보 BPM100/4박/2쌍/10라운드로 채우지 않는다.
4. 불변 데이터로 제공하고 테스트 fixture 수치를 프로덕션의 두 번째 기본값으로 만들지 않는다.
데이터 입력→출력: 승인 결정표 → readonly 프로필 데이터.
유지 사항: legacy DEFAULT_CONFIG 및 기존 battle.config 값.
변경 금지: 함수/타이머/조건부 패턴 선택·문제 텍스트·실행 상태.
완료 조건:
- [x] 모든 값이 승인 URL/단위로 추적되고 8박 미만·읽기 하한 누락·음수/비유한 안전값을 검사한다(A03,A19,A23).
- [x] 중첩 프로필 변경 시도 후 원본과 legacy DEFAULT_CONFIG가 불변이며 함수/문제 텍스트가 없다.
- [x] Red→Green·전체 npm test/build, 승인 대조와 변경 파일을 #505 코멘트/HANDOVER에 기록한다. 미검증 DONE 금지.
테스트: 승인 fixture 정상값, 8박 경계/미만, Seconds/Ms 혼용, 필수값 누락, NaN/Infinity와 readonly 변경 시도를 Red로 작성한다. 별도 승인 → npm test Baseline → 대상 테스트 Red 확인 → 별도 최소 데이터 작성 Green → 전체 npm test/npm run build. validator 구현을 이 config 카드에 추가하지 않는다.
관련 파일: DOC-14 §§5,6.4,6.7,14.
선행 카드: [01 #503](https://github.com/Choyounhwa/-dream-guardian/issues/503) MVP 수치 승인 증거, [02 #504](https://github.com/Choyounhwa/-dream-guardian/issues/504) 실제 계약 완료. 01 CLOSED 불필요; 미결 단계는 차단.
추적 및 중복 정책: [TRACK #502](https://github.com/Choyounhwa/-dream-guardian/issues/502). 기존 config 재정의·legacy/NEXT/SSOT 이동 금지.

### [BOSS-ASSAULT-04]
제목: MVP 교대 공격 정적 콘텐츠
상태: OPEN / 계획 / 구현·테스트 미착수, 개별 승인 대기.
책임 레이어: Content 데이터. config는 수치, 콘텐츠는 순서, runtime은 실행, effects는 표시만 담당한다.
목적: 무엇을 어떤 순서로 할지를 실행 코드 밖에 둔다.
수정 대상:
- `dream_guardian/src/data/assault/approachPatterns.ts` — 신규 제안.

파일 수: `src/` 및 `config/` 합계 1개.
테스트 파일(별도):
- `dream_guardian/tests/unit/assault-content.test.ts` — 신규 제안.
구현 내용:
1. 승인된 schemaVersion/패턴 ID/프로필 참조를 가진 초기 단일 패턴을 선언한다.
2. 0-based startBeat/durationBeats로 답→스쿼트 교대를 표현하고 입력창/복귀의 조정 수치는 config 참조로 남긴다.
3. 기본 공격 수는 01 승인값만 사용하고 3쌍 이상 시나리오는 테스트 fixture로 검증한다.
4. Question 레이어의 정답/텍스트를 복사하지 않으며 콘텐츠 교체가 로직 분기 추가를 요구하지 않게 한다.
데이터 입력→출력: 승인 공격 수/배치 → 불변 콘텐츠 목록.
유지 사항: 기존 CSV와 편집기 형식.
변경 금지: 실제 정답 복사·함수·조건문·피해 수치·런타임 상태.
완료 조건:
- [ ] 승인 공격 수·교대 순서·0-based 첫 슬롯이 일치하고 3쌍 fixture도 같은 구조로 표현된다(A11).
- [ ] 중복 ID/없는 프로필/잘못된 박자 fixture를 식별하고 원본 및 CSV/편집기 데이터가 불변이다.
- [ ] 정답/피해/실행 함수가 없으며 Red→Green·전체 npm test/build 및 실제 완료 기록을 #506 코멘트/HANDOVER에 남긴다.
테스트: 정상 단일 패턴, 3쌍 교대, 첫 startBeat=0, 중복 ID/참조 누락/음수 박자와 데이터 변경 시도를 Red로 검증한다. Baseline npm test → 테스트 선작성/대상 Red → 별도 데이터 Green → 전체 npm test/npm run build. 05 validator를 미리 구현하지 않는다.
관련 파일: DOC-14 §6.4~6.7.
선행 카드: [01 #503](https://github.com/Choyounhwa/-dream-guardian/issues/503) 공격 수 부분 승인 증거, [02 #504](https://github.com/Choyounhwa/-dream-guardian/issues/504), [03 #505](https://github.com/Choyounhwa/-dream-guardian/issues/505) 실제 완료. 개별 착수 승인 필수.
추적 및 중복 정책: [TRACK #502](https://github.com/Choyounhwa/-dream-guardian/issues/502). 기존 콘텐츠/legacy/NEXT/SSOT 불변, 새 편집기 지원은 후속 범위.

### [BOSS-ASSAULT-05]
제목: 공격 데이터 사전 유효성 검증
상태: OPEN / 계획 / 구현·테스트 미착수, 개별 승인 대기.
책임 레이어: Game 순수 검증. config/콘텐츠를 읽고 runtime/정산/effects는 실행하지 않는다.
목적: 잘못된 콘텐츠가 부분 세션을 시작하지 못하게 한다.
수정 대상:
- `dream_guardian/src/game/assault/AssaultPlanValidator.ts` — 신규 제안.

파일 수: `src/` 및 `config/` 합계 1개.
테스트 파일(별도):
- `dream_guardian/tests/unit/assault-validation.test.ts` — 신규 제안.
구현 내용:
1. unknown 입력에서 버전/kind/필수 필드와 프로필 참조를 확인하여 경로·원인 있는 오류를 반환한다.
2. 패턴/공격 ID 중복, 음수/NaN/Infinity, 순서 역전을 검사한다.
3. 입력창 시작≤끝≤도착 및 복귀가 슬롯 내에 있는지, 인접 활성창 중첩/필수 복귀 간격 부족을 검사한다.
4. 성공은 검증 데이터, 실패는 오류만 반환한다. 자동 이동/절삭·부분 계획·legacy 폴백 없이 원본을 보존한다.
데이터 입력→출력: unknown 콘텐츠+프로필 → 검증 데이터 또는 오류 목록; 부작용 없음.
유지 사항: 원본 데이터 불변.
변경 금지: 자동 보정·legacy 폴백·세션 시작·자원 변경·eval.
완료 조건:
- [ ] 정상 데이터만 통과하고 각 오류군의 경로/원인을 식별한다(A02, §6.5).
- [ ] 슬롯 끝과 같은 경계/조금 초과, 인접 창/중첩, 복귀 최소값/미만이 승인된 계약대로 판별된다.
- [ ] 실패 시 HP/세션/저장 호출 0회·입력 불변이며 Red→Green·전체 npm test/build 및 #507 코멘트/HANDOVER 증거를 기록한다.
테스트: 표 기반 Red로 unknown 버전/kind/profile, 중복 ID, 수치 오류, 창 역전/도착 초과, 중첩/복귀 부족을 각각 격리한다. 동결 입력 반복 검증은 같은 결과다. npm test Baseline → 대상 Red → 별도 최소 구현 Green → 전체 npm test/npm run build.
관련 파일: DOC-14 §6.5; 02~04 읽기 전용.
선행 카드: [02 #504](https://github.com/Choyounhwa/-dream-guardian/issues/504), [03 #505](https://github.com/Choyounhwa/-dream-guardian/issues/505), [04 #506](https://github.com/Choyounhwa/-dream-guardian/issues/506)의 실제 완료 증거와 본 카드 승인.
추적 및 중복 정책: [TRACK #502](https://github.com/Choyounhwa/-dream-guardian/issues/502). legacy validator 의미/SSOT/NEXT 불변, 데이터 오류를 자동 보정하지 않는다.

### [BOSS-ASSAULT-06]
제목: 불변 실행 시간표 순수 컴파일
상태: OPEN / 계획 / 구현·테스트 미착수, 개별 승인 대기.
책임 레이어: Game 순수 컴파일. config/콘텐츠 입력과 runtime 진행/effects 실행을 분리한다.
목적: 데이터 해석을 매 프레임 진행과 분리한다.
수정 대상:
- `dream_guardian/src/game/assault/AssaultPlanCompiler.ts` — 신규 제안.

파일 수: `src/` 및 `config/` 합계 1개.
테스트 파일(별도):
- `dream_guardian/tests/unit/assault-compiler.test.ts` — 신규 제안.
구현 내용:
1. 05의 검증 성공 데이터와 질문 참조·주입 시드만 받고 선택 BPM/프로필 버전을 계획에 고정한다.
2. 0-based 박자를 활성 seconds의 발사/창/도착/복귀 경계로 변환한다. 1-based Timeline 변환은 14에만 둔다.
3. 동일 시각 경계의 식별/논리 순서와 복귀 간격을 보존하여 프레임 순서에 의존하지 않는 계획을 만든다.
4. 원본과 분리된 readonly 계획을 반환하며 호출 후 전역 config 변화로 결과를 바꾸지 않는다.
데이터 입력→출력: 검증 패턴/질문 참조/시드 → readonly 실행 계획; 실행·HP 없음.
유지 사항: 0-based 콘텐츠와 기존 1-based 경계 명시.
변경 금지: Math.random/Date.now 내장·전역 config 재읽기·타이머.
완료 조건:
- [ ] 같은 입력/시드/버전은 동일 계획이며 첫 박자 0과 소수 박자의 seconds 변환이 기대값과 일치한다(A17).
- [ ] 반복 호출·호출 후 외부 config 변경에도 기존 계획과 원본은 불변이고 검증 실패 입력을 실행하지 않는다.
- [ ] 타이머/HP/effects 호출 0회, Red→Green·전체 npm test/build 및 #508 코멘트/HANDOVER 기록을 남긴다.
테스트: 고정 시드 반복, 다른 승인 BPM fixture, startBeat=0/소수, 같은 시각 경계, 복귀 간격과 동결 입력을 Red로 검증한다. npm test Baseline → 대상 Red → 별도 구현 Green → 전체 npm test/npm run build. 런타임 프레임 누락 처리는 15의 범위다.
관련 파일: DOC-14 §6.5~6.6.
선행 카드: [05 #507](https://github.com/Choyounhwa/-dream-guardian/issues/507)의 실제 완료 증거 및 본 카드 승인.
추적 및 중복 정책: [TRACK #502](https://github.com/Choyounhwa/-dream-guardian/issues/502). 기존 Timeline을 대체하지 않으며 legacy/SSOT/NEXT 불변.

### [BOSS-ASSAULT-07]
제목: 숫자형 반복 보기 쌍 공급 어댑터
상태: OPEN / 계획 / 구현·테스트 미착수, 개별 승인 대기.
책임 레이어: Question. config는 개수/정책, 콘텐츠는 공격 순서, 이 어댑터는 숫자 보기 생성만, runtime/HP/effects 실행 없음.
목적: 한 문제에 정답이 유일한 여러 보기 쌍을 공급한다.
수정 대상:
- `dream_guardian/src/question/AssaultAnswerPairFactory.ts` — 신규 제안.

파일 수: `src/` 및 `config/` 합계 1개.
테스트 파일(별도):
- `dream_guardian/tests/unit/assault-answer-pairs.test.ts` — 신규 제안.
구현 내용:
1. 기존 QuestionBank/QuestionEvaluator가 공급한 문제 하나의 숫자 정답과 승인 쌍 수·시드를 받는다.
2. 수치적으로 같은 오답을 제외하여 각 쌍에 유일 정답을 둔다. 문자열 표기 차이를 다른 값으로 오인하지 않는다.
3. 주입 시드로 좌우/오답 조합을 재현하되 정답 위치의 강제 좌우 교대나 pair별 문제 재생성을 하지 않는다.
4. 불변 pair 목록을 반환하고 지원 밖 수식/비유한 값·유효 오답 공급 실패는 명시적으로 거부한다.
데이터 입력→출력: 문제 한 개+시드+쌍 수 → 정답 하나인 pair 목록.
유지 사항: CSV 로딩/안전 평가 경로.
변경 금지: 수식형 보기 확장·문제 수 증가·HP·TTS 직접 요청.
완료 조건:
- [ ] 3쌍 이상에도 문제 공급 1회, 각 pair 정답 1개이며 같은 시드 결과가 같다(A11).
- [ ] 1/1.0 등 동치 오답, NaN/Infinity, 지원 밖 표현을 거부하고 원본 문제 불변이다.
- [ ] Red→Green·전체 npm test/build 및 #509 코멘트/HANDOVER에 실제 변경/완료 증거를 기록한다.
테스트: 유일성/동치/시드 반복/원본 동결/오답 공급 실패/좌우 편향을 검증한다. npm test Baseline → 대상 테스트 선작성 Red 확인 → 별도 최소 구현 Green → 전체 npm test/npm run build. CSV/평가기 수정 필요 시 별도 카드로 차단.
관련 파일: DOC-14 §7.2; QuestionBank/QuestionEvaluator 읽기 전용.
선행 카드: [02 #504](https://github.com/Choyounhwa/-dream-guardian/issues/504) 완료, [01 #503](https://github.com/Choyounhwa/-dream-guardian/issues/503) 숫자형 MVP 부분 승인 증거(01 CLOSED 불필요). 본 카드 승인 별도.
추적 및 중복 정책: [TRACK #502](https://github.com/Choyounhwa/-dream-guardian/issues/502). 안전 평가 재사용, legacy/SSOT/NEXT 불변.

### [BOSS-ASSAULT-08]
제목: 공통 활성 시각 및 안전 정지 어댑터
상태: OPEN / 계획 / 구현·테스트 미착수, 개별 승인 대기.
책임 레이어: Core 시간 어댑터. config 안전값을 소비하고 콘텐츠/판정/effects는 실행하지 않는다.
목적: 입력·읽기·공격에 하나의 일시정지 제외 시간축을 제공한다.
수정 대상:
- `dream_guardian/src/core/AssaultClockAdapter.ts` — 신규 제안.

파일 수: `src/` 및 `config/` 합계 1개.
테스트 파일(별도):
- `dream_guardian/tests/unit/assault-clock.test.ts` — 신규 제안.
구현 내용:
1. 기존 엔진/수집 시각의 기준점과 단위를 명시하여 입력을 하나의 활성 seconds 축으로 정규화한다.
2. pause/숨김/승인 임계값 초과 frame/추적 상실 동안 활성 시각을 동결하고 해당 입력을 폐기한다.
3. 복귀 시 정지 시간을 소급 가산하지 않으며 모션 재준비 신호를 출력한다.
4. 폴백 모드에서는 카메라 상실만으로 정지하지 않고 역행·중복 시각 입력을 계약대로 거부한다.
데이터 입력→출력: 엔진 시각+수집 시각+안전 상태 → 활성 seconds/정규화 입력/정지 사유.
유지 사항: 기존 GameEngine/EventBus, 새 루프 없음.
변경 금지: performance.now와 elapsed 직접 비교·시간 소급·DOM 리스너 직접 등록.
완료 조건:
- [ ] 같은 정상 경과는 같은 활성 시각, 정지/복귀는 남은 읽기 시간을 줄이지 않는다(A04,A19,A23).
- [ ] 임계값 직전/동일/초과와 연속 pause, 역행 시각, 재시작 입력에 가짜 시간/입력이 없다.
- [ ] 새 루프/DOM 등록 0회, Red→Green·전체 npm test/build 및 #510 코멘트/HANDOVER 증거를 기록한다.
테스트: 가짜 엔진 시각으로 숨김·긴 frame·추적 상실·폴백을 교차하고 동결/재준비/입력 폐기를 Red로 확인한다. npm test Baseline → 대상 Red → 별도 최소 구현 Green → 전체 npm test/npm run build. 실제 탭 복귀 증거는 23/25에서 통합한다.
관련 파일: DOC-14 §5.3; GameEngine/SessionLifecycle 읽기 전용.
선행 카드: [02 #504](https://github.com/Choyounhwa/-dream-guardian/issues/504), [03 #505](https://github.com/Choyounhwa/-dream-guardian/issues/505) 실제 완료 및 본 카드 승인.
추적 및 중복 정책: [TRACK #502](https://github.com/Choyounhwa/-dream-guardian/issues/502). GameEngine/EventBus 재사용, legacy/SSOT/NEXT 불변.

### [BOSS-ASSAULT-09]
제목: 회수 기반 반복 펀치 입력 어댑터
상태: OPEN / 계획 / 구현·테스트 미착수, 개별 승인 대기.
책임 레이어: Input. config 임계값으로 runtime 손 상태만 관리하며 콘텐츠 정답/HP/effects와 분리한다.
목적: 손을 유지한 상태의 반복 선택을 차단한다.
수정 대상:
- `dream_guardian/src/input/AssaultPunchAdapter.ts` — 신규 제안.

파일 수: `src/` 및 `config/` 합계 1개.
테스트 파일(별도):
- `dream_guardian/tests/unit/assault-punch.test.ts` — 신규 제안.
구현 내용:
1. 기존 미러링된 팔/커서 좌표와 08 활성 시각을 받아 좌우 준비 상태를 독립 관리한다.
2. 승인된 타격/회수 히스테리시스로 준비→타격 이벤트 1회→회수 대기를 처리한다.
3. pair 변경과 경계 떨림은 회수로 간주하지 않는다. 양손 이벤트를 둘 다 전달하여 12가 동시 충돌을 판단하게 한다.
4. 추적 복구/세션 reset에는 재준비를 요구하고 이전 inputId 재사용을 막는다.
데이터 입력→출력: 정규화 좌표+시각+입력 프로필 → 좌우 펀치 이벤트.
유지 사항: 기존 미러링/ArmReachAnswerSelector legacy 경로.
변경 금지: 정답·피해 판단·추적 복구 직후 발화·이중 반전.
완료 조건:
- [ ] 손 유지/pair 변경/임계값 떨림 동안 추가 이벤트 0회, 실제 회수 후 새 타격 1회다(A09).
- [ ] 양손 이벤트의 좌우/시각이 보존되고 추적 복구 직후 가짜 타격이 없다(A10,A19).
- [ ] 좌표 원본 불변·이중 반전 없음, Red→Green·전체 npm test/build 및 #511 코멘트/HANDOVER 기록.
테스트: 양손 독립 시퀀스, 타격/회수 값 직전·동일·직후, 추적 상실 중 손 이동, reset 후 과거 input을 Red로 검증한다. npm test Baseline → 대상 Red → 별도 구현 Green → 전체 npm test/npm run build. 인식률 실측은 25의 브라우저/실기기 증거로 분리한다.
관련 파일: DOC-14 §8.1; ArmReachAnswerSelector 읽기 전용.
선행 카드: [02 #504](https://github.com/Choyounhwa/-dream-guardian/issues/504), [03 #505](https://github.com/Choyounhwa/-dream-guardian/issues/505), [08 #510](https://github.com/Choyounhwa/-dream-guardian/issues/510) 실제 완료 및 본 카드 승인.
추적 및 중복 정책: [TRACK #502](https://github.com/Choyounhwa/-dream-guardian/issues/502). ArmReach legacy 경로 재사용, SSOT/NEXT 불변.

### [BOSS-ASSAULT-10]
제목: 보정 단위 일치 스쿼트 자세 어댑터
상태: OPEN / 계획 / 구현·테스트 미착수, 개별 승인 대기.
책임 레이어: Motion. config 가동범위와 pose 증거만 해석하고 콘텐츠 판정/runtime 공격/effects는 소유하지 않는다.
목적: 안전 자세와 직립 복귀를 게임 정오와 분리해 보고한다.
수정 대상:
- `dream_guardian/src/motion/AssaultSquatAdapter.ts` — 신규 제안.

파일 수: `src/` 및 `config/` 합계 1개.
테스트 파일(별도):
- `dream_guardian/tests/unit/assault-squat-motion.test.ts` — 신규 제안.
구현 내용:
1. CalibrationHelper/MotionIntentBus의 실제 좌표 단위와 기준점을 대조하고 승인 계약으로만 정규화한다.
2. 사용자 가동 범위에서 낮아짐/안전 자세 구간을 출력하되 공격 성공은 13에 맡긴다.
3. 직립 복귀 때만 generation을 갱신하고 계속 앉기/경계 떨림으로 새 복귀를 만들지 않는다.
4. 보정 누락/단위 불일치/추적 상실은 유효 자세로 내보내지 않고 복구 후 재준비한다.
데이터 입력→출력: 보정/현재 pose/시각 → 자세 구간과 복귀 generation.
유지 사항: 기존 모션 경로와 사용자 가동 범위.
변경 금지: HP·attack 성공 직접 확정·깊은 스쿼트 강제.
완료 조건:
- [ ] 동일 단위 정상 보정은 안전 자세/복귀를 출력하고 혼용·누락 보정은 거부한다.
- [ ] 앉기 유지·떨림·추적 복구에는 generation 증가 0회, 실제 직립 복귀에 1회다(A13,A19).
- [ ] 입력 pose 불변·HP 호출 0회, Red→Green·전체 npm test/build 및 #512 코멘트/HANDOVER 기록.
테스트: 정규화/픽셀 혼용, 사용자별 가동범위, 안전 임계값 경계, 장시간 앉기, 추적 상실/복귀를 Red로 검증한다. npm test Baseline → 대상 Red → 별도 구현 Green → 전체 npm test/npm run build. 실제 자세 안전성/피로는 25에서 별도 측정.
관련 파일: DOC-14 §8.2; MotionIntentBus/CalibrationHelper 읽기 전용.
선행 카드: [02 #504](https://github.com/Choyounhwa/-dream-guardian/issues/504), [03 #505](https://github.com/Choyounhwa/-dream-guardian/issues/505), [08 #510](https://github.com/Choyounhwa/-dream-guardian/issues/510) 실제 완료 및 본 카드 승인.
추적 및 중복 정책: [TRACK #502](https://github.com/Choyounhwa/-dream-guardian/issues/502). 기존 모션·legacy·SSOT/NEXT 불변.

### [BOSS-ASSAULT-11]
제목: 동작형 키보드·터치 폴백 어댑터
상태: OPEN / 계획 / 구현·테스트 미착수, 개별 승인 대기.
책임 레이어: Input. 전달된 edge의 runtime 상태만 관리하며 config/콘텐츠 정오/effects 실행과 분리한다.
목적: 카메라 없이 같은 입력 계약을 시험한다.
수정 대상:
- `dream_guardian/src/input/AssaultFallbackAdapter.ts` — 신규 제안.

파일 수: `src/` 및 `config/` 합계 1개.
테스트 파일(별도):
- `dream_guardian/tests/unit/assault-fallback.test.ts` — 신규 제안.
구현 내용:
1. core가 전달한 down/up/touch 시작·종료·취소를 동작 종류와 session/inputId로 정규화한다.
2. repeat와 유지 상태 재입력을 버리고 해제 뒤 새 edge만 다음 동작으로 허용한다.
3. 취소/pause/reset으로 남은 입력을 폐기하고 이전 세션 이벤트를 거부한다.
4. 좌우 펀치/스쿼트 등 해당 동작만 출력하며 정답 자동 선택이나 DOM 구독은 하지 않는다.
데이터 입력→출력: 폴백 edge+활성 시각 → typed 동작 이벤트.
유지 사항: 기존 KeyboardInput 및 legacy 터치.
변경 금지: 아무 키로 모든 판정 성공·정답 자동 선택·DOM 직접 등록.
완료 조건:
- [ ] down 유지/repeat/중복 touch는 1회만 발화, up 후 새 down은 새 ID를 갖는다(A18).
- [ ] touch cancel/pause/이전 세션 입력은 발화 0회이고 동작 종류가 다른 judge를 우회하지 않는다(A16).
- [ ] 원본 이벤트 불변, Red→Green·전체 npm test/build 및 #513 코멘트/HANDOVER 기록.
테스트: 키 유지→pair 변경, touch cancel→재터치, 종류 불일치, session reset, 정지 중 edge를 Red로 작성한다. npm test Baseline → 대상 Red → 별도 구현 Green → 전체 npm test/npm run build. 실제 브라우저 키/터치 전달은 23/25에서 검증.
관련 파일: DOC-14 §8.3.
선행 카드: [02 #504](https://github.com/Choyounhwa/-dream-guardian/issues/504), [08 #510](https://github.com/Choyounhwa/-dream-guardian/issues/510) 실제 완료 및 본 카드 승인.
추적 및 중복 정책: [TRACK #502](https://github.com/Choyounhwa/-dream-guardian/issues/502). KeyboardInput/legacy 터치 재사용, SSOT/NEXT 불변.

### [BOSS-ASSAULT-12]
제목: 답 쌍 순수 판정 reducer
상태: OPEN / 계획 / 구현·테스트 미착수, 개별 승인 대기.
책임 레이어: Game 순수 판정. config 창/허용차와 콘텐츠 계획을 소비하며 runtime 상태 반환만, HP/effects 직접 실행 없음.
목적: 하나의 논리 공격에서 선택·잠금·취소를 결정한다.
수정 대상:
- `dream_guardian/src/game/assault/AssaultPairJudge.ts` — 신규 제안.

파일 수: `src/` 및 `config/` 합계 1개.
테스트 파일(별도):
- `dream_guardian/tests/unit/assault-pair-judge.test.ts` — 신규 제안.
구현 내용:
1. pending에서 정답→correct/cancelled, 오답→wrong_locked, 미선택→timeout의 단일 잠금을 만든다.
2. 승인 동시 손 허용차 안의 충돌은 선택 보류하고 남은 창의 새 유효 동작만 재시도한다.
3. inputId를 한 공격에만 귀속하고 마감과 동일 시각은 입력 우선, 이후 시각은 만료 후 처리한다.
4. wrong/timeout 도착에만 피해량 없는 명령을 1회 출력하고 취소/잠금 뒤 추가 입력을 무시한다.
5. 수학 정오와 리듬 등급을 분리하여 늦지만 유효한 정답을 오답으로 바꾸지 않는다.
데이터 입력→출력: 계획+이전 상태+정규화 입력/경계 → 새 상태/정산 명령(피해량 없음).
유지 사항: 불변 정의, 시간순 입력 계약.
변경 금지: HP 직접 변경·오답 즉시 피해·두 탄환 독립 Miss.
완료 조건:
- [ ] 정답 쌍 도착 요청 0, 오답/timeout 도착 요청 1, 반대손 재타격은 잠금을 바꾸지 않는다(A05~A07).
- [ ] 마감 직전/동일/직후 및 동시 손 허용차 경계가 일치하고 새 동작만 재시도한다(A08,A10).
- [ ] 중복 input/도착·원본 계획 변경 없음, Red→Green·전체 npm test/build 및 #514 코멘트/HANDOVER 기록.
테스트: 상태×입력×경계 표를 Red로 작성하고 양손 충돌 후 회수/재타격, 다른 pair에 같은 inputId, 취소 후 지연 도착을 포함한다. npm test Baseline → 대상 Red → 별도 구현 Green → 전체 npm test/npm run build.
관련 파일: DOC-14 §§5.3,7.1.
선행 카드: [02 #504](https://github.com/Choyounhwa/-dream-guardian/issues/504), [06 #508](https://github.com/Choyounhwa/-dream-guardian/issues/508), [07 #509](https://github.com/Choyounhwa/-dream-guardian/issues/509) 실제 완료 및 본 카드 승인.
추적 및 중복 정책: [TRACK #502](https://github.com/Choyounhwa/-dream-guardian/issues/502). 두 시각 탄환을 독립 Miss로 만들지 않으며 legacy/SSOT/NEXT 불변.

### [BOSS-ASSAULT-13]
제목: 스쿼트 공격 순수 판정
상태: OPEN / 계획 / 구현·테스트 미착수, 개별 승인 대기.
책임 레이어: Game 판정. config 창/콘텐츠 계획을 읽고 runtime 결과만 반환; effects/HP 직접 실행 없음.
목적: 판정창 안전 자세와 복귀 증거를 공격별 결과로 변환한다.
수정 대상:
- `dream_guardian/src/game/assault/AssaultSquatJudge.ts` — 신규 제안.

파일 수: `src/` 및 `config/` 합계 1개.
테스트 파일(별도):
- `dream_guardian/tests/unit/assault-squat-judge.test.ts` — 신규 제안.
구현 내용:
1. 10의 안전 자세 구간과 복귀 generation을 계획의 판정창에 대조한다. 좌표 임계값을 다시 계산하지 않는다.
2. 사용한 복귀 증거를 다음 공격에 재사용하지 않고 공격별 결과를 한 번 확정한다.
3. 실패 도착에만 정산 명령을 출력하며 성공은 이전 답 공격 피해를 취소하지 않는다.
데이터 입력→출력: 공격 계획+자세 증거+시각 → 성공/실패/도착 명령.
유지 사항: 이전 답 공격의 결과와 피해.
변경 금지: 좌표 임계값 재계산·HP 적용·이전 오답 취소.
완료 조건:
- [ ] 창 안의 안전 자세는 성공, 창 밖/복귀 없는 연속 앉기는 자동 성공하지 않는다(A12,A13).
- [ ] 반복 도착/같은 generation에 결과·명령 중복이 없고 이전 오답 결과/계획 불변이다.
- [ ] Red→Green·전체 npm test/build 및 #515 코멘트/HANDOVER에 실제 변경·완료 증거를 기록한다.
테스트: 창 시작/끝 직전·동일·직후, 앉기 유지→다음 공격, 직립 복귀 후 재시도, 중복 도착을 Red로 작성한다. npm test Baseline → 대상 Red 확인 → 별도 최소 구현 Green → 전체 npm test/npm run build.
관련 파일: DOC-14 §§8.2,9.2; EvadeJudge 재사용 계약 읽기 전용.
선행 카드: [06 #508](https://github.com/Choyounhwa/-dream-guardian/issues/508), [10 #512](https://github.com/Choyounhwa/-dream-guardian/issues/512) 실제 완료 증거 및 본 카드 승인.
추적 및 중복 정책: [TRACK #502](https://github.com/Choyounhwa/-dream-guardian/issues/502). EvadeJudge 재사용 가능성만 대조하며 기존 의미/legacy/SSOT/NEXT 불변.

### [BOSS-ASSAULT-14]
제목: MotionNote 논리 공격 생명주기 어댑터
상태: OPEN / 계획 / 구현·테스트 미착수, 개별 승인 대기.
책임 레이어: Game 노트 어댑터. config/콘텐츠 불변, runtime 생명주기 연결과 effects용 읽기 전용 항목을 분리한다.
목적: 기존 Timeline을 재사용하고 중복 노트 엔진을 만들지 않는다.
수정 대상:
- `dream_guardian/src/game/assault/AssaultNoteAdapter.ts` — 신규 제안.
- `dream_guardian/src/game/assault/AssaultInteractionJudge.ts` — 신규 제안.
- `dream_guardian/src/game/MotionNoteTimeline.ts` — 기존 파일.

파일 수: `src/` 및 `config/` 합계 3개.
테스트 파일(별도):
- `dream_guardian/tests/unit/assault-note-adapter.test.ts` — 신규 제안.
구현 내용:
1. loadNotes가 reset을 수행하는 기존 계약을 보존하고 라운드 전체 계획을 한 번 적재한다.
2. 0→1-based 변환을 이 어댑터 한 곳에 두고 pair당 논리 노트 하나/시각 항목 두 개를 매핑한다.
3. 12/13 결과를 판정 포트에 전달하며 취소 쌍은 형제 Miss/두 번째 hit 없이 표현한다.
4. 필요한 Timeline additive 포트만 추가한다. 타입/다른 judge 수정이 필요하면 3파일을 넓히지 말고 별도 승인 요청한다.
데이터 입력→출력: 실행 계획+순수 판정 결과 → Timeline 생명주기/렌더 항목.
유지 사항: star/stomp/evade/jump 기존 판정 및 공용 투영 계약.
변경 금지: pair별 load/reset·기본 TapJudge 의미 변경·새 엔진/버스·자원 적용.
완료 조건:
- [ ] 3쌍 라운드 load/reset 1회, 첫 beat 변환 1회, 쌍당 논리 노트 1개다(A11).
- [ ] 정답 취소/timeout/중복 콜백에 형제 Miss나 자원 호출이 추가되지 않는다(A05,A07,A14).
- [ ] 기존 star/stomp/evade/jump 회귀 및 Red→Green·전체 npm test/build, #516 코멘트/HANDOVER 기록.
테스트: load/reset spy, pair 전환 시 기존 노트 잔존, beat0→1, 취소 뒤 지연 콜백, timeout 한 번, 기존 Timeline 테스트를 포함한다. npm test Baseline → 신규 대상 Red → 별도 최소 구현 Green → 전체 npm test/npm run build. 원본 계획/기존 판정 의미 불변을 대조한다.
관련 파일: DOC-14 §§2.1,6.5,11.1; motion-note.ts.
선행 카드: [02 #504](https://github.com/Choyounhwa/-dream-guardian/issues/504), [06 #508](https://github.com/Choyounhwa/-dream-guardian/issues/508), [12 #514](https://github.com/Choyounhwa/-dream-guardian/issues/514), [13 #515](https://github.com/Choyounhwa/-dream-guardian/issues/515) 실제 완료 및 본 카드 승인.
추적 및 중복 정책: [TRACK #502](https://github.com/Choyounhwa/-dream-guardian/issues/502). 공용 Timeline 재사용, 새 엔진/버스·legacy/SSOT/NEXT 변경 금지.

### [BOSS-ASSAULT-15]
제목: 투척·생각·교대 라운드 순수 진행
상태: OPEN / 계획 / 구현·테스트 미착수, 개별 승인 대기.
책임 레이어: Game runtime. config 시간과 콘텐츠 계획을 소비하며 TTS/effects는 요청·snapshot만 출력한다.
목적: 한 문제에서 반복 공격의 단일 생명주기를 소유한다.
수정 대상:
- `dream_guardian/src/game/assault/AssaultRoundController.ts` — 신규 제안.

파일 수: `src/` 및 `config/` 합계 1개.
테스트 파일(별도):
- `dream_guardian/tests/unit/assault-round.test.ts` — 신규 제안.
구현 내용:
1. 투척/readable/생각/교대/정산의 라운드 상태를 소유하고 readable부터 max(8박, 최소 초)를 계산한다.
2. 문제당 TTS 요청을 1회 출력하고 승인된 상태 관찰/상한 정책에 따라 실패·비활성·지연에서도 다음 박자에 진행한다. 존재하지 않는 완료 콜백을 가정하지 않는다.
3. 입력과 지나간 논리 경계를 시간순 병합하고 동일 시각에서만 입력 우선으로 처리한다.
4. 답/스쿼트 3쌍 이상에도 문제 참조를 유지하고 완료/중단 신호를 1회 출력한다.
5. pause/긴 정지 시간은 08 활성 시각에 따르며 draw 횟수나 legacy 2박 쉼표를 추가하지 않는다.
데이터 입력→출력: 계획+활성 시각+입력+TTS 상태 → 전이/정산 요청/읽기 전용 표시 상태.
유지 사항: 문제는 공격 중에도 유지, 기존 2박 쉼표는 신규에 중복 적용하지 않음.
변경 금지: draw 콜백 기반 타이머·DOM/TTS 직접 호출·setTimeout·HP/저장.
완료 조건:
- [ ] 투척 제외 최소 읽기 충족 전 공격 0회, TTS 실패/비활성/상한 초과에도 무한 대기 없음(A03,A20).
- [ ] 여러 경계 건너뜀은 시간순이며 늦은 입력이 과거 마감에 선행하지 않는다(A08,A17).
- [ ] pause/숨김 복귀에 읽기 소급 없음, 3쌍 완료/중단 신호 1회·계획 불변(A04,A11,A23).
- [ ] Red→Green·전체 npm test/build 및 #517 코멘트/HANDOVER 실제 증거를 기록한다.
테스트: readable 직전/8박 직전·동일/초 하한 우세, 다음 박자 정렬, TTS 끝나지 않음, 큰 frame, 입력=마감/마감 이후, 중복 update를 Red로 작성한다. npm test Baseline → 대상 Red → 별도 구현 Green → 전체 npm test/npm run build. 브라우저 TTS/읽기 관찰은 23/25에서 별도 검증한다.
관련 파일: DOC-14 §§4,5,13.1.
선행 카드: [06 #508](https://github.com/Choyounhwa/-dream-guardian/issues/508), [07 #509](https://github.com/Choyounhwa/-dream-guardian/issues/509), [08 #510](https://github.com/Choyounhwa/-dream-guardian/issues/510), [12 #514](https://github.com/Choyounhwa/-dream-guardian/issues/514), [13 #515](https://github.com/Choyounhwa/-dream-guardian/issues/515), [14 #516](https://github.com/Choyounhwa/-dream-guardian/issues/516) 실제 완료 및 본 카드 승인.
추적 및 중복 정책: [TRACK #502](https://github.com/Choyounhwa/-dream-guardian/issues/502). legacy 라운드와 배타 사용, SSOT/NEXT 불변.

### [BOSS-ASSAULT-16]
제목: 멱등 피해 정산 단일 경로
상태: OPEN / 계획 / 구현·테스트 미착수, 개별 승인 대기.
책임 레이어: Game 정산. config 피해량 해석만 소유; 콘텐츠/모션 판정/effects/보상 계산은 제외한다.
목적: 실제 HP 변경을 한 곳에서 한 번만 수행한다.
수정 대상:
- `dream_guardian/src/game/assault/AssaultSettlement.ts` — 신규 제안.

파일 수: `src/` 및 `config/` 합계 1개.
테스트 파일(별도):
- `dream_guardian/tests/unit/assault-settlement.test.ts` — 신규 제안.
구현 내용:
1. session/attack/effect 키와 현재 세션을 검증하여 중복·종료 세션 요청을 거부한다.
2. 피해량 없는 명령을 승인 balance profile로 해석하고 도착한 실패에만 적용한다.
3. BattleState.applyHazardDamage(amount), BossController.takeDamage의 현행 계약을 재사용하고 적용 전후 실제 차이를 receipt로 기록한다.
4. 정답 취소·지연 형제 콜백에 피해를 만들지 않고 요약 재전송으로 HP를 다시 변경하지 않는다.
데이터 입력→출력: 정산 명령+balance profile+기존 자원 객체 → 실제 피해 receipt.
유지 사항: 기존 HP 권위/통계/DEFAULT_CONFIG.
변경 금지: onWrong/onCorrect pair 호출·별도 HP 사본·MVP 마나/별가루 지급.
완료 조건:
- [ ] 정답 0회, 오답/미선택/스쿼트 실패 도착 각각 1회이며 오답 선택 순간 0회다(A05~A07,A12).
- [ ] 중복/이전 세션 요청 0회, HP보다 큰 피해는 실제 감소량만 receipt에 기록한다(A14,A16).
- [ ] 기존 correctCount/마나 불변·HP 사본 없음, Red→Green·전체 npm test/build 및 #518 코멘트/HANDOVER 기록.
테스트: 자원 spy로 선택/도착 구분, 중복 키/다른 effect, HP0 경계·초과 피해, stale session, 동결 명령/프로필을 Red로 검증한다. npm test Baseline → 대상 Red → 별도 구현 Green → 전체 npm test/npm run build.
관련 파일: DOC-14 §§6.6,9; BattleState/BossController 읽기 전용.
선행 카드: [02 #504](https://github.com/Choyounhwa/-dream-guardian/issues/504), [03 #505](https://github.com/Choyounhwa/-dream-guardian/issues/505), [12 #514](https://github.com/Choyounhwa/-dream-guardian/issues/514), [13 #515](https://github.com/Choyounhwa/-dream-guardian/issues/515) 실제 완료 및 본 카드 승인.
추적 및 중복 정책: [TRACK #502](https://github.com/Choyounhwa/-dream-guardian/issues/502). 기존 HP 권위 재사용, legacy/SSOT/NEXT 불변.

### [BOSS-ASSAULT-17]
제목: 불변 라운드 요약 집계
상태: OPEN / 계획 / 구현·테스트 미착수, 개별 승인 대기.
책임 레이어: Game 결과 집계. config/콘텐츠 불변, runtime 실측 결과만 집계하고 피해/effects를 재실행하지 않는다.
목적: 문제 수와 타격 수를 분리한다.
수정 대상:
- `dream_guardian/src/game/assault/AssaultRoundSummary.ts` — 신규 제안.

파일 수: `src/` 및 `config/` 합계 1개.
테스트 파일(별도):
- `dream_guardian/tests/unit/assault-summary.test.ts` — 신규 제안.
구현 내용:
1. 공격 결과/receipt를 식별자로 중복 제거하고 정오/미선택/회피/리듬·콤보를 개별 집계한다.
2. 실제 활성 시간·실제 피해량을 기록하며 wall time이나 요청 피해량으로 대체하지 않는다.
3. 모든 공격 종료는 completed 문제 +1, 사망/강제 종료는 aborted 문제 +0으로 고정한다.
4. 최종 readonly 요약을 한 번 생성하고 추가 결과로 이미 발행한 요약을 변형하지 않는다.
데이터 입력→출력: 공격 결과/receipt/활성 시간 → readonly summary.
유지 사항: legacy correctCount 의미.
변경 금지: 요약 피해 재적용·부분 라운드 완료 처리·임의 통계 상수.
완료 조건:
- [ ] 3쌍 정답2/오답1/회피성공2·실패1 fixture는 문제 완료 1, 실제 피해 합계와 일치한다(A11).
- [ ] 중간 사망은 문제 +0, 중복 결과/receipt/종료는 요약 중복·HP 호출을 만들지 않는다(A14,A15).
- [ ] 입력/발행 요약 불변, Red→Green·전체 npm test/build 및 #519 코멘트/HANDOVER 기록.
테스트: 3쌍 실측, 빈/부분 라운드 중단, 동일 ID 재전송, HP 제한 적용 receipt, pause 제외 시간과 발행 뒤 이벤트를 Red로 검증한다. npm test Baseline → 대상 Red → 별도 구현 Green → 전체 npm test/npm run build.
관련 파일: DOC-14 §§9.2~9.3,11.2.
선행 카드: [15 #517](https://github.com/Choyounhwa/-dream-guardian/issues/517), [16 #518](https://github.com/Choyounhwa/-dream-guardian/issues/518) 실제 완료 및 본 카드 승인.
추적 및 중복 정책: [TRACK #502](https://github.com/Choyounhwa/-dream-guardian/issues/502). legacy correctCount를 재정의하지 않으며 SSOT/NEXT 불변.

### [BOSS-ASSAULT-18]
제목: 접근 진행 및 종료 의도 판정
상태: OPEN / 계획 / 구현·테스트 미착수, 개별 승인 대기.
책임 레이어: Game 진행. config 목표/요약 입력으로 runtime 의도만 반환, 콘텐츠 생성/core 전환/effects 실행 없음.
목적: 완료 문제 기반 접근과 사망 우선 인계를 계산한다.
수정 대상:
- `dream_guardian/src/game/assault/AssaultProgressController.ts` — 신규 제안.

파일 수: `src/` 및 `config/` 합계 1개.
테스트 파일(별도):
- `dream_guardian/tests/unit/assault-progress.test.ts` — 신규 제안.
구현 내용:
1. 완료 요약만 중복 없이 세어 완료 라운드/승인 목표로 진행도를 계산한다.
2. 정답률과 무관하게 완료 시 전진하되 HP0은 진행/다음 문제/결전 의도보다 우선한다.
3. 마지막 생존 라운드는 HP·모드·규칙·통계 불변 인계 snapshot을 한 번 출력한다.
4. MVP에서는 인계만 생성하고 승리나 미구현 결전을 실행하지 않는다.
데이터 입력→출력: summary+HP 조회+목표 → 진행도/인계 스냅샷/종료 의도.
유지 사항: StageProgressController legacy 원칙/동작.
변경 금지: 직접 상태 머신 전환·마지막 다음 문제 생성·승리 위조.
완료 조건:
- [ ] 전부 오답이어도 생존 완료면 전진, aborted/중복 summary는 전진 0회다(A14).
- [ ] 목표 직전/도달 및 동시 HP0에서 사망 우선, 마지막 다음 문제 0회·인계 최대1회다(A15,A22).
- [ ] 원본 summary/HP 불변, Red→Green·전체 npm test/build 및 #520 코멘트/HANDOVER 기록.
테스트: 목표-1/목표, HP 양수/0, 완료/중단 교차와 동일 summary 재전송을 Red로 작성한다. 미승인/유효하지 않은 목표는 착수 계약 또는 입력 검증으로 차단한다. npm test Baseline → 대상 Red → 별도 구현 Green → 전체 npm test/npm run build.
관련 파일: DOC-14 §10.1.
선행 카드: [03 #505](https://github.com/Choyounhwa/-dream-guardian/issues/505), [17 #519](https://github.com/Choyounhwa/-dream-guardian/issues/519) 실제 완료 및 본 카드 승인.
추적 및 중복 정책: [TRACK #502](https://github.com/Choyounhwa/-dream-guardian/issues/502). StageProgressController 원칙만 재사용, legacy/SSOT/NEXT 불변.

### [BOSS-ASSAULT-19]
제목: 읽기 전용 공격 장면 렌더링
상태: OPEN / 계획 / 구현·테스트 미착수, 개별 승인 대기.
책임 레이어: Render. visual config와 콘텐츠에서 파생된 snapshot만 읽고 runtime/HP 판정은 하지 않는다. effects는 표시 상태만 소비한다.
목적: 문제 투척·쌍 탄환·접근·회피를 같은 스냅샷으로 표시한다.
수정 대상:
- `dream_guardian/src/render/AssaultSceneRenderer.ts` — 신규 제안.
- `dream_guardian/src/render/AssaultPairPainter.ts` — 신규 제안.

파일 수: `src/` 및 `config/` 합계 2개.
테스트 파일(별도):
- `dream_guardian/tests/unit/assault-render.test.ts` — 신규 제안.
구현 내용:
1. QuestionRenderer 및 MotionNoteRenderer/NoteProjection/NoteAnchorResolver의 실제 공개 계약을 대조하여 합성한다. 없는 렌더 API는 가정하지 않는다.
2. 양손 발사 위치와 공용 판정 앵커에 두 답 라벨/연결 표시를 그리되 논리 pair는 하나로 유지한다.
3. 투척/readable/공격 중 문제 고정, 정답 양쪽 취소, 오답 예고→도착 피격을 snapshot 그대로 표시한다.
4. 취소를 추가 hit/miss로 재생하지 않고 화면 크기 변화에서도 문제/다음 답을 효과가 가리지 않게 한다.
데이터 입력→출력: readonly snapshot+visual profile → Canvas 표시(상태 변경 없음).
유지 사항: 공용 투영과 기존 렌더러 경로.
변경 금지: 정답 추론·타이머 소유·HP/선택 확정·새 투영 엔진.
완료 조건:
- [ ] A03/A05/A06 상태별 draw와 공용 앵커가 일치하고 반복 render가 snapshot/판정/HP를 바꾸지 않는다.
- [ ] 실제 브라우저 데스크톱/작은 화면에서 두 라벨·문제·취소/피격 증거를 확보한다. Canvas spy만으로 픽셀 완료 판정 금지.
- [ ] Red→Green·전체 npm test/build 및 #521 코멘트/HANDOVER에 스크린샷·뷰포트·실제 변경/완료 증거를 기록한다.
테스트: 동결 snapshot, 같은 snapshot 반복 draw, 취소/오답 도착 경계, resize 앵커를 Red로 검증한다. npm test Baseline → 대상 Red → 별도 구현 Green → 전체 npm test/npm run build. 승인된 브라우저 harness로 시각 증거를 남기며 환경 부재는 차단 사유로 기록한다. 무관한 editor build/파일 추가 금지.
관련 파일: DOC-14 §11.1; 기존 공용 렌더 파일 읽기 전용.
선행 카드: [03 #505](https://github.com/Choyounhwa/-dream-guardian/issues/505), [14 #516](https://github.com/Choyounhwa/-dream-guardian/issues/516), [15 #517](https://github.com/Choyounhwa/-dream-guardian/issues/517), [18 #520](https://github.com/Choyounhwa/-dream-guardian/issues/520) 실제 완료 및 본 카드 승인.
추적 및 중복 정책: [TRACK #502](https://github.com/Choyounhwa/-dream-guardian/issues/502). 기존 투영 재사용, legacy/SSOT/NEXT 불변.

### [BOSS-ASSAULT-20]
제목: MVP 읽기 전용 HUD 및 진입 오류 표시
상태: OPEN / 계획 / 구현·테스트 미착수, 개별 승인 대기.
책임 레이어: UI 표시. config/콘텐츠/runtime 계산을 재구현하지 않으며 effects로 오류나 미지원 상태를 숨기지 않는다.
목적: 실제 연결된 HP·타격·접근·안전 상태만 표시한다.
수정 대상:
- `dream_guardian/src/ui/AssaultHUD.ts` — 신규 제안.

파일 수: `src/` 및 `config/` 합계 1개.
테스트 파일(별도):
- `dream_guardian/tests/unit/assault-hud.test.ts` — 신규 제안.
구현 내용:
1. 실제 snapshot의 HP/완료 문제/타격 수/진행도를 구분해 표시한다.
2. pause/추적 상실/재준비와 진입 검증 실패 사유를 구분하여 표시한다.
3. 미연결 마나/성장/별가루는 숨기고 값 누락을 임의 0이나 성공으로 채우지 않는다.
데이터 입력→출력: snapshot/진입 오류 → UI 표시.
유지 사항: 기존 HUD와 메뉴 기본 진입.
변경 금지: 집계/피해 계산·상수 통계·입력 확정.
완료 조건:
- [ ] 정상/HP0/중단/검증 오류/재준비 상태를 구별하고 문제1·타격3을 혼동하지 않는다(A02,A19).
- [ ] 동결 snapshot 반복 표시가 통계/입력을 변경하지 않으며 미지원 보상은 활성 표시되지 않는다.
- [ ] 실제 브라우저 작은 화면 오류/숫자 가독성, Red→Green·전체 npm test/build 및 #522 코멘트/HANDOVER 증거를 기록한다.
테스트: 정상/누락값/HP0/진입 실패/추적 복구 fixture를 Red로 작성한다. npm test Baseline → 대상 Red → 별도 구현 Green → 전체 npm test/npm run build. DOM/Canvas spy와 실제 스크린샷을 구분하며 브라우저 환경 부재는 차단, editor build는 요구하지 않는다.
관련 파일: DOC-14 §§6.5,9.4,11.2.
선행 카드: [05 #507](https://github.com/Choyounhwa/-dream-guardian/issues/507), [17 #519](https://github.com/Choyounhwa/-dream-guardian/issues/519), [18 #520](https://github.com/Choyounhwa/-dream-guardian/issues/520) 실제 완료 및 본 카드 승인.
추적 및 중복 정책: [TRACK #502](https://github.com/Choyounhwa/-dream-guardian/issues/502). 기존 HUD/legacy 메뉴/SSOT/NEXT 불변.

### [BOSS-ASSAULT-21]
제목: 모드 고정 및 상태 전환 계약 연결
상태: OPEN / 계획 / 구현·테스트 미착수, 개별 승인 대기.
책임 레이어: Core 계약. config/콘텐츠는 참조만 하고 runtime 전환 허용만 정의, game 판정/effects 실행 없음.
목적: 세션 모드와 신규 상태의 허용 전환만 추가한다.
수정 대상:
- `dream_guardian/src/core/types.ts` — 기존 파일.
- `dream_guardian/src/core/StateMachine.ts` — 기존 파일.
- `dream_guardian/src/core/GameSessionContext.ts` — 기존 파일.

파일 수: `src/` 및 `config/` 합계 3개.
테스트 파일(별도):
- `dream_guardian/tests/unit/assault-state-contract.test.ts` — 신규 제안.
구현 내용:
1. 01 승인 mode/state 이름만 additive하게 정의하고 옵션 없는 기본 모드는 legacy로 둔다.
2. 세션 시작에 모드를 고정하고 진행 중 모드 변경/혼합 상태 진입을 거부한다.
3. 18의 의도에 대응하는 라운드/정산/사망/인계 허용표를 추가하되 실제 controller 배선은 하지 않는다.
데이터 입력→출력: 세션 모드+전환 의도 → 허용/거부 상태.
유지 사항: legacy 전환표와 기본 mode.
변경 금지: 중간 모드 변경·controller 구현·renderer 수정.
완료 조건:
- [ ] legacy 기존 전환표/기본 mode가 동일하고 신규 허용 전환만 통과한다(A01,A02).
- [ ] 진행 중 mode 교체·잘못된 상태·이전 세션 전환은 거부하고 현재 세션은 보존한다(A16).
- [ ] Red→Green·전체 npm test/build 및 #523 코멘트/HANDOVER 실제 변경/완료 증거를 기록한다.
테스트: 모드×출발/도착 상태 표, 기본 옵션 생략, 같은 상태 재요청, 세션 종료 후 새 모드 시작을 Red로 작성한다. npm test Baseline → 대상 Red → 별도 구현 Green → 전체 npm test/npm run build. renderer/controller 수정은 범위 밖이다.
관련 파일: DOC-14 §§3,4.
선행 카드: [01 #503](https://github.com/Choyounhwa/-dream-guardian/issues/503) MVP 이름/전환 부분 승인 증거(전체 CLOSED 불필요), [02 #504](https://github.com/Choyounhwa/-dream-guardian/issues/504), [18 #520](https://github.com/Choyounhwa/-dream-guardian/issues/520) 실제 완료. 본 카드 승인 별도.
추적 및 중복 정책: [TRACK #502](https://github.com/Choyounhwa/-dream-guardian/issues/502). 기존 상태 머신 재사용, legacy/SSOT/NEXT 불변.

### [BOSS-ASSAULT-22]
제목: 내부 테스트 세션 조립과 배타 진입
상태: OPEN / 계획 / 구현·테스트 미착수, 개별 승인 대기.
책임 레이어: Core 조립. config/콘텐츠 검증 후 runtime 포트 주입만, game 계산/effects 재구현 없음.
목적: 검증된 신규 구성 요소만 명시적 테스트 세션으로 조립한다.
수정 대상:
- `dream_guardian/src/core/AppBootstrap.ts` — 기존 파일.
- `dream_guardian/src/core/AssaultSessionFactory.ts` — 신규 제안.

파일 수: `src/` 및 `config/` 합계 2개.
테스트 파일(별도):
- `dream_guardian/tests/unit/assault-bootstrap.test.ts` — 신규 제안.
구현 내용:
1. 명시적인 내부 테스트 옵션에서만 승인 config/콘텐츠를 검증하고 성공 후 05~20 포트를 조립한다.
2. 실패 시 자원/구독/부분 세션을 남기지 않고 오류를 반환한다. legacy로 몰래 이어 붙이지 않는다.
3. 신규 모드에서는 BeatRun/별/오답 회피/기존 피버·포격·보상 콜백을 연결하지 않는다.
4. 기존 HP 객체와 TTS 요청 포트를 주입한다. QuestionSpeech 완료/실패 공개 콜백은 없으므로 01의 상태 관찰 계약 미승인 시 차단한다.
5. 실제 프레임/입력/render 배선은 23에 남기고 기본 메뉴·저장은 바꾸지 않는다.
데이터 입력→출력: 명시적 테스트 옵션+승인 콘텐츠 → 격리 세션 또는 오류.
유지 사항: 일반 메뉴 legacy 및 단일 BattleState/BossController.
변경 금지: 기본 모드 변경·새 엔진/버스·game 로직 복사·저장 활성화.
완료 조건:
- [ ] 기본 진입은 legacy, 명시 옵션만 신규 조립이며 HP 객체는 기존 단일 권위다(A01).
- [ ] 검증 실패/재시도에 부분 세션·중복 구독·기존 피해/보상 호출 0회다(A02).
- [ ] TTS 실제 공개 API 대조와 포트 증거, Red→Green·전체 npm test/build 및 #524 코멘트/HANDOVER 기록.
테스트: 정상/invalid profile/중복 ID 진입, 반복 조립·실패 후 재시도, legacy 시작 spy와 신규 금지 콜백 spy를 Red로 작성한다. npm test Baseline → 대상 Red → 별도 구현 Green → 전체 npm test/npm run build. 아직 없는 23 화면을 완료 증거로 주장하지 않는다.
관련 파일: DOC-14 §§3,6.5,9.4.
선행 카드: [03 #505](https://github.com/Choyounhwa/-dream-guardian/issues/505), [04 #506](https://github.com/Choyounhwa/-dream-guardian/issues/506), [05 #507](https://github.com/Choyounhwa/-dream-guardian/issues/507), [06 #508](https://github.com/Choyounhwa/-dream-guardian/issues/508), [07 #509](https://github.com/Choyounhwa/-dream-guardian/issues/509), [08 #510](https://github.com/Choyounhwa/-dream-guardian/issues/510), [09 #511](https://github.com/Choyounhwa/-dream-guardian/issues/511), [10 #512](https://github.com/Choyounhwa/-dream-guardian/issues/512), [11 #513](https://github.com/Choyounhwa/-dream-guardian/issues/513), [12 #514](https://github.com/Choyounhwa/-dream-guardian/issues/514), [13 #515](https://github.com/Choyounhwa/-dream-guardian/issues/515), [14 #516](https://github.com/Choyounhwa/-dream-guardian/issues/516), [15 #517](https://github.com/Choyounhwa/-dream-guardian/issues/517), [16 #518](https://github.com/Choyounhwa/-dream-guardian/issues/518), [17 #519](https://github.com/Choyounhwa/-dream-guardian/issues/519), [18 #520](https://github.com/Choyounhwa/-dream-guardian/issues/520), [19 #521](https://github.com/Choyounhwa/-dream-guardian/issues/521), [20 #522](https://github.com/Choyounhwa/-dream-guardian/issues/522), [21 #523](https://github.com/Choyounhwa/-dream-guardian/issues/523) 실제 완료 및 본 카드 승인. G0 MVP 증거 필수, 후속 결전/보상 미결은 별도 차단.
추적 및 중복 정책: [TRACK #502](https://github.com/Choyounhwa/-dream-guardian/issues/502). 기존 엔진/버스/자원 재사용, legacy/SSOT/NEXT 불변.

### [BOSS-ASSAULT-23]
제목: 프레임·입력·표시 배타 라우팅
상태: OPEN / 계획 / 구현·테스트 미착수, 개별 승인 대기.
책임 레이어: Core 배선. config/콘텐츠 불변, runtime 호출을 배타 라우팅하며 판정/effects 로직은 복제하지 않는다.
목적: 한 프레임과 입력이 정확히 한 모드에만 전달되게 한다.
수정 대상:
- `dream_guardian/src/core/SceneDirector.ts` — 기존 파일.
- `dream_guardian/src/core/AppBootstrap.ts` — 기존 파일.

파일 수: `src/` 및 `config/` 합계 2개.
테스트 파일(별도):
- `dream_guardian/tests/unit/assault-scene-routing.test.ts` — 신규 제안.
구현 내용:
1. 공통 웹캠/키보드/터치 획득을 재사용하고 08~11에 엔진 시각·정지/추적 상태를 전달한다.
2. 세션 모드마다 update/input/render/HUD를 한 경로에만 전달한다. 화면만 숨기고 기존 controller를 실행하지 않는다.
3. 01 승인 TTS 상태 관찰 계약을 포트에 연결한다. status idle을 성공/실패로 임의 분류하거나 공개되지 않은 콜백을 호출하지 않는다.
4. pause/탭 숨김/긴 frame/복귀를 전달하고 원본 snapshot/미러링을 보존한다.
데이터 입력→출력: 엔진 프레임+공통 입력 → 단일 모드 update/render 호출.
유지 사항: legacy 입력·표시 및 미러링.
변경 금지: 새 requestAnimationFrame·입력 이중 전달·game 판정 구현.
완료 조건:
- [ ] 프레임/입력당 활성 모드만 1회, 비활성 모드 update/피해/보상 0회다(A01,A02,A18).
- [ ] pause/숨김/긴 정지·추적 복구·TTS 비활성/지연이 읽기 시간과 재준비 계약을 보존한다(A03,A04,A19,A20,A23).
- [ ] 실제 브라우저 웹캠/폴백·탭 복귀 증거와 Red→Green·전체 npm test/build, #525 코멘트/HANDOVER 기록.
테스트: 양 모드 spy, 동일 input 재전송, pause 중 키, hidden→visible 큰 delta, TTS 상태 관찰을 Red로 작성한다. npm test Baseline → 대상 Red → 별도 구현 Green → 전체 npm test/npm run build. 실제 브라우저 관찰은 테스트 spy와 구분하며 API/환경 부족은 별도 카드로 차단, editor build 불필요.
관련 파일: DOC-14 §§3,5.3.
선행 카드: [22 #524](https://github.com/Choyounhwa/-dream-guardian/issues/524) 실제 완료 및 본 카드 승인. TTS 계약 미결은 G0 승인 증거가 생기기 전 해제하지 않는다.
추적 및 중복 정책: [TRACK #502](https://github.com/Choyounhwa/-dream-guardian/issues/502). 새 루프/중복 입력 경로 금지, legacy/SSOT/NEXT 불변.

### [BOSS-ASSAULT-24]
제목: 세션 종료·재시작·인계 수명주기 연결
상태: OPEN / 계획 / 구현·테스트 미착수, 개별 승인 대기.
책임 레이어: Core 수명주기. config/콘텐츠 보존, runtime 정리만 수행하고 판정/보상/effects 정책은 소유하지 않는다.
목적: 종료 권위 한 곳과 이전 세션 이벤트 차단을 보장한다.
수정 대상:
- `dream_guardian/src/core/AppBootstrap.ts` — 기존 파일.
- `dream_guardian/src/core/SessionLifecycle.ts` — 기존 파일.

파일 수: `src/` 및 `config/` 합계 2개.
테스트 파일(별도):
- `dream_guardian/tests/unit/assault-lifecycle.test.ts` — 신규 제안.
구현 내용:
1. 18의 사망/인계 의도를 기존 SessionLifecycle 단일 종료 권위에 연결한다.
2. 종료·메뉴·재시작에서 세션 토큰, 구독, 입력 버퍼, 기존 예약을 정리하고 이전 이벤트를 무시한다.
3. MVP 마지막 인계 snapshot을 테스트 종료로 보관하며 RESULT 승리/저장·미구현 결전을 호출하지 않는다.
4. 기존 schedule의 setTimeout은 신규 공격 예약에 사용하지 않고 활성 시계 기반 계획을 유지한다.
데이터 입력→출력: 종료 의도+세션 토큰 → GAMEOVER/테스트 인계/정리.
유지 사항: 기존 결과 권위와 legacy 수명주기.
변경 금지: 새 종료 소유자·신규 공격 setTimeout·이전 세션 콜백 허용.
완료 조건:
- [ ] 중복 사망/종료·마지막 라운드 HP0에서 종료 1회, 다음 문제/결전/저장 0회다(A14,A15,A22).
- [ ] 재시작 뒤 이전 입력/TTS/예약은 무시되고 현재 세션/원본 계획은 보존된다(A16).
- [ ] 브라우저 메뉴→재시작 및 Red→Green·전체 npm test/build 증거를 #526 코멘트/HANDOVER에 기록한다.
테스트: 종료 두 번, 메뉴 후 늦은 콜백, 새 세션과 같은 attackId, 인계/사망 동시 경계를 Red로 검증한다. npm test Baseline → 대상 Red → 별도 구현 Green → 전체 npm test/npm run build. 브라우저 재시작 증거는 별도 확보하고 환경 부재는 미검증으로 남긴다.
관련 파일: DOC-14 §§3.2,4,10.1.
선행 카드: [18 #520](https://github.com/Choyounhwa/-dream-guardian/issues/520), [23 #525](https://github.com/Choyounhwa/-dream-guardian/issues/525) 실제 완료 및 본 카드 승인.
추적 및 중복 정책: [TRACK #502](https://github.com/Choyounhwa/-dream-guardian/issues/502). SessionLifecycle 재사용, legacy/SSOT/NEXT 불변.

### [BOSS-ASSAULT-25]
제목: MVP core loop 통합 게이트
상태: OPEN / 계획 / QA 미착수, 개별 승인 대기. 게이트 통과를 주장하지 않는다.
책임 레이어: QA. config/콘텐츠/runtime/effects를 관찰만 하며 제품 수정은 하지 않는다.
목적: 결전·보상 전에 최소 접근전을 인수한다.
수정 대상:
- 제품 소스 수정 없음. 아래 테스트 파일만 허용한다.

파일 수: `src/` 및 `config/` 합계 0개.
테스트 파일(별도):
- `dream_guardian/tests/integration/assault-mvp.test.ts` — 신규 제안.
구현 내용:
1. 실제 21~24 배선으로 DOC-14 §13.1의 3쌍 교대 시나리오를 실행하고 타격/회피/피해/문제 수를 확인한다.
2. pause/프레임 누락/재시작/마지막 사망 및 legacy 변형에서 금지 콜백 호출 수를 기록한다.
3. A01~A20/A23을 자동 증거와 데스크톱·모바일 읽기/인식/피로 관찰에 매핑한다.
4. 실패는 재현·원인·수정 계획을 갖춘 별도 버그 카드 승인 대상으로 남긴다. 제품을 고치거나 G4 착수를 자동 승인하지 않는다.
데이터 입력→출력: 실제 구성/가짜 시계·입력 → 회귀 결과와 데스크톱/모바일 관찰 증거.
유지 사항: 제품 코드와 기본 모드.
변경 금지: 실패를 고치려고 제품 수정·보상/저장·결전 구현 시작 승인 간주.
완료 조건:
- [ ] 대표 시나리오 정답2/오답1·회피성공2/실패1·피해2회·완료 문제1이 승인 피해값/실제 receipt와 일치한다.
- [ ] A01~A20/A23의 성공/실패/경계/중복/불변 증거가 있고 미구현 결전 인계에서 승리·저장 0회다.
- [ ] 브라우저/기기·뷰포트·입력 방식·관찰 시간·읽기/인식 실패/피로를 기록했다. 미측정/실패는 게이트 미통과다.
- [ ] 전체 npm test/build 실제 결과와 미해결 목록을 #527 코멘트/HANDOVER에 기록하고 별도 G3 인수 승인을 받았다.
테스트: QA 예외. npm test Baseline → 통합 characterization 작성/대상 실행 → 전체 npm test/npm run build → 실제 브라우저·실기기 §13.2 증거. 기존 정상 동작에 가짜 Red/제품 Green을 만들지 않는다. 실패 시 별도 버그 승인 후 그 카드에서 Red→Green, 이 카드는 재검증만 한다. editor build 불필요, 현재 모두 미실행.
관련 파일: DOC-14 §13 전체; DOC-15 게이트.
선행 카드: [24 #526](https://github.com/Choyounhwa/-dream-guardian/issues/526) 및 [01 #503](https://github.com/Choyounhwa/-dream-guardian/issues/503), [02 #504](https://github.com/Choyounhwa/-dream-guardian/issues/504), [03 #505](https://github.com/Choyounhwa/-dream-guardian/issues/505), [04 #506](https://github.com/Choyounhwa/-dream-guardian/issues/506), [05 #507](https://github.com/Choyounhwa/-dream-guardian/issues/507), [06 #508](https://github.com/Choyounhwa/-dream-guardian/issues/508), [07 #509](https://github.com/Choyounhwa/-dream-guardian/issues/509), [08 #510](https://github.com/Choyounhwa/-dream-guardian/issues/510), [09 #511](https://github.com/Choyounhwa/-dream-guardian/issues/511), [10 #512](https://github.com/Choyounhwa/-dream-guardian/issues/512), [11 #513](https://github.com/Choyounhwa/-dream-guardian/issues/513), [12 #514](https://github.com/Choyounhwa/-dream-guardian/issues/514), [13 #515](https://github.com/Choyounhwa/-dream-guardian/issues/515), [14 #516](https://github.com/Choyounhwa/-dream-guardian/issues/516), [15 #517](https://github.com/Choyounhwa/-dream-guardian/issues/517), [16 #518](https://github.com/Choyounhwa/-dream-guardian/issues/518), [17 #519](https://github.com/Choyounhwa/-dream-guardian/issues/519), [18 #520](https://github.com/Choyounhwa/-dream-guardian/issues/520), [19 #521](https://github.com/Choyounhwa/-dream-guardian/issues/521), [20 #522](https://github.com/Choyounhwa/-dream-guardian/issues/522), [21 #523](https://github.com/Choyounhwa/-dream-guardian/issues/523), [22 #524](https://github.com/Choyounhwa/-dream-guardian/issues/524), [23 #525](https://github.com/Choyounhwa/-dream-guardian/issues/525). 02~24 실제 완료 증거와 QA 승인 필수. 01은 MVP 부분 승인 증거로 충분하며 전체 CLOSED를 요구하지 않는다. 후속 결전/보상 결정은 계속 차단.
추적 및 중복 정책: [TRACK #502](https://github.com/Choyounhwa/-dream-guardian/issues/502). legacy/SSOT/NEXT 불변, 실패를 기존 완료 카드 재완료로 숨기지 않는다.

### [BOSS-ASSAULT-26]
제목: 근접 결전 조정 프로필 데이터
상태: OPEN / 계획 / G3 인수·결전 수치 별도 승인 전 착수 차단.
책임 레이어: Config 데이터. 콘텐츠 순서/runtime/effects 실행 없이 결전 조정값만 소유한다.
목적: 결전 체력·피해·길이·복귀/저충격 수치를 코드와 분리한다.
수정 대상:
- `dream_guardian/config/assault-finale.config.ts` — 신규 제안.

파일 수: `src/` 및 `config/` 합계 1개.
테스트 파일(별도):
- `dream_guardian/tests/unit/assault-finale-config.test.ts` — 신규 제안.
구현 내용:
1. 25 인수와 01 결전 승인 증거를 확인하여 HP/피해/길이/실패 제한을 같은 버전으로 선언한다.
2. 예고/입력/복귀·저충격 수치를 단위 있는 readonly 데이터로 분리한다.
3. 37의 HP 주입 계약과 맞는 참조를 제공하되 constructor 호출이나 피버 의미 결정은 하지 않는다.
데이터 입력→출력: 승인 결전 결정표 → readonly finale profile.
유지 사항: 접근전 및 legacy balance.
변경 금지: 후보 확정·실행 순서·함수·기존 피버 의미 변경.
완료 조건:
- [ ] 모든 값의 별도 승인 URL/단위가 있고 HP/길이 미결은 데이터 작성 착수를 막는다(A22).
- [ ] 정상값/0·음수·비유한 값/복귀 부족 fixture와 프로필 불변을 검증하고 접근전/legacy 값은 동일하다.
- [ ] Red→Green·전체 npm test/build 및 #528 코멘트/HANDOVER 실제 증거를 기록한다.
테스트: 승인 데이터 대조·필수값 누락·HP/시간/실패 수 경계·중첩 변경을 Red로 작성한다. npm test Baseline → 대상 Red → 별도 데이터 Green → 전체 npm test/npm run build. runtime validator를 이 파일에 넣지 않는다.
관련 파일: DOC-14 §§10.2,14.
선행 카드: [25 #527](https://github.com/Choyounhwa/-dream-guardian/issues/527) G3 인수 승인, [01 #503](https://github.com/Choyounhwa/-dream-guardian/issues/503) 결전 수치 별도 승인 증거. MVP 승인만으로 해제 불가, 본 카드 승인 별도.
추적 및 중복 정책: [TRACK #502](https://github.com/Choyounhwa/-dream-guardian/issues/502). legacy/SSOT/NEXT 불변, 기존 battle 숫자 복사로 승인 대체 금지.

### [BOSS-ASSAULT-27]
제목: 근접 결전 선언형 패턴 콘텐츠
상태: OPEN / 계획 / G4 계약·개별 승인 대기, 구현·테스트 미착수.
책임 레이어: Content 데이터. config 수치는 참조만, runtime 분기/effects 실행 없음.
목적: 약점 펀치·회피·점프·빈틈 순서를 데이터화한다.
수정 대상:
- `dream_guardian/src/data/assault/finalePatterns.ts` — 신규 제안.

파일 수: `src/` 및 `config/` 합계 1개.
테스트 파일(별도):
- `dream_guardian/tests/unit/assault-finale-content.test.ts` — 신규 제안.
구현 내용:
1. 승인된 kind로 약점 펀치/스쿼트 회피/점프·대체/빈틈 순서를 단일 정적 패턴에 둔다.
2. 예고/입력/복귀와 0-based 박자·프로필 참조를 명시하고 05/06으로 검증·컴파일한다.
3. 미지원 kind/새 판정 의미가 필요하면 타입·validator를 이 카드에서 고치지 않고 계약 재승인/별도 카드를 요구한다.
데이터 입력→출력: 결전 순서 결정 → 버전 있는 정적 콘텐츠.
유지 사항: 접근전 콘텐츠와 편집기 데이터.
변경 금지: 조건 함수·피해/HP 내장·전 챕터 패턴 확장.
완료 조건:
- [ ] 승인 순서가 05/06을 통과하고 창 중첩·복귀 부족·중복 ID가 없다(A22, §6.5).
- [ ] 미지원 kind/참조/박자 오류 fixture는 거부되며 정답·HP·조건 함수가 없고 원본/접근전 콘텐츠 불변이다.
- [ ] Red→Green·전체 npm test/build 및 #529 코멘트/HANDOVER 실제 증거를 기록한다.
테스트: 정상 전체 패턴, 0-based 시작, 인접 창 경계, unknown kind/profile, 중복 ID/중첩/복귀 부족을 Red로 작성한다. npm test Baseline → 대상 Red → 별도 데이터 Green → 전체 npm test/npm run build. 05/06 확장 필요 시 이 카드 차단.
관련 파일: DOC-14 §§6.5,10.2.
선행 카드: [26 #528](https://github.com/Choyounhwa/-dream-guardian/issues/528), [05 #507](https://github.com/Choyounhwa/-dream-guardian/issues/507), [06 #508](https://github.com/Choyounhwa/-dream-guardian/issues/508), [02 #504](https://github.com/Choyounhwa/-dream-guardian/issues/504) 결전 kind 계약 실제 완료. G3/G4 승인 및 본 카드 승인 필요.
추적 및 중복 정책: [TRACK #502](https://github.com/Choyounhwa/-dream-guardian/issues/502). 기존 피버 콘텐츠 자동 변환/legacy/SSOT/NEXT 변경 금지.

### [BOSS-ASSAULT-28]
제목: 점프·저충격 대체 동작 어댑터
상태: OPEN / 계획 / G4 계약·개별 승인 대기, 구현·테스트 미착수.
책임 레이어: Motion. config 접근성/복귀값을 소비하며 runtime 이벤트만 생성, 콘텐츠 판정/HP/effects 없음.
목적: 실제 점프 중 펀치를 요구하지 않는 결전 입력을 제공한다.
수정 대상:
- `dream_guardian/src/motion/AssaultJumpAdapter.ts` — 신규 제안.

파일 수: `src/` 및 `config/` 합계 1개.
테스트 파일(별도):
- `dream_guardian/tests/unit/assault-jump.test.ts` — 신규 제안.
구현 내용:
1. JumpDetector 실제 출력과 승인 저충격 증거를 동일 동작 계약으로 정규화한다.
2. session/inputId·활성 시각·입력/접근성 프로필을 보존하여 실제 점프와 대체 기록을 구별한다.
3. 준비/복귀 없이 유지·추적 복구로 반복 이벤트를 만들지 않고 점프 중 추가 펀치를 요구하지 않는다.
데이터 입력→출력: 모션 증거+활성 시각+프로필 → 점프/대체 이벤트.
유지 사항: 기존 JumpDetector/JumpJudge 의미.
변경 금지: 판정창·피해·저충격 기록을 실제 점프와 몰래 혼합.
완료 조건:
- [ ] 실제/저충격 각각 준비→동작→복귀에 1회만 발화하고 프로필 식별을 유지한다(A18).
- [ ] 추적 상실/복구·유지·이전 세션 입력은 가짜 점프를 만들지 않는다(A19).
- [ ] 원본 모션 증거 불변, Red→Green·전체 npm test/build 및 #530 코멘트/HANDOVER 기록. 실기기 안전성은 36에서 검증.
테스트: 점프/대체 정상, 복귀 임계값 전후, 유지/추적 복구·중복 ID·session reset을 Red로 작성한다. npm test Baseline → 대상 Red → 별도 구현 Green → 전체 npm test/npm run build. JumpDetector/JumpJudge 내부 수정 필요 시 별도 카드.
관련 파일: DOC-14 §§8.3,10.2; JumpDetector 읽기 전용.
선행 카드: [26 #528](https://github.com/Choyounhwa/-dream-guardian/issues/528), [08 #510](https://github.com/Choyounhwa/-dream-guardian/issues/510), [02 #504](https://github.com/Choyounhwa/-dream-guardian/issues/504) 실제 완료, G3/G4 및 본 카드 승인.
추적 및 중복 정책: [TRACK #502](https://github.com/Choyounhwa/-dream-guardian/issues/502). 기존 detector 의미/legacy/SSOT/NEXT 불변.

### [BOSS-ASSAULT-29]
제목: 근접 패턴 순수 진행 및 정산 요청
상태: OPEN / 계획 / G4 계약·개별 승인 대기, 구현·테스트 미착수.
책임 레이어: Game runtime. config/콘텐츠 계획 소비, 정산/effects는 명령·snapshot으로 분리한다.
목적: 기존 노트 기반으로 결전 패턴만 진행한다.
수정 대상:
- `dream_guardian/src/game/assault/AssaultFinaleController.ts` — 신규 제안.
- `dream_guardian/src/game/assault/AssaultNoteAdapter.ts` — 14번 카드에서 생성 예정인 신규 제안.
- `dream_guardian/src/game/assault/AssaultInteractionJudge.ts` — 14번 카드에서 생성 예정인 신규 제안.

파일 수: `src/` 및 `config/` 합계 3개.
테스트 파일(별도):
- `dream_guardian/tests/unit/assault-finale.test.ts` — 신규 제안.
구현 내용:
1. 검증된 결전 계획과 인계 snapshot을 받아 기존 Timeline/JumpJudge/EvadeJudge 계약의 어댑터로 진행한다.
2. 승인 kind의 예고/창/복귀를 시간순 처리하고 동작 종류가 다른 입력은 거부한다.
3. 피해는 16에만 요청하고 결과 receipt/HP 조회로 다음 의도를 결정한다.
4. 같은 처리 시점 양측 HP0이면 플레이어 사망 우선, 종료/정산 요청은 중복 차단한다.
데이터 입력→출력: 인계 snapshot+계획+동작 → 결전 snapshot/정산·종료 의도.
유지 사항: 단일 HP 및 공용 노트 인프라.
변경 금지: 자동 미니언 포격·직접 HP·새 Timeline·pattern 하드코딩.
완료 조건:
- [ ] 펀치/회피/점프·대체/빈틈의 성공·실패·창 경계와 승인 순서가 일치한다.
- [ ] 중복 입력/도착은 피해 재요청 없음, 동시 HP0은 사망 의도 1회다(A14,A22).
- [ ] 계획/인계 snapshot 불변, Red→Green·전체 npm test/build 및 #531 코멘트/HANDOVER 기록. 3파일 밖 변경 필요 시 차단.
테스트: 동작별 창 전·끝·후, 다른 동작 입력, pause/여러 경계 건너뜀, 중복 receipt, 양측 HP0을 Red로 검증한다. npm test Baseline → 대상 Red → 별도 구현 Green → 전체 npm test/npm run build. 패턴을 코드에 하드코딩하지 않는다.
관련 파일: DOC-14 §10.2.
선행 카드: [27 #529](https://github.com/Choyounhwa/-dream-guardian/issues/529), [28 #530](https://github.com/Choyounhwa/-dream-guardian/issues/530), [14 #516](https://github.com/Choyounhwa/-dream-guardian/issues/516), [16 #518](https://github.com/Choyounhwa/-dream-guardian/issues/518), [18 #520](https://github.com/Choyounhwa/-dream-guardian/issues/520) 실제 완료, G3/G4 및 본 카드 승인.
추적 및 중복 정책: [TRACK #502](https://github.com/Choyounhwa/-dream-guardian/issues/502). 공용 노트/HP 재사용, legacy/SSOT/NEXT 불변.

### [BOSS-ASSAULT-30]
제목: 근접 결전 인계 및 실행 배선
상태: OPEN / 계획 / G4 계약·개별 승인 대기, 구현·테스트 미착수.
책임 레이어: Core 배선. config 주입/콘텐츠 포트 연결만, runtime 판정/effects 재구현 없음.
목적: MVP 인계 지점에 신규 결전만 배타 연결한다.
수정 대상:
- `dream_guardian/src/core/AppBootstrap.ts` — 기존 파일.
- `dream_guardian/src/core/SceneDirector.ts` — 기존 파일.
- `dream_guardian/src/core/AssaultSessionFactory.ts` — 22번 카드에서 생성 예정인 신규 제안.

파일 수: `src/` 및 `config/` 합계 3개.
테스트 파일(별도):
- `dream_guardian/tests/unit/assault-finale-wiring.test.ts` — 신규 제안.
- `dream_guardian/tests/integration/assault-finale.test.ts` — 신규 제안.
구현 내용:
1. 마지막 접근 인계의 플레이어 HP/모드/규칙/집계를 보존하여 결전 시작을 한 번 연결한다.
2. 승인 결전 HP를 37의 명시 초기화 포트에 주입한다. private HP 우회나 두 번째 소유자는 금지한다.
3. 28 입력/29 진행/기존 snapshot 표시를 연결하고 기존 피버·자동 공격·포격을 배제한다.
4. 결전 종료는 SessionLifecycle로 모으고 동시 사망을 우선한다. 저장/결과 확장은 35에 남긴다.
데이터 입력→출력: 마지막 접근 인계 → 결전 시작 1회/종료 요청.
유지 사항: SessionLifecycle 단일 종료 권위.
변경 금지: 기존 피버/보스 자동 공격 활성화·render/game 파일 수정·저장 연결.
완료 조건:
- [ ] 생존 인계 시작 1회·추가 문제0회, HP/규칙/통계 보존 및 기존 자동 공격0회다(A02,A15).
- [ ] 실제 배선에서 중복 인계/동시 HP0/이전 세션 이벤트가 종료 중복을 만들지 않는다(A22).
- [ ] 브라우저 결전 진입/사망 증거, Red→Green·전체 npm test/build 및 #532 코멘트/HANDOVER 기록. 표시 부족은 별도 render 카드로 차단.
테스트: unit 포트 spy와 실제 integration을 Red로 작성하여 마지막 생존/사망, 중복 인계, 옵션 HP, 점프 대체 입력을 확인한다. npm test Baseline → 대상 Red → 별도 배선 Green → 전체 npm test/npm run build. 브라우저 증거 없으면 표시 인수 미검증, editor build 불필요.
관련 파일: DOC-14 §§3.2,10.2.
선행 카드: [29 #531](https://github.com/Choyounhwa/-dream-guardian/issues/531), [24 #526](https://github.com/Choyounhwa/-dream-guardian/issues/526), [37 #539](https://github.com/Choyounhwa/-dream-guardian/issues/539) 실제 완료, [01 #503](https://github.com/Choyounhwa/-dream-guardian/issues/503) HP 주입 별도 승인 증거. MVP 부분 승인만으로 G4 해제 불가.
추적 및 중복 정책: [TRACK #502](https://github.com/Choyounhwa/-dream-guardian/issues/502). 종료/HP 권위 재사용, legacy/SSOT/NEXT 불변.

### [BOSS-ASSAULT-31]
제목: 별도 승인된 보상 정책 데이터
상태: OPEN / 계획 / G5 보상 별도 승인 전 착수 차단, 구현·테스트 미착수.
책임 레이어: Config 데이터. 콘텐츠 타격 수와 runtime 지급/effects 실행을 분리한다.
목적: 마나/별가루 정책을 타격 판정과 분리한다.
수정 대상:
- `dream_guardian/config/assault-reward.config.ts` — 신규 제안.

파일 수: `src/` 및 `config/` 합계 1개.
테스트 파일(별도):
- `dream_guardian/tests/unit/assault-reward-config.test.ts` — 신규 제안.
구현 내용:
1. 01에서 문제당 상한/정답 비율/반올림과 스펠·미니언·성장·별가루의 유지/미사용을 별도 승인받는다.
2. 승인 정책만 버전 있는 readonly 데이터로 선언하고 미사용을 누락/0 추정이 아닌 명시 상태로 둔다.
3. legacy +25 등 기존 값을 pair 보상으로 복사하지 않으며 새 성장/효과 실행 함수는 넣지 않는다.
데이터 입력→출력: 보상 결정표 → 버전 있는 readonly 정책.
유지 사항: legacy 보상 및 MVP 무보상.
변경 금지: 미확정 임의 수치·pair마다 +25·새 성장 기능.
완료 조건:
- [ ] 정책별 승인 URL/단위/상한/반올림이 추적되고 미결 정책은 착수 차단이다(A14,A21).
- [ ] 정상/미사용/필수값 누락·상한 음수/비유한 fixture와 불변 검증을 통과한다.
- [ ] MVP 무보상·legacy 보상 불변, Red→Green·전체 npm test/build 및 #533 코멘트/HANDOVER 기록.
테스트: 승인표 일치·미사용 명시·반올림 방식 누락·잘못된 상한·중첩 정책 변경을 Red로 작성한다. npm test Baseline → 대상 Red → 별도 데이터 Green → 전체 npm test/npm run build. 계산 로직은 32에만 둔다.
관련 파일: DOC-14 §§9.4,14.
선행 카드: [30 #532](https://github.com/Choyounhwa/-dream-guardian/issues/532) 실제 완료, [01 #503](https://github.com/Choyounhwa/-dream-guardian/issues/503) 보상 별도 승인 증거. G3/G4 완료나 MVP 승인으로 G5 수치를 승인하지 않는다.
추적 및 중복 정책: [TRACK #502](https://github.com/Choyounhwa/-dream-guardian/issues/502). legacy/SSOT/NEXT 불변, 기존 보상 카드를 재완료하지 않는다.

### [BOSS-ASSAULT-32]
제목: 라운드 보상 순수 계산 및 멱등 지급 요청
상태: OPEN / 계획 / G5 계약·개별 승인 대기, 구현·테스트 미착수.
책임 레이어: Game 보상 정책. config 계산을 runtime 명령으로 반환하며 콘텐츠/저장/effects 실행은 제외한다.
목적: 타격 수 증가로 보상이 중복 증폭되지 않게 한다.
수정 대상:
- `dream_guardian/src/game/assault/AssaultRewardPolicy.ts` — 신규 제안.

파일 수: `src/` 및 `config/` 합계 1개.
테스트 파일(별도):
- `dream_guardian/tests/unit/assault-rewards.test.ts` — 신규 제안.
구현 내용:
1. completed summary와 승인 reward profile로 비율/문제당 상한/반올림을 계산한다.
2. 세션 범위를 포함한 round/effect 키로 명령 재요청을 막는다. 순수 계산과 중복 상태 입력/결과를 구분한다.
3. aborted/무보상 정책/초기 테스트 세션은 지급 명령을 만들지 않으며 타격 수로 상한을 늘리지 않는다.
4. 실제 자원/저장은 호출하지 않고 readonly 명령/중복 무시 결과를 반환한다.
데이터 입력→출력: summary+reward profile → 보상 명령/중복 무시 결과.
유지 사항: 피해 receipt와 문제 완료 수.
변경 금지: localStorage·가짜 별 판정·성장 시스템 재구현·MVP 지급.
완료 조건:
- [ ] 정답0/일부/전부와 상한 직전·동일·초과, 승인 반올림 경계가 일치한다(A14,A21).
- [ ] 같은 round/effect 재전송·aborted·무보상은 추가 지급0, 다른 세션은 키가 혼동되지 않는다.
- [ ] summary/피해 receipt 불변·저장 호출0, Red→Green·전체 npm test/build 및 #534 코멘트/HANDOVER 기록.
테스트: 비율 분모/기회 수 경계, 3쌍 이상 상한, 소수 반올림, 동일 키 반복/다른 effect/다른 session을 Red로 작성한다. npm test Baseline → 대상 Red → 별도 구현 Green → 전체 npm test/npm run build. 미확정 계산 규칙은 테스트 상수로 승인하지 않는다.
관련 파일: DOC-14 §9.4.
선행 카드: [31 #533](https://github.com/Choyounhwa/-dream-guardian/issues/533), [17 #519](https://github.com/Choyounhwa/-dream-guardian/issues/519) 실제 완료, G5 및 본 카드 승인.
추적 및 중복 정책: [TRACK #502](https://github.com/Choyounhwa/-dream-guardian/issues/502). legacy 보상/SSOT/NEXT 불변, 가짜 별 판정 금지.

### [BOSS-ASSAULT-33]
제목: 신규 기록·보상 영수증 격리 저장 어댑터
상태: OPEN / 계획 / G5 저장 비교 계약·개별 승인 대기, 구현·테스트 미착수.
책임 레이어: Storage. config 정책/콘텐츠/runtime 판정/effects는 계산하지 않고 검증 DTO와 영수증만 저장한다.
목적: legacy 최고기록/성장 저장을 오염시키지 않는다.
수정 대상:
- `dream_guardian/src/storage/AssaultResultStore.ts` — 신규 제안.

파일 수: `src/` 및 `config/` 합계 1개.
테스트 파일(별도):
- `dream_guardian/tests/unit/assault-storage.test.ts` — 신규 제안.
구현 내용:
1. mode/rulesVersion/profile/난도/템포/기회 수/입력 접근성/숫자형 식별을 검증하고 승인 namespace로 분리한다.
2. 결과와 보상 명령의 영수증을 세션 ID 기준으로 저장하되 동일 요청 재시도에 중복 지급 기록을 만들지 않는다.
3. 손상/미지원 버전/저장 실패를 오류로 반환하고 요청만으로 성공을 표시하지 않는다.
4. 테스트 세션은 저장0, legacy 키/성장 migration/온라인 랭킹은 접근하지 않는다.
데이터 입력→출력: 검증 결과 DTO+보상 명령 → 저장 영수증 또는 오류.
유지 사항: legacy key/최고기록/성장, 테스트 세션 저장 0회.
변경 금지: 랭킹 계산·온라인 통신·기존 데이터 migration·실제 성장 자동 연결.
완료 조건:
- [ ] 정상 결과 왕복·비교 식별자 보존, legacy key write0·테스트 세션 write0이다(A21).
- [ ] quota/권한 실패·손상 JSON·미지원 버전·부분 실패 재시도에 거짓 성공/중복 영수증이 없다(A14,A16).
- [ ] 입력 DTO 불변, Red→Green·전체 npm test/build 및 #535 코멘트/HANDOVER 기록. 실제 성장 지급은 승인 범위 아님.
테스트: fake storage 성공/throw/손상/동일 session 중복/다른 profile/실패 뒤 재시도를 Red로 검증한다. npm test Baseline → 대상 Red → 별도 구현 Green → 전체 npm test/npm run build. 브라우저 저장 차단/재실행 증거는 35/36 통합 인수와 구분한다.
관련 파일: DOC-14 §11.3; 01 저장 비교 계약.
선행 카드: [32 #534](https://github.com/Choyounhwa/-dream-guardian/issues/534), [02 #504](https://github.com/Choyounhwa/-dream-guardian/issues/504) 실제 완료, [01 #503](https://github.com/Choyounhwa/-dream-guardian/issues/503) 저장 비교/namespace 별도 승인 증거. MVP 승인만으로 해제 불가.
추적 및 중복 정책: [TRACK #502](https://github.com/Choyounhwa/-dream-guardian/issues/502). 기존 저장 이력 보존, legacy/SSOT/NEXT 불변.

### [BOSS-ASSAULT-34]
제목: 실측 결과·보상 영수증 읽기 전용 화면
상태: OPEN / 계획 / G5 계약·개별 승인 대기, 구현·테스트 미착수.
책임 레이어: UI. config/콘텐츠/runtime 통계 계산과 분리, effects로 누락값/저장 실패를 성공처럼 꾸미지 않는다.
목적: 반복 타격을 문제 수와 구분해 결과에 표시한다.
수정 대상:
- `dream_guardian/src/ui/AssaultResultView.ts` — 신규 제안.

파일 수: `src/` 및 `config/` 합계 1개.
테스트 파일(별도):
- `dream_guardian/tests/unit/assault-result-view.test.ts` — 신규 제안.
구현 내용:
1. 완료 문제/타격 정오/미선택·콤보/회피/활성 시간/HP/접근을 결과 DTO 그대로 구분 표시한다.
2. completed/aborted·결전 결과·입력/접근성·규칙 버전을 명시하여 비교 조건을 숨기지 않는다.
3. 보상/저장 영수증과 실패를 구별하고 미구현 값은 숨김/미지원으로 표시한다. 재표시는 지급/저장을 호출하지 않는다.
데이터 입력→출력: 결과 DTO+저장/보상 영수증 → 읽기 전용 화면.
유지 사항: legacy 결과 화면/기록 의미.
변경 금지: 통계 계산·상수 채움·저장/보상 호출·랭킹 표시.
완료 조건:
- [ ] 문제1/타격3·중단 문제0·결전 사망·저충격 프로필을 서로 구분한다(A11,A22).
- [ ] 저장 실패/무보상/미지원에 거짓 성공·상수 채움 없고 반복 표시의 자원 호출0이다(A21).
- [ ] 브라우저 데스크톱/모바일 결과 가독성, Red→Green·전체 npm test/build 및 #536 코멘트/HANDOVER 증거를 기록한다.
테스트: 완료/중단/사망/저장 오류/누락값 fixture와 동결 DTO 반복 render를 Red로 작성한다. npm test Baseline → 대상 Red → 별도 구현 Green → 전체 npm test/npm run build. 실제 스크린샷/뷰포트를 남기고 DOM spy를 픽셀 증거로 대체하지 않는다. editor build 불필요.
관련 파일: DOC-14 §11.2~11.3.
선행 카드: [17 #519](https://github.com/Choyounhwa/-dream-guardian/issues/519), [30 #532](https://github.com/Choyounhwa/-dream-guardian/issues/532), [32 #534](https://github.com/Choyounhwa/-dream-guardian/issues/534), [33 #535](https://github.com/Choyounhwa/-dream-guardian/issues/535) 실제 완료, G5 및 본 카드 승인.
추적 및 중복 정책: [TRACK #502](https://github.com/Choyounhwa/-dream-guardian/issues/502). legacy 결과 의미/SSOT/NEXT 불변, 랭킹은 별도 후속.

### [BOSS-ASSAULT-35]
제목: 결과·보상·저장 종료 포트 배선
상태: OPEN / 계획 / G5 계약·개별 승인 대기, 구현·테스트 미착수.
책임 레이어: Core 배선. config/콘텐츠/보상 계산은 재구현하지 않고 runtime 종료 포트와 표시 effects를 연결한다.
목적: 이미 구현된 종료 결과 포트를 한 번만 연결한다.
수정 대상:
- `dream_guardian/src/core/AppBootstrap.ts` — 기존 파일.
- `dream_guardian/src/core/SceneDirector.ts` — 기존 파일.
- `dream_guardian/src/core/AssaultSessionFactory.ts` — 22번 카드에서 생성 예정인 신규 제안.

파일 수: `src/` 및 `config/` 합계 3개.
테스트 파일(별도):
- `dream_guardian/tests/unit/assault-result-wiring.test.ts` — 신규 제안.
구현 내용:
1. 기존 단일 종료 소유자에서 최종 summary→32 정책→33 저장→34 표시를 한 번 연결한다.
2. 초기 테스트 세션은 항상 지급/저장0, 별도 승인 기록 옵션만 신규 namespace 포트를 허용한다.
3. 저장 실패를 결과 화면에 전달하고 재시도/늦은 종료 콜백에 보상/종료 중복을 만들지 않는다.
4. legacy resolver/성장·메뉴 기본값은 유지하고 타격별 저장이나 core 내 정책 계산을 추가하지 않는다.
데이터 입력→출력: 최종 snapshot+세션 옵션 → 결과 표시/허용된 신규 저장 영수증.
유지 사항: legacy resolver/저장/성장 경로.
변경 금지: 정책 계산 재구현·타격별 저장·전역 기본값 전환.
완료 조건:
- [ ] 테스트 모드 지급/저장0, 승인 기록 모드는 최종 결과1회만 처리하고 legacy key는 불변이다(A21).
- [ ] 중복 종료/이전 세션 콜백/저장 실패 재시도/동시 사망에 중복 지급·승리 오표시가 없다(A14,A16,A22).
- [ ] 브라우저 저장 실패/결과 재표시 증거, Red→Green·전체 npm test/build 및 #537 코멘트/HANDOVER 기록.
테스트: 세션 옵션×완료/중단, 저장 throw/재시도, 늦은 콜백, result render 반복을 Red로 검증한다. npm test Baseline → 대상 Red → 별도 배선 Green → 전체 npm test/npm run build. 실제 browser storage 결과를 mock 결과와 구분하고 환경 부재는 미검증으로 남긴다.
관련 파일: DOC-14 §§9,11.
선행 카드: [24 #526](https://github.com/Choyounhwa/-dream-guardian/issues/526), [30 #532](https://github.com/Choyounhwa/-dream-guardian/issues/532), [32 #534](https://github.com/Choyounhwa/-dream-guardian/issues/534), [33 #535](https://github.com/Choyounhwa/-dream-guardian/issues/535), [34 #536](https://github.com/Choyounhwa/-dream-guardian/issues/536) 실제 완료, G5 기록 옵션 승인 및 본 카드 승인.
추적 및 중복 정책: [TRACK #502](https://github.com/Choyounhwa/-dream-guardian/issues/502). 기존 종료 권위 재사용, legacy/SSOT/NEXT 불변.

### [BOSS-ASSAULT-36]
제목: 결전·기록 포함 실기기 최종 인수 게이트
상태: OPEN / 계획 / QA 미착수, 개별 승인 대기. 최종 인수/기본 모드 전환 미승인.
책임 레이어: QA. config/콘텐츠/runtime/effects 관찰만, 제품 수정0개.
목적: 자동 검증과 실제 가독성·인식·피로 검증을 구분해 인수한다.
수정 대상:
- `docs/15_BOSS_ASSAULT_WORK_CARDS.md` — 인수 증거만.

파일 수: `src/` 및 `config/` 합계 0개. 제품 소스 수정 없음.
테스트 파일(별도):
- `dream_guardian/tests/integration/assault-acceptance.test.ts` — 신규 제안.
구현 내용:
1. 25 MVP 시나리오를 재실행하고 결전 동시 사망·점프/저충격·최종 기록 격리를 통합 검증한다.
2. 데스크톱/모바일·웹캠/폴백·저장 실패·pause/메뉴/재시작 조합의 자동 결과를 기록한다.
3. 실제 브라우저/기기/뷰포트/관찰 시간과 읽기 부족·오인식/중복·복귀 실패·피로/성능을 구분 기록한다.
4. A01~A23 증거표와 미해결 버그를 정리한다. 제품 수정은 별도 버그 승인, 기본 모드 전환은 별도 후속 카드다.
데이터 입력→출력: 실제 세션/기기 관찰 → A01~A23 증거표와 미해결 목록.
유지 사항: legacy 기본 모드 및 모든 구현 범위.
변경 금지: 제품 수정·측정 안 한 효과/인식률 주장·기본 모드 자동 전환.
완료 조건:
- [ ] A01~A23 각각 성공/실패/경계·중복/불변 근거와 자동/수동 증거 구분이 있다.
- [ ] 가독성·인식 실패·피로·접근성·저장 격리 실기기 증거가 있고 미측정/미해결이면 게이트는 차단이다.
- [ ] 전체 npm test/build와 기기별 실제 결과·미해결 목록을 #538 코멘트/HANDOVER에 기록하고 최종 인수 승인을 받았다.
- [ ] 통과해도 legacy 기본값/SSOT/NEXT를 자동 변경하지 않는다.
테스트: QA 예외. npm test Baseline → 대상 integration/characterization → 전체 npm test/npm run build → §13.2 실제 브라우저/기기 증거. 가짜 Red/제품 Green 금지; 실패는 별도 버그 카드에서 TDD 후 여기서 재검증한다. 자동 Pass를 운동 효과/인식률/픽셀 증거로 대체하지 않는다. editor build 불필요, 현재 미실행.
관련 파일: DOC-14 §13, DOC-15 게이트.
선행 카드: [25 #527](https://github.com/Choyounhwa/-dream-guardian/issues/527), [30 #532](https://github.com/Choyounhwa/-dream-guardian/issues/532), [35 #537](https://github.com/Choyounhwa/-dream-guardian/issues/537) 실제 완료/게이트 증거와 본 QA 승인. G4/G5 수치 승인 누락은 최종 인수로 소급 승인하지 않는다.
추적 및 중복 정책: [TRACK #502](https://github.com/Choyounhwa/-dream-guardian/issues/502). legacy 회귀 이력 보존, SSOT/NEXT 불변, 미등록 후속을 완료 처리하지 않는다.

### [BOSS-ASSAULT-37]
제목: 기존 보스 HP 소유자의 명시적 초기화 옵션
상태: OPEN / 계획 / G4 HP 계약·개별 승인 대기, 구현·테스트 미착수.
책임 레이어: Game 자원 초기화. config HP만 주입하며 콘텐츠/runtime 피해 정책/effects/core 배선은 제외한다.
목적: 신규 보스 HP 설정을 전역 기본값 변경 없이 주입한다.
수정 대상:
- `dream_guardian/src/game/BossController.ts` — 기존 파일.

파일 수: `src/` 및 `config/` 합계 1개.
테스트 파일(별도):
- `dream_guardian/tests/unit/assault-boss-profile.test.ts` — 신규 제안.
구현 내용:
1. 현행 constructor(chapter)/reset(chapter)가 DEFAULT_CONFIG만 사용하는 계약을 확인하고 01 승인된 선택적 HP 주입 경계만 추가한다.
2. 옵션 생략 시 기존 챕터 HP/maxHp/phase 초기화와 reset 의미를 그대로 유지한다.
3. 명시 승인 profile은 같은 객체의 HP/maxHp를 초기화하며 reset 시 옵션 유지/해제 의미는 01 계약대로 한다.
4. 0/음수/NaN/Infinity 등 잘못된 값은 chapter/HP/phase 변경 전에 거부한다. core 배선은 30에 남긴다.
데이터 입력→출력: chapter+선택적 승인 maxHp → 기존 객체의 HP/maxHp 초기화.
유지 사항: 기존 constructor(chapter)/reset(chapter) 호출 호환, 단일 보스 HP 권위.
변경 금지: DEFAULT_CONFIG 변경·추가 HP 객체·피해/보상 규칙 변경·core 배선.
완료 조건:
- [ ] 옵션 없는 모든 기존 chapter 생성/reset 결과가 동일하고 DEFAULT_CONFIG 불변이다(A01).
- [ ] 승인 HP 주입/reset 재현 및 옵션 해제 의미가 계약과 일치하며 단일 HP 권위를 유지한다(A22).
- [ ] invalid 입력 거부 후 이전 HP/maxHp/chapter/phase 불변, Red→Green·전체 npm test/build 및 #539 코멘트/HANDOVER 기록.
테스트: chapter1~5 기존 호출, 명시 HP/reset 반복·옵션 생략, 0/음수/NaN/Infinity, 피해 후 invalid reset 원자성을 Red로 작성한다. npm test Baseline → 대상 Red → 별도 최소 구현 Green → 전체 npm test/npm run build. 신규 피해/보상 정책을 이 카드에 넣지 않는다.
관련 파일: DOC-14 §§9.1,10.2; 조사에서 constructor와 reset 모두 DEFAULT_CONFIG만 참조함을 확인.
선행 카드: [26 #528](https://github.com/Choyounhwa/-dream-guardian/issues/528) 실제 완료, [01 #503](https://github.com/Choyounhwa/-dream-guardian/issues/503) HP 생성/reset 별도 승인 증거. 실행 위치 26 직후/30 이전 유지, MVP 승인만으로 해제 불가.
추적 및 중복 정책: [TRACK #502](https://github.com/Choyounhwa/-dream-guardian/issues/502). 기존 BossController 재사용, legacy/SSOT/NEXT 불변.

## 4.1 기존 카드 v0.3 보완 조항 (DOC-14 §15)

아래 조항은 해당 카드의 구현 내용·완료 조건·선행에 **추가**된다. 원 조항과 충돌하면 이 보완 조항이 우선한다. 허용 파일 수 제한(src/config 최대 3개)은 그대로다.

| 카드 | 보완 조항 | 근거 |
|---|---|---|
| 01 #503 | §2 v0.3 결정 항목 DEC-A3~DEC-C10을 MVP 원장에 추가. DEC-A3/B6은 카드 38 실측 증거를 입력으로 받는다. | A3,A4,A6~A8,B3,B4,B6,B8,C4,C6,C10 |
| 02 #504 | `SessionMode`(legacy/boss_assault) 타입을 `src/types/assault.ts`에 정의한다(21이 4번째 파일을 열지 않도록). 펀치 이벤트 타입에 hand(left/right)와 지연 보정 전/후 시각을 구분한다. | A1, A4, B6 |
| 03 #505 | 추가 필드: 입력 지연 보정(`inputLatencyMs`), 늦은 허용창(`lateGraceMs`), 재개 준비 박(`resumeReadyBeats`), 콤보/리듬 등급 구간, 좌/우 발사점 비율, 라벨 최소 글자 크기·최대 글자 수, 피해량(DEC-C10). 승인 전 값은 채우지 않는다. | B6, B8, C2, C4, C9, C10 |
| 07 #509 | 문제는 기존 경로로 1회만 생성하고 정답값만 사용한다. `generateQuestion` 재호출 금지. 오답은 주입 시드 RNG와 config 규칙 목록(±1, ±2, ±10, 자릿수 교환, 연산 실수형)으로 생성한다. 입력 문항은 39 적격성 필터를 통과한 것만 받는다. 선행에 39 추가. | A5, A6 |
| 08 #510 | 입력 시각에서 `inputLatencyMs`를 빼 정규화한다(보정 전/후 모두 기록). 탭 숨김 신호는 23이 전달하는 입력으로만 받는다. 공격 중 정지 여부를 출력해 15가 재개 정책을 적용하게 한다. | B6, B7, B8 |
| 09 #511 | 판정 방식은 DEC-A3 승인안(권장: 2D 영역 뻗기)만 구현한다. 손–답 매핑은 DEC-A4를 따르고 이벤트에 hand를 포함한다. 선행에 38 실측 증거 추가. | A3, A4 |
| 12 #514 | 판정 마감 = 시각 도착 + `lateGraceMs`로 분리한다. DEC-A4 매핑 위반(반대 손) 입력은 선택으로 취급하지 않는다. | A4, B6, A27 |
| 15 #517 | TTS는 DEC-B3(권장: 시간 기반, 대기 없음)만 구현한다. 공격 중 정지 후 재개 시 DEC-B8(권장: 공격 예고부터 재시작 + 1박)을 적용하고 이전 공격 결과를 중복 생성하지 않는다. 읽기 하한은 39의 `minReadSeconds`를 사용. 선행에 39 추가. | B3, B8, C1, A28 |
| 16 #518 | DEC-A7 권장안 채택 시 `BossController.takeDamage` 호출을 MVP 정산에서 제외하고 플레이어 HP(`applyHazardDamage`)만 다룬다. 피해량은 DEC-C10. | A7, C10 |
| 20 #522 | DEC-A7 채택 시 보스 HP 바 숨김. 저HP는 음성 대신 시각 경고로 표시. 선행에 08 추가. | A7, B2, D4 |
| 21 #523 | 수정 대상을 `src/types/index.ts`(GameState에 `ASSAULT_ROUND` additive), `src/core/StateMachine.ts`, `src/core/GameSessionContext.ts`로 교체(`src/core/types.ts` 제외). 모드 타입은 02에서 import. `READY_POSITION → ASSAULT_ROUND` 전환 포함. `architecture.test.ts`의 14개 상태 검증 갱신 필요 여부를 착수 시 확인한다. | A1, C7 |
| 22 #524 | 진입은 개발 빌드(`import.meta.env.DEV`) + `?mode=boss_assault`만 허용. 적격 문항 0개·검증 실패는 진입 오류. 배선은 `AssaultSessionFactory`에 집중하고 AppBootstrap 연결 지점은 최소화. | C7, A29, D3 |
| 23 #525 | assault 모드에서: (1) legacy 게임 update 블록(HP0 `showResult` 포함) 미실행, (2) low_hp 음성 비활성, (3) X자 일시정지 제스처 비활성 + 화면 pause 버튼/Esc, (4) `visibilitychange` 리스너 등록 후 08에 전달, (5) IntentBus phase를 `ASSAULT_ROUND`로 설정(40 선행). 선행에 40 추가. | B1, B2, B4, B7, A2, A24~A26 |
| 24 #526 | assault 종료는 `SessionLifecycle` 단일 경로만. `SceneDirector`의 HP0 `showResult` 분기가 assault에서 호출되지 않음을 테스트로 확인한다. | B1, A22 |
| 25 #527 | 대표 시나리오에 A24~A31(ownership·X자·저HP 낭독·지연 경계·재개·부적격 문항·시드 재현·실측 운동량) 검증 추가. | §15.5 |

## 4.2 v0.3 신규 카드 (38~46)

이슈 번호: 38=#541, 39=#542, 40=#543, 41=#544, 42=#545, 43=#546, 44=#547, 45=#548, 46=#549. 4.1의 "선행에 38/39/40 추가"는 각각 #541/#542/#543을 뜻한다.

공통 계약(§4 머리말)이 모두 적용된다. 47(`BattleState` maxHp 주입)은 DEC-A8 대안 채택 시에만 등록하는 후보로 이번에 등록하지 않는다.

### [BOSS-ASSAULT-38]
제목: 펀치·스쿼트 판정 및 입력 지연 실측 스파이크
상태: DONE / 실측 스파이크 완료. 01(#503) 결정 입력 증거 제출 완료. 제품 소스 수정 없음.
책임 레이어: QA 실측. 결과는 01 결정의 입력 증거다.
목적: 2D 카메라에서 펀치 판정 방식(DEC-A3)과 입력 지연(DEC-B6)을 추정이 아닌 실측으로 결정한다.
수정 대상:
- 제품 소스 수정 없음. 측정 기록은 이슈 코멘트와 DOC-15 결정 원장 증거로만 남긴다.

파일 수: `src/` 및 `config/` 합계 0개.
테스트 파일(별도): 없음. 필요 시 `dream_guardian/tests/` 밖의 일회성 개발 측정 스크립트는 커밋하지 않는다.
구현 내용:
1. 데스크톱·모바일에서 정면 펀치/영역 뻗기/스쿼트/양팔 가드의 손목·팔꿈치·어깨·골반 랜드마크 로그를 수집한다.
2. 2D 영역 뻗기와 속도 기반 판정의 검출률·오검출(손 유지, 가드, X자 교차)을 비교한다.
3. 동작 시작 → 랜드마크 반영까지 지연 분포(중앙값, p90)를 측정한다.
4. 권장 임계값 후보와 근거를 01 결정 원장에 제출한다. 수치 확정은 01 승인으로만 한다.
데이터 입력→출력: 실제 카메라 세션 → 판정 방식 비교표, 지연 분포, 임계값 후보.
유지 사항: 모든 제품 코드·config.
변경 금지: 제품 수정, 측정 없는 수치 제출, 결과를 확정값으로 기록.
완료 조건:
- [x] 최소 2개 기기·2명 이상(가능 시 아동 체형 포함) 측정 기록과 조건(조명·거리·해상도)이 있다.
- [x] 방식별 검출률/오검출 및 지연 중앙값·p90이 기록되었다.
- [x] 본 이슈 코멘트에 원자료 요약을 기록하고 #503에 증거 링크를 남겼다. 제품 테스트는 해당 없음으로 정직하게 기록한다.
테스트: QA 실측 예외. Baseline/Red/Green 해당 없음. 측정 절차와 원자료를 재현 가능하게 기록한다.
관련 파일: DOC-14 §§8.1,15.1-A3,15.2-B6; ArmReachAnswerSelector·MotionIntentBus·CalibrationHelper 읽기 전용.
선행 카드: 없음. 본 카드 착수 승인 별도.
추적 및 중복 정책: [TRACK #502](https://github.com/Choyounhwa/-dream-guardian/issues/502). SSOT/NEXT 불변.

### [BOSS-ASSAULT-39]
제목: 접근전 문항 적격성 필터 및 읽기 시간 분류
상태: OPEN / 계획 / 개별 승인 대기.
책임 레이어: Question(순수 필터) + Config(규칙표).
목적: 숫자형 반복 보기에 맞지 않는 문항을 진입 전에 제외하고 문항별 최소 읽기 시간을 산출한다.
수정 대상:
- `dream_guardian/src/question/AssaultQuestionEligibility.ts` — 신규 제안.
- `dream_guardian/config/assault-question.config.ts` — 신규 제안.

파일 수: `src/` 및 `config/` 합계 2개.
테스트 파일(별도):
- `dream_guardian/tests/unit/assault-question-eligibility.test.ts` — 신규 제안.
구현 내용:
1. DEC-A6 승인 범위(권장: Ch.1~2, 유한 숫자 정답, shapeCode 없음)로 `QuestionRecord`/생성 결과를 판정한다.
2. 비교 기호·문자열·분수 문자열·NaN/Infinity·라벨 최대 글자 수 초과를 사유와 함께 제외한다.
3. 규칙표(텍스트 길이·레벨 → 추가 초)로 `minReadSeconds`를 산출한다. 8박 하한은 15가 별도로 보장한다.
4. 적격 문항 0개를 명시 결과로 반환한다(22가 진입 오류로 표시).
데이터 입력→출력: 문항 레코드/생성 결과+규칙 config → 적격 여부·사유·minReadSeconds.
유지 사항: CSV 원본, QuestionBank/QuestionEvaluator 동작.
변경 금지: CSV 수정, legacy 출제 경로 변경, Math.random 사용.
완료 조건:
- [ ] 실제 CSV 샘플(L1 비교 기호, L3 분수, L7 도형, 정상 숫자)이 승인 범위대로 분류된다(A29).
- [ ] 읽기 규칙 경계(길이 N 직전/동일/초과)가 일치하고 원본 레코드가 불변이다.
- [ ] Red→Green·전체 npm test/build 및 이슈 코멘트/HANDOVER 기록.
테스트: 표 기반 Red. npm test Baseline → 대상 Red → 별도 최소 구현 Green → 전체 npm test/npm run build.
관련 파일: DOC-14 §§5.1,15.1-A6,15.3-C1,C9; `questions.csv`, `QuestionEvaluator.ts` 읽기 전용.
선행 카드: [02 #504](https://github.com/Choyounhwa/-dream-guardian/issues/504), [03 #505](https://github.com/Choyounhwa/-dream-guardian/issues/505) 실제 완료, 01 DEC-A6 승인 증거.
추적 및 중복 정책: [TRACK #502](https://github.com/Choyounhwa/-dream-guardian/issues/502). legacy/SSOT/NEXT 불변.

### [BOSS-ASSAULT-40]
제목: ASSAULT_ROUND 동작 소유권 config 항목
상태: OPEN / 계획 / 개별 승인 대기.
책임 레이어: Config.
목적: 신규 상태에서 `default` 소유권(전 intent 허용)이 적용되는 결함을 막는다.
수정 대상:
- `dream_guardian/config/judgment.config.ts` — 기존 파일.

파일 수: `src/` 및 `config/` 합계 1개.
테스트 파일(별도):
- `dream_guardian/tests/unit/assault-intent-ownership.test.ts` — 신규 제안.
구현 내용:
1. `PHASE_INTENT_OWNERSHIP`에 `ASSAULT_ROUND: ['reachLeft','reachRight','squat']`(01 승인 목록)를 additive로 추가한다.
2. 기존 항목·`default`·refractory·임계값은 변경하지 않는다.
3. 결전용 소유권은 G4 승인 후 별도 카드로 다룬다.
데이터 입력→출력: 승인 intent 목록 → readonly ownership 항목.
유지 사항: 기존 phase ownership 전체.
변경 금지: default 수정, 임계값 변경.
완료 조건:
- [ ] `ASSAULT_ROUND`에서 jump/step 비허용, reach/squat 허용(A24).
- [ ] 기존 ANSWER_SELECT/HAZARD_EVADE/STAR_COLLECT/BOSS_CLIMAX/default 결과 불변.
- [ ] Red→Green·전체 npm test/build 및 이슈 코멘트/HANDOVER 기록.
테스트: `MotionIntentBus.isIntentAllowedInPhase` 표 기반 Red. npm test Baseline → 대상 Red → 별도 구현 Green → 전체 npm test/npm run build.
관련 파일: DOC-14 §15.1-A2; MotionIntentBus 읽기 전용.
선행 카드: 01 상태 이름 승인 증거. (상태 문자열 키이므로 21 타입 확장과 독립 실행 가능)
추적 및 중복 정책: [TRACK #502](https://github.com/Choyounhwa/-dream-guardian/issues/502). legacy/SSOT/NEXT 불변.

### [BOSS-ASSAULT-41]
제목: 게임 시계 기반 박자·연출 효과음 큐
상태: OPEN / 계획 / 개별 승인 대기.
책임 레이어: Audio 어댑터. 판정/정산 없이 snapshot 이벤트를 소리 요청으로 변환한다.
목적: 오디오 시계와 엔진 시계 불일치 없이 박자·투척·발사·피격·무효화 음을 제공한다.
수정 대상:
- `dream_guardian/src/audio/AssaultSoundCue.ts` — 신규 제안.

파일 수: `src/` 및 `config/` 합계 1개.
테스트 파일(별도):
- `dream_guardian/tests/unit/assault-sound-cue.test.ts` — 신규 제안.
구현 내용:
1. 08 활성 시각과 15 snapshot의 경계 이벤트(박자, 투척, 발사, 무효화, 피격)를 SFX 요청으로 변환한다.
2. 같은 경계 ID는 1회만 재생하고 정지/숨김 중에는 요청하지 않는다.
3. MVP에서는 BGM을 시작하지 않는다(B5 권장안). 기존 SFXSynth API만 사용한다.
데이터 입력→출력: 활성 시각+snapshot 이벤트 → SFX 요청.
유지 사항: 기존 SFXSynth/BGMManager/StageBGM 동작.
변경 금지: AudioContext 시간을 판정 시계로 사용, BGM 동기화 구현.
완료 조건:
- [ ] 경계당 재생 1회, 중복 update·pause·재시작 시 중복/유령 재생 0회.
- [ ] legacy 오디오 경로 불변.
- [ ] Red→Green·전체 npm test/build, 실제 브라우저 청취 증거 및 이슈 코멘트/HANDOVER 기록.
테스트: SFX spy로 Red. npm test Baseline → 대상 Red → 별도 구현 Green → 전체 npm test/npm run build.
관련 파일: DOC-14 §15.2-B5; SFXSynth 읽기 전용.
선행 카드: [08 #510](https://github.com/Choyounhwa/-dream-guardian/issues/510), [15 #517](https://github.com/Choyounhwa/-dream-guardian/issues/517) 실제 완료.
추적 및 중복 정책: [TRACK #502](https://github.com/Choyounhwa/-dream-guardian/issues/502). legacy/SSOT/NEXT 불변.

### [BOSS-ASSAULT-42]
제목: 접근 진행도 연출 렌더러
상태: OPEN / 계획 / 개별 승인 대기.
책임 레이어: Render. snapshot 읽기 전용.
목적: 제자리 운동에서 보스에게 다가가는 감각을 보스 스케일·배경 시차로 표현한다.
수정 대상:
- `dream_guardian/src/render/AssaultApproachRenderer.ts` — 신규 제안.

파일 수: `src/` 및 `config/` 합계 1개.
테스트 파일(별도):
- `dream_guardian/tests/unit/assault-approach-render.test.ts` — 신규 제안.
구현 내용:
1. 18의 진행도(0~1)를 visual config의 보스 스케일/배경 오프셋 곡선으로 변환한다.
2. 라운드 완료 시점에만 전진 애니메이션을 시작하고 문제/답 영역을 가리지 않는다.
3. 상태를 변경하지 않고 같은 snapshot 반복 render가 같은 결과를 낸다.
데이터 입력→출력: 진행도 snapshot+visual config → Canvas 표시.
유지 사항: 기존 BossRenderer·배경 렌더러.
변경 금지: 진행도 계산, HP 변경.
완료 조건:
- [ ] 진행도 0/중간/1의 스케일이 config와 일치하고 문제·답 라벨과 겹치지 않는다.
- [ ] 반복 render의 상태 변경 0회.
- [ ] Red→Green·전체 npm test/build, 실제 브라우저 스크린샷 및 이슈 코멘트/HANDOVER 기록.
테스트: Canvas spy Red + 실제 스크린샷. npm test Baseline → 대상 Red → 별도 구현 Green → 전체 npm test/npm run build.
관련 파일: DOC-14 §§10.1,15.3-C3.
선행 카드: [18 #520](https://github.com/Choyounhwa/-dream-guardian/issues/520), [19 #521](https://github.com/Choyounhwa/-dream-guardian/issues/521) 실제 완료.
추적 및 중복 정책: [TRACK #502](https://github.com/Choyounhwa/-dream-guardian/issues/502). legacy/SSOT/NEXT 불변.

### [BOSS-ASSAULT-43]
제목: 접근전 운동량 실측 집계
상태: OPEN / 계획 / 개별 승인 대기.
책임 레이어: Game 집계(순수).
목적: 결과에 상수(`squats: 0`, `elapsedTime: 60`)가 아닌 실측 펀치·스쿼트·활성 시간을 제공한다.
수정 대상:
- `dream_guardian/src/game/assault/AssaultExerciseTally.ts` — 신규 제안.

파일 수: `src/` 및 `config/` 합계 1개.
테스트 파일(별도):
- `dream_guardian/tests/unit/assault-exercise-tally.test.ts` — 신규 제안.
구현 내용:
1. 09/10/44 이벤트에서 유효 펀치·스쿼트(대체 포함, 구분 기록)를 inputId 기준 중복 제거해 센다.
2. 08 활성 시간만 누적한다(wall time 금지).
3. 펀치 kcal 계수가 승인되지 않으면 kcal을 미지원 상태로 반환한다(0으로 채우지 않음).
데이터 입력→출력: 입력 이벤트+활성 시간 → readonly 운동량 요약.
유지 사항: legacy 칼로리 공식/결과 경로.
변경 금지: 상수 채움, 미승인 계수.
완료 조건:
- [ ] 중복 inputId·pause 구간 제외, 대체 동작 구분(A31).
- [ ] kcal 미승인 시 미지원 표시 상태.
- [ ] Red→Green·전체 npm test/build 및 이슈 코멘트/HANDOVER 기록.
테스트: npm test Baseline → 대상 Red → 별도 구현 Green → 전체 npm test/npm run build.
관련 파일: DOC-14 §§11.2,15.3-C5; `AppBootstrap.ts` showResult 상수 읽기 전용.
선행 카드: [08 #510](https://github.com/Choyounhwa/-dream-guardian/issues/510), [09 #511](https://github.com/Choyounhwa/-dream-guardian/issues/511), [10 #512](https://github.com/Choyounhwa/-dream-guardian/issues/512), [17 #519](https://github.com/Choyounhwa/-dream-guardian/issues/519) 실제 완료.
추적 및 중복 정책: [TRACK #502](https://github.com/Choyounhwa/-dream-guardian/issues/502). legacy/SSOT/NEXT 불변.

### [BOSS-ASSAULT-44]
제목: 스쿼트 회피 저충격 대체 동작 어댑터
상태: OPEN / 계획 / DEC-C6 결정 및 개별 승인 대기.
책임 레이어: Motion.
목적: 스쿼트가 어려운 사용자를 위해 같은 회피 계약을 만족하는 대체 동작을 제공한다.
수정 대상:
- `dream_guardian/src/motion/AssaultGuardAdapter.ts` — 신규 제안.

파일 수: `src/` 및 `config/` 합계 1개.
테스트 파일(별도):
- `dream_guardian/tests/unit/assault-guard-motion.test.ts` — 신규 제안.
구현 내용:
1. DEC-C6 승인 동작(권장: 양팔 가드)을 10과 같은 "안전 자세 구간 + 복귀 generation" 출력으로 정규화한다.
2. 접근성 프로필 ID를 이벤트에 보존해 결과·기록에서 실제 스쿼트와 구분한다.
3. 유지·추적 복구로 generation을 증가시키지 않는다.
데이터 입력→출력: pose+보정+시각 → 대체 안전 자세 구간/복귀 generation.
유지 사항: 10 스쿼트 어댑터, X자 제스처 legacy 동작.
변경 금지: 스쿼트 기록과 혼합, HP/판정 확정.
완료 조건:
- [ ] 가드 진입/유지/복귀 경계에서 generation 1회, 유지·떨림 0회.
- [ ] 프로필 ID 보존, 원본 pose 불변.
- [ ] Red→Green·전체 npm test/build 및 이슈 코멘트/HANDOVER 기록.
테스트: npm test Baseline → 대상 Red → 별도 구현 Green → 전체 npm test/npm run build.
관련 파일: DOC-14 §§8.3,15.3-C6.
선행 카드: [10 #512](https://github.com/Choyounhwa/-dream-guardian/issues/512) 실제 완료, 01 DEC-C6 승인, 38 실측.
추적 및 중복 정책: [TRACK #502](https://github.com/Choyounhwa/-dream-guardian/issues/502). legacy/SSOT/NEXT 불변.

### [BOSS-ASSAULT-45]
제목: 접근전 3단계 튜토리얼
상태: OPEN / 계획 / G3 인수 후 개별 승인 대기.
책임 레이어: Game 진행(튜토리얼 시퀀스 데이터 + 진행). UI 표시는 기존 snapshot 경로 재사용.
목적: 첫 플레이어가 펀치 → 스쿼트 → 느린 1라운드를 익힌 뒤 본 세션에 들어가게 한다.
수정 대상:
- `dream_guardian/src/data/assault/tutorialPatterns.ts` — 신규 제안.
- `dream_guardian/src/game/assault/AssaultTutorialController.ts` — 신규 제안.

파일 수: `src/` 및 `config/` 합계 2개.
테스트 파일(별도):
- `dream_guardian/tests/unit/assault-tutorial.test.ts` — 신규 제안.
구현 내용:
1. 펀치 연습(피해 없음) → 스쿼트 연습(피해 없음) → 느린 BPM 1라운드를 05/06 검증·컴파일된 데이터로 선언한다.
2. 각 단계 성공 조건 충족 시 다음 단계로, 건너뛰기 허용. 피해·기록·저장 0회.
3. core 연결은 별도 배선 카드로 남긴다(3파일 제한).
데이터 입력→출력: 튜토리얼 계획+입력 → 단계 진행 snapshot.
유지 사항: legacy 튜토리얼(`dream_guardian_tutorial_done`) 키.
변경 금지: HP 변경, 저장, legacy 튜토리얼 수정.
완료 조건:
- [ ] 단계별 성공/건너뛰기/재시작 경계가 일치하고 자원 호출 0회.
- [ ] Red→Green·전체 npm test/build 및 이슈 코멘트/HANDOVER 기록.
테스트: npm test Baseline → 대상 Red → 별도 구현 Green → 전체 npm test/npm run build.
관련 파일: DOC-14 §15.3-C8.
선행 카드: [25 #527](https://github.com/Choyounhwa/-dream-guardian/issues/527) G3 인수 승인.
추적 및 중복 정책: [TRACK #502](https://github.com/Choyounhwa/-dream-guardian/issues/502). legacy/SSOT/NEXT 불변.

### [BOSS-ASSAULT-46]
제목: (선택) QuestionSpeech 발화 완료·실패 콜백 additive API
상태: OPEN / 계획 / DEC-B3 대안 채택 시에만 착수. 권장안 채택 시 CLOSED(not planned) 처리 후보.
책임 레이어: Question.
목적: 3초 안전 타임아웃 때문에 `status`로는 완료를 알 수 없는 문제를 콜백으로 해결한다.
수정 대상:
- `dream_guardian/src/question/QuestionSpeech.ts` — 기존 파일.

파일 수: `src/` 및 `config/` 합계 1개.
테스트 파일(별도):
- `dream_guardian/tests/unit/assault-speech-callback.test.ts` — 신규 제안.
구현 내용:
1. `speak(text, { onEnd?, onError? })` 선택 인자를 additive로 추가한다. 기존 호출 시그니처 유지.
2. 취소(다른 발화로 대체 포함)·미지원·비활성은 onError(사유)를 정확히 1회 호출한다.
3. 기존 3초 안전 타임아웃의 status 동작은 바꾸지 않는다.
데이터 입력→출력: 텍스트+콜백 → 발화 및 1회 완료/실패 통지.
유지 사항: speak/speakRunPhase/speakFeedback 기존 동작.
변경 금지: 기존 피드백 정책·보이스 설정 변경.
완료 조건:
- [ ] onEnd/onError 정확히 1회, 대체 발화 시 이전 요청 onError(cancelled).
- [ ] 기존 TTS 테스트 회귀 0건.
- [ ] Red→Green·전체 npm test/build 및 이슈 코멘트/HANDOVER 기록.
테스트: speechSynthesis mock Red. npm test Baseline → 대상 Red → 별도 구현 Green → 전체 npm test/npm run build.
관련 파일: DOC-14 §15.2-B3.
선행 카드: 01 DEC-B3 대안 승인.
추적 및 중복 정책: [TRACK #502](https://github.com/Choyounhwa/-dream-guardian/issues/502). legacy/SSOT/NEXT 불변.

## 5. DOC-14 인수 기준 추적표

| 기준 | 주 담당 카드 | 통합 증거 |
|---|---|---|
| A01~A02 | 21~24 | 25,36 |
| A03 | 03,15,19 | 25 |
| A04 | 08,15,23 | 25 |
| A05~A07 | 12,14,16,19 | 25 |
| A08 | 12,15 | 25 |
| A09~A10 | 09,12 | 25 |
| A11 | 04,07,15,17,34 | 25,36 |
| A12~A13 | 10,13,16 | 25 |
| A14 | 16~18,24,32,33,35 | 25,36 |
| A15 | 18,24,30 | 25,36 |
| A16 | 08,11,16,24,35 | 25,36 |
| A17 | 06,15 | 25 |
| A18 | 11,23,28 | 25,36 |
| A19 | 08~10,20,23,28 | 25,36 |
| A20 | 15,22,23 | 25 |
| A21 | 31~35 | 36 |
| A22 | 18,24,29,30,35 | 30,36 |
| A23 | 03,08,15,23 | 25 |

| A24 | 23, 40 | 25 |
| A25 | 23 | 25, 36 |
| A26 | 20, 23 | 25 |
| A27 | 03, 08, 12 | 25 |
| A28 | 08, 15 | 25 |
| A29 | 22, 39 | 25 |
| A30 | 07 | 25 |
| A31 | 34, 43 | 25, 36 |

§6.5 추가 기준(알 수 없는 버전/ID/수치/중첩 거부·결정성·불변·0/1-based)은 02~06,14,27에서 별도 테스트한다. A번호에 없는 검증을 A통과로 대체하지 않는다.

## 6. 등록 검증 기록 (구현 검증 아님)

### 2026-10-10 상세화 재검증

#### 후속 가독성 정리 검증

- 기존 #502~#539 **38개 모두** 서식 갱신 후 재조회했다. 전송 본문 정확 일치, 제목 불변, OPEN 유지 및 14개 표제를 확인했다. 의존성 링크 목록과 완료 체크박스 개수는 변경 전후 대조했다.
- 분리된 책임 레이어 문장을 한 줄로 연결하고 `gh issue comment 507`처럼 번호까지 인라인 코드로 정리했다. 파일별 허용 목록, 소스·설정 합계, 별도 테스트 목록을 분리하고 중복 유지 문장·QA 절차·관련 문서 목록을 정리했다.
- #507/#527 최종 원격 Markdown을 별도로 재조회하여 글머리표, 단일 책임 문장, 명령, 1개/0개 파일 수와 QA 예외 1회 표기를 확인했다. 브라우저 렌더링/스크린샷 검증을 수행했다는 의미는 아니다.
- DOC-15의 37개 카드 및 관리 카드 수정 대상도 같은 목록/파일 수 형식으로 정리했다. 상세 검증 항목·선행 승인·소스 허용 범위는 그대로다. 문서 diff 공백 검증 외 제품 테스트/빌드/서버는 실행하지 않았다.
- 실행 중 동시 작업의 git 상태가 바뀌었으나 해당 파일을 수정·복원하거나 커밋하지 않았다. 이 후속 작업은 DOC-15와 기존 이슈 본문만 수정했다.

- 기존 관리 #502 및 하위 #503~#539 **38개 본문 갱신 성공**. 각 edit 직후 재조회한 body를 실제 전송 문자열과 비교하고 제목 동일/OPEN을 확인했다. 카드별 유지 사항 보강 후에도 37개를 다시 같은 방식으로 확인했고 tracker의 직접 의존성 표는 재조회한 하위 선행 링크 37행으로 대조했다.
- 전수 필드 검사: 38개 모두 14개 표제, 미체크 완료 조건 4~5개(관리 5개), 번호 있는 구현 단계 3~6개, 실제 의존성/관리 링크, config/콘텐츠/runtime/정산/effects 경계, OPEN을 확인했다. `음성 타입` 표현 없음. 등록/개정은 구현 승인·구현 완료가 아니다.
- DOC-15 §4는 37개 전체 상세 계약 및 공통 완료/검증 계약을 유지한다. 로컬은 공통 계약과 개별 내용을 분리하고 GitHub는 각 본문에 공통 계약을 포함하므로 **파일 전체/본문의 바이트 동일 비교는 수행하지 않았다**. ID/제목/allowlist/직접 선행/카드별 단계·검증·차단 의미를 대조한 기록이며, 전송 문자열과 원격 body의 정확 일치 검증과 구별한다.
- 첫 원격 갱신 배치는 PowerShell JSON 디코딩 오류로 첫 edit 전에 중단됐다. UTF-8을 명시한 뒤 성공했으며 미반영 원격 번호는 없다. API 조사 결과 QuestionSpeech 완료/실패 신호 계약은 G0 차단 사항으로 기록했다.
- 의도한 문서 `git diff --check` 및 DOC-15 `git diff --no-index --check`에서 공백 오류 없음(LF/CRLF 경고만). 제품 테스트/빌드/서버/커밋/푸시/이슈 생성/종료는 이 작업에서 실행하지 않았다.
- 동시 작업이 진행 중인 작업 트리에서 기존 UI 소스/테스트와 DOC-14, HANDOVER/SSOT/NEXT는 수정하지 않았다. 테스트/빌드 결과나 동시 작업자의 커밋을 이 문서 작업 성과로 주장하지 않는다.

### 최초 등록 검증 이력 (아래는 상세화 이전 기록)

- GitHub 재조회: 관리 1개 + 하위 37개 = 38개, 전부 OPEN. 하위 37개 각각의 표준 필드/데이터 입출력/의존성/상태/참조와 관리→하위 37개 URL 및 하위→관리 37개 역링크를 확인했다. 중복 생성 없음.
- 로컬 상세 카드 37개 확인. 기존 두 문서 diff는 독립 섹션 추가만이며 기존 SSOT/진행 표시 이동 없음. `git diff --check`와 신규 DOC-15의 `git diff --no-index --check`에서 공백 오류 없음(줄바꿈 LF/CRLF 경고만).
- GitHub 조회 결과의 PowerShell 파이프 인코딩 문제는 UTF-8로 재조회하여 검증했다. 첫 관리 본문 갱신 시도는 시간 초과 후 실제 본문을 확인하고 edit만 재시도했으며 새 이슈를 재생성하지 않았다.

## 7. 관리 이슈 상세 본문 (#502)

[BOSS-ASSAULT-TRACK]

제목:
DOC-14 v0.2 보스 접근전 단계별 구현 준비 관리

상태:
OPEN / 계획 / 기존 카드 상세화만 승인. 구현·테스트·일괄 실행·기본 모드 전환 미승인.

목적:
기존 37개 카드의 단일 책임/의존성/승인/인수 증거를 #470 수준으로 관리한다. 새 이슈를 생성하거나 계획 등록을 제품 완료로 취급하지 않는다.

책임 레이어:
프로젝트 관리/문서. 제품 소스 수정 없음.

수정 대상:
- `docs/15_BOSS_ASSAULT_WORK_CARDS.md` — 해당 관리 기록만.
- `docs/03_GITHUB_ISSUES.md` — 해당 관리 기록만.
- `dream_guardian/HANDOVER.md` — 해당 관리 기록만.

파일 수: `src/` 및 `config/` 합계 0개. 테스트 파일 수정 없음. DOC-14와 동시 작업·SSOT/NEXT 변경 금지.

데이터 입력/출력:
DOC-14 v0.2/현행 API/기존 #502~#539 → 상세 계약/실제 URL/게이트 증거 원장. config는 수치, 콘텐츠는 순서, runtime은 진행·상태, 정산은 자원 변경, effects/화면은 표시로 분리한다. 문서에서 후보 수치를 승인하지 않는다.

구현 내용:
1. 기존 ID/제목/OPEN/allowlist/직접 의존성을 보존하여 각 카드에 3~6개 실행 단계와 성공/실패/경계/중복/불변 검증을 명시한다.
2. G0 승인 증거는 승인자·일시·버전·결정값/단위·적용 카드·코멘트 URL로 기록한다. #503의 MVP 부분 승인으로 MVP 의존성을 해제할 수 있으며 전체 CLOSED는 요구하지 않는다.
3. G1 타입/config/콘텐츠/검증/계획 → G2 입력/판정/정산/표시 → G3 core/인수 순서를 지킨다. G3 끝은 미구현 결전 인계이지 승리가 아니다.
4. G4 결전/HP와 G5 보상/저장 비교 결정은 별도 승인 전 계속 차단한다. G6 실제 인수 후에도 기본값 전환은 별도 미등록 카드/승인이다.
5. TTS 공개 API 한계, 3파일 범위 초과/다른 레이어 필요, QA 실패를 차단 사유로 기록하고 임의 구현하지 않는다.
6. 로컬 전체 상세 본문과 기존 원격 이슈를 대조하고 갱신 성공/실패를 번호별 추적한다. 기존 카드 재완료·중복 등록은 금지한다.

유지 사항:
DOC-14 v0.2 원문, 기존 legacy 기본 게임/CSV/저장/엔진/버스/Timeline, 완료 이력, 동시 작업, 기존 SSOT/NEXT를 보존한다. 구현 카드의 `src/` 및 `config/` 합계 최대 3개와 별도 테스트 목록을 유지한다.

변경 금지:
제품 구현/테스트 생성·실행/build/server/커밋/푸시, 새 이슈 생성, 자동 close/reopen, 후보 수치 확정, 다른 레이어·허용 목록 확대. 수식형 보기/랭킹/편집기/전 챕터/기본 모드 전환을 37개 범위에 추가하지 않는다.

완료 조건:
- [ ] 기존 관리1+하위37 총38개만 갱신하고 실제 재조회에서 모두 OPEN/제목 동일을 확인한다.
- [ ] 카드마다 책임/루트 기준 경로·파일 수/데이터 경계/단계/체크박스/검증/실제 선행 링크/완료 기록이 있다.
- [ ] MVP 부분 승인과 후속 수치 차단을 구분하고 소스 범위/직접 의존성/SSOT/NEXT가 불변이다.
- [ ] DOC-15에 모든 상세 계약을 보관하고 원격 대조 결과/부분 실패를 정직하게 기록한다.
- [ ] 실제 제품 DONE은 각 카드의 검증/승인/Rule12·13 증거로만 판단한다. 이 관리 개정은 제품 완료가 아니다.

테스트:
문서-only 예외. 필드/경로/의존성·링크/체크박스/OPEN/본문 대조와 intended docs의 git diff --check만 수행한다. Baseline/Red/Green/npm test/build/server는 미실행·해당 없음, 가짜 Pass 없음. 구현/데이터는 실제 승인 뒤 Baseline→Red→별도 Green→전체 npm test/build, 타입은 부정 타입 테스트, QA25/36은 characterization 예외·제품 수정 별도 버그 카드. 무관한 editor build는 요구하지 않는다.

관련 파일:
`docs/14_BOSS_ASSAULT_GAMEPLAY_DESIGN.md` §§6.4~6.7,13,14; `docs/15_BOSS_ASSAULT_WORK_CARDS.md`; `docs/Dream_Guardian_개발_규칙.md`; `docs/01_GAME_DESIGN_DOCUMENT.md`. 참고는 수정 allowlist가 아니다.

선행 카드:
관리 카드 자체의 선행 구현 없음. [01 #503](https://github.com/Choyounhwa/-dream-guardian/issues/503) G0 MVP 증거, [25 #527](https://github.com/Choyounhwa/-dream-guardian/issues/527) G3 인수, [26 #528](https://github.com/Choyounhwa/-dream-guardian/issues/528)→[37 #539](https://github.com/Choyounhwa/-dream-guardian/issues/539)→[30 #532](https://github.com/Choyounhwa/-dream-guardian/issues/532) G4, [31 #533](https://github.com/Choyounhwa/-dream-guardian/issues/533)→[35 #537](https://github.com/Choyounhwa/-dream-guardian/issues/537) G5, [36 #538](https://github.com/Choyounhwa/-dream-guardian/issues/538) G6. 이는 단계 참조이며 직접 DAG는 각 하위 카드 선행 목록이다. 위상 순서 01~26→37→27~36 유지, 실행 큐 승인 아님.

추적 및 중복 정책:
[TRACK #502](https://github.com/Choyounhwa/-dream-guardian/issues/502), 기존 하위 [#503](https://github.com/Choyounhwa/-dream-guardian/issues/503)~[#539](https://github.com/Choyounhwa/-dream-guardian/issues/539) 재사용. 전체 개별 URL은 §3 원장과 각 상세 카드 선행 링크에 보관한다. legacy 완료 이력 재완료·unrelated 종료·SSOT/NEXT 이동 없음. BPM100/4박/2쌍/10라운드 및 HP/보상 후보는 미승인이다.
- 동시 작업의 editor 소스/테스트 변경이 작업 트리에 관찰되었으나 이 에이전트는 수정·되돌리기·스테이징하지 않았다. DOC-14도 미수정. 이 작업의 변경 파일은 DOC-15, 이슈 목록, HANDOVER 세 개뿐이다.
- 제품 테스트/빌드/실기기/서버 실행 및 커밋/푸시는 요청 범위 밖으로 미실시. 등록상의 미완료 항목은 없으며 구현은 개별 승인과 01의 단계별 계약 결정으로 차단되어 있다.

### v0.3 보완 (2026-10-11) — #502 본문에 append한 내용과 동일

- DOC-14 v0.3 §15(A1~A8, B1~B8, C1~C10, D1~D4, A24~A31) 반영.
- 기존 15개 카드(#503, #504, #505, #509, #510, #511, #514, #517, #518, #522~#527) 본문 끝에 "v0.3 보완 조항" 절을 append했다. 기존 본문·제목·OPEN 상태는 그대로이며, 재조회로 깨진 문자 없음을 표본 확인(#523)했다.
- 신규 9개(38~46 = #541~#549)를 등록했다. 47은 후보이며 등록하지 않았다.
- 제품 소스/config/tests 미수정, 테스트·빌드·서버 미실행.
