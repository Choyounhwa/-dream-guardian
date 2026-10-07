/**
 * Dream Guardian - UI 시각 편집기 미리보기 브리지 (UIVisualBridge)
 * Issue #437 (UI-VIS-007)
 * 부모(Parent)와 iframe(Child) 간 양방향 브리지 프로토콜, 엄격한 출처/Window 검증, 세대(Generation) 및 Revision 추적, 보안 검증
 */

export const UI_PREVIEW_PROTOCOL_VERSION = '1.0.0';
export const MAX_BRIDGE_PAYLOAD_BYTES = 1024 * 1024; // 1MB
export const DANGEROUS_KEYS = ['__proto__', 'constructor', 'prototype'] as const;

export const FORBIDDEN_BRIDGE_KINDS = [
  'game:boot',
  'game:start',
  'script:exec',
  'runScript',
  'eval',
  'loop:start',
  'scene:boot',
  'app:bootstrap',
  'asset:fetch-url',
  'url:load',
] as const;

export const SAFE_BRIDGE_KINDS = [
  'preview:ready',
  'preview:snapshot',
  'preview:selection',
  'preview:geometry',
  'preview:update',
  'preview:result',
  'preview:error',
  'preview:ping',
  'preview:pong',
] as const;

export type SafeBridgeKind = (typeof SAFE_BRIDGE_KINDS)[number];
export type ForbiddenBridgeKind = (typeof FORBIDDEN_BRIDGE_KINDS)[number];
export type BridgeMessageKind = SafeBridgeKind | (string & {});

export interface UIVisualBridgeEnvelope<T = unknown> {
  protocolVersion: string;
  docId: string;
  pageId: string;
  sessionId: string;
  generation: number;
  revision: number;
  requestId: string;
  kind: BridgeMessageKind;
  payload?: T;
  timestamp?: number;
}

export interface BridgeValidationContext {
  expectedOrigin: string;
  eventOrigin: string;
  expectedSourceWindow: unknown;
  eventSourceWindow: unknown;
  currentGeneration: number;
  currentRevision: number;
  expectedDocId?: string;
  expectedSessionId?: string;
}

export interface BridgeValidationResult {
  valid: boolean;
  reason?: string;
  envelope?: UIVisualBridgeEnvelope;
}

/**
 * 프로토타입 오염 및 위험 키 검출
 */
export function containsDangerousKey(val: unknown): boolean {
  if (val === null || typeof val !== 'object') {
    return false;
  }

  // 1. Check if prototype is altered (prototype pollution via __proto__ assignment)
  const proto = Object.getPrototypeOf(val);
  if (
    proto !== null &&
    proto !== Object.prototype &&
    proto !== Array.prototype &&
    proto !== Date.prototype &&
    proto !== RegExp.prototype
  ) {
    return true;
  }

  // 2. Check own property names (including non-enumerable)
  try {
    const propNames = Object.getOwnPropertyNames(val);
    for (const key of propNames) {
      if (DANGEROUS_KEYS.includes(key as any)) {
        return true;
      }
    }
  } catch {
    // ignore
  }

  // 3. Check JSON serialization if stringified
  try {
    const str = JSON.stringify(val);
    if (str && /"(?:__proto__|constructor|prototype)"\s*:/.test(str)) {
      return true;
    }
  } catch {
    // ignore
  }

  // 4. Recursive check for nested properties
  for (const key of Object.keys(val)) {
    if (DANGEROUS_KEYS.includes(key as any)) {
      return true;
    }
    if (containsDangerousKey((val as Record<string, unknown>)[key])) {
      return true;
    }
  }
  return false;
}

/**
 * 페이로드 직렬화 바이트 크기 계산
 */
export function calculatePayloadBytes(data: unknown): number {
  if (data === undefined || data === null) {
    return 0;
  }
  try {
    const json = typeof data === 'string' ? data : JSON.stringify(data);
    if (typeof TextEncoder !== 'undefined') {
      return new TextEncoder().encode(json).length;
    }
    return json.length;
  } catch {
    return 0;
  }
}

/**
 * 브리지 봉투 생성 도우미
 */
export function createBridgeEnvelope<T = unknown>(options: {
  docId: string;
  pageId: string;
  sessionId: string;
  kind: BridgeMessageKind;
  generation?: number;
  revision?: number;
  requestId?: string;
  payload?: T;
  protocolVersion?: string;
  timestamp?: number;
}): UIVisualBridgeEnvelope<T> {
  return {
    protocolVersion: options.protocolVersion ?? UI_PREVIEW_PROTOCOL_VERSION,
    docId: options.docId,
    pageId: options.pageId,
    sessionId: options.sessionId,
    generation: options.generation ?? 1,
    revision: options.revision ?? 1,
    requestId: options.requestId ?? `req-${Date.now()}-${Math.floor(Math.random() * 100000)}`,
    kind: options.kind,
    payload: options.payload,
    timestamp: options.timestamp ?? Date.now(),
  };
}

/**
 * 브리지 봉투 유효성 및 보안 검증
 */
