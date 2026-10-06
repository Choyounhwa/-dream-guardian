# FITNESS-EDITOR-QA: 통합 피트니스 제작·복구·게임 적용 최종 인수 점검표

- **작업 카드**: Issue #404 [FITNESS-EDITOR-QA]
- **책임 레이어**: Tests (소스/config 변경 0개, 인수 테스트 및 검증 문서화)
- **작성일**: 2026-10-06
- **기준 규칙**: `docs/01_GAME_DESIGN_DOCUMENT.md`, `docs/07_UNIFIED_EDITOR_INTEGRITY_DESIGN.md`, `docs/09_EDITOR_RUNTIME_CONTRACT.md`, `docs/10_CONTENT_DEPLOYMENT_OPERATIONS.md`

---

## 1. 개요 및 목적

본 문서는 **Dream Guardian** 체감형 피트니스 수학 RPG의 콘텐츠 저작 도구(Editor)부터 데이터 컴파일, 영구 저장/복원, 불변 게시(Publish), 런타임 게임 세션 주입, 결전(Boss Climax), 롤백(Rollback) 및 테스트 모드 격리에 이르는 **전체 파이프라인의 최종 종합 인수 검증 결과와 수동 점검표**를 정리한 표준 기술 문서입니다.

자동화된 단위/통합/E2E 테스트로 검증된 소프트웨어 계약(Contract)과, 물리적 브라우저/카메라/디바이스 환경에서 작업자가 직접 확인해야 하는 수동 점검 항목의 경계를 명확히 분리하여 기록합니다.

---

## 2. 자동화 검증 증빙 매트릭스 (Automated Test Matrix)

본 프로젝트의 F단계 최종 인수는 5대 핵심 요소에 대해 100% 자동화 테스트로 증명되었습니다.

| 테스트 슈트 | 파일 경로 | 주요 검증 항목 | 결과 |
|---|---|---|---|
| **E2E 풀 파이프라인 인수** | `tests/e2e/fitness-editor-full.e2e.ts` | 5대 요소 저작 -> 컴파일 -> 게시 -> 10문제 러닝 -> 오답 장판 회피 -> 정답 별수집 -> Phase B 보스 결전 -> 피버 타격 & 보스 공격 회피 -> 승리 -> 테스트 세션 영속화 0건 차단 | **PASS** (4/4) |
| **복구 및 회복력 통합** | `tests/integration/fitness-editor-recovery.test.ts` | 5대 요소 복원 1:1 일치, 손상 JSON 거부, 비허용 BPM 진단, 미저장 복구 버퍼 격리, V1 마이그레이션 비파괴, 변조 해시 거부, 2탭 동시 쓰기 RevisionConflictError 차단, Quota 트랜잭션 롤백, 세션 팩 Pinning, 정상본 롤백 | **PASS** (11/11) |
| **별 수집 라운드트립 MVP** | `tests/integration/editor-content-roundtrip.test.ts` | 7개 슬롯 순서/부위/존/시간과 게임 런타임 실행 1:1 일치, 2탭 경쟁, 테스트 모드 localStorage 쓰기 차단 | **PASS** (5/5) |
| **정적 Manifest 로드 및 폴백** | `tests/integration/content-manifest-load.test.ts` | 404/네트워크 whole-pack fallback, 부분 배포/캐시 불일치 거부, 로컬 오버라이드 격리 | **PASS** (16/16) |
| **Phase B 결전 조립** | `tests/integration/content-phase-b-bootstrap.test.ts` | Phase A->B 동일 번들 인계, 피버(8노트)/장판(3종) 분리, 11번째 문제 차단, 세션 핀닝 | **PASS** (5/5) |
| **Phase A 오답 장판 조립** | `tests/integration/content-hazard-a-bootstrap.test.ts` | 오답 분기 장판 주입, 정답 분기 별수집 격리, 타임아웃 트리거, 데미지 정산, pause/resume 리셋 | **PASS** (7/7) |
| **에디터 Phase B 보스 장판** | `tests/unit/editor-phase-b-hazard.test.ts` | 보스 공격 3종 자동 매핑, 잠금 수치, 빈 시퀀스 방지, 격리 저장 | **PASS** (21/21) |
| **에디터 Phase B 피버 노트** | `tests/unit/editor-fever-content.test.ts` | 피버 8노트 편집, 16박 모션 가이드 분리, 폼 버퍼 독립 검증 | **PASS** (16/16) |
| **에디터 Phase A 오답 장판** | `tests/unit/editor-phase-a-hazard.test.ts` | 장판 패턴 3종 단일 선택, 프리뷰 박자 타이밍 산출, 챕터 바인딩 | **PASS** (20/20) |
| **에디터 프로젝트 스토어** | `tests/unit/editor-project-store.test.ts` | 프로젝트별 큐 직렬화, 원자적 스냅샷/헤드, Quota 방어, 복구 버퍼 | **PASS** (10/10) |
| **게시 스토어 & 롤백** | `tests/unit/published-content-store.test.ts` | 불변 해시 저장, deepFreeze 보호, 롤백 예약/활성화, 보호 팩 삭제 방지 | **PASS** (17/17) |
| **결정적 컴파일러** | `tests/unit/content-compiler.test.ts` | 규칙 검증, 비허용 역량 거부, 해시 산출, 스테이지 번들 해석 | **PASS** (30/30) |

