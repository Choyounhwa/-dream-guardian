import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  AppRoundEventBinder,
  type AppRoundEventHost,
} from '../../src/core/bootstrap/AppRoundEventBinder.js';
import type { FootKeynoteEvent } from '../../src/types/keynote.js';

describe('AppRoundEventBinder [REFACTOR-SRP-011] (#642)', () => {
  let host: AppRoundEventHost;
  let binder: AppRoundEventBinder;

  let feedbackText: string | null = null;
  let feedbackColor: string | null = null;
  let feedbackCorrect = false;
  let feedbackTimer = 0;
  let answerLocked = false;
  let rhythmStarCombo = 0;

  beforeEach(() => {
    feedbackText = null;
    feedbackColor = null;
    feedbackCorrect = false;
    feedbackTimer = 0;
    answerLocked = false;
    rhythmStarCombo = 0;

    host = {
      getScreenMode: vi.fn().mockReturnValue('game'),
      isPaused: vi.fn().mockReturnValue(false),
      setFeedbackCustomText: vi.fn((text) => { feedbackText = text; }),
      setFeedbackCustomColor: vi.fn((color) => { feedbackColor = color; }),
      setFeedbackCorrect: vi.fn((correct) => { feedbackCorrect = correct; }),
      setFeedbackTimer: vi.fn((timer) => { feedbackTimer = timer; }),
      setAnswerLocked: vi.fn((locked) => { answerLocked = locked; }),
      setRhythmStarCombo: vi.fn((combo) => { rhythmStarCombo = combo; }),
      getRhythmStarCombo: vi.fn(() => rhythmStarCombo),

      bgmManager: {
        setDucking: vi.fn(),
      },
      speech: {
        speakRunPhase: vi.fn(),
        speak: vi.fn(),
      },
      sfx: {
        play: vi.fn(),
      },
      bandSynth: {
        playZoneSound: vi.fn(),
      },
      eventBus: {
        emit: vi.fn(),
        on: vi.fn(),
        off: vi.fn(),
      },
      stateMachine: {
        currentState: 'RUN_QUESTION',
        changeState: vi.fn((state) => {
          (host.stateMachine as any).currentState = state;
        }),
      },
      stateMachineBuilder: {
        handleBeatPhaseChange: vi.fn(),
      },
      canvasManager: {
        virtualWidth: 1280,
        virtualHeight: 720,
      },
      skeletonEffect: {
        triggerHit: vi.fn(),
      },
      effectManager: {
        playFade: vi.fn(),
        playAnswerEffect: vi.fn(),
        playPreset: vi.fn(),
        playJudgmentText: vi.fn(),
        playBurst: vi.fn(),
        playHazardHit: vi.fn(),
      },
      runningMatRenderer: {
        triggerMotionHit: vi.fn(),
      },
      battle: {
        combo: 2,
        mana: 50,
        hp: 100,
        isAlive: true,
        applyHazardDamage: vi.fn((dmg) => {
          host.battle.hp -= dmg;
          if (host.battle.hp <= 0) {
            host.battle.isAlive = false;
          }
        }),
      },
      battleEventBinder: {
        triggerBossHitImpact: vi.fn(),
      },
      beatRoundResolver: {
        currentRoundIndex: 1,
        resolveRound: vi.fn().mockReturnValue({ score: 100, stars: 3 }),
        startNewRound: vi.fn(),
        recordStarRating: vi.fn(),
        resourceManager: {
          troopManager: {
            isActive: false,
            startPhaseB: vi.fn(),
            recordStarRating: vi.fn(),
          },
        },
      },
      handleAnswer: vi.fn(),
      showResult: vi.fn(),

      beatCoordinator: {
        phase: 'RUN_QUESTION',
        currentQuestion: { correctIndex: 1 },
        rhythmEngine: {
          secondsPerBeat: 0.5,
          beatProgress: 0.05,
        },
        answerRestBeats: 2,
        recordStep: vi.fn(),
      },
      phaseAHazardController: {
        activePattern: 'jump',
        recordAction: vi.fn(),
      },
      bossHazardController: {
        isActive: false,
        start: vi.fn(),
        recordAction: vi.fn(),
        setStageBundle: vi.fn(),
      },
      bossFeverController: {
        isActive: false,
        feverCombo: 5,
        start: vi.fn(),
        recordRating: vi.fn(),
        setStageBundle: vi.fn(),
      },
      starNoteScheduler: {
        fromFoot: vi.fn(),
        onRating: vi.fn(),
      },
      motionIntentBus: {
        publish: vi.fn(),
      },
      engine: {
        elapsedTime: 12.34,
      },
      pauseModal: {
        isOpen: false,
      },
      sessionLifecycle: {
        claimResultTransition: vi.fn().mockReturnValue(true),
        schedule: vi.fn((cb, _delay) => cb()),
      },
      sessionContext: {
        starNotes: [{ id: 'k1' }],
        activeStageBundle: {
          getPhaseAHazardPattern: vi.fn().mockReturnValue('duck'),
        },
      },
      startRunningPhase: vi.fn(),
      startAssaultPhase: vi.fn(),
      isAssaultMode: vi.fn().mockReturnValue(false),
    };

    binder = new AppRoundEventBinder(host);
  });

  describe('1. BeatCoordinator 콜백 및 타임아웃/답안 처리', () => {
    it('speakFn 호출 시 BGM ducking 및 음성 출력을 수행해야 한다', () => {
      vi.useFakeTimers();
      const callbacks = binder.createBeatCoordinatorCallbacks();
      callbacks.speakFn('문제 등장!');
      expect(host.bgmManager.setDucking).toHaveBeenCalledWith(true);
      expect(host.speech.speakRunPhase).toHaveBeenCalledWith('문제 등장!');

      vi.advanceTimersByTime(2600);
      expect(host.bgmManager.setDucking).toHaveBeenCalledWith(false);
      vi.useRealTimers();
    });

    it('onBeat 및 onPhaseChange 이벤트를 정상 전달해야 한다', () => {
      const callbacks = binder.createBeatCoordinatorCallbacks();
      callbacks.onBeat({ beatIndex: 4 });
      expect(host.eventBus.emit).toHaveBeenCalledWith('beat:tick', { beatIndex: 4 });

      callbacks.onPhaseChange('ANSWER_REACH');
      expect(host.stateMachineBuilder.handleBeatPhaseChange).toHaveBeenCalledWith('ANSWER_REACH');
    });

    it('handleTimeout 호출 시 "시간 초과!" 피드백, SFX, 이펙트 및 answer:timeout 이벤트를 발생시켜야 한다', () => {
      binder.handleTimeout();
      expect(host.setFeedbackCustomText).toHaveBeenCalledWith('시간 초과!');
      expect(host.setFeedbackCustomColor).toHaveBeenCalledWith('#FFAA33');
      expect(host.setFeedbackCorrect).toHaveBeenCalledWith(false);
      expect(host.setFeedbackTimer).toHaveBeenCalledWith(1.0); // max(0.8, 0.5 * 2) = 1.0
      expect(feedbackText).toBe('시간 초과!');
      expect(feedbackColor).toBe('#FFAA33');
      expect(feedbackCorrect).toBe(false);
      expect(feedbackTimer).toBe(1.0);
      expect(host.sfx.play).toHaveBeenCalledWith('wrong');
      expect(host.speech.speak).toHaveBeenCalledWith('시간 초과!');
      expect(host.skeletonEffect.triggerHit).toHaveBeenCalled();
      expect(host.effectManager.playFade).toHaveBeenCalled();
      expect(host.effectManager.playAnswerEffect).toHaveBeenCalledWith('timeout', 640, 360);
      expect(host.eventBus.emit).toHaveBeenCalledWith('answer:timeout');
    });

    it('handleAnswerSelected에서 정답 선택 시 콤보 증가, 이펙트 재생 및 answer:correct 이벤트를 발생시켜야 한다', () => {
      binder.handleAnswerSelected(1); // correctIndex = 1
      expect(host.setFeedbackCustomText).toHaveBeenCalledWith(null);
      expect(host.setFeedbackCorrect).toHaveBeenCalledWith(true);
      expect(host.setAnswerLocked).toHaveBeenCalledWith(true);
      expect(answerLocked).toBe(true);
      expect(feedbackCorrect).toBe(true);
      expect(host.sfx.play).toHaveBeenCalledWith('hover');
      expect(host.sfx.play).toHaveBeenCalledWith('correct');
      expect(host.effectManager.playAnswerEffect).toHaveBeenCalledWith('correct', expect.any(Number), expect.any(Number), 3);
      expect(host.battleEventBinder.triggerBossHitImpact).toHaveBeenCalled();
      expect(host.eventBus.emit).toHaveBeenCalledWith('answer:correct', { mana: 50, combo: 3 });
    });

    it('handleAnswerSelected에서 오답 선택 시 오답 SFX, 이펙트 및 answer:wrong 이벤트를 발생시켜야 한다', () => {
      binder.handleAnswerSelected(0); // correctIndex = 1
      expect(host.setFeedbackCorrect).toHaveBeenCalledWith(false);
      expect(feedbackCorrect).toBe(false);
      expect(host.sfx.play).toHaveBeenCalledWith('wrong');
      expect(host.effectManager.playAnswerEffect).toHaveBeenCalledWith('wrong', expect.any(Number), expect.any(Number));
      expect(host.eventBus.emit).toHaveBeenCalledWith('answer:wrong', { hp: 100 });
    });

    it('handleAnswerConfirmed 호출 시 ROUND_RESOLVE 전이 및 handleAnswer를 호출해야 한다', () => {
      binder.handleAnswerConfirmed(1, true, 'correct');
      expect(host.stateMachine.changeState).toHaveBeenCalledWith('ROUND_RESOLVE');
      expect(host.beatRoundResolver.resolveRound).toHaveBeenCalledWith('correct', 1);
      expect(host.handleAnswer).toHaveBeenCalledWith(1, 'correct', { score: 100, stars: 3 });
    });
  });

  describe('2. PhaseAHazardController 콜백 및 데미지/회피 처리', () => {
    it('회피 성공 시 shield_deflect 사운드 및 파티클 버스트를 재생해야 한다', () => {
      binder.handlePhaseABeatResolved({ evaded: true, damage: 0 });
      expect(host.sfx.play).toHaveBeenCalledWith('shield_deflect');
      expect(host.effectManager.playBurst).toHaveBeenCalledWith(
        expect.objectContaining({ count: 10, colors: ['#4DFFAA', '#FFFFFF'] })
      );
      expect(host.battle.applyHazardDamage).not.toHaveBeenCalled();
    });

    it('회피 실패(피격) 시 데미지 적용, 피격 SFX, 스켈레톤 히트 및 장판 히트 이펙트를 재생해야 한다', () => {
      binder.handlePhaseABeatResolved({ evaded: false, damage: 25 });
      expect(host.battle.applyHazardDamage).toHaveBeenCalledWith(25);
      expect(host.sfx.play).toHaveBeenCalledWith('player_hurt');
      expect(host.skeletonEffect.triggerHit).toHaveBeenCalled();
      expect(host.effectManager.playHazardHit).toHaveBeenCalledWith(640, 720 * 0.76, 25);
    });

    it('피격으로 플레이어 사망 시 showResult(false)를 호출해야 한다', () => {
      host.battle.hp = 20;
      binder.handlePhaseABeatResolved({ evaded: false, damage: 25 });
      expect(host.battle.isAlive).toBe(false);
      expect(host.showResult).toHaveBeenCalledWith(false);
    });
  });

  describe('3. footKeynoteInput 모션 입력 라우터', () => {
    it('발 키노트 수신 시 MotionIntentBus에 인텐트를 발행해야 한다', () => {
      const event: FootKeynoteEvent = {
        source: 'knee-proxy',
        foot: 'leftFoot',
        zoneId: 9,
        confidence: 0.9,
        timestamp: 12.34,
      };
      binder.routeFootKeynote(event);
      expect(host.motionIntentBus.publish).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'stepLeft',
          sourceCursor: 'left_foot',
        })
      );
    });

    it('RUN_QUESTION 페이즈에서 발 키노트 입력 시 스텝 기록, 매트 히트, 판정 텍스트 및 사운드를 연동해야 한다', () => {
      (host.stateMachine as any).currentState = 'RUN_QUESTION';
      const event: FootKeynoteEvent = {
        source: 'knee-proxy',
        foot: 'rightFoot',
        zoneId: 11,
        confidence: 0.9,
        timestamp: 12.34,
      };
      binder.routeFootKeynote(event);
      expect(host.beatCoordinator.recordStep).toHaveBeenCalled();
      expect(host.runningMatRenderer.triggerMotionHit).toHaveBeenCalled();
      expect(host.effectManager.playJudgmentText).toHaveBeenCalled();
      expect(host.effectManager.playBurst).toHaveBeenCalled();
    });

    it('HAZARD_EVADE 페이즈에서 발 키노트 입력 시 PhaseAHazardController에 액션을 전달해야 한다', () => {
      (host.stateMachine as any).currentState = 'HAZARD_EVADE';
      (host.beatCoordinator as any).phase = 'HAZARD_EVADE';

      binder.routeFootKeynote({ source: 'knee-proxy', foot: 'leftFoot', zoneId: 9, confidence: 1, timestamp: 1 });
      expect(host.phaseAHazardController.recordAction).toHaveBeenCalledWith('left_step');

      binder.routeFootKeynote({ source: 'knee-proxy', foot: 'centerFoot', zoneId: 10, confidence: 1, timestamp: 2 });
      expect(host.phaseAHazardController.recordAction).toHaveBeenCalledWith('jump');
    });

    it('BOSS_CLIMAX 페이즈에서 발 키노트 입력 시 BossHazardController에 액션을 전달해야 한다', () => {
      (host.stateMachine as any).currentState = 'BOSS_CLIMAX';
      (host.beatCoordinator as any).phase = 'BOSS_CLIMAX';

      binder.routeFootKeynote({ source: 'knee-proxy', foot: 'rightFoot', zoneId: 11, confidence: 1, timestamp: 1 });
      expect(host.bossHazardController.recordAction).toHaveBeenCalledWith('step_right');

      binder.routeFootKeynote({ source: 'knee-proxy', foot: 'centerFoot', zoneId: 10, confidence: 1, timestamp: 2 });
      expect(host.bossHazardController.recordAction).toHaveBeenCalledWith('jump');
    });

    it('STAR_COLLECT 또는 BOSS_CLIMAX 페이즈에서 starNoteScheduler.fromFoot을 호출해야 한다', () => {
      (host.stateMachine as any).currentState = 'STAR_COLLECT';
      const event: FootKeynoteEvent = { source: 'knee-proxy', foot: 'leftFoot', zoneId: 9, confidence: 1, timestamp: 1 };
      binder.routeFootKeynote(event);
      expect(host.starNoteScheduler.fromFoot).toHaveBeenCalledWith(event, 12.34);
    });
  });

  describe('4. StarNoteScheduler 레이팅 콜백', () => {
    it('별노트 수집 및 레이팅 발생 시 중복 방지, 콤보 갱신, 효과음 및 버스트 이펙트를 처리해야 한다', () => {
      binder.handleStarRating({
        target: { id: 'note_1' },
        rating: 'Perfect',
        zoneId: 7,
        collected: true,
        timestamp: 1.0,
      });

      expect(host.beatRoundResolver.recordStarRating).toHaveBeenCalledWith('Perfect', 'note_1');
      expect(host.setRhythmStarCombo).toHaveBeenCalledWith(1);
      expect(rhythmStarCombo).toBe(1);
      expect(host.bandSynth.playZoneSound).toHaveBeenCalledWith(7, 'sync');
      expect(host.sfx.play).toHaveBeenCalledWith('correct');
      expect(host.effectManager.playBurst).toHaveBeenCalled();

      // 중복 수신 시 2회차 무시
      binder.handleStarRating({
        target: { id: 'note_1' },
        rating: 'Perfect',
        zoneId: 7,
        collected: true,
        timestamp: 1.0,
      });
      expect(host.beatRoundResolver.recordStarRating).toHaveBeenCalledTimes(1);
    });
  });

  describe('5. StageProgressController 콜백', () => {
    it('onAdvanceToNextRound 호출 시 새 라운드 시작 및 러닝 페이즈를 시작해야 한다', () => {
      binder.handleAdvanceToNextRound(2);
      expect(host.beatRoundResolver.startNewRound).toHaveBeenCalledWith(2);
      expect(host.startRunningPhase).toHaveBeenCalled();
    });

    it('onEnterBossClimax 호출 시 스테이지 번들 주입 및 Phase B 컨트롤러를 시작해야 한다', () => {
      const snapshot = { totalStars: 10 };
      binder.handleEnterBossClimax(snapshot);
      expect(host.bossFeverController.setStageBundle).toHaveBeenCalled();
      expect(host.bossHazardController.setStageBundle).toHaveBeenCalled();
      expect(host.beatRoundResolver.resourceManager.troopManager.startPhaseB).toHaveBeenCalledWith(snapshot);
      expect(host.bossFeverController.start).toHaveBeenCalledWith(12.34, snapshot);
      expect(host.bossHazardController.start).toHaveBeenCalled();
    });

    it('onGameOver 호출 시 세션 라이프사이클을 통해 결과 화면(패배)을 표시해야 한다', () => {
      binder.handleGameOver();
      expect(host.sessionLifecycle.claimResultTransition).toHaveBeenCalled();
      expect(host.sessionLifecycle.schedule).toHaveBeenCalled();
      expect(host.showResult).toHaveBeenCalledWith(false);
    });
  });

  describe('6. ReadyPositionController 및 Phase A 단일 공급원', () => {
    it('READY_POSITION 완료 시 모드에 따라 일반 러닝 또는 어썰트 페이즈를 시작해야 한다', () => {
      binder.handleReadyPositionComplete();
      expect(host.startRunningPhase).toHaveBeenCalled();

      (host.isAssaultMode as any).mockReturnValue(true);
      binder.handleReadyPositionComplete();
      expect(host.startAssaultPhase).toHaveBeenCalled();
    });

    it('Phase A 별노트 및 장판 패턴 단일 공급원을 정상 반환해야 한다', () => {
      expect(binder.getPhaseAStarNotes()).toEqual([{ id: 'k1' }]);
      expect(binder.getPhaseAHazardPattern(1)).toBe('duck');
    });

    it('renderFeedback은 feedbackTimer가 0 이하일 때 렌더링하지 않고, 0보다 클 때 텍스트를 렌더링해야 한다', () => {
      const ctx = {
        save: vi.fn(),
        restore: vi.fn(),
        fillText: vi.fn(),
        fillRect: vi.fn(),
      } as any;

      (host as any).getFeedbackTimer = vi.fn().mockReturnValue(0);
      binder.renderFeedback(ctx, 1280, 720, 0);
      expect(ctx.save).not.toHaveBeenCalled();

      (host as any).getFeedbackTimer = vi.fn().mockReturnValue(0.8);
      (host as any).getFeedbackCorrect = vi.fn().mockReturnValue(true);
      (host as any).guardian = { stageName: '빛의 정령' };
      binder.renderFeedback(ctx, 1280, 720, 1.0);
      expect(ctx.save).toHaveBeenCalled();
      expect(ctx.fillText).toHaveBeenCalledWith('정답!', 640, 720 * 0.22);
      expect(ctx.fillText).toHaveBeenCalledWith('수호신 캐스팅! (빛의 정령)', 640, 720 * 0.55);
      expect(ctx.restore).toHaveBeenCalled();
    });
  });
});
