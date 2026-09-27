import { describe, expect, it } from 'vitest';
import { KneeFramingValidator } from '../../src/motion/KneeFramingValidator.js';
import { POSE_LANDMARKS, type NormalizedLandmark } from '../../src/types/index.js';

const WIDTH = 1920;
const HEIGHT = 1080;

function framedLandmarks(): NormalizedLandmark[] {
  const landmarks = Array.from({ length: 33 }, () => ({
    x: WIDTH / 2,
    y: HEIGHT / 2,
    z: 0,
    visibility: 0.95,
  }));

  landmarks[POSE_LANDMARKS.NOSE] = { x: 960, y: 180, z: 0, visibility: 0.95 };
  landmarks[POSE_LANDMARKS.LEFT_SHOULDER] = { x: 780, y: 360, z: 0, visibility: 0.95 };
  landmarks[POSE_LANDMARKS.RIGHT_SHOULDER] = { x: 1140, y: 360, z: 0, visibility: 0.95 };
  landmarks[POSE_LANDMARKS.LEFT_HIP] = { x: 810, y: 650, z: 0, visibility: 0.95 };
  landmarks[POSE_LANDMARKS.RIGHT_HIP] = { x: 1110, y: 650, z: 0, visibility: 0.95 };
  landmarks[POSE_LANDMARKS.LEFT_KNEE] = { x: 830, y: 900, z: 0, visibility: 0.95 };
  landmarks[POSE_LANDMARKS.RIGHT_KNEE] = { x: 1090, y: 900, z: 0, visibility: 0.95 };
  return landmarks;
}

describe('KneeFramingValidator (Issue #198 - MOTION-FRAME-001)', () => {
  it('becomes ready only after all required landmarks remain safely framed for the stability duration', () => {
    const validator = new KneeFramingValidator({ stabilityDuration: 0.5 });
    const landmarks = framedLandmarks();

    expect(validator.update(0.2, landmarks, WIDTH, HEIGHT).status).toBe('stabilizing');
    const ready = validator.update(0.3, landmarks, WIDTH, HEIGHT);

    expect(ready.status).toBe('ready');
    expect(ready.isFootKeynotePoseInputAllowed).toBe(true);
    expect(ready.progress).toBe(1);
  });

  it('immediately degrades and blocks foot-keynote Pose input when either knee is missing or not visible', () => {
    const validator = new KneeFramingValidator({ stabilityDuration: 0.1 });
    const landmarks = framedLandmarks();
    validator.update(0.1, landmarks, WIDTH, HEIGHT);

    const missing = [...landmarks];
    missing[POSE_LANDMARKS.RIGHT_KNEE] = { ...missing[POSE_LANDMARKS.RIGHT_KNEE], visibility: 0.1 };
    const degraded = validator.update(0.016, missing, WIDTH, HEIGHT);

    expect(degraded.status).toBe('degraded');
    expect(degraded.isFootKeynotePoseInputAllowed).toBe(false);
    expect(degraded.issue).toBe('low-visibility');
  });

  it('degrades when a knee crosses the viewport safety boundary or body size is too near or far', () => {
    const validator = new KneeFramingValidator({ stabilityDuration: 0.1 });
    const landmarks = framedLandmarks();
    validator.update(0.1, landmarks, WIDTH, HEIGHT);

    const outOfBounds = [...landmarks];
    outOfBounds[POSE_LANDMARKS.LEFT_KNEE] = { ...outOfBounds[POSE_LANDMARKS.LEFT_KNEE], y: 1040 };
    expect(validator.update(0.016, outOfBounds, WIDTH, HEIGHT).issue).toBe('outside-safe-frame');

    const tooNear = framedLandmarks();
    tooNear[POSE_LANDMARKS.LEFT_SHOULDER] = { ...tooNear[POSE_LANDMARKS.LEFT_SHOULDER], x: 300 };
    tooNear[POSE_LANDMARKS.RIGHT_SHOULDER] = { ...tooNear[POSE_LANDMARKS.RIGHT_SHOULDER], x: 1620 };
    expect(validator.update(0.016, tooNear, WIDTH, HEIGHT).issue).toBe('body-too-large');

    const tooFar = framedLandmarks();
    tooFar[POSE_LANDMARKS.LEFT_SHOULDER] = { ...tooFar[POSE_LANDMARKS.LEFT_SHOULDER], x: 930 };
    tooFar[POSE_LANDMARKS.RIGHT_SHOULDER] = { ...tooFar[POSE_LANDMARKS.RIGHT_SHOULDER], x: 990 };
    expect(validator.update(0.016, tooFar, WIDTH, HEIGHT).issue).toBe('body-too-small');
  });

  it('requires a new full stability duration after a degraded frame recovers', () => {
    const validator = new KneeFramingValidator({ stabilityDuration: 0.5 });
    const landmarks = framedLandmarks();
    validator.update(0.5, landmarks, WIDTH, HEIGHT);

    const lost = [...landmarks];
    lost[POSE_LANDMARKS.LEFT_KNEE] = { ...lost[POSE_LANDMARKS.LEFT_KNEE], visibility: 0.1 };
    expect(validator.update(0.016, lost, WIDTH, HEIGHT).status).toBe('degraded');

    expect(validator.update(0.49, landmarks, WIDTH, HEIGHT).status).toBe('stabilizing');
    expect(validator.update(0.01, landmarks, WIDTH, HEIGHT).status).toBe('ready');
  });

  it('does not mutate the input landmark array or landmark objects', () => {
    const validator = new KneeFramingValidator();
    const landmarks = framedLandmarks();
    const before = structuredClone(landmarks);

    validator.update(0.1, landmarks, WIDTH, HEIGHT);

    expect(landmarks).toEqual(before);
  });
});
