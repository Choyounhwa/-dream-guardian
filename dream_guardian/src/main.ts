/**
 * Dream Guardian - 메인 진입점
 * AppBootstrap을 통한 초기화 및 게임 엔진 구동
 *
 * [REFACTOR-MAIN-002] (Issue #302)
 * main.ts 200줄 이하 경량화: 부트스트랩 및 이벤트 리스너 분리
 */

/// <reference types="vite/client" />
import { AppBootstrap } from './core/AppBootstrap.js';
import { maybeStartDevUi } from './dev/DevUiGate.js';

// 메인 앱 부트스트랩 인스턴스 생성
export const app = new AppBootstrap();

// 브라우저 DOM 준비 시 자동 초기화 및 엔진 실행
if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      app.init().then(() => app.start());
    });
  } else {
    app.init().then(() => app.start());
  }

  // [DEVUI-001] (Issue #561) ?dev=ui 개발 모드 진입점.
  // import.meta.env.DEV 리터럴 가드로 프로덕션 빌드에서는 동적 import 자체가 제거된다.
  if (import.meta.env.DEV) {
    void maybeStartDevUi(window.location, import.meta.env, app, () => import('./dev/DevBootstrap.js'));
  }
}

// 하위 호환성 및 외부 모듈 참조용 핵심 시스템 export
export const stateMachine = app.stateMachine;
export const sessionLifecycle = app.sessionLifecycle;
export const presentationAdapter = app.presentationAdapter;
