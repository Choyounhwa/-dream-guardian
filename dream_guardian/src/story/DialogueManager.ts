/**
 * DialogueManager.ts - 스토리 대사 쿼리 및 발화 제어 엔진
 *
 * 주요 기능:
 * 1. 5대 보스 상황별 대사, 깨비 위로 대사, ADHD 5대 방어 기제 치유 대사 쿼리
 * 2. 오답 시(`answer_wrong`, `consecutive_wrong`) 보스 발화 원천 차단 (화자는 무조건 깨비)
 * 3. 쿨다운 관리 (기본 2500ms, force 옵션으로 바이패스 가능)
 * 4. 중복 방지 인덱스 순환(Round-Robin Rotation)
 *
 * @see Issue #218 (STORY-DATA-001)
 * @see docs/04_STORY_SOURCE.md (제7장, 제9장)
 */

import type {
  DialogueLine,
  DialogueQueryOptions,
  DialogueTrigger,
  Speaker,
  StoryDialogueData,
} from '../types/story.js';
import { STORY_DIALOGUE_DATA } from './dialogueData.js';

export class DialogueManager {
  private _data: StoryDialogueData;
  private _cooldownMs: number;
  private _lastDialogueTime: number = 0;
  private _rotationIndices: Map<string, number> = new Map();

  constructor(data: StoryDialogueData = STORY_DIALOGUE_DATA, cooldownMs: number = 2500) {
    this._data = data;
    this._cooldownMs = cooldownMs;
  }

  /**
   * 대사 쿼리 메서드
   * 트리거, 챕터, 연속 횟수, ADHD 방어 행동에 따라 적절한 캐릭터의 대사를 비차단으로 추출합니다.
   * 쿨다운 미경과 시 null을 반환합니다.
   */
  getDialogue(options: DialogueQueryOptions): DialogueLine | null {
    const now = options.nowMs ?? Date.now();

    // 1. 쿨다운 검사 (force 시 바이패스, lastDialogueTime이 0이면 최초 또는 리셋 직후이므로 통과)
    if (!options.force && this._lastDialogueTime > 0 && (now - this._lastDialogueTime < this._cooldownMs)) {
      return null;
    }

    let trigger: DialogueTrigger = options.trigger;
    if (trigger === ('boss_enrage' as any)) {
      trigger = 'boss_collapse_soon';
    }

    // 2. 오답 시 보스 발화 원천 차단 (절대 원칙)
    if (trigger === 'answer_wrong' || trigger === 'consecutive_wrong') {
      if (options.speaker === 'boss') {
        return null;
      }
    }

    // 3. 연속 정답/오답 카운트에 따른 자동 트리거 전이
    if (trigger === 'answer_correct' && (options.consecutiveCount ?? 0) >= 2) {
      trigger = 'consecutive_correct';
    } else if (trigger === 'answer_wrong' && (options.consecutiveCount ?? 0) >= 2) {
      trigger = 'consecutive_wrong';
    }

    const chapter = Math.max(1, Math.min(5, options.chapter ?? 1));

    let speaker: Speaker;
    let speakerName: string;
    let selectedText: string | null = null;
    let durationMs = 3000;

    // 4. 발화자 및 텍스트 선택
    if (trigger === 'adhd_defense') {
      speaker = 'kkebi';
      speakerName = '깨비';
      const defenseType = options.defenseType ?? 'rush_guess';
      selectedText = this._data.adhdDefense[defenseType] ?? null;
      durationMs = 3500;
    } else if (trigger === 'answer_wrong' || trigger === 'consecutive_wrong') {
      speaker = 'kkebi';
      speakerName = '깨비';
      const kkebiCfg = this._data.kkebi[chapter];
      if (kkebiCfg) {
        const lines = trigger === 'consecutive_wrong'
          ? kkebiCfg.consecutiveWrong
          : kkebiCfg.answerWrong;
        selectedText = this._pickNextLine(`kkebi_${chapter}_${trigger}`, lines);
      }
    } else {
      // 보스 트리거 (battle_start, answer_correct, consecutive_correct, boss_collapse_soon, boss_purified)
      speaker = 'boss';
      const bossCfg = this._data.bosses[chapter];
      if (bossCfg) {
        speakerName = bossCfg.bossName;
        let lines: readonly string[] = [];
        if (trigger === 'battle_start') lines = bossCfg.battleStart;
        else if (trigger === 'answer_correct') lines = bossCfg.answerCorrect;
        else if (trigger === 'consecutive_correct') lines = bossCfg.consecutiveCorrect;
        else if (trigger === 'boss_collapse_soon') lines = bossCfg.bossCollapseSoon;
        else if (trigger === 'boss_purified') lines = bossCfg.bossPurified;

        selectedText = this._pickNextLine(`boss_${chapter}_${trigger}`, lines);
      } else {
        speakerName = '보스';
      }
    }

    if (!selectedText) {
      return null;
    }

    // 5. 쿨다운 갱신
    this._lastDialogueTime = now;

    return {
      speaker,
      speakerName,
      text: selectedText,
      chapter,
      trigger,
      defenseType: options.defenseType,
      durationMs,
    };
  }

  /**
   * 중복 방지 인덱스 순환 추출 (Round-Robin)
   */
  private _pickNextLine(key: string, lines: readonly string[]): string | null {
    if (!lines || lines.length === 0) return null;
    if (lines.length === 1) return lines[0];

    const prevIndex = this._rotationIndices.get(key) ?? -1;
    const nextIndex = (prevIndex + 1) % lines.length;
    this._rotationIndices.set(key, nextIndex);
    return lines[nextIndex];
  }

  /**
   * 쿨다운 초기화 (즉시 발화 가능 상태로 전환)
   */
  resetCooldown(): void {
    this._lastDialogueTime = 0;
  }

  /**
   * 쿨다운 시간 설정 (밀리초)
   */
  setCooldownTime(ms: number): void {
    this._cooldownMs = ms;
  }

  /**
   * 현재 쿨다운 시간 조회
   */
  getCooldownTime(): number {
    return this._cooldownMs;
  }

  /**
   * 마지막 발화 시점 타임스탬프 조회
   */
  getLastDialogueTime(): number {
    return this._lastDialogueTime;
  }

  /**
   * 대사 엔진 상태 완전 리셋
   */
  reset(): void {
    this._lastDialogueTime = 0;
    this._rotationIndices.clear();
  }

  /**
   * 원본 대사 데이터 접근자
   */
  getRawData(): StoryDialogueData {
    return this._data;
  }
}

/**
 * 기본 싱글톤 인스턴스
 */
export const dialogueManager = new DialogueManager();
