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
  /** 피드백 및 이펙트 연출 지속시간 (ms) */
  readonly feedbackDurationMs: AssaultFeedbackDurationMs;
  /** 모드 전용 컬러 팔레트 */
  readonly colors: AssaultColorPalette;
}

function deepFreeze<T extends object>(obj: T): Readonly<T> {
  for (const value of Object.values(obj)) {
    if (value && typeof value === 'object') {
      deepFreeze(value);
    }
  }
  return Object.freeze(obj);
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
  feedbackDurationMs: {
    hitFlashMs: 200,
    stunMs: 600,
    shakeMs: 300,
  },
  colors: {
    leftChoice: '#28E6FF',
    rightChoice: '#FFCB4D',
    hazardRed: '#FF4D4D',
    perfectGlow: '#00FFCC',
    goodGlow: '#FFD700',
    lateGlow: '#FF8800',
  },
});
