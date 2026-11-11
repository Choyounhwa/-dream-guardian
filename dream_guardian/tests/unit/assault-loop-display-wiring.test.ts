/**
 * assault-loop-display-wiring.test.ts
 *
 * [ASSAULT-LOOP-15a / GitHub Issue #709]
 * 실제 루프 HUD·구간스냅샷 Core 전달 TDD 단위 테스트
 *
 * 핵심 검증 항목:
 * 1. resolveHUDSnapshot:
 *    - activeRoundController.getPresentationSnapshot()의 loop 표시 스냅샷(AssaultLoopPresentation)을 HUD 스냅샷에 loop 필드로 합성
 *    - session.getHUDSnapshot() 호출 결과에도 loop 필드가 누락되지 않도록 보장
 * 2. render / renderHUD:
 *    - resolveHUDSnapshot 결과의 loop 정보를 hud.setLoopSnapshot / hud.setSnapshot 및 hud.render에 무손실 전달
 *    - URL의 loop 파라미터 부재를 제거 조건으로 사용하지 않음 (Core가 기본 주입한 loop 정보를 투명하게 전달)
 * 3. 구간별 공격 표시 억제 실제 작동:
 *    - session.activeRoundController.getPresentationSnapshot()을 통해 AssaultSceneRenderer로 snapshot.loop가 전달
 *    - 휴식(rest) 및 러닝(run_question) 구간 중 답 쌍(pair) 및 위험 경고(hazard) 표시 0회
 * 4. 세션 생명주기 및 하위 호환성 격리:
 *    - loop 계획이 없는 범용 Factory 직접 호출 fixture는 loop가 없으므로 기존 동작 유지 (stale 표시 0회)
 *    - 세션 종료(isDisposed, isEnded) 또는 stale 토큰 감지 시 새 안내 제거 (loop: null)
 * 5. 오디오 억제 연동 회귀 검증:
 *    - 휴식 구간 중 공격 pair / hazard가 없어 발사/피해음 신규 발행 0회
 */

import { describe, it, expect, vi } from 'vitest';
import { AssaultSessionFactory } from '../../src/core/AssaultSessionFactory.js';
import { AssaultSceneHandler } from '../../src/core/director/AssaultSceneHandler.js';
import { AssaultSceneRenderer } from '../../src/render/AssaultSceneRenderer.js';
import { AssaultHUD } from '../../src/ui/AssaultHUD.js';
import { BattleState } from '../../src/game/BattleState.js';
import { DEFAULT_ASSAULT_LOOP_CONFIG } from '../../config/assault-loop.config.js';
import { DEFAULT_APPROACH_PATTERN } from '../../src/data/assault/approachPatterns.js';
import type { QuestionCandidate } from '../../src/question/AssaultQuestionEligibility.js';
import type { RoundId } from '../../src/types/assault.js';

