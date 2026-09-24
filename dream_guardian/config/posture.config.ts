/**
 * posture.config.ts - 자세 난이도 티어, 체류시간 및 타이밍 감쇠 설정 (Issue #120 / CFG-001)
 *
 * 개발 규칙 6절 (데이터와 코드 분리) 준수:
 * - Tier 1~4 단계별 문제 번호 경계 및 허용 부위
 * - 티어별 기본 체류시간 (0.7s ~ 1.2s)
 * - Deadlock Guard 및 자연 감쇠 계수
 * - 중심/외곽 거리 가중치
 */

import type { CursorType } from './cursor.config.js';

export interface TierConfig {
  tier: 1 | 2 | 3 | 4;
  dwellTime: number; // 0.7, 0.8, 1.0, 1.2
  name: string;
  allowedCursors: CursorType[];
}

/** 티어별 문제 번호 경계 (1-based) */
export const POSTURE_TIER_BOUNDARIES = {
  tier1: { minQuestion: 1, maxQuestion: 3 },
  tier2: { minQuestion: 4, maxQuestion: 7 },
  tier3: { minQuestion: 8, maxQuestion: 11 },
  tier4: { minQuestion: 12 },
} as const;

/** 티어별 세부 설정 */
export const TIER_CONFIGS: Record<1 | 2 | 3 | 4, TierConfig> = {
  1: {
    tier: 1,
    dwellTime: 0.7,
    name: 'warmup',
    allowedCursors: ['leftHand', 'rightHand'],
  },
  2: {
    tier: 2,
    dwellTime: 0.8,
    name: 'trunk',
    allowedCursors: ['leftHand', 'rightHand', 'head'],
  },
  3: {
    tier: 3,
    dwellTime: 1.0,
    name: 'fullbody',
    allowedCursors: ['leftHand', 'rightHand', 'head', 'hip'],
  },
  4: {
    tier: 4,
    dwellTime: 1.2,
    name: 'finish',
    allowedCursors: ['leftHand', 'rightHand'],
  },
};

export interface CursorEntryMarginConfig {
  head: number;
  hip: number;
  hand: number;
}

/** 커서 부위별 피트니스 존 진입 마진 설정 (Issue #170 / INPUT-ZONE-001) */
export const CURSOR_ENTRY_MARGIN: CursorEntryMarginConfig = {
  head: 0.03,
  hip: 0.04,
  hand: 0.0,
};

export interface PostureTimingConfig {
  /** 기본 기준 체류시간 (초) */
  defaultDwellTime: number;
  /** 존 중심부 진입 가중치 */
  centerWeight: number;
  /** 존 외곽부 진입 가중치 */
  edgeWeight: number;
  /** 양쪽 선택지 동시 만족 시 Deadlock Guard 감쇠 배수 (dt * 3.0) */
  deadlockDecayMultiplier: number;
  /** 비충족 선택지 자연 감쇠 배수 (dt * 2.0) */
  naturalDecayMultiplier: number;
  /** 커서 부위별 피트니스 존 진입 마진 설정 (Issue #170) */
  cursorEntryMargin: CursorEntryMarginConfig;
}

/** 자세 선택 타이밍, 가중치 및 감쇠 계수 설정 */
export const POSTURE_TIMING_CONFIG: PostureTimingConfig = {
  defaultDwellTime: 1.0,
  centerWeight: 1.5,
  edgeWeight: 0.75,
  deadlockDecayMultiplier: 3.0,
  naturalDecayMultiplier: 2.0,
  cursorEntryMargin: CURSOR_ENTRY_MARGIN,
};

/** 피트니스 칼로리 소모 계수 설정 (Issue #135 / CALC-001) */
export const CALORIE_RATES = {
  step: 0.04,        // 걸음당 0.04 kcal
  squat: 0.35,       // 스쿼트당 0.35 kcal
  jump: 0.15,        // 점프당 0.15 kcal
  dwellPerSecond: 0.07, // 스트레칭/자세 유지 1초당 0.07 kcal
} as const;
