/**
 * EventBus - 타입 안전 이벤트 버스
 *
 * TypeScript 제네릭 기반 시스템 간 메시징
 * 직접 참조 없이 모듈 독립성 확보
 *
 * @see Issue #4 (GitHub #69)
 */

import type { EventMap } from '../types/index.js';

type EventKey = keyof EventMap;
type EventCallback<K extends EventKey> = EventMap[K] extends undefined
  ? () => void
  : (payload: EventMap[K]) => void;

export class EventBus {
  private _listeners = new Map<EventKey, Set<EventCallback<EventKey>>>();

  /** 이벤트 리스너 등록 */
  on<K extends EventKey>(event: K, callback: EventCallback<K>): void {
    if (!this._listeners.has(event)) {
      this._listeners.set(event, new Set());
    }
    this._listeners.get(event)!.add(callback as EventCallback<EventKey>);
  }

  /** 이벤트 리스너 해제 */
  off<K extends EventKey>(event: K, callback: EventCallback<K>): void {
    const set = this._listeners.get(event);
    if (set) {
      set.delete(callback as EventCallback<EventKey>);
      if (set.size === 0) {
        this._listeners.delete(event);
      }
    }
  }

  /** 이벤트 발행 */
  emit<K extends EventKey>(
    event: K,
    ...args: EventMap[K] extends undefined ? [] : [EventMap[K]]
  ): void {
    const set = this._listeners.get(event);
    if (!set) return;
    for (const cb of set) {
      (cb as (...a: unknown[]) => void)(...args);
    }
  }

  /** 1회만 수신하고 자동 해제 */
  once<K extends EventKey>(event: K, callback: EventCallback<K>): void {
    const wrapper = ((...args: unknown[]) => {
      this.off(event, wrapper as EventCallback<K>);
      (callback as (...a: unknown[]) => void)(...args);
    }) as EventCallback<K>;
    this.on(event, wrapper);
  }

  /** 특정 이벤트의 모든 리스너 해제 */
  clear(event?: EventKey): void {
    if (event) {
      this._listeners.delete(event);
    } else {
      this._listeners.clear();
    }
  }

  /** 특정 이벤트의 리스너 수 */
  listenerCount(event: EventKey): number {
    return this._listeners.get(event)?.size ?? 0;
  }
}
