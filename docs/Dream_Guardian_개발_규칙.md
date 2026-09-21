# Dream Guardian — 안정적인 신규 개발 규칙

## 1. 문서 목적

이 문서는 Dream Guardian 웹게임을 기존 게임의 코드를 보존하거나 이전하지 않고, **처음부터 새로 개발하면서 안정성을 확보하기 위한 개발 규칙**이다.

핵심 원칙은 다음과 같다.

1. 작은 단위로 개발한다.
2. 각 기능을 독립적으로 만든다.
3. 데이터와 코드를 분리한다.
4. 설정값과 게임 로직을 분리한다.
5. 작업마다 완료 조건과 테스트 조건을 둔다.
6. 한 작업에서 불필요한 다른 기능을 수정하지 않는다.
7. Git으로 정상 작동 상태를 계속 보존한다.
8. AI에게 작업을 맡길 때도 동일한 규칙을 적용한다.
9. 이슈 카드를 등록할 때는 기존 시스템 로직과의 정합성을 사전 검증하고, 프로젝트 아키텍처 및 코드 구조(모듈/레이어별 책임)에 맞춰 명확히 분리하여 등록
10. 버그 발견 시 작업 순서:
	GitHub Issue 카드 등록 -- 버그 내용, 재현 방법, 원인 분석, 수정 계획 기술,	승인 대기 ,승인받은 범위 내에서만 수정,테스트 → 커밋 → Issue Close
11. main은 항상 실행 가능한 상태를 유지한다
12. 카드작업이 완료 될 때마다 카드에 작업내역을 comment 한다 
13. 승인된 카드 작업이 모두 완료 되면 로컬호스트에서 테스트할수있도록 서버를 가동시킨다.
---

# 2. 전체 개발 순서

```text
프로젝트 초기화
      ↓
폴더/아키텍처 확정
      ↓
게임 코어 구축
      ↓
게임 상태 머신 구축
      ↓
렌더링 기반 구축
      ↓
카메라/스켈레톤 구축
      ↓
동작 인식 구축
      ↓
수학 문제 시스템 구축
      ↓
전투 시스템 구축
      ↓
입력 시스템 구축
      ↓
UI 구축
      ↓
이펙트/비주얼 구축
      ↓
스토리/콘텐츠 구축
      ↓
통합 테스트
      ↓
성능 최적화
      ↓
모바일/브라우저 테스트
      ↓
배포
```

기능을 앞뒤 순서를 무시하고 동시에 크게 만들지 않는다.

---

# 3. 개발 기본 원칙

## 3.1 한 번에 하나의 기능만 개발

한 작업에서 다음과 같이 여러 기능을 동시에 수정하지 않는다.

```text
스켈레톤 수정
+ UI 수정
+ 전투 수정
+ 이펙트 수정
```

대신:

```text
SKEL-001 스켈레톤 관절 렌더링
→ 테스트
→ Git Commit

SKEL-002 스켈레톤 뼈 렌더링
→ 테스트
→ Git Commit

SKEL-003 스켈레톤 호흡 효과
→ 테스트
→ Git Commit
```

처럼 개발한다.

---

## 3.2 수정 범위를 명확하게 한다

모든 작업에는 다음 내용을 포함한다.

```text
작업 목적
수정 대상
변경 사항
유지해야 하는 기능
변경하면 안 되는 기능
완료 조건
테스트 방법
```

---

## 3.3 기존에 정상 작동하는 기능을 임의로 변경하지 않는다

새 기능을 만들면서 기존 기능의 구조나 동작을 필요 이상으로 변경하지 않는다.

변경이 필요한 경우 별도의 작업카드로 분리한다.

---

# 4. 코드 구조 규칙

권장 기본 구조:

