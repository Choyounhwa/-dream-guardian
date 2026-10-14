/**
 * [DEVUI-004] (Issue #564) 개발 모드 화면 프리셋 - 메뉴 계열 (개발 전용)
 *
 * DevBootstrap(동적 import)에서만 사용한다. 프로덕션 모듈에서 import 하지 않는다.
 * - AppBootstrap 공개 API(goToMenu, selectChapter, startReadyPhase, showResult, 모달 open 등)와
 *   DEVUI-003 강제 이동(force 콜백)만 사용한다.
 * - 결과/게임오버는 고정 값으로 만들고, 적용 중 저장소 쓰기를 차단한다(진척도·기록·설정 보존).
 * - 에디터 fixture/UIPageAdapters 는 순환 import 위험(#555)으로 쓰지 않는다.
 */

import type { GameState, GeneratedQuestion } from '../types/index.js';
import type { PhaseAHazardPattern } from '../../config/phase-a-hazard.config.js';

export interface DevPlayStateParams {
  chapter?: number;
  playerHp?: number;
  playerMaxHp?: number;
  playerMana?: number;
  combo?: number;
  bossHp?: number;
  bossMaxHp?: number;
  bossPhase?: 'idle' | 'warning' | 'attacking' | 'defeated';
  question?: GeneratedQuestion | null;
  hazardPattern?: PhaseAHazardPattern;
}

export const DEV_PRESET_IDS = [
  'menu_main',
  'menu_sub_1',
  'menu_sub_2',
  'menu_sub_3',
  'menu_sub_4',
  'menu_sub_5',
  'settings',
  'locomotion_modal',
  'pause',
  'ready_position',
  'result_1',
  'result_2',
  'result_3',
  'gameover',
  // DEVUI-005 Play Presets
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
] as const;

export type DevPresetId = (typeof DEV_PRESET_IDS)[number];

/** 별칭: `preset=menu_sub` → 1챕터, `preset=result` → 별 3개 */
const PRESET_ALIASES: Record<string, DevPresetId> = {
  menu_sub: 'menu_sub_1',
  result: 'result_3',
  boss_battle_low: 'boss_battle_low_hp',
};

/** 결과 고정 값: 별 개수 → 정답 수 (10문항, 60초 기준 calcStars 1/2/3) */
const RESULT_CORRECT_BY_STARS: Record<1 | 2 | 3, number> = { 1: 5, 2: 8, 3: 10 };
const FIXED_TOTAL_QUESTIONS = 10;
const FIXED_GAMEOVER_CORRECT = 3;
/** 표시용 고정 운동 기록 */
const FIXED_RESULT_DISPLAY = { steps: 120, squats: 0, jumps: 12, elapsedTime: 60, dwellTime: 30 };

/** DEVUI-005 고정 문제 규격 (Zone 4/5 2답안 구조 엄격 준수) */
export const FIXED_DEV_QUESTION: GeneratedQuestion = {
  questionText: '3 + 5 = ?',
  correctAnswer: 8,
  wrongAnswer: 6,
  choices: [6, 8],
  correctIndex: 1,
};

export const FIXED_DEV_PLAYER_HP = 80;
export const FIXED_DEV_PLAYER_MANA = 50;
export const FIXED_DEV_COMBO = 3;

export const FIXED_BOSS_HP: Record<number, { normal: number; low: number; max: number }> = {
  1: { normal: 7, low: 2, max: 10 },
  2: { normal: 7, low: 2, max: 10 },
  3: { normal: 7, low: 2, max: 10 },
  4: { normal: 7, low: 2, max: 10 },
  5: { normal: 14, low: 4, max: 20 },
};

export const FIXED_DEV_HAZARD_PATTERN: PhaseAHazardPattern = 'jump';

