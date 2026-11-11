import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  AssaultClockAdapter,
  type AssaultRawInput,
} from '../../src/core/AssaultClockAdapter.js';
import { DEFAULT_ASSAULT_INPUT_CONFIG } from '../../config/assault-input.config.js';
import { DEFAULT_ASSAULT_CONFIG } from '../../config/assault.config.js';

describe('[BOSS-ASSAULT-08 / #510] 공통 활성 시각 및 안전 정지 어댑터 (AssaultClockAdapter)', () => {
  let clock: AssaultClockAdapter;

  beforeEach(() => {
    clock = new AssaultClockAdapter();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('1. 순수 어댑터 제약 및 기본 설정 검증', () => {
    it('새 requestAnimationFrame, setInterval, window/document DOM 리스너를 일체 등록하지 않아야 한다', () => {
      const g = globalThis as Record<string, unknown>;
      const originalRaf = g.requestAnimationFrame;
      const originalAddEventListener = g.addEventListener;

      const rafMock = vi.fn();
      const addEventListenerMock = vi.fn();
      const setIntervalSpy = vi.spyOn(globalThis, 'setInterval');

      g.requestAnimationFrame = rafMock;
      g.addEventListener = addEventListenerMock;

      try {
        const testClock = new AssaultClockAdapter();
        testClock.update(0.016);
        testClock.advance(1.0);
        testClock.normalizeInput(1000);

        expect(rafMock).not.toHaveBeenCalled();
        expect(setIntervalSpy).not.toHaveBeenCalled();
        expect(addEventListenerMock).not.toHaveBeenCalled();
      } finally {
        if (originalRaf === undefined) {
          delete g.requestAnimationFrame;
        } else {
          g.requestAnimationFrame = originalRaf;
        }
        if (originalAddEventListener === undefined) {
          delete g.addEventListener;
        } else {
          g.addEventListener = originalAddEventListener;
        }
      }
    });

    it('기본 설정으로 DEFAULT_ASSAULT_INPUT_CONFIG.inputLatencyMs와 DEFAULT_ASSAULT_CONFIG.resumeReadyBeats를 반영해야 한다', () => {
      expect(clock.inputLatencyMs).toBe(DEFAULT_ASSAULT_INPUT_CONFIG.inputLatencyMs);
      expect(clock.resumeReadyBeats).toBe(DEFAULT_ASSAULT_CONFIG.resumeReadyBeats);
      expect(clock.maxFrameDeltaSeconds).toBe(0.25);
      expect(clock.isFallbackMode).toBe(false);
      expect(clock.activeSeconds).toBe(0);
      expect(clock.isFrozen).toBe(false);
    });

    it('생성자 옵션으로 커스텀 수치를 주입할 수 있어야 한다', () => {
      const customClock = new AssaultClockAdapter({
        inputLatencyMs: 150,
        maxFrameDeltaSeconds: 0.1,
        isFallbackMode: true,
        resumeReadyBeats: 2,
        bpm: 120,
      });

      expect(customClock.inputLatencyMs).toBe(150);
      expect(customClock.maxFrameDeltaSeconds).toBe(0.1);
      expect(customClock.isFallbackMode).toBe(true);
      expect(customClock.resumeReadyBeats).toBe(2);
    });
  });

  describe('2. 정상 경과 시 활성 시각(active seconds) 누적 및 결정론 검증', () => {
    it('정상 델타 경과 시 활성 seconds가 정확히 누적되어야 한다', () => {
      clock.update(0.016);
      clock.update(0.016);
      clock.update(0.016);

      expect(clock.activeSeconds).toBeCloseTo(0.048, 5);
      expect(clock.isFrozen).toBe(false);
      expect(clock.primaryPauseReason).toBeNull();
    });

    it('동일한 정상 경과 시퀀스는 항상 동일한 활성 시각을 생성해야 한다 (A04, A19, A23 결정론)', () => {
      const clockA = new AssaultClockAdapter();
      const clockB = new AssaultClockAdapter();

      const sequence = [0.016, 0.033, 0.016, 0.02, 0.016];
      for (const dt of sequence) {
        clockA.update(dt);
        clockB.update(dt);
      }

      expect(clockA.activeSeconds).toBe(clockB.activeSeconds);
    });

    it('음수 델타는 무시되어 역행 누적되지 않아야 한다', () => {
      clock.update(0.1);
      clock.update(-0.05);

      expect(clock.activeSeconds).toBeCloseTo(0.1, 5);
    });
  });

  describe('3. 프레임 델타 임계값(maxFrameDeltaSeconds) 직전/동일/초과 판정', () => {
    it('임계값 직전(0.249s) 및 동일(0.250s) 델타는 정상 누적되어야 한다', () => {
      clock.update(0.249);
      expect(clock.activeSeconds).toBeCloseTo(0.249, 5);
      expect(clock.isFrozen).toBe(false);

      clock.update(0.25);
      expect(clock.activeSeconds).toBeCloseTo(0.499, 5);
      expect(clock.isFrozen).toBe(false);
    });

    it('임계값 초과(0.251s) 비정상 스파이크 프레임은 동결 처리되어 활성 시각에 가산되지 않아야 한다', () => {
      clock.update(0.1);
      expect(clock.activeSeconds).toBeCloseTo(0.1, 5);

      clock.update(0.251);
      expect(clock.activeSeconds).toBeCloseTo(0.1, 5);
      expect(clock.isFrozen).toBe(true);
      expect(clock.primaryPauseReason).toBe('frame_delta_exceeded');

      // 다음 정상 프레임에서는 동결이 해제되고 정상 누적 복귀
      clock.update(0.016);
      expect(clock.activeSeconds).toBeCloseTo(0.116, 5);
      expect(clock.isFrozen).toBe(false);
    });
  });

  describe('4. 안전 정지 요인(pause, hidden, tracking_lost) 및 폴백 모드 검증', () => {
    it('일시정지(pause) 시 활성 시각이 동결되어야 한다', () => {
      clock.advance(0.5);
      clock.setPaused(true);

      expect(clock.isFrozen).toBe(true);
      expect(clock.primaryPauseReason).toBe('pause');
      expect(clock.pauseReasons).toContain('pause');

      clock.update(0.016);
      clock.update(0.016);
      expect(clock.activeSeconds).toBeCloseTo(0.5, 5);
    });

    it('탭 숨김(hidden) 시 활성 시각이 동결되어야 한다', () => {
      clock.advance(0.5);
      clock.setHidden(true);

      expect(clock.isFrozen).toBe(true);
      expect(clock.primaryPauseReason).toBe('hidden');
      expect(clock.pauseReasons).toContain('hidden');

      clock.update(0.05);
      expect(clock.activeSeconds).toBeCloseTo(0.5, 5);
    });

    it('모션 모드에서 추적 상실(tracking lost)이 발생해도 시계가 동결되지 않고 활성 시간이 계속 흐른다', () => {
      clock.advance(0.5);
      clock.setTrackingLost(true);

      expect(clock.isTrackingLost).toBe(true);
      expect(clock.isFrozen).toBe(false);
      expect(clock.pauseReasons).not.toContain('tracking_lost');

      clock.update(0.05);
      expect(clock.activeSeconds).toBeCloseTo(0.55, 5);
    });

    it('폴백 모드(fallback mode)에서는 추적 상실이 발생해도 동결되지 않고 계속 누적되어야 한다', () => {
      clock.setFallbackMode(true);
      clock.advance(0.5);
      clock.setTrackingLost(true);

      expect(clock.isFrozen).toBe(false);
      expect(clock.pauseReasons).not.toContain('tracking_lost');

      clock.update(0.05);
      expect(clock.activeSeconds).toBeCloseTo(0.55, 5);
    });

    it('여러 정지 사유가 겹칠 때 모든 사유를 추적하고, 하나가 해제되어도 다른 사유가 남아있으면 동결이 유지되어야 한다', () => {
      clock.setPaused(true);
      clock.setHidden(true);

      expect(clock.isFrozen).toBe(true);
      expect(clock.pauseReasons).toEqual(expect.arrayContaining(['pause', 'hidden']));

      clock.setHidden(false);
      expect(clock.isFrozen).toBe(true);
      expect(clock.pauseReasons).toEqual(['pause']);

      clock.setPaused(false);
      expect(clock.isFrozen).toBe(false);
      expect(clock.pauseReasons).toHaveLength(0);
    });

    it('연속 pause 호출(중복 setPaused(true)) 시에도 상태가 안정적으로 유지되어야 한다', () => {
      clock.setPaused(true);
      clock.setPaused(true);
      expect(clock.isFrozen).toBe(true);
      expect(clock.pauseReasons.filter((r) => r === 'pause')).toHaveLength(1);

      clock.setPaused(false);
      expect(clock.isFrozen).toBe(false);
    });
  });

  describe('5. 정지 복귀 시 소급 가산 방지 및 재개 신호/공격 중 정지 여부 검증', () => {
    it('동결 기간 동안의 시간은 복귀 후에도 소급 가산되지 않아야 한다 (남은 읽기/반응 시간 보존)', () => {
      clock.advance(1.0); // 1.0초 경과
      expect(clock.activeSeconds).toBeCloseTo(1.0, 5);

      // 5초 동안 정지 상태 유지
      clock.setPaused(true);
      for (let i = 0; i < 50; i++) {
        clock.update(0.1);
      }
      expect(clock.activeSeconds).toBeCloseTo(1.0, 5);

      // 재개 후 다음 0.016초 경과
      clock.setPaused(false);
      clock.update(0.016);
      expect(clock.activeSeconds).toBeCloseTo(1.016, 5); // 5초 소급 없음!
    });

    it('정지 복귀 시 모션 재준비 신호(needsMotionReprep)를 발생시키고 준비 확인 시 resumeReady가 되어야 한다', () => {
      clock.advance(1.0);
      clock.setPaused(true);
      clock.update(0.016);

      clock.setPaused(false);
      clock.update(0.016);

      expect(clock.needsMotionReprep).toBe(true);
      expect(clock.resumeReady).toBe(false);

      const resumeSignal = clock.acknowledgeResume();
      expect(resumeSignal.needsMotionReprep).toBe(true);
      expect(resumeSignal.resumeReadyBeats).toBe(DEFAULT_ASSAULT_CONFIG.resumeReadyBeats);
      expect(clock.needsMotionReprep).toBe(false);
      expect(clock.resumeReady).toBe(true);
    });

    it('공격 진행 중 정지 발생 시 wasPausedDuringAttack 플래그가 true가 되어야 한다 (DEC-B8)', () => {
      clock.setAttackActive(true);
      expect(clock.wasPausedDuringAttack).toBe(false);

      // 공격 중 일시정지
      clock.setPaused(true);
      expect(clock.wasPausedDuringAttack).toBe(true);

      // 복귀 후에도 플래그가 유지되어 시스템(BOSS-ASSAULT-15)이 예고 재시작을 결정할 수 있어야 함
      clock.setPaused(false);
      clock.update(0.016);
      expect(clock.wasPausedDuringAttack).toBe(true);

      const signal = clock.acknowledgeResume();
      expect(signal.wasPausedDuringAttack).toBe(true);
      expect(clock.wasPausedDuringAttack).toBe(false);
    });

    it('공격이 없는 상태에서 정지 발생 시 wasPausedDuringAttack 플래그는 false여야 한다', () => {
      clock.setAttackActive(false);
      clock.setPaused(true);
      expect(clock.wasPausedDuringAttack).toBe(false);

      clock.setPaused(false);
      clock.update(0.016);
      expect(clock.wasPausedDuringAttack).toBe(false);
    });
  });

  describe('6. 입력 시각 지연 정규화(inputLatencyMs) 및 보정 전/후 시각 기록', () => {
    it('입력 시각에서 inputLatencyMs(130ms)를 감산하여 정규화하고 보정 전/후 시각을 모두 기록해야 한다', () => {
      clock.advance(2.0, 2000); // activeSeconds: 2.0s, engineTime: 2000ms

      const result = clock.normalizeInput(2000);

      expect(result.accepted).toBe(true);
      if (result.accepted) {
        expect(result.rawTimestampMs).toBe(2000);
        expect(result.compensatedTimestampMs).toBe(1870); // 2000 - 130
        expect(result.latencyMs).toBe(130);
        expect(result.activeTimestampSeconds).toBeCloseTo(1.87, 3);
      }
    });

    it('AssaultRawInput 객체 형태의 입력(inputId, hand 등)을 보존해야 한다', () => {
      clock.advance(1.0, 1000);

      const rawInput: AssaultRawInput = {
        timestampMs: 1000,
        inputId: 'punch_left_01',
        hand: 'left',
      };

      const result = clock.normalizeInput(rawInput);
      expect(result.accepted).toBe(true);
      if (result.accepted) {
        expect(result.rawTimestampMs).toBe(1000);
        expect(result.compensatedTimestampMs).toBe(870);
        expect(result.inputId).toBe('punch_left_01');
        expect(result.hand).toBe('left');
        expect(result.originalInput).toBe(rawInput);
      }
    });

    it('보정 후 시각이 0 미만으로 내려갈 경우 0으로 하한 고정되어야 한다', () => {
      clock.update(0.05, 50);

      const result = clock.normalizeInput(50);
      expect(result.accepted).toBe(true);
      if (result.accepted) {
        expect(result.rawTimestampMs).toBe(50);
        expect(result.compensatedTimestampMs).toBe(0); // 50 - 130 -> clamped to 0
        expect(result.activeTimestampSeconds).toBe(0);
      }
    });
  });

  describe('7. 동결 중 입력 폐기 및 역행/중복 시각 입력 거부 검증', () => {
    it('일시정지, 숨김, 추적상실 등 동결 중 수집된 입력은 폐기되어야 한다', () => {
      clock.advance(1.0, 1000);
      clock.setPaused(true);

      const result = clock.normalizeInput(1050);
      expect(result.accepted).toBe(false);
      if (!result.accepted) {
        expect(result.reason).toBe('pause');
        expect(result.rawTimestampMs).toBe(1050);
        expect(result.compensatedTimestampMs).toBe(920);
      }
    });

    it('역행 시각(backwards timestamp) 입력은 거부되어야 한다', () => {
      clock.advance(1.0, 1000);

      const first = clock.normalizeInput(1000);
      expect(first.accepted).toBe(true);

      const backwards = clock.normalizeInput(950); // 1000보다 과거
      expect(backwards.accepted).toBe(false);
      if (!backwards.accepted) {
        expect(backwards.reason).toBe('backwards_timestamp');
      }
    });

    it('중복 시각(duplicate timestamp) 입력은 거부되어야 한다', () => {
      clock.advance(1.0, 1000);

      const first = clock.normalizeInput(1000);
      expect(first.accepted).toBe(true);

      const duplicate = clock.normalizeInput(1000); // 동일 시각
      expect(duplicate.accepted).toBe(false);
      if (!duplicate.accepted) {
        expect(duplicate.reason).toBe('duplicate_timestamp');
      }
    });

    it('정상 증가하는 시각은 연속해서 승인되어야 한다', () => {
      clock.advance(1.0, 1000);
      const res1 = clock.normalizeInput(1000);
      const res2 = clock.normalizeInput(1050);
      const res3 = clock.normalizeInput(1100);

      expect(res1.accepted).toBe(true);
      expect(res2.accepted).toBe(true);
      expect(res3.accepted).toBe(true);
    });
  });

  describe('8. 리셋(reset) 및 상태 초기화', () => {
    it('reset 호출 시 활성 시간, 타임스탬프, 동결 및 공격 플래그가 깨끗이 초기화되어야 한다', () => {
      clock.advance(5.0, 5000);
      clock.setAttackActive(true);
      clock.setPaused(true);
      clock.normalizeInput(5000);

      clock.reset();

      expect(clock.activeSeconds).toBe(0);
      expect(clock.isFrozen).toBe(false);
      expect(clock.wasPausedDuringAttack).toBe(false);
      expect(clock.needsMotionReprep).toBe(false);

      // 리셋 후 이전 시각(예: 1000ms) 입력도 역행으로 보지 않고 정상 수락되어야 함
      const postResetInput = clock.normalizeInput(1000);
      expect(postResetInput.accepted).toBe(true);
    });
  });
});
