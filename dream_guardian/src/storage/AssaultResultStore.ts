import type { AssaultGameMode, SessionId } from '../types/assault.js';
import type { AssaultRoundSummaryData } from '../game/assault/AssaultRoundSummary.js';
import {
  planAssaultRoundReward,
  requestAssaultRoundReward,
  type AssaultRewardPlan,
  type AssaultRewardRequestResult,
} from '../game/assault/AssaultRewardPolicy.js';
import { DEFAULT_ASSAULT_REWARD_CONFIG } from '../../config/assault-reward.config.js';
import { deepFreeze } from '../utils/deepFreeze.js';

export const ASSAULT_RESULT_STORAGE_KEY = 'dream_guardian_boss_assault_results_v1';

export interface AssaultComparisonIdentity {
  readonly mode: AssaultGameMode;
  readonly rulesVersion: string;
  readonly profileId: string;
  readonly difficultyId: string;
  readonly tempoBpm: number;
  readonly plannedAnswerOpportunities: number;
  readonly inputProfileId: string;
  readonly accessibilityProfileId: string;
  readonly questionFormat: 'numeric';
  readonly roundSourceKind: 'numeric_repeat';
  readonly challengeFamilies: readonly [];
  readonly challengeRulesVersion: null;
}

export interface AssaultStoredSessionResult {
  readonly sessionId: SessionId;
  readonly identity: AssaultComparisonIdentity;
  readonly rounds: readonly AssaultRoundSummaryData[];
  readonly rewardEvaluations: readonly {
    readonly plan: AssaultRewardPlan;
    readonly evaluation: AssaultRewardRequestResult;
  }[];
}

/** A storage acknowledgement only, never a reward payout receipt. */
export interface AssaultResultStorageReceipt {
  readonly schemaVersion: 1;
  readonly status: 'stored';
  readonly result: AssaultStoredSessionResult;
}

export interface AssaultResultStoreError {
  readonly status: 'error';
  readonly code: 'invalid-result' | 'corrupt-data' | 'unsupported-schema' |
    'storage-read-failed' | 'storage-write-failed' | 'conflict';
}

export type AssaultResultSaveResult =
  | { readonly status: 'stored'; readonly receipt: AssaultResultStorageReceipt }
  | { readonly status: 'skipped'; readonly reason: 'test-session' | 'recording-disabled' }
  | AssaultResultStoreError;

export type AssaultResultLoadResult =
  | { readonly status: 'found'; readonly receipt: AssaultResultStorageReceipt }
  | { readonly status: 'missing' }
  | AssaultResultStoreError;

export interface AssaultResultSaveOptions {
  readonly isTestSession: boolean;
  readonly recordResults?: boolean;
}

export interface AssaultResultStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

const identityTextKeys = [
  'rulesVersion', 'profileId', 'difficultyId', 'inputProfileId', 'accessibilityProfileId',
] as const;
const identityKeys = [
  ...identityTextKeys, 'mode', 'tempoBpm', 'plannedAnswerOpportunities',
  'questionFormat', 'roundSourceKind', 'challengeFamilies', 'challengeRulesVersion',
] as const;
const countKeys = [
  'completedQuestions', 'correctCount', 'wrongCount', 'timeoutCount', 'evadeSuccessCount',
  'squatFailCount', 'totalEncounters', 'attemptedAnswerHits', 'maxCombo', 'endCombo',
] as const;
const measuredKeys = [
  'totalPlayerDamage', 'totalBossDamage', 'totalActualDamage', 'actualDamage',
  'totalRequestedDamage', 'activeDurationSeconds',
] as const;
const ratingKeys = ['Perfect', 'Good', 'Late', 'Miss'] as const;
const roundKeys = [
  ...countKeys, ...measuredKeys, 'sessionId', 'roundId', 'isAborted', 'isDefeated',
  'ratingCounts', 'processedAttackIds', 'processedReceiptIds',
] as const;

