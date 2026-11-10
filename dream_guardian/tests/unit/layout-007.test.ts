/**
 * [LAYOUT-007] (Issue #574) 달리기 단계 HUD 레이아웃 설정 이전 - BeatHUD·러닝 매트 시각 요소 (페달 존 잠금, +글자 textScale)
 *
 * 1. 기본값 특성화 (Characterization):
 *    - 기본 해상도(1080x2160)에서 BeatHUDRenderer 및 RunningMatRenderer의 각 시각 요소 bounds가 UI_LAYOUT과 100% 일치.
 *    - 이전 전 계산식 대비 오차 0px(또는 부동소수점 오차 범위 내) 정합성 보장.
 * 2. UI_LAYOUT.beatHud 및 UI_LAYOUT.runningMat 실시간 변경 반영 (캐싱 금지):
 *    - beatHud: exerciseBadge, beatDots, stepCounter, hazardGuide의 x, y, w, h 실시간 반영.
 *    - runningMat: header (maxWidth, offsetY, h), upcomingPreview (maxWidth, offsetY, h), strikeLine (h) 실시간 반영.
 * 3. textScale (0.5~3.0) 적용:
 *    - beatHud: exerciseBadge(textScale, titleTextScale, subtitleTextScale), stepCounter.textScale, beatDots.textScale 비례 조절 및 clamping.
 *    - runningMat: header(textScale, badgeTextScale, countTextScale), upcomingPreview.textScale 비례 조절 및 clamping.
 * 4. 판정 연동 좌표 원자적 잠금 (Zone 9/10/11 및 바닥 판정선 기하 보호):
 *    - RunningMat의 getLaneAnchorBounds(left/center/right/9/10/11), computeStrikeLineY, getRunningMatBounds는 잠금 상태 보존.
 * 5. PresentationContext 오버라이드 최우선 순위 유지:
 *    - setPresentationContext 주입 시 UI_LAYOUT보다 우선 반영.
 * 6. DEVUI / UILayoutOverride 규칙 검증:
 *    - getLayoutKeyRule 검증 (textScale은 0.5~3.0 step 0.01, 좌표/크기는 integer).
 *    - applyLayoutOverride 적용 검증.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  BeatHUDRenderer,
  type BeatHUDState,
} from '../../src/render/BeatHUDRenderer.js';
import {
  RunningMatRenderer,
} from '../../src/render/RunningMatRenderer.js';
import type { RunningMatViewModel } from '../../src/render/RunningMatPresenter.js';
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
    globalAlpha: 1,
    fontsSet,
    filledTexts,
  };

  return ctx as unknown as CanvasRenderingContext2D & {
    fontsSet: string[];
    filledTexts: Array<{ text: string; x: number; y: number; font: string; fillStyle?: unknown }>;
  };
}

describe('[LAYOUT-007] 달리기 단계 HUD 레이아웃 설정 이전 (BeatHUD & RunningMat)', () => {
  beforeEach(() => {
    resetLayoutTo(UI_LAYOUT, pristine);
  });

  afterEach(() => {
    resetLayoutTo(UI_LAYOUT, pristine);
  });

  describe('1. 기본값 특성화 (Characterization) - 이전 전 계산식과 100% 일치', () => {
    const W = 1080;
    const H = 2160;

    it('BeatHUDRenderer 기본 bounds가 UI_LAYOUT.beatHud 설정값과 정확히 일치해야 한다', () => {
      const beatHud = new BeatHUDRenderer();

      // ExerciseBadge
      const badgeBounds = beatHud.getExerciseBadgeBounds(W, H);
      expect(badgeBounds.w).toBe(480);
      expect(badgeBounds.h).toBe(100);
      expect(badgeBounds.x).toBe(300); // 1080 / 2 - 480 / 2
      expect(badgeBounds.y).toBeCloseTo(2160 * 0.52 - 80, 2);

      // BeatDots
      const dotsBounds = beatHud.getBeatDotsBounds(W, H);
      expect(dotsBounds.w).toBe(348); // 7 * 44 + 40
      expect(dotsBounds.h).toBe(40);
      expect(dotsBounds.x).toBe(366); // 540 - 174
      expect(dotsBounds.y).toBeCloseTo(2160 * 0.52 + 260 - 20, 2);

      // StepCounter
      const stepBounds = beatHud.getStepCounterBounds(W, H);
      expect(stepBounds.w).toBe(320);
      expect(stepBounds.h).toBe(40);
      expect(stepBounds.x).toBe(380); // 540 - 160
      expect(stepBounds.y).toBeCloseTo(2160 * 0.52 + 260 + 24, 2);

      // HazardGuide
      const hazBounds = beatHud.getHazardGuideBounds(W, H);
      expect(hazBounds.w).toBe(500);
      expect(hazBounds.h).toBe(120);
      expect(hazBounds.x).toBe(290); // 540 - 250
      expect(hazBounds.y).toBeCloseTo(2160 * 0.52 - 80, 2);
    });

    it('RunningMatRenderer 기본 시각 bounds가 UI_LAYOUT.runningMat 설정값과 정확히 일치해야 한다', () => {
      const mat = new RunningMatRenderer();

      // StatusHeader
      const headerBounds = mat.getStatusHeaderBounds(W, H);
      expect(headerBounds.w).toBe(480);
      expect(headerBounds.h).toBe(40);
      expect(headerBounds.x).toBe(300); // 540 - 240
      expect(headerBounds.y).toBeCloseTo(H * 0.74 - 48, 2);

      // UpcomingPreviews
      const previewBounds = mat.getUpcomingPreviewsBounds(W, H);
      expect(previewBounds.w).toBe(420);
      expect(previewBounds.h).toBe(30);
      expect(previewBounds.x).toBe(330); // 540 - 210
      expect(previewBounds.y).toBeCloseTo(H * 0.74 - 48, 2);

      // StrikeLine Visual Height
      const strikeBounds = mat.getStrikeLineBounds(W, H);
      expect(strikeBounds.h).toBe(40);
      expect(strikeBounds.isProtected).toBe(true);
    });

    it('기본 렌더링 시 텍스트 폰트 및 문자열이 기존과 완전히 동일해야 한다', () => {
      const beatHud = new BeatHUDRenderer();
      const mockCtx = createMockCtx();
      const state: BeatHUDState = {
        totalSteps: 12,
        locomotionMode: 'run',
      };

      beatHud.render(mockCtx, W, H, state);

      const titleCall = mockCtx.filledTexts.find((t) => t.text.includes('달리기'));
      expect(titleCall).toBeDefined();
      expect(titleCall?.font).toContain('bold');

      const subtitleCall = mockCtx.filledTexts.find((t) => t.text.includes('발을 굴러주세요'));
      expect(subtitleCall).toBeDefined();

      const stepCall = mockCtx.filledTexts.find((t) => t.text.includes('12'));
      expect(stepCall).toBeDefined();
    });
  });

  describe('2. UI_LAYOUT 실시간 변경 반영 (캐싱 금지)', () => {
    const W = 1080;
    const H = 2160;

    it('UI_LAYOUT.beatHud의 각 슬롯 좌표/크기 변경이 매 프레임 즉시 bounds에 반영된다', () => {
      const beatHud = new BeatHUDRenderer();

      // exerciseBadge 수정
      (UI_LAYOUT as any).beatHud.exerciseBadge.w = 600;
      (UI_LAYOUT as any).beatHud.exerciseBadge.h = 150;
      (UI_LAYOUT as any).beatHud.exerciseBadge.x = 240;
      (UI_LAYOUT as any).beatHud.exerciseBadge.y = 900;

      const badgeBounds = beatHud.getExerciseBadgeBounds(W, H);
      expect(badgeBounds.w).toBe(600);
      expect(badgeBounds.h).toBe(150);
      expect(badgeBounds.x).toBe(240);
      expect(badgeBounds.y).toBe(900);

      // beatDots 수정
      (UI_LAYOUT as any).beatHud.beatDots.w = 400;
      (UI_LAYOUT as any).beatHud.beatDots.h = 50;
      (UI_LAYOUT as any).beatHud.beatDots.x = 340;
      (UI_LAYOUT as any).beatHud.beatDots.y = 1300;

      const dotsBounds = beatHud.getBeatDotsBounds(W, H);
      expect(dotsBounds.w).toBe(400);
      expect(dotsBounds.h).toBe(50);
      expect(dotsBounds.x).toBe(340);
      expect(dotsBounds.y).toBe(1300);

      // stepCounter 수정
      (UI_LAYOUT as any).beatHud.stepCounter.w = 380;
      (UI_LAYOUT as any).beatHud.stepCounter.h = 60;
      (UI_LAYOUT as any).beatHud.stepCounter.x = 350;
      (UI_LAYOUT as any).beatHud.stepCounter.y = 1500;

      const stepBounds = beatHud.getStepCounterBounds(W, H);
      expect(stepBounds.w).toBe(380);
      expect(stepBounds.h).toBe(60);
      expect(stepBounds.x).toBe(350);
      expect(stepBounds.y).toBe(1500);

      // hazardGuide 수정
      (UI_LAYOUT as any).beatHud.hazardGuide.w = 550;
      (UI_LAYOUT as any).beatHud.hazardGuide.h = 140;
      (UI_LAYOUT as any).beatHud.hazardGuide.x = 265;
      (UI_LAYOUT as any).beatHud.hazardGuide.y = 880;

      const hazBounds = beatHud.getHazardGuideBounds(W, H);
      expect(hazBounds.w).toBe(550);
      expect(hazBounds.h).toBe(140);
      expect(hazBounds.x).toBe(265);
      expect(hazBounds.y).toBe(880);
    });

    it('UI_LAYOUT.runningMat의 header, upcomingPreview, strikeLine 변경이 즉시 bounds에 반영된다', () => {
      const mat = new RunningMatRenderer();

      (UI_LAYOUT as any).runningMat.header.maxWidth = 600;
      (UI_LAYOUT as any).runningMat.header.h = 60;
      (UI_LAYOUT as any).runningMat.header.offsetY = -65;

      const headerBounds = mat.getStatusHeaderBounds(W, H);
      expect(headerBounds.w).toBe(600);
      expect(headerBounds.h).toBe(60);
      expect(headerBounds.y).toBeCloseTo(H * 0.74 - 65, 2);

      (UI_LAYOUT as any).runningMat.upcomingPreview.maxWidth = 500;
      (UI_LAYOUT as any).runningMat.upcomingPreview.h = 45;
      (UI_LAYOUT as any).runningMat.upcomingPreview.offsetY = -70;

      const previewBounds = mat.getUpcomingPreviewsBounds(W, H);
      expect(previewBounds.w).toBe(500);
      expect(previewBounds.h).toBe(45);
      expect(previewBounds.y).toBeCloseTo(H * 0.74 - 70, 2);

      // strikeLine 높이 조절
      (UI_LAYOUT as any).runningMat.strikeLine.h = 60;
      const strikeBounds = mat.getStrikeLineBounds(W, H);
      expect(strikeBounds.h).toBe(60);
      expect(strikeBounds.y).toBeCloseTo(mat.computeStrikeLineY(H) - 30, 2);
    });
  });

  describe('3. textScale (0.5 ~ 3.0) 적용 및 clamping', () => {
    const W = 1080;
    const H = 2160;

    it('BeatHUDRenderer: exerciseBadge.textScale 및 titleTextScale/subtitleTextScale 배율이 폰트에 반영된다', () => {
      const beatHud = new BeatHUDRenderer();
      const mockCtx = createMockCtx();
      const state: BeatHUDState = { totalSteps: 5, locomotionMode: 'run' };

      // textScale = 2.0 적용
      (UI_LAYOUT as any).beatHud.exerciseBadge.titleTextScale = 2.0;
      (UI_LAYOUT as any).beatHud.exerciseBadge.subtitleTextScale = 1.5;

      beatHud.render(mockCtx, W, H, state);

      const titleEntry = mockCtx.filledTexts.find((t) => t.text.includes('달리기'));
      expect(titleEntry).toBeDefined();
      // subheading base 44 * 2.0 = 88px (또는 UIText.getFont 결과)
      expect(titleEntry?.font).toMatch(/88px|bold.*88/);

      const subEntry = mockCtx.filledTexts.find((t) => t.text.includes('발을 굴러주세요'));
      expect(subEntry).toBeDefined();
      // label base 28 * 1.5 = 42px
      expect(subEntry?.font).toMatch(/42px/);
    });

    it('BeatHUDRenderer: stepCounter.textScale 배율이 누적 스텝 텍스트에 반영된다', () => {
      const beatHud = new BeatHUDRenderer();
      const mockCtx = createMockCtx();
      const state: BeatHUDState = { totalSteps: 10, locomotionMode: 'run' };

      (UI_LAYOUT as any).beatHud.stepCounter.textScale = 1.5;

      beatHud.render(mockCtx, W, H, state);

      const stepEntry = mockCtx.filledTexts.find((t) => t.text.includes('10'));
      expect(stepEntry).toBeDefined();
      // body base 36 * 1.5 = 54px
      expect(stepEntry?.font).toMatch(/54px/);
    });

    it('RunningMatRenderer: header의 textScale(badgeTextScale, countTextScale)이 폰트에 반영된다', () => {
      const mat = new RunningMatRenderer();
      const mockCtx = createMockCtx();

      (UI_LAYOUT as any).runningMat.header.badgeTextScale = 2.0; // 14 * 2.0 = 28px
      (UI_LAYOUT as any).runningMat.header.countTextScale = 1.5; // 12 * 1.5 = 18px

      const view: RunningMatViewModel = {
        visible: true,
        paused: false,
        currentCue: null,
        nextCue: null,
        upcomingCues: [],
        actionText: '달리기',
        directionText: 'center',
        cueText: '오른발',
        arrowDirection: 'center',
        nextRingRatio: 0.5,
        elapsedBeats: 4,
        acceptedExerciseCount: 3,
        requiredExerciseCount: 8,
        isShortage: false,
        isPreparing: false,
      };

      (mat as any)._renderStatusHeader(mockCtx, view, 540, 1500, W);

      const badgeCall = mockCtx.filledTexts.find((t) => t.text.includes('달리기'));
      expect(badgeCall).toBeDefined();
      expect(badgeCall?.font).toContain('28px');

      const countCall = mockCtx.filledTexts.find((t) => t.text.includes('3 / 8'));
      expect(countCall).toBeDefined();
      expect(countCall?.font).toContain('18px');
    });

    it('textScale은 0.5 미만 및 3.0 초과 시 자동 clamping 되어야 한다', () => {
      const mat = new RunningMatRenderer();
      const mockCtx = createMockCtx();

      (UI_LAYOUT as any).runningMat.header.badgeTextScale = 0.1; // clamp to 0.5 -> 14 * 0.5 = 7px
      (UI_LAYOUT as any).runningMat.header.countTextScale = 9.9; // clamp to 3.0 -> 12 * 3.0 = 36px

      const view: RunningMatViewModel = {
        visible: true,
        paused: false,
        currentCue: null,
        nextCue: null,
        upcomingCues: [],
        actionText: '스쿼트',
        directionText: 'center',
        cueText: '다운',
        arrowDirection: 'center',
        nextRingRatio: 0.2,
        elapsedBeats: 2,
        acceptedExerciseCount: 1,
        requiredExerciseCount: 5,
        isShortage: false,
        isPreparing: false,
      };

      (mat as any)._renderStatusHeader(mockCtx, view, 540, 1500, W);

      const badgeCall = mockCtx.filledTexts.find((t) => t.text.includes('스쿼트'));
      expect(badgeCall?.font).toContain('7px');

      const countCall = mockCtx.filledTexts.find((t) => t.text.includes('1 / 5'));
      expect(countCall?.font).toContain('36px');
    });
  });

  describe('4. 판정 연동 좌표 원자적 잠금 (Zone 9/10/11 및 판정선 보존)', () => {
    const W = 1080;
    const H = 2160;

    it('UI_LAYOUT이 변경되어도 러닝 매트의 판정선 위치 및 레인 앵커 좌표는 절대 변경되지 않는다', () => {
      const mat = new RunningMatRenderer();

      const origStrikeY = mat.computeStrikeLineY(H);
      const origLeftAnchor = mat.getLaneAnchorBounds('left', W, H);
      const origCenterAnchor = mat.getLaneAnchorBounds('center', W, H);
      const origRightAnchor = mat.getLaneAnchorBounds('right', W, H);

      // UI_LAYOUT 값 극단적 변경
      (UI_LAYOUT as any).runningMat.header.maxWidth = 999;
      (UI_LAYOUT as any).runningMat.strikeLine.h = 100;

      // 판정 기하 불변 검증
      expect(mat.computeStrikeLineY(H)).toBe(origStrikeY);
      expect(mat.getLaneAnchorBounds('left', W, H)).toEqual(origLeftAnchor);
      expect(mat.getLaneAnchorBounds('center', W, H)).toEqual(origCenterAnchor);
      expect(mat.getLaneAnchorBounds('right', W, H)).toEqual(origRightAnchor);

      // 슬롯 잠금 검증
      expect(mat.isSlotLocked('strike_line_geometry')).toBe(true);
      expect(mat.isSlotLocked('target_anchors')).toBe(true);
      expect(mat.isSlotLocked('zone_9_mat_cell')).toBe(true);
      expect(mat.isSlotLocked('zone_10_mat_cell')).toBe(true);
      expect(mat.isSlotLocked('zone_11_mat_cell')).toBe(true);
    });
  });

  describe('5. PresentationContext 오버라이드 최우선 순위 유지', () => {
    const W = 1080;
    const H = 2160;

    it('BeatHUDRenderer에 presentationContext가 주입되면 UI_LAYOUT보다 우선 적용된다', () => {
      const beatHud = new BeatHUDRenderer();

      (UI_LAYOUT as any).beatHud.exerciseBadge.x = 200;
      (UI_LAYOUT as any).beatHud.exerciseBadge.w = 500;

      beatHud.setPresentationContext({
        exerciseBadge: {
          x: 111,
          y: 222,
          w: 333,
          h: 444,
        },
      });

      const bounds = beatHud.getExerciseBadgeBounds(W, H);
      expect(bounds.x).toBe(111);
      expect(bounds.y).toBe(222);
      expect(bounds.w).toBe(333);
      expect(bounds.h).toBe(444);
    });

    it('RunningMatRenderer에 presentationContext가 주입되면 UI_LAYOUT보다 우선 적용된다', () => {
      const mat = new RunningMatRenderer();

      (UI_LAYOUT as any).runningMat.header.maxWidth = 500;
      (UI_LAYOUT as any).runningMat.header.h = 50;

      mat.setPresentationContext({
        statusHeader: {
          x: 77,
          y: 88,
          w: 400,
          h: 70,
        },
      });

      const bounds = mat.getStatusHeaderBounds(W, H);
      expect(bounds.x).toBe(77);
      expect(bounds.y).toBe(88);
      expect(bounds.w).toBe(400);
      expect(bounds.h).toBe(70);
    });
  });

  describe('6. DEVUI / UILayoutOverride 규칙 및 적용 검증', () => {
    it('beatHud 및 runningMat textScale 키는 min 0.5, max 3.0, step 0.01 규칙을 반환한다', () => {
      const rule1 = getLayoutKeyRule('beatHud.exerciseBadge.textScale');
      expect(rule1.min).toBe(0.5);
      expect(rule1.max).toBe(3.0);
      expect(rule1.step).toBe(0.01);
      expect(rule1.integer).toBe(false);

      const rule2 = getLayoutKeyRule('runningMat.header.badgeTextScale');
      expect(rule2.min).toBe(0.5);
      expect(rule2.max).toBe(3.0);
      expect(rule2.step).toBe(0.01);
      expect(rule2.integer).toBe(false);
    });

    it('applyLayoutOverride를 통해 beatHud 및 runningMat 설정을 오버라이드할 수 있다', () => {
      const patch = {
        beatHud: {
          exerciseBadge: {
            w: 520,
            textScale: 1.25,
          },
        },
        runningMat: {
          header: {
            maxWidth: 510,
            textScale: 1.15,
          },
          strikeLine: {
            h: 48,
          },
        },
      };

      const result = applyLayoutOverride(UI_LAYOUT, patch);
      expect(result.warnings).toHaveLength(0);
      expect(result.applied).toContain('beatHud.exerciseBadge.w');
      expect(result.applied).toContain('beatHud.exerciseBadge.textScale');
      expect(result.applied).toContain('runningMat.header.maxWidth');
      expect(result.applied).toContain('runningMat.header.textScale');
      expect(result.applied).toContain('runningMat.strikeLine.h');

      expect((UI_LAYOUT as any).beatHud.exerciseBadge.w).toBe(520);
      expect((UI_LAYOUT as any).beatHud.exerciseBadge.textScale).toBe(1.25);
      expect((UI_LAYOUT as any).runningMat.header.maxWidth).toBe(510);
      expect((UI_LAYOUT as any).runningMat.header.textScale).toBe(1.15);
      expect((UI_LAYOUT as any).runningMat.strikeLine.h).toBe(48);
    });
  });
});
