import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import {
  BossClimaxRenderer,
  type BossClimaxRenderState,
} from '../../src/render/BossClimaxRenderer.js';
import { imageLoader } from '../../src/utils/UIImageLoader.js';
import { UI_IMAGE_ASSETS } from '../../config/ui.config.js';

function createMockImage(w = 256, h = 256): HTMLImageElement {
  return {
    src: 'mock_guardian.png',
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
    fillText: vi.fn(),
    strokeText: vi.fn(),
    fillRect: vi.fn(),
    strokeRect: vi.fn(),
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
    measureText: vi.fn(() => ({ width: 80 })),
  } as unknown as CanvasRenderingContext2D;
}

function readPngDimensions(filePath: string): { width: number; height: number } {
  const buf = fs.readFileSync(filePath);
  expect(buf.slice(0, 8).toString('hex')).toBe('89504e470d0a1a0a');
  const ihdrType = buf.slice(12, 16).toString('ascii');
  expect(ihdrType).toBe('IHDR');
  const width = buf.readUInt32BE(16);
  const height = buf.readUInt32BE(20);
  return { width, height };
}

describe('[UI-ASSET-006 / #271] 수호신 캐릭터 이미지 에셋 제작 및 BossClimaxRenderer 연동', () => {
  const guardianAssetDir = path.resolve(process.cwd(), 'public/assets/guardian');

  beforeEach(() => {
    imageLoader.clear();
  });

  afterEach(() => {
    imageLoader.clear();
    vi.restoreAllMocks();
  });

  describe('1. 11종 수호신 이미지 에셋 파일 생성 및 규격 검증', () => {
    const expectedAssets = [
      // Stage 1: 빛 구슬 요정 (128x128)
      { stage: 'stage1', file: 'idle.png', w: 128, h: 128 },
      { stage: 'stage1', file: 'cast.png', w: 128, h: 128 },
      // Stage 2: 작은 날개 깨비 (192x192)
      { stage: 'stage2', file: 'idle.png', w: 192, h: 192 },
      { stage: 'stage2', file: 'cast.png', w: 192, h: 192 },
      // Stage 3: 중간 수호신 깨비 (256x256)
      { stage: 'stage3', file: 'idle.png', w: 256, h: 256 },
      { stage: 'stage3', file: 'cast.png', w: 256, h: 256 },
      { stage: 'stage3', file: 'shield.png', w: 256, h: 256 },
      // Stage 4: 완전체 대수호신 깨비 (320x320)
      { stage: 'stage4', file: 'idle.png', w: 320, h: 320 },
      { stage: 'stage4', file: 'cast.png', w: 320, h: 320 },
      { stage: 'stage4', file: 'shield.png', w: 320, h: 320 },
      { stage: 'stage4', file: 'ultimate.png', w: 320, h: 320 },
    ];

    it('총 11개 수호신 스프라이트 파일이 public/assets/guardian/ 하위 단계별 폴더에 존재한다', () => {
      for (const asset of expectedAssets) {
        const fullPath = path.join(guardianAssetDir, asset.stage, asset.file);
        expect(fs.existsSync(fullPath), `에셋 파일이 존재해야 합니다: ${asset.stage}/${asset.file}`).toBe(true);
        const stat = fs.statSync(fullPath);
        expect(stat.size).toBeGreaterThan(0);
      }
    });

    it('각 PNG 파일이 유효한 PNG 시그니처 및 지정된 해상도(128/192/256/320)를 만족한다', () => {
      for (const asset of expectedAssets) {
        const fullPath = path.join(guardianAssetDir, asset.stage, asset.file);
        const { width, height } = readPngDimensions(fullPath);
        expect(width).toBe(asset.w);
        expect(height).toBe(asset.h);
      }
    });
  });

  describe('2. UI_IMAGE_ASSETS.guardian 설정 연동 검증', () => {
    it('UI_IMAGE_ASSETS에 guardian 카테고리가 존재하고 11개 에셋 경로가 올바르게 등록되어 있다', () => {
      expect(UI_IMAGE_ASSETS).toHaveProperty('guardian');
      const guardianAssets = (UI_IMAGE_ASSETS as any).guardian;

      expect(guardianAssets.stage1_idle).toBe('/assets/guardian/stage1/idle.png');
      expect(guardianAssets.stage1_cast).toBe('/assets/guardian/stage1/cast.png');

      expect(guardianAssets.stage2_idle).toBe('/assets/guardian/stage2/idle.png');
      expect(guardianAssets.stage2_cast).toBe('/assets/guardian/stage2/cast.png');

      expect(guardianAssets.stage3_idle).toBe('/assets/guardian/stage3/idle.png');
      expect(guardianAssets.stage3_cast).toBe('/assets/guardian/stage3/cast.png');
      expect(guardianAssets.stage3_shield).toBe('/assets/guardian/stage3/shield.png');

      expect(guardianAssets.stage4_idle).toBe('/assets/guardian/stage4/idle.png');
      expect(guardianAssets.stage4_cast).toBe('/assets/guardian/stage4/cast.png');
      expect(guardianAssets.stage4_shield).toBe('/assets/guardian/stage4/shield.png');
      expect(guardianAssets.stage4_ultimate).toBe('/assets/guardian/stage4/ultimate.png');
    });
  });

  describe('3. BossClimaxRenderer 수호신 스프라이트 이미지 연동 및 상태별 분기', () => {
    const baseState: BossClimaxRenderState = {
      bossHp: 10,
      bossMaxHp: 10,
      isEnraged: false,
      minionCount: 3,
      guardianStage: 1,
      stardust: 15,
      feverCombo: 0,
      hazard: null,
      barrageActive: false,
      barrageProgress: 0,
      elapsedTime: 1.0,
    };

    it('기본(idle) 상태에서 각 stage에 맞는 idle 스프라이트가 drawImage로 렌더링된다', () => {
      const renderer = new BossClimaxRenderer();

      for (let stage = 1; stage <= 4; stage++) {
        imageLoader.clear();
        const mockImg = createMockImage(128, 128);
        imageLoader.setImage('guardian', `stage${stage}_idle`, mockImg);

        const ctx = createMockCtx();
        renderer.render(ctx, 1080, 2160, {
          ...baseState,
          guardianStage: stage,
          barrageActive: false,
        });

        expect(ctx.drawImage).toHaveBeenCalledTimes(1);
        const [imgArg] = vi.mocked(ctx.drawImage).mock.calls[0];
        expect(imgArg).toBe(mockImg);
      }
    });

    it('마법 탄막 발사 중(barrageActive=true)일 때 stage1~3은 cast 스프라이트가 렌더링된다', () => {
      const renderer = new BossClimaxRenderer();

      for (let stage = 1; stage <= 3; stage++) {
        imageLoader.clear();
        const idleImg = createMockImage(128, 128);
        const castImg = createMockImage(128, 128);
        imageLoader.setImage('guardian', `stage${stage}_idle`, idleImg);
        imageLoader.setImage('guardian', `stage${stage}_cast`, castImg);

        const ctx = createMockCtx();
        renderer.render(ctx, 1080, 2160, {
          ...baseState,
          guardianStage: stage,
          barrageActive: true,
          barrageProgress: 0.5,
        });

        expect(ctx.drawImage).toHaveBeenCalledTimes(1);
        const [imgArg] = vi.mocked(ctx.drawImage).mock.calls[0];
        expect(imgArg).toBe(castImg);
      }
    });

    it('stage 4에서 barrageActive=true일 때 ultimate 스프라이트가 우선 렌더링된다', () => {
      const renderer = new BossClimaxRenderer();
      const idleImg = createMockImage(320, 320);
      const castImg = createMockImage(320, 320);
      const ultImg = createMockImage(320, 320);

      imageLoader.setImage('guardian', 'stage4_idle', idleImg);
      imageLoader.setImage('guardian', 'stage4_cast', castImg);
      imageLoader.setImage('guardian', 'stage4_ultimate', ultImg);

      const ctx = createMockCtx();
      renderer.render(ctx, 1080, 2160, {
        ...baseState,
        guardianStage: 4,
        barrageActive: true,
        barrageProgress: 0.7,
      });

      expect(ctx.drawImage).toHaveBeenCalledTimes(1);
      const [imgArg] = vi.mocked(ctx.drawImage).mock.calls[0];
      expect(imgArg).toBe(ultImg);
    });

    it('stage 4에서 ultimate 이미지가 없을 경우 stage4_cast로 안전하게 fallback 시도한다', () => {
      const renderer = new BossClimaxRenderer();
      const castImg = createMockImage(320, 320);
      // ultimate 이미지는 등록하지 않음
      imageLoader.setImage('guardian', 'stage4_cast', castImg);

      const ctx = createMockCtx();
      renderer.render(ctx, 1080, 2160, {
        ...baseState,
        guardianStage: 4,
        barrageActive: true,
      });

      expect(ctx.drawImage).toHaveBeenCalledTimes(1);
      const [imgArg] = vi.mocked(ctx.drawImage).mock.calls[0];
      expect(imgArg).toBe(castImg);
    });

    it('방어 상태(isShieldActive=true)일 때 stage 3과 4에서 shield 스프라이트가 렌더링된다', () => {
      const renderer = new BossClimaxRenderer();

      for (const stage of [3, 4]) {
        imageLoader.clear();
        const idleImg = createMockImage(256, 256);
        const shieldImg = createMockImage(256, 256);
        imageLoader.setImage('guardian', `stage${stage}_idle`, idleImg);
        imageLoader.setImage('guardian', `stage${stage}_shield`, shieldImg);

        const ctx = createMockCtx();
        renderer.render(ctx, 1080, 2160, {
          ...baseState,
          guardianStage: stage,
          isShieldActive: true,
        });

        expect(ctx.drawImage).toHaveBeenCalledTimes(1);
        const [imgArg] = vi.mocked(ctx.drawImage).mock.calls[0];
        expect(imgArg).toBe(shieldImg);
      }
    });

    it('비정방형 이미지더라도 중심 (cx, cy) 기준 종횡비를 보존하며 drawImage로 렌더링된다', () => {
      const renderer = new BossClimaxRenderer();
      // 가로가 2배 긴 이미지 (400 x 200) -> aspect 2.0
      const wideImg = createMockImage(400, 200);
      imageLoader.setImage('guardian', 'stage2_idle', wideImg);

      const ctx = createMockCtx();
      renderer.render(ctx, 1080, 2160, {
        ...baseState,
        guardianStage: 2,
        barrageActive: false,
      });

      expect(ctx.drawImage).toHaveBeenCalledTimes(1);
      const [imgArg, dx, dy, dw, dh] = vi.mocked(ctx.drawImage).mock.calls[0] as unknown as [HTMLImageElement, number, number, number, number];
      expect(imgArg).toBe(wideImg);

      const guardianPos = renderer.getGuardianPosition(1080, 2160);
      // 중심 위치 검증 (dx + dw/2 === cx, dy + dh/2 === cy)
      const expectedCx = guardianPos.x;
      const expectedCy = guardianPos.y + Math.sin(baseState.elapsedTime * 2.8) * 8;
      expect(dx + dw / 2).toBeCloseTo(expectedCx, 1);
      expect(dy + dh / 2).toBeCloseTo(expectedCy, 1);

      // 종횡비 검증: dw / dh === 2.0
      expect(dw / dh).toBeCloseTo(2.0, 2);
    });
  });

  describe('4. 프로시저럴 드로잉 100% 완벽 폴백 보존 검증', () => {
    const baseState: BossClimaxRenderState = {
      bossHp: 10,
      bossMaxHp: 10,
      isEnraged: false,
      minionCount: 3,
      guardianStage: 1,
      stardust: 15,
      feverCombo: 0,
      hazard: null,
      barrageActive: false,
      barrageProgress: 0,
      elapsedTime: 1.0,
    };

    it('imageLoader에 이미지가 없을 때 drawImage를 호출하지 않고 기존 프로시저럴 드로잉(발광 원, 날개, 텍스트)을 정상 수행한다', () => {
      const renderer = new BossClimaxRenderer();

      for (let stage = 1; stage <= 4; stage++) {
        const ctx = createMockCtx();
        expect(() =>
          renderer.render(ctx, 1080, 2160, {
            ...baseState,
            guardianStage: stage,
          })
        ).not.toThrow();

        // drawImage는 호출되지 않아야 함 (미니언 및 수호신 둘 다 프로시저럴)
        expect(ctx.drawImage).not.toHaveBeenCalled();

        // 기존 프로시저럴 날개 ellipse 및 수호신 라벨 text 호출 확인
        expect(ctx.ellipse).toHaveBeenCalled();
        const textCalls = vi.mocked(ctx.fillText).mock.calls.map((c) => c[0]);
        expect(textCalls.some((t) => typeof t === 'string' && t.includes('수호신'))).toBe(true);
      }
    });

    it('일부 스프라이트가 누락된 경우에도 콘솔 에러 없이 안전하게 프로시저럴 폴백을 유지한다', () => {
      const renderer = new BossClimaxRenderer();
      // stage3_cast 이미지만 없는 상태에서 barrageActive
      const idleImg = createMockImage(256, 256);
      imageLoader.setImage('guardian', 'stage3_idle', idleImg);

      const ctx = createMockCtx();
      expect(() =>
        renderer.render(ctx, 1080, 2160, {
          ...baseState,
          guardianStage: 3,
          barrageActive: true,
        })
      ).not.toThrow();

      // cast 이미지가 없으므로 프로시저럴 폴백 작동
      expect(ctx.drawImage).not.toHaveBeenCalled();
      expect(ctx.ellipse).toHaveBeenCalled();
    });
  });
});
