# 꿈의 수호신 (Dream Guardian) - 작업 목차 및 구현 목록 (WBS)

> **프로젝트**: Dream Guardian 재설계
> **작성일**: 2026-09-20
> **현황**: 모놀리식 index.html(2,801줄) + 모듈 6개 → 재구조화 대상

---

## 현재 아키텍처 문제점

| # | 문제 | 상세 |
|---|------|------|
| 1 | **모놀리식 메인 파일** | index.html 2,801줄에 CSS+HTML+JS 전체 집약 |
| 2 | **레거시 모듈 잔류** | motion-input.js, zone-input.js가 프로덕션에서 미사용이나 import 유지 |
| 3 | **미사용 코드** | `drawHUD` 함수 정의만 존재 (drawStreetFighterHUD로 교체됨) |
| 4 | **미사용 변수** | `gridCurrent` 선언만 존재, 인라인 색상 보간으로 대체됨 |
| 5 | **마커 트레일 메모리** | `markerTrail` 배열이 문제 간 초기화 안됨 — 잔상 누적 |
| 6 | **보스 HP 불일치** | 코드: Ch.5=20, 설계문서(COMPLETION.md): 항상 10 |
| 7 | **등급 계산 불일치** | 코드: 정답률 기반(95/80/60/40%), 설계문서: 절대 문항수(9/8/6/4) |
| 8 | **빌드 시스템 부재** | package.json 없음, 번들링 없음 |
| 9 | **타입 안전성 없음** | 순수 JS, JSDoc만 부분 사용 |
| 10 | **챕터별 비주얼 부재** | 5챕터 모두 동일한 드림 그리드 배경 |

---

## Phase 0: 프로젝트 초기화

### 0.1 개발 환경 구축
- [ ] `package.json` 생성 (name, version, scripts, engines)
- [ ] TypeScript 설정 (`tsconfig.json` — strict, ESNext)
- [ ] Vite 설치 및 설정 (`vite.config.ts`)
- [ ] ESLint + Prettier 설정
- [ ] `npm run dev` / `build` / `test` 스크립트 정의

### 0.2 저장소 정리
- [ ] 레거시 모듈 처리: `motion-input.js`, `zone-input.js` → `legacy/` 이동 (테스트는 보존)
- [ ] `drawHUD` 미사용 함수 제거
- [ ] `gridCurrent` 미사용 변수 제거
- [ ] 기존 index.html → `legacy/index.html` 백업
- [ ] 기존 14개 .md 문서 → `docs/archive/` 이동

### 0.3 폴더 구조 확립

