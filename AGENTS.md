# Dream Guardian — AI 에이전트 작업 지침 (AGENTS.md)

이 문서는 모든 opencode 세션이 시작될 때 자동으로 로드되는 공통 지침입니다.
모든 AI 에이전트는 `docs/Dream_Guardian_개발_규칙.md`와 `docs/01_GAME_DESIGN_DOCUMENT.md`의 규칙을 엄격히 준수해야 합니다.

---

## 1. 핵심 개발 철학 (절대 원칙)

1. **작은 단위 개발**: 반드시 승인된 단일 작업 카드([작업 ID]) 단위로 진행한다.
2. **단일 기능 수정**: 한 번에 여러 시스템을 동시에 수정하지 않는다. (예: 스켈레톤 수정 + UI 수정 동시 진행 금지)
3. **기존 정상 동작 보존**: 새 기능을 구현하면서 기존에 정상 작동하는 로직이나 파일 구조를 임의로 리팩터링하거나 변경하지 않는다.
4. **데이터와 코드 분리**: 문제 데이터는 CSV(`questions.csv`, 원본 경로: `E:\AIAIAIAIAI\Arithmetic Game\questions.csv`), 설정값(HP, 데미지, 감도 임계치 등)은 `config/`에서 관리한다.
5. **무조건 테스트 통과 (TDD/자가검증)**: 코드 수정 후 반드시 `dream_guardian` 디렉토리에서 `npm test`를 실행하여 100% 통과(Pass)를 확인해야 한다.
6. **main 브랜치 상시 안정성**: main 브랜치는 언제나 빌드 및 실행 가능한 상태여야 한다.
7. **작업 경계 준수**: 작업 카드에 명시된 [유지 사항]과 [변경 금지] 항목을 엄격히 준수한다.
8. **버그 대응 수칙**:
   - 버그 발견 시 임의 수정 금지
   - GitHub Issue 카드 등록 (원인 분석, 수정 계획)
   - 승인된 범위 내에서만 수정 → 테스트 통과 → 커밋
9. **카드 작업 완료 시 코멘트 필수 (Rule 12)**:
   - 카드 작업이 완료될 때마다 반드시 GitHub Issue 카드에 세부 작업 내역(수정 내용, 변경 파일, 테스트 100% Pass 결과, 완료 조건 체크)을 `gh issue comment`로 등록한다.
10. **승인 작업 완료 후 로컬 서버 가동 필수 (Rule 13)**:
   - 승인된 카드 작업이 완료되면 사용자가 브라우저에서 바로 테스트할 수 있도록 로컬 개발 서버(`npm run dev`)를 가동하고 접속 URL(`http://localhost:3000/`)을 안내한다.

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
  - 4색 커서: 왼손(시안 `#28E6FF`), 오른손(노랑 `#FFCB4D`), 어깨(보라 `#C889FF`), 엉덩이(주황 `#FF865E`)
  - 10개 피트니스 존 중 지정된 존에 1초 체류 시 답 선택 확정
  - 칼로리 공식: `(steps × 0.04) + (squats × 0.35) + (jumps × 0.15)` kcal

---

## 4. 커밋 & 동기화 규칙

- 커밋 메시지는 컨벤션 준수: `feat(레이어):`, `fix(레이어):`, `test:`, `refactor:` 등
- 커밋 전 반드시 테스트 실행: `npm test` (전체 통과 필수)
- 완료 후 `HANDOVER.md`에 진행 상태와 다음 작업 대상 명시
