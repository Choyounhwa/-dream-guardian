/**
 * REFACTOR-DRY-005 (#676) stage 1 — assault 계열 config 의 로컬 deepFreeze 중복 제거 검증
 *
 * - 각 config 소스에 로컬 `function deepFreeze` 정의가 없어야 한다.
 * - 공유 유틸 `../src/utils/deepFreeze` 를 import 해야 한다.
 * - 런타임 기본 설정 객체는 최상위·중첩 모두 동결 상태를 유지한다.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { DEFAULT_ASSAULT_CONFIG } from '../../config/assault.config.js';
import { DEFAULT_ASSAULT_INPUT_CONFIG } from '../../config/assault-input.config.js';
import { DEFAULT_ASSAULT_QUESTION_CONFIG } from '../../config/assault-question.config.js';
import { DEFAULT_ASSAULT_VISUAL_CONFIG } from '../../config/assault-visual.config.js';
import { DEFAULT_ASSAULT_FINALE_CONFIG } from '../../config/assault-finale.config.js';

const ROOT = resolve(__dirname, '../..');
const SHARED_IMPORT = /import\s*\{\s*deepFreeze\s*\}\s*from\s*'\.\.\/src\/utils\/deepFreeze(\.js)?'/;

interface Target {
  readonly file: string;
  readonly config: object;
  readonly nested: (c: any) => object;
}

const TARGETS: readonly Target[] = [
  { file: 'config/assault.config.ts', config: DEFAULT_ASSAULT_CONFIG, nested: (c) => c.readingMinSeconds },
  { file: 'config/assault-input.config.ts', config: DEFAULT_ASSAULT_INPUT_CONFIG, nested: (c) => c.targetBoxes.left },
  {
    file: 'config/assault-question.config.ts',
    config: DEFAULT_ASSAULT_QUESTION_CONFIG,
    nested: (c) => c.readingLengthThresholds[0],
  },
  {
    file: 'config/assault-visual.config.ts',
    config: DEFAULT_ASSAULT_VISUAL_CONFIG,
    nested: (c) => c.bossAnchor.center,
  },
  { file: 'config/assault-finale.config.ts', config: DEFAULT_ASSAULT_FINALE_CONFIG, nested: (c) => c.beats.punch },
];

describe('REFACTOR-DRY-005 assault config 공유 deepFreeze 사용', () => {
  for (const t of TARGETS) {
    describe(t.file, () => {
      const src = readFileSync(resolve(ROOT, t.file), 'utf-8');

      it('로컬 function deepFreeze 정의가 없다', () => {
        expect(src).not.toMatch(/function\s+deepFreeze/);
      });

      it("공유 유틸 '../src/utils/deepFreeze' 를 import 한다", () => {
        expect(src).toMatch(SHARED_IMPORT);
      });

      it('최상위·중첩 객체가 동결되어 있고 변경 시도는 실패한다', () => {
        const nested = t.nested(t.config);
        expect(Object.isFrozen(t.config)).toBe(true);
        expect(Object.isFrozen(nested)).toBe(true);
        expect(() => {
          (t.config as Record<string, unknown>).__mutated = 1;
        }).toThrow(TypeError);
        expect(() => {
          (nested as Record<string, unknown>).__mutated = 1;
        }).toThrow(TypeError);
        expect((t.config as Record<string, unknown>).__mutated).toBeUndefined();
      });
    });
  }
});
