/**
 * assault-recovery-display-wiring.test.ts
 *
 * [BOSS-ASSAULT-REC-15] #608: 접근전 장면·HUD 실측 전달 복구 단위 테스트
 *
 * @see docs/assault-runtime-recovery/REC-15.md
 * @see https://github.com/Choyounhwa/-dream-guardian/issues/608
 *
 * 완료 조건:
 * 1. 실제 조립 경로에서 장면 pair, 취소/도착, 회피와 HUD HP, 문제수, 타격수가 올바르게 전달된다.
 * 2. null 내부 snapshot으로 인한 HUD 조기 반환을 방지하고 hud.setSnapshot 및 명시 인자 전달을 보장한다.
 * 3. 단일 권위 HP, 실측 completedQuestions/targetRounds, strikeCount/combo, pause/tracking/reprep/error 상태를 분리해 전달한다.
 * 4. 기존 AssaultApproachRenderer API를 연결해 실제 progress를 사용한다.
 * 5. 진입 실패 또는 세션 부재 시에도 기존 오류 표시 포트(validationError)로 전달된다.
 * 6. 반복 render 호출 시 Game/정산을 직접 호출하지 않는 순수 단방향 렌더 파이프라인을 보장한다 (멱등성).
 * 7. MVP 보스 HP바, 보상·마나 숨김 정책 유지 및 미지원 수치 0 위조 방지.
 */

import { describe, it, expect, vi } from 'vitest';
import { AssaultSessionFactory } from '../../src/core/AssaultSessionFactory.js';
import { AssaultSessionWireHelper } from '../../src/core/bootstrap/AssaultSessionWireHelper.js';
import { AssaultSceneHandler } from '../../src/core/director/AssaultSceneHandler.js';
import { BattleState } from '../../src/game/BattleState.js';
import { BossController } from '../../src/game/BossController.js';
import { DEFAULT_APPROACH_PATTERN } from '../../src/data/assault/approachPatterns.js';
import type { QuestionCandidate } from '../../src/question/AssaultQuestionEligibility.js';

