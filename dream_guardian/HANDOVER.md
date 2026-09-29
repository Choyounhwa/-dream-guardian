# 🌙 《꿈의 수호신 (Dream Guardian)》 프로젝트 인수인계 및 후속 작업 안내서

본 문서는 사용자가 이후 작업을 바로 이어서 진행할 수 있도록 프로젝트의 전체 맥락, 파일 구성, 구현 완료 현황, 실행 방법 및 다음 개발 과제를 정리한 문서입니다.

> 최종 구현 요약과 현재 동작 기준은 `COMPLETION.md`를 먼저 확인하세요. 상세 포즈 조정은 `POSE_DESIGN.md`를 기준으로 합니다. 모든 사용자용 기획·작업·스토리 문서는 이 폴더에 모았습니다.

## 문서 안내

| 문서 | 용도 |
|---|---|
| `COMPLETION.md` | 현재 구현 완료 내역과 실행/테스트 기준 |
| `POSE_DESIGN.md` | 이전 12구역 입력 설계 보관본 |
| `ANSWER_SELECTION_DESIGN.md` | 최신 색상 스켈레톤 커서·10구역·분할 답안 설계 |
| `FITNESS_ZONE_CATALOG.md` | 국민체조 기반 피트니스존 카탈로그와 코드 반영 가이드 |
| `FITNESS_ZONE_EDITOR.md` | 새 피트니스존/정답 조합을 검토하는 편집 시트 |
| `STORY_SOURCE.md` | 원작 세계관과 스토리 전문 |
| `IMPLEMENTATION_PLAN.md` | 초기 구현 기획서 원본 |
| `TASKS.md` | 초기 작업 목차/WBS 원본 |
| `DEVELOPMENT_WALKTHROUGH.md` | 초기 개발 워크스루 원본 |
| `ANTIGRAVITY_HANDOVER_ARCHIVE.md` | 이전 외부 도구 인수인계 문서 보관본 |
| `../docs/04_POSTURE_SYSTEM_ANALYSIS.md` | **자세 선택 시스템 원인 분석 및 재설계안 (최신)** |
| `../fitness pattern.csv` *(외부: `E:\AIAIAIAIAI\Arithmetic Game\`)* | **피트니스 패턴 원본 데이터 360건** |

---

## 🔵 2026-09-28 확정: 《꿈의 수호신: 깨비와 도깨비불의 앙상블》 세계관·스토리 전면 개편

> 상태: **[`docs/04_STORY_SOURCE.md`] 스토리 문서 전면 재작성 완료 🟢 (전체 605/605 Pass)**  
> 수호신 '알레' 체제에서 생활 밀착형 가신(家神) **'깨비'** 체제로 전면 전환되었으며, 적 미니언(먹개비), 아군 장난감 도깨비(12종), 5대 불안 보스명(하얘시니/재촉새/따돌시니/풀죽새/캄캄대왕) 및 ADHD 친화적 대사 설계가 확정되었습니다.

### 주요 개편 내용 요약

1. **주인공 수호신: ‘깨비’ (생활 밀착형 가신)**
   - 겉모습: 털 날리고 장난치는 반려동물 (강아지/토끼/고양이/앵무새 4종 선택).
   - 정체: 이마에 작은 도깨비뿔을 품고 태어난 마음의 안내자 & 치유사.
   - 7단계 성장: 작은 뿔 ➔ 커진 뿔 ➔ 작은 깃털날개 ➔ 작은 날개 ➔ 뿔이 빛남 ➔ 도깨비불 일렁임 ➔ 알록달록 문양에서 빛남 (대도깨비 각성).
   - 유저 환경 특정 배제: 학교, 집, 부모 등 현실 배경을 한정하지 않고 '둘만의 직접적 유대'에 집중.

2. **적 미니언: ‘먹개비’ (별빛 포식자)**
   - 외형: 카키색 둥글넓적한 얼굴, 커다란 노란 눈, 찢어진 큰 입, 뾰족한 이빨, **팔다리 없음**.
   - 행동: 바닥을 통통 튀거나 미끄러지듯 굴러오며, 유저의 별빛(꿈과 희망)을 게걸스럽게 삼켜 불안을 높임.

3. **아군 미니언: ‘살아난 장난감 도깨비들’ (함께 달리는 12종)**
   - 낮엔 평범한 반려동물 장난감 ➔ 도깨비불이 닿으면 살아 움직이는 꼬마 도깨비.
   - 강아지 3종: 뭉치(밧줄 인형 - 방어), 끄르르(바퀴 카트 - 별가루 수거), 뿌짖이(삑삑이 뼈다귀 - 경보).
   - 고양이 3종: 쫑쫑이(깃털 벌레 로봇 - 미끼), 데굴이(캣닢 쥐 인형 - 힌트/치유), 또르르(자동 구르기 공 - 별가루 흡입).
   - 토끼 3종: 폴짝이(태엽 개구리 - 점프 비트), 둥굴이(위커볼 - 넉백/수거), 사각이(나무 블록 카트 - 벽 방어).
   - 앵무새 3종: 딸깍이(클리커 로봇 - 리듬 추가점), 찰랑이(거울 방울 그네 - 피격 반사), 또로록(구슬 레일 카트 - 길 안내).
   - 제5장 캄캄대왕전에서 3종 전원 동시 출동 앙상블.

4. **5대 보스 & 음악 앙상블 (시니/새 혼합 한국 토속형)**
   - **Ch.1 하얘시니** (실수와 실망) | 하드 록 (일렉 기타 + 록 드럼)
   - **Ch.2 재촉새** (시간 압박) | 업템포 EDM (신스 리드 + 808 전자 비트)
   - **Ch.3 따돌시니** (친구의 거절/다름) | 네오 클래시컬 (그랜드 피아노 + 팀파니)
   - **Ch.4 풀죽새** (무시당하기/무기력) | 디스코 펑크 (슬랩 베이스 + 훵크 찹)
   - **Ch.5 캄캄대왕** (혼자 남는 것/고립) | 고딕 에픽 메탈 (파이프 오르간 + 트윈 드럼)
   - **보스 정화 연출**: 공격받아 파괴되는 것이 아니라, 내면의 불안을 보듬어준 주인공에게 **“참으로 고맙구나...” 하며 인자하게 미소 짓고 빛으로 흩어지며 사라짐**.

5. **대사 및 심리 설계 (ADHD 맞춤형 친화 구조)**
   - **오답 시**: 보스는 대사 없이 조용히 미소/끄덕임 ➔ 상처 주지 않고 깨비가 장난스럽게 달래며 즉각 재도전 유도.
   - **정답 시**: 보스가 어른의 위엄 있는 옛 말투(~느니라, ~겠느냐)로 동요하며 의문형으로 흔듦.
   - **ADHD 방어 행동 치유**: 화냄/거부/찍기/반발/회피 행동 밑의 불안을 깨비가 다정하게 읽어주는 대사 탑재.

---

## 🔵 2026-09-27 확정: BEAT MOTION 8+2+8 비트매니아식 피트니스 리듬 시스템 전환

> 상태: **[BEAT-ROUTINE-001 / #190] 8+2+8 상태 전이 및 단일 정산 완료 🟢 (전체 583/583 Pass)**, 다음 착수: `#191 [AUDIO-BAND-001]`.  
> "가만히 서 있어도 저절로 8박이 채워지는 결함"을 해소하고, 유저의 실제 운동이 비트를 완성하며, 정답 위치에서 시작하는 비트매니아식 8+2+8 키노트 합주 퍼포먼스로 전면 고도화합니다. GDD, WBS, GITHUB_ISSUES, HANDOVER 4개 문서 간 단일 계약 동기화가 완료되었습니다.

### 확정 루프: 8+2+8 비트매니아식 피트니스 앙상블 (BPM 120, 총 18박 / 9.0초)

```text
[Phase 1] 8박 운동 러닝 (내가 만드는 비트, RUN_EXERCISE)
  ├─ 상단에 수학 문제 출제 및 비블로킹 TTS 낭독
  ├─ 플레이어가 실제로 8회 운동(달리기/바운스/스웨이/교차/Space)을 수행 (미동작 시 비트 불변/대기)
  └─ 1회 운동마다 1박씩(1/8 → 8/8) 채워지며, 발스텝이 묵직한 서브 킥 & 베이스 펄스를 연주
        ↓
[Phase 2] 2박 호흡 & 준비 브레이크 (REST_READY, 1.0s 고정)
  ├─ 8회 운동 완충 직후 정확히 2박 동안 짧은 호흡 가다듬기 및 정답 위치 인지
  └─ "READY... SET!" 비주얼 및 카운트 사운드와 함께 정답 위치/키노트 레인 점등
        ↓
[Phase 3] 8박 키노트 합주 퍼포먼스 (KEYNOTE_PERFORMANCE, 4.0s 고정)
  ├─ 1박째: 정답의 위치(Zone 4/5 등)를 손으로 터치하여 정답 확정 및 인트로 기타 파워코드 작렬
  ├─ 2~8박: 차례로 이어지는 키노트를 터치하며 풀바디 록 앙상블 합주 완성
  │   ├─ [손 커서 (Zone 1~5)]: 일렉 기타 리드/리프 연주
  │   └─ [발 스텝 (Zone 9~11)]: 록 드럼 킥/스네어/심벌 타격
  └─ 비트매니아식 싱크(Sync) 판정:
      ├─ 정박(±0.12s): 풍성한 100% 게인 클린 기타/드럼 사운드
      ├─ 엇박(±0.25s): 피치 벤드 글리치, 프렛 스크래치(Fret Scratch), 림샷 둔탁음
      └─ 무동작(Miss): 메인 악기 음소거(Mute) 및 조용한 가이드 틱만 잔존
        ↓
[Phase 4] 라운드 단일 정산 (Single Point Settlement):
  ├─ 정답: 기본 마나 +25 및 콤보 +1 (100% 보장), 리듬 성취도 점수 누적
  ├─ 오답/미응답: 플레이어 HP -25 및 콤보 0 리셋
  └─ 마나 100 도달 시: 수호신 스펠 캐스팅 자동 발동 → 보스 HP -4
```

### 단계(Chapter)별 악기 편성 로드맵

| 단계 (Chapter) | 보스 테마 / 수학 영역 | 손 (Zone 1~5) 악기 | 발 (Zone 9~11) 악기 | 앙상블 음악 장르 |
|---|---|---|---|---|
| **1단계 (Ch.1)** | 포겟 (망각의 늪 / 덧셈·뺄셈) | **일렉 기타 (Guitar)** | **록 드럼 (Rock Drum)** | **하드 록 / 팝 펑크** |
| **2단계 (Ch.2)** | 후다닥 (가속의 시계탑 / 곱셈·나눗셈) | **신스 리드 (Synth Lead)** | **전자 808 킥/클랩 (EDM)** | **업템포 유로비트 / EDM** |
| **3단계 (Ch.3)** | 뒤죽박죽 (왜곡의 숲 / 분수) | **그랜드 피아노 (Piano)** | **오케스트라 팀파니/심벌** | **네오 클래시컬 심포니** |
| **4단계 (Ch.4)** | 에라 (무중력의 성 / 소수) | **슬랩 베이스 (Slap Bass)**| **펑크 찹 & 퍼커션** | **디스코 펑크 (Funk)** |
| **5단계 (Ch.5)** | 나이트메어 (악몽의 궁전 / 종합) | **파이프 오르간 (Organ)** | **헤비메탈 투베이스 드럼** | **고딕 에픽 메탈** |

### 작업 카드 순서 및 진행 현황

| 순서 | 작업 ID | GitHub Issue | 단일 책임 | 상태 |
|---:|---|---|---|:---:|
| 1 | `BEAT-SPEC-001` | [#176](https://github.com/Choyounhwa/-dream-guardian/issues/176) | 8박 계약, 전투 정산 시점, 미응답/스웨이 정책 문서화 고정 | 🟢 **완료 (Pass)** |
| 2 | `BEAT-CORE-001` | [#177](https://github.com/Choyounhwa/-dream-guardian/issues/177) | BPM 120, 8박, pause/resume, 프레임 지연 보정 `RhythmEngine` | 🟢 **완료 (Pass)** |
| 3 | `CENTER-RETURN-001` | [#178](https://github.com/Choyounhwa/-dream-guardian/issues/178) | 중앙 복귀/기준점 잠금 및 timeout/retry | 🟢 **완료 (Pass)** |
| 4 | `ANSWER-ZONE-001` | [#179](https://github.com/Choyounhwa/-dream-guardian/issues/179) | 상대 좌/우 정답존, 히스테리시스, 0.5초 확정 | 🟢 **완료 (Pass)** |
| 5 | `BEAT-RUN-001` | [#180](https://github.com/Choyounhwa/-dream-guardian/issues/180) | 기존 자유 게이지를 8박 달리기+문제 HUD로 전환 | 🟢 **완료 (Pass)** |
| 6 | **`BUG-BEAT-001`** | **[#187](https://github.com/Choyounhwa/-dream-guardian/issues/187)** | **달리기 미동작 8박 자동 완충 차단 및 실제 8회 운동 스텝 연동** | 🟢 **완료 (580/580 Pass)** |
| 7 | **`BEAT-ROUTINE-001`** | **[#190](https://github.com/Choyounhwa/-dream-guardian/issues/190)** | **8박 운동 → 2박 쉼(Ready) → 8박 키노트 합주 상태 전이 컨트롤러** | 🟢 **완료 (583/583 Pass)** |
| 7-1 | **`BUG-BEAT-002`** | **[#200](https://github.com/Choyounhwa/-dream-guardian/issues/200)** | **문제/키노트 페이즈 코디네이터 미갱신 및 답안 선택 프리즈 결함 해결** | 🟢 **완료 (607/607 Pass)** |
| 8 | **`AUDIO-BAND-001`** | **[#191](https://github.com/Choyounhwa/-dream-guardian/issues/191)** | **1단계 기타(Zone 1~5) + 드럼(Zone 9~11) Web Audio 및 싱크/어긋남 사운드** | ⚪ 대기 |
| 9 | **`RENDER-KEYNOTE-001`** | **[#192](https://github.com/Choyounhwa/-dream-guardian/issues/192)** | **Zone 1~5 및 Zone 9~11 비트매니아식 키노트 비주얼 및 판정 연출** | ⚪ 대기 |
| 10 | `GAME-ROUND-001` | [#184](https://github.com/Choyounhwa/-dream-guardian/issues/184) | 8박 종료 시 전투/통계 단일 정산 | ⚪ 대기 |
| 11 | `E2E-BEAT-001` | [#186](https://github.com/Choyounhwa/-dream-guardian/issues/186) | 전체 루프 통합/E2E 및 최종 검증 | ⚪ 대기 |

### #187 완료 기록 - 실제 8회 운동 스텝 연동

- `BeatRunCoordinator`는 시간 경과로 `RUN_QUESTION`을 이탈하지 않으며, 실제 locomotion 또는 Space/클릭 fallback의 `recordStep()` 1회마다 1/8박을 누적한다.
- 8회 운동을 마친 뒤에만 `CENTER_RETURN` 게이트를 열고, 중앙 안정 잠금 또는 추적 불가 timeout fallback을 거쳐 답안 페이즈를 연다.
- 달리기 HUD 8개 점은 시간 기반 `RhythmEngine` 인덱스 대신 실제 완료 운동 수를 표시한다.
- TDD: 정지 상태 30초에서도 0/8과 `RUN_QUESTION` 유지, 운동 8회 후 전이, 중앙 복귀 retry/timeout을 검증했다. `npm run build` 성공 및 전체 `npm test` 580/580 Pass.

### #190 완료 기록 - 8+2+8 비트 루틴 상태 전이

- `BeatRunCoordinator`에 `RUN_QUESTION` → `REST_READY` (BPM 120 기준 고정 2박/1.0초) → `KEYNOTE_PERFORMANCE` (고정 8박/4.0초) → `ROUND_RESOLVE` 상태 계약을 구현했다.
- 정답 입력은 키노트 퍼포먼스 첫 박에만 열리며, 정답/오답 전투 자원 변화는 퍼포먼스 종료 후 `ROUND_RESOLVE`에서 한 번만 정산한다. 첫 박 미응답도 동일하게 한 번의 오답으로 정산한다.
- 준비 구간의 중앙 기준점은 2박 내 안정 잠금하며, 미잠금 상태에서는 기존 fallback 기준점을 사용해 루프를 멈추지 않는다.
- TDD: 미동작 고정, 8회 운동 후 준비 전이, 정확한 2박/8박 시간, 단일 정산 및 미응답 정산을 검증했다. `npm run build` 성공 및 전체 `npm test` 583/583 Pass.

### #200 완료 기록 - 인게임 답안 선택 프리즈 결함 해결 (BUG-BEAT-002)

- `main.ts`에서 `beatCoordinator.update(dt, sourceLandmarks)`가 `isRunning` (`gamePhase === 'running'`)에만 묶여 있어 문제/키노트 페이즈(`KEYNOTE_PERFORMANCE`) 진입 시 시간이 흐르지 않아 화면이 멈추던 회귀 결함을 해결했다.
- `screenMode === 'game' && !pauseModal.isOpen` 상태에서 코디네이터 시간을 상시 갱신하도록 전역화하여 8박 만료 시 `_resolveRound()` 단일 정산과 다음 라운드 자동 전이가 정상 작동한다.
- 마우스 클릭, 키보드(1, 2) 단축키, 웹캠 자세 판정을 모두 `confirmAnswerByFallback(idx)`로 일원화하고, 클릭/선택 즉시 터치 효과음(`sfx.play('hover')`) 및 버튼 테두리 점등 하이라이트를 즉각 제공하도록 조작감을 개선했다.
- TDD: Red(미구현 시 실패) → Green(607/607 Pass) → Refactor 검증 완료.

### 이슈 정리 결과

- 이전 문서의 4박자 `FEAT-RHYTHM-001` 사양은 폐기했고, 새 8박 전환 계약은 GitHub #176 `BEAT-SPEC-001`로 등록했다.
- #147, #159, #160은 구현 및 테스트 완료 상태였으나 GitHub가 열려 있어 2026-09-27에 Close 처리했다.
- #92는 리듬 오디오를 신규 카드로 분리, #95는 입력 충돌 때문에 보류/재설계, #96/#97/#98/#99는 BEAT 통합 후 후행 갱신한다.
- `UI-MENU-003`의 실제 GitHub 번호는 #168이며, 과거 HANDOVER의 #146 표기는 잘못된 기록이다.

### GitHub BEAT 카드

`#176 BEAT-SPEC-001` → `#177 BEAT-CORE-001` → `#178 CENTER-RETURN-001` → `#179 ANSWER-ZONE-001` → `#180 BEAT-RUN-001` 순서로 시작한다. 별 경로는 `#181 CHOREO-STAR-001` → `#182 INPUT-STAR-001` → `#183 RENDER-BEAT-001`, 정산/오디오는 `#184 GAME-ROUND-001`, `#185 AUDIO-BEAT-001`, 마지막 통합 검증은 `#186 E2E-BEAT-001`이다.

---

## 🟢 2026-09-27 완료: 3D 드림 그리드 - 피트니스존 연한 연결선 렌더링 (#188 완료, #189 취소)

> 등록 및 완료일: 2026-09-27 / 상태: **#188 완료 (10/10 Pass, 전체 581/581 Pass), #189 취소/종료 (사용자 요청)**

사용자 피드백에 따라 과일 아이템 수집 시스템(#189)은 제외 처리하고, 3D 드림 그리드 소실점으로부터 11개 피트니스 존(Zone 1~11)으로 이어지는 은은하고 연한 네온 연결선(Faint Connection Lines, alpha: 0.18, 1.2px) 렌더링을 구현 완료했습니다.

| 순서 | 카드 ID | GitHub Issue | 제목 | 핵심 구현 대상 | 상태 |
|---|---|---|---|---|---|
| 1 | `RENDER-TRACK-001` | [#188](https://github.com/Choyounhwa/-dream-guardian/issues/188) | 3D 드림 그리드 - 11개 피트니스 존 원근 연한 연결선(Zone Connection Lines) 렌더링 | • 소실점(`vx, vy`)에서 11개 피트니스 존 중심(`cx, cy`)으로 향하는 은은한 선형 그라데이션 네온 가이드 선<br>• 존 중심 3px 앵커 링 점등 및 시야 간섭 없는 소프트 투명도(`alpha = 0.18`)<br>• 메뉴 화면 자동 비활성화(`renderZoneConnections: false`) | 🟢 **완료 (Pass)** |
| 2 | `FEAT-ITEM-001` | [#189](https://github.com/Choyounhwa/-dream-guardian/issues/189) | 3D 러닝 트랙 부유 과일 아이템(딸기·바나나) 렌더링 및 모션 수집 시스템 | 사용자 요청("과일아이템은 필요없어")에 따른 카드 제외 및 종료 | 🚫 **취소/종료** |

---

## 🟣 2026-09-27 기획 확정: Phase B 보스 결전 오케스트라 & 미니언 군단 시스템 (#193, #194, #195 등록)

> 상태: **[#193, #194, #195] GitHub 이슈 및 작업 카드 3건 등록 완료 ⚪ (승인 대기)**  
> 10문제 러너 구간(Phase A) 돌파 후 모인 미니언 군단(3~13마리)과 수호신이 적 보스와 전면 대치하는 Phase B의 상세 전투 메커니즘을 확정했습니다.

### Phase B 확정 메커니즘 요약
1. **하체 방어 (바닥 불협화음 장판 회피 & 미니언 생존)**:
   - **보스 양손 쿵 (바닥 충격파)**: 전 레인 충격파 발생 → 유저 **전신 점프(JumpDetector)**로 회피.
   - **보스 한손 번갈아 콩콩 (적 그림자 미니언 침투)**: 레인으로 돌진하는 적 미니언 → 유저 **Zone 9/11 양발 교대 짓밟기(Alternating Foot Stomp)**로 격퇴.
   - **실패 패널티**: 대처 실패 시 **아군 미니언 1마리 즉시 탈락 (-1 Minion)**. (본체 HP는 보존).
2. **상체 공격 (Zone 1~5 별빛 수집 & 강력 마법 탄막)**:
   - Phase A와 동일하게 Zone 1~5는 상체 손 커서로 별빛을 모으는 컨셉 유지.
   - 수집 성공 시 마법 게이지 충전 및 군단 집중 마법 탄막 일제 사격.
   - **실패 패널티**: 미니언 피해 없음. 그러나 충전 중이던 강력 마법 발사 타이밍이 끊기고 쿨다운 지연(딜로스).
3. **보스 광폭화 (Enrage Phase)**:
   - 보스 체력 30% 이하 도달 시 공격 주기 1.5배 가속 및 장판/적 미니언 동시 다발 맹공.

| 작업 ID | GitHub Issue | 제목 | 핵심 모듈 | 상태 |
|---|---|---|---|:---:|
| `BATTLE-BOSS-001` | [#193](https://github.com/Choyounhwa/-dream-guardian/issues/193) | Phase B 보스 불협화음 장판(양손 쿵 점프 & 한손 콩콩 발짓밟기) 및 광폭화 엔진 | `BossHazardController.ts`, `BossController.ts` | ⚪ 대기 |
| `MINION-TROOP-001` | [#194](https://github.com/Choyounhwa/-dream-guardian/issues/194) | 아군 미니언 군단(3~13체) 실시간 증원/탈락 및 상체(Zone 1~5) 별빛 수집 마법 발사 시스템 | `MinionTroopManager.ts`, `BattleState.ts` | ⚪ 대기 |
| `RENDER-CLIMAX-001` | [#195](https://github.com/Choyounhwa/-dream-guardian/issues/195) | 3D 원근 보스 결전 연출(불협화음 장판 충격파, 적 미니언 전진, 아군 군단 마법 탄막 및 광폭화) | `BossClimaxRenderer.ts`, `CanvasManager.ts` | ⚪ 대기 |




---

## 🟢 2026-09-22 세션 구현 완료 내역 (21개 카드 전원 통과)

> 등록일: 2026-09-22 / 최종 상태: **GitHub Issue 카드 21건 완료 (#116, #120, #121, #117, #118, #119, #122, #123, #124, #125, #126, #127, #128, #129, #131, #132, #133, #134, #135, #136, #137, #138, #140, #130), 테스트 336/336 100% Pass**

사용자 요청 사항, 결함 제보 및 자세 선택 시스템 기반 리팩터링에 따라 총 21개 카드의 개발 및 검증을 100% 완료했습니다.

### 1. 완료된 작업 카드 상세 내역

| 카드 ID | GitHub Issue | 제목 | 핵심 구현 성과 | 검증 결과 |
|---|---|---|---|---|
| `BUG-CURSOR-001` | [#116](https://github.com/Choyounhwa/-dream-guardian/issues/116) | 문제선택 화면 스켈레톤-커서 좌표계 이격 해결 | CameraLayer Cover 3.0배 확대 투영 일원화, 스켈레톤-커서 중심 오차 0.0000px 완전 일치 달성 | 🟢 **Pass (259/259)** |
| `CFG-001` | [#120](https://github.com/Choyounhwa/-dream-guardian/issues/120) | 존/커서/티어 설정 `config/` 외부화 및 Config 분리 | `config/zone`, `cursor`, `posture` 신설, 하드코딩 상수 완전 외부화, Config.ts 재노출 호환성 유지 | 🟢 **Pass (260/260)** |
| `ZONE-001` | [#121](https://github.com/Choyounhwa/-dream-guardian/issues/121) | 피트니스 존 레이아웃 재정의 | 10개 존 상호 겹침 0% 수치 보장, 문제/답안 전용 예약 밴드 확립, `HEAD_ZONES ∩ HIP_ZONES = ∅` 충돌 원천 차단 | 🟢 **Pass (264/264)** |
| `FEAT-CURSOR-001` | [#117](https://github.com/Choyounhwa/-dream-guardian/issues/117) | 신체 부위 크기 추정 기반 커서 동적 사이징 및 손바닥 트래킹 | 어깨 너비 비례 0.55~2.0x 동적 사이징, 채움색 없는 투명 네온 외곽선(Outline Only), Pose 손가락 기저 가중 손바닥 중심 트래킹 | 🟢 **Pass (267/267)** |
| `FEAT-CURSOR-002` | [#118](https://github.com/Choyounhwa/-dream-guardian/issues/118) | 커서 화면 이탈 방지 상위 스켈레톤 계층 Fallback 및 스무딩 이동 | 손바닥→손목→전완→팔꿈치→상완→어깨 6단계 Fallback, 지수 보간(Lerp 0.25), 화면 경계 0.02 마진 안전 클램핑 | 🟢 **Pass (270/270)** |
| `BUG-MENU-001` | [#119](https://github.com/Choyounhwa/-dream-guardian/issues/119) | 메뉴 화면 4색 커서 상시 가시화 및 양손 모으기 제스처 복원 | 첫 메뉴 진입 즉시 4색 커서 가시화, Cover 줌 감안 합장 임계값 0.22 튜닝, 0.8초 호버 체류 자동 선택, 마우스/키보드 Fallback 보존 | 🟢 **Pass (275/275)** |
| `DATA-001` | [#122](https://github.com/Choyounhwa/-dream-guardian/issues/122) | 피트니스 패턴 원본 데이터 로더 및 유효성 검증기 | `FitnessPatternLoader.ts` 구현, `fitness pattern.csv` 360건 전수 무오류 파싱(S:60, D:100, T:100, Q:100) 및 타입화 | 🟢 **Pass (280/280)** |
| `POSE-001` | [#123](https://github.com/Choyounhwa/-dream-guardian/issues/123) | 자세 선택 시스템 AnswerPosture 및 PostureProgress 타입 신설 | RC-1/RC-5 해소: 다중 부위-다중 존 집합 덮기 모델, 존별/부위별 독립 진행도 추적, ChoiceRecipe 상호 호환 어댑터 | 🟢 **Pass (281/281)** |
| `POSE-002` | [#124](https://github.com/Choyounhwa/-dream-guardian/issues/124) | 집합 덮기(Set Coverage) 기반 matchPosture 판정 알고리즘 | 조건 A(모든 요구 부위가 목표 존에 위치) 및 조건 B(모든 목표 존이 덮임) 수학적 구현, 좌우 교환 허용 및 몰림 방지 | 🟢 **Pass (299/299)** |
| `POSE-003` | [#125](https://github.com/Choyounhwa/-dream-guardian/issues/125) | 패턴 풀 기반 선택지 생성기 및 7대 안전 제약(C1~C7) 검증기 | C1~C7(최대 3존, 상호 배타 부위로 Deadlock 원천 차단, 머리/골반 물리 정렬, 쿨다운 등) 100회 연속 무결성 보장 | 🟢 **Pass (310/310)** |
| `POSE-004` | [#126](https://github.com/Choyounhwa/-dream-guardian/issues/126) | PartGate (캘리브레이션 기준선 대비 신체 변위) 판정 구현 | `CalibrationBaseline` 확장, 스쿼트(골반 하강 변위), 목 기울임, 만세 상향 변위 검증으로 단순 직립 자동 충족(RC-3) 완전 해결 | 🟢 **Pass (320/320)** |
| `ICON-001` | [#127](https://github.com/Choyounhwa/-dream-guardian/issues/127) | PartIconRenderer 신설 (손/머리/골반 공통 아이콘 시스템) | 4색 신체 부위 벡터 아이콘(좌향/우향 손바닥, 원형 얼굴, 다이아몬드 골반) 렌더러 신설 | 🟢 **Pass (326/326)** |
| `UI-001` | [#128](https://github.com/Choyounhwa/-dream-guardian/issues/128) | 답안 버튼 부위 아이콘, 색상 및 묶음 기호(함께/각각) 시각화 | 답안 버튼 하단 요구 부위 아이콘 렌더링, `( )` 함께 한 존에, `\|` 각각 다른 존에 묶음 기호, 그라데이션 테두리 | 🟢 **Pass (327/327)** |
| `UI-002` | [#129](https://github.com/Choyounhwa/-dream-guardian/issues/129) | 피트니스 존별/부위별 독립 진행도 피드백 및 i % 2 오매핑 수정 | 존별 독립 진행도 맵 연동, 3개 이상 존 독립 렌더링, 커서별 진입 존 독립 아크 점등 | 🟢 **Pass (329/329)** |
| `UI-003` | [#131](https://github.com/Choyounhwa/-dream-guardian/issues/131) | 홈메뉴 원거리/대화면 레이아웃 개편 및 카드 간격 확장 | 메인 챕터 카드 60% 대형화 및 간격 24~28px 확장, 단계선택 2열 와이드 그리드 개편, 뒤로가기 버튼 대형화 | 🟢 **Pass (329/329)** |
| `UI-004` | [#132](https://github.com/Choyounhwa/-dream-guardian/issues/132) | 원거리(1m+) 가독성 보장을 위한 인게임 HUD 및 수식/결과 텍스트 대형화 | HP바 32px 및 HP 폰트 18px, 수식 폰트 64px, 분수선/루트 3.5px, 결과 통계 1.5배 스케일업 | 🟢 **Pass (329/329)** |
| `INPUT-002` | [#133](https://github.com/Choyounhwa/-dream-guardian/issues/133) | 스켈레톤 커서 메뉴 조작성 개선 (히트박스 패딩 및 호버 히스테리시스) | 히트박스 패딩(+12px) 및 호버 히스테리시스(+24px) 떨림 방지, 0.8초 아크 50px/7px 대형화 | 🟢 **Pass (331/331)** |
| `FEAT-RESULT-001` | [#134](https://github.com/Choyounhwa/-dream-guardian/issues/134) | 게임 결과 화면 양손 합장 제스처 메뉴 복귀 기능 구현 | 결과 화면에서 양손 모으기 0.8초 체류 시 터치 없이 메뉴 자동 복귀 | 🟢 **Pass (332/332)** |
| `CALC-001` | [#135](https://github.com/Choyounhwa/-dream-guardian/issues/135) | 자세 유지(Dwell Time) 기반 피트니스 칼로리 소모 계산식 확장 | `(steps*0.04) + (squats*0.35) + (jumps*0.15) + (dwell*0.07)` 공식 적용 및 결과 화면 표시 | 🟢 **Pass (332/332)** |
| `AUDIO-002` | [#136](https://github.com/Choyounhwa/-dream-guardian/issues/136) | 피트니스 존 체류 충전음 및 자세 완성 화음 효과음 구현 | `SFXSynth.ts` 구현, 체류 진행도(0~1)에 비례한 피치 상승(220Hz->880Hz) 충전음, C5-E5-G5 3화음 벨 톤 | 🟢 **Pass (335/335)** |
| `TUT-001` | [#137](https://github.com/Choyounhwa/-dream-guardian/issues/137) | 최초 플레이어 대상 인터랙티브 튜토리얼 오버레이 구현 | 3단계 가이드(커서 소개 -> 존 매칭 -> 준비 완료), 원클릭/Space/제스처 스킵, localStorage 1회 영속화 | 🟢 **Pass (337/337)** |
| `DOCS-001` | [#138](https://github.com/Choyounhwa/-dream-guardian/issues/138) | GDD 기획서 및 프로젝트 공식 문서 최신화 | GDD/AGENTS/WBS 내 보라 머리/얼굴 확정, 10존 레이아웃 및 집합 덮기 공식 반영 | 🟢 **Pass (337/337)** |
| `FEAT-CURSOR-003` | [#140](https://github.com/Choyounhwa/-dream-guardian/issues/140) | 전 장면 4색 스켈레톤 커서 상시 지속 가시화 및 생명주기 통일 | 메뉴·달리기·문제·결과 전 화면에서 4색 커서 상시 렌더링 일원화 | 🟢 **Pass (321/321)** |
| `REFACTOR-001` | [#130](https://github.com/Choyounhwa/-dream-guardian/issues/130) | AnswerSelector 죽은 판정 경로(update) 정리 및 단위 테스트 정비 | 미사용 레거시 update 경로 및 _progress 제거, updateFromPose 단일 파이프라인 일원화 | 🟢 **Pass (336/336)** |
| `BUG-SCALE-002` | [#144](https://github.com/Choyounhwa/-dream-guardian/issues/144) | 실사용 웹캠 근접 환경 신체 실측 크기 동적 추정 고도화 및 커서 시인성 현실화 | 귀 가림 시 눈(x2.6)·코/어깨 다계층 안면 추정, 팔꿈치 이탈 시 손목 너머 손바닥 40~70px 전진, 1080p 커서 규격 상향(손 45~90px, 머리 55~140px, 골반 55~120px, PC 1.5m baseline 350px/하한 0.70) | 🟢 **Pass (357/357)** |
| `FEAT-CURSOR-004` | [#145](https://github.com/Choyounhwa/-dream-guardian/issues/145) | 스켈레톤 손 트래킹 중지 기저부(MCP) 위치 조정 및 골반 커서 실측 다리 너비(1.5x) 라운드 납작 마름모 개편 | 손 트래킹 중지 손가락 시작점(3rd MCP) 상향, 골반 커서 실측 다리 너비 1.5배(너비 = hipDist × 1.5) 동적 확장, 모서리 라운드 납작 마름모 렌더링 개편 | 🟢 **Pass (360/360)** |
| `UI-MENU-003` | [#146](https://github.com/Choyounhwa/-dream-guardian/issues/146) | 04_STORY_SOURCE_수정.md 기반 홈 메뉴 꿈속 세계 탐험 및 테마명 개편 | 홈 메뉴 타이틀을 '꿈속 세계 탐험'으로 변경, 5개 챕터명을 몬스터 이름 대신 몽계 성역 테마(에메랄드 심해, 사탕 바구니 숲, 오르골 구름 서재, 색종이 사파리, 은하 회전목마)로 개편 및 풀 테마명/부제 가시화 | 🟢 **Pass (390/390)** |
| `INPUT-MOTION-001` | [#169](https://github.com/Choyounhwa/-dream-guardian/issues/169) | 인게임 문제 스테이지 양손 합장 제스처 메뉴 연동 및 문제풀이 일시정지 가드 | 인게임 전 프레임 합장 감지 활성화, 금빛 네온 합장 링 렌더링, 하단 바(정지/설정) 0.8초 호버 연동, 합장 중 답안 판정 일시정지(Safety Guard) 및 분리 시 4색 커서 즉시 복귀 | 🟢 **Pass (470/470)** |
| `UI-ANS-001` | [#163](https://github.com/Choyounhwa/-dream-guardian/issues/163) | 답안 버튼 외곽선 두께 2배 증가 (8px) | 답안 버튼 외곽선 테두리 선 두께 8px(기존 4px 대비 2배), 기본 lineWidth 7.0 상향, 방사선 3.0 상향 및 네온 글로우(12px) 강화 | 🟢 **Pass (471/471)** |
| `UI-ANS-002` | [#164](https://github.com/Choyounhwa/-dream-guardian/issues/164) | 답안 버튼 위치 4, 5번 피트니스 존 하단 X축 정렬 배치 | 0번 버튼을 4번 존 하단(중심 X 183.6px), 1번 버튼을 5번 존 하단(중심 X 896.4px)에 수직 정렬하고 Y축 890px(존 하단 바로 아래) 재배치, 자식 요소 및 클릭 히트테스트 자동 동기화 | 🟢 **Pass (472/472)** |
| `RENDER-MATH-001` | [#165](https://github.com/Choyounhwa/-dream-guardian/issues/165) | 문제 영역 마젠타 사각 박스 가상 영역화 (화면 표시 제거) | `renderQuestion` 내 마젠타(#FF28D8) 테두리 및 어두운 사각 박스 드로잉 코드 완전 제거, Y 기준 좌표계만 유지하여 배경 그리드 및 보스 시야 100% 개방 | 🟢 **Pass (472/472)** |
| `RENDER-MATH-002` | [#167](https://github.com/Choyounhwa/-dream-guardian/issues/167) | 문제 폰트 1.5배 확대 및 영역 초과 시 자동 줄바꿈(Word Wrap) | 문제 폰트 크기 기본값 132px(기존 88px 대비 1.5배) 대형화, `MathRenderer` 내 `wrapMathTokens` 및 `maxWidth` 기반 자동 줄바꿈 지원, 분수·루트·지수 복합 토큰 원형 보존 및 수직 중앙 정렬 | 🟢 **Pass (475/475)** |
| `RENDER-ZONE-001` | [#173](https://github.com/Choyounhwa/-dream-guardian/issues/173) | 피트니스 존 활성화 시 네모 영역 표시 제거 (가상 영역화) | `PostureGuideRenderer.ts` 내 `_renderZoneHighlights`에서 네온 사각 테두리 및 반투명 채움 드로잉 제거(`renderZoneBoxes = false`), `AnswerSelectionRenderer` 사각 박스 가상화, 중앙 부위 벡터 아이콘 및 하단 스틱맨 실루엣 100% 유지 | 🟢 **Pass (480/480)** |
| `FEAT-MOTION-002` | [#171](https://github.com/Choyounhwa/-dream-guardian/issues/171) | 양손 대각 어깨 교차 X자 제스처 감지기(XGestureDetector) 구현 | 어깨 너비 정규화 대각 교차 판정, 0.4초 Dwell Time, 1.0초 쿨다운, 양손 합장 제스처와 오인식 분리 검증 완비 | 🟢 **Pass (489/489)** |
| `UI-PAUSE-001` | [#172](https://github.com/Choyounhwa/-dream-guardian/issues/172) | 인게임 일시정지(Pause) 팝업 모달 구현 및 X자/합장 제스처 연동 | 서브메뉴 X자 뒤로가기, 인게임 X자 일시정지 모달 호출, 게임/타이머 일시정지, 양손 합장 커서 0.8초 호버로 [재개]/[나가기] 확정 선택, Esc/P 키보드 단축키 지원 | 🟢 **Pass (497/497)** |
| `BUG-ZONE-003` | [#175](https://github.com/Choyounhwa/-dream-guardian/issues/175) | 문제풀이 피트니스 존 하드코딩 고정 배치 해소 및 전 구역(1~11번) 순환/랜덤 다양화 | 티어별 다채로운 공용 존 풀 구축(Tier 1: 7개 존, Tier 2: 4종 머리·손 교차, Tier 3: 8종 2존 조합, Tier 4: 상단 만세 5종), 직전 존 연속 출제 방지 쿨다운 적용 및 첫 문제 4번 시작 안정화, `main.ts` 부트스트랩 시 360건 피트니스 패턴 로더 파이프라인 연동 | 🟢 **Pass (502/502)** |

### 2. 브라우저 실테스트 피드백 반영 및 주요 환경 해결

- **포트 3000 서빙 경로 불일치 해결**: 어제(`2026-09-21`) 실행된 구버전 폴더(`E:\AIAIAIAI`, AI 4개)의 좀비 Vite 프로세스가 포트 3000을 잡고 있어 변경사항이 미반영되던 현상 규명 → 프로세스 강제 종료 후 현재 워크스페이스(`E:\AIAIAIAIAI`)에서 신규 가동.
- **`dream_guardian/index.html` 모던 TypeScript 진입점 교체**: 2,802줄 구버전 monolithic HTML을 `docs/archive/legacy_prototype/`로 안전 백업하고, `dream_guardian/index.html`이 `/src/main.ts`를 직접 모듈로 로드하도록 갱신 (46개 모듈 전체 번들링 확인).
- **스켈레톤 손바닥 연장**: 스켈레톤 팔 뼈대(`BoneRenderer`)가 손목에서 손바닥 중심까지 연장되며, `JointRenderer`의 발광 원형 구체가 손목이 아닌 **손바닥 정중앙**에 표시되도록 개선.
- **합장 감지 임계값 현실화**: 3.0배 Cover 뷰포트 확대율에 맞춰 `MenuInput` 감지 거리를 `0.22`로 조정하여 양손 모으기 제스처와 0.8초 프로그레스 아크 활성화.
- **커서 동적 사이징 현실화**: 가상 좌표계 기준 어깨 너비(`460px`)와 손 길이 한계치(`260px`)를 Cover 줌에 맞추어 보정하여, 카메라 거리에 따라 커서가 시원하게 커지고 작아지는 다이내믹 스케일링 복원.
- **서버 런처 동기화**: `run_server.bat`이 현재 워크스페이스의 Vite 개발 서버(`npm run dev`)를 바로 띄우도록 갱신.

---

## 🟡 신규 접수 현안: 원거리(1m+) UI 전면 레이아웃 개편 및 레거시 제거 (Issue #141, #142, #143 등록)

> 등록일: 2026-09-24 / 상태: **GitHub Issue 카드 3건 등록 완료 (#141, #142, #143), 구현 승인 대기**

사용자가 제공한 5장의 UI 설계 가이드 이미지에 따라 1080×2160 해상도 기준 1미터 이상 원거리 플레이 시인성과 조작성을 완벽히 확보하기 위한 종합 UI 데이터 분석 및 작업 카드가 정식 등록되었습니다.

### 1. 신규 등록 카드 요약

| 순서 | 카드 ID | GitHub Issue | 제목 | 핵심 구현 및 삭제 대상 | 상태 |
|---|---|---|---|---|---|
| 1 | `UI-BAR-001` | [#141](https://github.com/Choyounhwa/-dream-guardian/issues/141) | 전 화면 공통 하단 고정 바(Yellow Bar) 및 설정(Settings) 모달 신설과 레거시 상단 부유 버튼(#top_controls) 완전 삭제 | • **[삭제]** `index.html` 상단 부유 버튼 (`#top_controls`, `#btn_cam`, `#btn_fullscreen`) 및 CSS 제거<br>• **[신규]** 전 화면 공통 200px 하단 고정 바 (`y: 1960~2160`)<br>• **[신규]** 좌측 `설정` 모달 버튼 (`30, 1990, 140x140`, Cyan), 우측 액션 프레임 (`810, 1990, 240x140`, Red)<br>• **[신규]** `SettingsModal.ts` 팝업 구현 (카메라/전체화면/스켈레톤/볼륨) | 🟢 **Pass (385/385)** |
| 2 | `UI-MENU-002` | [#142](https://github.com/Choyounhwa/-dream-guardian/issues/142) | 홈 메뉴(2-2-1) 및 서브 메뉴(2x3) 와이드 레이아웃 개편과 1:1 대형 폰트 적용 (레거시 가로 1열 및 상단 뒤로가기 삭제) | • **[삭제]** 가로 1열 140px 챕터 카드 나열식 및 단일 행 `hitTest` 제거<br>• **[삭제]** 상단 `y: 0.14` 높이 40px 작고 좁은 뒤로가기 버튼 제거<br>• **[신규]** 홈 메뉴 **2 - 2 - 1 와이드 다이아몬드 그리드** (`360×380px` 카드, 1:1 폰트 64/48/42px)<br>• **[신규]** 서브 메뉴 **2열 3행 대형 와이드 그리드** (`420×380px`, 1:1 폰트 68px/32px)<br>• **[신규]** `← 뒤로` 버튼을 하단 고정 바 우측 슬롯(`780, 1990, 270x140`, 42px)으로 이관 | 🟢 **Pass (386/386)** |
| 3 | `UI-INGAME-001` | [#143](https://github.com/Choyounhwa/-dream-guardian/issues/143) | 인게임 마젠타 문제영역 고정 컨테이너, 3중 회전 마법진(E_Pit_act1~3) 피트니스 존 및 마젠타 결과 카드 패널 개편 | • **[삭제]** `HUDLayer.ts` 좌하단 구석 세로형 마나 플라스크(`_renderManaFlask`) 삭제 (하단 바로 이관)<br>• **[삭제]** 단순 직사각형 점선 피트니스 존 테두리 및 텍스트 삭제<br>• **[삭제]** 결과 화면의 프레임 없는 24px 단순 텍스트 나열 코드 삭제<br>• **[신규]** **마젠타 문제영역 고정 박스** (`100, 320, 880x1000px`, 텍스트 오버플로우 방지 자동 축소)<br>• **[신규]** **3중 회전 마법진 피트니스 존** (`E_Pit_act1~3.png` 각각 다른 방향 Spin/Orbit/Shimmer 애니메이션)<br>• **[신규]** 답안 버튼 2개 횡배치 (`360×260px`, 폰트 96px)<br>• **[신규]** **마젠타 결과 카드 패널** (`100, 240, 880x1580px`, 8개 지표 라인 74px x 폰트 44px 1:1 매핑) | 🟢 **Pass (388/388)** |
| 4 | `FEAT-CURSOR-004` | [#145](https://github.com/Choyounhwa/-dream-guardian/issues/145) | 스켈레톤 손 트래킹 중지 기저부(MCP) 위치 조정 및 골반 커서 실측 다리 너비(1.5x) 라운드 납작 마름모 개편 | • **[개편]** 손바닥 트래킹 중심을 손목/손바닥 하단에서 **중지 손가락 시작부(3rd MCP)**로 상향<br>• **[개편]** 골반 커서 크기를 양다리 시작 포인트(#23-#24) 사이 실측 거리의 **1.5배(너비 = hipDist × 1.5)**로 동적 확대<br>• **[개편]** 골반 커서 형상을 기존 역삼각형에서 **모서리가 둥근 납작한 마름모(Flattened Rounded Rhombus)**로 개편 | ⚪ **대기 (승인 대기)** |
| 5 | `BUG-BATTLE-001` | [#146](https://github.com/Choyounhwa/-dream-guardian/issues/146) | 정답 시 보스 HP 즉시 감소 타격 누락 결함 (4문제 맞혀야만 HP 감소) | • **[원인]** `main.ts`에서 정답 시 마나만 +25 적립하고, 보스 데미지 처리가 마나 100 조건문 내에만 존재하여 1~3문제 정답 시 보스 HP 불변<br>• **[해결]** 매 정답마다 기본 1 데미지(`boss.takeDamage(1)`) 및 피격 연출 즉각 발동, 마나 100 도달 시 수호신 스펠 보너스 데미지 연계 | ⚪ **대기 (승인 대기)** |
| 6 | `BUG-BATTLE-002` | [#147](https://github.com/Choyounhwa/-dream-guardian/issues/147) | 기습 보스 공격 타이머 제거 및 오답 반격 일원화를 통한 전투 템포/체력 소진 결함 개선 | • **[원인]** 상시 실행되는 독립 보스 공격 타이머로 인한 무차별 피격 및 돌발 스쿼트 방어로 인한 러닝/연산 흐름 단절<br>• **[해결 (대안 A 채택)]** 기습 보스 공격 타이머 비활성화/삭제(`attackInterval=0`), 보스 공격을 **오답 시 반격(-25 HP)** 및 피격 연출로 일원화, 스쿼트는 하단 존(Zone 7~10) 정답 선택 운동으로 본래 역할 집중 | 🟢 **Pass (369/369)** |
| 7 | `FEAT-UI-005` | [#148](https://github.com/Choyounhwa/-dream-guardian/issues/148) | 답안 버튼 사각형 중심점 기점 방사형(Radial) 색상 분할 렌더링 구현 | • **[목적]** 답안 버튼(둥근 사각형) 형태를 유지하면서 선형 그라디언트를 사각형 중심점 기점 방사형(Radial) 색상 분할로 개편하여 요구 커서 시인성 극대화<br>• **[신규]** 1색(단색), 2색(1/2 방사형), 3색(1/3 방사형) 분할 렌더러 구현 | 🟢 **Pass (377/377)** |
| 8 | `FEAT-ZONE-002` | [#149](https://github.com/Choyounhwa/-dream-guardian/issues/149) | 11번 우저(Right Bottom) 피트니스 존 추가 및 11구역 레이아웃 정합성 확보 | • **[목적]** 설계 문서 및 패턴 원본과 달리 코드에서 누락된 11번 존(`우저`, x: 0.70, y: 0.78, 0.26x0.16) 추가<br>• **[신규]** `HIP_ZONES`에 11번 포함 및 11개 존 겹침 0% 보장 | 🟢 **Pass (369/369)** |
| 9 | `REFACTOR-POSE-001` | [#150](https://github.com/Choyounhwa/-dream-guardian/issues/150) | 좌/우 답안 공용 피트니스 존(Shared Active Zone) 및 색상 커서 선택 메커니즘 전환 | • **[목적]** 좌/우 선택지별 분리 존 배정 방식을 설계 대전제인 "공용 활성 존에 계산한 답안의 색상 커서를 이동하여 판정"하는 메커니즘으로 전환<br>• **[개편]** `RecipeGenerator`, `AnswerSelector` 공용 타겟 존 연동 | 🟢 **Pass (372/372)** |
| 10 | `FEAT-POSE-006` | [#151](https://github.com/Choyounhwa/-dream-guardian/issues/151) | 신체 부위별(왼손/오른손 비대칭 및 머리) 허용 피트니스 존 제약 및 색상 완전 비공유 보장 | • **[목적]** 왼손/오른손의 전 구역 무제한 허용을 설계 규격(왼손: 1,2,4,6,7,9,10 / 오른손: 2,3,7,8,10,11)으로 비대칭 제한<br>• **[강화]** C2 제약을 완전 배타(`A.parts ∩ B.parts = ∅`)로 강화 | 🟢 **Pass (373/373)** |
| 11 | `FEAT-SKEL-004` | [#152](https://github.com/Choyounhwa/-dream-guardian/issues/152) | 스켈레톤 뼈대 연결선 투명도(20% 불투명도 조정) 정합성 반영 | • **[목적]** 현재 `0.6`으로 다소 짙은 뼈대 연결선을 설계 문서("연결선은 20% 투명도") 규격에 맞추어 시인성 조정 | ⚪ **대기 (승인 대기)** |
| 12 | `FEAT-MOTION-001` | [#153](https://github.com/Choyounhwa/-dream-guardian/issues/153) | 뛸 수 없는 환경을 위한 저소음/대체 이동(Locomotion) 감지기 3종 및 공통 인터페이스 구현 | • **[신규]** `ILocomotionDetector` 공통 인터페이스<br>• **[신규]** 골반 상하 바운스(`HipBounceDetector`)<br>• **[신규]** 골반 좌우 스웨이/트월킹(`HipSwayDetector`)<br>• **[신규]** 양손 상하 교차/드라이빙(`ArmCrossDetector`)<br>• **[신규]** `Config.ts` 감도 파라미터 분리 | 🟢 **Pass (399/399)** |
| 13 | `FEAT-UI-006` | [#154](https://github.com/Choyounhwa/-dream-guardian/issues/154) | 운동 모드(이동 방식 4종) 선택 UI 모달 및 커서/터치 인터랙션 구현 | • **[신규]** 4종 운동 모드(달리기/골반바운스/골반스웨이/양손교차) 선택 모달 UI<br>• **[신규]** 4색 신체 커서 0.8초 Dwell 및 마우스/터치 클릭 선택<br>• **[신규]** `localStorage` 선택 모드 영속 저장 및 복원 | 🟢 **Pass (416/416)** |
| 13-1 | `UI-BAR-002` | [#166](https://github.com/Choyounhwa/-dream-guardian/issues/166) | 하단 고정바(BottomBar) 내 운동 모드 선택 버튼 신설 및 메인 제목 하단 레거시 제거 | • **[신설]** 하단 고정바 좌측 `x: 190, y: 1990, w: 260, h: 140` 슬롯에 운동 모드 버튼 신설<br>• **[삭제]** 메인 메뉴 타이틀 하단 임시 운동 모드 버튼 완전 삭제<br>• **[연동]** 신체 커서 0.8초 체류 및 클릭 시 `LocomotionModal` 즉각 호출 | ⚪ **대기 (승인 대기)** |
| 14 | `FEAT-GAME-002` | [#155](https://github.com/Choyounhwa/-dream-guardian/issues/155) | 선택된 운동 모드 인게임 러닝 루프/HUD 동작 가이드 및 맞춤 칼로리 공식 연동 | • **[연동]** `main.ts` 러닝 루프 다형성 감지기 연동<br>• **[신규]** 인게임 HUD 모드별 맞춤 동작 가이드 안내<br>• **[신규]** 모드별 METs 맞춤 칼로리 소모 공식 및 결과 화면 표출 | 🟢 **완료 (100% Pass)** |
| 15 | `FEAT-ZONE-003` | [#156](https://github.com/Choyounhwa/-dream-guardian/issues/156) | 커서-존 허용 매트릭스 개편 (양손 전 존 1~11 허용, 머리 존 4~5 한정) 및 Cross-Body 제약(Hip 9~11 시 손 1~3 차단) 신설 | • **[개편]** 양손(`leftHand`, `rightHand`) 전 존(1~11) 허용 (옆구리 스트레칭 및 교차 도달)<br>• **[제한]** `HEAD_ZONES`를 `{4, 5}`로 한정 (존 1~3 점프 유지 불가 배제)<br>• **[신규]** Cross-Body 제약: 골반이 최하단(존 9~11)일 때 양손의 최상단(존 1~3) 배치 차단 | 🟢 **완료 (100% Pass)** |
| 16 | `DATA-002` | [#157](https://github.com/Choyounhwa/-dream-guardian/issues/157) | fitness pattern.csv 신규 HEAD_ZONES {4,5} 제약 반영 및 머리 패턴 전수 보정 | • **[수정]** `fitness pattern.csv` 162건 머리 패턴 존 1~3 → 존 4/5 재배치<br>• **[검증]** Cross-Body 위반 패턴 전수 정비 및 360건 무오류 로드 보장 | 🟢 **완료 (100% Pass)** |
| 17 | `FEAT-ZONE-004` | [#158](https://github.com/Choyounhwa/-dream-guardian/issues/158) | PostureGenerator C8 제약(Cross-Body) 통합 및 패턴 풀 필터링 | • **[신규]** `PostureGenerator`에 C8 제약(Hip 9~11 시 손 1~3 차단) 추가<br>• **[필터]** `FitnessPatternLoader` 및 `validatePosturePair()` 런타임 위반 차단 | 🟢 **완료 (100% Pass)** |
| 18 | `FEAT-GUIDE-001` | [#159](https://github.com/Choyounhwa/-dream-guardian/issues/159) | 목표 자세 실루엣 가이드 오버레이 (PostureGuideRenderer) 구현 | • **[신규]** `PostureGuideRenderer.ts` 생성<br>• **[시각화]** 반투명 스틱맨 인체 실루엣 및 목표 존 네온 하이라이트(부위 색상 글로우 + 중앙 아이콘) | 🟢 **완료 (100% Pass)** |
| 19 | `FEAT-GUIDE-002` | [#160](https://github.com/Choyounhwa/-dream-guardian/issues/160) | 스테이지 시작 첫 문제 유도 화살표(Arrow Hint) 표시 | • **[신규]** 스테이지 첫 문제(`questionNumber === 1`)에서만 커서→목표존 방향 화살표 렌더링<br>• **[소멸]** 목표 존 진입 시 소멸 및 5초 경과 시 자동 페이드아웃 (두 번째 문제부터 미표시) | 🟢 **완료 (100% Pass)** |
| 20 | `UI-BAR-003` | [#162](https://github.com/Choyounhwa/-dream-guardian/issues/162) | 설정 및 정지 버튼 문자 제거 및 아이콘화 | • **[개편]** 좌측 '⚙ 설정' 한글 제거 후 톱니바퀴 아이콘화, 우측 인게임 '정지' 한글 제거 후 일시정지(⏸) 아이콘화 | ⚪ **대기 (승인 대기)** |
| 21 | `UI-ANS-001` | [#163](https://github.com/Choyounhwa/-dream-guardian/issues/163) | 답안 버튼 외곽선 두께 2배 증가 | • **[강화]** 답안 버튼 외곽선 테두리 선 두께를 기존 4px 대비 2배(8px)로 확장하여 원거리 시인성 극대화 | ⚪ **대기 (승인 대기)** |
| 22 | `UI-ANS-002` | [#164](https://github.com/Choyounhwa/-dream-guardian/issues/164) | 답안 버튼 위치 4, 5번 피트니스 존 하단 X축 정렬 배치 | • **[재배치]** 0번/1번 답안 버튼을 4번(좌)/5번(우) 피트니스 존과 X축 위치를 일치시키고 바로 아래 하단에 배치 | ⚪ **대기 (승인 대기)** |
| 23 | `RENDER-MATH-001` | [#165](https://github.com/Choyounhwa/-dream-guardian/issues/165) | 문제 영역 마젠타 사각 박스 가상 영역화 (화면 표시 제거) | • **[정돈]** 마젠타(#FF28D8) 테두리 및 반투명 배경 박스 화면 드로잉 제거, 가상 레이아웃 좌표계로만 유지 | ⚪ **대기 (승인 대기)** |
| 24 | `RENDER-MATH-002` | [#167](https://github.com/Choyounhwa/-dream-guardian/issues/167) | 문제 폰트 1.5배 확대 및 영역 초과 시 자동 줄바꿈(Word Wrap) | • **[가독성]** 기본 문제 폰트 1.5배(132px급) 확대, 문제 영역 폭 초과 시 연산자/공백 단위 자동 줄바꿈 지원 | ⚪ **대기 (승인 대기)** |
| 25 | `UI-MENU-003` | [#168](https://github.com/Choyounhwa/-dream-guardian/issues/168) | 홈 메뉴 메인 타이틀 및 서브 문구 변경 | • **[텍스트]** 홈 메뉴 최상단 메인 타이틀 및 슬로건 문구를 최신 기획 및 사용자 지정 명칭으로 교체 | ⚪ **대기 (승인 대기)** |
| 26 | `INPUT-MOTION-001` | [#169](https://github.com/Choyounhwa/-dream-guardian/issues/169) | 인게임 문제 스테이지 양손 합장 제스처 메뉴 연동 | • **[인터랙션]** 인게임 문제/달리기 중에도 두 손 모을 시 합장 커서 표출 및 하단 설정/정지 버튼 0.8초 호버 조작 지원 | ⚪ **대기 (승인 대기)** |
| 27 | `INPUT-ZONE-001` | [#170](https://github.com/Choyounhwa/-dream-guardian/issues/170) | Head(머리) 및 Hip(골반) 커서 피트니스 존 진입 감도 최적화 | • **[감도]** 코/골반 중심점 1점 판정에서 바운딩 마진(25% 진입 또는 외곽 접촉 시 즉각 충전 개시)으로 최적화 | 🟢 **완료 (100% Pass)** |
| 28 | `BUG-ZONE-002` | [#174](https://github.com/Choyounhwa/-dream-guardian/issues/174) | Head 존 2 및 Hip 존 7 출제 배제 및 직립 자동 선택 방지 | • **[원인분석]** `HEAD_ZONES` 제약에도 `RecipeGenerator` 내 하드코딩 존(Tier 2: 2번, Tier 3: 2번/7번)으로 우회 출제 발생, 직립 시 머리(0.18)와 골반(0.60)이 각각 2번/7번에 자연 위치하여 출제 즉시 자동 선택 발생<br>• **[수정]** `HIP_ZONES`에서 7번 제외(`{6, 8, 9, 10, 11}`), `RecipeGenerator` Tier 2를 {4, 5}로, Tier 3을 4번(중단) + 10번(하단 스쿼트)으로 전면 교체<br>• **[데이터]** `fitness pattern.csv` 48건 골반 7번 패턴을 유효 존(6/8/10)으로 전수 보정 (360건 무오류 유지) | 🟢 **완료 (100% Pass)** |
| 29 | `BUG-ZONE-003` | [#175](https://github.com/Choyounhwa/-dream-guardian/issues/175) | 문제풀이 피트니스 존 하드코딩 고정 배치 해소 및 전 구역(1~11번) 순환/랜덤 다양화 | • **[원인분석]** `RecipeGenerator` 내 Tier 1(Zone 4), Tier 3(Zone 4+10), Tier 4(Zone 2)의 정적 하드코딩 및 쿨다운 부재로 인해 특정 존만 반복 출제되는 현상 규명<br>• **[다양화]** Tier 1(4, 5, 2, 1, 3, 6, 8), Tier 2(4/5 머리·손 교차 4종), Tier 3(8종 2존 협응 쌍), Tier 4(1, 2, 3, 5, 4) 등 전 구역 활용 존 풀 구축<br>• **[쿨다운]** 직전 문제와 동일한 존 배치 연속 출제 방지 쿨다운 적용 및 첫 문제는 4번 시작 안정화<br>• **[데이터]** `main.ts` 부트스트랩 시 `/fitness pattern.csv` 360건 비동기 로드 파이프라인 연동 | 🟢 **완료 (502/502 Pass)** |

---

### 2. 신규 제안: 뛸 수 없는 환경 대응 저소음 피트니스 이동 모드 (Issue #153, #154, #155)

아파트 층간 소음, 발 부상, 좁은 공간 등 뛸 수 없는 환경에서도 온전히 게임을 플레이할 수 있도록 3단계 분할 카드를 등록하였습니다.

1. **[FEAT-MOTION-001] 감지기 3종 및 공통 인터페이스 (#153)**:
   - `ILocomotionDetector` 공통 인터페이스 (`update`, `reset`, `isRunning`, `stepCount`)
   - **골반 상하 바운스 (`HipBounceDetector`)**: `LEFT_HIP(23)` / `RIGHT_HIP(24)` Y 바운스 (무소음 점프)
   - **골반 좌우 스웨이 (`HipSwayDetector`)**: 골반 X 중심 왕복 및 좌우 틸트 반전 (트월킹/코어 셰이크)
   - **양손 교차 상하 (`ArmCrossDetector`)**: `LEFT_WRIST(15)` / `RIGHT_WRIST(16)` Y 교차 역전 (드라이빙/휠 펌핑)
2. **[FEAT-UI-006] 운동 모드 선택 UI 모달 및 인터랙션 (#154)**:
   - 4개 모드 2x2 카드 UI (아이콘, 한국어 타이틀, 부위, 소음 등급 안내)
   - 4색 커서 체류(0.8s) 및 마우스/터치 클릭 지원, `localStorage` 영속화
3. **[FEAT-GAME-002] 인게임 러닝 루프 연동 및 맞춤 칼로리 (#155)**:
   - `gamePhase === 'running'` 게이지 충전 다형성 연동
   - 인게임 HUD 맞춤 모션 가이드 표시
   - 모드별 METs 맞춤 칼로리 공식 연동 및 결과 화면 표출

---

### 3. 신규 확정: 커서-피트니스 존 매트릭스 개편 및 자세 가이드 (Issue #156 ~ #160)

> 사용자 피드백(옆구리 늘리기 등 실제 관절 가동 범위 및 점프 체류 불가 문제)에 따라 커서-존 매트릭스를 현실화하고 시각 가이드를 신설합니다.

1. **커서-존 허용 매트릭스 확정**:
   - **왼손 (`leftHand`)**: **전 존(1~11) 허용** (반대편 도달 및 옆구리 늘리기 스트레칭)
   - **오른손 (`rightHand`)**: **전 존(1~11) 허용**
   - **머리 (`head`)**: **중단 좌/우 존(4, 5)만 허용** (존 1~3은 점프로 순간 진입은 가능하나 체류 유지가 불가능하므로 배제)
   - **골반 (`hip`)**: **하단 존(6~11)만 허용** (존 1~5 상단 이동 배제)
   - **Cross-Body 물리 연동 제약**: 골반이 최하단(존 9, 10, 11)일 때 양손은 최상단(존 1, 2, 3) 배치 불가 (스쿼트 시 만세 물리적 한계 배제)
2. **시각 가이드 시스템**:
   - **실루엣 가이드 오버레이 (`PostureGuideRenderer`)**: 목표 피트니스 존 네온 하이라이트(부위 색상 글로우 및 중앙 아이콘) + 반투명 스틱맨 인체 실루엣
   - **첫 문제 유도 화살표 (`Arrow Hint`)**: 스테이지 시작 첫 문제에서만 커서→목표존 방향 화살표 표시 (5초 또는 진입 시 페이드아웃, 2번째 문제부터 미표시)
   - **달리기 중 동적 보정**: 제자리 달리기 중 신체 이동 드리프트 보정은 정밀 설계를 위해 보류

---

## 🔴 최우선 현안: 자세 선택 시스템 재설계 (카드 등록 완료)

> 등록일: 2026-09-22 / 상태: **GitHub Issue 카드 등록 완료 (#120~#138), 구현 승인 대기**
> 상세 분석: `docs/04_POSTURE_SYSTEM_ANALYSIS.md`
> 패턴 원본: `E:\AIAIAIAIAI\Arithmetic Game\fitness pattern.csv` (360건)

스켈레톤 커서·피트니스 존·정답 선택이 의도대로 동작하지 않는 문제를 분석한 결과, **코드 버그가 아니라 데이터 모델이 요구 규칙을 표현할 수 없는 구조적 불일치**임이 확인되었습니다.

### A. 목표 게임 루프 (사용자 확정 명세)

```
에너지(마나) 충전 완료 → 문제 출제 + 답안 2개 표시
  → 각 답안이 1~3개 신체 부위를 요구 (좌/우 답안은 서로 다른 부위 구성)
  → 피트니스 존 1~3개 동시 활성화
  → 플레이어가 정답이라 판단한 답안의 요구 부위 커서를 활성 존에 배치
  → 약 1초 유지 → 답안 확정 → 정답/오답 판정
```

부위 수 × 존 수 조합 명세:

| 부위 | 존 | 플레이어 동작 |
|---|---|---|
| 1 | 1 | 해당 부위 커서를 존에 올린다 |
| 2 | 1 | 두 부위를 **같은 존**에 올린다 |
| 2 | 2 | 두 부위를 **각 존에 1개씩** (좌우 배치 자유) |
| 3 | 1 | 세 부위를 **모두 한 존**에 |
| 3 | 2 | 세 부위를 2개 존에 **2+1 분배** |
| 3 | 3 | 세 부위를 **각 존에 1개씩** |

명시적 제약: **머리와 골반이 동일한 존을 요구하는 조합은 배제**한다.
달성 목표: ① 직관성(답안을 보고 즉시 부위 판단) ② 운동성(국민체조·스트레칭) ③ 손/머리/골반 각기 다른 아이콘.

### B. 피트니스 패턴 원본 데이터 분석 (`fitness pattern.csv`, 360건)

컬럼 구조:

```csv
ID, 사용 부위, 왼손, 오른손, 머리, 골반, 판정 부위 수
S001,왼손,1,X,X,X,1          # 값 = 존 ID, 'X' = 미사용
D001,왼손 + 오른손,1,3,X,X,2
T001,왼손 + 오른손 + 머리,1,3,2,X,3
Q001,전신 (두 손 모아 하늘 + 바른자세 정면),2,2,2,7,4
```

ID 접두사별 분포:

| 접두사 | 의미 | 건수 | 판정 부위 수 |
|---|---|---|---|
| `S` | Single (단일 부위) | 60 | 1 |
| `D` | Double (2부위) | 100 | 2 |
| `T` | Triple (3부위) | 100 | 3 |
| `Q` | Quad / 전신 (4부위) | **100** | **4** |

실제 (부위 수 × 서로 다른 존 수) 교차 분포:

| | 1존 | 2존 | 3존 | 4존 | 합 |
|---|---|---|---|---|---|
| **1부위** | 60 | — | — | — | 60 |
| **2부위** | 6 | 94 | — | — | 100 |
| **3부위** | 3 | 41 | 56 | — | 100 |
| **4부위** | — | 11 | 52 | 37 | 100 |

존 ID 사용 빈도:

| 존 | 1 | 2 | 3 | 4 | **5** | 6 | 7 | 8 | 9 | 10 | **11** |
|---|---|---|---|---|---|---|---|---|---|---|---|
| 횟수 | 100 | 147 | 84 | 83 | **0** | 69 | 150 | 74 | 93 | 93 | **67** |

부위별 사용 존 집합:

| 부위 | 사용 존 |
|---|---|
| 왼손 | 1, 2, 4, 6, 7, 9, 10 |
| 오른손 | 2, 3, 7, 8, 10, 11 |
| 머리 | 1, 2, 3, 4 |
| 골반 | 6, 7, 8, 9, 10, 11 |

### C. 패턴 데이터 ↔ 명세/코드 3자 간 갈등 (⚠️ 결정 필요)

| # | 갈등 | 패턴 CSV | 사용자 명세 | 현재 코드 | 영향 |
|---|---|---|---|---|---|
| **G-1** | **존 총 개수** | **11개 (1~11), 존 5는 0회** | 미규정 | **11개 (1~11)** | 🟢 해결 (#149 FEAT-ZONE-002: 11번 우저 추가 완료) |
| **G-2** | **최대 부위 수** | **4부위 100건 (Q 시리즈)** | **최대 3부위** | 최대 2부위 | 🔴 Q 시리즈 100건 사용 여부 결정 필요 |
| **G-3** | 최대 존 수 | **최대 4존 (37건)** | **최대 3존** | 최대 3존 | 🟡 4존 패턴 37건 제외 또는 명세 확장 |
| **G-4** | 머리·골반 동일 존 | **0건 (준수)** | 배제 | Tier 3이 양 선택지 존 7 중복 → **위반** | 🟢 CSV는 이미 제약 충족 |
| **G-5** | 머리 허용 존 | 1, 2, 3, 4 | 미규정 | `HEAD_ZONES = {1,2,3,4,5,7}` | 🟡 CSV 기준(1~4)으로 축소 권장 |
| **G-6** | 골반 허용 존 | 6, 7, 8, 9, 10, **11** | 미규정 | `HIP_ZONES = {6,7,8,9,10,11}` | 🟢 해결 (#149: 존 11 포함 완료) |
| **G-7** | 손 허용 존 | 왼손 7종 / 오른손 6종 (**비대칭**) | 미규정 | `LEFT_HAND_ZONES`, `RIGHT_HAND_ZONES` | 🟢 해결 (#151 FEAT-POSE-006: 비대칭 구역 및 C2 완전 비공유 반영) |
| **G-8** | 양손 동일 존 | **허용** (D061 `2,2` 등 6건) | 허용 ("양손을 모두 존에") | 고정 페어링으로 표현 불가 | 🔴 집합 덮기 판정 필수 근거 |
| **G-9** | 커서 색상 정의 | 머리 사용 | 머리 | `head` = 보라 (GDD는 "어깨") | 🟢 머리로 확정, GDD 갱신 대상 |

**핵심 결론:** G-1(존 11개), G-2(4부위), G-8(양손 동일 존)은 **현재 코드 구조로 구현 불가능**합니다. `docs/04_POSTURE_SYSTEM_ANALYSIS.md`의 집합 덮기(Set Coverage) 판정 + 존 레이아웃 재정의가 선행되어야 합니다.

### D. 근본 원인 요약 (상세는 분석 문서 §4)

| ID | 원인 | 위치 |
|---|---|---|
| RC-1 ★★★ | 부위↔존이 **고정 인덱스 페어링** → "양손을 한 존에" 표현 불가 | `RecipeGenerator.ts:97` |
| RC-2 ★★★ | 답안 UI에 부위 정보 0. `RenderZoneInfo.requiredCursors` 정의만 존재·미사용 | `AnswerSelectionRenderer.ts:16,29-36` |
| RC-3 ★★★ | 절대 좌표 존 → 직립만으로 조건 충족 (코 y≈0.15가 존2에, 골반 y≈0.6이 존7에 이미 포함) | `AnswerSelector.ts:45-56` |
| RC-4 ★★ | `activeZones`가 파생값 → 존 개수 제어 불가 | `RecipeGenerator.ts` |
| RC-5 ★★ | 진행도 2슬롯뿐 → `choiceProgress[i % 2]`로 3번째 존 오매핑, 전 커서에 `max()` 공통 전달 | `AnswerSelectionRenderer.ts:43,61` |
| RC-6 ★★ | `HEAD_ZONES ∩ HIP_ZONES = {7}` → 머리·골반 충돌 + Deadlock Guard 리셋 루프 | `AnswerSelector.ts:59-63,97-98` |
| RC-7 ★ | 판정 경로 이중화. `update()`(존 기반)와 `updateFromPose()`(선택지 기반)가 상태 비공유, 실게임은 후자만 사용하며 부위-존 제약 미검증 | `AnswerSelector.ts:194-282,309-378` |
| RC-8 ★ | `config/` 디렉터리 부재 (개발 규칙 6절 위반). 존 좌표·티어·감쇠 계수 전부 하드코딩 | 프로젝트 전역 |
| RC-9 ★ | 존 4·5와 6·7·8이 y 0.55~0.58 **겹침**, 답안이 존 4·5 내부에 그려짐 | `AnswerSelector.ts:45-56`, `main.ts:277` |

### E. 확정된 기획 결정

| # | 항목 | 결정 |
|---|---|---|
| D-1 | 산출물 | `docs/04_POSTURE_SYSTEM_ANALYSIS.md` 분석 문서 (완료) |
| D-2 | 존 레이아웃 | **재정의 적용** — 겹침 제거 + 문제/답안 밴드 예약 |
| D-3 | 보라 `#C889FF` | **머리/얼굴(head)로 확정.** GDD "어깨" 표기 갱신, `shoulder` 타입 폐기 |

### F. 다음 세션 착수 항목 (우선순위)

**1단계 — 사용자 결정 필요 (구현 불가 차단 항목)**

- [ ] **G-1 결정**: 존을 11개로 확장할지, CSV의 존 11 패턴 67건을 버릴지
- [ ] **G-1b 결정**: CSV에서 0회 사용된 **존 5의 처리** (삭제 / 신규 패턴 추가 / 예비 유지)
- [ ] **G-2 결정**: 4부위(Q 시리즈) 100건을 채택하여 명세를 1~4부위로 확장할지, 제외할지
- [ ] **G-3 결정**: 4존 패턴 37건 채택 여부

**2단계 — 작업 카드 등록 완료 (개발 규칙 9항, 승인 대기)**

| 순서 | 카드 ID | GitHub Issue | 제목 | 관련 RC/G | 분류 | 상태 |
|---|---|---|---|---|---|---|
| 1 | `CFG-001` | [#120](https://github.com/Choyounhwa/-dream-guardian/issues/120) | 존/커서/티어 설정 `config/` 외부화 및 Config 분리 | RC-8 | `refactor`, `P1-high` | 🟢 **완료 (260/260 Pass)** |
| 2 | `ZONE-001` | [#121](https://github.com/Choyounhwa/-dream-guardian/issues/121) | 피트니스 존 레이아웃 재정의 (겹침 제거 및 문제/답안 밴드 예약) | RC-9, G-1 | `feature`, `P1-high` | 🟢 **완료 (264/264 Pass)** |
| 3 | `DATA-001` | [#122](https://github.com/Choyounhwa/-dream-guardian/issues/122) | 피트니스 패턴 원본 데이터(fitness pattern.csv) 로더 및 유효성 검증기 구현 | G-1~G-8 | `feature`, `P1-high` | 🟢 **완료 (280/280 Pass)** |
| 4 | `POSE-001` | [#123](https://github.com/Choyounhwa/-dream-guardian/issues/123) | 자세 선택 시스템 AnswerPosture 및 PostureProgress 데이터 타입 신설 | RC-1, RC-5 | `feature`, `P1-high` | 🟢 **완료 (281/281 Pass)** |
| 5 | `POSE-002` | [#124](https://github.com/Choyounhwa/-dream-guardian/issues/124) | 집합 덮기(Set Coverage) 기반 matchPosture 판정 알고리즘 및 단위 테스트 구현 | RC-1, RC-4, G-8 | `feature`, `P0-critical` | 🟢 **완료 (299/299 Pass)** |
| 6 | `POSE-003` | [#125](https://github.com/Choyounhwa/-dream-guardian/issues/125) | 패턴 풀 기반 좌/우 선택지 추출기 및 생성 제약(C1~C7) 검증기 구현 | RC-4, RC-6 | `feature`, `P1-high` | 🟢 **완료 (310/310 Pass)** |
| 7 | `POSE-004` | [#126](https://github.com/Choyounhwa/-dream-guardian/issues/126) | PartGate (캘리브레이션 기준선 대비 신체 변위) 판정 구현 | RC-3 | `feature`, `P1-high` | 🟢 **완료 (320/320 Pass)** |
| 8 | `ICON-001` | [#127](https://github.com/Choyounhwa/-dream-guardian/issues/127) | PartIconRenderer 신설 (손/머리/골반 부위별 공통 아이콘 시스템) | 아이콘 요구 | `feature`, `P2-medium` | 🟢 **완료 (326/326 Pass)** |
| 9 | `UI-001` | [#128](https://github.com/Choyounhwa/-dream-guardian/issues/128) | 답안 버튼 부위 아이콘, 색상 및 묶음 기호(함께/각각) 시각화 | RC-2 | `feature`, `P1-high` | 🟢 **완료 (327/327 Pass)** |
| 10 | `UI-002` | [#129](https://github.com/Choyounhwa/-dream-guardian/issues/129) | 피트니스 존별/부위별 독립 진행도 피드백 및 i % 2 오매핑 수정 | RC-5 | `bug`, `P1-high` | 🟢 **완료 (329/329 Pass)** |
| 11 | `UI-003` | [#131](https://github.com/Choyounhwa/-dream-guardian/issues/131) | 홈메뉴(챕터 및 서브레벨 단계선택) 원거리/대화면 레이아웃 개편 및 카드 간격 확장 | 1m 원거리 조작성 | `feature`, `P1-high` | 🟢 **완료 (329/329 Pass)** |
| 12 | `UI-004` | [#132](https://github.com/Choyounhwa/-dream-guardian/issues/132) | 원거리(1m+) 가독성 보장을 위한 인게임 HUD 및 수식/선택지/결과 텍스트 대형화 & 고대비 렌더링 | 1m 텍스트 가독성 | `feature`, `P1-high` | 🟢 **완료 (329/329 Pass)** |
| 13 | `INPUT-002` | [#133](https://github.com/Choyounhwa/-dream-guardian/issues/133) | 스켈레톤 커서 메뉴 조작성 개선 (히트박스 패딩 마진, 호버 떨림 방지 히스테리시스 및 가시성 강화) | 스켈레톤 커서 오선택 방지 | `feature`, `P1-high` | 🟢 **완료 (331/331 Pass)** |
| 14 | `FEAT-RESULT-001` | [#134](https://github.com/Choyounhwa/-dream-guardian/issues/134) | 게임 결과 화면(Result) 양손 합장(모으기) 제스처 메뉴 복귀 기능 및 시각 피드백 구현 | 결과 화면 모션 조작 | `feature`, `P1-high` | 🟢 **완료 (332/332 Pass)** |
| 15 | `CALC-001` | [#135](https://github.com/Choyounhwa/-dream-guardian/issues/135) | 자세 유지(Dwell Time) 기반 피트니스 칼로리 소모 계산식 확장 및 결과 통계 연동 | 칼로리 보상 정밀화 | `feature`, `P2-medium` | 🟢 **완료 (332/332 Pass)** |
| 16 | `AUDIO-002` | [#136](https://github.com/Choyounhwa/-dream-guardian/issues/136) | 피트니스 존 체류(Dwell) 점진적 충전음 및 자세 완성 화음 효과음(Web Audio SFX) 구현 | 청각 피드백 강화 | `feature`, `P2-medium` | 🟢 **완료 (335/335 Pass)** |
| 17 | `TUT-001` | [#137](https://github.com/Choyounhwa/-dream-guardian/issues/137) | 최초 플레이어 대상 4색 신체 커서 및 피트니스 존 매칭 인터랙티브 튜토리얼 오버레이 구현 | 온보딩 UX | `feature`, `P2-medium` | 🟢 **완료 (337/337 Pass)** |
| 18 | `DOCS-001` | [#138](https://github.com/Choyounhwa/-dream-guardian/issues/138) | GDD 기획서 및 프로젝트 공식 문서 최신화 (보라 머리/얼굴 확정, 10존 레이아웃, 국민체조 패턴 및 집합 덮기 모델 공식 반영) | 공식 기획 일치화 | `documentation`, `P2-medium` | 🟢 **완료 (337/337 Pass)** |
| 19 | `FEAT-CURSOR-003` | [#140](https://github.com/Choyounhwa/-dream-guardian/issues/140) | 전 장면(메뉴·달리기·문제·결과) 4색 스켈레톤 커서 상시 지속 가시화 및 생명주기 통일 | 전 화면 커서 생명주기 일원화 | `feature`, `P1-high` | 🟢 **완료 (321/321 Pass)** |
| 20 | `REFACTOR-001` | [#130](https://github.com/Choyounhwa/-dream-guardian/issues/130) | AnswerSelector 죽은 판정 경로(update) 정리 및 단위 테스트 정비 | RC-7 | `refactor`, `P2-medium` | 🟢 **완료 (336/336 Pass)** |
| 21 | `UI-BAR-001` | [#141](https://github.com/Choyounhwa/-dream-guardian/issues/141) | 전 화면 공통 하단 고정 바(Yellow Bar) 및 설정(Settings) 모달 신설과 레거시 상단 부유 버튼(#top_controls) 완전 삭제 | 상단 간섭 제거 / 공통 고정 바 | `feature`, `P1-high` | ⚪ **대기 (승인 대기)** |
| 22 | `UI-MENU-002` | [#142](https://github.com/Choyounhwa/-dream-guardian/issues/142) | 홈 메뉴(2-2-1) 및 서브 메뉴(2x3) 와이드 레이아웃 개편과 1:1 대형 폰트 적용 (레거시 가로 1열 및 상단 뒤로가기 삭제) | 메뉴 원거리 시인성 & 1:1 폰트 | `feature`, `P1-high` | ⚪ **대기 (승인 대기)** |
| 23 | `UI-INGAME-001` | [#143](https://github.com/Choyounhwa/-dream-guardian/issues/143) | 인게임 마젠타 문제영역 고정 컨테이너, 3중 회전 마법진(E_Pit_act1~3) 피트니스 존 및 마젠타 결과 카드 패널 개편 | 마젠타 컨테이너 & 마법진 스핀 | `feature`, `P1-high` | ⚪ **대기 (승인 대기)** |
| 24 | `BUG-SCALE-002` | [#144](https://github.com/Choyounhwa/-dream-guardian/issues/144) | 실사용 웹캠 근접 환경(귀 가림·팔꿈치 이탈) 신체 실측 크기 동적 추정 고도화 및 커서 시인성 현실화 | 귀 가림 시 눈/코 비례 산출, 팔꿈치 이탈 시 손바닥 전진, 1080p 신체 실측 스케일 현실화 | `bug`, `P1-high` | ⚪ **대기 (승인 대기)** |

**주의:** `ZONE-001`은 `UI-001`보다 반드시 앞서야 합니다(답안 밴드 좌표 의존). `REFACTOR-001`은 `input-system.test.ts` 약 7개 테스트가 `update()`에 의존하므로 단독 카드로 수행합니다(개발 규칙 3.3/18항).

### G. 핵심 설계 결정: 집합 덮기(Set Coverage) 판정

고정 페어링을 폐기하고 다음 술어로 대체합니다. 이것이 G-8(양손 동일 존)과 사용자 명세 전 케이스를 표현하는 유일한 방법입니다.

```
matched(P, Z) ⟺
  (A) ∀ p ∈ P : ∃ z ∈ Z, inside(p, z)   // 모든 요구 부위가 어떤 활성 존 안에 있다
  (B) ∀ z ∈ Z : ∃ p ∈ P, inside(p, z)   // 모든 활성 존이 최소 1개 부위로 덮인다
```

조건 (B)가 존 개수를 의미 있게 만듭니다. 복잡도는 O(|P|×|Z|), 최대 4×4.

```ts
// src/types/posture.ts (신규)
export type BodyPart = 'leftHand' | 'rightHand' | 'head' | 'hip';

export interface AnswerPosture {
  choiceIndex: 0 | 1;
  parts: BodyPart[];           // 1~3 (또는 G-2 채택 시 1~4)
  zoneIds: number[];           // 1~3 (또는 G-3 채택 시 1~4)
  binding: 'any' | 'ordered';  // 'any' = 집합 덮기(기본)
  gates?: PartGate[];          // 캘리브레이션 대비 변위 조건
  patternId: string;           // fitness pattern.csv의 ID (S001, D001, T001, Q001...)
}

export interface PostureProgress {
  choiceIndex: 0 | 1;
  progress: number;
  met: boolean;
  partStates: { part: BodyPart; zoneId: number | null }[];
  zoneCovered: Record<number, boolean>;
}
```

좌/우 자세 추출 제약:

```
C1  |union(A.zoneIds, B.zoneIds)| <= 최대 존 수
C2  A.parts \ B.parts != ∅  AND  B.parts \ A.parts != ∅   // 배타 부위 (Deadlock 방지)
C3  head와 hip이 동일 zoneId를 요구하지 않음               // CSV는 이미 0건
C4  head와 hip이 함께 요구되면 zone(head).y < zone(hip).y
C5  ∀ p, z : 부위별 허용 존 통과 (CSV 실사용 집합 기준)
C6  parts.length >= distinct(zoneIds).length
C7  최근 3문제 내 동일 patternId 제외 (쿨다운)
```

### H. 아이콘 시스템

`src/render/PartIconRenderer.ts`를 신설하고 **커서 렌더링과 답안 라벨 렌더링이 동일 함수를 공유**합니다. 같은 모양·같은 색이 두 위치에 나타나는 것이 직관성의 핵심입니다.

| 부위 | 아이콘 | 색상 | 현재 |
|---|---|---|---|
| leftHand | 손바닥 실루엣 (좌향) | 시안 `#28E6FF` | 원 + `'L'` 텍스트 |
| rightHand | 손바닥 실루엣 (우향 미러) | 노랑 `#FFCB4D` | 원 + `'R'` 텍스트 |
| head | 원형 얼굴 (눈 2점) | 보라 `#C889FF` | 타원 + `'HEAD'` 텍스트 |
| hip | 마름모 (다이아몬드) | 주황 `#FF865E` | 역삼각형 + `'HIP'` 텍스트 |

묶음 기호 (한 존 vs 각 존 구분):

| 조건 | 표기 |
|---|---|
| 부위 2~3개 / 존 1개 | 아이콘을 `( )` 괄호로 묶음 → "함께 한 존에" |
| 부위 n개 / 존 n개 | 아이콘 사이 `\|` 구분선 → "각각 다른 존에" |
| 부위 3개 / 존 2개 | `( ) \|` 혼합 → 2개 묶음 + 1개 분리 |

### I. 테스트 요구 (POSE-002 필수)

```
□ 2부위 1존: 두 부위 모두 존 내부 → met / 한 부위만 → not met
□ 2부위 2존: 정방향 met / 역방향(좌우 교환) met       ← RC-1 회귀 방지 핵심
□ 2부위 2존: 두 부위가 같은 존에 몰림 → not met       ← 조건 (B) 검증
□ 3부위 1존 / 2존 / 3존 각 met, 한 존 비었을 때 not met
□ binding:'ordered' 시 역방향 → not met
□ C2: 두 자세 동시 met 조합이 생성되지 않음 (100회 반복)
□ C3: head·hip 동일 존 조합 미생성
□ C6: parts.length < zoneIds.length 조합 미생성
□ 활성 존 3개 이상에서 존별 진행도 독립 표시           ← RC-5 회귀 방지
□ PartGate: baseline 변위 미달 시 not met
□ CSV 360건 전체가 로더를 통과하고 제약 위반 0건
```

현재 커버리지 공백: 2부위 조합 AND 판정 테스트 **0건**, 3존 렌더링 미검증(`i % 2` 버그가 테스트 통과), `avgWeight` 미검증.

---

> 최근 안정화: 메뉴 커서는 두 기존 손 표식이 가까워졌을 때 그 정확한 중점에 하나만 생성되고 메뉴 위 전면에 렌더링됩니다. 손이 멀어지면 커서가 사라집니다. 음성은 비차단이고 게임 루프는 예외 격리/다음 프레임 선예약 구조입니다. `COMPLETION.md`의 "최신 안정화 수정"을 우선합니다.

## 최신 수정: 필수 자세 판정 / iPhone 카메라

### 최신 우선 적용: 색상 신체 / 11구역 + 음성 정지 수정
- **음성 안내가 끝날 때까지 `questionSpeaking`으로 답안과 준비 타이머를 막던 원인**을 제거했습니다. 브라우저가 종료 이벤트를 보내지 않으면 최장 180초 잠기던 구조였습니다. 이제 음성은 비차단 안내이며 첫 2초 준비와 신체 정렬/유지만 적용합니다. 음성 시작이 3초 지연되면 재생 실패 안내로 바뀌며 게임은 계속됩니다.
- 최신 답안은 `answer-selection.js`의 10개 피트니스존입니다. 손=시안/노랑 원, 어깨=보라 사각형, 골반=주황 다이아몬드를 사용하며, 호환되는 활성 존에 필요한 커서를 모두 두고 1초 유지합니다.
- 답안 두 개는 같은 활성 존 집합을 공유하고, 입력 시 어떤 답 하나만 완성될 때만 충전합니다. 존별 고정 `zoneId` 배정은 사용하지 않습니다.
- PC 테스트는 `1`/`2` 또는 활성 답 구역 클릭으로 변경했습니다. 화면 반쪽 전체 클릭/방향키 답 선택은 제거했습니다.
- 상세 구역 좌표, 커서 조합, 민감도/추가 방법/검증 범위: **`ANSWER_SELECTION_DESIGN.md`**. 이후 수정은 이 문서와 `answer-selection.js` 설정 배열을 기준으로 진행합니다.
- 과거 팝업·음성 대기·깊은 런지 필수 설명보다 이 절을 우선합니다.

### 최신 우선 적용: PC 테스트·달리기 전환 복구
- 달리기 게이지 완료 판정을 `processMotion` 내부에서 공통 게임 루프의 `updateRunningProgress(dt)`로 이동했습니다. 100 도달을 자연 감소보다 먼저 확인하므로 카메라 프레임이 없거나 Space/클릭/점프로 충전해도 문제로 넘어갑니다. 동일 문제 중 중복 출제를 막습니다.
- 카메라 시작/전후면 선택/터치 연습 모드 선택 UI를 제거했습니다. 페이지 시작 시 기본 카메라를 자동 요청합니다. 카메라 권한은 브라우저에서 허용하며 실패해도 PC 입력으로 진행할 수 있습니다.
- 카메라는 원래처럼 전체 캔버스를 채우는 중앙 좌우반전 배경(cover)으로 복원했습니다. 표시 영역이 잘려도 원본 카메라 안의 관절 신뢰도를 제거하지 않습니다. 스켈레톤과 영상은 같은 변환을 사용합니다.
- 모드 선택 없이 Space(준비 통과/달리기 충전), 클릭(달리기 충전/답안 원 또는 단독 호환 존 선택), `1`/`2`(답안 선택)으로 테스트합니다. 수동 답안도 문제 읽기 잠금 중에는 확정되지 않습니다.
- `runtime.test.cjs`: 실제 키보드/포인터 리스너를 호출해 카메라 없이 달리기 완료→문제 출제, 감소 전 완료 검사, 중복 출제 방지, cover 좌표를 검증했습니다. 기존 자세 및 음성 테스트도 통과했습니다.
- 아래 모바일·모드 선택·contain 화면 설명은 이전 구현 이력입니다. 현재 동작은 이 절을 우선합니다.

### 전투 스토리 변경: 문제를 풀어 수호신에게 마나 전달
- 플레이어는 문제를 풀고 자세로 답을 선택해 수호신에게 사고의 빛(마나)을 보냅니다. 정답 1개당 25 마나, 100 마나가 되면 수호신이 자동으로 `사고의 별`을 시전합니다.
- 정답 순간에는 보스 체력을 줄이지 않습니다. 마나 전달 연출 뒤 시전 상태(`guardian_cast`)로 전환하고 마법이 적중할 때 피해 4를 한 번 적용합니다.
- 달리기·점프의 기존 게이지는 다음 문제로 이동하는 진행도이며 마나와 별개입니다. 하단에 별도 수호신 마나 게이지를 표시합니다. 오답 시 수호신 HP가 25 감소하고 이미 모은 마나는 유지합니다.
- 10문제 자동 종료를 제거하고 보스 격파로 완료합니다. 일반 보스 HP 10(마법 3회), 나이트메어 HP 20(5회). 나이트메어 격파는 엔딩으로 연결됩니다. 완료 시 다음 장을 저장하고 결과에 총 전달 마나/시전 횟수를 표시합니다. 랭크는 문항 수 대신 정답률 기준입니다.
- 스토리와 메뉴 문구도 '네가 생각하고, 수호신이 지킨다' 역할 분담으로 변경했습니다. `runtime.test.cjs`에서 정답 충전, 4정답 시전, 중복 피해 방지, 오답 마나 유지, 최종 보스 엔딩 경로를 검증합니다.

### 최신 추가 수정: 전신 프레임·손 커서·음성·스켈레톤
- 영상 확대 크롭을 제거하고 전체 카메라 영상을 화면 중하단에 비율 유지 표시합니다. 카메라 원본 밖으로 실제 몸이 나가는 경우에는 위치 조정이 필요합니다.
- 손목 뼈대와 별도로 `손`이라고 표시한 입력 원이 움직입니다. 준비 자세의 어깨·몸통 길이에 비례한 좌표 변환을 사용해 작은 팔 움직임으로 답 원까지 도달합니다. 그 원의 중심이 실제 접촉 판정 좌표이며 메뉴에도 동일한 변환을 사용합니다. 자세 조건은 여전히 필수입니다.
- 런지는 발 간격과 골반 이동 요구량을 줄이고 선택 방향 무릎 굽힘/반대 다리 펴기 조건을 유지합니다. 저속 카메라가 250ms마다 초기화되던 문제를 개선해 600ms 유실 기준을 사용하되 프레임당 유지 시간 인정량을 150ms로 제한합니다.
- 확대 읽기 팝업과 완료 버튼을 제거했습니다. `question-speech.js`의 Web Speech API로 문제 원문을 한국어로 읽습니다. `문제 다시 듣기`, `음성 켜짐/꺼짐` 버튼을 제공하며 분수 및 기본 연산 기호를 읽기용 표현으로 바꿉니다. 음성 완료·실패·취소·시간 초과를 처리하고 읽는 동안 답 선택을 잠급니다. 모바일 자동 음성이 차단되면 다시 듣기 버튼으로 시작할 수 있습니다.
- 스켈레톤 연결선과 보조선은 불투명도 10%, 원은 100%로 표시합니다. 관절 반지름 4→6px, 손목 링 18→27px(기존 진동도 1.5배). 무릎/발목 원과 코 위치 기반 머리 원/목선을 추가했습니다. 머리는 얼굴 윤곽 추정이 아니라 위치 표시입니다.
- `motion-input.test.cjs`, `runtime.test.cjs`, `question-speech.test.cjs` 통과. 전신 좌표 보존, 커서 도달, 저속 프레임, 손만 닿는 경우 차단, 음성 수명주기 등을 모형 기반 검증했습니다. 실제 iPhone 음성·카메라 운동 테스트는 별도 확인 필요.

### 긴 문제 읽기 개선
- 아래 확대 팝업 설명은 이전 구현 이력입니다. 최신 구현은 위 음성 읽기 방식이며 자동 팝업은 없습니다.
- 문제를 캔버스의 한 줄 `fillText` 대신 HTML 문제 패널로 표시합니다. 원문 전체를 `textContent`로 넣어 줄바꿈·긴 수식 강제 줄바꿈을 지원합니다.
- 글자는 32~48px 범위로 유지하고, 실제 렌더링 높이가 표시 영역보다 크면 큰 읽기 화면을 자동으로 엽니다. 그보다 긴 문제는 세로 스크롤로 끝까지 읽습니다.
- `문제 크게 읽기`로 다시 열 수 있으며 `다 읽었어요 · 답 고르기`를 눌러 복귀합니다. 읽기 화면에서는 카메라·터치·키보드 답안 확정을 모두 막고, 닫을 때 준비 자세와 유지 게이지를 초기화합니다.
- `runtime.test.cjs`에 긴 문제 원문 보존, 읽기 화면 자동 열기, 읽는 동안 선택 차단, 닫기 시 입력 초기화, 짧은 문제 및 결과 화면 전환 검사를 추가했습니다. 모형 기반 테스트 통과; 실제 모바일 스크롤/시인성은 실기기 확인 필요.

아래 과거 구현표보다 이 절의 동작과 검증 범위를 우선합니다.

- `motion-input.js`: 신뢰도 0.65 이상의 전신 관절로 필수 자세를 판정합니다. 손만 닿는 입력으로는 답을 선택하지 않습니다.
- 매 문제 2초 읽기 잠금 후, 양팔을 내리고 무릎을 편 자세를 0.6초 유지해야 준비됩니다. 준비 후 자세와 손의 답 원 접촉을 함께 0.8초 연속 유지하면 확정됩니다. 자세 이탈은 누적 시간을 초기화하고, 추적 유실·화면 크기 변경은 다시 준비 자세를 요구합니다.
- 런지: 화면상 선택 방향의 무릎 굽힘, 반대 다리 펴기, 발 간격, 골반 이동을 모두 확인합니다. 만세: 양손이 머리 위에 있고 양팔과 다리가 펴져야 합니다. 스쿼트: 양 무릎 굽힘과 골반·어깨 하강을 확인합니다. 손 터치만으로 얻던 가속 경로를 제거했습니다.
- 하단에 부족한 동작과 손 터치/유지 안내를 표시합니다. 답 원은 준비 자세의 신체 위치를 기준으로 배치합니다. 하반신이 안 보이면 전신 인식을 요청하며 상반신만으로 대신 통과시키지 않습니다.
- 운동 모드에서는 직접 화면 터치와 키보드로 답 판정을 우회할 수 없습니다. 시작 패널에서 명시적으로 선택한 **터치 연습 모드**만 수동 답안을 허용합니다.
- 답안용 스쿼트와 회피 동작이 충돌하지 않도록 문제 출제 시 보스 회피 공격을 해제합니다.
- iPhone: **신뢰할 수 있는 HTTPS 주소를 Safari에서 열고 카메라 시작 버튼을 누른 뒤 권한 허용**이 필요합니다. 같은 Wi-Fi의 `http://192.168…:8080`은 페이지 열기만 가능하며 카메라 접속용 주소가 아닙니다. 이 수정은 HTTPS 서버/터널을 개설하지 않습니다.
- video에 `muted`, `playsinline`, `webkit-playsinline`을 적용하고 `display:none`을 제거했습니다. 권한 거부, 비보안 접속, 모델 로딩 실패를 별도로 표시합니다. 실패 시 카메라 연결 성공으로 처리하지 않습니다.
- 검증: `node dream_guardian/motion-input.test.cjs`, `node dream_guardian/runtime.test.cjs`. 합성 관절 기반 자세/터치/타이밍 회귀 테스트와 브라우저 API 모형 기반 시작/입력 경로 검사를 통과했습니다. 실제 iPhone 카메라와 1~2m 거리 정확도는 아직 실기기 검증 전입니다. 기존 문서의 '100% 일치', '30+ FPS 보장', '완벽한 오류 방지' 표현은 실측 결과가 아닙니다.

---

## 📌 1. 프로젝트 기본 정보 및 기획 배경

1. **프로젝트 목적**:
   - 닌텐도 '링핏 어드벤처' 스타일로 제자리 달리기, 팔 뻗기, 앉기, 점프 등 전신 운동을 하며 수학 문제를 해결하는 모바일 웹캠 기반 체감형 기능성 게임.
2. **원작 스토리**:
   - `E:\AIAIAIAIAI\Arithmetic Game\GU's mong story.txt` 바탕의 **《꿈의 수호신》** ("생각하는 힘이, 나를 지킨다").
   - 아이의 생각하는 힘(사고의 빛)으로 성장하는 꼬마 수호신 vs 몽계(꿈의 세계)를 위협하는 4종 괴물과 최종 보스 '나이트메어'.
3. **그래픽/톤앤매너**:
   - 기존의 중세 골드/화염 연금술 테마에서 **신비로운 아이스블루, 라벤더, 딥네이비, 별빛 실버** 테마로 전면 개편.
   - 주인공: 아이스블루 꼬마 수호신 (`img/guardian.png` 크로마키 투명화 적용).
4. **수학 문제 범위**:
   - 기존 `questions.csv`의 9단계 중 **Level 1 ~ Level 4**만 필터링하여 출제 (기존 CSV 원본 100% 보존).
     - 1장: 덧뺄셈 (숫자의 숲 / 보스: 포겟)
     - 2장: 곱나눗셈 (곱셈의 성 / 보스: 후다닥)
     - 3장: 분수 (나눗셈의 미궁 / 보스: 뒤죽박죽)
     - 4장: 소수 (소수의 사막 / 보스: 에라)
     - 5장(히든/최종): 종합 혼합 연산 (악몽의 심연 / 보스: 나이트메어)

---

## 📁 2. 파일 및 디렉토리 구조

```
E:\AIAIAIAIAI\Arithmetic Game\
├── index.html                   # [원본 보존] 기존 마법 연금술 아카데미 게임
├── questions.csv                 # [원본 보존] 전체 수학 문제 원본 DB (685문항)
├── questions_cleaned.csv         # [원본 보존] 클린 버전 문제 DB
├── img/                          # [원본 보존] 기존 게임 이미지 에셋
├── GU's mong story.txt           # [원본] 게임 스토리 원작 텍스트
│
└── dream_guardian/               # 🆕 신규 분리 프로젝트 (꿈의 수호신)
    ├── index.html                # 단일 파일 구동 엔진 (약 1,180줄, CSS+JS+렌더러 일체형)
    ├── HANDOVER.md               # 📌 본 인수인계 문서
    └── img/
        └── guardian.png          # 수호신 캐릭터 일러스트 (투명 크로마키 처리 완료)
```

> **기획 및 작업 문서 위치 (프로젝트 내부)**:
> - 기획서(Implementation Plan): `dream_guardian/IMPLEMENTATION_PLAN.md`
> - 세부 WBS 작업목차: `dream_guardian/TASKS.md`
> - 개발 워크스루: `dream_guardian/DEVELOPMENT_WALKTHROUGH.md`

---

## ✅ 3. 현재까지 구현 완료된 기능 (Current Status)

| 분류 | 세부 구현 내용 | 상태 |
|---|---|:---:|
| **오입력 방지 딜레이** | 달리기 직후 문제가 나오자마자 팔 스윙으로 오답이 찍히던 문제 해결 (1.3초 문제 읽기 프리즈 + 효과음 + 준비 카운트다운) | 완료 |
| **원거리 특대형 수식** | 1~2m 거리 모바일 환경 대응 54px 특대형 네온 수식 카드 + 48px 볼드 정답 넘버링 (원거리 시인성 극대화) | 완료 |
| **스트리트파이터 대전 HUD** | 상단 통합 대전 바: 좌측 플레이어 HP(에메랄드) vs 우측 보스 HP(크림슨/골드) + 중앙 VS 엠블럼, 타이머, 콤보 | 완료 |
| **인체공학적 조작계** | 서서 플레이 시 팔을 자연스럽게 뻗으면 닿는 편안한 중하단 높이(y=0.65~0.76)로 답안 오브 및 피트니스 HUD 재배치 | 완료 |
| **운동 픽토그램 가이드** | 런지(◀/▶), 만세(▲), 스쿼트(▼) 동작을 직관적으로 보여주는 실시간 애니메이션 스틱맨 실루엣 + 자세 일치 시 녹색 점등 | 완료 |
| **스켈레톤 보정 (버그 픽스)** | 카메라 비율(4:3, 16:9)과 캔버스(9:18) 간 크롭 오프셋 완벽 일치 보정 (`landmarkToScreen`) + 모바일 BlazePose Lite (30+ FPS) | 완료 |
| **시작 화면 스켈레톤** | 첫 시작 메뉴 화면(`menu_main`, `menu_sub`)부터 플레이어 뼈대 라인과 마법 손목 링 즉시 표시 | 완료 |
| **체감형 모션 메뉴 선택** | 화면을 터치하지 않아도 카메라 앞에서 손을 올려 원하는 챕터 버튼을 0.8초 가리키면(Hover Dwell) 자동 선택 및 실행 | 완료 |
| **모바일 터치 보정** | 고해상도(DPR) 및 모바일 뷰포트 크기 변화에 대응하는 캔버스 좌표 정밀 스케일링 + CSS `touch-action: none` 적용 | 완료 |
| **안정적 웹캠 스트리밍** | `OverconstrainedError`를 원천 방지하는 네이티브 `getUserMedia` 유연 제약 조건 + 1.5초 로딩 안전 타이머 | 완료 |
| **전신 체감형 정답 터치** | **모드 1 (좌우 사이드 런지 & 펀치)**: 체중 이동 런지 + 손 터치 시 2배 가속 인식<br>**모드 2 (상하 만세 vs 스쿼트)**: 상단 양손 오버헤드 만세 리치 vs 하단 딥 스쿼트 다운 터치 | 완료 |
| **풀바디 파워 연출** | 전신 운동 자세 일치 시 무지개 별빛 오라 (`✨ FULL BODY x2!`) 전개 + 보너스 점수(+100) 부여 | 완료 |
| **모바일 최적화** | 전면/후면 카메라 전환 토글(📷), 모바일 주소창 숨김 전체화면(⛶), 세로 9:18 반응형 | 완료 |
| **자세 캘리브레이션** | 모바일 거치 환경 맞춤 가이드 프레임 (얼굴·어깨 자동 중앙 정렬 감지 및 시작) | 완료 |
| **제자리 달리기** | 어깨 상하 바운스 기반 실시간 스텝(걸음 수) 카운터 + 펄스 사운드 + 마나 충전 | 완료 |
| **스쿼트(앉기) 회피** | 보스의 기습 암흑 참격 경보 시 스쿼트 동작 감지 -> 이지스 수호 결계 돔 전개 및 회피(+150점) | 완료 |
| **점프(도약) 파워업** | 순간 도약(Jump) 감지 -> 상승 바람 효과음 + 마나 즉시 충전(+25%) 및 점수 보너스 | 완료 |
| **러닝 트랙 & 정령** | 달리기 구간 3D 궤적 위 사고의 별 크리스탈 수집 + 수호신 호위 빛의 정령 2마리 비행 | 완료 |
| **오디오 엔진** | Web Audio API 기반 11종 효과음(스쿼트 방어, 점프, 발걸음, 경보 등) + Am 펜타토닉 BGM | 완료 |
| **최종전 & 엔딩 컷씬** | 5장 나이트메어 격파 시 4단계 감동 엔딩 스크롤 ("실패는 너의 힘이 아니야...") + 6익 각성 수호신 | 완료 |
| **피트니스 통계 & 명예의 전당** | 소모 칼로리(kcal), 달린 걸음, 스쿼트 횟수, 3-Star 별점, 누적 운동 통계 및 기록 모달 저장 | 완료 |

---

## 🚀 4. 테스트 및 실행 방법

### 권장: Vite 로컬 개발 서버 (HMR 핫 리로딩 지원)
```powershell
cd "E:\AIAIAIAIAI\Arithmetic Game\dream_guardian"
npm run dev
```
브라우저에서 `http://localhost:3000/` 접속

### 프로덕션 빌드 & 테스트
```powershell
cd "E:\AIAIAIAIAI\Arithmetic Game\dream_guardian"
npm run build
npm test
```

> ⚠️ **스마트폰(모바일 브라우저) 카메라 연결 팁**:
> 1. 브라우저의 웹캠 보안 정책(HTTPS 필수)으로 인해, PC와 스마트폰이 같은 Wi-Fi에 있을 때 PC IP로 접속하면 브라우저가 카메라를 차단할 수 있습니다.
> 2. **해결책 (선택 1 - 가장 간단)**: PC에서 `npx ngrok http 8080` 실행 후 스마트폰에서 제공된 `https://xxx.ngrok-free.app/dream_guardian/` 접속.
> 3. **해결책 (선택 2 - Chrome 설정)**: 모바일 Chrome에서 `chrome://flags/#unsafely-treat-insecure-origin-as-secure` 접속 후 `http://PC아이피:8080` 등록.

### 테스트 조작키 (PC 환경 디버깅용):
- **Space**: 자세 정렬 즉시 통과, 달리기 마나 충전 (+15%, 걸음 수 증가), 스토리/엔딩 스킵
- **← (왼쪽 화살표)**: 왼쪽 답안 선택
- **→ (오른쪽 화살표)**: 오른쪽 답안 선택
- **↓ (아래쪽 화살표)**: 스쿼트 방어 테스트 (이지스 결계 발동)
- **↑ (위쪽 화살표)**: 점프 도약 테스트 (마나 +25%)
- **화면 클릭/터치**: 모서리/버튼 선택 및 화면 좌/우 터치로 답안 선택
- **우측 상단 버튼**: 📷 카메라 전면/후면 전환, ⛶ 전체화면 전환
- **메인 메뉴 하단**: [ 🏆 운동 기록 & 명예의 전당 ] 모달 열기

---

## 📋 5. 다음에 이어서 진행할 작업 목록 (Next Steps)

다음에 작업을 재개할 때 등록된 신규 이슈 카드를 다음 권장 순서대로 TDD 사이클(Red → Green → Refactor)에 맞춰 구현하시면 됩니다:

1. **[UI-MENU-004] 홈/서브 메뉴 중앙 개방형 레이아웃 재배치 및 박스·수학유형(3배) 규격 통일 ([#161](https://github.com/Choyounhwa/-dream-guardian/issues/161))**:
   - 홈/서브 메뉴 카드 좌우 외곽 재배치(중앙 뷰포트 확보) 및 박스 크기(288x304) 통일
   - 수학 유형 텍스트 3배(78px) 확대 및 `Ch.1~5` 텍스트 제거
2. **[UI-BAR-002] 하단 고정바(BottomBar) 내 운동 모드 선택 버튼 신설 ([#166](https://github.com/Choyounhwa/-dream-guardian/issues/166))**:
   - 하단 고정바 좌측 슬롯(x: 190, y: 1990)에 운동 모드 버튼 신설 및 메인 제목 하단 레거시 제거
3. **[UI-BAR-003] 설정 및 정지 버튼 문자 제거 및 아이콘화 ([#162](https://github.com/Choyounhwa/-dream-guardian/issues/162))**:
   - 좌측 톱니바퀴 아이콘화, 우측 인게임 일시정지(⏸) 아이콘화
4. **달리기 동적 보정 (보류 현안)**:
   - 제자리 달리기 중 전후좌우 신체 드리프트 보정(`TorsoCentroidTracker` 등)은 추후 정밀 검증 후 재개.

---
*최종 갱신일시: 2026-09-25*
