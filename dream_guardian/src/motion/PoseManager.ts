/**
 * PoseManager - MediaPipe Pose 연동 파이프라인
 *
 * MediaPipe Pose 모델 비동기 초기화, 30fps 스로틀링
 * 좌표 정규화 (0~1 → 가상 화면 좌표 변환)
 * 신뢰도 임계값 필터링
 *
 * @see Issue #8 (GitHub #73)
 */

import type { NormalizedLandmark } from '../types/index.js';

/** 최소 프레임 간격 (30fps = ~33.3ms) */
const MIN_FRAME_INTERVAL_MS = 33;

/** 기본 신뢰도 임계값 */
const DEFAULT_VISIBILITY_THRESHOLD = 0.5;

export interface PoseManagerOptions {
  /** 신뢰도 임계값 (기본 0.5) */
  visibilityThreshold?: number;
  /** 가상 뷰포트 너비 */
  virtualWidth?: number;
  /** 가상 뷰포트 높이 */
  virtualHeight?: number;
  /** 좌우 반전(미러 모드) 여부 (기본 false) */
  mirror?: boolean;
  /** 비디오 비율 보존 변환 함수 (선택 사항) */
  projectFn?: (lm: { x: number; y: number }, vw: number, vh: number) => { x: number; y: number };
}

export type PoseStatus = 'idle' | 'loading' | 'ready' | 'error';

export class PoseManager {
  private _status: PoseStatus = 'idle';
  private _rawLandmarks: NormalizedLandmark[] = [];
  private _virtualLandmarks: NormalizedLandmark[] = [];
  private _lastProcessTime = 0;
  private _visibilityThreshold: number;
  private _virtualWidth: number;
  private _virtualHeight: number;
  private _mirror: boolean;
  private _projectFn?: (lm: { x: number; y: number }, vw: number, vh: number) => { x: number; y: number };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private _pose: any = null;

  constructor(options?: PoseManagerOptions) {
    this._visibilityThreshold = options?.visibilityThreshold ?? DEFAULT_VISIBILITY_THRESHOLD;
    this._virtualWidth = options?.virtualWidth ?? 1920;
    this._virtualHeight = options?.virtualHeight ?? 1080;
    this._mirror = options?.mirror ?? false;
    this._projectFn = options?.projectFn;
  }

  /** 현재 상태 */
  get status(): PoseStatus {
    return this._status;
  }

  /** 정규화된 원본 랜드마크 (0~1) */
  get rawLandmarks(): readonly NormalizedLandmark[] {
    return this._rawLandmarks;
  }

  /** 가상 좌표로 변환된 랜드마크 */
  get virtualLandmarks(): readonly NormalizedLandmark[] {
    return this._virtualLandmarks;
  }

  /** 포즈가 감지되었는지 */
  get hasPose(): boolean {
    return this._rawLandmarks.length > 0;
  }

  /**
   * MediaPipe Pose 모델 초기화
   * CDN에서 로드하며, 실패 시 error 상태
   */
  async init(): Promise<boolean> {
    this._status = 'loading';

    try {
      // MediaPipe Pose는 CDN에서 로드되어 전역에 주입됨
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const PoseClass = (globalThis as any).Pose;
      if (!PoseClass) {
        console.warn('[PoseManager] MediaPipe Pose가 로드되지 않음 (CDN 미포함 또는 오프라인)');
        this._status = 'error';
        return false;
      }

      this._pose = new PoseClass({
        locateFile: (file: string) =>
          `https://cdn.jsdelivr.net/npm/@mediapipe/pose@0.5/${file}`,
      });

      this._pose.setOptions({
        modelComplexity: 0, // Lite 모델
        smoothLandmarks: true,
        enableSegmentation: false,
        minDetectionConfidence: 0.5,
        minTrackingConfidence: 0.5,
      });

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      this._pose.onResults((results: any) => {
        this._onResults(results);
      });

      await this._pose.initialize();
      this._status = 'ready';
      return true;
    } catch (err) {
      console.warn('[PoseManager] Pose 모델 초기화 실패:', err);
      this._status = 'error';
      return false;
    }
  }

  /**
   * 비디오 프레임 전송 (30fps 스로틀링)
   */
  async send(video: HTMLVideoElement, timestamp: number): Promise<void> {
    if (this._status !== 'ready' || !this._pose) return;

    // 스로틀링: 33ms 미만 간격이면 스킵
    if (timestamp - this._lastProcessTime < MIN_FRAME_INTERVAL_MS) return;
    this._lastProcessTime = timestamp;

    try {
      await this._pose.send({ image: video });
    } catch {
      // 프레임 드랍은 무시
    }
  }

  /**
   * 외부에서 랜드마크를 직접 주입 (테스트 / fallback 용)
   */
  setLandmarks(landmarks: NormalizedLandmark[]): void {
    this._rawLandmarks = landmarks;
    this._virtualLandmarks = this._toVirtual(landmarks);
  }

  /**
   * 특정 랜드마크의 가상 좌표를 가져옴
   * 신뢰도 미달 시 null 반환
   */
  getLandmark(index: number): NormalizedLandmark | null {
    const lm = this._virtualLandmarks[index];
    if (!lm) return null;
    if (lm.visibility < this._visibilityThreshold) return null;
    return lm;
  }

  /** 리소스 해제 */
  destroy(): void {
    if (this._pose?.close) {
      this._pose.close();
    }
    this._pose = null;
    this._rawLandmarks = [];
    this._virtualLandmarks = [];
    this._status = 'idle';
  }

  // ─── Private ───

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private _onResults(results: any): void {
    if (!results.poseLandmarks) {
      this._rawLandmarks = [];
      this._virtualLandmarks = [];
      return;
    }

    this._rawLandmarks = results.poseLandmarks.map(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (lm: any) => ({
        x: lm.x,
        y: lm.y,
        z: lm.z ?? 0,
        visibility: lm.visibility ?? 0,
      })
    );

    this._virtualLandmarks = this._toVirtual(this._rawLandmarks);
  }

  /**
   * 정규화 좌표(0~1) → 가상 해상도 좌표 변환
   * projectFn 제공 시 커스텀 뷰포트 프로젝션 적용, 미제공 시 mirror 설정 적용
   */
  private _toVirtual(landmarks: NormalizedLandmark[]): NormalizedLandmark[] {
    return landmarks.map((lm) => {
      if (this._projectFn) {
        const pt = this._projectFn(lm, this._virtualWidth, this._virtualHeight);
        return {
          x: pt.x,
          y: pt.y,
          z: lm.z,
          visibility: lm.visibility,
        };
      }
      return {
        x: (this._mirror ? 1 - lm.x : lm.x) * this._virtualWidth,
        y: lm.y * this._virtualHeight,
        z: lm.z,
        visibility: lm.visibility,
      };
    });
  }
}
