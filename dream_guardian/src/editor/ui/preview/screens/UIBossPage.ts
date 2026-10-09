/**
 * UIBossPage.ts - 보스 결전 실제 렌더 페이지 어댑터 (Issue #458 / UI-VIS-028)
 *
 * 개발 규칙 및 명세 준수:
 * 1. BossClimaxRenderer 및 BossRenderer(UI-VIS-019) 공용 실제 draw 로직 결합
 * 2. 0-runtime 부팅 격리: GameEngine, AppBootstrap, BossController, 데미지 계산, 보상, HP 감소, Web Audio/TTS, 카메라 부팅 0건 보장
 * 3. 결정론적 Fixture 주입 (5개 챕터 보스, 광폭화, 피버, 결전 장판, 탄막 DTO)
 * 4. UIPresentationDocument 연동: fromPresentationDocument를 통한 텍스트/스타일/위치 커스텀 반영
 * 5. 공통 HUD(HUDLayer) 및 하단바(BottomBar), DreamGrid 3D 정적 합성
 * 6. Stable ID(boss_body, boss_name, guardian_body, minion_troop, climax_hazard, hud_boss_hp, hud_player_hp, BottomBar 등)를 포함한 renderedBounds 반환
 * 7. 보호 슬롯(보스 피격 기하, 보호된 결전 장판, 상단 HUD 영역 등) 변조 시 protected-zone-violation 엄격 거부
 * 8. Stale fixture, stale revision, 비정상 캔버스 엄격한 가드 처리
 */

import { DreamGrid } from '../../../../render/DreamGrid.js';
import {
  BossRenderer,
  type BossPresentationContext,
  type BossFixtureDTO,
} from '../../../../render/BossRenderer.js';
import {
  BossClimaxRenderer,
  type BossClimaxPresentationContext,
  type BossClimaxHazardState,
  type BossClimaxFixtureDTO,
} from '../../../../render/BossClimaxRenderer.js';
import { HUDLayer, type HUDData, type HUDPresentationContext } from '../../../../ui/HUDLayer.js';
import {
  BottomBar,
  type BottomBarRenderOptions,
  type BottomBarPresentationContext,
} from '../../../../ui/BottomBar.js';
import type {
  DeterministicFixture,
  PageRenderContext,
  PageRenderResult,
  PageRenderBounds,
  PageAdapterRegistry,
} from '../UIPageAdapters.js';
import type {
  UIPresentationDocument,
  UIPresentationPageId,
} from '../../../../data/UIPresentation.js';
import {
  ARTBOARD_WIDTH,
  ARTBOARD_HEIGHT,
  defaultPageAdapterRegistry,
} from '../UIPageAdapters.js';
import { HORIZON_RATIO } from '../../../../../config/grid.config.js';
import { BOSS_REGISTRY } from '../../../../data/bossData.js';

export const BOSS_BATTLE_PAGE_ID = 'boss_battle';
export const BOSS_CLIMAX_PAGE_ID = 'boss_climax';

export const BOSS_PAGE_BOUNDS_IDS = [
  'boss_body',
  'boss_name',
  'guardian_body',
  'minion_troop',
  'climax_hazard',
  'hud_boss_hp',
  'hud_player_hp',
  'hud_mana_gauge',
  'hud_combo',
  'hud_container',
  'bottom_bar',
  'BottomBar',
  'magic_barrage',
  'boss_hud',
] as const;

export const PROTECTED_BOSS_PAGE_SLOT_IDS = [
  'boss_hp',
  'boss_max_hp',
  'damage_calculation',
  'attack_power',
  'boss_phase_logic',
  'boss_hitbox_geometry',
  'minion_count',
  'fever_combo',
  'hazard_geometry',
  'vanishing_point',
  'shield_state',
] as const;

export const PROTECTED_HUD_ZONE = Object.freeze({
  x: 0,
  y: 0,
  width: ARTBOARD_WIDTH,
  height: 260,
});

export const PROTECTED_FLOOR_MOTION_ZONE = Object.freeze({
  x: 0,
  y: 1642,
  width: ARTBOARD_WIDTH,
  height: 518,
});