```
src/
├── core/                  # 핵심 엔진
│   ├── GameEngine.ts      # 게임 루프, rAF 관리
│   ├── StateMachine.ts    # FSM (13개 상태)
│   ├── EventBus.ts        # 모듈 간 통신
│   └── Config.ts          # 전역 설정
├── render/                # 렌더링
│   ├── CanvasManager.ts   # 캔버스 생성, DPR, 리사이즈
│   ├── Camera.ts          # 뷰포트, 스케일링
│   └── layers/
│       ├── CameraLayer.ts       # 웹캠 미러 피드
│       ├── DreamGridLayer.ts    # 원근 와이어프레임 바닥
│       ├── BossLayer.ts         # 5종 보스 렌더링
│       ├── GuardianLayer.ts     # 수호신 4단계 성장
│       ├── SkeletonLayer.ts     # 뼈대+관절 마커+트레일
│       ├── HUDLayer.ts          # SF스타일 HP바, 마나 플라스크
│       ├── ParticleLayer.ts     # 빛 정령, 실드, 파티클
│       ├── AnswerZoneLayer.ts   # 10존 답 선택 UI
│       └── CutsceneLayer.ts     # 스토리/엔딩 컷신
├── audio/                 # 오디오
│   ├── AudioManager.ts    # AudioContext 생명주기
│   ├── SFXSynth.ts        # 12종 프로시저럴 효과음
│   └── BGMPlayer.ts       # Am 펜타토닉 BGM
├── motion/                # 모션 인식
│   ├── PoseManager.ts     # MediaPipe Pose 초기화
│   ├── HandsManager.ts    # MediaPipe Hands 초기화
│   ├── RunDetector.ts     # 달리기 감지 (어깨 바운스)
│   ├── SquatDetector.ts   # 스쿼트 감지
│   ├── JumpDetector.ts    # 점프 감지
│   └── CalibrationHelper.ts  # 체형 보정
├── input/                 # 입력 시스템
│   ├── AnswerSelection.ts # 4색 커서 10존 답 선택 (answer-selection.js 포팅)
│   ├── MenuInput.ts       # 양손 합장 메뉴 커서 (menu-input.js 포팅)
│   ├── KeyboardInput.ts   # 키보드 fallback
│   └── TouchInput.ts      # 터치 fallback
├── game/                  # 게임 로직
│   ├── BattleSystem.ts    # HP, 마나, 데미지 계산
│   ├── BossController.ts  # 보스 AI (공격 타이밍, 페이즈)
│   ├── GuardianGrowth.ts  # 수호신 성장 단계
│   ├── ComboSystem.ts     # 연속 정답 콤보
│   ├── RunningGauge.ts    # 달리기 게이지
│   ├── ScoreManager.ts    # 점수, 등급 판정
│   └── FitnessTracker.ts  # 걸음, 스쿼트, 점프, 칼로리
├── question/              # 문제 출제
│   ├── CSVLoader.ts       # CSV 파싱
│   ├── TemplateParser.ts  # 변수 치환, 수식 생성
│   ├── QuestionEngine.ts  # 레벨별 문제 선택
│   ├── QuestionEvaluator.ts  # 샌드박스 수식 평가 (question-evaluator.js 포팅)
│   └── QuestionSpeech.ts  # 한국어 TTS (question-speech.js 포팅)
├── ui/                    # UI 스크린
│   ├── MenuScreen.ts      # 메인 메뉴 (5챕터)
│   ├── SubMenuScreen.ts   # 서브레벨 선택
│   ├── ResultScreen.ts    # 결과 화면
│   ├── GameOverScreen.ts  # 게임오버 화면
│   ├── RecordsModal.ts    # 운동 기록 모달
│   ├── PauseMenu.ts       # 일시정지 메뉴
│   └── CalibrationScreen.ts  # 보정 가이드
├── story/                 # 스토리/컷신
│   ├── StoryIntro.ts      # 챕터 인트로 (3초)
│   ├── EndingCutscene.ts  # 4페이즈 엔딩
│   └── storyData.ts       # 스토리 텍스트 데이터
├── data/                  # 데이터
│   ├── questions.csv      # 문제 뱅크
│   ├── bossData.ts        # 보스 스펙 정의
│   └── levelData.ts       # 레벨/챕터 구성
├── storage/               # 데이터 영속성
│   ├── SaveManager.ts     # localStorage 세이브/로드
│   └── schemas.ts         # 저장 데이터 타입 정의
├── assets/                # 에셋
│   └── img/
│       └── guardian.png
├── utils/                 # 유틸리티
│   ├── math.ts
│   ├── random.ts
│   └── landmark.ts        # MediaPipe 좌표 변환
├── types/                 # 타입 정의
│   ├── index.ts
│   ├── pose.ts
│   └── game.ts
├── main.ts                # 엔트리포인트
└── index.html             # HTML 쉘
tests/
├── unit/
│   ├── answer-selection.test.ts
│   ├── menu-input.test.ts
│   ├── question-evaluator.test.ts
│   ├── question-speech.test.ts
│   ├── battle-system.test.ts
│   ├── running-gauge.test.ts
│   └── combo-system.test.ts
├── integration/
│   ├── state-machine.test.ts
│   ├── mana-battle.test.ts
│   └── gauge-decay.test.ts
├── e2e/
│   └── full-gameplay.test.ts
└── legacy/                # 레거시 회귀 테스트
    ├── motion-input.test.cjs
    └── zone-input.test.cjs
```

