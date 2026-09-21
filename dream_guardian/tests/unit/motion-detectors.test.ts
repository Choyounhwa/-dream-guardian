import { describe, it, expect } from 'vitest';
import { CalibrationHelper } from '../../src/motion/CalibrationHelper.js';
import { RunDetector } from '../../src/motion/RunDetector.js';
import { SquatDetector } from '../../src/motion/SquatDetector.js';
import { JumpDetector } from '../../src/motion/JumpDetector.js';
import type { NormalizedLandmark } from '../../src/types/index.js';
import { POSE_LANDMARKS } from '../../src/types/index.js';

/**
 * 동작 감지 단위 테스트
 * - CalibrationHelper: 보정 로직
 * - RunDetector: 달리기 걸음 감지
 * - SquatDetector: 스쿼트 감지
 * - JumpDetector: 점프 감지
 */

const VH = 1080; // 가상 높이

/** 더미 랜드마크 (가상 좌표) */
function makeLM(overrides?: Partial<Record<number, Partial<NormalizedLandmark>>>): NormalizedLandmark[] {
  return Array.from({ length: 33 }, (_, i) => ({
    x: 960,
    y: 400,
    z: 0,
    visibility: 0.9,
    ...overrides?.[i],
  }));
}

// ═══════════════════════════════════
// CalibrationHelper
// ═══════════════════════════════════

describe('CalibrationHelper', () => {
  it('초기 상태가 waiting이다', () => {
    const cal = new CalibrationHelper();
    expect(cal.status).toBe('waiting');
    expect(cal.isDone).toBe(false);
    expect(cal.progress).toBe(0);
  });

  it('2초 분량의 프레임 후 보정이 완료된다', () => {
    const cal = new CalibrationHelper(2.0);
    const lm = makeLM({
      [POSE_LANDMARKS.LEFT_SHOULDER]: { y: 300 },
      [POSE_LANDMARKS.RIGHT_SHOULDER]: { y: 300 },
      [POSE_LANDMARKS.LEFT_HIP]: { y: 500 },
      [POSE_LANDMARKS.RIGHT_HIP]: { y: 500 },
    });

    // 20프레임 × 0.1초 = 2초
    for (let i = 0; i < 20; i++) {
      cal.update(0.1, lm);
    }

    expect(cal.isDone).toBe(true);
    expect(cal.status).toBe('done');
    expect(cal.baselineShoulderY).toBeCloseTo(300);
    expect(cal.baselineHipY).toBeCloseTo(500);
  });

  it('progress가 0에서 1로 점진적으로 증가한다', () => {
    const cal = new CalibrationHelper(2.0);
    const lm = makeLM();

    cal.update(1.0, lm); // 50%
    expect(cal.progress).toBeCloseTo(0.5);

    cal.update(1.0, lm); // 100%
    expect(cal.progress).toBe(1);
  });

  it('reset()이 상태를 초기화한다', () => {
    const cal = new CalibrationHelper(0.1);
    cal.update(0.1, makeLM());
    expect(cal.isDone).toBe(true);

    cal.reset();
    expect(cal.status).toBe('waiting');
    expect(cal.isDone).toBe(false);
    expect(cal.baselineShoulderY).toBe(0);
  });

  it('visibility 낮은 랜드마크는 보정에 반영되지 않는다', () => {
    const cal = new CalibrationHelper(1.0);
    const lm = makeLM({
      [POSE_LANDMARKS.NOSE]: { visibility: 0.2 },
    });

    cal.update(1.0, lm);
    expect(cal.isDone).toBe(false); // 코 신뢰도가 낮아 보정 진행 안됨
  });
});

// ═══════════════════════════════════
// RunDetector
// ═══════════════════════════════════

