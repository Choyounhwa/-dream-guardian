/**
 * answer-branch-contract.test.ts
 * [QA-ANSWER-BRANCH-001 / Issue #314]
 *
 * #306–#313 공개 API가 이미 구현한 2+2 답안 창·8박 분기·통계 분리 계약을 잠근다.
 * 제품 코드를 수정하지 않는다.
 * AppBootstrap 10문제 완주, 브라우저 합성 Pose, Chrome 실카메라는 이 파일의 통과로 증명하지 않는다.
 */
import { describe, expect, it } from 'vitest';
import { BeatRunCoordinator } from '../../src/game/BeatRunCoordinator.js';
import { BeatRoundResolver } from '../../src/game/BeatRoundResolver.js';
import { StarNoteScheduler } from '../../src/game/StarNoteScheduler.js';
import { PhaseAHazardController } from '../../src/game/PhaseAHazardController.js';
import { StageProgressController } from '../../src/game/StageProgressController.js';
import { BattleState } from '../../src/game/BattleState.js';
import { DEFAULT_STAR_TIMING_WINDOWS } from '../../config/beat-motion.config.js';
import { DEFAULT_ARM_DIRECTION_ANSWER_CONFIG } from '../../config/judgment.config.js';
import { DEFAULT_CONFIG } from '../../src/core/Config.js';

const BPMS = [110, 115, 120, 125, 135, 140] as const;
const BRANCH_BEATS = 8;
const LATE = DEFAULT_STAR_TIMING_WINDOWS.late;

function spbOf(bpm: number): number {
  return 60 / bpm;
}

function enterAnswer(bpm = 120): BeatRunCoordinator {
  const coordinator = new BeatRunCoordinator({
    battle: new BattleState(),
    routineMode: 'arm_reach',
  });
  coordinator.rhythmEngine.setBpm(bpm);
  coordinator.startRound();
  const slot = coordinator.rhythmEngine.secondsPerBeat;
  for (let i = 0; i < 8; i++) {
    coordinator.update(slot * 0.2);
    coordinator.recordStep('run');
    coordinator.update(slot * 0.8);
  }
  expect(coordinator.phase).toBe('ANSWER_SELECT');
  return coordinator;
}

describe('answer window contract (#309, public BeatRunCoordinator)', () => {
  it('locks primary 2 + extension 2 = max 4; answerSelectBeats stays the primary alias', () => {
    expect(DEFAULT_ARM_DIRECTION_ANSWER_CONFIG.answerPrimaryBeats).toBe(2);
    expect(DEFAULT_ARM_DIRECTION_ANSWER_CONFIG.answerExtensionBeats).toBe(2);
    expect(DEFAULT_ARM_DIRECTION_ANSWER_CONFIG.answerMaxBeats).toBe(4);
    expect(DEFAULT_ARM_DIRECTION_ANSWER_CONFIG.answerSelectBeats).toBe(2);
    const coordinator = enterAnswer();
    expect(coordinator.getAnswerSnapshot()).toMatchObject({
      phase: 'primary',
      primaryBeats: 2,
      extensionBeats: 2,
      maxBeats: 4,
      inputOpen: true,
    });
  });

  it('just before 2 is primary; exact 2 opens extension and still accepts; exact 4 closes and rejects', () => {
    const spb = spbOf(120);

    const beforeTwo = enterAnswer();
    beforeTwo.update(spb * 2 - 0.01);
    expect(beforeTwo.getAnswerSnapshot().phase).toBe('primary');
    expect(beforeTwo.isAnswerOpen).toBe(true);

    const atTwo = enterAnswer();
    atTwo.update(spb * 2);
    expect(atTwo.phase).toBe('ANSWER_SELECT');
    expect(atTwo.getAnswerSnapshot().phase).toBe('extension');
    expect(atTwo.isTimedOut).toBe(false);
    atTwo.confirmAnswerByFallback(0);
    expect(atTwo.selectedChoiceIndex).toBe(0);
    expect(atTwo.getBranchClock()?.durationBeats).toBe(BRANCH_BEATS);

    const beforeFour = enterAnswer();
    beforeFour.update(spb * 4 - 0.01);
    expect(beforeFour.phase).toBe('ANSWER_SELECT');
    expect(beforeFour.getAnswerSnapshot().phase).toBe('extension');
    expect(beforeFour.isAnswerOpen).toBe(true);

    const atFour = enterAnswer();
    atFour.update(spb * 4);
    expect(atFour.phase).toBe('HAZARD_EVADE');
    expect(atFour.isTimedOut).toBe(true);
    expect(atFour.getAnswerSnapshot().phase).toBe('closed');
    expect(atFour.getAnswerSnapshot().inputOpen).toBe(false);
    atFour.confirmAnswerByFallback(0);
    expect(atFour.selectedChoiceIndex).toBeNull();
  });

  it('left/right fallback in primary and extension opens an 8-beat star or hazard branch', () => {
    const spb = spbOf(120);
    for (const when of ['primary', 'extension'] as const) {
      for (const index of [0, 1] as const) {
        const coordinator = enterAnswer();
        if (when === 'extension') coordinator.update(spb * 2 + 1e-6);
        expect(coordinator.getAnswerSnapshot().phase).toBe(when);
        const correct = coordinator.currentQuestion?.correctIndex === index;
        coordinator.confirmAnswerByFallback(index);
        expect(coordinator.selectedChoiceIndex).toBe(index);
        expect(coordinator.phase).toBe(correct ? 'STAR_COLLECT' : 'HAZARD_EVADE');
        expect(coordinator.getBranchClock()).toMatchObject({
          durationBeats: BRANCH_BEATS,
          secondsPerBeat: spb,
        });
        coordinator.confirmAnswerByFallback(index === 0 ? 1 : 0);
        expect(coordinator.selectedChoiceIndex).toBe(index);
      }
    }
  });

  it('an unanswered close is timeout, not a selected wrong answer', () => {
    const coordinator = enterAnswer();
    coordinator.update(spbOf(120) * 4 + 1e-6);
    expect(coordinator.selectedChoiceIndex).toBeNull();
    expect(coordinator.isTimedOut).toBe(true);
    expect(coordinator.phase).toBe('HAZARD_EVADE');
  });

  it('pause does not advance the window or accept a choice; resume still accepts inside primary', () => {
    const coordinator = enterAnswer();
    coordinator.pause();
    coordinator.update(10);
    expect(coordinator.phase).toBe('ANSWER_SELECT');
    expect(coordinator.getAnswerSnapshot().phase).toBe('primary');
    expect(coordinator.getAnswerSnapshot().inputOpen).toBe(false);
    coordinator.confirmAnswerByFallback(0);
    expect(coordinator.selectedChoiceIndex).toBeNull();
    coordinator.resume();
    expect(coordinator.getAnswerSnapshot().inputOpen).toBe(true);
    coordinator.confirmAnswerByFallback(0);
    expect(coordinator.selectedChoiceIndex).toBe(0);
    expect(coordinator.getBranchClock()?.durationBeats).toBe(BRANCH_BEATS);
  });
});

