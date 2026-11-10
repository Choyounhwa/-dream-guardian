/**
 * AppBattleEventBinder - 전투, 스펠 시전, 보스 피격 애니메이션 및 세션 전환 이벤트 바인더
 *
 * [REFACTOR-SRP-002] (Issue #633)
 * - AppBootstrap에서 거대화된 마나 풀 이펙트, 수호신 스펠 시전, 보스 피격 임팩트,
 *   화면 플래시 연출 및 승리/패배 세션 전환 콜백 분리
 * - bindBattleEvents() 팩토리 및 생명주기(dispose/unbind) 캡슐화
 */

import { DEFAULT_CONFIG } from '../Config.js';
import { HORIZON_RATIO } from '../../../config/grid.config.js';
import { wireAnswerVFX, wireGuardianVFX } from '../../effects/index.js';
import { calcStars } from '../../ui/ResultRenderer.js';
import type { EventBus } from '../EventBus.js';
import type { BattleState } from '../../game/BattleState.js';
import type { BossController } from '../../game/BossController.js';

export const CLIMAX_BARRAGE_DURATION = 0.8;

export interface AppBattleEventBinderOptions {
  eventBus: EventBus | any;
  canvasManager: { virtualWidth: number; virtualHeight: number };
  effectManager: any;
  bossRenderer: { triggerHit(): void } | any;
  skeletonEffect?: { triggerHit(): void; triggerCorrect(combo: number): void } | any;
  sfx?: { play(name: string): void } | any;
  speech?: { speakFeedback(trigger: string): void } | any;
  battle: BattleState | any;
  boss: BossController | any;
  bossHazardController?: { isEnraged: boolean } | any;
  getIsEnraged?: () => boolean;
  dialogueManager?: { getDialogue(options: any): any } | any;
  dialogueOverlayRenderer?: { show(dialogue: any): void } | any;
  sessionLifecycle?: {
    claimResultTransition(): boolean;
    isTestSession?: boolean;
    schedule(cb: () => void, delayMs: number): void;
  } | any;
  sessionContext?: { isTestSession?: boolean } | any;
  getSessionContext?: () => any;
  getCurrentChapter?: () => number;
  starsMap?: Record<number, number>;
  getStarsMap?: () => Record<number, number>;
  onShowResult?: (victory: boolean) => void;
  onCastingFlash?: (intensity: number) => void;
  onClimaxBarrageTimer?: (duration: number) => void;
}

export type BattleEventBindingOptions = AppBattleEventBinderOptions;

export class AppBattleEventBinder {
  private _unsubscribes: Array<() => void> = [];

  constructor(public readonly options: AppBattleEventBinderOptions) {}

  public isBossEnraged(): boolean {
    if (this.options.getIsEnraged) {
      return this.options.getIsEnraged();
    }
    if (this.options.bossHazardController) {
      return Boolean(this.options.bossHazardController.isEnraged);
    }
    if (this.options.boss && this.options.boss.maxHp > 0) {
      return (this.options.boss.hp / this.options.boss.maxHp) <= 0.3;
    }
    return false;
  }

