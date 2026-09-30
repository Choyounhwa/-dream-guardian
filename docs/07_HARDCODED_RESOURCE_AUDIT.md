# 📊 Dream Guardian — 프로젝트 리소스 및 데이터 하드코딩 전수 감사 보고서 (07_HARDCODED_RESOURCE_AUDIT.md)

**문서 번호:** AUDIT-RES-20260930  
**작성 일자:** 2026-09-30  
**감사 대상:** `dream_guardian` 클라이언트 전체 소스코드 (`src/`, `config/`), 퍼블릭 데이터 (`public/`), 정적 에셋 (`img/`, `참고이미지/`)  
**준거 기준:** `docs/Dream_Guardian_개발_규칙.md` (제3조 단일 책임, 제4조 아키텍처, 제6조 데이터와 코드 분리, 제12조 UI 로직 분리)

---

## 1. 개요 및 목적 (Executive Summary)

본 문서는 《꿈의 수호신 (Dream Guardian)》 프로젝트의 **상업용 게임 아키텍처 표준** 및 **개발 규칙 제6절(데이터와 코드의 분리)** 준수 현황을 점검하고, 코드베이스 내부에 직접 하드코딩된 UI 텍스트, 게임 밸런스/연출 파라미터, 오디오 합성 수치, 중복 메타데이터, 미참조(Dead) 정적 에셋을 전수 발굴하여 체계적인 리팩터링 및 인수인계(Handover) 가이드를 제공하기 위해 작성되었습니다.

---

## 2. 전수 점검 요약표 (Audit Matrix)

| 구분 | 감사 영역 | 주요 파일 위치 | 심각도 | 핵심 이슈 |
|:---:|:---|:---|:---:|:---|
| **영역 1** | **UI 텍스트 및 i18n** | `src/ui/*.ts`, `src/render/BossRenderer.ts` | **높음 (High)** | 다국어/텍스트 테이블 없이 Canvas 드로잉 코드 내 한국어 문자열 하드코딩 |
| **영역 2** | **보스/챕터 메타데이터** | `src/data/bossData.ts` ↔ `src/ui/MenuRenderer.ts` | **중간 (Medium)** | 챕터 정보 이중 관리(SSOT 위배) 및 렌더러 내 레거시 보스명/대사 잔존 |
| **영역 3** | **정적 이미지 에셋** | `dream_guardian/img/`, `src/main.ts` | **중간 (Medium)** | `main.ts` 내 인라인 경로 하드코딩, 11종의 stardust 에셋 미참조 및 방치 |
| **영역 4** | **오디오/악기 합성 데이터** | `src/audio/BandSynthesizer.ts`, `SFXSynth.ts` | **중간 (Medium)** | 기타 주파수, 디스토션, 화음, 감쇠 계수가 클래스 코드 내 고정 수치로 존재 |
| **영역 5** | **안무/패턴 데이터 이원화** | `src/data/danceRoutineData.ts` ↔ `public/*.csv` | **중간 (Medium)** | 원본 CSV 외에 764줄 분량의 기본/확장 안무 데이터가 TS 객체로 하드코딩 |
| **영역 6** | **수학 문제 Fallback** | `src/question/QuestionBank.ts` | **낮음 (Low)** | CSV 로드 실패 대비용 안전 문제가 클래스 내부 배열 상수로 고정 |
| **영역 7** | **비주얼 연출 파라미터** | `src/render/MagicCircleRenderer.ts`, `HUDLayer.ts` | **낮음 (Low)** | 마법진 회전/스케일 수치, HUD 바 규격 등이 `config/` 외부에 위치 |

---

## 3. 영역별 세부 감사 결과 (Detailed Findings)

### 3.1. [영역 1] UI 텍스트 및 다국어(i18n) 레이어 부재 (High)

프로젝트 내 모든 화면(메뉴, HUD, 모달, 튜토리얼, 결과, 피드백)의 사용자 대면 문자열이 Canvas 2D `ctx.fillText()` 호출부에 하드코딩되어 있습니다.

1. **메뉴 및 챕터 선택 (`src/ui/MenuRenderer.ts`)**:
   - Line 161: `'꿈속 세계 탐험'`
   - Line 167: `'깨비와 함께 신비로운 꿈의 성역으로 다이빙!'`
   - Line 227: `'미개방 성역'`
   - Line 270~271: `'전체 종합 (ALL)'`, `'전체 혼합 풀'`
   - Line 305: `'챕터 선택'`
