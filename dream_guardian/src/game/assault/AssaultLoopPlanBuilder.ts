/**
 * AssaultLoopPlanBuilder.ts - 시드 및 라운드 번호 기반 36/40박 불변 루프 계획 빌더
 *
 * @see docs/19_BOSS_ASSAULT_LOOP_CARDS.md (DOC-19 §§1~4)
 * @see docs/assault-loop/LOOP-02.md (ASSAULT-LOOP-02 / Issue #695)
 *
 * 절대 규칙:
 * 1. Game 순수 계획 생성 단일 책임: 게임 실행 전에 스쿼트 개수와 위치까지 확정한 불변 계획을 만든다.
 * 2. 결정론적 난수: Mulberry32 (createSeededRng)와 시드+roundNumber를 사용하여 일관성 보장.
 *    Math.random / Date.now 일체 배제.
 * 3. 36/40박 사양 준수:
 *    - run8 1회, answer4 4회, rest2 4회, 마지막 rest2 필수 포함.
 *    - gap 후보 [1, 2, 3] 중 중복 없이 1~2개 선택하여 해당 rest 후 squat4 삽입.
 *    - 총 32 + 4N 박 (N=1일 때 36박, N=2일 때 40박). 120 BPM 기준 18초 또는 20초.
 * 4. 구간(segments)과 전투 조우(encounters) 명확 분리:
 *    - encounters에는 answer_pair 4개와 squat 1~2개만 포함 (run/rest 제외).
 *    - 기존 validateAssaultPlan 및 compileAssaultPlan과 100% 호환.
 * 5. deepFreeze를 통한 불변성 보장.
 */

import {
  DEFAULT_ASSAULT_LOOP_CONFIG,
  calculateLoopTotalBeats,
  calculateLoopTotalSeconds,
  type AssaultLoopConfig,
} from '../../../config/assault-loop.config.js';
import {
  DEFAULT_ASSAULT_BPM,
  compileAssaultPlan,
  type AssaultCompiledPlan,
} from './AssaultPlanCompiler.js';
import { validateAssaultPlan } from './AssaultPlanValidator.js';
import type { AssaultApproachPattern } from '../../data/assault/approachPatterns.js';
import type {
  AssaultLoopRoundPlan,
  AssaultLoopSegmentDef,
  AssaultLoopSquatSubSegmentDef,
} from '../../types/assault-loop.js';
import type {
  AssaultEncounterDef,
  AttackId,
  PairId,
} from '../../types/assault.js';
import {
  createSeededRng,
  nextInt,
  pickOne,
} from '../../utils/seededRng.js';
import { deepFreeze } from '../../utils/deepFreeze.js';

/**
 * 루프 계획 생성 및 검증 오류 클래스
 */
export class AssaultLoopPlanError extends Error {
  constructor(message: string) {
    super(`[AssaultLoopPlanBuilder] ${message}`);
    this.name = 'AssaultLoopPlanError';
  }
}

/**
 * 루프 계획 생성 옵션 인터페이스
 */
export interface AssaultLoopPlanBuildOptions {
  /** 의사난수 시드 (문자열 또는 유한 정수) */
  readonly seed: string | number;
  /** 라운드 번호 (0 이상의 정수) */
  readonly roundNumber: number;
  /** 루프 설정 프로필 (생략 시 DEFAULT_ASSAULT_LOOP_CONFIG) */
  readonly loopConfig?: AssaultLoopConfig;
  /** 라운드 고유 식별자 (생략 시 round_${roundNumber}) */
  readonly roundId?: string;
  /** 진행 BPM (기본값: 120) */
  readonly bpm?: number;
}

/**
 * 시드 값을 결정론적 32비트 부호 없는 정수로 정규화
 */
function normalizeSeed(seed: string | number): number {
  if (typeof seed === 'number') {
    if (!Number.isFinite(seed)) {
      throw new AssaultLoopPlanError(`seed must be a finite number: ${seed}`);
    }
    return Math.floor(seed) >>> 0;
  }
  if (typeof seed === 'string') {
    // FNV-1a 32-bit 해시
    let hash = 2166136261;
    for (let i = 0; i < seed.length; i++) {
      hash ^= seed.charCodeAt(i);
      hash = Math.imul(hash, 16777619);
    }
    return hash >>> 0;
  }
  throw new AssaultLoopPlanError(`Invalid seed type: ${typeof seed}`);
}

