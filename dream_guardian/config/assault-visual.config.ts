/**
 * assault-visual.config.ts - 보스 접근전(Boss Assault) 비주얼 및 표현 프로필 설정
 *
 * @see docs/14_BOSS_ASSAULT_GAMEPLAY_DESIGN.md (DOC-14 §§6.4, 6.7, 15.3)
 * @see docs/15_BOSS_ASSAULT_WORK_CARDS.md (BOSS-ASSAULT-03 / Issue #505)
 *
 * 절대 규칙:
 * 1. Config 레이어 단일 책임: 순수 시각 표현 및 레이아웃 데이터만 정의한다.
 * 2. 렌더링 함수, 이펙트 실행, 타이머 일체 배제.
 * 3. Deep freeze를 통해 불변성 보장.
 */

import type { ProfileId, RulesVersion } from '../src/types/assault.js';
import { deepFreeze } from '../src/utils/deepFreeze.js';

export interface AssaultPoint2D {
  readonly x: number;
  readonly y: number;
}

export interface AssaultBossAnchor {
  readonly center: AssaultPoint2D;
  readonly leftHand: AssaultPoint2D;
  readonly rightHand: AssaultPoint2D;
}

export interface AssaultProjectileLaunchRatios {
  readonly left: AssaultPoint2D;
  readonly right: AssaultPoint2D;
}

export interface AssaultBossScaleRange {
  readonly minScale: number;
  readonly maxScale: number;
}

export interface AssaultChoiceCardLayout {
  readonly widthRatio: number;
  readonly heightRatio: number;
  readonly leftCenterRatio: AssaultPoint2D;
  readonly rightCenterRatio: AssaultPoint2D;
}

export interface AssaultFeedbackDurationMs {
  readonly hitFlashMs: number;
  readonly stunMs: number;
  readonly shakeMs: number;
}

export interface AssaultShakeConfig {
  readonly intensity: number;
  readonly duration: number;
}

export interface AssaultGhostTrailConfig {
  readonly enabled: boolean;
  readonly stepOffsets: readonly number[];
  readonly alphas: readonly number[];
}

export interface AssaultPunchImpactConfig {
  /** 별가루 파티클 개수 (기본값: 16) */
  readonly starCount: number;
  /** 별가루 색상 팔레트 */
  readonly starColors: readonly string[];
  /** 충격파 링 시작 반경 (px, 기본값: 20) */
  readonly shockwaveMinRadius: number;
  /** 충격파 링 최대 반경 (px, 기본값: 90) */
  readonly shockwaveMaxRadius: number;
  /** 충격파 링 지속 시간 (초, 기본값: 0.4) */
  readonly shockwaveDuration: number;
  /** 충격파 링 색상 (기본값: '#FFD700') */
  readonly shockwaveColor: string;
  /** 퍼펙트 배지 부유 거리 (px, 기본값: -40) */
  readonly badgeFloatY: number;
  /** 퍼펙트 배지 지속 시간 (초, 기본값: 0.6) */
  readonly badgeDuration: number;
  /** 퍼펙트 배지 색상 (기본값: '#FFD700') */
  readonly badgeColor: string;
}

export interface AssaultColorPalette {
  readonly leftChoice: string;
  readonly rightChoice: string;
  readonly hazardRed: string;
  readonly perfectGlow: string;
  readonly goodGlow: string;
  readonly lateGlow: string;
}