---

## Phase 1: 코어 엔진 분리 (기존 index.html에서 추출)

### 1.1 게임 엔진 코어
- [ ] `GameEngine.ts`: 초기화, rAF 루프, deltaTime, 일시정지/재개
- [ ] `EventBus.ts`: subscribe/publish/unsubscribe, 타입 안전 이벤트
- [ ] `Config.ts`: 전역 상수 (HP, 마나, 데미지, 임계값 등)
- [ ] 단위 테스트

### 1.2 상태 머신 (13개 상태)
- [ ] `StateMachine.ts` 구현
- [ ] 상태 정의:
  ```
  loading → menu_main → menu_sub → story_intro → ready_position
  → running → playing → correct/wrong → guardian_cast
  → result/gameover → ending_cutscene
  ```
- [ ] 각 상태의 `enter()`, `update()`, `render()`, `exit()` 인터페이스
- [ ] 상태 전환 가드 (잘못된 전환 방지)
- [ ] 단위 테스트 (기존 runtime.test.cjs 로직 포팅)

### 1.3 렌더링 엔진
- [ ] `CanvasManager.ts`: 캔버스 생성, DPR 보정, 리사이즈 핸들링
- [ ] `Camera.ts`: 뷰포트, 반응형 스케일링
- [ ] `CameraLayer.ts`: 웹캠 미러 피드 + 35% 디밍 (index.html:1561 포팅)
- [ ] `DreamGridLayer.ts`: 원근 그리드 (index.html:2384 포팅)
  - 속도 연동 색상: 빨강(기본) → 주황(달리기) → 파랑(75%+)
- [ ] 레이어 z-order 관리
- [ ] 단위 테스트

### 1.4 오디오 엔진
- [ ] `AudioManager.ts`: AudioContext 생명주기, 마스터 볼륨
- [ ] `SFXSynth.ts`: 12종 효과음 (index.html:200-362 포팅)
- [ ] `BGMPlayer.ts`: Am 펜타토닉 아르페지오
- [ ] 브라우저 자동재생 정책 대응
- [ ] 단위 테스트

### 1.5 모션 인식 엔진
- [ ] `PoseManager.ts`: MediaPipe Pose 초기화, 웹캠 스트림
- [ ] `HandsManager.ts`: MediaPipe Hands 초기화, 손바닥 중심 추적
- [ ] `RunDetector.ts`: 어깨 바운스 + 좌우 흔들림 + 교차 거리 (index.html:1146-1170)
  - 노이즈 필터 임계값 0.007, 프레임당 최대 1.5
  - 게이지 감쇠 15/sec
- [ ] `SquatDetector.ts`: 어깨 Y 0.065 하강 감지 (index.html:1088-1106)
- [ ] `JumpDetector.ts`: 어깨 Y 0.065 상승 + 속도 > 0.22/dt, 0.8초 쿨다운 (index.html:1108-1122)
- [ ] `CalibrationHelper.ts`: 코 가이드 박스 2초 보정
- [ ] 카메라 실패 시 fallback (키보드/터치)
- [ ] 단위 테스트

---

## Phase 2: 게임 시스템 구현

### 2.1 전투 시스템
- [ ] `BattleSystem.ts`: HP/마나 관리, 데미지 적용
  - 플레이어 HP 100, 오답 -25, 보스 공격 -15
  - 마나 +25/정답, 100 도달 시 자동 시전, 스펠 데미지 4
- [ ] `BossController.ts`: 보스별 HP (Ch.1-4: 10, Ch.5: 20), 공격 패턴/타이밍
- [ ] `GuardianGrowth.ts`: 4단계 성장 (글로우→2오브→4오브→날개)
- [ ] `ComboSystem.ts`: 연속 정답 추적, 콤보 리셋
- [ ] 단위 테스트

### 2.2 달리기 & 운동 시스템
- [ ] `RunningGauge.ts`: 충전/감쇠 로직, 게이지 MAX 시 이벤트
- [ ] `FitnessTracker.ts`: 걸음/스쿼트/점프 카운트, 칼로리 계산
  - `(steps × 0.04) + (squats × 0.35) + (jumps × 0.15)` kcal
