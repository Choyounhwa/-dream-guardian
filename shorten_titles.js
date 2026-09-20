const fs = require('fs');
const file = 'e:/AIAIAIAI/Arithmetic Game/questions.csv';
let text = fs.readFileSync(file, 'utf8');
const BOM = '\uFEFF';
if (text.charCodeAt(0) === 0xFEFF) text = text.slice(1);
let lines = text.split(/\r?\n/);

const levelMap = {
    '1': '덧뺄셈',
    '2': '곱나눗셈',
    '3': '분수',
    '4': '소수',
    '5': '제곱',
    '6': '도형',
    '7': '비율',
    '8': '기타'
};

const subMap = {
    '1-1': '한자리', '1-2': '두자리', '1-3': '혼합 1', '1-4': '혼합 2', '1-5': '크기비교', '1-6': '복합비교', '1-7': '빈칸역산',
    '2-1': '한자리', '2-2': '단위곱', '2-3': '두자리', '2-4': '호환수', '2-5': '복합곱',
    '3-1': '비교 1', '3-2': '비교 2', '3-3': '덧뺄셈 1', '3-4': '덧뺄셈 2', '3-5': '곱나눗셈',
    '4-1': '크기비교', '4-2': '덧뺄셈', '4-3': '분수변환', '4-4': '곱나눗셈', '4-5': '응용문제',
    '5-1': '기본제곱', '5-2': '제곱 1', '5-3': '제곱 2', '5-4': '루트(√)', '5-5': '응용문제',
    '6-1': '도형구분', '6-2': '둘레구하기', '6-3': '넓이구하기', '6-4': '부피구하기', '6-5': '각도구하기',
    '7-1': '단순비교', '7-2': '비율계산', '7-3': '소수비율',
    '8-1': '시그마', '8-2': '방정식', '8-3': '팩토리얼', '8-4': '쌓기나무', '8-5': '회전전개', '8-6': '규칙찾기', '8-7': '수배열', '8-8': '2진수'
};

for(let i=1; i<lines.length; i++){
    if(!lines[i].trim()) continue;
    let cols = lines[i].match(/(".*?"|[^",\s]+)(?=\s*,|\s*$)/g);
    if(cols) {
        let l = cols[0].replace(/"/g,'');
        let s = cols[1].replace(/"/g,'');
        cols[2] = `"${levelMap[l] || l}"`;
        cols[3] = `"${subMap[l+'-'+s] || s}"`;
        lines[i] = cols.join(",");
    }
}

fs.writeFileSync(file, BOM + lines.join('\n'), 'utf8');
console.log('Shortened titles updated.');
