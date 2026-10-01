import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { setFontScale, resetAccessibility } from '../../src/utils/UIText.js';
import { HUDLayer } from '../../src/ui/HUDLayer.js';
import { BottomBar } from '../../src/ui/BottomBar.js';
import { AnswerSelectionRenderer } from '../../src/render/AnswerSelectionRenderer.js';
import type { CursorPosition } from '../../src/input/CursorTracker.js';

function createMockCtx(): CanvasRenderingContext2D {
  return {
    save: vi.fn(),
    restore: vi.fn(),
    beginPath: vi.fn(),
    closePath: vi.fn(),
    rect: vi.fn(),
    fillRect: vi.fn(),
    strokeRect: vi.fn(),
    roundRect: vi.fn(),
    arc: vi.fn(),
    arcTo: vi.fn(),
    ellipse: vi.fn(),
    fill: vi.fn(),
    stroke: vi.fn(),
    moveTo: vi.fn(),
    lineTo: vi.fn(),
    fillText: vi.fn(),
    measureText: vi.fn(() => ({ width: 100 })),
    createLinearGradient: vi.fn(() => ({ addColorStop: vi.fn() })),
    drawImage: vi.fn(),
    globalAlpha: 1,
    fillStyle: '',
    strokeStyle: '',
    lineWidth: 1,
    font: '',
    textAlign: '',
    textBaseline: '',
    shadowColor: '',
    shadowBlur: 0,
  } as unknown as CanvasRenderingContext2D;
}

