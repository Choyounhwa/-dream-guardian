/**
 * BootstrapStateMachineBuilder.ts - AppBootstrap 상태머신(StateMachine) 상태 핸들러 빌더
 *
 * [REFACTOR-CORE-002] (Issue #617)
 * - AppBootstrap에서 거대화된 StateMachine 상태 등록(READY_POSITION, RUN_QUESTION,
 *   ANSWER_SELECT, STAR_COLLECT, HAZARD_EVADE, ROUND_RESOLVE, BOSS_CLIMAX, ASSAULT_ROUND,
 *   MENU_MAIN, MENU_SUB, RESULT, GAMEOVER 등) 및 전환 리스너, BeatRunCoordinator 페이즈 매핑 로직을 캡슐화.
 */

import type { GameState } from '../../types/index.js';
import type { ResultData } from '../../ui/ResultRenderer.js';
import type { StateMachine } from '../StateMachine.js';

export type ScreenMode = 'menu' | 'game' | 'result';
export type MenuMode = 'main' | 'sub';
export type GamePhase =
  | 'running'
  | 'question'
  | 'answer_select'
  | 'star_collect'
  | 'hazard_evade'
  | 'boss_climax'
  | 'ready_frame'
  | 'assault_round';

export type ExtendedResultData = ResultData & { isTestSession?: boolean };

export interface BootstrapStateMachineHost {
  readonly stateMachine: StateMachine;
  readonly motionIntentBus?: { setPhase(phase: GameState): void } | any;

  // Local state mutators
  setScreenMode(mode: ScreenMode): void;
  setMenuMode(mode: MenuMode): void;
  setGamePhase(phase: GamePhase): void;
  setQuestionVisible(visible: boolean): void;
  setAnswerLocked(locked: boolean): void;
  setFeedbackTimer(timer: number): void;
  setRhythmStarCombo?(combo: number): void;

  // Subsystems & Managers (supports direct value or getter property/function)
  bgmManager?: any;
  stageBgm?: any;
  sfx?: any;
  effectManager?: any;
  canvasManager?: any;
  resultRenderer?: any;
  menuInput?: any;
  pauseModal?: any;

  armReachAnswerSelector?: any;
  playedNoteAudioIds?: Set<string>;
  starNoteScheduler?: any;
  starCollectionInput?: any;
  phaseAHazardController?: any;
  bossFeverController?: any;
  bossHazardController?: any;
  stageProgressController?: any;
  beatRoundResolver?: any;
  beatCoordinator?: any;
  engine?: { elapsedTime: number };
  sessionContext?: any;
  assaultWireHelper?: any;

  // Helper callbacks
  getPhaseAStarNotes?: () => any;
  getPhaseAHazardPattern?: (roundIndex?: number) => any;
  flushPendingUIPresentation?: () => void;
  getResultData?: () => ExtendedResultData | null;
  calcStars?: (correctCount: number, totalQuestions: number, elapsedTime: number) => number;
}

export class BootstrapStateMachineBuilder {
  private _host: BootstrapStateMachineHost;

  constructor(host: BootstrapStateMachineHost) {
    this._host = host;
  }

  get host(): BootstrapStateMachineHost {
    return this._host;
  }

  private _resolve<T>(val: T | (() => T) | undefined): T | undefined {
    if (typeof val === 'function') {
      try {
        return (val as () => T)();
      } catch {
        return undefined;
      }
    }
    return val;
  }

  /**
   * StateMachine 단방향 전환 통지 및 상태 동기화 리스너 등록
   */
  public registerTransitionListener(): this {
    this._host.stateMachine.onTransition((from, to) => {
      console.log(`[DG] StateMachine 전환: ${from} → ${to}`);
      if (to === 'MENU_MAIN') {
        this._host.setScreenMode('menu');
        this._host.setMenuMode('main');
      } else if (to === 'MENU_SUB') {
        this._host.setScreenMode('menu');
        this._host.setMenuMode('sub');
      } else if (to === 'RESULT' || to === 'GAMEOVER') {
        this._host.setScreenMode('result');
      } else if (
        to === 'READY_POSITION' ||
        to === 'RUN_QUESTION' ||
        to === 'ANSWER_SELECT' ||
        to === 'STAR_COLLECT' ||
        to === 'HAZARD_EVADE' ||
        to === 'ROUND_RESOLVE' ||
        to === 'BOSS_CLIMAX' ||
        to === 'ASSAULT_ROUND'
      ) {
        this._host.setScreenMode('game');
        if (to === 'READY_POSITION') {
          this._host.setGamePhase('ready_frame');
        } else if (to === 'RUN_QUESTION' || to === 'ROUND_RESOLVE') {
          this._host.setGamePhase('running');
        } else if (to === 'ANSWER_SELECT') {
          this._host.setGamePhase('answer_select');
        } else if (to === 'STAR_COLLECT') {
          this._host.setGamePhase('star_collect');
        } else if (to === 'HAZARD_EVADE') {
          this._host.setGamePhase('hazard_evade');
        } else if (to === 'BOSS_CLIMAX') {
          this._host.setGamePhase('boss_climax');
        } else if (to === 'ASSAULT_ROUND') {
          this._host.setGamePhase('assault_round');
        }
      }
      this._host.motionIntentBus?.setPhase?.(to);
    });
    return this;
  }