export function validateBridgeEnvelope(
  message: unknown,
  context: BridgeValidationContext
): BridgeValidationResult {
  // 1. 와일드카드 origin 금지
  if (context.expectedOrigin === '*' || context.eventOrigin === '*') {
    return { valid: false, reason: 'wildcard-origin-forbidden' };
  }

  // 2. Origin 엄격 일치 검증
  if (context.eventOrigin !== context.expectedOrigin) {
    return { valid: false, reason: 'invalid-origin' };
  }

  // 3. Window 엄격 일치 검증
  if (context.eventSourceWindow !== context.expectedSourceWindow) {
    return { valid: false, reason: 'invalid-source-window' };
  }

  // 4. 봉투 객체 기본 구조 검증
  if (!message || typeof message !== 'object') {
    return { valid: false, reason: 'invalid-envelope' };
  }

  const env = message as Partial<UIVisualBridgeEnvelope>;

  if (typeof env.protocolVersion !== 'string' || env.protocolVersion !== UI_PREVIEW_PROTOCOL_VERSION) {
    return { valid: false, reason: 'invalid-protocol-version' };
  }

  if (
    typeof env.docId !== 'string' ||
    typeof env.pageId !== 'string' ||
    typeof env.sessionId !== 'string' ||
    typeof env.generation !== 'number' ||
    typeof env.revision !== 'number' ||
    typeof env.requestId !== 'string' ||
    typeof env.kind !== 'string'
  ) {
    return { valid: false, reason: 'invalid-envelope' };
  }

  // 5. 프로토타입 오염 및 위험 키 검증
  if (containsDangerousKey(env) || (env.payload !== undefined && containsDangerousKey(env.payload))) {
    return { valid: false, reason: 'dangerous-key' };
  }

  // 6. 페이로드 크기 검증 (1MB 한도)
  if (calculatePayloadBytes(env) > MAX_BRIDGE_PAYLOAD_BYTES) {
    return { valid: false, reason: 'max-bytes' };
  }

  // 7. 금지된 명령어 및 게임 실행 스크립트 차단
  const kind = env.kind as string;
  if (
    (FORBIDDEN_BRIDGE_KINDS as readonly string[]).includes(kind) ||
    kind.startsWith('game:') ||
    kind.startsWith('script:') ||
    kind.startsWith('loop:') ||
    kind.startsWith('scene:') ||
    kind.includes('eval') ||
    kind.includes('runScript') ||
    kind.startsWith('asset:fetch-url')
  ) {
    return { valid: false, reason: 'forbidden-operation' };
  }

  // 8. 허용된 안전 메시지 종류 검증
  if (!(SAFE_BRIDGE_KINDS as readonly string[]).includes(kind)) {
    return { valid: false, reason: 'unknown-kind' };
  }

  // 9. 세대(Generation) 추적 검증
  if (env.generation < context.currentGeneration) {
    return { valid: false, reason: 'stale-generation' };
  }
  if (env.generation > context.currentGeneration) {
    return { valid: false, reason: 'stale-generation' };
  }

  // 10. 동일 세대 내 과거 Revision 검증
  if (env.revision < context.currentRevision) {
    return { valid: false, reason: 'stale-revision' };
  }

  return {
    valid: true,
    envelope: env as UIVisualBridgeEnvelope,
  };
}

export interface ParentBridgeOptions {
  window: Window;
  iframe: HTMLIFrameElement;
  targetOrigin: string;
  docId: string;
  pageId: string;
  sessionId: string;
  initialGeneration?: number;
  initialRevision?: number;
  onMessage?: (envelope: UIVisualBridgeEnvelope) => void;
  onError?: (error: { reason: string; event?: MessageEvent; rawData?: unknown }) => void;
}

export class ParentBridge {
  private readonly _window: Window;
  private readonly _iframe: HTMLIFrameElement;
  private readonly _targetOrigin: string;
  private _docId: string;
  private _pageId: string;
  private _sessionId: string;
  private _generation: number;
  private _revision: number;
  private _onMessage?: (envelope: UIVisualBridgeEnvelope) => void;
  private _onError?: (error: { reason: string; event?: MessageEvent; rawData?: unknown }) => void;
  private _disposed = false;
  private _messageHandler: (event: MessageEvent) => void;

  constructor(options: ParentBridgeOptions) {
    if (options.targetOrigin === '*') {
      throw new Error('Wildcard targetOrigin is strictly forbidden');
    }
    this._window = options.window;
    this._iframe = options.iframe;
    this._targetOrigin = options.targetOrigin;
    this._docId = options.docId;
    this._pageId = options.pageId;
    this._sessionId = options.sessionId;
    this._generation = options.initialGeneration ?? 1;
    this._revision = options.initialRevision ?? 0;
    this._onMessage = options.onMessage;
    this._onError = options.onError;

    this._messageHandler = (event: MessageEvent) => {
      this._handleMessage(event);
    };

    this._window.addEventListener('message', this._messageHandler);
  }

