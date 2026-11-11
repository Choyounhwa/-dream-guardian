/**
 * REFACTOR-SRP-013 (#677) — config/ui.config.ts 1,000줄 규칙 준수를 위한 UI 이미지 에셋 모듈 분리 검증
 *
 * - ui.config.ts / ui-image-assets.config.ts 모두 1,000줄 미만
 * - ui.config.js 재export와 신규 모듈 export가 동일 참조 (기존 import 경로 무수정 호환)
 * - 대표 에셋 경로 값 보존
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { UI_IMAGE_ASSETS as FROM_UI_CONFIG } from '../../config/ui.config.js';

const ROOT = resolve(__dirname, '../..');
const MAX_LINES = 1000;

function countLines(relPath: string): number {
  const text = readFileSync(resolve(ROOT, relPath), 'utf-8');
  return text.split(/\r?\n/).length;
}

describe('REFACTOR-SRP-013 ui.config.ts 분리', () => {
  it('config/ui.config.ts 는 1,000줄 미만이다', () => {
    expect(countLines('config/ui.config.ts')).toBeLessThan(MAX_LINES);
  });

  it('신규 config/ui-image-assets.config.ts 는 1,000줄 미만이다', () => {
    expect(countLines('config/ui-image-assets.config.ts')).toBeLessThan(MAX_LINES);
  });

  it('ui.config.js 재export 와 신규 모듈 export 가 동일 참조이다', async () => {
    const mod = await import('../../config/ui-image-assets.config.js');
    expect(mod.UI_IMAGE_ASSETS).toBe(FROM_UI_CONFIG);
  });

  it('대표 에셋 경로 값이 보존된다', () => {
    expect(FROM_UI_CONFIG.menu.cardFrame).toBe('/assets/ui/menu/chapter_card_frame.png');
    expect(FROM_UI_CONFIG.hud.playerHpBar).toBeNull();
    expect(FROM_UI_CONFIG.boss.ch5_defeat).toBe('/assets/boss/ch5/defeat.png');
    expect(FROM_UI_CONFIG.icon?.shoulder).toBe('/assets/ui/icon/icon_shoulder.png');
    expect(Object.keys(FROM_UI_CONFIG)).toEqual([
      'menu', 'question', 'hud', 'result', 'bottomBar', 'settings', 'battle',
      'pause', 'boss', 'guardian', 'bg', 'dialogue', 'modal', 'icon',
    ]);
  });

  it('ui.config.ts 에 UI_IMAGE_ASSETS 리터럴 정의가 남아 있지 않다 (SSOT)', () => {
    const src = readFileSync(resolve(ROOT, 'config/ui.config.ts'), 'utf-8');
    expect(src).not.toMatch(/export const UI_IMAGE_ASSETS\s*:/);
  });
});