  public registerReadyPositionState(): this {
    this._host.stateMachine.registerState('READY_POSITION', {
      enter: () => {
        this._host.setQuestionVisible(false);
        this._host.setAnswerLocked(true);
        const bgmManager = this._resolve(this._host.bgmManager);
        if (bgmManager && !bgmManager.isPlaying && !bgmManager.isPaused) {
          bgmManager.fadeIn?.(0.5);
        }
        const stageBgm = this._resolve(this._host.stageBgm);
        if (stageBgm && !stageBgm.isPlaying) {
          stageBgm.start?.();
        }
      },
    });
    return this;
  }

  public registerRunQuestionState(): this {
    this._host.stateMachine.registerState('RUN_QUESTION', {
      enter: () => {
        this._host.setQuestionVisible(true);
        this._host.setAnswerLocked(true);
        const bgmManager = this._resolve(this._host.bgmManager);
        if (bgmManager) {
          bgmManager.setPhase?.('RUN_QUESTION');
          if (!bgmManager.isPlaying && !bgmManager.isPaused) {
            bgmManager.play?.();
          }
        }
        const stageBgm = this._resolve(this._host.stageBgm);
        if (stageBgm && !stageBgm.isPlaying && !stageBgm.isPaused) {
          stageBgm.start?.();
        }
      },
    });
    return this;
  }

  public registerAnswerSelectState(): this {
    this._host.stateMachine.registerState('ANSWER_SELECT', {
      enter: () => {
        this._host.setQuestionVisible(true);
        this._host.setAnswerLocked(false);
      },
      exit: () => {
        this._host.setAnswerLocked(true);
        const armReachAnswerSelector = this._resolve(this._host.armReachAnswerSelector);
        armReachAnswerSelector?.closeWindow?.();
      },
    });
    return this;
  }

  public registerStarCollectState(): this {
    this._host.stateMachine.registerState('STAR_COLLECT', {
      enter: () => {
        this._host.setQuestionVisible(false);
        this._host.setAnswerLocked(true);
        const playedNoteAudioIds = this._resolve(this._host.playedNoteAudioIds);
        playedNoteAudioIds?.clear?.();
        const starNoteScheduler = this._resolve(this._host.starNoteScheduler);
        if (starNoteScheduler && !starNoteScheduler.isStarted) {
          const beatCoordinator = this._resolve(this._host.beatCoordinator);
          const branchClock = beatCoordinator?.getBranchClock?.();
          const engine = this._resolve(this._host.engine);
          const startTime = engine ? engine.elapsedTime : 0;
          const beatRoundResolver = this._resolve(this._host.beatRoundResolver);
          const notes = this._host.getPhaseAStarNotes ? this._host.getPhaseAStarNotes() : [];
          starNoteScheduler.start(startTime, {
            roundId: beatRoundResolver?.currentRoundIndex,
            notes,
            ...(branchClock
              ? { branchClock, secondsPerBeat: branchClock.secondsPerBeat }
              : { secondsPerBeat: beatCoordinator?.rhythmEngine?.secondsPerBeat }),
          });
        }
      },
      exit: () => {
        const starNoteScheduler = this._resolve(this._host.starNoteScheduler);
        starNoteScheduler?.reset?.();
        const starCollectionInput = this._resolve(this._host.starCollectionInput);
        starCollectionInput?.reset?.();
        const playedNoteAudioIds = this._resolve(this._host.playedNoteAudioIds);
        playedNoteAudioIds?.clear?.();
        this._host.setRhythmStarCombo?.(0);
      },
    });
    return this;
  }

