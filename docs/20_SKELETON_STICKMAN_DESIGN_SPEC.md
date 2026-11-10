# Dream Guardian — 스켈레톤 및 졸라맨(Mecha Stickman) 시스템 설계서

**문서 번호**: DG-DOC-020  
**최초 작성일**: 2026-11-01  
**관련 이슈**: #199, #203, #280, #304, #615, #678, #682, #683, #684, #685, #686, #687, #688, #721, #725, #726  
**상태**: 정식 명세 (Active Specification)

---

## 1. 개요 및 기획 배경 (Overview & Concept)

### 1.1 기획 의도
- **피트니스 몰입감 극대화**: 웹캠 기반 게임 플레이 시 사용자가 자신의 신체 움직임을 직관적으로 인지하고 일체감을 느낄 수 있는 시각적 미러 아바타가 필수적입니다.
- **초기 와이어프레임 한계 극복**: 초기 프로토타입의 앙상한 선과 점(Line & Dot) 스켈레톤은 공학적 디버깅에는 유용했으나, 아동·청소년 플레이어에게 감성적 몰입감과 게임 캐릭터로서의 매력을 제공하지 못했습니다.
- **화이트 클레이 메카 졸라맨(White Clay Mecha Stickman) 탄생**:
  - 부드러운 점토(Clay) 질감의 도톰한 네온 캡슐 관절을 채택하여 친근하면서도 세련된 사이버네틱 아바타 구축
  - 4색 신체 커서(왼손 시안, 오른손 노랑, 머리/바이저 보라, 골반 주황)와 100% 동일한 색상 체계를 관절 구체에 동기화
  - 가슴 마력 코어(호흡 펄스), 네온 바이저 헬멧, 발밑 드림 접지 링(마법진)과 체공 디커플링 그림자를 결합하여 판타지 RPG 수호자 컨셉을 완성

---

## 2. 아키텍처 및 책임 분리 (Architecture)

시스템은 UI 렌더링, 수식 계산, 관절 스킨 데이터가 엄격하게 분리된 계층형 구조를 따릅니다.

```text
[MediaPipe Pose Landmarker]
            │
            ▼ (가상 해상도 1920x1080 좌표)
[PoseManager / SkeletonAnimation]
            │
            ▼ (스무딩 랜드마크 배열)
[PoseAngleSolver]  ◀── 순수 각도 추출 / 가상 높이 정규화 / 점프·스쿼트 변위 산출
            │
            ▼ (순수 데이터: PoseFrame)
     ┌──────┴──────────────────────────┐
     ▼                                 ▼
[StickmanRenderer]             [CharacterAvatarRenderer]
 - 고정 비례 순운동학(FK)       - CharacterRig 데이터 주도 FK
 - 2D 점토 캡슐 캔버스 렌더      - RigSolver 관절 한계 클램프
 - 발밑 접지 링 & 디커플링 그림자 - SkinPartLoader 2D 스프라이트 스킨
```

### 2.1 주요 모듈 구성
1. **`PoseAngleSolver` (`src/skeleton/pose/PoseAngleSolver.ts`)**:
   - 랜드마크 33개로부터 인체 부위별 2D 회전 각도(라디안) 추출
   - 화면 미러링(Mirror Mode) 좌표계 반전 및 지수 이동 평균(EMA) 각도 댐핑
   - 발목/무릎 화각 이탈(Framing Cutoff) 시 지능형 추종 폴백 계산
   - DOM 및 Canvas 의존성이 전혀 없는 순수 수학 엔진
2. **`StickmanRenderer` (`src/skeleton/StickmanRenderer.ts`)**:
   - `PoseFrame`을 입력받아 고정 비례 순운동학(Fixed-Length FK)으로 관절 픽셀 좌표 도출
   - 화면 중앙 2/3 높이(`anchorYRatio: 0.72`) 지면 앵커 배치
   - 대퇴/하퇴, 상완/전완 점토 캡슐, 4색 관절 볼, 발광 바이저, 가슴 코어 렌더링
3. **`BoneRenderer` / `JointRenderer` (`src/skeleton/`)**:
   - 설정 모달에서 '스켈레톤 가이드' 켜기 시 오버레이되는 디버깅용 골격선 렌더러
4. **`CharacterRig` & `RigSolver` (`src/skeleton/rig/`)**:
   - 추후 해금되는 수호신 및 다양한 캐릭터 스킨을 지원하는 데이터 주도형 본(Bone) 트리 FK 엔진

---

## 3. 디자인 규격 및 설정값 (STICKMAN_CONFIG)

모든 설정값은 단일 진실 공급원(SSOT)인 `dream_guardian/config/skeleton.config.ts`에서 관리됩니다.