export interface AssaultVisualConfig {
  readonly profileId: ProfileId;
  readonly rulesVersion: RulesVersion;
  /** 기준 비주얼 스케일 */
  readonly visualScale: number;
  /** 보스 공격 손 및 앵커 좌표 비율 (DEC-C2) */
  readonly bossAnchor: AssaultBossAnchor;
  /** 좌/우 투사체 발사점 비율 (DEC-C2) */
  readonly projectileLaunchRatios: AssaultProjectileLaunchRatios;
  /** 라운드 진행도 비례 보스 거리/스케일 연출 범위 (DEC-C3) */
  readonly bossScaleRange: AssaultBossScaleRange;
  /** 보기 카드 크기 및 배치 비율 */
  readonly choiceCard: AssaultChoiceCardLayout;
  /** 보기 라벨 최대 글자 수 (DEC-C9) */
  readonly labelMaxChars: number;
  /** 보기 라벨 최소 폰트 크기 (px, DEC-C9) */
  readonly labelMinFontSizePx: number;
  /** 문제 헤더 기준 폰트 크기 (px, 기본 54) */
  readonly questionFontSizePx: number;
  /** 선택지 폰트 배율 (문제 크기 대비 배율) */
  readonly choiceFontScaleRatio: number;
  /** 선택지 기준 폰트 크기 (px, 기본 150) */
  readonly choiceBaseFontSizePx: number;
  /** 피드백 및 이펙트 연출 지속시간 (ms) */
  readonly feedbackDurationMs: AssaultFeedbackDurationMs;
  /** 모드 전용 컬러 팔레트 */
  readonly colors: AssaultColorPalette;
  /** 바닥 판정선(RunningMat) 어댑터 렌더링 활성화 여부 (ASSAULT-FX-001) */
  readonly enableFloorMat: boolean;
  /** 비트 그리드 펄스 기준 초당 박자 수 (초, 기본값: 0.5 = 120 BPM) */
  readonly gridPulseSecondsPerBeat: number;
  /** 비트 그리드 펄스 활성화 여부 (기본값: true) */
  readonly enableGridPulse: boolean;
  /** 화면 흔들림(Screen Shake) 활성화 여부 (ASSAULT-FX-002) */
  readonly enableScreenShake: boolean;
  /** 정답/타격 시 화면 흔들림 파라미터 (ASSAULT-FX-002) */
  readonly correctShake: AssaultShakeConfig;
  /** 오답/피격 시 화면 흔들림 파라미터 (ASSAULT-FX-002) */
  readonly wrongShake: AssaultShakeConfig;
  /** 목표 가이드 및 어프로치 링 형태 ('circle': 레거시 별모으기 원형 방식, 'rect': 사각 박스) */
  readonly approachShape?: 'circle' | 'rect';
  /** 어프로치 링 시작 배율 (기본값: 2.0) */
  readonly approachRingMaxScale?: number;
  /** 투사체 최소 시작 스케일 (원근 크기) */
  readonly projectileMinScale?: number;
  /** 투사체 최대 착지 스케일 (원근 크기) */
  readonly projectileMaxScale?: number;
  /** 투사체 원근 이징 지수 (가속도 곡선) */
  readonly projectileEasingExponent?: number;
  /** 답안 원근 확대 및 비행 기준 박자 (기본값: 2박) */
  readonly answerPerspectiveBeats?: number;
  /** 원형 답안 비행 원근 속도감 Trail(고스트 잔상) 설정 (ASSAULT-TRAIL-001) */
  readonly ghostTrail?: AssaultGhostTrailConfig;
  /** 정답 펀치 별모으기 융합 시각효과 설정 (ASSAULT-FX-005) */
  readonly punchImpact?: AssaultPunchImpactConfig;
  /** 원형 답안 크기 비율 (기본값: 0.46) */
  readonly choiceCardCircleRatio?: number;
  /** 내부 원형 판정 가이드 링 스케일 배율 (기본값: 1.0) */
  readonly targetReceptorScale?: number;
}

export const DEFAULT_ASSAULT_VISUAL_CONFIG: Readonly<AssaultVisualConfig> = deepFreeze({
  profileId: 'assault_visual_mvp_v1',
  rulesVersion: 'v0.3',
  visualScale: 1.0,
  bossAnchor: {
    center: { x: 0.5, y: 0.3 },
    leftHand: { x: 0.35, y: 0.42 },
    rightHand: { x: 0.65, y: 0.42 },
  },
  projectileLaunchRatios: {
    left: { x: 0.35, y: 0.42 },
    right: { x: 0.65, y: 0.42 },
  },
  bossScaleRange: {
    minScale: 0.8,
    maxScale: 1.4,
  },
  choiceCard: {
    widthRatio: 0.36,
    heightRatio: 0.36,
    leftCenterRatio: { x: 0.26, y: 0.3 },
    rightCenterRatio: { x: 0.74, y: 0.3 },
  },
  labelMaxChars: 6,
  labelMinFontSizePx: 20,
  questionFontSizePx: 100,
  choiceFontScaleRatio: 100 / 100,
  choiceBaseFontSizePx: 100,
  feedbackDurationMs: {
    hitFlashMs: 200,
    stunMs: 600,
    shakeMs: 300,
  },
  colors: {
    leftChoice: '#28E6FF',
    rightChoice: '#C889FF',
    hazardRed: '#FF4D4D',
    perfectGlow: '#00FFCC',
    goodGlow: '#FFD700',
    lateGlow: '#FF8800',
  },
  enableFloorMat: true,
  gridPulseSecondsPerBeat: 0.5,
  enableGridPulse: true,
  enableScreenShake: true,
  correctShake: {
    intensity: 14,
    duration: 0.35,
  },
  wrongShake: {
    intensity: 4,
    duration: 0.18,
  },
  approachShape: 'circle',
  approachRingMaxScale: 2.0,
  projectileMinScale: 0.45,
  projectileMaxScale: 1.0,
  projectileEasingExponent: 2.0,
  answerPerspectiveBeats: 2,
  choiceCardCircleRatio: 0.46,
  targetReceptorScale: 1.0,
  ghostTrail: {
    enabled: true,
    stepOffsets: [0.035, 0.070, 0.105],
    alphas: [0.28, 0.20, 0.12],
  },
  punchImpact: {
    starCount: 16,
    starColors: ['#FFD700', '#28E6FF', '#C889FF', '#FFFFFF'],
    shockwaveMinRadius: 20,
    shockwaveMaxRadius: 90,
    shockwaveDuration: 0.4,
    shockwaveColor: '#FFD700',
    badgeFloatY: 40,
    badgeDuration: 0.6,
    badgeColor: '#FFD700',
  },
});