- [ ] 점프 시 게이지 +25% 보너스
- [ ] 스쿼트 방어: 실드 연출 + 보스 공격 회피 +150점
- [ ] 단위 테스트

### 2.3 답 선택 시스템 (answer-selection.js → TypeScript 포팅)
- [ ] `AnswerSelection.ts`: 4색 커서, 10존, 레시피 시스템
- [ ] 존 레이아웃 (반-오픈 사각형)
- [ ] 1초 연속 체류 확정 (중심 가중 1.5x, 가장자리 0.75x)
- [ ] 0.4초 보정 기간
- [ ] 엉덩이 커서 하단 존 제한 (6-10)
- [ ] 기존 answer-selection.test.cjs 포팅 + 확장
- [ ] 단위 테스트

### 2.4 문제 출제 시스템
- [ ] `CSVLoader.ts`: CSV 파싱, BOM 처리, fallback 내장 문제
- [ ] `TemplateParser.ts`: `{A}~{D}` 치환, `rand()`, `pick()` 평가
- [ ] `QuestionEngine.ts`: 레벨별 필터, 중복 방지, Ch.5 전영역 혼합
- [ ] `QuestionEvaluator.ts`: 샌드박스 수식 평가 (question-evaluator.js 포팅)
  - 화이트리스트: rand, pick, gcd, factorial, sup, repeatMul, repeatAdd, Math.abs
  - 차단: window, .constructor
- [ ] `QuestionSpeech.ts`: 한국어 TTS (question-speech.js 포팅)
  - 수학→음성 변환, 3초 타임아웃, 비블로킹
- [ ] 기존 테스트 포팅 (question-evaluator.test, question-speech.test)
- [ ] 단위 테스트

---

## Phase 3: UI & 비주얼

### 3.1 메뉴 시스템
- [ ] `MenuScreen.ts`: 5챕터 버튼 (잠금은 "???"), 누적 운동 통계
- [ ] `SubMenuScreen.ts`: 챕터 내 서브레벨 선택, 뒤로가기
- [ ] `MenuInput.ts`: 양손 합장 커서 (menu-input.js 포팅)
  - 양 손목 거리 < 어깨 폭 80%, visibility >= 0.5
  - 0.8초 드웰 선택
- [ ] 터치/클릭 fallback
- [ ] 기존 menu-input.test.cjs 포팅

### 3.2 인게임 비주얼
- [ ] `BossLayer.ts`: 5종 보스 Canvas 드로잉 (index.html:787)
  - 포겟: 보라 연기 구름 + "?" 부유
  - 후다닥: 금/적 번개 형태
  - 뒤죽박죽: 회전 만화경 육각형
  - 에라: 어두운 그림자 타원 + "포기해" 텍스트
  - 나이트메어: 검은 사각 + 빨간 눈
- [ ] `GuardianLayer.ts`: guardian.png + 크로마키 + 4성장 + 사인파 부유
- [ ] `SkeletonLayer.ts`: 뼈대 + 색상 코딩 관절 + 호흡 + 트레일
- [ ] `HUDLayer.ts`: SF 스타일 HP바 + 메달리온 + 마나 플라스크
- [ ] `AnswerZoneLayer.ts`: 10존 시각화 + 커서 렌더링 + 충전 인디케이터
- [ ] `ParticleLayer.ts`: 빛 정령, 실드 돔, 경고 웨이브
- [ ] `CutsceneLayer.ts`: 스토리 인트로, 엔딩 4페이즈

### 3.3 결과 & 기록
- [ ] `ResultScreen.ts`: 점수, 등급(S/A/B/C/D), 별(3/2/1), 정답률, 콤보, 시간
- [ ] `GameOverScreen.ts`: HP 0 시 재도전/메뉴
- [ ] `RecordsModal.ts`: 최근 8회 기록, 누적 통계
- [ ] `PauseMenu.ts`: 일시정지, 재개, 포기

