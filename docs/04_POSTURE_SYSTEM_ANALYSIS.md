# 자세 선택 시스템(스켈레톤 커서 / 피트니스 존 / 답안) 원인 분석 및 재설계안

> 작성 목적: 스켈레톤 커서·피트니스 존·정답 선택이 의도대로 동작하지 않는 근본 원인을 데이터 구조 관점에서 규명하고, AI 에이전트가 바로 실행할 수 있는 수준의 설계안과 작업 카드를 제시한다.
>
> 이 문서는 **분석/설계 문서**이며, 구현은 개발 규칙 9·10항에 따라 GitHub Issue 카드 등록 및 승인 후 진행한다.
>
> 관련 문서: `docs/01_GAME_DESIGN_DOCUMENT.md`, `docs/Dream_Guardian_개발_규칙.md`, `AGENTS.md`

---

## 0. 확정된 기획 결정 사항

본 분석 과정에서 다음 3건이 확정되었다.

| # | 항목 | 결정 |
|---|---|---|
| D-1 | 산출물 형태 | 본 분석 문서(`docs/04_POSTURE_SYSTEM_ANALYSIS.md`)로 저장. 구현은 별도 카드 승인 후 |
| D-2 | 존 레이아웃 | **재정의안 적용** — 존 간 겹침 제거 + 답안 밴드 영역 예약 (§5.6) |
| D-3 | 보라 `#C889FF` 커서 정의 | **머리/얼굴(head)로 확정.** GDD의 "어깨" 표기를 갱신한다. `shoulder` 타입은 레거시로 폐기 대상 |

D-3 근거: 어깨는 카메라 기준 독립 이동폭이 작아 커서 조작 대상으로 부적합하다. 반면 머리는 목 좌우 굽히기·기울이기 등 스트레칭 동작과 직결되어 "공부+운동" 목표에 부합한다.

---

## 1. 목표 정의 (사용자 요구 흐름)

### 1.1 용어

| 용어 | 정의 |
|---|---|
| 스켈레톤 커서 | 신체 부위별 화면 커서. 부위마다 **색상과 아이콘이 다르다** |
| 피트니스 존 | 화면을 나눈 구역. 문제마다 **1~3개**가 활성화된다 |
| 답안(정답지) | 출제된 문제의 정답/오답 선택지. **존 4·5 아래**에 표시된다 |

### 1.2 게임 루프

```
에너지(마나) 충전 완료
        ↓
문제 출제 + 답안 2개 표시
        ↓
각 답안이 1~3개 신체 부위를 요구 (좌/우 답안은 서로 다른 부위 구성)
        ↓
피트니스 존 1~3개 동시 활성화
        ↓
플레이어가 정답이라 판단한 답안의 요구 부위 커서를 활성 존에 배치
        ↓
약 1초 유지 → 답안 확정 → 정답/오답 판정
```

### 1.3 부위 수 × 존 수 조합 명세

| 요구 부위 수 | 활성 존 수 | 플레이어 동작 | 사용자 예시 원문 |
|---|---|---|---|
| 1 | 1 | 해당 부위 커서를 존에 올린다 | "오른손, 머리 중 답이라고 생각되는 색에 맞는 커서를 활성화된 존에" |
| 2 | 1 | 두 부위를 **같은 존**에 올린다 | "존1 = 양손을 모두 존에 올려놓는다" |
| 2 | 2 | 두 부위를 **각 존에 1개씩** (좌우 배치 자유) | "존2 = 각 존에 왼손 오른손을 각 존에 혹은 오른손 머리를" |
| 3 | 1 | 세 부위를 **모두 한 존**에 | "존1 = 양손머리를 모두 한 존에 / 골반,양손을 한 존에" |
| 3 | 2 | 세 부위를 2개 존에 **2+1 분배** | "존2 = 양손머리를 모두 각 존에 / 골반,양손을 각 존에" |
| 3 | 3 | 세 부위를 **각 존에 1개씩** | "존3 = 양손머리를 모두 각 존에 / 골반,양손을 각 존에" |

### 1.4 명시적 제약

- **머리와 골반이 동일한 존을 요구하는 조합은 배제한다.** (원문: "머리와 골반이 같이 존1이 되는 경우는 제외")
- 좌·우 답안의 부위 구성은 서로 다르게 출제된다.

### 1.5 달성 목표

1. **직관성** — 답안을 보는 순간 어떤 부위 커서를 옮겨야 할지 즉시 판단 가능해야 한다.
2. **운동성** — 공부와 운동(국민체조, 스트레칭)을 함께 수행하는 게임이어야 한다.
3. **아이콘 구분** — 손 / 머리 / 골반이 각기 다른 아이콘을 가져야 한다.

---

## 2. 현재 구현 실태

### 2.1 커서 정의

`dream_guardian/src/input/AnswerSelector.ts:33-42`

