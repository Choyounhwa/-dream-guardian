/**
 * AppSessionFlowCoordinator - 게임 세션 진행 및 라운드 전환 흐름 조정자
 *
 * [REFACTOR-SRP-010] (Issue #641)
 * - AppBootstrap에서 거대화된 게임 세션 진행 및 라운드 전환 흐름 로직 분리
 * - selectChapter, selectSubLevel, startReadyPhase, startRunningPhase, startAssaultPhase,
 *   startChapter, handleAnswer, showResult, goToMenu, abortSession 전담 캡슐화
 */

import { DEFAULT_CONFIG } from '../Config.js';
import { BEGINNER_PHASE_A_STAR_NOTES } from '../../data/beginnerRhythmRoutine.js';
import { CHAPTER_TRACK_PRESETS } from '../../../config/beat-motion.config.js';
import { calcStars, type ResultData } from '../../ui/ResultRenderer.js';
import {
  type PublishedContentPack,
  validatePublishedContentPack,
  computePublishedPackHash,
} from '../../data/PublishedContentPack.js';
import type { RoundAnswerStatus, RoundResolveResult } from '../../types/result.js';
import type { GeneratedQuestion } from '../../question/QuestionEvaluator.js';
import type { PhaseAHazardPattern } from '../../../config/phase-a-hazard.config.js';

export type ExtendedResultData = ResultData & { isTestSession?: boolean };

export interface DevPlayStateParams {
  chapter?: number;
  playerHp?: number;
  playerMaxHp?: number;
  playerMana?: number;
  combo?: number;
  bossHp?: number;
  bossMaxHp?: number;
  bossPhase?: 'idle' | 'warning' | 'attacking' | 'defeated';
  question?: GeneratedQuestion | null;
  hazardPattern?: PhaseAHazardPattern;
}

/**
 * 팩 유효성 및 contentHash 무결성 검증 (Issue #391)
 */
export function isVerifiedPublishedPack(
  pack: unknown,
  expectedHash?: string,
): pack is PublishedContentPack {
  if (!pack || typeof pack !== 'object') {
    return false;
  }
  const validation = validatePublishedContentPack(pack);
  if (!validation.valid) {
    return false;
  }
  const typedPack = pack as PublishedContentPack;
  const computedHash = computePublishedPackHash(typedPack);
  if (typedPack.contentHash !== computedHash) {
    return false;
  }
  if (expectedHash && typedPack.contentHash !== expectedHash) {
    return false;
  }
  return true;
}

export interface AppSessionFlowHost {
  // State machine & transitions
  readonly stateMachine: {
    currentState: string;
    changeState(state: string): void;
    canTransition(target: string): boolean;
  };
  readonly transitionManager: {
    start(type: string, duration: number): void;
  };

  // Session lifecycle & context
  readonly sessionLifecycle: {
    startSession(isTest: boolean): void;
    endSession(): void;
    cancelAllReservations(): void;
    claimResultTransition?(): boolean;
    readonly isTestSession?: boolean;
    schedule?(cb: () => void, delayMs: number): void;
  };
  readonly sessionContext?: {
    setActive(active: boolean): void;
    resetContent(): void;
    resetSession(): void;
    setTestSession(isTest: boolean): void;
    setStageContent(params: any): any;
    readonly isTestSession?: boolean;
    readonly starNotes?: any;
    readonly activeStageBundle?: any;
  } | null;
  readonly getSessionContext?: () => any;

  // Sound & Speech
  readonly sfx: {
    play(name: string): void;
    stopDwellCharge?(): void;
  };
  readonly speech?: {
    cancel(): void;
    resetFeedbackState?(): void;
  };
  readonly stageBgm?: {
    stop(): void;
  };
  readonly bgmManager?: {
    stop(): void;
  };

  // Rendering & Engine
  readonly canvasManager: {
    readonly virtualWidth: number;
    readonly virtualHeight: number;
  };
  readonly effectManager: {
    playBurst(opts: any): void;
  };
  readonly engine: {
    resumeGame(): void;
    pauseGame(): void;
  };

