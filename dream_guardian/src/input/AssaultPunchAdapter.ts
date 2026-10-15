/**
 * AssaultPunchAdapter.ts - 보스 접근전(Boss Assault) 회수 기반 반복 펀치 입력 어댑터
 *
 * @see docs/14_BOSS_ASSAULT_GAMEPLAY_DESIGN.md (DOC-14 §8.1, §15.1-A3, §15.1-A4, §15.2-B6)
 * @see docs/15_BOSS_ASSAULT_WORK_CARDS.md (BOSS-ASSAULT-09 / Issue #511)
 *
 * 절대 규칙:
 * 1. Input 레이어 단일 책임: 손의 뻗기/회수 상태 머신 및 정규화된 펀치 입력 이벤트 생성만 전담한다.
 * 2. 정답 판정, HP 차감, 피해량 계산, UI 렌더링을 일체 수행하지 않는다.
 * 3. 새 requestAnimationFrame, setInterval 루프 등록 0회.
 * 4. window, document 등 DOM 이벤트 리스너 직접 등록 0회 (순수 어댑터 클래스).
 * 5. DEC-A3 2D 목표 영역 뻗기 임계치(타깃 박스 + 팔 신전 + 팔꿈치 각도) 및 회수 히스테리시스를 엄격히 준수한다.
 * 6. DEC-A4 손-답 매핑: 왼손은 왼쪽, 오른손은 오른쪽만 타격 가능하며 교차(cross) 펀치는 차단한다.
 * 7. 카메라 미지원 환경을 위한 키보드/가상 입력(Fallback) 인터페이스를 동일한 상태 계약으로 지원한다.
 */

import {
  DEFAULT_ASSAULT_INPUT_CONFIG,
  type AssaultInputConfig,
  type AssaultTargetBox,
} from '../../config/assault-input.config.js';
import {
  calcDistance,
  calcShoulderWidth,
  calcJointAngle,
  DEFAULT_SHOULDER_WIDTH_FALLBACK,
  type Point2D,
} from '../utils/PoseGeometry.js';
import { POSE_LANDMARKS, type NormalizedLandmark } from '../types/index.js';
import type { InputId, PairId } from '../types/assault.js';

export type AssaultHand = 'left' | 'right';

/** 손 펀치 상태 머신 상태 */
export type HandPunchState = 'IDLE' | 'READY' | 'EXTENDED' | 'RETRACTED';

/** 단일 손 랜드마크 입력 */
export interface AssaultPunchHandInput {
  readonly wrist: Point2D;
  readonly elbow?: Point2D;
  readonly shoulder?: Point2D;
  readonly visibility?: number;
}

/** 프레임 단위 어댑터 입력 */
export interface AssaultPunchFrameInput {
  readonly timestampMs: number;
  readonly activeSeconds?: number;
  readonly pairId?: PairId;
  readonly isTrackingLost?: boolean;
  readonly landmarks?: readonly NormalizedLandmark[] | null;
  readonly leftHand?: AssaultPunchHandInput;
  readonly rightHand?: AssaultPunchHandInput;
}

/** 정규화된 펀치 발화 이벤트 */
export interface AssaultPunchEvent {
  readonly inputId: InputId;
  readonly hand: AssaultHand;
  readonly targetSide: AssaultHand;
  readonly rawTimestampMs: number;
  readonly compensatedTimestampMs: number;
  readonly activeTimestampSeconds?: number;
  readonly reachRatio: number;
  readonly elbowAngleDeg?: number;
  readonly wristPoint: Point2D;
  readonly targetBox: AssaultTargetBox;
  readonly pairId?: PairId;
}

/** 손별 상태 스냅샷 */
export interface AssaultHandSnapshot {
  readonly state: HandPunchState;
  readonly reachRatio: number;
  readonly inTargetBox: boolean;
  readonly elbowAngleDeg?: number;
}

/** 어댑터 옵션 */
export interface AssaultPunchAdapterOptions {
  readonly minVisibility?: number;
  readonly idPrefix?: string;
}

export class AssaultPunchAdapter {
  private readonly _config: AssaultInputConfig;
  private readonly _minVisibility: number;
  private readonly _idPrefix: string;

  private _leftState: HandPunchState = 'READY';
  private _rightState: HandPunchState = 'READY';
  private _isTrackingLost = false;
  private _wasTrackingLost = false;

  private _leftSnapshot: AssaultHandSnapshot = {
    state: 'READY',
    reachRatio: 0,
    inTargetBox: false,
  };
  private _rightSnapshot: AssaultHandSnapshot = {
    state: 'READY',
    reachRatio: 0,
    inTargetBox: false,
  };

  private static _globalInputCounter = 0;
  private readonly _listeners = new Set<(event: AssaultPunchEvent) => void>();

