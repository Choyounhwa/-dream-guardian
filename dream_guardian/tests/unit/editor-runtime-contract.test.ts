import { describe, expect, it, vi } from 'vitest';
import { EditorState } from '../../src/editor/EditorState.js';
import { EditorIOHandler } from '../../src/editor/EditorIOHandler.js';
import { StarNoteScheduler } from '../../src/game/StarNoteScheduler.js';
import { PhaseAHazardController } from '../../src/game/PhaseAHazardController.js';
import { BossHazardController } from '../../src/game/BossHazardController.js';
import { BossFeverController } from '../../src/game/BossFeverController.js';
import { deriveKeynoteCandidates } from '../../src/data/KeynoteCandidateDeriver.js';
import { DEFAULT_STAR_TIMING_WINDOWS } from '../../config/beat-motion.config.js';
import { DEFAULT_BOSS_HAZARD_CONFIG } from '../../config/battle.config.js';
import { PHASE_A_ACTIVE_HAZARD_PATTERNS } from '../../config/phase-a-hazard.config.js';
import type { Keynote } from '../../src/types/keynote.js';
import type { FitnessPatternRecord } from '../../src/types/posture.js';

function note(overrides: Partial<Keynote> = {}): Keynote {
  return { beat: 2, patternId: 'source', part: 'leftHand', zoneId: 4, instrument: 'hand', ...overrides };
}

function singlePartPattern(part: FitnessPatternRecord['parts'][number], zone: number): FitnessPatternRecord {
  return {
    id: `${part}_${zone}`, patternType: 'S', name: `${part}_${zone}`,
    leftHand: null, rightHand: null, head: null, hip: null,
    [part]: zone, partCount: 1, parts: [part], zoneIds: [zone],
    distinctZoneIds: [zone], partZoneMap: { [part]: zone },
  };
}

