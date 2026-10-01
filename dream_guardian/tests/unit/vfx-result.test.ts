/**
 * vfx-result.test.ts
 * [VFX-005 / #277] 승리/패배 결과 화면 연출 이펙트 (축하 파티클/패배 안개)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { StateMachine } from '../../src/core/StateMachine.js';
import { EffectManager } from '../../src/effects/EffectManager.js';
import { ResultRenderer, type ResultData } from '../../src/ui/ResultRenderer.js';
import {
  RESULT_EFFECT_CONFIG,
  PARTICLE_PRESETS,
} from '../../config/effect.config.js';

function createMockCtx(): CanvasRenderingContext2D {
  return {
    save: vi.fn(),
    restore: vi.fn(),
    beginPath: vi.fn(),
    closePath: vi.fn(),
    arc: vi.fn(),
    fill: vi.fn(),
    stroke: vi.fn(),
    fillRect: vi.fn(),
    moveTo: vi.fn(),
    lineTo: vi.fn(),
    fillText: vi.fn(),
    drawImage: vi.fn(),
    translate: vi.fn(),
    rotate: vi.fn(),
    roundRect: vi.fn(),
    createRadialGradient: vi.fn(() => ({
      addColorStop: vi.fn(),
    })),
    globalAlpha: 1,
    fillStyle: '',
    strokeStyle: '',
    lineWidth: 1,
    font: '',
    textAlign: '',
    textBaseline: '',
    shadowColor: '',
    shadowBlur: 0,
    lineCap: '',
    lineJoin: '',
  } as unknown as CanvasRenderingContext2D;
}

const baseResultData: ResultData = {
  victory: true,
  chapter: 1,
  correctCount: 9,
  totalQuestions: 10,
  maxCombo: 8,
  steps: 120,
  squats: 15,
  jumps: 10,
  elapsedTime: 95,
  dwellTime: 25.4,
  locomotionMode: 'run',
};

describe('VFX-005: 승리/패배 결과 화면 연출 이펙트 (축하 파티클 / 패배 안개)', () => {
  let manager: EffectManager;
  let renderer: ResultRenderer;

  beforeEach(() => {
    manager = new EffectManager(10);
    manager.setViewport(1080, 2160);
    renderer = new ResultRenderer();
  });

  describe('1. 설정 검증 (config/effect.config.ts)', () => {
    it('RESULT_EFFECT_CONFIG에 victory, defeat 설정이 올바르게 정의되어 있다', () => {
      expect(RESULT_EFFECT_CONFIG).toBeDefined();

      // 승리 연출 설정: 5색 (골드, 에메랄드, 시안, 마젠타, 화이트), 3종 형태, 등급별 수량
      expect(RESULT_EFFECT_CONFIG.victory).toBeDefined();
      expect(RESULT_EFFECT_CONFIG.victory.colors).toEqual(
        expect.arrayContaining(['#FFCB4D', '#4DFFAA', '#28E6FF', '#FF28D8', '#FFFFFF']),
      );
      expect(RESULT_EFFECT_CONFIG.victory.shapes).toEqual(
        expect.arrayContaining(['star', 'spark', 'rect']),
      );
      expect(RESULT_EFFECT_CONFIG.victory.starCounts[1]).toBe(120);
      expect(RESULT_EFFECT_CONFIG.victory.starCounts[2]).toBe(180);
      expect(RESULT_EFFECT_CONFIG.victory.starCounts[3]).toBeGreaterThanOrEqual(250);

      // 패배 연출 설정: 2.0초 지속 비네팅 어두움, 25~35개 침강 파티클, 적색/보라
      expect(RESULT_EFFECT_CONFIG.defeat).toBeDefined();
      expect(RESULT_EFFECT_CONFIG.defeat.vignetteDuration).toBeCloseTo(2.0, 1);
      expect(RESULT_EFFECT_CONFIG.defeat.particleCount).toBeGreaterThanOrEqual(25);
      expect(RESULT_EFFECT_CONFIG.defeat.particleCount).toBeLessThanOrEqual(35);
      expect(RESULT_EFFECT_CONFIG.defeat.colors).toEqual(
        expect.arrayContaining(['#FF4444', '#880022', '#C889FF']),
      );
    });

    it('PARTICLE_PRESETS에 victoryCelebration 및 defeatDarken이 정의되어 있다', () => {
      expect(PARTICLE_PRESETS.victoryCelebration).toBeDefined();
      expect(PARTICLE_PRESETS.defeatDarken).toBeDefined();
      expect(PARTICLE_PRESETS.defeatDarken.count).toBeGreaterThanOrEqual(25);
      expect(PARTICLE_PRESETS.defeatDarken.count).toBeLessThanOrEqual(35);
    });
  });

  describe('2. 승리 축하 파티클 연출 (playVictoryCelebration)', () => {
    it('1성(★☆☆) 승리 시 120개 파티클이 폭발 방출된다', () => {
      manager.playVictoryCelebration(1080, 2160, 1);

      expect(manager.particleEmitter.activeCount).toBe(120);
      const particles = manager.particleEmitter.activeParticles;
      const colors = new Set(particles.map((p) => p.color));
      expect(colors.size).toBeGreaterThanOrEqual(4);

      const shapes = new Set(particles.map((p) => p.shape));
      expect(shapes.has('star') || shapes.has('spark') || shapes.has('rect')).toBe(true);
    });

    it('2성(★★☆) 승리 시 180개 파티클이 폭발 방출된다', () => {
      manager.playVictoryCelebration(1080, 2160, 2);

      expect(manager.particleEmitter.activeCount).toBe(180);
    });

    it('3성(★★★) 승리 시 250개 이상의 파티클이 대규모 폭발 방출된다', () => {
      manager.playVictoryCelebration(1080, 2160, 3);

      expect(manager.particleEmitter.activeCount).toBeGreaterThanOrEqual(250);
    });

    it('상단 지속 스트림(stream)이 등록되어 프레임 업데이트 시 낙하 파티클이 추가 방출된다', () => {
      manager.playVictoryCelebration(1080, 2160, 3);
      const initialCount = manager.particleEmitter.activeCount;

      // 0.1초 경과 후 스트림에 의해 파티클이 누적 생성됨
      manager.update(0.1);
      expect(manager.particleEmitter.activeCount).toBeGreaterThan(initialCount);
    });
  });

  describe('3. 패배 비네팅 및 침강 파티클 연출 (playDefeatDarken)', () => {
    it('playDefeatDarken 호출 시 2.0초 비네팅 타이머와 25~35개 침강 파티클이 활성화된다', () => {
      manager.playDefeatDarken(1080, 2160);

      expect(manager.isDefeatDarkenActive).toBe(true);
      expect(manager.defeatDarkenTimer).toBeCloseTo(2.0, 1);

      const count = manager.particleEmitter.activeCount;
      expect(count).toBeGreaterThanOrEqual(25);
      expect(count).toBeLessThanOrEqual(35);

      // 하강 중력 및 적색/보라 침강 색상 확인
      const particles = manager.particleEmitter.activeParticles;
      const colors = particles.map((p) => p.color);
      expect(colors.some((c) => c === '#FF4444' || c === '#880022' || c === '#C889FF')).toBe(true);
      expect(particles.every((p) => p.gravity > 0)).toBe(true);
    });

    it('update(dt)에 따라 비네팅 타이머가 감소하고 2.0초 후 비활성화된다', () => {
      manager.playDefeatDarken(1080, 2160);
      expect(manager.isDefeatDarkenActive).toBe(true);

      manager.update(1.0);
      expect(manager.defeatDarkenTimer).toBeCloseTo(1.0, 1);
      expect(manager.isDefeatDarkenActive).toBe(true);

      manager.update(1.1);
      expect(manager.defeatDarkenTimer).toBe(0);
      expect(manager.isDefeatDarkenActive).toBe(false);
    });

    it('render 시 방사형 그라데이션 비네팅 다크 오버레이를 렌더링한다', () => {
      manager.playDefeatDarken(1080, 2160);
      manager.update(0.4); // fade-in 시점

      const mockCtx = createMockCtx();
      manager.render(mockCtx, 1080, 2160);

      expect(mockCtx.createRadialGradient).toHaveBeenCalled();
      expect(mockCtx.fillRect).toHaveBeenCalledWith(0, 0, 1080, 2160);
    });
  });

  describe('4. ResultRenderer 등장 슬라이드 인 및 순차 페이드 인 애니메이션', () => {
    it('resetAnimation 호출 시 animTime이 0으로 리셋되며 패널 슬라이드 오프셋이 적용된다', () => {
      renderer.resetAnimation();
      expect(renderer.animTime).toBe(0);
      expect(renderer.isPanelSettled).toBe(false);

      // 시작 시 패널은 화면 아래에서 올라오므로 오프셋 > 0
      const offset0 = renderer.getSlideOffsetY(2160);
      expect(offset0).toBeGreaterThan(100);

      // 0.25초 시점: 슬라이드가 진행 중이므로 오프셋이 감소
      renderer.update(0.25);
      const offsetMid = renderer.getSlideOffsetY(2160);
      expect(offsetMid).toBeLessThan(offset0);
      expect(renderer.isPanelSettled).toBe(false);

      // 0.5초 도달: 패널 슬라이드 완료 및 안착 (오프셋 0)
      renderer.update(0.25);
      expect(renderer.animTime).toBeCloseTo(0.5, 2);
      expect(renderer.getSlideOffsetY(2160)).toBeCloseTo(0, 1);
      expect(renderer.isPanelSettled).toBe(true);
    });

    it('패널 안착(0.5초) 후 8개 운동 통계 라인이 0.08~0.1초 간격으로 순차 페이드 인(알파 0->1)한다', () => {
      renderer.resetAnimation();

      // 0~0.5초: 패널 슬라이드 인 구간이므로 통계 라인은 모두 알파 0
      expect(renderer.getStatLineAlpha(0)).toBe(0);
      expect(renderer.getStatLineAlpha(7)).toBe(0);

      renderer.update(0.5); // 패널 안착 시점
      expect(renderer.getStatLineAlpha(0)).toBe(0);
      expect(renderer.getStatLineAlpha(1)).toBe(0);

      // 0.58초: 첫 번째 라인 페이드 인 시작 (알파 > 0), 두 번째 이후 라인은 여전히 0
      renderer.update(0.08);
      expect(renderer.getStatLineAlpha(0)).toBeGreaterThan(0);
      expect(renderer.getStatLineAlpha(1)).toBe(0);

      // 0.8초: 앞선 라인들의 알파가 뒤 라인들보다 크거나 같다 (순차 등장)
      renderer.update(0.22); // 총 0.8s
      for (let i = 0; i < 7; i++) {
        expect(renderer.getStatLineAlpha(i)).toBeGreaterThanOrEqual(renderer.getStatLineAlpha(i + 1));
      }

      // 1.5초 이상 충분히 경과: 8개 라인 모두 알파 1.0 완료
      renderer.update(1.0); // 총 1.8s
      for (let i = 0; i < 8; i++) {
        expect(renderer.getStatLineAlpha(i)).toBe(1);
      }
    });

    it('render 호출 시 슬라이드 인 오프셋에 맞춰 translate가 적용되고 순차 알파가 적용된다', () => {
      renderer.resetAnimation();
      const mockCtx = createMockCtx();

      // 시작 시점 (animTime = 0): 슬라이드 변환 적용
      renderer.render(mockCtx, 1080, 2160, baseResultData);
      expect(mockCtx.translate).toHaveBeenCalledWith(0, expect.any(Number));

      // 안착 후 충분한 시간 경과 (animTime = 2.0): 통계 라인 정상 렌더링
      renderer.update(2.0);
      const mockCtx2 = createMockCtx();
      renderer.render(mockCtx2, 1080, 2160, baseResultData);
      expect(mockCtx2.fillRect).toHaveBeenCalled();
      expect(mockCtx2.fillText).toHaveBeenCalled();
    });
  });

  describe('5. StateMachine 상태 전이 연동 검증 (RESULT / GAMEOVER)', () => {
    it('RESULT 상태 진입 시 resultRenderer.resetAnimation() 및 playVictoryCelebration()이 1회 호출된다', () => {
      const fsm = new StateMachine('ROUND_RESOLVE');
      const resetSpy = vi.spyOn(renderer, 'resetAnimation');
      const victorySpy = vi.spyOn(manager, 'playVictoryCelebration');

      fsm.registerState('RESULT', {
        enter: () => {
          renderer.resetAnimation();
          manager.playVictoryCelebration(1080, 2160, 3);
        },
      });

      fsm.changeState('RESULT');

      expect(resetSpy).toHaveBeenCalledTimes(1);
      expect(victorySpy).toHaveBeenCalledWith(1080, 2160, 3);
      expect(renderer.animTime).toBe(0);
      expect(manager.particleEmitter.activeCount).toBeGreaterThanOrEqual(250);
    });

    it('GAMEOVER 상태 진입 시 resultRenderer.resetAnimation() 및 playDefeatDarken()이 1회 호출된다', () => {
      const fsm = new StateMachine('ROUND_RESOLVE');
      const resetSpy = vi.spyOn(renderer, 'resetAnimation');
      const defeatSpy = vi.spyOn(manager, 'playDefeatDarken');

      fsm.registerState('GAMEOVER', {
        enter: () => {
          renderer.resetAnimation();
          manager.playDefeatDarken(1080, 2160);
        },
      });

      fsm.changeState('GAMEOVER');

      expect(resetSpy).toHaveBeenCalledTimes(1);
      expect(defeatSpy).toHaveBeenCalledWith(1080, 2160);
      expect(renderer.animTime).toBe(0);
      expect(manager.isDefeatDarkenActive).toBe(true);
    });
  });
});
