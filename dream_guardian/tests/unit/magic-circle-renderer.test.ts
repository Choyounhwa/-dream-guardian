import { describe, it, expect, vi } from 'vitest';
import { MagicCircleRenderer, MAGIC_CIRCLE_CONFIG } from '../../src/render/MagicCircleRenderer.js';

function createMockCtx(): CanvasRenderingContext2D {
  return {
    save: vi.fn(),
    restore: vi.fn(),
    translate: vi.fn(),
    rotate: vi.fn(),
    scale: vi.fn(),
    drawImage: vi.fn(),
    globalAlpha: 1,
    globalCompositeOperation: 'source-over',
  } as unknown as CanvasRenderingContext2D;
}

function createMockImage(w = 256, h = 256): HTMLImageElement {
  const img = {
    width: w,
    height: h,
    naturalWidth: w,
    naturalHeight: h,
    complete: true,
  } as unknown as HTMLImageElement;
  return img;
}

describe('MagicCircleRenderer (Issue #143)', () => {
  it('인스턴스를 정상 생성할 수 있다', () => {
    const renderer = new MagicCircleRenderer();
    expect(renderer).toBeDefined();
  });

  it('MAGIC_CIRCLE_CONFIG에 3개 레이어 설정이 정의되어 있다', () => {
    expect(MAGIC_CIRCLE_CONFIG.layers).toHaveLength(3);
  });

  it('각 레이어에 회전 방향(direction)과 속도(speed)가 정의되어 있다', () => {
    for (const layer of MAGIC_CIRCLE_CONFIG.layers) {
      expect(layer).toHaveProperty('speed');
      expect(layer).toHaveProperty('direction');
      expect(typeof layer.speed).toBe('number');
      expect([1, -1]).toContain(layer.direction);
    }
  });

  it('3번째 레이어(E_Pit_act3)에 scalePulse 설정이 정의되어 있다', () => {
    const layer3 = MAGIC_CIRCLE_CONFIG.layers[2];
    expect(layer3.scalePulse).toBeDefined();
    expect(layer3.scalePulse!.min).toBeLessThan(1);
    expect(layer3.scalePulse!.max).toBeGreaterThan(1);
    expect(layer3.scalePulse!.speed).toBeGreaterThan(0);
  });

  it('update(dt)로 내부 시간을 누적한다', () => {
    const renderer = new MagicCircleRenderer();
    renderer.update(0.5);
    renderer.update(0.5);
    expect(renderer.elapsedTime).toBeCloseTo(1.0);
  });

  it('reset()으로 시간을 초기화한다', () => {
    const renderer = new MagicCircleRenderer();
    renderer.update(2.0);
    renderer.reset();
    expect(renderer.elapsedTime).toBe(0);
  });

  it('setImages()로 3개 이미지를 등록할 수 있다', () => {
    const renderer = new MagicCircleRenderer();
    const images = [createMockImage(), createMockImage(), createMockImage()];
    renderer.setImages(images);
    expect(renderer.isReady).toBe(true);
  });

  it('이미지 미등록 시 isReady가 false이다', () => {
    const renderer = new MagicCircleRenderer();
    expect(renderer.isReady).toBe(false);
  });

  it('이미지가 3개 미만이면 isReady가 false이다', () => {
    const renderer = new MagicCircleRenderer();
    renderer.setImages([createMockImage(), createMockImage()]);
    expect(renderer.isReady).toBe(false);
  });

  it('renderAtZone()이 이미지 준비 시 ctx.drawImage를 3회 호출한다', () => {
    const renderer = new MagicCircleRenderer();
    const images = [createMockImage(), createMockImage(), createMockImage()];
    renderer.setImages(images);
    renderer.update(1.0);

    const ctx = createMockCtx();
    renderer.renderAtZone(ctx, 540, 400, 280);

    // 3개 레이어 각 1회 drawImage
    expect(ctx.drawImage).toHaveBeenCalledTimes(3);
  });

  it('renderAtZone()이 이미지 미준비 시 drawImage를 호출하지 않는다', () => {
    const renderer = new MagicCircleRenderer();
    renderer.update(1.0);

    const ctx = createMockCtx();
    renderer.renderAtZone(ctx, 540, 400, 280);

    expect(ctx.drawImage).not.toHaveBeenCalled();
  });

  it('renderAtZone()이 ctx.save/restore 쌍을 올바르게 호출한다', () => {
    const renderer = new MagicCircleRenderer();
    const images = [createMockImage(), createMockImage(), createMockImage()];
    renderer.setImages(images);
    renderer.update(1.0);

    const ctx = createMockCtx();
    renderer.renderAtZone(ctx, 540, 400, 280);

    // 3 레이어 × 1 save/restore 쌍 = 최소 3회
    expect((ctx.save as ReturnType<typeof vi.fn>).mock.calls.length).toBeGreaterThanOrEqual(3);
    expect((ctx.restore as ReturnType<typeof vi.fn>).mock.calls.length).toBeGreaterThanOrEqual(3);
  });

  it('3번째 레이어 렌더링 시 ctx.scale이 호출된다 (scale pulse)', () => {
    const renderer = new MagicCircleRenderer();
    const images = [createMockImage(), createMockImage(), createMockImage()];
    renderer.setImages(images);
    renderer.update(1.0);

    const ctx = createMockCtx();
    renderer.renderAtZone(ctx, 540, 400, 280);

    // scale이 최소 1회 호출 (3번째 레이어의 scalePulse)
    expect(ctx.scale).toHaveBeenCalled();
  });

  it('레이어 1은 시계 방향(direction=1), 레이어 2는 반시계(direction=-1)이다', () => {
    expect(MAGIC_CIRCLE_CONFIG.layers[0].direction).toBe(1);
    expect(MAGIC_CIRCLE_CONFIG.layers[1].direction).toBe(-1);
    expect(MAGIC_CIRCLE_CONFIG.layers[2].direction).toBe(1);
  });

  it('모든 레이어의 회전 속도가 1.0 이하(천천히 회전)이다', () => {
    for (const layer of MAGIC_CIRCLE_CONFIG.layers) {
      expect(layer.speed).toBeLessThanOrEqual(1.0);
    }
  });

  it('scalePulse 범위가 0.96~1.04로 약한 펄스이다', () => {
    const pulse = MAGIC_CIRCLE_CONFIG.layers[2].scalePulse!;
    expect(pulse.min).toBeGreaterThanOrEqual(0.94);
    expect(pulse.max).toBeLessThanOrEqual(1.06);
  });

  it('getScalePulseValue()가 min~max 범위 내의 값을 반환한다', () => {
    const renderer = new MagicCircleRenderer();
    // 여러 시간대에서 검증
    for (let t = 0; t < 10; t += 0.3) {
      renderer.reset();
      renderer.update(t);
      const pulse = MAGIC_CIRCLE_CONFIG.layers[2].scalePulse!;
      const value = renderer.getScalePulseValue(2); // 3번째 레이어 (index 2)
      expect(value).toBeGreaterThanOrEqual(pulse.min - 0.001);
      expect(value).toBeLessThanOrEqual(pulse.max + 0.001);
    }
  });

  it('scalePulse가 없는 레이어의 getScalePulseValue()는 1.0을 반환한다', () => {
    const renderer = new MagicCircleRenderer();
    renderer.update(1.0);
    expect(renderer.getScalePulseValue(0)).toBe(1.0);
    expect(renderer.getScalePulseValue(1)).toBe(1.0);
  });
});
