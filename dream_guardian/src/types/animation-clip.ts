/**
 * Animation Clip Data Contracts
 * Issue #687 / FEAT-ANIM-001: 애니메이션 클립(키프레임 JSON) 및 레이어 블렌딩·본 마스크
 */

export type KeyframeEase = 'linear' | 'easeIn' | 'easeOut' | 'easeInOut';

export interface Keyframe {
  t: number;
  angle: number;
  ease?: KeyframeEase;
}

export interface SkinSwapKeyframe {
  t: number;
  boneId: string;
  partFile: string;
}

export interface AnimationClip {
  id: string;
  name?: string;
  duration: number;
  loop: boolean;
  tracks: Record<string, Keyframe[]>;
  skinSwaps?: SkinSwapKeyframe[];
}
