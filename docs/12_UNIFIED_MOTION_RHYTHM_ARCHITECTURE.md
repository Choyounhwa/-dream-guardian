# 🏛️ 통합 모션 리듬 파이프라인 아키텍처 설계서
## Unified Motion Rhythm Note Pipeline Architecture

- **문서 번호**: `DOC-12`
- **최초 작성일**: 2026-10-07
- **관련 이슈**: #192, #284, #316, #424, #429
- **적용 레이어**: `render`, `motion`, `game`, `input`, `config`

---

## 1. 개요 및 설계 배경 (Overview & Context)

### 1.1 배경
《꿈의 수호신 (Dream Guardian)》의 모든 핵심 플레이 인터랙션(달리기 중 발 스텝, 문제 정답 후 별모으기, 오답 시 바닥 충격파 회피, 보스 결전 피버타임)은 플레이어 관점에서 본질적으로 **동일한 단일 리듬 모션 인터랙션**입니다.
> **"보스(소실점)에서 박자에 맞춰 투영체가 날아오고, 목표 존/판정선에 도달하는 순간 지정된 신체 부위(손/발/머리/골반/전신)로 적절한 액션을 취한다."**

### 1.2 기존 시스템의 기술 부채 및 분리 원인
초기 프로토타입부터 개별 마일스톤 단위로 기능이 점진 구축되면서 인위적인 시스템 이원화가 발생했습니다:
1. **발 스텝 (`RunningMatRenderer.ts`)**: 링 피트 스타일의 발판 트레드밀 전용으로 먼저 개발되어, 바닥 3개 레인에 날아오는 발 스텝 비행체(`_renderFlyingStompNotes`)를 자체 렌더러 내부에 독자 구현.
2. **별가루 손/골반 노트 (`StarNoteRenderer.ts`)**: 정답 후 댄스 안무 구간 전용으로 개발되어, 11개 피트니스 존 궤적 투영, 원형 어프로치 링, 비트맵 아이콘 렌더링을 독자 구축.
3. **바닥 장판 회피 (`PhaseAHazardController.ts`, `RunningMatRenderer.ts`)**: 위험 회피 전용 컨트롤러가 별도 상태머신(`HAZARD_EVADE`)에서만 활성화.

#### [문제점]
- 동일한 비행 리듬 노트임에도 렌더러가 분리되어 있어, **어프로치 링이나 비주얼 개선을 한쪽에 적용해도 다른 쪽(발 스텝)에는 전혀 반영되지 않는 파편화** 발생.
- 기본 Phase A 안무 데이터(`BEGINNER_PHASE_A_STAR_NOTES`)가 손 전용(Zone 4, 5)으로만 고정되어 있어 기본 별모으기에서 발 스텝이 노출되지 않음.

---

## 2. 핵심 설계 원칙 (Core Principles)

1. **단일 리듬 노트 파이프라인 (Single Note Pipeline)**:
   - 비행 궤적(원근 가속), 스케일링(0.3 → 1.2), 타이밍 윈도우(Perfect/Good/Late), 가이드 링 수축(2.5 → 1.0), 판정 펄스는 부위나 페이즈와 무관하게 **단일 엔진·단일 렌더러**에서 통합 처리한다.
2. **공간 및 좌표계의 단일화 (Spatial Unity)**:
   - 상단/중단(Zone 1~8: 손, 머리, 골반)과 하단(Zone 9~11: 좌/중/우 발 스텝)은 동일한 11개 피트니스 존 좌표계에 완벽히 통합된다.
3. **인터랙션과 비주얼의 전략적 분리 (Strategy Profile Pattern)**:
   - 노트를 구성하는 요소(목표 존, 사용 부위)와 상호작용 규칙(밟기, 피하기, 문지르기, 가드), 그리고 시각적 외형(링 형태, 아이콘, 트레일, 폭발 이펙트)을 독립된 프로필로 분리하여 **무한한 기믹 확장을 보장**한다.

---

## 3. 인터랙션 매트릭스 및 기믹 분류 (Interaction Matrix)

향후 게임 콘텐츠 확장에 대응하기 위해, 노트를 다음 5대 기본 인터랙션 및 확장 기믹으로 분류합니다.

