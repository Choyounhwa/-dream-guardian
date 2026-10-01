import { describe, it, expect } from 'vitest';
import { InputBuffer } from '../../src/input/InputBuffer.js';

describe('InputBuffer - Issue #251 [INPUT-TOLERANCE-003]', () => {
  it('창 열리기 0.15s 전 입력이 버퍼에 저장되고 창 개시 시점에 성공으로 소비된다', () => {
    const buffer = new InputBuffer<string>(0.20);
    // 창 개시가 2.60s일 때 2.45s에 입력
    buffer.push('jump', 2.45);

    expect(buffer.size).toBe(1);

    // 2.60s 창 개시 시점에 소비 (0.15s 경과 -> 0.20s 이내 유효)
    const consumed = buffer.consume((action) => action === 'jump', 2.60);
    expect(consumed).toBe('jump');
    expect(buffer.size).toBe(0);
  });

  it('창 열리기 0.30s 전(버퍼 윈도 0.20s 초과) 입력은 버려진다', () => {
    const buffer = new InputBuffer<string>(0.20);
    // 2.30s에 입력 (2.60s 기준 0.30s 전)
    buffer.push('jump', 2.30);

    const consumed = buffer.consume((action) => action === 'jump', 2.60);
    expect(consumed).toBeNull();
  });

  it('버퍼 소비는 1회만 발생하고 동일 입력이 중복 판정되지 않는다', () => {
    const buffer = new InputBuffer<string>(0.20);
    buffer.push('jump', 2.50);

    // 1회차 소비 성공
    const firstConsume = buffer.consume((action) => action === 'jump', 2.60);
    expect(firstConsume).toBe('jump');

    // 2회차 소비 시도 -> 이미 소비되었으므로 null
    const secondConsume = buffer.consume((action) => action === 'jump', 2.60);
    expect(secondConsume).toBeNull();
  });
});
