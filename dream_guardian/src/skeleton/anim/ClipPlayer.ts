/**
 * ClipPlayer - 애니메이션 키프레임 클립 재생기
 * Issue #687 / FEAT-ANIM-001
 */

import type {
  AnimationClip,
  Keyframe,
  KeyframeEase,
} from '../../types/animation-clip.js';

export interface ClipPlayerPlayOptions {
  loop?: boolean;
  weight?: number;
  fadeInDuration?: number;
  fadeOutDuration?: number;
  boneMask?: Set<string> | string[];
}

function applyEasing(t: number, ease?: KeyframeEase): number {
  switch (ease) {
    case 'easeIn':
      return t * t;
    case 'easeOut':
      return t * (2 - t);
    case 'easeInOut':
      return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
    case 'linear':
    default:
      return t;
  }
}

export class ClipPlayer {
  private _clip: AnimationClip | null = null;
  private _currentTime: number = 0;
  private _isPlaying: boolean = false;
  private _loop: boolean = false;
  private _targetWeight: number = 1.0;
  private _currentWeight: number = 0;
  private _fadeInDuration: number = 0;
  private _fadeOutDuration: number = 0;
  private _defaultFadeOutDuration: number = 0;
  private _isFadingIn: boolean = false;
  private _isFadingOut: boolean = false;
  private _fadeElapsed: number = 0;
  private _fadeStartWeight: number = 1.0;
  private _boneMask?: Set<string>;

  get isPlaying(): boolean {
    return this._isPlaying;
  }

  get currentTime(): number {
    return this._currentTime;
  }

  get currentClip(): AnimationClip | null {
    return this._clip;
  }

  getBoneMask(): Set<string> | undefined {
    return this._boneMask;
  }

  play(clip: AnimationClip, options?: ClipPlayerPlayOptions): void {
    this._clip = clip;
    this._currentTime = 0;
    this._loop = options?.loop ?? clip.loop ?? false;
    this._targetWeight = options?.weight ?? 1.0;
    this._fadeInDuration = Math.max(0, options?.fadeInDuration ?? 0);
    this._defaultFadeOutDuration = Math.max(0, options?.fadeOutDuration ?? 0);
    this._fadeOutDuration = 0;
    this._fadeElapsed = 0;

    if (options?.boneMask) {
      this._boneMask =
        options.boneMask instanceof Set
          ? new Set(options.boneMask)
          : new Set(options.boneMask);
    } else {
      this._boneMask = undefined;
    }

    if (this._fadeInDuration > 0) {
      this._isFadingIn = true;
      this._isFadingOut = false;
      this._currentWeight = 0;
    } else {
      this._isFadingIn = false;
      this._isFadingOut = false;
      this._currentWeight = this._targetWeight;
    }

    this._isPlaying = true;
  }

  update(dt: number): void {
    if (!this._isPlaying || dt <= 0 || !this._clip) {
      return;
    }

    // Fading process
    if (this._isFadingIn) {
      this._fadeElapsed += dt;
      if (this._fadeElapsed >= this._fadeInDuration) {
        this._isFadingIn = false;
        this._currentWeight = this._targetWeight;
      } else {
        this._currentWeight =
          (this._fadeElapsed / this._fadeInDuration) * this._targetWeight;
      }
    } else if (this._isFadingOut) {
      this._fadeElapsed += dt;
      if (this._fadeElapsed >= this._fadeOutDuration) {
        this._isFadingOut = false;
        this._currentWeight = 0;
        this._isPlaying = false;
        return;
      } else {
        this._currentWeight =
          this._fadeStartWeight * (1 - this._fadeElapsed / this._fadeOutDuration);
      }
    }

    // Timeline progress
    this._currentTime += dt;

    if (this._clip.duration > 0) {
      if (this._loop) {
        this._currentTime = this._currentTime % this._clip.duration;
      } else if (this._currentTime >= this._clip.duration) {
        this._currentTime = this._clip.duration;
        if (!this._isFadingOut) {
          if (this._defaultFadeOutDuration > 0) {
            this.stop(this._defaultFadeOutDuration);
          } else {
            this._isPlaying = false;
          }
        }
      }
    }
  }

  stop(fadeOutDuration?: number): void {
    if (!this._isPlaying) {
      return;
    }

    const fadeDuration =
      fadeOutDuration !== undefined
        ? Math.max(0, fadeOutDuration)
        : this._defaultFadeOutDuration;

    if (fadeDuration > 0) {
      this._isFadingIn = false;
      this._isFadingOut = true;
      this._fadeElapsed = 0;
      this._fadeStartWeight = this._currentWeight;
      this._fadeOutDuration = fadeDuration;
    } else {
      this._isFadingIn = false;
      this._isFadingOut = false;
      this._currentWeight = 0;
      this._isPlaying = false;
    }
  }

  getCurrentWeight(): number {
    return this._isPlaying ? this._currentWeight : 0;
  }

  getCurrentAngles(): Record<string, number> {
    if (!this._clip) {
      return {};
    }

    const result: Record<string, number> = {};
    for (const [boneId, keyframes] of Object.entries(this._clip.tracks)) {
      if (this._boneMask && !this._boneMask.has(boneId)) {
        continue;
      }
      if (!keyframes || keyframes.length === 0) {
        continue;
      }

      result[boneId] = this._interpolateTrack(keyframes, this._currentTime);
    }

    return result;
  }

  getActiveSkinSwaps(): Record<string, string> {
    const result: Record<string, string> = {};
    if (!this._clip?.skinSwaps || this._clip.skinSwaps.length === 0) {
      return result;
    }

    const sorted = [...this._clip.skinSwaps].sort((a, b) => a.t - b.t);
    for (const swap of sorted) {
      if (swap.t <= this._currentTime) {
        if (this._boneMask && !this._boneMask.has(swap.boneId)) {
          continue;
        }
        result[swap.boneId] = swap.partFile;
      }
    }

    return result;
  }

  private _interpolateTrack(keyframes: Keyframe[], t: number): number {
    if (keyframes.length === 1) {
      return keyframes[0].angle;
    }

    if (t <= keyframes[0].t) {
      return keyframes[0].angle;
    }
    const last = keyframes[keyframes.length - 1];
    if (t >= last.t) {
      return last.angle;
    }

    for (let i = 0; i < keyframes.length - 1; i++) {
      const k0 = keyframes[i];
      const k1 = keyframes[i + 1];
      if (t >= k0.t && t <= k1.t) {
        const segDuration = k1.t - k0.t;
        if (segDuration <= 0) {
          return k1.angle;
        }
        const alpha = (t - k0.t) / segDuration;
        const eased = applyEasing(alpha, k0.ease);
        return k0.angle + (k1.angle - k0.angle) * eased;
      }
    }

    return last.angle;
  }
}