  // Input & UI
  readonly menuInput: {
    reset(): void;
  };
  readonly starCollectionInput: {
    reset(): void;
  };
  readonly starNoteScheduler: {
    reset(): void;
  };
  readonly hudLayer?: {
    reset(): void;
  };
  readonly armReachAnswerSelector?: {
    closeWindow(): void;
  };
  readonly pauseModal?: {
    isOpen?: boolean;
    close(resumed?: boolean): void;
  };
  readonly locomotionModal?: {
    readonly selectedMode: string;
  };
  readonly tutorial?: {
    isCompleted?(ch: number): boolean;
    show(): void;
  };
  readonly xGestureDetector?: {
    reset(): void;
  };
  readonly ensureCameraStarted?: () => Promise<void>;
  readonly dialogueManager: {
    reset?(): void;
    getDialogue(options: any): any;
  };
  readonly dialogueOverlayRenderer: {
    show(dialogue: any): void;
    clear(): void;
  };

  // Controllers & Detectors
  readonly battle: {
    combo: number;
    hp: number;
    maxHp: number;
    correctCount: number;
    totalQuestions: number;
    maxCombo: number;
    reset(): void;
    setHp?(hp: number): void;
  };
  readonly boss: {
    reset(ch: number): void;
    hp?: number;
    maxHp?: number;
  };
  readonly guardian: {
    reset(): void;
  };
  readonly beatCoordinator: {
    startRound(opts?: { chapter?: number; subLevel?: number; withCountIn?: boolean; difficultyProfile?: any }): void;
    pause(): void;
    setKeynotes(notes: any): void;
    setTrackConfig(cfg: any): void;
    readonly currentQuestion?: any;
    readonly exerciseBeats?: number;
    readonly isAnswerOpen?: boolean;
    confirmAnswerByFallback?(idx: number): void;
  };
  readonly beatRoundResolver: {
    reset(): void;
    readonly rhythmStats?: any;
  };
  readonly stageProgressController: {
    reset(): void;
    handleRoundSettled(res: RoundResolveResult, options?: any): void;
    readonly hasEnteredBossClimax?: boolean;
  };
  readonly bossFeverController?: {
    reset(): void;
    stop(): void;
    setStageBundle(bundle: any): void;
  } | null;
  readonly bossHazardController?: {
    reset(): void;
    stop(): void;
    setStageBundle(bundle: any): void;
  } | null;
  readonly phaseAHazardController?: {
    stop(): void;
    reset(): void;
  };
  readonly readyPositionController?: {
    start(): void;
  };
  readonly assaultWireHelper?: {
    dispose(): void;
    startAssaultPhase(onSetup?: () => void): void;
  };
  readonly battleEventBinder: {
    handleSpellCast(damage: number): void;
    handleBossDefeated(stats?: any, isFever?: boolean): void;
    handlePlayerDefeated(stats?: any, isFever?: boolean): void;
  };
  readonly contentLoadService: {
    cancelCurrentRequest(): void;
  };
  readonly questionBank: {
    setLevel(ch: number, subLevel?: number): void;
  };
  readonly persistence?: {
    saveProgress(chapter: number, stars: number, opts?: any): any;
    saveReward(chapter: number, stars: number, opts?: any): void;
    saveHighScore(result: any, opts?: any): void;
    isTutorialCompleted?(): boolean;
  };

  // Optional direct state bag (stateRef)
  readonly state?: any;

  // State accessors & mutators (optional if state bag is provided)
  readonly getUnlockedChapter?: () => number;
  readonly getSelectedChapter?: () => number;
  readonly setSelectedChapter?: (ch: number) => void;
  readonly getCurrentChapter?: () => number;
  readonly setCurrentChapter?: (ch: number) => void;
  readonly getSelectedSubLevel?: () => number | null | undefined;
  readonly setSelectedSubLevel?: (sub: number | undefined) => void;
  readonly getScreenMode?: () => string;
  readonly getCurrentQuestion?: () => any;
  readonly setCurrentQuestion?: (q: any) => void;
  readonly getConsecutiveWrongCount?: () => number;
  readonly setConsecutiveWrongCount?: (count: number) => void;
  readonly getActivePublishedPack?: () => PublishedContentPack | null;

