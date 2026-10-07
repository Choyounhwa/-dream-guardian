/**
 * note-projection.test.ts - 공용 원근 투영 및 어프로치 링 스케일 계산 단위 테스트
 *
 * @see Issue #477 [MRN-03]
 * @see docs/12_UNIFIED_MOTION_RHYTHM_ARCHITECTURE.md (§6 공용 투영 및 앵커 좌표)
 */

import { describe, it, expect } from 'vitest';
import {
  computeFlightProgress,
  projectFlight,
  computeApproachScale,
  type ProjectFlightOptions,
  type FlightProjectionResult,
} from '../../src/render/NoteProjection.js';
import { projectAlongRail } from '../../src/render/GridProjection.js';
import { StarNoteRenderer } from '../../src/render/StarNoteRenderer.js';
import { DEFAULT_FITNESS_ZONES } from '../../config/zone.config.js';
import type { ActiveStarTarget } from '../../src/input/StarCollectionInput.js';

describe('NoteProjection 공용 모듈 테스트 (Issue #477 / MRN-03)', () => {
  describe('1. computeFlightProgress - 비행 진행도 선형 계산 및 0~1 clamp 검증', () => {
    const landingTime = 10.0;
    const leadBeats = 2.0;
    const spb = 0.5; // duration = leadBeats * spb = 1.0s, displayStart = 9.0s

    it('displayStart 시점에 진행도 0.0을 반환한다', () => {
      const progress = computeFlightProgress(9.0, landingTime, leadBeats, spb);
      expect(progress).toBeCloseTo(0.0, 6);
    });

    it('착지 시점(landingTime)에 진행도 1.0을 반환한다', () => {
      const progress = computeFlightProgress(10.0, landingTime, leadBeats, spb);
      expect(progress).toBeCloseTo(1.0, 6);
    });

    it('중간 시점에 정확한 선형 비율(0.5)을 반환한다', () => {
      const progress = computeFlightProgress(9.5, landingTime, leadBeats, spb);
      expect(progress).toBeCloseTo(0.5, 6);
    });

    it('displayStart 이전 시간(now < displayStart)은 기본값으로 0.0으로 clamp된다', () => {
      const progress = computeFlightProgress(8.0, landingTime, leadBeats, spb);
      expect(progress).toBe(0.0);
    });

    it('landingTime 이후 시간(now > landingTime)은 기본값으로 1.0으로 clamp된다', () => {
      const progress = computeFlightProgress(11.0, landingTime, leadBeats, spb);
      expect(progress).toBe(1.0);
    });

    it('previewStart가 주어지면 Math.max(previewStart, landingTime - leadBeats * spb)를 displayStart로 채택한다', () => {
      // previewStart = 9.5 (displayStart = 9.5, duration = 0.5s)
      const progress1 = computeFlightProgress(9.75, landingTime, leadBeats, spb, 9.5);
      expect(progress1).toBeCloseTo(0.5, 6);

      // previewStart = 8.5 (displayStart = max(8.5, 9.0) = 9.0, duration = 1.0s)
      const progress2 = computeFlightProgress(9.5, landingTime, leadBeats, spb, 8.5);
      expect(progress2).toBeCloseTo(0.5, 6);
    });

    it('clamp = false 지정 시 범위 밖의 음수 및 1.0 초과 값을 그대로 산출한다', () => {
      const early = computeFlightProgress(8.0, landingTime, leadBeats, spb, undefined, false);
      expect(early).toBeLessThan(0.0);
      expect(early).toBeCloseTo(-1.0, 6);

      const late = computeFlightProgress(11.0, landingTime, leadBeats, spb, undefined, false);
      expect(late).toBeGreaterThan(1.0);
      expect(late).toBeCloseTo(2.0, 6);
    });

    it('duration <= 0 인 비정상/즉시 착지 엣지 케이스에서는 1.0을 반환한다', () => {
      const progress = computeFlightProgress(10.0, 10.0, 0, spb);
      expect(progress).toBe(1.0);
    });
  });

  describe('2. projectFlight - 원근 가속(easingExponent) 및 스케일 보간 검증', () => {
    const vx = 500;
    const vy = 300;
    const tx = 200;
    const ty = 600;

    describe('별가루 노트 (easingExponent = 2.0 / t^2)', () => {
      const opts: ProjectFlightOptions = {
        minScale: 0.3,
        maxScale: 1.2,
        easingExponent: 2.0,
      };

      it('progress = 0 일 때 소실점 위치와 minScale을 반환한다', () => {
        const result: FlightProjectionResult = projectFlight(vx, vy, tx, ty, 0, opts);
        expect(result.x).toBeCloseTo(vx, 6);
        expect(result.y).toBeCloseTo(vy, 6);
        expect(result.scale).toBeCloseTo(0.3, 6);
        expect(result.t).toBeCloseTo(0, 6);
        expect(result.progress).toBeCloseTo(0, 6);
      });

      it('progress = 1 일 때 목표 좌표와 maxScale을 반환한다', () => {
        const result: FlightProjectionResult = projectFlight(vx, vy, tx, ty, 1, opts);
        expect(result.x).toBeCloseTo(tx, 6);
        expect(result.y).toBeCloseTo(ty, 6);
        expect(result.scale).toBeCloseTo(1.2, 6);
        expect(result.t).toBeCloseTo(1, 6);
        expect(result.progress).toBeCloseTo(1, 6);
      });

      it('progress = 0.5 일 때 t = 0.25 (0.5^2) 비선형 가속이 적용된다', () => {
        const result: FlightProjectionResult = projectFlight(vx, vy, tx, ty, 0.5, opts);
        const expectedT = 0.25;
        const expectedX = vx + (tx - vx) * expectedT;
        const expectedY = vy + (ty - vy) * expectedT;
        const expectedScale = 0.3 + (1.2 - 0.3) * expectedT;

        expect(result.t).toBeCloseTo(expectedT, 6);
        expect(result.x).toBeCloseTo(expectedX, 6);
        expect(result.y).toBeCloseTo(expectedY, 6);
        expect(result.scale).toBeCloseTo(expectedScale, 6);
      });

      it('GridProjection.projectAlongRail과 계산 결과가 100% 일치한다', () => {
        const testProgresses = [0.0, 0.1, 0.25, 0.5, 0.75, 0.9, 1.0];
        for (const p of testProgresses) {
          const fromRail = projectAlongRail(vx, vy, tx, ty, p, 0.3, 1.2);
          const fromFlight = projectFlight(vx, vy, tx, ty, p, opts);
          expect(fromFlight.x).toBeCloseTo(fromRail.x, 8);
          expect(fromFlight.y).toBeCloseTo(fromRail.y, 8);
          expect(fromFlight.scale).toBeCloseTo(fromRail.scale, 8);
          expect(fromFlight.t).toBeCloseTo(fromRail.t!, 8);
        }
      });

      it('progress 범위 밖(-0.5, 1.5) 입력 시 0~1 내부로 안전하게 clamp된다', () => {
        const under = projectFlight(vx, vy, tx, ty, -0.5, opts);
        expect(under.x).toBeCloseTo(vx, 6);
        expect(under.scale).toBeCloseTo(0.3, 6);
        expect(under.progress).toBe(0.0);

        const over = projectFlight(vx, vy, tx, ty, 1.5, opts);
        expect(over.x).toBeCloseTo(tx, 6);
        expect(over.scale).toBeCloseTo(1.2, 6);
        expect(over.progress).toBe(1.0);
      });
    });

    describe('발 스텝 노트 (easingExponent = 1.4 / p^1.4)', () => {
      const opts: ProjectFlightOptions = {
        minScale: 0.35,
        maxScale: 1.0,
        easingExponent: 1.4,
      };

      it('progress = 0.5 일 때 t = 0.5^1.4 수치와 정확히 일치한다', () => {
        const result = projectFlight(vx, vy, tx, ty, 0.5, opts);
        const expectedT = Math.pow(0.5, 1.4);
        const expectedX = vx + (tx - vx) * expectedT;
        const expectedY = vy + (ty - vy) * expectedT;
        const expectedScale = 0.35 + (1.0 - 0.35) * expectedT;

        expect(result.t).toBeCloseTo(expectedT, 6);
        expect(result.x).toBeCloseTo(expectedX, 6);
        expect(result.y).toBeCloseTo(expectedY, 6);
        expect(result.scale).toBeCloseTo(expectedScale, 6);
      });
    });

    describe('보스 장판 / 해저드 노트 (easingExponent = 1.5 / p^1.5)', () => {
      const opts: ProjectFlightOptions = {
        minScale: 0.2,
        maxScale: 1.0,
        easingExponent: 1.5,
      };

      it('progress = 0.5 일 때 t = 0.5^1.5 수치와 정확히 일치한다', () => {
        const result = projectFlight(vx, vy, tx, ty, 0.5, opts);
        const expectedT = Math.pow(0.5, 1.5);
        const expectedX = vx + (tx - vx) * expectedT;
        const expectedY = vy + (ty - vy) * expectedT;
        const expectedScale = 0.2 + (1.0 - 0.2) * expectedT;

        expect(result.t).toBeCloseTo(expectedT, 6);
        expect(result.x).toBeCloseTo(expectedX, 6);
        expect(result.y).toBeCloseTo(expectedY, 6);
        expect(result.scale).toBeCloseTo(expectedScale, 6);
      });
    });

    describe('기본 옵션 fallback 검증', () => {
      it('옵션을 생략하면 기본값(minScale=0.3, maxScale=1.2, easingExponent=2.0)이 적용된다', () => {
        const result = projectFlight(vx, vy, tx, ty, 0.5);
        expect(result.scale).toBeCloseTo(0.3 + 0.9 * 0.25, 6);
        expect(result.t).toBeCloseTo(0.25, 6);
      });
    });
  });

  describe('3. computeApproachScale - 어프로치 링 선형 수축 계산 검증', () => {
    it('기본 설정(start=2.5, end=1.0)에서 progress = 0 일 때 2.5를 반환한다', () => {
      expect(computeApproachScale(0.0)).toBeCloseTo(2.5, 6);
    });

    it('기본 설정에서 progress = 1.0 일 때 1.0을 반환한다', () => {
      expect(computeApproachScale(1.0)).toBeCloseTo(1.0, 6);
    });

    it('기본 설정에서 progress = 0.5 일 때 1.75를 반환한다', () => {
      expect(computeApproachScale(0.5)).toBeCloseTo(1.75, 6);
    });

    it('progress < 0 및 progress > 1 에서 안전하게 2.5 및 1.0으로 clamp된다', () => {
      expect(computeApproachScale(-0.25)).toBe(2.5);
      expect(computeApproachScale(1.25)).toBe(1.0);
    });

    it('커스텀 startScale과 endScale이 주어지면 해당 범위로 선형 보간된다', () => {
      expect(computeApproachScale(0.0, 3.0, 0.5)).toBeCloseTo(3.0, 6);
      expect(computeApproachScale(1.0, 3.0, 0.5)).toBeCloseTo(0.5, 6);
      expect(computeApproachScale(0.5, 3.0, 0.5)).toBeCloseTo(1.75, 6);
    });
  });

  describe('4. StarNoteRenderer와의 정합성 및 위임 일치 검증', () => {
    const renderer = new StarNoteRenderer();

    it('StarNoteRenderer.computeApproachScale과 NoteProjection.computeApproachScale 계산 결과가 100% 일치한다', () => {
      const testValues = [-0.5, 0.0, 0.2, 0.5, 0.8, 1.0, 1.5];
      for (const val of testValues) {
        expect(renderer.computeApproachScale(val)).toBeCloseTo(computeApproachScale(val), 8);
      }
    });

    it('StarNoteRenderer.computeNotePosition의 비행 위치가 NoteProjection.projectFlight와 일치한다', () => {
      const vx = 640;
      const vy = 360;
      const vw = 1280;
      const vh = 720;
      const landingTime = 5.0;
      const target: ActiveStarTarget = {
        patternId: 'p1',
        part: 'leftHand',
        zoneId: 4,
        beatIndex: 1,
        landingTime,
      };

      const zone4 = DEFAULT_FITNESS_ZONES.find((z) => z.id === 4)!;
      const targetX = (zone4.x + zone4.width * 0.5) * vw;
      const targetY = (zone4.y + zone4.height * 0.5) * vh;

      // 비행 중 시점 (landingTime - 0.25s -> progress = 0.5)
      const pos = renderer.computeNotePosition(target, landingTime - 0.25, vx, vy, vw, vh);
      const flight = projectFlight(vx, vy, targetX, targetY, 0.5, {
        minScale: renderer.options.minScale,
        maxScale: renderer.options.maxScale,
        easingExponent: 2.0,
      });

      expect(pos.x).toBeCloseTo(flight.x, 4);
      expect(pos.y).toBeCloseTo(flight.y, 4);
      expect(pos.scale).toBeCloseTo(flight.scale, 4);
    });
  });
});