export function getPlayPresetParams(id: DevPresetId): DevPlayStateParams | null {
  if (id === 'run_question' || id === 'answer_select') {
    return {
      chapter: 1,
      playerHp: FIXED_DEV_PLAYER_HP,
      playerMana: FIXED_DEV_PLAYER_MANA,
      combo: FIXED_DEV_COMBO,
      bossHp: FIXED_BOSS_HP[1].normal,
      bossMaxHp: FIXED_BOSS_HP[1].max,
      question: FIXED_DEV_QUESTION,
    };
  }
  if (id === 'hazard_evade') {
    return {
      chapter: 1,
      playerHp: FIXED_DEV_PLAYER_HP,
      playerMana: FIXED_DEV_PLAYER_MANA,
      combo: FIXED_DEV_COMBO,
      bossHp: FIXED_BOSS_HP[1].normal,
      bossMaxHp: FIXED_BOSS_HP[1].max,
      hazardPattern: FIXED_DEV_HAZARD_PATTERN,
    };
  }
  if (id === 'star_collect') {
    return {
      chapter: 1,
      playerHp: FIXED_DEV_PLAYER_HP,
      playerMana: FIXED_DEV_PLAYER_MANA,
      combo: FIXED_DEV_COMBO,
      bossHp: FIXED_BOSS_HP[1].normal,
      bossMaxHp: FIXED_BOSS_HP[1].max,
    };
  }
  if (id === 'boss_climax') {
    return {
      chapter: 5,
      playerHp: FIXED_DEV_PLAYER_HP,
      playerMana: 75,
      combo: 5,
      bossHp: 6,
      bossMaxHp: FIXED_BOSS_HP[5].max,
      bossPhase: 'idle',
    };
  }
  if (id.startsWith('boss_battle')) {
    let ch = 1;
    const isLow = id.includes('low');
    if (id.includes('ch2')) ch = 2;
    else if (id.includes('ch3')) ch = 3;
    else if (id.includes('ch4')) ch = 4;
    else if (id.includes('ch5')) ch = 5;

    const hpInfo = FIXED_BOSS_HP[ch] ?? FIXED_BOSS_HP[1];
    return {
      chapter: ch,
      playerHp: FIXED_DEV_PLAYER_HP,
      playerMana: FIXED_DEV_PLAYER_MANA,
      combo: FIXED_DEV_COMBO,
      bossHp: isLow ? hpInfo.low : hpInfo.normal,
      bossMaxHp: hpInfo.max,
      question: FIXED_DEV_QUESTION,
    };
  }
  return null;
}

export function getPresetTarget(id: DevPresetId): GameState {
  if (id.startsWith('menu_sub_')) return 'MENU_SUB';
  if (id.startsWith('result_')) return 'RESULT';
  if (id === 'run_question' || id.startsWith('boss_battle')) return 'RUN_QUESTION';
  if (id === 'answer_select') return 'ANSWER_SELECT';
  if (id === 'hazard_evade') return 'HAZARD_EVADE';
  if (id === 'boss_climax') return 'BOSS_CLIMAX';
  if (id === 'star_collect') return 'STAR_COLLECT';
  switch (id) {
    case 'pause':
    case 'ready_position':
      return 'READY_POSITION';
    case 'gameover':
      return 'GAMEOVER';
    default:
      return 'MENU_MAIN';
  }
}

/** `?dev=ui&preset=<id>` → 프리셋 id. `dev=ui`가 없거나 알 수 없는 값이면 null */
export function parseDevPreset(search: string): DevPresetId | null {
  const params = new URLSearchParams(search ?? '');
  if (params.get('dev') !== 'ui') return null;
  const raw = (params.get('preset') ?? '').trim().toLowerCase();
  if (!raw) return null;
  if (PRESET_ALIASES[raw]) return PRESET_ALIASES[raw];
  return (DEV_PRESET_IDS as readonly string[]).includes(raw) ? (raw as DevPresetId) : null;
}

interface StorageLike {
  setItem: (...args: any[]) => void;
  removeItem: (...args: any[]) => void;
  clear: (...args: any[]) => void;
}

const WRITE_METHODS = ['setItem', 'removeItem', 'clear'] as const;

/**
 * fn 실행 동안 저장소 쓰기(setItem/removeItem/clear)를 막는다. 끝나면(예외 포함) 원복한다.
 * 브라우저 Storage 는 인스턴스 속성 대입이 setItem 으로 바뀌므로 Storage.prototype 을 패치한다.
 */
export function withStorageWriteGuard<T>(
  storage: StorageLike | null | undefined,
  fn: () => T,
): { result: T; blocked: number } {
  if (!storage) return { result: fn(), blocked: 0 };
  const target: any =
    typeof Storage !== 'undefined' && storage instanceof Storage ? Storage.prototype : storage;
  const originals = WRITE_METHODS.map((m) => [m, target[m]] as const);
  let blocked = 0;
  for (const m of WRITE_METHODS) {
    target[m] = () => { blocked++; };
  }
  try {
    const result = fn();
    return { result, blocked };
  } finally {
    for (const [m, orig] of originals) target[m] = orig;
    if (blocked > 0) console.info(`[DEV UI] 프리셋 적용 중 저장소 쓰기 ${blocked}회 차단`);
  }
}

