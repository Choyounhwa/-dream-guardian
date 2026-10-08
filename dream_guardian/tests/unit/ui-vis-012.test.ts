import { describe, expect, it, vi } from 'vitest';
import {
  PauseModal,
  PAUSE_BUTTON_ACTIONS,
  isSupportedPauseAction,
  type PausePresentationContext,
  type PauseModalFixtureDTO,
} from '../../src/ui/PauseModal.js';
import { UI_LAYOUT } from '../../config/ui.config.js';
import { createDefaultUIPresentationDocument } from '../../src/data/UIPresentation.js';

function createMockCtx(): CanvasRenderingContext2D {
  const calls: { method: string; args: unknown[] }[] = [];
  return {
    calls,
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
    measureText: vi.fn().mockReturnValue({ width: 60 }),
    drawImage: vi.fn((...args: unknown[]) => calls.push({ method: 'drawImage', args })),
    translate: vi.fn((x: number, y: number) => calls.push({ method: 'translate', args: [x, y] })),
    scale: vi.fn((x: number, y: number) => calls.push({ method: 'scale', args: [x, y] })),
    createLinearGradient: vi.fn(() => ({
      addColorStop: vi.fn(),
    })),
    fillStyle: '#000000',
    strokeStyle: '#000000',
    lineWidth: 1,
    font: '16px sans-serif',
    textAlign: 'center' as CanvasTextAlign,
    textBaseline: 'middle' as CanvasTextBaseline,
    globalAlpha: 1,
    shadowColor: 'transparent',
    shadowBlur: 0,
  } as unknown as CanvasRenderingContext2D;
}

