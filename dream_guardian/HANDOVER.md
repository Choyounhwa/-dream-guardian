# 🌙 《꿈의 수호신 (Dream Guardian)》 프로젝트 인수인계 및 후속 작업 안내서

본 문서는 사용자가 이후 작업을 바로 이어서 진행할 수 있도록 프로젝트의 전체 맥락, 파일 구성, 구현 완료 현황, 실행 방법 및 다음 개발 과제를 정리한 문서입니다.

---

## 🧭 11단계 로드맵 진행 현황 (SSOT)

| 단계 | 순서 | 완료 목표 | 상태 |
|---|---|---|:---:|
| **1. 기준 확정** | **#229** → **#186 검증 설계** | 시간·판정창·자원 정책과 전체 실패 시나리오 확정 | `[✔] 완료` |
| **2. 진행 기반** | **#214** → **#230** → **#231** | 상태·실제 8박·일시정지·예약 처리 일치 | `[✔] 완료` |
| **3. 답 선택 화면** | **#232** → **#233** | 선택 즉시 올바른 화면 전환, 구형 UI 제거 | `[✔] 완료` |
| **4. 모션 입력** | **#237** *(완료)* → **#238** *(완료)* → *(#239 미채택)* | 발 좌표·방향·스텝, 점프 사용자 기준선 | `[✔] 완료` |
| **5. 분기 실행** | **#235** *(완료)* → **#236** *(완료)* | 별모으기 노트 일정·판정창, 회피 장판 수명주기 | `[✔] 완료` |
| **6. 문제 표시** | **#212** *(완료)* → **#234** | 문제 원근 접근 연출 및 긴 수식 너비·높이 수용 | **`[▶ NEXT: #234]`** |
| **7. 시청각 연결** | **#192** → **#228** → **#191** | 실제 노트·장판·Web Audio 밴드 음향 동기화 | `[✔] 모듈완료` *(통합대기)* |
| **8. 정산·자원** | **#240** → **#242** | Phase A 정산/처치 책임 분리 및 군단·별가루 모델 | `[ ] 대기` |
| **9. Phase B 진입** | **#241** | 10번째 정산 후 한 번만 인계, 11번째 출제 차단 | `[ ] 대기` |
| **10. Phase B 실행** | **#213** → **#193** → **#194** → **#195** | 피버·보스 공격·군단 화력·결전 화면 연결 | `[ ] 대기` |
| **11. 최종 검증** | **#186** | 실제 10문제 → Phase B → 승리/패배 → 메뉴 완주 | `[ ] 대기` |

> 📌 **현재 활성 작업 포인터:** **`[▶ NEXT]` = `#234 [BUG-MATH-PRESENT-001] 문제 폰트/너비 수용 및 원근 접근 연출 복구`**  
> 사용자가 `"다음"` 또는 `"시작"`을 입력하면 위 포인터의 작업이 자동 로드됩니다.

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
| 11 | 보스 결전 — 보스 마법 공격 패턴 | #193 `BATTLE-BOSS-001` | ⚪ 대기 |
| 12 | 보스 결전 — 미니언 군단 화력 | #194 `MINION-TROOP-001` | ⚪ 대기 |
| 13 | 보스 결전 — 유저 피버타임 별모으기 | #213 `BOSS-FEVER-001` | ⚪ 등록 완료 |
| 14 | 보스 결전 연출 | #195 `RENDER-CLIMAX-001` | ⚪ 대기 |
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
| `BATTLE-BOSS-001` | [#193](https://github.com/Choyounhwa/-dream-guardian/issues/193) | Phase B 보스 불협화음 장판(양손 쿵 점프 & 한손 콩콩 발짓밟기) 및 광폭화 엔진 | `BossHazardController.ts`, `BossController.ts` | ⚪ 대기 |
| `MINION-TROOP-001` | [#194](https://github.com/Choyounhwa/-dream-guardian/issues/194) | 아군 미니언 군단(3~13체) 실시간 증원/탈락 및 상체(Zone 1~5) 별빛 수집 마법 발사 시스템 | `MinionTroopManager.ts`, `BattleState.ts` | ⚪ 대기 |
| `RENDER-CLIMAX-001` | [#195](https://github.com/Choyounhwa/-dream-guardian/issues/195) | 3D 원근 보스 결전 연출(불협화음 장판 충격파, 적 미니언 전진, 아군 군단 마법 탄막 및 광폭화) | `BossClimaxRenderer.ts`, `CanvasManager.ts` | ⚪ 대기 |




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
| 30 | `FEAT-CURSOR-005` | [#201](https://github.com/Choyounhwa/-dream-guardian/issues/201) | 양손 선택 커서(합장 메뉴 커서 및 양손 답안 커서) 크기 3배 확대 및 원거리(1m+) 시인성 강화 | • **[대형화]** 합장 외곽 네온 링 반경 34px → 100px(지름 200px, 3배 확대), 폰트 14px → 40px<br>• **[호버링]** 0.8초 체류 프로그레스 아크 반경 50px → 145px, 두께 16px 대형화<br>• **[시인성]** 인게임 양손 답안 커서 스케일 동반 상향 | ⚪ **대기 (승인 대기)** |
| 31 | `FEAT-READY-001` | [#202](https://github.com/Choyounhwa/-dream-guardian/issues/202) | 스테이지 첫 진입 시 카메라 프레임 정렬 가이드 및 3초 준비 카운트다운(READY_POSITION) 구현 | • **[대기시간]** 챕터/단계 진입 후 문제 출제 전 3초 준비 카운트다운(3... 2... 1... START!) 페이즈 신설<br>• **[프레임맞추기]** 화각 정렬 가이드 표시 및 신체 포착 시 청록색 점등 피드백<br>• **[입력잠금]** 3초간 모션/답안 입력 완전 잠금으로 스텝 오인식 누락 차단, 0초 시점에 감지기 제로 리셋 | ⚪ **대기 (승인 대기)** |

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
