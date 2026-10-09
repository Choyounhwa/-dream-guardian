# 🏛️ 통합 모션 리듬 노트 아키텍처 설계서 (v2)
## Unified Motion Rhythm Note Architecture

- **문서 번호**: `DOC-12`
- **최초 작성일**: 2026-10-07 / **개정(v2)**: 2026-10-08 (코드 정합성 검증 결과 반영)
- **관련 이슈**: #192, #227, #284, #316, #424(CLOSED), #425, #426, #427, #429(CLOSED), #473(BUG)
- **트랙 카드**: #474 [MRN-TRACK], 하위 MRN-01~12 = #475~#486
- **적용 레이어**: `types`, `config`, `render`, `game`, `input`(어댑터 연결만), `data`(어댑터만)

---

## 0. 한 문장 요약

> **별모으기·발 스텝·장판 회피·보스 공격/피버는 모두 "소실점에서 날아온 노트가 착지 시점에 지정 부위의 지정 동작을 요구한다"는 하나의 모델이다.**
> 노트를 **① 무엇을/언제/어디서(정의)**, **② 어떻게 판정하는가(인터랙션 규칙)**, **③ 어떻게 보이는가(비주얼 프로필)**의 3축으로 분리하고, 각 축을 독립적으로 확장한다.

---

## 1. 배경 및 현황 진단 (코드 검증 기준, 2026-10-08)

### 1.1 동일 모델의 5중 분산 구현

| 기능 | 정의 데이터 | 판정 | 비행 노트 렌더링 | 원근/스케일 |
|---|---|---|---|---|
| 별모으기 (STAR_COLLECT) | `Keynote`(`beat`), `StarTarget`(`beatIndex`) | `StarNoteScheduler` + `StarCollectionInput.judgeStarTiming` | `StarNoteRenderer` | `projectAlongRail` t², 0.3→**1.2** |
| 발 스텝 (RUN_QUESTION 8박) | `RunningMatViewModel.upcomingCues` | `FootKeynoteInput` 이벤트 | `RunningMatRenderer._renderFlyingStompNotes` | 자체 `pow(p,1.4)`, 0.3→**1.25** |
| 장판 회피 (HAZARD_EVADE) | `PhaseAHazardPattern` | `PhaseAHazardController` (pre-buffer/coyote) | `HazardZoneRenderer` | 자체 `pow(p,1.5)` |
| 보스 장판 (BOSS_CLIMAX) | `BossHazardAttackType` | `BossHazardController` | `BossClimaxRenderer` | 자체 `pow(p,1.4)` |
| 보스 피버 | `Keynote[]` | `BossFeverController` → `StarNoteScheduler` | `StarNoteRenderer` | t² |

### 1.2 확인된 문제

1. **비주얼 파편화**: #429의 원형 어프로치 링은 `StarNoteRenderer`에만 적용됐다. 실제 인게임 발 노트(`RunningMatRenderer`)에는 반영되지 않았다. #429 테스트는 `part: 'foot' as any`로 타입을 우회해 통과한다. `BodyPart`에는 `foot`가 없다.
2. **투영 공식 4중화**: t², p^1.4, p^1.5가 렌더러마다 하드코딩되어 있다. 최대 스케일도 1.2와 1.25로 나뉜다.
3. **착지 좌표 불일치**: 별 노트는 Zone 중심(Zone 9 = x≈0.167, y=0.88)에 착지한다. 발 노트는 판정선(y=0.86, x=`vx ± halfWBottom×0.45`)에 착지한다. 같은 Zone 9라도 착지 지점이 다르다.
4. **타입 제약**: `KeynotePart = 'leftHand'|'rightHand'|'hip'`이라서 발 노트를 데이터로 표현할 수 없다. `FootKeynoteFoot`에는 `centerFoot`가 있지만, 다른 타입에는 대응 값이 없다.
5. **필드 불일치**: `Keynote.beat`와 `StarTarget.beatIndex`가 다르다. 런타임 상태(`resolved`, `isCollected`)가 정의 객체에 섞여 있다.
6. **결과 타입 분산**: `StarCollectionResult`, `PhaseAHazardBeatResult`, `BossHazardResult`가 각각 따로 존재한다.

---

## 2. 설계 원칙

