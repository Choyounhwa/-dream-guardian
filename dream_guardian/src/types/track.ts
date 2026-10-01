/**
 * track.ts - 음악 트랙 및 가변 박자 루프 패턴 타입 정의
 *
 * @see Issue #204 [BEAT-TRACK-001]
 */

export interface LoopPattern {
  /** 라운드당 요구되는 유효 운동 박자 수 (예: 8) */
  exerciseBeats: number;
  /** 정답 선택 또는 대기 박자 수 (예: 2, 4) */
  readyBeats: number;
  /** 키노트 연주 또는 분기 루틴 박자 수 (예: 8) */
  performanceBeats: number;
}

export interface TrackIntroConfig {
  /** 예비박(Count-in) 박자 수 (기본 3) */
  countInBeats: number;
  /** 예비박 사운드 타입 */
  soundType: 'metronome' | 'hihat' | 'voice';
}

export interface MusicTrackConfig {
  /** 트랙 식별자 (선택) */
  id?: string;
  /** 트랙 명칭 (선택) */
  name?: string;
  /** 분당 비트 수 (BPM) */
  bpm: number;
  /** 박자표 (예: [4, 4]) */
  timeSignature?: [number, number];
  /** 예비박 도입 설정 */
  intro?: TrackIntroConfig;
  /** 가변 루프 패턴 */
  loopPattern?: LoopPattern;
}
