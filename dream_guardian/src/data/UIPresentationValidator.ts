/**
 * UIPresentationValidator.ts - 실게임 UI 표시 계약 및 보호 레이아웃 유효성 검증기 (Issue #431 / UI-VIS-001)
 */

import {
  ALLOWED_ACTION_IDS,
  ALLOWED_ELEMENT_TYPES,
  DEFAULT_PROTECTED_ZONES,
  DYNAMIC_FIXTURE_BINDINGS,
  UIPresentationElement,
  UIRect,
  UI_DESIGN_CANVAS,
  UI_PRESENTATION_ARTIFACT_KIND,
  UI_PRESENTATION_PAGE_IDS,
  UI_PRESENTATION_VERSION,
} from './UIPresentation';

export interface UIPresentationValidationError {
  code: string;
  message: string;
  path?: string;
}

export interface UIPresentationValidationResult {
  valid: boolean;
  errors: UIPresentationValidationError[];
}

const ALLOWED_ELEMENT_KEYS = new Set([
  'id',
  'name',
  'type',
  'bounds',
  'hitBounds',
  'actionId',
  'text',
  'assetId',
  'fontSize',
  'dynamicBinding',
  'isProtected',
]);

const FORBIDDEN_GAME_DATA_KEYS = [
  'playerHp',
  'bossHp',
  'hp',
  'combo',
  'damage',
  'mana',
  'score',
  'bpm',
  'questionCsv',
  'charts',
  'phases',
];

function isFiniteRect(rect: unknown): rect is UIRect {
  if (!rect || typeof rect !== 'object') return false;
  const r = rect as Record<string, unknown>;
  return (
    typeof r.x === 'number' &&
    Number.isFinite(r.x) &&
    typeof r.y === 'number' &&
    Number.isFinite(r.y) &&
    typeof r.width === 'number' &&
    Number.isFinite(r.width) &&
    r.width >= 0 &&
    typeof r.height === 'number' &&
    Number.isFinite(r.height) &&
    r.height >= 0
  );
}

function rectsIntersect(r1: UIRect, r2: UIRect): boolean {
  return !(
    r1.x + r1.width <= r2.x ||
    r2.x + r2.width <= r1.x ||
    r1.y + r1.height <= r2.y ||
    r2.y + r2.height <= r1.y
  );
}