  constructor(
    config: AssaultInputConfig = DEFAULT_ASSAULT_INPUT_CONFIG,
    options: AssaultPunchAdapterOptions = {},
  ) {
    this._config = Object.freeze({ ...config });
    this._minVisibility = options.minVisibility ?? 0.5;
    this._idPrefix = options.idPrefix ?? 'punch';
  }

  public get config(): AssaultInputConfig {
    return this._config;
  }

  public get isTrackingLost(): boolean {
    return this._isTrackingLost;
  }

  public getState(hand: AssaultHand): HandPunchState {
    return hand === 'left' ? this._leftState : this._rightState;
  }

  public getSnapshot(hand: AssaultHand): AssaultHandSnapshot {
    return hand === 'left' ? this._leftSnapshot : this._rightSnapshot;
  }

  /**
   * 펀치 이벤트 수신 리스너 등록
   * @returns 리스너 해제(unsubscribe) 함수
   */
  public onPunch(listener: (event: AssaultPunchEvent) => void): () => void {
    this._listeners.add(listener);
    return () => {
      this._listeners.delete(listener);
    };
  }

  /**
   * 상태 초기화 (세션 재시작/재준비)
   * 기존 inputId 채번 카운터는 유지하여 중복 방지 보장.
   */
  public reset(): void {
    this._leftState = 'IDLE';
    this._rightState = 'IDLE';
    this._isTrackingLost = false;
    this._wasTrackingLost = false;
    this._leftSnapshot = { state: 'IDLE', reachRatio: 0, inTargetBox: false };
    this._rightSnapshot = { state: 'IDLE', reachRatio: 0, inTargetBox: false };
  }

  /**
   * 프레임 업데이트 및 펀치 이벤트 검출
   */
  public update(input: AssaultPunchFrameInput): AssaultPunchEvent[] {
    const { timestampMs, activeSeconds, pairId } = input;

    // 1. 추적 상실 여부 판정
    const trackingLost = this._determineTrackingLost(input);
    if (trackingLost) {
      this._isTrackingLost = true;
      this._wasTrackingLost = true;
      return [];
    }

    const justRecovered = this._wasTrackingLost;
    this._isTrackingLost = false;
    this._wasTrackingLost = false;

    // 2. 좌우 손 정보 추출
    const { leftHand, rightHand, shoulderWidth } = this._extractHands(input);

    const emittedEvents: AssaultPunchEvent[] = [];

    // 3. 왼손 상태 머신 평가 (DEC-A4: left hand -> left box)
    const leftEvent = this._evaluateHand({
      hand: 'left',
      handInput: leftHand,
      shoulderWidth,
      targetBox: this._config.targetBoxes.left,
      timestampMs,
      activeSeconds,
      pairId,
      justRecovered,
    });
    if (leftEvent) {
      emittedEvents.push(leftEvent);
    }

    // 4. 오른손 상태 머신 평가 (DEC-A4: right hand -> right box)
    const rightEvent = this._evaluateHand({
      hand: 'right',
      handInput: rightHand,
      shoulderWidth,
      targetBox: this._config.targetBoxes.right,
      timestampMs,
      activeSeconds,
      pairId,
      justRecovered,
    });
    if (rightEvent) {
      emittedEvents.push(rightEvent);
    }

    // 5. 등록된 리스너에게 통지
    for (const event of emittedEvents) {
      for (const listener of this._listeners) {
        try {
          listener(event);
        } catch (err) {
          console.error('[AssaultPunchAdapter] Listener error:', err);
        }
      }
    }

    return emittedEvents;
  }

  /**
   * 카메라 Fallback 키보드/가상 입력 펀치 발화 (Rule 4)
   */
  public triggerFallbackPunch(
    hand: AssaultHand,
    options: {
      timestampMs?: number;
      activeSeconds?: number;
      pairId?: PairId;
    } = {},
  ): AssaultPunchEvent | null {
    const currentState = hand === 'left' ? this._leftState : this._rightState;

    // IDLE이거나 READY일 때만 1회 타격 가능 (손을 뻗은 채 머무르면 추가 발화 차단)
    if (currentState === 'EXTENDED') {
      return null;
    }

    const timestampMs = options.timestampMs ?? Date.now();
    const compensatedTimestampMs = Math.max(0, timestampMs - this._config.inputLatencyMs);
    const targetBox = hand === 'left' ? this._config.targetBoxes.left : this._config.targetBoxes.right;

    const event: AssaultPunchEvent = {
      inputId: this._generateInputId(hand),
      hand,
      targetSide: hand,
      rawTimestampMs: timestampMs,
      compensatedTimestampMs,
      activeTimestampSeconds: options.activeSeconds,
      reachRatio: this._config.punchReachRatio,
      elbowAngleDeg: this._config.elbowExtensionAngleDeg,
      wristPoint: {
        x: (targetBox.xMin + targetBox.xMax) / 2,
        y: (targetBox.yMin + targetBox.yMax) / 2,
      },
      targetBox,
      pairId: options.pairId,
    };

    if (hand === 'left') {
      this._leftState = 'EXTENDED';
      this._leftSnapshot = {
        state: 'EXTENDED',
        reachRatio: this._config.punchReachRatio,
        inTargetBox: true,
        elbowAngleDeg: this._config.elbowExtensionAngleDeg,
      };
    } else {
      this._rightState = 'EXTENDED';
      this._rightSnapshot = {
        state: 'EXTENDED',
        reachRatio: this._config.punchReachRatio,
        inTargetBox: true,
        elbowAngleDeg: this._config.elbowExtensionAngleDeg,
      };
    }

    for (const listener of this._listeners) {
      try {
        listener(event);
      } catch (err) {
        console.error('[AssaultPunchAdapter] Listener error:', err);
      }
    }

    return event;
  }

