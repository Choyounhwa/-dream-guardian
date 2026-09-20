import { describe, it, expect } from 'vitest';
import { AnswerSelector, CURSOR_COLORS } from '../../src/input/AnswerSelector.js';
import { MenuInput } from '../../src/input/MenuInput.js';
import { KeyboardInput } from '../../src/input/KeyboardInput.js';

// ═══════════════════════════════════
// AnswerSelector
// ═══════════════════════════════════

describe('AnswerSelector', () => {
  it('10개 존이 정의되어 있다', () => {
    const as = new AnswerSelector();
    expect(as.zones).toHaveLength(10);
  });

  it('4색 커서 색상이 정의되어 있다', () => {
    expect(CURSOR_COLORS.leftHand).toBe('#28E6FF');
    expect(CURSOR_COLORS.rightHand).toBe('#FFCB4D');
    expect(CURSOR_COLORS.shoulder).toBe('#C889FF');
    expect(CURSOR_COLORS.hip).toBe('#FF865E');
  });

  it('커서가 존 안에 있으면 progress가 증가한다', () => {
    const as = new AnswerSelector(1.0, 1.0, 1.0);
    // 좌상 존(id=1): x=0.05~0.33, y=0.05~0.30
    const result = as.update('leftHand', 0.2, 0.15, 0.5);
    expect(result).not.toBeNull();
    expect(result!.zoneId).toBe(1);
    expect(result!.progress).toBeGreaterThan(0);
    expect(result!.confirmed).toBe(false);
  });

  it('1초 연속 체류 시 선택이 확정된다', () => {
    const as = new AnswerSelector(1.0, 1.0, 1.0);
    as.update('leftHand', 0.2, 0.15, 0.5);
    const result = as.update('leftHand', 0.2, 0.15, 0.5);
    expect(result).not.toBeNull();
    expect(result!.confirmed).toBe(true);
  });

  it('중심 가중치가 가장자리보다 높다', () => {
    const as = new AnswerSelector(1.0, 1.5, 0.75);
    // 존 중심 근처
    const center = as.update('leftHand', 0.19, 0.17, 0.3);
    as.reset();
    // 존 가장자리
    const edge = as.update('leftHand', 0.06, 0.06, 0.3);
    expect(center!.progress).toBeGreaterThan(edge!.progress);
  });

  it('어깨 커서는 중간존(4,5,6,7,8)만 사용 가능', () => {
    const as = new AnswerSelector();
    // 좌상 존(id=1)에 어깨 커서 → null
    const result = as.update('shoulder', 0.2, 0.15, 0.5);
    expect(result).toBeNull();
    // 좌 존(id=4)에 어깨 커서 → 유효
    const result2 = as.update('shoulder', 0.2, 0.45, 0.5);
    expect(result2).not.toBeNull();
  });

  it('엉덩이 커서는 하단존(6~10)만 사용 가능', () => {
    const as = new AnswerSelector();
    // 좌상(id=1)에 엉덩이 → null
    const result = as.update('hip', 0.2, 0.15, 0.5);
    expect(result).toBeNull();
    // 좌하(id=6)에 엉덩이 → 유효
    const result2 = as.update('hip', 0.2, 0.65, 0.5);
    expect(result2).not.toBeNull();
  });

  it('reset()이 모든 진행도를 초기화한다', () => {
    const as = new AnswerSelector();
    as.update('leftHand', 0.2, 0.15, 0.5);
    as.reset();
    expect(as.getProgress(1, 'leftHand')).toBe(0);
  });
});

// ═══════════════════════════════════
// MenuInput
// ═══════════════════════════════════

describe('MenuInput', () => {
  it('양손이 가까우면 합장이 감지된다', () => {
    const mi = new MenuInput();
    const result = mi.update(0.5, 0.5, 0.52, 0.51);
    expect(result.active).toBe(true);
    expect(mi.isActive).toBe(true);
  });

  it('양손이 멀면 합장이 감지되지 않는다', () => {
    const mi = new MenuInput();
    const result = mi.update(0.1, 0.5, 0.9, 0.5);
    expect(result.active).toBe(false);
    expect(mi.isActive).toBe(false);
  });

  it('합장 시 중점이 커서 좌표가 된다', () => {
    const mi = new MenuInput();
    const result = mi.update(0.4, 0.6, 0.42, 0.62);
    expect(result.active).toBe(true);
    expect(result.x).toBeCloseTo(0.41);
    expect(result.y).toBeCloseTo(0.61);
  });

  it('reset()이 상태를 초기화한다', () => {
    const mi = new MenuInput();
    mi.update(0.5, 0.5, 0.52, 0.51);
    mi.reset();
    expect(mi.isActive).toBe(false);
  });
});

// ═══════════════════════════════════
// KeyboardInput
// ═══════════════════════════════════

describe('KeyboardInput', () => {
  it('초기 상태에서 enabled가 false이다', () => {
    const ki = new KeyboardInput();
    expect(ki.enabled).toBe(false);
  });

  it('destroy()가 에러 없이 동작한다', () => {
    const ki = new KeyboardInput();
    expect(() => ki.destroy()).not.toThrow();
  });

  it('isRunning / isSquatting 초기값이 false이다', () => {
    const ki = new KeyboardInput();
    expect(ki.isRunning).toBe(false);
    expect(ki.isSquatting).toBe(false);
  });
});