function object(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function keys(value: Record<string, unknown>, expected: readonly string[]): boolean {
  return Object.keys(value).length === expected.length &&
    expected.every(key => Object.prototype.hasOwnProperty.call(value, key));
}

function text(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function nonnegative(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0;
}

function count(value: unknown): value is number {
  return nonnegative(value) && Number.isSafeInteger(value);
}

function uniqueIds(value: unknown): value is string[] {
  return Array.isArray(value) && value.every(text) && new Set(value).size === value.length;
}

function validIdentity(value: unknown): value is AssaultComparisonIdentity {
  return object(value) && keys(value, identityKeys) && identityTextKeys.every(key => text(value[key])) &&
    value.mode === 'boss_assault' && nonnegative(value.tempoBpm) && value.tempoBpm > 0 &&
    count(value.plannedAnswerOpportunities) && value.questionFormat === 'numeric' &&
    value.roundSourceKind === 'numeric_repeat' && Array.isArray(value.challengeFamilies) &&
    value.challengeFamilies.length === 0 && value.challengeRulesVersion === null;
}

// Property order is irrelevant; array order and every explicit field remain significant.
function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (object(value)) {
    return `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${canonical(value[key])}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

export function haveSameAssaultComparisonIdentity(left: unknown, right: unknown): boolean {
  return validIdentity(left) && validIdentity(right) && canonical(left) === canonical(right);
}

function validRound(value: unknown, sessionId: string): value is AssaultRoundSummaryData {
  if (!object(value) || !keys(value, roundKeys) || value.sessionId !== sessionId || !text(value.roundId) ||
    !countKeys.every(key => count(value[key])) || !measuredKeys.every(key => nonnegative(value[key])) ||
    typeof value.isAborted !== 'boolean' || typeof value.isDefeated !== 'boolean' ||
    !object(value.ratingCounts) || !keys(value.ratingCounts, ratingKeys) ||
    !ratingKeys.every(key => count((value.ratingCounts as Record<string, unknown>)[key])) ||
    !uniqueIds(value.processedAttackIds) || !uniqueIds(value.processedReceiptIds)) return false;

  const round = value as unknown as AssaultRoundSummaryData;
  return round.completedQuestions === (round.isAborted ? 0 : 1) &&
    (!round.isDefeated || round.isAborted) &&
    round.attemptedAnswerHits === round.correctCount + round.wrongCount + round.timeoutCount &&
    round.totalEncounters === round.attemptedAnswerHits + round.evadeSuccessCount + round.squatFailCount &&
    round.processedAttackIds.length === round.totalEncounters &&
    ratingKeys.reduce((sum, key) => sum + round.ratingCounts[key], 0) <= round.totalEncounters &&
    round.endCombo <= round.maxCombo &&
    round.actualDamage === round.totalPlayerDamage &&
    round.totalActualDamage === round.totalPlayerDamage + round.totalBossDamage &&
    round.totalRequestedDamage >= round.totalActualDamage;
}

function validResult(value: unknown): value is AssaultStoredSessionResult {
  if (!object(value) || !keys(value, ['sessionId', 'identity', 'rounds', 'rewardEvaluations']) ||
    !text(value.sessionId) || !validIdentity(value.identity) ||
    !Array.isArray(value.rounds) || value.rounds.length === 0 ||
    !Array.isArray(value.rewardEvaluations) || value.rounds.length !== value.rewardEvaluations.length) return false;
  const rounds: AssaultRoundSummaryData[] = [];
  for (const round of value.rounds) {
    if (!validRound(round, value.sessionId)) return false;
    rounds.push(round);
  }
  if (new Set(rounds.map(round => round.roundId)).size !== rounds.length ||
    rounds.reduce((sum, round) => sum + round.attemptedAnswerHits, 0) > value.identity.plannedAnswerOpportunities) return false;

  let processedKeys: readonly string[] = [];
  for (let index = 0; index < rounds.length; index++) {
    const entry: unknown = value.rewardEvaluations[index];
    if (!object(entry) || !keys(entry, ['plan', 'evaluation'])) return false;
    // Reuse #534 as the authority for disabled commands and evaluation history.
    const plan = planAssaultRoundReward(rounds[index], DEFAULT_ASSAULT_REWARD_CONFIG);
    const evaluation = requestAssaultRoundReward(plan, processedKeys);
    if (canonical(entry.plan) !== canonical(plan) || canonical(entry.evaluation) !== canonical(evaluation)) return false;
    processedKeys = evaluation.processedKeys;
  }
  return true;
}

function error(code: AssaultResultStoreError['code']): AssaultResultStoreError {
  return deepFreeze<AssaultResultStoreError>({ status: 'error', code });
}

type ReadResult = { readonly status: 'loaded'; readonly receipts: AssaultResultStorageReceipt[] } |
  AssaultResultStoreError;

export class AssaultResultStore {
  constructor(private readonly storage: AssaultResultStorage) {}

  private read(): ReadResult {
    let raw: string | null;
    try {
      raw = this.storage.getItem(ASSAULT_RESULT_STORAGE_KEY);
    } catch {
      return error('storage-read-failed');
    }
    if (raw === null) return { status: 'loaded', receipts: [] };
    try {
      const data: unknown = JSON.parse(raw);
      if (!object(data) || !Object.prototype.hasOwnProperty.call(data, 'schemaVersion')) return error('corrupt-data');
      if (data.schemaVersion !== 1) return error('unsupported-schema');
      if (!keys(data, ['schemaVersion', 'receipts']) || !Array.isArray(data.receipts)) return error('corrupt-data');
      const receipts: AssaultResultStorageReceipt[] = [];
      const sessions = new Set<string>();
      for (const receipt of data.receipts as unknown[]) {
        if (!object(receipt) || !keys(receipt, ['schemaVersion', 'status', 'result']) ||
          receipt.schemaVersion !== 1 || receipt.status !== 'stored' || !validResult(receipt.result) ||
          sessions.has(receipt.result.sessionId)) return error('corrupt-data');
        sessions.add(receipt.result.sessionId);
        receipts.push(deepFreeze({ schemaVersion: 1, status: 'stored', result: receipt.result } as const));
      }
      return { status: 'loaded', receipts };
    } catch {
      return error('corrupt-data');
    }
  }

  save(input: unknown, options?: AssaultResultSaveOptions): AssaultResultSaveResult {
    if (options?.isTestSession === true) {
      return deepFreeze({ status: 'skipped', reason: 'test-session' } as const);
    }
    if (options?.recordResults !== true) {
      return deepFreeze({ status: 'skipped', reason: 'recording-disabled' } as const);
    }
    if (options.isTestSession !== false) return error('invalid-result');
    let result: AssaultStoredSessionResult;
    try {
      if (!validResult(input)) return error('invalid-result');
      result = JSON.parse(JSON.stringify(input)) as AssaultStoredSessionResult;
      if (!validResult(result) || canonical(input) !== canonical(result)) return error('invalid-result');
    } catch {
      return error('invalid-result');
    }
    const previous = this.read();
    if (previous.status === 'error') return previous;
    const existing = previous.receipts.find(receipt => receipt.result.sessionId === result.sessionId);
    if (existing) {
      return canonical(existing.result) === canonical(result)
        ? deepFreeze({ status: 'stored', receipt: existing } as const)
        : error('conflict');
    }
    const receipt: AssaultResultStorageReceipt = deepFreeze({ schemaVersion: 1, status: 'stored', result } as const);
    try {
      // One namespace write keeps the result and its no-reward history together.
      this.storage.setItem(ASSAULT_RESULT_STORAGE_KEY, JSON.stringify({
        schemaVersion: 1, receipts: [...previous.receipts, receipt],
      }));
    } catch {
      return error('storage-write-failed');
    }
    return deepFreeze({ status: 'stored', receipt } as const);
  }

  load(sessionId: SessionId): AssaultResultLoadResult {
    if (!text(sessionId)) return error('invalid-result');
    const previous = this.read();
    if (previous.status === 'error') return previous;
    const receipt = previous.receipts.find(item => item.result.sessionId === sessionId);
    return receipt ? deepFreeze({ status: 'found', receipt } as const) : deepFreeze({ status: 'missing' } as const);
  }
}