  // Local state modifiers in AppBootstrap
  readonly flushPendingUIPresentation?: () => void;
  readonly setQuestionVisible?: (v: boolean) => void;
  readonly setAnswerLocked?: (v: boolean) => void;
  readonly setResultReturnTimer?: (v: number) => void;
  readonly setClimaxBarrageTimer?: (v: number) => void;
  readonly setFeedbackTimer?: (v: number) => void;
  readonly resetFeedbackState?: () => void;
  readonly resetMenuHover?: () => void;
  readonly clearPlayedNoteAudioIds?: () => void;
  readonly resetLocomotionDetectors?: () => void;
  readonly resetLocomotionTotals?: () => void;
  readonly getTotalSteps?: () => number;
  readonly getTotalJumps?: () => number;
  readonly getTotalDwellTime?: () => number;
  readonly setResultData?: (data: ExtendedResultData) => void;
  readonly persistSessionProgress?: (chapter: number, stars: number) => void;
  readonly persistSessionRewards?: (chapter: number, stars: number) => void;
  readonly persistSessionHighScore?: (result: any) => void;
}

export class AppSessionFlowCoordinator {
  constructor(public readonly host: AppSessionFlowHost) {}

  private _getUnlockedChapter(): number {
    return this.host.state?.unlockedChapter ?? (this.host.getUnlockedChapter ? this.host.getUnlockedChapter() : 1);
  }

  private _getSelectedChapter(): number {
    return this.host.state?.selectedChapter ?? (this.host.getSelectedChapter ? this.host.getSelectedChapter() : 1);
  }

  private _setSelectedChapter(ch: number): void {
    this.host.setSelectedChapter?.(ch);
    if (this.host.state) {
      try {
        this.host.state.selectedChapter = ch;
      } catch {
        // ignore if getter-only
      }
    }
  }

  private _getCurrentChapter(): number {
    return this.host.getCurrentChapter ? this.host.getCurrentChapter() : (this.host.state?.currentChapter ?? 1);
  }

  private _setCurrentChapter(ch: number): void {
    this.host.setCurrentChapter?.(ch);
    if (this.host.state) {
      try {
        this.host.state.currentChapter = ch;
      } catch {
        // ignore if getter-only
      }
    }
  }

  private _getSelectedSubLevel(): number | null | undefined {
    return this.host.getSelectedSubLevel ? this.host.getSelectedSubLevel() : this.host.state?.selectedSubLevel;
  }

  private _setSelectedSubLevel(sub: number | undefined): void {
    this.host.setSelectedSubLevel?.(sub);
    if (this.host.state) {
      try {
        this.host.state.selectedSubLevel = sub;
      } catch {
        // ignore if getter-only
      }
    }
  }

  private _getScreenMode(): string {
    return this.host.state?.screenMode ?? (this.host.getScreenMode ? this.host.getScreenMode() : 'game');
  }

  private _getCurrentQuestion(): any {
    return this.host.state ? this.host.state.currentQuestion : this.host.getCurrentQuestion?.();
  }

  private _setCurrentQuestion(q: any): void {
    if (this.host.state) {
      this.host.state.currentQuestion = q;
    }
    this.host.setCurrentQuestion?.(q);
  }

  private _getConsecutiveWrongCount(): number {
    return this.host.state?.consecutiveWrongCount ?? (this.host.getConsecutiveWrongCount ? this.host.getConsecutiveWrongCount() : 0);
  }

  private _setConsecutiveWrongCount(count: number): void {
    if (this.host.state) {
      this.host.state.consecutiveWrongCount = count;
    }
    this.host.setConsecutiveWrongCount?.(count);
  }

  private _setQuestionVisible(v: boolean): void {
    if (this.host.state) {
      this.host.state.questionVisible = v;
    }
    this.host.setQuestionVisible?.(v);
  }

  private _setAnswerLocked(l: boolean): void {
    if (this.host.state) {
      this.host.state.answerLocked = l;
    }
    this.host.setAnswerLocked?.(l);
  }

  private _resetMenuHover(): void {
    if (this.host.state) {
      this.host.state.menuHoverItem = null;
      this.host.state.menuHoverTimer = 0;
    }
    this.host.resetMenuHover?.();
  }

