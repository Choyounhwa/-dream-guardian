/**
 * bug-ui-editor-007.test.ts
 *
 * Issue #555 ([BUG-UI-EDITOR-007] 미리보기 모듈 순환 import TDZ ReferenceError로 미리보기 캔버스 미생성)
 *
 * 검증 항목:
 * 1. UIPageAdapters를 최초 진입점으로 import(모듈 캐시 초기화 후) 시 TDZ ReferenceError 발생 여부
 * 2. 10개 페이지 어댑터가 defaultPageAdapterRegistry에 모두 등록되는지 여부
 * 3. UIHazardPage 및 UIBossPage에서 ARTBOARD_WIDTH/HEIGHT 접근 시 예외 없이 상수가 평가되는지 여부
 */

import { describe, it, expect, vi } from 'vitest';

describe('[BUG-UI-EDITOR-007] UI 에디터 미리보기 모듈 순환 import TDZ 제거 검증', () => {
  it('UIPageAdapters를 최초 진입점으로 import할 때 TDZ ReferenceError 없이 10개 어댑터가 등록되어야 한다', async () => {
    vi.resetModules();
    const { defaultPageAdapterRegistry, ARTBOARD_WIDTH, ARTBOARD_HEIGHT } =
      await import('../../src/editor/ui/preview/UIPageAdapters');

    expect(ARTBOARD_WIDTH).toBe(1080);
    expect(ARTBOARD_HEIGHT).toBe(2160);
    expect(defaultPageAdapterRegistry).toBeDefined();
    expect(defaultPageAdapterRegistry.listPages().length).toBeGreaterThanOrEqual(10);
  });

  it('UIHazardPage와 UIBossPage의 보호 영역(PROTECTED_HUD_ZONE, PROTECTED_FLOOR_MOTION_ZONE)이 유효한 artboard 치수를 가져야 한다', async () => {
    const hazardMod = await import('../../src/editor/ui/preview/screens/UIHazardPage');
    const bossMod = await import('../../src/editor/ui/preview/screens/UIBossPage');

    expect(hazardMod.PROTECTED_HUD_ZONE.width).toBe(1080);
    expect(hazardMod.PROTECTED_FLOOR_MOTION_ZONE.width).toBe(1080);
    expect(bossMod.PROTECTED_HUD_ZONE.width).toBe(1080);
    expect(bossMod.PROTECTED_FLOOR_MOTION_ZONE.width).toBe(1080);
  });
});
