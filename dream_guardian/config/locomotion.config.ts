/**
 * locomotion.config.ts - 운동 모드 및 인게임 비트 HUD 가이드 설정
 *
 * Issue #209 (REFACTOR-RENDER-001):
 * - HUDLayer에 인라인되어 있던 운동 가이드 데이터(LOCOMOTION_HUD_GUIDES) 및
 *   8박 인디케이터 매직넘버/색상/폰트 상수를 config 레이어로 분리
 */

import type { LocomotionMode } from '../src/motion/LocomotionDetector.js';

export interface LocomotionHUDGuide {
  icon: string;
  title: string;
  subtitle: string;
  countLabel: string;
}

/**
 * Issue #368 (RUN-MAT-005): 러닝 HUD 표시 전용 메타데이터 인터페이스
 */
export interface LocomotionDisplayConfig {
  modeName: string;
  guideTitle: string;
  guideSubtitle: string;
  cumulativeLabel: string;
  unit: string;
}

/** 운동 모드별 인게임 모션 가이드 문구 */
export const LOCOMOTION_HUD_GUIDES: Record<LocomotionMode, LocomotionHUDGuide> = {
  run: {
    icon: '🏃',
    title: '가볍게 제자리에서 달리세요!',
    subtitle: '발을 구르거나 [Space] / 화면을 탭하세요',
    countLabel: '🏃 걸음 수',
  },
  hip_bounce: {
    icon: '🦘',
    title: '무릎을 굽혔다 펴며 골반을 바운스하세요!',
    subtitle: '골반을 상하로 가볍게 바운스하거나 [Space]를 탭하세요',
    countLabel: '🦘 바운스',
  },
  hip_sway: {
    icon: '💃',
    title: '골반을 좌우로 흔들어 코어를 자극하세요!',
    subtitle: '골반을 좌우로 흔들거나 [Space]를 탭하세요',
    countLabel: '💃 스웨이',
  },
  arm_cross: {
    icon: '🚗',
    title: '양손을 위아래로 교차하며 핸들을 돌리세요!',
    subtitle: '양손을 위아래로 교차하며 펌핑하거나 [Space]를 탭하세요',
    countLabel: '🚗 휠 펌핑',
  },
};

/**
 * Issue #368 (RUN-MAT-005): 러닝 HUD 표시 전용 모드 정보 및 누적 라벨/단위 설정
 * 매트(RunningMat)의 슬롯 인정 수(acceptedCount/requiredCount)와 분리하여
 * 플레이어의 원시 누적 운동 통계(totalSteps)를 각 모드에 맞는 단위로 명확히 표시합니다.
 */
export const LOCOMOTION_DISPLAY_CONFIG: Record<LocomotionMode, LocomotionDisplayConfig> = {
  run: {
    modeName: '달리기',
    guideTitle: '달리기',
    guideSubtitle: '제자리에서 가볍게 발을 굴러주세요',
    cumulativeLabel: '누적 걸음',
    unit: '보',
  },
  hip_bounce: {
    modeName: '중앙 상하',
    guideTitle: '중앙 상하',
    guideSubtitle: '무릎을 굽혔다 펴며 골반을 바운스하세요',
    cumulativeLabel: '누적 바운스',
    unit: '회',
  },
  hip_sway: {
    modeName: '중앙 체중 이동',
    guideTitle: '중앙 체중 이동',
    guideSubtitle: '발 이동 없이 중앙에서 골반 체중을 이동하세요',
    cumulativeLabel: '누적 스웨이',
    unit: '회',
  },
  arm_cross: {
    modeName: '양팔 교차',
    guideTitle: '양팔 교차',
    guideSubtitle: '두 발을 고정하고 양손을 위아래로 교차하세요',
    cumulativeLabel: '누적 휠 펌핑',
    unit: '회',
  },
};

/** 8박 러닝 HUD 및 인디케이터 설정 */
export const BEAT_HUD_CONFIG = {
  TOTAL_BEATS: 8,
  COLOR_SPLIT_BEAT: 5,
  COLOR_EARLY: '#FFCB4D',
  COLOR_LATE: '#28E6FF',
  DOT_RADIUS: 14,
  DOT_GAP: 44,
  DOT_OFFSET_Y: 55,
  TITLE_COLOR_CENTER: '#28E6FF',
  TITLE_COLOR_DEFAULT: '#FFCB4D',
  TEXT_COLOR_SUBTITLE: '#DDDDDD',
  STEP_COUNT_COLOR: '#4DFFAA',
  HAZARD_RING_BASE_RADIUS: 95,
  HAZARD_RING_PULSE_RANGE: 90,
  HAZARD_RING_LINE_WIDTH: 10,
  HAZARD_RING_ASPECT: 0.34,
} as const;