describe('RunDetector', () => {
  it('어깨 상하 방향 전환 시 걸음이 감지된다', () => {
    const rd = new RunDetector(5, 0.1); // bounceMin=5px, interval=0.1s
    const baseY = 400;

    // 프레임 1: 초기
    rd.update(makeLM({ [POSE_LANDMARKS.LEFT_SHOULDER]: { y: 400 }, [POSE_LANDMARKS.RIGHT_SHOULDER]: { y: 400 } }), baseY, 0);

    // 프레임 2: 아래로 (y 증가)
    rd.update(makeLM({ [POSE_LANDMARKS.LEFT_SHOULDER]: { y: 420 }, [POSE_LANDMARKS.RIGHT_SHOULDER]: { y: 420 } }), baseY, 0.1);

    // 프레임 3: 위로 (방향 전환 = 걸음)
    const stepped = rd.update(makeLM({ [POSE_LANDMARKS.LEFT_SHOULDER]: { y: 390 }, [POSE_LANDMARKS.RIGHT_SHOULDER]: { y: 390 } }), baseY, 0.3);

    expect(stepped).toBe(true);
    expect(rd.stepCount).toBe(1);
    expect(rd.isRunning).toBe(true);
  });

  it('stepInterval 미만 간격에서는 걸음을 카운트하지 않는다', () => {
    const rd = new RunDetector(5, 0.5); // interval=0.5s

    rd.update(makeLM({ [POSE_LANDMARKS.LEFT_SHOULDER]: { y: 400 }, [POSE_LANDMARKS.RIGHT_SHOULDER]: { y: 400 } }), 400, 0);
    rd.update(makeLM({ [POSE_LANDMARKS.LEFT_SHOULDER]: { y: 420 }, [POSE_LANDMARKS.RIGHT_SHOULDER]: { y: 420 } }), 400, 0.1);
    const stepped = rd.update(makeLM({ [POSE_LANDMARKS.LEFT_SHOULDER]: { y: 390 }, [POSE_LANDMARKS.RIGHT_SHOULDER]: { y: 390 } }), 400, 0.15); // 0.15 < 0.5

    expect(stepped).toBe(false);
    expect(rd.stepCount).toBe(0);
  });

  it('reset()이 상태를 초기화한다', () => {
    const rd = new RunDetector(5, 0.1);
    rd.update(makeLM({ [POSE_LANDMARKS.LEFT_SHOULDER]: { y: 400 }, [POSE_LANDMARKS.RIGHT_SHOULDER]: { y: 400 } }), 400, 0);
    rd.update(makeLM({ [POSE_LANDMARKS.LEFT_SHOULDER]: { y: 420 }, [POSE_LANDMARKS.RIGHT_SHOULDER]: { y: 420 } }), 400, 0.1);
    rd.update(makeLM({ [POSE_LANDMARKS.LEFT_SHOULDER]: { y: 390 }, [POSE_LANDMARKS.RIGHT_SHOULDER]: { y: 390 } }), 400, 0.3);
    expect(rd.stepCount).toBe(1);

    rd.reset();
    expect(rd.stepCount).toBe(0);
    expect(rd.isRunning).toBe(false);
  });

  it('바운스가 멈추고 0.5초 경과 시 isRunning이 false로 정상 복귀한다', () => {
    const rd = new RunDetector(5, 0.1, 0.5); // stopTimeout = 0.5s
    const baseY = 400;

    // 달리기 진행
    rd.update(makeLM({ [POSE_LANDMARKS.LEFT_SHOULDER]: { y: 400 }, [POSE_LANDMARKS.RIGHT_SHOULDER]: { y: 400 } }), baseY, 0);
    rd.update(makeLM({ [POSE_LANDMARKS.LEFT_SHOULDER]: { y: 420 }, [POSE_LANDMARKS.RIGHT_SHOULDER]: { y: 420 } }), baseY, 0.1);
    expect(rd.isRunning).toBe(true);

    // 0.2초 후 미세 움직임 (바운스 미달) -> 아직 타임아웃 전
    rd.update(makeLM({ [POSE_LANDMARKS.LEFT_SHOULDER]: { y: 421 }, [POSE_LANDMARKS.RIGHT_SHOULDER]: { y: 421 } }), baseY, 0.3);
    expect(rd.isRunning).toBe(true);

    // 0.7초 시점 (마지막 바운스 0.1초 기준 0.6초 경과, stopTimeout 0.5초 초과) -> isRunning = false 복귀
    rd.update(makeLM({ [POSE_LANDMARKS.LEFT_SHOULDER]: { y: 421 }, [POSE_LANDMARKS.RIGHT_SHOULDER]: { y: 421 } }), baseY, 0.7);
    expect(rd.isRunning).toBe(false);
  });

  it('어깨가 baselineY 대비 과도하게 하강(스쿼트)하면 달리기 스텝이 차단된다', () => {
    const rd = new RunDetector(5, 0.1);
    const baseY = 400;
    const deepSquatY = 550; // 기준선 대비 150px 하강 (스쿼트 상태)

    rd.update(makeLM({ [POSE_LANDMARKS.LEFT_SHOULDER]: { y: deepSquatY }, [POSE_LANDMARKS.RIGHT_SHOULDER]: { y: deepSquatY } }), baseY, 0, 1080);
    const stepped = rd.update(makeLM({ [POSE_LANDMARKS.LEFT_SHOULDER]: { y: deepSquatY + 20 }, [POSE_LANDMARKS.RIGHT_SHOULDER]: { y: deepSquatY + 20 } }), baseY, 0.1, 1080);

    expect(stepped).toBe(false);
    expect(rd.isRunning).toBe(false);
    expect(rd.stepCount).toBe(0);
  });
});