describe('[Issue #442 / UI-VIS-012] 일시정지 모달 표시 context와 공통 bounds', () => {
  const W = 1080;
  const H = 2160;

  describe('1. resume/quit 2개 액션만 지원 및 미지원 액션(restart 등) 거부', () => {
    it('PAUSE_BUTTON_ACTIONS는 resume과 quit 두 가지만 포함한다', () => {
      expect(PAUSE_BUTTON_ACTIONS).toEqual(['resume', 'quit']);
      expect(PAUSE_BUTTON_ACTIONS).not.toContain('restart');
      expect(PAUSE_BUTTON_ACTIONS).not.toContain('retry');
    });

    it('isSupportedPauseAction 함수가 지원 액션만 판별한다', () => {
      expect(isSupportedPauseAction('resume')).toBe(true);
      expect(isSupportedPauseAction('quit')).toBe(true);
      expect(isSupportedPauseAction('restart')).toBe(false);
      expect(isSupportedPauseAction('retry')).toBe(false);
      expect(isSupportedPauseAction('backdrop')).toBe(false);
      expect(isSupportedPauseAction('')).toBe(false);
    });

    it('PauseModal 인스턴스에서 restart 등 미지원 액션 요청 시 안전하게 거부된다', () => {
      const modal = new PauseModal();

      expect(modal.isActionSupported('resume')).toBe(true);
      expect(modal.isActionSupported('quit')).toBe(true);
      expect(modal.isActionSupported('restart')).toBe(false);
      expect(modal.isActionSupported('settings')).toBe(false);

      // getButtonLayout에 restart 전달 시 null 반환
      expect(modal.getButtonLayout('restart' as any, W, H)).toBeNull();

      // handleAction에 restart 전달 시 거부(false)
      expect(modal.handleAction('restart')).toBe(false);

      // updateGestureHover에 restart 전달 시 무시 및 null 반환
      expect(modal.updateGestureHover('restart' as any, 0.1)).toBeNull();

      // getButtonLayouts 맵에는 resume과 quit만 존재
      const layouts = modal.getButtonLayouts(W, H);
      expect(Object.keys(layouts).sort()).toEqual(['quit', 'resume']);
      expect((layouts as any).restart).toBeUndefined();
    });
  });

  describe('2. 선택적 표시 컨텍스트(PausePresentationContext) 및 기본 bounds 조회', () => {
    it('컨텍스트 미주입 시 기본 UI_LAYOUT.pause와 100% 호환되는 bounds를 반환한다', () => {
      const modal = new PauseModal();
      expect(modal.getPresentationContext()).toBeUndefined();

      const modalBounds = modal.getModalBounds(W, H);
      expect(modalBounds).toEqual({
        x: UI_LAYOUT.pause.modal.x,
        y: UI_LAYOUT.pause.modal.y,
        w: UI_LAYOUT.pause.modal.w,
        h: UI_LAYOUT.pause.modal.h,
      });

      const resumeLayout = modal.getButtonLayout('resume', W, H);
      expect(resumeLayout).toEqual({
        x: UI_LAYOUT.pause.resumeBtn.x,
        y: UI_LAYOUT.pause.resumeBtn.y,
        w: UI_LAYOUT.pause.resumeBtn.w,
        h: UI_LAYOUT.pause.resumeBtn.h,
      });

      const quitLayout = modal.getButtonLayout('quit', W, H);
      expect(quitLayout).toEqual({
        x: UI_LAYOUT.pause.quitBtn.x,
        y: UI_LAYOUT.pause.quitBtn.y,
        w: UI_LAYOUT.pause.quitBtn.w,
        h: UI_LAYOUT.pause.quitBtn.h,
      });

      const titleBounds = modal.getTitleBounds(W, H);
      expect(titleBounds.x).toBeGreaterThanOrEqual(modalBounds.x);
      expect(titleBounds.y).toBeGreaterThanOrEqual(modalBounds.y);
      expect(titleBounds.w).toBeLessThanOrEqual(modalBounds.w);
    });

    it('setPresentationContext로 모달 및 버튼의 좌표/크기를 오버라이드할 수 있다', () => {
      const modal = new PauseModal();
      const customContext: PausePresentationContext = {
        modal: { x: 100, y: 500, w: 880, h: 800 },
        resumeBtn: { x: 160, y: 800, w: 760, h: 140, label: '이어서 플레이' },
        quitBtn: { x: 160, y: 1000, w: 760, h: 140, label: '종료하고 나가기' },
        title: { x: 120, y: 540, w: 840, h: 120, text: '게임 멈춤' },
      };

      modal.setPresentationContext(customContext);
      expect(modal.getPresentationContext()).toEqual(customContext);

      const modalBounds = modal.getModalBounds(W, H);
      expect(modalBounds).toEqual({ x: 100, y: 500, w: 880, h: 800 });

      const resumeLayout = modal.getButtonLayout('resume', W, H);
      expect(resumeLayout).toEqual({ x: 160, y: 800, w: 760, h: 140 });

      const quitLayout = modal.getButtonLayout('quit', W, H);
      expect(quitLayout).toEqual({ x: 160, y: 1000, w: 760, h: 140 });

      const titleBounds = modal.getTitleBounds(W, H);
      expect(titleBounds).toEqual({ x: 120, y: 540, w: 840, h: 120 });

      // clearPresentationContext 호출 시 기본 레이아웃으로 회귀
      modal.clearPresentationContext();
      expect(modal.getPresentationContext()).toBeUndefined();
      expect(modal.getModalBounds(W, H)).toEqual(UI_LAYOUT.pause.modal);
      expect(modal.getButtonLayout('resume', W, H)).toEqual(UI_LAYOUT.pause.resumeBtn);
    });

    it('UIPresentationDocument로부터 fromPresentationDocument로 컨텍스트를 성공적으로 추출한다', () => {
      const doc = createDefaultUIPresentationDocument();
      const context = PauseModal.fromPresentationDocument(doc, 'pause');

      expect(context.presentationDocument).toBe(doc);
      expect(context.pageId).toBe('pause');
      expect(context.title).toBeDefined();
      expect(context.resumeBtn).toBeDefined();
      expect(context.quitBtn).toBeDefined();
      expect(context.resumeBtn?.x).toBe(240);
      expect(context.resumeBtn?.y).toBe(800);
      expect(context.quitBtn?.x).toBe(240);
      expect(context.quitBtn?.y).toBe(950);

      const modal = new PauseModal(context);
      const resumeLayout = modal.getButtonLayout('resume', W, H);
      expect(resumeLayout.x).toBe(240);
      expect(resumeLayout.y).toBe(800);
    });
  });

  describe('3. Single Source of Truth Geometry 및 hitTest 1:1 일치', () => {
    it('버튼 이동 시 hitTest가 이동된 새 위치에서 정확히 판정되고 이전 위치 오클릭 0건을 보장한다', () => {
      const modal = new PauseModal();
      const defaultResume = modal.getButtonLayout('resume', W, H);
      const defaultQuit = modal.getButtonLayout('quit', W, H);

      // 기본 상태 히트 테스트
      expect(
        modal.hitTest(
          defaultResume.x + defaultResume.w / 2,
          defaultResume.y + defaultResume.h / 2,
          W,
          H
        )
      ).toBe('resume');
      expect(
        modal.hitTest(
          defaultQuit.x + defaultQuit.w / 2,
          defaultQuit.y + defaultQuit.h / 2,
          W,
          H
        )
      ).toBe('quit');

      // 버튼을 완전히 다른 좌표로 이동시키는 컨텍스트 주입
      const movedContext: PausePresentationContext = {
        resumeBtn: { x: 50, y: 200, w: 300, h: 80 },
        quitBtn: { x: 50, y: 350, w: 300, h: 80 },
        modal: { x: 30, y: 150, w: 400, h: 400 },
      };
      modal.setPresentationContext(movedContext);

      // 새 위치에서는 정확히 히트 판정
      expect(modal.hitTest(50 + 150, 200 + 40, W, H)).toBe('resume');
      expect(modal.hitTest(50 + 150, 350 + 40, W, H)).toBe('quit');

      // 이전 위치에서는 새 버튼이 없으므로 backdrop(모달 범위 밖) 또는 null 반환 (오클릭 0건)
      expect(
        modal.hitTest(
          defaultResume.x + defaultResume.w / 2,
          defaultResume.y + defaultResume.h / 2,
          W,
          H
        )
      ).not.toBe('resume');
      expect(
        modal.hitTest(
          defaultQuit.x + defaultQuit.w / 2,
          defaultQuit.y + defaultQuit.h / 2,
          W,
          H
        )
      ).not.toBe('quit');

      // 모달 바운딩 박스 바깥은 backdrop
      expect(modal.hitTest(10, 10, W, H)).toBe('backdrop');
    });

    it('다양한 해상도(스케일)에서도 getModalBounds, getButtonLayout, hitTest가 동일한 비율로 일치한다', () => {
      const halfW = 540;
      const halfH = 1080;
      const modal = new PauseModal();

      const modalBounds = modal.getModalBounds(halfW, halfH);
      const resumeBounds = modal.getButtonLayout('resume', halfW, halfH);
      const quitBounds = modal.getButtonLayout('quit', halfW, halfH);

      expect(modalBounds.x).toBe(UI_LAYOUT.pause.modal.x * 0.5);
      expect(resumeBounds.x).toBe(UI_LAYOUT.pause.resumeBtn.x * 0.5);
      expect(resumeBounds.y).toBe(UI_LAYOUT.pause.resumeBtn.y * 0.5);

      expect(
        modal.hitTest(
          resumeBounds.x + resumeBounds.w / 2,
          resumeBounds.y + resumeBounds.h / 2,
          halfW,
          halfH
        )
      ).toBe('resume');

      expect(
        modal.hitTest(
          quitBounds.x + quitBounds.w / 2,
          quitBounds.y + quitBounds.h / 2,
          halfW,
          halfH
        )
      ).toBe('quit');
    });
  });

  describe('4. 결정적 Fixture DTO 렌더 진입 (renderFixture 및 무부작용 보장)', () => {
    it('renderFixture 호출 시 게임/모달의 런타임 상태 변경이 0건이다', () => {
      const modal = new PauseModal();
      expect(modal.isOpen).toBe(false);
      expect(modal.hoverAction).toBeNull();
      expect(modal.hoverProgress).toBe(0);
      expect(modal.animProgress).toBe(0);

      const mockCtx = createMockCtx();
      const fixtureDTO: PauseModalFixtureDTO = {
        isOpen: true,
        animProgress: 1.0,
        hoverAction: 'resume',
        hoverProgress: 0.75,
      };

      // Fixture 렌더 수행
      modal.renderFixture(mockCtx, W, H, fixtureDTO);

      // 렌더 후에도 원본 런타임 상태는 일체 불변 (부작용 0건)
      expect(modal.isOpen).toBe(false);
      expect(modal.hoverAction).toBeNull();
      expect(modal.hoverProgress).toBe(0);
      expect(modal.animProgress).toBe(0);

      // Canvas 드로잉 호출 발생 확인
      expect(mockCtx.save).toHaveBeenCalled();
      expect(mockCtx.restore).toHaveBeenCalled();
      expect(mockCtx.fillText).toHaveBeenCalled();
    });

    it('정적 PauseModal.renderFixture 진입점을 통해 인스턴스 라이프사이클 없이 순수 DTO를 렌더링할 수 있다', () => {
      const mockCtx = createMockCtx();
      const customContext: PausePresentationContext = {
        title: { text: '에디터 프리뷰 일시정지' },
        resumeBtn: { label: '시뮬레이션 재개' },
      };

      PauseModal.renderFixture(mockCtx, W, H, {
        isOpen: true,
        animProgress: 1.0,
        presentationContext: customContext,
      });

      // 커스텀 텍스트가 전달되어 렌더링되었는지 확인
      const fillTextCalls = (mockCtx.fillText as any).mock.calls;
      const texts = fillTextCalls.map((c: unknown[]) => c[0]);
      expect(texts).toContain('에디터 프리뷰 일시정지');
      expect(texts).toContain('시뮬레이션 재개');
    });

    it('isOpen이 false인 fixture DTO는 드로잉을 즉시 생략한다', () => {
      const mockCtx = createMockCtx();
      PauseModal.renderFixture(mockCtx, W, H, {
        isOpen: false,
      });

      expect(mockCtx.save).not.toHaveBeenCalled();
      expect(mockCtx.fillText).not.toHaveBeenCalled();
    });
  });
});