```text
project/
│
├─ src/
│  ├─ core/
│  │  ├─ GameEngine.ts
│  │  ├─ StateMachine.ts
│  │  ├─ EventBus.ts
│  │  └─ Config.ts
│  │
│  ├─ render/
│  │  ├─ CanvasManager.ts
│  │  ├─ Camera.ts
│  │  └─ layers/
│  │
│  ├─ motion/
│  │  ├─ PoseManager.ts
│  │  ├─ HandsManager.ts
│  │  ├─ RunDetector.ts
│  │  ├─ SquatDetector.ts
│  │  ├─ JumpDetector.ts
│  │  └─ CalibrationHelper.ts
│  │
│  ├─ skeleton/
│  │  ├─ SkeletonRenderer.ts
│  │  ├─ SkeletonStyle.ts
│  │  ├─ SkeletonAnimation.ts
│  │  ├─ JointRenderer.ts
│  │  ├─ BoneRenderer.ts
│  │  └─ SkeletonEffect.ts
│  │
│  ├─ effects/
│  │  ├─ EffectManager.ts
│  │  ├─ GlowEffect.ts
│  │  ├─ PulseEffect.ts
│  │  ├─ ExpandEffect.ts
│  │  ├─ FadeEffect.ts
│  │  ├─ BurstEffect.ts
│  │  ├─ RadialEffect.ts
│  │  └─ TrailEffect.ts
│  │
│  ├─ input/
│  ├─ game/
│  ├─ question/
│  ├─ ui/
│  ├─ story/
│  ├─ data/
│  ├─ storage/
│  ├─ utils/
│  └─ types/
│
├─ tests/
│  ├─ unit/
│  ├─ integration/
│  └─ e2e/
│
├─ config/
├─ assets/
├─ docs/
├─ index.html
├─ package.json
└─ README.md
```

기능이 커질수록 파일 하나에 여러 시스템을 넣지 않는다.

---

# 5. 게임 코어 규칙

게임 전체를 직접 제어하는 핵심 시스템을 먼저 만든다.

## GameEngine

담당:

- 게임 루프
- requestAnimationFrame
- deltaTime
- pause
- resume
- update
- render

게임의 개별 기능이 직접 게임 루프를 만들지 않는다.

---

## StateMachine

게임 화면과 진행 상태를 명확하게 관리한다.

예:

```text
loading
↓
menu_main
↓
menu_sub
↓
story_intro
↓
ready_position
↓
running
↓
playing
↓
correct / wrong
↓
guardian_cast
↓
result / gameover
↓
ending_cutscene
```

각 상태는 다음 구조를 갖는다.

```text
enter()
update()
render()
exit()
```

허용되지 않은 상태 전환은 차단한다.

---

# 6. 데이터와 코드 분리

게임에서 자주 변경되는 데이터는 코드에 직접 넣지 않는다.

예:

```text
data/
├─ questions.csv
├─ bossData.ts
└─ levelData.ts
```

설정값은 별도로 관리한다.

```text
config/
├─ game.config.ts
├─ motion.config.ts
├─ battle.config.ts
├─ question.config.ts
├─ skeleton.config.ts
└─ effect.config.ts
```

예를 들어:

```text
HP
데미지
마나
보스 HP
동작 판정 임계값
게이지 감소 속도
커서 체류시간
스켈레톤 크기
이펙트 강도
```

등은 가능한 한 설정 파일에서 변경할 수 있도록 한다.

---

# 7. 스켈레톤 개발 규칙

스켈레톤은 게임의 핵심 시스템이므로 독립적으로 개발한다.

구조:

```text
Pose Data
   ↓
SkeletonRenderer
   ↓
JointRenderer / BoneRenderer
   ↓
SkeletonAnimation
   ↓
SkeletonEffect
```

다음 기능을 분리한다.

- 관절 위치
- 뼈 연결
- 크기
- 색상
- 호흡
- 확장/축소
- 반짝임
- 페이드
- 트레일
- 기타 이펙트

스켈레톤의 위치/크기 변경과 시각 효과 변경을 한 코드에서 뒤섞지 않는다.

---

# 8. 이펙트 개발 규칙

이펙트는 게임 로직과 분리한다.

예:

```text
EffectManager
├─ Glow
├─ Pulse
├─ Expand
├─ Fade
├─ Burst
├─ Radial
└─ Trail
```

게임 로직은 이펙트의 내부 구현을 직접 조작하지 않는다.

예:

```text
effects.play("punchBurst")
```

와 같이 요청한다.

이펙트의 수치와 모양은 설정 파일에서 관리한다.

---

# 9. 카메라/동작 인식 개발 순서

카메라 기능을 한꺼번에 완성하지 않는다.

