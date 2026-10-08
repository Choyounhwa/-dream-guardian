import { describe, expect, it, vi } from 'vitest';
import {
  PhasePresentationAdapter,
  type HazardEvadePresentationState,
  type AnswerSelectFeedbackState,
} from '../../src/ui/PhasePresentationAdapter.js';
import {
  JudgmentFeedback,
  DEFAULT_FEEDBACK_FIXTURE,
  ADAPTIVE_RELAXED_FEEDBACK_FIXTURE,
  WRONG_ANSWER_FEEDBACK_FIXTURE,
  type FeedbackPresentationContext,
  type FeedbackBounds,
  type JudgmentFeedbackState,
} from '../../src/ui/JudgmentFeedback.js';
import {
  HazardZoneRenderer,
  type HazardPresentationContext,
} from '../../src/render/HazardZoneRenderer.js';
import { createDefaultUIPresentationDocument } from '../../src/data/UIPresentation.js';

function createMockCtx(): CanvasRenderingContext2D & {
  calls: { method: string; args: unknown[] }[];
  fillStyles: string[];
  strokeStyles: string[];
} {
  const calls: { method: string; args: unknown[] }[] = [];
  const fillStyles: string[] = [];
  const strokeStyles: string[] = [];
  let _fillStyle = '';
  let _strokeStyle = '';

  const mock = {
    calls,
    fillStyles,
    strokeStyles,
    save: vi.fn(() => calls.push({ method: 'save', args: [] })),
    restore: vi.fn(() => calls.push({ method: 'restore', args: [] })),
    beginPath: vi.fn(() => calls.push({ method: 'beginPath', args: [] })),
    closePath: vi.fn(() => calls.push({ method: 'closePath', args: [] })),
    moveTo: vi.fn((x: number, y: number) => calls.push({ method: 'moveTo', args: [x, y] })),
    lineTo: vi.fn((x: number, y: number) => calls.push({ method: 'lineTo', args: [x, y] })),
    arc: vi.fn((...args: unknown[]) => calls.push({ method: 'arc', args })),
    ellipse: vi.fn((...args: unknown[]) => calls.push({ method: 'ellipse', args })),
    rect: vi.fn((x: number, y: number, w: number, h: number) =>
      calls.push({ method: 'rect', args: [x, y, w, h] }),
    ),
    roundRect: vi.fn((x: number, y: number, w: number, h: number, r?: unknown) =>
      calls.push({ method: 'roundRect', args: [x, y, w, h, r] }),
    ),
    fill: vi.fn(() => calls.push({ method: 'fill', args: [] })),
    stroke: vi.fn(() => calls.push({ method: 'stroke', args: [] })),
    fillRect: vi.fn((x: number, y: number, w: number, h: number) =>
      calls.push({ method: 'fillRect', args: [x, y, w, h] }),
    ),
    strokeRect: vi.fn((x: number, y: number, w: number, h: number) =>
      calls.push({ method: 'strokeRect', args: [x, y, w, h] }),
    ),
    fillText: vi.fn((text: string, x: number, y: number, maxW?: number) =>
      calls.push({ method: 'fillText', args: [text, x, y, maxW] }),
    ),
    strokeText: vi.fn((text: string, x: number, y: number, maxW?: number) =>
      calls.push({ method: 'strokeText', args: [text, x, y, maxW] }),
    ),
    measureText: vi.fn((text: string) => ({ width: text.length * 10 })),
    setLineDash: vi.fn((dash: number[]) => calls.push({ method: 'setLineDash', args: [dash] })),
    getLineDash: vi.fn(() => []),
    createLinearGradient: vi.fn(() => ({
      addColorStop: vi.fn(),
    })),
    createRadialGradient: vi.fn(() => ({
      addColorStop: vi.fn(),
    })),
    font: '16px sans-serif',
    textAlign: 'left',
    textBaseline: 'top',
    lineWidth: 1,
    shadowBlur: 0,
    shadowColor: '',
  };

  Object.defineProperty(mock, 'fillStyle', {
    get: () => _fillStyle,
    set: (v: string) => {
      _fillStyle = v;
      fillStyles.push(v);
    },
  });

  Object.defineProperty(mock, 'strokeStyle', {
    get: () => _strokeStyle,
    set: (v: string) => {
      _strokeStyle = v;
      strokeStyles.push(v);
    },
  });

  return mock as unknown as CanvasRenderingContext2D & {
    calls: { method: string; args: unknown[] }[];
    fillStyles: string[];
    strokeStyles: string[];
  };
}

const W = 1080;
const H = 2160;

