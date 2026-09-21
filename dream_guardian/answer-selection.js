/* Color-cursor answer selection. Geometry is intentionally independent of canvas rendering. */
(function(root){
  const HOLD_SECONDS=1;
  const CONFIDENCE=.55;
  const NEUTRAL={x:.5,y:.5};
  const CALIBRATION_SECONDS=.4;
  const CURSORS={
    leftHand:{label:'왼손',color:'#28E6FF',shape:'circle'},
    rightHand:{label:'오른손',color:'#FFCB4D',shape:'circle'},
    shoulder:{label:'어깨',color:'#C889FF',shape:'rect'},
    hip:{label:'골반',color:'#FF865E',shape:'diamond'}
  };
  // Ten non-overlapping viewport regions. The center answer circles occupy the intentional gap.
  const ZONES=[
    {id:1,label:'왼쪽 위',x:.02,y:.05,w:.23,h:.16},
    {id:2,label:'위',x:.27,y:.05,w:.46,h:.16},
    {id:3,label:'오른쪽 위',x:.75,y:.05,w:.23,h:.16},
    {id:4,label:'왼쪽',x:.02,y:.22,w:.23,h:.19},
    {id:5,label:'오른쪽',x:.75,y:.22,w:.23,h:.19},
    {id:6,label:'왼쪽 아래',x:.02,y:.57,w:.23,h:.16},
    {id:7,label:'가운데 아래',x:.27,y:.57,w:.46,h:.16},
    {id:8,label:'아래 왼쪽',x:.02,y:.74,w:.30,h:.14},
    {id:9,label:'아래',x:.35,y:.74,w:.30,h:.14},
    {id:10,label:'아래 오른쪽',x:.68,y:.74,w:.30,h:.14}
  ];
  const HIP_ZONES=[6,7,8,9,10];
  const UPPER_ZONES=[1,2,3,4,5,6,7];
  const SHOULDER_ZONES=[4,5,6,7];
  const RECIPES=[
    ['leftHand'],['rightHand'],['shoulder'],['hip'],
    ['leftHand','rightHand'],['leftHand','shoulder'],['rightHand','shoulder'],['leftHand','hip'],['rightHand','hip'],
    ['leftHand','rightHand','shoulder'],['leftHand','rightHand','hip'],['leftHand','shoulder','hip'],['rightHand','shoulder','hip']
  ];
  const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
  const valid=p=>p&&Number.isFinite(p.x)&&Number.isFinite(p.y)&&(p.vis??1)>=CONFIDENCE;
  const mid=(a,b)=>({x:(a.x+b.x)/2,y:(a.y+b.y)/2,vis:Math.min(a.vis,b.vis)});
  function sourcePoint(part,points,palms,sources){
    const palm=palms[part];
    if(sources?.[part]==='palm')return valid(palm)?palm:null;
    return points[part==='leftHand'?15:16];
  }
  function markers(points,palms={},sources){
    if(!valid(points?.[15])||!valid(points?.[16])||!valid(points?.[11])||!valid(points?.[12])||!valid(points?.[23])||!valid(points?.[24]))return null;
    const leftHand=sourcePoint('leftHand',points,palms,sources),rightHand=sourcePoint('rightHand',points,palms,sources);
    if(!valid(leftHand)||!valid(rightHand))return null;
    return {leftHand,rightHand,shoulder:mid(points[11],points[12]),hip:mid(points[23],points[24])};
  }
  function torso(points,palms,sources){const m=markers(points,palms,sources);if(!m)return 0;return Math.hypot(m.shoulder.x-m.hip.x,m.shoulder.y-m.hip.y);}
  function board(width,height){return{x:0,y:0,w:width,h:height};}
  function rect(id,width,height){const b=board(width,height),z=ZONES.find(z=>z.id===id);return{x:b.x+z.x*b.w,y:b.y+z.y*b.h,w:z.w*b.w,h:z.h*b.h};}
  function contains(z,p,inset=.025){return p&&p.x>=z.x+inset&&p.x<z.x+z.w-inset&&p.y>=z.y+inset&&p.y<z.y+z.h-inset;}
  function zoneCenter(id){const z=ZONES.find(v=>v.id===id);return{x:z.x+z.w/2,y:z.y+z.h/2};}
  function choose(array,random){return array[Math.floor(random()*array.length)];}
  function shuffled(array,random){const a=[...array];for(let i=a.length-1;i>0;i--){const j=Math.floor(random()*(i+1));[a[i],a[j]]=[a[j],a[i]];}return a;}
  function zoneCandidates(part){return part==='hip'?HIP_ZONES:part==='shoulder'?SHOULDER_ZONES:UPPER_ZONES;}
  function allocate(parts,used,random){
    const out=[];
    // Every fitness zone owns exactly one cursor color. No shared-zone requirements.
    for(const part of shuffled(parts,random)){
      const candidates=shuffled(zoneCandidates(part).filter(z=>!used.has(z)),random);
      if(!candidates.length)return null;
      const zoneId=candidates[0];used.add(zoneId);out.push({part,zoneId});
    }
    return out;
  }
  function choices(question,random=Math.random){
    // Two answers must use different cursor colors. With four physical cursor colors,
    // a symmetric 3-color vs 3-color question is impossible without color overlap.
    const count=choose([1,2],random);
    const recipes=RECIPES.filter(r=>r.length===count);
    for(let tries=0;tries<80;tries++){
      const a=choose(recipes,random);
      // The two answers must not share a cursor color, otherwise color cannot distinguish them.
      const opposing=recipes.filter(recipe=>recipe.length===count&&!recipe.some(part=>a.includes(part)));
      if(!opposing.length)continue;
      const b=choose(opposing,random);
      const activeZoneIds=buildActiveZones([a,b],count,random);
      if(!activeZoneIds)continue;
      const leftCorrect=random()>.5;
      return [
        {side:'left',text:leftCorrect?question.c:question.w,isCorrect:leftCorrect,isFullBody:true,requirements:a.map(part=>({part})),activeZoneIds,dwell:0},
        {side:'right',text:leftCorrect?question.w:question.c,isCorrect:!leftCorrect,isFullBody:true,requirements:b.map(part=>({part})),activeZoneIds,dwell:0}
      ];
    }
    throw new Error('Unable to allocate unique answer zones');
  }
  function canPartUseZone(part,zoneId){return zoneCandidates(part).includes(zoneId);}
  function hasMatching(parts,zoneIds){
    const visit=(index,used)=>{
      if(index===parts.length)return true;
      return zoneIds.some(zoneId=>!used.has(zoneId)&&canPartUseZone(parts[index],zoneId)&&visit(index+1,new Set([...used,zoneId])));
    };
    return visit(0,new Set());
  }
  function buildActiveZones(recipePair,count,random){
    for(let tries=0;tries<80;tries++){
      const zones=shuffled(ZONES.map(z=>z.id),random).slice(0,count);
      // The active fitness zones are shared. Either candidate answer must fit entirely
      // into this same set, using its own color cursor combination.
      if(recipePair.every(parts=>hasMatching(parts,zones)))return zones;
    }
    // Deterministic fallback that works for shoulder/hip intersections too.
    return count===1?[7]:[4,7];
  }
  function controlMarkers(points,baseline,palms){
    const now=markers(points,palms,baseline.sources),start=markers(baseline.points,baseline.palms,baseline.sources);if(!now||!start||!baseline.torso)return null;
    const gain={leftHand:[.72,.72],rightHand:[.72,.72],shoulder:[.32,.28],hip:[.34,.34]};
    const result={};
    for(const key of Object.keys(CURSORS)){
      const g=gain[key],p=now[key],s=start[key];
      result[key]={x:clamp(NEUTRAL.x+(p.x-s.x)/(baseline.torso*g[0]*2),0,1),y:clamp(NEUTRAL.y+(p.y-s.y)/(baseline.torso*g[1]*2),0,1),vis:p.vis};
    }
    // Shoulder recipes can be answered with either shoulder. Use the shoulder that moved
    // farther from its own baseline while retaining one purple cursor and one input value.
    const currentShoulders=[points[11],points[12]],startShoulders=[baseline.points[11],baseline.points[12]];
    const distances=currentShoulders.map((p,i)=>Math.hypot(p.x-startShoulders[i].x,p.y-startShoulders[i].y));
    const side=distances[0]>=distances[1]?0:1;
    const sg=gain.shoulder;
    result.shoulder={
      x:clamp(NEUTRAL.x+(currentShoulders[side].x-startShoulders[side].x)/(baseline.torso*sg[0]*2),0,1),
      y:clamp(NEUTRAL.y+(currentShoulders[side].y-startShoulders[side].y)/(baseline.torso*sg[1]*2),0,1),
      vis:currentShoulders[side].vis,shoulderIndex:side===0?11:12
    };
    return result;
  }
  class Gate{
    constructor(){this.reset();}
    reset(){this.baseline=null;this.previous=null;this.selected=null;this.held=0;this.controls=null;this.calibration=null;}
    interrupt(){this.reset();}
    update(points,dt,locked,options,palms={}){
      options.forEach(o=>o.dwell=0);
      if(locked||!(dt>0)||dt>.6){this.reset();return{hint:'문제를 확인하고 가운데에서 준비',choice:null};}
      const m=markers(points,palms),t=torso(points,palms);
      if(!m||t<10){this.reset();return{hint:'손·어깨·골반이 보이도록 서세요',choice:null};}
      if(!this.baseline){
        const sources={leftHand:valid(palms.leftHand)?'palm':'wrist',rightHand:valid(palms.rightHand)?'palm':'wrist'};
        const current=markers(points,palms,sources);
        if(!this.calibration){this.calibration={points:points.map(p=>p&&({...p})),palms:{...palms},torso:t,sources,markers:current,held:0};return{hint:'가운데에서 잠시 멈춰 기준 자세를 잡으세요',choice:null};}
        const movement=Math.max(...Object.keys(current).map(key=>Math.hypot(current[key].x-this.calibration.markers[key].x,current[key].y-this.calibration.markers[key].y)));
        if(movement>this.calibration.torso*.08){this.calibration={points:points.map(p=>p&&({...p})),palms:{...palms},torso:t,sources,markers:current,held:0};return{hint:'가운데에서 잠시 멈춰 기준 자세를 잡으세요',choice:null};}
        this.calibration.held+=Math.min(dt,.15);
        if(this.calibration.held<CALIBRATION_SECONDS)return{hint:'가운데에서 잠시 멈춰 기준 자세를 잡으세요',choice:null};
        this.baseline=this.calibration;
        return{hint:'가상 이동 커서를 피트니스존으로 이동',choice:null};
      }
      this.controls=controlMarkers(points,this.baseline,palms);
      if(!this.controls){this.selected=null;this.held=0;this.engagedZoneIds=[];return{hint:'손 인식을 다시 기다리는 중입니다',choice:null};}
      const active=[];
      for(const option of options){
        const mapping=findRequirementMapping(option.requirements.map(req=>req.part),option.activeZoneIds,this.controls);
        if(mapping)active.push({option,mapping});
      }
      if(active.length!==1){this.selected=null;this.held=0;this.engagedZoneIds=engagedZones(options,this.controls);return{hint:'정답 색상의 커서를 활성 피트니스존에 모두 놓으세요',choice:null};}
      const {option:choice,mapping}=active[0];
      this.engagedZoneIds=[...mapping.values()];
      const focus=choice.requirements.map(req=>{
        const zoneId=mapping.get(req.part),p=this.controls[req.part],z=ZONES.find(z=>z.id===zoneId);
        const cx=z.x+z.w/2,cy=z.y+z.h/2;
        const norm=Math.min(1,Math.hypot((p.x-cx)/(z.w/2),(p.y-cy)/(z.h/2)));
        return 1.5-.75*norm; // center 1.5x, edge 0.75x charging speed
      });
      const rate=focus.reduce((a,b)=>a+b,0)/focus.length;
      this.held=this.selected===choice.side?this.held+Math.min(dt,.15)*rate:Math.min(dt,.15)*rate;this.selected=choice.side;choice.dwell=Math.min(1,this.held/HOLD_SECONDS);
      return{hint:`${choice.requirements.map(r=>CURSORS[r.part].label).join(' + ')} 1초 유지`,choice:choice.dwell>=1?choice:null};
    }
  }
  function findRequirementMapping(parts,zoneIds,controls){
    const assign=(index,used,map)=>{
      if(index===parts.length)return map;
      const part=parts[index],p=controls[part];
      if(!p)return null;
      for(const zoneId of zoneIds){
        const zone=ZONES.find(z=>z.id===zoneId);
        if(!used.has(zoneId)&&canPartUseZone(part,zoneId)&&contains(zone,p)){
          const next=assign(index+1,new Set([...used,zoneId]),new Map([...map,[part,zoneId]]));
          if(next)return next;
        }
      }
      return null;
    };
    return assign(0,new Set(),new Map());
  }
  function engagedZones(options,controls){
    const out=new Set();
    for(const option of options)for(const req of option.requirements)for(const zoneId of option.activeZoneIds){
      const zone=ZONES.find(z=>z.id===zoneId),p=controls[req.part];
      if(p&&canPartUseZone(req.part,zoneId)&&contains(zone,p))out.add(zoneId);
    }
    return [...out];
  }
  function requiredParts(options){return [...new Set(options.flatMap(o=>o.requirements.map(r=>r.part)))];}
  const api={CURSORS,ZONES,RECIPES,HOLD_SECONDS,NEUTRAL,CALIBRATION_SECONDS,Gate,board,rect,contains,choices,controlMarkers,markers,zoneCenter,requiredParts,HIP_ZONES,SHOULDER_ZONES,canPartUseZone,buildActiveZones,findRequirementMapping,engagedZones};
  if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.AnswerSelection=api;
})(typeof globalThis!=='undefined'?globalThis:window);