```text
카메라 권한
↓
웹캠 영상 표시
↓
사람 인식
↓
Pose 좌표
↓
스켈레톤 표시
↓
손 추적
↓
기본 동작 판정
↓
달리기
↓
스쿼트
↓
점프
```

각 단계가 안정적으로 작동한 뒤 다음 단계로 넘어간다.

카메라가 실패할 경우를 대비하여 키보드/터치 fallback을 제공한다.

---

# 10. 수학 문제 시스템 규칙

문제 시스템은 게임 로직과 분리한다.

```text
CSV
 ↓
CSVLoader
 ↓
TemplateParser
 ↓
QuestionEngine
 ↓
QuestionEvaluator
 ↓
게임
```

문제 데이터는 CSV 또는 별도의 데이터 파일에서 관리한다.

문제 생성/평가 로직과 화면 표시를 분리한다.

문제 데이터의 오류를 발견하면 코드 수정과 별도의 데이터 수정 작업으로 처리한다.

---

# 11. 전투 시스템 규칙

전투 시스템은 문제 시스템과 분리한다.

```text
정답
 ↓
ComboSystem
 ↓
Mana
 ↓
BattleSystem
 ↓
Damage
 ↓
BossController
```

전투 수치 역시 설정 파일에서 관리한다.

예:

```text
플레이어 HP
오답 데미지
보스 공격 데미지
정답 마나
스펠 데미지
보스 HP
```

---

# 12. UI 개발 규칙

UI는 게임 로직을 직접 계산하지 않는다.

예:

```text
Game State
   ↓
UI
```

UI는 상태를 받아서 표시하는 역할을 중심으로 한다.

메뉴, 게임 HUD, 결과, 게임오버, 일시정지, 기록 화면 등을 독립적으로 관리한다.

---

# 13. 테스트 규칙

테스트를 마지막에 한꺼번에 하지 않는다.

모든 기능은:

```text
개발
 ↓
테스트
 ↓
수정
 ↓
재테스트
 ↓
Git Commit
```

순서로 진행한다.

## Unit Test

계산과 판정 로직을 테스트한다.

예:

```text
점수 계산
데미지 계산
콤보
문제 정답
등급
게이지
동작 판정
```

## Integration Test

시스템 사이의 연결을 테스트한다.

예:

```text
상태 전환
정답 → 마나
마나 → 스킬
스쿼트 → 방어
달리기 → 게이지
```

## E2E Test

실제 게임 진행을 테스트한다.

```text
게임 시작
→ 문제
→ 답 선택
→ 전투
→ 결과
```

---

# 14. 작업카드 작성 규칙

모든 개발 작업은 GitHub Project 작업카드로 만든다.

작업카드 형식:

```text
[작업 ID]

제목:

목적:

수정 대상:

구현 내용:

유지 사항:

변경 금지:

완료 조건:

테스트:

관련 파일:
```

예:

```text
[SKEL-003]

제목:
골반 다이아몬드 렌더링

목적:
골반 위치를 시각적으로 표시한다.

수정 대상:
SkeletonRenderer

구현:
골반 다이아몬드를 렌더링한다.

유지:
기존 관절 위치 계산

변경 금지:
Breathing
Trail
다른 관절

완료 조건:
□ 골반 위치에 표시
□ 지정된 크기
□ 화면 크기 변경 시 정상
□ 다른 관절에 영향 없음

테스트:
Chrome에서 30초 이상 실행
화면 크기 변경
카메라 좌표 변경
```

---

# 15. AI에게 개발을 맡길 때의 규칙

AI에게 큰 단위의 작업을 한 번에 요청하지 않는다.

### 금지

```text
스켈레톤 시스템 전체 만들어줘.
```

### 권장

```text
SkeletonRenderer.ts만 구현한다.

목적:
관절과 뼈를 화면에 표시한다.

구현:
...

변경 금지:
...

완료 조건:
...

테스트:
...

작업이 완료되면 변경한 파일과 테스트 결과를 보고한다.
```

AI는 요청한 범위를 넘어 임의로 다른 파일이나 시스템을 수정하지 않는다.

필요한 추가 변경이 발견되면 먼저 별도의 작업으로 분리한다.

---

# 16. Git 규칙

`main`은 항상 실행 가능한 상태로 유지한다.

권장:

