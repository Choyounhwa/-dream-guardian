import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SkeletonEffect } from '../../src/skeleton/SkeletonEffect.js';
import { SKELETON_EFFECT_CONFIG } from '../../config/effect.config.js';

/** Canvas 2D context mock */
function mockCtx() {
  return {
    fillStyle: '',
    strokeStyle: '',
    lineWidth: 0,
    lineCap: '',
    shadowColor: '',
    shadowBlur: 0,
    globalAlpha: 1,
    beginPath: vi.fn(),
    arc: vi.fn(),
    fill: vi.fn(),
    stroke: vi.fn(),
    moveTo: vi.fn(),
    lineTo: vi.fn(),
    closePath: vi.fn(),
    save: vi.fn(),
    restore: vi.fn(),
  } as unknown as CanvasRenderingContext2D;
}

describe('SkeletonEffect [VFX-004 / #276]', () => {
  let vfx: SkeletonEffect;

  beforeEach(() => {
    vfx = new SkeletonEffect();
  });

  // ─────────────────────────────────────────────────────────────
  // 1. 호흡 글로우 (breathGlow) & 마나 연동 색상 선형 보간
  // ─────────────────────────────────────────────────────────────
  describe('호흡 글로우 (breathGlow) & 마나 연동 색상', () => {
    it('기본 설정에서 호흡 주기가 2.0초로 정의되어 있다', () => {
      expect(SKELETON_EFFECT_CONFIG.breathCycle).toBe(2.0);
      expect(vfx.breathCycle).toBe(2.0);
    });

    it('마나 수준(0~100)에 따라 시안(#28E6FF)에서 보라(#C889FF)로 색상을 선형 보간한다', () => {
      // 0% 마나 -> #28E6FF
      vfx.setMana(0, 100);
      expect(vfx.manaRatio).toBe(0);
      expect(vfx.getManaGlowColor().toUpperCase()).toBe('#28E6FF');

      // 100% 마나 -> #C889FF
      vfx.setMana(100, 100);
      expect(vfx.manaRatio).toBe(1);
      expect(vfx.getManaGlowColor().toUpperCase()).toBe('#C889FF');

      // 50% 마나 -> #78B8FF (R: 40 + 80 = 120 (0x78), G: 230 - 46.5 = 184 (0xB8), B: 255 (0xFF))
      vfx.setMana(50, 100);
      expect(vfx.manaRatio).toBe(0.5);
      expect(vfx.getManaGlowColor().toUpperCase()).toBe('#78B8FF');
    });

    it('2초 주기로 호흡 위상(phase)과 스케일이 부드럽게 진동한다', () => {
      vfx.setMana(0, 100);

      // t=0s
      const scale0 = vfx.breathGlowScale;

      // t=0.5s (주기의 1/4)
      vfx.update(0.5);
      const scaleQuarter = vfx.breathGlowScale;
      expect(scaleQuarter).toBeGreaterThan(scale0);

      // t=1.0s (주기의 1/2) -> 다시 중앙 복귀
      vfx.update(0.5);
      expect(vfx.breathGlowScale).toBeCloseTo(scale0, 2);

      // t=1.5s (주기의 3/4) -> 최저점
      vfx.update(0.5);
      expect(vfx.breathGlowScale).toBeLessThan(scale0);

      // t=2.0s (1주기 완료) -> 원래 위치로 복귀
      vfx.update(0.5);
      expect(vfx.breathGlowScale).toBeCloseTo(scale0, 2);
    });
  });

  // ─────────────────────────────────────────────────────────────
  // 2. 정답 펄스 (correctPulse) & 콤보 강도 배율
  // ─────────────────────────────────────────────────────────────
  describe('정답 펄스 (correctPulse)', () => {
    it('triggerCorrect() 호출 시 0.3초 동안 정답 펄스가 활성화된다', () => {
      expect(vfx.isCorrectPulseActive).toBe(false);

      vfx.triggerCorrect();
      expect(vfx.isCorrectPulseActive).toBe(true);
      expect(vfx.correctPulseTimer).toBeCloseTo(0.3, 2);
      expect(vfx.getCurrentGlowColor().toUpperCase()).toBe('#4DFFAA');

      // 0.15초 경과 (절반) -> 여전히 활성
      vfx.update(0.15);
      expect(vfx.isCorrectPulseActive).toBe(true);
      expect(vfx.correctPulseTimer).toBeCloseTo(0.15, 2);

      // 0.16초 추가 경과 (총 0.31초) -> 비활성화
      vfx.update(0.16);
      expect(vfx.isCorrectPulseActive).toBe(false);
      expect(vfx.correctPulseTimer).toBe(0);
    });

    it('연쇄 콤보(combo >= 5) 시 글로우 강도 및 크기 배율이 증가한다', () => {
      // 콤보 0 (기본)
      vfx.triggerCorrect(0);
      const baseIntensity = vfx.correctIntensity;
      expect(baseIntensity).toBe(1.0);

      // 콤보 4 (임계값 미만)
      vfx.triggerCorrect(4);
      expect(vfx.correctIntensity).toBe(1.0);

      // 콤보 5 (임계값 달성 -> 배율 증가)
      vfx.triggerCorrect(5);
      const combo5Intensity = vfx.correctIntensity;
      expect(combo5Intensity).toBeGreaterThan(baseIntensity);
      expect(combo5Intensity).toBeGreaterThanOrEqual(1.5);

      // 콤보 10 (더 높은 연쇄 콤보 -> 추가 강도)
      vfx.triggerCorrect(10);
      expect(vfx.correctIntensity).toBeGreaterThan(combo5Intensity);
    });
  });

  // ─────────────────────────────────────────────────────────────
  // 3. 오답/피격 플래시 (hitFlash) & HP 50% 경고
  // ─────────────────────────────────────────────────────────────
  describe('오답/피격 플래시 (hitFlash) & HP 50% 경고', () => {
    it('triggerHit() 호출 시 0.2초 동안 적색(#FF4444) 플래시가 활성화된다', () => {
      expect(vfx.isHitFlashActive).toBe(false);

      vfx.triggerHit();
      expect(vfx.isHitFlashActive).toBe(true);
      expect(vfx.hitFlashTimer).toBeCloseTo(0.2, 2);
      expect(vfx.getCurrentGlowColor().toUpperCase()).toBe('#FF4444');

      // 0.1초 경과 -> 여전히 활성
      vfx.update(0.1);
      expect(vfx.isHitFlashActive).toBe(true);

      // 0.11초 추가 경과 (총 0.21초) -> 비활성화
      vfx.update(0.11);
      expect(vfx.isHitFlashActive).toBe(false);
      expect(vfx.hitFlashTimer).toBe(0);
    });

    it('HP 50% 이하 시 관절에 적색 경고 펄스(lowHpWarning)가 활성화된다', () => {
      // HP 100% -> 정상
      vfx.setHp(100, 100);
      expect(vfx.hpRatio).toBe(1.0);
      expect(vfx.isLowHpWarning).toBe(false);

      // HP 51% -> 정상
      vfx.setHp(51, 100);
      expect(vfx.isLowHpWarning).toBe(false);

      // HP 50% -> 경고 활성화
      vfx.setHp(50, 100);
      expect(vfx.hpRatio).toBe(0.5);
      expect(vfx.isLowHpWarning).toBe(true);

      // HP 20% -> 경고 활성화 유지
      vfx.setHp(20, 100);
      expect(vfx.isLowHpWarning).toBe(true);

      // HP 회복 (60%) -> 경고 해제
      vfx.setHp(60, 100);
      expect(vfx.isLowHpWarning).toBe(false);
    });

    it('피격 플래시는 정답 펄스보다 우선순위가 높다', () => {
      vfx.triggerCorrect(5);
      expect(vfx.getCurrentGlowColor().toUpperCase()).toBe('#4DFFAA');

      // 피격 발생 시 즉시 적색으로 전환
      vfx.triggerHit();
      expect(vfx.getCurrentGlowColor().toUpperCase()).toBe('#FF4444');
    });
  });

  // ─────────────────────────────────────────────────────────────
  // 4. 모션 트레일 이펙트 (motionTrail)
  // ─────────────────────────────────────────────────────────────
  describe('모션 트레일 이펙트 (motionTrail)', () => {
    it('손(19, 20) 및 발(31, 32) 관절 위치를 기록하고 4~6프레임 큐로 관리한다', () => {
      const joints = {
        19: { x: 100, y: 200 },
        20: { x: 300, y: 200 },
        31: { x: 150, y: 600 },
        32: { x: 250, y: 600 },
      };

      // 1번째 프레임 기록
      vfx.recordJointPositions(joints);
      expect(vfx.getTrailCount(19)).toBe(1);
      expect(vfx.getTrailCount(20)).toBe(1);
      expect(vfx.getTrailCount(31)).toBe(1);
      expect(vfx.getTrailCount(32)).toBe(1);

      // 2~6번째 프레임 순차 기록
      for (let i = 2; i <= 6; i++) {
        vfx.recordJointPositions({
          19: { x: 100 + i * 5, y: 200 + i * 5 },
          20: { x: 300 - i * 5, y: 200 + i * 5 },
          31: { x: 150, y: 600 },
          32: { x: 250, y: 600 },
        });
      }
      expect(vfx.getTrailCount(19)).toBe(6);

      // 7번째 프레임 기록 시 최대 프레임(6) 유지 (가장 오래된 1번째 프레임 제거)
      vfx.recordJointPositions({
        19: { x: 200, y: 300 },
        20: { x: 400, y: 300 },
        31: { x: 160, y: 610 },
        32: { x: 260, y: 610 },
      });
      expect(vfx.getTrailCount(19)).toBe(6);
      const trail19 = vfx.getTrail(19);
      expect(trail19[trail19.length - 1].x).toBe(200);
      expect(trail19[trail19.length - 1].y).toBe(300);
    });

    it('빠른 속도 움직임 시 속도에 비례하여 트레일 알파/배율이 증가한다', () => {
      // 느린 이동
      vfx.recordJointPositions({ 19: { x: 100, y: 100 } });
      vfx.recordJointPositions({ 19: { x: 102, y: 102 } });
      const slowAlpha = vfx.getTrailSpeedMultiplier(19);

      // 빠른 급격한 이동
      vfx.recordJointPositions({ 19: { x: 300, y: 300 } });
      const fastAlpha = vfx.getTrailSpeedMultiplier(19);

      expect(fastAlpha).toBeGreaterThan(slowAlpha);
    });

    it('renderTrails()가 활성 트레일 버퍼에 대해 Canvas 드로잉을 실행한다', () => {
      const ctx = mockCtx();

      // 프레임 3개 기록
      vfx.recordJointPositions({
        19: { x: 100, y: 200 },
        20: { x: 200, y: 200 },
        31: { x: 120, y: 400 },
        32: { x: 180, y: 400 },
      });
      vfx.recordJointPositions({
        19: { x: 120, y: 220 },
        20: { x: 220, y: 220 },
        31: { x: 130, y: 410 },
        32: { x: 190, y: 410 },
      });

      vfx.renderTrails(ctx);

      expect(ctx.save).toHaveBeenCalled();
      expect(ctx.beginPath).toHaveBeenCalled();
      expect(ctx.fill).toHaveBeenCalled();
      expect(ctx.restore).toHaveBeenCalled();
    });

    it('renderGlow()가 관절 목록에 대해 글로우 아우라 드로잉을 실행한다', () => {
      const ctx = mockCtx();
      const joints = {
        11: { x: 100, y: 150 }, // shoulder
        19: { x: 80, y: 250 },  // hand
      };

      vfx.renderGlow(ctx, joints);

      expect(ctx.save).toHaveBeenCalled();
      expect(ctx.beginPath).toHaveBeenCalled();
      expect(ctx.fill).toHaveBeenCalled();
      expect(ctx.restore).toHaveBeenCalled();
    });
  });

  // ─────────────────────────────────────────────────────────────
  // 5. 상태 초기화 (reset)
  // ─────────────────────────────────────────────────────────────
  describe('상태 초기화 (reset)', () => {
    it('reset() 호출 시 모든 타이머와 트레일 큐가 초기 상태로 복구된다', () => {
      vfx.triggerCorrect(5);
      vfx.triggerHit();
      vfx.setMana(80, 100);
      vfx.setHp(30, 100);
      vfx.recordJointPositions({ 19: { x: 100, y: 100 } });

      expect(vfx.isCorrectPulseActive).toBe(true);
      expect(vfx.isHitFlashActive).toBe(true);
      expect(vfx.getTrailCount(19)).toBe(1);

      vfx.reset();

      expect(vfx.isCorrectPulseActive).toBe(false);
      expect(vfx.isHitFlashActive).toBe(false);
      expect(vfx.correctPulseTimer).toBe(0);
      expect(vfx.hitFlashTimer).toBe(0);
      expect(vfx.getTrailCount(19)).toBe(0);
      expect(vfx.manaRatio).toBe(0);
      expect(vfx.hpRatio).toBe(1.0);
    });
  });
});
