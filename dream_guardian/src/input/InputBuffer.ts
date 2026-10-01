/**
 * InputBuffer - 선행 입력 버퍼(Pre-input Buffer) 공용 큐 모듈
 *
 * 판정창 개시 전 일정 시간(preBufferWindow) 이내의 유효 입력을 저장하고,
 * 창 개시 시점에 단 1회 소비하여 조기 입력(선행 모션)을 안전하게 인정한다.
 *
 * @see Issue #251 [INPUT-TOLERANCE-003]
 */

export interface BufferedInput<T> {
  item: T;
  timestamp: number;
}

export class InputBuffer<T> {
  private _buffer: BufferedInput<T>[] = [];

  constructor(public maxWindow = 0.20) {}

  /**
   * 새로운 입력을 버퍼에 추가
   */
  push(item: T, timestamp: number): void {
    this._buffer.push({ item, timestamp });
  }

  /**
   * 만료된 버퍼 항목 정리 (currentTime - timestamp > window)
   */
  cleanExpired(currentTime: number, window = this.maxWindow): void {
    this._buffer = this._buffer.filter(
      (entry) => currentTime - entry.timestamp <= window + 1e-9
    );
  }

  /**
   * 조건을 만족하는 가장 적합한 입력을 찾아 1회 소비 후 큐에서 제거
   */
  consume(
    predicate: (item: T) => boolean,
    currentTime?: number,
    window = this.maxWindow
  ): T | null {
    if (currentTime !== undefined) {
      this.cleanExpired(currentTime, window);
    }

    const idx = this._buffer.findIndex((entry) => {
      if (!predicate(entry.item)) return false;
      if (currentTime !== undefined && currentTime - entry.timestamp > window + 1e-9) {
        return false;
      }
      return true;
    });

    if (idx === -1) return null;

    const [matched] = this._buffer.splice(idx, 1);
    return matched.item;
  }

  /**
   * 버퍼 내 항목 검사 (제거하지 않음)
   */
  peek(predicate?: (item: T) => boolean): T | null {
    if (!predicate) {
      return this._buffer.length > 0 ? this._buffer[this._buffer.length - 1].item : null;
    }
    const found = this._buffer.find((entry) => predicate(entry.item));
    return found ? found.item : null;
  }

  get size(): number {
    return this._buffer.length;
  }

  clear(): void {
    this._buffer = [];
  }
}
