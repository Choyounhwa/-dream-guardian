import { describe, expect, it, beforeEach } from 'vitest';
import {
  createSessionStageSnapshot,
  getPhaseAHazardPattern,
  type SessionStageBundle,
} from '../../src/game/SessionContent.js';
import {
  PhaseAHazardController,
  type PhaseAHazardBeatResult,
  PHASE_A_ACTIVE_HAZARD_PATTERNS,
} from '../../src/game/PhaseAHazardController.js';

function createMockBundle(overrides: {
  isBuiltin?: boolean;
  bpm?: number;
  seed?: number;
  hazard?: {
    id?: string;
    hazardType: string;
    requiredAction?: string;
  } | null;
} = {}): SessionStageBundle {
  const bpm = overrides.bpm ?? 120;
  return createSessionStageSnapshot({
    stageId: 'ch1',
    sourcePackHash: 'pack_hash_test',
    rulesetId: 'ruleset_v2',
    rulesetHash: 'ruleset_hash_test',
    runtimeContractVersion: '2.0.0',
    bpm,
    isBuiltin: overrides.isBuiltin ?? false,
    isFallback: false,
    seed: overrides.seed ?? 42,
    phaseA: {
      starNotes: [],
      hazard: overrides.hazard !== undefined ? overrides.hazard : {
        id: 'hz_custom_1',
        hazardType: 'jump',
        requiredAction: 'jump',
      },
      motionGuide: [],
    },
    phaseB: {
      feverNotes: [],
      hazards: [],
      motionGuide: [],
    },
  });
}

