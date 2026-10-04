/**
 * runningMatPatterns.ts - 러닝 매트 제안 패턴 데이터 및 슬롯 정의
 *
 * @see Issue #371 [RUN-MAT-002]
 * @see Issue #370 [RUN-MAT-001]
 */

import type { LocomotionMode } from '../motion/LocomotionDetector.js';

export type { LocomotionMode };

export type MatArrowDirection = 'left' | 'right' | 'up' | 'down' | 'center' | 'none';
export type MatFootSlot = 'out' | 'home' | 'lift';

export interface MatCue {
  readonly id: string;
  readonly actionText: string;
  readonly directionText: string;
  readonly cueText: string;
  readonly arrowDirection: MatArrowDirection;
  readonly leftFootSlot: MatFootSlot;
  readonly rightFootSlot: MatFootSlot;
  readonly isPrepare?: boolean;
}

export interface RunningMatPattern {
  readonly mode: LocomotionMode;
  readonly exerciseBeats: number;
  readonly requiredCount: number;
  readonly prepareBeats: number;
  readonly exerciseCues: readonly MatCue[];
  readonly extensionCues: readonly MatCue[];
  readonly prepareCues: readonly MatCue[];
}

// ─── RUN 기본 큐 ───
export const RUN_CUES: Readonly<Record<string, MatCue>> = Object.freeze({
  LEFT_OUT: Object.freeze({
    id: 'left_out',
    actionText: '왼발 딛기',
    directionText: '왼쪽',
    cueText: '왼발 바깥',
    arrowDirection: 'left',
    leftFootSlot: 'out',
    rightFootSlot: 'home',
    isPrepare: false,
  }),
  LEFT_HOME: Object.freeze({
    id: 'left_home',
    actionText: '왼발 복귀',
    directionText: '중앙',
    cueText: '왼발 중앙 home',
    arrowDirection: 'center',
    leftFootSlot: 'home',
    rightFootSlot: 'home',
    isPrepare: false,
  }),
  RIGHT_OUT: Object.freeze({
    id: 'right_out',
    actionText: '오른발 딛기',
    directionText: '오른쪽',
    cueText: '오른발 바깥',
    arrowDirection: 'right',
    leftFootSlot: 'home',
    rightFootSlot: 'out',
    isPrepare: false,
  }),
  RIGHT_HOME: Object.freeze({
    id: 'right_home',
    actionText: '오른발 복귀',
    directionText: '중앙',
    cueText: '오른발 중앙 home',
    arrowDirection: 'center',
    leftFootSlot: 'home',
    rightFootSlot: 'home',
    isPrepare: false,
  }),
  LIFT_LEFT: Object.freeze({
    id: 'lift_left',
    actionText: '왼발 들기',
    directionText: '중앙',
    cueText: '중앙 왼발 들기',
    arrowDirection: 'up',
    leftFootSlot: 'lift',
    rightFootSlot: 'home',
    isPrepare: false,
  }),
  LIFT_RIGHT: Object.freeze({
    id: 'lift_right',
    actionText: '오른발 들기',
    directionText: '중앙',
    cueText: '중앙 오른발 들기',
    arrowDirection: 'up',
    leftFootSlot: 'home',
    rightFootSlot: 'lift',
    isPrepare: false,
  }),
  BOTH_HOME: Object.freeze({
    id: 'both_home',
    actionText: '양발 안착',
    directionText: '중앙',
    cueText: '양발 중앙 안착',
    arrowDirection: 'center',
    leftFootSlot: 'home',
    rightFootSlot: 'home',
    isPrepare: true,
  }),
  READY_ANSWER: Object.freeze({
    id: 'ready_answer',
    actionText: '정답 준비',
    directionText: '중앙',
    cueText: '정답 존 대기',
    arrowDirection: 'none',
    leftFootSlot: 'home',
    rightFootSlot: 'home',
    isPrepare: true,
  }),
});

