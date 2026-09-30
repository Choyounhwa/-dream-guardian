/**
 * MagicCircleRenderer - 3중 회전 마법진 피트니스 존 이펙트 렌더러
 *
 * 활성 피트니스 존 중심에 3개 에셋(E_Pit_act1~3.png)를 각기 다른 방향과 속도로
 * 천천히 회전시키며, 맨 바깥 링(act3)에는 약한 Scale Pulse 효과를 적용한다.
 *
 * @see Issue #143 (UI-INGAME-001)
 */

/** 레이어별 Scale Pulse 설정 */
export interface ScalePulseConfig {
  /** 최소 스케일 (기본 0.96) */
  min: number;
  /** 최대 스케일 (기본 1.04) */
  max: number;
  /** 펄스 주기 속도 (rad/s) */
  speed: number;
}

/** 마법진 레이어 1개의 설정 */
export interface MagicCircleLayerConfig {
  /** 회전 속도 (rad/s, 절대값) */
  speed: number;
  /** 회전 방향: 1 = 시계, -1 = 반시계 */
  direction: 1 | -1;
  /** 기본 알파 (불투명도) */
  alpha: number;
  /** Scale Pulse 효과 (선택, 3번째 레이어에만 적용) */
  scalePulse?: ScalePulseConfig;
}

/** 마법진 전체 설정 */
export interface MagicCircleConfig {
  layers: MagicCircleLayerConfig[];
}

/**
 * 3중 마법진 기본 설정
 *
 * - 링 1 (E_Pit_act1): 시계 방향, 0.3 rad/s
 * - 링 2 (E_Pit_act2): 반시계 방향, 0.5 rad/s
 * - 링 3 (E_Pit_act3): 시계 방향, 0.2 rad/s, Scale Pulse 0.96~1.04
 */
export const MAGIC_CIRCLE_CONFIG: MagicCircleConfig = {
  layers: [
    {
      speed: 0.3,
      direction: 1,
      alpha: 0.85,
    },
    {
      speed: 0.5,
      direction: -1,
      alpha: 0.75,
    },
    {
      speed: 0.2,
      direction: 1,
      alpha: 0.8,
      scalePulse: {
        min: 0.96,
        max: 1.04,
        speed: 2.0,
      },
    },
  ],
};

export class MagicCircleRenderer {
  private _elapsed = 0;
  private _images: HTMLImageElement[] = [];

  /** 현재 누적 시간 (초) */
  get elapsedTime(): number {
    return this._elapsed;
  }

  /** 3개 이미지가 모두 등록되었는지 여부 */
  get isReady(): boolean {
    return this._images.length >= 3 && this._images.every((img) => img && img.complete);
  }

  /** 매 프레임 deltaTime 누적 */
  update(dt: number): void {
    this._elapsed += dt;
  }

  /** 시간 초기화 */
  reset(): void {
    this._elapsed = 0;
  }

  /**
   * 3개 마법진 이미지 에셋 등록
   * @param images [E_Pit_act1, E_Pit_act2, E_Pit_act3] 순서
   */
  setImages(images: HTMLImageElement[]): void {
    this._images = images;
  }

  /**
   * 특정 레이어의 현재 Scale Pulse 값을 반환한다
   * scalePulse 설정이 없는 레이어는 1.0 반환
   */
  getScalePulseValue(layerIndex: number): number {
    const config = MAGIC_CIRCLE_CONFIG.layers[layerIndex];
    if (!config?.scalePulse) return 1.0;

    const { min, max, speed } = config.scalePulse;
    const mid = (min + max) / 2;
    const amp = (max - min) / 2;
    return mid + amp * Math.sin(this._elapsed * speed);
  }

  /**
   * 활성 피트니스 존 중심에 3중 마법진을 렌더링한다
   *
   * @param ctx Canvas 2D 컨텍스트
   * @param cx 존 중심 X (가상 좌표)
   * @param cy 존 중심 Y (가상 좌표)
   * @param size 마법진 렌더링 크기 (가상 픽셀, 존 너비 or 대각선 기준)
   */
  renderAtZone(
    ctx: CanvasRenderingContext2D,
    cx: number,
    cy: number,
    size: number,
  ): void {
    if (!this.isReady) return;

    const layers = MAGIC_CIRCLE_CONFIG.layers;

    for (let i = 0; i < layers.length && i < this._images.length; i++) {
      const layer = layers[i];
      const img = this._images[i];
      const angle = this._elapsed * layer.speed * layer.direction;
      const pulseScale = this.getScalePulseValue(i);
      const halfSize = size / 2;

      ctx.save();
      ctx.globalAlpha = layer.alpha;
      ctx.translate(cx, cy);
      ctx.rotate(angle);
      ctx.scale(pulseScale, pulseScale);
      ctx.drawImage(img, -halfSize, -halfSize, size, size);
      ctx.restore();
    }
  }
}
