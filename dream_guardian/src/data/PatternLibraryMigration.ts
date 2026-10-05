/**
 * PatternLibraryMigration.ts - 피트니스 패턴 라이브러리 순수 병합 및 무손실 변환
 *
 * Issue #378 / EDITOR-MIGRATE:
 * - 순수 함수 mergePatternLibrary(existingPatterns, importedPatterns, options): PatternMergeResult
 * - CSV/JSON 패턴 지원 (패턴 엔티티만 수입, 시퀀스 혼입 배제)
 * - 결정적 ID 충돌 처리 정책 ('skip' | 'overwrite' | 'rename') 및 remap 매핑 반환
 * - AuthoringPattern (EditorPattern) 정규화 및 검증
 * - 입력 원본 불변성 100% 보장 (mutation 0회)
 */

import type { EditorPattern, EditorPatternTarget } from './EditorProject.js';
import { parseFitnessPatternCSV } from './FitnessPatternLoader.js';

export type AuthoringPattern = EditorPattern;

export type PatternCollisionPolicy = 'skip' | 'overwrite' | 'rename';

export interface MergeOptions {
  collisionPolicy?: PatternCollisionPolicy;
  prefix?: string;
}

export interface MigrationDiagnostic {
  code: string;
  message: string;
  severity: 'error' | 'warning' | 'info';
  path?: string;
  entityId?: string;
}

export interface PatternMergeResult {
  success: boolean;
  patterns: AuthoringPattern[];
  importedCount: number;
  skippedCount: number;
  overwrittenCount: number;
  renamedCount: number;
  idRemap: Record<string, string>;
  errors: string[];
  warnings: string[];
  diagnostics: MigrationDiagnostic[];
}

/**
 * 임의의 객체에서 순수 AuthoringPattern으로 정규화
 */
export function normalizeAuthoringPattern(
  item: unknown,
  diagnostics: MigrationDiagnostic[],
  index: number,
): AuthoringPattern | null {
  if (item === null || typeof item !== 'object') {
    diagnostics.push({
      code: 'invalid-pattern-item',
      message: `Item at index ${index} is not an object`,
      severity: 'error',
    });
    return null;
  }

  const rec = item as Record<string, unknown>;

  // Check and report sequence mixing
  if ('sequences' in rec || 'sequence' in rec) {
    diagnostics.push({
      code: 'sequence-mixing-detected',
      message: `Item "${String(rec.id ?? index)}" contains sequence data which was excluded from library pattern import`,
      severity: 'warning',
      entityId: typeof rec.id === 'string' ? rec.id : undefined,
    });
  }

  const rawId = rec.id ?? (rec as any).patternId;
  if (typeof rawId !== 'string' || rawId.trim().length === 0) {
    diagnostics.push({
      code: 'missing-pattern-id',
      message: `Pattern at index ${index} has missing or empty id`,
      severity: 'error',
    });
    return null;
  }
  const id = rawId.trim();

  const name =
    typeof rec.name === 'string' && rec.name.trim().length > 0
      ? rec.name.trim()
      : id;

  const description =
    typeof rec.description === 'string' ? rec.description : undefined;

  // Target extraction
  let target: EditorPatternTarget = {
    leftHand: null,
    rightHand: null,
    head: null,
    hip: null,
  };

  const parseZone = (v: unknown): number | null => {
    if (v === null || v === undefined || v === 'X' || v === 'x') return null;
    const n = Number(v);
    return Number.isInteger(n) && n > 0 ? n : null;
  };

  if (rec.target !== null && typeof rec.target === 'object') {
    const t = rec.target as Record<string, unknown>;
    target = {
      leftHand: parseZone(t.leftHand),
      rightHand: parseZone(t.rightHand),
      head: parseZone(t.head),
      hip: parseZone(t.hip),
    };
  } else {
    target = {
      leftHand: parseZone(rec.leftHand),
      rightHand: parseZone(rec.rightHand),
      head: parseZone(rec.head),
      hip: parseZone(rec.hip),
    };
  }

  return {
    id,
    name,
    target,
    ...(description ? { description } : {}),
  };
}

/**
 * CSV 문자열을 AuthoringPattern 배열로 변환
 */
export function parsePatternLibraryFromCSV(csvText: string): AuthoringPattern[] {
  const records = parseFitnessPatternCSV(csvText);
  return records.map((r) => ({
    id: r.id,
    name: r.name,
    target: {
      leftHand: r.leftHand,
      rightHand: r.rightHand,
      head: r.head,
      hip: r.hip,
    },
    description: `Pattern type: ${r.patternType}, parts: ${r.parts.join('+')}`,
  }));
}