// ═══════════════════════════════════
// SquatDetector
// ═══════════════════════════════════

describe('SquatDetector', () => {
  it('어깨 Y가 기준선 대비 임계값 이상 하강하면 스쿼트가 감지된다', () => {
    const sd = new SquatDetector(0.065);
    const baseY = 400;
    const drop = 0.066 * VH; // 임계값 초과

    const started = sd.update(
      makeLM({
        [POSE_LANDMARKS.LEFT_SHOULDER]: { y: baseY + drop },
        [POSE_LANDMARKS.RIGHT_SHOULDER]: { y: baseY + drop },
      }),
      baseY,
      VH,
    );

    expect(started).toBe(true);
    expect(sd.isSquatting).toBe(true);
    expect(sd.squatCount).toBe(1);
  });

  it('임계값 미만 하강은 스쿼트로 감지되지 않는다', () => {
    const sd = new SquatDetector(0.065);
    const baseY = 400;
    const drop = 0.05 * VH; // 임계값 미만

    const started = sd.update(
      makeLM({
        [POSE_LANDMARKS.LEFT_SHOULDER]: { y: baseY + drop },
        [POSE_LANDMARKS.RIGHT_SHOULDER]: { y: baseY + drop },
      }),
      baseY,
      VH,
    );

    expect(started).toBe(false);
    expect(sd.isSquatting).toBe(false);
  });

  it('연속 스쿼트 유지 시 카운트가 증가하지 않는다 (엣지 트리거)', () => {
    const sd = new SquatDetector(0.065);
    const baseY = 400;
    const drop = 0.1 * VH;

    const lm = makeLM({
      [POSE_LANDMARKS.LEFT_SHOULDER]: { y: baseY + drop },
      [POSE_LANDMARKS.RIGHT_SHOULDER]: { y: baseY + drop },
    });

    sd.update(lm, baseY, VH); // 시작
    sd.update(lm, baseY, VH); // 유지
    sd.update(lm, baseY, VH); // 유지

    expect(sd.squatCount).toBe(1); // 1번만 카운트
  });

  it('reset()이 상태를 초기화한다', () => {
    const sd = new SquatDetector(0.065);
    sd.update(makeLM({ [POSE_LANDMARKS.LEFT_SHOULDER]: { y: 600 }, [POSE_LANDMARKS.RIGHT_SHOULDER]: { y: 600 } }), 400, VH);
    expect(sd.squatCount).toBe(1);

    sd.reset();
    expect(sd.squatCount).toBe(0);
    expect(sd.isSquatting).toBe(false);
  });
});

