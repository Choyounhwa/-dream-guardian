import { describe, expect, it } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import { parseFitnessPatternCSV } from '../../src/data/FitnessPatternLoader.js';
import {
  StarSequenceGenerator,
  validateStarTargets,
  type StarTarget,
} from '../../src/game/StarSequenceGenerator.js';
import type { FitnessPatternRecord } from '../../src/types/posture.js';

function makePattern(
  id: string,
  entries: Partial<Record<'leftHand' | 'rightHand' | 'head' | 'hip', number>>,
): FitnessPatternRecord {
  const partOrder = ['leftHand', 'rightHand', 'head', 'hip'] as const;
  const parts = partOrder.filter((part) => entries[part] !== undefined);
  const zoneIds = parts.map((part) => entries[part]!);
  const patternType = parts.length === 1
    ? 'S'
    : parts.length === 2
      ? 'D'
      : parts.length === 3
        ? 'T'
        : 'Q';

  return {
    id,
    patternType,
    name: id,
    leftHand: entries.leftHand ?? null,
    rightHand: entries.rightHand ?? null,
    head: entries.head ?? null,
    hip: entries.hip ?? null,
    partCount: parts.length,
    parts: [...parts],
    zoneIds,
    distinctZoneIds: Array.from(new Set(zoneIds)),
    partZoneMap: { ...entries },
  };
}

describe('StarSequenceGenerator (Issue #181 - CHOREO-STAR-001)', () => {
  it('CSV 패턴의 부위-존 쌍을 한 박에 별 하나씩, 순서가 지정된 목표로 분해한다', () => {
    const pattern = makePattern('Q001', {
      leftHand: 1,
      rightHand: 3,
      head: 4,
      hip: 6,
    });
    const generator = new StarSequenceGenerator([pattern], { seed: 17 });

    expect(generator.generateFromPattern(pattern, 8)).toEqual([
      { patternId: 'Q001', part: 'leftHand', zoneId: 1, beatIndex: 1 },
      { patternId: 'Q001', part: 'rightHand', zoneId: 3, beatIndex: 2 },
      { patternId: 'Q001', part: 'head', zoneId: 4, beatIndex: 3 },
      { patternId: 'Q001', part: 'hip', zoneId: 6, beatIndex: 4 },
    ] satisfies StarTarget[]);
  });

  it('360개 CSV 패턴 전체를 안전한 단일-별 시퀀스로 변환한다', () => {
    const csvPath = path.resolve(__dirname, '../../../fitness pattern.csv');
    const patterns = parseFitnessPatternCSV(fs.readFileSync(csvPath, 'utf-8'));
    const generator = new StarSequenceGenerator(patterns, { seed: 20260929 });

    expect(patterns).toHaveLength(360);

    for (const pattern of patterns) {
      const targets = generator.generateFromPattern(pattern, 8);
      expect(targets).toHaveLength(pattern.parts.length);
      expect(targets.map((target) => target.beatIndex)).toEqual(
        pattern.parts.map((_, index) => index + 1),
      );
      expect(validateStarTargets(targets).valid).toBe(true);
    }
  });

  it('남은 박 수에 맞는 짧은 안전 후보를 우선 선택하고, 직접 변환은 안전하게 절단한다', () => {
    const quad = makePattern('Q001', {
      leftHand: 1,
      rightHand: 3,
      head: 4,
      hip: 6,
    });
    const single = makePattern('S001', { leftHand: 4 });
    const generator = new StarSequenceGenerator([quad, single], { seed: 3 });

    const selected = generator.generate(1);
    expect(selected).toHaveLength(1);
    expect(selected[0].patternId).toBe('S001');
    expect(generator.generateFromPattern(quad, 2)).toEqual([
      { patternId: 'Q001', part: 'leftHand', zoneId: 1, beatIndex: 1 },
      { patternId: 'Q001', part: 'rightHand', zoneId: 3, beatIndex: 2 },
    ]);
  });

  it('동일 부위·동일 존 연속 반복과 장거리 왕복을 안전하지 않은 안무로 거부한다', () => {
    const repeated: StarTarget[] = [
      { patternId: 'S001', part: 'leftHand', zoneId: 4, beatIndex: 1 },
      { patternId: 'S002', part: 'leftHand', zoneId: 4, beatIndex: 2 },
    ];
    const longRoundTrip: StarTarget[] = [
      { patternId: 'S001', part: 'leftHand', zoneId: 1, beatIndex: 1 },
      { patternId: 'S002', part: 'leftHand', zoneId: 11, beatIndex: 2 },
      { patternId: 'S003', part: 'leftHand', zoneId: 1, beatIndex: 3 },
    ];

    expect(validateStarTargets(repeated).valid).toBe(false);
    expect(validateStarTargets(longRoundTrip).valid).toBe(false);
  });

  it('같은 seed와 같은 패턴 풀에서 결정적으로 동일한 시퀀스를 생성한다', () => {
    const csvPath = path.resolve(__dirname, '../../../fitness pattern.csv');
    const patterns = parseFitnessPatternCSV(fs.readFileSync(csvPath, 'utf-8'));
    const first = new StarSequenceGenerator(patterns, { seed: 42 });
    const second = new StarSequenceGenerator(patterns, { seed: 42 });

    expect(first.generate(4)).toEqual(second.generate(4));
  });
});
