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

export type FootKeynoteFoot = 'leftFoot' | 'rightFoot' | 'centerFoot';
export type FootKeynoteSource = 'knee-proxy' | 'keyboard' | 'virtual';

export interface FootKeynoteEvent {
  foot: FootKeynoteFoot;
  zoneId: 9 | 10 | 11;
  source: FootKeynoteSource;
  timestamp: number;
  confidence: number;
}
