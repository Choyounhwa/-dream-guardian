/**
 * boss-climax-render.test.ts - Phase B 보스 결전 전투 상태 렌더링 통합 테스트
 *
 * @see Issue #195 [RENDER-CLIMAX-001]
 * @see Issue #193 [BATTLE-BOSS-001]
 * @see Issue #194 [MINION-TROOP-001]
 * @see Issue #213 [BOSS-FEVER-001]
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BossClimaxRenderer, type BossClimaxRenderState } from '../../src/render/BossClimaxRenderer.js';
import { BossController } from '../../src/game/BossController.js';
import { BossHazardController } from '../../src/game/BossHazardController.js';
import { BossFeverController } from '../../src/game/BossFeverController.js';
import { MinionTroopManager } from '../../src/game/MinionTroopManager.js';
import { PhasePresentationAdapter } from '../../src/ui/PhasePresentationAdapter.js';
import { EventBus } from '../../src/core/EventBus.js';

function createMockContext(): CanvasRenderingContext2D {
  return {
    save: vi.fn(),
    restore: vi.fn(),
    beginPath: vi.fn(),
    moveTo: vi.fn(),
    lineTo: vi.fn(),
    closePath: vi.fn(),
    arc: vi.fn(),
    ellipse: vi.fn(),
    fill: vi.fn(),
    stroke: vi.fn(),
    fillText: vi.fn(),
    strokeText: vi.fn(),
    measureText: vi.fn().mockReturnValue({ width: 80 }),
    fillRect: vi.fn(),
    strokeRect: vi.fn(),
    translate: vi.fn(),
    scale: vi.fn(),
    rotate: vi.fn(),
    setLineDash: vi.fn(),
    createLinearGradient: vi.fn().mockReturnValue({
      addColorStop: vi.fn(),
    }),
    createRadialGradient: vi.fn().mockReturnValue({
      addColorStop: vi.fn(),
    }),
    fillStyle: '',
    strokeStyle: '',
    lineWidth: 1,
    font: '',
    textAlign: 'center',
    textBaseline: 'middle',
    globalAlpha: 1.0,
    globalCompositeOperation: 'source-over',
    shadowColor: '',
    shadowBlur: 0,
  } as unknown as CanvasRenderingContext2D;
}

describe('BossClimaxRenderer Integration (Issue #195)', () => {
  let renderer: BossClimaxRenderer;
  let presentationAdapter: PhasePresentationAdapter;
  let boss: BossController;
  let hazardController: BossHazardController;
  let feverController: BossFeverController;
  let troopManager: MinionTroopManager;
  let eventBus: EventBus;
  let ctx: CanvasRenderingContext2D;

  const vw = 1080;
  const vh = 2160;

  beforeEach(() => {
    renderer = new BossClimaxRenderer();
    presentationAdapter = new PhasePresentationAdapter();
    boss = new BossController(1);
    eventBus = new EventBus();
    troopManager = new MinionTroopManager({ initialMinions: 4, bossController: boss, eventBus });
    feverController = new BossFeverController({ bossController: boss });
    hazardController = new BossHazardController({
      bossController: boss,
      bossFeverController: feverController,
      minionTroopManager: troopManager,
      eventBus,
      autoSchedule: false,
    });
    ctx = createMockContext();
  });

  it('BOSS_CLIMAX 상태에서 문제 및 러닝 HUD 렌더링이 차단됨을 presentationAdapter를 통해 보장한다', () => {
    expect(presentationAdapter.canRenderQuestion('BOSS_CLIMAX')).toBe(false);
    expect(presentationAdapter.canRenderRunningHUD('BOSS_CLIMAX')).toBe(false);
    expect(presentationAdapter.canRenderHazardEvade('BOSS_CLIMAX')).toBe(false);
  });

  it('실제 Phase B 컨트롤러 상태를 취합하여 BossClimaxRenderer에 매핑 및 렌더링한다', () => {
    // Phase B 가동
    troopManager.startPhaseB({ minionCount: 5, stardust: 25 } as any);
    feverController.start(0);
    hazardController.start();

    // 1. 공격 트리거
    hazardController.triggerAttack('dual_slam');
    hazardController.update(0.5);

    const renderState: BossClimaxRenderState = {
      bossHp: boss.hp,
      bossMaxHp: boss.maxHp,
      isEnraged: hazardController.isEnraged,
      minionCount: troopManager.minionCount,
      guardianStage: 2,
      stardust: troopManager.stardust,
      feverCombo: feverController.feverCombo,
      hazard: hazardController.isAttacking
        ? {
            activePattern: hazardController.currentAttack,
            progress: hazardController.attackProgress,
            isResolved: hazardController.attackState === 'resolved',
            isEvaded: hazardController.isEvaded,
          }
        : null,
      barrageActive: false,
      barrageProgress: 0,
      elapsedTime: 1.5,
    };

    expect(() => renderer.render(ctx, vw, vh, renderState)).not.toThrow();
    expect(ctx.ellipse).toHaveBeenCalled();
  });

  it('보스 HP가 30% 이하로 하강 시 광폭화 상태가 렌더러에 전달되어 붉은 아우라를 그린다', () => {
    // 보스 HP 10 -> 2 (20% <= 30%)
    boss.takeDamage(8);
    expect(boss.hp).toBe(2);

    hazardController.start();
    hazardController.update(0.1);
    expect(hazardController.isEnraged).toBe(true);

    const renderState: BossClimaxRenderState = {
      bossHp: boss.hp,
      bossMaxHp: boss.maxHp,
      isEnraged: hazardController.isEnraged,
      minionCount: 3,
      stardust: 10,
      feverCombo: 5,
      hazard: null,
      barrageActive: false,
      barrageProgress: 0,
      elapsedTime: 2.0,
    };

    renderer.render(ctx, vw, vh, renderState);
    expect(ctx.createRadialGradient).toHaveBeenCalled();
  });

  it('군단 탄막 발사 시 barrageActive가 렌더러에 반영되어 투사체가 렌더링된다', () => {
    troopManager.startPhaseB({ minionCount: 6, stardust: 30 } as any);

    let barrageTriggered = false;
    eventBus.on('troop:barrage', () => {
      barrageTriggered = true;
    });

    // 탄막 1회 강제 발사
    const barrageResult = troopManager.fireBarrage();
    expect(barrageResult.fired).toBe(true);
    expect(barrageTriggered).toBe(true);

    const renderState: BossClimaxRenderState = {
      bossHp: boss.hp,
      bossMaxHp: boss.maxHp,
      isEnraged: false,
      minionCount: troopManager.minionCount,
      stardust: troopManager.stardust,
      feverCombo: 0,
      hazard: null,
      barrageActive: true,
      barrageProgress: 0.6,
      elapsedTime: 3.0,
    };

    renderer.render(ctx, vw, vh, renderState);
    expect(ctx.fill).toHaveBeenCalled();
  });
});
