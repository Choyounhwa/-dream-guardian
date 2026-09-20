const assert = require('node:assert/strict');
const { Gate, body, evaluate, handCursors } = require('./motion-input.js');
function standing() {
    const p = Array.from({length:33}, () => ({x:300,y:300,vis:1}));
    const set = (i,x,y) => p[i] = {x,y,vis:1};
    set(0,300,160);
    for (const [s,e,w,h,k,a,x] of [[11,13,15,23,25,27,260],[12,14,16,24,26,28,340]]) {
        set(s,x,200); set(e,x,250); set(w,x,300); set(h,x,300); set(k,x,400); set(a,x,500);
    }
    return p;
}
const baseline = body(standing());
const top = standing();
top[13].y = top[14].y = 150; top[15].y = top[16].y = 100;
const squat = standing();
for (const i of [0,11,12,13,14,15,16,23,24]) squat[i].y += 40;
squat[25] = {x:200,y:370,vis:1}; squat[26] = {x:400,y:370,vis:1};
const left = standing();
left[23] = {x:220,y:320,vis:1}; left[24] = {x:260,y:320,vis:1};
left[25] = {x:180,y:380,vis:1}; left[27] = {x:180,y:500,vis:1};
left[26] = {x:340,y:410,vis:1}; left[28] = {x:420,y:500,vis:1};
const right = left.map(p => ({...p,x:600-p.x}));
for (const [key, points] of [['top',top],['bottom',squat],['left',left],['right',right]]) {
    const target = {...points[15]};
    assert.equal(evaluate(points,baseline,key,target,30).matched,true,key);
    assert.equal(evaluate(points,baseline,key,target,30).touched,true,key);
    assert.equal(evaluate(standing(),baseline,key,standing()[15],30).matched,false,`${key}: hands alone`);
    const hidden = points.map(p => ({...p})); hidden[25].vis = 0.2;
    assert.equal(evaluate(hidden,baseline,key,target,30).matched,false,`${key}: hidden knee`);
    assert.equal(evaluate(points,baseline,key,{x:0,y:0},10).touched,false,`${key}: pose without touch`);
}
const oneHand = top.map(p => ({...p})); oneHand[16].y = 300;
assert.equal(evaluate(oneHand,baseline,'top',top[15],30).matched,false);
const options = [{key:'top',...top[15]}, {key:'bottom',x:300,y:500}];
const gate = new Gate();
for (let i=0;i<30;i++) assert.equal(gate.update(top,0.1,false,options,40).choice,null,'must return to neutral');
for (let i=0;i<9;i++) gate.update(standing(),0.1,false,options,40);
assert.ok(gate.baseline);
for (let i=0;i<6;i++) assert.equal(gate.update(top,0.1,false,options,40).choice,null);
gate.update(oneHand,0.1,false,options,40);
assert.equal(options[0].dwell,0,'invalid pose resets dwell');
for (let i=0;i<7;i++) assert.equal(gate.update(top,0.1,false,options,40).choice,null);
assert.equal(gate.update(top,0.1,false,options,40).choice,options[0]);
gate.update(top,0.1,true,options,40);
assert.equal(options[0].dwell,0,'reading lock');
assert.equal(gate.baseline,null);
for (let i=0;i<9;i++) gate.update(standing(),0.1,false,options,40);
gate.update(top,0.7,false,options,40);
assert.equal(gate.baseline,null,'stale pose requires new neutral calibration');
const cursor = handCursors(top,baseline,400,800)[0];
assert.ok(Math.abs(cursor.x-400*0.33)<2 && Math.abs(cursor.y-800*0.43)<4, 'overhead cursor reaches visible target');
assert.equal(evaluate(top,baseline,'top',{x:132,y:344},68,handCursors(top,baseline,400,800)).touched,true);
const compactLunge = left.map(p=>({...p}));
compactLunge[15] = {x:233,y:230,vis:1};
assert.equal(evaluate(compactLunge,baseline,'left',{x:88,y:520},68,handCursors(compactLunge,baseline,400,800)).matched,true);
assert.equal(evaluate(compactLunge,baseline,'left',{x:88,y:520},68,handCursors(compactLunge,baseline,400,800)).touched,true);
const shifted = standing().map(p=>({...p,x:p.x-25}));
assert.equal(evaluate(shifted,baseline,'left',{x:88,y:520},68).matched,false,'leaning without knee bend is not a lunge');
const slow = new Gate();
for(let i=0;i<6;i++) slow.update(standing(),0.3,false,options,40);
assert.ok(slow.baseline,'3 FPS can calibrate without constant reset');
for(let i=0;i<5;i++) assert.equal(slow.update(top,0.3,false,options,40).choice,null);
assert.equal(slow.update(top,0.3,false,options,40).choice,options[0]);
console.log('PASS: pose/touch requirements, calibrated cursors, slow frames, neutral/hold/lock/stale handling');
