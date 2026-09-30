# 꿈의 수호신 프로젝트 보드

이 문서는 GitHub Projects, Trello 또는 Notion으로 옮길 수 있는 로컬 작업 보드다.
카드는 작은 단위로 유지하고, 한 번에 `In Progress` 카드는 하나만 둔다.

## 보드 사용 규칙

- 새 요청이나 아이디어는 먼저 `Inbox`에 한 줄로 추가한다.
- 작업을 시작할 수 있을 만큼 재현 방법과 완료 조건이 정리되면 `Ready`로 옮긴다.
- 실제 코드를 수정하는 동안에만 `In Progress`에 둔다.
- PC와 실제 iPhone에서 확인할 항목은 `Device Test`로 옮긴다.
- 완료 조건과 테스트가 모두 충족된 카드만 `Achieved`로 옮긴다.
- 카드 하나를 완료할 때마다 관련 변경만 묶어 Git 커밋 하나를 만든다.

## 카드 양식

```text
### [우선순위] 카드 제목
- 분야: Bug | Motion | Camera | UI | Game Loop | Balance | Docs
- 재현 방법:
- 기대 결과:
- 실제 결과:
- 완료 조건:
- 확인 환경: PC Chrome | iPhone Safari | Android Chrome
- 관련 파일:
- 관련 커밋:
```

---

## Inbox

### [Medium] 플레이 중 불편하거나 이상한 동작 기록
- 분야: Bug
- 재현 방법: 플레이 중 발견 즉시 기기, 브라우저, 동작, 화면 상태를 기록한다.
- 완료 조건: 재현 가능한 카드로 분리하여 `Ready`로 이동한다.
- 확인 환경: PC Chrome | iPhone Safari

### [Low] 게임 연출 및 콘텐츠 아이디어 수집
- 분야: UI
- 완료 조건: 구현 가치와 우선순위를 정해 별도 카드로 분리한다.

---

## Ready

### [P1-High] [FEAT-SKEL-005] 화면 중앙 2/3 높이 메카 졸라맨(Mecha Stickman) 실시간 모션 아바타 구현 (Issue #203)
- GitHub URL: https://github.com/Choyounhwa/-dream-guardian/issues/203
- 분야: Skeleton / Render / UI
- 목적: 앙상한 스켈레톤(선과 점) 노출을 대체하여 화면 중앙 2/3 높이(y ≈ 0.60 ~ 0.85)에 도톰한 네온 캡슐과 관절 볼을 가진 세련된 메카 졸라맨(Mecha Stickman) 아바타를 배치하고, 인체 비율 고정 순운동학(Fixed-Length FK)을 통해 유저의 자세를 왜곡 없이 부드럽게 미러링한다.
- 수정 대상: `dream_guardian/config/skeleton.config.ts`, `dream_guardian/src/skeleton/StickmanRenderer.ts`, `dream_guardian/src/skeleton/index.ts`, `dream_guardian/src/main.ts`, `dream_guardian/src/ui/SettingsModal.ts`, `dream_guardian/tests/unit/stickman-renderer.test.ts`
- 완료 조건:
  - [ ] `config/skeleton.config.ts`에 메카 졸라맨 크기/비율/색상 정의 완료
  - [ ] `StickmanRenderer`가 인체 고정 비례와 회전 각도를 계산하여 둥근 캡슐 및 바이저를 정상 렌더링함
  - [ ] 신체 부위 왜곡(팔다리 늘어남/줄어듦) 없이 부드러운 자세 미러링 동작
  - [ ] 화면 중앙 2/3 높이에 안정적으로 배치되어 UI 및 피트니스 존과 자연스럽게 조화됨
  - [ ] `npm test` 단위 테스트 100% Pass 및 빌드 무결성 확인
