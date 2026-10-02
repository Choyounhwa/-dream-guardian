/**
 * Core Types & Session Context Interfaces
 * [REFACTOR-CORE-001] GameSessionContext 타입 정의
 */

export type GameDifficulty = 'easy' | 'normal' | 'hard';
export type GameMode = 'story' | 'practice' | 'endless' | (string & {});
export type SessionPhase = 'IDLE' | 'READY' | 'A' | 'B' | 'CLIMAX' | 'RESULT' | (string & {});

export interface SessionMetadata {
  chapterId: number;
  subLevel?: number;
  difficulty: GameDifficulty;
  gameMode: GameMode;
  score: number;
  elapsedTime: number;
  phase: SessionPhase;
}

export interface SessionMetrics {
  totalSteps: number;
  totalJumps: number;
  totalDwellTime: number;
  combo: number;
  consecutiveWrongCount: number;
}

export interface CoreSystems {
  eventBus?: any;
  gameEngine?: any;
  stateMachine?: any;
  sessionLifecycle?: any;
  canvasManager?: any;
  effectManager?: any;
  [key: string]: any;
}

export interface GameControllers {
  battle?: any;
  boss?: any;
  guardian?: any;
  beatCoordinator?: any;
  beatRoundResolver?: any;
  stageProgress?: any;
  bossHazard?: any;
  bossFever?: any;
  [key: string]: any;
}

export interface GameSessionContextOptions {
  metadata?: Partial<SessionMetadata>;
  metrics?: Partial<SessionMetrics>;
  systems?: CoreSystems;
  controllers?: GameControllers;
}
