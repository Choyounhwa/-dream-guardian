/**
 * [DEVUI-008] (Issue #577) 보스 접근전 화면 프리셋 및 assault-visual.config 편집 (다중 소스) 단위 테스트
 *
 * 1. DevScenePresets:
 *    - boss_assault, boss_assault_low_hp, boss_assault_result 프리셋 ID 및 타겟 상태
 *    - 플레이어 HP, 보스 HP, 고정 어설트 문제 및 고정 상태 주입
 *    - ?dev=ui&screen=boss_assault, ?mode=boss_assault&variant=... 쿼리 파싱 및 우선순위 결합
 * 2. UILayoutOverride:
 *    - 다중 네임스페이스 오버라이드 ({ ui: ..., assault: ... })
 *    - 레거시 단일 소스 하위 호환성
 *    - validateMultiLayoutPatch 및 비율/스케일 유효성 검증
 * 3. DevLayoutPanel:
 *    - ASSAULT_VISUAL 다중 소스 바인딩 및 섹션 생성
 *    - buildMultiLayoutExport 네임스페이스 JSON 구조 ({ version: 1, ui: ..., assault: ... })
 *    - 다중 소스 Undo / Redo 연동
 *    - 전체 초기화 시 UI_LAYOUT 및 ASSAULT_VISUAL 동시 원복
 */

import { describe, it, expect, afterEach, vi } from 'vitest';
import { UI_LAYOUT } from '../../config/ui.config.js';
import { DEFAULT_ASSAULT_VISUAL_CONFIG } from '../../config/assault-visual.config.js';
import {
  applyLayoutOverride,
  applyMultiLayoutOverride,
  validateMultiLayoutPatch,
} from '../../src/core/UILayoutOverride.js';
import {
  DEV_PRESET_IDS,
  getPresetTarget,
  getPlayPresetParams,
  parseDevPreset,
  applyDevPreset,
  FIXED_DEV_PLAYER_HP,
} from '../../src/dev/DevScenePresets.js';
import {
  ASSAULT_VISUAL,
  flattenLayoutBindings,
  buildMultiLayoutExport,
  snapshotLayout,
  mountDevLayoutPanel,
} from '../../src/dev/DevLayoutPanel.js';
import { DevLayoutHistory } from '../../src/dev/DevLayoutHistory.js';

const PRISTINE_UI = JSON.parse(JSON.stringify(UI_LAYOUT));
const PRISTINE_ASSAULT = JSON.parse(JSON.stringify(DEFAULT_ASSAULT_VISUAL_CONFIG));

afterEach(() => {
  applyLayoutOverride(UI_LAYOUT, PRISTINE_UI);
  if (ASSAULT_VISUAL) {
    applyLayoutOverride(ASSAULT_VISUAL, PRISTINE_ASSAULT);
  }
  vi.restoreAllMocks();
});

class MemStorage {
  data = new Map<string, string>();
  getItem(k: string) { return this.data.has(k) ? this.data.get(k)! : null; }
  setItem(k: string, v: string) { this.data.set(k, String(v)); }
  removeItem(k: string) { this.data.delete(k); }
}

function fakeDoc() {
  const elements = new Map<string, any>();
  const mk = (tagName: string) => {
    const el: any = {
      tagName: tagName.toUpperCase(),
      id: '',
      style: {},
      children: [] as any[],
      appendChild(child: any) {
        el.children.push(child);
        return child;
      },
      addEventListener() {},
      removeEventListener() {},
      querySelector() { return null; },
      querySelectorAll() { return []; },
    };
    return el;
  };
  return {
    createElement: mk,
    getElementById: (id: string) => elements.get(id) ?? null,
    body: {
      appendChild(child: any) {
        if (child.id) elements.set(child.id, child);
        return child;
      },
    },
    addEventListener() {},
    removeEventListener() {},
  };
}

interface FakeNode {
  kind: 'pane' | 'folder' | 'binding' | 'button';
  title?: string;
  key?: string;
  params?: any;
  expanded?: boolean;
  disabled?: boolean;
  children: FakeNode[];
  handlers: Record<string, Function>;
}

