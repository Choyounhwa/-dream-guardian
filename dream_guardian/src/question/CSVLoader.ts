/**
 * CSVLoader - CSV 문제 뱅크 파서
 *
 * questions.csv 12컬럼 데이터를 파싱하고 QuestionRecord 배열로 변환
 *
 * @see Issue #12 (GitHub #77)
 */

import type { QuestionRecord } from '../types/index.js';

/**
 * CSV 문자열을 QuestionRecord 배열로 파싱
 */
export function parseCSV(csvText: string): QuestionRecord[] {
  const lines = csvText.split(/\r?\n/).filter((line) => line.trim().length > 0);
  if (lines.length < 2) return []; // 헤더만 있거나 빈 파일

  // 첫 줄은 헤더 (스킵)
  const records: QuestionRecord[] = [];

  for (let i = 1; i < lines.length; i++) {
    const fields = parseCSVLine(lines[i]);
    if (fields.length < 12) continue;

    const record: QuestionRecord = {
      level: parseInt(fields[0], 10) || 1,
      subLevel: parseInt(fields[1], 10) || 1,
      levelTitle: fields[2],
      subLevelTitle: fields[3],
      questionTemplate: fields[4],
      answerEval: fields[5],
      wrongEval: fields[6],
      varA: fields[7],
      varB: fields[8],
      varC: fields[9],
      varD: fields[10],
      shapeCode: fields[11],
    };

    records.push(record);
  }

  return records;
}

/**
 * CSV 한 줄을 따옴표 인식하여 필드 배열로 분리
 */
function parseCSVLine(line: string): string[] {
  const fields: string[] = [];
  let current = '';
  let inQuote = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];

    if (inQuote) {
      if (ch === '"') {
        // 이스케이프된 따옴표("") 체크
        if (i + 1 < line.length && line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuote = false;
        }
      } else {
        current += ch;
      }
    } else {
      if (ch === '"') {
        inQuote = true;
      } else if (ch === ',') {
        fields.push(current.trim());
        current = '';
      } else {
        current += ch;
      }
    }
  }

  fields.push(current.trim());
  return fields;
}