---

## 3. 완료 조건 검증 대조표 (Acceptance Criteria Checklist)

| 완료 조건 | 검증 방식 | 충족 상세 및 증빙 |
|---|---|---|
| **실제 편집 결과와 게임 이벤트/시간/입력 1:1 일치** | 자동화 테스트 | `tests/e2e/fitness-editor-full.e2e.ts`<br>- 별 7슬롯: 존 4, 5, 1, 3, 4, 5, 10(발) 순서 및 틱 시간 1:1 일치<br>- Phase A 장판: `jump` 패턴 런타임 주입 및 회피 성공 판정 일치<br>- Phase B 피버: 8노트 순서 및 타격 콤보 판정 일치<br>- Phase B 장판: `dual_slam`, `alternating_stomp_left`, `alternating_stomp_right` 3종 순차 주입 일치 |
| **세션 동안 팩 불변(Session Pinning) 유지** | 자동화 테스트 | `tests/integration/fitness-editor-recovery.test.ts`<br>- 스테이지 진행 중 에디터에서 새 팩이 게시되더라도 현재 실행 중인 스테이지는 직전 번들을 불변 유지<br>- 명시적 `restartGame()` 또는 다음 스테이지 시작 시점에만 새 팩 반영 |
| **손상 파일·구버전·두 탭 경쟁·저장 중단 시 데이터 유실/혼합 0건** | 자동화 테스트 | `tests/integration/fitness-editor-recovery.test.ts`<br>- 손상된 JSON: 파싱 에러 반환 및 에디터 기존 상태 100% 보존<br>- 비허용 규칙(BPM 128 등): 컴파일 에러 진단 반환 및 저장 차단<br>- 프로젝트 전환 시 미저장 작업: `recoveryBuffers` 자동 격리 보관<br>- V1 구버전 수입: 비파괴적 V2 마이그레이션 및 원본 키 불변<br>- 변조된 해시: 게시 시도시 `tampered-content-hash`로 즉각 거부<br>- 2탭 경쟁: Tab A 성공 후 Tab B 쓰기 시 `RevisionConflictError` 발생 및 복구 버퍼 보관<br>- Quota/트랜잭션 중단: 원자적 롤백으로 직전 Head/Snapshot 온전 보존 |
| **테스트 플레이가 정상 게임 기록을 바꾸지 않음 (저장소 완전 격리)** | 자동화 테스트 | `tests/e2e/fitness-editor-full.e2e.ts`<br>- `startTestPlaySession`: `isTestSession: true` 플래그 활성화<br>- 10문제 러닝, 오답 장판, 별 수집, Phase B 결전, 승리/패배 전 과정 동안 `STORAGE_KEY_STAGE_PROGRESS`, `STORAGE_KEY_HIGH_SCORES`, `STORAGE_KEY_REWARDS` localStorage 쓰기 **0건 (완전 차단)**<br>- 일반 세션(`startChapter`) 복귀 후 정상적인 저장소 쓰기 동작 완전 보존 |
| **자동/수동/미검증의 명확한 분리 및 경계 표시** | 문서화 및 규약 | `docs/11_FITNESS_EDITOR_ACCEPTANCE_CHECKLIST.md` 4~5절<br>- 물리 웹캠 인식률, 조도, 모바일 터치 감도, 오디오 지연 등은 단위테스트 Pass로 과장하지 않고 수동 점검표로 명시 |

