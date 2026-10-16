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

import { DEFAULT_ASSAULT_CONFIG, type AssaultTimingAndBalanceConfig } from '../../config/assault.config.js';
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
import { AssaultProgressController } from '../game/assault/AssaultProgressController.js';
import { AssaultExerciseTally } from '../game/assault/AssaultExerciseTally.js';
import { AssaultNoteAdapter } from '../game/assault/AssaultNoteAdapter.js';
import { AssaultPunchAdapter } from '../input/AssaultPunchAdapter.js';
import { AssaultSquatAdapter } from '../motion/AssaultSquatAdapter.js';
import { AssaultGuardAdapter } from '../motion/AssaultGuardAdapter.js';
import { AssaultFallbackAdapter } from '../input/AssaultFallbackAdapter.js';
import { AssaultHUD } from '../ui/AssaultHUD.js';
import { AssaultSoundCue, type ISFXPlayer } from '../audio/AssaultSoundCue.js';
import {
  AssaultRoundController,
  type AssaultRoundQuestionData,
} from '../game/assault/AssaultRoundController.js';
import type { SessionId, RoundId } from '../types/assault.js';

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

export interface AssaultSessionOptions {
  readonly sessionId?: SessionId;
  readonly mode?: string;
  readonly battleState: PlayerResourceTarget;
  readonly bossController?: BossResourceTarget;
  readonly speech: unknown;
  readonly questions?: readonly QuestionCandidate[];
  readonly pattern?: AssaultApproachPattern;
  readonly config?: AssaultTimingAndBalanceConfig;
  readonly questionConfig?: AssaultQuestionConfig;
  readonly targetRounds?: number;
  readonly bpm?: number;
  readonly sfxPlayer?: ISFXPlayer;
}

export interface AssaultSession {
  readonly sessionId: SessionId;
  readonly mode: 'boss_assault';
  readonly config: Readonly<AssaultTimingAndBalanceConfig>;
  readonly pattern: Readonly<AssaultApproachPattern>;
  readonly compiledPlan: Readonly<AssaultCompiledPlan>;
  readonly eligibleQuestions: readonly (Readonly<QuestionCandidate> & { readonly minReadSeconds: number })[];
  readonly clock: AssaultClockAdapter;
  readonly settlement: AssaultSettlement;
  readonly progressController: AssaultProgressController;
  readonly exerciseTally: AssaultExerciseTally;
  readonly noteAdapter: AssaultNoteAdapter;
  readonly punchAdapter: AssaultPunchAdapter;
  readonly squatAdapter: AssaultSquatAdapter;
  readonly guardAdapter: AssaultGuardAdapter;
  readonly fallbackAdapter: AssaultFallbackAdapter;
  readonly hud: AssaultHUD;
  readonly soundCue: AssaultSoundCue | null;
  readonly battleState: PlayerResourceTarget;
  readonly bossController?: BossResourceTarget;
  readonly ttsPort: AssaultTtsRequestPort;
  readonly isDisposed: boolean;
  createRoundController(roundId: RoundId, questionData: AssaultRoundQuestionData | string): AssaultRoundController;
  dispose(): void;
}

// ─── 5. 세션 조립 팩토리 클래스 ───

export class AssaultSessionFactory {
  /**
   * 보스 접근전 테스트 세션을 원자적으로 검증 및 조립한다.
   * 검증 실패 시 부분 세션/자원 없이 AssaultSessionValidationError를 발생시킨다.
   */
  public static createSession(options: AssaultSessionOptions): AssaultSession {
    // 1. Mode 검증
    if (options.mode !== undefined && options.mode !== 'boss_assault') {
      throw new AssaultSessionValidationError(`Invalid mode for assault session: ${options.mode}`, [
        'invalid_mode',
      ]);
    }

    // 2. 단일 권위 BattleState(HP 객체) 검증
    if (
      !options.battleState ||
      typeof options.battleState !== 'object' ||
      typeof options.battleState.hp !== 'number' ||
      typeof options.battleState.applyHazardDamage !== 'function'
    ) {
      throw new AssaultSessionValidationError(
        'Valid single-authority BattleState (PlayerResourceTarget) is required',
        ['invalid_battle_state'],
      );
    }

    // 3. TTS 요청 포트 검증 (실제 공개 API 대조)
    const ttsPort = resolveTtsPort(options.speech);

    // 4. 밸런스/타이밍 Config 검증
    const config = options.config ?? DEFAULT_ASSAULT_CONFIG;
    const configValidation = validateAssaultConfig(config);
    if (!configValidation.valid) {
      throw new AssaultSessionValidationError(
        `Assault config validation failed: ${configValidation.errors.join(', ')}`,
        configValidation.errors,
      );
    }

    // 5. 접근 공격 패턴(Approach Pattern) 사전 검증
    const pattern = options.pattern ?? DEFAULT_APPROACH_PATTERN;
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
      throw new AssaultSessionValidationError(
        'No eligible questions available for boss assault session',
        [questionFilterResult.error ?? 'no_eligible_questions'],
      );
    }

    // 모든 검증이 원자적으로 통과한 후 조립 착수
    const sessionId: SessionId =
      options.sessionId ??
      `assault_sess_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

    const bpm = options.bpm ?? DEFAULT_ASSAULT_BPM;
    const compiledPlan = compileAssaultPlan(pattern, { bpm });

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

    const targetRounds = options.targetRounds ?? 5;
    const progressController = new AssaultProgressController({
      sessionId,
      targetRounds,
    });

    const exerciseTally = new AssaultExerciseTally();

    const noteAdapter = new AssaultNoteAdapter({ bpm });
    noteAdapter.loadEncounters(pattern.encounters);

    const punchAdapter = new AssaultPunchAdapter();
    const squatAdapter = new AssaultSquatAdapter();
    const guardAdapter = new AssaultGuardAdapter();
    const fallbackAdapter = new AssaultFallbackAdapter();
    const hud = new AssaultHUD();
    const soundCue = options.sfxPlayer ? new AssaultSoundCue({ sfxPlayer: options.sfxPlayer }) : null;

    let isDisposed = false;

    const session: AssaultSession = {
      sessionId,
      mode: 'boss_assault',
      config,
      pattern,
      compiledPlan,
      eligibleQuestions: questionFilterResult.eligibleQuestions,
      clock,
      settlement,
      progressController,
      exerciseTally,
      noteAdapter,
      punchAdapter,
      squatAdapter,
      guardAdapter,
      fallbackAdapter,
      hud,
      soundCue,
      battleState: options.battleState,
      bossController: options.bossController,
      ttsPort,
      get isDisposed() {
        return isDisposed;
      },
      createRoundController(roundId: RoundId, questionData: AssaultRoundQuestionData | string): AssaultRoundController {
        if (isDisposed) {
          throw new Error('Cannot create round controller on a disposed session');
        }
        return new AssaultRoundController({
          sessionId,
          roundId,
          question: questionData,
          plan: compiledPlan,
          bpm,
          config,
          noteAdapter,
          onTtsSpeak: (text) => ttsPort.speak(text),
          onSettlementCommand: (cmd) => settlement.settle(cmd),
        });
      },
      dispose() {
        if (isDisposed) return;
        isDisposed = true;
        clock.reset();
      },
    };

    return Object.freeze(session);
  }
}