// ═══════════════════════════════════
// JumpDetector
// ═══════════════════════════════════

describe('JumpDetector', () => {
  it('어깨 Y가 임계값 이상 상승하고 속도 조건을 만족하면 점프가 감지된다', () => {
    const jd = new JumpDetector(0.065, 0.22);
    const baseY = 400;
    const rise = 0.07 * VH; // 임계값 초과

    // 프레임 1: 초기 위치
    jd.update(
      makeLM({
        [POSE_LANDMARKS.LEFT_SHOULDER]: { y: baseY },
        [POSE_LANDMARKS.RIGHT_SHOULDER]: { y: baseY },
      }),
      baseY, VH, 0.016,
    );

    // 프레임 2: 빠르게 상승
    const started = jd.update(
      makeLM({
        [POSE_LANDMARKS.LEFT_SHOULDER]: { y: baseY - rise },
        [POSE_LANDMARKS.RIGHT_SHOULDER]: { y: baseY - rise },
      }),
      baseY, VH, 0.016,
    );

    expect(started).toBe(true);
    expect(jd.isJumping).toBe(true);
    expect(jd.jumpCount).toBe(1);
  });

  it('상승은 충분하지만 속도가 부족하면 점프로 감지되지 않는다', () => {
    const jd = new JumpDetector(0.065, 0.22);
    const baseY = 400;
    const rise = 0.07 * VH;

    // 프레임 1
    jd.update(
      makeLM({
        [POSE_LANDMARKS.LEFT_SHOULDER]: { y: baseY },
        [POSE_LANDMARKS.RIGHT_SHOULDER]: { y: baseY },
      }),
      baseY, VH, 0.5, // 느린 프레임
    );

    // 프레임 2: 느린 상승 (속도 부족)
    const started = jd.update(
      makeLM({
        [POSE_LANDMARKS.LEFT_SHOULDER]: { y: baseY - rise },
        [POSE_LANDMARKS.RIGHT_SHOULDER]: { y: baseY - rise },
      }),
      baseY, VH, 0.5, // dt=0.5 → speed = rise/0.5 → 낮음
    );

    expect(started).toBe(false);
  });

  it('연속 점프 유지 시 카운트가 증가하지 않는다 (엣지 트리거)', () => {
    const jd = new JumpDetector(0.065, 0.22);
    const baseY = 400;
    const rise = 0.1 * VH;

    // 초기
    jd.update(makeLM({ [POSE_LANDMARKS.LEFT_SHOULDER]: { y: baseY }, [POSE_LANDMARKS.RIGHT_SHOULDER]: { y: baseY } }), baseY, VH, 0.016);

    // 점프 진입
    const lm = makeLM({ [POSE_LANDMARKS.LEFT_SHOULDER]: { y: baseY - rise }, [POSE_LANDMARKS.RIGHT_SHOULDER]: { y: baseY - rise } });
    jd.update(lm, baseY, VH, 0.016);
    jd.update(lm, baseY, VH, 0.016); // 유지

    expect(jd.jumpCount).toBe(1); // 1번만
  });

  it('reset()이 상태를 초기화한다', () => {
    const jd = new JumpDetector(0.065, 0.22);
    jd.update(makeLM({ [POSE_LANDMARKS.LEFT_SHOULDER]: { y: 400 }, [POSE_LANDMARKS.RIGHT_SHOULDER]: { y: 400 } }), 400, VH, 0.016);
    jd.update(makeLM({ [POSE_LANDMARKS.LEFT_SHOULDER]: { y: 300 }, [POSE_LANDMARKS.RIGHT_SHOULDER]: { y: 300 } }), 400, VH, 0.016);

    jd.reset();
    expect(jd.jumpCount).toBe(0);
    expect(jd.isJumping).toBe(false);
  });
});
