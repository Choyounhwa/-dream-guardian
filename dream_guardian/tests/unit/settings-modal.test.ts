import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { SettingsModal } from '../../src/ui/SettingsModal.js';
import { PauseModal } from '../../src/ui/PauseModal.js';
import { UI_IMAGE_ASSETS } from '../../config/ui.config.js';
import { imageLoader } from '../../src/utils/UIImageLoader.js';

function createMockCtx(): CanvasRenderingContext2D {
  return {
    save: vi.fn(),
    restore: vi.fn(),
    beginPath: vi.fn(),
    closePath: vi.fn(),
    moveTo: vi.fn(),
    lineTo: vi.fn(),
    arc: vi.fn(),
    rect: vi.fn(),
    roundRect: vi.fn(),
    fill: vi.fn(),
    stroke: vi.fn(),
    fillRect: vi.fn(),
    strokeRect: vi.fn(),
    fillText: vi.fn(),
    measureText: vi.fn().mockReturnValue({ width: 80 }),
    drawImage: vi.fn(),
    translate: vi.fn(),
    scale: vi.fn(),
    globalAlpha: 1,
    fillStyle: '',
    strokeStyle: '',
    lineWidth: 1,
    font: '',
    textAlign: 'left',
    textBaseline: 'top',
    shadowColor: '',
    shadowBlur: 0,
  } as unknown as CanvasRenderingContext2D;
}

