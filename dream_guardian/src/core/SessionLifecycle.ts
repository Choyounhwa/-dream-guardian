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

export class SessionLifecycle {
  private _sessionId = 0;
  private readonly _pendingTimeouts = new Set<ReturnType<typeof setTimeout>>();
  private _hasResultShown = false;

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

  /**
   * 새 세션 시작 (startChapter 등)
   * 이전 세션의 모든 예약을 취소하고 세션 ID를 갱신
   */
  startSession(): number {
    this.cancelAllReservations();
    this._sessionId++;
    this._hasResultShown = false;
    return this._sessionId;
  }

  /**
   * 세션 종료 및 메뉴 복귀 (goToMenu 등)
   * 모든 대기 예약을 즉시 취소하고 세션 ID를 갱신하여 이전 콜백을 무효화
   */
  endSession(): void {
    this.cancelAllReservations();
    this._sessionId++;
    this._hasResultShown = false;
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
