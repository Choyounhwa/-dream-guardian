/**
 * SecondaryMotion - 보조 본(꼬리·귀·망토) 각도 스프링 2차 모션 물리 엔진
 *
 * Issue #686 / FEAT-RIG-003:
 * - driver: 'physics' 본의 각도 스프링 시뮬레이션 (stiffness, damping, gravity)
 * - 결정론적 고정 서브스텝 (Fixed Substepping)
 * - 관절 회전 제한 범위(minAngle, maxAngle) 준수
 * - 브라우저 탭 복귀 등 대형 dt 스파이크 시 폭주 방지 캡핑
 */

import type { CharacterRig, BoneDef } from '../../types/character-rig.js';
import { diffAngle } from '../pose/PoseAngleSolver.js';

export interface BonePhysicsState {
  currentAngle: number;
  angularVelocity: number;
}

export class SecondaryMotion {
  private _states: Map<string, BonePhysicsState> = new Map();

  /**
   * 본 물리 상태 초기화
   */
  public reset(): void {
    this._states.clear();
  }

  private _getOrCreateState(bone: BoneDef): BonePhysicsState {
    let state = this._states.get(bone.id);
    if (!state) {
      state = {
        currentAngle: bone.restAngle,
        angularVelocity: 0,
      };
      this._states.set(bone.id, state);
    }
    return state;
  }

  /**
   * 특정 본의 현재 각속도 조회
   */
  public getVelocity(boneId: string): number {
    return this._states.get(boneId)?.angularVelocity ?? 0;
  }

  /**
   * 현재 시뮬레이션된 모든 물리 본의 각도 맵 반환
   */
  public getAngles(): Record<string, number> {
    const result: Record<string, number> = {};
    for (const [id, state] of this._states.entries()) {
      result[id] = state.currentAngle;
    }
    return result;
  }

  /**
   * 델타 타임 및 부모 각도를 기반으로 2차 물리 모션을 갱신합니다.
   *
   * @param dt 프레임 경과 시간 (초)
   * @param rig 대상 캐릭터 리그
   * @param parentAngles 부모 본들의 현재 회전 각도 맵
   * @returns 갱신된 물리 본들의 각도 맵
   */
  public update(
    dt: number,
    rig: CharacterRig,
    parentAngles: Record<string, number>
  ): Record<string, number> {
    // 1. 대형 dt 스파이크(탭 전환 등) 폭주 방지 캡핑 (최대 0.1초 = 100ms)
    const clampedDt = Math.max(0, Math.min(dt, 0.1));
    if (clampedDt <= 0) {
      return this.getAngles();
    }

    // 2. 결정론적 서브스텝 계산 (약 1/120초 기준)
    const fixedDt = 1 / 120;
    const steps = Math.max(1, Math.min(8, Math.ceil(clampedDt / fixedDt)));
    const subDt = clampedDt / steps;

    const physicsBones = rig.bones.filter((b) => b.driver === 'physics');

    for (let step = 0; step < steps; step++) {
      for (const bone of physicsBones) {
        const state = this._getOrCreateState(bone);

        const parentAngle =
          bone.parent !== undefined && parentAngles[bone.parent] !== undefined
            ? parentAngles[bone.parent]
            : 0;

        // 목표 각도: 부모 본의 현재 각도 + 본 고유의 restAngle
        const targetAngle = parentAngle + bone.restAngle;

        const k = bone.physics?.stiffness ?? 80;
        const c = bone.physics?.damping ?? 10;
        const g = bone.physics?.gravity ?? 0;
        const mass = Math.max(0.1, bone.physics?.mass ?? 1.0);

        // 스프링 복원 토크
        const angleDiff = diffAngle(targetAngle, state.currentAngle);
        const springTorque = angleDiff * k;

        // 속도 감쇠 토크
        const dampingTorque = -state.angularVelocity * c;

        // 중력 토크 (하단 Math.PI / 2 방향 편향)
        let gravityTorque = 0;
        if (g !== 0) {
          const gravityDiff = diffAngle(Math.PI / 2, state.currentAngle);
          gravityTorque = gravityDiff * g;
        }

        const totalTorque = springTorque + dampingTorque + gravityTorque;
        const angularAcceleration = totalTorque / mass;

        // 오일러-크로머(Symplectic Euler) 적분
        state.angularVelocity += angularAcceleration * subDt;
        state.currentAngle += state.angularVelocity * subDt;

        // 관절 회전 제한(minAngle, maxAngle) 클램프
        if (bone.minAngle !== undefined && state.currentAngle < bone.minAngle) {
          state.currentAngle = bone.minAngle;
          if (state.angularVelocity < 0) state.angularVelocity = 0;
        }
        if (bone.maxAngle !== undefined && state.currentAngle > bone.maxAngle) {
          state.currentAngle = bone.maxAngle;
          if (state.angularVelocity > 0) state.angularVelocity = 0;
        }
      }
    }

    return this.getAngles();
  }
}
