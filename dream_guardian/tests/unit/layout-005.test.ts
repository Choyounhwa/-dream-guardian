/**
 * [LAYOUT-005] (Issue #572) 준비 자세 화면 레이아웃 설정 이전 - 헤더·카운트다운·안내문 (+글자 textScale)
 *
 * 1. 기본값 특성화 (Characterization):
 *    - 기본 해상도(1080x2160)에서 ReadyPositionRenderer의 각 영역 bounds가 UI_LAYOUT.ready와 일치한다.
 *    - 기존 계산식 대비 오차 1px 미만 정합성 보장.
 * 2. UI_LAYOUT.ready 실시간 변경 반영:
 *    - headerMessage, countdown, skipNotice 좌표 변경 시 매 프레임 재조회.
 * 3. textScale (0.5~3.0) 적용:
 *    - headerMessage, countdown, skipNotice 텍스트 폰트 크기 비례 조절.
 * 4. PresentationContext 오버라이드 최우선 순위 유지:
 *    - context 주입 시 UI_LAYOUT.ready보다 우선 반영.
 * 5. 모션 인식 보호 영역 (신체 실루엣 / alignmentFrame) 불변 유지:
 *    - alignmentFrame은 UI_LAYOUT.ready로 이전되지 않고 모션 보호 구역으로 유지.
 * 6. DEVUI / UILayoutOverride 깊은 병합 및 규칙 검증:
 *    - getLayoutKeyRule 검증 (textScale은 0.5~3.0 step 0.01, 좌표/크기는 integer).
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  ReadyPositionRenderer,
  type ReadyPositionPresentationContext,
} from '../../src/render/ReadyPositionRenderer.js';
import { UI_LAYOUT } from '../../config/ui.config.js';
import { resetLayoutTo, snapshotLayout } from '../../src/dev/DevLayoutPanel.js';
import { applyLayoutOverride, getLayoutKeyRule } from '../../src/core/UILayoutOverride.js';

const pristine = snapshotLayout(UI_LAYOUT);

function createMockCtx() {
  const fontsSet: string[] = [];
  const filledTexts: Array<{ text: string; x: number; y: number; font: string }> = [];
  let _font = '';

  return {
    save: vi.fn(),
    restore: vi.fn(),
    beginPath: vi.fn(),
    rect: vi.fn(),
    fillRect: vi.fn(),
    clearRect: vi.fn(),
    roundRect: vi.fn(),
    arc: vi.fn(),
    fill: vi.fn(),
    stroke: vi.fn(),
    strokeRect: vi.fn(),
    moveTo: vi.fn(),
    lineTo: vi.fn(),
    closePath: vi.fn(),
    setLineDash: vi.fn(),
    get font() {
      return _font;
    },
    set font(v: string) {
      _font = v;
      fontsSet.push(v);
    },
    fillStyle: '',
    strokeStyle: '',
    lineWidth: 1,
    textAlign: 'center',
    textBaseline: 'middle',
    globalAlpha: 1,
    shadowColor: '',
    shadowBlur: 0,
    fillText: vi.fn((text: string, x: number, y: number) => {
      filledTexts.push({ text: String(text), x, y, font: _font });
    }),
    __fontsSet: fontsSet,
    __filledTexts: filledTexts,
  };
}

describe('[LAYOUT-005] Issue #572 준비 자세 화면 레이아웃 설정 이전', () => {
  beforeEach(() => {
    resetLayoutTo(UI_LAYOUT, pristine);
  });

  afterEach(() => {
    resetLayoutTo(UI_LAYOUT, pristine);
    vi.restoreAllMocks();
  });

  describe('1. 기본값 특성화 (Characterization) 및 bounds 정합성', () => {
    it('기본 해상도(1080x2160)에서 UI_LAYOUT.ready 설정값이 정의되어 있고 bounds가 일치한다', () => {
      const renderer = new ReadyPositionRenderer();
      const W = 1080;
      const H = 2160;

      // UI_LAYOUT.ready 가 존재해야 함 (구현 전 Red 유도)
      expect(UI_LAYOUT.ready).toBeDefined();
      expect(UI_LAYOUT.ready.headerMessage).toEqual({
        x: 140,
        y: 180,
        w: 800,
        h: 100,
        textScale: 1.0,
      });
      expect(UI_LAYOUT.ready.countdown).toEqual({
        x: 340,
        y: 794,
        w: 400,
        h: 400,
        textScale: 1.0,
      });
      expect(UI_LAYOUT.ready.skipNotice).toEqual({
        x: 140,
        y: 1861,
        w: 800,
        h: 80,
        textScale: 1.0,
      });

      const headerBounds = renderer.getHeaderMessageBounds(W, H);
      expect(headerBounds.x).toBe(140);
      expect(headerBounds.y).toBe(180);
      expect(headerBounds.w).toBe(800);
      expect(headerBounds.h).toBe(100);

      const countdownBounds = renderer.getCountdownBounds(W, H);
      expect(countdownBounds.x).toBe(340);
      expect(countdownBounds.y).toBe(794);
      expect(countdownBounds.w).toBe(400);
      expect(countdownBounds.h).toBe(400);
      // 기존 비율 기준(2160 * 0.46 - 200 = 793.6) 대비 1px 미만 차이 확인
      expect(Math.abs(countdownBounds.y - 793.6)).toBeLessThan(1.0);

      const skipBounds = renderer.getSkipNoticeBounds(W, H);
      expect(skipBounds.x).toBe(140);
      expect(skipBounds.y).toBe(1861);
      expect(skipBounds.w).toBe(800);
      expect(skipBounds.h).toBe(80);
      // 기존 비율 기준(2160 * 0.88 - 40 = 1860.8) 대비 1px 미만 차이 확인
      expect(Math.abs(skipBounds.y - 1860.8)).toBeLessThan(1.0);
    });

    it('반응형 해상도(540x1080)에서 비례 스케일링이 정확히 적용된다', () => {
      const renderer = new ReadyPositionRenderer();
      const W = 540;
      const H = 1080;
      const scaleX = 540 / 1080; // 0.5
      const scaleY = 1080 / 2160; // 0.5

      const headerBounds = renderer.getHeaderMessageBounds(W, H);
      expect(headerBounds.x).toBeCloseTo(140 * scaleX, 1);
      expect(headerBounds.y).toBeCloseTo(180 * scaleY, 1);
      expect(headerBounds.w).toBeCloseTo(800 * scaleX, 1);
      expect(headerBounds.h).toBeCloseTo(100 * scaleY, 1);

      const countdownBounds = renderer.getCountdownBounds(W, H);
      expect(countdownBounds.x).toBeCloseTo(340 * scaleX, 1);
      expect(countdownBounds.y).toBeCloseTo(794 * scaleY, 1);
      expect(countdownBounds.w).toBeCloseTo(400 * scaleX, 1);
      expect(countdownBounds.h).toBeCloseTo(400 * scaleY, 1);

      const skipBounds = renderer.getSkipNoticeBounds(W, H);
      expect(skipBounds.x).toBeCloseTo(140 * scaleX, 1);
      expect(skipBounds.y).toBeCloseTo(1861 * scaleY, 1);
      expect(skipBounds.w).toBeCloseTo(800 * scaleX, 1);
      expect(skipBounds.h).toBeCloseTo(80 * scaleY, 1);
    });
  });

  describe('2. UI_LAYOUT.ready 실시간 변경 반영 (캐싱 금지)', () => {
    it('UI_LAYOUT.ready 좌표 변경 시 getHeaderMessageBounds가 즉시 반영한다', () => {
      const renderer = new ReadyPositionRenderer();
      const W = 1080;
      const H = 2160;

      UI_LAYOUT.ready.headerMessage.x = 200;
      UI_LAYOUT.ready.headerMessage.y = 250;
      UI_LAYOUT.ready.headerMessage.w = 680;
      UI_LAYOUT.ready.headerMessage.h = 120;

      const bounds = renderer.getHeaderMessageBounds(W, H);
      expect(bounds.x).toBe(200);
      expect(bounds.y).toBe(250);
      expect(bounds.w).toBe(680);
      expect(bounds.h).toBe(120);
    });

    it('UI_LAYOUT.ready 좌표 변경 시 getCountdownBounds가 즉시 반영한다', () => {
      const renderer = new ReadyPositionRenderer();
      const W = 1080;
      const H = 2160;

      UI_LAYOUT.ready.countdown.x = 290;
      UI_LAYOUT.ready.countdown.y = 820;
      UI_LAYOUT.ready.countdown.w = 500;
      UI_LAYOUT.ready.countdown.h = 500;

      const bounds = renderer.getCountdownBounds(W, H);
      expect(bounds.x).toBe(290);
      expect(bounds.y).toBe(820);
      expect(bounds.w).toBe(500);
      expect(bounds.h).toBe(500);
    });

    it('UI_LAYOUT.ready 좌표 변경 시 getSkipNoticeBounds가 즉시 반영한다', () => {
      const renderer = new ReadyPositionRenderer();
      const W = 1080;
      const H = 2160;

      UI_LAYOUT.ready.skipNotice.x = 100;
      UI_LAYOUT.ready.skipNotice.y = 1920;
      UI_LAYOUT.ready.skipNotice.w = 880;
      UI_LAYOUT.ready.skipNotice.h = 100;

      const bounds = renderer.getSkipNoticeBounds(W, H);
      expect(bounds.x).toBe(100);
      expect(bounds.y).toBe(1920);
      expect(bounds.w).toBe(880);
      expect(bounds.h).toBe(100);
    });
  });

  describe('3. textScale (0.5~3.0) 폰트 배율 적용', () => {
    it('headerMessage.textScale 변경 시 헤더 텍스트 폰트 크기가 비례하여 조정된다', () => {
      const renderer = new ReadyPositionRenderer();
      const mockCtx = createMockCtx();
      const W = 1080;
      const H = 2160;

      // 기본 textScale = 1.0
      renderer.render(mockCtx as unknown as CanvasRenderingContext2D, W, H, {
        isAligned: false,
        currentCount: 3,
        countText: '3',
      });
      const defaultHeaderFont = mockCtx.__fontsSet.find((f) => f.includes('sans-serif'));
      expect(defaultHeaderFont).toBeDefined();
      // 기본 1080 * 0.032 = 34.56px
      expect(defaultHeaderFont).toContain('34.56px');

      // textScale = 1.5 적용
      mockCtx.__fontsSet.length = 0;
      UI_LAYOUT.ready.headerMessage.textScale = 1.5;
      renderer.render(mockCtx as unknown as CanvasRenderingContext2D, W, H, {
        isAligned: false,
        currentCount: 3,
        countText: '3',
      });
      const scaledHeaderFont = mockCtx.__fontsSet.find((f) => f.includes('sans-serif'));
      expect(scaledHeaderFont).toBeDefined();
      // 34.56 * 1.5 = 51.84px
      expect(scaledHeaderFont).toContain('51.84px');
    });

    it('countdown.textScale 변경 시 START! 텍스트 및 숫자 폰트 크기가 비례하여 조정된다', () => {
      const renderer = new ReadyPositionRenderer();
      const mockCtx = createMockCtx();
      const W = 1080;
      const H = 2160;

      // 1) START! 상태 (currentCount <= 0)
      // 기본 1080 * 0.09 = 97.2px
      renderer.render(mockCtx as unknown as CanvasRenderingContext2D, W, H, {
        isAligned: true,
        currentCount: 0,
        countText: 'START!',
      });
      const defaultStartFont = mockCtx.__fontsSet.find((f) => f.includes('900') && f.includes('px'));
      expect(defaultStartFont).toBeDefined();
      expect(defaultStartFont).toContain('97.2px');

      // textScale = 2.0 적용 -> 97.2 * 2.0 = 194.4px
      mockCtx.__fontsSet.length = 0;
      UI_LAYOUT.ready.countdown.textScale = 2.0;
      renderer.render(mockCtx as unknown as CanvasRenderingContext2D, W, H, {
        isAligned: true,
        currentCount: 0,
        countText: 'START!',
      });
      const scaledStartFont = mockCtx.__fontsSet.find((f) => f.includes('900') && f.includes('px'));
      expect(scaledStartFont).toBeDefined();
      expect(scaledStartFont).toContain('194.4px');
    });

    it('skipNotice.textScale 변경 시 스킵 안내문 폰트 크기가 비례하여 조정된다', () => {
      const renderer = new ReadyPositionRenderer();
      const mockCtx = createMockCtx();
      const W = 1080;
      const H = 2160;

      // 기본 1080 * 0.024 = 25.92px
      renderer.render(mockCtx as unknown as CanvasRenderingContext2D, W, H, {
        isAligned: false,
        currentCount: 3,
        countText: '3',
      });
      // skipNotice 폰트: `${fontSize}px sans-serif` (weight 없음)
      const defaultSkipFont = mockCtx.__fontsSet.find(
        (f) => !f.includes('bold') && !f.includes('900') && f.includes('sans-serif'),
      );
      expect(defaultSkipFont).toBeDefined();
      expect(defaultSkipFont).toBe('500 25.92px sans-serif');

      // textScale = 0.5 적용 -> 25.92 * 0.5 = 12.96px
      mockCtx.__fontsSet.length = 0;
      UI_LAYOUT.ready.skipNotice.textScale = 0.5;
      renderer.render(mockCtx as unknown as CanvasRenderingContext2D, W, H, {
        isAligned: false,
        currentCount: 3,
        countText: '3',
      });
      const scaledSkipFont = mockCtx.__fontsSet.find(
        (f) => !f.includes('bold') && !f.includes('900') && f.includes('sans-serif'),
      );
      expect(scaledSkipFont).toBeDefined();
      expect(scaledSkipFont).toBe('500 12.96px sans-serif');
    });

    it('textScale 허용 범위(0.5~3.0) 밖의 값은 안전하게 클램핑된다', () => {
      const renderer = new ReadyPositionRenderer();
      const mockCtx = createMockCtx();
      const W = 1080;
      const H = 2160;

      // 0.1 설정 시 0.5 로 클램핑 -> 25.92 * 0.5 = 12.96px
      UI_LAYOUT.ready.skipNotice.textScale = 0.1;
      renderer.render(mockCtx as unknown as CanvasRenderingContext2D, W, H, {
        isAligned: false,
        currentCount: 3,
        countText: '3',
      });
      let font = mockCtx.__fontsSet.find(
        (f) => !f.includes('bold') && !f.includes('900') && f.includes('sans-serif'),
      );
      expect(font).toBe('500 12.96px sans-serif');

      // 5.0 설정 시 3.0 으로 클램핑 -> 25.92 * 3.0 = 77.76px
      mockCtx.__fontsSet.length = 0;
      UI_LAYOUT.ready.skipNotice.textScale = 5.0;
      renderer.render(mockCtx as unknown as CanvasRenderingContext2D, W, H, {
        isAligned: false,
        currentCount: 3,
        countText: '3',
      });
      font = mockCtx.__fontsSet.find(
        (f) => !f.includes('bold') && !f.includes('900') && f.includes('sans-serif'),
      );
      expect(font).toBe('500 77.76px sans-serif');
    });
  });

  describe('4. ReadyPositionPresentationContext 오버라이드 최우선 순위 보존', () => {
    it('context 오버라이드가 주입되면 UI_LAYOUT.ready보다 context 설정이 우선한다', () => {
      const customCtx: ReadyPositionPresentationContext = {
        headerMessage: { x: 50, y: 80, w: 900, h: 150, text: '커스텀 헤더' },
        countdown: { x: 200, y: 600, w: 600, h: 600 },
        skipNotice: { x: 80, y: 2000, w: 920, h: 90 },
      };
      const renderer = new ReadyPositionRenderer(customCtx);
      const W = 1080;
      const H = 2160;

      const headerBounds = renderer.getHeaderMessageBounds(W, H);
      expect(headerBounds.x).toBe(50);
      expect(headerBounds.y).toBe(80);
      expect(headerBounds.w).toBe(900);
      expect(headerBounds.h).toBe(150);

      const countdownBounds = renderer.getCountdownBounds(W, H);
      expect(countdownBounds.x).toBe(200);
      expect(countdownBounds.y).toBe(600);
      expect(countdownBounds.w).toBe(600);
      expect(countdownBounds.h).toBe(600);

      const skipBounds = renderer.getSkipNoticeBounds(W, H);
      expect(skipBounds.x).toBe(80);
      expect(skipBounds.y).toBe(2000);
      expect(skipBounds.w).toBe(920);
      expect(skipBounds.h).toBe(90);

      // clearPresentationContext 후에는 다시 UI_LAYOUT.ready 기준 적용
      renderer.clearPresentationContext();
      const restoredHeader = renderer.getHeaderMessageBounds(W, H);
      expect(restoredHeader.x).toBe(140);
      expect(restoredHeader.y).toBe(180);
    });
  });

  describe('5. 모션 인식 보호 영역 (신체 실루엣 / alignmentFrame) 불변 유지', () => {
    it('alignmentFrame은 UI_LAYOUT.ready 변경에 영향을 받지 않고 보호 영역을 유지한다', () => {
      const renderer = new ReadyPositionRenderer();
      const W = 1080;
      const H = 2160;

      const alignBounds = renderer.getAlignmentFrameBounds(W, H);
      expect(alignBounds.w).toBeCloseTo(W * 0.54, 1);
      expect(alignBounds.h).toBeCloseTo(H * 0.62, 1);
      expect(alignBounds.x).toBeCloseTo((W - alignBounds.w) / 2, 1);
      expect(alignBounds.y).toBeCloseTo(H * 0.18, 1);
      expect(alignBounds.isProtected).toBe(true);

      expect(renderer.isSlotLocked('alignmentFrame')).toBe(true);
      expect(renderer.isSlotLocked('body_alignment_area')).toBe(true);
      expect(renderer.getSlotLockReason('alignmentFrame')).toContain('body_alignment_area');
    });
  });

  describe('6. UILayoutOverride 및 레이아웃 규칙 통합 검증', () => {
    it('getLayoutKeyRule이 ready 하위의 textScale 및 좌표/크기 키에 적절한 규칙을 반환한다', () => {
      const ruleTextScale = getLayoutKeyRule('ready.headerMessage.textScale');
      expect(ruleTextScale.min).toBe(0.5);
      expect(ruleTextScale.max).toBe(3.0);
      expect(ruleTextScale.step).toBe(0.01);
      expect(ruleTextScale.integer).toBe(false);

      const ruleX = getLayoutKeyRule('ready.headerMessage.x');
      expect(ruleX.min).toBe(0);
      expect(ruleX.max).toBe(1080);
      expect(ruleX.integer).toBe(true);

      const ruleY = getLayoutKeyRule('ready.countdown.y');
      expect(ruleY.min).toBe(0);
      expect(ruleY.max).toBe(2160);
      expect(ruleY.integer).toBe(true);

      const ruleW = getLayoutKeyRule('ready.skipNotice.w');
      expect(ruleW.min).toBe(1);
      expect(ruleW.max).toBe(1080);
      expect(ruleW.integer).toBe(true);
    });

    it('applyLayoutOverride를 통해 ready 하위 속성이 깊은 병합으로 수정된다', () => {
      const result = applyLayoutOverride(UI_LAYOUT, {
        ready: {
          headerMessage: { x: 160, textScale: 1.25 },
          countdown: { y: 800 },
        },
      });

      expect(result.applied).toContain('ready.headerMessage.x');
      expect(result.applied).toContain('ready.headerMessage.textScale');
      expect(result.applied).toContain('ready.countdown.y');
      expect(UI_LAYOUT.ready.headerMessage.x).toBe(160);
      expect(UI_LAYOUT.ready.headerMessage.textScale).toBe(1.25);
      expect(UI_LAYOUT.ready.countdown.y).toBe(800);
    });
  });
});