describe('[A11Y-004 / #265] 저시력 모드 비텍스트 UI 요소 동적 스케일링', () => {
  beforeEach(() => {
    resetAccessibility();
  });

  afterEach(() => {
    resetAccessibility();
  });

  describe('1. 4색 커서 반경 동적 스케일링 (기본 12~16px -> Math.min(32, 기본값 * fontScale))', () => {
    it('getCursorRadius()가 fontScale에 비례하여 스케일링되고 32px로 상한 클램프된다', () => {
      const renderer = new AnswerSelectionRenderer();

      // 기본 16px 기준
      expect(renderer.getCursorRadius(16, 1.0)).toBe(16);
      expect(renderer.getCursorRadius(16, 1.5)).toBe(24);
      expect(renderer.getCursorRadius(16, 2.0)).toBe(32);
      expect(renderer.getCursorRadius(16, 2.5)).toBe(32); // 32px 상한 클램프

      // 기본 12px 기준
      expect(renderer.getCursorRadius(12, 1.0)).toBe(12);
      expect(renderer.getCursorRadius(12, 1.5)).toBe(18);
      expect(renderer.getCursorRadius(12, 2.0)).toBe(24);
      expect(renderer.getCursorRadius(12, 3.0)).toBe(32); // 32px 상한 클램프
    });

    it('UIText.setFontScale에 설정된 전역 배율을 자동으로 참조한다', () => {
      const renderer = new AnswerSelectionRenderer();

      setFontScale(1.0);
      expect(renderer.getCursorRadius(16)).toBe(16);

      setFontScale(1.5);
      expect(renderer.getCursorRadius(16)).toBe(24);

      setFontScale(2.0);
      expect(renderer.getCursorRadius(16)).toBe(32);
    });

    it('render() 실행 시 fontScale=1.0에서는 기존 커서 반경과 100% 동일한 수치를 유지한다', () => {
      const renderer = new AnswerSelectionRenderer();
      const mockCtx = createMockCtx();
      setFontScale(1.0);

      const cursors = new Map<any, CursorPosition>([
        ['leftHand', { type: 'leftHand', source: 'pose', x: 0.3, y: 0.5, confidence: 1, size: { radius: 16 } }],
      ]);

      renderer.render(mockCtx, 1080, 2160, [], cursors, [0, 0]);

      // 첫 번째 arc 호출: 커서 본체 (radius=16)
      expect(mockCtx.arc).toHaveBeenCalledWith(
        expect.any(Number),
        expect.any(Number),
        16,
        0,
        Math.PI * 2,
      );
    });

    it('render() 실행 시 fontScale=1.5에서는 커서 반경이 24px로 확대 렌더링된다', () => {
      const renderer = new AnswerSelectionRenderer();
      const mockCtx = createMockCtx();
      setFontScale(1.5);

      const cursors = new Map<any, CursorPosition>([
        ['leftHand', { type: 'leftHand', source: 'pose', x: 0.3, y: 0.5, confidence: 1, size: { radius: 16 } }],
      ]);

      renderer.render(mockCtx, 1080, 2160, [], cursors, [0, 0]);

      // 커서 본체 반경 16 * 1.5 = 24
      expect(mockCtx.arc).toHaveBeenCalledWith(
        expect.any(Number),
        expect.any(Number),
        24,
        0,
        Math.PI * 2,
      );
    });
  });

  describe('2. HP바 높이 동적 스케일링 (기본 32px -> Math.min(64, 32 * fontScale))', () => {
    it('getHpBarHeight()가 fontScale에 비례하여 스케일링되고 64px로 상한 클램프된다', () => {
      const hud = new HUDLayer();

      expect(hud.getHpBarHeight(1.0)).toBe(32);
      expect(hud.getHpBarHeight(1.5)).toBe(48);
      expect(hud.getHpBarHeight(2.0)).toBe(64);
      expect(hud.getHpBarHeight(2.5)).toBe(64); // 64px 상한 클램프
    });

    it('UIText.setFontScale에 설정된 배율을 참조하여 렌더링 시 높이에 반영된다', () => {
      const hud = new HUDLayer();
      const mockCtx = createMockCtx();

      setFontScale(1.0);
      expect(hud.getHpBarHeight()).toBe(32);

      setFontScale(1.5);
      expect(hud.getHpBarHeight()).toBe(48);

      hud.render(mockCtx, 1080, 2160, {
        playerHp: 80,
        playerMaxHp: 100,
        bossHp: 80,
        bossMaxHp: 100,
        combo: 0,
        chapter: 1,
        guardianStage: 1,
      });

      // fillRect에 높이 48이 전달되었는지 검증
      const fillRectCalls = (mockCtx.fillRect as any).mock.calls;
      const matchingCall = fillRectCalls.find((call: number[]) => call[3] === 48);
      expect(matchingCall).toBeDefined();
    });

    it('fontScale 1.0x에서는 기존 HP바 높이 32px가 유지된다', () => {
      const hud = new HUDLayer();
      const mockCtx = createMockCtx();
      setFontScale(1.0);

      hud.render(mockCtx, 1080, 2160, {
        playerHp: 100,
        playerMaxHp: 100,
        bossHp: 100,
        bossMaxHp: 100,
        combo: 0,
        chapter: 1,
        guardianStage: 1,
      });

      const fillRectCalls = (mockCtx.fillRect as any).mock.calls;
      const matchingCall = fillRectCalls.find((call: number[]) => call[3] === 32);
      expect(matchingCall).toBeDefined();
    });
  });

  describe('3. 마나 게이지 높이 동적 스케일링 (기본 50px -> Math.min(100, 50 * fontScale))', () => {
    it('getManaBarHeight()가 fontScale에 비례하여 스케일링되고 100px로 상한 클램프된다', () => {
      const bar = new BottomBar();

      expect(bar.getManaBarHeight(1.0)).toBe(50);
      expect(bar.getManaBarHeight(1.5)).toBe(75);
      expect(bar.getManaBarHeight(2.0)).toBe(100);
      expect(bar.getManaBarHeight(2.5)).toBe(100); // 100px 상한 클램프
    });

    it('UIText.setFontScale에 설정된 배율을 참조하여 마나 게이지 높이에 반영된다', () => {
      const bar = new BottomBar();
      const mockCtx = createMockCtx();

      setFontScale(1.5);
      expect(bar.getManaBarHeight()).toBe(75);

      // scaleY = 1.0 (w: 1080, h: 2160)
      bar.render(mockCtx, 1080, 2160, {
        mana: 50,
        manaMax: 100,
      });

      // rect 또는 roundRect에 높이 75가 전달되었는지 검증
      const rectCalls = [...(mockCtx.rect as any).mock.calls, ...(mockCtx.roundRect as any).mock.calls];
      const matchingCall = rectCalls.find((call: number[]) => call[3] === 75);
      expect(matchingCall).toBeDefined();
    });

    it('fontScale 1.0x에서는 기존 마나 게이지 높이 50px가 유지된다', () => {
      const bar = new BottomBar();
      const mockCtx = createMockCtx();
      setFontScale(1.0);

      bar.render(mockCtx, 1080, 2160, {
        mana: 50,
        manaMax: 100,
      });

      const rectCalls = [...(mockCtx.rect as any).mock.calls, ...(mockCtx.roundRect as any).mock.calls];
      const matchingCall = rectCalls.find((call: number[]) => call[3] === 50);
      expect(matchingCall).toBeDefined();
    });
  });

  describe('4. 존 테두리 두께 동적 스케일링 (기본 3~4px -> Math.min(8, 기본두께 * fontScale))', () => {
    it('getZoneBorderWidth()가 fontScale에 비례하여 스케일링되고 8px로 상한 클램프된다', () => {
      const renderer = new AnswerSelectionRenderer();

      // 기본 4px 기준
      expect(renderer.getZoneBorderWidth(4, 1.0)).toBe(4);
      expect(renderer.getZoneBorderWidth(4, 1.5)).toBe(6);
      expect(renderer.getZoneBorderWidth(4, 2.0)).toBe(8);
      expect(renderer.getZoneBorderWidth(4, 2.5)).toBe(8); // 8px 상한 클램프

      // 기본 3px 기준
      expect(renderer.getZoneBorderWidth(3, 1.0)).toBe(3);
      expect(renderer.getZoneBorderWidth(3, 1.5)).toBe(4.5);
      expect(renderer.getZoneBorderWidth(3, 2.0)).toBe(6);
      expect(renderer.getZoneBorderWidth(3, 3.0)).toBe(8); // 8px 상한 클램프
    });

    it('activeZones 렌더링 시 fontScale 배율에 따라 테두리 두께(lineWidth)가 조정된다', () => {
      const renderer = new AnswerSelectionRenderer();
      const mockCtx = createMockCtx();
      const activeZones = [
        { id: 1, label: '좌상', x: 0.1, y: 0.1, width: 0.3, height: 0.2 },
      ];

      setFontScale(1.5);
      renderer.render(mockCtx, 1080, 2160, activeZones, new Map(), [0, 0]);

      // getZoneBorderWidth(3.5, 1.5) = Math.min(8, 3.5 * 1.5) = 5.25 또는 기본 3px -> 4.5
      expect(mockCtx.lineWidth).toBeGreaterThanOrEqual(4.5);
      expect(mockCtx.lineWidth).toBeLessThanOrEqual(8);
    });

    it('fontScale 1.0x에서는 기본 두께를 유지한다', () => {
      const renderer = new AnswerSelectionRenderer();
      const mockCtx = createMockCtx();
      const activeZones = [
        { id: 1, label: '좌상', x: 0.1, y: 0.1, width: 0.3, height: 0.2 },
      ];

      setFontScale(1.0);
      renderer.render(mockCtx, 1080, 2160, activeZones, new Map(), [0, 0]);

      expect(mockCtx.lineWidth).toBeLessThanOrEqual(4);
    });
  });
});
