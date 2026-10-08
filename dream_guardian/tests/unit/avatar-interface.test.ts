import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { IAvatarRenderer } from '../../src/skeleton/IAvatarRenderer.js';
import { StickmanRenderer } from '../../src/skeleton/StickmanRenderer.js';
import { AppBootstrap } from '../../src/core/AppBootstrap.js';
import type { NormalizedLandmark } from '../../src/types/index.js';

/**
 * 2D 스프라이트 또는 3D 캐릭터 렌더러 대체제를 모사하는 Mock 구현체
 */
class MockSpriteAvatarRenderer implements IAvatarRenderer {
  public scale = 1.0;
  public hasPose = false;
  public currentAnchorXRatio = 0.5;
  public updateCount = 0;
  public fallbackCount = 0;
  public renderCount = 0;
  public resetCount = 0;
  public lastLandmarks: readonly NormalizedLandmark[] | null = null;
  public lastOptions: any = null;
  public lastIsRunning = false;

  setScale(val: number): void {
    this.scale = Math.max(0.1, val);
  }

  update(
    _dt: number,
    poseLandmarks?: readonly NormalizedLandmark[] | null,
    options?: any,
  ): void {
    this.updateCount++;
    this.lastLandmarks = poseLandmarks ?? null;
    this.lastOptions = options;
    this.hasPose = !!(poseLandmarks && poseLandmarks.length >= 25);
    if (options?.anchorX !== undefined) {
      this.currentAnchorXRatio = options.anchorX;
    }
  }

  updateFallback(_dt: number, isRunning?: boolean): void {
    this.fallbackCount++;
    this.hasPose = false;
    this.lastIsRunning = !!isRunning;
  }

  render(
    ctx: CanvasRenderingContext2D,
    vw: number,
    vh: number,
    _options?: any,
  ): void {
    this.renderCount++;
    ctx.save();
    ctx.fillStyle = '#00FFCC';
    ctx.fillRect(vw * this.currentAnchorXRatio - 20, vh * 0.7 - 40, 40, 80);
    ctx.restore();
  }

  reset(): void {
    this.resetCount++;
    this.hasPose = false;
    this.currentAnchorXRatio = 0.5;
  }
}

function createDummyPoseLandmarks(): NormalizedLandmark[] {
  const landmarks: NormalizedLandmark[] = [];
  for (let i = 0; i < 33; i++) {
    landmarks.push({
      x: 0.5,
      y: 0.5,
      z: 0,
      visibility: 0.9,
    });
  }
  return landmarks;
}

function createMockContext2D(): CanvasRenderingContext2D {
  return {
    save: vi.fn(),
    restore: vi.fn(),
    beginPath: vi.fn(),
    closePath: vi.fn(),
    moveTo: vi.fn(),
    lineTo: vi.fn(),
    arc: vi.fn(),
    arcTo: vi.fn(),
    ellipse: vi.fn(),
    stroke: vi.fn(),
    fill: vi.fn(),
    fillRect: vi.fn(),
    strokeRect: vi.fn(),
    clearRect: vi.fn(),
    fillText: vi.fn(),
    measureText: vi.fn().mockReturnValue({ width: 50 }),
    setLineDash: vi.fn(),
    createLinearGradient: vi.fn().mockReturnValue({
      addColorStop: vi.fn(),
    }),
    createRadialGradient: vi.fn().mockReturnValue({
      addColorStop: vi.fn(),
    }),
    canvas: { width: 1920, height: 1080 },
  } as unknown as CanvasRenderingContext2D;
}

function createMockCanvas(clientW = 800, clientH = 600, ctx = createMockContext2D()) {
  let width = clientW;
  let height = clientH;
  const listeners: Record<string, Function[]> = {};

  return {
    clientWidth: clientW,
    clientHeight: clientH,
    get width() {
      return width;
    },
    set width(v: number) {
      width = v;
    },
    get height() {
      return height;
    },
    set height(v: number) {
      height = v;
    },
    getContext: () => ctx,
    getBoundingClientRect: () => ({ left: 0, top: 0, width: clientW, height: clientH }),
    addEventListener: vi.fn((type: string, fn: any) => {
      listeners[type] = listeners[type] || [];
      listeners[type].push(fn);
    }),
    removeEventListener: vi.fn((type: string, fn: any) => {
      if (listeners[type]) {
        listeners[type] = listeners[type].filter((cb) => cb !== fn);
      }
    }),
    dispatchEvent: vi.fn((event: any) => {
      const cbs = listeners[event.type] || [];
      cbs.forEach((cb) => cb(event));
      return true;
    }),
  } as unknown as HTMLCanvasElement;
}