```ts
export type CursorType = 'leftHand' | 'rightHand' | 'head' | 'shoulder' | 'hip';

export const CURSOR_COLORS: Record<CursorType, string> = {
  leftHand:  '#28E6FF',  // 시안
  rightHand: '#FFCB4D',  // 노랑
  head:      '#C889FF',  // 보라
  shoulder:  '#C889FF',  // 레거시 (CursorTracker가 생성하지 않음)
  hip:       '#FF865E',  // 주황
};
```

랜드마크 소스 (`src/input/CursorTracker.ts`)

| 커서 | 소스 | 라인 |
|---|---|---|
| head | Pose #0 (코) | `:58-68` |
| hip | Pose #23·#24 중점 | `:71-90` |
| leftHand | Hands 손바닥 → Pose #15 손목 폴백 | `:93-113` |
| rightHand | Hands 손바닥 → Pose #16 손목 폴백 | `:116-136` |

### 2.2 존 정의

`src/input/AnswerSelector.ts:22-56`

```ts
export interface FitnessZone {
  id: number; label: string;
  x: number; y: number; width: number; height: number;  // 화면 정규화 0~1
}
```

| id | label | x 범위 | y 범위 |
|---|---|---|---|
| 1 | 좌상 | 0.05–0.33 | 0.05–0.30 |
| 2 | 상단 | 0.36–0.64 | 0.05–0.30 |
| 3 | 우상 | 0.67–0.95 | 0.05–0.30 |
| 4 | 좌 | 0.05–0.33 | 0.33–0.58 |
| 5 | 우 | 0.67–0.95 | 0.33–0.58 |
| 6 | 좌하 | 0.05–0.33 | 0.55–0.75 |
| 7 | 중하 | 0.36–0.64 | 0.55–0.75 |
| 8 | 우하 | 0.67–0.95 | 0.55–0.75 |
| 9 | 좌저 | 0.05–0.33 | 0.78–0.98 |
| 10 | 하단 | 0.36–0.64 | 0.78–0.98 |

부위별 허용 존 (`:59-63`)

```ts
export const HEAD_ZONES     = new Set([1, 2, 3, 4, 5, 7]);
export const SHOULDER_ZONES = new Set([4, 5, 6, 7, 8]);  // 레거시
export const HIP_ZONES      = new Set([6, 7, 8, 9, 10]);
// 손은 제한 없음
```

### 2.3 답안 레시피

`src/input/RecipeGenerator.ts:22-32`

```ts
export interface ChoiceRecipe {
  choiceIndex: number;            // 0(좌) | 1(우)
  requiredCursors: CursorType[];
  targetZoneIds: number[];        // requiredCursors와 인덱스 병렬 대응
}
export interface QuestionRecipePlan {
  tier: TierInfo;
  activeZones: FitnessZone[];
  choices: [ChoiceRecipe, ChoiceRecipe];
}
```

Tier별 하드코딩 매핑 (`:40-116`)

| Tier | 문제 번호 | 선택지 0 | 선택지 1 | activeZones | 조합 크기 |
|---|---|---|---|---|---|
| 1 | 1–3 | leftHand→4 | rightHand→5 | 4, 5 | 1+1 |
| 2 | 4–7 | head→1 또는 leftHand→1 | rightHand→3 또는 head→3 | 1, 3 | 1+1 |
| 3 | 8–11 | leftHand+hip→4,7 | rightHand+head→5,7 | 4, 5, 7 | 2+2 |
| 4 | 12+ | leftHand→1 | rightHand→3 | 1, 3, **2** | 1+1 |

### 2.4 판정 로직

`src/input/AnswerSelector.ts:207-282`

```ts
// 조합 AND 판정 — 커서 개수에 대해 일반화되어 있음
const checkChoiceMet = (recipeIdx: number) => {
  const recipe = plan.choices[recipeIdx];
  let totalWeight = 0;
  for (let i = 0; i < recipe.requiredCursors.length; i++) {
    const cPos = cursors.get(recipe.requiredCursors[i]);
    const zone = FITNESS_ZONES.find(z => z.id === recipe.targetZoneIds[i]);
    if (!cPos || !zone) return { met: false, avgWeight: 0 };
    if (/* AABB 내부 */) totalWeight += dist < 0.5 ? centerWeight : edgeWeight;
    else return { met: false, avgWeight: 0 };
  }
  return { met: true, avgWeight: totalWeight / recipe.requiredCursors.length };
};
```

체류 누적 (`:244-282`)

```
양쪽 동시 충족 → Deadlock Guard: 양쪽 dt*3 감쇠, 확정 없음
한쪽만 충족   → 해당 슬롯 += (dt / dwellTime) * avgWeight, 반대쪽 dt*2 감쇠
              → 1.0 도달 시 { confirmedIndex } 반환
둘 다 미충족  → 양쪽 dt*2 감쇠
```

체류 시간은 Tier별 가변: **0.7 / 0.8 / 1.0 / 1.2초** (`:86,92,97,102`)

### 2.5 렌더링

`src/render/AnswerSelectionRenderer.ts`

| 커서 | 현재 표현 | 라인 |
|---|---|---|
| leftHand / rightHand | 원(r=18) + 맥동 링, 텍스트 `'L'` / `'R'` | `:105-126` |
| head | 타원(22×28), 텍스트 `'HEAD'` | `:127-141` |
| hip | 역삼각형(48×32), 텍스트 `'HIP'` | `:142-160` |

