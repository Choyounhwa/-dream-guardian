/**
 * AssaultSessionWireHelper.ts - 보스 접근전(Boss Assault) 세션 조립 및 생명주기 관리 헬퍼
 *
 * [REFACTOR-CORE-001] (Issue #616)
 * - AppBootstrap에서 거대화된 어설트 세션 팩토리 생성, 라운드 컨트롤러 조립, 답안 쌍 매핑,
 *   피날레 핸들러 및 세션 수명 관리 로직을 전담 캡슐화.
 */

import {
  AssaultSessionFactory,
  isAssaultModeRequested,
  type AssaultSession,
  type AssaultSessionOptions,
  type AssaultFinaleOptions,
} from '../AssaultSessionFactory.js';
import { AssaultLoopRoundAssembler } from '../AssaultLoopRoundAssembler.js';
import type { AssaultFinaleController } from '../../game/assault/AssaultFinaleController.js';
import type { QuestionCandidate } from '../../question/AssaultQuestionEligibility.js';
import type { AssaultHandoverSnapshot } from '../../game/assault/AssaultProgressController.js';
import type { SessionId } from '../../types/assault.js';
import { generateQuestion } from '../../question/QuestionEvaluator.js';
import type { EventBus } from '../EventBus.js';
import type { BattleState } from '../../game/BattleState.js';
import type { BossController } from '../../game/BossController.js';
import type { StateMachine } from '../StateMachine.js';
import type { SessionLifecycle } from '../SessionLifecycle.js';
import type { GameSessionContext } from '../GameSessionContext.js';
import type { QuestionBank } from '../../question/QuestionBank.js';
import type { GameEngine } from '../GameEngine.js';
import type { MainSceneContext } from '../index.js';
import type { AssaultImpactVFX } from '../../render/assault/AssaultImpactVFX.js';
import type { AssaultResultSnapshot } from '../../ui/AssaultResultView.js';
import {
  AssaultResultStore,
  type AssaultComparisonIdentity,
  type AssaultStoredSessionResult,
  type AssaultResultSaveResult,
} from '../../storage/AssaultResultStore.js';
import type { AssaultRoundSummaryData } from '../../game/assault/AssaultRoundSummary.js';
import {
  planAssaultRoundReward,
  requestAssaultRoundReward,
} from '../../game/assault/AssaultRewardPolicy.js';
import { DEFAULT_ASSAULT_REWARD_CONFIG } from '../../../config/assault-reward.config.js';
import {
  DEFAULT_ASSAULT_BGM_TRACK,
  DEFAULT_ASSAULT_BGM_BPM,
} from '../../../config/audio.config.js';
import {
  AssaultImpactWireHelper,
  createFallbackHandover,
  assembleQuestionPair,
} from './AssaultImpactWireHelper.js';
import { AssaultInputRouter } from './AssaultInputRouter.js';
import { resolveAssaultEntryOptions } from './AssaultLoopEntryOptions.js';

export interface AssaultSessionWireHost {
  readonly options?: any;
  readonly eventBus: EventBus;
  readonly battle: BattleState;
  readonly boss: BossController;
  readonly bossController?: BossController;
  readonly speech?: any;
  readonly sfx?: any;
  readonly stateMachine: StateMachine;
  readonly sessionLifecycle: SessionLifecycle;
  readonly questionBank: QuestionBank;
  readonly sessionContext?: GameSessionContext;
  readonly motionIntentBus?: any;
  readonly beatCoordinator?: any;
  readonly engine?: GameEngine;
  readonly mainSceneContext: MainSceneContext;
  readonly goToMenu: () => void;
  assaultImpactVFX?: AssaultImpactVFX;
  enableAssaultFinale?: boolean;
  currentChapter?: number;
  selectedSubLevel?: number;
  readonly bgmManager?: any;
  assaultResultStore?: AssaultResultStore;
  storage?: Storage | null;
}

export class AssaultSessionWireHelper {
  private _host: AssaultSessionWireHost;
  private _assaultSession: AssaultSession | null = null;
  private _lastAssaultSessionOptions?: Partial<AssaultSessionOptions>;
  private _finaleController: AssaultFinaleController | null = null;
  private _gameOverTriggered: boolean = false;
  private _handoverTriggered: boolean = false;
  private _lastValidationError: string | null = null;
  private _assaultImpactVFX?: AssaultImpactVFX;
  private _lastAssaultResultSnapshot: AssaultResultSnapshot | null = null;
  private _hasTerminatedCurrentSession: boolean = false;
  private readonly _impactWireHelper = new AssaultImpactWireHelper();
  private readonly _inputRouter: AssaultInputRouter;

