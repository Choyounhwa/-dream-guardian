/**
 * AssaultLoopRoundAssembler.ts - 보스 접근전 라운드별 루프 계획 및 numeric_repeat 4기회 Core 조립
 *
 * @see docs/19_BOSS_ASSAULT_LOOP_CARDS.md (DOC-19 §§1~4)
 * @see docs/assault-loop/LOOP-09.md (ASSAULT-LOOP-09 / Issue #702)
 *
 * 절대 규칙:
 * 1. 라운드별 루프 계획 및 보기 공급 Core 조립 단일 책임:
 *    - seed + roundNumber 기반으로 불변 36/40박 루프 계획(AssaultLoopRoundPlan)을 매 라운드 동적 생성한다.
 *    - session.compiledPlan의 고정 패턴을 무조건 재사용하지 않는다.
 * 2. numeric_repeat 4기회 공급:
 *    - 동일 문제 1개 / 정답 1개에 대해 pairCount: 4로 보기 공급 포트(providePairs)를 단 1회 호출한다.
 *    - 루프 내 4개 answer_pair encounter에 보기 쌍을 순차 매핑한다.
 *    - challenge 공급 포트는 명시적으로 거부한다.
 * 3. 난이도 override 배제:
 *    - difficulty의 answerBeats override를 배제하고 answer 4박을 항상 엄격히 유지한다.
 * 4. 권위 HP 검사 및 사망 즉시 abort:
 *    - 정산 영수증 반영 후 HP가 0 이하가 되면 즉시 rc.abort()를 호출하여 추가 이벤트 및 진행을 차단한다.
 *    - run 종료(onRunEnd), 사망, dispose 시 TTS cancel 포트를 호출한다.
 * 5. 단일 파일 1,000줄 미만 엄격 준수.
 */

import {
  DEFAULT_ASSAULT_LOOP_CONFIG,
  type AssaultLoopConfig,
} from '../../config/assault-loop.config.js';
import type { AssaultTimingAndBalanceConfig } from '../../config/assault.config.js';
import { AssaultLoopPlanBuilder } from '../game/assault/AssaultLoopPlanBuilder.js';
import { AssaultRoundController } from '../game/assault/AssaultRoundController.js';
import type {
  AssaultLoopRoundPlan,
  AssaultLoopProfile,
} from '../types/assault-loop.js';
import type {
  AttackId,
  RoundId,
  SessionId,
} from '../types/assault.js';
import type { AssaultAnswerPair } from '../question/AssaultAnswerPairFactory.js';
import type { AssaultCompiledPlan } from '../game/assault/AssaultPlanCompiler.js';
import {
  AssaultRoundControllerOptions,
  AssaultRoundQuestionData,
  normalizeAssaultRoundQuestion,
} from '../game/assault/AssaultRoundTypes.js';
import type { QuestionCandidate } from '../question/AssaultQuestionEligibility.js';
import { safeEval } from '../question/QuestionEvaluator.js';
import type {
  AssaultRoundSourcePort,
  AssaultRoundOptions,
  AssaultSession,
  AssaultTtsRequestPort,
} from './AssaultSessionFactory.js';
import { AssaultSessionValidationError } from './AssaultSessionFactory.js';
import {
  AssaultSettlement,
  type PlayerResourceTarget,
} from '../game/assault/AssaultSettlement.js';
import type {
  AssaultProgressController,
  AssaultProgressEvaluation,
} from '../game/assault/AssaultProgressController.js';
import type { AssaultExerciseTally } from '../game/assault/AssaultExerciseTally.js';

export interface AssaultLoopRoundAssemblerOptions {
  readonly loopProfile: AssaultLoopProfile;
  readonly bpm: number;
  readonly baseSeed: number;
  readonly battleState: PlayerResourceTarget;
  readonly settlement: AssaultSettlement;
  readonly progressController: AssaultProgressController;
  readonly exerciseTally: AssaultExerciseTally;
  readonly ttsPort: AssaultTtsRequestPort;
  readonly roundSource: AssaultRoundSourcePort;
  readonly config: AssaultTimingAndBalanceConfig;
}

export class AssaultLoopRoundAssembler {
  private _currentLoopPlan: Readonly<AssaultLoopRoundPlan<AssaultCompiledPlan>> | null = null;
  private _lastEvaluation: AssaultProgressEvaluation | null = null;

  constructor(public readonly options: AssaultLoopRoundAssemblerOptions) {}

