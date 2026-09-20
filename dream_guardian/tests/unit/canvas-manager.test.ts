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
  it('DPR=1에서 가상좌표 → 물리좌표 변환이 정확하다', () => {
    const canvas = createMockCanvas(1920, 1080);
    const cm = new CanvasManager(canvas, { getDevicePixelRatio: () => 1 });

    // DPR=1, clientSize=1920x1080, virtual=1920x1080 → scale=1:1
    const p = cm.toPhysical(960, 540);
    expect(p.x).toBeCloseTo(960);
    expect(p.y).toBeCloseTo(540);
  });

  it('DPR=2에서 물리 캔버스 크기가 2배가 된다', () => {
    const canvas = createMockCanvas(1920, 1080);
    const cm = new CanvasManager(canvas, { getDevicePixelRatio: () => 2 });

    expect(canvas.width).toBe(3840);
    expect(canvas.height).toBe(2160);
    expect(cm.dpr).toBe(2);
  });

  it('DPR=2에서 좌표 변환이 정확하다', () => {
    const canvas = createMockCanvas(1920, 1080);
    const cm = new CanvasManager(canvas, { getDevicePixelRatio: () => 2 });

    // canvas.width=3840, virtualWidth=1920 → scaleX=2
    const p = cm.toPhysical(100, 200);
    expect(p.x).toBeCloseTo(200);
    expect(p.y).toBeCloseTo(400);
  });

  it('물리좌표 → 가상좌표 역변환이 정확하다', () => {
    const canvas = createMockCanvas(1920, 1080);
    const cm = new CanvasManager(canvas, { getDevicePixelRatio: () => 2 });

    const v = cm.toVirtual(200, 400);
    expect(v.x).toBeCloseTo(100);
    expect(v.y).toBeCloseTo(200);
  });

  it('toPhysical ↔ toVirtual 왕복 변환이 일치한다', () => {
    const canvas = createMockCanvas(800, 600);
    const cm = new CanvasManager(canvas, {
      virtualWidth: 1920,
      virtualHeight: 1080,
      getDevicePixelRatio: () => 1.5,
    });

    const original = { x: 500, y: 300 };
    const physical = cm.toPhysical(original.x, original.y);
    const back = cm.toVirtual(physical.x, physical.y);

    expect(back.x).toBeCloseTo(original.x, 5);
    expect(back.y).toBeCloseTo(original.y, 5);
  });

  it('resize() 호출 시 새 크기에 맞게 재계산된다', () => {
    const canvas = createResizableMockCanvas(1920, 1080);
    const cm = new CanvasManager(canvas, { getDevicePixelRatio: () => 1 });

    expect(cm.scaleX).toBeCloseTo(1);

    // 화면 크기 변경
    canvas.setClientSize(960, 540);
    cm.resize();

    // 새 스케일: 960/1920 = 0.5
    expect(cm.scaleX).toBeCloseTo(0.5);
    expect(cm.scaleY).toBeCloseTo(0.5);
    expect(canvas.width).toBe(960);
    expect(canvas.height).toBe(540);
  });

  it('가상 해상도 기본값은 1920x1080이다', () => {
    const canvas = createMockCanvas(1920, 1080);
    const cm = new CanvasManager(canvas, { getDevicePixelRatio: () => 1 });

    expect(cm.virtualWidth).toBe(1920);
    expect(cm.virtualHeight).toBe(1080);
  });

  it('커스텀 가상 해상도를 설정할 수 있다', () => {
    const canvas = createMockCanvas(800, 600);
    const cm = new CanvasManager(canvas, {
      virtualWidth: 800,
      virtualHeight: 600,
      getDevicePixelRatio: () => 1,
    });

    expect(cm.virtualWidth).toBe(800);
    expect(cm.virtualHeight).toBe(600);

    // scale은 1:1
    const p = cm.toPhysical(400, 300);
    expect(p.x).toBeCloseTo(400);
    expect(p.y).toBeCloseTo(300);
  });
});
