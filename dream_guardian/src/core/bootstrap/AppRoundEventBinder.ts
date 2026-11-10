/**
 * AppRoundEventBinder - 인게임 라운드 이벤트 바인더 및 모션 입력 라우터
 * [REFACTOR-SRP-011] (Issue #642)
 */

import { DEFAULT_CONFIG } from '../Config.js';
import { HORIZON_RATIO } from '../../../config/grid.config.js';
import { DEFAULT_FITNESS_ZONES, getAnswerButtonLayouts } from '../../../config/zone.config.js';
import { RUNNING_MAT_CONFIG } from '../../../config/running-mat.config.js';
import {
  DEFAULT_PHASE_A_HAZARD_CONFIG,
  PHASE_A_ACTIVE_HAZARD_PATTERNS,
  type PhaseAHazardPattern,
} from '../../../config/phase-a-hazard.config.js';
import { BEGINNER_PHASE_A_STAR_NOTES } from '../../data/beginnerRhythmRoutine.js';
import type { Keynote, FootKeynoteEvent } from '../../types/keynote.js';
import type { MotionIntentType } from '../../types/motion-intent.js';
import type { BossController } from '../../game/BossController.js';
import { BeatRunCoordinator, type BeatRunCoordinatorOptions } from '../../game/BeatRunCoordinator.js';
import {
  PhaseAHazardController,
  type PhaseAHazardBeatResult,
  type PhaseAHazardControllerOptions,
} from '../../game/PhaseAHazardController.js';
import { StageProgressController, type StageProgressControllerOptions } from '../../game/StageProgressController.js';
import { ReadyPositionController, type ReadyPositionControllerOptions } from '../../game/ReadyPositionController.js';
import { BossFeverController, type BossFeverControllerOptions } from '../../game/BossFeverController.js';
import { BossHazardController, type BossHazardControllerOptions } from '../../game/BossHazardController.js';

export interface AppRoundEventHost {
  getScreenMode(): string;
  isPaused?(): boolean;
  setFeedbackCustomText(text: string | null): void;
  setFeedbackCustomColor(color: string | null): void;
  setFeedbackCorrect(correct: boolean): void;
  setFeedbackTimer(timer: number): void;
  setAnswerLocked(locked: boolean): void;
  setRhythmStarCombo?(combo: number): void;
  getRhythmStarCombo?(): number;
  getFeedbackTimer?(): number;
  getFeedbackCustomColor?(): string | null;
  getFeedbackCorrect?(): boolean;
  getFeedbackCustomText?(): string | null;
  guardian?: any;
  bgmManager?: any;
  speech?: any;
  sfx?: any;
  bandSynth?: any;
  eventBus: any;
  stateMachine: any;
  stateMachineBuilder?: any;
  canvasManager: { virtualWidth: number; virtualHeight: number };
  skeletonEffect?: any;
  effectManager?: any;
  runningMatRenderer?: any;
  battle: any;
  battleEventBinder?: any;
  beatRoundResolver: any;
  handleAnswer(idx: number, status: any, resolveResult: any): void;
  showResult(isVictory: boolean): void;
  beatCoordinator?: any;
  phaseAHazardController?: any;
  bossHazardController?: any;
  bossFeverController?: any;
  starNoteScheduler?: any;
  motionIntentBus?: any;
  engine?: any;
  pauseModal?: { isOpen: boolean } | any;
  sessionLifecycle?: any;
  sessionContext?: any;
  getSessionContext?(): any;
  startRunningPhase?(): void;
  startAssaultPhase?(): void;
  isAssaultMode?(): boolean;
}

export class AppRoundEventBinder {
  private _unsubscribes: Array<() => void> = [];
  private _playedNoteAudioIds = new Set<string>();
  private _rhythmStarCombo = 0;

  constructor(private readonly _host: AppRoundEventHost) {}

  public get playedNoteAudioIds(): Set<string> {
    return this._playedNoteAudioIds;
  }

