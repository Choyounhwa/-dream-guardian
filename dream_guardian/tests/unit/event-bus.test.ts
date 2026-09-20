import { describe, it, expect, vi } from 'vitest';
import { EventBus } from '../../src/core/EventBus.js';

/**
 * EventBus 단위 테스트
 * - 리스너 등록/해제 및 메모리 누수 방지
 * - 다중 구독 및 페이로드 전달 검증
 */

describe('EventBus', () => {
  it('on/emit으로 이벤트를 발행하고 수신한다', () => {
    const bus = new EventBus();
    const handler = vi.fn();

    bus.on('answer:correct', handler);
    bus.emit('answer:correct', { mana: 25, combo: 1 });

    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler).toHaveBeenCalledWith({ mana: 25, combo: 1 });
  });

  it('다중 구독자에게 모두 이벤트가 전달된다', () => {
    const bus = new EventBus();
    const h1 = vi.fn();
    const h2 = vi.fn();
    const h3 = vi.fn();

    bus.on('boss:hit', h1);
    bus.on('boss:hit', h2);
    bus.on('boss:hit', h3);

    bus.emit('boss:hit', { bossHp: 6 });

    expect(h1).toHaveBeenCalledWith({ bossHp: 6 });
    expect(h2).toHaveBeenCalledWith({ bossHp: 6 });
    expect(h3).toHaveBeenCalledWith({ bossHp: 6 });
  });

  it('off로 리스너를 해제하면 더 이상 수신하지 않는다', () => {
    const bus = new EventBus();
    const handler = vi.fn();

    bus.on('answer:wrong', handler);
    bus.emit('answer:wrong', { hp: 75 });
    expect(handler).toHaveBeenCalledTimes(1);

    bus.off('answer:wrong', handler);
    bus.emit('answer:wrong', { hp: 50 });
    expect(handler).toHaveBeenCalledTimes(1); // 추가 호출 없음
  });

  it('once로 등록하면 1회 수신 후 자동 해제된다', () => {
    const bus = new EventBus();
    const handler = vi.fn();

    bus.once('mana:full', handler);
    bus.emit('mana:full', { mana: 100 });
    bus.emit('mana:full', { mana: 100 });

    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('undefined 페이로드 이벤트도 정상 작동한다', () => {
    const bus = new EventBus();
    const handler = vi.fn();

    bus.on('player:dead', handler);
    bus.emit('player:dead');

    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('clear()로 특정 이벤트의 모든 리스너를 해제한다', () => {
    const bus = new EventBus();
    const h1 = vi.fn();
    const h2 = vi.fn();

    bus.on('motion:run', h1);
    bus.on('motion:run', h2);
    bus.clear('motion:run');

    bus.emit('motion:run', { gauge: 50 });
    expect(h1).not.toHaveBeenCalled();
    expect(h2).not.toHaveBeenCalled();
  });

  it('clear()로 전체 리스너를 해제한다', () => {
    const bus = new EventBus();
    bus.on('motion:run', vi.fn());
    bus.on('boss:hit', vi.fn());
    bus.on('answer:correct', vi.fn());

    bus.clear();
    expect(bus.listenerCount('motion:run')).toBe(0);
    expect(bus.listenerCount('boss:hit')).toBe(0);
    expect(bus.listenerCount('answer:correct')).toBe(0);
  });

  it('listenerCount가 정확한 수를 반환한다', () => {
    const bus = new EventBus();
    expect(bus.listenerCount('boss:hit')).toBe(0);

    const h1 = vi.fn();
    const h2 = vi.fn();
    bus.on('boss:hit', h1);
    bus.on('boss:hit', h2);
    expect(bus.listenerCount('boss:hit')).toBe(2);

    bus.off('boss:hit', h1);
    expect(bus.listenerCount('boss:hit')).toBe(1);
  });

  it('존재하지 않는 이벤트에 emit해도 에러가 발생하지 않는다', () => {
    const bus = new EventBus();
    expect(() => bus.emit('gauge:full')).not.toThrow();
  });

  it('동일 콜백을 중복 등록하면 1번만 등록된다 (Set 기반)', () => {
    const bus = new EventBus();
    const handler = vi.fn();

    bus.on('shield:activate', handler);
    bus.on('shield:activate', handler);

    expect(bus.listenerCount('shield:activate')).toBe(1);

    bus.emit('shield:activate');
    expect(handler).toHaveBeenCalledTimes(1);
  });
});
