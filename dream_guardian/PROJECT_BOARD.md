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

### [P1-High] [RENDER-002] 게임 화면 18:9 고정 종횡비 뷰포트 및 캔버스 스케일링 동기화 (Issue #109)
- GitHub URL: https://github.com/Choyounhwa/-dream-guardian/issues/109
- 분야: UI / Render
- 재현 방법 / 배경: 모바일 표준 18:9 (세로 9:18) 규격에 맞춰 컨테이너 및 캔버스 가상 좌표계를 일원화하여 디바이스별 왜곡 방지 필요.
- 기대 결과: 창 크기 변경 시에도 18:9 종횡비와 레터박스/필러박스가 유지되며, 가상 좌표와 물리 캔버스 터치/클릭 좌표가 1:1로 일치.
- 완료 조건: Config 및 CanvasManager의 18:9 동기화, CSS aspect-ratio 레터박스 보장, canvas-manager 단위 테스트 통과.
- 확인 환경: PC Chrome | iPhone Safari | Android Chrome
- 관련 파일: `dream_guardian/src/core/Config.ts`, `dream_guardian/src/render/CanvasManager.ts`, `dream_guardian/index.html`, `dream_guardian/tests/unit/canvas-manager.test.ts`


### [High] 현재 원하는 대로 동작하지 않는 문제를 재현 가능한 버그 카드로 분리
- 분야: Bug
- 완료 조건: 증상마다 재현 방법, 기대 결과, 실제 결과, 확인 기기를 기록한다.
- 확인 환경: PC Chrome | iPhone Safari
- 관련 파일: `dream_guardian/index.html`, `dream_guardian/zone-input.js`

### [High] iPhone HTTPS 환경에서 카메라와 전신 인식 실측
- 분야: Camera
- 완료 조건: HTTPS 주소에서 카메라 권한, Pose, Hands, 음성, 전신 프레임을 각각 확인하고 결과를 기록한다.
- 확인 환경: iPhone Safari
- 관련 파일: `dream_guardian/index.html`, `dream_guardian/HANDOVER.md`

### [High] 답안 선택 동작의 오인식과 미인식 조정
- 분야: Motion
- 완료 조건: 각 활성 신체 부위가 의도한 구역에서 0.8초 유지 시 선택되고, 다른 부위나 추적 유실로는 선택되지 않는다.
- 확인 환경: PC Chrome | iPhone Safari
- 관련 파일: `dream_guardian/zone-input.js`, `dream_guardian/zone-input.test.cjs`

### [Medium] 달리기에서 문제 출제까지의 전환 확인
- 분야: Game Loop
- 완료 조건: 카메라 없이 Space 입력과 카메라 동작 모두에서 진행도 완료 후 문제 하나만 출제되고 중복 출제가 없다.
- 확인 환경: PC Chrome
- 관련 파일: `dream_guardian/index.html`, `dream_guardian/runtime.test.cjs`

### [Medium] 문제 패널과 답 구역의 모바일 가독성 개선
- 분야: UI
- 완료 조건: 1~2m 거리의 세로 화면에서 긴 문제와 두 답 구역을 읽고 구분할 수 있다.
- 확인 환경: iPhone Safari | Android Chrome
- 관련 파일: `dream_guardian/index.html`

### [Medium] 전투 수치 밸런스 점검
- 분야: Balance
- 완료 조건: 일반 보스와 나이트메어의 HP, 정답 마나, 오답 피해가 실제 한 판에서 과도하게 쉽거나 어렵지 않은지 기록하고 조정한다.
- 확인 환경: PC Chrome | iPhone Safari
- 관련 파일: `dream_guardian/index.html`

### [Low] 운동 기록과 명예의 전당 저장 확인
- 분야: Game Loop
- 완료 조건: 일반 보스 클리어 뒤 기록이 저장되고 다시 열어도 표시된다.
- 확인 환경: PC Chrome | iPhone Safari
- 관련 파일: `dream_guardian/index.html`

---

## In Progress

카드를 작업 시작 시 이곳으로 옮긴다. 동시에 한 장만 유지한다.

---

## Device Test

코드 수정과 자동 테스트가 끝난 카드를 실기기 확인 전까지 이곳에 둔다.

---

## Blocked

외부 조건이나 결정이 필요한 카드를 둔다. 막힌 이유와 다음 행동을 반드시 쓴다.

---

## Achieved

### [Done] Git 초기 스냅샷 생성
- 분야: Docs
- 완료 조건: `chore: initial snapshot of dream guardian project` 커밋 생성 완료.

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
