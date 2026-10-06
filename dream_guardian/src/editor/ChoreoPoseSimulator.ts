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
import { DEFAULT_STAR_TIMING_WINDOWS } from '../../config/beat-motion.config.js';
import type {
  CatChoreoPattern,
  DanceMotionType,
  DancePatternRegistry,
} from '../data/danceRoutineData.js';
import type { PhaseType } from './EditorState.js';
import type { TimelineTrackNote } from './PhaseSequenceEditor.js';
import type { BodyCursorPart } from './PoseConstraintValidator.js';
import type { EditorProject } from '../data/EditorProject.js';
import { compileEditorProject } from '../data/ContentCompiler.js';
import {
  calculateStarNoteTimings,
  type StarNoteTimingPlan,
} from '../data/ContentTiming.js';
import { tickToBeat } from '../data/ContentCapabilities.js';

export interface JointPoint {
  x: number;
  y: number;
}

export interface CompiledTimelineEvent {
  id: string;
  type: 'star_note' | 'hazard' | 'motion_cue' | 'fever_note';
  slotIndex?: number;
  landingBeat: number;
  landingTick: number;
  targetTimeSeconds: number;
  toleranceWindowSeconds: number;
  windowStartSeconds: number;
  windowEndSeconds: number;
  targetZone: number;
  targetZones: number[];
  targetBodyPart: BodyCursorPart | 'foot';
  sourcePatternId?: string;
  label?: string;
  isLanding: boolean;
  partZoneMap?: Record<string, number>;
}

export interface CompiledPreviewState {
  previewMode: 'compiled_runtime' | 'guide_simulation';
  isCompiled: boolean;
  compilerSuccess: boolean;
  isGuideOnly: true; // explicit: "실제 웹캠 인식 성공을 보장하지 않음 (가이드 전용)"
  diagnosticMessage?: string;
  bpm: number;
  secondsPerBeat: number;
  currentTimeSeconds: number;
  currentBeat: number;
  totalDurationSeconds: number;
  lastLandingTimeSeconds: number;
  completeAtSeconds: number;
  toleranceWindowSeconds: number;
  events: CompiledTimelineEvent[];
  activeEvent: CompiledTimelineEvent | null;
  stageKey?: string;
  phase: PhaseType;
}

export interface CompiledSimulationParams {
  phase: PhaseType;
  currentBeat: number;
  currentTimeSeconds?: number;
  bpm: number;
  selectedPattern: CatChoreoPattern | null | undefined;
  notes: TimelineTrackNote[];
  registry: DancePatternRegistry;
  compiledState?: CompiledPreviewState;
}