답안 버튼 (`src/main.ts:279-304`): 좌·우 모두 단색 `#FFCB4D`, 요구 부위 표시 없음, 위치 `y ≈ 0.38h + 80`.

---

## 3. 요구 vs 구현 대조표

| 요구 사항 | 현재 상태 | 판정 |
|---|---|---|
| 답안이 1~3개 부위 요구 | 타입은 `CursorType[]`(N개) — 생성기는 1~2개만, **3부위 레시피 0건** | 부분 |
| 좌우 다른 부위 구성 | Tier별 하드코딩 4분기만 존재 | 미달 |
| 활성 존 1~3개 | 타입은 N개. Tier 3/4에서 3개 생성되나 렌더러가 `choiceProgress[i % 2]` 오매핑 | 버그 |
| **여러 부위를 한 존에** | `requiredCursors[i] ↔ targetZoneIds[i]` 1:1 고정 페어링 → **표현 불가** | 미달 |
| **부위를 활성 존에 자유 배치** | 왼손은 지정된 단일 존에서만 인정 → **불가** | 미달 |
| 머리·골반 동일 존 배제 | Tier 3이 양 선택지 모두 존 7 타겟 (head·hip 충돌) | **위반** |
| 답안 직관성 | 버튼 단색, 요구 부위 미표시. `RenderZoneInfo.requiredCursors` 정의만 존재·미사용 | 미달 |
| 손/머리/골반 다른 아이콘 | `'L'` `'R'` `'HEAD'` `'HIP'` 영문 텍스트 | 미달 |
| 답안이 존 4·5 아래 | `y ≈ 0.38h+80` → 존 4·5(y 0.33–0.58) **내부 겹침** | 미달 |
| 국민체조/스트레칭 연계 | 존 좌표·조합에 운동 동작 근거 없음, 동작 메타데이터 부재 | 미달 |

---

## 4. 원인 분석

### RC-1 ★★★ 부위↔존 결합이 "고정 인덱스 페어링"

```ts
// RecipeGenerator.ts:97
{ requiredCursors: ['leftHand', 'hip'], targetZoneIds: [4, 7] }
// leftHand는 존4에만, hip은 존7에만 유효. 서로 바꿔 놓으면 실패.
```

요구 규칙은 **"요구 부위 집합이 활성 존 집합을 덮으면 정답"**(배치 자유)이다. 두 배열을 인덱스로 짝짓는 순간 §1.3의 다음 케이스가 **표현 자체로 불가능**해진다.

- 2부위 → 1존 (양손을 한 존에)
- 3부위 → 1존 / 2존 (묶음 배치)
- 2부위 → 2존의 좌우 교환 허용

**이것이 최상위 근본 원인이다.**

### RC-2 ★★★ 답안 UI에 부위 정보가 전무

- `RenderZoneInfo.requiredCursors`(`AnswerSelectionRenderer.ts:16`)는 **정의만 있고 `render()` 시그니처가 받지 않는다**(`:29-36`).
- 답안 버튼은 좌·우 모두 노랑 단색이라 "왼쪽=시안 왼손 / 오른쪽=노랑 오른손" 대응이 화면에 없다.
- 존 내부에도 어떤 부위를 받는지 표시가 없다.

판정 로직이 정확하더라도 플레이어가 무엇을 해야 할지 알 수 없다. **직관성 목표 미달의 직접 원인.**

### RC-3 ★★★ 절대 좌표 존 → 직립만으로 조건 충족

존 좌표가 화면 정규화 절대값이다. MediaPipe 기준 직립 자세에서:

- 코(head) y ≈ 0.10–0.20 → **존 2(y 0.05–0.30) 이미 내부**
- 골반(hip) y ≈ 0.55–0.65 → **존 7(y 0.55–0.75) 이미 내부**

따라서 Tier 3의 "미니 스쿼트로 골반을 존 7에" 요구가 **스쿼트 없이 자동 충족**된다. 카메라 거리·신장·거치 각도에 따라 결과가 사람마다 달라지는 현상도 동일 원인이다. 캘리브레이션 기준 상대 좌표 개념이 없다.

### RC-4 ★★ 활성 존 집합이 파생값 — 존 개수를 제어 불가

`activeZones`는 두 선택지 `targetZoneIds`의 합집합으로만 결정된다. "부위 3개 / 활성 존 1개" 같은 조합을 **선언할 수단이 없다**. §1.3의 (부위 수 × 존 수) 매트릭스가 데이터로 존재하지 않는다.

### RC-5 ★★ 진행도 자료구조가 2슬롯뿐

`_choiceProgress: [number, number]`만 존재하여:

- `AnswerSelectionRenderer.ts:61` — 존 3개일 때 `choiceProgress[i % 2]`로 3번째 존이 1번 존 진행도를 재사용
- `AnswerSelectionRenderer.ts:43` — 모든 커서에 `Math.max(p0, p1)` 공통 전달 → 왼손만 충전 중인데 머리·골반·오른손 커서 전부 충전 아크 표시

