/**
 * MotionIntentBus.ts - 원시 포즈 랜드마크 → MotionIntent 단일 분류 및 페이즈별 동작 소유권·통합 불응기 버스
 *
 * - 원시 랜드마크(Pose)를 받아 { type, confidence, timestamp, sourceCursor } 형태의 의도(Intent) 단일 분류
 * - 페이즈별 동작 소유권 테이블(PHASE_INTENT_OWNERSHIP)에 따른 비소유 동작 원천 필터링
 * - 판정 확정 후 통합 불응기(Refractory, 0.25s) 동안 후속 intent 소비 차단 (페이즈 전환 시 즉시 리셋)
 * - 결정적(Deterministic) 분류 및 publish/subscribe 이벤트 라우팅
 * - 버스 미주입 시 기존 소비자들은 100% 독립 정상 동작(Pure Fallback)
 *
 * @see Issue #252 [INPUT-TOLERANCE-004]
 */

import type { NormalizedLandmark } from '../types/index.js';
import { POSE_LANDMARKS } from '../types/index.js';
import type {
  MotionIntent,
  MotionIntentType,
  MotionIntentListener,
  UnsubscribeFn,
} from '../types/motion-intent.js';
import {
  DEFAULT_MOTION_INTENT_BUS_CONFIG,
  type MotionIntentBusConfig,
} from '../../config/judgment.config.js';

export interface MotionIntentClassificationOptions {
  /** 캘리브레이션된 어깨/신체 기준선 Y */
  baselineY?: number;
  /** 가상 뷰포트 높이 (픽셀 단위일 경우 스케일링용) */
  virtualHeight?: number;
  /** 이전 프레임 랜드마크 (외부에서 명시적으로 주입 시 결정적 순수 함수 동작) */
  prevLandmarks?: readonly NormalizedLandmark[] | null;
  /** 일시정지 여부 */
  isPaused?: boolean;
}

export class MotionIntentBus {
  private readonly _config: MotionIntentBusConfig;
  private _currentPhase: string;
  private _refractoryUntil = -1;

  private _prevShoulderY = -1;
  private _prevLandmarks: NormalizedLandmark[] | null = null;

  private readonly _listeners = new Set<MotionIntentListener>();
  private readonly _typeListeners = new Map<string, Set<MotionIntentListener>>();

  constructor(
    config?: Partial<MotionIntentBusConfig>,
    initialPhase: string = 'default',
  ) {
    this._config = {
      ...DEFAULT_MOTION_INTENT_BUS_CONFIG,
      ...config,
      ownership: {
        ...DEFAULT_MOTION_INTENT_BUS_CONFIG.ownership,
        ...config?.ownership,
      },
    };
    this._currentPhase = initialPhase;
  }

  /**
   * 현재 활성 페이즈
   */
  get phase(): string {
    return this._currentPhase;
  }

  get currentPhase(): string {
    return this._currentPhase;
  }

  /**
   * 최근 처리된 랜드마크 프레임
   */
  get prevLandmarks(): readonly NormalizedLandmark[] | null {
    return this._prevLandmarks;
  }

  /**
   * 버스 설정 반환 (읽기 전용)
   */
  get config(): Readonly<MotionIntentBusConfig> {
    return this._config;
  }

  /**
   * 페이즈 전환 (페이즈 변경 시 불응기는 즉시 리셋된다)
   */
  setPhase(phase: string): void {
    if (this._currentPhase !== phase) {
      this._currentPhase = phase;
      this.resetRefractory();
    }
  }

  /**
   * 판정 확정 후 통합 불응기(Refractory Lockout) 발동
   * @param timestamp 확정 시점 타임스탬프 (초 단위, 미제공 시 현재 시각)
   */
  triggerRefractory(timestamp?: number): void {
    const now =
      timestamp !== undefined
        ? timestamp
        : typeof performance !== 'undefined'
          ? performance.now() / 1000
          : Date.now() / 1000;
    this._refractoryUntil = now + this._config.refractoryTime;
  }

  /**
   * 불응기 즉시 해제/리셋
   */
  resetRefractory(): void {
    this._refractoryUntil = -1;
  }

  /**
   * 주어진 시점에서 불응기가 활성화되어 있는지 확인
   */
  isRefractoryActive(timestamp?: number): boolean {
    if (this._refractoryUntil < 0) return false;
    const now =
      timestamp !== undefined
        ? timestamp
        : typeof performance !== 'undefined'
          ? performance.now() / 1000
          : Date.now() / 1000;
    return now < this._refractoryUntil;
  }

  /**
   * 대상 페이즈에서 특정 intent 타입이 소유권(허용)되어 있는지 확인
   */
  isIntentAllowedInPhase(
    type: MotionIntentType,
    phase: string = this._currentPhase,
  ): boolean {
    const allowed =
      this._config.ownership[phase] ?? this._config.ownership['default'] ?? [];
    return allowed.includes(type);
  }