  /**
   * 카메라 Fallback 키 해제 (회수 완료 처리)
   */
  public releaseFallbackPunch(hand: AssaultHand): void {
    if (hand === 'left') {
      this._leftState = 'READY';
      this._leftSnapshot = {
        state: 'READY',
        reachRatio: this._config.punchRetractRatio,
        inTargetBox: false,
      };
    } else {
      this._rightState = 'READY';
      this._rightSnapshot = {
        state: 'READY',
        reachRatio: this._config.punchRetractRatio,
        inTargetBox: false,
      };
    }
  }

  // ─── 내부 기하 및 상태 머신 평가 로직 ───

  private _determineTrackingLost(input: AssaultPunchFrameInput): boolean {
    if (input.isTrackingLost === true) {
      return true;
    }

    if (input.landmarks !== undefined) {
      if (!input.landmarks || input.landmarks.length < 33) {
        return true;
      }
      const lWrist = input.landmarks[POSE_LANDMARKS.LEFT_WRIST];
      const rWrist = input.landmarks[POSE_LANDMARKS.RIGHT_WRIST];
      const lVis = lWrist?.visibility ?? 0;
      const rVis = rWrist?.visibility ?? 0;
      if (lVis < this._minVisibility && rVis < this._minVisibility) {
        return true;
      }
    }

    return false;
  }

  private _extractHands(input: AssaultPunchFrameInput): {
    leftHand?: AssaultPunchHandInput;
    rightHand?: AssaultPunchHandInput;
    shoulderWidth: number;
  } {
    let leftHand = input.leftHand;
    let rightHand = input.rightHand;
    let shoulderWidth = DEFAULT_SHOULDER_WIDTH_FALLBACK;

    if (input.landmarks && input.landmarks.length >= 33) {
      const lm = input.landmarks;
      const lShoulder = lm[POSE_LANDMARKS.LEFT_SHOULDER];
      const rShoulder = lm[POSE_LANDMARKS.RIGHT_SHOULDER];
      const lElbow = lm[POSE_LANDMARKS.LEFT_ELBOW];
      const rElbow = lm[POSE_LANDMARKS.RIGHT_ELBOW];
      const lWrist = lm[POSE_LANDMARKS.LEFT_WRIST];
      const rWrist = lm[POSE_LANDMARKS.RIGHT_WRIST];

      shoulderWidth = calcShoulderWidth(lShoulder, rShoulder);

      if (!leftHand && (lWrist.visibility ?? 1) >= this._minVisibility) {
        leftHand = {
          wrist: { x: lWrist.x, y: lWrist.y },
          elbow: (lElbow.visibility ?? 1) >= this._minVisibility ? { x: lElbow.x, y: lElbow.y } : undefined,
          shoulder: (lShoulder.visibility ?? 1) >= this._minVisibility ? { x: lShoulder.x, y: lShoulder.y } : undefined,
          visibility: lWrist.visibility,
        };
      }

      if (!rightHand && (rWrist.visibility ?? 1) >= this._minVisibility) {
        rightHand = {
          wrist: { x: rWrist.x, y: rWrist.y },
          elbow: (rElbow.visibility ?? 1) >= this._minVisibility ? { x: rElbow.x, y: rElbow.y } : undefined,
          shoulder: (rShoulder.visibility ?? 1) >= this._minVisibility ? { x: rShoulder.x, y: rShoulder.y } : undefined,
          visibility: rWrist.visibility,
        };
      }
    } else if (leftHand?.shoulder && rightHand?.shoulder) {
      shoulderWidth = calcShoulderWidth(leftHand.shoulder, rightHand.shoulder);
    }

    return { leftHand, rightHand, shoulderWidth };
  }

