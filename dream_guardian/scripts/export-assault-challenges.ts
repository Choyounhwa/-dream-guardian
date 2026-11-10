/**
 * export-assault-challenges.ts - 챌린지 문제 CSV 오프라인 내보내기 스크립트
 *
 * @see docs/18_ASSAULT_CHALLENGE_QUESTION_SYSTEM.md (§§4.1, 5, 11.2)
 * @see Issue #666 [ASSAULT-CHALLENGE-CH-20]
 *
 * 실행 방법:
 *   npx vite-node scripts/export-assault-challenges.ts --seed 1007 --rows 20 --out assault_challenges.csv
 *
 * 기능:
 * 1. 14개 유형 카탈로그(ASSAULT_CHALLENGE_CATALOG)를 순회하며 각 유형별 rows 개수만큼 라운드 생성(pairCount=config.pairsPerRow, CH-23 / #680).
 * 2. RuleHunt, Duel, Equivalence, Progression 생성기 및 ChallengePairValidator, ChallengeCsvValidator 교차 검증.
 * 3. 검증 실패 시 결정론적 재시도(attempt)를 거쳐 무결성 보장.
 * 4. id: {variant접두}-{0001~0020} 부여.
 * 5. 같은 seed·rows 시 100% 바이트 동일 CSV 출력 (결정론적 불변성).
 * 6. 오류 0건일 때 파일로 저장하고 프로세스 종료 코드 0 반환.
 */

import fs from 'node:fs';
import path from 'node:path';
import { DEFAULT_ASSAULT_CHALLENGE_CONFIG } from '../config/assault-challenge.config.js';
import { ASSAULT_CHALLENGE_CATALOG } from '../src/data/assault/challengeCatalog.js';
import type {
  AssaultChallengeFamily,
} from '../src/types/assaultChallenge.js';
import {
  generateRuleHuntRound,
  type RuleHuntVariantId,
} from '../src/question/challenge/RuleHuntGenerator.js';
import {
  generateDuelRound,
  type DuelVariantId,
} from '../src/question/challenge/DuelGenerator.js';
import {
  generateEquivalenceRound,
  type EquivalenceVariantId,
} from '../src/question/challenge/EquivalenceGenerator.js';
import {
  generateProgressionRound,
  type ProgressionVariantId,
} from '../src/question/challenge/ProgressionGenerator.js';
import { validateChallengeRound } from '../src/question/challenge/ChallengePairValidator.js';
import {
  validateChallengeCsvRow,
  validateChallengeCsvText,
  type ChallengeCsvRow,
} from '../src/question/challenge/ChallengeCsvValidator.js';
import type { AssaultAnswerPair } from '../src/question/AssaultAnswerPairFactory.js';
import {
  writeChallengeCsv,
  roundToChallengeCsvRow,
  type GenericChallengeRound,
} from '../src/question/challenge/ChallengeCsvWriter.js';
import { deepFreeze } from '../src/utils/deepFreeze.js';

/** 내보내기 CLI 옵션 */
export interface ExportOptions {
  readonly seed?: number;
  readonly rows?: number;
  readonly out?: string;
  readonly writeToFile?: boolean;
}

/** 유형별 생성 리포트 */
export interface ExportVariantReport {
  readonly variantId: string;
  readonly generatedCount: number;
  readonly retryCount: number;
  readonly errors: readonly string[];
}

/** 전체 생성 및 검증 종합 리포트 */
export interface ExportReport {
  readonly seed: number;
  readonly rowsPerVariant: number;
  readonly totalRows: number;
  readonly validationErrors: number;
  readonly variants: readonly ExportVariantReport[];
}

/** 내보내기 실행 결과 */
export interface ExportResult {
  readonly success: boolean;
  readonly rowCount: number;
  readonly csvText: string;
  readonly report: ExportReport;
  readonly outputPath?: string;
}

/**
 * CLI 인자 파서
 */
