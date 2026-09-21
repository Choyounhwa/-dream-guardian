import { describe, it, expect } from 'vitest';
import { CanvasManager } from '../../src/render/CanvasManager.js';

/**
 * CanvasManager 단위 테스트
 * - 좌표 변환 및 DPR 스케일 계산 검증
 * - 리사이즈 시 정상 동작 검증
 *
 * 참고: Node 환경에서 HTMLCanvasElement가 없으므로 mock 사용
 */

/** 간단한 Canvas mock */
function createMockCanvas(clientW: number, clientH: number) {
  let width = 0;
  let height = 0;

  const ctx = {
    clearRect: () => {},
    setTransform: () => {},
  };

  return {
    get clientWidth() { return clientW; },
    get clientHeight() { return clientH; },
    get width() { return width; },
    set width(v: number) { width = v; },
    get height() { return height; },
    set height(v: number) { height = v; },
    getContext: (_id: string) => ctx,
    _setClientSize: (w: number, h: number) => {
      // Proxy를 사용하지 않으므로 새 mock이 필요할 수 있음
      // 이 헬퍼는 테스트 단순화용
      Object.defineProperty(canvas, 'clientWidth', { value: w, configurable: true });
      Object.defineProperty(canvas, 'clientHeight', { value: h, configurable: true });
    },
  } as unknown as HTMLCanvasElement & { _setClientSize: (w: number, h: number) => void };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  var canvas: any;
}

/** 리사이즈 가능한 Canvas mock */
function createResizableMockCanvas(initialW: number, initialH: number) {
  let cw = initialW;
  let ch = initialH;
  let width = 0;
  let height = 0;

  const ctx = {
    clearRect: () => {},
    setTransform: () => {},
  };

  const mock = {
    get clientWidth() { return cw; },
    get clientHeight() { return ch; },
    get width() { return width; },
    set width(v: number) { width = v; },
    get height() { return height; },
    set height(v: number) { height = v; },
    getContext: (_id: string) => ctx,
    setClientSize(w: number, h: number) { cw = w; ch = h; },
  };

  return mock as unknown as HTMLCanvasElement & { setClientSize: (w: number, h: number) => void };
}

