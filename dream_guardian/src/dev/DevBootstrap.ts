/**
 * [DEVUI-001] (Issue #561) 인게임 UI 개발 모드 부트스트랩 (개발 전용)
 * [DEVUI-003] (Issue #563) 화면 강제 이동(Scene Jump) + 시간 정지(Freeze)
 *
 * main.ts에서 `import.meta.env.DEV && ?dev=ui` 일 때만 동적 import 된다.
 * 좌상단 "DEV UI" 배지와 상태 드롭다운/정지 체크박스 패널을 표시한다.
 * (3파일 제한으로 DevSceneJumper 기능을 이 진입 모듈 안에 둔다.)
 */

import { StateMachine } from '../core/StateMachine.js';
import type { GameState } from '../types/index.js';

export const DEV_UI_BADGE_ID = 'dg-dev-ui-badge';
export const DEV_UI_BADGE_TEXT = 'DEV UI';
export const DEV_SCENE_JUMPER_ID = 'dg-dev-scene-jumper';

/** DevBootstrap만 보유하는 강제 전환 토큰 (모듈 밖으로 노출하지 않는다) */
const DEV_FORCE_TOKEN: unique symbol = Symbol('dg-dev-force');

/** 강제 이동 가능한 상태 목록 (StateMachine 전환 테이블의 키, 새 상태 추가 시 자동 반영) */
export function getDevScreenStates(): GameState[] {
  return Object.keys(StateMachine.getAllowedTransitions()) as GameState[];
}

/**
 * `?dev=ui&screen=<id>` → GameState. id는 대소문자 무시(menu_sub → MENU_SUB).
 * `dev=ui`가 없거나 알 수 없는 id면 null. 다른 파라미터(`mode=boss_assault` 등)는 무시한다.
 */
export function parseDevScreen(search: string): GameState | null {
  const params = new URLSearchParams(search ?? '');
  if (params.get('dev') !== 'ui') return null;
  const raw = (params.get('screen') ?? '').trim();
  if (!raw) return null;
  const id = raw.toUpperCase();
  return (getDevScreenStates() as string[]).includes(id) ? (id as GameState) : null;
}

/** 화면 이동 후 자동 정지 여부. 기본 on, `freeze=0`이면 off */
export function shouldAutoFreeze(search: string): boolean {
  return new URLSearchParams(search ?? '').get('freeze') !== '0';
}

interface DevStateMachineLike {
  currentState: GameState;
  enableDevForce(token: symbol): void;
  forceState(to: GameState, token: symbol): boolean;
}

interface DevEngineLike {
  running?: boolean;
  frozen?: boolean;
  setFrozen(frozen: boolean): void;
}

interface DevAppLike {
  stateMachine?: DevStateMachineLike;
  engine?: DevEngineLike;
}

function getStateMachine(app: unknown): DevStateMachineLike | null {
  const sm = (app as DevAppLike | null)?.stateMachine;
  return sm && typeof sm.forceState === 'function' && typeof sm.enableDevForce === 'function' ? sm : null;
}

function getEngine(app: unknown): DevEngineLike | null {
  const engine = (app as DevAppLike | null)?.engine;
  return engine && typeof engine.setFrozen === 'function' ? engine : null;
}

/** 기본 freeze 예약: 몇 프레임 update가 돌아 새 화면이 반영된 뒤 정지한다 */
function defaultScheduleFreeze(fn: () => void): void {
  let frames = 3;
  const tick = () => (--frames <= 0 ? fn() : requestAnimationFrame(tick));
  requestAnimationFrame(tick);
}

export interface JumpOptions {
  autoFreeze: boolean;
  scheduleFreeze?: (fn: () => void) => void;
}

/** 개발 토큰으로 상태를 강제 전환하고, 옵션에 따라 정지를 예약한다 */
export function jumpToScreen(app: unknown, state: GameState, opts: JumpOptions): boolean {
  const sm = getStateMachine(app);
  if (!sm) return false;
  const engine = getEngine(app);
  if (engine?.frozen) engine.setFrozen(false);
  sm.enableDevForce(DEV_FORCE_TOKEN);
  let ok = false;
  try {
    ok = sm.forceState(state, DEV_FORCE_TOKEN) || sm.currentState === state;
  } catch (err) {
    console.warn('[DEV UI] 화면 이동 실패:', state, err);
    return false;
  }
  if (ok && opts.autoFreeze && engine) {
    (opts.scheduleFreeze ?? defaultScheduleFreeze)(() => engine.setFrozen(true));
  }
  return ok;
}

