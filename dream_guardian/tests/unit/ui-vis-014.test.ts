import { describe, expect, it, vi } from 'vitest';
import {
  ReadyPositionRenderer,
  DEFAULT_READY_POSITION_FIXTURE_STATE,
  READY_POSITION_SLOT_IDS,
  PROTECTED_READY_SLOT_IDS,
  type ReadyPositionBounds,
  type ReadyPositionPresentationContext,
  type ReadyPositionFixtureDTO,
} from '../../src/render/ReadyPositionRenderer.js';
import { ReadyPositionController } from '../../src/game/ReadyPositionController.js';
import { createDefaultUIPresentationDocument } from '../../src/data/UIPresentation.js';

function createMockCtx(): CanvasRenderingContext2D & { calls: any[]; strokeStyles: string[]; fillStyles: string[] } {
  const calls: { method: string; args: unknown[] }[] = [];
  const strokeStyles: string[] = [];
  const fillStyles: string[] = [];
  let _strokeStyle = '';
  let _fillStyle = '';

  const mock = {
    calls,
    strokeStyles,
    fillStyles,
    save: vi.fn(() => calls.push({ method: 'save', args: [] })),
    restore: vi.fn(() => calls.push({ method: 'restore', args: [] })),
    beginPath: vi.fn(() => calls.push({ method: 'beginPath', args: [] })),
    closePath: vi.fn(() => calls.push({ method: 'closePath', args: [] })),
    moveTo: vi.fn((x: number, y: number) => calls.push({ method: 'moveTo', args: [x, y] })),
    lineTo: vi.fn((x: number, y: number) => calls.push({ method: 'lineTo', args: [x, y] })),
    arc: vi.fn((...args: unknown[]) => calls.push({ method: 'arc', args })),
    rect: vi.fn((x: number, y: number, w: number, h: number) =>
      calls.push({ method: 'rect', args: [x, y, w, h] })
    ),
    roundRect: vi.fn((x: number, y: number, w: number, h: number, r?: unknown) =>
      calls.push({ method: 'roundRect', args: [x, y, w, h, r] })
    ),
    fill: vi.fn(() => calls.push({ method: 'fill', args: [] })),
    stroke: vi.fn(() => calls.push({ method: 'stroke', args: [] })),
    fillRect: vi.fn((x: number, y: number, w: number, h: number) =>
      calls.push({ method: 'fillRect', args: [x, y, w, h] })
    ),
    strokeRect: vi.fn((x: number, y: number, w: number, h: number) =>
      calls.push({ method: 'strokeRect', args: [x, y, w, h] })
    ),
    fillText: vi.fn((text: string, x: number, y: number) =>
      calls.push({ method: 'fillText', args: [text, x, y] })
    ),
    measureText: vi.fn((text: string) => ({ width: text.length * 10 })),
    setLineDash: vi.fn((pattern: number[]) => calls.push({ method: 'setLineDash', args: [pattern] })),
    clearRect: vi.fn(),
    createLinearGradient: vi.fn(() => ({
      addColorStop: vi.fn(),
    })),
    createRadialGradient: vi.fn(() => ({
      addColorStop: vi.fn(),
    })),
    globalAlpha: 1,
    lineWidth: 1,
    get strokeStyle() {
      return _strokeStyle;
    },
    set strokeStyle(val: string) {
      _strokeStyle = val;
      strokeStyles.push(val);
    },
    get fillStyle() {
      return _fillStyle;
    },
    set fillStyle(val: string) {
      _fillStyle = val;
      fillStyles.push(val);
    },
    font: '',
    textAlign: 'left' as CanvasTextAlign,
    textBaseline: 'alphabetic' as CanvasTextBaseline,
    shadowColor: '',
    shadowBlur: 0,
  };
  return mock as unknown as CanvasRenderingContext2D & { calls: any[]; strokeStyles: string[]; fillStyles: string[] };
}

const W = 1080;
const H = 2160;

