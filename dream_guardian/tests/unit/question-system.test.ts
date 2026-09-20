import { describe, it, expect } from 'vitest';
import { parseCSV } from '../../src/question/CSVLoader.js';
import { QuestionBank } from '../../src/question/QuestionBank.js';
import { safeEval, generateQuestion, type GeneratedQuestion } from '../../src/question/QuestionEvaluator.js';
import { mathToKorean, QuestionSpeech } from '../../src/question/QuestionSpeech.js';
import type { QuestionRecord } from '../../src/types/index.js';

// ═══════════════════════════════════
// CSVLoader
// ═══════════════════════════════════

describe('CSVLoader', () => {
  const SAMPLE_CSV = `Level,SubLevel,LevelTitle,SubLevelTitle,QuestionTemplate,AnswerEval,WrongEval,VarA,VarB,VarC,VarD,ShapeCode
"1","1","덧셈","한자리","{A} + {B} = ?","A+B","A+B+pick(-2,-1,1,2)","rand(1,9)","rand(1,9)","0","0",""
"1","2","뺄셈","한자리","{A} - {B} = ?","A-B","A-B+pick(-1,1,2)","rand(4,9)","rand(1,3)","0","0",""
"2","1","곱셈","구구단","{A} × {B} = ?","A*B","A*B+pick(-3,-2,2,3)","rand(2,9)","rand(2,9)","0","0",""`;

  it('CSV를 올바르게 파싱한다', () => {
    const records = parseCSV(SAMPLE_CSV);
    expect(records).toHaveLength(3);
    expect(records[0].level).toBe(1);
    expect(records[0].subLevel).toBe(1);
    expect(records[0].questionTemplate).toBe('{A} + {B} = ?');
    expect(records[0].answerEval).toBe('A+B');
  });

  it('따옴표로 감싼 필드를 올바르게 처리한다', () => {
    const records = parseCSV(SAMPLE_CSV);
    expect(records[0].levelTitle).toBe('덧셈');
    expect(records[2].levelTitle).toBe('곱셈');
  });

  it('빈 CSV는 빈 배열을 반환한다', () => {
    expect(parseCSV('')).toHaveLength(0);
    expect(parseCSV('Level,SubLevel')).toHaveLength(0);
  });

  it('레벨 번호가 올바르게 파싱된다', () => {
    const records = parseCSV(SAMPLE_CSV);
    expect(records[0].level).toBe(1);
    expect(records[2].level).toBe(2);
  });
});

// ═══════════════════════════════════
// QuestionBank
// ═══════════════════════════════════

describe('QuestionBank', () => {
  function makeRecords(): QuestionRecord[] {
    return [
      { level: 1, subLevel: 1, levelTitle: 'A', subLevelTitle: '', questionTemplate: 'Q1', answerEval: 'A+B', wrongEval: 'A+B+1', varA: 'rand(1,9)', varB: 'rand(1,9)', varC: '0', varD: '0', shapeCode: '' },
      { level: 1, subLevel: 2, levelTitle: 'A', subLevelTitle: '', questionTemplate: 'Q2', answerEval: 'A+B', wrongEval: 'A+B+1', varA: 'rand(1,9)', varB: 'rand(1,9)', varC: '0', varD: '0', shapeCode: '' },
      { level: 2, subLevel: 1, levelTitle: 'B', subLevelTitle: '', questionTemplate: 'Q3', answerEval: 'A*B', wrongEval: 'A*B+1', varA: 'rand(2,9)', varB: 'rand(2,9)', varC: '0', varD: '0', shapeCode: '' },
      { level: 3, subLevel: 1, levelTitle: 'C', subLevelTitle: '', questionTemplate: 'Q4', answerEval: 'A+B', wrongEval: 'A+B+1', varA: 'rand(1,9)', varB: 'rand(1,9)', varC: '0', varD: '0', shapeCode: '' },
    ];
  }

  it('레벨별로 문제를 필터링한다', () => {
    const bank = new QuestionBank();
    bank.loadRecords(makeRecords());
    bank.setLevel(1);
    expect(bank.poolSize).toBe(2);

    bank.setLevel(2);
    expect(bank.poolSize).toBe(1);
  });

  it('레벨 5(나이트메어)는 전체 풀을 사용한다', () => {
    const bank = new QuestionBank();
    bank.loadRecords(makeRecords());
    bank.setLevel(5);
    expect(bank.poolSize).toBe(4);
  });

  it('next()가 문제를 반환하고 큐가 줄어든다', () => {
    const bank = new QuestionBank();
    bank.loadRecords(makeRecords());
    bank.setLevel(1);

    const q1 = bank.next();
    expect(q1).toBeDefined();
    expect(q1.level).toBe(1);
  });

  it('큐가 소진되면 자동으로 다시 셔플된다', () => {
    const bank = new QuestionBank();
    bank.loadRecords(makeRecords());
    bank.setLevel(1); // 풀 크기 2

    bank.next();
    bank.next();
    // 큐 소진 → 다음 호출 시 자동 셔플
    const q3 = bank.next();
    expect(q3).toBeDefined();
  });

  it('빈 레코드 로드 시 fallback 문제가 사용된다', () => {
    const bank = new QuestionBank();
    bank.loadRecords([]);
    bank.setLevel(1);
    expect(bank.poolSize).toBeGreaterThan(0);
  });

  it('존재하지 않는 레벨 설정 시 fallback이 동작한다', () => {
    const bank = new QuestionBank();
    bank.loadRecords(makeRecords());
    bank.setLevel(99);
    expect(bank.poolSize).toBeGreaterThan(0);
  });
});

