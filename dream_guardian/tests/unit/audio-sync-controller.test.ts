import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { AudioSyncController } from '../../src/editor/AudioSyncController.js';

describe('AudioSyncController - Web Audio 기반 비트 동기화 및 메트로놈 (Phase 3)', () => {
  let controller: AudioSyncController;

  beforeEach(() => {
    vi.useFakeTimers();
    controller = new AudioSyncController({ bpm: 95, enableAudioNode: false });
  });

  afterEach(() => {
    controller.stop();
    vi.useRealTimers();
  });

  describe('1. 기본 오디오 파라미터 및 BPM 설정', () => {
    it('기본 BPM은 95, 4/4 박자, secondsPerBeat는 약 0.6315초이다', () => {
      expect(controller.bpm).toBe(95);
      expect(controller.timeSignature).toEqual([4, 4]);
      expect(controller.secondsPerBeat).toBeCloseTo(60 / 95, 4);
    });

    it('BPM 변경 시 secondsPerBeat가 즉시 재계산되고 40~240 범위로 클램핑된다', () => {
      controller.setBpm(120);
      expect(controller.bpm).toBe(120);
      expect(controller.secondsPerBeat).toBeCloseTo(0.5, 4);

      controller.setBpm(300);
      expect(controller.bpm).toBe(240);
    });

    it('음소거(Mute) 상태를 토글할 수 있다', () => {
      expect(controller.isMuted).toBe(false);
      controller.setMuted(true);
      expect(controller.isMuted).toBe(true);
      controller.setMuted(false);
      expect(controller.isMuted).toBe(false);
    });
  });

  describe('2. 재생, 정지, 비트 탐색(Seek) 및 시간 동기화', () => {
    it('start() 후 시간이 경과하면 정확한 비트가 계산된다', () => {
      controller.setBpm(120); // 1초 = 2비트
      controller.start(0);
      expect(controller.isPlaying).toBe(true);

      // 1초(1000ms) 경과 시뮬레이션 -> 2비트
      vi.advanceTimersByTime(1000);
      const beat = controller.getCurrentBeat();
      expect(beat).toBeCloseTo(2.0, 1);
    });

    it('seek() 호출 시 기준 비트가 즉시 재설정된다', () => {
      controller.setBpm(120);
      controller.start(0);
      vi.advanceTimersByTime(500); // 1비트 경과

      controller.seek(4.0);
      expect(controller.getCurrentBeat()).toBeCloseTo(4.0, 1);

      vi.advanceTimersByTime(500); // 추가 1비트 경과
      expect(controller.getCurrentBeat()).toBeCloseTo(5.0, 1);
    });

    it('stop() 호출 시 재생이 멈추고 최종 비트가 유지된다', () => {
      controller.setBpm(120);
      controller.start(0);
      vi.advanceTimersByTime(1000); // 2비트

      controller.stop();
      expect(controller.isPlaying).toBe(false);
      const stoppedBeat = controller.getCurrentBeat();

      vi.advanceTimersByTime(1000);
      // 정지 상태이므로 비트가 증가하지 않음
      expect(controller.getCurrentBeat()).toBe(stoppedBeat);
    });
  });

  describe('3. 메트로놈 비트 틱 콜백 (Tick Callback)', () => {
    it('비트가 정수를 넘을 때마다 onTick 콜백이 호출되며 마디 첫 박(Downbeat)을 구분한다', () => {
      const onTick = vi.fn();
      controller.onTick = onTick;
      controller.setBpm(120); // 1초 = 2비트, 0.5초 = 1비트

      controller.start(0);

      // 1.1초 경과 -> 비트 1, 비트 2 통과
      vi.advanceTimersByTime(1100);
      expect(onTick).toHaveBeenCalled();

      // 마디의 첫 박(Beat 1)과 일반 박(Beat 2) 구분 검증
      const calls = onTick.mock.calls;
      expect(calls.length).toBeGreaterThanOrEqual(2);
      // 첫 번째 틱(Beat 1): downbeat = true
      expect(calls[0][0]).toBe(1);
      expect(calls[0][1]).toBe(true);
      // 두 번째 틱(Beat 2): downbeat = false
      expect(calls[1][0]).toBe(2);
      expect(calls[1][1]).toBe(false);
    });
  });
});