describe('CanvasManager', () => {
  it('DPR=1에서 18:9 가상좌표 → 물리좌표 변환이 정확하다', () => {
    const canvas = createMockCanvas(1080, 2160);
    const cm = new CanvasManager(canvas, { getDevicePixelRatio: () => 1 });

    // DPR=1, clientSize=1080x2160, virtual=1080x2160 → scale=1:1
    const p = cm.toPhysical(540, 1080);
    expect(p.x).toBeCloseTo(540);
    expect(p.y).toBeCloseTo(1080);
    expect(cm.aspectRatio).toBeCloseTo(0.5);
  });

  it('DPR=2에서 물리 캔버스 크기가 2배가 된다', () => {
    const canvas = createMockCanvas(1080, 2160);
    const cm = new CanvasManager(canvas, { getDevicePixelRatio: () => 2 });

    expect(canvas.width).toBe(2160);
    expect(canvas.height).toBe(4320);
    expect(cm.dpr).toBe(2);
    expect(cm.scaleX).toBeCloseTo(2);
    expect(cm.scaleY).toBeCloseTo(2);
  });

  it('DPR=2에서 좌표 변환이 정확하다', () => {
    const canvas = createMockCanvas(1080, 2160);
    const cm = new CanvasManager(canvas, { getDevicePixelRatio: () => 2 });

    // canvas.width=2160, virtualWidth=1080 → scaleX=2, scaleY=2
    const p = cm.toPhysical(100, 200);
    expect(p.x).toBeCloseTo(200);
    expect(p.y).toBeCloseTo(400);
  });

  it('물리좌표 → 가상좌표 역변환이 정확하다', () => {
    const canvas = createMockCanvas(1080, 2160);
    const cm = new CanvasManager(canvas, { getDevicePixelRatio: () => 2 });

    const v = cm.toVirtual(200, 400);
    expect(v.x).toBeCloseTo(100);
    expect(v.y).toBeCloseTo(200);
  });

  it('toPhysical ↔ toVirtual 왕복 변환이 일치한다', () => {
    const canvas = createMockCanvas(360, 720);
    const cm = new CanvasManager(canvas, {
      virtualWidth: 1080,
      virtualHeight: 2160,
      getDevicePixelRatio: () => 1.5,
    });

    const original = { x: 500, y: 1200 };
    const physical = cm.toPhysical(original.x, original.y);
    const back = cm.toVirtual(physical.x, physical.y);

    expect(back.x).toBeCloseTo(original.x, 5);
    expect(back.y).toBeCloseTo(original.y, 5);
  });

  it('resize() 호출 시 새 크기에 맞게 재계산된다', () => {
    const canvas = createResizableMockCanvas(1080, 2160);
    const cm = new CanvasManager(canvas, { getDevicePixelRatio: () => 1 });

    expect(cm.scaleX).toBeCloseTo(1);

    // 화면 크기 변경 (540x1080)
    canvas.setClientSize(540, 1080);
    cm.resize();

    // 새 스케일: 540/1080 = 0.5
    expect(cm.scaleX).toBeCloseTo(0.5);
    expect(cm.scaleY).toBeCloseTo(0.5);
    expect(canvas.width).toBe(540);
    expect(canvas.height).toBe(1080);
  });

  it('가상 해상도 기본값은 18:9 (세로 1080x2160)이다', () => {
    const canvas = createMockCanvas(1080, 2160);
    const cm = new CanvasManager(canvas, { getDevicePixelRatio: () => 1 });

    expect(cm.virtualWidth).toBe(1080);
    expect(cm.virtualHeight).toBe(2160);
    expect(cm.aspectRatio).toBeCloseTo(9 / 18, 5);
  });

  it('가로 18:9 (2160x1080) 커스텀 해상도를 설정할 수 있다', () => {
    const canvas = createMockCanvas(2160, 1080);
    const cm = new CanvasManager(canvas, {
      virtualWidth: 2160,
      virtualHeight: 1080,
      getDevicePixelRatio: () => 1,
    });

    expect(cm.virtualWidth).toBe(2160);
    expect(cm.virtualHeight).toBe(1080);
    expect(cm.aspectRatio).toBeCloseTo(18 / 9, 5);

    const p = cm.toPhysical(1080, 540);
    expect(p.x).toBeCloseTo(1080);
    expect(p.y).toBeCloseTo(540);
  });

  it('setVirtualResolution()으로 런타임에 해상도를 변경할 수 있다', () => {
    const canvas = createMockCanvas(1080, 2160);
    const cm = new CanvasManager(canvas, { getDevicePixelRatio: () => 1 });

    expect(cm.virtualWidth).toBe(1080);
    expect(cm.virtualHeight).toBe(2160);

    // 가로 모드로 전환
    cm.setVirtualResolution(2160, 1080);
    expect(cm.virtualWidth).toBe(2160);
    expect(cm.virtualHeight).toBe(1080);
    expect(cm.aspectRatio).toBeCloseTo(2, 5);
  });

  it('화면 비율이 가상 해상도와 다를 때 왜곡 없이 균일 스케일(Uniform scale)이 적용된다', () => {
    // 800x600 (4:3) 환경에 1080x2160 (1:2) 가상 캔버스 배치
    const canvas = createMockCanvas(800, 600);
    const cm = new CanvasManager(canvas, {
      virtualWidth: 1080,
      virtualHeight: 2160,
      getDevicePixelRatio: () => 1,
      uniformScale: true,
    });

    // scaleX = 800/1080 ≈ 0.7407, scaleY = 600/2160 ≈ 0.2777
    // uniformScale = min(0.7407, 0.2777) ≈ 0.2777
    expect(cm.scaleX).toBeCloseTo(cm.scaleY);
    expect(cm.scaleX).toBeCloseTo(600 / 2160);
    expect(cm.uniformScale).toBeCloseTo(600 / 2160);
  });
});