- 확인 환경: PC Chrome | iPhone Safari | 로컬 개발 서버 (`http://localhost:3000/`)
- 관련 파일: `dream_guardian/src/skeleton/StickmanRenderer.ts`, `dream_guardian/src/main.ts`, `dream_guardian/tests/unit/stickman-renderer.test.ts`

### [P1-High] [RUN-LOOP-001] 제자리 달리기 페이즈 인게임 루프 연동 및 드림 그리드 동적 반응 구현 (Issue #112)
- GitHub URL: https://github.com/Choyounhwa/-dream-guardian/issues/112
- 분야: Motion / Game Loop / Render
- 목적: 문제 출제 전 제자리 달리기(RunDetector 바운스 또는 Space 입력)로 게이지를 0→100% 충전하여 다음 문제로 진입하는 게임 루프를 확립하고, 달리기 속도에 따른 드림 그리드 스크롤 가속 및 피버(75% 이상) 시 파란색 보간 전환 연출 완성.
- 수정 대상: `dream_guardian/src/motion/RunDetector.ts`, `dream_guardian/src/render/DreamGrid.ts`, `dream_guardian/src/main.ts`, `dream_guardian/tests/unit/motion-detectors.test.ts`
- 완료 조건:
  - [ ] 제자리 달리기 바운스 및 Space 연타로 게이지가 상승하고 100% 도달 시 문제 출제 상태로 전환
  - [ ] 달리기 속도에 비례해 드림 그리드 스크롤이 가속되고 테마 색상 → 주황 → 파랑(피버)으로 자연스럽게 전환
  - [ ] `npm test` 100% 통과 및 `npm run build` 번들링 0 에러
- 확인 환경: PC Chrome | iPhone Safari
- 관련 파일: `dream_guardian/src/main.ts`, `dream_guardian/src/render/DreamGrid.ts`, `dream_guardian/src/motion/RunDetector.ts`

### [P1-High] [FEAT-001 / BUG-003] 각 단계별 세부 난이도(SubLevel) 필터링 및 Ch.5 나이트메어 Level 5~9 매핑 (Issue #103, #106)
- GitHub URL: https://github.com/Choyounhwa/-dream-guardian/issues/103 / https://github.com/Choyounhwa/-dream-guardian/issues/106
- 분야: Question / Gameplay
- 목적: `questions.csv`의 SubLevel(1~7)을 활용하여 각 챕터별 세부 난이도 필터링을 지원하고, Ch.5(나이트메어)에서 5~9단계(거듭제곱, 2진수, 도형, 비율, 기타)를 세부 단계(SubLevel 1~5)로 선택하여 집중 학습할 수 있도록 확장 (SubLevel 6/미지정은 전 영역 종합 풀).
- 수정 대상: `dream_guardian/src/question/QuestionBank.ts`, `dream_guardian/src/types/index.ts`, `dream_guardian/tests/unit/question-system.test.ts`
- 완료 조건:
  - [ ] `setLevel(1, 2)` 호출 시 Ch.1 두자리 덧뺄셈(Level 1, SubLevel 2) 문제만 필터링 반환
  - [ ] `setLevel(5, 1~5)` 호출 시 Level 5~9의 문제가 정상 반환
  - [ ] `setLevel(5)` 또는 `setLevel(5, 6)` 호출 시 Level 1~9 전 영역 풀 종합 반환
  - [ ] `getSubLevels(chapter)`가 각 챕터의 세부 단계 메타데이터를 올바르게 반환
  - [ ] `npm test` 100% 통과 (Pass)
- 확인 환경: Vitest 단위 테스트 슈트
- 관련 파일: `dream_guardian/src/question/QuestionBank.ts`, `dream_guardian/src/types/index.ts`, `dream_guardian/tests/unit/question-system.test.ts`