### 3.1 화면 배치 및 감도 파라미터
| 항목 | 기본값 | 단위 / 설명 |
|---|---|---|
| `anchorXRatio` | `0.50` | 화면 가로 기준 중앙 배치 (0.0: 좌측, 1.0: 우측) |
| `anchorYRatio` | `0.72` | 화면 세로 기준 72% 높이에 골반 중심 앵커 배치 (안정된 접지감) |
| `scale` | `1.50` | 기본 렌더링 스케일 (설정 UI에서 0.5 ~ 2.0 조절 가능) |
| `angleSmoothing` | `0.35` | 관절 회전 지수 스무딩 계수 (떨림 방지 및 반응 속도 균형) |
| `squatSensitivity` | `350` | 골반 수직 변위의 스쿼트 픽셀 오프셋 변환 감도 |
| `jumpSensitivity` | `350` | 골반 수직 상승 변위의 점프 픽셀 오프셋 변환 감도 |
| `horizontalSmoothing` | `0.20` | 카메라 좌우 이동 시 아바타 위치 추종 스무딩 |
| `horizontalClampMin` | `0.18` | 화면 좌측 이탈 방지 한계선 (18%) |
| `horizontalClampMax` | `0.82` | 화면 우측 이탈 방지 한계선 (82%) |

### 3.2 고정 비례 신체 치수 (Limb Lengths - 기준 크기)
카메라와의 거리에 따라 관절 길이가 늘어나거나 줄어들지 않도록 고정 비례 FK를 사용합니다.
- **몸통(척추)**: `155px` (골반 중심 $\rightarrow$ 목 밑)
- **어깨 폭**: `105px` (좌우 어깨 간격)
- **골반 폭**: `75px` (좌우 대퇴골 결합부 간격)
- **상완 (위팔)**: `100px`
- **전완 (아래팔)**: `90px`
- **대퇴 (허벅지)**: `120px`
- **하퇴 (종아리)**: `120px`
- **머리 반지름**: `34px`
- **목 길이**: `22px`

### 3.3 캡슐 두께 및 관절 볼 치수 (Capsule Widths)
- **몸통 캡슐 두께**: `42px`
- **사지(팔·다리) 캡슐 두께**: `26px`
- **외곽 네온 하이라이트 선폭**: `6px`
- **관절 구체 반지름**: `13px`
- **바이저 세로 두께**: `6px`

### 3.4 색상 팔레트 (Color Palette)
| 신체 부위 | 색상 코드 | 시각적 의도 및 연동 체계 |
|---|---|---|
| 점토 본체 바탕 | `#F8FAFC` (Slate 50) | 부드럽고 매끄러운 세라믹/화이트 점토 질감 |
| 본체 외곽선 | `#CBD5E1` (Slate 300) | 시인성을 위한 1.5px 소프트 경계선 |
| 상단 하이라이트 | `#FFFFFF` | 상단 30도 각도의 부드러운 빛 반사 |
| 하단 소프트 음영 | `#E2E8F0` (Slate 200) | 하단부 입체감을 부여하는 미세 섀도우 |
| 가슴 마력 코어 | `#E2E8F0` / White Core | 호흡 리듬에 맞춰 팽창·수축하는 발광 코어 |
| 코어 글로우 링 | `rgba(203, 213, 225, 0.4)` | 코어 주변의 은은한 에너지 확산 |
| 머리 바이저 | `#C889FF` (Neon Purple) | 머리 커서 및 상단 존 연동 사이버 바이저 |
| **왼팔 / 왼다리** | `#28E6FF` (Neon Cyan) | **유저 왼손 커서(1P) 색상 체계와 100% 일치** |
| **오른팔 / 오른다리** | `#FFCB4D` (Neon Yellow) | **유저 오른손 커서(2P) 색상 체계와 100% 일치** |
| **골반 관절** | `#FF865E` (Coral Orange) | **골반 커서 색상 체계와 100% 일치** |
| **어깨 관절** | `#C889FF` (Purple) | **머리/목 커서 색상 체계와 100% 일치** |
| 지면 마법진 링 | `#28E6FF` | 발밑 지면 접지 네온 링 |
| 지면 그림자 | `rgba(0, 0, 0, 0.28)` | 부드러운 타원형 앰비언트 접지 그림자 |

---

## 4. 2D 좌표계 및 관절 순운동학 (Kinematics & Coordinate System)

### 4.1 HTML5 Canvas 2D 좌표 체계
- 원점 `(0, 0)`: 화면 좌상단
- **X축 (+X)**: 화면 오른쪽으로 증가
- **Y축 (+Y)**: 화면 아래쪽으로 증가 (중력 방향)
- **회전 각도 ($\theta$) 기준**:
  - $0\text{ rad} (0^\circ)$: 화면 오른쪽 (+X)
  - $+\frac{\pi}{2}\text{ rad} (+90^\circ)$: 화면 아래쪽 (+Y, 수직 하향)
  - $\pm\pi\text{ rad} (180^\circ)$: 화면 왼쪽 (-X)
  - $-\frac{\pi}{2}\text{ rad} (-90^\circ)$: 화면 위쪽 (-Y, 수직 상향)

