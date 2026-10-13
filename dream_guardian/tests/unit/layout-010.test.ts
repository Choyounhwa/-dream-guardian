/**
 * [LAYOUT-010] (Issue #581) 레이아웃 값 검증 규칙 단일화 및 글자 배율 textScale 규칙
 *
 * 1. getLayoutKeyRule export 및 단일화:
 *    - 가로 좌표 키 (x, w, width, left, right, gapX, startX 등): max: 1080, step: 1, integer: true
 *    - 세로 좌표 키 (y, h, height, top, bottom, gapY, startY 등): max: 2160, step: 1, integer: true
 *    - 크기 키 (w, h, width, height, size, radius, gap, cols 등): min: 1
 *    - 일반 좌표 키 (x, y, startX, startY, left, right, top, bottom 등): min: 0
 *    - textScale 키 (textScale, *TextScale, *.textScale): min: 0.5, max: 3.0, step: 0.01, integer: false
 * 2. applyLayoutOverride / validateLayoutPatch 가 getLayoutKeyRule 을 통해 검증:
 *    - textScale: 0.5~3.0 허용, 0.49, 0, -1, 3.01, 5 등 거부
 * 3. DevLayoutPanel 이 getLayoutKeyRule 을 참조하고 중복 정의 제거:
 *    - flattenLayoutBindings 바인딩에 getLayoutKeyRule 의 min/max/step/integer 반영
 *    - textScale 에 대한 nudgeValue 연동 (일반 ±0.01, Shift ±0.1, 0.5~3.0 클램프)
 */

import { describe, it, expect } from 'vitest';
import {
  getLayoutKeyRule,
  applyLayoutOverride,
  validateLayoutPatch,
  type LayoutKeyRule,
} from '../../src/core/UILayoutOverride.js';
import {
  flattenLayoutBindings,
  nudgeValue,
} from '../../src/dev/DevLayoutPanel.js';