"어느 부위가 들어갔고 어느 존이 아직 비었는지" 피드백이 원천적으로 불가능하다.

### RC-6 ★★ 인체 도달 가능성(reachability) 제약 데이터 부재

- `HEAD_ZONES ∩ HIP_ZONES = {7}`. Tier 3은 양 선택지 모두 존 7을 타겟(`:97-98`)하여 §1.4 배제 규칙을 **정면 위반**한다.
- Deadlock Guard(`AnswerSelector.ts:248`)가 양쪽 동시 충족 시 진행도를 깎으므로, 존 공유 설계에서 **충전이 계속 리셋되는 증상**이 발생한다.
- 부위 간 물리적 상하 관계(머리가 골반보다 위) 검증 규칙이 없다.

### RC-7 ★ 판정 경로 이중화 (죽은 코드)

`AnswerSelector`에 상태를 공유하지 않는 판정 경로가 2개 병존한다.

| | 경로 A `update()` `:309-378` | 경로 B `updateFromPose()` `:194-282` |
|---|---|---|
| 상태 | `_progress: Map<"zoneId-cursorType", number>` | `_choiceProgress: [number, number]` |
| 조합 판정 | 불가 (단일 커서) | 가능 (N-AND) |
| 부위별 존 제한 검사 | **있음** | **없음** |
| `main.ts` 사용 | 미사용 | **실게임 경로** (`main.ts:480`) |
| 테스트 | `input-system.test.ts` 약 7건 | `cursor-tracker-recipe.test.ts` |

실게임에서는 `HEAD_ZONES`/`HIP_ZONES` 제약이 **전혀 검증되지 않는다**. `getProgress()`도 실게임 중 항상 0을 반환한다.

### RC-8 ★ 설정 외부화 미비 (개발 규칙 6절 위반)

`config/` 디렉터리가 **존재하지 않는다**. 프로젝트 전체에 `*.config.ts`는 `vite.config.ts` 하나뿐이며, 모든 설정이 `src/core/Config.ts` 단일 객체에 있다.

하드코딩 목록:

| 값 | 위치 |
|---|---|
| `FITNESS_ZONES` 10개 좌표 | `AnswerSelector.ts:45-56` |
| `CURSOR_COLORS` | `AnswerSelector.ts:36-42` |
| `HEAD_ZONES`/`SHOULDER_ZONES`/`HIP_ZONES` | `AnswerSelector.ts:59-63` |
| Tier 경계 문제번호 (4/8/12) | `AnswerSelector.ts:90,95,100` |
| Tier 체류시간 (0.7/0.8/1.0/1.2) | `AnswerSelector.ts:86,92,97,102,107` |
| 감쇠 계수 `dt*3`, `dt*2` | `AnswerSelector.ts:249-250,257,269,279-280` |
| `CONFIDENCE_THRESHOLD = 0.45` | `CursorTracker.ts:30` |
| 커서 도형 크기 (r=18, 22×28, 48×32, 아크 r=32) | `AnswerSelectionRenderer.ts:107,133,148-150,167` |
| Tier별 레시피 존 id | `RecipeGenerator.ts:46-113` |

플레이테스트 기반 감도 튜닝이 불가능하다. `Config.ts`의 `input.dwellTime: 1.0`은 생성자 기본값으로만 쓰이고 `setQuestion()`이 Tier 값으로 즉시 덮어써 **실질적으로 무의미**하다 (`:298`).

### RC-9 ★ 존 레이아웃 자체 결함

- 존 4·5(y 0.33–0.58)와 존 6·7·8(y 0.55–0.75)이 **y 0.55–0.58에서 겹친다**.
- 답안/문제 텍스트 영역이 예약되어 있지 않아 존 4·5·7과 충돌한다.
- Tier 4의 존 2는 어떤 선택지도 요구하지 않는 **장식 존**이다 (`:110-113`).
- 중앙 중단(y 0.33–0.58 중앙)에 존이 없어 3×3 그리드가 아니다 — 의도는 몸통 회피로 추정되나 문서화되어 있지 않다.

### 원인 요약

| 목표 | 차단 원인 |
|---|---|
| 1~3부위 × 1~3존 자유 조합 | RC-1, RC-4 |
| 직관적 판단 | RC-2, RC-5, 아이콘 부재 |
| 실제 운동 유발 | RC-3, RC-6, 패턴 데이터 부재 |
| 안정적 판정 | RC-6, RC-7, RC-9 |
| 튜닝 가능성 | RC-8 |

---

## 5. 재설계안

### 5.1 핵심: 판정 규칙을 "집합 덮기(Set Coverage)"로 교체

고정 페어링을 폐기하고 다음 술어로 대체한다.

```
matched(P, Z) ⟺
  (A) ∀ p ∈ P : ∃ z ∈ Z,  inside(p, z)     // 모든 요구 부위가 어떤 활성 존 안에 있다
  (B) ∀ z ∈ Z : ∃ p ∈ P,  inside(p, z)     // 모든 활성 존이 최소 1개 부위로 덮인다
```

