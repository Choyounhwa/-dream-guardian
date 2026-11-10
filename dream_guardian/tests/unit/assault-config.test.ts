import { describe, it, expect } from 'vitest';
import { DEFAULT_ASSAULT_CONFIG, type AssaultTimingAndBalanceConfig } from '../../config/assault.config.js';
import { DEFAULT_ASSAULT_INPUT_CONFIG, type AssaultInputConfig } from '../../config/assault-input.config.js';
import { DEFAULT_ASSAULT_VISUAL_CONFIG, type AssaultVisualConfig } from '../../config/assault-visual.config.js';
import { DEFAULT_BOSS_HAZARD_CONFIG } from '../../config/battle.config.js';

describe('[BOSS-ASSAULT-03 / #505] MVP 조정 프로필 데이터', () => {
  describe('1. assault.config.ts (타이밍 및 밸런스 프로필)', () => {
    it('프로필 ID 및 규칙 버전이 올바르게 정의되어야 한다', () => {
      const config: AssaultTimingAndBalanceConfig = DEFAULT_ASSAULT_CONFIG;
      expect(config.profileId).toBe('assault_mvp_v1');
      expect(config.rulesVersion).toBe('v0.3');
    });

    it('최소 라운드 박자(minRoundBeats)는 8박 이상이어야 한다 (A03 계약)', () => {
      expect(DEFAULT_ASSAULT_CONFIG.minRoundBeats).toBeGreaterThanOrEqual(8);
      expect(DEFAULT_ASSAULT_CONFIG.minRoundBeats).toBe(8);
    });

    it('연산 유형별 읽기 시간 하한(readingMinSeconds)이 0보다 큰 유한값으로 정의되어야 한다 (DEC-C1)', () => {
      const { readingMinSeconds } = DEFAULT_ASSAULT_CONFIG;
      expect(readingMinSeconds).toBeDefined();
      expect(readingMinSeconds.addition).toBeGreaterThan(0);
      expect(readingMinSeconds.subtraction).toBeGreaterThan(0);
      expect(readingMinSeconds.multiplication).toBeGreaterThan(0);
      expect(readingMinSeconds.division).toBeGreaterThan(0);
      expect(readingMinSeconds.default).toBeGreaterThan(0);

      for (const val of Object.values(readingMinSeconds)) {
        expect(Number.isFinite(val)).toBe(true);
        expect(Number.isNaN(val)).toBe(false);
        expect(val).toBeGreaterThanOrEqual(2.0);
      }
    });

    it('TTS 낭독 추정 및 상한 수치가 올바르게 정의되어야 한다 (DEC-B3, A20)', () => {
      expect(DEFAULT_ASSAULT_CONFIG.readingCharRateMs).toBeGreaterThan(0);
      expect(Number.isFinite(DEFAULT_ASSAULT_CONFIG.readingCharRateMs)).toBe(true);
      expect(DEFAULT_ASSAULT_CONFIG.ttsMaxSeconds).toBeGreaterThan(0);
      expect(DEFAULT_ASSAULT_CONFIG.ttsMaxSeconds).toBe(3.0);
    });

    it('일시정지 복귀 유예 박자(resumeReadyBeats)는 1박 이상이어야 한다 (DEC-B8, A19, A23)', () => {
      expect(DEFAULT_ASSAULT_CONFIG.resumeReadyBeats).toBeGreaterThanOrEqual(1);
      expect(DEFAULT_ASSAULT_CONFIG.resumeReadyBeats).toBe(1);
    });

    it('플레이어 HP 및 피해량 수치가 승인 원장과 정확히 일치해야 한다 (DEC-A8, DEC-C10)', () => {
      expect(DEFAULT_ASSAULT_CONFIG.playerMaxHp).toBe(100);
      expect(DEFAULT_ASSAULT_CONFIG.wrongDamage).toBe(10);
      expect(DEFAULT_ASSAULT_CONFIG.squatFailDamage).toBe(5);
      expect(DEFAULT_ASSAULT_CONFIG.missDamage).toBe(10);
    });

    it('답안 및 스쿼트 기본 지속 박자가 정의되어야 한다', () => {
      expect(DEFAULT_ASSAULT_CONFIG.answerBeats).toBeGreaterThanOrEqual(1);
      expect(DEFAULT_ASSAULT_CONFIG.squatBeats).toBeGreaterThanOrEqual(1);
    });

    it('리듬 판정 등급 유예창이 실측 승인값과 일치해야 한다 (DEC-C4, DEC-B6)', () => {
      expect(DEFAULT_ASSAULT_CONFIG.rhythmWindows.Perfect).toBe(50);
      expect(DEFAULT_ASSAULT_CONFIG.rhythmWindows.Good).toBe(120);
      expect(DEFAULT_ASSAULT_CONFIG.rhythmWindows.Late).toBe(170);
    });

    it('보기 라벨 최대 글자 수 및 최소 폰트 크기가 규격에 맞아야 한다 (DEC-C9)', () => {
      expect(DEFAULT_ASSAULT_CONFIG.labelMaxLength).toBe(6);
      expect(DEFAULT_ASSAULT_CONFIG.labelMinFontSizePx).toBeGreaterThanOrEqual(16);
    });

    it('불변 객체여야 하며 속성 변경 시도가 차단되어야 한다', () => {
      expect(Object.isFrozen(DEFAULT_ASSAULT_CONFIG)).toBe(true);
      expect(Object.isFrozen(DEFAULT_ASSAULT_CONFIG.readingMinSeconds)).toBe(true);
      expect(Object.isFrozen(DEFAULT_ASSAULT_CONFIG.rhythmWindows)).toBe(true);
      expect(() => {
        (DEFAULT_ASSAULT_CONFIG as unknown as Record<string, unknown>).playerMaxHp = 999;
      }).toThrow();
    });

    it('함수, 타이머, 문제 텍스트, 런타임 상태를 포함하지 않는 순수 데이터여야 한다', () => {
      for (const [key, value] of Object.entries(DEFAULT_ASSAULT_CONFIG)) {
        expect(typeof value).not.toBe('function');
        expect(key).not.toMatch(/timer|interval|runtime|state|callback/i);
      }
    });
  });

  describe('2. assault-input.config.ts (입력 및 인터랙션 임계치 프로필)', () => {
    it('프로필 ID 및 규칙 버전이 올바르게 정의되어야 한다', () => {
      const config: AssaultInputConfig = DEFAULT_ASSAULT_INPUT_CONFIG;
      expect(config.profileId).toBe('assault_input_mvp_v1');
      expect(config.rulesVersion).toBe('v0.3');
    });

    it('입력 지연 보정 및 판정 유예창이 #541 실측 확정값과 일치해야 한다 (DEC-B6)', () => {
      expect(DEFAULT_ASSAULT_INPUT_CONFIG.inputLatencyMs).toBe(130);
      expect(DEFAULT_ASSAULT_INPUT_CONFIG.lateGraceWindowMs).toBe(170);
      expect(DEFAULT_ASSAULT_INPUT_CONFIG.lateGraceMs).toBe(170);
    });

    it('펀치 뻗기(1.25) 및 회수(0.85) 비율 임계치가 정의되어야 한다 (DEC-A3, #541)', () => {
      expect(DEFAULT_ASSAULT_INPUT_CONFIG.punchReachRatio).toBe(1.25);
      expect(DEFAULT_ASSAULT_INPUT_CONFIG.punchRetractRatio).toBe(0.85);
      expect(DEFAULT_ASSAULT_INPUT_CONFIG.punchReachRatio).toBeGreaterThan(
        DEFAULT_ASSAULT_INPUT_CONFIG.punchRetractRatio,
      );
      expect(DEFAULT_ASSAULT_INPUT_CONFIG.elbowExtensionAngleDeg).toBe(140);
    });

    it('스쿼트 하강(0.065) 및 직립 복귀(0.035) 임계치가 정의되어야 한다', () => {
      expect(DEFAULT_ASSAULT_INPUT_CONFIG.squatDropThreshold).toBe(0.065);
      expect(DEFAULT_ASSAULT_INPUT_CONFIG.squatStandThreshold).toBe(0.035);
      expect(DEFAULT_ASSAULT_INPUT_CONFIG.squatDropThreshold).toBeGreaterThan(
        DEFAULT_ASSAULT_INPUT_CONFIG.squatStandThreshold,
      );
    });

    it('양팔 가드 손목 거리 비율(0.8)이 정의되어야 한다 (DEC-C6, #541)', () => {
      expect(DEFAULT_ASSAULT_INPUT_CONFIG.guardWristDistanceRatio).toBe(0.8);
    });

    it('좌/우 타깃 박스 화면 영역 비율이 유효한 범위(0~1) 내에 있어야 한다 (DEC-A3)', () => {
      const { targetBoxes } = DEFAULT_ASSAULT_INPUT_CONFIG;
      expect(targetBoxes.left).toBeDefined();
      expect(targetBoxes.right).toBeDefined();

      expect(targetBoxes.left.xMin).toBeGreaterThanOrEqual(0);
      expect(targetBoxes.left.xMax).toBeLessThanOrEqual(0.5);
      expect(targetBoxes.left.xMin).toBeLessThan(targetBoxes.left.xMax);

      expect(targetBoxes.right.xMin).toBeGreaterThanOrEqual(0.5);
      expect(targetBoxes.right.xMax).toBeLessThanOrEqual(1.0);
      expect(targetBoxes.right.xMin).toBeLessThan(targetBoxes.right.xMax);
    });

    it('불변 객체여야 하며 속성 변경 시도가 차단되어야 한다', () => {
      expect(Object.isFrozen(DEFAULT_ASSAULT_INPUT_CONFIG)).toBe(true);
      expect(Object.isFrozen(DEFAULT_ASSAULT_INPUT_CONFIG.targetBoxes)).toBe(true);
      expect(Object.isFrozen(DEFAULT_ASSAULT_INPUT_CONFIG.targetBoxes.left)).toBe(true);
      expect(Object.isFrozen(DEFAULT_ASSAULT_INPUT_CONFIG.targetBoxes.right)).toBe(true);
      expect(() => {
        (DEFAULT_ASSAULT_INPUT_CONFIG as unknown as Record<string, unknown>).inputLatencyMs = 999;
      }).toThrow();
    });

    it('함수, 타이머, 런타임 상태를 포함하지 않는 순수 데이터여야 한다', () => {
      for (const [key, value] of Object.entries(DEFAULT_ASSAULT_INPUT_CONFIG)) {
        expect(typeof value).not.toBe('function');
        expect(key).not.toMatch(/timer|interval|runtime|state|callback/i);
      }
    });
  });

  describe('3. assault-visual.config.ts (비주얼 및 표현 프로필)', () => {
    it('프로필 ID 및 규칙 버전이 올바르게 정의되어야 한다', () => {
      const config: AssaultVisualConfig = DEFAULT_ASSAULT_VISUAL_CONFIG;
      expect(config.profileId).toBe('assault_visual_mvp_v1');
      expect(config.rulesVersion).toBe('v0.3');
    });

    it('보스 공격 손 및 앵커 좌표가 유효하게 정의되어야 한다 (DEC-C2)', () => {
      const { bossAnchor } = DEFAULT_ASSAULT_VISUAL_CONFIG;
      expect(bossAnchor.center.x).toBeCloseTo(0.5, 1);
      expect(bossAnchor.center.y).toBeGreaterThan(0);
      expect(bossAnchor.leftHand.x).toBeLessThan(bossAnchor.center.x);
      expect(bossAnchor.rightHand.x).toBeGreaterThan(bossAnchor.center.x);
    });

    it('좌/우 투사체 발사점 비율이 정의되어야 한다 (DEC-C2)', () => {
      const { projectileLaunchRatios } = DEFAULT_ASSAULT_VISUAL_CONFIG;
      expect(projectileLaunchRatios.left.x).toBeLessThan(0.5);
      expect(projectileLaunchRatios.right.x).toBeGreaterThan(0.5);
    });

    it('보스 접근 스케일 피드백 범위가 정의되어야 한다 (DEC-C3)', () => {
      const { bossScaleRange } = DEFAULT_ASSAULT_VISUAL_CONFIG;
      expect(bossScaleRange.minScale).toBeLessThan(bossScaleRange.maxScale);
      expect(bossScaleRange.minScale).toBeGreaterThan(0);
      expect(bossScaleRange.maxScale).toBeLessThanOrEqual(2.0);
    });

    it('보기 카드 레이아웃 및 라벨 글자수 상한이 정의되어야 한다 (DEC-C9)', () => {
      expect(DEFAULT_ASSAULT_VISUAL_CONFIG.labelMaxChars).toBe(6);
      expect(DEFAULT_ASSAULT_VISUAL_CONFIG.labelMinFontSizePx).toBeGreaterThanOrEqual(16);
      expect(DEFAULT_ASSAULT_VISUAL_CONFIG.choiceCard.widthRatio).toBeGreaterThan(0);
      expect(DEFAULT_ASSAULT_VISUAL_CONFIG.choiceCard.heightRatio).toBeGreaterThan(0);
    });

    it('피드백 지속시간 및 색상 팔레트가 정의되어야 한다', () => {
      const { feedbackDurationMs, colors } = DEFAULT_ASSAULT_VISUAL_CONFIG;
      expect(feedbackDurationMs.hitFlashMs).toBeGreaterThan(0);
      expect(feedbackDurationMs.stunMs).toBeGreaterThan(0);
      expect(feedbackDurationMs.shakeMs).toBeGreaterThan(0);

      expect(colors.leftChoice).toMatch(/^#[0-9a-fA-F]{6}$/);
      expect(colors.rightChoice).toMatch(/^#[0-9a-fA-F]{6}$/);
    });

    it('불변 객체여야 하며 속성 변경 시도가 차단되어야 한다', () => {
      expect(Object.isFrozen(DEFAULT_ASSAULT_VISUAL_CONFIG)).toBe(true);
      expect(Object.isFrozen(DEFAULT_ASSAULT_VISUAL_CONFIG.bossAnchor)).toBe(true);
      expect(Object.isFrozen(DEFAULT_ASSAULT_VISUAL_CONFIG.projectileLaunchRatios)).toBe(true);
      expect(Object.isFrozen(DEFAULT_ASSAULT_VISUAL_CONFIG.bossScaleRange)).toBe(true);
      expect(Object.isFrozen(DEFAULT_ASSAULT_VISUAL_CONFIG.choiceCard)).toBe(true);
      expect(Object.isFrozen(DEFAULT_ASSAULT_VISUAL_CONFIG.feedbackDurationMs)).toBe(true);
      expect(Object.isFrozen(DEFAULT_ASSAULT_VISUAL_CONFIG.colors)).toBe(true);
      expect(() => {
        (DEFAULT_ASSAULT_VISUAL_CONFIG as unknown as Record<string, unknown>).visualScale = 999;
      }).toThrow();
    });

    it('함수, 타이머, 런타임 상태를 포함하지 않는 순수 데이터여야 한다', () => {
      for (const [key, value] of Object.entries(DEFAULT_ASSAULT_VISUAL_CONFIG)) {
        expect(typeof value).not.toBe('function');
        expect(key).not.toMatch(/timer|interval|runtime|state|callback/i);
      }
    });
  });

  describe('4. 무결성 및 독립성 검증', () => {
    it('기존 DEFAULT_BOSS_HAZARD_CONFIG에 영향을 주지 않아야 한다', () => {
      expect(DEFAULT_BOSS_HAZARD_CONFIG.damage).toBe(15);
      expect(DEFAULT_BOSS_HAZARD_CONFIG.attackInterval).toBe(5.0);
    });

    it('모든 수치 항목에 NaN, Infinity, 음수 값이 존재하지 않아야 한다', () => {
      function checkNoNanInfinity(obj: unknown, path = ''): void {
        if (typeof obj === 'number') {
          expect(Number.isFinite(obj), `${path} is finite`).toBe(true);
          expect(Number.isNaN(obj), `${path} is not NaN`).toBe(false);
          expect(obj, `${path} is non-negative`).toBeGreaterThanOrEqual(0);
        } else if (typeof obj === 'object' && obj !== null) {
          for (const [k, v] of Object.entries(obj)) {
            checkNoNanInfinity(v, `${path}.${k}`);
          }
        }
      }

      checkNoNanInfinity(DEFAULT_ASSAULT_CONFIG, 'DEFAULT_ASSAULT_CONFIG');
      checkNoNanInfinity(DEFAULT_ASSAULT_INPUT_CONFIG, 'DEFAULT_ASSAULT_INPUT_CONFIG');
      checkNoNanInfinity(DEFAULT_ASSAULT_VISUAL_CONFIG, 'DEFAULT_ASSAULT_VISUAL_CONFIG');
    });
  });
});