  constructor(host: AssaultSessionWireHost) {
    this._host = host;
    this._inputRouter = new AssaultInputRouter({
      getRawSession: () => this._getActiveRawSession(),
      getClock: () => this._getActiveRawSession()?.clock ?? (this._assaultSession as any)?.clock,
      getActiveRound: () => (this._assaultSession as any)?.activeRoundController ?? this._getActiveRawSession()?.activeRoundController,
      getFinaleController: () => (this._getActiveRawSession() as any)?.finaleController ?? (this._assaultSession as any)?.finaleController ?? this._finaleController,
      getAdapters: () => this._getActiveRawSession() ?? this._assaultSession,
      onPunchImpact: (activeRound, hand) => this._checkAndTriggerPunchImpact(activeRound, hand, this._assaultSession),
      isDisposed: () => this._assaultSession?.isDisposed ?? false,
      getSessionId: () => this._getActiveRawSession()?.sessionId ?? (this._assaultSession as any)?.sessionId,
      getPoseFrame: () => (this._host.mainSceneContext as any)?.stickmanRenderer?.lastPoseFrame,
    });
  }

  public get inputRouter(): AssaultInputRouter {
    return this._inputRouter;
  }

  private _getActiveRawSession(): any {
    if (!this._assaultSession) return null;
    return (this._assaultSession as any).__rawSession ?? this._assaultSession;
  }

  get host(): AssaultSessionWireHost {
    return this._host;
  }

  get assaultImpactVFX(): AssaultImpactVFX | undefined {
    return (
      this._assaultImpactVFX ??
      (this._host as any).assaultImpactVFX ??
      (this._host.mainSceneContext as any)?.assaultImpactVFX ??
      (this._host as any).sceneDirector?.assaultHandler?.assaultImpactVFX ??
      (this._host as any).sceneDirector?.renderOrchestrator?.assaultHandler?.assaultImpactVFX ??
      (this._host as any).assaultSceneHandler?.assaultImpactVFX
    );
  }

  get lastAssaultResultSnapshot(): AssaultResultSnapshot | null {
    return this._lastAssaultResultSnapshot;
  }

  private _getResultStore(): AssaultResultStore {
    if (this._host.assaultResultStore) {
      return this._host.assaultResultStore;
    }
    const storage =
      this._host.storage !== undefined
        ? this._host.storage
        : (this._host as any).options?.storage !== undefined
        ? (this._host as any).options.storage
        : typeof window !== 'undefined'
        ? window.localStorage
        : null;

    const safeStorage = storage ?? {
      getItem: () => null,
      setItem: () => {},
    };
    return new AssaultResultStore(safeStorage);
  }

  public setAssaultImpactVFX(vfx?: AssaultImpactVFX): void {
    this._assaultImpactVFX = vfx;
  }

  get lastValidationError(): string | null {
    return this._lastValidationError;
  }

  get assaultSession(): AssaultSession | null {
    return this._assaultSession;
  }

  set assaultSession(session: AssaultSession | null) {
    this._assaultSession = session;
  }

  get finaleController(): AssaultFinaleController | null {
    return (this._assaultSession as any)?.finaleController ?? this._finaleController ?? null;
  }

  get isFinaleActive(): boolean {
    return Boolean((this._assaultSession as any)?.isFinaleActive || this._finaleController);
  }

  get lastAssaultSessionOptions(): Partial<AssaultSessionOptions> | undefined {
    return this._lastAssaultSessionOptions;
  }

  public isAssaultMode(): boolean {
    const opts = (this._host as any)._options ?? this._host.options ?? {};
    return isAssaultModeRequested(
      opts.location ?? (typeof window !== 'undefined' ? window.location : undefined),
      opts.env ?? (typeof import.meta !== 'undefined' ? (import.meta as any).env : undefined),
      opts.mode,
    );
  }

  public initAssaultMode(): void {
    if (this.isAssaultMode()) {
      this._host.sessionContext?.setMode('boss_assault');
      this._host.motionIntentBus?.setPhase('ASSAULT_ROUND');
      if (this._host.bgmManager) {
        this._host.bgmManager.setTrack?.(DEFAULT_ASSAULT_BGM_TRACK, DEFAULT_ASSAULT_BGM_BPM);
      }
    }
  }

