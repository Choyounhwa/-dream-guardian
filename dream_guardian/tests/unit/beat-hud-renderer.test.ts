import { describe, it, expect, vi } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { BeatHUDRenderer, type BeatHUDState } from '../../src/render/BeatHUDRenderer.js';
import { BEAT_HUD_CONFIG } from '../../config/locomotion.config.js';
import { UI_IMAGE_ASSETS } from '../../config/ui.config.js';
import { imageLoader } from '../../src/utils/UIImageLoader.js';
import type { GeneratedQuestion } from '../../src/question/QuestionEvaluator.js';

function createMockCtx(): CanvasRenderingContext2D {
  return {
    save: vi.fn(),
    restore: vi.fn(),
    beginPath: vi.fn(),
    closePath: vi.fn(),
    arc: vi.fn(),
    ellipse: vi.fn(),
    fill: vi.fn(),
    stroke: vi.fn(),
    moveTo: vi.fn(),
    lineTo: vi.fn(),
    fillText: vi.fn(),
    fillRect: vi.fn(),
    strokeRect: vi.fn(),
    roundRect: vi.fn(),
    measureText: vi.fn((text: string) => ({ width: text.length * 10 })),
    drawImage: vi.fn(),
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

const mockQuestion: GeneratedQuestion = {
  questionText: '3 + 5',
  choices: [8, 9],
  correctAnswer: 8,
  wrongAnswer: 9,
  correctIndex: 0,
};

describe('BeatHUDRenderer & BEAT_HUD_CONFIG (Issue #209 / REFACTOR-RENDER-001)', () => {
  it('BEAT_HUD_CONFIG 설정 상수가 올바르게 정의되어 있다', () => {
    expect(BEAT_HUD_CONFIG.TOTAL_BEATS).toBe(8);
    expect(BEAT_HUD_CONFIG.COLOR_SPLIT_BEAT).toBe(5);
    expect(BEAT_HUD_CONFIG.COLOR_EARLY).toBe('#FFCB4D');
    expect(BEAT_HUD_CONFIG.COLOR_LATE).toBe('#28E6FF');
    expect(BEAT_HUD_CONFIG.DOT_RADIUS).toBe(14);
    expect(BEAT_HUD_CONFIG.DOT_GAP).toBe(44);
  });

  it('기본 상태로 렌더링 시 오류 없이 실행되고 타이틀 및 걸음 수를 그린다', () => {
    const renderer = new BeatHUDRenderer();
    const ctx = createMockCtx();
    const state: BeatHUDState = {
      question: mockQuestion,
      totalSteps: 12,
      locomotionMode: 'run',
      activeHazardPattern: 'jump',
      hazardBeatProgress: 0.5,
    };

    expect(() => renderer.render(ctx, 1080, 2160, state)).not.toThrow();
    expect(ctx.save).toHaveBeenCalled();
    expect(ctx.restore).toHaveBeenCalled();
    expect(ctx.fillText).toHaveBeenCalled();
    expect(ctx.ellipse).toHaveBeenCalled();
  });

  it('activeHazardPattern이 null일 때 완료 안내 메시지를 출력한다', () => {
    const renderer = new BeatHUDRenderer();
    const ctx = createMockCtx();
    const state: BeatHUDState = {
      question: mockQuestion,
      totalSteps: 8,
      locomotionMode: 'run',
      activeHazardPattern: null,
      hazardBeatProgress: 0,
    };

    renderer.render(ctx, 1080, 2160, state);
    const textCalls = (ctx.fillText as any).mock.calls.map((c: any) => c[0]);
    expect(textCalls.some((t: string) => t.includes('장판 루틴 완료') || t.includes('완료'))).toBe(true);
  });

  it('showBeatDots=true 옵션 시 8박 원형 인디케이터가 렌더링된다', () => {
    const renderer = new BeatHUDRenderer({ showBeatDots: true });
    const ctx = createMockCtx();
    const state: BeatHUDState = {
      question: mockQuestion,
      completedExerciseBeats: 4,
      totalSteps: 4,
      locomotionMode: 'run',
    };

    renderer.render(ctx, 1080, 2160, state);
    expect(ctx.arc).toHaveBeenCalled();
  });
});

describe('Issue #291 (UI-ASSET-010) - 8박자 비트 인디케이터 도트 이미지 에셋 및 연동', () => {
  it('public/assets/ui/hud 디렉토리에 3종 비트 도트 PNG 파일이 64x64 유효 규격으로 존재한다', () => {
    const assetsDir = path.resolve(__dirname, '../../public/assets/ui/hud');
    const dotFiles = [
      'beat_dot_active.png',
      'beat_dot_inactive.png',
      'beat_dot_target.png',
    ];
    for (const file of dotFiles) {
      const filePath = path.join(assetsDir, file);
      expect(fs.existsSync(filePath), `${file} should exist`).toBe(true);
      const buf = fs.readFileSync(filePath);
      expect(buf.slice(0, 8).toString('hex')).toBe('89504e470d0a1a0a');
      const width = buf.readUInt32BE(16);
      const height = buf.readUInt32BE(20);
      expect(width).toBe(64);
      expect(height).toBe(64);
    }
  });

  it('UI_IMAGE_ASSETS.hud 설정에 beatDotActive, beatDotInactive, beatDotTarget 경로가 정의되어 있다', () => {
    expect(UI_IMAGE_ASSETS.hud.beatDotActive).toBe('/assets/ui/hud/beat_dot_active.png');
    expect(UI_IMAGE_ASSETS.hud.beatDotInactive).toBe('/assets/ui/hud/beat_dot_inactive.png');
    expect(UI_IMAGE_ASSETS.hud.beatDotTarget).toBe('/assets/ui/hud/beat_dot_target.png');
  });

  it('imageLoader에 비트 도트 이미지가 준비되어 있을 때 drawImage로 비트맵 도트를 렌더링한다', () => {
    const renderer = new BeatHUDRenderer({ showBeatDots: true });
    const ctx = createMockCtx();
    const mockActive = { src: 'active.png', width: 64, height: 64 } as HTMLImageElement;
    const mockInactive = { src: 'inactive.png', width: 64, height: 64 } as HTMLImageElement;
    const mockTarget = { src: 'target.png', width: 64, height: 64 } as HTMLImageElement;

    const spyGet = vi.spyOn(imageLoader, 'get').mockImplementation((category: string, key: string) => {
      if (category === 'hud') {
        if (key === 'beatDotActive') return mockActive;
        if (key === 'beatDotInactive') return mockInactive;
        if (key === 'beatDotTarget') return mockTarget;
      }
      return null;
    });

    const state: BeatHUDState = {
      completedExerciseBeats: 3,
      exerciseBeats: 8,
    };

    renderer.render(ctx, 1080, 2160, state);

    // 8개 도트 모두 drawImage로 그려져야 함
    expect(ctx.drawImage).toHaveBeenCalledTimes(8);

    // 0, 1, 2는 completed -> activeImg
    // 3은 current tick -> targetImg
    // 4, 5, 6, 7은 inactive -> inactiveImg
    const calls = (ctx.drawImage as any).mock.calls;
    expect(calls[0][0]).toBe(mockActive);
    expect(calls[1][0]).toBe(mockActive);
    expect(calls[2][0]).toBe(mockActive);
    expect(calls[3][0]).toBe(mockTarget);
    expect(calls[4][0]).toBe(mockInactive);
    expect(calls[5][0]).toBe(mockInactive);
    expect(calls[6][0]).toBe(mockInactive);
    expect(calls[7][0]).toBe(mockInactive);

    spyGet.mockRestore();
  });

  it('이미지 에셋이 로드되지 않았을 때는 기존 arc() 기반 프로시저럴 드로잉으로 100% 무중단 폴백한다', () => {
    const renderer = new BeatHUDRenderer({ showBeatDots: true });
    const ctx = createMockCtx();

    const spyGet = vi.spyOn(imageLoader, 'get').mockReturnValue(null);

    const state: BeatHUDState = {
      completedExerciseBeats: 3,
      exerciseBeats: 8,
    };

    renderer.render(ctx, 1080, 2160, state);

    expect(ctx.drawImage).not.toHaveBeenCalled();
    expect(ctx.arc).toHaveBeenCalledTimes(8);

    spyGet.mockRestore();
  });
});