  public handleTimeout(): void {
    const { beatCoordinator, canvasManager, sfx, speech, skeletonEffect, effectManager, eventBus } = this._host;
    this._host.setFeedbackCustomText('시간 초과!');
    this._host.setFeedbackCustomColor('#FFAA33');
    this._host.setFeedbackCorrect(false);
    const spb = beatCoordinator?.rhythmEngine?.secondsPerBeat ?? 0.5;
    const restBeats = beatCoordinator?.answerRestBeats ?? 2;
    this._host.setFeedbackTimer(Math.max(0.8, spb * restBeats));
    sfx?.play('wrong');
    speech?.speak?.('시간 초과!');
    skeletonEffect?.triggerHit?.();
    const vw = canvasManager?.virtualWidth ?? 1280;
    const vh = canvasManager?.virtualHeight ?? 720;
    effectManager?.playFade?.({ x: vw * 0.5, y: vh * 0.22 - 30, text: '시간 초과!', color: '#FFAA33', fontSize: 36, duration: 0.8 });
    effectManager?.playAnswerEffect?.('timeout', vw * 0.5, vh * 0.5);
    (eventBus as any)?.emit?.('answer:timeout');
  }

  public handleAnswerSelected(idx: number): void {
    const { beatCoordinator, canvasManager, sfx, battle, effectManager, battleEventBinder, eventBus } = this._host;
    this._host.setFeedbackCustomText(null);
    this._host.setFeedbackCustomColor(null);
    sfx?.play('hover');
    this._host.setAnswerLocked(true);
    const correct = idx === beatCoordinator?.currentQuestion?.correctIndex;
    this._host.setFeedbackCorrect(correct);
    const spb = beatCoordinator?.rhythmEngine?.secondsPerBeat ?? 0.5;
    const restBeats = beatCoordinator?.answerRestBeats ?? 2;
    this._host.setFeedbackTimer(Math.max(0.8, spb * restBeats));

    const vw = canvasManager?.virtualWidth ?? 1280;
    const vh = canvasManager?.virtualHeight ?? 720;
    const buttonLayouts = getAnswerButtonLayouts(vw, vh);
    const targetBtn = (idx === 0 || idx === 1) ? buttonLayouts[idx] : null;
    const bx = targetBtn ? targetBtn.centerX : vw * 0.5;
    const by = targetBtn ? targetBtn.y + targetBtn.height / 2 : vh * 0.5;

    if (correct) {
      sfx?.play('correct');
      const nextCombo = (battle?.combo ?? 0) + 1;
      effectManager?.playAnswerEffect?.('correct', bx, by, nextCombo);
      effectManager?.playPreset?.('correct', bx, by);
      battleEventBinder?.triggerBossHitImpact?.(HORIZON_RATIO);
      eventBus?.emit?.('answer:correct', { mana: battle?.mana, combo: nextCombo });
    } else {
      sfx?.play('wrong');
      effectManager?.playAnswerEffect?.('wrong', bx, by);
      effectManager?.playPreset?.('wrong', bx, by);
      eventBus?.emit?.('answer:wrong', { hp: battle?.hp });
    }
  }

  public handleAnswerConfirmed(idx: number, _correct: boolean, status: any): void {
    this._host.stateMachine.changeState('ROUND_RESOLVE');
    const roundIdx = this._host.beatRoundResolver?.currentRoundIndex ?? 0;
    const resolveResult = this._host.beatRoundResolver?.resolveRound(status, roundIdx);
    this._host.handleAnswer(idx, status, resolveResult);
  }

  public handlePhaseABeatResolved(result: PhaseAHazardBeatResult | { evaded: boolean; damage?: number }): void {
    const { sfx, effectManager, canvasManager, battle, skeletonEffect, showResult } = this._host;
    const vw = canvasManager?.virtualWidth ?? 1280;
    const vh = canvasManager?.virtualHeight ?? 720;
    if (result.evaded) {
      sfx?.play('shield_deflect');
      effectManager?.playBurst?.({ x: vw * 0.5, y: vh * 0.76, count: 10, colors: ['#4DFFAA', '#FFFFFF'], duration: 0.28 });
      return;
    }
    const appliedDamage = result.damage ?? DEFAULT_PHASE_A_HAZARD_CONFIG.damagePerMiss;
    battle?.applyHazardDamage?.(appliedDamage);
    sfx?.play('player_hurt');
    skeletonEffect?.triggerHit?.();
    effectManager?.playHazardHit?.(vw * 0.5, vh * 0.76, appliedDamage);
    if (battle && !battle.isAlive) showResult(false);
  }