function defaultStorage(): StorageLike | null {
  try {
    return typeof localStorage !== 'undefined' ? localStorage : null;
  } catch {
    return null;
  }
}

export interface ApplyPresetOptions {
  /** DEVUI-003 강제 이동 (DevBootstrap 이 토큰을 감싸 전달). 공개 API로 도달하지 못할 때만 쓴다. */
  force?: (state: GameState) => boolean;
  storage?: StorageLike | null;
}

export interface ApplyPresetResult {
  ok: boolean;
  state: GameState | null;
  blocked: number;
}

/** 프리셋 적용에 쓰는 AppBootstrap 공개 API (테스트 fake 호환을 위해 모두 선택) */
interface PresetAppLike {
  stateMachine?: { currentState: GameState };
  goToMenu?: () => void;
  selectChapter?: (ch: number) => void;
  startReadyPhase?: () => void;
  showResult?: (victory: boolean) => void;
  resultData?: Record<string, unknown> | null;
  battle?: {
    reset(): void;
    onCorrect(): void;
    recordWrongAnswer(): void;
    setHp?(v: number): void;
    hp?: number;
    maxHp?: number;
    mana?: number;
    combo?: number;
  };
  boss?: {
    reset(ch?: number): void;
    takeDamage(amount: number): void;
    hp?: number;
    maxHp?: number;
    chapter?: number;
    phase?: string;
  };
  guardian?: { stage?: number; setStage?(stage: number): void };
  beatCoordinator?: { currentQuestion?: GeneratedQuestion | null; isAnswerOpen?: boolean };
  phaseAHazardController?: { isActive?: boolean; activePattern?: any };
  applyDevPlayState?: (params: DevPlayStateParams) => void;
  currentChapter?: number;
  currentQuestion?: GeneratedQuestion | null;
  sessionLifecycle?: { setTestSession(isTest: boolean): void };
  settingsModal?: { isOpen?: boolean; open(): void; close?(): void; update?(dt: number): void };
  locomotionModal?: { open(): void; close?(): void };
  pauseModal?: { open(): void; close?(immediate?: boolean): void; update?(dt: number): void };
  resultRenderer?: { resetAnimation?(t?: number): void };
  transitionManager?: { cancel?(): void };
  effectManager?: { clear?(): void };
  stageBgm?: { pause?(): void };
  bgmManager?: { pause?(): void };
}

/** 열림/닫힘 애니메이션을 끝난 상태로 맞춘다 (정지 화면이 중간 프레임에 멈추지 않게) */
const SETTLE_DT = 1;

function closeModals(app: PresetAppLike): void {
  app.pauseModal?.close?.(true);
  app.locomotionModal?.close?.();
  if (app.settingsModal?.isOpen) {
    app.settingsModal.close?.();
    app.settingsModal.update?.(SETTLE_DT);
  }
}

function prepareFixedBattle(app: PresetAppLike, correct: number): void {
  const battle = app.battle;
  if (!battle) return;
  battle.reset();
  for (let i = 0; i < correct; i++) battle.onCorrect();
  for (let i = correct; i < FIXED_TOTAL_QUESTIONS; i++) battle.recordWrongAnswer();
}

function showFixedResult(
  app: PresetAppLike,
  victory: boolean,
  correct: number,
  force?: (s: GameState) => boolean,
): void {
  prepareFixedBattle(app, correct);
  // 테스트 세션 표시로 진척도/보상/최고기록 저장 경로를 건너뛴다 (goToMenu 시 해제됨)
  app.sessionLifecycle?.setTestSession(true);
  // 메뉴에서는 RESULT/GAMEOVER 로 갈 수 없으므로 라운드 정산 상태로만 강제 이동한 뒤 공개 API 로 전환한다
  if (app.showResult) force?.('ROUND_RESOLVE');
  app.showResult?.(victory);
}