- 조합 탐색(이분 매칭) 불필요. 부위 순회 1패스 + 존 순회 1패스 = **O(|P|×|Z|)**, 최대 3×3.
- 조건 (B)가 **존 개수를 의미 있게** 만든다. (B)가 없으면 "3부위를 모두 한 존에" 와 "3존에 분산"이 구분되지 않는다.

검증: §1.3 전 케이스 성립

| 부위 | 존 | (A) | (B) | 결과 |
|---|---|---|---|---|
| 2 | 1 | 두 부위 모두 그 존 안 | 그 존이 덮임 | 양손을 한 존에 ✓ |
| 2 | 2 | 각 부위가 어떤 존에 | 두 존 모두 덮임 | 1:1 배치, 좌우 무관 ✓ |
| 3 | 1 | 세 부위 모두 그 존 안 | 덮임 | 세 부위 한 존에 ✓ |
| 3 | 2 | 세 부위 모두 어떤 존에 | 두 존 모두 덮임 | 2+1 분배 ✓ |
| 3 | 3 | 각 부위가 어떤 존에 | 세 존 모두 덮임 | 1:1:1 ✓ |
| m | n > m | — | 덮기 불가능 | 생성 단계에서 금지 (C6) |

`binding: 'ordered'` 옵션을 남겨, 좌/우 구분이 필수인 동작(목 좌로 굽히기 등)은 기존 인덱스 페어링을 선택적으로 유지한다.

### 5.2 신규 데이터 모델

```ts
// src/types/posture.ts (신규)

export type BodyPart = 'leftHand' | 'rightHand' | 'head' | 'hip';

/** 캘리브레이션 baseline 대비 변위 조건 — 실제 운동 강제용 */
export interface PartGate {
  part: BodyPart;
  axis: 'x' | 'y';
  min?: number;   // 화면 정규화 단위
  max?: number;
}

/** 답안 1개가 요구하는 자세 */
export interface AnswerPosture {
  choiceIndex: 0 | 1;
  parts: BodyPart[];           // 1~3, 중복 불가
  zoneIds: number[];           // 1~3, 중복 불가, parts.length >= zoneIds.length
  binding: 'any' | 'ordered';  // 'any' = 집합 덮기(기본), 'ordered' = 인덱스 페어링
  gates?: PartGate[];
  patternId: string;           // 체조 패턴 참조
}

export interface QuestionPosturePlan {
  tier: TierInfo;
  activeZoneIds: number[];     // union(p0.zoneIds, p1.zoneIds), 크기 1~3
  postures: [AnswerPosture, AnswerPosture];
}

/** 프레임별 판정 상태 — 렌더러 피드백용 (RC-5 해소) */
export interface PostureProgress {
  choiceIndex: 0 | 1;
  progress: number;                                       // 0~1
  met: boolean;
  partStates: { part: BodyPart; zoneId: number | null }[]; // 부위별 현재 위치
  zoneCovered: Record<number, boolean>;                    // 존별 덮임 여부
}
```

렌더러 시그니처를 `choiceProgress: [number, number]` → `progresses: [PostureProgress, PostureProgress]`로 교체하여 존별·부위별 개별 피드백을 가능하게 한다.

### 5.3 체조 패턴 라이브러리 (데이터 분리)

임의 조합 생성 대신 **국민체조/스트레칭 동작을 큐레이션한 테이블**에서 추출한다. 이것이 "공부+운동" 목표를 데이터로 보장하는 수단이며, 개발 규칙 6절(데이터/코드 분리)에도 부합한다.

위치: `config/posture_patterns.ts` (또는 `data/posturePatterns.csv`)

| id | 동작명 | parts | zones | binding | tier | gate |
|---|---|---|---|---|---|---|
| P01 | 양팔 옆으로 벌리기 (T자) | leftHand, rightHand | 4,5 | any | 1 | — |
| P02 | 만세 (양팔 위로) | leftHand, rightHand | 1,3 | any | 2 | — |
| P03 | 한팔 위로 뻗기 (좌) | leftHand | 1 | ordered | 1 | — |
| P04 | 한팔 위로 뻗기 (우) | rightHand | 3 | ordered | 1 | — |
| P05 | 목 좌로 굽히기 | head | 1 | ordered | 2 | head x ≤ −0.06 |
| P06 | 목 우로 굽히기 | head | 3 | ordered | 2 | head x ≥ +0.06 |
| P07 | 양손 모아 위로 | leftHand, rightHand | 2 | any | 2 | — |
| P08 | 스쿼트 | hip | 7 | ordered | 3 | **hip y ≥ +0.12** |
| P09 | 스쿼트 + 양팔 앞으로 | leftHand, rightHand, hip | 4,5,7 | any | 3 | hip y ≥ +0.12 |
| P10 | 몸통 비틀기 (좌) | leftHand, head | 1 | any | 3 | — |
| P11 | 허리 굽혀 손 내리기 | leftHand, rightHand | 9,10 | any | 3 | hip y ≥ +0.08 |
| P12 | 만세 + 스쿼트 | leftHand, rightHand, hip | 1,3,7 | any | 4 | hip y ≥ +0.12 |