/**
 * 박자 -> 초 단위 변환 순수 함수
 */
function beatToSeconds(beat: number, bpm: number): number {
  return (beat * 60) / bpm;
}

/**
 * 루프 계획으로부터 기존 검증/컴파일러 호환용 AssaultApproachPattern 투영
 */
export function projectToApproachPattern(
  plan: AssaultLoopRoundPlan,
  patternId?: string,
): AssaultApproachPattern {
  return {
    schemaVersion: '1.0.0',
    patternId: patternId ?? `pattern_assault_loop_${plan.totalBeats}_r${plan.roundId ?? '1'}`,
    timingProfileId: 'profile_assault_standard',
    balanceProfileId: plan.profileId,
    totalBeats: plan.totalBeats,
    encounters: plan.encounters,
  };
}

/**
 * 루프 계획의 유효성을 엄격하게 사전 검증
 * 박자 연속성, 겹침 없음, 빈틈 없음, 마지막 rest 존재, 총 박자 일치 여부를 검증하며 위반 시 예외 throw
 */
export function validateLoopPlan(
  plan: AssaultLoopRoundPlan,
  loopConfig: AssaultLoopConfig = DEFAULT_ASSAULT_LOOP_CONFIG,
): void {
  if (!plan || typeof plan !== 'object') {
    throw new AssaultLoopPlanError('Plan must be a non-null object');
  }

  const { bpm, totalBeats, totalSeconds, squatCount, squatGapIndices, segments, encounters } = plan;

  if (typeof bpm !== 'number' || !Number.isFinite(bpm) || bpm <= 0) {
    throw new AssaultLoopPlanError(`Invalid BPM: ${bpm}`);
  }

  // 1. 스쿼트 개수 및 gap 후보 검증
  if (squatCount !== squatGapIndices.length) {
    throw new AssaultLoopPlanError(
      `squatCount (${squatCount}) does not match squatGapIndices length (${squatGapIndices.length})`,
    );
  }

  if (squatCount < loopConfig.minSquatsPerRound || squatCount > loopConfig.maxSquatsPerRound) {
    throw new AssaultLoopPlanError(
      `squatCount (${squatCount}) outside range [${loopConfig.minSquatsPerRound}, ${loopConfig.maxSquatsPerRound}]`,
    );
  }

  for (let i = 0; i < squatGapIndices.length; i++) {
    const gap = squatGapIndices[i];
    if (!loopConfig.candidateGaps.includes(gap)) {
      throw new AssaultLoopPlanError(`Invalid gap index: ${gap}`);
    }
    if (i > 0 && gap <= squatGapIndices[i - 1]) {
      throw new AssaultLoopPlanError(
        `squatGapIndices must be strictly ascending: [${squatGapIndices.join(', ')}]`,
      );
    }
  }

  // 2. 총 박자 및 총 시간 검증
  const expectedTotalBeats = calculateLoopTotalBeats(squatCount, loopConfig);
  if (totalBeats !== expectedTotalBeats) {
    throw new AssaultLoopPlanError(
      `totalBeats (${totalBeats}) does not match expected total beats (${expectedTotalBeats})`,
    );
  }

  const expectedTotalSeconds = calculateLoopTotalSeconds(expectedTotalBeats, bpm);
  if (Math.abs(totalSeconds - expectedTotalSeconds) > 0.0001) {
    throw new AssaultLoopPlanError(
      `totalSeconds (${totalSeconds}) does not match expected (${expectedTotalSeconds})`,
    );
  }

  // 3. 구간(Segments) 유효성 및 연속성 검증
  if (!Array.isArray(segments) || segments.length === 0) {
    throw new AssaultLoopPlanError('segments must be a non-empty array');
  }

  const firstSeg = segments[0];
  if (firstSeg.kind !== 'run_question' || firstSeg.startBeat !== 0 || firstSeg.durationBeats !== loopConfig.runBeats) {
    throw new AssaultLoopPlanError(
      `First segment must be run_question of ${loopConfig.runBeats} beats starting at 0`,
    );
  }

  const lastSeg = segments[segments.length - 1];
  if (loopConfig.restBeats > 0) {
    if (lastSeg.kind !== 'rest' || lastSeg.opportunityIndex !== loopConfig.answerOpportunities || lastSeg.endBeat !== totalBeats) {
      throw new AssaultLoopPlanError(
        `Last segment must be final rest (opportunity ${loopConfig.answerOpportunities}) ending at totalBeats (${totalBeats})`,
      );
    }
  } else {
    if (lastSeg.kind !== 'answer' || lastSeg.opportunityIndex !== loopConfig.answerOpportunities || lastSeg.endBeat !== totalBeats) {
      throw new AssaultLoopPlanError(
        `Last segment must be final answer (opportunity ${loopConfig.answerOpportunities}) ending at totalBeats (${totalBeats})`,
      );
    }
  }

  let answerCount = 0;
  let restCount = 0;
  let squatSegCount = 0;

  for (let i = 0; i < segments.length; i++) {
    const seg = segments[i];
    if (seg.segmentIndex !== i) {
      throw new AssaultLoopPlanError(
        `segment[${i}].segmentIndex (${seg.segmentIndex}) does not match index ${i}`,
      );
    }

    const expectedStart = i === 0 ? 0 : segments[i - 1].endBeat;
    if (seg.startBeat !== expectedStart) {
      throw new AssaultLoopPlanError(
        `segment[${i}] startBeat (${seg.startBeat}) does not match previous endBeat (${expectedStart}) - gap or overlap detected`,
      );
    }

    if (seg.endBeat !== seg.startBeat + seg.durationBeats) {
      throw new AssaultLoopPlanError(
        `segment[${i}] endBeat (${seg.endBeat}) !== startBeat (${seg.startBeat}) + durationBeats (${seg.durationBeats})`,
      );
    }

    if (seg.kind === 'answer') answerCount++;
    if (seg.kind === 'rest') restCount++;
    if (seg.kind === 'squat') {
      squatSegCount++;
      if (seg.durationBeats !== loopConfig.squatBeats) {
        throw new AssaultLoopPlanError(
          `squat segment duration (${seg.durationBeats}) must be ${loopConfig.squatBeats}`,
        );
      }
      if (!seg.squatSubSegments || seg.squatSubSegments.length !== 3) {
        throw new AssaultLoopPlanError(`squat segment must have exactly 3 sub-segments`);
      }
      const [notice, dodge, stand] = seg.squatSubSegments;
      if (notice.kind !== 'notice' || dodge.kind !== 'dodge' || stand.kind !== 'stand') {
        throw new AssaultLoopPlanError(`squat sub-segments kind sequence invalid`);
      }
      if (
        notice.durationBeats !== loopConfig.squatSubBeats.notice ||
        dodge.durationBeats !== loopConfig.squatSubBeats.dodge ||
        stand.durationBeats !== loopConfig.squatSubBeats.stand
      ) {
        throw new AssaultLoopPlanError(`squat sub-segments duration beats mismatch`);
      }
    }
  }

  if (answerCount !== loopConfig.answerOpportunities) {
    throw new AssaultLoopPlanError(
      `Expected ${loopConfig.answerOpportunities} answer segments, got ${answerCount}`,
    );
  }
  const expectedRestCount = loopConfig.restBeats > 0 ? loopConfig.answerOpportunities : 0;
  if (restCount !== expectedRestCount) {
    throw new AssaultLoopPlanError(
      `Expected ${expectedRestCount} rest segments, got ${restCount}`,
    );
  }
  if (squatSegCount !== squatCount) {
    throw new AssaultLoopPlanError(
      `Expected ${squatCount} squat segments, got ${squatSegCount}`,
    );
  }

  // 4. 전투 조우(encounters) 목록 검증
  if (!Array.isArray(encounters) || encounters.length !== loopConfig.answerOpportunities + squatCount) {
    throw new AssaultLoopPlanError(
      `Expected ${loopConfig.answerOpportunities + squatCount} encounters, got ${encounters?.length}`,
    );
  }

  for (let i = 0; i < encounters.length; i++) {
    const enc = encounters[i];
    if (enc.kind !== 'answer_pair' && enc.kind !== 'squat') {
      throw new AssaultLoopPlanError(
        `Encounter[${i}] has forbidden kind "${enc.kind}". Only answer_pair and squat allowed.`,
      );
    }
    if (i > 0) {
      const prevEnc = encounters[i - 1];
      if (enc.startBeat < prevEnc.startBeat + prevEnc.durationBeats) {
        throw new AssaultLoopPlanError(
          `Encounter overlap detected between encounter ${i - 1} and ${i}`,
        );
      }
    }
  }

  // 5. 기존 validateAssaultPlan을 통한 최종 스키마/프로필 검증
  const pattern = projectToApproachPattern(plan);
  const result = validateAssaultPlan(pattern);
  if (!result.valid) {
    throw new AssaultLoopPlanError(
      `Underlying validateAssaultPlan failed: ${result.errors.map((e) => e.message).join(', ')}`,
    );
  }
}