### [P1-High] [FEAT-002] 10개 피트니스 존 4색 커서(머리 반영) 및 스테이지 점증 난이도(Tier 1~4) 구현 (Issue #105)
- GitHub URL: https://github.com/Choyounhwa/-dream-guardian/issues/105
- 분야: Motion / Input / UI
- 목적: 국민체조 기반 10개 피트니스 존 및 4색 신체 커서 체계를 확립하고, 어깨 커서를 카메라 인식 안정성이 높은 머리/얼굴(`head`) 커서로 수정하며, 스테이지 진행도(10~15문제)에 맞춘 점증적 난이도 곡선(Tier 1~4)을 구현.
- 핵심 사양:
  - 4색 커서: 왼손(시안), 오른손(노랑), 머리/얼굴(보라 - 코 중심 Landmark 0), 골반(주황 - Landmark 23,24)
  - 스테이지 점증 난이도:
    - Tier 1 (문제 1~3 / 웜업): 단일 손, 체류 0.7초 (가벼운 팔 뻗기)
    - Tier 2 (문제 4~7 / 체간 스트레칭): 머리 기울이기 또는 양손 벌리기, 체류 0.8초
    - Tier 3 (문제 8~11 / 전신 협응): 손+골반(미니 스쿼트) 또는 머리+골반, 체류 1.0초
    - Tier 4 (문제 12+ / 보스 피니시): 양손 상단 만세 포즈, 체류 1.2초
  - 인지 밸런스: 복합 계산/긴 문제는 Tier 1~2 자동 완화, 3연속 하체(골반) 쿨다운 제한
- 수정 대상: `dream_guardian/src/input/AnswerSelector.ts`, `dream_guardian/src/types/index.ts`, `dream_guardian/tests/unit/input-system.test.ts`
- 완료 조건:
  - [ ] 4색 커서 체계(왼손, 오른손, 머리, 골반) 정상 동작 및 10존 매핑 준수
  - [ ] 문제 번호 1~3번은 단일 손(0.7초), 4~7번은 머리/양손(0.8초), 8~11번은 전신(1.0초), 12+번은 만세(1.2초) 적용
  - [ ] `npm test` 100% 통과
- 확인 환경: PC Chrome | iPhone Safari
- 관련 파일: `dream_guardian/src/input/AnswerSelector.ts`, `dream_guardian/src/types/index.ts`, `dream_guardian/tests/unit/input-system.test.ts`

### [P0-Critical] [PLAN-001] 카메라 트래킹 기반 4색 커서 답안 선택 시스템 통합 구현 (Issue #104)
- GitHub URL: https://github.com/Choyounhwa/-dream-guardian/issues/104
- 분야: Vision / Input / Game Loop
- 목적: `ANSWER_SELECTION_DESIGN.md` 및 최신 피트니스 사양에 따른 카메라 기반 4색 신체 커서 답안 선택 시스템을 6단계 서브태스크로 분할 연동.
- 6단계 서브태스크:
  1. CursorTracker: PoseManager/HandsManager 연동 4색 커서 좌표 추출
  2. ZoneManager & AnswerSelector: 10존 레이아웃 및 동적 체류 판정
  3. RecipeGenerator: 문제 번호별 점증 난이도 레시피 생성 (좌/우 색상 비공유 보장)
  4. DeadlockGuard: 양쪽 동시 충족 방지 및 즉시 리셋
  5. AnswerSelectionRenderer: 활성 존 테두리/펄스 및 커서 HUD 시각화
  6. Integrator: main.ts 게임 루프 연동 (키보드 1/2 및 클릭 fallback 완벽 유지)
- 완료 조건:
  - [ ] 머리/얼굴(head) 및 손바닥 커서 트래킹 무결성 검증
  - [ ] 스테이지 문제 번호에 따른 점증 난이도 및 체류시간 전환 검증
  - [ ] 카메라 ON 환경에서 4색 커서로 답안 선택 및 보스전 진행 정상 동작
  - [ ] 카메라 OFF 환경에서 키보드(1/2) 및 클릭 선택 100% 정상 동작
  - [ ] `npm test` 100% 통과