  send(kind: SafeBridgeKind, payload?: unknown, reqId?: string): boolean {
    if (this._disposed) return false;
    const targetWin = this._iframe?.contentWindow;
    if (!targetWin) return false;

    this._revision += 1;
    const env = createBridgeEnvelope({
      docId: this._docId,
      pageId: this._pageId,
      sessionId: this._sessionId,
      generation: this._generation,
      revision: this._revision,
      requestId: reqId ?? `req-${Date.now()}-${Math.floor(Math.random() * 10000)}`,
      kind,
      payload,
    });

    targetWin.postMessage(env, this._targetOrigin);
    return true;
  }

  private _handleMessage(event: MessageEvent): void {
    if (this._disposed) return;
    const targetWin = this._iframe?.contentWindow;
    const validation = validateBridgeEnvelope(event.data, {
      expectedOrigin: this._targetOrigin,
      eventOrigin: event.origin,
      expectedSourceWindow: targetWin,
      eventSourceWindow: event.source,
      currentGeneration: this._generation,
      currentRevision: this._revision,
    });

    if (!validation.valid) {
      this._onError?.({ reason: validation.reason ?? 'validation-failed', event, rawData: event.data });
      return;
    }

    if (validation.envelope) {
      this._revision = Math.max(this._revision, validation.envelope.revision);
      this._onMessage?.(validation.envelope);
    }
  }

  advanceGeneration(newGeneration?: number): void {
    this._generation = newGeneration ?? (this._generation + 1);
  }

  advanceRevision(newRevision: number): void {
    this._revision = Math.max(this._revision, newRevision);
  }

  updateDocument(docId: string, pageId?: string): void {
    this._docId = docId;
    if (pageId) {
      this._pageId = pageId;
    }
  }

  getGeneration(): number {
    return this._generation;
  }

  getRevision(): number {
    return this._revision;
  }

  isDisposed(): boolean {
    return this._disposed;
  }

  dispose(): void {
    if (this._disposed) return;
    this._disposed = true;
    this._window.removeEventListener('message', this._messageHandler);
  }
}

export interface ChildBridgeOptions {
  window: Window;
  parentOrigin: string;
  docId: string;
  pageId: string;
  sessionId: string;
  generation: number;
  revision: number;
  onMessage?: (envelope: UIVisualBridgeEnvelope) => void;
  onError?: (error: { reason: string; event?: MessageEvent; rawData?: unknown }) => void;
}

export class ChildBridge {
  private readonly _window: Window;
  private readonly _parentOrigin: string;
  private _docId: string;
  private _pageId: string;
  private _sessionId: string;
  private _generation: number;
  private _revision: number;
  private _onMessage?: (envelope: UIVisualBridgeEnvelope) => void;
  private _onError?: (error: { reason: string; event?: MessageEvent; rawData?: unknown }) => void;
  private _disposed = false;
  private _messageHandler: (event: MessageEvent) => void;

  constructor(options: ChildBridgeOptions) {
    if (options.parentOrigin === '*') {
      throw new Error('Wildcard parentOrigin is strictly forbidden');
    }
    this._window = options.window;
    this._parentOrigin = options.parentOrigin;
    this._docId = options.docId;
    this._pageId = options.pageId;
    this._sessionId = options.sessionId;
    this._generation = options.generation;
    this._revision = options.revision;
    this._onMessage = options.onMessage;
    this._onError = options.onError;

    this._messageHandler = (event: MessageEvent) => {
      this._handleMessage(event);
    };

    this._window.addEventListener('message', this._messageHandler);
  }

  send(kind: SafeBridgeKind, payload?: unknown, reqId?: string): boolean {
    if (this._disposed) return false;
    const parentWin = (this._window as any).parent;
    if (!parentWin || parentWin === this._window) return false;

    this._revision += 1;
    const env = createBridgeEnvelope({
      docId: this._docId,
      pageId: this._pageId,
      sessionId: this._sessionId,
      generation: this._generation,
      revision: this._revision,
      requestId: reqId ?? `req-${Date.now()}-${Math.floor(Math.random() * 10000)}`,
      kind,
      payload,
    });

    parentWin.postMessage(env, this._parentOrigin);
    return true;
  }

  private _handleMessage(event: MessageEvent): void {
    if (this._disposed) return;
    const parentWin = (this._window as any).parent;
    const validation = validateBridgeEnvelope(event.data, {
      expectedOrigin: this._parentOrigin,
      eventOrigin: event.origin,
      expectedSourceWindow: parentWin,
      eventSourceWindow: event.source,
      currentGeneration: this._generation,
      currentRevision: this._revision,
    });

    if (!validation.valid) {
      this._onError?.({ reason: validation.reason ?? 'validation-failed', event, rawData: event.data });
      return;
    }

    if (validation.envelope) {
      this._revision = Math.max(this._revision, validation.envelope.revision);
      this._onMessage?.(validation.envelope);
    }
  }

  advanceRevision(newRevision: number): void {
    this._revision = Math.max(this._revision, newRevision);
  }

  getGeneration(): number {
    return this._generation;
  }

  getRevision(): number {
    return this._revision;
  }

  isDisposed(): boolean {
    return this._disposed;
  }

  dispose(): void {
    if (this._disposed) return;
    this._disposed = true;
    this._window.removeEventListener('message', this._messageHandler);
  }
}
