import { describe, it, expect, beforeEach } from 'vitest';
import { SecondaryMotion } from '../../src/skeleton/rig/SecondaryMotion.js';
import type { CharacterRig } from '../../src/types/character-rig.js';

describe('SecondaryMotion 보조 본 2차 스프링 물리 단위 테스트 (#686 / FEAT-RIG-003)', () => {
  let sampleRig: CharacterRig;
  let secondaryMotion: SecondaryMotion;

  beforeEach(() => {
    sampleRig = {
      id: 'fox_rig',
      name: 'Fox Rig',
      rootAnchor: 'hip',
      bones: [
        {
          id: 'pelvis',
          length: 0,
          restAngle: -Math.PI / 2,
          driver: 'pose',
          poseSource: 'torso',
        },
        {
          id: 'tail_base',
          parent: 'pelvis',
          length: 60,
          restAngle: Math.PI * 0.25, // 45도 방향
          minAngle: -Math.PI * 0.5,
          maxAngle: Math.PI * 0.8,
          driver: 'physics',
          physics: {
            stiffness: 80,
            damping: 10,
            gravity: 20,
          },
        },
        {
          id: 'tail_tip',
          parent: 'tail_base',
          length: 50,
          restAngle: Math.PI * 0.25,
          driver: 'physics',
          physics: {
            stiffness: 60,
            damping: 8,
          },
        },
      ],
    };
    secondaryMotion = new SecondaryMotion();
  });

  it('부모가 정지 상태일 때 충분한 시간이 지나면 restAngle(또는 중력 평형각)로 안정 수렴한다', () => {
    const parentAngles = { pelvis: -Math.PI / 2 };

    // 2초간 시뮬레이션
    for (let i = 0; i < 120; i++) {
      secondaryMotion.update(0.016, sampleRig, parentAngles);
    }

    const angles = secondaryMotion.getAngles();
    // 꼬리 각도가 NaN/Infinity 없이 안정적인 실수값으로 수렴
    expect(Number.isFinite(angles['tail_base'])).toBe(true);
    expect(Number.isFinite(angles['tail_tip'])).toBe(true);
    // 평형 상태에서 각속도는 0에 근접
    expect(secondaryMotion.getVelocity('tail_base')).toBeCloseTo(0, 1);
  });

  it('부모 본이 급격하게 회전할 때 보조 본은 관성에 의해 지연 추종(Lag)하며 출렁인다', () => {
    // 1단계: 초기 안정화
    for (let i = 0; i < 60; i++) {
      secondaryMotion.update(0.016, sampleRig, { pelvis: -Math.PI / 2 });
    }
    const initialTailAngle = secondaryMotion.getAngles()['tail_base'];

    // 2단계: 골반이 반대 방향으로 급회전 (1프레임 급격한 변화)
    secondaryMotion.update(0.016, sampleRig, { pelvis: Math.PI / 2 });
    const afterLagAngle = secondaryMotion.getAngles()['tail_base'];

    // 관성에 의해 즉각 동기화되지 않고 각속도가 발생하며 이전 각도 근처에 지연 잔류
    expect(secondaryMotion.getVelocity('tail_base')).not.toBe(0);
    expect(afterLagAngle).not.toBe(Math.PI / 2);
    expect(afterLagAngle).toBeCloseTo(initialTailAngle, 1);
  });

  it('관절 제한 범위(minAngle, maxAngle)를 절대 초과하지 않는다', () => {
    // 과도한 회전 외력을 가해도 minAngle(-PI/2)과 maxAngle(PI * 0.8) 범위 내로 클램프
    for (let i = 0; i < 60; i++) {
      secondaryMotion.update(0.016, sampleRig, { pelvis: Math.PI * 2.0 });
      const angle = secondaryMotion.getAngles()['tail_base'];
      expect(angle).toBeGreaterThanOrEqual(-Math.PI * 0.5 - 0.001);
      expect(angle).toBeLessThanOrEqual(Math.PI * 0.8 + 0.001);
    }
  });

  it('브라우저 탭 전환 등으로 인한 대형 dt(예: 2.0초) 스파이크 발생 시 폭주하지 않고 안전하게 캡핑된다', () => {
    // 2.0초의 비정상 대형 dt 입력
    secondaryMotion.update(2.0, sampleRig, { pelvis: 0 });

    const angle = secondaryMotion.getAngles()['tail_base'];
    const vel = secondaryMotion.getVelocity('tail_base');

    // NaN이나 비정상 무한대 없이 안전 클램프 유지
    expect(Number.isFinite(angle)).toBe(true);
    expect(Number.isFinite(vel)).toBe(true);
    expect(Math.abs(vel)).toBeLessThan(100);
  });

  it('reset 호출 시 모든 물리 본 상태가 초기화된다', () => {
    secondaryMotion.update(0.1, sampleRig, { pelvis: 1.0 });
    secondaryMotion.reset();

    const vel = secondaryMotion.getVelocity('tail_base');
    expect(vel).toBe(0);
  });
});