  public assemblePair(
    generated: {
      questionText: string;
      choices: readonly (number | string)[] | [number | string, number | string];
      correctAnswer: number | string;
      correctIndex: number;
      shapeCode?: string;
    },
    rec: {
      id?: string | number;
      level?: number;
      subLevel?: number;
      levelTitle?: string;
      subLevelTitle?: string;
      questionTemplate?: string;
      shapeCode?: string;
      answerEval?: string;
    },
  ): QuestionCandidate {
    return assembleQuestionPair(generated, rec);
  }

  public extractQuestionCandidates(chapter?: number, subLevel?: number): QuestionCandidate[] {
    const qChapter =
      chapter ?? (this._host.questionBank.currentLevel || this._host.currentChapter || 1);
    const qSubLevel =
      subLevel ?? (this._host.questionBank.currentSubLevel ?? this._host.selectedSubLevel);
    const snapshot = this._host.questionBank.getPoolSnapshot(qChapter, qSubLevel);
    const records = snapshot.questions;
    const candidates: QuestionCandidate[] = [];

    for (const rec of records) {
      if (
        typeof (rec as any).questionText === 'string' &&
        (rec as any).correctAnswer !== undefined
      ) {
        candidates.push(rec as QuestionCandidate);
      } else if (rec.questionTemplate) {
        const generated = generateQuestion(rec);
        if (generated) {
          candidates.push(this.assemblePair(generated, rec));
        }
      }
    }
    return candidates;
  }