function applyPlayStateToApp(app: PresetAppLike, params: DevPlayStateParams): void {
  if (typeof app.applyDevPlayState === 'function') {
    app.applyDevPlayState(params);
    return;
  }
  if (params.chapter !== undefined) {
    app.selectChapter?.(params.chapter);
    if (app.boss?.reset) {
      app.boss.reset(params.chapter);
    }
  }
  if (app.battle) {
    if (params.playerHp !== undefined) {
      if (typeof app.battle.setHp === 'function') {
        app.battle.setHp(params.playerHp);
      } else {
        (app.battle as any)._hp = params.playerHp;
        (app.battle as any).hp = params.playerHp;
      }
    }
    if (params.playerMana !== undefined) {
      (app.battle as any)._mana = params.playerMana;
      (app.battle as any).mana = params.playerMana;
    }
    if (params.combo !== undefined) {
      (app.battle as any)._combo = params.combo;
      (app.battle as any).combo = params.combo;
    }
  }
  if (app.boss) {
    if (params.bossHp !== undefined) {
      (app.boss as any)._hp = params.bossHp;
      (app.boss as any).hp = params.bossHp;
    }
    if (params.bossMaxHp !== undefined) {
      (app.boss as any)._maxHp = params.bossMaxHp;
      (app.boss as any).maxHp = params.bossMaxHp;
    }
    if (params.bossPhase !== undefined) {
      (app.boss as any)._phase = params.bossPhase;
      (app.boss as any).phase = params.bossPhase;
    }
  }
  if (params.question !== undefined) {
    if (app.beatCoordinator) {
      (app.beatCoordinator as any)._currentQuestion = params.question;
      (app.beatCoordinator as any).currentQuestion = params.question;
    }
    (app as any).currentQuestion = params.question;
  }
  if (params.hazardPattern !== undefined) {
    if (app.phaseAHazardController) {
      (app.phaseAHazardController as any)._activePattern = params.hazardPattern;
      (app.phaseAHazardController as any)._active = true;
    }
  }
}

function runPreset(app: PresetAppLike, id: DevPresetId, force?: (s: GameState) => boolean): void {
  closeModals(app);
  const target = getPresetTarget(id);

  const playParams = getPlayPresetParams(id);
  if (playParams) {
    applyPlayStateToApp(app, playParams);
    if (app.stateMachine && app.stateMachine.currentState !== target) {
      force?.(target);
    }
    applyPlayStateToApp(app, playParams);
    app.transitionManager?.cancel?.();
    app.effectManager?.clear?.();
    return;
  }

  app.goToMenu?.();

  if (id.startsWith('menu_sub_')) {
    app.selectChapter?.(Number(id.slice('menu_sub_'.length)));
  } else if (id === 'settings') {
    app.settingsModal?.open();
    app.settingsModal?.update?.(SETTLE_DT);
  } else if (id === 'locomotion_modal') {
    app.locomotionModal?.open();
  } else if (id === 'ready_position' || id === 'pause') {
    app.startReadyPhase?.();
  } else if (id.startsWith('result_')) {
    const stars = Number(id.slice('result_'.length)) as 1 | 2 | 3;
    showFixedResult(app, true, RESULT_CORRECT_BY_STARS[stars], force);
  } else if (id === 'gameover') {
    showFixedResult(app, false, FIXED_GAMEOVER_CORRECT, force);
  }

  // 공개 API 전환 테이블로 도달하지 못한 경우(예: MENU_MAIN → RESULT) 강제 이동으로 보정
  if (app.stateMachine && app.stateMachine.currentState !== target) {
    force?.(target);
  }

  if (id === 'pause') {
    app.stageBgm?.pause?.();
    app.bgmManager?.pause?.();
    app.pauseModal?.open();
    app.pauseModal?.update?.(SETTLE_DT);
  }

  if (target === 'RESULT' || target === 'GAMEOVER') {
    if (app.resultData) Object.assign(app.resultData, FIXED_RESULT_DISPLAY);
    app.resultRenderer?.resetAnimation?.(10);
  }

  // 화면 전환 페이드/파티클을 지워 정지 화면이 편집하기 좋은 상태가 되게 한다
  app.transitionManager?.cancel?.();
  app.effectManager?.clear?.();
}

/** 프리셋을 적용한다. 적용 중 저장소 쓰기는 차단된다. */
export function applyDevPreset(
  app: unknown,
  id: DevPresetId,
  opts: ApplyPresetOptions = {},
): ApplyPresetResult {
  const a = (app ?? {}) as PresetAppLike;
  const storage = opts.storage === undefined ? defaultStorage() : opts.storage;
  const { blocked } = withStorageWriteGuard(storage, () => runPreset(a, id, opts.force));
  const state = a.stateMachine?.currentState ?? null;
  return { ok: state === getPresetTarget(id), state, blocked };
}
