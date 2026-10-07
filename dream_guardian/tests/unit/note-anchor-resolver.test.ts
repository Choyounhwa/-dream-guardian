/**
 * note-anchor-resolver.test.ts - 모션 리듬 노트 착지 앵커 좌표 해석기 단위 테스트
 *
 * @see Issue #478 [MRN-04]
 * @see docs/12_UNIFIED_MOTION_RHYTHM_ARCHITECTURE.md (§6 공용 투영 및 앵커 좌표)
 */

import { describe, it, expect } from 'vitest';
import {
  resolveAnchor,
  computeMatHalfWBottom,
  computeStrikeLineY,
  DEFAULT_LANE_OFFSET,
  type LandingMode,
  type NoteAnchor,
  type ViewportSize,
  type FloorLayoutOptions,
} from '../../src/render/NoteAnchorResolver.js';
import { DEFAULT_FITNESS_ZONES, type FitnessZone } from '../../config/zone.config.js';
import {
  RUNNING_MAT_CONFIG,
  DEFAULT_STRIKE_LINE_Y_RATIO,
  DEFAULT_STOMP_NOTE_RADIUS,
} from '../../config/running-mat.config.js';
import { DEFAULT_STAR_NOTE_VISUAL_CONFIG } from '../../config/beat-motion.config.js';
import type { PartRequirement } from '../../src/types/motion-note.js';