// ─── HIP BOUNCE 큐 (중앙 상하 바운스, 발 이동 없음) ───
export const HIP_BOUNCE_CUES: Readonly<Record<string, MatCue>> = Object.freeze({
  BOUNCE_DOWN: Object.freeze({
    id: 'bounce_down',
    actionText: '바운스 다운',
    directionText: '중앙',
    cueText: '상하 바운스 (다운)',
    arrowDirection: 'down',
    leftFootSlot: 'home',
    rightFootSlot: 'home',
    isPrepare: false,
  }),
  BOUNCE_UP: Object.freeze({
    id: 'bounce_up',
    actionText: '바운스 업',
    directionText: '중앙',
    cueText: '상하 바운스 (업)',
    arrowDirection: 'up',
    leftFootSlot: 'home',
    rightFootSlot: 'home',
    isPrepare: false,
  }),
  CENTER_ALIGN: Object.freeze({
    id: 'center_align',
    actionText: '중앙 정렬',
    directionText: '중앙',
    cueText: '중앙 자세 정돈',
    arrowDirection: 'center',
    leftFootSlot: 'home',
    rightFootSlot: 'home',
    isPrepare: true,
  }),
  READY_ANSWER: Object.freeze({
    id: 'ready_answer',
    actionText: '정답 준비',
    directionText: '중앙',
    cueText: '정답 존 대기',
    arrowDirection: 'none',
    leftFootSlot: 'home',
    rightFootSlot: 'home',
    isPrepare: true,
  }),
});

// ─── HIP SWAY 큐 (발 고정, 골반 좌우 체중 이동) ───
export const HIP_SWAY_CUES: Readonly<Record<string, MatCue>> = Object.freeze({
  SWAY_LEFT: Object.freeze({
    id: 'sway_left',
    actionText: '체중 이동 (좌)',
    directionText: '왼쪽',
    cueText: '골반 체중 이동 (좌)',
    arrowDirection: 'left',
    leftFootSlot: 'home',
    rightFootSlot: 'home',
    isPrepare: false,
  }),
  SWAY_RIGHT: Object.freeze({
    id: 'sway_right',
    actionText: '체중 이동 (우)',
    directionText: '오른쪽',
    cueText: '골반 체중 이동 (우)',
    arrowDirection: 'right',
    leftFootSlot: 'home',
    rightFootSlot: 'home',
    isPrepare: false,
  }),
  CENTER_ALIGN: Object.freeze({
    id: 'center_align',
    actionText: '중앙 균형',
    directionText: '중앙',
    cueText: '중앙 균형 복귀',
    arrowDirection: 'center',
    leftFootSlot: 'home',
    rightFootSlot: 'home',
    isPrepare: true,
  }),
  READY_ANSWER: Object.freeze({
    id: 'ready_answer',
    actionText: '정답 준비',
    directionText: '중앙',
    cueText: '정답 존 대기',
    arrowDirection: 'none',
    leftFootSlot: 'home',
    rightFootSlot: 'home',
    isPrepare: true,
  }),
});

// ─── ARM CROSS 큐 (두 발 고정, 상체 팔 교차) ───
export const ARM_CROSS_CUES: Readonly<Record<string, MatCue>> = Object.freeze({
  ARM_CROSS_LEFT: Object.freeze({
    id: 'arm_cross_left',
    actionText: '팔 교차 (좌)',
    directionText: '왼쪽',
    cueText: '상체 팔 교차 (좌)',
    arrowDirection: 'left',
    leftFootSlot: 'home',
    rightFootSlot: 'home',
    isPrepare: false,
  }),
  ARM_CROSS_RIGHT: Object.freeze({
    id: 'arm_cross_right',
    actionText: '팔 교차 (우)',
    directionText: '오른쪽',
    cueText: '상체 팔 교차 (우)',
    arrowDirection: 'right',
    leftFootSlot: 'home',
    rightFootSlot: 'home',
    isPrepare: false,
  }),
  ARM_RETURN: Object.freeze({
    id: 'arm_return',
    actionText: '기본 자세',
    directionText: '중앙',
    cueText: '기본 자세 복귀',
    arrowDirection: 'center',
    leftFootSlot: 'home',
    rightFootSlot: 'home',
    isPrepare: true,
  }),
  READY_ANSWER: Object.freeze({
    id: 'ready_answer',
    actionText: '정답 준비',
    directionText: '중앙',
    cueText: '정답 존 대기',
    arrowDirection: 'none',
    leftFootSlot: 'home',
    rightFootSlot: 'home',
    isPrepare: true,
  }),
});

/**
 * 8/12/16 박자별 제안 패턴 생성
 */
