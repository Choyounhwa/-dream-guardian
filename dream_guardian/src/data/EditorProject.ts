/**
 * EditorProject.ts - V2 피트니스 안무 및 타임라인 에디터 저작 원본 타입 정의
 *
 * Issue #375 / EDITOR-SCHEMA:
 * - kind: 'dream-guardian-authoring-project'
 * - schemaVersion: 2
 * - 페이즈(phaseA / phaseB)와 종류(kind)별 시퀀스 및 이벤트 분리
 * - 런타임/컴파일 상태 및 UI 상태 배제
 * - 신체 커서(손/머리/골반)와 발(foot) 타겟 구별
 */

export const AUTHORING_PROJECT_KIND = 'dream-guardian-authoring-project' as const;
export const AUTHORING_SCHEMA_VERSION = 2 as const;

export type AuthoringProjectKind = typeof AUTHORING_PROJECT_KIND;
export type AuthoringSchemaVersion = typeof AUTHORING_SCHEMA_VERSION;

export interface EditorProjectMetadata {
  title: string;
  description?: string;
  author?: string;
  createdAt: string;
  updatedAt: string;
}

export interface EditorPreviewTempo {
  bpm: number;
  beatsPerBar: number;
}

export interface EditorPatternTarget {
  leftHand?: number | null;
  rightHand?: number | null;
  head?: number | null;
  hip?: number | null;
}

export interface EditorPattern {
  id: string;
  name: string;
  target: EditorPatternTarget;
  description?: string;
}

export type SequencePhase = 'phaseA' | 'phaseB';

export type PhaseASequenceKind = 'motionGuide' | 'starNotes' | 'hazard';
export type PhaseBSequenceKind = 'motionGuide' | 'feverNotes' | 'hazard';
export type SequenceKind = 'motionGuide' | 'starNotes' | 'feverNotes' | 'hazard';

export interface MotionCueEvent {
  id?: string;
  eventId?: string;
  kind?: 'motionCue';
  startTick?: number;
  tick?: number;
  durationTicks?: number;
  duration?: number;
  target?: EditorPatternTarget;
  sourcePatternId?: string;
}

export interface CursorStarTarget {
  type: 'cursor';
  part: 'leftHand' | 'rightHand' | 'head' | 'hip';
  zoneId: number;
}

export interface FootStarTarget {
  type: 'foot';
  foot: 'leftFoot' | 'rightFoot' | 'centerFoot';
  zoneId: 9 | 10 | 11;
}

export type StarNoteTarget = CursorStarTarget | FootStarTarget;

export interface StarNoteEvent {
  id?: string;
  eventId?: string;
  kind?: 'starNote';
  landingTick?: number;
  tick?: number;
  target: StarNoteTarget;
  sourcePatternId?: string;
}

export interface FeverNoteEvent {
  id?: string;
  eventId?: string;
  kind?: 'feverNote' | 'starNote';
  landingTick?: number;
  tick?: number;
  target: StarNoteTarget;
  sourcePatternId?: string;
}

export interface PhaseAHazardEvent {
  id?: string;
  eventId?: string;
  kind?: 'phaseAHazard' | 'hazard';
  hazardType: string;
}

export interface PhaseBHazardEvent {
  id?: string;
  eventId?: string;
  kind?: 'phaseBHazard' | 'hazard';
  attackType?: string;
  hazardType?: string;
}

export type SequenceEvent =
  | MotionCueEvent
  | StarNoteEvent
  | FeverNoteEvent
  | PhaseAHazardEvent
  | PhaseBHazardEvent;

export interface EditorSequence {
  id: string;
  name?: string;
  phase: SequencePhase;
  kind: SequenceKind;
  events: SequenceEvent[];
}

export interface EditorBinding {
  chapterId: string;
  subLevelId: string | null;
  phase: SequencePhase;
  sequenceId: string;
  role?: string;
}

export interface EditorProject {
  kind: AuthoringProjectKind;
  schemaVersion: AuthoringSchemaVersion;
  projectId: string;
  revision: number;
  rulesetId: string;
  metadata: EditorProjectMetadata;
  previewTempo: EditorPreviewTempo;
  patterns: EditorPattern[];
  sequences: EditorSequence[];
  bindings: EditorBinding[];
}
