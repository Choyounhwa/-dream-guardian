import type { FootKeynoteEvent, FootKeynoteFoot } from '../types/keynote.js';

const FOOT_BY_ZONE: Record<9 | 10 | 11, FootKeynoteFoot> = {
  9: 'leftFoot',
  10: 'centerFoot',
  11: 'rightFoot',
};

export class FootKeynoteInput {
  private _isSafetyGuarded = false;
  private _listeners: ((event: FootKeynoteEvent) => void)[] = [];

  setSafetyGuarded(isSafetyGuarded: boolean): void {
    this._isSafetyGuarded = isSafetyGuarded;
  }

  get isSafetyGuarded(): boolean {
    return this._isSafetyGuarded;
  }

  onEvent(listener: (event: FootKeynoteEvent) => void): () => void {
    this._listeners.push(listener);
    return () => {
      this._listeners = this._listeners.filter((l) => l !== listener);
    };
  }

  routeEvent(event: FootKeynoteEvent | null): FootKeynoteEvent | null {
    if (!event || this._isSafetyGuarded) return null;
    for (const listener of this._listeners) {
      listener(event);
    }
    return event;
  }

  fromKeyboard(foot: FootKeynoteFoot, timestamp: number): FootKeynoteEvent | null {
    if (this._isSafetyGuarded) return null;
    const zoneId = foot === 'leftFoot' ? 9 : foot === 'rightFoot' ? 11 : 10;
    const event: FootKeynoteEvent = { foot, zoneId, source: 'keyboard', timestamp, confidence: 1 };
    return this.routeEvent(event);
  }

  fromVirtualPedal(zoneId: number, timestamp: number): FootKeynoteEvent | null {
    if (this._isSafetyGuarded || !isFootZone(zoneId)) return null;
    const event: FootKeynoteEvent = {
      foot: FOOT_BY_ZONE[zoneId],
      zoneId,
      source: 'virtual',
      timestamp,
      confidence: 1,
    };
    return this.routeEvent(event);
  }
}

function isFootZone(zoneId: number): zoneId is 9 | 10 | 11 {
  return zoneId === 9 || zoneId === 10 || zoneId === 11;
}
