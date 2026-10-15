/**
 * [DEVUI-007] (Issue #567) 레이아웃 요소 레지스트리 (LayoutRegistry)
 *
 * 개발 모드 인스펙터 오버레이에서 게임 내 UI 요소를 탐색, 히트테스트, 좌표 변환,
 * 그리고 UI_LAYOUT 좌표 읽기/쓰기를 수행하는 단일 레지스트리 모듈입니다.
 *
 * 판정 연동 좌표 잠금 정책 (2026-10-11):
 * - 피트니스 존 1~11, 바닥 판정선, 장애물 회피 레인은 isProtected: true로 지정되며
 *   드래그 및 좌표 수정이 원천 거부(reject)됩니다.
 */

import { UI_LAYOUT } from '../../config/ui.config.js';
import { DEV_UI_LOCKED_LAYOUT_PATHS } from '../../config/dev-ui.config.js';
import { DEFAULT_FITNESS_ZONES } from '../../config/zone.config.js';
import { isLockedPath } from './DevLayoutPanel.js';

export interface Bounds {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface InspectableElement {
  /** 요소 고유 식별자 (예: 'menu.title', 'hud.playerHpBar', 'zone.zone_1') */
  id: string;
  /** 표시용 한글/영문 라벨 */
  label: string;
  /** UI_LAYOUT 내 객체 경로 (예: 'menu.title', 'hud.playerHpBar') */
  path: string;
  /** 화면 픽셀 기준 바운딩 박스 계산 함수 */
  getBounds: (vw: number, vh: number) => Bounds;
  /** 판정 연동 좌표 잠금 여부 (true인 경우 드래그 거부 및 🔒 표시) */
  isProtected?: boolean;
}

/**
 * 화면 픽셀 좌표 → 1080x2160 가상 좌표 변환
 */
export function screenToVirtual(
  point: { x: number; y: number },
  vw: number,
  vh: number,
): { x: number; y: number } {
  const safeVw = vw > 0 ? vw : 1080;
  const safeVh = vh > 0 ? vh : 2160;
  return {
    x: (point.x / safeVw) * 1080,
    y: (point.y / safeVh) * 2160,
  };
}

/**
 * 1080x2160 가상 좌표 → 화면 픽셀 좌표 변환
 */
export function virtualToScreen(
  point: { x: number; y: number },
  vw: number,
  vh: number,
): { x: number; y: number } {
  const safeVw = vw > 0 ? vw : 1080;
  const safeVh = vh > 0 ? vh : 2160;
  return {
    x: (point.x / 1080) * safeVw,
    y: (point.y / 2160) * safeVh,
  };
}

/**
 * 가상 해상도 직사각형 → 화면 픽셀 직사각형 변환
 */
export function virtualRectToScreen(
  rect: Bounds,
  vw: number,
  vh: number,
): Bounds {
  const safeVw = vw > 0 ? vw : 1080;
  const safeVh = vh > 0 ? vh : 2160;
  const sx = safeVw / 1080;
  const sy = safeVh / 2160;
  return {
    x: (rect?.x ?? 0) * sx,
    y: (rect?.y ?? 0) * sy,
    w: (rect?.w ?? 0) * sx,
    h: (rect?.h ?? 0) * sy,
  };
}

/**
 * 화면 픽셀 직사각형 → 가상 해상도 직사각형 변환
 */
export function screenRectToVirtual(
  rect: Bounds,
  vw: number,
  vh: number,
): Bounds {
  const safeVw = vw > 0 ? vw : 1080;
  const safeVh = vh > 0 ? vh : 2160;
  const sx = 1080 / safeVw;
  const sy = 2160 / safeVh;
  return {
    x: (rect?.x ?? 0) * sx,
    y: (rect?.y ?? 0) * sy,
    w: (rect?.w ?? 0) * sx,
    h: (rect?.h ?? 0) * sy,
  };
}

/**
 * 포인트의 바운딩 박스 포함 여부 검사
 */
export function isPointInBounds(
  point: { x: number; y: number },
  bounds: Bounds,
): boolean {
  return (
    point.x >= bounds.x &&
    point.x <= bounds.x + bounds.w &&
    point.y >= bounds.y &&
    point.y <= bounds.y + bounds.h
  );
}

/**
 * 개별 요소에 대한 히트 테스트
 */
export function hitTestElement(
  element: InspectableElement,
  px: number,
  py: number,
  vw: number,
  vh: number,
): boolean {
  const bounds = element.getBounds(vw, vh);
  return isPointInBounds({ x: px, y: py }, bounds);
}

/**
 * 주어진 픽셀 좌표에 위치하는 모든 요소 조회 (뒤에서 앞으로 정렬)
 */
export function findAllInspectableAt(
  elements: readonly InspectableElement[],
  px: number,
  py: number,
  vw: number,
  vh: number,
): InspectableElement[] {
  return elements.filter((el) => hitTestElement(el, px, py, vw, vh));
}

/**
 * 주어진 픽셀 좌표에서 최상위(top-most) 요소 단일 조회
 */
export function findInspectableAt(
  elements: readonly InspectableElement[],
  px: number,
  py: number,
  vw: number,
  vh: number,
): InspectableElement | null {
  const hits = findAllInspectableAt(elements, px, py, vw, vh);
  return hits.length > 0 ? hits[hits.length - 1] : null;
}

/**
 * 겹친 요소들 사이에서 다음 요소로 순환 선택
 */
export function cycleInspectable(
  hits: readonly InspectableElement[],
  currentId?: string | null,
): InspectableElement | null {
  if (hits.length === 0) return null;
  if (!currentId) return hits[0];
  const idx = hits.findIndex((e) => e.id === currentId);
  if (idx === -1) return hits[0];
  return hits[(idx + 1) % hits.length];
}

/**
 * 경로를 통해 객체 노드 조회
 */
export function resolvePath(path: string, root: any): any {
  if (!root || !path) return null;
  const parts = path.split('.');
  let cur = root;
  for (const p of parts) {
    if (cur === null || cur === undefined) return null;
    cur = cur[p];
  }
  return cur;
}

/**
 * 경로가 판정 연동 또는 잠금 대상인지 확인
 */
export function isProtectedPath(path: string): boolean {
  if (path.startsWith('zone.') || path === 'runningMat.strikeLine' || path === 'runningMat.lanes') {
    return true;
  }
  return isLockedPath(path, DEV_UI_LOCKED_LAYOUT_PATHS);
}

/**
 * UI_LAYOUT 내 x, y 좌표값 조회
 */
export function getLayoutCoordinates(
  path: string,
  root: any = UI_LAYOUT,
): { x: number; y: number } | null {
  const node = resolvePath(path, root);
  if (node && typeof node.x === 'number' && typeof node.y === 'number') {
    return { x: node.x, y: node.y };
  }
  return null;
}

/**
 * UI_LAYOUT 내 x, y 좌표값 갱신 (판정 연동 좌표는 거부)
 */
export function setLayoutCoordinates(
  path: string,
  coords: { x?: number; y?: number },
  root: any = UI_LAYOUT,
): boolean {
  if (isProtectedPath(path)) {
    return false;
  }
  const node = resolvePath(path, root);
  if (!node || typeof node !== 'object') {
    return false;
  }
  let changed = false;
  if (coords.x !== undefined && typeof node.x === 'number') {
    node.x = coords.x;
    changed = true;
  }
  if (coords.y !== undefined && typeof node.y === 'number') {
    node.y = coords.y;
    changed = true;
  }
  return changed;
}

/**
 * 현재 GameState 및 App 인스턴스에 따라 검사 가능한 UI 요소 목록 반환
 */
export function getInspectableElements(
  state: string,
  app?: any,
  _vw: number = 1080,
  _vh: number = 2160,
): InspectableElement[] {
  const elements: InspectableElement[] = [];

  const add = (el: InspectableElement) => {
    elements.push(el);
  };

  const normState = (state ?? '').toUpperCase();

  // 1. MENU_MAIN
  if (normState === 'MENU_MAIN') {
    add({
      id: 'menu.title',
      label: '메인 타이틀',
      path: 'menu.title',
      getBounds: (w, h) =>
        app?.menuRenderer?.getTitleLayout
          ? app.menuRenderer.getTitleLayout(w, h)
          : virtualRectToScreen(UI_LAYOUT.menu.title, w, h),
    });

    for (let i = 0; i < UI_LAYOUT.menu.chapterCards.length; i++) {
      add({
        id: `menu.chapterCards.${i}`,
        label: `챕터 ${i + 1} 카드`,
        path: `menu.chapterCards.${i}`,
        getBounds: (w, h) => {
          const layouts = app?.menuRenderer?.getChapterLayouts?.(w, h);
          if (layouts && layouts[i]) return layouts[i];
          return virtualRectToScreen(UI_LAYOUT.menu.chapterCards[i], w, h);
        },
      });
    }

    add({
      id: 'menu.locomotionBtn',
      label: '이동 모드 버튼',
      path: 'menu.locomotionBtn',
      getBounds: (w, h) =>
        app?.menuRenderer?.getLocomotionButtonLayout
          ? app.menuRenderer.getLocomotionButtonLayout(w, h)
          : virtualRectToScreen(UI_LAYOUT.menu.locomotionBtn, w, h),
    });

    add({
      id: 'bottomBar.bar',
      label: '하단바 배경',
      path: 'bottomBar',
      getBounds: (w, h) =>
        app?.bottomBar?.getBottomBarBounds
          ? app.bottomBar.getBottomBarBounds(w, h)
          : virtualRectToScreen(UI_LAYOUT.bottomBar, w, h),
    });

    add({
      id: 'bottomBar.settingsBtn',
      label: '설정 버튼',
      path: 'bottomBar.settingsBtn',
      getBounds: (w, h) =>
        app?.bottomBar?.getSettingsButtonBounds
          ? app.bottomBar.getSettingsButtonBounds(w, h)
          : virtualRectToScreen(UI_LAYOUT.bottomBar.settingsBtn, w, h),
    });

    add({
      id: 'bottomBar.actionBtn',
      label: '액션 버튼',
      path: 'bottomBar.actionBtn',
      getBounds: (w, h) =>
        app?.bottomBar?.getActionButtonBounds
          ? app.bottomBar.getActionButtonBounds(w, h)
          : virtualRectToScreen(UI_LAYOUT.bottomBar.actionBtn, w, h),
    });
  }

  // 2. MENU_SUB
  else if (normState === 'MENU_SUB') {
    add({
      id: 'subMenu.title',
      label: '서브메뉴 타이틀',
      path: 'subMenu.title',
      getBounds: (w, h) =>
        app?.menuRenderer?.getSubMenuTitleLayout
          ? app.menuRenderer.getSubMenuTitleLayout(w, h)
          : virtualRectToScreen(UI_LAYOUT.subMenu.title, w, h),
    });

    add({
      id: 'subMenu.backBtn',
      label: '뒤로가기 버튼',
      path: 'subMenu.backBtn',
      getBounds: (w, h) =>
        app?.menuRenderer?.getSubMenuBackButtonLayout
          ? app.menuRenderer.getSubMenuBackButtonLayout(w, h)
          : virtualRectToScreen(UI_LAYOUT.subMenu.backBtn, w, h),
    });

    // 2개 모드 카드 (일반 모드, 보스 어썰트)
    const grid = UI_LAYOUT.subMenu.grid;
    add({
      id: 'subMenu.subCards.0',
      label: '일반 모드 카드',
      path: 'subMenu.grid',
      getBounds: (w, h) => {
        const sx = w / 1080;
        const sy = h / 2160;
        return {
          x: grid.startX * sx,
          y: grid.startY * sy,
          w: grid.w * sx,
          h: grid.h * sy,
        };
      },
    });

    add({
      id: 'subMenu.subCards.1',
      label: '보스 어썰트 카드',
      path: 'subMenu.grid',
      getBounds: (w, h) => {
        const sx = w / 1080;
        const sy = h / 2160;
        return {
          x: (grid.startX + grid.w + grid.gapX) * sx,
          y: grid.startY * sy,
          w: grid.w * sx,
          h: grid.h * sy,
        };
      },
    });

    add({
      id: 'bottomBar.bar',
      label: '하단바 배경',
      path: 'bottomBar',
      getBounds: (w, h) =>
        app?.bottomBar?.getBottomBarBounds
          ? app.bottomBar.getBottomBarBounds(w, h)
          : virtualRectToScreen(UI_LAYOUT.bottomBar, w, h),
    });

    add({
      id: 'bottomBar.settingsBtn',
      label: '설정 버튼',
      path: 'bottomBar.settingsBtn',
      getBounds: (w, h) =>
        app?.bottomBar?.getSettingsButtonBounds
          ? app.bottomBar.getSettingsButtonBounds(w, h)
          : virtualRectToScreen(UI_LAYOUT.bottomBar.settingsBtn, w, h),
    });
  }

  // 3. 인게임 화면군 (READY_POSITION, RUN_QUESTION, ANSWER_SELECT, HAZARD_EVADE, STAR_COLLECT, ROUND_RESOLVE, BOSS_CLIMAX)
  else if (
    [
      'READY_POSITION',
      'RUN_QUESTION',
      'ANSWER_SELECT',
      'STAR_COLLECT',
      'HAZARD_EVADE',
      'ROUND_RESOLVE',
      'BOSS_CLIMAX',
    ].includes(normState)
  ) {
    // HUD 바운즈
    add({
      id: 'hud.playerHpBar',
      label: '플레이어 HP바',
      path: 'hud.playerHpBar',
      getBounds: (w, h) =>
        app?.hudLayer?.getPlayerHpBarBounds
          ? app.hudLayer.getPlayerHpBarBounds(w, h)
          : {
              x: UI_LAYOUT.hud.playerHpBar.x,
              y: UI_LAYOUT.hud.playerHpBar.y,
              w: Math.min(UI_LAYOUT.hud.playerHpBar.w, w * 0.28),
              h: UI_LAYOUT.hud.playerHpBar.h,
            },
    });

    add({
      id: 'hud.bossHpBar',
      label: '보스 HP바',
      path: 'hud.bossHpBar',
      getBounds: (w, h) => {
        if (app?.hudLayer?.getBossHpBarBounds) {
          return app.hudLayer.getBossHpBarBounds(w, h);
        }
        const slot = UI_LAYOUT.hud.bossHpBar;
        const barW = Math.min(slot.w, w * 0.28);
        const marginRight = 1080 - slot.x - slot.w;
        return {
          x: w - marginRight - barW,
          y: slot.y,
          w: barW,
          h: slot.h,
        };
      },
    });

    add({
      id: 'hud.bossName',
      label: '보스 이름',
      path: 'hud.bossName',
      getBounds: (w, h) =>
        app?.hudLayer?.getBossNameBounds
          ? app.hudLayer.getBossNameBounds(w, h)
          : {
              x: UI_LAYOUT.hud.bossName.x,
              y: UI_LAYOUT.hud.bossName.y,
              w: UI_LAYOUT.hud.bossName.w,
              h: UI_LAYOUT.hud.bossName.h,
            },
    });

    add({
      id: 'hud.comboBadge',
      label: '콤보 배지',
      path: 'hud.comboBadge',
      getBounds: (w, h) => {
        if (app?.hudLayer?.getComboBounds) {
          return app.hudLayer.getComboBounds(w, h);
        }
        const badge = UI_LAYOUT.hud.comboBadge ?? { w: 160, h: 48, y: 48, marginRight: 24 };
        return {
          x: w - badge.marginRight - badge.w,
          y: badge.y,
          w: badge.w,
          h: badge.h,
        };
      },
    });

    // 하단바 & 마나 게이지
    add({
      id: 'bottomBar.bar',
      label: '하단바 배경',
      path: 'bottomBar',
      getBounds: (w, h) =>
        app?.bottomBar?.getBottomBarBounds
          ? app.bottomBar.getBottomBarBounds(w, h)
          : virtualRectToScreen(UI_LAYOUT.bottomBar, w, h),
    });

    add({
      id: 'bottomBar.manaBar',
      label: '하단 마나 게이지',
      path: 'bottomBar.manaBar',
      getBounds: (w, h) =>
        app?.bottomBar?.getManaBarBounds
          ? app.bottomBar.getManaBarBounds(w, h)
          : virtualRectToScreen(UI_LAYOUT.bottomBar.manaBar ?? { x: 210, y: 2038, w: 560, h: 50 }, w, h),
    });

    add({
      id: 'bottomBar.settingsBtn',
      label: '일시정지 버튼',
      path: 'bottomBar.settingsBtn',
      getBounds: (w, h) =>
        app?.bottomBar?.getSettingsButtonBounds
          ? app.bottomBar.getSettingsButtonBounds(w, h)
          : virtualRectToScreen(UI_LAYOUT.bottomBar.settingsBtn, w, h),
    });

    // 문제 화면 요소
    if (['RUN_QUESTION', 'ANSWER_SELECT'].includes(normState)) {
      add({
        id: 'question.board',
        label: '문제 보드',
        path: 'question.board',
        getBounds: (w, h) => virtualRectToScreen(UI_LAYOUT.question.board, w, h),
      });

      add({
        id: 'question.panel',
        label: '문제 패널',
        path: 'question.panel',
        getBounds: (w, h) => virtualRectToScreen(UI_LAYOUT.question.panel, w, h),
      });

      add({
        id: 'question.timer',
        label: '문제 타이머',
        path: 'question.timer',
        getBounds: (w, h) => {
          const sx = w / 1080;
          const sy = h / 2160;
          return {
            x: 80 * sx,
            y: (UI_LAYOUT.question.timer?.y ?? 380) * sy,
            w: 920 * sx,
            h: 40 * sy,
          };
        },
      });

      add({
        id: 'runningMat.header',
        label: '러닝 매트 헤더',
        path: 'runningMat.header',
        getBounds: (w, h) => {
          const slot = UI_LAYOUT.runningMat.header;
          const sx = w / 1080;
          const sy = h / 2160;
          return {
            x: (slot.x ?? 80) * sx,
            y: (slot.y ?? 1360) * sy,
            w: (slot.w ?? 920) * sx,
            h: slot.h * sy,
          };
        },
      });
    }

    // 위험 회피 화면 요소
    if (normState === 'HAZARD_EVADE') {
      add({
        id: 'hazard.warningBanner',
        label: '위험 경고 배너',
        path: 'hazard.warningBanner',
        getBounds: (w, h) => virtualRectToScreen(UI_LAYOUT.hazard.warningBanner, w, h),
      });

      add({
        id: 'hazard.timingGuide',
        label: '타이밍 가이드',
        path: 'hazard.timingGuide',
        getBounds: (w, h) => {
          const slot = UI_LAYOUT.hazard.timingGuide;
          const sx = w / 1080;
          const sy = h / 2160;
          return {
            x: (slot.x ?? 140) * sx,
            y: (slot.y ?? 1380) * sy,
            w: (slot.w ?? 800) * sx,
            h: (slot.h ?? 120) * sy,
          };
        },
      });
    }

    // 보스 클라이맥스 요소
    if (normState === 'BOSS_CLIMAX') {
      add({
        id: 'bossClimax.gauge',
        label: '클라이맥스 게이지',
        path: 'bossClimax.gauge',
        getBounds: (w, h) => virtualRectToScreen(UI_LAYOUT.bossClimax.gauge, w, h),
      });

      add({
        id: 'bossClimax.guardian',
        label: '클라이맥스 수호신',
        path: 'bossClimax.guardian',
        getBounds: (w, h) => virtualRectToScreen(UI_LAYOUT.bossClimax.guardian, w, h),
      });
    }

    // 🔒 판정 연동 좌표 (피트니스 존 1~11, 바닥 판정선, 레인)
    for (const zone of DEFAULT_FITNESS_ZONES) {
      add({
        id: `zone.zone_${zone.id}`,
        label: `피트니스 존 ${zone.id} (${zone.label})`,
        path: `zone.zone_${zone.id}`,
        isProtected: true,
        getBounds: (w, h) => ({
          x: zone.x * w,
          y: zone.y * h,
          w: zone.width * w,
          h: zone.height * h,
        }),
      });
    }

    add({
      id: 'runningMat.strikeLine',
      label: '바닥 판정선',
      path: 'runningMat.strikeLine',
      isProtected: true,
      getBounds: (w, h) => ({
        x: 0,
        y: (UI_LAYOUT.runningMat?.y ?? 1500) * (h / 2160),
        w,
        h: (UI_LAYOUT.runningMat?.strikeLine?.h ?? 16) * (h / 2160),
      }),
    });

    add({
      id: 'runningMat.lanes',
      label: '회피 레인',
      path: 'runningMat.lanes',
      isProtected: true,
      getBounds: (w, h) => ({
        x: w * 0.1,
        y: h * 0.4,
        w: w * 0.8,
        h: h * 0.4,
      }),
    });
  }

  // 4. RESULT / GAMEOVER
  else if (normState === 'RESULT' || normState === 'GAMEOVER') {
    add({
      id: 'result.panel',
      label: '결과 패널',
      path: 'result.panel',
      getBounds: (w, h) =>
        app?.resultRenderer?.getPanelLayout
          ? app.resultRenderer.getPanelLayout(w, h)
          : virtualRectToScreen(UI_LAYOUT.result.panel, w, h),
    });

    add({
      id: 'result.title',
      label: '결과 헤더 타이틀',
      path: 'result.title',
      getBounds: (w, h) => virtualRectToScreen(UI_LAYOUT.result.title, w, h),
    });

    add({
      id: 'result.stars',
      label: '별점 배지',
      path: 'result.stars',
      getBounds: (w, h) => virtualRectToScreen(UI_LAYOUT.result.stars, w, h),
    });

    add({
      id: 'result.stamp',
      label: '등급 도장',
      path: 'result.stamp',
      getBounds: (w, h) =>
        app?.resultRenderer?.getRankStampLayout
          ? app.resultRenderer.getRankStampLayout(w, h)
          : virtualRectToScreen(UI_LAYOUT.result.stamp, w, h),
    });

    add({
      id: 'result.chapter',
      label: '챕터 라벨',
      path: 'result.chapter',
      getBounds: (w, h) => virtualRectToScreen(UI_LAYOUT.result.chapter, w, h),
    });

    add({
      id: 'result.stats',
      label: '결과 통계',
      path: 'result.stats',
      getBounds: (w, h) => virtualRectToScreen(UI_LAYOUT.result.stats, w, h),
    });

    add({
      id: 'bottomBar.bar',
      label: '하단바 배경',
      path: 'bottomBar',
      getBounds: (w, h) =>
        app?.bottomBar?.getBottomBarBounds
          ? app.bottomBar.getBottomBarBounds(w, h)
          : virtualRectToScreen(UI_LAYOUT.bottomBar, w, h),
    });
  }

  // 5. 모달 열림 감지 (일시정지/설정 모달이 열려있거나 해당 상태인 경우)
  if (app?.pauseModal?.isOpen || normState === 'PAUSE') {
    add({
      id: 'pause.modal',
      label: '일시정지 모달',
      path: 'pause.modal',
      getBounds: (w, h) =>
        app?.pauseModal?.getModalBounds
          ? app.pauseModal.getModalBounds(w, h)
          : virtualRectToScreen(UI_LAYOUT.pause.modal, w, h),
    });

    add({
      id: 'pause.resumeBtn',
      label: '계속하기 버튼',
      path: 'pause.resumeBtn',
      getBounds: (w, h) =>
        app?.pauseModal?.getButtonLayout
          ? app.pauseModal.getButtonLayout('resume', w, h)
          : virtualRectToScreen(UI_LAYOUT.pause.resumeBtn, w, h),
    });

    add({
      id: 'pause.quitBtn',
      label: '나가기 버튼',
      path: 'pause.quitBtn',
      getBounds: (w, h) =>
        app?.pauseModal?.getButtonLayout
          ? app.pauseModal.getButtonLayout('quit', w, h)
          : virtualRectToScreen(UI_LAYOUT.pause.quitBtn, w, h),
    });
  }

  return elements;
}
