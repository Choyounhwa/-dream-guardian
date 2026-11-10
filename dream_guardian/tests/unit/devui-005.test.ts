/**
 * [DEVUI-005] (Issue #565) 개발 모드 화면 프리셋 - 플레이 계열
 *
 * 프리셋:
 * - run_question (RUN_QUESTION, 고정 문제 및 플레이어/보스 HP)
 * - answer_select (ANSWER_SELECT, 고정 문제 및 보기)
 * - hazard_evade (HAZARD_EVADE, 고정 장애물 패턴)
 * - boss_battle (기본 Ch.1), boss_battle_ch1~5 (HP 정상), boss_battle_low_hp, boss_battle_ch1~5_low (HP 낮음)
 * - boss_climax (BOSS_CLIMAX, 보스 결전)
 * - star_collect (STAR_COLLECT, 별 수집)
 *
 * 불변 규칙:
 * - 판정 연동 좌표(피트니스 존 등)는 변경하지 않으며, 모션 판정 입력은 연결하지 않음 (읽기 전용 잠금)
 * - 프리셋 진입 후 고정 더미 데이터 주입 및 저장소 쓰기 0회
 * - freeze 상태에서 HP·타이머가 변하지 않음
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { AppBootstrap } from '../../src/core/AppBootstrap.js';
import { DEFAULT_FITNESS_ZONES } from '../../config/zone.config.js';
import {
  DEV_PRESET_IDS,
  parseDevPreset,
  getPresetTarget,
  applyDevPreset,
  getPlayPresetParams,
  FIXED_DEV_QUESTION,
  FIXED_DEV_PLAYER_HP,
  FIXED_DEV_PLAYER_MANA,
  FIXED_DEV_COMBO,
  FIXED_BOSS_HP,
  type DevPresetId,
} from '../../src/dev/DevScenePresets.js';

function createMockCanvas(clientW = 540, clientH = 960) {
  const ctx: any = new Proxy(
    { canvas: { width: 1080, height: 2160 }, measureText: () => ({ width: 100 }) },
    {
      get(target: any, key) {
        if (key in target) return target[key];
        if (key === 'createLinearGradient' || key === 'createRadialGradient') {
          return () => ({ addColorStop: () => {} });
        }
        return () => {};
      },
      set(target: any, key, value) {
        target[key] = value;
        return true;
      },
    },
  );
  return {
    clientWidth: clientW,
    clientHeight: clientH,
    width: 1080,
    height: 2160,
    getContext: () => ctx,
    getBoundingClientRect: () => ({ left: 0, top: 0, width: clientW, height: clientH }),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  };
}

function createStorage() {
  const store = new Map<string, string>();
  return {
    getItem: vi.fn((k: string) => store.get(k) ?? null),
    setItem: vi.fn((k: string, v: string) => {
      store.set(k, String(v));
    }),
    removeItem: vi.fn((k: string) => {
      store.delete(k);
    }),
    clear: vi.fn(() => store.clear()),
    get length() {
      return store.size;
    },
    key: vi.fn((i: number) => Array.from(store.keys())[i] ?? null),
  };
}

describe('DEVUI-005 프리셋 ID 및 타겟 매핑 명세', () => {
  const expectedPlayPresets: DevPresetId[] = [
    'run_question',
    'answer_select',
    'hazard_evade',
    'boss_battle',
    'boss_battle_ch1',
    'boss_battle_ch2',
    'boss_battle_ch3',
    'boss_battle_ch4',
    'boss_battle_ch5',
    'boss_battle_low_hp',
    'boss_battle_ch1_low',
    'boss_battle_ch2_low',
    'boss_battle_ch3_low',
    'boss_battle_ch4_low',
    'boss_battle_ch5_low',
    'boss_climax',
    'star_collect',
  ];

  it('DEV_PRESET_IDS 목록에 모든 플레이 계열 프리셋이 포함된다', () => {
    for (const preset of expectedPlayPresets) {
      expect(DEV_PRESET_IDS).toContain(preset);
    }
  });

  it('각 플레이 프리셋이 정확한 GameState 타겟을 반환한다', () => {
    expect(getPresetTarget('run_question')).toBe('RUN_QUESTION');
    expect(getPresetTarget('answer_select')).toBe('ANSWER_SELECT');
    expect(getPresetTarget('hazard_evade')).toBe('HAZARD_EVADE');
    expect(getPresetTarget('boss_battle')).toBe('RUN_QUESTION');
    expect(getPresetTarget('boss_battle_ch1')).toBe('RUN_QUESTION');
    expect(getPresetTarget('boss_battle_ch2')).toBe('RUN_QUESTION');
    expect(getPresetTarget('boss_battle_ch3')).toBe('RUN_QUESTION');
    expect(getPresetTarget('boss_battle_ch4')).toBe('RUN_QUESTION');
    expect(getPresetTarget('boss_battle_ch5')).toBe('RUN_QUESTION');
    expect(getPresetTarget('boss_battle_low_hp')).toBe('RUN_QUESTION');
    expect(getPresetTarget('boss_battle_ch1_low')).toBe('RUN_QUESTION');
    expect(getPresetTarget('boss_battle_ch5_low')).toBe('RUN_QUESTION');
    expect(getPresetTarget('boss_climax')).toBe('BOSS_CLIMAX');
    expect(getPresetTarget('star_collect')).toBe('STAR_COLLECT');
  });

  it('parseDevPreset이 플레이 프리셋 쿼리를 대소문자 무관하게 파싱한다', () => {
    expect(parseDevPreset('?dev=ui&preset=run_question')).toBe('run_question');
    expect(parseDevPreset('?dev=ui&preset=ANSWER_SELECT')).toBe('answer_select');
    expect(parseDevPreset('?dev=ui&preset=hazard_evade')).toBe('hazard_evade');
    expect(parseDevPreset('?dev=ui&preset=boss_battle_ch3')).toBe('boss_battle_ch3');
    expect(parseDevPreset('?dev=ui&preset=boss_climax')).toBe('boss_climax');
    expect(parseDevPreset('?dev=ui&preset=star_collect')).toBe('star_collect');
  });
});

describe('DEVUI-005 주입 데이터 사양 검증', () => {
  it('고정 문제 규격은 2답안(Zone 4/5)을 만족하고 질문과 답을 갖는다', () => {
    expect(FIXED_DEV_QUESTION.choices).toHaveLength(2);
    expect(FIXED_DEV_QUESTION.questionText).toBeTruthy();
    expect(FIXED_DEV_QUESTION.correctIndex).toBeGreaterThanOrEqual(0);
    expect(FIXED_DEV_QUESTION.correctIndex).toBeLessThan(2);
  });

  it('기본 플레이어 HP(80), 마나(50), 콤보(3) 상수가 정의되어 있다', () => {
    expect(FIXED_DEV_PLAYER_HP).toBe(80);
    expect(FIXED_DEV_PLAYER_MANA).toBe(50);
    expect(FIXED_DEV_COMBO).toBe(3);
  });

  it('챕터별 보스 HP는 Ch.1~4 정상 7/10, 낮음 2/10, Ch.5 정상 14/20, 낮음 4/20이다', () => {
    expect(FIXED_BOSS_HP[1]).toEqual({ normal: 7, low: 2, max: 10 });
    expect(FIXED_BOSS_HP[2]).toEqual({ normal: 7, low: 2, max: 10 });
    expect(FIXED_BOSS_HP[3]).toEqual({ normal: 7, low: 2, max: 10 });
    expect(FIXED_BOSS_HP[4]).toEqual({ normal: 7, low: 2, max: 10 });
    expect(FIXED_BOSS_HP[5]).toEqual({ normal: 14, low: 4, max: 20 });
  });

  it('getPlayPresetParams가 각 프리셋별 올바른 파라미터를 생성한다', () => {
    const runParams = getPlayPresetParams('run_question');
    expect(runParams).not.toBeNull();
    expect(runParams?.playerHp).toBe(FIXED_DEV_PLAYER_HP);
    expect(runParams?.bossHp).toBe(FIXED_BOSS_HP[1].normal);
    expect(runParams?.question).toEqual(FIXED_DEV_QUESTION);

    const ch5Params = getPlayPresetParams('boss_battle_ch5');
    expect(ch5Params?.chapter).toBe(5);
    expect(ch5Params?.bossHp).toBe(14);
    expect(ch5Params?.bossMaxHp).toBe(20);

    const ch5LowParams = getPlayPresetParams('boss_battle_ch5_low');
    expect(ch5LowParams?.chapter).toBe(5);
    expect(ch5LowParams?.bossHp).toBe(4);

    const hazardParams = getPlayPresetParams('hazard_evade');
    expect(hazardParams?.hazardPattern).toBeTruthy();

    const climaxParams = getPlayPresetParams('boss_climax');
    expect(climaxParams?.chapter).toBe(5);
  });
});

describe('DEVUI-005 실제 AppBootstrap 플레이 프리셋 적용 통합 검증', () => {
  let storage: ReturnType<typeof createStorage>;
  let app: AppBootstrap;
  let warn: ReturnType<typeof vi.spyOn>;
  let log: ReturnType<typeof vi.spyOn>;
  let force: (s: any) => boolean;

  beforeEach(() => {
    storage = createStorage();
    vi.stubGlobal('localStorage', storage);
    warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    log = vi.spyOn(console, 'log').mockImplementation(() => {});
    app = new AppBootstrap({ canvas: createMockCanvas() as any, autoStartCamera: false, preloadAssets: false });
    const token = Symbol('test-dev');
    app.stateMachine.enableDevForce(token);
    force = (s) => app.stateMachine.forceState(s, token) || app.stateMachine.currentState === s;
    storage.setItem.mockClear();
    storage.removeItem.mockClear();
    storage.clear.mockClear();
  });

  afterEach(() => {
    warn.mockRestore();
    log.mockRestore();
    vi.unstubAllGlobals();
  });

  it('run_question 프리셋 적용 시 상태, HP, 마나, 콤보, 보스 HP, 문제가 주입된다', () => {
    const res = applyDevPreset(app, 'run_question', { storage, force });
    expect(res.ok).toBe(true);
    expect(app.stateMachine.currentState).toBe('RUN_QUESTION');

    expect(app.battle.hp).toBe(80);
    expect(app.battle.mana).toBe(50);
    expect(app.battle.combo).toBe(3);
    expect(app.boss.hp).toBe(7);
    expect(app.boss.maxHp).toBe(10);
    expect(app.currentQuestion).toEqual(FIXED_DEV_QUESTION);

    expect(storage.setItem).not.toHaveBeenCalled();
  });

  it('answer_select 프리셋 적용 시 ANSWER_SELECT 상태로 진입하고 문제가 주입된다', () => {
    const res = applyDevPreset(app, 'answer_select', { storage, force });
    expect(res.ok).toBe(true);
    expect(app.stateMachine.currentState).toBe('ANSWER_SELECT');
    expect(app.currentQuestion).toEqual(FIXED_DEV_QUESTION);
    expect(app.battle.hp).toBe(80);
    expect(storage.setItem).not.toHaveBeenCalled();
  });

  it('hazard_evade 프리셋 적용 시 HAZARD_EVADE 상태 및 장애물 데이터가 주입된다', () => {
    const res = applyDevPreset(app, 'hazard_evade', { storage, force });
    expect(res.ok).toBe(true);
    expect(app.stateMachine.currentState).toBe('HAZARD_EVADE');
    expect(app.phaseAHazardController.activePattern).toBeTruthy();
    expect(storage.setItem).not.toHaveBeenCalled();
  });

  it('boss_battle_ch5 프리셋 적용 시 5챕터 나이트메어 HP(14/20)가 주입된다', () => {
    const res = applyDevPreset(app, 'boss_battle_ch5', { storage, force });
    expect(res.ok).toBe(true);
    expect(app.stateMachine.currentState).toBe('RUN_QUESTION');
    expect(app.currentChapter).toBe(5);
    expect(app.boss.hp).toBe(14);
    expect(app.boss.maxHp).toBe(20);
    expect(storage.setItem).not.toHaveBeenCalled();
  });

  it('boss_battle_ch1_low 프리셋 적용 시 1챕터 보스 낮은 HP(2/10)가 주입된다', () => {
    const res = applyDevPreset(app, 'boss_battle_ch1_low', { storage, force });
    expect(res.ok).toBe(true);
    expect(app.boss.hp).toBe(2);
    expect(app.boss.maxHp).toBe(10);
    expect(storage.setItem).not.toHaveBeenCalled();
  });

  it('boss_climax 프리셋 적용 시 BOSS_CLIMAX 상태로 안전하게 전환된다', () => {
    const res = applyDevPreset(app, 'boss_climax', { storage, force });
    expect(res.ok).toBe(true);
    expect(app.stateMachine.currentState).toBe('BOSS_CLIMAX');
    expect(storage.setItem).not.toHaveBeenCalled();
  });

  it('star_collect 프리셋 적용 시 STAR_COLLECT 상태로 안전하게 전환된다', () => {
    const res = applyDevPreset(app, 'star_collect', { storage, force });
    expect(res.ok).toBe(true);
    expect(app.stateMachine.currentState).toBe('STAR_COLLECT');
    expect(storage.setItem).not.toHaveBeenCalled();
  });

  it('모든 신규 플레이 프리셋 적용 중 저장소 쓰기가 0회이다', () => {
    const playPresets: DevPresetId[] = [
      'run_question',
      'answer_select',
      'hazard_evade',
      'boss_battle',
      'boss_battle_ch1',
      'boss_battle_ch2',
      'boss_battle_ch3',
      'boss_battle_ch4',
      'boss_battle_ch5',
      'boss_battle_low_hp',
      'boss_battle_ch1_low',
      'boss_battle_ch2_low',
      'boss_battle_ch3_low',
      'boss_battle_ch4_low',
      'boss_battle_ch5_low',
      'boss_climax',
      'star_collect',
    ];

    for (const preset of playPresets) {
      const res = applyDevPreset(app, preset, { storage, force });
      expect(res.ok).toBe(true);
      expect(res.state).toBe(getPresetTarget(preset));
      expect(app.stateMachine.currentState).toBe(getPresetTarget(preset));
    }

    expect(storage.setItem).not.toHaveBeenCalled();
    expect(storage.removeItem).not.toHaveBeenCalled();
    expect(storage.clear).not.toHaveBeenCalled();
  });

  it('freeze 상태(engine.frozen=true)에서는 게임 루프/시간 경과에도 HP와 콤보가 유지된다', () => {
    applyDevPreset(app, 'run_question', { storage, force });
    const initialHp = app.battle.hp;
    const initialBossHp = app.boss.hp;
    const initialCombo = app.battle.combo;

    // DEVUI-003 정지 활성화
    app.engine.setFrozen(true);
    expect(app.engine.frozen).toBe(true);

    // 가상 프레임 진행 시도 (_loop)
    (app.engine as any)._loop(1000);
    (app.engine as any)._loop(2000);

    // frozen 상태이므로 실제 게임 로직 갱신이 스킵되어 상태 유지
    expect(app.battle.hp).toBe(initialHp);
    expect(app.boss.hp).toBe(initialBossHp);
    expect(app.battle.combo).toBe(initialCombo);
    expect(app.stateMachine.currentState).toBe('RUN_QUESTION');
  });

  it('피트니스 존 좌표는 잠금 정책에 의해 수정되지 않는다 (DEFAULT_FITNESS_ZONES 불변)', () => {
    const originalZoneCount = Object.keys(DEFAULT_FITNESS_ZONES).length;
    applyDevPreset(app, 'hazard_evade', { storage, force });
    expect(Object.keys(DEFAULT_FITNESS_ZONES).length).toBe(originalZoneCount);
  });

  it('DevScenePresets 모듈은 순환 방지를 위해 AppBootstrap, SceneDirector를 정적 import하지 않는다', () => {
    const file = resolve(__dirname, '../../src/dev/DevScenePresets.ts');
    const source = readFileSync(file, 'utf-8');
    const importLines = source
      .split('\n')
      .filter((l) => l.startsWith('import ') && !l.includes('import type'))
      .join('\n');
    expect(importLines).not.toMatch(/AppBootstrap|SceneDirector/);
  });
});
