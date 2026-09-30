import { describe, expect, it, vi } from 'vitest';
import {
  DEFAULT_PHASE_A_HAZARD_CONFIG,
  DEFAULT_PHASE_A_HAZARD_PATTERN,
  PHASE_A_ACTIVE_HAZARD_PATTERNS,
  PhaseAHazardController,
} from '../../src/game/PhaseAHazardController.js';

describe('PhaseAHazardController', () => {
  it('uses 25-HP damage for a missed Phase A floor hazard per GDD contract', () => {
    expect(DEFAULT_PHASE_A_HAZARD_CONFIG.damagePerMiss).toBe(25);
  });

  it('runs a single 3-pattern pool hazard routine for HAZARD_EVADE (Issue #236)', () => {
    const controller = new PhaseAHazardController();

    controller.start();

    expect(controller.isActive).toBe(true);
    expect(controller.activePattern).toBe(DEFAULT_PHASE_A_HAZARD_PATTERN[0]);
    expect(DEFAULT_PHASE_A_HAZARD_PATTERN).toHaveLength(3);
    expect(new Set(DEFAULT_PHASE_A_HAZARD_PATTERN)).toEqual(new Set([
      'left_step',
      'right_step',
      'jump',
    ]));
    expect(PHASE_A_ACTIVE_HAZARD_PATTERNS).toEqual(DEFAULT_PHASE_A_HAZARD_PATTERN);
  });

  it('resolves attack at judgment time (3.5s) and reports miss when requested action is not performed', () => {
    const onBeatResolved = vi.fn();
    const controller = new PhaseAHazardController({ onBeatResolved });

    controller.start({ pattern: 'left_step' });
    controller.recordAction('right_step'); // 잘못된 액션
    controller.update(3.5);

    expect(onBeatResolved).toHaveBeenCalledWith({
      beatIndex: 0,
      attackId: expect.any(String),
      pattern: 'left_step',
      evaded: false,
      damage: 25,
    });
    expect(controller.isResolved).toBe(true);
    expect(controller.isEvaded).toBe(false);
  });

  it('accepts the matching action and locks success even if preceded by wrong actions', () => {
    const onBeatResolved = vi.fn();
    const controller = new PhaseAHazardController({ onBeatResolved });

    controller.start({ pattern: 'left_step' });
    // 잘못된 선행 액션들
    controller.recordAction('right_step');
    controller.recordAction('jump');
    expect(controller.isEvaded).toBe(false);

    // 올바른 액션 -> 성공 잠금
    controller.recordAction('left_step');
    expect(controller.isEvaded).toBe(true);

    // 성공 잠금 후 다시 잘못된 액션 입력 -> 성공 잠금 유지
    controller.recordAction('right_step');
    expect(controller.isEvaded).toBe(true);

    controller.update(3.5);

    expect(onBeatResolved).toHaveBeenCalledWith({
      beatIndex: 0,
      attackId: expect.any(String),
      pattern: 'left_step',
      evaded: true,
      damage: 0,
    });
  });

  it('finishes and deactivates at totalDuration (4.0s)', () => {
    const onBeatResolved = vi.fn();
    const controller = new PhaseAHazardController({ onBeatResolved });

    controller.start({ pattern: 'jump' });
    controller.recordAction('jump');
    controller.update(3.5);

    expect(onBeatResolved).toHaveBeenCalledTimes(1);
    expect(controller.isActive).toBe(true);

    controller.update(0.5); // total 4.0s reached
    expect(controller.isActive).toBe(false);
    expect(controller.activePattern).toBeNull();
  });

  it('provides smooth monotonic beatProgress from 0 to 1.0 until judgment time', () => {
    const controller = new PhaseAHazardController();

    controller.start();
    expect(controller.beatProgress).toBe(0);

    controller.update(1.75);
    expect(controller.beatProgress).toBeCloseTo(0.5, 2);

    controller.update(1.75); // 3.5s
    expect(controller.beatProgress).toBeCloseTo(1.0, 2);

    controller.update(0.5); // 4.0s (after judgment)
    expect(controller.beatProgress).toBe(0); // stopped
  });
});
