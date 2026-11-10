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
import type { PoseFrame } from '../types/pose-frame.js';
import { diffAngle } from '../skeleton/pose/angleMath.js';
import {
  armPoseFromPoints,
  createStrokeHandMemory,
  evaluateStrokeHand,
  type StickmanArmPose,
  type StrokeHandMemory,
} from './StickmanPunchStroke.js';

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
  readonly poseFrame?: PoseFrame | null;
}

/** 미리 뻗고 멈춤 감지 이벤트 (#726) */
export interface AssaultPreExtendedHoldEvent {
  readonly hand: AssaultHand;
  readonly side: AssaultHand;
  readonly timestampMs: number;
  readonly holdMs: number;
  readonly pairId?: PairId;
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

  private _leftState: HandPunchState = 'IDLE';
  private _rightState: HandPunchState = 'IDLE';
  private _isTrackingLost = false;
  private _wasLeftTrackingLost = false;
  private _wasRightTrackingLost = false;

  private _leftStroke: StrokeHandMemory = createStrokeHandMemory();
  private _rightStroke: StrokeHandMemory = createStrokeHandMemory();

  private _leftSnapshot: AssaultHandSnapshot = {
    state: 'IDLE',
    reachRatio: 0,
    inTargetBox: false,
  };
  private _rightSnapshot: AssaultHandSnapshot = {
    state: 'IDLE',
    reachRatio: 0,
    inTargetBox: false,
  };

