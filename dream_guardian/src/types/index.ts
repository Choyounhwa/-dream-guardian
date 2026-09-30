// ─── Game State (Canonical FSM 14 states / Issue #214) ───
export type GameState =
  | 'LOADING'
  | 'MENU_MAIN'
  | 'MENU_SUB'
  | 'STORY_INTRO'
  | 'READY_POSITION'
  | 'RUN_QUESTION'
  | 'ANSWER_SELECT'
  | 'STAR_COLLECT'
  | 'HAZARD_EVADE'
  | 'ROUND_RESOLVE'
  | 'BOSS_CLIMAX'
  | 'RESULT'
  | 'GAMEOVER'
  | 'ENDING_CUTSCENE';

// ─── Event Map ───
export interface EventMap {
  'state:change': { from: GameState; to: GameState };
  'answer:correct': { mana: number; combo: number };
  'answer:wrong': { hp: number };
  'mana:full': { mana: number };
  'guardian:cast': { damage: number };
  'boss:hit': { bossHp: number };
  'boss:defeated': { chapter: number };
  'boss:attack': { damage: number };
  'player:hurt': { hp: number };
  'player:dead': undefined;
  'motion:run': { gauge: number };
  'motion:squat': undefined;
  'motion:jump': { boost: number };
  'gauge:full': undefined;
  'question:new': { question: string; choices: string[] };
  'shield:activate': undefined;
  'shield:deactivate': undefined;
  'combo:update': { combo: number };
}

// ─── System Lifecycle Interface ───
export interface ISystem {
  init?(): void | Promise<void>;
  update?(dt: number): void;
  render?(ctx: CanvasRenderingContext2D): void;
  destroy?(): void;
}

// ─── State Handler ───
export interface IStateHandler {
  enter?(): void;
  update?(dt: number): void;
  input?(data?: unknown): void;
  render?(ctx: CanvasRenderingContext2D): void;
  exit?(): void;
}

// ─── Game Config ───
export interface GameConfig {
  player: {
    maxHp: number;
    wrongDamage: number;
    bossAttackDamage: number;
  };
  mana: {
    correctReward: number;
    spellCost: number;
  };
  battle: {
    correctDamage: number;
    spellDamage: number;
    bossHpNormal: number;
    bossHpNightmare: number;
    phaseAQuestionCount?: number;
    phaseAMinBossHp?: number;
    initialMinions?: number;
    maxMinions?: number;
    minionsPerCorrect?: number;
    stardustReward?: {
      Perfect: number;
      Good: number;
      Late: number;
      Miss: number;
    };
  };
  motion: {
    squatThreshold: number;
    jumpThreshold: number;
    jumpSpeedMin: number;
    runBounceMin: number;
    stepInterval: number;
    hipBounceMin?: number;
    hipSwayMin?: number;
    armCrossMin?: number;
  };
  input: {
    dwellTime: number;
    centerWeight: number;
    edgeWeight: number;
  };
  render: {
    virtualWidth: number;
    virtualHeight: number;
  };
}

// ─── Question Data ───
export interface QuestionRecord {
  level: number;
  subLevel: number;
  levelTitle: string;
  subLevelTitle: string;
  questionTemplate: string;
  answerEval: string;
  wrongEval: string;
  varA: string;
  varB: string;
  varC: string;
  varD: string;
  shapeCode: string;
}

/** 세부 단계 정보 */
export interface SubLevelInfo {
  subLevel: number;
  title: string;
  count: number;
}

/** 생성된 문제 데이터 */
export interface GeneratedQuestion {
  questionText: string;
  correctAnswer: number | string;
  wrongAnswer: number | string;
  choices: [number | string, number | string];
  correctIndex: number;
  shapeCode?: string;
}

// ─── Save Data ───
export interface SaveData {
  progress: number;
  stars: Record<number, number>;
  stats: {
    totalSteps: number;
    totalSquats: number;
    totalJumps: number;
    totalCalories: number;
    totalClears: number;
  };
  history: SessionRecord[];
}

export interface SessionRecord {
  date: string;
  chapter: number;
  score: number;
  grade: number;
  time: number;
  steps: number;
  squats: number;
  calories: number;
}

// ─── Pose Landmark ───
export interface NormalizedLandmark {
  x: number; // 0~1 (정규화 좌표)
  y: number;
  z: number;
  visibility: number; // 0~1 (신뢰도)
}