export function parseCliArgs(args: readonly string[]): ExportOptions {
  let seed: number | undefined;
  let rows: number | undefined;
  let out: string | undefined;

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--seed' && i + 1 < args.length) {
      seed = parseInt(args[++i], 10);
    } else if (arg === '--rows' && i + 1 < args.length) {
      rows = parseInt(args[++i], 10);
    } else if (arg === '--out' && i + 1 < args.length) {
      out = args[++i];
    }
  }

  return { seed, rows, out };
}

/**
 * 계열별 라운드 생성 헬퍼 (순수 디스패치)
 */
function generateRoundForFamily(
  family: AssaultChallengeFamily,
  variantId: string,
  seed: number,
): GenericChallengeRound<AssaultAnswerPair> {
  const pairCount = DEFAULT_ASSAULT_CHALLENGE_CONFIG.pairsPerRow;

  switch (family) {
    case 'rule_hunt': {
      const res = generateRuleHuntRound({
        variantId: variantId as RuleHuntVariantId,
        pairCount,
        seed,
      });
      return {
        variantId: res.variantId,
        family: res.family,
        questionText: res.questionText,
        params: res.params,
        pairs: res.pairs,
      };
    }
    case 'duel': {
      const res = generateDuelRound({
        variantId: variantId as DuelVariantId,
        pairCount,
        seed,
      });
      return {
        variantId: res.variantId,
        family: res.family,
        questionText: res.questionText,
        params: res.params,
        pairs: res.pairs,
      };
    }
    case 'equivalence': {
      const res = generateEquivalenceRound({
        variantId: variantId as EquivalenceVariantId,
        pairCount,
        seed,
      });
      return {
        variantId: res.variantId,
        family: res.family,
        questionText: res.questionText,
        params: res.params,
        pairs: res.pairs,
      };
    }
    case 'progression': {
      const res = generateProgressionRound({
        variantId: variantId as ProgressionVariantId,
        pairCount,
        seed,
      });
      return {
        variantId: res.variantId,
        family: res.family,
        questionText: res.questionText,
        params: res.params,
        pairs: res.pairs,
        pairPrompts: res.pairPrompts,
      };
    }
    default:
      throw new Error(`[Export] Unsupported family: "${family}"`);
  }
}

/**
 * 챌린지 문제 CSV 생성 및 검증 핵심 함수
 */
