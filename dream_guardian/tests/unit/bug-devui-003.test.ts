/**
 * [BUG-DEVUI-003] (Issue #693) HUD 계열 UI 요소 좌표 스케일링 누락으로 인한 Dev 인스펙터 점선 위치 불일치 수정 단위 테스트
 *
 * 1. HUD 4개 요소 (comboBadge, playerHpBar, bossHpBar, bossName)의 getBounds가
 *    물리 화면 뷰포트(vw, vh)에 맞춰 virtualRectToScreen을 거친 정확한 화면 좌표를 반환하는지 검증
 * 2. HUDLayer의 getBounds 메서드들이 1080x2160 가상 좌표계 기준으로 일관되게 바운딩 박스를 반환하는지 검증
 * 3. comboBadge의 명시적 x 프로퍼티 지원 및 getLayoutCoordinates / setLayoutCoordinates를 통한 위치 이동 검증
 */

import { describe, it, expect, afterEach } from 'vitest';
import { UI_LAYOUT } from '../../config/ui.config';
import { applyLayoutOverride } from '../../src/core/UILayoutOverride';
import {
  getInspectableElements,
  findElementByPath,
  getLayoutCoordinates,
  setLayoutCoordinates,
} from '../../src/dev/LayoutRegistry';
import { HUDLayer } from '../../src/ui/HUDLayer';

const PRISTINE = JSON.parse(JSON.stringify(UI_LAYOUT));

afterEach(() => {
  applyLayoutOverride(UI_LAYOUT, PRISTINE);
});