  public routeFootKeynote(event: FootKeynoteEvent): void {
    const {
      stateMachine,
      beatCoordinator,
      pauseModal,
      runningMatRenderer,
      canvasManager,
      effectManager,
      sfx,
      starNoteScheduler,
      engine,
      phaseAHazardController,
      bossHazardController,
      motionIntentBus,
    } = this._host;

    console.log(`[DG] 발 키노트 수신: ${event.source} ${event.foot} (Zone ${event.zoneId})`);
    if (motionIntentBus?.publish) {
      const intentType: MotionIntentType | null =
        event.foot === 'leftFoot' ? 'stepLeft' : (event.foot === 'rightFoot' ? 'stepRight' : (event.foot === 'centerFoot' ? 'jump' : null));
      if (intentType) {
        motionIntentBus.publish({
          type: intentType,
          confidence: 1.0,
          timestamp: engine?.elapsedTime ?? Date.now() / 1000,
          sourceCursor: event.foot === 'centerFoot' ? 'foot' : (event.foot === 'leftFoot' ? 'left_foot' : 'right_foot'),
        });
      }
    }

    if (this._host.getScreenMode() !== 'game') return;

    const isPaused = pauseModal?.isOpen ?? this._host.isPaused?.() ?? false;
    const currentState = stateMachine?.currentState;
    const beatPhase = beatCoordinator?.phase;
    const vw = canvasManager?.virtualWidth ?? 1280;
    const vh = canvasManager?.virtualHeight ?? 720;

    if ((currentState === 'RUN_QUESTION' || beatPhase === 'RUN_QUESTION') && !isPaused) {
      beatCoordinator?.recordStep?.();
      runningMatRenderer?.triggerMotionHit?.();
      const spb = beatCoordinator?.rhythmEngine?.secondsPerBeat || 0.5;
      const beatProg = beatCoordinator?.rhythmEngine?.beatProgress ?? 0;
      const distToBeat = Math.min(beatProg, 1.0 - beatProg) * spb;
      const rating = distToBeat <= 0.12 ? 'PERFECT' : (distToBeat <= 0.25 ? 'GOOD' : 'LATE');
      const targetZone = DEFAULT_FITNESS_ZONES.find((z) => z.id === event.zoneId);
      const jx = targetZone ? (targetZone.x + targetZone.width * 0.5) * vw : vw * 0.5;
      const jy = vh * (RUNNING_MAT_CONFIG.strikeLineYRatio ?? 0.86);
      effectManager?.playJudgmentText?.(jx, jy - 35, rating);
      sfx?.play(rating === 'PERFECT' ? 'crystal_pickup' : 'step_beat');
    }

    if (
      currentState === 'STAR_COLLECT' ||
      currentState === 'BOSS_CLIMAX' ||
      beatPhase === 'STAR_COLLECT' ||
      beatPhase === 'KEYNOTE_PERFORMANCE'
    ) {
      starNoteScheduler?.fromFoot?.(event, engine?.elapsedTime ?? 0);
    }

    if (currentState === 'HAZARD_EVADE' && !isPaused && phaseAHazardController) {
      const target = phaseAHazardController.activePattern;
      if (event.foot === 'leftFoot') phaseAHazardController.recordAction(target === 'balance_right' ? 'balance_right' : 'left_step');
      else if (event.foot === 'rightFoot') phaseAHazardController.recordAction(target === 'balance_left' ? 'balance_left' : 'right_step');
      else if (event.foot === 'centerFoot') phaseAHazardController.recordAction('jump');
    }

    if (currentState === 'BOSS_CLIMAX' && !isPaused && bossHazardController) {
      if (event.foot === 'leftFoot') bossHazardController.recordAction('step_left');
      else if (event.foot === 'rightFoot') bossHazardController.recordAction('step_right');
      else if (event.foot === 'centerFoot') bossHazardController.recordAction('jump');
    }

    const targetZone = DEFAULT_FITNESS_ZONES.find((z) => z.id === event.zoneId);
    if (targetZone) {
      effectManager?.playBurst?.({ x: (targetZone.x + targetZone.width * 0.5) * vw, y: (targetZone.y + targetZone.height * 0.5) * vh, count: 6, colors: ['#28E6FF', '#FFCB4D'], duration: 0.25 });
    }
  }