  public assembleAssaultSession(options?: Partial<AssaultSessionOptions>): AssaultSession {
    const isAssault = this.isAssaultMode() || options?.mode === 'boss_assault';
    const resolved = resolveAssaultEntryOptions(options, isAssault);
    this._lastAssaultSessionOptions = resolved;
    let questions = resolved.questions;
    if (questions === undefined) {
      const candidates = this.extractQuestionCandidates(
        (resolved as any)?.chapter,
        (resolved as any)?.subLevel,
      );
      if (candidates.length > 0) {
        questions = candidates;
      }
    }

    const mergedOptions: Partial<AssaultSessionOptions> & { enableFinale?: boolean } = {
      enableFinale: this._host.enableAssaultFinale,
      ...resolved,
      questions,
    };

    const self = this;
    const rawSession = AssaultSessionFactory.createSession({
      battleState: this._host.battle,
      bossController: this._host.bossController ?? this._host.boss,
      speech: this._host.speech,
      questions,
      pattern: resolved.pattern,
      loopProfile: resolved.loopProfile,
      config: resolved.config,
      questionConfig: resolved.questionConfig,
      targetRounds: resolved.targetRounds,
      bpm: resolved.bpm,
      seed: resolved.seed,
      sfxPlayer: resolved.sfxPlayer ?? this._host.sfx,
      ...mergedOptions,
    });

    if (rawSession.clock && typeof (rawSession.clock as any).handleVisibilityChange !== 'function') {
      (rawSession.clock as any).handleVisibilityChange = (hidden: boolean) => {
        rawSession.clock.setHidden(hidden);
      };
    }

    const session: any = {
      ...rawSession,
      __rawSession: rawSession,
      clockAdapter: rawSession.clock,
      activeRoundController: null,
      get isDisposed() {
        return rawSession.isDisposed;
      },
      get jumpAdapter() {
        return (rawSession as any).jumpAdapter;
      },
      get finaleController() {
        return (rawSession as any).finaleController ?? self._finaleController;
      },
      get isFinaleActive() {
        return Boolean((rawSession as any).isFinaleActive || self._finaleController);
      },
      get presentation() {
        return (
          session.activeRoundController?.getPresentationSnapshot?.() ??
          (session.activeRoundController as any)?.presentation ??
          (rawSession as any).presentation ??
          null
        );
      },
      get snapshot() {
        return session.presentation;
      },
      getPresentationSnapshot() {
        return session.presentation;
      },
      getHUDSnapshot(customError?: any) {
        return typeof (rawSession as any).getHUDSnapshot === 'function'
          ? (rawSession as any).getHUDSnapshot(customError)
          : null;
      },
      getApproachSnapshot() {
        return typeof (rawSession as any).getApproachSnapshot === 'function'
          ? (rawSession as any).getApproachSnapshot()
          : null;
      },
      getCurrentLoopPlan() {
        const active =
          typeof (rawSession as any).getCurrentLoopPlan === 'function'
            ? (rawSession as any).getCurrentLoopPlan()
            : null;
        if (active) return active;
        if (resolved.loopProfile) {
          return AssaultLoopRoundAssembler.buildLoopRoundPlan(
            resolved.seed ?? 12345,
            1,
            resolved.loopProfile,
            resolved.bpm,
          );
        }
        return null;
      },
      getLoopExerciseSummary() {
        return typeof (rawSession as any).getLoopExerciseSummary === 'function'
          ? (rawSession as any).getLoopExerciseSummary()
          : null;
      },
      updateAudio: (isPaused?: boolean) => {
        return (rawSession as any).updateAudio?.(isPaused);
      },
      updateRound: (activeSeconds: number, dt: number) => {
        return (rawSession as any).updateRound?.(activeSeconds, dt);
      },
      createRoundController: (roundId: any, qData: any, roundOptions?: any) => {
        return self.createRoundController(session, roundId, qData, roundOptions);
      },
      startNextRound: (roundOptions?: any) => {
        return self.startNextRound(session, roundOptions);
      },
      startFinale: (handoff: AssaultHandoverSnapshot, finaleOptions?: AssaultFinaleOptions) => {
        return self.startAssaultFinale(handoff, finaleOptions);
      },
      dispose: () => {
        self.teardownAssaultSession(session);
      },
      teardown: () => {
        self.teardownAssaultSession(session);
      },
      handleIntent: (intent: string, snapshot?: AssaultHandoverSnapshot | null, opts?: any) => {
        return self.handleAssaultIntent(intent, snapshot, rawSession.sessionId, opts);
      },
      update(dt: number, ctx?: any) {
        if (rawSession.isDisposed) return;
        rawSession.clock?.update(
          dt,
          ctx?.engine?.elapsedTime !== undefined ? ctx.engine.elapsedTime * 1000 : undefined,
        );

        const finale = (rawSession as any).finaleController ?? self._finaleController;
        const activeRound = session.activeRoundController;
        if (activeRound && !activeRound.isCompleted) {
          if (rawSession.clock?.isFrozen && !activeRound.isPaused) {
            activeRound.pause(rawSession.clock.primaryPauseReason ?? 'clock_frozen');
          } else if (!rawSession.clock?.isFrozen && activeRound.isPaused) {
            activeRound.resume();
          }
        }
        if (activeRound && !activeRound.isCompleted && !finale) {
          const activeSeconds = rawSession.clock?.toRoundRelativeSeconds
            ? rawSession.clock.toRoundRelativeSeconds()
            : (rawSession.clock?.activeSeconds ?? 0);
          activeRound.update(activeSeconds, dt);
        }

        // Active clock audio cue update (BOSS-ASSAULT-REC-16 / #609)
        if (typeof (rawSession as any).updateAudio === 'function') {
          (rawSession as any).updateAudio();
        }

        if (activeRound && !finale) {
          if (
            self._host.battle?.hp <= 0 ||
            (rawSession.progressController && rawSession.progressController.isGameOver)
          ) {
            if (!self._gameOverTriggered) {
              self._gameOverTriggered = true;
              self.handleAssaultIntent('game_over', null, rawSession.sessionId);
            }
          } else if (activeRound.isCompleted) {
            if (rawSession.progressController?.isTargetReached) {
              if (!self._handoverTriggered) {
                self._handoverTriggered = true;
                const snapshot = rawSession.progressController.handoverSnapshot;
                self.handleAssaultIntent('handover_climax', snapshot, rawSession.sessionId);
              }
            } else if (rawSession.lastEvaluation?.intent === 'next_round') {
              const nextRc = self.startNextRound
                ? self.startNextRound(session)
                : rawSession.startNextRound
                ? rawSession.startNextRound()
                : null;
              if (nextRc) {
                session.activeRoundController = nextRc;
              }
            }
          }
        }

        if (finale) {
          const activeSeconds = rawSession.clock?.toRoundRelativeSeconds
            ? rawSession.clock.toRoundRelativeSeconds()
            : (rawSession.clock?.activeSeconds ?? 0);
          const timestampMs =
            ctx?.engine?.elapsedTime !== undefined
              ? ctx.engine.elapsedTime * 1000
              : performance.now();
          finale.update(timestampMs, activeSeconds);

          const pendingCmds = finale.getPendingSettlementCommands();
          if (pendingCmds && pendingCmds.length > 0) {
            for (const cmd of pendingCmds) {
              const receipt = rawSession.settlement.settle(cmd);
              finale.applySettlementReceipt(receipt);
            }
          }

          const snap = finale.getSnapshot();
          if (
            snap.isDefeat ||
            snap.phase === 'defeat' ||
            (snap.playerHp <= 0 && snap.bossHp <= 0) ||
            self._host.battle.hp <= 0
          ) {
            self.handleAssaultIntent('game_over', null, rawSession.sessionId);
          } else if (
            snap.isVictory ||
            snap.phase === 'victory' ||
            snap.bossHp <= 0 ||
            ((self._host.bossController ?? self._host.boss) &&
              (self._host.bossController ?? self._host.boss).hp <= 0)
          ) {
            self.handleAssaultIntent('victory', null, rawSession.sessionId);
          }
        } else {
          if (self._host.battle.hp <= 0) {
            self.handleAssaultIntent('game_over', null, rawSession.sessionId);
          }
        }
      },
      render(ctx: CanvasRenderingContext2D, renderCtx?: any) {
        if (rawSession.isDisposed) return;
        (rawSession as any).render?.(ctx, renderCtx);
        const finale = (rawSession as any).finaleController ?? self._finaleController;
        if (finale && typeof (finale as any).render === 'function') {
        (finale as any).render(ctx, renderCtx);
        }
      },
      handleKeyboard(event: KeyboardEvent) {
        self._inputRouter.handleKeyDown(event);
      },
      handleClick(normX: number, normY: number): boolean {
        return self._inputRouter.handleClick(normX, normY);
      },
      handleKeyUp(event: KeyboardEvent) {
        self._inputRouter.handleKeyUp(event);
      },
      handlePose(sourceLandmarks: any[], normalizedLandmarks?: any[], dt?: number) {
        self._inputRouter.handlePose(sourceLandmarks, normalizedLandmarks, dt);
      },
    };

    this._assaultSession = session;
    this._gameOverTriggered = false;
    this._handoverTriggered = false;
    this._hasTerminatedCurrentSession = false;
    this._lastAssaultResultSnapshot = null;
    const isTest = (resolved as any).isTestSession !== undefined ? Boolean((resolved as any).isTestSession) : true;
    this._host.sessionLifecycle.setActiveAssaultSessionToken(rawSession.sessionId);
    this._host.sessionLifecycle.setTestSession(isTest);
    this._host.sessionContext?.setMode('boss_assault');
    this._host.motionIntentBus?.setPhase('ASSAULT_ROUND');
    return session;
  }

