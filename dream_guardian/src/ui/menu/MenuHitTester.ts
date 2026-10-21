/**
 * MenuHitTester - 메뉴 UI 사각형/버튼 적중 판정기
 *
 * Issue #638 (REFACTOR-SRP-007):
 * - 메뉴 버튼, 챕터 카드, 서브레벨 카드 및 운동 버튼에 대한 hit detection과 바운딩 박스 계산 분리
 */

export interface RectBounds {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface ButtonHitTarget extends RectBounds {
  id?: string | number;
  disabled?: boolean;
  state?: 'normal' | 'hover' | 'active';
}

export class MenuHitTester {
  /**
   * 좌표 (x, y)가 사각형 영역 내에 있는지 검사 (패딩 지원)
   */
  static isPointInRect(x: number, y: number, rect: RectBounds, padding = 0): boolean {
    return (
      x >= rect.x - padding &&
      x <= rect.x + rect.w + padding &&
      y >= rect.y - padding &&
      y <= rect.y + rect.h + padding
    );
  }

  /**
   * 단일 버튼 히트 테스트 (disabled 상태인 경우 false)
   */
  static hitTestButton(x: number, y: number, button: ButtonHitTarget, padding = 0): boolean {
    if (button.disabled) {
      return false;
    }
    return this.isPointInRect(x, y, button, padding);
  }

  /**
   * 버튼 목록 중 클릭/터치된 버튼 검출
   */
  static hitTestButtons<T extends ButtonHitTarget>(x: number, y: number, buttons: T[], padding = 0): T | null {
    for (const btn of buttons) {
      if (this.hitTestButton(x, y, btn, padding)) {
        return btn;
      }
    }
    return null;
  }

  /**
   * 스케일과 패딩을 반영한 바운딩 박스 계산
   */
  static resolveBounds(bounds: RectBounds, scale = 1.0, padding = 0): RectBounds {
    const scaledW = bounds.w * scale;
    const scaledH = bounds.h * scale;
    const scaledX = bounds.x * scale;
    const scaledY = bounds.y * scale;

    return {
      x: scaledX - padding,
      y: scaledY - padding,
      w: scaledW + padding * 2,
      h: scaledH + padding * 2,
    };
  }

  /**
   * 챕터 카드 목록에 대한 히트 테스트 (일치하는 챕터 번호 1~5 반환, 없으면 0)
   */
  static hitTestChapters<T extends RectBounds & { chapter: number }>(
    x: number,
    y: number,
    layouts: T[],
    padding = 0
  ): number {
    for (const item of layouts) {
      if (this.isPointInRect(x, y, item, padding)) {
        return item.chapter;
      }
    }
    return 0;
  }

  /**
   * 운동 모드 버튼 히트 테스트
   */
  static hitTestLocomotion(x: number, y: number, btn: RectBounds, padding = 0): boolean {
    return this.isPointInRect(x, y, btn, padding);
  }

  /**
   * 서브메뉴 카드 목록에 대한 히트 테스트 (일치하는 subLevel 번호 반환, 없으면 null)
   */
  static hitTestSubLevels<T extends RectBounds & { subLevel: number }>(
    x: number,
    y: number,
    layouts: T[],
    padding = 0
  ): number | null {
    for (const item of layouts) {
      if (this.isPointInRect(x, y, item, padding)) {
        return item.subLevel;
      }
    }
    return null;
  }

  // 인스턴스 위임 메서드
  isPointInRect(x: number, y: number, rect: RectBounds, padding = 0): boolean {
    return MenuHitTester.isPointInRect(x, y, rect, padding);
  }

  hitTestButton(x: number, y: number, button: ButtonHitTarget, padding = 0): boolean {
    return MenuHitTester.hitTestButton(x, y, button, padding);
  }

  hitTestButtons<T extends ButtonHitTarget>(x: number, y: number, buttons: T[], padding = 0): T | null {
    return MenuHitTester.hitTestButtons(x, y, buttons, padding);
  }

  resolveBounds(bounds: RectBounds, scale = 1.0, padding = 0): RectBounds {
    return MenuHitTester.resolveBounds(bounds, scale, padding);
  }

  hitTestChapters<T extends RectBounds & { chapter: number }>(
    x: number,
    y: number,
    layouts: T[],
    padding = 0
  ): number {
    return MenuHitTester.hitTestChapters(x, y, layouts, padding);
  }

  hitTestLocomotion(x: number, y: number, btn: RectBounds, padding = 0): boolean {
    return MenuHitTester.hitTestLocomotion(x, y, btn, padding);
  }

  hitTestSubLevels<T extends RectBounds & { subLevel: number }>(
    x: number,
    y: number,
    layouts: T[],
    padding = 0
  ): number | null {
    return MenuHitTester.hitTestSubLevels(x, y, layouts, padding);
  }
}
