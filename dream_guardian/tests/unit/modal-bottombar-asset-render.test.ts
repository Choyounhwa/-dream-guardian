import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { BottomBar } from '../../src/ui/BottomBar.js';
import { SettingsModal } from '../../src/ui/SettingsModal.js';
import { PauseModal } from '../../src/ui/PauseModal.js';
import { imageLoader } from '../../src/utils/UIImageLoader.js';
import { UI_IMAGE_ASSETS } from '../../config/ui.config.js';

function createMockImage(w = 100, h = 100): HTMLImageElement {
  return {
    src: 'mock.png',
    width: w,
    height: h,
    naturalWidth: w,
    naturalHeight: h,
    complete: true,
  } as unknown as HTMLImageElement;
}

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
    clip: vi.fn(),
    roundRect: vi.fn(),
    fill: vi.fn(),
    stroke: vi.fn(),
    fillRect: vi.fn(),
    strokeRect: vi.fn(),
    fillText: vi.fn(),
    measureText: vi.fn().mockReturnValue({ width: 80 }),
    drawImage: vi.fn(),
    createLinearGradient: vi.fn().mockReturnValue({
      addColorStop: vi.fn(),
    }),
    fillStyle: '',
    strokeStyle: '',
    lineWidth: 1,
    font: '',
    textAlign: 'left',
    textBaseline: 'top',
    shadowColor: '',
    shadowBlur: 0,
    globalAlpha: 1,
  } as unknown as CanvasRenderingContext2D;
}

function readPngDimensions(filePath: string): { width: number; height: number } {
  const buf = fs.readFileSync(filePath);
  // PNG signature: 89 50 4E 47 0D 0A 1A 0A
  expect(buf.slice(0, 8).toString('hex')).toBe('89504e470d0a1a0a');
  // IHDR chunk: 4 bytes length, 4 bytes 'IHDR', 4 bytes width, 4 bytes height
  const ihdrType = buf.slice(12, 16).toString('ascii');
  expect(ihdrType).toBe('IHDR');
  const width = buf.readUInt32BE(16);
  const height = buf.readUInt32BE(20);
  return { width, height };
}