  public createRoundController(session: any, roundId: any, qData: any, roundOptions?: any): any {
    if (session.isFinaleActive || this._finaleController) {
      throw new Error('Cannot create round controller while finale is active');
    }
    const rawSession = session.__rawSession ?? session;
    const mergedRoundOptions = {
      ...roundOptions,
      onSettlementCommand: (cmd: any, receipt?: any) => {
        roundOptions?.onSettlementCommand?.(cmd, receipt);
        this.handleAssaultSettlementImpact(cmd, session);
      },
    };
    const rc = rawSession.createRoundController(roundId, qData, mergedRoundOptions);
    session.activeRoundController = rc;
    return rc;
  }

  public startNextRound(session?: any, roundOptions?: any): any {
    const targetSession = session ?? this._assaultSession;
    if (!targetSession || targetSession.isDisposed) return null;
    const rawSession = targetSession.__rawSession ?? targetSession;
    const mergedRoundOptions = {
      ...roundOptions,
      onSettlementCommand: (cmd: any, receipt?: any) => {
        roundOptions?.onSettlementCommand?.(cmd, receipt);
        this.handleAssaultSettlementImpact(cmd, targetSession);
      },
    };
    const rc = rawSession.startNextRound ? rawSession.startNextRound(mergedRoundOptions) : null;
    if (rc) {
      targetSession.activeRoundController = rc;
    }
    return rc;
  }

  public startAssaultFinale(
    snapshot?: AssaultHandoverSnapshot | null,
    options?: AssaultFinaleOptions,
  ): AssaultFinaleController | null {
    if (!this._assaultSession || this._assaultSession.isDisposed) {
      return null;
    }

    const handover: AssaultHandoverSnapshot =
      snapshot ??
      (this._host.sessionLifecycle.lastHandoverSnapshot as AssaultHandoverSnapshot) ??
      createFallbackHandover(String(this._assaultSession.sessionId), this._host.battle.hp);

    if (
      this._host.battle &&
      typeof (this._host.battle as any)._hp === 'number' &&
      typeof handover.finalHp === 'number'
    ) {
      (this._host.battle as any)._hp = handover.finalHp;
    }

    const controller = AssaultSessionFactory.startFinale(this._assaultSession, handover, options);
    this._finaleController = controller;
    (this._host.sessionLifecycle as any)._lastHandoverSnapshot = handover;
    (this._host.sessionLifecycle as any)._hasResultShown = false;
    this._host.motionIntentBus?.setPhase('ASSAULT_FINALE');
    return controller;
  }