describe('EDITOR-CONTRACT #321: current runtime characterization, not V2 validation', () => {
  it('preserves V1 phase keys and non-integral editor beats on JSON roundtrip', () => {
    const state = new EditorState();
    const io = new EditorIOHandler();
    const first = state.sequenceEditor.getNotesForPhase('STAR_COLLECT')[0];
    state.sequenceEditor.updateNote('STAR_COLLECT', first.id, { startBeat: 2.5 });
    const json = io.exportFullProjectJSON(state);
    const saved = JSON.parse(json);
    expect(saved.version).toBe('1.0.0');
    expect(Object.keys(saved.sequences)).toEqual([
      'RUN_QUESTION', 'ANSWER_SELECT', 'STAR_COLLECT', 'FEVER_PHASE_B',
    ]);
    const restored = new EditorState();
    expect(io.importFullProjectJSON(restored, json)).toMatchObject({ success: true, errors: [] });
    expect(restored.sequenceEditor.getNotesForPhase('STAR_COLLECT')[0].startBeat).toBe(2.5);
  });

  it('records the aligned #382 branch duration (8 beats) and seekBeat(8) for STAR_COLLECT', () => {
    const state = new EditorState();
    state.setSelectedPhase('STAR_COLLECT');
    expect(state.getCurrentPhaseNotes().map((n) => n.startBeat)).toEqual([2, 3, 4, 5, 6, 7, 8]);
    expect(state.getCurrentPhaseRoutine().beats).toBe(8);
    state.seekBeat(8);
    expect(state.currentBeat).toBe(8);
  });

  it('does not turn pattern selection into template reapplication', () => {
    const state = new EditorState();
    const first = state.getCurrentPhaseNotes()[0];
    state.sequenceEditor.updateNote('RUN_QUESTION', first.id, { label: 'edited' });
    const before = structuredClone(state.getCurrentPhaseNotes());
    const changed = vi.fn();
    state.addListener({ onDocumentChange: changed });
    expect(state.setSelectedPattern('CAT_SKY_POINT_RIGHT')).toBe(true);
    expect(state.getCurrentPhaseNotes()).toEqual(before);
    expect(changed).not.toHaveBeenCalled();
  });

  it('schedules by array order, not the stored beat label, and gives branchClock precedence', () => {
    const scheduler = new StarNoteScheduler({ secondsPerBeat: 0.75 });
    const source = [note({ beat: 8, patternId: 'last-label' }), note({ beat: 2.5 })];
    const before = structuredClone(source);
    scheduler.start(10, {
      roundId: 4, notes: source, secondsPerBeat: 0.5,
      branchClock: { secondsPerBeat: 0.4, durationBeats: 8 },
    });
    expect(scheduler.notes.map((n) => n.beat)).toEqual([8, 2.5]);
    expect(scheduler.notes.map((n) => n.landingTime)).toEqual([10.4, 10.8]);
    expect(scheduler.notes.map((n) => n.id)).toEqual(['4_note_0_b8', '4_note_1_b2.5']);
    expect(source).toEqual(before);
  });

  it.each([110, 115, 120, 125, 135, 140])('keeps the final star window inside 8 beats at BPM %i', (bpm) => {
    const spb = 60 / bpm;
    const scheduler = new StarNoteScheduler();
    scheduler.start(10, { branchClock: { secondsPerBeat: spb, durationBeats: 8 } });
    expect(scheduler.notes).toHaveLength(7);
    scheduler.notes.forEach((n, index) => expect(n.landingTime).toBeCloseTo(10 + (index + 1) * spb, 9));
    const completeAt = 10 + 7 * spb + DEFAULT_STAR_TIMING_WINDOWS.late;
    expect(completeAt).toBeLessThan(10 + 8 * spb);
    scheduler.update(completeAt - 0.001);
    expect(scheduler.isComplete).toBe(false);
    scheduler.update(completeAt);
    expect(scheduler.isComplete).toBe(true);
    expect(scheduler.resolvedCount).toBe(7);
  });

  it('exposes why arbitrary editor BPM cannot automatically be published', () => {
    expect(DEFAULT_STAR_TIMING_WINDOWS).toEqual({ perfect: 0.12, good: 0.25, late: 0.4 });
    const spb = 60 / 160;
    const scheduler = new StarNoteScheduler();
    scheduler.start(0, { secondsPerBeat: spb });
    expect(scheduler.notes[6].landingTime + DEFAULT_STAR_TIMING_WINDOWS.late).toBeGreaterThan(8 * spb);
    scheduler.update(8 * spb);
    expect(scheduler.isComplete).toBe(false);
  });

  it('uses constructor notes or built-in notes when an empty override is supplied', () => {
    const scheduler = new StarNoteScheduler({ notes: [note({ patternId: 'constructor' })] });
    scheduler.start(0, { notes: [] });
    expect(scheduler.notes.map((n) => n.patternId)).toEqual(['constructor']);
    const defaults = new StarNoteScheduler();
    defaults.start(0, { notes: [] });
    expect(defaults.notes).toHaveLength(7);
  });

  it('derives CSV star inputs more narrowly than the general choreography zone space', () => {
    const candidates = deriveKeynoteCandidates([
      singlePartPattern('leftHand', 1), singlePartPattern('leftHand', 6),
      singlePartPattern('rightHand', 5), singlePartPattern('head', 4),
      singlePartPattern('hip', 8), singlePartPattern('hip', 9),
      singlePartPattern('hip', 10), singlePartPattern('hip', 11),
    ]);
    expect(candidates.map(({ part, zoneId, instrument }) => ({ part, zoneId, instrument }))).toEqual([
      { part: 'leftHand', zoneId: 1, instrument: 'hand' },
      { part: 'rightHand', zoneId: 5, instrument: 'hand' },
      { part: 'hip', zoneId: 9, instrument: 'foot' },
      { part: 'hip', zoneId: 10, instrument: 'foot' },
      { part: 'hip', zoneId: 11, instrument: 'foot' },
    ]);
  });

  it('routes foot-role hip notes by foot events, including the current center-zone fallback', () => {
    const scheduler = new StarNoteScheduler();
    scheduler.start(0, { notes: [note({ part: 'hip', instrument: 'foot', zoneId: 9 })] });
    expect(scheduler.fromFoot(11, 0.5)).toBeNull();
    expect(scheduler.fromFoot(10, 0.5)).toMatchObject({ collected: true, source: 'foot', zoneId: 9 });
    expect(scheduler.fromFoot(9, 0.5)).toBeNull();
    scheduler.start(0, { notes: [note()] });
    expect(scheduler.fromFoot(4, 0.5)).toBeNull();
  });

  it('allows touch/keyboard fallback but resolves each individual note once', () => {
    const rated = vi.fn();
    const scheduler = new StarNoteScheduler({ onRating: rated });
    scheduler.start(0, { notes: [note()] });
    expect(scheduler.fromTouch(5, 0.5)).toBeNull();
    expect(scheduler.fromTouch(4, 0.5)).toMatchObject({ collected: true, source: 'touch' });
    expect(scheduler.fromKeyboard(0.5)).toBeNull();
    expect(rated).toHaveBeenCalledTimes(1);
  });

  it('keeps active Phase A patterns and scaled input/judgment times distinct from damage', () => {
    expect(PHASE_A_ACTIVE_HAZARD_PATTERNS).toEqual(['left_step', 'right_step', 'jump']);
    const resolved = vi.fn();
    const controller = new PhaseAHazardController({ onBeatResolved: resolved });
    const spb = 60 / 140;
    controller.start({ pattern: 'left_step', attackId: 'contract-A', secondsPerBeat: spb });
    expect(controller.schedule.warningDuration).toBeCloseTo(5.2 * spb, 9);
    expect(controller.schedule.inputWindowEnd).toBeCloseTo(6.8 * spb, 9);
    expect(controller.schedule.judgmentTime).toBeCloseTo(7 * spb, 9);
    expect(controller.schedule.totalDuration).toBeCloseTo(8 * spb, 9);
    expect(controller.schedule.damagePerMiss).toBe(25);
    controller.update(5.2 * spb);
    controller.recordAction('right_step');
    expect(controller.isEvaded).toBe(false);
    controller.recordAction('left_step');
    controller.update(1.8 * spb);
    expect(resolved).toHaveBeenCalledWith(expect.objectContaining({ attackId: 'contract-A', evaded: true, damage: 0 }));
    controller.update(2 * spb);
    expect(resolved).toHaveBeenCalledTimes(1);
  });

  it.each([
    ['dual_slam', 'jump', 'left_step'],
    ['alternating_stomp_left', 'left_step', 'right_step'],
    ['alternating_stomp_right', 'right_step', 'left_step'],
  ] as const)('maps Phase B %s to its actual accepted action', (attack, accepted, rejected) => {
    const controller = new BossHazardController({ autoSchedule: false });
    controller.start();
    controller.triggerAttack(attack);
    expect(controller.recordAction(rejected)).toBe(false);
    expect(controller.recordAction(accepted)).toBe(true);
    expect(controller.resolve()).toMatchObject({ attackType: attack, evaded: true, damage: 0 });
  });

  it('keeps Phase B attack durations in seconds and enrage on the interval', () => {
    const controller = new BossHazardController({ autoSchedule: false });
    expect(DEFAULT_BOSS_HAZARD_CONFIG).toMatchObject({ attackInterval: 5, warningDuration: 1.5, activeDuration: 1 });
    controller.start();
    controller.triggerAttack('dual_slam');
    controller.update(1.49);
    expect(controller.attackState).toBe('warning');
    controller.update(0.01);
    expect(controller.attackState).toBe('active');
    controller.triggerEnrage();
    expect(controller.effectiveAttackInterval).toBeCloseTo(5 / 1.5, 9);
    controller.update(1);
    expect(controller.isAttacking).toBe(false);
  });

  it('does not confuse 16-beat editor motion blocks with alternating 8-note runtime fever sequences', () => {
    const state = new EditorState();
    state.setSelectedPhase('FEVER_PHASE_B');
    expect(state.getCurrentPhaseRoutine().beats).toBe(16);
    expect(state.getCurrentPhaseNotes()).toHaveLength(4);
    expect(state.getCurrentPhaseNotes().every((n) => n.lane === 'motion')).toBe(true);
    const fever = new BossFeverController();
    const first = fever.generateFeverSequence(1);
    expect(first.map((n) => n.beat)).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
    expect(fever.generateFeverSequence(2)).not.toEqual(first);
    expect(fever.generateFeverSequence(3)).toEqual(first);
  });
});
