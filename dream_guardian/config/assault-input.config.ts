/**
 * assault-input.config.ts - 보스 접근전(Boss Assault) 모션 및 입력 판정 임계치 설정
 *
 * @see docs/14_BOSS_ASSAULT_GAMEPLAY_DESIGN.md (DOC-14 §§8.1, 15.1-A3, 15.2-B6)
 * @see docs/15_BOSS_ASSAULT_WORK_CARDS.md (BOSS-ASSAULT-03 / Issue #505, BOSS-ASSAULT-38 / Issue #541)
 *
 * 절대 규칙:
 * 1. Config 레이어 단일 책임: 순수 입력 임계치 및 지연 보정 데이터만 정의한다.
 * 2. #541 실측 기반 보정값(중앙값 126ms, p90 165ms) 및 2D 목표 영역 임계치 반영.
 * 3. Deep freeze를 통해 불변성 보장.
 */

import type { ProfileId, RulesVersion } from '../src/types/assault.js';

export interface AssaultTargetBox {
  readonly xMin: number;
  readonly xMax: number;
  readonly yMin: number;
  readonly yMax: number;
}

export interface AssaultTargetBoxes {
  readonly left: AssaultTargetBox;
  readonly right: AssaultTargetBox;
}

export interface AssaultInputConfig {
  readonly profileId: ProfileId;
  readonly rulesVersion: RulesVersion;
  /** 입력 지연 보정 시간 (ms, DEC-B6, #541 실측 중앙값 126ms 반영) */
  readonly inputLatencyMs: number;
  /** 판정 마감 유예창 (ms, DEC-B6, #541 실측 p90 165ms 반영) */
  readonly lateGraceWindowMs: number;
  /** lateGraceWindowMs 별칭 */
  readonly lateGraceMs: number;
  /** 팔 신전 뻗기 임계치 (어깨너비 대비 상대 비율, DEC-A3, #541) */
  readonly punchReachRatio: number;
  /** 펀치 회수 판정 비율 (손목-어깨 거리 비율, 뻗기 해제 기준) */
  readonly punchRetractRatio: number;
  /** 팔꿈치 각도 신전 임계치 (도, DEC-A3) */
  readonly elbowExtensionAngleDeg: number;
  /** 스쿼트 골반 하강 임계치 (신체 정규화 비율) */
  readonly squatDropThreshold: number;
  /** 스쿼트 직립 복귀 임계치 (신체 정규화 비율) */
  readonly squatStandThreshold: number;
  /** 양팔 가드 손목 거리 비율 (어깨너비 대비, DEC-C6, #541) */
  readonly guardWristDistanceRatio: number;
  /** 화면 상단 좌/우 펀치 목표 타깃 박스 정규화 영역 (0~1) */
  readonly targetBoxes: AssaultTargetBoxes;
}

function deepFreeze<T extends object>(obj: T): Readonly<T> {
  for (const value of Object.values(obj)) {
    if (value && typeof value === 'object') {
      deepFreeze(value);
    }
  }
  return Object.freeze(obj);
}

export const DEFAULT_ASSAULT_INPUT_CONFIG: Readonly<AssaultInputConfig> = deepFreeze({
  profileId: 'assault_input_mvp_v1',
  rulesVersion: 'v0.3',
  inputLatencyMs: 130,
  lateGraceWindowMs: 170,
  lateGraceMs: 170,
  punchReachRatio: 1.25,
  punchRetractRatio: 0.85,
  elbowExtensionAngleDeg: 140,
  squatDropThreshold: 0.065,
  squatStandThreshold: 0.035,
  guardWristDistanceRatio: 0.8,
  targetBoxes: {
    left: {
      xMin: 0.08,
      xMax: 0.44,
      yMin: 0.12,
      yMax: 0.48,
    },
    right: {
      xMin: 0.56,
      xMax: 0.92,
      yMin: 0.12,
      yMax: 0.48,
    },
  },
});
