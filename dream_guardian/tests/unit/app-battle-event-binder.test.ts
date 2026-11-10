import { describe, it, expect, vi, beforeEach } from 'vitest';
import { EventBus } from '../../src/core/EventBus.js';
import { HORIZON_RATIO } from '../../config/grid.config.js';
import {
  bindBattleEvents,
  AppBattleEventBinder,
  type AppBattleEventBinderOptions,
} from '../../src/core/bootstrap/AppBattleEventBinder.js';

describe('AppBattleEventBinder (Issue #633)', () => {
  let eventBus: EventBus;
  let effectManager: any;
  let bossRenderer: any;
  let skeletonEffect: any;
  let sfx: any;
  let speech: any;
  let battle: any;
  let boss: any;
  let bossHazardController: any;
  let dialogueManager: any;
  let dialogueOverlayRenderer: any;
  let sessionLifecycle: any;
  let options: AppBattleEventBinderOptions;
  let onCastingFlash: any;
  let onClimaxBarrageTimer: any;
  let onShowResult: any;

  beforeEach(() => {
    eventBus = new EventBus();
    effectManager = {
      playManaFullEffect: vi.fn(),
      playBossHitImpact: vi.fn(),
      playPreset: vi.fn(),
      playAnswerEffect: vi.fn(),
      playGuardianCastSequence: vi.fn(),
    };
    bossRenderer = {
      triggerHit: vi.fn(),
    };
    skeletonEffect = {
      triggerHit: vi.fn(),
      triggerCorrect: vi.fn(),
    };
    sfx = {
      play: vi.fn(),
    };
    speech = {
      speakFeedback: vi.fn(),
    };
    battle = {
      hp: 80,
      mana: 100,
      combo: 3,
      correctCount: 8,
      totalQuestions: 10,
      isAlive: true,
      applyHazardDamage: vi.fn((dmg: number) => {
        battle.hp -= dmg;
        if (battle.hp <= 0) {
          battle.isAlive = false;
        }
      }),
    };
    boss = {
      hp: 15,
      maxHp: 20,
      takeDamage: vi.fn((dmg: number) => {
        boss.hp = Math.max(0, boss.hp - dmg);
        return boss.hp <= 0;
      }),
    };
    bossHazardController = {
      isEnraged: false,
    };
    dialogueManager = {
      getDialogue: vi.fn().mockReturnValue({ text: 'Purified!' }),
    };
    dialogueOverlayRenderer = {
      show: vi.fn(),
    };
    sessionLifecycle = {
      claimResultTransition: vi.fn().mockReturnValue(true),
      isTestSession: false,
      schedule: vi.fn((cb: () => void) => cb()),
    };
    onCastingFlash = vi.fn();
    onClimaxBarrageTimer = vi.fn();
    onShowResult = vi.fn();

    options = {
      eventBus,
      canvasManager: { virtualWidth: 1000, virtualHeight: 600 },
      effectManager,
      bossRenderer,
      skeletonEffect,
      sfx,
      speech,
      battle,
      boss,
      bossHazardController,
      dialogueManager,
      dialogueOverlayRenderer,
      sessionLifecycle,
      getCurrentChapter: () => 1,
      starsMap: {},
      onShowResult,
      onCastingFlash,
      onClimaxBarrageTimer,
    };
  });

  describe('bindBattleEvents factory and registration', () => {
    it('creates an AppBattleEventBinder instance and binds event listeners', () => {
      const binder = bindBattleEvents(options);
      expect(binder).toBeInstanceOf(AppBattleEventBinder);
    });

    it('handles troop:barrage event by triggering impact, preset, sfx, and timer', () => {
      bindBattleEvents(options);

      const bossHitListener = vi.fn();
      eventBus.on('boss:hit', bossHitListener);

      eventBus.emit('troop:barrage', { damage: 10, minionCount: 5, gaugeMultiplier: 1, isEnhanced: true });

      expect(onClimaxBarrageTimer).toHaveBeenCalledWith(0.8);
      expect(bossRenderer.triggerHit).toHaveBeenCalled();
      expect(effectManager.playBossHitImpact).toHaveBeenCalledWith(500, 210, false);
      expect(bossHitListener).toHaveBeenCalledWith({ bossHp: 15 });
      expect(effectManager.playPreset).toHaveBeenCalledWith('cast', 500, 210);
      expect(sfx.play).toHaveBeenCalledWith('correct');
    });

    it('handles boss:enrage event with speech warning', () => {
      bindBattleEvents(options);
      eventBus.emit('boss:enrage', { hp: 5, maxHp: 20 });

      expect(speech.speakFeedback).toHaveBeenCalledWith('boss_enrage');
    });

    it('handles answer:correct and player:hurt events for skeleton effects', () => {
      bindBattleEvents(options);

      eventBus.emit('answer:correct', { mana: 25, combo: 4 });
      expect(skeletonEffect.triggerCorrect).toHaveBeenCalledWith(4);

      eventBus.emit('answer:wrong', { hp: 80 });
      expect(skeletonEffect.triggerHit).toHaveBeenCalledTimes(1);

      eventBus.emit('player:hurt', { hp: 70 });
      expect(skeletonEffect.triggerHit).toHaveBeenCalledTimes(2);
    });
  });

  describe('handleSpellCast', () => {
    it('triggers mana effect, guardian cast event, boss hit impact, preset, and casting flash', () => {
      const binder = bindBattleEvents(options);

      const manaFullListener = vi.fn();
      const guardianCastListener = vi.fn();
      const bossHitListener = vi.fn();
      eventBus.on('mana:full', manaFullListener);
      eventBus.on('guardian:cast', guardianCastListener);
      eventBus.on('boss:hit', bossHitListener);

      binder.handleSpellCast(4);

      expect(effectManager.playManaFullEffect).toHaveBeenCalledWith(500, 570);
      expect(manaFullListener).toHaveBeenCalledWith({ mana: 100 });
      expect(guardianCastListener).toHaveBeenCalledWith({ damage: 4 });
      expect(bossRenderer.triggerHit).toHaveBeenCalled();
      expect(effectManager.playBossHitImpact).toHaveBeenCalledWith(500, 600 * HORIZON_RATIO, false);
      expect(bossHitListener).toHaveBeenCalledWith({ bossHp: 15 });
      expect(effectManager.playPreset).toHaveBeenCalledWith('cast', 500, 600 * HORIZON_RATIO);
      expect(onCastingFlash).toHaveBeenCalledWith(0.6);
    });

    it('uses enrage flag when bossHazardController indicates enraged', () => {
      bossHazardController.isEnraged = true;
      const binder = bindBattleEvents(options);

      binder.handleSpellCast();

      expect(effectManager.playBossHitImpact).toHaveBeenCalledWith(500, 600 * HORIZON_RATIO, true);
    });
  });

  describe('triggerBossHitImpact', () => {
    it('plays hit animation and emits boss:hit event', () => {
      const binder = bindBattleEvents(options);
      const bossHitListener = vi.fn();
      eventBus.on('boss:hit', bossHitListener);

      binder.triggerBossHitImpact(0.35, true, true);

      expect(bossRenderer.triggerHit).toHaveBeenCalled();
      expect(effectManager.playBossHitImpact).toHaveBeenCalledWith(500, 210, false);
      expect(bossHitListener).toHaveBeenCalledWith({ bossHp: 15 });
      expect(effectManager.playPreset).toHaveBeenCalledWith('cast', 500, 210);
    });
  });

  describe('handleBossDefeated and handlePlayerDefeated', () => {
    it('handles boss victory transition and calculates stars', () => {
      const binder = bindBattleEvents(options);

      binder.handleBossDefeated();

      expect(dialogueManager.getDialogue).toHaveBeenCalledWith({
        trigger: 'boss_purified',
        chapter: 1,
        force: true,
      });
      expect(dialogueOverlayRenderer.show).toHaveBeenCalledWith({ text: 'Purified!' });
      expect(sessionLifecycle.claimResultTransition).toHaveBeenCalled();
      expect(options.starsMap![1]).toBeGreaterThanOrEqual(1);
      expect(onShowResult).toHaveBeenCalledWith(true);
    });

    it('handles player defeat transition', () => {
      const binder = bindBattleEvents(options);

      binder.handlePlayerDefeated();

      expect(sessionLifecycle.claimResultTransition).toHaveBeenCalled();
      expect(onShowResult).toHaveBeenCalledWith(false);
    });
  });

  describe('handlePlayerDamaged', () => {
    it('plays player_hurt SFX and triggers skeleton hit effect', () => {
      const binder = bindBattleEvents(options);

      binder.handlePlayerDamaged(20);

      expect(sfx.play).toHaveBeenCalledWith('player_hurt');
      expect(skeletonEffect.triggerHit).toHaveBeenCalled();
    });

    it('triggers player defeat if player dies from damage', () => {
      battle.isAlive = false;
      const binder = bindBattleEvents(options);

      binder.handlePlayerDamaged(100);

      expect(onShowResult).toHaveBeenCalledWith(false);
    });
  });

  describe('dispose / unbind', () => {
    it('detaches all eventBus listeners on dispose', () => {
      const binder = bindBattleEvents(options);
      binder.dispose();

      eventBus.emit('troop:barrage', { damage: 10, minionCount: 5, gaugeMultiplier: 1, isEnhanced: false });
      eventBus.emit('boss:enrage', { hp: 5, maxHp: 20 });
      eventBus.emit('answer:correct', { mana: 25, combo: 2 });

      expect(onClimaxBarrageTimer).not.toHaveBeenCalled();
      expect(speech.speakFeedback).not.toHaveBeenCalled();
      expect(skeletonEffect.triggerCorrect).not.toHaveBeenCalled();
    });
  });
});
