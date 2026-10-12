import { canConnect, isReady, blockers, validatePlan, layoutNodes } from './graph.js';
import { paths } from './icons.js';
import { PLAN_KEY, blankPlan, readSavedPlan, persistPlan } from './storage.js';

const $ = s => document.querySelector(s);
const escape = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const icon = (name, cls = '') => `<svg class="icon ${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[name] || paths.compass}</svg>`;
const logo = icon('compass');
const node = (id, title, type, x, y, extra = {}) => ({id,title,type,x,y,notes:'',done:false,when:'none',horizon:1,...extra});
function examplePlan() {
  return {version:1,example:true,vision:'Imagine an ordinary Tuesday, five years from now.\n\nI do work I care about, have room for the people I love, and feel at home in my own life. I have enough stability to choose thoughtfully, and enough curiosity to keep growing.\n\nThis is only an example. What would make you proud of your own life?',notes:'',nodes:[
    node('now','This is where I am','now',40,230,{done:true,notes:'Take stock without judging yourself. What is true about your time, money, energy, and skills today?'}),
    node('choose','Choose one meaningful project','step',310,46,{when:'today',notes:'Write down three things you want to make. Choose the one you would still care about if nobody saw it.'}),
    node('money','Understand my monthly spending','step',310,230,{when:'week',notes:'Look at the last 30 days. Write down essentials, commitments, and what is left.'}),
    node('room','Make room for myself','step',310,414,{when:'week',notes:'Protect two small blocks in your calendar for something you want to pursue.'}),
    node('ship','Share a first, small version','step',580,46,{when:'month',notes:'Make something useful for one person. Keep the scope small enough to finish.'}),
    node('buffer','Build a financial buffer','knot',580,230,{notes:'What is a realistic buffer for my circumstances? Research the amount, then split this into specific saving steps.'}),
    node('routine','Find a rhythm I can sustain','step',580,414,{when:'month',notes:'Try a routine for two weeks. Notice what gives you energy and what needs to change.'}),
    node('year','Build a life that feels like mine','goal',850,230,{notes:'In one year: finish a project I’m proud of, feel more financially steady, and have a weekly rhythm with room to breathe.'}),
  ],edges:[['now','choose'],['now','money'],['now','room'],['choose','ship'],['money','buffer'],['room','routine'],['ship','year'],['buffer','year'],['routine','year']].map(([source,target])=>({source,target}))};
}
const KEY = PLAN_KEY;
let browserStorage;
try { browserStorage = window.localStorage; } catch { /* Storage may be disabled. */ }
const initial = readSavedPlan(browserStorage);
let plan = initial.plan;
let storageFailed = initial.issue === 'unavailable';
let recovery = initial.recovery;
let externalPlan = null;
let view = 'map', filter = 'all', connecting = null, history = [];
let mapExpanded = false;
let camera = {x:0,y:0,z:1};
let pointer = null, suppressClick = false, fitQueued = true, toastTimer;
const ready = () => plan.nodes.filter(n=>isReady(n,plan.nodes,plan.edges));
const stepNodes = () => plan.nodes.filter(n=>n.type!=='now');
const doneCount = () => stepNodes().filter(n=>n.done).length;
function save() {
  if(recovery !== null || externalPlan !== null) { updateSaveState(); return false; }
  storageFailed = !persistPlan(browserStorage, plan);
  if(storageFailed) toast('Your browser couldn’t save. Export a backup to keep your changes.');
  updateSaveState();
  return !storageFailed;
}
function updateSaveState() {
  const pending = recovery !== null || externalPlan !== null;
  const el = $('#save-state');
  if(el) { el.innerHTML = `${icon(storageFailed||pending?'help':'check')} ${pending?'Review storage notice':storageFailed?'Not saved — export a backup':'Saved in this browser'}`; el.classList.toggle('save-warning', storageFailed||pending); }
  const notice=$('#storage-notice');if(notice)notice.innerHTML=storageNotice();
}
function storageNotice() {
  if(recovery !== null) return `<div class="storage-message"><span>${icon('help')} We couldn’t open your saved map. The original has been kept.</span><div><button class="text-button" data-action="recovery">Download original</button><button class="text-button" data-action="new-map">Start fresh</button></div></div>`;
  if(externalPlan !== null) return `<div class="storage-message"><span>${icon('help')} Your map changed in another tab. Choose which version to keep.</span><div><button class="text-button" data-action="load-latest">Load other tab</button><button class="text-button" data-action="keep-current">Keep this tab</button></div></div>`;
  if(storageFailed) return `<div class="storage-message"><span>${icon('help')} Browser saving is unavailable. Keep this tab open and export a backup.</span><button class="text-button" data-action="export">Export backup</button></div>`;
  return '';
}
function snapshot() { history.push(JSON.stringify(plan)); if(history.length>40) history.shift(); }
function commit() { save(); render(); }
function toast(message) { $('#toast').textContent=message; $('#toast').classList.add('visible'); clearTimeout(toastTimer); toastTimer=setTimeout(()=>$('#toast').classList.remove('visible'),4500); }
function undo() { if(!history.length) return toast('You’re at the beginning of this session.'); plan=JSON.parse(history.pop()); fitQueued=true; commit(); toast('Last change undone.'); }
function dateLabel() { return new Intl.DateTimeFormat('en',{month:'short',day:'numeric'}).format(new Date()); }
function updateThemeToggle() {
  const button = $('[data-action="theme"]');
  if(!button) return;
  const dark = document.documentElement.dataset.theme === 'dark';
  const label = dark ? 'Switch to light mode' : 'Switch to dark mode';
  button.innerHTML = icon(dark ? 'sun' : 'moon');
  button.setAttribute('aria-label', label);
  button.setAttribute('title', label);
  button.setAttribute('aria-pressed', String(dark));
}
window.addEventListener('themechange', updateThemeToggle);
function status(n) { if(n.done)return 'Completed'; if(n.type==='now')return 'Starting point'; if(n.type==='knot')return 'Needs untangling'; return isReady(n,plan.nodes,plan.edges)?'Ready to begin':'Has dependencies'; }
function render() {
  $('#app').innerHTML = `
    <a class="skip-link" href="#main-content">Skip to workspace</a>
    <div class="main-shell">
      <header class="app-header">
        <a class="brand" href="#map" data-view="map" aria-label="Wayfinder home"><span class="brand-symbol">${logo}</span>wayfinder<span class="brand-dot">.</span></a>
        <nav class="app-nav" aria-label="Workspace">${[['map','map','Map'],['vision','compass','Vision'],['week','week','Week'],['notes','notes','Notes']].map(([id,ic,label])=>`<button class="nav-item ${view===id?'active':''}" data-view="${id}" ${view===id?'aria-current="page"':''}>${icon(ic)}<span>${label}</span></button>`).join('')}</nav>
        <div class="header-actions"><span id="save-state" role="status"></span><button class="icon-button theme-toggle" data-action="theme" aria-label="Switch to dark mode" aria-pressed="false"></button><details class="backup-menu"><summary aria-label="Backup and map options">${icon('download')}<span>Backup</span>${icon('down')}</summary><div class="backup-options"><button data-action="export">${icon('download')} Export backup</button><button data-action="import">${icon('upload')} Import backup</button><button data-action="help">${icon('help')} How it works</button><button data-action="new-map">${icon('plus')} Start a fresh map</button></div></details></div>
      </header>
      <div id="storage-notice" role="status">${storageNotice()}</div>
      <main id="main-content" tabindex="-1">${view==='map'?mapView():view==='vision'?visionView():view==='week'?weekView():notesView()}</main>
      <footer class="page-footer"><span>${icon('lock')} No signup. Plans stay in your browser. Export a backup to keep them.</span><a href="https://www.yacinemahdid.com/p/how-to-stop-feeling-lost-in-tech" target="_blank" rel="noopener noreferrer">The idea behind Wayfinder ${icon('arrow')}</a></footer>
    </div>`;
  updateSaveState();
  updateThemeToggle();
  const journal=$('#vision-text')||$('#notes-text');if(journal)journal.maxLength=100000;
  if(view==='map') {
    renderGraph();
    if(fitQueued) {
      requestAnimationFrame(()=>{
        fitGraph();
        if(window.matchMedia('(max-width:680px)').matches&&filter==='all'&&plan.nodes.length>1&&$('#viewport')) {
          const start=plan.nodes.find(n=>n.type==='now')||plan.nodes[0];
          camera={z:.85,x:24-start.x*.85,y:$('#viewport').clientHeight/2-(start.y+73)*.85};
          updateCamera();
        }
      });
      fitQueued=false;
    }
  }
}
function mapView() {
  const next=ready();
  return `<div class="page-heading"><div><h1>Your life map<span>.</span></h1><p>Work backward from a future you care about. <button class="text-button inline-help" data-action="help">${icon('help')} How to use</button></p></div><button class="button primary" data-action="add">${icon('plus')} Add a step</button></div>
  ${plan.vision?`<button class="vision-banner" data-view="vision"><span class="vision-symbol">${icon('compass')}</span><span><span class="eyebrow">MY DIRECTION</span><strong>${escape(visionHeadline())}</strong></span>${icon('arrow')}</button>`:''}
  <section class="map-section ${mapExpanded?'window-expanded':''}" aria-label="Your life map">
    <div class="map-toolbar"><div class="map-title">${icon('map')}<h2>Your path</h2><span class="step-count">${plan.nodes.length} ${plan.nodes.length===1?'step':'steps'}</span></div><div class="map-tools"><div class="filters" aria-label="Filter steps">${[['all','All steps'],['ready','Ready now'],['knots','Knots']].map(([id,title])=>`<button data-filter="${id}" class="${filter===id?'selected':''}" aria-pressed="${filter===id}">${title}${id==='knots'?`<span>${plan.nodes.filter(n=>n.type==='knot'&&!n.done).length}</span>`:''}</button>`).join('')}</div><button class="icon-button expand-button" data-window-action="maximize" aria-label="${mapExpanded?'Restore map size':'Expand map'}" title="${mapExpanded?'Restore map size':'Expand map'}">${icon(mapExpanded?'restore':'maximize')}</button></div></div>
    <div id="viewport" class="graph-viewport ${connecting?'connecting':''}" tabindex="0" aria-label="Life map. Drag the background or use arrow keys to pan. Use the zoom buttons to zoom.">
      <div class="canvas-topline">${plan.example?`<div class="example-label">Example map <button data-action="new-map">Make my own ${icon('arrow')}</button></div>`:'<span></span>'}<span class="canvas-instruction">${connecting?'Choose the next step · Esc to cancel':'Drag to move · Click to edit'}</span></div>
      <div id="graph-world"><svg id="edges" aria-hidden="true"></svg><div id="nodes"></div></div>
      ${!plan.nodes.length?`<div class="empty-map"><span class="empty-symbol">${icon('compass')}</span><h3>Every path starts somewhere.</h3><p>Add where you are now, or a goal you care about.<br>Then connect the steps in between.</p><div class="empty-actions"><button class="button primary" data-action="add">${icon('plus')} Add my first step</button><button class="button secondary" data-action="example">Try an example</button></div></div>`:''}
      <div class="canvas-bottom"><div class="legend"><span><i class="legend-dot ready"></i>Ready</span><span><i class="legend-dot knot"></i>Knot</span><span><i class="legend-dot done"></i>Complete</span></div><div class="graph-controls"><button class="icon-button" data-action="undo" aria-label="Undo last change" title="Undo last change" ${!history.length?'disabled':''}>${icon('undo')}</button><span class="control-divider"></span><button class="icon-button" data-action="layout" title="Arrange steps" aria-label="Arrange steps">${icon('layout')}</button><button class="icon-button" data-action="fit" title="Fit map to screen" aria-label="Fit map to screen">${icon('fit')}</button><span class="control-divider"></span><button class="icon-button" data-action="zoom-out" aria-label="Zoom out">${icon('minus')}</button><span id="zoom-level">100%</span><button class="icon-button" data-action="zoom-in" aria-label="Zoom in">${icon('plus')}</button></div></div>
    </div>
    <div class="map-footnote">${icon('link')} Connect a prerequisite to the step it makes possible.<button class="text-button" data-action="help">How to connect ${icon('arrow')}</button></div>
  </section>
  ${next.length?`<section class="next-section"><div class="section-heading"><h2>Ready to begin <span>${next.length}</span></h2><button class="text-button" data-view="week">Plan my week ${icon('arrow')}</button></div><div class="next-grid">${next.slice(0,3).map(n=>`<button class="next-card" data-edit="${escape(n.id)}"><span class="next-ready">${icon('sprout')}</span><span><strong>${escape(n.title)}</strong><span>${n.when==='today'?'Today':n.when==='week'?'This week':'Ready when you are'}</span></span>${icon('arrow')}</button>`).join('')}</div></section>`:''}`;
}
function visionHeadline() { const first=plan.vision.split('\n').find(s=>s.trim()); return !first||(plan.example&&first==='Imagine an ordinary Tuesday, five years from now.')?'A future that feels like me.':first.slice(0,120); }
function visionView() {
  return `<div class="page-heading"><div><h1>Your direction<span>.</span></h1><p>Picture your life in five years. Start with what matters to you.</p></div></div><div class="vision-layout"><section class="writing-panel"><div class="writing-heading">${icon('compass')}<h2>Picture an ordinary day, five years from now.</h2></div><p class="writing-prompt">Where are you? What are you doing? Who is around you? Write freely, before trying to make a plan.</p><label for="vision-text" class="sr-only">Your future vision</label><textarea id="vision-text" class="journal-textarea" placeholder="I wake up, and my life feels like…">${escape(plan.vision)}</textarea><div class="writing-footer">No right answers. No need to make it impressive.<span>${icon('download')} Export a copy from Backup</span></div></section></div><section class="horizon-section"><div class="section-heading"><div><span class="eyebrow">WORK BACKWARD FROM THAT PICTURE</span><h2>Give your vision a few landmarks.</h2></div></div><div class="horizon-grid">${[5,3,1].map(y=>`<section class="horizon-card"><div class="horizon-label"><span>${y} ${y===1?'YEAR':'YEARS'}</span>${icon('target')}</div><h3>${y===5?'The bigger picture':y===3?'The bridge to get there':'Close enough to begin'}</h3><p>${y===5?'What 2–3 outcomes would make this vision real?':y===3?'What needs to be true to stay on that path?':'What can you change in the next twelve months?'}</p><div class="goal-list">${plan.nodes.filter(n=>n.type==='goal'&&n.horizon===y).map(n=>`<button data-edit="${escape(n.id)}">${icon(n.done?'check':'target')} ${escape(n.title)} ${icon('arrow')}</button>`).join('')}</div><button class="text-button" data-add-goal="${y}">${icon('plus')} Add a ${y}-year goal</button></section>`).join('')}</div></section>`;
}
function weekView() {
  const tasks = plan.nodes.filter(n=>n.type!=='now'&&n.when!=='none');
  return `<div class="page-heading"><div><h1>This week<span>.</span></h1><p>Choose a few steps that fit your time and energy.</p></div><span class="date-pill">${icon('week')} ${dateLabel()}</span></div><div class="week-summary">${icon('sun')}<span><strong>${tasks.filter(n=>!n.done&&isReady(n,plan.nodes,plan.edges)).length} scheduled steps are ready.</strong> Give one of them a little time today.</span><button class="text-button" data-view="map">Back to my map ${icon('arrow')}</button></div><div class="week-grid">${[['today','Today','Keep it small.'],['week','This week','A little room for progress.'],['month','This month','Something to work toward.']].map(([id,label,sub])=>`<section class="week-column"><div class="week-column-title"><h2>${label}</h2><span>${tasks.filter(n=>n.when===id&&!n.done).length}</span></div><p>${sub}</p><div class="week-tasks">${tasks.filter(n=>n.when===id).sort((a,b)=>Number(a.done)-Number(b.done)).map(n=>`<article class="task-card ${n.done?'is-done':''}"><button class="task-check ${n.done?'checked':''}" data-complete="${escape(n.id)}" aria-label="${n.done?'Reopen':'Complete'} ${escape(n.title)}">${n.done?icon('check'):''}</button><button class="task-content" data-edit="${escape(n.id)}"><span class="task-status ${n.type==='knot'?'knot-text':''}">${status(n)}</span><strong>${escape(n.title)}</strong><p>${escape(n.notes.slice(0,125))}${n.notes.length>125?'…':''}</p></button><div class="task-schedule"><label>Move to<select data-schedule="${escape(n.id)}" aria-label="Schedule ${escape(n.title)}">${[['none','Unscheduled'],['today','Today'],['week','This week'],['month','This month']].map(([v,l])=>`<option value="${v}" ${n.when===v?'selected':''}>${l}</option>`).join('')}</select></label></div></article>`).join('') || `<div class="week-empty">${icon('sprout')}<span>A little breathing room.</span><p>Choose a step from your map<br>or add something small.</p></div>`}</div><button class="add-week-step" data-add-when="${id}">${icon('plus')} Add a step</button></section>`).join('')}</div><div class="weekly-review"><span class="review-symbol">${icon('notes')}</span><div><h2>A quiet check-in, once a week.</h2><p>What moved forward? What did you learn? What needs a gentler plan?</p></div><button class="button secondary" data-view="notes">Make a little note ${icon('arrow')}</button></div>`;
}
function notesView() {
  return `<div class="page-heading"><div><h1>Field notes<span>.</span></h1><p>What’s working? What would you like to change?</p></div></div><section class="writing-panel notes-panel"><div class="writing-heading">${icon('notes')}<h2>My field notes</h2></div><p class="writing-prompt">What did you learn this week? Which knot needs a closer look? What would you like to try differently?</p><label class="sr-only" for="notes-text">Your field notes</label><textarea id="notes-text" class="journal-textarea" placeholder="Today I noticed…\n\nSomething I’m wondering about…\n\nOne thing I want to try next…">${escape(plan.notes)}</textarea><div class="writing-footer">A plan is allowed to change as you do.<span>${icon('download')} Export a copy from Backup</span></div></section><div class="notes-tip">${icon('knot')}<p><strong>A knot is a question, waiting for a little attention.</strong><br>If a step feels vague, write what you don’t know. Research it, then break it into smaller steps on your map.</p></div>`;
}
function visibleNodes() { return plan.nodes.filter(n=>filter==='all'||(filter==='ready'?isReady(n,plan.nodes,plan.edges):n.type==='knot'&&!n.done)); }
function renderGraph() {
  const el=$('#nodes'); if(!el)return;
  const nodes=visibleNodes();
  el.innerHTML=nodes.map(n=>`<article class="graph-node type-${n.type} ${n.done?'node-done':''} ${isReady(n,plan.nodes,plan.edges)?'node-ready':''}" data-node="${escape(n.id)}" style="left:${n.x}px;top:${n.y}px" tabindex="0" role="button" aria-label="${escape(n.title)}, ${status(n)}. Open to edit."><button class="handle handle-in" data-connect-target="${escape(n.id)}" aria-label="Connect prerequisite to ${escape(n.title)}" title="Connect a step to this one"></button><div class="node-top"><span class="node-kind">${icon(n.type==='goal'?'target':n.type==='now'?'compass':n.type==='knot'?'knot':'sprout')}${n.type==='goal'?`${n.horizon}-year goal`:n.type==='now'?'Where I am now':n.type==='knot'?'Knot to untangle':'A little step'}</span><button class="node-check ${n.done?'checked':''}" data-complete="${escape(n.id)}" aria-label="${n.done?'Reopen':'Complete'} ${escape(n.title)}" title="${n.done?'Mark incomplete':'Mark complete'}">${n.done?icon('check'):''}</button></div><h3>${escape(n.title)}</h3><div class="node-bottom"><span class="node-status"><i></i>${n.done?'Complete':n.type==='now'?'My starting point':n.type==='knot'?'Needs a closer look':isReady(n,plan.nodes,plan.edges)?'Ready to begin':n.type==='goal'?'My north star':'One step at a time'}</span>${n.when!=='none'&&!n.done?`<span class="node-time">${n.when==='today'?'Today':n.when==='week'?'This week':'This month'}</span>`:''}</div><button class="handle handle-out" data-connect="${escape(n.id)}" aria-label="Add connection from ${escape(n.title)}" title="Connect to the next step">${icon('plus')}</button></article>`).join('');
  drawEdges(); updateCamera();
  const noResult = $('#filter-empty'); if(noResult)noResult.remove();
  if(!nodes.length&&plan.nodes.length) {const empty=document.createElement('div');empty.id='filter-empty';empty.className='empty-map';empty.innerHTML=`${icon(filter==='knots'?'knot':'sprout')}<h3>${filter==='knots'?'No knots to untangle.':'No steps ready just yet.'}</h3><p>${filter==='knots'?'Mark an uncertain step as a knot when you need to explore it.':'Finish a prerequisite or add a small, independent step.'}</p><button class="button secondary" data-filter="all">Show all steps</button>`;$('#viewport').append(empty);}
}
function drawEdges() {
  const svg=$('#edges');if(!svg)return;
  const nodes=visibleNodes();const ids=new Set(nodes.map(n=>n.id));
  svg.innerHTML=`<defs><marker id="arrowhead" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto"><path d="M1 1l5 3-5 3" fill="none" stroke="#1a2a4a" stroke-width="1.5"/></marker><marker id="arrowdone" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto"><path d="M1 1l5 3-5 3" fill="none" stroke="#1a2a4a" stroke-width="1.5"/></marker></defs>${plan.edges.filter(e=>ids.has(e.source)&&ids.has(e.target)).map(e=>{const a=nodes.find(n=>n.id===e.source),b=nodes.find(n=>n.id===e.target); const x1=a.x+222,y1=a.y+73,x2=b.x-7,y2=b.y+73;const bend=Math.max(45,Math.abs(x2-x1)*.5);return `<path d="M${x1} ${y1} C${x1+bend} ${y1},${x2-bend} ${y2},${x2} ${y2}" class="edge ${a.done?'edge-done':''}" marker-end="url(#${a.done?'arrowdone':'arrowhead'})"/>`;}).join('')}`;
}
function updateCamera() {const world=$('#graph-world');if(!world)return;world.style.transform=`translate(${camera.x}px,${camera.y}px) scale(${camera.z})`;$('#zoom-level').textContent=Math.round(camera.z*100)+'%';}
function fitGraph() {
  const viewport=$('#viewport'); if(!viewport)return;const nodes=visibleNodes();if(!nodes.length)return;
  const left=Math.min(...nodes.map(n=>n.x))-26,top=Math.min(...nodes.map(n=>n.y))-24;
  const width=Math.max(...nodes.map(n=>n.x))+250-left,height=Math.max(...nodes.map(n=>n.y))+170-top;
  const w=viewport.clientWidth,h=viewport.clientHeight;
  const z=Math.min(1.1,(w-60)/width,(h-118)/height);
  camera={z:Math.max(.12,z),x:(w-width*z)/2-left*z,y:57+(h-118-height*z)/2-top*z};updateCamera();
}
function zoom(factor) {const v=$('#viewport');if(!v)return;const z=Math.max(.12,Math.min(2,camera.z*factor)),cx=v.clientWidth/2,cy=v.clientHeight/2;camera.x=cx-(cx-camera.x)*z/camera.z;camera.y=cy-(cy-camera.y)*z/camera.z;camera.z=z;updateCamera();}
function cascadeReopen(id) {
  const stack=[id],seen=new Set();while(stack.length){const key=stack.pop();if(seen.has(key))continue;seen.add(key);const n=plan.nodes.find(n=>n.id===key);if(n)n.done=false;plan.edges.filter(e=>e.source===key).forEach(e=>stack.push(e.target));}
}
function toggleComplete(id) {
  const n=plan.nodes.find(n=>n.id===id);if(!n)return;
  if(!n.done&&n.type==='knot')return toast('Untangle this knot first: edit it and change its kind to “A step.”');
  const waiting=blockers(n,plan.nodes,plan.edges);
  if(!n.done&&waiting.length)return toast(`First, complete “${waiting[0].title}”${waiting.length>1?` and ${waiting.length-1} other prerequisite${waiting.length>2?'s':''}`:''}.`);
  snapshot();if(n.done)cascadeReopen(id);else n.done=true;commit();toast(n.done?'A little further along. Step complete.':'Step reopened. Dependent steps were reopened too.');
}
function connect(source,target) {
  if(plan.edges.length>=10000){toast('This map has reached 10,000 connections. Remove a connection first.');return;}
  if(!canConnect(plan.nodes,plan.edges,source,target)){toast(source===target?'A step can’t depend on itself.':'That connection already exists or would make a loop. Try another step.');return;}
  snapshot();plan.edges.push({source,target});const n=plan.nodes.find(n=>n.id===target);if(n.done&&!plan.nodes.find(n=>n.id===source).done)cascadeReopen(target);connecting=null;commit();toast('Connected. The first step is a prerequisite for the next.');
}
function editor(id=null, defaults={}) {
  connecting=null;
  const existing=plan.nodes.find(n=>n.id===id);
  if(!existing&&plan.nodes.length>=2000){toast('This map has reached 2,000 steps. Export a backup before starting a new map.');return;}
  const n=existing||node('', '', defaults.type||'step', 60,60,{...defaults});
  const incoming=plan.edges.filter(e=>e.target===n.id).map(e=>e.source);
  const baseEdges=plan.edges.filter(e=>e.target!==n.id);
  const d=$('#editor');
  d.innerHTML=`<form id="step-form"><div class="dialog-heading"><span class="eyebrow">${existing?'ONE PIECE OF YOUR PATH':'MAKE A LITTLE ROOM FOR PROGRESS'}</span><button type="button" class="icon-button" data-close="editor" aria-label="Close step editor">${icon('close')}</button></div><h2 id="editor-title">${existing?'Make this step yours.':'What’s your next step?'}</h2><label class="field">Give it a name<input name="title" required maxlength="160" placeholder="Something small and specific…" value="${escape(n.title)}"></label><div class="field-row"><label class="field">Kind of step<select name="type">${[['now','Where I am now'],['step','A step'],['knot','A knot to untangle'],['goal','A goal']].map(([v,l])=>`<option value="${v}" ${n.type===v?'selected':''}>${l}</option>`).join('')}</select></label><label class="field">Make time for it<select name="when">${[['none','Not scheduled yet'],['today','Today'],['week','This week'],['month','This month']].map(([v,l])=>`<option value="${v}" ${n.when===v?'selected':''}>${l}</option>`).join('')}</select></label></div><label class="field horizon-field" ${n.type!=='goal'?'hidden':''}>Goal horizon<select name="horizon">${[1,3,5].map(y=>`<option value="${y}" ${n.horizon===y?'selected':''}>${y} ${y===1?'year':'years'} from now</option>`).join('')}</select></label><label class="field">A little more context <span class="optional">(optional)</span><textarea name="notes" maxlength="20000" rows="4" placeholder="What does done look like? What do you need to find out?">${escape(n.notes)}</textarea></label><fieldset class="dependency-field"><legend>What needs to happen first?</legend><p>Choose prerequisites. Leave empty if you can start independently.</p><div class="dependency-list">${plan.nodes.filter(other=>other.id!==n.id).map(other=>{const allowed=!existing||canConnect(plan.nodes,baseEdges,other.id,n.id);return `<label class="dependency-option ${!allowed?'unavailable':''}"><input type="checkbox" name="dependencies" value="${escape(other.id)}" ${incoming.includes(other.id)?'checked':''} ${!allowed?'disabled':''}><span>${escape(other.title)}${!allowed?'<small>Would create a loop</small>':''}</span>${other.done?icon('check'):''}</label>`;}).join('')||'<span class="dependency-empty">Your first step can begin right here.</span>'}</div></fieldset><div id="form-error" role="alert"></div><div class="dialog-footer">${existing?`<button type="button" class="delete-step" data-delete="${escape(n.id)}">${icon('trash')} Delete step</button>`:'<span class="dialog-note">Small and specific is a good start.</span>'}<button class="button primary" type="submit">${icon('check')} ${existing?'Save changes':'Add to my map'}</button></div></form>`;
  $('#step-form').addEventListener('submit',e=>{
    e.preventDefault();const f=new FormData(e.target);const title=String(f.get('title')).trim();if(!title){$('#form-error').textContent='Give your step a name to continue.';return;}
    const key=existing?.id||crypto.randomUUID();
    const updated={...n,id:key,title,notes:String(f.get('notes')),type:String(f.get('type')),when:String(f.get('when')),horizon:Number(f.get('horizon'))};
    const candidateNodes=existing?plan.nodes.map(a=>a.id===key?updated:a):[...plan.nodes,updated];
    const candidateEdges=plan.edges.filter(a=>a.target!==key);
    for(const source of f.getAll('dependencies')){if(!canConnect(candidateNodes,candidateEdges,source,key)){$('#form-error').textContent='That prerequisite would make a loop. Choose a different step.';return;}candidateEdges.push({source,target:key});}
    if(!existing){const parents=candidateNodes.filter(a=>f.getAll('dependencies').includes(a.id));updated.x=parents.length?Math.max(...parents.map(a=>a.x))+270:55;updated.y=parents.length?parents.reduce((total,a)=>total+a.y,0)/parents.length:55;while(candidateNodes.some(a=>a.id!==key&&Math.abs(a.x-updated.x)<235&&Math.abs(a.y-updated.y)<165))updated.y+=184;}
    if(candidateEdges.length>10000){$('#form-error').textContent='This map has reached 10,000 connections. Remove a connection before adding more.';return;}
    snapshot();plan.nodes=candidateNodes;plan.edges=candidateEdges;
    if(updated.done&&(updated.type==='knot'||blockers(updated,plan.nodes,plan.edges).length))cascadeReopen(key);
    fitQueued=true;d.close();commit();toast(existing?'Step updated. Your map can grow with you.':'A new step on your path.');
  });
  d.querySelector('[name="type"]').addEventListener('change',e=>{d.querySelector('.horizon-field').hidden=e.target.value!=='goal';});
  d.showModal();
}
function confirmAction(title,body,label,action) {
  const d=$('#confirm-dialog');d.classList.remove('help-dialog');d.innerHTML=`<div class="dialog-heading"><span class="eyebrow">A MOMENT TO CHECK</span><button class="icon-button" data-close="confirm-dialog" aria-label="Close">${icon('close')}</button></div><h2 id="confirm-title">${escape(title)}</h2><p class="confirm-body">${escape(body)}</p><div class="confirm-actions"><button class="button secondary" data-close="confirm-dialog">Keep things as they are</button><button class="button primary" id="confirm-action">${escape(label)}</button></div>`;$('#confirm-action').onclick=()=>{d.close();action();};d.showModal();
}
function exportPlan() {
  downloadBackup(JSON.stringify(plan,null,2));toast('Backup downloaded. Keep it somewhere safe.');
}
function downloadBackup(contents, name='wayfinder') {
  const blob=new Blob([contents],{type:'application/json'});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=`${name}-${new Date().toISOString().slice(0,10)}.json`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
}
function help() {
  const d=$('#confirm-dialog');
  d.classList.add('help-dialog');
  d.innerHTML=`
    <div class="dialog-heading"><span class="eyebrow">THE WAFFLEHOUSE METHOD, IN WAYFINDER</span><button class="icon-button" data-close="confirm-dialog" aria-label="Close guide">${icon('close')}</button></div>
    <h2 id="confirm-title">From a future to a first step.</h2>
    <p class="guide-intro">The original method spans two days of reflection and planning. Adapt the pace to your circumstances.</p>
    <ol class="guide method-guide">
      <li><strong>Picture a future you care about.</strong><span>Picture yourself five years from now. Write freely about what matters to you.</span><p class="guide-control"><b>In Vision:</b> describe an ordinary day in the large text box. Keep discoveries or questions in Notes.</p></li>
      <li><strong>Work backward: 5 years → 3 years → 1 year.</strong><span>Choose two or three five-year outcomes, then trace three- and one-year milestones.</span><p class="guide-control"><b>In Vision:</b> use Add a 5-year goal, then the 3- and 1-year buttons. Each goal also appears on your map.</p></li>
      <li><strong>Map where you are now.</strong><span>Describe your current resources. Break the route to your one-year goals into realistic actions.</span><p class="guide-control"><b>In Map:</b> Add a step, choose “Where I am now,” and record your time, resources, or skills. Add actions as “A step” and explain what done means in the context field.</p></li>
      <li><strong>Connect prerequisites.</strong><span>A DAG is a directed acyclic graph: arrows show prerequisites, and no path loops back on itself.</span><p class="guide-control"><b>In Map:</b> click + on a card’s right edge, then the card that depends on it. Or edit that second card and select “What needs to happen first?” Drag cards to arrange them.</p><div class="guide-example" aria-label="Example prerequisite chain"><span>List my skills</span>${icon('arrow')}<span>Choose a project</span>${icon('arrow')}<span>Build a first version</span></div><p class="guide-control">Here, choosing the project comes before building it. A step is ready once every prerequisite is complete. Use its checkbox to mark it done.</p></li>
      <li><strong>Research the knots.</strong><span>Research unclear steps, test assumptions, and replace them with specific actions.</span><p class="guide-control"><b>In the step editor:</b> choose “A knot to untangle.” Use the Knots filter to find it later. After researching, add smaller steps, connect them, and change its kind to “A step.”</p></li>
      <li><strong>Choose monthly, weekly, then daily actions.</strong><span>Choose first actions for the remaining month, then this week and each day.</span><p class="guide-control"><b>In Week:</b> schedule a card using “Make time for it” in the editor or “Move to” in Week. Today, This week, and This month are planning buckets; moving a card changes its bucket.</p></li>
      <li><strong>Review and adjust.</strong><span>Pick tomorrow’s work each evening. Review weekly, revising your plan as you learn.</span><p class="guide-control"><b>In Notes:</b> record what worked and what needs to change. Reopening a completed prerequisite also reopens steps that depend on it.</p></li>
    </ol>
    <p class="guide-source">Adapted from <a href="https://www.yacinemahdid.com/p/how-to-stop-feeling-lost-in-tech" target="_blank" rel="noopener noreferrer">Yacine Mahdid’s Wafflehouse method ${icon('arrow')}</a>. The chain above is an example; your own plan can concern any part of life.</p>
    <div class="guide-bottom">${icon('lock')} Your plan saves only in this browser. Use Backup → Export backup before changing devices or clearing browser data. Backup → Import backup restores a saved copy.</div>
    <div class="guide-actions"><button class="button primary" data-view="vision">${icon('compass')} Write my vision</button><button class="button secondary" data-view="map">${icon('map')} Open my map</button><button class="button secondary" data-view="week">${icon('week')} Plan this week</button></div>`;
  d.showModal();
}
document.addEventListener('click',e=>{
  if(suppressClick){suppressClick=false;return;}
  if(e.target.closest('[data-action="theme"]')){window.WayfinderTheme.toggle();return;}
  if(e.target.closest('.backup-options button'))$('.backup-menu').open=false;
  const close=e.target.closest('[data-close]');if(close){$('#'+close.dataset.close).close();return;}
  const windowAction=e.target.closest('[data-window-action]')?.dataset.windowAction;
  if(windowAction){
    if(windowAction==='maximize')mapExpanded=!mapExpanded;
    fitQueued=true;render();return;
  }
  const nav=e.target.closest('[data-view]');if(nav){nav.closest('dialog')?.close();view=nav.dataset.view;connecting=null;fitQueued=true;render();return;}
  const filt=e.target.closest('[data-filter]');if(filt){filter=filt.dataset.filter;fitQueued=true;render();return;}
  const completed=e.target.closest('[data-complete]');if(completed){toggleComplete(completed.dataset.complete);return;}
  const source=e.target.closest('[data-connect]');if(source){connecting=connecting===source.dataset.connect?null:source.dataset.connect;render();if(connecting)toast('Now click the step this should lead to.');return;}
  const target=e.target.closest('[data-connect-target]');if(target){if(connecting)connect(connecting,target.dataset.connectTarget);else toast('First click + on the step that needs to happen before this one.');return;}
  const card=e.target.closest('[data-node]');if(card){if(connecting)connect(connecting,card.dataset.node);else editor(card.dataset.node);return;}
  const edit=e.target.closest('[data-edit]');if(edit){editor(edit.dataset.edit);return;}
  const addGoal=e.target.closest('[data-add-goal]');if(addGoal){editor(null,{type:'goal',horizon:Number(addGoal.dataset.addGoal)});return;}
  const addWhen=e.target.closest('[data-add-when]');if(addWhen){editor(null,{when:addWhen.dataset.addWhen});return;}
  const del=e.target.closest('[data-delete]');if(del){const id=del.dataset.delete;$('#editor').close();confirmAction('Remove this step?','Its connections will also be removed. You can undo this change from your map.','Remove step',()=>{snapshot();plan.nodes=plan.nodes.filter(n=>n.id!==id);plan.edges=plan.edges.filter(a=>a.source!==id&&a.target!==id);fitQueued=true;commit();toast('Step removed. There’s room to change direction.');});return;}
  const action=e.target.closest('[data-action]')?.dataset.action;
  if(action==='add')editor(null,{type:plan.nodes.length?'step':'now'});
  if(action==='fit')fitGraph();
  if(action==='zoom-in')zoom(1.2);
  if(action==='zoom-out')zoom(1/1.2);
  if(action==='layout'){snapshot();layoutNodes(plan.nodes,plan.edges);fitQueued=true;commit();}
  if(action==='undo')undo();
  if(action==='help')help();
  if(action==='export')exportPlan();
  if(action==='import')$('#import-file').click();
  if(action==='recovery'&&recovery!==null)downloadBackup(recovery,'wayfinder-original');
  if(action==='load-latest'&&externalPlan!==null){snapshot();plan=externalPlan;externalPlan=null;recovery=null;storageFailed=false;connecting=null;fitQueued=true;document.querySelectorAll('dialog[open]').forEach(d=>d.close());render();toast('Loaded the map from your other tab.');}
  if(action==='keep-current'&&externalPlan!==null)confirmAction('Keep this tab’s map?','This replaces the map saved by your other tab. Export a backup first if you want to keep both versions.','Keep this map',()=>{externalPlan=null;commit();});
  if(action==='example'){
    const load=()=>{snapshot();plan=examplePlan();recovery=null;externalPlan=null;filter='all';fitQueued=true;commit();};
    if(plan.nodes.length||plan.vision||plan.notes||recovery!==null||externalPlan!==null)confirmAction('Open the example map?','This replaces your current map, vision, and notes. Export a backup first if you want to keep them.','Open example',load);else load();
  }
  if(action==='new-map')confirmAction('A fresh page, a new direction.','This replaces the current map, vision, and notes. Export a backup first if you’d like to keep them. You can also undo this during this session.','Start a fresh map',()=>{snapshot();plan=blankPlan();recovery=null;externalPlan=null;mapExpanded=false;view='map';filter='all';fitQueued=true;commit();toast('A fresh page. Start with where you are.');});
});
document.addEventListener('focusin',e=>{
  if(e.target.id==='vision-text'||e.target.id==='notes-text')snapshot();
});
document.addEventListener('input',e=>{
  if(e.target.id==='vision-text'||e.target.id==='notes-text'){const key=e.target.id==='vision-text'?'vision':'notes';plan[key]=e.target.value;save();}
});
document.addEventListener('change',e=>{
  if(e.target.dataset.schedule){snapshot();const n=plan.nodes.find(n=>n.id===e.target.dataset.schedule);n.when=e.target.value;commit();toast('A little time set aside.');}
});
$('#import-file').addEventListener('change',async e=>{
  const file=e.target.files[0];e.target.value='';if(!file)return;if(file.size>5*1024*1024)return toast('That file is too large. Choose a Wayfinder backup under 5 MB.');
  try {const imported=validatePlan(JSON.parse(await file.text()));confirmAction('Bring this map into your workspace?','This replaces your current map, vision, and notes. Export your current plan first if you want to keep it.','Import map',()=>{snapshot();plan=imported;recovery=null;externalPlan=null;connecting=null;view='map';filter='all';fitQueued=true;commit();toast('Your map is here. Pick up where you left off.');});} catch(err){toast(err instanceof SyntaxError?'This isn’t a valid JSON backup. Your current map is unchanged.':err.message);}
});
document.addEventListener('keydown',e=>{
  if(e.key==='Escape'&&connecting){connecting=null;render();toast('Connection cancelled.');}
  if(e.key==='Escape'&&mapExpanded&&!$('dialog[open]')){mapExpanded=false;fitQueued=true;render();}
  if(!(e.target instanceof Element))return;
  if(e.target.matches('input,textarea,select')||$('dialog[open]'))return;
  if((e.ctrlKey||e.metaKey)&&e.key==='z'){e.preventDefault();undo();}
  if(e.target.id==='viewport'&&['ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.key)){e.preventDefault();camera.x+=e.key==='ArrowLeft'?40:e.key==='ArrowRight'?-40:0;camera.y+=e.key==='ArrowUp'?40:e.key==='ArrowDown'?-40:0;updateCamera();}
  const card=e.target.closest('[data-node]');if(card&&e.target===card&&(e.key==='Enter'||e.key===' ')){e.preventDefault();if(connecting)connect(connecting,card.dataset.node);else editor(card.dataset.node);}
});
document.addEventListener('pointerdown',e=>{
  const v=e.target.closest('#viewport');if(!v||e.button!==0||e.target.closest('button,input,select,.canvas-bottom'))return;
  const card=e.target.closest('[data-node]');if(connecting&&card)return;
  pointer={id:card?.dataset.node,startX:e.clientX,startY:e.clientY,lastX:e.clientX,lastY:e.clientY,moved:false};
});
document.addEventListener('pointermove',e=>{
  if(!pointer)return;
  const total=Math.hypot(e.clientX-pointer.startX,e.clientY-pointer.startY);if(!pointer.moved&&total<5)return;
  if(!pointer.moved&&pointer.id)snapshot();pointer.moved=true;
  const dx=e.clientX-pointer.lastX,dy=e.clientY-pointer.lastY;
  if(pointer.id){const n=plan.nodes.find(n=>n.id===pointer.id);n.x=Math.max(-10000000,Math.min(10000000,n.x+dx/camera.z));n.y=Math.max(-10000000,Math.min(10000000,n.y+dy/camera.z));const card=[...document.querySelectorAll('[data-node]')].find(el=>el.dataset.node===n.id);if(card){card.style.left=n.x+'px';card.style.top=n.y+'px';card.classList.add('dragging');}drawEdges();}
  else {camera.x+=dx;camera.y+=dy;updateCamera();}
  pointer.lastX=e.clientX;pointer.lastY=e.clientY;
});
function finishPointer(){if(!pointer)return;if(pointer.moved){suppressClick=true;setTimeout(()=>suppressClick=false,100);if(pointer.id){save();render();}document.querySelector('.dragging')?.classList.remove('dragging');}pointer=null;}
document.addEventListener('pointerup',finishPointer);
document.addEventListener('pointercancel',finishPointer);
window.addEventListener('blur',finishPointer);
window.addEventListener('storage',e=>{
  if((e.key!==KEY&&e.key!==null)||(e.storageArea&&e.storageArea!==browserStorage))return;
  if(e.newValue===JSON.stringify(plan))return;
  try { externalPlan=e.newValue===null?blankPlan():validatePlan(JSON.parse(e.newValue));updateSaveState(); }
  catch { toast('Another tab wrote an unreadable map. Your current map is unchanged.'); }
});
document.addEventListener('wheel',e=>{if(e.target.closest('#viewport')&&(e.ctrlKey||e.metaKey)){e.preventDefault();zoom(e.deltaY>0?.92:1.08);}},{passive:false});
let resizeTimer;window.addEventListener('resize',()=>{clearTimeout(resizeTimer);resizeTimer=setTimeout(fitGraph,100);});
for(const d of document.querySelectorAll('dialog'))d.addEventListener('click',e=>{if(e.target===d){const r=d.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)d.close();}});
render();
if(storageFailed)toast('Browser saving is unavailable. Export a backup before closing this tab.');

window.videoSet = spec => {
  clearTimeout(toastTimer); document.querySelector('#toast').classList.remove('visible');
  plan=validatePlan(spec.plan); view=spec.view; filter='all'; connecting=null; history=[]; fitQueued=false; mapExpanded=false;
  render();
  if(spec.connect) connect('choose','ship');
  if(spec.complete) toggleComplete(spec.complete);
  if(view==='map'){fitGraph();if(spec.camera){camera=spec.camera;updateCamera();}}
};
