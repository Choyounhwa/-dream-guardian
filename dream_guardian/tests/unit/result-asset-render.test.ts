import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { ResultRenderer, type ResultData } from '../../src/ui/ResultRenderer.js';
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

describe('[UI-ASSET-003 / #268] 결과 화면 이미지 에셋 제작 및 ResultRenderer 연동', () => {
  const resultAssetDir = path.resolve(process.cwd(), 'public/assets/ui/result');

  const baseResultData: ResultData = {
    victory: true,
    chapter: 1,
    correctCount: 9,
    totalQuestions: 10,
    maxCombo: 5,
    steps: 100,
    squats: 8,
    jumps: 4,
    elapsedTime: 85,
    dwellTime: 15,
    locomotionMode: 'run',
  };

  beforeEach(() => {
    imageLoader.clear();
  });

  afterEach(() => {
    imageLoader.clear();
    vi.restoreAllMocks();
  });

  describe('1. 결과 화면 이미지 에셋 파일 생성 및 규격 검증', () => {
    it('public/assets/ui/result/ 디렉토리에 13개 필수 이미지 에셋이 존재한다', () => {
      const files = [
        'panel_bg.png',
        'victory_title.png',
        'defeat_title.png',
        'stat_accuracy.png',
        'stat_combo.png',
        'stat_time.png',
        'stat_run.png',
        'stat_squat.png',
        'stat_jump.png',
        'stat_pose.png',
        'stat_calorie.png',
        'star_filled.png',
        'star_empty.png',
      ];

      for (const file of files) {
        const fullPath = path.join(resultAssetDir, file);
        expect(fs.existsSync(fullPath), `파일이 존재해야 합니다: ${file}`).toBe(true);
        const stat = fs.statSync(fullPath);
        expect(stat.size).toBeGreaterThan(0);
      }
    });

    it('각 PNG 파일이 유효한 PNG 시그니처 및 지정된 해상도 규격을 만족한다', () => {
      const specs = [
        { file: 'panel_bg.png', width: 880, height: 1580 },
        { file: 'victory_title.png', width: 600, height: 160 },
        { file: 'defeat_title.png', width: 600, height: 160 },
        { file: 'stat_accuracy.png', width: 48, height: 48 },
        { file: 'stat_combo.png', width: 48, height: 48 },
        { file: 'stat_time.png', width: 48, height: 48 },
        { file: 'stat_run.png', width: 48, height: 48 },
        { file: 'stat_squat.png', width: 48, height: 48 },
        { file: 'stat_jump.png', width: 48, height: 48 },
        { file: 'stat_pose.png', width: 48, height: 48 },
        { file: 'stat_calorie.png', width: 48, height: 48 },
        { file: 'star_filled.png', width: 54, height: 54 },
        { file: 'star_empty.png', width: 54, height: 54 },
      ];

      for (const spec of specs) {
        const fullPath = path.join(resultAssetDir, spec.file);
        const { width, height } = readPngDimensions(fullPath);
        expect(width).toBe(spec.width);
        expect(height).toBe(spec.height);
      }
    });
  });

  describe('2. UI_IMAGE_ASSETS.result 설정 연동 검증', () => {
    it('UI_IMAGE_ASSETS.result에 13개 신규/확장 에셋 경로가 올바르게 등록되어 있다', () => {
      expect(UI_IMAGE_ASSETS.result.panelBg).toBe('/assets/ui/result/panel_bg.png');
      expect(UI_IMAGE_ASSETS.result.victoryTitle).toBe('/assets/ui/result/victory_title.png');
      expect(UI_IMAGE_ASSETS.result.defeatTitle).toBe('/assets/ui/result/defeat_title.png');
      expect(UI_IMAGE_ASSETS.result.victoryBadge).toBe('/assets/ui/result/victory_title.png');
      expect(UI_IMAGE_ASSETS.result.defeatBadge).toBe('/assets/ui/result/defeat_title.png');
      expect(UI_IMAGE_ASSETS.result.starFilled).toBe('/assets/ui/result/star_filled.png');
      expect(UI_IMAGE_ASSETS.result.starEmpty).toBe('/assets/ui/result/star_empty.png');
      expect(UI_IMAGE_ASSETS.result.statIcon_accuracy).toBe('/assets/ui/result/stat_accuracy.png');
      expect(UI_IMAGE_ASSETS.result.statIcon_combo).toBe('/assets/ui/result/stat_combo.png');
      expect(UI_IMAGE_ASSETS.result.statIcon_time).toBe('/assets/ui/result/stat_time.png');
      expect(UI_IMAGE_ASSETS.result.statIcon_run).toBe('/assets/ui/result/stat_run.png');
      expect(UI_IMAGE_ASSETS.result.statIcon_squat).toBe('/assets/ui/result/stat_squat.png');
      expect(UI_IMAGE_ASSETS.result.statIcon_jump).toBe('/assets/ui/result/stat_jump.png');
      expect(UI_IMAGE_ASSETS.result.statIcon_pose).toBe('/assets/ui/result/stat_pose.png');
      expect(UI_IMAGE_ASSETS.result.statIcon_calorie).toBe('/assets/ui/result/stat_calorie.png');
    });
  });

  describe('3. ResultRenderer 프로시저럴 폴백 검증 (imageLoader null 상태)', () => {
    it('이미지가 없을 때는 drawImage를 호출하지 않고 기존 프로시저럴 드로잉과 텍스트를 렌더링한다', () => {
      const renderer = new ResultRenderer();
      const mockCtx = createMockCtx();

      renderer.render(mockCtx, 1080, 2160, baseResultData);

      // 이미지가 없으므로 drawImage 0회
      expect(mockCtx.drawImage).not.toHaveBeenCalled();

      // 프로시저럴 패널 드로잉 호출
      expect(mockCtx.fill).toHaveBeenCalled();
      expect(mockCtx.stroke).toHaveBeenCalled();

      // 텍스트 폴백 호출: 승리 타이틀, 별점, 이모지 포함 텍스트
      const filledTexts = vi.mocked(mockCtx.fillText).mock.calls.map((call) => call[0]);
      expect(filledTexts).toContain('승리!');
      expect(filledTexts.some((t) => typeof t === 'string' && t.includes('★'))).toBe(true);
      expect(filledTexts.some((t) => typeof t === 'string' && t.includes('🎯 정답률:'))).toBe(true);
      expect(filledTexts.some((t) => typeof t === 'string' && t.includes('🔥 최대 콤보:'))).toBe(true);
      expect(filledTexts.some((t) => typeof t === 'string' && t.includes('⏱️ 플레이 시간:'))).toBe(true);
      expect(filledTexts.some((t) => typeof t === 'string' && t.includes('🏃 달린 걸음:'))).toBe(true);
      expect(filledTexts.some((t) => typeof t === 'string' && t.includes('🏋️ 스쿼트:'))).toBe(true);
      expect(filledTexts.some((t) => typeof t === 'string' && t.includes('🦘 점프:'))).toBe(true);
      expect(filledTexts.some((t) => typeof t === 'string' && t.includes('🧘 자세 유지:'))).toBe(true);
      expect(filledTexts.some((t) => typeof t === 'string' && t.includes('⚡ 소모 칼로리:'))).toBe(true);
    });

    it('패배 시에도 이미지가 없을 때 프로시저럴 패배 텍스트를 정상 렌더링한다', () => {
      const renderer = new ResultRenderer();
      const mockCtx = createMockCtx();
      const defeatData: ResultData = { ...baseResultData, victory: false };

      renderer.render(mockCtx, 1080, 2160, defeatData);

      expect(mockCtx.drawImage).not.toHaveBeenCalled();
      const filledTexts = vi.mocked(mockCtx.fillText).mock.calls.map((call) => call[0]);
      expect(filledTexts).toContain('패배...');
    });
  });

  describe('4. ResultRenderer 이미지 에셋 연동 검증 (imageLoader 이미지 주입 상태)', () => {
    it('패널 배경 이미지가 로드되어 있으면 패널 영역에 drawImage를 렌더링한다', () => {
      const renderer = new ResultRenderer();
      const mockCtx = createMockCtx();
      const panelImg = createMockImage(880, 1580);
      imageLoader.setImage('result', 'panelBg', panelImg);

      renderer.render(mockCtx, 1080, 2160, baseResultData);

      expect(mockCtx.drawImage).toHaveBeenCalledWith(
        panelImg,
        100, // slot.x
        240, // slot.y
        880, // slot.w
        1580, // slot.h
      );
    });

    it('victoryTitle 이미지가 로드되어 있으면 600x160 기준 비례 스케일로 drawImage를 렌더링한다', () => {
      const renderer = new ResultRenderer();
      const mockCtx = createMockCtx();
      const titleImg = createMockImage(600, 160);
      imageLoader.setImage('result', 'victoryTitle', titleImg);

      renderer.render(mockCtx, 1080, 2160, baseResultData);

      const panel = renderer.getPanelLayout(1080, 2160);
      const titleY = panel.y + 110;
      const bw = 600;
      const bh = 160;

      expect(mockCtx.drawImage).toHaveBeenCalledWith(
        titleImg,
        (1080 - bw) / 2,
        titleY - bh / 2,
        bw,
        bh,
      );

      // 타이틀 이미지가 그려졌으므로 텍스트 '승리!'는 호출되지 않아야 함
      const filledTexts = vi.mocked(mockCtx.fillText).mock.calls.map((call) => call[0]);
      expect(filledTexts).not.toContain('승리!');
    });

    it('defeatTitle 이미지가 로드되어 있고 패배 상태일 때 600x160 스케일로 drawImage를 렌더링한다', () => {
      const renderer = new ResultRenderer();
      const mockCtx = createMockCtx();
      const defeatImg = createMockImage(600, 160);
      imageLoader.setImage('result', 'defeatTitle', defeatImg);

      const defeatData: ResultData = { ...baseResultData, victory: false };
      renderer.render(mockCtx, 1080, 2160, defeatData);

      const panel = renderer.getPanelLayout(1080, 2160);
      const titleY = panel.y + 110;
      const bw = 600;
      const bh = 160;

      expect(mockCtx.drawImage).toHaveBeenCalledWith(
        defeatImg,
        (1080 - bw) / 2,
        titleY - bh / 2,
        bw,
        bh,
      );

      const filledTexts = vi.mocked(mockCtx.fillText).mock.calls.map((call) => call[0]);
      expect(filledTexts).not.toContain('패배...');
    });

    it('별 이미지(starFilled, starEmpty)가 로드되어 있으면 3회 drawImage를 렌더링한다', () => {
      const renderer = new ResultRenderer();
      const mockCtx = createMockCtx();
      const starFilled = createMockImage(54, 54);
      const starEmpty = createMockImage(54, 54);
      imageLoader.setImage('result', 'starFilled', starFilled);
      imageLoader.setImage('result', 'starEmpty', starEmpty);

      renderer.render(mockCtx, 1080, 2160, baseResultData);

      // starFilled 또는 starEmpty drawImage 호출 합이 3회여야 함
      const starCalls = vi.mocked(mockCtx.drawImage).mock.calls.filter(
        (call) => call[0] === starFilled || call[0] === starEmpty,
      );
      expect(starCalls.length).toBe(3);
    });

    it('8개 통계 아이콘(statIcon_*)이 로드되어 있으면 각 라인 좌측에 drawImage하고 텍스트에서는 이모지를 제외한다', () => {
      const renderer = new ResultRenderer();
      const mockCtx = createMockCtx();

      const icons: Record<string, HTMLImageElement> = {
        statIcon_accuracy: createMockImage(48, 48),
        statIcon_combo: createMockImage(48, 48),
        statIcon_time: createMockImage(48, 48),
        statIcon_run: createMockImage(48, 48),
        statIcon_squat: createMockImage(48, 48),
        statIcon_jump: createMockImage(48, 48),
        statIcon_pose: createMockImage(48, 48),
        statIcon_calorie: createMockImage(48, 48),
      };

      for (const [k, img] of Object.entries(icons)) {
        imageLoader.setImage('result', k, img);
      }

      renderer.render(mockCtx, 1080, 2160, baseResultData);

      // 8개 아이콘이 모두 drawImage로 호출되었는지 검증
      for (const [k, img] of Object.entries(icons)) {
        const found = vi.mocked(mockCtx.drawImage).mock.calls.some((call) => call[0] === img);
        expect(found, `${k} 이미지가 drawImage로 호출되어야 합니다`).toBe(true);
      }

      // 텍스트에서 이모지가 제외되었는지 검증
      const filledTexts = vi.mocked(mockCtx.fillText).mock.calls.map((call) => call[0]);
      expect(filledTexts.some((t) => typeof t === 'string' && t.startsWith('정답률:'))).toBe(true);
      expect(filledTexts.some((t) => typeof t === 'string' && t.startsWith('최대 콤보:'))).toBe(true);
      expect(filledTexts.some((t) => typeof t === 'string' && t.startsWith('플레이 시간:'))).toBe(true);
      expect(filledTexts.some((t) => typeof t === 'string' && t.startsWith('달린 걸음:'))).toBe(true);
      expect(filledTexts.some((t) => typeof t === 'string' && t.startsWith('스쿼트:'))).toBe(true);
      expect(filledTexts.some((t) => typeof t === 'string' && t.startsWith('점프:'))).toBe(true);
      expect(filledTexts.some((t) => typeof t === 'string' && t.startsWith('자세 유지:'))).toBe(true);
      expect(filledTexts.some((t) => typeof t === 'string' && t.startsWith('소모 칼로리:'))).toBe(true);

      // 이모지 포함 텍스트는 없어야 함
      expect(filledTexts.some((t) => typeof t === 'string' && t.includes('🎯'))).toBe(false);
      expect(filledTexts.some((t) => typeof t === 'string' && t.includes('🔥'))).toBe(false);
      expect(filledTexts.some((t) => typeof t === 'string' && t.includes('⏱️'))).toBe(false);
      expect(filledTexts.some((t) => typeof t === 'string' && t.includes('🏋️'))).toBe(false);
      expect(filledTexts.some((t) => typeof t === 'string' && t.includes('⚡'))).toBe(false);
    });
  });
});
