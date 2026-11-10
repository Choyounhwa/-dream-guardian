/**
 * CharacterActionController - 이벤트 기반 캐릭터 행동 트리거
 *
 * Issue #688 / FEAT-ANIM-002:
 * - EventBus 이벤트(정답, 오답, 스펠 시전, 피격, 승리 등) 구독 및 클립 연계
 * - 우선순위(Priority) 기반 선점(Preemption): 재생 중인 액션보다 높거나 같을 때 선점
 * - 쿨다운(Cooldown) 타이머 관리 및 스팸 방지
 * - 복수 클립(string[]) 무작위/인덱스 선택 및 본 마스크/페이드 옵션 전달
 * - 메모리 누수 방지를 위한 안전한 리스너 해제(dispose)
 */

import type { EventBus } from '../../core/EventBus.js';
import type { AnimationClip } from '../../types/animation-clip.js';
import type { ClipPlayer } from './ClipPlayer.js';

export interface ActionTriggerRule {
  clipId: string | string[];
  priority: number;
  cooldown?: number;
  boneMask?: string[];
  fadeInDuration?: number;
  fadeOutDuration?: number;
  weight?: number;
  loop?: boolean;
}

export type EventActionMap = Record<string, string | string[] | ActionTriggerRule>;

export interface ActionTriggerOptions {
  clipIndex?: number;
}

/** 기본 토끼 캐릭터 행동 맵 */
export const RABBIT_ACTION_MAP: EventActionMap = {
  'answer:correct': { clipId: 'rabbit_ear_wiggle', priority: 1, cooldown: 1.0 },
  'answer:wrong': { clipId: 'rabbit_ear_droop', priority: 1, cooldown: 1.0 },
  'guardian:cast': { clipId: 'rabbit_spin', priority: 2, cooldown: 2.0 },
  'player:hurt': { clipId: 'rabbit_flinch', priority: 3, cooldown: 0.5 },
  'boss:defeated': { clipId: 'rabbit_victory_hop', priority: 4 },
};

/** 기본 곰 캐릭터 행동 맵 */
export const BEAR_ACTION_MAP: EventActionMap = {
  'answer:correct': { clipId: 'bear_belly_drum', priority: 1, cooldown: 1.0 },
  'answer:wrong': { clipId: 'bear_head_scratch', priority: 1, cooldown: 1.0 },
  'guardian:cast': { clipId: 'bear_roar', priority: 2, cooldown: 2.0 },
  'player:hurt': { clipId: 'bear_shield_tuck', priority: 3, cooldown: 0.5 },
  'boss:defeated': { clipId: 'bear_victory_dance', priority: 4 },
};

function normalizeRule(rule: string | string[] | ActionTriggerRule): ActionTriggerRule {
  if (typeof rule === 'string' || Array.isArray(rule)) {
    return { clipId: rule, priority: 0 };
  }
  return { ...rule };
}

export class CharacterActionController {
  private _eventBus: EventBus;
  private _clipPlayer: ClipPlayer;
  private _clips = new Map<string, AnimationClip>();
  private _rules = new Map<string, ActionTriggerRule>();
  private _listeners = new Map<string, (payload?: unknown) => void>();
  private _cooldowns = new Map<string, number>();
  private _activePriority = -Infinity;
  private _currentAction: string | null = null;
  private _isDisposed = false;

  constructor(
    eventBus: EventBus,
    clipPlayer: ClipPlayer,
    clips: Map<string, AnimationClip> | Record<string, AnimationClip>,
    actionMap?: EventActionMap,
  ) {
    this._eventBus = eventBus;
    this._clipPlayer = clipPlayer;
    this.setClips(clips);
    if (actionMap) {
      this.setActionMap(actionMap);
    }
  }

  get clipPlayer(): ClipPlayer {
    return this._clipPlayer;
  }

  get currentPriority(): number {
    return this._activePriority;
  }

  get currentAction(): string | null {
    return this._currentAction;
  }

  get isDisposed(): boolean {
    return this._isDisposed;
  }

  getCooldown(eventOrAction: string): number {
    return this._cooldowns.get(eventOrAction) ?? 0;
  }

  setCooldown(eventOrAction: string, duration: number): void {
    if (duration <= 0) {
      this._cooldowns.delete(eventOrAction);
    } else {
      this._cooldowns.set(eventOrAction, duration);
    }
  }

  hasRule(event: string): boolean {
    return this._rules.has(event);
  }

  getRule(event: string): ActionTriggerRule | undefined {
    return this._rules.get(event);
  }

  registerRule(event: string, rule: string | string[] | ActionTriggerRule): void {
    if (this._isDisposed) return;

    const normalized = normalizeRule(rule);
    this._rules.set(event, normalized);

    // 기존 등록된 리스너 해제 후 재등록
    if (this._listeners.has(event)) {
      this._eventBus.off(event as any, this._listeners.get(event)!);
    }

    const handler = () => {
      this.trigger(event);
    };

    this._listeners.set(event, handler);
    this._eventBus.on(event as any, handler);
  }

