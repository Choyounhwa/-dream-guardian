import { describe, it, expect } from 'vitest';
import { StateMachine } from '../../src/core/StateMachine.js';
import { GameSessionContext } from '../../src/core/GameSessionContext.js';
import type { GameState } from '../../src/types/index.js';

/**
 * BOSS-ASSAULT-21 / Issue #523
 * 모드 고정 및 상태 전환 계약 연결 단위 테스트
 *
 * 검증 항목:
 * 1. legacy 기존 전환표 및 기본 mode 동일 동작 유지 (A01, A02)
 * 2. 신규 상태(ASSAULT_ROUND) 허용 전환 연결 (READY_POSITION -> ASSAULT_ROUND -> RESULT | GAMEOVER | MENU_MAIN)
 * 3. 비허용 전환 및 상충/동일 상태 전이 거부
 * 4. GameSessionContext 모드 고정(lockMode), 불변성, 세션 중 모드 임의 교체 거부 (A16)
 * 5. 세션 종료 후 새 모드 시작 허용
 * 6. 혼합 상태(Mixed State) 진입 거부
 * 7. 이전 세션 전환 거부 및 현재 세션 보존 (A16)
 */
describe('BOSS-ASSAULT-21: 모드 고정 및 상태 전환 계약 연결 (#523)', () => {
  describe('1. StateMachine 신규 전이 및 Legacy 보존 (A01, A02)', () => {
    it('READY_POSITION -> ASSAULT_ROUND 전이가 허용된다', () => {
      const sm = new StateMachine('READY_POSITION');
      expect(sm.canTransition('ASSAULT_ROUND')).toBe(true);
      expect(sm.changeState('ASSAULT_ROUND')).toBe(true);
      expect(sm.currentState).toBe('ASSAULT_ROUND');
    });

    it('ASSAULT_ROUND -> RESULT, GAMEOVER, MENU_MAIN 전이가 허용된다', () => {
      // ASSAULT_ROUND -> RESULT
      const smResult = new StateMachine('ASSAULT_ROUND');
      expect(smResult.canTransition('RESULT')).toBe(true);
      expect(smResult.changeState('RESULT')).toBe(true);
      expect(smResult.currentState).toBe('RESULT');

      // ASSAULT_ROUND -> GAMEOVER
      const smGameOver = new StateMachine('ASSAULT_ROUND');
      expect(smGameOver.canTransition('GAMEOVER')).toBe(true);
      expect(smGameOver.changeState('GAMEOVER')).toBe(true);
      expect(smGameOver.currentState).toBe('GAMEOVER');

      // ASSAULT_ROUND -> MENU_MAIN
      const smMenu = new StateMachine('ASSAULT_ROUND');
      expect(smMenu.canTransition('MENU_MAIN')).toBe(true);
      expect(smMenu.changeState('MENU_MAIN')).toBe(true);
      expect(smMenu.currentState).toBe('MENU_MAIN');
    });

    it('ASSAULT_ROUND 진행 중 여부를 질의하는 isAssaultRound() 헬퍼가 정상 동작한다', () => {
      const sm = new StateMachine('READY_POSITION');
      expect(sm.isAssaultRound()).toBe(false);

      sm.changeState('ASSAULT_ROUND');
      expect(sm.isAssaultRound()).toBe(true);

      sm.changeState('RESULT');
      expect(sm.isAssaultRound()).toBe(false);
    });

    it('비허용 상태에서 ASSAULT_ROUND로의 직접 전이는 거부된다', () => {
      const invalidOrigins: GameState[] = [
        'LOADING',
        'MENU_MAIN',
        'MENU_SUB',
        'STORY_INTRO',
        'RUN_QUESTION',
        'ANSWER_SELECT',
        'STAR_COLLECT',
        'HAZARD_EVADE',
        'ROUND_RESOLVE',
        'BOSS_CLIMAX',
        'RESULT',
        'GAMEOVER',
        'ENDING_CUTSCENE',
      ];

      for (const origin of invalidOrigins) {
        const sm = new StateMachine(origin);
        expect(sm.canTransition('ASSAULT_ROUND')).toBe(false);
        expect(sm.changeState('ASSAULT_ROUND')).toBe(false);
        expect(sm.currentState).toBe(origin);
      }
    });

    it('ASSAULT_ROUND에서 비허용 상태로의 전이는 거부된다', () => {
      const invalidDestinations: GameState[] = [
        'LOADING',
        'MENU_SUB',
        'STORY_INTRO',
        'READY_POSITION',
        'RUN_QUESTION',
        'ANSWER_SELECT',
        'STAR_COLLECT',
        'HAZARD_EVADE',
        'ROUND_RESOLVE',
        'BOSS_CLIMAX',
        'ENDING_CUTSCENE',
      ];

      for (const dest of invalidDestinations) {
        const sm = new StateMachine('ASSAULT_ROUND');
        expect(sm.canTransition(dest)).toBe(false);
        expect(sm.changeState(dest)).toBe(false);
        expect(sm.currentState).toBe('ASSAULT_ROUND');
      }
    });

    it('동일 상태 재요청(ASSAULT_ROUND -> ASSAULT_ROUND)은 거부된다', () => {
      const sm = new StateMachine('ASSAULT_ROUND');
      expect(sm.canTransition('ASSAULT_ROUND')).toBe(false);
      expect(sm.changeState('ASSAULT_ROUND')).toBe(false);
      expect(sm.currentState).toBe('ASSAULT_ROUND');
    });

    it('Legacy 14개 상태 전환표가 100% 동일하게 보존된다', () => {
      // READY_POSITION -> RUN_QUESTION (Legacy 필수 경로)
      const smReady = new StateMachine('READY_POSITION');
      expect(smReady.canTransition('RUN_QUESTION')).toBe(true);
      expect(smReady.changeState('RUN_QUESTION')).toBe(true);

      // RUN_QUESTION -> ANSWER_SELECT -> STAR_COLLECT -> ROUND_RESOLVE -> BOSS_CLIMAX -> RESULT
      const smLoop = new StateMachine('RUN_QUESTION');
      expect(smLoop.changeState('ANSWER_SELECT')).toBe(true);
      expect(smLoop.changeState('STAR_COLLECT')).toBe(true);
      expect(smLoop.changeState('ROUND_RESOLVE')).toBe(true);
      expect(smLoop.changeState('BOSS_CLIMAX')).toBe(true);
      expect(smLoop.changeState('RESULT')).toBe(true);
    });
  });

  describe('2. GameSessionContext 모드 고정 및 불변성 (A16)', () => {
    it('기본 모드는 legacy이다 (옵션 생략 시)', () => {
      const ctx = new GameSessionContext();
      expect(ctx.mode).toBe('legacy');
      expect(ctx.sessionMode).toBe('legacy');
      expect(ctx.isModeLocked).toBe(false);
    });

    it('생성자 옵션으로 모드를 명시하여 초기화할 수 있다', () => {
      const ctx = new GameSessionContext({ sessionMode: 'boss_assault' } as any);
      expect(ctx.mode).toBe('boss_assault');
      expect(ctx.sessionMode).toBe('boss_assault');
    });

    it('lockMode() 호출 시 모드가 잠기며, 다른 모드로의 변경이 거부된다', () => {
      const ctx = new GameSessionContext();
      expect(ctx.mode).toBe('legacy');

      ctx.lockMode();
      expect(ctx.isModeLocked).toBe(true);

      // 이미 잠긴 상태에서 다른 모드 설정 시도 시 false 반환 또는 거부
      expect(ctx.setMode('boss_assault')).toBe(false);
      expect(ctx.mode).toBe('legacy');

      // 동일 모드로 lockMode 재호출은 허용(idempotent)
      expect(() => ctx.lockMode('legacy')).not.toThrow();

      // 잠긴 상태에서 다른 모드로 lockMode 재호출 시 예외 발생
      expect(() => ctx.lockMode('boss_assault')).toThrow();
    });

    it('세션 시작(startChapter 등) 시 모드가 고정(lock)되고 진행 중 모드 변경이 거부된다', () => {
      const ctx = new GameSessionContext();
      ctx.startChapter(1, undefined, { mode: 'boss_assault' } as any);

      expect(ctx.isActive).toBe(true);
      expect(ctx.mode).toBe('boss_assault');
      expect(ctx.isModeLocked).toBe(true);

      // 진행 중 임의 모드 교체 시도 거부 및 현재 세션 모드 보존
      const changeResult = ctx.setMode('legacy');
      expect(changeResult).toBe(false);
      expect(ctx.mode).toBe('boss_assault');
    });

    it('세션 종료(resetSession) 후에는 새로운 모드로 새 세션을 시작할 수 있다', () => {
      const ctx = new GameSessionContext();
      ctx.startChapter(1, undefined, { mode: 'boss_assault' } as any);
      expect(ctx.mode).toBe('boss_assault');

      // 세션 리셋
      ctx.resetSession();
      expect(ctx.isActive).toBe(false);
      expect(ctx.isModeLocked).toBe(false);

      // 새 세션에서 legacy 모드로 정상 시작 가능
      ctx.startChapter(2, undefined, { mode: 'legacy' } as any);
      expect(ctx.mode).toBe('legacy');
      expect(ctx.isModeLocked).toBe(true);
    });
  });

  describe('3. 모드별 혼합 상태(Mixed State) 진입 거부', () => {
    it('legacy 모드에서는 신규 상태 ASSAULT_ROUND 진입이 거부된다', () => {
      const sm = new StateMachine('READY_POSITION');
      const ctx = new GameSessionContext({
        systems: { stateMachine: sm },
        sessionMode: 'legacy',
      } as any);

      expect(ctx.isValidStateForMode('ASSAULT_ROUND')).toBe(false);
      expect(ctx.isValidStateForMode('RUN_QUESTION')).toBe(true);

      // 전환 요청 거부
      const transitionResult = ctx.requestStateTransition('ASSAULT_ROUND');
      expect(transitionResult).toBe(false);
      expect(sm.currentState).toBe('READY_POSITION'); // 원래 상태 유지
    });

    it('boss_assault 모드에서는 레거시 전용 인게임 상태(Phase A, Phase B) 진입이 거부된다', () => {
      const sm = new StateMachine('READY_POSITION');
      const ctx = new GameSessionContext({
        systems: { stateMachine: sm },
        sessionMode: 'boss_assault',
      } as any);

      expect(ctx.isValidStateForMode('RUN_QUESTION')).toBe(false);
      expect(ctx.isValidStateForMode('ANSWER_SELECT')).toBe(false);
      expect(ctx.isValidStateForMode('STAR_COLLECT')).toBe(false);
      expect(ctx.isValidStateForMode('HAZARD_EVADE')).toBe(false);
      expect(ctx.isValidStateForMode('ROUND_RESOLVE')).toBe(false);
      expect(ctx.isValidStateForMode('BOSS_CLIMAX')).toBe(false);

      expect(ctx.isValidStateForMode('ASSAULT_ROUND')).toBe(true);

      // 레거시 전용 상태로의 전환 시도 거부
      expect(ctx.requestStateTransition('RUN_QUESTION')).toBe(false);
      expect(sm.currentState).toBe('READY_POSITION'); // 원래 상태 유지

      // ASSAULT_ROUND로의 전환은 정상 통과
      expect(ctx.requestStateTransition('ASSAULT_ROUND')).toBe(true);
      expect(sm.currentState).toBe('ASSAULT_ROUND');
    });
  });

  describe('4. 이전 세션 전환 거부 및 현재 세션 보존 (A16)', () => {
    it('현재 세션 ID와 일치하지 않는 이전 세션의 전환 요청은 거부되고 현재 상태가 보존된다', () => {
      const sm = new StateMachine('READY_POSITION');
      const ctx = new GameSessionContext({
        systems: { stateMachine: sm },
        sessionMode: 'boss_assault',
      } as any);

      ctx.startChapter(1, undefined, { mode: 'boss_assault' } as any);
      const currentSessionId = ctx.sessionId;

      // 이전 세션(currentSessionId - 1)에서 온 비동기 전환 요청
      const staleSessionId = currentSessionId - 1;
      const result = ctx.requestStateTransition('ASSAULT_ROUND', staleSessionId);

      expect(result).toBe(false);
      expect(sm.currentState).toBe('READY_POSITION'); // 현재 세션 상태 보존

      // 유효한 현재 세션 ID의 전환 요청은 통과
      const validResult = ctx.requestStateTransition('ASSAULT_ROUND', currentSessionId);
      expect(validResult).toBe(true);
      expect(sm.currentState).toBe('ASSAULT_ROUND');
    });
  });
});
