import { describe, expect, it, vi, beforeEach } from 'vitest';
import { BossFeverController } from '../../src/game/BossFeverController.js';
import { BossController } from '../../src/game/BossController.js';
import { BattleState } from '../../src/game/BattleState.js';
import { StateMachine } from '../../src/core/StateMachine.js';
import { StageProgressController } from '../../src/game/StageProgressController.js';
import { StarNoteScheduler } from '../../src/game/StarNoteScheduler.js';
import { BeatRoundResolver } from '../../src/game/BeatRoundResolver.js';
import { DEFAULT_BATTLE_CONFIG } from '../../config/battle.config.js';
import type { PhaseAResourceSnapshot } from '../../src/types/result.js';

describe('BossFeverController Integration - [BOSS-FEVER-001 / #213]', () => {
  let bossController: BossController;
  let battleState: BattleState;
  let stateMachine: StateMachine;
  let scheduler: StarNoteScheduler;
  let feverController: BossFeverController;
  let stageProgressController: StageProgressController;
  let beatRoundResolver: BeatRoundResolver;

  beforeEach(() => {
    bossController = new BossController(1); // Normal boss, HP 10
    battleState = new BattleState(100);
    stateMachine = new StateMachine('ROUND_RESOLVE');
    scheduler = new StarNoteScheduler({ secondsPerBeat: 0.5 });
    beatRoundResolver = new BeatRoundResolver({
      battle: battleState,
      boss: bossController,
    });

    feverController = new BossFeverController({
      bossController,
      battleState,
      stateMachine,
      scheduler,
      config: DEFAULT_BATTLE_CONFIG.fever,
      secondsPerBeat: 0.5,
    });

    stageProgressController = new StageProgressController({
      maxRounds: 10,
      stateMachine,
      resourceProvider: beatRoundResolver,
      onEnterBossClimax: (snapshot: PhaseAResourceSnapshot) => {
        feverController.start(10.0, snapshot);
      },
    });
  });

  it('실제 10문제 정산 완료 후 Phase B로 인계되어 피버가 1회 시작되고 11번째 출제는 0회이다', () => {
    // 1~9 라운드 정산
    for (let r = 1; r <= 9; r++) {
      const decision = stageProgressController.handleRoundSettled(
        { roundIndex: r, playerDefeated: false },
        { immediate: true, roundId: r },
      );
      expect(decision.type).toBe('NEXT_ROUND');
    }

    expect(stageProgressController.scheduledNextRoundCount).toBe(9);
    expect(feverController.isActive).toBe(false);

    // 10번째 라운드 정산
    const decision10 = stageProgressController.handleRoundSettled(
      { roundIndex: 10, playerDefeated: false },
      { immediate: true, roundId: 10 },
    );

    expect(decision10.type).toBe('BOSS_CLIMAX');
    expect(stateMachine.currentState).toBe('BOSS_CLIMAX');
    expect(stageProgressController.isPhaseAComplete).toBe(true);
    expect(stageProgressController.scheduledNextRoundCount).toBe(9); // 11번째 출제 0회
    expect(feverController.isActive).toBe(true);
    expect(feverController.sequenceCount).toBe(1);
    expect(feverController.snapshot).not.toBeNull();
  });

  it('Phase A 별 수집은 보스 HP를 깎지 않지만, Phase B 피버 별 수집은 보스에게 즉시 피해를 준다', () => {
    // Phase A 모의: BeatRoundResolver를 통한 별 수집
    const initialBossHp = bossController.hp;
    beatRoundResolver.recordStarRating('Perfect', 'phase_a_note_1');
    beatRoundResolver.recordStarRating('Perfect', 'phase_a_note_2');
    expect(bossController.hp).toBe(initialBossHp); // Phase A 별 수집은 보스 피해 0

    // Phase B 진입
    feverController.start(0);
    feverController.recordRating('Perfect', 'phase_b_note_1');
    expect(bossController.hp).toBeLessThan(initialBossHp); // Phase B는 보스 피해 적용
  });

  it('연속 시퀀스 2회 이상 자동 순환 및 무입력 시 Miss 누적과 콤보 리셋을 처리한다', () => {
    feverController.start(0);
    expect(feverController.sequenceCount).toBe(1);
    expect(scheduler.isStarted).toBe(true);

    const notesInSeq1 = scheduler.notes.length;
    expect(notesInSeq1).toBeGreaterThanOrEqual(4);

    // 첫 번째 시퀀스 첫 번째 노트 수집
    const firstNote = scheduler.notes[0];
    const hitResult = scheduler.fromKeyboard(firstNote.landingTime);
    expect(hitResult).not.toBeNull();
    if (hitResult) {
      feverController.recordRating(hitResult, firstNote.id);
    }
    expect(feverController.feverCombo).toBe(1);
    expect(feverController.collectedStars).toBe(1);

    // 시퀀스 1의 나머지 노트를 모두 지나치도록 시간 경과 (무입력 Miss)
    // 마지막 노트 착지 + 1.0s 경과
    const seq1EndTime = firstNote.landingTime + notesInSeq1 * 0.5 + 1.0;
    const expiredResults = feverController.update(seq1EndTime);

    for (const exp of expiredResults) {
      feverController.recordRating(exp);
    }

    expect(feverController.feverCombo).toBe(0); // Miss 발생으로 콤보 리셋
    expect(feverController.missedStars).toBeGreaterThan(0);

    // 다음 시퀀스(Sequence 2)가 이어붙여져 생성되었는지 확인
    feverController.update(seq1EndTime + 0.1);
    expect(feverController.sequenceCount).toBeGreaterThanOrEqual(2);
    expect(scheduler.activeNotes.length).toBeGreaterThan(0);
  });

  it('Phase B에서 별 수집으로 보스를 처치하면 승리(RESULT)로 전이되고 피버가 종료된다', () => {
    const onVictorySpy = vi.fn();
    feverController = new BossFeverController({
      bossController,
      battleState,
      stateMachine,
      scheduler,
      config: DEFAULT_BATTLE_CONFIG.fever,
      onVictory: onVictorySpy,
    });

    feverController.start(0);

    // 보스 HP가 0이 될 때까지 지속 수집
    let noteIdx = 1;
    while (!bossController.isDefeated && noteIdx <= 20) {
      feverController.recordRating('Perfect', `fever_star_${noteIdx++}`);
    }

    expect(bossController.isDefeated).toBe(true);
    expect(feverController.isActive).toBe(false);
    expect(stateMachine.currentState).toBe('RESULT');
    expect(onVictorySpy).toHaveBeenCalledTimes(1);
  });
});
