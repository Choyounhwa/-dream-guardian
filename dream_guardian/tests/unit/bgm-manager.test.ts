/**
 * bgm-manager.test.ts - BGMManager 단위 테스트
 *
 * 제1장 하얘시니 하드 록 앙상블 사운드트랙 샘플 재생, 갭리스 무한 루프,
 * 페이즈 연동 필터/볼륨 모듈레이션, TTS 오디오 더킹 및 일시정지 제어 검증.
 *
 * @see Issue #223 [AUDIO-SAMPLE-001]
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { BGMManager } from '../../src/audio/BGMManager.js';

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

interface MockSourceNode {
  buffer: AudioBuffer | null;
  loop: boolean;
  connect: ReturnType<typeof vi.fn>;
  start: ReturnType<typeof vi.fn>;
  stop: ReturnType<typeof vi.fn>;
  onended: (() => void) | null;
}

function createMockAudioContext(): AudioContext {
  const destination = {} as AudioDestinationNode;

  return {
    currentTime: 2.0,
    state: 'running',
    resume: vi.fn().mockResolvedValue(undefined),
    destination,
    createGain: vi.fn().mockImplementation(() => ({
      gain: createMockAudioParam(1.0),
      connect: vi.fn(),
    })),
    createBiquadFilter: vi.fn().mockImplementation(() => ({
      type: 'lowpass',
      frequency: createMockAudioParam(20000),
      Q: createMockAudioParam(1),
      connect: vi.fn(),
    })),
    createBufferSource: vi.fn().mockImplementation((): MockSourceNode => ({
      buffer: null,
      loop: false,
      connect: vi.fn(),
      start: vi.fn(),
      stop: vi.fn(),
      onended: null,
    })),
    createBuffer: vi.fn().mockImplementation(() => ({
      numberOfChannels: 2,
      length: 44100 * 4,
      sampleRate: 44100,
      duration: 4.0,
      getChannelData: vi.fn().mockReturnValue(new Float32Array(44100)),
    })),
    decodeAudioData: vi.fn().mockImplementation((_data, successCb) => {
      const buffer = {
        numberOfChannels: 2,
        length: 44100 * 4,
        sampleRate: 44100,
        duration: 4.0,
        getChannelData: vi.fn().mockReturnValue(new Float32Array(44100)),
      };
      if (successCb) successCb(buffer as unknown as AudioBuffer);
      return Promise.resolve(buffer as unknown as AudioBuffer);
    }),
  } as unknown as AudioContext;
}

describe('BGMManager (Issue #223 - AUDIO-SAMPLE-001)', () => {
  let mockCtx: AudioContext;
  let bgmManager: BGMManager;

  beforeEach(() => {
    vi.useFakeTimers();
    mockCtx = createMockAudioContext();
    bgmManager = new BGMManager({
      audioContext: mockCtx,
      trackUrl: '/audio/bgm/ch1_hayesini_rock_sample.wav',
      volume: 0.5,
      bpm: 120,
    });
  });

  afterEach(() => {
    bgmManager.stop();
    vi.useRealTimers();
  });

  describe('1. 초기화 및 기본 상태', () => {
    it('기본 상태는 정지 상태(isPlaying=false, isPaused=false, isMuted=false)여야 한다', () => {
      expect(bgmManager.isPlaying).toBe(false);
      expect(bgmManager.isPaused).toBe(false);
      expect(bgmManager.isMuted).toBe(false);
      expect(bgmManager.volume).toBe(0.5);
      expect(bgmManager.phase).toBe('DEFAULT');
      expect(bgmManager.isDucked).toBe(false);
      expect(bgmManager.trackUrl).toBe('/audio/bgm/ch1_hayesini_rock_sample.wav');
    });

    it('기본 파라미터 생략 시 안전한 기본값(bpm=120, volume=0.5)을 사용해야 한다', () => {
      const defaultManager = new BGMManager({ audioContext: mockCtx });
      expect(defaultManager.bpm).toBe(120);
      expect(defaultManager.volume).toBe(0.5);
      expect(defaultManager.trackUrl).toBe('/audio/bgm/ch1_hayesini_rock_sample.wav');
      defaultManager.stop();
    });
  });

  describe('2. 재생 및 정지 (Gapless 무한 루프)', () => {
    it('play() 호출 시 루프 속성(loop=true)과 함께 AudioBufferSource가 시작되어야 한다', async () => {
      await bgmManager.play();
      expect(bgmManager.isPlaying).toBe(true);
      expect(bgmManager.isPaused).toBe(false);
      expect(mockCtx.createBufferSource).toHaveBeenCalled();
    });

    it('pause() 호출 시 재생이 일시정지(isPaused=true, isPlaying=false)되어야 한다', async () => {
      await bgmManager.play();
      bgmManager.pause();
      expect(bgmManager.isPlaying).toBe(false);
      expect(bgmManager.isPaused).toBe(true);
    });

    it('resume() 호출 시 일시정지 상태에서 다시 재생되어야 한다', async () => {
      await bgmManager.play();
      bgmManager.pause();
      await bgmManager.resume();
      expect(bgmManager.isPlaying).toBe(true);
      expect(bgmManager.isPaused).toBe(false);
    });

    it('stop() 호출 시 재생 및 일시정지 상태가 모두 리셋되어야 한다', async () => {
      await bgmManager.play();
      bgmManager.stop();
      expect(bgmManager.isPlaying).toBe(false);
      expect(bgmManager.isPaused).toBe(false);
    });
  });

  describe('3. 볼륨 및 음소거 제어', () => {
    it('setVolume()으로 볼륨(0~1)을 변경할 수 있다', () => {
      bgmManager.setVolume(0.8);
      expect(bgmManager.volume).toBe(0.8);

      // 0 미만 및 1 초과 클램핑
      bgmManager.setVolume(-0.2);
      expect(bgmManager.volume).toBe(0);
      bgmManager.setVolume(1.5);
      expect(bgmManager.volume).toBe(1.0);
    });

    it('setMuted(true) 호출 시 음소거되고 볼륨 설정값은 유지된다', () => {
      bgmManager.setVolume(0.7);
      bgmManager.setMuted(true);
      expect(bgmManager.isMuted).toBe(true);
      expect(bgmManager.volume).toBe(0.7);

      bgmManager.setMuted(false);
      expect(bgmManager.isMuted).toBe(false);
    });
  });

  describe('4. 페이즈 연동 사운드 모듈레이션', () => {
    it('REST_READY 페이즈 설정 시 필터 주파수가 저역통과(Muffled, <= 1000Hz)로 변경되어야 한다', () => {
      bgmManager.setPhase('REST_READY');
      expect(bgmManager.phase).toBe('REST_READY');
    });

    it('KEYNOTE_PERFORMANCE 페이즈 설정 시 필터가 풀 개방되고 100% 풀 볼륨이어야 한다', () => {
      bgmManager.setPhase('KEYNOTE_PERFORMANCE');
      expect(bgmManager.phase).toBe('KEYNOTE_PERFORMANCE');
    });

    it('RUN_QUESTION 페이즈 설정 시 정상 록 리듬 상태로 복귀해야 한다', () => {
      bgmManager.setPhase('RUN_QUESTION');
      expect(bgmManager.phase).toBe('RUN_QUESTION');
    });
  });

  describe('5. TTS 오디오 더킹 (Ducking)', () => {
    it('setDucking(true) 호출 시 더킹이 활성화되어 음량이 낮아져야 한다', () => {
      bgmManager.setDucking(true);
      expect(bgmManager.isDucked).toBe(true);

      bgmManager.setDucking(false);
      expect(bgmManager.isDucked).toBe(false);
    });
  });

  describe('6. 브라우저 자동 재생 정책 대응 (unlock)', () => {
    it('unlock() 호출 시 suspended 상태의 AudioContext가 resume 되어야 한다', async () => {
      const suspendedCtx = createMockAudioContext();
      (suspendedCtx as { state: string }).state = 'suspended';
      const manager = new BGMManager({ audioContext: suspendedCtx });

      await manager.unlock();
      expect(suspendedCtx.resume).toHaveBeenCalled();
      manager.stop();
    });
  });

  describe('7. 페이드 인 / 아웃 효과', () => {
    it('fadeOut() 호출 후 타이머 경과 시 재생이 정지되어야 한다', async () => {
      await bgmManager.play();
      bgmManager.fadeOut(0.4);
      vi.advanceTimersByTime(450);
      expect(bgmManager.isPlaying).toBe(false);
    });

    it('fadeIn() 호출 시 점진적으로 볼륨이 목표값까지 도달해야 한다', async () => {
      bgmManager.fadeIn(0.3);
      vi.advanceTimersByTime(350);
      expect(bgmManager.isPlaying).toBe(true);
    });
  });

  describe('8. 비정상 환경 예외 안전성', () => {
    it('AudioContext가 없는 환경에서도 오류를 던지지 않고 안전하게 상태만 처리되어야 한다', async () => {
      const silentManager = new BGMManager();
      expect(() => {
        silentManager.setVolume(0.4);
        silentManager.setMuted(true);
        silentManager.setPhase('REST_READY');
        silentManager.setDucking(true);
        silentManager.pause();
        silentManager.stop();
      }).not.toThrow();
    });
  });
});
