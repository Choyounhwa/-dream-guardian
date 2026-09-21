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

  it('Ch.1~4에서 subLevel을 지정하면 해당 세부 단계만 필터링한다', () => {
    const bank = new QuestionBank();
    bank.loadRecords(makeRecords());
    bank.setLevel(1, 1);
    expect(bank.poolSize).toBe(1);
    expect(bank.currentSubLevel).toBe(1);
    expect(bank.next().subLevel).toBe(1);

    bank.setLevel(1, 2);
    expect(bank.poolSize).toBe(1);
    expect(bank.currentSubLevel).toBe(2);
    expect(bank.next().subLevel).toBe(2);
  });

  it('Ch.5(나이트메어)에서 subLevel 1~5는 Level 5~9로 매핑된다', () => {
    const bank = new QuestionBank();
    const extendedRecords: QuestionRecord[] = [
      { level: 1, subLevel: 1, levelTitle: '덧셈', subLevelTitle: '', questionTemplate: 'Q1', answerEval: '1', wrongEval: '2', varA: '0', varB: '0', varC: '0', varD: '0', shapeCode: '' },
      { level: 5, subLevel: 1, levelTitle: '제곱', subLevelTitle: '', questionTemplate: 'Q5', answerEval: '1', wrongEval: '2', varA: '0', varB: '0', varC: '0', varD: '0', shapeCode: '' },
      { level: 6, subLevel: 1, levelTitle: '2진수', subLevelTitle: '', questionTemplate: 'Q6', answerEval: '1', wrongEval: '2', varA: '0', varB: '0', varC: '0', varD: '0', shapeCode: '' },
      { level: 7, subLevel: 1, levelTitle: '도형', subLevelTitle: '', questionTemplate: 'Q7', answerEval: '1', wrongEval: '2', varA: '0', varB: '0', varC: '0', varD: '0', shapeCode: '' },
      { level: 8, subLevel: 1, levelTitle: '비율', subLevelTitle: '', questionTemplate: 'Q8', answerEval: '1', wrongEval: '2', varA: '0', varB: '0', varC: '0', varD: '0', shapeCode: '' },
      { level: 9, subLevel: 1, levelTitle: '기타', subLevelTitle: '', questionTemplate: 'Q9', answerEval: '1', wrongEval: '2', varA: '0', varB: '0', varC: '0', varD: '0', shapeCode: '' },
    ];
    bank.loadRecords(extendedRecords);

    // subLevel 1 -> Level 5 (거듭제곱)
    bank.setLevel(5, 1);
    expect(bank.poolSize).toBe(1);
    expect(bank.next().level).toBe(5);

    // subLevel 2 -> Level 6 (2진수)
    bank.setLevel(5, 2);
    expect(bank.poolSize).toBe(1);
    expect(bank.next().level).toBe(6);

    // subLevel 3 -> Level 7 (도형)
    bank.setLevel(5, 3);
    expect(bank.poolSize).toBe(1);
    expect(bank.next().level).toBe(7);

    // subLevel 4 -> Level 8 (비율)
    bank.setLevel(5, 4);
    expect(bank.poolSize).toBe(1);
    expect(bank.next().level).toBe(8);

    // subLevel 5 -> Level 9 (기타)
    bank.setLevel(5, 5);
    expect(bank.poolSize).toBe(1);
    expect(bank.next().level).toBe(9);

    // subLevel 6 또는 미지정 -> 전 영역 종합 풀
    bank.setLevel(5, 6);
    expect(bank.poolSize).toBe(6);
    bank.setLevel(5);
    expect(bank.poolSize).toBe(6);
  });

  it('getSubLevels가 챕터별 세부 단계 목록을 올바르게 반환한다', () => {
    const bank = new QuestionBank();
    const records: QuestionRecord[] = [
      { level: 1, subLevel: 1, levelTitle: '덧셈', subLevelTitle: '한자리', questionTemplate: 'Q1', answerEval: '1', wrongEval: '2', varA: '0', varB: '0', varC: '0', varD: '0', shapeCode: '' },
      { level: 1, subLevel: 1, levelTitle: '덧셈', subLevelTitle: '한자리', questionTemplate: 'Q1-2', answerEval: '1', wrongEval: '2', varA: '0', varB: '0', varC: '0', varD: '0', shapeCode: '' },
      { level: 1, subLevel: 2, levelTitle: '덧셈', subLevelTitle: '두자리', questionTemplate: 'Q2', answerEval: '1', wrongEval: '2', varA: '0', varB: '0', varC: '0', varD: '0', shapeCode: '' },
    ];
    bank.loadRecords(records);

    const subsCh1 = bank.getSubLevels(1);
    expect(subsCh1.length).toBe(2);
    expect(subsCh1[0]).toEqual({ subLevel: 1, title: '한자리', count: 2 });
    expect(subsCh1[1]).toEqual({ subLevel: 2, title: '두자리', count: 1 });

    const subsCh5 = bank.getSubLevels(5);
    expect(subsCh5.length).toBe(6);
    expect(subsCh5[0].title).toBe('거듭제곱');
    expect(subsCh5[5].title).toBe('전 영역 종합');
  });

  it('레벨 5(나이트메어)는 미지정 시 전체 풀을 사용한다', () => {
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

  it('풀 크기 5인 상태에서 100회 시행(각 20회 next()) 시 연속 동일 템플릿 0회', () => {
    const records: QuestionRecord[] = [
      { level: 1, subLevel: 1, levelTitle: '', subLevelTitle: '', questionTemplate: 'T1', answerEval: '1', wrongEval: '2', varA: '0', varB: '0', varC: '0', varD: '0', shapeCode: '' },
      { level: 1, subLevel: 1, levelTitle: '', subLevelTitle: '', questionTemplate: 'T2', answerEval: '1', wrongEval: '2', varA: '0', varB: '0', varC: '0', varD: '0', shapeCode: '' },
      { level: 1, subLevel: 1, levelTitle: '', subLevelTitle: '', questionTemplate: 'T3', answerEval: '1', wrongEval: '2', varA: '0', varB: '0', varC: '0', varD: '0', shapeCode: '' },
      { level: 1, subLevel: 1, levelTitle: '', subLevelTitle: '', questionTemplate: 'T4', answerEval: '1', wrongEval: '2', varA: '0', varB: '0', varC: '0', varD: '0', shapeCode: '' },
      { level: 1, subLevel: 1, levelTitle: '', subLevelTitle: '', questionTemplate: 'T5', answerEval: '1', wrongEval: '2', varA: '0', varB: '0', varC: '0', varD: '0', shapeCode: '' },
    ];

    let totalDuplicates = 0;
    for (let t = 0; t < 100; t++) {
      const bank = new QuestionBank();
      bank.loadRecords(records);
      bank.setLevel(1);
      let prevTemplate = '';
      for (let i = 0; i < 20; i++) {
        const q = bank.next();
        if (q.questionTemplate === prevTemplate) {
          totalDuplicates++;
        }
        prevTemplate = q.questionTemplate;
      }
    }
    expect(totalDuplicates).toBe(0);
  });

  it('동일 템플릿이 중복 포함된 풀(T1, T1, T2, T3, T4)에서도 100회 시행 시 연속 동일 템플릿 0회', () => {
    const records: QuestionRecord[] = [
      { level: 1, subLevel: 1, levelTitle: '', subLevelTitle: '', questionTemplate: 'T1', answerEval: '1', wrongEval: '2', varA: '0', varB: '0', varC: '0', varD: '0', shapeCode: '' },
      { level: 1, subLevel: 1, levelTitle: '', subLevelTitle: '', questionTemplate: 'T1', answerEval: '1', wrongEval: '2', varA: '0', varB: '0', varC: '0', varD: '0', shapeCode: '' },
      { level: 1, subLevel: 1, levelTitle: '', subLevelTitle: '', questionTemplate: 'T2', answerEval: '1', wrongEval: '2', varA: '0', varB: '0', varC: '0', varD: '0', shapeCode: '' },
      { level: 1, subLevel: 1, levelTitle: '', subLevelTitle: '', questionTemplate: 'T3', answerEval: '1', wrongEval: '2', varA: '0', varB: '0', varC: '0', varD: '0', shapeCode: '' },
      { level: 1, subLevel: 1, levelTitle: '', subLevelTitle: '', questionTemplate: 'T4', answerEval: '1', wrongEval: '2', varA: '0', varB: '0', varC: '0', varD: '0', shapeCode: '' },
    ];

    let totalDuplicates = 0;
    for (let t = 0; t < 100; t++) {
      const bank = new QuestionBank();
      bank.loadRecords(records);
      bank.setLevel(1);
      let prevTemplate = '';
      for (let i = 0; i < 20; i++) {
        const q = bank.next();
        if (q.questionTemplate === prevTemplate) {
          totalDuplicates++;
        }
        prevTemplate = q.questionTemplate;
      }
    }
    expect(totalDuplicates).toBe(0);
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

  it('문자열 정답 문제(비교, 분수, 이진법)를 올바르게 생성한다', () => {
    // 비교 연산자 문제
    const qCompare: QuestionRecord = {
      level: 1, subLevel: 1, levelTitle: '', subLevelTitle: '',
      questionTemplate: '{A} + {B} [ ? ] {C}',
      answerEval: "(A+B)>C?'>':((A+B)<C?'<':'=')",
      wrongEval: "(A+B)>C?'<':'>'",
      varA: '5', varB: '3', varC: '6', varD: '0', shapeCode: '',
    };
    const resCompare = generateQuestion(qCompare);
    expect(resCompare).not.toBeNull();
    expect(resCompare!.correctAnswer).toBe('>');
    expect(resCompare!.wrongAnswer).toBe('<');
    expect(resCompare!.choices).toContain('>');
    expect(resCompare!.choices).toContain('<');

    // 분수 문제
    const qFraction: QuestionRecord = {
      level: 3, subLevel: 1, levelTitle: '', subLevelTitle: '',
      questionTemplate: '{A}/{C} 와 {B}/{C} 중 큰 수는?',
      answerEval: "A>B? A+'/'+C : B+'/'+C",
      wrongEval: "A<B? A+'/'+C : B+'/'+C",
      varA: '3', varB: '2', varC: '5', varD: '0', shapeCode: '',
    };
    const resFraction = generateQuestion(qFraction);
    expect(resFraction).not.toBeNull();
    expect(resFraction!.correctAnswer).toBe('3/5');
    expect(resFraction!.wrongAnswer).toBe('2/5');

    // 이진법 문제
    const qBinary: QuestionRecord = {
      level: 6, subLevel: 1, levelTitle: '', subLevelTitle: '',
      questionTemplate: '10진수 {B}를 2진수로 나타내면?',
      answerEval: "Number(B).toString(2) + '₍₂₎'",
      wrongEval: "Number(B+1).toString(2) + '₍₂₎'",
      varA: '0', varB: '5', varC: '0', varD: '0', shapeCode: '',
    };
    const resBinary = generateQuestion(qBinary);
    expect(resBinary).not.toBeNull();
    expect(resBinary!.correctAnswer).toBe('101₍₂₎');
    expect(resBinary!.wrongAnswer).toBe('110₍₂₎');
  });

  it('VarC, VarD 종속 변수를 순차적으로 평가한다', () => {
    const qDependent: QuestionRecord = {
      level: 1, subLevel: 1, levelTitle: '', subLevelTitle: '',
      questionTemplate: '{A} + [ ? ] = {C}',
      answerEval: 'C - A',
      wrongEval: 'C - A + 1',
      varA: '7', varB: '3', varC: 'A + B', varD: '0', shapeCode: '',
    };
    const res = generateQuestion(qDependent);
    expect(res).not.toBeNull();
    expect(res!.questionText).toBe('7 + [ ? ] = 10');
    expect(res!.correctAnswer).toBe(3);
  });

  it('복합 템플릿 표현식({A*B}, {repeatAdd}, {sup})을 평가하여 치환한다', () => {
    const qComplex: QuestionRecord = {
      level: 2, subLevel: 1, levelTitle: '', subLevelTitle: '',
      questionTemplate: '{A*B} ÷ {A} = ?',
      answerEval: 'B', wrongEval: 'B+1',
      varA: '4', varB: '6', varC: '0', varD: '0', shapeCode: '',
    };
    const res = generateQuestion(qComplex);
    expect(res).not.toBeNull();
    expect(res!.questionText).toBe('24 ÷ 4 = ?');
    expect(res!.correctAnswer).toBe(6);

    const qRepeatAdd: QuestionRecord = {
      level: 2, subLevel: 1, levelTitle: '', subLevelTitle: '',
      questionTemplate: '{repeatAdd(A, B)} = ?',
      answerEval: 'A*B', wrongEval: 'A*B+A',
      varA: '3', varB: '4', varC: '0', varD: '0', shapeCode: '',
    };
    const resRepeat = generateQuestion(qRepeatAdd);
    expect(resRepeat).not.toBeNull();
    expect(resRepeat!.questionText).toBe('3 + 3 + 3 + 3 = ?');

    const qSup: QuestionRecord = {
      level: 5, subLevel: 1, levelTitle: '', subLevelTitle: '',
      questionTemplate: '{A}{sup(B)} = ?',
      answerEval: 'Math.pow(A, B)', wrongEval: 'A*B',
      varA: '2', varB: '3', varC: '0', varD: '0', shapeCode: '',
    };
    const resSup = generateQuestion(qSup);
    expect(resSup).not.toBeNull();
    expect(resSup!.questionText).toBe('2³ = ?');
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
