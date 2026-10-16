/**
 * AssaultSoundCue.ts - 게임 시계 기반 박자·연출 효과음 큐
 *
 * @see docs/14_BOSS_ASSAULT_GAMEPLAY_DESIGN.md (DOC-14 §15.2-B5)
 * @see docs/15_BOSS_ASSAULT_WORK_CARDS.md (BOSS-ASSAULT-41 / Issue #544)
 *
 * 절대 규칙:
 * 1. Audio 어댑터 레이어 단일 책임:
 *    - #510 활성 시각(activeSeconds)과 #515/#517 라운드 스냅샷 경계 이벤트(박자, 투척, 발사, 무효화, 피격)를
 *      기존 SFXSynth 효과음 요청으로 멱등하게 변환한다.
 * 2. 오디오-엔진 시계 동기화 (DEC-B5):
 *    - AudioContext 시간을 판정 시계로 사용하지 않고, 오직 활성 시각(activeSeconds)과 게임 엔진 snapshot 이벤트를
 *      입력으로 받아 SFX를 트리거한다.
 *    - MVP에서는 BGM을 시작하지 않음(B5 권장안). 기존 SFXSynth 계약(또는 호환 인터페이스 ISFXPlayer)만 소비한다.
 * 3. 경계 이벤트 1회 재생 및 중복 차단:
 *    - 각 박자(beat tick), 문제 투척(throw), 발사(launch), 무효화/회피(negate/evade), 피격/오답(player_hurt/wrong)에 대해
 *      고유한 경계 ID 또는 박자 인덱스를 기반으로 중복 재생을 방지한다 (동일 경계 ID는 단 1회만 재생).
 * 4. 안전 정지 시 무음:
 *    - 일시정지(isPaused: true) 또는 탭 숨김/추적 상실 중에는 어떤 소리도 요청하지 않는다.
 *    - 정지 복귀 시 지나간 정지 구간의 소리를 소급 폭풍 재생하지 않는다.
 * 5. 아키텍처 제약:
 *    - 새 requestAnimationFrame, setInterval 등록 0회.
 *    - 순수 어댑터 클래스 (update(activeSeconds, snapshot, isPaused) 형태).
 *    - HP 직접 변경 0회, 게임 판정 실행 0회.
 */

import type { SFXType } from './SFXSynth.js';
import type {
  AssaultRoundPhase,
  AssaultSettlementCommand,
} from '../types/assault.js';
import type { AssaultPairRenderSnapshot } from '../render/AssaultPairPainter.js';
import type { AssaultSquatHazardRenderData } from '../render/AssaultSceneRenderer.js';

/**
 * 단발성 SFX 재생기 계약 (SFXSynth 호환)
 */
export interface ISFXPlayer {
  play(type: SFXType): void;
}

/**
 * 경계 이벤트 종류
 */
export type AssaultBoundaryEventType =
  | 'beat'
  | 'throw'
  | 'launch'
  | 'negate'
  | 'evade'
  | 'player_hurt'
  | 'wrong'
  | 'correct';

/**
 * 명시적 경계 이벤트 인터페이스
 */
export interface AssaultBoundaryEvent {
  readonly id: string;
  readonly type: AssaultBoundaryEventType;
  readonly timestamp?: number;
  readonly sfx?: SFXType;
}

/**
 * 효과음 매핑 설정
 */
export interface AssaultSoundMapping {
  readonly metronomeStrong: SFXType;
  readonly metronomeWeak: SFXType;
  readonly beatTick: SFXType;
  readonly throw: SFXType;
  readonly launch: SFXType;
  readonly negate: SFXType;
  readonly evade: SFXType;
  readonly playerHurt: SFXType;
  readonly wrong: SFXType;
  readonly correct: SFXType;
}

/**
 * 기본 효과음 매핑
 */
export const DEFAULT_ASSAULT_SOUND_MAPPING: AssaultSoundMapping = Object.freeze({
  metronomeStrong: 'metronome_strong',
  metronomeWeak: 'metronome_weak',
  beatTick: 'beat_tick',
  throw: 'jump_whoosh',
  launch: 'warning',
  negate: 'shield_deflect',
  evade: 'shield_deflect',
  playerHurt: 'player_hurt',
  wrong: 'wrong',
  correct: 'correct',
});