  /**
   * 원시 랜드마크로부터 신체 동작 의도(MotionIntent)들을 순수/결정적으로 분류
   */
  classify(
    landmarks: readonly NormalizedLandmark[] | null | undefined,
    dt: number,
    timestamp: number,
    options?: MotionIntentClassificationOptions,
  ): MotionIntent[] {
    if (!landmarks || landmarks.length < 25 || options?.isPaused) {
      return [];
    }

    const intents: MotionIntent[] = [];
    const minVis = 0.3;

    // 1. 점프 (Jump) 의도 분류: 어깨 상승 수직 속도
    const leftShoulder = landmarks[POSE_LANDMARKS.LEFT_SHOULDER];
    const rightShoulder = landmarks[POSE_LANDMARKS.RIGHT_SHOULDER];

    if (
      leftShoulder &&
      rightShoulder &&
      leftShoulder.visibility >= minVis &&
      rightShoulder.visibility >= minVis
    ) {
      const currShoulderY = (leftShoulder.y + rightShoulder.y) / 2;
      const prevShoulderY = options?.prevLandmarks
        ? (options.prevLandmarks[POSE_LANDMARKS.LEFT_SHOULDER].y +
            options.prevLandmarks[POSE_LANDMARKS.RIGHT_SHOULDER].y) /
          2
        : this._prevShoulderY;

      if (prevShoulderY >= 0 && dt > 1e-5) {
        // 정규화 좌표계: 위로 이동할수록 Y 감소 -> (prev - curr) > 0이 상승
        const isVirtual = currShoulderY > 1.0;
        const vh = options?.virtualHeight && options.virtualHeight > 1 ? options.virtualHeight : (isVirtual ? 2160 : 1.0);
        const normDy = (prevShoulderY - currShoulderY) / (isVirtual ? vh : 1.0);
        const upwardSpeed = normDy / dt;

        if (upwardSpeed >= this._config.jumpVerticalSpeedThreshold) {
          const confidence = Number(
            Math.min(
              1.0,
              Math.max(
                0.5,
                upwardSpeed / (this._config.jumpVerticalSpeedThreshold * 1.5),
              ),
            ).toFixed(4),
          );
          intents.push({
            type: 'jump',
            confidence,
            timestamp,
            sourceCursor: 'body',
            payload: {
              upwardSpeed,
              threshold: this._config.jumpVerticalSpeedThreshold,
            },
          });
        }
      }
    }

    // 2. 팔 뻗기 (reachLeft / reachRight) 의도 분류
    const leftWrist = landmarks[POSE_LANDMARKS.LEFT_WRIST];
    const rightWrist = landmarks[POSE_LANDMARKS.RIGHT_WRIST];

    // Left reach: 좌측 영역 (x <= 0.35)
    if (leftWrist && leftWrist.visibility >= minVis && leftWrist.x <= 0.35) {
      const confidence = Number(
        Math.min(1.0, Math.max(0.5, (0.5 - leftWrist.x) / 0.35)).toFixed(4),
      );
      intents.push({
        type: 'reachLeft',
        confidence,
        timestamp,
        sourceCursor: 'left_hand',
        payload: { x: leftWrist.x, y: leftWrist.y },
      });
    } else if (
      rightWrist &&
      rightWrist.visibility >= minVis &&
      rightWrist.x <= 0.35
    ) {
      const confidence = Number(
        Math.min(1.0, Math.max(0.5, (0.5 - rightWrist.x) / 0.35)).toFixed(4),
      );
      intents.push({
        type: 'reachLeft',
        confidence,
        timestamp,
        sourceCursor: 'right_hand',
        payload: { x: rightWrist.x, y: rightWrist.y },
      });
    }

    // Right reach: 우측 영역 (x >= 0.65)
    if (rightWrist && rightWrist.visibility >= minVis && rightWrist.x >= 0.65) {
      const confidence = Number(
        Math.min(1.0, Math.max(0.5, (rightWrist.x - 0.5) / 0.35)).toFixed(4),
      );
      intents.push({
        type: 'reachRight',
        confidence,
        timestamp,
        sourceCursor: 'right_hand',
        payload: { x: rightWrist.x, y: rightWrist.y },
      });
    } else if (
      leftWrist &&
      leftWrist.visibility >= minVis &&
      leftWrist.x >= 0.65
    ) {
      const confidence = Number(
        Math.min(1.0, Math.max(0.5, (leftWrist.x - 0.5) / 0.35)).toFixed(4),
      );
      intents.push({
        type: 'reachRight',
        confidence,
        timestamp,
        sourceCursor: 'left_hand',
        payload: { x: leftWrist.x, y: leftWrist.y },
      });
    }

    // 3. 발 스텝 (stepLeft / stepRight) 의도 분류
    const leftHip = landmarks[POSE_LANDMARKS.LEFT_HIP];
    const rightHip = landmarks[POSE_LANDMARKS.RIGHT_HIP];
    const leftKnee = landmarks[POSE_LANDMARKS.LEFT_KNEE];
    const rightKnee = landmarks[POSE_LANDMARKS.RIGHT_KNEE];
    const stepThresh = this._config.stepThreshold ?? 0.04;

    if (
      leftKnee &&
      leftHip &&
      leftKnee.visibility >= minVis &&
      leftHip.visibility >= minVis
    ) {
      if (leftKnee.x < leftHip.x - stepThresh) {
        intents.push({
          type: 'stepLeft',
          confidence: 0.85,
          timestamp,
          sourceCursor: 'left_foot',
        });
      }
    }

    if (
      rightKnee &&
      rightHip &&
      rightKnee.visibility >= minVis &&
      rightHip.visibility >= minVis
    ) {
      if (rightKnee.x > rightHip.x + stepThresh) {
        intents.push({
          type: 'stepRight',
          confidence: 0.85,
          timestamp,
          sourceCursor: 'right_foot',
        });
      }
    }

    // 4. 스쿼트 (Squat) 의도 분류
    if (
      options?.baselineY &&
      leftHip &&
      rightHip &&
      leftHip.visibility >= minVis &&
      rightHip.visibility >= minVis
    ) {
      const currHipY = (leftHip.y + rightHip.y) / 2;
      const squatThresh = this._config.squatThreshold ?? 0.065;
      if (currHipY - options.baselineY >= squatThresh) {
        intents.push({
          type: 'squat',
          confidence: 0.85,
          timestamp,
          sourceCursor: 'body',
        });
      }
    }

    return intents;
  }