describe('8-beat branch finish order (#310, public schedulers)', () => {
  it('BPM 110/115/120/125/135/140: branch is 8 beats; star late and hazard judgment finish before branch end', () => {
    for (const bpm of BPMS) {
      const spb = spbOf(bpm);
      const branchEnd = spb * BRANCH_BEATS;
      const clock = { secondsPerBeat: spb, durationBeats: 8 as const };

      const stars = new StarNoteScheduler();
      stars.start(0, { branchClock: clock, roundId: bpm });
      const lastLanding = Math.max(...stars.activeNotes.map((n) => n.landingTime));
      expect(stars.activeNotes).toHaveLength(7);
      expect(lastLanding).toBeCloseTo(spb * 7, 6);
      const lateEnd = lastLanding + LATE;
      expect(lateEnd).toBeLessThan(branchEnd);
      stars.update(lateEnd - 1e-4);
      expect(stars.isComplete).toBe(false);
      stars.update(lateEnd);
      expect(stars.isComplete).toBe(true);

      const hazard = new PhaseAHazardController();
      hazard.start({ branchClock: clock, pattern: 'jump', roundIndex: 1 });
      const judgment = hazard.schedule.judgmentTime ?? 0;
      const total = hazard.schedule.totalDuration ?? 0;
      expect(judgment).toBeCloseTo(3.5 * (spb / 0.5), 6);
      expect(judgment).toBeLessThan(branchEnd);
      expect(total).toBeLessThanOrEqual(branchEnd + 1e-9);
      hazard.update(judgment - 1e-6);
      expect(hazard.isResolved).toBe(false);
      hazard.update(1e-6);
      expect(hazard.isResolved).toBe(true);
      expect(hazard.elapsed).toBeLessThan(branchEnd);
    }
  });
});

describe('wrong vs timeout settlement (#225, public BeatRoundResolver)', () => {
  it('wrongAnswerCount and timeoutCount stay separate and neither reduces HP', () => {
    const battle = new BattleState();
    const startHp = battle.hp;
    const resolver = new BeatRoundResolver({ battle });

    const wrong = resolver.resolveRound('wrong', 1);
    const timeout = resolver.resolveRound('timeout', 2);

    expect(wrong.damageTaken).toBe(0);
    expect(timeout.damageTaken).toBe(0);
    expect(wrong.playerHp).toBe(startHp);
    expect(timeout.playerHp).toBe(startHp);
    expect(battle.hp).toBe(startHp);
    expect(resolver.rhythmStats.wrongAnswerCount).toBe(1);
    expect(resolver.rhythmStats.timeoutCount).toBe(1);
    expect(DEFAULT_CONFIG.player.wrongDamage).toBe(25);
  });

  it('hazard miss damage stays on the hazard schedule, not on answer timeout HP', () => {
    const hazard = new PhaseAHazardController();
    hazard.start({ secondsPerBeat: 0.5, pattern: 'jump' });
    hazard.update((hazard.schedule.judgmentTime ?? 3.5) + 1e-6);
    expect(hazard.isResolved).toBe(true);
    expect(hazard.isEvaded).toBe(false);
    expect(hazard.schedule.damagePerMiss).toBeGreaterThan(0);
  });
});

describe('10-settlement handoff is a controller contract, not a bootstrap proof (#314)', () => {
  it('StageProgressController hands off once at 10 and does not schedule an 11th round', () => {
    const handoffs: number[] = [];
    const progress = new StageProgressController({
      maxRounds: 10,
      onEnterBossClimax: () => {
        handoffs.push(1);
      },
    });
    for (let round = 1; round <= 9; round++) {
      const step = progress.handleRoundSettled(
        { playerHp: 100, playerDefeated: false, roundIndex: round },
        { immediate: true },
      );
      expect(step.type).toBe('NEXT_ROUND');
    }
    const tenth = progress.handleRoundSettled(
      { playerHp: 100, playerDefeated: false, roundIndex: 10 },
      { immediate: true },
    );
    expect(tenth.type).toBe('BOSS_CLIMAX');
    expect(handoffs).toHaveLength(1);
    const eleventh = progress.handleRoundSettled(
      { playerHp: 100, playerDefeated: false, roundIndex: 11 },
      { immediate: true },
    );
    expect(eleventh.type).not.toBe('NEXT_ROUND');
    expect(handoffs).toHaveLength(1);
  });
});
