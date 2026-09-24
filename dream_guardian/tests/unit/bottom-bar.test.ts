import { describe, it, expect, vi } from 'vitest';
import { BottomBar, BOTTOM_BAR_CONFIG } from '../../src/ui/BottomBar.js';
import { SettingsModal } from '../../src/ui/SettingsModal.js';

function createMockCtx(): CanvasRenderingContext2D {
  return {
    save: vi.fn(),
    restore: vi.fn(),
    beginPath: vi.fn(),
    closePath: vi.fn(),
    rect: vi.fn(),
    fillRect: vi.fn(),
    strokeRect: vi.fn(),
    roundRect: vi.fn(),
    arc: vi.fn(),
    fill: vi.fn(),
    stroke: vi.fn(),
    moveTo: vi.fn(),
    lineTo: vi.fn(),
    fillText: vi.fn(),
    measureText: vi.fn(() => ({ width: 100 })),
    createLinearGradient: vi.fn(() => ({ addColorStop: vi.fn() })),
    globalAlpha: 1,
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

describe('BottomBar (Issue #141 / UI-BAR-001)', () => {
  it('기본 설정 규격(1080x2160 기준 y: 1960, h: 200)이 정의되어 있다', () => {
    expect(BOTTOM_BAR_CONFIG.height).toBe(200);
    expect(BOTTOM_BAR_CONFIG.y).toBe(1960);
    expect(BOTTOM_BAR_CONFIG.settingsBtn.x).toBe(30);
    expect(BOTTOM_BAR_CONFIG.settingsBtn.y).toBe(1990);
    expect(BOTTOM_BAR_CONFIG.settingsBtn.w).toBe(140);
    expect(BOTTOM_BAR_CONFIG.settingsBtn.h).toBe(140);
    expect(BOTTOM_BAR_CONFIG.actionBtn.x).toBe(810);
    expect(BOTTOM_BAR_CONFIG.actionBtn.y).toBe(1990);
    expect(BOTTOM_BAR_CONFIG.actionBtn.w).toBe(240);
    expect(BOTTOM_BAR_CONFIG.actionBtn.h).toBe(140);
  });

  it('hitTestSettings가 설정 버튼 내부를 정확히 판정한다', () => {
    const bar = new BottomBar();
    const w = 1080;
    const h = 2160;

    // 설정 버튼 중심 (30 + 70 = 100, 1990 + 70 = 2060)
    expect(bar.hitTestSettings(100, 2060, w, h)).toBe(true);
    // 설정 버튼 좌상단 모서리
    expect(bar.hitTestSettings(30, 1990, w, h)).toBe(true);
    // 설정 버튼 우하단 모서리
    expect(bar.hitTestSettings(170, 2130, w, h)).toBe(true);

    // 설정 버튼 밖 (중앙 영역)
    expect(bar.hitTestSettings(500, 2060, w, h)).toBe(false);
    // 설정 버튼 위
    expect(bar.hitTestSettings(100, 1900, w, h)).toBe(false);
  });

  it('hitTestAction이 액션 버튼 내부를 정확히 판정한다', () => {
    const bar = new BottomBar();
    const w = 1080;
    const h = 2160;

    // 기본 액션 버튼 중심 (810 + 120 = 930, 1990 + 70 = 2060)
    expect(bar.hitTestAction(930, 2060, w, h)).toBe(true);
    // 커스텀 액션 버튼 범위 전달 시
    const customSlot = { x: 780, y: 1990, w: 270, h: 140 };
    expect(bar.hitTestAction(790, 2060, w, h, 0, customSlot)).toBe(true);
    expect(bar.hitTestAction(100, 2060, w, h, 0, customSlot)).toBe(false);
  });

  it('render()가 예외 없이 캔버스 메서드를 호출한다', () => {
    const bar = new BottomBar();
    const ctx = createMockCtx();
    expect(() => {
      bar.render(ctx, 1080, 2160, {
        actionLabel: '정지',
        actionColor: '#FF4444',
      });
    }).not.toThrow();
    expect(ctx.fillRect).toHaveBeenCalled();
    expect(ctx.fillText).toHaveBeenCalled();
  });
});

describe('SettingsModal (Issue #141 / UI-BAR-001)', () => {
  it('기본 상태는 닫힘(isOpen = false)이다', () => {
    const modal = new SettingsModal();
    expect(modal.isOpen).toBe(false);
    modal.open();
    expect(modal.isOpen).toBe(true);
    modal.close();
    expect(modal.isOpen).toBe(false);
    modal.toggle();
    expect(modal.isOpen).toBe(true);
  });

  it('설정 항목(카메라, 전체화면, 스켈레톤, 사운드) 토글 상태를 관리한다', () => {
    const modal = new SettingsModal();
    expect(modal.cameraEnabled).toBe(true);
    expect(modal.skeletonEnabled).toBe(true);
    expect(modal.soundEnabled).toBe(true);

    modal.cameraEnabled = false;
    expect(modal.cameraEnabled).toBe(false);
    modal.skeletonEnabled = false;
    expect(modal.skeletonEnabled).toBe(false);
  });

  it('모달 내부 클릭 좌표에 따라 알맞은 액션을 반환한다', () => {
    const modal = new SettingsModal();
    modal.open();
    const w = 1080;
    const h = 2160;

    // 닫기 버튼 클릭
    const closePos = modal.getButtonLayout('close', w, h);
    expect(modal.handleClick(closePos.x + closePos.w / 2, closePos.y + closePos.h / 2, w, h)).toBe('close');

    // 카메라 토글 클릭
    const camPos = modal.getButtonLayout('camera', w, h);
    expect(modal.handleClick(camPos.x + camPos.w / 2, camPos.y + camPos.h / 2, w, h)).toBe('camera');

    // 모달 바깥 배경 클릭 시 close 반환
    expect(modal.handleClick(50, 50, w, h)).toBe('backdrop-close');
  });

  it('render()가 모달 열림 상태일 때 오버레이와 버튼을 렌더링한다', () => {
    const modal = new SettingsModal();
    const ctx = createMockCtx();
    // 닫힘 상태일 때는 렌더링 안 함
    modal.render(ctx, 1080, 2160);
    expect(ctx.fillRect).not.toHaveBeenCalled();

    modal.open();
    modal.render(ctx, 1080, 2160);
    expect(ctx.fillRect).toHaveBeenCalled();
    expect(ctx.fillText).toHaveBeenCalled();
  });
});