describe('LAYOUT-010 getLayoutKeyRule 단일 검증 규칙', () => {
  it('가로/세로 좌표 및 크기 키에 대해 올바른 규칙을 반환한다', () => {
    // 가로 위치
    expect(getLayoutKeyRule('x')).toEqual<LayoutKeyRule>({ min: 0, max: 1080, step: 1, integer: true });
    expect(getLayoutKeyRule('startX')).toEqual<LayoutKeyRule>({ min: 0, max: 1080, step: 1, integer: true });
    expect(getLayoutKeyRule('gapX')).toEqual<LayoutKeyRule>({ min: 0, max: 1080, step: 1, integer: true });
    expect(getLayoutKeyRule('left')).toEqual<LayoutKeyRule>({ min: 0, max: 1080, step: 1, integer: true });
    expect(getLayoutKeyRule('right')).toEqual<LayoutKeyRule>({ min: 0, max: 1080, step: 1, integer: true });
    expect(getLayoutKeyRule('marginRight')).toEqual<LayoutKeyRule>({ min: 0, max: 1080, step: 1, integer: true });

    // 가로 크기
    expect(getLayoutKeyRule('w')).toEqual<LayoutKeyRule>({ min: 1, max: 1080, step: 1, integer: true });
    expect(getLayoutKeyRule('width')).toEqual<LayoutKeyRule>({ min: 1, max: 1080, step: 1, integer: true });
    expect(getLayoutKeyRule('cardWidth')).toEqual<LayoutKeyRule>({ min: 1, max: 1080, step: 1, integer: true });

    // 세로 위치
    expect(getLayoutKeyRule('y')).toEqual<LayoutKeyRule>({ min: 0, max: 2160, step: 1, integer: true });
    expect(getLayoutKeyRule('startY')).toEqual<LayoutKeyRule>({ min: 0, max: 2160, step: 1, integer: true });
    expect(getLayoutKeyRule('gapY')).toEqual<LayoutKeyRule>({ min: 0, max: 2160, step: 1, integer: true });
    expect(getLayoutKeyRule('top')).toEqual<LayoutKeyRule>({ min: 0, max: 2160, step: 1, integer: true });
    expect(getLayoutKeyRule('bottom')).toEqual<LayoutKeyRule>({ min: 0, max: 2160, step: 1, integer: true });

    // 세로 크기
    expect(getLayoutKeyRule('h')).toEqual<LayoutKeyRule>({ min: 1, max: 2160, step: 1, integer: true });
    expect(getLayoutKeyRule('height')).toEqual<LayoutKeyRule>({ min: 1, max: 2160, step: 1, integer: true });
    expect(getLayoutKeyRule('cardHeight')).toEqual<LayoutKeyRule>({ min: 1, max: 2160, step: 1, integer: true });
    expect(getLayoutKeyRule('cols')).toEqual<LayoutKeyRule>({ min: 1, max: 2160, step: 1, integer: true });

    // 추가 크기 키 (Size, Radius, Gap)
    expect(getLayoutKeyRule('size')).toEqual<LayoutKeyRule>({ min: 1, max: 2160, step: 1, integer: true });
    expect(getLayoutKeyRule('radius')).toEqual<LayoutKeyRule>({ min: 1, max: 2160, step: 1, integer: true });
    expect(getLayoutKeyRule('gap')).toEqual<LayoutKeyRule>({ min: 1, max: 2160, step: 1, integer: true });
  });

  it('대소문자 및 점(.) 포함 전체 경로가 전달되어도 올바른 규칙을 반환한다', () => {
    expect(getLayoutKeyRule('X')).toEqual<LayoutKeyRule>({ min: 0, max: 1080, step: 1, integer: true });
    expect(getLayoutKeyRule('Width')).toEqual<LayoutKeyRule>({ min: 1, max: 1080, step: 1, integer: true });
    expect(getLayoutKeyRule('Height')).toEqual<LayoutKeyRule>({ min: 1, max: 2160, step: 1, integer: true });
    expect(getLayoutKeyRule('Left')).toEqual<LayoutKeyRule>({ min: 0, max: 1080, step: 1, integer: true });
    expect(getLayoutKeyRule('Right')).toEqual<LayoutKeyRule>({ min: 0, max: 1080, step: 1, integer: true });
    expect(getLayoutKeyRule('Top')).toEqual<LayoutKeyRule>({ min: 0, max: 2160, step: 1, integer: true });
    expect(getLayoutKeyRule('Bottom')).toEqual<LayoutKeyRule>({ min: 0, max: 2160, step: 1, integer: true });
    expect(getLayoutKeyRule('menu.title.x')).toEqual<LayoutKeyRule>({ min: 0, max: 1080, step: 1, integer: true });
    expect(getLayoutKeyRule('hud.playerHpBar.w')).toEqual<LayoutKeyRule>({ min: 1, max: 1080, step: 1, integer: true });
  });

  it('textScale 관련 키는 0.5~3.0, step 0.01, integer: false 규칙을 반환한다', () => {
    const expected: LayoutKeyRule = { min: 0.5, max: 3.0, step: 0.01, integer: false };
    expect(getLayoutKeyRule('textScale')).toEqual(expected);
    expect(getLayoutKeyRule('titleTextScale')).toEqual(expected);
    expect(getLayoutKeyRule('menu.title.textScale')).toEqual(expected);
    expect(getLayoutKeyRule('hud.comboTextScale')).toEqual(expected);
  });
});

