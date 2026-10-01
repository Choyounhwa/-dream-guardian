import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { UIImageLoader, imageLoader } from '../../src/utils/UIImageLoader.js';
import { UI_IMAGE_ASSETS, type UIImageAssetsConfig } from '../../config/ui.config.js';
import { HUDLayer } from '../../src/ui/HUDLayer.js';
import { MenuRenderer } from '../../src/ui/MenuRenderer.js';
import { ResultRenderer } from '../../src/ui/ResultRenderer.js';
import { BottomBar } from '../../src/ui/BottomBar.js';
import { SettingsModal } from '../../src/ui/SettingsModal.js';

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

describe('UIImageLoader (Issue #261 / UI-TOKEN-006)', () => {
  let loader: UIImageLoader;

  beforeEach(() => {
    loader = new UIImageLoader();
    imageLoader.clear();
  });

  afterEach(() => {
    imageLoader.clear();
    vi.restoreAllMocks();
  });

  describe('기본 상태 및 싱글톤 인스턴스', () => {
    it('imageLoader 싱글톤 인스턴스가 존재하며 UIImageLoader 타입이다', () => {
      expect(imageLoader).toBeInstanceOf(UIImageLoader);
    });

    it('초기 상태에서 isReady()는 false를 반환한다', () => {
      expect(loader.isReady()).toBe(false);
    });

    it('등록되지 않은 에셋에 대해 get()은 null을 반환한다', () => {
      expect(loader.get('menu', 'background')).toBeNull();
      expect(loader.get('hud', 'playerHpBar')).toBeNull();
    });

    it('등록되지 않은 에셋에 대해 has()는 false를 반환한다', () => {
      expect(loader.has('menu', 'background')).toBe(false);
    });
  });

  describe('setImage, get, has, clear, reset', () => {
    it('setImage로 이미지를 수동 등록하면 get과 has로 조회가 가능하다', () => {
      const mockImg = createMockImage(200, 50);
      loader.setImage('hud', 'playerHpBar', mockImg);

      expect(loader.has('hud', 'playerHpBar')).toBe(true);
      expect(loader.get('hud', 'playerHpBar')).toBe(mockImg);
    });

    it('clear() 호출 시 모든 캐시가 제거되고 isReady()가 false가 된다', () => {
      const mockImg = createMockImage();
      loader.setImage('hud', 'playerHpBar', mockImg);
      loader.clear();

      expect(loader.has('hud', 'playerHpBar')).toBe(false);
      expect(loader.get('hud', 'playerHpBar')).toBeNull();
      expect(loader.isReady()).toBe(false);
    });

    it('reset() 호출 시 clear()와 동일하게 모든 캐시가 제거된다', () => {
      const mockImg = createMockImage();
      loader.setImage('menu', 'banner', mockImg);
      loader.reset();

      expect(loader.has('menu', 'banner')).toBe(false);
      expect(loader.get('menu', 'banner')).toBeNull();
    });
  });

  describe('preload 동작', () => {
    it('인자 없이 preload() 호출 시 기본 UI_IMAGE_ASSETS를 사용하여 프리로드를 완료하고 isReady가 true가 된다', async () => {
      await loader.preload();
      expect(loader.isReady()).toBe(true);
    });

    it('null/undefined 에셋으로 preload 호출 시에도 예외 없이 완료되고 isReady가 true가 된다', async () => {
      await loader.preload(null as any);
      expect(loader.isReady()).toBe(true);

      const loader2 = new UIImageLoader();
      await loader2.preload(undefined);
      expect(loader2.isReady()).toBe(true);
    });

    it('모든 슬롯이 null인 기본 UI_IMAGE_ASSETS preload 시 즉시 완료되고 isReady가 true가 된다', async () => {
      await loader.preload(UI_IMAGE_ASSETS);

      expect(loader.isReady()).toBe(true);
      expect(loader.get('hud', 'playerHpBar')).toBeNull();
      expect(loader.get('menu', 'background')).toBeNull();
    });

    it('non-null 에셋 로드 성공 시 캐시에 등록된다', async () => {
      const originalImage = globalThis.Image;
      class MockImageSuccess {
        src = '';
        width = 120;
        height = 40;
        onload: (() => void) | null = null;
        onerror: (() => void) | null = null;
        constructor() {
          setTimeout(() => {
            if (this.onload) this.onload();
          }, 0);
        }
      }
      (globalThis as any).Image = MockImageSuccess;

      try {
        const testConfig: UIImageAssetsConfig = {
          menu: { background: null, cardFrame: null, banner: null },
          hud: { playerHpBar: '/assets/ui/player-hp.png', bossHpBar: null, manaFlask: null, comboBadge: null },
          result: { panelBg: null, victoryBadge: null, defeatBadge: null, starFilled: null, starEmpty: null },
          bottomBar: { barBg: null, settingsIcon: null, actionButton: null },
          settings: { dialogBg: null, closeIcon: null },
          battle: { bossFrame: null, shieldAura: null },
        };

        await loader.preload(testConfig);

        expect(loader.isReady()).toBe(true);
        expect(loader.has('hud', 'playerHpBar')).toBe(true);
        expect(loader.get('hud', 'playerHpBar')).not.toBeNull();
      } finally {
        globalThis.Image = originalImage;
      }
    });

    it('non-null 에셋 로드 실패 시 콘솔 경고를 남기고 null로 폴백된다', async () => {
      const originalImage = globalThis.Image;
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      class MockImageError {
        src = '';
        onload: (() => void) | null = null;
        onerror: ((err: any) => void) | null = null;
        constructor() {
          setTimeout(() => {
            if (this.onerror) this.onerror(new Error('Network error'));
          }, 0);
        }
      }
      (globalThis as any).Image = MockImageError;

      try {
        const testConfig: UIImageAssetsConfig = {
          menu: { background: null, cardFrame: null, banner: null },
          hud: { playerHpBar: '/invalid/path.png', bossHpBar: null, manaFlask: null, comboBadge: null },
          result: { panelBg: null, victoryBadge: null, defeatBadge: null, starFilled: null, starEmpty: null },
          bottomBar: { barBg: null, settingsIcon: null, actionButton: null },
          settings: { dialogBg: null, closeIcon: null },
          battle: { bossFrame: null, shieldAura: null },
        };

        await loader.preload(testConfig);

        expect(loader.isReady()).toBe(true);
        expect(loader.get('hud', 'playerHpBar')).toBeNull();
        expect(loader.has('hud', 'playerHpBar')).toBe(false);
        expect(warnSpy).toHaveBeenCalled();
      } finally {
        globalThis.Image = originalImage;
        warnSpy.mockRestore();
      }
    });
  });

  describe('5개 렌더러 안전 분기 연동 검증 (null 폴백 vs drawImage 호출)', () => {
    let mockCtx: CanvasRenderingContext2D;

    beforeEach(() => {
      mockCtx = createMockCtx();
      imageLoader.clear();
    });

    // 1. HUDLayer
    it('HUDLayer: imageLoader가 null일 때는 drawImage 없이 프로시저럴 렌더링하고, 이미지 존재 시 drawImage를 호출한다', () => {
      const hud = new HUDLayer();
      const hudData = {
        playerHp: 80,
        playerMaxHp: 100,
        bossHp: 8,
        bossMaxHp: 10,
        combo: 5,
        chapter: 1,
        guardianStage: 1,
      };

      // 1) null 상태: drawImage 호출 0회
      hud.render(mockCtx, 1080, 2160, hudData);
      expect(mockCtx.drawImage).not.toHaveBeenCalled();

      // 2) 이미지 주입 상태: drawImage 호출 확인
      const playerBarImg = createMockImage(320, 32);
      const bossBarImg = createMockImage(320, 32);
      const comboImg = createMockImage(160, 48);
      imageLoader.setImage('hud', 'playerHpBar', playerBarImg);
      imageLoader.setImage('hud', 'bossHpBar', bossBarImg);
      imageLoader.setImage('hud', 'comboBadge', comboImg);

      hud.render(mockCtx, 1080, 2160, hudData);
      expect(mockCtx.drawImage).toHaveBeenCalledWith(playerBarImg, expect.any(Number), expect.any(Number), expect.any(Number), expect.any(Number));
      expect(mockCtx.drawImage).toHaveBeenCalledWith(bossBarImg, expect.any(Number), expect.any(Number), expect.any(Number), expect.any(Number));
      expect(mockCtx.drawImage).toHaveBeenCalledWith(comboImg, expect.any(Number), expect.any(Number), expect.any(Number), expect.any(Number));
    });

    // 2. MenuRenderer
    it('MenuRenderer: imageLoader가 null일 때는 프로시저럴 드로잉하고, 이미지 존재 시 drawImage를 호출한다', () => {
      const menu = new MenuRenderer();
      const state = {
        unlockedChapter: 2,
        selectedChapter: 1,
        stars: { 1: 3, 2: 1 },
      };

      // 1) null 상태: drawImage 호출 0회
      menu.render(mockCtx, 1080, 2160, state);
      expect(mockCtx.drawImage).not.toHaveBeenCalled();

      // 2) 이미지 주입 상태: 배경, 배너, 카드 프레임 drawImage 호출
      const bgImg = createMockImage(1080, 2160);
      const bannerImg = createMockImage(800, 120);
      const cardFrameImg = createMockImage(360, 380);
      imageLoader.setImage('menu', 'background', bgImg);
      imageLoader.setImage('menu', 'banner', bannerImg);
      imageLoader.setImage('menu', 'cardFrame', cardFrameImg);

      menu.render(mockCtx, 1080, 2160, state);
      expect(mockCtx.drawImage).toHaveBeenCalledWith(bgImg, 0, 0, 1080, 2160);
      expect(mockCtx.drawImage).toHaveBeenCalledWith(bannerImg, expect.any(Number), expect.any(Number), expect.any(Number), expect.any(Number));
      expect(mockCtx.drawImage).toHaveBeenCalledWith(cardFrameImg, expect.any(Number), expect.any(Number), expect.any(Number), expect.any(Number));
    });

    // 3. ResultRenderer
    it('ResultRenderer: imageLoader가 null일 때는 프로시저럴 렌더링하고, 이미지 존재 시 drawImage를 호출한다', () => {
      const result = new ResultRenderer();
      const resultData = {
        victory: true,
        chapter: 1,
        score: 1000,
        correctCount: 9,
        totalQuestions: 10,
        maxCombo: 5,
        elapsedTime: 90,
        steps: 120,
        squats: 10,
        jumps: 5,
        dwellTime: 20,
        locomotionMode: 'run' as const,
      };

      // 1) null 상태: drawImage 호출 0회
      result.render(mockCtx, 1080, 2160, resultData);
      expect(mockCtx.drawImage).not.toHaveBeenCalled();

      // 2) 이미지 주입 상태: 패널, 승리 배지, 별 아이콘
      const panelImg = createMockImage(880, 1580);
      const victoryImg = createMockImage(240, 80);
      const starFilled = createMockImage(50, 50);
      const starEmpty = createMockImage(50, 50);
      imageLoader.setImage('result', 'panelBg', panelImg);
      imageLoader.setImage('result', 'victoryBadge', victoryImg);
      imageLoader.setImage('result', 'starFilled', starFilled);
      imageLoader.setImage('result', 'starEmpty', starEmpty);

      result.render(mockCtx, 1080, 2160, resultData);
      expect(mockCtx.drawImage).toHaveBeenCalledWith(panelImg, expect.any(Number), expect.any(Number), expect.any(Number), expect.any(Number));
      expect(mockCtx.drawImage).toHaveBeenCalledWith(victoryImg, expect.any(Number), expect.any(Number), expect.any(Number), expect.any(Number));
      expect(mockCtx.drawImage).toHaveBeenCalledWith(starFilled, expect.any(Number), expect.any(Number), expect.any(Number), expect.any(Number));
    });

    // 4. BottomBar
    it('BottomBar: imageLoader가 null일 때는 프로시저럴 렌더링하고, 이미지 존재 시 drawImage를 호출한다', () => {
      const bar = new BottomBar();
      const options = {
        actionLabel: '포기하기',
        actionColor: '#FF4444',
        mana: 50,
        manaMax: 100,
      };

      // 1) null 상태: drawImage 호출 0회
      bar.render(mockCtx, 1080, 2160, options);
      expect(mockCtx.drawImage).not.toHaveBeenCalled();

      // 2) 이미지 주입 상태: 바 배경, 설정 아이콘, 액션 버튼
      const barBgImg = createMockImage(1080, 210);
      const settingsIconImg = createMockImage(60, 60);
      const actionBtnImg = createMockImage(240, 140);
      imageLoader.setImage('bottomBar', 'barBg', barBgImg);
      imageLoader.setImage('bottomBar', 'settingsIcon', settingsIconImg);
      imageLoader.setImage('bottomBar', 'actionButton', actionBtnImg);

      bar.render(mockCtx, 1080, 2160, options);
      expect(mockCtx.drawImage).toHaveBeenCalledWith(barBgImg, 0, expect.any(Number), 1080, expect.any(Number));
      expect(mockCtx.drawImage).toHaveBeenCalledWith(settingsIconImg, expect.any(Number), expect.any(Number), expect.any(Number), expect.any(Number));
      expect(mockCtx.drawImage).toHaveBeenCalledWith(actionBtnImg, expect.any(Number), expect.any(Number), expect.any(Number), expect.any(Number));
    });

    // 5. SettingsModal
    it('SettingsModal: imageLoader가 null일 때는 프로시저럴 렌더링하고, 이미지 존재 시 drawImage를 호출한다', () => {
      const modal = new SettingsModal();
      modal.open();

      // 1) null 상태: drawImage 호출 0회
      modal.render(mockCtx, 1080, 2160);
      expect(mockCtx.drawImage).not.toHaveBeenCalled();

      // 2) 이미지 주입 상태: 다이얼로그 배경, 닫기 아이콘
      const dialogBgImg = createMockImage(800, 1080);
      const closeIconImg = createMockImage(60, 60);
      imageLoader.setImage('settings', 'dialogBg', dialogBgImg);
      imageLoader.setImage('settings', 'closeIcon', closeIconImg);

      modal.render(mockCtx, 1080, 2160);
      expect(mockCtx.drawImage).toHaveBeenCalledWith(dialogBgImg, expect.any(Number), expect.any(Number), expect.any(Number), expect.any(Number));
      expect(mockCtx.drawImage).toHaveBeenCalledWith(closeIconImg, expect.any(Number), expect.any(Number), expect.any(Number), expect.any(Number));
    });
  });
});