  /**
   * seed + roundNumber 기반 불변 36/40박 루프 계획 빌드
   */
  public static buildLoopRoundPlan(
    seed: string | number,
    roundNumber: number,
    loopConfig?: AssaultLoopProfile,
    bpm?: number,
    roundId?: RoundId,
  ): Readonly<AssaultLoopRoundPlan<AssaultCompiledPlan>> {
    const effectiveConfig = (loopConfig ?? DEFAULT_ASSAULT_LOOP_CONFIG) as AssaultLoopConfig;
    return AssaultLoopPlanBuilder.build({
      seed,
      roundNumber,
      loopConfig: effectiveConfig,
      bpm,
      roundId,
    });
  }

  /**
   * 세션 초기 참조용 불변 루프 계획 생성
   */
  public buildInitialLoopPlan(seed: number): Readonly<AssaultLoopRoundPlan<AssaultCompiledPlan>> {
    const plan = AssaultLoopRoundAssembler.buildLoopRoundPlan(
      seed,
      1,
      this.options.loopProfile,
      this.options.bpm,
      'round_01' as RoundId,
    );
    this._currentLoopPlan = plan;
    return plan;
  }

  /**
   * 현재 활성 라운드의 불변 루프 계획 반환 (읽기 전용 포트)
   */
  public getCurrentLoopPlan(): Readonly<AssaultLoopRoundPlan<AssaultCompiledPlan>> | null {
    return this._currentLoopPlan;
  }

  /**
   * 최근 평가 결과 반환
   */
  public get lastEvaluation(): AssaultProgressEvaluation | null {
    return this._lastEvaluation;
  }