`gate`는 **RC-3의 최소 침습 해법**이다. 캘리브레이션 baseline(직립 시 부위 좌표) 대비 변위를 추가 조건으로 요구하면 "스쿼트 없이 골반이 존 7에 있는" 상태를 차단할 수 있다.

### 5.4 문제당 두 패턴 조합 규칙

```
1. tier 필터로 후보 패턴 풀 확보
2. 무작위 2개 (A, B) 추출
3. 제약 검증 — 하나라도 위반 시 재추출 (최대 N회, 실패 시 tier 1 폴백)
   C1  |union(A.zoneIds, B.zoneIds)| <= 3
   C2  A.parts \ B.parts != ∅  AND  B.parts \ A.parts != ∅
   C3  head와 hip이 동일 zoneId를 요구하지 않음
   C4  head와 hip이 함께 요구되면 zone(head).y < zone(hip).y
   C5  ∀ p, z : isValidZoneForCursor(p, z) 통과
   C6  parts.length >= zoneIds.length
4. 최근 3문제 내 동일 patternId 제외 (쿨다운)
```

**C2가 Deadlock Guard 문제를 해소한다.** 사용자 예시 `좌(노랑시안) 우(시안보라)`처럼 시안(왼손)이 양쪽에 공유되어도, 배타 부위(좌=노랑, 우=보라)가 존재하면 두 자세가 동시 성립할 수 없어 교착이 발생하지 않는다.

**C3·C4가 §1.4 배제 규칙을 데이터 레벨에서 보장한다.**

### 5.5 아이콘 시스템 — 단일 렌더러 공유

```
src/render/PartIconRenderer.ts (신규)
export function drawPartIcon(
  ctx: CanvasRenderingContext2D,
  part: BodyPart, x: number, y: number, size: number,
  color: string, opts?: { filled?: boolean; alpha?: number }
): void
```

**커서 렌더링과 답안 라벨 렌더링이 이 함수를 공유하는 것이 직관성의 핵심이다.** 같은 모양·같은 색이 두 위치에 나타나면 별도 설명 없이 대응 관계가 인지된다.

| 부위 | 아이콘 | 색상 |
|---|---|---|
| leftHand | 손바닥 실루엣 (손가락 4 + 엄지, 좌향) | 시안 `#28E6FF` |
| rightHand | 손바닥 실루엣 (우향 미러) | 노랑 `#FFCB4D` |
| head | 원형 얼굴 (눈 2점) | 보라 `#C889FF` |
| hip | 마름모 (다이아몬드) — 개발 규칙 SKEL-003 골반 표기와 일관 | 주황 `#FF865E` |

사용 지점:

1. **커서** — 화면상 실시간 부위 위치
2. **답안 버튼** — 요구 부위를 숫자 위에 가로 배열. 테두리를 요구 부위 색상 그라데이션으로 (단색 `#FFCB4D` 폐기)
3. **활성 존 내부** — 해당 존이 받을 수 있는 부위를 반투명 고스트로 표시

**묶음 기호 규칙** (§1.3의 "한 존에" vs "각 존에" 구분):

| 조건 | 표기 |
|---|---|
| parts 2~3개, zones 1개 | 아이콘들을 `( )` 괄호로 묶음 → "함께 한 존에" |
| parts n개, zones n개 | 아이콘 사이에 `|` 구분선 → "각각 다른 존에" |
| parts 3개, zones 2개 | `( ) |` 혼합 → 2개 묶음 + 1개 분리 |

### 5.6 존 레이아웃 재정의 (D-2 확정)

겹침 제거 + 문제/답안 영역 예약.

| id | label | x | y | w | h | 용도 |
|---|---|---|---|---|---|---|
| 1 | 좌상 | 0.04 | 0.04 | 0.26 | 0.16 | 만세(좌), 목 좌굽힘 |
| 2 | 상단 | 0.37 | 0.04 | 0.26 | 0.16 | 양손 모아 위로 |
| 3 | 우상 | 0.70 | 0.04 | 0.26 | 0.16 | 만세(우), 목 우굽힘 |
| 4 | 좌 | 0.04 | 0.24 | 0.26 | 0.16 | T자 좌팔 |
| 5 | 우 | 0.70 | 0.24 | 0.26 | 0.16 | T자 우팔 |
| — | **문제 텍스트** | 0.30 | 0.26 | 0.40 | 0.12 | 예약 (존 아님) |
| — | **답안 밴드** | 0.28 | 0.42 | 0.44 | 0.14 | 예약 (존 아님) |
| 6 | 좌하 | 0.04 | 0.58 | 0.26 | 0.16 | 하단 좌 |
| 7 | 중하 | 0.37 | 0.58 | 0.26 | 0.16 | 스쿼트 골반 |
| 8 | 우하 | 0.70 | 0.58 | 0.26 | 0.16 | 하단 우 |
| 9 | 좌저 | 0.04 | 0.78 | 0.26 | 0.16 | 허리 굽혀 좌 |
| 10 | 하단 | 0.37 | 0.78 | 0.26 | 0.16 | 허리 굽혀 중앙 |