  public handleAssaultFinale(snapshot?: AssaultHandoverSnapshot | null, options?: AssaultFinaleOptions): AssaultFinaleController | null {
    return this.startAssaultFinale(snapshot, options);
  }

  public assembleAssaultFinaleSession(snapshot: AssaultHandoverSnapshot, options?: AssaultFinaleOptions): AssaultFinaleController | null {
    return this.startAssaultFinale(snapshot, options);
  }

  public handleAssaultIntent(
    intent: string,
    snapshot?: AssaultHandoverSnapshot | null,
    sessionToken?: SessionId | string | number | null,
    options?: {
      startFinale?: boolean;
      enableFinale?: boolean;
      finaleOptions?: AssaultFinaleOptions;
    },
  ): boolean {
    const token = sessionToken ?? this._assaultSession?.sessionId;
    if (!this._host.sessionLifecycle.isValidAssaultToken(token)) {
      return false;
    }

    const shouldStartFinale =
      intent === 'handover_climax' &&
      (options?.startFinale === true ||
        options?.enableFinale === true ||
        this._host.enableAssaultFinale === true);

    if (shouldStartFinale) {
      if (this._host.sessionLifecycle.hasResultShown) {
        return false;
      }
      if (this._host.sessionContext) {
        this._host.sessionContext.setActive(false);
      }
      this._host.beatCoordinator?.pause();
      this._host.engine?.pauseGame();

      const controller = this.startAssaultFinale(snapshot, options?.finaleOptions);
      return controller !== null;
    }

    if (intent === 'victory') {
      if (!this._host.sessionLifecycle.claimResultTransition()) {
        return false;
      }
      if (this._host.sessionContext) {
        this._host.sessionContext.setActive(false);
      }
      this._host.beatCoordinator?.pause();
      this._host.engine?.pauseGame();
      this._transitionToState('RESULT');
      return true;
    }

    const normalizedIntent = intent === 'defeat' ? 'game_over' : intent;
    const accepted = this._host.sessionLifecycle.handleAssaultIntent(
      normalizedIntent,
      snapshot,
      token,
    );
    if (!accepted) {
      return false;
    }

    if (this._host.sessionContext) {
      this._host.sessionContext.setActive(false);
    }
    this._host.beatCoordinator?.pause();
    this._host.engine?.pauseGame();

    if (normalizedIntent === 'game_over') {
      this.handleAssaultSessionTermination({
        outcome: 'defeated',
      });
      this._transitionToState('GAMEOVER');
    } else if (normalizedIntent === 'handover_climax') {
      this.handleAssaultSessionTermination({
        outcome: 'completed',
      });
      this._transitionToState('RESULT');
    }

    return true;
  }

  public handleAssaultSessionTermination(options: {
    outcome: 'completed' | 'aborted' | 'defeated';
    roundSummaries?: readonly AssaultRoundSummaryData[];
    isTestSession?: boolean;
    recordResults?: boolean;
  }): boolean {
    if (this._hasTerminatedCurrentSession) {
      return false;
    }
    this._hasTerminatedCurrentSession = true;

    const isTest =
      options.isTestSession !== undefined
        ? options.isTestSession
        : this._host.sessionLifecycle.isTestSession;

    const shouldRecord = options.recordResults ?? false;

    const rounds = options.roundSummaries ?? [];
    const sessionId = (this._assaultSession?.sessionId ?? 'session-assault') as SessionId;

    const identity: AssaultComparisonIdentity = {
      mode: 'boss_assault',
      rulesVersion: '1.0.0',
      profileId: (this._lastAssaultSessionOptions as any)?.profileId ?? 'assault_loop_v1',
      difficultyId: (this._lastAssaultSessionOptions as any)?.difficultyId ?? 'normal',
      tempoBpm: this._lastAssaultSessionOptions?.bpm ?? 120,
      plannedAnswerOpportunities: 40,
      inputProfileId: 'profile_punch_default',
      accessibilityProfileId: 'default',
      questionFormat: 'numeric',
      roundSourceKind: 'numeric_repeat',
      challengeFamilies: [],
      challengeRulesVersion: null,
    };

    let processedKeys: readonly string[] = [];
    const rewardEvaluations = rounds.map((round) => {
      const plan = planAssaultRoundReward(round, DEFAULT_ASSAULT_REWARD_CONFIG);
      const evaluation = requestAssaultRoundReward(plan, processedKeys);
      processedKeys = evaluation.processedKeys;
      return { plan, evaluation };
    });

    const storedResult: AssaultStoredSessionResult = {
      sessionId,
      identity,
      rounds,
      rewardEvaluations,
    };

    const store = this._getResultStore();
    const saveResult: AssaultResultSaveResult = store.save(storedResult, {
      isTestSession: isTest,
      recordResults: shouldRecord,
    });

    const snapshot: AssaultResultSnapshot = {
      result: storedResult,
      outcome: options.outcome,
      playerHp: this._host.battle.hp,
      storage: saveResult,
    };

    this._lastAssaultResultSnapshot = snapshot;

    // host 메인 씬 상태 동기화
    if (this._host.mainSceneContext?.state) {
      (this._host.mainSceneContext.state as any).assaultResultSnapshot = snapshot;
      (this._host.mainSceneContext.state as any).resultData = {
        victory: options.outcome === 'completed',
        correctCount: rounds.reduce((sum, r) => sum + r.correctCount, 0),
        totalQuestions: rounds.reduce((sum, r) => sum + r.completedQuestions, 0),
        elapsedTime: rounds.reduce((sum, r) => sum + r.activeDurationSeconds, 0),
      };
    }

    if (options.outcome === 'completed') {
      this._transitionToState('RESULT');
    } else if (options.outcome === 'defeated') {
      this._transitionToState('GAMEOVER');
    }

    return true;
  }

