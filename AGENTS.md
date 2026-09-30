# Dream Guardian — AI 에이전트 작업 지침 (AGENTS.md)

이 문서는 모든 opencode 세션이 시작될 때 자동으로 로드되는 공통 지침입니다.
모든 AI 에이전트는 `docs/Dream_Guardian_개발_규칙.md`와 `docs/01_GAME_DESIGN_DOCUMENT.md`의 규칙을 엄격히 준수해야 합니다.

---

## 1. 핵심 개발 철학 (절대 원칙)

1. **작은 단위 개발**: 반드시 승인된 단일 작업 카드([작업 ID]) 단위로 진행한다.
2. **단일 기능 수정**: 한 번에 여러 시스템을 동시에 수정하지 않는다. (예: 스켈레톤 수정 + UI 수정 동시 진행 금지)
3. **기존 정상 동작 보존**: 새 기능을 구현하면서 기존에 정상 작동하는 로직이나 파일 구조를 임의로 리팩터링하거나 변경하지 않는다.
4. **데이터와 코드 분리**: 문제 데이터는 CSV(`questions.csv`, 원본 경로: `E:\AIAIAIAIAI\Arithmetic Game\questions.csv`), 설정값(HP, 데미지, 감도 임계치 등)은 `config/`에서 관리한다.
5. **TDD(테스트 주도 개발) 필수 준수**: 모든 기능 구현 및 수정은 **테스트 선작성(Red) → 최소 구현(Green) → 리팩터링 및 전체 검증(Refactor)**의 TDD 사이클을 엄격히 따른다. 테스트 코드 없이 기능 코드부터 작성하는 행위를 일체 금지하며, 작업 완료 후 전체 단위 테스트 100% 통과(Pass)를 필수로 확인해야 한다.
6. **main 브랜치 상시 안정성**: main 브랜치는 언제나 빌드 및 실행 가능한 상태여야 한다.
7. **작업 경계 준수**: 작업 카드에 명시된 [유지 사항]과 [변경 금지] 항목을 엄격히 준수한다.
8. **버그 대응 수칙**:
   - 버그 발견 시 임의 수정 금지
   - GitHub Issue 카드 등록 (원인 분석, 수정 계획)
   - 승인된 범위 내에서만 수정 → TDD 사이클(테스트 선작성 → 구현 → 통과) → 커밋
9. **카드 작업 완료 시 코멘트 필수 (Rule 12)**:
   - 카드 작업이 완료될 때마다 반드시 GitHub Issue 카드에 세부 작업 내역(수정 내용, 변경 파일, TDD 테스트 100% Pass 결과, 완료 조건 체크)을 `gh issue comment`로 등록한다.
10. **승인 작업 완료 후 로컬 서버 가동 필수 (Rule 13)**:
   - 승인된 카드 작업이 완료되면 사용자가 브라우저에서 바로 테스트할 수 있도록 로컬 개발 서버(`npm run dev`)를 가동하고 접속 URL(`http://localhost:3000/`)을 안내한다.

---

## 1.1 TDD(테스트 주도 개발) 표준 작업 사이클 (모든 세션 의무 순서)

모든 작업 카드([작업 ID])는 반드시 아래 5단계 순서대로 진행해야 합니다.

```text
[Step 1: Baseline Check]
  작업 시작 전 dream_guardian에서 `npm test`를 실행하여 기존 테스트 100% Pass 상태 확인
      ↓
[Step 2: Red — 테스트 선작성]
  카드 완료 조건 및 요구사항에 맞춰 `tests/unit/`에 실패하는 테스트 케이스 우선 작성
  `npm test -- <대상테스트파일>` 실행 → 실패(Red) 발생 확인
      ↓
[Step 3: Green — 최소 코드 구현]
  테스트를 통과하기 위한 최소한의 프로덕션 코드만 해당 레이어에 구현
  `npm test -- <대상테스트파일>` 실행 → 통과(Green, 100% Pass) 확인
      ↓
[Step 4: Refactor & 회귀 검증]
  코드 정리, 가독성/타입 안정성 개선
  `npm run build` (tsc 타입 체크 및 번들 검증)
  `npm test` (전체 테스트 슈트 실행하여 다른 레이어 회귀 버그 0건 확인)
      ↓
[Step 5: 완료 기록 및 커밋]
  Git commit (규격 메시지) → GitHub Issue comment 등록 (`gh issue comment`)
```

---

## 1.2 세션 자동 인계 및 로드맵 진행 규칙 (Roadmap & One-Word Handover)

1. **단일 진실 공급원(SSOT)**:
   - 진행 중인 전체 작업 순서는 `dream_guardian/HANDOVER.md` 최상단의 `## 🧭 11단계 로드맵 진행 현황 (SSOT)` 표를 절대적 기준으로 삼는다.
