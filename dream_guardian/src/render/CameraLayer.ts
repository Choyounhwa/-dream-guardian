/**
 * CameraLayer - 웹캠 미러 피드 레이어
 *
 * 웹캠 권한 요청, 미러 비디오 캡처 및 35% 디밍 오버레이
 * 카메라 실패 시에도 게임 엔진이 다운되지 않음
 *
 * @see Issue #7 (GitHub #72)
 */

export interface CameraLayerOptions {
  /** 디밍 오버레이 알파 (0~1, 기본 0.35) */
  dimAlpha?: number;
  /** 미러 반전 여부 (기본 true) */
  mirror?: boolean;
  /** 카메라 해상도 제약 */
  width?: number;
  height?: number;
}

export type CameraStatus = 'idle' | 'requesting' | 'active' | 'denied' | 'error';

export class CameraLayer {
  private _video: HTMLVideoElement | null = null;
  private _stream: MediaStream | null = null;
  private _status: CameraStatus = 'idle';
  private _dimAlpha: number;
  private _mirror: boolean;
  private _width: number;
  private _height: number;

  constructor(options?: CameraLayerOptions) {
    this._dimAlpha = options?.dimAlpha ?? 0.35;
    this._mirror = options?.mirror ?? true;
    this._width = options?.width ?? 640;
    this._height = options?.height ?? 480;
  }

  /** 현재 카메라 상태 */
  get status(): CameraStatus {
    return this._status;
  }

  /** 카메라가 활성 상태인지 */
  get isActive(): boolean {
    return this._status === 'active';
  }

  /** 비디오 엘리먼트 (PoseManager에서 접근용) */
  get videoElement(): HTMLVideoElement | null {
    return this._video;
  }

  /**
   * 웹캠 권한 요청 및 비디오 스트림 시작
   * @returns 성공 여부
   */
  async start(): Promise<boolean> {
    // 브라우저 환경 체크
    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
      console.warn('[CameraLayer] getUserMedia 미지원 환경');
      this._status = 'error';
      return false;
    }

    this._status = 'requesting';

    try {
      this._stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: 'user',
          width: { ideal: this._width },
          height: { ideal: this._height },
        },
        audio: false,
      });

      this._video = document.createElement('video');
      this._video.srcObject = this._stream;
      this._video.setAttribute('playsinline', '');
      this._video.muted = true;

      await this._video.play();
      this._status = 'active';
      return true;
    } catch (err) {
      if (err instanceof DOMException && err.name === 'NotAllowedError') {
        console.warn('[CameraLayer] 카메라 권한 거부');
        this._status = 'denied';
      } else {
        console.warn('[CameraLayer] 카메라 초기화 실패:', err);
        this._status = 'error';
      }
      return false;
    }
  }

  /** 카메라 스트림 종료 및 리소스 해제 */
  stop(): void {
    if (this._stream) {
      for (const track of this._stream.getTracks()) {
        track.stop();
      }
      this._stream = null;
    }
    if (this._video) {
      this._video.srcObject = null;
      this._video = null;
    }
    this._status = 'idle';
  }

  /**
   * 캔버스에 미러 웹캠 피드 + 디밍 렌더링
   * 카메라가 꺼져 있으면 아무것도 그리지 않음
   */
  render(ctx: CanvasRenderingContext2D, canvasWidth: number, canvasHeight: number): void {
    if (!this._video || this._status !== 'active') return;
    if (!this._video.readyState || this._video.readyState < 2) return;

    ctx.save();

    if (this._mirror) {
      // 좌우 반전 (미러)
      ctx.translate(canvasWidth, 0);
      ctx.scale(-1, 1);
    }

    // 비디오를 캔버스에 꽉 채워 그리기
    ctx.drawImage(this._video, 0, 0, canvasWidth, canvasHeight);

    ctx.restore();

    // 35% 디밍 오버레이
    if (this._dimAlpha > 0) {
      ctx.fillStyle = `rgba(0, 0, 0, ${this._dimAlpha})`;
      ctx.fillRect(0, 0, canvasWidth, canvasHeight);
    }
  }
}