  private _transitionToState(targetState: 'GAMEOVER' | 'RESULT'): void {
    const sm = this._host.stateMachine;
    if (!sm) return;
    if (!sm.canTransition(targetState)) {
      if (sm.currentState === 'MENU_MAIN' || sm.currentState === 'MENU_SUB' || sm.currentState === 'READY_POSITION') {
        sm.changeState('RUN_QUESTION');
      }
      if (!sm.canTransition(targetState)) {
        sm.changeState('ROUND_RESOLVE');
      }
    }
    if (sm.canTransition(targetState)) {
      sm.changeState(targetState);
    }
  }

  public restartAssaultSession(options?: Partial<AssaultSessionOptions>): AssaultSession {
    if (this._assaultSession) {
      this.teardownAssaultSession(this._assaultSession);
    }
    this._host.goToMenu();
    this._host.battle.reset();
    if (this._host.boss) this._host.boss.reset();
    const session = this.assembleAssaultSession(options ?? this._lastAssaultSessionOptions);
    (this._host.mainSceneContext.state as any).screenMode = 'game';
    if (this._host.bgmManager) {
      this._host.bgmManager.setTrack?.(DEFAULT_ASSAULT_BGM_TRACK, DEFAULT_ASSAULT_BGM_BPM);
    }
    if (this._host.stateMachine.canTransition('READY_POSITION')) {
      this._host.stateMachine.changeState('READY_POSITION');
    }
    if (this._host.stateMachine.canTransition('ASSAULT_ROUND')) {
      this._host.stateMachine.changeState('ASSAULT_ROUND');
    } else if (this._host.stateMachine.canTransition('RUN_QUESTION')) {
      this._host.stateMachine.changeState('RUN_QUESTION');
    }
    return session;
  }

  public teardownAssaultSession(session?: AssaultSession | null): void {
    const targetSession = session ?? this._assaultSession;
    if (!targetSession) return;

    if ((targetSession as any).isFinaleActive || this._finaleController) {
      const snap = this._finaleController?.getSnapshot();
      (this._host.sessionLifecycle as any)._lastHandoverSnapshot = (snap as any) ?? {
        sessionId: targetSession.sessionId,
        mode: 'boss_assault',
        rulesVersion: 'v0.3',
        finalHp: this._host.battle.hp,
        stats: (targetSession as any).stats ?? {},
        timestampMs: Date.now(),
      };
    }

    const raw = (targetSession as any).__rawSession ?? targetSession;
    if (typeof raw.teardown === 'function') {
      raw.teardown();
    } else if (typeof raw.dispose === 'function') {
      raw.dispose();
    }
    this._finaleController = null;
    this._gameOverTriggered = false;
    this._handoverTriggered = false;
    (targetSession as any).activeRoundController = null;
    this._host.sessionLifecycle.clearActiveAssaultSessionToken(targetSession.sessionId);
    if (this._assaultSession === targetSession) {
      this._assaultSession = null;
    }
  }