  private _resetLocomotionTotals(): void {
    if (this.host.state) {
      this.host.state.totalSteps = 0;
      this.host.state.totalJumps = 0;
      this.host.state.totalDwellTime = 0;
    }
    this.host.resetLocomotionTotals?.();
  }

  private _getTotalSteps(): number {
    return this.host.state?.totalSteps ?? (this.host.getTotalSteps ? this.host.getTotalSteps() : 0);
  }

  private _getTotalJumps(): number {
    return this.host.state?.totalJumps ?? (this.host.getTotalJumps ? this.host.getTotalJumps() : 0);
  }

  private _getTotalDwellTime(): number {
    return this.host.state?.totalDwellTime ?? (this.host.getTotalDwellTime ? this.host.getTotalDwellTime() : 0);
  }

  private _setResultData(data: ExtendedResultData): void {
    if (this.host.state) {
      this.host.state.resultData = data;
    }
    this.host.setResultData?.(data);
  }

  public selectChapter(ch: number): void {
    const unlocked = this._getUnlockedChapter();
    if (ch > 0 && ch <= unlocked) {
      this._setSelectedChapter(ch);
      this.host.stateMachine.changeState('MENU_SUB');
      this._resetMenuHover();
      this.host.menuInput.reset();
      this.host.sfx.play('hover');
      this.host.effectManager.playBurst({
        x: this.host.canvasManager.virtualWidth * 0.5,
        y: this.host.canvasManager.virtualHeight * 0.45,
        count: 12,
        colors: ['#28E6FF', '#4DFFAA'],
        duration: 0.35,
      });
    }
  }

  public selectSubLevel(sub: number | null): void {
    if (sub === null) return;
    this._resetMenuHover();
    this.host.menuInput.reset();
    if (sub === -1) {
      this.host.sfx.play('hover');
      this.host.stateMachine.changeState('MENU_MAIN');
    } else if (sub === 0) {
      this.host.sfx.play('start');
      this.startChapter(this._getSelectedChapter(), undefined);
    } else {
      this.host.sfx.play('start');
      this.startChapter(this._getSelectedChapter(), sub);
    }
  }

  public startReadyPhase(): void {
    this.host.stateMachine.changeState('READY_POSITION');
    this._setQuestionVisible(false);
    this._setAnswerLocked(true);
    this.host.clearPlayedNoteAudioIds?.();
    this.host.starCollectionInput.reset();
    this.host.starNoteScheduler.reset();
    this.host.resetLocomotionDetectors?.();
    this.host.readyPositionController?.start();
    console.log('[DG] READY_POSITION 시작 (신체 정렬 가이드 및 3초 카운트다운)');
  }

  public startRunningPhase(): void {
    if (
      this.host.stateMachine.currentState === 'BOSS_CLIMAX' ||
      this.host.stageProgressController.hasEnteredBossClimax
    ) {
      console.warn('[DG] Phase B 진행 중 신규 문제 출제 차단');
      return;
    }
    this.host.stateMachine.changeState('RUN_QUESTION');
    this._setQuestionVisible(true);
    this._setAnswerLocked(true);
    this.host.clearPlayedNoteAudioIds?.();
    this.host.starCollectionInput.reset();
    this.host.starNoteScheduler.reset();
    this.host.resetLocomotionDetectors?.();
    const ch = this._getCurrentChapter();
    const sub = this._getSelectedSubLevel();
    this.host.beatCoordinator.startRound({ chapter: ch, subLevel: sub ?? undefined });
    const currentQ = this.host.beatCoordinator.currentQuestion;
    this._setCurrentQuestion(currentQ);
    console.log(`[DG] ${this.host.beatCoordinator.exerciseBeats}박 문제 라운드 시작: ${currentQ?.questionText}`);
  }

  public startAssaultPhase(): void {
    this.host.assaultWireHelper?.startAssaultPhase(() => {
      this._setQuestionVisible(false);
      this._setAnswerLocked(true);
      this.host.clearPlayedNoteAudioIds?.();
      this.host.starCollectionInput.reset();
      this.host.starNoteScheduler.reset();
      this.host.resetLocomotionDetectors?.();
    });
  }

