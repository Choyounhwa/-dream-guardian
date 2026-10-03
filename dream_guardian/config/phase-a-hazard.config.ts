export type PhaseAHazardPattern =
  | 'left_step'
  | 'right_step'
  | 'jump'
  | 'balance_left'
  | 'balance_right';

export const PHASE_A_ACTIVE_HAZARD_PATTERNS: readonly PhaseAHazardPattern[] = [
  'left_step',
  'right_step',
  'jump',
];

export interface PhaseAHazardConfig {
  secondsPerBeat: number;
  damagePerMiss: number;
  pattern: readonly PhaseAHazardPattern[];
  totalDuration?: number;
  judgmentTime?: number;
  warningDuration?: number;
  inputWindowEnd?: number;
}

export const DEFAULT_PHASE_A_HAZARD_PATTERN: readonly PhaseAHazardPattern[] =
  PHASE_A_ACTIVE_HAZARD_PATTERNS;

export const DEFAULT_PHASE_A_HAZARD_CONFIG: PhaseAHazardConfig = {
  secondsPerBeat: 0.5,
  damagePerMiss: 25,
  pattern: PHASE_A_ACTIVE_HAZARD_PATTERNS,
  totalDuration: 4.0,
  judgmentTime: 3.5,
  warningDuration: 2.6,
  inputWindowEnd: 3.4,
};

/** BPM120 초 단위 일정을 박 비율로 환산한 뒤 주입된 secondsPerBeat로 스케일한다. */
export function scaleHazardSchedule(
  config: PhaseAHazardConfig,
  secondsPerBeat: number,
): PhaseAHazardConfig {
  const base = DEFAULT_PHASE_A_HAZARD_CONFIG.secondsPerBeat;
  const ratio = secondsPerBeat / base;
  return {
    ...config,
    secondsPerBeat,
    warningDuration: (config.warningDuration ?? DEFAULT_PHASE_A_HAZARD_CONFIG.warningDuration ?? 0) * ratio,
    inputWindowEnd: (config.inputWindowEnd ?? DEFAULT_PHASE_A_HAZARD_CONFIG.inputWindowEnd ?? 0) * ratio,
    judgmentTime: (config.judgmentTime ?? DEFAULT_PHASE_A_HAZARD_CONFIG.judgmentTime ?? 0) * ratio,
    totalDuration: (config.totalDuration ?? DEFAULT_PHASE_A_HAZARD_CONFIG.totalDuration ?? 0) * ratio,
  };
}