- 확인 환경: PC Chrome | iPhone Safari | Android Chrome
- 관련 파일: `dream_guardian/src/main.ts`, `dream_guardian/src/input/AnswerSelector.ts`, `dream_guardian/src/motion/PoseManager.ts`

---

## In Progress

카드를 작업 시작 시 이곳으로 옮긴다. 동시에 한 장만 유지한다.

---

## Device Test

코드 수정과 자동 테스트가 끝난 카드를 실기기 확인 전까지 이곳에 둔다.

- [ ] iPhone HTTPS 환경에서 웹캠 권한, MediaPipe Pose/Hands 인식, 4색 커서 1~2m 거리 실측
- [ ] 모바일 터치 및 18:9 레터박스 실기기 렌더링 확인

---

## Blocked

외부 조건이나 결정이 필요한 카드를 둔다. 막힌 이유와 다음 행동을 반드시 쓴다.

---

## Achieved

### [Done] [RENDER-003] 드림 그리드 소실점 페이드 및 투명도 30% 개선 (Issue #111)
- 분야: Render / Visual
- 관련 커밋: `d39c5bb`
- 완료 내용: 그리드 소실점 부근 날카로운 집중 현상을 중앙부 너머로 자연스럽게 페이드아웃 보정, 기본 투명도 30% 설정 완료.

### [Done] [RENDER-002] 게임 화면 18:9 고정 종횡비 뷰포트 및 캔버스 스케일링 동기화 (Issue #109)
- 분야: UI / Render
- 관련 커밋: `3cea53c`
- 완료 내용: 18:9 (2160x1080) 가상 해상도 일원화, CSS `aspect-ratio: 9/18` 레터박스/필러박스 완벽 보장.

### [Done] [BUG-005 / BUG-006] PoseManager 프레임 전송 및 미러링 스켈레톤 인게임 렌더 파이프라인 연동 (Issue #108, #110)
- 분야: Vision / Render
- 관련 커밋: `3cea53c`
- 완료 내용: 비디오 로드 시 자동 카메라 시작, 미러링 플래그 동기화로 스켈레톤 좌우 반전 완벽 일치.

### [Done] [CLEANUP] 루트 레거시 파일 정리 및 프로젝트 보드 동기화
- 분야: Maintenance / Docs
- 관련 커밋: `fe51ffc`
- 완료 내용: 루트의 구버전 연금술 게임 파일 및 임시 산출물 완전 삭제, 독립 경로 확립.

### [Done] Git 초기 스냅샷 생성
- 분야: Docs
- 관련 커밋: `46c6a84`
- 완료 내용: `chore: initial snapshot of dream guardian project` 커밋 생성 완료.

---

## 매 작업의 Git 절차

```powershell
# 1. 보드에서 카드 하나를 In Progress로 옮긴다.
# 2. 수정 전 현재 상태를 확인한다.
git status

# 3. 수정 후 관련 자동 테스트를 실행한다.
node dream_guardian/zone-input.test.cjs
node dream_guardian/runtime.test.cjs
node dream_guardian/question-speech.test.cjs

# 4. 변경 내용을 검토하고, 해당 카드의 변경만 커밋한다.
git diff
git add dream_guardian/index.html dream_guardian/zone-input.js
git commit -m "fix: tune answer selection dwell detection"

# 5. 카드의 관련 커밋 칸에 커밋 ID를 기록하고 Achieved 또는 Device Test로 옮긴다.
git log --oneline -5
```

## 권장 커밋 접두어

| 접두어 | 사용처 |
|---|---|
| `fix:` | 의도와 다른 동작 또는 회귀 수정 |
| `feat:` | 새 게임 기능 추가 |
| `ui:` | 화면 구성, 스타일, 연출 변경 |
| `test:` | 자동 테스트 추가 또는 수정 |
| `docs:` | 기획, 인수인계, 보드 문서 변경 |
| `chore:` | 설정, 도구, 정리 작업 |
