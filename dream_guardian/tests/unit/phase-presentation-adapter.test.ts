import { describe, it, expect, vi } from 'vitest';
import { PhasePresentationAdapter } from '../../src/ui/PhasePresentationAdapter.js';
import { HazardZoneRenderer } from '../../src/render/HazardZoneRenderer.js';
import type { GameState } from '../../src/types/index.js';

describe('PhasePresentationAdapter Unit Tests - [BUG-PHASE-PRESENTATION-001 / #232]', () => {
  const adapter = new PhasePresentationAdapter();

  it('canRenderRunningHUD는 RUN_QUESTION 및 REST_READY만 허용한다', () => {
    expect(adapter.canRenderRunningHUD('RUN_QUESTION')).toBe(true);
    expect(adapter.canRenderRunningHUD('REST_READY' as GameState)).toBe(true);
    expect(adapter.canRenderRunningHUD('ANSWER_SELECT')).toBe(false);
    expect(adapter.canRenderRunningHUD('STAR_COLLECT')).toBe(false);
    expect(adapter.canRenderRunningHUD('HAZARD_EVADE')).toBe(false);
    expect(adapter.canRenderRunningHUD('ROUND_RESOLVE')).toBe(false);
    expect(adapter.canRenderRunningHUD('RESULT')).toBe(false);
  });

  it('canRenderQuestion은 ANSWER_SELECT만 허용한다', () => {
    expect(adapter.canRenderQuestion('ANSWER_SELECT')).toBe(true);
    expect(adapter.canRenderQuestion('RUN_QUESTION')).toBe(false);
    expect(adapter.canRenderQuestion('STAR_COLLECT')).toBe(false);
    expect(adapter.canRenderQuestion('HAZARD_EVADE')).toBe(false);
    expect(adapter.canRenderQuestion('ROUND_RESOLVE')).toBe(false);
  });

  it('canRenderStarCollect는 STAR_COLLECT 및 KEYNOTE_PERFORMANCE만 허용한다', () => {
    expect(adapter.canRenderStarCollect('STAR_COLLECT')).toBe(true);
    expect(adapter.canRenderStarCollect('KEYNOTE_PERFORMANCE' as GameState)).toBe(true);
    expect(adapter.canRenderStarCollect('ANSWER_SELECT')).toBe(false);
    expect(adapter.canRenderStarCollect('HAZARD_EVADE')).toBe(false);
  });

  it('canRenderHazardEvade는 HAZARD_EVADE만 허용한다', () => {
    expect(adapter.canRenderHazardEvade('HAZARD_EVADE')).toBe(true);
    expect(adapter.canRenderHazardEvade('STAR_COLLECT')).toBe(false);
    expect(adapter.canRenderHazardEvade('ANSWER_SELECT')).toBe(false);
    expect(adapter.canRenderHazardEvade('RUN_QUESTION')).toBe(false);
  });

  it('canRenderPostureGuide는 ANSWER_SELECT만 허용한다', () => {
    expect(adapter.canRenderPostureGuide('ANSWER_SELECT')).toBe(true);
    expect(adapter.canRenderPostureGuide('STAR_COLLECT')).toBe(false);
    expect(adapter.canRenderPostureGuide('HAZARD_EVADE')).toBe(false);
    expect(adapter.canRenderPostureGuide('RUN_QUESTION')).toBe(false);
  });

  it('isAnswerInputAllowed는 ANSWER_SELECT이며 answerLocked가 false일 때만 true를 반환한다', () => {
    expect(adapter.isAnswerInputAllowed('ANSWER_SELECT', false)).toBe(true);
    expect(adapter.isAnswerInputAllowed('ANSWER_SELECT', true)).toBe(false);
    expect(adapter.isAnswerInputAllowed('STAR_COLLECT', false)).toBe(false);
    expect(adapter.isAnswerInputAllowed('HAZARD_EVADE', false)).toBe(false);
    expect(adapter.isAnswerInputAllowed('ROUND_RESOLVE', false)).toBe(false);
    expect(adapter.isAnswerInputAllowed('RUN_QUESTION', false)).toBe(false);
  });

  it('renderHazardEvade는 활성 장판이 있을 때 HazardZoneRenderer.render를 위임 호출한다', () => {
    const mockHazardRenderer = new HazardZoneRenderer();
    const renderSpy = vi.spyOn(mockHazardRenderer, 'render').mockImplementation(() => {});
    const customAdapter = new PhasePresentationAdapter(mockHazardRenderer);

    const mockCtx = {
      save: vi.fn(),
      restore: vi.fn(),
      fillText: vi.fn(),
    } as unknown as CanvasRenderingContext2D;

    customAdapter.renderHazardEvade(mockCtx, 1080, 2160, {
      activePattern: 'jump',
      beatProgress: 0.5,
      vanishingX: 540,
      vanishingY: 756,
    });

    expect(renderSpy).toHaveBeenCalledWith(
      mockCtx,
      1080,
      2160,
      expect.objectContaining({
        activePattern: 'jump',
        beatProgress: 0.5,
        vanishingX: 540,
        vanishingY: 756,
      }),
    );
  });

  function createMockCtx(): CanvasRenderingContext2D {
    return {
      save: vi.fn(),
      restore: vi.fn(),
      beginPath: vi.fn(),
      moveTo: vi.fn(),
      lineTo: vi.fn(),
      closePath: vi.fn(),
      ellipse: vi.fn(),
      arc: vi.fn(),
      fill: vi.fn(),
      stroke: vi.fn(),
      fillText: vi.fn(),
      fillStyle: '',
      strokeStyle: '',
      lineWidth: 1,
      font: '',
      textAlign: '',
      textBaseline: '',
      shadowColor: '',
      shadowBlur: 0,
    } as unknown as CanvasRenderingContext2D;
  }

  it('renderHazardEvade는 isResolved=true 및 isEvaded=true일 때 회피 성공 텍스트와 패턴 식별명을 표출한다 (Issue #228)', () => {
    const mockCtx = createMockCtx();

    adapter.renderHazardEvade(mockCtx, 1080, 2160, {
      activePattern: 'left_step',
      beatProgress: 1.0,
      vanishingX: 540,
      vanishingY: 518,
      isResolved: true,
      isEvaded: true,
    });

    const calls = vi.mocked(mockCtx.fillText).mock.calls.map((c) => String(c[0]));
    expect(calls.some((txt) => txt.includes('회피 성공') || txt.includes('DODGED'))).toBe(true);
    expect(calls.some((txt) => txt.includes('왼발') || txt.includes('left_step'))).toBe(true);
  });

  it('renderHazardEvade는 isResolved=true 및 isEvaded=false일 때 피격 실패 텍스트와 데미지를 표출한다 (Issue #228)', () => {
    const mockCtx = createMockCtx();

    adapter.renderHazardEvade(mockCtx, 1080, 2160, {
      activePattern: 'jump',
      beatProgress: 1.0,
      vanishingX: 540,
      vanishingY: 518,
      isResolved: true,
      isEvaded: false,
    });

    const calls = vi.mocked(mockCtx.fillText).mock.calls.map((c) => String(c[0]));
    expect(calls.some((txt) => txt.includes('회피 실패') || txt.includes('HIT'))).toBe(true);
    expect(calls.some((txt) => txt.includes('25') || txt.includes('피격'))).toBe(true);
  });
});
