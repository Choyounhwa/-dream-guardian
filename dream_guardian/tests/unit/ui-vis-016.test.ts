import { describe, expect, it, vi } from 'vitest';
import {
  BeatHUDRenderer,
  BEAT_HUD_SLOT_IDS,
  PROTECTED_BEAT_HUD_SLOT_IDS,
  DEFAULT_BEAT_HUD_FIXTURE,
  HAZARD_BEAT_HUD_FIXTURE,
  type BeatHUDBounds,
  type BeatHUDPresentationContext,
  type BeatHUDFixtureDTO,
} from '../../src/render/BeatHUDRenderer.js';
import {
  RunningMatRenderer,
  RUNNING_MAT_SLOT_IDS,
  PROTECTED_RUNNING_MAT_SLOT_IDS,
  DEFAULT_RUNNING_MAT_FIXTURE,
  KNEE_LIFT_MAT_FIXTURE,
  SIDE_STEP_LEFT_MAT_FIXTURE,
  type RunningMatBounds,
  type RunningMatPresentationContext,
  type RunningMatFixtureDTO,
} from '../../src/render/RunningMatRenderer.js';
import { createDefaultUIPresentationDocument } from '../../src/data/UIPresentation.js';
import type { RunningMatViewModel } from '../../src/render/RunningMatPresenter.js';

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
    fillRect: vi.fn((...args: unknown[]) => calls.push({ method: 'fillRect', args })),
    strokeRect: vi.fn((...args: unknown[]) => calls.push({ method: 'strokeRect', args })),
    clearRect: vi.fn((...args: unknown[]) => calls.push({ method: 'clearRect', args })),
    fillText: vi.fn((...args: unknown[]) => calls.push({ method: 'fillText', args })),
    strokeText: vi.fn((...args: unknown[]) => calls.push({ method: 'strokeText', args })),
    measureText: vi.fn((text: string) => ({ width: text.length * 16 })),
    createLinearGradient: vi.fn(() => ({
      addColorStop: vi.fn(),
    })),
    createRadialGradient: vi.fn(() => ({
      addColorStop: vi.fn(),
    })),
    setLineDash: vi.fn((...args: unknown[]) => calls.push({ method: 'setLineDash', args })),
    translate: vi.fn((...args: unknown[]) => calls.push({ method: 'translate', args })),
    scale: vi.fn((...args: unknown[]) => calls.push({ method: 'scale', args })),
    rotate: vi.fn((...args: unknown[]) => calls.push({ method: 'rotate', args })),
    drawImage: vi.fn(() => {}),
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

