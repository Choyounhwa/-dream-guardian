/**
 * AssaultFallbackAdapter.ts - 보스 접근전(Boss Assault) 동작형 키보드·터치 폴백 어댑터
 *
 * @see docs/14_BOSS_ASSAULT_GAMEPLAY_DESIGN.md (DOC-14 §8.3, §13 A04, A16, A18)
 * @see docs/15_BOSS_ASSAULT_WORK_CARDS.md (BOSS-ASSAULT-11 / Issue #513)
 *
 * 절대 규칙:
 * 1. Input 레이어 단일 책임: 카메라 미지원 환경에서 동일한 동작 계약(왼손/오른손 펀치, 스쿼트, 점프)을
 *    시험할 수 있는 순수 키보드/터치 입력 신호 정규화 및 이벤트 발화만 전담한다.
 * 2. 정답 판정, HP 차감, 피해량 계산, UI 렌더링, 이펙트 실행을 일체 수행하지 않는다.
 * 3. 새 requestAnimationFrame, setInterval 루프 등록 0회.
 * 4. window, document 등 DOM 이벤트 리스너 직접 등록 0회 (순수 메서드 호출로 외부 이벤트를 수신).
 * 5. 입력 원본 불변성 보장 (전달된 이벤트 객체 변형 금지).
 * 6. repeat 및 holding 재입력 차단: repeat=true 무시, 누르고 있는 동안 1회만 발화, up 후 새 down 시 새 inputId 부여 (A18).
 * 7. 취소(touchcancel), pause(일시정지 중 폐기), reset(세션 변경 시 이전 세션 입력 거부) 철저 준수 (A16, A04).
 */

import type { InputId, PairId, SessionId } from '../types/assault.js';

export type AssaultFallbackAction = 'left_punch' | 'right_punch' | 'squat' | 'jump';

export interface FallbackKeyboardInput {
  readonly key: string;
  readonly code?: string;
  readonly repeat?: boolean;
  readonly timestampMs?: number;
  readonly activeSeconds?: number;
  readonly sessionId?: SessionId;
  readonly pairId?: PairId;
}

export interface FallbackTouchPointInput {
  readonly identifier?: number | string;
  readonly x: number;
  readonly y: number;
  readonly screenWidth?: number;
  readonly screenHeight?: number;
  readonly zone?: 'left' | 'right' | 'bottom' | 'squat' | AssaultFallbackAction;
  readonly timestampMs?: number;
  readonly activeSeconds?: number;
  readonly sessionId?: SessionId;
  readonly pairId?: PairId;
}

export interface FallbackTouchPoint {
  readonly identifier?: number | string;
  readonly x: number;
  readonly y: number;
  readonly zone?: 'left' | 'right' | 'bottom' | 'squat' | AssaultFallbackAction;
}

export interface FallbackTouchInput {
  readonly touches: readonly FallbackTouchPoint[];
  readonly changedTouches?: readonly FallbackTouchPoint[];
  readonly screenWidth?: number;
  readonly screenHeight?: number;
  readonly timestampMs?: number;
  readonly activeSeconds?: number;
  readonly sessionId?: SessionId;
  readonly pairId?: PairId;
}

export interface AssaultFallbackEvent {
  readonly inputId: InputId;
  readonly action: AssaultFallbackAction;
  readonly source: 'keyboard' | 'touch';
  readonly timestampMs: number;
  readonly activeTimestampSeconds?: number;
  readonly sessionId?: SessionId;
  readonly pairId?: PairId;
  readonly key?: string;
  readonly touchIdentifier?: number | string;
  readonly normalizedCoords?: { readonly x: number; readonly y: number };
}

export interface AssaultFallbackConfig {
  readonly squatZoneYThreshold: number;
  readonly leftRightBoundaryX: number;
  readonly idPrefix: string;
  readonly customKeyMap?: Readonly<Record<string, AssaultFallbackAction>>;
}

export const DEFAULT_ASSAULT_FALLBACK_CONFIG: AssaultFallbackConfig = {
  squatZoneYThreshold: 0.7,
  leftRightBoundaryX: 0.5,
  idPrefix: 'fallback',
};

function normalizeKey(str: string): string {
  return str.toLowerCase().trim();
}

