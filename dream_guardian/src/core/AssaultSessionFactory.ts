/**
 * AssaultSessionFactory.ts - 보스 접근전(Boss Assault) 세션 조립 및 배타 진입 팩토리
 *
 * @see docs/14_BOSS_ASSAULT_GAMEPLAY_DESIGN.md (DOC-14 §§3, 6.5, 9.4)
 * @see docs/15_BOSS_ASSAULT_WORK_CARDS.md (BOSS-ASSAULT-22 / Issue #524)
 *
 * 절대 규칙:
 * 1. Core 조립 단일 책임:
 *    - G1/G2 검증된 모듈(05~20)을 명시적 테스트 세션(?mode=boss_assault)으로 안전하게 조립한다.
 *    - 설정(config), 공격 패턴(pattern), 문항(questions) 유효성을 사전 원자적 검증한다.
 * 2. 원자적 실패 거부 (A02):
 *    - 검증 실패 시 부분 세션/자원/구독을 남기지 않고 즉시 오류를 반환한다.
 *    - legacy로 몰래 이어붙이지 않는다.
 * 3. 신규 모드 배타성:
 *    - BeatRun, 별(Star), 오답 회피, 기존 피버·포격·보상 콜백(dg_stage_progress, dg_rewards)을 연결하지 않는다.
 * 4. 기존 단일 권위 HP 객체 및 TTS 요청 포트 주입 (A01):
 *    - BattleState 및 BossController 인스턴스를 단일 권위(Single Source of Truth)로 직접 주입한다.
 *    - QuestionSpeech 실제 공개 메서드(speak) 기반 요청 포트만 주입하며 비공개/미승인 완료 콜백에 의존하지 않는다.
 * 5. 실제 프레임/입력/render 배선은 #525(BOSS-ASSAULT-23)에 위임한다.
 */

import {
  DEFAULT_ASSAULT_CONFIG,
  getAssaultAnswerBeats,
  type AssaultTimingAndBalanceConfig,
} from '../../config/assault.config.js';
import { DEFAULT_APPROACH_PATTERN, type AssaultApproachPattern } from '../data/assault/approachPatterns.js';
import {
  DEFAULT_ASSAULT_QUESTION_CONFIG,
  type AssaultQuestionConfig,
} from '../../config/assault-question.config.js';
import {
  filterEligibleQuestions,
  type QuestionCandidate,
} from '../question/AssaultQuestionEligibility.js';
import { validateAssaultPlan } from '../game/assault/AssaultPlanValidator.js';
import {
  compileAssaultPlan,
  DEFAULT_ASSAULT_BPM,
  type AssaultCompiledPlan,
} from '../game/assault/AssaultPlanCompiler.js';
import { AssaultClockAdapter } from './AssaultClockAdapter.js';
import {
  AssaultSettlement,
  type PlayerResourceTarget,
  type BossResourceTarget,
} from '../game/assault/AssaultSettlement.js';
import {
  AssaultProgressController,
  type AssaultProgressEvaluation,
} from '../game/assault/AssaultProgressController.js';
import { AssaultExerciseTally } from '../game/assault/AssaultExerciseTally.js';
import { AssaultNoteAdapter } from '../game/assault/AssaultNoteAdapter.js';
import { normalizeAssaultRoundQuestion } from '../game/assault/AssaultRoundTypes.js';
import { AssaultPunchAdapter } from '../input/AssaultPunchAdapter.js';
import { AssaultSquatAdapter } from '../motion/AssaultSquatAdapter.js';
import { AssaultGuardAdapter } from '../motion/AssaultGuardAdapter.js';
import { AssaultFallbackAdapter } from '../input/AssaultFallbackAdapter.js';
import { AssaultHUD, type AssaultHUDSnapshot, type AssaultValidationErrorObj } from '../ui/AssaultHUD.js';
import { type AssaultApproachSnapshot } from '../render/AssaultApproachRenderer.js';
import { AssaultSoundCue, type ISFXPlayer } from '../audio/AssaultSoundCue.js';
import {
  AssaultRoundController,
  type AssaultRoundQuestionData,
  type AssaultSquatStandState,
} from '../game/assault/AssaultRoundController.js';
import type { SessionId, RoundId, AttackId, AssaultRoundPresentation } from '../types/assault.js';
import {
  createAssaultAnswerPairs,
  type AssaultAnswerPair,
} from '../question/AssaultAnswerPairFactory.js';
import { safeEval } from '../question/QuestionEvaluator.js';
import type { AssaultRoundSourceKind } from '../types/assaultChallenge.js';
import {
  DEFAULT_ASSAULT_FINALE_CONFIG,
  type AssaultFinaleConfig,
} from '../../config/assault-finale.config.js';
import {
  DEFAULT_FINALE_PATTERN,
  type AssaultFinalePattern,
} from '../data/assault/finalePatterns.js';
import {
  AssaultFinaleController,
  type AssaultFinaleHandoffSnapshot,
} from '../game/assault/AssaultFinaleController.js';
import { AssaultJumpAdapter } from '../motion/AssaultJumpAdapter.js';
import type { AssaultHandoverSnapshot } from '../game/assault/AssaultProgressController.js';
import type { AssaultRoundSummaryData } from '../game/assault/AssaultRoundSummary.js';
import { AssaultLoopRoundAssembler } from './AssaultLoopRoundAssembler.js';
import { projectToApproachPattern } from '../game/assault/AssaultLoopPlanBuilder.js';
import type { AssaultLoopProfile, AssaultLoopRoundPlan } from '../types/assault-loop.js';
import type { AssaultLoopExerciseSummary } from '../game/assault/AssaultExerciseTally.js';

