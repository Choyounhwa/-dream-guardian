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
      try {
        this._stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: 'user',
            width: { ideal: this._width },
            height: { ideal: this._height },
          },
          audio: false,
        });
      } catch (e) {
        if (e instanceof DOMException && e.name === 'NotAllowedError') throw e;
        // 해상도 제약 조건 실패 시 기본 비디오 스트림으로 fallback
        this._stream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: false,
        });
      }

      this._video = document.createElement('video');
      this._video.srcObject = this._stream;
      this._video.setAttribute('playsinline', '');
      this._video.setAttribute('webkit-playsinline', '');
      this._video.muted = true;
      this._video.autoplay = true;

      // DOM에 미부착 시 브라우저가 프레임을 공급하지 않거나 일시정지하는 현상 방지
      if (typeof document !== 'undefined' && document.body) {
        this._video.style.position = 'fixed';
        this._video.style.top = '-9999px';
        this._video.style.left = '-9999px';
        this._video.style.width = '1px';
        this._video.style.height = '1px';
        this._video.style.opacity = '0.001';
        this._video.style.pointerEvents = 'none';
        document.body.appendChild(this._video);
      }

      if (this._video.readyState < 2) {
        await new Promise<void>((resolve) => {
          const timeout = setTimeout(resolve, 2000);
          this._video!.onloadedmetadata = () => {
            clearTimeout(timeout);
            resolve();
          };
        });
      }

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
      if (this._video.parentElement) {
        this._video.parentElement.removeChild(this._video);
      }
      this._video = null;
    }
    this._status = 'idle';
  }

  /**
   * 비디오의 캔버스 렌더링 스케일 및 오프셋 정보 반환 (Cover 모드)
   */
  getVideoTransform(canvasWidth: number, canvasHeight: number): {
    dw: number;
    dh: number;
    cx: number;
    cy: number;
    scale: number;
  } {
    const vW = this._video?.videoWidth || this._width;
    const vH = this._video?.videoHeight || this._height;
    const scale = Math.max(canvasWidth / vW, canvasHeight / vH);
    return {
      dw: vW * scale,
      dh: vH * scale,
      cx: canvasWidth / 2,
      cy: canvasHeight / 2,
      scale,
    };
  }

  /**
   * 정규화 랜드마크(0~1)를 카메라 뷰포트(Cover + 미러) 캔버스 좌표로 1:1 변환
   */
  landmarkToCanvas(
    lm: { x: number; y: number },
    canvasWidth: number,
    canvasHeight: number
  ): { x: number; y: number } {
    const { dw, dh, cx, cy } = this.getVideoTransform(canvasWidth, canvasHeight);
    return {
      x: this._mirror ? cx + (0.5 - lm.x) * dw : cx + (lm.x - 0.5) * dw,
      y: cy + (lm.y - 0.5) * dh,
    };
  }

  /**
   * 캔버스에 미러 웹캠 피드 + 디밍 렌더링
   * 비디오 원본 비율을 유지하는 중앙 정렬 Cover 스케일 적용
   * 카메라가 꺼져 있으면 아무것도 그리지 않음
   */
  render(ctx: CanvasRenderingContext2D, canvasWidth: number, canvasHeight: number): void {
    if (!this._video || this._status !== 'active') return;
    if (!this._video.readyState || this._video.readyState < 2) return;

    const { dw, dh, cx, cy } = this.getVideoTransform(canvasWidth, canvasHeight);

    ctx.save();
    ctx.translate(cx, cy);

    if (this._mirror) {
      // 좌우 반전 (미러)
      ctx.scale(-1, 1);
    }

    // 중앙 기준 Cover 드로잉
    ctx.drawImage(this._video, -dw / 2, -dh / 2, dw, dh);

    ctx.restore();

    // 35% 디밍 오버레이
    if (this._dimAlpha > 0) {
      ctx.fillStyle = `rgba(0, 0, 0, ${this._dimAlpha})`;
      ctx.fillRect(0, 0, canvasWidth, canvasHeight);
    }
  }
}