### 4.2 거울 모드 화면 기준 좌우 정렬
화면을 거울처럼 바라보는 피트니스 게임 특성상:
- **화면 좌측**: 사용자 본인의 **왼팔 / 왼쪽 다리** (시안 `#28E6FF`, $X < \text{pelvis.x}$)
- **화면 우측**: 사용자 본인의 **오른팔 / 오른쪽 다리** (노랑 `#FFCB4D`, $X > \text{pelvis.x}$)

### 4.3 관절 순운동학(FK) 계산식
```typescript
// 1. 골반 좌우 기준점 (몸통 수직선의 법선 벡터 방향)
leftHip.x = pelvis.x - shoulderNormal.x * (hipWidth / 2);
rightHip.x = pelvis.x + shoulderNormal.x * (hipWidth / 2);

// 2. 허벅지 끝점 (무릎)
leftKnee.x = leftHip.x + Math.cos(angles.leftUpperLeg) * upperLegLength;
leftKnee.y = leftHip.y + Math.sin(angles.leftUpperLeg) * upperLegLength;

// 3. 종아리 끝점 (발목)
leftAnkle.x = leftKnee.x + Math.cos(angles.leftLowerLeg) * lowerLegLength;
leftAnkle.y = leftKnee.y + Math.sin(angles.leftLowerLeg) * lowerLegLength;
```

---

## 5. 특수 애니메이션 및 모션 시각화 메커니즘

### 5.1 체공 시 지면 그림자 디커플링 (Ground Decoupling)
- **문제점**: 캐릭터 점프 시 그림자가 캐릭터 발바닥에 붙어 함께 공중으로 떠오르면 점프 높이감을 체감할 수 없음
- **해결 메커니즘**:
  - 캐릭터가 점프하여 위로 솟구치면(`verticalOffset < 0`), 그림자는 공중에 뜨지 않고 **원래의 지면 Y좌표(`groundY + airHeight`)에 그대로 잔류**
  - 체공 높이(`airHeight`)가 높아질수록 그림자 반경이 점진적으로 축소(`shadowDecay`)되고 투명도가 옅어져(`shadowAlpha`), 시각적인 입체감과 점프 체공감을 극대화

### 5.2 제자리 달리기 연동 스윙 (Running Sync)
- 제자리 달리기 단계(`isRunning = true`) 진입 시:
  - 포즈 인식이 불안정하거나 발목이 보이지 않아도 러닝 리듬 타이머(`animTimer * 8.0`)와 연동
  - 왼팔과 오른팔, 왼다리와 오른다리가 서로 반대 위상($180^\circ$)으로 힘차게 교차 스윙
  - 발을 디딜 때마다 미세한 지면 바운스 홉(`verticalOffset ≈ -15px`)을 가산하여 역동적인 달리기 표현

### 5.3 점프 체공 턱(Jump Tuck) 및 스쿼트 굴곡
- **점프 상승 (`normalizedHipDiff < -0.02`)**: 공중에서 무릎을 가슴 쪽으로 끌어올리는 체공 턱(Tuck) 모션을 합성
- **스쿼트 하강 (`normalizedHipDiff > 0.02`)**: 대퇴골이 외측으로 벌어지며 무릎이 부드럽게 굴곡되는 스쿼트 자세 전개

---

## 6. 관절 각도 결함 분석 및 해결 대안 명세 (Issue #721 대안)

### 6.1 최근 이슈 #721에서 발생한 다리 왜곡 원인 분석
1. **스쿼트 굴곡 부호 반전**:
   - `leftLowerLeg -= squatFlex`, `rightLowerLeg += squatFlex`로 적용되어, 각도 감소(왼쪽 $\rightarrow$ 우측 안쪽)와 각도 증가(오른쪽 $\rightarrow$ 좌측 안쪽)로 인해 **양쪽 종아리가 몸 안쪽으로 급격히 꺾임**
2. **발목 미인식 시의 초기 각도 불일치**:
   - `defaultAngles`에서 허벅지는 $86.4^\circ$(`0.48*PI`), 종아리는 $90^\circ$(`0.50*PI`)로 정의되어 차렷 자세에서도 $3.6^\circ$의 무릎 꺾임이 상존
   - 허벅지 회전량 추종 비율을 1.0으로 올리면서 허벅지가 수직일 때 종아리가 $93.6^\circ$로 꺾여 바깥/안쪽 뒤틀림이 증폭

