import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BeatRunCoordinator } from '../../src/game/BeatRunCoordinator.js';
import { RhythmEngine, type BeatEvent } from '../../src/core/RhythmEngine.js';
import { SFXSynth } from '../../src/audio/SFXSynth.js';

describe('Issue #296 [AUDIO-METRONOME-001] 비트 동기화 메트로놈 사운드 연동 및 인게임 8박자/카운트인 오디오 출력', () => {
  let mockSfx: { play: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    mockSfx = {
      play: vi.fn(),
    };
  });

  describe('1. 비트 이벤트 브리지 (onBeat) 지원', () => {
    it('BeatRunCoordinator가 update(dt) 시 RhythmEngine의 BeatEvent를 onBeat 콜백으로 전달한다', () => {
      const beatEvents: BeatEvent[] = [];
      const coordinator = new BeatRunCoordinator({
        trackConfig: { bpm: 120 }, // 1박 = 0.5s
        onBeat: (ev) => beatEvents.push(ev),
      });

      coordinator.startRound();
      // startRound() 호출 시 1번째 비트(beatIndex 0) 즉시 발행
      expect(beatEvents.length).toBe(1);
      expect(beatEvents[0].beatIndex).toBe(0);

      // 0.5초 경과 시 2번째 비트(beatIndex 1) 발행
      coordinator.update(0.5);
      expect(beatEvents.length).toBe(2);
      expect(beatEvents[1].beatIndex).toBe(1);
    });

    it('외부에서 주입된 RhythmEngine에 대해서도 onBeat 콜백 브리지가 정상 작동한다', () => {
      const rhythmEngine = new RhythmEngine({ bpm: 120 });
      const beatEvents: BeatEvent[] = [];
      const coordinator = new BeatRunCoordinator({
        rhythmEngine,
        onBeat: (ev) => beatEvents.push(ev),
      });

      coordinator.startRound();
      expect(beatEvents.length).toBe(1);
      coordinator.update(0.5);
      expect(beatEvents.length).toBe(2);
    });
  });

  describe('2. isStrongBeat(beatIndex) 강박/약박 판정 로직', () => {
    it('기본 4/4 박자에서 1박(index 0)과 5박(index 4)은 강박, 그 외는 약박으로 판정한다', () => {
      const coordinator = new BeatRunCoordinator({
        trackConfig: { bpm: 120, timeSignature: [4, 4] },
      });

      expect(coordinator.isStrongBeat(0)).toBe(true);  // 1박 (강박)
      expect(coordinator.isStrongBeat(1)).toBe(false); // 2박 (약박)
      expect(coordinator.isStrongBeat(2)).toBe(false); // 3박 (약박)
      expect(coordinator.isStrongBeat(3)).toBe(false); // 4박 (약박)
      expect(coordinator.isStrongBeat(4)).toBe(true);  // 5박 (강박)
      expect(coordinator.isStrongBeat(5)).toBe(false); // 6박 (약박)
      expect(coordinator.isStrongBeat(6)).toBe(false); // 7박 (약박)
      expect(coordinator.isStrongBeat(7)).toBe(false); // 8박 (약박)
    });

    it('커스텀 박자표(예: 3/4 박자)에서도 마디 첫 박을 강박으로 판정한다', () => {
      const coordinator = new BeatRunCoordinator({
        trackConfig: { bpm: 120, timeSignature: [3, 4] },
      });

      expect(coordinator.isStrongBeat(0)).toBe(true);
      expect(coordinator.isStrongBeat(1)).toBe(false);
      expect(coordinator.isStrongBeat(2)).toBe(false);
      expect(coordinator.isStrongBeat(3)).toBe(true);
      expect(coordinator.isStrongBeat(4)).toBe(false);
      expect(coordinator.isStrongBeat(5)).toBe(false);
      expect(coordinator.isStrongBeat(6)).toBe(true);
    });
  });

  describe('3. 카운트인(COUNT_IN) 3박자 메트로놈 연동', () => {
    it('startCountIn() 호출 시 1박은 metronome_strong, 2~3박은 metronome_weak 사운드를 출력한다', () => {
      const coordinator = new BeatRunCoordinator({
        trackConfig: {
          bpm: 120, // 0.5s per beat
          intro: { countInBeats: 3, soundType: 'metronome' },
        },
        sfx: mockSfx,
      });

      coordinator.startCountIn();
      // t=0: 1번째 예비박 (강박)
      expect(mockSfx.play).toHaveBeenCalledTimes(1);
      expect(mockSfx.play).toHaveBeenLastCalledWith('metronome_strong');

      // t=0.5s: 2번째 예비박 (약박)
      coordinator.update(0.5);
      expect(mockSfx.play).toHaveBeenCalledTimes(2);
      expect(mockSfx.play).toHaveBeenLastCalledWith('metronome_weak');

      // t=1.0s: 3번째 예비박 (약박)
      coordinator.update(0.5);
      expect(mockSfx.play).toHaveBeenCalledTimes(3);
      expect(mockSfx.play).toHaveBeenLastCalledWith('metronome_weak');

      // t=1.5s: 카운트인 완료 후 RUN_QUESTION 시작 및 첫 번째 강박 발음
      coordinator.update(0.5);
      expect(coordinator.phase).toBe('RUN_QUESTION');
      expect(mockSfx.play).toHaveBeenCalledTimes(4);
      expect(mockSfx.play).toHaveBeenLastCalledWith('metronome_strong');
    });

    it('startRound({ withCountIn: true })로 시작해도 동일하게 카운트인 메트로놈이 출력된다', () => {
      const coordinator = new BeatRunCoordinator({
        trackConfig: {
          bpm: 120,
          intro: { countInBeats: 3, soundType: 'metronome' },
        },
        sfx: mockSfx,
      });

      coordinator.startRound({ withCountIn: true });
      expect(coordinator.phase).toBe('COUNT_IN');
      expect(mockSfx.play).toHaveBeenCalledWith('metronome_strong');
    });
  });

  describe('4. 인게임 8박자 루프 메트로놈 사운드 출력', () => {
    it('정규 8박 루프 동안 강박(0, 4)에는 metronome_strong, 약박(1~3, 5~7)에는 metronome_weak를 출력한다', () => {
      const coordinator = new BeatRunCoordinator({
        trackConfig: { bpm: 120 }, // 0.5s per beat
        sfx: mockSfx,
      });

      coordinator.startRound();
      // beat 0 (1박)
      expect(mockSfx.play).toHaveBeenLastCalledWith('metronome_strong');

      // beat 1 (2박)
      coordinator.update(0.5);
      expect(mockSfx.play).toHaveBeenLastCalledWith('metronome_weak');

      // beat 2 (3박)
      coordinator.update(0.5);
      expect(mockSfx.play).toHaveBeenLastCalledWith('metronome_weak');

      // beat 3 (4박)
      coordinator.update(0.5);
      expect(mockSfx.play).toHaveBeenLastCalledWith('metronome_weak');

      // beat 4 (5박 - 강박)
      coordinator.update(0.5);
      expect(mockSfx.play).toHaveBeenLastCalledWith('metronome_strong');

      // beat 5 (6박)
      coordinator.update(0.5);
      expect(mockSfx.play).toHaveBeenLastCalledWith('metronome_weak');

      // beat 6 (7박)
      coordinator.update(0.5);
      expect(mockSfx.play).toHaveBeenLastCalledWith('metronome_weak');

      // beat 7 (8박)
      coordinator.update(0.5);
      expect(mockSfx.play).toHaveBeenLastCalledWith('metronome_weak');

      // beat 0 (다음 라운드 1박 - 강박)
      coordinator.update(0.5);
      expect(mockSfx.play).toHaveBeenLastCalledWith('metronome_strong');
    });
  });

  describe('5. 일시정지(pause) 및 메트로놈 토글 제어', () => {
    it('일시정지 중에는 update(dt)가 진행되어도 메트로놈 사운드가 발음되지 않는다', () => {
      const coordinator = new BeatRunCoordinator({
        trackConfig: { bpm: 120 },
        sfx: mockSfx,
      });

      coordinator.startRound();
      mockSfx.play.mockClear();

      coordinator.pause();
      coordinator.update(1.0); // 2박 경과 시간 전달
      expect(mockSfx.play).not.toHaveBeenCalled();

      coordinator.resume();
      coordinator.update(0.5);
      expect(mockSfx.play).toHaveBeenCalled();
    });

    it('playMetronome을 false로 설정하면 사운드 출력이 비활성화된다', () => {
      const coordinator = new BeatRunCoordinator({
        trackConfig: { bpm: 120 },
        sfx: mockSfx,
        playMetronome: false,
      });

      coordinator.startRound();
      expect(mockSfx.play).not.toHaveBeenCalled();

      coordinator.update(0.5);
      expect(mockSfx.play).not.toHaveBeenCalled();

      coordinator.setPlayMetronome(true);
      coordinator.update(0.5);
      expect(mockSfx.play).toHaveBeenCalled();
    });
  });

  describe('6. SFXSynth 음소거(muted) 시 메트로놈 발음 차단', () => {
    it('SFXSynth가 muted 상태일 때는 play()가 호출되어도 오디오 노드를 생성하지 않는다', () => {
      const mockCreateOscillator = vi.fn();
      const mockCtx = {
        currentTime: 0,
        state: 'running',
        resume: vi.fn().mockResolvedValue(undefined),
        destination: {} as any,
        createOscillator: mockCreateOscillator,
        createGain: vi.fn().mockReturnValue({
          gain: {
            setValueAtTime: vi.fn(),
            exponentialRampToValueAtTime: vi.fn(),
          },
          connect: vi.fn(),
        }),
      } as unknown as AudioContext;

      const synth = new SFXSynth({ audioContext: mockCtx, muted: true });
      expect(synth.isMuted).toBe(true);

      synth.play('metronome_strong');
      synth.play('metronome_weak');

      expect(mockCreateOscillator).not.toHaveBeenCalled();

      synth.setMuted(false);
      expect(synth.isMuted).toBe(false);
      synth.play('metronome_strong');
      expect(mockCreateOscillator).toHaveBeenCalled();
    });
  });
});
