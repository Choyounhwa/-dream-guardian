import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  AppSessionFlowCoordinator,
  type AppSessionFlowHost,
} from '../../src/core/bootstrap/AppSessionFlowCoordinator.js';

describe('AppSessionFlowCoordinator (REFACTOR-SRP-010 / Issue #641)', () => {
  let host: AppSessionFlowHost;
  let coordinator: AppSessionFlowCoordinator;

  let currentChapter = 1;
  let selectedChapter = 1;
  let selectedSubLevel: number | undefined | null = undefined;
  let unlockedChapter = 3;
  let screenMode = 'game';
  let currentQuestion: any = { questionText: '1 + 1 = ?', answer: 2 };
  let consecutiveWrongCount = 0;
  let questionVisible = false;
  let answerLocked = false;
  let resultReturnTimer = 0;
  let climaxBarrageTimer = 0;
  let feedbackTimer = 0;
  let resultData: any = null;
  let totalSteps = 100;
  let totalJumps = 20;
  let totalDwellTime = 15;
  let menuHoverCleared = false;
  let playedNotesCleared = false;
  let locomotionDetectorsReset = false;
  let feedbackReset = false;

  beforeEach(() => {
    currentChapter = 1;
    selectedChapter = 1;
    selectedSubLevel = undefined;
    unlockedChapter = 3;
    screenMode = 'game';
    currentQuestion = { questionText: '1 + 1 = ?', answer: 2 };
    consecutiveWrongCount = 0;
    questionVisible = false;
    answerLocked = false;
    resultReturnTimer = 0;
    climaxBarrageTimer = 0;
    feedbackTimer = 0;
    resultData = null;
    totalSteps = 100;
    totalJumps = 20;
    totalDwellTime = 15;
    menuHoverCleared = false;
    playedNotesCleared = false;
    locomotionDetectorsReset = false;
    feedbackReset = false;

    host = {
      stateMachine: {
        currentState: 'MENU_MAIN',
        changeState: vi.fn(function (this: any, s: string) {
          this.currentState = s;
        }),
        canTransition: vi.fn(() => true),
      },
      transitionManager: {
        start: vi.fn(),
      },
      sessionLifecycle: {
        startSession: vi.fn(),
        endSession: vi.fn(),
        cancelAllReservations: vi.fn(),
        isTestSession: false,
      },
      sessionContext: {
        setActive: vi.fn(),
        resetContent: vi.fn(),
        resetSession: vi.fn(),
        setTestSession: vi.fn(),
        setStageContent: vi.fn(() => ({
          contentMode: 'default_csv',
          bundle: null,
          starNotes: [],
        })),
        isTestSession: false,
        starNotes: [],
      },
      sfx: {
        play: vi.fn(),
        stopDwellCharge: vi.fn(),
      },
      speech: {
        cancel: vi.fn(),
      },
      stageBgm: {
        stop: vi.fn(),
      },
      bgmManager: {
        stop: vi.fn(),
      },
      canvasManager: {
        virtualWidth: 1280,
        virtualHeight: 720,
      },
      effectManager: {
        playBurst: vi.fn(),
      },
      engine: {
        resumeGame: vi.fn(),
        pauseGame: vi.fn(),
      },
      menuInput: {
        reset: vi.fn(),
      },
      starCollectionInput: {
        reset: vi.fn(),
      },
      starNoteScheduler: {
        reset: vi.fn(),
      },
      hudLayer: {
        reset: vi.fn(),
      },
      armReachAnswerSelector: {
        closeWindow: vi.fn(),
      },
      pauseModal: {
        close: vi.fn(),
      },
      locomotionModal: {
        selectedMode: 'running',
      },
      tutorial: {
        isCompleted: vi.fn(() => true),
        show: vi.fn(),
      },
      dialogueManager: {
        getDialogue: vi.fn(() => null),
      },
      dialogueOverlayRenderer: {
        show: vi.fn(),
        clear: vi.fn(),
      },
      battle: {
        combo: 2,
        hp: 100,
        maxHp: 100,
        correctCount: 5,
        totalQuestions: 10,
        maxCombo: 3,
        reset: vi.fn(),
      },
      boss: {
        reset: vi.fn(),
      },
      guardian: {
        reset: vi.fn(),
      },
      beatCoordinator: {
        startRound: vi.fn(),
        pause: vi.fn(),
        setKeynotes: vi.fn(),
        setTrackConfig: vi.fn(),
        currentQuestion: { questionText: '2 + 2 = ?' },
        exerciseBeats: 8,
      },
      beatRoundResolver: {
        reset: vi.fn(),
        rhythmStats: { perfect: 10, good: 2, miss: 0 },
      },
      stageProgressController: {
        reset: vi.fn(),
        handleRoundSettled: vi.fn(),
        hasEnteredBossClimax: false,
      },
      bossFeverController: {
        reset: vi.fn(),
        stop: vi.fn(),
        setStageBundle: vi.fn(),
      },
      bossHazardController: {
        reset: vi.fn(),
        stop: vi.fn(),
        setStageBundle: vi.fn(),
      },
      phaseAHazardController: {
        stop: vi.fn(),
        reset: vi.fn(),
      },
      readyPositionController: {
        start: vi.fn(),
      },
      assaultWireHelper: {
        dispose: vi.fn(),
        startAssaultPhase: vi.fn((onSetup) => onSetup?.()),
      },
      battleEventBinder: {
        handleSpellCast: vi.fn(),
        handleBossDefeated: vi.fn(),
        handlePlayerDefeated: vi.fn(),
      },
      contentLoadService: {
        cancelCurrentRequest: vi.fn(),
      },
      questionBank: {
        setLevel: vi.fn(),
      },
      persistence: {
        saveProgress: vi.fn(() => ({ 1: 3 })),
        saveReward: vi.fn(),
        saveHighScore: vi.fn(),
      },

      getUnlockedChapter: () => unlockedChapter,
      getSelectedChapter: () => selectedChapter,
      setSelectedChapter: (ch: number) => {
        selectedChapter = ch;
      },
      getCurrentChapter: () => currentChapter,
      setCurrentChapter: (ch: number) => {
        currentChapter = ch;
      },
      getSelectedSubLevel: () => selectedSubLevel,
      setSelectedSubLevel: (sub?: number) => {
        selectedSubLevel = sub;
      },
      getScreenMode: () => screenMode,
      getCurrentQuestion: () => currentQuestion,
      setCurrentQuestion: (q: any) => {
        currentQuestion = q;
      },
      getConsecutiveWrongCount: () => consecutiveWrongCount,
      setConsecutiveWrongCount: (count: number) => {
        consecutiveWrongCount = count;
      },

      setQuestionVisible: (v: boolean) => {
        questionVisible = v;
      },
      setAnswerLocked: (l: boolean) => {
        answerLocked = l;
      },
      setResultReturnTimer: (t: number) => {
        resultReturnTimer = t;
      },
      setClimaxBarrageTimer: (t: number) => {
        climaxBarrageTimer = t;
      },
      setFeedbackTimer: (t: number) => {
        feedbackTimer = t;
      },
      resetFeedbackState: () => {
        feedbackReset = true;
      },
      resetMenuHover: () => {
        menuHoverCleared = true;
      },
      clearPlayedNoteAudioIds: () => {
        playedNotesCleared = true;
      },
      resetLocomotionDetectors: () => {
        locomotionDetectorsReset = true;
      },
      resetLocomotionTotals: () => {
        totalSteps = 0;
        totalJumps = 0;
        totalDwellTime = 0;
      },
      getTotalSteps: () => totalSteps,
      getTotalJumps: () => totalJumps,
      getTotalDwellTime: () => totalDwellTime,
      setResultData: (data: any) => {
        resultData = data;
      },
      persistSessionProgress: vi.fn(),
      persistSessionRewards: vi.fn(),
      persistSessionHighScore: vi.fn(),
    };

    coordinator = new AppSessionFlowCoordinator(host);
  });

  describe('selectChapter & selectSubLevel', () => {
    it('유효하지 않은 챕터 번호는 무시한다', () => {
      coordinator.selectChapter(0);
      expect(host.stateMachine.changeState).not.toHaveBeenCalled();

      coordinator.selectChapter(4); // unlockedChapter is 3
      expect(host.stateMachine.changeState).not.toHaveBeenCalled();
    });

    it('유효한 챕터 선택 시 MENU_SUB 전환, 사운드 및 이펙트를 재생한다', () => {
      coordinator.selectChapter(2);
      expect(selectedChapter).toBe(2);
      expect(host.stateMachine.changeState).toHaveBeenCalledWith('MENU_SUB');
      expect(menuHoverCleared).toBe(true);
      expect(host.menuInput.reset).toHaveBeenCalled();
      expect(host.sfx.play).toHaveBeenCalledWith('hover');
      expect(host.effectManager.playBurst).toHaveBeenCalled();
    });

    it('selectSubLevel(null)은 아무 동작도 하지 않는다', () => {
      coordinator.selectSubLevel(null);
      expect(host.stateMachine.changeState).not.toHaveBeenCalled();
    });

    it('selectSubLevel(-1)은 MENU_MAIN으로 복귀한다', () => {
      coordinator.selectSubLevel(-1);
      expect(menuHoverCleared).toBe(true);
      expect(host.menuInput.reset).toHaveBeenCalled();
      expect(host.sfx.play).toHaveBeenCalledWith('hover');
      expect(host.stateMachine.changeState).toHaveBeenCalledWith('MENU_MAIN');
    });

    it('selectSubLevel(0)은 서브레벨 없이 챕터를 시작한다', () => {
      const startSpy = vi.spyOn(coordinator, 'startChapter');
      selectedChapter = 2;
      coordinator.selectSubLevel(0);
      expect(host.sfx.play).toHaveBeenCalledWith('start');
      expect(startSpy).toHaveBeenCalledWith(2, undefined);
    });

    it('selectSubLevel(1)은 지정된 서브레벨과 함께 챕터를 시작한다', () => {
      const startSpy = vi.spyOn(coordinator, 'startChapter');
      selectedChapter = 2;
      coordinator.selectSubLevel(1);
      expect(host.sfx.play).toHaveBeenCalledWith('start');
      expect(startSpy).toHaveBeenCalledWith(2, 1);
    });
  });

  describe('startReadyPhase & startRunningPhase', () => {
    it('startReadyPhase는 READY_POSITION 전환 및 관련 컨트롤러를 리셋/시작한다', () => {
      coordinator.startReadyPhase();
      expect(host.stateMachine.changeState).toHaveBeenCalledWith('READY_POSITION');
      expect(questionVisible).toBe(false);
      expect(answerLocked).toBe(true);
      expect(playedNotesCleared).toBe(true);
      expect(host.starCollectionInput.reset).toHaveBeenCalled();
      expect(host.starNoteScheduler.reset).toHaveBeenCalled();
      expect(locomotionDetectorsReset).toBe(true);
      expect(host.readyPositionController?.start).toHaveBeenCalled();
    });

    it('startRunningPhase는 RUN_QUESTION 전환 및 라운드를 시작한다', () => {
      currentChapter = 2;
      selectedSubLevel = 1;
      coordinator.startRunningPhase();
      expect(host.stateMachine.changeState).toHaveBeenCalledWith('RUN_QUESTION');
      expect(questionVisible).toBe(true);
      expect(answerLocked).toBe(true);
      expect(playedNotesCleared).toBe(true);
      expect(host.beatCoordinator.startRound).toHaveBeenCalledWith({ chapter: 2, subLevel: 1 });
      expect(currentQuestion).toEqual({ questionText: '2 + 2 = ?' });
    });

    it('BOSS_CLIMAX 상태이거나 진입 완료된 경우 startRunningPhase는 조기 차단된다', () => {
      (host.stateMachine as any).currentState = 'BOSS_CLIMAX';
      coordinator.startRunningPhase();
      expect(host.beatCoordinator.startRound).not.toHaveBeenCalled();

      (host.stateMachine as any).currentState = 'READY_POSITION';
      (host.stageProgressController as any).hasEnteredBossClimax = true;
      coordinator.startRunningPhase();
      expect(host.beatCoordinator.startRound).not.toHaveBeenCalled();
    });
  });

  describe('startChapter', () => {
    it('범위를 벗어난 챕터(0 또는 6)는 시작하지 않는다', () => {
      coordinator.startChapter(0);
      coordinator.startChapter(6);
      expect(host.transitionManager.start).not.toHaveBeenCalled();
      expect(host.sessionLifecycle.startSession).not.toHaveBeenCalled();
    });

    it('정상적인 챕터 진입 시 트랜지션, 세션 시작, 리셋 및 READY_POSITION 전이가 수행된다', () => {
      coordinator.startChapter(1, 2);

      expect(host.transitionManager.start).toHaveBeenCalledWith('circleWipe', 0.6);
      expect(host.sessionLifecycle.startSession).toHaveBeenCalledWith(false);
      expect(host.contentLoadService.cancelCurrentRequest).toHaveBeenCalled();
      expect(host.sessionContext?.setStageContent).toHaveBeenCalled();
      expect(host.sessionContext?.setActive).toHaveBeenCalledWith(true);
      expect(host.engine.resumeGame).toHaveBeenCalled();
      expect(currentChapter).toBe(1);
      expect(selectedSubLevel).toBe(2);
      expect(host.battle.reset).toHaveBeenCalled();
      expect(host.boss.reset).toHaveBeenCalledWith(1);
      expect(host.guardian.reset).toHaveBeenCalled();
      expect(host.beatRoundResolver.reset).toHaveBeenCalled();
      expect(host.stageProgressController.reset).toHaveBeenCalled();
      expect(host.bossFeverController?.reset).toHaveBeenCalled();
      expect(host.bossHazardController?.reset).toHaveBeenCalled();
      expect(host.hudLayer?.reset).toHaveBeenCalled();
      expect(host.questionBank.setLevel).toHaveBeenCalledWith(1, 2);
      expect(totalSteps).toBe(0);
      expect(totalJumps).toBe(0);
      expect(totalDwellTime).toBe(0);
      expect(consecutiveWrongCount).toBe(0);
      expect(feedbackReset).toBe(true);
      expect(host.stateMachine.changeState).toHaveBeenCalledWith('READY_POSITION');
    });

    it('미완료 튜토리얼이 있는 경우 튜토리얼을 표시한다', () => {
      vi.mocked(host.tutorial!.isCompleted!).mockReturnValue(false);
      coordinator.startChapter(1);
      expect(host.tutorial!.show).toHaveBeenCalled();
    });

    it('챕터 인트로 대사가 있으면 dialogueOverlayRenderer에 표시한다', () => {
      vi.mocked(host.dialogueManager.getDialogue).mockReturnValue({
        speaker: 'Kkebi',
        text: '모험을 시작하자!',
      });
      coordinator.startChapter(1);
      expect(host.dialogueOverlayRenderer.show).toHaveBeenCalledWith({
        speaker: 'Kkebi',
        text: '모험을 시작하자!',
      });
    });
  });

  describe('handleAnswer', () => {
    it('screenMode가 game이 아니거나 currentQuestion이 없으면 무시한다', () => {
      screenMode = 'menu';
      coordinator.handleAnswer(1, 'correct', {} as any);
      expect(host.battleEventBinder.handleSpellCast).not.toHaveBeenCalled();

      screenMode = 'game';
      currentQuestion = null;
      coordinator.handleAnswer(1, 'correct', {} as any);
      expect(host.battleEventBinder.handleSpellCast).not.toHaveBeenCalled();
    });

    it('정답 처리 시 스펠 시전, 보스 격파, 대사 트리거 및 라운드 정산 알림을 중계한다', () => {
      vi.mocked(host.dialogueManager.getDialogue).mockReturnValue({
        speaker: 'Kkebi',
        text: '대단해!',
      });

      const resolveResult: any = {
        spellCast: true,
        bossDefeated: false,
      };

      coordinator.handleAnswer(0, 'correct', resolveResult);

      expect(host.sfx.stopDwellCharge).toHaveBeenCalled();
      expect(answerLocked).toBe(true);
      expect(questionVisible).toBe(false);
      expect(consecutiveWrongCount).toBe(0);
      expect(host.battleEventBinder.handleSpellCast).toHaveBeenCalled();
      expect(host.dialogueOverlayRenderer.show).toHaveBeenCalledWith({
        speaker: 'Kkebi',
        text: '대단해!',
      });
      expect(host.stageProgressController.handleRoundSettled).toHaveBeenCalledWith(resolveResult);
    });

    it('정답 시 보스가 격파되면 즉시 handleBossDefeated를 호출하고 반환한다', () => {
      const resolveResult: any = {
        spellCast: false,
        bossDefeated: true,
      };

      coordinator.handleAnswer(0, 'correct', resolveResult);

      expect(host.battleEventBinder.handleBossDefeated).toHaveBeenCalled();
      expect(host.stageProgressController.handleRoundSettled).not.toHaveBeenCalled();
    });

    it('오답 처리 시 오답 대사 발화 및 플레이어 패배 여부를 확인한다', () => {
      vi.mocked(host.dialogueManager.getDialogue).mockReturnValue({
        speaker: 'Kkebi',
        text: '힘내!',
      });

      const resolveResult: any = {
        playerDefeated: true,
      };

      coordinator.handleAnswer(1, 'wrong', resolveResult);

      expect(consecutiveWrongCount).toBe(1);
      expect(host.dialogueOverlayRenderer.show).toHaveBeenCalledWith({
        speaker: 'Kkebi',
        text: '힘내!',
      });
      expect(host.battleEventBinder.handlePlayerDefeated).toHaveBeenCalled();
      expect(host.stageProgressController.handleRoundSettled).toHaveBeenCalledWith(resolveResult, { immediate: true });
    });
  });

  describe('showResult', () => {
    it('승리 시 결과 데이터 생성, 영속화, SFX 재생 및 RESULT 상태로 전환한다', () => {
      coordinator.showResult(true);

      expect(host.sessionLifecycle.cancelAllReservations).toHaveBeenCalled();
      expect(host.sfx.stopDwellCharge).toHaveBeenCalled();
      expect(host.sfx.play).toHaveBeenCalledWith('posture_complete');
      expect(host.armReachAnswerSelector?.closeWindow).toHaveBeenCalled();
      expect(host.phaseAHazardController?.stop).toHaveBeenCalled();
      expect(host.bossHazardController?.stop).toHaveBeenCalled();
      expect(host.bossFeverController?.stop).toHaveBeenCalled();
      expect(host.sessionContext?.setActive).toHaveBeenCalledWith(false);
      expect(host.beatCoordinator.pause).toHaveBeenCalled();
      expect(host.engine.pauseGame).toHaveBeenCalled();

      expect(resultData).toBeDefined();
      expect(resultData.victory).toBe(true);
      expect(resultData.chapter).toBe(1);

      // 영속화 확인
      expect(host.persistSessionProgress).toHaveBeenCalled();
      expect(host.persistSessionRewards).toHaveBeenCalled();
      expect(host.persistSessionHighScore).toHaveBeenCalledWith(resultData);
      expect(resultReturnTimer).toBe(0);

      expect(host.transitionManager.start).toHaveBeenCalledWith('fadeToBlack', 0.4);
      expect(host.stateMachine.changeState).toHaveBeenCalledWith('RESULT');
    });

    it('패배 시 GAMEOVER 상태로 전환하고 영속화를 건너뛴다', () => {
      coordinator.showResult(false);

      expect(host.sfx.play).toHaveBeenCalledWith('wrong');
      expect(resultData.victory).toBe(false);
      expect(host.persistSessionProgress).not.toHaveBeenCalled();
      expect(host.stateMachine.changeState).toHaveBeenCalledWith('GAMEOVER');
    });

    it('테스트 세션인 경우 승리하더라도 영속화를 수행하지 않는다', () => {
      (host.sessionLifecycle as any).isTestSession = true;
      coordinator.showResult(true);

      expect(resultData.isTestSession).toBe(true);
      expect(host.persistSessionProgress).not.toHaveBeenCalled();
    });
  });

  describe('goToMenu & abortSession', () => {
    it('goToMenu는 모든 세션 상태를 정리하고 MENU_MAIN으로 복귀한다', () => {
      coordinator.goToMenu();

      expect(host.sessionLifecycle.cancelAllReservations).toHaveBeenCalled();
      expect(host.sessionLifecycle.endSession).toHaveBeenCalled();
      expect(host.speech?.cancel).toHaveBeenCalled();
      expect(host.assaultWireHelper?.dispose).toHaveBeenCalled();
      expect(host.contentLoadService.cancelCurrentRequest).toHaveBeenCalled();
      expect(host.sessionContext?.resetContent).toHaveBeenCalled();
      expect(host.sessionContext?.resetSession).toHaveBeenCalled();
      expect(host.sessionContext?.setTestSession).toHaveBeenCalledWith(false);
      expect(host.stageProgressController.reset).toHaveBeenCalled();
      expect(host.bossFeverController?.reset).toHaveBeenCalled();
      expect(host.bossHazardController?.reset).toHaveBeenCalled();
      expect(host.phaseAHazardController?.reset).toHaveBeenCalled();
      expect(climaxBarrageTimer).toBe(0);
      expect(consecutiveWrongCount).toBe(0);
      expect(host.dialogueOverlayRenderer.clear).toHaveBeenCalled();
      expect(host.sfx.stopDwellCharge).toHaveBeenCalled();
      expect(host.stageBgm?.stop).toHaveBeenCalled();
      expect(host.bgmManager?.stop).toHaveBeenCalled();
      expect(host.pauseModal?.close).toHaveBeenCalledWith(true);
      expect(host.starCollectionInput.reset).toHaveBeenCalled();
      expect(host.starNoteScheduler.reset).toHaveBeenCalled();
      expect(host.beatCoordinator.pause).toHaveBeenCalled();
      expect(feedbackTimer).toBe(0);
      expect(totalSteps).toBe(0);
      expect(totalJumps).toBe(0);
      expect(totalDwellTime).toBe(0);
      expect(host.transitionManager.start).toHaveBeenCalledWith('fadeIn', 0.3);
      expect(host.menuInput.reset).toHaveBeenCalled();
      expect(host.engine.resumeGame).toHaveBeenCalled();
    });

    it('abortSession은 goToMenu를 호출한다', () => {
      const menuSpy = vi.spyOn(coordinator, 'goToMenu');
      coordinator.abortSession();
      expect(menuSpy).toHaveBeenCalled();
    });
  });

  describe('restartGame & answerCurrentQuestion & applyDevPlayState', () => {
    it('restartGame은 메뉴 복귀 후 동일 챕터/서브레벨로 다시 시작한다', () => {
      const menuSpy = vi.spyOn(coordinator, 'goToMenu');
      const startSpy = vi.spyOn(coordinator, 'startChapter');
      selectedChapter = 3;
      selectedSubLevel = 2;

      coordinator.restartGame();

      expect(menuSpy).toHaveBeenCalled();
      expect(startSpy).toHaveBeenCalledWith(3, 2, { pack: null });
    });

    it('어설트 모드인 경우 어설트 재시작 콜백을 호출한다', () => {
      const restartAssault = vi.fn();
      coordinator.restartGame({ isAssault: true, onRestartAssault: restartAssault });
      expect(restartAssault).toHaveBeenCalled();
    });

    it('answerCurrentQuestion은 일시정지 중이 아닐 때 현재 문제에 답변을 제출한다', () => {
      (host.beatCoordinator as any).isAnswerOpen = true;
      (host.beatCoordinator as any).confirmAnswerByFallback = vi.fn();

      coordinator.answerCurrentQuestion(2);

      expect(host.sfx.play).toHaveBeenCalledWith('hover');
      expect((host.beatCoordinator as any).confirmAnswerByFallback).toHaveBeenCalledWith(2);
    });

    it('applyDevPlayState는 개발자 상태 파라미터를 정상 주입한다', () => {
      (host.battle as any).setHp = vi.fn();
      coordinator.applyDevPlayState({
        chapter: 2,
        playerHp: 50,
        playerMana: 75,
        combo: 5,
        bossHp: 8,
        bossMaxHp: 10,
        bossPhase: 'warning',
        question: { questionText: '3 * 3 = ?' } as any,
      });

      expect(currentChapter).toBe(2);
      expect(selectedChapter).toBe(2);
      expect(host.boss.reset).toHaveBeenCalledWith(2);
      expect((host.battle as any).setHp).toHaveBeenCalledWith(50);
      expect((host.battle as any)._mana).toBe(75);
      expect((host.battle as any)._combo).toBe(5);
      expect((host.boss as any)._hp).toBe(8);
      expect((host.boss as any)._maxHp).toBe(10);
      expect((host.boss as any)._phase).toBe('warning');
      expect(currentQuestion).toEqual({ questionText: '3 * 3 = ?' });
      expect(questionVisible).toBe(true);
    });
  });
});