describe('BUG-DEVUI-003: HUD 계열 UI 요소 좌표 스케일링 및 위치 표시 동기화', () => {
  const mockApp = {
    hudLayer: new HUDLayer(),
    stateMachine: { currentState: 'RUN_QUESTION' },
  } as any;

  it('1. 540x960 뷰포트에서 hud.comboBadge의 getBounds는 화면 스케일에 맞게 축소된 좌표를 반환해야 한다', () => {
    const vw = 540;
    const vh = 960;
    const sx = vw / 1080; // 0.5
    const sy = vh / 2160; // 0.4444...

    const elements = getInspectableElements('RUN_QUESTION', mockApp, vw, vh);
    const badgeEl = findElementByPath(elements, 'hud.comboBadge');
    expect(badgeEl).toBeDefined();

    const bounds = badgeEl!.getBounds(vw, vh);

    const slot = UI_LAYOUT.hud.comboBadge!;
    const virtualW = slot.w;
    const virtualH = slot.h;
    const virtualX = slot.x !== undefined ? slot.x : 1080 - virtualW - (slot.marginRight ?? 24);
    const virtualY = slot.y;

    const expectedX = virtualX * sx;
    const expectedY = virtualY * sy;
    const expectedW = virtualW * sx;
    const expectedH = virtualH * sy;

    // 물리 픽셀에 가상 픽셀(160, 407 등)이 직접 대입되거나 단위 혼용 뺄셈이 발생하지 않아야 함
    expect(bounds.x).toBeCloseTo(expectedX, 1);
    expect(bounds.y).toBeCloseTo(expectedY, 1);
    expect(bounds.w).toBeCloseTo(expectedW, 1);
    expect(bounds.h).toBeCloseTo(expectedH, 1);
  });

  it('2. 540x960 뷰포트에서 playerHpBar, bossHpBar, bossName의 getBounds도 virtualRectToScreen과 정확히 일치해야 한다', () => {
    const vw = 540;
    const vh = 960;
    const sx = vw / 1080;
    const sy = vh / 2160;

    const elements = getInspectableElements('RUN_QUESTION', mockApp, vw, vh);

    // playerHpBar
    const playerHpEl = findElementByPath(elements, 'hud.playerHpBar')!;
    expect(playerHpEl).toBeDefined();
    const playerBounds = playerHpEl.getBounds(vw, vh);
    const pSlot = UI_LAYOUT.hud.playerHpBar;
    expect(playerBounds.x).toBeCloseTo(pSlot.x * sx, 1);
    expect(playerBounds.y).toBeCloseTo(pSlot.y * sy, 1);
    expect(playerBounds.h).toBeCloseTo(pSlot.h * sy, 1);

    // bossHpBar
    const bossHpEl = findElementByPath(elements, 'hud.bossHpBar')!;
    expect(bossHpEl).toBeDefined();
    const bossBounds = bossHpEl.getBounds(vw, vh);
    const bSlot = UI_LAYOUT.hud.bossHpBar;
    expect(bossBounds.y).toBeCloseTo(bSlot.y * sy, 1);
    expect(bossBounds.h).toBeCloseTo(bSlot.h * sy, 1);

    // bossName
    const bossNameEl = findElementByPath(elements, 'hud.bossName')!;
    expect(bossNameEl).toBeDefined();
    const nameBounds = bossNameEl.getBounds(vw, vh);
    const nSlot = UI_LAYOUT.hud.bossName;
    expect(nameBounds.x).toBeCloseTo(nSlot.x * sx, 1);
    expect(nameBounds.y).toBeCloseTo(nSlot.y * sy, 1);
    expect(nameBounds.w).toBeCloseTo(nSlot.w * sx, 1);
    expect(nameBounds.h).toBeCloseTo(nSlot.h * sy, 1);
  });

  it('3. HUDLayer 내부 get*Bounds 메서드는 1080x2160 가상 해상도 기준 좌표를 순수하게 반환해야 한다', () => {
    const hud = new HUDLayer();
    const cBounds = hud.getComboBounds(1080, 2160);
    const slot = UI_LAYOUT.hud.comboBadge!;
    const expectedVirtualX = slot.x !== undefined ? slot.x : 1080 - slot.w - slot.marginRight;
    expect(cBounds.x).toBe(expectedVirtualX);
    expect(cBounds.y).toBe(slot.y);
    expect(cBounds.w).toBe(slot.w);
    expect(cBounds.h).toBe(slot.h);
  });

  it('4. comboBadge에 명시적 x가 부여되었을 때 getLayoutCoordinates / setLayoutCoordinates로 이동이 가능해야 한다', () => {
    // x 속성 추가 설정
    (UI_LAYOUT.hud.comboBadge as any).x = 600;
    const coords = getLayoutCoordinates('hud.comboBadge');
    expect(coords).not.toBeNull();
    expect(coords?.x).toBe(600);
    expect(coords?.y).toBe(UI_LAYOUT.hud.comboBadge!.y);

    // 새 좌표 설정
    const updated = setLayoutCoordinates('hud.comboBadge', { x: 750, y: 120 });
    expect(updated).toBe(true);
    expect((UI_LAYOUT.hud.comboBadge as any).x).toBe(750);
    expect(UI_LAYOUT.hud.comboBadge!.y).toBe(120);

    // LayoutRegistry getBounds에도 x 반영 확인
    const elements = getInspectableElements('RUN_QUESTION', mockApp, 540, 960);
    const badgeEl = findElementByPath(elements, 'hud.comboBadge')!;
    const bounds = badgeEl.getBounds(540, 960);
    expect(bounds.x).toBeCloseTo(750 * (540 / 1080), 1);
    expect(bounds.y).toBeCloseTo(120 * (960 / 2160), 1);
  });

  it('5. app.hudLayer가 없을 때의 Fallback getBounds도 virtualRectToScreen을 적용해야 한다', () => {
    // app.hudLayer가 없는 null 상태
    const elements = getInspectableElements('RUN_QUESTION', null, 540, 960);
    const badgeEl = findElementByPath(elements, 'hud.comboBadge')!;
    const bounds = badgeEl.getBounds(540, 960);

    const slot = UI_LAYOUT.hud.comboBadge!;
    const virtualX = slot.x !== undefined ? slot.x : 1080 - slot.w - slot.marginRight;
    expect(bounds.x).toBeCloseTo(virtualX * (540 / 1080), 1);
    expect(bounds.y).toBeCloseTo(slot.y * (960 / 2160), 1);
    expect(bounds.w).toBeCloseTo(slot.w * (540 / 1080), 1);
    expect(bounds.h).toBeCloseTo(slot.h * (960 / 2160), 1);
  });
});
