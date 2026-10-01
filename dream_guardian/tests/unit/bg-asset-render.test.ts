import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { DreamGrid } from '../../src/render/DreamGrid.js';
import { UI_IMAGE_ASSETS } from '../../config/ui.config.js';
import { imageLoader } from '../../src/utils/UIImageLoader.js';

function createMockImage(w = 1080, h = 2160): HTMLImageElement {
  return {
    src: 'mock_bg.png',
    width: w,
    height: h,
    naturalWidth: w,
    naturalHeight: h,
    complete: true,
  } as unknown as HTMLImageElement;
}

function createMockCtx(): CanvasRenderingContext2D & { fillStyles: string[] } {
  const fillStyles: string[] = [];
  let _fillStyle: any = '';
  const ctx = {
    save: vi.fn(),
    restore: vi.fn(),
    beginPath: vi.fn(),
    closePath: vi.fn(),
    arc: vi.fn(),
    fill: vi.fn(),
    stroke: vi.fn(),
    moveTo: vi.fn(),
    lineTo: vi.fn(),
    fillRect: vi.fn((_x: number, _y: number, _w: number, _h: number) => {
      fillStyles.push(_fillStyle);
    }),
    strokeRect: vi.fn(),
    drawImage: vi.fn(),
    createRadialGradient: vi.fn(() => ({
      addColorStop: vi.fn(),
    })),
    createLinearGradient: vi.fn(() => ({
      addColorStop: vi.fn(),
    })),
    globalAlpha: 1,
    get fillStyle() {
      return _fillStyle;
    },
    set fillStyle(val: any) {
      _fillStyle = val;
    },
    strokeStyle: '',
    lineWidth: 1,
    fillStyles,
  };
  return ctx as unknown as CanvasRenderingContext2D & { fillStyles: string[] };
}

function readPngDimensions(filePath: string): { width: number; height: number } {
  const buf = fs.readFileSync(filePath);
  // PNG signature: 89 50 4E 47 0D 0A 1A 0A
  expect(buf.subarray(0, 8).toString('hex')).toBe('89504e470d0a1a0a');
  // IHDR chunk: 4 bytes len, 4 bytes IHDR, 4 bytes width, 4 bytes height
  const ihdrType = buf.subarray(12, 16).toString('ascii');
  expect(ihdrType).toBe('IHDR');
  const width = buf.readUInt32BE(16);
  const height = buf.readUInt32BE(20);
  return { width, height };
}

