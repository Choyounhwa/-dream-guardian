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
- **상태**: ⚪ **대기 (Ready - 승인 대기)**
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
- **상태**: ⚪ **대기 (Ready - 승인 대기)**
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
- **상태**: ⚪ **대기 (Ready - 승인 대기)**
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
- **상태**: ⚪ **대기 (Ready - 승인 대기)**
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
- **상태**: ⚪ **대기 (Ready - 승인 대기)**
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
- **상태**: ⚪ **대기 (Ready - 승인 대기)**
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
- **상태**: ⚪ **대기 (Ready - 승인 대기)**
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
- **상태**: ⚪ **대기 (Ready - 승인 대기)**
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
- **상태**: ⚪ **대기 (Ready - 승인 대기)**
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
- **상태**: ⚪ **대기 (Ready - 승인 대기)**
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
- **상태**: ⚪ **대기 (Ready - 승인 대기)**
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
- **상태**: ⚪ **대기 (Ready - 승인 대기)**
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