const DANGEROUS_PATTERNS = [
  /<script/i,
  /javascript:/i,
  /data:/i,
  /onerror=/i,
  /onload=/i,
  /eval\(/i,
  /^https?:\/\//i,
];

export function validateUIPresentationDocument(doc: unknown): UIPresentationValidationResult {
  const errors: UIPresentationValidationError[] = [];

  if (!doc || typeof doc !== 'object') {
    return {
      valid: false,
      errors: [{ code: 'INVALID_ROOT', message: '문서가 유효한 객체가 아닙니다.' }],
    };
  }

  const d = doc as Record<string, unknown>;

  // 1. 게임 수치 / CSV 주입 차단 검사 (루트 및 전체)
  for (const key of FORBIDDEN_GAME_DATA_KEYS) {
    if (key in d) {
      errors.push({
        code: 'GAME_DATA_INJECTION',
        message: `게임 런타임 데이터 속성(${key})은 UI 표시 문서에 포함될 수 없습니다.`,
        path: key,
      });
    }
  }

  // 2. kind 검사
  if (d.kind !== UI_PRESENTATION_ARTIFACT_KIND) {
    errors.push({
      code: 'UNSUPPORTED_KIND',
      message: `지원되지 않는 artifact kind입니다: ${String(d.kind)}`,
      path: 'kind',
    });
  }

  // 3. version 검사
  if (d.version !== UI_PRESENTATION_VERSION) {
    errors.push({
      code: 'UNSUPPORTED_VERSION',
      message: `지원되지 않는 버전입니다: ${String(d.version)}`,
      path: 'version',
    });
  }

  // 4. 해상도 검사
  if (
    !d.resolution ||
    typeof d.resolution !== 'object' ||
    (d.resolution as any).width !== UI_DESIGN_CANVAS.width ||
    (d.resolution as any).height !== UI_DESIGN_CANVAS.height
  ) {
    errors.push({
      code: 'INVALID_RESOLUTION',
      message: `해상도는 1080x2160이어야 합니다.`,
      path: 'resolution',
    });
  }

  // 5. Manifest 검사
  if (d.manifest !== undefined) {
    if (typeof d.manifest !== 'object' || d.manifest === null || !Array.isArray((d.manifest as any).assetIds)) {
      errors.push({
        code: 'INVALID_MANIFEST',
        message: 'manifest는 assetIds 문자열 배열을 포함해야 합니다.',
        path: 'manifest',
      });
    } else {
      const assetIds = (d.manifest as any).assetIds as unknown[];
      for (let i = 0; i < assetIds.length; i++) {
        const aid = assetIds[i];
        if (typeof aid !== 'string') {
          errors.push({
            code: 'INVALID_ASSET_ID',
            message: `assetId는 문자열이어야 합니다.`,
            path: `manifest.assetIds[${i}]`,
          });
        } else {
          for (const pattern of DANGEROUS_PATTERNS) {
            if (pattern.test(aid)) {
              errors.push({
                code: 'SECURITY_VIOLATION',
                message: `manifest의 assetId에 유효하지 않거나 위험한 프로토콜이 포함되어 있습니다.`,
                path: `manifest.assetIds[${i}]`,
              });
              break;
            }
          }
        }
      }
    }
  }

  // 6. 10개 페이지 구성 검사
  if (!d.pages || typeof d.pages !== 'object') {
    errors.push({
      code: 'MISSING_PAGES',
      message: 'pages 객체가 누락되었습니다.',
      path: 'pages',
    });
    return { valid: errors.length === 0, errors };
  }

  const pages = d.pages as Record<string, unknown>;
  const presentPageIds = Object.keys(pages);

  for (const requiredPageId of UI_PRESENTATION_PAGE_IDS) {
    if (!(requiredPageId in pages)) {
      errors.push({
        code: 'MISSING_PAGES',
        message: `필수 페이지 [${requiredPageId}]가 누락되었습니다.`,
        path: `pages.${requiredPageId}`,
      });
    }
  }

  for (const pageKey of presentPageIds) {
    if (!UI_PRESENTATION_PAGE_IDS.includes(pageKey as any)) {
      errors.push({
        code: 'INVALID_PAGE_ID',
        message: `알 수 없는 페이지 ID입니다: ${pageKey}`,
        path: `pages.${pageKey}`,
      });
    }
  }

  // 6. 각 페이지 및 요소 검증
  for (const pageKey of presentPageIds) {
    const pageObj = pages[pageKey];
    if (!pageObj || typeof pageObj !== 'object') continue;
    const page = pageObj as Record<string, unknown>;

    // 페이지 내 게임 수치 검사
    for (const key of FORBIDDEN_GAME_DATA_KEYS) {
      if (key in page) {
        errors.push({
          code: 'GAME_DATA_INJECTION',
          message: `페이지 내 게임 수치 속성(${key})은 포함될 수 없습니다.`,
          path: `pages.${pageKey}.${key}`,
        });
      }
    }

    if (!Array.isArray(page.elements)) {
      errors.push({
        code: 'INVALID_ELEMENTS_ARRAY',
        message: `elements 속성은 배열이어야 합니다.`,
        path: `pages.${pageKey}.elements`,
      });
      continue;
    }

    const elements = page.elements as UIPresentationElement[];
    const elementIdSet = new Set<string>();

    for (let i = 0; i < elements.length; i++) {
      const el = elements[i];
      const elPath = `pages.${pageKey}.elements[${i}]`;

      if (!el || typeof el !== 'object') {
        errors.push({
          code: 'INVALID_ELEMENT',
          message: '요소가 올바른 객체가 아닙니다.',
          path: elPath,
        });
        continue;
      }

      // 닫힌 속성 검사 (UNKNOWN_PROPERTY)
      for (const prop of Object.keys(el)) {
        if (!ALLOWED_ELEMENT_KEYS.has(prop)) {
          errors.push({
            code: 'UNKNOWN_PROPERTY',
            message: `허용되지 않은 속성 [${prop}]이 포함되어 있습니다.`,
            path: `${elPath}.${prop}`,
          });
        }
      }

      // ID 및 중복 검사
      if (!el.id || typeof el.id !== 'string') {
        errors.push({
          code: 'MISSING_ELEMENT_ID',
          message: '요소 ID가 누락되었거나 문자열이 아닙니다.',
          path: `${elPath}.id`,
        });
      } else {
        if (elementIdSet.has(el.id)) {
          errors.push({
            code: 'DUPLICATE_ELEMENT_ID',
            message: `페이지 내 중복된 element ID입니다: ${el.id}`,
            path: `${elPath}.id`,
          });
        }
        elementIdSet.add(el.id);
      }

      // Element type 검사
      if (!ALLOWED_ELEMENT_TYPES.includes(el.type as any)) {
        errors.push({
          code: 'INVALID_ELEMENT_TYPE',
          message: `지원되지 않는 요소 타입입니다: ${String(el.type)}`,
          path: `${elPath}.type`,
        });
      }

      // Bounds 유효성 검사
      if (!isFiniteRect(el.bounds)) {
        errors.push({
          code: 'INVALID_BOUNDS',
          message: 'bounds는 유한하고 0 이상의 크기를 가져야 합니다.',
          path: `${elPath}.bounds`,
        });
      }

      // hitBounds 및 display-hit 일치 검사
      if (el.hitBounds !== undefined) {
        if (!isFiniteRect(el.hitBounds)) {
          errors.push({
            code: 'INVALID_HIT_BOUNDS',
            message: 'hitBounds는 유한하고 0 이상의 크기를 가져야 합니다.',
            path: `${elPath}.hitBounds`,
          });
        } else if (isFiniteRect(el.bounds)) {
          const b = el.bounds;
          const h = el.hitBounds;
          if (
            Math.abs(b.x - h.x) > 0.001 ||
            Math.abs(b.y - h.y) > 0.001 ||
            Math.abs(b.width - h.width) > 0.001 ||
            Math.abs(b.height - h.height) > 0.001
          ) {
            errors.push({
              code: 'DISPLAY_HIT_MISMATCH',
              message: '표시 bounds와 상호작용 hitBounds가 일치하지 않습니다.',
              path: `${elPath}.hitBounds`,
            });
          }
        }
      }

      // actionId 유효성 검사
      if (el.actionId !== undefined) {
        if (!ALLOWED_ACTION_IDS.includes(el.actionId as any)) {
          errors.push({
            code: 'UNKNOWN_ACTION_ID',
            message: `알 수 없는 action ID입니다: ${String(el.actionId)}`,
            path: `${elPath}.actionId`,
          });
        }
      }

      // dynamicBinding 검사
      if (el.dynamicBinding !== undefined) {
        if (!DYNAMIC_FIXTURE_BINDINGS.includes(el.dynamicBinding as any)) {
          errors.push({
            code: 'INVALID_DYNAMIC_BINDING',
            message: `허용되지 않은 동적 fixture 바인딩입니다: ${String(el.dynamicBinding)}`,
            path: `${elPath}.dynamicBinding`,
          });
        }
      }

      // 보안 및 URL/script 검사
      if (el.text && typeof el.text === 'string') {
        for (const pattern of DANGEROUS_PATTERNS) {
          if (pattern.test(el.text)) {
            errors.push({
              code: 'SECURITY_VIOLATION',
              message: `텍스트에 위험한 스크립트나 URL 패턴이 포함되어 있습니다.`,
              path: `${elPath}.text`,
            });
            break;
          }
        }
      }

      if (el.assetId && typeof el.assetId === 'string') {
        for (const pattern of DANGEROUS_PATTERNS) {
          if (pattern.test(el.assetId)) {
            errors.push({
              code: 'SECURITY_VIOLATION',
              message: `assetId에 외부 URL 또는 위험한 프로토콜이 포함되어 있습니다: ${el.assetId}`,
              path: `${elPath}.assetId`,
            });
            break;
          }
        }
      }

      // 보호 영역 침범 검사 (PROTECTED_ZONE_ENCROACHMENT)
      if (isFiniteRect(el.bounds) && !el.isProtected) {
        for (const zone of DEFAULT_PROTECTED_ZONES) {
          if (!zone.pageId || zone.pageId === pageKey) {
            // 침범 검사
            if (rectsIntersect(el.bounds, zone.bounds)) {
              errors.push({
                code: 'PROTECTED_ZONE_ENCROACHMENT',
                message: `요소 [${el.id}]가 보호 영역 [${zone.id}: ${zone.name}]을 침범했습니다.`,
                path: `${elPath}.bounds`,
              });
              break;
            }
          }
        }
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}