export interface BossPageFixtureOptions extends Partial<DeterministicFixture> {
  chapter?: number;
  bossName?: string;
  bossHp?: number;
  bossMaxHp?: number;
  playerHp?: number;
  playerMaxHp?: number;
  guardianHp?: number;
  guardianMaxHp?: number;
  guardianStage?: number;
  minionCount?: number;
  feverRatio?: number;
  isFeverActive?: boolean;
  isBossEnraged?: boolean;
  feverCombo?: number;
  bossState?: 'idle' | 'warning' | 'attacking' | 'defeated' | 'hit';
  hazard?: BossClimaxHazardState | null;
  barrageActive?: boolean;
  barrageProgress?: number;
  shieldActive?: boolean;
  elapsedTime?: number;
  elapsedSec?: number;
  vanishingPoint?: { x: number; y: number };
  bossX?: number;
  bossY?: number;
  bossRadius?: number;

  bossFixture?: Partial<BossFixtureDTO>;
  bossClimaxFixture?: Partial<BossClimaxFixtureDTO>;
  bossContext?: BossPresentationContext;
  bossClimaxContext?: BossClimaxPresentationContext;

  hud?: Partial<HUDData>;
  hudContext?: HUDPresentationContext;
  bottomBar?: Partial<BottomBarRenderOptions>;
  bottomBarOptions?: Partial<BottomBarRenderOptions>;
  bottomBarContext?: BottomBarPresentationContext;

  selectedElementIds?: readonly string[];
  isStale?: boolean;
  revision?: number;
}

export const DEFAULT_BOSS_PAGE_FIXTURE: BossPageFixtureOptions = Object.freeze({
  chapter: 1,
  bossName: '포겟(하얘시니)',
  bossHp: 10,
  bossMaxHp: 10,
  playerHp: 100,
  playerMaxHp: 100,
  minionCount: 5,
  isBossEnraged: false,
  isFeverActive: false,
  bossState: 'idle',
  hud: {
    chapter: 1,
    bossHp: 10,
    bossMaxHp: 10,
    playerHp: 100,
    playerMaxHp: 100,
    combo: 0,
    guardianStage: 1,
  },
  bottomBar: {
    mana: 25,
    manaMax: 100,
    actionLabel: '보스 결전',
  },
});

export const CH1_BOSS_PAGE_FIXTURE: BossPageFixtureOptions = Object.freeze({
  chapter: 1,
  bossName: '포겟(하얘시니)',
  bossHp: 10,
  bossMaxHp: 10,
  playerHp: 100,
  playerMaxHp: 100,
  minionCount: 5,
  isBossEnraged: false,
  isFeverActive: false,
  bossState: 'idle',
  hud: {
    chapter: 1,
    bossHp: 10,
    bossMaxHp: 10,
    playerHp: 100,
    playerMaxHp: 100,
    combo: 0,
    guardianStage: 1,
  },
  bottomBar: {
    mana: 25,
    manaMax: 100,
    actionLabel: '보스 결전',
  },
});

export const CH2_BOSS_PAGE_FIXTURE: BossPageFixtureOptions = Object.freeze({
  chapter: 2,
  bossName: '후다닥(재촉새)',
  bossHp: 10,
  bossMaxHp: 10,
  playerHp: 100,
  playerMaxHp: 100,
  minionCount: 5,
  isBossEnraged: false,
  isFeverActive: false,
  bossState: 'idle',
  hud: {
    chapter: 2,
    bossHp: 10,
    bossMaxHp: 10,
    playerHp: 100,
    playerMaxHp: 100,
    combo: 2,
    guardianStage: 1,
  },
  bottomBar: {
    mana: 30,
    manaMax: 100,
    actionLabel: '보스 결전',
  },
});

export const CH3_BOSS_PAGE_FIXTURE: BossPageFixtureOptions = Object.freeze({
  chapter: 3,
  bossName: '뒤죽박죽(따돌시니)',
  bossHp: 10,
  bossMaxHp: 10,
  playerHp: 100,
  playerMaxHp: 100,
  minionCount: 5,
  isBossEnraged: false,
  isFeverActive: false,
  bossState: 'idle',
  hud: {
    chapter: 3,
    bossHp: 10,
    bossMaxHp: 10,
    playerHp: 100,
    playerMaxHp: 100,
    combo: 3,
    guardianStage: 1,
  },
  bottomBar: {
    mana: 40,
    manaMax: 100,
    actionLabel: '보스 결전',
  },
});