describe('[UI-ASSET-004 / #269] 하단 바 / 설정 / 일시정지 모달 이미지 에셋 연동', () => {
  const bottomBarAssetDir = path.resolve(process.cwd(), 'public/assets/ui/bottombar');
  const settingsAssetDir = path.resolve(process.cwd(), 'public/assets/ui/settings');
  const pauseAssetDir = path.resolve(process.cwd(), 'public/assets/ui/pause');

  beforeEach(() => {
    imageLoader.clear();
  });

  afterEach(() => {
    imageLoader.clear();
    vi.restoreAllMocks();
  });

  describe('1. 이미지 에셋 파일 생성 및 규격 검증', () => {
    it('public/assets/ui/bottombar/ 디렉토리에 4개 필수 이미지 에셋이 존재한다', () => {
      const files = ['bar_bg.png', 'settings_icon.png', 'mana_frame.png', 'mana_fill.png'];
      for (const file of files) {
        const fullPath = path.join(bottomBarAssetDir, file);
        expect(fs.existsSync(fullPath), `파일이 존재해야 합니다: ${file}`).toBe(true);
        const stat = fs.statSync(fullPath);
        expect(stat.size).toBeGreaterThan(0);
      }
    });

    it('하단 바 이미지 파일들이 지정된 해상도 규격을 만족한다', () => {
      const specs = [
        { file: 'bar_bg.png', width: 1080, height: 200 },
        { file: 'settings_icon.png', width: 140, height: 140 },
        { file: 'mana_frame.png', width: 560, height: 50 },
        { file: 'mana_fill.png', width: 560, height: 50 },
      ];
      for (const spec of specs) {
        const fullPath = path.join(bottomBarAssetDir, spec.file);
        const dims = readPngDimensions(fullPath);
        expect(dims.width, `${spec.file} 너비 불일치`).toBe(spec.width);
        expect(dims.height, `${spec.file} 높이 불일치`).toBe(spec.height);
      }
    });

    it('public/assets/ui/settings/ 디렉토리에 3개 필수 이미지 에셋이 존재한다', () => {
      const files = ['modal_bg.png', 'toggle_on.png', 'toggle_off.png'];
      for (const file of files) {
        const fullPath = path.join(settingsAssetDir, file);
        expect(fs.existsSync(fullPath), `파일이 존재해야 합니다: ${file}`).toBe(true);
        const stat = fs.statSync(fullPath);
        expect(stat.size).toBeGreaterThan(0);
      }
    });

    it('설정 모달 이미지 파일들이 지정된 해상도 규격을 만족한다', () => {
      const specs = [
        { file: 'modal_bg.png', width: 800, height: 1200 },
        { file: 'toggle_on.png', width: 100, height: 50 },
        { file: 'toggle_off.png', width: 100, height: 50 },
      ];
      for (const spec of specs) {
        const fullPath = path.join(settingsAssetDir, spec.file);
        const dims = readPngDimensions(fullPath);
        expect(dims.width, `${spec.file} 너비 불일치`).toBe(spec.width);
        expect(dims.height, `${spec.file} 높이 불일치`).toBe(spec.height);
      }
    });

    it('public/assets/ui/pause/ 디렉토리에 3개 필수 이미지 에셋이 존재한다', () => {
      const files = ['modal_bg.png', 'resume_btn.png', 'quit_btn.png'];
      for (const file of files) {
        const fullPath = path.join(pauseAssetDir, file);
        expect(fs.existsSync(fullPath), `파일이 존재해야 합니다: ${file}`).toBe(true);
        const stat = fs.statSync(fullPath);
        expect(stat.size).toBeGreaterThan(0);
      }
    });

    it('일시정지 모달 이미지 파일들이 지정된 해상도 규격을 만족한다', () => {
      const specs = [
        { file: 'modal_bg.png', width: 800, height: 740 },
        { file: 'resume_btn.png', width: 600, height: 120 },
        { file: 'quit_btn.png', width: 600, height: 120 },
      ];
      for (const spec of specs) {
        const fullPath = path.join(pauseAssetDir, spec.file);
        const dims = readPngDimensions(fullPath);
        expect(dims.width, `${spec.file} 너비 불일치`).toBe(spec.width);
        expect(dims.height, `${spec.file} 높이 불일치`).toBe(spec.height);
      }
    });
  });

  describe('2. UI_IMAGE_ASSETS 경로 설정 검증', () => {
    it('bottomBar 에셋 경로들이 올바르게 등록되어 있다', () => {
      expect(UI_IMAGE_ASSETS.bottomBar.barBg).toBe('/assets/ui/bottombar/bar_bg.png');
      expect(UI_IMAGE_ASSETS.bottomBar.settingsIcon).toBe('/assets/ui/bottombar/settings_icon.png');
      expect(UI_IMAGE_ASSETS.bottomBar.manaFrame).toBe('/assets/ui/bottombar/mana_frame.png');
      expect(UI_IMAGE_ASSETS.bottomBar.manaFill).toBe('/assets/ui/bottombar/mana_fill.png');
    });

    it('settings 에셋 경로들이 올바르게 등록되어 있다', () => {
      expect(UI_IMAGE_ASSETS.settings.modalBg).toBe('/assets/ui/settings/modal_bg.png');
      expect(UI_IMAGE_ASSETS.settings.dialogBg).toBe('/assets/ui/settings/modal_bg.png');
      expect(UI_IMAGE_ASSETS.settings.toggleOn).toBe('/assets/ui/settings/toggle_on.png');
      expect(UI_IMAGE_ASSETS.settings.toggleOff).toBe('/assets/ui/settings/toggle_off.png');
    });

    it('pause 에셋 경로들이 올바르게 등록되어 있다', () => {
      expect(UI_IMAGE_ASSETS.pause.modalBg).toBe('/assets/ui/pause/modal_bg.png');
      expect(UI_IMAGE_ASSETS.pause.resumeBtn).toBe('/assets/ui/pause/resume_btn.png');
      expect(UI_IMAGE_ASSETS.pause.quitBtn).toBe('/assets/ui/pause/quit_btn.png');
    });
  });

  describe('3. BottomBar 렌더러 이미지 분기 및 폴백 검증', () => {
    it('이미지가 없을 때 기존 프로시저럴 드로잉으로 정상 렌더링된다', () => {
      const bar = new BottomBar();
      const ctx = createMockCtx();
      bar.render(ctx, 1080, 2160, { mana: 50, manaMax: 100 });

      expect(ctx.drawImage).not.toHaveBeenCalled();
      expect(ctx.fillRect).toHaveBeenCalled();
      expect(ctx.fillText).toHaveBeenCalled();
    });

    it('barBg 및 settingsIcon 이미지가 있을 때 drawImage가 호출된다', () => {
      const bar = new BottomBar();
      const ctx = createMockCtx();

      imageLoader.setImage('bottomBar', 'barBg', createMockImage(1080, 200));
      imageLoader.setImage('bottomBar', 'settingsIcon', createMockImage(140, 140));

      bar.render(ctx, 1080, 2160);

      expect(ctx.drawImage).toHaveBeenCalledTimes(2);
    });

    it('manaFrame 및 manaFill 이미지가 있을 때 마나 바에 drawImage가 호출된다', () => {
      const bar = new BottomBar();
      const ctx = createMockCtx();

      imageLoader.setImage('bottomBar', 'manaFrame', createMockImage(560, 50));
      imageLoader.setImage('bottomBar', 'manaFill', createMockImage(560, 50));

      bar.render(ctx, 1080, 2160, { mana: 75, manaMax: 100 });

      // manaFill, manaFrame 둘 다 drawImage 호출됨
      expect(ctx.drawImage).toHaveBeenCalled();
      // 마나 텍스트 표시 확인
      expect(ctx.fillText).toHaveBeenCalledWith(
        expect.stringContaining('MANA 75 / 100'),
        expect.any(Number),
        expect.any(Number),
      );
    });
  });

  describe('4. SettingsModal 렌더러 이미지 분기 및 폴백 검증', () => {
    it('이미지가 없을 때 기존 프로시저럴 드로잉으로 정상 렌더링된다', () => {
      const modal = new SettingsModal();
      modal.open();
      const ctx = createMockCtx();

      modal.render(ctx, 1080, 2160);

      expect(ctx.drawImage).not.toHaveBeenCalled();
      expect(ctx.fillText).toHaveBeenCalledWith(
        'ON',
        expect.any(Number),
        expect.any(Number),
      );
    });

    it('modalBg 이미지가 있을 때 모달 배경에 drawImage가 호출된다', () => {
      const modal = new SettingsModal();
      modal.open();
      const ctx = createMockCtx();

      imageLoader.setImage('settings', 'modalBg', createMockImage(800, 1200));
      modal.render(ctx, 1080, 2160);

      expect(ctx.drawImage).toHaveBeenCalled();
    });

    it('toggleOn / toggleOff 이미지가 있을 때 토글 버튼에 drawImage가 호출된다', () => {
      const modal = new SettingsModal();
      modal.open();
      const ctx = createMockCtx();

      imageLoader.setImage('settings', 'toggleOn', createMockImage(100, 50));
      imageLoader.setImage('settings', 'toggleOff', createMockImage(100, 50));

      modal.render(ctx, 1080, 2160);

      // 4개의 토글 버튼(camera, fullscreen, skeleton, sound)에 대해 toggle 이미지 drawImage 호출
      expect(ctx.drawImage).toHaveBeenCalled();
    });
  });

  describe('5. PauseModal 렌더러 이미지 분기 및 폴백 검증', () => {
    it('이미지가 없을 때 기존 프로시저럴 드로잉으로 정상 렌더링된다', () => {
      const modal = new PauseModal();
      modal.open();
      const ctx = createMockCtx();

      modal.render(ctx, 1080, 2160);

      expect(ctx.drawImage).not.toHaveBeenCalled();
      expect(ctx.fillText).toHaveBeenCalledWith(
        expect.stringContaining('게임으로 돌아가기'),
        expect.any(Number),
        expect.any(Number),
      );
    });

    it('modalBg, resumeBtn, quitBtn 이미지가 있을 때 drawImage가 호출된다', () => {
      const modal = new PauseModal();
      modal.open();
      const ctx = createMockCtx();

      imageLoader.setImage('pause', 'modalBg', createMockImage(800, 740));
      imageLoader.setImage('pause', 'resumeBtn', createMockImage(600, 120));
      imageLoader.setImage('pause', 'quitBtn', createMockImage(600, 120));

      modal.render(ctx, 1080, 2160);

      // modalBg, resumeBtn, quitBtn 3개 호출
      expect(ctx.drawImage).toHaveBeenCalledTimes(3);
    });

    it('버튼 호버 시 프로그레스 바가 정상 렌더링된다', () => {
      const modal = new PauseModal();
      modal.open();
      // 0.4초 호버 진행
      modal.updateHover(540, 980 + 65, 1080, 2160, 0.4);

      const ctx = createMockCtx();
      imageLoader.setImage('pause', 'resumeBtn', createMockImage(600, 120));
      modal.render(ctx, 1080, 2160);

      expect(ctx.drawImage).toHaveBeenCalled();
      // 호버 진행도 충전 게이지 fillRect 또는 fill 호출
      expect(ctx.fill).toHaveBeenCalled();
    });
  });
});
