/**
 * ContentTiming.ts - V2 피트니스 안무 및 타임라인 시간 모델 및 검증
 *
 * Issue #376 / EDITOR-CAPABILITY:
 * - Phase A: 가변 BPM 착지 스케일링 vs 고정 초 단위 판정창 (Perfect ±0.12s, Good ±0.25s, Late ±0.40s)
 * - 8박 분기 내 마지막 별노트 판정창 만료 검증 (160 BPM 등 초과 시 거부)
 * - Phase A 장판: 박자 기반 스케일링 (5.2 / 6.8 / 7.0 / 8.0 박자)
 * - Phase B 장판: 고정 초 단위 공격 (경고 1.5s, 판정 1.0s, 주기 5.0s, 피해량 15)
 */

import {
  DEFAULT_STAR_TIMING_WINDOWS,
  type StarTimingWindows,
} from '../../config/beat-motion.config.js';
import { DEFAULT_PHASE_A_HAZARD_CONFIG } from '../../config/phase-a-hazard.config.js';
import { DEFAULT_BOSS_HAZARD_CONFIG } from '../../config/battle.config.js';
import {
  PHASE_A_STAR_SLOT_COUNT,
  PHASE_A_STAR_LANDING_BEATS,
  PHASE_A_STAR_LANDING_TICKS,
  PHASE_A_TOTAL_BEATS,
  secondsPerBeat,
} from './ContentCapabilities.js';

export const PHASE_A_HAZARD_BEAT_TIMINGS = {
  warningStart: 0,
  inputStart: 5.2,
  inputEnd: 6.8,
  judgmentTime: 7.0,
  totalDuration: 8.0,
} as const;

export const DEFAULT_PHASE_B_HAZARD_SECONDS = {
  warningDuration: DEFAULT_BOSS_HAZARD_CONFIG.warningDuration, // 1.5s
  activeDuration: DEFAULT_BOSS_HAZARD_CONFIG.activeDuration,   // 1.0s
  attackInterval: DEFAULT_BOSS_HAZARD_CONFIG.attackInterval,   // 5.0s
  damage: DEFAULT_BOSS_HAZARD_CONFIG.damage,                   // 15
  minionCasualtyCount: DEFAULT_BOSS_HAZARD_CONFIG.minionCasualtyCount, // 1
} as const;

export interface ScheduledStarNoteTiming {
  slotIndex: number;
  beat: number;
  tick: number;
  landingTimeSeconds: number;
  windowStartSeconds: number;
  windowEndSeconds: number;
}

export interface StarNoteTimingPlan {
  bpm: number;
  secondsPerBeat: number;
  totalDurationSeconds: number;
  completeAtSeconds: number;
  timingWindows: StarTimingWindows;
  notes: ScheduledStarNoteTiming[];
  valid: boolean;
  error?: string;
}

export interface StarTimingValidationResult {
  valid: boolean;
  lastLandingSeconds: number;
  completeAtSeconds: number;
  branchDurationSeconds: number;
  error?: string;
}

export interface PhaseAHazardTimingPlan {
  bpm: number;
  secondsPerBeat: number;
  warningStartSeconds: number;
  inputStartSeconds: number;
  inputEndSeconds: number;
  judgmentSeconds: number;
  totalDurationSeconds: number;
  damage: number;
}

export interface PhaseBHazardTimingPlan {
  warningDuration: number;
  activeDuration: number;
  attackInterval: number;
  damage: number;
  minionCasualtyCount: number;
}

/**
 * 8박 분기 내에서 별노트 판정창이 분기 종료 이전에 만료되는지 검증
 * - 마지막(7번째) 노트 착지: 7 * secondsPerBeat
 * - 최종 만료 시점: 7 * secondsPerBeat + lateWindow
 * - 분기 총 시간: 8 * secondsPerBeat
 * - 조건: completeAt <= branchDuration (즉 lateWindow <= secondsPerBeat)
 */
