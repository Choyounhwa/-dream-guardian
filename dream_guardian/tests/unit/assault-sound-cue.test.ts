import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  AssaultSoundCue,
  type AssaultBoundaryEvent,
} from '../../src/audio/AssaultSoundCue.js';
import type {
  AssaultSettlementCommand,
  AssaultRoundPresentation,
  AssaultPresentationDTO,
} from '../../src/types/assault.js';

describe('AssaultSoundCue (BOSS-ASSAULT-41 / Issue #544)', () => {
  let mockSfx: { play: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    mockSfx = {
      play: vi.fn(),
    };
  });

  describe('1. 오디오-엔진 시계 동기화 (DEC-B5) 및 박자(Beat) 큐', () => {
    it('AudioContext 시간 대신 전달받은 activeSeconds에 기반하여 메트로놈 박자음을 트리거한다', () => {
      const cue = new AssaultSoundCue({
        sfxPlayer: mockSfx,
        bpm: 120, // 60 / 120 = 0.5s per beat
      });

      // activeSeconds = 0.0 -> beat 0 (강박: metronome_strong)
      cue.update(0.0);
      expect(mockSfx.play).toHaveBeenCalledTimes(1);
      expect(mockSfx.play).toHaveBeenLastCalledWith('metronome_strong');

      // activeSeconds = 0.5 -> beat 1 (약박: metronome_weak)
      cue.update(0.5);
      expect(mockSfx.play).toHaveBeenCalledTimes(2);
      expect(mockSfx.play).toHaveBeenLastCalledWith('metronome_weak');

      // activeSeconds = 1.0 -> beat 2 (약박: metronome_weak)
      cue.update(1.0);
      expect(mockSfx.play).toHaveBeenCalledTimes(3);
      expect(mockSfx.play).toHaveBeenLastCalledWith('metronome_weak');

      // activeSeconds = 1.5 -> beat 3 (약박: metronome_weak)
      cue.update(1.5);
      expect(mockSfx.play).toHaveBeenCalledTimes(4);
      expect(mockSfx.play).toHaveBeenLastCalledWith('metronome_weak');

      // activeSeconds = 2.0 -> beat 4 (마디 첫박/강박: metronome_strong)
      cue.update(2.0);
      expect(mockSfx.play).toHaveBeenCalledTimes(5);
      expect(mockSfx.play).toHaveBeenLastCalledWith('metronome_strong');
    });

    it('동일한 박자 구간 내의 연속 update 호출 시 중복 재생을 차단한다 (멱등성)', () => {
      const cue = new AssaultSoundCue({
        sfxPlayer: mockSfx,
        bpm: 120, // 0.5s per beat
      });

      // beat 0 진입
      cue.update(0.0);
      expect(mockSfx.play).toHaveBeenCalledTimes(1);

      // 같은 beat 0 구간 내 다중 프레임 호출
      cue.update(0.1);
      cue.update(0.2);
      cue.update(0.3);
      cue.update(0.49);
      expect(mockSfx.play).toHaveBeenCalledTimes(1);

      // beat 1 진입 (정확히 1회 추가)
      cue.update(0.5);
      cue.update(0.55);
      cue.update(0.6);
      expect(mockSfx.play).toHaveBeenCalledTimes(2);
      expect(mockSfx.play).toHaveBeenLastCalledWith('metronome_weak');
    });

    it('useBeatTickOnly 옵션 활성화 시 모든 박자에서 beat_tick을 재생한다', () => {
      const cue = new AssaultSoundCue({
        sfxPlayer: mockSfx,
        bpm: 100, // 0.6s per beat
        useBeatTickOnly: true,
      });

      cue.update(0.0);
      expect(mockSfx.play).toHaveBeenCalledWith('beat_tick');

      cue.update(0.6);
      expect(mockSfx.play).toHaveBeenCalledWith('beat_tick');
    });

    it('MVP 권장안(DEC-B5)에 따라 BGM을 시작하지 않고 오직 SFX 효과음 인터페이스만 소비한다', () => {
      const cue = new AssaultSoundCue({
        sfxPlayer: mockSfx,
      });

      cue.update(1.0);
      // BGM 관련 함수 호출 없으며 mockSfx.play 만 호출됨
      expect(mockSfx.play).toHaveBeenCalled();
    });
  });

  describe('2. 경계 이벤트 1회 재생 및 중복 차단 (Throw, Launch, Negate, Evade, Hit, Wrong)', () => {
    it('문제 투척(throw_in) 진입 시 throw 사운드를 정확히 1회 재생하고 중복 update 시 재생하지 않는다', () => {
      const cue = new AssaultSoundCue({
        sfxPlayer: mockSfx,
        enableMetronome: false,
      });

      const snapshot: AssaultRoundPresentation = Object.freeze({
        sessionId: 'session_01',
        roundId: 'round_01',
        phase: 'throw_in',
        questionText: '3 + 4 = ?',
        currentEncounterIndex: 0,
        totalEncounters: 2,
        activeSeconds: 0.1,
        readingProgress: 0.0,
        isPaused: false,
      });

      cue.update(0.1, snapshot);
      expect(mockSfx.play).toHaveBeenCalledTimes(1);
      expect(mockSfx.play).toHaveBeenCalledWith('jump_whoosh');

      // 다음 프레임에서 동일 throw_in 상태 유지 시 중복 재생 0회
      cue.update(0.2, snapshot);
      cue.update(0.3, snapshot);
      expect(mockSfx.play).toHaveBeenCalledTimes(1);
    });

    it('공격 발사(warning/launch) 경계 진입 시 launch 사운드를 정확히 1회 재생한다', () => {
      const cue = new AssaultSoundCue({
        sfxPlayer: mockSfx,
        enableMetronome: false,
      });

      const snapshot1: AssaultPresentationDTO = Object.freeze({
        sessionId: 'session_01',
        roundId: 'round_01',
        phase: 'choice_window',
        questionText: '7 × 8 = ?',
        leftChoiceText: '56',
        rightChoiceText: '54',
        bossScaleProgress: 0.2,
        comboCount: 1,
        remainingTimeSeconds: 3.0,
        warningActive: true,
      });

      cue.update(1.0, snapshot1);
      expect(mockSfx.play).toHaveBeenCalledTimes(1);
      expect(mockSfx.play).toHaveBeenCalledWith('warning');

      // 경고 상태 지속 시 중복 차단
      cue.update(1.1, snapshot1);
      expect(mockSfx.play).toHaveBeenCalledTimes(1);
    });

    it('무효화(boss_negate) 및 스쿼트 회피 성공(evade_success) 정산 명령 수신 시 deflect 사운드를 재생한다', () => {
      const cue = new AssaultSoundCue({
        sfxPlayer: mockSfx,
        enableMetronome: false,
      });

      const negateCmd: AssaultSettlementCommand = Object.freeze({
        sessionId: 'session_01',
        roundId: 'round_01',
        attackId: 'attack_01',
        target: 'boss',
        resultKind: 'hit',
        effectType: 'boss_negate',
        idempotencyKey: 'session_01:attack_01:boss_negate',
      });

      const evadeCmd: AssaultSettlementCommand = Object.freeze({
        sessionId: 'session_01',
        roundId: 'round_01',
        attackId: 'attack_02',
        target: 'player',
        resultKind: 'evaded',
        effectType: 'evade_success',
        idempotencyKey: 'session_01:attack_02:evade_success',
      });

      cue.update(2.0, { settlementCommands: [negateCmd] });
      expect(mockSfx.play).toHaveBeenCalledTimes(1);
      expect(mockSfx.play).toHaveBeenLastCalledWith('shield_deflect');

      // 동일 idempotencyKey 재전송 시 중복 차단
      cue.update(2.1, { settlementCommands: [negateCmd] });
      expect(mockSfx.play).toHaveBeenCalledTimes(1);

      // 새 회피 명령
      cue.update(2.2, { settlementCommands: [evadeCmd] });
      expect(mockSfx.play).toHaveBeenCalledTimes(2);
      expect(mockSfx.play).toHaveBeenLastCalledWith('shield_deflect');
    });

    it('플레이어 오답(wrong) 및 미선택/피격(player_hurt) 정산 명령 수신 시 적절한 피격 효과음을 재생한다', () => {
      const cue = new AssaultSoundCue({
        sfxPlayer: mockSfx,
        enableMetronome: false,
      });

      const wrongCmd: AssaultSettlementCommand = Object.freeze({
        sessionId: 'session_01',
        roundId: 'round_01',
        attackId: 'attack_wrong',
        target: 'player',
        resultKind: 'wrong' as any,
        effectType: 'player_damage',
        idempotencyKey: 'session_01:attack_wrong:player_damage',
      });

      const hurtCmd: AssaultSettlementCommand = Object.freeze({
        sessionId: 'session_01',
        roundId: 'round_01',
        attackId: 'attack_miss',
        target: 'player',
        resultKind: 'miss',
        effectType: 'player_damage',
        idempotencyKey: 'session_01:attack_miss:player_damage',
      });

      cue.update(3.0, { settlementCommands: [wrongCmd] });
      expect(mockSfx.play).toHaveBeenCalledWith('wrong');

      cue.update(3.5, { settlementCommands: [hurtCmd] });
      expect(mockSfx.play).toHaveBeenCalledWith('player_hurt');

      // 동일 키 중복 차단
      cue.update(3.6, { settlementCommands: [wrongCmd, hurtCmd] });
      expect(mockSfx.play).toHaveBeenCalledTimes(2);
    });

    it('명시적 경계 이벤트 목록(events)이 전달될 때 고유 id 기준으로 정확히 1회만 재생한다', () => {
      const cue = new AssaultSoundCue({
        sfxPlayer: mockSfx,
        enableMetronome: false,
      });

      const events: AssaultBoundaryEvent[] = [
        { id: 'evt_01', type: 'throw' },
        { id: 'evt_02', type: 'launch' },
        { id: 'evt_03', type: 'negate' },
        { id: 'evt_04', type: 'evade' },
        { id: 'evt_05', type: 'wrong' },
        { id: 'evt_06', type: 'player_hurt' },
        { id: 'evt_07', type: 'correct' },
      ];

      cue.update(1.0, { events });
      expect(mockSfx.play).toHaveBeenCalledTimes(7);
      expect(mockSfx.play).toHaveBeenNthCalledWith(1, 'jump_whoosh');
      expect(mockSfx.play).toHaveBeenNthCalledWith(2, 'warning');
      expect(mockSfx.play).toHaveBeenNthCalledWith(3, 'shield_deflect');
      expect(mockSfx.play).toHaveBeenNthCalledWith(4, 'shield_deflect');
      expect(mockSfx.play).toHaveBeenNthCalledWith(5, 'wrong');
      expect(mockSfx.play).toHaveBeenNthCalledWith(6, 'player_hurt');
      expect(mockSfx.play).toHaveBeenNthCalledWith(7, 'correct');

      // 동일 이벤트 목록 재호출 시 추가 발음 0회
      cue.update(1.1, { events });
      expect(mockSfx.play).toHaveBeenCalledTimes(7);
    });

    it('사운드 매핑(soundMapping) 커스터마이징을 지원한다', () => {
      const cue = new AssaultSoundCue({
        sfxPlayer: mockSfx,
        enableMetronome: false,
        soundMapping: {
          throw: 'start',
          launch: 'hover',
          evade: 'correct',
        },
      });

      cue.update(1.0, {
        events: [
          { id: 't1', type: 'throw' },
          { id: 'l1', type: 'launch' },
          { id: 'e1', type: 'evade' },
        ],
      });

      expect(mockSfx.play).toHaveBeenNthCalledWith(1, 'start');
      expect(mockSfx.play).toHaveBeenNthCalledWith(2, 'hover');
      expect(mockSfx.play).toHaveBeenNthCalledWith(3, 'correct');
    });
  });

  describe('3. 안전 정지 시 무음 및 복귀 시 소급 폭풍 재생 방지', () => {
    it('isPaused가 true일 때 일체 소리를 요청하지 않는다', () => {
      const cue = new AssaultSoundCue({
        sfxPlayer: mockSfx,
        bpm: 120,
      });

      // 일시정지 상태에서 호출
      cue.update(0.0, { isPaused: true });
      cue.update(0.5, { isPaused: true });
      cue.update(1.0, undefined, true);

      expect(mockSfx.play).toHaveBeenCalledTimes(0);
    });

    it('탭 숨김(isHidden) 또는 추적 상실(isTrackingLost) 중에도 소리를 요청하지 않는다', () => {
      const cue = new AssaultSoundCue({
        sfxPlayer: mockSfx,
        bpm: 120,
      });

      cue.update(0.5, { isHidden: true });
      cue.update(1.0, { isTrackingLost: true });

      expect(mockSfx.play).toHaveBeenCalledTimes(0);
    });

    it('정지 복귀 시 지나간 정지 구간의 박자나 이벤트를 소급 폭풍 재생하지 않는다', () => {
      const cue = new AssaultSoundCue({
        sfxPlayer: mockSfx,
        bpm: 120, // 0.5s per beat
      });

      // beat 0 정상 재생
      cue.update(0.0);
      expect(mockSfx.play).toHaveBeenCalledTimes(1);
      expect(mockSfx.play).toHaveBeenLastCalledWith('metronome_strong');

      // 0.2s 시점에 일시정지 발생
      cue.update(0.2, { isPaused: true });
      expect(mockSfx.play).toHaveBeenCalledTimes(1);

      // 일시정지 중 시간이 흘러 4.0s (약 8비트 경과)
      cue.update(4.0, { isPaused: true });
      expect(mockSfx.play).toHaveBeenCalledTimes(1);

      // 4.0s 시점에 일시정지 해제 및 재개
      cue.update(4.0, { isPaused: false });

      // 정지 기간 동안 지나간 8개 비트가 한꺼번에 소급 폭풍 재생되지 않아야 함!
      // 오직 현재 4.0s 시점의 단일 비트만 재생되거나 현재 비트 이후로 진행
      expect(mockSfx.play).toHaveBeenCalledTimes(2);
      expect(mockSfx.play).toHaveBeenLastCalledWith('metronome_strong'); // beat 8은 강박
    });

    it('정지 기간 중 유입된 이벤트는 복귀 시 중복/폭풍 재생되지 않는다', () => {
      const cue = new AssaultSoundCue({
        sfxPlayer: mockSfx,
        enableMetronome: false,
      });

      // 정지 상태에서 이벤트 발생
      cue.update(1.0, {
        isPaused: true,
        events: [{ id: 'paused_evt', type: 'launch' }],
      });
      expect(mockSfx.play).toHaveBeenCalledTimes(0);

      // 재개 후 동일 이벤트가 전달되어도 중복/유령 재생 0회
      cue.update(1.1, {
        isPaused: false,
        events: [{ id: 'paused_evt', type: 'launch' }],
      });
      expect(mockSfx.play).toHaveBeenCalledTimes(0);
    });
  });

  describe('4. 아키텍처 제약 및 생명주기 관리', () => {
    it('reset() 호출 시 재생 기록이 초기화되어 동일 ID 이벤트를 새 라운드에서 재생할 수 있다', () => {
      const cue = new AssaultSoundCue({
        sfxPlayer: mockSfx,
        enableMetronome: false,
      });

      cue.update(1.0, { events: [{ id: 'throw_round1', type: 'throw' }] });
      expect(mockSfx.play).toHaveBeenCalledTimes(1);

      cue.reset();
      expect(cue.playedCount).toBe(0);

      cue.update(2.0, { events: [{ id: 'throw_round1', type: 'throw' }] });
      expect(mockSfx.play).toHaveBeenCalledTimes(2);
    });

    it('hasPlayed(id)로 특정 경계 ID의 재생 여부를 안전하게 조회할 수 있다', () => {
      const cue = new AssaultSoundCue({
        sfxPlayer: mockSfx,
        enableMetronome: false,
      });

      expect(cue.hasPlayed('boundary_abc')).toBe(false);
      cue.update(1.0, { events: [{ id: 'boundary_abc', type: 'negate' }] });
      expect(cue.hasPlayed('boundary_abc')).toBe(true);
    });

    it('timer나 requestAnimationFrame을 생성하지 않는 순수 어댑터 클래스이다', () => {
      const setTimeoutSpy = vi.spyOn(globalThis, 'setTimeout');
      const setIntervalSpy = vi.spyOn(globalThis, 'setInterval');

      const cue = new AssaultSoundCue({ sfxPlayer: mockSfx });
      cue.update(1.0);
      cue.reset();

      expect(setTimeoutSpy).not.toHaveBeenCalled();
      expect(setIntervalSpy).not.toHaveBeenCalled();

      setTimeoutSpy.mockRestore();
      setIntervalSpy.mockRestore();
    });
  });
});
