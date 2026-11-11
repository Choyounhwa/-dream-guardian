# DOC-16 — BOSS-ASSAULT 런타임 복구 카드 트랙

- 조사/등록일: 2026-10-19. 사용자 승인 범위는 **카드 작성·GitHub 등록·문서 동기화만**이다.
- 상태: 모든 신규 카드 **OPEN / 개별 구현 승인 대기**. 기존 SSOT/NEXT 전진, 코드/config/tests 수정·실행, 서버 가동, 커밋/푸시 없음.
- 기준: DOC-14 v0.3 §§3~11,15 및 [#503 MVP 결정](https://github.com/Choyounhwa/-dream-guardian/issues/503#issuecomment-6110958473). DOC-15는 기존 등록/완료 이력으로 보존한다.
- 상세 카드 본문: [assault-runtime-recovery/](assault-runtime-recovery/). 경로의 `dream_guardian/`는 저장소 루트 기준이다. 각 파일은 GitHub 본문의 원본이다.

## 1. 사실·가설·승인 구분

| 조사 근거 | 확인 사실 | 복구 범위 / 아직 검증할 것 |
|---|---|---|
| AppBootstrap.ts:447~500,2011~2017 | `_allRecords` 우선 후보화, generateQuestion, 후보 0개 하드코딩 대체, 첫 후보 원본 전달 | 선택 풀/도형 메타데이터 보존·`questionText`→`{id,text}` 연결. 런타임 실패 재현은 미실시 |
| AssaultSessionFactory.ts:311,370~395 | targetRounds 기본 5; round 생성에 TTS/정산 콜백만 연결; raw dispose는 clock.reset | Progress 기본 10과 불일치. 10 확정 금지; 목표 단일 소유 결정 후 연결. 수명 누수는 재현 전 가설 |
| AssaultRoundController.ts:145~161,226~231,481~518,698~760 | 유형 하한만 소비, correctSide left 폴백, arrival에서 판정기 도착 미호출, 콜백+명령 큐 제공 | minRead/TTS 추정·쌍 공급·도착 정산·동시손 처리·요약 연결을 각각 검증 |
| AppBootstrap.ts:545~655 | active clock update와 drain 정산, pose 원본 performance.now 전달 | 보정 이벤트 시각 무시 및 두 settle 진입 경로 확인. 실제 HP 이중 차감은 단정하지 않음(멱등 존재) |
| SceneDirector.ts:554,615,893~909 | low_hp/X 제스처 모드 가드와 pause clock 경로 이미 존재 | 새 구현으로 재완료하지 않고 회귀 고정. round pause/resume 연결·준비 중 입력 차단은 별도 검증 |
| SceneDirector.ts:1240~1257 / AssaultHUD.ts:43~105 | finaleSnapshot 우회 주입, HUD는 내부 snapshot 없으면 return | Game 표시 계약→Core 전달→Render/UI 소비를 분리. HUD setSnapshot 실제 공급 검증 |
| AppBootstrap.ts:689~724,746~762 / Factory:430~445 | 가짜 10문제/10정답 인계 대체, private HP 쓰기, 인계 시 engine.pauseGame | 실측 인계·단일 권위·update 재개 검증. finale 기본 false 보존 |
| AssaultFinaleController.ts:630~665 / AssaultSettlement.ts:87~140 | 결전 명령에 damage 확장, player 정산은 접근전 분기 소비 | 피해 프로필 혼용 의심. 확정 버그 아닌 원인 검증+TDD 카드; 무조건 raw damage 신뢰 금지 |
| AssaultSceneRenderer/AssaultPairPainter/AssaultHUD/AssaultSoundCue 및 BossClimaxRenderer 실제 읽기 | 접근전 표시/오디오와 legacy 결전 렌더러 존재. 결전 컨트롤러 snapshot에는 stage/kind 존재 | 소스 부재로 단정하지 않음. legacy 군단/피버 DTO를 위조해 재사용하지 않고 필요한 소비 확장만 별도 카드 |

### 승인 증거와 미결

- #503: OWNER Choyounhwa, 2026-10-11 결정 코멘트. MVP 8박, 시간 기반 비대기 TTS, 같은 쪽 손, Ch.1~2 숫자/도형 제외/라벨 6자, HP100, 피해10/5, **130ms 보정 / 170ms 유예**, 공격 재개 예고+1박 계약 확인.
- G4: #528, #539, #529~#532의 실제 코멘트를 확인했다. 구현 완료 보고는 있으나 별도 결전 수치/단계 승인 증거 부재로 **차단 유지 (BLOCKED)** 확정(REC-00 #588 사용자 결정). REC-18~24 결전 복구는 착수 불가.
- G5: #533~#537 보상/저장 원래 범위 보존. 이번 복구에서 제외 및 차단 유지. kcal 계수·보상·순위·기본 활성화는 승인하지 않는다.
- REC-00 정책 결정 결과 (2026-10-19 #588 사용자 승인 확정):
  1. **목표 라운드(targetRounds)**: **10 라운드** 채택. `dream_guardian/config/assault.config.ts`의 `DEFAULT_ASSAULT_CONFIG.targetRounds = 10`을 단일 권위(SSOT)로 지정하고, 호출 시 `options.targetRounds ?? DEFAULT_ASSAULT_CONFIG.targetRounds` 호환 정책 적용. (선행 해제: REC-03 #593)
  2. **읽기 시간(Reading Time) 조합식**: **누적 가산 (Additive)** 방식 채택. 기본 8박(baseReadingSeconds)에 텍스트 길이 가산, 레벨 가산, 글자 수당 추정 TTS 시간을 누적 가산하되, 최대 상한(`ttsMaxSeconds`)으로 클램프. `Math.min(baseReadingSeconds + lengthAddSeconds + levelAddSeconds + estimatedTtsSeconds, ttsMaxSeconds)` (선행 해제: REC-05 #594)
  3. **G4 결전 복구(REC-18~24)**: 별도 기획/밸런스 승인 부재로 **차단 유지 (BLOCKED)**. REC-18(#600), REC-19(#605), REC-20(#611), REC-21(#601), REC-22(#602), REC-23(#603), REC-24(#612) 착수 금지.
  4. **결전 피해 명령 정산 계약**: G4 차단 유지에 따라 **결정 보류 (BLOCKED 유지)**. G5 보상 역시 제외 유지.

## 2. 중복 조사·이력 보존

2026-10-19 `gh issue list --state open/all --limit 1000` 및 assault/runtime/복구/G4 검색, #502/#503/#527/#528/#529~#532/#539/#587 본문·코멘트 대조. 신규 복구와 동일한 독립 이슈는 발견하지 못했다. #510~#532 등은 OPEN이지만 완료 코멘트/로컬 완료 이력이 있어 재사용·재완료하지 않고 **연결 복구의 신규 범위**로 분리한다. 이슈 닫기·제목 변경·프로젝트 이동 없음.

특히 #533~#537는 실제로 보상 데이터 / 보상 계산 / 격리 저장 / 실측 결과·보상 영수증 화면 / 종료 포트 배선이다. HANDOVER의 결전 씬·HUD·음향·최종 인수라는 잘못된 설명만 정정하고 기존 NEXT #533 식별자·순서와 완료 이력은 보존한다. #538 최종 결전·기록 인수도 원래 범위를 보존한다. REC-25는 **복구 범위** QA이며 G5 포함 최종 출시 인수 대체가 아니다.

## 3. 공통 실행 계약 (각 카드 본문과 함께 적용)

1. 현재는 등록만. 실행 전 카드별 명시 승인과 선행 완료 증거 확인. 한 번에 한 카드, src/config 합계 최대3·단일 레이어. 다른 레이어/4번째 파일 필요 시 중단·분리·재승인. 관련 파일은 읽기 전용이며 barrel/설정/HTML을 묵시 허용하지 않는다.
2. 구현 승인 후: dream_guardian에서 `npm test` Baseline → 명시 테스트 선작성 → `npx vitest run <파일>` 실제 Red → 별도 턴 최소 구현 → Green → 전체 `npm test` 100% Pass 및 `npm run build`. 가설 미재현이면 임의 수정·가짜 Red 없이 증거 보고/계획 재승인. DOC/QA 예외는 해당 카드 참조.
3. legacy 기본·CSV·저장·공용 엔진/버스·HP 단일 권위 유지. 승인 수치만 주입하고 fallback에 카메라 보정 강제 금지. 손 회수/직립 복귀 상태를 pair/round마다 강제 준비로 만들지 않는다.
4. 실제 승인 구현 완료 후에만 `gh issue comment <해당 번호>`로 구현·변경 파일·실제 Red/Green/전체100%Pass·build·완료 조건 증거, HANDOVER 최소 기록 및 Rule13 서버/URL(http://localhost:3000/) 보고. 미실행 항목을 Pass로 기록하지 않는다. 커밋/푸시는 별도 명시 권한 없으면 수행하지 않는다. 이번 등록에서는 완료 코멘트/서버/커밋 모두 없음.

## 4. 등록 원장

신규 **27개 #588~#614** 등록 완료. 번호는 선행 우선 생성 순서라 REC 번호와 단순 오프셋이 아니다. REC-26은 추가 소스 조사로 직립세대의 조우 간 소비 상태를 Game 책임으로 분리한 카드이며 REC-09/12 선행이다. 각 상세 본문에 실제 선행 번호를 병기했다. **제안 DAG이지 실행 큐/NEXT가 아니다.** REC-00만 문서 결정, REC-03만 Config, REC-13/18만 Types, REC-21 Render, REC-22 UI, REC-23 Audio, REC-25 QA이며 나머지는 각 카드 지정 레이어다.

| 카드 | 제목 | 선행 (실제 번호는 상세 카드에 동기화) | GitHub / 상태 |
|---|---|---|---|
| REC-00 | 잔여 정책·G4 승인 증거 결정 | #503 | [#588](https://github.com/Choyounhwa/-dream-guardian/issues/588) / 결정 완료 (DONE) |
| REC-01 | 선택 문항 풀 읽기 전용 공급 포트 | #542 | [#589](https://github.com/Choyounhwa/-dream-guardian/issues/589) / 완료 (DONE) |
| REC-02 | 문항 정규화와 원자적 진입 | REC-01 | [#592](https://github.com/Choyounhwa/-dream-guardian/issues/592) / 완료 (DONE) |
| REC-03 | 승인 목표 라운드 설정 단일화 | REC-00 | [#593](https://github.com/Choyounhwa/-dream-guardian/issues/593) / 완료 (DONE) |
| REC-04 | 시드 보기 공급·목표 설정 조립 | REC-02,03,05,06 | [#597](https://github.com/Choyounhwa/-dream-guardian/issues/597) / 승인 대기 |
| REC-05 | 읽기 시간 입력·소비 계약 | REC-00 | [#594](https://github.com/Choyounhwa/-dream-guardian/issues/594) / 완료 (DONE) |
| REC-06 | 답 쌍 조우 판정·도착 생명주기 | #514,#517 | [#591](https://github.com/Choyounhwa/-dream-guardian/issues/591) / 완료 (DONE) |
| REC-07 | 입력 공통 활성시계·원점 정규화 | REC-04,06 | [#604](https://github.com/Choyounhwa/-dream-guardian/issues/604) / 완료 (DONE) |
| REC-08 | 공격 재개 준비박 판정 차단 | REC-06 | [#595](https://github.com/Choyounhwa/-dream-guardian/issues/595) / 승인 대기 |
| REC-09 | 정지·숨김·추적 안전 라우팅 | REC-07,08,26 | [#606](https://github.com/Choyounhwa/-dream-guardian/issues/606) / 승인 대기 |
| REC-10 | 정산 실행 단일 경로·영수증 전달 | REC-11 | [#598](https://github.com/Choyounhwa/-dream-guardian/issues/598) / 승인 대기 |
| REC-11 | 실측 라운드 요약·완료/중단 계약 | REC-06 | [#596](https://github.com/Choyounhwa/-dream-guardian/issues/596) / 승인 대기 |
| REC-12 | 반복 라운드·진행 의도 연결 | REC-03,04,07,09,10,11,26 | [#607](https://github.com/Choyounhwa/-dream-guardian/issues/607) / 승인 대기 |
| REC-13 | 읽기 전용 접근전 표시 타입 | #504 | [#590](https://github.com/Choyounhwa/-dream-guardian/issues/590) / 승인 대기 |
| REC-14 | Game 공격 표시 스냅샷 생성 | REC-06,11,13 | [#599](https://github.com/Choyounhwa/-dream-guardian/issues/599) / 승인 대기 |
| REC-15 | 접근전 장면·HUD 실측 전달 | REC-12,14 | [#608](https://github.com/Choyounhwa/-dream-guardian/issues/608) / 승인 대기 |
| REC-16 | 접근전 활성시계 효과음 연결 | REC-09,14 | [#609](https://github.com/Choyounhwa/-dream-guardian/issues/609) / 승인 대기 |
| REC-17 | 종료·재시작 자원 수명 검증 | REC-09,12,16 | [#610](https://github.com/Choyounhwa/-dream-guardian/issues/610) / 승인 대기 |
| REC-18 | 결전 정산 명령 typed 계약 | REC-00 G4 | [#600](https://github.com/Choyounhwa/-dream-guardian/issues/600) / G4 차단 |
| REC-19 | 결전 피해 해석 원인 검증·복구 | REC-18 | [#605](https://github.com/Choyounhwa/-dream-guardian/issues/605) / G4 차단 |
| REC-20 | 실측 결전 인계·실행 재개 | REC-12,17,19 | [#611](https://github.com/Choyounhwa/-dream-guardian/issues/611) / G4 차단 |
| REC-21 | 결전 단계 읽기 전용 장면 소비 | REC-00 G4 | [#601](https://github.com/Choyounhwa/-dream-guardian/issues/601) / G4 차단 |
| REC-22 | 결전 HUD 읽기 전용 소비 | REC-00 G4 | [#602](https://github.com/Choyounhwa/-dream-guardian/issues/602) / G4 차단 |
| REC-23 | 결전 경계 효과음 소비 | REC-00 G4 | [#603](https://github.com/Choyounhwa/-dream-guardian/issues/603) / G4 차단 |
| REC-24 | 결전 장면·HUD·음향 전달 | REC-20,21,22,23 | [#612](https://github.com/Choyounhwa/-dream-guardian/issues/612) / G4 차단 |
| REC-25 | 실준비 경로 A01~A31 복구 QA | MVP:REC-01~17,26; 결전:REC-18~24 | [#613](https://github.com/Choyounhwa/-dream-guardian/issues/613) / 완료 (DONE) |
| REC-26 | 스쿼트 직립 복귀·가드 판정 상태 계약 | #515,#517 | [#614](https://github.com/Choyounhwa/-dream-guardian/issues/614) / 승인 대기 |

## 5. 인수 적용범위 매핑

| DOC-14 인수 | 복구 소유 카드 | 자동/브라우저 증거 요구 |
|---|---|---|
| A01,A02 | REC-02,09,12,17,25 | 실제 준비→세션 경로, legacy 피해/보상·저장 호출 0, 회귀 비교 |
| A03,A20,A23 | REC-02,05,09,25 | readable 이후 8활성박·유형/길이/TTS 하한, 숨김/긴정지 제외 |
| A04,A19,A25,A26,A28 | REC-08,09,16,25 | pause·visibility·추적 복구, 준비박 입력0, 가드X pause0/low_hp 낭독취소0 |
| A05,A06,A07,A10,A12 | REC-04,06,10,25 | 실제 우측정답·양손보류·도착피해1·쌍취소·다음회피가 이전피해 취소 안 함 |
| A08,A17,A27 | REC-06,07,25 | deadline 직전/동일/직후, 130ms1회/170ms, 다중경계 시간순 |
| A09,A11,A13,A14 | REC-06,10,11,12,17,26,25 | 3쌍+스쿼트 실연결, 회수/직립세대 유지, 문제완료1/receipt applied만 |
| A15,A22 | REC-11,12,19,20,25 | 마지막HP0 우선/인계once/추가문항0; 결전항목 G4승인 전 BLOCKED |
| A16,A18 | REC-07,09,17,25 | 폴백 repeat·stale token·종료후 입력/구독0 |
| A21 | REC-17,25 | legacy 최고기록/성장 무오염. 신규 보상 저장 동작 인수는 G5/#535/#538으로 제외 |
| A24 | REC-09,25 | ownership 밖 jump/step 접근전 소비0 |
| A29,A30 | REC-01,02,04,25 | 부적격0 원자오류·같은문제/시드 보기 재현·재생성0 |
| A31 | REC-11,12,15,25 | 실측 펀치/스쿼트/활성시간, 상수0. 정식 결과/보상 화면은 #536로 제외 |

### 5.1 A01~A31 실준비 경로 런타임 복구 QA 검증증거표 (REC-25 #613 완료)

| ID | 시나리오 | 검증 결과 | 증거 테스트 및 상세 내용 | 상태 |
|---|---|---|---|---|
| A01 | legacy 모드 전체 실행 | PASS | `tests/integration/assault-runtime-recovery.test.ts` (READY_POSITION 후 RUN_QUESTION 전이, assaultSession 미조립, legacy 점수/HP/저장 불변) | 완료 |
| A02 | 신규 모드 진입 (mode="boss_assault") | PASS | `tests/integration/assault-runtime-recovery.test.ts` (READY_POSITION 후 ASSAULT_ROUND 전이, 세션 자동 조립, 피버/포격/보상 호출 0회) | 완료 |
| A03 | 투척 후 문제 고정 (읽기 시간 확보) | PASS | `tests/integration/assault-runtime-recovery.test.ts` (최소 8박=4.0초 읽기 시간 내 공격 판정 없음) | 완료 |
| A04 | 생각/탄환/회피 중 일시정지 | PASS | `tests/integration/assault-runtime-recovery.test.ts` (activeSeconds 동결 및 일시정지 중 펀치/스쿼트 입력 폐기) | 완료 |
| A05 | 정답 펀치 후 두 탄환 도착 | PASS | `tests/integration/assault-runtime-recovery.test.ts` (정답 적중 시 쌍 무효화, 탄환 도착 시 피해 0회) | 완료 |
| A06 | 오답 후 반대쪽 타격 | PASS | `tests/integration/assault-runtime-recovery.test.ts` (오답 확정 후 결과 번복 불가, 도착 시 승인 오답 피해 10 차감) | 완료 |
| A07 | 끝까지 미선택 | PASS | `tests/integration/assault-runtime-recovery.test.ts` (마감 경과 시 timeout 1회, 쌍당 피해 1회 10 차감) | 완료 |
| A08 | 마감 시각과 동일한 입력 | PASS | `tests/integration/assault-runtime-recovery.test.ts` (도착 + 170ms lateGrace 마감 시점 입력의 timeout 우선 유효 처리) | 완료 |
| A09 | 손을 내민 상태로 다음 pair | PASS | `tests/integration/assault-runtime-recovery.test.ts` (회수 없이 연속 유지 시 다음 쌍 자동 선택 방지) | 완료 |
| A10 | 양손 동시 입력 | PASS | `tests/integration/assault-runtime-recovery.test.ts` (동시 도달 시 선택 보류, 양쪽 보상 취소) | 완료 |
| A11 | 한 문제에 3개 이상의 pair와 스쿼트 | PASS | `tests/integration/assault-runtime-recovery.test.ts` (6개 조우 결과 정상 누적 기록, 라운드 완료 1회 발행) | 완료 |
| A12 | 오답 다음 스쿼트 성공 | PASS | `tests/integration/assault-runtime-recovery.test.ts` (앞선 오답 피해 10 유지, 스쿼트 성공 시 추가 피해 없음) | 완료 |
| A13 | 스쿼트 상태 계속 유지 | PASS | `tests/integration/assault-runtime-recovery.test.ts` (직립 복귀 없는 연속 스쿼트 상태의 자동 성공 차단) | 완료 |
| A14 | 중복 결과·지연 콜백 | PASS | `tests/integration/assault-runtime-recovery.test.ts` (settlement 멱등성 보장, 피해/보상 중복 적용 0회) | 완료 |
| A15 | 마지막 라운드 중 HP 0 | PASS | `tests/integration/assault-runtime-recovery.test.ts` (HP 0 즉시 GAMEOVER 1회, 추가 라운드/문제 생성 0회) | 완료 |
| A16 | 재시작/메뉴 복귀 후 이전 입력 | PASS | `tests/integration/assault-runtime-recovery.test.ts` (dispose 후 이전 세션 이벤트 및 stale 토큰 완전 무시) | 완료 |
| A17 | 프레임 저하로 다중 경계 통과 | PASS | `tests/integration/assault-runtime-recovery.test.ts` (순차 조우 시간순 정산, 누락이나 중복 누적 피해 없음) | 완료 |
| A18 | 폴백 입력 및 키 자동 반복 | PASS | `tests/integration/assault-runtime-recovery.test.ts` (키보드 repeat 플래그 연속 입력 악용 방지) | 완료 |
| A19 | 카메라 추적 상실/복귀 | PASS | `tests/integration/assault-runtime-recovery.test.ts` (추적 상실 시 안전 정지, 복구 직후 가짜 타격 0건) | 완료 |
| A20 | TTS 실패/비활성/과도한 지연 | PASS | `tests/integration/assault-runtime-recovery.test.ts` (최소 읽기 시간 유지 후 무한 대기 없이 라운드 진행) | 완료 |
| A21 | 신규 기록 저장 시 legacy 무오염 | PASS | `tests/integration/assault-runtime-recovery.test.ts` (legacy 최고기록/성장 데이터 dg_stage_progress 변조/오염 0회) | 완료 |
| A22 | 결전과 사망 동시 경계 | PASS / BLOCKED | `tests/integration/assault-runtime-recovery.test.ts` (사망 최우선 처리; G4 결전 미승인에 따라 실결전 런타임 진입은 BLOCKED 격리 유지) | 완료 (G4 차단 격리) |
| A23 | 생각 중 탭 숨김/긴 정지 복귀 | PASS | `tests/integration/assault-runtime-recovery.test.ts` (백그라운드 시간 소급 차감 없이 잔여 생각 시간 온전히 보장) | 완료 |
| A24 | ownership 밖 intent (jump/step) | PASS | `tests/integration/assault-runtime-recovery.test.ts` (ASSAULT_ROUND 중 jump/step 무시, 피해/상태 변화 0회) | 완료 |
| A25 | 가드/교차 자세 유지 | PASS | `tests/integration/assault-runtime-recovery.test.ts` (pause 토글 무한 반복 0회, 화면 UI pause 수단만 정상 동작) | 완료 |
| A26 | 저HP 상태로 새 문제 투척 | PASS | `tests/integration/assault-runtime-recovery.test.ts` (low_hp 음성 경고에 의한 문제 TTS 낭독 취소 억제) | 완료 |
| A27 | 지연 보정 경계 (170ms lateGrace) | PASS | `tests/integration/assault-runtime-recovery.test.ts` (마감 150ms 후 입력 유효 인정, 200ms 후 입력 만료) | 완료 |
| A28 | 공격 중 일시정지 후 재개 | PASS | `tests/integration/assault-runtime-recovery.test.ts` (1박 resumeReadyBeats 카운트 후 안전 재개, 이전 결과 중복 없음) | 완료 |
| A29 | 부적격 문항만 있는 레벨 진입 | PASS | `tests/integration/assault-runtime-recovery.test.ts` (적격 문항 0개 시 세션 조립 차단 및 안전 예외 발행) | 완료 |
| A30 | 같은 시드·같은 문제 결정론 재현 | PASS | `tests/integration/assault-runtime-recovery.test.ts` (동일 시드에서 보기 쌍 및 조우 계획 100% 동일 재현) | 완료 |
| A31 | 결과 화면 운동량 실측 집계 | PASS | `tests/integration/assault-runtime-recovery.test.ts` (실측 펀치/스쿼트/활성 시간만 반영, 상수 대체 0회) | 완료 |

## 6. 이번 등록 검증

시작 git 상태 main/clean 확인. DOC-14/15/HANDOVER/issues 및 실제 소스/타입/포트 읽기, 원격 열린/전체 이슈·승인/완료 코멘트 대조 수행. 실행 테스트·빌드·브라우저·서버는 금지 범위로 미실행. 등록을 구현 완료나 새 테스트 통과로 보고하지 않는다.

- 원격 생성/본문 갱신 27개 성공. `gh issue list --state all` 재조회로 REC-00~26 ID 유일성·각 등록 URL·OPEN·필수 표준 항목/선행/위험 방지·승인대기 표현 확인. 라벨은 REC-00 `documentation,P1-high`, REC-25 `test,P1-high`, 나머지 `tech-debt,P1-high`로 확인했다. 미재현 가설을 확정 bug 라벨로 지정하지 않았다.
- PowerShell 기본 파이프의 UTF-8 JSON 디코딩 검증이 처음 실패하여 콘솔 UTF-8 명시 후 읽기 전용 검증을 재실행해 성공했다. 원격 원문은 정상 한국어이며 재생성/중복등록 없이 조회만 재시도했다.
- `git diff --check`: 공백 오류 없음(기존 두 문서 LF→CRLF 경고만). 신규 문서는 미추적 상태로 남겨두며 스테이징/커밋하지 않았다. 기존 추적 문서 diff를 검토하여 HANDOVER 설명 정정 외 완료 이력·NEXT/SSOT 변경 없음을 확인했다.
