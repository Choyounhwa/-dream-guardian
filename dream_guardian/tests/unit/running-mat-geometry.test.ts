/**
 * running-mat-geometry.test.ts - RunningMatGeometry 순수 기하 및 투영 계산 모듈 단위 테스트
 *
 * @see GitHub Issue #620 [REFACTOR-RENDER-002]
 */

import { describe, it, expect } from 'vitest';
import {
  RunningMatGeometry,
  PROTECTED_RUNNING_MAT_SLOT_IDS,
  type Point2D,
  type RunningMatPresentationContext,
} from '../../src/render/mat/RunningMatGeometry.js';
import {
  RUNNING_MAT_CONFIG,
  DEFAULT_MAT_BASE_Y_TOP,
  DEFAULT_MAT_BASE_Y_BOTTOM,
  DEFAULT_MAT_WIDTH_RATIO,
  DEFAULT_VANISHING_Y_RATIO,
  DEFAULT_STRIKE_LINE_Y_RATIO,
  DEFAULT_STRIKE_OVERHANG_RATIO,
} from '../../config/running-mat.config.js';
import type { RunningMatViewModel } from '../../src/render/RunningMatPresenter.js';
import type { UIPresentationDocument } from '../../src/data/UIPresentation.js';

describe('RunningMatGeometry [REFACTOR-RENDER-002 / #620]', () => {
  const width = 1080;
  const height = 1920;

  describe('1. 3D 사다리꼴 투영 및 소실점/판정선 기하 연산', () => {
    it('소실점(VP) 기본 좌표 및 사용자 정의 오버라이드가 올바르게 산출된다', () => {
      const defaultVP = RunningMatGeometry.computeVanishingPoint(width, height);
      expect(defaultVP.x).toBeCloseTo(width * 0.5, 5);
      expect(defaultVP.y).toBeCloseTo(height * DEFAULT_VANISHING_Y_RATIO, 5);

      const customVP: Point2D = { x: 500, y: 400 };
      const computedCustom = RunningMatGeometry.computeVanishingPoint(width, height, RUNNING_MAT_CONFIG, customVP);
      expect(computedCustom.x).toBe(500);
      expect(computedCustom.y).toBe(400);
    });

    it('computeStrikeLineY 및 computeMatHalfWBottom이 NoteAnchorResolver 공식과 일치한다', () => {
      const yStrike = RunningMatGeometry.computeStrikeLineY(height);
      expect(yStrike).toBeCloseTo(height * DEFAULT_STRIKE_LINE_Y_RATIO, 5);

      const halfWBottom = RunningMatGeometry.computeMatHalfWBottom(width, height);
      expect(halfWBottom).toBeGreaterThan(0);
      expect(halfWBottom).toBeLessThan(width);
    });

    it('computeMatTrapezoid가 3D 원근 사다리꼴의 4개 꼭짓점과 스케일을 정확히 계산한다', () => {
      const trapezoid = RunningMatGeometry.computeMatTrapezoid(width, height);

      expect(trapezoid.vx).toBeCloseTo(width * 0.5, 5);
      expect(trapezoid.yTop).toBeCloseTo(height * DEFAULT_MAT_BASE_Y_TOP, 5);
      expect(trapezoid.yBottom).toBeCloseTo(height * DEFAULT_MAT_BASE_Y_BOTTOM, 5);
      expect(trapezoid.halfWBottom).toBeCloseTo(RunningMatGeometry.computeMatHalfWBottom(width, height), 5);
      expect(trapezoid.scaleTop).toBeLessThan(1.0);
      expect(trapezoid.scaleTop).toBeGreaterThan(0);
      expect(trapezoid.halfWTop).toBeCloseTo(trapezoid.halfWBottom * trapezoid.scaleTop, 5);

      expect(trapezoid.topLeft.x).toBeCloseTo(trapezoid.vx - trapezoid.halfWTop, 5);
      expect(trapezoid.topLeft.y).toBeCloseTo(trapezoid.yTop, 5);
      expect(trapezoid.topRight.x).toBeCloseTo(trapezoid.vx + trapezoid.halfWTop, 5);
      expect(trapezoid.topRight.y).toBeCloseTo(trapezoid.yTop, 5);
      expect(trapezoid.bottomRight.x).toBeCloseTo(trapezoid.vx + trapezoid.halfWBottom, 5);
      expect(trapezoid.bottomRight.y).toBeCloseTo(trapezoid.yBottom, 5);
      expect(trapezoid.bottomLeft.x).toBeCloseTo(trapezoid.vx - trapezoid.halfWBottom, 5);
      expect(trapezoid.bottomLeft.y).toBeCloseTo(trapezoid.yBottom, 5);
    });

    it('computeStrikeLineGeometry가 타격선 시작/끝 및 레인 앵커 X 좌표를 산출한다', () => {
      const geom = RunningMatGeometry.computeStrikeLineGeometry(width, height);
      const overhang = width * DEFAULT_STRIKE_OVERHANG_RATIO;

      expect(geom.yStrike).toBeCloseTo(height * DEFAULT_STRIKE_LINE_Y_RATIO, 5);
      expect(geom.overhang).toBeCloseTo(overhang, 5);
      expect(geom.xStart).toBeCloseTo(-overhang, 5);
      expect(geom.xEnd).toBeCloseTo(width + overhang, 5);

      expect(geom.leftAnchorX).toBeCloseTo(width * (1 / 6), 5);
      expect(geom.centerAnchorX).toBeCloseTo(width * 0.5, 5);
      expect(geom.rightAnchorX).toBeCloseTo(width * (5 / 6), 5);
    });
  });

  describe('2. 3대 레인 및 슬롯 좌표 계산 (computeSlotCoordinates)', () => {
    it('발자국 슬롯 X 좌표가 3대 피트니스 레인(1/6, 1/2, 5/6)과 일치한다', () => {
      const vx = width * 0.5;
      const vy = height * DEFAULT_VANISHING_Y_RATIO;
      const yTop = height * DEFAULT_MAT_BASE_Y_TOP;
      const yBottom = height * DEFAULT_MAT_BASE_Y_BOTTOM;
      const halfWBottom = (width * DEFAULT_MAT_WIDTH_RATIO) * 0.5;
      const yStrike = height * DEFAULT_STRIKE_LINE_Y_RATIO;

      const slots = RunningMatGeometry.computeSlotCoordinates(
        vx,
        vy,
        yTop,
        yBottom,
        halfWBottom,
        width,
        yStrike,
      );

      expect(slots.leftOut.x).toBeCloseTo(width * (1 / 6), 1);
      expect(slots.left.x).toBeCloseTo(width * (1 / 6), 1);
      expect(slots.center.x).toBeCloseTo(width * 0.5, 1);
      expect((slots.leftHome.x + slots.rightHome.x) * 0.5).toBeCloseTo(width * 0.5, 1);
      expect(slots.rightOut.x).toBeCloseTo(width * (5 / 6), 1);
      expect(slots.right.x).toBeCloseTo(width * (5 / 6), 1);

      expect(slots.leftOut.y).toBeCloseTo(yStrike, 1);
      expect(slots.left.y).toBeCloseTo(yStrike, 1);
      expect(slots.center.y).toBeCloseTo(yStrike, 1);
      expect(slots.leftHome.y).toBeCloseTo(yStrike, 1);
      expect(slots.rightHome.y).toBeCloseTo(yStrike, 1);
      expect(slots.right.y).toBeCloseTo(yStrike, 1);
      expect(slots.rightOut.y).toBeCloseTo(yStrike, 1);

      expect(slots.footWidth).toBeGreaterThan(0);
      expect(slots.footHeight).toBeCloseTo(slots.footWidth * 1.8, 5);
    });
  });

  describe('3. 슬롯 잠금, 검증, 오버라이드 로직', () => {
    it('PROTECTED_RUNNING_MAT_SLOT_IDS에 포함된 슬롯은 잠겨있어야 한다', () => {
      expect(PROTECTED_RUNNING_MAT_SLOT_IDS).toContain('strike_line_geometry');
      expect(PROTECTED_RUNNING_MAT_SLOT_IDS).toContain('zone_9_mat_cell');
      expect(PROTECTED_RUNNING_MAT_SLOT_IDS).toContain('zone_10_mat_cell');
      expect(PROTECTED_RUNNING_MAT_SLOT_IDS).toContain('zone_11_mat_cell');
      expect(PROTECTED_RUNNING_MAT_SLOT_IDS).toContain('target_anchors');

      for (const slot of PROTECTED_RUNNING_MAT_SLOT_IDS) {
        expect(RunningMatGeometry.isSlotLocked(slot)).toBe(true);
        expect(RunningMatGeometry.getSlotLockReason(slot)).not.toBeNull();
      }

      expect(RunningMatGeometry.isSlotLocked('custom_random_slot')).toBe(false);
      expect(RunningMatGeometry.getSlotLockReason('custom_random_slot')).toBeNull();
    });

    it('validatePresentationContext가 보호 속성 수정 시도시 이슈를 보고한다', () => {
      const validCtx: RunningMatPresentationContext = {
        strikeLine: { color: '#FF0000' },
      };
      expect(RunningMatGeometry.validatePresentationContext(validCtx).valid).toBe(true);

      const invalidCtx: RunningMatPresentationContext = {
        strikeLine: { y: 100 },
        footprintSlots: { x: 200 },
        targetAnchors: { y: 300 },
        vanishingPoint: { x: 400 },
      };
      const result = RunningMatGeometry.validatePresentationContext(invalidCtx);
      expect(result.valid).toBe(false);
      expect(result.issues.length).toBe(4);
    });

    it('getEffectiveSlotOverride가 슬롯 ID에 따라 알맞은 오버라이드를 반환한다', () => {
      const ctx: RunningMatPresentationContext = {
        strikeLine: { glowColor: '#00FF00' },
        matVisual: { backgroundColor: '#112233' },
        statusHeader: { text: '스텝 테스트' },
      };

      expect(RunningMatGeometry.getEffectiveSlotOverride('strike_line', ctx)?.glowColor).toBe('#00FF00');
      expect(RunningMatGeometry.getEffectiveSlotOverride('zone_9_mat_cell', ctx)?.backgroundColor).toBe('#112233');
      expect(RunningMatGeometry.getEffectiveSlotOverride('status_header', ctx)?.text).toBe('스텝 테스트');
      expect(RunningMatGeometry.getEffectiveSlotOverride('unknown', ctx)).toBeUndefined();
      expect(RunningMatGeometry.getEffectiveSlotOverride('strike_line', undefined)).toBeUndefined();
    });
  });

  describe('4. 시각 영역 Bounds 계산', () => {
    it('getRunningMatBounds 및 getStrikeLineBounds가 정확한 보호 영역을 산출한다', () => {
      const matBounds = RunningMatGeometry.getRunningMatBounds(width, height);
      expect(matBounds.isProtected).toBe(true);
      expect(matBounds.y).toBeCloseTo(height * DEFAULT_MAT_BASE_Y_TOP, 5);
      expect(matBounds.h).toBeCloseTo(height * (DEFAULT_MAT_BASE_Y_BOTTOM - DEFAULT_MAT_BASE_Y_TOP), 5);
      expect(matBounds.w).toBeCloseTo(RunningMatGeometry.computeMatHalfWBottom(width, height) * 2, 5);

      const strikeBounds = RunningMatGeometry.getStrikeLineBounds(width, height);
      expect(strikeBounds.isProtected).toBe(true);
      expect(strikeBounds.w).toBeCloseTo(width + (width * DEFAULT_STRIKE_OVERHANG_RATIO) * 2, 5);
    });

    it('getLaneAnchorBounds가 각 레인별 타깃 앵커 영역을 정확히 반환한다', () => {
      const leftBound = RunningMatGeometry.getLaneAnchorBounds('left', width, height);
      const centerBound = RunningMatGeometry.getLaneAnchorBounds('center', width, height);
      const rightBound = RunningMatGeometry.getLaneAnchorBounds('right', width, height);

      expect(leftBound.x).toBeCloseTo(width * (1 / 6), 5);
      expect(centerBound.x).toBeCloseTo(width * 0.5, 5);
      expect(rightBound.x).toBeCloseTo(width * (5 / 6), 5);
      expect(leftBound.y).toBeCloseTo(height * DEFAULT_STRIKE_LINE_Y_RATIO, 5);

      const z9Bound = RunningMatGeometry.getLaneAnchorBounds(9, width, height);
      const z10Bound = RunningMatGeometry.getLaneAnchorBounds(10, width, height);
      const z11Bound = RunningMatGeometry.getLaneAnchorBounds(11, width, height);
      expect(z9Bound.x).toBeCloseTo(leftBound.x, 5);
      expect(z10Bound.x).toBeCloseTo(centerBound.x, 5);
      expect(z11Bound.x).toBeCloseTo(rightBound.x, 5);
    });

    it('getStatusHeaderBounds 및 getUpcomingPreviewsBounds가 UI_LAYOUT 및 오버라이드를 반영한다', () => {
      const headerBounds = RunningMatGeometry.getStatusHeaderBounds(width, height);
      expect(headerBounds.w).toBeGreaterThan(0);
      expect(headerBounds.h).toBeGreaterThan(0);

      const previewBounds = RunningMatGeometry.getUpcomingPreviewsBounds(width, height);
      expect(previewBounds.w).toBeGreaterThan(0);
      expect(previewBounds.h).toBeGreaterThan(0);

      const overrideCtx: RunningMatPresentationContext = {
        statusHeader: { x: 10, y: 20, w: 300, h: 50 },
      };
      const overriddenHeader = RunningMatGeometry.getStatusHeaderBounds(width, height, RUNNING_MAT_CONFIG, overrideCtx);
      expect(overriddenHeader.x).toBe(10);
      expect(overriddenHeader.y).toBe(20);
      expect(overriddenHeader.w).toBe(300);
      expect(overriddenHeader.h).toBe(50);
    });
  });

  describe('5. 동적 큐 타깃 위치 해석 및 앵커 목록 생성', () => {
    it('resolveNextTargetPoint가 nextCue에 따른 발판 슬롯 좌표를 올바르게 반환한다', () => {
      const vx = width * 0.5;
      const vy = height * DEFAULT_VANISHING_Y_RATIO;
      const yTop = height * DEFAULT_MAT_BASE_Y_TOP;
      const yBottom = height * DEFAULT_MAT_BASE_Y_BOTTOM;
      const halfWBottom = (width * DEFAULT_MAT_WIDTH_RATIO) * 0.5;
      const yStrike = height * DEFAULT_STRIKE_LINE_Y_RATIO;
      const slots = RunningMatGeometry.computeSlotCoordinates(
        vx, vy, yTop, yBottom, halfWBottom, width, yStrike
      );

      const viewLeft: Partial<RunningMatViewModel> = {
        nextCue: {
          beatIndex: 1,
          actionId: 'left_out',
          actionText: '왼발 딛기',
          directionText: '왼쪽',
          cueText: '왼쪽',
          leftFootSlot: 'out',
          rightFootSlot: 'home',
          arrowDirection: 'left',
          isPrepare: false,
        },
      };

      const target = RunningMatGeometry.resolveNextTargetPoint(viewLeft as RunningMatViewModel, slots);
      expect(target).not.toBeNull();
      expect(target!.x).toBeCloseTo(slots.leftOut.x, 5);
      expect(target!.y).toBeCloseTo(slots.leftOut.y, 5);
    });

    it('computeTargetAnchors가 3대 레인 앵커 활성 상태를 정확히 생성한다', () => {
      const view: Partial<RunningMatViewModel> = {
        actionText: '왼발 사이드 스텝',
        currentCue: {
          beatIndex: 0,
          actionId: 'step_left',
          actionText: '왼발 딛기',
          directionText: '왼쪽',
          cueText: '왼쪽',
          leftFootSlot: 'out',
          rightFootSlot: 'home',
          arrowDirection: 'left',
          isPrepare: false,
        },
      };

      const anchors = RunningMatGeometry.computeTargetAnchors(width, height, RUNNING_MAT_CONFIG, view as RunningMatViewModel);
      expect(anchors.length).toBe(3);
      expect(anchors[0].id).toBe('left');
      expect(anchors[0].isActive).toBe(true);
      expect(anchors[1].id).toBe('center');
      expect(anchors[1].isActive).toBe(false);
      expect(anchors[2].id).toBe('right');
      expect(anchors[2].isActive).toBe(false);
    });
  });

  describe('6. fromPresentationDocument', () => {
    it('UIPresentationDocument로부터 presentationContext를 올바르게 구성한다', () => {
      const doc: UIPresentationDocument = {
        kind: 'dream-guardian-ui-presentation',
        version: '1.0.0',
        resolution: { width: 1080, height: 1920 },
        pages: {
          running_question: {
            id: 'running_question',
            name: '러닝 문제',
            elements: [
              {
                id: 'run_header',
                type: 'text',
                x: 100,
                y: 100,
                width: 400,
                height: 50,
                zIndex: 1,
                visible: true,
                style: {},
                text: '러닝 헤더 커스텀 텍스트',
              },
            ],
          },
        } as any,
      };

      const ctx = RunningMatGeometry.fromPresentationDocument(doc, 'running_question');
      expect(ctx.strikeLine?.glowColor).toBe('#FF6600');
      expect(ctx.statusHeader?.text).toBe('러닝 헤더 커스텀 텍스트');
    });
  });
});
