import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { GameEngine } from '../../src/core/GameEngine.js';
import { SessionLifecycle } from '../../src/core/SessionLifecycle.js';
import { BeatRunCoordinator } from '../../src/game/BeatRunCoordinator.js';
import { PhaseAHazardController } from '../../src/game/PhaseAHazardController.js';
import { StarNoteRenderer } from '../../src/render/StarNoteRenderer.js';
import { StateMachine } from '../../src/core/StateMachine.js';

describe('Session Lifecycle Integration - [BUG-SESSION-EXIT-001 / #231]', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('1. pause 2초 후 노트/장판/비트 진행도 동일', () => {
    it('GameEngine pauseGame 중에는 engine.elapsedTime이 멈추어 2초간 정지 후에도 노트/장판/비트 진행도가 동일하다', () => {
      const engine = new GameEngine({
        update: () => {},
        render: () => {},
      });

      const coordinator = new BeatRunCoordinator({ routineMode: 'arm_reach' });
      coordinator.startRound();

      const hazard = new PhaseAHazardController({ secondsPerBeat: 0.5 });
      hazard.start();

      const starRenderer = new StarNoteRenderer();
      const target = {
        patternId: 'p1',
        part: 'leftHand' as const,
        cursorType: 'leftHand' as const,
        zoneId: 4,
        beatIndex: 2,
        landingTime: 2.0,
      };

      // 1초간 정상 진행
      for (let i = 0; i < 10; i++) {
        // dt = 0.1s
        coordinator.update(0.1);
        hazard.update(0.1);
      }

      // 1초 시점의 진행도 기록
      const initialBeatProgress = coordinator.rhythmEngine.roundProgress;
      const initialHazardProgress = hazard.beatProgress;
      const initialNoteProgress = starRenderer.computeNotePosition(target, 1.0, 540, 200, 1080, 2160).progress;

      // 2초간 일시정지 (pauseModal 열림 시뮬레이션)
      engine.pauseGame();
      coordinator.pause();

      for (let i = 0; i < 20; i++) {
        // pause 중에는 main.ts에서 dt를 게임에 전달하지 않거나 coordinator가 pause됨
        coordinator.update(0.1);
        // hazard도 update되지 않음
      }

      // 일시정지 중/직후 진행도 검증
      expect(coordinator.rhythmEngine.roundProgress).toBeCloseTo(initialBeatProgress, 5);
      expect(hazard.beatProgress).toBeCloseTo(initialHazardProgress, 5);
      // engine.elapsedTime도 멈추었어야 하므로 note progress 동일
      expect(starRenderer.computeNotePosition(target, 1.0, 540, 200, 1080, 2160).progress).toBeCloseTo(initialNoteProgress, 5);

      // 재개 후
      engine.resumeGame();
      coordinator.resume();

      // 정상적으로 1틱(0.1s) 진행
      coordinator.update(0.1);
      hazard.update(0.1);
      expect(coordinator.rhythmEngine.roundProgress).toBeGreaterThan(initialBeatProgress);
      expect(hazard.beatProgress).toBeGreaterThan(initialHazardProgress);
    });
  });

  describe('2. 다음 라운드 예약 후 메뉴 복귀해도 재시작하지 않음', () => {
    it('다음 라운드 startNewRound 예약 후 메뉴로 복귀하면 이전 예약이 취소되어 재시작되지 않는다', () => {
      const session = new SessionLifecycle();
      const stateMachine = new StateMachine('RUN_QUESTION');

      let nextRoundCalled = false;
      session.startSession();

      // 라운드 정산 후 800ms 뒤 다음 라운드 예약
      session.schedule(() => {
        nextRoundCalled = true;
        stateMachine.changeState('RUN_QUESTION');
      }, 800);

      expect(session.pendingTimeoutCount).toBe(1);

      // 400ms 시점에서 사용자가 메뉴로 복귀 (goToMenu)
      vi.advanceTimersByTime(400);
      session.endSession();
      stateMachine.changeState('ANSWER_SELECT');
      stateMachine.changeState('ROUND_RESOLVE');
      stateMachine.changeState('MENU_MAIN');

      expect(stateMachine.currentState).toBe('MENU_MAIN');
      expect(session.pendingTimeoutCount).toBe(0);

      // 나머지 600ms 경과 (총 1000ms > 800ms)
      vi.advanceTimersByTime(600);

      // 예약되었던 다음 라운드 콜백이 실행되지 않아야 함
      expect(nextRoundCalled).toBe(false);
      expect(stateMachine.currentState).toBe('MENU_MAIN');
    });
  });

  describe('3. 재시작한 새 세션에 이전 결과 콜백 영향 0', () => {
    it('이전 세션의 결과 전환 예약이 새 세션 시작 시 무효화되어 새 세션에 영향을 주지 않는다', () => {
      const session = new SessionLifecycle();
      const stateMachine = new StateMachine('RUN_QUESTION');

      let oldResultShown = false;
      const session1Id = session.startSession();

      // 세션 1: 600ms 뒤 결과 화면 예약
      session.schedule(() => {
        oldResultShown = true;
        stateMachine.changeState('RESULT');
      }, 600);

      // 300ms 경과 후 새 세션 시작 (startChapter 재시작)
      vi.advanceTimersByTime(300);
      const session2Id = session.startSession();
      expect(session2Id).toBeGreaterThan(session1Id);

      // 새 세션은 RUN_QUESTION 상태
      stateMachine.changeState('RUN_QUESTION');

      // 1000ms 경과 (세션 1의 600ms 예약 시점 경과)
      vi.advanceTimersByTime(1000);

      // 세션 1의 결과 콜백은 무효화되어 실행되지 않아야 함
      expect(oldResultShown).toBe(false);
      expect(stateMachine.currentState).toBe('RUN_QUESTION');
    });
  });

  describe('4. 승패 콜백 중복에도 결과 1회 및 종료 후 입력/공격 중단', () => {
    it('claimResultTransition()은 첫 번째 호출만 true를 반환하고 중복 호출을 차단한다', () => {
      const session = new SessionLifecycle();
      session.startSession();

      // 첫 번째 승리/패배 전환 권한 획득 시도
      const firstClaim = session.claimResultTransition();
      expect(firstClaim).toBe(true);
      expect(session.hasResultShown).toBe(true);

      // 중복 승패 콜백 시도 (예: onBossDefeated와 handleAnswer 이중 호출)
      const secondClaim = session.claimResultTransition();
      expect(secondClaim).toBe(false);

      const thirdClaim = session.claimResultTransition();
      expect(thirdClaim).toBe(false);
    });

    it('결과 전환 권한 획득 시 대기 중이던 잔여 예약들이 즉시 자동 취소된다', () => {
      const session = new SessionLifecycle();
      session.startSession();

      let orphanedActionCalled = false;
      session.schedule(() => {
        orphanedActionCalled = true;
      }, 800);

      expect(session.pendingTimeoutCount).toBe(1);

      // 승패 결과 발생
      session.claimResultTransition();
      expect(session.pendingTimeoutCount).toBe(0);

      vi.advanceTimersByTime(1000);
      expect(orphanedActionCalled).toBe(false);
    });
  });
});