describe('[UI-ASSET-007 / #272] 챕터별 배경 이미지 에셋 제작 및 DreamGrid 연동', () => {
  const bgDir = path.resolve(process.cwd(), 'public/assets/bg');

  beforeEach(() => {
    imageLoader.clear();
  });

  afterEach(() => {
    imageLoader.clear();
    vi.restoreAllMocks();
  });

  describe('1. 6개 배경 이미지 에셋 파일 생성 및 1080x2160 규격 검증', () => {
    const EXPECTED_BG_FILES = [
      'menu_bg.png',
      'ch1_bg.png',
      'ch2_bg.png',
      'ch3_bg.png',
      'ch4_bg.png',
      'ch5_bg.png',
    ];

    it('public/assets/bg/ 디렉토리에 6개 필수 배경 에셋 파일이 모두 존재한다', () => {
      expect(fs.existsSync(bgDir)).toBe(true);

      for (const fileName of EXPECTED_BG_FILES) {
        const filePath = path.join(bgDir, fileName);
        expect(fs.existsSync(filePath), `에셋 파일 누락: ${fileName}`).toBe(true);
        const stat = fs.statSync(filePath);
        expect(stat.size, `에셋 파일 크기 0바이트 이상: ${fileName}`).toBeGreaterThan(100);
      }
    });

    it('모든 배경 에셋 파일이 가로 1080px, 세로 2160px의 유효한 PNG 바이너리이다', () => {
      for (const fileName of EXPECTED_BG_FILES) {
        const filePath = path.join(bgDir, fileName);
        const { width, height } = readPngDimensions(filePath);
        expect(width, `${fileName} 가로 폭은 1080이어야 함`).toBe(1080);
        expect(height, `${fileName} 세로 높이는 2160이어야 함`).toBe(2160);
      }
    });
  });

  describe('2. UI_IMAGE_ASSETS.bg 설정 연동 검증', () => {
    it('UI_IMAGE_ASSETS에 bg 카테고리가 정의되어 있고 6개 슬롯 경로가 정확히 등록되어 있다', () => {
      expect(UI_IMAGE_ASSETS).toHaveProperty('bg');
      const bgAssets = (UI_IMAGE_ASSETS as any).bg;

      expect(bgAssets.menu).toBe('/assets/bg/menu_bg.png');
      expect(bgAssets.ch1).toBe('/assets/bg/ch1_bg.png');
      expect(bgAssets.ch2).toBe('/assets/bg/ch2_bg.png');
      expect(bgAssets.ch3).toBe('/assets/bg/ch3_bg.png');
      expect(bgAssets.ch4).toBe('/assets/bg/ch4_bg.png');
      expect(bgAssets.ch5).toBe('/assets/bg/ch5_bg.png');
    });

    it('UIImageLoader를 통해 bg 카테고리 이미지를 get/setImage 할 수 있다', () => {
      const mockMenuBg = createMockImage();
      const mockCh1Bg = createMockImage();

      imageLoader.setImage('bg', 'menu', mockMenuBg);
      imageLoader.setImage('bg', 'ch1', mockCh1Bg);

      expect(imageLoader.get('bg', 'menu')).toBe(mockMenuBg);
      expect(imageLoader.get('bg', 'ch1')).toBe(mockCh1Bg);
      expect(imageLoader.get('bg', 'ch2')).toBeNull();
    });
  });

  describe('3. DreamGrid 배경 이미지 및 디밍 오버레이 렌더링 검증', () => {
    it('bgImage가 주어졌을 때 ctx.drawImage로 배경을 그리고 디밍 오버레이(fillRect)를 렌더링한다', () => {
      const grid = new DreamGrid();
      const ctx = createMockCtx();
      const mockBg = createMockImage();

      grid.render(ctx, 1080, 2160, {
        bgImage: mockBg,
      });

      // drawImage 호출 검증
      expect(ctx.drawImage).toHaveBeenCalledWith(mockBg, 0, 0, 1080, 2160);

      // 디밍 오버레이 호출 검증 (기본값 0.40 ~ 0.50 범위)
      expect(ctx.fillRect).toHaveBeenCalledWith(0, 0, 1080, 2160);
      expect(ctx.fillStyles[0]).toMatch(/rgba\(0,\s*0,\s*0,\s*0\.[45]\d*\)/);

      // 그 위에 3D 그리드 라인들이 정상적으로 그려지는지 검증
      expect(ctx.stroke).toHaveBeenCalled();
      expect(ctx.save).toHaveBeenCalled();
      expect(ctx.restore).toHaveBeenCalled();
    });

    it('bgDimAlpha 커스텀 설정값이 fillStyle에 올바르게 반영된다', () => {
      const grid = new DreamGrid();
      const ctx = createMockCtx();
      const mockBg = createMockImage();

      grid.render(ctx, 1080, 2160, {
        bgImage: mockBg,
        bgDimAlpha: 0.65,
      });

      expect(ctx.drawImage).toHaveBeenCalledWith(mockBg, 0, 0, 1080, 2160);
      expect(ctx.fillRect).toHaveBeenCalledWith(0, 0, 1080, 2160);
      expect(ctx.fillStyles[0]).toBe('rgba(0, 0, 0, 0.65)');
    });

    it('bgImage가 null 또는 undefined일 때 drawImage 및 디밍 fillRect를 호출하지 않고 기존 그리드만 렌더링한다 (100% 폴백)', () => {
      const grid = new DreamGrid();
      const ctx = createMockCtx();

      grid.render(ctx, 1080, 2160, {
        bgImage: null,
      });

      expect(ctx.drawImage).not.toHaveBeenCalled();
      expect(ctx.fillRect).not.toHaveBeenCalled();
      expect(ctx.stroke).toHaveBeenCalled();
    });

    it('setBgImage 및 setBgDimAlpha 인스턴스 메서드를 통해서도 기본 배경을 설정할 수 있다', () => {
      const grid = new DreamGrid();
      const ctx = createMockCtx();
      const mockBg = createMockImage();

      grid.setBgImage(mockBg);
      grid.setBgDimAlpha(0.5);

      grid.render(ctx, 1080, 2160);

      expect(ctx.drawImage).toHaveBeenCalledWith(mockBg, 0, 0, 1080, 2160);
      expect(ctx.fillRect).toHaveBeenCalledWith(0, 0, 1080, 2160);
      expect(ctx.fillStyles[0]).toBe('rgba(0, 0, 0, 0.5)');
    });
  });

  describe('4. 카메라 피드 활성화 시 배경 미적용 계약 검증', () => {
    it('카메라 피드가 활성화된 경우(cameraLayer.isActive === true) bgImage가 전달되지 않거나 null로 처리된다', () => {
      const cameraActive = true;
      const bgFromLoader = createMockImage();

      // main.ts의 로직 규격: cameraLayer.isActive가 true이면 bgImage는 null
      const selectedBg = !cameraActive ? bgFromLoader : null;

      const grid = new DreamGrid();
      const ctx = createMockCtx();

      grid.render(ctx, 1080, 2160, {
        bgImage: selectedBg,
      });

      expect(ctx.drawImage).not.toHaveBeenCalled();
      expect(ctx.fillRect).not.toHaveBeenCalled();
    });
  });
});