  public startChapter(
    ch: number,
    subLevel?: number,
    options?: { pack?: PublishedContentPack | null; isTestSession?: boolean; contentHash?: string },
  ): void {
    this.host.flushPendingUIPresentation?.();
    if (ch < 1 || ch > 5) return;
    const isTest = Boolean(options?.isTestSession);

    // Issue #391: URL 쿼리나 외부 입력으로 전달된 임의 미검증 데이터의 직접 실행 금지
    if (isTest) {
      if (!options?.pack || !isVerifiedPublishedPack(options.pack, options.contentHash)) {
        console.warn('[DG] 미검증 팩으로 테스트 세션 진입 차단');
        return;
      }
    }

    console.log(`[DG] Ch.${ch} SubLevel ${subLevel ?? 'ALL'} 시작${isTest ? ' (테스트 세션)' : ''}`);
    // Issue #278 (VFX-006): 메뉴 -> 게임 원형 와이프 트랜지션 (0.6초)
    this.host.transitionManager.start('circleWipe', 0.6);
    this.host.sessionLifecycle.startSession(isTest);
    this.host.contentLoadService.cancelCurrentRequest();

    const sessionContext = this.host.sessionContext ?? this.host.getSessionContext?.();

    // Issue #390 & #391: 스테이지 시작 전 콘텐츠 모드 및 테스트 세션 확정
    const stageKey = `ch${ch}`;
    const targetPack = options && 'pack' in options ? options.pack : this.host.getActivePublishedPack?.() ?? null;
    const resolvedContent = sessionContext
      ? sessionContext.setStageContent({
          stageId: stageKey,
          pack: targetPack,
          isTestSession: isTest,
          force: true,
        })
      : { contentMode: 'default_csv' as const, bundle: null, starNotes: BEGINNER_PHASE_A_STAR_NOTES };

    if (sessionContext) {
      sessionContext.setActive(true);
    }

    this.host.engine.resumeGame();
    this._setCurrentChapter(ch);
    this._setSelectedSubLevel(subLevel);
    this.host.battle.reset();
    this.host.boss.reset(ch);
    this.host.guardian.reset();
    this.host.beatRoundResolver.reset();
    this.host.stageProgressController.reset();
    this.host.bossFeverController?.reset();
    if (this.host.bossHazardController) {
      this.host.bossHazardController.reset();
    }
    if (resolvedContent.bundle) {
      this.host.bossFeverController?.setStageBundle(resolvedContent.bundle);
      this.host.bossHazardController?.setStageBundle(resolvedContent.bundle);
    }
    if (this.host.state) {
      this.host.state.climaxBarrageTimer = 0;
    }
    this.host.setClimaxBarrageTimer?.(0);
    this.host.starCollectionInput.reset();
    this.host.starNoteScheduler.reset();
    this.host.hudLayer?.reset();
    this.host.questionBank.setLevel(ch, subLevel);
    if (this.host.state) {
      this.host.state.feedbackTimer = 0;
      this.host.state.feedbackCustomText = null;
      this.host.state.feedbackCustomColor = null;
    }
    this.host.setFeedbackTimer?.(0);
    this.host.resetFeedbackState?.();

    if (resolvedContent.contentMode === 'custom_pack' && resolvedContent.bundle) {
      this.host.beatCoordinator.setKeynotes(resolvedContent.starNotes);
      this.host.beatCoordinator.setTrackConfig({
        bpm: resolvedContent.bundle.bpm,
      });
    } else {
      const trackPreset = CHAPTER_TRACK_PRESETS[ch];
      if (trackPreset) {
        this.host.beatCoordinator.setTrackConfig(trackPreset);
      }
      this.host.beatCoordinator.setKeynotes(sessionContext ? sessionContext.starNotes : BEGINNER_PHASE_A_STAR_NOTES);
    }
    this._setQuestionVisible(false);
    this._setAnswerLocked(true);
    if (this.host.state) {
      this.host.state.castingFlash = 0;
    }
    this._resetLocomotionTotals();
    this._setConsecutiveWrongCount(0);
    this.host.phaseAHazardController?.reset();
    this.host.pauseModal?.close();
    this.host.xGestureDetector?.reset();
    this.host.speech?.resetFeedbackState?.();
    this.host.ensureCameraStarted?.()?.catch?.(() => {});

    // Issue #219 (STORY-RENDER-001): 챕터 진입 시 보스 battle_start 대사 발화
    this.host.dialogueManager?.reset?.();
    this.host.dialogueOverlayRenderer?.clear?.();
    const startDialogue = this.host.dialogueManager?.getDialogue({
      trigger: 'battle_start',
      chapter: ch,
      force: true,
    }) ?? this.host.dialogueManager?.getDialogue({
      trigger: 'chapter_intro',
      chapter: ch,
    });
    if (startDialogue) {
      this.host.dialogueOverlayRenderer?.show(startDialogue);
    }

    // Issue #137 / Issue #634: 첫 플레이 시 튜토리얼 자동 표시 (테스트 세션에서는 팝업 및 저장 억제)
    if (!isTest && typeof localStorage !== 'undefined' && this.host.persistence && !this.host.persistence.isTutorialCompleted?.()) {
      this.host.tutorial?.show();
    } else if (this.host.tutorial && this.host.tutorial.isCompleted && !this.host.tutorial.isCompleted(ch)) {
      this.host.tutorial.show();
    }

    // Issue #202: 챕터 진입 시 READY_POSITION(정렬 가이드 & 3초 카운트다운) 선행
    this.startReadyPhase();
  }

