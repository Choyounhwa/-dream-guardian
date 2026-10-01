import {
  DEFAULT_PHASE_A_HAZARD_CONFIG,
  PHASE_A_ACTIVE_HAZARD_PATTERNS,
  type PhaseAHazardConfig,
  type PhaseAHazardPattern,
} from '../../config/phase-a-hazard.config.js';
import {
  DEFAULT_TIMING_LENIENCY_CONFIG,
  type TimingLeniencyConfig,
} from '../../config/judgment.config.js';
import { InputBuffer } from '../input/InputBuffer.js';
import type { MotionIntentBus } from '../motion/MotionIntentBus.js';
import type { UnsubscribeFn } from '../types/motion-intent.js';


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
  viaGrace?: boolean;
}

export interface PhaseAHazardStartOptions {
  roundIndex?: number;
  pattern?: PhaseAHazardPattern;
  attackId?: string;
}

export interface PhaseAHazardControllerOptions extends Partial<PhaseAHazardConfig> {
  timingLeniency?: Partial<TimingLeniencyConfig>;
  onBeatResolved?: (result: PhaseAHazardBeatResult) => void;
  onHazardResolved?: (result: PhaseAHazardBeatResult) => void;
  intentBus?: MotionIntentBus;
}

export class PhaseAHazardController {
  private readonly _config: PhaseAHazardConfig;
  private readonly _leniencyConfig: TimingLeniencyConfig;
  private readonly _inputBuffer: InputBuffer<PhaseAHazardPattern>;
  private readonly _onBeatResolved?: (result: PhaseAHazardBeatResult) => void;
  private readonly _onHazardResolved?: (result: PhaseAHazardBeatResult) => void;
  private _intentBus: MotionIntentBus | null = null;
  private _intentBusUnsub: UnsubscribeFn | null = null;
  private _active = false;
  private _elapsed = 0;
  private _activePattern: PhaseAHazardPattern | null = null;
  private _attackId: string | null = null;
  private _evaded = false;
  private _viaGrace = false;
  private _isResolved = false;
  private _performedAction: PhaseAHazardPattern | null = null;
  private _beatIndex = 0;

  constructor(
    options?: PhaseAHazardControllerOptions,
    legacyOnResolved?: (result: PhaseAHazardBeatResult) => void
  ) {
    this._config = {
      ...DEFAULT_PHASE_A_HAZARD_CONFIG,
      ...options,
      pattern: options?.pattern ?? DEFAULT_PHASE_A_HAZARD_CONFIG.pattern,
    };
    this._leniencyConfig = {
      ...DEFAULT_TIMING_LENIENCY_CONFIG,
      ...options?.timingLeniency,
    };
    this._inputBuffer = new InputBuffer<PhaseAHazardPattern>(this._leniencyConfig.preBufferWindow);
    this._onBeatResolved = options?.onBeatResolved ?? legacyOnResolved;
    this._onHazardResolved = options?.onHazardResolved;
    if (options?.intentBus) {
      this.attachIntentBus(options.intentBus);
    }
  }

  /**
   * MotionIntentBus 연결 (Issue #252 어댑터 패턴)
   */
  attachIntentBus(bus: MotionIntentBus): UnsubscribeFn {
    if (this._intentBusUnsub) {
      this._intentBusUnsub();
      this._intentBusUnsub = null;
    }
    this._intentBus = bus;
    const unsub = bus.subscribe((intent) => {
      if (!this._active || this._isResolved) return;
      if (intent.type === 'jump') {
        this.recordAction('jump');
      } else if (intent.type === 'stepLeft') {
        this.recordAction('left_step');
      } else if (intent.type === 'stepRight') {
        this.recordAction('right_step');
      }
    });
    this._intentBusUnsub = () => {
      unsub();
      if (this._intentBus === bus) {
        this._intentBus = null;
      }
      this._intentBusUnsub = null;
    };
    return this._intentBusUnsub;
  }

  get isActive(): boolean {
    return this._active;
  }

  get viaGrace(): boolean {
    return this._viaGrace;
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
    this._viaGrace = false;
    this._isResolved = false;
    this._beatIndex = 0;
    this._performedAction = null;
    this._inputBuffer.clear();

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
    this._viaGrace = false;
    this._performedAction = null;
    this._activePattern = null;
    this._attackId = null;
    this._inputBuffer.clear();
  }

  recordAction(action: PhaseAHazardPattern): void {
    if (!this._active || this._isResolved) return;
    this._performedAction = action;

    const warningDuration = this._config.warningDuration ?? 2.6;
    const inputWindowEnd = this._config.inputWindowEnd ?? 3.4;
    const leniency = this._leniencyConfig;

    // elapsed가 0인 경우(테스트/직접 호출): 하위 호환 즉시 반영
    if (this._elapsed === 0) {
      if (action === this._activePattern) {
        this._evaded = true;
      }
      return;
    }

    // 1) 창 열리기 전 (선행 버퍼 윈도우)
    if (this._elapsed < warningDuration - 1e-9) {
      if (
        leniency.enablePreBuffer &&
        warningDuration - this._elapsed <= leniency.preBufferWindow + 1e-9
      ) {
        this._inputBuffer.push(action, this._elapsed);
      }
      return;
    }

    // 2) 정규 입력창 (warningDuration ~ inputWindowEnd)
    if (this._elapsed <= inputWindowEnd + 1e-9) {
      if (action === this._activePattern) {
        this._evaded = true;
      }
      return;
    }

    // 3) 후행 유예(Coyote Time, inputWindowEnd ~ inputWindowEnd + postGraceWindow)
    if (
      leniency.enablePostGrace &&
      this._elapsed <= inputWindowEnd + leniency.postGraceWindow + 1e-9
    ) {
      if (action === this._activePattern) {
        this._evaded = true;
        this._viaGrace = true;
      }
    }
  }

  update(dt: number): void {
    if (!this._active) return;
    const step = Math.max(0, dt);
    this._elapsed += step;

    const warningDuration = this._config.warningDuration ?? 2.6;
    // 창 개시 시점에 버퍼에 저장된 일치 동작 소비
    if (
      !this._evaded &&
      this._elapsed >= warningDuration - 1e-9 &&
      this._leniencyConfig.enablePreBuffer
    ) {
      const consumed = this._inputBuffer.consume(
        (act) => act === this._activePattern,
        this._elapsed,
        this._leniencyConfig.preBufferWindow
      );
      if (consumed) {
        this._evaded = true;
      }
    }

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
      viaGrace: this._viaGrace ? true : undefined,
    };

    this._onBeatResolved?.(result);
    this._onHazardResolved?.(result);
  }
}