describe('IAvatarRenderer Interface and Polymorphism (#491)', () => {
  let ctx: CanvasRenderingContext2D;
  let originalWindow: any;
  let originalDocument: any;
  let mockWindowListeners: Record<string, Function[]>;
  let mockDocumentListeners: Record<string, Function[]>;

  beforeEach(() => {
    ctx = createMockContext2D();
    mockWindowListeners = {};
    mockDocumentListeners = {};

    originalWindow = (globalThis as any).window;
    originalDocument = (globalThis as any).document;

    (globalThis as any).window = {
      innerWidth: 1024,
      innerHeight: 768,
      addEventListener: vi.fn((type: string, fn: any) => {
        mockWindowListeners[type] = mockWindowListeners[type] || [];
        mockWindowListeners[type].push(fn);
      }),
      removeEventListener: vi.fn((type: string, fn: any) => {
        if (mockWindowListeners[type]) {
          mockWindowListeners[type] = mockWindowListeners[type].filter((cb) => cb !== fn);
        }
      }),
      dispatchEvent: vi.fn((event: any) => {
        const cbs = mockWindowListeners[event.type] || [];
        cbs.forEach((cb) => cb(event));
        return true;
      }),
      location: { reload: vi.fn() },
    };

    (globalThis as any).document = {
      addEventListener: vi.fn((type: string, fn: any) => {
        mockDocumentListeners[type] = mockDocumentListeners[type] || [];
        mockDocumentListeners[type].push(fn);
      }),
      removeEventListener: vi.fn((type: string, fn: any) => {
        if (mockDocumentListeners[type]) {
          mockDocumentListeners[type] = mockDocumentListeners[type].filter((cb) => cb !== fn);
        }
      }),
      dispatchEvent: vi.fn((event: any) => {
        const cbs = mockDocumentListeners[event.type] || [];
        cbs.forEach((cb) => cb(event));
        return true;
      }),
    };
  });

  afterEach(() => {
    (globalThis as any).window = originalWindow;
    (globalThis as any).document = originalDocument;
  });

  describe('StickmanRenderer conforms to IAvatarRenderer', () => {
    it('should satisfy IAvatarRenderer contract', () => {
      const stickman: IAvatarRenderer = new StickmanRenderer();

      // Properties & getters
      expect(typeof stickman.scale).toBe('number');
      expect(typeof stickman.hasPose).toBe('boolean');
      expect(typeof stickman.currentAnchorXRatio).toBe('number');
      expect(stickman.hasPose).toBe(false);
      expect(stickman.currentAnchorXRatio).toBeCloseTo(0.5, 1);

      // setScale
      stickman.setScale(1.5);
      expect(stickman.scale).toBe(1.5);
      stickman.scale = 2.0;
      expect(stickman.scale).toBe(2.0);

      // updateFallback
      expect(() => stickman.updateFallback(0.016, false)).not.toThrow();
      expect(() => stickman.updateFallback(0.016, true)).not.toThrow();

      // update with landmarks
      const landmarks = createDummyPoseLandmarks();
      expect(() => stickman.update(0.016, landmarks)).not.toThrow();
      expect(stickman.hasPose).toBe(true);

      // update with null / empty landmarks
      expect(() => stickman.update(0.016, null)).not.toThrow();
      expect(stickman.hasPose).toBe(false);

      // render
      expect(() => stickman.render(ctx, 1920, 1080)).not.toThrow();
      expect(() => stickman.render(ctx, 1920, 1080, { alwaysRender: true, alpha: 0.8 })).not.toThrow();

      // reset
      expect(() => stickman.reset()).not.toThrow();
      expect(stickman.hasPose).toBe(false);
    });

    it('should support update with breathScale number or options object', () => {
      const stickman: IAvatarRenderer = new StickmanRenderer();
      const landmarks = createDummyPoseLandmarks();

      // Calling with options object (mirror / breathScale)
      stickman.update(0.016, landmarks, { mirror: true, breathScale: 1.1 });
      expect(stickman.hasPose).toBe(true);

      // Calling with number breathScale (legacy compatibility)
      stickman.update(0.016, landmarks, 1.2);
      expect(stickman.hasPose).toBe(true);
    });
  });

  describe('Character Replacement with MockSpriteAvatarRenderer', () => {
    it('should allow swapping Stickman with custom sprite renderer', () => {
      const spriteRenderer: IAvatarRenderer = new MockSpriteAvatarRenderer();

      expect(spriteRenderer.scale).toBe(1.0);
      expect(spriteRenderer.hasPose).toBe(false);
      expect(spriteRenderer.currentAnchorXRatio).toBe(0.5);

      spriteRenderer.setScale(1.8);
      expect(spriteRenderer.scale).toBe(1.8);

      // Fallback
      spriteRenderer.updateFallback(0.033, true);
      const mockInstance = spriteRenderer as MockSpriteAvatarRenderer;
      expect(mockInstance.fallbackCount).toBe(1);
      expect(mockInstance.lastIsRunning).toBe(true);

      // Landmarks update
      const landmarks = createDummyPoseLandmarks();
      spriteRenderer.update(0.016, landmarks, { anchorX: 0.65 });
      expect(mockInstance.updateCount).toBe(1);
      expect(spriteRenderer.hasPose).toBe(true);
      expect(spriteRenderer.currentAnchorXRatio).toBe(0.65);

      // Render
      spriteRenderer.render(ctx, 1920, 1080);
      expect(mockInstance.renderCount).toBe(1);
      expect(ctx.fillRect).toHaveBeenCalled();

      // Reset
      spriteRenderer.reset();
      expect(mockInstance.resetCount).toBe(1);
      expect(spriteRenderer.hasPose).toBe(false);
      expect(spriteRenderer.currentAnchorXRatio).toBe(0.5);
    });

    it('should process a polymorphic array of avatar renderers uniformly', () => {
      const avatars: IAvatarRenderer[] = [
        new StickmanRenderer(),
        new MockSpriteAvatarRenderer(),
      ];

      const landmarks = createDummyPoseLandmarks();

      for (const avatar of avatars) {
        avatar.setScale(1.2);
        avatar.update(0.016, landmarks);
        expect(avatar.hasPose).toBe(true);
        expect(avatar.scale).toBe(1.2);
        avatar.render(ctx, 1920, 1080);
        avatar.reset();
        expect(avatar.hasPose).toBe(false);
      }
    });
  });

  describe('AppBootstrap Dependency Injection and Scene Compatibility', () => {
    it('should accept custom avatarRenderer in AppBootstrap options', () => {
      const mockRenderer = new MockSpriteAvatarRenderer();
      const mockCanvas = createMockCanvas(800, 600, ctx);

      const app = new AppBootstrap({
        canvas: mockCanvas,
        autoStartCamera: false,
        avatarRenderer: mockRenderer,
      } as any);

      expect(app.stickmanRenderer).toBe(mockRenderer);
      expect(app.stickmanRenderer.scale).toBe(1.0);

      // Verify interface methods on injected renderer
      app.stickmanRenderer.setScale(1.3);
      expect(mockRenderer.scale).toBe(1.3);

      app.stickmanRenderer.updateFallback(0.016, false);
      expect(mockRenderer.fallbackCount).toBe(1);

      app.stickmanRenderer.render(ctx, 1920, 1080);
      expect(mockRenderer.renderCount).toBe(1);
    });

    it('should default to StickmanRenderer if avatarRenderer option is not provided', () => {
      const mockCanvas = createMockCanvas(800, 600, ctx);

      const app = new AppBootstrap({
        canvas: mockCanvas,
        autoStartCamera: false,
      });

      expect(app.stickmanRenderer).toBeInstanceOf(StickmanRenderer);
      expect(typeof app.stickmanRenderer.currentAnchorXRatio).toBe('number');
      expect(typeof app.stickmanRenderer.scale).toBe('number');
    });
  });
});
