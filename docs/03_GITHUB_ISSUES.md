# 꿈의 수호신 (Dream Guardian) - 신규 개발 GitHub 이슈카드 목록

> **기준 원칙**: [`Dream_Guardian_개발_규칙.md`](./Dream_Guardian_개발_규칙.md) (**2. 전체 개발 순서 17단계** & 19장 단계별 완료 기준)  
> **기획 스펙**: [`01_GAME_DESIGN_DOCUMENT.md`](./01_GAME_DESIGN_DOCUMENT.md)  
> **개발 방식**: 레거시 코드 포팅/이전 없음 — **완전 신규 독립 개발 (Greenfield Implementation)**  
> **핵심 원칙**: 작은 단위 개발 / 기능 독립성 / 데이터·설정·로직 분리 / 완료·테스트 조건 필수 / Git 보존

---

## 🧭 전체 17단계 개발 순서 (Development Order)

```text
[Step 1]  프로젝트 초기화
            ↓
[Step 2]  폴더/아키텍처 확정
            ↓
[Step 3]  게임 코어 구축
            ↓
[Step 4]  게임 상태 머신 구축
            ↓
[Step 5]  렌더링 기반 구축
            ↓
[Step 6]  카메라/스켈레톤 구축
            ↓
[Step 7]  동작 인식 구축
            ↓
[Step 8]  수학 문제 시스템 구축
            ↓
[Step 9]  전투 시스템 구축
            ↓
[Step 10] 입력 시스템 구축
            ↓
[Step 11] UI 구축
            ↓
[Step 12] 이펙트/비주얼 구축
            ↓
[Step 13] 스토리/콘텐츠 구축
            ↓
[Step 14] 통합 테스트
            ↓
[Step 15] 성능 최적화
            ↓
[Step 16] 모바일/브라우저 테스트
            ↓
[Step 17] 배포
```

---

## 🏷 라벨 정의 (Labels)

| 라벨 | 설명 |
|---|---|
| `step-1` ~ `step-17` | 전체 17단계 순서 구분 라벨 |
| `P0-critical` | 필수 코어 및 블로커 |
| `P1-high` | 주요 시스템 |
| `P2-medium` | UI, 비주얼, 편의 기능 |
| `feature` / `test` / `refactor` | 작업 성격 구분 |

---

## 🎯 마일스톤 정의 (Milestones)

| 마일스톤 | 해당 단계 | 목표 및 설명 |
|---|---|---|
| `v0.1-foundation` | Step 1 ~ 2 | 프로젝트 환경 구축 및 14개 모듈 폴더/타입 확정 |
| `v0.2-core-engine` | Step 3 ~ 5 | 메인 루프(GameEngine), FSM 상태 머신, EventBus, CanvasManager |
| `v0.3-vision-motion` | Step 6 ~ 7 | 카메라 피드, Pose 연동, 스켈레톤 시각화, 3대 동작 감지 |
| `v0.4-gameplay-systems` | Step 8 ~ 9 | CSV 문제 뱅크, 안전 수식 평가, TTS, 전투/마나/보스 시스템 |
| `v0.5-input-ui` | Step 10 ~ 11 | 좌/우 정답존, 11존 4색 별 수집, 제스처 메뉴 입력, HUD, 결과/통계 UI |
| `v0.6-visuals-content` | Step 12 ~ 13 | 7종 이펙트, 5종 보스 드로잉, 5챕터 스토리, 세이브 스토리지 |
| `v1.0-release` | Step 14 ~ 17 | 통합 E2E 테스트, 60fps 최적화, 모바일 호환성, PWA, CI/CD 배포 |

---

## [Step 1] 프로젝트 초기화

### Issue #1: 빌드 환경 구축 (package.json, TypeScript, Vite, Vitest)
- **Labels**: `step-1`, `feature`, `P0-critical`
- **Milestone**: `v0.1-foundation`
- **상태**: ✅ **완료 (Closed)**
- **목적**: Vite + TypeScript Strict 모드 기반 개발 및 테스트 환경 구축
- **완료 조건**:
  - `npm run dev` 실행 및 `npm run build` 번들링 0 에러
  - `npm run test` Vitest 단위 테스트 통과 및 Git 커밋 보존

---

## [Step 2] 폴더/아키텍처 확정

### Issue #2: 아키텍처 폴더 구조 확립 및 기본 인터페이스/설정 분리
- **Labels**: `step-2`, `refactor`, `P0-critical`
- **Milestone**: `v0.1-foundation`
- **상태**: ✅ **완료 (Closed)**
- **목적**: 14개 독립 모듈 디렉토리 확립, 공통 인터페이스 및 설정값 분리
- **완료 조건**:
  - `src/` 하위 14개 디렉토리 및 배럴(`index.ts`) 생성
  - `Config.ts`에 게임 밸런스 상수 분리 정의
  - 문제 원본 CSV 및 이미지 에셋 배치 (`src/data/`, `src/assets/`)
  - 아키텍처 단위 테스트 통과 및 Git 커밋 보존

---

## [Step 3] 게임 코어 구축

### Issue #3: GameEngine 메인 루프 및 시간 제어 구현
- **Labels**: `step-3`, `feature`, `P0-critical`
- **Milestone**: `v0.2-core-engine`
- **목적**: requestAnimationFrame 기반 60fps 메인 게임 루프 및 델타타임 제어
- **구현 사양**:
  - `GameEngine.ts`: `start()`, `stop()`, `pause()`, `resume()`
  - `deltaTime` 계산 및 스파이크 방지 최대 델타 캡
  - `update(dt)`와 `render()` 파이프라인 호출
- **완료 조건**:
  - 일시정지 및 재개 시 시간 왜곡 없이 정상 작동
  - 단위 테스트: 시간 누적 및 루프 생명주기 검증

### Issue #4: 타입 안전 이벤트 버스 (EventBus) 구현
- **Labels**: `step-3`, `feature`, `P0-critical`
- **Milestone**: `v0.2-core-engine`
- **목적**: 모듈 간 직접 참조를 배제하고 느슨한 결합(Decoupling)을 위한 메시징 버스 구축
- **구현 사양**:
  - `EventBus.ts`: TypeScript 제네릭 기반 `on`, `off`, `emit`, `once`
  - `EventMap` 인터페이스 기반 엄격한 페이로드 타입 검사
- **완료 조건**:
  - 리스너 등록/해제 및 메모리 누수 방지
  - 단위 테스트: 다중 구독 및 페이로드 전달 검증

---

## [Step 4] 게임 상태 머신 구축

### Issue #5: 유한 상태 머신 (FSM) 13개 상태 관리자 구현
- **Labels**: `step-4`, `feature`, `P0-critical`
- **Milestone**: `v0.2-core-engine`
- **목적**: 기획서에 정의된 13개 게임 상태 전환과 생명주기 관리
- **구현 사양**:
  - `StateMachine.ts`: 상태 등록, 전환(`changeState`), 가드 조건
  - 13개 상태: `LOADING`, `MENU_MAIN`, `MENU_SUB`, `STORY_INTRO`, `READY_POSITION`, `RUNNING`, `PLAYING`, `CORRECT`, `WRONG`, `GUARDIAN_CAST`, `RESULT`, `GAMEOVER`, `ENDING_CUTSCENE`
  - 각 상태별 `enter()`, `update(dt)`, `render(ctx)`, `exit()` 인터페이스
- **완료 조건**:
  - 허용되지 않은 잘못된 상태 전이 시도 시 에러 차단
  - 단위 테스트: 상태 전이 흐름 및 enter/exit 훅 호출 검증

---

## [Step 5] 렌더링 기반 구축

### Issue #6: CanvasManager 및 고해상도(DPR) 렌더링 기반 구축
- **Labels**: `step-5`, `feature`, `P0-critical`
- **Milestone**: `v0.2-core-engine`
- **목적**: DevicePixelRatio(DPR) 대응 선명한 캔버스 스케일링 및 가상 해상도 뷰포트 구축
- **구현 사양**:
  - `CanvasManager.ts`: 캔버스 자동 리사이즈 및 DPR 보정
  - 가상 좌표계(1920x1080)와 화면 캔버스 좌표계 간 스케일 매핑
  - 레이어 순차 렌더링 파이프라인
- **완료 조건**:
  - 화면 리사이즈 시 깨짐이나 왜곡 없는 가상 해상도 유지
  - 단위 테스트: 좌표 변환 및 DPR 스케일 계산 검증

---

## [Step 6] 카메라/스켈레톤 구축

### Issue #7: 웹캠 미러 피드 레이어 (CameraLayer)
- **Labels**: `step-6`, `feature`, `P1-high`
- **Milestone**: `v0.3-vision-motion`
- **목적**: 웹캠 권한 요청, 미러 비디오 캡처 및 35% 디밍 오버레이 렌더링
- **구현 사양**:
  - `navigator.mediaDevices.getUserMedia` 안전 래퍼
  - 좌우 반전(미러) 캔버스 드로잉
  - 카메라 권한 거부 시 예외 방어
- **완료 조건**:
  - 웹캠 스트림이 캔버스 배경에 정상 미러링
  - 비디오 로드 실패 시에도 게임 엔진 다운 없음

### Issue #8: MediaPipe Pose 연동 파이프라인
- **Labels**: `step-6`, `feature`, `P0-critical`
- **Milestone**: `v0.3-vision-motion`
- **목적**: MediaPipe Pose 모델 비동기 초기화 및 프레임별 33개 신체 랜드마크 추출
- **구현 사양**:
  - `PoseManager.ts`: Pose 모델 로드, 30fps 스로틀링
  - 좌표 정규화 (0~1 범위를 가상 화면 좌표로 변환)
  - 신뢰도(visibility) 임계값 필터링
- **완료 조건**:
  - 웹캠 프레임에서 어깨, 팔꿈치, 손목, 엉덩이, 무릎, 발목 좌표 추출
  - 단위 테스트: 랜드마크 데이터 수신 및 정규화 변환 검증

### Issue #9: 스켈레톤 시각화 엔진 (관절, 뼈대, 호흡 효과)
- **Labels**: `step-6`, `feature`, `P1-high`
- **Milestone**: `v0.3-vision-motion`
- **목적**: 신체 랜드마크를 네온 와이어프레임 뼈대와 관절 마커로 시각화
- **구현 사양**:
  - `JointRenderer.ts`: 주요 관절 마커 (손, 어깨, 골반 다이아몬드)
  - `BoneRenderer.ts`: 뼈대 라인 연결 드로잉
  - `SkeletonAnimation.ts`: 부드러운 보간(lerp) 및 호흡 펄스 효과
- **완료 조건**:
  - 관절과 뼈대가 끊김 없이 자연스럽게 연결
  - 트레일 잔상이 프레임 간 누적되지 않고 정상 소멸

---

## [Step 7] 동작 인식 구축

### Issue #10: MediaPipe Hands 손바닥 추적 및 Pose 손목 Fallback 분리
- **Labels**: `step-7`, `feature`, `P1-high`
- **Milestone**: `v0.3-vision-motion`
- **목적**: 양손 손바닥 중심점(Landmark 9) 정밀 트래킹 및 Pose 손목 Fallback 시스템
- **구현 사양**:
  - `HandsManager.ts`: 손 인식 격리 (Hands 실패 시 Pose 손목으로 자동 대체)
  - 최대 180ms 캐시 후 손실 시 폴백 처리
- **완료 조건**:
  - 손이 화면에서 잠깐 벗어나도 안정적으로 커서 유지
  - 단위 테스트: 손 트래킹 손실 시 Fallback 전환 로직 검증

### Issue #11: 제자리 달리기, 스쿼트 방어, 점프 감지기
- **Labels**: `step-7`, `feature`, `P0-critical`
- **Milestone**: `v0.3-vision-motion`
- **목적**: 기획서 사양에 따른 3대 피트니스 운동 감지 알고리즘 구현
- **구현 사양**:
  - `RunDetector.ts`: 어깨 상하 바운스 + 좌우 흔들림 감지 → 달리기 게이지 충전
  - `SquatDetector.ts`: 어깨 Y 기준선 대비 0.065 이상 하강 감지 → 보스 공격 방어
  - `JumpDetector.ts`: 어깨 Y 상승 + 속도 > 0.22/dt 감지 → 게이지 +25% 부스트
  - `CalibrationHelper.ts`: 코 가이드 박스 2초 대기를 통한 사용자 신체 기준선 자동 보정
- **완료 조건**:
  - 임계값 설정 파일(`motion.config.ts`)과 감지 로직의 엄격한 분리
  - 단위 테스트: 좌표 변위 시뮬레이션 기반 동작 판정 유닛 테스트

---

## [Step 8] 수학 문제 시스템 구축

### Issue #12: CSV 문제 뱅크 로더 및 챕터별 필터링
- **Labels**: `step-8`, `feature`, `P0-critical`
- **Milestone**: `v0.4-gameplay-systems`
- **목적**: `questions.csv` 12컬럼 데이터를 파싱하고 챕터/서브레벨별 출제 풀 구성
- **구현 사양**:
  - `CSVLoader.ts`: 헤더 및 레코드 파싱, 타입 매핑
  - `QuestionBank.ts`: Ch.1~4 레벨별 필터링, Ch.5(나이트메어) 전 영역 랜덤 혼합
  - 중복 출제 방지 셔플 큐
- **완료 조건**:
  - CSV 파싱 오류 시 안전한 기본 문제 풀 로드
  - 단위 테스트: CSV 파싱 및 셔플 큐 중복 방지 검증

### Issue #13: 샌드박스 안전 수식 평가기 (QuestionEvaluator)
- **Labels**: `step-8`, `feature`, `P0-critical`
- **Milestone**: `v0.4-gameplay-systems`
- **목적**: 템플릿 변수 치환 및 화이트리스트 기반 안전한 수학 수식 계산
- **구현 사양**:
  - 허용 함수: `rand`, `pick`, `gcd`, `factorial`, `sup`, `repeatMul`, `repeatAdd`, `Math.abs`
  - `window`, `eval`, `constructor` 등 악의적 코드 인젝션 완벽 차단
  - 2지선다/3지선다 선택지 생성 및 정답 인덱스 판정
- **완료 조건**:
  - 단위 테스트: 50종 이상의 다양한 수식 템플릿 평가 무오류 검증
  - 코드 인젝션 시도 차단 보안 테스트

### Issue #14: Web Speech API 한국어 TTS 음성 안내
- **Labels**: `step-8`, `feature`, `P2-medium`
- **Milestone**: `v0.4-gameplay-systems`
- **목적**: 수학 기호를 자연스러운 한국어 문장으로 변환하여 문제 음성 낭독
- **구현 사양**:
  - `QuestionSpeech.ts`: 수식 기호 변환 (`1/2` → `"2분의 1"`, `×` → `"곱하기"`)
  - 음성 출력 중 게임 멈춤 없는 비블로킹 큐
  - TTS 미지원 브라우저 graceful degradation
- **완료 조건**:
  - 음성 출력 여부와 무관하게 게임 타이머 정상 동작

---

## [Step 9] 전투 시스템 구축

### Issue #15: 플레이어 체력, 마나 축적 및 콤보 엔진
- **Labels**: `step-9`, `feature`, `P0-critical`
- **Milestone**: `v0.4-gameplay-systems`
- **목적**: 플레이어 전투 생명주기 및 정답 보상 로직
- **구현 사양**:
  - HP 100 기준, 오답 시 -25 HP
  - 정답 시 마나 +25 및 연속 콤보 카운트 증가
  - HP 0 도달 시 `GAMEOVER` 상태 전이
- **완료 조건**:
  - 단위 테스트: 정답/오답에 따른 체력/마나/콤보 계산 검증

### Issue #16: 보스 전투 컨트롤러 및 스쿼트 방어 메커니즘
- **Labels**: `step-9`, `feature`, `P0-critical`
- **Milestone**: `v0.4-gameplay-systems`
- **목적**: 5종 보스의 체력 관리, 주기적 공격 패턴 및 플레이어 스쿼트 방어 판정
- **구현 사양**:
  - 보스 HP: Ch.1~4 = 10, Ch.5(나이트메어) = 20
  - 공격 경고(warning) 후 공격 실행
  - 플레이어가 스쿼트 상태(실드 전개)인 경우 데미지 무효화, 실패 시 -15 HP
- **완료 조건**:
  - 보스 HP 0 도달 시 승리 상태 전이
  - 단위 테스트: 보스 공격 타이밍 및 방어 성공/실패 체력 증감 검증

### Issue #17: 수호신 마법 캐스팅 및 4단계 성장 로직
- **Labels**: `step-9`, `feature`, `P1-high`
- **Milestone**: `v0.4-gameplay-systems`
- **목적**: 마나 100 도달 시 수호신의 자동 스펠 캐스팅 및 성장 단계 전이
- **구현 사양**:
  - 마나 100 소모 → 보스에게 4 데미지 타격
  - 성장 단계: 1단계(작은 요정) → 2단계(빛의 오브 2개) → 3단계(빛의 오브 4개) → 4단계(천사 날개)
- **완료 조건**:
  - 단위 테스트: 마나 충전 시 자동 시전 트리거 및 보스 HP 감소 검증

---

## [Step 10] 입력 시스템 구축

### Issue #18: 10존 피트니스 레이아웃 및 4색 신체 커서 답안 선택 입력기
- **Labels**: `step-10`, `feature`, `P0-critical`
- **Milestone**: `v0.5-input-ui`
- **목적**: 전신 4부위 커서를 활용한 10개 피트니스 영역 답안 선택 제스처 입력 처리
- **구현 사양**:
  - 4색 커서: 왼손(시안), 오른손(노랑), 어깨(보라), 엉덩이(주황)
  - 10개 피트니스 영역 레이아웃 (좌상, 상, 우상, 좌, 우, 좌하, 중하, 우하, 좌저, 우저)
  - 영역 내 1초 연속 체류 시 선택 확정 (중심 가중치 1.5배)
- **완료 조건**:
  - 커서 체류 시 실시간 충전 게이지 계산
  - 단위 테스트: 체류 시간 누적 및 선택 확정 이벤트 발생 검증

### Issue #19: 양손 합장 제스처 메뉴 입력기
- **Labels**: `step-10`, `feature`, `P1-high`
- **Milestone**: `v0.5-input-ui`
- **목적**: 터치 없이 모션으로 메뉴를 조작할 수 있는 양손 합장 커서 감지기 구현
- **구현 사양**:
  - `MenuInput.ts`: 양 손목 간 거리가 임계값 이하로 좁혀질 때 합장 상태 판정
  - 합장 중심점을 가상 마우스 커서로 매핑하여 버튼 호버/클릭 판정
- **완료 조건**:
  - 합장 자세 유지 0.8초 시 버튼 클릭 트리거
  - 단위 테스트: 좌표 거리 기반 합장 감지 유닛 테스트

### Issue #20: 키보드 / 터치 Fallback 비상 입력기
- **Labels**: `step-10`, `feature`, `P2-medium`
- **Milestone**: `v0.5-input-ui`
- **목적**: 카메라가 없거나 모션 인식이 불가한 환경을 위한 대체 입력 인터페이스 구축
- **구현 사양**:
  - `KeyboardInput.ts`: 방향키/숫자키 기반 달리기, 스쿼트 방어, 답 선택
  - `TouchInput.ts`: 모바일 화면 터치 버튼 오버레이
- **완료 조건**:
  - 카메라 OFF 환경에서도 게임 루프 100% 진행 가능

---

## [Step 11] UI 구축

### Issue #21: 스트리트파이터 스타일 듀얼 HP HUD, 마나 플라스크 및 실드 UI
- **Labels**: `step-11`, `feature`, `P1-high`
- **Milestone**: `v0.5-input-ui`
- **목적**: 대전 격투 스타일의 상단 HUD 및 마나 물약병 게이지 화면 렌더링
- **구현 사양**:
  - `HUDLayer.ts`: 플레이어 vs 보스 체력바, 보스 이름/초상화
  - 마나 플라스크 액체 애니메이션
  - 스쿼트 방어 성공 시 반원형 실드 돔 시각화
- **완료 조건**:
  - 체력/마나 변동 시 부드러운 감쇠 애니메이션 표현

### Issue #22: 메인 메뉴, 서브레벨 선택 및 챕터 카드 UI
- **Labels**: `step-11`, `feature`, `P1-high`
- **Milestone**: `v0.5-input-ui`
- **목적**: 챕터 선택, 스테이지 진입 및 옵션 설정을 제공하는 UI 뷰 구축
- **구현 사양**:
  - 1~5 챕터 카드 및 서브레벨 그리드 렌더링
  - 해금/잠금 상태 시각화
- **완료 조건**:
  - 메뉴 선택 시 해당 챕터 스테이지로 상태 전이

### Issue #23: 결과 화면, 게임오버, 일시정지 및 운동 통계 모달
- **Labels**: `step-11`, `feature`, `P1-high`
- **Milestone**: `v0.5-input-ui`
- **목적**: 클리어/실패 피드백 및 운동량(칼로리) 리포트 모달 표시
- **구현 사양**:
  - 클리어 시 별 등급(1~3성) 산출
  - 칼로리 소모 공식 계산: `(steps*0.04) + (squats*0.35) + (jumps*0.15)` kcal
  - 재도전 및 메뉴 복귀 버튼
- **완료 조건**:
  - 단위 테스트: 칼로리 계산 공식 무결성 검증

---

## [Step 12] 이펙트/비주얼 구축

### Issue #24: EffectManager 및 7종 시각 효과 객체 풀링
- **GitHub URL**: https://github.com/Choyounhwa/-dream-guardian/issues/89
- **Labels**: `step-12`, `feature`, `P1-high`
- **Milestone**: `v0.6-visuals-content`
- **상태**: ✅ **완료 (Closed)**
- **목적**: 게임 로직과 분리된 독립적 시각 효과 파티클 풀 관리

---

### Issue #25: 5종 보스 Canvas 2D 프로시저럴 드로잉
- **GitHub URL**: https://github.com/Choyounhwa/-dream-guardian/issues/90
- **Labels**: `step-12`, `feature`, `P1-high`
- **Milestone**: `v0.6-visuals-content`
- **상태**: ✅ **완료 (Closed)**
- **목적**: 무거운 이미지 대신 순수 캔버스 코드로 5종 보스 개성 구현
- **구현 사양**:
  - Ch.1 포겟(안개 구름), Ch.2 후다닥(번개 구체), Ch.3 뒤죽박죽(기하학 만화경), Ch.4 에라(그림자 거인), Ch.5 나이트메어(검은 다각형)
- **완료 조건**:
  - 5종 보스의 피격 및 공격 모션 시각화

### Issue #26: 수호신 그래픽 렌더링 및 외형 성장 표현
- **Labels**: `step-12`, `feature`, `P2-medium`
- **Milestone**: `v0.6-visuals-content`
- **목적**: 수호신 에셋(`guardian.png`) 로드 및 단계별 발광/오브 렌더링
- **구현 사양**:
  - 배경 크로마키 투명화 처리
  - 단계별 궤도 회전 오브 및 글로우 오라
- **완료 조건**:
  - 이미지 누락 시에도 안전한 벡터 대체 렌더러 동작

### Issue #27: 3D 원근 와이어프레임 드림 그리드 및 Web Audio 사운드 합성
- **Labels**: `step-12`, `feature`, `P1-high`
- **Milestone**: `v0.6-visuals-content`
- **목적**: 사이버틱한 원근 와이어프레임 바닥과 무외부 음원 Web Audio 합성기 구현
- **구현 사양**:
  - 소멸점(상단 38%) 3D 와이어프레임 그리드 (달리기 속도 연동 색상 변화)
  - `SFXSynth.ts`: 12종 효과음 (정답음, 오답음, 피격음, 실드 방어음 등)
  - `BGMPlayer.ts`: Am 펜타토닉 프로시저럴 BGM 루프
- **완료 조건**:
  - 브라우저 자동 재생 정책(User gesture resume) 완벽 대응

---

## [Step 13] 스토리/콘텐츠 구축

### Issue #28: 5개 챕터 인트로 스토리 및 4페이즈 엔딩 시네마틱 컷신
- **Labels**: `step-13`, `feature`, `P2-medium`
- **Milestone**: `v0.6-visuals-content`
- **목적**: 몰입감 높은 세계관 전달 및 4페이즈 클라이맥스 엔딩 연출
- **구현 사양**:
  - 챕터 시작 시 3초 텍스트 인트로
  - 나이트메어 처치 시 4페이즈 컷신 (어둠 붕괴 → 빛의 복원 → 수호신 작별 → 통계)
- **완료 조건**:
  - 스킵 버튼 지원 및 스토리 상태 전이 완료

### Issue #29: 챕터별 고유 비주얼 환경 테마
- **Labels**: `step-13`, `feature`, `P2-medium`
- **Milestone**: `v0.6-visuals-content`
- **목적**: 5개 챕터마다 고유한 색상 팔레트와 분위기 부여
- **구현 사양**:
  - Ch.1 안개 숲 (에메랄드), Ch.2 수정 동굴 (시안), Ch.3 불꽃 협곡 (크림슨), Ch.4 폭풍 첨탑 (인디고), Ch.5 악몽 심연 (퍼플)
- **완료 조건**:
  - 챕터 전환 시 테마 팔레트가 배경 그리드 및 HUD에 즉각 반영

### Issue #30: 미니언 러시 돌발 이벤트 시스템
- **Labels**: `step-13`, `feature`, `P3-low`
- **Milestone**: `v0.6-visuals-content`
- **목적**: 달리기 페이즈 중 긴장감을 주는 빛 vs 그림자 정령 돌발 이벤트
- **구현 사양**:
  - 달리기 중 전방에서 다가오는 그림자 미니언 회피/처치 보너스
- **완료 조건**:
  - 기존 달리기 게이지 충전과 충돌 없는 독립적 이벤트 처리

### Issue #31: 로컬 스토리지 기반 영속성 엔진 (SaveData)
- **Labels**: `step-13`, `feature`, `P1-high`
- **Milestone**: `v0.6-visuals-content`
- **목적**: 브라우저를 닫아도 해금된 챕터, 최고 기록, 별 등급 보존
- **구현 사양**:
  - `StorageManager.ts`: 진행도, 통계(누적 칼로리, 클리어수), 챕터별 별점 저장/불러오기
  - 데이터 오염 방지 JSON 스키마 검증
- **완료 조건**:
  - 단위 테스트: 세이브 데이터 저장, 마이그레이션, 복원 검증

---

## [Step 14] 통합 테스트

### Issue #32: 전체 게임 루프 E2E 시나리오 자동화 통합 테스트
- **Labels**: `step-14`, `test`, `P0-critical`
- **Milestone**: `v1.0-release`
- **목적**: 시작부터 엔딩까지 전체 사용자 플로우의 결함 검증
- **구현 사양**:
  - 시나리오: [메뉴] → [달리기] → [문제] → [정답/선택] → [캐스팅] → [보스 격파] → [결과]
- **완료 조건**:
  - 무인 자동화 시뮬레이션 테스트 10회 연속 통과

---

## [Step 15] 성능 최적화

### Issue #33: 장시간 플레이 메모리 누수 점검 및 60fps 최적화
- **Labels**: `step-15`, `refactor`, `P1-high`
- **Milestone**: `v1.0-release`
- **목적**: 메모리 잔상 누적 방지 및 저사양 기기 60fps 고정
- **구현 사양**:
  - 마커 트레일 배열 및 파티클 배열의 누수 여부 점검
  - 불필요한 캔버스 클리어 및 재할당 제거
- **완료 조건**:
  - 30분 연속 실행 시 힙 메모리 평형 유지 및 프레임 드랍 없음

---

## [Step 16] 모바일/브라우저 테스트

### Issue #34: 모바일 웹 및 크로스 브라우저 호환성 검증
- **Labels**: `step-16`, `test`, `P1-high`
- **Milestone**: `v1.0-release`
- **목적**: Chrome, Safari, Firefox 및 iOS/Android 환경 동작 보장
- **구현 사양**:
  - iOS Safari WebCam 제약 대응
  - 모바일 터치 오버레이 반응성 테스트 (9:18 비율)
- **완료 조건**:
  - 모바일 해상도에서 UI 잘림 현상 없음

---

## [Step 17] 배포

### Issue #35: PWA 매니페스트 및 GitHub Actions 무중단 배포 파이프라인
- **Labels**: `step-17`, `feature`, `P1-high`
- **Milestone**: `v1.0-release`
- **목적**: 모바일 홈 화면 설치 PWA 환경 및 자동 배포 파이프라인 완성
- **구현 사양**:
  - `manifest.json`, 오프라인 `service-worker.js`
  - `.github/workflows/deploy.yml`: Lint → Test → Build → Deploy to Pages
- **완료 조건**:
  - 배포 URL 접속 시 HTTPS 환경에서 카메라 권한과 함께 게임 즉시 실행 가능

---

## 🚀 추가 작업 이슈 (Enhancements & Follow-up Issues)

### Issue #107: [BUG-004] MediaPipe CDN 누락 및 CameraLayer 웹캠 피드 인게임 렌더 파이프라인 연동
- **GitHub URL**: https://github.com/Choyounhwa/-dream-guardian/issues/107
- **Labels**: `step-6`, `bug`, `P1-high`
- **Milestone**: `v0.3-vision-motion`
- **작업 ID**: `[BUG-004]`
- **상태**: ✅ **완료 (Closed)**
- **목적**: MediaPipe CDN 확인, 상단 카메라 토글 UI 컨트롤 연동 및 렌더 파이프라인 안전성 확보
- **수정 대상**: `dream_guardian/src/index.html`, `dream_guardian/src/main.ts`
- **완료 조건**:
  - [x] `src/index.html`에 MediaPipe Pose 0.5 CDN 정상 로드 및 Favicon 오류 방어
  - [x] 상단 플로팅 컨트롤(`#top_controls`)에 `📷` 카메라 토글 및 `⛶` 전체화면 버튼 연동
  - [x] 카메라 버튼 클릭 시 웹캠 정지/재생 및 아이콘 실시간 전환 확인
  - [x] 카메라 미인가/차단 상태에서도 드림 그리드 및 메뉴/전투 정상 플레이 유지
  - [x] `npm test` 단위 테스트 100% 통과 (222개 통과) 및 프로덕션 빌드 0 에러

---

### Issue #108: [BUG-005] PoseManager 프레임 전송 및 스켈레톤 시각화 엔진(관절, 뼈대, 호흡) 인게임 렌더 파이프라인 연동
- **GitHub URL**: https://github.com/Choyounhwa/-dream-guardian/issues/108
- **Labels**: `step-6`, `bug`, `P1-high`
- **Milestone**: `v0.3-vision-motion`
- **작업 ID**: `[BUG-005]`
- **상태**: ✅ **완료 (Closed)**
- **목적**: `PoseManager`, `JointRenderer`, `BoneRenderer`, `SkeletonAnimation` 모듈을 메인 렌더 루프에 결합하여 스켈레톤 시각화 파이프라인 연동 완성
- **수정 대상**: `dream_guardian/src/main.ts`
- **완료 조건**:
  - [x] `src/main.ts`에 PoseManager 초기화 및 카메라 연동 완료
  - [x] `engine.update()`에서 비디오 엘리먼트 랜드마크 추출 파이프라인 연동
  - [x] SkeletonAnimation(보간/호흡) 갱신 로직 연동
  - [x] `engine.render()`에서 카메라 피드 직후 관절 및 뼈대 드로잉 수행
  - [x] 포즈 인식 시/미인식 시 브라우저 렌더링 무결성 확인
  - [x] `npm test` 단위 테스트 및 빌드 무오류 (199개 통과)

---

### Issue #109 (Card #36): [RENDER/UI] 게임 화면 18:9 고정 종횡비 뷰포트 및 캔버스 스케일링 동기화
- **GitHub URL**: https://github.com/Choyounhwa/-dream-guardian/issues/109
- **Labels**: `step-5`, `step-11`, `render`, `ui`, `enhancement`, `P1-high`, `phase-6`
- **Milestone**: `v0.5-input-ui`
- **작업 ID**: `[RENDER-002]`
- **상태**: ✅ **완료 (Closed)**
- **목적**: 모바일 최적 규격(18:9 / 세로 9:18)에 맞춰 게임 컨테이너 및 캔버스 가상 좌표계를 일원화하고, 다양한 디바이스(PC 와이드 모니터, 태블릿, 모바일)에서 화면 왜곡이나 잘림 없이 18:9 고정 종횡비를 유지하도록 레터박스/필러박스 반응형 스케일링 확립
- **수정 대상**:
  - `dream_guardian/src/core/Config.ts` (가상 해상도 설정값)
  - `dream_guardian/src/render/CanvasManager.ts` (가상 좌표 ↔ 물리 캔버스 좌표 매핑 및 DPR 리사이즈)
  - `dream_guardian/index.html` (CSS `#container` 종횡비 및 `resizeCanvas()` 동기화)
  - `dream_guardian/tests/unit/canvas-manager.test.ts` (18:9 좌표 변환 단위 테스트)
- **구현 사양**:
  - 렌더링 가상 해상도를 18:9 비율로 일원화 (세로 모드 기준 `1080 x 2160`, 가로 모드 기준 `2160 x 1080`)
  - `#container` CSS를 `aspect-ratio: 9 / 18` 기반 레터박스/필러박스 완벽 보장
  - DPR 보정 시 캔버스 물리 픽셀과 가상 픽셀의 종횡비가 일치하도록 균일 스케일(Uniform scale) 계산
  - 창 크기 변경 시 비정상적인 왜곡 없이 18:9 비율 유지
- **유지 사항**:
  - 기존 웹캠 카메라 피드(`cover`/`contain`)의 종횡비 보존 및 스켈레톤 관절 좌표 매핑
  - 10개 피트니스 존 및 4색 신체 커서의 상대 좌표 판정 로직
  - 키보드/터치 Fallback 입력 및 HUD UI 렌더링 위치
- **변경 금지**:
  - 전투 시스템 로직 (HP, 마나, 데미지, 콤보 등)
  - MediaPipe Pose/Hands 인식 파이프라인 및 제스처 감지기
  - 문제 출제 및 TTS 음성 안내 시스템
- **완료 조건**:
  - [x] PC, 태블릿, 모바일 창 크기 변경 시 항상 18:9(세로 9:18) 비율이 유지되며 왜곡되지 않음
  - [x] 캔버스 터치/클릭 좌표와 가상 해상도 좌표가 1:1로 정확하게 일치
  - [x] 콘솔 에러 없이 `npm test` 단위 테스트 100% 통과
  - [x] Git 커밋 컨벤션 준수 (`feat(render): sync 18:9 aspect ratio and canvas scaling`)
- **테스트 방법**:
  - `npm test` 단위 테스트 슈트 통과 확인
  - 브라우저 개발자 도구 해상도별 18:9 레터박스 및 커서 좌표 정합성 확인
- **관련 파일**:
  - `dream_guardian/src/core/Config.ts`
  - `dream_guardian/src/render/CanvasManager.ts`
  - `dream_guardian/index.html`
  - `dream_guardian/tests/unit/canvas-manager.test.ts`

---

### Issue #110 (Card #37): [CAMERA/SKELETON] 초기 메뉴 화면 웹캠 자동 시작 및 스켈레톤 미러 좌표 동기화
- **GitHub URL**: https://github.com/Choyounhwa/-dream-guardian/issues/110
- **Labels**: `step-6`, `camera`, `skeleton`, `bug`, `P1-high`
- **Milestone**: `v0.3-vision-motion`
- **작업 ID**: `[BUG-CAM-001]`
- **상태**: ✅ **완료 (Closed)**
- **목적**:
  - 게임 접속 시 첫 메뉴 화면(`screenMode === 'menu'`)부터 웹캠 피드와 스켈레톤 관절이 즉시 표시되도록 라이프사이클을 연동하고, 미러링된 영상과 스켈레톤의 X좌표 축을 1:1로 일치시켜 사용자 신체 위에 정확히 중첩되도록 보정
- **수정 대상**:
  - `dream_guardian/src/render/CameraLayer.ts` (Cover 비율 보존, DOM 마운트, 제약 조건 fallback)
  - `dream_guardian/src/motion/PoseManager.ts` (mirror 옵션 지원 및 X축 반전 `1 - lm.x`)
  - `dream_guardian/src/main.ts` (부트스트랩 카메라 즉시 시작, 메뉴 화면 스켈레톤 드로잉, 클릭 제스처 fallback)
  - `dream_guardian/tests/unit/pose-manager.test.ts` (미러링 X축 반전 단위 테스트)
- **구현 내용**:
  1. `CameraLayer`:
     - 비디오 원본 비율(`vW`, `vH`) 기반 Cover 스케일 계산 적용으로 화면 왜곡 방지
     - 브라우저 백그라운드 스로틀링 방지를 위한 DOM 마운트 및 `playsinline`/`muted` 보장
     - 해상도 제약 실패 시 기본 비디오 스트림으로 자동 fallback
  2. `PoseManager`:
     - `mirror: boolean` 옵션 추가 (기본 false, main.ts에서 true 적용)
     - 미러 활성화 시 `(1 - lm.x) * virtualWidth`로 변환하여 반전 영상과 완벽 동기화
  3. `main.ts`:
     - `bootstrap()`에서 `ensureCameraStarted()` 즉시 호출하여 첫 메뉴부터 카메라 작동
     - `render()` 루프에서 메뉴 모드에서도 스켈레톤 관절과 뼈대를 실시간 렌더링
     - 카메라 권한 요청 중/차단 시 화면 하단 안내 텍스트 표시
- **유지 사항**:
  - 33개 랜드마크 데이터 구조 및 기존 신뢰도(Visibility) 필터링
  - 스켈레톤 호흡 효과(`breathScale`) 및 관절 색상/스타일 유지
  - 기존 195개 단위 테스트 호환성 유지
- **변경 금지**:
  - 전투 시스템 수치 (HP, 마나, 데미지 등)
  - 수학 문제 출제 및 TTS 음성 평가 로직
  - 18:9 CanvasManager 스케일링 로직
- **완료 조건**:
  - [x] 페이지 접속 즉시 카메라 권한 요청 및 메뉴 배경에 실시간 피드 표시
  - [x] 사용자의 신체 움직임과 스켈레톤 관절이 반전 없이 정확한 위치에 일치
  - [x] `npm test` 단위 테스트 100% 통과 (196개 테스트 통과)
  - [x] `npm run build` 번들링 0 에러
- **테스트 방법**:
  - `npm test` 실행하여 `pose-manager.test.ts` 미러링 테스트 포함 전체 검증
  - `http://localhost:3000/` 접속하여 첫 화면 웹캠 및 스켈레톤 일치 확인
- **관련 파일**:
  - `dream_guardian/src/render/CameraLayer.ts`
  - `dream_guardian/src/motion/PoseManager.ts`
  - `dream_guardian/src/main.ts`
  - `dream_guardian/tests/unit/pose-manager.test.ts`

---

### Issue #111 (Card #38): [GRID-DEPTH-001] 3D 드림 그리드 소실점 심도 페이드아웃 및 투명도(30%) 가시성 개선
- **GitHub URL**: https://github.com/Choyounhwa/-dream-guardian/issues/111
- **Labels**: `enhancement`, `phase-7`, `P2-medium`
- **작업 ID**: `[GRID-DEPTH-001]`
- **상태**: ✅ **완료 (Closed)**
- **목적**:
  - 소실점 중심의 직선 집중으로 인한 시각적 어색함을 해소하고, 화면 중앙부 이후로 자연스럽게 사라지는 원근 심도 감쇠(Depth Fog Fadeout)를 구현한다.
  - 그리드 기본 투명도를 30% 수준으로 상향하여 네온 와이어프레임의 시인성을 확보한다.
- **수정 대상**:
  - `dream_guardian/src/render/DreamGrid.ts`
  - `dream_guardian/tests/unit/dream-grid.test.ts`
- **구현 내용**:
  1. 소실점 심도 감쇠 (Depth Fog Fadeout):
     - 소실점 `(vx, vy)` 반경 일정 거리(화면 중앙부 기준) 이내의 선들이 자연스럽게 투명해지는 소프트 감쇠 마스크/알파 계산 적용
     - 세로선이 날카로운 단일 점으로 뭉치지 않고 지평선 안개처럼 자연스럽게 소멸하도록 드로잉 범위 보정
  2. 투명도 및 선명도 개선:
     - 기본 alpha를 0.30(30%)으로 상향 조정
     - 챕터별 테마 네온 컬러가 선명하게 돋보이도록 바닥/천장 알파 및 선명도 튜닝
  3. 단위 테스트 보강:
     - 투명도 30% 설정 및 심도 페이드 계산 무결성 검증
- **유지 사항**:
  - 가로/세로 정방형(Square Proportion) 격자 간격 계산 공식
  - 기존 18개 테스트 파일 221개 테스트 100% Pass 유지
- **변경 금지**:
  - 전투 시스템 및 보스 프로시저럴 드로잉 로직
  - 문제 출제 및 TTS 로직
- **완료 조건**:
  - [ ] 그리드 소실점 부근이 날카롭게 모이지 않고 화면 중앙부 너머로 부드럽게 사라짐
  - [ ] 그리드 색상이 30% 투명도로 뚜렷하게 관찰됨
  - [ ] `npm test` 100% 통과 및 `npm run build` 정상 완료
- **테스트 방법**:
  - `npm test` Vitest 단위 테스트 통과
  - `http://localhost:3000/` 에서 인게임 진입 시 배경 그리드 심도 및 선명도 육안 확인
- **관련 파일**:
  - `dream_guardian/src/render/DreamGrid.ts`
  - `dream_guardian/tests/unit/dream-grid.test.ts`

---

### Issue #112 (Card #39): [RUN-LOOP-001] 제자리 달리기 페이즈 인게임 루프 연동 및 드림 그리드 동적 반응 구현
- **GitHub URL**: https://github.com/Choyounhwa/-dream-guardian/issues/112
- **Labels**: `feature`, `phase-3`, `P1-high`
- **작업 ID**: `[RUN-LOOP-001]`
- **상태**: ⚪ **대기 (Ready)**
- **목적**:
  - 제자리 달리기 감지기(RunDetector) 및 키보드 Space 입력을 인게임 루프에 연결하여, 달리기 진행도에 따라 다음 문제로 이동하는 게임 사이클을 확립한다.
  - 달리기 속도에 맞춰 그리드 스크롤 가속 및 피버(75% 이상) 시 파란색 보간 전환 연출을 완성한다.
- **수정 대상**:
  - `dream_guardian/src/motion/RunDetector.ts`
  - `dream_guardian/src/render/DreamGrid.ts`
  - `dream_guardian/src/main.ts`
  - `dream_guardian/tests/unit/motion-detectors.test.ts`
- **구현 내용**:
  1. 달리기 게이지 및 전환 루프:
     - 문제 풀이 전 달리기 페이즈 실행 (게이지 0 -> 100 충전 시 문제 출제)
     - 웹캠 어깨 바운스 감지 및 PC 디버깅용 Space 연타로 게이지 충전 지원
  2. 드림 그리드 동적 연출:
     - 달리기 속도에 따른 DreamGrid 스크롤 속도 비례 증가
     - 기본 테마 색상 → 달리기 중 주황색 → 게이지 75% 이상 피버 시 파란색 동적 그라데이션 보간
  3. 단위 테스트 검증:
     - 게이지 충전 및 상태 전환, 속도 가속 배율 검증
- **유지 사항**:
  - 기존 포즈 인식 및 스켈레톤 렌더 파이프라인
  - 보스 체력 및 마나 시스템
- **완료 조건**:
  - [ ] 제자리 달리기(또는 Space)로 게이지가 차오르고 100% 도달 시 문제 출제
  - [ ] 달리기 시 그리드 스크롤이 빨라지고 색상이 주황/파랑으로 자연스럽게 전환
  - [ ] `npm test` 100% 통과 및 `npm run build` 정상 완료
- **테스트 방법**:
  - `http://localhost:3000/` 에서 제자리 달리기 동작 및 그리드 색상 전환 확인
- **관련 파일**:
  - `dream_guardian/src/main.ts`
  - `dream_guardian/src/render/DreamGrid.ts`
  - `dream_guardian/src/motion/RunDetector.ts`

---

---

### Issue #101 (Card #45): [BUG-001] 같은 문제 템플릿 연속 출제 방지 및 셔플 큐 anti-repeat 가드 강화
- **GitHub URL**: https://github.com/Choyounhwa/-dream-guardian/issues/101
- **Labels**: `bug`, `P0-critical`, `step-8`
- **작업 ID**: `[BUG-001]`
- **상태**: ✅ **완료 (Closed)**
- **목적**: 큐에 남은 항목이 1개이거나 풀 내에 동일 템플릿이 중복될 때 발생하는 연속 출제 버그를 조기 재셔플 및 가드 강화로 해결
- **수정 대상**:
  - `dream_guardian/src/question/QuestionBank.ts`
  - `dream_guardian/tests/unit/question-system.test.ts`
- **완료 조건**:
  - [x] 풀 크기 5인 상태에서 100회 시행(각 20회) 시 연속 동일 템플릿 0회
  - [x] 중복 템플릿 풀(T1, T1, T2, T3, T4)에서 100회 시행 시 연속 동일 템플릿 0회
  - [x] `npm test` 100% 통과

---

### Issue #102 (Card #46): [BUG-002] 문자열 정답, 종속 변수 및 복합 템플릿 평가 무결성 검증
- **GitHub URL**: https://github.com/Choyounhwa/-dream-guardian/issues/102
- **Labels**: `bug`, `P0-critical`, `step-8`
- **작업 ID**: `[BUG-002]`
- **상태**: ✅ **완료 (Closed)**
- **목적**: 685문항 전수 검사를 통해 문자열 정답(`>`, `<`, `3/5`, `101₍₂₎`), 종속 변수(VarC, VarD), 복합 수식 템플릿 치환 검증
- **수정 대상**:
  - `dream_guardian/src/question/QuestionEvaluator.ts`
  - `dream_guardian/tests/unit/question-system.test.ts`
- **완료 조건**:
  - [x] 3회 반복 전수 검사(2,055문항) 100% 생성 성공
  - [x] 미치환 템플릿 노출 0건, 정답==오답 중복 0건
  - [x] `npm test` 100% 통과

---

### Issue #103 (Card #40): [FEAT-001] 각 단계별 세부 난이도(SubLevel) 필터링 시스템 구현
- **GitHub URL**: https://github.com/Choyounhwa/-dream-guardian/issues/103
- **Labels**: `feature`, `P1-high`, `step-8`
- **작업 ID**: `[FEAT-001]`
- **상태**: ✅ **완료 (Closed)**
- **목적**:
  - `questions.csv`에 정의된 SubLevel(1~7)을 활용하여 각 챕터별 세부 난이도 필터링을 지원하고, Ch.5(나이트메어)에서 5~9단계(거듭제곱, 2진수, 도형, 비율, 기타)를 세부 단계(SubLevel)로 선택하여 집중 학습할 수 있도록 시스템을 확장한다. (Issue #106과 통합 연계)
- **수정 대상**:
  - `dream_guardian/src/question/QuestionBank.ts`
  - `dream_guardian/src/types/index.ts`
  - `dream_guardian/tests/unit/question-system.test.ts`
- **구현 내용**:
  1. `QuestionBank.ts` 기능 확장:
     - `setLevel(level: number, subLevel?: number): void`
       - Ch.1~4: `subLevel` 지정 시 해당 세부 단계만 필터링, 미지정 시 해당 챕터 전체 풀 유지 (하위 호환 100%)
       - Ch.5 (나이트메어):
         - `subLevel` 1: Level 5 (거듭제곱) 문제 풀
         - `subLevel` 2: Level 6 (2진수) 문제 풀
         - `subLevel` 3: Level 7 (도형) 문제 풀
         - `subLevel` 4: Level 8 (비율) 문제 풀
         - `subLevel` 5: Level 9 (기타) 문제 풀
         - `subLevel` 6 (또는 미지정): Level 1~9 전 영역 종합 풀
     - `getSubLevels(chapter: number): SubLevelInfo[]` 메서드 추가 (각 서브레벨 메타데이터 반환)
     - `currentSubLevel` getter 제공
  2. 단위 테스트 보강 (`tests/unit/question-system.test.ts`):
     - Ch.1~4의 특정 subLevel 필터링 동작 검증
     - Ch.5에서 5~9단계 서브레벨 분기 및 전 영역 종합 풀 검증
     - subLevel 미지정 시 기존 동작 100% 하위 호환 검증
- **유지 사항 & 변경 금지**:
  - 유지: 기존 `setLevel(level)` 단독 호출 시 기존 동작 100% 보존, Fisher-Yates 셔플 및 중복 출제 방지 가드 유지
  - 변경 금지: UI/렌더/전투 시스템 파일 및 questions.csv 원본 파일 변경 금지
- **완료 조건**:
  - [x] `setLevel(1, 2)` 호출 시 Ch.1 두자리 덧뺄셈(Level 1, SubLevel 2) 문제만 반환
  - [x] `setLevel(5, 1~5)` 호출 시 Level 5~9의 문제가 정상 반환
  - [x] `setLevel(5)` 호출 시 Level 1~9 전 영역 풀 반환
  - [x] `getSubLevels(chapter)`가 각 챕터의 세부 단계 메타데이터를 올바르게 반환
  - [x] `npm test` 100% 통과 (Pass)
- **관련 파일**:
  - `dream_guardian/src/question/QuestionBank.ts`
  - `dream_guardian/src/types/index.ts`
  - `dream_guardian/tests/unit/question-system.test.ts`

---

### Issue #106 (Card #41): [BUG-003] CSV 9개 Level과 게임 챕터 간 매핑 확장 및 정합성 보장
- **GitHub URL**: https://github.com/Choyounhwa/-dream-guardian/issues/106
- **Labels**: `bug`, `P2-medium`, `step-8`
- **작업 ID**: `[BUG-003]`
- **상태**: ✅ **완료 (Closed)**
- **목적**:
  - `questions.csv`에 존재하는 Level 1~9(총 685문항) 중 Level 5~9(371문항)를 Ch.5 나이트메어의 세부 서브레벨로 정식 매핑하여 접근성을 확보한다.
- **수정 대상**:
  - `dream_guardian/src/question/QuestionBank.ts`
  - `dream_guardian/tests/unit/question-system.test.ts`
- **구현 내용**:
  - Ch.5 나이트메어에 Level 5~9를 서브레벨(SubLevel 1~5)로 매핑하여 원하는 수학 영역을 선택할 수 있도록 개선
  - SubLevel 6(또는 미지정) 선택 시 기존의 전 영역 종합 혼합 풀로 동작 (완전한 하위 호환)
  - Issue #103과 통합 구현
- **완료 조건**:
  - [x] Ch.5 나이트메어에서 Level 5~9 세부 문제 풀 선택 가능
  - [x] SubLevel 미지정 시 전 영역 혼합 풀 유지
  - [x] `npm test` 100% 통과

---

### Issue #105 (Card #42): [FEAT-002] 10개 피트니스 존 4색 커서(머리 반영) 및 스테이지 점증 난이도(Tier 1~4) 구현
- **GitHub URL**: https://github.com/Choyounhwa/-dream-guardian/issues/105
- **Labels**: `feature`, `P1-high`, `step-10`
- **작업 ID**: `[FEAT-002]`
- **상태**: ✅ **완료 (Closed)**
- **목적**:
  - 국민체조 기반 10개 피트니스 존 및 4색 신체 커서 체계를 확립하고, 한 스테이지(10~15문제) 동안 플레이어의 신체 피로도와 두뇌 집중도를 최적화하는 점증적 난이도 곡선(Progressive Difficulty Curve)을 구현한다.
  - 카메라 인식 안정성과 직관적 조작을 위해 어깨 커서를 머리/얼굴(head) 커서로 수정 반영한다.
- **완료 내역**:
  - [x] 4색 커서 체계(왼손, 오른손, 머리/얼굴, 골반) 정상 동작 및 10존 매핑 준수
  - [x] 머리(head) 커서 상단/측면 존(1, 2, 3, 4, 5, 7) 한정 동작 및 하단존 차단 검증
  - [x] 문제 번호 기반 점증적 난이도 곡선(Tier 1~4) 및 체류시간(0.7s, 0.8s, 1.0s, 1.2s) 적용
  - [x] 고난도/복합 연산 출제 시 Tier 1~2로 자동 완화하는 두뇌 피로도 완충 룰 탑재
  - [x] Vitest 19개 파일 245개 테스트 100% Pass 및 빌드 정상 완료
- **핵심 사양**:
  1. 4색 신체 커서 (머리/얼굴 반영):
     - 왼손(시안 `#28E6FF`): 왼쪽 손바닥 (원 + 동심 링)
     - 오른손(노랑 `#FFCB4D`): 오른쪽 손바닥 (원 + 동심 링)
     - 머리/얼굴(보라 `#C889FF`): 코 중심/얼굴 중점 (둥근 타원)
     - 골반(주황 `#FF865E`): 양 골반 중점 (라운드 역삼각형, 하단존 6~10 전용)
  2. 스테이지 점증 난이도 (Tier 1 ~ Tier 4):
     - Tier 1 (문제 1~3 / 웜업): 단일 손, 체류 0.7초 (가벼운 팔 뻗기)
     - Tier 2 (문제 4~7 / 체간 스트레칭): 머리 기울이기 또는 양손 벌리기, 체류 0.8초
     - Tier 3 (문제 8~11 / 전신 협응): 손 + 골반(미니 스쿼트) 또는 머리 + 골반, 체류 1.0초
     - Tier 4 (문제 12+ / 보스 피니시): 양손 상단 만세 포즈, 체류 1.2초
  3. 두뇌 피로도 완충 밸런스 룰:
     - 복합 계산/긴 문제는 Tier 1~2로 자동 완화
     - 단순 계산 문제는 Tier 3로 신체 활동성 강화
     - 3연속 하체(골반) 금지 쿨다운 룰
- **수정 대상**:
  - `dream_guardian/src/input/AnswerSelector.ts`
  - `dream_guardian/src/types/index.ts`
  - `dream_guardian/tests/unit/input-system.test.ts`
---

### Issue #104 (Card #43): [PLAN-001] 카메라 트래킹 기반 4색 커서(머리 반영) 답안 선택 시스템 통합 구현 계획
- **GitHub URL**: https://github.com/Choyounhwa/-dream-guardian/issues/104
- **Labels**: `feature`, `P0-critical`, `step-10`
- **작업 ID**: `[PLAN-001]`
- **상태**: ✅ **완료 (Closed)**
- **완료 내역**:
  - [x] CursorTracker: MediaPipe Pose 및 Hands 연동 4색 커서(머리, 골반, 왼손, 오른손) 실시간 추출 및 정규화
  - [x] RecipeGenerator: Tier 1~4 점증 난이도 및 색상 비공유 레시피 동적 배정
  - [x] DeadlockGuard: 양쪽 선택지 동시 충족 시 취소 및 오입력 방지 가드
  - [x] AnswerSelectionRenderer: 활성 피트니스 존 네온 테두리, 충전 채움 바, 4색 커서(원/타원/역삼각) 시각화
  - [x] Integrator: `main.ts` 인게임 루프 연동 및 키보드 1/2, 화면 클릭 fallback 100% 보존
  - [x] Vitest 20개 파일 253개 테스트 100% Pass 및 번들 빌드 정상 완료
- **목적**:
  - `ANSWER_SELECTION_DESIGN.md` 및 최신 피트니스 사양에 따른 카메라 기반 4색 신체 커서 답안 선택 시스템의 통합 아키텍처 및 구현 계획 수립.
  - 카메라 인식 안정성을 극대화하기 위해 어깨 커서를 머리/얼굴(head) 커서로 개선하고, 스테이지 진행도에 맞춘 점증적 난이도 곡선(Tier 1~4)을 반영한다.
- **핵심 사양**:
  1. 4색 신체 커서 체계:
     - 왼손(시안 `#28E6FF`): 손바닥 중심 (Hands #9 / Pose #15)
     - 오른손(노랑 `#FFCB4D`): 손바닥 중심 (Hands #9 / Pose #16)
     - 머리/얼굴(보라 `#C889FF`): 코 중심/얼굴 중점 (Pose #0, 어깨 대체)
     - 골반(주황 `#FF865E`): 양 골반 중점 (Pose #23, 24, 하단존 6~10 전용)
  2. 10존 선택 메커니즘:
     - 공용 활성 피트니스 존 공유 (좌/우 색상 비공유)
     - 단일 색상 원칙, 중심 가중 충전 (중심 1.5배, 경계 0.75배)
     - 동시 충족 교착 방지 (Deadlock Guard)
  3. 스테이지 점증 난이도 곡선:
     - Tier 1(문제 1~3): 단일 손, 0.7초
     - Tier 2(문제 4~7): 머리/양손, 0.8초
     - Tier 3(문제 8~11): 손+골반, 1.0초
     - Tier 4(문제 12+): 양손 상단 만세, 1.2초
- **구현 분리 계획 (6개 서브 태스크)**:
  1. CursorTracker: PoseManager/HandsManager 연동 4색 커서 좌표 추출
  2. ZoneManager & AnswerSelector: 10존 레이아웃 및 동적 체류 판정
  3. RecipeGenerator: 문제 번호별 점증 난이도 레시피 생성
  4. DeadlockGuard: 양쪽 동시 충족 방지 및 즉시 리셋
  5. AnswerSelectionRenderer: 활성 존 테두리/펄스 및 커서 HUD 시각화
  6. Integrator: main.ts 게임 루프 연동 (키보드 1/2 및 클릭 fallback 완벽 유지)
- **완료 조건**:
  - [ ] 머리/얼굴(head) 및 손바닥 커서 트래킹 무결성 검증
  - [ ] 스테이지 문제 번호에 따른 점증 난이도 및 체류시간 전환 검증
  - [ ] 카메라 ON 환경에서 4색 커서로 답안 선택 및 보스전 진행 정상 동작
  - [ ] 카메라 OFF 환경에서 키보드(1/2) 및 클릭 선택 100% 정상 동작
  - [ ] `npm test` 100% 통과

---

### Issue #112: [RUN-LOOP-001] 제자리 달리기 페이즈 인게임 루프 연동 및 드림 그리드 동적 반응 구현
- **GitHub URL**: https://github.com/Choyounhwa/-dream-guardian/issues/112
- **Labels**: `feature`, `P1-high`, `phase-3`
- **작업 ID**: `[RUN-LOOP-001]`
- **상태**: ✅ **완료 (Closed)**
- **목적**: 제자리 달리기 감지기(RunDetector) 및 키보드 Space/클릭 입력을 인게임 루프에 연결하여, 달리기 진행도에 따라 다음 문제로 이동하는 게임 사이클을 확립하고, 달리기 속도에 맞춰 그리드 스크롤 가속 및 피버(75% 이상) 시 파란색 보간 전환 연출을 완성
- **수정 대상**:
  - `dream_guardian/src/motion/RunDetector.ts`
  - `dream_guardian/src/render/DreamGrid.ts`
  - `dream_guardian/src/main.ts`
  - `dream_guardian/tests/unit/motion-detectors.test.ts`
- **완료 조건**:
  - [x] 제자리 달리기(또는 Space/클릭)로 게이지가 차오르고 100% 도달 시 문제 출제
  - [x] 달리기 시 그리드 스크롤이 빨라지고 색상이 주황/파랑으로 자연스럽게 전환
  - [x] `npm test` 100% 통과 및 빌드 정상 완료 (224개 통과)

---

---

### Issue #114 (Card #44): [RENDER-MATH-001] Canvas 2D 기반 직관적 수학 수식(가로 분수선, 지수, 루트, 빈칸 박스) 렌더러 구현
- **GitHub URL**: https://github.com/Choyounhwa/-dream-guardian/issues/114
- **Labels**: `feature`, `P1-high`, `phase-4`
- **작업 ID**: `[RENDER-MATH-001]`
- **상태**: ✅ **완료 (Closed)**
- **목적**:
  - 기존 한 줄 텍스트(`ctx.fillText`) 렌더링으로 인해 사선(`/`)으로 뭉개지던 분수를 **중앙 가로 분수선($\frac{A}{B}$)**으로 표기하고, 거듭제곱(지수), 근호(루트 상단선), 빈칸 박스($\boxed{\ ?\ }$)를 교과서처럼 직관적으로 시각화하는 독립적인 수학 수식 렌더러(`MathRenderer`)를 구현한다.
- **수정 대상**:
  - `dream_guardian/src/types/index.ts` (MathToken 등 수식 타입 정의)
  - `dream_guardian/src/render/MathRenderer.ts` (신규 수식 렌더러 모듈)
  - `dream_guardian/src/main.ts` (문제 및 답안 수식 렌더링 연동)
  - `dream_guardian/tests/unit/math-renderer.test.ts` (신규 단위 테스트)
- **완료 조건**:
  - [x] `1/2 + 3/4` 문제 및 선택지가 사선이 아닌 상하 가로 분수선으로 렌더링
  - [x] 거듭제곱(`5²`, `10⁴`) 및 루트(`√16`) 기호가 교과서 표기법으로 깔끔하게 렌더링
  - [x] `[ ? ]` 빈칸이 둥근 네온 사각 박스로 렌더링
  - [x] 기존 222개 테스트 포함 `npm test` 100% Pass

---

### Issue #115 (Card #103-B): [FEAT-001-B] 챕터별 세부 난이도(SubLevel) 선택 메뉴 UI 및 게임 진입 플로우 구현
- **GitHub URL**: https://github.com/Choyounhwa/-dream-guardian/issues/115
- **Labels**: `feature`, `P1-high`, `phase-6`
- **작업 ID**: `[FEAT-001-B]`
- **상태**: ✅ **완료 (Closed)**
- **목적**:
  - Issue #103에서 QuestionBank에 구축된 SubLevel 필터링 데이터 시스템을 기반으로, 챕터 선택 후 세부 난이도(SubLevel)를 시각적으로 선택할 수 있는 서브레벨 선택 메뉴 UI(`MENU_SUB`) 및 게임 진입 플로우를 구현한다.
- **수정 대상**:
  - `dream_guardian/src/ui/MenuRenderer.ts`
  - `dream_guardian/src/ui/index.ts`
  - `dream_guardian/src/main.ts`
  - `dream_guardian/tests/unit/ui-system.test.ts`
- **완료 조건**:
  - [x] 챕터 선택 시 세부 난이도(SubLevel) 목록 카드가 화면에 정상 렌더링
  - [x] 특정 서브레벨 선택 시 해당 난이도 문제만 출제되며 게임 시작
  - [x] '전체 종합 (ALL)' 선택 시 해당 챕터 전체 문제 풀로 출제
  - [x] '뒤로가기' 클릭 및 Esc/0/Backspace 키 입력 시 메인 챕터 선택 메뉴로 복귀
  - [x] Vitest 20개 파일 255개 테스트 100% Pass 및 번들 빌드 정상 완료

---

### Issue #116 (Card #47): [BUG-CURSOR-001] 문제선택 화면 스켈레톤-커서 좌표계 이격 해결 (Cover 변환 동기화)
- **GitHub URL**: https://github.com/Choyounhwa/-dream-guardian/issues/116
- **Labels**: `bug`, `P0-critical`, `phase-3`
- **작업 ID**: `[BUG-CURSOR-001]`
- **상태**: 🟢 **완료 (Completed)**
- **목적**:
  - 문제선택 화면(`gamePhase === 'question'`)에서 화면에 그려진 스켈레톤 관절(손, 머리, 골반)과 4색 커서(원, 타원, 삼각형)의 위치가 크게 어긋나는 이격(Discrepancy) 결함을 해결하고, 웹캠 미러 피드 및 스켈레톤과 커서 좌표계를 1:1로 일치시킨다.
- **현상 및 원인 분석**:
  1. **Cover 뷰포트 스케일 불일치**:
     - `CameraLayer`는 18:9 캔버스(1080x2160)에 16:9 웹캠을 Cover 모드로 렌더링하며, 중앙 기준 `scale = Math.max(vw/vW, vh/vH) = 3.0`로 확대되어 좌우가 잘려나감(`dw=3840`, `dh=2160`, 좌우 각 1380px 크롭).
     - `PoseManager.virtualLandmarks`는 `cameraLayer.landmarkToCanvas(lm, vw, vh)`를 통해 이 Cover 변환을 적용하여 스켈레톤 뼈대와 관절을 렌더링함.
  2. **커서 추적 좌표계의 단순 선형 스케일링**:
     - `main.ts`에서 `answerSelector.updateFromPose`를 호출할 때 Cover 변환이 되지 않은 `poseManager.rawLandmarks`(0~1 정규화)를 그대로 전달함.
     - `CursorTracker.ts`는 `1 - lm.x`만 수행하고, `AnswerSelectionRenderer.ts`는 `pos.x * w`로 단순 곱셈함.
     - 결과적으로 스켈레톤 관절은 Cover 줌(3.0배)된 좌표에 그려지는 반면, 커서는 비확대 0~1 공간에 그려져 수백 픽셀 이상의 심각한 이격이 발생함.
  3. **피트니스 존 판정 왜곡**:
     - 커서가 잘못된 좌표에 있으므로 피트니스 존과의 접촉 판정 역시 사용자의 실제 신체 위치와 일치하지 않음.
- **수정 대상**:
  - `dream_guardian/src/input/CursorTracker.ts`
  - `dream_guardian/src/input/AnswerSelector.ts`
  - `dream_guardian/src/render/AnswerSelectionRenderer.ts`
  - `dream_guardian/src/main.ts`
  - `dream_guardian/tests/unit/cursor-tracker-recipe.test.ts`
- **구현 내용**:
  1. `CursorTracker` 및 `AnswerSelector`에 뷰포트 프로젝션 함수(`projectFn` 또는 Cover 변환)를 연동하거나, `main.ts`에서 Cover 좌표계로 변환된 정규화/가상 랜드마크를 주입하여 스켈레톤과 1:1 일치 보장.
  2. `AnswerSelectionRenderer`의 커서 드로잉 좌표가 `JointRenderer`의 관절 좌표와 오차 0px로 일치하도록 동기화.
  3. 피트니스 존 판정 좌표계와 커서 좌표계의 정합성 보장.
- **완료 조건**:
  - [x] 스켈레톤 관절(머리, 손, 골반) 위치와 4색 커서의 중심 위치가 1:1로 정확하게 일치
  - [x] 창 크기 및 캔버스 스케일이 변경되어도 스켈레톤과 커서 간 이격이 발생하지 않음
  - [x] `npm test` 100% Pass 및 빌드 정상 완료

---

### Issue #117 (Card #48): [FEAT-CURSOR-001] 신체 부위 크기 추정 기반 커서 동적 사이징, 채움색 제거(테두리 전용) 및 손바닥(Palm) 중심 트래킹 고도화
- **GitHub URL**: https://github.com/Choyounhwa/-dream-guardian/issues/117
- **Labels**: `feature`, `P1-high`, `phase-3`, `phase-6`
- **작업 ID**: `[FEAT-CURSOR-001]`
- **상태**: 🟢 **완료 (Completed)**
- **목적**:
  - 카메라와의 거리에 따라 신체 부위 크기를 추정하여 커서 크기를 자연스럽게 맞추고, 시야를 가리는 채움색을 제거하여 깔끔한 네온 외곽선(Stroke only)으로 표현한다.
  - 양손 커서를 단순 손목(Wrist)이 아닌 실제 손바닥 중심(Palm center)으로 정밀 트래킹한다.
- **수정 대상**:
  - `dream_guardian/src/input/CursorTracker.ts`
  - `dream_guardian/src/render/AnswerSelectionRenderer.ts`
  - `dream_guardian/src/main.ts`
  - `dream_guardian/tests/unit/cursor-tracker-recipe.test.ts`
- **구현 내용**:
  1. **손바닥(Palm) 중심 트래킹 고도화**:
     - MediaPipe Hands 손바닥 랜드마크(#9) 연동.
     - Hands 부재 시 Pose 손목(#15/#16), 손가락 관절(#17/#19, #18/#20), 엄지(#21/#22)의 가중 중심 및 전완 방향 벡터 연장을 통해 실제 손바닥 중심점을 정밀 추정.
  2. **신체 부위별 크기 동적 추정**:
     - 머리(Head): 양 귀 간격(#7-#8) 또는 코-어깨 거리 기반으로 사용자의 원거리/근거리 깊이에 비례한 타원 반경 동적 계산.
     - 손(Hand): 손목-손가락 길이 또는 어깨 너비 비례 원 반지름 동적 계산.
     - 골반(Hip): 좌우 골반(#23-#24) 간격 비례 삼각형 너비/높이 동적 계산.
  3. **채움색 제거 (채움색 없음 / Outline Only)**:
     - `AnswerSelectionRenderer`에서 `ctx.fill()` 제거.
     - 투명 내부 + 네온 테두리(`ctx.stroke()`)만 렌더링하여 게임 화면 시인성 극대화.
     - 체류 진행도(Dwell Progress) 표시 시에만 외곽 아크 또는 게이지 테두리 점등.
- **완료 조건**:
  - [x] 4색 커서(손, 머리, 골반)에 채움색이 전혀 없고 깔끔한 네온 외곽선으로만 렌더링
  - [x] 플레이어가 카메라에 가까워지거나 멀어질 때 커서 크기가 신체 부위 크기에 비례하여 동적 조절
  - [x] 양손 커서가 손목 관절이 아니라 실제 손바닥 중심을 정확히 추적
  - [x] `npm test` 100% Pass 및 빌드 정상 완료

---

### Issue #118 (Card #49): [FEAT-CURSOR-002] 커서 화면 이탈 방지 상위 스켈레톤 계층 Fallback 및 스무딩 이동 구현
- **GitHub URL**: https://github.com/Choyounhwa/-dream-guardian/issues/118
- **Labels**: `feature`, `P1-high`, `phase-3`, `phase-6`
- **작업 ID**: `[FEAT-CURSOR-002]`
- **상태**: 🟢 **완료 (Completed)**
- **목적**:
  - 정답 선택 시 플레이어가 손이나 신체를 화면 밖으로 크게 뻗었을 때, 커서가 사라지거나 깜빡이지 않고 자연스럽게 상위 관절을 따라 화면 내에 유지되도록 계층 Fallback 및 보간 이동을 구현한다.
- **수정 대상**:
  - `dream_guardian/src/input/CursorTracker.ts`
  - `dream_guardian/src/input/AnswerSelector.ts`
  - `dream_guardian/tests/unit/cursor-tracker-recipe.test.ts`
- **구현 내용**:
  1. **상위 스켈레톤 Fallback 계층 정의**:
     - 손 커서: 손바닥(Palm) → 손목(Wrist, #15/#16) → 전완(Forearm, 손목-팔꿈치 중점) → 팔꿈치(Elbow, #13/#14) → 상완(Upper Arm, 팔꿈치-어깨 중점) → 어깨(Shoulder, #11/#12).
     - 머리 커서: 코(#0) → 눈/귀 중점 → 목/어깨 중점.
     - 골반 커서: 골반 중점(#23/#24) → 체간(Torso) 중점 → 어깨 중점.
  2. **화면 이탈 및 신뢰도 저하 감지**:
     - 정규화 좌표가 화면 밖(`x < 0 || x > 1 || y < 0 || y > 1`)으로 벗어나거나 신뢰도 < 임계값일 때, 상위 계층 관절 순으로 즉시 탐색하여 유효한 최상위 관절 좌표 선택.
  3. **스무딩(Lerp) 및 이탈 방지 경계 클램프**:
     - 커서가 즉시 사라지지 않고, 이전 위치에서 상위 관절 위치로 부드럽게 지수 보간(Lerp Factor 0.25) 이동.
     - 화면 경계에 부드럽게 머물도록 마진 기반 클램핑 적용하여 깜빡임(Flickering) 및 소멸 원천 차단.
- **완료 조건**:
  - [x] 손바닥이 화면 밖으로 나가도 커서가 사라지지 않고 손목/전완/팔꿈치/어깨로 자연스럽게 이동
  - [x] 깜빡임이나 끊김 없는 부드러운 전환(Lerp) 확인
  - [x] 화면 경계 근처에서도 답안 영역 조작 가능성 유지
  - [x] `npm test` 100% Pass 및 빌드 정상 완료

---

### Issue #119 (Card #50): [BUG-MENU-001] 메뉴 화면 4색 커서 상시 가시화 및 양손 모으기(MenuInput) 제스처 메뉴 선택 기능 누락 복원
- **GitHub URL**: https://github.com/Choyounhwa/-dream-guardian/issues/119
- **Labels**: `bug`, `P1-high`, `phase-3`, `phase-6`
- **작업 ID**: `[BUG-MENU-001]`
- **상태**: 🟢 **완료 (Completed)**
- **목적**:
  - 스켈레톤 커서 및 메뉴 제스처 입력 모듈(`MenuInput.ts`)이 개발되었으나, `main.ts` 메인 루프에 전혀 연동되지 않아 런타임에서 양손 모으기(합장) 메뉴 선택이 완전히 누락된 결함을 복원한다.
  - 메인 메뉴 화면(`screenMode === 'menu'`)에서 4색 커서가 렌더링되지 않아 모션으로 메뉴를 조작할 수 없는 문제를 해결한다.
- **현상 및 원인 분석**:
  1. **모듈 미연동 누락**:
     - `MenuInput.ts`가 `src/input/MenuInput.ts`에 독립 클래스로 구현되어 단위 테스트까지 존재하지만, `main.ts`에 import되지도 인스턴스화되지도 않음.
  2. **메뉴 루프 내 커서 비활성화**:
     - `screenMode === 'menu'` 상태에서 `CursorTracker` 및 `AnswerSelectionRenderer`가 갱신 및 호출되지 않아 스켈레톤 라인만 표시되고 커서가 전면 숨김 상태임.
  3. **양손 모으기 호버 체류 판정 부재**:
     - 메뉴 선택이 오직 마우스 `click`과 키보드 `keydown`(1~5, Esc)으로만 동작함.
- **수정 대상**:
  - `dream_guardian/src/main.ts`
  - `dream_guardian/src/input/MenuInput.ts`
  - `dream_guardian/src/ui/MenuRenderer.ts`
  - `dream_guardian/tests/unit/input-system.test.ts`
- **구현 내용**:
  1. `main.ts`에 `MenuInput` 인스턴스 연동 및 메뉴 루프에서 양손 좌표 기반 합장 감지 활성화.
  2. 메뉴 화면(`MENU_MAIN`, `MENU_SUB`)에서 4색 신체 커서 또는 양손 모으기 커서('손 모으기' 링) 실시간 렌더링.
  3. 챕터 카드 및 서브레벨 카드에 호버 체류 시 프로그레스 아크를 표시하고, 0.8초 달성 시 메뉴 선택 자동 트리거.
  4. 기존 마우스 클릭 및 키보드(1~5, Esc) Fallback 조작 100% 보존.
- **완료 조건**:
  - [x] 첫 메뉴 화면 진입 즉시 신체 커서 및 양손 모으기 커서가 화면에 표시됨
  - [x] 카메라 앞에서 양손을 모아 챕터 카드/서브레벨 카드에 0.8초 체류 시 터치 없이 메뉴가 선택되어 게임 진입
  - [x] 마우스 클릭 및 키보드(1~5, Esc) Fallback이 정상 유지됨
  - [x] `npm test` 100% Pass 및 빌드 정상 완료

---

### Issue #120 (Card #51): [CFG-001] 존/커서/티어 설정 config/ 외부화 및 Config 분리
- **GitHub URL**: https://github.com/Choyounhwa/-dream-guardian/issues/120
- **Labels**: `refactor`, `P1-high`, `phase-3`
- **작업 ID**: `[CFG-001]`
- **상태**: 🟢 **완료 (Completed)**
- **목적**:
  - 개발 규칙 6절(데이터와 코드 분리) 및 RC-8에 따라, `AnswerSelector`, `RecipeGenerator` 등에 하드코딩된 피트니스 존 좌표, 커서 색상 및 감도, 티어별 체류시간 상수들을 `config/` 디렉터리로 외부화하여 관리한다.
- **수정 대상**:
  - `dream_guardian/config/zone.config.ts` (신규)
  - `dream_guardian/config/cursor.config.ts` (신규)
  - `dream_guardian/config/posture.config.ts` (신규)
  - `dream_guardian/src/core/Config.ts`
  - `dream_guardian/src/input/AnswerSelector.ts`
  - `dream_guardian/src/input/RecipeGenerator.ts`
  - `dream_guardian/tests/unit/architecture.test.ts`
- **구현 내용**:
  1. `config/zone.config.ts`: 10개/11개 피트니스 존 좌표(`DEFAULT_FITNESS_ZONES`) 분리 정의
  2. `config/cursor.config.ts`: 커서 색상(`CURSOR_COLORS`), 신뢰도 임계값 분리 정의
  3. `config/posture.config.ts`: 티어별 기본 체류시간(0.7s~1.2s), 감쇠 계수 분리 정의
  4. 기존 코드에서 하드코딩 상수를 제거하고 `config/` 모듈 참조로 교체
  5. `architecture.test.ts`의 dwellTime 검증 동기화
- **유지 사항**:
  - 기존 판정 로직 및 렌더러 동작 일관성 유지
- **변경 금지**:
  - 문제 출제, 수식 계산, 전투 HP/마나 시스템
- **완료 조건**:
  - [x] `config/` 디렉터리에 존/커서/자세 설정 파일 분리 생성 완료
  - [x] 기존 판정 로직 및 렌더러 동작에 영향 없이 `npm test` 100% Pass
  - [x] 빌드(`npm run build`) 0 에러

---

### Issue #121 (Card #52): [ZONE-001] 피트니스 존 레이아웃 재정의 (겹침 제거 및 문제/답안 밴드 예약)
- **GitHub URL**: https://github.com/Choyounhwa/-dream-guardian/issues/121
- **Labels**: `feature`, `P1-high`, `phase-6`
- **작업 ID**: `[ZONE-001]`
- **상태**: 🟢 **완료 (Completed)**
- **목적**:
  - RC-9(존 4·5와 6·7·8이 y 0.55~0.58 겹침 및 답안 오브와 존 겹침), RC-6(머리·골반 존 7 중복 충돌)을 해결하고, 18:9 화면 비율에 맞춘 겹침 없는 존 레이아웃과 문제/답안 전용 밴드를 확립한다.
- **수정 대상**:
  - `dream_guardian/config/zone.config.ts`
  - `dream_guardian/src/input/AnswerSelector.ts`
  - `dream_guardian/src/render/AnswerSelectionRenderer.ts`
  - `dream_guardian/tests/unit/input-system.test.ts`
- **구현 내용**:
  1. 상단 문제 밴드(y: 0.18~0.32), 중앙 답안 밴드(y: 0.44~0.56) 영역 예약
  2. 존 1~3 (상단/머리·만세 존, y: 0.02~0.18) 재배치
  3. 존 4~5 (중단 측면 존, y: 0.32~0.44) 재배치
  4. 존 6~8 (중하단 존, y: 0.58~0.74, 골반/낮은 손) 재배치
  5. 존 9~10 (하단 존, y: 0.76~0.92, 스쿼트/딥 존) 재배치
  6. 모든 존 간 경계 여백(최소 2% 이상) 확보하여 겹침(Overlap) 0% 보장
  7. `HEAD_ZONES` ∩ `HIP_ZONES` = ∅ (머리-골반 동일 존 충돌 방지) 확립
- **완료 조건**:
  - [x] 10개 피트니스 존 간 겹침 면적이 0%임을 수치 검증
  - [x] 문제 텍스트 및 답안 버튼이 피트니스 존 영역과 겹치지 않음
  - [x] 머리와 골반의 허용 존 집합이 상호 배타적임 확인
  - [x] `npm test` 100% Pass

---

### Issue #122 (Card #53): [DATA-001] 피트니스 패턴 원본 데이터(fitness pattern.csv) 로더 및 유효성 검증기 구현
- **GitHub URL**: https://github.com/Choyounhwa/-dream-guardian/issues/122
- **Labels**: `feature`, `P1-high`, `phase-4`
- **작업 ID**: `[DATA-001]`
- **상태**: 🟢 **완료 (Done - 2026-09-22)**
- **목적**:
  - `fitness pattern.csv`(360건: Single 60, Double 100, Triple 100, Quad 100) 데이터를 파싱하고, 게임 엔진에서 활용 가능한 타입화된 피트니스 패턴 풀로 로드 및 사전 검증한다.
- **수정 대상**:
  - `dream_guardian/src/data/FitnessPatternLoader.ts` (신규)
  - `dream_guardian/src/types/posture.ts` (또는 `types/index.ts`)
  - `dream_guardian/tests/unit/fitness-pattern-loader.test.ts` (신규)
- **구현 내용**:
  1. `FitnessPatternLoader.ts`: CSV 파서(헤더: ID, 사용 부위, 왼손, 오른손, 머리, 골반, 판정 부위 수) 구현
  2. `S001`~`Q100` 360개 패턴 파싱 및 타입 인스턴스 생성
  3. 존 번호 파싱(1~11, 'X' 처리) 및 부위별 매핑
  4. 부위 수/존 수 불일치 데이터 유효성 검증
- **완료 조건**:
  - [x] `fitness pattern.csv` 360건 전수 무오류 파싱
  - [x] S(60건), D(100건), T(100건), Q(100건) 필터링 단위 테스트 통과
  - [x] `npm test` 100% Pass

---

### Issue #123 (Card #54): [POSE-001] 자세 선택 시스템 AnswerPosture 및 PostureProgress 데이터 타입 신설
- **GitHub URL**: https://github.com/Choyounhwa/-dream-guardian/issues/123
- **Labels**: `feature`, `P1-high`, `phase-3`
- **작업 ID**: `[POSE-001]`
- **상태**: 🟢 **완료 (Done - 2026-09-22)**
- **목적**:
  - RC-1(부위↔존 고정 인덱스 페어링 한계)과 RC-5(진행도 2슬롯 한계)를 극복하기 위해, 다중 부위-다중 존 집합 덮기 및 존별/부위별 독립 진행도를 지원하는 신규 데이터 타입을 정의한다.
- **수정 대상**:
  - `dream_guardian/src/types/posture.ts` (신규)
  - `dream_guardian/src/types/index.ts`
  - `dream_guardian/tests/unit/architecture.test.ts`
- **구현 내용**:
  1. `BodyPart`: `'leftHand' | 'rightHand' | 'head' | 'hip'`
  2. `AnswerPosture`: `choiceIndex`, `parts: BodyPart[]`, `zoneIds: number[]`, `binding: 'any' | 'ordered'`, `gates?: PartGate[]`, `patternId: string`
  3. `PostureProgress`: `choiceIndex`, `progress: number`, `met: boolean`, `partStates: { part: BodyPart; zoneId: number | null }[]`, `zoneCovered: Record<number, boolean>`
  4. 기존 `ChoiceRecipe`와의 상호 호환 어댑터 타입 제공
- **완료 조건**:
  - [x] 신규 자세 타입 컴파일 0 에러 (`npm run build`)
  - [x] 아키텍처 단위 테스트 통과
  - [x] `npm test` 100% Pass

---

### Issue #124 (Card #55): [POSE-002] 집합 덮기(Set Coverage) 기반 matchPosture 판정 알고리즘 및 단위 테스트 구현
- **GitHub URL**: https://github.com/Choyounhwa/-dream-guardian/issues/124
- **Labels**: `feature`, `P0-critical`, `phase-3`
- **작업 ID**: `[POSE-002]`
- **상태**: 🟢 **완료 (Done - 2026-09-22)**
- **목적**:
  - RC-1(양손 동일 존 불가), G-8(D061 양손 존2 등)을 완벽히 지원하기 위해, 고정 1:1 페어링을 폐기하고 집합 덮기(Set Coverage) 기반의 수학적 판정 술어 `matchPosture()`를 구현한다.
- **수정 대상**:
  - `dream_guardian/src/input/PostureMatcher.ts` (신규)
  - `dream_guardian/src/input/AnswerSelector.ts`
  - `dream_guardian/tests/unit/posture-matcher.test.ts` (신규)
- **구현 내용**:
  1. 집합 덮기 술어 구현:
     - (A) 모든 요구 부위가 어떤 활성 존 내부에 존재: `∀ p ∈ P : ∃ z ∈ Z, inside(p, z)`
     - (B) 모든 활성 존이 최소 1개 이상의 요구 부위로 덮임: `∀ z ∈ Z : ∃ p ∈ P, inside(p, z)`
  2. 2부위 1존, 2부위 2존(정방향 및 좌우 역방향 교환 허용), 3부위 1~3존, 4부위 지원
  3. 한 존에 몰림 방지 (조건 B) 검증
  4. `binding: 'ordered'` 시 순서 엄격 판정 옵션
  5. 단위 테스트 슈트 12종 이상 작성
- **완료 조건**:
  - [x] 2부위 1존: 두 부위 모두 존 내부 → met / 한 부위만 → not met
  - [x] 2부위 2존: 정방향 met / 역방향(좌우 교환) met (RC-1 해결)
  - [x] 2부위 2존: 두 부위가 같은 존에 몰림 → not met (조건 B 검증)
  - [x] 3부위 1존 / 2존 / 3존 각 케이스 통과
  - [x] `npm test` 100% Pass

---

### Issue #125 (Card #56): [POSE-003] 패턴 풀 기반 좌/우 선택지 추출기 및 생성 제약(C1~C7) 검증기 구현
- **GitHub URL**: https://github.com/Choyounhwa/-dream-guardian/issues/125
- **Labels**: `feature`, `P1-high`, `phase-3`
- **작업 ID**: `[POSE-003]`
- **상태**: 🟢 **완료 (Done - 2026-09-22)**
- **목적**:
  - RC-4, RC-6을 해결하여, 문제 출제 시 플레이어가 양쪽 답안을 동시에 충족하거나 머리/골반이 충돌하지 않도록 7대 안전 제약조건(C1~C7)을 만족하는 자세 쌍을 생성한다.
- **수정 대상**:
  - `dream_guardian/src/input/PostureGenerator.ts` (신규)
  - `dream_guardian/src/input/RecipeGenerator.ts`
  - `dream_guardian/tests/unit/posture-generator.test.ts` (신규)
- **구현 내용**:
  1. C1: `|union(A.zoneIds, B.zoneIds)| <= 최대 존 수 (3)`
  2. C2: `A.parts \ B.parts ≠ ∅` AND `B.parts \ A.parts ≠ ∅` (배타 부위 보장으로 동시 충족 Deadlock 원천 차단)
  3. C3: head와 hip 동일 존 요구 배제
  4. C4: head와 hip 동시 요구 시 `zone(head).y < zone(hip).y` 보장
  5. C5: 부위별 허용 존 검증 (머리: 1~4, 골반: 6~11 등)
  6. C6: `parts.length >= distinct(zoneIds).length`
  7. C7: 최근 3문제 내 동일 `patternId` 제외 쿨다운
- **완료 조건**:
  - [x] 100회 연속 생성 시 C1~C7 위반 0건
  - [x] 양쪽 선택지 동시 만족 조합 생성 차단 확인
  - [x] `npm test` 100% Pass

---

### Issue #126 (Card #57): [POSE-004] PartGate (캘리브레이션 기준선 대비 신체 변위) 판정 구현
- **GitHub URL**: https://github.com/Choyounhwa/-dream-guardian/issues/126
- **Labels**: `feature`, `P1-high`, `phase-3`
- **작업 ID**: `[POSE-004]`
- **상태**: 🟢 **완료 (Done - 2026-09-22)**
- **목적**:
  - RC-3(단순 직립 상태만으로 존 2와 존 7에 머리/골반이 닿아 자동 충족되는 결함)을 해결하기 위해, 캘리브레이션 기준선 대비 실제 신체 움직임(변위)을 확인하는 `PartGate` 판정을 도입한다.
- **수정 대상**:
  - `dream_guardian/src/input/PartGateEvaluator.ts` (신규)
  - `dream_guardian/src/motion/CalibrationHelper.ts`
  - `dream_guardian/src/input/AnswerSelector.ts`
  - `dream_guardian/tests/unit/part-gate.test.ts` (신규)
- **구현 내용**:
  1. 캘리브레이션 시 저장된 중립 기준선(코 Y, 어깨 Y, 골반 Y) 활용
  2. 스쿼트 요구 시 골반 Y의 하강 변위(`Δy >= threshold`) 검증
  3. 머리 기울이기 요구 시 코 X/Y의 상대 변위 검증
  4. 팔 뻗기/만세 요구 시 손목-어깨 거리 및 상향 변위 검증
- **완료 조건**:
  - [x] 기준선 변위 미달 시 존 내부라도 not met 판정
  - [x] 실제 동작 수행 시 정상 충족 확인
  - [x] `npm test` 100% Pass

---

### Issue #127 (Card #58): [ICON-001] PartIconRenderer 신설 (손/머리/골반 부위별 공통 아이콘 시스템)
- **GitHub URL**: https://github.com/Choyounhwa/-dream-guardian/issues/127
- **Labels**: `feature`, `P2-medium`, `phase-6`
- **작업 ID**: `[ICON-001]`
- **상태**: 🟢 **완료 (Completed)**
- **목적**:
  - 스켈레톤 커서와 답안 버튼, 피트니스 존에서 동일한 형상과 색상의 부위별 아이콘을 렌더링하여 플레이어의 직관성을 극대화한다.
- **수정 대상**:
  - `dream_guardian/src/render/PartIconRenderer.ts` (신규)
  - `dream_guardian/src/render/index.ts`
  - `dream_guardian/tests/unit/part-icon-renderer.test.ts` (신규)
- **구현 내용**:
  1. 왼손: 시안 `#28E6FF`, 좌향 손바닥 실루엣 벡터 드로잉
  2. 오른손: 노랑 `#FFCB4D`, 우향 미러 손바닥 실루엣 벡터 드로잉
  3. 머리: 보라 `#C889FF`, 원형 얼굴 + 2점 눈 드로잉
  4. 골반: 주황 `#FF865E`, 라운드 다이아몬드(마름모) 드로잉
  5. 임의 크기(`size`), 중심 좌표(`cx, cy`), 알파, 외곽선/채움 모드 지원
- **완료 조건**:
  - [ ] 4개 부위 아이콘이 캔버스에 선명하게 렌더링
  - [ ] 단위 테스트: 드로잉 커맨드 호출 무오류 검증
  - [ ] `npm test` 100% Pass

---

### Issue #128 (Card #59): [UI-001] 답안 버튼 부위 아이콘, 색상 및 묶음 기호(함께/각각) 시각화
- **GitHub URL**: https://github.com/Choyounhwa/-dream-guardian/issues/128
- **Labels**: `feature`, `P1-high`, `phase-6`
- **작업 ID**: `[UI-001]`
- **상태**: 🟢 **완료 (Completed)**
- **목적**:
  - RC-2(답안 UI에 부위 정보 부재)를 해결하여, 답안 오브 아래에 어떤 부위 커서를 어떤 방식으로 배치해야 하는지(한 존 vs 각 존)를 아이콘과 묶음 기호로 직관적으로 표시한다.
- **수정 대상**:
  - `dream_guardian/src/render/MathRenderer.ts` 또는 `main.ts (renderQuestion)`
  - `dream_guardian/src/render/PartIconRenderer.ts`
  - `dream_guardian/tests/unit/ui-system.test.ts`
- **구현 내용**:
  1. 답안 버튼 하단에 요구 부위 아이콘 나열 렌더링
  2. 묶음 기호 표기:
     - 부위 2~3개 / 1개 존: `(아이콘 아이콘)` 괄호 묶음 ("함께 한 존에")
     - 부위 n개 / n개 존: `아이콘 / 아이콘` 구분선 ("각각 다른 존에")
     - 부위 3개 / 2개 존: `(아이콘 아이콘) / 아이콘` 혼합 묶음
  3. 텍스트 힌트 병행 표시 (예: "양손 함께 존 2")
- **완료 조건**:
  - [ ] 답안 카드 하단에 부위 아이콘 및 묶음 기호 정상 표시
  - [ ] 2부위/3부위 조합별 묶음 기호 분기 검증
  - [ ] `npm test` 100% Pass

---

### Issue #129 (Card #60): [UI-002] 피트니스 존별/부위별 독립 진행도 피드백 및 i % 2 오매핑 수정
- **GitHub URL**: https://github.com/Choyounhwa/-dream-guardian/issues/129
- **Labels**: `bug`, `P1-high`, `phase-6`
- **작업 ID**: `[UI-002]`
- **상태**: 🟢 **완료 (Completed)**
- **목적**:
  - RC-5(진행도 2슬롯으로 인해 3번째 존이 `i % 2`로 오매핑되고 전체 커서에 일괄 `max()`가 전달되던 결함)를 수정하고, 존별 및 부위별 독립적인 충전 진행도 피드백을 제공한다.
- **수정 대상**:
  - `dream_guardian/src/render/AnswerSelectionRenderer.ts`
  - `dream_guardian/tests/unit/input-system.test.ts`
- **구현 내용**:
  1. `choiceProgress`를 존 ID별 맵(`Map<number, number>`) 또는 `PostureProgress` 객체 기반으로 전환
  2. 활성 존 3개 이상에서도 각 존이 개별 충전 게이지를 표시하도록 렌더링 로직 수정
  3. 커서별로 자신이 위치한 존의 진행도에 맞는 아크를 표시하도록 분리
- **완료 조건**:
  - [ ] 3개 이상 활성 존에서 각 존의 진행도가 서로 간섭 없이 독립 렌더링
  - [ ] 커서별 체류 아크가 해당 커서가 속한 존의 충전률을 정확히 반영
  - [ ] `npm test` 100% Pass

---

### Issue #130 (Card #61): [REFACTOR-001] AnswerSelector 죽은 판정 경로(update) 정리 및 단위 테스트 정비
- **GitHub URL**: https://github.com/Choyounhwa/-dream-guardian/issues/130
- **Labels**: `refactor`, `P2-medium`, `phase-3`
- **작업 ID**: `[REFACTOR-001]`
- **상태**: 🟢 **완료 (Completed)**
- **목적**:
  - RC-7(실게임에서 쓰이지 않는 레거시 `update()` 경로와 `updateFromPose()` 간의 상태 불일치)을 해소하고, `input-system.test.ts`의 테스트들을 신규 판정 파이프라인으로 일원화한다.
- **수정 대상**:
  - `dream_guardian/src/input/AnswerSelector.ts`
  - `dream_guardian/tests/unit/input-system.test.ts`
- **구현 내용**:
  1. 레거시 `update(cursorX, cursorY, dt)` 경로를 `updateFromPose` 또는 신규 `PostureMatcher`로 통합
  2. `input-system.test.ts`의 의존 테스트(약 7개)를 신규 인터페이스로 마이그레이션
  3. 불필요한 레거시 필드 및 메서드 안전 제거
- **완료 조건**:
  - [ ] 미사용 레거시 경로 정리 완료
  - [ ] 255개 이상 모든 단위 테스트 100% Pass 유지
  - [ ] `main.ts` 게임 루프 무결성 보존

---

### Issue #131 (Card #62): [UI-003] 홈메뉴(챕터 및 서브레벨 단계선택) 원거리/대화면 레이아웃 개편 및 카드 간격 확장
- **GitHub URL**: https://github.com/Choyounhwa/-dream-guardian/issues/131
- **Labels**: `phase-6`, `feature`, `P1-high`
- **작업 ID**: `[UI-003]`
- **상태**: 🟢 **완료 (Completed)**
- **목적**:
  - 사용자가 카메라 및 화면에서 1미터 이상 떨어진 상태에서 스켈레톤 커서로 조작 시, 홈메뉴와 단계선택 카드가 지나치게 작고 촘촘하여 선택이 어렵던 문제를 해결한다.
  - 카드의 크기를 확대하고 간격(Gap)을 대폭 넓혀 오선택 및 떨림 간섭을 차단하고, 뒤로가기 버튼을 대형화하여 원거리 터치/호버 조작성을 확보한다.
- **수정 대상**:
  - `dream_guardian/src/ui/MenuRenderer.ts`
  - `dream_guardian/tests/unit/ui-system.test.ts`
- **구현 내용**:
  1. **메인 챕터 메뉴 카드 레이아웃 확장**:
     - 카드 크기: 기존 `cardW = min(140, w * 0.12)` → `cardW = min(220, w * 0.17)`로 약 60% 대형화
     - 카드 높이 비율: `cardH = cardW * 0.7` → `cardH = cardW * 0.75` (최소 140px 이상 확보)
     - 카드 간 간격(Gap): 기존 16px → 32~40px로 2배 이상 확장하여 인접 카드 간섭 제거
  2. **서브레벨(세부 난이도 / 단계선택) 그리드 레이아웃 개편**:
     - 기존 최대 4열 촘촘한 그리드 → 2~3열 와이드 그리드로 조정
     - 단계 카드 크기: `cardW = min(280, (w * 0.85) / cols - 24)`, `cardH = cardW * 0.55`로 확대
     - 가로/세로 간격: `gapX = 32px`, `gapY = 24px` 이상 확보
     - 상단 `← 뒤로가기` 버튼: 기존 높이 40px → 56~60px, 너비 220px 이상으로 대형화
  3. **메뉴 내 텍스트 크기 스케일업 (1m 시인성 보장)**:
     - 메인 타이틀: `min(56, w * 0.05)px bold`
     - 챕터 번호 및 이름: `cardW * 0.22` (약 32~40px)
     - 단계 라벨: 20~24px bold, 문항수 서브라벨: 16~18px
     - 뒤로가기 텍스트: 18px bold
  4. **히트테스트 동기화**:
     - `hitTest()` 및 `hitTestSub()`의 좌표 판정을 신규 카드 레이아웃 수치와 100% 동기화
- **유지 사항**:
  - 챕터별 고유 테마 색상 및 해금/잠금 상태 표현
  - 마우스 클릭 및 1~5 / Esc 숫자키 키보드 입력 인터페이스 호환성 유지
- **변경 금지**:
  - 인게임 전투 로직 및 문제 출제 데이터
  - 커서 트래킹 좌표계 변환 수식
- **완료 조건**:
  - [ ] 메인 챕터 카드 크기 및 간격 2배 확대 적용 및 화면 비율별 반응형 정렬
  - [ ] 서브레벨 그리드가 2~3열로 여유 있게 배치되고 카드 간격 30px 이상 확보
  - [ ] 상단 뒤로가기 버튼 대형화 및 1m 거리에서 시인성 확보
  - [ ] 메뉴 관련 단위 테스트(`ui-system.test.ts`) 100% Pass
  - [ ] `npm test` 전체 통과
- **테스트**:
  - `npx vitest run tests/unit/ui-system.test.ts`
  - 화면 해상도(1280x720, 1920x1080)별 카드 크기 및 간격 시각 검증
- **관련 파일**:
  - `dream_guardian/src/ui/MenuRenderer.ts`
  - `dream_guardian/tests/unit/ui-system.test.ts`

---

### Issue #132 (Card #63): [UI-004] 원거리(1m+) 가독성 보장을 위한 인게임 HUD 및 수식/선택지/결과 텍스트 대형화 & 고대비 렌더링
- **GitHub URL**: https://github.com/Choyounhwa/-dream-guardian/issues/132
- **Labels**: `phase-6`, `feature`, `P1-high`
- **작업 ID**: `[UI-004]`
- **상태**: 🟢 **완료 (Completed)**
- **목적**:
  - 사용자가 1미터 이상 떨어진 상태에서도 체력, 마나, 문제 수식, 정답 선택지 및 결과 데이터를 한눈에 읽을 수 있도록 전반적인 텍스트 크기와 시인성(명도 대비, 외곽선, 백드롭)을 전면 개선한다.
- **수정 대상**:
  - `dream_guardian/src/ui/HUDLayer.ts`
  - `dream_guardian/src/render/MathRenderer.ts`
  - `dream_guardian/src/main.ts` (`renderQuestion`, `renderRunningPhase`, `renderFeedback`)
  - `dream_guardian/src/ui/ResultRenderer.ts`
- **구현 내용**:
  1. **인게임 HUD 가독성 대폭 강화 (`HUDLayer.ts`)**:
     - HP 바 높이: 24px → 32px 확대
     - HP 수치 폰트: `bold 12px` → `bold 18~20px`로 확대 및 텍스트 외곽선/그림자 부여
     - 보스 이름 폰트: `bold 16px` → `bold 24px` 확대
     - 콤보 수치: 32px → 44px 대형화
  2. **문제 및 선택지 수식 대형화 & 선명도 보강 (`main.ts`, `MathRenderer.ts`)**:
     - 문제 텍스트 폰트: 최대 48px → 최대 60~64px (`min(64, w * 0.05)`)
     - 선택지 버튼 크기: `btnW = min(240, w * 0.19)`, `btnH = btnW * 0.55` 확대
     - 선택지 폰트: 최대 36px → 46~48px
     - 키보드/조작 힌트: 14px → 18~20px
     - 분수선 굵기: 2px → 3.5px, 빈칸 박스 테두리 굵기 강화로 1m 밖에서도 분수/루트 식별 선명화
  3. **달리기 안내 및 피드백 폰트 강화**:
     - 달리기 페이즈 안내문: 24px → 30px, 반투명 백드롭 패널로 3D 그리드 배경과 분리
     - 정답/오답 피드백: 64px → 80px 초대형 텍스트 및 발광 강화
  4. **결과 화면 텍스트 스케일업 (`ResultRenderer.ts`)**:
     - 점수, 칼로리, 클리어 시간, 등급 텍스트를 1m 시인성 기준으로 1.4배 확대
- **유지 사항**:
  - HP/마나 수치 계산 및 선형 감쇠 보간 로직 보존
  - MathRenderer 수식 토큰 파싱(대분수, 지수, 루트 등) 규칙 100% 보존
- **변경 금지**:
  - 전투 데미지 계산 및 마나 충전 밸런스 공식
  - 이벤트 버스 및 상태 머신 인터페이스
- **완료 조건**:
  - [ ] HUD HP 텍스트 18px 이상 및 HP 바 높이 32px 반영
  - [ ] 문제 수식 및 선택지 텍스트 25% 이상 대형화 및 분수선/빈칸 시인성 강화
  - [ ] 결과 화면 통계 텍스트 원거리 가독성 확보
  - [ ] `npm test` 100% Pass
- **테스트**:
  - `npx vitest run tests/unit/ui-system.test.ts`
  - 브라우저 상에서 1.5m 거리 육안 가독성 검증
- **관련 파일**:
  - `dream_guardian/src/ui/HUDLayer.ts`
  - `dream_guardian/src/render/MathRenderer.ts`
  - `dream_guardian/src/main.ts`
  - `dream_guardian/src/ui/ResultRenderer.ts`

---

### Issue #133 (Card #64): [INPUT-002] 스켈레톤 커서 메뉴 조작성 개선 (히트박스 패딩 마진, 호버 떨림 방지 히스테리시스 및 가시성 강화)
- **GitHub URL**: https://github.com/Choyounhwa/-dream-guardian/issues/133
- **Labels**: `phase-3`, `phase-6`, `feature`, `P1-high`
- **작업 ID**: `[INPUT-002]`
- **상태**: 🟢 **완료 (Completed)**
- **목적**:
  - 1미터 이상 떨어진 거리에서 신체 제어 시 발생하는 미세 떨림(Jitter)으로 인해 메뉴 카드의 경계선에서 호버 타이머가 초기화되던 문제를 해결하고, 모션 커서로 메뉴를 쉽게 조작할 수 있도록 히트박스 여유 마진과 호버 안정화(Hysteresis)를 제공한다.
- **수정 대상**:
  - `dream_guardian/src/ui/MenuRenderer.ts` (`hitTest`, `hitTestSub` 패딩 옵션 지원)
  - `dream_guardian/src/input/MenuInput.ts`
  - `dream_guardian/src/main.ts` (메뉴 호버 로직 및 조작 가이드)
- **구현 내용**:
  1. **히트박스 여유 마진(Padding Margin) 추가**:
     - `hitTest` 및 `hitTestSub`에 외곽 패딩(16~24px) 파라미터를 추가하여, 카드의 테두리 근처에서도 안정적으로 커서가 감지되도록 판정 영역 확장
  2. **호버 떨림 방지 히스테리시스(Hover Hysteresis) 알고리즘 적용**:
     - 커서가 이미 특정 카드에 진입하여 호버 중인 경우, 해당 카드의 유효 영역을 추가 확장(+20px)하여 신체 떨림으로 잠시 외곽을 벗어나도 0.8초 게이지 충전이 즉시 리셋되지 않고 유지되도록 보정
  3. **메뉴 조작 모션 유연화 (단손 커서 지원 검토 및 제스처 튜닝)**:
     - 양손 모으기(MenuInput) 제스처 외에도, 한 손(오른손 또는 왼손)을 카드로 뻗어 머무르는 단손 호버 선택 판정 결합
  4. **호버 프로그레스 링 대형화 및 시인성 강화**:
     - 메뉴 선택 프로그레스 아크 반경(38px → 50px) 및 선 두께(5px → 7px) 확대, 발광 효과 강화로 1m 밖에서도 선택 진행률 즉시 인지
- **유지 사항**:
  - 마우스 클릭 및 키보드(1~5, Esc) Fallback 입력 기능 100% 정상 작동 유지
  - 0.8초 체류 확정(Dwell Time) 시간 밸런스 유지
- **변경 금지**:
  - 인게임 정답 판정(`AnswerSelector`) 알고리즘
  - PoseManager 및 관절 스켈레톤 트래킹 내부 로직
- **완료 조건**:
  - [ ] 메뉴 카드 히트박스에 감지 여유 패딩 적용
  - [ ] 호버 중 미세 떨림 발생 시 호버 타이머가 초기화되지 않는 히스테리시스 로직 검증
  - [ ] 호버 프로그레스 아크 대형화(반경 50px, 두께 7px) 및 시각적 피드백 향상
  - [ ] `npm test` 100% Pass
- **테스트**:
  - `npx vitest run tests/unit/input-system.test.ts`
  - 웹캠 모션 및 마우스 호버로 단계 선택 안정성 테스트
- **관련 파일**:
  - `dream_guardian/src/ui/MenuRenderer.ts`
  - `dream_guardian/src/input/MenuInput.ts`
  - `dream_guardian/src/main.ts`
  - `dream_guardian/tests/unit/input-system.test.ts`

---

### Issue #134 (Card #65): [FEAT-RESULT-001] 게임 결과 화면(Result) 양손 합장(모으기) 제스처 메뉴 복귀 기능 및 시각 피드백 구현
- **GitHub URL**: https://github.com/Choyounhwa/-dream-guardian/issues/134
- **Labels**: `feature`, `P1-high`, `phase-6`
- **Milestone**: `v0.5-input-ui`
- **작업 ID**: `[FEAT-RESULT-001]`
- **상태**: 🟢 **완료 (Completed)**
- **목적**:
  - 게임 종료 후 결과 화면(`screenMode === 'result'`)에서 키보드나 마우스 터치 없이도, 웹캠 앞에서 양손을 모으는(합장) 체감형 제스처로 0.8초 체류 시 메인 메뉴로 자연스럽게 복귀할 수 있도록 제스처 인터랙션 및 시각 피드백을 구현한다.
- **수정 대상**:
  - `dream_guardian/src/main.ts`
  - `dream_guardian/src/ui/ResultRenderer.ts`
  - `dream_guardian/src/input/MenuInput.ts`
  - `dream_guardian/tests/unit/ui-system.test.ts`
- **구현 내용**:
  1. **결과 화면 포즈 및 합장 감지 연동**:
     - `screenMode === 'result'` 상태에서도 웹캠 포즈 추출(`poseManager`) 및 `MenuInput`을 활성화하여 양손 손바닥/손목 좌표 간 거리를 실시간 추적.
  2. **합장 유지 시간(0.8초 Dwell) 판정**:
     - 양손이 모인 상태(거리 < 임계값)를 0.8초 동안 연속 유지하면 `goToMenu()`를 자동 호출하여 메인 메뉴로 전환.
     - 손이 떨어지면 누적 진행도 초기화(오입력 방지).
  3. **시각 피드백 및 안내 UI 개선**:
     - 결과 화면에 양손 모으기 중심점 커서 및 충전 프로그레스 링/아크 실시간 렌더링.
     - 하단 안내 문구를 `양손을 모으거나 ESC/클릭 시 메뉴로 복귀`로 갱신.
  4. **대체 입력(Fallback) 보존**:
     - 카메라가 없거나 제스처 인식이 어려운 환경을 위해 기존 마우스 클릭 및 키보드(ESC, Enter, Space) 메뉴 복귀 100% 정상 유지.
- **유지 사항**:
  - 결과 화면 통계(걸음, 스쿼트, 점프, 칼로리, 별점) 계산 및 렌더링 유지
  - 마우스 클릭 및 ESC/Enter/Space 키보드 Fallback 조작 유지
- **변경 금지**:
  - 전투 시스템 및 문제 출제 로직
  - 기존 `MenuInput`의 기본 임계값 공식의 하위 호환성 훼손 금지
- **완료 조건**:
  - [ ] 게임 종료 후 결과 화면에서 양손을 모았을 때 합장 커서 및 충전 링이 시각적으로 표시됨
  - [ ] 0.8초간 양손을 모으고 있으면 터치나 키보드 없이 메인 메뉴로 자동 복귀함
  - [ ] 손을 중간에 떼면 복귀가 취소되고 충전 게이지가 리셋됨
  - [ ] 마우스 클릭 및 ESC/Enter/Space 키보드 복귀가 정상 동작함
  - [ ] `npm test` 단위 테스트 100% Pass 및 빌드 번들링 0 에러
- **테스트**:
  - `tests/unit/ui-system.test.ts`에 결과 화면 합장 제스처 복귀 판정 및 진행도 테스트 추가
  - `npm test` 전체 통과 검증
- **관련 파일**:
  - `dream_guardian/src/main.ts`
  - `dream_guardian/src/ui/ResultRenderer.ts`
  - `dream_guardian/src/input/MenuInput.ts`
  - `dream_guardian/tests/unit/ui-system.test.ts`

---

### Issue #135 (Card #66): [CALC-001] 자세 유지(Dwell Time) 기반 피트니스 칼로리 소모 계산식 확장 및 결과 통계 연동
- **GitHub URL**: https://github.com/Choyounhwa/-dream-guardian/issues/135
- **Labels**: `feature`, `P2-medium`, `phase-6`
- **Milestone**: `v0.5-input-ui`
- **작업 ID**: `[CALC-001]`
- **상태**: 🟢 **완료 (Completed)**
- **목적**:
  - 현재 칼로리 소모 공식 `(steps*0.04) + (squats*0.35) + (jumps*0.15)`은 달리기/스쿼트/점프만 반영하고 있어, 플레이어가 문제를 풀며 스트레칭 및 국민체조 자세를 정지 유지(Dwell)한 운동 노력을 보상하지 못하는 결함을 해결한다. 자세 유지 시간(초)을 칼로리 공식에 반영하여 피트니스 보상을 정밀화한다.
- **수정 대상**:
  - `dream_guardian/src/ui/ResultRenderer.ts`
  - `dream_guardian/src/main.ts`
  - `dream_guardian/tests/unit/ui-system.test.ts`
  - `dream_guardian/config/posture.config.ts`
- **구현 내용**:
  1. **자세 유지 시간(postureDwellTime) 누적 트래킹**:
     - `main.ts`의 문제 풀이 루프에서 커서가 활성 존에 체류하며 충전된 시간(초)을 실시간 누적 (`totalDwellTime`).
  2. **칼로리 공식 확장 (`ResultRenderer.calcCalories`)**:
     - 기존 공식에 자세 유지 칼로리 계수(`0.06~0.08 kcal/s`) 추가:
       `calories = (steps * 0.04) + (squats * 0.35) + (jumps * 0.15) + (dwellTime * 0.07)`
  3. **결과 화면(`ResultRenderer`) 통계 표시 확장**:
     - 결과 리포트에 `스트레칭 유지: N초` 항목을 추가하여 운동 피드백 제공.
  4. **설정 외부화**:
     - 칼로리 계수(`CALORIE_RATES`)를 `config/posture.config.ts`에 분리하여 밸런스 조정 지원.
- **유지 사항**:
  - 기존 걸음, 스쿼트, 점프 칼로리 계산 단위 테스트 호환성 유지
  - 결과 화면 별 등급(Stars) 산출 로직 보존
- **변경 금지**:
  - 전투 HP/마나 증감 로직
  - 문제 출제 및 정답 판정 시스템
- **완료 조건**:
  - [ ] 자세 유지 시간이 누적되어 결과 데이터에 전달됨
  - [ ] 확장된 칼로리 공식이 적용되어 정확한 수치 계산 검증
  - [ ] 결과 화면에 스트레칭 유지 시간 표시
  - [ ] `npm test` 단위 테스트 100% Pass
- **테스트**:
  - `tests/unit/ui-system.test.ts`에 확장 칼로리 계산식 단위 테스트 추가
  - `npm test` 전체 통과 검증
- **관련 파일**:
  - `dream_guardian/src/ui/ResultRenderer.ts`
  - `dream_guardian/src/main.ts`
  - `dream_guardian/tests/unit/ui-system.test.ts`
  - `dream_guardian/config/posture.config.ts`

---

### Issue #136 (Card #67): [AUDIO-002] 피트니스 존 체류(Dwell) 점진적 충전음 및 자세 완성 화음 효과음(Web Audio SFX) 구현
- **GitHub URL**: https://github.com/Choyounhwa/-dream-guardian/issues/136
- **Labels**: `feature`, `P2-medium`, `phase-7`
- **Milestone**: `v0.5-ui-visuals`
- **작업 ID**: `[AUDIO-002]`
- **상태**: 🟢 **완료 (Completed)**
- **목적**:
  - 플레이어가 원하는 답안의 부위를 활성 존에 배치하고 유지하는 동안, 시각적인 아크 채움뿐만 아니라 청각적으로 충전 진행도(점진적 피치 상승)와 확정 순간(맑은 화음 종소리)을 인지할 수 있도록 실시간 오디오 피드백을 제공하여 체감성을 극대화한다.
- **수정 대상**:
  - `dream_guardian/src/audio/SFXSynth.ts`
  - `dream_guardian/src/main.ts`
  - `dream_guardian/tests/unit/effects.test.ts`
- **구현 내용**:
  1. **충전 피치 톤 합성 (`playDwellCharge(progress: number)`)**:
     - Web Audio OscillatorNode를 활용하여, 체류 진행도(0.0~1.0)에 따라 기본 주파수가 부드럽게 상승(`220Hz -> 440Hz -> 880Hz`)하는 은은한 펄스 톤 합성.
     - 존에서 이탈하거나 충전이 취소되면 게인을 즉시 페이드아웃하여 잡음 제거.
  2. **자세 완성 화음 (`playPostureComplete()`)**:
     - 1.0초 충전 달성 순간 맑은 3화음(C5-E5-G5 벨 톤) 사운드 재생.
  3. **인게임 루프 결합 (`main.ts`)**:
     - `answerSelector`의 진행도 변화에 맞춰 비차단 오디오 재생.
     - 브라우저 음소거/오디오 컨텍스트 상태 보호.
- **유지 사항**:
  - 기존 정답음, 오답음, 피격음 등 12종 SFX 보존
  - 비차단 큐 구조로 프레임 드랍 0% 유지
- **변경 금지**:
  - `QuestionSpeech` (TTS 음성 안내)와의 충돌 방지
  - 수학 문제 평가 및 보스전 전투 수치
- **완료 조건**:
  - [ ] 존 체류 충전 시 진행도에 비례한 피치 상승 효과음 재생
  - [ ] 자세 확정 시 맑은 완성 화음 재생
  - [ ] 무음(Muted) 환경에서도 에러 없이 게임 진행 가능
  - [ ] `npm test` 100% Pass
- **테스트**:
  - Web Audio 목(Mock) 기반 사운드 트리거 단위 테스트
  - `npm test` 전체 통과 검증
- **관련 파일**:
  - `dream_guardian/src/audio/SFXSynth.ts`
  - `dream_guardian/src/main.ts`
  - `dream_guardian/tests/unit/effects.test.ts`

---

### Issue #137 (Card #68): [TUT-001] 최초 플레이어 대상 4색 신체 커서 및 피트니스 존 매칭 인터랙티브 튜토리얼 오버레이 구현
- **GitHub URL**: https://github.com/Choyounhwa/-dream-guardian/issues/137
- **Labels**: `feature`, `P2-medium`, `phase-6`
- **Milestone**: `v0.5-input-ui`
- **작업 ID**: `[TUT-001]`
- **상태**: 🟢 **완료 (Completed)**
- **목적**:
  - 처음 게임을 접하는 사용자가 4색 신체 커서(손바닥, 머리, 골반)와 10개 피트니스 존을 활용하여 답안을 선택하는 원리를 빠르게 습득할 수 있도록, 첫 플레이 진입 시 1회 직관적인 가이드 오버레이 및 연습 인터랙션을 제공한다.
- **수정 대상**:
  - `dream_guardian/src/ui/TutorialOverlay.ts` (신규)
  - `dream_guardian/src/main.ts`
  - `dream_guardian/src/storage/index.ts`
  - `dream_guardian/tests/unit/ui-system.test.ts`
- **구현 내용**:
  1. **튜토리얼 단계별 시각 안내**:
     - 1단계: 4색 신체 커서 소개 (시안 왼손, 노랑 오른손, 보라 머리, 주황 골반)
     - 2단계: 피트니스 존 매칭 원리 (원하는 답안의 부위를 활성 존에 1초간 올려놓기)
     - 3단계: 미니 연습 (화면에 뜬 1개 존에 손 올려보기)
  2. **원클릭 / 제스처 스킵 지원**:
     - 화면 클릭, Space 키, 또는 양손 모으기 제스처로 언제든 즉시 스킵 가능.
  3. **최초 1회 실행 상태 영속화**:
     - LocalStorage(`dream_guardian_tutorial_done`)에 완료 플래그 저장하여 재방문 시 자동 생략.
     - 메인 메뉴 하단 옵션에서 '튜토리얼 다시 보기' 지원.
- **유지 사항**:
  - 기존 FSM 게임 상태 전이 규칙 준수
  - 키보드/마우스 Fallback 입력 호환성 유지
- **변경 금지**:
  - 문제 출제 및 전투 생명주기 로직
  - 기존 `CanvasManager` 뷰포트 스케일링 체계
- **완료 조건**:
  - [ ] 첫 게임 시작 시 튜토리얼 오버레이가 정상 노출됨
  - [ ] 스킵 버튼 또는 제스처로 즉시 본 게임으로 전환됨
  - [ ] 완료 후 로컬스토리지에 저장되어 다음 플레이 시 반복 노출되지 않음
  - [ ] `npm test` 단위 테스트 100% Pass
- **테스트**:
  - `tests/unit/ui-system.test.ts`에 튜토리얼 상태 머신 및 스토리지 플래그 검증 추가
  - `npm test` 전체 통과 검증
- **관련 파일**:
  - `dream_guardian/src/ui/TutorialOverlay.ts`
  - `dream_guardian/src/main.ts`
  - `dream_guardian/src/storage/index.ts`
  - `dream_guardian/tests/unit/ui-system.test.ts`

---

### Issue #138 (Card #69): [DOCS-001] GDD 기획서 및 프로젝트 공식 문서 최신화 (보라 머리/얼굴 확정, 10존 레이아웃, 국민체조 패턴 및 집합 덮기 모델 공식 반영)
- **GitHub URL**: https://github.com/Choyounhwa/-dream-guardian/issues/138
- **Labels**: `documentation`, `P2-medium`
- **Milestone**: `v0.5-input-ui`
- **작업 ID**: `[DOCS-001]`
- **상태**: 🟢 **완료 (Completed)**
- **목적**:
  - 개발 초기의 구형 사양(어깨 커서 표기, 12존 체계, 단순 1:1 페어링 등)이 남아있는 기획 문서들을 현재 확정된 아키텍처(보라 머리/얼굴 확정, 겹침 0% 10존 레이아웃, fitness pattern.csv 360건, 집합 덮기 matchPosture 알고리즘)와 100% 일치하도록 공식 최신화한다.
- **수정 대상**:
  - `docs/01_GAME_DESIGN_DOCUMENT.md`
  - `docs/02_WORK_BREAKDOWN_STRUCTURE.md`
  - `AGENTS.md`
- **구현 내용**:
  1. **신체 커서 정의 정정**:
     - 보라 `#C889FF`: "어깨" 표기를 "머리/얼굴(Head)"로 전면 정정 (`shoulder` 타입 레거시 처리).
  2. **피트니스 존 및 밴드 최신화**:
     - 10개 피트니스 존 좌표 규격(18:9 가상 뷰포트, 상호 겹침 0%) 및 예약 밴드(문제 밴드, 답안 밴드) 반영.
  3. **국민체조 360종 패턴 및 판정 룰 명시**:
     - `fitness pattern.csv` 원본 데이터(Single 60, Double 100, Triple 100, Quad 100) 반영.
     - 고정 페어링 대신 집합 덮기(Set Coverage: 조건 A & 조건 B) 판정 술어 공식 수록.
     - 7대 안전 제약(C1~C7) 및 PartGate 캘리브레이션 변위 검증 반영.
- **유지 사항**:
  - 5대 챕터 및 보스전 밸런스(HP, 마나, 데미지) 기획 유지
  - 스토리 전문 및 캐릭터 설정 보존
- **변경 금지**:
  - 소스 코드 및 테스트 코드 수정 금지 (순수 문서 동기화 작업)
- **완료 조건**:
  - [ ] GDD 내 모든 어깨 표기가 머리/얼굴로 정정됨
  - [ ] 10개 피트니스 존 및 집합 덮기 판정 공식이 기획서에 명시됨
  - [ ] 문서 간 모순 0건 확인
- **테스트**:
  - 문서 링크 및 Markdown 렌더링 무결성 검증
- **관련 파일**:
  - `docs/01_GAME_DESIGN_DOCUMENT.md`
  - `docs/02_WORK_BREAKDOWN_STRUCTURE.md`
  - `AGENTS.md`

---

### Issue #139 (Card #70): [BUG-SCALE-001] 3.0배 Cover 뷰포트 확대율에 따른 인체 부위 기준값(어깨/손/머리/골반) 포화 클램핑 왜곡 수정 및 서버/진입점 일원화
- **GitHub URL**: https://github.com/Choyounhwa/-dream-guardian/issues/139
- **Labels**: `bug`, `P1-high`, `phase-3`, `phase-6`
- **Milestone**: `v0.5-input-ui`
- **작업 ID**: `[BUG-SCALE-001]`
- **상태**: 🟢 **완료 (Done - 2026-09-22)**
- **목적**:
  - CameraLayer의 3.0배 Cover 뷰포트 확대율과 CursorTracker의 하드코딩 기준 픽셀(어깨 240px, 손 길이 120px 등) 간의 스케일 불일치로 인해, 커서 크기 동적 사이징이 항상 최대치(2.0배)에 걸려 고정(Clamping Saturation)되고 손가락 관절이 노이즈로 오인식되어 손 크기가 0 Fallback되던 현상을 해결한다. 또한 구버전 좀비 서버 프로세스 점유 문제를 정리하고 최신 모던 번들 진입점으로 일원화한다.
- **원인 분석**:
  1. **어깨 너비 기준값 포화 (천장 클램핑)**:
     - 16:9 웹캠을 18:9 캔버스에 Cover할 때 중앙 기준 3.0배 확대됨.
     - 실제 어깨 너비(450~750px) 대비 기준값(240px)이 너무 작아 `scaleFactor`가 항시 최대치 2.0에 포화되어 카메라 거리 변화가 전혀 체감되지 않음.
  2. **손 길이 한계치 초과(maxHandLen)로 인한 손바닥 크기 0 Fallback**:
     - 3.0배 확대된 손목-손가락 거리는 140~240px이나, `maxHandLen`이 120px로 제한되어 실제 손가락 관절을 '노이즈'로 판단하여 기각함. 그 결과 `handLenPx = 0`이 되어 손 커서가 36px로 고정됨.
  3. **머리 및 골반 상한선(Max Bound) 조기 도달**:
     - 머리 타원 X반경(108~162px)이 `maxRadiusX: 45px`에 조기 포화되어 45px로 고정.
     - 골반 너비(77~121px)가 `maxHalfWidth: 48px`에 조기 포화되어 48px로 고정.
  4. **구버전 프로세스(PID 28408) 포트 3000 점유**:
     - 이전 세션의 구버전 프로세스가 포트 3000을 잡고 있어 최신 동적 사이징 코드가 브라우저에 반영되지 않고 구버전 정적 코드가 동작함.
- **수정 대상**:
  - `dream_guardian/src/input/CursorTracker.ts`
  - `dream_guardian/config/cursor.config.ts`
  - `dream_guardian/src/render/AnswerSelectionRenderer.ts`
  - `dream_guardian/src/input/MenuInput.ts`
  - `dream_guardian/src/skeleton/BoneRenderer.ts`
  - `dream_guardian/src/skeleton/JointRenderer.ts`
  - `dream_guardian/index.html`
  - `run_server.bat`
  - `dream_guardian/tests/unit/cursor-tracker-recipe.test.ts`
- **구현 내용**:
  1. **Cover 3.0배 확대율을 반영한 인체 기준값 현실화**:
     - 어깨 기준 너비: `240px` → `460px` (원거리 0.6x ~ 근거리 1.5x 이상의 넓은 다이내믹 레인지 확보)
     - 유효 손 길이 상한(`maxHandLen`): `120px` → `260px` (실제 손가락 관절 정상 수용)
     - 유효 전완 길이 상한(`maxForearmLen`): `280px` → `600px`
  2. **커서 상한선(Max Bounds) 현실화**:
     - 머리 타원 상한: `45px / 60px` → `52px / 68px`
     - 손 반경 상한: `36px` → `48px`
     - 골반 반너비 상한: `48px` → `55px`
  3. **합장 감지 거리 현실화**:
     - `MenuInput` 감지 거리 임계값을 Cover 줌에 맞추어 `0.22`로 조정하여 양손 모으기 제스처 활성화.
  4. **스켈레톤 손바닥 연장 드로잉**:
     - 뼈대 라인이 손목에서 손바닥 중심까지 이어지고, 발광 조인트 구체가 손바닥 중앙에 렌더링되도록 개선.
  5. **서버 진입점 및 프로세스 일원화**:
     - 구버전 2,802줄 index.html을 `main.ts` 모던 모듈 로더로 교체.
     - 포트 3000 좀비 프로세스 종료 및 최신 워크스페이스 Vite 서버 가동.
- **완료 조건**:
  - [x] 카메라 거리에 따라 커서 크기가 0.6배~1.5배 이상 유연하게 축소/확대됨
  - [x] 손가락 관절이 정상 인식되어 손바닥 중심 트래킹 및 손 크기 연동 정상 동작
  - [x] 머리 및 골반 커서 크기가 천장에 박히지 않고 자연스러운 크기 변화 표현
  - [x] 양손 모으기 제스처로 홈 메뉴 선택 0.8초 프로그레스 정상 발동
  - [x] Vitest 단위 테스트 100% Pass (320/320 Pass)
- **테스트**:
  - `tests/unit/cursor-tracker-recipe.test.ts` 내 동적 사이징 및 손바닥 트래킹 검증
  - 브라우저 상에서 카메라 거리별 커서 확대/축소 및 양손 모으기 실테스트 검증
- **관련 파일**:
  - `dream_guardian/src/input/CursorTracker.ts`
  - `dream_guardian/config/cursor.config.ts`
  - `dream_guardian/src/render/AnswerSelectionRenderer.ts`
  - `dream_guardian/src/input/MenuInput.ts`
  - `dream_guardian/src/skeleton/BoneRenderer.ts`
  - `dream_guardian/src/skeleton/JointRenderer.ts`
  - `dream_guardian/index.html`
  - `dream_guardian/tests/unit/cursor-tracker-recipe.test.ts`

---

### Issue #140 (Card #66): [FEAT-CURSOR-003] 전 장면(메뉴·달리기·문제·결과) 4색 스켈레톤 커서 상시 지속 가시화 및 생명주기 통일
- **GitHub URL**: https://github.com/Choyounhwa/-dream-guardian/issues/140
- **Labels**: `feature`, `P1-high`, `phase-3`, `phase-6`
- **Milestone**: `v0.5-input-ui`
- **작업 ID**: `[FEAT-CURSOR-003]`
- **상태**: 🟢 **완료 (Completed)**
- **목적**:
  - 현재 메뉴와 문제 페이즈에서만 간헐적으로 표시되고 달리기 페이즈와 결과 화면에서 소멸하는 커서의 생명주기 단절 결함을 해결한다.
  - 플레이어가 카메라 앞에 서 있는 한, 4색 신체 커서(시안 왼손, 노랑 오른손, 보라 머리, 주황 골반)가 메뉴(홈), 달리기, 문제 선택, 게임 결과 화면 등 게임의 모든 장면에서 일관되게 100% 지속 표시되도록 렌더링 및 갱신 파이프라인을 통일한다.
- **현상 및 원인 분석**:
  1. **렌더링 분기 누락**:
     - `main.ts`의 `render()` 구조상 `gamePhase === 'running'` 및 `screenMode === 'result'` 블록에서 `answerSelectionRenderer.render(...)` 호출이 누락되어 있어, 해당 페이즈 진입 즉시 신체 커서가 화면에서 증발함.
  2. **신체 모션 피드백 단절**:
     - 제자리 달리기 중에도 유저가 자신의 손 위치와 팔 스윙 높이를 시각적으로 인지해야 직관적이나, 커서가 사라져 몰입감 저해.
  3. **결과 화면 제스처 복귀 연계 준비**:
     - 결과 화면에서도 향후 합장 제스처 메뉴 복귀(#134)와 연계되려면 손 커서가 상시 표시되어 있어야 함.
- **수정 대상**:
  - `dream_guardian/src/main.ts`
  - `dream_guardian/src/render/AnswerSelectionRenderer.ts`
  - `dream_guardian/tests/unit/ui-system.test.ts`
- **구현 내용**:
  1. **메인 렌더 파이프라인 전 장면 상시화**:
     - `screenMode` 및 `gamePhase`에 종속되어 분기 처리되던 커서 렌더링을 최상위 레이어로 공통화.
     - 문제 페이즈(`gamePhase === 'question'`)에서는 피트니스 존(`activeZones`) 및 진행도와 함께 렌더링하고, 메뉴/달리기/결과 화면에서는 피트니스 존 없이 순수 4색 커서만 깔끔하게 상시 렌더링.
  2. **엔진 업데이트 루프 생명주기 통일**:
     - 포즈가 감지되는 모든 프레임에서 `screenMode`와 무관하게 `cursorTracker.update`와 `answerSelectionRenderer.update(dt)`를 상시 호출하여 커서 펄스 및 좌표 갱신 지속 보장.
  3. **단위 및 통합 검증 테스트 구축**:
     - 메뉴, 달리기, 문제, 결과 전 장면에서 커서 목록(`cursors.size === 4`) 및 렌더링이 연속 보존됨을 검증하는 테스트 추가.
- **유지 사항**:
  - 기존 문제 페이즈에서의 피트니스 존 체류 판정 및 Deadlock Guard 로직 유지
  - 기존 4색 네온 테두리(Outline Only) 및 손바닥 중심 트래킹 유지
  - 마우스 클릭 및 키보드 Fallback 조작 유지
- **변경 금지**:
  - 전투 시스템 HP/마나 수치 계산, CSV 문제 출제 로직
- **완료 조건**:
  - [x] 홈 메뉴 화면에서 4색 커서가 정상 표시됨
  - [x] 제자리 달리기 페이즈 중에도 커서가 사라지지 않고 실시간 트래킹 유지됨
  - [x] 문제 선택 페이즈에서 활성 존 및 커서가 정상 표시 및 판정 동작함
  - [x] 게임 결과(Result) 화면에서도 커서가 사라지지 않고 유지됨
  - [x] `npm test` 100% Pass 및 빌드 정상 완료
- **관련 파일**:
  - `dream_guardian/src/main.ts`
  - `dream_guardian/src/render/AnswerSelectionRenderer.ts`
  - `dream_guardian/tests/unit/ui-system.test.ts`

---

### Issue #141 (Card #73): [UI-BAR-001] 전 화면 공통 하단 고정 바(Yellow Bar) 및 설정(Settings) 모달 신설과 레거시 상단 부유 버튼(#top_controls) 완전 삭제
- **GitHub URL**: https://github.com/Choyounhwa/-dream-guardian/issues/141
- **Labels**: `phase-6`, `feature`, `P1-high`
- **작업 ID**: `[UI-BAR-001]`
- **상태**: 🟢 **완료 (Closed)**
- **목적**:
  - 모든 페이즈(홈 메뉴, 서브 메뉴, 인게임, 결과)의 하단에 동일한 규격(200px)의 공통 고정 바(Yellow Box)를 구축하여 인터페이스 일관성을 확보한다.
  - 우측 상단에서 보스 HP 바를 가리고 1m 거리에서 조작하기 어려웠던 부유 버튼(`#top_controls`)을 완전히 삭제하고, 하단 바 좌측 슬롯(Cyan Box)에 "설정" 버튼을 배치하여 모달 드로어로 제어할 수 있도록 개편한다.
  - 하단 바 우측 슬롯(Red Box)에 화면별 전용 액션 버튼("뒤로", "정지", "메뉴로")의 공통 레이아웃 프레임을 제공한다.
- **삭제(제거) 대상**:
  1. `dream_guardian/index.html` 내 `<div id="top_controls">` 및 하위 버튼 (`#btn_cam`, `#btn_fullscreen`) HTML 마크업 완전 삭제
  2. `dream_guardian/index.html` 내 `#top_controls`, `.ctrl-btn`, `.ctrl-btn:hover`, `.ctrl-btn:active` CSS 스타일 완전 삭제
  3. `dream_guardian/src/main.ts` 내 `#btn_cam` 및 `#btn_fullscreen` DOM 이벤트 리스너 바인딩 코드 삭제
- **신규 구현 내용**:
  1. **공통 하단 고정 바 (Yellow Box)**:
     - 규격: `x: 0, y: 1960px (y: 0.907), w: 1080px (1.0), h: 200px (0.093)`
     - 스타일: 반투명 다크 네이비(`rgba(10, 14, 26, 0.92)`), 상단 2px 네온 골드 구분선(`#FFCB4D`), 캔버스 렌더링
  2. **좌측 "설정" 버튼 (Cyan Box)**:
     - 규격: `x: 30px, y: 1990px, w: 140px, h: 140px` (정사각형 라운드)
     - 스타일: 시안 네온 외곽선(`#28E6FF`, 3px), 배경 `rgba(40, 230, 255, 0.12)`, 폰트 `bold 36px`
     - 클릭 및 모션 호버(0.8초) 판정 연동
  3. **설정 모달 드로어 (`SettingsModal.ts` 신규 구현)**:
     - 화면 중앙 오버레이 팝업 모달
     - 항목: 📷 카메라 ON/OFF 토글, ⛶ 전체화면 토글, 🦴 스켈레톤 미러 표시 ON/OFF, 🔊 볼륨 제어, 닫기 버튼
  4. **우측 액션 버튼 슬롯 공통 프레임 (Red Box)**:
     - 규격: `x: 810px, y: 1990px, w: 240px, h: 140px`
     - 각 페이즈별 액션("뒤로", "정지", "메뉴로") 핸들러 연결 인터페이스 확립
- **유지 사항**:
  - 단축키(C: 카메라, F: 전체화면) 키보드 이벤트 보존
  - 4색 스켈레톤 커서의 하단 바 위 상시 렌더링 유지
- **변경 금지**:
  - 전투 데미지 계산 및 문제 생성 알고리즘
  - 포즈 감지 및 랜드마크 추출 파이프라인
- **완료 조건**:
  - [x] `index.html`에서 상단 부유 버튼 및 스타일이 완전히 삭제됨
  - [x] 전 화면 하단에 200px 높이의 하단 고정 바가 일관되게 렌더링됨
  - [x] 좌측 "설정" 버튼 클릭/호버 시 설정 모달이 열리고 카메라/전체화면 토글이 정상 작동함
  - [x] `npm test` 단위 테스트 100% Pass 및 빌드 정상 완료
- **테스트**:
  - `npx vitest run tests/unit/bottom-bar.test.ts`
  - 브라우저 상에서 상단 간섭 제거 및 설정 모달 작동 검증
- **관련 파일**:
  - `dream_guardian/index.html`
  - `dream_guardian/src/ui/BottomBar.ts` (신설)
  - `dream_guardian/src/ui/SettingsModal.ts` (신설)
  - `dream_guardian/src/ui/MenuRenderer.ts`
  - `dream_guardian/src/main.ts`
  - `dream_guardian/tests/unit/bottom-bar.test.ts`

---

### Issue #142 (Card #74): [UI-MENU-002] 홈 메뉴(2-2-1) 및 서브 메뉴(2x3) 와이드 레이아웃 개편과 1:1 대형 폰트 적용 (레거시 가로 1열 및 상단 뒤로가기 삭제)
- **GitHub URL**: https://github.com/Choyounhwa/-dream-guardian/issues/142
- **Labels**: `phase-6`, `feature`, `P1-high`
- **작업 ID**: `[UI-MENU-002]`
- **상태**: 🟢 **완료 (Closed)**
- **목적**:
  - 1미터 이상 떨어진 플레이어 환경에서 글씨가 너무 작고 카드가 촘촘하여 발생하던 조작 곤란과 시인성 저하를 해결한다.
  - 첨부된 2번째(홈 메뉴)와 3번째(서브 메뉴) 레이아웃 설계에 따라 카드를 와이드 그리드로 재배치하고, 카드 내부 텍스트를 칸별 높이에 1:1로 꽉 채우도록 스케일업한다.
  - 기존 상단의 작고 좁은 뒤로가기 버튼을 삭제하고 하단 고정 바 우측 슬롯으로 이관한다.
- **삭제(제거) 대상**:
  1. `MenuRenderer.ts` 내 챕터 카드 가로 1열 나열 수식 (`cardW = min(140, w*0.12)`, `gap = 16`, 단일 행 계산) 완전 삭제
  2. `MenuRenderer.ts` `getSubMenuLayouts()` 내 상단 중앙 `y: 0.14` 높이 40px짜리 레거시 `← 뒤로가기` 버튼 정의 및 히트테스트 삭제
  3. `MenuRenderer.ts` 내 가변 4열 서브레벨 그리드 분할 계산식 및 13~16px 소형 텍스트 렌더링 코드 삭제
  4. 화면 중앙 하단(`h * 0.75`)의 작은 레거시 안내문 삭제
- **신규 구현 내용**:
  1. **홈 메뉴 2-2-1 와이드 다이아몬드 레이아웃 (Image 2)**:
     - 상단 타이틀 영역 (Red Box): `x: 140, y: 180, w: 800, h: 220`, 타이틀 **`bold 76px`**, 슬로건 **`32px`**
     - 챕터 카드 5개 (Green Box): 크기 개별 **`w: 360px, h: 380px`** (라운드 코너 24px)
       - 1행: Ch.1 (`x: 120, y: 460`), Ch.2 (`x: 600, y: 460`)
       - 2행: Ch.3 (`x: 120, y: 920`), Ch.4 (`x: 600, y: 920`)
       - 3행: Ch.5 나이트메어 (`x: 360, y: 1380`, 중앙 정렬)
     - 카드 내부 텍스트 (Red Box - 칸별 높이 1:1 매핑):
       - 챕터 번호 (`Ch.X`): 높이 90px → **`bold 64px`**
       - 챕터명 (`포겟`, `후다닥`): 높이 70px → **`bold 48px`**
       - 별점 (`★★★`): 높이 50px → **`42px`** (`#FFCB4D`)
  2. **서브 메뉴 2열 3행 대형 와이드 레이아웃 (Image 3)**:
     - 상단 헤더 (Red Box): `x: 80, y: 160, w: 920, h: 200`, 타이틀 **`bold 56px`**, 안내 **`28px`**
     - 단계 카드 6개 (Green Box): 크기 개별 **`w: 420px, h: 380px`** (간격 X: 80px, Y: 60px)
       - 1행: 1단계 (`x: 80, y: 440`), 2단계 (`x: 580, y: 440`)
       - 2행: 3단계 (`x: 80, y: 880`), 4단계 (`x: 580, y: 880`)
       - 3행: 5단계 (`x: 80, y: 1320`), 6단계 (전체 종합 ALL, `x: 580, y: 1320`)
     - 카드 내부 텍스트 (Red Box - 1:1 매핑):
       - 단계 타이틀: 높이 120px 기준 **`bold 68px`** (원거리 시인성 확보)
       - 서브 문항수: **`32px`**
  3. **하단 고정 바 우측 "뒤로" 버튼 (Red Box)**:
     - 위치: `x: 780px, y: 1990px, w: 270px, h: 140px`, 폰트: **`bold 42px`**
  4. **히트테스트 동기화**:
     - `hitTest(x, y)` 및 `hitTestSub(x, y)` 판정 좌표계를 신규 2-2-1 및 2x3 와이드 그리드로 100% 갱신
- **유지 사항**:
  - 챕터별 테마 색상 및 잠금(🔒) 표현 유지
  - 키보드(1~5, Esc) 및 마우스 클릭 Fallback 유지
  - 양손 모으기(MenuInput) 제스처 및 호버 Dwell 시간(0.8초) 유지
- **변경 금지**:
  - CSV 문제 뱅크의 서브레벨 데이터 구조
  - `CursorTracker` 뷰포트 정규화 좌표 변환
- **완료 조건**:
  - [x] 홈 메뉴 5개 카드가 2-2-1 와이드 그리드로 정렬되고 폰트 1:1 확대 반영
  - [x] 서브 메뉴가 2열 3행으로 정렬되고 상단 뒤로가기가 하단 고정 바 우측으로 이동
  - [x] 신규 레이아웃 좌표에 맞춰 마우스 클릭 및 모션 커서 히트테스트 100% 정상 작동
  - [x] `npm test` 단위 테스트 100% Pass 및 빌드 정상 완료
- **테스트**:
  - `npx vitest run tests/unit/ui-system.test.ts`
  - 브라우저 상에서 1.5m 원거리 가독성 및 카드 선택 모션 테스트
- **관련 파일**:
  - `dream_guardian/src/ui/MenuRenderer.ts`
  - `dream_guardian/src/main.ts`
  - `dream_guardian/tests/unit/ui-system.test.ts`

---

### Issue #143 (Card #75): [UI-INGAME-001] 인게임 마젠타 문제영역 고정 컨테이너, 3중 회전 마법진(E_Pit_act1~3) 피트니스 존 및 마젠타 결과 카드 패널 개편
- **GitHub URL**: https://github.com/Choyounhwa/-dream-guardian/issues/143
- **Labels**: `phase-6`, `feature`, `P1-high`, `phase-7`
- **작업 ID**: `[UI-INGAME-001]`
- **상태**: 🟢 **완료 (Closed)**
- **목적**:
  - 첨부된 4번째(인게임 문제 선택)와 5번째(게임 결과) 설계에 따라, 문제와 답안이 화면에서 어긋나거나 겹치지 않도록 **마젠타 고정 영역(Magenta Box)**을 확립한다.
  - 밋밋하던 직사각형 점선 피트니스 존을 폐기하고, 사용자가 제공한 3종 이미지 에셋(`E_Pit_act1~3.png`)을 활용하여 다방향으로 회전(Spin/Orbit/Shimmer)하는 화려한 마법진 피트니스 존 이펙트를 구현한다.
  - 결과 화면을 체계적인 **마젠타 결과 카드 패널**로 감싸고, 8개 운동 통계 지표를 74px 높이별 1:1 매칭 44px 대형 폰트로 개편한다.
- **삭제(제거) 대상**:
  1. `HUDLayer.ts` 내 좌하단 구석 세로형 플라스크 렌더링 함수(`_renderManaFlask`) 삭제 (하단 고정 바 중앙 수평 게이지로 이관)
  2. `AnswerSelectionRenderer.ts` 내 단순 직사각형 점선 테두리(`ctx.strokeRect`) 및 텍스트 렌더링 삭제
  3. `main.ts` `renderQuestion` 내 경계 없이 임의 Y좌표에 수식을 그리던 레거시 코드 삭제
  4. `ResultRenderer.ts` 내 프레임 없이 텍스트를 단순 나열하던 코드 삭제
- **신규 구현 내용**:
  1. **마젠타 문제영역 고정 컨테이너 (Image 4 - Magenta Box)**:
     - 규격: **`x: 100px, y: 320px, w: 880px, h: 1000px`**
     - 수식 텍스트 오버플로우 방지: 수식 길이에 따라 폰트 크기를 자동 스케일 다운(`scaleDownToFit`: 기본 88px → 최대 56px)하여 절대 마젠타 박스를 벗어나지 않도록 고정
     - 답안 버튼 2개: 크기 개별 **`w: 360px, h: 260px`**, 좌표 좌 `x: 140, y: 960`, 우 `x: 580, y: 960`, 수식 폰트 **`bold 96px`**
  2. **피트니스 존 활성 3중 회전 마법진 (Image 4 - Cyan Circles)**:
     - 에셋: `dream_guardian/img/E_Pit_act1.png`, `E_Pit_act2.png`, `E_Pit_act3.png`
     - 활성 존 중심점(`cx, cy`) 기준으로 3개 레이어를 각각 다른 방향과 속도로 회전:
       - 링 1 (`E_Pit_act1.png`): 시계 방향 (`angle = time * 0.8`)
       - 링 2 (`E_Pit_act2.png`): 반시계 방향 고속 회전 (`angle = -time * 1.2`)
       - 링 3 (`E_Pit_act3.png`): 시계 방향 펄스 회전 (`angle = time * 0.5`, 알파 0.6~1.0)
     - 스크린 블렌드 모드(`screen`) 및 네온 글로우 파티클 적용
  3. **하단 고정 바 중앙 HUD & 우측 "정지" 버튼 (Image 4 - Yellow Bar)**:
     - 중앙: 수평 마나 게이지 바 (0~100) 및 콤보 배지 통합 표시
     - 우측 버튼: `x: 810px, y: 1990px, w: 240px, h: 140px`, 폰트 **`bold 42px`** ("정지" / 일시정지 모달 트리거)
  4. **마젠타 결과 카드 패널 및 1:1 대형 폰트 리포트 (Image 5)**:
     - 마젠타 컨테이너 패널: **`x: 100px, y: 240px, w: 880px, h: 1580px`**, 네온 패널 스타일
     - 타이틀: 높이 150px 기준 **`bold 100px`** ("승리!" / "패배..."), 챕터명 **`42px`**
     - 8개 운동 통계: 1개 라인 높이 **`74px`**, 폰트 **`bold 44px`** 1:1 매칭 렌더링
       (정답률, 최대콤보, 시간, 걸음, 스쿼트, 점프, 자세유지, 칼로리)
     - 하단 고정 바 우측 "메뉴로" 버튼: **`bold 42px`**
- **유지 사항**:
  - safeEval 수식 평가 및 CSV 문제 출제 로직
  - 전투 대미지 계산, 마나 100 도달 시 수호신 스펠 시전 로직
  - 칼로리 공식 `(steps*0.04) + (squats*0.35) + (jumps*0.15) + (dwellTime*0.07)` 계산식
- **변경 금지**:
  - `MathRenderer`의 가로 분수선, 지수, 루트 기호 파싱 로직
  - 커서 트래킹 랜드마크 추출 및 Cover 프로젝션
- **완료 조건**:
  - [x] 문제 수식이 마젠타 박스(880x1000px) 내부 중앙에 고정되고 긴 수식도 경계를 벗어나지 않음
  - [x] 활성 피트니스 존에 `E_Pit_act1~3.png` 3중 링이 각기 다른 방향으로 회전하며 마법진 이펙트를 연출함
  - [x] 결과 화면이 마젠타 패널로 감싸지고 8개 지표가 44px 대형 폰트로 선명하게 표시됨
  - [x] 하단 고정 바의 중앙 마나 바 및 "정지", "메뉴로" 버튼이 정상 작동함
  - [x] `npm test` 단위 테스트 100% Pass 및 빌드 정상 완료
- **테스트**:
  - `npx vitest run tests/unit/ui-system.test.ts`
  - 브라우저 상에서 인게임 문제 풀이, 마법진 회전 애니메이션 및 결과 화면 검증
- **관련 파일**:
  - `dream_guardian/src/render/AnswerSelectionRenderer.ts`
  - `dream_guardian/src/render/MathRenderer.ts`
  - `dream_guardian/src/ui/HUDLayer.ts`
  - `dream_guardian/src/ui/ResultRenderer.ts`
  - `dream_guardian/src/main.ts`
  - `dream_guardian/tests/unit/ui-system.test.ts`

---

### Issue #144 (Card #71): [BUG-SCALE-002] 실사용 웹캠 근접 환경(귀 가림·팔꿈치 이탈) 신체 실측 크기 동적 추정 고도화 및 커서 시인성 현실화
- **GitHub URL**: https://github.com/Choyounhwa/-dream-guardian/issues/144
- **Labels**: `bug`, `P1-high`, `phase-3`, `phase-6`
- **Milestone**: `v0.5-input-ui`
- **작업 ID**: `[BUG-SCALE-002]`
- **상태**: 🟢 **완료 (Done - 2026-09-24)**
- **목적**:
  - 실제 웹캠 플레이 환경(상반신 클로즈업, 헤드셋 착용, 한 손 올림, 팔꿈치 화면 밖 이탈 등)에서 머리와 손 커서가 신체 크기를 따라가지 못하고 작게 고정되던 결함을 해결한다.
  - 귀가 가려져도 눈 간격 및 안면 비례로 머리 크기를 정밀 측정하고, 팔꿈치가 화면 밖으로 잘려도 손바닥 중심을 정확히 찾아내어, 1080×2160 캔버스 상에서 실제 사용자 신체 크기에 맞게 시원하게 감싸도록 가시성을 현실화한다.
- **현상 및 원인 분석**:
  1. **머리(HEAD) 귀 인식 실패 시 극소 크기(26×34px) 박제**:
     - 기존 로직은 양 귀(#7, #8)가 선명할 때만 머리 크기를 계산함.
     - 헤드셋 착용이나 손을 올렸을 때 귀가 가려지면 기본값인 26×34px로 강제 Fallback되어, 450px짜리 실제 얼굴 위에 코딱지만 한 보라색 타원이 얹혀짐.
  2. **오른손(R) 팔꿈치 화면 밖 이탈 시 손목 및 기본 크기(22px) 박제**:
     - 상반신 근접 구도에서 팔꿈치(#14)가 화면 밖으로 잘리면 전완 벡터 연장이 실패하여 손목에 커서가 멈춤.
     - `handLength = 0`이 되어 250px 크기의 실제 손 위에 22px짜리 작은 동전 원만 표시됨.
  3. **1080p 해상도 대비 과소 설정된 최대 상한선(Max Bounds)**:
     - `cursor.config.ts`의 최대 상한선(`maxRadiusX: 52px`, `maxRadius: 48px`)이 1080×2160 화면 대비 너무 작게 제한되어 있어, 사용자가 가까이 와도 성인 신체 대비 1/5 크기 이상 커지지 못함.
- **TDD 테스트 선작성 계획 (Red → Green)**:
  1. [Test 1] 안면 부분 가림(귀 신뢰도 0) 시 눈 간격(#2-#5) 기반 머리 크기 동적 추정 테스트
  2. [Test 2] 팔꿈치 화면 이탈 시에도 손바닥 중심점(Palm) 전진 추정 테스트
  3. [Test 3] 1080×2160 해상도 실측 신체 비례 스케일 범위 검증
- **수정 대상**:
  - `dream_guardian/config/cursor.config.ts`
  - `dream_guardian/src/input/CursorTracker.ts`
  - `dream_guardian/src/render/AnswerSelectionRenderer.ts`
  - `dream_guardian/src/skeleton/JointRenderer.ts`
  - `dream_guardian/src/skeleton/BoneRenderer.ts`
  - `dream_guardian/tests/unit/cursor-tracker-recipe.test.ts`
- **구현 내용**:
  1. 다계층 안면 크기 추정 파이프라인 (`CursorTracker._estimateHeadSize`): 1순위 귀 간격, 2순위 눈 간격(x2.6), 3순위 어깨 너비 기반 scaleFactor 비례
  2. 팔꿈치 결손 대응 손바닥 추정 강화 (`CursorTracker._estimatePalmCenter`): 어깨-손목 축 40~70px 전진 (상반신 근접 가상 뷰포트 환경), `JointRenderer` 및 `BoneRenderer`와 완전 일치
  3. 1080p 뷰포트 규격에 맞춘 커서 현실적 크기 상한선 확장 (`cursor.config.ts`): 머리 55×72px (최대 140×185px), 손 45px (최대 90px), 골반 55px (최대 120px), PC baselineShoulder 350px 및 scaleFactor 하한 0.70 보장
- **완료 조건**:
  - [x] 헤드셋이나 손으로 귀가 가려져도 머리 커서가 실제 얼굴 크기에 맞춰 동적으로 크기 조절됨
  - [x] 팔꿈치가 화면 밖으로 나가도 손 커서가 손목이 아닌 실제 손바닥 중심에 위치함
  - [x] 화면 속 1080p 해상도 기준 얼굴과 손바닥을 시원하게 감싸는 현실적 크기(손 50px+, 머리 100px+)로 렌더링됨
  - [x] `npm test` 100% Pass 및 프로덕션 빌드 0 에러
- **관련 파일**:
  - `dream_guardian/config/cursor.config.ts`
  - `dream_guardian/src/input/CursorTracker.ts`
  - `dream_guardian/src/render/AnswerSelectionRenderer.ts`
  - `dream_guardian/src/skeleton/JointRenderer.ts`
  - `dream_guardian/src/skeleton/BoneRenderer.ts`
  - `dream_guardian/tests/unit/cursor-tracker-recipe.test.ts`

---

### Issue #145 (Card #72): [FEAT-CURSOR-004] 스켈레톤 손 트래킹 중지 기저부(MCP) 위치 조정 및 골반 커서 실측 다리 너비(1.5x) 라운드 납작 마름모 개편
- **GitHub URL**: https://github.com/Choyounhwa/-dream-guardian/issues/145
- **Labels**: `feature`, `P1-high`, `phase-3`, `phase-6`
- **Milestone**: `v0.5-input-ui`
- **작업 ID**: `[FEAT-CURSOR-004]`
- **상태**: 🟢 **완료 (Done - 2026-09-24)**
- **목적**:
  1. 손 커서 및 스켈레톤 손 관절 트래킹 포인트를 기존 손바닥 하단/손목 중심에서 **중지 손가락 시작 부분(3rd MCP Joint)**으로 상향 조정하여 실제 조작감과 시각적 직관성을 향상시킨다.
  2. 골반(HIP) 커서의 크기를 힙과 연결된 양다리 시작 포인트(Left Hip #23 ~ Right Hip #24) 사이의 실측 거리를 기준으로 **1.5배(너비 = hipDist × 1.5)** 크게 동적 확장한다.
  3. 기존 역삼각형 골반 커서 형상을 인체 골반 형태에 맞는 **납작한 마름모(Flattened Rhombus, 모서리 라운드)**로 개편하여 시인성과 심미성을 극대화한다.
- **현상 및 원인 분석**:
  1. **손 트래킹 기준점 편향 (손목 근접)**: 기존 `_estimatePalmCenter`는 손목 가중치(0.4)가 높아 손바닥 하단에 위치함.
  2. **골반 커서 크기 과소 (실제 고관절 폭 미달)**: 기존 반너비 계산식(`hipDistPx * 0.28`)은 양다리 시작점 거리의 절반 수준에 불과하여 골반을 감싸지 못함.
  3. **골반 커서 형상 불일치 (단순 역삼각형)**: 스켈레톤 관절 마커 및 UI 부위 아이콘(다이아몬드/마름모)과 달리 역삼각형으로 렌더링되어 형태 불일치.
- **TDD 테스트 선작성 계획 (Red → Green)**:
  1. [Test 1] 손바닥 트래킹 좌표가 중지 손가락 시작점(MCP, 검지-소지 중점 가중치 `wrist * 0.15 + (index + pinky) * 0.425`)으로 산출되는지 검증
  2. [Test 2] 골반 커서 크기가 양다리 시작점(#23-#24) 사이 거리의 1.5배(너비 = hipDist × 1.5)로 동적 확장되는지 수치 검증
  3. [Test 3] 골반 커서가 4개 꼭짓점 기반 납작 마름모(모서리 라운드) 형상으로 렌더링되는지 패스 검증
- **수정 대상**:
  - `dream_guardian/config/cursor.config.ts`
  - `dream_guardian/src/input/CursorTracker.ts`
  - `dream_guardian/src/render/AnswerSelectionRenderer.ts`
  - `dream_guardian/src/skeleton/JointRenderer.ts`
  - `dream_guardian/src/skeleton/BoneRenderer.ts`
  - `dream_guardian/src/render/PartIconRenderer.ts`
  - `dream_guardian/tests/unit/cursor-tracker-recipe.test.ts`
- **구현 내용**:
  1. `CursorTracker._estimatePalmCenter` 중지 손가락 기저부 가중치 재조정 및 `JointRenderer`, `BoneRenderer` 0px 동기화
  2. 골반 실측 다리 너비 대비 1.5배 스케일링 (`halfWidth = hipDist * 0.75`, `halfHeight = halfWidth * 0.45`, `maxHalfWidth: 220px`)
  3. `AnswerSelectionRenderer._renderCursors` 골반 형상 납작 라운드 마름모 개편 (상·우·하·좌 4개 꼭짓점 라운드 연결, Canvas arcTo fallback 안전 처리)
- **완료 조건**:
  - [x] 손 커서 및 스켈레톤 손 마커 중심이 중지 손가락 시작부(MCP)에 정확히 위치함
  - [x] 골반 커서 너비가 양 고관절 시작점(#23-#24) 사이 실측 거리의 1.5배로 동적 사이징됨
  - [x] 골반 커서가 모서리가 둥근 납작한 마름모 모양으로 시원하게 렌더링됨
  - [x] `npm test` 100% Pass 및 `npm run build` 0 에러
- **관련 파일**:
  - `dream_guardian/config/cursor.config.ts`
  - `dream_guardian/src/input/CursorTracker.ts`
  - `dream_guardian/src/render/AnswerSelectionRenderer.ts`
  - `dream_guardian/src/skeleton/JointRenderer.ts`
  - `dream_guardian/src/skeleton/BoneRenderer.ts`
  - `dream_guardian/src/render/PartIconRenderer.ts`
  - `dream_guardian/tests/unit/cursor-tracker-recipe.test.ts`

---

### Issue #146 (Card #76): [BUG-BATTLE-001] 정답 시 보스 HP 즉시 감소 타격 누락 결함 (4문제 맞혀야만 HP 감소)
- **GitHub URL**: https://github.com/Choyounhwa/-dream-guardian/issues/146
- **Labels**: `bug`, `P1-high`, `phase-5`
- **Milestone**: `v0.4-gameplay-systems`
- **작업 ID**: `[BUG-BATTLE-001]`
- **상태**: ⚪ **대기 (승인 대기)**
- **목적**:
  - 수학 문제를 맞힐 때마다 보스의 HP가 즉시 닳지 않고 마나 100(4문제 정답)이 채워져야만 한 번에 감소하는 결함을 수정하여, 매 정답마다 즉각적인 보스 타격 피드백과 HP 감소를 제공한다.
- **현상 및 원인 분석**:
  1. `src/main.ts`의 `handleAnswer()` 로직에서 정답 시 `battle.onCorrect()`로 마나만 +25 적립되며, 보스 데미지 처리(`boss.takeDamage`)가 `battle.trySpendMana()`(마나 100 이상일 때만 true) 조건문 내부에만 존재함.
  2. 이로 인해 1~3번째 문제에서는 보스에게 가해지는 데미지가 0이며, 4번째 문제에서만 4 데미지가 몰아서 들어감.
- **수정 계획**:
  1. 매 정답마다 보스에게 기본 데미지(`correctDamage: 1`)를 즉시 부여 (`boss.takeDamage(1)`)하고, 피격 애니메이션(`bossRenderer.triggerHit()`) 및 타격 효과를 즉시 연출.
  2. 마나 100 달성 시 발동하는 수호신 캐스팅(`guardian.cast()`)은 강력한 보너스 마법 공격(`spellDamage: 2` 등)으로 추가 타격 및 화려한 마법 연출로 연계.
- **완료 조건**:
  - [ ] 정답을 맞출 때마다 보스 HP가 즉시 1씩 감소하고 피격 애니메이션이 발동함
  - [ ] 마나 100 도달 시 수호신 스펠 캐스팅이 추가 보너스 데미지와 함께 발동함
  - [ ] 단위 테스트 및 빌드 100% 통과

---

### Issue #147 (Card #77): [BUG-BATTLE-002] 기습 보스 공격 타이머 제거 및 오답 반격 일원화를 통한 전투 템포/체력 소진 결함 개선
- **GitHub URL**: https://github.com/Choyounhwa/-dream-guardian/issues/147
- **Labels**: `bug`, `P1-high`, `phase-5`
- **Milestone**: `v0.4-gameplay-systems`
- **작업 ID**: `[BUG-BATTLE-002]`
- **상태**: ⚪ **대기 (승인 대기)**
- **목적**:
  - 상시 돌아가는 독립 보스 공격 타이머로 인해 플레이어가 무차별 피격되어 순식간에 게임오버되는 현상을 해결한다.
  - 달리기/문제 풀이 중 돌발 스쿼트 방어 요구로 인한 신체 리듬 파괴 및 인지 과부하를 방지하기 위해, 기습 공격 타이머를 제거하고 보스 공격을 **오답 시 반격(-25 HP)**으로 일원화하여 매끄러운 전투 템포를 확보한다.
- **현상 및 원인 분석**:
  1. `src/main.ts`에서 페이즈와 무관하게 `boss.update(dt)`가 상시 실행되어 약 9.5초마다 강제 공격이 발동함.
  2. `boss.resolveAttack(false)`로 `shielded: false`가 하드코딩되어 플레이어 체력이 15씩 계속 깎여 의문사(Game Over) 발생.
  3. 돌발 스쿼트 방어의 한계:
     - **달리기 중 스쿼트**: 유산소 러닝 중 급제동 스쿼트는 관절 부하 및 리듬 단절을 유발하며, 달리기 중 몸의 상하 흔들림으로 인한 MediaPipe 센서 오인식 위험이 큼.
     - **문제 풀이 중 스쿼트**: 암산 집중과 자세 유지(Dwell)를 깨뜨려 인지적 과부하와 조작 혼란을 야기함.
     - **스쿼트의 본래 역할**: 스쿼트는 이미 10개 피트니스 존 중 하단 존(Zone 7~10) 정답 선택 동작(P08~P12 등)에 자연스럽게 흡수되어 있음.
- **대안 비교 분석 및 결정**:
  | 구분 | 대안 A (채택: 가장 추천) | 대안 B (링피트식 턴제 분리) | 대안 C (타임아웃 페널티) |
  |---|---|---|---|
  | **핵심 컨셉** | **기습 보스 공격/방어 완전 삭제 (오답 시에만 보스 반격)** | 독립된 [보스 반격 페이즈] 신설 (3문제마다 3초 스쿼트 방어) | 문제 풀이 제한시간 초과 시 피격 |
  | **흐름** | **[달리기 3초] → [문제+운동자세 선택] → 정답 시 타격 / 오답 시 보스 반격(-25 HP)** | [달리기] → [문제 3개] → [보스 필살기 경고! 3초 스쿼트 홀드] | 문제당 15초 초과 시 보스가 1회 공격 |
  | **장점** | • 템포가 가장 깔끔하고 몰입도 최고<br>• 센서 오인식 위험 제로<br>• 군더더기 없는 체감형 RPG | • 달리기/연산과 섞이지 않음<br>• 온전히 3초 스쿼트 버티기 운동 집중 | • 문제를 질질 끌지 않고 긴장감 부여 |
  | **단점** | 보스만의 독립 타이머 공격은 사라짐 | 새로운 게임 페이즈(State) 구현 필요 | 연산이 느린 아동에게 압박감 |

  **결정: 대안 A 채택**
  - 템포가 가장 깔끔하고, 달리기나 연산 집중을 방해하지 않으며, 센서 오인식 위험이 없습니다.
  - 보스의 공격은 플레이어가 '오답'을 냈을 때의 피격 연출(-25 HP)로 일원화합니다.
  - 스쿼트는 억지 방어가 아니라 하단 존(Zone 7~10) 정답 선택 시 수행하는 피트니스 포즈로서의 고유 역할을 유지합니다.
- **수정 계획 (대안 A 채택)**:
  1. `src/main.ts` 게임 루프에서 주기적 기습 보스 공격(`boss.update`, `boss.resolveAttack`) 로직 제거.
  2. 보스의 공격 모션(`bossRenderer.triggerAttack()`) 및 피격 연출을 **오답 시 보스 반격(-25 HP)**으로 일원화.
  3. 스쿼트 동작은 하단 피트니스 존 정답 선택(자세 유지) 운동으로서의 고유 역할에 집중.
  4. `BossController`의 불필요한 자동 타이머 의존성을 정리하고, 관련 단위 테스트(`battle-system.test.ts` 등) 동기화.
- **유지 사항**:
  - 오답 시 플레이어 HP 차감(-25 HP) 및 피격 사운드/이펙트
  - 정답 시 보스 타격(기본 1 데미지) 및 마나 100 도달 시 수호신 스펠 캐스팅
  - 10존 피트니스 매칭 및 하단 존(Zone 7~10) 스쿼트/포스처 체류 판정
- **변경 금지**:
  - 제자리 달리기 게이지 충전 알고리즘 (`RunDetector`)
  - 10개 피트니스 존 매칭 및 360종 운동 패턴 데이터
- **완료 조건**:
  - [ ] 문제 풀이 및 달리기 중 기습적인 보스 공격/체력 소진이 발생하지 않음
  - [ ] 오답 선택 시 보스가 공격 모션을 취하며 플레이어 HP가 정상적으로 차감(-25)됨
  - [ ] 게임 흐름이 끊기지 않고 [달리기 → 문제 풀이/자세 유지 → 피드백] 순으로 매끄럽게 순환됨
  - [ ] 단위 테스트 및 빌드 100% 통과
- **관련 파일**:
  - `dream_guardian/src/main.ts`
  - `dream_guardian/src/game/BossController.ts`
  - `dream_guardian/tests/unit/battle-system.test.ts`

---

### Issue #148 (Card #78): [FEAT-UI-005] 답안 버튼 사각형 중심점 기점 방사형(Radial) 색상 분할 렌더링 구현
- **GitHub URL**: https://github.com/Choyounhwa/-dream-guardian/issues/148
- **Labels**: `feature`, `P1-high`, `phase-6`
- **Milestone**: `v0.5-input-ui`
- **작업 ID**: `[FEAT-UI-005]`
- **상태**: 🟢 **완료 (Pass)**
- **목적**:
  - 답안 버튼(둥근 사각형) 형태를 유지하면서 선형 그라디언트를 사각형 중심점 기점 방사형(Radial) 색상 분할로 개편하여 요구 커서 시인성 극대화.
- **완료 조건**:
  - [x] 1색(단색), 2색(1/2 방사형), 3색(1/3 방사형) 분할 렌더러 구현
  - [x] 단위 테스트 및 빌드 100% 통과

---

### Issue #149 (Card #79): [FEAT-ZONE-002] 11번 우저(Right Bottom) 피트니스 존 추가 및 11구역 레이아웃 정합성 확보
- **GitHub URL**: https://github.com/Choyounhwa/-dream-guardian/issues/149
- **Labels**: `phase-3`, `feature`, `P1-high`, `phase-6`
- **Milestone**: `v0.3-vision-motion`
- **작업 ID**: `[FEAT-ZONE-002]`
- **상태**: 🟢 **완료 (Pass)**
- **목적**:
  - 설계 문서 및 패턴 원본과 달리 코드에서 누락된 11번 존(`우저`, x: 0.70, y: 0.78, 0.26x0.16) 추가.
- **완료 조건**:
  - [x] `HIP_ZONES`에 11번 포함 및 11개 존 겹침 0% 보장
  - [x] 단위 테스트 및 빌드 100% 통과

---

### Issue #150 (Card #80): [REFACTOR-POSE-001] 좌/우 답안 공용 피트니스 존(Shared Active Zone) 및 색상 커서 선택 메커니즘 전환
- **GitHub URL**: https://github.com/Choyounhwa/-dream-guardian/issues/150
- **Labels**: `phase-3`, `refactor`, `P1-high`
- **Milestone**: `v0.3-vision-motion`
- **작업 ID**: `[REFACTOR-POSE-001]`
- **상태**: 🟢 **완료 (Pass)**
- **목적**:
  - 좌/우 선택지별 분리 존 배정 방식을 설계 대전제인 "공용 활성 존에 계산한 답안의 색상 커서를 이동하여 판정"하는 메커니즘으로 전환.
- **완료 조건**:
  - [x] `RecipeGenerator`, `AnswerSelector` 공용 타겟 존 연동
  - [x] 단위 테스트 및 빌드 100% 통과

---

### Issue #151 (Card #81): [FEAT-POSE-006] 신체 부위별(왼손/오른손 비대칭 및 머리) 허용 피트니스 존 제약 및 색상 완전 비공유 보장
- **GitHub URL**: https://github.com/Choyounhwa/-dream-guardian/issues/151
- **Labels**: `phase-3`, `feature`, `P1-high`
- **Milestone**: `v0.3-vision-motion`
- **작업 ID**: `[FEAT-POSE-006]`
- **상태**: 🟢 **완료 (Pass)**
- **목적**:
  - 왼손/오른손의 전 구역 무제한 허용을 설계 규격(왼손: 1,2,4,6,7,9,10 / 오른손: 2,3,7,8,10,11)으로 비대칭 제한하고 C2 제약을 완전 배타로 강화.
- **완료 조건**:
  - [x] 좌/우 손 허용 피트니스 존 비대칭 분리
  - [x] C2 제약 강화 (`A.parts ∩ B.parts = ∅`)
  - [x] 단위 테스트 및 빌드 100% 통과

---

### Issue #152 (Card #82): [FEAT-SKEL-004] 스켈레톤 뼈대 연결선 투명도(20% 불투명도 조정) 정합성 반영
- **GitHub URL**: https://github.com/Choyounhwa/-dream-guardian/issues/152
- **Labels**: `phase-2`, `feature`, `P2-medium`
- **Milestone**: `v0.3-vision-motion`
- **작업 ID**: `[FEAT-SKEL-004]`
- **상태**: ⚪ **대기 (승인 대기)**
- **목적**:
  - 현재 `0.6`으로 다소 짙은 뼈대 연결선을 설계 문서 규격에 맞추어 20% 불투명도로 조정.
- **완료 조건**:
  - [ ] BoneRenderer 투명도 0.20 조정
  - [ ] 단위 테스트 및 빌드 100% 통과

---

### Issue #153 (Card #83): [FEAT-MOTION-001] 뛸 수 없는 환경을 위한 저소음/대체 이동(Locomotion) 감지기 3종 및 공통 인터페이스 구현
- **GitHub URL**: https://github.com/Choyounhwa/-dream-guardian/issues/153
- **Labels**: `phase-3`, `feature`, `P1-high`
- **Milestone**: `v0.3-vision-motion`
- **작업 ID**: `[FEAT-MOTION-001]`
- **상태**: 🟢 **완료 (Pass)**
- **목적**:
  - 아파트 층간 소음, 좁은 공간, 하체 부상 등 뛸 수 없는 환경에서 플레이어가 게임에 몰입할 수 있도록 골반 상하(무소음 바운스), 골반 좌우(스웨이/트월킹), 양손 교차(드라이빙/휠 펌핑) 3가지 저소음 대체 이동 감지기를 구현하고 공통 Locomotion 감지 인터페이스를 확립한다.
- **완료 조건**:
  - [x] `ILocomotionDetector` 인터페이스 및 3종 신규 감지기(`HipBounceDetector`, `HipSwayDetector`, `ArmCrossDetector`) 구현
  - [x] 골반 상하, 골반 좌우, 양손 교차 모션 시뮬레이션에서 스텝 카운트와 활성 상태를 정확하게 판정
  - [x] `Config.ts`에 모드별 감도 파라미터 외부화 완료
  - [x] 단위 테스트(`tests/unit/locomotion-detectors.test.ts`) 100% Pass 및 전체 테스트 회귀 없음
- **관련 파일**:
  - `dream_guardian/src/types/index.ts`
  - `dream_guardian/src/core/Config.ts`
  - `dream_guardian/src/motion/LocomotionDetector.ts`
  - `dream_guardian/src/motion/HipBounceDetector.ts`
  - `dream_guardian/src/motion/HipSwayDetector.ts`
  - `dream_guardian/src/motion/ArmCrossDetector.ts`
  - `dream_guardian/src/motion/RunDetector.ts`
  - `dream_guardian/src/motion/index.ts`
  - `dream_guardian/tests/unit/locomotion-detectors.test.ts`

---

### Issue #154 (Card #84): [FEAT-UI-006] 운동 모드(이동 방식 4종) 선택 UI 모달 및 커서/터치 인터랙션 구현
- **GitHub URL**: https://github.com/Choyounhwa/-dream-guardian/issues/154
- **Labels**: `phase-6`, `feature`, `P1-high`
- **Milestone**: `v0.5-input-ui`
- **작업 ID**: `[FEAT-UI-006]`
- **상태**: 🟢 **완료 (Pass)**
- **목적**:
  - 게임 시작 전 또는 인게임 설정에서 플레이어가 거주 환경(소음, 공간 등)에 맞춰 원하는 운동 방식(🏃 제자리 달리기, 🦘 골반 바운스, 💃 골반 스웨이, 🚗 양손 교차)을 직관적으로 선택할 수 있는 대화면 UI 모달과 4색 커서 체류(Dwell) 및 클릭 인터랙션을 구현한다.
- **완료 조건**:
  - [x] 4종 운동 모드를 시각적으로 안내하는 2x2 카드 UI 모달 렌더링
  - [x] 신체 커서 체류(0.8s) 및 클릭으로 모드 선택 및 활성화 상태 변경 가능
  - [x] `localStorage`를 통한 선택 모드 영속 저장 및 복원
  - [x] 단위 테스트(`tests/unit/locomotion-ui.test.ts`) 100% Pass
- **관련 파일**:
  - `dream_guardian/src/ui/LocomotionModal.ts`
  - `dream_guardian/src/ui/MenuRenderer.ts`
  - `dream_guardian/src/ui/index.ts`
  - `dream_guardian/src/input/MenuInput.ts`
  - `dream_guardian/tests/unit/locomotion-ui.test.ts`

---

### Issue #155 (Card #85): [FEAT-GAME-002] 선택된 운동 모드 인게임 러닝 루프/HUD 동작 가이드 및 맞춤 칼로리 공식 연동
- **GitHub URL**: https://github.com/Choyounhwa/-dream-guardian/issues/155
- **Labels**: `phase-5`, `phase-6`, `feature`, `P1-high`
- **Milestone**: `v0.4-gameplay-systems`
- **작업 ID**: `[FEAT-GAME-002]`
- **상태**: 🟢 **완료 (Pass)**
- **목적**:
  - 플레이어가 선택한 운동 모드에 맞춰 `gamePhase === 'running'` 게이지 충전 루프를 해당 감지기와 연동하고, 인게임 HUD에 실시간 모션 가이드 힌트를 표출하며, 결과 화면에서 모드별 맞춤 칼로리 소모 공식을 적용한다.
- **완료 조건**:
  - [x] 4종 운동 모드 각각에서 동작 인식 시 정상적으로 게이지가 충전되어 다음 문제로 진입
  - [x] 러닝 구간 진입 시 현재 선택된 모드에 일치하는 HUD 가이드 텍스트 출력
  - [x] 결과 화면에서 선택된 모드에 맞는 칼로리 계산식 적용 및 표출
  - [x] 단위 테스트(`tests/unit/locomotion-gameplay.test.ts`) 100% Pass 및 전체 테스트 통과
- **관련 파일**:
  - `dream_guardian/src/main.ts`
  - `dream_guardian/src/ui/HUDLayer.ts`
  - `dream_guardian/src/ui/ResultRenderer.ts`
  - `dream_guardian/tests/unit/locomotion-gameplay.test.ts`

---

### Issue #156 (Card #86): [FEAT-ZONE-003] 커서-존 허용 매트릭스 개편 (양손 전 존 1~11 허용, 머리 존 4~5 한정) 및 Cross-Body 제약(Hip 9~11 시 손 1~3 차단) 신설
- **GitHub URL**: https://github.com/Choyounhwa/-dream-guardian/issues/156
- **Labels**: `phase-3`, `feature`, `P1-high`
- **Milestone**: `v0.3-vision-motion`
- **작업 ID**: `[FEAT-ZONE-003]`
- **상태**: 🟢 **완료 (Pass)**
- **목적**:
  - 실제 신체 가동 범위(옆구리 늘리기, 교차 도달) 분석에 따라 왼손/오른손을 전 피트니스 존(1~11)으로 확장하고, 점프로 일시 도달은 가능하나 체류 유지가 불가능한 머리 커서의 상단 존(1~3)을 배제하여 머리를 좌/우 중단 존(4, 5)으로 한정한다. 아울러 골반이 최하단(존 9~11)에 도달했을 때 양손이 최상단(존 1~3)에 도달하는 물리적 한계 자세를 차단하는 Cross-Body 연동 제약을 신설한다.
- **완료 조건**:
  - [x] `LEFT_HAND_ZONES` 및 `RIGHT_HAND_ZONES` 전 존(1~11) 허용 확립
  - [x] `HEAD_ZONES`를 `{4, 5}`로 한정 (존 1~3 배제)
  - [x] `isValidZoneForCursor()` 및 Cross-Body 제약(hip: 9~11 시 hand: 1~3 차단) 함수 구현
  - [x] `PostureGenerator` C5 검증 로직 및 `DEFAULT_CURATED_PATTERNS` 내 머리 존 1~3 패턴을 4/5로 수정
  - [x] 단위 테스트 100% Pass 및 타입 에러 0건
- **관련 파일**:
  - `dream_guardian/config/zone.config.ts`
  - `dream_guardian/src/input/RecipeGenerator.ts`
  - `dream_guardian/src/input/PostureGenerator.ts`
  - `dream_guardian/tests/unit/zone-config.test.ts`
  - `dream_guardian/tests/unit/posture-generator.test.ts`

---

### Issue #157 (Card #87): [DATA-002] fitness pattern.csv 신규 HEAD_ZONES {4,5} 제약 반영 및 머리 패턴 전수 보정
- **GitHub URL**: https://github.com/Choyounhwa/-dream-guardian/issues/157
- **Labels**: `phase-4`, `data`, `P1-high`
- **Milestone**: `v0.3-vision-motion`
- **작업 ID**: `[DATA-002]`
- **상태**: 🟢 **완료 (Pass)**
- **목적**:
  - `FEAT-ZONE-003`에서 갱신된 `HEAD_ZONES: {4, 5}` 규격에 맞추어 `fitness pattern.csv` 원본 데이터(360건) 중 존 1~3을 요구하는 162건의 머리 패턴을 유효한 존(존 1·2 → 4 좌측 기울임, 존 3 → 5 우측 기울임)으로 전수 보정한다.
- **완료 조건**:
  - [x] `fitness pattern.csv` 내 머리 컬럼 중 1, 2, 3 값이 완전히 제거되고 4 또는 5로 재배치 (총 216건의 머리 패턴 중 1/2/3 0건, 4: 179건, 5: 37건)
  - [x] 골반 9~11 행에서 양손이 1~3인 Cross-Body 위반 패턴 전수 정비 (0건 확인)
  - [x] `FitnessPatternLoader` 360건 무오류 파싱 및 유효성 검증 스크립트 위반 0건 확인
  - [x] 단위 테스트 100% Pass (452/452 Pass)
- **관련 파일**:
  - `fitness pattern.csv`
  - `dream_guardian/public/fitness pattern.csv`
  - `dream_guardian/src/data/fitness pattern.csv`
  - `dream_guardian/src/data/FitnessPatternLoader.ts`
  - `dream_guardian/tests/unit/fitness-pattern-loader.test.ts`

---

### Issue #158 (Card #88): [FEAT-ZONE-004] PostureGenerator C8 제약(Cross-Body) 통합 및 패턴 풀 필터링
- **GitHub URL**: https://github.com/Choyounhwa/-dream-guardian/issues/158
- **Labels**: `phase-3`, `feature`, `P1-high`
- **Milestone**: `v0.3-vision-motion`
- **작업 ID**: `[FEAT-ZONE-004]`
- **상태**: 🟢 **완료 (Pass)**
- **목적**:
  - `PostureGenerator`의 7대 안전 제약(C1~C7) 체계에 Cross-Body 물리 연동 제약을 **C8 제약**으로 정식 통합하고, `validatePosturePair()` 및 `FitnessPatternLoader`에서 위반 패턴을 런타임에 자동 필터링한다.
- **완료 조건**:
  - [x] `validatePosturePair()`에서 C8 제약 위반 감지 및 에러 이유 반환
  - [x] hip: 9~11과 hand: 1~3 조합이 거부됨
  - [x] hip: 6~8과 hand: 1~3 조합은 정상 통과
  - [x] 100회 연속 생성 테스트 무결성 확인
  - [x] `npm test` 100% Pass
- **관련 파일**:
  - `dream_guardian/src/input/PostureGenerator.ts`
  - `dream_guardian/src/data/FitnessPatternLoader.ts`
  - `dream_guardian/tests/unit/posture-generator.test.ts`
  - `dream_guardian/tests/unit/fitness-pattern-loader.test.ts`

---

### Issue #159 (Card #89): [FEAT-GUIDE-001] 목표 자세 실루엣 가이드 오버레이 (PostureGuideRenderer) 구현
- **GitHub URL**: https://github.com/Choyounhwa/-dream-guardian/issues/159
- **Labels**: `phase-6`, `feature`, `P1-high`
- **Milestone**: `v0.5-input-ui`
- **작업 ID**: `[FEAT-GUIDE-001]`
- **상태**: 🟢 **완료 (Pass)**
- **목적**:
  - 플레이어가 출제된 문제를 보고 요구되는 신체 부위와 목표 존으로 신속히 이동할 수 있도록, 목표 피트니스 존 네온 하이라이트(부위 색상 글로우 및 중앙 아이콘)와 반투명 스틱맨 인체 실루엣을 렌더링하는 `PostureGuideRenderer`를 신설한다.
- **완료 조건**:
  - [x] `PostureGuideRenderer` 클래스 신설 및 `AnswerPosture` 기반 목표 자세 실루엣(스틱맨) 렌더링
  - [x] 목표 피트니스 존 테두리 부위 색상 글로우 및 중앙 부위 벡터 아이콘 렌더링
  - [x] 커서가 진입한 유효 선택지 실루엣의 능동적 하이라이트 전환
  - [x] 단위 테스트 100% Pass 및 렌더링 성능 60fps 유지
- **관련 파일**:
  - `dream_guardian/src/render/PostureGuideRenderer.ts`
  - `dream_guardian/src/render/index.ts`
  - `dream_guardian/src/main.ts`
  - `dream_guardian/tests/unit/posture-guide-renderer.test.ts`

---

### Issue #160 (Card #90): [FEAT-GUIDE-002] 스테이지 시작 첫 문제 유도 화살표(Arrow Hint) 표시
- **GitHub URL**: https://github.com/Choyounhwa/-dream-guardian/issues/160
- **Labels**: `phase-6`, `feature`, `P2-medium`
- **Milestone**: `v0.5-input-ui`
- **작업 ID**: `[FEAT-GUIDE-002]`
- **상태**: 🟢 **완료 (Pass)**
- **목적**:
  - 스테이지 시작 시 플레이어가 조작법을 즉시 인지할 수 있도록 **첫 번째 문제에서만** 4색 신체 커서 현재 위치에서 목표 피트니스 존 중심을 가리키는 유도 화살표(Arrow Hint)를 표시하고, 존 진입 또는 5초 후 자연 페이드아웃 처리하며, 이후 문제에서는 화살표를 표시하지 않는다.
- **완료 조건**:
  - [x] `AnswerSelector`의 첫 문제(`questionNumber === 1`) 상태를 가이드 렌더러에 전달 (`isFirstQuestion` getter 연동)
  - [x] 커서 위치 → 목표 존 중심을 향하는 네온 화살표 렌더링
  - [x] 목표 존 진입 시 해당 화살표 즉시 소멸 및 5초 경과 시 자동 페이드아웃
  - [x] 두 번째 문제부터는 화살표 렌더링이 비활성화됨을 보장
  - [x] 단위 테스트 100% Pass (14/14 tests Pass)
- **관련 파일**:
  - `dream_guardian/src/render/PostureGuideRenderer.ts`
  - `dream_guardian/src/input/AnswerSelector.ts`
  - `dream_guardian/src/main.ts`
  - `dream_guardian/tests/unit/posture-guide-renderer.test.ts`

---

### Issue #161 (Card #91): [UI-MENU-004] 홈/서브 메뉴 중앙 개방형 레이아웃 재배치 및 박스·수학유형(3배) 규격 통일
- **GitHub URL**: https://github.com/Choyounhwa/-dream-guardian/issues/161
- **Labels**: `phase-6`, `feature`, `P1-high`
- **Milestone**: `v0.5-input-ui`
- **작업 ID**: `[UI-MENU-004]`
- **상태**: ⚪ **등록 완료 (승인 대기)**
- **목적**:
  - 플레이어가 화면 정면(중앙)에 섰을 때 메뉴 카드에 가려지지 않고 전신 스켈레톤과 웹캠 영상이 선명하게 보이도록 메뉴 위치를 중앙 기점 좌우 바깥쪽으로 배치한다 (중앙 개방형 뷰포트 확보).
  - 카드 박스 크기를 기존 대비 0.8배 (`w: 288px, h: 304px`)로 축소하여 공간 효율을 극대화한다.
  - 홈 화면 챕터 카드 상단의 불필요한 `Ch.1` ~ `Ch.5` 텍스트를 삭제하여 시각적 군더더기를 제거한다.
  - 1.5m~2m 원거리 플레이 환경에서 한눈에 과목/영역을 인지할 수 있도록 홈 메뉴 및 서브 메뉴의 수학 유형 텍스트(예: `덧셈 · 뺄셈`, `곱셈 · 나눗셈`, `분수` 등)를 기존 26px에서 3배(`78px`)로 대폭 확대한다.
  - 서브 메뉴의 박스 크기(기존 420x380) 및 텍스트 폰트/스타일을 모두 홈 메뉴 기준(`288px × 304px`, 78px 수학유형 등)으로 일관되게 통일한다.
- **완료 조건**:
  - [ ] 홈 메뉴와 서브 메뉴 카드가 중앙을 비우고 좌우 외곽(x: 50, x: 742)으로 재배치되어 중앙 404px 영역에 플레이어가 온전히 보임
  - [ ] 홈 메뉴 및 서브 메뉴 카드 박스 크기가 `w: 288px, h: 304px` (0.8배)로 완전 통일됨
  - [ ] 홈 화면 카드에서 `Ch.1` ~ `Ch.5` 텍스트가 완전히 삭제됨
  - [ ] 홈 메뉴와 서브 메뉴의 수학 유형 텍스트가 기존 대비 3배(`bold 78px`)로 확대 적용됨
  - [ ] 신규 레이아웃 좌표에 맞춰 마우스 클릭 및 모션 커서 히트테스트가 100% 정상 동작함
  - [ ] `npm test` 단위 테스트 100% Pass 및 `npm run build` 검증 완료
- **관련 파일**:
  - `dream_guardian/src/ui/MenuRenderer.ts`
  - `dream_guardian/tests/unit/ui-system.test.ts`
  - `dream_guardian/HANDOVER.md`

---

### Issue #166 (Card #92): [UI-BAR-002] 하단 고정바(BottomBar) 내 운동 모드 선택 버튼 신설 및 메인 제목 하단 레거시 제거
- **GitHub URL**: https://github.com/Choyounhwa/-dream-guardian/issues/166
- **Labels**: `phase-6`, `feature`, `P1-high`
- **Milestone**: `v0.5-input-ui`
- **작업 ID**: `[UI-BAR-002]`
- **상태**: ⚪ **대기 (승인 대기)**
- **목적**:
  - 현재 메인 메뉴 타이틀 하단에 위치한 운동 모드 선택 버튼을 삭제하여 타이틀 영역과 웹캠 중앙 뷰포트 시인성을 정돈한다.
  - 전 화면 공통 하단 고정바(`BottomBar`) 좌측 영역(`x: 190, y: 1990, w: 260, h: 140`)에 현재 선택된 운동 모드(아이콘 + 한글 모드명)를 표출하는 전용 메뉴 버튼을 신설한다.
  - 메뉴 화면에서 마우스/터치 클릭 및 4색 신체 커서 호버(0.8초 체류)를 통해 `LocomotionModal`을 즉각 호출할 수 있도록 조작 체계를 일원화한다.
- **수정 대상**:
  - `dream_guardian/src/ui/BottomBar.ts`
  - `dream_guardian/src/ui/MenuRenderer.ts`
  - `dream_guardian/src/main.ts`
  - `dream_guardian/tests/unit/bottom-bar.test.ts`
- **유지 사항**:
  - 기존 `BottomBar` 설정 버튼(`x: 30, w: 140`), 우측 액션 버튼(`x: 780/810`), 인게임 마나바 레이아웃
  - `LocomotionModal` 4종 모드, 0.8초 체류, `localStorage` 영속 로직 완전 유지
- **변경 금지**:
  - `RunDetector`, `HipBounceDetector`, `HipSwayDetector`, `ArmCrossDetector` 등 모션 엔진 로직
  - 전투, 문제 평가 및 스켈레톤 파이프라인
- **완료 조건**:
  - [ ] 하단 고정바 내 운동 모드 버튼(`x: 190, y: 1990, w: 260, h: 140`) 정상 렌더링
  - [ ] 메인 메뉴 타이틀 하단 임시 버튼 및 관련 메서드 정리
  - [ ] 마우스 클릭 및 신체 커서 0.8초 체류 시 운동 모드 모달 정상 호출
  - [ ] 단위 테스트 100% Pass 및 빌드 에러 0건
- **관련 파일**:
  - `dream_guardian/src/ui/BottomBar.ts`
  - `dream_guardian/src/ui/MenuRenderer.ts`
  - `dream_guardian/src/main.ts`
  - `dream_guardian/tests/unit/bottom-bar.test.ts`
  - `dream_guardian/HANDOVER.md`

---

### Issue #162 (Card #93): [UI-BAR-003] 설정 및 정지 버튼 문자 제거 및 아이콘화
- **GitHub URL**: https://github.com/Choyounhwa/-dream-guardian/issues/162
- **Labels**: `phase-6`, `feature`, `P2-medium`
- **Milestone**: `v0.5-input-ui`
- **작업 ID**: `[UI-BAR-003]`
- **상태**: ⚪ **등록 완료 (승인 대기)**
- **목적**:
  - 하단 고정 바의 '⚙ 설정', '정지' 텍스트를 제거하고 심플한 고대비 그래픽 아이콘으로 대체하여 시인성을 높이고 군더더기를 없앤다.
- **수정 대상**:
  - `dream_guardian/src/ui/BottomBar.ts`
  - `dream_guardian/src/main.ts`
  - `dream_guardian/tests/unit/bottom-bar.test.ts`
- **상세 요구사항 및 신규 구현 내용**:
  1. 좌측 설정 버튼: '⚙ 설정' 한글 텍스트를 제거하고 단독 대형 톱니바퀴 심볼('⚙') 또는 Canvas 2D 벡터 아이콘 중앙 렌더링.
  2. 우측 액션 버튼: 인게임 진행 중 '정지' 한글 텍스트를 제거하고 일시정지 아이콘('⏸' 또는 Canvas 2D 트윈 버티컬 바) 중앙 렌더링.
  3. 터치 및 모션 호버 게이지 아크(0.8초) 인터랙션은 기존 위치 그대로 유지.
- **유지 사항**:
  - 버튼 좌표(settingsBtn: 30, 1990 / actionBtn: 810, 1990) 및 히트박스 판정
  - 호버 충전 게이지 및 모달 오픈/메뉴 복귀 트리거
- **변경 금지**:
  - 하단 바 중앙 마나 게이지 및 콤보 배지 구조
- **완료 조건**:
  - [ ] 좌측 버튼에 '설정' 한글 텍스트 없이 아이콘만 표시
  - [ ] 게임 중 우측 버튼에 '정지' 한글 텍스트 없이 일시정지 아이콘만 표시
  - [ ] 클릭 및 모션 호버 시 정상 작동
  - [ ] `npm test` 단위 테스트 100% Pass
- **관련 파일**:
  - `dream_guardian/src/ui/BottomBar.ts`
  - `dream_guardian/src/main.ts`
  - `dream_guardian/tests/unit/bottom-bar.test.ts`

---

### Issue #163 (Card #94): [UI-ANS-001] 답안 버튼 외곽선 두께 2배 증가
- **GitHub URL**: https://github.com/Choyounhwa/-dream-guardian/issues/163
- **Labels**: `phase-6`, `feature`, `P2-medium`
- **Milestone**: `v0.5-input-ui`
- **작업 ID**: `[UI-ANS-001]`
- **상태**: ⚪ **등록 완료 (승인 대기)**
- **목적**:
  - 카메라 배경 및 다채로운 인게임 이펙트 속에서도 2개 선택지 버튼의 경계선이 원거리(1~2m)에서 한눈에 들어오도록 시인성을 극대화한다.
- **수정 대상**:
  - `dream_guardian/src/render/PartIconRenderer.ts`
  - `dream_guardian/src/main.ts`
  - `dream_guardian/tests/unit/part-icon-renderer.test.ts`
- **상세 요구사항 및 신규 구현 내용**:
  1. `PartIconRenderer.drawRadialAnswerButton` 호출 시 전달하는 lineWidth 값을 기존 `4 * scaleX`에서 `8 * scaleX`(2배)로 상향.
  2. 메서드 기본 lineWidth 매개변수 역시 `3.5` -> `7.0`으로 상향 조정.
  3. 1개/2개/3개 분할 섹터의 외곽 스트로크 및 방사선 두께를 2배로 확장하여 시인성 보장.
- **유지 사항**:
  - 방사형 색상 분할(1개/2개/3개 커서 부위 색상) 로직
  - 라운드 코너(20px) 및 내부 수식 폰트 중앙 정렬
- **변경 금지**:
  - 답안 수식 텍스트 렌더링(`renderMath`) 좌표 계산
  - 하단 키보드 안내 텍스트 폰트
- **완료 조건**:
  - [ ] 답안 버튼 외곽선 테두리 선 두께가 8px(기존 4px 대비 2배)로 두껍고 선명하게 렌더링
  - [ ] 1개/2개 분할 방사형 섹터 테두리 모두 일관된 두께 적용
  - [ ] `npm test` 단위 테스트 100% Pass
- **관련 파일**:
  - `dream_guardian/src/render/PartIconRenderer.ts`
  - `dream_guardian/src/main.ts`
  - `dream_guardian/tests/unit/part-icon-renderer.test.ts`

---

### Issue #164 (Card #95): [UI-ANS-002] 답안 버튼 위치 4, 5번 피트니스 존 하단 X축 정렬 배치
- **GitHub URL**: https://github.com/Choyounhwa/-dream-guardian/issues/164
- **Labels**: `phase-6`, `feature`, `P1-high`
- **Milestone**: `v0.5-input-ui`
- **작업 ID**: `[UI-ANS-002]`
- **상태**: ⚪ **등록 완료 (승인 대기)**
- **목적**:
  - 플레이어가 4번 존(좌측 중단)과 5번 존(우측 중단)을 보면서 자연스럽게 직관적으로 답안을 인지할 수 있도록, 답안 버튼 0/1의 X 좌표와 너비를 4번/5번 피트니스 존 바로 아래에 수직 정렬한다.
- **수정 대상**:
  - `dream_guardian/src/main.ts`
  - `dream_guardian/config/zone.config.ts`
- **상세 요구사항 및 신규 구현 내용**:
  1. Zone 4(좌: x 0.04, w 0.26) 및 Zone 5(우: x 0.70, w 0.26)의 실제 좌표 기준 정렬:
     - 0번(좌측) 답안 버튼: X축을 Zone 4와 동일하게 맞추고, 너비 또한 Zone 4 너비(또는 중심)에 정렬.
     - 1번(우측) 답안 버튼: X축을 Zone 5와 동일하게 맞추고, 너비 또한 Zone 5 너비(또는 중심)에 정렬.
  2. Y 좌표를 Zone 4, 5의 하단 경계(`y = 0.40`, 가상 해상도 864px) 바로 아래(예: 880px ~ 920px)로 배치.
  3. 요구 부위 아이콘 및 키보드 안내 문구가 재배치된 버튼의 중심 X축에 맞춰 자동 정렬.
- **유지 사항**:
  - 답안 버튼 2개(좌/우) 매핑 구조 및 선택 결과 처리
  - 피트니스 존 자체의 독립 좌표계
- **변경 금지**:
  - 피트니스 존 1~11번의 좌표 정의 (`config/zone.config.ts` 내부 기본 좌표는 불변)
- **완료 조건**:
  - [ ] 0번 답안 버튼의 중심 X축이 4번 피트니스 존의 중심 X축과 일치
  - [ ] 1번 답안 버튼의 중심 X축이 5번 피트니스 존의 중심 X축과 일치
  - [ ] Y축 위치가 4, 5번 존의 바로 아래쪽에 위치
  - [ ] `npm test` 회귀 결함 0건
- **관련 파일**:
  - `dream_guardian/src/main.ts`
  - `dream_guardian/config/zone.config.ts`

---

### Issue #165 (Card #96): [RENDER-MATH-001] 문제 영역 마젠타 사각 박스 가상 영역화 (화면 표시 제거)
- **GitHub URL**: https://github.com/Choyounhwa/-dream-guardian/issues/165
- **Labels**: `phase-6`, `feature`, `P2-medium`
- **Milestone**: `v0.5-input-ui`
- **작업 ID**: `[RENDER-MATH-001]`
- **상태**: ⚪ **등록 완료 (승인 대기)**
- **목적**:
  - 현재 화면 중앙에 렌더링되는 마젠타(#FF28D8) 테두리 및 반투명 배경 박스는 레이아웃 배치를 위한 가상 영역이므로, 실제 화면 드로잉을 제거하여 3D 배경 그리드 및 보스가 가려지지 않고 깔끔하게 보이도록 한다.
- **수정 대상**:
  - `dream_guardian/src/main.ts`
- **상세 요구사항 및 신규 구현 내용**:
  1. `renderQuestion` 함수 내 마젠타 사각 박스를 그리는 `ctx.stroke()`, `ctx.fill()`, `ctx.shadowColor = '#FF28D8'` 코드 블록 비활성화/제거.
  2. `boxX, boxY, boxW, boxH` 좌표 변수는 문제 텍스트 및 답안 버튼의 상대 기준 좌표로만 내부 유지(가상 영역화).
- **유지 사항**:
  - 문제 텍스트 및 자식 요소들의 배치 기준 좌표계
  - 문제 표시 플래그(`questionVisible`) 로직
- **변경 금지**:
  - 문제 수식 렌더링 및 답안 버튼 렌더링 호출
- **완료 조건**:
  - [ ] 인게임 문제 화면에서 마젠타색 테두리와 어두운 사각형 배경이 화면에 나타나지 않음
  - [ ] 문제 텍스트와 답안 버튼은 정상 위치에 선명하게 표시
  - [ ] `npm test` 회귀 결함 0건
- **관련 파일**:
  - `dream_guardian/src/main.ts`

---

### Issue #167 (Card #97): [RENDER-MATH-002] 문제 폰트 1.5배 확대 및 영역 초과 시 자동 줄바꿈(Word Wrap)
- **GitHub URL**: https://github.com/Choyounhwa/-dream-guardian/issues/167
- **Labels**: `phase-6`, `feature`, `P1-high`
- **Milestone**: `v0.5-input-ui`
- **작업 ID**: `[RENDER-MATH-002]`
- **상태**: ⚪ **등록 완료 (승인 대기)**
- **목적**:
  - 1~2m 떨어진 상태에서 문제 수식의 가독성을 대폭 끌어올리기 위해 기본 폰트 크기를 1.5배 확대하고, 긴 문장이나 분수식이 가상 문제 폭을 초과할 경우 안전하게 여러 줄로 줄바꿈한다.
- **수정 대상**:
  - `dream_guardian/src/render/MathRenderer.ts`
  - `dream_guardian/src/main.ts`
  - `dream_guardian/tests/unit/math-renderer.test.ts`
- **상세 요구사항 및 신규 구현 내용**:
  1. 기본 폰트 크기를 기존 `88 * scaleX`에서 `132 * scaleX`(1.5배)로 기본값 상향.
  2. MathRenderer multiline / wrap 지원: 가상 문제 영역 폭(`maxWidth = 880 * scaleX` 또는 지정 폭)을 초과하는 토큰 스트림을 연산자나 공백 단위로 분할하여 다음 줄로 줄바꿈.
  3. 각 줄의 수직 간격(`lineHeight = fontSize * 1.35`)을 계산하여 전체 텍스트 블록을 수직/수평 중앙 정렬.
  4. 분수 토큰(whole, num, den) 및 거듭제곱, 루트 토큰이 중간에 비정상적으로 분리되지 않고 단일 단위로 줄바꿈되도록 보장.
- **유지 사항**:
  - 교과서 표준 분수선, 루트, 지수 거듭제곱 파싱 규칙
  - [ ? ] 빈칸 하이라이트 박스 색상
- **변경 금지**:
  - `QuestionBank` 및 CSV 문제 텍스트 원본 데이터
- **완료 조건**:
  - [ ] 짧은 문제는 1.5배(132px급) 대형 폰트로 선명하게 표시
  - [ ] 폭을 초과하는 긴 문제는 글자가 화면 밖으로 짤리지 않고 자연스럽게 2~3줄로 줄바꿈
  - [ ] 분수 토큰 도중에 비정상적으로 분리되지 않음
  - [ ] `npm test` 단위 테스트 100% Pass
- **관련 파일**:
  - `dream_guardian/src/render/MathRenderer.ts`
  - `dream_guardian/src/main.ts`
  - `dream_guardian/tests/unit/math-renderer.test.ts`

---

### Issue #168 (Card #98): [UI-MENU-003] 홈 메뉴 메인 타이틀 및 서브 문구 변경
- **GitHub URL**: https://github.com/Choyounhwa/-dream-guardian/issues/168
- **Labels**: `phase-6`, `feature`, `P2-medium`
- **Milestone**: `v0.5-input-ui`
- **작업 ID**: `[UI-MENU-003]`
- **상태**: ⚪ **등록 완료 (승인 대기)**
- **목적**:
  - 홈 화면 최상단 타이틀과 서브 슬로건 문구를 최신 기획 및 사용자 지정 명칭으로 갱신한다.
- **수정 대상**:
  - `dream_guardian/src/ui/MenuRenderer.ts`
- **상세 요구사항 및 신규 구현 내용**:
  1. 상단 메인 타이틀: 기존 '꿈속 세계 탐험'에서 지정된 새 명칭으로 교체.
  2. 하단 슬로건 문구: 기존 '알레와 함께 신비로운 꿈의 성역으로 다이빙!'에서 새 슬로건으로 교체.
  3. 네온 섀도우 및 폰트 크기(76px) 시각 효과 정합성 유지.
- **유지 사항**:
  - 챕터 카드 레이아웃 및 상단 텍스트 중앙 정렬 위치
- **변경 금지**:
  - 챕터별 이름(에메랄드 심해 등) 및 카드 선택 히트테스트
- **완료 조건**:
  - [ ] 홈 메뉴 상단에 변경된 메인 타이틀과 슬로건이 정상 표시
  - [ ] 글자 수 변경에 따른 중앙 정렬 및 여백 이상 없음
  - [ ] `npm test` 단위 테스트 100% Pass
- **관련 파일**:
  - `dream_guardian/src/ui/MenuRenderer.ts`

---

### Issue #169 (Card #99): [INPUT-MOTION-001] 인게임 문제 스테이지 양손 합장 제스처 메뉴 연동
- **GitHub URL**: https://github.com/Choyounhwa/-dream-guardian/issues/169
- **Labels**: `phase-3`, `feature`, `P1-high`
- **Milestone**: `v0.5-input-ui`
- **작업 ID**: `[INPUT-MOTION-001]`
- **상태**: ⚪ **등록 완료 (승인 대기)**
- **목적**:
  - 메인 메뉴 및 결과 화면뿐만 아니라 인게임 문제 풀이 스테이지에서도 두 손을 모으면 양손 합장 커서가 나타나고, 하단 고정 바의 일시정지/설정 버튼을 호버(0.8초)하여 조작할 수 있도록 개선한다.
- **수정 대상**:
  - `dream_guardian/src/main.ts`
  - `dream_guardian/src/input/MenuInput.ts`
  - `dream_guardian/tests/unit/input-system.test.ts`
- **상세 요구사항 및 신규 구현 내용**:
  1. `screenMode === 'game'` (문제 풀이 및 달리기 페이즈 포함) 상태에서도 매 프레임 `menuInput.update(leftHand.x, leftHand.y, rightHand.x, rightHand.y)` 실행.
  2. 합장 감지(`menuInput.isActive`) 시 화면에 금빛 네온 합장 링 커서 및 호버 링 렌더링.
  3. 합장 커서 위치로 하단 바 설정 버튼(좌) 및 일시정지 버튼(우) 호버 타이머 누적 (0.8초 체류 시 기능 동작).
  4. 합장 중(`menuInput.isActive === true`)일 때는 답안 피트니스 존 판정을 일시 정지(Pause)하여 오작동 방지.
- **유지 사항**:
  - 메뉴/결과 화면의 합장 제스처 인터랙션 및 키보드 조작 호환
- **변경 금지**:
  - AnswerSelector의 기존 제스처 판정 로직 원본 구조
- **완료 조건**:
  - [ ] 인게임 문제 풀이 중 양손을 모으면 중앙에 금빛 합장 커서가 등장
  - [ ] 합장 커서를 하단 정지/설정 버튼에 0.8초 유지하면 해당 기능 정상 동작
  - [ ] 합장 해제 시 즉시 통상 4색 신체 커서로 복귀
  - [ ] `npm test` 단위 테스트 100% Pass
- **관련 파일**:
  - `dream_guardian/src/main.ts`
  - `dream_guardian/src/input/MenuInput.ts`
  - `dream_guardian/tests/unit/input-system.test.ts`

---

### Issue #170 (Card #100): [INPUT-ZONE-001] Head(머리) 및 Hip(골반) 커서 피트니스 존 진입 감도 최적화
- **GitHub URL**: https://github.com/Choyounhwa/-dream-guardian/issues/170
- **Labels**: `phase-3`, `feature`, `P1-high`
- **Milestone**: `v0.5-input-ui`
- **작업 ID**: `[INPUT-ZONE-001]`
- **상태**: 🟢 **완료 (100% Pass)**
- **목적**:
  - 현재 Head(타원)와 Hip(마름모) 커서는 모두 단일 중심점(코 좌표, 양 골반 중점) 1점만으로 판정하여, 시각적으로 커서 면적의 50% 이상이 존 경계선을 완전히 넘어가야만 게이지가 차오르기 시작한다.
  - 플레이어의 신체 피로도를 개선하고, Head와 Hip 커서가 존 영역에 자연스럽게 진입했을 때(외곽 접촉 또는 25% 진입) 즉시 부드럽게 충전이 개시되도록 감도를 최적화한다.
- **수정 대상**:
  - `dream_guardian/src/input/PostureMatcher.ts`
  - `dream_guardian/config/posture.config.ts`
  - `dream_guardian/tests/unit/posture-matcher.test.ts`
- **상세 요구사항 및 신규 구현 내용**:
  1. 커서 부위별(head, hip) 시각적 크기(반경 및 halfWidth/halfHeight)를 고려한 진입 여유 마진(margin) 적용 (Head 타원 25% 진입, Hip 마름모 25% 진입 시 즉각 충전 시작).
  2. 외곽/마진 영역 진입 시 `edgeWeight`(0.75)로 부드럽게 감속 충전 개시, 중심점 완전 진입 시 `centerWeight`(1.5)로 정상 속도 충전.
  3. 설정값 분리 (`config/posture.config.ts`: `cursorEntryMargin: { head: 0.03, hip: 0.04, hand: 0.0 }`).
- **유지 사항**:
  - Hand(손) 커서의 기존 정밀 판정 로직 유지
  - 11개 피트니스 존 상호 간 겹침 0% 레이아웃 규격 유지
  - 기존 Deadlock Guard 및 PartGate 캘리브레이션 안정성 유지
- **변경 금지**:
  - `config/zone.config.ts`의 피트니스 존 기본 좌표(1~11번)
  - Head와 Hip의 상호 배타적 존 규칙 (`HEAD_ZONES ∩ HIP_ZONES = ∅`)
- **완료 조건**:
  - [x] Head 커서가 피트니스 존 경계에 살짝 닿거나 25% 진입했을 때 체류 게이지 즉시 충전 개시
  - [x] Hip 커서(스쿼트/골반 이동) 역시 중심점이 완전히 닿기 전 외곽 진입 시 즉시 체류 게이지 충전 개시
  - [x] 인접한 다른 존으로 오인식(False Positive)되는 현상 0건
  - [x] `npm test -- posture-matcher.test.ts` 100% Pass
- **관련 파일**:
  - `dream_guardian/src/input/PostureMatcher.ts`
  - `dream_guardian/config/posture.config.ts`
  - `dream_guardian/tests/unit/posture-matcher.test.ts`

---

### Issue #171 (Card #101): [FEAT-MOTION-002] 양손 대각 어깨 교차 X자 제스처 감지기(XGestureDetector) 구현
- **GitHub URL**: https://github.com/Choyounhwa/-dream-guardian/issues/171
- **Labels**: `phase-3`, `feature`, `P1-high`
- **Milestone**: `v0.5-input-ui`
- **작업 ID**: `[FEAT-MOTION-002]`
- **상태**: 🟢 **완료 (100% Pass)**
- **목적**:
  - MediaPipe Pose의 손목 및 어깨 랜드마크를 기반으로 '왼손이 오른쪽 어깨에, 오른손이 왼쪽 어깨에 동시에 일정 거리 이내로 접근'하는 X자 교차 제스처를 감지하는 독립 감지기 `XGestureDetector`를 구현한다.
- **수정 및 생성 대상**:
  - `dream_guardian/src/motion/XGestureDetector.ts` (신규 생성)
  - `dream_guardian/src/motion/index.ts` (Re-export 등록)
  - `dream_guardian/config/motion.config.ts` (X자 제스처 관련 임계값 설정 추가)
  - `dream_guardian/tests/unit/x-gesture-detector.test.ts` (신규 단위 테스트)
- **상세 요구사항 및 신규 구현 내용**:
  1. **어깨 너비 기준 정규화 척도**:
     - `shoulderWidth = hypot(rightShoulder - leftShoulder)`
     - 사용자 체형 및 카메라 거리에 영향을 받지 않도록 고정 픽셀 대신 어깨 너비를 척도(1.0)로 활용.
  2. **대각 교차 판정 조건**:
     - 왼손목 ↔ 오른쪽 어깨 거리 < `shoulderWidth * crossThreshold` (기본 0.55)
     - 오른손목 ↔ 왼쪽 어깨 거리 < `shoulderWidth * crossThreshold` (기본 0.55)
     - 양쪽 조건 동시 충족 시 `isCrossing = true`
  3. **체류 유지(Dwell Time) & 오발동 방지**:
     - 스쳐 지나가는 동작 배제를 위해 0.4초간 자세 유지 시 최종 트리거(`triggered = true`).
     - 현재 유지 시간 비례 진행도 `progress` (0~1) 반환.
  4. **트리거 쿨다운(Cooldown)**:
     - 트리거 직후 1.0초 쿨다운 적용하여 중복 연속 트리거 방지.
  5. **양손 합장(`MenuInput`)과의 완벽한 분리 검증**:
     - 두 손을 모으는 합장 자세는 반대 어깨와의 거리가 멀어 X자로 오인식되지 않음을 단위 테스트로 보장.
- **유지 사항**:
  - 기존 `MenuInput`(양손 합장 거리 감지) 및 `ArmCrossDetector`(상하 교차 달리기 감지) 독립성 유지
  - 기존 피트니스 10개 존 판정 로직 불변
- **변경 금지**:
  - `src/input/AnswerSelector.ts` 내부의 피트니스 자세 판정식
  - 기존 `PoseManager` 수신 데이터 규격
- **완료 조건**:
  - [x] 왼손-오른어깨, 오른손-왼어깨 동시 접근 시 X자 교차 감지
  - [x] 0.4초 체류 유지 시 정상 트리거 반환
  - [x] 트리거 후 1.0초 쿨다운 동안 추가 트리거 억제
  - [x] 양손 합장 자세를 X자로 오인식하지 않음 검증
  - [x] `npm test -- x-gesture-detector.test.ts` 100% Pass
- **관련 파일**:
  - `dream_guardian/src/motion/XGestureDetector.ts`
  - `dream_guardian/src/motion/index.ts`
  - `dream_guardian/config/motion.config.ts`
  - `dream_guardian/tests/unit/x-gesture-detector.test.ts`

---

### Issue #172 (Card #102): [UI-PAUSE-001] 인게임 일시정지(Pause) 팝업 모달 구현 및 X자/합장 제스처 제어 연동
- **GitHub URL**: https://github.com/Choyounhwa/-dream-guardian/issues/172
- **Labels**: `phase-6`, `feature`, `P1-high`
- **Milestone**: `v0.5-input-ui`
- **작업 ID**: `[UI-PAUSE-001]`
- **상태**: 🟢 **완료 (100% Pass)**
- **목적**:
  - 서브메뉴에서 X자 제스처 감지 시 홈(메인) 메뉴로 이전 화면 복귀를 수행한다.
  - 인게임(달리기 및 문제 풀이) 화면에서 X자 제스처 감지 시 게임을 일시정지하고, 일시정지 팝업 모달(`PauseModal`)을 띄워 게임 재개 및 홈 메뉴 복귀를 양손 합장 제스처로 선택할 수 있도록 구현한다.
- **수정 및 생성 대상**:
  - `dream_guardian/src/ui/PauseModal.ts` (신규 생성)
  - `dream_guardian/src/ui/index.ts` (Re-export 등록)
  - `dream_guardian/src/main.ts` (`XGestureDetector` 및 `PauseModal` 연동)
  - `dream_guardian/tests/unit/pause-modal.test.ts` (신규 단위 테스트)
- **상세 요구사항 및 신규 구현 내용**:
  1. **서브메뉴(Sub Menu) X자 제스처 뒤로가기**:
     - `screenMode === 'menu' && menuMode === 'sub'` 상태에서 X자 제스처 트리거 시 `selectSubLevel(-1)` 실행 (메인 메뉴로 복귀).
  2. **인게임(Game) X자 제스처 일시정지 트리거**:
     - `screenMode === 'game'` 상태(달리기 페이즈 및 문제 풀이 페이즈)에서 X자 제스처 트리거 시 일시정지 모달 오픈(`pauseModal.open()`).
     - 모달 오픈 시 `answerSelector.paused = true`, 문제 풀이/달리기 타이머 및 보스 패턴 정지.
  3. **일시정지 팝업 모달(`PauseModal`) UI 구성**:
     - 모달 중앙 카드: 반투명 다크 배경 + 네온 테두리.
     - [계속하기 (Resume)] 버튼 & [홈으로 나가기 (Quit)] 버튼 2개 제공.
     - 양손 합장 커서(`MenuInput`) 호버(0.8초 체류) 시 프로그레스 링 차오름 및 기능 확정 실행:
       - 계속하기: 모달 닫기 및 게임 재개 (`pauseModal.close()`).
       - 홈으로 나가기: 게임 종료 및 메인 메뉴 이동 (`goToMenu()`).
  4. **키보드 조작 Fallback 호환**:
     - 키보드 `Esc` 또는 `P` 키로도 일시정지 열기/닫기 지원.
- **유지 사항**:
  - 기존 `SettingsModal`, `TutorialOverlay`, `LocomotionModal` 등의 모달 시스템과 충돌 없이 독립 동작
  - 하단 고정바(`BottomBar`)의 기존 정지/설정 버튼 기능 유지
- **변경 금지**:
  - `BattleState` 및 `BossController` 내부 계산식
  - `QuestionBank` 문제 출제 상태 머신
- **완료 조건**:
  - [x] 서브메뉴에서 X자 제스처 시 홈(메인) 메뉴로 복귀
  - [x] 인게임 화면에서 X자 제스처 시 일시정지 모달 오픈 및 게임 정지
  - [x] 일시정지 모달에서 양손 합장 호버(0.8초)로 '계속하기' 선택 시 정상 재개
  - [x] 일시정지 모달에서 양손 합장 호버(0.8초)로 '홈으로 나가기' 선택 시 메인 메뉴 이동
  - [x] `npm test -- pause-modal.test.ts` 100% Pass
- **관련 파일**:
  - `dream_guardian/src/ui/PauseModal.ts`
  - `dream_guardian/src/ui/index.ts`
  - `dream_guardian/src/main.ts`
  - `dream_guardian/tests/unit/pause-modal.test.ts`

---

### Issue #173 (Card #103): [RENDER-ZONE-001] 피트니스 존 활성화 시 네모 영역 표시 제거 (가상 영역화)
- **GitHub URL**: https://github.com/Choyounhwa/-dream-guardian/issues/173
- **Labels**: `phase-6`, `feature`, `P1-high`
- **Milestone**: `v0.5-input-ui`
- **작업 ID**: `[RENDER-ZONE-001]`
- **상태**: 🟢 **완료 (Pass)**
- **목적**:
  - 인게임 문제 풀이 페이즈에서 피트니스 존이 활성화될 때 화면에 렌더링되던 네온 사각 박스 테두리(stroke) 및 반투명 배경 채움(fill) 드로잉을 제거한다.
  - 피트니스 존의 사각 좌표계(`x, y, width, height`)는 커서 체류 판정 및 부위 아이콘 중심 좌표(`cx, cy`) 배치를 위한 내부 가상 영역(Virtual Boundary)으로만 유지하여, 3D 배경 그리드, 보스, 그리고 회전 마법진/부위 아이콘이 깔끔하게 보이도록 한다.
- **수정 대상**:
  - `dream_guardian/src/render/PostureGuideRenderer.ts`
  - `dream_guardian/src/render/AnswerSelectionRenderer.ts`
  - `dream_guardian/src/main.ts`
  - `dream_guardian/tests/unit/posture-guide-renderer.test.ts`
- **상세 요구사항 및 신규 구현 내용**:
  1. `PostureGuideRenderer.ts` 내 `_renderZoneHighlights`에서 네온 사각 박스를 그리는 `roundRect`/`rect`, `stroke()`, `fill()` 코드 블록 비활성화/제거 (`renderZoneBoxes = false` 기본값 적용).
  2. 존 사각 좌표계(`zx, zy, zw, zh`)는 부위 아이콘 중심 좌표(`cx, cy`) 및 크기(`iconSize`) 계산을 위한 기준 좌표로만 내부 유지(가상 영역화).
  3. 중앙 부위 벡터 아이콘(`PartIconRenderer.drawIcon`), 답안별 스틱맨 실루엣(`_renderPostures`), 첫 문제 유도 화살표(`_renderArrowHints`)는 기존대로 정상 유지.
  4. `AnswerSelectionRenderer.ts`에 `renderZoneBoxes` 속성 추가 및 `main.ts`에서 비활성화하여 예외 상황에서도 사각 박스가 노출되지 않도록 가상화 완료.
- **유지 사항**:
  - 피트니스 존 판정 및 커서 체류 판정 가상 영역 로직
  - 목표 자세 스틱맨 실루엣 및 중앙 부위 아이콘 렌더링
- **변경 금지**:
  - `zone.config.ts`의 피트니스 존 좌표 규격
  - `AnswerSelector` 내부 자세 판정 및 체류 계산식
- **완료 조건**:
  - [x] 인게임 문제 풀이 시 활성 피트니스 존 위치에 사각 테두리나 반투명 사각 배경이 화면에 드로잉되지 않음
  - [x] 중앙 부위 아이콘(L/R/HEAD/HIP)과 하단 목표 자세 스틱맨 실루엣은 정상 위치에 선명하게 표시
  - [x] 단위 테스트에서 `roundRect`/`strokeRect` 등 사각 박스 드로잉 미호출 검증 통과
  - [x] `npm test` 전체 480개 테스트 100% Pass
- **관련 파일**:
  - `dream_guardian/src/render/PostureGuideRenderer.ts`
  - `dream_guardian/src/render/AnswerSelectionRenderer.ts`
  - `dream_guardian/src/main.ts`
  - `dream_guardian/tests/unit/posture-guide-renderer.test.ts`

---

### Issue #174 (Card #104): [BUG-ZONE-002] Head 존 2 및 Hip 존 7 출제 배제 및 직립 자동 선택 방지
- **GitHub URL**: https://github.com/Choyounhwa/-dream-guardian/issues/174
- **Labels**: `phase-3`, `bug`, `P1-high`
- **Milestone**: `v0.5-input-ui`
- **작업 ID**: `[BUG-ZONE-002]`
- **상태**: 🟢 **완료 (Closed, 100% Pass)**
- **목적**:
  - 머리 커서가 선택지일 때 상단 2번 존에 출제되거나, 골반 커서가 중하단 7번 존에 출제되는 현상을 원천 차단한다.
  - 플레이어가 카메라 앞에서 직립 대기 상태일 때 머리와 골반이 각각 2번, 7번 존에 위치하여, 문제 출제 즉시 움직임 없이도 정답이 자동 선택되던 결함을 근본 해결한다.
- **수정 대상**:
  - `dream_guardian/config/zone.config.ts`
  - `dream_guardian/src/input/RecipeGenerator.ts`
  - `dream_guardian/src/input/PostureGenerator.ts`
  - `dream_guardian/src/data/FitnessPatternLoader.ts`
  - `fitness pattern.csv` (root, `public/`, `src/data/` 3개 위치)
  - `dream_guardian/tests/unit/zone-config.test.ts`
  - `dream_guardian/tests/unit/cursor-tracker-recipe.test.ts`
  - `dream_guardian/tests/unit/input-system.test.ts`
  - `dream_guardian/tests/unit/fitness-pattern-loader.test.ts`
  - `dream_guardian/tests/unit/posture-generator.test.ts`
- **상세 요구사항 및 신규 구현 내용**:
  1. **원인 분석**:
     - `HEAD_ZONES`에 상단 1~3번 제외 규칙이 있었으나, 실제 런타임 문제 출제를 담당하는 `RecipeGenerator.ts`에서 Tier 2 (`commonZoneId = pickHeadLeft ? 2 : 1`), Tier 3 (`topZone = 2`) 존 번호가 하드코딩되어 `HEAD_ZONES`를 우회하고 2번에 출제됨.
     - 카메라 앞 기본 직립 상태의 자연 좌표(머리 ~0.18, 골반 ~0.60)가 2번/7번 존 영역과 일치하여, 문제 출제 즉시 0초부터 체류 시간이 차올라 자동 선택됨.
  2. **`config/zone.config.ts`**:
     - `HIP_ZONES`에서 직립 기본 위치인 7번을 완전 배제하여 `new Set([6, 8, 9, 10, 11])`로 개편 (`isValidZoneForCursor('hip', 7)` -> `false`).
  3. **`src/input/RecipeGenerator.ts`**:
     - Tier 2 공용 존을 2/1번 대신 중단 좌/우인 4번 또는 5번 존으로 전면 교체하여 머리가 2번에 출제되지 않도록 수정.
     - Tier 3을 상단 2번/중하 7번 대신 중단 4번(머리/손) + 하단 스쿼트 10번(골반/손)으로 교체하여 깊은 스쿼트나 명확한 틸트를 수행해야만 답안이 선택되도록 개편.
  4. **`src/input/PostureGenerator.ts`**:
     - 내장 큐레이션 패턴(`DEFAULT_CURATED_PATTERNS`) 내 7번 존이 포함된 P09~P16을 10번(하단 스쿼트), 6번(좌하), 8번(우하)으로 전수 교체.
     - Tier 2 단일 부위 후보 필터링 보강으로 머리와 손이 상호 배타적으로 정상 매칭되도록 개선.
  5. **`fitness pattern.csv` 전수 보정**:
     - 원본 360건 패턴 중 골반이 7번으로 되어 있던 48건의 데이터를 상단 손과의 Cross-Body 물리 제약을 준수하는 유효 존(6번 좌하 스쿼트, 8번 우하 스쿼트, 10번 하단 스쿼트)으로 전수 보정하여 360건 무오류 파싱 및 로드 보장.
- **유지 사항**:
  - 양손 전 존 1~11 허용 및 머리 중단 4~5번 한정 규격 유지
  - Cross-Body 물리 연동 제약 (골반 9~11 시 손 1~3 금지) 유지
  - 좌/우 답안 동일 공용 활성 존(Shared Active Zone) 및 색상 비공유 원칙 유지
- **완료 조건**:
  - [x] Tier 2 및 Tier 3 출제 시 머리가 2번(및 1, 3번)에 할당되지 않음
  - [x] 골반이 7번에 할당되지 않음
  - [x] `fitness pattern.csv` 360건 전체에서 골반 7번 패턴 0건 및 100% 무오류 파싱
  - [x] `npm test` 전체 477개 테스트 100% Pass
- **관련 파일**:
  - `dream_guardian/config/zone.config.ts`
  - `dream_guardian/src/input/RecipeGenerator.ts`
  - `dream_guardian/src/input/PostureGenerator.ts`
  - `dream_guardian/src/data/FitnessPatternLoader.ts`
  - `fitness pattern.csv`
  - `dream_guardian/public/fitness pattern.csv`
  - `dream_guardian/src/data/fitness pattern.csv`

---

### Issue #175 (Card #105): [BUG-ZONE-003] 문제풀이 피트니스 존 하드코딩 고정 배치 해소 및 전 구역(1~11번) 순환/랜덤 다양화
- **GitHub URL**: https://github.com/Choyounhwa/-dream-guardian/issues/175
- **Labels**: `phase-3`, `bug`, `P1-high`
- **Milestone**: `v0.3-vision-motion`
- **작업 ID**: `[BUG-ZONE-003]`
- **상태**: 🟢 **완료 (Pass)**
- **목적**:
  - 인게임 문제 풀이 시 출제되는 피트니스 존이 Tier 1은 항상 4번, Tier 3은 항상 4+10번, Tier 4는 항상 2번으로 고정되어 있던 하드코딩 배치를 해소하고, 1~11번 전 구역을 고르게 활용하는 다채로운 존 풀과 직전 문제 중복 방지 쿨다운을 적용한다.
- **수정 및 생성 대상**:
  - `dream_guardian/src/input/RecipeGenerator.ts` (티어별 다채로운 공용 존 풀 구축 및 Cooldown 큐)
  - `dream_guardian/src/input/AnswerSelector.ts` (startQuestion 문제 번호 기반 연동 및 getter)
  - `dream_guardian/src/main.ts` (게임 시작 시 `/fitness pattern.csv` 360건 로더 파이프라인 연동)
  - `dream_guardian/tests/unit/cursor-tracker-recipe.test.ts` (존 다양성, 쿨다운, 연속 생성 검증)
- **완료 조건**:
  - [x] Tier 1~4에서 고정 존 배치가 제거되고 전 구역(1~11번)이 고르게 랜덤/순환 출제됨
  - [x] 직전 문제와 동일한 존 배치 연속 출제 방지 쿨다운 적용
  - [x] `main.ts` 내 `fitness pattern.csv` 360건 로드 파이프라인 연동
  - [x] 기존 공용 활성 존 및 C1~C8 안전 제약 100% 준수
  - [x] 단위 테스트 100% Pass (502/502) 및 전체 테스트 회귀 결함 0건

---

## BEAT MOTION 전환 계획 (2026-09-27)

### 폐기 기록: 이전 4박자 문서안 [FEAT-RHYTHM-001]
- **상태**: ⚪ **폐기 (새 8박 카드 체계로 대체)**
- 이전 문서에만 있던 4박자·4스텝·게이지 완충 계획은 새 GitHub Issue #176 `[BEAT-SPEC-001]`과 무관한 폐기 사양이다.
- 확정된 사양은 `8박 달리기+문제 → 중앙 복귀 기준점 잠금 → 8박 좌/우 정답존 → 정답 별 수집 또는 오답 스웨이`다.
- 기존 `AnswerSelector`의 11존 답안 확정 경로는 제거하고, 11존/CSV/커서/안전 제약은 별 수집 시스템에 재사용한다.

### 미처리 기존 카드 영향

| GitHub Issue | 처리 | BEAT MOTION 반영 |
|---|---|---|
| #91, #93, #94, #100, #161, #162, #166 | 유지 | 신규 루프와 독립적으로 진행 가능 |
| #92 | 분리/수정 | 드림 그리드는 유지하고, 리듬 오디오는 BEAT 카드로 분리 |
| #95 | 보류/재설계 | 별 수집/좌우 선택과 충돌하는 별도 회피 입력은 금지 |
| #96 | 범위 보강 | 리듬 판정/별 수집 통계를 저장하되 기준점은 저장하지 않음 |
| #97 | 완료 조건 교체 | 8박, 중앙 복귀, 좌우 정답존, 별, 스웨이 E2E를 검증 |
| #98, #99 | 후행 보강 | 별 파티클/오디오 누수, BPM 드리프트, 미러/모바일 기준점을 검증 |
| #152 | 명세 수정 후 진행 | "20% 투명도"와 "20% 불투명도" 중 alpha 기준을 먼저 확정 |
| #168 | 보류 | 새 메뉴 문구 원문 확정 전에는 완료 불가 |
| #147, #159, #160 | 2026-09-27 Close | 기존 범위 구현 완료; BEAT 대체 기능은 새 카드에서 구현 |

### 신규 카드 의존성

```text
BEAT-SPEC-001
  → BEAT-CORE-001 → CENTER-RETURN-001 → ANSWER-ZONE-001 → BEAT-RUN-001
  → CHOREO-STAR-001 → INPUT-STAR-001 → RENDER-BEAT-001 → GAME-ROUND-001
  → AUDIO-BEAT-001 → E2E-BEAT-001
```

각 카드는 단일 기능과 TDD Red → Green → Refactor를 준수한다. `E2E-BEAT-001` 완료 후 #97, #98, #99의 검증 범위를 갱신한다.

### 등록된 BEAT MOTION 카드

| 순서 | GitHub Issue | 작업 ID | 단일 책임 | 선행 카드 |
|---:|---:|---|---|---|
| 1 | [#176](https://github.com/Choyounhwa/-dream-guardian/issues/176) | `BEAT-SPEC-001` | 8박 규약과 기존 입력 전환 계약 문서화 | 없음 |
| 2 | [#177](https://github.com/Choyounhwa/-dream-guardian/issues/177) | `BEAT-CORE-001` | BPM 120 8박 `RhythmEngine` | #176 |
| 3 | [#178](https://github.com/Choyounhwa/-dream-guardian/issues/178) | `CENTER-RETURN-001` | 중앙 복귀 게이트와 개인 기준점 잠금 | #177 |
| 4 | [#179](https://github.com/Choyounhwa/-dream-guardian/issues/179) | `ANSWER-ZONE-001` | 골반/머리 상대 이동 좌/우 정답존 | #178 |
| 5 | [#180](https://github.com/Choyounhwa/-dream-guardian/issues/180) | `BEAT-RUN-001` | 자유 게이지를 8박 문제 준비로 전환 | #177, #178, #179 |
| 6 | [#181](https://github.com/Choyounhwa/-dream-guardian/issues/181) | `CHOREO-STAR-001` | CSV 기반 순차 별 안무 생성 | #176 |
| 7 | [#182](https://github.com/Choyounhwa/-dream-guardian/issues/182) | `INPUT-STAR-001` | 11존 별 타이밍 수집 판정 | #181 |
| 8 | [#183](https://github.com/Choyounhwa/-dream-guardian/issues/183) | `RENDER-BEAT-001` | 중앙/정답존/별/스웨이 렌더링 | #178, #179, #182 |
| 9 | [#184](https://github.com/Choyounhwa/-dream-guardian/issues/184) | `GAME-ROUND-001` | 8박 종료 전투 및 리듬 통계 정산 | #180, #182 |
| 10 | [#185](https://github.com/Choyounhwa/-dream-guardian/issues/185) | `AUDIO-BEAT-001` | 비트/기준점/별/스웨이 SFX | #177 |
| 11 | [#186](https://github.com/Choyounhwa/-dream-guardian/issues/186) | `E2E-BEAT-001` | 전체 8박 루프 통합/E2E | #180, #183, #184, #185 |

---

### Issue #176: [BEAT-SPEC-001] BEAT MOTION 8박 라운드 규약 및 기존 입력 전환 계약 확정
- **GitHub URL**: https://github.com/Choyounhwa/-dream-guardian/issues/176
- **Labels**: `documentation`, `P0-critical`, `phase-5`
- **Milestone**: `v0.5-beat-motion`
- **작업 ID**: `[BEAT-SPEC-001]`
- **상태**: 🟢 **완료 (Pass)**
- **제목**: BEAT MOTION 8박 라운드 규약 및 기존 입력 전환 계약 확정
- **목적**:
  - 구현 전에 8박 라운드, 중앙 복귀, 좌/우 정답존, 정답 별 수집, 오답 스웨이 및 전투 정산 시점을 단일 테스트 가능 계약으로 고정한다.
- **수정 대상**:
  - `docs/01_GAME_DESIGN_DOCUMENT.md`
  - `docs/02_WORK_BREAKDOWN_STRUCTURE.md`
  - `docs/03_GITHUB_ISSUES.md`
  - `dream_guardian/HANDOVER.md`
- **구현 내용**:
  1. **BPM 120 8박 라운드 규약 상태 전이표 확정**:
     - 1박 = 0.5초, 8박 달리기 + 8박 답안 = 총 16박(8.0초) 단일 라운드 루프 확립
     - `RUN_QUESTION` (달리기 1~5박): 달리기, 가로분수/수학 문제 출력, 비블로킹 한국어 TTS 낭독
     - `CENTER_RETURN` (달리기 6~7박): 중앙 복귀 네온 게이트 표시, 플레이어 중심 유도
     - `CENTER_LOCK` (달리기 8박): 골반/머리/어깨폭 안정 프레임 중앙값(median)으로 개인 기준점 잠금
     - `ANSWER_OPEN` (답안 1~k박): 좌/우 답안 카드(A/B), 골반 우선/머리 보조 상대 변위(`|dx| ≥ 0.42 × shoulderWidth`), **0.5초(1박)** 체류 확정, `0.30` 이내 복귀 시 체류 취소(히스테리시스)
     - `CORRECT_DANCE` (정답 확정 후 잔여 k+1~8박): 11개 피트니스 존 순차 단일 별 목표 출현, 비트 착지 판정(Perfect ±0.12s, Good ±0.25s, Late ±0.40s, Miss)
     - `WRONG_SWAY` (오답/미응답 잔여 k+1~8박): 별 비표시, 좌우 메트로놈 스웨이 가이드로 리듬 운동 지속
     - `ROUND_RESOLVE` (답안 8박 종료 시점): 단 1회 전투 자원 및 통계 정산
  2. **실패 및 예외 경로(Failure Paths) 명세**:
     - 중앙 복귀 실패/지연: 오답 처리 절대 금지, 최대 2박(1.0초) `CENTER_RETRY` 연장 대기, 이후에도 미인식 시 임시 기본 기준점 강제 잠금 및 Fallback 활성화 후 답안 단계 진입 (게임 루프 중단 방지)
     - 답안 미응답(타임아웃): 8박 만료 시 `WRONG_SWAY` 간주, 종료 정산 시 HP -25/콤보 리셋, 통계에는 오답(`wrongAnswerCount`)과 분리하여 `timeoutCount`로 독립 기록
     - 센서/카메라 손실: 화면 비상 Fallback 키(좌: `←`/`A`, 우: `→`/`D`, 확인: `Space`/`Enter`) 즉시 가이드
  3. **전투 보상 및 별 점수 완전 분리**:
     - 정답 확정 시 기본 마나 +25 및 콤보 +1을 100% 보장 (별 수집 결과와 무관)
     - 별 점수는 리듬 성취도 통계(`beatStarsCollected` 등)로만 누적되며 전투 마나/보스 데미지에 불간섭
     - 답안 8박 종료 시점에 단 1회 일괄 정산하여 프레임 동기화 무결성 확보
  4. **데이터 영속성 정책 확정**:
     - 라운드 기준점(`hipX`, `headX`, `shoulderWidth`): 단일 세션 인메모리 전용 (localStorage 영구 저장 금지)
     - 리듬 별 통계: 챕터 클리어 등급 별(`dream_guardian_stars`: 0~3개)과 완전히 분리하여 `dream_guardian_stats` 내 전용 필드로 영속화
  5. **구 4박자 가상 안 폐기 및 후속 카드 의존성 고정**:
     - 구 4박자/4스텝 문서안(`FEAT-RHYTHM-001`) 공식 폐기 기록
     - 신규 11단계 BEAT 카드 체계 의존성 확정: `#176 BEAT-SPEC-001` → `#177 BEAT-CORE-001` → `#178 CENTER-RETURN-001` → `#179 ANSWER-ZONE-001` → `#180 BEAT-RUN-001` → `#181 CHOREO-STAR-001` → `#182 INPUT-STAR-001` → `#183 RENDER-BEAT-001` → `#184 GAME-ROUND-001` → `#185 AUDIO-BEAT-001` → `#186 E2E-BEAT-001`
- **유지 사항**:
  - 11개 피트니스 존 좌표 레이아웃, 4색 신체 커서(손/머리/골반), Cover/미러 좌표계, CSV 360건 패턴, PartGate 및 C1~C8 안전 제약, 키보드/터치 fallback.
- **변경 금지**:
  - 프로덕션 코드(`src/`) 및 기존 전투 기본 수치(플레이어 HP 100, 오답 -25, 마나 100 스펠 -4).
- **완료 조건**:
  - [x] 8박 전이와 모든 실패 경로(중앙 복귀 지연, 답안 미응답, 센서 끊김)가 문서에서 모순 없이 정의됨
  - [x] 기준점(인메모리 전용) 및 별 통계(챕터 별과 분리) 영속성 정책이 정의됨
  - [x] 4박자 가상 Issue #176은 폐기 기록으로 남고 후속 카드 의존성이 명시됨
- **테스트**:
  - 문서 상호 검토 (GDD, WBS, GITHUB_ISSUES, HANDOVER 4개 문서 간 정합성 일치 확인) 및 기존 단위 테스트 509/509 100% Pass
- **관련 파일**:
  - `docs/01_GAME_DESIGN_DOCUMENT.md`
  - `docs/02_WORK_BREAKDOWN_STRUCTURE.md`
  - `docs/03_GITHUB_ISSUES.md`
  - `dream_guardian/HANDOVER.md`

---

### Issue #177: [BEAT-CORE-001] 8박자 단일 시간원 RhythmEngine 구현
- **GitHub URL**: https://github.com/Choyounhwa/-dream-guardian/issues/177
- **Labels**: `feature`, `P0-critical`, `phase-5`
- **Milestone**: `v0.5-beat-motion`
- **작업 ID**: `[BEAT-CORE-001]`
- **상태**: 🟢 **완료 (Pass)**
- **제목**: 8박자 단일 시간원 RhythmEngine 구현
- **목적**:
  - BPM 120의 단일 비트 시간원을 제공하여 달리기, 답안, 오디오, 렌더링이 동일한 8박 인덱스를 사용하게 한다.
- **수정 및 생성 대상**:
  - `dream_guardian/src/core/RhythmEngine.ts` (신규: BPM 120, 8박 인덱스 순환, Catch-up 비트 발행, pause/resume)
  - `dream_guardian/src/core/index.ts` (RhythmEngine 및 BeatEvent export 추가)
  - `dream_guardian/tests/unit/rhythm-engine.test.ts` (신규: 19개 단위 테스트)
- **구현 내용**:
  1. **BPM 기반 단일 비트 시간원**:
     - 기본 BPM 120 (1박 0.5초 = 500ms, 8박 1라운드 = 4.0초)
     - `beatIndex` (0~7 순환), `totalBeats` (단조 증가 누적), `roundIndex`, `beatProgress` (0.0~1.0), `roundProgress` (0.0~1.0)
  2. **프레임 지연(Lag Spike) 비트 누락/중복 방지 (Catch-up)**:
     - 대형 dt(e.g. 1.6s 등) 입력 시에도 경과된 비트를 누락 없이 순차 발행
     - 중복 발행 방지 및 0~7 순환 인덱스 무결성 유지
  3. **시간 제어 API**:
     - `start()`, `pause()`, `resume()`, `stop()`, `reset()`, `update(dt)`, `setBpm(newBpm)`
     - GameEngine의 dt(초 단위)만 입력으로 사용하며 브라우저 타이머(setInterval, setTimeout)를 일체 직접 생성하지 않음
  4. **이벤트 리스너 및 EventBus 연동**:
     - `onBeat(callback)` 구독 및 unsubscribe 함수 반환, `offBeat(callback)`
     - `onRound(callback)` 라운드 순환(1라운드 이상) 시 콜백 호출
     - 주입된 `EventBus`를 통해 `'rhythm:beat'` 및 `'rhythm:round'` 이벤트 연동 지원
- **유지 사항**:
  - 기존 GameEngine 시간 제어, pause 모달, 이동 감지기.
- **변경 금지**:
  - `main.ts` 게임 플로우, `AnswerSelector`, 전투 로직, 오디오 구현.
- **완료 조건**:
  - [x] BPM 120에서 0.5초마다 정확히 한 beat가 진행됨
  - [x] 8박 후 0으로 순환함
  - [x] pause/resume과 대형 dt에서 중복/누락 없는 이벤트가 보장됨
- **테스트**:
  - Vitest 19개 단위 테스트 전원 통과 (`tests/unit/rhythm-engine.test.ts`), 전체 테스트 528/528 100% Pass, `npm run build` 번들 검증 완료
- **관련 파일**:
  - `dream_guardian/src/core/RhythmEngine.ts`
  - `dream_guardian/src/core/index.ts`
  - `dream_guardian/tests/unit/rhythm-engine.test.ts`
  - `dream_guardian/HANDOVER.md`
  - `docs/03_GITHUB_ISSUES.md`

---

### Issue #178: [CENTER-RETURN-001] 비트 전환 중앙 복귀 게이트 및 개인 기준점 잠금
- **GitHub URL**: https://github.com/Choyounhwa/-dream-guardian/issues/178
- **Labels**: `feature`, `P1-high`, `phase-3`
- **Milestone**: `v0.5-beat-motion`
- **작업 ID**: `[CENTER-RETURN-001]`
- **상태**: 🟢 **완료 (Pass)**
- **제목**: 비트 전환 중앙 복귀 게이트 및 개인 기준점 잠금
- **목적**:
  - 매 라운드 답안 전 중앙 복귀를 검증하고, 절대 화면 좌표가 아닌 개인 신체 기준점으로 좌/우 선택을 준비한다.
- **수정 및 생성 대상**:
  - `dream_guardian/config/beat-motion.config.ts` (신규: targetX, toleranceX, stabilityDuration, maxExtension, fallbackReference 설정)
  - `dream_guardian/src/motion/CenterReturnGate.ts` (신규: 골반 우선/보조 앵커, 중앙 허용폭 검증, 안정 프레임 중앙값 산출, 단 1회 잠금, retry 및 fallback 잠금)
  - `dream_guardian/src/motion/index.ts` (CenterReturnGate 및 타입 export 추가)
  - `dream_guardian/tests/unit/center-return-gate.test.ts` (신규: 18개 단위 테스트)
- **구현 내용**:
  1. **골반 우선 및 머리+어깨 보조 앵커 평가**:
     - 골반(LEFT_HIP, RIGHT_HIP) 신뢰도(visibility >= 0.5) 시 `hipX` 중심 우선 평가
     - 골반 신뢰도 부족 시 머리(NOSE) + 어깨(LEFT_SHOULDER, RIGHT_SHOULDER) 중심 보조 앵커 자동 평가
     - 전신 신뢰도 부족 시 추적 유실(none) 처리 및 안정 누적 초기화
  2. **중앙 허용폭 및 흔들림(Jitter) 방지 제약**:
     - 기본 중앙폭 `targetX: 0.5`, `toleranceX: 0.08` (|x - 0.5| <= 0.08)
     - 중앙 게이트 외부 이탈 또는 흔들림 발생 시 안정 누적 시간(`stableTime`) 및 샘플 즉시 리셋
  3. **안정 프레임 중앙값(Median) 기반 개인 기준점(`RoundCenterReference`) 잠금**:
     - 연속 0.4초 이상 체류 및 5개 이상 안정 프레임 수집 시 중앙값으로 `hipX`, `headX`, `shoulderWidth` 산출 및 잠금
     - 단 1회 잠금 보장: 최초 잠금 이후 플레이어 이동이나 재호출에 덮어써지지 않는 불변성 유지
  4. **최대 2박 연장(Retry) 및 타임아웃(Timeout) 규약**:
     - 표준 1.0초(2박) 경과 시 오답/HP 차감 없이 `retry` 연장 상태 전이
     - 연장 기간 중 중앙 복귀 성공 시 정상 잠금
     - 총 2.0초(4박) 만료 시 게임 루프 중단을 방지하기 위해 `defaultFallbackReference` 강제 잠금 및 `timeout` 상태 전이
  5. **인메모리 전용 런타임 수명주기**:
     - localStorage 영구 저장 금지 원칙 준수 (단일 세션 인메모리 유지)
     - 라운드 전환 시 `open({ roundIndex })`로 안전한 상태 초기화 및 재사용
- **유지 사항**:
  - CalibrationHelper의 기존 PartGate 기준선 모델, Cover/미러 좌표계, 11존 판정, keyboard/touch fallback.
- **변경 금지**:
  - RunDetector와 HipSwayDetector의 감지 알고리즘, AnswerSelector의 집합 덮기 알고리즘, main.ts 통합.
- **완료 조건**:
  - [x] 중앙 외부에서는 기준점이 잠기지 않는다
  - [x] 안정 중앙 프레임은 한 번만 기준점을 잠근다
  - [x] 흔들림, 추적 유실, 보조 앵커, timeout/retry가 단위 테스트된다
- **테스트**:
  - Vitest 18개 단위 테스트 전원 통과 (`tests/unit/center-return-gate.test.ts`), 전체 테스트 546/546 100% Pass, `npm run build` 번들 검증 완료
- **관련 파일**:
  - `dream_guardian/config/beat-motion.config.ts`
  - `dream_guardian/src/motion/CenterReturnGate.ts`
  - `dream_guardian/src/motion/index.ts`
  - `dream_guardian/tests/unit/center-return-gate.test.ts`
  - `dream_guardian/HANDOVER.md`
  - `docs/03_GITHUB_ISSUES.md`

---

### Issue #179: [ANSWER-ZONE-001] 골반/머리 상대 이동 기반 좌우 정답존 선택기
- **GitHub URL**: https://github.com/Choyounhwa/-dream-guardian/issues/179
- **Labels**: `feature`, `P1-high`, `phase-6`
- **Milestone**: `v0.5-beat-motion`
- **작업 ID**: `[ANSWER-ZONE-001]`
- **상태**: 🟢 **완료 (Pass)**
- **제목**: 골반/머리 상대 이동 기반 좌우 정답존 선택기
- **목적**:
  - 11개 피트니스 존 답 선택을 대체하는 좌/우 정답존 입력을 독립 구현한다.
- **수정 및 생성 대상**:
  - `dream_guardian/config/beat-motion.config.ts` (AnswerZoneConfig 추가: entryRatio 0.42, cancelRatio 0.30, dwellDuration 0.5s)
  - `dream_guardian/src/input/AnswerZoneSelector.ts` (신규: 상대 변위 계산, 히스테리시스, 0.5초 확정, 머리+어깨 동방향 보조 입력, fallback)
  - `dream_guardian/src/input/index.ts` (AnswerZoneSelector 및 타입 export 추가)
  - `dream_guardian/tests/unit/answer-zone-selector.test.ts` (신규: 20개 단위 테스트)
- **구현 내용**:
  1. **개인 기준점 대비 골반 우선 좌/우 상대 변위(`dx`) 산출**:
     - `RoundCenterReference` 대비 골반 중심 변위 계산 (미러 모드 기준 좌: `dx < 0`, 우: `dx > 0`)
     - 기준점 미주입 시 답안 조준 및 확정 원천 차단
  2. **진입 `0.42 × sw` 및 취소 `0.30 × sw` 히스테리시스**:
     - 데드존(`|dx| < 0.084` @ sw=0.20): 조준 미발생
     - 진입 임계값 초과 시 `left` 또는 `right` 조준 시작
     - 취소 임계값(`0.060`) 초과 복귀 시에만 조준 취소 및 체류 시간 리셋하여 미세 흔들림(jitter) 방지
  3. **0.5초(BPM 120 1박) 체류 확정**:
     - 해당 존 체류 0.5초 도달 시 단 1회 확정 (`isConfirmed = true`)
     - 확정 후 중앙 복귀나 반대편 이동이 발생해도 번복되지 않는 불변성 유지
     - 좌/우 상호 배타적 선택 보장
  4. **골반 신뢰도 부족 시 머리+어깨 동방향 보조 입력 검증**:
     - 머리(NOSE)와 어깨(LEFT/RIGHT_SHOULDER)가 모두 취소 임계값을 넘어 동일한 방향으로 이동한 경우에만 보조 입력 승인
     - 방향 상반(머리 좌, 어깨 우) 또는 한 부위만 정체된 경우 보조 입력 거부 및 조준 방지
  5. **미러 좌표계 및 Fallback 지원**:
     - 카메라 미러링 환경에서 화면 좌/우 방향성 1:1 일치 보장
     - 키보드/터치 비상 `selectByFallback()` 즉시 확정 및 `reset()` 수명주기 지원
- **유지 사항**:
  - 4색 커서 트래커, Cover/미러 변환, keyboard/touch fallback.
- **변경 금지**:
  - 11존 좌표와 안전 제약, CSV 패턴 생성, 전투 수치, main.ts 플로우.
- **완료 조건**:
  - [x] 좌/우를 동시에 확정하지 않는다
  - [x] dead zone, 히스테리시스, dwell, 추적 유실, 미러 좌표가 테스트된다
  - [x] 기준점 없이 답을 확정할 수 없다
- **테스트**:
  - Vitest 20개 단위 테스트 전원 통과 (`tests/unit/answer-zone-selector.test.ts`), 전체 테스트 566/566 100% Pass, `npm run build` 번들 검증 완료
- **관련 파일**:
  - `dream_guardian/config/beat-motion.config.ts`
  - `dream_guardian/src/input/AnswerZoneSelector.ts`
  - `dream_guardian/src/input/index.ts`
  - `dream_guardian/tests/unit/answer-zone-selector.test.ts`
  - `dream_guardian/HANDOVER.md`
  - `docs/03_GITHUB_ISSUES.md`

---

### Issue #180: [BEAT-RUN-001] 자유 달리기 게이지를 8박 문제 준비 라운드로 전환
- **GitHub URL**: https://github.com/Choyounhwa/-dream-guardian/issues/180
- **Labels**: `feature`, `P1-high`, `phase-5`
- **Milestone**: `v0.5-beat-motion`
- **작업 ID**: `[BEAT-RUN-001]`
- **상태**: 🟢 **완료 (Pass)**
- **제목**: 자유 달리기 게이지를 8박 문제 준비 라운드로 전환
- **목적**:
  - 기존 runGauge 충전/감쇠와 게이지 100% 문제 전이를 제거하고, 달리기 1박부터 문제를 표시하는 8박 라운드를 연결한다.
- **수정 및 생성 대상**:
  - `dream_guardian/src/game/BeatRunCoordinator.ts` (신규: 8박 라운드 루프 코디네이터)
  - `dream_guardian/src/game/index.ts` (BeatRunCoordinator export 추가)
  - `dream_guardian/src/core/RhythmEngine.ts` (isRunning 별칭 getter 추가)
  - `dream_guardian/src/main.ts` (runGauge 및 100% 전이 로직/UI 제거, BeatRunCoordinator 연동, 8박 점 및 문제 상단 HUD 렌더링, Space/Click fallback 전이)
  - `dream_guardian/tests/integration/beat-run-gameplay.test.ts` (신규: 11개 통합 테스트)
- **구현 내용**:
  1. **문제 1회 생성 및 1박 즉시 출제/TTS**:
     - runQuestion phase 시작 시점에 문제를 정확히 한 번 생성하고 화면 상단에 즉시 표시
     - 비블로킹 한국어 TTS로 문제 낭독 시작
     - 1~5박 진행 중 문제 중복 생성 방지
  2. **8박 이전 답안 페이즈 엄격 차단**:
     - 1~5박(RUN_QUESTION) 및 6~7박(CENTER_RETURN) 동안 `isAnswerOpen = false` 및 `answerLocked = true` 유지
     - 8박 도달 전에는 답안 선택 진입 원천 차단
  3. **8박 중앙 복귀 기준점 잠금 후 답안 페이즈 개방**:
     - 6~7박 중앙 복귀 네온 게이트 오픈 및 8박 시점 기준점 잠금 완료 시 `ANSWER_OPEN` 전이
     - 잠긴 `RoundCenterReference`를 `AnswerZoneSelector`에 주입하여 좌/우 정답 선택 개방
  4. **중앙 복귀 지연 시 무피해 안전 연장(Retry) 및 Fallback**:
     - 8박 시점 중앙 미복귀 시 오답/HP 차감 없이 최대 2박(1.0s) retry 연장 대기
     - 연장 만료 시 `defaultFallbackReference` 강제 잠금으로 게임 루프 무중단 진행
  5. **runGauge 제거 및 Space/Click Fallback 지원**:
     - 기존 `runGauge += dt*15`, 자연 감쇠, 100% 게이지 UI 제거
     - 웹캠 미사용 환경을 위한 Space/화면 클릭 시 8박 페이즈 전이 및 fallback 정답 확정 지원
- **유지 사항**:
  - 4개 locomotion mode, QuestionBank/TTS의 비차단 동작, pause, 11존 정의, 전투 수치.
- **변경 금지**:
  - AnswerZoneSelector 내부 판정, CenterReturnGate 내부 판정, 별 수집/오답 스웨이 구현.
- **완료 조건**:
  - [x] 한 문제는 매 run phase 시작 시 정확히 한 번 생성된다
  - [x] 8박 전에는 answer phase가 열리지 않는다
  - [x] 중앙 복귀 실패는 오답이 아닌 연장/ fallback 경로로 진행한다
- **테스트**:
  - Vitest 11개 통합 테스트 전원 통과 (`tests/integration/beat-run-gameplay.test.ts`), 전체 테스트 577/577 100% Pass, `npm run build` 번들 검증 완료

---

### Issue #182: [INPUT-STAR-001] 11존 단일 별 Perfect Good Late Miss 판정
- **GitHub URL**: https://github.com/Choyounhwa/-dream-guardian/issues/182
- **Labels**: `feature`, `P1-high`, `phase-6`
- **Milestone**: `v0.5-beat-motion`
- **작업 ID**: `[INPUT-STAR-001]`
- **상태**: 🟢 **완료 (Pass)**
- **제목**: 11존 단일 별 Perfect Good Late Miss 판정
- **목적**:
  - 정답 뒤 별 하나를 지정 부위 커서와 목표 존으로 수집하고 리듬 판정을 반환하는 입력 모델을 구현한다.
- **수정 대상**:
  - `dream_guardian/config/beat-motion.config.ts`
  - `dream_guardian/src/types/star.ts`
  - `dream_guardian/src/input/StarCollectionInput.ts`
  - `dream_guardian/src/input/index.ts`
  - `dream_guardian/tests/unit/star-collection-input.test.ts`
- **구현 내용**:
  1. **Perfect / Good / Late / Miss 타이밍 판정**:
     - `StarTarget`의 `cursorType`/`part`, `zoneId`, `landingTime` 기준
     - Perfect: ±0.12s 이내, Good: ±0.25s 이내, Late: ±0.40s 이내, Miss: 0.40s 초과 및 타임아웃
  2. **차단 가드 (지정 외 커서 / 무효 존 / 중복 / 일시정지)**:
     - 지정되지 않은 커서 진입 차단 (`cursorType !== designatedCursor`)
     - 유효하지 않은 존 차단 (`isValidZoneForCursor(designatedCursor, zoneId)` 검증)
     - 중복 수집 차단 (`_isCollected` 플래그로 1회 확정 후 추가 수집 차단)
     - 일시정지 상태 차단 (`_paused === true` 시 모션/키보드/터치 전면 차단)
  3. **좌표계 및 폴백 지원**:
     - 11존 기본 레이아웃(`DEFAULT_FITNESS_ZONES`) 및 `CursorTracker` 정규화 좌표계 연동
     - `fromKeyboard`, `fromTouch` 폴백 입력 및 미러(isMirrored)/Cover 뷰포트 지원
  4. **전투 페널티 배제**:
     - `hasBattlePenalty: false`로 별 판정 결과는 순수 리듬 통계 전용이며 전투 HP/마나/콤보에 무영향 보장
- **유지 사항**:
  - 4색 커서, 존 허용 매트릭스, Cover/미러 좌표, keyboard/touch fallback.
- **변경 금지**:
  - 별 시퀀스 생성, 렌더링, main.ts 라운드 전이, BattleState.
- **완료 조건**:
  - [x] 11존 및 4색 커서 조합의 유효/무효 입력을 테스트한다 (44개 전수 조합 검증)
  - [x] 모든 타이밍 경계와 중복 수집이 테스트된다
  - [x] Miss는 전투 페널티를 발생시키지 않는다
- **테스트**:
  - Vitest 26개 단위 테스트 전원 통과 (`tests/unit/star-collection-input.test.ts`), 전체 테스트 638/638 100% Pass, `npm run build` 번들 검증 완료
- **관련 파일**:
  - `dream_guardian/config/beat-motion.config.ts`
  - `dream_guardian/src/types/star.ts`
  - `dream_guardian/src/input/StarCollectionInput.ts`
  - `dream_guardian/src/input/index.ts`
  - `dream_guardian/tests/unit/star-collection-input.test.ts`

---

### Issue #184: [GAME-ROUND-001] BEAT MOTION 8박 종료 전투 및 리듬 통계 정산
- **GitHub URL**: https://github.com/Choyounhwa/-dream-guardian/issues/184
- **Labels**: `feature`, `P1-high`, `phase-5`
- **Milestone**: `v0.5-beat-motion`
- **작업 ID**: `[GAME-ROUND-001]`
- **상태**: 🟢 **완료 (Pass)**
- **제목**: BEAT MOTION 8박 종료 전투 및 리듬 통계 정산
- **목적**:
  - 답 확정 즉시 처리되던 전투 결과를 답안 8박 종료 시 한 번만 처리하고, 별/리듬 통계를 전투 자원과 분리한다.
- **수정 대상**:
  - `dream_guardian/src/game/BeatRoundResolver.ts`
  - `dream_guardian/src/types/result.ts`
  - `dream_guardian/src/game/index.ts`
  - `dream_guardian/tests/unit/beat-round-resolver.test.ts`
- **구현 내용**:
  1. **단일 정산 및 Idempotency Guard**:
     - 답안 8박 종료 시점 단 1회(Single Point of Settlement) 전투 자원 정산
     - 동일 라운드 중복 `resolveRound` 호출 시 자원 중복 변경 원천 차단
  2. **정답 / 오답 / 타임아웃 처리**:
     - 정답: 마나 +25, 콤보 +1, 보스 기본 피해(1), 마나 100 도달 시 스펠 시전(4)
     - 오답: 플레이어 HP -25, 콤보 0 리셋, 보스 반격, `wrongAnswerCount` 누적
     - 타임아웃: 플레이어 HP -25, 콤보 0 리셋, 보스 반격, `timeoutCount` 독립 누적
  3. **별 및 리듬 통계 완전 격리**:
     - `beatStarsCollected`, `perfectHits`, `goodHits`, `lateHits`, `missedStars`, `recoverySwayCount`를 전투 자원과 분리하여 누적 관리
     - 별 수집 성공/실패와 무관하게 정답 시 기본 마나 +25 100% 보장
- **유지 사항**:
  - BattleState/BossController/Guardian의 수치 공식, 기존 챕터 별 등급 의미.
- **변경 금지**:
  - AnswerZoneSelector, 별 타이밍 판정, renderer, persistent storage 구현.
- **완료 조건**:
  - [x] 중복 resolve가 전투 자원을 두 번 바꾸지 않는다
  - [x] 별 성공/실패가 기본 정답 마나에 영향을 주지 않는다
  - [x] timeout은 오답 전투 결과와 구분된 통계를 남긴다
- **테스트**:
  - Vitest 15개 단위 테스트 전원 통과 (`tests/unit/beat-round-resolver.test.ts`), 전체 테스트 653/653 100% Pass, `npm run build` 번들 검증 완료
- **관련 파일**:
  - `dream_guardian/src/game/BeatRoundResolver.ts`
  - `dream_guardian/src/types/result.ts`
  - `dream_guardian/src/game/index.ts`
  - `dream_guardian/tests/unit/beat-round-resolver.test.ts`

---

### Issue #187: [BUG-BEAT-001] 달리기 페이즈 미동작 자동 8박 채움 결함 수정 및 실제 8회 운동 연동
- **GitHub URL**: https://github.com/Choyounhwa/-dream-guardian/issues/187
- **Labels**: `bug`, `P0-critical`, `phase-5`
- **Milestone**: `v0.5-beat-motion`
- **작업 ID**: `[BUG-BEAT-001]`
- **상태**: ⚪ **대기 (승인 대기)**
- **제목**: 달리기 페이즈 미동작 자동 8박 채움 결함 수정 및 실제 8회 운동 연동
- **목적**:
  - 웹캠 앞에서 플레이어가 전혀 움직이지 않고 가만히 서 있어도 시간 경과(4.0초)로 8박이 자동 채워지는 결함을 해소하고, 플레이어가 실제로 1회 운동할 때마다 1박씩 차올라 총 8회의 실제 운동을 완료해야만 8박자가 완충되도록 연동한다.
- **수정 대상**:
  - `dream_guardian/src/game/BeatRunCoordinator.ts`
  - `dream_guardian/src/main.ts`
  - `dream_guardian/tests/integration/beat-run-gameplay.test.ts`
- **구현 내용**:
  1. 달리기 페이즈(RUN_QUESTION)에서 시간 경과(dt) 기반 비트 자동 증가 차단.
  2. `activeDetector.update()`의 `stepped` 이벤트 및 `beatCoordinator.recordStep()` 호출 시 1박씩(0/8 -> 1/8 -> ... -> 8/8) 비트 전진.
  3. 키보드 Space 및 화면 클릭 fallback도 동일하게 1스텝 인정 및 1박 전진 지원.
  4. 8회 운동 스텝 완수 시 비로소 8박 충족 및 다음 단계 전이.
- **완료 조건**:
  - [ ] 미동작 시(시간만 경과) 박자가 증가하지 않고 대기함
  - [ ] 8회 운동 스텝 수행 시 정확히 8박 전진 및 완료됨
  - [ ] 단위/통합 테스트 100% Pass

---

### Issue #190: [BEAT-ROUTINE-001] 8박 운동 → 2박 쉼(Ready) → 8박 키노트 합주 상태 전이 컨트롤러 구현
- **GitHub URL**: https://github.com/Choyounhwa/-dream-guardian/issues/190
- **Labels**: `feature`, `P1-high`, `phase-5`
- **Milestone**: `v0.5-beat-motion`
- **작업 ID**: `[BEAT-ROUTINE-001]`
- **상태**: ⚪ **대기 (승인 대기)**
- **제목**: 8박 운동 → 2박 쉼(Ready) → 8박 키노트 합주 상태 전이 컨트롤러 구현
- **목적**:
  - 비트매니아식 8+2+8 비트 루틴(8박 운동 러닝 → 2박 호흡/Ready 브레이크 → 8박 키노트 합주 퍼포먼스)의 상태 전이 루프 및 타이밍 계약을 확립한다.
- **수정 및 생성 대상**:
  - `dream_guardian/src/game/BeatRunCoordinator.ts`
  - `dream_guardian/src/core/RhythmEngine.ts`
  - `dream_guardian/tests/unit/beat-routine-controller.test.ts`
- **구현 내용**:
  1. 8박 운동 러닝 (RUN_EXERCISE): 실제 8회 운동 스텝 감지 시 8박 완충.
  2. 2박 호흡/준비 브레이크 (REST_READY): 8박 완충 직후 정확히 2박(1.0s) 동안 호흡 가다듬기 및 "READY... SET!" 카운트다운.
  3. 8박 키노트 합주 퍼포먼스 (KEYNOTE_PERFORMANCE): 1박째 정답 위치 손 터치로 정답 확정 및 2~8박 연속 키노트 연주.
  4. 라운드 단일 정산 (ROUND_RESOLVE): 8박 합주 종료 시점에 단 1회 전투 자원 및 리듬 성취도 일괄 정산.
- **완료 조건**:
  - [ ] 8회 운동 완료 즉시 REST_READY(2박)로 전이됨
  - [ ] 2박 경과 후 1박째 정답 선택 및 키노트 연주 단계로 매끄럽게 연결됨
  - [ ] 단위/통합 테스트 100% Pass

---

### Issue #191: [AUDIO-BAND-001] 1단계 기타(Zone 1~5) + 드럼(Zone 9~11) Web Audio 합성기 및 싱크/어긋남 사운드 엔진
- **GitHub URL**: https://github.com/Choyounhwa/-dream-guardian/issues/191
- **Labels**: `feature`, `P1-high`, `phase-6`
- **Milestone**: `v0.5-beat-motion`
- **작업 ID**: `[AUDIO-BAND-001]`
- **상태**: ⚪ **대기 (승인 대기)**
- **제목**: 1단계 기타(Zone 1~5) + 드럼(Zone 9~11) Web Audio 합성기 및 싱크/어긋남 사운드 엔진
- **목적**:
  - 비트매니아/DJMAX 스타일의 실시간 키사운드 시스템을 구축하여, 유저의 손(기타)/발(드럼) 터치 시 역동적인 악기 사운드를 합성하고, 박자 이탈 시 어긋남(Stumble/Glitch) 피드백을 제공한다.
- **수정 및 생성 대상**:
  - `dream_guardian/src/audio/SFXSynth.ts`
  - `dream_guardian/src/audio/BandSynthesizer.ts` (신규)
  - `dream_guardian/tests/unit/band-synthesizer.test.ts`
- **구현 내용**:
  1. 1단계(Ch.1) 록 앙상블 절차적 사운드 합성:
     - 손 (Zone 1~5): 일렉 기타 리드/리프/파워코드 왜곡(Overdrive) 사운드
     - 발 (Zone 9~11): 록 드럼 킥, 스네어, 하이햇/크래시 타격음
  2. 정박(Sync) / 엇박(Stumble) 음향 메커니즘:
     - 정박(±0.12s): 풍성한 100% 게인 클린 믹싱
     - 엇박(±0.25s): 피치 벤드 글리치, 프렛 스크래치(Fret Scratch), 림샷 둔탁음
     - 무동작(Miss): 메인 악기 트랙 음소거(Mute) 및 둔탁한 가이드 메트로놈 잔존
  3. 2박 Ready 카운트다운 사운드 (READY... SET!)
- **완료 조건**:
  - [ ] Zone 1~5 손 터치 시 기타 음원 실시간 합성 출력
  - [ ] Zone 9~11 발 터치 시 드럼 음원 실시간 합성 출력
  - [ ] 엇박 및 미스 시 청각적 어긋남(Stumble) 연출 검증
  - [ ] 단위 테스트 100% Pass

---

### Issue #192: [RENDER-KEYNOTE-001] Zone 1~5 및 Zone 9~11 비트매니아식 키노트 비주얼 렌더링 및 판정 연출
- **GitHub URL**: https://github.com/Choyounhwa/-dream-guardian/issues/192
- **Labels**: `feature`, `P1-high`, `phase-6`
- **Milestone**: `v0.5-beat-motion`
- **작업 ID**: `[RENDER-KEYNOTE-001]`
- **상태**: ⚪ **대기 (승인 대기)**
- **제목**: Zone 1~5 및 Zone 9~11 비트매니아식 키노트 비주얼 렌더링 및 판정 연출
- **목적**:
  - 정답 위치에서 시작하여 8박 동안 Zone 1~5(손/기타)와 Zone 9~11(발/드럼)에 차례로 출현하는 비트매니아식 비트 링/노트 및 실시간 판정(PERFECT/GREAT/MISS)을 시각화한다.
- **수정 및 생성 대상**:
  - `dream_guardian/src/render/KeynoteRenderer.ts` (신규)
  - `dream_guardian/src/main.ts`
  - `dream_guardian/tests/unit/keynote-renderer.test.ts`
- **구현 내용**:
  1. 정답 위치 1박째 인트로 노트 연출: 2박 쉼 후 1박째 정답 존에 황금색 대형 포커스 링 점등.
  2. 2~8박 키노트 순차 시각화:
     - Zone 1~5 (상단 기타 레인): 네온 블루/퍼플 수축 타이밍 링
     - Zone 9~11 (하단 드럼 레인): 네온 오렌지/골드 바닥 타격 펄스
---

### Issue #188: [RENDER-TRACK-001] 3D 드림 그리드 - 11개 피트니스 존 원근 연한 연결선(Zone Connection Lines) 렌더링
- **GitHub URL**: https://github.com/Choyounhwa/-dream-guardian/issues/188
- **Labels**: `feature`, `phase-7`, `P2-medium`
- **Milestone**: `v0.6-visuals-content`
- **작업 ID**: `[RENDER-TRACK-001]`
- **상태**: 🟢 **완료 (Pass)**
- **제목**: 3D 드림 그리드 - 11개 피트니스 존 원근 연한 연결선(Zone Connection Lines) 렌더링
- **목적**:
  - 3D 드림 그리드 공간에서 11개 피트니스 존(Zone 1~11)이 공중에 분리되어 보이지 않고 3D 공간에 자연스럽게 정렬되도록, 그리드 소실점(Vanishing Point)으로부터 각 피트니스 존의 중심 앵커로 이어지는 은은하고 연한 네온 연결선(Faint Connection Lines)을 렌더링한다.
  - 과일 아이템 등 불필요한 요소는 배제하고 그리드와 피트니스 존 간의 기하학적 연계선만을 깔끔하게 시각화한다.
- **수정 대상**:
  - `dream_guardian/src/render/DreamGrid.ts`
  - `dream_guardian/src/main.ts`
  - `dream_guardian/tests/unit/dream-grid.test.ts`
- **구현 내용**:
  1. **피트니스 존 연결선 렌더러 (`_renderZoneConnections`)**:
     - `DEFAULT_FITNESS_ZONES`의 11개 존 위치(정규화 좌표)를 화면 좌표로 환산하여 중심점 `(cx, cy)` 산출.
     - 소실점 `(vx, vy)`에서 각 존의 중심점 `(cx, cy)`으로 이어지는 연한 원근 연결선(Perspective Connection Lines) 렌더링.
     - 선형 그라데이션(`LinearGradient`)을 적용하여 소실점 부근은 자연스럽게 페이드아웃되고 존 방향으로 부드럽게 이어짐.
     - 기본 투명도는 18%(`alpha = 0.18`), 굵기는 1.2px의 부드럽고 은은한 네온 선으로 렌더링하여 게임 플레이(문제/보스/스켈레톤) 시야를 방해하지 않음.
     - 각 피트니스 존 중심에 은은한 앵커 링 포인트(Radius 3px) 점등.
  2. **설정 인터페이스 확장 (`DreamGridConfig`)**:
     - `renderZoneConnections?: boolean` (기본값: `true`, 메뉴 화면에서는 `false`로 비활성화)
     - `zoneConnectionAlpha?: number` (기본값: `0.18`)
     - `zones?: readonly FitnessZone[]` (커스텀 존 전달 지원, 기본값: `DEFAULT_FITNESS_ZONES`)
- **유지 사항**:
  - 기존 3D 정방형 그리드 투영 공식, 심도 안개(Depth Fog) 및 천장 그리드 렌더링.
  - 전체 단위/통합 테스트 100% Pass 유지.
- **변경 금지**:
  - 수학 문제 평가 및 TTS 로직.
  - 전투/마나/보스 시스템.
- **완료 조건**:
  - [x] 3D 드림 그리드 렌더링 시 11개 피트니스 존으로 이어지는 연한 연결선이 표시됨.
  - [x] `renderZoneConnections: false` 설정 시 연결선 드로잉이 정상 비활성화됨.
  - [x] `zoneConnectionAlpha` 옵션으로 연결선의 투명도를 자유롭게 조절할 수 있음.
  - [x] Vitest 단위 테스트 10/10 및 전체 581/581 100% 통과, `npm run build` 번들 검증 완료.
- **관련 파일**:
  - `dream_guardian/src/render/DreamGrid.ts`
  - `dream_guardian/src/main.ts`
  - `dream_guardian/tests/unit/dream-grid.test.ts`

---

### Issue #189: [FEAT-ITEM-001] 3D 러닝 트랙 부유 과일 아이템(딸기·바나나) 렌더링 및 모션 수집 시스템
- **GitHub URL**: https://github.com/Choyounhwa/-dream-guardian/issues/189
- **Labels**: `feature`, `phase-5`, `P1-high`
- **Milestone**: `v0.6-visuals-content`
- **작업 ID**: `[FEAT-ITEM-001]`
- **상태**: 🚫 **취소/종료 (Closed per user request)**
- **사유**: 사용자 요구사항 반영 — 러닝 트랙 과일 아이템 제외 결정에 따른 카드 비활성화 및 종료.

---

### Issue #193: [BATTLE-BOSS-001] Phase B 보스 불협화음 장판(양손 쿵 점프 & 한손 콩콩 발짓밟기) 및 광폭화 엔진
- **GitHub URL**: https://github.com/Choyounhwa/-dream-guardian/issues/193
- **Labels**: `phase-5`, `feature`, `P1-high`
- **Milestone**: `v0.4-gameplay-systems`
- **작업 ID**: `[BATTLE-BOSS-001]`
- **상태**: ⚪ **대기 (승인 대기)**
- **제목**: Phase B 보스 불협화음 장판(양손 쿵 점프 & 한손 콩콩 발짓밟기) 및 광폭화 엔진
- **목적**:
  - 10문제 러닝(Phase A) 돌파 후 진입하는 보스 결전(Phase B)에서 보스의 지속적인 불협화음 바닥 공격 패턴(양손 쿵 점프 회피, 한손 번갈아 콩콩 적 미니언 발짓밟기) 및 보스 광폭화(Enrage) 상태 제어 엔진을 구축한다.
- **수정 및 생성 대상**:
  - `dream_guardian/src/game/BossHazardController.ts` (신규)
  - `dream_guardian/src/game/BossController.ts`
  - `dream_guardian/src/types/index.ts`
  - `dream_guardian/tests/unit/boss-hazard-controller.test.ts`
- **구현 내용**:
  1. **보스 불협화음 장판 2대 공격 패턴**:
     - **패턴 1 (양손 쿵 - 바닥 충격파)**: 보스가 양손을 바닥에 내리치면 전 바닥 레인에 충격파 발생. 유저가 JumpDetector를 통해 점프 성공 시 회피. 실패 시 아군 미니언 1마리 즉시 탈락.
     - **패턴 2 (한손 번갈아 콩콩 - 적 미니언 침투)**: 보스가 한 손씩 교대로 바닥을 치며 적 그림자 미니언을 레인으로 진격시킴. 유저가 Zone 9/11 양발 교대 짓밟기(Alternating Foot Stomp) 성공 시 적 미니언 격퇴. 실패 시 아군 미니언 1마리 즉시 탈락.
  2. **보스 광폭화 (Enrage Phase)**:
     - 보스 체력 30% 이하 도달 시 광폭화 트리거.
     - 공격 주기 1.5배 단축, 충격파 및 적 미니언 전진 속도 가속.
  3. **아군 미니언 탈락 이벤트 버스 연동**:
     - 장판/적 미니언 대처 실패 시 `MINION_CASUALTY` 이벤트를 발행하여 아군 미니언 수량 감소 트리거.
- **완료 조건**:
  - [ ] 보스 양손 쿵 패턴 시 Jump 감지로 회피 판정 성공
  - [ ] 보스 한손 콩콩 패턴 시 Zone 9/11 교대 스텝으로 적 미니언 처치 성공
  - [ ] 회피/처치 실패 시 MINION_CASUALTY 이벤트 정상 발행
  - [ ] 보스 체력 30% 이하 시 광폭화 상태 전이 및 공격 주기 가속 검증
  - [ ] 단위 테스트 100% 통과

---

### Issue #194: [MINION-TROOP-001] 아군 미니언 군단(3~13체) 실시간 증원/탈락 및 상체(Zone 1~5) 별빛 수집 마법 발사 시스템
- **GitHub URL**: https://github.com/Choyounhwa/-dream-guardian/issues/194
- **Labels**: `phase-5`, `feature`, `P1-high`
- **Milestone**: `v0.4-gameplay-systems`
- **작업 ID**: `[MINION-TROOP-001]`
- **상태**: ⚪ **대기 (승인 대기)**
- **제목**: 아군 미니언 군단(3~13체) 실시간 증원/탈락 및 상체(Zone 1~5) 별빛 수집 마법 발사 시스템
- **목적**:
  - Phase A(10문제 러닝)에서 문제 정답에 따른 미니언 구출/증원(+1, 최대 13마리)과 오답 시 탈락 연출을 관리하고, Phase B(보스전)에서 상체(Zone 1~5) 별빛 수집과 연동하여 보스에게 집중 마법 탄막을 발사하는 군단 전투 화력 엔진을 구축한다.
- **수정 및 생성 대상**:
  - `dream_guardian/src/game/MinionTroopManager.ts` (신규)
  - `dream_guardian/src/game/BattleState.ts`
  - `dream_guardian/src/game/GuardianSystem.ts`
  - `dream_guardian/tests/unit/minion-troop-manager.test.ts`
- **구현 내용**:
  1. **미니언 군단 수량 관리 (Troop Capacity)**:
     - 초기 군단: 수호신 1 + 기본 미니언 3마리 (총 4체)
     - Phase A 증원: 문제 정답 시 미니언 +1 (최대 13마리), 오답 시 미니언 증원 실패(바닥 함정 탈락 연출).
     - Phase B 탈락: 보스 장판/적 미니언 대처 실패 시 아군 미니언 -1. (0마리 도달 시 수호신 단독 대치).
  2. **상체(Zone 1~5) 별빛 수집 및 강력 마법 발사 타이밍**:
     - Phase B에서도 Zone 1~5는 상체 손 커서로 별빛을 모으는 동일 컨셉 유지.
     - 별빛 수집 성공: 마법 게이지 충전 및 군단 화력 배율 증가 (최대 1.5배).
     - 별빛 수집 실패: 미니언에는 영향이 없으나, 충전 중이던 강력 마법 발사 타이밍이 빗나가거나 쿨다운 지연(딜로스).
  3. **군단 화력 공식 (Troop DPS Calculation)**:
     - $DPS = (10 + \text{미니언 수} \times 2) \times \text{별빛 연계 배율}$
- **완료 조건**:
  - [ ] 정답/오답에 따른 미니언 수량(3~13마리) 변동 정상 동작
  - [ ] 장판 피격 시 아군 미니언 -1 차감 및 0마리 하한 클램프
  - [ ] Zone 1~5 별빛 수집 성공 시 마법 게이지 충전 및 미수집 시 발사 딜레이 검증
  - [ ] 단위 테스트 100% 통과

---

### Issue #195: [RENDER-CLIMAX-001] 3D 원근 보스 결전 연출(불협화음 장판 충격파, 적 미니언 전진, 아군 군단 마법 탄막 및 광폭화)
- **GitHub URL**: https://github.com/Choyounhwa/-dream-guardian/issues/195
- **Labels**: `phase-7`, `feature`, `P2-medium`
- **Milestone**: `v0.6-visuals-content`
- **작업 ID**: `[RENDER-CLIMAX-001]`
- **상태**: ⚪ **대기 (승인 대기)**
- **제목**: 3D 원근 보스 결전 연출(불협화음 장판 충격파, 적 미니언 전진, 아군 군단 마법 탄막 및 광폭화)
- **목적**:
  - 1인칭 3D 원근 시점의 DreamGrid 공간에서 보스의 2대 바닥 공격(양손 쿵 파동, 한손 콩콩 적 미니언 전진), 아군 미니언 군단의 V자 편대 및 마법 탄막 발사, 보스 광폭화 시각 효과를 렌더링한다.
- **수정 및 생성 대상**:
  - `dream_guardian/src/render/BossClimaxRenderer.ts` (신규)
  - `dream_guardian/src/render/BossRenderer.ts`
  - `dream_guardian/src/render/CanvasManager.ts`
  - `dream_guardian/tests/unit/boss-climax-renderer.test.ts`
- **구현 내용**:
  1. **불협화음 바닥 충격파 렌더링**:
     - 보스 양손 쿵 모션 시 소실점으로부터 유저 발밑까지 붉은 충격파 링이 3D 원근으로 확산.
  2. **적 미니언 전진 및 짓밟기 파티클**:
     - 한손 콩콩 모션 시 레인을 따라 전진하는 그림자 미니언 렌더링.
     - 유저 발짓밟기(Zone 9/11) 성공 시 펑 터지는 정화 파티클 연출.
  3. **아군 군단 V자 편대 및 마법 탄막**:
     - 아군 미니언 수량(3~13마리)에 따라 수호신 좌우로 부유하는 V자 편대 동적 렌더링.
     - Zone 1~5 별빛 수집 성공 시 군단에서 보스를 향해 날아가는 집중 마법 빔/미사일 렌더링.
  4. **보스 광폭화 아우라**:
     - 보스 HP 30% 이하 시 붉은 번개 및 왜곡 쉐이더 펄스 점등.
- **완료 조건**:
  - [ ] 3D 충격파 링 및 적 미니언 투영 정상 드로잉
  - [ ] 아군 미니언 수량 변화에 따른 편대 배치 실시간 반응
  - [ ] 별빛 수집 시 마법 발사 빔 및 보스 피격 이펙트 정상 렌더링
  - [ ] 단위 테스트 100% 통과

---

### Issue #201: [FEAT-CURSOR-005] 양손 선택 커서(합장 메뉴 커서 및 양손 답안 커서) 크기 3배 확대 및 원거리(1m+) 시인성 강화
- **GitHub URL**: https://github.com/Choyounhwa/-dream-guardian/issues/201
- **Labels**: `feature`, `P1-high`, `phase-3`, `phase-6`
- **Milestone**: `v0.5-input-ui`
- **작업 ID**: `[FEAT-CURSOR-005]`
- **상태**: ⚪ **대기 (승인 대기)**
- **제목**: 양손 선택 커서(합장 메뉴 커서 및 양손 답안 커서) 크기 3배 확대 및 원거리(1m+) 시인성 강화
- **목적**:
  - 1080×2160 가상 해상도 환경에서 1m 이상 떨어져 플레이할 때, 현재 양손 선택 커서(양손 모으기 합장 커서 및 인게임 양손 커서)가 화면 대비 지나치게 작아(반경 34px, 폰트 14px) 정확한 위치 인지와 버튼 조작이 어렵던 문제를 해결하기 위해, 커서 크기를 3배 확대하여 시원하고 직관적인 원거리 조작성을 확보한다.
- **수정 및 생성 대상**:
  - `dream_guardian/src/main.ts` (`renderJoinedHandsCursor`)
  - `dream_guardian/config/cursor.config.ts` (양손/합장 커서 크기 규격)
  - `dream_guardian/src/render/AnswerSelectionRenderer.ts`
  - `dream_guardian/tests/unit/cursor-tracker-recipe.test.ts`
- **구현 내용**:
  1. **양손 모으기(합장) 선택 커서 3배 대형화 (3x Scale-up)**:
     - 합장 외곽 네온 링 반경: 기존 `34px` → `100px` (지름 200px, 약 3배 확대)
     - 펄스 진폭: 기존 4px → 10~12px로 확대
     - 선 두께: 기존 3.5px → 8px
     - 중심 텍스트 폰트: 기존 14px bold → 40px bold ('손 모으기' / '메뉴 복귀' 원거리 즉시 판독)
  2. **호버 체류(Dwell) 프로그레스 아크 3배 대형화**:
     - 충전 아크 반경: 기존 `50px` → `145~150px`
     - 충전 아크 선 두께: 기존 7px → 16px (발광 블러 24px)
     - 0.8초 게이지 채움이 1~2m 거리에서도 한눈에 시원하게 보이도록 연출 강화
  3. **인게임 양손(왼손/오른손) 답안 선택 커서 가시성 강화**:
     - `cursor.config.ts`의 `hand.defaultRadius` 및 최소/최대 반경 스케일 튜닝 (원거리 시인성 보장)
     - 손바닥 중심 펄스 링과 라벨(L/R) 폰트 크기 동반 상향
- **유지 사항**:
  - 양손 모으기(`MenuInput`) 거리 판정(0.22) 및 0.8초 호버 체류 로직 보존
  - 마우스 클릭 및 키보드 Fallback 입력 기능 100% 정상 작동 유지
  - 기존 4색 신체 커서 색상 체계(시안/노랑/보라/주황) 유지
- **변경 금지**:
  - MediaPipe Pose/Hands 랜드마크 추출 파이프라인
  - 인게임 피트니스 존(Zone 1~11) 판정 로직
  - 문제 출제 및 전투 수치(HP, 마나, 데미지)
- **완료 조건**:
  - [ ] 양손 모으기 선택 커서 반경이 100px(지름 200px)로 3배 확대 렌더링됨
  - [ ] 커서 라벨 텍스트(40px) 및 호버 프로그레스 아크(반경 145px, 두께 16px)가 1m 거리에서 선명하게 식별됨
  - [ ] 메뉴 카드(챕터, 서브레벨) 및 결과 화면 복귀 시 0.8초 호버 선택이 안정적으로 발동함
  - [ ] `npm test` 단위 테스트 100% Pass 및 빌드 정상 완료
- **테스트**:
  - `tests/unit/cursor-tracker-recipe.test.ts` 단위 테스트 검증
  - 브라우저 개발 서버(`npm run dev`)에서 1.5m 원거리 웹캠 실테스트 검증

---

### Issue #202: [FEAT-READY-001] 스테이지 첫 진입 시 카메라 프레임 정렬 가이드 및 3초 준비 카운트다운(READY_POSITION) 구현
- **GitHub URL**: https://github.com/Choyounhwa/-dream-guardian/issues/202
- **Labels**: `feature`, `P1-high`, `phase-2`, `phase-6`
- **Milestone**: `v0.5-input-ui`
- **작업 ID**: `[FEAT-READY-001]`
- **상태**: ⚪ **대기 (승인 대기)**
- **제목**: 스테이지 첫 진입 시 카메라 프레임 정렬 가이드 및 3초 준비 카운트다운(READY_POSITION) 구현
- **목적**:
  - 스테이지 첫 진입 시(챕터 및 서브레벨 선택 직후) 문제와 8박 달리기 루프가 즉각 시작되어, 사용자가 카메라 앞에서 신체 위치를 잡지 못하고 모션/키보드 오입력이 발생하는 문제를 해결한다. 문제가 출제되기 전 유저가 카메라 화각 안에서 자세를 바르게 잡고(프레임 맞추기), 안정적인 입력을 준비할 수 있는 2단계 진입 분리 구조(프레임 비동기 대기 → BPM 3박자 동기화 카운트다운)를 구현한다.
- **수정 및 생성 대상**:
  - `dream_guardian/src/main.ts`
  - `dream_guardian/src/render/KneeFramingGuideRenderer.ts`
  - `dream_guardian/src/motion/KneeFramingValidator.ts`
  - `dream_guardian/src/core/StateMachine.ts`
  - `dream_guardian/src/audio/SFXSynth.ts`
  - `dream_guardian/tests/unit/stage-ready.test.ts`
- **구현 내용**:
  1. **스테이지 진입 2단계 분리 구조 신설 (`GamePhase` 확장)**:
     - `main.ts`의 `GamePhase`를 `'ready_frame' | 'count_in' | 'running' | 'question'`으로 체계화.
     - `startChapter()` 호출 시 문제/러닝으로 직행하지 않고 `startReadyPhase()`를 호출하여 `ready_frame` 상태로 진입.
  2. **Phase 1: 카메라 신체 프레임 정렬 비동기 대기 (`READY_FRAME`)**:
     - BGM 메인 비트 정지 (잔잔한 앰비언트 대기 상태 유지).
     - 화면 중앙에 반투명 가이드 실루엣 및 정렬 박스 표시: *"카메라 앞에 서서 준비하세요!"*
     - `KneeFramingValidator`를 연동하여 Pose 관절(머리, 어깨, 무릎) 화각이 정상 포착(`ready`)되거나, Space 키/화면 터치 스킵 시 Phase 2로 전환.
     - 대기 중 스텝 및 답안 판정 일체 잠금(Input Locked).
  3. **Phase 2: 곡 BPM 동기화 3박자 예비박 카운트다운 (`COUNT_IN`)**:
     - 선택된 음악 트랙의 BPM 주기에 맞춰 비트 엔진 시동.
     - 1박 간격(60/BPM초)으로 메트로놈 틱과 함께 3... 2... 1... START! 대형 네온 카운트다운 렌더링.
     - 1초/1박 간격 카운트다운 비프음(`count_tick`) 및 시작 신호음 재생.
  4. **Phase 3: 본 라운드 정박 다운비트 전환 (`RUN_QUESTION`)**:
     - 카운트다운 0초 도달 즉시 BGM 본 트랙 다운비트 드롭과 함께 문제 텍스트 표시 및 TTS 낭독 시작.
     - 이동 감지기(`LocomotionDetector`) 및 비트 코디네이터(`BeatRunCoordinator`)를 0으로 깨끗하게 리셋하여 정확히 첫 박자부터 1스텝 측정이 시작되도록 보장.
  5. **PC 디버깅 및 사용자 스킵/일시정지 지원**:
     - Space 키 입력 또는 화면 클릭/터치 시 프레임 대기를 즉시 건너뛰고 카운트인 전환 가능.
     - 카운트다운 중 ESC 일시정지(`PauseModal`) 시 타이머 일시정지 연동.
- **유지 사항**:
  - 8박 비트 루틴(`RUN_QUESTION` → `REST_READY` → `KEYNOTE_PERFORMANCE`) 계약 100% 보존
  - 기존 운동 모드(달리기, 골반 바운스, 스웨이, 양손 교차) 감지 인터페이스 유지
  - 키보드 및 마우스 Fallback 조작 보존
- **변경 금지**:
  - `BeatRunCoordinator`의 8박 리듬 계약 공식
  - `PostureGenerator` 및 문제 출제 데이터 로직
  - 전투 HP/마나 증감 규칙
- **완료 조건**:
  - [ ] 챕터/단계 선택 후 문제 출제 전 프레임 정렬 화면(Phase 1)이 먼저 표시됨
  - [ ] 사용자가 카메라 화각 안에 정상 위치할 수 있도록 신체 프레임 가이드가 시각화됨
  - [ ] 화각 정렬 완료 또는 스킵 시 해당 곡 BPM에 동기화된 3박자 카운트다운(Phase 2)이 진행됨
  - [ ] 준비/카운트다운 동안 잘못된 모션/스텝 입력이 누적되지 않고 클린 상태로 대기함
  - [ ] 카운트다운 종료 즉시 BGM 다운비트 드롭과 함께 달리기/문제로 자연스럽게 전환됨
  - [ ] Space/터치 스킵 및 단위 테스트 100% 통과
- **테스트**:
  - `tests/unit/stage-ready.test.ts` (신규 타이머 및 상태 전이 단위 테스트)
  - 브라우저 개발 서버(`npm run dev`)에서 스테이지 진입 시 3초 대기 및 카메라 정렬 실테스트 검증
- **관련 파일**:
  - `dream_guardian/src/main.ts`
  - `dream_guardian/src/render/KneeFramingGuideRenderer.ts`
  - `dream_guardian/src/motion/KneeFramingValidator.ts`
  - `dream_guardian/src/core/StateMachine.ts`
  - `dream_guardian/src/audio/SFXSynth.ts`
  - `dream_guardian/tests/unit/stage-ready.test.ts`

---

### Issue #203: [FEAT-SKEL-005] 화면 중앙 2/3 높이 메카 졸라맨(Mecha Stickman) 실시간 모션 아바타 구현
- **GitHub URL**: https://github.com/Choyounhwa/-dream-guardian/issues/203
- **Labels**: `feature`, `P1-high`, `phase-2`
- **Milestone**: `v0.3-vision-motion`
- **작업 ID**: `[FEAT-SKEL-005]`
- **상태**: ⚪ **대기 (승인 대기)**
- **제목**: 화면 중앙 2/3 높이 메카 졸라맨(Mecha Stickman) 실시간 모션 아바타 구현
- **목적**:
  - 앙상한 스켈레톤(선과 점) 노출로 인한 시각적 거부감과 의학/디버그 느낌을 해소한다.
  - 화면 중앙 2/3 높이(y ≈ 0.60 ~ 0.85)에 도톰한 네온 캡슐과 관절 볼을 가진 세련된 '메카 졸라맨(Mecha Stickman)' 아바타를 배치하여, 유저가 자신의 신체 위치(손, 머리, 골반)를 직관적이고 자연스럽게 인지(Proprioception)할 수 있도록 한다.
- **수정 대상**:
  - `dream_guardian/config/skeleton.config.ts` (신규 생성: 메카 졸라맨 비례, 두께, 색상 설정)
  - `dream_guardian/src/skeleton/StickmanRenderer.ts` (신규 생성: 메카 졸라맨 렌더러)
  - `dream_guardian/src/skeleton/index.ts` (모듈 export 추가)
  - `dream_guardian/src/main.ts` (중앙 2/3 앵커 렌더링 파이프라인 연동)
  - `dream_guardian/src/ui/SettingsModal.ts` (설정 연동)
  - `dream_guardian/tests/unit/stickman-renderer.test.ts` (신규 단위 테스트)
- **구현 내용**:
  1. **메카 졸라맨 비주얼 디자인 (Canvas 2D 프로시저럴 드로잉)**:
     - 머리: 둥근 캡슐 헬멧 + 가로 발광 네온 바이저 슬릿(보라 #C889FF) (머리 각도 반영)
     - 가슴/몸통: 단단한 역삼각형 실루엣 + 중앙 발광 마력 코어(호흡 펄스 연동)
     - 팔다리: 두께감 있는 라운드 캡슐(폭 14~18px, 다크 네이비 바디 + 네온 라인)
     - 관절: 4색 신체 커서 색상(왼손 시안, 오른손 노랑, 머리 보라, 골반 주황)을 계승한 발광 관절 볼
     - 발밑: 드림 접지 링(마법진) 렌더링으로 지면 일체감 부여
  2. **자연스러운 모션을 위한 고정 비례 순운동학(Fixed-Length FK)**:
     - 상완, 전완, 몸통, 허벅지, 종아리 길이를 황금 비율로 고정하여, 카메라 각도나 원근에 따른 팔다리 왜곡/쪼그라듦 원천 차단
     - 랜드마크 사이의 회전 각도(Math.atan2)만 추출하여 뼈대 회전 적용
     - 급격한 노이즈 방지를 위한 각도 스무딩(Angle Damping) 적용
  3. **화면 중앙 2/3 높이 앵커 배치**:
     - 가상 해상도(1080x2160) 기준 X: 540(중앙), Y: 약 1450~1500 지점에 기준점을 고정하고 자세 미러링
     - 스쿼트 시 무게중심 하강 및 무릎 벌림, 점프 시 스프링 탄성 도약 연출
  4. **설정 모달 및 옵션 연동**:
     - 설정 모달의 '스켈레톤 미러' 옵션과 연동하여 메카 졸라맨 ON/OFF 지원
- **유지 사항**:
  - 기존 4색 커서(AnswerSelectionRenderer) 및 11개 피트니스 존 판정 로직 100% 보존
  - 8+2+8 비트매니아식 리듬 루프 및 모션 감지 계약 보존
  - 단위 테스트 100% Pass 상태 유지
- **변경 금지**:
  - PoseManager 랜드마크 추출 파이프라인
  - 수학 문제 출제 및 배틀 전투 엔진 로직
  - 다른 레이어 UI 레이아웃
- **완료 조건**:
  - [ ] `config/skeleton.config.ts`에 메카 졸라맨 크기/비율/색상 정의 완료
  - [ ] `StickmanRenderer`가 인체 고정 비례와 회전 각도를 계산하여 둥근 캡슐 및 바이저를 정상 렌더링함
  - [ ] 신체 부위 왜곡(팔다리 늘어남/줄어듦) 없이 부드러운 자세 미러링 동작
  - [ ] 화면 중앙 2/3 높이에 안정적으로 배치되어 UI 및 피트니스 존과 자연스럽게 조화됨
  - [ ] `npm test` 단위 테스트 100% Pass 및 빌드 무결성 확인
- **테스트**:
  - `tests/unit/stickman-renderer.test.ts` 단위 테스트 작성 및 통과
  - 로컬 서버(`npm run dev`)에서 웹캠 자세 변화(팔 들기, 스쿼트, 점프) 실시간 렌더링 검증
- **관련 파일**:
  - `dream_guardian/config/skeleton.config.ts`
  - `dream_guardian/src/skeleton/StickmanRenderer.ts`
  - `dream_guardian/src/skeleton/index.ts`
  - `dream_guardian/src/main.ts`
  - `dream_guardian/src/ui/SettingsModal.ts`
  - `dream_guardian/tests/unit/stickman-renderer.test.ts`

---

### Issue #204: [BEAT-TRACK-001] 음악 트랙별 가변 박자(BPM/LoopPattern) 및 카운트인(Count-in) 연동 아키텍처 구축
- **GitHub URL**: https://github.com/Choyounhwa/-dream-guardian/issues/204
- **Labels**: `feature`, `P1-high`, `phase-6`
- **Milestone**: `v0.5-input-ui`
- **작업 ID**: `[BEAT-TRACK-001]`
- **상태**: ⚪ **대기 (승인 대기)**
- **제목**: 음악 트랙별 가변 박자(BPM/LoopPattern) 및 카운트인(Count-in) 연동 아키텍처 구축
- **목적**:
  - 기존 8+2+8 비트 루프에서 하드코딩된 박자 상수(8, 2, 8) 및 초 단위 고정 설정(0.5s, 1.0s 등)을 음악 트랙 메타데이터(`MusicTrackConfig`) 기반으로 추상화하여, 곡마다 다른 BPM 및 박자 패턴(예: 8+4+8 마디 정렬 등)에 유연하게 대응한다.
  - 또한 #202(프레임 정렬 가이드) 완료 직후 해당 트랙의 BPM에 동기화된 예비박(Count-in 3박자 메트로놈)을 시동하여, 1라운드(8박 러닝/문제)의 첫 다운비트와 1ms 오차 없이 자연스럽게 이어지는 음악적 도입 아키텍처를 확립한다.
- **수정 및 생성 대상**:
  - `dream_guardian/config/beat-motion.config.ts`
  - `dream_guardian/src/types/track.ts` (신규: `MusicTrackConfig`, `LoopPattern`)
  - `dream_guardian/src/core/RhythmEngine.ts`
  - `dream_guardian/src/game/BeatRunCoordinator.ts`
  - `dream_guardian/tests/unit/music-track-config.test.ts` (신규)
- **구현 내용**:
  1. **음악 트랙 메타데이터 인터페이스 정의 (`MusicTrackConfig`)**:
     - `bpm`, `timeSignature: [4, 4]`
     - `intro: { countInBeats: 3, soundType: 'metronome' | 'hihat' | 'voice' }`
     - `loopPattern: { exerciseBeats: number, readyBeats: number, performanceBeats: number }`
     - 챕터별 기본 트랙 프리셋(Ch.1~Ch.5) 정의
  2. **상대 비트 비례 동적 타이밍 산출**:
     - 고정된 초 단위 설정을 `secondsPerBeat * beats` 비례 공식으로 연동.
     - 트랙 BPM 전환 시 `RhythmEngine`의 `secondsPerBeat = 60 / bpm` 및 `secondsPerRound` 자동 재계산.
  3. **`BeatRunCoordinator` 트랙 설정 주입(DI) 구조 전환**:
     - 생성자 옵션으로 `trackConfig?: MusicTrackConfig`를 주입받아 `loopPattern`을 동적으로 적용. (기본값: 기존 8+2+8 패턴 100% 하위 호환)
  4. **카운트인(Count-in) 예비박 제어 지원**:
     - 프레임 정렬 완료 후 본 라운드 진입 전, 트랙 BPM에 동기화된 예비박(Count-in) 진행 상태 및 이벤트 제공.
     - 예비박 종료 즉시 1라운드(`RUN_QUESTION`) 정박 다운비트와 동시 전환.
- **유지 사항**:
  - 기존 8+2+8 비트 루틴 계약 및 전체 테스트 100% 호환성 보존
  - 전투/마나/보스 시스템 및 문제 출제 로직 인터페이스 불변
  - 키보드/마우스 Fallback 조작 유지
- **변경 금지**:
  - `BattleState`, `GuardianSystem`, `BossController` 전투 수치 공식
  - 문제 CSV 파싱 및 안전 수식 평가(`safeEval`) 로직
- **완료 조건**:
  - [ ] 트랙별 BPM(100~140) 변경 시 1박 시간 및 라운드 시간이 정확히 재계산됨
  - [ ] `BeatRunCoordinator`가 트랙별 loopPattern(예: 8+4+8, 8+2+8)을 동적으로 수용함
  - [ ] 카운트인 예비박이 트랙 BPM 주기에 맞춰 정확히 발생하고 완료 즉시 본 라운드로 전이됨
  - [ ] 단위 테스트 100% Pass 및 번들 빌드 정상 완료
- **테스트**:
  - `tests/unit/music-track-config.test.ts` (신규 트랙 설정 및 가변 박자 단위 테스트)
  - `npm test` 전체 회귀 테스트 통과 검증
- **관련 파일**:
  - `dream_guardian/config/beat-motion.config.ts`
  - `dream_guardian/src/types/track.ts`
  - `dream_guardian/src/core/RhythmEngine.ts`
  - `dream_guardian/src/game/BeatRunCoordinator.ts`
  - `dream_guardian/tests/unit/music-track-config.test.ts`

---

### Issue #205: [BUG-BEAT-003] BEAT MOTION 중앙 복귀 게이트/정답존 좌표계 불일치(가상 픽셀 vs 정규화)로 인한 신형 입력 전면 무력화
- **GitHub URL**: https://github.com/Choyounhwa/-dream-guardian/issues/205
- **Labels**: `bug`, `P0-blocker`
- **Milestone**: `v0.5-beat-motion`
- **작업 ID**: `[BUG-BEAT-003]`
- **상태**: 🟢 **완료 (Pass)**
- **제목**: BEAT MOTION 중앙 복귀 게이트/정답존 좌표계 불일치(가상 픽셀 vs 정규화)로 인한 신형 입력 전면 무력화
- **원인 분석**:
  - `main.ts`가 `BeatRunCoordinator.update()`에 가상 해상도 픽셀 좌표(0~1080 / 0~2160)를 전달하고 있었으나, `CenterReturnGate`와 `AnswerZoneSelector`는 정규화 좌표(0~1)를 전제로 임계값을 계산하여 게이트 잠금 실패(`forceFallbackLock` 강제 발동) 및 답안 첫 프레임 좌측 오선택 발생.
  - 또한 가상 해상도 좌표에 카메라 미러링이 이미 적용되어 있어 `AnswerZoneSelector`의 기본 `isMirrored: true` 적용 시 좌우 방향 이중 반전 위험 존재.
- **수정 및 생성 대상**:
  - `dream_guardian/src/utils/index.ts`: 가상 픽셀 좌표를 정규화 좌표(0~1)로 비파괴 변환하는 `toNormalizedLandmarks` 순수 헬퍼 신설.
  - `dream_guardian/src/motion/CenterReturnGate.ts`: `isInsideGate` getter 추가.
  - `dream_guardian/src/main.ts`: `toNormalizedLandmarks`를 적용하여 `beatCoordinator.update()`에 정규화 좌표 전달 및 `new AnswerZoneSelector({ isMirrored: false })` 생성자 주입.
  - `dream_guardian/tests/integration/beat-run-gameplay.test.ts`: 가상 픽셀 직접 전달 결함 재현 및 `toNormalizedLandmarks` 연동 회귀 검증 테스트 추가.
  - `dream_guardian/tests/unit/center-return-gate.test.ts`: 정규화 vs 가상 픽셀 스케일 계약 검증 단위 테스트 추가.
  - `dream_guardian/tests/unit/answer-zone-selector.test.ts`: 정규화 vs 가상 픽셀 및 좌/우 방향성 일치 검증 단위 테스트 추가.
- **완료 조건 검증**:
  - [x] 화면 중앙 정렬 시 `CenterReturnGate.isInsideGate === true`가 되고, 0.4초 안정 후 `status === 'locked'` 전이
  - [x] 정상 추적 환경에서 `reference.isFallback === false`, `source === 'hip'`, `sampleCount >= 5` 잠금
  - [x] `AnswerZoneSelector`가 첫 프레임에 자동 확정되지 않으며 데드존에서 `activeZone === 'none'` 유지
  - [x] 좌/우 이동 방향과 확정된 `confirmedZone` 일치(미러 반전 없음)
  - [x] 가상 픽셀 좌표(1080×2160 스케일) 입력 기반 회귀 테스트 추가 및 통과
  - [x] 레거시 `AnswerSelector` 경로의 기존 동작 보존
  - [x] `npm run build` 및 전체 `npm test` 100% 통과 (48개 파일, 660/660 Pass)

---

### Issue #206: [INTEGRATE-BEAT-001] 완료(CLOSED) 처리된 BEAT/Keynote/Knee 모듈 6종의 main.ts 통합 및 전투 정산 단일화
- **GitHub URL**: https://github.com/Choyounhwa/-dream-guardian/issues/206
- **Labels**: `refactor`, `P0-blocker`
- **Milestone**: `v0.5-beat-motion`
- **작업 ID**: `[INTEGRATE-BEAT-001]`
- **상태**: 🟢 **완료 (Pass)**
- **제목**: 완료(CLOSED) 처리된 BEAT/Keynote/Knee 모듈 6종의 main.ts 통합 및 전투 정산 단일화
- **목적**:
  - Issue #182, #184, #196, #197, #198, #199 미통합 모듈을 `main.ts` 게임 루프에 통합하고, 분열된 전투 정산을 `BeatRoundResolver` 단일 정산으로 일원화.
- **수정 및 생성 대상**:
  - `dream_guardian/src/main.ts`: `BeatRoundResolver`, `KneeFramingValidator`, `KneeFramingGuideRenderer`, `FootKeynoteDetector`, `FootKeynoteInput`, `StarCollectionInput` 통합 연결. `handleAnswer()` 자원 변경 코드 제거 및 연출 전담화.
  - `dream_guardian/src/game/BeatRunCoordinator.ts`: `_resolveRound` 내 `battle` 직접 수정 제거, `status` ('correct' | 'wrong' | 'timeout') 콜백 전달, 키노트 시퀀스 보관/공급.
  - `dream_guardian/src/data/index.ts`: `KeynoteCandidateDeriver` 배럴 export.
  - `dream_guardian/src/ui/ResultRenderer.ts`: `ResultData`에 `rhythmStats` 필드 추가 및 리듬 통계 리포트 반영.
  - `dream_guardian/tests/integration/beat-motion-integration.test.ts`: 신규 통합 테스트 9건.
  - `dream_guardian/tests/integration/beat-run-gameplay.test.ts`, `dream_guardian/tests/unit/beat-routine-controller.test.ts`: 새 정산 계약 동기화.
- **완료 조건 검증**:
  - [x] `BeatRoundResolver`가 `main.ts`에 연결되고, 라운드당 `resolveRound()`가 정확히 1회만 호출됨
  - [x] `BeatRunCoordinator._resolveRound()`에서 `battle.onCorrect/onWrong` 직접 호출 제거
  - [x] `handleAnswer()`에서 전투 자원 변경 코드 제거 및 연출 책임만 남음
  - [x] `resourcesAlreadySettled` 플래그 및 데드코드 분기 제거
  - [x] 정답 1회당 마나 +25, 보스 HP -1이 정확히 1회만 반영됨(중복 정산 0건)
  - [x] 미응답 라운드가 `timeout`으로 분류되어 `wrongAnswerCount`와 분리 집계됨
  - [x] `KneeFramingValidator` 상태가 `degraded`일 때 Pose 기반 foot-keynote 입력 차단
  - [x] `KneeFramingGuideRenderer`가 프레이밍 상태별 오버레이 렌더링
  - [x] Zone 9/10/11 발 키노트 이벤트가 Pose/키보드/가상 페달 경로에서 동일 계약으로 발행됨
  - [x] `KeynoteCandidateDeriver`가 360건 패턴에서 2~8박 후보 파생하여 코디네이터에 공급
  - [x] 리듬 통계(`timeoutCount`, 별 판정)가 결과 화면에 표출됨
  - [x] `npm run build` 및 전체 `npm test` 100% 통과 (49개 파일, 669/669 Pass)

---

### Issue #207: [CLEANUP-LEGACY-001] 레거시 AnswerSelector / 신형 AnswerZoneSelector 이중 답안 판정 정리 및 중복 진입 로직 단일화
- **GitHub URL**: https://github.com/Choyounhwa/-dream-guardian/issues/207
- **Labels**: `refactor`, `P0-blocker`
- **Milestone**: `v0.5-beat-motion`
- **작업 ID**: `[CLEANUP-LEGACY-001]`
- **상태**: 🟢 **완료 (Pass)**
- **제목**: 레거시 AnswerSelector / 신형 AnswerZoneSelector 이중 답안 판정 정리 및 중복 진입 로직 단일화
- **목적**:
  - 사용자 승인 방안 C안(역할 분리 공존)에 따라 동일 프레임 이중 답안 판정 엔진 경합을 해소하고, 1박째 정답 확정과 2~8박 키노트 판정의 역할 경계를 확립.
- **수정 대상**:
  - `dream_guardian/src/game/BeatRunCoordinator.ts`: 1박째 정답 확정 창 제한, `onAnswerSelected` 추가, 2박 진입 시 판정 차단
  - `dream_guardian/src/main.ts`: 레거시 `updateFromPose` 확정 경로 제거, `enterQuestionPhase()` 단일화, 버튼 좌표 단일 소스화, 2~8박 `performanceBeat` 연동
  - `dream_guardian/tests/integration/beat-run-gameplay.test.ts`: 1박째 한정, 2박 차단, fallback 차단, 버튼 좌표 일치 통합 테스트 4건 추가
- **완료 조건 검증**:
  - [x] `KEYNOTE_PERFORMANCE` 1박째에만 정답 확정이 열리고, 2박 진입 시 닫힘
  - [x] 2~8박 키노트 판정이 HP/마나/콤보를 일체 변경하지 않음 (`hasBattlePenalty: false` 보장)
  - [x] 2~8박 키노트 판정 결과가 리듬 통계(Perfect/Good/Late/Miss)에 정상 누적됨
  - [x] 레거시 `AnswerSelector`의 정답 확정 경로가 제거되고, 11존 판정 자산은 키노트에서 재사용됨
  - [x] 동일 프레임 이중 확정 경로가 제거됨
  - [x] 문제 페이즈 진입 로직이 단일 함수로 통합됨
  - [x] 답안 버튼 이펙트가 실제 버튼 위치(#164 좌표)와 일치함
  - [x] 키보드(1, 2) / 마우스 클릭 fallback이 1박째 확정 경로로 정상 동작함
  - [x] `npm run build` 및 전체 `npm test` 100% 통과 (50개 파일, 678/678 Pass)

---

### Issue #208: [CLEANUP-DEAD-001] 폐기된 방어 전투 시스템 잔재 및 미참조 리소스/데드코드 일괄 제거
- **GitHub URL**: https://github.com/Choyounhwa/-dream-guardian/issues/208
- **Labels**: `refactor`, `cleanup`
- **Milestone**: `v0.5-beat-motion`
- **작업 ID**: `[CLEANUP-DEAD-001]`
- **상태**: 🟢 **완료 (Pass)**
- **제목**: 폐기된 방어 전투 시스템 잔재 및 미참조 리소스/데드코드 일괄 제거
- **목적**:
  - #143, #147, #173 등으로 폐기된 방어 전투 시스템 잔재 및 미참조 리소스를 정리하여 아키텍처 안정성 확보.
- **수정 대상**:
  - `SquatDetector.ts` 삭제 및 배럴 정리
  - `BossController` 자동공격 타이머 및 `resolveAttack()` 제거
  - `HUDLayer` 미사용 쉴드/마나 필드 정리
  - `AnswerSelectionRenderer`의 `renderZoneBoxes` 분기 및 `RenderZoneInfo` 인터페이스 제거
  - 미참조 파일 및 중복 CSV/이미지 리소스(약 700KB) 삭제
- **완료 조건 검증**:
  - [x] `SquatDetector` 및 관련 export/테스트 제거 완료
  - [x] `BossController`의 자동공격 타이머 블록과 `resolveAttack()` 제거 완료
  - [x] `HUDLayer` 미사용 필드 제거 완료
  - [x] 미참조 리소스 약 700KB 삭제 및 번들 크기 축소 (206.08 kB → 204.46 kB)
  - [x] 전체 `npm test` 100% 통과 (50개 파일, 674/674 Pass)

---

### Issue #210: [BEAT-KEYNOTE-ENGINE-001] 8박 런 직후 2박 팔 답안 선택 및 정답/오답 즉시 분기 엔진
- **GitHub URL**: https://github.com/Choyounhwa/-dream-guardian/issues/210
- **Labels**: `feature`, `P1-high`, `phase-6`
- **Milestone**: `v0.5-beat-motion`
- **작업 ID**: `[BEAT-KEYNOTE-ENGINE-001]`
- **상태**: 🟢 **완료 (2026-09-30)**
- **제목**: 8박 런 직후 2박 팔 답안 선택 및 정답/오답 즉시 분기 엔진
- **목적**:
  - 런 8박 완료 직후 `ANSWER_SELECT`(최대 2박)로 진입하여 `ArmReachAnswerSelector` 기반 답안 즉시 선택.
  - 답안 선택 즉시 4초 대기 없이 시청각 피드백 출력 후 `STAR_COLLECT`(정답) vs `HAZARD_EVADE`(오답/타임아웃)로 즉각 분기.
- **완료 검증**:
  - [x] 8번째 운동 입력 직후 `ANSWER_SELECT`로 진입하고 답안 버튼이 즉시 표출된다.
  - [x] 답안 입력 창이 최대 2박(1.0초) 동안만 열린다.
  - [x] 한 손이 Zone 4에 있으면 0번, Zone 5에 있으면 1번이 체류 없이 즉시 선택된다.
  - [x] 손을 Zone 4 또는 5에 정지해 둔 상태에서도 첫 프레임에 즉시 선택된다.
  - [x] 양팔 동시 유효 시 미선택 상태를 유지한다.
  - [x] 정답 선택 즉시 정답음/피드백과 함께 `STAR_COLLECT`로 분기한다.
  - [x] 오답 선택 즉시 실패음/피드백과 함께 `HAZARD_EVADE`로 분기한다.
  - [x] 2박 내 미응답 시 `timeout` 처리되며 즉시 `HAZARD_EVADE`로 분기한다.
  - [x] 답안 선택 후 4초 동안 대기하는 현상이 완전히 제거된다.
  - [x] 오답/타임아웃 자체로는 플레이어 HP가 차감되지 않는다.
  - [x] 키보드 1/2 및 마우스/터치 fallback이 유지된다.
  - [x] `ROUND_RESOLVE` 단일 정산이 분기 루틴 완료 후 정확히 1회 실행된다.
  - [x] `npm run build` 및 전체 `npm test` 100% 통과, 회귀 결함 0건 (52개 파일, 714개 통과).

---

### Issue #211: [ROUTINE-SPEC-001] 확정 게임 루틴 전체 계약 정의 및 카드 매핑 (문서 단일 기준점)
- **GitHub URL**: https://github.com/Choyounhwa/-dream-guardian/issues/211
- **Labels**: `docs`, `P1-high`
- **Milestone**: `v0.5-beat-motion`
- **작업 ID**: `[ROUTINE-SPEC-001]`
- **상태**: 🟢 **완료 (2026-09-30)**
- **제목**: 확정 게임 루틴 전체 계약 정의 및 카드 매핑 (문서 단일 기준점)
- **목적**:
  - 사용자 확정 기획 루틴을 단일 계약 문서로 고정하고, 각 구간을 담당하는 작업 카드를 매핑하여 구현 누락 방지.
  - 기존 골반 횡이동 및 오답 보스 직접 반격 계약을 폐기하고, "8박 런 직후 2박 한 팔 Zone 4/5 즉시 선택 및 정답/오답 분기(별모으기 vs 장판회피)" 계약으로 문서를 일원화.
- **완료 검증**:
  - [x] 확정 루틴 전문이 GDD, HANDOVER, WBS, GITHUB_ISSUES에 동일하게 반영된다.
  - [x] 2박 한 팔 Zone 4/5 즉시 선택 계약이 정본 문서에 일관되게 기록된다.
  - [x] 오답/타임아웃 직접 피해 제거 및 Phase A 회피 피해 단일화 계약이 기록된다.
  - [x] 구간별 담당 카드 매핑표가 최신 이슈 번호와 정확히 동기화된다.

---

### Issue #224: [INPUT-ARM-ANSWER-001] Zone 4/5 한 팔 도달 기반 무체류 즉시 답안 선택기(ArmReachAnswerSelector) 구현
- **GitHub URL**: https://github.com/Choyounhwa/-dream-guardian/issues/224
- **Labels**: `feature`, `P1-high`, `phase-3`
- **Milestone**: `v0.5-beat-motion`
- **작업 ID**: `[INPUT-ARM-ANSWER-001]`
- **상태**: 🟢 **완료 (2026-09-30)**
- **제목**: Zone 4/5 한 팔 도달 기반 무체류 즉시 답안 선택기(ArmReachAnswerSelector) 구현
- **목적**:
  - 골반/머리 횡이동을 대체하여 한 팔 Zone 4(0번) 또는 Zone 5(1번) 도달 기반 무체류(0s) 즉시 선택기 구현.
  - 정적 손 위치 즉시 선택 인정, 동적 뻗기(수평 속도 우세) 보조 검증, 양팔 동시 유효 시 미선택.
- **완료 검증**:
  - [x] 한 손이 Zone 4에 정지해 있으면 첫 판정 프레임에 0번이 즉시 선택된다.
  - [x] 한 손이 Zone 5에 정지해 있으면 첫 판정 프레임에 1번이 즉시 선택된다.
  - [x] 한 손이 중앙에서 Zone 4로 뻗으면 0번이 즉시 선택된다.
  - [x] 한 손이 중앙에서 Zone 5로 뻗으면 1번이 즉시 선택된다.
  - [x] 손의 색상 또는 왼손/오른손 구분이 답안 인덱스에 영향을 주지 않는다.
  - [x] 양팔이 동시에 선택 조건을 충족하면 미선택 처리된다 (Strict Mutual Exclusion).
  - [x] 양손이 동일한 존에 위치해도 미선택 처리된다.
  - [x] 수직 점프 동작 중에는 답안이 오선택되지 않는다.
  - [x] 선택 이벤트가 답안 창당 정확히 1회만 발생한다 (Idempotent Trigger).
  - [x] `npm run build` 및 전체 `npm test` 100% 통과 (51개 파일, 701개 통과).

---

### Issue #225: [BATTLE-ANSWER-PENALTY-001] 오답/타임아웃 직접 피해 및 Phase A 보스 반격 제거
- **GitHub URL**: https://github.com/Choyounhwa/-dream-guardian/issues/225
- **Labels**: `feature`, `P1-high`, `phase-5`
- **Milestone**: `v0.5-beat-motion`
- **작업 ID**: `[BATTLE-ANSWER-PENALTY-001]`
- **상태**: 🟢 **완료 (2026-09-30)**
- **제목**: 오답/타임아웃 직접 피해 및 Phase A 보스 반격 제거
- **목적**:
  - 오답/타임아웃 시 플레이어 직접 HP 감소 및 Phase A 보스 직접 반격을 제거.
  - Phase A 플레이어 피해는 오직 HAZARD_EVADE 장판/미니언 회피 실패 시에만 발생하도록 전투 책임 분리.
- **완료 검증**:
  - [x] 오답 선택 직후 플레이어 HP가 감소하지 않는다 (damageTaken = 0).
  - [x] 타임아웃 직후 플레이어 HP가 감소하지 않는다 (damageTaken = 0).
  - [x] 오답/타임아웃 직후 보스가 attacking 상태로 전이되지 않는다.
  - [x] 오답은 wrongAnswerCount, 타임아웃은 timeoutCount에 정상 집계된다.
  - [x] 오답/타임아웃 시 콤보는 0으로 리셋된다.
  - [x] 장판 회피 실패 시에만 applyHazardDamage를 통해 HP가 차감된다.
  - [x] Phase A에서 BossRenderer.triggerAttack이 호출되지 않는다.
  - [x] `npm run build` 및 전체 `npm test` 100% 통과 (51개 파일, 706개 통과).

---

### Issue #226: [CLEANUP-ANSWER-INPUT-001] 골반/머리 기반 AnswerZoneSelector 및 답안 중앙 기준점 연동 제거
- **GitHub URL**: https://github.com/Choyounhwa/-dream-guardian/issues/226
- **Labels**: `refactor`, `cleanup`
- **Milestone**: `v0.5-beat-motion`
- **작업 ID**: `[CLEANUP-ANSWER-INPUT-001]`
- **상태**: 🟢 **완료 (2026-09-30)**
- **제목**: 골반/머리 기반 AnswerZoneSelector 및 답안 중앙 기준점 연동 제거
- **목적**:
  - 신규 팔 선택기(#224) 및 엔진(#210) 적용 후, 더 이상 사용되지 않는 골반 횡이동 선택기 및 중앙 기준점 결합 안전하게 제거.
- **완료 검증**:
  - [x] 프로덕션 코드에서 `AnswerZoneSelector` 참조가 0건이다.
  - [x] `AnswerZoneSelector.ts`, `answer-zone-selector.test.ts` 및 관련 설정이 안전하게 제거된다.
  - [x] `CenterReturnGate`와 답안 선택기 간 `setReference` 결합 제거 (`CenterReturnGate`의 스테이지 프레이밍 기능 보존).
  - [x] 골반 이동 체류 게이지 및 체류 충전음 잔재 정리.
  - [x] `npm run build` 및 전체 `npm test` 100% 통과 (51개 파일, 693개 통과).





















