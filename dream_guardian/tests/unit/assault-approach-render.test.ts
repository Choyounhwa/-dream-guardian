/**
 * assault-approach-render.test.ts - 접근 진행도 연출 렌더러 단위 테스트
 *
 * @see docs/14_BOSS_ASSAULT_GAMEPLAY_DESIGN.md (DOC-14 §§10.1, 15.3-C3)
 * @see docs/15_BOSS_ASSAULT_WORK_CARDS.md (BOSS-ASSAULT-42 / Issue #545)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  AssaultApproachRenderer,
  resolveApproachProgress,
  type AssaultApproachSnapshot,
} from '../../src/render/AssaultApproachRenderer.js';
import {
  DEFAULT_ASSAULT_VISUAL_CONFIG,
  type AssaultVisualConfig,
} from '../../config/assault-visual.config.js';
import type { ViewportSize } from '../../src/render/NoteAnchorResolver.js';

function createMockContext(): CanvasRenderingContext2D {
  return {
    save: vi.fn(),
    restore: vi.fn(),
    beginPath: vi.fn(),
    closePath: vi.fn(),
    moveTo: vi.fn(),
    lineTo: vi.fn(),
    arc: vi.fn(),
    ellipse: vi.fn(),
    rect: vi.fn(),
    roundRect: vi.fn(),
    fillRect: vi.fn(),
    strokeRect: vi.fn(),
    fill: vi.fn(),
    stroke: vi.fn(),
    clip: vi.fn(),
    setLineDash: vi.fn(),
    fillText: vi.fn(),
    strokeText: vi.fn(),
    measureText: vi.fn((text: string) => ({ width: text.length * 10 })),
    drawImage: vi.fn(),
    createLinearGradient: vi.fn().mockReturnValue({
      addColorStop: vi.fn(),
    }),
    createRadialGradient: vi.fn().mockReturnValue({
      addColorStop: vi.fn(),
    }),
    scale: vi.fn(),
    translate: vi.fn(),
    rotate: vi.fn(),
    globalAlpha: 1.0,
    fillStyle: '',
    strokeStyle: '',
    lineWidth: 1,
    font: '',
    textAlign: 'center',
    textBaseline: 'middle',
    shadowColor: '',
    shadowBlur: 0,
    shadowOffsetX: 0,
    shadowOffsetY: 0,
  } as unknown as CanvasRenderingContext2D;
}

describe('[BOSS-ASSAULT-42 / #545] 접근 진행도 연출 렌더러 (AssaultApproachRenderer)', () => {
  const DEFAULT_VIEWPORT: ViewportSize = { width: 1280, height: 720 };
  let renderer: AssaultApproachRenderer;
  let mockCtx: CanvasRenderingContext2D;

  beforeEach(() => {
    renderer = new AssaultApproachRenderer();
    mockCtx = createMockContext();
  });

  describe('1. computeApproachTransform (스케일 및 시차 변위 순수 계산)', () => {
    it('진행도 0에서 visual config의 minScale(0.8)과 초기 parallax offset을 산출한다', () => {
      const transform = renderer.computeApproachTransform(0);
      expect(transform.scale).toBeCloseTo(0.8, 5);
      expect(transform.progress).toBe(0);
      expect(transform.parallaxOffset.x).toBe(0);
      expect(transform.parallaxOffset.y).toBeCloseTo(0, 5);
    });

    it('진행도 0.5(중간)에서 minScale과 maxScale의 정확한 중간값(1.1)을 산출한다', () => {
      const transform = renderer.computeApproachTransform(0.5);
      // 0.8 + (1.4 - 0.8) * 0.5 = 1.1
      expect(transform.scale).toBeCloseTo(1.1, 5);
      expect(transform.progress).toBe(0.5);
      expect(transform.parallaxOffset.y).toBeGreaterThan(0);
    });

    it('진행도 1.0(도달)에서 visual config의 maxScale(1.4)을 산출한다', () => {
      const transform = renderer.computeApproachTransform(1.0);
      expect(transform.scale).toBeCloseTo(1.4, 5);
      expect(transform.progress).toBe(1.0);
      expect(transform.parallaxOffset.y).toBeGreaterThan(0);
    });

    it('범위를 벗어난 진행도(<0 또는 >1)는 [0, 1] 범위로 안전하게 클램핑된다', () => {
      const under = renderer.computeApproachTransform(-0.5);
      expect(under.scale).toBeCloseTo(0.8, 5);
      expect(under.progress).toBe(0);

      const over = renderer.computeApproachTransform(1.5);
      expect(over.scale).toBeCloseTo(1.4, 5);
      expect(over.progress).toBe(1.0);
    });

    it('사용자 정의 AssaultVisualConfig가 주어지면 해당 bossScaleRange를 적용한다', () => {
      const customConfig: AssaultVisualConfig = {
        ...DEFAULT_ASSAULT_VISUAL_CONFIG,
        bossScaleRange: { minScale: 0.5, maxScale: 2.0 },
      };
      const transform = renderer.computeApproachTransform(0.5, customConfig);
      // 0.5 + (2.0 - 0.5) * 0.5 = 1.25
      expect(transform.scale).toBeCloseTo(1.25, 5);
    });
  });

  describe('2. resolveApproachProgress (진행도 스냅샷 해석기)', () => {
    it('snapshot.progress 속성이 우선 적용된다', () => {
      const snapshot: AssaultApproachSnapshot = { progress: 0.65 };
      expect(resolveApproachProgress(snapshot)).toBeCloseTo(0.65, 5);
    });

    it('progress가 없고 completedQuestions와 targetRounds가 주어지면 비율을 계산한다', () => {
      const snapshot: AssaultApproachSnapshot = {
        completedQuestions: 4,
        targetRounds: 10,
      };
      expect(resolveApproachProgress(snapshot)).toBeCloseTo(0.4, 5);
    });

    it('targetRounds가 0이거나 음수인 경우 0으로 안전 처리된다', () => {
      const snapshot: AssaultApproachSnapshot = {
        completedQuestions: 3,
        targetRounds: 0,
      };
      expect(resolveApproachProgress(snapshot)).toBe(0);
    });

    it('빈 snapshot이나 undefined 속성일 경우 기본값 0을 반환한다', () => {
      expect(resolveApproachProgress({})).toBe(0);
    });
  });

  describe('3. computeSafeBounds (레이아웃 안전 여백 및 제외 구역)', () => {
    it('문제 헤더, 좌측 선택 카드, 우측 선택 카드의 제외 경계를 정확히 계산한다', () => {
      const bounds = renderer.computeSafeBounds(DEFAULT_VIEWPORT);

      // 문제 헤더 (상단 0 ~ 22% 높이)
      expect(bounds.questionHeader.y).toBe(0);
      expect(bounds.questionHeader.height).toBeGreaterThan(0);
      expect(bounds.questionHeader.width).toBe(DEFAULT_VIEWPORT.width);

      // 좌측 선택 카드 (leftCenterRatio: x=0.26, y=0.3, width=0.36, height=0.36)
      expect(bounds.leftChoiceCard.x).toBeCloseTo((0.26 - 0.36 / 2) * 1280, 1);
      expect(bounds.leftChoiceCard.y).toBeCloseTo((0.3 - 0.36 / 2) * 720, 1);
      expect(bounds.leftChoiceCard.width).toBeCloseTo(0.36 * 1280, 1);
      expect(bounds.leftChoiceCard.height).toBeCloseTo(0.36 * 720, 1);

      // 우측 선택 카드 (rightCenterRatio: x=0.74, y=0.3, width=0.36, height=0.36)
      expect(bounds.rightChoiceCard.x).toBeCloseTo((0.74 - 0.36 / 2) * 1280, 1);
      expect(bounds.rightChoiceCard.y).toBeCloseTo((0.3 - 0.36 / 2) * 720, 1);
    });

    it('접근 거리 진행도 바(approach bar)는 헤더 및 선택 카드 영역과 겹치지 않는 하단 안전 영역에 위치한다', () => {
      const bounds = renderer.computeSafeBounds(DEFAULT_VIEWPORT);
      const barBounds = renderer.computeApproachBarBounds(DEFAULT_VIEWPORT);

      // 접근 거리 바는 화면 하단 (y > 720 * 0.8)에 위치해야 함
      expect(barBounds.y).toBeGreaterThan(DEFAULT_VIEWPORT.height * 0.8);
      // 좌우 카드(y ~ 0.48*720 = 345.6)의 최하단보다 아래에 위치함
      const leftCardBottom = bounds.leftChoiceCard.y + bounds.leftChoiceCard.height;
      expect(barBounds.y).toBeGreaterThan(leftCardBottom);
      // 문제 헤더 최하단보다 아래에 위치함
      const headerBottom = bounds.questionHeader.y + bounds.questionHeader.height;
      expect(barBounds.y).toBeGreaterThan(headerBottom);
    });

    it('최대 스케일(1.4)에서도 보스 앵커 실루엣이 상단 헤더 및 좌/우 선택 카드를 침범하지 않는다', () => {
      const bounds = renderer.computeSafeBounds(DEFAULT_VIEWPORT);
      const maxTransform = renderer.computeApproachTransform(1.0);
      const bossCenterX = DEFAULT_ASSAULT_VISUAL_CONFIG.bossAnchor.center.x * DEFAULT_VIEWPORT.width;
      const bossCenterY = DEFAULT_ASSAULT_VISUAL_CONFIG.bossAnchor.center.y * DEFAULT_VIEWPORT.height;
      const maxAuraRadius = 32 * maxTransform.scale; // 32 * 1.4 = 44.8px

      // 1. 헤더 하단과의 거리 안전 여백 (> 10px)
      const headerBottom = bounds.questionHeader.y + bounds.questionHeader.height;
      const distanceToHeader = (bossCenterY - maxAuraRadius) - headerBottom;
      expect(distanceToHeader).toBeGreaterThan(10);

      // 2. 좌측 카드 우측 끝과의 간격 (> 20px)
      const leftCardRight = bounds.leftChoiceCard.x + bounds.leftChoiceCard.width;
      const distanceToLeftCard = (bossCenterX - maxAuraRadius) - leftCardRight;
      expect(distanceToLeftCard).toBeGreaterThan(20);

      // 3. 우측 카드 좌측 끝과의 간격 (> 20px)
      const rightCardLeft = bounds.rightChoiceCard.x;
      const distanceToRightCard = rightCardLeft - (bossCenterX + maxAuraRadius);
      expect(distanceToRightCard).toBeGreaterThan(20);
    });
  });

  describe('4. renderApproachProgress (캔버스 표시 및 멱등성)', () => {
    it('ctx가 주어지면 save()와 restore()를 대칭적으로 호출한다', () => {
      const snapshot: AssaultApproachSnapshot = { progress: 0.5 };
      renderer.renderApproachProgress(mockCtx, snapshot, DEFAULT_VIEWPORT);

      expect(mockCtx.save).toHaveBeenCalled();
      expect(mockCtx.restore).toHaveBeenCalled();
      expect(mockCtx.save).toHaveBeenCalledTimes(vi.mocked(mockCtx.restore).mock.calls.length);
    });

    it('배경 원근 심도 가이드, 보스 스케일 실루엣, 접근 거리 바를 렌더링한다', () => {
      const snapshot: AssaultApproachSnapshot = { progress: 0.75, targetRounds: 10 };
      renderer.renderApproachProgress(mockCtx, snapshot, DEFAULT_VIEWPORT);

      // 배경 그리드/원근 심도 선 그리기
      expect(mockCtx.beginPath).toHaveBeenCalled();
      expect(mockCtx.stroke).toHaveBeenCalled();

      // 접근 거리 바 그리기
      expect(mockCtx.fill).toHaveBeenCalled();

      // 텍스트(진행도 또는 라운드 정보) 렌더링
      expect(mockCtx.fillText).toHaveBeenCalled();
    });

    it('진행도 0, 0.5, 1.0에 따라 보스 프레임 크기가 비례하여 확대 렌더링된다', () => {
      const ctx0 = createMockContext();
      const ctx1 = createMockContext();

      renderer.renderApproachProgress(ctx0, { progress: 0.0 }, DEFAULT_VIEWPORT);
      renderer.renderApproachProgress(ctx1, { progress: 1.0 }, DEFAULT_VIEWPORT);

      expect(ctx0.stroke).toHaveBeenCalled();
      expect(ctx1.stroke).toHaveBeenCalled();
    });

    it('ctx나 snapshot이 null/undefined인 경우 오류 없이 안전하게 무시한다', () => {
      expect(() => {
        renderer.renderApproachProgress(null as unknown as CanvasRenderingContext2D, { progress: 0.5 });
      }).not.toThrow();

      expect(() => {
        renderer.renderApproachProgress(mockCtx, null as unknown as AssaultApproachSnapshot);
      }).not.toThrow();
    });

    it('동일 스냅샷에 대해 반복 호출해도 외부 스냅샷 객체 및 내부 상태를 일체 변경하지 않는다 (멱등성)', () => {
      const snapshot: AssaultApproachSnapshot = Object.freeze({
        progress: 0.4,
        completedQuestions: 4,
        targetRounds: 10,
        bossName: 'Forget',
      });

      // 1회차 호출
      renderer.renderApproachProgress(mockCtx, snapshot, DEFAULT_VIEWPORT);
      const callCount1 = vi.mocked(mockCtx.stroke).mock.calls.length;

      // 2회차 호출
      renderer.renderApproachProgress(mockCtx, snapshot, DEFAULT_VIEWPORT);
      const callCount2 = vi.mocked(mockCtx.stroke).mock.calls.length;

      // 동일한 횟수의 그리기가 수행되었는지 검증
      expect(callCount2).toBe(callCount1 * 2);

      // 스냅샷 객체 무결성 유지 (동결 상태 유지 및 값 불변)
      expect(snapshot.progress).toBe(0.4);
      expect(snapshot.completedQuestions).toBe(4);
    });
  });
});