/** 기본 시작 예약: 엔진 루프가 시작된 뒤 실행한다 (init 완료 전 이동 방지) */
function defaultSchedule(app: unknown): (fn: () => void) => void {
  return (fn) => {
    const wait = () => (getEngine(app)?.running ? fn() : setTimeout(wait, 50));
    wait();
  };
}

export interface StartDevUiOptions {
  schedule?: (fn: () => void) => void;
}

function mountSceneJumper(
  app: unknown,
  doc: Document,
  search: string,
  schedule: (fn: () => void) => void,
  scheduleFreeze: ((fn: () => void) => void) | undefined,
): void {
  if (doc.getElementById(DEV_SCENE_JUMPER_ID)) return;
  const engine = getEngine(app);
  const sm = getStateMachine(app)!;

  const panel = doc.createElement('div');
  panel.id = DEV_SCENE_JUMPER_ID;
  Object.assign(panel.style, {
    position: 'fixed',
    top: '22px',
    left: '0px',
    zIndex: '99999',
    padding: '4px 6px',
    background: 'rgba(20,20,40,0.85)',
    color: '#FFFFFF',
    font: '12px monospace',
  });

  const select = doc.createElement('select');
  for (const state of getDevScreenStates()) {
    const option = doc.createElement('option');
    option.value = state;
    option.textContent = state;
    select.appendChild(option);
  }
  select.value = sm.currentState;

  const freezeLabel = doc.createElement('label');
  const freezeBox = doc.createElement('input');
  freezeBox.type = 'checkbox';
  freezeLabel.appendChild(freezeBox);
  const freezeText = doc.createElement('span');
  freezeText.textContent = ' freeze';
  freezeLabel.appendChild(freezeText);

  const autoFreeze = shouldAutoFreeze(search);
  const syncBox = () => { freezeBox.checked = !!engine?.frozen; };
  const freezeAfterJump = (fn: () => void) =>
    (scheduleFreeze ?? defaultScheduleFreeze)(() => { fn(); syncBox(); });

  select.addEventListener('change', () => {
    jumpToScreen(app, select.value as GameState, { autoFreeze, scheduleFreeze: freezeAfterJump });
    syncBox();
  });
  freezeBox.addEventListener('change', () => {
    engine?.setFrozen(freezeBox.checked);
  });

  panel.appendChild(select);
  panel.appendChild(freezeLabel);
  doc.body.appendChild(panel);

  const target = parseDevScreen(search);
  if (target) {
    schedule(() => {
      jumpToScreen(app, target, { autoFreeze, scheduleFreeze: freezeAfterJump });
      select.value = sm.currentState;
      syncBox();
    });
  }
}

export function startDevUi(
  app: unknown,
  doc: Document = document,
  location: { search: string } | undefined = typeof window !== 'undefined' ? window.location : undefined,
  opts: StartDevUiOptions = {},
): HTMLElement {
  let badge = doc.getElementById(DEV_UI_BADGE_ID);
  if (!badge) {
    badge = doc.createElement('div');
    badge.id = DEV_UI_BADGE_ID;
    badge.textContent = DEV_UI_BADGE_TEXT;
    Object.assign(badge.style, {
      position: 'fixed',
      top: '0px',
      left: '0px',
      zIndex: '99999',
      padding: '4px 8px',
      background: '#FF3B6B',
      color: '#FFFFFF',
      font: 'bold 12px monospace',
      pointerEvents: 'none',
    });
    doc.body.appendChild(badge);
  }

  // [DEVUI-003] stateMachine이 있는 실제 앱에서만 화면 이동/정지 패널을 붙인다.
  if (getStateMachine(app)) {
    mountSceneJumper(
      app,
      doc,
      location?.search ?? '',
      opts.schedule ?? defaultSchedule(app),
      opts.schedule,
    );
  }
  return badge;
}
