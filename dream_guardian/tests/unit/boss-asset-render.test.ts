import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { BossRenderer } from '../../src/render/BossRenderer.js';
import { imageLoader } from '../../src/utils/UIImageLoader.js';
import { UI_IMAGE_ASSETS } from '../../config/ui.config.js';

function createMockImage(w = 256, h = 256): HTMLImageElement {
  return {
    src: 'mock_boss.png',
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
    translate: vi.fn(),
    scale: vi.fn(),
    rotate: vi.fn(),
    beginPath: vi.fn(),
    closePath: vi.fn(),
    arc: vi.fn(),
    ellipse: vi.fn(),
    fill: vi.fn(),
    stroke: vi.fn(),
    moveTo: vi.fn(),
    lineTo: vi.fn(),
    quadraticCurveTo: vi.fn(),
    fillText: vi.fn(),
    setLineDash: vi.fn(),
    drawImage: vi.fn(),
    createRadialGradient: vi.fn(() => ({
      addColorStop: vi.fn(),
    })),
    createLinearGradient: vi.fn(() => ({
      addColorStop: vi.fn(),
    })),
    globalAlpha: 1,
    globalCompositeOperation: 'source-over',
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

function readPngDimensions(filePath: string): { width: number; height: number } {
  const buf = fs.readFileSync(filePath);
  // PNG signature: 89 50 4E 47 0D 0A 1A 0A
  expect(buf.slice(0, 8).toString('hex')).toBe('89504e470d0a1a0a');
  const ihdrType = buf.slice(12, 16).toString('ascii');
  expect(ihdrType).toBe('IHDR');
  const width = buf.readUInt32BE(16);
  const height = buf.readUInt32BE(20);
  return { width, height };
}

describe('[UI-ASSET-005 / #270] 보스 캐릭터 이미지 에셋 제작 및 BossRenderer 연동', () => {
  const bossAssetDir = path.resolve(process.cwd(), 'public/assets/boss');

  beforeEach(() => {
    imageLoader.clear();
  });

  afterEach(() => {
    imageLoader.clear();
    vi.restoreAllMocks();
  });

  describe('1. 16종 보스 이미지 에셋 파일 생성 및 규격 검증', () => {
    const expectedAssets = [
      // Ch.1 포겟 (256x256)
      { ch: 'ch1', file: 'idle.png', w: 256, h: 256 },
      { ch: 'ch1', file: 'hit.png', w: 256, h: 256 },
      { ch: 'ch1', file: 'enrage.png', w: 256, h: 256 },
      // Ch.2 후다닥 (256x256)
      { ch: 'ch2', file: 'idle.png', w: 256, h: 256 },
      { ch: 'ch2', file: 'hit.png', w: 256, h: 256 },
      { ch: 'ch2', file: 'enrage.png', w: 256, h: 256 },
      // Ch.3 뒤죽박죽 (256x256)
      { ch: 'ch3', file: 'idle.png', w: 256, h: 256 },
      { ch: 'ch3', file: 'hit.png', w: 256, h: 256 },
      { ch: 'ch3', file: 'enrage.png', w: 256, h: 256 },
      // Ch.4 에라 (256x256)
      { ch: 'ch4', file: 'idle.png', w: 256, h: 256 },
      { ch: 'ch4', file: 'hit.png', w: 256, h: 256 },
      { ch: 'ch4', file: 'enrage.png', w: 256, h: 256 },
      // Ch.5 나이트메어 (384x384)
      { ch: 'ch5', file: 'idle.png', w: 384, h: 384 },
      { ch: 'ch5', file: 'hit.png', w: 384, h: 384 },
      { ch: 'ch5', file: 'enrage.png', w: 384, h: 384 },
      { ch: 'ch5', file: 'defeat.png', w: 384, h: 384 },
    ];

    it('총 16개 보스 스프라이트 파일이 public/assets/boss/ 하위 챕터별 폴더에 존재한다', () => {
      for (const asset of expectedAssets) {
        const fullPath = path.join(bossAssetDir, asset.ch, asset.file);
        expect(fs.existsSync(fullPath), `에셋 파일이 존재해야 합니다: ${asset.ch}/${asset.file}`).toBe(true);
        const stat = fs.statSync(fullPath);
        expect(stat.size).toBeGreaterThan(0);
      }
    });

    it('각 PNG 파일이 유효한 PNG 시그니처 및 지정된 해상도(256x256 / 384x384)를 만족한다', () => {
      for (const asset of expectedAssets) {
        const fullPath = path.join(bossAssetDir, asset.ch, asset.file);
        const { width, height } = readPngDimensions(fullPath);
        expect(width).toBe(asset.w);
        expect(height).toBe(asset.h);
      }
    });
  });

  describe('2. UI_IMAGE_ASSETS.boss 설정 연동 검증', () => {
    it('UI_IMAGE_ASSETS에 boss 카테고리가 존재하고 16개 에셋 경로가 올바르게 등록되어 있다', () => {
      expect(UI_IMAGE_ASSETS).toHaveProperty('boss');
      const bossAssets = UI_IMAGE_ASSETS.boss;

      expect(bossAssets.ch1_idle).toBe('/assets/boss/ch1/idle.png');
      expect(bossAssets.ch1_hit).toBe('/assets/boss/ch1/hit.png');
      expect(bossAssets.ch1_enrage).toBe('/assets/boss/ch1/enrage.png');

      expect(bossAssets.ch2_idle).toBe('/assets/boss/ch2/idle.png');
      expect(bossAssets.ch2_hit).toBe('/assets/boss/ch2/hit.png');
      expect(bossAssets.ch2_enrage).toBe('/assets/boss/ch2/enrage.png');

      expect(bossAssets.ch3_idle).toBe('/assets/boss/ch3/idle.png');
      expect(bossAssets.ch3_hit).toBe('/assets/boss/ch3/hit.png');
      expect(bossAssets.ch3_enrage).toBe('/assets/boss/ch3/enrage.png');

      expect(bossAssets.ch4_idle).toBe('/assets/boss/ch4/idle.png');
      expect(bossAssets.ch4_hit).toBe('/assets/boss/ch4/hit.png');
      expect(bossAssets.ch4_enrage).toBe('/assets/boss/ch4/enrage.png');

      expect(bossAssets.ch5_idle).toBe('/assets/boss/ch5/idle.png');
      expect(bossAssets.ch5_hit).toBe('/assets/boss/ch5/hit.png');
      expect(bossAssets.ch5_enrage).toBe('/assets/boss/ch5/enrage.png');
      expect(bossAssets.ch5_defeat).toBe('/assets/boss/ch5/defeat.png');
    });
  });

  describe('3. BossRenderer 이미지 연동 및 상태별 스프라이트 분기', () => {
    it('이미지가 캐시되어 있을 때 기본(idle) 스프라이트가 drawImage로 렌더링된다', () => {
      const renderer = new BossRenderer();
      const mockImg = createMockImage(256, 256);
      imageLoader.setImage('boss', 'ch1_idle', mockImg);

      const ctx = createMockCtx();
      renderer.render(ctx, 1, 400, 200, 80, 'idle');

      // drawImage 호출 검증: 중심 기준 (-radius, -radius, radius * 2, radius * 2)
      expect(ctx.drawImage).toHaveBeenCalledTimes(1);
      expect(ctx.drawImage).toHaveBeenCalledWith(mockImg, -80, -80, 160, 160);
    });

    it('hit 상태(_hitTimer > 0 또는 triggerHit)일 때 hit 스프라이트가 렌더링된다', () => {
      const renderer = new BossRenderer();
      const idleImg = createMockImage(256, 256);
      const hitImg = createMockImage(256, 256);
      imageLoader.setImage('boss', 'ch2_idle', idleImg);
      imageLoader.setImage('boss', 'ch2_hit', hitImg);

      renderer.triggerHit();

      const ctx = createMockCtx();
      renderer.render(ctx, 2, 400, 200, 70, 'idle');

      expect(ctx.drawImage).toHaveBeenCalledWith(hitImg, -70, -70, 140, 140);
    });

    it('phase가 attacking이거나 isEnraged일 때 enrage 스프라이트가 렌더링된다', () => {
      const renderer = new BossRenderer();
      const idleImg = createMockImage(256, 256);
      const enrageImg = createMockImage(256, 256);
      imageLoader.setImage('boss', 'ch3_idle', idleImg);
      imageLoader.setImage('boss', 'ch3_enrage', enrageImg);

      // 1) phase === 'attacking'
      const ctx1 = createMockCtx();
      renderer.render(ctx1, 3, 400, 200, 90, 'attacking');
      expect(ctx1.drawImage).toHaveBeenCalledWith(enrageImg, -90, -90, 180, 180);

      // 2) isEnraged = true 매개변수
      const ctx2 = createMockCtx();
      renderer.render(ctx2, 3, 400, 200, 90, 'idle', true);
      expect(ctx2.drawImage).toHaveBeenCalledWith(enrageImg, -90, -90, 180, 180);

      // 3) setEnraged(true) 메소드 호출
      renderer.setEnraged(true);
      const ctx3 = createMockCtx();
      renderer.render(ctx3, 3, 400, 200, 90, 'idle');
      expect(ctx3.drawImage).toHaveBeenCalledWith(enrageImg, -90, -90, 180, 180);
    });

    it('phase가 defeated일 때 Ch.5의 경우 defeat 스프라이트가 렌더링된다', () => {
      const renderer = new BossRenderer();
      const defeatImg = createMockImage(384, 384);
      imageLoader.setImage('boss', 'ch5_defeat', defeatImg);

      const ctx = createMockCtx();
      renderer.render(ctx, 5, 540, 300, 120, 'defeated');

      expect(ctx.drawImage).toHaveBeenCalledWith(defeatImg, -120, -120, 240, 240);
    });

    it('비정방형 이미지인 경우에도 종횡비를 유지하며 중심 기준 렌더링된다', () => {
      const renderer = new BossRenderer();
      // 가로가 긴 이미지 (300 x 150) -> w: 160, h: 80
      const wideImg = createMockImage(300, 150);
      imageLoader.setImage('boss', 'ch4_idle', wideImg);

      const ctx = createMockCtx();
      renderer.render(ctx, 4, 400, 200, 80, 'idle');

      expect(ctx.drawImage).toHaveBeenCalledWith(wideImg, -80, -40, 160, 80);
    });
  });

  describe('4. 프로시저럴 드로잉 100% 폴백 보존 검증', () => {
    it('이미지가 로드되지 않은 경우 drawImage를 호출하지 않고 기존 프로시저럴 렌더링을 정상 수행한다', () => {
      const renderer = new BossRenderer();
      // imageLoader에 이미지가 없는 상태
      const chapters = [1, 2, 3, 4, 5];

      for (const ch of chapters) {
        const ctx = createMockCtx();
        expect(() => renderer.render(ctx, ch, 400, 200, 80, 'idle')).not.toThrow();
        expect(ctx.drawImage).not.toHaveBeenCalled();
        expect(ctx.save).toHaveBeenCalled();
        expect(ctx.restore).toHaveBeenCalled();
        expect((ctx.fill as any).mock.calls.length + (ctx.stroke as any).mock.calls.length).toBeGreaterThan(0);
      }
    });

    it('특정 상태 스프라이트가 없을 때에도 에러 없이 동작한다', () => {
      const renderer = new BossRenderer();
      // hit 이미지가 없을 때
      renderer.triggerHit();
      const ctx = createMockCtx();
      expect(() => renderer.render(ctx, 1, 400, 200, 80, 'idle')).not.toThrow();
      expect(ctx.drawImage).not.toHaveBeenCalled();
    });
  });
});