  public registerHazardEvadeState(): this {
    this._host.stateMachine.registerState('HAZARD_EVADE', {
      enter: () => {
        this._host.setQuestionVisible(false);
        this._host.setAnswerLocked(true);
        const phaseAHazardController = this._resolve(this._host.phaseAHazardController);
        if (phaseAHazardController && !phaseAHazardController.isActive) {
          const beatCoordinator = this._resolve(this._host.beatCoordinator);
          const branchClock = beatCoordinator?.getBranchClock?.();
          const beatRoundResolver = this._resolve(this._host.beatRoundResolver);
          const roundIndex = beatRoundResolver?.currentRoundIndex;
          const sessionContext = this._resolve(this._host.sessionContext);
          const bundle = sessionContext?.activeStageBundle ?? sessionContext?.stageBundle ?? null;
          const pattern = bundle
            ? bundle.getPhaseAHazardPattern(roundIndex)
            : (this._host.getPhaseAHazardPattern ? this._host.getPhaseAHazardPattern(roundIndex) : undefined);
          const attackId = bundle
            ? `${bundle.getRoundExecutionId(roundIndex)}_hazard`
            : (roundIndex ? `hazard_r${roundIndex}` : undefined);
          phaseAHazardController.start({
            roundIndex,
            pattern,
            bundle: bundle ?? undefined,
            attackId,
            ...(branchClock
              ? { branchClock, secondsPerBeat: branchClock.secondsPerBeat }
              : { secondsPerBeat: beatCoordinator?.rhythmEngine?.secondsPerBeat }),
          });
        }
      },
      exit: () => {
        const phaseAHazardController = this._resolve(this._host.phaseAHazardController);
        phaseAHazardController?.stop?.();
        phaseAHazardController?.reset?.();
      },
    });
    return this;
  }

  public registerRoundResolveState(): this {
    this._host.stateMachine.registerState('ROUND_RESOLVE', {
      enter: () => {
        this._host.setQuestionVisible(false);
        this._host.setAnswerLocked(true);
      },
      exit: () => {
        this._host.setFeedbackTimer(0);
      },
    });
    return this;
  }

  public registerBossClimaxState(): this {
    this._host.stateMachine.registerState('BOSS_CLIMAX', {
      enter: () => {
        this._host.setQuestionVisible(false);
        this._host.setAnswerLocked(true);
        this._host.setFeedbackTimer(0);
        const armReachAnswerSelector = this._resolve(this._host.armReachAnswerSelector);
        armReachAnswerSelector?.closeWindow?.();
        const phaseAHazardController = this._resolve(this._host.phaseAHazardController);
        phaseAHazardController?.stop?.();

        const sessionContext = this._resolve(this._host.sessionContext);
        const bundle = sessionContext?.activeStageBundle ?? sessionContext?.stageBundle ?? null;
        const bossFeverController = this._resolve(this._host.bossFeverController);
        const bossHazardController = this._resolve(this._host.bossHazardController);
        if (bundle) {
          bossFeverController?.setStageBundle?.(bundle);
          bossHazardController?.setStageBundle?.(bundle);
        }

        const beatRoundResolver = this._resolve(this._host.beatRoundResolver);
        const snapshot = beatRoundResolver?.getResourceSnapshot?.();
        const troopManager = beatRoundResolver?.resourceManager?.troopManager;
        if (troopManager && !troopManager.isActive) {
          troopManager.startPhaseB?.(snapshot);
        }
        const engine = this._resolve(this._host.engine);
        const elapsedTime = engine ? engine.elapsedTime : 0;
        if (bossFeverController && !bossFeverController.isActive) {
          bossFeverController.start?.(elapsedTime, snapshot);
        }
        if (bossHazardController && !bossHazardController.isActive) {
          bossHazardController.start?.();
        }
        console.log('[DG] BOSS_CLIMAX 진입 (Phase B 결전 실행)');
      },
      exit: () => {
        const bossFeverController = this._resolve(this._host.bossFeverController);
        bossFeverController?.stop?.();
        const bossHazardController = this._resolve(this._host.bossHazardController);
        bossHazardController?.stop?.();
        const beatRoundResolver = this._resolve(this._host.beatRoundResolver);
        beatRoundResolver?.resourceManager?.troopManager?.stop?.();
      },
    });
    return this;
  }

  public registerAssaultRoundState(): this {
    this._host.stateMachine.registerState('ASSAULT_ROUND', {
      enter: () => {
        this._host.setQuestionVisible(false);
        this._host.setAnswerLocked(true);
        this._host.setFeedbackTimer(0);
        console.log('[DG] ASSAULT_ROUND 진입 (보스 접근전 실행)');
      },
    });
    return this;
  }

  public registerMenuStates(): this {
    this._host.stateMachine.registerState('MENU_MAIN', {
      enter: () => {
        this._host.flushPendingUIPresentation?.();
        const sfx = this._resolve(this._host.sfx);
        sfx?.stopDwellCharge?.();
        const stageBgm = this._resolve(this._host.stageBgm);
        stageBgm?.stop?.();
        const bgmManager = this._resolve(this._host.bgmManager);
        bgmManager?.stop?.();
        const menuInput = this._resolve(this._host.menuInput);
        menuInput?.reset?.();
        const pauseModal = this._resolve(this._host.pauseModal);
        pauseModal?.close?.();
      },
    });

    this._host.stateMachine.registerState('MENU_SUB', {
      enter: () => {
        this._host.flushPendingUIPresentation?.();
        const menuInput = this._resolve(this._host.menuInput);
        menuInput?.reset?.();
      },
    });
    return this;
  }

