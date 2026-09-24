import { describe, it, expect } from 'vitest';
import {
  DEFAULT_CONFIG,
  RESOLUTION_18_9,
  DEFAULT_FITNESS_ZONES,
  HEAD_ZONES,
  HIP_ZONES,
  SHOULDER_ZONES,
  LEFT_HAND_ZONES,
  RIGHT_HAND_ZONES,
  CURSOR_COLORS,
  CURSOR_CONFIDENCE_THRESHOLD,
  TIER_CONFIGS,
  POSTURE_TIER_BOUNDARIES,
  POSTURE_TIMING_CONFIG,
} from '../../src/core/Config.js';
import type { GameState } from '../../src/types/index.js';

describe('Architecture Test', () => {
  it('GameState 타입이 13개 상태를 포함한다', () => {
    const states: GameState[] = [
      'LOADING', 'MENU_MAIN', 'MENU_SUB', 'STORY_INTRO',
      'READY_POSITION', 'RUNNING', 'PLAYING', 'CORRECT',
      'WRONG', 'GUARDIAN_CAST', 'RESULT', 'GAMEOVER',
      'ENDING_CUTSCENE',
    ];
    expect(states).toHaveLength(13);
  });

  it('DEFAULT_CONFIG 전투 밸런스가 GDD와 일치한다', () => {
    expect(DEFAULT_CONFIG.player.maxHp).toBe(100);
    expect(DEFAULT_CONFIG.player.wrongDamage).toBe(25);
    expect(DEFAULT_CONFIG.player.bossAttackDamage).toBe(15);
    expect(DEFAULT_CONFIG.mana.correctReward).toBe(25);
    expect(DEFAULT_CONFIG.mana.spellCost).toBe(100);
    expect(DEFAULT_CONFIG.battle.spellDamage).toBe(4);
    expect(DEFAULT_CONFIG.battle.bossHpNormal).toBe(10);
    expect(DEFAULT_CONFIG.battle.bossHpNightmare).toBe(20);
  });

  it('DEFAULT_CONFIG 모션 임계값이 GDD와 일치한다', () => {
    expect(DEFAULT_CONFIG.motion.squatThreshold).toBe(0.065);
    expect(DEFAULT_CONFIG.motion.jumpThreshold).toBe(0.065);
    expect(DEFAULT_CONFIG.motion.jumpSpeedMin).toBe(0.22);
    expect(DEFAULT_CONFIG.motion.runBounceMin).toBe(0.012);
  });

  it('DEFAULT_CONFIG 입력 설정이 GDD 및 posture.config와 일치한다', () => {
    expect(DEFAULT_CONFIG.input.dwellTime).toBe(POSTURE_TIMING_CONFIG.defaultDwellTime);
    expect(DEFAULT_CONFIG.input.centerWeight).toBe(POSTURE_TIMING_CONFIG.centerWeight);
    expect(DEFAULT_CONFIG.input.edgeWeight).toBe(POSTURE_TIMING_CONFIG.edgeWeight);
  });

  it('DEFAULT_CONFIG 18:9 가상 해상도가 정의되어 있다', () => {
    expect(DEFAULT_CONFIG.render.virtualWidth).toBe(1080);
    expect(DEFAULT_CONFIG.render.virtualHeight).toBe(2160);
    expect(RESOLUTION_18_9.portrait.virtualWidth).toBe(1080);
    expect(RESOLUTION_18_9.portrait.virtualHeight).toBe(2160);
    expect(RESOLUTION_18_9.landscape.virtualWidth).toBe(2160);
    expect(RESOLUTION_18_9.landscape.virtualHeight).toBe(1080);
  });

  it('config/ 분리 모듈(zone, cursor, posture)이 Config.ts를 통해 정상 재노출된다 (Issue #120 / CFG-001)', () => {
    // 1. zone.config 검증
    expect(DEFAULT_FITNESS_ZONES).toHaveLength(11);
    expect(HEAD_ZONES.size).toBeGreaterThan(0);
    expect(HIP_ZONES.size).toBeGreaterThan(0);
    expect(SHOULDER_ZONES.size).toBeGreaterThan(0);
    expect(LEFT_HAND_ZONES.size).toBe(7);
    expect(RIGHT_HAND_ZONES.size).toBe(6);
    expect(LEFT_HAND_ZONES.has(4)).toBe(true);
    expect(RIGHT_HAND_ZONES.has(8)).toBe(true);

    // 2. cursor.config 검증
    expect(CURSOR_COLORS.leftHand).toBe('#28E6FF');
    expect(CURSOR_COLORS.rightHand).toBe('#FFCB4D');
    expect(CURSOR_COLORS.head).toBe('#C889FF');
    expect(CURSOR_COLORS.hip).toBe('#FF865E');
    expect(CURSOR_CONFIDENCE_THRESHOLD).toBe(0.45);

    // 3. posture.config 검증
    expect(TIER_CONFIGS[1].dwellTime).toBe(0.7);
    expect(TIER_CONFIGS[2].dwellTime).toBe(0.8);
    expect(TIER_CONFIGS[3].dwellTime).toBe(1.0);
    expect(TIER_CONFIGS[4].dwellTime).toBe(1.2);
    expect(POSTURE_TIER_BOUNDARIES.tier1.minQuestion).toBe(1);
    expect(POSTURE_TIER_BOUNDARIES.tier2.minQuestion).toBe(4);
    expect(POSTURE_TIER_BOUNDARIES.tier3.minQuestion).toBe(8);
    expect(POSTURE_TIER_BOUNDARIES.tier4.minQuestion).toBe(12);
    expect(POSTURE_TIMING_CONFIG.deadlockDecayMultiplier).toBe(3.0);
    expect(POSTURE_TIMING_CONFIG.naturalDecayMultiplier).toBe(2.0);
  });

  it('AnswerPosture, PostureProgress 및 상호 호환 어댑터가 정상 작동한다 (Issue #123 / POSE-001)', async () => {
    const { recipeToAnswerPosture, postureToChoiceRecipe } = await import('../../src/types/posture.js');
    type ImportedAnswerPosture = import('../../src/types/posture.js').AnswerPosture;
    type ImportedPostureProgress = import('../../src/types/posture.js').PostureProgress;

    // 1. AnswerPosture 인스턴스 생성 및 타입 유효성 검증
    const posture: ImportedAnswerPosture = {
      choiceIndex: 0,
      parts: ['leftHand', 'rightHand'],
      zoneIds: [1, 3],
      binding: 'any',
      patternId: 'D001',
      gates: [
        { part: 'leftHand', axis: 'y', max: 0.3 },
      ],
    };
    expect(posture.choiceIndex).toBe(0);
    expect(posture.parts).toHaveLength(2);
    expect(posture.zoneIds).toEqual([1, 3]);
    expect(posture.binding).toBe('any');
    expect(posture.patternId).toBe('D001');

    // 2. PostureProgress 인스턴스 검증 (존별/부위별 독립 상태)
    const progress: ImportedPostureProgress = {
      choiceIndex: 0,
      progress: 0.75,
      met: true,
      partStates: [
        { part: 'leftHand', zoneId: 1, inside: true },
        { part: 'rightHand', zoneId: 3, inside: true },
      ],
      zoneCovered: { 1: true, 3: true },
    };
    expect(progress.progress).toBe(0.75);
    expect(progress.met).toBe(true);
    expect(progress.partStates).toHaveLength(2);
    expect(progress.zoneCovered[1]).toBe(true);
    expect(progress.zoneCovered[3]).toBe(true);

    // 3. ChoiceRecipe <-> AnswerPosture 상호 호환 변환 어댑터 검증
    const legacyRecipe = {
      choiceIndex: 1,
      requiredCursors: ['leftHand', 'shoulder'] as ('leftHand' | 'shoulder')[],
      targetZoneIds: [4, 5],
    };

    const convertedPosture = recipeToAnswerPosture(legacyRecipe, 'LEGACY_TEST');
    expect(convertedPosture.choiceIndex).toBe(1);
    // shoulder -> head 매핑 확인 (D-3)
    expect(convertedPosture.parts).toEqual(['leftHand', 'head']);
    expect(convertedPosture.zoneIds).toEqual([4, 5]);
    expect(convertedPosture.patternId).toBe('LEGACY_TEST');

    const revertedRecipe = postureToChoiceRecipe(convertedPosture);
    expect(revertedRecipe.choiceIndex).toBe(1);
    expect(revertedRecipe.requiredCursors).toEqual(['leftHand', 'head']);
    expect(revertedRecipe.targetZoneIds).toEqual([4, 5]);
  });
});