  removeRule(event: string): void {
    if (this._listeners.has(event)) {
      this._eventBus.off(event as any, this._listeners.get(event)!);
      this._listeners.delete(event);
    }
    this._rules.delete(event);
    this._cooldowns.delete(event);
  }

  setActionMap(actionMap: EventActionMap): void {
    // 이전 리스너 전체 해제
    for (const [event, handler] of this._listeners.entries()) {
      this._eventBus.off(event as any, handler);
    }
    this._listeners.clear();
    this._rules.clear();
    this._cooldowns.clear();

    for (const [event, rule] of Object.entries(actionMap)) {
      this.registerRule(event, rule);
    }
  }

  getClip(clipId: string): AnimationClip | undefined {
    return this._clips.get(clipId);
  }

  getClips(): Map<string, AnimationClip> {
    return this._clips;
  }

  setClips(clips: Map<string, AnimationClip> | Record<string, AnimationClip>): void {
    this._clips.clear();
    if (clips instanceof Map) {
      for (const [id, clip] of clips.entries()) {
        this._clips.set(id, clip);
      }
    } else {
      for (const [id, clip] of Object.entries(clips)) {
        this._clips.set(id, clip);
      }
    }
  }

  addClip(clip: AnimationClip): void {
    this._clips.set(clip.id, clip);
  }

  trigger(actionNameOrEvent: string, options?: ActionTriggerOptions): boolean {
    if (this._isDisposed) return false;

    // 1. 등록된 액션 규칙 검색
    if (this._rules.has(actionNameOrEvent)) {
      // 쿨다운 검사
      const cd = this._cooldowns.get(actionNameOrEvent) ?? 0;
      if (cd > 0) {
        return false;
      }

      const rule = this._rules.get(actionNameOrEvent)!;

      // 우선순위 검사 (현재 재생 중인 클립이 있을 때 낮은 우선순위는 선점 불가)
      if (this._clipPlayer.isPlaying && rule.priority < this._activePriority) {
        return false;
      }

      // 대상 클립 ID 선정 (배열인 경우 단일 선택)
      let selectedClipId: string;
      if (Array.isArray(rule.clipId)) {
        if (rule.clipId.length === 0) return false;
        const idx =
          options?.clipIndex !== undefined
            ? Math.max(0, Math.min(options.clipIndex, rule.clipId.length - 1))
            : Math.floor(Math.random() * rule.clipId.length);
        selectedClipId = rule.clipId[idx];
      } else {
        selectedClipId = rule.clipId;
      }

      const clip = this._clips.get(selectedClipId);
      if (!clip) {
        return false;
      }

      this._clipPlayer.play(clip, {
        boneMask: rule.boneMask,
        fadeInDuration: rule.fadeInDuration,
        fadeOutDuration: rule.fadeOutDuration,
        weight: rule.weight,
        loop: rule.loop,
      });

      this._activePriority = rule.priority;
      this._currentAction = actionNameOrEvent;

      if (rule.cooldown && rule.cooldown > 0) {
        this._cooldowns.set(actionNameOrEvent, rule.cooldown);
      }

      return true;
    }

    // 2. 규칙이 없더라도 클립 목록에 직접 존재하는 경우 기본 priority 0으로 재생
    if (this._clips.has(actionNameOrEvent)) {
      if (this._clipPlayer.isPlaying && 0 < this._activePriority) {
        return false;
      }

      const clip = this._clips.get(actionNameOrEvent)!;
      this._clipPlayer.play(clip);
      this._activePriority = 0;
      this._currentAction = actionNameOrEvent;
      return true;
    }

    return false;
  }

  update(dt: number, updatePlayer = true): void {
    if (this._isDisposed) return;

    // 쿨다운 타이머 감소
    for (const [key, cd] of Array.from(this._cooldowns.entries())) {
      const nextCd = cd - dt;
      if (nextCd <= 0) {
        this._cooldowns.delete(key);
      } else {
        this._cooldowns.set(key, nextCd);
      }
    }

    // 클립 플레이어 업데이트
    if (updatePlayer) {
      this._clipPlayer.update(dt);
    }

    // 클립 재생 종료 시 우선순위 및 현재 액션 초기화
    if (!this._clipPlayer.isPlaying) {
      this._activePriority = -Infinity;
      this._currentAction = null;
    }
  }

  stop(fadeOutDuration?: number): void {
    this._clipPlayer.stop(fadeOutDuration);
    this._activePriority = -Infinity;
    this._currentAction = null;
  }

  dispose(): void {
    if (this._isDisposed) return;

    for (const [event, handler] of this._listeners.entries()) {
      this._eventBus.off(event as any, handler);
    }

    this._listeners.clear();
    this._rules.clear();
    this._cooldowns.clear();
    this._clips.clear();
    this._activePriority = -Infinity;
    this._currentAction = null;
    this._isDisposed = true;
  }
}