2. **원키(One-Word) 인계 규약**:
   - 사용자가 `"다음"`, `"진행"`, `"next"`, `"시작"`을 입력하거나 별도 작업 ID 없이 프롬프트를 시작할 때, 에이전트는 로드맵 표에서 `[▶ NEXT]` 표시가 붙은 카드를 자동으로 읽는다.
   - 해당 카드의 **작업 목적, 수정 대상, TDD 검증 계획**을 3~5줄로 간결히 브리핑하고 승인을 요청한다 (`"이 작업을 시작할까요? (Y/N)"`).
   - 사용자가 승인하면 즉시 Step 1~5 TDD 사이클을 실행한다.
3. **카드 완료 후 연속 진행(Chaining) 규칙**:
   - 카드 작업 완료(TDD 100% Pass, build 성공) 후 Rule 12(이슈 코멘트)와 Rule 13(로컬 개발 서버 안내)을 완료한다.
   - `HANDOVER.md` 최상단 로드맵 표에서 완료된 카드를 `[✔]`로 바꾸고, 다음 순서의 카드를 `[▶ NEXT]`로 전진시킨다.
   - 세션 응답 마지막에 항상 다음 안내를 출력하여 세션을 종료하지 않고도 즉시 이어서 진행할 수 있도록 한다:
     > **"다음 작업 대상: [#xxx 카드명] 입니다. 바로 진행할까요? ('다음' 또는 'Y' 입력)"**

---

## 2. 프로젝트 아키텍처 및 책임 분리

모든 코드는 `dream_guardian/src/` 아래 지정된 레이어에 배치되어야 합니다.

| 레이어 | 위치 | 주요 책임 |
|---|---|---|
| **Core** | `src/core/` | GameEngine(루프/델타타임), StateMachine(상태 전환), EventBus(이벤트 중계), Config |
| **Render** | `src/render/` | CanvasManager(캔버스 계층 분리), CameraLayer(웹캠 입력) |
| **Motion** | `src/motion/` | PoseManager, HandsManager, Run/Squat/JumpDetector, CalibrationHelper |
| **Skeleton** | `src/skeleton/` | SkeletonAnimation, JointRenderer, BoneRenderer (시각 효과와 위치 분리) |
| **Question** | `src/question/` | CSVLoader, QuestionBank, QuestionEvaluator(safeEval 보안 검증), QuestionSpeech(TTS) |
| **Battle** | `src/game/` | BattleState, BossController, GuardianSystem (플레이어/보스 HP, 마나, 콤보) |
| **Input** | `src/input/` | MenuInput, AnswerSelector (10개 피트니스 존, 4색 신체 커서 판정) |
| **UI** | `src/ui/` | MenuRenderer, HUDLayer, ResultRenderer (로직 계산 없이 상태 표시만 담당) |
| **Tests** | `tests/unit/` | Vitest 기반 단위/통합 테스트 슈트 |

---

## 3. 게임 디자인 핵심 스펙 (GDD 요약)

- **장르/컨셉**: 웹캠 기반 체감형 피트니스 수학 RPG (링 피트 어드벤처 스타일)
- **챕터 및 보스**:
  - Ch.1 포겟 (덧셈/뺄셈, 보스 HP 10)
  - Ch.2 후다닥 (곱셈/나눗셈, 보스 HP 10)
  - Ch.3 뒤죽박죽 (분수, 보스 HP 10)
  - Ch.4 에라 (소수, 보스 HP 10)
  - Ch.5 나이트메어 (전 영역 종합, 보스 HP 20)
- **전투 밸런스**:
  - 플레이어 HP: 100 (오답 시 -25, 보스 공격 시 -15)
  - 정답 시 마나: +25 (마나 100 도달 시 수호신 스펠 자동 시전 → 보스 HP -4)
- **모션 & 답 선택**:
  - 4색 커서: 왼손(시안 `#28E6FF`), 오른손(노랑 `#FFCB4D`), 머리/얼굴(보라 `#C889FF`), 골반/엉덩이(주황 `#FF865E`)
  - 11개 피트니스 존 겹침 0% 레이아웃 및 집합 덮기(Set Coverage: 조건 A & 조건 B) 기반 답 선택 확정
  - 커서 허용: 왼손/오른손 전 존(1~11), 머리(4, 5 - 점프 유지불가 1~3 제외), 골반(6~11), Cross-Body 제약(골반 9~11 시 손 1~3 불가)
  - 가이드 시스템: 목표 자세 실루엣 가이드 오버레이 및 첫 문제 유도 화살표
  - 칼로리 공식: `(steps × 0.04) + (squats × 0.35) + (jumps × 0.15) + (dwellTime × 0.07)` kcal

---

## 4. 커밋 & 동기화 규칙

- 커밋 메시지는 컨벤션 준수: `feat(레이어):`, `fix(레이어):`, `test:`, `refactor:` 등
- 커밋 전 반드시 테스트 실행: `npm test` (전체 통과 필수)
- 완료 후 `HANDOVER.md`에 진행 상태와 다음 작업 대상 명시