  public handleStarRating(starResult: any): void {
    const { stateMachine, bossFeverController, beatRoundResolver, canvasManager, effectManager, bandSynth, sfx } = this._host;
    const noteId = starResult.target ? (starResult.target as any).id : `note_${starResult.timestamp}_${starResult.zoneId}`;
    if (noteId) {
      if (this._playedNoteAudioIds.has(noteId)) return;
      this._playedNoteAudioIds.add(noteId);
    }

    if (stateMachine?.currentState === 'BOSS_CLIMAX' || (bossFeverController && bossFeverController.isActive)) {
      bossFeverController?.recordRating?.(starResult, noteId);
      beatRoundResolver?.resourceManager?.troopManager?.recordStarRating?.(starResult.rating, starResult.zoneId);
    } else {
      beatRoundResolver?.recordStarRating?.(starResult.rating, noteId);
    }

    let combo = this._host.getRhythmStarCombo?.() ?? this._rhythmStarCombo;
    combo = starResult.rating === 'Miss' ? 0 : combo + 1;
    this._rhythmStarCombo = combo;
    this._host.setRhythmStarCombo?.(combo);

    const currentFeverCombo = (bossFeverController && bossFeverController.isActive) ? bossFeverController.feverCombo : combo;
    const targetZone = DEFAULT_FITNESS_ZONES.find((z) => z.id === starResult.zoneId);
    const vw = canvasManager?.virtualWidth ?? 1280;
    const vh = canvasManager?.virtualHeight ?? 720;
    const jx = targetZone ? (targetZone.x + targetZone.width * 0.5) * vw : vw * 0.5;
    const jy = targetZone ? (targetZone.y + targetZone.height * 0.5) * vh : vh * 0.5;
    effectManager?.playJudgmentText?.(jx, jy, starResult.rating, currentFeverCombo);

    if (starResult.collected) {
      bandSynth?.playZoneSound?.(starResult.zoneId, starResult.rating === 'Perfect' ? 'sync' : 'stumble');
      sfx?.play?.('correct');
      if (targetZone) {
        effectManager?.playBurst?.({ x: (targetZone.x + targetZone.width * 0.5) * vw, y: (targetZone.y + targetZone.height * 0.5) * vh, count: 8, colors: ['#FFCB4D', '#FFFFFF'], duration: 0.25 });
      }
    } else if (starResult.rating === 'Miss') {
      bandSynth?.playZoneSound?.(starResult.zoneId, 'miss');
    }
  }

  public handleAdvanceToNextRound(nextRound: number): void {
    this._host.beatRoundResolver?.startNewRound?.(nextRound);
    this._host.startRunningPhase?.();
  }

  public handleEnterBossClimax(snapshot: any): void {
    console.log('[DG] Phase B (BOSS_CLIMAX) 진입 완료! 단일 자원 인계:', snapshot);
    const sessionContext = this._host.getSessionContext?.() ?? this._host.sessionContext;
    const bundle = sessionContext?.activeStageBundle ?? sessionContext?.stageBundle ?? null;
    if (bundle) {
      this._host.bossFeverController?.setStageBundle?.(bundle);
      this._host.bossHazardController?.setStageBundle?.(bundle);
    }
    const troopManager = this._host.beatRoundResolver?.resourceManager?.troopManager;
    if (troopManager && !troopManager.isActive) troopManager.startPhaseB?.(snapshot);
    if (this._host.bossFeverController && !this._host.bossFeverController.isActive) {
      this._host.bossFeverController.start?.(this._host.engine?.elapsedTime ?? 0, snapshot);
    }
    if (this._host.bossHazardController && !this._host.bossHazardController.isActive) {
      this._host.bossHazardController.start?.();
    }
  }

  public handleGameOver(): void {
    if (this._host.sessionLifecycle?.claimResultTransition?.()) {
      this._host.sessionLifecycle.schedule?.(() => this._host.showResult(false), 600);
    }
  }

