/**
 * menu-input-dwell.test.ts - 합장 제스처 dwell + 히스테리시스 (Issue #724 / FEAT-INPUT-JOIN-001)
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { MenuInput } from '../../src/input/MenuInput';
import { DEFAULT_JOINED_HANDS_CONFIG } from '../../config/cursor.config';

const FRAME_DT = 0.016;
const CY = 0.5;

/** 두 손을 X축으로 distance 만큼 떨어뜨려 update 호출 */
function step(mi: MenuInput, distance: number, dt?: number, cx = 0.5) {
  const lx = cx - distance / 2;
  const rx = cx + distance / 2;
  return dt === undefined ? mi.update(lx, CY, rx, CY) : mi.update(lx, CY, rx, CY, dt);
}

function steps(mi: MenuInput, distance: number, frames: number, dt = FRAME_DT) {
  let r = step(mi, distance, dt);
  for (let i = 1; i < frames; i++) r = step(mi, distance, dt);
  return r;
}

describe('[#724] MenuInput 합장 dwell + 히스테리시스', () => {
  let mi: MenuInput;
  beforeEach(() => {
    mi = new MenuInput();
  });

  it('1. config 기본값 0.18 / 0.22 / 0.30 이며 동결되어 있다', () => {
    expect(DEFAULT_JOINED_HANDS_CONFIG.joinDistanceThreshold).toBe(0.18);
    expect(DEFAULT_JOINED_HANDS_CONFIG.releaseDistanceThreshold).toBe(0.22);
    expect(DEFAULT_JOINED_HANDS_CONFIG.requiredDwellSec).toBe(0.3);
    expect(Object.isFrozen(DEFAULT_JOINED_HANDS_CONFIG)).toBe(true);
  });

  it('2. 0.016초 × 18프레임(0.288초)은 비활성', () => {
    const r = steps(mi, 0.04, 18);
    expect(r.active).toBe(false);
    expect(mi.isActive).toBe(false);
  });

  it('3. 0.016초 × 19프레임(0.304초)은 활성', () => {
    const r = steps(mi, 0.04, 19);
    expect(r.active).toBe(true);
    expect(mi.isActive).toBe(true);
  });

  it('4. 활성 후 거리 0.20(히스테리시스 구간)이면 활성 유지', () => {
    steps(mi, 0.04, 19);
    const r = step(mi, 0.2, FRAME_DT);
    expect(r.active).toBe(true);
  });

  it('5. 활성 후 거리 0.23이면 즉시 비활성 + dwellSec 0', () => {
    steps(mi, 0.04, 19);
    const r = step(mi, 0.23, FRAME_DT);
    expect(r.active).toBe(false);
    expect(mi.dwellSec).toBe(0);
  });

  it('6. 비활성 적분 중 0.20 진입 시 dwell 유지 → 0.04 복귀 후 이어서 적분해 활성', () => {
    steps(mi, 0.04, 10);
    const before = mi.dwellSec;
    expect(before).toBeGreaterThan(0);
    steps(mi, 0.2, 5);
    expect(mi.dwellSec).toBe(before);
    expect(mi.isActive).toBe(false);
    const r = steps(mi, 0.04, 9);
    expect(r.active).toBe(true);
  });

  it('7. 비활성 적분 중 0.30 이탈 시 dwellSec 0', () => {
    steps(mi, 0.04, 10);
    expect(mi.dwellSec).toBeGreaterThan(0);
    step(mi, 0.3, FRAME_DT);
    expect(mi.dwellSec).toBe(0);
    expect(mi.isActive).toBe(false);
  });

  it('8. dt 미전달 / NaN / 음수 / Infinity는 0으로 취급되어 활성화되지 않음', () => {
    for (let i = 0; i < 50; i++) step(mi, 0.04);
    expect(mi.isActive).toBe(false);
    expect(mi.dwellSec).toBe(0);
    for (let i = 0; i < 50; i++) step(mi, 0.04, Number.NaN);
    expect(mi.isActive).toBe(false);
    for (let i = 0; i < 50; i++) step(mi, 0.04, -1);
    expect(mi.isActive).toBe(false);
    step(mi, 0.04, Number.POSITIVE_INFINITY);
    expect(mi.isActive).toBe(false);
    expect(mi.dwellSec).toBe(0);
  });

  it('9. 커서 중점은 활성 프레임에서만 갱신, 비활성 적분 중에는 0.5 불변', () => {
    steps(mi, 0.04, 18, FRAME_DT);
    // 중심 0.5 기준이므로 다른 중심으로 이동해 갱신 여부 확인
    const mi2 = new MenuInput();
    for (let i = 0; i < 18; i++) step(mi2, 0.04, FRAME_DT, 0.3);
    expect(mi2.cursorX).toBe(0.5);
    expect(mi2.cursorY).toBe(0.5);
    step(mi2, 0.04, FRAME_DT, 0.3);
    expect(mi2.isActive).toBe(true);
    expect(mi2.cursorX).toBeCloseTo(0.3);
    expect(mi2.cursorY).toBeCloseTo(0.5);
  });

  it('10. reset() 후 dwellSec 0, 비활성, 커서 0.5', () => {
    steps(mi, 0.04, 19);
    expect(mi.isActive).toBe(true);
    mi.reset();
    expect(mi.dwellSec).toBe(0);
    expect(mi.isActive).toBe(false);
    expect(mi.cursorX).toBe(0.5);
    expect(mi.cursorY).toBe(0.5);
  });

  it('11. 커스텀 config 부분 주입 (requiredDwellSec: 0.5)', () => {
    const custom = new MenuInput({ requiredDwellSec: 0.5 });
    steps(custom, 0.04, 19);
    expect(custom.isActive).toBe(false);
    const r = steps(custom, 0.04, 13); // 누적 0.512
    expect(r.active).toBe(true);
    // 기본 join 임계치 유지 확인: 0.19는 적분되지 않음 (히스테리시스 구간)
    const c2 = new MenuInput({ requiredDwellSec: 0.5 });
    steps(c2, 0.19, 40);
    expect(c2.isActive).toBe(false);
    expect(c2.dwellSec).toBe(0);
  });

  it('12. 기본 config 객체는 주입으로 변형되지 않는다', () => {
    new MenuInput({ joinDistanceThreshold: 0.1 });
    expect(DEFAULT_JOINED_HANDS_CONFIG.joinDistanceThreshold).toBe(0.18);
  });
});
