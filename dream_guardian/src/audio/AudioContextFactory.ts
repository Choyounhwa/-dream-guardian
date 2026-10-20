/**
 * AudioContextFactory.ts - Web AudioContext 팩토리 및 사운드 합성기 공통 로직 모듈
 *
 * 브라우저 AudioContext 초기화 및 호환성(webkitAudioContext) 래핑,
 * SSR/Headless 환경 방어 처리, 공유 싱글톤 컨텍스트 제공,
 * 그리고 웨이브셰이퍼(WaveShaper) 디스토션 커브 계산 함수를 단일 진실 공급원(SSOT)으로 통합 제공합니다.
 *
 * @see Issue #630 [REFACTOR-DRY-003]
 */

let sharedContext: AudioContext | null = null;

/**
 * 전역 AudioContext 생성자 클래스를 반환하거나, 미지원 환경(SSR/Headless)일 경우 null을 반환합니다.
 */
export function getAudioContextClass(): (new (options?: AudioContextOptions) => AudioContext) | null {
  if (typeof window === 'undefined') return null;
  const ctxClass =
    window.AudioContext ||
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  return ctxClass ?? null;
}

/**
 * 새로운 AudioContext 인스턴스를 안전하게 생성합니다.
 * 브라우저 미지원 또는 자동재생 정책 등 생성자 에러 발생 시 throw하지 않고 null을 반환합니다.
 */
export function createAudioContext(options?: AudioContextOptions): AudioContext | null {
  const AudioCtxClass = getAudioContextClass();
  if (!AudioCtxClass) return null;
  try {
    return new AudioCtxClass(options);
  } catch {
    return null;
  }
}

/**
 * 공유 AudioContext 싱글톤 인스턴스를 반환하거나 지연 생성합니다.
 * 기존 인스턴스가 닫힌(closed) 상태라면 새로 생성하여 교체합니다.
 */
export function getOrCreateAudioContext(options?: AudioContextOptions): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (!sharedContext || sharedContext.state === 'closed') {
    sharedContext = createAudioContext(options);
  }
  return sharedContext;
}

/**
 * 테스트 및 라이프사이클 정리를 위해 캐시된 공유 AudioContext를 리셋합니다.
 */
export function resetSharedAudioContext(): void {
  sharedContext = null;
}

/**
 * 웨이브셰이퍼(WaveShaperNode)용 비선형 디스토션 곡선(Float32Array)을 생성합니다.
 *
 * @param amount 왜곡 강도 (기본값 28, 음수 전달 시 0으로 클램핑)
 * @param nSamples 버퍼 샘플 수 (기본값 256)
 */
export function createDistortionCurve(amount: number = 28, nSamples: number = 256): Float32Array {
  const k = Math.max(0, amount);
  const samples = Math.max(2, nSamples);
  const curve = new Float32Array(samples);
  const deg = Math.PI / 180;
  for (let i = 0; i < samples; ++i) {
    const x = (i * 2) / samples - 1;
    curve[i] = ((3 + k) * x * 20 * deg) / (Math.PI + k * Math.abs(x));
  }
  return curve;
}

export { createDistortionCurve as makeDistortionCurve };