function makeNode(kind: FakeNode['kind'], extra: Partial<FakeNode> = {}): FakeNode & any {
  const node: FakeNode & any = {
    kind,
    children: [],
    handlers: {},
    expanded: extra.expanded ?? false,
    title: extra.title,
    key: extra.key,
    params: extra.params,
    disabled: extra.disabled ?? false,
    addFolder(params: { title: string; expanded?: boolean }) {
      const f = makeNode('folder', params);
      node.children.push(f);
      return f;
    },
    addBinding(_target: object, key: string, params: any) {
      const b = makeNode('binding', { key, params });
      node.children.push(b);
      return { on: (event: string, fn: Function) => { b.handlers[event] = fn; } };
    },
    addButton(params: { title: string; disabled?: boolean }) {
      const btn = makeNode('button', params);
      node.children.push(btn);
      return {
        on: (event: string, fn: Function) => { btn.handlers[event] = fn; },
        set disabled(v: boolean) { btn.disabled = v; },
        get disabled() { return !!btn.disabled; },
      };
    },
    refresh() {},
    dispose() {},
  };
  return node;
}

function walkNodes(root: FakeNode): FakeNode[] {
  const out: FakeNode[] = [root];
  for (const child of root.children) {
    out.push(...walkNodes(child));
  }
  return out;
}

describe('DEVUI-008 (1) DevScenePresets 보스 접근전 프리셋', () => {
  it('DEV_PRESET_IDS에 boss_assault, boss_assault_low_hp, boss_assault_result가 포함된다', () => {
    expect(DEV_PRESET_IDS).toContain('boss_assault');
    expect(DEV_PRESET_IDS).toContain('boss_assault_low_hp');
    expect(DEV_PRESET_IDS).toContain('boss_assault_result');
  });

  it('보스 접근전 프리셋들의 타겟 상태는 RUN_QUESTION (또는 ANSWER_SELECT)이다', () => {
    expect(['RUN_QUESTION', 'ANSWER_SELECT']).toContain(getPresetTarget('boss_assault'));
    expect(['RUN_QUESTION', 'ANSWER_SELECT']).toContain(getPresetTarget('boss_assault_low_hp'));
    expect(['RUN_QUESTION', 'ANSWER_SELECT']).toContain(getPresetTarget('boss_assault_result'));
  });

  it('getPlayPresetParams가 각 프리셋별 적절한 HP/보스/문항 파라미터를 반환한다', () => {
    const normal = getPlayPresetParams('boss_assault');
    expect(normal).not.toBeNull();
    expect(normal!.playerHp).toBe(FIXED_DEV_PLAYER_HP);
    expect(normal!.bossHp).toBeGreaterThan(0);
    expect(normal!.question).toBeDefined();

    const lowHp = getPlayPresetParams('boss_assault_low_hp');
    expect(lowHp).not.toBeNull();
    expect(lowHp!.playerHp).toBeLessThanOrEqual(30);
    expect(lowHp!.bossHp).toBeLessThanOrEqual(3);

    const result = getPlayPresetParams('boss_assault_result');
    expect(result).not.toBeNull();
    expect(result!.bossHp).toBe(0);
    expect(result!.bossPhase).toBe('defeated');
  });

  it('parseDevPreset이 screen 및 mode=boss_assault, variant 쿼리를 정확히 파싱한다', () => {
    expect(parseDevPreset('?dev=ui&preset=boss_assault')).toBe('boss_assault');
    expect(parseDevPreset('?dev=ui&screen=boss_assault')).toBe('boss_assault');
    expect(parseDevPreset('?dev=ui&screen=boss_assault&variant=low_hp')).toBe('boss_assault_low_hp');
    expect(parseDevPreset('?dev=ui&screen=boss_assault&variant=result')).toBe('boss_assault_result');
    expect(parseDevPreset('?mode=boss_assault&dev=ui')).toBe('boss_assault');
    expect(parseDevPreset('?mode=boss_assault&dev=ui&preset=boss_assault_low')).toBe('boss_assault_low_hp');
    expect(parseDevPreset('?mode=boss_assault&dev=ui&preset=gameover')).toBe('gameover');
    expect(parseDevPreset('?mode=boss_assault&screen=boss_assault')).toBeNull(); // dev=ui 없음
  });

  it('applyDevPreset으로 boss_assault 적용 시 플레이어 HP, 보스 상태 및 문제 상태가 주입된다', () => {
    let currentState = 'MENU_MAIN';
    const app: any = {
      stateMachine: {
        get currentState() { return currentState; },
        set currentState(s: string) { currentState = s; },
      },
      battle: { hp: 100, maxHp: 100, mana: 0, combo: 0 },
      boss: { hp: 10, maxHp: 10, phase: 'idle' },
      transitionManager: { cancel: vi.fn() },
      effectManager: { clear: vi.fn() },
    };

    const res = applyDevPreset(app, 'boss_assault', (to) => {
      currentState = to;
      return true;
    });

    expect(res.ok).toBe(true);
    expect(currentState).toBe(getPresetTarget('boss_assault'));
    expect(app.battle.hp).toBe(FIXED_DEV_PLAYER_HP);
    expect(app.boss.hp).toBe(7);
  });
});

