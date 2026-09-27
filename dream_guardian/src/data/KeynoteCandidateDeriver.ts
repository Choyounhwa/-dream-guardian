import { isCrossBodyViolation } from '../../config/zone.config.js';
import type { FitnessPatternRecord } from '../types/posture.js';
import type { Keynote, KeynoteCandidate, KeynotePart } from '../types/keynote.js';

const MIN_SEQUENCE_LENGTH = 1;
const MAX_SEQUENCE_LENGTH = 7;

export function deriveKeynoteCandidates(
  records: readonly FitnessPatternRecord[],
): KeynoteCandidate[] {
  const candidates: KeynoteCandidate[] = [];

  for (const record of records) {
    if (hasCrossBodyViolation(record)) continue;

    for (const part of ['leftHand', 'rightHand', 'hip'] as const) {
      const zoneId = record.partZoneMap[part];
      if (zoneId === undefined || !isKeynoteZone(part, zoneId)) continue;

      candidates.push({
        patternId: record.id,
        part,
        zoneId,
        instrument: part === 'hip' ? 'foot' : 'hand',
      });
    }
  }

  return candidates;
}

export function createKeynoteSequence(
  records: readonly FitnessPatternRecord[],
  length: number,
): Keynote[] {
  if (!Number.isInteger(length) || length < MIN_SEQUENCE_LENGTH || length > MAX_SEQUENCE_LENGTH) {
    throw new RangeError(`Keynote sequence length must be an integer from ${MIN_SEQUENCE_LENGTH} to ${MAX_SEQUENCE_LENGTH}.`);
  }

  const sequence: KeynoteCandidate[] = [];
  for (const candidate of deriveKeynoteCandidates(records)) {
    const previous = sequence[sequence.length - 1];
    if (previous && isUnsafeTransition(previous, candidate)) continue;

    sequence.push(candidate);
    if (sequence.length === length) break;
  }

  return sequence.map((candidate, index) => ({
    beat: index + 2,
    ...candidate,
  }));
}

function hasCrossBodyViolation(record: FitnessPatternRecord): boolean {
  const hipZone = record.partZoneMap.hip;
  if (hipZone === undefined) return false;

  const leftHandZone = record.partZoneMap.leftHand;
  const rightHandZone = record.partZoneMap.rightHand;
  return (
    (leftHandZone !== undefined && isCrossBodyViolation(leftHandZone, hipZone)) ||
    (rightHandZone !== undefined && isCrossBodyViolation(rightHandZone, hipZone))
  );
}

function isKeynoteZone(part: KeynotePart, zoneId: number): boolean {
  if (part === 'hip') return zoneId >= 9 && zoneId <= 11;
  return zoneId >= 1 && zoneId <= 5;
}

function isUnsafeTransition(previous: KeynoteCandidate, next: KeynoteCandidate): boolean {
  if (previous.part !== next.part) return false;
  if (previous.zoneId === next.zoneId) return true;
  return isLongDistanceReversal(previous.zoneId, next.zoneId);
}

function isLongDistanceReversal(fromZone: number, toZone: number): boolean {
  return (
    (fromZone === 1 && toZone === 3) ||
    (fromZone === 3 && toZone === 1) ||
    (fromZone === 4 && toZone === 5) ||
    (fromZone === 5 && toZone === 4) ||
    (fromZone === 9 && toZone === 11) ||
    (fromZone === 11 && toZone === 9)
  );
}
