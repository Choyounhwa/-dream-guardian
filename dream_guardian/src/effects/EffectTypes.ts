/**
 * Dream Guardian - Effect System Types
 * 7종 시각 효과 및 EffectManager 타입 정의
 */

export type EffectType =
  | 'glow'
  | 'pulse'
  | 'expand'
  | 'fade'
  | 'burst'
  | 'radial'
  | 'trail';

export interface IVisualEffect {
  readonly type: EffectType;
  active: boolean;
  elapsed: number;
  duration: number;
  update(dt: number): void;
  render(ctx: CanvasRenderingContext2D): void;
  reset(): void;
}

export interface GlowOptions {
  x: number;
  y: number;
  radius?: number;
  color?: string;
  maxAlpha?: number;
  duration?: number;
}

export interface PulseOptions {
  x: number;
  y: number;
  startRadius?: number;
  maxRadius?: number;
  color?: string;
  lineWidth?: number;
  duration?: number;
}

export interface ExpandOptions {
  x: number;
  y: number;
  startRadius?: number;
  endRadius?: number;
  color?: string;
  lineWidth?: number;
  duration?: number;
  filled?: boolean;
}

export interface FadeOptions {
  x: number;
  y: number;
  text?: string;
  color?: string;
  fontSize?: number;
  vy?: number;
  duration?: number;
}

export interface BurstOptions {
  x: number;
  y: number;
  count?: number;
  colors?: string[];
  speedMin?: number;
  speedMax?: number;
  sizeMin?: number;
  sizeMax?: number;
  gravity?: number;
  drag?: number;
  duration?: number;
}

export interface RadialOptions {
  x: number;
  y: number;
  rayCount?: number;
  innerRadius?: number;
  outerRadius?: number;
  color?: string;
  rotationSpeed?: number;
  duration?: number;
}

export interface TrailOptions {
  x: number;
  y: number;
  maxPoints?: number;
  color?: string;
  lineWidth?: number;
  duration?: number;
}

export type PresetName = 'correct' | 'wrong' | 'cast' | 'shield' | 'combo';