/**
 * 스냅샷 입력 계약 (AssaultRoundPresentation / AssaultPresentationDTO / AssaultSceneSnapshot 호환)
 */
export interface AssaultSoundSnapshot {
  readonly sessionId?: string;
  readonly roundId?: string;
  readonly phase?: AssaultRoundPhase;
  readonly activeSeconds?: number;
  readonly isPaused?: boolean;
  readonly isHidden?: boolean;
  readonly isTrackingLost?: boolean;
  readonly warningActive?: boolean;
  readonly currentEncounterIndex?: number;
  readonly totalEncounters?: number;
  readonly pair?: AssaultPairRenderSnapshot;
  readonly squatHazard?: AssaultSquatHazardRenderData;
  readonly events?: readonly AssaultBoundaryEvent[];
  readonly boundaryEvents?: readonly AssaultBoundaryEvent[];
  readonly settlementCommands?: readonly AssaultSettlementCommand[];
  readonly commands?: readonly AssaultSettlementCommand[];
}

/**
 * 어댑터 초기화 옵션
 */
export interface AssaultSoundCueOptions {
  readonly sfxPlayer?: ISFXPlayer;
  readonly bpm?: number;
  readonly soundMapping?: Partial<AssaultSoundMapping>;
  readonly enableMetronome?: boolean;
  readonly useBeatTickOnly?: boolean;
}

/**
 * 게임 시계 기반 박자·연출 효과음 큐 어댑터
 */
export class AssaultSoundCue {
  private readonly _sfxPlayer?: ISFXPlayer;
  private readonly _bpm: number;
  private readonly _secondsPerBeat: number;
  private readonly _soundMapping: AssaultSoundMapping;
  private readonly _enableMetronome: boolean;
  private readonly _useBeatTickOnly: boolean;

  private readonly _playedBoundaryIds: Set<string> = new Set();
  private _lastProcessedBeat: number = -1;
  private _wasPaused: boolean = false;
  private _isPaused: boolean = false;

  constructor(options?: AssaultSoundCueOptions) {
    this._sfxPlayer = options?.sfxPlayer;
    this._bpm = options?.bpm ?? 100;
    this._secondsPerBeat = 60 / Math.max(1, this._bpm);
    this._soundMapping = Object.freeze({
      ...DEFAULT_ASSAULT_SOUND_MAPPING,
      ...(options?.soundMapping ?? {}),
    });
    this._enableMetronome = options?.enableMetronome ?? true;
    this._useBeatTickOnly = options?.useBeatTickOnly ?? false;
  }

  // ─── 상태 조회 ───

  public get bpm(): number {
    return this._bpm;
  }

  public get secondsPerBeat(): number {
    return this._secondsPerBeat;
  }

  public get playedCount(): number {
    return this._playedBoundaryIds.size;
  }

  public get isPaused(): boolean {
    return this._isPaused;
  }

  public hasPlayed(boundaryId: string): boolean {
    return this._playedBoundaryIds.has(boundaryId);
  }

  // ─── 초기화 ───

  public reset(): void {
    this._playedBoundaryIds.clear();
    this._lastProcessedBeat = -1;
    this._wasPaused = false;
    this._isPaused = false;
  }

  // ─── 갱신 루프 ───

  public update(
    activeSeconds: number,
    snapshot?: AssaultSoundSnapshot,
    isPaused?: boolean,
  ): void {
    // 1. 일시정지 및 안전 정지 판별
    const paused =
      isPaused === true ||
      snapshot?.isPaused === true ||
      snapshot?.isHidden === true ||
      snapshot?.isTrackingLost === true;

    if (paused) {
      this._isPaused = true;
      this._wasPaused = true;

      // 정지 구간 중 유입된 이벤트는 마킹하여 복귀 시 소급 폭풍 재생 차단
      if (snapshot) {
        this._markSnapshotEventsAsSeen(snapshot);
      }
      return;
    }

    // 2. 정지 상태에서 정상 상태로 복귀한 경우
    const justResumed = this._wasPaused || this._isPaused;
    if (justResumed) {
      this._isPaused = false;
      this._wasPaused = false;
    }

    // 3. 메트로놈 박자(Beat) 큐 갱신
    if (this._enableMetronome) {
      this._updateBeatClock(activeSeconds, justResumed);
    }

    // 4. 스냅샷 기반 경계 이벤트 변환 및 SFX 트리거
    if (snapshot) {
      this._processSnapshot(snapshot);
    }
  }