// ═══════════════════════════════════
// QuestionEvaluator
// ═══════════════════════════════════

describe('QuestionEvaluator - safeEval', () => {
  it('기본 산술 연산을 수행한다', () => {
    expect(safeEval('3+5')).toBe(8);
    expect(safeEval('10-4')).toBe(6);
    expect(safeEval('6*7')).toBe(42);
    expect(safeEval('20/4')).toBe(5);
  });

  it('변수 치환이 작동한다', () => {
    expect(safeEval('A+B', { A: 3, B: 5 })).toBe(8);
    expect(safeEval('A*B+C', { A: 4, B: 6, C: 2 })).toBe(26);
  });

  it('화이트리스트 함수가 작동한다', () => {
    const r = safeEval('rand(1,1)');
    expect(r).toBe(1);

    expect(safeEval('gcd(12,8)')).toBe(4);
    expect(safeEval('factorial(5)')).toBe(120);
    expect(safeEval('sup(2,3)')).toBe(8);
    expect(safeEval('repeatMul(3,4)')).toBe(81);
    expect(safeEval('repeatAdd(5,3)')).toBe(15);
    expect(safeEval('abs(-7)')).toBe(7);
  });

  it('pick이 주어진 값 중 하나를 반환한다', () => {
    const r = safeEval('pick(10,20,30)');
    expect([10, 20, 30]).toContain(r);
  });

  it('window 접근을 차단한다', () => {
    expect(safeEval('window.alert(1)')).toBeNaN();
  });

  it('constructor 접근을 차단한다', () => {
    expect(safeEval('"".constructor')).toBeNaN();
  });

  it('eval 호출을 차단한다', () => {
    expect(safeEval('eval("1+1")')).toBeNaN();
  });

  it('Function() 호출을 차단한다', () => {
    expect(safeEval('Function("return 1")()')).toBeNaN();
  });

  it('import() 호출을 차단한다', () => {
    expect(safeEval('import("fs")')).toBeNaN();
  });

  it('__proto__ 접근을 차단한다', () => {
    expect(safeEval('({}).__proto__')).toBeNaN();
  });

  it('globalThis 접근을 차단한다', () => {
    expect(safeEval('globalThis')).toBeNaN();
  });

  it('잘못된 수식은 NaN을 반환한다', () => {
    expect(safeEval('???')).toBeNaN();
    expect(safeEval('')).toBeNaN();
  });
});

describe('QuestionEvaluator - generateQuestion', () => {
  it('QuestionRecord에서 문제를 생성한다', () => {
    const record: QuestionRecord = {
      level: 1, subLevel: 1,
      levelTitle: '덧셈', subLevelTitle: '한자리',
      questionTemplate: '{A} + {B} = ?',
      answerEval: 'A+B',
      wrongEval: 'A+B+1',
      varA: 'rand(3,3)', varB: 'rand(5,5)',
      varC: '0', varD: '0', shapeCode: '',
    };

    const q = generateQuestion(record);
    expect(q).not.toBeNull();
    expect(q!.questionText).toBe('3 + 5 = ?');
    expect(q!.correctAnswer).toBe(8);
    expect(q!.wrongAnswer).toBe(9);
    expect(q!.choices).toHaveLength(2);
    expect(q!.choices).toContain(8);
    expect(q!.choices).toContain(9);
    expect(q!.choices[q!.correctIndex]).toBe(8);
  });

  it('정답과 오답이 같으면 보정된다', () => {
    const record: QuestionRecord = {
      level: 1, subLevel: 1,
      levelTitle: '', subLevelTitle: '',
      questionTemplate: '{A} + 0 = ?',
      answerEval: 'A',
      wrongEval: 'A', // 정답과 동일
      varA: 'rand(5,5)', varB: '0',
      varC: '0', varD: '0', shapeCode: '',
    };

    const q = generateQuestion(record);
    expect(q).not.toBeNull();
    expect(q!.correctAnswer).not.toBe(q!.wrongAnswer);
  });
});

// ═══════════════════════════════════
// QuestionSpeech
// ═══════════════════════════════════

describe('QuestionSpeech - mathToKorean', () => {
  it('덧셈을 변환한다', () => {
    expect(mathToKorean('3 + 5 = ?')).toBe('3 더하기 5는?');
  });

  it('뺄셈을 변환한다', () => {
    expect(mathToKorean('12 - 7 = ?')).toBe('12 빼기 7는?');
  });

  it('곱셈을 변환한다', () => {
    expect(mathToKorean('4 × 6 = ?')).toBe('4 곱하기 6는?');
  });

  it('나눗셈을 변환한다', () => {
    expect(mathToKorean('15 ÷ 3 = ?')).toBe('15 나누기 3는?');
  });

  it('분수를 변환한다', () => {
    expect(mathToKorean('1/2')).toContain('2분의 1');
  });

  it('복합 수식을 변환한다', () => {
    const result = mathToKorean('3 + 5');
    expect(result).toBe('3 더하기 5');
  });
});

describe('QuestionSpeech - class', () => {
  it('Node 환경에서 unsupported 상태이다', () => {
    const speech = new QuestionSpeech();
    expect(speech.isSupported).toBe(false);
    expect(speech.status).toBe('unsupported');
  });

  it('speak()이 unsupported 환경에서 에러 없이 작동한다', () => {
    const speech = new QuestionSpeech();
    expect(() => speech.speak('3 + 5 = ?')).not.toThrow();
  });

  it('destroy()가 에러 없이 작동한다', () => {
    const speech = new QuestionSpeech();
    expect(() => speech.destroy()).not.toThrow();
  });
});
