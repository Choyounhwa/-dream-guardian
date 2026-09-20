import { DEFAULT_CONFIG } from './core/Config.js';

/**
 * Dream Guardian 메인 진입점
 * 브라우저 환경에서만 DOM 접근
 */
function bootstrap(): void {
  console.log('[DreamGuardian] v0.1 bootstrap');
  console.log('[DreamGuardian] Config loaded:', DEFAULT_CONFIG.player.maxHp, 'HP');
}

// 브라우저 환경에서만 실행
if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bootstrap);
  } else {
    bootstrap();
  }
}

export { DEFAULT_CONFIG };
