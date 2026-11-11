import { describe, expect, it, vi } from 'vitest';
import {
  AssaultResultStore,
  ASSAULT_RESULT_STORAGE_KEY,
  haveSameAssaultComparisonIdentity,
  type AssaultStoredSessionResult,
} from '../../src/storage/AssaultResultStore.js';
import { createAssaultRoundSummary } from '../../src/game/assault/AssaultRoundSummary.js';
import { planAssaultRoundReward, requestAssaultRoundReward } from '../../src/game/assault/AssaultRewardPolicy.js';
import { DEFAULT_ASSAULT_REWARD_CONFIG } from '../../config/assault-reward.config.js';

function fixture(sessionId = 'session-1'): AssaultStoredSessionResult {
  const summary = createAssaultRoundSummary({
    sessionId, roundId: 'round-1', activeDurationSeconds: 12.5,
    encounters: [{ attackId: 'attack-1', isCorrect: true, rating: 'Perfect' }],
  });
  const plan = planAssaultRoundReward(summary, DEFAULT_ASSAULT_REWARD_CONFIG);
  return {
    sessionId,
    identity: {
      mode: 'boss_assault', rulesVersion: 'v0.3', profileId: 'mvp',
      difficultyId: 'level-1', tempoBpm: 100, plannedAnswerOpportunities: 4,
      inputProfileId: 'keyboard', accessibilityProfileId: 'standard',
      questionFormat: 'numeric', roundSourceKind: 'numeric_repeat',
      challengeFamilies: [], challengeRulesVersion: null,
    },
    rounds: [summary],
    rewardEvaluations: [{ plan, evaluation: requestAssaultRoundReward(plan, []) }],
  };
}

function fakeStorage() {
  const data = new Map<string, string>([['legacy-record', 'keep'], ['growth', 'keep']]);
  return {
    data,
    getItem: vi.fn((key: string) => data.get(key) ?? null),
    setItem: vi.fn((key: string, value: string) => { data.set(key, value); }),
  };
}
const options = { isTestSession: false, recordResults: true };
const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value));

