import { describe, expect, it, vi } from 'vitest';
import { StarNoteScheduler } from '../../src/game/StarNoteScheduler.js';
import { PhaseAHazardController } from '../../src/game/PhaseAHazardController.js';
import {
  DEFAULT_PHASE_A_HAZARD_CONFIG,
  scaleHazardSchedule,
} from '../../config/phase-a-hazard.config.js';
import { DEFAULT_STAR_TIMING_WINDOWS } from '../../config/beat-motion.config.js';

const BPMS = [110, 115, 120, 125, 135, 140] as const;
const LATE = DEFAULT_STAR_TIMING_WINDOWS.late;

function spbOf(bpm: number): number {
  return 60 / bpm;
}

describe('branch beat clock schedule (#310)', () => {
  it('omitted clock keeps BPM120 landings 0.5..3.5 and completes at 3.90 not before', () => {
    const scheduler = new StarNoteScheduler();
    scheduler.start(0);
    const landings = scheduler.activeNotes.map((n) => n.landingTime);
    expect(landings).toEqual([0.5, 1, 1.5, 2, 2.5, 3, 3.5]);
    scheduler.update(3.89);
    expect(scheduler.isComplete).toBe(false);
    scheduler.update(3.9);
    expect(scheduler.isComplete).toBe(true);
  });

  it('keeps start(startTime) and start(startTime, { notes, roundId })', () => {
    const scheduler = new StarNoteScheduler();
    const notes = [
      { beat: 2, patternId: 'p', part: 'leftHand' as const, zoneId: 1, instrument: 'hand' as const },
    ];
    scheduler.start(10, { notes, roundId: 4 });
    expect(scheduler.activeNotes).toHaveLength(1);
    expect(scheduler.activeNotes[0]?.roundId).toBe(4);
    expect(scheduler.activeNotes[0]?.landingTime).toBeCloseTo(10.5, 6);
  });

  it('injected secondsPerBeat ends the last late window before 8 beats and does not use raw 3.90', () => {
    for (const bpm of BPMS) {
      const spb = spbOf(bpm);
      const scheduler = new StarNoteScheduler();
      scheduler.start(0, { secondsPerBeat: spb });
      const notes = scheduler.activeNotes;
      expect(notes).toHaveLength(7);
      const lastLanding = notes[6]?.landingTime ?? 0;
      expect(lastLanding).toBeCloseTo(7 * spb, 6);
      const lateEnd = lastLanding + LATE;
      const branchEnd = 8 * spb;
      expect(lateEnd).toBeLessThanOrEqual(branchEnd + 1e-9);
      scheduler.update(lateEnd - 0.01);
      expect(scheduler.isComplete).toBe(false);
      scheduler.update(lateEnd);
      expect(scheduler.isComplete).toBe(true);
      if (Math.abs(spb - 0.5) > 1e-9) {
        expect(lateEnd).not.toBeCloseTo(3.9, 2);
      }
    }
  });

  it('pause does not advance the star schedule', () => {
    const scheduler = new StarNoteScheduler();
    scheduler.start(0);
    scheduler.setPaused(true);
    scheduler.update(4);
    expect(scheduler.isComplete).toBe(false);
    expect(scheduler.currentTime).toBe(0);
  });

  it('omitted hazard clock still uses 2.6/3.4/3.5/4.0', () => {
    expect(DEFAULT_PHASE_A_HAZARD_CONFIG.warningDuration).toBe(2.6);
    expect(DEFAULT_PHASE_A_HAZARD_CONFIG.inputWindowEnd).toBe(3.4);
    expect(DEFAULT_PHASE_A_HAZARD_CONFIG.judgmentTime).toBe(3.5);
    expect(DEFAULT_PHASE_A_HAZARD_CONFIG.totalDuration).toBe(4.0);
    const onBeatResolved = vi.fn();
    const controller = new PhaseAHazardController({ onBeatResolved });
    controller.start({ pattern: 'jump' });
    controller.update(3.49);
    expect(onBeatResolved).not.toHaveBeenCalled();
    controller.update(0.01);
    expect(onBeatResolved).toHaveBeenCalled();
    expect(controller.schedule.warningDuration).toBeCloseTo(2.6, 6);
    expect(controller.schedule.inputWindowEnd).toBeCloseTo(3.4, 6);
    expect(controller.schedule.judgmentTime).toBeCloseTo(3.5, 6);
    expect(controller.schedule.totalDuration).toBeCloseTo(4.0, 6);
  });

  it('scales hazard warning/input/judgment/end and keeps judgment before 8 beats', () => {
    expect(typeof scaleHazardSchedule).toBe('function');
    for (const bpm of BPMS) {
      const spb = spbOf(bpm);
      const scaled = scaleHazardSchedule(DEFAULT_PHASE_A_HAZARD_CONFIG, spb);
      const warning = scaled.warningDuration ?? 0;
      const inputEnd = scaled.inputWindowEnd ?? 0;
      const judgment = scaled.judgmentTime ?? 0;
      const total = scaled.totalDuration ?? 0;
      expect(warning).toBeLessThan(inputEnd);
      expect(inputEnd).toBeLessThan(judgment);
      expect(judgment).toBeLessThan(total);
      expect(judgment).toBeLessThan(8 * spb);
      expect(scaled.damagePerMiss).toBe(25);
      const onBeatResolved = vi.fn();
      const controller = new PhaseAHazardController({ onBeatResolved });
      controller.start({ pattern: 'left_step', secondsPerBeat: spb });
      expect(controller.schedule.judgmentTime).toBeCloseTo(judgment, 6);
      controller.update(judgment - 0.001);
      expect(controller.isResolved).toBe(false);
      controller.update(0.001);
      expect(controller.isResolved).toBe(true);
      expect(onBeatResolved).toHaveBeenCalledWith(expect.objectContaining({ damage: 25 }));
    }
  });

  it('hazard pause does not advance elapsed or resolve', () => {
    const onBeatResolved = vi.fn();
    const controller = new PhaseAHazardController({ onBeatResolved });
    controller.start({ pattern: 'jump' });
    controller.pause();
    controller.update(4);
    expect(controller.elapsed).toBe(0);
    expect(controller.isResolved).toBe(false);
    expect(onBeatResolved).not.toHaveBeenCalled();
  });
});