---

## 4. 브라우저 및 물리 환경 수동 점검표 (Manual Verification Checklist)

> **주의**: 아래 항목들은 Node.js / Vitest 가상 돔 환경에서 검증할 수 없는 **물리적 환경 요인**입니다. 실제 배포 및 사용자 플레이 전 브라우저에서 작업자가 직접 확인해야 합니다.

### 4.1 실카메라 모션 인식 및 피트니스 판정 (Real Camera Motion)
- [ ] **전신 정렬 가이드 (READY_POSITION)**:
  - 카메라 전방 1.5m ~ 2.5m 거리에서 머리부터 무릎/발까지 인식 박스 내에 정상 포착되는가?
  - 역광이나 저조도 환경에서 관절 랜드마크의 깜빡임(jitter)이 심하지 않은가?
- [ ] **11개 피트니스 존 도달성 (Ergonomics)**:
  - 상단 Zone 1, 2, 3: 팔을 대각선 및 상단으로 뻗었을 때 무리 없이 인식되는가?
  - 중앙 Zone 4, 5: 가슴 높이 펀치/터치 동작이 즉시 인식되는가?
  - 하단 발 Zone 9, 10, 11: 좌/우/중앙 스텝 동작 시 바닥 매트와 발 위치가 정확히 구분되는가?
- [ ] **Cross-Body 제약 물리 체감**:
  - 골반이 하단(Zone 9~11)에 체류하는 스쿼트 상태에서 손을 상단(Zone 1~3)으로 올릴 때 불필요한 관절 꼬임 오작동이 없는가?
- [ ] **점프(Jump) 및 스쿼트(Squat) 체감**:
  - Phase A 오답 장판 `jump` 회피 시 실제 점프 동작이 0.5초 이내에 정상 감지되는가?
  - Phase B 보스 장판 `dual_slam` 시 충격파 회피 점프 타이밍이 시각 전조(1.5초)와 일치하는가?

### 4.2 모바일 디바이스 및 터치 환경 (Mobile & Touch Fallback)
- [ ] **iOS Safari & Android Chrome**:
  - 카메라 권한 요청 팝업이 정상 표시되고 비디오 스트림이 지연 없이 재생되는가?
  - 화면 방향 전환(가로 모드/세로 모드) 시 캔버스 16:9 비율 유지 및 왜곡이 없는가?
- [ ] **터치 입력 폴백 (Fallback Control)**:
  - 카메라 미지원 또는 가림 상태에서 화면 좌/우/중앙 터치로 점프 및 발 스텝 회피가 대체 작동하는가?
  - 답안 선택 화면에서 4지선다 터치 버튼이 지연 없이 응답하는가?

### 4.3 디스플레이 성능 및 오디오 싱크 (Performance & Audio Timing)
- [ ] **60 FPS 렌더링 유지**:
  - 스켈레톤, 이펙트 파티클, 3D 보스 모델 동시 렌더링 시 프레임 드랍이 발생하지 않는가?
- [ ] **Web Audio API 박자 지연**:
  - BGM의 정박(Downbeat)과 별/피버 노트의 타격 판정 링 애니메이션이 일치하는가?
  - 블루투스 이어폰 연결 시 오디오 지연에 대한 오프셋 조절 필요 여부를 점검했는가?

### 4.4 장시간 연속 실행 및 메모리 누수 (Long-Run Stability)
- [ ] **10스테이지 연속 플레이**:
  - 메모리 힙(Heap) 사용량이 지속적으로 증가하지 않고 가비지 컬렉션(GC)이 정상 작동하는가?
  - IndexedDB 스냅샷 레코드가 과도하게 누적되어 Quota 경고가 발생하지 않는가?

---

## 5. 자동 / 수동 / 미검증 경계 분류표 (Truth Boundary)

Dream Guardian 개발 원칙에 따라, 검증되지 않은 항목을 임의로 "통과"로 체크하지 않습니다.