describe('[UI-VIS-014 / Issue #444] 플레이 준비 화면 안전 표시 경계', () => {
  describe('1. 선택적 표시 컨텍스트(ReadyPositionPresentationContext) 및 bounds 조회', () => {
    it('컨텍스트 미주입 시 기본 화면 비율에 따른 정확한 bounds를 반환한다', () => {
      const renderer = new ReadyPositionRenderer();
      expect(renderer.getPresentationContext()).toBeUndefined();

      const alignBounds: ReadyPositionBounds = renderer.getAlignmentFrameBounds(W, H);
      expect(alignBounds.w).toBeCloseTo(W * 0.54, 1);
      expect(alignBounds.h).toBeCloseTo(H * 0.62, 1);
      expect(alignBounds.x).toBeCloseTo((W - alignBounds.w) / 2, 1);
      expect(alignBounds.y).toBeCloseTo(H * 0.18, 1);
      expect(alignBounds.width).toBe(alignBounds.w);
      expect(alignBounds.height).toBe(alignBounds.h);

      const headerBounds = renderer.getHeaderMessageBounds(W, H);
      expect(headerBounds.w).toBeGreaterThan(0);
      expect(headerBounds.h).toBeGreaterThan(0);
      expect(headerBounds.y).toBeLessThan(alignBounds.y);

      const countdownBounds = renderer.getCountdownBounds(W, H);
      expect(countdownBounds.w).toBeGreaterThan(0);
      expect(countdownBounds.h).toBeGreaterThan(0);
      // 카운트다운은 화면 중앙 부근
      expect(countdownBounds.y + countdownBounds.h / 2).toBeCloseTo(H * 0.46, 1);

      const skipBounds = renderer.getSkipNoticeBounds(W, H);
      expect(skipBounds.w).toBeGreaterThan(0);
      expect(skipBounds.h).toBeGreaterThan(0);
      expect(skipBounds.y).toBeGreaterThan(countdownBounds.y);
    });

    it('setPresentationContext, getPresentationContext, clearPresentationContext 라이프사이클이 정확하다', () => {
      const renderer = new ReadyPositionRenderer();
      const customCtx: ReadyPositionPresentationContext = {
        headerMessage: { text: '화면을 보고 준비해주세요' },
        skipNotice: { text: '스킵하려면 터치하세요' },
      };

      renderer.setPresentationContext(customCtx);
      expect(renderer.getPresentationContext()).toEqual(customCtx);

      renderer.clearPresentationContext();
      expect(renderer.getPresentationContext()).toBeUndefined();
    });

    it('생성자에서 presentationContext 주입을 지원한다', () => {
      const customCtx: ReadyPositionPresentationContext = {
        headerMessage: { text: '생성자 주입 테스트' },
      };
      const renderer = new ReadyPositionRenderer(customCtx);
      expect(renderer.getPresentationContext()?.headerMessage?.text).toBe('생성자 주입 테스트');
    });

    it('ReadyPositionRenderer.fromPresentationDocument로 UIPresentationDocument의 play_ready 페이지 요소를 바르게 추출한다', () => {
      const doc = createDefaultUIPresentationDocument();
      const extracted = ReadyPositionRenderer.fromPresentationDocument(doc, 'play_ready');

      expect(extracted).toBeDefined();
      expect(extracted.presentationDocument).toBe(doc);
      expect(extracted.pageId).toBe('play_ready');
      expect(extracted.headerMessage).toBeDefined();
      expect(extracted.headerMessage?.text).toBe('화면 중앙 실루엣에 맞춰 서주세요');
      expect(extracted.headerMessage?.x).toBe(140);
      expect(extracted.headerMessage?.y).toBe(180);
      expect(extracted.headerMessage?.w).toBe(800);
      expect(extracted.headerMessage?.h).toBe(100);
    });

    it('headerMessage와 skipNotice의 문구 및 bounds 오버라이드가 정상 반영된다', () => {
      const customCtx: ReadyPositionPresentationContext = {
        headerMessage: {
          x: 100,
          y: 120,
          w: 880,
          h: 90,
          text: '커스텀 안내 메시지',
          fontSize: 32,
        },
        skipNotice: {
          x: 120,
          y: 1950,
          w: 840,
          h: 70,
          text: '커스텀 스킵 안내',
          fontSize: 22,
        },
      };

      const renderer = new ReadyPositionRenderer(customCtx);
      const headerBounds = renderer.getHeaderMessageBounds(W, H);
      expect(headerBounds.x).toBe(100);
      expect(headerBounds.y).toBe(120);
      expect(headerBounds.w).toBe(880);
      expect(headerBounds.h).toBe(90);

      const skipBounds = renderer.getSkipNoticeBounds(W, H);
      expect(skipBounds.x).toBe(120);
      expect(skipBounds.y).toBe(1950);
      expect(skipBounds.w).toBe(840);
      expect(skipBounds.h).toBe(70);

      const ctx = createMockCtx();
      renderer.render(ctx, W, H, {
        currentCount: 3,
        countText: '3',
        isAligned: false,
      });

      const fillTextCalls = (ctx as any).calls.filter((c: any) => c.method === 'fillText');
      expect(fillTextCalls.some((c: any) => c.args[0] === '커스텀 안내 메시지')).toBe(true);
      expect(fillTextCalls.some((c: any) => c.args[0] === '커스텀 스킵 안내')).toBe(true);
    });
  });

  describe('2. 신체 정렬 안전 영역 보호 (Protected Motion Zone Guard)', () => {
    it('신체 정렬 실루엣/프레임의 geometry 변조 시도가 거부되고 항상 안전 영역 바운딩 박스를 유지한다', () => {
      const intruderCtx: ReadyPositionPresentationContext = {
        alignmentFrame: {
          x: 50,
          y: 50,
          w: 200,
          h: 300,
        },
      };

      const renderer = new ReadyPositionRenderer(intruderCtx);
      const safeBounds = renderer.getAlignmentFrameBounds(W, H);

      // 변조 시도 좌표 (50, 50, 200, 300)가 거부되고 안전 영역 기본 비율 유지
      expect(safeBounds.x).not.toBe(50);
      expect(safeBounds.y).not.toBe(50);
      expect(safeBounds.w).not.toBe(200);
      expect(safeBounds.h).not.toBe(300);
      expect(safeBounds.w).toBeCloseTo(W * 0.54, 1);
      expect(safeBounds.h).toBeCloseTo(H * 0.62, 1);
      expect(safeBounds.x).toBeCloseTo((W - safeBounds.w) / 2, 1);
      expect(safeBounds.y).toBeCloseTo(H * 0.18, 1);
    });

    it('isSlotLocked가 alignmentFrame에 대해 true를 반환하고 미잠금 슬롯에 대해 false를 반환한다', () => {
      const renderer = new ReadyPositionRenderer();

      expect(renderer.isSlotLocked('alignmentFrame')).toBe(true);
      expect(renderer.isSlotLocked('body_alignment_area')).toBe(true);
      expect(renderer.isSlotLocked('silhouette')).toBe(true);

      expect(renderer.isSlotLocked('headerMessage')).toBe(false);
      expect(renderer.isSlotLocked('skipNotice')).toBe(false);
      expect(renderer.isSlotLocked('countdown')).toBe(false);
      expect(renderer.isSlotLocked('unknown_slot')).toBe(false);
    });

    it('getSlotLockReason이 잠긴 모션 보호 슬롯에 대해 사유를 명시하고 미잠금 슬롯은 null을 반환한다', () => {
      const renderer = new ReadyPositionRenderer();

      const reason = renderer.getSlotLockReason('alignmentFrame');
      expect(reason).not.toBeNull();
      expect(typeof reason).toBe('string');
      expect(reason).toContain('body_alignment_area');

      expect(renderer.getSlotLockReason('headerMessage')).toBeNull();
      expect(renderer.getSlotLockReason('skipNotice')).toBeNull();
    });

    it('validatePresentationContext가 모션 보호 구역 geometry 변조 시도를 원자적으로 감지한다', () => {
      const renderer = new ReadyPositionRenderer();

      const validCtx: ReadyPositionPresentationContext = {
        headerMessage: { text: '안전한 문구 변경', color: '#FFFFFF' },
        skipNotice: { text: '안전한 스킵 변경' },
      };
      const validResult = renderer.validatePresentationContext(validCtx);
      expect(validResult.valid).toBe(true);
      expect(validResult.violations.length).toBe(0);

      const invalidCtx: ReadyPositionPresentationContext = {
        alignmentFrame: { x: 10, y: 10, w: 900, h: 900 },
      };
      const invalidResult = renderer.validatePresentationContext(invalidCtx);
      expect(invalidResult.valid).toBe(false);
      expect(invalidResult.violations.length).toBeGreaterThan(0);
      expect(invalidResult.lockedSlots).toContain('alignmentFrame');
    });

    it('정렬 프레임의 색상/스타일 변경은 안전하게 허용되며 렌더링에 반영된다', () => {
      const customStyleCtx: ReadyPositionPresentationContext = {
        alignmentFrame: {
          color: '#FF00FF',
          shadowColor: '#FF00FF',
        },
      };

      const renderer = new ReadyPositionRenderer(customStyleCtx);
      const ctx = createMockCtx();
      renderer.render(ctx, W, H, {
        currentCount: 3,
        countText: '3',
        isAligned: false,
      });

      // strokeStyle이나 shadowColor에 커스텀 색상이 사용되었는지 확인
      expect(ctx.strokeStyles).toContain('#FF00FF');
    });

    it('슬롯 목록 상수(READY_POSITION_SLOT_IDS, PROTECTED_READY_SLOT_IDS)가 정의되어 있다', () => {
      expect(READY_POSITION_SLOT_IDS).toContain('alignmentFrame');
      expect(READY_POSITION_SLOT_IDS).toContain('headerMessage');
      expect(READY_POSITION_SLOT_IDS).toContain('countdown');
      expect(READY_POSITION_SLOT_IDS).toContain('skipNotice');

      expect(PROTECTED_READY_SLOT_IDS).toContain('alignmentFrame');
    });
  });

  describe('3. 결정론적 Fixture DTO 렌더 진입점 (renderFixture)', () => {
    it('컨트롤러/카메라/타이머 없이 순수 DTO만으로 결정론적 렌더링을 완수한다', () => {
      const renderer = new ReadyPositionRenderer();
      const ctx = createMockCtx();

      const fixtureDTO: ReadyPositionFixtureDTO = {
        isAligned: false,
        currentCount: 3,
        countText: '3',
        readyTimer: 3.0,
      };

      renderer.renderFixture(ctx, W, H, fixtureDTO);

      const fillTextCalls = (ctx as any).calls.filter((c: any) => c.method === 'fillText');
      expect(fillTextCalls.some((c: any) => c.args[0] === '3')).toBe(true);
      expect(fillTextCalls.some((c: any) => c.args[0] === '카메라 앞에 서서 준비하세요!')).toBe(true);
    });

    it('정렬 완료(isAligned: true) 및 START! 카운트다운 fixture가 정확한 텍스트와 청록색 네온을 렌더링한다', () => {
      const renderer = new ReadyPositionRenderer();
      const ctx = createMockCtx();

      const startDTO: ReadyPositionFixtureDTO = {
        isAligned: true,
        currentCount: 0,
        countText: 'START!',
        readyTimer: 0.0,
      };

      renderer.renderFixture(ctx, W, H, startDTO);

      const fillTextCalls = (ctx as any).calls.filter((c: any) => c.method === 'fillText');
      expect(fillTextCalls.some((c: any) => c.args[0] === 'START!')).toBe(true);
      expect(fillTextCalls.some((c: any) => c.args[0] === '정렬 완료! 자세를 유지하세요')).toBe(true);
    });

    it('renderFixture 실행 전후로 렌더러 내부 상태(animTime, presentationContext)가 불변 복원된다 (부작용 0건)', () => {
      const baseCtx: ReadyPositionPresentationContext = {
        headerMessage: { text: '기존 컨텍스트' },
      };
      const renderer = new ReadyPositionRenderer(baseCtx);
      renderer.update(1.5);

      const mockCtx = createMockCtx();
      const fixtureDTO: ReadyPositionFixtureDTO = {
        animTime: 9.99,
        presentationContext: {
          headerMessage: { text: '임시 픽스처 컨텍스트' },
        },
        currentCount: 2,
        countText: '2',
      };

      renderer.renderFixture(mockCtx, W, H, fixtureDTO);

      // renderFixture 실행 후 기존 상태로 복귀
      expect(renderer.getPresentationContext()).toEqual(baseCtx);
    });

    it('정적 ReadyPositionRenderer.renderFixture로 인스턴스 없이 순수 DTO를 직접 렌더링할 수 있다', () => {
      const mockCtx = createMockCtx();

      ReadyPositionRenderer.renderFixture(mockCtx, W, H, {
        isAligned: true,
        currentCount: 1,
        countText: '1',
      });

      const fillTextCalls = (mockCtx as any).calls.filter((c: any) => c.method === 'fillText');
      expect(fillTextCalls.some((c: any) => c.args[0] === '1')).toBe(true);
      expect(fillTextCalls.some((c: any) => c.args[0] === '정렬 완료! 자세를 유지하세요')).toBe(true);
    });

    it('ReadyPositionController의 런타임 상태가 renderFixture에 의해 전혀 변경되지 않는다', () => {
      const controller = new ReadyPositionController({ countdownDuration: 3.0 });
      controller.start();
      const initialState = controller.getState();

      const mockCtx = createMockCtx();
      ReadyPositionRenderer.renderFixture(mockCtx, W, H, {
        isAligned: !initialState.isAligned,
        currentCount: 1,
        countText: '1',
      });

      const stateAfterRender = controller.getState();
      expect(stateAfterRender.currentCount).toBe(initialState.currentCount);
      expect(stateAfterRender.isAligned).toBe(initialState.isAligned);
      expect(stateAfterRender.remainingTime).toBe(initialState.remainingTime);
    });

    it('DEFAULT_READY_POSITION_FIXTURE_STATE 상수가 올바르게 정의되어 있다', () => {
      expect(DEFAULT_READY_POSITION_FIXTURE_STATE.currentCount).toBe(3);
      expect(DEFAULT_READY_POSITION_FIXTURE_STATE.countText).toBe('3');
      expect(DEFAULT_READY_POSITION_FIXTURE_STATE.isAligned).toBe(false);
      expect(DEFAULT_READY_POSITION_FIXTURE_STATE.readyTimer).toBe(3.0);
    });
  });

  describe('4. 반응형 스케일링 및 비정상 입력 방어', () => {
    it('다양한 해상도(720x1280, 1920x1080)에서도 bounds가 캔버스 비율에 비례하여 안전하게 스케일링된다', () => {
      const renderer = new ReadyPositionRenderer();

      const boundsPortrait = renderer.getAlignmentFrameBounds(720, 1280);
      expect(boundsPortrait.w).toBeCloseTo(720 * 0.54, 1);
      expect(boundsPortrait.h).toBeCloseTo(1280 * 0.62, 1);

      const boundsLandscape = renderer.getAlignmentFrameBounds(1920, 1080);
      expect(boundsLandscape.w).toBeCloseTo(1920 * 0.54, 1);
      expect(boundsLandscape.h).toBeCloseTo(1080 * 0.62, 1);
    });

    it('width 또는 height가 0 이하일 경우 렌더링이 조기 반환된다', () => {
      const renderer = new ReadyPositionRenderer();
      const ctx = createMockCtx();

      renderer.render(ctx, 0, H, { currentCount: 3, countText: '3', isAligned: false });
      renderer.render(ctx, W, 0, { currentCount: 3, countText: '3', isAligned: false });
      renderer.render(ctx, -100, -100, { currentCount: 3, countText: '3', isAligned: false });

      expect((ctx as any).calls.length).toBe(0);
    });
  });
});
