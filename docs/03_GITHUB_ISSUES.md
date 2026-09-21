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
| `v0.5-input-ui` | Step 10 ~ 11 | 10존 4색 커서 답선택, 제스처 메뉴 입력, HUD, 결과/통계 UI |
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