/**
 * 기존 패턴 목록에 새 패턴들을 순수하게 병합
 */
export function mergePatternLibrary(
  existingPatterns: readonly AuthoringPattern[],
  importedPatterns: unknown[] | string,
  options?: MergeOptions,
): PatternMergeResult {
  const policy: PatternCollisionPolicy = options?.collisionPolicy ?? 'rename';
  const errors: string[] = [];
  const warnings: string[] = [];
  const diagnostics: MigrationDiagnostic[] = [];
  const idRemap: Record<string, string> = {};

  // Parse CSV if string input
  let itemsToProcess: unknown[] = [];
  if (typeof importedPatterns === 'string') {
    itemsToProcess = parsePatternLibraryFromCSV(importedPatterns);
  } else if (Array.isArray(importedPatterns)) {
    itemsToProcess = [...importedPatterns];
  } else {
    errors.push('importedPatterns must be an array or CSV string');
    return {
      success: false,
      patterns: existingPatterns.map((p) => ({ ...p, target: { ...p.target } })),
      importedCount: 0,
      skippedCount: 0,
      overwrittenCount: 0,
      renamedCount: 0,
      idRemap: {},
      errors,
      warnings,
      diagnostics: [
        {
          code: 'invalid-imported-patterns-type',
          message: 'importedPatterns must be an array or CSV string',
          severity: 'error',
        },
      ],
    };
  }

  // Deep clone existing patterns
  const resultPatterns: AuthoringPattern[] = existingPatterns.map((p) => ({
    id: p.id,
    name: p.name,
    target: { ...p.target },
    ...(p.description !== undefined ? { description: p.description } : {}),
  }));

  // Index map of current pattern IDs -> index in resultPatterns
  const existingMap = new Map<string, number>();
  for (let i = 0; i < resultPatterns.length; i++) {
    existingMap.set(resultPatterns[i].id, i);
  }

  let importedCount = 0;
  let skippedCount = 0;
  let overwrittenCount = 0;
  let renamedCount = 0;

  for (let i = 0; i < itemsToProcess.length; i++) {
    const normalized = normalizeAuthoringPattern(itemsToProcess[i], diagnostics, i);
    if (!normalized) {
      continue;
    }

    const origId = normalized.id;

    if (existingMap.has(origId)) {
      if (policy === 'skip') {
        skippedCount++;
        idRemap[origId] = origId;
        diagnostics.push({
          code: 'pattern-collision-skipped',
          message: `Pattern with id "${origId}" already exists; skipped.`,
          severity: 'info',
          entityId: origId,
        });
        continue;
      }

      if (policy === 'overwrite') {
        const targetIdx = existingMap.get(origId)!;
        resultPatterns[targetIdx] = normalized;
        overwrittenCount++;
        idRemap[origId] = origId;
        diagnostics.push({
          code: 'pattern-collision-overwritten',
          message: `Pattern with id "${origId}" overwritten.`,
          severity: 'info',
          entityId: origId,
        });
        continue;
      }

      // 'rename' policy
      let suffix = 1;
      let newId = `${origId}_copy`;
      while (existingMap.has(newId)) {
        suffix++;
        newId = `${origId}_copy_${suffix}`;
      }

      const renamedPattern: AuthoringPattern = {
        ...normalized,
        id: newId,
        name: `${normalized.name} (Copy)`,
      };

      resultPatterns.push(renamedPattern);
      existingMap.set(newId, resultPatterns.length - 1);
      renamedCount++;
      idRemap[origId] = newId;
      diagnostics.push({
        code: 'pattern-collision-renamed',
        message: `Pattern with id "${origId}" collided; renamed to "${newId}".`,
        severity: 'info',
        entityId: newId,
      });
      continue;
    }

    // Fresh pattern without collision
    resultPatterns.push(normalized);
    existingMap.set(origId, resultPatterns.length - 1);
    importedCount++;
    idRemap[origId] = origId;
  }

  // Collect warnings
  for (const d of diagnostics) {
    if (d.severity === 'warning') {
      warnings.push(d.message);
    } else if (d.severity === 'error') {
      errors.push(d.message);
    }
  }

  return {
    success: errors.length === 0,
    patterns: resultPatterns,
    importedCount,
    skippedCount,
    overwrittenCount,
    renamedCount,
    idRemap,
    errors,
    warnings,
    diagnostics,
  };
}