  // ─── 수동 경계 이벤트 트리거 ───

  public trigger(event: AssaultBoundaryEvent): boolean {
    if (this._isPaused) {
      this._playedBoundaryIds.add(event.id);
      return false;
    }
    return this._playBoundary(event.id, this._resolveEventSfx(event));
  }

  // ─── 내부 로직 ───

  private _updateBeatClock(activeSeconds: number, justResumed: boolean): void {
    const currentBeat = Math.floor(activeSeconds / this._secondsPerBeat);

    // 복귀 시 소급 폭풍 재생 방지: 정지 구간 동안 지나간 비트를 건너뜀
    if (justResumed) {
      this._lastProcessedBeat = currentBeat;
      const beatBoundaryId = `beat_${currentBeat}`;
      if (!this._playedBoundaryIds.has(beatBoundaryId)) {
        this._playBeatSound(currentBeat, beatBoundaryId);
      }
      return;
    }

    // 첫 프레임 시작 처리
    if (this._lastProcessedBeat < 0) {
      this._lastProcessedBeat = currentBeat;
      const beatBoundaryId = `beat_${currentBeat}`;
      this._playBeatSound(currentBeat, beatBoundaryId);
      return;
    }

    // 연속 진행 시 새 비트 도달 처리 (멱등성 보장)
    if (currentBeat > this._lastProcessedBeat) {
      // 프레임 드랍 시 폭풍 재생 방지: 최대 1비트만 연쇄 허용
      const startBeat = Math.max(this._lastProcessedBeat + 1, currentBeat - 1);
      for (let b = startBeat; b <= currentBeat; b++) {
        const beatBoundaryId = `beat_${b}`;
        if (!this._playedBoundaryIds.has(beatBoundaryId)) {
          this._playBeatSound(b, beatBoundaryId);
        }
      }
      this._lastProcessedBeat = currentBeat;
    }
  }

  private _playBeatSound(beatIndex: number, boundaryId: string): void {
    const isStrong = beatIndex % 4 === 0;
    const sfx: SFXType = this._useBeatTickOnly
      ? this._soundMapping.beatTick
      : isStrong
        ? this._soundMapping.metronomeStrong
        : this._soundMapping.metronomeWeak;

    this._playBoundary(boundaryId, sfx);
  }

