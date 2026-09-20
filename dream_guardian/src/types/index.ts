// ─── Game State (FSM 13 states) ───
export type GameState =
  | 'LOADING'
  | 'MENU_MAIN'
  | 'MENU_SUB'
  | 'STORY_INTRO'
  | 'READY_POSITION'
  | 'RUNNING'
  | 'PLAYING'
  | 'CORRECT'
  | 'WRONG'
  | 'GUARDIAN_CAST'
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
    spellDamage: number;
    bossHpNormal: number;
    bossHpNightmare: number;
  };
  motion: {
    squatThreshold: number;
    jumpThreshold: number;
    jumpSpeedMin: number;
    runBounceMin: number;
    stepInterval: number;
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
