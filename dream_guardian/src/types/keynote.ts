import type { BodyPart } from './posture.js';

export type KeynotePart = Extract<BodyPart, 'leftHand' | 'rightHand' | 'hip'>;
export type KeynoteInstrument = 'hand' | 'foot';

export interface KeynoteCandidate {
  patternId: string;
  part: KeynotePart;
  zoneId: number;
  instrument: KeynoteInstrument;
}

export interface Keynote extends KeynoteCandidate {
  beat: number;
}
