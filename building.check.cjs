// Headless interaction checks with a minimal DOM, without browser dependencies.
const fs=require('fs'),vm=require('vm'),assert=require('assert');
class Element{
  constructor(tag='g'){this.tag=tag;this.attrs={};this.children=[];this.events={};this.style={};this.textContent='';const values=new Set();this.classList={values:()=>[...values],add:(...v)=>v.forEach(x=>values.add(x)),remove:(...v)=>v.forEach(x=>values.delete(x)),contains:v=>values.has(v),toggle:(v,on)=>{on=on===undefined?!values.has(v):on;on?values.add(v):values.delete(v);return on}}}
  setAttribute(k,v){this.attrs[k]=String(v);if(k==='class')String(v).split(' ').forEach(x=>this.classList.add(x))}
  append(e){this.children.push(e)} replaceChildren(){this.children=[]} addEventListener(k,fn){this.events[k]=fn}
  click(){const event={stopPropagation(){},preventDefault(){}};if(this.onclick)this.onclick(event);if(this.events.click)this.events.click(event)}
}
const elements=new Map(),get=s=>{if(!elements.has(s))elements.set(s,new Element());return elements.get(s)};
let frame;const document={querySelector:get,createElement:tag=>new Element(tag),createElementNS:(ns,tag)=>new Element(tag),body:new Element(),hidden:false};

vm.runInNewContext(fs.readFileSync('building.js','utf8'),{document,matchMedia:()=>({matches:false}),requestAnimationFrame:fn=>frame=fn,Math,DOMPoint:class{}});
const people=get('#people').children,buttons=get('#people-list').children,furniture=get('#furniture').children;
const find=id=>furniture.find(e=>e.attrs['data-facility']===id),person=people[0];
assert.equal(people.length,10);assert.equal(buttons.map(e=>e.textContent).join(''),'ABCDEFGHIJ');
assert.equal(furniture.length,24);assert.equal(get('#doors').children.length,0);assert.equal(get('#rooms').children.length,0);
assert.equal(new Set(furniture.map(e=>e.attrs['data-space'])).size,furniture.length,'Exactly one interaction in every room');
assert(furniture.some(e=>e.attrs['data-type']==='desk'));assert(furniture.some(e=>e.attrs['data-type']==='chair'));
assert(!furniture.some(e=>/seat-11[2-7]/.test(e.attrs['data-facility'])));
assert(furniture.filter(e=>e.attrs['data-facility'].startsWith('gallery')).every(e=>e.attrs['data-action']==='view'));
let time=0;function advance(seconds=120){const end=time+seconds*1000;for(;time<=end;time+=50)frame(time)}
const initial=people.map(e=>e.attrs.transform);advance(60);assert.deepEqual(people.map(e=>e.attrs.transform),initial,'No autonomous wandering');
for(const [id,state]of [['lounge-sofa','lie'],['gallery-one','view'],['gallery-two','view'],['art-store','buy'],['cafe-coffee','drink'],['stairs-north','upstairs'],['stairs-south','upstairs'],['seat-123','sit'],['seat-111','sit'],['seat-110','work'],['seat-122','work']]){
  get('#reset').click();find(id).click();assert.equal(get('#routes').children.length,1,'Dotted route appears on selection');
  const routeBefore=get('#routes').children[0].attrs.points;advance(1);assert.notEqual(get('#routes').children[0].attrs.points,routeBefore,'Route follows movement');
  advance();assert(person.classList.contains(state),id+' arrives in '+state);assert.equal(get('#routes').children.length,0,'Route clears on arrival');
  if(state==='view')assert(!person.classList.contains('seated'));
  if(state==='work'){assert(person.classList.contains('seated'));assert(person.classList.contains('working'));assert(get('#person-state').textContent.includes('노트북'));}
}
get('#reset').click();find('lounge-sofa').click();advance();buttons[1].click();find('lounge-sofa').click();assert(get('#status').textContent.includes('한 사람'),'Different furniture in same room is blocked');
buttons[0].click();find('seat-123').click();buttons[1].click();find('lounge-sofa').click();assert(get('#status').textContent.includes('한 사람'),'Departing person keeps room occupied');
advance(12);find('lounge-sofa').click();assert(people[1].classList.contains('walking'),'Room released after corridor exit');advance();assert(people[1].classList.contains('lie'));
get('#wander').click();get('#pause').click();const position=people[1].attrs.transform;advance(1);assert.equal(people[1].attrs.transform,position);get('#pause').click();
get('#reset').click();assert(furniture.every(c=>!c.classList.contains('occupied')));assert.equal(people.length,10);
get('#zoom-in').click();assert.equal(get('#zoom-value').textContent,'125%');
console.log('PASS: A–J; no auto movement or doors; 24 symbols; restricted offices/galleries; room-level occupancy through exit; moving dotted route; arrival/pause/reset.');
if(process.argv.includes('--preview')){
  const sharp=require('C:/Users/user/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/sharp');
  const escape=s=>String(s).replaceAll('&','&amp;').replaceAll('"','&quot;').replaceAll('<','&lt;');
  function serialize(e){const attrs={...e.attrs,class:e.classList.values().join(' ')};return '<'+e.tag+' '+Object.entries(attrs).map(([k,v])=>k+'="'+escape(v)+'"').join(' ')+'>'+escape(e.textContent)+e.children.map(serialize).join('')+'</'+e.tag+'>'}
  const source=fs.readFileSync('assets/building-plan-only.svg','utf8').replace(/<svg[^>]*>/,'').replace(/<\/svg>\s*$/,'');
  const css=fs.readFileSync('building.css','utf8').replaceAll('var(--blue)','rgb(22,40,210)');
  const content='<svg xmlns="http://www.w3.org/2000/svg" width="1560" height="648" viewBox="-10 0 650 270"><style>'+css+'</style><defs><pattern id="grid" width="20" height="20" patternUnits="userSpaceOnUse"><path d="M20 0H0V20" fill="none" stroke="#1628d2" stroke-opacity=".08" stroke-width=".4"/></pattern></defs><rect x="-10" width="650" height="270" fill="white"/><rect x="-10" width="650" height="270" fill="url(#grid)"/><g transform="matrix(.5 -.8660254 .8660254 .5 -110 100)">'+source+'</g>'+['#rooms','#furniture','#doors','#people'].map(id=>get(id).children.map(serialize).join('')).join('')+'</svg>';
  sharp(Buffer.from(content)).png().toFile('building-scene-check.png').then(()=>console.log('Scene preview rendered.'));
}
