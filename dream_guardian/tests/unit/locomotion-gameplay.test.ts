import { describe, it, expect } from 'vitest';
import {
  calcCalories,
  getLocomotionStatLine,
} from '../../src/ui/ResultRenderer.js';
import {
  HUDLayer,
  LOCOMOTION_HUD_GUIDES,
} from '../../src/ui/HUDLayer.js';
import {
  LOCOMOTION_CALORIE_RATES,
} from '../../config/posture.config.js';
import {
  type ILocomotionDetector,
  type LocomotionMode,
  RunDetector,
  HipBounceDetector,
  HipSwayDetector,
  ArmCrossDetector,
} from '../../src/motion/index.js';

describe('Locomotion Gameplay Integration (Issue #155 / FEAT-GAME-002)', () => {
  describe('모드별 맞춤 칼로리 계산식 (METs 기반)', () => {
    it('LOCOMOTION_CALORIE_RATES에 4가지 모드별 계수가 정확히 정의되어 있다', () => {
      expect(LOCOMOTION_CALORIE_RATES.run).toBe(0.040);
      expect(LOCOMOTION_CALORIE_RATES.hip_bounce).toBe(0.035);
      expect(LOCOMOTION_CALORIE_RATES.hip_sway).toBe(0.038);
      expect(LOCOMOTION_CALORIE_RATES.arm_cross).toBe(0.032);
    });

    it('calcCalories 함수가 각 모드별 맞춤 스텝 계수를 적용하여 계산한다', () => {
      // 100스텝 단독 계산
      expect(calcCalories(100, 0, 0, 0, 'run')).toBeCloseTo(4.0, 3);
      expect(calcCalories(100, 0, 0, 0, 'hip_bounce')).toBeCloseTo(3.5, 3);
      expect(calcCalories(100, 0, 0, 0, 'hip_sway')).toBeCloseTo(3.8, 3);
      expect(calcCalories(100, 0, 0, 0, 'arm_cross')).toBeCloseTo(3.2, 3);
    });

    it('calcCalories 함수가 모드 생략 시 기본값 run(0.040)으로 하위 호환된다', () => {
      const defaultVal = calcCalories(100, 10, 20, 30);
      const explicitRunVal = calcCalories(100, 10, 20, 30, 'run');
      expect(defaultVal).toBeCloseTo(explicitRunVal, 5);
      expect(defaultVal).toBeCloseTo(100 * 0.040 + 10 * 0.35 + 20 * 0.15 + 30 * 0.07, 5);
    });

    it('getLocomotionStatLine이 각 모드별 아이콘, 모드명 및 단위를 올바르게 포맷팅한다', () => {
      expect(getLocomotionStatLine('run', 120)).toBe('🏃 달린 걸음: 120보 (제자리 달리기)');
      expect(getLocomotionStatLine('hip_bounce', 85)).toBe('🦘 골반 바운스: 85회');
      expect(getLocomotionStatLine('hip_sway', 90)).toBe('💃 골반 스웨이: 90회');
      expect(getLocomotionStatLine('arm_cross', 110)).toBe('🚗 양손 교차: 110회');
    });
  });

  describe('인게임 HUD 모션 가이드 텍스트', () => {
    it('LOCOMOTION_HUD_GUIDES에 4가지 모드별 맞춤 가이드 문구가 등록되어 있다', () => {
      expect(LOCOMOTION_HUD_GUIDES.run.title).toBe('가볍게 제자리에서 달리세요!');
      expect(LOCOMOTION_HUD_GUIDES.hip_bounce.title).toBe('무릎을 굽혔다 펴며 골반을 바운스하세요!');
      expect(LOCOMOTION_HUD_GUIDES.hip_sway.title).toBe('골반을 좌우로 흔들어 코어를 자극하세요!');
      expect(LOCOMOTION_HUD_GUIDES.arm_cross.title).toBe('양손을 위아래로 교차하며 핸들을 돌리세요!');
    });

    it('HUDLayer.getLocomotionGuide가 선택된 모드의 안내 텍스트를 반환한다', () => {
      const hud = new HUDLayer();
      const guideRun = hud.getLocomotionGuide('run');
      expect(guideRun.title).toBe('가볍게 제자리에서 달리세요!');
      expect(guideRun.icon).toBe('🏃');

      const guideBounce = hud.getLocomotionGuide('hip_bounce');
      expect(guideBounce.title).toBe('무릎을 굽혔다 펴며 골반을 바운스하세요!');
      expect(guideBounce.icon).toBe('🦘');

      const guideSway = hud.getLocomotionGuide('hip_sway');
      expect(guideSway.title).toBe('골반을 좌우로 흔들어 코어를 자극하세요!');
      expect(guideSway.icon).toBe('💃');

      const guideArm = hud.getLocomotionGuide('arm_cross');
      expect(guideArm.title).toBe('양손을 위아래로 교차하며 핸들을 돌리세요!');
      expect(guideArm.icon).toBe('🚗');
    });
  });

  describe('Locomotion 감지기 다형성 및 전환', () => {
    it('4개 모드 감지기가 모두 ILocomotionDetector 인터페이스를 준수한다', () => {
      const detectors: Record<LocomotionMode, ILocomotionDetector> = {
        run: new RunDetector(),
        hip_bounce: new HipBounceDetector(),
        hip_sway: new HipSwayDetector(),
        arm_cross: new ArmCrossDetector(),
      };

      for (const [modeKey, det] of Object.entries(detectors)) {
        expect(det.mode).toBe(modeKey);
        expect(typeof det.update).toBe('function');
        expect(typeof det.reset).toBe('function');
        expect(typeof det.isRunning).toBe('boolean');
        expect(typeof det.stepCount).toBe('number');
      }
    });

    it('동적 모드 전환 시 올바른 감지기가 활성화되고 독립적으로 동작한다', () => {
      const detectors: Record<LocomotionMode, ILocomotionDetector> = {
        run: new RunDetector(),
        hip_bounce: new HipBounceDetector(),
        hip_sway: new HipSwayDetector(),
        arm_cross: new ArmCrossDetector(),
      };

      let activeMode: LocomotionMode = 'run';
      const getActive = () => detectors[activeMode];

      expect(getActive().mode).toBe('run');
      activeMode = 'hip_bounce';
      expect(getActive().mode).toBe('hip_bounce');
      activeMode = 'hip_sway';
      expect(getActive().mode).toBe('hip_sway');
      activeMode = 'arm_cross';
      expect(getActive().mode).toBe('arm_cross');
    });
  });
});
