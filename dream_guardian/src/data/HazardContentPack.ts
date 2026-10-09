export const HAZARD_CONTENT_PACK_VERSION = '1.0.0';

export const PHASE_A_PACK_PATTERNS = ['left_step', 'right_step', 'jump'] as const;
export const PHASE_B_PACK_ATTACKS = [
  'dual_slam',
  'alternating_stomp_left',
  'alternating_stomp_right',
] as const;

export type PhaseAPackPattern = (typeof PHASE_A_PACK_PATTERNS)[number];
export type PhaseBPackAttack = (typeof PHASE_B_PACK_ATTACKS)[number];
export type PhaseBRequiredAction = 'jump' | 'left_step' | 'right_step';

export interface HazardVisual {
  lane?: 'left' | 'right' | 'center';
  color: string;
  shape: 'lane' | 'shockwave' | 'stomp';
}

export interface PhaseAHazardChart {
  id: string;
  pattern: PhaseAPackPattern;
  warningStart: number;
  inputStart: number;
  inputEnd: number;
  judgmentTime: number;
  resolveTime: number;
  damage: number;
  visual: HazardVisual;
}

export interface PhaseBHazardChart {
  id: string;
  attackType: PhaseBPackAttack;
  requiredAction: PhaseBRequiredAction;
  warningDuration: number;
  activeDuration: number;
  damage: number;
  minionLoss: number;
  visual: HazardVisual;
}

export interface HazardContentPack {
  version: string;
  id: string;
  bpm: number;
  secondsPerBeat: number;
  phases: {
    HAZARD_EVADE: { charts: PhaseAHazardChart[] };
    BOSS_CLIMAX: { charts: PhaseBHazardChart[] };
  };
}

export interface HazardPackValidation {
  ok: boolean;
  errors: string[];
  pack?: HazardContentPack;
}

const PHASE_A_DAMAGE_CAP = 25;
const PHASE_B_DAMAGE_CAP = 15;
const REQUIRED_ACTION: Record<PhaseBPackAttack, PhaseBRequiredAction> = {
  dual_slam: 'jump',
  alternating_stomp_left: 'left_step',
  alternating_stomp_right: 'right_step',
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

export function validateHazardContentPack(input: unknown): HazardPackValidation {
  const errors: string[] = [];
  if (!isRecord(input) || !isRecord(input.phases)) {
    return { ok: false, errors: ['pack.phases is required'] };
  }

  const phases = input.phases;
  const evade = isRecord(phases.HAZARD_EVADE) ? phases.HAZARD_EVADE.charts : undefined;
  const boss = isRecord(phases.BOSS_CLIMAX) ? phases.BOSS_CLIMAX.charts : undefined;
  if (!Array.isArray(evade) || !Array.isArray(boss)) {
    return { ok: false, errors: ['charts arrays are required'] };
  }

  const seen = new Set<string>();
  evade.forEach((chart, index) => validatePhaseA(chart, index, seen, errors));
  boss.forEach((chart, index) => validatePhaseB(chart, index, seen, errors));

  if (input.version !== HAZARD_CONTENT_PACK_VERSION) {
    errors.push(`version must be ${HAZARD_CONTENT_PACK_VERSION}`);
  }

  return errors.length === 0
    ? { ok: true, errors, pack: input as unknown as HazardContentPack }
    : { ok: false, errors };
}

function validatePhaseA(
  chart: unknown,
  index: number,
  seen: Set<string>,
  errors: string[],
): void {
  if (!isRecord(chart)) {
    errors.push(`HAZARD_EVADE[${index}] must be an object`);
    return;
  }
  const where = `HAZARD_EVADE[${index}]`;
  trackId(chart.id, where, seen, errors);
  if (!PHASE_A_PACK_PATTERNS.includes(chart.pattern as PhaseAPackPattern)) {
    errors.push(`${where}.pattern is not an active Phase A pattern`);
  }
  if (chart.warningStart !== 0 || chart.inputStart !== 2.6 || chart.inputEnd !== 3.4) {
    errors.push(`${where} warning/input window must stay 0 / 2.6 / 3.4`);
  }
  if (chart.judgmentTime !== 3.5) {
    errors.push(`${where}.judgmentTime must be 3.5`);
  }
  if (chart.resolveTime !== 4.0) {
    errors.push(`${where}.resolveTime must be 4.0`);
  }
  if (typeof chart.damage !== 'number' || chart.damage < 0 || chart.damage > PHASE_A_DAMAGE_CAP) {
    errors.push(`${where}.damage exceeds cap ${PHASE_A_DAMAGE_CAP}`);
  }
}

function validatePhaseB(
  chart: unknown,
  index: number,
  seen: Set<string>,
  errors: string[],
): void {
  if (!isRecord(chart)) {
    errors.push(`BOSS_CLIMAX[${index}] must be an object`);
    return;
  }
  const where = `BOSS_CLIMAX[${index}]`;
  trackId(chart.id, where, seen, errors);
  if (!PHASE_B_PACK_ATTACKS.includes(chart.attackType as PhaseBPackAttack)) {
    errors.push(`${where}.attackType is not a live boss attack`);
  } else if (chart.requiredAction !== REQUIRED_ACTION[chart.attackType as PhaseBPackAttack]) {
    errors.push(`${where}.requiredAction does not match attackType`);
  }
  if (typeof chart.damage !== 'number' || chart.damage < 0 || chart.damage > PHASE_B_DAMAGE_CAP) {
    errors.push(`${where}.damage exceeds cap ${PHASE_B_DAMAGE_CAP}`);
  }
  if (typeof chart.warningDuration !== 'number' || chart.warningDuration <= 0) {
    errors.push(`${where}.warningDuration must be > 0`);
  }
  if (typeof chart.activeDuration !== 'number' || chart.activeDuration <= 0) {
    errors.push(`${where}.activeDuration must be > 0`);
  }
}

function trackId(id: unknown, where: string, seen: Set<string>, errors: string[]): void {
  if (typeof id !== 'string' || id.length === 0) {
    errors.push(`${where}.id is required`);
    return;
  }
  if (seen.has(id)) errors.push(`${where}.id duplicate ${id}`);
  seen.add(id);
}
