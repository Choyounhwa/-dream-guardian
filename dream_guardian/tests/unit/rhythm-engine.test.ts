import { describe, it, expect, vi, beforeEach } from 'vitest';
import { RhythmEngine, type BeatEvent } from '../../src/core/RhythmEngine.js';
import { EventBus } from '../../src/core/EventBus.js';

describe('RhythmEngine - BEAT-CORE-001', () => {
  let rhythm: RhythmEngine;

  beforeEach(() => {
    rhythm = new RhythmEngine({ bpm: 120 });
  });

  describe('1. 초기화 및 기본 설정', () => {
    it('BPM 120 기준 기본 1박은 0.5초이고 1라운드는 8박(4.0초)이다', () => {
      expect(rhythm.bpm).toBe(120);
      expect(rhythm.secondsPerBeat).toBeCloseTo(0.5, 5);
      expect(rhythm.beatsPerRound).toBe(8);
      expect(rhythm.secondsPerRound).toBeCloseTo(4.0, 5);
      expect(rhythm.elapsedTime).toBe(0);
      expect(rhythm.beatIndex).toBe(0);
      expect(rhythm.totalBeats).toBe(0);
      expect(rhythm.roundIndex).toBe(0);
      expect(rhythm.running).toBe(false);
      expect(rhythm.paused).toBe(false);
    });

    it('커스텀 BPM(e.g. 60)과 라운드당 박자수(e.g. 4)를 지원한다', () => {
      const custom = new RhythmEngine({ bpm: 60, beatsPerRound: 4 });
      expect(custom.bpm).toBe(60);
      expect(custom.secondsPerBeat).toBeCloseTo(1.0, 5);
      expect(custom.beatsPerRound).toBe(4);
      expect(custom.secondsPerRound).toBeCloseTo(4.0, 5);
    });

    it('브라우저 타이머(setInterval, setTimeout)를 직접 생성하지 않는다', () => {
      const setTimeoutSpy = vi.spyOn(globalThis, 'setTimeout');
      const setIntervalSpy = vi.spyOn(globalThis, 'setInterval');

      rhythm.start();
      rhythm.update(1.0);

      expect(setTimeoutSpy).not.toHaveBeenCalled();
      expect(setIntervalSpy).not.toHaveBeenCalled();

      setTimeoutSpy.mockRestore();
      setIntervalSpy.mockRestore();
    });
  });

  describe('2. 8박 라운드 진행 및 인덱스 순환', () => {
    it('start() 호출 시 시작되고 t=0 시점에 0번째 박(beatIndex 0)이 발행된다', () => {
      const beats: BeatEvent[] = [];
      rhythm.onBeat((e) => beats.push(e));

      rhythm.start();

      expect(rhythm.running).toBe(true);
      expect(beats).toHaveLength(1);
      expect(beats[0]).toMatchObject({
        beatIndex: 0,
        totalBeats: 0,
        roundIndex: 0,
        isFirstBeatOfRound: true,
        isLastBeatOfRound: false,
      });
    });

    it('0.5초마다 정확히 한 박씩 증가하며 8박(0~7) 후 0으로 순환한다', () => {
      const beats: BeatEvent[] = [];
      rhythm.onBeat((e) => beats.push(e));
      rhythm.start(); // beat 0 (t=0)

      // 1박부터 7박까지 0.5초씩 진행
      for (let i = 1; i <= 7; i++) {
        rhythm.update(0.5);
        expect(rhythm.beatIndex).toBe(i);
        expect(rhythm.totalBeats).toBe(i);
        expect(rhythm.roundIndex).toBe(0);
      }

      expect(beats).toHaveLength(8);
      expect(beats[7].beatIndex).toBe(7);
      expect(beats[7].isLastBeatOfRound).toBe(true);

      // 8번째 박 (t=4.0초) -> 1라운드 0박으로 순환
      rhythm.update(0.5);
      expect(rhythm.beatIndex).toBe(0);
      expect(rhythm.totalBeats).toBe(8);
      expect(rhythm.roundIndex).toBe(1);
      expect(beats).toHaveLength(9);
      expect(beats[8]).toMatchObject({
        beatIndex: 0,
        totalBeats: 8,
        roundIndex: 1,
        isFirstBeatOfRound: true,
      });
    });

    it('onRound 콜백이 라운드 순환 시점에 호출된다', () => {
      const roundCallback = vi.fn();
      rhythm.onRound(roundCallback);
      rhythm.start(); // round 0 시작

      // 0~7박 경과 (3.5초 추가)
      rhythm.update(3.5);
      expect(roundCallback).not.toHaveBeenCalled();

      // 8박 도달 (0.5초 추가 -> round 1 시작)
      rhythm.update(0.5);
      expect(roundCallback).toHaveBeenCalledTimes(1);
      expect(roundCallback).toHaveBeenCalledWith(1);
    });

    it('beatProgress와 roundProgress가 0.0~1.0 사이에서 정밀하게 계산된다', () => {
      rhythm.start();
      expect(rhythm.beatProgress).toBeCloseTo(0.0, 5);
      expect(rhythm.roundProgress).toBeCloseTo(0.0, 5);

      // 0.25초 경과 (1박의 50%, 1라운드(4초)의 6.25%)
      rhythm.update(0.25);
      expect(rhythm.beatProgress).toBeCloseTo(0.5, 5);
      expect(rhythm.roundProgress).toBeCloseTo(0.0625, 5);
    });
  });

  describe('3. 프레임 누적 및 대형 dt (Lag Spike) 처리', () => {
    it('60fps의 미세한 프레임(약 16.6ms)이 누적되어 0.5초에 도달하면 정확히 1번의 비트가 발생한다', () => {
      const beats: BeatEvent[] = [];
      rhythm.onBeat((e) => beats.push(e));
      rhythm.start(); // beat 0 (length: 1)

      const dt = 1 / 60; // ~0.016667s
      // 29프레임 업데이트 (총 ~0.483s, 0.5s 미만)
      for (let i = 0; i < 29; i++) {
        rhythm.update(dt);
      }
      expect(beats).toHaveLength(1);

      // 30번째 프레임 (총 ~0.500s 도달)
      rhythm.update(dt);
      expect(beats).toHaveLength(2);
      expect(beats[1].beatIndex).toBe(1);
    });

    it('프레임 지연(대형 dt, e.g. 1.6초) 발생 시 경과한 비트들이 누락 없이 순차 발행된다', () => {
      const beats: BeatEvent[] = [];
      rhythm.onBeat((e) => beats.push(e));
      rhythm.start(); // beat 0

      // t=0에서 한 번에 1.6초 경과 (0.5s beat 1, 1.0s beat 2, 1.5s beat 3 포함)
      const emitted = rhythm.update(1.6);

      expect(emitted).toHaveLength(3);
      expect(beats).toHaveLength(4); // 0, 1, 2, 3
      expect(beats.map((b) => b.beatIndex)).toEqual([0, 1, 2, 3]);
      expect(beats.map((b) => b.totalBeats)).toEqual([0, 1, 2, 3]);
      expect(rhythm.beatIndex).toBe(3);
      expect(rhythm.totalBeats).toBe(3);
      expect(rhythm.elapsedTime).toBeCloseTo(1.6, 5);
    });

    it('update() 결과로 해당 틱에 발행된 BeatEvent 배열이 반환된다', () => {
      rhythm.start();
      const tick1 = rhythm.update(0.2);
      expect(tick1).toHaveLength(0);

      const tick2 = rhythm.update(0.4); // total 0.6s -> beat 1 트리거
      expect(tick2).toHaveLength(1);
      expect(tick2[0].beatIndex).toBe(1);
    });
  });

  describe('4. 일시정지(pause) 및 재개(resume)', () => {
    it('pause() 상태에서는 update(dt)가 호출되어도 시간이 흐르지 않고 이벤트가 발생하지 않는다', () => {
      const beats: BeatEvent[] = [];
      rhythm.onBeat((e) => beats.push(e));
      rhythm.start(); // beat 0

      rhythm.update(0.25); // t = 0.25s
      expect(rhythm.elapsedTime).toBeCloseTo(0.25, 5);

      rhythm.pause();
      expect(rhythm.paused).toBe(true);

      // 일시정지 중 2초 경과 시뮬레이션
      const emittedWhilePaused = rhythm.update(2.0);
      expect(emittedWhilePaused).toHaveLength(0);
      expect(rhythm.elapsedTime).toBeCloseTo(0.25, 5);
      expect(beats).toHaveLength(1); // 여전히 beat 0만
    });

    it('resume() 후 남은 시간부터 정확히 이어져 비트 누락이나 중복이 없다', () => {
      const beats: BeatEvent[] = [];
      rhythm.onBeat((e) => beats.push(e));
      rhythm.start(); // beat 0 (t=0)

      rhythm.update(0.25); // t=0.25 (beat 0의 50% 진행)
      rhythm.pause();
      rhythm.update(10.0); // 정지 중 무시

      rhythm.resume();
      expect(rhythm.paused).toBe(false);

      // 0.25초 추가 -> 정확히 t=0.50s 도달하여 beat 1 발생
      rhythm.update(0.25);
      expect(beats).toHaveLength(2);
      expect(beats[1].beatIndex).toBe(1);
      expect(rhythm.elapsedTime).toBeCloseTo(0.50, 5);
    });
  });

  describe('5. 리셋(reset) 및 정지(stop)', () => {
    it('reset() 호출 시 모든 시간, 인덱스, 이벤트 기록이 0으로 초기화된다', () => {
      rhythm.start();
      rhythm.update(5.2);
      expect(rhythm.totalBeats).toBeGreaterThan(0);

      rhythm.reset();

      expect(rhythm.elapsedTime).toBe(0);
      expect(rhythm.beatIndex).toBe(0);
      expect(rhythm.totalBeats).toBe(0);
      expect(rhythm.roundIndex).toBe(0);
      expect(rhythm.running).toBe(false);
      expect(rhythm.paused).toBe(false);
    });

    it('reset() 후 다시 start() 하면 새로운 0번째 박부터 시작한다', () => {
      const beats: BeatEvent[] = [];
      rhythm.onBeat((e) => beats.push(e));

      rhythm.start();
      rhythm.update(1.0);
      expect(beats).toHaveLength(3); // 0, 1, 2

      rhythm.reset();
      rhythm.start();

      expect(beats).toHaveLength(4);
      expect(beats[3]).toMatchObject({
        beatIndex: 0,
        totalBeats: 0,
        roundIndex: 0,
      });
    });

    it('stop() 호출 시 running이 false가 되고 이후 update는 무시된다', () => {
      rhythm.start();
      rhythm.update(0.5);
      rhythm.stop();

      expect(rhythm.running).toBe(false);
      const emitted = rhythm.update(1.0);
      expect(emitted).toHaveLength(0);
    });
  });

  describe('6. 이벤트 리스너 및 EventBus 연동', () => {
    it('onBeat로 등록한 리스너의 unsubscribe 함수를 호출하면 리스너가 제거된다', () => {
      const beats: BeatEvent[] = [];
      const unsub = rhythm.onBeat((e) => beats.push(e));

      rhythm.start(); // beat 0
      expect(beats).toHaveLength(1);

      unsub();
      rhythm.update(0.5); // beat 1 발생하지만 수신 안 됨
      expect(beats).toHaveLength(1);
    });

    it('offBeat 메서드로 특정 리스너를 해제할 수 있다', () => {
      const listener = vi.fn();
      rhythm.onBeat(listener);
      rhythm.start();
      expect(listener).toHaveBeenCalledTimes(1);

      rhythm.offBeat(listener);
      rhythm.update(0.5);
      expect(listener).toHaveBeenCalledTimes(1);
    });

    it('EventBus가 주입된 경우 rhythm:beat 및 rhythm:round 이벤트를 발행한다', () => {
      const eventBus = new EventBus();
      const busRhythm = new RhythmEngine({ bpm: 120, eventBus });

      const beatSpy = vi.fn();
      const roundSpy = vi.fn();
      eventBus.on('rhythm:beat' as any, beatSpy);
      eventBus.on('rhythm:round' as any, roundSpy);

      busRhythm.start(); // beat 0
      expect(beatSpy).toHaveBeenCalledTimes(1);

      busRhythm.update(4.0); // 8박 경과 (beat 1~8)
      expect(beatSpy).toHaveBeenCalledTimes(9); // 0 + 8
      expect(roundSpy).toHaveBeenCalledTimes(1);
    });
  });

  describe('7. 동적 BPM 변경 (setBpm)', () => {
    it('setBpm 호출 시 템포가 즉시 변경되며 누적 박자 인덱스를 보존한다', () => {
      rhythm.start();
      rhythm.update(0.5); // 120 BPM -> beat 1
      expect(rhythm.beatIndex).toBe(1);

      // BPM 60으로 변경 (1박 = 1.0초)
      rhythm.setBpm(60);
      expect(rhythm.bpm).toBe(60);
      expect(rhythm.secondsPerBeat).toBeCloseTo(1.0, 5);

      // 이제 1.0초가 지나야 다음 박(beat 2)이 됨
      rhythm.update(0.5);
      expect(rhythm.beatIndex).toBe(1); // 아직 안 지남

      rhythm.update(0.5);
      expect(rhythm.beatIndex).toBe(2); // 1.0초 누적되어 beat 2 발생
    });
  });
});