/** MediaPipe Pose 33개 랜드마크 인덱스 */
export const POSE_LANDMARKS = {
  NOSE: 0,
  LEFT_EYE_INNER: 1,
  LEFT_EYE: 2,
  LEFT_EYE_OUTER: 3,
  RIGHT_EYE_INNER: 4,
  RIGHT_EYE: 5,
  RIGHT_EYE_OUTER: 6,
  LEFT_EAR: 7,
  RIGHT_EAR: 8,
  MOUTH_LEFT: 9,
  MOUTH_RIGHT: 10,
  LEFT_SHOULDER: 11,
  RIGHT_SHOULDER: 12,
  LEFT_ELBOW: 13,
  RIGHT_ELBOW: 14,
  LEFT_WRIST: 15,
  RIGHT_WRIST: 16,
  LEFT_PINKY: 17,
  RIGHT_PINKY: 18,
  LEFT_INDEX: 19,
  RIGHT_INDEX: 20,
  LEFT_THUMB: 21,
  RIGHT_THUMB: 22,
  LEFT_HIP: 23,
  RIGHT_HIP: 24,
  LEFT_KNEE: 25,
  RIGHT_KNEE: 26,
  LEFT_ANKLE: 27,
  RIGHT_ANKLE: 28,
  LEFT_HEEL: 29,
  RIGHT_HEEL: 30,
  LEFT_FOOT_INDEX: 31,
  RIGHT_FOOT_INDEX: 32,
} as const;

/** 스켈레톤 뼈대 연결 정의 (쌍 배열) */
export const SKELETON_CONNECTIONS: readonly [number, number][] = [
  // 몸통
  [POSE_LANDMARKS.LEFT_SHOULDER, POSE_LANDMARKS.RIGHT_SHOULDER],
  [POSE_LANDMARKS.LEFT_SHOULDER, POSE_LANDMARKS.LEFT_HIP],
  [POSE_LANDMARKS.RIGHT_SHOULDER, POSE_LANDMARKS.RIGHT_HIP],
  [POSE_LANDMARKS.LEFT_HIP, POSE_LANDMARKS.RIGHT_HIP],
  // 왼팔
  [POSE_LANDMARKS.LEFT_SHOULDER, POSE_LANDMARKS.LEFT_ELBOW],
  [POSE_LANDMARKS.LEFT_ELBOW, POSE_LANDMARKS.LEFT_WRIST],
  // 오른팔
  [POSE_LANDMARKS.RIGHT_SHOULDER, POSE_LANDMARKS.RIGHT_ELBOW],
  [POSE_LANDMARKS.RIGHT_ELBOW, POSE_LANDMARKS.RIGHT_WRIST],
  // 왼다리
  [POSE_LANDMARKS.LEFT_HIP, POSE_LANDMARKS.LEFT_KNEE],
  [POSE_LANDMARKS.LEFT_KNEE, POSE_LANDMARKS.LEFT_ANKLE],
  // 오른다리
  [POSE_LANDMARKS.RIGHT_HIP, POSE_LANDMARKS.RIGHT_KNEE],
  [POSE_LANDMARKS.RIGHT_KNEE, POSE_LANDMARKS.RIGHT_ANKLE],
];

/** 관절 마커 스타일 */
export interface JointStyle {
  color: string;
  size: number;
  shape: 'circle' | 'diamond' | 'square';
}

/** 스켈레톤 설정 */
export interface SkeletonConfig {
  /** 신뢰도 임계값 (이하면 무시) */
  visibilityThreshold: number;
  /** 보간(lerp) 계수 (0~1, 1이면 즉시) */
  lerpFactor: number;
  /** 호흡 펄스 주기 (초) */
  breathCycle: number;
  /** 호흡 진폭 (스케일 배수) */
  breathAmplitude: number;
  /** 뼈대 라인 두께 */
  boneWidth: number;
  /** 뼈대 색상 */
  boneColor: string;
  /** 관절별 스타일 맵 */
  joints: Record<string, JointStyle>;
}

// ─── Math Rendering Types ───
export type MathToken =
  | { type: 'text'; text: string }
  | { type: 'fraction'; whole?: string; num: string; den: string }
  | { type: 'power'; base: string; exp: string }
  | { type: 'sqrt'; radicand: string }
  | { type: 'subscript'; base: string; sub: string }
  | { type: 'placeholder'; label: string }
  | { type: 'operator'; op: string };

export interface MathRenderOptions {
  fontSize: number;
  fontFamily?: string;
  color?: string;
  fractionLineColor?: string;
  placeholderColor?: string;
  placeholderBgColor?: string;
  align?: 'left' | 'center' | 'right';
  baseline?: 'top' | 'middle' | 'bottom';
  maxWidth?: number;
  maxHeight?: number;
  minFontSize?: number;
  lineHeight?: number;
}

// ─── Posture & Fitness System Types (Issue #122 / #123) ───
export * from './posture.js';

