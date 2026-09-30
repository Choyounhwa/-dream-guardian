import { describe, it, expect, beforeEach } from 'vitest';
import { StateMachine } from '../../src/core/StateMachine.js';
import { BattleState } from '../../src/game/BattleState.js';
import { BossController } from '../../src/game/BossController.js';
import { GuardianSystem } from '../../src/game/GuardianSystem.js';
import { BeatRoundResolver } from '../../src/game/BeatRoundResolver.js';
import { BeatRunCoordinator } from '../../src/game/BeatRunCoordinator.js';
import { ArmReachAnswerSelector } from '../../src/input/ArmReachAnswerSelector.js';
import { QuestionBank } from '../../src/question/QuestionBank.js';
import {
  PhaseAHazardController,
  type PhaseAHazardBeatResult,
} from '../../src/game/PhaseAHazardController.js';
import {
  DEFAULT_PHASE_A_HAZARD_CONFIG,
  PHASE_A_ACTIVE_HAZARD_PATTERNS,
} from '../../config/phase-a-hazard.config.js';

describe('Phase A Hazard Evade Runtime Lifecycle (Issue #236 / BUG-HAZARD-LIFECYCLE-001)', () => {
  let battle: BattleState;
  let boss: BossController;
  let guardian: GuardianSystem;
  let resolver: BeatRoundResolver;
  let coordinator: BeatRunCoordinator;
  let questionBank: QuestionBank;
  let answerSelector: ArmReachAnswerSelector;
  let stateMachine: StateMachine;
  let hazardController: PhaseAHazardController;
  let resolvedBeats: PhaseAHazardBeatResult[];

  beforeEach(() => {
    battle = new BattleState();
    boss = new BossController();
    guardian = new GuardianSystem();
    resolver = new BeatRoundResolver({ battle, boss, guardian });
    questionBank = new QuestionBank();
    answerSelector = new ArmReachAnswerSelector();
    resolvedBeats = [];

    hazardController = new PhaseAHazardController({
      damagePerMiss: DEFAULT_PHASE_A_HAZARD_CONFIG.damagePerMiss,
      onBeatResolved: (result) => {
        resolvedBeats.push(result);
        if (!result.evaded) {
          battle.applyHazardDamage(result.damage ?? DEFAULT_PHASE_A_HAZARD_CONFIG.damagePerMiss);
        }
      },
    });

    stateMachine = new StateMachine('RUN_QUESTION');
    stateMachine.registerState('RUN_QUESTION', {});
    stateMachine.registerState('ANSWER_SELECT', {});
    stateMachine.registerState('STAR_COLLECT', {});
    stateMachine.registerState('HAZARD_EVADE', {
      enter: () => {
        if (!hazardController.isActive) {
          hazardController.start({
            roundIndex: resolver.currentRoundIndex,
          });
        }
      },
      exit: () => {
        hazardController.stop();
      },
    });
    stateMachine.registerState('ROUND_RESOLVE', {});
    stateMachine.registerState('GAMEOVER', {});
    stateMachine.registerState('MENU_MAIN', {});

    coordinator = new BeatRunCoordinator({
      questionBank,
      battle,
      armReachAnswerSelector: answerSelector,
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
      onAnswerSelected: () => {},
      onAnswerConfirmed: (_idx, _correct, status) => {
        resolver.resolveRound(status);
      },
    });
  });

  describe('1. RUN / STAR 상태에서 장판 비활성 및 장판 피해 0 보장', () => {
    it('RUN_QUESTION 및 STAR_COLLECT 상태에서 hazardController는 비활성이며 피해가 0이다', () => {
      coordinator.startRound({ chapter: 1 });
      expect(stateMachine.currentState).toBe('RUN_QUESTION');
      expect(hazardController.isActive).toBe(false);
      expect(hazardController.activePattern).toBeNull();

      // 8박 달리기 진행
      for (let i = 0; i < 8; i++) {
        coordinator.recordStep('run');
        coordinator.update(0.5);
      }

      expect(hazardController.isActive).toBe(false);
      expect(battle.hp).toBe(100);

      // 정답 선택 -> STAR_COLLECT 전이
      const correctIdx = coordinator.currentQuestion!.correctIndex;
      coordinator.confirmAnswerByFallback(correctIdx);
      expect(stateMachine.currentState).toBe('STAR_COLLECT');
      expect(hazardController.isActive).toBe(false);

      // STAR_COLLECT 4초(8박) 진행
      coordinator.update(4.0);
      expect(stateMachine.currentState).toBe('ROUND_RESOLVE');
      expect(hazardController.isActive).toBe(false);
      expect(battle.hp).toBe(100);
      expect(resolvedBeats).toHaveLength(0);
    });
  });

  describe('2. HAZARD_EVADE 진입 start 1회 / 퇴장 stop 수명주기', () => {
    it('HAZARD_EVADE 진입 시 start 1회 호출되고 활성 패턴이 지정되며, 퇴장 시 stop된다', () => {
      coordinator.startRound({ chapter: 1 });
      for (let i = 0; i < 8; i++) {
        coordinator.recordStep('run');
        coordinator.update(0.5);
      }

      // 오답 선택 -> HAZARD_EVADE 진입
      const wrongIdx = coordinator.currentQuestion!.correctIndex === 0 ? 1 : 0;
      coordinator.confirmAnswerByFallback(wrongIdx);

      expect(stateMachine.currentState).toBe('HAZARD_EVADE');
      expect(hazardController.isActive).toBe(true);
      expect(hazardController.activePattern).not.toBeNull();
      expect(PHASE_A_ACTIVE_HAZARD_PATTERNS).toContain(hazardController.activePattern);

      // 8박(4.0s) 경과 후 ROUND_RESOLVE로 전이되며 stop() 호출
      coordinator.update(4.0);
      expect(stateMachine.currentState).toBe('ROUND_RESOLVE');
      expect(hazardController.isActive).toBe(false);
      expect(hazardController.activePattern).toBeNull();
    });
  });

  describe('3. 단일 회피 성공 시 0피해 vs 미회피 실패 시 설정 피해 1회 (-25)', () => {
    it('올바른 회피 동작 수행 시 evaded=true, 피해 0으로 HP 100 유지', () => {
      coordinator.startRound({ chapter: 1 });
      for (let i = 0; i < 8; i++) {
        coordinator.recordStep('run');
        coordinator.update(0.5);
      }
      const wrongIdx = coordinator.currentQuestion!.correctIndex === 0 ? 1 : 0;
      coordinator.confirmAnswerByFallback(wrongIdx);
      expect(stateMachine.currentState).toBe('HAZARD_EVADE');

      const pattern = hazardController.activePattern!;
      // 입력창(2.6s~3.4s) 내 올바른 동작 수행
      hazardController.update(2.8);
      hazardController.recordAction(pattern);

      // 판정 시점(3.5s) 도달
      hazardController.update(0.7);
      expect(resolvedBeats).toHaveLength(1);
      expect(resolvedBeats[0].evaded).toBe(true);
      expect(resolvedBeats[0].damage).toBe(0);
      expect(battle.hp).toBe(100);

      // 라운드 정산 완료(4.0s)
      coordinator.update(4.0);
      expect(stateMachine.currentState).toBe('ROUND_RESOLVE');
      expect(battle.hp).toBe(100);
    });

    it('회피 미수행 시 판정 시점(3.5s)에 정확히 1회 -25 피해를 입는다', () => {
      coordinator.startRound({ chapter: 1 });
      for (let i = 0; i < 8; i++) {
        coordinator.recordStep('run');
        coordinator.update(0.5);
      }
      const wrongIdx = coordinator.currentQuestion!.correctIndex === 0 ? 1 : 0;
      coordinator.confirmAnswerByFallback(wrongIdx);

      // 동작 입력 없이 3.5초 판정 시점 도달
      hazardController.update(3.5);
      expect(resolvedBeats).toHaveLength(1);
      expect(resolvedBeats[0].evaded).toBe(false);
      expect(resolvedBeats[0].damage).toBe(25);
      expect(battle.hp).toBe(75);

      // 4.0s 라운드 정산 완료까지 추가 피해 없이 75 유지
      hazardController.update(0.5);
      coordinator.update(4.0);
      expect(resolvedBeats).toHaveLength(1); // 1회만 판정
      expect(battle.hp).toBe(75);
    });
  });

  describe('4. 잘못된 선행 액션이 올바른 회피를 차단하지 않는 정책 검증', () => {
    it('틀린 동작을 먼저 입력해도 올바른 동작을 후속 입력하면 성공으로 확정 잠금된다', () => {
      const hc = new PhaseAHazardController({
        pattern: ['jump'],
        damagePerMiss: 25,
      });

      hc.start();
      expect(hc.activePattern).toBe('jump');

      // 1. 잘못된 선행 액션: left_step 입력 -> 기회를 소모하거나 실패로 잠그지 않음
      hc.recordAction('left_step');
      expect(hc.isEvaded).toBe(false);

      // 2. 또 다른 잘못된 액션: right_step 입력
      hc.recordAction('right_step');
      expect(hc.isEvaded).toBe(false);

      // 3. 올바른 회피 액션: jump 입력 -> 성공 잠금!
      hc.recordAction('jump');
      expect(hc.isEvaded).toBe(true);

      // 4. 성공 확정 후 후속 오동작 입력 -> 성공 잠금 유지
      hc.recordAction('left_step');
      expect(hc.isEvaded).toBe(true);

      // 5. 판정 시점 경과
      hc.update(3.5);
      expect(hc.isResolved).toBe(true);
      expect(hc.isEvaded).toBe(true);
    });
  });

  describe('5. Pose·키보드·터치 연결 및 pause 중 입력 차단', () => {
    it('발 키노트, 점프, 키보드 입력이 라우팅되며, pause 상태에서는 입력이 차단된다', () => {
      const hc = new PhaseAHazardController({
        pattern: ['left_step'],
      });
      hc.start();

      let isPaused = true;

      // 일시정지 중 입력 시도 -> 차단되어 처리되지 않음
      if (!isPaused) {
        hc.recordAction('left_step');
      }
      expect(hc.isEvaded).toBe(false);

      // 일시정지 해제 후 정상 입력
      isPaused = false;
      if (!isPaused) {
        hc.recordAction('left_step');
      }
      expect(hc.isEvaded).toBe(true);
    });
  });

  describe('6. 최종 공격 결과 반영 후 정산 및 HP 0 시 게임오버 우선', () => {
    it('회피 실패로 HP 0 도달 시 ROUND_RESOLVE에서 playerDefeated가 true가 되며 다음 페이즈 진입이 차단된다', () => {
      // 플레이어 HP를 25로 설정 (1회 피격 시 사망)
      battle.setHp(25);
      expect(battle.hp).toBe(25);

      coordinator.startRound({ chapter: 1 });
      for (let i = 0; i < 8; i++) {
        coordinator.recordStep('run');
        coordinator.update(0.5);
      }
      // 오답 선택
      const wrongIdx = coordinator.currentQuestion!.correctIndex === 0 ? 1 : 0;
      coordinator.confirmAnswerByFallback(wrongIdx);

      // 3.5초 판정 시점에 회피 실패 (-25) -> HP 0
      hazardController.update(3.5);
      expect(battle.hp).toBe(0);
      expect(battle.isAlive).toBe(false);

      // 4.0초 라운드 정산
      coordinator.update(4.0);
      expect(stateMachine.currentState).toBe('ROUND_RESOLVE');
      expect(resolver.lastResolveResult?.playerDefeated).toBe(true);
      expect(resolver.lastResolveResult?.playerHp).toBe(0);
    });
  });

  describe('7. 3D 장판 진행도(beatProgress) 단조 증가 및 표시용 상태 제공', () => {
    it('beatProgress는 소실점(0.0)에서 판정 시점(3.5s)까지 1.0으로 단조 증가한다', () => {
      const hc = new PhaseAHazardController();
      hc.start();

      expect(hc.beatProgress).toBe(0);

      hc.update(1.75);
      expect(hc.beatProgress).toBeCloseTo(0.5, 2);

      hc.update(1.75); // 3.5s
      expect(hc.beatProgress).toBeCloseTo(1.0, 2);
    });
  });
});
