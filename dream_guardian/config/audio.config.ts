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

/**
 * Issue #305 [AUDIO-BGM-001]:
 * 스테이지 진입 4/4 박자 록 드럼 및 베이스 그루브 Web Audio 절차적 합성 설정
 */
export interface BGMAudioConfig {
  readonly bpm: number;
  readonly masterVolume: number;
  readonly drum: {
    readonly kickGain: number;
    readonly snareGain: number;
    readonly hihatGain: number;
    readonly kickStartFreq: number;
    readonly kickEndFreq: number;
    readonly kickDuration: number;
    readonly snareDuration: number;
    readonly snareToneFreq: number;
    readonly hihatDuration: number;
    readonly hihatFilterFreq: number;
  };
  readonly bass: {
    readonly gain: number;
    readonly filterFreq: number;
    readonly filterQ: number;
    readonly durationRatio: number;
    /** 16스텝(2마디 8비트) 베이스 주파수 시퀀스 (E2, G2, A2 록 그루브) */
    readonly patternNotes: readonly number[];
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

/**
 * 기본 스테이지 실시간 BGM 오디오 파라미터 (Issue #305)
 * E2 = 82.41Hz, G2 = 98.00Hz, A2 = 110.00Hz, B2 = 123.47Hz
 */
export const DEFAULT_BGM_AUDIO_CONFIG: BGMAudioConfig = Object.freeze({
  bpm: 120,
  masterVolume: 0.32,
  drum: Object.freeze({
    kickGain: 0.40,
    snareGain: 0.30,
    hihatGain: 0.18,
    kickStartFreq: 130,
    kickEndFreq: 42,
    kickDuration: 0.18,
    snareDuration: 0.16,
    snareToneFreq: 160,
    hihatDuration: 0.05,
    hihatFilterFreq: 7500,
  }),
  bass: Object.freeze({
    gain: 0.28,
    filterFreq: 650,
    filterQ: 2.5,
    durationRatio: 0.75, // 8분음표 길이 대비 75% 연주 (자연스러운 핑거링 스타카토)
    patternNotes: Object.freeze([
      82.41, 82.41, 82.41, 82.41, 98.00, 98.00, 110.00, 110.00, // Bar 1: E E E E G G A A
      82.41, 82.41, 82.41, 82.41, 110.00, 110.00, 98.00, 98.00, // Bar 2: E E E E A A G G
    ]),
  }),
});