export function validateStarTimingWithinBranch(
  bpm: number,
  timingWindows?: Partial<StarTimingWindows>,
): StarTimingValidationResult {
  const spb = 60 / bpm;
  const windows: StarTimingWindows = {
    ...DEFAULT_STAR_TIMING_WINDOWS,
    ...timingWindows,
  };
  const lastLandingSeconds = PHASE_A_STAR_SLOT_COUNT * spb;
  const completeAtSeconds = lastLandingSeconds + windows.late;
  const branchDurationSeconds = PHASE_A_TOTAL_BEATS * spb;
  const valid = completeAtSeconds <= branchDurationSeconds;

  let error: string | undefined;
  if (!valid) {
    error = `Last star note judgment window (${completeAtSeconds.toFixed(3)}s) exceeds branch duration (${branchDurationSeconds.toFixed(3)}s) at BPM ${bpm}.`;
  }

  return {
    valid,
    lastLandingSeconds,
    completeAtSeconds,
    branchDurationSeconds,
    error,
  };
}

/**
 * 주어진 BPM에서 7개 별노트의 착지 일정 및 판정창 타임라인 산출
 */
export function calculateStarNoteTimings(
  bpm: number,
  timingWindows?: Partial<StarTimingWindows>,
): StarNoteTimingPlan {
  const spb = secondsPerBeat(bpm);
  const windows: StarTimingWindows = {
    ...DEFAULT_STAR_TIMING_WINDOWS,
    ...timingWindows,
  };
  const totalDurationSeconds = PHASE_A_TOTAL_BEATS * spb;

  const notes: ScheduledStarNoteTiming[] = [];
  for (let i = 0; i < PHASE_A_STAR_SLOT_COUNT; i++) {
    const landingTimeSeconds = (i + 1) * spb;
    notes.push({
      slotIndex: i,
      beat: PHASE_A_STAR_LANDING_BEATS[i],
      tick: PHASE_A_STAR_LANDING_TICKS[i],
      landingTimeSeconds,
      windowStartSeconds: Math.max(0, landingTimeSeconds - windows.late),
      windowEndSeconds: landingTimeSeconds + windows.late,
    });
  }

  const completeAtSeconds = (PHASE_A_STAR_SLOT_COUNT * spb) + windows.late;
  const validation = validateStarTimingWithinBranch(bpm, windows);

  return {
    bpm,
    secondsPerBeat: spb,
    totalDurationSeconds,
    completeAtSeconds,
    timingWindows: windows,
    notes,
    valid: validation.valid,
    error: validation.error,
  };
}

/**
 * Phase A 장판 타임라인 산출 (BPM 비례 박자 스케일링)
 */
export function calculatePhaseAHazardTiming(bpm: number): PhaseAHazardTimingPlan {
  const spb = secondsPerBeat(bpm);
  return {
    bpm,
    secondsPerBeat: spb,
    warningStartSeconds: PHASE_A_HAZARD_BEAT_TIMINGS.warningStart * spb,
    inputStartSeconds: PHASE_A_HAZARD_BEAT_TIMINGS.inputStart * spb,
    inputEndSeconds: PHASE_A_HAZARD_BEAT_TIMINGS.inputEnd * spb,
    judgmentSeconds: PHASE_A_HAZARD_BEAT_TIMINGS.judgmentTime * spb,
    totalDurationSeconds: PHASE_A_HAZARD_BEAT_TIMINGS.totalDuration * spb,
    damage: DEFAULT_PHASE_A_HAZARD_CONFIG.damagePerMiss,
  };
}

/**
 * Phase B 장판 타임라인 반환 (고정 초 단위)
 */
export function getPhaseBHazardTiming(): PhaseBHazardTimingPlan {
  return {
    warningDuration: DEFAULT_PHASE_B_HAZARD_SECONDS.warningDuration,
    activeDuration: DEFAULT_PHASE_B_HAZARD_SECONDS.activeDuration,
    attackInterval: DEFAULT_PHASE_B_HAZARD_SECONDS.attackInterval,
    damage: DEFAULT_PHASE_B_HAZARD_SECONDS.damage,
    minionCasualtyCount: DEFAULT_PHASE_B_HAZARD_SECONDS.minionCasualtyCount,
  };
}
