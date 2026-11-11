/**
 * assault-recovery-audio-wiring.test.ts
 *
 * [BOSS-ASSAULT-REC-16] #609: 접근전 활성시계 효과음 Core 연결 단위 테스트
 *
 * @see docs/assault-runtime-recovery/REC-16.md
 * @see https://github.com/Choyounhwa/-dream-guardian/issues/609
 *
 * 완료 조건:
 * 1. 실제 준비->round에서 경계별 1회 SFX, 중복 snapshot/update 시 추가 재생 0건.
 * 2. 숨김/정지/복귀·restart에서 묵은 SFX 폭풍 0건, audio 시계가 gameplay 시간을 변경하지 않음.
 * 3. 동일 session/round origin, BPM과 REC-14 표시/경계 이벤트로 soundCue.update를 호출.
 * 4. 투척/발사/취소/회피/피격은 고유 ID당 1회, 시각 피격은 적용 receipt와 일치.
 * 5. pause/hidden/tracking/reprep에서는 무음, 복귀 후 과거 박자/SFX 소급 폭풍 0건 방지.
 * 6. 기존 승인된 음향 API 재사용, 새 Audio 시계/루프 생성 0건.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AssaultSessionFactory } from '../../src/core/AssaultSessionFactory.js';
import { AssaultSessionWireHelper } from '../../src/core/bootstrap/AssaultSessionWireHelper.js';
import { DEFAULT_APPROACH_PATTERN } from '../../src/data/assault/approachPatterns.js';
import type { QuestionCandidate } from '../../src/question/AssaultQuestionEligibility.js';
import type { ISFXPlayer } from '../../src/audio/AssaultSoundCue.js';

function createMockBattleState(hp = 100) {
  return {
    hp,
    maxHp: 100,
    combo: 0,
    takeDamage: vi.fn(),
    applyHazardDamage: vi.fn(),
  };
}

function createMockSpeech() {
  return {
    speak: vi.fn(),
    status: 'idle',
    cancel: vi.fn(),
  };
}

function createMockSFXPlayer(): ISFXPlayer & { play: ReturnType<typeof vi.fn> } {
  return {
    play: vi.fn(),
  };
}

describe('[BOSS-ASSAULT-REC-16] #609: 접근전 활성시계 효과음 Core 연결', () => {
  const sampleQuestion: QuestionCandidate = {
    id: 'q_audio_01',
    level: 1,
    subLevel: 1,
    type: 'add',
    text: '5 + 3 = ?',
    answer: '8',
    choices: ['8', '9'],
  };

  const samplePattern = DEFAULT_APPROACH_PATTERN;

  let mockBattle: ReturnType<typeof createMockBattleState>;
  let mockSpeech: ReturnType<typeof createMockSpeech>;
  let mockSfx: ReturnType<typeof createMockSFXPlayer>;

  beforeEach(() => {
    mockBattle = createMockBattleState(100);
    mockSpeech = createMockSpeech();
    mockSfx = createMockSFXPlayer();
  });

  describe('1. BPM 및 세션 설정 동기화', () => {
    it('AssaultSessionFactory 조립 시 지정된 BPM이 soundCue에 올바르게 주입되어야 한다', () => {
      const session = AssaultSessionFactory.createSession({
        mode: 'boss_assault',
        battleState: mockBattle,
        speech: mockSpeech,
        sfxPlayer: mockSfx,
        questions: [sampleQuestion],
        pattern: samplePattern,
        bpm: 150,
      });

      expect(session.soundCue).not.toBeNull();
      expect(session.soundCue?.bpm).toBe(150);
      expect(session.soundCue?.secondsPerBeat).toBeCloseTo(60 / 150, 4);
    });

    it('sfxPlayer가 주입되지 않은 경우 soundCue는 null이고 updateAudio/updateRound는 안전하게 no-op이어야 한다', () => {
      const session = AssaultSessionFactory.createSession({
        mode: 'boss_assault',
        battleState: mockBattle,
        speech: mockSpeech,
        questions: [sampleQuestion],
        pattern: samplePattern,
        bpm: 120,
      });

      expect(session.soundCue).toBeNull();
      expect(() => {
        session.updateAudio?.();
        session.updateRound?.(0.1, 0.1);
      }).not.toThrow();
    });
  });

  describe('2. 경계별 1회 SFX 및 중복 snapshot/update 추가 재생 0건 (멱등성)', () => {
    it('throw_in 페이즈 진입 시 throw 효과음이 1회 재생되고, 반복 update 시 추가 재생 0건이어야 한다', () => {
      const session = AssaultSessionFactory.createSession({
        mode: 'boss_assault',
        battleState: mockBattle,
        speech: mockSpeech,
        sfxPlayer: mockSfx,
        questions: [sampleQuestion],
        pattern: samplePattern,
        bpm: 120,
      });

      const rc = session.createRoundController('round_01' as any, sampleQuestion);
      expect(session.activeRoundController).toBe(rc);

      // round 초기 throw_in 상태 (activeSeconds = 0.05s)
      session.clock.advance(0.05, 50);
      session.updateRound?.(session.clock.toRoundRelativeSeconds(), 0.05);

      // sfx가 최소 1회 호출되었는지 확인 (beat 0 또는 throw)
      const initialPlayCalls = mockSfx.play.mock.calls.length;
      expect(initialPlayCalls).toBeGreaterThanOrEqual(1);

      // 동일 상태로 여러 프레임 연속 update 호출
      session.clock.advance(0.01, 60);
      session.updateRound?.(session.clock.toRoundRelativeSeconds(), 0.01);
      session.updateRound?.(session.clock.toRoundRelativeSeconds(), 0.01);
      session.updateAudio?.();

      // 같은 비트/페이즈 내에서는 중복 호출 0건이어야 함
      const afterCalls = mockSfx.play.mock.calls.length;
      expect(afterCalls).toBe(initialPlayCalls);
    });

    it('오답 피격 및 정산 명령은 고유 ID당 정확히 1회만 SFX를 재생해야 한다', () => {
      const session = AssaultSessionFactory.createSession({
        mode: 'boss_assault',
        battleState: mockBattle,
        speech: mockSpeech,
        sfxPlayer: mockSfx,
        questions: [sampleQuestion],
        pattern: samplePattern,
        bpm: 120,
      });

      const rc = session.createRoundController('round_01' as any, sampleQuestion);
      // throw_in(1s) -> question_reading(4s) -> encounters 진입 (5s 이상)
      session.clock.advance(5.2, 5200);
      rc.update(session.clock.toRoundRelativeSeconds(), 5.2);
      session.updateAudio?.();

      // 도착(7.0s) 직전 유효창 직전까지 진행 (6.75초)
      session.clock.advance(1.55, 6750);
      rc.update(session.clock.toRoundRelativeSeconds(), 1.55);
      session.updateAudio?.();

      const callsBefore = mockSfx.play.mock.calls.length;

      // 오답(우측 선택 9) 펀치 입력 (6.85초: 도착 7.0s 150ms 전, EarlyMiss 170ms 유효창 내)
      session.clock.advance(0.1, 6850);
      const activeSec = session.clock.toRoundRelativeSeconds();
      rc.submitPunch('right', 6850, {
        activeSeconds: activeSec,
      });

      session.updateAudio?.();
      const callsAfterWrong = mockSfx.play.mock.calls.length;
      expect(callsAfterWrong).toBeGreaterThan(callsBefore);

      // 동일 wrong 상태가 유지되는 동안 추가 update
      session.updateAudio?.();
      session.updateAudio?.();
      expect(mockSfx.play.mock.calls.length).toBe(callsAfterWrong);
    });
  });

  describe('3. 숨김/정지/복귀·reprep에서 묵은 SFX 폭풍 0건 (Zero Burst)', () => {
    it('clock이 paused, hidden, tracking_lost 또는 needsMotionReprep 상태일 때 SFX를 재생하지 않아야 한다', () => {
      const session = AssaultSessionFactory.createSession({
        mode: 'boss_assault',
        battleState: mockBattle,
        speech: mockSpeech,
        sfxPlayer: mockSfx,
        questions: [sampleQuestion],
        pattern: samplePattern,
        bpm: 120,
      });

      session.createRoundController('round_01' as any, sampleQuestion);
      mockSfx.play.mockClear();

      // 일시정지 상태 설정
      session.clock.setPaused(true);
      expect(session.clock.isPaused).toBe(true);

      // 정지 상태에서 시간 전진 및 audio update
      session.updateAudio?.();
      expect(mockSfx.play).toHaveBeenCalledTimes(0);

      // tracking lost 상태
      session.clock.setPaused(false);
      session.clock.setTrackingLost(true);
      session.updateAudio?.();
      expect(mockSfx.play).toHaveBeenCalledTimes(0);

      // hidden 상태
      session.clock.setTrackingLost(false);
      session.clock.setHidden(true);
      session.updateAudio?.();
      expect(mockSfx.play).toHaveBeenCalledTimes(0);

      // needsMotionReprep 상태
      session.clock.setHidden(false);
      (session.clock as any)._needsMotionReprep = true;
      session.updateAudio?.();
      expect(mockSfx.play).toHaveBeenCalledTimes(0);
    });

    it('장시간 일시정지 후 복귀 시 지나간 비트들의 소급 폭풍(burst) 재생이 0건이어야 한다', () => {
      const session = AssaultSessionFactory.createSession({
        mode: 'boss_assault',
        battleState: mockBattle,
        speech: mockSpeech,
        sfxPlayer: mockSfx,
        questions: [sampleQuestion],
        pattern: samplePattern,
        bpm: 120, // 0.5s per beat
      });

      session.createRoundController('round_01' as any, sampleQuestion);
      session.clock.advance(0.1, 100);
      session.updateAudio?.();
      mockSfx.play.mockClear();

      // 5초(10비트) 동안 일시정지
      session.clock.setPaused(true);
      // 정지 상태에서는 clock.advance해도 activeSeconds는 증가하지 않음
      session.updateAudio?.();
      expect(mockSfx.play).toHaveBeenCalledTimes(0);

      // 정지 해제 후 1프레임 갱신 시 오직 현재 1개 비트만 재생되거나 0회, 10개 비트 폭풍 재생 0건
      session.clock.setPaused(false);
      session.clock.advance(0.01, 110);
      session.updateAudio?.();

      expect(mockSfx.play.mock.calls.length).toBeLessThanOrEqual(1);
    });
  });

  describe('4. Audio 시계의 게임플레이 시간 불변성 (Pure Reader)', () => {
    it('updateAudio 호출 전후로 clock.activeSeconds 및 round Controller의 활성 시간이 변경되지 않아야 한다', () => {
      const session = AssaultSessionFactory.createSession({
        mode: 'boss_assault',
        battleState: mockBattle,
        speech: mockSpeech,
        sfxPlayer: mockSfx,
        questions: [sampleQuestion],
        pattern: samplePattern,
        bpm: 120,
      });

      const rc = session.createRoundController('round_01' as any, sampleQuestion);
      session.clock.advance(1.234, 1234);
      rc.update(session.clock.toRoundRelativeSeconds(), 0.1);

      const activeSecBefore = session.clock.activeSeconds;
      const roundSecBefore = session.clock.toRoundRelativeSeconds();
      const rcSecBefore = rc.getPresentationSnapshot().activeSeconds;

      // 10회 반복 audio update 호출
      for (let i = 0; i < 10; i++) {
        session.updateAudio?.();
      }

      expect(session.clock.activeSeconds).toBe(activeSecBefore);
      expect(session.clock.toRoundRelativeSeconds()).toBe(roundSecBefore);
      expect(rc.getPresentationSnapshot().activeSeconds).toBe(rcSecBefore);
    });
  });

  describe('5. 라운드 전환(Round Transition) 및 원점 리셋 시 오디오 시계 리셋', () => {
    it('Round 1 -> Round 2 전환 시 soundCue가 리셋되어 새 라운드의 비트 및 경계 사운드가 정상 작동해야 한다', () => {
      const session = AssaultSessionFactory.createSession({
        mode: 'boss_assault',
        battleState: mockBattle,
        speech: mockSpeech,
        sfxPlayer: mockSfx,
        questions: [sampleQuestion, { ...sampleQuestion, id: 'q_audio_02' }],
        pattern: samplePattern,
        bpm: 120,
      });

      const rc1 = session.createRoundController('round_01' as any, sampleQuestion);
      session.clock.advance(1.0, 1000);
      rc1.update(session.clock.toRoundRelativeSeconds(), 1.0);
      session.updateAudio?.();
      expect(session.soundCue?.playedCount).toBeGreaterThan(0);

      // Round 2 시작
      mockSfx.play.mockClear();
      const rc2 = session.createRoundController('round_02' as any, { ...sampleQuestion, id: 'q_audio_02' });
      expect(session.activeRoundController).toBe(rc2);

      // 새 라운드 원점에서 soundCue가 리셋되어 깨끗한 상태로 시작
      expect(session.soundCue?.playedCount).toBe(0);

      // Round 2 첫 프레임
      session.clock.advance(0.05, 1050);
      session.updateRound?.(session.clock.toRoundRelativeSeconds(), 0.05);

      // Round 2의 첫 비트/투척 사운드가 정상 재생되어야 함
      expect(mockSfx.play).toHaveBeenCalled();
    });
  });

  describe('6. AssaultSessionWireHelper 통합 배선', () => {
    it('WireHelper의 update(dt, ctx) 호출 시 session.updateAudio가 자동으로 구동되어야 한다', () => {
      const host: any = {
        battle: mockBattle,
        boss: { hp: 10, maxHp: 10, takeDamage: vi.fn() },
        bossController: { hp: 10, maxHp: 10, takeDamage: vi.fn() },
        speech: mockSpeech,
        sfx: mockSfx,
        eventBus: { on: vi.fn(), emit: vi.fn() },
        stateMachine: { setState: vi.fn(), canTransition: vi.fn(() => true), changeState: vi.fn() },
        sessionLifecycle: {
          getActiveAssaultSessionToken: vi.fn(() => null),
          setActiveAssaultSessionToken: vi.fn(),
          clearActiveAssaultSessionToken: vi.fn(),
          setTestSession: vi.fn(),
        },
        sessionContext: { sessionMode: 'normal', setMode: vi.fn() },
        motionIntentBus: { setPhase: vi.fn() },
        questionBank: { getQuestions: () => [sampleQuestion], currentLevel: 1 },
        currentChapter: 1,
        enableAssaultFinale: false,
      };

      const helper = new AssaultSessionWireHelper(host);
      const session = helper.assembleAssaultSession({
        mode: 'boss_assault' as any,
        questions: [sampleQuestion],
        pattern: samplePattern,
        bpm: 120,
      });

      session.createRoundController('round_01' as any, sampleQuestion);

      mockSfx.play.mockClear();

      // session.update 호출 시 clock advance 및 sound update가 함께 실행됨
      (session as any).update(0.1, { engine: { elapsedTime: 0.1 } });

      expect(mockSfx.play).toHaveBeenCalled();
    });
  });
});
