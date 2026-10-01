import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { MenuRenderer, type MenuState } from '../../src/ui/MenuRenderer.js';
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
    measureText: vi.fn().mockReturnValue({ width: 50 }),
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
  // IHDR chunk is right after signature: 4 bytes length, 4 bytes 'IHDR', 4 bytes width, 4 bytes height
  const ihdrType = buf.slice(12, 16).toString('ascii');
  expect(ihdrType).toBe('IHDR');
  const width = buf.readUInt32BE(16);
  const height = buf.readUInt32BE(20);
  return { width, height };
}

describe('[UI-ASSET-001 / #266] 메뉴 화면 이미지 에셋 및 MenuRenderer 렌더링', () => {
  const menuAssetDir = path.resolve(process.cwd(), 'public/assets/ui/menu');

  beforeEach(() => {
    imageLoader.clear();
  });

  afterEach(() => {
    imageLoader.clear();
    vi.restoreAllMocks();
  });

  describe('1. 에셋 파일 생성 및 규격 검증', () => {
    it('public/assets/ui/menu/ 디렉토리에 5개 필수 이미지 에셋이 존재한다', () => {
      const files = [
        'title_bg.png',
        'chapter_card_frame.png',
        'lock_icon.png',
        'star_full.png',
        'star_empty.png',
      ];

      for (const file of files) {
        const fullPath = path.join(menuAssetDir, file);
        expect(fs.existsSync(fullPath), `파일이 존재해야 합니다: ${file}`).toBe(true);
        const stat = fs.statSync(fullPath);
        expect(stat.size).toBeGreaterThan(0);
      }
    });

    it('각 PNG 파일이 유효한 PNG 시그니처 및 지정된 해상도 규격을 만족한다', () => {
      const specs = [
        { file: 'title_bg.png', width: 1080, height: 300 },
        { file: 'chapter_card_frame.png', width: 360, height: 380 },
        { file: 'lock_icon.png', width: 96, height: 96 },
        { file: 'star_full.png', width: 64, height: 64 },
        { file: 'star_empty.png', width: 64, height: 64 },
      ];

      for (const spec of specs) {
        const fullPath = path.join(menuAssetDir, spec.file);
        const { width, height } = readPngDimensions(fullPath);
        expect(width).toBe(spec.width);
        expect(height).toBe(spec.height);
      }
    });
  });

  describe('2. UI_IMAGE_ASSETS.menu 설정 연동 검증', () => {
    it('UI_IMAGE_ASSETS.menu에 신규 에셋 경로가 등록되어 있다', () => {
      expect(UI_IMAGE_ASSETS.menu.titleBg).toBe('/assets/ui/menu/title_bg.png');
      expect(UI_IMAGE_ASSETS.menu.cardFrame).toBe('/assets/ui/menu/chapter_card_frame.png');
      expect(UI_IMAGE_ASSETS.menu.lockIcon).toBe('/assets/ui/menu/lock_icon.png');
      expect(UI_IMAGE_ASSETS.menu.starFull).toBe('/assets/ui/menu/star_full.png');
      expect(UI_IMAGE_ASSETS.menu.starEmpty).toBe('/assets/ui/menu/star_empty.png');
    });

    it('기존 레거시 키(banner, background)는 하위 호환성을 위해 유지된다', () => {
      expect(UI_IMAGE_ASSETS.menu).toHaveProperty('background');
      expect(UI_IMAGE_ASSETS.menu).toHaveProperty('banner');
    });
  });

  describe('3. MenuRenderer 프로시저럴 폴백 검증 (imageLoader null 상태)', () => {
    it('이미지가 로드되지 않은 경우 drawImage를 호출하지 않고 프로시저럴로 렌더링한다', () => {
      const renderer = new MenuRenderer();
      const mockCtx = createMockCtx();
      const state: MenuState = {
        unlockedChapter: 2,
        stars: { 1: 3, 2: 1 },
        selectedChapter: 1,
      };

      renderer.render(mockCtx, 1080, 2160, state);

      // 이미지 drawImage 호출 0회
      expect(mockCtx.drawImage).not.toHaveBeenCalled();

      // 프로시저럴 텍스트 검증
      // 1) 타이틀 폴백 텍스트
      expect(mockCtx.fillText).toHaveBeenCalledWith(
        '꿈속 세계 탐험',
        expect.any(Number),
        expect.any(Number),
      );

      // 2) 별점 텍스트 폴백 (★★★, ★☆☆)
      expect(mockCtx.fillText).toHaveBeenCalledWith(
        '★★★',
        expect.any(Number),
        expect.any(Number),
      );
      expect(mockCtx.fillText).toHaveBeenCalledWith(
        '★☆☆',
        expect.any(Number),
        expect.any(Number),
      );

      // 3) 잠금 아이콘 폴백 (Ch.3, 4, 5는 locked)
      expect(mockCtx.fillText).toHaveBeenCalledWith(
        '🔒',
        expect.any(Number),
        expect.any(Number),
      );
    });
  });

  describe('4. MenuRenderer 비트맵 에셋 렌더링 검증 (imageLoader 주입 상태)', () => {
    it('titleBg 이미지가 존재하면 drawImage로 타이틀 배너를 렌더링한다', () => {
      const renderer = new MenuRenderer();
      const mockCtx = createMockCtx();
      const state: MenuState = {
        unlockedChapter: 1,
        stars: { 1: 2 },
        selectedChapter: 1,
      };

      const titleBgImg = createMockImage(1080, 300);
      imageLoader.setImage('menu', 'titleBg', titleBgImg);

      renderer.render(mockCtx, 1080, 2160, state);

      expect(mockCtx.drawImage).toHaveBeenCalledWith(
        titleBgImg,
        expect.any(Number),
        expect.any(Number),
        expect.any(Number),
        expect.any(Number),
      );
    });

    it('cardFrame 이미지가 존재하면 카드 5개에 대해 drawImage를 호출한다', () => {
      const renderer = new MenuRenderer();
      const mockCtx = createMockCtx();
      const state: MenuState = {
        unlockedChapter: 1,
        stars: { 1: 1 },
        selectedChapter: 1,
      };

      const cardFrameImg = createMockImage(360, 380);
      imageLoader.setImage('menu', 'cardFrame', cardFrameImg);

      renderer.render(mockCtx, 1080, 2160, state);

      // 5개 챕터 카드 각각에 대해 cardFrame drawImage 호출
      const calls = (mockCtx.drawImage as any).mock.calls.filter(
        (call: any[]) => call[0] === cardFrameImg,
      );
      expect(calls.length).toBe(5);
    });

    it('lockIcon 이미지가 존재하면 잠긴 챕터(Ch.2~5)에 대해 drawImage를 호출한다', () => {
      const renderer = new MenuRenderer();
      const mockCtx = createMockCtx();
      const state: MenuState = {
        unlockedChapter: 1,
        stars: { 1: 3 },
        selectedChapter: 1,
      };

      const lockIconImg = createMockImage(96, 96);
      imageLoader.setImage('menu', 'lockIcon', lockIconImg);

      renderer.render(mockCtx, 1080, 2160, state);

      // Ch.2, 3, 4, 5 (4개)가 잠김 상태
      const lockCalls = (mockCtx.drawImage as any).mock.calls.filter(
        (call: any[]) => call[0] === lockIconImg,
      );
      expect(lockCalls.length).toBe(4);

      // 프로시저럴 🔒 텍스트는 호출되지 않아야 함
      const textCalls = (mockCtx.fillText as any).mock.calls.filter(
        (call: any[]) => call[0] === '🔒',
      );
      expect(textCalls.length).toBe(0);
    });

    it('starFull / starEmpty 이미지가 존재하면 해금된 챕터의 별을 drawImage로 렌더링한다', () => {
      const renderer = new MenuRenderer();
      const mockCtx = createMockCtx();
      const state: MenuState = {
        unlockedChapter: 2,
        stars: { 1: 2, 2: 1 }, // Ch.1: 2개 full, 1개 empty / Ch.2: 1개 full, 2개 empty
        selectedChapter: 1,
      };

      const starFullImg = createMockImage(64, 64);
      const starEmptyImg = createMockImage(64, 64);
      imageLoader.setImage('menu', 'starFull', starFullImg);
      imageLoader.setImage('menu', 'starEmpty', starEmptyImg);

      renderer.render(mockCtx, 1080, 2160, state);

      const fullCalls = (mockCtx.drawImage as any).mock.calls.filter(
        (call: any[]) => call[0] === starFullImg,
      );
      const emptyCalls = (mockCtx.drawImage as any).mock.calls.filter(
        (call: any[]) => call[0] === starEmptyImg,
      );

      // Ch.1 (2 full + 1 empty) + Ch.2 (1 full + 2 empty) = 3 full, 3 empty
      expect(fullCalls.length).toBe(3);
      expect(emptyCalls.length).toBe(3);

      // 프로시저럴 ★ 문자열 fillText는 호출되지 않아야 함
      const starTextCalls = (mockCtx.fillText as any).mock.calls.filter(
        (call: any[]) => typeof call[0] === 'string' && (call[0].includes('★') || call[0].includes('☆')),
      );
      expect(starTextCalls.length).toBe(0);
    });
  });
});