/**
 * 36/40박 불변 라운드 루프 계획 생성 순수 함수
 */
export function buildAssaultLoopPlan(
  seedOrOptions: string | number | AssaultLoopPlanBuildOptions,
  optionalRoundNumber?: number,
  optionalConfigOrOptions?: AssaultLoopConfig | Partial<AssaultLoopPlanBuildOptions>,
): Readonly<AssaultLoopRoundPlan<AssaultCompiledPlan>> {
  // 1. 인자 정규화
  let rawSeed: string | number;
  let roundNumber: number;
  let loopConfig: AssaultLoopConfig = DEFAULT_ASSAULT_LOOP_CONFIG;
  let roundId: string | undefined;
  let bpm: number = DEFAULT_ASSAULT_BPM;

  if (typeof seedOrOptions === 'object' && seedOrOptions !== null) {
    rawSeed = seedOrOptions.seed;
    roundNumber = seedOrOptions.roundNumber;
    if (seedOrOptions.loopConfig) loopConfig = seedOrOptions.loopConfig;
    roundId = seedOrOptions.roundId;
    bpm = seedOrOptions.bpm ?? DEFAULT_ASSAULT_BPM;
  } else {
    rawSeed = seedOrOptions;
    if (optionalRoundNumber === undefined) {
      throw new AssaultLoopPlanError('roundNumber is required');
    }
    roundNumber = optionalRoundNumber;
    if (optionalConfigOrOptions) {
      if ('profileId' in optionalConfigOrOptions && 'runBeats' in optionalConfigOrOptions) {
        loopConfig = optionalConfigOrOptions as AssaultLoopConfig;
      } else {
        const opts = optionalConfigOrOptions as Partial<AssaultLoopPlanBuildOptions>;
        if (opts.loopConfig) loopConfig = opts.loopConfig;
        if (opts.roundId) roundId = opts.roundId;
        if (opts.bpm) bpm = opts.bpm;
      }
    }
  }

  // 2. 입력 검증
  if (!Number.isInteger(roundNumber) || roundNumber < 0) {
    throw new AssaultLoopPlanError(
      `roundNumber must be a non-negative integer: ${roundNumber}`,
    );
  }
  if (typeof bpm !== 'number' || !Number.isFinite(bpm) || bpm <= 0) {
    throw new AssaultLoopPlanError(`bpm must be a positive finite number: ${bpm}`);
  }

  const normalizedSeed = normalizeSeed(rawSeed);

  // 3. 시드 + 라운드 번호 기반 결정론적 PRNG 초기화
  // 각 라운드마다 독립적이고 재현 가능한 난수 시퀀스 보장
  const mixedSeed = (normalizedSeed ^ Math.imul(roundNumber, 0x9e3779b9)) >>> 0;
  const rng = createSeededRng(mixedSeed);

  // 4. 스쿼트 개수 및 gap 위치 결정론적 선택
  const squatCount = nextInt(rng, loopConfig.minSquatsPerRound, loopConfig.maxSquatsPerRound);
  const availableGaps = [...loopConfig.candidateGaps];
  const chosenGaps: number[] = [];

  for (let i = 0; i < squatCount; i++) {
    const pickedGap = pickOne(rng, availableGaps);
    chosenGaps.push(pickedGap);
    const removeIdx = availableGaps.indexOf(pickedGap);
    availableGaps.splice(removeIdx, 1);
  }
  chosenGaps.sort((a, b) => a - b);
  const chosenGapSet = new Set(chosenGaps);

  // 5. 총 박자 및 총 시간 계산
  const totalBeats = calculateLoopTotalBeats(squatCount, loopConfig);
  const totalSeconds = calculateLoopTotalSeconds(totalBeats, bpm);

  // 6. 순차 루프 구간(Segments) 및 전투 조우(Encounters) 조립
  const segments: AssaultLoopSegmentDef[] = [];
  const encounters: AssaultEncounterDef[] = [];

  let currentBeat = 0;
  let segmentIndex = 0;

  // 6.1 구간 0: run_question (8박)
  const runDurationBeats = loopConfig.runBeats;
  const runStartBeat = currentBeat;
  const runEndBeat = runStartBeat + runDurationBeats;
  segments.push({
    segmentIndex: segmentIndex++,
    kind: 'run_question',
    startBeat: runStartBeat,
    durationBeats: runDurationBeats,
    endBeat: runEndBeat,
    startSeconds: beatToSeconds(runStartBeat, bpm),
    durationSeconds: beatToSeconds(runDurationBeats, bpm),
    endSeconds: beatToSeconds(runEndBeat, bpm),
  });
  currentBeat = runEndBeat;

  // 6.2 4회의 답안 선택(answer) 및 휴식(rest), 그리고 선택된 gap의 스쿼트(squat)
  for (let opp = 1; opp <= loopConfig.answerOpportunities; opp++) {
    const oppStr = String(opp).padStart(2, '0');
    const answerAttackId = `attack_${oppStr}_answer` as AttackId;
    const pairId = `pair_${oppStr}` as PairId;

    // (A) Answer 구간 (4박)
    const ansDurationBeats = loopConfig.answerBeats;
    const ansStartBeat = currentBeat;
    const ansEndBeat = ansStartBeat + ansDurationBeats;

    const answerSegment: AssaultLoopSegmentDef = {
      segmentIndex: segmentIndex++,
      kind: 'answer',
      startBeat: ansStartBeat,
      durationBeats: ansDurationBeats,
      endBeat: ansEndBeat,
      startSeconds: beatToSeconds(ansStartBeat, bpm),
      durationSeconds: beatToSeconds(ansDurationBeats, bpm),
      endSeconds: beatToSeconds(ansEndBeat, bpm),
      opportunityIndex: opp,
      attackId: answerAttackId,
      pairId,
    };
    segments.push(answerSegment);

    // 전투 조우 매핑: answer_pair
    encounters.push({
      id: answerAttackId,
      kind: 'answer_pair',
      startBeat: ansStartBeat,
      durationBeats: ansDurationBeats,
      interactionProfileId: 'assault_input_mvp_v1',
      visualProfileId: 'assault_visual_mvp_v1',
      pairId,
      answerPolicyId: 'policy_dual_choice',
    });

    currentBeat = ansEndBeat;

    // (B) Rest 구간 (restBeats > 0 일 때만 생성)
    const restDurationBeats = loopConfig.restBeats;
    if (restDurationBeats > 0) {
      const restStartBeat = currentBeat;
      const restEndBeat = restStartBeat + restDurationBeats;

      segments.push({
        segmentIndex: segmentIndex++,
        kind: 'rest',
        startBeat: restStartBeat,
        durationBeats: restDurationBeats,
        endBeat: restEndBeat,
        startSeconds: beatToSeconds(restStartBeat, bpm),
        durationSeconds: beatToSeconds(restDurationBeats, bpm),
        endSeconds: beatToSeconds(restEndBeat, bpm),
        opportunityIndex: opp,
      });

      currentBeat = restEndBeat;
    }

    // (C) 만약 현재 opp 번호의 gap이 선택되었다면 스쿼트(squat 4박) 삽입
    if (chosenGapSet.has(opp)) {
      const squatAttackId = `attack_squat_gap${opp}` as AttackId;
      const squatDurationBeats = loopConfig.squatBeats;
      const squatStartBeat = currentBeat;
      const squatEndBeat = squatStartBeat + squatDurationBeats;

      // 스쿼트 하위 3단계 구간 (notice 1박, dodge 2박, stand 1박)
      const noticeDur = loopConfig.squatSubBeats.notice;
      const dodgeDur = loopConfig.squatSubBeats.dodge;
      const standDur = loopConfig.squatSubBeats.stand;

      const noticeStart = squatStartBeat;
      const noticeEnd = noticeStart + noticeDur;
      const dodgeStart = noticeEnd;
      const dodgeEnd = dodgeStart + dodgeDur;
      const standStart = dodgeEnd;
      const standEnd = standStart + standDur;

      const squatSubSegments: AssaultLoopSquatSubSegmentDef[] = [
        {
          kind: 'notice',
          startBeat: noticeStart,
          durationBeats: noticeDur,
          endBeat: noticeEnd,
          startSeconds: beatToSeconds(noticeStart, bpm),
          durationSeconds: beatToSeconds(noticeDur, bpm),
          endSeconds: beatToSeconds(noticeEnd, bpm),
        },
        {
          kind: 'dodge',
          startBeat: dodgeStart,
          durationBeats: dodgeDur,
          endBeat: dodgeEnd,
          startSeconds: beatToSeconds(dodgeStart, bpm),
          durationSeconds: beatToSeconds(dodgeDur, bpm),
          endSeconds: beatToSeconds(dodgeEnd, bpm),
        },
        {
          kind: 'stand',
          startBeat: standStart,
          durationBeats: standDur,
          endBeat: standEnd,
          startSeconds: beatToSeconds(standStart, bpm),
          durationSeconds: beatToSeconds(standDur, bpm),
          endSeconds: beatToSeconds(standEnd, bpm),
        },
      ];

      const squatSegment: AssaultLoopSegmentDef = {
        segmentIndex: segmentIndex++,
        kind: 'squat',
        startBeat: squatStartBeat,
        durationBeats: squatDurationBeats,
        endBeat: squatEndBeat,
        startSeconds: beatToSeconds(squatStartBeat, bpm),
        durationSeconds: beatToSeconds(squatDurationBeats, bpm),
        endSeconds: beatToSeconds(squatEndBeat, bpm),
        gapIndex: opp,
        attackId: squatAttackId,
        squatSubSegments,
      };
      segments.push(squatSegment);

      // 전투 조우 매핑: squat
      encounters.push({
        id: squatAttackId,
        kind: 'squat',
        startBeat: squatStartBeat,
        durationBeats: squatDurationBeats,
        interactionProfileId: 'assault_input_mvp_v1',
        visualProfileId: 'assault_visual_mvp_v1',
      });

      currentBeat = squatEndBeat;
    }
  }

  // 7. 기존 AssaultCompiledPlan과 결합
  const effectiveRoundId = roundId ?? `round_${roundNumber}`;
  const approachPattern: AssaultApproachPattern = {
    schemaVersion: '1.0.0',
    patternId: `pattern_assault_loop_${totalBeats}_r${roundNumber}`,
    timingProfileId: 'profile_assault_standard',
    balanceProfileId: loopConfig.profileId,
    totalBeats,
    encounters,
  };

  const compiledPlan = compileAssaultPlan(approachPattern, {
    bpm,
    seed: rawSeed,
    roundId: effectiveRoundId,
    rulesVersion: loopConfig.rulesVersion,
  });

  // 8. 루프 계획 조립
  const plan: AssaultLoopRoundPlan<AssaultCompiledPlan> = {
    roundId: effectiveRoundId,
    profileId: loopConfig.profileId,
    rulesVersion: loopConfig.rulesVersion,
    bpm,
    totalBeats,
    totalSeconds,
    squatGapIndices: chosenGaps,
    squatCount,
    segments,
    encounters,
    compiledPlan,
  };

  // 9. 원자적 사전 검증
  validateLoopPlan(plan, loopConfig);

  // 10. deepFreeze를 통한 불변 객체 반환
  return deepFreeze(plan);
}

/**
 * 객체 지향 인터페이스용 빌더 클래스 래퍼
 */
export class AssaultLoopPlanBuilder {
  /**
   * 36/40박 불변 라운드 루프 계획 생성
   */
  static build(
    seedOrOptions: string | number | AssaultLoopPlanBuildOptions,
    optionalRoundNumber?: number,
    optionalConfigOrOptions?: AssaultLoopConfig | Partial<AssaultLoopPlanBuildOptions>,
  ): Readonly<AssaultLoopRoundPlan<AssaultCompiledPlan>> {
    return buildAssaultLoopPlan(seedOrOptions, optionalRoundNumber, optionalConfigOrOptions);
  }

  /**
   * 루프 계획 사전 유효성 검증
   */
  static validate(
    plan: AssaultLoopRoundPlan,
    loopConfig: AssaultLoopConfig = DEFAULT_ASSAULT_LOOP_CONFIG,
  ): void {
    validateLoopPlan(plan, loopConfig);
  }
}