describe('[UI-VIS-018 / Issue #448] 오답 피드백 UI 표시 context 전달', () => {
  describe('1. JudgmentFeedback 및 PhasePresentationAdapter 표시 context 설정/전파', () => {
    it('JudgmentFeedback에서 setPresentationContext, getPresentationContext, clearPresentationContext가 정상 동작한다', () => {
      const feedback = new JudgmentFeedback();
      expect(feedback.getPresentationContext()).toBeUndefined();

      const context: FeedbackPresentationContext = {
        hintBanner: {
          color: '#00FFAA',
          fontSize: 28,
        },
      };

      feedback.setPresentationContext(context);
      expect(feedback.getPresentationContext()).toEqual(context);

      feedback.clearPresentationContext();
      expect(feedback.getPresentationContext()).toBeUndefined();
    });

    it('PhasePresentationAdapter에 컨텍스트를 주입하면 내부 JudgmentFeedback과 HazardZoneRenderer에 전파된다', () => {
      const hazardRenderer = new HazardZoneRenderer();
      const judgmentFeedback = new JudgmentFeedback();
      const adapter = new PhasePresentationAdapter(hazardRenderer, judgmentFeedback);

      const context: FeedbackPresentationContext = {
        hintBanner: {
          textColor: '#FF0055',
          fontSize: 30,
        },
        hazardWarning: {
          text: '커스텀 회피 경고!',
          fontSize: 45,
        },
      };

      adapter.setPresentationContext(context);
      expect(adapter.getPresentationContext()).toEqual(context);
      expect(judgmentFeedback.getPresentationContext()).toEqual(context);
      expect(hazardRenderer.getPresentationContext()?.hazardWarning?.text).toBe('커스텀 회피 경고!');

      adapter.clearPresentationContext();
      expect(adapter.getPresentationContext()).toBeUndefined();
      expect(judgmentFeedback.getPresentationContext()).toBeUndefined();
      expect(hazardRenderer.getPresentationContext()).toBeUndefined();
    });
  });

  describe('2. renderHazardZone 호출 시 HazardZoneRenderer에 표시 context 전달 및 DTO 렌더링', () => {
    it('renderHazardZone 호출 시 내부 HazardZoneRenderer에 context가 안전하게 전달된다', () => {
      const hazardRenderer = new HazardZoneRenderer();
      const spyRender = vi.spyOn(hazardRenderer, 'render');
      const adapter = new PhasePresentationAdapter(hazardRenderer);
      const ctx = createMockCtx();

      const hazardState: HazardEvadePresentationState = {
        activePattern: 'jump',
        beatProgress: 0.7,
        vanishingX: W / 2,
        vanishingY: H * 0.24,
        isResolved: false,
        isEvaded: false,
      };

      const customContext: HazardPresentationContext = {
        hazardWarning: {
          text: '점프 타이밍 주의!',
          color: '#FF1133',
        },
      };

      adapter.renderHazardZone(ctx, W, H, hazardState, customContext);

      expect(spyRender).toHaveBeenCalledTimes(1);
      const passedRenderState = spyRender.mock.calls[0][3];
      expect(passedRenderState.activePattern).toBe('jump');
      expect(passedRenderState.beatProgress).toBe(0.7);

      // 렌더 후 원상 복구 확인
      expect(hazardRenderer.getPresentationContext()).toBeUndefined();
    });

    it('회피 성공(DODGED) 및 피격 실패(HIT) DTO 렌더링 시 올바른 텍스트 및 효과를 렌더링한다', () => {
      const adapter = new PhasePresentationAdapter();

      // 회피 성공
      const dodgedCtx = createMockCtx();
      const dodgedState: HazardEvadePresentationState = {
        activePattern: 'left_step',
        beatProgress: 1.0,
        vanishingX: W / 2,
        vanishingY: H * 0.24,
        isResolved: true,
        isEvaded: true,
      };
      adapter.renderHazardZone(dodgedCtx, W, H, dodgedState);
      const dodgedTexts = dodgedCtx.calls
        .filter((c) => c.method === 'fillText')
        .map((c) => c.args[0] as string);
      expect(dodgedTexts.some((t) => t.includes('회피 성공'))).toBe(true);

      // 피격 실패
      const hitCtx = createMockCtx();
      const hitState: HazardEvadePresentationState = {
        activePattern: 'right_step',
        beatProgress: 1.0,
        vanishingX: W / 2,
        vanishingY: H * 0.24,
        isResolved: true,
        isEvaded: false,
      };
      adapter.renderHazardZone(hitCtx, W, H, hitState);
      const hitTexts = hitCtx.calls
        .filter((c) => c.method === 'fillText')
        .map((c) => c.args[0] as string);
      expect(hitTexts.some((t) => t.includes('피격') || t.includes('회피 실패'))).toBe(true);
    });
  });

  describe('3. renderAnswerFeedback 호출 시 스타일 오버라이드 및 JudgmentFeedback 전달', () => {
    it('renderAnswerFeedback 시 주입된 context의 폰트/색상/배경 스타일이 캔버스에 반영된다', () => {
      const adapter = new PhasePresentationAdapter();
      const ctx = createMockCtx();

      const answerFeedbackState: AnswerSelectFeedbackState = {
        glowIntensity: 0.6,
        hintMessage: '팔을 더 뻗어보세요!',
        reasonKey: 'extension',
        isVisible: true,
        adaptiveRelaxed: false,
      };

      const customContext: FeedbackPresentationContext = {
        hintBanner: {
          fillColor: 'rgba(50, 10, 80, 0.9)',
          borderColor: '#FF00FF',
          textColor: '#00FFFF',
          fontSize: 32,
        },
      };

      adapter.renderAnswerFeedback(ctx, W, H, answerFeedbackState, customContext);

      expect(ctx.fillStyles).toContain('rgba(50, 10, 80, 0.9)');
      expect(ctx.strokeStyles).toContain('#FF00FF');
      expect(ctx.fillStyles).toContain('#00FFFF');
      expect(ctx.calls.some((c) => c.method === 'fillText' && c.args[0] === '팔을 더 뻗어보세요!')).toBe(true);
    });

    it('adaptiveBadge 오버라이드 및 visible: false 시 피드백 표시 억제가 동작한다', () => {
      const feedback = new JudgmentFeedback();

      // 적응형 완화 뱃지 오버라이드
      const badgeCtx = createMockCtx();
      feedback.setPresentationContext({
        adaptiveBadge: {
          text: '★ 특별 완화 모드',
          color: '#FFEAA7',
          fontSize: 30,
        },
      });

      const relaxedState: JudgmentFeedbackState = {
        glowIntensity: 0.5,
        reasonKey: null,
        message: null,
        isVisible: false,
        adaptiveRelaxed: true,
      };

      feedback.render(badgeCtx, W, H, relaxedState);
      const badgeTexts = badgeCtx.calls
        .filter((c) => c.method === 'fillText')
        .map((c) => c.args[0] as string);
      expect(badgeTexts).toContain('★ 특별 완화 모드');

      // visible: false 억제
      const hiddenCtx = createMockCtx();
      feedback.setPresentationContext({
        hintBanner: {
          visible: false,
        },
      });
      feedback.render(hiddenCtx, W, H, {
        glowIntensity: 0.5,
        reasonKey: 'extension',
        message: '숨겨질 메시지',
        isVisible: true,
        adaptiveRelaxed: false,
      });
      const hiddenTexts = hiddenCtx.calls
        .filter((c) => c.method === 'fillText')
        .map((c) => c.args[0] as string);
      expect(hiddenTexts).not.toContain('숨겨질 메시지');
    });

    it('JudgmentFeedback.renderFixture가 DTO 기반으로 렌더링을 안전하게 수행한다', () => {
      const feedback = new JudgmentFeedback();
      const ctx = createMockCtx();

      feedback.renderFixture(ctx, W, H, DEFAULT_FEEDBACK_FIXTURE);
      expect(ctx.calls.some((c) => c.method === 'fillText')).toBe(true);

      const relaxedCtx = createMockCtx();
      feedback.renderFixture(relaxedCtx, W, H, ADAPTIVE_RELAXED_FEEDBACK_FIXTURE);
      expect(relaxedCtx.calls.some((c) => c.method === 'fillText')).toBe(true);

      const wrongCtx = createMockCtx();
      JudgmentFeedback.renderFixture(wrongCtx, W, H, WRONG_ANSWER_FEEDBACK_FIXTURE);
      expect(wrongCtx.calls.some((c) => c.method === 'fillText')).toBe(true);
    });
  });

  describe('4. 안전 bounds 및 게임플레이 보호 (Protected Gameplay Guard)', () => {
    it('getHintBounds와 getHazardBounds가 유효한 영역과 보호 플래그를 반환한다', () => {
      const adapter = new PhasePresentationAdapter();

      const hintBounds: FeedbackBounds = adapter.getHintBounds(W, H);
      expect(hintBounds.w).toBeGreaterThan(0);
      expect(hintBounds.h).toBeGreaterThan(0);
      expect(hintBounds.x).toBeCloseTo((W - hintBounds.w) / 2, 0);
      expect(hintBounds.isProtected).toBe(true);

      const hazardBounds = adapter.getHazardBounds('jump', W, H);
      expect(hazardBounds.w).toBeGreaterThan(0);
      expect(hazardBounds.h).toBeGreaterThan(0);
      expect(hazardBounds.isProtected).toBe(true);
    });

    it('외부 컨텍스트에서 임의 좌표 변조를 시도해도 getHintBounds는 안전 기본 영역을 유지한다', () => {
      const feedback = new JudgmentFeedback();
      feedback.setPresentationContext({
        hintBanner: {
          x: 10,
          y: 20,
          w: 100,
          h: 50,
        },
      });

      const bounds = feedback.getHintBounds(W, H);
      expect(bounds.x).not.toBe(10);
      expect(bounds.y).not.toBe(20);
      expect(bounds.x).toBeCloseTo((W - bounds.w) / 2, 0);
      expect(bounds.isProtected).toBe(true);
    });

    it('isSlotLocked 및 getSlotLockReason이 보호 슬롯에 대해 올바른 잠금 사유를 제공한다', () => {
      const adapter = new PhasePresentationAdapter();

      expect(adapter.isSlotLocked('judgment_threshold')).toBe(true);
      expect(adapter.isSlotLocked('gate_physics')).toBe(true);
      expect(adapter.isSlotLocked('hazard_geometry')).toBe(true);
      expect(adapter.isSlotLocked('hintBanner')).toBe(false);
      expect(adapter.isSlotLocked('hazardWarning')).toBe(false);

      const lockReason = adapter.getSlotLockReason('judgment_threshold');
      expect(lockReason).toContain('보호 영역');
    });

    it('validatePresentationContext가 보호 슬롯 및 좌표 왜곡 시도를 감지한다', () => {
      const adapter = new PhasePresentationAdapter();
      const maliciousContext = {
        judgment_threshold: { value: 0.9 },
        hintBanner: { x: 50, y: 50 },
      } as unknown as FeedbackPresentationContext;

      const issues = adapter.validatePresentationContext(maliciousContext);
      expect(issues.length).toBeGreaterThan(0);
      expect(issues.some((i) => i.includes('보호된 슬롯') || i.includes('좌표'))).toBe(true);
    });
  });

  describe('5. fromPresentationDocument 지원', () => {
    it('PhasePresentationAdapter.fromPresentationDocument가 hazard_evade 및 관련 요소를 정상 매핑한다', () => {
      const doc = createDefaultUIPresentationDocument();
      const parsed = PhasePresentationAdapter.fromPresentationDocument(doc, 'hazard_evade');

      expect(parsed.presentationDocument).toBe(doc);
      expect(parsed.pageId).toBe('hazard_evade');
      expect(parsed.hazardWarning).toBeDefined();
      expect(parsed.hazardWarning?.text).toContain('위험');
    });

    it('JudgmentFeedback.fromPresentationDocument가 문서에서 피드백 컨텍스트를 성공적으로 추출한다', () => {
      const doc = createDefaultUIPresentationDocument();
      const parsed = JudgmentFeedback.fromPresentationDocument(doc, 'answer_select');

      expect(parsed.presentationDocument).toBe(doc);
      expect(parsed.pageId).toBe('answer_select');
    });
  });

  describe('6. Scene Allow Matrix 및 분기 전환 로직 보존', () => {
    it('canRenderHazardZone, canRenderRunningMat, canRenderAnswerButtons 등 상태 허용 매트릭스가 보존된다', () => {
      const adapter = new PhasePresentationAdapter();

      // canRenderHazardZone / canRenderHazardEvade
      expect(adapter.canRenderHazardZone('HAZARD_EVADE')).toBe(true);
      expect(adapter.canRenderHazardZone('RUN_QUESTION')).toBe(false);
      expect(adapter.canRenderHazardZone('ANSWER_SELECT')).toBe(false);
      expect(adapter.canRenderHazardEvade('HAZARD_EVADE')).toBe(true);

      // canRenderRunningMat / canRenderRunningHUD
      expect(adapter.canRenderRunningMat('RUN_QUESTION')).toBe(true);
      expect(adapter.canRenderRunningMat('ANSWER_SELECT')).toBe(false);
      expect(adapter.canRenderRunningHUD('RUN_QUESTION')).toBe(true);

      // canRenderAnswerButtons / canRenderQuestion
      expect(adapter.canRenderAnswerButtons('ANSWER_SELECT')).toBe(true);
      expect(adapter.canRenderAnswerButtons('RUN_QUESTION')).toBe(false);
      expect(adapter.canRenderQuestion('ANSWER_SELECT')).toBe(true);

      // 기타 기존 허용 검증
      expect(adapter.canRenderPostureGuide('ANSWER_SELECT')).toBe(true);
      expect(adapter.canRenderReadyPosition('READY_POSITION')).toBe(true);
      expect(adapter.canRenderStarCollect('STAR_COLLECT')).toBe(true);
    });
  });
});
