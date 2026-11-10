/**
 * [DEVUI-001] (Issue #561) 인게임 UI 개발 모드 게이트
 *
 * 순수 판정 함수만 둔다. DevBootstrap은 정적으로 import하지 않는다
 * (프로덕션 번들 격리는 main.ts의 import.meta.env.DEV 리터럴 가드가 담당).
 */

export interface DevUiLocationLike {
  search: string;
}

export interface DevUiEnvLike {
  DEV?: boolean;
}

export interface DevBootstrapModuleLike {
  startDevUi: (app: unknown) => unknown;
}

/** `import.meta.env.DEV === true` 이고 `?dev=ui` 일 때만 true */
export function isDevUiEnabled(
  location: DevUiLocationLike | undefined,
  env: DevUiEnvLike | undefined,
): boolean {
  if (!env || env.DEV !== true) return false;
  if (!location || typeof location.search !== 'string') return false;
  return new URLSearchParams(location.search).get('dev') === 'ui';
}

/** 활성 시에만 loader로 DevBootstrap을 동적 로드하고 startDevUi(app)를 호출한다. */
export async function maybeStartDevUi(
  location: DevUiLocationLike | undefined,
  env: DevUiEnvLike | undefined,
  app: unknown,
  loader: () => Promise<DevBootstrapModuleLike>,
): Promise<boolean> {
  if (!isDevUiEnabled(location, env)) return false;
  const mod = await loader();
  mod.startDevUi(app);
  return true;
}
