const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const html = fs.readFileSync(`${__dirname}/index.html`, 'utf8');
const code = html.match(/<script>([\s\S]*?)<\/script>/)[1];
const noop = () => {};
const gradient = {addColorStop:noop};
const ctx = new Proxy({}, {get:(_,k) => k.startsWith('create') ? () => gradient : noop, set:()=>true});
const elements = new Map();
const events = {};
function element(id) {
    if (!elements.has(id)) elements.set(id, {classList:{add:noop,remove:noop,toggle:noop,contains:()=>true},
        addEventListener:(type,fn)=>{events[id+':'+type]=fn;}, getContext:()=>ctx, getBoundingClientRect:()=>({width:400,height:800,left:0,top:0}),
        videoWidth:640,videoHeight:480,readyState:2,currentTime:1,play:async()=>{},srcObject:null});
    return elements.get(id);
}
class FakePose { constructor(){this.cb=null;} setOptions(){} onResults(cb){this.cb=cb;} send(){return Promise.resolve();} }
class FakeHands { constructor(){this.cb=null;} setOptions(){} onResults(cb){this.cb=cb;} send(){return Promise.resolve();} }
const sandbox = {console, Pose:FakePose, Hands:FakeHands, HTMLMediaElement:{HAVE_METADATA:1}, MotionInput:require('./motion-input.js'), ZoneInput:require('./zone-input.js'), AnswerSelection:require('./answer-selection.js'), MenuInput:require('./menu-input.js'), QuestionEvaluator:require('./question-evaluator.js'), QuestionSpeech:require('./question-speech.js'), performance:{now:()=>1000},
    document:{getElementById:element,addEventListener:noop,hidden:false},
    window:{AudioContext:class {},addEventListener:(type,fn)=>{events['window:'+type]=fn;},isSecureContext:false},
    navigator:{}, localStorage:{getItem:()=>null,setItem:noop},
    fetch:()=>new Promise(()=>{}),setTimeout:noop,setInterval:noop,clearInterval:noop,requestAnimationFrame:noop};