  public startTestPlaySession(
    ch: number,
    options: { pack: PublishedContentPack; contentHash?: string; subLevel?: number },
  ): boolean {
    if (!options || !options.pack) {
      return false;
    }
    if (!isVerifiedPublishedPack(options.pack, options.contentHash)) {
      console.warn('[DG] 미검증 팩으로 테스트 세션 진입 차단');
      return false;
    }
    this.startChapter(ch, options.subLevel, {
      pack: options.pack,
      isTestSession: true,
      contentHash: options.contentHash,
    });
    return true;
  }

  public handleAnswer(idx: number, status: RoundAnswerStatus, resolveResult: RoundResolveResult): void {
    this.host.sfx.stopDwellCharge?.();
    if (this._getScreenMode() !== 'game') return;
    if (!this._getCurrentQuestion()) return;

    this._setAnswerLocked(true); // 연속 입력 방지
    const correct = status === 'correct';
    this._setQuestionVisible(false);

    console.log(`[DG] 라운드 정산 완료: 답 ${idx} (${correct ? '정답' : '오답'}) [${status}]`);

    const currentChapter = this._getCurrentChapter();

    if (correct) {
      this._setConsecutiveWrongCount(0);
      if (resolveResult.spellCast) {
        this.host.battleEventBinder.handleSpellCast(DEFAULT_CONFIG.battle.spellDamage);
      }

      if (resolveResult.bossDefeated) {
        this.host.battleEventBinder.handleBossDefeated();
        return;
      }

      // Issue #219 (STORY-RENDER-001): 정답/연속 정답 대사 발화
      const correctDialogue = this.host.dialogueManager.getDialogue({
        trigger: 'answer_correct',
        chapter: currentChapter,
        consecutiveCount: this.host.battle.combo,
      });
      if (correctDialogue) {
        this.host.dialogueOverlayRenderer.show(correctDialogue);
      }
    } else {
      const wrongCount = this._getConsecutiveWrongCount() + 1;
      this._setConsecutiveWrongCount(wrongCount);
      console.log(`[DG] ${status === 'timeout' ? '타임아웃' : '오답'} 정산 완료! 플레이어 HP: ${this.host.battle.hp}/${this.host.battle.maxHp}`);

      // Issue #219 (STORY-RENDER-001): 오답/연속 오답 시 깨비 위로 대사 발화
      const wrongDialogue = this.host.dialogueManager.getDialogue({
        trigger: 'answer_wrong',
        chapter: currentChapter,
        consecutiveCount: wrongCount,
      });
      if (wrongDialogue) {
        this.host.dialogueOverlayRenderer.show(wrongDialogue);
      }

      if (resolveResult.playerDefeated) {
        this.host.stageProgressController.handleRoundSettled(resolveResult, { immediate: true });
        this.host.battleEventBinder.handlePlayerDefeated();
        return;
      }
    }

    // Phase A 라운드 진행 및 10번째 라운드 후 Phase B 단일 인계 (Issue #241)
    this.host.stageProgressController.handleRoundSettled(resolveResult);
  }