### 3.4 반응형 & 모바일
- [ ] 9:18 고정 비율 컨테이너
- [ ] 세로/가로 감지
- [ ] 터치 입력 전체 지원
- [ ] 풀스크린 토글

---

## Phase 4: 콘텐츠 확장 (미구현 기획 구현)

### 4.1 챕터별 비주얼 테마
- [ ] Ch.1 (포겟): 안개 숲 배경 — 보라/회색 그리드, 안개 파티클
- [ ] Ch.2 (후다닥): 번개 성 배경 — 금/적 그리드, 번개 이펙트
- [ ] Ch.3 (뒤죽박죽): 만화경 미로 — 시안/다색 그리드, 회전 파티클
- [ ] Ch.4 (에라): 어둠 사막 — 어두운 그리드, 그림자 파티클
- [ ] Ch.5 (나이트메어): 붕괴하는 꿈 — 불안정 그리드, 깨지는 이펙트

### 4.2 수호신 성장 확장
- [ ] 4단계 → 6단계 성장 (스토리 원본 반영)
  1. 약한 빛 (탄생)
  2. 작은 글로우
  3. 2개 오브 궤도
  4. 4개 오브 궤도
  5. 날개 아우라
  6. "사고의 별" 완전체

### 4.3 미니언 러시 시스템
- [ ] 달리기 중 빛 정령 vs 그림자 정령이 대시
- [ ] 빛 정령 수집: 추가 마나/점수
- [ ] 그림자 정령 회피: 피격 시 게이지 감소
- [ ] 스테이지 진행에 따라 밀도 증가

### 4.4 문제 뱅크 확장
- [ ] 레벨별 문제 수 밸런싱 (최소 50개/레벨)
- [ ] 난이도 태그 추가 (easy/medium/hard)
- [ ] 오류 문제 수정
- [ ] Ch.5용 종합 문제 밸런스

---

## Phase 5: 품질 보증 & 배포

### 5.1 테스트
- [ ] Vitest 기반 단위 테스트 (기존 7개 .test.cjs 포팅)
- [ ] 통합 테스트 (runtime.test.cjs 로직 포팅)
  - 상태 전환, 마나 전투, 게이지 감쇠, 입력 가드
- [ ] E2E 테스트 (Playwright)
- [ ] 크로스 브라우저 (Chrome, Safari, Firefox)
- [ ] 모바일 실기 테스트 (iPhone HTTPS 카메라)

### 5.2 성능 최적화
- [ ] Canvas 오프스크린 캐싱 (보스, 수호신 정적 요소)
- [ ] 파티클 오브젝트 풀링
- [ ] MediaPipe 30fps 제한 검증
- [ ] `markerTrail` 문제 간 초기화 버그 수정
- [ ] 메모리 프로파일링

### 5.3 버그 수정 (발견된 이슈)
- [ ] `markerTrail` 문제 간 미초기화 → 잔상 누적
- [ ] 보스 HP 불일치 (코드 vs COMPLETION.md) → 코드 기준으로 문서 통일
- [ ] 등급 계산 불일치 (정답률 vs 절대 문항수) → 하나로 통일

### 5.4 PWA & 배포
- [ ] Service Worker (오프라인 캐싱)
- [ ] manifest.json (아이콘, 테마)
- [ ] 파비콘
- [ ] CI/CD (GitHub Actions)
- [ ] GitHub Pages / Vercel 배포
- [ ] SemVer 릴리즈

---

## Phase 6 (신규): 스켈레톤 커서 및 피트니스 자세 판정 시스템 전면 개편 (Issue #116 ~ #130)

> **기준 문서**: `docs/04_POSTURE_SYSTEM_ANALYSIS.md`, `dream_guardian/HANDOVER.md`  
> **목표**: 18:9 Cover 스케일링 좌표계 일치, 채움색 없는 동적 커서, 상위 계층 Fallback, 양손 모으기 메뉴 복원, 피트니스 존 겹침 제거, 집합 덮기(Set Coverage) 판정 및 공통 부위 아이콘 UI 구축

