/**
 * QuestionSpeech - 한국어 TTS 음성 안내
 *
 * 수학 기호를 한국어 음성 텍스트로 변환
 * 비블로킹 음성 큐 (게임 타이머에 영향 없음)
 * TTS 미지원 시 graceful degradation
 *
 * @see Issue #14 (GitHub #79)
 */

export type SpeechStatus = 'idle' | 'speaking' | 'unsupported';

export class QuestionSpeech {
  private _status: SpeechStatus = 'idle';
  private _utterance: SpeechSynthesisUtterance | null = null;
  private _timeoutId: ReturnType<typeof setTimeout> | null = null;
  private _supported = false;

  constructor() {
    this._supported =
      typeof window !== 'undefined' &&
      typeof window.speechSynthesis !== 'undefined' &&
      typeof window.SpeechSynthesisUtterance !== 'undefined';

    if (!this._supported) {
      this._status = 'unsupported';
    }
  }

  get status(): SpeechStatus {
    return this._status;
  }

  get isSupported(): boolean {
    return this._supported;
  }

  /**
   * 수학 문제를 한국어 음성으로 읽기
   * 비블로킹: 음성이 끝나지 않아도 게임은 계속 진행
   */
  speak(mathText: string): void {
    if (!this._supported) return;

    // 이전 음성 취소
    this.cancel();

    const koreanText = mathToKorean(mathText);

    try {
      this._utterance = new SpeechSynthesisUtterance(koreanText);
      this._utterance.lang = 'ko-KR';
      this._utterance.rate = 1.0;

      this._utterance.onend = () => {
        this._status = 'idle';
        this._clearTimeout();
      };

      this._utterance.onerror = () => {
        this._status = 'idle';
        this._clearTimeout();
      };

      this._status = 'speaking';
      window.speechSynthesis.speak(this._utterance);

      // 3초 안전 타임아웃 (음성이 시작되지 않을 경우 대비)
      this._timeoutId = setTimeout(() => {
        this._status = 'idle';
      }, 3000);
    } catch {
      this._status = 'idle';
    }
  }

  /** 현재 음성 취소 */
  cancel(): void {
    if (this._supported && typeof window !== 'undefined') {
      window.speechSynthesis.cancel();
    }
    this._status = 'idle';
    this._clearTimeout();
  }

  /** 리소스 정리 */
  destroy(): void {
    this.cancel();
    this._utterance = null;
  }

  private _clearTimeout(): void {
    if (this._timeoutId !== null) {
      clearTimeout(this._timeoutId);
      this._timeoutId = null;
    }
  }
}

/**
 * 수학 표기를 한국어 음성 텍스트로 변환
 *
 * 예:
 *   "3 + 5 = ?"  → "3 더하기 5는?"
 *   "12 - 7 = ?" → "12 빼기 7은?"
 *   "4 × 6 = ?"  → "4 곱하기 6은?"
 *   "15 ÷ 3 = ?" → "15 나누기 3은?"
 *   "1/2 + 3"    → "2분의 1 더하기 3"
 */
export function mathToKorean(text: string): string {
  let result = text;

  // 분수 변환: a/b → b분의 a
  result = result.replace(/(\d+)\s*\/\s*(\d+)/g, (_m, num, den) => `${den}분의 ${num}`);

  // 연산자 변환
  result = result.replace(/\+/g, ' 더하기 ');
  result = result.replace(/\-/g, ' 빼기 ');
  result = result.replace(/[×\*]/g, ' 곱하기 ');
  result = result.replace(/[÷\/]/g, ' 나누기 ');

  // "= ?" 또는 단독 "?" → "는?"
  result = result.replace(/\s*=?\s*\?\s*$/, '는?');

  // 연속 공백 정리
  result = result.replace(/\s+/g, ' ').trim();

  return result;
}
