import { describe, it, expect } from 'vitest';
import { DEFAULT_CONFIG } from '../../src/core/Config.js';

describe('Smoke Test', () => {
  it('프로젝트가 정상 로드된다', () => {
    expect(true).toBe(true);
  });

  it('DEFAULT_CONFIG가 올바르게 정의되어 있다', () => {
    expect(DEFAULT_CONFIG).toBeDefined();
    expect(DEFAULT_CONFIG.player.maxHp).toBe(100);
  });
});