개선 효과:

- 존 간 겹침 **0** (기존 y 0.55–0.58 중복 해소)
- 답안이 존 4·5 **바로 아래 중앙**에 위치 → §1.1 요구 충족
- 답안 밴드(y 0.42–0.56)가 존 7(y 0.58~)과 비충돌
- 중앙 열(x 0.37–0.63)에 존 2·7·10만 유지 (몸통 회피 의도 문서화)

부위별 허용 존 갱신:

```ts
HEAD_ZONES = new Set([1, 2, 3, 4, 5]);      // 존 7 제거 → head·hip 충돌 원천 차단
HIP_ZONES  = new Set([6, 7, 8, 9, 10]);
// 손: 제한 없음
// SHOULDER_ZONES: 폐기 (D-3)
```

`HEAD_ZONES ∩ HIP_ZONES = ∅`이 되어 §1.4 배제 규칙이 **레이아웃 차원에서 구조적으로 보장**된다.

### 5.7 설정 외부화 구조 (RC-8)

```
config/
├─ zone.config.ts       # FITNESS_ZONES 좌표, 예약 영역, HEAD_ZONES/HIP_ZONES
├─ cursor.config.ts     # CURSOR_COLORS, 아이콘 크기, CONFIDENCE_THRESHOLD
├─ posture.config.ts    # Tier 경계, dwellTime, 감쇠 계수, 가중치, 재추출 횟수
└─ posture_patterns.ts  # 체조 패턴 라이브러리 (§5.3)
```

`src/core/Config.ts`는 위 모듈을 재노출(re-export)하여 기존 import 경로를 깨지 않는다.

---

## 6. 추가 개선 제안

| # | 제안 | 근거 |
|---|---|---|
| S-1 | **캘리브레이션 상대 좌표로 단계적 이행** — `ZoneDef.anchor: 'screen' \| 'body'` 도입, 어깨너비·몸통높이를 단위로 하는 신체 상대 존 지원 | §5.3의 `gate`는 임시방편. 최종적으로 카메라 거리·신장 편차를 제거해야 한다. 별도 카드 분리 권장 |
| S-2 | **오답 페널티를 "재시도"로 완화** | 자세 오인식으로 HP −25는 학습 동기를 저해한다. 존 이탈 시 감쇠만 적용하고 확정은 항상 의도적으로 되게 하는 편이 피트니스 게임에 적합 |
| S-3 | **패턴 쿨다운** — 최근 3문제 내 동일 `patternId` 제외 | 같은 동작 연속 출제 방지, 운동 부위 분산 |
| S-4 | **칼로리 공식 확장** — 자세 유지(스트레칭 dwell) 반영 | 현재 `(steps×0.04)+(squats×0.35)+(jumps×0.15)`는 체조 동작을 보상하지 않는다 |
| S-5 | **튜토리얼 존 온보딩** — 첫 문제 전 각 부위 아이콘·색상 대응을 1회 안내 | 아이콘 도입 효과를 극대화 |
| S-6 | **GDD 갱신** — 보라 `#C889FF` = 머리/얼굴로 명시, `shoulder` 표기 삭제 | D-3 확정 사항 반영 |

---

## 7. 작업 카드 분할 (구현 계획)

개발 규칙 1·9항에 따라 단일 기능 단위로 분할한다. 구현 전 GitHub Issue 등록 및 승인 필요.

| 순서 | 카드 ID | 제목 | 수정 대상 | 변경 금지 | 관련 RC |
|---|---|---|---|---|---|
| 1 | `CFG-001` | 존/커서/티어 설정 `config/` 외부화 | `config/zone.config.ts`, `config/cursor.config.ts`, `config/posture.config.ts`, `src/core/Config.ts` | 판정 로직, 렌더러 동작 | RC-8 |
| 2 | `ZONE-001` | 존 레이아웃 재정의 + 문제/답안 밴드 예약 | `config/zone.config.ts`, `AnswerSelectionRenderer` | 판정 알고리즘, 레시피 생성 | RC-9, RC-6 |
| 3 | `POSE-001` | `AnswerPosture` / `PostureProgress` 타입 신설 | `src/types/posture.ts` | 기존 `ChoiceRecipe` (병행 유지) | RC-1, RC-5 |
| 4 | `POSE-002` | 집합 덮기 판정 `matchPosture()` 구현 + 단위 테스트 | `AnswerSelector.updateFromPose` | `update()` 경로, `CursorTracker` | RC-1, RC-4 |
| 5 | `POSE-003` | 체조 패턴 라이브러리 + 생성기 제약 C1~C6 | `config/posture_patterns.ts`, `RecipeGenerator` | 판정 로직 | RC-4, RC-6 |
| 6 | `POSE-004` | `PartGate` (캘리브레이션 대비 변위) 판정 추가 | `AnswerSelector`, `CalibrationHelper` | 존 좌표 | RC-3 |
| 7 | `ICON-001` | `PartIconRenderer` 신설 (손/머리/골반 아이콘) | `src/render/PartIconRenderer.ts` | 판정 로직 | 아이콘 요구 |
| 8 | `UI-001` | 답안 버튼 부위 아이콘·색상·묶음 기호 표시 | `src/main.ts renderQuestion` | 문제 생성, 판정 | RC-2 |
| 9 | `UI-002` | 존별/부위별 개별 진행도 피드백 (`i % 2` 버그 수정) | `AnswerSelectionRenderer` | 판정 로직 | RC-5 |
| 10 | `REFACTOR-001` | 죽은 판정 경로 `update()` 정리 | `AnswerSelector`, `tests/unit/input-system.test.ts` | 실게임 경로 | RC-7 |

