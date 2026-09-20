const fs = require('fs');

let csv = fs.readFileSync('e:/AIAIAIAI/Arithmetic Game/questions.csv', 'utf8');
if (csv.charCodeAt(0) === 0xFEFF) csv = csv.slice(1);

let lines = csv.split(/\r?\n/);
let newLines = [lines[0]];

// 6단계 2진수를 보관할 배열
let binaryLines = [];

for (let i = 1; i < lines.length; i++) {
    if (!lines[i].trim()) continue;
    let cols = lines[i].match(/(".*?"|[^",\s]+)(?=\s*,|\s*$)/g);
    if (!cols) continue;
    let l = parseInt(cols[0].replace(/"/g, ''));
    let s = parseInt(cols[1].replace(/"/g, ''));
    
    if (l === 6) {
        // 기존 6단계(2진수)
        cols[0] = '"8"';
        cols[1] = '"8"'; // 8-8로 이동
        cols[2] = '"8. 기타 문제"';
        cols[3] = '"8-8 2진수 혼합"';
        binaryLines.push(cols.join(","));
    } else if (l === 7) {
        cols[0] = '"6"';
        cols[2] = '"6. 도형"';
        cols[3] = '"6' + cols[3].replace(/"/g, '').substring(1) + '"';
        newLines.push(cols.join(","));
    } else if (l === 8) {
        cols[0] = '"7"';
        cols[2] = '"7. 비율"';
        cols[3] = '"7' + cols[3].replace(/"/g, '').substring(1) + '"';
        newLines.push(cols.join(","));
    } else if (l === 9) {
        cols[0] = '"8"';
        cols[2] = '"8. 기타 문제"';
        cols[3] = '"8' + cols[3].replace(/"/g, '').substring(1) + '"';
        newLines.push(cols.join(","));
    } else {
        newLines.push(lines[i]);
    }
}

// 8-8 2진수 섞어서 추가
for (let b of binaryLines) {
    newLines.push(b);
}

const BOM = '\uFEFF';
fs.writeFileSync('e:/AIAIAIAI/Arithmetic Game/questions.csv', BOM + newLines.join('\n'), 'utf8');
console.log('CSV updated to 8 levels.');