2. **모달 및 팝업 (`src/ui/PauseModal.ts`, `LocomotionModal.ts`, `SettingsModal.ts`)**:
   - `PauseModal.ts` Line 219~284: `'⏸ 일시정지 (PAUSED)'`, `'양손을 모아 합장 커서로 선택하세요'`, `'X자 제스처로 다시 열고 닫을 수 있습니다'`, `'▶  게임으로 돌아가기'`, `'🏠  홈으로 나가기'`
   - `LocomotionModal.ts` Line 36~71: 4종 운동 모드 메타데이터(`'제자리 달리기'`, `'골반 바운스'`, `'골반 스웨이'`, `'양손 교차'`, `'소음: 보통 🔊'`, `'무릎 탄성으로 골반 상하 바운스'` 등 설명 전체)
   - `SettingsModal.ts` Line 27: `'제자리 달리기'` 등 기본 라벨 하드코딩
3. **인게임 상단 HUD 및 제스처 피드백 (`src/ui/HUDLayer.ts`, `GestureFeedbackOverlay.ts`, `BottomBar.ts`)**:
   - `GestureFeedbackOverlay.ts` Line 53~54: `'✕ 홈으로 나가기...'`, `'⏸ 일시정지...'`
   - `BottomBar.ts` Line 118, 183: `'⚙ 설정'`, `'마나 100%'`
   - `HUDLayer.ts` Line 82, 106, 118: `'HP'`, `'COMBO x'`
4. **튜토리얼 및 결과 화면 (`src/ui/TutorialOverlay.ts`, `ResultRenderer.ts`)**:
   - `TutorialOverlay.ts` Line 100~198: `'카메라가 당신의 몸을 인식해 4색 커서를 비춥니다'`, `'왼손 (시안)'`, `'머리 (보라)'`, `'골반 (주황)'`, `'오른손 (노랑)'`, `'목표 구역 (존)'`, `'게임 시작! (TAP)'`
   - `ResultRenderer.ts` Line 148, 213: `'승리!'`, `'패배...'`, `'양손을 모으거나 하단 [메뉴로] 버튼을 클릭하세요'`
5. **보스 렌더러 내부 대사 (`src/render/BossRenderer.ts`)**:
   - Line 373: Ch.4 보스 렌더링 중 부유하는 텍스트 `ctx.fillText('포기해...', 0, whisperY)` 직접 하드코딩.

---

### 3.2. [영역 2] 보스 및 챕터 메타데이터 중복 및 불일치 (Medium)

단일 진실 원천(Single Source of Truth, SSOT) 원칙이 위배되어, 기획 변경 시 여러 파일을 동시에 수정해야 하는 결함 구조가 존재합니다.

1. **`bossData.ts` ↔ `MenuRenderer.ts` 간 중복**:
   - `src/data/bossData.ts`의 `BOSS_REGISTRY`: Ch.1~5의 `id`, `name`, `title`, `mathDomain`, `themeColor` 정의.
   - `src/ui/MenuRenderer.ts`의 `CHAPTER_INFO`: 동일한 Ch.1~5의 `name`(에메랄드 심해 등), `fullName`, `sub`(수학 영역), `boss`(보스명), `color`를 별도 배열로 중복 선언.
   - 두 소스가 분리되어 있어 한쪽의 보스명이나 색상이 변경되어도 다른 쪽에 자동 반영되지 않음.
2. **`BossRenderer.ts`의 레거시 명칭 잔존**:
   - `src/render/BossRenderer.ts` 내부 메서드(`_renderForget`, `_renderHurry`, `_renderJumble`, `_renderGiveup`, `_renderNightmare`)가 신규 5대 보스명('하얘시니', '재촉새', '따돌시니', '풀죽새', '캄캄대왕') 대신 과거 기획 명칭으로 분기 처리됨.

---

### 3.3. [영역 3] 정적 이미지 에셋 경로 및 미참조(Dead) 에셋 (Medium)

1. **인라인 경로 하드코딩 (`src/main.ts`)**:
   - Line 1660: `const magicCirclePaths = ['img/E_Pit_act1.png', 'img/E_Pit_act2.png', 'img/E_Pit_act3.png'];`
   - 에셋 매니페스트 모듈 없이 엔트리포인트 부트스트랩 함수 내 배열 리터럴로 직접 경로 바인딩.
2. **에셋 미참조 및 코드 중복 구현 (Dead Assets)**:
   - `dream_guardian/img/stardust/` 디렉터리에 11종의 고해상도 별가루 PNG 및 SVG 에셋(`stardust_icon_gold.svg`, `stardust_burst.png` 등)이 배치되어 있으나, 소스코드 전체에서 전혀 사용되지 않음.
   - 실제 게임 화면에서는 `src/render/StardustIconRenderer.ts`를 통해 Canvas 2D 삼각함수 벡터 패스로 별가루를 실시간 프로시저럴 연산하여 그림.
   - `dream_guardian/img/guardian.png`, `dream_guardian/img/protagonist.png`, `Ref_Grid2.jpg` 등 미사용 파일들이 빌드 번들 경로에 방치됨.