describe('[UI-VIS-016 / Issue #446] 러닝 HUD·매트 표시 경계', () => {
  describe('1. BeatHUDRenderer 선택적 표시 컨텍스트 및 bounds 조회', () => {
    it('기본 상태에서 운동 안내 및 비트 도트, 스텝 카운터 bounds를 정상 계산한다', () => {
      const renderer = new BeatHUDRenderer({ showBeatDots: true });
      expect(renderer.getPresentationContext()).toBeUndefined();

      const badgeBounds: BeatHUDBounds = renderer.getExerciseBadgeBounds(W, H);
      expect(badgeBounds.x).toBeGreaterThan(0);
      expect(badgeBounds.w).toBeGreaterThan(0);
      expect(badgeBounds.h).toBeGreaterThan(0);
      expect(badgeBounds.y).toBeCloseTo(H * 0.52 - 80, -1);

      const dotsBounds: BeatHUDBounds = renderer.getBeatDotsBounds(W, H);
      expect(dotsBounds.w).toBeGreaterThan(0);
      expect(dotsBounds.h).toBeGreaterThan(0);
      expect(dotsBounds.y).toBeGreaterThan(badgeBounds.y);

      const stepBounds: BeatHUDBounds = renderer.getStepCounterBounds(W, H);
      expect(stepBounds.w).toBeGreaterThan(0);
      expect(stepBounds.h).toBeGreaterThan(0);
      expect(stepBounds.y).toBeGreaterThan(dotsBounds.y);
    });

    it('setPresentationContext, getPresentationContext, clearPresentationContext 라이프사이클이 정확히 동작한다', () => {
      const renderer = new BeatHUDRenderer();
      const customContext: BeatHUDPresentationContext = {
        exerciseBadge: {
          title: '제자리 달리기 가속!',
          subtitle: '발을 더 높이 드세요',
          color: '#00FFFF',
        },
      };

      renderer.setPresentationContext(customContext);
      expect(renderer.getPresentationContext()).toEqual(customContext);

      renderer.clearPresentationContext();
      expect(renderer.getPresentationContext()).toBeUndefined();
    });

    it('슬롯 목록 상수 및 Fixture DTO 기본값이 올바르게 정의되어 있다', () => {
      expect(BEAT_HUD_SLOT_IDS).toContain('exerciseBadge');
      expect(BEAT_HUD_SLOT_IDS).toContain('beatDots');
      expect(PROTECTED_BEAT_HUD_SLOT_IDS).toContain('hazard_zone_protection');
      const fixtureDTO: BeatHUDFixtureDTO = { ...DEFAULT_BEAT_HUD_FIXTURE };
      expect(fixtureDTO.totalSteps).toBe(12);
    });

    it('fromPresentationDocument를 통해 running_question 페이지 요소를 BeatHUDPresentationContext로 매핑한다', () => {
      const doc = createDefaultUIPresentationDocument();
      const context = BeatHUDRenderer.fromPresentationDocument(doc);

      expect(context.presentationDocument).toBe(doc);
      expect(context.pageId).toBe('running_question');
      expect(context.exerciseBadge).toBeDefined();
    });
  });

  describe('2. RunningMatRenderer 선택적 표시 컨텍스트 및 bounds 조회', () => {
    it('기본 상태에서 러닝 매트 전체, 판정선, 3대 레인(Zone 9, 10, 11) 타깃 앵커 bounds를 계산한다', () => {
      const renderer = new RunningMatRenderer();
      expect(renderer.getPresentationContext()).toBeUndefined();

      const matBounds: RunningMatBounds = renderer.getRunningMatBounds(W, H);
      expect(matBounds.x).toBeGreaterThanOrEqual(0);
      expect(matBounds.y).toBeCloseTo(H * 0.74, 1);
      expect(matBounds.h).toBeCloseTo(H * (0.94 - 0.74), 1);
      expect(matBounds.w).toBeGreaterThan(W * 0.5);
      expect(matBounds.isProtected).toBe(true);

      const strikeBounds: RunningMatBounds = renderer.getStrikeLineBounds(W, H);
      expect(strikeBounds.y).toBeCloseTo(H * 0.86 - strikeBounds.h / 2, -1);
      expect(strikeBounds.w).toBeGreaterThan(matBounds.w);
      expect(strikeBounds.isProtected).toBe(true);

      const leftAnchor: RunningMatBounds = renderer.getLaneAnchorBounds('left', W, H);
      const centerAnchor: RunningMatBounds = renderer.getLaneAnchorBounds('center', W, H);
      const rightAnchor: RunningMatBounds = renderer.getLaneAnchorBounds('right', W, H);

      expect(leftAnchor.x).toBeLessThan(centerAnchor.x);
      expect(centerAnchor.x).toBeCloseTo(W / 2, 1);
      expect(rightAnchor.x).toBeGreaterThan(centerAnchor.x);
      expect(leftAnchor.isProtected).toBe(true);
      expect(centerAnchor.isProtected).toBe(true);
      expect(rightAnchor.isProtected).toBe(true);

      // Zone 번호(9, 10, 11)로도 동일한 앵커 bounds 반환 확인
      const z9Anchor = renderer.getLaneAnchorBounds(9, W, H);
      const z10Anchor = renderer.getLaneAnchorBounds(10, W, H);
      const z11Anchor = renderer.getLaneAnchorBounds(11, W, H);
      expect(z9Anchor.x).toBe(leftAnchor.x);
      expect(z10Anchor.x).toBe(centerAnchor.x);
      expect(z11Anchor.x).toBe(rightAnchor.x);
    });

    it('setPresentationContext, getPresentationContext, clearPresentationContext 라이프사이클이 정확히 동작한다', () => {
      const renderer = new RunningMatRenderer();
      const customContext: RunningMatPresentationContext = {
        matVisual: {
          borderColor: '#00E5FF',
          borderWidth: 3,
        },
        statusHeader: {
          text: '가속 인터벌 러닝',
        },
      };

      renderer.setPresentationContext(customContext);
      expect(renderer.getPresentationContext()).toEqual(customContext);

      renderer.clearPresentationContext();
      expect(renderer.getPresentationContext()).toBeUndefined();
    });

    it('fromPresentationDocument를 통해 running_question 페이지 및 floor_strike_line_run 요소를 매핑한다', () => {
      expect(RUNNING_MAT_SLOT_IDS).toContain('matVisual');
      expect(PROTECTED_RUNNING_MAT_SLOT_IDS).toContain('strike_line_geometry');
      const matDTO: RunningMatFixtureDTO = { ...DEFAULT_RUNNING_MAT_FIXTURE };
      expect(matDTO.actionText).toBe('제자리 달리기');

      const doc = createDefaultUIPresentationDocument();
      const context = RunningMatRenderer.fromPresentationDocument(doc);

      expect(context.presentationDocument).toBe(doc);
      expect(context.pageId).toBe('running_question');
      expect(context.strikeLine).toBeDefined();
    });
  });

  describe('3. 보호된 발판/판정선 좌표 및 리듬 수치 무결성 보호 (Protected Rhythm/Mat Guard)', () => {
    it('RunningMatRenderer: 외부 컨텍스트에서 판정선이나 발판의 물리적 좌표를 변조하려 해도 안전 기본 기하로 고정된다', () => {
      const intruderCtx: RunningMatPresentationContext = {
        strikeLine: {
          x: 10,
          y: 50,
          w: 100,
          h: 20,
        },
        footprintSlots: {
          x: 50,
          y: 50,
        },
        targetAnchors: {
          x: 100,
          y: 100,
        },
        vanishingPoint: {
          x: 0,
          y: 0,
        },
      };

      const renderer = new RunningMatRenderer();
      renderer.setPresentationContext(intruderCtx);

      // 변조 시도 좌표 (y: 50)가 거부되고 원래의 안전 판정선 Y를 유지
      const strikeBounds = renderer.getStrikeLineBounds(W, H);
      expect(strikeBounds.y).not.toBe(50);
      expect(strikeBounds.y).toBeCloseTo(H * 0.86 - strikeBounds.h / 2, -1);

      // 발판 앵커 좌표도 외부 100으로 왜곡되지 않고 물리 기하 유지
      const centerAnchor = renderer.getLaneAnchorBounds('center', W, H);
      expect(centerAnchor.x).toBeCloseTo(W / 2, 1);
      expect(centerAnchor.x).not.toBe(100);
    });

    it('RunningMatRenderer: isSlotLocked 및 getSlotLockReason이 보호 영역에 대해 명확한 잠금 사유를 반환한다', () => {
      const renderer = new RunningMatRenderer();

      expect(renderer.isSlotLocked('strike_line_geometry')).toBe(true);
      expect(renderer.isSlotLocked('zone_9_mat_cell')).toBe(true);
      expect(renderer.isSlotLocked('target_anchors')).toBe(true);
      expect(renderer.isSlotLocked('matVisual')).toBe(false);

      const reason = renderer.getSlotLockReason('strike_line_geometry');
      expect(reason).toContain('판정선');
      expect(renderer.getSlotLockReason('matVisual')).toBeNull();
    });

    it('RunningMatRenderer: validatePresentationContext가 물리 좌표 왜곡 시도를 감지하여 경고 이슈를 보고한다', () => {
      const renderer = new RunningMatRenderer();
      const illegalContext: RunningMatPresentationContext = {
        strikeLine: {
          y: 200,
        },
        targetAnchors: {
          x: 50,
        },
      };

      const result = renderer.validatePresentationContext(illegalContext);
      expect(result.valid).toBe(false);
      expect(result.issues.length).toBeGreaterThan(0);
      expect(result.issues.some((msg) => msg.includes('판정선') || msg.includes('strike'))).toBe(true);
    });

    it('BeatHUDRenderer: 8박 진행도, 스텝 수치, 판정 결과는 순수 읽기 전용 draw data(BeatHUDState)로만 소비된다', () => {
      const renderer = new BeatHUDRenderer({ showBeatDots: true });
      const ctx = createMockCtx();

      // 외부 컨텍스트에 엉뚱한 수치를 주입하더라도
      renderer.setPresentationContext({
        stepCounter: {
          text: '해킹된 9999회',
        },
      });

      // 실제 state가 전달하는 totalSteps (15)가 우선하여 정확히 반영되어야 함
      renderer.render(ctx, W, H, {
        totalSteps: 15,
        completedExerciseBeats: 4,
        locomotionMode: 'run',
      });

      const fillTextCalls = ctx.calls.filter((c) => c.method === 'fillText');
      expect(fillTextCalls.some((c) => String(c.args[0]).includes('15'))).toBe(true);
      expect(fillTextCalls.some((c) => String(c.args[0]).includes('9999'))).toBe(false);
    });
  });

  describe('4. 결정론적 Fixture DTO 렌더 진입점 (renderFixture)', () => {
    it('BeatHUDRenderer: 타이머나 오디오 스케줄러 없이 순수 Fixture DTO만으로 8박 HUD 화면을 렌더링한다', () => {
      const renderer = new BeatHUDRenderer();
      const ctx = createMockCtx();

      renderer.renderFixture(ctx, W, H, DEFAULT_BEAT_HUD_FIXTURE);

      const fillTextCalls = ctx.calls.filter((c) => c.method === 'fillText');
      expect(fillTextCalls.length).toBeGreaterThan(0);
      expect(fillTextCalls.some((c) => String(c.args[0]).includes('달리기'))).toBe(true);
    });

    it('BeatHUDRenderer: 정적 메서드 renderFixture가 독립 렌더링을 지원한다', () => {
      const ctx = createMockCtx();
      BeatHUDRenderer.renderFixture(ctx, W, H, HAZARD_BEAT_HUD_FIXTURE);

      const fillTextCalls = ctx.calls.filter((c) => c.method === 'fillText');
      expect(fillTextCalls.some((c) => String(c.args[0]).includes('피하기'))).toBe(true);
    });

    it('RunningMatRenderer: 순수 Fixture DTO로 8박 시점의 러닝 매트 화면을 정밀 렌더링한다', () => {
      const renderer = new RunningMatRenderer();
      const ctx = createMockCtx();

      renderer.renderFixture(ctx, W, H, DEFAULT_RUNNING_MAT_FIXTURE);

      expect(ctx.calls.some((c) => c.method === 'beginPath')).toBe(true);
      expect(ctx.calls.some((c) => c.method === 'lineTo')).toBe(true);

      const fillTextCalls = ctx.calls.filter((c) => c.method === 'fillText');
      expect(fillTextCalls.length).toBeGreaterThan(0);
    });

    it('RunningMatRenderer: 무릎 들기 및 사이드 스텝 DTO가 각각 올바른 동작 텍스트를 렌더링한다', () => {
      const renderer = new RunningMatRenderer();
      const ctxKnee = createMockCtx();
      const ctxSide = createMockCtx();

      renderer.renderFixture(ctxKnee, W, H, KNEE_LIFT_MAT_FIXTURE);
      const kneeTexts = ctxKnee.calls.filter((c) => c.method === 'fillText');
      expect(kneeTexts.some((c) => String(c.args[0]).includes('무릎'))).toBe(true);

      renderer.renderFixture(ctxSide, W, H, SIDE_STEP_LEFT_MAT_FIXTURE);
      const sideTexts = ctxSide.calls.filter((c) => c.method === 'fillText');
      expect(sideTexts.some((c) => String(c.args[0]).includes('왼발') || String(c.args[0]).includes('사이드'))).toBe(true);
    });

    it('RunningMatRenderer: 정적 메서드 renderFixture가 부작용 없이 인스턴스를 즉석 생성하여 렌더링한다', () => {
      const ctx = createMockCtx();
      RunningMatRenderer.renderFixture(ctx, W, H, DEFAULT_RUNNING_MAT_FIXTURE);

      expect(ctx.calls.some((c) => c.method === 'save')).toBe(true);
      expect(ctx.calls.some((c) => c.method === 'restore')).toBe(true);
    });
  });

  describe('5. 안전한 시각 스타일 소비 및 기존 렌더러 호환성', () => {
    it('BeatHUDRenderer: context의 안내 문구 및 커스텀 색상이 렌더링에 안전하게 반영된다', () => {
      const renderer = new BeatHUDRenderer();
      const ctx = createMockCtx();

      renderer.setPresentationContext({
        exerciseBadge: {
          title: '스피드 버스트!',
          subtitle: '빠르게 제자리 달리기',
          color: '#39FF14',
        },
      });

      renderer.render(ctx, W, H, {
        locomotionMode: 'run',
      });

      const fillTextCalls = ctx.calls.filter((c) => c.method === 'fillText');
      expect(fillTextCalls.some((c) => c.args[0] === '스피드 버스트!')).toBe(true);
      expect(fillTextCalls.some((c) => c.args[0] === '빠르게 제자리 달리기')).toBe(true);
      expect(ctx.fillStyles).toContain('#39FF14');
    });

    it('RunningMatRenderer: context의 매트 테두리 색상 및 헤더 텍스트가 시각 스타일에 안전하게 반영된다', () => {
      const renderer = new RunningMatRenderer();
      const ctx = createMockCtx();

      renderer.setPresentationContext({
        matVisual: {
          borderColor: '#FF00AA',
        },
        statusHeader: {
          text: '커스텀 매트 타이틀',
        },
      });

      const sampleView: RunningMatViewModel = {
        visible: true,
        paused: false,
        currentCue: null,
        nextCue: null,
        upcomingCues: [],
        actionText: '운동 동작',
        directionText: '앞으로',
        cueText: '',
        arrowDirection: 'up',
        isReturnPhase: false,
        nextRingRatio: 0.5,
        elapsedBeats: 1,
        acceptedExerciseCount: 0,
        requiredExerciseCount: 8,
        isShortage: false,
        isPreparing: false,
      };

      renderer.render(ctx, sampleView, W, H);

      expect(ctx.strokeStyles).toContain('#FF00AA');
      const fillTextCalls = ctx.calls.filter((c) => c.method === 'fillText');
      expect(fillTextCalls.some((c) => c.args[0] === '커스텀 매트 타이틀')).toBe(true);
    });
  });
});
