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
