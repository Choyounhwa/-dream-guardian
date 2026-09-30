import {
  DEFAULT_PHASE_A_HAZARD_CONFIG,
  PHASE_A_ACTIVE_HAZARD_PATTERNS,
  type PhaseAHazardConfig,
  type PhaseAHazardPattern,
} from '../../config/phase-a-hazard.config.js';

export { DEFAULT_PHASE_A_HAZARD_PATTERN } from '../../config/phase-a-hazard.config.js';
export { DEFAULT_PHASE_A_HAZARD_CONFIG } from '../../config/phase-a-hazard.config.js';
export { PHASE_A_ACTIVE_HAZARD_PATTERNS } from '../../config/phase-a-hazard.config.js';
export type { PhaseAHazardPattern } from '../../config/phase-a-hazard.config.js';

export interface PhaseAHazardBeatResult {
  beatIndex: number;
  attackId?: string;
  pattern: PhaseAHazardPattern;
  evaded: boolean;
  damage: number;
}

export interface PhaseAHazardStartOptions {
  roundIndex?: number;
  pattern?: PhaseAHazardPattern;
  attackId?: string;
}

export interface PhaseAHazardControllerOptions extends Partial<PhaseAHazardConfig> {
  onBeatResolved?: (result: PhaseAHazardBeatResult) => void;
  onHazardResolved?: (result: PhaseAHazardBeatResult) => void;
}

export class PhaseAHazardController {
  private readonly _config: PhaseAHazardConfig;
  private readonly _onBeatResolved?: (result: PhaseAHazardBeatResult) => void;
  private readonly _onHazardResolved?: (result: PhaseAHazardBeatResult) => void;
  private _active = false;
  private _elapsed = 0;
  private _activePattern: PhaseAHazardPattern | null = null;
  private _attackId: string | null = null;
  private _evaded = false;
  private _isResolved = false;
  private _performedAction: PhaseAHazardPattern | null = null;
  private _beatIndex = 0;

  constructor(options?: PhaseAHazardControllerOptions) {
    this._config = {
      ...DEFAULT_PHASE_A_HAZARD_CONFIG,
      ...options,
      pattern: options?.pattern ?? DEFAULT_PHASE_A_HAZARD_CONFIG.pattern,
    };
    this._onBeatResolved = options?.onBeatResolved;
    this._onHazardResolved = options?.onHazardResolved;
  }

  get isActive(): boolean {
    return this._active;
  }

  get beatIndex(): number {
    return this._beatIndex;
  }

  get beatProgress(): number {
    if (!this._active) return 0;
    const judgmentTime = this._config.judgmentTime ?? 3.5;
    return Math.max(0, Math.min(1.0, this._elapsed / judgmentTime));
  }

  get activePattern(): PhaseAHazardPattern | null {
    return this._active ? this._activePattern : null;
  }

  get isEvaded(): boolean {
    return this._evaded;
  }

  get performedAction(): PhaseAHazardPattern | null {
    return this._performedAction;
  }

  get isResolved(): boolean {
    return this._isResolved;
  }

  get elapsed(): number {
    return this._elapsed;
  }

  start(options?: PhaseAHazardStartOptions | PhaseAHazardPattern): void {
    this._active = true;
    this._elapsed = 0;
    this._evaded = false;
    this._isResolved = false;
    this._beatIndex = 0;
    this._performedAction = null;

    if (typeof options === 'string') {
      this._activePattern = options;
      this._attackId = `hazard_${Date.now()}`;
    } else if (options && typeof options === 'object') {
      if (options.pattern) {
        this._activePattern = options.pattern;
      } else if (options.roundIndex !== undefined) {
        const pool = this._config.pattern.length > 0 ? this._config.pattern : PHASE_A_ACTIVE_HAZARD_PATTERNS;
        const idx = Math.abs(options.roundIndex - 1) % pool.length;
        this._activePattern = pool[idx];
      } else {
        this._activePattern = this._config.pattern[0] ?? 'jump';
      }
      this._attackId = options.attackId ?? (options.roundIndex ? `hazard_r${options.roundIndex}` : `hazard_${Date.now()}`);
    } else {
      this._activePattern = this._config.pattern[0] ?? 'jump';
      this._attackId = `hazard_${Date.now()}`;
    }
  }

  stop(): void {
    this._active = false;
    this._elapsed = 0;
    this._isResolved = false;
    this._evaded = false;
    this._performedAction = null;
    this._activePattern = null;
    this._attackId = null;
  }

  recordAction(action: PhaseAHazardPattern): void {
    if (!this._active || this._isResolved) return;
    this._performedAction = action;

    // 틀린 선행 입력은 기회를 소모하지 않고 올바른 회피 동작 수행 시 성공 잠금
    if (action === this._activePattern) {
      this._evaded = true;
    }
  }

  update(dt: number): void {
    if (!this._active) return;
    const step = Math.max(0, dt);
    this._elapsed += step;

    const judgmentTime = this._config.judgmentTime ?? 3.5;
    if (!this._isResolved && this._elapsed >= judgmentTime - 1e-9) {
      this._resolveAttack();
    }

    const totalDuration = this._config.totalDuration ?? 4.0;
    if (this._elapsed >= totalDuration - 1e-9) {
      this.stop();
    }
  }

  private _resolveAttack(): void {
    if (this._isResolved || !this._activePattern) return;
    this._isResolved = true;
    this._beatIndex = 1;

    const damage = this._evaded ? 0 : this._config.damagePerMiss;
    const result: PhaseAHazardBeatResult = {
      beatIndex: 0,
      attackId: this._attackId ?? 'hazard_attack',
      pattern: this._activePattern,
      evaded: this._evaded,
      damage,
    };

    this._onBeatResolved?.(result);
    this._onHazardResolved?.(result);
  }
}