| 인터랙션 타입 (`type`) | 동작 설명 | 적용 신체 부위 | 어프로치 가이드 링 연출 | 노트 본체 / 아이콘 | 성공 판정 조건 |
|---|---|---|---|---|---|
| **`tap` (기본 탭 / 밟기)** | 타이밍에 맞춰 부위로 터치/디딤 | 손, 발, 골반 | **원형 수축 링 (Circle)** (2.5배 → 1.0배) | 골드/시안 별, 발자국(`♪`, `stardust`) | 착지 시점에 해당 존 타격 |
| **`evade` (위험 회피)** | 붉은 위험체/충격파를 피함 | 발, 전신, 골반 | **붉은 네온 경고 링 (Hazard)** (점멸 경고) | 위험 해골, 가시 바닥, 보스 충격파 | 착지 시점에 **해당 존을 벗어남** |
| **`rub` / `hold` (문지르기 / 체류)** | 일정 시간 동안 존에 머무르며 비빔 | 양손, 골반 | **회전 톱니 / 나선형 소용돌이 링** | 회전 은하수, 성운 텍스처, 꼬리 스트림 | 안착 후 **지정 시간 동안 체류 지속** |
| **`guard` (방어 / 가드)** | 투사체 방어를 위해 양팔 크로스 | 양팔 (가슴 Zone 4~5) | **육각형 방패 링 (Hex Barrier)** | 수호신 방패, 에너지 실드 | 착지 시점에 **가슴 크로스 자세 유지** |
| **`jump` (양발 도약)** | 바닥 전체 공격을 점프로 회피/발판 동시 착지 | 양발 (Zone 9~11 전체) | **바닥 전폭 동시 수축 타원 링** | 점프 화살표, 도약 스프링 | 착지 시점에 **양발 공중 체류** |

---

## 4. 통합 인터페이스 및 자료구조 설계 (Data Contracts)

### 4.1 통합 노트 엔티티 (`MotionNote`)
```typescript
export type MotionInteractionType = 'tap' | 'evade' | 'rub' | 'guard' | 'jump';
export type MotionBodyPart = 'leftHand' | 'rightHand' | 'head' | 'hip' | 'leftFoot' | 'rightFoot' | 'bothFeet' | 'fullBody';

export interface MotionNote {
  readonly id: string;
  readonly beat: number;              // 시퀀스 내 비트 인덱스
  readonly landingTime: number;       // 정확한 안착 시점 (초)
  readonly travelDuration: number;    // 비행 소요 시간 (초, 기본 0.5s = 1박)
  readonly zoneId: number;            // 목표 피트니스 존 (1 ~ 11)
  readonly part: MotionBodyPart;      // 요구 신체 부위
  readonly interaction: MotionInteractionType; // 동작 유형
  readonly profileId: string;         // 적용할 시각 프로필 ID (예: 'gold_star', 'neon_foot', 'hazard_shockwave')
  
  // 지속성 인터랙션 파라미터 (문지르기/체류 전용)
  readonly holdDuration?: number;     // 체류 지속 시간 (초, rub/hold 전용)
}
```