// ─── 1. URL 파라미터 및 진입 판정 계약 ───

export interface AssaultLocationLike {
  search: string;
}

export interface AssaultEnvLike {
  DEV?: boolean;
}

/**
 * URL 파라미터 또는 명시 옵션으로부터 보스 접근전 모드 진입 여부를 판정한다.
 * - `mode === 'boss_assault'` 명시 전달 시 무조건 true
 * - URL 파라미터 `?mode=boss_assault`는 개발 환경(`import.meta.env.DEV === true`)일 때만 허용
 * - `?dev=ui&screen=` 등 DEVUI 파라미터와 병행되어도 정상 공존
 */
export function isAssaultModeRequested(
  location?: AssaultLocationLike | undefined,
  env?: AssaultEnvLike | undefined,
  explicitMode?: string,
): boolean {
  if (explicitMode === 'boss_assault') return true;
  if (!location || typeof location.search !== 'string') return false;
  const params = new URLSearchParams(location.search);
  if (params.get('mode') !== 'boss_assault') return false;
  if (env !== undefined && env.DEV !== true) return false;
  return true;
}

// ─── 2. TTS 요청 포트 계약 ───

export interface AssaultTtsRequestPort {
  speak(text: string): void;
  readonly status?: string;
  cancel?(): void;
}

function resolveTtsPort(speech: unknown): AssaultTtsRequestPort {
  if (!speech) {
    throw new AssaultSessionValidationError('TTS port or speech object is required', ['speech_missing']);
  }
  if (typeof speech === 'function') {
    return {
      speak: speech as (text: string) => void,
    };
  }
  if (typeof (speech as any).speak === 'function') {
    const s = speech as any;
    return {
      speak: (text: string) => s.speak(text),
      get status() {
        return s.status;
      },
      cancel: () => s.cancel?.(),
    };
  }
  throw new AssaultSessionValidationError('Provided speech object does not satisfy the TTS request port contract', [
    'missing_speak_method',
  ]);
}

// ─── 3. 유효성 검증 오류 및 헬퍼 ───

export class AssaultSessionValidationError extends Error {
  public readonly errors: readonly string[];

  constructor(message: string, errors: readonly string[] = []) {
    super(message);
    this.name = 'AssaultSessionValidationError';
    this.errors = Object.freeze([...errors]);
  }
}

export function validateAssaultConfig(config: unknown): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  if (!config || typeof config !== 'object') {
    return { valid: false, errors: ['Config must be an object'] };
  }
  const c = config as Partial<AssaultTimingAndBalanceConfig>;
  if (!c.profileId || typeof c.profileId !== 'string') {
    errors.push('Missing or invalid profileId');
  }
  if (!c.rulesVersion || typeof c.rulesVersion !== 'string') {
    errors.push('Missing or invalid rulesVersion');
  }
  if (typeof c.minRoundBeats !== 'number' || c.minRoundBeats < 8) {
    errors.push('minRoundBeats must be at least 8 beats (A03)');
  }
  if (c.playerMaxHp !== 100) {
    errors.push('playerMaxHp must be exactly 100');
  }
  if (typeof c.wrongDamage !== 'number' || c.wrongDamage <= 0) {
    errors.push('wrongDamage must be a positive number');
  }
  return { valid: errors.length === 0, errors };
}

// ─── 4. 세션 조립 옵션 및 세션 인터페이스 ───

/** 라운드 보기 공급 포트 (REC-04 / #597) */
export interface AssaultRoundSourcePort {
  readonly kind?: AssaultRoundSourceKind | string;
  providePairs(options: {
    readonly seed: number;
    readonly roundId: RoundId;
    readonly questionId: string;
    readonly pairCount: number;
    readonly correctAnswer: number | string;
    readonly question?: unknown;
    readonly preferredWrong?: string;
  }): readonly AssaultAnswerPair[];
}

