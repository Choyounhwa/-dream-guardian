/**
 * story.ts - 스토리 대사 및 ADHD 심리 치유 스크립트 타입 정의
 *
 * @see Issue #218 (STORY-DATA-001)
 * @see docs/04_STORY_SOURCE.md (제7장 5대 보스별 대사, 제9장 9.1~9.2절)
 */

export type Speaker = 'kkebi' | 'boss' | 'narrator';

export type DialogueTrigger =
  | 'battle_start'
  | 'answer_correct'
  | 'consecutive_correct'
  | 'answer_wrong'
  | 'consecutive_wrong'
  | 'adhd_defense'
  | 'boss_collapse_soon'
  | 'boss_purified'
  | 'boss_enrage';

export type ADHDDefenseType =
  | 'anger'
  | 'give_up'
  | 'rush_guess'
  | 'defiance'
  | 'distraction';

/**
 * 인게임 대사 단일 발화 데이터
 */
export interface DialogueLine {
  id?: string;
  speaker: Speaker;
  speakerName: string;
  text: string;
  subText?: string;
  chapter?: number;
  trigger: DialogueTrigger;
  defenseType?: ADHDDefenseType;
  durationMs?: number;
}

/**
 * 대사 쿼리 옵션
 */
export interface DialogueQueryOptions {
  trigger: DialogueTrigger;
  chapter?: number;
  consecutiveCount?: number;
  defenseType?: ADHDDefenseType;
  speaker?: Speaker;
  force?: boolean;
  nowMs?: number;
}

/**
 * 보스별 대사 데이터 설정 (오답 대사는 원천 배제/미정의)
 */
export interface BossDialogueConfig {
  bossId: string;
  bossName: string;
  chapter: number;
  battleStart: readonly string[];
  answerCorrect: readonly string[];
  consecutiveCorrect: readonly string[];
  bossCollapseSoon: readonly string[];
  bossPurified: readonly string[];
}

/**
 * 깨비 챕터별 오답 위로 대사 설정
 */
export interface KkebiDialogueConfig {
  chapter: number;
  answerWrong: readonly string[];
  consecutiveWrong: readonly string[];
}

/**
 * 전체 스토리 대사 데이터 스키마
 */
export interface StoryDialogueData {
  bosses: Record<number, BossDialogueConfig>;
  kkebi: Record<number, KkebiDialogueConfig>;
  adhdDefense: Record<ADHDDefenseType, string>;
}