---

### 3.4. [영역 4] 오디오 및 악기 주파수/합성 파라미터 (Medium)

외부 사운드 리소스(WAV/MP3) 없이 순수 Web Audio API 합성을 채택한 것은 경량화 관점에서 우수하나, 음향 데이터가 설정 파일(`config/`)이 아닌 엔진 클래스 내부에 강결합되어 있습니다.

1. **악기 음계 및 튜닝 수치 (`src/audio/BandSynthesizer.ts`)**:
   - Line 18~27: `GUITAR_ZONE_FREQUENCIES`에 존별 기타 주파수(164.81Hz, 196.00Hz, 220.00Hz, 261.63Hz, 293.66Hz)가 하드코딩.
   - Line 29~39: 디스토션 웨이브셰이퍼 커브 파라미터(`amount: 28`, `Math.PI / 180`) 고정.
   - `bossData.ts`에 기획된 Ch.2(신스 리드, 808 비트), Ch.3(피아노, 팀파니), Ch.4(슬랩 베이스), Ch.5(오르간)용 음향 파라미터 정의 부재.
2. **SFX 타이밍 및 주파수 (`src/audio/SFXSynth.ts`)**:
   - 체류 충전음(220Hz → 880Hz), 자세 완성 3화음(C5: 523.25Hz, E5: 659.25Hz, G5: 783.99Hz), 지수적 감쇠 릴리즈 시간 상수(`exponentialRampToValueAtTime`)가 메서드 내 상수로 하드코딩.

---

### 3.5. [영역 5] 안무 및 피트니스 패턴 데이터 이원화 (Medium)

1. **하드코딩된 안무 루틴 (`src/data/danceRoutineData.ts`)**:
   - 원본 데이터인 `public/fitness pattern.csv`(360건 패턴)가 존재하고 `FitnessPatternLoader`가 구현되어 있음에도 불구하고,
   - `danceRoutineData.ts` 내에 764줄에 달하는 4대 기본 안무(`DEFAULT_CAT_CHOREO_PATTERNS`) 및 12대 확장 안무(`EXTENDED_CAT_CHOREO_PATTERNS`)가 TypeScript 객체 리터럴로 직접 하드코딩됨.
   - 기획자가 안무 노트를 수정하거나 신규 동작을 추가하려면 TS 소스코드를 수정하여 재빌드해야 하는 한계 발생.

---

### 3.6. [영역 6] 수학 문제 시스템 Fallback 데이터 (Low)

1. **안전 문제 하드코딩 (`src/question/QuestionBank.ts`)**:
   - Line 14~31: `FALLBACK_QUESTIONS` 2문항(한자리 덧셈, 뺄셈)이 TS 내부 상수로 정의됨.
   - CSV 로드 실패 시 무한 루프를 방지하기 위한 안전장치이나, 데이터 레이어로 분리 관리하는 것이 바람직함.

---

### 3.7. [영역 7] 렌더링/비주얼 연출 파라미터 미분리 (Low)

1. **마법진 이펙트 설정 (`src/render/MagicCircleRenderer.ts`)**:
   - Line 44~67: `MAGIC_CIRCLE_CONFIG` (레이어별 회전 속도 0.3/0.5/0.2 rad/s, 회전 방향, 스케일 펄스 0.96~1.04)가 `config/` 디렉터리가 아닌 렌더러 소스 파일 내부에 위치함.
2. **HUD 수치 및 규격 (`src/ui/HUDLayer.ts`)**:
   - HP바 너비(320px), 높이(32px), 상단 패딩(20px), 그라디언트 색상 코드(`#28E6FF`, `#4DFFAA`, `#FF4444`, `#FF8844`), 폰트 규격 등이 메서드 내 지역 변수로 분산됨.

---

## 4. 리스크 및 영향도 평가

1. **글로벌 확장 및 다국어 지원 불가능**:
   - 텍스트가 렌더링 코드에 박혀 있어 영어/일본어 등 다국어 번역(i18n) 적용 시 전체 UI 렌더러 소스코드를 전면 재작성해야 함.
2. **콘텐츠 업데이트 시 개발자 병목 발생**:
   - 보스 정보, 대사, 안무 동작 추가/수정 시 기획 데이터(JSON/CSV) 수정만으로 불가능하며, 빌드/배포 프로세스가 강제됨.
3. **불필요한 빌드 번들 크기 낭비**:
   - 사용하지 않는 11종의 `stardust` 이미지 에셋 및 레퍼런스 이미지들이 번들링되거나 배포 패키지에 포함되어 네트워크 로딩 낭비 유발.