1. **3축 분리 (Definition / Interaction / Visual)**: 새 노트 종류는 축 단위로 추가한다. 비주얼만 바뀌면 config만, 판정 규칙이 새로 생기면 Judge 1개만 추가한다.
2. **정의와 런타임 상태 분리**: `MotionNote`(불변 정의)와 `MotionNoteRuntime`(진행도·판정 결과)을 분리한다. 정의는 data/config에서 오고, 런타임은 game 레이어만 쓴다.
3. **단일 앵커 해석기 (Single Anchor Resolver)**: 렌더러와 판정기가 같은 함수로 착지 좌표를 구한다. 착지 좌표를 두 곳에서 따로 계산하는 것을 금지한다.
4. **기존 레이어 경계 준수**: 새 이벤트 버스를 만들지 않는다. 입력은 기존 `MotionIntentBus`와 커서 존 스냅샷, `FootKeynoteInput`을 그대로 쓴다. game 레이어는 이를 구독만 한다.
5. **무변화 이행 (Zero-Visual-Diff Migration)**: 통합 1차 목표는 **현재 화면과 판정을 그대로 재현**하는 것이다. 스케일 통일이나 공식 조정은 이행이 끝난 뒤 별도 카드에서 config 값만 바꿔 진행한다.
6. **설정·데이터 분리**: 프로필, 타이밍 윈도우, 부위→프로필 기본 매핑은 모두 `config/`에 둔다. 코드에는 하드코딩하지 않는다.

---

## 3. 개념 모델

```text
              ┌──────────── Definition (무엇을·언제·어디서) ────────────┐
 data/config →│ MotionNote { beat, requirements[], interaction, profileId? }│
              └──────────────────────────┬──────────────────────────────┘
                                         │ (Timeline이 BPM으로 landingTime 산출)
                                         ▼
              ┌──── Runtime (game) ────────────────────────────────────┐
              │ MotionNoteTimeline ── InteractionJudge[interaction]       │
              │   └ MotionNoteRuntime { landingTime, state, result }      │
              └───────────┬───────────────────────────┬────────────────┘
                          │ 읽기 전용 스냅샷            │ MotionNoteResult
                          ▼                           ▼
              ┌── Render ─────────────────┐   기존 전투/점수 경로
              │ MotionNoteRenderer          │   (BeatRoundResolver, BattleState)
              │  ├ NoteAnchorResolver (공용) │
              │  ├ NoteProjection (공용)     │
              │  └ Painter Registry          │
              │     ring / body / trail      │
              └─────────────────────────────┘
```

---

## 4. 데이터 계약 (`src/types/motion-note.ts`)

### 4.1 신체 부위

```typescript
import type { BodyPart } from './posture.js';            // 'leftHand'|'rightHand'|'head'|'hip' (커서 보유)

/** 커서가 없는 하체/전신 부위 (판정은 MotionIntent / FootKeynoteEvent 기반) */
export type FloorPart = 'leftFoot' | 'rightFoot' | 'centerFoot' | 'bothFeet' | 'fullBody';

export type MotionPart = BodyPart | FloorPart;
```

- `leftFoot`/`rightFoot`/`centerFoot`는 기존 `FootKeynoteFoot`과 1:1로 대응하며 Zone 9/11/10에 해당한다.
- `hip`은 계속 커서 부위로 쓰며, 기존 `HIP_ZONES = {6,8,9,10,11}`와 Cross-Body 규칙을 **그대로 유지**한다. Zone 9~11은 "발 전용"이 아니다. 같은 존을 골반 커서와 발 스텝이 함께 쓰며, 착지 앵커는 부위별로 달라진다(§6 참조).

### 4.2 노트 정의 (불변)

```typescript
export type MotionInteractionType = 'tap' | 'evade' | 'hold' | 'rub' | 'guard' | 'jump';

/** 단일 부위 요구 조건. 다중 요구 = Double/Triple/Quad 패턴 (fitness pattern.csv 호환) */
export interface PartRequirement {
  readonly part: MotionPart;
  readonly zoneId: number;            // 1~11. 'bothFeet' | 'fullBody'는 대표 존 (예: 10)
}

export interface MotionNote {
  readonly id: string;
  readonly patternId: string;          // 원본 패턴 ID (Keynote/StarTarget 호환)
  readonly beat: number;               // 시퀀스 상대 비트 (1-based). Keynote.beat / StarTarget.beatIndex 통합
  readonly requirements: readonly PartRequirement[];  // 길이 ≥ 1
  readonly interaction: MotionInteractionType;
  readonly profileId?: string;         // 미지정 시 config의 기본 매핑(§7.3)으로 결정
  readonly leadBeats?: number;         // 비행 박 수 override (미지정 시 interaction 기본값)
  readonly holdBeats?: number;         // hold/rub 전용: 착지 후 유지 박 수
  readonly source?: 'star' | 'stomp' | 'hazard' | 'boss' | 'fever';  // 통계·디버그용 출처 태그
}
```

