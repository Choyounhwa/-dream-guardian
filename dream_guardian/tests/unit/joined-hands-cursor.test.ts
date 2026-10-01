import { describe, it, expect, vi } from 'vitest';
import { drawJoinedHandsCursor } from '../../src/render/JoinedHandsCursorRenderer.js';
import { CURSOR_DIMENSIONS, JOINED_HANDS_CURSOR } from '../../config/cursor.config.js';
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
    arc: vi.fn(),
    arcTo: vi.fn(),
    ellipse: vi.fn(),
    fill: vi.fn(),
    stroke: vi.fn(),
    moveTo: vi.fn(),
    lineTo: vi.fn(),
    fillText: vi.fn(),
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

describe('Issue #201 [FEAT-CURSOR-005] 양손 선택 커서 3배 확대 및 원거리 시인성 강화', () => {
  describe('1. 양손 모으기(합장) 커서 설정 규격 (cursor.config.ts)', () => {
    it('JOINED_HANDS_CURSOR 및 CURSOR_DIMENSIONS.joinedHands에 3배 확대 규격이 정의되어 있다', () => {
      expect(JOINED_HANDS_CURSOR).toBeDefined();
      expect(CURSOR_DIMENSIONS.joinedHands).toBeDefined();

      // 합장 외곽 네온 링 반경: 기존 34px -> 100px (지름 200px, 3배 확대)
      expect(JOINED_HANDS_CURSOR.ringRadius).toBe(100);
      expect(CURSOR_DIMENSIONS.joinedHands.ringRadius).toBe(100);

      // 펄스 진폭: 기존 4px -> 10~12px
      expect(JOINED_HANDS_CURSOR.pulseAmplitude).toBeGreaterThanOrEqual(10);
      expect(JOINED_HANDS_CURSOR.pulseAmplitude).toBeLessThanOrEqual(12);

      // 선 두께: 기존 3.5px -> 8px
      expect(JOINED_HANDS_CURSOR.lineWidth).toBe(8);

      // 중심 텍스트 폰트: 기존 14px -> 40px
      expect(JOINED_HANDS_CURSOR.fontSize).toBe(40);

      // 충전 아크 반경: 기존 50px -> 145~150px
      expect(JOINED_HANDS_CURSOR.progressRadius).toBeGreaterThanOrEqual(145);
      expect(JOINED_HANDS_CURSOR.progressRadius).toBeLessThanOrEqual(150);

      // 충전 아크 두께: 기존 7px -> 16px, 발광 블러 24px
      expect(JOINED_HANDS_CURSOR.progressLineWidth).toBe(16);
      expect(JOINED_HANDS_CURSOR.progressBlur).toBe(24);
    });

    it('인게임 손 커서(hand)의 기본/최대 반경이 원거리 1m+ 시인성에 맞게 상향되어 있다', () => {
      expect(CURSOR_DIMENSIONS.hand.defaultRadius).toBeGreaterThanOrEqual(60);
      expect(CURSOR_DIMENSIONS.hand.maxRadius).toBeGreaterThanOrEqual(120);
      expect(CURSOR_DIMENSIONS.hand.minRadius).toBeGreaterThanOrEqual(20);
      expect(CURSOR_DIMENSIONS.hand.pulseRingOffset).toBeGreaterThanOrEqual(10);
      expect(CURSOR_DIMENSIONS.hand.pulseRingAmplitude).toBeGreaterThanOrEqual(6);
      expect(CURSOR_DIMENSIONS.hand.pulseLineWidth).toBeGreaterThanOrEqual(3);
    });
  });

  describe('2. drawJoinedHandsCursor 렌더링 검증 (JoinedHandsCursorRenderer)', () => {
    it('외곽 합장 네온 링이 반경 100px(±12px 펄스) 및 선 두께 8px로 렌더링된다', () => {
      const ctx = createMockCtx();
      const vw = 1080;
      const vh = 2160;
      const cursorX = 0.5;
      const cursorY = 0.5;

      drawJoinedHandsCursor(ctx, vw, vh, cursorX, cursorY, '손모으기', 0);

      expect(ctx.save).toHaveBeenCalled();
      expect(ctx.restore).toHaveBeenCalled();

      // lineWidth: 8
      expect(ctx.lineWidth).toBe(8);
      // arc 호출 검증 (1회: 외곽 링)
      expect(ctx.arc).toHaveBeenCalledTimes(1);
      const arcArgs = vi.mocked(ctx.arc).mock.calls[0];
      expect(arcArgs[0]).toBeCloseTo(540);
      expect(arcArgs[1]).toBeCloseTo(1080);
      // 반경이 100 ± 12 범위 내
      expect(arcArgs[2]).toBeGreaterThanOrEqual(88);
      expect(arcArgs[2]).toBeLessThanOrEqual(112);
    });

    it('중심 텍스트 폰트가 40px bold로 설정되어 원거리에서도 즉시 식별된다', () => {
      const ctx = createMockCtx();
      drawJoinedHandsCursor(ctx, 1080, 2160, 0.5, 0.5, '메뉴복귀', 0);

      expect(ctx.font).toBe('bold 40px sans-serif');
      expect(ctx.textAlign).toBe('center');
      expect(ctx.textBaseline).toBe('middle');
      expect(ctx.fillText).toHaveBeenCalledWith('메뉴복귀', 540, 1080);
    });

    it('호버 진행도(progress > 0) 시 반경 145px, 두께 16px의 대형 충전 아크가 렌더링된다', () => {
      const ctx = createMockCtx();
      drawJoinedHandsCursor(ctx, 1080, 2160, 0.5, 0.5, '선택', 0.5);

      // arc가 외곽 링(1회) + 프로그레스 아크(1회) 총 2회 호출됨
      expect(ctx.arc).toHaveBeenCalledTimes(2);

      const progressArcArgs = vi.mocked(ctx.arc).mock.calls[1];
      expect(progressArcArgs[0]).toBeCloseTo(540);
      expect(progressArcArgs[1]).toBeCloseTo(1080);
      expect(progressArcArgs[2]).toBe(145); // progressRadius

      // 프로그레스 아크 스타일 검증
      expect(ctx.lineWidth).toBe(16);
      expect(ctx.strokeStyle).toBe('#4DFFAA');
      expect(ctx.shadowColor).toBe('#4DFFAA');
      expect(ctx.shadowBlur).toBe(24);
    });

    it('progress가 0일 때는 충전 아크를 그리지 않는다', () => {
      const ctx = createMockCtx();
      drawJoinedHandsCursor(ctx, 1080, 2160, 0.5, 0.5, '손모으기', 0);

      expect(ctx.arc).toHaveBeenCalledTimes(1);
    });
  });

  describe('3. AnswerSelectionRenderer 인게임 양손 답안 커서 가시성 검증', () => {
    it('인게임 손 커서 라벨(L/R)이 상향된 폰트 크기로 렌더링된다', () => {
      const renderer = new AnswerSelectionRenderer();
      const mockCtx = createMockCtx();
      const cursors = new Map<any, CursorPosition>([
        ['leftHand', { type: 'leftHand', source: 'pose', x: 0.3, y: 0.5, confidence: 1, size: { radius: 60 } }],
        ['rightHand', { type: 'rightHand', source: 'pose', x: 0.7, y: 0.5, confidence: 1, size: { radius: 60 } }],
      ]);

      renderer.render(mockCtx, 1080, 2160, [], cursors, [0, 0]);

      // fillText로 'L'과 'R'이 호출됨
      expect(mockCtx.fillText).toHaveBeenCalledWith('L', expect.any(Number), expect.any(Number));
      expect(mockCtx.fillText).toHaveBeenCalledWith('R', expect.any(Number), expect.any(Number));

      // 손 커서 radius=60일 때 라벨 폰트 크기는 최소 36px 이상이어야 함 (기존: 60*0.65 = 39, radius 45일 땐 29px)
      // Math.round(60 * 0.70) = 42px
      expect(mockCtx.font).toMatch(/bold (?:[3-9]\d|\d{3,})px/);
    });

    it('손 커서의 외곽 펄스 링이 상향된 오프셋 및 두께를 반영하여 렌더링된다', () => {
      const renderer = new AnswerSelectionRenderer();
      const mockCtx = createMockCtx();
      const cursors = new Map<any, CursorPosition>([
        ['leftHand', { type: 'leftHand', source: 'pose', x: 0.3, y: 0.5, confidence: 1, size: { radius: 60 } }],
      ]);

      renderer.render(mockCtx, 1080, 2160, [], cursors, [0, 0]);

      // 왼손 커서에 대해 본체 arc 1회 + 펄스 링 arc 1회 = 총 2회 호출
      expect(mockCtx.arc).toHaveBeenCalledTimes(2);

      const mainArc = vi.mocked(mockCtx.arc).mock.calls[0];
      const pulseArc = vi.mocked(mockCtx.arc).mock.calls[1];

      expect(mainArc[2]).toBe(60); // radius 60
      // pulseArc 반경 = radius(60) + pulseRingOffset(10~12) + pulse
      expect(pulseArc[2]).toBeGreaterThanOrEqual(60 + 10 - 6);
    });
  });
});
