# DOC-19 — 보스 접근전 러닝·4회 선택·휴식 루프 작업 원장

등록일: 2026-10-27. **카드 작성·GitHub 등록·문서 동기화만 승인. 구현 미착수 / 전 카드 OPEN / 개별 승인 대기.**

기존 HANDOVER의 최상위 NEXT **#676(또는 #537)** 및 캐릭터 트랙 NEXT **#678**은 유지한다. 이 트랙의 첫 후보 #694는 **별도 승인 대기 후보**이며 자동 NEXT가 아니다. 카드 생성은 TDD 실행/소스 변경/커밋/푸시/PR/서버 시작 승인이 아니다.

## 1. 이번 요구의 적용 범위와 결정

- 적용 기본경로: **`http://localhost:3000/?mode=boss_assault`만으로 UI 첫 시작·restart에서 Core가 새 루프를 기본 선택한다. 추가 `loop` URL/사용자 loopProfile 지정은 필수가 아니다.** 이전의 별도옵션 opt-in 한정 명세는 요구불일치로 정정한다.
- 보존 경계: 비boss legacy, 기존 DEFAULT/EXTENDED/MULTI_PAIR **데이터**, loopProfile 없는 **범용 Factory/Controller 직접 호출 테스트**. Factory 전역 기본값을 변경하지 않고 LOOP-12 UI 진입 resolver가 새 프로필을 기본 주입한다. 이 보존 조건을 boss_assault UI 구형 루프 유지로 해석하면 안 된다. invalid입력은 원자적 오류로 거부한다.
- 단위는 **beat(박)**. 문제마다 `러닝+문제 8박` **1회** → `(인식+답 선택 4박 → 휴식 2박) × 4회`.
- 문제/정답은 동일하고 선택 기회가 4개다. 보기 좌우/오답 배치는 기존 numeric_repeat의 시드 정책을 사용한다. **모두 정답일 필요 없음**. 실패해도 생존하면 다음 문제로 진행한다.
- 문제 읽기와 **TTS 요청1회는 첫 러닝8박에 포함**. 기존 별도 additive 읽기와 투척1초를 재가산하지 않는다. 새 경로에서는 즉시 읽을 수 있게 고정 표시하며 별도 투척 대기0. TTS 지연/실패/무응답은 진행을 막지 않고 구간 종료/중단 시 취소 포트를 사용한다. #594 additive 읽기 호환은 loop계획 없는 직접 호출에서 보존하며 boss_assault UI 기본경로에는 재가산하지 않는다.
- 선택4박은 조기 선택해도 유지. 기존 easy3/normal2/hard1.5박 비행/선택 override는 새 경로에 적용하지 않는다. 우선 새 경로 비행도4박으로 맞추며 난이도별 시각 비행 분리는 별도 요청 범위다.
- 휴식2박은 **무공격·무선택·무피해**. 회수/직립 관찰과 안전추적은 계속한다. 선택 종료 정각 입력→판정/피해 정산→휴식 진입 순서, 기존170ms 유예를 휴식으로 흘리지 않는다. 기존 판정기에 새 경로만 유예0을 주입하며 기본 계약은 유지한다.
- 스쿼트 후보는 선택1~2 / 2~3 / 3~4 사이 **3곳**. seed+roundNumber로 시작 전에 **중복없이1~2곳** 확정하고 실행 중 재추첨/Math.random은 금지한다.
  - **2026-11-09 정책 변경 예고**: 스쿼트는 오답·Miss 시 동적 발동 + 회피 성공 시 피해 감면으로 결정(#734, 보류). 그 전까지 **#744가 사전 배치 스쿼트를 임시 제거**(`min/maxSquatsPerRound: 0`, run 8 + answer 4×4 = 24박). 빌더의 스쿼트 삽입 기능 자체는 보존.
- 스쿼트는 해당 **휴식2박을 완료한 뒤 별도4박** 삽입한다. 휴식 대체 아님. 내부 **예고1+회피2+직립1박**은 권장 상세안이며 LOOP-01 개별 구현 승인 때 함께 확인받는다. 회피 실패정산은 회피창 끝에서, 복귀박은 무피해. 어떤 안이든 총4박/휴식보존/안전성을 만족해야 한다.
- 기본32박 = 8+(4+2)×4. 스쿼트 포함 **36박 또는40박**,120BPM에서 **18초 또는20초**. 무중단 기준이며 pause 시간은 제외하고 안전 재준비로 늘어난 활성시간은 별도 실측한다. 추가 읽기/투척 구간을 총길이 밖에 붙이지 않는다.
- **마지막 선택 후 휴식2박까지 끝나야 완료문제+1**. 선택기회4/전투조우5또는6/완료문제1을 구분한다. targetRounds10, HP100, wrong/miss10, squatFail5는 기존 SSOT 유지. 사망은 즉시 중단이며 최종라운드에도 우선한다.
- **numeric_repeat + 기존 questions.csv 먼저 연결**. challenge CSV/로더/어댑터/계열 UI·집계, 보상/저장 실연결, 결전/마나 연계는 보류. plannedAnswerOpportunities는 전체계획 answer 기회에서 산출(10문제 완주계획40), 실측통계와 구분한다.

## 2. 사전 정합성 조사 (정적 조사, 실행 검증 아님)

| 조사 대상 | 확인 내용 | 대응 카드/경계 |
|---|---|---|
| `src/types/assault.ts` | EncounterKind=answer_pair/squat/jump, phase union/다수 소비자 존재 | LOOP-01 독립 구간 타입·선택합성. run/rest를 공격union에 추가하지 않음 |
| `src/data/assault/approachPatterns.ts` | #651의32박은 answer4+squat4 고정이며 러닝/휴식 구조 아님 | 재완료/변경 금지. LOOP-02 신규 계획 빌더 |
| `AssaultPlanValidator.ts` | 비중첩·순서·총박자·하위창 검사, 간격 허용; 답/스쿼트만 교대해야 한다는 강제 없음 | 기존 검증기를 재사용하고 외부 구간 커버리지는 LOOP-02에서 검사 |
| `AssaultPlanCompiler.ts` | answerBeats override는 duration을 바꾸며 총길이 재배치를 보장하지 않음 | 새계획에는 override 미주입. 기존 컴파일러 변경0 |
| `AssaultRoundController.ts` **996줄** | 투척1초+additive 읽기를 encounter start에 가산, encounter 완료 시 조기 round 완료, grace가 이후까지 지속; 표시조립 내장 | LOOP-03 표시만 추출 선행, LOOP-04/05/06 시간·입력·요약 분리 |
| `AssaultRoundTypes.ts` | 옵션에 외부 구간계획 없음, RuntimeEncounter/TimelineEvent는 전투 중심 | LOOP-04/05에서 명시 구간옵션·타임라인 합성 |
| `AssaultSessionFactory.ts` **930줄** | 세션 compiledPlan 재사용, answer encounter 수로 pairCount 산출; 기존 RoundSourcePort/defaultNumericRepeatSource 이미 존재 | LOOP-09는 기존포트·직접호출 기본값 보존, LOOP-12가 UI에 새계획 기본주입. #660 공급포트 재등록 아님 |
| `AssaultSessionWireHelper.ts` **997줄** | 시작/restart/입력/pose 배선 소유. pose는 ducking/guarding 분기로 standing 전달 누락 가능 | LOOP-08 입력만 제한추출. LOOP-10은 실제 재현 후 조건부 최소수정, baseline 등 다른 가설로 확대0 |
| `SceneMotionCoordinator.ts` | detector stepped 계산은 이미 있음. assault에서는 legacy totalSteps/BeatRun 기록을 차단함 | LOOP-11 Core 러닝전달만, detector/intent union/임계값 수정0 |
| `MotionIntentBus.ts`/judgment ownership | 전투용 ASSAULT_ROUND/FINALE 소유권과 러닝 실측을 혼동하면 오공격 위험 | 기존 detector stepped를 별도 공개포트로 전달, 공격 소유권 무단확대0 |
| `AssaultExerciseTally.ts` | 펀치/스쿼트/가드 집계, runStep 포트 없음; 총kcal 미지원 | LOOP-07 내부 실측 포트, UI 기본 새루프에서 활성화/사용자 opt-in 없음. LOOP-11 배선. 기존요약필드집합 보존 |
| snapshot/HUD/SceneHandler | snapshot에 loop구간 없음. HUD에는 별도 실전달 필요 | LOOP-13 Game DTO → LOOP-14 Render / LOOP-15 UI → LOOP-15a Core 전달 |
| `AssaultSoundCue.ts` | snapshot pair/hazard로 발사·피격음; 같은 스쿼트 이벤트키 가설 등은 신규요구와 구분 필요 | 휴식pair/hazard 제거를 검증. 별도 음향결함은 LOOP-16 재현 후 별도카드, 임의 Audio수정0 |
| `AssaultRoundSummary.ts`/Progress | 완료문제·시도수·조우수 구분 및 receipt집계 이미 있음. 완료callback 전 시간 반영 순서 검증 필요 | LOOP-06 새경로 경계정합, LOOP-09 사망중단/진행 |
| `AssaultResultStore.ts` | 엄격 roundKeys/count 관계, 비교identity에 plannedAnswerOpportunities/rulesVersion/profileId 있음 | 필드집합 보존; LOOP-16 기존저장API 호환 fixture만. 실제저장배선#537 |
| 시작/restart/수명 | raw/wrapper토큰·SessionLifecycle 종료권위, 기본UI 루프 미연결을 해결해야 함 | LOOP-12가 일반 boss_assault UI에 새루프 기본주입,16이 추가 loop URL 없는 시작/restart 인수. death→abort→summary→progress, stale차단 |

**최소 설계**: `AssaultLoopPlan` = 명시 구간계획 + 기존 컴파일 전투계획. run/rest는 공격이 아니고 `encounters`에는 answer_pair4+squat N만 둔다. 모든 구간시각은 라운드원점 기준이다. 기존 compiler가 처리한8박을 controller가 읽기8박으로 다시 더하면 안 된다. 기존 GameEngine/활성clock만 사용한다.

## 3. 등록 카드·원본 본문·직접 선행

모두 **OPEN / 개별 구현 승인 대기**. 아래 ID는 전부 `ASSAULT-LOOP-` 접두사이며 직접 선행은 LOOP 번호를 축약했다. GitHub 본문과 로컬 원본은 동일하다.

| 작업 ID | 이슈/URL | 제목 | 책임 | 직접 선행 | 표준 본문 |
|---|---|---|---|---|---|
| LOOP-01 | [#694](https://github.com/Choyounhwa/-dream-guardian/issues/694) | 독립 타입·설정 계약 | types/config | 없음 | [본문](assault-loop/LOOP-01.md) |
| LOOP-02 | [#695](https://github.com/Choyounhwa/-dream-guardian/issues/695) | 시드 기반36/40박 계획·검증 | Game | 01, #645 완료이력 | [본문](assault-loop/LOOP-02.md) |
| LOOP-03 | [#696](https://github.com/Choyounhwa/-dream-guardian/issues/696) | 996줄 Controller 표시조립 제한추출 | Game | 없음 | [본문](assault-loop/LOOP-03.md) |
| LOOP-04 | [#697](https://github.com/Choyounhwa/-dream-guardian/issues/697) | 구간시계·8박 내 TTS | Game | 01,02,03 | [본문](assault-loop/LOOP-04.md) |
| LOOP-05 | [#698](https://github.com/Choyounhwa/-dream-guardian/issues/698) | 입력창·휴식무피해·회피귀속 | Game | 04 | [본문](assault-loop/LOOP-05.md) |
| LOOP-06 | [#699](https://github.com/Choyounhwa/-dream-guardian/issues/699) | 마지막휴식 완료·실측요약 | Game | 04,05 | [본문](assault-loop/LOOP-06.md) |
| LOOP-07 | [#700](https://github.com/Choyounhwa/-dream-guardian/issues/700) | 실측러닝 집계포트 | Game | 01 | [본문](assault-loop/LOOP-07.md) |
| LOOP-08 | [#701](https://github.com/Choyounhwa/-dream-guardian/issues/701) | 997줄 Wire 입력라우팅 제한추출 | Core | 없음 | [본문](assault-loop/LOOP-08.md) |
| LOOP-09 | [#702](https://github.com/Choyounhwa/-dream-guardian/issues/702) | 라운드계획·numeric_repeat 조립 | Core | 02,04,05,06,07 | [본문](assault-loop/LOOP-09.md) |
| LOOP-10 | [#703](https://github.com/Choyounhwa/-dream-guardian/issues/703) | 휴식회수·직립관찰 배선검증 | Core | 05,08,09 | [본문](assault-loop/LOOP-10.md) |
| LOOP-11 | [#704](https://github.com/Choyounhwa/-dream-guardian/issues/704) | 러닝/폴백 실측 전달 | Core | 07,09,10 | [본문](assault-loop/LOOP-11.md) |
| LOOP-12 | [#705](https://github.com/Choyounhwa/-dream-guardian/issues/705) | boss_assault UI 기본 루프 선택·시작·재시작 보존 | Core | 08,09,10,11 | [본문](assault-loop/LOOP-12.md) |
| LOOP-13 | [#706](https://github.com/Choyounhwa/-dream-guardian/issues/706) | 구간/기회 스냅샷 | Game | 01,03,04,05 | [본문](assault-loop/LOOP-13.md) |
| LOOP-14 | [#707](https://github.com/Choyounhwa/-dream-guardian/issues/707) | run/rest 공격표시억제 | Render | 13 | [본문](assault-loop/LOOP-14.md) |
| LOOP-15 | [#708](https://github.com/Choyounhwa/-dream-guardian/issues/708) | 구간·기회·폴백 HUD | UI | 01,13 | [본문](assault-loop/LOOP-15.md) |
| LOOP-15a | [#709](https://github.com/Choyounhwa/-dream-guardian/issues/709) | 실제 HUD/장면 Core 전달 | Core | 09,12,13,14,15 | [본문](assault-loop/LOOP-15a.md) |
| LOOP-16 | [#710](https://github.com/Choyounhwa/-dream-guardian/issues/710) | 실진입·사망·기록호환 인수 | QA | 01~15 및15a | [본문](assault-loop/LOOP-16.md) |

17개로 분리한 이유: 996/997줄 파일의 제한추출2개, 표시 생성·Render·UI·실전달의 책임 분리, 순수운동집계와실제러닝전달 분리. 숫자상 목표(8~14개)보다 단일기능/최대3소스·설정 allowlist를 우선했다.

권장 직렬 실행(각 카드별 별도 승인): **694→695→696→697→698→699→700→701→702→703→704→705→706→707→708→709→710**. 번호순은 유효한 위상순서지만 일괄 실행 승인이 아니다. 같은 Factory/Wire/Controller 수정 카드 및 #537/#676/#660/REC/캐릭터SceneMotionCoordinator 작업은 동시 진행 금지. 착수 당시 HEAD/실제API/줄수를 재확인한다.

## 4. 기존 이슈와의 경계·중복 방지

- GitHub 열린이슈 목록 및 관련 본문/코멘트(#651,#658~665,#680,#588/#594/#596/#597/#604/#607/#609/#610/#613/#614,#616/#619,#676,#679,#537) 조사. 원격 OPEN과 로컬 완료기록이 다르더라도 기존이슈를 임의 CLOSE/재완료하지 않는다.
- **#651**: 고정 answer4+squat4의32박 패턴 완료는 보존. 이번36/40박 랜덤삽입·휴식루프의 대체구현/완료증거가 아니다.
- **#680**: approved CSV280행×4쌍은 데이터완료 이력일 뿐 게임연결 승인 아님. CSV 수정/재생성0.
- **#658~665**: 챌린지 게임연결 보류 유지. #658은 승인CSV행 로더로 재정의 예정, #659 유형스케줄러, #660 기존round source에challenge 연결, #661~663 보조문구표시, #664 계열요약, #665 챌린지인수의 독립 범위. 이번 numeric_repeat 루프와 중복등록하지 않는다. #661 필드는 현재 types에 있으나 인수 없이 이슈닫기0.
- **#588/#594**: 기존 additive읽기 완료이력 및 loop계획 없는 직접호출 호환 보존. boss_assault UI 기본루프는 추가 loop URL 없이 run8에읽기포함, 별도투척/읽기중복가산금지. 이전 코멘트의 '명시옵션만/무지정기존' 의미는 정정 코멘트로 대체한다.
- **REC #596/#597/#604/#607/#609/#610/#613/#614**: 기존 요약/공급/시계/진행/음향/수명/QA/직립 공개포트를 재사용. 새루프 경계지원만 추가하며 기존복구 재등록 아님. standing전달 등 정적의심은 LOOP-10에서 재현 후 조건부수정.
- **#616/#619**: 과거 전체추출 완료와 달리 LOOP-03/08은 새기능의1,000줄가드 선행을 위한 제한된 책임추출. 일반 리팩터 중복/대형구조개편 금지.
- **#537/#535/#538**: 실제 저장·보상·최종실기기인수는 기존카드범위. 이번에는 strict 저장형식·계획기회수 호환검증만 수행하도록 계획한다. 저장/보상 자동활성화·G4차단해제0.
- **#676** 기존 NEXT 변경0, lateGrace SSOT단일화와 새루프 경계별 유예0 주입을 혼동하지 않는다. 기본값170 변경0.

### 이번에 등록한 기존 이슈 경계 코멘트 (완료 보고 아님)

- 읽기 적용범위: [#588](https://github.com/Choyounhwa/-dream-guardian/issues/588#issuecomment-6443127536), [#594](https://github.com/Choyounhwa/-dream-guardian/issues/594#issuecomment-6443128149).
- 패턴/CSV 보존: [#651](https://github.com/Choyounhwa/-dream-guardian/issues/651#issuecomment-6443128714), [#680](https://github.com/Choyounhwa/-dream-guardian/issues/680#issuecomment-6443129254).
- 챌린지 보류/향후 연결경계: [#658](https://github.com/Choyounhwa/-dream-guardian/issues/658#issuecomment-6443123695), [#659](https://github.com/Choyounhwa/-dream-guardian/issues/659#issuecomment-6443124154), [#660](https://github.com/Choyounhwa/-dream-guardian/issues/660#issuecomment-6443124603), [#661](https://github.com/Choyounhwa/-dream-guardian/issues/661#issuecomment-6443125071), [#662](https://github.com/Choyounhwa/-dream-guardian/issues/662#issuecomment-6443125493), [#663](https://github.com/Choyounhwa/-dream-guardian/issues/663#issuecomment-6443125917), [#664](https://github.com/Choyounhwa/-dream-guardian/issues/664#issuecomment-6443126398), [#665](https://github.com/Choyounhwa/-dream-guardian/issues/665#issuecomment-6443126998).
- 실제저장·계획기회수 경계: [#537](https://github.com/Choyounhwa/-dream-guardian/issues/537#issuecomment-6443129715).
- 기존 이슈 본문/제목/상태/완료조건은 변경하지 않았다. 코멘트13건은 신규요구 영향의 좁은 경계만 기록했으며 구현 완료/테스트 Pass를 주장하지 않는다.

### 2026-10-27 기본 진입 요구불일치 정정

- 사용자 지적에 따라 **UI 기본 URL은 `http://localhost:3000/?mode=boss_assault`이며 추가 loop 파라미터는 필요 없다**로 바로잡았다. 과거 '명시루프/옵트인/기본경로보존'은 UI를 구형루프에 남겨두는 계약으로 사용할 수 없다.
- 신규 이슈 추가 없이 기존 **#697/#700/#702/#705/#706/#707/#708/#709/#710**의 로컬본문·원격본문을 동기화한다. #705 제목도 UI 기본 선택 책임으로 바로잡는다. 나머지8카드는 구조·추출·입력·집계 계약으로서 UI진입조건을 정하지 않아 본문 변경 불필요.
- #705는 UI resolver에서 새프로필 기본주입, #702는 범용 Factory 직접호출 호환만 유지, #710은 추가 loop URL/테스트 수동프로필 없이 첫시작·restart 종단 인수를 필수로 한다. #697/#700/#706~709도 내부 선택옵션·표시fixture 보존과 실제UI기본을 명확히 구분한다.
- 기존 경계코멘트13건을 전부 조사했다. #588/#594의 명시옵션 한정, #658~665의 명시루프/기본값보존 표현은 직접 정정하고, #651/#680/#537에도 패턴데이터·CSV/저장보존은 UI 기본변경과 양립한다는 경계를 추가한다. 과거 코멘트는 삭제하지 않고 후속 정정으로 적용범위를 명시한다.
- 제품코드/설정/테스트 수정·실행, 새이슈/이슈종료·구현완료처리, 커밋/푸시/PR/서버 없음. 이미 존재한 외부 변경은 보존하며 기존NEXT는 이동하지 않는다. 이번 정정은 명세 승인이지 구현 승인이 아니다.
- 정정 코멘트 등록 완료(기존13건+핵심신규카드2건): [#588](https://github.com/Choyounhwa/-dream-guardian/issues/588#issuecomment-6443311360), [#594](https://github.com/Choyounhwa/-dream-guardian/issues/594#issuecomment-6443311890), [#651](https://github.com/Choyounhwa/-dream-guardian/issues/651#issuecomment-6443312395), [#658](https://github.com/Choyounhwa/-dream-guardian/issues/658#issuecomment-6443312946), [#659](https://github.com/Choyounhwa/-dream-guardian/issues/659#issuecomment-6443313541), [#660](https://github.com/Choyounhwa/-dream-guardian/issues/660#issuecomment-6443314123), [#661](https://github.com/Choyounhwa/-dream-guardian/issues/661#issuecomment-6443314574), [#662](https://github.com/Choyounhwa/-dream-guardian/issues/662#issuecomment-6443315100), [#663](https://github.com/Choyounhwa/-dream-guardian/issues/663#issuecomment-6443315551), [#664](https://github.com/Choyounhwa/-dream-guardian/issues/664#issuecomment-6443316008), [#665](https://github.com/Choyounhwa/-dream-guardian/issues/665#issuecomment-6443316545), [#680](https://github.com/Choyounhwa/-dream-guardian/issues/680#issuecomment-6443317002), [#537](https://github.com/Choyounhwa/-dream-guardian/issues/537#issuecomment-6443317498), [#705](https://github.com/Choyounhwa/-dream-guardian/issues/705#issuecomment-6443317930), [#710](https://github.com/Choyounhwa/-dream-guardian/issues/710#issuecomment-6443318402)。

## 5. 전 카드 공통 실행/승인 계약

1. 표준 `[작업 ID] / 제목 / 목적 / 수정 대상 / 구현 내용 / 유지 사항 / 변경 금지 / 완료 조건 / 테스트 / 관련 파일`은 각 원본 본문에 명시했다. 신규경로까지 구체적 allowlist, 카드당 src/config 최대3개. 테스트는명시된파일만별도허용, 관련파일은읽기전용.
2. 사전 개별승인→dream_guardian에서 `npm test` Baseline→테스트선작성→`npx vitest run <본문의 대상파일>` 실제Red→별도턴 최소Green→전체 `npm test`100%Pass/`npm run build`. 테스트와구현동시수정금지. QA/characterization은가짜Red를만들지않는다.
3. **Pass와Fail 분리**, 파일/케이스수와실패케이스/에러·원인을기록한다. 브라우저/실기기미검증도별도기록. 필수실패/미검증이면DONE금지.
4. 파일은 **1,000줄 미만**, DRY/SRP. 범위밖/4번째소스/다른레이어 필요시즉시중단→별도카드·승인. 기존변경삭제/reset금지. 대형파일은先제한추출후기능카드.
5. 실제구현완료시 **Rule12 `gh issue comment <해당번호>` 필수**: 구현내용/변경파일/실제TDD/전체100%Pass/build/완료조건달성. HANDOVER에는완료ID/실제증거/다음승인대기카드기록. **Rule13 `npm run dev` 및 http://localhost:3000/ 상태안내**는 실제승인구현완료시에실행한다.
6. 커밋은 명시요청 시만 수행. 현재카드작성만으로 커밋/푸시/PR/서버 시작 및구현완료코멘트를등록하지않는다.

## 6. 이번 등록 세션 검증·제약

| 항목 | 결과 |
|---|---|
| 시작 `git status --short` | clean 확인. 본 에이전트는 아래 문서만 변경. 종료 확인 중 별도 동시 작업 변경이 나타나 보존함 |
| 신규 GitHub Issue | #694~#710 총17개, OPEN/승인대기, 본문재조회·표준필드 대조 |
| 본 에이전트의 제품 소스/config/테스트/CSV 변경 | 0개 (아래 외부 동시 변경과 구분) |
| npm test / npm run build / TDD | **미실행** — 카드작성 전용, Pass/Fail 판정 대상 아님 |
| 구현 완료 ID / 통과 테스트 수 | **없음 / 미실행** (과거6400여건 기록을이번결과로전용하지않음) |
| 커밋/푸시/PR/서버 | 미실행 |
| GitHub Project 등록 | `gh project list --owner Choyounhwa --format json`이 **read:project 권한 부족**으로 실패. Issues 등록은성공했으나 Project 보드편입은미완료. 토큰권한임의변경0 |
| 다음 후보 | LOOP-01 #694, **별도승인대기**. 기존 SSOT NEXT 불변 |

종료 확인 중 관측한 **외부 동시 작업 변경(수정/스테이지/리셋하지 않음)**: `dream_guardian/config/beat-motion.config.ts`, `src/types/index.ts`, `tests/unit/beat-clock-slot.test.ts`, `beat-timeline-synchronizer.test.ts`, `music-track-config.test.ts`, `question-approach-renderer.test.ts`, `question-renderer.test.ts`; 신규 `src/types/character-rig.ts`, `tests/unit/character-rig.test.ts`. 후속 재조회에서는 `src/game/beat/BeatTimelineSynchronizer.ts` 수정 및 `config/character-rig.config.ts`, `src/skeleton/rig/RigValidator.ts` 신규도 나타났고 question-approach-renderer 테스트는 상태목록에서 사라졌다. **동시 작업이 계속되고 있으므로 고정된 최종목록이 아닌 관측기록**이다. 경로 축약은 dream_guardian 기준. 현재 worktree 전체를 문서 변경만 있는 상태라고 주장하지 않는다.

원격 본문 검증 첫 시도는 Windows PowerShell 네이티브 출력 디코딩 문제로 JSON 파싱/한글필드 비교가 실패했다. UTF-8 출력 디코딩을 명시한 **읽기 전용 재검증에서17개 모두 OPEN/작업ID/필수9필드/한글정상 확인, 실패0**. 제품 테스트 결과와 무관하며 원격본문 손상이 아니었다.

초기 등록 때 `git diff --check` 실행 결과 공백오류 없음(성공). LF→CRLF 예정 경고만 발생했으며 줄바꿈 변환/외부파일 수정은 하지 않았다. 당시 추적 문서3개 변경은 추가만이었고 후속 기본진입 정정도 해당 신규섹션 내에서 수행한다. 기존 NEXT행 수정0. 신규 원장1개와 표준카드17개를 포함한 누적 작업산출물은 **문서21개**다.

### 기본진입 정정 검증 기록

- `gh issue edit --body-file`로 위9개 카드 원격본문을 로컬원본에서 갱신했고 #705 제목을 함께 정정했다. #694~710 전부 재조회하여 OPEN·표준9필드 유지 및 핵심 #705/#710의 기본URL 명시를 확인했다. 문서검증 실패0.
- 정정 코멘트15건 각각1건 등록됨을 `gh issue view --json comments`로 확인했다. 기존 경계코멘트는 이력으로 보존한다.
- `git diff --check` 공백오류 없음. 제품 테스트/빌드는 미실행으로 Pass/Fail 판정 없음. 제품 구현완료0.
- 정정 세션 시작부터 외부 제품변경이 존재했고 종료조회에서 외부 stage/변경목록도 변동했다. 이 에이전트는 stage/commit/reset을 하지 않았고 문서 밖 파일을 수정하지 않았다. HANDOVER 정정내용도 재읽기 확인했으며 동시 작업자의 변경은 보존했다.

### 최종 통합 인수 검증 증거표 (ASSAULT-LOOP-16 / #710)

| 계약 | 담당 카드/이슈 | 자동 검증 결과 | 브라우저/실환경 검증 (Chrome 가로/세로) | 최종 상태 |
|---|---|---|---|---|
| seed/36·40박/중복없는 1~2회 | #695/#710 | PASS (`assault-loop-plan.test.ts`, `assault-loop.test.ts`) | PASS (기본 URL 진입 시 36/40박 결정론적 전개 확인) | 인수완료 |
| 추가 loop URL 없는 boss_assault UI 기본 시작/restart | #705/#710 | PASS (`assault-loop-entry.test.ts`, `assault-loop.test.ts`) | PASS (`http://localhost:3000/?mode=boss_assault` 진입/재시작 시 정상 루프 구동) | 인수완료 |
| run8 내 문제/TTS·추가투척0 | #697/#702/#710 | PASS (`assault-loop-timeline.test.ts`, `assault-loop.test.ts`) | PASS (8박 중 문제 표시/TTS 1회 발화, 추가 투척/지연 0초 확인) | 인수완료 |
| answer4·rest2×4/무피해/직립 | #698/#703/#710 | PASS (`assault-loop-input-windows.test.ts`, `assault-loop.test.ts`) | PASS (선택 4박 정각 처리, 휴식 2박 중 무피해, 스쿼트 직립 복귀 정상) | 인수완료 |
| 완료1문제/사망우선/10문제 | #699/#702/#710 | PASS (`assault-loop-summary.test.ts`, `assault-loop.test.ts`) | PASS (4회 선택 후 마지막 휴식 완료 시 1문제 완료, HP 0 즉시 중단 확인) | 인수완료 |
| 실측러닝/폴백/시간 | #700/#704/#710 | PASS (`assault-loop-running-routing.test.ts`, `assault-loop.test.ts`) | PASS (러닝 8박 실측 스텝 및 키보드 1/2, 클릭 폴백 집계 확인) | 인수완료 |
| HUD/장면/음향/재시작 | #705~709/#710 | PASS (`assault-loop-render.test.ts`, `assault-loop-hud.test.ts`, `assault-loop.test.ts`) | PASS (HUD 잔여 박수·폴백 안내, 공격 렌더링 억제, 음향 정합성 확인) | 인수완료 |
| 계획기회40/저장형식/무오염 | #710 (실제저장#537) | PASS (`assault-loop.test.ts`) | PASS (테스트 세션 저장 쓰기 차단, 레거시 키 무오염 확인) | 인수완료 |

#### 17개 전 카드 통합 검증 상세 내역
| 카드 ID | GitHub Issue | 작업 명칭 | 검증 단위/통합 테스트 | 결과 |
|---|---|---|---|---|
| LOOP-01 | [#694](https://github.com/Choyounhwa/-dream-guardian/issues/694) | 독립 타입·설정 계약 | `tests/unit/assault-loop-contract.test.ts` (14 tests) | PASS |
| LOOP-02 | [#695](https://github.com/Choyounhwa/-dream-guardian/issues/695) | 시드 기반 36/40박 계획·검증 | `tests/unit/assault-loop-plan.test.ts` (18 tests) | PASS |
| LOOP-03 | [#696](https://github.com/Choyounhwa/-dream-guardian/issues/696) | Controller 표시조립 제한추출 | `tests/unit/assault-loop-presentation-extraction.test.ts` (13 tests) | PASS |
| LOOP-04 | [#697](https://github.com/Choyounhwa/-dream-guardian/issues/697) | 구간시계·8박 내 TTS | `tests/unit/assault-loop-timeline.test.ts` (15 tests) | PASS |
| LOOP-05 | [#698](https://github.com/Choyounhwa/-dream-guardian/issues/698) | 입력창·휴식무피해·회피귀속 | `tests/unit/assault-loop-input-windows.test.ts` (15 tests) | PASS |
| LOOP-06 | [#699](https://github.com/Choyounhwa/-dream-guardian/issues/699) | 마지막휴식 완료·실측요약 | `tests/unit/assault-loop-summary.test.ts` (14 tests) | PASS |
| LOOP-07 | [#700](https://github.com/Choyounhwa/-dream-guardian/issues/700) | 실측러닝 집계포트 | `tests/unit/assault-loop-exercise.test.ts` (15 tests) | PASS |
| LOOP-08 | [#701](https://github.com/Choyounhwa/-dream-guardian/issues/701) | Wire 입력라우팅 제한추출 | `tests/unit/assault-loop-input-extraction.test.ts` (12 tests) | PASS |
| LOOP-09 | [#702](https://github.com/Choyounhwa/-dream-guardian/issues/702) | 라운드계획·numeric_repeat 조립 | `tests/unit/assault-loop-factory.test.ts` (11 tests) | PASS |
| LOOP-10 | [#703](https://github.com/Choyounhwa/-dream-guardian/issues/703) | 휴식회수·직립관찰 배선검증 | `tests/unit/assault-loop-input-routing.test.ts` (13 tests) | PASS |
| LOOP-11 | [#704](https://github.com/Choyounhwa/-dream-guardian/issues/704) | 러닝/폴백 실측 전달 | `tests/unit/assault-loop-running-routing.test.ts` (14 tests) | PASS |
| LOOP-12 | [#705](https://github.com/Choyounhwa/-dream-guardian/issues/705) | boss_assault UI 기본 루프 선택·시작·재시작 | `tests/unit/assault-loop-entry.test.ts` (15 tests) | PASS |
| LOOP-13 | [#706](https://github.com/Choyounhwa/-dream-guardian/issues/706) | 읽기 전용 루프 표시 스냅샷 | `tests/unit/assault-loop-presentation.test.ts` (14 tests) | PASS |
| LOOP-14 | [#707](https://github.com/Choyounhwa/-dream-guardian/issues/707) | 러닝/휴식 구간 공격 렌더링 억제 | `tests/unit/assault-loop-render.test.ts` (14 tests) | PASS |
| LOOP-15 | [#708](https://github.com/Choyounhwa/-dream-guardian/issues/708) | 루프 구간 정보 및 폴백 안내 표시 | `tests/unit/assault-loop-hud.test.ts` (15 tests) | PASS |
| LOOP-15a | [#709](https://github.com/Choyounhwa/-dream-guardian/issues/709) | 실제 루프 HUD·구간스냅샷 Core 전달 | `tests/unit/assault-loop-display-wiring.test.ts` (14 tests) | PASS |
| LOOP-16 | [#710](https://github.com/Choyounhwa/-dream-guardian/issues/710) | 실제 진입 경로 루프·사망·기록호환 통합 인수 | `tests/integration/assault-loop.test.ts` (15 tests) | PASS |

*환경별 참고사항: Chrome(Windows 데스크톱 가로 1920x1080 및 세로 모바일 에뮬레이션) 실환경 검증 완료. Safari/Firefox 및 실제 모바일 하드웨어는 테스트 환경 제약으로 미검증(미실행) 명시.*
