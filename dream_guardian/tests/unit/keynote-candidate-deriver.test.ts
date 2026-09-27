import { describe, expect, it } from 'vitest';
import {
  createKeynoteSequence,
  deriveKeynoteCandidates,
} from '../../src/data/KeynoteCandidateDeriver.js';
import type { FitnessPatternRecord } from '../../src/types/posture.js';

function pattern(
  id: string,
  partZoneMap: FitnessPatternRecord['partZoneMap'],
): FitnessPatternRecord {
  const parts = Object.keys(partZoneMap) as FitnessPatternRecord['parts'];
  const zoneIds = Object.values(partZoneMap) as number[];

  return {
    id,
    patternType: parts.length === 1 ? 'S' : parts.length === 2 ? 'D' : parts.length === 3 ? 'T' : 'Q',
    name: id,
    leftHand: partZoneMap.leftHand ?? null,
    rightHand: partZoneMap.rightHand ?? null,
    head: partZoneMap.head ?? null,
    hip: partZoneMap.hip ?? null,
    partCount: parts.length,
    parts,
    zoneIds,
    distinctZoneIds: [...new Set(zoneIds)],
    partZoneMap,
  };
}

describe('KeynoteCandidateDeriver (Issue #196 - DATA-KEYNOTE-001)', () => {
  it('derives only hand Zones 1-5 and foot-role hip Zones 9-11 while preserving record order', () => {
    const records = [
      pattern('S001', { leftHand: 1 }),
      pattern('T001', { rightHand: 5, head: 4, hip: 10 }),
      pattern('D001', { leftHand: 6, hip: 8 }),
    ];

    expect(deriveKeynoteCandidates(records)).toEqual([
      { patternId: 'S001', part: 'leftHand', zoneId: 1, instrument: 'hand' },
      { patternId: 'T001', part: 'rightHand', zoneId: 5, instrument: 'hand' },
      { patternId: 'T001', part: 'hip', zoneId: 10, instrument: 'foot' },
    ]);
  });

  it('excludes every candidate from a Cross-Body violating record', () => {
    const records = [
      pattern('D_BAD', { leftHand: 1, hip: 10 }),
      pattern('D_SAFE', { rightHand: 4, hip: 9 }),
    ];

    expect(deriveKeynoteCandidates(records).map((candidate) => candidate.patternId)).toEqual([
      'D_SAFE',
      'D_SAFE',
    ]);
  });

  it('builds a deterministic 2-8 beat sequence of the requested 1-7 length without unsafe transitions', () => {
    const records = [
      pattern('S001', { leftHand: 1 }),
      pattern('S002', { leftHand: 1 }),
      pattern('S003', { leftHand: 3 }),
      pattern('S004', { rightHand: 5 }),
      pattern('S005', { hip: 9 }),
      pattern('S006', { hip: 11 }),
      pattern('S007', { rightHand: 4 }),
    ];

    const sequence = createKeynoteSequence(records, 4);

    expect(sequence).toEqual([
      { beat: 2, patternId: 'S001', part: 'leftHand', zoneId: 1, instrument: 'hand' },
      { beat: 3, patternId: 'S004', part: 'rightHand', zoneId: 5, instrument: 'hand' },
      { beat: 4, patternId: 'S005', part: 'hip', zoneId: 9, instrument: 'foot' },
      { beat: 5, patternId: 'S007', part: 'rightHand', zoneId: 4, instrument: 'hand' },
    ]);
  });

  it('rejects requested sequence lengths outside the seven available 2-8 beat slots', () => {
    const records = [pattern('S001', { leftHand: 1 })];

    expect(() => createKeynoteSequence(records, 0)).toThrow(RangeError);
    expect(() => createKeynoteSequence(records, 8)).toThrow(RangeError);
  });

  it('does not mutate the source records or their nested mappings', () => {
    const records = [pattern('D001', { leftHand: 4, hip: 10 })];
    const before = structuredClone(records);

    deriveKeynoteCandidates(records);
    createKeynoteSequence(records, 2);

    expect(records).toEqual(before);
  });
});