```text
main
 ↓
feature/작업명
 ↓
개발
 ↓
테스트
 ↓
commit
 ↓
main 병합
```

Commit은 하나의 논리적인 작업 단위로 만든다.

좋은 예:

```text
feat: add skeleton renderer
fix: reset marker trail
test: add battle system tests
refactor: separate effect manager
```

나쁜 예:

```text
update
fix
test
final
really-final
final2
```

---

# 17. 완료 기준

작업카드를 DONE으로 옮기는 조건:

```text
□ 구현 완료
□ 콘솔 에러 없음
□ 관련 테스트 통과
□ 기존 기능 정상
□ 의도하지 않은 파일 변경 없음
□ Git commit 완료
```

"화면에서 작동하는 것 같다"만으로 DONE 처리하지 않는다.

---

# 18. 버그 처리 규칙

버그가 발견되면 즉시 작업카드로 만든다.

```text
BUG-001
제목:
스켈레톤 트레일이 계속 누적됨

재현 방법:
1.
2.
3.

현재 결과:

기대 결과:

원인:

수정 파일:

수정 내용:

테스트:
```

버그를 고치는 과정에서 새로운 구조를 크게 변경하지 않는다.

구조 변경이 필요하면 별도의 REFACTOR 작업으로 분리한다.

---

# 19. 개발 단계별 완료 기준

## Phase 0 — 프로젝트 초기화

완료 조건:

```text
□ Git Repository
□ package.json
□ TypeScript
□ Vite
□ ESLint
□ Prettier
□ dev 실행
□ build 성공
□ 기본 테스트 실행
```

---

## Phase 1 — 게임 코어

```text
□ GameEngine
□ StateMachine
□ EventBus
□ Config
□ CanvasManager
□ 기본 렌더링
□ 테스트
```

---

## Phase 2 — 카메라/스켈레톤

```text
□ 카메라
□ Pose
□ 스켈레톤
□ 관절
□ 뼈
□ 크기/좌표
□ 기본 애니메이션
□ 테스트
```

---

## Phase 3 — 동작 인식

```text
□ 손
□ 달리기
□ 스쿼트
□ 점프
□ 보정
□ fallback
□ 테스트
```

---

## Phase 4 — 문제 시스템

```text
□ CSV
□ 템플릿
□ 문제 생성
□ 정답 판정
□ 중복 방지
□ TTS
□ 테스트
```

---

## Phase 5 — 전투

```text
□ HP
□ 마나
□ 데미지
□ 보스
□ 콤보
□ 수호신 성장
□ 테스트
```

---

## Phase 6 — UI

```text
□ 메뉴
□ 서브메뉴
□ HUD
□ 답 선택
□ 결과
□ 게임오버
□ 일시정지
□ 기록
```

---

## Phase 7 — 이펙트/비주얼

```text
□ 이펙트 시스템
□ 스켈레톤 이펙트
□ 보스
□ 수호신
□ 파티클
□ 챕터별 배경
```

---

## Phase 8 — 콘텐츠

```text
□ 5개 챕터
□ 문제 데이터
□ 스토리
□ 수호신 성장
□ 미니언 러시
```

---

## Phase 9 — QA

```text
□ Unit Test
□ Integration Test
□ E2E
□ Chrome
□ Safari
□ Firefox
□ iPhone
□ Android
□ 장시간 실행
□ 메모리 확인
□ 성능 확인
```

---

## Phase 10 — 배포

```text
□ PWA
□ manifest
□ Service Worker
□ HTTPS
□ 카메라 권한
□ GitHub Actions
□ 배포
```

---

# 20. 최우선 개발 원칙

이 프로젝트에서 가장 중요한 규칙은 다음 한 문장으로 정리한다.

> **"작게 만들고, 테스트하고, 커밋한 뒤 다음 기능으로 넘어간다."**

그리고 두 번째 원칙:

> **"기능의 구현과 데이터, 설정, 화면, 이펙트를 가능한 한 분리한다."**

세 번째:

> **"AI가 임의로 범위를 넓히지 못하도록 모든 작업에 명확한 완료 조건을 둔다."**

네 번째:

> **"main은 항상 실행 가능한 상태를 유지한다."**

이 네 가지를 프로젝트 전체의 기본 개발 규칙으로 사용한다.