- **`travelDuration`(초)은 삭제한다.** 비행 시간은 `leadBeats × secondsPerBeat`로만 계산한다. 이는 `StarNoteRenderer`의 `beatPreview.leadBeats` 방식과 같다. BPM이 바뀌어도 데이터를 수정할 필요가 없다.
- `instrument`(`hand`/`foot`)는 `requirements[].part`에서 유도하므로 정의에 넣지 않는다. 어댑터에서 손실 없이 변환할 수 있다.

### 4.3 런타임 상태 (game 레이어 소유)

```typescript
export type MotionNoteState = 'pending' | 'inFlight' | 'judging' | 'holding' | 'resolved';
export type MotionRating = 'Perfect' | 'Good' | 'Late' | 'Miss';   // 기존 StarRating과 동일 값

export interface MotionNoteRuntime {
  readonly note: MotionNote;
  readonly landingTime: number;        // 절대 시각(초) = sequenceStart + (beat-1) × spb
  readonly displayStart: number;       // landingTime - leadBeats × spb
  state: MotionNoteState;
  holdProgress?: number;               // 0~1 (hold/rub)
  result?: MotionNoteResult;
}

export interface MotionNoteResult {
  readonly noteId: string;
  readonly interaction: MotionInteractionType;
  readonly rating: MotionRating;
  readonly success: boolean;           // evade: 회피 성공 = true
  readonly timingError: number;        // 초 (+ 늦음 / - 빠름)
  readonly matchedParts: readonly MotionPart[];
}
```

### 4.4 렌더 스냅샷 (render 입력, 읽기 전용)

```typescript
export interface MotionNoteRenderItem {
  readonly id: string;
  readonly requirements: readonly PartRequirement[];
  readonly interaction: MotionInteractionType;
  readonly profileId: string;          // 해석 완료된 값
  readonly progress: number;           // 0(소실점) ~ 1(착지), 착지 후 >1 가능
  readonly timeToLanding: number;      // 초 (펄스 판단용)
  readonly holdProgress?: number;
  readonly outcome?: 'hit' | 'miss';   // 결과 VFX 1회 트리거용
}
```

렌더러는 `MotionNoteRuntime`이나 game 클래스를 직접 import하지 않는다. 오직 이 스냅샷만 받는다.

---

## 5. 인터랙션 규칙 (game 레이어, 전략 패턴)

```typescript
export interface InteractionJudge {
  readonly type: MotionInteractionType;
  /** 매 프레임 호출. 판정이 확정되면 결과 반환, 아니면 null */
  evaluate(rt: MotionNoteRuntime, input: MotionInputSnapshot, now: number): MotionNoteResult | null;
}

/** input 레이어에서 이미 생산 중인 정보를 game이 읽기 전용으로 묶은 것 (신규 버스 아님) */
export interface MotionInputSnapshot {
  readonly cursorZones: Partial<Record<BodyPart, number | null>>;   // 커서별 현재 존
  readonly recentIntents: readonly MotionIntent[];                 // MotionIntentBus 최근 이벤트
  readonly recentFootEvents: readonly FootKeynoteEvent[];          // FootKeynoteInput 최근 이벤트
}
```

| `type` | 의미 | 대상 부위 | 성공 조건 | 기존 대응 |
|---|---|---|---|---|
| `tap` | 별 잡기 / 발판 밟기 | 손·머리·골반·발 | 판정 윈도우 안에 **모든 requirement**의 부위가 해당 존에 진입(또는 FootEvent 발생) | `judgeStarTiming`, `FootKeynoteInput` |
| `evade` | 장판·충격파 회피 | 발·골반·전신 | 착지 시점 ± 윈도우에 해당 부위가 **존 밖에 있음** 또는 지정 intent(`stepLeft`/`stepRight`/`jump`) 발생. pre-buffer와 coyote 규칙 적용 | `PhaseAHazardController`, `BossHazardController` |
| `hold` | 체류 | 손·골반 | tap 성공 후 `holdBeats` 동안 존 유지. 이탈 시 Late/Miss | 신규 |
| `rub` | 문지르기 | 손 | hold 조건 + 존 내 누적 이동량 ≥ 임계치(config) | 신규 |
| `guard` | 방어 | 양손 (다중 requirement) | 착지 윈도우에 모든 requirement를 동시에 충족. 크로스 자세는 **requirement 조합으로 정의**(예: 왼손→Zone 5, 오른손→Zone 4)하고, 조합은 config `guardPoses`에서 관리 | 신규 |
| `jump` | 양발 도약 | `bothFeet` | 착지 시점 ± 윈도우에 `jump` intent 발생, 즉 노트가 도착할 때 **플레이어가 공중에 있음** | `PhaseAHazardPattern 'jump'`, `dual_slam` |