export const defaultNumericRepeatSource: AssaultRoundSourcePort = {
  kind: 'numeric_repeat',
  providePairs(opts) {
    const questionObj = opts.question as any;
    const preferredWrong =
      opts.preferredWrong ??
      (typeof questionObj?.wrongAnswer === 'string' ? questionObj.wrongAnswer : undefined);

    return createAssaultAnswerPairs({
      correctAnswer: opts.correctAnswer,
      question: questionObj,
      pairCount: opts.pairCount,
      seed: opts.seed,
      roundId: opts.roundId,
      questionId: opts.questionId,
      preferredWrong,
    });
  },
};

export interface AssaultRoundOptions {
  readonly seed?: number;
  readonly roundSource?: AssaultRoundSourcePort;
  readonly pairs?: readonly AssaultAnswerPair[];
  readonly roundOriginSeconds?: number;
  readonly initialSquatStandState?: AssaultSquatStandState;
  readonly autoAdvance?: boolean;
  readonly onProgressEvaluated?: (evaluation: AssaultProgressEvaluation) => void;
  readonly onRoundComplete?: (result: {
    sessionId: SessionId;
    roundId: RoundId;
    success: boolean;
  }) => void;
  readonly onSummaryFinalized?: (summary: AssaultRoundSummaryData) => void;
}

export interface AssaultSessionOptions {
  readonly sessionId?: SessionId;
  readonly mode?: string;
  readonly battleState: PlayerResourceTarget;
  readonly bossController?: BossResourceTarget;
  readonly speech: unknown;
  readonly questions?: readonly QuestionCandidate[];
  readonly pattern?: AssaultApproachPattern;
  readonly loopProfile?: AssaultLoopProfile;
  readonly config?: AssaultTimingAndBalanceConfig;
  readonly questionConfig?: AssaultQuestionConfig;
  readonly targetRounds?: number;
  readonly bpm?: number;
  readonly difficulty?: string;
  readonly sfxPlayer?: ISFXPlayer;
  readonly jumpAdapter?: AssaultJumpAdapter;
  readonly seed?: number;
  readonly roundSource?: AssaultRoundSourcePort;
}

export interface AssaultFinaleOptions {
  readonly pattern?: AssaultFinalePattern;
  readonly config?: AssaultFinaleConfig;
  readonly jumpAdapter?: AssaultJumpAdapter;
}

export interface AssaultSession {
  readonly sessionId: SessionId;
  readonly mode: 'boss_assault';
  readonly config: Readonly<AssaultTimingAndBalanceConfig>;
  readonly pattern: Readonly<AssaultApproachPattern>;
  readonly loopProfile?: AssaultLoopProfile;
  readonly compiledPlan: Readonly<AssaultCompiledPlan>;
  readonly eligibleQuestions: readonly (Readonly<QuestionCandidate> & { readonly minReadSeconds: number })[];
  readonly clock: AssaultClockAdapter;
  readonly settlement: AssaultSettlement;
  readonly progressController: AssaultProgressController;
  readonly targetRounds: number;
  readonly exerciseTally: AssaultExerciseTally;
  readonly noteAdapter: AssaultNoteAdapter;
  readonly punchAdapter: AssaultPunchAdapter;
  readonly squatAdapter: AssaultSquatAdapter;
  readonly guardAdapter: AssaultGuardAdapter;
  readonly fallbackAdapter: AssaultFallbackAdapter;
  readonly jumpAdapter?: AssaultJumpAdapter;
  readonly finaleController?: AssaultFinaleController | null;
  readonly isFinaleActive?: boolean;
  readonly hud: AssaultHUD;
  readonly soundCue: AssaultSoundCue | null;
  readonly battleState: PlayerResourceTarget;
  readonly bossController?: BossResourceTarget;
  readonly ttsPort: AssaultTtsRequestPort;
  readonly isDisposed: boolean;
  readonly activeRoundController?: AssaultRoundController | null;
  readonly currentRoundIndex?: number;
  readonly lastEvaluation?: AssaultProgressEvaluation | null;
  readonly presentation?: AssaultRoundPresentation | null;
  readonly snapshot?: AssaultRoundPresentation | null;
  getCurrentLoopPlan?(): Readonly<AssaultLoopRoundPlan<AssaultCompiledPlan>> | null;
  getLoopExerciseSummary?(): AssaultLoopExerciseSummary;
  getPresentationSnapshot?(): AssaultRoundPresentation | null;
  getHUDSnapshot?(customError?: string | AssaultValidationErrorObj): AssaultHUDSnapshot;
  getApproachSnapshot?(): AssaultApproachSnapshot;
  createRoundController(
    roundId: RoundId,
    questionData: AssaultRoundQuestionData | QuestionCandidate | string,
    roundOptions?: AssaultRoundOptions,
  ): AssaultRoundController;
  startNextRound?(roundOptions?: AssaultRoundOptions): AssaultRoundController | null;
  startFinale?(handoff: AssaultHandoverSnapshot, options?: AssaultFinaleOptions): AssaultFinaleController;
  dispose(): void;
  updateRound?(activeSeconds: number, dt: number): void;
  updateAudio?(isPaused?: boolean): void;
}