vm.createContext(sandbox);
vm.runInContext(code,sandbox);
vm.runInContext(`
    playSound = () => {};
    ensureFallbackLevels(); csvLoaded = true; checkReady();
    if (gameState !== 'menu_main') throw Error('menu blocked without camera');
    drawScene(1000, 0.016);
    // Menu selection must use shoulder/wrist data only. No legs are supplied here.
    currentSkeletonLandmarks=[];
    currentSkeletonLandmarks[11]={x:.4,y:.4,visibility:1};currentSkeletonLandmarks[12]={x:.6,y:.4,visibility:1};
    currentSkeletonLandmarks[15]={x:.5,y:.28,visibility:1};currentSkeletonLandmarks[16]={x:.5,y:.28,visibility:1};
    for(let i=0;i<9;i++) drawMenuMain(1000+i,0.1);
    if(gameState!=='menu_sub') throw Error('upper-body hand dwell did not select main menu');
    changeState('menu_main'); menuHoverIdx=-1;menuHoverDwell=0;
    currentSkeletonLandmarks[16].x=.9;
    for(let i=0;i<12;i++) drawMenuMain(2000+i,0.1);
    if(gameState!=='menu_main') throw Error('low-confidence hand selected menu');
    gameState = 'playing'; questionReadinessTimer = 1;
    targetOptions = [{key:'left',isCorrect:true,isFullBody:true,dwell:1}];
    handleAnswer(targetOptions[0]);
    if (questionCount !== 0) throw Error('manual input bypassed reading lock');
    questionReadinessTimer = 1;
    handleAnswer(targetOptions[0]);
    if (questionCount !== 0) throw Error('manual input bypassed reading lock');
    questionReadinessTimer = 0; handleAnswer(targetOptions[0]);
    if (questionCount !== 1 || gameState !== 'correct') throw Error('practice mode failed');
    if (guardianMana !== 25 || bossHp !== 10) throw Error('answer must charge mana, not directly damage boss');
    handleAnswer(targetOptions[0]);
    if (questionCount !== 1) throw Error('duplicate answer');
    gameState = 'playing'; lastValidPoseTime = 0;
    handleAnswer(targetOptions[0], 'pose');
    if (questionCount !== 1) throw Error('stale pose accepted');
    questionData = {q: '사과를 나누어 주었습니다. 남은 사과는 모두 몇 개인가요? '.repeat(10)};
    const textEl = document.getElementById('question_text');
    textEl.scrollHeight = 1000; textEl.clientHeight = 100;
    questionPanelDirty = true; syncQuestionPanel();
    if (textEl.textContent !== questionData.q) throw Error('long question text truncated');
    questionSpeaking = true;
    questionReadinessTimer = 0;
    const beforeSpeech = questionCount;
    const oldMana=guardianMana, oldScore=score;
    handleAnswer(targetOptions[0]);
    if (questionCount !== beforeSpeech+1) throw Error('speech must never block answer');
    questionCount=beforeSpeech;guardianMana=oldMana;score=oldScore;gameState='playing';
    questionSpeaking = false;
    textEl.scrollHeight = 80; textEl.clientHeight = 100;
    questionData = {q: '2 + 3 = ?'}; questionPanelDirty = true; syncQuestionPanel();
    questionSpeechPending = true; syncQuestionPanel();
    if (questionSpeaking) throw Error('unsupported speech must not block game');
    updateVideoScale();
    if (videoScaleInfo.dw < width || videoScaleInfo.dh < height || videoScaleInfo.cy !== height/2) throw Error('camera must cover full canvas');
    const center = landmarkToScreen({x:0.5,y:0.5,visibility:1});
    if (center.x !== width/2 || center.y !== height/2) throw Error('skeleton misaligned');
    if (!landmarkToScreen({x:0,y:0.5,visibility:1}).vis) throw Error('display crop invalidates camera-visible joint');
    gameState = 'result'; syncQuestionPanel();
    if (!document.getElementById('question_panel').hidden) throw Error('question panel leaked into result');
    questionSpeaking = false; questionPanelDirty = false;
    for (let i=0;i<3;i++) {
        gameState = 'playing'; questionReadinessTimer = 0;
        handleAnswer(targetOptions[0]);
    }
    if (guardianMana !== 100 || bossHp !== 10) throw Error('four answers must fill mana before attack');
    stateTimer = 1.5; updateGuardianBattle();
    if (gameState !== 'guardian_cast' || guardianMana !== 0 || spellsCast !== 1) throw Error('spell cost/cast');
    stateTimer = 0.8; updateGuardianBattle(); updateGuardianBattle();
    if (bossHp !== 6) throw Error('spell impact must occur exactly once');
    stateTimer = 1.8; updateGuardianBattle();
    if (gameState !== 'running') throw Error('return to exploration');
    guardianMana = 25; gameState = 'playing'; questionReadinessTimer = 0;
    targetOptions = [{isCorrect:false}]; handleAnswer(targetOptions[0]);
    if (guardianMana !== 25) throw Error('wrong answer must preserve mana');
    bossHp = 2; gameState = 'guardian_cast'; spellImpactDone = false; currentLevel = 5;
    stateTimer = 0.8; updateGuardianBattle();
    stateTimer = 1.8; updateGuardianBattle();
    if (gameState !== 'ending_cutscene' || bossHp !== 0) throw Error('final spell must trigger ending');
    gameState='running'; bossAttackCooldown=0; bossAttackActive=false; updateBossAttack(.1);
    if (!bossAttackActive || bossAttackTimer !== 2.5) throw Error('boss dodge attack did not start');
`,sandbox);
// Exercise the actual input listeners without a camera or pose callback.
for (const input of ['space','click','jump']) {
    vm.runInContext("changeState('running'); runGauge = 90;",sandbox);
    if (input === 'click') events['output_canvas:pointerdown']({clientX:200,clientY:500});
    else events['window:keydown']({code:input === 'space' ? 'Space' : 'ArrowUp',preventDefault:noop});
    vm.runInContext(`
        gameLoop(1000);
        if (gameState !== 'playing' || !questionData || targetOptions.length !== 2) throw Error('full gauge failed without pose callback');
        var previousQuestion = questionData;
        updateRunningProgress(0.1);
        if (questionData !== previousQuestion) throw Error('question generated twice');
    `,sandbox);
}
vm.runInContext(`
    changeState('running'); runGauge = 100;
    updateRunningProgress(0.1);
    if (gameState !== 'playing') throw Error('decay occurred before full gauge check');
    changeState('running'); runGauge = 30; updateRunningProgress(0.1);
    if (gameState !== 'running' || runGauge !== 28.5) throw Error('partial gauge decay');
`,sandbox);
assert.doesNotMatch(html,/id="(?:btn_camera|camera_panel|btn_start_camera|btn_touch_mode)"/);
assert.doesNotMatch(html,/drawMotionGuidePictogram|drawAnswerOrb|questionMode/);
assert.doesNotMatch(html,/btn_speak_question|btn_toggle_speech|question_hint|fillText\("VS"/);
assert.match(html,/hands@[^"/]+\/hands\.js/,'hand tracker loaded separately from Pose');
assert.match(html,/normalizePoseLandmarks/,'Pose visibility normalization enabled');
assert.match(html,/poseMissCount >= 12/,'single empty Pose frame cannot erase skeleton');
assert.match(html,/lastVideoTime = videoElement\.currentTime/,'Pose receives each new video frame');
(async () => {
    await vm.runInContext('initCamera()',sandbox);
    assert.match(element('camera_status').textContent,/HTTPS/);
    sandbox.window.isSecureContext = true;
    await vm.runInContext('initCamera()',sandbox);
    assert.match(element('camera_status').textContent,/Space/);
    console.log('PASS: no-camera Space/click/jump transitions, full gauge before decay, one question only, camera cover mapping, input/speech guards, mana battle');
})();