function resolveKeyAction(
  key?: string,
  code?: string,
  customMap?: Readonly<Record<string, AssaultFallbackAction>>,
): AssaultFallbackAction | null {
  if (customMap) {
    if (key && customMap[key]) return customMap[key];
    if (code && customMap[code]) return customMap[code];
  }

  const normKey = key ? normalizeKey(key) : '';
  const normCode = code ? normalizeKey(code) : '';

  if (
    normKey === 'arrowleft' ||
    normKey === 'a' ||
    normKey === 'keya' ||
    normCode === 'arrowleft' ||
    normCode === 'keya'
  ) {
    return 'left_punch';
  }

  if (
    normKey === 'arrowright' ||
    normKey === 'd' ||
    normKey === 'keyd' ||
    normCode === 'arrowright' ||
    normCode === 'keyd'
  ) {
    return 'right_punch';
  }

  if (
    normKey === 'arrowdown' ||
    normKey === 's' ||
    normKey === 'keys' ||
    normCode === 'arrowdown' ||
    normCode === 'keys'
  ) {
    return 'squat';
  }

  if (
    normKey === 'arrowup' ||
    normKey === 'w' ||
    normKey === 'keyw' ||
    normKey === 'space' ||
    normKey === '' ||
    normKey === ' ' ||
    normCode === 'arrowup' ||
    normCode === 'keyw' ||
    normCode === 'space'
  ) {
    return 'jump';
  }

  return null;
}

function normalizeCoordinates(
  x: number,
  y: number,
  screenWidth?: number,
  screenHeight?: number,
): { readonly x: number; readonly y: number } {
  let normX = x;
  let normY = y;
  if (typeof screenWidth === 'number' && screenWidth > 0 && x > 1) {
    normX = Math.max(0, Math.min(1, x / screenWidth));
  }
  if (typeof screenHeight === 'number' && screenHeight > 0 && y > 1) {
    normY = Math.max(0, Math.min(1, y / screenHeight));
  }
  return { x: normX, y: normY };
}

function resolveTouchAction(
  coords: { x: number; y: number },
  zone?: string,
  squatY = 0.7,
  splitX = 0.5,
): AssaultFallbackAction {
  if (zone) {
    if (zone === 'left' || zone === 'left_punch') return 'left_punch';
    if (zone === 'right' || zone === 'right_punch') return 'right_punch';
    if (zone === 'bottom' || zone === 'squat') return 'squat';
    if (zone === 'jump') return 'jump';
  }

  if (coords.y >= squatY) {
    return 'squat';
  }
  if (coords.x < splitX) {
    return 'left_punch';
  }
  return 'right_punch';
}

export class AssaultFallbackAdapter {
  private readonly _config: AssaultFallbackConfig;
  private readonly _listeners = new Set<(event: AssaultFallbackEvent) => void>();
  private readonly _heldKeys = new Set<string>();
  private readonly _activeTouches = new Map<number | string, AssaultFallbackAction>();

  private _isPaused = false;
  private _sessionId: SessionId | null = null;
  private static _globalCounter = 0;

  constructor(customConfig?: Partial<AssaultFallbackConfig>) {
    this._config = Object.freeze({
      squatZoneYThreshold:
        customConfig?.squatZoneYThreshold ?? DEFAULT_ASSAULT_FALLBACK_CONFIG.squatZoneYThreshold,
      leftRightBoundaryX:
        customConfig?.leftRightBoundaryX ?? DEFAULT_ASSAULT_FALLBACK_CONFIG.leftRightBoundaryX,
      idPrefix: customConfig?.idPrefix ?? DEFAULT_ASSAULT_FALLBACK_CONFIG.idPrefix,
      customKeyMap: customConfig?.customKeyMap,
    });
  }

  public get config(): AssaultFallbackConfig {
    return this._config;
  }

  public get isPaused(): boolean {
    return this._isPaused;
  }

  public get sessionId(): SessionId | null {
    return this._sessionId;
  }

  public pause(): void {
    this._isPaused = true;
    this._heldKeys.clear();
    this._activeTouches.clear();
  }

  public resume(): void {
    this._isPaused = false;
  }

  public setSessionId(sessionId: SessionId | null): void {
    this._sessionId = sessionId;
  }

  public onAction(listener: (event: AssaultFallbackEvent) => void): () => void {
    this._listeners.add(listener);
    return () => {
      this._listeners.delete(listener);
    };
  }

  private _nextInputId(action: AssaultFallbackAction): string {
    AssaultFallbackAdapter._globalCounter += 1;
    return `${this._config.idPrefix}-${action}-${AssaultFallbackAdapter._globalCounter}`;
  }