  /**
   * 생성된 의도(Intent)를 검사하고, 불응기 및 페이즈 소유권 통과 시 구독자에게 발행
   * @returns 발행 및 소비 허용 여부 (불응기 또는 미소유 페이즈 시 false)
   */
  publish(intent: MotionIntent): boolean {
    const timestamp =
      intent.timestamp !== undefined
        ? intent.timestamp
        : typeof performance !== 'undefined'
          ? performance.now() / 1000
          : Date.now() / 1000;

    // 1. 전역 불응기 락아웃 검사
    if (this.isRefractoryActive(timestamp)) {
      return false;
    }

    // 2. 페이즈 동작 소유권 검사
    if (!this.isIntentAllowedInPhase(intent.type, this._currentPhase)) {
      return false;
    }

    // 3. 통과 시 구독자 통지
    this._listeners.forEach((listener) => {
      try {
        listener(intent);
      } catch (err) {
        console.error('[MotionIntentBus] Listener error:', err);
      }
    });

    const typedSet = this._typeListeners.get(intent.type);
    if (typedSet) {
      typedSet.forEach((listener) => {
        try {
          listener(intent);
        } catch (err) {
          console.error('[MotionIntentBus] Typed listener error:', err);
        }
      });
    }

    return true;
  }

  /**
   * 매 프레임 원시 랜드마크를 분류하고 허용된 intent를 순서대로 발행
   * @returns 발행(통과)된 intent 목록
   */
  processLandmarks(
    landmarks: readonly NormalizedLandmark[] | null | undefined,
    dt: number,
    timestamp: number,
    options?: MotionIntentClassificationOptions,
  ): MotionIntent[] {
    const candidates = this.classify(landmarks, dt, timestamp, options);
    const published: MotionIntent[] = [];

    for (const intent of candidates) {
      if (this.publish(intent)) {
        published.push(intent);
      }
    }

    // 내부 추적 상태 갱신
    if (
      landmarks &&
      landmarks[POSE_LANDMARKS.LEFT_SHOULDER] &&
      landmarks[POSE_LANDMARKS.RIGHT_SHOULDER]
    ) {
      this._prevShoulderY =
        (landmarks[POSE_LANDMARKS.LEFT_SHOULDER].y +
          landmarks[POSE_LANDMARKS.RIGHT_SHOULDER].y) /
        2;
      this._prevLandmarks = [...landmarks];
    }

    return published;
  }

  /**
   * Intent 수신 구독
   */
  subscribe(listener: MotionIntentListener): UnsubscribeFn;
  subscribe(
    typeOrPhase: MotionIntentType | string,
    listener: MotionIntentListener,
  ): UnsubscribeFn;
  subscribe(
    arg1: MotionIntentType | string | MotionIntentListener,
    arg2?: MotionIntentListener,
  ): UnsubscribeFn {
    if (typeof arg1 === 'function') {
      this._listeners.add(arg1);
      return () => {
        this._listeners.delete(arg1);
      };
    }

    if (typeof arg2 === 'function') {
      const key = String(arg1);
      if (!this._typeListeners.has(key)) {
        this._typeListeners.set(key, new Set());
      }
      const set = this._typeListeners.get(key)!;
      set.add(arg2);
      return () => {
        set.delete(arg2);
      };
    }

    return () => {};
  }

  /**
   * 내부 상태 및 추적 랜드마크 초기화
   */
  reset(): void {
    this._refractoryUntil = -1;
    this._prevShoulderY = -1;
    this._prevLandmarks = null;
  }

  /**
   * 모든 리스너 제거
   */
  clearListeners(): void {
    this._listeners.clear();
    this._typeListeners.clear();
  }
}
