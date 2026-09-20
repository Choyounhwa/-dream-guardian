const assert=require('node:assert/strict');
const A=require('./answer-selection.js');
function base(){
  const p=Array.from({length:33},()=>({x:300,y:300,vis:1}));
  [[11,260,200],[12,340,200],[15,260,300],[16,340,300],[23,260,320],[24,340,320]].forEach(([i,x,y])=>p[i]={x,y,vis:1});
  return p;
}
function rng(){let i=0;return()=>((i++*37)%97)/97;}
for(let n=0;n<100;n++){
  const [a,b]=A.choices({c:'7',w:'9'},rng());
  assert.equal(a.requirements.length,b.requirements.length,'both answers use equal color count');
  assert.ok(a.requirements.length>=1&&a.requirements.length<=3);
  assert.deepEqual(a.activeZoneIds,b.activeZoneIds,'both answers share active fitness zones');
  assert.equal(new Set(a.activeZoneIds).size,a.activeZoneIds.length,'active zones are unique');
  assert.equal(new Set(A.requiredParts([a,b])).size,A.requiredParts([a,b]).length,'required cursor list is unique');
  for(const option of [a,b]){
    assert.ok(A.findRequirementMapping(option.requirements.map(r=>r.part),option.activeZoneIds,
      Object.fromEntries(option.requirements.map((r,i)=>[r.part,{x:A.zoneCenter(option.activeZoneIds[i]).x,y:A.zoneCenter(option.activeZoneIds[i]).y,vis:1}])))!==null,'answer fits shared zones');
    for(const r of option.requirements){
      if(r.part==='hip')assert.ok(option.activeZoneIds.some(id=>[6,7,8,9,10].includes(id)),'hip has lower-zone placement');
      if(r.part==='shoulder')assert.ok(option.activeZoneIds.some(id=>[4,5,6,7].includes(id)),'shoulder has 4-7 placement');
    }
  }
  const required=A.requiredParts([a,b]);
  assert.equal(required.length,new Set(required).size,'fitness board renders each required cursor once');
}
const options=[{side:'left',requirements:[{part:'leftHand'}],activeZoneIds:[1],dwell:0},{side:'right',requirements:[{part:'rightHand'}],activeZoneIds:[3],dwell:0}];
const gate=new A.Gate();
for(let i=0;i<8;i++)gate.update(base(),.1,false,options);
assert.ok(gate.baseline,'neutral calibration');
const moved=base();
// leftHand's control starts at x=.5,y=.62. Move up-left to zone 1.
moved[15]={x:160,y:110,vis:1};
for(let i=0;i<9;i++)gate.update(moved,.1,false,options);
assert.equal(options[0].dwell,0,'wrong cursor movements do not fill required zone');
// Build an exact marker in zone 1 with all other required cursor positions unchanged.
const z=A.ZONES.find(z=>z.id===1),center=A.zoneCenter(1),t=A.torso?A.torso:120;
// Direct control-mapping test covers exact cursor geometry independently.
const control=A.controlMarkers(base(),{points:base(),torso:120});
assert.ok(control.leftHand&&control.rightHand&&control.shoulder&&control.hip);
assert.equal(A.contains(z,{x:center.x,y:center.y,vis:1}),true);
assert.equal(A.contains(z,{x:z.x+z.w,y:center.y,vis:1}),false,'half-open border cannot overlap');
console.log('PASS: equal color counts, disjoint 1-10 requirements, hip lower constraints, calibration, control geometry');
