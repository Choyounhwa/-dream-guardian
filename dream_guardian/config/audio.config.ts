/**
 * audio.config.ts - Web Audio 밴드 신디사이저 및 음향 밸런스 설정값
 *
 * Issue #191 [AUDIO-BAND-001]:
 * - 손 (Zone 1~5): 일렉 기타 리드/리프/파워코드 왜곡(Overdrive) 주파수 및 파라미터
 * - 발 (Zone 9~11): 록 드럼 킥(Kick), 스네어(Snare 톤+노이즈), 심벌(Cymbal) 파라미터
 * - 정박(Sync) / 엇박(Stumble) / 미스(Miss) 음향 파라미터
 * - Ready/Set 카운트다운 사운드 파라미터
 *
 * @see Issue #191 [AUDIO-BAND-001]
 * @see Issue #229 [SPEC-ROUTINE-VERIFY-001]
 */

export interface BandAudioConfig {
  /** 기타 Zone별 기준 주파수 (Hz) */
  readonly guitarFrequencies: Readonly<Record<number, number>>;
  /** 파워코드(근음 + 5도 화음) 적용 존 ID 목록 */
  readonly powerChordZones: readonly number[];
  /** 파워코드 완전5도 음정 비율 (약 1.5, 3:2 순정률) */
  readonly fifthRatio: number;
  /** WaveShaper 비선형 오버드라이브 왜곡 계수 */
  readonly distortionAmount: number;
  /** 록 드럼 음향 파라미터 */
  readonly drum: {
    readonly kick: {
      readonly startFreq: number;
      readonly endFreq: number;
      readonly stumbleStartFreq: number;
      readonly duration: number;
      readonly syncGain: number;
      readonly stumbleGain: number;
    };
    readonly snare: {
      readonly noiseDuration: number;
      readonly toneStartFreq: number;
      readonly toneEndFreq: number;
      readonly toneDuration: number;
      readonly syncNoiseGain: number;
      readonly stumbleNoiseGain: number;
      readonly toneGain: number;
    };
    readonly cymbal: {
      readonly syncFilterFreq: number;
      readonly stumbleFilterFreq: number;
      readonly duration: number;
      readonly syncGain: number;
      readonly stumbleGain: number;
    };
  };
  /** 미스(Miss) 시 둔탁한 메트로놈 틱 파라미터 */
  readonly missTick: {
    readonly freq: number;
    readonly duration: number;
    readonly gain: number;
  };
  /** Ready / Set 사운드 (구형 REST_READY 폐기로 현행 정규루프 미채택, 유틸리티 보존) */
  readonly readyCount: {
    readonly readyFreq: number;
    readonly readyDuration: number;
    readonly setStartFreq: number;
    readonly setEndFreq: number;
    readonly setDuration: number;
  };
}

export const DEFAULT_BAND_AUDIO_CONFIG: BandAudioConfig = Object.freeze({
  guitarFrequencies: Object.freeze({
    1: 164.81, // E3 파워코드
    2: 196.00, // G3 파워코드
    3: 220.00, // A3 파워코드
    4: 261.63, // C4 리드
    5: 293.66, // D4 리드
    6: 164.81, // E3 폴백
    7: 196.00, // G3 폴백
    8: 220.00, // A3 폴백
  }),
  powerChordZones: Object.freeze([1, 2, 3]),
  fifthRatio: 1.5, // 3:2 순정 5도 파워코드 화음 비율
  distortionAmount: 28,
  drum: Object.freeze({
    kick: Object.freeze({
      startFreq: 130,
      endFreq: 45,
      stumbleStartFreq: 90,
      duration: 0.28,
      syncGain: 0.45,
      stumbleGain: 0.22,
    }),
    snare: Object.freeze({
      noiseDuration: 0.22,
      toneStartFreq: 180,
      toneEndFreq: 80,
      toneDuration: 0.12,
      syncNoiseGain: 0.38,
      stumbleNoiseGain: 0.18,
      toneGain: 0.30,
    }),
    cymbal: Object.freeze({
      syncFilterFreq: 7000,
      stumbleFilterFreq: 4000,
      duration: 0.35,
      syncGain: 0.30,
      stumbleGain: 0.15,
    }),
  }),
  missTick: Object.freeze({
    freq: 120,
    duration: 0.08,
    gain: 0.15,
  }),
  readyCount: Object.freeze({
    readyFreq: 440,
    readyDuration: 0.22,
    setStartFreq: 880,
    setEndFreq: 1046.5,
    setDuration: 0.25,
  }),
});
