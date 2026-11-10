import { describe, it, expect, beforeEach } from 'vitest';
import { ClipPlayer } from '../../src/skeleton/anim/ClipPlayer.js';
import type { AnimationClip } from '../../src/types/animation-clip.js';

describe('ClipPlayer', () => {
  let player: ClipPlayer;

  const mockClip: AnimationClip = {
    id: 'test-clip',
    name: 'Test Victory Clip',
    duration: 2.0,
    loop: false,
    tracks: {
      arm_left: [
        { t: 0, angle: 0, ease: 'linear' },
        { t: 1.0, angle: Math.PI / 2, ease: 'linear' },
        { t: 2.0, angle: Math.PI, ease: 'linear' },
      ],
      arm_right: [
        { t: 0, angle: 0, ease: 'easeIn' },
        { t: 2.0, angle: -Math.PI / 2, ease: 'easeOut' },
      ],
    },
    skinSwaps: [
      { t: 0.0, boneId: 'head', partFile: 'head_normal.png' },
      { t: 1.0, boneId: 'head', partFile: 'head_wink.png' },
      { t: 0.5, boneId: 'arm_left', partFile: 'hand_peace.png' },
    ],
  };

  beforeEach(() => {
    player = new ClipPlayer();
  });

  it('기본 상태에서는 isPlaying이 false이고 weight는 0이다', () => {
    expect(player.isPlaying).toBe(false);
    expect(player.getCurrentWeight()).toBe(0);
    expect(player.getCurrentAngles()).toEqual({});
    expect(player.getActiveSkinSwaps()).toEqual({});
  });

  it('play() 호출 시 재생 상태가 되고 기본 weight는 1.0이다', () => {
    player.play(mockClip);
    expect(player.isPlaying).toBe(true);
    expect(player.getCurrentWeight()).toBe(1.0);
    expect(player.currentTime).toBe(0);
  });

  it('시간 경과(update)에 따라 키프레임 선형 보간 각도를 산출한다', () => {
    player.play(mockClip);
    player.update(0.5); // t = 0.5 (0에서 PI/2 사이의 절반 -> PI/4)
    const angles = player.getCurrentAngles();
    expect(angles.arm_left).toBeCloseTo(Math.PI / 4, 4);

    player.update(0.5); // t = 1.0
    expect(player.getCurrentAngles().arm_left).toBeCloseTo(Math.PI / 2, 4);

    player.update(0.5); // t = 1.5
    expect(player.getCurrentAngles().arm_left).toBeCloseTo((3 * Math.PI) / 4, 4);
  });

  it('이징(easeIn, easeOut, easeInOut)이 키프레임 보간에 반영된다', () => {
    const easeClip: AnimationClip = {
      id: 'ease-test',
      duration: 1.0,
      loop: false,
      tracks: {
        quad_in: [
          { t: 0, angle: 0, ease: 'easeIn' },
          { t: 1.0, angle: 100 },
        ],
        quad_out: [
          { t: 0, angle: 0, ease: 'easeOut' },
          { t: 1.0, angle: 100 },
        ],
        quad_inout: [
          { t: 0, angle: 0, ease: 'easeInOut' },
          { t: 1.0, angle: 100 },
        ],
      },
    };

    player.play(easeClip);
    player.update(0.5); // t = 0.5
    const angles = player.getCurrentAngles();
    // easeIn at 0.5 is 0.5^2 = 0.25 -> 25
    expect(angles.quad_in).toBeCloseTo(25, 2);
    // easeOut at 0.5 is 0.5 * (2 - 0.5) = 0.75 -> 75
    expect(angles.quad_out).toBeCloseTo(75, 2);
    // easeInOut at 0.5 is 2 * 0.25 = 0.5 -> 50
    expect(angles.quad_inout).toBeCloseTo(50, 2);
  });

  it('루프(loop: true) 클립은 duration 도달 시 0으로 순환한다', () => {
    const loopClip: AnimationClip = { ...mockClip, loop: true, duration: 2.0 };
    player.play(loopClip);
    player.update(2.5);
    expect(player.isPlaying).toBe(true);
    expect(player.currentTime).toBeCloseTo(0.5, 4);
  });

  it('비루프(loop: false) 클립은 duration 도달 시 정지된다', () => {
    player.play(mockClip); // loop: false, duration: 2.0
    player.update(2.1);
    expect(player.isPlaying).toBe(false);
    expect(player.currentTime).toBe(2.0);
    // 종료 후에도 마지막 각도 유지
    expect(player.getCurrentAngles().arm_left).toBeCloseTo(Math.PI, 4);
  });

  it('fadeInDuration이 설정된 경우 지정 시간 동안 가중치가 0에서 1로 점진 상승한다', () => {
    player.play(mockClip, { fadeInDuration: 1.0, weight: 0.8 });
    expect(player.getCurrentWeight()).toBeCloseTo(0, 4);

    player.update(0.5);
    expect(player.getCurrentWeight()).toBeCloseTo(0.4, 4);

    player.update(0.5);
    expect(player.getCurrentWeight()).toBeCloseTo(0.8, 4);

    player.update(0.5);
    expect(player.getCurrentWeight()).toBeCloseTo(0.8, 4);
  });

  it('stop(fadeOutDuration) 호출 시 지정 시간 동안 가중치가 0으로 감쇄된 후 정지된다', () => {
    player.play(mockClip, { weight: 1.0 });
    expect(player.getCurrentWeight()).toBe(1.0);

    player.stop(1.0);
    expect(player.isPlaying).toBe(true);

    player.update(0.5);
    expect(player.getCurrentWeight()).toBeCloseTo(0.5, 4);

    player.update(0.5);
    expect(player.getCurrentWeight()).toBeCloseTo(0, 4);
    expect(player.isPlaying).toBe(false);
  });

  it('stop() 즉시 정지 시 weight는 0, isPlaying은 false가 된다', () => {
    player.play(mockClip);
    player.stop();
    expect(player.isPlaying).toBe(false);
    expect(player.getCurrentWeight()).toBe(0);
  });

  it('boneMask가 적용된 경우 지정된 본의 각도만 반환한다', () => {
    player.play(mockClip, { boneMask: ['arm_left'] });
    player.update(1.0);
    const angles = player.getCurrentAngles();
    expect(angles.arm_left).toBeDefined();
    expect(angles.arm_right).toBeUndefined();
  });

  it('시간에 따른 스킨 스왑(getActiveSkinSwaps) 상태를 올바르게 반환한다', () => {
    player.play(mockClip);
    // t = 0
    let swaps = player.getActiveSkinSwaps();
    expect(swaps.head).toBe('head_normal.png');
    expect(swaps.arm_left).toBeUndefined();

    // t = 0.6
    player.update(0.6);
    swaps = player.getActiveSkinSwaps();
    expect(swaps.head).toBe('head_normal.png');
    expect(swaps.arm_left).toBe('hand_peace.png');

    // t = 1.2
    player.update(0.6);
    swaps = player.getActiveSkinSwaps();
    expect(swaps.head).toBe('head_wink.png');
    expect(swaps.arm_left).toBe('hand_peace.png');
  });
});
