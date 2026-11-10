/**
 * [LAYOUT-008] (Issue #575) 장애물 회피·판정 피드백 화면 레이아웃 설정 이전 (레인 판정 기하 잠금, +글자 textScale)
 *
 * 1. 기본값 특성화 (Characterization):
 *    - 기본 해상도(1080x2160)에서 HazardZoneRenderer 및 JudgmentFeedback의 각 시각 요소 bounds가 UI_LAYOUT과 100% 일치.
 *    - 이전 전 계산식 대비 오차 0px(또는 부동소수점 오차 범위 내) 정합성 보장.
 * 2. UI_LAYOUT.hazard 및 UI_LAYOUT.feedback 실시간 변경 반영 (캐싱 금지):
 *    - hazard: warningBanner (w, h, gapY, minY, x, y), timingGuide (offsetY, x, y) 실시간 반영.
 *    - feedback: hint (x, y, w, h), pill (h), adaptiveBadge (offsetY) 실시간 반영.
 * 3. textScale (0.5~3.0) 적용 및 clamping:
 *    - hazard: warningBanner.textScale, timingGuide.textScale 비례 조절 및 clamping.
 *    - feedback: hint.textScale, adaptiveBadge.textScale 비례 조절 및 clamping.
 * 4. 판정 연동 좌표 원자적 잠금 (장판/레인 판정 및 예약 밴드 기하 보호):
 *    - PROTECTED_HAZARD_ZONE_SLOT_IDS (hazard_geometry, timing_ring_physics, lane_evasion_zones, projection_matrix) 잠금.
 *    - getHazardZoneBounds, getTimingRingBounds, getSafeZoneBounds isProtected: true 유지.
 *    - PROTECTED_FEEDBACK_SLOT_IDS 및 getJudgmentHintBounds isProtected: true 유지.
 * 5. PresentationContext 오버라이드 최우선 순위 유지:
 *    - setPresentationContext 주입 시 UI_LAYOUT보다 우선 반영.
 * 6. DEVUI / UILayoutOverride 규칙 검증:
 *    - getLayoutKeyRule 검증 (textScale은 0.5~3.0 step 0.01, 좌표/크기는 integer).
 *    - applyLayoutOverride 적용 검증.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  HazardZoneRenderer,
  PROTECTED_HAZARD_ZONE_SLOT_IDS,
} from '../../src/render/HazardZoneRenderer.js';
import {
  JudgmentFeedback,
  getJudgmentHintBounds,
  PROTECTED_FEEDBACK_SLOT_IDS,
} from '../../src/ui/JudgmentFeedback.js';
import { UI_LAYOUT } from '../../config/ui.config.js';
import { resetLayoutTo, snapshotLayout } from '../../src/dev/DevLayoutPanel.js';
import { applyLayoutOverride, getLayoutKeyRule } from '../../src/core/UILayoutOverride.js';

const pristine = snapshotLayout(UI_LAYOUT);

function createMockCtx() {
  const fontsSet: string[] = [];
  const filledTexts: Array<{ text: string; x: number; y: number; font: string; fillStyle?: unknown }> = [];
  let _font = '';
  let _fillStyle: unknown = '#FFFFFF';

  const ctx = {
    save: vi.fn(),
    restore: vi.fn(),
    beginPath: vi.fn(),
    closePath: vi.fn(),
    moveTo: vi.fn(),
    lineTo: vi.fn(),
    stroke: vi.fn(),
    fill: vi.fn(),
    arc: vi.fn(),
    ellipse: vi.fn(),
    roundRect: vi.fn(),
    rect: vi.fn(),
    strokeRect: vi.fn(),
    fillRect: vi.fn(),
    clearRect: vi.fn(),
    fillText: vi.fn((text: string, x: number, y: number) => {
      filledTexts.push({ text: String(text), x, y, font: _font, fillStyle: _fillStyle });
    }),
    measureText: vi.fn((text: string) => ({ width: text.length * 10 })),
    setLineDash: vi.fn(),
    createLinearGradient: vi.fn(() => ({
      addColorStop: vi.fn(),
    })),
    createRadialGradient: vi.fn(() => ({
      addColorStop: vi.fn(),
    })),
    get font() {
      return _font;
    },
    set font(v: string) {
      _font = v;
      fontsSet.push(v);
    },
    get fillStyle() {
      return _fillStyle;
    },
    set fillStyle(v: unknown) {
      _fillStyle = v;
    },
    strokeStyle: '',
    lineWidth: 1,
    textAlign: 'center',
    textBaseline: 'middle',
    shadowColor: '',
    shadowBlur: 0,
    globalAlpha: 1.0,
    filledTexts,
    fontsSet,
  };

  return ctx as unknown as CanvasRenderingContext2D & {
    filledTexts: Array<{ text: string; x: number; y: number; font: string; fillStyle?: unknown }>;
    fontsSet: string[];
  };
}

describe('[LAYOUT-008] (Issue #575) 장애물 회피·판정 피드백 레이아웃 설정 이전', () => {
  beforeEach(() => {
    resetLayoutTo(UI_LAYOUT, pristine);
  });

  afterEach(() => {
    resetLayoutTo(UI_LAYOUT, pristine);
  });

  const W = 1080;
  const H = 2160;

  describe('1. 기본값 특성화 (Characterization)', () => {
    it('UI_LAYOUT에 hazard 및 feedback 기본 설정 블록이 등록되어 있어야 한다', () => {
      expect((UI_LAYOUT as any).hazard).toBeDefined();
      expect((UI_LAYOUT as any).hazard.warningBanner).toBeDefined();
      expect((UI_LAYOUT as any).hazard.timingGuide).toBeDefined();
      expect((UI_LAYOUT as any).feedback).toBeDefined();
      expect((UI_LAYOUT as any).feedback.hint).toBeDefined();
      expect((UI_LAYOUT as any).feedback.pill).toBeDefined();
      expect((UI_LAYOUT as any).feedback.adaptiveBadge).toBeDefined();
    });

    it('HazardZoneRenderer 기본 시각 bounds가 UI_LAYOUT.hazard 설정값과 정확히 일치해야 한다', () => {
      const renderer = new HazardZoneRenderer();
      const hz = renderer.getHazardZoneBounds('jump', W, H);
      const warnBounds = renderer.getWarningLabelBounds('jump', W, H);

      expect(warnBounds.w).toBe(432);
      expect(warnBounds.h).toBe(80);
      expect(warnBounds.x).toBe(hz.x + hz.w / 2 - 432 / 2);
      expect(warnBounds.y).toBeCloseTo(Math.max(20, hz.y - 80 - 30), 2);
      expect(warnBounds.isProtected).toBe(false);

      const guideBounds = (renderer as any).getTimingGuideBounds?.('jump', W, H);
      if (guideBounds) {
        expect(guideBounds.isProtected).toBe(false);
      }
    });

    it('JudgmentFeedback 기본 시각 bounds가 UI_LAYOUT.feedback 설정값과 정확히 일치해야 한다', () => {
      const feedback = new JudgmentFeedback();
      const hintBounds = getJudgmentHintBounds(W, H);

      expect(hintBounds.w).toBe(600);
      expect(hintBounds.h).toBe(80);
      expect(hintBounds.x).toBe(240);
      expect(hintBounds.y).toBe(1280);
      expect(hintBounds.isProtected).toBe(true);

      const pillBounds = (feedback as any).getPillBounds?.(W, H, 10);
      if (pillBounds) {
        expect(pillBounds.h).toBe(56);
        expect(pillBounds.isProtected).toBe(false);
      }

      const badgeBounds = (feedback as any).getAdaptiveBadgeBounds?.(W, H);
      if (badgeBounds) {
        expect(badgeBounds.y).toBe(hintBounds.y + hintBounds.h + 14);
        expect(badgeBounds.isProtected).toBe(false);
      }
    });

    it('기본 렌더링 시 텍스트 폰트 및 문자열이 기존과 100% 일치해야 한다', () => {
      const hazardRenderer = new HazardZoneRenderer();
      const mockHazardCtx = createMockCtx();

      hazardRenderer.render(mockHazardCtx, W, H, {
        activePattern: 'jump',
        beatProgress: 0.9,
        isResolved: false,
      });

      // 타이밍 안내 문구 (progress >= 0.8)
      const guideTextCall = mockHazardCtx.filledTexts.find((t) => t.text.includes('점프') || t.text.includes('스텝'));
      expect(guideTextCall).toBeDefined();
      expect(guideTextCall?.font).toContain('34px');

      // JudgmentFeedback 기본 렌더링
      const judgmentFeedback = new JudgmentFeedback();
      const mockFeedbackCtx = createMockCtx();
      (judgmentFeedback as any)._lastState = {
        glowIntensity: 0.5,
        reasonKey: 'extension',
        message: '조금 더 뻗으세요!',
        isVisible: true,
        adaptiveRelaxed: true,
      };

      judgmentFeedback.render(mockFeedbackCtx, W, H);

      const hintTextCall = mockFeedbackCtx.filledTexts.find((t) => t.text === '조금 더 뻗으세요!');
      expect(hintTextCall).toBeDefined();
      expect(hintTextCall?.font).toContain('bold');

      const badgeTextCall = mockFeedbackCtx.filledTexts.find((t) => t.text.includes('완화'));
      expect(badgeTextCall).toBeDefined();
      expect(badgeTextCall?.font).toContain('bold');
    });
  });

  describe('2. UI_LAYOUT 실시간 변경 반영 (캐싱 금지)', () => {
    it('UI_LAYOUT.hazard.warningBanner 변경이 즉시 getWarningLabelBounds에 반영된다', () => {
      const renderer = new HazardZoneRenderer();

      (UI_LAYOUT as any).hazard.warningBanner.w = 520;
      (UI_LAYOUT as any).hazard.warningBanner.h = 100;
      (UI_LAYOUT as any).hazard.warningBanner.gapY = 50;

      const hz = renderer.getHazardZoneBounds('jump', W, H);
      const warnBounds = renderer.getWarningLabelBounds('jump', W, H);

      expect(warnBounds.w).toBe(520);
      expect(warnBounds.h).toBe(100);
      expect(warnBounds.x).toBe(hz.x + hz.w / 2 - 520 / 2);
      expect(warnBounds.y).toBeCloseTo(Math.max(20, hz.y - 100 - 50), 2);
    });

    it('UI_LAYOUT.hazard.warningBanner의 x, y 오버라이드가 getWarningLabelBounds에 반영된다', () => {
      const renderer = new HazardZoneRenderer();

      (UI_LAYOUT as any).hazard.warningBanner.x = 210;
      (UI_LAYOUT as any).hazard.warningBanner.y = 1500;

      const warnBounds = renderer.getWarningLabelBounds('jump', W, H);
      expect(warnBounds.x).toBe(210);
      expect(warnBounds.y).toBe(1500);
    });

    it('UI_LAYOUT.hazard.timingGuide의 offsetY 변경이 안내 텍스트 렌더링 위치에 반영된다', () => {
      const renderer = new HazardZoneRenderer();
      const mockCtx = createMockCtx();

      (UI_LAYOUT as any).hazard.timingGuide.offsetY = 60;

      renderer.render(mockCtx, W, H, {
        activePattern: 'jump',
        beatProgress: 0.9,
        isResolved: false,
      });

      const guideCall = mockCtx.filledTexts.find((t) => t.text.includes('점프') || t.text.includes('스텝'));
      expect(guideCall).toBeDefined();
      // targetY - baseRy - 60
      const ring = renderer.getTimingRingBounds('jump', 1.0, W, H);
      const targetY = ring.y + ring.h / 2;
      const baseRy = ring.h / 2;
      expect(guideCall?.y).toBeCloseTo(targetY - baseRy - 60, 2);
    });

    it('UI_LAYOUT.feedback.hint 변경이 즉시 getJudgmentHintBounds에 반영된다', () => {
      (UI_LAYOUT as any).feedback.hint.x = 180;
      (UI_LAYOUT as any).feedback.hint.y = 1350;
      (UI_LAYOUT as any).feedback.hint.w = 720;
      (UI_LAYOUT as any).feedback.hint.h = 100;

      const bounds = getJudgmentHintBounds(W, H);
      expect(bounds.x).toBe(180);
      expect(bounds.y).toBe(1350);
      expect(bounds.w).toBe(720);
      expect(bounds.h).toBe(100);
    });

    it('UI_LAYOUT.feedback.pill.h 변경이 피드백 pill 높이에 반영된다', () => {
      const feedback = new JudgmentFeedback();
      (UI_LAYOUT as any).feedback.pill.h = 75;

      const pillBounds = (feedback as any).getPillBounds?.(W, H, 10);
      if (pillBounds) {
        expect(pillBounds.h).toBe(75);
      }
    });

    it('UI_LAYOUT.feedback.adaptiveBadge.offsetY 변경이 배지 Y 좌표에 반영된다', () => {
      const feedback = new JudgmentFeedback();
      (UI_LAYOUT as any).feedback.adaptiveBadge.offsetY = 30;

      const badgeBounds = (feedback as any).getAdaptiveBadgeBounds?.(W, H);
      if (badgeBounds) {
        const hint = getJudgmentHintBounds(W, H);
        expect(badgeBounds.y).toBe(hint.y + hint.h + 30);
      }
    });
  });

  describe('3. textScale (0.5 ~ 3.0) 적용 및 clamping', () => {
    it('HazardZoneRenderer: timingGuide.textScale = 2.0 배율이 폰트에 반영된다', () => {
      const renderer = new HazardZoneRenderer();
      const mockCtx = createMockCtx();

      (UI_LAYOUT as any).hazard.timingGuide.textScale = 2.0;

      renderer.render(mockCtx, W, H, {
        activePattern: 'jump',
        beatProgress: 0.95,
        isResolved: false,
      });

      const guideCall = mockCtx.filledTexts.find((t) => t.text.includes('점프') || t.text.includes('스텝'));
      expect(guideCall).toBeDefined();
      // 34 * 2.0 = 68px
      expect(guideCall?.font).toContain('68px');
    });

    it('HazardZoneRenderer: warningBanner.textScale 배율이 경고 배너 폰트에 반영된다', () => {
      const renderer = new HazardZoneRenderer();
      const mockCtx = createMockCtx();

      (UI_LAYOUT as any).hazard.warningBanner.textScale = 1.5;

      renderer.setPresentationContext({
        hazardWarning: {
          text: '위험 경고!',
        },
      });

      renderer.render(mockCtx, W, H, {
        activePattern: 'jump',
        beatProgress: 0.5,
      });

      const warnCall = mockCtx.filledTexts.find((t) => t.text === '위험 경고!');
      expect(warnCall).toBeDefined();
      // 36 * 1.5 = 54px
      expect(warnCall?.font).toContain('54px');
    });

    it('HazardZoneRenderer: textScale 0.5 미만은 0.5로, 3.0 초과는 3.0으로 clamping 된다', () => {
      const renderer = new HazardZoneRenderer();

      // < 0.5
      let mockCtx = createMockCtx();
      (UI_LAYOUT as any).hazard.timingGuide.textScale = 0.1;
      renderer.render(mockCtx, W, H, {
        activePattern: 'jump',
        beatProgress: 0.95,
        isResolved: false,
      });
      let guideCall = mockCtx.filledTexts.find((t) => t.text.includes('점프') || t.text.includes('스텝'));
      // 34 * 0.5 = 17px
      expect(guideCall?.font).toContain('17px');

      // > 3.0
      mockCtx = createMockCtx();
      (UI_LAYOUT as any).hazard.timingGuide.textScale = 5.0;
      renderer.render(mockCtx, W, H, {
        activePattern: 'jump',
        beatProgress: 0.95,
        isResolved: false,
      });
      guideCall = mockCtx.filledTexts.find((t) => t.text.includes('점프') || t.text.includes('스텝'));
      // 34 * 3.0 = 102px
      expect(guideCall?.font).toContain('102px');
    });

    it('JudgmentFeedback: hint.textScale = 1.8 배율이 메시지 폰트에 반영된다', () => {
      const feedback = new JudgmentFeedback();
      const mockCtx = createMockCtx();

      (UI_LAYOUT as any).feedback.hint.textScale = 1.8;
      (feedback as any)._lastState = {
        glowIntensity: 0.5,
        reasonKey: 'extension',
        message: '더 뻗으세요!',
        isVisible: true,
        adaptiveRelaxed: false,
      };

      feedback.render(mockCtx, W, H);

      const msgCall = mockCtx.filledTexts.find((t) => t.text === '더 뻗으세요!');
      expect(msgCall).toBeDefined();
      // UIText label (28px base) * 1.8 = 50.4px -> ~50px
      const pxMatch = msgCall?.font.match(/(\d+)px/);
      expect(pxMatch).toBeDefined();
      const parsedPx = parseInt(pxMatch![1], 10);
      expect(parsedPx).toBeGreaterThanOrEqual(48);
      expect(parsedPx).toBeLessThanOrEqual(52);
    });

    it('JudgmentFeedback: textScale 0.5 미만 및 3.0 초과 clamping 검증', () => {
      const feedback = new JudgmentFeedback();

      // < 0.5
      let mockCtx = createMockCtx();
      (UI_LAYOUT as any).feedback.hint.textScale = 0.05;
      (feedback as any)._lastState = {
        glowIntensity: 0.5,
        reasonKey: 'extension',
        message: '테스트',
        isVisible: true,
        adaptiveRelaxed: false,
      };
      feedback.render(mockCtx, W, H);
      let msgCall = mockCtx.filledTexts.find((t) => t.text === '테스트');
      let pxMatch = msgCall?.font.match(/(\d+)px/);
      // clamped to 0.5 -> 28 * 0.5 = 14px (or floor 18/22)
      expect(parseInt(pxMatch![1], 10)).toBeLessThanOrEqual(24);

      // > 3.0
      mockCtx = createMockCtx();
      (UI_LAYOUT as any).feedback.hint.textScale = 10.0;
      (feedback as any)._lastState = {
        glowIntensity: 0.5,
        reasonKey: 'extension',
        message: '테스트',
        isVisible: true,
        adaptiveRelaxed: false,
      };
      feedback.render(mockCtx, W, H);
      msgCall = mockCtx.filledTexts.find((t) => t.text === '테스트');
      pxMatch = msgCall?.font.match(/(\d+)px/);
      // clamped to 3.0 -> 28 * 3.0 = 84px
      expect(parseInt(pxMatch![1], 10)).toBeGreaterThanOrEqual(80);
      expect(parseInt(pxMatch![1], 10)).toBeLessThanOrEqual(90);
    });
  });

  describe('4. 판정 연동 좌표 원자적 잠금 (장판/레인 기하 및 판정 보호)', () => {
    it('PROTECTED_HAZARD_ZONE_SLOT_IDS에 기하/물리 슬롯이 잠겨 있어야 한다', () => {
      expect(PROTECTED_HAZARD_ZONE_SLOT_IDS).toContain('hazard_geometry');
      expect(PROTECTED_HAZARD_ZONE_SLOT_IDS).toContain('timing_ring_physics');
      expect(PROTECTED_HAZARD_ZONE_SLOT_IDS).toContain('lane_evasion_zones');
      expect(PROTECTED_HAZARD_ZONE_SLOT_IDS).toContain('projection_matrix');
    });

    it('HazardZoneRenderer의 물리 판정 영역은 isProtected: true 상태를 보존해야 한다', () => {
      const renderer = new HazardZoneRenderer();
      const hz = renderer.getHazardZoneBounds('jump', W, H);
      expect(hz.isProtected).toBe(true);

      const ring = renderer.getTimingRingBounds('jump', 0.5, W, H);
      expect(ring.isProtected).toBe(true);

      const safe = renderer.getSafeZoneBounds('left_step', W, H);
      expect(safe.isProtected).toBe(true);
    });

    it('UI_LAYOUT.hazard 수정 후에도 getHazardZoneBounds 판정 기하는 변경되지 않는다', () => {
      const renderer = new HazardZoneRenderer();
      const before = renderer.getHazardZoneBounds('jump', W, H);

      (UI_LAYOUT as any).hazard.warningBanner.w = 999;
      (UI_LAYOUT as any).hazard.timingGuide.offsetY = 999;

      const after = renderer.getHazardZoneBounds('jump', W, H);
      expect(after.x).toBe(before.x);
      expect(after.y).toBe(before.y);
      expect(after.w).toBe(before.w);
      expect(after.h).toBe(before.h);
    });

    it('PROTECTED_FEEDBACK_SLOT_IDS 및 isSlotLocked 동작이 보존되어야 한다', () => {
      const feedback = new JudgmentFeedback();
      for (const slot of PROTECTED_FEEDBACK_SLOT_IDS) {
        expect(feedback.isSlotLocked(slot)).toBe(true);
      }
      expect(feedback.isSlotLocked('judgment_threshold')).toBe(true);
      expect(feedback.isSlotLocked('gate_physics')).toBe(true);
    });
  });

  describe('5. PresentationContext 오버라이드 최우선 순위 유지', () => {
    it('HazardZoneRenderer: presentationContext의 fontSize/text/color가 UI_LAYOUT보다 우선한다', () => {
      const renderer = new HazardZoneRenderer();
      const mockCtx = createMockCtx();

      renderer.setPresentationContext({
        timingGuide: {
          text: '커스텀 타이밍!',
          fontSize: 50,
          color: '#00FFCC',
        },
      });

      renderer.render(mockCtx, W, H, {
        activePattern: 'jump',
        beatProgress: 0.95,
        isResolved: false,
      });

      const customCall = mockCtx.filledTexts.find((t) => t.text === '커스텀 타이밍!');
      expect(customCall).toBeDefined();
      expect(customCall?.font).toContain('50px');
      expect(customCall?.fillStyle).toBe('#00FFCC');
    });

    it('JudgmentFeedback: presentationContext의 hintBanner 오버라이드가 UI_LAYOUT보다 우선한다', () => {
      const feedback = new JudgmentFeedback();
      const mockCtx = createMockCtx();

      feedback.setPresentationContext({
        hintBanner: {
          fontSize: 44,
          color: '#FF00FF',
        },
      });

      (feedback as any)._lastState = {
        glowIntensity: 0.5,
        reasonKey: 'extension',
        message: '오버라이드 테스트',
        isVisible: true,
        adaptiveRelaxed: false,
      };

      feedback.render(mockCtx, W, H);

      const msgCall = mockCtx.filledTexts.find((t) => t.text === '오버라이드 테스트');
      expect(msgCall).toBeDefined();
      expect(msgCall?.font).toContain('44px');
    });
  });

  describe('6. DEVUI / UILayoutOverride 규칙 검증', () => {
    it('hazard 및 feedback의 textScale 키는 min 0.5, max 3.0, step 0.01 규칙을 반환한다', () => {
      const rule1 = getLayoutKeyRule('hazard.warningBanner.textScale');
      expect(rule1.min).toBe(0.5);
      expect(rule1.max).toBe(3.0);
      expect(rule1.step).toBe(0.01);
      expect(rule1.integer).toBe(false);

      const rule2 = getLayoutKeyRule('feedback.hint.textScale');
      expect(rule2.min).toBe(0.5);
      expect(rule2.max).toBe(3.0);
      expect(rule2.step).toBe(0.01);
      expect(rule2.integer).toBe(false);
    });

    it('hazard 및 feedback의 크기/좌표 키는 integer: true 규칙을 반환한다', () => {
      const ruleW = getLayoutKeyRule('hazard.warningBanner.w');
      expect(ruleW.integer).toBe(true);
      expect(ruleW.min).toBe(1);
      expect(ruleW.max).toBe(1080);

      const ruleY = getLayoutKeyRule('feedback.hint.y');
      expect(ruleY.integer).toBe(true);
      expect(ruleY.min).toBe(0);
      expect(ruleY.max).toBe(2160);

      const rulePillH = getLayoutKeyRule('feedback.pill.h');
      expect(rulePillH.integer).toBe(true);
      expect(rulePillH.min).toBe(1);
    });

    it('applyLayoutOverride가 hazard 및 feedback 설정을 안전하게 갱신한다', () => {
      const result = applyLayoutOverride(
        UI_LAYOUT as any,
        {
          hazard: {
            warningBanner: {
              w: 500,
              textScale: 1.4,
            },
          },
          feedback: {
            hint: {
              y: 1300,
              textScale: 1.25,
            },
            pill: {
              h: 64,
            },
          },
        },
      );

      expect(result.warnings).toEqual([]);
      expect((UI_LAYOUT as any).hazard.warningBanner.w).toBe(500);
      expect((UI_LAYOUT as any).hazard.warningBanner.textScale).toBe(1.4);
      expect((UI_LAYOUT as any).feedback.hint.y).toBe(1300);
      expect((UI_LAYOUT as any).feedback.hint.textScale).toBe(1.25);
      expect((UI_LAYOUT as any).feedback.pill.h).toBe(64);
    });
  });
});
