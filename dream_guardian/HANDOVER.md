# 🌙 《꿈의 수호신 (Dream Guardian)》 프로젝트 인수인계 및 후속 작업 안내서

## 2026-11-10 boss_assault 브랜치 정상화 및 3단계 PR 분할 작업 카드 등록 (DOC-23) — 구현 승인 아님

- 근거: [DOC-23 원장](../docs/23_BOSS_ASSAULT_BRANCH_REORGANIZATION_CARDS.md)
- 배경: `boss-assault` 브랜치가 192개 커밋, 342개 변경 파일로 비대화되어 단일 PR 머지가 위험하므로, 6대 도메인을 3단계 PR로 분할하여 `main`에 안전하게 흡수시키는 로드맵 수립.
- 카드 순서:
  - **[✔ 완료] [#758](https://github.com/Choyounhwa/-dream-guardian/issues/758) REFACTOR-BRANCH-001**: boss-assault 브랜치 100% Green 베이스라인 고정 및 미커밋 자산 정리 (`427dcf0`, 500 files / 6,907 tests pass)
   - **[✔ 완료] [#759](https://github.com/Choyounhwa/-dream-guardian/issues/759) REFACTOR-BRANCH-002**: [PR-1] Core/Architecture 모놀리스 분할 및 공통 인프라 독립 브랜치 분리 (`pr/assault-core-arch`, PR [#763](https://github.com/Choyounhwa/-dream-guardian/pull/763), 412 files / 5,668 tests pass, build pass)
   - **[✔ 완료] [#760](https://github.com/Choyounhwa/-dream-guardian/issues/760) REFACTOR-BRANCH-003**: [PR-2] Question Challenge 수학 엔진 & Stickman Character Rig 독립 브랜치 분리 (`pr/assault-math-rig`, PR [#764](https://github.com/Choyounhwa/-dream-guardian/pull/764), 436 files / 6,111 tests pass, build pass)
   - **[▶ NEXT] [#761](https://github.com/Choyounhwa/-dream-guardian/issues/761) REFACTOR-BRANCH-004**: [PR-3] Boss Assault 24박 루프, 타이밍 판정, Audio/VFX 및 UI 정산 브랜치 분리 (`pr/assault-gameplay-loop`)
  - **[#762](https://github.com/Choyounhwa/-dream-guardian/issues/762) QA-BRANCH-005**: [QA] main 병합 단계별 회귀 검증 및 후속 트랙 격리 환경 검증 (제품 수정 0)
- 전 카드 OPEN·개별 승인 대기.

## 2026-11-10 boss_assault 달리기 페이즈 시각 가이드 트랙 카드 등록 — 구현 승인 아님

- 근거: [DOC-22 원장](../docs/22_ASSAULT_RUN_GUIDANCE_CARDS.md) (배경 F1~F7 · 확정 결정 D1~D6 · 코드 지도 · config SSOT `config/assault-run.config.ts` · 공통 게이트 §7).
- 확정 결정: D1 문제 카드 선명도 달리기 연동(8박 시간 하한) / D2 연출 전용(마나·HP·점수 변경 0) / D3 고스트는 첫 루프 + 정지 시만 / D4 졸라맨과 겹친 오라 고스트 박자 바운스 / D6 루프 타임라인·TTS·판정기 불변.
- 카드 순서: **#746(BUG-ASSAULT-010 그리드 BPM 고정 0.5s)** → #747 → #748 → **#749(실경로 연결)** → #750 → #751 → #752 → #753 → #754(Stickman 옵션, 회귀 핵심) → #755 → **#756(고스트 실연결)** → **#757(최종 인수, 제품 수정 0)**. 전 카드 OPEN·개별 승인 대기.
- **필수 게이트(DOC-22 §7)**: 연결 카드는 `?mode=boss_assault` `AppBootstrap` 실부팅 통합 테스트(수동 주입 금지)·화면 전달 데이터 관찰·연결 전 Red 기록·`http://localhost:3000/?mode=boss_assault` 직접 플레이 기록(미확인=“미검증”, DONE 금지)·라운드별 `[assault-run]` 콘솔 로그 없이는 DONE 금지. 트랙 공용 실경로 테스트 파일: `tests/integration/assault-run-path.test.ts`.
- 이 등록 작업에서 src/config/CSV/테스트 변경 0.

## 2026-11-09 답안 보기 난이도 A1~A3 트랙 카드 등록 — 구현 승인 아님

- 근거: [DOC-21 §13](../docs/21_QUESTION_ANSWER_GENERATION_SPEC.md). boss_assault 전용. A1 어림(튜토리얼·챕터 SubLevel 1) / A2 정밀 오개념(중간) / A3 연쇄 쌍별 규칙+보조 문구(챕터 마지막 SubLevel).
- 카드: #735 → #736 → #737 → #738 → **#739(A1/A2 실연결)** → #740 → **#741(A3 실연결)** → **#742(보조 문구 Render)** → **#743(최종 실경로 인수, 제품 수정 0)**. 전 카드 OPEN·개별 승인 대기, 자동 NEXT/체이닝 대상 아님.
- **필수 게이트(§13.7)**: 모듈만 만들고 게임에 미적용되는 문제 방지. 연결 카드는 `AppBootstrap` + `?mode=boss_assault` 실경로 통합 테스트(수동 주입 금지)·표시 스냅샷 관찰·연결 전 Red 기록·`http://localhost:3000/?mode=boss_assault` 수동 플레이 기록·`[assault-tier]` 콘솔 로그 없이는 DONE 금지.
- 소스/config/CSV/테스트 변경 0.
- **[✔] [#744](https://github.com/Choyounhwa/-dream-guardian/issues/744) FEAT-ASSAULT-LOOP-019 boss_assault 루프 사전 배치 스쿼트 임시 제거 — 답안 4회 24박 완료**: #734 보류 기간 동안 `minSquatsPerRound: 0`, `maxSquatsPerRound: 0` 설정으로 러닝 8박 + 답안 4회(16박) = 24박(120BPM 12초) 무스쿼트 루프 구성, 실경로 G-A~G-D 인수 및 커스텀 프로필 스쿼트 생성 기능 100% 보존. (500 files / 6,901 tests pass, build pass)
- **#734 보류** (동적 스쿼트 + 회피 성공 시 감면으로 정책 결정, 착수 전 해결 사항은 이슈 코멘트). 임시 대체 **#744 FEAT-ASSAULT-LOOP-019** 완료됨.
- **[✔] [#745-A](https://github.com/Choyounhwa/-dream-guardian/issues/745) 시간 전 타격 Early MISS 판정 완료** (`9eb9b8c`): `EarlyMiss: 170` config SSOT 활성화, 정박 170ms 이전 타격은 정답 여부 무관 MISS(잠금/피해 없음, 재선택 허용). 회귀 16개 테스트 파일 유효 구간 타이밍 이관. (500 files / 6,907 tests pass, build pass). G-D 직접 플레이 미검증.
- **[▶ NEXT] #745-B** 리듬 등급 배지 연동: `AssaultImpactWireHelper`에서 `rhythmRating` → `badgeText` 전달(PERFECT/GOOD/EARLY/LATE) + 시간 전 MISS 배지 표출 (render/bootstrap 레이어, 별도 승인 필요).

## 2026-10-27 새 루프 카드 등록 인계 — 구현 승인 아님

- 목표(기본진입 정정): **`http://localhost:3000/?mode=boss_assault`만으로 UI 첫시작/restart에서 Core가 새루프를 기본 선택**, 추가 loop URL/사용자 loopProfile 지정 불필요. **run8+(answer4)×4 (쉬는 박자 0박 삭제)**, 동일문제/정답4기회. seed+round기반squat4박1~2회추가 →28/32박(120BPM 14/16초). 문제읽기/TTS1회는run8내, 별도투척1초/읽기이중대기0. 마지막답안후완료1문제·사망우선·HP100/wrong·miss10/squatFail5/목표10 유지.
- **작성·등록만 완료**: [DOC-19 원장](../docs/19_BOSS_ASSAULT_LOOP_CARDS.md), 표준본문 `docs/assault-loop/` 17개. **완료된 구현ID 없음 / 통과 테스트 미실행 / 전 카드 OPEN·개별승인대기**. 본 카드작성 에이전트의 src/config/tests/CSV수정·테스트/빌드·커밋/푸시/PR/서버시작 없음.
- 기존최상위 NEXT **#676(또는 #537)** 및캐릭터트랙 **#678** 유지. 아래트랙의 첫후보 **#694는별도승인대기**이며 자동NEXT/체이닝대상이아님.
- #651 고정answer4+squat4의32박패턴과구조다름, DEFAULT변경0. numeric_repeat/기존questions.csv먼저. #658~665 챌린지연결·#537 저장/보상실연결·G4결전/마나는보류. 996줄Controller/997줄Wire는기능추가전제한추출필수.
- 보존대상은 DEFAULT **패턴데이터**·비boss legacy·loopProfile 없는 범용 Factory 직접호출 테스트다. boss_assault UI 기본동작을 구형루프로 유지하라는 뜻이 아니다. LOOP-12 #705 기본주입/LOOP-16 #710 추가 loop URL 없는 인수로 수정하고 관련9카드·문서·경계코멘트를 정합화한다. 명세정정만 수행, 구현승인/완료 아님.

- **[✔] #717 ASSAULT-BEAT-001 보스 접근전 루프 박자 개편 완료**: 쉬는 박자(rest 2박)를 0박으로 삭제하고 러닝 8박, 답안 4박 × 4회 유지, 총 24박(스쿼트 포함 시 28/32박, 14/16초)으로 개편. 전체 단위/통합 테스트 6,801건 100% Pass 및 빌드 통과.
- **[✔] [#722](https://github.com/Choyounhwa/-dream-guardian/issues/722) BUG-ASSAULT-PUNCH-001 가슴 대기 자세(Chest Guard) 기반 펀치 인식 및 needsMotionReprep 영구 락 해제 결함 수정 완료**: clock.needsMotionReprep 정상 포즈 수신 시 자동 락 해제, punchReachRatio 1.00 / elbowAngle 135도 현실화, 가슴 대기 자세 및 IDLE 신전 시 1회 발화/중복 방지 완료. (6,814 tests pass, build pass)
- **[✔] [#719](https://github.com/Choyounhwa/-dream-guardian/issues/719) BUG-FEEDBACK-002 퀴즈 모드 정답/오답 2박 쉼표 유지 및 QuestionRenderer O/X 판정 스탬프·피드백 UI 효과 연동 완료**: answerRestBeats 기본 2박 보장, feedbackCustomText/Color stateRef 연동, 정답(초록, O) 및 오답(붉은색, X, 정답 유도 테두리) 스탬프 렌더링. (6,816 tests pass, build pass)
- **[✔] [#676](https://github.com/Choyounhwa/-dream-guardian/issues/676) REFACTOR-DRY-005 접근전 config deepFreeze 5중 복제 제거 완료**: 5개 assault config의 로컬 deepFreeze 중복 정의를 제거하고 공용 유틸 import로 통합 완료 (bc06455, 4f16fdf, 15 tests pass).
- **2026-11-01 설계 검토 보완 완료 (#724/#725/#726 본문 갱신, #730 신규 분리)** — 진행 순서 #725 → #724 → #726 → #730. 카드 본문에 화이트리스트·정확한 수식·이전 대상 테스트·중단 조건 명시. 구현 승인 아님.
- **[✔] [#725](https://github.com/Choyounhwa/-dream-guardian/issues/725) FEAT-SKEL-LIMIT-001 졸라맨 팔 관절 스냅 방지 완료** (e3ea05a): `ArmAngleStabilizer.ts`/`angleMath.ts` 신규, `PoseAngleSolver` 팔 4뼈 안정화 경로 분리, `PoseFrame.armConfidence` 출력, `STICKMAN_ARM_STABILIZER_CONFIG`. 494 files / 6,831 tests pass, build pass.
- **[✔] [#724](https://github.com/Choyounhwa/-dream-guardian/issues/724) FEAT-INPUT-JOIN-001 합장 0.18/해제 0.22 히스테리시스 + 0.3초 dwell 완료** (b1049a5): `DEFAULT_JOINED_HANDS_CONFIG`(cursor.config.ts), MenuInput dwell 상태머신, SceneMotionCoordinator dt 전달, 기존 테스트 4개 파일 16개 호출 dwell 인자 이전. 495 files / 6,843 tests pass, build pass. 가드 자세 0.3초 이상 유지 시 오발동 리스크는 config 밸런스로 대응.
- **[✔] [#726](https://github.com/Choyounhwa/-dream-guardian/issues/726) FEAT-ASSAULT-PUNCH-002 졸라맨 팔 방향·신전율 기반 Stroke 펀치 완료**: `StickmanPunchStroke.ts` 신규, `legacy_box` 롤백 모드 유지, `onPreExtendedHold` 이벤트, `PoseFrame.armConfidence` 연동. 496 files / 6,862 tests pass, build pass.
- **[✔] [#727](https://github.com/Choyounhwa/-dream-guardian/issues/727) BUG-ASSAULT-Q-001 Boss Assault 후보 추출 typeof number 사전 필터 제거 완료**: `extractQuestionCandidates`의 인라인 `typeof number` 사전 필터 제거, 숫자형 문자열 정답 문항 후보 편입 및 `checkQuestionEligibility` SSOT 단일화 완료. 497 files / 6,873 tests pass, build pass.
- **[✔] [#728](https://github.com/Choyounhwa/-dream-guardian/issues/728) BUG-QUESTION-FLOAT-001 소수 문항 정답/오답 부동소수점 오차(0.30000000000000004) 정규화 완료** (49ef38f): `QuestionEvaluator.ts`의 `normalizeNumeric` 헬퍼 적용으로 변수/템플릿/정답/오답의 IEEE 754 부동소수점 오차 정규화. 497 files / 6,876 tests pass, build pass.
- **[✔] [#731](https://github.com/Choyounhwa/-dream-guardian/issues/731) FEAT-ASSAULT-FRAC-001 AssaultAnswerPairFactory 분수 정답 보기쌍 생성 지원 완료** (184f6a5): 단순 분수 라벨 `^\d+\/\d+$` 분수 경로 분기, `Rational.ts` SSOT 재사용, `preferredWrong` 분수 경로 전용 지원. 497 files / 6,880 tests pass, build pass.
- **[✔] [#732](https://github.com/Choyounhwa/-dream-guardian/issues/732) FEAT-ASSAULT-FRAC-002 Boss Assault 적격성 판정 단순 분수 정답 허용 완료** (3f1bf8b): `config/assault-question.config.ts`의 `allowSimpleFraction: true` 추가 및 `AssaultQuestionEligibility.ts` 단순 분수 적격 처리, `SIMPLE_FRACTION_REGEX` 단일화. 497 files / 6,887 tests pass, build pass.
- **[✔] [#733](https://github.com/Choyounhwa/-dream-guardian/issues/733) FEAT-ASSAULT-FRAC-003 Assault 후보 조립 시 CSV 오답을 분수 보기쌍 우선 오답으로 전달 완료** (b0eed7b): `AssaultImpactWireHelper.assembleQuestionPair` 문자열 오답 보존 및 `AssaultLoopRoundAssembler`/`AssaultSessionFactory`에서 `providePairs` 호출 시 `preferredWrong` 전달 연동. 498 files / 6,891 tests pass, build pass.
- **[✔] [#678](https://github.com/Choyounhwa/-dream-guardian/issues/678) FEAT-SKEL-007 상위 본 추종 기반 하체 기하학 재설계 및 스쿼트·점프 모션 시각화 개선 완료** (ee74705): 상위 본 추종 하체 기하학, 발목 화면 밖 시 종아리 굴곡 유도, 점프 시 지면 그림자 디커플링, 스쿼트 무릎 굴곡 개선.
- **[✔] [#537](https://github.com/Choyounhwa/-dream-guardian/issues/537) BOSS-ASSAULT-35 결과·보상·저장 종료 포트 배선 완료** (db9652b): 단일 종료 소유자에서 summary→32→33→34 포트 1회 연결, 테스트 세션 지급/저장 차단, 별도 승인 기록 세션 옵션 허용. 499 files / 6,895 tests pass, build pass.
- **[✔] 전체 GitHub 작업 카드 마일스톤 100% 달성 완료**: GitHub Issue 전체 0건 OPEN (모든 등록 카드 구현 및 검증 완료).


| 작업 ID (ASSAULT-LOOP-) | GitHub | 대상 | 상태 |
|---|---|---|---|
| BEAT-01 | [#717](https://github.com/Choyounhwa/-dream-guardian/issues/717) | 박자개편(러닝8·답안4·휴식0) | `[✔] 완료` (6801 tests pass) |
| 01 | [#694](https://github.com/Choyounhwa/-dream-guardian/issues/694) | 독립타입·설정 | `[✔] 완료` (ec2654b, 6568 tests pass) |
| 02 | [#695](https://github.com/Choyounhwa/-dream-guardian/issues/695) | 시드36/40박계획·검증 | `[✔] 완료` (6591 tests pass) |
| 03 | [#696](https://github.com/Choyounhwa/-dream-guardian/issues/696) | Controller표시제한추출 | `[✔] 완료` (e624935) |
| 04 | [#697](https://github.com/Choyounhwa/-dream-guardian/issues/697) | 구간시계·TTS | `[✔] 완료` (2d892d8) |
| 05 | [#698](https://github.com/Choyounhwa/-dream-guardian/issues/698) | 입력창·휴식무피해 | `[✔] 완료` (6628 tests pass) |
| 06 | [#699](https://github.com/Choyounhwa/-dream-guardian/issues/699) | 마지막휴식완료·요약 | `[✔] 완료` (6642 tests pass) |
| 07 | [#700](https://github.com/Choyounhwa/-dream-guardian/issues/700) | 실측러닝집계 | `[✔] 완료` (4c702d9, 6653 tests pass) |
| 08 | [#701](https://github.com/Choyounhwa/-dream-guardian/issues/701) | Wire입력제한추출 | `[✔] 완료` (acd3b35, 6667 tests pass) |
| 09 | [#702](https://github.com/Choyounhwa/-dream-guardian/issues/702) | numeric_repeat조립 | `[✔] 완료` (ef0cf09, 6678 tests pass) |
| 10 | [#703](https://github.com/Choyounhwa/-dream-guardian/issues/703) | 휴식관찰배선검증 | `[✔] 완료` (4853186, 6689 tests pass) |
| 11 | [#704](https://github.com/Choyounhwa/-dream-guardian/issues/704) | 러닝·폴백전달 | `[✔] 완료` (476ee52, 6699 tests pass) |
| 12 | [#705](https://github.com/Choyounhwa/-dream-guardian/issues/705) | boss_assault UI 기본선택·시작·restart | `[✔] 완료` (1d7fa01, 6712 tests pass) |
| 13 | [#706](https://github.com/Choyounhwa/-dream-guardian/issues/706) | 구간표시snapshot | `[✔] 완료` (a19e2a4, 6722 tests pass) |
| 14 | [#707](https://github.com/Choyounhwa/-dream-guardian/issues/707) | run/rest장면 | `[✔] 완료` (7d64649, 6735 tests pass) |
| 15 | [#708](https://github.com/Choyounhwa/-dream-guardian/issues/708) | HUD안내 | `[✔] 완료` (468c22b, 6744 tests pass) |
| 15a | [#709](https://github.com/Choyounhwa/-dream-guardian/issues/709) | 실제Core표시전달 | `[✔] 완료` (ea6a15b, 6755 tests pass) |
| 16 | [#710](https://github.com/Choyounhwa/-dream-guardian/issues/710) | 실제경로통합인수 | `[✔] 완료` (6770 tests pass) |

- 인계주의: 각본문의선행/최대3src·config allowlist/TDD Baseline→Red→Green→전체test/build/Pass·Fail분리/Rule12완료comment/Rule13구현완료시서버를준수. 카드등록은구현승인이아님. GitHub Project편입은토큰 `read:project` 권한부족으로미완료(Issues등록은성공), 권한임의변경0.
- 종료확인중 외부동시변경 발견: beat-motion.config/공용types index/beat·question 관련테스트 및 BeatTimelineSynchronizer 소스, character-rig 타입·config·validator·테스트신규 등. 이 에이전트 변경과별개로 전부보존(수정·stage·reset0), 시점별관측은 DOC-19 §6. 시작시clean이었으나 종료시worktree전체가문서변경뿐인것은아님.

본 문서는 사용자가 이후 작업을 바로 이어서 진행할 수 있도록 프로젝트의 전체 맥락, 파일 구성, 구현 완료 현황, 실행 방법 및 다음 개발 과제를 정리한 단일 진실 공급원(SSOT) 문서입니다.

> 📦 **과거 상세 이력 아카이브 안내**:
> 2026년 10월 22일 이전의 4,000여 줄에 달하는 세부 커밋 로그 및 완료 이력은 git 추적에서 제외된 로컬 백업 파일(`docs/archive/HANDOVER_backup_20261023.md`)에 안전하게 전량 보관되어 있습니다.

---

## 🧭 전체 소스 코드 중복 제거(DRY) 및 단일 책임(SRP) 모듈화 로드맵 (SSOT)

| 작업 ID | GitHub Issue | 카드 제목 | 대상 파일 | 우선순위 | 진행 상태 |
|---|---|---|---|---|---|
| **REFACTOR-DRY-001** | [#628](https://github.com/Choyounhwa/-dream-guardian/issues/628) | `deepFreeze` 유틸리티 단일화 및 11개 파일 중복 제거 | `src/utils/deepFreeze.ts` (신규) | P1-High | `[✔] 완료` |
| **REFACTOR-DRY-002** | [#629](https://github.com/Choyounhwa/-dream-guardian/issues/629) | SHA-256 암호화 해시 및 16진수 변환 유틸리티 단일화 | `src/utils/crypto.ts` (신규) | P1-High | `[✔] 완료` |
| **REFACTOR-DRY-003** | [#630](https://github.com/Choyounhwa/-dream-guardian/issues/630) | Web AudioContext 팩토리 및 사운드 합성기 공통 로직 추출 | `src/audio/AudioContextFactory.ts` (신규) | P2-Medium | `[✔] 완료` |
| **REFACTOR-DRY-004** | [#631](https://github.com/Choyounhwa/-dream-guardian/issues/631) | 프레젠테이션 슬롯 오버라이드 베이스 인터페이스 공통화 | `src/types/presentation.ts` (신규) | P2-Medium | `[✔] 완료` |
| **REFACTOR-SRP-001** | [#632](https://github.com/Choyounhwa/-dream-guardian/issues/632) | `AppBootstrap` 전역 DOM/윈도우 이벤트 리스너 관리자 분리 | `src/core/bootstrap/AppEventListenerManager.ts` (신규) | P1-High | `[✔] 완료` |
| **REFACTOR-SRP-002** | [#633](https://github.com/Choyounhwa/-dream-guardian/issues/633) | `AppBootstrap` 전투·스펠·보스 피격 애니메이션 이벤트 바인더 분리 | `src/core/bootstrap/AppBattleEventBinder.ts` (신규) | P1-High | `[✔] 완료` |
| **REFACTOR-SRP-003** | [#634](https://github.com/Choyounhwa/-dream-guardian/issues/634) | `AppBootstrap` 스테이지 진행도 및 하이스코어 영속성 관리자 분리 | `src/core/bootstrap/AppPersistenceManager.ts` (신규) | P1-High | `[✔] 완료` |
| **REFACTOR-SRP-004** | [#635](https://github.com/Choyounhwa/-dream-guardian/issues/635) | `SceneDirector` 모션 인식 파이프라인 및 신체 프레이밍 처리기 분리 | `src/core/director/SceneMotionCoordinator.ts` (신규) | P1-High | `[✔] 완료` |
| **REFACTOR-SRP-005** | [#636](https://github.com/Choyounhwa/-dream-guardian/issues/636) | `SceneDirector` 7계층 캔버스 레이어 렌더링 디스패처 분리 | `src/core/director/SceneRenderDispatcher.ts` (신규) | P1-High | `[✔] 완료` |
| **REFACTOR-SRP-006** | [#637](https://github.com/Choyounhwa/-dream-guardian/issues/637) | `SceneDirector` HUD·피트니스 궤적·결과 UI 갱신 조정자 분리 | `src/core/director/SceneUIOverlayCoordinator.ts` (신규) | P1-High | `[✔] 완료` |
| **REFACTOR-SRP-007** | [#638](https://github.com/Choyounhwa/-dream-guardian/issues/638) | `SceneDirector` 런타임 게임 세션 라이프사이클 관리자 분리 | `src/core/director/SceneSessionLifecycleManager.ts` (신규) | P1-High | `[✔] 완료` |
| **REFACTOR-SRP-008** | [#639](https://github.com/Choyounhwa/-dream-guardian/issues/639) | `SceneDirector` 키보드·터치 수동 입력 리스너 디스패처 분리 | `src/core/director/SceneManualInputDispatcher.ts` (신규) | P1-High | `[✔] 완료` |
| **REFACTOR-SRP-009** | [#640](https://github.com/Choyounhwa/-dream-guardian/issues/640) | `SceneDirector` 보스 접근전(Assault) 전용 씬 핸들러 분리 | `src/core/director/AssaultSceneHandler.ts` (신규) | P1-High | `[✔] 완료` |
| **REFACTOR-SRP-010** | [#641](https://github.com/Choyounhwa/-dream-guardian/issues/641) | `SceneDirector` 상태 전이(State Change) 라우터 분리 | `src/core/director/SceneStateChangeRouter.ts` (신규) | P1-High | `[✔] 완료` |
| **REFACTOR-SRP-011** | [#642](https://github.com/Choyounhwa/-dream-guardian/issues/642) | `SceneDirector` 화면 크기 변경(Resize) 핸들러 분리 | `src/core/director/SceneResizeHandler.ts` (신규) | P1-High | `[✔] 완료` |
| **REFACTOR-SRP-012** | [#643](https://github.com/Choyounhwa/-dream-guardian/issues/643) | `SceneDirector.ts` 1,000줄 이하 슬림화 및 파사드(Facade)화 | `src/core/SceneDirector.ts` | P1-High | `[✔] 완료` (1,677→382줄) |
| **REFACTOR-SRP-013** | [#677](https://github.com/Choyounhwa/-dream-guardian/issues/677) | `config/ui.config.ts` 1,031줄 → 1,000줄 이하 (UI 이미지 에셋 모듈 분리) | `config/ui-image-assets.config.ts` (신규) | P1-High | `[✔] 완료` (b65b18d, 1,031→880줄) |
| **REFACTOR-DRY-005** | [#676](https://github.com/Choyounhwa/-dream-guardian/issues/676) | 접근전 config `deepFreeze` 5중 복제 및 `lateGrace` 상수 중복 제거 | `config/assault*.config.ts` | P2-Medium | `[✔] 1단계 완료` (bc06455·4f16fdf, 로컬 deepFreeze 0건 / lateGrace 170 단일화 2단계는 BUG-ASSAULT-005 #673 이후 별도 카드) |

> **[✔] #711 RENDER-QUESTION-APPROACH-002 러닝+문제(8) 4박 원근 포커싱·블러 감쇠 및 점진적 브라이트닝 출현 효과 구현 완료** (commit 대기, `config/beat-motion.config.ts`(`approachBeats: 4`, `startBlur: 12`, `startBrightness: 0.4`), `src/game/beat/BeatTimelineSynchronizer.ts`, `src/render/QuestionApproachRenderer.ts`, `src/render/QuestionRenderer.ts`, 단위 테스트 80/80 Pass, 전체 463 files / 6,477 tests Pass, build 성공)
> **[✔] #680 ASSAULT-CHALLENGE-CH-23 챌린지 CSV 행당 4쌍 전환 + 280행 재생성·approved 완료** (commit `afff8e9`, `config/assault-challenge.config.ts`(`pairsPerRow: 4` SSOT), `ChallengeCsvValidator.ts`/`ChallengeCsvWriter.ts`(26열), `scripts/export-assault-challenges.ts`, `assault_challenges.csv` 280행 approved, 전체 455 files / 6394 tests Pass, build 성공)
> **[✔] #651 ASSAULT-CHALLENGE-CH-06 다중 답 쌍 접근전 패턴 데이터 추가 완료** (commit `e6968a2`, `src/data/assault/approachPatterns.ts`(MULTI_PAIR_20_APPROACH_PATTERN 20박 3쌍, MULTI_PAIR_32_APPROACH_PATTERN 32박 4쌍, APPROACH_PATTERNS 등록), `tests/unit/assault-multi-pair-pattern.test.ts` 13/13 Pass, 전체 456 files / 6407 tests Pass, build 성공) → **다음: #658 CH-13 챌린지 라운드 어댑터 또는 #676 REFACTOR-DRY-005**
> **[✔] #669 BUG-ASSAULT-001 완료** (commit `fea96c2`, `src/core/bootstrap/AssaultSessionWireHelper.ts`, `tests/unit/bug-assault-001-punch-route.test.ts` 4/4 Pass, 전체 100% Pass, build 성공)
> **[✔] #670 BUG-ASSAULT-002 완료** (commit `55d50c3`, `src/core/director/AssaultSceneHandler.ts`, `tests/unit/bug-assault-002-normalized-landmarks.test.ts` 7/7 Pass, 전체 100% Pass, build 성공)
> **[✔] REC-04 #597 시드 보기 공급·목표 설정 조립 완료** (commit `05f9e2f`, `src/core/AssaultSessionFactory.ts`, `tests/unit/assault-recovery-factory.test.ts` 8/8 Pass, 전체 100% Pass, build 성공)
> **[✔] REC-07 #604 입력 공통 활성시계·라운드 원점 정규화 완료** (commit `feb27e5`, `src/core/AssaultClockAdapter.ts`, `src/core/AssaultSessionFactory.ts`, `src/core/bootstrap/AssaultSessionWireHelper.ts`, `tests/unit/assault-recovery-clock-wiring.test.ts` 10/10 Pass, 전체 100% Pass, build 성공)
> **[✔] REC-08 #595 공격 재개 준비박 판정 차단 완료** (commit `8559d41`, `src/game/assault/AssaultRoundController.ts`, `tests/unit/assault-recovery-resume.test.ts` 7/7 Pass, 전체 100% Pass, build 성공)
> **[✔] REC-26 #614 스쿼트 직립 복귀·가드 판정 상태 계약 검증 완료** (commit `dfbfcf7`, `src/game/assault/AssaultRoundController.ts`, `src/game/assault/AssaultSquatJudge.ts`, `tests/unit/assault-recovery-squat-round.test.ts` 7/7 Pass, 전체 100% Pass, build 성공)
> **[✔] REC-09 #606 정지·숨김·추적 안전 라우팅 검증·복구 완료** (commit `ec5352c`, `src/core/AssaultClockAdapter.ts`, `src/core/SceneDirector.ts`, `src/core/bootstrap/AssaultSessionWireHelper.ts`, `tests/unit/assault-recovery-safety-wiring.test.ts` 9/9 Pass, 전체 100% Pass, build 성공)
> **[✔] REC-11 #596 실측 라운드 요약·완료/중단 계약 복구 완료** (commit `e2397fe`, `src/game/assault/AssaultRoundController.ts`, `src/game/assault/AssaultRoundSummary.ts`, `tests/unit/assault-recovery-summary.test.ts` 8/8 Pass, 전체 100% Pass, build 성공)
> **[✔] REC-10 #598 정산 실행 단일 경로·영수증 전달 복구 완료** (commit `2ee8387`, `src/core/AssaultSessionFactory.ts`, `src/core/bootstrap/AssaultSessionWireHelper.ts`, `tests/unit/assault-recovery-settlement-wiring.test.ts` 6/6 Pass, 전체 100% Pass, build 성공)
> **[✔] REC-12 #607 반복 라운드·진행 의도 Core 연결 복구 완료** (commit `3a5a4f6`, `src/core/AssaultSessionFactory.ts`, `src/core/bootstrap/AssaultSessionWireHelper.ts`, `tests/unit/assault-recovery-progression.test.ts` 7/7 Pass, 전체 100% Pass, build 성공)
> **[✔] REC-13 #590 읽기 전용 접근전 표시 타입 계약 완료** (commit `21cb170`, `src/types/assault.ts`, `tests/unit/assault-recovery-presentation-types.test.ts` 11/11 Pass, 전체 100% Pass, build 성공)
> **[✔] REC-14 #599 Game 공격 표시 스냅샷 생성 복구 완료** (commit `5e83436`, `src/game/assault/AssaultRoundController.ts`, `tests/unit/assault-recovery-presentation.test.ts` 6/6 Pass, 전체 100% Pass, build 성공)
> **[✔] REC-15 #608 접근전 장면·HUD 실측 전달 복구 완료** (commit `cb315c5`, `src/core/AssaultSessionFactory.ts`, `src/core/director/AssaultSceneHandler.ts`, `src/core/bootstrap/AssaultSessionWireHelper.ts`, `tests/unit/assault-recovery-display-wiring.test.ts` 7/7 Pass, 전체 100% Pass, build 성공)
> **[✔] REC-16 #609 접근전 활성시계 효과음 Core 연결 완료** (commit `6d3e1cc`, `src/core/AssaultSessionFactory.ts`, `src/core/bootstrap/AssaultSessionWireHelper.ts`, `tests/unit/assault-recovery-audio-wiring.test.ts` 9/9 Pass, 전체 100% Pass, build 성공)
> **[✔] REC-17 #610 종료·재시작 자원 수명 검증·복구 완료** (commit `3826061`, `src/core/AssaultSessionFactory.ts`, `src/core/SessionLifecycle.ts`, `src/core/bootstrap/AssaultSessionWireHelper.ts`, `tests/unit/assault-recovery-lifecycle.test.ts` 7/7 Pass, 전체 100% Pass, build 성공)
> **[✔] #671 BUG-ASSAULT-003 오답 피해 즉시 적용 완료** (commit `3f4f733`, `src/game/assault/AssaultPairJudge.ts`, `src/game/assault/AssaultRoundController.ts`, `tests/unit/bug-assault-003-arrival-damage.test.ts` 7/7 Pass, 전체 100% Pass, build 성공)
> **[✔] #672 BUG-ASSAULT-004 펀치 가짜 타격 경계 완료** (commit `73187a5`, `src/input/AssaultPunchAdapter.ts`, `tests/unit/bug-assault-004-punch-edge.test.ts` 4/4 Pass, 전체 100% Pass, build 성공)
> **[✔] #673 BUG-ASSAULT-005 리듬 등급·콤보 정의 DOC-14 C4/config 정합성 완료** (`src/game/assault/AssaultPairJudge.ts`, `src/game/assault/AssaultRoundController.ts`, `src/game/assault/AssaultRoundSummary.ts`, `src/types/assault.ts`, `tests/unit/bug-assault-005-rhythm-combo.test.ts` 6/6 Pass, 전체 100% Pass, build 성공)
> **[✔] #674 BUG-ASSAULT-006 패턴·BPM 설정 정합성 완료** (`config/assault.config.ts`, `src/game/assault/AssaultPlanCompiler.ts`, `src/core/AssaultClockAdapter.ts`, `src/game/assault/AssaultRoundController.ts`, `src/data/assault/approachPatterns.ts`, `tests/unit/bug-assault-006-pattern-bpm.test.ts` 10/10 Pass, 전체 100% Pass, build 성공)
> **[✔] #675 BUG-ASSAULT-007 결전 저충격 점프 필드 및 ASSAULT_FINALE 동작 소유권 정합성 완료** (`config/judgment.config.ts`, `src/game/assault/AssaultFinaleController.ts`, `src/core/bootstrap/AssaultSessionWireHelper.ts`, `tests/unit/bug-assault-007-finale-jump-ownership.test.ts` 7/7 Pass, 전체 100% Pass, build 성공)
> **[✔] REC-25 #613 실준비 경로 A01~A31 런타임 복구 QA 완료** (`tests/integration/assault-runtime-recovery.test.ts` 23/23 Pass, `docs/16_BOSS_ASSAULT_RUNTIME_RECOVERY_CARDS.md`, 전체 100% Pass, build 성공)
> **[✔] #690 ASSAULT-FX-001 비트 그리드 펄스 복원 및 분리형 바닥 판정선 어댑터 구현 완료** (commit `6f7524f`, `config/assault-visual.config.ts`, `src/render/assault/AssaultFloorMatAdapter.ts`, `src/core/director/AssaultSceneHandler.ts`, `tests/unit/assault-floor-grid.test.ts` 12/12 Pass, 전체 457 files / 6419 tests Pass, build 성공)
> **[✔] #691 ASSAULT-FX-002 어설트 화면 흔들림(Screen Shake) 및 이펙트 파이프라인 연동 완료** (commit `5863fe2`, `config/assault-visual.config.ts`, `src/core/director/AssaultSceneHandler.ts`, `tests/unit/assault-shake-render.test.ts` 7/7 Pass, 전체 458 files / 6426 tests Pass, build 성공)
> **[✔] #692 ASSAULT-FX-003 정답 사방 폭죽·글자 팝핑 및 오답 디졸브 타격 이펙트 구현 완료** (commit `47e7054`, `src/render/assault/AssaultImpactVFX.ts`, `src/render/AssaultPairPainter.ts`, `src/core/director/AssaultSceneHandler.ts`, `src/core/bootstrap/AssaultSessionWireHelper.ts`, `src/core/bootstrap/AssaultImpactWireHelper.ts`, `tests/unit/assault-impact-vfx.test.ts` 14/14 Pass, 전체 459 files / 6440 tests Pass, build 성공)
> **[✔] #693 BUG-DEVUI-003 HUD 계열 UI 요소 좌표 스케일링 누락으로 인한 Dev 인스펙터 점선 위치 불일치 수정 완료** (`src/ui/HUDLayer.ts`, `src/dev/LayoutRegistry.ts`, `config/ui.config.ts`, `tests/unit/bug-devui-003.test.ts` 5/5 Pass, 전체 460 files / 6445 tests Pass, build 성공)
> **[✔] #689 FEAT-CHAR-001 CharacterDefinition 레지스트리 및 캐릭터 선택 UI·부트스트랩 주입 완료 (캐릭터 리그 로드맵 9/9 완결)** (`src/types/character-definition.ts`, `src/data/characters/`, `src/ui/CharacterSelectModal.ts`, `src/core/bootstrap/BootstrapSubsystemFactory.ts`, `tests/unit/character-registry.test.ts` 19/19 Pass, 전체 470 files / 6548 tests Pass, build 성공)
> **[▶ NEXT]** [#676 REFACTOR-DRY-005](https://github.com/Choyounhwa/-dream-guardian/issues/676) 접근전 config deepFreeze 및 lateGrace 상수 중복 제거 2단계 (또는 [#537](https://github.com/Choyounhwa/-dream-guardian/issues/537))

## 🦊 캐릭터 리그(SD/동물 의인화 스킨) 로드맵 (SSOT, 2026-10-25 등록)

- **확정 결정**: 자체 구현(Spine/DragonBones 미도입) / 시각-판정 정렬 **A안 분리 표시**(판정 = 원본 랜드마크, 4색 커서 최상단 별도 표시, IK 없음) / 아트 **부위별 개별 PNG** + `skin.json` pivot 메타
- **착수 시점**: 현 `[▶ NEXT]`(#676) 이후 순서대로 진행

| 순서 | 작업 ID | GitHub Issue | 카드 제목 | 레이어 | 진행 상태 |
|---|---|---|---|---|---|
| 1 | REFACTOR-SKEL-001 | [#682](https://github.com/Choyounhwa/-dream-guardian/issues/682) | StickmanRenderer 각도 추출(PoseAngleSolver) 분리·PoseFrame 도입 | skeleton | `[✔] 완료` |
| 2 | FEAT-SKEL-007 | [#678](https://github.com/Choyounhwa/-dream-guardian/issues/678) | 하체 계층 기하 재설계 (PoseAngleSolver 위에서, 범위 조정) | skeleton | `[✔] 완료` |
| 3 | FEAT-RIG-001 | [#683](https://github.com/Choyounhwa/-dream-guardian/issues/683) | CharacterRig 데이터 스키마·config·검증기 | types/config | `[✔] 완료` |
| 4 | FEAT-RIG-002 | [#684](https://github.com/Choyounhwa/-dream-guardian/issues/684) | 데이터 기반 RigSolver FK·관절 제한·feet 접지 | skeleton | `[✔] 완료` |
| 5 | FEAT-SKIN-001 | [#685](https://github.com/Choyounhwa/-dream-guardian/issues/685) | 부위별 PNG CharacterAvatarRenderer·4색 커서 분리 표시 | skeleton/render | `[✔] 완료` |
| 6 | FEAT-RIG-003 | [#686](https://github.com/Choyounhwa/-dream-guardian/issues/686) | 꼬리·귀 보조 본 스프링 물리 | skeleton | `[✔] 완료` |
| 7 | FEAT-ANIM-001 | [#687](https://github.com/Choyounhwa/-dream-guardian/issues/687) | 애니메이션 클립·레이어 블렌딩·본 마스크 | skeleton | `[✔] 완료` |
| 8 | FEAT-ANIM-002 | [#688](https://github.com/Choyounhwa/-dream-guardian/issues/688) | CharacterActionController 이벤트→행동 트리거 | game/skeleton | `[✔] 완료` |
| 9 | FEAT-CHAR-001 | [#689](https://github.com/Choyounhwa/-dream-guardian/issues/689) | CharacterDefinition 레지스트리·캐릭터 선택 UI | data/ui | `[✔] 완료` |

---

## 2026-10-22 DOC-14 구현 대조 버그 카드 등록 (구현 승인 아님)

- **근거**: DOC-14 v0.3 대비 코드 대조 분석. 순수 모듈은 대부분 존재하나 런타임 배선 미완(1라운드만 진행, 카메라 판정 불능, 정답 항상 left, HUD/결과 미표시). 기존 REC 카드(#595~#614)와 겹치지 않는 결함만 신규 등록.
- **등록**: [#669 BUG-ASSAULT-001](https://github.com/Choyounhwa/-dream-guardian/issues/669) handlePunch 오호출(P0) → [#670 BUG-ASSAULT-002](https://github.com/Choyounhwa/-dream-guardian/issues/670) 랜드마크 undefined 전달(P0, 001 선행) / [#671 003](https://github.com/Choyounhwa/-dream-guardian/issues/671) 오답 피해 즉시 적용 / [#672 004](https://github.com/Choyounhwa/-dream-guardian/issues/672) 펀치 가짜 타격 경계 / [#673 005](https://github.com/Choyounhwa/-dream-guardian/issues/673) 리듬·콤보 / [#674 006](https://github.com/Choyounhwa/-dream-guardian/issues/674) 패턴·BPM / [#675 007](https://github.com/Choyounhwa/-dream-guardian/issues/675) 결전 저충격·소유권(REC-00 BLOCKED 해제 전 착수 금지) / [#676 REFACTOR-DRY-005](https://github.com/Choyounhwa/-dream-guardian/issues/676) / [#677 REFACTOR-SRP-013](https://github.com/Choyounhwa/-dream-guardian/issues/677).
- **기존 REC 범위로 남은 결함(재등록 안 함)**: 보기 쌍 미연결·targetRounds 5(REC-04 #597), 입력 시계 혼용(REC-07 #604), 재개 준비박(REC-08 #595), 이중 정산(REC-10 #598), 운동량(REC-11 #596), 1라운드 고정·attackId 라운드 충돌(REC-12 #607), 표시 스냅샷/HUD(REC-13~15), 효과음·BGM(REC-16 #609), 스쿼트 직립 복귀(REC-26 #614), 결전 피해량(REC-19 #605, BLOCKED).
- **권장 순서**: #669 → #670 → REC-04 → REC-07 → REC-26 → REC-12 → #671~#674. G5 #537은 그 이후. 각 카드 개별 승인.

---

## 2026-10-22 G5 재개 선행 검사 수정 (#644)

- **브랜치**: `boss-assault`. 사용자 승인으로 전역 worktree 변경 금지 검사를 에디터 작업별 고정 Git 증거 검사로 한정했다. 제품 `src/config` 및 `.gitignore` 변경 없음.
- **완료**: [#644](https://github.com/Choyounhwa/-dream-guardian/issues/644), commit `27abf09`, [완료 코멘트](https://github.com/Choyounhwa/-dream-guardian/issues/644#issuecomment-6319738423). UIX-006/008/011 개별 커밋만 검증하며 원 UIX-017 전체 이력의 증거로 확대하지 않는다.
- **#533 완료**: commit `8da6905`. `config/assault-reward.config.ts`의 불변 미사용 정책 추가.
- **#534 완료**: commit `93880aa`. `AssaultRewardPolicy`의 순수 무보상 계획(`commands: []`) 추가.
- **#535 완료**: commit `d9c9ee3`. 전용 namespace/schemaVersion 1, 명시적 비교 identity, 무보상 동시 저장 검증.
- **#536 완료**: commit `5ae4329`. 본문 영역과 페이지 장식 구분, 전 페이지 문자 완전 보존 검증.
- **#537 착수 차단**: 요약 공개 포트 및 진행 연결 누락 확인으로 수정 전 중단. REC-11 #596 개별 완료 후 착수.
- **#596 재시도 완료 (e2397fe)**: `AssaultRoundController.ts`, `AssaultRoundSummary.ts`, `tests/unit/assault-recovery-summary.test.ts`. getRoundSummary/recordSettlementReceipt/finalizeRoundSummary 구현.

---

## 2026-10-22 챌린지 트랙 기반 카드 완료 (#645 · #647 · #648, /card-run)

| 카드 | 상태 | 커밋 | 변경 파일 | 검증 |
|---|---|---|---|---|
| [#645 CH-01a](https://github.com/Choyounhwa/-dream-guardian/issues/645) 시드 RNG | `[✔]` | `23bf75f` | `src/utils/seededRng.ts`(51), `tests/unit/seeded-rng.test.ts`(145) | Red(모듈 부재) → Green 20/20, 전체 422파일·5,940건 Pass/Fail 0, build 성공 |
| [#647 CH-02](https://github.com/Choyounhwa/-dream-guardian/issues/647) Rational | `[✔]` | `a582be1` | `src/utils/Rational.ts`(135), `tests/unit/rational.test.ts`(183) | Red → Green 32/32, 전체 423파일·5,972건 Pass/Fail 0, build 성공 |
| [#648 CH-03](https://github.com/Choyounhwa/-dream-guardian/issues/648) 챌린지 타입 계약 | `[✔]` | `6340685` | `src/types/assault-challenge.ts`(182), `tests/unit/assault-challenge-types.test.ts`(114) | Red → Green 13/13, 전체 424파일·5,985건 Pass/Fail 0, build 성공 |
| [#649 CH-04](https://github.com/Choyounhwa/-dream-guardian/issues/649) 챌린지 설정 | `[✔]` | `e9a9e0b` | `config/assault-challenge.config.ts`(99), `tests/unit/assault-challenge-config.test.ts`(122) | Red → Green 15/15, 전체 425파일·6,000건 Pass/Fail 0, build 성공 |
| [#650 CH-05](https://github.com/Choyounhwa/-dream-guardian/issues/650) 14유형 카탈로그 | `[✔]` | `8a8a67f` | `src/data/assault/challengeCatalog.ts`(188), `tests/unit/assault-challenge-catalog.test.ts`(340) | Red → Green 25/25, 전체 446파일·6,187건 Pass/Fail 0, build 성공 |
| [#652 CH-07](https://github.com/Choyounhwa/-dream-guardian/issues/652) 구조식 산출기 | `[✔]` | `e7af399` | `src/question/challenge/ChallengeExpression.ts`(365), `tests/unit/challenge-expression.test.ts`(336) | Red → Green 32/32, 전체 448파일·6,239건 Pass/Fail 0, build 성공 |
| [#653 CH-08](https://github.com/Choyounhwa/-dream-guardian/issues/653) A 규칙 사냥 계열 | `[✔]` | `4773cf8` | `src/question/challenge/RuleHuntGenerator.ts`(404), `tests/unit/challenge-rule-hunt.test.ts`(324) | Red → Green 20/20, 전체 427파일·6,038건 Pass/Fail 0, build 성공 |
| [#654 CH-09](https://github.com/Choyounhwa/-dream-guardian/issues/654) B 대결 계열 | `[✔]` | `4eb0ee5` | `src/question/challenge/DuelGenerator.ts`(459), `tests/unit/challenge-duel.test.ts`(316) | Red → Green 18/18, 전체 449파일·6,257건 Pass/Fail 0, build 성공 |
| [#655 CH-10](https://github.com/Choyounhwa/-dream-guardian/issues/655) C 같은 값 계열 | `[✔]` | `435c4ef` | `src/question/challenge/EquivalenceGenerator.ts`(593), `tests/unit/challenge-equivalence.test.ts`(439) | Red → Green 22/22, 전체 450파일·6,279건 Pass/Fail 0, build 성공 |
| [#656 CH-11](https://github.com/Choyounhwa/-dream-guardian/issues/656) D 진행 계열 | `[✔]` | `f3c2904` | `src/question/challenge/ProgressionGenerator.ts`(388), `tests/unit/challenge-progression.test.ts`(338) | Red → Green 19/19, 전체 451파일·6,298건 Pass/Fail 0, build 성공 |
| [#657 CH-12](https://github.com/Choyounhwa/-dream-guardian/issues/657) 챌린지 쌍 검증기 | `[✔]` | `d03f429` | `src/question/challenge/ChallengePairValidator.ts`(700), `tests/unit/challenge-pair-validator.test.ts`(665) | Red → Green 25/25, 전체 452파일·6,323건 Pass/Fail 0, build 성공 |
| [#666 CH-20](https://github.com/Choyounhwa/-dream-guardian/issues/666) 오프라인 내보내기 스크립트 | `[✔]` | `bafff61` | `src/question/challenge/ChallengeCsvWriter.ts`(172), `scripts/export-assault-challenges.ts`(350), `tests/unit/challenge-csv-writer.test.ts`(315) | Red → Green 15/15, 전체 454파일·6,376건 Pass/Fail 0, build 성공 |
| [#667 CH-21](https://github.com/Choyounhwa/-dream-guardian/issues/667) CSV 행 독립 검증기 | `[✔]` | `d6410b2` | `src/question/challenge/ChallengeCsvValidator.ts`(715), `tests/unit/challenge-csv-validator.test.ts`(408) | Red → Green 38/38, 전체 453파일·6,361건 Pass/Fail 0, build 성공 |
| [#668 CH-22](https://github.com/Choyounhwa/-dream-guardian/issues/668) 280행 데이터 생성·검수 | `[✔]` | `0c7758c` | `assault_challenges.csv`(281), `tests/unit/challenge-csv-validator.test.ts`(518) | Red → Green 43/43, 전체 454파일·6,381건 Pass/Fail 0, build 성공, 14유형 280행 표본 검수 완료 |

- **문서**: [DOC-18 챌린지 출제 시스템 설계서](../docs/18_ASSAULT_CHALLENGE_QUESTION_SYSTEM.md). A·B·C·D 4계열 14유형 채택(E 제외). 카드 CH-01a~19 **21개 GitHub 등록 완료 #645~#665**.
- **v0.2 데이터 우선 방침 (사용자 결정)**: 게임 즉시 적용 없이 오프라인 생성기 → `assault_challenges.csv`(14유형×20행) → 사람 검수 순. 신규 #666 CH-20 / #667 CH-21 / #668 CH-22, #652 범위 확장, **보류**: #646, #651, #658~#665.
- 챌린지 트랙 진행 순서: **#645 CH-01a** → #647 → #648 → **#649** → #650 → #652 → #653 → #654 → #655 → #656 → #657 → #666 → #667 → **#668 (완료 [✔])**.

---

## 2026-10-27 러닝+문제(8박) 원근 포커싱·블러 감쇠 출현 연출 트랙 (#711)

- **[✔ 완료] #711 [RENDER-QUESTION-APPROACH-002]**: 러닝+문제(`RUN_QUESTION`, 8박) 루프 시작 시 소실점 원거리에서 흐릿하고(blur 12px) 어둡게(brightness 0.4) 출현하여 차차 밝아지고 또렷해지며, 4박 시점에 정면 목표 위치에 100% 선명하게 안착되도록 4박 원근 포커싱 및 Canvas 2D 필터 연동 완료.
  - 대상 파일: `config/beat-motion.config.ts`, `src/game/beat/BeatTimelineSynchronizer.ts`, `src/render/QuestionApproachRenderer.ts`, `src/render/QuestionRenderer.ts`
  - 검증: 단위 테스트 80/80 Pass, 전체 463 파일 / 6,477 테스트 100% Pass, tsc 빌드 성공.

---

## 2026-10-29 보스 접근전 줌인 비행 고스트 트레일 및 펀치 별모으기 융합 트랙 (#713, #714)

- **[✔ 완료] #713 [ASSAULT-TRAIL-001]**: 원형 답안 줌인 비행 원근 속도감 Trail(고스트 잔상) 효과 구현
  - 비행 진행도 기반 직전 3단계 고스트 위치 역산 투영 및 시안/보라 감쇠 투명도(0.12~0.28) 펄스 링 드로잉, 착지/대기 제로 오버헤드 최적화.
  - 대상 파일: `config/assault-visual.config.ts`, `src/render/AssaultPairPainter.ts`, `tests/unit/assault-pair-painter.test.ts`
  - 검증: 단위 테스트 10/10 Pass, tsc 빌드 성공.
- **[✔ 완료] #714 [ASSAULT-FX-005]**: 보스 접근전 정답 펀치 별모으기 페이즈 시각효과 융합
  - 정답 펀치 시 4각 회전 반짝임(Twinkle) 별가루 파티클(4색), 20px→90px 동심원 충격파 펄스 링, PERFECT 골드 배지/콤보 부유 결합 및 기존 ASSAULT-FX-003 효과 100% 보존.
  - 대상 파일: `config/assault-visual.config.ts`, `src/render/assault/AssaultImpactVFX.ts`, `tests/unit/assault-impact-vfx.test.ts`
  - 검증: 단위 테스트 20/20 Pass, 전체 491개 파일 / 6,792개 테스트 100% Pass, tsc 빌드 성공.
- **[✔ 완료] #716 [BUG-ASSAULT-TIMING-001]**: 리듬 판정 타이밍 가이드 UI 내부 원형의 답안 최종 크기 비례 동적 계산 및 비율 정합화
  - 착지 목표 가이드의 내부 원형(Hit Receptor) 및 수축 어프로치 링이 레거시 StarNote 크기(28px)로 고정되어 거대한 원형 답안(~120px) 대비 지나치게 작던 결함을 해결.
  - `getFinalChoiceRadius`를 단일 진실 공급원(SSOT)으로 도입하여 답안 카드의 최종 착지 반지름을 동적 계산하고, `getAnchors` 및 `_renderTargetZones`의 내부 기준 링과 수축 링이 `progress 1.0` 착지 시점에 답안 외곽 테두리와 1:1로 완벽히 포개어지도록 정합화.
  - 대상 파일: `config/assault-visual.config.ts`, `src/render/AssaultPairPainter.ts`, `tests/unit/assault-approach-guide.test.ts`
  - 검증: 단위 테스트 15/15 Pass, 전체 491개 파일 / 6,800개 테스트 100% Pass, tsc 빌드 성공.

---

## 2026-10-19 BOSS-ASSAULT 런타임 복구 트랙 (DOC-16, #588~#614)

- **등록 완료 ID**: BOSS-ASSAULT-REC-00~26, 실제 GitHub **#588~#614 27개**, 전부 OPEN / 개별 실행 승인 대기. [DOC-16 원장](../docs/16_BOSS_ASSAULT_RUNTIME_RECOVERY_CARDS.md).
- **#588 REC-00**: #503 MVP 확정치(130ms/170ms·HP100·피해10/5) 유지, targetRounds=10 확정. G4 결전 복구는 차단 유지 (BLOCKED).
- **#589 REC-01 [✔]**: `QuestionBank.getPoolSnapshot()` 구현.
- **#592 REC-02 [✔]**: 문항 정규화 및 원자적 진입 복구.
- **#593 REC-03 [✔]**: `DEFAULT_ASSAULT_CONFIG.targetRounds = 10` 단일 SSOT 확정.
- **#594 REC-05 [✔]**: 읽기 시간 누적 가산 조합식 구현.
- **#591 REC-06 [✔]**: `correctSide` 소비, 0피해/1회피해/wrong_locked 보장.
- **#597 REC-04 [✔]**: 시드 보기 공급·목표 설정 조립 완료.
- **#604 REC-07 [✔]**: 입력 공통 활성시계·라운드 원점 정규화 완료.
- **[▶ NEXT] #595 REC-08**: 공격 재개 준비박 판정 차단 대기.

---

## 인게임 UI 개발 모드 트랙 (DEVUI / LAYOUT, 2026-10-11)

- **적용 방식**: 내보낸 `ui-layout.json`을 `dream_guardian/public/layouts/`에 수동으로 복사. 부팅 시 검증 후 in-place 깊은 병합.
- **판정 좌표 잠금 (사용자 결정)**: 피트니스 존 1~11, 바닥 판정선, 장애물 회피 레인 등 모션 판정 연결 좌표는 편집 불가(읽기 전용).
- **완료 현황**: DEVUI-001~008, LAYOUT-001~009, DEVUI-012, BUG-DEVUI-002 전원 TDD 100% Pass 완료.
- **BOSS-ASSAULT 병행 규칙**: 브랜치가 하나이므로 카드는 번갈아 하나씩 진행. 충돌 3파일(`StateMachine.ts`, `AppBootstrap.ts`, `SceneDirector.ts`) 엄격 분리 관리.

---

## UI 비주얼 에디터 복구 트랙 (UI-EDITOR-FIX, [보류])

- **상태 (사용자 결정)**: 인게임 개발 패널(DEVUI/LAYOUT) 도입 및 대체 전략에 따라 비주얼 에디터 잔여 카드(#556~#560, #554, #471 연계, #472, #624~#627)는 일괄 **[보류]** 처리됨.

---

## 보스 접근전 계획 인계 요약 (BOSS-ASSAULT G0 ~ G5)

| 순서 | 카드 범위 | 상태 |
|---|---|---|
| G0 | [#541](https://github.com/Choyounhwa/-dream-guardian/issues/541) → [#503](https://github.com/Choyounhwa/-dream-guardian/issues/503) | `[✔ 완료]` 실측 스파이크 및 MVP 계약 확정 |
| G1 | #504~#509, [#542](https://github.com/Choyounhwa/-dream-guardian/issues/542), [#543](https://github.com/Choyounhwa/-dream-guardian/issues/543) | `[✔ 완료]` 타입 계약, 프로필, 교대 콘텐츠, 사전 유효성, 시간표 컴파일러, 동작 소유권 |
| G2 | #510~#522, [#544](https://github.com/Choyounhwa/-dream-guardian/issues/544), [#546](https://github.com/Choyounhwa/-dream-guardian/issues/546), [#547](https://github.com/Choyounhwa/-dream-guardian/issues/547) | `[✔ 완료]` 입력·판정 reducer, 피해 정산, 요약 집계, HUD, 운동량 집계 |
| G3 | #523~#526, [#545](https://github.com/Choyounhwa/-dream-guardian/issues/545), #527, [#548](https://github.com/Choyounhwa/-dream-guardian/issues/548) | `[✔ 완료]` 배타 진입, 수명주기, 튜토리얼, core loop 통합 게이트 |
| G4 | #528, #539, #529~#532 | `[✔ 완료]` 근접 결전 프로필, 보스 HP 초기화, 패턴 순수 진행, core 인계 |
| G5 | #533~#537 | `[✔]` #533~#536 완료, `[▶ NEXT: BOSS-ASSAULT G5 트랙]` [#537](https://github.com/Choyounhwa/-dream-guardian/issues/537) (REC 트랙 선행 해제 후) |
| G6 | #538 | 대기 |

---

## 📌 1. 프로젝트 기본 정보 및 기획 배경

1. **프로젝트 목적**:
   - 닌텐도 '링핏 어드벤처' 스타일로 제자리 달리기, 팔 뻗기, 앉기, 점프 등 전신 운동을 하며 수학 문제를 해결하는 모바일 웹캠 기반 체감형 기능성 게임.
2. **원작 스토리**:
   - `GU's mong story.txt` 바탕의 **《꿈의 수호신》** ("생각하는 힘이, 나를 지킨다").
   - 아이의 생각하는 힘(사고의 빛)으로 성장하는 꼬마 수호신 vs 몽계(꿈의 세계)를 위협하는 4종 괴물과 최종 보스 '나이트메어'.
3. **그래픽/톤앤매너**:
   - **신비로운 아이스블루, 라벤더, 딥네이비, 별빛 실버** 테마.
   - 주인공: 아이스블루 꼬마 수호신 (`img/guardian.png` 크로마키 투명화 적용).
4. **수학 문제 범위**:
   - 기존 `questions.csv`의 9단계 중 **Level 1 ~ Level 4** 필터링 출제 (원본 보존).
     - 1장: 덧뺄셈 (숫자의 숲 / 보스: 포겟)
     - 2장: 곱나눗셈 (곱셈의 성 / 보스: 후다닥)
     - 3장: 분수 (나눗셈의 미궁 / 보스: 뒤죽박죽)
     - 4장: 소수 (소수의 사막 / 보스: 에라)
     - 5장(히든/최종): 종합 혼합 연산 (악몽의 심연 / 보스: 나이트메어)

---

## 📁 2. 프로젝트 아키텍처 및 계층별 파일 구조

```text
dream_guardian/
│
├── src/
│   ├── core/                  # GameEngine, StateMachine, EventBus, Config, Director, Bootstrap
│   │   ├── bootstrap/         # AppEventListenerManager, AppBattleEventBinder, AppPersistenceManager 등
│   │   └── director/          # SceneDirector 및 9개 SRP 서브 코디네이터/디스패처
│   ├── render/                # CanvasManager (7계층 캔버스 분리), CameraLayer
│   ├── motion/                # PoseManager, HandsManager, Run/Squat/JumpDetector, CalibrationHelper
│   ├── skeleton/              # SkeletonRenderer, StickmanAvatarRenderer, Bone/JointRenderer
│   ├── effects/               # CombatVFX, ScreenFX, EffectManager
│   ├── question/              # QuestionBank, QuestionEvaluator (safeEval), QuestionSpeech (TTS)
│   ├── game/                  # BattleState, BossController, GuardianSystem, AssaultRoundController
│   ├── input/                 # MenuInput, AnswerSelector, PoseGeometry, MotionIntentBus
│   ├── ui/                    # MenuRenderer, HUDLayer, ResultRenderer, SettingsModal
│   ├── audio/                 # AudioContextFactory, StageBGMSynthesizer, SoundEffects
│   ├── utils/                 # deepFreeze, crypto, seededRng, Rational
│   └── types/                 # 공통 인터페이스, Presentation, Assault 타입
│
├── config/                    # 게임/전투/모션/UI/이펙트 단일 설정 공급원 (SSOT)
├── tests/unit/                # Vitest 기반 단위/통합 테스트 슈트 (420+ 파일, 5,900+ 테스트)
└── public/                    # 정적 에셋, 레이아웃 프리셋 (public/layouts/)
```

---

## ✅ 3. 현재까지 구현 완료된 핵심 기능 (Summary)

| 분류 | 세부 구현 내용 | 상태 |
|---|---|:---:|
| **인체공학적 모션 판정** | 10개 피트니스 존 겹침 0% 레이아웃 및 4색 커서(손/머리/골반) 신체 감지 | 완료 |
| **스틱맨 아바타** | 실사 웹캠 대신 화면 중앙 네온 메카 스틱맨 실루엣 미러링 (화면 이탈 감지 포함) | 완료 |
| **통합 리듬 노트 (MRN)** | 별가루 노트·발자국 스탬프·회피 장판 3레인 동기화 파이프라인 (MRN-01~12 완주) | 완료 |
| **스트리트파이터 대전 HUD** | 상단 통합 대전 바: 좌측 플레이어 HP vs 우측 보스 HP + 중앙 VS 엠블럼, 타이머, 콤보 | 완료 |
| **수호신 마나 & 스펠** | 정답 1개당 +25 마나, 100 마나 달성 시 수호신 스펠 자동 시전 (보스 HP -4) | 완료 |
| **인게임 UI 개발 패널** | Tweakpane 기반 런타임 UI_LAYOUT 실시간 조정 및 `public/layouts/` 추출 | 완료 |
| **보스 접근전 (Assault)** | 10라운드 교대 펀치/스쿼트 전투 시스템, 불변 요약 집계, 시드 문항 연동 | 런타임 복구 중 |
| **아키텍처 모듈화** | Core/Director/Bootstrap 1,000줄 이하 SRP 분리 및 DRY 공통 유틸리티 단일화 | 1단계 완료 |

---

## 🚀 4. 프로젝트 빌드 및 실행 방법

### 로컬 개발 서버 구동 (HMR 지원)
```powershell
cd "E:\AIAIAIAIAI\Arithmetic Game\dream_guardian"
npm run dev
```
접속 URL: `http://localhost:3000/`

### 전체 검증 (빌드 & 테스트)
```powershell
cd "E:\AIAIAIAIAI\Arithmetic Game\dream_guardian"
npm run build
npm test
```

### 테스트 조작키 (PC 환경 디버깅용)
- **Space**: 자세 정렬 즉시 통과, 달리기 마나 충전 (+15%, 걸음 수 증가), 스토리/엔딩 스킵
- **← / → (화살표)**: 좌/우 답안 선택
- **↓ (아래 화살표)**: 스쿼트 방어 테스트 (이지스 결계 발동)
- **↑ (위 화살표)**: 점프 도약 테스트 (마나 +25%)
- **화면 클릭/터치**: 모서리/버튼 선택 및 화면 좌/우 터치로 답안 선택
- **우측 상단 버튼**: 📷 카메라 전면/후면 전환, ⛶ 전체화면 전환
- **메인 메뉴 하단**: [ 🏆 운동 기록 & 명예의 전당 ] 모달 열기

---

## 📋 5. 세션 진행 및 TDD 5단계 수칙 안내 (Next Steps)

모든 작업은 `AGENTS.md`의 절대 규칙 및 TDD 5단계 사이클을 준수해야 합니다:

1. **Step 1: Baseline Check**: 작업 전 `npm test`로 기존 테스트 통과 상태 확인.
2. **Step 2: Red**: 작업 카드의 완료 조건에 맞춰 `tests/unit/`에 실패하는 테스트 케이스 선작성 (`npx vitest run <파일>` 실패 확인).
3. **Step 3: Green**: 테스트를 통과하는 최소한의 프로덕션 코드 구현 (`npx vitest run <파일>` 100% Pass 확인).
4. **Step 4: Refactor & 전체 검증**: 코드 정리, `npm run build` (tsc 타입 검사), `npm test` (전체 회귀 결함 0건 확인).
5. **Step 5: 완료 기록**: Git commit 컨벤션 준수 및 GitHub Issue 작업 코멘트 등록 (`gh issue comment`).
6. **서버 안내**: 작업 완료 후 `http://localhost:3000/` 접속 안내 (Rule 13).

> 🎯 **현재 최우선 후속 작업 대상**:
> - 브랜치 정상화 3단계 분할 트랙 (DOC-23): **[▶ NEXT] [#761 REFACTOR-BRANCH-004] [PR-3] Boss Assault 24박 루프, 타이밍 판정, Audio/VFX 및 UI 정산 브랜치 분리**
> - 달리기 시각 가이드 트랙 (DOC-22): **[#746 BUG-ASSAULT-010]**
> - 메인 트랙: **[#595 REC-08] 공격 재개 준비박 판정 차단** (또는 **[#671 BUG-ASSAULT-003] 오답 피해 즉시 적용**)
> - 챌린지 트랙: **[#649 CH-04]** (사용자 승인 시)