  /**
   * 라운드 컨트롤러 조립 및 생성
   */
  public createRoundController(
    roundId: RoundId,
    questionData: AssaultRoundQuestionData | QuestionCandidate | string,
    roundOptions?: AssaultRoundOptions,
    session?: AssaultSession,
    activeSessionId?: SessionId,
  ): AssaultRoundController {
    // 1. 라운드 번호 추출
    const roundNumber = Math.max(1, parseInt(roundId.replace(/\D/g, ''), 10) || 1);

    // 2. 라운드별 시드 계산 및 신규 루프 계획 생성
    const roundSeed = roundOptions?.seed ?? this.options.baseSeed;

    const loopPlan = AssaultLoopRoundAssembler.buildLoopRoundPlan(
      roundSeed,
      roundNumber,
      this.options.loopProfile,
      this.options.bpm,
      roundId,
    );

    // 3. 문제 데이터 정규화 및 정답 도출
    const normalizedQuestion = normalizeAssaultRoundQuestion(questionData, roundId);

    const rawAnswer =
      (normalizedQuestion as any).correctAnswer ??
      (normalizedQuestion as any).answer ??
      (normalizedQuestion as any).expectedAnswer;

    let resolvedAnswer = rawAnswer;
    if (resolvedAnswer === undefined && normalizedQuestion.text) {
      try {
        const cleaned = normalizedQuestion.text.replace(/=\s*\??/g, '').trim();
        if (!isNaN(Number(cleaned))) {
          resolvedAnswer = Number(cleaned);
        } else {
          resolvedAnswer = safeEval(cleaned);
        }
      } catch {
        resolvedAnswer = 42;
      }
    }

    // 4. numeric_repeat 4기회 공급
    const activeSource = roundOptions?.roundSource ?? this.options.roundSource;
    if (activeSource?.kind === 'challenge') {
      throw new AssaultSessionValidationError('Challenge round source is not supported in loop mode', [
        'unsupported_challenge_source',
      ]);
    }

    const answerEncounters = loopPlan.encounters.filter((e) => e.kind === 'answer_pair');
    const pairCount = answerEncounters.length; // 4회 고정

    let pairs: readonly AssaultAnswerPair[] = [];
    if (roundOptions?.pairs && roundOptions.pairs.length >= pairCount) {
      pairs = roundOptions.pairs;
    } else {
      const preferredWrong =
        typeof (normalizedQuestion as any)?.wrongAnswer === 'string'
          ? (normalizedQuestion as any).wrongAnswer
          : undefined;

      pairs = activeSource.providePairs({
        seed: roundSeed,
        roundId,
        questionId: normalizedQuestion.id,
        pairCount,
        correctAnswer: resolvedAnswer ?? 0,
        question: normalizedQuestion,
        preferredWrong,
      });
    }

    // 5. 보기 쌍 및 조우 ID 매핑
    const pairsMap: Record<string, AssaultAnswerPair> = {};
    pairs.forEach((pair, idx) => {
      pairsMap[pair.pairId] = pair;
      if (idx < answerEncounters.length) {
        const enc = answerEncounters[idx] as any;
        if (enc.pairId) pairsMap[enc.pairId] = pair;
        if (enc.id) pairsMap[enc.id] = pair;
        const scopedId = enc.id.startsWith(roundId) ? enc.id : `${roundId}-${enc.id}`;
        pairsMap[scopedId] = pair;
      }
    });

    const modifiedEncounters = loopPlan.encounters.map((enc) => {
      const scopedId = enc.id.startsWith(roundId) ? enc.id : `${roundId}-${enc.id}`;
      if (enc.kind === 'answer_pair') {
        const pairIdx = answerEncounters.indexOf(enc);
        const pair = pairs[pairIdx];
        if (pair) {
          return {
            ...enc,
            id: scopedId as AttackId,
            pairId: (enc as any).pairId ?? pair.pairId,
            correctSide: pair.correctSide,
            correctAnswerSide: pair.correctSide,
            choices: pair.choices,
            left: pair.left,
            right: pair.right,
            pair,
          };
        }
      }
      return {
        ...enc,
        id: scopedId as AttackId,
      };
    });

    const roundPlan = {
      ...loopPlan.compiledPlan,
      encounters: modifiedEncounters,
    } as unknown as AssaultCompiledPlan;

    const modifiedLoopPlan: AssaultLoopRoundPlan<AssaultCompiledPlan> = {
      ...loopPlan,
      encounters: modifiedEncounters as any,
      compiledPlan: roundPlan,
    };
    this._currentLoopPlan = modifiedLoopPlan;
    (normalizedQuestion as any).pairs = pairs;

    // 6. 라운드 컨트롤러 및 이벤트 배선
    let rc: AssaultRoundController;
    let completedHandled = false;

    const handleSettlementCommand = (cmd: any) => {
      const key = cmd.idempotencyKey
        ? (cmd.idempotencyKey.includes(`:${roundId}:`)
            ? cmd.idempotencyKey
            : cmd.idempotencyKey.replace(`${cmd.sessionId}:`, `${cmd.sessionId}:${roundId}:`))
        : `${cmd.sessionId}:${roundId}:${cmd.attackId}:${cmd.effectType}`;

      const scopedCmd = {
        ...cmd,
        roundId,
        idempotencyKey: key,
      };

      const receipt = this.options.settlement.settle(scopedCmd);
      if (receipt) {
        rc.recordSettlementReceipt(receipt);
      }
      (roundOptions as any)?.onSettlementCommand?.(scopedCmd, receipt);

      // 권위 HP 검사: 정산 직후 사망 시 즉시 abort 및 TTS 취소
      const currentHp = this.options.battleState ? this.options.battleState.hp : 0;
      if (currentHp <= 0 && !rc.isCompleted) {
        this.options.ttsPort.cancel?.();
        rc.abort('player_defeated');
      }
    };

    const handleRoundComplete = (result: {
      sessionId: SessionId;
      roundId: RoundId;
      success: boolean;
      reason?: string;
    }) => {
      if (completedHandled) return;
      completedHandled = true;

      // 라운드 종료 시 TTS 취소
      this.options.ttsPort.cancel?.();

      const currentHp = this.options.battleState ? this.options.battleState.hp : 0;
      const isDefeated = currentHp <= 0;
      const summary = rc.finalizeRoundSummary({ isDefeated });

      let evaluation: AssaultProgressEvaluation | null = null;
      if (summary) {
        evaluation = this.options.progressController.evaluate(summary, currentHp);
        this._lastEvaluation = evaluation;
      }

      roundOptions?.onRoundComplete?.(result);
      if (evaluation && roundOptions?.onProgressEvaluated) {
        roundOptions.onProgressEvaluated(evaluation);
      }

      // 생존 및 진행 가능한 경우에만 자동 다음 라운드 진행
      if (
        roundOptions?.autoAdvance &&
        !isDefeated &&
        !this.options.progressController.isGameOver &&
        evaluation?.intent === 'next_round'
      ) {
        session?.startNextRound?.(roundOptions);
      }
    };

    const handleSummaryFinalized = (summary: any) => {
      roundOptions?.onSummaryFinalized?.(summary);
    };

    rc = new AssaultRoundController({
      sessionId: activeSessionId ?? (`sess_${roundId}` as SessionId),
      roundId,
      question: normalizedQuestion,
      plan: roundPlan,
      loopPlan: modifiedLoopPlan,
      bpm: this.options.bpm,
      config: this.options.config,
      initialSquatStandState: roundOptions?.initialSquatStandState,
      onTtsSpeak: (text: string) => this.options.ttsPort.speak(text),
      onRunEnd: () => {
        this.options.ttsPort.cancel?.();
      },
      onSettlementCommand: handleSettlementCommand,
      onRoundComplete: handleRoundComplete,
      onSummaryFinalized: handleSummaryFinalized,
      pairs: pairsMap,
      strictCorrectSide: true,
    } as AssaultRoundControllerOptions);

    return rc;
  }
}
