import type { FootKeynoteEvent, FootKeynoteFoot } from '../types/keynote.js';

const FOOT_BY_ZONE: Record<9 | 10 | 11, FootKeynoteFoot> = {
  9: 'leftFoot',
  10: 'centerFoot',
  11: 'rightFoot',
};

export class FootKeynoteInput {
  private _isSafetyGuarded = false;

  setSafetyGuarded(isSafetyGuarded: boolean): void {
    this._isSafetyGuarded = isSafetyGuarded;
  }

  fromKeyboard(foot: FootKeynoteFoot, timestamp: number): FootKeynoteEvent | null {
    if (this._isSafetyGuarded) return null;
    const zoneId = foot === 'leftFoot' ? 9 : foot === 'rightFoot' ? 11 : 10;
    return { foot, zoneId, source: 'keyboard', timestamp, confidence: 1 };
  }

  fromVirtualPedal(zoneId: number, timestamp: number): FootKeynoteEvent | null {
    if (this._isSafetyGuarded || !isFootZone(zoneId)) return null;
    return {
      foot: FOOT_BY_ZONE[zoneId],
      zoneId,
      source: 'virtual',
      timestamp,
      confidence: 1,
    };
  }
}

function isFootZone(zoneId: number): zoneId is 9 | 10 | 11 {
  return zoneId === 9 || zoneId === 10 || zoneId === 11;
}