  public bind(): void {
    const {
      eventBus,
      effectManager,
      canvasManager,
      sfx,
      speech,
      skeletonEffect,
      onClimaxBarrageTimer,
    } = this.options;

    // 1. 미니언 군단 탄막 발사 이벤트
    const onTroopBarrage = (info?: { isEnhanced?: boolean }) => {
      onClimaxBarrageTimer?.(CLIMAX_BARRAGE_DURATION);
      this.triggerBossHitImpact(0.35, true, Boolean(info?.isEnhanced));
      sfx?.play?.('correct');
    };
    eventBus.on('troop:barrage', onTroopBarrage);
    this._unsubscribes.push(() => eventBus.off('troop:barrage', onTroopBarrage));

    // 2. 보스 광폭화 시 음성 경고
    const onBossEnrage = () => {
      speech?.speakFeedback?.('boss_enrage');
    };
    eventBus.on('boss:enrage', onBossEnrage);
    this._unsubscribes.push(() => eventBus.off('boss:enrage', onBossEnrage));

    // 3. 정답/오답/타임아웃 VFX 연동
    if (effectManager) {
      const cleanupAnswerVFX = wireAnswerVFX(eventBus, effectManager, {
        getCoordinates: () => ({
          x: canvasManager.virtualWidth * 0.5,
          y: canvasManager.virtualHeight * 0.5,
        }),
      });
      if (typeof cleanupAnswerVFX === 'function') {
        this._unsubscribes.push(cleanupAnswerVFX);
      }
    }

    // 4. 수호신 스펠 캐스트 및 보스 피격 VFX 연동
    if (effectManager) {
      const cleanupGuardianVFX = wireGuardianVFX(eventBus, effectManager, {
        getManaCoordinates: () => ({
          x: canvasManager.virtualWidth * 0.5,
          y: canvasManager.virtualHeight * 0.95,
        }),
        getGuardianCoordinates: () => ({
          x: canvasManager.virtualWidth * 0.5,
          y: canvasManager.virtualHeight * 0.84,
        }),
        getBossCoordinates: () => ({
          x: canvasManager.virtualWidth * 0.5,
          y: canvasManager.virtualHeight * HORIZON_RATIO,
        }),
        getIsEnraged: () => this.isBossEnraged(),
      });
      if (typeof cleanupGuardianVFX === 'function') {
        this._unsubscribes.push(cleanupGuardianVFX);
      }
    }

    // 5. 스켈레톤 시각 이펙트 (정답 펄스 / 피격 플래시)
    const onAnswerCorrect = (info?: { combo?: number }) => {
      skeletonEffect?.triggerCorrect?.(info?.combo ?? 0);
    };
    eventBus.on('answer:correct', onAnswerCorrect);
    this._unsubscribes.push(() => eventBus.off('answer:correct', onAnswerCorrect));

    const onAnswerWrong = () => {
      skeletonEffect?.triggerHit?.();
    };
    eventBus.on('answer:wrong', onAnswerWrong);
    this._unsubscribes.push(() => eventBus.off('answer:wrong', onAnswerWrong));

    const onPlayerHurt = () => {
      skeletonEffect?.triggerHit?.();
    };
    eventBus.on('player:hurt', onPlayerHurt);
    this._unsubscribes.push(() => eventBus.off('player:hurt', onPlayerHurt));
  }

  public handleSpellCast(spellDmg?: number): void {
    const { canvasManager, effectManager, eventBus, boss } = this.options;
    const manaX = canvasManager.virtualWidth * 0.5;
    const manaY = canvasManager.virtualHeight * 0.95;
    effectManager?.playManaFullEffect?.(manaX, manaY);
    eventBus.emit('mana:full', { mana: 100 });

    const damage = spellDmg ?? DEFAULT_CONFIG.battle.spellDamage;
    eventBus.emit('guardian:cast', { damage });

    const bx = canvasManager.virtualWidth * 0.5;
    const by = canvasManager.virtualHeight * HORIZON_RATIO;
    const isEnraged = this.isBossEnraged();
    this.options.bossRenderer?.triggerHit?.();
    effectManager?.playBossHitImpact?.(bx, by, isEnraged);
    eventBus.emit('boss:hit', { bossHp: boss.hp });

    effectManager?.playPreset?.('cast', bx, by);
    this.options.onCastingFlash?.(0.6);
    console.log(`[DG] 캐스팅! 보스 HP: ${boss.hp}/${boss.maxHp}`);
  }

