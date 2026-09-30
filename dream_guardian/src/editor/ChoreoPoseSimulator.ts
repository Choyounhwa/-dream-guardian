/**
 * ChoreoPoseSimulator.ts - 타임라인 비트 연동 실시간 안무 시뮬레이션 및 포즈 프레임 계산기
 *
 * 명세서 (docs/06_DANCE_CHOREO_EDITOR_SPEC.md 3.3, 3.4절):
 * - RUN_QUESTION: 8박 바운스 (홀수 박 rebound, 짝수 박 dip)
 * - ANSWER_SELECT: 2박 좌우 도달 (Zone 4 - 0번, Zone 5 - 1번)
 * - STAR_COLLECT: 7박 키노트 노트 타깃 추적
 * - FEVER_PHASE_B: 4대 핵심 패턴(16박 풀루프) 순환 애니메이션
 */

import { DEFAULT_FITNESS_ZONES } from '../../config/zone.config.js';
import type {
  CatChoreoPattern,
  DanceMotionType,
  DancePatternRegistry,
} from '../data/danceRoutineData.js';
import type { PhaseType } from './EditorState.js';
import type { TimelineTrackNote } from './PhaseSequenceEditor.js';

export interface JointPoint {
  x: number;
  y: number;
}

export interface SimulatedPoseFrame {
  phase: PhaseType;
  currentBeat: number;
  activePattern: CatChoreoPattern;
  activeNote: TimelineTrackNote | null;
  motionType: DanceMotionType;
  bounceOffset: number; // -1.0 ~ 1.0 (양수: 하강 dip, 음수: 상승 rebound)
  targetZones: number[];
  jointPositions: {
    leftHand: JointPoint;
    rightHand: JointPoint;
    head: JointPoint;
    hip: JointPoint;
    leftFoot: JointPoint;
    rightFoot: JointPoint;
  };
  isDip: boolean;
}

export interface SimulationParams {
  phase: PhaseType;
  currentBeat: number;
  selectedPattern: CatChoreoPattern | null | undefined;
  notes: TimelineTrackNote[];
  registry: DancePatternRegistry;
}

export class ChoreoPoseSimulator {
  /**
   * 피트니스 존 ID에 해당하는 정규화 중심 좌표(0..1) 반환
   */
  getZoneCenter(zoneId: number | null): JointPoint | null {
    if (zoneId === null) return null;
    const zone = DEFAULT_FITNESS_ZONES.find((z) => z.id === zoneId);
    if (!zone) return null;
    return {
      x: zone.x + zone.width / 2,
      y: zone.y + zone.height / 2,
    };
  }

  /**
   * 현재 재생 비트 및 페이즈에 따른 실시간 포즈 프레임 계산
   */
  computeLiveFrame(params: SimulationParams): SimulatedPoseFrame {
    const { phase, currentBeat, selectedPattern, notes, registry } = params;

    // 1. 활성 노트 검출
    const activeNote = this.findActiveNote(currentBeat, notes);

    // 2. 페이즈 및 노트에 따른 활성 안무 패턴 결정
    const activePattern = this.resolveActivePattern(phase, currentBeat, selectedPattern, activeNote, registry);

    // 3. 바운스 오프셋 및 dip 여부 계산
    const { bounceOffset, isDip } = this.calculateBounce(phase, currentBeat, activeNote);

    // 4. 타깃 피트니스 존 목록 결정
    const targetZones = this.resolveTargetZones(phase, activeNote, activePattern);

    // 5. 부위별 관절 좌표 계산 (바운스 오프셋 및 키노트 타깃 도달 반영)
    const jointPositions = this.calculateJointPositions(activePattern, bounceOffset, activeNote);

    return {
      phase,
      currentBeat,
      activePattern,
      activeNote,
      motionType: activePattern.motionType,
      bounceOffset,
      targetZones,
      jointPositions,
      isDip,
    };
  }

  /**
   * 현재 비트에 해당하는 활성 노트 검색
   */
  private findActiveNote(currentBeat: number, notes: TimelineTrackNote[]): TimelineTrackNote | null {
    for (let i = notes.length - 1; i >= 0; i--) {
      const note = notes[i];
      if (currentBeat >= note.startBeat && currentBeat < note.startBeat + note.durationBeats) {
        return note;
      }
    }
    // 정확한 매칭이 없으면 가장 가까운 이전 노트 또는 1박 노트 폴백
    if (notes.length > 0) {
      const floorBeat = Math.floor(currentBeat);
      const matchFloor = notes.find((n) => Math.floor(n.startBeat) === floorBeat);
      if (matchFloor) return matchFloor;
      return notes[0];
    }
    return null;
  }

  /**
   * 페이즈별 활성 패턴 결정
   */
  private resolveActivePattern(
    phase: PhaseType,
    currentBeat: number,
    selectedPattern: CatChoreoPattern | null | undefined,
    activeNote: TimelineTrackNote | null,
    registry: DancePatternRegistry
  ): CatChoreoPattern {
    const defaultPattern = selectedPattern ?? registry.get('CAT_LOW_BOUNCE')!;

    if (phase === 'FEVER_PHASE_B') {
      // 16박 루프: 1..4 (LOW_BOUNCE), 5..8 (SKY_RIGHT), 9..12 (CENTER_CLASP), 13..16 (SKY_LEFT)
      const b = ((currentBeat - 1) % 16) + 1;
      if (b >= 1 && b < 5) return registry.get('CAT_LOW_BOUNCE') ?? defaultPattern;
      if (b >= 5 && b < 9) return registry.get('CAT_SKY_POINT_RIGHT') ?? defaultPattern;
      if (b >= 9 && b < 13) return registry.get('CAT_CENTER_CLASP') ?? defaultPattern;
      return registry.get('CAT_SKY_POINT_LEFT') ?? defaultPattern;
    }

    if (phase === 'STAR_COLLECT' && activeNote?.payload?.patternId) {
      const pattern = registry.get(activeNote.payload.patternId);
      if (pattern) return pattern;
    }

    return defaultPattern;
  }

