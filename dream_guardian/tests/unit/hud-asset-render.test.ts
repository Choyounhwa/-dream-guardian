import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { HUDLayer, type HUDData } from '../../src/ui/HUDLayer.js';
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

describe('[UI-ASSET-002 / #267] HUD 이미지 에셋 제작 및 HUDLayer 연동', () => {
  const hudAssetDir = path.resolve(process.cwd(), 'public/assets/ui/hud');

  beforeEach(() => {
    imageLoader.clear();
  });

  afterEach(() => {
    imageLoader.clear();
    vi.restoreAllMocks();
  });

  describe('1. HUD 이미지 에셋 파일 생성 및 규격 검증', () => {
    it('public/assets/ui/hud/ 디렉토리에 5개 필수 이미지 에셋이 존재한다', () => {
      const files = [
        'hp_bar_frame.png',
        'hp_bar_fill_player.png',
        'hp_bar_fill_boss.png',
        'combo_icon.png',
        'boss_nameplate.png',
      ];

      for (const file of files) {
        const fullPath = path.join(hudAssetDir, file);
        expect(fs.existsSync(fullPath), `파일이 존재해야 합니다: ${file}`).toBe(true);
        const stat = fs.statSync(fullPath);
        expect(stat.size).toBeGreaterThan(0);
      }
    });

    it('각 PNG 파일이 유효한 PNG 시그니처 및 지정된 해상도 규격을 만족한다', () => {
      const specs = [
        { file: 'hp_bar_frame.png', width: 320, height: 48 },
        { file: 'hp_bar_fill_player.png', width: 320, height: 48 },
        { file: 'hp_bar_fill_boss.png', width: 320, height: 48 },
        { file: 'combo_icon.png', width: 48, height: 48 },
        { file: 'boss_nameplate.png', width: 400, height: 60 },
      ];

      for (const spec of specs) {
        const fullPath = path.join(hudAssetDir, spec.file);
        const { width, height } = readPngDimensions(fullPath);
        expect(width).toBe(spec.width);
        expect(height).toBe(spec.height);
      }
    });
  });

  describe('2. UI_IMAGE_ASSETS.hud 설정 연동 검증', () => {
    it('UI_IMAGE_ASSETS.hud에 5개 신규 HUD 에셋 경로가 올바르게 등록되어 있다', () => {
      expect(UI_IMAGE_ASSETS.hud.hpBarFrame).toBe('/assets/ui/hud/hp_bar_frame.png');
      expect(UI_IMAGE_ASSETS.hud.hpBarFillPlayer).toBe('/assets/ui/hud/hp_bar_fill_player.png');
      expect(UI_IMAGE_ASSETS.hud.hpBarFillBoss).toBe('/assets/ui/hud/hp_bar_fill_boss.png');
      expect(UI_IMAGE_ASSETS.hud.comboIcon).toBe('/assets/ui/hud/combo_icon.png');
      expect(UI_IMAGE_ASSETS.hud.bossNameplate).toBe('/assets/ui/hud/boss_nameplate.png');
    });

    it('레거시 키(playerHpBar, bossHpBar, manaFlask, comboBadge) 하위 호환성을 유지한다', () => {
      expect(UI_IMAGE_ASSETS.hud).toHaveProperty('playerHpBar');
      expect(UI_IMAGE_ASSETS.hud).toHaveProperty('bossHpBar');
      expect(UI_IMAGE_ASSETS.hud).toHaveProperty('manaFlask');
      expect(UI_IMAGE_ASSETS.hud).toHaveProperty('comboBadge');
    });
  });

  describe('3. HUDLayer 프로시저럴 폴백 검증 (imageLoader null 상태)', () => {
    it('이미지가 없을 때는 drawImage를 호출하지 않고 기존 프로시저럴 드로잉과 텍스트를 렌더링한다', () => {
      const hud = new HUDLayer();
      const mockCtx = createMockCtx();
      const data: HUDData = {
        playerHp: 80,
        playerMaxHp: 100,
        bossHp: 8,
        bossMaxHp: 10,
        combo: 4,
        chapter: 1,
        guardianStage: 1,
      };

      hud.render(mockCtx, 1080, 2160, data);

      // 이미지가 없으므로 drawImage는 호출되지 않아야 함
      expect(mockCtx.drawImage).not.toHaveBeenCalled();

      // 프로시저럴 사각형 및 텍스트는 렌더링되어야 함
      expect(mockCtx.fillRect).toHaveBeenCalled();
      expect(mockCtx.strokeRect).toHaveBeenCalled();
      expect(mockCtx.fillText).toHaveBeenCalledWith('HP 80/100', expect.any(Number), expect.any(Number));
      expect(mockCtx.fillText).toHaveBeenCalledWith('HP 8/10', expect.any(Number), expect.any(Number));
      expect(mockCtx.fillText).toHaveBeenCalledWith('COMBO x4', expect.any(Number), expect.any(Number));
      expect(mockCtx.fillText).toHaveBeenCalledWith('Ch.1 하얘시니', expect.any(Number), expect.any(Number));
    });
  });

  describe('4. HUDLayer 신규 HUD 이미지 에셋 연동 렌더링 검증', () => {
    it('신규 HUD 에셋이 로드되었을 때 프레임, 채움, 콤보 아이콘, 보스 명패를 drawImage로 렌더링하고 텍스트도 표시한다', () => {
      const hud = new HUDLayer();
      const mockCtx = createMockCtx();
      const data: HUDData = {
        playerHp: 75,
        playerMaxHp: 100,
        bossHp: 6,
        bossMaxHp: 10,
        combo: 5,
        chapter: 1,
        guardianStage: 1,
      };

      const hpFrameImg = createMockImage(320, 48);
      const playerFillImg = createMockImage(320, 48);
      const bossFillImg = createMockImage(320, 48);
      const comboIconImg = createMockImage(48, 48);
      const nameplateImg = createMockImage(400, 60);

      imageLoader.setImage('hud', 'hpBarFrame', hpFrameImg);
      imageLoader.setImage('hud', 'hpBarFillPlayer', playerFillImg);
      imageLoader.setImage('hud', 'hpBarFillBoss', bossFillImg);
      imageLoader.setImage('hud', 'comboIcon', comboIconImg);
      imageLoader.setImage('hud', 'bossNameplate', nameplateImg);

      hud.render(mockCtx, 1080, 2160, data);

      // 1) 플레이어 및 보스 HP바: fill 이미지와 frame 이미지가 drawImage로 호출되어야 함
      expect(mockCtx.drawImage).toHaveBeenCalledWith(playerFillImg, expect.any(Number), expect.any(Number), expect.any(Number), expect.any(Number));
      expect(mockCtx.drawImage).toHaveBeenCalledWith(bossFillImg, expect.any(Number), expect.any(Number), expect.any(Number), expect.any(Number));
      expect(mockCtx.drawImage).toHaveBeenCalledWith(hpFrameImg, expect.any(Number), expect.any(Number), expect.any(Number), expect.any(Number));

      // 2) 콤보 아이콘 drawImage 호출 확인
      expect(mockCtx.drawImage).toHaveBeenCalledWith(comboIconImg, expect.any(Number), expect.any(Number), expect.any(Number), expect.any(Number));

      // 3) 보스 이름 명패 drawImage 호출 확인
      expect(mockCtx.drawImage).toHaveBeenCalledWith(nameplateImg, expect.any(Number), expect.any(Number), expect.any(Number), expect.any(Number));

      // 4) 텍스트가 여전히 정상 렌더링되는지 확인
      expect(mockCtx.fillText).toHaveBeenCalledWith('HP 75/100', expect.any(Number), expect.any(Number));
      expect(mockCtx.fillText).toHaveBeenCalledWith('HP 6/10', expect.any(Number), expect.any(Number));
      expect(mockCtx.fillText).toHaveBeenCalledWith('COMBO x5', expect.any(Number), expect.any(Number));
      expect(mockCtx.fillText).toHaveBeenCalledWith('Ch.1 하얘시니', expect.any(Number), expect.any(Number));
    });

    it('콤보가 0일 때는 comboIcon이 렌더링되지 않는다', () => {
      const hud = new HUDLayer();
      const mockCtx = createMockCtx();
      const data: HUDData = {
        playerHp: 100,
        playerMaxHp: 100,
        bossHp: 10,
        bossMaxHp: 10,
        combo: 0,
        chapter: 1,
        guardianStage: 1,
      };

      const comboIconImg = createMockImage(48, 48);
      imageLoader.setImage('hud', 'comboIcon', comboIconImg);

      hud.render(mockCtx, 1080, 2160, data);

      expect(mockCtx.drawImage).not.toHaveBeenCalledWith(comboIconImg, expect.any(Number), expect.any(Number), expect.any(Number), expect.any(Number));
    });

    it('레거시 키(playerHpBar, bossHpBar, comboBadge)만 주입된 경우에도 기존 방식으로 drawImage를 호출한다', () => {
      const hud = new HUDLayer();
      const mockCtx = createMockCtx();
      const data: HUDData = {
        playerHp: 100,
        playerMaxHp: 100,
        bossHp: 10,
        bossMaxHp: 10,
        combo: 2,
        chapter: 1,
        guardianStage: 1,
      };

      const legacyPlayer = createMockImage(320, 32);
      const legacyBoss = createMockImage(320, 32);
      const legacyCombo = createMockImage(160, 48);

      imageLoader.setImage('hud', 'playerHpBar', legacyPlayer);
      imageLoader.setImage('hud', 'bossHpBar', legacyBoss);
      imageLoader.setImage('hud', 'comboBadge', legacyCombo);

      hud.render(mockCtx, 1080, 2160, data);

      expect(mockCtx.drawImage).toHaveBeenCalledWith(legacyPlayer, expect.any(Number), expect.any(Number), expect.any(Number), expect.any(Number));
      expect(mockCtx.drawImage).toHaveBeenCalledWith(legacyBoss, expect.any(Number), expect.any(Number), expect.any(Number), expect.any(Number));
      expect(mockCtx.drawImage).toHaveBeenCalledWith(legacyCombo, expect.any(Number), expect.any(Number), expect.any(Number), expect.any(Number));
    });
  });
});