describe('[ASSAULT-LOOP-15a / #709] 실제 루프 HUD·구간스냅샷 Core 전달 (AssaultSceneHandler)', () => {
  const sampleQuestions: readonly QuestionCandidate[] = [
    {
      id: 'q_loop_01',
      level: 1,
      subLevel: 1,
      type: 'add',
      text: '12 + 15 = ?',
      correctAnswer: 27,
      choices: ['27', '25'],
    },
    {
      id: 'q_loop_02',
      level: 1,
      subLevel: 1,
      type: 'sub',
      text: '30 - 8 = ?',
      correctAnswer: 22,
      choices: ['22', '24'],
    },
  ];

  function createMockContext(assaultSession?: any, options?: { sessionToken?: string; activeToken?: string | null }) {
    const renderedTexts: string[] = [];
    let currentFont = '';

    const ctx: any = {
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
      scale: vi.fn(),
      translate: vi.fn(),
      rotate: vi.fn(),
      globalAlpha: 1.0,
      fillStyle: '',
      strokeStyle: '',
      lineWidth: 1,
      createLinearGradient: vi.fn(() => ({ addColorStop: vi.fn() })),
      createRadialGradient: vi.fn(() => ({ addColorStop: vi.fn() })),
      fillText: vi.fn((text: string) => {
        renderedTexts.push(String(text));
      }),
      measureText: vi.fn((text?: string) => ({ width: (text?.length ?? 0) * 12 })),
      get font() {
        return currentFont;
      },
      set font(val: string) {
        currentFont = val;
      },
      canvas: { width: 1080, height: 720 },
    };

    const activeAssaultToken =
      options?.activeToken !== undefined
        ? options.activeToken
        : assaultSession?.sessionId ?? null;
    const sessionLifecycle = {
      activeAssaultSessionToken: activeAssaultToken,
      isValidAssaultToken: vi.fn((token?: string | number | null) => {
        if (activeAssaultToken === null) return false;
        return activeAssaultToken === token;
      }),
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
      bottomBar: { render: vi.fn() },
      state: {
        screenMode: 'game',
        currentChapter: 1,
        battle: { hp: 100, maxHp: 100, combo: 0 },
      },
      sessionContext: {
        sessionMode: 'boss_assault',
        sessionLifecycle,
      },
      sessionLifecycle,
      assaultSession,
    };

    return { mainCtx, ctx, renderedTexts };
  }

  describe('1. resolveHUDSnapshot loop 스냅샷 합성', () => {
    it('활성 라운드 컨트롤러의 getPresentationSnapshot()에서 loop 스냅샷을 추출해 resolveHUDSnapshot 결과에 합성해야 한다', () => {
      const battle = new BattleState(100);
      const speech = { speak: vi.fn(), cancel: vi.fn() };
      const session = AssaultSessionFactory.createSession({
        battleState: battle,
        speech,
        questions: sampleQuestions,
        loopProfile: DEFAULT_ASSAULT_LOOP_CONFIG,
      });

      const rc = session.createRoundController('round_01' as RoundId, sampleQuestions[0]);
      expect(rc).toBeDefined();

      const handler = new AssaultSceneHandler();
      const { mainCtx } = createMockContext(session);

      // session.getHUDSnapshot() 자체는 loop 필드가 누락되어 있을 수 있으나, resolveHUDSnapshot은 합성하여 반환해야 함
      const rawHudSnap = session.getHUDSnapshot!();
      expect(rawHudSnap.loop).toBeUndefined();

      const resolved = handler.resolveHUDSnapshot(session, mainCtx);
      expect(resolved).not.toBeNull();
      expect(resolved!.loop).toBeDefined();
      expect(resolved!.loop!.currentSegmentKind).toBe('run_question');
      expect(resolved!.loop!.totalOpportunities).toBe(4);
      expect(resolved!.loop!.segmentRemainingBeats).toBe(8);
      expect(resolved!.completedQuestions).toBe(0);
      expect(resolved!.playerHp).toBe(100);
    });

    it('시간이 전진하여 rest 구간에 진입했을 때 loop 정보(휴식, 남은 박수, 기회 번호)가 정확히 일치해야 한다', () => {
      const battle = new BattleState(100);
      const speech = { speak: vi.fn(), cancel: vi.fn() };
      const session = AssaultSessionFactory.createSession({
        battleState: battle,
        speech,
        questions: sampleQuestions,
        loopProfile: {
          ...DEFAULT_ASSAULT_LOOP_CONFIG,
          restBeats: 2,
          baseBeats: 32,
        },
      });

      const rc = session.createRoundController('round_01' as RoundId, sampleQuestions[0]);
      // 120 BPM 기준: run_question(8박 = 4초), answer1(4박 = 2초, 4.0~6.0초), rest1(2박 = 1초, 6.0~7.0초)
      // 6.5초로 전진 -> rest 구간
      rc.update(6.5, 0.016);

      const handler = new AssaultSceneHandler();
      const { mainCtx } = createMockContext(session);

      const resolved = handler.resolveHUDSnapshot(session, mainCtx);
      expect(resolved).not.toBeNull();
      expect(resolved!.loop).toBeDefined();
      expect(resolved!.loop!.currentSegmentKind).toBe('rest');
      expect(resolved!.loop!.opportunityIndex).toBe(1);
      expect(resolved!.loop!.totalOpportunities).toBe(4);
      expect(resolved!.loop!.actionPrompt).toBe('호흡을 가다듬으세요');
    });
  });

  describe('2. render & renderHUD: AssaultHUD 무손실 전달', () => {
    it('handler.render() 시 AssaultHUD에 setLoopSnapshot 및 setSnapshot을 통해 loop 정보가 전달되어야 한다', () => {
      const battle = new BattleState(100);
      const speech = { speak: vi.fn(), cancel: vi.fn() };
      const session = AssaultSessionFactory.createSession({
        battleState: battle,
        speech,
        questions: sampleQuestions,
        loopProfile: DEFAULT_ASSAULT_LOOP_CONFIG,
      });

      const rc = session.createRoundController('round_01' as RoundId, sampleQuestions[0]);
      rc.update(0, 0);

      const hud = session.hud as AssaultHUD;
      expect(hud).toBeDefined();
      const spySetLoop = vi.spyOn(hud, 'setLoopSnapshot');
      const spySetSnap = vi.spyOn(hud, 'setSnapshot');
      const spyRender = vi.spyOn(hud, 'render');

      const handler = new AssaultSceneHandler();
      const { mainCtx } = createMockContext(session);

      handler.render(mainCtx);

      expect(spySetSnap).toHaveBeenCalled();
      const passedSnap = spySetSnap.mock.calls[spySetSnap.mock.calls.length - 1][0];
      expect(passedSnap.loop).toBeDefined();
      expect(passedSnap.loop!.currentSegmentKind).toBe('run_question');

      expect(spySetLoop).toHaveBeenCalledWith(
        expect.objectContaining({
          currentSegmentKind: 'run_question',
          totalOpportunities: 4,
        })
      );
      expect(spyRender).toHaveBeenCalled();
      expect(hud.getLoopSnapshot()).toBeDefined();
      expect(hud.getLoopSnapshot()!.currentSegmentKind).toBe('run_question');
    });

    it('handler.renderHUD() 호출 시에도 loop 스냅샷이 HUD에 전달되어야 한다', () => {
      const battle = new BattleState(100);
      const speech = { speak: vi.fn(), cancel: vi.fn() };
      const session = AssaultSessionFactory.createSession({
        battleState: battle,
        speech,
        questions: sampleQuestions,
        loopProfile: DEFAULT_ASSAULT_LOOP_CONFIG,
      });

      const rc = session.createRoundController('round_01' as RoundId, sampleQuestions[0]);
      rc.update(4.5, 0.016); // answer 구간

      const hud = session.hud as AssaultHUD;
      const spySetLoop = vi.spyOn(hud, 'setLoopSnapshot');

      const handler = new AssaultSceneHandler();
      const { mainCtx } = createMockContext(session);

      handler.renderHUD(mainCtx);

      expect(spySetLoop).toHaveBeenCalledWith(
        expect.objectContaining({
          currentSegmentKind: 'answer',
          opportunityIndex: 1,
        })
      );
    });

    it('URL에 loop 쿼리 파라미터가 없어도 Core가 기본 주입한 loop 안내를 투명하게 전달해야 한다', () => {
      const battle = new BattleState(100);
      const speech = { speak: vi.fn(), cancel: vi.fn() };
      const session = AssaultSessionFactory.createSession({
        battleState: battle,
        speech,
        questions: sampleQuestions,
        loopProfile: DEFAULT_ASSAULT_LOOP_CONFIG,
      });

      session.createRoundController('round_01' as RoundId, sampleQuestions[0]);

      const handler = new AssaultSceneHandler();
      const { mainCtx, renderedTexts } = createMockContext(session);

      handler.render(mainCtx);

      // loop 안내가 전달되어 러닝 안내 및 기회 텍스트가 렌더링되었는지 확인
      const hasOpportunity = renderedTexts.some((t) => t.includes('1 / 4') || t.includes('기회'));
      const hasLoopGuidance = renderedTexts.some((t) => t.includes('러닝') || t.includes('달리'));
      expect(hasOpportunity).toBe(true);
      expect(hasLoopGuidance).toBe(true);
    });
  });

  describe('3. AssaultSceneRenderer 장면 전달 및 휴식/러닝 중 공격 표시 억제', () => {
    it('handler.render() 시 resolveSnapshot이 snapshot.loop를 포함하여 AssaultSceneRenderer에 전달해야 한다', () => {
      const battle = new BattleState(100);
      const speech = { speak: vi.fn(), cancel: vi.fn() };
      const session = AssaultSessionFactory.createSession({
        battleState: battle,
        speech,
        questions: sampleQuestions,
        loopProfile: {
          ...DEFAULT_ASSAULT_LOOP_CONFIG,
          restBeats: 2,
          baseBeats: 32,
        },
      });

      const rc = session.createRoundController('round_01' as RoundId, sampleQuestions[0]);
      rc.update(6.5, 0.016); // rest 구간

      const mockSceneRenderer = { render: vi.fn() };
      const handler = new AssaultSceneHandler({
        assaultSceneRenderer: mockSceneRenderer as any,
      });
      const { mainCtx } = createMockContext(session);

      handler.render(mainCtx);

      expect(mockSceneRenderer.render).toHaveBeenCalled();
      const passedSceneSnap = mockSceneRenderer.render.mock.calls[0][1];
      expect(passedSceneSnap).toBeDefined();
      expect(passedSceneSnap.loop).toBeDefined();
      expect(passedSceneSnap.loop.currentSegmentKind).toBe('rest');
    });

    it('휴식(rest) 구간에서는 답 쌍(answer_pair) 및 스쿼트 위험 경고(hazard)가 화면에 0회 표시되어야 한다', () => {
      const battle = new BattleState(100);
      const speech = { speak: vi.fn(), cancel: vi.fn() };
      const session = AssaultSessionFactory.createSession({
        battleState: battle,
        speech,
        questions: sampleQuestions,
        loopProfile: {
          ...DEFAULT_ASSAULT_LOOP_CONFIG,
          restBeats: 2,
          baseBeats: 32,
        },
      });

      const rc = session.createRoundController('round_01' as RoundId, sampleQuestions[0]);
      rc.update(6.5, 0.016); // rest 구간

      const sceneRenderer = new AssaultSceneRenderer();
      const spyPair = vi.spyOn(sceneRenderer.pairPainter, 'render');

      const handler = new AssaultSceneHandler({
        assaultSceneRenderer: sceneRenderer,
      });
      const { mainCtx, renderedTexts } = createMockContext(session);

      handler.render(mainCtx);

      // 1) 답 쌍 탄환 렌더링 0회
      expect(spyPair).toHaveBeenCalledTimes(0);
      // 2) 스쿼트 위험 안내 렌더링 0회
      const hasSquatWarning = renderedTexts.some((t) => t.includes('SQUAT') || t.includes('웅크리기'));
      expect(hasSquatWarning).toBe(false);
      // 3) 보기 선택 텍스트 잔상 0회
      const hasChoice = renderedTexts.some((t) => t.includes('27') || t.includes('25'));
      expect(hasChoice).toBe(false);
      // 4) 휴식 안내 텍스트 표시
      const hasRestPrompt = renderedTexts.some((t) => t.includes('휴식') || t.includes('바른 자세'));
      expect(hasRestPrompt).toBe(true);
    });
  });

  describe('4. loop 계획 없는 범용 fixture / 종료된 세션 / stale 토큰 격리', () => {
    it('loop 계획이 없는 범용 Factory 직접 호출 fixture는 loop 정보가 없어 새 안내를 표시하지 않아야 한다 (동등성 보존)', () => {
      const battle = new BattleState(100);
      const speech = { speak: vi.fn(), cancel: vi.fn() };
      // loopProfile 없이 생성 -> 범용 fixture
      const session = AssaultSessionFactory.createSession({
        battleState: battle,
        speech,
        questions: sampleQuestions,
        pattern: { ...DEFAULT_APPROACH_PATTERN, totalBeats: 16 },
      });

      session.createRoundController('round_01' as RoundId, sampleQuestions[0]);

      const handler = new AssaultSceneHandler();
      const { mainCtx } = createMockContext(session);

      const resolvedHUD = handler.resolveHUDSnapshot(session, mainCtx);
      expect(resolvedHUD).not.toBeNull();
      expect(resolvedHUD!.loop).toBeUndefined();

      handler.render(mainCtx);
      expect((session.hud as AssaultHUD).getLoopSnapshot()).toBeNull();
    });

    it('종료(dispose)된 세션은 loop 정보가 제거되어 stale 안내가 발생하지 않아야 한다', () => {
      const battle = new BattleState(100);
      const speech = { speak: vi.fn(), cancel: vi.fn() };
      const session = AssaultSessionFactory.createSession({
        battleState: battle,
        speech,
        questions: sampleQuestions,
        loopProfile: DEFAULT_ASSAULT_LOOP_CONFIG,
      });

      session.createRoundController('round_01' as RoundId, sampleQuestions[0]);
      session.dispose();

      const handler = new AssaultSceneHandler();
      const { mainCtx } = createMockContext(session);

      const resolvedHUD = handler.resolveHUDSnapshot(session, mainCtx);
      // dispose된 세션은 loop 정보가 없어야 함
      expect(resolvedHUD?.loop == null).toBe(true);
    });

    it('stale 세션 토큰 감지 시 새 loop 안내를 제거해야 한다', () => {
      const battle = new BattleState(100);
      const speech = { speak: vi.fn(), cancel: vi.fn() };
      const session = AssaultSessionFactory.createSession({
        battleState: battle,
        speech,
        questions: sampleQuestions,
        loopProfile: DEFAULT_ASSAULT_LOOP_CONFIG,
      });

      session.createRoundController('round_01' as RoundId, sampleQuestions[0]);

      const handler = new AssaultSceneHandler();
      // activeToken이 'token_mismatch'여서 session의 토큰과 불일치(stale)
      const { mainCtx } = createMockContext(session, {
        sessionToken: session.sessionId,
        activeToken: 'different_active_token',
      });

      const resolvedHUD = handler.resolveHUDSnapshot(session, mainCtx);
      expect(resolvedHUD?.loop == null).toBe(true);
    });
  });

  describe('5. 오디오 억제 연동 회귀 검증', () => {
    it('휴식(rest) 구간에서는 soundCue로 전달되는 presentation에 공격 pair/hazard가 없어 발사음이 발행되지 않아야 한다', () => {
      const battle = new BattleState(100);
      const speech = { speak: vi.fn(), cancel: vi.fn() };
      const mockSfxPlayer = {
        play: vi.fn(),
      };

      const session = AssaultSessionFactory.createSession({
        battleState: battle,
        speech,
        sfxPlayer: mockSfxPlayer as any,
        questions: sampleQuestions,
        loopProfile: {
          ...DEFAULT_ASSAULT_LOOP_CONFIG,
          restBeats: 2,
          baseBeats: 32,
        },
      });

      session.createRoundController('round_01' as RoundId, sampleQuestions[0]);
      const soundCue = session.soundCue!;
      expect(soundCue).toBeDefined();
      const spySoundCueUpdate = vi.spyOn(soundCue, 'update');

      // 6.5초 (rest 구간)
      session.updateRound!(6.5, 0.016);

      expect(spySoundCueUpdate).toHaveBeenCalled();
      const lastCall = spySoundCueUpdate.mock.calls[spySoundCueUpdate.mock.calls.length - 1];
      const passedPres = lastCall[1];

      // presentation에 pair나 hazard가 없음
      expect(passedPres?.pair).toBeUndefined();
      expect((passedPres as any)?.hazard).toBeUndefined();
      expect(passedPres?.squatHazard).toBeUndefined();

      // 발사음이나 피해음 재생 없음 (메트로놈 외의 attack sfx 0건)
      const playedSounds = mockSfxPlayer.play.mock.calls.map((c: any) => c[0]);
      const hasAttackSfx = playedSounds.some((s: string) => s === 'boss_attack' || s === 'player_damage' || s === 'squat_hazard');
      expect(hasAttackSfx).toBe(false);
    });
  });
});
