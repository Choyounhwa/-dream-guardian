/**
 * HandsManager - MediaPipe Hands 손바닥 추적 및 Pose 손목 Fallback
 *
 * 양손 손바닥 중심점(Landmark 9) 정밀 트래킹
 * Hands 인식 실패 시 Pose 손목(wrist) 좌표로 자동 대체
 * 최대 180ms 캐시 후 손실 시 폴백 처리
 *
 * @see Issue #10 (GitHub #75)
 */

import type { NormalizedLandmark } from '../types/index.js';
import { POSE_LANDMARKS } from '../types/index.js';

/** 손 캐시 만료 시간 (ms) */
const HAND_CACHE_TIMEOUT_MS = 180;

/** MediaPipe Hands 손바닥 중심 랜드마크 인덱스 */
const PALM_CENTER_INDEX = 9;

export interface HandPosition {
  x: number;
  y: number;
  source: 'hands' | 'pose';
  confidence: number;
}

export interface HandsManagerOptions {
  /** 가상 뷰포트 너비 */
  virtualWidth?: number;
  /** 가상 뷰포트 높이 */
  virtualHeight?: number;
  /** 캐시 타임아웃 (ms) */
  cacheTimeout?: number;
}

export type HandsStatus = 'idle' | 'loading' | 'ready' | 'error';

export class HandsManager {
  private _status: HandsStatus = 'idle';
  private _virtualWidth: number;
  private _virtualHeight: number;
  private _cacheTimeout: number;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private _hands: any = null;

  /** 왼손/오른손 Hands 데이터 (정규화 0~1) */
  private _leftHandRaw: NormalizedLandmark | null = null;
  private _rightHandRaw: NormalizedLandmark | null = null;
  private _leftHandTime = 0;
  private _rightHandTime = 0;

  /** 최종 출력 위치 (가상 좌표) */
  private _leftPosition: HandPosition | null = null;
  private _rightPosition: HandPosition | null = null;

  constructor(options?: HandsManagerOptions) {
    this._virtualWidth = options?.virtualWidth ?? 1920;
    this._virtualHeight = options?.virtualHeight ?? 1080;
    this._cacheTimeout = options?.cacheTimeout ?? HAND_CACHE_TIMEOUT_MS;
  }

  get status(): HandsStatus {
    return this._status;
  }

  /** 왼손 위치 (가상 좌표) */
  get leftHand(): HandPosition | null {
    return this._leftPosition;
  }

  /** 오른손 위치 (가상 좌표) */
  get rightHand(): HandPosition | null {
    return this._rightPosition;
  }

  /**
   * MediaPipe Hands 모델 초기화
   */
  async init(): Promise<boolean> {
    this._status = 'loading';

    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const HandsClass = (globalThis as any).Hands;
      if (!HandsClass) {
        console.warn('[HandsManager] MediaPipe Hands가 로드되지 않음');
        this._status = 'error';
        return false;
      }

      this._hands = new HandsClass({
        locateFile: (file: string) =>
          `https://cdn.jsdelivr.net/npm/@mediapipe/hands@0.4/${file}`,
      });

      this._hands.setOptions({
        maxNumHands: 2,
        modelComplexity: 0,
        minDetectionConfidence: 0.5,
        minTrackingConfidence: 0.5,
      });

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      this._hands.onResults((results: any) => {
        this._onHandsResults(results);
      });

      await this._hands.initialize();
      this._status = 'ready';
      return true;
    } catch (err) {
      console.warn('[HandsManager] Hands 모델 초기화 실패:', err);
      this._status = 'error';
      return false;
    }
  }

  /**
   * 비디오 프레임 전송
   */
  async send(video: HTMLVideoElement): Promise<void> {
    if (this._status !== 'ready' || !this._hands) return;
    try {
      await this._hands.send({ image: video });
    } catch {
      // 프레임 드랍 무시
    }
  }

  /**
   * 매 프레임 호출: Hands 캐시 만료 체크 및 Pose fallback 적용
   * @param timestamp 현재 타임스탬프 (ms)
   * @param poseLandmarks PoseManager에서 받은 가상 좌표 랜드마크 (fallback 소스)
   */
  update(timestamp: number, poseLandmarks?: readonly NormalizedLandmark[]): void {
    // 왼손 갱신
    this._leftPosition = this._resolveHand(
      this._leftHandRaw,
      this._leftHandTime,
      timestamp,
      poseLandmarks,
      POSE_LANDMARKS.LEFT_WRIST,
    );

    // 오른손 갱신
    this._rightPosition = this._resolveHand(
      this._rightHandRaw,
      this._rightHandTime,
      timestamp,
      poseLandmarks,
      POSE_LANDMARKS.RIGHT_WRIST,
    );
  }

  /**
   * 외부에서 Hands 데이터를 직접 주입 (테스트용)
   */
  setHandData(
    left: NormalizedLandmark | null,
    right: NormalizedLandmark | null,
    timestamp: number,
  ): void {
    if (left) {
      this._leftHandRaw = left;
      this._leftHandTime = timestamp;
    }
    if (right) {
      this._rightHandRaw = right;
      this._rightHandTime = timestamp;
    }
  }

  /** 리소스 해제 */
  destroy(): void {
    if (this._hands?.close) {
      this._hands.close();
    }
    this._hands = null;
    this._leftHandRaw = null;
    this._rightHandRaw = null;
    this._leftPosition = null;
    this._rightPosition = null;
    this._status = 'idle';
  }

  // ─── Private ───

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private _onHandsResults(results: any): void {
    this._leftHandRaw = null;
    this._rightHandRaw = null;

    if (!results.multiHandLandmarks || !results.multiHandedness) return;

    const now = typeof performance !== 'undefined' ? performance.now() : Date.now();

    for (let i = 0; i < results.multiHandLandmarks.length; i++) {
      const landmarks = results.multiHandLandmarks[i];
      const handedness = results.multiHandedness[i];
      const palm = landmarks[PALM_CENTER_INDEX];
      if (!palm) continue;

      const lm: NormalizedLandmark = {
        x: palm.x,
        y: palm.y,
        z: palm.z ?? 0,
        visibility: handedness.score ?? 0.9,
      };

      // MediaPipe는 미러링 기준이므로 Left = 오른손, Right = 왼손
      if (handedness.label === 'Left') {
        this._rightHandRaw = lm;
        this._rightHandTime = now;
      } else {
        this._leftHandRaw = lm;
        this._leftHandTime = now;
      }
    }
  }

  /**
   * 손 위치 결정: Hands 우선 → 캐시 만료 시 Pose fallback
   */
  private _resolveHand(
    handRaw: NormalizedLandmark | null,
    handTime: number,
    timestamp: number,
    poseLandmarks: readonly NormalizedLandmark[] | undefined,
    poseWristIndex: number,
  ): HandPosition | null {
    // Hands 데이터가 유효하고 캐시 시간 내
    if (handRaw && (timestamp - handTime) < this._cacheTimeout) {
      return {
        x: handRaw.x * this._virtualWidth,
        y: handRaw.y * this._virtualHeight,
        source: 'hands',
        confidence: handRaw.visibility,
      };
    }

    // Pose fallback
    if (poseLandmarks && poseLandmarks[poseWristIndex]) {
      const wrist = poseLandmarks[poseWristIndex];
      if (wrist.visibility >= 0.5) {
        return {
          x: wrist.x, // PoseManager에서 이미 가상 좌표로 변환됨
          y: wrist.y,
          source: 'pose',
          confidence: wrist.visibility,
        };
      }
    }

    return null;
  }
}