export function exportAssaultChallenges(options: ExportOptions = {}): ExportResult {
  const baseSeed = options.seed ?? 1007;
  const rowsPerVariant = options.rows ?? DEFAULT_ASSAULT_CHALLENGE_CONFIG.rowsPerVariant;
  const outPath = options.out ?? 'assault_challenges.csv';
  const writeToFile = options.writeToFile ?? false;

  const allRows: ChallengeCsvRow[] = [];
  const variantReports: ExportVariantReport[] = [];
  let totalValidationErrors = 0;

  const catalogEntries = Object.values(ASSAULT_CHALLENGE_CATALOG);

  for (let vIdx = 0; vIdx < catalogEntries.length; vIdx++) {
    const catalogDef = catalogEntries[vIdx];
    const variantId = catalogDef.variantId;
    const family = catalogDef.family;
    const prefix = variantId.split('_')[0];

    const variantErrors: string[] = [];
    let variantRetries = 0;
    let generatedCount = 0;

    for (let r = 1; r <= rowsPerVariant; r++) {
      const rowId = `${prefix}-${String(r).padStart(4, '0')}`;
      const chapter = catalogDef.chapters[(r - 1) % catalogDef.chapters.length];
      const level = chapter; // 챕터 난이도와 동기화 (정수 >= 1)

      let rowCandidate: ChallengeCsvRow | null = null;
      let isCandidateValid = false;
      const maxAttempts = 50;

      for (let attempt = 0; attempt < maxAttempts; attempt++) {
        // 결정론적 seed 산출: baseSeed + (vIdx * 1000) + (r - 1) + (attempt * 100000)
        const rowSeed = baseSeed + vIdx * 1000 + (r - 1) + attempt * 100000;

        try {
          const round = generateRoundForFamily(family, variantId, rowSeed);

          // 1. ChallengePairValidator를 통한 계열별 불변식 및 라운드 검증
          const pairValidation = validateChallengeRound({
            variantId: round.variantId,
            family: round.family as AssaultChallengeFamily,
            questionText: round.questionText,
            pairPrompts: round.pairPrompts ?? round.pairs.map(() => null),
            params: round.params,
            pairs: round.pairs,
          });

          if (!pairValidation.isValid) {
            variantRetries++;
            continue;
          }

          // 2. ChallengeCsvRow 객체로 변환
          const row = roundToChallengeCsvRow(round, {
            id: rowId,
            chapter,
            level,
            seed: rowSeed,
            rulesVersion: '1.0.0',
            reviewStatus: 'draft',
          });

          // 3. ChallengeCsvValidator를 통한 행 단위 독립 검증
          const rowErrors = validateChallengeCsvRow(row);
          if (rowErrors.length > 0) {
            variantRetries++;
            continue;
          }

          rowCandidate = row;
          isCandidateValid = true;
          break;
        } catch (e) {
          variantRetries++;
        }
      }

      if (isCandidateValid && rowCandidate) {
        allRows.push(rowCandidate);
        generatedCount++;
      } else {
        const errMsg = `Failed to generate valid row for ${rowId} after ${maxAttempts} attempts`;
        variantErrors.push(errMsg);
        totalValidationErrors++;
      }
    }

    variantReports.push({
      variantId,
      generatedCount,
      retryCount: variantRetries,
      errors: variantErrors,
    });
  }

  // 4. 전체 CSV 직렬화
  const csvText = writeChallengeCsv(allRows);

  // 5. 생성된 전체 CSV 텍스트 최종 회귀 검증
  const textValidation = validateChallengeCsvText(csvText);
  if (!textValidation.isValid) {
    totalValidationErrors += textValidation.errors.length;
  }

  const success = totalValidationErrors === 0 && allRows.length === catalogEntries.length * rowsPerVariant;

  // 6. 파일 저장 처리
  let resolvedOutputPath: string | undefined;
  if (success && writeToFile) {
    resolvedOutputPath = path.resolve(process.cwd(), outPath);
    const parentDir = path.dirname(resolvedOutputPath);
    if (!fs.existsSync(parentDir)) {
      fs.mkdirSync(parentDir, { recursive: true });
    }
    fs.writeFileSync(resolvedOutputPath, csvText, 'utf-8');
  }

  const report: ExportReport = deepFreeze({
    seed: baseSeed,
    rowsPerVariant,
    totalRows: allRows.length,
    validationErrors: totalValidationErrors,
    variants: variantReports,
  });

  return deepFreeze({
    success,
    rowCount: allRows.length,
    csvText,
    report,
    outputPath: resolvedOutputPath,
  });
}

// CLI 직접 실행 시 처리 (Vitest 테스트 러너 실행 중에는 자동 실행 방지)
const isDirectRun = !process.env.VITEST;

if (isDirectRun) {
  const cliArgs = parseCliArgs(process.argv.slice(2));
  const result = exportAssaultChallenges({
    seed: cliArgs.seed ?? 1007,
    rows: cliArgs.rows ?? DEFAULT_ASSAULT_CHALLENGE_CONFIG.rowsPerVariant,
    out: cliArgs.out ?? 'assault_challenges.csv',
    writeToFile: true,
  });

  if (!result.success) {
    console.error(
      `[Export] Failed with ${result.report.validationErrors} errors. Generated ${result.rowCount} rows.`,
    );
    for (const v of result.report.variants) {
      if (v.errors.length > 0) {
        console.error(` - ${v.variantId}: ${v.errors.join('; ')}`);
      }
    }
    process.exit(1);
  } else {
    console.log(
      `[Export] Successfully exported ${result.rowCount} challenge rows to: ${result.outputPath}`,
    );
    process.exit(0);
  }
}