  private _processSnapshot(snapshot: AssaultSoundSnapshot): void {
    const roundPrefix = snapshot.roundId || 'round';

    // 1. 명시적 boundary events
    const rawEvents = snapshot.events || snapshot.boundaryEvents;
    if (rawEvents) {
      for (const evt of rawEvents) {
        if (!this._playedBoundaryIds.has(evt.id)) {
          this._playBoundary(evt.id, this._resolveEventSfx(evt));
        }
      }
    }

    // 2. 정산 명령 (Settlement Commands)
    const rawCommands = snapshot.settlementCommands || snapshot.commands;
    if (rawCommands) {
      for (const cmd of rawCommands) {
        const cmdId =
          cmd.idempotencyKey ||
          `${cmd.sessionId}:${cmd.attackId}:${cmd.effectType}`;
        if (!this._playedBoundaryIds.has(cmdId)) {
          const sfx = this._resolveCommandSfx(cmd);
          if (sfx) {
            this._playBoundary(cmdId, sfx);
          }
        }
      }
    }

    // 3. 문제 투척 페이즈 (throw_in)
    if (snapshot.phase === 'throw_in') {
      const throwId = `${roundPrefix}:phase_throw_in`;
      if (!this._playedBoundaryIds.has(throwId)) {
        this._playBoundary(throwId, this._soundMapping.throw);
      }
    }

    // 4. 발사 / 경고 (warningActive)
    if (snapshot.warningActive === true) {
      const encIndex = snapshot.currentEncounterIndex ?? 0;
      const warningId = `${roundPrefix}:${encIndex}:warning`;
      if (!this._playedBoundaryIds.has(warningId)) {
        this._playBoundary(warningId, this._soundMapping.launch);
      }
    }

    // 5. 보기 쌍 상태 (pair)
    if (snapshot.pair) {
      const pair = snapshot.pair;
      const pairId = pair.pairId || pair.attackId || 'pair';

      if (pair.status === 'flying' || pair.status === 'inFlight') {
        const id = `${roundPrefix}:${pairId}:flying`;
        if (!this._playedBoundaryIds.has(id)) {
          this._playBoundary(id, this._soundMapping.launch);
        }
      } else if (pair.status === 'negated') {
        const id = `${roundPrefix}:${pairId}:negated`;
        if (!this._playedBoundaryIds.has(id)) {
          this._playBoundary(id, this._soundMapping.negate);
        }
      } else if (pair.status === 'hit') {
        const id = `${roundPrefix}:${pairId}:hit`;
        if (!this._playedBoundaryIds.has(id)) {
          this._playBoundary(id, this._soundMapping.correct);
        }
      } else if (pair.status === 'wrong_hit' || pair.status === 'wrong_locked') {
        const id = `${roundPrefix}:${pairId}:wrong`;
        if (!this._playedBoundaryIds.has(id)) {
          this._playBoundary(id, this._soundMapping.wrong);
        }
      }
    }

    // 6. 스쿼트 위험 상태 (squatHazard)
    if (snapshot.squatHazard) {
      const hazard = snapshot.squatHazard;
      if (hazard.status === 'telegraph' || hazard.status === 'active') {
        const id = `${roundPrefix}:squat_hazard:active`;
        if (!this._playedBoundaryIds.has(id)) {
          this._playBoundary(id, this._soundMapping.launch);
        }
      } else if (hazard.status === 'evaded') {
        const id = `${roundPrefix}:squat_hazard:evaded`;
        if (!this._playedBoundaryIds.has(id)) {
          this._playBoundary(id, this._soundMapping.evade);
        }
      } else if (hazard.status === 'hit') {
        const id = `${roundPrefix}:squat_hazard:hit`;
        if (!this._playedBoundaryIds.has(id)) {
          this._playBoundary(id, this._soundMapping.playerHurt);
        }
      }
    }
  }

  private _resolveEventSfx(event: AssaultBoundaryEvent): SFXType {
    if (event.sfx) {
      return event.sfx;
    }
    switch (event.type) {
      case 'throw':
        return this._soundMapping.throw;
      case 'launch':
        return this._soundMapping.launch;
      case 'negate':
        return this._soundMapping.negate;
      case 'evade':
        return this._soundMapping.evade;
      case 'player_hurt':
        return this._soundMapping.playerHurt;
      case 'wrong':
        return this._soundMapping.wrong;
      case 'correct':
        return this._soundMapping.correct;
      case 'beat':
        return this._soundMapping.beatTick;
      default:
        return 'beat_tick';
    }
  }

  private _resolveCommandSfx(cmd: AssaultSettlementCommand): SFXType | null {
    switch (cmd.effectType) {
      case 'player_damage':
        return (cmd.resultKind as string) === 'wrong'
          ? this._soundMapping.wrong
          : this._soundMapping.playerHurt;
      case 'boss_negate':
        return this._soundMapping.negate;
      case 'evade_success':
        return this._soundMapping.evade;
      case 'boss_stagger':
        return 'monster_hit';
      default:
        return null;
    }
  }

  private _markSnapshotEventsAsSeen(snapshot: AssaultSoundSnapshot): void {
    const rawEvents = snapshot.events || snapshot.boundaryEvents;
    if (rawEvents) {
      for (const evt of rawEvents) {
        this._playedBoundaryIds.add(evt.id);
      }
    }
    const rawCommands = snapshot.settlementCommands || snapshot.commands;
    if (rawCommands) {
      for (const cmd of rawCommands) {
        const cmdId =
          cmd.idempotencyKey ||
          `${cmd.sessionId}:${cmd.attackId}:${cmd.effectType}`;
        this._playedBoundaryIds.add(cmdId);
      }
    }
  }

  private _playBoundary(boundaryId: string, sfx: SFXType): boolean {
    if (this._playedBoundaryIds.has(boundaryId)) {
      return false;
    }
    this._playedBoundaryIds.add(boundaryId);
    this._sfxPlayer?.play(sfx);
    return true;
  }
}