describe('DEVUI-008 (2) UILayoutOverride 다중 네임스페이스 오버라이드', () => {
  it('루트에 ui 및 assault 네임스페이스가 있는 경우 각각의 타겟에 패치를 적용한다', () => {
    const targets = {
      ui: snapshotLayout(UI_LAYOUT),
      assault: snapshotLayout(DEFAULT_ASSAULT_VISUAL_CONFIG),
    };

    const patch = {
      version: 1,
      ui: {
        hud: {
          playerHpBar: { w: 450 },
        },
      },
      assault: {
        visualScale: 1.25,
        choiceCard: {
          widthRatio: 0.4,
        },
      },
    };

    const res = applyMultiLayoutOverride(targets, patch);
    expect(res.warnings).toEqual([]);
    expect(res.applied).toContain('ui.hud.playerHpBar.w');
    expect(res.applied).toContain('assault.visualScale');
    expect(res.applied).toContain('assault.choiceCard.widthRatio');

    expect((targets.ui as any).hud.playerHpBar.w).toBe(450);
    expect((targets.assault as any).visualScale).toBe(1.25);
    expect((targets.assault as any).choiceCard.widthRatio).toBe(0.4);
  });

  it('레거시 단일 소스 패치는 ui 타겟에 100% 하위 호환으로 적용된다', () => {
    const targets = {
      ui: snapshotLayout(UI_LAYOUT),
      assault: snapshotLayout(DEFAULT_ASSAULT_VISUAL_CONFIG),
    };

    const legacyPatch = {
      hud: {
        playerHpBar: { w: 520 },
      },
    };

    const res = applyMultiLayoutOverride(targets, legacyPatch);
    expect(res.warnings).toEqual([]);
    expect(res.applied).toContain('hud.playerHpBar.w');
    expect((targets.ui as any).hud.playerHpBar.w).toBe(520);
  });

  it('금지된 키나 알 수 없는 키에 대해 경고를 반환한다', () => {
    const targets = {
      ui: snapshotLayout(UI_LAYOUT),
      assault: snapshotLayout(DEFAULT_ASSAULT_VISUAL_CONFIG),
    };

    const badPatch = JSON.parse(
      '{"ui":{"__proto__":{"polluted":true},"unknownKey":123},"assault":{"nonExistentProp":999,"visualScale":"not_a_number"},"extraNamespace":{}}',
    );

    const res = applyMultiLayoutOverride(targets, badPatch);
    expect(res.warnings.some((w) => w.includes('금지된 키'))).toBe(true);
    expect(res.warnings.some((w) => w.includes('알 수 없는 키'))).toBe(true);
    expect(res.warnings.some((w) => w.includes('숫자가 아님'))).toBe(true);
    expect(res.warnings.some((w) => w.includes('알 수 없는 네임스페이스'))).toBe(true);
  });

  it('validateMultiLayoutPatch는 원본 targets 객체를 오염시키지 않고 유효성을 검증한다', () => {
    const targets = {
      ui: snapshotLayout(UI_LAYOUT),
      assault: snapshotLayout(DEFAULT_ASSAULT_VISUAL_CONFIG),
    };

    const originalUiW = (targets.ui as any).hud.playerHpBar.w;
    const originalScale = (targets.assault as any).visualScale;

    const patch = {
      ui: { hud: { playerHpBar: { w: 999 } } },
      assault: { visualScale: 2.5 },
    };

    const res = validateMultiLayoutPatch(targets, patch);
    expect(res.warnings).toEqual([]);
    expect((targets.ui as any).hud.playerHpBar.w).toBe(originalUiW);
    expect((targets.assault as any).visualScale).toBe(originalScale);
  });
});

