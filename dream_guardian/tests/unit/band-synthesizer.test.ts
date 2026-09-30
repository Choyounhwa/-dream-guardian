/**
 * band-synthesizer.test.ts - 1단계 기타(Zone 1~5) + 드럼(Zone 9~11) Web Audio 합성기 단위 테스트
 *
 * @see Issue #191 [AUDIO-BAND-001]
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  BandSynthesizer,
  GUITAR_ZONE_FREQUENCIES,
} from '../../src/audio/BandSynthesizer.js';

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
    currentTime: 10.0,
    state: 'running',
    resume: vi.fn().mockResolvedValue(undefined),
    destination,
    createOscillator: vi.fn().mockImplementation(() => ({
      type: 'sine',
      frequency: createMockAudioParam(440),
      detune: createMockAudioParam(0),
      connect: vi.fn(),
      start: vi.fn(),
      stop: vi.fn(),
    })),
    createGain: vi.fn().mockImplementation(() => ({
      gain: createMockAudioParam(1.0),
      connect: vi.fn(),
    })),
    createWaveShaper: vi.fn().mockImplementation(() => ({
      curve: null,
      oversample: 'none',
      connect: vi.fn(),
    })),
    createBiquadFilter: vi.fn().mockImplementation(() => ({
      type: 'lowpass',
      frequency: createMockAudioParam(1000),
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

describe('BandSynthesizer (Issue #191 - AUDIO-BAND-001)', () => {
  let synth: BandSynthesizer;
  let mockCtx: AudioContext;

  beforeEach(() => {
    mockCtx = createMockAudioContext();
    synth = new BandSynthesizer({ audioContext: mockCtx });
  });

  describe('1. 존 및 악기 매핑 판별 (isGuitarZone / isDrumZone)', () => {
    it('Zone 1~5는 기타 존으로 판정된다', () => {
      for (let z = 1; z <= 5; z++) {
        expect(synth.isGuitarZone(z)).toBe(true);
        expect(synth.isDrumZone(z)).toBe(false);
      }
    });

    it('Zone 9~11은 드럼 존으로 판정된다', () => {
      for (let z = 9; z <= 11; z++) {
        expect(synth.isDrumZone(z)).toBe(true);
        expect(synth.isGuitarZone(z)).toBe(false);
      }
    });

    it('Zone 6~8은 기본적으로 기타 영역으로 폴백 지원된다', () => {
      expect(synth.isGuitarZone(6)).toBe(true);
      expect(synth.isDrumZone(6)).toBe(false);
    });
  });

  describe('2. 일렉 기타(Zone 1~5) 오버드라이브 절차적 합성', () => {
    it('Zone 1~5에 정해진 기준 주파수가 매핑되어 있다', () => {
      expect(GUITAR_ZONE_FREQUENCIES[1]).toBeCloseTo(164.81, 1); // E3
      expect(GUITAR_ZONE_FREQUENCIES[2]).toBeCloseTo(196.00, 1); // G3
      expect(GUITAR_ZONE_FREQUENCIES[3]).toBeCloseTo(220.00, 1); // A3
      expect(GUITAR_ZONE_FREQUENCIES[4]).toBeCloseTo(261.63, 1); // C4
      expect(GUITAR_ZONE_FREQUENCIES[5]).toBeCloseTo(293.66, 1); // D4
    });

    it('Zone 1 터치 시 정박(sync) 오버드라이브 기타 음을 합성한다', () => {
      synth.playGuitarZone(1, 'sync');

      expect(mockCtx.createOscillator).toHaveBeenCalled();
      expect(mockCtx.createGain).toHaveBeenCalled();
      expect(mockCtx.createWaveShaper).toHaveBeenCalled();
    });

    it('playZoneSound(1..5) 호출 시 playGuitarZone으로 분기한다', () => {
      const spy = vi.spyOn(synth, 'playGuitarZone');
      synth.playZoneSound(4, 'sync');
      expect(spy).toHaveBeenCalledWith(4, 'sync');
    });
  });

  describe('3. 록 드럼(Zone 9~11) 절차적 합성', () => {
    it('Zone 9 터치 시 록 드럼 킥(Kick) 피치 강하 오실레이터를 합성한다', () => {
      synth.playDrumZone(9, 'sync');
      expect(mockCtx.createOscillator).toHaveBeenCalled();
      expect(mockCtx.createGain).toHaveBeenCalled();
    });

    it('Zone 10 터치 시 스네어(Snare) 노이즈 버퍼를 합성한다', () => {
      synth.playDrumZone(10, 'sync');
      expect(mockCtx.createBuffer).toHaveBeenCalled();
      expect(mockCtx.createBufferSource).toHaveBeenCalled();
    });

    it('Zone 11 터치 시 크래시/하이햇(Cymbal) 금속성 필터를 합성한다', () => {
      synth.playDrumZone(11, 'sync');
      expect(mockCtx.createBufferSource).toHaveBeenCalled();
      expect(mockCtx.createBiquadFilter).toHaveBeenCalled();
    });

    it('playZoneSound(9..11) 호출 시 playDrumZone으로 분기한다', () => {
      const spy = vi.spyOn(synth, 'playDrumZone');
      synth.playZoneSound(10, 'sync');
      expect(spy).toHaveBeenCalledWith(10, 'sync');
    });
  });

  describe('4. 정박(Sync) / 엇박(Stumble) / 미스(Miss) 음향 메커니즘', () => {
    it('엇박(stumble) 판정 시 디튠(피치 벤드 글리치) 및 게인 감쇠가 적용된다', () => {
      synth.playGuitarZone(3, 'stumble');
      expect(mockCtx.createOscillator).toHaveBeenCalled();
      // stumble 시 디튠 파라미터가 수정됨
      const osc = vi.mocked(mockCtx.createOscillator).mock.results[0].value;
      expect(osc.detune.setValueAtTime).toHaveBeenCalled();
    });

    it('무동작(miss) 판정 시 메인 악기가 음소거되고 둔탁한 메트로놈 틱만 출력된다', () => {
      synth.playGuitarZone(3, 'miss');
      // 메인 기타 웨이브셰이퍼는 생성되지 않음
      expect(mockCtx.createWaveShaper).not.toHaveBeenCalled();
      expect(mockCtx.createOscillator).toHaveBeenCalled(); // 틱 사운드용 1회
    });

    it('드럼 존에서 miss 판정 시 메인 드럼 대신 틱 사운드가 출력된다', () => {
      synth.playDrumZone(9, 'miss');
      expect(mockCtx.createOscillator).toHaveBeenCalled();
    });
  });

  describe('5. 2박 Ready 카운트 사운드 (READY... SET!)', () => {
    it('1박일 때 READY(440Hz) 톤을 재생한다', () => {
      synth.playReadyCount(1);
      expect(mockCtx.createOscillator).toHaveBeenCalled();
      const osc = vi.mocked(mockCtx.createOscillator).mock.results[0].value;
      expect(osc.frequency.setValueAtTime).toHaveBeenCalledWith(440, expect.any(Number));
    });

    it('2박일 때 SET(880Hz 상승 톤)을 재생한다', () => {
      synth.playReadyCount(2);
      expect(mockCtx.createOscillator).toHaveBeenCalled();
      const osc = vi.mocked(mockCtx.createOscillator).mock.results[0].value;
      expect(osc.frequency.setValueAtTime).toHaveBeenCalledWith(880, expect.any(Number));
    });
  });

  describe('6. 음소거(Mute) 상태 제어', () => {
    it('muted=true 설정 시 모든 사운드 생성이 차단된다', () => {
      synth.setMuted(true);
      expect(synth.isMuted).toBe(true);

      synth.playGuitarZone(1, 'sync');
      synth.playDrumZone(9, 'sync');
      synth.playReadyCount(1);

      expect(mockCtx.createOscillator).not.toHaveBeenCalled();
    });
  });
});