describe('SettingsModal & PauseModal 에셋 연동 (Issue #293 / UI-ASSET-012)', () => {
  let ctx: CanvasRenderingContext2D;

  beforeEach(() => {
    ctx = createMockCtx();
  });

  describe('1. 모달 버튼 및 아이콘 에셋 파일 규격 검증', () => {
    it('public/assets/ui/modal/ 경로에 7종 PNG 에셋이 규격대로 존재한다', () => {
      const baseDir = path.resolve(process.cwd(), 'public/assets/ui/modal');
      const expectedAssets = [
        { file: 'btn_resume.png', w: 680, h: 130 },
        { file: 'btn_quit.png', w: 680, h: 130 },
        { file: 'btn_close_x.png', w: 60, h: 60 },
        { file: 'icon_camera.png', w: 64, h: 64 },
        { file: 'icon_sound.png', w: 64, h: 64 },
        { file: 'icon_skeleton.png', w: 64, h: 64 },
        { file: 'icon_fullscreen.png', w: 64, h: 64 },
      ];

      for (const item of expectedAssets) {
        const filePath = path.join(baseDir, item.file);
        expect(fs.existsSync(filePath), `파일 존재하지 않음: ${item.file}`).toBe(true);
        const buf = fs.readFileSync(filePath);
        expect(buf[0]).toBe(0x89);
        expect(buf[1]).toBe(0x50);
        expect(buf[2]).toBe(0x4E);
        expect(buf[3]).toBe(0x47);
        const width = buf.readUInt32BE(16);
        const height = buf.readUInt32BE(20);
        expect(width).toBe(item.w);
        expect(height).toBe(item.h);
      }
    });

    it('UI_IMAGE_ASSETS.modal에 버튼 및 아이콘 슬롯이 올바르게 등록되어 있다', () => {
      expect((UI_IMAGE_ASSETS as any).modal).toBeDefined();
      const modalAssets = (UI_IMAGE_ASSETS as any).modal;
      expect(modalAssets.btnResume).toBe('/assets/ui/modal/btn_resume.png');
      expect(modalAssets.btnQuit).toBe('/assets/ui/modal/btn_quit.png');
      expect(modalAssets.btnCloseX).toBe('/assets/ui/modal/btn_close_x.png');
      expect(modalAssets.iconCamera).toBe('/assets/ui/modal/icon_camera.png');
      expect(modalAssets.iconSound).toBe('/assets/ui/modal/icon_sound.png');
      expect(modalAssets.iconSkeleton).toBe('/assets/ui/modal/icon_skeleton.png');
      expect(modalAssets.iconFullscreen).toBe('/assets/ui/modal/icon_fullscreen.png');
    });
  });

  describe('2. SettingsModal 비트맵 렌더링 및 절차적 폴백', () => {
    it('닫기 버튼 및 기능 아이콘이 준비되었을 때 drawImage로 렌더링한다', () => {
      const modal = new SettingsModal();
      modal.open();
      modal.update(0.3);

      const mockCloseBtn = { src: 'close_x.png', width: 60, height: 60 } as HTMLImageElement;
      const mockCameraIcon = { src: 'camera.png', width: 64, height: 64 } as HTMLImageElement;

      vi.spyOn(imageLoader, 'get').mockImplementation((cat: string, key: string) => {
        if (cat === 'modal' && key === 'btnCloseX') return mockCloseBtn;
        if (cat === 'modal' && key === 'iconCamera') return mockCameraIcon;
        return null;
      });

      modal.render(ctx, 1080, 2160);

      expect(ctx.drawImage).toHaveBeenCalledWith(
        mockCloseBtn,
        expect.any(Number),
        expect.any(Number),
        expect.any(Number),
        expect.any(Number),
      );
      expect(ctx.drawImage).toHaveBeenCalledWith(
        mockCameraIcon,
        expect.any(Number),
        expect.any(Number),
        expect.any(Number),
        expect.any(Number),
      );

      vi.restoreAllMocks();
    });

    it('에셋이 미로드 상태일 때 기존 절차적 Canvas 텍스트/도형으로 100% 정상 폴백한다', () => {
      const modal = new SettingsModal();
      modal.open();
      modal.update(0.3);

      vi.spyOn(imageLoader, 'get').mockReturnValue(null);

      modal.render(ctx, 1080, 2160);

      // 절차적 폴백: ✕ 텍스트 및 기본 박스 드로잉
      expect(ctx.fillText).toHaveBeenCalledWith(
        '✕',
        expect.any(Number),
        expect.any(Number),
      );

      vi.restoreAllMocks();
    });
  });

  describe('3. PauseModal 비트맵 렌더링 및 절차적 폴백', () => {
    it('modal 카테고리의 btnResume 및 btnQuit 에셋을 감지하여 drawImage로 렌더링한다', () => {
      const modal = new PauseModal();
      modal.open();
      modal.update(0.3);

      const mockResume = { src: 'btn_resume.png', width: 680, height: 130 } as HTMLImageElement;
      const mockQuit = { src: 'btn_quit.png', width: 680, height: 130 } as HTMLImageElement;

      vi.spyOn(imageLoader, 'get').mockImplementation((cat: string, key: string) => {
        if (cat === 'modal' && key === 'btnResume') return mockResume;
        if (cat === 'modal' && key === 'btnQuit') return mockQuit;
        return null;
      });

      modal.render(ctx, 1080, 2160);

      expect(ctx.drawImage).toHaveBeenCalledWith(
        mockResume,
        expect.any(Number),
        expect.any(Number),
        expect.any(Number),
        expect.any(Number),
      );
      expect(ctx.drawImage).toHaveBeenCalledWith(
        mockQuit,
        expect.any(Number),
        expect.any(Number),
        expect.any(Number),
        expect.any(Number),
      );

      vi.restoreAllMocks();
    });

    it('에셋이 없을 때 Canvas 절차적 드로잉으로 안전하게 폴백한다', () => {
      const modal = new PauseModal();
      modal.open();
      modal.update(0.3);

      vi.spyOn(imageLoader, 'get').mockReturnValue(null);

      modal.render(ctx, 1080, 2160);

      expect(ctx.fillText).toHaveBeenCalledWith(
        '▶  게임으로 돌아가기',
        expect.any(Number),
        expect.any(Number),
      );
      expect(ctx.fillText).toHaveBeenCalledWith(
        '🏠  홈으로 나가기',
        expect.any(Number),
        expect.any(Number),
      );

      vi.restoreAllMocks();
    });
  });

  describe('4. SettingsModal 실사 웹캠 표시/숨김 토글 (Issue #497 / FEAT-AVATAR-WEBCAM-TOGGLE)', () => {
    let mockStore: Record<string, string> = {};

    beforeEach(() => {
      mockStore = {};
      vi.stubGlobal('localStorage', {
        getItem: vi.fn((key: string) => mockStore[key] ?? null),
        setItem: vi.fn((key: string, val: string) => {
          mockStore[key] = String(val);
        }),
        removeItem: vi.fn((key: string) => {
          delete mockStore[key];
        }),
        clear: vi.fn(() => {
          mockStore = {};
        }),
      });
    });

    afterEach(() => {
      vi.unstubAllGlobals();
    });

    it('renderVideoEnabled의 기본값은 true이며 toViewModel()에도 반영된다', () => {
      const modal = new SettingsModal();
      expect(modal.renderVideoEnabled).toBe(true);
      expect(modal.toViewModel().renderVideoEnabled).toBe(true);
    });

    it('toggleRenderVideo() 호출 시 true/false가 반전되고 toViewModel 및 localStorage에 동기화된다', () => {
      const modal = new SettingsModal();
      const res1 = modal.toggleRenderVideo();
      expect(res1).toBe(false);
      expect(modal.renderVideoEnabled).toBe(false);
      expect(modal.toViewModel().renderVideoEnabled).toBe(false);
      expect(mockStore['dg_render_webcam']).toBe('false');

      const res2 = modal.toggleRenderVideo();
      expect(res2).toBe(true);
      expect(modal.renderVideoEnabled).toBe(true);
      expect(modal.toViewModel().renderVideoEnabled).toBe(true);
      expect(mockStore['dg_render_webcam']).toBe('true');
    });

    it('onRenderVideoChange 콜백 등록 시 토글 및 setter 변경 시 알림을 받는다', () => {
      const modal = new SettingsModal();
      const callback = vi.fn();
      modal.onRenderVideoChange = callback;

      modal.toggleRenderVideo();
      expect(callback).toHaveBeenCalledWith(false);

      modal.renderVideoEnabled = true;
      expect(callback).toHaveBeenCalledWith(true);
    });

    it('새 SettingsModal 생성 시 localStorage에 저장된 dg_render_webcam 값을 복원한다', () => {
      mockStore['dg_render_webcam'] = 'false';
      const restored = new SettingsModal();
      expect(restored.renderVideoEnabled).toBe(false);
      expect(restored.toViewModel().renderVideoEnabled).toBe(false);
    });

    it('webcamVideo 버튼의 레이아웃 좌표가 유효하게 계산된다', () => {
      const modal = new SettingsModal();
      const slot = modal.getButtonLayout('webcamVideo', 1080, 2160);
      expect(slot).toBeDefined();
      expect(slot.w).toBeGreaterThan(0);
      expect(slot.h).toBeGreaterThan(0);
    });

    it('모달 오픈 상태에서 webcamVideo 버튼 좌표를 클릭하면 "webcamVideo" 액션을 반환하고 토글된다', () => {
      const modal = new SettingsModal();
      modal.open();
      modal.update(0.3);

      const slot = modal.getButtonLayout('webcamVideo', 1080, 2160);
      const clickX = slot.x + slot.w / 2;
      const clickY = slot.y + slot.h / 2;

      expect(modal.renderVideoEnabled).toBe(true);
      const action = modal.handleClick(clickX, clickY, 1080, 2160);
      expect(action).toBe('webcamVideo');
      expect(modal.renderVideoEnabled).toBe(false);
    });

    it('SettingsModal render() 시 📹 실사 웹캠 레이블을 그린다', () => {
      const modal = new SettingsModal();
      modal.open();
      modal.update(0.3);

      modal.render(ctx, 1080, 2160);
      expect(ctx.fillText).toHaveBeenCalledWith(
        '📹 실사 웹캠',
        expect.any(Number),
        expect.any(Number),
      );
    });
  });
});
