/**
 * assault-recovery-target-config.test.ts
 *
 * [BOSS-ASSAULT-REC-03 / #593] 승인 목표 라운드 설정 단일화 단위 테스트
 *
 * 검증 목표:
 * 1. DEFAULT_ASSAULT_CONFIG.targetRounds가 REC-00(#588) 승인값인 10으로 단일화되어 있다.
 * 2. targetRounds가 양의 정수(positive integer)여야 한다.
 * 3. DEFAULT_ASSAULT_CONFIG가 deepFreeze되어 있어 런타임 변형이 불가능해야 한다.
 * 4. 기존 타이밍/밸런스/피해 설정(playerMaxHp, wrongDamage, minRoundBeats 등)이 100% 보존되어 있다.
 */

import { describe, it, expect } from 'vitest';
import {
  DEFAULT_ASSAULT_CONFIG,
  type AssaultTimingAndBalanceConfig,
} from '../../config/assault.config.js';

describe('[BOSS-ASSAULT-REC-03 / #593] Assault Target Rounds Config SSOT', () => {
  it('DEFAULT_ASSAULT_CONFIG에 REC-00 승인 목표 라운드(targetRounds = 10)가 단일 SSOT로 정의되어야 한다', () => {
    const config: AssaultTimingAndBalanceConfig = DEFAULT_ASSAULT_CONFIG;
    expect((config as any).targetRounds).toBeDefined();
    expect((config as any).targetRounds).toBe(10);
  });

  it('targetRounds는 양의 정수여야 한다', () => {
    const target = (DEFAULT_ASSAULT_CONFIG as any).targetRounds;
    expect(typeof target).toBe('number');
    expect(Number.isInteger(target)).toBe(true);
    expect(target).toBeGreaterThan(0);
  });

  it('DEFAULT_ASSAULT_CONFIG는 불변(deepFreeze)이어야 하며 targetRounds 변형이 불가능해야 한다', () => {
    expect(Object.isFrozen(DEFAULT_ASSAULT_CONFIG)).toBe(true);
    expect(() => {
      (DEFAULT_ASSAULT_CONFIG as any).targetRounds = 99;
    }).toThrow();
    expect((DEFAULT_ASSAULT_CONFIG as any).targetRounds).toBe(10);
  });

  it('기존 #503 MVP 타이밍 및 밸런스 설정이 온전히 보존되어야 한다', () => {
    expect(DEFAULT_ASSAULT_CONFIG.profileId).toBe('assault_mvp_v1');
    expect(DEFAULT_ASSAULT_CONFIG.rulesVersion).toBe('v0.3');
    expect(DEFAULT_ASSAULT_CONFIG.minRoundBeats).toBe(8);
    expect(DEFAULT_ASSAULT_CONFIG.playerMaxHp).toBe(100);
    expect(DEFAULT_ASSAULT_CONFIG.wrongDamage).toBe(10);
    expect(DEFAULT_ASSAULT_CONFIG.squatFailDamage).toBe(5);
    expect(DEFAULT_ASSAULT_CONFIG.missDamage).toBe(10);
    expect(DEFAULT_ASSAULT_CONFIG.resumeReadyBeats).toBe(1);
    expect(DEFAULT_ASSAULT_CONFIG.rhythmWindows.Late).toBe(170);
  });
});