  public showResult(victory: boolean): void {
    this.host.sessionLifecycle.cancelAllReservations();
    this.host.sfx.stopDwellCharge?.();
    if (victory) this.host.sfx.play('posture_complete');
    else this.host.sfx.play('wrong');
    console.log(`[DG] ${victory ? '승리' : '패배'}`);
    if (this.host.state) {
      this.host.state.resultReturnTimer = 0;
    }
    this.host.setResultReturnTimer?.(0);
    this._setAnswerLocked(true);
    this._setQuestionVisible(false);
    this.host.armReachAnswerSelector?.closeWindow();
    this.host.phaseAHazardController?.stop();
    if (this.host.bossHazardController) {
      this.host.bossHazardController.stop();
    }
    if (this.host.bossFeverController) {
      this.host.bossFeverController.stop();
    }
    const sessionContext = this.host.sessionContext ?? this.host.getSessionContext?.();
    if (sessionContext) {
      sessionContext.setActive(false);
    }
    this.host.beatCoordinator.pause();
    this.host.engine.pauseGame();
    const isTest = Boolean(this.host.sessionLifecycle.isTestSession || sessionContext?.isTestSession);
    const currentChapter = this._getCurrentChapter();
    const resultData: ExtendedResultData = {
      victory,
      chapter: currentChapter,
      correctCount: this.host.battle.correctCount,
      totalQuestions: this.host.battle.totalQuestions,
      maxCombo: this.host.battle.maxCombo,
      steps: this._getTotalSteps(),
      squats: 0,
      jumps: this._getTotalJumps(),
      elapsedTime: 60,
      dwellTime: this._getTotalDwellTime(),
      locomotionMode: (this.host.locomotionModal?.selectedMode as any) ?? 'running',
      rhythmStats: { ...this.host.beatRoundResolver.rhythmStats },
      isTestSession: isTest,
    };
    this._setResultData(resultData);

    // Issue #391: 일반 승리 시 진행도/하이스코어/보상 영속화 (테스트 세션 제외)
    if (victory && !isTest) {
      const stars = calcStars(this.host.battle.correctCount, this.host.battle.totalQuestions, 60);
      if (this.host.persistSessionProgress) {
        this.host.persistSessionProgress(currentChapter, stars);
      } else if (this.host.persistence) {
        this.host.persistence.saveProgress(currentChapter, stars, { isTestSession: isTest });
      }

      if (this.host.persistSessionRewards) {
        this.host.persistSessionRewards(currentChapter, stars);
      } else if (this.host.persistence) {
        this.host.persistence.saveReward(currentChapter, stars, { isTestSession: isTest });
      }

      if (this.host.persistSessionHighScore) {
        this.host.persistSessionHighScore(resultData);
      } else if (this.host.persistence) {
        this.host.persistence.saveHighScore(resultData, { isTestSession: isTest });
      }
    }

    // Issue #278 (VFX-006): 게임 -> 결과 전환: fadeToBlack (0.4초)
    const targetState = victory ? 'RESULT' : 'GAMEOVER';
    if (!this.host.stateMachine.canTransition(targetState)) {
      if (this.host.stateMachine.currentState === 'READY_POSITION') {
        this.host.stateMachine.changeState('RUN_QUESTION');
      }
      if (!this.host.stateMachine.canTransition(targetState)) {
        if (
          this.host.stateMachine.currentState === 'RUN_QUESTION' ||
          this.host.stateMachine.currentState === 'ANSWER_SELECT' ||
          this.host.stateMachine.currentState === 'STAR_COLLECT' ||
          this.host.stateMachine.currentState === 'HAZARD_EVADE'
        ) {
          this.host.stateMachine.changeState('ROUND_RESOLVE');
        }
      }
    }
    this.host.transitionManager.start('fadeToBlack', 0.4);
    this.host.stateMachine.changeState(targetState);
  }