  private _evaluateHand(params: {
    hand: AssaultHand;
    handInput?: AssaultPunchHandInput;
    shoulderWidth: number;
    targetBox: AssaultTargetBox;
    timestampMs: number;
    activeSeconds?: number;
    pairId?: PairId;
    justRecovered: boolean;
  }): AssaultPunchEvent | null {
    const {
      hand,
      handInput,
      shoulderWidth,
      targetBox,
      timestampMs,
      activeSeconds,
      pairId,
      justRecovered,
    } = params;

    if (!handInput) {
      return null;
    }

    const { wrist, elbow, shoulder } = handInput;

    // 1. 손목-어깨 거리 및 도달 비율(reachRatio) 산출
    let reachDistance = 0;
    if (shoulder) {
      reachDistance = calcDistance(wrist, shoulder);
    } else {
      // shoulder 부재 시 손목 y좌표 기준으로 대략 추정하지 않고 targetBox 기반 fallback
      reachDistance = shoulderWidth * this._config.punchReachRatio;
    }
    const reachRatio = reachDistance / shoulderWidth;

    // 2. 팔꿈치 각도 산출 (shoulder, elbow, wrist 모두 존재 시)
    let elbowAngleDeg: number | undefined;
    if (shoulder && elbow) {
      elbowAngleDeg = calcJointAngle(shoulder, elbow, wrist, true);
    }

    // 3. 타깃 박스 진입 여부 판정 (DEC-A4: 같은 쪽 박스만 검사)
    const inTargetBox =
      wrist.x >= targetBox.xMin &&
      wrist.x <= targetBox.xMax &&
      wrist.y >= targetBox.yMin &&
      wrist.y <= targetBox.yMax;

    // 4. 팔 신전 만족 여부 검사 (DEC-A3: 타깃 박스 + 도달 비율 + 팔꿈치 각도)
    const isReachSatisfied = reachRatio >= this._config.punchReachRatio;
    const isAngleSatisfied =
      elbowAngleDeg === undefined || elbowAngleDeg >= this._config.elbowExtensionAngleDeg;
    const isFullyExtended = inTargetBox && isReachSatisfied && isAngleSatisfied;

    // 5. 회수 만족 여부 검사 (punchRetractRatio 이하)
    const isRetracted = reachRatio <= this._config.punchRetractRatio;

    let currentState = hand === 'left' ? this._leftState : this._rightState;
    let eventToEmit: AssaultPunchEvent | null = null;

    // 6. 추적 복구 직후 가짜 타격 방지 (A10, A19)
    if (justRecovered) {
      if (isRetracted) {
        currentState = 'READY';
      } else {
        // 이미 뻗어있는 상태로 복구된 경우, 타격을 발화하지 않고 회수를 대기하도록 강제
        currentState = 'EXTENDED';
      }
    } else {
      // 7. 상태 머신 전이
      switch (currentState) {
        case 'IDLE': {
          if (isRetracted) {
            currentState = 'READY';
          } else if (isFullyExtended) {
            // 처음부터 뻗은 상태면 타격 없이 회수 대기
            currentState = 'EXTENDED';
          }
          break;
        }

        case 'READY': {
          if (isFullyExtended) {
            // 타격 진입: 이벤트 1회 발화 후 EXTENDED로 전이
            currentState = 'EXTENDED';
            const compensatedTimestampMs = Math.max(0, timestampMs - this._config.inputLatencyMs);

            eventToEmit = {
              inputId: this._generateInputId(hand),
              hand,
              targetSide: hand,
              rawTimestampMs: timestampMs,
              compensatedTimestampMs,
              activeTimestampSeconds: activeSeconds,
              reachRatio,
              elbowAngleDeg,
              wristPoint: { x: wrist.x, y: wrist.y },
              targetBox,
              pairId,
            };
          }
          break;
        }

        case 'EXTENDED': {
          // 손을 뻗은 채 머무름, 타깃 박스 경계 떨림, pair 변경 시에는 계속 EXTENDED 유지 (추가 발화 0회)
          if (isRetracted) {
            currentState = 'READY'; // 회수 완료 확인 시 READY로 복귀
          }
          break;
        }

        case 'RETRACTED': {
          currentState = 'READY';
          break;
        }
      }
    }

    // 상태 및 스냅샷 갱신
    if (hand === 'left') {
      this._leftState = currentState;
      this._leftSnapshot = {
        state: currentState,
        reachRatio,
        inTargetBox,
        elbowAngleDeg,
      };
    } else {
      this._rightState = currentState;
      this._rightSnapshot = {
        state: currentState,
        reachRatio,
        inTargetBox,
        elbowAngleDeg,
      };
    }

    return eventToEmit;
  }

  private _generateInputId(hand: AssaultHand): InputId {
    AssaultPunchAdapter._globalInputCounter += 1;
    return `${this._idPrefix}_${hand}_${AssaultPunchAdapter._globalInputCounter}`;
  }
}
