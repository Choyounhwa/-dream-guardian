/* All region geometry and pose recipes live here. See POSE_DESIGN.md. */
(function(root) {
    const PARTS = {
        hands: {label:'손', color:'#28E6FF', shape:'circle', gain:[0.65,0.85]},
        face: {label:'얼굴', color:'#FFD35A', shape:'ellipse', gain:[0.22,0.25]},
        shoulders: {label:'어깨', color:'#CD94FF', shape:'rect', gain:[0.3,0.25]},
        hips: {label:'골반', color:'#FF8B64', shape:'triangle', gain:[0.3,0.32]}
    };
    const SETTINGS = {hold:0.8, neutral:0.6, confidence:0.6, maxGap:0.6, credit:0.15, inset:0.025};
    // Half-open rectangles. No overlapping corner ownership, even on exact borders.
    const ZONES = [
        {id:'top-left', label:'위 왼쪽', x:0,y:0,w:1/3,h:0.25},
        {id:'top', label:'위', x:1/3,y:0,w:1/3,h:0.25},
        {id:'top-right', label:'위 오른쪽', x:2/3,y:0,w:1/3,h:0.25},
        {id:'left-up', label:'왼쪽 위', x:0,y:0.25,w:0.25,h:1/6},
        {id:'left', label:'왼쪽', x:0,y:5/12,w:0.25,h:1/6},
        {id:'left-down', label:'왼쪽 아래', x:0,y:7/12,w:0.25,h:1/6},
        {id:'right-up', label:'오른쪽 위', x:0.75,y:0.25,w:0.25,h:1/6},
        {id:'right', label:'오른쪽', x:0.75,y:5/12,w:0.25,h:1/6},
        {id:'right-down', label:'오른쪽 아래', x:0.75,y:7/12,w:0.25,h:1/6},
        {id:'bottom-left', label:'아래 왼쪽', x:0,y:0.75,w:1/3,h:0.25},
        {id:'bottom', label:'아래', x:1/3,y:0.75,w:1/3,h:0.25},
        {id:'bottom-right', label:'아래 오른쪽', x:2/3,y:0.75,w:1/3,h:0.25}
    ];
    const POSES = [
        {id:'one-diagonal', part:'hands', mode:'one', zones:['left-up','right-up'], label:'한 손 대각선 뻗기', cue:'한 손을 답 방향으로 작게 뻗고 유지', effect:'어깨 가동·상체 스트레칭'},
        {id:'one-side', part:'hands', mode:'one', zones:['left','right'], label:'한 손 옆으로', cue:'원하는 쪽으로 한 손만 뻗기', effect:'옆구리·가슴 열기'},
        {id:'both-high', part:'hands', mode:'both', zones:['top-left','top-right'], label:'양손 함께 위로', cue:'양손을 같은 대각선 방향으로 올리기', effect:'양팔·옆구리 스트레칭'},
        {id:'both-low', part:'hands', mode:'both', zones:['bottom-left','bottom-right'], label:'양손 함께 아래로', cue:'두 손을 같은 아래 방향으로 밀기', effect:'팔·몸통 가동'},
        {id:'cross', part:'hands', mode:'cross', zones:['top','bottom'], label:'양손 교차', cue:'가슴 앞에서 양손을 X자로 교차하고 위/아래 이동', effect:'등·어깨 가동'},
        {id:'shoulder-side', part:'shoulders', mode:'both', zones:['left','right'], label:'양어깨 옆으로', cue:'고개만 꺾지 말고 양어깨를 함께 옆으로', effect:'몸통 체중 이동'},
        {id:'shoulder-diagonal', part:'shoulders', mode:'both', zones:['left-up','right-up'], label:'어깨 대각선 이동', cue:'몸통을 작게 옮기며 양어깨 올리기', effect:'어깨·몸통 가동'},
        {id:'shoulder-down', part:'shoulders', mode:'both', zones:['left-down','right-down'], label:'어깨 낮춰 이동', cue:'무릎을 살짝 굽혀 양어깨를 아래 대각선으로', effect:'가벼운 하체 굽힘'},
        {id:'hip-side', part:'hips', mode:'single', zones:['left','right'], label:'골반 좌우 이동', cue:'발은 제자리, 골반을 답 방향으로 작게 이동', effect:'체중 이동·가벼운 유산소'},
        {id:'hip-vertical', part:'hips', mode:'single', zones:['top','bottom'], label:'골반 위아래', cue:'위: 발뒤꿈치 살짝 들기 / 아래: 무릎 살짝 굽히기', effect:'종아리·하체 움직임'},
        {id:'hip-diagonal', part:'hips', mode:'single', zones:['bottom-left','bottom-right'], label:'골반 낮춰 이동', cue:'작게 앉으며 골반을 왼쪽/오른쪽 아래로', effect:'미니 스쿼트·체중 이동'},
        {id:'face-side', part:'face', mode:'single', zones:['left','right'], label:'얼굴 좌우 이동', cue:'목을 꺾지 말고 몸통과 얼굴을 함께 조금 이동', effect:'완만한 몸통 이동'}
    ];
    const valid = p => p && Number.isFinite(p.x) && Number.isFinite(p.y) && p.vis >= SETTINGS.confidence;
    const mid = (a,b) => ({x:(a.x+b.x)/2,y:(a.y+b.y)/2,vis:Math.min(a.vis,b.vis)});
    function required(recipe) {
        const core = [11,12,23,24];
        return [...new Set(core.concat(recipe.part === 'hands' ? [15,16] : recipe.part === 'face' ? [0] : []))];
    }
    function snapshot(points, recipe) {
        if (!required(recipe).every(i=>valid(points[i]))) return null;
        const shoulders = mid(points[11],points[12]), hips = mid(points[23],points[24]);
        const torso = Math.hypot(shoulders.x-hips.x, shoulders.y-hips.y);
        if (torso < 10) return null;
        return {points:points.map(p=>p ? {...p} : null), shoulders, hips, torso};
    }
    function markers(points, part) {
        if (part === 'hands') return [points[15],points[16]];
        if (part === 'shoulders') return [points[11],points[12]];
        if (part === 'face') return [points[0]];
        return [mid(points[23],points[24])];
    }
    function projected(points, baseline, recipe) {
        const originals = markers(points,recipe.part), starts = markers(baseline.points,recipe.part);
        const gain = recipe.gain || PARTS[recipe.part].gain;
        return originals.map((p,i)=>({
            x:0.5+(p.x-starts[i].x)/(baseline.torso*gain[0]*2),
            y:0.5+(p.y-starts[i].y)/(baseline.torso*gain[1]*2),vis:p.vis
        }));
    }
    function contains(z,p,inset=0) {
        return valid(p) && p.x >= z.x+inset && p.x < z.x+z.w-inset && p.y >= z.y+inset && p.y < z.y+z.h-inset;
    }
    function zoneAt(p) { return ZONES.find(z=>contains(z,p)) || null; }
    function board(width,height) { return {x:width*0.03,y:height*0.4,w:width*0.94,h:height*0.44}; }
    function rect(id,width,height) {
        const b = board(width,height), z = ZONES.find(z=>z.id===id);
        return {x:b.x+z.x*b.w,y:b.y+z.y*b.h,w:z.w*b.w,h:z.h*b.h};
    }
    function options(index,question,firstCorrect) {
        const recipe = POSES[index % POSES.length];
        return recipe.zones.map((zoneId,i)=>({key:zoneId,zoneId,poseId:recipe.id,part:recipe.part,
            text:(i===0)===firstCorrect ? question.c : question.w,isCorrect:(i===0)===firstCorrect,dwell:0,isFullBody:false}));
    }
    class Gate {
        constructor() { this.reset(); }
        reset() { this.baseline=null; this.previous=null; this.neutralTime=0; this.held=0; this.selected=null; this.preview=[]; this.recipeId=null; }
        interrupt() { this.reset(); }
        update(points,dt,locked,choices) {
            choices.forEach(o=>{o.dwell=0;o.isFullBody=false;});
            const recipe = POSES.find(r=>r.id===choices[0]?.poseId);
            if (!recipe) { this.reset(); return {hint:'동작 설정을 확인하세요',choice:null}; }
            if (this.recipeId && this.recipeId!==recipe.id) this.reset();
            this.recipeId=recipe.id;
            if (locked || !(dt>0) || dt>SETTINGS.maxGap) { this.reset(); return {hint:'문제를 읽고 가운데에서 준비하세요',choice:null}; }
            const current = snapshot(points,recipe);
            if (!current) { this.reset(); return {hint:`${PARTS[recipe.part].label}·어깨·골반이 보이도록 서세요`,choice:null}; }
            if (!this.baseline) {
                // Stable relevant joints, not just shoulders: running swings cannot arm answers.
                const indices=required(recipe);
                const stable=this.previous && indices.every(i=>Math.hypot(points[i].x-this.previous.points[i].x,points[i].y-this.previous.points[i].y)/dt<current.torso*0.5);
                const relaxed=recipe.part!=='hands' || [15,16].every(i=>points[i].y>current.shoulders.y+current.torso*0.3);
                this.neutralTime=stable && relaxed ? this.neutralTime+Math.min(dt,SETTINGS.credit) : 0;
                this.previous=current;
                if(this.neutralTime>=SETTINGS.neutral) this.baseline=current;
                return {hint:this.baseline ? recipe.cue : '제자리에서 편하게 서서 0.6초 준비',choice:null};
            }
            this.preview=projected(points,this.baseline,recipe);
            const inset=SETTINGS.inset;
            let crossOK=true;
            if(recipe.mode==='cross') {
                const [a,b]=[points[15],points[16]], [sa,sb]=[this.baseline.points[15],this.baseline.points[16]];
                crossOK=(sa.x-sb.x)*(a.x-b.x)<0 && Math.abs(a.x-b.x)>current.torso*0.12;
            }
            // Crossing is a compound marker: both hands must actually cross; midpoint steers.
            const controls=recipe.mode==='cross' ? [mid(this.preview[0],this.preview[1])] : this.preview;
            if(recipe.mode==='cross') this.preview=controls;
            const active=choices.filter(o=>{
                const z=ZONES.find(z=>z.id===o.zoneId);
                const inside=controls.map(p=>contains(z,p,inset));
                const matches=crossOK && (recipe.mode==='one' ? inside.filter(Boolean).length===1 : inside.every(Boolean));
                o.isFullBody=matches;
                return matches;
            });
            if(active.length!==1) {
                this.selected=null;this.held=0;
                const hint=!crossOK ? '두 손을 가슴 앞에서 X자로 교차하세요' :
                    active.length>1 ? '두 답에 동시에 들어갔어요 · 하나만 선택하세요' : recipe.cue;
                return {hint,choice:null};
            }
            const choice=active[0];
            this.held=this.selected===choice.zoneId ? this.held+Math.min(dt,SETTINGS.credit) : Math.min(dt,SETTINGS.credit);
            this.selected=choice.zoneId;
            choice.dwell=Math.min(1,this.held/SETTINGS.hold);
            return {hint:`${PARTS[recipe.part].label} 색상 일치! ${(SETTINGS.hold-this.held>0?SETTINGS.hold-this.held:0).toFixed(1)}초 유지`,choice:choice.dwell>=1 ? choice : null};
        }
    }
    const api={PARTS,SETTINGS,ZONES,POSES,Gate,board,rect,contains,zoneAt,options,projected,snapshot,markers};
    if(typeof module!=='undefined' && module.exports) module.exports=api; else root.ZoneInput=api;
})(typeof globalThis!=='undefined'?globalThis:window);
