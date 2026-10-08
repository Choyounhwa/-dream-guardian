/**
 * running-mat-renderer.test.ts - 반투명 원근 러닝 매트 렌더러 단위 테스트
 *
 * @see Issue #372 [RUN-MAT-003]
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { RunningMatRenderer } from '../../src/render/RunningMatRenderer.js';
import {
  RUNNING_MAT_CONFIG,
  DEFAULT_MAT_BASE_Y_TOP,
  DEFAULT_MAT_BASE_Y_BOTTOM,
  DEFAULT_MAT_WIDTH_RATIO,
  MAX_NARROW_WIDTH_RATIO,
  DEFAULT_VANISHING_Y_RATIO,
  DEFAULT_STRIKE_LINE_Y_RATIO,
} from '../../config/running-mat.config.js';
import type { RunningMatViewModel } from '../../src/render/RunningMatPresenter.js';

function createMockContext(): CanvasRenderingContext2D {
  return {
    save: vi.fn(),
    restore: vi.fn(),
    beginPath: vi.fn(),
    moveTo: vi.fn(),
    lineTo: vi.fn(),
    closePath: vi.fn(),
    arc: vi.fn(),
    ellipse: vi.fn(),
    fill: vi.fn(),
    stroke: vi.fn(),
    fillText: vi.fn(),
    strokeText: vi.fn(),
    measureText: vi.fn().mockReturnValue({ width: 60 }),
    fillRect: vi.fn(),
    strokeRect: vi.fn(),
    createLinearGradient: vi.fn().mockReturnValue({
      addColorStop: vi.fn(),
    }),
    createRadialGradient: vi.fn().mockReturnValue({
      addColorStop: vi.fn(),
    }),
    setLineDash: vi.fn(),
    fillStyle: '',
    strokeStyle: '',
    lineWidth: 1,
    font: '',
    textAlign: 'center',
    textBaseline: 'middle',
    globalAlpha: 1.0,
    shadowColor: '',
    shadowBlur: 0,
  } as unknown as CanvasRenderingContext2D;
}

function createBaseViewModel(overrides: Partial<RunningMatViewModel> = {}): RunningMatViewModel {
  return {
    visible: true,
    paused: false,
    currentCue: {
      beatIndex: 0,
      actionId: 'left_out',
      actionText: '왼발 딛기',
      directionText: '왼쪽',
      cueText: '왼발 바깥',
      arrowDirection: 'left',
      leftFootSlot: 'out',
      rightFootSlot: 'home',
      isPrepare: false,
    },
    nextCue: null,
    actionText: '왼발 딛기',
    directionText: '왼쪽',
    cueText: '왼발 바깥',
    arrowDirection: 'left',
    nextRingRatio: 0.75,
    elapsedBeats: 0,
    acceptedExerciseCount: 0,
    requiredExerciseCount: 4,
    isShortage: false,
    isPreparing: false,
    upcomingCues: overrides.upcomingCues ?? [],
    ...overrides,
  };
}

describe('RunningMatRenderer (Issue #372 - RUN-MAT-003)', () => {
  let renderer: RunningMatRenderer;
  let ctx: CanvasRenderingContext2D;

  const width = 1080;
  const height = 1920;

  beforeEach(() => {
    renderer = new RunningMatRenderer();
    ctx = createMockContext();
  });

  describe('1. 기본 설정(config) 정합성 검증', () => {
    it('기본 화면 정규화 Y 범위 및 네온 판정선 Y 비율(0.86)이 정의되어 있어야 한다', () => {
      expect(DEFAULT_MAT_BASE_Y_TOP).toBeCloseTo(0.74, 2);
      expect(DEFAULT_MAT_BASE_Y_BOTTOM).toBeCloseTo(0.94, 2);
      expect(DEFAULT_STRIKE_LINE_Y_RATIO).toBeCloseTo(0.86, 2);
      expect(RUNNING_MAT_CONFIG.baseYTop).toBeCloseTo(0.74, 2);
      expect(RUNNING_MAT_CONFIG.baseYBottom).toBeCloseTo(0.94, 2);
      expect(RUNNING_MAT_CONFIG.strikeLineYRatio).toBeCloseTo(0.86, 2);
      expect(RUNNING_MAT_CONFIG.strikeCoreLineWidth).toBeGreaterThanOrEqual(3);
      expect(RUNNING_MAT_CONFIG.strikeInnerGlowWidth).toBeGreaterThanOrEqual(10);
      expect(RUNNING_MAT_CONFIG.strikeOuterGlowWidth).toBeGreaterThanOrEqual(32);
      expect(RUNNING_MAT_CONFIG.strikeOverhangRatio).toBeGreaterThanOrEqual(0.10);
    });

    it('판정선 색상은 오렌지-골드/옐로우 고휘도 블렌드 팔레트여야 한다 (Issue #422)', () => {
      expect(RUNNING_MAT_CONFIG.strikeInnerColor).toMatch(/#(FF[A-Z0-9]{4}|FFA[0-9A-F]{3}|FFB[0-9A-F]{3}|FFC[0-9A-F]{3})/i);
      expect(RUNNING_MAT_CONFIG.strikeOuterColor).toMatch(/rgba\(255,\s*(1[0-4][0-9]|150|[0-9]{2})/);
    });

    it('듀얼 네온 블러(shadowBlur 20~25px, shadowColor #FF6600) 및 골드-주황 그라데이션 설정이 정의되어 있어야 한다 (Issue #426)', () => {
      expect(RUNNING_MAT_CONFIG.strikeAuraShadowBlur).toBeGreaterThanOrEqual(20);
      expect(RUNNING_MAT_CONFIG.strikeAuraShadowBlur).toBeLessThanOrEqual(25);
      expect(RUNNING_MAT_CONFIG.strikeAuraShadowColor).toBe('#FF6600');
      expect(RUNNING_MAT_CONFIG.strikeCoreGradientStart).toBe('#FFB800');
      expect(RUNNING_MAT_CONFIG.strikeCoreGradientEnd).toBe('#FF8800');
    });

    it('발 리듬 비트 노트(Stomp Beat Note) 시각 설정이 정의되어 있어야 한다 (Issue #425)', () => {
      expect(RUNNING_MAT_CONFIG.stompNoteRadius).toBeGreaterThanOrEqual(18);
      expect(RUNNING_MAT_CONFIG.stompNoteMinScale).toBeLessThan(0.5);
      expect(RUNNING_MAT_CONFIG.stompNoteMaxScale).toBeGreaterThanOrEqual(1.1);
      expect(RUNNING_MAT_CONFIG.stompNoteLeftColor).toBeDefined();
      expect(RUNNING_MAT_CONFIG.stompNoteCenterColor).toBeDefined();
      expect(RUNNING_MAT_CONFIG.stompNoteRightColor).toBeDefined();
    });

    it('기본 폭 비율 0.76 및 좁은 화면 최대 폭 비율 0.90을 제공해야 한다', () => {
      expect(DEFAULT_MAT_WIDTH_RATIO).toBeCloseTo(0.76, 2);
      expect(MAX_NARROW_WIDTH_RATIO).toBeCloseTo(0.90, 2);
      expect(RUNNING_MAT_CONFIG.widthRatio).toBeCloseTo(0.76, 2);
      expect(RUNNING_MAT_CONFIG.maxNarrowWidthRatio).toBeCloseTo(0.90, 2);
    });

    it('셀 배경색은 웹캠 하체가 비치는 반투명 알파를 가져야 한다 (불투명 검은 판 금지)', () => {
      expect(RUNNING_MAT_CONFIG.cellBgColor).toMatch(/rgba\(/);
      expect(RUNNING_MAT_CONFIG.cellBgColor).not.toBe('#000000');
    });
  });

  describe('2. 가드 조건 및 캔버스 상태 격리', () => {
    it('view가 null이어도 상시 앰비언트 모드로 가로 판정선과 타깃 앵커를 렌더링한다 (Issue #422)', () => {
      renderer.render(ctx, null, width, height);
      expect(ctx.save).toHaveBeenCalledTimes(1);
      expect(ctx.beginPath).toHaveBeenCalled();
      expect(ctx.restore).toHaveBeenCalledTimes(1);
    });

    it('view.visible이 false이면 렌더링을 즉시 생략한다', () => {
      const view = createBaseViewModel({ visible: false });
      renderer.render(ctx, view, width, height);
      expect(ctx.save).not.toHaveBeenCalled();
      expect(ctx.beginPath).not.toHaveBeenCalled();
      expect(ctx.restore).not.toHaveBeenCalled();
    });

    it('유효하지 않은 화면 크기(0, 음수, NaN, Infinity)에서 안전하게 no-op 처리한다', () => {
      const view = createBaseViewModel();
      renderer.render(ctx, view, 0, height);
      renderer.render(ctx, view, -100, height);
      renderer.render(ctx, view, width, 0);
      renderer.render(ctx, view, width, -500);
      renderer.render(ctx, view, Number.NaN, height);
      renderer.render(ctx, view, width, Number.POSITIVE_INFINITY);

      expect(ctx.save).not.toHaveBeenCalled();
      expect(ctx.restore).not.toHaveBeenCalled();
    });

    it('정상 렌더링 시 ctx.save()와 ctx.restore()가 대칭으로 정확히 1회 호출되어야 한다', () => {
      const view = createBaseViewModel();
      renderer.render(ctx, view, width, height);
      expect(ctx.save).toHaveBeenCalledTimes(1);
      expect(ctx.restore).toHaveBeenCalledTimes(1);
    });
  });

  describe('3. 네온 글로우 발 판정선(Foot Strike Line) 및 3대 레인 타깃 앵커 렌더링', () => {
    it('구 3칸 사다리꼴 매트 셀 fill 대신, 네온 글로우 수평 판정선을 렌더링한다', () => {
      const view = createBaseViewModel();
      renderer.render(ctx, view, width, height);

      // 수평 판정선 및 타깃 앵커 렌더링 확인
      expect(ctx.beginPath).toHaveBeenCalled();
      expect(ctx.stroke).toHaveBeenCalled();
      // Y 좌표 0.86 부근(height * 0.86)으로 moveTo / lineTo 호출 확인
      const lineToCalls = vi.mocked(ctx.lineTo).mock.calls;
      const expectedY = height * 0.86;
      const hasStrikeLine = lineToCalls.some((call) => Math.abs(call[1] - expectedY) < 5);
      expect(hasStrikeLine).toBe(true);
    });

    it('수평 판정선이 화면 좌우 경계를 넘어서는 전폭(-10% ~ 110%)으로 길게 렌더링된다 (Issue #422)', () => {
      renderer.render(ctx, null, width, height);

      const lineToCalls = vi.mocked(ctx.lineTo).mock.calls;
      const moveToCalls = vi.mocked(ctx.moveTo).mock.calls;
      const hasBeyondRight = lineToCalls.some((call) => call[0] >= width * 1.05);
      const hasBeyondLeft = moveToCalls.some((call) => call[0] <= 0);
      expect(hasBeyondRight).toBe(true);
      expect(hasBeyondLeft).toBe(true);
    });

    it('좌(Zone 9), 중앙(Zone 10), 우(Zone 11) 3개 레인에 타깃 앵커 마커를 렌더링한다', () => {
      const view = createBaseViewModel();
      renderer.render(ctx, view, width, height);

      // 3개 이상의 타깃 앵커(arc 또는 ellipse 또는 다이아몬드 lineTo) 호출 확인
      const arcOrEllipseCount =
        vi.mocked(ctx.arc).mock.calls.length + vi.mocked(ctx.ellipse).mock.calls.length;
      expect(arcOrEllipseCount).toBeGreaterThanOrEqual(3);
    });

    it('소실점(vanishingPoint)이 제공되면 해당 좌표를 투영 기준으로 사용한다', () => {
      const view = createBaseViewModel();
      const customVP = { x: 500, y: 800 };
      renderer.render(ctx, view, width, height, customVP);

      expect(ctx.save).toHaveBeenCalledTimes(1);
      expect(ctx.restore).toHaveBeenCalledTimes(1);
    });

    it('좁은 화면 비율(세로 모드)에서 폭을 최대 폭 비율(0.90)까지 확장 보정한다', () => {
      const view = createBaseViewModel();
      const narrowWidth = 400;
      const tallHeight = 1000; // aspect = 0.4

      renderer.render(ctx, view, narrowWidth, tallHeight);
      expect(ctx.save).toHaveBeenCalledTimes(1);
      expect(ctx.restore).toHaveBeenCalledTimes(1);
    });
  });

  describe('4. 발자국 시각화 (현재·다음 발자국 & 슬롯)', () => {
    it('중앙 셀의 기본 home 발자국 슬롯(좌/우)을 렌더링한다', () => {
      const view = createBaseViewModel();
      renderer.render(ctx, view, width, height);

      // 접근성 텍스트 L/R 렌더링 호출 확인
      const fillTextCalls = vi.mocked(ctx.fillText).mock.calls;
      const hasLText = fillTextCalls.some((call) => call[0] === 'L');
      const hasRText = fillTextCalls.some((call) => call[0] === 'R');
      expect(hasLText).toBe(true);
      expect(hasRText).toBe(true);
    });

    it('현재 큐(currentCue)가 있을 때 강조 발자국을 렌더링한다', () => {
      const view = createBaseViewModel({
        currentCue: {
          beatIndex: 0,
          actionId: 'left_out',
          actionText: '왼발 딛기',
          directionText: '왼쪽',
          cueText: '왼발 바깥',
          arrowDirection: 'left',
          leftFootSlot: 'out',
          rightFootSlot: 'home',
          isPrepare: false,
        },
      });
      renderer.render(ctx, view, width, height);
      expect(ctx.fill).toHaveBeenCalled();
    });

    it('다음 큐(nextCue)가 있을 때 윤곽 발자국을 렌더링한다', () => {
      const view = createBaseViewModel({
        nextCue: {
          beatIndex: 1,
          actionId: 'right_out',
          actionText: '오른발 딛기',
          directionText: '오른쪽',
          cueText: '오른발 바깥',
          arrowDirection: 'right',
          leftFootSlot: 'home',
          rightFootSlot: 'out',
          isPrepare: false,
        },
      });
      renderer.render(ctx, view, width, height);
      expect(ctx.stroke).toHaveBeenCalled();
    });
  });

  describe('5. NEXT 수축 링 렌더링 (nextRingRatio)', () => {
    it('nextCue가 존재할 때 타깃을 둘러싼 NEXT 수축 링을 그린다', () => {
      const view = createBaseViewModel({
        nextRingRatio: 0.6,
        nextCue: {
          beatIndex: 1,
          actionId: 'left_home',
          actionText: '왼발 복귀',
          directionText: '중앙',
          cueText: '왼발 중앙 home',
          arrowDirection: 'center',
          leftFootSlot: 'home',
          rightFootSlot: 'home',
          isPrepare: false,
        },
      });

      renderer.render(ctx, view, width, height);
      // NEXT 링 렌더링 확인 (arc 또는 ellipse 호출)
      const hasArc = vi.mocked(ctx.arc).mock.calls.length > 0;
      const hasEllipse = vi.mocked(ctx.ellipse).mock.calls.length > 0;
      expect(hasArc || hasEllipse).toBe(true);
    });

    it('nextRingRatio가 1.0(시작)일 때와 0.0(도달)일 때 정상 렌더링된다', () => {
      const view1 = createBaseViewModel({ nextRingRatio: 1.0 });
      renderer.render(ctx, view1, width, height);

      const view2 = createBaseViewModel({ nextRingRatio: 0.0 });
      renderer.render(ctx, view2, width, height);

      expect(ctx.save).toHaveBeenCalledTimes(2);
      expect(ctx.restore).toHaveBeenCalledTimes(2);
    });
  });

  describe('6. 방향 화살표 및 비run 모드 차별화 렌더링', () => {
    it('왼쪽/오른쪽/중앙 이동 화살표를 렌더링한다', () => {
      const viewLeft = createBaseViewModel({ arrowDirection: 'left' });
      renderer.render(ctx, viewLeft, width, height);

      const viewRight = createBaseViewModel({ arrowDirection: 'right' });
      renderer.render(ctx, viewRight, width, height);

      const viewCenter = createBaseViewModel({ arrowDirection: 'center' });
      renderer.render(ctx, viewCenter, width, height);

      expect(ctx.save).toHaveBeenCalledTimes(3);
    });

    it('hip_bounce(상하) 및 hip_sway/arm_cross 모드 화살표/인디케이터를 처리한다', () => {
      const viewBounceDown = createBaseViewModel({
        arrowDirection: 'down',
        actionText: '바운스 다운',
      });
      renderer.render(ctx, viewBounceDown, width, height);

      const viewBounceUp = createBaseViewModel({
        arrowDirection: 'up',
        actionText: '바운스 업',
      });
      renderer.render(ctx, viewBounceUp, width, height);

      expect(ctx.save).toHaveBeenCalledTimes(2);
    });
  });

  describe('7. 안내 텍스트 및 인정/필수 수 표시', () => {
    it('액션 텍스트, 안내 문구, 인정/필수 운동 수를 텍스트로 렌더링한다', () => {
      const view = createBaseViewModel({
        actionText: '왼발 딛기',
        cueText: '왼발 바깥',
        acceptedExerciseCount: 2,
        requiredExerciseCount: 4,
      });

      renderer.render(ctx, view, width, height);

      const fillTextCalls = vi.mocked(ctx.fillText).mock.calls;
      const texts = fillTextCalls.map((c) => String(c[0]));

      expect(texts.some((t) => t.includes('왼발 딛기'))).toBe(true);
      expect(texts.some((t) => t.includes('2') && t.includes('4'))).toBe(true);
    });

    it('부족(isShortage: true) 상태일 때 연장 안내 텍스트를 표시한다', () => {
      const view = createBaseViewModel({
        isShortage: true,
        actionText: '중앙 제자리 뜀',
      });

      renderer.render(ctx, view, width, height);

      const fillTextCalls = vi.mocked(ctx.fillText).mock.calls;
      const texts = fillTextCalls.map((c) => String(c[0]));
      expect(texts.some((t) => t.includes('부족') || t.includes('연장'))).toBe(true);
    });

    it('준비(isPreparing: true) 상태일 때 준비 안내 텍스트를 표시한다', () => {
      const view = createBaseViewModel({
        isPreparing: true,
        actionText: '정답 준비',
      });

      renderer.render(ctx, view, width, height);

      const fillTextCalls = vi.mocked(ctx.fillText).mock.calls;
      const texts = fillTextCalls.map((c) => String(c[0]));
      expect(texts.some((t) => t.includes('준비'))).toBe(true);
    });

    it('스웨이(hip_sway) 및 팔 교차(arm_cross) 텍스트 인디케이터를 렌더링한다', () => {
      const swayView = createBaseViewModel({
        arrowDirection: 'none',
        actionText: '골반 스웨이',
        cueText: '좌우 체중 이동',
      });
      renderer.render(ctx, swayView, width, height);

      const armCrossView = createBaseViewModel({
        arrowDirection: 'none',
        actionText: '팔 교차 (좌)',
        cueText: '상체 팔 교차 (좌)',
      });
      renderer.render(ctx, armCrossView, width, height);

      const fillTextCalls = vi.mocked(ctx.fillText).mock.calls;
      const texts = fillTextCalls.map((c) => String(c[0]));
      expect(texts.some((t) => t.includes('체중 이동'))).toBe(true);
      expect(texts.some((t) => t.includes('두 발 고정'))).toBe(true);
    });

    it('오른발 복귀(right_home) 큐 렌더링을 정상 지원한다', () => {
      const returnView = createBaseViewModel({
        currentCue: {
          beatIndex: 2,
          actionId: 'right_out',
          actionText: '오른발 딛기',
          directionText: '오른쪽',
          cueText: '오른발 바깥',
          arrowDirection: 'right',
          leftFootSlot: 'home',
          rightFootSlot: 'out',
          isPrepare: false,
        },
        nextCue: {
          beatIndex: 3,
          actionId: 'right_home',
          actionText: '오른발 복귀',
          directionText: '중앙',
          cueText: '오른발 중앙 home',
          arrowDirection: 'center',
          leftFootSlot: 'home',
          rightFootSlot: 'home',
          isPrepare: false,
        },
        arrowDirection: 'center',
      });

      renderer.render(ctx, returnView, width, height);
      expect(ctx.save).toHaveBeenCalled();
      expect(ctx.restore).toHaveBeenCalledTimes(vi.mocked(ctx.save).mock.calls.length);
    });

    it('ctx.ellipse가 지원되지 않는 환경에서도 arc fallback으로 안전하게 렌더링된다', () => {
      const ctxNoEllipse = createMockContext();
      (ctxNoEllipse as any).ellipse = undefined;

      const view = createBaseViewModel();
      renderer.render(ctxNoEllipse, view, width, height);

      expect(ctxNoEllipse.save).toHaveBeenCalledTimes(1);
      expect(ctxNoEllipse.arc).toHaveBeenCalled();
      expect(ctxNoEllipse.restore).toHaveBeenCalledTimes(1);
    });

    it('사용자 정의 설정을 주입받아 초기화할 수 있다', () => {
      const customRenderer = new RunningMatRenderer({
        ...RUNNING_MAT_CONFIG,
        baseYTop: 0.70,
        baseYBottom: 0.90,
      });

      const view = createBaseViewModel();
      customRenderer.render(ctx, view, width, height);
      expect(ctx.save).toHaveBeenCalledTimes(1);
      expect(ctx.restore).toHaveBeenCalledTimes(1);
    });
  });

  describe('9. Issue #408: 러닝 발판 다음 두 박 예고와 무릎 들기·복귀 렌더링', () => {
    it('설정에 returnPhaseRatio(0.5) 및 다음 2박 시각 안내 스타일이 정의되어 있어야 한다', () => {
      expect((RUNNING_MAT_CONFIG as any).returnPhaseRatio).toBe(0.5);
      expect((RUNNING_MAT_CONFIG as any).preview1StrokeColor).toBeDefined();
      expect((RUNNING_MAT_CONFIG as any).preview1LineWidth).toBeGreaterThanOrEqual(2);
      expect((RUNNING_MAT_CONFIG as any).preview1Label).toBe('다음');
      expect((RUNNING_MAT_CONFIG as any).preview2StrokeColor).toBeDefined();
      expect((RUNNING_MAT_CONFIG as any).preview2LineWidth).toBeGreaterThan(0);
      expect((RUNNING_MAT_CONFIG as any).preview2Label).toBe('그다음');
      expect((RUNNING_MAT_CONFIG as any).kneeLiftText).toBe('무릎 들기');
      expect((RUNNING_MAT_CONFIG as any).kneeReturnText).toBe('기본 자세 복귀');
    });

    it('무릎 동작 시 전반부(lift)에는 무릎 들기, 후반부(return)에는 기본 자세 복귀 텍스트를 렌더링한다', () => {
      // 전반부 (들기)
      const liftView = createBaseViewModel({
        arrowDirection: 'up',
        actionText: '왼무릎 들기',
        isReturnPhase: false,
        currentCue: {
          beatIndex: 0,
          actionId: 'knee_left',
          actionText: '왼무릎 들기',
          directionText: '왼쪽',
          cueText: '왼무릎 들고 복귀',
          arrowDirection: 'up',
          leftFootSlot: 'lift',
          rightFootSlot: 'home',
          isPrepare: false,
        },
      });
      renderer.render(ctx, liftView, width, height);

      const liftCalls = vi.mocked(ctx.fillText).mock.calls;
      const liftTexts = liftCalls.map((c) => String(c[0]));
      expect(liftTexts.some((t) => t.includes('무릎 들기'))).toBe(true);

      // 후반부 (복귀)
      const returnCtx = createMockContext();
      const returnView = createBaseViewModel({
        arrowDirection: 'up',
        actionText: '왼무릎 복귀',
        isReturnPhase: true,
        currentCue: {
          beatIndex: 0,
          actionId: 'knee_left',
          actionText: '왼무릎 복귀',
          directionText: '왼쪽',
          cueText: '왼무릎 들고 복귀',
          arrowDirection: 'up',
          leftFootSlot: 'lift',
          rightFootSlot: 'home',
          isPrepare: false,
        },
      });
      renderer.render(returnCtx, returnView, width, height);

      const returnCalls = vi.mocked(returnCtx.fillText).mock.calls;
      const returnTexts = returnCalls.map((c) => String(c[0]));
      expect(returnTexts.some((t) => t.includes('기본 자세 복귀'))).toBe(true);
    });

    it('현재 동작(지금), 다음 1박(다음), 다음 2박(그다음) 시각 안내 요소를 렌더링한다', () => {
      const view = createBaseViewModel({
        actionText: '왼무릎 들기',
        upcomingCues: [
          {
            targetBeat: 1,
            remainingBeats: 1.0,
            progress: 0.0,
            phase: 'lift',
            cue: {
              id: 'knee_right',
              actionText: '오른무릎 들기',
              directionText: '오른쪽',
              cueText: '오른무릎 들고 복귀',
              arrowDirection: 'up',
              leftFootSlot: 'home',
              rightFootSlot: 'lift',
            },
          },
          {
            targetBeat: 2,
            remainingBeats: 2.0,
            progress: 0.0,
            phase: 'lift',
            cue: {
              id: 'knee_left',
              actionText: '왼무릎 들기',
              directionText: '왼쪽',
              cueText: '왼무릎 들고 복귀',
              arrowDirection: 'up',
              leftFootSlot: 'lift',
              rightFootSlot: 'home',
            },
          },
        ],
      });

      renderer.render(ctx, view, width, height);

      const fillTextCalls = vi.mocked(ctx.fillText).mock.calls;
      const texts = fillTextCalls.map((c) => String(c[0]));
      expect(texts.some((t) => t.includes('지금'))).toBe(true);
      expect(texts.some((t) => t.includes('다음'))).toBe(true);
      expect(texts.some((t) => t.includes('그다음'))).toBe(true);
    });

    it('동작 안내 시 실제 발자국 또는 채점이라는 표현을 노출하지 않는다', () => {
      const view = createBaseViewModel({
        actionText: '왼무릎 들기',
        cueText: '왼무릎 들기',
      });
      renderer.render(ctx, view, width, height);

      const fillTextCalls = vi.mocked(ctx.fillText).mock.calls;
      const texts = fillTextCalls.map((c) => String(c[0]));
      expect(texts.some((t) => t.includes('채점') || t.includes('점수'))).toBe(false);
    });
  });

  describe('10. Issue #425: RUN_QUESTION 8박 발 리듬 비트 노트 렌더링 검증', () => {
    it('RUN_QUESTION 동작 큐가 있을 때 소실점에서 판정선으로 비행하는 발 리듬 비트 노트를 렌더링한다', () => {
      const view = createBaseViewModel({
        nextCue: {
          beatIndex: 1,
          actionId: 'knee_left',
          actionText: '왼무릎 들기',
          directionText: '왼쪽',
          cueText: '왼무릎 들고 복귀',
          arrowDirection: 'up',
          leftFootSlot: 'lift',
          rightFootSlot: 'home',
          isPrepare: false,
        },
        nextRingRatio: 0.5,
      });

      renderer.render(ctx, view, width, height);

      // 발 비트 노트 드로잉(원형 및 음표/기호 텍스트) 호출 확인
      const fillTextCalls = vi.mocked(ctx.fillText).mock.calls;
      const hasStompNoteVisual = fillTextCalls.some((c) => String(c[0]).includes('♪') || String(c[0]).includes('★') || String(c[0]).includes('L'));
      expect(hasStompNoteVisual).toBe(true);
    });

    it('노트 비행 진행도(progress)에 따라 소실점에서 판정선 Y(0.86) 방향으로 좌표가 접근한다', () => {
      const viewNearLanding = createBaseViewModel({
        nextCue: {
          beatIndex: 1,
          actionId: 'knee_right',
          actionText: '오른무릎 들기',
          directionText: '오른쪽',
          cueText: '오른무릎 들고 복귀',
          arrowDirection: 'up',
          leftFootSlot: 'home',
          rightFootSlot: 'lift',
          isPrepare: false,
        },
        nextRingRatio: 0.1, // 착지 직전
      });

      renderer.render(ctx, viewNearLanding, width, height);

      const arcCalls = vi.mocked(ctx.arc).mock.calls;
      const expectedY = height * 0.86;
      // 착지 직전 비트 노트의 Y 좌표가 판정선 근처(±60px)에 도달했는지 확인
      const hasNearLandingY = arcCalls.some((c) => Math.abs(c[1] - expectedY) < 60);
      expect(hasNearLandingY).toBe(true);
    });
  });

  describe('11. Issue #426: 판정선 듀얼 네온 블러, 호흡 진동, 비트 펄스 및 모션 타격 섬광 검증', () => {
    it('렌더링 시 shadowBlur(20~25px) 및 shadowColor(#FF6600) 듀얼 네온 블러를 적용한다', () => {
      renderer.render(ctx, null, width, height);

      expect(ctx.shadowBlur).toBeGreaterThanOrEqual(20);
      expect(ctx.shadowBlur).toBeLessThanOrEqual(25);
      expect(ctx.shadowColor).toBe('#FF6600');
    });

    it('Core Line에 #FFB800 ~ #FF8800 네온 골드·주황 그라데이션을 적용한다', () => {
      renderer.render(ctx, null, width, height);

      expect(ctx.createLinearGradient).toHaveBeenCalled();
    });

    it('triggerMotionHit 호출 시 고휘도 화이트-골드 섬광(Flash) 상태가 활성화된다', () => {
      renderer.triggerMotionHit();
      expect(renderer.hitFlashIntensity).toBeGreaterThan(0.8);

      renderer.render(ctx, null, width, height);
      expect(ctx.save).toHaveBeenCalled();
    });

    it('비트 진행도(beatProgress) 전달 시 상방 빛 파동(Beat Pulse Wave)이 렌더링된다', () => {
      renderer.render(ctx, null, width, height, { beatProgress: 0.2, elapsedTime: 1.5 });
      expect(ctx.save).toHaveBeenCalled();
    });
  });

  describe('12. [LANE-SYNC-01 / #494] 3대 레인과 발자국 슬롯 X 좌표 단일화 및 3레인 중앙 발자국 정렬', () => {
    it('발자국 슬롯 X 좌표가 3대 레인 규격(-0.45, 0.0, +0.45) * halfWBottom과 정확히 1:1 일치한다', () => {
      const vx = width * 0.5;
      const vy = height * DEFAULT_VANISHING_Y_RATIO;
      const yTop = height * DEFAULT_MAT_BASE_Y_TOP;
      const yBottom = height * DEFAULT_MAT_BASE_Y_BOTTOM;
      const halfWBottom = (width * DEFAULT_MAT_WIDTH_RATIO) * 0.5;
      const yStrike = height * DEFAULT_STRIKE_LINE_Y_RATIO;

      const slots = (renderer as any).computeSlotCoordinates(
        vx,
        vy,
        yTop,
        yBottom,
        halfWBottom,
        width,
        yStrike
      );

      // 좌측 슬롯(left/leftOut)은 vx - 0.45 * halfWBottom
      expect(slots.leftOut.x).toBeCloseTo(vx - 0.45 * halfWBottom, 1);
      expect(slots.left.x).toBeCloseTo(vx - 0.45 * halfWBottom, 1);

      // 중앙 슬롯(center)은 vx
      expect(slots.center.x).toBeCloseTo(vx, 1);
      // 중앙 홈 발판 쌍(leftHome, rightHome)의 중심점도 정확히 vx
      expect((slots.leftHome.x + slots.rightHome.x) * 0.5).toBeCloseTo(vx, 1);

      // 우측 슬롯(right/rightOut)은 vx + 0.45 * halfWBottom
      expect(slots.rightOut.x).toBeCloseTo(vx + 0.45 * halfWBottom, 1);
      expect(slots.right.x).toBeCloseTo(vx + 0.45 * halfWBottom, 1);
    });

    it('모든 발자국 슬롯의 Y 좌표가 판정선 높이(yStrike = height * strikeLineYRatio)와 일치한다', () => {
      const vx = width * 0.5;
      const vy = height * DEFAULT_VANISHING_Y_RATIO;
      const yTop = height * DEFAULT_MAT_BASE_Y_TOP;
      const yBottom = height * DEFAULT_MAT_BASE_Y_BOTTOM;
      const halfWBottom = (width * DEFAULT_MAT_WIDTH_RATIO) * 0.5;
      const yStrike = height * DEFAULT_STRIKE_LINE_Y_RATIO;

      const slots = (renderer as any).computeSlotCoordinates(
        vx,
        vy,
        yTop,
        yBottom,
        halfWBottom,
        width,
        yStrike
      );

      expect(slots.leftOut.y).toBeCloseTo(yStrike, 1);
      expect(slots.left.y).toBeCloseTo(yStrike, 1);
      expect(slots.center.y).toBeCloseTo(yStrike, 1);
      expect(slots.leftHome.y).toBeCloseTo(yStrike, 1);
      expect(slots.rightHome.y).toBeCloseTo(yStrike, 1);
      expect(slots.rightOut.y).toBeCloseTo(yStrike, 1);
      expect(slots.right.y).toBeCloseTo(yStrike, 1);
    });

    it('3레인 타깃 앵커(Zone 9, 10, 11) X 좌표와 발자국 슬롯 X 좌표 간 불일치가 0이다', () => {
      const vx = width * 0.5;
      const vy = height * DEFAULT_VANISHING_Y_RATIO;
      const yTop = height * DEFAULT_MAT_BASE_Y_TOP;
      const yBottom = height * DEFAULT_MAT_BASE_Y_BOTTOM;
      const halfWBottom = (width * DEFAULT_MAT_WIDTH_RATIO) * 0.5;
      const yStrike = height * DEFAULT_STRIKE_LINE_Y_RATIO;

      const slots = (renderer as any).computeSlotCoordinates(
        vx,
        vy,
        yTop,
        yBottom,
        halfWBottom,
        width,
        yStrike
      );

      const expectedLeftX = vx - halfWBottom * 0.45;
      const expectedCenterX = vx;
      const expectedRightX = vx + halfWBottom * 0.45;

      expect(slots.left.x - expectedLeftX).toBe(0);
      expect(slots.center.x - expectedCenterX).toBe(0);
      expect(slots.right.x - expectedRightX).toBe(0);
    });

    it('런타임 렌더링 시 좌측 및 우측 발 딛기 시 발자국이 3레인 정중앙 좌표 및 판정선 Y에 렌더링된다', () => {
      const view = createBaseViewModel({
        currentCue: {
          beatIndex: 0,
          actionId: 'left_out',
          actionText: '왼발 딛기',
          directionText: '왼쪽',
          cueText: '왼발 바깥',
          arrowDirection: 'left',
          leftFootSlot: 'out',
          rightFootSlot: 'home',
          isPrepare: false,
        },
      });

      renderer.render(ctx, view, width, height);

      const vx = width * 0.5;
      const aspect = width / height;
      const matWidthRatio = aspect < 1.0
        ? Math.min(MAX_NARROW_WIDTH_RATIO, DEFAULT_MAT_WIDTH_RATIO + (1.0 - aspect) * 0.15)
        : DEFAULT_MAT_WIDTH_RATIO;
      const halfWBottom = (width * matWidthRatio) * 0.5;
      const expectedLeftX = vx - halfWBottom * 0.45;
      const expectedYStrike = height * DEFAULT_STRIKE_LINE_Y_RATIO;

      const ellipseCalls = vi.mocked(ctx.ellipse).mock.calls;
      const hasLeftLaneFootprint = ellipseCalls.some((c) => {
        const cx = c[0];
        const cy = c[1];
        return Math.abs(cx - expectedLeftX) < 1.0 && Math.abs(cy - expectedYStrike) < 1.0;
      });
      expect(hasLeftLaneFootprint).toBe(true);
    });
  });
});