export const CH4_BOSS_PAGE_FIXTURE: BossPageFixtureOptions = Object.freeze({
  chapter: 4,
  bossName: '에라(풀죽새)',
  bossHp: 10,
  bossMaxHp: 10,
  playerHp: 100,
  playerMaxHp: 100,
  minionCount: 5,
  isBossEnraged: false,
  isFeverActive: false,
  bossState: 'idle',
  hud: {
    chapter: 4,
    bossHp: 10,
    bossMaxHp: 10,
    playerHp: 100,
    playerMaxHp: 100,
    combo: 4,
    guardianStage: 1,
  },
  bottomBar: {
    mana: 50,
    manaMax: 100,
    actionLabel: '보스 결전',
  },
});

export const CH5_BOSS_PAGE_FIXTURE: BossPageFixtureOptions = Object.freeze({
  chapter: 5,
  bossName: '나이트메어(캄캄대왕)',
  bossHp: 20,
  bossMaxHp: 20,
  playerHp: 100,
  playerMaxHp: 100,
  minionCount: 5,
  isBossEnraged: false,
  isFeverActive: false,
  bossState: 'idle',
  hud: {
    chapter: 5,
    bossHp: 20,
    bossMaxHp: 20,
    playerHp: 100,
    playerMaxHp: 100,
    combo: 5,
    guardianStage: 2,
  },
  bottomBar: {
    mana: 60,
    manaMax: 100,
    actionLabel: '보스 결전',
  },
});

export const ENRAGED_BOSS_PAGE_FIXTURE: BossPageFixtureOptions = Object.freeze({
  chapter: 1,
  bossName: '포겟(하얘시니)',
  bossHp: 4,
  bossMaxHp: 10,
  playerHp: 75,
  playerMaxHp: 100,
  minionCount: 3,
  isBossEnraged: true,
  isFeverActive: false,
  bossState: 'warning',
  hud: {
    chapter: 1,
    bossHp: 4,
    bossMaxHp: 10,
    playerHp: 75,
    playerMaxHp: 100,
    combo: 2,
    guardianStage: 1,
  },
  bottomBar: {
    mana: 50,
    manaMax: 100,
    actionLabel: '보스 결전 - 광폭화',
  },
});

export const FEVER_BOSS_PAGE_FIXTURE: BossPageFixtureOptions = Object.freeze({
  chapter: 1,
  bossName: '포겟(하얘시니)',
  bossHp: 6,
  bossMaxHp: 10,
  playerHp: 100,
  playerMaxHp: 100,
  minionCount: 13,
  isBossEnraged: false,
  isFeverActive: true,
  feverRatio: 1.0,
  feverCombo: 10,
  barrageActive: true,
  barrageProgress: 0.5,
  elapsedTime: 3.0,
  bossState: 'idle',
  hud: {
    chapter: 1,
    bossHp: 6,
    bossMaxHp: 10,
    playerHp: 100,
    playerMaxHp: 100,
    combo: 10,
    guardianStage: 2,
  },
  bottomBar: {
    mana: 100,
    manaMax: 100,
    actionLabel: '피버 피니시',
  },
});

export const CLIMAX_HAZARD_STOMP_BOSS_PAGE_FIXTURE: BossPageFixtureOptions = Object.freeze({
  chapter: 1,
  bossName: '포겟(하얘시니)',
  bossHp: 8,
  bossMaxHp: 10,
  playerHp: 100,
  playerMaxHp: 100,
  minionCount: 4,
  isBossEnraged: false,
  isFeverActive: false,
  hazard: { activePattern: 'STOMP_MINION', progress: 0.6 },
  bossState: 'attacking',
  hud: {
    chapter: 1,
    bossHp: 8,
    bossMaxHp: 10,
    playerHp: 100,
    playerMaxHp: 100,
    combo: 1,
    guardianStage: 1,
  },
});