### 6.1 단계별 세부 작업 순서 (안정적인 5단계 파이프라인)

#### [단계 A] 기반 설정 및 데이터 모델 인프라 구축
- [ ] `[CFG-001]` (Issue #120): 존/커서/티어 설정 `config/` 디렉터리 외부화 및 Config 분리 (RC-8)
- [ ] `[DATA-001]` (Issue #122): `fitness pattern.csv` (360건) 원본 데이터 로더 및 유효성 검증기
- [ ] `[POSE-001]` (Issue #123): 다중 부위-다중 존 `AnswerPosture` 및 `PostureProgress` 신규 데이터 모델

#### [단계 B] 스켈레톤-커서 동기화 및 홈 메뉴 조작 복원
- [ ] `[BUG-CURSOR-001]` (Issue #116): 문제선택 화면 스켈레톤-커서 좌표계 이격 해결 (Cover 변환 1:1 동기화)
- [ ] `[FEAT-CURSOR-001]` (Issue #117): 신체 부위 크기 비례 커서 동적 사이징, 채움색 제거(외곽선 전용), 손바닥(Palm) 중심 트래킹
- [ ] `[FEAT-CURSOR-002]` (Issue #118): 화면 밖 이탈 시 상위 스켈레톤 계층 Fallback (손바닥→손목→전완→팔꿈치→상완→어깨) 및 스무딩 보간
- [ ] `[BUG-MENU-001]` (Issue #119): 메뉴 화면 4색 커서 상시 가시화 및 양손 모으기(`MenuInput`) 0.8초 Dwell 메뉴 선택 복원

#### [단계 C] 피트니스 존 레이아웃 및 자세 판정 엔진 구축
- [ ] `[ZONE-001]` (Issue #121): 존 레이아웃 재배치 (겹침 0% 제거, 머리·골반 배타 보장, 문제/답안 전용 밴드 예약)
- [ ] `[POSE-002]` (Issue #124): 집합 덮기(Set Coverage) 기반 `matchPosture` 수학적 판정 알고리즘 및 단위 테스트
- [ ] `[POSE-003]` (Issue #125): 패턴 풀 기반 좌/우 선택지 추출기 및 생성 제약(C1~C7) 검증기
- [ ] `[POSE-004]` (Issue #126): `PartGate` (캘리브레이션 기준선 대비 실제 변위) 게이트 판정 구현

#### [단계 D] 시각화 및 인게임 UI 연동
- [ ] `[ICON-001]` (Issue #127): `PartIconRenderer` 신설 (손/머리/골반 공통 벡터 아이콘 렌더러)
- [ ] `[UI-001]` (Issue #128): 답안 버튼 부위 아이콘, 색상 및 묶음 기호(`( ✋ ✋ )`, `✋ / ✋`) 시각화
- [ ] `[UI-002]` (Issue #129): 피트니스 존별/부위별 독립 진행도 피드백 및 `i % 2` 오매핑 버그 수정

#### [단계 E] 레거시 정리 및 최종 안정화
- [ ] `[REFACTOR-001]` (Issue #130): `AnswerSelector` 죽은 판정 경로(`update`) 안전 제거 및 단위 테스트 정비

---

## 우선순위 매트릭스

| 우선도 | Phase | 예상 기간 | 의존성 |
|--------|-------|----------|--------|
| **P0** | Phase 0: 초기화 | 1~2일 | 없음 |
| **P0** | Phase 1: 코어 엔진 | 1~2주 | Phase 0 |
| **P1** | Phase 2: 게임 시스템 | 2~3주 | Phase 1 |
| **P1** | Phase 3: UI/비주얼 | 1~2주 | Phase 1 (Phase 2와 병행 가능) |
| **P2** | Phase 4: 콘텐츠 확장 | 1~2주 | Phase 2+3 |
| **P3** | Phase 5: QA/배포 | 1~2주 | Phase 2+3 |

**총 예상: 7~12주** (1인 개발 기준)

---

*문서 작성일: 2026-09-20*
