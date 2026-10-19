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
  enableAssaultFinale?: boolean;
  currentChapter?: number;
  selectedSubLevel?: number;
}

export class AssaultSessionWireHelper {
  private _host: AssaultSessionWireHost;
  private _assaultSession: AssaultSession | null = null;
  private _lastAssaultSessionOptions?: Partial<AssaultSessionOptions>;
  private _finaleController: AssaultFinaleController | null = null;

  constructor(host: AssaultSessionWireHost) {
    this._host = host;
  }

  get host(): AssaultSessionWireHost {
    return this._host;
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
    const wrongAnswer =
      typeof generated.choices[1 - generated.correctIndex] === 'number'
        ? (generated.choices[1 - generated.correctIndex] as number)
        : undefined;

    return {
      id: rec.id,
      level: rec.level,
      subLevel: rec.subLevel,
      levelTitle: rec.levelTitle,
      subLevelTitle: rec.subLevelTitle,
      questionTemplate: rec.questionTemplate,
      questionText: generated.questionText,
      correctAnswer: generated.correctAnswer,
      wrongAnswer,
      choices: generated.choices as [number, number],
      shapeCode: rec.shapeCode || generated.shapeCode,
      answerEval: rec.answerEval,
    };
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
        if (generated && typeof generated.correctAnswer === 'number') {
          candidates.push(this.assemblePair(generated, rec));
        }
      }
    }
    return candidates;
  }

  public assembleAssaultSession(options?: Partial<AssaultSessionOptions>): AssaultSession {
    this._lastAssaultSessionOptions = options;
    let questions = options?.questions;
    if (questions === undefined) {
      const candidates = this.extractQuestionCandidates(
        (options as any)?.chapter,
        (options as any)?.subLevel,
      );
      if (candidates.length > 0) {
        questions = candidates;
      }
    }

    const mergedOptions: Partial<AssaultSessionOptions> & { enableFinale?: boolean } = {
      enableFinale: this._host.enableAssaultFinale,
      ...options,
      questions,
    };

    const self = this;
    const rawSession = AssaultSessionFactory.createSession({
      battleState: this._host.battle,
      bossController: this._host.bossController ?? this._host.boss,
      speech: this._host.speech,
      questions,
      pattern: options?.pattern,
      config: options?.config,
      questionConfig: options?.questionConfig,
      targetRounds: options?.targetRounds,
      bpm: options?.bpm,
      sfxPlayer: options?.sfxPlayer ?? this._host.sfx,
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
          null
        );
      },
      get snapshot() {
        return session.presentation;
      },
      createRoundController: (roundId: any, qData: any) => {
        return self.createRoundController(session, roundId, qData);
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
        if (activeRound && !activeRound.isCompleted && !finale) {
          const activeSeconds = rawSession.clock?.activeSeconds ?? 0;
          activeRound.update(activeSeconds, dt);
          const pendingCmds = activeRound.drainSettlementCommands();
          if (pendingCmds && pendingCmds.length > 0 && rawSession.settlement) {
            for (const cmd of pendingCmds) {
              rawSession.settlement.settle(cmd);
            }
          }
        }

        if (finale) {
          const activeSeconds = rawSession.clock?.activeSeconds ?? 0;
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
        if (rawSession.isDisposed) return;
        if (rawSession.fallbackAdapter) {
          const fbEvent = rawSession.fallbackAdapter.handleKeyDown({
            key: event.key,
            code: event.code,
            repeat: event.repeat,
            timestampMs: performance.now(),
            sessionId: rawSession.sessionId,
          });
          const finale = (rawSession as any).finaleController ?? self._finaleController;
          const activeRound = session.activeRoundController;
          if (finale && fbEvent) {
            const activeSeconds = rawSession.clock?.activeSeconds ?? 0;
            if (fbEvent.action === 'left_punch') {
              finale.handlePunch({ hand: 'left', timestampMs: fbEvent.timestampMs, activeSeconds });
            } else if (fbEvent.action === 'right_punch') {
              finale.handlePunch({ hand: 'right', timestampMs: fbEvent.timestampMs, activeSeconds });
            } else if (fbEvent.action === 'squat') {
              finale.handleSquat({ posture: 'squatting', isDucking: true, timestampMs: fbEvent.timestampMs, activeSeconds });
            } else if (fbEvent.action === 'jump') {
              finale.handleJump({ isJumping: true, isLowImpact: false, posture: 'jumping', timestampMs: fbEvent.timestampMs, activeSeconds });
            }
          } else if (activeRound && !activeRound.isCompleted && fbEvent) {
            const activeSeconds = rawSession.clock?.activeSeconds ?? 0;
            if (fbEvent.action === 'left_punch') {
              activeRound.submitPunch('left', fbEvent.timestampMs, { activeSeconds });
            } else if (fbEvent.action === 'right_punch') {
              activeRound.submitPunch('right', fbEvent.timestampMs, { activeSeconds });
            } else if (fbEvent.action === 'squat') {
              activeRound.submitSquat('ducking', fbEvent.timestampMs, { activeSeconds });
            }
          }
        }
      },
      handleKeyUp(event: KeyboardEvent) {
        if (rawSession.isDisposed) return;
        if (rawSession.fallbackAdapter) {
          rawSession.fallbackAdapter.handleKeyUp({
            key: event.key,
            code: event.code,
            repeat: event.repeat,
            timestampMs: performance.now(),
            sessionId: rawSession.sessionId,
          });
        }
      },
      handlePose(_sourceLandmarks: any[], normalizedLandmarks?: any[], _dt?: number) {
        if (rawSession.isDisposed) return;
        const timestampMs = performance.now();
        const activeSeconds = rawSession.clock?.activeSeconds ?? 0;
        const finale = (rawSession as any).finaleController ?? self._finaleController;
        const activeRound = session.activeRoundController;

        if (rawSession.punchAdapter && normalizedLandmarks) {
          const punchEvents = rawSession.punchAdapter.update({
            timestampMs,
            landmarks: normalizedLandmarks,
          });
          if (finale && punchEvents && punchEvents.length > 0) {
            for (const pe of punchEvents) {
              finale.handlePunch({ hand: pe.hand, timestampMs, activeSeconds });
            }
          } else if (activeRound && !activeRound.isCompleted && punchEvents && punchEvents.length > 0) {
            for (const pe of punchEvents) {
              activeRound.handlePunch({ hand: pe.hand, timestampMs, activeSeconds });
            }
          }
        }

        const squatAdapter = (rawSession as any).squatAdapter;
        if (squatAdapter && normalizedLandmarks && typeof squatAdapter.update === 'function') {
          const squatResult = squatAdapter.update({ timestampMs, landmarks: normalizedLandmarks });
          if (finale && squatResult && (squatResult.isDucking || squatResult.posture === 'ducking')) {
            finale.handleSquat({
              isDucking: squatResult.isDucking,
              posture: squatResult.posture,
              timestampMs,
              activeSeconds,
            });
          } else if (
            activeRound &&
            !activeRound.isCompleted &&
            squatResult &&
            (squatResult.isDucking || squatResult.posture === 'ducking')
          ) {
            activeRound.submitSquat(squatResult.posture, timestampMs, { activeSeconds });
          }
        }

        const jumpAdapter = (rawSession as any).jumpAdapter;
        if (jumpAdapter && normalizedLandmarks && typeof jumpAdapter.update === 'function') {
          const jumpResult = jumpAdapter.update({ timestampMs, landmarks: normalizedLandmarks });
          if (finale && jumpResult && (jumpResult.isJumping || jumpResult.isLowImpact)) {
            finale.handleJump({
              isJumping: jumpResult.isJumping,
              isLowImpact: jumpResult.isLowImpact,
              posture: jumpResult.posture,
              timestampMs,
              activeSeconds,
            });
          }
        }
      },
    };

    this._assaultSession = session;
    this._host.sessionLifecycle.setActiveAssaultSessionToken(rawSession.sessionId);
    this._host.sessionLifecycle.setTestSession(true);
    this._host.sessionContext?.setMode('boss_assault');
    this._host.motionIntentBus?.setPhase('ASSAULT_ROUND');
    return session;
  }

  public createRoundController(session: any, roundId: any, qData: any): any {
    if (session.isFinaleActive || this._finaleController) {
      throw new Error('Cannot create round controller while finale is active');
    }
    const rawSession = session.__rawSession ?? session;
    const rc = rawSession.createRoundController(roundId, qData);
    session.activeRoundController = rc;
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
      (this._host.sessionLifecycle.lastHandoverSnapshot as AssaultHandoverSnapshot) ?? {
        sessionId: String(this._assaultSession.sessionId),
        mode: 'boss_assault',
        rulesVersion: 'v0.3',
        finalHp: this._host.battle.hp,
        targetRounds: 10,
        completedRounds: 10,
        stats: {
          totalCompletedQuestions: 10,
          totalCorrectHits: 10,
          totalWrongHits: 0,
          totalTimeoutHits: 0,
          totalEvadeSuccessCount: 10,
          totalSquatFailCount: 0,
          totalEncounters: 20,
          totalAttemptedAnswerHits: 10,
          ratingCounts: { Perfect: 10, Good: 0, Late: 0, Miss: 0 },
          maxCombo: 0,
          totalPlayerDamage: 0,
          totalBossDamage: 0,
          totalActualDamage: 0,
          totalRequestedDamage: 0,
          totalActiveDurationSeconds: 0,
          processedRoundIds: [],
        },
        timestampMs: Date.now(),
      };

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

  public handleAssaultFinale(
    snapshot?: AssaultHandoverSnapshot | null,
    options?: AssaultFinaleOptions,
  ): AssaultFinaleController | null {
    return this.startAssaultFinale(snapshot, options);
  }

  public assembleAssaultFinaleSession(
    snapshot: AssaultHandoverSnapshot,
    options?: AssaultFinaleOptions,
  ): AssaultFinaleController | null {
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
      this._transitionToState('GAMEOVER');
    } else if (normalizedIntent === 'handover_climax') {
      this._transitionToState('RESULT');
    }

    return true;
  }

  private _transitionToState(targetState: 'GAMEOVER' | 'RESULT'): void {
    const sm = this._host.stateMachine;
    if (!sm) return;
    if (!sm.canTransition(targetState)) {
      if (
        sm.currentState === 'MENU_MAIN' ||
        sm.currentState === 'MENU_SUB' ||
        sm.currentState === 'READY_POSITION'
      ) {
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
    this._host.goToMenu();
    this._host.battle.reset();
    if (this._host.boss) {
      this._host.boss.reset();
    }
    const session = this.assembleAssaultSession(options ?? this._lastAssaultSessionOptions);
    (this._host.mainSceneContext.state as any).screenMode = 'game';
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
      (this._host.sessionLifecycle as any)._lastHandoverSnapshot =
        (snap as any) ?? {
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
    (targetSession as any).activeRoundController = null;
    if (typeof (this._host.sessionLifecycle as any).clearActiveAssaultSessionToken === 'function') {
      (this._host.sessionLifecycle as any).clearActiveAssaultSessionToken(targetSession.sessionId);
    } else {
      this._host.sessionLifecycle.setActiveAssaultSessionToken(null);
    }
    if (this._assaultSession === targetSession) {
      this._assaultSession = null;
    }
  }

  public startAssaultPhase(extraReset?: () => void): boolean {
    if (!this._assaultSession || this._assaultSession.isDisposed) {
      try {
        this.assembleAssaultSession();
      } catch (err) {
        console.error('[DG] 보스 접근전 세션 조립 실패 (적격 문항 부족 또는 유효성 검증 실패):', err);
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
    if (this._host.stateMachine.canTransition('ASSAULT_ROUND')) {
      this._host.stateMachine.changeState('ASSAULT_ROUND');
    }
    return true;
  }

  public handleKeyDown(event: KeyboardEvent): boolean {
    if (!this._assaultSession || this._assaultSession.isDisposed) return false;
    const session = this._assaultSession as any;
    if (typeof session.handleKeyboard === 'function') {
      session.handleKeyboard(event);
      return true;
    }
    if (session.fallbackAdapter && typeof session.fallbackAdapter.handleKeyDown === 'function') {
      session.fallbackAdapter.handleKeyDown({
        key: event.key,
        code: event.code,
        repeat: event.repeat,
        timestampMs: performance.now(),
        sessionId: session.sessionId,
      });
      return true;
    }
    return false;
  }

  public handleKeyUp(event: KeyboardEvent): boolean {
    if (!this._assaultSession || this._assaultSession.isDisposed) return false;
    const session = this._assaultSession as any;
    if (typeof session.handleKeyUp === 'function') {
      session.handleKeyUp(event);
      return true;
    }
    if (session.fallbackAdapter && typeof session.fallbackAdapter.handleKeyUp === 'function') {
      session.fallbackAdapter.handleKeyUp({
        key: event.key,
        code: event.code,
        repeat: event.repeat,
        timestampMs: performance.now(),
        sessionId: session.sessionId,
      });
      return true;
    }
    return false;
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
    }
  }

  public dispose(): void {
    if (this._assaultSession) {
      this._assaultSession.dispose();
      this._assaultSession = null;
    }
    this._finaleController = null;
  }
}