export interface SimulatedPoseFrame {
  phase: PhaseType;
  currentBeat: number;
  currentTimeSeconds?: number;
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
  previewMode?: 'compiled_runtime' | 'guide_simulation';
  compiledPreview?: CompiledPreviewState;
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
   * 컴파일 결과 및 지정된 BPM/시간을 기반으로 가이드 및 런타임 호환 미리보기 상태 산출 (#392)
   */
  buildCompiledPreviewState(options: {
    project: EditorProject;
    phase: PhaseType;
    bpm: number;
    currentBeat: number;
    currentTimeSeconds?: number;
    stageKey?: string;
  }): CompiledPreviewState {
    const { project, phase, bpm, currentBeat } = options;
    const spb = 60 / bpm;
    const currentTimeSeconds =
      options.currentTimeSeconds !== undefined
        ? options.currentTimeSeconds
        : Math.max(0, (currentBeat - 1) * spb);

    let timings: StarNoteTimingPlan;
    try {
      timings = calculateStarNoteTimings(bpm);
    } catch {
      timings = {
        bpm,
        secondsPerBeat: spb,
        totalDurationSeconds: 8 * spb,
        completeAtSeconds: 7 * spb + (DEFAULT_STAR_TIMING_WINDOWS?.late ?? 0.40),
        timingWindows: DEFAULT_STAR_TIMING_WINDOWS,
        notes: [],
        valid: false,
        error: `Unsupported BPM: ${bpm}`,
      };
    }

    // 컴파일러 실행 (순수 읽기 전용 시뮬레이션)
    const compileResult = compileEditorProject(project);

    if (!compileResult.success) {
      const diagnosticMsg =
        compileResult.diagnostics && compileResult.diagnostics.length > 0
          ? compileResult.diagnostics.map((d) => d.message).join('; ')
          : '프로젝트 컴파일 유효성 검증 미통과';

      return {
        previewMode: 'compiled_runtime',
        isCompiled: false,
        compilerSuccess: false,
        isGuideOnly: true,
        diagnosticMessage: diagnosticMsg,
        bpm,
        secondsPerBeat: spb,
        currentTimeSeconds,
        currentBeat,
        totalDurationSeconds: timings.totalDurationSeconds,
        lastLandingTimeSeconds: 7 * spb,
        completeAtSeconds: timings.completeAtSeconds,
        toleranceWindowSeconds: DEFAULT_STAR_TIMING_WINDOWS.late,
        events: [],
        activeEvent: null,
        stageKey: options.stageKey,
        phase,
      };
    }

    const pack = compileResult.pack;
    const stages = pack?.stages ?? {};
    const targetStageKey =
      options.stageKey ??
      (project.bindings && project.bindings[0]?.chapterId) ??
      Object.keys(stages)[0] ??
      'ch1';
    const stageBundle = stages[targetStageKey];

    const events: CompiledTimelineEvent[] = [];

    if (phase === 'STAR_COLLECT') {
      const starNotes = stageBundle?.phaseA?.starNotes ?? [];
      for (let idx = 0; idx < starNotes.length; idx++) {
        const note = starNotes[idx];
        const slotIdx = note.slotIndex !== undefined ? note.slotIndex : idx;
        const landingBeat = note.landingBeat;
        const landingTick = note.landingTick;
        const targetTimeSeconds = (slotIdx + 1) * spb;
        const toleranceWindowSeconds = DEFAULT_STAR_TIMING_WINDOWS.late;
        const windowStartSeconds = Math.max(0, targetTimeSeconds - toleranceWindowSeconds);
        const windowEndSeconds = targetTimeSeconds + toleranceWindowSeconds;
        const targetZone = note.target.zoneId;
        const targetBodyPart: BodyCursorPart | 'foot' =
          note.target.part === 'leftHand' ||
          note.target.part === 'rightHand' ||
          note.target.part === 'head' ||
          note.target.part === 'hip'
            ? note.target.part
            : note.target.instrument === 'foot'
            ? 'foot'
            : targetZone >= 6
            ? 'hip'
            : 'leftHand';

        const isLanding =
          currentTimeSeconds >= windowStartSeconds && currentTimeSeconds <= windowEndSeconds;

        events.push({
          id: note.id,
          type: 'star_note',
          slotIndex: slotIdx,
          landingBeat,
          landingTick,
          targetTimeSeconds,
          toleranceWindowSeconds,
          windowStartSeconds,
          windowEndSeconds,
          targetZone,
          targetZones: [targetZone],
          targetBodyPart,
          sourcePatternId: note.sourcePatternId,
          isLanding,
          partZoneMap: note.resolvedPartZoneMap,
          label: `별노트 #${slotIdx + 1}`,
        });
      }
    } else if (phase === 'FEVER_PHASE_B') {
      const feverNotes = stageBundle?.phaseB?.feverNotes ?? [];
      for (let idx = 0; idx < feverNotes.length; idx++) {
        const note = feverNotes[idx];
        const landingBeat = tickToBeat(note.landingTick);
        const targetTimeSeconds = landingBeat * spb;
        const toleranceWindowSeconds = DEFAULT_STAR_TIMING_WINDOWS.late;
        const windowStartSeconds = Math.max(0, targetTimeSeconds - toleranceWindowSeconds);
        const windowEndSeconds = targetTimeSeconds + toleranceWindowSeconds;
        const targetZone = note.target.zoneId;
        const targetBodyPart: BodyCursorPart | 'foot' =
          note.target.part ?? (targetZone >= 6 ? 'hip' : 'leftHand');
        const isLanding =
          currentTimeSeconds >= windowStartSeconds && currentTimeSeconds <= windowEndSeconds;

        events.push({
          id: note.id,
          type: 'fever_note',
          slotIndex: idx,
          landingBeat,
          landingTick: note.landingTick,
          targetTimeSeconds,
          toleranceWindowSeconds,
          windowStartSeconds,
          windowEndSeconds,
          targetZone,
          targetZones: [targetZone],
          targetBodyPart,
          sourcePatternId: note.sourcePatternId,
          isLanding,
          partZoneMap: note.resolvedPartZoneMap,
          label: `피버노트 #${idx + 1}`,
        });
      }
    }

    // 활성 이벤트 판별:
    // 1) 현재 착지 판정창 내에 있는 이벤트 우선
    // 2) 없으면 현재 시간과 가장 가까운 이벤트
    let activeEvent = events.find((e) => e.isLanding) ?? null;
    if (!activeEvent && events.length > 0) {
      const closest = events.reduce((best, curr) => {
        const distCurr = Math.abs(curr.targetTimeSeconds - currentTimeSeconds);
        const distBest = Math.abs(best.targetTimeSeconds - currentTimeSeconds);
        return distCurr < distBest ? curr : best;
      }, events[0]);
      if (Math.abs(closest.targetTimeSeconds - currentTimeSeconds) <= spb * 1.5) {
        activeEvent = closest;
      }
    }

    return {
      previewMode: 'compiled_runtime',
      isCompiled: true,
      compilerSuccess: true,
      isGuideOnly: true,
      bpm,
      secondsPerBeat: spb,
      currentTimeSeconds,
      currentBeat,
      totalDurationSeconds: timings.totalDurationSeconds,
      lastLandingTimeSeconds: 7 * spb,
      completeAtSeconds: timings.completeAtSeconds,
      toleranceWindowSeconds: DEFAULT_STAR_TIMING_WINDOWS.late,
      events,
      activeEvent,
      stageKey: targetStageKey,
      phase,
    };
  }

  /**
   * 컴파일된 이벤트 기반 런타임 호환 자세 및 타임라인 프레임 계산 (#392)
   */
  computeCompiledFrame(params: CompiledSimulationParams): SimulatedPoseFrame {
    const { phase, currentBeat, selectedPattern, notes, registry, compiledState } = params;

    const baseFrame = this.computeLiveFrame({
      phase,
      currentBeat,
      selectedPattern,
      notes,
      registry,
    });

    if (!compiledState) {
      return {
        ...baseFrame,
        previewMode: 'compiled_runtime',
      };
    }

    const activeEvt = compiledState.activeEvent;
    if (!activeEvt) {
      return {
        ...baseFrame,
        previewMode: 'compiled_runtime',
        compiledPreview: compiledState,
      };
    }

    // 타깃 존 설정
    const targetZones =
      activeEvt.targetZones && activeEvt.targetZones.length > 0
        ? activeEvt.targetZones
        : [activeEvt.targetZone];

    // 관절 위치 산출: 착지 윈도우 내 또는 근접 시 타깃 도달
    const jointPositions = { ...baseFrame.jointPositions };
    const targetCenter = this.getZoneCenter(activeEvt.targetZone);

    if (targetCenter) {
      if (activeEvt.targetBodyPart === 'leftHand') {
        jointPositions.leftHand = targetCenter;
      } else if (activeEvt.targetBodyPart === 'rightHand') {
        jointPositions.rightHand = targetCenter;
      } else if (activeEvt.targetBodyPart === 'head') {
        jointPositions.head = targetCenter;
      } else if (activeEvt.targetBodyPart === 'hip') {
        jointPositions.hip = targetCenter;
      } else if (activeEvt.targetBodyPart === 'foot') {
        if (activeEvt.targetZone === 9) jointPositions.leftFoot = targetCenter;
        else if (activeEvt.targetZone === 11) jointPositions.rightFoot = targetCenter;
        else {
          jointPositions.leftFoot = { x: targetCenter.x - 0.06, y: targetCenter.y };
          jointPositions.rightFoot = { x: targetCenter.x + 0.06, y: targetCenter.y };
        }
      }
    }

    // 부가 관절 맵핑(partZoneMap)이 있는 경우 적용
    if (activeEvt.partZoneMap) {
      for (const [part, zoneId] of Object.entries(activeEvt.partZoneMap)) {
        const center = this.getZoneCenter(zoneId);
        if (!center) continue;
        if (part === 'leftHand') jointPositions.leftHand = center;
        else if (part === 'rightHand') jointPositions.rightHand = center;
        else if (part === 'head') jointPositions.head = center;
        else if (part === 'hip') jointPositions.hip = center;
        else if (part === 'foot' || part === 'leftFoot') jointPositions.leftFoot = center;
        else if (part === 'rightFoot') jointPositions.rightFoot = center;
      }
    }

    return {
      ...baseFrame,
      targetZones,
      jointPositions,
      previewMode: 'compiled_runtime',
      compiledPreview: compiledState,
    };
  }

  /**
   * 현재 비트에 해당하는 활성 노트 검색 (#382: 시작 리드인 null, 8박 초과 마지막 노트 클램핑)
   */
  private findActiveNote(currentBeat: number, notes: TimelineTrackNote[]): TimelineTrackNote | null {
    if (notes.length === 0) return null;

    const sorted = [...notes].sort((a, b) => a.startBeat - b.startBeat);
    const firstNote = sorted[0];
    const lastNote = sorted[sorted.length - 1];

    // 첫 번째 노트 이전(예: STAR_COLLECT 1.0 리드인 구간)은 활성 노트 없음
    if (currentBeat < firstNote.startBeat) {
      return null;
    }

    // 마지막 노트 종료 비트 이후(8박 초과 여유 구간)는 마지막 노트로 클램핑 유지
    if (currentBeat >= lastNote.startBeat + lastNote.durationBeats) {
      return lastNote;
    }

    // 구간 내 [startBeat, startBeat + durationBeats) 역순 검색 (상위 레이어 우선)
    for (let i = sorted.length - 1; i >= 0; i--) {
      const note = sorted[i];
      if (currentBeat >= note.startBeat && currentBeat < note.startBeat + note.durationBeats) {
        return note;
      }
    }

    // 정수 박 기준 일치 검출 폴백
    const floorBeat = Math.floor(currentBeat);
    const matchFloor = sorted.find((n) => Math.floor(n.startBeat) === floorBeat);
    if (matchFloor) return matchFloor;

    // 이전 노트 중 가장 최근 노트 폴백
    for (let i = sorted.length - 1; i >= 0; i--) {
      if (currentBeat >= sorted[i].startBeat) {
        return sorted[i];
      }
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
