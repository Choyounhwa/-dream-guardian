import { beforeEach, describe, expect, it } from 'vitest';
import { BeatRunCoordinator } from '../../src/game/BeatRunCoordinator.js';
import { BattleState } from '../../src/game/BattleState.js';
import { QuestionBank } from '../../src/question/QuestionBank.js';

function createCoordinator(): { coordinator: BeatRunCoordinator; battle: BattleState } {
  const questionBank = new QuestionBank();
  questionBank.loadRecords([
    {
      level: 1,
      subLevel: 1,
      levelTitle: 'Level 1',
      subLevelTitle: 'Basic',
      questionTemplate: '{A} + {B} = ?',
      answerEval: 'A + B',
      wrongEval: 'A + B + 1',
      varA: '1',
      varB: '2',
      varC: '',
      varD: '',
      shapeCode: '',
    },
  ]);
  const battle = new BattleState();
  const coordinator = new BeatRunCoordinator({
    questionBank,
    battle,
    onAnswerConfirmed: (_idx, correct) => {
      if (correct) battle.onCorrect();
      else battle.onWrong();
    },
  });
  return { coordinator, battle };
}

describe('BeatRunCoordinator - BEAT-ROUTINE-001', () => {
  let coordinator: BeatRunCoordinator;
  let battle: BattleState;

  beforeEach(() => {
    ({ coordinator, battle } = createCoordinator());
    coordinator.startRound({ chapter: 1 });
  });

  it('remains in RUN_QUESTION without eight exercise steps regardless of elapsed time', () => {
    coordinator.update(30);

    expect(coordinator.phase).toBe('RUN_QUESTION');
    expect(coordinator.completedExerciseBeats).toBe(0);
  });

  it('moves to a fixed two-beat REST_READY segment immediately after the eighth exercise', () => {
    for (let i = 0; i < 8; i++) coordinator.recordStep('run');

    expect(coordinator.phase).toBe('REST_READY');
    expect(coordinator.readyBeat).toBe(0);

    coordinator.update(0.5);
    expect(coordinator.phase).toBe('REST_READY');
    expect(coordinator.readyBeat).toBe(1);

    coordinator.update(0.5);
    expect(coordinator.phase).toBe('KEYNOTE_PERFORMANCE');
    expect(coordinator.performanceBeat).toBe(1);
  });

  it('keeps the keynote performance open for exactly eight beats and resolves once', () => {
    for (let i = 0; i < 8; i++) coordinator.recordStep('run');
    coordinator.update(1.0);

    coordinator.update(3.99);
    expect(coordinator.phase).toBe('KEYNOTE_PERFORMANCE');
    expect(coordinator.performanceBeat).toBe(8);

    coordinator.update(0.01);
    expect(coordinator.phase).toBe('ROUND_RESOLVE');
    expect(coordinator.roundResolveCount).toBe(1);

    coordinator.update(10);
    expect(coordinator.roundResolveCount).toBe(1);
  });

  it('defers a correct answer resource settlement until the keynote segment resolves', () => {
    for (let i = 0; i < 8; i++) coordinator.recordStep('run');
    coordinator.update(1.0);

    const correctIndex = coordinator.currentQuestion!.correctIndex;
    coordinator.confirmAnswerByFallback(correctIndex);

    expect(battle.mana).toBe(0);
    expect(battle.combo).toBe(0);

    coordinator.update(4.0);
    expect(coordinator.phase).toBe('ROUND_RESOLVE');
    expect(battle.mana).toBe(25);
    expect(battle.combo).toBe(1);
  });

  it('settles a missing first-beat answer as one wrong answer at performance end', () => {
    for (let i = 0; i < 8; i++) coordinator.recordStep('run');
    coordinator.update(5.0);

    expect(coordinator.phase).toBe('ROUND_RESOLVE');
    expect(battle.wrongCount).toBe(1);
    expect(battle.hp).toBe(75);
  });
});