describe('NoteAnchorResolver 단위 테스트 (Issue #478 / MRN-04)', () => {
  const viewport: ViewportSize = { width: 1920, height: 1080 };
  const vx = viewport.width * 0.5; // 960
  const vy = viewport.height * 0.5; // 540

  describe('1. 인터페이스 및 반환 규격 검증', () => {
    it('손 요구조건에 대해 NoteAnchor 규격(x, y, radius, mode: zoneCenter)을 충족하는 객체를 반환한다', () => {
      const req: PartRequirement = { part: 'leftHand', zoneId: 4 };
      const anchor: NoteAnchor = resolveAnchor(req, viewport);

      expect(anchor).toBeDefined();
      expect(typeof anchor.x).toBe('number');
      expect(typeof anchor.y).toBe('number');
      expect(typeof anchor.radius).toBe('number');
      expect(anchor.radius).toBeGreaterThan(0);
      expect(anchor.mode).toBe<LandingMode>('zoneCenter');
    });

    it('발 요구조건에 대해 NoteAnchor 규격(x, y, radius, mode: strikeLine)을 충족하는 객체를 반환한다', () => {
      const req: PartRequirement = { part: 'leftFoot', zoneId: 9 };
      const anchor: NoteAnchor = resolveAnchor(req, viewport);

      expect(anchor).toBeDefined();
      expect(typeof anchor.x).toBe('number');
      expect(typeof anchor.y).toBe('number');
      expect(typeof anchor.radius).toBe('number');
      expect(anchor.radius).toBeGreaterThan(0);
      expect(anchor.mode).toBe<LandingMode>('strikeLine');
    });
  });

  describe('2. 손·머리·골반 부위 (zoneCenter 착지 모드)', () => {
    it('손 부위(leftHand, rightHand)는 주어진 Zone의 중심 좌표와 정확히 일치한다', () => {
      const zone4 = DEFAULT_FITNESS_ZONES.find((z) => z.id === 4)!;
      const expectedX = (zone4.x + zone4.width * 0.5) * viewport.width;
      const expectedY = (zone4.y + zone4.height * 0.5) * viewport.height;

      const leftReq: PartRequirement = { part: 'leftHand', zoneId: 4 };
      const leftAnchor = resolveAnchor(leftReq, viewport);
      expect(leftAnchor.mode).toBe('zoneCenter');
      expect(leftAnchor.x).toBeCloseTo(expectedX, 4);
      expect(leftAnchor.y).toBeCloseTo(expectedY, 4);

      const zone5 = DEFAULT_FITNESS_ZONES.find((z) => z.id === 5)!;
      const rightReq: PartRequirement = { part: 'rightHand', zoneId: 5 };
      const rightAnchor = resolveAnchor(rightReq, viewport);
      expect(rightAnchor.mode).toBe('zoneCenter');
      expect(rightAnchor.x).toBeCloseTo((zone5.x + zone5.width * 0.5) * viewport.width, 4);
      expect(rightAnchor.y).toBeCloseTo((zone5.y + zone5.height * 0.5) * viewport.height, 4);
    });

    it('머리 부위(head)는 지정된 머리 존의 중심 좌표와 일치한다', () => {
      const zone4 = DEFAULT_FITNESS_ZONES.find((z) => z.id === 4)!;
      const headReq: PartRequirement = { part: 'head', zoneId: 4 };
      const headAnchor = resolveAnchor(headReq, viewport);

      expect(headAnchor.mode).toBe('zoneCenter');
      expect(headAnchor.x).toBeCloseTo((zone4.x + zone4.width * 0.5) * viewport.width, 4);
      expect(headAnchor.y).toBeCloseTo((zone4.y + zone4.height * 0.5) * viewport.height, 4);
    });

    it('골반 부위(hip)가 하단 존(Zone 9, 10, 11)에 배정되어도 발 판정선이 아닌 Zone 중심에 착지한다', () => {
      // 골반은 커서 부위이므로 Zone 9~11이라도 strikeLine이 아닌 zoneCenter여야 함
      const zone9 = DEFAULT_FITNESS_ZONES.find((z) => z.id === 9)!;
      const hipReq9: PartRequirement = { part: 'hip', zoneId: 9 };
      const hipAnchor9 = resolveAnchor(hipReq9, viewport);

      expect(hipAnchor9.mode).toBe('zoneCenter');
      expect(hipAnchor9.x).toBeCloseTo((zone9.x + zone9.width * 0.5) * viewport.width, 4);
      expect(hipAnchor9.y).toBeCloseTo((zone9.y + zone9.height * 0.5) * viewport.height, 4);

      const zone10 = DEFAULT_FITNESS_ZONES.find((z) => z.id === 10)!;
      const hipReq10: PartRequirement = { part: 'hip', zoneId: 10 };
      const hipAnchor10 = resolveAnchor(hipReq10, viewport);

      expect(hipAnchor10.mode).toBe('zoneCenter');
      expect(hipAnchor10.x).toBeCloseTo((zone10.x + zone10.width * 0.5) * viewport.width, 4);
      expect(hipAnchor10.y).toBeCloseTo((zone10.y + zone10.height * 0.5) * viewport.height, 4);
    });

    it('커스텀 픽셀 단위 Zone 배열이 주어졌을 때도 (x + width/2, y + height/2) 공식으로 일치한다', () => {
      const customZones: FitnessZone[] = [
        { id: 1, label: '테스트1', x: 200, y: 300, width: 160, height: 120 },
      ];
      const req: PartRequirement = { part: 'leftHand', zoneId: 1 };
      const anchor = resolveAnchor(req, viewport, customZones);

      expect(anchor.mode).toBe('zoneCenter');
      expect(anchor.x).toBeCloseTo(280, 4); // 200 + 80
      expect(anchor.y).toBeCloseTo(360, 4); // 300 + 60
    });
  });

  describe('3. 발 및 하체·전신 부위 (strikeLine 착지 모드)', () => {
    const halfWBottom = computeMatHalfWBottom(viewport.width, viewport.height);
    const expectedStrikeY = computeStrikeLineY(viewport.height);

    it('판정선 Y 좌표는 viewport.height * strikeLineYRatio와 정확히 일치한다', () => {
      expect(expectedStrikeY).toBeCloseTo(viewport.height * DEFAULT_STRIKE_LINE_Y_RATIO, 4);

      const leftReq: PartRequirement = { part: 'leftFoot', zoneId: 9 };
      const leftAnchor = resolveAnchor(leftReq, viewport);
      expect(leftAnchor.y).toBeCloseTo(expectedStrikeY, 4);

      const centerReq: PartRequirement = { part: 'centerFoot', zoneId: 10 };
      const centerAnchor = resolveAnchor(centerReq, viewport);
      expect(centerAnchor.y).toBeCloseTo(expectedStrikeY, 4);

      const rightReq: PartRequirement = { part: 'rightFoot', zoneId: 11 };
      const rightAnchor = resolveAnchor(rightReq, viewport);
      expect(rightAnchor.y).toBeCloseTo(expectedStrikeY, 4);
    });

    it('발 3대 레인(leftFoot, centerFoot, rightFoot)의 X 좌표가 {-0.45, 0, +0.45} 오프셋과 정확히 일치한다', () => {
      const expectedLeftX = vx - DEFAULT_LANE_OFFSET * halfWBottom;
      const expectedCenterX = vx;
      const expectedRightX = vx + DEFAULT_LANE_OFFSET * halfWBottom;

      const leftAnchor = resolveAnchor({ part: 'leftFoot', zoneId: 9 }, viewport);
      const centerAnchor = resolveAnchor({ part: 'centerFoot', zoneId: 10 }, viewport);
      const rightAnchor = resolveAnchor({ part: 'rightFoot', zoneId: 11 }, viewport);

      expect(leftAnchor.mode).toBe('strikeLine');
      expect(leftAnchor.x).toBeCloseTo(expectedLeftX, 4);
      expect(leftAnchor.radius).toBe(DEFAULT_STOMP_NOTE_RADIUS);

      expect(centerAnchor.mode).toBe('strikeLine');
      expect(centerAnchor.x).toBeCloseTo(expectedCenterX, 4);
      expect(centerAnchor.radius).toBe(DEFAULT_STOMP_NOTE_RADIUS);

      expect(rightAnchor.mode).toBe('strikeLine');
      expect(rightAnchor.x).toBeCloseTo(expectedRightX, 4);
      expect(rightAnchor.radius).toBe(DEFAULT_STOMP_NOTE_RADIUS);
    });

    it('bothFeet는 중앙(vx) 위치의 전폭 앵커(radius = halfWBottom)를 반환한다', () => {
      const bothReq: PartRequirement = { part: 'bothFeet', zoneId: 10 };
      const bothAnchor = resolveAnchor(bothReq, viewport);

      expect(bothAnchor.mode).toBe('strikeLine');
      expect(bothAnchor.x).toBeCloseTo(vx, 4);
      expect(bothAnchor.y).toBeCloseTo(expectedStrikeY, 4);
      expect(bothAnchor.radius).toBeCloseTo(halfWBottom, 4);
    });

    it('fullBody는 중앙(vx) 위치의 전폭 앵커(radius = halfWBottom)를 반환한다', () => {
      const fullReq: PartRequirement = { part: 'fullBody', zoneId: 10 };
      const fullAnchor = resolveAnchor(fullReq, viewport);

      expect(fullAnchor.mode).toBe('strikeLine');
      expect(fullAnchor.x).toBeCloseTo(vx, 4);
      expect(fullAnchor.y).toBeCloseTo(expectedStrikeY, 4);
      expect(fullAnchor.radius).toBeCloseTo(halfWBottom, 4);
    });
  });

  describe('4. RunningMatRenderer 레인 앵커 계산식과의 정합성 검증', () => {
    it('가로 모드(aspect >= 1.0)에서 RunningMatRenderer의 계산식과 100% 동일하다', () => {
      const w = 1920;
      const h = 1080;
      const expectedHalfW = (w * RUNNING_MAT_CONFIG.widthRatio) * 0.5;
      const expectedYStrike = h * (RUNNING_MAT_CONFIG.strikeLineYRatio ?? DEFAULT_STRIKE_LINE_Y_RATIO);

      const computedHalfW = computeMatHalfWBottom(w, h);
      const computedYStrike = computeStrikeLineY(h);

      expect(computedHalfW).toBeCloseTo(expectedHalfW, 4);
      expect(computedYStrike).toBeCloseTo(expectedYStrike, 4);

      const anchorL = resolveAnchor({ part: 'leftFoot', zoneId: 9 }, { width: w, height: h });
      expect(anchorL.x).toBeCloseTo(w * 0.5 - expectedHalfW * 0.45, 4);
    });

    it('세로/좁은 모드(aspect < 1.0)에서 반응형 폭 보정이 RunningMatRenderer와 동일하게 적용된다', () => {
      const w = 720;
      const h = 1280;
      const aspect = w / h; // 0.5625
      const expectedMatWidthRatio = Math.min(
        RUNNING_MAT_CONFIG.maxNarrowWidthRatio,
        RUNNING_MAT_CONFIG.widthRatio + (1.0 - aspect) * 0.15,
      );
      const expectedHalfW = (w * expectedMatWidthRatio) * 0.5;

      const computedHalfW = computeMatHalfWBottom(w, h);
      expect(computedHalfW).toBeCloseTo(expectedHalfW, 4);

      const anchorR = resolveAnchor({ part: 'rightFoot', zoneId: 11 }, { width: w, height: h });
      expect(anchorR.x).toBeCloseTo(w * 0.5 + expectedHalfW * 0.45, 4);
    });
  });

  describe('5. 커스텀 FloorLayoutOptions 적용 검증', () => {
    it('커스텀 strikeLineYRatio 및 laneOffset이 주어지면 해당 값이 반영된다', () => {
      const customLayout: FloorLayoutOptions = {
        strikeLineYRatio: 0.90,
        laneOffset: 0.50,
        stompNoteRadius: 32,
        zoneRadius: 36,
      };

      const footAnchor = resolveAnchor(
        { part: 'rightFoot', zoneId: 11 },
        viewport,
        DEFAULT_FITNESS_ZONES,
        customLayout,
      );

      const halfW = computeMatHalfWBottom(viewport.width, viewport.height, customLayout);
      expect(footAnchor.y).toBeCloseTo(viewport.height * 0.90, 4);
      expect(footAnchor.x).toBeCloseTo(vx + 0.50 * halfW, 4);
      expect(footAnchor.radius).toBe(32);

      const handAnchor = resolveAnchor(
        { part: 'leftHand', zoneId: 4 },
        viewport,
        DEFAULT_FITNESS_ZONES,
        customLayout,
      );
      expect(handAnchor.radius).toBe(36);
    });
  });

  describe('6. 안전 폴백 및 예외 케이스 검증', () => {
    it('요구한 zoneId가 존 목록에 없을 경우 화면 중앙(vx, vy)으로 안전 폴백한다', () => {
      const invalidReq: PartRequirement = { part: 'leftHand', zoneId: 999 };
      const fallbackAnchor = resolveAnchor(invalidReq, viewport);

      expect(fallbackAnchor.mode).toBe('zoneCenter');
      expect(fallbackAnchor.x).toBeCloseTo(vx, 4);
      expect(fallbackAnchor.y).toBeCloseTo(vy, 4);
      expect(fallbackAnchor.radius).toBe(DEFAULT_STAR_NOTE_VISUAL_CONFIG.baseRadius);
    });

    it('존 목록이 빈 배열이거나 유효하지 않아도 에러 없이 화면 중앙으로 폴백한다', () => {
      const req: PartRequirement = { part: 'head', zoneId: 4 };
      const fallbackAnchor = resolveAnchor(req, viewport, []);

      expect(fallbackAnchor.mode).toBe('zoneCenter');
      expect(fallbackAnchor.x).toBeCloseTo(vx, 4);
      expect(fallbackAnchor.y).toBeCloseTo(vy, 4);
    });

    it('viewport 크기가 0 이하인 경우 NaN 없이 0으로 안전 처리된다', () => {
      const zeroVp: ViewportSize = { width: 0, height: 0 };
      const footAnchor = resolveAnchor({ part: 'centerFoot', zoneId: 10 }, zeroVp);

      expect(Number.isFinite(footAnchor.x)).toBe(true);
      expect(Number.isFinite(footAnchor.y)).toBe(true);
      expect(Number.isFinite(footAnchor.radius)).toBe(true);
    });
  });
});