- 타이밍 윈도우는 `config/motion-interaction.config.ts`의 `Record<MotionInteractionType, TimingWindows & Leniency>`에서 관리한다. tap의 기본값은 기존 `DEFAULT_STAR_TIMING_WINDOWS`(0.12/0.25/0.40)를 **참조**하고, evade는 기존 `phase-a-hazard.config` 값을 **참조**한다. 값을 복제하지 않는다.
- 새 판정 규칙은 `InteractionJudge` 구현 1개 + 레지스트리 등록 1줄로 추가한다.

---

## 6. 좌표 통합: `NoteAnchorResolver` (render 레이어, 순수 함수)

```typescript
export type LandingMode = 'zoneCenter' | 'strikeLine';

export interface NoteAnchor { x: number; y: number; radius: number; mode: LandingMode }

resolveAnchor(req: PartRequirement, viewport, zones, floorLayout): NoteAnchor
```

| 부위 | Zone | 착지 모드 | 좌표 |
|---|---|---|---|
| 손·머리·골반 | 1~11 | `zoneCenter` | 존 사각형 중심 (현재 StarNoteRenderer와 동일) |
| `leftFoot`/`centerFoot`/`rightFoot` | 9/10/11 | `strikeLine` | 판정선 y, `vx + {-0.45, 0, +0.45} × halfWBottom` (현재 RunningMatRenderer와 동일) |
| `bothFeet` | 10 | `strikeLine` | 판정선 전폭 (타원 링) |
| `fullBody` | - | `strikeLine` | 판정선 전폭 |

- 판정선 레이아웃(`strikeLineYRatio`, 레인 오프셋 0.45)은 `config/running-mat.config.ts`의 값을 **그대로 참조**한다.
- `RunningMatRenderer`의 레인 앵커 렌더링과 `MotionNoteRenderer`가 같은 resolver를 쓰므로, 노트가 앵커에 정확히 착지하는 것이 보장된다.

---

## 7. 비주얼 프로필 (`config/motion-note-profile.config.ts`)

### 7.1 프로필 구조

```typescript
export interface NoteVisualProfile {
  readonly profileId: string;

  readonly flight: {
    readonly minScale: number;          // 출발 배율
    readonly maxScale: number;          // 착지 배율
    readonly easingExponent: number;    // 원근 가속 지수 (t^n). 기존 값: 별 2.0, 발 1.4, 장판 1.5
  };

  readonly ring: {
    readonly painter: string;           // Ring Painter 레지스트리 키: 'circle'|'rect'|'ellipseWide'|'hexagon'|'spiral'|'image'
    readonly imageKey?: string;         // painter='image'일 때
    readonly color: string | 'byPart';  // 'byPart' → 4색 커서 색상 (#28E6FF/#FFCB4D/#C889FF/#FF865E)
    readonly startScale: number;        // 2.5
    readonly endScale: number;          // 1.0
    readonly strokeWidth: number;
    readonly glowBlur: number;
    readonly alpha: number;
    readonly landingPulse: boolean;     // Perfect 윈도우 진입 시 펄스
  } | null;                              // null = 링 없음

  readonly body: {
    readonly painter: string;           // Body Painter 키: 'orb'|'image'|'symbol'|'hazardSkull'|'shield'
    readonly imageKey?: string;
    readonly symbol?: string;           // 이미지 실패 시 폴백 ('★','♪','⚠','🛡')
    readonly baseRadius: number;
    readonly fillColor: string;
    readonly borderColor: string | 'byPart';
    readonly spinSpeed?: number;
    readonly showLaneLabel?: boolean;   // 발 노트의 L/C/R 표시 (기존 동작 보존)
  };

  readonly trail: { readonly painter: 'beam' | 'gradient' | 'stream' | 'none'; readonly lengthRatio: number; readonly alpha: number };

  /** 상태별 오버레이 (hold 게이지, evade 경고 점멸 등) */
  readonly overlay?: { readonly painter: string; readonly params?: Record<string, number | string> };

  /** 결과 연출은 키만 지정하고, 실제 재생은 EffectManager/SFX가 담당 (렌더러는 직접 재생하지 않음) */
  readonly feedback: { readonly hitVfx: string; readonly missVfx: string; readonly hitSfx?: string; readonly missSfx?: string };
}
```