  private _isSessionValid(inputSessionId?: SessionId): boolean {
    if (this._sessionId !== null && inputSessionId !== undefined && inputSessionId !== this._sessionId) {
      return false;
    }
    return true;
  }

  private _getKeyIdentifier(event: FallbackKeyboardInput): string {
    if (event.code) return event.code.toLowerCase();
    return event.key.toLowerCase();
  }

  public handleKeyDown(event: FallbackKeyboardInput): AssaultFallbackEvent | null {
    if (this._isPaused) return null;
    if (event.repeat === true) return null;
    if (!this._isSessionValid(event.sessionId)) return null;

    const action = resolveKeyAction(event.key, event.code, this._config.customKeyMap);
    if (!action) return null;

    const keyId = this._getKeyIdentifier(event);
    if (this._heldKeys.has(keyId)) {
      return null;
    }

    this._heldKeys.add(keyId);

    const fallbackEvent: AssaultFallbackEvent = Object.freeze({
      inputId: this._nextInputId(action),
      action,
      source: 'keyboard',
      timestampMs: event.timestampMs ?? Date.now(),
      activeTimestampSeconds: event.activeSeconds,
      sessionId: event.sessionId ?? this._sessionId ?? undefined,
      pairId: event.pairId,
      key: event.key,
    });

    for (const listener of this._listeners) {
      try {
        listener(fallbackEvent);
      } catch {
        // 리스너 오류가 어댑터 핵심 상태를 훼손하지 않도록 보호
      }
    }

    return fallbackEvent;
  }

  public handleKeyUp(event: FallbackKeyboardInput): void {
    const keyId = this._getKeyIdentifier(event);
    this._heldKeys.delete(keyId);
  }

  public handleTouchStart(event: FallbackTouchPointInput): AssaultFallbackEvent | null {
    if (this._isPaused) return null;
    if (!this._isSessionValid(event.sessionId)) return null;

    const touchId = event.identifier ?? 0;
    if (this._activeTouches.has(touchId)) {
      return null;
    }

    const normCoords = normalizeCoordinates(
      event.x,
      event.y,
      event.screenWidth,
      event.screenHeight,
    );

    const action = resolveTouchAction(
      normCoords,
      event.zone,
      this._config.squatZoneYThreshold,
      this._config.leftRightBoundaryX,
    );

    this._activeTouches.set(touchId, action);

    const fallbackEvent: AssaultFallbackEvent = Object.freeze({
      inputId: this._nextInputId(action),
      action,
      source: 'touch',
      timestampMs: event.timestampMs ?? Date.now(),
      activeTimestampSeconds: event.activeSeconds,
      sessionId: event.sessionId ?? this._sessionId ?? undefined,
      pairId: event.pairId,
      touchIdentifier: event.identifier,
      normalizedCoords: normCoords,
    });

    for (const listener of this._listeners) {
      try {
        listener(fallbackEvent);
      } catch {
        // 리스너 오류 보호
      }
    }

    return fallbackEvent;
  }

  public handleTouchEnd(event: FallbackTouchPointInput): void {
    const touchId = event.identifier ?? 0;
    this._activeTouches.delete(touchId);
  }

  public handleTouchCancel(event?: FallbackTouchPointInput): void {
    if (event?.identifier !== undefined) {
      this._activeTouches.delete(event.identifier);
    } else {
      this._activeTouches.clear();
    }
  }

  public handleTouches(input: FallbackTouchInput): AssaultFallbackEvent[] {
    if (this._isPaused) return [];
    if (!this._isSessionValid(input.sessionId)) return [];

    const results: AssaultFallbackEvent[] = [];
    const touches = input.touches || [];
    for (const touch of touches) {
      const ev = this.handleTouchStart({
        identifier: touch.identifier,
        x: touch.x,
        y: touch.y,
        screenWidth: input.screenWidth,
        screenHeight: input.screenHeight,
        zone: touch.zone,
        timestampMs: input.timestampMs,
        activeSeconds: input.activeSeconds,
        sessionId: input.sessionId,
        pairId: input.pairId,
      });
      if (ev) {
        results.push(ev);
      }
    }
    return results;
  }

  public reset(newSessionId?: SessionId): void {
    this._heldKeys.clear();
    this._activeTouches.clear();
    if (newSessionId !== undefined) {
      this._sessionId = newSessionId;
    }
  }
}