// ─── 5. 세션 조립 팩토리 클래스 ───

export class AssaultSessionFactory {
  /**
   * 보스 접근전 테스트 세션을 원자적으로 검증 및 조립한다.
   * 검증 실패 시 부분 세션/자원 없이 AssaultSessionValidationError를 발생시킨다.
   */
  public static createSession(options: AssaultSessionOptions): AssaultSession {
    // 0. LoopProfile 및 pattern 충돌/소스 검증
    if (options.pattern && options.loopProfile) {
      throw new AssaultSessionValidationError('Cannot specify both pattern and loopProfile', ['conflicting_pattern_and_loop_profile']);
    }
    if (options.loopProfile && options.roundSource?.kind === 'challenge') {
      throw new AssaultSessionValidationError('Challenge round source is not supported in loop mode', ['unsupported_challenge_source']);
    }

    // 1. Mode 검증
    if (options.mode !== undefined && options.mode !== 'boss_assault') {
      throw new AssaultSessionValidationError(`Invalid mode for assault session: ${options.mode}`, ['invalid_mode']);
    }

    // 2. 단일 권위 BattleState(HP 객체) 검증
    if (!options.battleState || typeof options.battleState !== 'object' || typeof options.battleState.hp !== 'number' || typeof options.battleState.applyHazardDamage !== 'function') {
      throw new AssaultSessionValidationError('Valid single-authority BattleState (PlayerResourceTarget) is required', ['invalid_battle_state']);
    }

    // 3. TTS 요청 포트 검증 (실제 공개 API 대조)
    const ttsPort = resolveTtsPort(options.speech);

    // 4. 밸런스/타이밍 Config 검증
    const config = options.config ?? DEFAULT_ASSAULT_CONFIG;
    const configValidation = validateAssaultConfig(config);
    if (!configValidation.valid) {
      throw new AssaultSessionValidationError(`Assault config validation failed: ${configValidation.errors.join(', ')}`, configValidation.errors);
    }

    // 5. 접근 공격 패턴(Approach Pattern) 사전 검증
    let pattern: AssaultApproachPattern;
    if (options.loopProfile) {
      const initialLoopPlan = AssaultLoopRoundAssembler.buildLoopRoundPlan(options.seed ?? 12345, 1, options.loopProfile, options.bpm);
      pattern = projectToApproachPattern(initialLoopPlan);
    } else {
      pattern = options.pattern ?? DEFAULT_APPROACH_PATTERN;
    }
    const patternValidation = validateAssaultPlan(pattern);
    if (!patternValidation.valid) {
      throw new AssaultSessionValidationError(
        `Assault approach pattern validation failed: ${patternValidation.errors.map((e) => e.message).join(', ')}`,
        patternValidation.errors.map((e) => `${e.path}: ${e.code}`),
      );
    }

    // 6. 적격 문항(Eligible Questions) 검증
    const questions = options.questions ?? [];
    const questionConfig = options.questionConfig ?? DEFAULT_ASSAULT_QUESTION_CONFIG;
    const questionFilterResult = filterEligibleQuestions(questions, questionConfig);
    if (questionFilterResult.eligibleCount === 0 || questionFilterResult.error) {
      throw new AssaultSessionValidationError('No eligible questions available for boss assault session', [questionFilterResult.error ?? 'no_eligible_questions']);
    }

    // 7. 목표 라운드(targetRounds) 유효성 원자적 검증 (REC-04 / #597)
    if (options.targetRounds !== undefined) {
      if (typeof options.targetRounds !== 'number' || !Number.isInteger(options.targetRounds) || options.targetRounds <= 0 || Number.isNaN(options.targetRounds)) {
        throw new AssaultSessionValidationError(`Invalid targetRounds override: must be a positive integer, got ${options.targetRounds}`, ['invalid_target_rounds']);
      }
    }

    // 모든 검증이 원자적으로 통과한 후 조립 착수
    const sessionId: SessionId =
      options.sessionId ??
      `assault_sess_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

    const bpm = options.bpm ?? DEFAULT_ASSAULT_BPM;
    const answerBeats = (!options.loopProfile && options.difficulty) ? getAssaultAnswerBeats(options.difficulty, config) : undefined;
    const compiledPlan = compileAssaultPlan(pattern, { bpm, ...(answerBeats !== undefined ? { answerBeats } : {}) });

    const clock = new AssaultClockAdapter({
      bpm,
      resumeReadyBeats: config.resumeReadyBeats,
    });

    const settlement = new AssaultSettlement({
      activeSessionId: sessionId,
      battleState: options.battleState,
      bossController: options.bossController,
      config: {
        wrongDamage: config.wrongDamage,
        squatFailDamage: config.squatFailDamage,
        missDamage: config.missDamage,
        bossDamage: (config as any).bossDamage,
      },
    });

    const targetRounds = options.targetRounds ?? (config as any).targetRounds ?? 10;
    const progressController = new AssaultProgressController({
      sessionId,
      targetRounds,
    });

    const sessionRoundSource = options.roundSource ?? defaultNumericRepeatSource;
    const sessionBaseSeed = options.seed ?? 12345;

    const exerciseTally = new AssaultExerciseTally();

    const loopAssembler = options.loopProfile
      ? new AssaultLoopRoundAssembler({
          loopProfile: options.loopProfile,
          bpm,
          baseSeed: sessionBaseSeed,
          battleState: options.battleState,
          settlement,
          progressController,
          exerciseTally,
          ttsPort,
          roundSource: sessionRoundSource,
          config,
        })
      : null;

    const noteAdapter = new AssaultNoteAdapter({ bpm });
    noteAdapter.loadEncounters(pattern.encounters);

    const punchAdapter = new AssaultPunchAdapter();
    const squatAdapter = new AssaultSquatAdapter();
    const guardAdapter = new AssaultGuardAdapter();
    const fallbackAdapter = new AssaultFallbackAdapter();
    let sessionJumpAdapter: AssaultJumpAdapter = options.jumpAdapter ?? new AssaultJumpAdapter();
    if (typeof (sessionJumpAdapter as any).reset === 'function') {
      sessionJumpAdapter.reset(String(sessionId));
    }
    const hud = new AssaultHUD();
    const soundCue = options.sfxPlayer ? new AssaultSoundCue({ sfxPlayer: options.sfxPlayer, bpm }) : null;

    let isDisposed = false;
    let finaleController: AssaultFinaleController | null = null;
    let isFinaleActive = false;
    let currentRoundIndex = -1;
    let activeRoundController: AssaultRoundController | null = null;
    let lastEvaluation: AssaultProgressEvaluation | null = null;

    const session: AssaultSession = {
      sessionId,
      mode: 'boss_assault',
      config,
      pattern,
      loopProfile: options.loopProfile,
      compiledPlan,
      eligibleQuestions: questionFilterResult.eligibleQuestions,
      clock,
      settlement,
      progressController,
      targetRounds,
      exerciseTally,
      noteAdapter,
      punchAdapter,
      squatAdapter,
      guardAdapter,
      fallbackAdapter,
      get jumpAdapter(): AssaultJumpAdapter {
        return sessionJumpAdapter;
      },
      get finaleController(): AssaultFinaleController | null {
        return finaleController;
      },
      get isFinaleActive(): boolean {
        return isFinaleActive;
      },
      hud,
      soundCue,
      battleState: options.battleState,
      bossController: options.bossController,
      ttsPort,
      get isDisposed() {
        return isDisposed;
      },
      get activeRoundController(): AssaultRoundController | null {
        return activeRoundController;
      },
      get currentRoundIndex(): number {
        return currentRoundIndex;
      },
      get lastEvaluation(): AssaultProgressEvaluation | null {
        return loopAssembler ? loopAssembler.lastEvaluation : lastEvaluation;
      },
      get presentation(): AssaultRoundPresentation | null {
        return activeRoundController?.getPresentationSnapshot?.() ?? null;
      },
      get snapshot(): AssaultRoundPresentation | null {
        return activeRoundController?.getPresentationSnapshot?.() ?? null;
      },
      getCurrentLoopPlan() {
        return loopAssembler ? loopAssembler.getCurrentLoopPlan() : null;
      },
      getLoopExerciseSummary() {
        return exerciseTally.getLoopExerciseSummary();
      },
      getPresentationSnapshot(): AssaultRoundPresentation | null {
        return activeRoundController?.getPresentationSnapshot?.() ?? null;
      },
      getHUDSnapshot(customError?: string | AssaultValidationErrorObj): AssaultHUDSnapshot {
        const currentHp = options.battleState ? options.battleState.hp : 0;
        const maxHp = (options.battleState as any)?.maxHp ?? 100;
        const completedQuestions = progressController.completedRounds ?? (progressController as any).completedQuestions ?? 0;
        const tally = exerciseTally.getSummary();
        const strikes = tally.totalPunchCount;
        const combo = (options.battleState as any)?.combo ?? 0;
        const isPaused = Boolean(
          clock.isPaused ||
          clock.isFrozen ||
          activeRoundController?.isPaused
        );
        const trackingLost = Boolean(
          clock.isTrackingLost ||
          clock.pauseReasons.includes('tracking_lost') ||
          clock.primaryPauseReason === 'tracking_lost'
        );
        const needsMotionReprep = Boolean(clock.needsMotionReprep);
        const isAborted = Boolean((activeRoundController as any)?.isAborted || progressController.isGameOver);
        const isDefeated = Boolean(progressController.isGameOver || currentHp <= 0);

        const snap: AssaultHUDSnapshot = {
          sessionId,
          roundId: activeRoundController?.roundId,
          playerHp: currentHp,
          playerMaxHp: maxHp,
          completedQuestions,
          targetRounds,
          strikeCount: strikes,
          strikes,
          combo,
          comboCount: combo,
          isPaused,
          trackingLost,
          needsMotionReprep,
          isAborted,
          isDefeated,
          ...(customError ? { validationError: customError } : {}),
        };
        hud.setSnapshot(snap);
        return snap;
      },
      getApproachSnapshot(): AssaultApproachSnapshot {
        return {
          progress: progressController.progress,
          completedQuestions: progressController.completedRounds ?? (progressController as any).completedQuestions ?? 0,
          targetRounds,
          isRoundCompleted: Boolean(activeRoundController?.isCompleted),
        };
      },
      updateAudio(isPaused?: boolean) {
        if (isDisposed || !soundCue) return;
        const paused =
          isPaused === true ||
          Boolean(
            clock.isPaused ||
            clock.isFrozen ||
            clock.needsMotionReprep ||
            clock.pauseReasons.includes('tracking_lost') ||
            clock.primaryPauseReason === 'tracking_lost' ||
            activeRoundController?.isPaused
          );
        const activeSeconds = clock.toRoundRelativeSeconds
          ? clock.toRoundRelativeSeconds()
          : clock.activeSeconds;
        const presentation = activeRoundController?.getPresentationSnapshot?.() ?? null;
        soundCue.update(
          activeSeconds,
          presentation
            ? {
                ...presentation,
                squatHazard: (presentation as any).squatHazard ?? (presentation as any).hazard,
                isPaused: paused,
                isHidden: clock.isHidden,
                isTrackingLost: clock.isTrackingLost || clock.pauseReasons.includes('tracking_lost'),
              }
            : undefined,
          paused,
        );
      },
      updateRound(activeSeconds: number, dt: number) {
        if (isDisposed) return;
        activeRoundController?.update(activeSeconds, dt);
        session.updateAudio?.();
      },
      createRoundController(
        roundId: RoundId,
        questionData: AssaultRoundQuestionData | QuestionCandidate | string,
        roundOptions?: AssaultRoundOptions,
      ): AssaultRoundController {
        if (isDisposed) {
          throw new Error('Cannot create round controller on a disposed session');
        }
        if (isFinaleActive) {
          throw new Error('Cannot create round controller while finale is active');
        }

        const effectiveOriginSeconds =
          typeof roundOptions?.roundOriginSeconds === 'number'
            ? roundOptions.roundOriginSeconds
            : clock.activeSeconds;
        clock.setRoundOrigin(effectiveOriginSeconds, String(roundId));
        soundCue?.reset();

        if (loopAssembler) {
          const rc = loopAssembler.createRoundController(
            roundId,
            questionData,
            roundOptions,
            session,
            sessionId,
          );
          activeRoundController = rc;
          currentRoundIndex = Math.max(0, parseInt(roundId.replace(/\D/g, ''), 10) - 1 || 0);
          session.getHUDSnapshot?.();
          return rc;
        }

        const normalizedQuestion: AssaultRoundQuestionData = normalizeAssaultRoundQuestion(
          questionData,
          roundId,
        );

        const rawAnswer =
          (normalizedQuestion as any).correctAnswer ??
          (normalizedQuestion as any).answer ??
          (normalizedQuestion as any).expectedAnswer;

        const answerEncounters = compiledPlan.encounters.filter((e) => e.kind === 'answer_pair');
        const pairCount = answerEncounters.length;
        const isPairWiringRequested =
          rawAnswer !== undefined ||
          roundOptions?.seed !== undefined ||
          roundOptions?.pairs !== undefined ||
          options.seed !== undefined ||
          options.roundSource !== undefined;

        let pairs: readonly AssaultAnswerPair[] = [];
        if (roundOptions?.pairs) {
          pairs = roundOptions.pairs;
        } else if (isPairWiringRequested && pairCount > 0) {
          const effectiveSeed =
            roundOptions?.seed ??
            (normalizedQuestion as any).seed ??
            (sessionBaseSeed + Math.abs(String(roundId).split('').reduce((acc, c) => acc * 31 + c.charCodeAt(0), 0))) >>> 0;
          const activeSource = roundOptions?.roundSource ?? sessionRoundSource;

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
          const preferredWrong =
            typeof (normalizedQuestion as any)?.wrongAnswer === 'string'
              ? (normalizedQuestion as any).wrongAnswer
              : undefined;

          pairs = activeSource.providePairs({
            seed: effectiveSeed,
            roundId,
            questionId: normalizedQuestion.id,
            pairCount,
            correctAnswer: resolvedAnswer ?? 0,
            question: normalizedQuestion,
            preferredWrong,
          });
        }

        const pairsMap: Record<string, AssaultAnswerPair> = {};
        pairs.forEach((pair, idx) => {
          pairsMap[pair.pairId] = pair;
          if (idx < answerEncounters.length) {
            const enc = answerEncounters[idx] as any;
            if (enc.pairId) {
              pairsMap[enc.pairId] = pair;
            }
            if (enc.id) {
              pairsMap[enc.id] = pair;
            }
            const scopedId = isPairWiringRequested
              ? (enc.id.startsWith(roundId) ? enc.id : `${roundId}-${enc.id}`)
              : enc.id;
            pairsMap[scopedId] = pair;
          }
        });

        // 원본 compiledPlan encounters 불변 보장 및 session 범위 고유 attackId (roundId-attackId) 발급
        const modifiedEncounters = compiledPlan.encounters.map((enc) => {
          const scopedId = isPairWiringRequested
            ? (enc.id.startsWith(roundId) ? enc.id : `${roundId}-${enc.id}`)
            : enc.id;
          if (enc.kind === 'answer_pair') {
            const pairIdx = answerEncounters.indexOf(enc);
            const pair = pairs[pairIdx];
            const explicitSide = (enc as any).correctSide ?? (enc as any).correctAnswerSide;
            if (pair) {
              const effectiveSide = explicitSide ?? pair.correctSide;
              return {
                ...enc,
                id: scopedId as AttackId,
                pairId: (enc as any).pairId ?? pair.pairId,
                correctSide: effectiveSide,
                correctAnswerSide: effectiveSide,
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
          ...compiledPlan,
          encounters: modifiedEncounters,
        };

        (normalizedQuestion as any).pairs = pairs;

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
          const receipt = settlement.settle(scopedCmd);
          if (receipt) {
            rc.recordSettlementReceipt(receipt);
          }
          const currentHp = options.battleState ? options.battleState.hp : 0;
          if (currentHp <= 0 && !rc.isCompleted) {
            ttsPort.cancel?.();
            rc.abort('player_defeated');
          }
          (roundOptions as any)?.onSettlementCommand?.(scopedCmd, receipt);
        };

        const handleRoundComplete = (result: {
          sessionId: SessionId;
          roundId: RoundId;
          success: boolean;
        }) => {
          if (completedHandled) return;
          completedHandled = true;

          // 1. 데미지 정산 완료 상태
          // 2. 사망 여부 확인
          const currentHp = options.battleState ? options.battleState.hp : 0;
          const isDefeated = currentHp <= 0;

          // 3. 요약 확정 (사망 플래그 동기화)
          const summary = rc.finalizeRoundSummary({ isDefeated });

          // 4. 진행도 및 전이 의도 평가 (단 1회)
          let evaluation: AssaultProgressEvaluation | null = null;
          if (isPairWiringRequested) {
            if (summary) {
              evaluation = progressController.evaluate(summary, currentHp);
              lastEvaluation = evaluation;
            }
            roundOptions?.onRoundComplete?.(result);
            if (evaluation && roundOptions?.onProgressEvaluated) {
              roundOptions.onProgressEvaluated(evaluation);
            }
            if (roundOptions?.autoAdvance && evaluation?.intent === 'next_round') {
              session.startNextRound?.(roundOptions);
            }
          } else {
            if (summary && (isDefeated || summary.isDefeated)) {
              progressController.evaluate(summary, currentHp);
            }
            roundOptions?.onRoundComplete?.(result);
          }
        };

        const handleSummaryFinalized = (summary: any) => {
          roundOptions?.onSummaryFinalized?.(summary);
        };

        rc = new AssaultRoundController({
          sessionId,
          roundId,
          question: normalizedQuestion,
          plan: roundPlan,
          bpm,
          config,
          noteAdapter,
          initialSquatStandState: roundOptions?.initialSquatStandState,
          onTtsSpeak: (text: string) => ttsPort.speak(text),
          onSettlementCommand: handleSettlementCommand,
          onRoundComplete: handleRoundComplete,
          onSummaryFinalized: handleSummaryFinalized,
          pairs: pairsMap,
          strictCorrectSide: isPairWiringRequested || undefined,
        } as any);

        activeRoundController = rc;
        currentRoundIndex = Math.max(0, currentRoundIndex + 1);
        session.getHUDSnapshot?.();

        return rc;
      },
      startNextRound(roundOptions?: AssaultRoundOptions): AssaultRoundController | null {
        if (isDisposed) {
          throw new Error('Cannot start next round on a disposed session');
        }
        if (isFinaleActive) {
          throw new Error('Cannot start next round while finale is active');
        }
        if (progressController.isGameOver || (options.battleState && options.battleState.hp <= 0)) {
          return null;
        }
        if (progressController.isTargetReached) {
          return null;
        }
        if (activeRoundController && !activeRoundController.isCompleted) {
          return null;
        }
        const effectiveLastEval = loopAssembler ? loopAssembler.lastEvaluation : lastEvaluation;
        if (effectiveLastEval && effectiveLastEval.intent !== 'next_round') {
          return null;
        }

        const nextIndex = currentRoundIndex + 1;
        const nextRoundId = `round_${String(nextIndex + 1).padStart(2, '0')}` as RoundId;
        const nextQuestion = questionFilterResult.eligibleQuestions[nextIndex % questionFilterResult.eligibleQuestions.length];
        if (!nextQuestion) {
          return null;
        }

        const prevSquatState = activeRoundController?.exportSquatStandState?.();
        const mergedOptions: AssaultRoundOptions = {
          ...roundOptions,
          initialSquatStandState: roundOptions?.initialSquatStandState ?? prevSquatState,
        };

        return session.createRoundController(nextRoundId, nextQuestion, mergedOptions);
      },
      startFinale(handoff: AssaultHandoverSnapshot, finaleOptions?: AssaultFinaleOptions): AssaultFinaleController {
        return AssaultSessionFactory.startFinale(session, handoff, finaleOptions);
      },
      dispose() {
        if (isDisposed) return;
        isDisposed = true;
        ttsPort.cancel?.();
        if (activeRoundController && !activeRoundController.isCompleted) {
          activeRoundController.abort('session_disposed');
        }
        activeRoundController = null;
        finaleController = null;
        clock.reset();
        soundCue?.reset();
      },
    };

    (session as any).__setFinale = (controller: AssaultFinaleController, jAdapter: AssaultJumpAdapter) => {
      finaleController = controller;
      sessionJumpAdapter = jAdapter;
      isFinaleActive = true;
    };

    return Object.freeze(session);
  }

  /**
   * 근접 결전(AssaultFinaleController) 가동 및 배타 연결 (#532 / BOSS-ASSAULT-30)
   * #539 계약 준수: BossController.reset 포트를 통한 명시적 HP 주입
   */
  public static startFinale(
    session: AssaultSession,
    handoff: AssaultHandoverSnapshot,
    options?: AssaultFinaleOptions,
  ): AssaultFinaleController {
    if (!session || session.isDisposed) {
      throw new Error('Cannot start finale on a disposed session');
    }
    if (!handoff || typeof handoff !== 'object') {
      throw new Error('Invalid handover snapshot');
    }
    if (handoff.sessionId !== session.sessionId) {
      throw new Error(`Session ID mismatch: expected ${session.sessionId}, got ${handoff.sessionId}`);
    }

    if (session.clock && typeof session.clock.setRoundOrigin === 'function') {
      session.clock.setRoundOrigin(session.clock.activeSeconds, 'finale');
    }

    const config = options?.config ?? DEFAULT_ASSAULT_FINALE_CONFIG;
    const pattern = options?.pattern ?? DEFAULT_FINALE_PATTERN;

    // #539 계약 준수: BossController.reset 포트를 통한 명시적 HP 주입
    if (session.bossController) {
      if (typeof (session.bossController as any).reset === 'function') {
        (session.bossController as any).reset(undefined, {
          maxHp: config.bossInitialHp,
          initialHp: config.bossInitialHp,
        });
      } else {
        session.bossController.hp = config.bossInitialHp;
      }
    }

    const bossHp = session.bossController ? session.bossController.hp : config.bossInitialHp;
    const playerHp = handoff.finalHp ?? session.battleState.hp;
    if (session.battleState && typeof (session.battleState as any)._hp === 'number') {
      (session.battleState as any)._hp = playerHp;
    }

    const finaleHandoff: AssaultFinaleHandoffSnapshot = {
      sessionId: String(handoff.sessionId),
      playerHp,
      bossHp,
      rulesVersion: handoff.rulesVersion ?? config.rulesVersion,
      timingProfileId: config.profileId,
    };

    const jumpAdapter = options?.jumpAdapter ?? session.jumpAdapter ?? new AssaultJumpAdapter();
    if (typeof (jumpAdapter as any).reset === 'function') {
      jumpAdapter.reset(String(handoff.sessionId));
    }

    const controller = new AssaultFinaleController(finaleHandoff, pattern, config);

    if (typeof (session as any).__setFinale === 'function') {
      (session as any).__setFinale(controller, jumpAdapter);
    }
    try {
      (session as any)._finaleController = controller;
      (session as any)._isFinaleActive = true;
      (session as any)._jumpAdapter = jumpAdapter;
    } catch {
      // In case session object is strictly frozen without setter
    }

    return controller;
  }
}