  public handleReadyPositionComplete(): void {
    if (this._host.isAssaultMode?.()) {
      console.log('[DG] READY_POSITION 완료 → 보스 접근전(ASSAULT_ROUND) 시작');
      this._host.startAssaultPhase?.();
    } else {
      console.log('[DG] READY_POSITION 완료 → 본 게임(RUN_QUESTION) 시작');
      this._host.startRunningPhase?.();
    }
  }

  public renderFeedback(ctx: CanvasRenderingContext2D, w: number, h: number, castingFlash: number = 0): void {
    const feedbackTimer = this._host.getFeedbackTimer?.() ?? 0;
    if (feedbackTimer <= 0) return;
    const alpha = Math.min(1, feedbackTimer * 2);
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = `bold ${Math.min(84, w * 0.075)}px sans-serif`;
    const color = this._host.getFeedbackCustomColor?.() ?? (this._host.getFeedbackCorrect?.() ? '#4DFFAA' : '#FF4444');
    ctx.fillStyle = color;
    ctx.shadowColor = color;
    ctx.shadowBlur = 30;
    const text = this._host.getFeedbackCustomText?.() ?? (this._host.getFeedbackCorrect?.() ? '정답!' : '오답...');
    ctx.fillText(text, w / 2, h * 0.22);
    ctx.shadowBlur = 0;

    if (castingFlash > 0) {
      ctx.globalAlpha = castingFlash * 0.25;
      ctx.fillStyle = '#C889FF';
      ctx.fillRect(0, 0, w, h);
      ctx.globalAlpha = 1;
      ctx.fillStyle = '#fff';
      ctx.font = `bold ${Math.min(28, w * 0.024)}px sans-serif`;
      const stageName = this._host.guardian?.stageName ?? '';
      ctx.fillText(`수호신 캐스팅! (${stageName})`, w / 2, h * 0.55);
    }
    ctx.restore();
  }

  public getPhaseAStarNotes(): readonly Keynote[] {
    const sessionContext = this._host.getSessionContext?.() ?? this._host.sessionContext;
    return sessionContext?.starNotes ?? BEGINNER_PHASE_A_STAR_NOTES;
  }

  public getPhaseAHazardPattern(roundIndex?: number): PhaseAHazardPattern {
    const sessionContext = this._host.getSessionContext?.() ?? this._host.sessionContext;
    const bundle = sessionContext?.activeStageBundle ?? sessionContext?.stageBundle ?? null;
    if (bundle) return bundle.getPhaseAHazardPattern(roundIndex);
    const pool = PHASE_A_ACTIVE_HAZARD_PATTERNS;
    const idx = roundIndex !== undefined ? Math.abs(roundIndex - 1) % pool.length : 0;
    return pool[idx] ?? 'jump';
  }

  public createBeatCoordinatorCallbacks() {
    return {
      speakFn: (text: string) => {
        this._host.bgmManager?.setDucking?.(true);
        this._host.speech?.speakRunPhase?.(text);
        setTimeout(() => this._host.bgmManager?.setDucking?.(false), 2600);
      },
      onBeat: (event: any) => { (this._host.eventBus as any)?.emit?.('beat:tick', event); },
      onPhaseChange: (phase: any) => { this._host.stateMachineBuilder?.handleBeatPhaseChange?.(phase); },
      onTimeout: () => this.handleTimeout(),
      onAnswerSelected: (idx: number) => this.handleAnswerSelected(idx),
      onAnswerConfirmed: (idx: number, correct: boolean, status: any) =>
        this.handleAnswerConfirmed(idx, correct, status),
    };
  }

  public createPhaseAHazardCallbacks() {
    return {
      onBeatResolved: (result: PhaseAHazardBeatResult) => this.handlePhaseABeatResolved(result),
    };
  }

  public bindFootKeynote(footKeynoteInput: any): () => void {
    if (!footKeynoteInput) return () => {};
    const listener = (event: any) => this.routeFootKeynote(event);
    if (typeof footKeynoteInput.onEvent === 'function') footKeynoteInput.onEvent(listener);
    const unsub = () => { if (typeof footKeynoteInput.offEvent === 'function') footKeynoteInput.offEvent(listener); };
    this._unsubscribes.push(unsub);
    return unsub;
  }