function createRunExerciseCues(requiredCount: number): readonly MatCue[] {
  const base: MatCue[] = [
    RUN_CUES.LEFT_OUT,
    RUN_CUES.LEFT_HOME,
    RUN_CUES.RIGHT_OUT,
    RUN_CUES.RIGHT_HOME,
    RUN_CUES.LIFT_LEFT,
    RUN_CUES.LIFT_RIGHT,
  ];

  if (requiredCount <= 6) {
    return Object.freeze(base.slice(0, requiredCount));
  }

  const result: MatCue[] = [...base];
  let toggle = false;

  // 12/16 확장은 바깥발이 복귀 없이 다음 패턴으로 넘어가지 않는 완결된 쌍으로 추가
  while (result.length < requiredCount) {
    if (!toggle) {
      result.push(RUN_CUES.LEFT_OUT);
      if (result.length <= requiredCount) {
        result.push(RUN_CUES.LEFT_HOME);
      }
    } else {
      result.push(RUN_CUES.RIGHT_OUT);
      if (result.length <= requiredCount) {
        result.push(RUN_CUES.RIGHT_HOME);
      }
    }
    toggle = !toggle;
  }

  return Object.freeze(result.slice(0, requiredCount));
}

function createAlternatingCues(cueA: MatCue, cueB: MatCue, count: number): readonly MatCue[] {
  const list: MatCue[] = [];
  for (let i = 0; i < count; i++) {
    list.push(i % 2 === 0 ? cueA : cueB);
  }
  return Object.freeze(list);
}

/**
 * 모드 및 박자 프로필에 따른 제안 패턴 반환
 */
export function getRunningMatPattern(
  mode: LocomotionMode = 'run',
  exerciseBeats: number = 8
): RunningMatPattern {
  // 박자별 필수 운동 횟수 (8박: 6, 12박: 10, 16박: 14)
  const requiredCount = Math.max(2, exerciseBeats - 2);
  const prepareBeats = 2;

  switch (mode) {
    case 'hip_bounce': {
      return Object.freeze({
        mode,
        exerciseBeats,
        requiredCount,
        prepareBeats,
        exerciseCues: createAlternatingCues(
          HIP_BOUNCE_CUES.BOUNCE_DOWN,
          HIP_BOUNCE_CUES.BOUNCE_UP,
          requiredCount
        ),
        extensionCues: Object.freeze([
          HIP_BOUNCE_CUES.BOUNCE_DOWN,
          HIP_BOUNCE_CUES.BOUNCE_UP,
        ]),
        prepareCues: Object.freeze([
          HIP_BOUNCE_CUES.CENTER_ALIGN,
          HIP_BOUNCE_CUES.READY_ANSWER,
        ]),
      });
    }

    case 'hip_sway': {
      return Object.freeze({
        mode,
        exerciseBeats,
        requiredCount,
        prepareBeats,
        exerciseCues: createAlternatingCues(
          HIP_SWAY_CUES.SWAY_LEFT,
          HIP_SWAY_CUES.SWAY_RIGHT,
          requiredCount
        ),
        extensionCues: Object.freeze([
          HIP_SWAY_CUES.SWAY_LEFT,
          HIP_SWAY_CUES.SWAY_RIGHT,
        ]),
        prepareCues: Object.freeze([
          HIP_SWAY_CUES.CENTER_ALIGN,
          HIP_SWAY_CUES.READY_ANSWER,
        ]),
      });
    }

    case 'arm_cross': {
      return Object.freeze({
        mode,
        exerciseBeats,
        requiredCount,
        prepareBeats,
        exerciseCues: createAlternatingCues(
          ARM_CROSS_CUES.ARM_CROSS_LEFT,
          ARM_CROSS_CUES.ARM_CROSS_RIGHT,
          requiredCount
        ),
        extensionCues: Object.freeze([
          ARM_CROSS_CUES.ARM_CROSS_LEFT,
          ARM_CROSS_CUES.ARM_CROSS_RIGHT,
        ]),
        prepareCues: Object.freeze([
          ARM_CROSS_CUES.ARM_RETURN,
          ARM_CROSS_CUES.READY_ANSWER,
        ]),
      });
    }

    case 'run':
    default: {
      return Object.freeze({
        mode: 'run',
        exerciseBeats,
        requiredCount,
        prepareBeats,
        exerciseCues: createRunExerciseCues(requiredCount),
        extensionCues: Object.freeze([
          RUN_CUES.LIFT_LEFT,
          RUN_CUES.LIFT_RIGHT,
        ]),
        prepareCues: Object.freeze([
          RUN_CUES.BOTH_HOME,
          RUN_CUES.READY_ANSWER,
        ]),
      });
    }
  }
}