### 6.2 권장 대안 규격 (해부학적 1자 정렬 및 관절 제약)
1. **발목 미인식 시 허벅지 직결 정렬 (Collinear Alignment)**:
   - 복잡한 델타 가산 대신 발목이 잘렸을 때 `derivedLowerLeg = upperLegAngle`로 직결
   - 허벅지와 종아리가 꺾임 없이 곧은 1자로 유지되어 반듯이 서 있을 때의 기괴한 왜곡을 원천 배제
2. **기본 차렷 자세 각도 대칭화**:
   - `defaultAngles`의 다리 기본 각도를 허벅지와 종아리 모두 완전 수직 $90^\circ$(`Math.PI * 0.50`)로 통일
3. **무릎 내측 꺾임 방지 클램프 (Anti-Valgus Joint Clamp)**:
   - 인체 무릎은 전면 관상면에서 안쪽으로 꺾이지 않는 경첩 관절이므로, 좌측 무릎 각도가 우측으로 파고들거나 우측 무릎 각도가 좌측으로 파고드는 것을 물리적으로 클램핑하여 안정성 보장

---

## 7. 향후 확장 로드맵 (Upcoming Extensions)

1. **[#725 / FEAT-SKEL-LIMIT-001] 관절 가동 범위(Joint Limits) 여유 제한**:
   - 웹캠 노이즈나 손 겹침 시 팔꿈치/어깨 관절이 $180^\circ$ 뒤집히는 것을 방지하는 해부학적 리밋 적용
2. **[#726 / FEAT-ASSAULT-PUNCH-002] 동적 찌르기(Stroke) 펀치 인식**:
   - 졸라맨 어깨 $\rightarrow$ 손목 방향 벡터와 신전 가속도를 측정하여 정밀한 펀치 타격 판정 연동
3. **[#685] 캐릭터 스킨 렌더러 연동**:
   - 졸라맨 골격을 기반으로 꼬마 수호신, 기사단 스프라이트 스킨을 입히는 `CharacterAvatarRenderer` 확장 지원

---

## 8. 팔 관절 스냅 방지 및 안정화 명세 (#725 / FEAT-SKEL-LIMIT-001)

### 8.1 관절 밀착 시 튐(Snap) 원인 및 3대 해결 원칙
1. **길이 신뢰도 가중 (Length-Weighted Blending)**:
   - 2D 화면상 손목-팔꿈치 또는 팔꿈치-어깨 마디 길이가 짧아지면(정면 펀치, 가슴 앞 대기), 노이즈로 인한 `atan2` 각도 급변을 억제하기 위해 마디 길이 비율에 비례하는 신뢰도 가중치 $w = \text{smoothstep}(\text{minLen}, \text{fullLen}, \text{len}/\text{shoulderWidth})$를 적용하고, $w \approx 0$일 때는 직전 프레임의 각도를 부드럽게 유지한다.
2. **최단 회전 경로 부호 반전 방지 (Hysteresis Direction)**:
   - 팔을 끝까지 접어 목표 각도와 현재 각도 차이가 $180^\circ$에 근접할 때, 부호가 프레임마다 바뀌어 반대로 크게 도는 채찍질 현상을 방지하도록 직전 회전 부호를 보존한다.
3. **소프트 가동 범위 (Soft Joint Limits)**:
   - 인체 해부학적 가동 범위(팔꿈치 굴곡 $-15^\circ \sim 165^\circ$, 어깨 $\pm 160^\circ$)를 초과하는 비정상 각도에 대해 탄성 감쇠 클램핑을 적용하여 기괴한 관절 뒤집힘을 완전히 차단한다.

---

## 9. 졸라맨 팔 뻗기 방향 및 신전율 기반 펀치 인식 (#726 / FEAT-ASSAULT-PUNCH-002)

### 9.1 순수 기하학 기반 방향 벡터 및 신전율 판정
- **방향 판정**: 어깨 $\rightarrow$ 손목 방향 벡터 $\vec{v} = (x_{wrist} - x_{shoulder}, y_{wrist} - y_{shoulder})$의 $X$ 성분 부호에 따라 좌측($\vec{v}.x < -0.30$)과 우측($\vec{v}.x > +0.30$)을 분기한다.
- **신전율(Extension Ratio)**:
  $$\text{Ratio} = \frac{\|\vec{v}\|}{L_{upperArm} + L_{forearm}}$$
- **동적 찌르기(Stroke 엣지 트리거)**:
  - $\text{Ratio} < 0.60$ (대기) $\rightarrow$ $\text{Ratio} \ge 0.80$ (신전) 전이 순간에만 1회 발화.
  - 미리 뻗고 정지한 상태에서는 신전 속도가 없으므로 자동 선택을 방지하여 치팅을 차단한다.
  - $\text{Ratio} \le 0.65$로 20%만 살짝 당겨도 즉시 다음 타격이 장전되어 쾌적한 연타 잽을 지원한다.
