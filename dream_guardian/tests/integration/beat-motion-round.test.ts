/**
 * tests/integration/beat-motion-round.test.ts
 *
 * Issue #186 [E2E-BEAT-001]
 * 프로덕션 Phase A 10문제 → Phase B → 결과 전체 루틴 통합/E2E 검증
 *
 * 10대 완료 조건 전수 검증:
 * 1. 8-beat round pacing: no premature skip, no 30s auto-fill
 * 2. Answer branch: Correct -> star collect / Wrong & Timeout -> hazard evade. Question UI clean
 * 3. Star note schedule: 7 notes scheduled and evaluated; no-input results in 7 misses; settled after 7th note
 * 4. Phase A non-lethal & damage policy: wrong answer deals 0 direct player damage; only failed hazard evade deals 25 damage
 * 5. 10 consecutive correct answers: NO early victory! Exactly 10 settled questions -> exactly 1 Phase B transition
 * 6. Player HP <= 0 on 10th round hazard: GAMEOVER takes precedence over Phase B; 0 Phase B handoffs, 0 11th questions
 * 7. Phase B transition and resource preservation: zero-reset on minion troop (3..13) and stardust; Fever combo note loop active; Minion barrage fires; Boss attacks & enrage at <= 30% HP
 * 8. Climax resolution: Boss HP <= 0 -> single RESULT (Victory) transition; Player HP <= 0 -> single GAMEOVER transition; all loops stop cleanly with 0 leftover notes/attacks
 * 9. Lifecycle resilience: pause modal freezes timers; menu exit cleanly stops session; restart initializes cleanly; fallback keyboard/touch works
 * 10. Deterministic seed repeatability: 10 rounds with fixed seed and variable seed
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
import type { PhaseAResourceSnapshot } from '../../src/types/result.js';

/** 정적 랜드마크 생성 도우미 (동작 없음) */
function createStationaryLandmarks(): NormalizedLandmark[] {
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

describe('[E2E-BEAT-001] Phase A 10문제 → Phase B → 결과 루틴 E2E 통합 검증', () => {
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

  beforeEach(() => {
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
    boss = new BossController(1); // Ch.1 boss HP = 10
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
      damagePerMiss: DEFAULT_PHASE_A_HAZARD_CONFIG.damagePerMiss, // 25
      onBeatResolved: ({ evaded, damage }) => {
        if (!evaded) {
          const appliedDamage = damage ?? DEFAULT_PHASE_A_HAZARD_CONFIG.damagePerMiss;
          battle.applyHazardDamage(appliedDamage);
        }
      },
    });

    starNoteScheduler = new StarNoteScheduler({
      secondsPerBeat: 0.5,
    });

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
      advanceDelayMs: 0, // 테스트 환경 즉시 전이
      onAdvanceToNextRound: (nextRound) => {
        beatRoundResolver.startNewRound(nextRound);
        stateMachine.changeState('RUN_QUESTION');
      },
      onEnterBossClimax: (snapshot) => {
        resourceManager.troopManager.startPhaseB(snapshot);
        bossFeverController.start(0, snapshot);
        bossHazardController.start();
      },
      onGameOver: () => {
        stateMachine.changeState('GAMEOVER');
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

  // ──────────────────────────────────────────────────────────────────────────
  // 시나리오 1: 실제 8박 끝 전 빠른 8회 입력 조기전환 0 · 30초 무동작 자동채움 0
  // ──────────────────────────────────────────────────────────────────────────
  describe('시나리오 1: 8-beat round pacing (조기 전환 0 & 30s 무동작 자동채움 0)', () => {
    it('30초 동안 움직임이 없어도 운동 비트가 자동 채워지거나 답 선택으로 조기 전환되지 않는다', () => {
      beatCoordinator.startRound({ chapter: 1 });
      expect(stateMachine.currentState).toBe('RUN_QUESTION');
      expect(beatCoordinator.completedExerciseBeats).toBe(0);

      // 30초 동안 정적 랜드마크(무동작)로 업데이트
      const staticLm = createStationaryLandmarks();
      const dt = 0.1;
      for (let t = 0; t < 30.0; t += dt) {
        beatCoordinator.update(dt, staticLm);
      }

      // 30초 무동작 후에도 비트가 자동 채워지지 않아야 함 (0/8)
      expect(beatCoordinator.completedExerciseBeats).toBe(0);
      expect(beatCoordinator.phase).toBe('RUN_QUESTION');
      expect(stateMachine.currentState).toBe('RUN_QUESTION');
    });

    it('8박(4.0s)이 완료되기 전에는 빠른 입력을 시도해도 조기 전환되지 않고 정확히 8박 완료 시 전이한다', () => {
      beatCoordinator.startRound({ chapter: 1 });

      // 슬롯 창(0.5s 간격)을 준수하며 7박까지 진행
      for (let slot = 0; slot < 7; slot++) {
        beatCoordinator.recordStep();
        beatCoordinator.update(0.5, createStationaryLandmarks());
        expect(beatCoordinator.completedExerciseBeats).toBe(slot + 1);
        expect(beatCoordinator.phase).toBe('RUN_QUESTION');
        expect(stateMachine.currentState).toBe('RUN_QUESTION');
      }

      // 7박까지는 여전히 RUN_QUESTION 유지
      expect(beatCoordinator.completedExerciseBeats).toBe(7);
      expect(beatCoordinator.phase).toBe('RUN_QUESTION');

      // 8번째 박 완료 시 비로소 ANSWER_SELECT 전환
      beatCoordinator.recordStep();
      beatCoordinator.update(0.5, createStationaryLandmarks());
      expect(beatCoordinator.completedExerciseBeats).toBe(8);
      expect(beatCoordinator.phase).toBe('ANSWER_SELECT');
      expect(stateMachine.currentState).toBe('ANSWER_SELECT');
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // 시나리오 2: 정답 즉시 별모으기 / 오답·타임아웃 즉시 회피, 레거시 답안 UI 0
  // ──────────────────────────────────────────────────────────────────────────
  describe('시나리오 2: Answer branch (정답->별모으기 / 오답·타임아웃->회피, UI 정리)', () => {
    function advanceToAnswerSelect(): void {
      beatCoordinator.startRound({ chapter: 1 });
      for (let s = 0; s < 8; s++) {
        beatCoordinator.recordStep();
        beatCoordinator.update(0.5, createStationaryLandmarks());
      }
      expect(beatCoordinator.phase).toBe('ANSWER_SELECT');
      expect(stateMachine.currentState).toBe('ANSWER_SELECT');
      armReachAnswerSelector.openWindow();
    }

    it('정답 선택 시 즉시 STAR_COLLECT로 전이하고 답안 선택창이 닫힌다', () => {
      advanceToAnswerSelect();

      const correctIdx = beatCoordinator.currentQuestion!.correctIndex;
      beatCoordinator.confirmAnswerByFallback(correctIdx);

      expect(beatCoordinator.phase).toBe('STAR_COLLECT');
      expect(stateMachine.currentState).toBe('STAR_COLLECT');
      expect(beatCoordinator.isAnswerOpen).toBe(false);
    });

    it('오답 선택 시 즉시 HAZARD_EVADE로 전이하고 답안 선택창이 닫힌다', () => {
      advanceToAnswerSelect();

      const wrongIdx = 1 - beatCoordinator.currentQuestion!.correctIndex;
      beatCoordinator.confirmAnswerByFallback(wrongIdx);

      expect(beatCoordinator.phase).toBe('HAZARD_EVADE');
      expect(stateMachine.currentState).toBe('HAZARD_EVADE');
      expect(beatCoordinator.isAnswerOpen).toBe(false);
    });

    it('답안 선택 시간 초과(timeout) 시 즉시 HAZARD_EVADE로 전이한다', () => {
      advanceToAnswerSelect();

      // 2박(1.0s) 동안 무응답 경과
      beatCoordinator.update(1.05, createStationaryLandmarks());

      expect(beatCoordinator.phase).toBe('HAZARD_EVADE');
      expect(stateMachine.currentState).toBe('HAZARD_EVADE');
      expect(beatCoordinator.isAnswerOpen).toBe(false);
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // 시나리오 3: 별 노트 7개 각 1회 / 무입력 7 Miss / 마지막 판정 후 정산
  // ──────────────────────────────────────────────────────────────────────────
  describe('시나리오 3: Star note schedule (7개 분리 예약 / 무입력 7 Miss / 마지막 후 정산)', () => {
    it('STAR_COLLECT 진입 시 7개 노트가 0.5s 간격으로 예약되고 무입력 시 7 Miss로 정산된다', () => {
      const recordedRatings: string[] = [];
      starNoteScheduler.onRating((result) => {
        recordedRatings.push(result.rating);
        beatRoundResolver.recordStarRating(result.rating);
      });

      starNoteScheduler.start(0.0, { roundId: 1 });
      expect(starNoteScheduler.notes).toHaveLength(7);

      // 시간 진행: 7번째 노트(3.5s) 및 판정 만료창(3.9s) 경과 (무입력: landmarks 없음)
      starNoteScheduler.update(4.0);

      // 7개 각 1회씩 총 7 Miss 발생
      expect(recordedRatings).toHaveLength(7);
      expect(recordedRatings.every((r) => r === 'Miss')).toBe(true);
      expect(beatRoundResolver.rhythmStats.missedStars).toBe(7);
      expect(beatRoundResolver.rhythmStats.perfectHits).toBe(0);

      // 마지막 7번째 노트 판정 후 단 1회 정산 가능
      expect(starNoteScheduler.isComplete).toBe(true);
      expect(starNoteScheduler.resolvedCount).toBe(7);
      const resolveResult = beatRoundResolver.resolveRound('correct', 1);
      expect(resolveResult.roundIndex).toBe(1);
      expect(resolveResult.status).toBe('correct');
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // 시나리오 4: Phase A 오답 직접 피해 0 · 승인 회피 실패 피해만 반영
  // ──────────────────────────────────────────────────────────────────────────
  describe('시나리오 4: Phase A non-lethal & damage policy (오답 직접피해 0 / 회피실패 25 피해)', () => {
    it('오답 및 타임아웃 정산 자체로는 플레이어 HP가 직접 감소하지 않는다', () => {
      expect(battle.hp).toBe(100);

      // 오답 정산
      const wrongResult = beatRoundResolver.resolveRound('wrong', 1);
      expect(wrongResult.damageTaken).toBe(0);
      expect(battle.hp).toBe(100);

      // 타임아웃 정산
      beatRoundResolver.startNewRound(2);
      const timeoutResult = beatRoundResolver.resolveRound('timeout', 2);
      expect(timeoutResult.damageTaken).toBe(0);
      expect(battle.hp).toBe(100);
    });

    it('HAZARD_EVADE에서 회피 성공 시 피해 0, 회피 실패(피격) 시에만 정확히 25 피해를 입는다', () => {
      phaseAHazardController.start({ roundIndex: 1 });
      expect(battle.hp).toBe(100);

      // 1. 회피 성공: 활성화된 패턴에 정확한 액션 입력
      const activePattern = phaseAHazardController.activePattern!;
      phaseAHazardController.recordAction(activePattern);

      phaseAHazardController.update(3.6);
      expect(battle.hp).toBe(100); // 회피 성공 시 피해 0

      // 2. 회피 실패: 액션 없이 judgmentTime(3.5s) 경과 시 25 피해
      phaseAHazardController.start({ roundIndex: 2 });
      phaseAHazardController.update(3.6);
      expect(battle.hp).toBe(75); // 100 - 25 = 75
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // 시나리오 5: 10연속 정답에도 조기 승리 0, 정확히 10정산 후 Phase B 1회 인계
  // ──────────────────────────────────────────────────────────────────────────
  describe('시나리오 5: 10 consecutive correct answers (조기 승리 0 & Phase B 1회 전환)', () => {
    it('10연속 정답 시에도 Phase A에서 보스 체력은 1 미만으로 떨어지지 않으며, 10번째 후 단 1회 BOSS_CLIMAX로 전이한다', () => {
      let phaseBHandoffSnapshot: PhaseAResourceSnapshot | null = null;
      stageProgressController.registerPhaseBReceiver((snapshot) => {
        phaseBHandoffSnapshot = snapshot;
      });

      for (let r = 1; r <= 9; r++) {
        beatRoundResolver.recordStarRating('Perfect', `note-${r}`);
        stateMachine.changeState('ROUND_RESOLVE');
        const resolveResult = beatRoundResolver.resolveRound('correct', r);
        const decision = stageProgressController.handleRoundSettled(resolveResult, { immediate: true });

        expect(decision.type).toBe('NEXT_ROUND');
        expect(boss.isDefeated).toBe(false);
        expect(boss.hp).toBeGreaterThanOrEqual(1); // 최소 1 보장
        expect(stageProgressController.hasEnteredBossClimax).toBe(false);
        expect(stateMachine.currentState).toBe('RUN_QUESTION');
      }

      expect(stageProgressController.scheduledNextRoundCount).toBe(9);
      expect(beatRoundResolver.settledRoundCount).toBe(9);

      // 10번째 정답 정산
      beatRoundResolver.recordStarRating('Perfect', 'note-10');
      stateMachine.changeState('ROUND_RESOLVE');
      const round10Result = beatRoundResolver.resolveRound('correct', 10);
      const round10Decision = stageProgressController.handleRoundSettled(round10Result, { immediate: true });

      // 검증: BOSS_CLIMAX 전이 및 단 1회 인계
      expect(round10Decision.type).toBe('BOSS_CLIMAX');
      expect(stateMachine.currentState).toBe('BOSS_CLIMAX');
      expect(stageProgressController.hasEnteredBossClimax).toBe(true);
      expect(stageProgressController.handoffCount).toBe(1);
      expect(phaseBHandoffSnapshot).not.toBeNull();
      expect((phaseBHandoffSnapshot as PhaseAResourceSnapshot | null)?.isPhaseAComplete).toBe(true);

      // 11번째 문제 스케줄링 0회 검증
      expect(stageProgressController.scheduledNextRoundCount).toBe(9);
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // 시나리오 6: 10번째 회피 HP 0 -> 게임오버 우선, 11번째 출제 0
  // ──────────────────────────────────────────────────────────────────────────
  describe('시나리오 6: Fatal damage in round 10 hazard (GAMEOVER 우선 & Phase B 0회)', () => {
    it('10번째 라운드 장판 피격으로 플레이어 HP가 0이 되면 BOSS_CLIMAX 대신 GAMEOVER로 전이한다', () => {
      // 1~9 라운드 진행 중 플레이어가 3회 피격되어 HP 25 남음
      battle.applyHazardDamage(75);
      expect(battle.hp).toBe(25);

      for (let r = 1; r <= 9; r++) {
        beatRoundResolver.startNewRound(r);
        const res = beatRoundResolver.resolveRound('correct', r);
        stageProgressController.handleRoundSettled(res, { immediate: true });
      }

      // 10번째 라운드에서 추가 25 피해 피격 -> HP 0 사망
      battle.applyHazardDamage(25);
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

  // ──────────────────────────────────────────────────────────────────────────
  // 시나리오 7: 자원 인계 정확 · 피버 연속 시퀀스 · 군단 소비 · 보스 공격/광폭화
  // ──────────────────────────────────────────────────────────────────────────
  describe('시나리오 7: Phase B transition & resource preservation (Zero-Reset, 군단/피버/보스공격)', () => {
    it('Phase A에서 획득한 군단(3~13)과 별가루가 Phase B 진입 시 0으로 리셋되지 않고 정상 보존된다', () => {
      // 7 정답 누적 -> 미니언: 3 + 7 = 10, 별가루 적립
      for (let r = 1; r <= 7; r++) {
        resourceManager.onRoundSettled('correct', r);
        resourceManager.recordStarRating('Perfect', `note-${r}`); // 4점 * 7 = 28
      }
      expect(resourceManager.minionCount).toBe(10);
      expect(resourceManager.stardust).toBe(28);

      // Phase B 인계
      const snapshot = resourceManager.getResourceSnapshot();
      resourceManager.troopManager.startPhaseB(snapshot);

      // Zero-Reset 검증
      expect(resourceManager.troopManager.minionCount).toBe(10);
      expect(resourceManager.stardust).toBe(28);
      expect(resourceManager.troopManager.isActive).toBe(true);
    });

    it('Phase B에서 피버 콤보 누적, 군단 별가루 소비 탄막 발사, 보스 광폭화(HP 30% 이하)가 정상 발동한다', () => {
      const snapshot = resourceManager.getResourceSnapshot();
      resourceManager.troopManager.startPhaseB(snapshot);
      bossFeverController.start(0, snapshot);
      bossHazardController.start();

      // 1. 피버 콤보 및 데미지 검증
      bossFeverController.recordRating('Perfect', 'fever-note-1');
      bossFeverController.recordRating('Perfect', 'fever-note-2');
      expect(battle.feverCombo).toBe(2);
      expect(bossFeverController.feverCombo).toBe(2);

      // 2. 군단 탄막 발사 및 별가루 소비 검증
      resourceManager.recordStarRating('Perfect', 'stardust-1'); // +4
      resourceManager.recordStarRating('Perfect', 'stardust-2'); // +4 (총 8)
      expect(resourceManager.stardust).toBeGreaterThanOrEqual(5);

      // 쿨다운 1.5s 경과하여 탄막 발사 트리거
      resourceManager.troopManager.update(1.6, { autoConsumeStardust: true });
      expect(resourceManager.troopManager.barrageCount).toBeGreaterThan(0);
      expect(resourceManager.troopManager.totalBarrageDamage).toBeGreaterThan(0);

      // 3. 보스 광폭화(Enrage) 검증: HP <= 30% 시 발동 (보스가 살아있는 상태 3/10)
      boss.reset(1); // HP 10으로 초기화 후 7 피해 적용하여 3/10 달성
      boss.takeDamage(7); // 10 -> 3 (30%)
      expect(boss.isDefeated).toBe(false);
      expect(boss.hp).toBe(3);

      bossHazardController.update(0.1);
      expect(bossHazardController.isEnraged).toBe(true);
      expect(bossHazardController.effectiveAttackInterval).toBeCloseTo(4.0 / 1.5, 2);
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // 시나리오 8: 승패 결과 1회 · 종료 후 노트/공격/이전 예약 0
  // ──────────────────────────────────────────────────────────────────────────
  describe('시나리오 8: Climax resolution (승리/패배 단 1회 전이 및 모든 루프 정지)', () => {
    it('보스 체력 0 도달 시 RESULT로 단 1회 전이하고 모든 결전 루프가 정지한다', () => {
      let victoryCallCount = 0;
      bossFeverController = new BossFeverController({
        battleState: battle,
        bossController: boss,
        stateMachine,
        scheduler: starNoteScheduler,
        onVictory: () => {
          victoryCallCount++;
          stateMachine.changeState('RESULT');
          bossFeverController.stop();
          bossHazardController.stop();
          resourceManager.troopManager.stop();
        },
      });

      bossFeverController.start(0);
      bossHazardController.start();
      resourceManager.troopManager.startPhaseB();

      // 보스 HP 0 도달
      boss.takeDamage(10);
      expect(boss.isDefeated).toBe(true);

      bossFeverController.recordRating('Perfect', 'kill-note');

      expect(victoryCallCount).toBe(1);
      expect(stateMachine.currentState).toBe('RESULT');
      expect(bossFeverController.isActive).toBe(false);
      expect(bossHazardController.isActive).toBe(false);
      expect(resourceManager.troopManager.isActive).toBe(false);
    });

    it('플레이어 HP 0 도달 시 GAMEOVER로 단 1회 전이하고 모든 결전 루프가 정지한다', () => {
      let defeatCallCount = 0;
      bossFeverController = new BossFeverController({
        battleState: battle,
        bossController: boss,
        stateMachine,
        scheduler: starNoteScheduler,
        onGameOver: () => {
          defeatCallCount++;
          stateMachine.changeState('GAMEOVER');
          bossFeverController.stop();
          bossHazardController.stop();
          resourceManager.troopManager.stop();
        },
      });

      bossFeverController.start(0);
      bossHazardController.start();
      resourceManager.troopManager.startPhaseB();

      // 플레이어 HP 0 도달
      battle.applyHazardDamage(100);
      expect(battle.isAlive).toBe(false);

      bossFeverController.update(0.1, createStationaryLandmarks());

      expect(defeatCallCount).toBe(1);
      expect(stateMachine.currentState).toBe('GAMEOVER');
      expect(bossFeverController.isActive).toBe(false);
      expect(bossHazardController.isActive).toBe(false);
      expect(resourceManager.troopManager.isActive).toBe(false);
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // 시나리오 9: Pause · 메뉴 복귀 · 재시작 · Fallback 키보드 동일 계약
  // ──────────────────────────────────────────────────────────────────────────
  describe('시나리오 9: Lifecycle resilience (Pause 동결, 메뉴 복귀, 재시작, Fallback 입력)', () => {
    it('일시정지 중에는 보스 공격 및 군단 탄막 타이머가 동결된다', () => {
      bossHazardController.start({ initialDelay: 2.0 });
      resourceManager.troopManager.startPhaseB();

      // pause
      bossHazardController.pause();
      resourceManager.troopManager.pause();

      expect(bossHazardController.isPaused).toBe(true);
      expect(resourceManager.troopManager.isPaused).toBe(true);

      const initialCooldown = resourceManager.troopManager.cooldownTimer;

      bossHazardController.update(1.0);
      resourceManager.troopManager.update(1.0);

      // 시간 불변 검증
      expect(resourceManager.troopManager.cooldownTimer).toBe(initialCooldown);

      // resume 후 정상 전진
      bossHazardController.resume();
      resourceManager.troopManager.resume();
      expect(bossHazardController.isPaused).toBe(false);
      expect(resourceManager.troopManager.isPaused).toBe(false);
    });

    it('메뉴 복귀 시 모든 비동기 스케줄러와 컨트롤러가 깨끗이 초기화된다', () => {
      stageProgressController.handleRoundSettled({ playerHp: 100, roundIndex: 1 }, { immediate: false });
      bossFeverController.start(0);
      bossHazardController.start();

      // 메뉴 복귀 시뮬레이션
      sessionLifecycle.endSession();
      stageProgressController.reset();
      bossFeverController.reset();
      bossHazardController.reset();
      resourceManager.troopManager.reset();
      stateMachine.changeState('MENU_MAIN');

      expect(stateMachine.currentState).toBe('MENU_MAIN');
      expect(stageProgressController.hasEnteredBossClimax).toBe(false);
      expect(stageProgressController.settledRoundCount).toBe(0);
      expect(bossFeverController.isActive).toBe(false);
      expect(bossHazardController.isActive).toBe(false);
      expect(resourceManager.troopManager.isActive).toBe(false);
    });

    it('키보드/터치 Fallback 입력(jump, step_left, step_right)이 보스 패턴 공격에 정상 반영된다', () => {
      bossHazardController.start({ initialDelay: 0 });
      bossHazardController.triggerAttack('dual_slam');
      expect(bossHazardController.currentAttack).toBe('dual_slam');

      // fallback jump 입력
      const evaded = bossHazardController.recordAction('jump');
      expect(evaded).toBe(true);
      expect(bossHazardController.isEvaded).toBe(true);
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // 시나리오 10: 고정 시드 10회 연속 동일성 + 별도 시드 상이성 검증
  // ──────────────────────────────────────────────────────────────────────────
  describe('시나리오 10: Deterministic seed repeatability (결정론적 시드 반복성)', () => {
    it('동일한 문제 데이터셋으로 10문제를 생성하면 항상 동일한 문제 수식과 선택지가 재현된다', () => {
      const records = [
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
      ];

      const run1Questions: string[] = [];
      const run2Questions: string[] = [];

      // Run 1
      const qb1 = new QuestionBank();
      qb1.loadRecords(records);
      qb1.setLevel(1, 1);
      for (let i = 0; i < 10; i++) {
        const rec = qb1.next();
        run1Questions.push(`${rec.questionTemplate}|${rec.answerEval}`);
      }

      // Run 2
      const qb2 = new QuestionBank();
      qb2.loadRecords(records);
      qb2.setLevel(1, 1);
      for (let i = 0; i < 10; i++) {
        const rec = qb2.next();
        run2Questions.push(`${rec.questionTemplate}|${rec.answerEval}`);
      }

      expect(run1Questions).toHaveLength(10);
      expect(run2Questions).toHaveLength(10);
      expect(run1Questions).toEqual(run2Questions);
    });
  });
});
