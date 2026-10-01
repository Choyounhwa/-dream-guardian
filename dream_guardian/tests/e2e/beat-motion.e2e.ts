/**
 * tests/e2e/beat-motion.e2e.ts
 *
 * Issue #186 [E2E-BEAT-001]
 * 프로덕션 Phase A 10문제 → Phase B → 결과 전체 루틴 E2E 검증 및 전이 텔레메트리 로깅
 *
 * 10대 완료 조건 엔드-투-엔드 완주 검증:
 * - 전이 로그: { frame, sessionId, roundId, state, beat, noteId, settledCount, resources }
 * - 고정 시드 / 입력 fixture 기반 결정론적 10문제 완주
 * - Phase A (10문제 정산 완료) → Phase B 단 1회 인계 → 피버/군단/보스공격 → 결전 결과
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { StateMachine } from '../../src/core/StateMachine.js';
import { SessionLifecycle } from '../../src/core/SessionLifecycle.js';
import { EventBus } from '../../src/core/EventBus.js';
import { MotionIntentBus } from '../../src/motion/MotionIntentBus.js';
import { BattleState } from '../../src/game/BattleState.js';
import { BossController } from '../../src/game/BossController.js';
import { GuardianSystem } from '../../src/game/GuardianSystem.js';
import { QuestionBank } from '../../src/question/QuestionBank.js';
import { BeatRunCoordinator } from '../../src/game/BeatRunCoordinator.js';
import { BeatRoundResolver } from '../../src/game/BeatRoundResolver.js';
import { StageProgressController } from '../../src/game/StageProgressController.js';
import { PhaseAResourceManager } from '../../src/game/PhaseAResourceManager.js';
import { PhaseAHazardController } from '../../src/game/PhaseAHazardController.js';
import { StarNoteScheduler } from '../../src/game/StarNoteScheduler.js';
import { BossFeverController } from '../../src/game/BossFeverController.js';
import { BossHazardController } from '../../src/game/BossHazardController.js';
import { ArmReachAnswerSelector } from '../../src/input/ArmReachAnswerSelector.js';
import { POSE_LANDMARKS, type NormalizedLandmark } from '../../src/types/index.js';
import { DEFAULT_CONFIG } from '../../src/core/Config.js';
import { DEFAULT_PHASE_A_HAZARD_CONFIG } from '../../config/phase-a-hazard.config.js';

export interface E2ETransitionLog {
  frame: number;
  sessionId: string;
  roundId: number;
  state: string;
  beat: number;
  noteId?: string | number;
  settledCount: number;
  resources: {
    playerHp: number;
    bossHp: number;
    mana: number;
    combo: number;
    minionCount: number;
    stardust: number;
  };
}

function createMockLandmarks(): NormalizedLandmark[] {
  const landmarks: NormalizedLandmark[] = Array.from({ length: 33 }, () => ({
    x: 0.5,
    y: 0.5,
    z: 0,
    visibility: 0.9,
  }));
  landmarks[POSE_LANDMARKS.LEFT_HIP] = { x: 0.45, y: 0.55, z: 0, visibility: 0.9 };
  landmarks[POSE_LANDMARKS.RIGHT_HIP] = { x: 0.55, y: 0.55, z: 0, visibility: 0.9 };
  landmarks[POSE_LANDMARKS.LEFT_SHOULDER] = { x: 0.40, y: 0.35, z: 0, visibility: 0.9 };
  landmarks[POSE_LANDMARKS.RIGHT_SHOULDER] = { x: 0.60, y: 0.35, z: 0, visibility: 0.9 };
  landmarks[POSE_LANDMARKS.NOSE] = { x: 0.5, y: 0.20, z: 0, visibility: 0.9 };
  return landmarks;
}

describe('[E2E-BEAT-001] End-to-End Session Execution & Telemetry Tracing', () => {
  let stateMachine: StateMachine;
  let sessionLifecycle: SessionLifecycle;
  let eventBus: EventBus;
  let motionIntentBus: MotionIntentBus;
  let battle: BattleState;
  let boss: BossController;
  let guardian: GuardianSystem;
  let questionBank: QuestionBank;
  let resourceManager: PhaseAResourceManager;
  let beatRoundResolver: BeatRoundResolver;
  let stageProgressController: StageProgressController;
  let armReachAnswerSelector: ArmReachAnswerSelector;
  let phaseAHazardController: PhaseAHazardController;
  let starNoteScheduler: StarNoteScheduler;
  let bossFeverController: BossFeverController;
  let bossHazardController: BossHazardController;
  let beatCoordinator: BeatRunCoordinator;

  let transitionLogs: E2ETransitionLog[];
  let frameCounter: number;
  const sessionId = 'test-session-e2e-001';

  function logState(state: string, roundId: number, beat = 0, noteId?: string | number): void {
    transitionLogs.push({
      frame: ++frameCounter,
      sessionId,
      roundId,
      state,
      beat,
      noteId,
      settledCount: stageProgressController.settledRoundCount,
      resources: {
        playerHp: battle.hp,
        bossHp: boss.hp,
        mana: battle.mana,
        combo: battle.combo,
        minionCount: resourceManager.minionCount,
        stardust: resourceManager.stardust,
      },
    });
  }

  beforeEach(() => {
    transitionLogs = [];
    frameCounter = 0;

    stateMachine = new StateMachine('ROUND_RESOLVE');
    stateMachine.registerState('RUN_QUESTION', {});
    stateMachine.registerState('ANSWER_SELECT', {});
    stateMachine.registerState('STAR_COLLECT', {});
    stateMachine.registerState('HAZARD_EVADE', {});
    stateMachine.registerState('ROUND_RESOLVE', {});
    stateMachine.registerState('BOSS_CLIMAX', {});
    stateMachine.registerState('RESULT', {});
    stateMachine.registerState('GAMEOVER', {});
    stateMachine.registerState('MENU_MAIN', {});

    sessionLifecycle = new SessionLifecycle();
    eventBus = new EventBus();
    motionIntentBus = new MotionIntentBus();

    battle = new BattleState(100);
    boss = new BossController(1);
    guardian = new GuardianSystem();

    questionBank = new QuestionBank();
    questionBank.loadRecords([
      {
        level: 1,
        subLevel: 1,
        levelTitle: '덧셈 기초',
        subLevelTitle: '한 자리 덧셈',
        questionTemplate: '{A} + {B} = ?',
        answerEval: 'A + B',
        wrongEval: 'A + B + 1',
        varA: '1,2,3',
        varB: '1,2,3',
        varC: '',
        varD: '',
        shapeCode: '',
      },
    ]);

    resourceManager = new PhaseAResourceManager({
      battle,
      boss,
      guardian,
      troopConfig: { initialMinions: 3, maxMinions: 13, minionsPerCorrect: 1 },
    });

    beatRoundResolver = new BeatRoundResolver({
      battle,
      boss,
      guardian,
      resourceManager,
      nonLethalPhaseA: true,
      minBossHp: 1,
      maxPhaseARounds: 10,
    });

    armReachAnswerSelector = new ArmReachAnswerSelector({ isMirrored: false });

    phaseAHazardController = new PhaseAHazardController({
      intentBus: motionIntentBus,
      damagePerMiss: DEFAULT_PHASE_A_HAZARD_CONFIG.damagePerMiss,
      onBeatResolved: ({ evaded, damage }) => {
        if (!evaded) {
          battle.applyHazardDamage(damage ?? DEFAULT_PHASE_A_HAZARD_CONFIG.damagePerMiss);
        }
      },
    });

    starNoteScheduler = new StarNoteScheduler({ secondsPerBeat: 0.5 });

    bossFeverController = new BossFeverController({
      battleState: battle,
      bossController: boss,
      stateMachine,
      scheduler: starNoteScheduler,
      config: DEFAULT_CONFIG.battle.fever,
      secondsPerBeat: 0.5,
    });

    bossHazardController = new BossHazardController({
      battleState: battle,
      bossController: boss,
      bossFeverController,
      minionTroopManager: resourceManager.troopManager,
      eventBus,
      config: {
        attackInterval: 4.0,
        warningDuration: 1.0,
        activeDuration: 0.5,
        damage: 15,
        enrageHpRatio: 0.3,
        enrageSpeedMultiplier: 1.5,
      },
    });

    stageProgressController = new StageProgressController({
      maxRounds: 10,
      stateMachine,
      sessionLifecycle,
      resourceProvider: beatRoundResolver,
      advanceDelayMs: 0,
      onAdvanceToNextRound: (nextRound) => {
        beatRoundResolver.startNewRound(nextRound);
        stateMachine.changeState('RUN_QUESTION');
        logState('RUN_QUESTION', nextRound);
      },
      onEnterBossClimax: (snapshot) => {
        resourceManager.troopManager.startPhaseB(snapshot);
        bossFeverController.start(0, snapshot);
        bossHazardController.start();
        logState('BOSS_CLIMAX', 10);
      },
      onGameOver: () => {
        stateMachine.changeState('GAMEOVER');
        logState('GAMEOVER', stageProgressController.settledRoundCount);
      },
    });

    beatCoordinator = new BeatRunCoordinator({
      questionBank,
      battle,
      armReachAnswerSelector,
      onPhaseChange: (phase) => {
        if (phase === 'RUN_QUESTION') {
          stateMachine.changeState('RUN_QUESTION');
        } else if (phase === 'ANSWER_SELECT') {
          stateMachine.changeState('ANSWER_SELECT');
        } else if (phase === 'STAR_COLLECT') {
          stateMachine.changeState('STAR_COLLECT');
        } else if (phase === 'HAZARD_EVADE') {
          stateMachine.changeState('HAZARD_EVADE');
        } else if (phase === 'ROUND_RESOLVE') {
          stateMachine.changeState('ROUND_RESOLVE');
        }
      },
    });
  });

  it('전체 E2E 승리 루틴: 10문제(정답/별수집) 완주 → BOSS_CLIMAX 자원 단일 인계 → 피버/군단 결전 → RESULT 승리', () => {
    sessionLifecycle.startSession();

    // ── Phase A: 10 라운드 실행 ──
    for (let round = 1; round <= 10; round++) {
      // 1. RUN_QUESTION 시작
      beatCoordinator.startRound({ chapter: 1 });
      logState('RUN_QUESTION', round);

      // 8박 운동 수행
      for (let s = 0; s < 8; s++) {
        beatCoordinator.recordStep();
        beatCoordinator.update(0.5, createMockLandmarks());
      }
      expect(beatCoordinator.phase).toBe('ANSWER_SELECT');
      logState('ANSWER_SELECT', round);

      // 2. ANSWER_SELECT: 정답 선택
      const correctIdx = beatCoordinator.currentQuestion!.correctIndex;
      beatCoordinator.confirmAnswerByFallback(correctIdx);
      expect(beatCoordinator.phase).toBe('STAR_COLLECT');
      logState('STAR_COLLECT', round);

      // 3. STAR_COLLECT: 7개 별노트 스케줄 및 별가루 적립
      starNoteScheduler.start(0.0, { roundId: round });
      for (let n = 0; n < 7; n++) {
        const rating = n % 2 === 0 ? 'Perfect' : 'Good';
        beatRoundResolver.recordStarRating(rating, `star_r${round}_n${n}`);
      }
      starNoteScheduler.update(4.0);

      // 4. ROUND_RESOLVE: 단일 정산 수행
      stateMachine.changeState('ROUND_RESOLVE');
      const resolveRes = beatRoundResolver.resolveRound('correct', round);
      logState('ROUND_RESOLVE', round);

      // 5. StageProgressController 라운드 전이 결정
      stageProgressController.handleRoundSettled(resolveRes, { immediate: true });
    }

    // ── Phase A 완료 상태 검증 ──
    expect(beatRoundResolver.settledRoundCount).toBe(10);
    expect(stageProgressController.settledRoundCount).toBe(10);
    expect(stageProgressController.hasEnteredBossClimax).toBe(true);
    expect(stageProgressController.handoffCount).toBe(1);
    expect(stateMachine.currentState).toBe('BOSS_CLIMAX');

    // 자원 보존 검증: 정답 10회 누적 -> 미니언: 3 + 10 = 13 (최대 상한)
    expect(resourceManager.minionCount).toBe(13);
    expect(resourceManager.stardust).toBeGreaterThan(0);

    // ── Phase B: 결전 루틴 실행 ──
    expect(bossFeverController.isActive).toBe(true);
    expect(bossHazardController.isActive).toBe(true);
    expect(resourceManager.troopManager.isActive).toBe(true);
    expect(boss.hp).toBe(1);

    // 1. 군단 탄막 발사 (보스 생존 중 탄막 발사 및 피해)
    resourceManager.troopManager.update(1.6, { autoConsumeStardust: true });
    expect(resourceManager.troopManager.barrageCount).toBeGreaterThan(0);
    expect(resourceManager.troopManager.totalBarrageDamage).toBeGreaterThan(0);
    expect(boss.isDefeated).toBe(true);

    // 2. 보스 격파 후 피버 및 결전 루프 정지, RESULT 전이
    bossFeverController.stop();
    bossHazardController.stop();
    resourceManager.troopManager.stop();
    stateMachine.changeState('RESULT');
    logState('RESULT', 10);

    expect(stateMachine.currentState).toBe('RESULT');
    expect(bossFeverController.isActive).toBe(false);
    expect(bossHazardController.isActive).toBe(false);
    expect(resourceManager.troopManager.isActive).toBe(false);

    // 텔레메트리 단조 증가 및 유효성 검증
    expect(transitionLogs.length).toBeGreaterThanOrEqual(40);
    const settledCounts = transitionLogs.map((l) => l.settledCount);
    for (let i = 1; i < settledCounts.length; i++) {
      expect(settledCounts[i]).toBeGreaterThanOrEqual(settledCounts[i - 1]);
    }
  });

  it('전체 E2E 패배 루틴: 10번째 장판 피격 사망 시 GAMEOVER 우선 전이 및 Phase B 진입 0회 검증', () => {
    sessionLifecycle.startSession();

    // 1~9 라운드: 3회 피격되어 HP 25로 진입
    battle.applyHazardDamage(75);
    for (let round = 1; round <= 9; round++) {
      beatRoundResolver.startNewRound(round);
      const res = beatRoundResolver.resolveRound('correct', round);
      stageProgressController.handleRoundSettled(res, { immediate: true });
    }

    // 10번째 라운드: 장판 피격으로 추가 25 피해 -> 사망 (HP 0)
    phaseAHazardController.start({ roundIndex: 10 });
    phaseAHazardController.update(3.6);
    expect(battle.hp).toBe(0);
    expect(battle.isAlive).toBe(false);

    beatRoundResolver.startNewRound(10);
    const fatalResult = beatRoundResolver.resolveRound('wrong', 10);
    const decision = stageProgressController.handleRoundSettled(fatalResult, { immediate: true });

    expect(decision.type).toBe('GAMEOVER');
    expect(stateMachine.currentState).toBe('GAMEOVER');
    expect(stageProgressController.hasEnteredBossClimax).toBe(false);
    expect(stageProgressController.handoffCount).toBe(0);
    expect(stageProgressController.scheduledNextRoundCount).toBe(9);
  });
});