4. **SSOT 위배로 인한 동기화 버그 위험**:
   - 챕터 정보나 보스명이 바뀔 때 `bossData.ts`와 `MenuRenderer.ts` 중 한 곳만 누락될 경우 화면별로 다른 정보가 노출되는 정합성 결함 발생.

---

## 5. 단계별 리팩터링 로드맵 및 제안 작업 카드 (Action Plan)

개발 규칙 제1조(작은 단위 개발) 및 TDD 사이클에 의거하여, 아래와 같이 5개의 독립된 작업 카드로 분리하여 단계별 진행을 권장합니다.

```text
[Phase 1: 텍스트 및 UI 분리]
  CARD-DATA-001: UI 텍스트 딕셔너리(i18n) 분리 (ui-text.config.ts)
      ↓
[Phase 2: 메타데이터 단일화]
  CARD-DATA-002: 챕터/보스 메타데이터 SSOT 통합 (MenuRenderer → bossData 일원화)
      ↓
[Phase 3: 에셋 매니페스트 구축]
  CARD-RES-001: AssetManifest 구축 및 미참조(Dead) 에셋 정리
      ↓
[Phase 4: 사운드 파라미터 분리]
  CARD-AUDIO-001: 악기 주파수 및 SFX 합성 파라미터 분리 (audio.config.ts)
      ↓
[Phase 5: 안무 루틴 외부 데이터화]
  CARD-DANCE-001: 안무 프리셋의 외부 JSON/CSV 동적 로더 전환
```

### 상세 제안 카드 규격

#### [CARD-DATA-001] UI 텍스트 딕셔너리 분리 (`ui-text.config.ts`)
* **목적**: 렌더러 내 모든 한글 텍스트를 외부 설정/문자열 딕셔너리로 추출하여 i18n 기반 마련.
* **수정 대상**: `src/config/ui-text.config.ts` 신설, `MenuRenderer.ts`, `HUDLayer.ts`, `PauseModal.ts`, `LocomotionModal.ts`, `TutorialOverlay.ts`, `ResultRenderer.ts`.
* **완료 조건**: 모든 UI 렌더러에서 하드코딩된 한글 리터럴 제거, 기존 화면 표시 100% 동일 유지.

#### [CARD-DATA-002] 챕터 및 보스 메타데이터 SSOT 일원화
* **목적**: `MenuRenderer.CHAPTER_INFO`를 `bossData.ts`의 `BOSS_REGISTRY`와 통합하여 단일 진실 소스 확립.
* **수정 대상**: `src/data/bossData.ts`, `src/ui/MenuRenderer.ts`, `src/render/BossRenderer.ts`.
* **완료 조건**: 챕터 정보 단일 레퍼런스 참조, `BossRenderer`의 보스명 및 대사 텍스트(`'포기해...'`)를 메타데이터에서 참조.

#### [CARD-RES-001] 에셋 매니페스트 구축 및 데드 에셋 정리
* **목적**: `src/main.ts`의 이미지 경로 하드코딩 제거 및 미사용 에셋 정리.
* **수정 대상**: `src/core/AssetManifest.ts` 신설, `src/main.ts`, `dream_guardian/img/` 디렉터리.
* **완료 조건**: 이미지 로드 경로 일원화, 미사용 stardust 이미지 연동 또는 패키지 정리.

#### [CARD-AUDIO-001] 오디오 합성 파라미터 분리 (`config/audio.config.ts`)
* **목적**: 기타/드럼 주파수 및 효과음 합성 계수를 설정 파일로 분리.
* **수정 대상**: `config/audio.config.ts` 신설, `src/audio/BandSynthesizer.ts`, `src/audio/SFXSynth.ts`.
* **완료 조건**: 주파수 테이블 및 합성 수치 외부화, Ch.2~5 악기 확장 토대 마련.

---

## 6. 결론

현재 《꿈의 수호신》 프로젝트는 수학 문제(`questions.csv`)와 피트니스 모션 패턴(`fitness pattern.csv`)을 외부 CSV로 관리하고, 물리/존 판정 임계치를 `config/`로 분리하는 등 핵심 로직에서 훌륭한 데이터 분리 구조를 갖추고 있습니다.

그러나 **UI 텍스트, 보스 메타데이터 연동, Web Audio 음향 수치, 안무 프리셋** 영역에서는 여전히 코드 내 하드코딩이 잔존하고 있습니다. 본 보고서의 제안 카드를 바탕으로 순차적 리팩터링을 진행하면, 향후 다국어 버전 출시, 신규 챕터 확장, 기획 데이터 밸런싱 작업의 생산성과 안정성을 대폭 향상시킬 수 있습니다.
