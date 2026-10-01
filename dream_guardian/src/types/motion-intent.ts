/**
 * motion-intent.ts - MotionIntentBus 관련 공통 타입 및 인터페이스
 *
 * @see Issue #252 [INPUT-TOLERANCE-004]
 */

export type MotionIntentType =
  | 'reachLeft'
  | 'reachRight'
  | 'jump'
  | 'stepLeft'
  | 'stepRight'
  | 'squat';

export interface MotionIntent {
  /** 감지된 신체 의도 분류 */
  type: MotionIntentType;
  /** 신뢰도 (0.0 ~ 1.0) */
  confidence: number;
  /** 발생 타임스탬프 (초) */
  timestamp: number;
  /** 발생원 커서 또는 신체 부위 (예: 'left_hand', 'right_hand', 'left_foot', 'right_foot', 'body') */
  sourceCursor?: string;
  /** 부가 정보 페이로드 */
  payload?: Record<string, unknown>;
}

export type MotionIntentListener = (intent: MotionIntent) => void;
export type UnsubscribeFn = () => void;

export type MotionPhase =
  | 'ANSWER_SELECT'
  | 'HAZARD_EVADE'
  | 'STAR_COLLECT'
  | 'BOSS_CLIMAX'
  | 'default'
  | (string & {});