  public startAssaultPhase(extraReset?: () => void): boolean {
    if (!this._assaultSession || this._assaultSession.isDisposed) {
      try {
        this.assembleAssaultSession();
        this._lastValidationError = null;
      } catch (err) {
        console.error('[DG] 보스 접근전 세션 조립 실패 (적격 문항 부족 또는 유효성 검증 실패):', err);
        this._lastValidationError = err instanceof Error ? err.message : String(err);
        if (this._host.sessionContext) {
          (this._host.sessionContext as any).assaultError = this._lastValidationError;
        }
        return false;
      }
    }
    const session = this._assaultSession as any;
    if (!session || !session.eligibleQuestions || session.eligibleQuestions.length === 0) {
      console.error('[DG] 보스 접근전 적격 문항이 없어 ASSAULT_ROUND 진입이 차단되었습니다.');
      return false;
    }
    if (!session.activeRoundController && session.eligibleQuestions.length > 0) {
      this.createRoundController(session, 'round_01', session.eligibleQuestions[0]);
    }
    if (extraReset) {
      extraReset();
    }
    if (this._host.bgmManager) {
      this._host.bgmManager.setTrack?.(DEFAULT_ASSAULT_BGM_TRACK, DEFAULT_ASSAULT_BGM_BPM);
    }
    if (this._host.stateMachine.canTransition('ASSAULT_ROUND')) {
      this._host.stateMachine.changeState('ASSAULT_ROUND');
    }
    return true;
  }

  public dispatchFallbackEvent(
    fbEvent: any,
    source: 'keyboard' | 'touch',
  ): void {
    this._inputRouter.dispatchFallbackEvent(fbEvent, source);
  }

  public handleKeyDown(event: KeyboardEvent): boolean {
    if (!this._assaultSession || this._assaultSession.isDisposed) return false;
    const session = this._assaultSession as any;
    if (typeof session.handleKeyboard === 'function') {
      session.handleKeyboard(event);
      return true;
    }
    return this._inputRouter.handleKeyDown(event);
  }

  public handleClick(normX: number, normY: number): boolean {
    if (!this._assaultSession || this._assaultSession.isDisposed) return false;
    const session = this._assaultSession as any;
    if (typeof session.handleClick === 'function') {
      return session.handleClick(normX, normY);
    }
    return this._inputRouter.handleClick(normX, normY);
  }

  public handleKeyUp(event: KeyboardEvent): boolean {
    if (!this._assaultSession || this._assaultSession.isDisposed) return false;
    const session = this._assaultSession as any;
    if (typeof session.handleKeyUp === 'function') {
      session.handleKeyUp(event);
      return true;
    }
    return this._inputRouter.handleKeyUp(event);
  }

  public handleVisibilityChange(hidden?: boolean): void {
    const isHidden =
      hidden !== undefined ? hidden : typeof document !== 'undefined' ? document.hidden : false;
    if (this._assaultSession) {
      const clock = (this._assaultSession as any).clockAdapter ?? this._assaultSession.clock;
      if (clock) {
        if (typeof clock.handleVisibilityChange === 'function') {
          clock.handleVisibilityChange(isHidden);
        } else if (typeof clock.setHidden === 'function') {
          clock.setHidden(isHidden);
        }
      }
      const activeRound = (this._assaultSession as any).activeRoundController;
      if (activeRound && !activeRound.isCompleted) {
        if (isHidden && !activeRound.isPaused) {
          activeRound.pause('visibility_hidden');
        } else if (!isHidden && activeRound.isPaused && !clock?.isFrozen) {
          activeRound.resume();
        }
      }
    }
  }

  /**
   * 보스 접근전 답안 타격 시각 효과(정답 폭죽/팝핑, 오답 디졸브) 트리거 연동 (ASSAULT-FX-003)
   */
  public handleAssaultSettlementImpact(cmd: any, session?: any): void {
    this._impactWireHelper.handleAssaultSettlementImpact(
      cmd,
      this._host,
      session ?? this._assaultSession,
      this.assaultImpactVFX,
    );
  }

  private _checkAndTriggerPunchImpact(activeRound: any, hand: 'left' | 'right', session?: any): void {
    this._impactWireHelper.checkAndTriggerPunchImpact(
      activeRound,
      hand,
      this._host,
      session ?? this._assaultSession,
      this.assaultImpactVFX,
    );
  }

  public dispose(): void {
    this._impactWireHelper.clear();
    if (this._assaultSession) {
      this._assaultSession.dispose();
      this._assaultSession = null;
    }
    this._finaleController = null;
  }
}