describe('[#396 / GAME-HAZARD-A-CONTENT] Phase A 장판 팩 소비 계약과 단일 결과 보존', () => {
  describe('1. SessionStageBundle의 Phase A 장판 패턴 해석 헬퍼 (getPhaseAHazardPattern)', () => {
    it('커스텀 팩에 명시된 활성 장판(jump, left_step, right_step)을 올바르게 반환한다', () => {
      const bundleJump = createMockBundle({
        isBuiltin: false,
        hazard: { hazardType: 'jump', requiredAction: 'jump' },
      });
      expect(bundleJump.getPhaseAHazardPattern()).toBe('jump');
      expect(getPhaseAHazardPattern(bundleJump)).toBe('jump');

      const bundleRight = createMockBundle({
        isBuiltin: false,
        hazard: { hazardType: 'right_step', requiredAction: 'right_step' },
      });
      expect(bundleRight.getPhaseAHazardPattern()).toBe('right_step');

      const bundleLeft = createMockBundle({
        isBuiltin: false,
        hazard: { hazardType: 'left_step', requiredAction: 'left_step' },
      });
      expect(bundleLeft.getPhaseAHazardPattern()).toBe('left_step');
    });

    it('비활성 패턴(balance_left, balance_right)이나 유효하지 않은 패턴은 원천 차단하고 활성 3종만 반환한다', () => {
      const bundleBalanceLeft = createMockBundle({
        isBuiltin: false,
        hazard: { hazardType: 'balance_left', requiredAction: 'balance_left' },
        seed: 42,
      });
      const pattern = bundleBalanceLeft.getPhaseAHazardPattern();
      expect(PHASE_A_ACTIVE_HAZARD_PATTERNS).toContain(pattern);
      expect(pattern).not.toBe('balance_left');

      const bundleInvalid = createMockBundle({
        isBuiltin: false,
        hazard: { hazardType: 'somersault', requiredAction: 'somersault' },
        seed: 42,
      });
      const patternInvalid = bundleInvalid.getPhaseAHazardPattern();
      expect(PHASE_A_ACTIVE_HAZARD_PATTERNS).toContain(patternInvalid);
      expect(patternInvalid).not.toBe('somersault');
    });

    it('builtin 팩이거나 장판이 없는 경우 seed 결정적 패턴을 일관되게 반환한다', () => {
      const bundleBuiltin = createMockBundle({
        isBuiltin: true,
        hazard: null,
        seed: 42,
      });
      const p1 = bundleBuiltin.getPhaseAHazardPattern(1);
      const p2 = bundleBuiltin.getPhaseAHazardPattern(2);
      const p3 = bundleBuiltin.getPhaseAHazardPattern(3);
      const p4 = bundleBuiltin.getPhaseAHazardPattern(4);

      expect(PHASE_A_ACTIVE_HAZARD_PATTERNS).toContain(p1);
      expect(PHASE_A_ACTIVE_HAZARD_PATTERNS).toContain(p2);
      expect(PHASE_A_ACTIVE_HAZARD_PATTERNS).toContain(p3);
      expect(PHASE_A_ACTIVE_HAZARD_PATTERNS).toContain(p4);
      // 동일 인덱스 재호출 시 결정론적 일관성
      expect(bundleBuiltin.getPhaseAHazardPattern(1)).toBe(p1);
      expect(bundleBuiltin.getPhaseAHazardPattern(4)).toBe(p4);
      expect(p4).toBe(p1); // (42 + (4-1)) % 3 === (42 + (1-1)) % 3
    });
  });

  describe('2. PhaseAHazardController의 세션 번들 장판 소비 (startHazard)', () => {
    let controller: PhaseAHazardController;
    let resolvedList: PhaseAHazardBeatResult[];

    beforeEach(() => {
      resolvedList = [];
      controller = new PhaseAHazardController({
        onHazardResolved: (res) => resolvedList.push(res),
      });
    });

    it('startHazard에 bundle이 주어지면 번들의 커스텀 장판 패턴을 소비한다', () => {
      const bundle = createMockBundle({
        isBuiltin: false,
        hazard: { hazardType: 'right_step', requiredAction: 'right_step' },
      });

      controller.startHazard({ bundle });
      expect(controller.isActive).toBe(true);
      expect(controller.activePattern).toBe('right_step');
    });

    it('명시적 pattern 옵션이 주어지면 bundle보다 명시적 패턴을 우선한다 (소유권 명확화)', () => {
      const bundle = createMockBundle({
        isBuiltin: false,
        hazard: { hazardType: 'right_step', requiredAction: 'right_step' },
      });

      controller.startHazard({ bundle, pattern: 'jump' });
      expect(controller.activePattern).toBe('jump');
    });
  });

  describe('3. attackId 단일 결과 보장 및 중복 피해 방지', () => {
    let controller: PhaseAHazardController;
    let resolvedList: PhaseAHazardBeatResult[];

    beforeEach(() => {
      resolvedList = [];
      controller = new PhaseAHazardController({
        onHazardResolved: (res) => resolvedList.push(res),
      });
    });

    it('동일 attackId에 대해 중복 판정 및 중복 피해가 차단된다 (피해 최대 1회, damage <= 25)', () => {
      const attackId = 'atk_single_test_1';
      controller.startHazard({
        attackId,
        pattern: 'jump',
      });

      // 회피 실패 상태로 판정 시점(3.5s)까지 업데이트
      controller.update(3.5);
      expect(resolvedList).toHaveLength(1);
      expect(resolvedList[0].attackId).toBe(attackId);
      expect(resolvedList[0].evaded).toBe(false);
      expect(resolvedList[0].damage).toBe(25);
      expect(controller.isAttackResolved(attackId)).toBe(true);

      // 동일 attackId로 다시 호출하거나 추가 update를 수행해도 중복 결과/피해 발생 0건
      controller.update(0.1);
      expect(resolvedList).toHaveLength(1);

      controller.startHazard({
        attackId,
        pattern: 'jump',
      });
      controller.update(3.5);
      expect(resolvedList).toHaveLength(1); // 여전히 1회만 호출됨

      // 총 피해 합계 검증 (25 이하)
      const totalDamage = resolvedList.reduce((acc, r) => acc + r.damage, 0);
      expect(totalDamage).toBe(25);
    });

    it('오답 후 재시도/변형 시퀀스 (wrong-then-correct)는 독립된 결과를 온전하게 보존한다', () => {
      // 1차 시도: 실패 (attackId: 'r1_try_1')
      controller.startHazard({
        attackId: 'r1_try_1',
        pattern: 'jump',
      });
      controller.recordAction('left_step'); // 오답
      controller.update(3.5);

      expect(resolvedList).toHaveLength(1);
      expect(resolvedList[0].attackId).toBe('r1_try_1');
      expect(resolvedList[0].evaded).toBe(false);
      expect(resolvedList[0].damage).toBe(25);

      controller.stop();

      // 2차 시도 (재시도): 성공 (attackId: 'r1_try_2')
      controller.startHazard({
        attackId: 'r1_try_2',
        pattern: 'jump',
      });
      controller.recordAction('jump'); // 정답 회피
      controller.update(3.5);

      expect(resolvedList).toHaveLength(2);
      expect(resolvedList[1].attackId).toBe('r1_try_2');
      expect(resolvedList[1].evaded).toBe(true);
      expect(resolvedList[1].damage).toBe(0);

      // 각각의 결과가 보존되어 조회 가능
      expect(controller.getResolvedAttackResult('r1_try_1')?.evaded).toBe(false);
      expect(controller.getResolvedAttackResult('r1_try_2')?.evaded).toBe(true);
    });
  });

  describe('4. pause / resume / reset 생명주기 및 상태 격리', () => {
    let controller: PhaseAHazardController;
    let resolvedList: PhaseAHazardBeatResult[];

    beforeEach(() => {
      resolvedList = [];
      controller = new PhaseAHazardController({
        onHazardResolved: (res) => resolvedList.push(res),
      });
    });

    it('pause() 중에는 시간이 흐르지 않고 판정이 지연되며, resume() 후 판정된다', () => {
      controller.startHazard({ pattern: 'jump', attackId: 'atk_pause_test' });
      controller.update(2.0);
      expect(controller.elapsed).toBe(2.0);

      controller.pause();
      expect(controller.isPaused).toBe(true);

      // 일시정지 중 2초 경과 시도
      controller.update(2.0);
      expect(controller.elapsed).toBe(2.0);
      expect(controller.isResolved).toBe(false);
      expect(resolvedList).toHaveLength(0);

      // 재개 후 1.5초 추가 진행 -> 총 3.5s 도달하여 판정
      controller.resume();
      expect(controller.isPaused).toBe(false);
      controller.update(1.5);
      expect(controller.elapsed).toBe(3.5);
      expect(controller.isResolved).toBe(true);
      expect(resolvedList).toHaveLength(1);
    });

    it('reset() 호출 시 모든 진행 상태와 해결 기록이 깨끗하게 초기화된다', () => {
      controller.startHazard({ pattern: 'jump', attackId: 'atk_reset_test' });
      controller.update(3.5);
      expect(controller.isAttackResolved('atk_reset_test')).toBe(true);

      controller.reset();
      expect(controller.isActive).toBe(false);
      expect(controller.isResolved).toBe(false);
      expect(controller.isPaused).toBe(false);
      expect(controller.elapsed).toBe(0);
      expect(controller.isAttackResolved('atk_reset_test')).toBe(false);

      // reset 후에는 이전 attackId도 새로 시작 가능
      controller.startHazard({ pattern: 'jump', attackId: 'atk_reset_test' });
      expect(controller.isActive).toBe(true);
    });
  });

  describe('5. BPM 스케일링 (100, 120, 150 BPM)에 따른 정확한 7박 판정 및 8박 종료', () => {
    it('120 BPM (0.5s/beat) 환경에서 7박(3.5s) 판정 및 8박(4.0s) 종료', () => {
      const controller = new PhaseAHazardController();
      const bundle = createMockBundle({ bpm: 120 });
      controller.startHazard({ bundle, pattern: 'jump' });

      expect(controller.schedule.secondsPerBeat).toBe(0.5);
      expect(controller.schedule.judgmentTime).toBeCloseTo(3.5, 3);
      expect(controller.schedule.totalDuration).toBeCloseTo(4.0, 3);

      controller.update(3.49);
      expect(controller.isResolved).toBe(false);
      expect(controller.isActive).toBe(true);

      controller.update(0.01); // 3.5s
      expect(controller.isResolved).toBe(true);
      expect(controller.isActive).toBe(true);

      controller.update(0.5); // 4.0s
      expect(controller.isActive).toBe(false);
    });

    it('100 BPM (0.6s/beat) 환경에서 7박(4.2s) 판정 및 8박(4.8s) 종료', () => {
      const controller = new PhaseAHazardController();
      const bundle = createMockBundle({ bpm: 100 });
      controller.startHazard({ bundle, pattern: 'jump' });

      expect(controller.schedule.secondsPerBeat).toBe(0.6);
      expect(controller.schedule.judgmentTime).toBeCloseTo(4.2, 3);
      expect(controller.schedule.totalDuration).toBeCloseTo(4.8, 3);

      controller.update(4.19);
      expect(controller.isResolved).toBe(false);

      controller.update(0.01); // 4.2s
      expect(controller.isResolved).toBe(true);

      controller.update(0.6); // 4.8s
      expect(controller.isActive).toBe(false);
    });

    it('150 BPM (0.4s/beat) 환경에서 7박(2.8s) 판정 및 8박(3.2s) 종료', () => {
      const controller = new PhaseAHazardController();
      const bundle = createMockBundle({ bpm: 150 });
      controller.startHazard({ bundle, pattern: 'jump' });

      expect(controller.schedule.secondsPerBeat).toBe(0.4);
      expect(controller.schedule.judgmentTime).toBeCloseTo(2.8, 3);
      expect(controller.schedule.totalDuration).toBeCloseTo(3.2, 3);

      controller.update(2.79);
      expect(controller.isResolved).toBe(false);

      controller.update(0.01); // 2.8s
      expect(controller.isResolved).toBe(true);

      controller.update(0.4); // 3.2s
      expect(controller.isActive).toBe(false);
    });
  });
});