  private static _globalInputCounter = 0;
  private readonly _listeners = new Set<(event: AssaultPunchEvent) => void>();
  private readonly _preExtendedHoldListeners = new Set<(event: AssaultPreExtendedHoldEvent) => void>();

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
   * 미리 뻗고 멈춤 감지 리스너 등록 (#726)
   * @returns 리스너 해제(unsubscribe) 함수
   */
  public onPreExtendedHold(listener: (event: AssaultPreExtendedHoldEvent) => void): () => void {
    this._preExtendedHoldListeners.add(listener);
    return () => {
      this._preExtendedHoldListeners.delete(listener);
    };
  }

  private _notifyPreExtendedHold(event: AssaultPreExtendedHoldEvent): void {
    for (const listener of this._preExtendedHoldListeners) {
      try {
        listener(event);
      } catch (err) {
        console.error('[AssaultPunchAdapter] onPreExtendedHold listener error:', err);
      }
    }
  }

  /**
   * 상태 초기화 (세션 재시작/재준비)
   * 기존 inputId 채번 카운터는 유지하여 중복 방지 보장.
   */
  public reset(): void {
    this._leftState = 'IDLE';
    this._rightState = 'IDLE';
    this._leftStroke = createStrokeHandMemory();
    this._rightStroke = createStrokeHandMemory();
    this._isTrackingLost = false;
    this._wasLeftTrackingLost = false;
    this._wasRightTrackingLost = false;
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
      this._wasLeftTrackingLost = true;
      this._wasRightTrackingLost = true;
      return [];
    }

    // 2. 좌우 손 정보 추출
    const { leftHand, rightHand, shoulderWidth } = this._extractHands(input);

    // 3. 손별 추적 상태 및 복구 판정
    let leftJustRecovered = false;
    let rightJustRecovered = false;

    if (input.landmarks !== undefined && input.landmarks && input.landmarks.length >= 33) {
      const lm = input.landmarks as readonly NormalizedLandmark[];
      const lWrist = lm[POSE_LANDMARKS.LEFT_WRIST];
      const rWrist = lm[POSE_LANDMARKS.RIGHT_WRIST];
      const lVis = lWrist?.visibility ?? 0;
      const rVis = rWrist?.visibility ?? 0;

      if (lVis < this._minVisibility) {
        this._wasLeftTrackingLost = true;
      } else {
        leftJustRecovered = this._wasLeftTrackingLost;
        this._wasLeftTrackingLost = false;
      }

      if (rVis < this._minVisibility) {
        this._wasRightTrackingLost = true;
      } else {
        rightJustRecovered = this._wasRightTrackingLost;
        this._wasRightTrackingLost = false;
      }

      this._isTrackingLost = lVis < this._minVisibility && rVis < this._minVisibility;
    } else {
      if (input.leftHand) {
        if ((input.leftHand.visibility ?? 1) < this._minVisibility) {
          this._wasLeftTrackingLost = true;
        } else {
          leftJustRecovered = this._wasLeftTrackingLost;
          this._wasLeftTrackingLost = false;
        }
      }
      if (input.rightHand) {
        if ((input.rightHand.visibility ?? 1) < this._minVisibility) {
          this._wasRightTrackingLost = true;
        } else {
          rightJustRecovered = this._wasRightTrackingLost;
          this._wasRightTrackingLost = false;
        }
      }
      this._isTrackingLost = false;
    }

    const emittedEvents: AssaultPunchEvent[] = [];

    // 4. 왼손 상태 머신 평가 (DEC-A4: left hand -> left box)
    const leftEvent = this._evaluateHand({
      hand: 'left',
      handInput: leftHand,
      shoulderWidth,
      targetBox: this._config.targetBoxes.left,
      timestampMs,
      activeSeconds,
      pairId,
      justRecovered: leftJustRecovered,
      poseFrame: input.poseFrame,
    });
    if (leftEvent) {
      emittedEvents.push(leftEvent);
    }

    // 5. 오른손 상태 머신 평가 (DEC-A4: right hand -> right box)
    const rightEvent = this._evaluateHand({
      hand: 'right',
      handInput: rightHand,
      shoulderWidth,
      targetBox: this._config.targetBoxes.right,
      timestampMs,
      activeSeconds,
      pairId,
      justRecovered: rightJustRecovered,
      poseFrame: input.poseFrame,
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
      const lm = input.landmarks as readonly NormalizedLandmark[];
      const lWrist = lm[POSE_LANDMARKS.LEFT_WRIST];
      const rWrist = lm[POSE_LANDMARKS.RIGHT_WRIST];
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
      const lm = input.landmarks as readonly NormalizedLandmark[];
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
    poseFrame?: PoseFrame | null;
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
      poseFrame,
    } = params;

    // ─── legacy_box 모드: 기존 사각 박스 접촉 기반 판정 ───
    if (this._config.punchDetectionMode === 'legacy_box') {
      if (!handInput) {
        if (hand === 'left') {
          this._wasLeftTrackingLost = true;
        } else {
          this._wasRightTrackingLost = true;
        }
        return null;
      }

      const { wrist, elbow, shoulder } = handInput;

      // 1. 손목-어깨 거리 및 도달 비율(reachRatio) 산출
      let reachDistance = 0;
      let reachRatio = 0;
      if (shoulder) {
        reachDistance = calcDistance(wrist, shoulder);
        reachRatio = reachDistance / shoulderWidth;
      }

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
      // 어깨나 팔꿈치가 없거나 visibility 부족 시 신전 판정을 하지 않음 (타격 0, 상태 유지/보류)
      const hasRequiredJoints = Boolean(shoulder && elbow);
      const isReachSatisfied = hasRequiredJoints && reachRatio >= this._config.punchReachRatio;
      const isAngleSatisfied =
        hasRequiredJoints &&
        elbowAngleDeg !== undefined &&
        elbowAngleDeg >= this._config.elbowExtensionAngleDeg;
      const isFullyExtended = inTargetBox && isReachSatisfied && isAngleSatisfied;

      // 5. 회수 만족 여부 검사 (DEC-A3, #722: 회수 임계치 이하 도달 또는 타깃 박스 하단 바깥 가슴 대기 시 복귀)
      // 어깨가 존재할 때만 회수 판정 유효
      const isRetracted =
        Boolean(shoulder) &&
        (reachRatio <= this._config.punchRetractRatio || wrist.y > targetBox.yMax);

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
              // [BUG-ASSAULT-PUNCH-001 / #722] IDLE 상태에서 즉시 완전 신전 시 1회 타격 발화 후 EXTENDED로 전이
              currentState = 'EXTENDED';
              eventToEmit = this._buildPunchEvent({
                hand,
                timestampMs,
                activeSeconds,
                reachRatio,
                elbowAngleDeg,
                wristPoint: { x: wrist.x, y: wrist.y },
                targetBox,
                pairId,
              });
            }
            break;
          }

          case 'READY': {
            if (isFullyExtended) {
              // 타격 진입: 이벤트 1회 발화 후 EXTENDED로 전이
              currentState = 'EXTENDED';
              eventToEmit = this._buildPunchEvent({
                hand,
                timestampMs,
                activeSeconds,
                reachRatio,
                elbowAngleDeg,
                wristPoint: { x: wrist.x, y: wrist.y },
                targetBox,
                pairId,
              });
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

    // ─── stickman_stroke 모드 (#726) ───
    if (!handInput && (!poseFrame || !poseFrame.hasPose)) {
      if (hand === 'left') {
        this._wasLeftTrackingLost = true;
      } else {
        this._wasRightTrackingLost = true;
      }
      return null;
    }

    let pose: StickmanArmPose | null = null;
    if (poseFrame && poseFrame.hasPose) {
      const boneAngles = poseFrame.boneAngles;
      const upperArm = hand === 'left' ? boneAngles?.leftUpperArm : boneAngles?.rightUpperArm;
      const forearm = hand === 'left' ? boneAngles?.leftForearm : boneAngles?.rightForearm;
      const confidence =
        hand === 'left'
          ? (poseFrame.armConfidence?.left ?? 1)
          : (poseFrame.armConfidence?.right ?? 1);
      if (upperArm !== undefined && forearm !== undefined) {
        pose = { upperArm, forearm, confidence };
      }
    } else if (handInput && handInput.shoulder && handInput.elbow && handInput.wrist) {
      pose = armPoseFromPoints(
        handInput.shoulder,
        handInput.elbow,
        handInput.wrist,
        handInput.visibility,
      );
    }

    if (!pose) {
      // shoulder 또는 elbow가 없으면 해당 손은 이번 프레임 판정 보류 (상태 변화 없음)
      return null;
    }

    const strokeMem = hand === 'left' ? this._leftStroke : this._rightStroke;
    const res = evaluateStrokeHand({
      memory: strokeMem,
      hand,
      pose,
      timestampMs,
      justRecovered,
      cfg: this._config,
    });

    if (hand === 'left') {
      this._leftStroke = res.memory;
      this._leftState = res.memory.state;
    } else {
      this._rightStroke = res.memory;
      this._rightState = res.memory.state;
    }

    if (res.holdReached) {
      this._notifyPreExtendedHold({
        hand,
        side: res.reach?.side ?? hand,
        timestampMs,
        holdMs: res.memory.holdMs,
        pairId,
      });
    }

    const angleDiffRad = Math.abs(diffAngle(pose.forearm, pose.upperArm));
    const elbowAngleDeg = 180 - (angleDiffRad * 180) / Math.PI;
    const wristPoint: Point2D = handInput?.wrist ?? { x: 0.5, y: 0.5 };

    if (hand === 'left') {
      this._leftSnapshot = {
        state: res.memory.state,
        reachRatio: res.reach?.extension ?? 0,
        inTargetBox: res.reach?.directionValid ?? false,
        elbowAngleDeg,
      };
    } else {
      this._rightSnapshot = {
        state: res.memory.state,
        reachRatio: res.reach?.extension ?? 0,
        inTargetBox: res.reach?.directionValid ?? false,
        elbowAngleDeg,
      };
    }

    if (res.fire) {
      return this._buildPunchEvent({
        hand,
        targetSide: hand,
        timestampMs,
        activeSeconds,
        reachRatio: res.reach?.extension ?? 1.0,
        elbowAngleDeg,
        wristPoint,
        targetBox,
        pairId,
      });
    }

    return null;
  }

  private _buildPunchEvent(params: {
    hand: AssaultHand;
    targetSide?: AssaultHand;
    timestampMs: number;
    activeSeconds?: number;
    reachRatio: number;
    elbowAngleDeg?: number;
    wristPoint: Point2D;
    targetBox: AssaultTargetBox;
    pairId?: PairId;
  }): AssaultPunchEvent {
    const compensatedTimestampMs = Math.max(0, params.timestampMs - this._config.inputLatencyMs);
    return {
      inputId: this._generateInputId(params.hand),
      hand: params.hand,
      targetSide: params.targetSide ?? params.hand,
      rawTimestampMs: params.timestampMs,
      compensatedTimestampMs,
      activeTimestampSeconds: params.activeSeconds,
      reachRatio: params.reachRatio,
      elbowAngleDeg: params.elbowAngleDeg,
      wristPoint: params.wristPoint,
      targetBox: params.targetBox,
      pairId: params.pairId,
    };
  }

  private _generateInputId(hand: AssaultHand): InputId {
    AssaultPunchAdapter._globalInputCounter += 1;
    return `${this._idPrefix}_${hand}_${AssaultPunchAdapter._globalInputCounter}`;
  }
}