export const CLIMAX_HAZARD_SLAM_BOSS_PAGE_FIXTURE: BossPageFixtureOptions = Object.freeze({
  chapter: 1,
  bossName: '포겟(하얘시니)',
  bossHp: 7,
  bossMaxHp: 10,
  playerHp: 100,
  playerMaxHp: 100,
  minionCount: 4,
  isBossEnraged: false,
  isFeverActive: false,
  hazard: { activePattern: 'DUAL_SLAM', progress: 0.5 },
  bossState: 'attacking',
  hud: {
    chapter: 1,
    bossHp: 7,
    bossMaxHp: 10,
    playerHp: 100,
    playerMaxHp: 100,
    combo: 1,
    guardianStage: 1,
  },
});

function overlaps(
  a: { x: number; y: number; width: number; height: number },
  b: { x: number; y: number; width: number; height: number },
): boolean {
  return !(
    a.x + a.width <= b.x ||
    b.x + b.width <= a.x ||
    a.y + a.height <= b.y ||
    b.y + b.height <= a.y
  );
}

function resolveBossName(chapter: number, customName?: string): string {
  if (customName) return customName;
  const meta = BOSS_REGISTRY[chapter];
  if (meta) {
    if (chapter === 1) return `포겟(${meta.name})`;
    if (chapter === 2) return `후다닥(${meta.name})`;
    if (chapter === 3) return `뒤죽박죽(${meta.name})`;
    if (chapter === 4) return `에라(${meta.name})`;
    if (chapter === 5) return `나이트메어(${meta.name})`;
    return meta.name;
  }
  return '포겟(하얘시니)';
}

/**
 * boss_battle / boss_climax 실제 렌더 페이지 어댑터 함수
 */
