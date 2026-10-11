/**
 * [DEVUI-001] (Issue #561) 인게임 UI 개발 모드 부트스트랩 (개발 전용)
 *
 * main.ts에서 `import.meta.env.DEV && ?dev=ui` 일 때만 동적 import 된다.
 * 이번 카드에서는 좌상단 "DEV UI" 배지만 표시한다 (후속 DEVUI 카드의 마운트 지점).
 */

export const DEV_UI_BADGE_ID = 'dg-dev-ui-badge';
export const DEV_UI_BADGE_TEXT = 'DEV UI';

export function startDevUi(_app: unknown, doc: Document = document): HTMLElement {
  const existing = doc.getElementById(DEV_UI_BADGE_ID);
  if (existing) return existing;

  const badge = doc.createElement('div');
  badge.id = DEV_UI_BADGE_ID;
  badge.textContent = DEV_UI_BADGE_TEXT;
  Object.assign(badge.style, {
    position: 'fixed',
    top: '0px',
    left: '0px',
    zIndex: '99999',
    padding: '4px 8px',
    background: '#FF3B6B',
    color: '#FFFFFF',
    font: 'bold 12px monospace',
    pointerEvents: 'none',
  });
  doc.body.appendChild(badge);
  return badge;
}