describe('LAYOUT-010 applyLayoutOverride 및 validateLayoutPatch 의 textScale 검증', () => {
  it('0.5 ~ 3.0 범위의 textScale 은 정상 적용된다', () => {
    const target = {
      menu: {
        textScale: 1.0,
        title: { textScale: 1.2 },
      },
    };

    const res = applyLayoutOverride(target, {
      menu: {
        textScale: 0.5,
        title: { textScale: 3.0 },
      },
    });

    expect(res.warnings).toEqual([]);
    expect(target.menu.textScale).toBe(0.5);
    expect(target.menu.title.textScale).toBe(3.0);
  });

  it('0.5 미만(0.49, 0, -1) 또는 3.0 초과(3.01, 5)의 textScale 은 거부되고 경고를 반환한다', () => {
    const target = {
      titleTextScale: 1.0,
      subTextScale: 1.5,
      zeroTextScale: 1.0,
      negTextScale: 1.0,
      largeTextScale: 2.0,
    };

    const res = applyLayoutOverride(target, {
      titleTextScale: 0.49,
      subTextScale: 3.01,
      zeroTextScale: 0,
      negTextScale: -1,
      largeTextScale: 5.0,
    });

    expect(res.warnings.length).toBe(5);
    expect(target.titleTextScale).toBe(1.0);
    expect(target.subTextScale).toBe(1.5);
    expect(target.zeroTextScale).toBe(1.0);
    expect(target.negTextScale).toBe(1.0);
    expect(target.largeTextScale).toBe(2.0);
  });

  it('validateLayoutPatch 는 원본 객체를 변형하지 않고 동일한 검증 결과를 반환한다', () => {
    const target = {
      card: { w: 300, textScale: 1.0 },
    };

    const patchValid = { card: { textScale: 1.5 } };
    const resValid = validateLayoutPatch(target, patchValid);
    expect(resValid.warnings).toEqual([]);
    expect(target.card.textScale).toBe(1.0); // 원본 보존

    const patchInvalid = { card: { textScale: 0.2 } };
    const resInvalid = validateLayoutPatch(target, patchInvalid);
    expect(resInvalid.warnings.length).toBe(1);
    expect(target.card.textScale).toBe(1.0); // 원본 보존
  });
});

describe('LAYOUT-010 DevLayoutPanel 과 단일 규칙 연동', () => {
  it('flattenLayoutBindings 가 getLayoutKeyRule 의 min/max/step/integer 를 바인딩에 포함한다', () => {
    const fakeLayout = {
      menu: {
        x: 100,
        w: 500,
        textScale: 1.25,
      },
    };

    const bindings = flattenLayoutBindings(fakeLayout, []);
    const xBinding = bindings.find((b) => b.path === 'menu.x')!;
    const wBinding = bindings.find((b) => b.path === 'menu.w')!;
    const scaleBinding = bindings.find((b) => b.path === 'menu.textScale')!;

    expect(xBinding.min).toBe(0);
    expect(xBinding.max).toBe(1080);
    expect(xBinding.step).toBe(1);
    expect(xBinding.integer).toBe(true);

    expect(wBinding.min).toBe(1);
    expect(wBinding.max).toBe(1080);
    expect(wBinding.step).toBe(1);
    expect(wBinding.integer).toBe(true);

    expect(scaleBinding.min).toBe(0.5);
    expect(scaleBinding.max).toBe(3.0);
    expect(scaleBinding.step).toBe(0.01);
    expect(scaleBinding.integer).toBe(false);
  });

  it('nudgeValue 에 textScale 의 step(0.01)을 전달하면 단일 클릭 시 ±0.01, Shift 시 ±0.1 로 동작하고 0.5~3.0 으로 클램프된다', () => {
    const rule = getLayoutKeyRule('textScale');

    // 일반 증감 (+0.01, -0.01)
    expect(nudgeValue(1.0, 1, false, rule.step, rule.min, rule.max)).toBe(1.01);
    expect(nudgeValue(1.0, -1, false, rule.step, rule.min, rule.max)).toBe(0.99);

    // Shift 증감 (10배: +0.1, -0.1)
    expect(nudgeValue(1.0, 1, true, rule.step, rule.min, rule.max)).toBe(1.1);
    expect(nudgeValue(1.0, -1, true, rule.step, rule.min, rule.max)).toBe(0.9);

    // 최소치 클램프 (0.5)
    expect(nudgeValue(0.505, -1, false, rule.step, rule.min, rule.max)).toBe(0.5);
    expect(nudgeValue(0.55, -1, true, rule.step, rule.min, rule.max)).toBe(0.5);

    // 최대치 클램프 (3.0)
    expect(nudgeValue(2.995, 1, false, rule.step, rule.min, rule.max)).toBe(3.0);
    expect(nudgeValue(2.95, 1, true, rule.step, rule.min, rule.max)).toBe(3.0);
  });
});
