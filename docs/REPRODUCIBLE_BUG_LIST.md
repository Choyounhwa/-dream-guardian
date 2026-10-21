# 🐛 Dream Guardian — 재현 가능한 버그 리스트 (Reproducible Bug List)

본 문서는 《꿈의 수호신 (Dream Guardian)》 프로젝트에서 확인된 **재현 가능한 버그 목록**을 체계적으로 관리하기 위한 문서입니다.  
프로젝트 개발 규칙(`docs/Dream_Guardian_개발_규칙.md`)의 제10항 및 제18항(버그 처리 규칙)에 따라, 재현 절차, 현재 결과, 기대 결과, 원인 분석, 수정 대상 파일 및 테스트 방안을 기술합니다.

---

## 1. 버그 현황 요약 (Overview)

### 1.1 미해결 재현 가능 버그 (OPEN)

| 이슈 번호 | 버그 ID | 우선순위 | 영역 | 결함 요약 | 상태 |
|:---:|:---:|:---:|:---:|:---|:---:|
| [#556](https://github.com/Choyounhwa/-dream-guardian/issues/556) | `BUG-UI-EDITOR-008` | **P0-Critical** | UI Editor | 미리보기 snapshot payload가 빈 객체로 전송되어 속성 편집이 미리보기에 미반영 | OPEN |
| [#557](https://github.com/Choyounhwa/-dream-guardian/issues/557) | `BUG-UI-EDITOR-009` | **P0-Critical** | UI Editor | 브라우저 진입점에서 `UISelectionOverlay` 미생성으로 캔버스 클릭 선택·드래그 불가 | OPEN |
| [#558](https://github.com/Choyounhwa/-dream-guardian/issues/558) | `BUG-UI-EDITOR-010` | **P1-High** | UI Editor | 미리보기 캔버스에서 조작한 결과가 에디터 상태로 역방향 동기화되지 않음 | OPEN |
| [#559](https://github.com/Choyounhwa/-dream-guardian/issues/559) | `BUG-UI-EDITOR-011` | **P2-Medium** | UI Editor | 정상 미리보기 응답이 상태줄에 "미리보기 거부: stale-document"로 오표시됨 | OPEN |
| [#560](https://github.com/Choyounhwa/-dream-guardian/issues/560) | `BUG-UI-EDITOR-012` | **P1-High** | UI Editor | 에디터 기본 문서의 페이지별 요소 구성이 실제 게임 화면(Ch.1~5 등)과 불일치 | OPEN |

---

## 2. 미해결 버그 상세 명세 (Open Issues)

### 2.1 [BUG-UI-EDITOR-008 / #556] 미리보기 snapshot payload 빈 객체 전송 결함

- **우선순위**: P0 - Critical
- **영향 범위**: UI 비주얼 에디터 속성 편집 및 실시간 미리보기 렌더링
- **선행 조건**: #555 완료 (완료됨)

#### 재현 절차
1. 로컬 개발 서버 실행 후 브라우저에서 `http://localhost:3000/ui-editor.html` 접속
2. 좌측 요소 목록에서 `card-story` 선택
3. 우측 속성 패널에서 X 좌표를 `400`으로 변경
4. 중앙 미리보기 캔버스 변화 확인

#### 현재 결과 (결함 현상)
- 툴바 상태는 `rev 1 (수정됨)`으로 갱신되지만, 미리보기 캔버스의 픽셀이 변경 전과 완전히 동일함 (변경 미반영).
- 브리지 전송 메시지를 디버깅하면 `preview:snapshot`의 `payload`가 `{}` (빈 객체)로 전송됨.

#### 기대 결과 (정상 작동)
- 속성 값을 변경하면 편집 중인 문서 데이터가 snapshot payload에 포함되어 iframe 브리지로 전달되어야 함.
- 미리보기 캔버스에 변경된 좌표(X: 400) 및 크기가 즉시 다시 렌더링되어야 함.

#### 원인 분석
1. `dream_guardian/src/editor/ui/view/UIShellView.ts`의 `mountPreviewFrame` 호출 시 `getSnapshot` 옵션이 전달되지 않음.
2. 이로 인해 `dream_guardian/src/editor/ui/view/UIPreviewFrameView.ts` 내부의 기본값 `{}`가 브리지 메시지로 발송됨.
3. 미리보기 어댑터는 에디터 문서(`menu_main`, `card-story`)와 게임 포맷(`pages.main_home.elements`) 간 변환 레이어가 부재하여 고정 fixture로만 렌더링함.

#### 수정 대상 파일
- `dream_guardian/src/editor/ui/data/UIVisualPreviewSnapshot.ts` (신규 변환 유틸)
- `dream_guardian/src/editor/ui/view/UIShellView.ts`
- `dream_guardian/src/editor/ui/view/UIPreviewFrameView.ts`

#### 검증 및 테스트 방법
- 단위 테스트: `dream_guardian/tests/unit/bug-ui-editor-008.test.ts`
- 비어 있지 않은 유효한 snapshot payload 생성 및 브리지 전송 검증

---

### 2.2 [BUG-UI-EDITOR-009 / #557] 브라우저 진입점 UISelectionOverlay 미생성 결함

- **우선순위**: P0 - Critical
- **영향 범위**: UI 비주얼 에디터 캔버스 마우스 인터랙션 (선택, 드래그, 리사이즈)
- **선행 조건**: BUG-UI-EDITOR-008 완료

#### 재현 절차
1. `http://localhost:3000/ui-editor.html` 접속
2. 중앙 미리보기 캔버스에 렌더링된 임의의 메뉴 카드 또는 버튼 위를 마우스로 클릭하거나 드래그

#### 현재 결과 (결함 현상)
- 요소에 선택 테두리나 조절 핸들이 표시되지 않으며 드래그 이동이 불가능함.
- iframe 내부 DOM 검사 시 렌더링 캔버스 1개만 존재하며, 이벤트 수신용 오버레이 캔버스(`UISelectionOverlay`)와 pointer 리스너가 등록되어 있지 않음.

#### 기대 결과 (정상 작동)
- 캔버스 내 요소를 클릭하면 선택 테두리와 크기 조절 핸들이 활성화되어야 함.
- 마우스 드래그로 위치 이동 및 핸들 조작을 통한 크기 조절이 가능해야 함.

#### 원인 분석
- `dream_guardian/src/editor/ui/preview/main.ts`의 실제 브라우저 진입 함수 `initPreviewApp`에서 `mountPreviewCanvas`만 호출하고 `UISelectionOverlay`를 인스턴스화하지 않음 (`createPreviewEntry` 테스트 헬퍼에만 존재).

#### 수정 대상 파일
- `dream_guardian/src/editor/ui/preview/main.ts`

#### 검증 및 테스트 방법
- 단위 테스트: `dream_guardian/tests/unit/bug-ui-editor-009.test.ts`
- `initPreviewApp` 호출 후 오버레이 캔버스 생성 및 pointer 이벤트 리스너 등록 검증

---

### 2.3 [BUG-UI-EDITOR-010 / #558] 미리보기 → 에디터 역방향 동기화 부재 결함

- **우선순위**: P1 - High
- **영향 범위**: 캔버스 직접 조작 결과의 에디터 상태(선택, 속성, Undo/Redo) 반영
- **선행 조건**: BUG-UI-EDITOR-009 완료

#### 재현 절차
1. 캔버스 오버레이 활성화 상태에서 임의 요소를 클릭하거나 드래그 이동
2. 좌측 요소 목록의 선택 상태, 우측 속성 패널의 좌표 수치, 툴바의 Undo 이력 확인

#### 현재 결과 (결함 현상)
- 캔버스에서 드래그하여 위치를 옮겨도 에디터 좌측 요소 목록과 우측 속성 패널의 수치가 갱신되지 않으며 Undo 스택에 기록되지 않음.

#### 원인 분석
1. `UIShellView.ts`에서 `previewFrame.handlePreviewMessage`를 동적으로 덮어쓰려 했으나, 브리지 내부 클로저가 원래 함수를 직접 호출하여 오버라이드가 무효화됨.
2. 이벤트 페이로드 키 불일치: 오버레이는 `selectedElementIds`를 전송하지만 셸은 `elementId`를 수신 대기.
3. 수신된 `preview:geometry` 메시지를 `handleVisualCommit`으로 전달하는 파이프라인 누락.

#### 수정 대상 파일
- `dream_guardian/src/editor/ui/view/UIPreviewFrameView.ts`
- `dream_guardian/src/editor/ui/view/UIShellView.ts`

#### 검증 및 테스트 방법
- 단위 테스트: `dream_guardian/tests/unit/bug-ui-editor-010.test.ts`
- selection/geometry 메시지 수신 시 셸 속성 패널 값 갱신 및 Undo 복원 검증

---

### 2.4 [BUG-UI-EDITOR-011 / #559] 정상 미리보기 응답의 stale-document 오표시 결함

- **우선순위**: P2 - Medium
- **영향 범위**: UI 에디터 하단 상태 표시줄 및 사용자 피드백

#### 재현 절차
1. `http://localhost:3000/ui-editor.html` 접속
2. 미리보기 영역 하단 상태 표시줄 확인

#### 현재 결과 (결함 현상)
- 미리보기 렌더링이 성공(`{ ok: true, drew: true }`)했음에도 불구하고 상태줄에 `"미리보기 거부: stale-document"` 경고가 출력됨.

#### 기대 결과 (정상 작동)
- 정상 응답 시 `"미리보기 반영 완료"`가 표시되어야 하며, 실제로 오래된 문서나 이전 generation 응답일 때만 거부로 분류되어야 함.

#### 원인 분석
- `dream_guardian/src/editor/ui/UIPreviewHost.ts`에서 generation 정보가 없을 때 요청마다 새로 발급되는 고유 `requestId`를 엄격 비교하여, 브리지 통신 후 반환된 유효 응답을 stale로 잘못 판정함.

#### 수정 대상 파일
- `dream_guardian/src/editor/ui/UIPreviewHost.ts`
- `dream_guardian/src/editor/ui/view/UIPreviewFrameView.ts`

#### 검증 및 테스트 방법
- 단위 테스트: `dream_guardian/tests/unit/bug-ui-editor-011.test.ts`
- 동일 세대/문서 응답에 대한 applied 플래그 검증

---

### 2.5 [BUG-UI-EDITOR-012 / #560] 에디터 기본 문서와 실제 게임 렌더러 간 요소 불일치

- **우선순위**: P1 - High
- **영향 범위**: 에디터 내 10개 화면 전체의 기본 요소 목록 및 시각적 일치성
- **선행 조건**: #553 완료

#### 재현 절차
1. `http://localhost:3000/ui-editor.html` 접속 후 "1. 메인 홈 메뉴" 선택
2. 좌측 요소 목록과 중앙 미리보기 캔버스 화면 비교

#### 현재 결과 (결함 현상)
- 좌측 목록: 구 기획 모델 기준(스토리 모드, 일반 플레이, 기록 모드 등 카드 5종)
- 실제 캔버스: 현재 게임 렌더러 기준(Ch.1~Ch.5 챕터 카드, 운동 모드 라벨, 설정 버튼 등)
- 목록의 항목을 클릭해도 캔버스의 실제 요소와 매칭되지 않아 하이라이트 및 조작 불가.

#### 기대 결과 (정상 작동)
- 에디터 기본 문서의 요소 목록과 ID가 게임 런타임 렌더러의 실제 렌더링 요소와 1:1로 일치해야 함.

#### 원인 분석
- `UIVisualDocument.ts`의 `createDefaultUIVisualDocument()`가 프로젝트 초기 기획 데이터를 그대로 유지하고 있어 현행 게임 렌더러 구조와 괴리 발생.

#### 수정 대상 파일
- `dream_guardian/src/editor/ui/data/UIVisualDocument.ts`
- `dream_guardian/src/editor/ui/data/UIScreenRegistry.ts`

#### 검증 및 테스트 방법
- 단위 테스트: `dream_guardian/tests/unit/bug-ui-editor-012.test.ts`
- 10개 페이지별 기본 문서 요소 ID와 어댑터 renderedBounds ID의 일치성 검증

---

## 3. 최근 해결된 주요 재현 버그 기록 (Resolved History)

| 이슈 번호 | 버그 ID | 핵심 수정 내용 | 검증 결과 | 커밋 해시 |
|:---:|:---:|:---|:---:|:---:|
| [#587](https://github.com/Choyounhwa/-dream-guardian/issues/587) | `BUG-ASSAULT-BOOT` | 보스 어설트 모드 초기 부팅 시 화면 렌더링 3중 결함 수정 (씬 루프/뷰포트/상태 전환) | TDD 100% Pass | `999793f` |
| [#586](https://github.com/Choyounhwa/-dream-guardian/issues/586) | `BUG-DEVUI-002` | Dev UI 패널 대메뉴 및 설정 모달 마우스 오버 시 캔버스 하이라이트 미표시 수정 | TDD 100% Pass | `428679f` |
| [#585](https://github.com/Choyounhwa/-dream-guardian/issues/585) | `BUG-DEVUI-001` | Dev UI 레이아웃 재내보내기 시 기존 ui-layout.json 누락 및 덮어쓰기 버그 수정 | TDD 100% Pass | `e97105a` |
| [#615](https://github.com/Choyounhwa/-dream-guardian/issues/615) | `BUG-AVATAR-003` | 졸라맨(Stickman) 가상 해상도(1080) 정규화 불일치 및 가로 앵커 편향 결함 수정 | TDD 100% Pass | `829eeb1` |
| [#555](https://github.com/Choyounhwa/-dream-guardian/issues/555) | `BUG-UI-EDITOR-007` | 미리보기 모듈 순환 import TDZ(Temporal Dead Zone) ReferenceError 수정 | TDD 100% Pass | `64585c4` |
| [#553](https://github.com/Choyounhwa/-dream-guardian/issues/553) | `BUG-UI-EDITOR-006` | 에디터 요소 ID와 게임 렌더러 매칭 ID 불일치 및 BottomBar 중복 매칭 수정 | TDD 100% Pass | `d0a13ef` |

---

## 4. 버그 대응 및 수정 수칙 (Rules 10 & 18)

1. **임의 수정 금지**: 버그 발견 시 소스 코드를 임의로 수정하지 않고 본 문서 또는 GitHub Issue에 재현 절차와 원인을 명시합니다.
2. **사전 승인 원칙**: 수정 계획 및 대상 파일 범위에 대해 승인을 득한 후 작업에 착수합니다.
3. **TDD 5단계 준수**:
   - `Step 1`: 기존 전체 테스트 100% Pass 확인
   - `Step 2 (Red)`: 버그를 명확히 재현하는 단위 테스트 선작성 및 실패 확인
   - `Step 3 (Green)`: 버그 해결을 위한 최소 구현 작성 및 통과 확인
   - `Step 4 (Refactor)`: `npm run build` 및 전체 회귀 테스트 검증 (회귀 결함 0건)
   - `Step 5 (Commit)`: `fix(영역): [BUG-XXX] ...` 규격 커밋 및 `gh issue comment` 등록
4. **가드레일 준수**: 단일 소스 파일 1,000줄 초과 금지 및 중복 코드 작성 금지(DRY 원칙)를 엄격히 준수합니다.