### 4.2 비주얼 프로필 (`NoteVisualProfile`)
링 형태, 비행체, 궤적, 이펙트를 모듈화하여 자유롭게 조합합니다.
```typescript
export interface NoteVisualProfile {
  readonly profileId: string;
  
  // 1. 어프로치 가이드 링 (Approach Ring)
  readonly ring: {
    readonly shape: 'circle' | 'rect' | 'hexagon' | 'custom_image';
    readonly customImage?: string;        // 방패 링, 불꽃 링 등 커스텀 이미지
    readonly color: string;
    readonly maxScale: number;            // 출현 시작 배율 (기본 2.5)
    readonly minScale: number;            // 안착 배율 (기본 1.0)
    readonly strokeWidth: number;
    readonly glowBlur: number;
    readonly showPulseOnLanding: boolean; // 안착 직전 펄스 발광 여부
    readonly pulseColor?: string;
  };
  
  // 2. 날아오는 노트 본체 (Note Body)
  readonly body: {
    readonly renderMode: 'image' | 'procedural' | 'symbol';
    readonly imageSrc?: string;           // 비트맵 이미지 경로
    readonly symbol?: string;             // 유니코드 텍스트 폴백 ('★', '♪', '🛡️')
    readonly baseRadius: number;
    readonly fillColor: string;
    readonly borderColor: string;
    readonly spinSpeed?: number;          // 회전 애니메이션 속도 (rad/s)
  };
  
  // 3. 비행 궤적 라이트 빔 (Trail Beam)
  readonly trail: {
    readonly type: 'beam' | 'stream' | 'none';
    readonly color?: string;
    readonly lengthRatio: number;         // 소실점 연결 길이 비율 (0.0 ~ 1.0)
    readonly alpha: number;
  };
  
  // 4. 판정 성공/실패 시 이펙트 (Hit VFX)
  readonly vfx: {
    readonly hitPreset: string;           // Particle preset (예: 'stardustBurst', 'shieldDeflect')
    readonly missPreset: string;          // Particle preset (예: 'wrongFlash', 'hazardHit')
    readonly soundPreset: string;         // SFX key
  };
}
```

---

## 5. 레이어별 단일 책임 재정의 (System Responsibilities)

| 컴포넌트 | 변경 전 (레거시) | 변경 후 (통합 파이프라인) |
|---|---|---|
| **`RunningMatRenderer`** | 바닥 배경 + 발 스텝 비행체 직접 드로잉 (이원화) | **순수 바닥 무대 전담**: 트레드밀 원근 격자, 슬롯 홈, 판정선만 렌더링. 비행체 드로잉 완전 제거. |
| **`StarNoteRenderer`**<br>→ **`MotionNoteRenderer`** | 별모으기 전용 손/골반 비행 노트 드로잉 | **통합 리듬 노트 전담**: 손, 발, 머리, 바닥 장판, 보스 투사체 등 화면상의 모든 3D 원근 비행 노트를 프로필 기반 단독 렌더링. |
| **`Input / Scheduler`** | `StarNoteScheduler`, `FootKeynoteInput` 분리 처리 | **`MotionNoteScheduler` 단일 이벤트 버스**: 판정선 도달 시점의 모션(손 위치, 발 디딤, 점프 상태)과 노트를 1:1 매칭 판정. |

---

## 6. 단계별 이행 로드맵 (Migration Roadmap)

기존 main 브랜치의 안정성과 테스트 100% 통과를 유지하며 점진적으로 마이그레이션합니다.

```text
[Step 1: 즉시 시각 동기화]
  RunningMatRenderer의 발 스텝 드로잉에 StarNoteRenderer와 동일한
  원형 어프로치 링 수식 즉시 적용 (인게임 즉각 체감)
      ↓
[Step 2: 통합 데이터 계약 구축]
  types/motion-note.ts에 MotionNote 및 NoteVisualProfile 정의
  기본 프로필 4종 (tap_hand_star, tap_foot_step, evade_hazard, guard_shield) 등록
      ↓
[Step 3: MotionNoteRenderer 구축 및 위임]
  MotionNoteRenderer 구현 (단위 테스트 100% 검증)
  RunningMatRenderer 및 StarNoteRenderer의 비행 드로잉을 통합 렌더러로 위임
      ↓
[Step 4: 신규 인터랙션 확장]
  rub(문지르기/체류), guard(방어 가드), jump(양발 도약) 모션 판정기 및 비주얼 프로필 연동
```

---

## 7. 기대 효과

1. **시각적 일관성**: 손이든 발이든 모든 리듬 타겟에 정확히 동일한 품질의 원형 어프로치 링과 네온 펄스 효과가 제공됩니다.
2. **코드 중복 0건**: 러닝 매트와 별모으기 사이에 중복되던 궤적 계산 및 비행 투영 코드가 하나로 통합됩니다.
3. **콘텐츠 확장성 극대화**: 향후 보스 방어전(가드), 은하수 문지르기(체류), 복합 콤보 등 새로운 패턴 추가 시 렌더러 수정 없이 **시각 프로필(JSON/Config)**만 추가하여 즉시 게임에 적용할 수 있습니다.
