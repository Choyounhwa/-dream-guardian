/**
 * SessionLifecycle - 게임 세션 수명 및 비동기 예약 관리자
 *
 * - pause-aware 게임 시간과 세션 경계 동기화
 * - 세션 전환, 메뉴 복귀, 재시작 시 잔여 예약(setTimeout) 일괄 취소
 * - Generation Token(세션 ID) 검증을 통한 이전 세션 콜백 차단
 * - 결과 화면(승리/패배) 전환 권한 단일화 (중복 전환 및 고아 예약 차단)
 *
 * @see Issue #231 [BUG-SESSION-EXIT-001]
 */

import type { AssaultHandoverSnapshot } from '../game/assault/AssaultProgressController.js';

export class SessionLifecycle {
  private _sessionId = 0;
  private readonly _pendingTimeouts = new Set<ReturnType<typeof setTimeout>>();
  private _hasResultShown = false;
  private _isTestSession = false;
  private _activeAssaultSessionToken: string | number | null = null;
  private _lastHandoverSnapshot: AssaultHandoverSnapshot | null = null;

  /** 현재 세션 고유 식별자 (재시작/메뉴복귀 시마다 증가) */
  get sessionId(): number {
    return this._sessionId;
  }

  /** 현재 세션에서 결과 화면이 이미 표시되었는지 여부 */
  get hasResultShown(): boolean {
    return this._hasResultShown;
  }

  /** 현재 대기 중인 세션 예약 수 */
  get pendingTimeoutCount(): number {
    return this._pendingTimeouts.size;
  }

  /** 현재 세션이 테스트 플레이 세션인지 여부 (Issue #391) */
  get isTestSession(): boolean {
    return this._isTestSession;
  }

  /** 테스트 세션 플래그 명시 설정 */
  setTestSession(isTest: boolean): void {
    this._isTestSession = isTest;
  }

  /** 활성 assault 세션 토큰 (문자열 또는 숫자) */
  get activeAssaultSessionToken(): string | number | null {
    return this._activeAssaultSessionToken;
  }

  /** 활성 assault 세션 토큰 등록 */
  setActiveAssaultSessionToken(token: string | number | null): void {
    this._activeAssaultSessionToken = token;
  }

  /**
   * 활성 assault 세션 토큰 해제 (특정 토큰 또는 전체)
   * 토큰이 지정된 경우 현재 활성 토큰과 일치할 때만 해제하여 레이스 컨디션 방지
   */
  clearActiveAssaultSessionToken(token?: string | number | null): void {
    if (token === undefined || token === null) {
      this._activeAssaultSessionToken = null;
    } else if (this._activeAssaultSessionToken === token) {
      this._activeAssaultSessionToken = null;
    }
  }

  /** 보관된 최근 결전 인계 스냅샷 */
  get lastHandoverSnapshot(): AssaultHandoverSnapshot | null {
    return this._lastHandoverSnapshot;
  }

  /**
   * assault 세션 종료 의도 단일 권위 처리 (BOSS-ASSAULT-24 / Issue #526)
   *
   * @param intent 종료 의도 ('game_over' | 'handover_climax')
   * @param snapshot 인계 스냅샷 (handover_climax 시)
   * @param sessionToken 요청을 보낸 세션 토큰 (이전 세션 검증용)
   * @returns 처리 성공 여부 (중복, 만료된 토큰, 미지원 의도 시 false)
   */
  handleAssaultIntent(
    intent: string,
    snapshot?: AssaultHandoverSnapshot | null,
    sessionToken?: string | number | null,
  ): boolean {
    // 1. 세션 토큰 검증: 활성 세션 토큰이 없거나, 전달된 토큰이 활성 토큰과 일치하지 않으면 차단
    if (
      this._activeAssaultSessionToken === null ||
      (sessionToken !== undefined &&
        sessionToken !== null &&
        sessionToken !== this._activeAssaultSessionToken)
    ) {
      return false;
    }

    // 2. 지원하는 종료 의도인지 확인
    if (intent !== 'game_over' && intent !== 'handover_climax') {
      return false;
    }

    // 3. 단일 결과 전환 권위 확인 (이미 결과가 표시되었거나 중복 호출 시 false)
    if (!this.claimResultTransition()) {
      return false;
    }

    // 4. 인계 스냅샷 보관 (handover_climax 시)
    if (intent === 'handover_climax') {
      this._lastHandoverSnapshot = snapshot ?? null;
    } else {
      this._lastHandoverSnapshot = null;
    }

    return true;
  }

  /**
   * 활성 assault 세션 토큰 유효성 검사
   */
  isValidAssaultToken(token?: string | number | null): boolean {
    if (this._activeAssaultSessionToken === null) return false;
    return this._activeAssaultSessionToken === token;
  }

  /**
   * 새 세션 시작 (startChapter 등)
   * 이전 세션의 모든 예약을 취소하고 세션 ID를 갱신
   */
  startSession(optionsOrIsTest?: boolean | { isTestSession?: boolean }): number {
    this.cancelAllReservations();
    this._sessionId++;
    this._hasResultShown = false;
    this._activeAssaultSessionToken = null;
    this._lastHandoverSnapshot = null;
    if (typeof optionsOrIsTest === 'boolean') {
      this._isTestSession = optionsOrIsTest;
    } else if (optionsOrIsTest && typeof optionsOrIsTest === 'object') {
      this._isTestSession = Boolean(optionsOrIsTest.isTestSession);
    } else {
      this._isTestSession = false;
    }
    return this._sessionId;
  }

  /**
   * 테스트 세션 시작 편의 메서드 (Issue #391)
   */
  startTestSession(): number {
    return this.startSession(true);
  }

  /**
   * 세션 종료 및 메뉴 복귀 (goToMenu 등)
   * 모든 대기 예약을 즉시 취소하고 세션 ID를 갱신하여 이전 콜백을 무효화
   */
  endSession(): void {
    this.cancelAllReservations();
    this._sessionId++;
    this._hasResultShown = false;
    this._isTestSession = false;
    this._activeAssaultSessionToken = null;
    this._lastHandoverSnapshot = null;
  }

  /**
   * 세션 중단 (abort) - Issue #391
   * 모든 대기 예약 취소, 토큰 갱신 및 테스트 모드 리셋
   */
  abortSession(): void {
    this.endSession();
  }

  /**
   * 현재 세션에 바인딩된 비동기 예약 등록
   * 세션이 만료되거나 취소된 경우 실행되지 않음
   */
  schedule(callback: () => void, delayMs: number): ReturnType<typeof setTimeout> {
    const currentSession = this._sessionId;
    const timeoutId = setTimeout(() => {
      this._pendingTimeouts.delete(timeoutId);
      if (this._sessionId !== currentSession) {
        return; // 세션이 만료되었으므로 실행 차단
      }
      callback();
    }, delayMs);

    this._pendingTimeouts.add(timeoutId);
    return timeoutId;
  }

  /**
   * 대기 중인 모든 세션 비동기 예약 즉시 취소
   */
  cancelAllReservations(): void {
    for (const timeoutId of this._pendingTimeouts) {
      clearTimeout(timeoutId);
    }
    this._pendingTimeouts.clear();
  }

  /**
   * 결과 화면 전환 권한 획득 (단 1회만 true 반환)
   * 중복 승패 콜백을 방지하고 다음 라운드 등 잔여 예약을 즉시 정리
   */
  claimResultTransition(): boolean {
    if (this._hasResultShown) {
      return false; // 이미 결과가 표시되었으므로 중복 차단
    }
    this._hasResultShown = true;
    this.cancelAllReservations();
    return true;
  }
}
