const $=s=>document.querySelector(s);
const frame=$('#demo');
const clamp=x=>Math.min(1,Math.max(0,x));
const ease=x=>1-Math.pow(1-clamp(x),3);
const baseNode=(id,title,type,x,y,extra={})=>({id,title,type,x,y,done:false,notes:'',when:'none',horizon:1,...extra});
const now=baseNode('now','This is where I am','now',40,62,{done:true,notes:'Time, energy, skills. Start with what is true today.'});
const choose=baseNode('choose','Choose one meaningful project','step',310,62,{when:'week',notes:'Choose something useful enough to care about and small enough to finish.'});
const ship=baseNode('ship','Share a first, small version','step',580,62,{when:'today',notes:'Make something useful for one person.'});
const knot=baseNode('buffer','Build a financial buffer','knot',310,252,{when:'month',notes:'Research a realistic amount, then split this into specific saving steps.'});
const goal=baseNode('year','Build a life that feels like mine','goal',850,62,{horizon:1});
const vision='Work I care about. Room to breathe.';
const blank=()=>({version:1,example:false,vision:'',notes:'',nodes:[],edges:[]});
const edge=(source,target)=>({source,target});
function planAt(t){
 const p=blank();
 if(t<3)return {plan:p,view:'map'};
 p.vision=vision;
 if(t<8){
  p.vision=vision.slice(0,Math.floor(clamp((t-3.35)/1.3)*vision.length));
  p.nodes=[baseNode('five','A life with room to breathe','goal',0,0,{horizon:5}),baseNode('three','Work I care about','goal',0,0,{horizon:3}),baseNode('one','Share one meaningful project','goal',0,0,{horizon:1})].filter((n,i)=>t>=3.25+i*.55);
  return {plan:p,view:'vision'};
 }
 p.nodes=[structuredClone(now),structuredClone(goal)];
 if(t>=8.25)p.nodes.push(structuredClone(choose));
 if(t>=8.6)p.nodes.push(structuredClone(ship));
 if(t>=8.95)p.nodes.push(structuredClone(knot));
 if(t>=9.2)p.edges.push(edge('now','choose'));
 if(t>=9.35)p.edges.push(edge('ship','year'));
 if(t>=9.5)p.edges.push(edge('now','buffer'),edge('buffer','year'));
 return {plan:p,view:t<14?'map':'week',connect:t>=10.75,complete:t>=16.3?'ship':t>=12.2?'choose':null,camera:{z:.95,x:55,y:40}};
}
const scenes=[
 {start:0,end:3,kicker:'WAYFINDER / A LIFE MAP',headline:'Feeling lost?<br>Map a way<br><em>forward.</em>',sub:'',chapter:-1},
 {start:3,end:8,kicker:'01 / YOUR DIRECTION',headline:'Picture five<br>years <em>ahead.</em>',sub:'Then work backward:<br><strong>5 → 3 → 1.</strong>',chapter:0},
 {start:8,end:14,kicker:'02 / YOUR PATH',headline:'See what<br>comes <em>first.</em>',sub:'Connect prerequisites.<br>Untangle the knots.',chapter:1},
 {start:14,end:18,kicker:'03 / YOUR NEXT STEP',headline:'One step<br>for <em>today.</em>',sub:'Keep going.<br>Review each week.',chapter:2},
 {start:18,end:22,chapter:-1}
];
function center(selector){const node=frame.contentDocument.querySelector(selector);if(!node)return {x:0,y:0};const r=node.getBoundingClientRect();const f=frame.getBoundingClientRect();return {x:r.x+r.width/2+f.x,y:r.y+r.height/2+f.y};}
function cursorAt(a,b,p,click=0){const q=ease(p);const x=a.x+(b.x-a.x)*q,y=a.y+(b.y-a.y)*q;$('#cursor').style.cssText=`display:block;left:${x}px;top:${y}px`;if(click>0&&click<1){$('#ring').style.cssText=`display:block;left:${x}px;top:${y}px;opacity:${1-click};transform:translate(-50%,-50%) scale(${.4+click*1.3})`;}}
window.RENDER=async t=>{
 const scene=scenes.find(s=>t>=s.start&&t<s.end)||scenes.at(-1);
 const p=planAt(Math.min(t,17.99));
 // Completing the second step requires the first. Use the real app's completion logic.
 if(p.complete==='ship'){
  p.plan.nodes.find(n=>n.id==='choose').done=true;
 }
 frame.contentWindow.videoSet(p);
 await frame.contentDocument.fonts.ready;
 $('#progress').style.transform=`scaleX(${t/22})`;
 $('#cursor').style.display='none';$('#ring').style.display='none';
 const enter=ease((t-scene.start)/.35),exit=clamp((scene.end-t)/.16),opacity=enter*exit;
 const outro=t>=18;
 $('#outro').style.display=outro?'flex':'none';
 if(outro){$('#outro').style.opacity=1;for(const el of $('#outro').children){el.style.opacity=enter;el.style.transform=`translateY(${(1-enter)*14}px)`;}return;}
 $('#copy').style.opacity=opacity;$('#copy').style.transform=`translateY(${(1-enter)*20}px)`;
 $('#product').style.opacity=opacity;$('#product').style.transform=`translateX(${(1-enter)*24}px)`;
 $('#headline').style.fontSize=t<3?'96px':'108px';
 $('#kicker').textContent=scene.kicker;$('#headline').innerHTML=scene.headline;$('#sub').innerHTML=scene.sub;
 for(let i=0;i<3;i++)$('#ch'+i).classList.toggle('active',i===scene.chapter);
 if(t>=9.85&&t<10.9){const a=center('[data-connect="choose"]'),b=center('[data-node="ship"] h3');cursorAt(a,b,(t-10.15)/.5,t>=10.75?(t-10.75)/.3:0);}
 if(t>=11.65&&t<12.65){const a=center('[data-node="choose"] h3'),b=center('[data-complete="choose"]');cursorAt(a,b,(t-11.65)/.4,t>=12.2?(t-12.2)/.35:0);}
 if(t>=15.65&&t<16.8){const a=center('[data-edit="ship"]'),b=center('[data-complete="ship"]');cursorAt(a,b,(t-15.65)/.5,t>=16.3?(t-16.3)/.4:0);}
};
(async()=>{
 await new Promise(resolve=>{if(frame.contentWindow.videoSet)resolve();else frame.addEventListener('load',resolve,{once:true});});
 await document.fonts.ready;await frame.contentDocument.fonts.ready;
 const svg=frame.contentDocument.querySelector('.brand-symbol').innerHTML;
 $('#brand').innerHTML=svg+'<span>wayfinder<b>.</b></span>';
 $('#outro-brand').innerHTML=svg+'<span>wayfinder<b>.</b></span>';
 await window.RENDER(0.5);window.READY=true;
})();