describe('#535 isolated result storage', () => {
  it('round trips measured DTOs and empty reward evaluations under only the approved key', () => {
    const storage = fakeStorage();
    const store = new AssaultResultStore(storage);
    const input = fixture();
    const before = JSON.stringify(input);
    const saved = store.save(input, options);
    expect(ASSAULT_RESULT_STORAGE_KEY).toBe('dream_guardian_boss_assault_results_v1');
    expect(saved.status).toBe('stored');
    if (saved.status !== 'stored') throw new Error('not stored');
    expect(saved.receipt).toEqual({ schemaVersion: 1, status: 'stored', result: input });
    expect(store.load(input.sessionId)).toEqual({ status: 'found', receipt: saved.receipt });
    expect(JSON.parse(storage.data.get(ASSAULT_RESULT_STORAGE_KEY)!)).toEqual({
      schemaVersion: 1, receipts: [saved.receipt],
    });
    expect(JSON.stringify(input)).toBe(before);
    expect(Object.isFrozen(input)).toBe(false);
    expect(Object.isFrozen(saved.receipt.result.identity.challengeFamilies)).toBe(true);
    expect(Object.isFrozen(saved.receipt.result.rounds[0].ratingCounts)).toBe(true);
    expect(storage.data.get('legacy-record')).toBe('keep');
    expect(storage.data.get('growth')).toBe('keep');
    expect(storage.getItem.mock.calls.every(([key]) => key === ASSAULT_RESULT_STORAGE_KEY)).toBe(true);
    expect(storage.setItem).toHaveBeenCalledExactlyOnceWith(ASSAULT_RESULT_STORAGE_KEY, expect.any(String));
  });

  it.each([undefined, {}, { isTestSession: false }, { isTestSession: false, recordResults: false },
    { isTestSession: true, recordResults: true }])('skips without any IO for options %j', (opts) => {
    const storage = fakeStorage();
    const result = new AssaultResultStore(storage).save(null, opts as typeof options);
    expect(result.status).toBe('skipped');
    expect(storage.getItem).not.toHaveBeenCalled();
    expect(storage.setItem).not.toHaveBeenCalled();
  });

  it('requires an explicit non-test flag when recording', () => {
    expect(new AssaultResultStore(fakeStorage()).save(fixture(), { recordResults: true } as typeof options))
      .toEqual({ status: 'error', code: 'invalid-result' });
  });

  it('retries the same semantic content and returns the original receipt without another write', () => {
    const storage = fakeStorage();
    const input = fixture();
    const first = new AssaultResultStore(storage).save(input, options);
    const reordered = Object.fromEntries(Object.entries(clone(input)).reverse());
    expect(new AssaultResultStore(storage).save(reordered, options)).toEqual(first);
    expect(storage.setItem).toHaveBeenCalledTimes(1);
  });

  it('conflicts for changed content with the same session ID', () => {
    const storage = fakeStorage();
    const store = new AssaultResultStore(storage);
    store.save(fixture(), options);
    const input = clone(fixture());
    (input.identity as any).profileId = 'other';
    expect(store.save(input, options)).toEqual({ status: 'error', code: 'conflict' });
    expect(storage.setItem).toHaveBeenCalledTimes(1);
  });

  it('retains multiple sessions and treats prototype-like IDs as ordinary IDs', () => {
    const storage = fakeStorage();
    const store = new AssaultResultStore(storage);
    for (const id of ['session-1', '__proto__', 'constructor']) {
      expect(store.save(fixture(id), options).status).toBe('stored');
      expect(store.load(id).status).toBe('found');
    }
    expect(JSON.parse(storage.data.get(ASSAULT_RESULT_STORAGE_KEY)!).receipts).toHaveLength(3);
    expect(store.load('absent')).toEqual({ status: 'missing' });
  });

  it('accepts aborted measured summaries without turning them into completed questions', () => {
    const input = fixture();
    (input.rounds as any)[0] = createAssaultRoundSummary({
      sessionId: input.sessionId, roundId: 'round-1', isDefeated: true, activeDurationSeconds: 0,
    });
    const saved = new AssaultResultStore(fakeStorage()).save(input, options);
    expect(saved.status).toBe('stored');
    if (saved.status === 'stored') expect(saved.receipt.result.rounds[0].completedQuestions).toBe(0);
  });

  it('accepts several rounds with the #534 explicit accumulated evaluation history', () => {
    const input = clone(fixture());
    const summary = createAssaultRoundSummary({ sessionId: input.sessionId, roundId: 'round-2' });
    const plan = planAssaultRoundReward(summary, DEFAULT_ASSAULT_REWARD_CONFIG);
    (input.rounds as any).push(summary);
    (input.rewardEvaluations as any).push({ plan, evaluation: requestAssaultRoundReward(
      plan, input.rewardEvaluations[0].evaluation.processedKeys,
    ) });
    expect(new AssaultResultStore(fakeStorage()).save(input, options).status).toBe('stored');
  });

  const identityChanges = {
    mode: 'legacy', rulesVersion: 'v-next', profileId: 'other', difficultyId: 'other',
    tempoBpm: 120, plannedAnswerOpportunities: 5, inputProfileId: 'motion',
    accessibilityProfileId: 'low-impact', questionFormat: 'expression', roundSourceKind: 'challenge',
    challengeFamilies: ['A'], challengeRulesVersion: 'challenge-v1',
  };
  it('compares fully explicit valid identities, not object property order', () => {
    const identity = fixture().identity;
    expect(haveSameAssaultComparisonIdentity(identity, clone(identity))).toBe(true);
    expect(haveSameAssaultComparisonIdentity(identity, Object.fromEntries(Object.entries(identity).reverse()))).toBe(true);
  });
  it.each(Object.entries(identityChanges))('does not compare a changed %s as equivalent', (key, value) => {
    const identity = fixture().identity;
    expect(haveSameAssaultComparisonIdentity(identity, { ...identity, [key]: value })).toBe(false);
  });
  it.each(Object.keys(identityChanges))('rejects missing comparison field %s without inference', (key) => {
    const input = clone(fixture());
    delete (input.identity as any)[key];
    const storage = fakeStorage();
    expect(new AssaultResultStore(storage).save(input, options)).toEqual({ status: 'error', code: 'invalid-result' });
    expect(haveSameAssaultComparisonIdentity(input.identity, input.identity)).toBe(false);
    expect(storage.setItem).not.toHaveBeenCalled();
  });

  const invalidMutations: [string, (input: any) => void][] = [
    ['empty session', x => { x.sessionId = ''; }],
    ['blank identity', x => { x.identity.profileId = ' '; }],
    ['zero tempo', x => { x.identity.tempoBpm = 0; }],
    ['infinite tempo', x => { x.identity.tempoBpm = Infinity; }],
    ['fraction opportunities', x => { x.identity.plannedAnswerOpportunities = 1.5; }],
    ['too few opportunities', x => { x.identity.plannedAnswerOpportunities = 0; }],
    ['challenge', x => { x.identity.roundSourceKind = 'challenge'; }],
    ['format', x => { x.identity.questionFormat = 'expression'; }],
    ['families', x => { x.identity.challengeFamilies = ['A']; }],
    ['challenge version', x => { x.identity.challengeRulesVersion = 'v1'; }],
    ['foreign round session', x => { x.rounds[0].sessionId = 'foreign'; }],
    ['duplicate round', x => { x.rounds.push(x.rounds[0]); }],
    ['missing rounds', x => { x.rounds = []; }],
    ['negative count', x => { x.rounds[0].correctCount = -1; }],
    ['fraction count', x => { x.rounds[0].wrongCount = 0.5; }],
    ['unsafe count', x => { x.rounds[0].maxCombo = Number.MAX_SAFE_INTEGER + 1; }],
    ['count mismatch', x => { x.rounds[0].attemptedAnswerHits = 2; }],
    ['encounter mismatch', x => { x.rounds[0].totalEncounters = 2; }],
    ['rating overflow', x => { x.rounds[0].ratingCounts.Good = 2; }],
    ['combo mismatch', x => { x.rounds[0].endCombo = 2; }],
    ['completed mismatch', x => { x.rounds[0].completedQuestions = 0; }],
    ['defeat without abort', x => { x.rounds[0].isDefeated = true; }],
    ['negative time', x => { x.rounds[0].activeDurationSeconds = -1; }],
    ['NaN time', x => { x.rounds[0].activeDurationSeconds = NaN; }],
    ['infinite damage', x => { x.rounds[0].totalRequestedDamage = Infinity; }],
    ['actual mismatch', x => { x.rounds[0].actualDamage = 1; }],
    ['damage mismatch', x => { x.rounds[0].totalActualDamage = 1; }],
    ['requested below actual', x => {
      Object.assign(x.rounds[0], { actualDamage: 1, totalPlayerDamage: 1, totalActualDamage: 1 });
    }],
    ['duplicate attacks', x => { x.rounds[0].processedAttackIds.push('attack-1'); }],
    ['bad receipt IDs', x => { x.rounds[0].processedReceiptIds = [null]; }],
    ['non-array rounds', x => { x.rounds = {}; }],
    ['null rating', x => { x.rounds[0].ratingCounts = null; }],
    ['missing evaluations', x => { x.rewardEvaluations = []; }],
    ['forged command', x => { x.rewardEvaluations[0].plan.commands = [{ growth: 10 }]; }],
    ['forged evaluation command', x => { x.rewardEvaluations[0].evaluation.commands = [1]; }],
    ['forged paid', x => { x.rewardEvaluations[0].evaluation.status = 'paid'; }],
    ['forged duplicate', x => { x.rewardEvaluations[0].evaluation.status = 'duplicate'; }],
    ['forged key', x => { x.rewardEvaluations[0].evaluation.requestKey = 'fake'; }],
    ['forged history', x => { x.rewardEvaluations[0].evaluation.processedKeys.push('fake'); }],
    ['forged policy', x => { x.rewardEvaluations[0].plan.rewardProfileId = 'active'; }],
    ['extra payout', x => { x.paid = true; }],
    ['extra round metric', x => { x.rounds[0].madeUp = 0; }],
    ['cyclic object', x => { x.loop = x; }],
  ];
  it.each(invalidMutations)('rejects %s before writing', (_label, mutate) => {
    const input = clone(fixture());
    mutate(input);
    const storage = fakeStorage();
    expect(new AssaultResultStore(storage).save(input, options)).toEqual({ status: 'error', code: 'invalid-result' });
    expect(storage.setItem).not.toHaveBeenCalled();
  });
  it.each([null, [], 42, 'result', new Date()])('rejects a non DTO %j', (input) => {
    expect(new AssaultResultStore(fakeStorage()).save(input, options)).toEqual({ status: 'error', code: 'invalid-result' });
  });

  it.each(['{', 'null', '[]', '{}', '{"schemaVersion":1,"receipts":{}}'])
    ('preserves corrupt JSON %s and returns errors on read and write', (raw) => {
      const storage = fakeStorage();
      storage.data.set(ASSAULT_RESULT_STORAGE_KEY, raw);
      const store = new AssaultResultStore(storage);
      expect(store.load('session-1')).toEqual({ status: 'error', code: 'corrupt-data' });
      expect(store.save(fixture(), options)).toEqual({ status: 'error', code: 'corrupt-data' });
      expect(storage.data.get(ASSAULT_RESULT_STORAGE_KEY)).toBe(raw);
      expect(storage.setItem).not.toHaveBeenCalled();
    });
  it('does not migrate an unsupported schema', () => {
    const storage = fakeStorage();
    storage.data.set(ASSAULT_RESULT_STORAGE_KEY, '{"schemaVersion":2,"receipts":[]}');
    const store = new AssaultResultStore(storage);
    expect(store.load('session-1')).toEqual({ status: 'error', code: 'unsupported-schema' });
    expect(store.save(fixture(), options)).toEqual({ status: 'error', code: 'unsupported-schema' });
    expect(storage.setItem).not.toHaveBeenCalled();
  });
  it.each(['duplicate', 'forged', 'invalid-summary', 'invalid-receipt-version'])('rejects stored %s', (kind) => {
    const storage = fakeStorage();
    new AssaultResultStore(storage).save(fixture(), options);
    const envelope = JSON.parse(storage.data.get(ASSAULT_RESULT_STORAGE_KEY)!);
    if (kind === 'duplicate') envelope.receipts.push(envelope.receipts[0]);
    if (kind === 'forged') envelope.receipts[0].status = 'paid';
    if (kind === 'invalid-summary') envelope.receipts[0].result.rounds[0].correctCount = -1;
    if (kind === 'invalid-receipt-version') envelope.receipts[0].schemaVersion = 2;
    storage.data.set(ASSAULT_RESULT_STORAGE_KEY, JSON.stringify(envelope));
    expect(new AssaultResultStore(storage).load('session-1')).toEqual({ status: 'error', code: 'corrupt-data' });
  });
  it('reports read permission failure without writing', () => {
    const storage = fakeStorage();
    storage.getItem.mockImplementation(() => { throw new Error('SecurityError'); });
    const store = new AssaultResultStore(storage);
    expect(store.load('session-1')).toEqual({ status: 'error', code: 'storage-read-failed' });
    expect(store.save(fixture(), options)).toEqual({ status: 'error', code: 'storage-read-failed' });
    expect(storage.setItem).not.toHaveBeenCalled();
  });
  it('returns missing for an empty namespace and validates read IDs', () => {
    const store = new AssaultResultStore(fakeStorage());
    expect(store.load('session-1')).toEqual({ status: 'missing' });
    expect(store.load('')).toEqual({ status: 'error', code: 'invalid-result' });
  });
  it.each([false, true])('retries a write failure, even if a provider writes then throws (%s)', (writeThenThrow) => {
    const storage = fakeStorage();
    const store = new AssaultResultStore(storage);
    storage.setItem.mockImplementationOnce((key, value) => {
      if (writeThenThrow) storage.data.set(key, value);
      throw new Error('QuotaExceededError');
    });
    expect(store.save(fixture(), options)).toEqual({ status: 'error', code: 'storage-write-failed' });
    expect(store.save(fixture(), options).status).toBe('stored');
    expect(JSON.parse(storage.data.get(ASSAULT_RESULT_STORAGE_KEY)!).receipts).toHaveLength(1);
    expect(storage.setItem).toHaveBeenCalledTimes(writeThenThrow ? 1 : 2);
  });
});