export function bossPageAdapter(context: PageRenderContext): PageRenderResult {
  const pageId = context.pageId;

  // 1. 지원 페이지 ID 확인
  if (pageId !== BOSS_BATTLE_PAGE_ID && pageId !== BOSS_CLIMAX_PAGE_ID) {
    return {
      ok: false,
      drew: false,
      pageId,
      reason: 'unsupported-page',
      timestamp: Date.now(),
    };
  }

  // 2. 캔버스 및 Context 유효성 검사
  if (!context || !context.canvas || context.canvas.width <= 0 || context.canvas.height <= 0) {
    return {
      ok: false,
      drew: false,
      pageId,
      reason: 'invalid-canvas',
      timestamp: Date.now(),
    };
  }

  const canvasCtx = context.ctx;
  if (!canvasCtx) {
    return {
      ok: false,
      drew: false,
      pageId,
      reason: 'invalid-canvas',
      timestamp: Date.now(),
    };
  }

  // 3. Stale Fixture 검사
  const raw = (context.snapshot ?? {}) as Record<string, any>;
  const fixtureObj = (context.fixture ?? {}) as BossPageFixtureOptions;

  if (fixtureObj.isStale === true || (context.fixture as any)?.isStale === true) {
    return {
      ok: false,
      drew: false,
      pageId,
      reason: 'stale-fixture',
      timestamp: Date.now(),
    };
  }

  // 4. Stale Revision 검사
  if (
    raw.revision !== undefined &&
    fixtureObj.revision !== undefined &&
    raw.revision < fixtureObj.revision
  ) {
    return {
      ok: false,
      drew: false,
      pageId,
      reason: 'stale-revision',
      timestamp: Date.now(),
    };
  }

  // 5. 보호 영역 침범 및 기하 변조 검사
  const bossRendererForValidation = new BossRenderer();
  if (fixtureObj.bossContext) {
    const validation = bossRendererForValidation.validatePresentationContext(fixtureObj.bossContext);
    if (!validation.valid) {
      return {
        ok: false,
        drew: false,
        pageId,
        reason: 'protected-zone-violation',
        timestamp: Date.now(),
      };
    }
  }

  const bossClimaxRendererForValidation = new BossClimaxRenderer();
  if (fixtureObj.bossClimaxContext) {
    const validation = bossClimaxRendererForValidation.validatePresentationContext(
      fixtureObj.bossClimaxContext,
    );
    if (!validation.valid) {
      return {
        ok: false,
        drew: false,
        pageId,
        reason: 'protected-zone-violation',
        timestamp: Date.now(),
      };
    }
  }

  // fixture 레벨 보호 슬롯 변조 검사
  for (const protectedSlot of PROTECTED_BOSS_PAGE_SLOT_IDS) {
    if (protectedSlot in fixtureObj && protectedSlot !== 'boss_hp' && protectedSlot !== 'boss_max_hp' && protectedSlot !== 'minion_count' && protectedSlot !== 'fever_combo' && protectedSlot !== 'vanishing_point' && protectedSlot !== 'shield_state') {
      return {
        ok: false,
        drew: false,
        pageId,
        reason: 'protected-zone-violation',
        timestamp: Date.now(),
      };
    }
  }

  let doc: UIPresentationDocument | undefined;
  if (raw.document && typeof raw.document === 'object' && raw.document.pages) {
    doc = raw.document as UIPresentationDocument;
  }
  if (raw.pages && typeof raw.pages === 'object') {
    doc = raw as UIPresentationDocument;
  }

  if (doc) {
    const pagesToCheck = [
      doc.pages[pageId as UIPresentationPageId],
      doc.pages[BOSS_BATTLE_PAGE_ID as UIPresentationPageId],
    ].filter(Boolean);

    for (const page of pagesToCheck) {
      if (!page?.elements) continue;
      for (const el of page.elements) {
        if (!el || !el.bounds) continue;
        const id = el.id ? String(el.id).toLowerCase() : '';
        const isHudElement =
          id.startsWith('hud_') ||
          id === 'boss_hud' ||
          id === 'boss_title' ||
          id === 'boss_name';

        const b = {
          x: el.bounds.x ?? 0,
          y: el.bounds.y ?? 0,
          width: el.bounds.width ?? (el.bounds as any).w ?? 0,
          height: el.bounds.height ?? (el.bounds as any).h ?? 0,
        };

        // 보호 HUD 영역 침범 검사 (일반 버튼/컨테이너가 상단 260px 침범)
        if (!isHudElement && overlaps(b, PROTECTED_HUD_ZONE)) {
          return {
            ok: false,
            drew: false,
            pageId,
            reason: 'protected-zone-violation',
            timestamp: Date.now(),
          };
        }

        // 상단 HUD 영역에 불법 버튼 배치 검사
        if (el.type === 'button' && overlaps(b, PROTECTED_HUD_ZONE)) {
          return {
            ok: false,
            drew: false,
            pageId,
            reason: 'protected-zone-violation',
            timestamp: Date.now(),
          };
        }

        // 하단 보호 모션 존 침범 불법 버튼 검사
        if (el.type === 'button' && overlaps(b, PROTECTED_FLOOR_MOTION_ZONE)) {
          return {
            ok: false,
            drew: false,
            pageId,
            reason: 'protected-zone-violation',
            timestamp: Date.now(),
          };
        }

        // 보호 슬롯 ID 침범 검사
        if (
          PROTECTED_BOSS_PAGE_SLOT_IDS.includes(id as any) ||
          id.includes('damage_calculation') ||
          id.includes('hazard_geometry') ||
          id.includes('timing_ring_physics')
        ) {
          return {
            ok: false,
            drew: false,
            pageId,
            reason: 'protected-zone-violation',
            timestamp: Date.now(),
          };
        }
      }
    }
  }

  // 6. PresentationContext 조립
  let bossContext: BossPresentationContext = {};
  let bossClimaxContext: BossClimaxPresentationContext = {};
  let hudContext: HUDPresentationContext = {};
  let bottomBarContext: BottomBarPresentationContext = {};

  if (doc) {
    bossContext = BossRenderer.fromPresentationDocument(doc, pageId);
    bossClimaxContext = BossClimaxRenderer.fromPresentationDocument(doc, pageId);
    hudContext = HUDLayer.fromPresentationDocument(doc, pageId);
    bottomBarContext = BottomBar.fromPresentationDocument(doc, pageId);
  }

  if (fixtureObj.bossContext) {
    bossContext = { ...bossContext, ...fixtureObj.bossContext };
  }
  if (fixtureObj.bossClimaxContext) {
    bossClimaxContext = { ...bossClimaxContext, ...fixtureObj.bossClimaxContext };
  }
  if (fixtureObj.hudContext) {
    hudContext = { ...hudContext, ...fixtureObj.hudContext };
  }
  if (fixtureObj.bottomBarContext) {
    bottomBarContext = { ...bottomBarContext, ...fixtureObj.bottomBarContext };
  }

  // 7. 데이터 DTO 조립
  const chapter = fixtureObj.chapter ?? fixtureObj.bossFixture?.chapter ?? 1;
  const bossName = resolveBossName(chapter, fixtureObj.bossName);
  if (bossName) {
    hudContext = {
      ...hudContext,
      bossName: {
        ...hudContext.bossName,
        label: hudContext.bossName?.label ?? bossName,
      },
    };
  }
  const bossHp = fixtureObj.bossHp ?? fixtureObj.bossClimaxFixture?.bossHp ?? 10;
  const bossMaxHp = fixtureObj.bossMaxHp ?? fixtureObj.bossClimaxFixture?.bossMaxHp ?? 10;
  const isEnraged = fixtureObj.isBossEnraged ?? fixtureObj.bossClimaxFixture?.isEnraged ?? false;
  const isFever = fixtureObj.isFeverActive ?? false;
  const minionCount = fixtureObj.minionCount ?? fixtureObj.bossClimaxFixture?.minionCount ?? 5;
  const feverCombo = fixtureObj.feverCombo ?? fixtureObj.bossClimaxFixture?.feverCombo ?? 0;
  const hazard = fixtureObj.hazard ?? fixtureObj.bossClimaxFixture?.hazard ?? null;
  const barrageActive = fixtureObj.barrageActive ?? fixtureObj.bossClimaxFixture?.barrageActive ?? isFever;
  const barrageProgress = fixtureObj.barrageProgress ?? fixtureObj.bossClimaxFixture?.barrageProgress ?? 0;
  const elapsedTime = fixtureObj.elapsedTime ?? fixtureObj.elapsedSec ?? fixtureObj.bossClimaxFixture?.elapsedTime ?? 0;

  const vanishingPoint = fixtureObj.vanishingPoint ?? {
    x: ARTBOARD_WIDTH * 0.5,
    y: ARTBOARD_HEIGHT * HORIZON_RATIO,
  };

  const bossX = fixtureObj.bossX ?? fixtureObj.bossFixture?.x ?? vanishingPoint.x;
  const bossY = fixtureObj.bossY ?? fixtureObj.bossFixture?.y ?? vanishingPoint.y;
  const bossRadius = fixtureObj.bossRadius ?? fixtureObj.bossFixture?.radius ?? 90;
  const bossState = (fixtureObj.bossState ??
    fixtureObj.bossFixture?.phase ??
    (isEnraged ? 'warning' : 'idle')) as 'idle' | 'warning' | 'attacking' | 'defeated';

  const hudData: HUDData = {
    chapter,
    playerHp: fixtureObj.playerHp ?? fixtureObj.hud?.playerHp ?? 100,
    playerMaxHp: fixtureObj.playerMaxHp ?? fixtureObj.hud?.playerMaxHp ?? 100,
    bossHp,
    bossMaxHp,
    combo: feverCombo || (fixtureObj.hud?.combo ?? 0),
    guardianStage: fixtureObj.guardianStage ?? fixtureObj.hud?.guardianStage ?? 1,
    ...fixtureObj.hud,
  };

  const bottomBarOptions: BottomBarRenderOptions = {
    mana: fixtureObj.bottomBar?.mana ?? 25,
    manaMax: fixtureObj.bottomBar?.manaMax ?? 100,
    actionLabel: fixtureObj.bottomBar?.actionLabel ?? '보스 결전',
    ...fixtureObj.bottomBar,
    ...fixtureObj.bottomBarOptions,
  };

  // 8. 실제 렌더러 파이프라인 호출
  canvasCtx.clearRect(0, 0, ARTBOARD_WIDTH, ARTBOARD_HEIGHT);

  // 8.1 DreamGrid (3D 원근 와이어프레임 배경)
  const dreamGrid = new DreamGrid();
  dreamGrid.render(canvasCtx, ARTBOARD_WIDTH, ARTBOARD_HEIGHT);

  // 8.2 BossRenderer (5개 챕터 고유 보스 본체 프로시저럴 드로잉)
  const bossRenderer = new BossRenderer(bossContext);
  bossRenderer.renderFixture(canvasCtx, {
    chapter,
    phase: bossState,
    x: bossX,
    y: bossY,
    radius: bossRadius,
    isEnraged,
  });

  // 8.3 BossClimaxRenderer (결전 3D 아레나: 아우라, 장판, 수호신, 미니언 군단, 탄막, 결전 HUD)
  const bossClimaxRenderer = new BossClimaxRenderer(undefined, bossClimaxContext);
  bossClimaxRenderer.renderFixture(canvasCtx, ARTBOARD_WIDTH, ARTBOARD_HEIGHT, {
    bossHp,
    bossMaxHp,
    isEnraged,
    minionCount,
    feverCombo,
    hazard,
    barrageActive,
    barrageProgress,
    elapsedTime,
    guardianStage: hudData.guardianStage,
    vanishingX: vanishingPoint.x,
    vanishingY: vanishingPoint.y,
    isShieldActive: fixtureObj.shieldActive,
  });

  // 8.4 HUDLayer (상단 공통 HUD: 플레이어 HP, 보스 HP, 보스 이름, 콤보)
  const hudLayer = new HUDLayer();
  if (hudContext) {
    hudLayer.setPresentationContext(hudContext);
  }
  hudLayer.render(canvasCtx, ARTBOARD_WIDTH, ARTBOARD_HEIGHT, hudData);

  // 8.5 BottomBar (하단 조작 및 마나 바)
  const bottomBar = new BottomBar();
  if (bottomBarContext) {
    bottomBar.setPresentationContext(bottomBarContext);
  }
  bottomBar.render(canvasCtx, ARTBOARD_WIDTH, ARTBOARD_HEIGHT, bottomBarOptions);

  // 9. Stable Rendered Bounds 수집
  const bossBounds = bossClimaxRenderer.getBossBounds(
    ARTBOARD_WIDTH,
    ARTBOARD_HEIGHT,
    vanishingPoint,
  );
  const guardianBounds = bossClimaxRenderer.getGuardianBounds(
    ARTBOARD_WIDTH,
    ARTBOARD_HEIGHT,
  );
  const minionTroopBounds = bossClimaxRenderer.getMinionTroopBounds(
    ARTBOARD_WIDTH,
    ARTBOARD_HEIGHT,
    minionCount,
  );
  const climaxHazardBounds = bossClimaxRenderer.getClimaxHazardBounds(
    ARTBOARD_WIDTH,
    ARTBOARD_HEIGHT,
    hazard,
    vanishingPoint,
  );
  const magicBarrageBounds = bossClimaxRenderer.getBarrageBounds(
    ARTBOARD_WIDTH,
    ARTBOARD_HEIGHT,
    vanishingPoint,
  );

  const playerHpBounds = hudLayer.getPlayerHpBarBounds(ARTBOARD_WIDTH, ARTBOARD_HEIGHT);
  const bossHpBounds = hudLayer.getBossHpBarBounds(ARTBOARD_WIDTH, ARTBOARD_HEIGHT);
  const bossNameBounds = hudLayer.getBossNameBounds(ARTBOARD_WIDTH, ARTBOARD_HEIGHT);
  const comboBounds = hudLayer.getComboBounds(ARTBOARD_WIDTH, ARTBOARD_HEIGHT);

  const bottomBarBounds = bottomBar.getBottomBarBounds(ARTBOARD_WIDTH, ARTBOARD_HEIGHT);
  const manaBarBounds = bottomBar.getManaBarBounds(ARTBOARD_WIDTH, ARTBOARD_HEIGHT);

  const renderedBounds: PageRenderBounds[] = [
    {
      id: 'boss_body',
      x: bossBounds.x,
      y: bossBounds.y,
      width: bossBounds.width,
      height: bossBounds.height,
      isProtected: false,
    },
    {
      id: 'boss_name',
      x: bossNameBounds.x,
      y: bossNameBounds.y,
      width: bossNameBounds.w,
      height: bossNameBounds.h,
      isProtected: false,
    },
    {
      id: 'guardian_body',
      x: guardianBounds.x,
      y: guardianBounds.y,
      width: guardianBounds.width,
      height: guardianBounds.height,
      isProtected: false,
    },
    {
      id: 'minion_troop',
      x: minionTroopBounds.x,
      y: minionTroopBounds.y,
      width: minionTroopBounds.width,
      height: minionTroopBounds.height,
      isProtected: false,
    },
    {
      id: 'climax_hazard',
      x: climaxHazardBounds.x,
      y: climaxHazardBounds.y,
      width: climaxHazardBounds.width,
      height: climaxHazardBounds.height,
      isProtected: true,
    },
    {
      id: 'magic_barrage',
      x: magicBarrageBounds.x,
      y: magicBarrageBounds.y,
      width: magicBarrageBounds.width,
      height: magicBarrageBounds.height,
      isProtected: false,
    },
    {
      id: 'hud_container',
      x: 0,
      y: 0,
      width: ARTBOARD_WIDTH,
      height: 260,
      isProtected: true,
    },
    {
      id: 'hud_player_hp',
      x: playerHpBounds.x,
      y: playerHpBounds.y,
      width: playerHpBounds.w,
      height: playerHpBounds.h,
      isProtected: true,
    },
    {
      id: 'hud_boss_hp',
      x: bossHpBounds.x,
      y: bossHpBounds.y,
      width: bossHpBounds.w,
      height: bossHpBounds.h,
      isProtected: true,
    },
    {
      id: 'hud_mana_gauge',
      x: manaBarBounds.x,
      y: manaBarBounds.y,
      width: manaBarBounds.w,
      height: manaBarBounds.h,
      isProtected: false,
    },
    {
      id: 'hud_combo',
      x: comboBounds.x,
      y: comboBounds.y,
      width: comboBounds.w,
      height: comboBounds.h,
      isProtected: false,
    },
    {
      id: 'bottom_bar',
      x: bottomBarBounds.x,
      y: bottomBarBounds.y,
      width: bottomBarBounds.w,
      height: bottomBarBounds.h,
      isProtected: false,
    },
    {
      id: 'BottomBar',
      x: bottomBarBounds.x,
      y: bottomBarBounds.y,
      width: bottomBarBounds.w,
      height: bottomBarBounds.h,
      isProtected: false,
    },
    {
      id: 'boss_hud',
      x: 50,
      y: 20,
      width: 980,
      height: 60,
      isProtected: false,
    },
  ];

  // 10. 선택 요소 하이라이트 표시 (selectedElementIds)
  const selectedIds = context.selectedElementIds ?? fixtureObj.selectedElementIds;
  if (selectedIds && selectedIds.length > 0) {
    const selectedSet = new Set(selectedIds);
    canvasCtx.save();
    canvasCtx.strokeStyle = '#28E6FF';
    canvasCtx.lineWidth = 3;
    if (canvasCtx.setLineDash) canvasCtx.setLineDash([8, 4]);

    for (const bound of renderedBounds) {
      if (selectedSet.has(bound.id)) {
        canvasCtx.strokeRect(bound.x, bound.y, bound.width, bound.height);
      }
    }
    canvasCtx.restore();
  }

  return {
    ok: true,
    drew: true,
    pageId,
    renderedBounds,
    timestamp: Date.now(),
  };
}

/**
 * boss_battle / boss_climax 어댑터 등록 함수
 */
export function registerBossPageAdapter(
  registry: PageAdapterRegistry = defaultPageAdapterRegistry,
): void {
  registry.register(BOSS_BATTLE_PAGE_ID, bossPageAdapter);
  registry.register(BOSS_CLIMAX_PAGE_ID, bossPageAdapter);
}
