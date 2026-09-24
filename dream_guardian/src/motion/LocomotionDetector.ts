/**
 * LocomotionDetector - 이동(Locomotion) 감지기 공통 인터페이스 및 타입 정의
 *
 * 달리기(Run), 골반 바운스(Hip Bounce), 골반 좌우 스웨이(Hip Sway), 양손 교차(Arm Cross)
 * 4종 이동 방식의 다형성을 지원하는 공통 규격.
 *
 * @see Issue #153 (FEAT-MOTION-001)
 */

import type { NormalizedLandmark } from '../types/index.js';

export type LocomotionMode = 'run' | 'hip_bounce' | 'hip_sway' | 'arm_cross';

export interface ILocomotionDetector {
  /** 현재 감지기의 운동 모드 */
  readonly mode: LocomotionMode;

  /** 현재 이동/운동 동작이 활성 상태인지 */
  readonly isRunning: boolean;

  /** 누적 스텝(동작 완료) 수 */
  readonly stepCount: number;

  /**
   * 매 프레임 좌표 업데이트 및 스텝 판정
   * @param landmarks 33개 랜드마크 배열
   * @param baselineY 캘리브레이션 기준 Y 좌표
   * @param time 현재 프레임 시간 (초 단위)
   * @param virtualHeight 뷰포트 가상 높이 (선택)
   * @returns 이번 프레임에서 스텝(동작 1회) 완료 여부
   */
  update(
    landmarks: readonly NormalizedLandmark[],
    baselineY: number,
    time: number,
    virtualHeight?: number,
  ): boolean;

  /** 감지기 상태 및 스텝 카운트 초기화 */
  reset(): void;
}
