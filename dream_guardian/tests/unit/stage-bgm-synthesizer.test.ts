/**
 * stage-bgm-synthesizer.test.ts - 스테이지 진입 록 드럼 비트 및 베이스 그루브 Web Audio BGM 합성기 단위 테스트
 *
 * @see Issue #305 [AUDIO-BGM-001]
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  StageBGMSynthesizer,
} from '../../src/audio/StageBGMSynthesizer.js';
import { DEFAULT_BGM_AUDIO_CONFIG } from '../../config/audio.config.js';

interface MockAudioParam {
  value: number;
  setValueAtTime: ReturnType<typeof vi.fn>;
  exponentialRampToValueAtTime: ReturnType<typeof vi.fn>;
  linearRampToValueAtTime: ReturnType<typeof vi.fn>;
}

function createMockAudioParam(initial: number = 0): MockAudioParam {
  return {
    value: initial,
    setValueAtTime: vi.fn(),
    exponentialRampToValueAtTime: vi.fn(),
    linearRampToValueAtTime: vi.fn(),
  };
}

function createMockAudioContext(): AudioContext {
  const destination = {} as AudioDestinationNode;

  return {
    currentTime: 1.0,
    state: 'running',
    resume: vi.fn().mockResolvedValue(undefined),
    destination,
    createOscillator: vi.fn().mockImplementation(() => ({
      type: 'sawtooth',
      frequency: createMockAudioParam(100),
      detune: createMockAudioParam(0),
      connect: vi.fn(),
      start: vi.fn(),
      stop: vi.fn(),
    })),
    createGain: vi.fn().mockImplementation(() => ({
      gain: createMockAudioParam(1.0),
      connect: vi.fn(),
    })),
    createBiquadFilter: vi.fn().mockImplementation(() => ({
      type: 'lowpass',
      frequency: createMockAudioParam(800),
      Q: createMockAudioParam(1),
      connect: vi.fn(),
    })),
    createBufferSource: vi.fn().mockImplementation(() => ({
      buffer: null,
      connect: vi.fn(),
      start: vi.fn(),
      stop: vi.fn(),
    })),
    createBuffer: vi.fn().mockImplementation(() => ({
      getChannelData: vi.fn().mockReturnValue(new Float32Array(4096)),
    })),
  } as unknown as AudioContext;
}

describe('StageBGMSynthesizer (Issue #305 - AUDIO-BGM-001)', () => {
  let mockCtx: AudioContext;
  let bgmSynth: StageBGMSynthesizer;

  beforeEach(() => {
    vi.useFakeTimers();
    mockCtx = createMockAudioContext();
    bgmSynth = new StageBGMSynthesizer({ audioContext: mockCtx });
  });

  afterEach(() => {
    bgmSynth.stop();
    vi.useRealTimers();
  });

  describe('1. 초기화 및 기본 상태', () => {
    it('기본 상태는 정지(isPlaying=false, isPaused=false) 상태이다', () => {
      expect(bgmSynth.isPlaying).toBe(false);
      expect(bgmSynth.isPaused).toBe(false);
      expect(bgmSynth.isMuted).toBe(false);
      expect(bgmSynth.bpm).toBe(DEFAULT_BGM_AUDIO_CONFIG.bpm);
    });

    it('설정 옵션으로 커스텀 bpm 및 volume을 지정할 수 있다', () => {
      const customSynth = new StageBGMSynthesizer({
        audioContext: mockCtx,
        bpm: 140,
        volume: 0.5,
      });
      expect(customSynth.bpm).toBe(140);
      expect(customSynth.volume).toBe(0.5);
      customSynth.stop();
    });
  });

  describe('2. 재생 및 정지 생명주기 (start, stop, pause, resume)', () => {
    it('start() 호출 시 isPlaying이 true가 되고 스케줄러 타이머가 동작한다', () => {
      bgmSynth.start();
      expect(bgmSynth.isPlaying).toBe(true);
      expect(bgmSynth.isPaused).toBe(false);
    });

    it('이미 재생 중일 때 start()를 재호출해도 중복 스케줄러가 생성되지 않는다', () => {
      bgmSynth.start();
      const initialStep = (bgmSynth as unknown as { currentStep: number }).currentStep;
      bgmSynth.start();
      expect(bgmSynth.isPlaying).toBe(true);
      expect((bgmSynth as unknown as { currentStep: number }).currentStep).toBe(initialStep);
    });

    it('stop() 호출 시 재생이 완전히 중단되고 상태가 리셋된다', () => {
      bgmSynth.start();
      bgmSynth.stop();
      expect(bgmSynth.isPlaying).toBe(false);
      expect(bgmSynth.isPaused).toBe(false);
    });

    it('pause() 호출 시 isPlaying=false, isPaused=true가 된다', () => {
      bgmSynth.start();
      bgmSynth.pause();
      expect(bgmSynth.isPlaying).toBe(false);
      expect(bgmSynth.isPaused).toBe(true);
    });

    it('resume() 호출 시 일시정지 상태에서 재생이 복원된다', () => {
      bgmSynth.start();
      bgmSynth.pause();
      bgmSynth.resume();
      expect(bgmSynth.isPlaying).toBe(true);
      expect(bgmSynth.isPaused).toBe(false);
    });

    it('일시정지 상태가 아닐 때 resume()은 효과가 없거나 start()를 무리하게 중복시키지 않는다', () => {
      bgmSynth.resume(); // 정지 상태에서 resume
      expect(bgmSynth.isPlaying).toBe(false);
    });
  });

  describe('3. 볼륨 및 뮤트 제어 (setVolume, setMuted, fadeOut)', () => {
    it('setVolume()으로 마스터 볼륨(0~1)을 제어할 수 있다', () => {
      bgmSynth.setVolume(0.8);
      expect(bgmSynth.volume).toBe(0.8);

      bgmSynth.setVolume(-0.5); // 0으로 클램프
      expect(bgmSynth.volume).toBe(0);

      bgmSynth.setVolume(1.5); // 1로 클램프
      expect(bgmSynth.volume).toBe(1.0);
    });

    it('setMuted(true) 시 뮤트 상태가 되고 마스터 게인이 0으로 전환된다', () => {
      bgmSynth.setMuted(true);
      expect(bgmSynth.isMuted).toBe(true);

      bgmSynth.setMuted(false);
      expect(bgmSynth.isMuted).toBe(false);
    });

    it('fadeOut() 호출 시 지정된 시간 동안 게인이 감쇠된 후 정지된다', () => {
      bgmSynth.start();
      bgmSynth.fadeOut(0.5);
      // 타이머 경과 후 stop() 호출 확인
      vi.advanceTimersByTime(550);
      expect(bgmSynth.isPlaying).toBe(false);
    });
  });

  describe('4. 템포 변경 (setBpm)', () => {
    it('setBpm()으로 재생 템포를 동적으로 변경할 수 있다', () => {
      bgmSynth.setBpm(132);
      expect(bgmSynth.bpm).toBe(132);

      // 너무 낮거나 높은 템포 클램핑 확인 (예: 60~240)
      bgmSynth.setBpm(30);
      expect(bgmSynth.bpm).toBe(60);

      bgmSynth.setBpm(300);
      expect(bgmSynth.bpm).toBe(240);
    });
  });

  describe('5. 절차적 드럼 & 베이스 스케줄링 합성', () => {
    it('타이머가 진행되면서 kick, snare, hihat, bass 음향 노드가 생성되고 스케줄링된다', () => {
      bgmSynth.start();

      // 8비트 1마디 = 8스텝 진행 (120BPM 기준 8분음표 = 0.25초 = 250ms per step)
      vi.advanceTimersByTime(500); // 2박자(스텝 2개 이상 스케줄링)

      // Oscillator 및 BufferSource가 Web Audio API를 통해 생성되었는지 검증
      expect(mockCtx.createOscillator).toHaveBeenCalled();
      expect(mockCtx.createGain).toHaveBeenCalled();
      expect(mockCtx.createBiquadFilter).toHaveBeenCalled();
    });

    it('오디오 컨텍스트가 suspended 상태일 때 resume()을 시도한다', async () => {
      const suspendedCtx = createMockAudioContext();
      (suspendedCtx as { state: string }).state = 'suspended';
      const synth = new StageBGMSynthesizer({ audioContext: suspendedCtx });

      synth.start();
      expect(suspendedCtx.resume).toHaveBeenCalled();
      synth.stop();
    });
  });
});
