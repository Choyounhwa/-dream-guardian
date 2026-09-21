/**
 * CanvasManager - 고해상도(DPR) 렌더링 및 18:9 고정 종횡비 스케일링 기반
 *
 * DevicePixelRatio 대응 선명한 캔버스 스케일링
 * 18:9 가상 해상도(1080x2160 / 2160x1080) ↔ 실제 캔버스 좌표 매핑 및 왜곡 방지 균일 스케일링
 *
 * @see Issue #6 (GitHub #71), Issue #109 (GitHub #109, Card #36)
 */

import { DEFAULT_CONFIG } from '../core/Config.js';

export interface CanvasManagerOptions {
  virtualWidth?: number;
  virtualHeight?: number;
  getDevicePixelRatio?: () => number;
  /** 균일 스케일(종횡비 보존) 적용 여부 (기본값: true) */
  uniformScale?: boolean;
}

export class CanvasManager {
  private _canvas: HTMLCanvasElement;
  private _ctx: CanvasRenderingContext2D;
  private _virtualWidth: number;
  private _virtualHeight: number;
  private _scaleX = 1;
  private _scaleY = 1;
  private _dpr = 1;
  private _uniformScale = true;
  private _getDevicePixelRatio: () => number;

  constructor(canvas: HTMLCanvasElement, options?: CanvasManagerOptions) {
    this._canvas = canvas;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas 2D 컨텍스트를 생성할 수 없습니다.');
    this._ctx = ctx;

    this._virtualWidth = options?.virtualWidth ?? DEFAULT_CONFIG.render.virtualWidth;
    this._virtualHeight = options?.virtualHeight ?? DEFAULT_CONFIG.render.virtualHeight;
    this._uniformScale = options?.uniformScale ?? true;
    this._getDevicePixelRatio = options?.getDevicePixelRatio ?? (() =>
      typeof devicePixelRatio !== 'undefined' ? devicePixelRatio : 1
    );

    this.resize();
  }

  /** Canvas 요소 */
  get canvas(): HTMLCanvasElement {
    return this._canvas;
  }

  /** Canvas 2D 컨텍스트 */
  get ctx(): CanvasRenderingContext2D {
    return this._ctx;
  }

  /** 가상 해상도 너비 */
  get virtualWidth(): number {
    return this._virtualWidth;
  }

  /** 가상 해상도 높이 */
  get virtualHeight(): number {
    return this._virtualHeight;
  }

  /** 가상 해상도 종횡비 (width / height) */
  get aspectRatio(): number {
    return this._virtualWidth / this._virtualHeight;
  }

  /** 현재 DPR */
  get dpr(): number {
    return this._dpr;
  }

  /** 현재 스케일 X */
  get scaleX(): number {
    return this._scaleX;
  }

  /** 현재 스케일 Y */
  get scaleY(): number {
    return this._scaleY;
  }

  /** 균일 스케일 배율 */
  get uniformScale(): number {
    return Math.min(this._scaleX, this._scaleY);
  }

  /**
   * 가상 해상도 변경 (런타임 가로/세로 전환 지원)
   */
  setVirtualResolution(width: number, height: number): void {
    this._virtualWidth = width;
    this._virtualHeight = height;
    this.resize();
  }

  /**
   * 캔버스 크기 리사이즈 및 DPR 보정
   * 18:9 종횡비 유지 및 균일 스케일(Uniform scale) 계산
   * 화면 리사이즈 이벤트 시 호출
   */
  resize(): void {
    this._dpr = this._getDevicePixelRatio();

    // CSS 표시 크기 (논리 픽셀)
    const displayWidth = this._canvas.clientWidth || window.innerWidth || this._virtualWidth;
    const displayHeight = this._canvas.clientHeight || window.innerHeight || this._virtualHeight;

    // 실제 캔버스 해상도 (물리 픽셀)
    this._canvas.width = Math.round(displayWidth * this._dpr);
    this._canvas.height = Math.round(displayHeight * this._dpr);

    // 가상 좌표 → 물리 좌표 스케일
    const rawScaleX = this._canvas.width / this._virtualWidth;
    const rawScaleY = this._canvas.height / this._virtualHeight;

    if (this._uniformScale) {
      // 18:9 균일 스케일 적용 (더 작은 축 기준으로 스케일을 일치시켜 왜곡 방지)
      const uniform = Math.min(rawScaleX, rawScaleY);
      this._scaleX = uniform;
      this._scaleY = uniform;
    } else {
      this._scaleX = rawScaleX;
      this._scaleY = rawScaleY;
    }
  }

  /**
   * 가상 좌표 → 물리 캔버스 좌표 변환
   */
  toPhysical(vx: number, vy: number): { x: number; y: number } {
    return {
      x: vx * this._scaleX,
      y: vy * this._scaleY,
    };
  }

  /**
   * 물리 캔버스 좌표 → 가상 좌표 변환
   */
  toVirtual(px: number, py: number): { x: number; y: number } {
    return {
      x: px / this._scaleX,
      y: py / this._scaleY,
    };
  }

  /**
   * 매 프레임 시작 시 캔버스 클리어
   */
  clear(): void {
    this._ctx.clearRect(0, 0, this._canvas.width, this._canvas.height);
  }

  /**
   * 가상 좌표계 기준으로 컨텍스트 변환 적용
   * 렌더링 전에 호출하면 가상 좌표로 드로잉 가능
   */
  applyVirtualTransform(): void {
    this._ctx.setTransform(this._scaleX, 0, 0, this._scaleY, 0, 0);
  }

  /**
   * 컨텍스트 변환 초기화
   */
  resetTransform(): void {
    this._ctx.setTransform(1, 0, 0, 1, 0, 0);
  }
}