describe('[BOSS-ASSAULT-REC-15] #608: 접근전 장면·HUD 실측 전달 복구', () => {
  const sampleQuestion: QuestionCandidate = {
    id: 'q_disp_01',
    level: 1,
    subLevel: 1,
    type: 'add',
    text: '8 + 6 = ?',
    answer: '14',
    choices: ['14', '15'],
  };

  const samplePattern = {
    ...DEFAULT_APPROACH_PATTERN,
    totalBeats: 16,
    durationBeats: 16,
    encounters: [
      {
        id: 'atk_pair_01' as any,
        kind: 'answer_pair' as const,
        startBeat: 0,
        durationBeats: 4,
        interactionProfileId: 'profile_punch' as any,
        visualProfileId: 'profile_pair' as any,
        pairId: 'pair_disp_01' as any,
        leftText: '14',
        rightText: '15',
      },
      {
        id: 'atk_squat_01' as any,
        kind: 'squat' as const,
        startBeat: 6,
        durationBeats: 4,
        interactionProfileId: 'profile_squat' as any,
        visualProfileId: 'profile_squat_hazard' as any,
      },
    ],
  };

  function createMockHost() {
    const battle = new BattleState(100);
    const boss = new BossController(1, { initialHp: 100 });
    const speech = {
      speak: vi.fn(),
      speakPriority: vi.fn(),
      speakSystem: vi.fn(),
      cancel: vi.fn(),
    };
    const sfx = {
      play: vi.fn(),
    };
    const stateMachine = {
      currentState: 'RUN_QUESTION',
      canTransition: vi.fn(() => true),
      changeState: vi.fn(),
    };
    const sessionLifecycle = {
      getActiveAssaultSessionToken: vi.fn(() => null),
      setActiveAssaultSessionToken: vi.fn(),
      clearActiveAssaultSessionToken: vi.fn(),
      setTestSession: vi.fn(),
    };
    const sessionContext = {
      sessionMode: 'normal',
      setMode: vi.fn(),
    };
    const motionIntentBus = {
      setPhase: vi.fn(),
    };

    return {
      battle,
      boss,
      bossController: boss,
      speech,
      sfx,
      stateMachine,
      sessionLifecycle,
      sessionContext,
      motionIntentBus,
      enableAssaultFinale: false,
      questionBank: { currentLevel: 1 },
      currentChapter: 1,
    };
  }

  function createMockContext(assaultSession?: any) {
    const renderedTexts: string[] = [];
    const ctx = {
      save: vi.fn(),
      restore: vi.fn(),
      clearRect: vi.fn(),
      fillRect: vi.fn(),
      strokeRect: vi.fn(),
      rect: vi.fn(),
      roundRect: vi.fn(),
      beginPath: vi.fn(),
      closePath: vi.fn(),
      moveTo: vi.fn(),
      lineTo: vi.fn(),
      arc: vi.fn(),
      fill: vi.fn(),
      stroke: vi.fn(),
      createLinearGradient: vi.fn(() => ({ addColorStop: vi.fn() })),
      createRadialGradient: vi.fn(() => ({ addColorStop: vi.fn() })),
      fillText: vi.fn((text: string) => {
        renderedTexts.push(String(text));
      }),
      measureText: vi.fn((text: string) => ({ width: text.length * 10 })),
      canvas: { width: 1080, height: 720 },
    };

    const mainCtx: any = {
      canvasManager: {
        ctx,
        virtualWidth: 1080,
        virtualHeight: 720,
      },
      cameraLayer: { isActive: false },
      imageLoader: { get: vi.fn(() => null) },
      dreamGrid: {
        render: vi.fn(),
        update: vi.fn(),
      },
      effectManager: {
        update: vi.fn(),
        render: vi.fn(),
      },
      pauseModal: { isOpen: false },
      state: {
        screenMode: 'game',
        currentChapter: 1,
        battle: { hp: 85, maxHp: 100, combo: 3 },
      },
      sessionContext: { sessionMode: 'boss_assault' },
      assaultSession,
    };

    return { mainCtx, ctx, renderedTexts };
  }

  it('1. AssaultSessionFactory가 생성한 세션에서 getPresentationSnapshot(), getHUDSnapshot(), getApproachSnapshot()을 제공해야 한다', () => {
    const battle = new BattleState(100);
    const speech = { speak: vi.fn(), speakPriority: vi.fn() };
    const session = AssaultSessionFactory.createSession({
      battleState: battle,
      speech,
      questions: [sampleQuestion],
      pattern: samplePattern,
      targetRounds: 3,
    });

    // 라운드 생성 전
    expect(session.getHUDSnapshot).toBeDefined();
    expect(session.getApproachSnapshot).toBeDefined();
    const initHUD = session.getHUDSnapshot!();
    expect(initHUD.playerHp).toBe(100);
    expect(initHUD.completedQuestions).toBe(0);
    expect(initHUD.targetRounds).toBe(3);
    expect(initHUD.strikeCount).toBe(0);

    const initApproach = session.getApproachSnapshot!();
    expect(initApproach.progress).toBe(0);
    expect(initApproach.completedQuestions).toBe(0);
    expect(initApproach.targetRounds).toBe(3);

    // 라운드 시작
    const rc = session.createRoundController('round_01' as any, sampleQuestion);
    expect(session.activeRoundController).toBe(rc);
    expect(session.presentation).toBeDefined();
    expect(session.presentation?.questionText).toBe('8 + 6 = ?');
  });

  it('2. AssaultSceneHandler.render()가 실제 rich presentation snapshot을 AssaultSceneRenderer에 전달해야 한다', () => {
    const host = createMockHost();
    const wireHelper = new AssaultSessionWireHelper(host as any);
    const session = wireHelper.assembleAssaultSession({
      questions: [sampleQuestion],
      pattern: samplePattern,
      targetRounds: 3,
    });
    wireHelper.startAssaultPhase();

    const mockSceneRenderer = { render: vi.fn() };
    const mockApproachRenderer = { renderApproachProgress: vi.fn() };
    const handler = new AssaultSceneHandler({
      assaultSceneRenderer: mockSceneRenderer as any,
      assaultApproachRenderer: mockApproachRenderer as any,
    });

    const { mainCtx } = createMockContext(session);
    handler.render(mainCtx);

    // 1) AssaultSceneRenderer.render 호출 검증
    expect(mockSceneRenderer.render).toHaveBeenCalled();
    const passedSnapshot = mockSceneRenderer.render.mock.calls[0][1];
    expect(passedSnapshot).toBeDefined();
    expect(passedSnapshot.questionText).toBe('8 + 6 = ?');
    expect(passedSnapshot.sessionId).toBe(session.sessionId);
    expect(passedSnapshot.roundId).toBe('round_01');

    // 2) AssaultApproachRenderer.renderApproachProgress 호출 검증
    expect(mockApproachRenderer.renderApproachProgress).toHaveBeenCalled();
    const passedApproachSnapshot = mockApproachRenderer.renderApproachProgress.mock.calls[0][1];
    expect(passedApproachSnapshot).toBeDefined();
    expect(passedApproachSnapshot.completedQuestions).toBe(0);
    expect(passedApproachSnapshot.targetRounds).toBe(3);
  });

  it('3. null 내부 snapshot으로 인한 HUD 조기 반환(early return)을 방지하고 HUD에 실측 데이터가 전달되어 렌더링되어야 한다', () => {
    const host = createMockHost();
    host.battle.setHp(75); // HP = 75
    const wireHelper = new AssaultSessionWireHelper(host as any);
    const session = wireHelper.assembleAssaultSession({
      questions: [sampleQuestion],
      pattern: samplePattern,
      targetRounds: 5,
    });
    wireHelper.startAssaultPhase();

    // 펀치 1회 모의 기록 -> strikeCount = 1
    session.exerciseTally.recordPunch({
      inputId: 'punch_rec15_01' as any,
      hand: 'left',
      timestampMs: 1000,
      isValid: true,
    });

    const handler = new AssaultSceneHandler();
    const { mainCtx, renderedTexts } = createMockContext(session);

    handler.render(mainCtx);

    // HUD 내부 snapshot이 null이 아니어야 함
    const hudSnapshot = session.hud.getSnapshot();
    expect(hudSnapshot).not.toBeNull();
    expect(hudSnapshot?.playerHp).toBe(75);
    expect(hudSnapshot?.targetRounds).toBe(5);
    expect(hudSnapshot?.strikeCount).toBe(1);

    // 실제 캔버스에 HP 및 문제수 텍스트가 렌더링되었는지 확인
    const hasHp = renderedTexts.some((t) => t.includes('HP') || t.includes('75'));
    const hasQuestions = renderedTexts.some((t) => t.includes('0 / 5') || t.includes('문제'));
    const hasStrikes = renderedTexts.some((t) => t.includes('타격') || t.includes('1'));
    expect(hasHp).toBe(true);
    expect(hasQuestions).toBe(true);
    expect(hasStrikes).toBe(true);
  });

  it('4. 안전 상태(pause, trackingLost, needsMotionReprep)가 HUD로 정확히 분리 전달되어야 한다', () => {
    const host = createMockHost();
    const wireHelper = new AssaultSessionWireHelper(host as any);
    const session = wireHelper.assembleAssaultSession({
      questions: [sampleQuestion],
      pattern: samplePattern,
    });
    wireHelper.startAssaultPhase();

    // 추적 상실 발생 (시계는 멈추지 않고 HUD에 추적 경고만 표시)
    session.clock.setTrackingLost(true);
    expect(session.clock.isTrackingLost).toBe(true);

    const handler = new AssaultSceneHandler();
    const { mainCtx, renderedTexts } = createMockContext(session);

    handler.render(mainCtx);

    const hudSnap = session.hud.getSnapshot();
    expect(hudSnap?.trackingLost).toBe(true);
    expect(hudSnap?.isPaused).toBe(false);

    const hasTrackingWarning = renderedTexts.some(
      (t) => t.includes('추적 상실') || t.includes('카메라') || t.includes('트래킹'),
    );
    expect(hasTrackingWarning).toBe(true);
  });

  it('5. 세션 부재 또는 진입 검증 실패 시 기존 오류 표시 포트(validationError)로 배너가 렌더링되어야 한다', () => {
    const handler = new AssaultSceneHandler();
    const { mainCtx, renderedTexts } = createMockContext(null); // 세션 없음

    mainCtx.assaultValidationError = '적격 문항 부족: 8박 미만 공격 포함';

    handler.render(mainCtx);

    const hasErrorBanner = renderedTexts.some(
      (t) => t.includes('적격 문항 부족') || t.includes('8박 미만') || t.includes('오류'),
    );
    expect(hasErrorBanner).toBe(true);
  });

  it('6. 순수 단방향 렌더 파이프라인: 동일 상태에서 render()를 10회 반복 호출해도 게임 상태와 정산이 불변이어야 한다 (멱등성)', () => {
    const host = createMockHost();
    const wireHelper = new AssaultSessionWireHelper(host as any);
    const session = wireHelper.assembleAssaultSession({
      questions: [sampleQuestion],
      pattern: samplePattern,
      targetRounds: 3,
    });
    wireHelper.startAssaultPhase();

    const handler = new AssaultSceneHandler();
    const { mainCtx } = createMockContext(session);

    const initialHp = host.battle.hp;
    const initialCompleted = session.progressController.completedRounds;
    const initialReceiptsCount = session.settlement.getReceipts().length;

    // 10회 렌더 반복
    for (let i = 0; i < 10; i++) {
      handler.render(mainCtx);
    }

    expect(host.battle.hp).toBe(initialHp);
    expect(session.progressController.completedRounds).toBe(initialCompleted);
    expect(session.settlement.getReceipts().length).toBe(initialReceiptsCount);
    expect(session.isDisposed).toBe(false);
  });

  it('7. [DEC-A7] MVP 미지원 요소(보스 HP바, 마나 게이지, 별가루)는 HUD에 렌더링되지 않아야 한다', () => {
    const host = createMockHost();
    const wireHelper = new AssaultSessionWireHelper(host as any);
    const session = wireHelper.assembleAssaultSession({
      questions: [sampleQuestion],
      pattern: samplePattern,
      targetRounds: 3,
    });
    wireHelper.startAssaultPhase();

    const handler = new AssaultSceneHandler();
    const { mainCtx, renderedTexts } = createMockContext(session);

    handler.render(mainCtx);

    const hasMana = renderedTexts.some((t) => t.includes('MP') || t.includes('마나'));
    const hasStardust = renderedTexts.some((t) => t.includes('별가루') || t.includes('Stardust'));
    const hasBossHp = renderedTexts.some((t) => t.includes('BOSS HP') || t.includes('보스 체력'));

    expect(hasMana).toBe(false);
    expect(hasStardust).toBe(false);
    expect(hasBossHp).toBe(false);
  });
});