  public triggerBossHitImpact(
    byRatio: number = HORIZON_RATIO,
    playPresetEffect: boolean = false,
    isEnhanced: boolean = false,
    customPreset?: string,
  ): void {
    const { canvasManager, effectManager, eventBus, boss, bossRenderer } = this.options;
    const isEnraged = this.isBossEnraged();
    const bx = canvasManager.virtualWidth * 0.5;
    const by = canvasManager.virtualHeight * byRatio;

    bossRenderer?.triggerHit?.();
    effectManager?.playBossHitImpact?.(bx, by, isEnraged);
    eventBus.emit('boss:hit', { bossHp: boss.hp });

    if (playPresetEffect || customPreset) {
      const preset = customPreset ?? (isEnhanced ? 'cast' : 'correct');
      effectManager?.playPreset?.(preset, bx, by);
    }
  }

  public handleBossDefeated(_stats?: any, immediate: boolean = false): void {
    const {
      dialogueManager,
      dialogueOverlayRenderer,
      sessionLifecycle,
      getCurrentChapter,
      battle,
      onShowResult,
    } = this.options;

    const currentChapter = getCurrentChapter ? getCurrentChapter() : 1;
    const sessionCtx = this.options.getSessionContext ? this.options.getSessionContext() : this.options.sessionContext;
    const currentStarsMap = this.options.getStarsMap ? this.options.getStarsMap() : this.options.starsMap;

    const purifyDialogue = dialogueManager?.getDialogue?.({
      trigger: 'boss_purified',
      chapter: currentChapter,
      force: true,
    });
    if (purifyDialogue) {
      dialogueOverlayRenderer?.show?.(purifyDialogue);
    }

    if (sessionLifecycle?.claimResultTransition?.()) {
      if (!sessionLifecycle.isTestSession && !sessionCtx?.isTestSession && currentStarsMap) {
        const stars = calcStars(battle.correctCount, battle.totalQuestions, 60);
        currentStarsMap[currentChapter] = Math.max(currentStarsMap[currentChapter] ?? 0, stars);
      }
      if (immediate) {
        onShowResult?.(true);
      } else {
        sessionLifecycle.schedule?.(() => {
          onShowResult?.(true);
        }, 600);
      }
    }
  }

  public handlePlayerDefeated(_stats?: any, immediate: boolean = false): void {
    const { sessionLifecycle, onShowResult } = this.options;
    if (sessionLifecycle?.claimResultTransition?.()) {
      if (immediate) {
        onShowResult?.(false);
      } else {
        sessionLifecycle.schedule?.(() => {
          onShowResult?.(false);
        }, 600);
      }
    }
  }

  public handlePlayerDamaged(appliedDamage: number = 0): void {
    const { sfx, skeletonEffect, battle } = this.options;
    if (appliedDamage > 0 || appliedDamage === undefined) {
      sfx?.play?.('player_hurt');
      skeletonEffect?.triggerHit?.();
    }
    if (battle && !battle.isAlive) {
      this.handlePlayerDefeated();
    }
  }

  public handleHazardResolved(result: {
    evaded: boolean;
    attackType: string;
    damage: number;
    remainingMinions: number;
  }): void {
    const { sfx } = this.options;
    if (result.evaded) {
      console.log(`[DG] 보스 공격 회피 성공! (${result.attackType})`);
      sfx?.play?.('posture_complete');
    } else {
      console.log(`[DG] 보스 공격 피격! (${result.attackType}) 피해: ${result.damage}, 잔여 미니언: ${result.remainingMinions}`);
      sfx?.play?.('wrong');
    }
  }

  public dispose(): void {
    for (const unsubscribe of this._unsubscribes) {
      try {
        unsubscribe();
      } catch (err) {
        console.warn('[DG] AppBattleEventBinder unsubscribe error:', err);
      }
    }
    this._unsubscribes = [];
  }

  public unbind(): void {
    this.dispose();
  }
}

export function bindBattleEvents(options: AppBattleEventBinderOptions): AppBattleEventBinder {
  const binder = new AppBattleEventBinder(options);
  binder.bind();
  return binder;
}