describe('DEVUI-008 (3) DevLayoutPanel 다중 소스 바인딩, Export 및 Undo/Redo', () => {
  it('ASSAULT_VISUAL 싱글턴이 변경 가능한 객체로 노출되고 숫자 필드가 바인딩된다', () => {
    expect(ASSAULT_VISUAL).toBeDefined();
    expect(Object.isFrozen(ASSAULT_VISUAL)).toBe(false);

    const bindings = flattenLayoutBindings(ASSAULT_VISUAL, []);
    const paths = bindings.map((b) => b.path);
    expect(paths).toContain('visualScale');
    expect(paths).toContain('bossAnchor.center.x');
    expect(paths).toContain('choiceCard.widthRatio');
    expect(paths).toContain('feedbackDurationMs.hitFlashMs');
  });

  it('buildMultiLayoutExport가 { version: 1, ui: ..., assault: ... } 네임스페이스 구조를 생성한다', () => {
    const baseUi = snapshotLayout(UI_LAYOUT);
    const baseAssault = snapshotLayout(ASSAULT_VISUAL);

    // 변경 적용
    (UI_LAYOUT.hud.playerHpBar as any).w = 600;
    (ASSAULT_VISUAL as any).visualScale = 1.35;

    const exp = buildMultiLayoutExport({
      ui: { current: UI_LAYOUT, base: baseUi },
      assault: { current: ASSAULT_VISUAL, base: baseAssault },
    });

    expect(exp.warnings).toEqual([]);
    const parsed = JSON.parse(exp.json);
    expect(parsed.version).toBe(1);
    expect(parsed.ui.hud.playerHpBar.w).toBe(600);
    expect(parsed.assault.visualScale).toBe(1.35);
  });

  it('mountDevLayoutPanel에서 assault 섹션이 폴더로 바인딩되고 assault 상태 시 펼쳐진다', async () => {
    let root: any;
    const doc = fakeDoc();
    const app = { stateMachine: { currentState: 'RUN_QUESTION' } };

    await mountDevLayoutPanel(app, doc as unknown as Document, {
      createPane: () => { root = makeNode('pane'); return root; },
      storage: new MemStorage(),
      fileOverride: null,
      watchState: false,
    });

    const folders = walkNodes(root).filter((n) => n.kind === 'folder');
    const assaultFolder = folders.find((f) => f.title === 'assault' || f.title === 'ASSAULT_VISUAL');
    expect(assaultFolder).toBeDefined();
  });

  it('ASSAULT_VISUAL 변경 시 DevLayoutHistory와 연동되어 Undo / Redo가 정상 동작한다', async () => {
    let root: any;
    const doc = fakeDoc();
    const app = { stateMachine: { currentState: 'RUN_QUESTION' } };
    const history = new DevLayoutHistory();

    const handle = await mountDevLayoutPanel(app, doc as unknown as Document, {
      createPane: () => { root = makeNode('pane'); return root; },
      storage: new MemStorage(),
      fileOverride: null,
      watchState: false,
      history,
    });

    const origScale = (ASSAULT_VISUAL as any).visualScale;
    const newScale = 1.8;

    // 패널에서 assault.visualScale 수정 시뮬레이션
    history.beginDrag('assault.visualScale', origScale);
    (ASSAULT_VISUAL as any).visualScale = newScale;
    history.endDrag('assault.visualScale', newScale);

    expect((ASSAULT_VISUAL as any).visualScale).toBe(newScale);
    expect(handle?.undo).toBeDefined();

    // Undo 실행
    handle?.undo?.();
    expect((ASSAULT_VISUAL as any).visualScale).toBe(origScale);

    // Redo 실행
    handle?.redo?.();
    expect((ASSAULT_VISUAL as any).visualScale).toBe(newScale);

    // 원복
    (ASSAULT_VISUAL as any).visualScale = origScale;
  });

  it('전체 초기화(Reset all) 시 UI_LAYOUT과 ASSAULT_VISUAL이 모두 기준값으로 복원된다', async () => {
    let root: any;
    const doc = fakeDoc();
    const app = { stateMachine: { currentState: 'MENU_MAIN' } };

    const handle = await mountDevLayoutPanel(app, doc as unknown as Document, {
      createPane: () => { root = makeNode('pane'); return root; },
      storage: new MemStorage(),
      fileOverride: null,
      watchState: false,
    });

    const origUiW = UI_LAYOUT.menu.title.w;
    const origAssaultScale = (ASSAULT_VISUAL as any).visualScale;

    // 변경 적용
    UI_LAYOUT.menu.title.w = origUiW + 50;
    (ASSAULT_VISUAL as any).visualScale = origAssaultScale + 0.5;

    const resetBtn = handle?.buttons?.reset;
    expect(resetBtn).toBeDefined();

    resetBtn.handlers.click();

    expect(UI_LAYOUT.menu.title.w).toBe(origUiW);
    expect((ASSAULT_VISUAL as any).visualScale).toBe(origAssaultScale);
  });
});
