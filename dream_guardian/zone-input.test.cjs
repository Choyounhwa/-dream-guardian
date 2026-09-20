const assert=require('node:assert/strict');
const Z=require('./zone-input.js');
function standing() {
    const p=Array.from({length:33},()=>({x:300,y:300,vis:1}));
    [[0,300,160],[11,260,200],[12,340,200],[15,260,300],[16,340,300],[23,260,300],[24,340,300]].forEach(([i,x,y])=>p[i]={x,y,vis:1});
    return p;
}
function moved(recipe,zoneId,base=standing()) {
    const p=base.map(v=>({...v})), z=Z.ZONES.find(z=>z.id===zoneId), b=Z.snapshot(base,recipe);
    const gain=recipe.gain || Z.PARTS[recipe.part].gain;
    const dx=(z.x+z.w/2-0.5)*b.torso*gain[0]*2;
    const dy=(z.y+z.h/2-0.5)*b.torso*gain[1]*2;
    const ids=recipe.part==='hands' ? recipe.mode==='one'?[15]:[15,16] : recipe.part==='shoulders'?[11,12]:recipe.part==='face'?[0]:[23,24];
    ids.forEach(i=>{p[i].x+=dx;p[i].y+=dy;});
    if(recipe.mode==='cross') {p[15].x=320+dx;p[16].x=280+dx;}
    return p;
}
function armed(recipe,options) {
    const gate=new Z.Gate();
    for(let i=0;i<10;i++) gate.update(standing(),0.1,false,options);
    assert.ok(gate.baseline,recipe.id+' baseline');
    return gate;
}
assert.equal(Z.ZONES.length,12);
for(let i=0;i<12;i++) for(let j=i+1;j<12;j++) {
    const a=Z.ZONES[i],b=Z.ZONES[j];
    const w=Math.min(a.x+a.w,b.x+b.w)-Math.max(a.x,b.x);
    const h=Math.min(a.y+a.h,b.y+b.h)-Math.max(a.y,b.y);
    assert.ok(w<1e-10||h<1e-10,`${a.id}/${b.id} overlap`);
}
assert.equal(Z.zoneAt({x:0.5,y:0.5,vis:1}),null,'neutral center has no answer');
for(const x of [0,0.25,1/3,0.5,2/3,0.75,1]) for(const y of [0,0.25,5/12,7/12,0.75,1]) {
    assert.ok(Z.ZONES.filter(z=>Z.contains(z,{x,y,vis:1})).length<=1,'boundary owned by at most one region');
}
for(let i=0;i<Z.POSES.length;i++) {
    const recipe=Z.POSES[i];
    for(const choiceIndex of [0,1]) {
        const options=Z.options(i,{c:'5',w:'6'},true),gate=armed(recipe,options),p=moved(recipe,recipe.zones[choiceIndex]);
        let result;
        for(let frame=0;frame<10;frame++) result=gate.update(p,0.1,false,options);
        assert.equal(result.choice,options[choiceIndex],`${recipe.id}/${choiceIndex} reachable`);
        gate.update(standing(),0.1,false,options);
        assert.equal(options[choiceIndex].dwell,0,'release clears progress');
    }
}
for(const id of ['both-high','shoulder-side']) {
    const i=Z.POSES.findIndex(p=>p.id===id),r=Z.POSES[i],options=Z.options(i,{c:'1',w:'2'},true),gate=armed(r,options);
    const p=moved(r,r.zones[0]);p[r.part==='hands'?16:12]=standing()[r.part==='hands'?16:12];
    for(let n=0;n<20;n++) assert.equal(gate.update(p,0.1,false,options).choice,null,'both means both');
}
{
    const i=Z.POSES.findIndex(p=>p.id==='cross'),r=Z.POSES[i],options=Z.options(i,{c:'1',w:'2'},true),gate=armed(r,options);
    const p=moved(r,'top');p[15].x=260;p[16].x=340;
    for(let n=0;n<20;n++) assert.equal(gate.update(p,0.1,false,options).choice,null,'uncrossed midpoint cannot answer');
}
{
    const i=Z.POSES.findIndex(p=>p.part==='hips'),r=Z.POSES[i],options=Z.options(i,{c:'1',w:'2'},true),gate=armed(r,options);
    const p=moved(Z.POSES[1],'left');
    for(let n=0;n<20;n++) assert.equal(gate.update(p,0.1,false,options).choice,null,'hands cannot answer hip color');
    const hip=moved(r,r.zones[0]);
    for(let n=0;n<4;n++) gate.update(hip,0.1,false,options);
    hip[23].vis=0.1;gate.update(hip,0.1,false,options);
    assert.equal(gate.baseline,null);assert.equal(options[0].dwell,0,'loss resets gate');
}
{
    const r=Z.POSES[1],options=Z.options(1,{c:'1',w:'2'},true),gate=armed(r,options);
    const left=moved(r,'left'),right=moved(r,'right');
    left[16]={...right[15],x:right[15].x+80};
    for(let n=0;n<20;n++) assert.equal(gate.update(left,0.1,false,options).choice,null,'simultaneous options rejected');
    gate.update(standing(),0.1,true,options);assert.equal(gate.baseline,null,'initial reading gate');
}
console.log('PASS: 12 disjoint zones, boundary ownership, 24 pose targets, both hands/shoulders, cross, wrong part, loss, simultaneous answers');