### 순서 조정 옵션

직관성 체감을 우선하려면 `ICON-001` → `UI-001` → `UI-002`를 앞으로 당길 수 있다. 단 **`ZONE-001`은 `UI-001`보다 반드시 앞서야 한다** (답안 밴드 좌표가 맞물림).

### 리팩터링 주의사항 (개발 규칙 3.3 / 18항)

- `AnswerSelector.update()`(경로 A)는 `main.ts`에서 미사용이지만 `input-system.test.ts`의 약 7개 테스트가 의존한다. 제거는 반드시 `REFACTOR-001` 단독 카드로 수행한다.
- `tests/unit/architecture.test.ts:35`가 `dwellTime === 1.0`을 고정 검증한다. `CFG-001` 수행 시 함께 갱신 필요.
- `GeneratedQuestion.choices`는 고정 2-튜플(`src/types/index.ts:113-119`)이다. 2지선다 유지 전제이며, 3지선다 확장은 본 설계 범위 외.

---

## 8. 테스트 계획

### 8.1 현재 커버리지 공백

| # | 공백 | 위험 |
|---|---|---|
| 1 | 2부위 조합(Tier 3) AND 판정 테스트 **0건** | 조합 기능 핵심이 미검증 |
| 2 | 3개 `activeZones` 렌더링 미검증 | `choiceProgress[i % 2]` 버그가 테스트를 통과 |
| 3 | `avgWeight` 평균 계산 미검증 | 조합 크기별 충전 속도 공정성 불명 |
| 4 | `requiredCursors`/`targetZoneIds` 길이 불일치 동작 미검증 | 조용한 실패 가능 |
| 5 | 커서 소실(신뢰도 하락) 중 진행도 처리 미검증 | 깜빡임 시 동작 불명 |
| 6 | `cursor-tracker-recipe.test.ts:112-121`이 Tier 1만 검사 | Tier 2/3/4 부위 비중복 미검증 |

### 8.2 신규 테스트 요구 (POSE-002 필수 항목)

```
matchPosture 단위 테스트 — §1.3 전 케이스
□ 2부위 1존: 두 부위 모두 존 내부 → met
□ 2부위 1존: 한 부위만 존 내부 → not met
□ 2부위 2존: 정방향 배치 → met
□ 2부위 2존: 역방향 배치(좌우 교환) → met        ← RC-1 회귀 방지 핵심
□ 2부위 2존: 두 부위가 같은 존에 몰림 → not met  ← 조건 (B) 검증
□ 3부위 1존 / 3부위 2존 / 3부위 3존 각 met
□ 3부위 2존: 한 존이 비었을 때 → not met
□ binding: 'ordered' 시 역방향 배치 → not met
□ C3: head·hip 동일 존 요구 조합이 생성되지 않음
□ C4: head 존 y < hip 존 y 보장
□ C2: 두 자세가 동시 met 되는 조합이 생성되지 않음 (100회 반복)
□ C6: parts.length < zoneIds.length 조합이 생성되지 않음
□ 활성 존 3개 시 존별 진행도가 독립적으로 표시됨   ← RC-5 회귀 방지
□ PartGate: baseline 변위 미달 시 not met
```

전 테스트는 `npm test` 100% 통과가 완료 조건이다 (AGENTS.md 5항).

---

## 9. 완료 조건 (전체 로드맵)

```
□ config/ 디렉터리 분리 및 존/커서/티어 설정 외부화
□ 존 레이아웃 겹침 0, 답안 밴드 예약 완료
□ HEAD_ZONES ∩ HIP_ZONES = ∅ 보장
□ 1~3부위 × 1~3존 전 조합이 집합 덮기로 판정됨
□ 좌우 배치 교환이 허용됨 (binding: 'any')
□ 체조 패턴 라이브러리 12종 이상 데이터화
□ PartGate로 스쿼트/굽히기가 실제 변위 없이 충족되지 않음
□ 손/머리/골반 아이콘이 커서·답안·존에서 동일 형상으로 표시됨
□ 답안 버튼에 요구 부위 아이콘·색상·묶음 기호 표시
□ 존별·부위별 개별 진행도 피드백
□ npm test 100% Pass
□ 콘솔 에러 없음
□ 각 카드별 GitHub Issue 코멘트 등록 (개발 규칙 12항)
□ npm run dev 가동 및 http://localhost:3000/ 안내 (개발 규칙 13항)
```
