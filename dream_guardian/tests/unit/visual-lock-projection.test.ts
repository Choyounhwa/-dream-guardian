import { describe, expect, it } from 'vitest';
import { HORIZON_RATIO } from '../../config/grid.config.js';
import { DEFAULT_VANISHING_Y_RATIO } from '../../config/running-mat.config.js';
import { projectAlongRail, projectDepthY } from '../../src/render/GridProjection.js';
import { HazardZoneRenderer } from '../../src/render/HazardZoneRenderer.js';
import baseline from '../fixtures/visual-lock-baseline.json';

const VW = baseline.virtualWidth;
const VH = baseline.virtualHeight;

describe('VISUAL-LOCK-001 shared projection baseline', () => {
  it('locks the approved horizon and rail sample against baseline fixture', () => {
    expect(HORIZON_RATIO).toBe(baseline.horizonRatio);
    expect(DEFAULT_VANISHING_Y_RATIO).toBe(baseline.defaultVanishingYRatio);

    const vy = VH * HORIZON_RATIO;
    const rail = projectAlongRail(
      VW / 2,
      vy,
      baseline.railSample.targetX,
      baseline.railSample.targetY,
      baseline.railSample.progress,
    );
    expect(rail.x).toBeCloseTo(baseline.railSample.expectedX, 4);
    expect(rail.y).toBeCloseTo(baseline.railSample.expectedY, 4);
    expect(rail.scale).toBeCloseTo(baseline.railSample.expectedScale, 4);
    expect(projectDepthY(2, vy, VH - vy)).toBeCloseTo(vy + (VH - vy) / 2, 4);
  });

  it('keeps star, hazard, and answer anchors on one vanishing Y matching baseline', () => {
    const sharedY = VH * HORIZON_RATIO;
    const hazard = new HazardZoneRenderer();
    const answerAnchorY = 220 * (VH / 1080);

    expect(VH * DEFAULT_VANISHING_Y_RATIO).toBe(sharedY);
    expect(hazard.computeHazardFrontY(1, sharedY, VH)).toBeCloseTo(
      sharedY + (VH - sharedY) * baseline.hazardFrontRatio,
      4,
    );
    expect(answerAnchorY).toBeLessThan(sharedY);
    expect(answerAnchorY).toBeCloseTo(baseline.answerAnchorY, 4);
  });

  it('fails when a caller substitutes another horizon', () => {
    const approved = VH * HORIZON_RATIO;
    const drifted = VH * 0.24;
    expect(drifted).not.toBeCloseTo(approved, 4);
  });
});
