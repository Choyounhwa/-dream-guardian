# DOC-18 — 보스 접근전 챌린지 출제 시스템 설계서

- **문서 번호**: `DOC-18` (DOC-17은 리팩터링 카드 원장으로 사용 중)
- **버전 / 작성일**: v0.1 / 2026-10-21
- **상태**: 설계 초안. 사용자 승인 범위는 **설계 문서 작성 및 기존 카드 수정 메모 정리**이다. 소스·config·tests 변경, 카드 등록, 기존 카드 본문 수정, NEXT 전진을 의미하지 않는다.
- **참조**: DOC-14 v0.3(§§5~7, 11.3, 15), DOC-15, DOC-16(REC-00~26), `../dream_guardian/HANDOVER.md`
- **채택 범위**: A(규칙 사냥)·B(대결)·C(같은 값 찾기)·D(진행) 4계열 14유형. **E(참인 식 판정) 제외.**

## 0. 목적과 배경

현행 MVP(DOC-14 §7.2, #509)는 문제 하나의 정답값을 여러 보기 쌍에서 반복 식별한다. 두 번째 쌍부터는 "계산"이 아니라 "본 숫자 찾기"가 되며, 2지선다 50% 찍기 효과가 반복된다. DOC-14 §11.3도 숫자 반복 식별과 서로 다른 계산을 같은 성취로 기록하지 않도록 요구한다.

본 설계는 **라운드 하나 = 규칙 하나, 보기 쌍 하나 = 새로운 판단 하나**인 챌린지 출제 방식을 추가한다. 기존 숫자 반복 방식은 기본값으로 보존한다.

## 1. 조사 기준 사실 (2026-10-21, HEAD `ddb87ec`)

| 근거: `dream_guardian/` 기준 | 확인 사실 | 설계 영향 |
|---|---|---|
| `src/question/AssaultAnswerPairFactory.ts:233` | `createAssaultAnswerPairs`는 테스트에서만 호출. 보기 `value: number`, `text: String(value)` | 수식 라벨 불가 → 신규 생성기는 별도 모듈, 출력 형식만 호환 |
| 같은 파일 `:70` | Mulberry32 시드 RNG가 비공개 | 공통 유틸로 추출(DRY) |
| 같은 파일 `:136~222` | 오답 규칙 하드코딩 | 신규 함정 규칙은 config로 분리, 기존 규칙은 변경하지 않음 |
| `src/game/assault/AssaultPairJudge.ts:463` | 판정은 `chosenSide === correctSide`만 비교 | **판정기 무수정 재사용** |
| `src/game/assault/AssaultRoundController.ts:529~548` | 쌍별 판정기 생성, `options.pairs[pairId].correctSide` 소비 경로 존재 | 쌍 공급 포트만 정확히 연결하면 됨 |
| `src/types/assault.ts:181` | `AssaultRoundPresentation`에 좌우 보기·쌍 문구 없음 | REC-13/14 이후 보조 문구 필드 추가 |
| `src/data/assault/approachPatterns.ts:44` | 기본 패턴 8박, 답 쌍 1개 + 스쿼트 1개 | 다중 쌍 패턴 추가(기존 패턴 불변) |
| `src/question/QuestionEvaluator.ts:87` | `safeEval`은 `×`/`÷` 미지원, `Math.random` 사용 | 챌린지 경로는 문자열 평가를 사용하지 않음 |
| `src/utils/` | 분수·유리수 유틸 없음 | `Rational` 신규 |
| `config/assault-question.config.ts:44` | `maxLabelChars: 6` (DEC-C9) | 신규 config에서 **참조만** 하고 재정의 금지 |
| `src/core/AssaultSessionFactory.ts:311` | `targetRounds ?? 5` (REC-04에서 config 10으로 수정 예정) | 스케줄러는 config `targetRounds`를 따름 |
| `src/core/bootstrap/AssaultSessionWireHelper.ts:656` | `startAssaultPhase()`가 `round_01`만 생성 | 라운드 반복(REC-12) 완료 전 연결 불가 |

## 2. 설계 원칙

1. **라운드 단위 일괄 생성**: 라운드 시작 시 모든 쌍을 한 번에 생성·검증·동결한다. 쌍마다 문제를 재생성하지 않는다(REC-04 금지 조항 준수).
2. **문자열 eval 금지**: 보기는 구조식(`{kind, a, op, b}`)으로 만들고, 화면 라벨과 정확값을 같은 구조에서 각각 산출한다. 분수·소수는 `Rational`로 정확 계산한다(`2/4 == 0.5`).
3. **판정 계약 불변**: 출력은 기존 `AssaultAnswerPair`(`pairId`/`left`/`right`/`correctSide`/`choices`/`isCorrect`) 형식이다. 판정·정산·콤보 로직은 수정하지 않는다.
4. **데이터·설정·로직 분리**: 무엇을 낼지는 `src/data/assault/challengeCatalog.ts`, 수치·비율은 `config/assault-challenge.config.ts`, 생성 방법은 `src/question/challenge/`.
5. **독립 검증**: 생성기와 별도인 검증기가 모든 쌍을 재계산해 정답 유일성을 확인한다. 실패 시 라운드를 만들지 않으며 legacy로 몰래 전환하지 않는다(DOC-14 §6.5).
6. **결정성**: 모든 무작위는 주입된 시드 RNG만 사용한다. `Math.random`/`Date.now` 사용 금지.
7. **기본값 보존**: 챌린지 공급은 명시적으로 선택했을 때만 동작한다. 미선택 시 기존 숫자 반복 결과가 바이트 단위로 동일해야 한다.

## 3. 처리 흐름

```text
세션 시작
 └ ChallengeScheduler(seed, chapter, targetRounds) → 라운드별 variantId 순서
     └ 라운드 r:
        catalog[variantId] + challenge config
          → 계열 생성기(A/B/C/D)(rng, pairCount = 패턴의 answer_pair 수)
          → ChallengePairValidator (유일 정답·라벨 길이·연속 같은 쪽 제한·음수/NaN)
          → ChallengeRoundAdapter → AssaultChallengeRound
               { questionText, pairPrompts[], pairs: AssaultAnswerPair[], extraReadSeconds }
 └ AssaultRoundSource 포트 (numeric_repeat | challenge)
     → AssaultSessionFactory → AssaultRoundController({ pairs }) → AssaultPairJudge (무수정)
     → 표시 스냅샷(pairPromptText) → AssaultSceneRenderer / AssaultPairPainter
     → AssaultRoundSummary(challengeFamily, variantId)
```

## 4. 계열·유형 정의 (14유형)

### 4.1 유형 카탈로그

| 계열 | variantId | 문제 문구 예 | 쌍 예시 (정답 **굵게**) | 챕터 |
|---|---|---|---|---|
| A 규칙 사냥 | `A1_times_table` | 6단 숫자를 쳐라! | **42**/44, 27/**18**, **54**/56 | Ch.2 |
| | `A2_parity` | 짝수를 쳐라! | 9/**14**, **38**/27 | Ch.1 |
| | `A3_range` | 30과 40 사이를 쳐라! | **34**/43, 29/**36** | Ch.1 |
| | `A4_multiple` | 3의 배수를 쳐라! | **27**/25, 31/**33** | Ch.2·5 |
| B 대결 | `B1_addsub_duel` | 더 큰 쪽을 쳐라! | **7+8**/6+7, 9-2/**3+5** | Ch.1 |
| | `B2_mul_duel` | 더 큰 쪽을 쳐라! | **4×6**/3×7, 5×5/**4×7** | Ch.2 |
| | `B3_fraction_duel` | 더 큰 쪽을 쳐라! | **1/2**/2/5, 3/8/**3/4** | Ch.3 |
| | `B4_decimal_duel` | 더 큰 쪽을 쳐라! | **0.5**/0.45, 0.3/**0.31** | Ch.4 |
| C 같은 값 | `C1_make_target` | 12를 만들어라! | **3×4**/2×5, 7+4/**9+3** | Ch.1·2 |
| | `C2_equivalent` | 1/2과 같은 것! | **2/4**/2/3, 0.25/**0.5** | Ch.3·4 |
| | `C3_make_ten` | 합이 10! | **3+7**/4+5, 6+3/**8+2** | Ch.1 |
| D 진행 | `D1_skip_count` | 3부터 4씩 뛰어라! | **7**/8, 10/**11**, **15**/16 | Ch.1·2 |
| | `D2_countdown` | 50에서 7씩 빼라! | **43**/42, **36**/37, 28/**29** | Ch.1·5 |
| | `D3_doubling` | 3에서 두 배씩! | **6**/5, 9/**12**, **24**/18 | Ch.2·5 |

B 계열은 데이터상 "더 작은 쪽" 지시(`direction: 'max' | 'min'`)도 지원하되 초기 콘텐츠는 `max`만 사용한다.

### 4.2 계열별 생성·검증 규칙

| 계열 | 라운드 상태 | 쌍 i 정답 | 함정(오답) 규칙 — config 관리 | 검증 불변식 |
|---|---|---|---|---|
| A | 술어 P(배수 k / 홀짝 / [lo,hi]) | P를 만족하는 새 수(쌍 간 중복 금지) | 정답±1·±2, 자릿수 뒤집기, k배수±1, 범위 경계 밖 인접값 | 정답 P=true, 오답 P=false |
| B | 방향(max/min) | 방향에 맞는 쪽 식 | 값 차이 작은 식, 오개념 함정(소수 자릿수 길이, 분모 크기) | 두 값 서로 다름, 차이가 config 범위 내 |
| C | 목표값 T(Rational) | 값이 T인 서로 다른 표현 | **같은 연산 종류**로 T±1·±2, 분자/분모 하나만 바꾼 분수 | 정답 = T, 오답 ≠ T, 표현 중복 금지 |
| D | 시작값 s, 규칙 f(+d / −d / ×2) | f^(i+1)(s) | 정답±1, f를 한 번 덜/더 적용한 값 | 모든 값 ≥ 0, 라벨 길이 이하 |

### 4.3 공통 규칙 (모두 config 값)

- 같은 쪽 정답 최대 연속 수: 3 (DOC-14 §7.2 "좌우 강제 교대 금지"와 양립).
- 쌍 진행에 따른 난도 상승: 쌍 인덱스별 숫자 범위 스케일.
- 세션 구성: 챕터별 계열 가중치, 한 세션 계열 3~4종, 같은 계열 연속 최대 2라운드.
- 계열 첫 등장 라운드 가산 읽기 시간: +1~2박 상당 초. REC-00 누적 가산식에 `extraReadSeconds`로만 더하며 `ttsMaxSeconds` 상한 정책을 따른다. 라운드 컨트롤러 로직은 수정하지 않는다.
- 계열별 최소 쌍 수 `minPairs`: A·B·C 2, D 3. 패턴의 answer_pair 수가 부족한 유형은 스케줄러가 선택하지 않는다.
- 라벨 길이 상한은 `DEFAULT_ASSAULT_QUESTION_CONFIG.maxLabelChars`(6)를 참조한다. 재정의 금지.

### 4.4 D 계열 오답 전파 방지

각 쌍 정산 후 정오와 무관하게 정답 값을 공개하는 쌍 보조 문구를 표시한다(예: `3 → 7 → ?`). 플레이어가 한 번 틀려도 다음 쌍은 올바른 기준에서 다시 풀 수 있다. 이 문구는 `pairPrompts[i]`로 사전 생성되며 렌더러는 계산하지 않는다.

## 5. 타입 계약 (제안, `src/types/assaultChallenge.ts`)

```ts
export type AssaultChallengeFamily = 'rule_hunt' | 'duel' | 'equivalence' | 'progression';
export type AssaultRoundSourceKind = 'numeric_repeat' | 'challenge';

export interface AssaultChallengeVariantDef {      // data, 불변
  readonly variantId: string;
  readonly family: AssaultChallengeFamily;
  readonly chapters: readonly number[];
  readonly promptTemplate: string;                  // 예: '{k}단 숫자를 쳐라!'
  readonly params: Readonly<Record<string, readonly [number, number]>>; // 범위
  readonly minPairs: number;
}

export interface AssaultChallengeRound {           // 생성 결과, 동결
  readonly variantId: string;
  readonly family: AssaultChallengeFamily;
  readonly questionText: string;
  readonly pairPrompts: readonly (string | null)[];
  readonly pairs: readonly AssaultAnswerPair[];     // 기존 Question 레이어 타입 재사용
  readonly extraReadSeconds: number;
  readonly seed: number;
  readonly rulesVersion: string;
}
```

- 보기 `AssaultChoiceItem.value: number`는 그대로 둔다. 분수/수식 보기는 `value`에 정확값의 수치 근사를 넣고 판정은 `isCorrect`/`correctSide`로만 한다. 정확값 비교는 생성·검증 단계의 `Rational`에서만 수행한다.
- `pairId`는 **플랜 encounter의 `pairId ?? id` 순서**로 매핑한다(§7.2 REC-04 메모).

## 6. 작업 카드 계획 (CH-01~CH-19, 미등록)

카드당 src/config 최대 3파일·단일 레이어(DOC-16 §3). 2레이어를 건드리는 카드는 등록 시 분리한다(표기 `a/b`).

| ID | 대상 파일 | 책임 | 레이어 | 선행 |
|---|---|---|---|---|
| CH-01a | `src/utils/seededRng.ts` (신규) | Mulberry32 공통 유틸 | utils | — |
| CH-01b | `src/question/AssaultAnswerPairFactory.ts` | 비공개 RNG를 공통 유틸 import로 교체, 출력 바이트 동일 회귀 | question | CH-01a |
| CH-02 | `src/utils/Rational.ts` (신규) | 약분·비교·사칙·소수 변환·표기 | utils | — |
| CH-03 | `src/types/assaultChallenge.ts` (신규) | §5 타입 | types | — |
| CH-04 | `config/assault-challenge.config.ts` (신규) | §4.3 수치, 함정 규칙표 | config | CH-03 |
| CH-05 | `src/data/assault/challengeCatalog.ts` (신규) | 14유형 정의 | data | CH-03 |
| CH-06 | `src/data/assault/approachPatterns.ts` (추가만) | 다중 쌍 패턴(예: 쌍3+스쿼트2) 등록, 기존 패턴 불변 | data | — |
| CH-07 | `src/question/challenge/ChallengeExpression.ts` | 구조식 → 라벨(×, ÷, a/b) + 정확값 | question | CH-02, CH-03 |
| CH-08 | `src/question/challenge/RuleHuntGenerator.ts` | A 계열 | question | CH-04, CH-05, CH-01a |
| CH-09 | `src/question/challenge/DuelGenerator.ts` | B 계열 | question | CH-07 |
| CH-10 | `src/question/challenge/EquivalenceGenerator.ts` | C 계열 | question | CH-07 |
| CH-11 | `src/question/challenge/ProgressionGenerator.ts` | D 계열 + pairPrompts | question | CH-04, CH-05 |
| CH-12 | `src/question/challenge/ChallengePairValidator.ts` | 독립 재계산 검증 | question | CH-07 |
| CH-13 | `src/question/challenge/ChallengeRoundAdapter.ts` | 계열 디스패치, pairId 매핑, 동결 | question | CH-08~12 |
| CH-14 | `src/question/challenge/ChallengeScheduler.ts` | 세션 유형 순서(가중치·연속 제한·minPairs) | question | CH-04, CH-05 |
| CH-15 | `src/core/AssaultSessionFactory.ts`, `src/core/bootstrap/AssaultSessionWireHelper.ts` | `AssaultRoundSource` 포트 연결, 기본 numeric_repeat | core | REC-04, REC-12, CH-13, CH-14 |
| CH-16a | `src/types/assault.ts` | `pairPromptText?`, `challengeFamily?` 표시 필드 | types | REC-13 |
| CH-16b | `src/game/assault/AssaultRoundController.ts` | 현재 쌍의 보조 문구 스냅샷 노출 | game | REC-14, CH-16a |
| CH-17 | `src/render/AssaultSceneRenderer.ts`, `src/render/AssaultPairPainter.ts` | 보조 문구·계열 배지, 분수 라벨 표기 | render | REC-15, CH-16b |
| CH-18 | `src/game/assault/AssaultRoundSummary.ts` | `challengeFamily`/`variantId` 기록, 계열별 집계 | game | REC-11 |
| CH-19 | `tests/integration/assault-challenge.test.ts` | 14유형×시드 결정성 E2E | tests | CH-15~18 |

## 7. 남은 작업과의 충돌 점검

### 7.1 독립 병행 가능 (파일 겹침 0)

CH-01a, CH-02~CH-05, CH-07~CH-14. REC-04~26, #533~#538, UI-EDITOR #556, 완료된 REFACTOR-SRP 트랙 어느 카드도 해당 신규 파일을 수정 대상으로 두지 않는다. CH-06은 기존 데이터 파일에 항목만 추가하며 열린 카드 중 이 파일을 수정 대상으로 둔 카드는 없다.

### 7.2 순서 제약 (4건)

| 신규 | 겹치는 카드 | 겹치는 파일 | 규칙 |
|---|---|---|---|
| CH-15 | REC-04 #597, REC-07·09·10·12·15·16·17, #537 | `AssaultSessionFactory.ts` | REC-12 완료 후. 같은 파일 카드와 동시 진행 금지 |
| CH-16a/b | REC-13 #590, REC-14 #599 | `types/assault.ts`, `AssaultRoundController.ts` | REC-13·14 완료 후 |
| CH-17 | REC-15 #608 | 화면·HUD 전달 경로 | REC-15 완료 후 |
| CH-18 | REC-11 #596 | `AssaultRoundSummary.ts` | REC-11 완료 후 |

CH-01b는 REC-04가 쌍 팩토리를 호출만 하므로 직접 충돌은 없으나, 출력 동일성 회귀를 고정하기 위해 **REC-04 이전**에 수행하는 것을 권장한다.

### 7.3 기존 카드 수정 메모 (카드 본문 미수정, 실행 승인 시 반영 검토)

| 카드 | 메모 | 이유 |
|---|---|---|
| REC-04 #597 | (1) 쌍 공급을 직접 호출 대신 `AssaultRoundSource` 포트(기본 `numeric_repeat`) 경계로 둘 것. (2) 생성 `pairId`(`${roundId}-pair-n`)와 플랜 `pairId`(`'pair_01'`)가 다르므로 **encounter 순서 기준 매핑 규칙**을 완료 조건에 명시 | CH-15에서 factory를 재수정하지 않기 위함. 현재 불일치 시 우측 정답이 판정 포트에 도달하지 못할 위험 |
| REC-12 #607 | 실제 라운드 생성 지점 `AssaultSessionWireHelper.ts:656`이 수정 대상에 없음. 착수 전 allowlist 재대조 | REFACTOR-SRP 트랙 이후 파일 구조 변경 |
| REC-13 #590 | 표시 타입 추가 시 `pairPromptText?`, `challengeFamily?`를 함께 넣으면 CH-16a 생략 가능(선택) | 같은 파일 2회 수정 방지 |
| #533 / #535 | 신규 기록 스키마에 `roundSourceKind`, `challengeFamilies[]`, `challengeRulesVersion` 포함 | DOC-14 §11.3 비교 조건 분리 |
| REC-25 #613 | 인수 시나리오 A32~A35 추가(§8) | 챌린지 경로 회귀 고정 |

### 7.4 잠재 위험

- `targetRounds ?? 5` 잔존: REC-04 처리 전까지 스케줄러 테스트는 config 값을 명시 주입한다.
- G4 결전(REC-18~24) 차단 상태: 결전 패턴의 `answer_policy_rapid`는 본 설계 범위 밖이며 변경하지 않는다.
- 분수 라벨 렌더링: `AssaultPairPainter`는 `fillText` 단순 출력. `3/4` 6자 이내는 표기 가능하나 세로 분수 표기는 CH-17 범위에서 결정한다.
- 읽기 시간: 문제 문구가 짧아(예: "짝수를 쳐라!") 최소 8박 계약은 그대로 충족된다. 규칙 이해 부담은 `extraReadSeconds`로만 보정한다.

## 8. 추가 인수 기준

| ID | 시나리오 | 기대 결과 |
|---|---|---|
| A32 | 14유형 × 시드 1,000개 생성 | 모든 쌍 유일 정답 1개, 라벨 ≤ `maxLabelChars`, 음수·NaN 0건 |
| A33 | 동일 시드·챕터 | 유형 순서·쌍 구성·정답 쪽 동일 |
| A34 | D 계열 첫 쌍 오답 | 다음 쌍 정답이 올바른 수열 값 유지, 보조 문구가 정답 값 공개 |
| A35 | 챌린지 미선택(기본) | 기존 숫자 반복 경로 출력 바이트 동일, 판정/정산 호출 수 불변 |

## 9. 실행 순서 권장

```text
[즉시 병행 가능] CH-01a → CH-01b → CH-02 → CH-03 → CH-04 → CH-05 → CH-06 → CH-07
                → CH-08 → CH-09 → CH-10 → CH-11 → CH-12 → CH-13 → CH-14
[REC 복구 후]   REC-04·11·12·13·14·15 → CH-15 → CH-16a → CH-16b → CH-17 → CH-18 → CH-19
```

## 10. 미결정 항목

| 항목 | 권장 후보 | 확정 시점 |
|---|---|---|
| 챕터별 계열 가중치 | §4.1 챕터 열 균등 | CH-04 |
| 첫 등장 가산 읽기 시간 | 1박 상당(BPM 100 기준 0.6초)~2박 | CH-04 |
| 다중 쌍 패턴 박 구성 | 쌍3+스쿼트2, 20박 | CH-06 |
| 세션 진입 시 출제 방식 선택 수단 | 개발용 URL 파라미터(예: `&source=challenge`) | CH-15 |
| 결과·순위의 계열 표시 | 계열별 정답 타격 수 | #533/#535 재검토 시 |
| 분수 세로 표기 여부 | 6자 이내 가로 `a/b` | CH-17 |
