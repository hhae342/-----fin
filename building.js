(()=>{
  'use strict';
  const $=s=>document.querySelector(s), NS='http://www.w3.org/2000/svg', plan=$('#plan');
  const letters='ABCDEFGHIJ', project=p=>({x:.5*p.x+.8660254*p.y-110,y:-.8660254*p.x+.5*p.y+100});
  const corridor=[[42,150],[52,182],[62,210],[73,237],[84,263],[99,293],[111,316],[124,340],[138,366],[153,392],[169,417],[184,439],[201,461],[219,483],[239,506],[263,535],[286,560],[307,582]].map(([x,y])=>project({x,y}));
  // Source drawing coordinates: office rooms 112–117 intentionally have no destinations.
  const definitions=[
    {id:'lounge-sofa',space:'lounge',label:'소파',type:'sofa',action:'lie',x:48,y:245,node:3},
    {id:'gallery-one',space:'gallery-one',label:'이젤',type:'art',action:'view',x:129,y:280,node:4},
    {id:'gallery-two',space:'gallery-two',label:'이젤',type:'art',action:'view',x:150,y:325,node:6},
    {id:'art-store',space:'art-store',label:'서랍',type:'drawer',action:'buy',x:114,y:375,node:8},
    {id:'cafe-coffee',space:'cafe',label:'커피',type:'coffee',action:'drink',x:246,y:497,node:13},
    {id:'stairs-north',space:'stairs-north',label:'계단',type:'stairs',action:'climb',x:104,y:250,node:3,end:{x:98,y:234}},
    {id:'stairs-south',space:'stairs-south',label:'계단',type:'stairs',action:'climb',x:211,y:446,node:11,end:{x:221,y:458}},
    ...[
      ['111',21,160,0],['110',35,204,2],['109',60,274,4],['133',100,355,7],
      ['107b',125,399,9],['107a',137,419,10],['107',154,445,11],['106',175,475,12],
      ['104-105',192,497,13],['103',236,550,15],['102',256,573,16],
      ['101',281,598,17],['121a',164,376,8],['121b',176,395,9],['121c',190,418,10],
      ['122',273,525,15],['123',312,566,16]
    ].map(([room,x,y,node])=>{const desk=['110','109','107b','106','103','121a','121c','122'].includes(room);return {id:'seat-'+room,space:room,label:desk?'책상':'의자',type:desk?'desk':'chair',action:desk?'work':'sit',x,y,node}})
  ];
  const facilities=definitions.map(f=>({...f,...project(f),end:f.end?project(f.end):null,owner:null}));
  const states={idle:'기다리는 중',walking:'이동하는 중',sit:'앉아 쉬는 중',lie:'누워 쉬는 중',view:'작품을 감상하는 중',buy:'물건을 살펴보는 중',drink:'커피를 마시는 중',work:'노트북으로 작업하는 중',climb:'계단을 올라가는 중',upstairs:'계단 위에 도착'};
  const people=[];let selected=0,paused=matchMedia('(prefers-reduced-motion: reduce)').matches,zoom=1,last=null;
  function svg(tag,attrs={},parent){const e=document.createElementNS(NS,tag);for(const[k,v]of Object.entries(attrs))e.setAttribute(k,v);if(parent)parent.append(e);return e}
  function activate(e,label,action){e.setAttribute('role','button');e.setAttribute('tabindex','0');e.setAttribute('aria-label',label);e.addEventListener('click',event=>{event.stopPropagation();action()});e.addEventListener('keydown',event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();event.stopPropagation();action()}})}
  const tell=message=>{$('#status').textContent=message};
  function nearest(p){return corridor.reduce((best,n,i)=>Math.hypot(p.x-n.x,p.y-n.y)<Math.hypot(p.x-corridor[best].x,p.y-corridor[best].y)?i:best,0)}
  function pose(p,state){p.state=state;p.el.classList.remove(...Object.keys(states),'seated','working');p.el.classList.add(state);if(['sit','eat','drink','work'].includes(state))p.el.classList.add('seated');if(state==='work')p.el.classList.add('working')}
  function spaceTaken(f,except){return people.some(p=>p.id!==except&&[p.facility,p.room].some(i=>i!==null&&facilities[i].space===f.space))}
  function refreshFurniture(){facilities.forEach(f=>{const occupied=people.some(p=>[p.facility,p.room].some(i=>i!==null&&facilities[i].space===f.space));f.el.classList.toggle('occupied',occupied);f.el.setAttribute('aria-pressed',String(people[selected]?.facility!==null&&people[selected]?.facility!==undefined&&facilities[people[selected].facility].space===f.space))})}
  function drawRoute(){const p=people[selected];$('#routes').replaceChildren();if(p.path.length)svg('polyline',{points:[p,...p.path].map(n=>n.x+','+n.y).join(' ')},$('#routes'))}
  function updatePanel(){const p=people[selected];$('#person-state').textContent=letters[selected]+', '+states[p.state];people.forEach((q,i)=>{q.el.classList.toggle('selected',i===selected);q.button.setAttribute('aria-pressed',String(i===selected))});drawRoute();refreshFurniture()}
  function select(i){selected=i;updatePanel();tell(letters[i]+' 선택됨. 도면의 상징을 클릭하세요.')}
  function release(p){p.facility=null}
  function route(p,node,index=null){
    const f=index!==null?facilities[index]:null;
    if(f&&spaceTaken(f,p.id)){tell('이미 한 사람이 이용 중인 공간입니다. 빈 공간을 선택하세요.');return false}
    const exit=p.room!==null?facilities[p.room]:null;
    const start=exit?exit.node:(p.path.length&&p.path[0].node!==undefined?p.path[0].node:nearest(p));
    // Keep the old room occupied until its visitor has actually reached the corridor.
    const sameRoom=exit&&f&&exit.space===f.space;
    const returnSteps=exit&&!sameRoom?[(exit.end&&p.state==='upstairs')?{x:exit.x,y:exit.y}:{x:p.x,y:p.y},{...exit.entry},{...corridor[start],clearRoom:true}]:[];
    release(p);p.path=returnSteps;pose(p,'walking');
    if(!sameRoom){
      p.path.push({...corridor[start],node:start});
      const direction=node>=start?1:-1;for(let n=start+direction;direction>0?n<=node:n>=node;n+=direction)p.path.push({...corridor[n],node:n});
    }
    if(f){p.facility=index;if(!sameRoom)p.path.push({...f.entry,room:index});p.path.push({x:f.x,y:f.y,room:index,action:f.action});if(f.end)p.path.push({...f.end,room:index,action:'upstairs'})}
    updatePanel();return true;
  }
  function choose(index){const f=facilities[index];if(route(people[selected],f.node,index))tell(letters[selected]+' → '+f.label)}
  // Furniture and destinations only in shared spaces; galleries expose viewing actions only.
  facilities.forEach((f,i)=>{
    const c=corridor[f.node];f.entry={x:c.x+(f.x-c.x)*.52,y:c.y+(f.y-c.y)*.52};
    const g=svg('g',{class:'furniture',transform:'translate('+f.x+' '+f.y+')','data-facility':f.id,'data-action':f.action,'data-space':f.space,'data-type':f.type},$('#furniture'));f.el=g;
    svg('rect',{class:'hit',x:-11,y:-14,width:25,height:24},g);
    // Restrained CAD linework: thickness, curved edges and a few construction details.
    if(f.type==='chair'){
      svg('path',{d:'M-3.8 -7L-4.2 -13Q-4.2 -14 -3 -14H2.8Q4 -14 4 -13L3.6 -7ZM-4 -6L3.6 -6 5 -3H-5ZM-5 -3H5V-1.8H-5ZM-4 -1.8L-4.6 3M4 -1.8L4.6 3M-2 -7V-6M2 -7V-6'},g);
      svg('path',{d:'M-2.5 -11H2.5M-3 -10V-9M3 -10V-9',class:'detail',fill:'none'},g);
    }
    if(f.type==='desk'){
      svg('path',{d:'M-4 -9L10 -9 13 -6H-7ZM-7 -6H13V-4.8H-7ZM-5 -4.8L-5.5 3M11 -4.8L11.5 3M-4 -4.8H3V-1H-4Z'},g);
      svg('path',{d:'M2 -7.5L3 -14H9L8 -7.5ZM3.8 -12.8H8L7.5 -9H3.4ZM2 -7.5L.5 -6.6H8L8 -7.5M-1.5 -3H.5',class:'detail'},g);
    }
    if(f.type==='coffee'){
      svg('ellipse',{cx:0,cy:-2,rx:7,ry:1.8},g);
      svg('path',{d:'M-4.5 -11H4V-5Q3.8 -2.5 0 -2.5Q-4.2 -2.5 -4.5 -5ZM4 -9.8H5.5Q9 -9.8 7 -6Q6 -4.5 4 -5'},g);
      svg('ellipse',{cx:-.25,cy:-11,rx:4.25,ry:1.2},g);
      svg('path',{d:'M-2 -14Q-4 -16 -2 -18M2 -14Q0 -16 2 -18',class:'detail',fill:'none'},g);
    }
    if(f.type==='sofa'){
      svg('path',{d:'M-10 -5V-11Q-10 -13 -8 -13H10Q12 -13 12 -11V-5ZM-10 -6Q1 -8 12 -6V-1H-10ZM-12 -7Q-12 -9 -10 -8L-8 -7V0H-12ZM12 -8Q15 -9 15 -7V0H11V-7ZM-8 -1H11V1H-8ZM-10 1V3M13 1V3'},g);
      svg('path',{d:'M1 -12V-7M-7 -5H0M3 -5H10',class:'detail',fill:'none'},g);
    }
    if(f.type==='art'){
      svg('path',{d:'M-1 -22H1L2 -3 6 3H4L0 -4 -5 3H-7L-3 -4ZM1 -16L8 2H6L1 -11'},g);
      svg('path',{d:'M-7 -19H6V-6H-7ZM-8 -6H7V-4.5H-8Z'},g);
      svg('path',{d:'M-5 -17H4V-8H-5ZM-4 -10L-1 -14 3 -9',class:'detail',fill:'none'},g);
    }
    if(f.type==='drawer'){
      svg('path',{d:'M-6 -16L-3 -18H8L10 -16V0L7 2H-6ZM-6 -16H7V2M7 -16L10 -18M-6 -10H7M-6 -4H7M-5 2V4M6 2V4'},g);
      svg('path',{d:'M-1.5 -13.5H2.5V-12H-1.5ZM-1.5 -7.5H2.5V-6H-1.5ZM-1.5 -1.5H2.5V0H-1.5Z',class:'detail'},g);
    }
    // The source drawing already depicts stairs; only a transparent hit area is added.
    if(f.type==='stairs')g.setAttribute('class','furniture stair-target');
    activate(g,f.label,()=>choose(i));
  });
  for(let i=0;i<10;i++){
    const el=svg('g',{class:'person','data-person':letters[i]},$('#people'));
    svg('ellipse',{cx:0,cy:0,rx:5,ry:2,class:'selection'},el);svg('rect',{x:-6,y:-23,width:12,height:25,fill:'transparent'},el);
    const body=svg('g',{class:'figure body'},el);
    const standing=svg('g',{class:'standing'},body);
    // Seven-and-a-half-head proportions, filled arms and articulated hands.
    svg('path',{d:'M-2 -12L-2 -6 -1.6 -1.1 -2.5 -.4 -2.4 0H-.2L.2 -6 .8 -1.1 .8 0H3L3 -.5 2 -1.2 2.1 -12Z'},standing);
    svg('path',{d:'M-1.2 -18.2L-3 -17.3 -2.6 -12.1Q0 -11.4 2.6 -12.1L3 -17.3 1.2 -18.2Z'},standing);
    svg('path',{d:'M-3 -17.2Q-4 -17 -4 -15L-4.2 -11 -4.5 -9.7Q-4.4 -8.8 -3.7 -9.1L-3 -10.5 -2.7 -14.4 -2.2 -16.5ZM3 -17.2Q4 -17 4 -15L4.2 -11 4.5 -9.7Q4.4 -8.8 3.7 -9.1L3 -10.5 2.7 -14.4 2.2 -16.5Z'},standing);
    svg('path',{d:'M-1 -18.1V-19H1V-18.1M-1.5 -19.3Q-2 -20.4 -1.5 -21.5Q0 -23 1.5 -21.5Q2 -20.4 1 -19.2Q0 -18.7 -1.5 -19.3Z'},standing);
    svg('path',{d:'M-1.7 -20.5Q-2 -23 1 -22.2L1.7 -21M-2 -13H2',fill:'none'},standing);
    if(i%2===0)svg('path',{d:'M-1.7 -17Q0 -18 1.7 -17L2 -13H-2ZM-1 -16H1V-14H-1Z'},standing);
    const sitting=svg('g',{class:'sitting'},body);
    svg('path',{d:'M-2 -7L4 -7 5 -2 7 -1.4 7 -.5H3.5L2.5 -5H-1L-3 -6ZM-1 -6L2 -5 2 0H4V1H.5L0 -3 -3 -4Z'},sitting);
    svg('path',{d:'M-2 -14L1 -14 2 -9 3 -7H-3L-3 -11Z'},sitting);
    svg('path',{d:'M-1.5 -15Q-2.5 -18 .3 -18.5Q2 -18 1.5 -15.8L.8 -14.5H-1Z'},sitting);
    svg('path',{d:'M1 -13L2.5 -10 5 -10 5.7 -9.3 1.5 -9 -1 -12Z',class:'typing-arm'},sitting);
    const laptop=svg('g',{class:'laptop'},sitting);
    svg('path',{d:'M3 -9H8L9 -13H5ZM3 -9L1 -8.5H8L8 -9',fill:'white'},laptop);

    // Objects are separate so each activity has a distinct visible gesture.
    const cup=svg('g',{class:'cup'},sitting);svg('path',{d:'M3 -10H6V-7H3ZM6 -9Q9 -9 6 -7'},cup);
    const meal=svg('g',{class:'meal'},sitting);svg('ellipse',{cx:5,cy:-8,rx:3,ry:1},meal);svg('path',{d:'M0 -12L2 -10 5 -11M4 -11L5 -13',class:'food-hand',fill:'none'},meal);
    const bag=svg('g',{class:'bag'},standing);svg('path',{d:'M3 -9H7L8 -3H3ZM4 -9V-11Q5 -13 6 -11V-9'},bag);
    svg('path',{d:'M2 -17L4 -14 7 -14 8 -13H4L1 -16Z',class:'pay-hand'},standing);
    svg('path',{d:'M2 -17L4 -15 2 -20 3 -21 6 -15 5 -13 1 -16Z',class:'look-hand'},standing);
    const name=svg('text',{x:6,y:-12,class:'name'},el);name.textContent=letters[i];
    const button=document.createElement('button');button.textContent=letters[i];button.setAttribute('aria-label',letters[i]+' 인물 선택');button.onclick=()=>select(i);$('#people-list').append(button);
    const p={id:i,...corridor[i+2],el,button,path:[],state:'idle',facility:null,room:null,wait:3+i*1.3};people.push(p);activate(el,letters[i]+' 인물 선택',()=>select(i));el.setAttribute('transform','translate('+p.x+' '+p.y+')');
  }
  plan.addEventListener('click',event=>{const matrix=plan.getScreenCTM();if(!matrix)return;const point=new DOMPoint(event.clientX,event.clientY).matrixTransform(matrix.inverse()),n=nearest(point);route(people[selected],n);tell(letters[selected]+'이 복도를 따라 이동합니다.')});
  $('#wander').onclick=()=>route(people[selected],(nearest(people[selected])+5)%corridor.length);
  $('#sit').onclick=()=>{const options=facilities.map((f,i)=>({f,i})).filter(({f})=>['sit','drink'].includes(f.action)&&!spaceTaken(f,selected)).sort((a,b)=>Math.hypot(a.f.x-people[selected].x,a.f.y-people[selected].y)-Math.hypot(b.f.x-people[selected].x,b.f.y-people[selected].y));if(options.length)choose(options[0].i);else tell('이용 가능한 공용 좌석이 없습니다.')};
  function syncPause(){document.body.classList.toggle('paused',paused);$('#pause').textContent=paused?'▶ 움직임 재생':'Ⅱ 일시정지';$('#pause').setAttribute('aria-pressed',String(paused))}
  $('#pause').onclick=()=>{paused=!paused;syncPause()};syncPause();
  $('#reset').onclick=()=>{people.forEach((p,i)=>{release(p);Object.assign(p,corridor[i+2],{path:[],room:null,wait:3+i*1.3});pose(p,'idle');p.el.setAttribute('transform','translate('+p.x+' '+p.y+')')});selected=0;updatePanel();tell('A–J의 위치를 처음으로 되돌렸습니다.')};
  function scale(delta){zoom=Math.max(1,Math.min(2.5,zoom+delta));plan.style.height=zoom*100+'%';plan.style.width=zoom*100+'%';$('#zoom-value').textContent=Math.round(zoom*100)+'%'}
  $('#zoom-in').onclick=()=>scale(.25);$('#zoom-out').onclick=()=>scale(-.25);
  function tick(now){
    const dt=last===null?0:Math.min((now-last)/1000,.05);last=now;
    if(!paused&&!document.hidden)for(const p of people){
      if(p.path.length){
        const goal=p.path[0];if(goal.room!==undefined)p.room=goal.room;
        const dx=goal.x-p.x,dy=goal.y-p.y,distance=Math.hypot(dx,dy),speed=p.state==='climb'?4:12+p.id%3;
        if(distance<=speed*dt){p.x=goal.x;p.y=goal.y;p.path.shift();if(goal.clearRoom){p.room=null;refreshFurniture()}if(goal.room!==undefined)p.room=goal.room;if(goal.action)pose(p,goal.action);
          if(!p.path.length){if(!goal.action)pose(p,'idle');p.wait=10+p.id;if(p.id===selected){updatePanel();tell(letters[p.id]+', '+states[p.state])}}
        }else{p.x+=dx/distance*speed*dt;p.y+=dy/distance*speed*dt}
        p.el.setAttribute('transform','translate('+p.x+' '+p.y+')');
      }

    }
    if(people[selected].path.length&&!paused)drawRoute();
    requestAnimationFrame(tick);
  }
  updatePanel();requestAnimationFrame(tick);
})();
