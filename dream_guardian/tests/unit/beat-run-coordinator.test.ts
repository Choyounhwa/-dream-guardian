import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BeatRunCoordinator } from '../../src/game/BeatRunCoordinator.js';
import { BattleState } from '../../src/game/BattleState.js';
import { DEFAULT_LOOP_PATTERN } from '../../config/beat-motion.config.js';

describe('BeatRunCoordinator Unit Tests (Issue #283 / UX-ANSWER-TIMEOUT-001)', () => {
  let battle: BattleState;

  beforeEach(() => {
    battle = new BattleState();
  });

  describe('1. 2박 답안 선택 시간 및 readyBeats 규격 (Issue #287)', () => {
    it('기본 BeatRunCoordinator 생성 시 readyBeats가 4박이고, DEFAULT_LOOP_PATTERN.readyBeats와 일치한다', () => {
      const coordinator = new BeatRunCoordinator({ battle });
      expect(coordinator.readyBeats).toBe(4);
      expect(DEFAULT_LOOP_PATTERN.readyBeats).toBe(4);
    });

    it('8박 러닝 완료 후 ANSWER_SELECT 페이즈로 진입 시 2박(1.0초 @ BPM 120) 동안 입력창이 유지된다', () => {
      const coordinator = new BeatRunCoordinator({
        battle,
        routineMode: 'arm_reach',
      });
      coordinator.startRound();
      expect(coordinator.phase).toBe('RUN_QUESTION');

      // 8박 운동 스텝 완료 (각 슬롯 0.5s)
      for (let i = 0; i < 8; i++) {
        coordinator.update(0.1);
        coordinator.recordStep('run');
        coordinator.update(0.4);
      }
      expect(coordinator.phase).toBe('ANSWER_SELECT');
      expect(coordinator.isAnswerOpen).toBe(true);

      // 1.9박(0.95초) 경과 시점: 여전히 열려 있음
      coordinator.update(0.95);
      expect(coordinator.phase).toBe('ANSWER_SELECT');
      expect(coordinator.isAnswerOpen).toBe(true);
      expect(coordinator.isTimedOut).toBe(false);
    });
  });

  describe('2. 타임아웃 감지, isTimedOut 플래그 및 onTimeout 콜백 연동', () => {
    it('2박(1.0초) 초과 시 onTimeout 콜백이 1회 호출되고 isTimedOut이 true가 되며 HAZARD_EVADE로 전이된다', () => {
      const onTimeout = vi.fn();
      const onPhaseChange = vi.fn();
      const coordinator = new BeatRunCoordinator({
        battle,
        routineMode: 'arm_reach',
        onTimeout,
        onPhaseChange,
      });

      coordinator.startRound();
      for (let i = 0; i < 8; i++) {
        coordinator.update(0.1);
        coordinator.recordStep('run');
        coordinator.update(0.4);
      }
      expect(coordinator.phase).toBe('ANSWER_SELECT');
      expect(coordinator.isTimedOut).toBe(false);

      // 2박(1.0초) 만료 시점 업데이트
      coordinator.update(1.0);

      expect(onTimeout).toHaveBeenCalledTimes(1);
      expect(coordinator.isTimedOut).toBe(true);
      expect(coordinator.phase).toBe('HAZARD_EVADE');
      expect(coordinator.isAnswerOpen).toBe(false);
      expect(onPhaseChange).toHaveBeenCalledWith('HAZARD_EVADE');
    });

    it('키보드/터치 fallbackAdvance로 ANSWER_SELECT 스킵 시에도 onTimeout이 호출되고 isTimedOut이 기록된다', () => {
      const onTimeout = vi.fn();
      const coordinator = new BeatRunCoordinator({
        battle,
        routineMode: 'arm_reach',
        onTimeout,
      });

      coordinator.startRound();
      for (let i = 0; i < 8; i++) {
        coordinator.update(0.1);
        coordinator.recordStep('run');
        coordinator.update(0.4);
      }
      expect(coordinator.phase).toBe('ANSWER_SELECT');

      coordinator.triggerFallbackAdvance();

      expect(onTimeout).toHaveBeenCalledTimes(1);
      expect(coordinator.isTimedOut).toBe(true);
      expect(coordinator.phase).toBe('HAZARD_EVADE');
    });

    it('답안을 정상 선택한 경우 onTimeout은 호출되지 않고 isTimedOut은 false를 유지한다', () => {
      const onTimeout = vi.fn();
      const coordinator = new BeatRunCoordinator({
        battle,
        routineMode: 'arm_reach',
        onTimeout,
      });

      coordinator.startRound();
      for (let i = 0; i < 8; i++) {
        coordinator.update(0.1);
        coordinator.recordStep('run');
        coordinator.update(0.4);
      }
      expect(coordinator.phase).toBe('ANSWER_SELECT');

      // 정답 선택
      const correctIdx = coordinator.currentQuestion?.correctIndex ?? 0;
      coordinator.confirmAnswerByFallback(correctIdx);

      expect(coordinator.phase).toBe('STAR_COLLECT');
      expect(onTimeout).not.toHaveBeenCalled();
      expect(coordinator.isTimedOut).toBe(false);
    });

    it('다음 라운드가 시작되면 isTimedOut 플래그가 false로 리셋된다', () => {
      const coordinator = new BeatRunCoordinator({
        battle,
        routineMode: 'arm_reach',
      });

      coordinator.startRound();
      for (let i = 0; i < 8; i++) {
        coordinator.update(0.1);
        coordinator.recordStep('run');
        coordinator.update(0.4);
      }
      // 2박 타임아웃
      coordinator.update(1.0);
      expect(coordinator.isTimedOut).toBe(true);

      // 새 라운드 시작
      coordinator.startRound();
      expect(coordinator.isTimedOut).toBe(false);
      expect(coordinator.phase).toBe('RUN_QUESTION');
    });
  });
});