  public registerResultState(): this {
    this._host.stateMachine.registerState('RESULT', {
      enter: () => {
        const stageBgm = this._resolve(this._host.stageBgm);
        stageBgm?.fadeOut?.(0.4);
        const bgmManager = this._resolve(this._host.bgmManager);
        bgmManager?.fadeOut?.(0.4);
        const resultRenderer = this._resolve(this._host.resultRenderer);
        resultRenderer?.resetAnimation?.();
        const canvasManager = this._resolve(this._host.canvasManager);
        const vw = canvasManager?.virtualWidth ?? 1280;
        const vh = canvasManager?.virtualHeight ?? 720;
        const resultData = this._host.getResultData ? this._host.getResultData() : null;
        const calcStars = this._host.calcStars ?? ((_c, _t, _e) => 3);
        const stars = resultData ? calcStars(resultData.correctCount, resultData.totalQuestions, resultData.elapsedTime) : 3;
        const effectManager = this._resolve(this._host.effectManager);
        effectManager?.playVictoryCelebration?.(vw, vh, stars);
      },
    });
    return this;
  }

  public registerGameOverState(): this {
    this._host.stateMachine.registerState('GAMEOVER', {
      enter: () => {
        const stageBgm = this._resolve(this._host.stageBgm);
        stageBgm?.fadeOut?.(0.4);
        const bgmManager = this._resolve(this._host.bgmManager);
        bgmManager?.fadeOut?.(0.4);
        const resultRenderer = this._resolve(this._host.resultRenderer);
        resultRenderer?.resetAnimation?.();
        const canvasManager = this._resolve(this._host.canvasManager);
        const vw = canvasManager?.virtualWidth ?? 1280;
        const vh = canvasManager?.virtualHeight ?? 720;
        const effectManager = this._resolve(this._host.effectManager);
        effectManager?.playDefeatDarken?.(vw, vh);
      },
    });
    return this;
  }

  /**
   * 모든 표준 상태 핸들러 일괄 등록
   */
  public registerStates(): this {
    this.registerReadyPositionState();
    this.registerRunQuestionState();
    this.registerAnswerSelectState();
    this.registerStarCollectState();
    this.registerHazardEvadeState();
    this.registerRoundResolveState();
    this.registerBossClimaxState();
    this.registerAssaultRoundState();
    this.registerMenuStates();
    this.registerResultState();
    this.registerGameOverState();
    return this;
  }

  /**
   * 전환 리스너 및 모든 상태 핸들러 통합 등록
   */
  public registerAll(): this {
    this.registerTransitionListener();
    this.registerStates();
    return this;
  }

  public build(): StateMachine {
    this.registerAll();
    return this._host.stateMachine;
  }

  /**
   * 문제 선택 페이즈 진입 가드 및 상태 전이
   */
  public enterQuestionPhase(): void {
    const sm = this._host.stateMachine;
    const stageProgressController = this._resolve(this._host.stageProgressController);
    if (
      sm.currentState === 'ANSWER_SELECT' ||
      sm.currentState === 'BOSS_CLIMAX' ||
      stageProgressController?.hasEnteredBossClimax
    ) {
      return;
    }
    sm.changeState('ANSWER_SELECT');
    this._host.setQuestionVisible(true);
    this._host.setAnswerLocked(false);
  }

  /**
   * BeatRunCoordinator phase 전환 이벤트 매핑
   */
  public handleBeatPhaseChange(phase: string): void {
    const bgmManager = this._resolve(this._host.bgmManager);
    if (phase === 'RUN_QUESTION') {
      bgmManager?.setPhase?.('RUN_QUESTION');
      this._host.stateMachine.changeState('RUN_QUESTION');
    } else if (phase === 'REST_READY') {
      bgmManager?.setPhase?.('REST_READY');
      this._host.stateMachine.changeState('RUN_QUESTION');
    } else if (phase === 'KEYNOTE_PERFORMANCE') {
      bgmManager?.setPhase?.('KEYNOTE_PERFORMANCE');
      this.enterQuestionPhase();
    } else if (phase === 'ANSWER_SELECT') {
      this.enterQuestionPhase();
    } else if (phase === 'STAR_COLLECT') {
      this._host.stateMachine.changeState('STAR_COLLECT');
    } else if (phase === 'HAZARD_EVADE') {
      this._host.stateMachine.changeState('HAZARD_EVADE');
    } else if (phase === 'ROUND_RESOLVE') {
      this._host.stateMachine.changeState('ROUND_RESOLVE');
    }
  }
}