```text
[자동화 보증 영역 (Automated Guaranteed)]
  ✔ 데이터 스키마 무결성 (EditorProject V2, PublishedContentPack 2.0.0)
  ✔ 5대 요소(별 7노트, 장판 A, 피버 8노트, 장판 B, 가이드)의 1:1 매핑 및 컴파일
  ✔ 2탭 저장 경쟁 시 RevisionConflictError 차단 및 recoveryBuffers 격리 보존
  ✔ Quota/Abort 실패 시 원자적 트랜잭션 롤백 및 Head 보존
  ✔ 스테이지 진행 중 중간 게시(Mid-stage Publish) 시 실행 세션 팩 불변(Session Pinning)
  ✔ 테스트 플레이 세션 실행 시 localStorage 진척도/점수/보상 쓰기 0건(완전 차단)
  ✔ 이전 정상본(previousHealthyHash) 안전 롤백 및 보호 팩 삭제 방지
  ✔ 정적 Manifest 404/네트워크 에러 시 whole-pack fallback (기본 콘텐츠 모드 복귀)

[수동 점검 필요 영역 (Manual Required)]
  △ 실제 웹캠 렌즈 왜곡에 따른 11개 존 물리적 도달성 및 신체 비율(체형) 차이
  △ 실제 실내 조명(역광, 형광등 깜빡임)에 따른 MediaPipe 포즈 신뢰도(confidence)
  △ 모바일 브라우저(iOS WebKit 등)의 백그라운드 탭 전환 시 오디오 컨텍스트 중단 복구
  △ 블루투스 이어폰 등 하드웨어 디바이스에 의한 오디오 출력 레이턴시

[현재 미지원/미구현 영역 (Explicitly Out of Scope)]
  ✗ 브라우저 에디터에서 원격 서버로의 실시간 웹소켓 직접 업로드 (정적 Manifest 파일 배포 원칙)
  ✗ 모바일 기기에서의 피트니스 에디터 저작 모드 (에디터는 데스크톱 크롬 환경 권장)
```

---

## 6. 운영자 및 창작자 사용 가이드 (Runbook)

### 6.1 신규 피트니스 안무 및 콘텐츠 제작 절차
1. 에디터를 열고 원하는 챕터(예: Ch.1 포겟)를 선택합니다.
2. **Phase A 별 수집**: 7개 슬롯의 신체 부위(왼손, 오른손, 발)와 11개 피트니스 존을 설정합니다.
3. **Phase A 오답 장판**: 오답 시 회피할 피트니스 동작(`jump`, `left_step`, `right_step`)을 선택합니다.
4. **Phase B 피버 모드**: 8개 피버 타격 노트의 손 부위 및 존을 480틱 간격에 맞춰 배치합니다.
5. **Phase B 보스 장판**: 보스의 3연속 공격 패턴(`dual_slam`, `alternating_stomp_left`, `alternating_stomp_right`) 순서를 구성합니다.
6. **검증 및 게시**: "검증 및 게시" 버튼을 클릭하여 불변 팩(`PublishedContentPack`)을 생성합니다.

### 6.2 테스트 플레이 및 검증
1. 에디터 상단의 "테스트 플레이" 버튼을 클릭합니다.
2. 주소창에 `?mode=test` 또는 테스트 세션이 활성화된 상태로 게임이 시작됩니다.
3. 10문제를 직접 플레이하여 오답 장판과 별 수집, Phase B 결전 피버 타격이 의도한 대로 동작하는지 확인합니다.
4. **테스트 세션에서는 기존 하이스코어나 진척도가 덮어써지지 않으므로 안심하고 테스트할 수 있습니다.**

### 6.3 정적 배포 및 운영 롤백 절차
1. 에디터에서 "프로젝트 내보내기(Export Backup)"로 JSON 백업을 다운로드합니다.
2. 컴파일된 팩을 정적 웹 서버의 `public/content/ch1-pack-v1.json` 경로에 배치합니다.
3. `public/content/manifest.json` 파일의 `contentHash`와 `packPath`를 갱신합니다.
4. 운영 도중 결함 발견 시 `manifest.json`의 `contentHash`와 `packPath`를 직전 정상본(`history/manifest-*.json`)으로 변경하면 즉시 롤백이 완료됩니다.