  public bindStarNotes(starNoteScheduler: any): () => void {
    if (!starNoteScheduler) return () => {};
    const listener = (starResult: any) => this.handleStarRating(starResult);
    if (typeof starNoteScheduler.onRating === 'function') starNoteScheduler.onRating(listener);
    const unsub = () => { if (typeof starNoteScheduler.offRating === 'function') starNoteScheduler.offRating(listener); };
    this._unsubscribes.push(unsub);
    return unsub;
  }

  public createStageProgressCallbacks() {
    return {
      onAdvanceToNextRound: (nextRound: number) => this.handleAdvanceToNextRound(nextRound),
      onEnterBossClimax: (snapshot: any) => this.handleEnterBossClimax(snapshot),
      onGameOver: () => this.handleGameOver(),
    };
  }

  public createReadyPositionCallbacks() {
    return { onComplete: () => this.handleReadyPositionComplete() };
  }

  public createBeatCoordinator(options: Partial<BeatRunCoordinatorOptions> & {
    questionBank: any;
    battle: any;
    armReachAnswerSelector: any;
    sfx: any;
    answerRestBeats?: number;
  }): BeatRunCoordinator {
    return new BeatRunCoordinator({ ...options, ...this.createBeatCoordinatorCallbacks() });
  }

  public createPhaseAHazardController(options?: Partial<PhaseAHazardControllerOptions>): PhaseAHazardController {
    return new PhaseAHazardController({ intentBus: this._host.motionIntentBus, ...options, ...this.createPhaseAHazardCallbacks() });
  }

  public createStageProgressController(options?: Partial<StageProgressControllerOptions>): StageProgressController {
    return new StageProgressController({
      maxRounds: DEFAULT_CONFIG.battle.phaseAQuestionCount ?? 10,
      stateMachine: this._host.stateMachine,
      sessionLifecycle: this._host.sessionLifecycle,
      resourceProvider: this._host.beatRoundResolver,
      advanceDelayMs: 800,
      ...options,
      ...this.createStageProgressCallbacks(),
    });
  }

  public createReadyPositionController(options?: Partial<ReadyPositionControllerOptions>): ReadyPositionController {
    return new ReadyPositionController({
      countdownDuration: 3.0,
      startDisplayDuration: 0.4,
      sfx: this._host.sfx,
      ...options,
      ...this.createReadyPositionCallbacks(),
    });
  }

  public createBossFeverController(boss: BossController, options?: Partial<BossFeverControllerOptions>): BossFeverController {
    return new BossFeverController({
      battleState: this._host.battle,
      bossController: boss,
      stateMachine: this._host.stateMachine,
      scheduler: this._host.starNoteScheduler,
      config: DEFAULT_CONFIG.battle.fever,
      secondsPerBeat: options?.secondsPerBeat ?? 0.5,
      onVictory: (stats) => { console.log('[DG] Phase B 보스 격파 승리! 통계:', stats); this._host.battleEventBinder?.handleBossDefeated?.(stats, true); },
      onGameOver: (stats) => { console.log('[DG] Phase B 플레이어 패배... 통계:', stats); this._host.battleEventBinder?.handlePlayerDefeated?.(stats, true); },
      onDamageDealt: () => { this._host.battleEventBinder?.triggerBossHitImpact?.(0.35, true, false, 'correct'); },
      ...options,
    });
  }

  public createBossHazardController(
    boss: BossController,
    bossFeverController: BossFeverController,
    options?: Partial<BossHazardControllerOptions>,
  ): BossHazardController {
    return new BossHazardController({
      battleState: this._host.battle,
      bossController: boss,
      bossFeverController,
      minionTroopManager: this._host.beatRoundResolver?.resourceManager?.troopManager,
      eventBus: this._host.eventBus,
      config: DEFAULT_CONFIG.battle.bossHazard,
      onAttackStart: (attackType) => console.log(`[DG] Phase B 보스 패턴 공격 개시: ${attackType}`),
      onHazardResolved: (result) => this._host.battleEventBinder?.handleHazardResolved?.(result),
      ...options,
    });
  }

  public dispose(): void {
    for (const unsub of this._unsubscribes) unsub();
    this._unsubscribes = [];
    this._playedNoteAudioIds.clear();
  }
}