  public goToMenu(): void {
    this.host.flushPendingUIPresentation?.();
    this.host.sessionLifecycle.cancelAllReservations();
    this.host.sessionLifecycle.endSession();
    this.host.speech?.cancel();
    this.host.assaultWireHelper?.dispose();
    this.host.contentLoadService.cancelCurrentRequest();
    const sessionContext = this.host.sessionContext ?? this.host.getSessionContext?.();
    if (sessionContext) {
      sessionContext.resetContent();
      sessionContext.resetSession();
      sessionContext.setTestSession(false);
    }
    this.host.stageProgressController.reset();
    if (this.host.bossFeverController) {
      this.host.bossFeverController.reset();
    }
    if (this.host.bossHazardController) {
      this.host.bossHazardController.reset();
    }
    this.host.phaseAHazardController?.reset();
    if (this.host.state) {
      this.host.state.climaxBarrageTimer = 0;
    }
    this.host.setClimaxBarrageTimer?.(0);
    this._setConsecutiveWrongCount(0);
    this.host.dialogueOverlayRenderer.clear();
    this.host.sfx.stopDwellCharge?.();
    this.host.stageBgm?.stop();
    this.host.bgmManager?.stop();
    this.host.pauseModal?.close(true);
    this.host.starCollectionInput.reset();
    this.host.starNoteScheduler.reset();
    this.host.beatCoordinator.pause();
    if (this.host.state) {
      this.host.state.feedbackTimer = 0;
      this.host.state.feedbackCustomText = null;
      this.host.state.feedbackCustomColor = null;
    }
    this.host.setFeedbackTimer?.(0);
    this.host.resetFeedbackState?.();
    this._resetLocomotionTotals();
    this.host.engine.resumeGame();
    console.log('[DG] 메뉴 복귀');
    // Issue #278 (VFX-006): 결과 -> 메뉴 전환: fadeIn (0.3초)
    this.host.transitionManager.start('fadeIn', 0.3);
    this.host.stateMachine.changeState('MENU_MAIN');
    this.host.menuInput.reset();
  }

  public abortSession(): void {
    this.goToMenu();
  }

  public restartGame(options?: { isAssault?: boolean; onRestartAssault?: () => void }): void {
    if (options?.isAssault && options.onRestartAssault) {
      options.onRestartAssault();
      return;
    }
    this.goToMenu();
    this.startChapter(this._getSelectedChapter(), this._getSelectedSubLevel() ?? undefined, {
      pack: this.host.getActivePublishedPack?.() ?? null,
    });
  }

  public answerCurrentQuestion(idx: number): void {
    if (this.host.pauseModal && (this.host.pauseModal as any).isOpen) return;
    if ((this.host.beatCoordinator as any)?.isAnswerOpen) {
      this.host.sfx.play('hover');
      (this.host.beatCoordinator as any).confirmAnswerByFallback(idx);
    }
  }

  public applyDevPlayState(params: DevPlayStateParams): void {
    if (params.chapter !== undefined && params.chapter >= 1 && params.chapter <= 5) {
      this._setCurrentChapter(params.chapter);
      this._setSelectedChapter(params.chapter);
      this.host.boss.reset(params.chapter);
    }
    if (params.playerHp !== undefined) {
      this.host.battle.setHp?.(params.playerHp);
    }
    if (params.playerMana !== undefined) {
      (this.host.battle as any)._mana = params.playerMana;
    }
    if (params.combo !== undefined) {
      (this.host.battle as any)._combo = params.combo;
    }
    if (params.bossHp !== undefined) {
      (this.host.boss as any)._hp = params.bossHp;
    }
    if (params.bossMaxHp !== undefined) {
      (this.host.boss as any)._maxHp = params.bossMaxHp;
    }
    if (params.bossPhase !== undefined) {
      (this.host.boss as any)._phase = params.bossPhase;
    }
    if (params.question !== undefined) {
      this._setCurrentQuestion(params.question);
      (this.host.beatCoordinator as any)._currentQuestion = params.question;
      this._setQuestionVisible(true);
    }
    if (params.hazardPattern !== undefined && this.host.phaseAHazardController) {
      (this.host.phaseAHazardController as any)._activePattern = params.hazardPattern;
      (this.host.phaseAHazardController as any)._active = true;
    }
  }
}