  /**
   * 바운스 모션 오프셋 및 dip 여부 계산
   */
  private calculateBounce(
    phase: PhaseType,
    currentBeat: number,
    activeNote: TimelineTrackNote | null
  ): { bounceOffset: number; isDip: boolean } {
    const subBeat = currentBeat % 1.0;
    // 반 비트 주기의 부드러운 사인 커브 (0 -> 1 -> 0)
    const wave = Math.sin(subBeat * Math.PI);

    let isDip = false;
    let bounceOffset = 0;

    if (phase === 'RUN_QUESTION') {
      const isDipBeat = activeNote ? activeNote.payload?.action === 'dip' : Math.floor(currentBeat) % 2 === 0;
      isDip = isDipBeat;
      if (isDip) {
        // 딥(스쿼트): 아래로 0.35 하강
        bounceOffset = 0.25 + 0.15 * wave;
      } else {
        // 리바운드(업): 위로 -0.15 탄력
        bounceOffset = -0.1 * wave;
      }
    } else {
      // 일반 페이즈: 부드러운 95 BPM 그루브 바운스
      bounceOffset = 0.1 * Math.sin(currentBeat * Math.PI);
    }

    return { bounceOffset, isDip };
  }

  /**
   * 타깃 피트니스 존 목록 결정
   */
  private resolveTargetZones(
    _phase: PhaseType,
    activeNote: TimelineTrackNote | null,
    activePattern: CatChoreoPattern
  ): number[] {
    if (activeNote && activeNote.targetZones.length > 0) {
      return [...activeNote.targetZones];
    }
    // 노트에 없으면 패턴의 할당된 존들 반환
    const zones: number[] = [];
    if (activePattern.leftHand) zones.push(activePattern.leftHand);
    if (activePattern.rightHand) zones.push(activePattern.rightHand);
    if (activePattern.head) zones.push(activePattern.head);
    if (activePattern.hip) zones.push(activePattern.hip);
    return zones;
  }

  /**
   * 관절 위치 계산 (정규화 0..1 좌표 및 바운스 오프셋 적용)
   */
  private calculateJointPositions(
    pattern: CatChoreoPattern,
    bounceOffset: number,
    activeNote?: TimelineTrackNote | null
  ): SimulatedPoseFrame['jointPositions'] {
    const yShift = bounceOffset * 0.08;

    // 기본 휴식 위치
    const defaultHead: JointPoint = { x: 0.5, y: 0.2 };
    const defaultHip: JointPoint = { x: 0.5, y: 0.65 };
    const defaultLH: JointPoint = { x: 0.35, y: 0.5 };
    const defaultRH: JointPoint = { x: 0.65, y: 0.5 };
    const defaultLF: JointPoint = { x: 0.38, y: 0.86 };
    const defaultRF: JointPoint = { x: 0.62, y: 0.86 };

    let headPos = this.getZoneCenter(pattern.head) ?? defaultHead;
    let hipPos = this.getZoneCenter(pattern.hip) ?? defaultHip;
    let lhPos = this.getZoneCenter(pattern.leftHand) ?? defaultLH;
    let rhPos = this.getZoneCenter(pattern.rightHand) ?? defaultRH;

    // 활성 키노트 노트가 특정 신체 부위 및 타깃 존을 가리킬 때 동적 도달 반영
    if (activeNote) {
      const notePart = activeNote.payload?.part || activeNote.payload?.targetPart;
      const targetZoneId =
        activeNote.targetZones && activeNote.targetZones.length > 0
          ? activeNote.targetZones[0]
          : activeNote.payload?.zoneId;

      if (notePart && targetZoneId) {
        const targetCenter = this.getZoneCenter(targetZoneId);
        if (targetCenter) {
          if (notePart === 'leftHand') lhPos = targetCenter;
          else if (notePart === 'rightHand') rhPos = targetCenter;
          else if (notePart === 'head') headPos = targetCenter;
          else if (notePart === 'hip') hipPos = targetCenter;
        }
      }
    }

    // 발 위치: footZones 기반
    let lfPos = defaultLF;
    let rfPos = defaultRF;
    if (pattern.footZones && pattern.footZones.length > 0) {
      if (pattern.footZones.includes(9)) {
        const z = this.getZoneCenter(9);
        if (z) lfPos = z;
      }
      if (pattern.footZones.includes(11)) {
        const z = this.getZoneCenter(11);
        if (z) rfPos = z;
      }
      if (pattern.footZones.includes(10) && pattern.footZones.length === 1) {
        const z = this.getZoneCenter(10);
        if (z) {
          lfPos = { x: z.x - 0.06, y: z.y };
          rfPos = { x: z.x + 0.06, y: z.y };
        }
      }
    }

    return {
      head: { x: headPos.x, y: headPos.y + yShift * 0.8 },
      hip: { x: hipPos.x, y: hipPos.y + yShift },
      leftHand: { x: lhPos.x, y: lhPos.y + yShift * 0.5 },
      rightHand: { x: rhPos.x, y: rhPos.y + yShift * 0.5 },
      leftFoot: lfPos,
      rightFoot: rfPos,
    };
  }
}

export const choreoPoseSimulator = new ChoreoPoseSimulator();