### 7.2 Painter 레지스트리 (render 레이어)

```typescript
export interface RingPainter  { draw(ctx, anchor: NoteAnchor, scale: number, style, t: number): void }
export interface BodyPainter  { draw(ctx, x: number, y: number, radius: number, style, item): void }
export interface TrailPainter { draw(ctx, from, to, style, scale: number): void }
export interface OverlayPainter { draw(ctx, anchor: NoteAnchor, item: MotionNoteRenderItem, params): void }
```

- **기존 모양의 색·크기·이미지·아이콘 변경**: config만 수정한다(코드 수정 0).
- **새 모양 추가**(예: 육각 방패 링): Painter 1개 + 레지스트리 등록. 렌더러 본체는 수정하지 않는다.
- **이미지 링/바디**: 기존 `StarNoteRenderer`의 이미지 캐시(#424)를 공용 `NoteImageCache`로 옮겨 재사용한다.

### 7.3 기본 프로필과 자동 매핑

| profileId | 용도 | 재현 대상 (무변화 이행) |
|---|---|---|
| `star_hand` | tap × 손/머리/골반 | 현 `StarNoteRenderer` (t², 0.3→1.2, 원형 링, byPart 색) |
| `stomp_foot` | tap × 발 | 현 `_renderFlyingStompNotes` (p^1.4, 0.3→1.25, ♪, L/C/R, 레인 색) |
| `hazard_floor` | evade × 발/전신 | 현 `HazardZoneRenderer` 비행부 (p^1.5) |
| `boss_slam` | jump/evade × bothFeet | 현 `BossClimaxRenderer` 장판부 (p^1.4) |
| `hold_nebula` / `rub_vortex` / `guard_shield` | 확장 | 신규 (Step 5 이후) |

```typescript
// profileId 미지정 노트의 기본 결정 규칙 (config)
export const DEFAULT_PROFILE_MAP: Record<MotionInteractionType, Partial<Record<'hand'|'floor', string>>> = {
  tap:   { hand: 'star_hand', floor: 'stomp_foot' },
  evade: { floor: 'hazard_floor' },
  jump:  { floor: 'boss_slam' },
  hold:  { hand: 'hold_nebula' },
  rub:   { hand: 'rub_vortex' },
  guard: { hand: 'guard_shield' },
};
```

챕터나 보스별 스킨은 `profileId` override 또는 `DEFAULT_PROFILE_MAP`을 챕터별로 교체하는 방식으로 처리한다.

---

## 8. 레이어별 책임 (변경 후)

| 컴포넌트 | 레이어 | 책임 | 하지 않는 것 |
|---|---|---|---|
| `types/motion-note.ts` | types | 계약 정의 | 로직 |
| `config/motion-note-profile.config.ts` | config | 프로필, 기본 매핑 | 드로잉 |
| `config/motion-interaction.config.ts` | config | 인터랙션별 윈도우, 관용, guardPoses, rub 임계치 | 판정 |
| `render/NoteProjection.ts` | render | 진행도, 원근 투영(easingExponent), 어프로치 스케일 순수 함수 (`GridProjection` 확장) | 상태 보관 |
| `render/NoteAnchorResolver.ts` | render | 존/판정선 착지 좌표 | 판정 |
| `render/MotionNoteRenderer.ts` | render | 스냅샷 → Painter 위임 렌더링, 착지 임박 순 정렬 | 판정, 타이밍 계산 |
| `render/note-painters/*` | render | 링, 바디, 트레일, 오버레이 그리기 | 상태 |
| `game/MotionNoteTimeline.ts` | game | 노트 정의 → 런타임 생성, 진행, Judge 호출, 결과 통지, 스냅샷 생성 | 드로잉, 입력 수집 |
| `game/interaction/*Judge.ts` | game | 인터랙션별 판정 | 다른 Judge 참조 |
| `game/adapters/*` | game | 레거시 정의(Keynote, StarTarget, RunningMat cue, Hazard 패턴) → `MotionNote` | 렌더링 |
| `RunningMatRenderer` | render | **바닥 무대만**: 격자, 슬롯, 판정선, 레인 앵커, 화살표, 배너 | 비행 노트 |
| `HazardZoneRenderer` / `BossClimaxRenderer` | render | **무대/보스만**: 장판 경고 영역, 보스, 미니언 | 비행 투사체 |
| `StarNoteScheduler`, `PhaseAHazardController`, `BossHazardController` | game | 이행 기간에는 `MotionNoteTimeline`의 **파사드**로 축소, 공개 API 유지 | - |

**변경 금지(전 이행 기간)**: `config/zone.config.ts`의 존 좌표와 커서 허용 규칙, `MotionIntentBus` 계약, `StateMachine` 상태 및 전환표, 전투 수치(`battle.config`), 기존 `StarRating` 값.

---

## 9. 단계별 이행 로드맵 (카드 단위, 카드당 소스 ≤ 3개, TDD)

> v1의 "Step 1: RunningMatRenderer에 링 공식 복사"는 **폐기**한다. 중복을 늘리기 때문이다. 대신 공용 순수 함수를 먼저 추출한다(MRN-03).

| 카드(가칭) | 내용 | 수정/신규 파일 | 화면 변화 |
|---|---|---|---|
| **MRN-01** | `MotionNote`/`Runtime`/`Result`/`RenderItem` 타입 + 타입 가드(`isFloorPart` 등) | `types/motion-note.ts`, `types/index.ts` | 없음 |
| **MRN-02** | 기본 프로필 4종(현행 재현값) + `DEFAULT_PROFILE_MAP` + `resolveProfile()` | `config/motion-note-profile.config.ts` | 없음 |
| **MRN-03** | `NoteProjection` 추출(`computeFlightProgress`, `projectFlight(easingExponent)`, `computeApproachScale`). `StarNoteRenderer`가 위임하며 기존 테스트 전부 유지 | `render/NoteProjection.ts`, `render/StarNoteRenderer.ts` | 없음 |
| **MRN-04** | `NoteAnchorResolver` (zoneCenter / strikeLine) | `render/NoteAnchorResolver.ts` | 없음 |
| **MRN-05** | `MotionNoteRenderer` + Painter 레지스트리 + `circle`/`rect` 링, `orb`/`image`/`symbol` 바디, `beam`/`gradient` 트레일 (미연결 상태로 단위 테스트) | `render/MotionNoteRenderer.ts`, `render/note-painters/index.ts`, `render/NoteImageCache.ts` | 없음 |
| **MRN-06** | 어댑터: `Keynote`/`StarTarget` → `MotionNote` → `RenderItem` | `game/adapters/starNoteAdapter.ts` | 없음 |
| **MRN-07** | 별모으기, 피버 렌더 경로를 `MotionNoteRenderer`로 전환 (`StarNoteRenderer`는 위임 파사드) | `render/StarNoteRenderer.ts`, `core/AppBootstrap.ts` | **동일**(스냅샷 비교 테스트) |
| **MRN-08** | 발 스텝 cue → `MotionNote` 어댑터 + `_renderFlyingStompNotes` 제거 및 위임 | `game/adapters/stompCueAdapter.ts`, `render/RunningMatRenderer.ts`, `core/AppBootstrap.ts` | **발 노트에 원형 어프로치 링이 처음 적용됨** (#429 미완 부분 해소) |
| **MRN-09** | `MotionNoteTimeline` + `TapJudge`(`judgeStarTiming` 재사용). `StarNoteScheduler`가 내부적으로 위임 | `game/MotionNoteTimeline.ts`, `game/interaction/TapJudge.ts`, `game/StarNoteScheduler.ts` | 없음 |
| **MRN-10** | `EvadeJudge`(pre-buffer/coyote 이식) + Phase A 장판 투사체를 `hazard_floor`로 전환 | `game/interaction/EvadeJudge.ts`, `game/adapters/hazardAdapter.ts`, `render/HazardZoneRenderer.ts` | 동일 |
| **MRN-11** | `JumpJudge` + 보스 장판(`dual_slam`/`alternating_stomp_*`) 전환 | `game/interaction/JumpJudge.ts`, `game/adapters/bossHazardAdapter.ts`, `render/BossClimaxRenderer.ts` | 동일 |
| **MRN-12** | (선택) 스케일/가속 통일: config 값만 변경 | `config/motion-note-profile.config.ts` | 의도적 변경 |
| **MRN-2x** | 확장: `HoldJudge`+`hold_nebula`, `RubJudge`+`rub_vortex`, `GuardJudge`+`guard_shield`+`hexagon` 링. 각각 별도 카드 | Judge 1 + Painter 1 + config | 신규 기믹 |

- 순서 의존성: 01 → 02 → 03 → 04 → 05 → 06 → 07 → 08 (렌더 통합 완료) → 09 → 10 → 11 (판정 통합 완료) → 12/2x.
- MRN-07 이후 각 카드는 **이전 렌더러 결과와 새 렌더러 결과의 ctx 호출 비교 테스트**로 무변화를 증명한다.
- 이행 중 레거시 클래스의 공개 API는 유지한다. 호출부(`AppBootstrap`, `SceneDirector`)는 변경을 최소화한다.

- **GitHub 이슈 번호**: MRN-01 #475, 02 #476, 03 #477, 04 #478, 05 #479, 06 #480, 07 #481, 08 #482, 09 #483, 10 #484, 11 #485, 12 #486 (트랙 #474)

### 9.1 선행 정리 사항
- **BUG #473 [BUG-NOTE-CIRCLE-001]**: HANDOVER의 #429 "발 스텝 동일 효과 완료" 기록이 실제와 맞지 않는다. 실제 발 노트에는 원형 링이 적용되지 않았다. 기록 정정과 `as any` 테스트 정리는 #473에서, 기능 해소는 MRN-08(#482)에서 진행한다.
- #424, #429는 2026-10-08 범위 한정 완료로 CLOSED 처리했다.

---

## 10. 테스트 전략

| 대상 | 핵심 테스트 |
|---|---|
| NoteProjection | easingExponent 2.0/1.4/1.5에서 각각 기존 렌더러 공식과 수치 일치. progress clamp |
| NoteAnchorResolver | 손 Zone 4 → 존 중심, `leftFoot` → 판정선 레인 좌표가 `RunningMatRenderer` 앵커와 일치. `hip` Zone 9 → 존 중심 |
| resolveProfile | profileId override 우선, 미지정 시 (interaction, hand/floor) 매핑, 미등록 ID는 안전 폴백 |
| MotionNoteRenderer | 프로필별 Painter 호출, `ring:null`이면 링 생략, 이미지 실패 시 symbol 폴백, 착지 임박 순 정렬 |
| 각 Judge | Perfect/Good/Late/Miss 경계값, 다중 requirement 동시 충족, evade pre-buffer/coyote, hold 이탈 |
| 어댑터 | `Keynote.beat` ↔ `StarTarget.beatIndex` → `MotionNote.beat` 손실 없는 변환, 발 cue 방향 → `leftFoot`/`rightFoot`/`centerFoot` |
| 회귀 | 기존 `star-note-renderer`, `running-mat-renderer`, `phase-a-hazard`, `boss-*` 테스트 전부 유지 |

---

## 11. 기대 효과와 한계

**기대 효과**
1. 손, 발, 장판, 보스 노트가 **하나의 렌더러, 하나의 투영, 하나의 앵커**를 쓴다. 링이나 이펙트를 한 번 개선하면 모든 노트에 반영된다.
2. 색, 크기, 이미지, 아이콘, 링 형태(기존 painter) 변경은 **config만 수정**하면 된다.
3. 새 기믹 추가 비용이 정해진다. 판정 규칙은 Judge 1개, 새 모양은 Painter 1개, 외형은 프로필 1개다.
4. Double/Triple/Quad 패턴(`fitness pattern.csv`)을 `requirements[]`로 자연스럽게 표현할 수 있다.

**한계 (명시)**
- 완전히 새로운 **모양**이나 **판정 규칙**은 코드(Painter/Judge)를 추가해야 한다. 다만 렌더러와 Timeline 본체는 수정하지 않는다.
- 보스, 미니언, 바닥 무대 연출은 노트가 아니므로 통합 대상에서 제외한다.
- MRN-12 전까지 노트 종류별 비행감(가속 지수, 스케일)은 의도적으로 기존 값을 유지한다.
