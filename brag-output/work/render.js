// Frame renderer: pure function of t (seconds). Exposes window.RENDER().
// Reuses Wayfinder's real stylesheet; rebuilds window chrome per DESIGN.md
// (the app's minimal Y2K adaptation is lighter than the OS-desktop spec, so
// the launch video dresses the app's real copy in the full window chrome).

const t0 = performance.now();
let T = 0;

const clamp01 = x => Math.min(1, Math.max(0, x));
const ease = x => 1 - Math.pow(1 - clamp01(x), 3); // cubic out
const easeBack = x => {
  x = clamp01(x);
  const c = 1.70158 + 1;
  return 1 + (c + 1) * Math.pow(x - 1, 3) + c * Math.pow(x - 1, 2); // cubic in-out backish
};
const lerp = (a, b, x) => a + (b - a) * x;

const SCENES = [
  { id: 'hook',     start: 0.0, end: 2.5 },
  { id: 'reveal',   start: 2.5, end: 5.5 },
  { id: 'work',     start: 5.5, end: 14.0 },
  { id: 'punch',    start: 14.0, end: 17.0 },
  { id: 'endcard',  start: 17.0, end: 20.0 },
];

function scene(t) {
  return SCENES.find(s => t >= s.start && t < s.end) || SCENES[SCENES.length - 1];
}
function local(t, s, a, b) { // 0..1 progress of [a,b] inside scene s
  return clamp01((t - (s.start + a)) / (b - a));
}

// ---- shared pixels -------------------------------------------------------
function gridBG(alpha) {
  return `<div style="position:absolute;inset:0;background:#FF85C2;
    background-image:linear-gradient(rgba(255,255,255,.14) 1px,transparent 1px),
    linear-gradient(90deg,rgba(255,255,255,.14) 1px,transparent 1px);
    background-size:32px 32px;opacity:${alpha}"></div>`;
}

function sparkle(x, y, size, rot, color = '#FF3D9A') {
  return `<svg style="position:absolute;left:${x}px;top:${y}px;width:${size}px;height:${size}px;
    transform:rotate(${rot}deg)" viewBox="0 0 28 28">
    <rect x="12.5" y="1" width="3" height="26" fill="${color}"/>
    <rect x="1" y="12.5" width="26" height="3" fill="${color}"/></svg>`;
}

function windowFrame({ x, y, w, h, title, body, scale = 1, shadow = 4, controls = true }) {
  return `<div style="position:absolute;left:${x}px;top:${y}px;width:${w}px;height:${h}px;
    transform:scale(${scale});transform-origin:0 0;background:#FFF5DC;
    border:2px solid #1A0A2E;box-shadow:${shadow}px ${shadow}px 0 #1A0A2E">
    <div style="display:flex;align-items:center;height:32px;padding:0 10px;background:#FFD84D;
      border-bottom:2px solid #1A0A2E;position:relative;overflow:hidden">
      <span style="font:400 10px 'Press Start 2P';color:#1A0A2E;letter-spacing:.5px">${title}</span>
      <span style="position:absolute;inset:0;background:repeating-linear-gradient(0deg,rgba(255,255,255,.06) 0 1px,transparent 1px 3px);pointer-events:none"></span>
      ${controls ? `<span style="margin-left:auto;display:flex;gap:5px">
        <i style="width:12px;height:12px;background:#FF5B5B;border:1px solid #1A0A2E"></i>
        <i style="width:12px;height:12px;background:#FFD84D;border:1px solid #1A0A2E"></i>
        <i style="width:12px;height:12px;background:#59D98F;border:1px solid #1A0A2E"></i>
      </span>` : ''}
    </div>
    <div style="padding:16px;height:calc(100% - 32px);box-sizing:border-box;position:relative">${body}</div>
  </div>`;
}

function pixelText(text, size, color = '#1A0A2E', lh = 1.6) {
  return `<span style="font:400 ${size}px 'Press Start 2P';line-height:${lh};color:${color};display:block">${text}</span>`;
}

// ---- scene 1: hook ------------------------------------------------------
function hook(t) {
  const s = SCENES[0];
  const inP = ease(local(t, s, 0.15, 0.6));
  const outP = local(t, s, 2.15, 2.5);
  const y = lerp(40, 470, inP);
  return gridBG(1) + `
  <div style="position:absolute;left:120px;top:${y}px;width:1680px;opacity:${1 - outP}">
    ${pixelText('THE MOST MODERN APP OF 2026', 44, '#1A0A2E')}
    <div style="height:18px"></div>
    ${pixelText('RUNS ON&nbsp;&nbsp;WINDOWS&nbsp;98&nbsp;STYLE.', 44, '#FF3D9A')}
  </div>
  ${sparkle(1520, 130 + Math.sin(t * 4) * 8, 26, 45 * t)}
  ${sparkle(260, 720, 18, -30 * t, '#C8A0FF')}`;
}

// ---- scene 2: reveal (real app copy, Y2K window dressing) ----------------
function reveal(t) {
  const s = SCENES[1];
  const winP = easeBack(local(t, s, 0, 0.45));
  const textP = local(t, s, 0.35, 0.8);
  const outP = local(t, s, 2.9, 3.0);
  const sc = lerp(0.92, 1, winP);

  const body = `
    <div style="opacity:${textP}">
      <span class="eyebrow" style="font:700 11px Nunito;letter-spacing:1.2px;color:#6B4C6B">WAYFINDER · YOUR LIFE, MAPPED</span>
      <div style="margin-top:14px">${pixelText('YOUR LIFE MAP.', 40)}</div>
      <p style="margin-top:16px;font:700 20px Nunito;color:#1A0A2E">Work backward from a future you'd feel proud of.</p>
      <p style="margin-top:10px;font:600 16px Nunito;color:#6B4C6B">Write the vision. Set 5-, 3- and 1-year goals.<br>Connect the small steps in between — with prerequisite arrows.</p>
      <div style="margin-top:18px;display:flex;gap:12px;align-items:center">
        <span style="display:inline-block;background:#FFD84D;border:2px solid #1A0A2E;box-shadow:3px 3px 0 #1A0A2E;padding:10px 16px;font:400 9px 'Press Start 2P';color:#1A0A2E">NO SIGNUP · NO SERVER · JUST A MAP</span>
      </div>
    </div>`;
  return gridBG(1) + `
    ${sparkle(1700, 200, 24, 20 * t)}
    ${sparkle(150, 830, 18, -15 * t, '#C8A0FF')}
    ${windowFrame({ x: 160, y: 200, w: 1600, h: 620, title: 'wayfinder.exe — your life, mapped', scale: sc, body })}
    <div style="position:absolute;left:0;right:0;bottom:0;height:44px;background:#FFD84D;border-top:2px solid #1A0A2E;
      display:flex;align-items:center;padding:0 18px;gap:0;${outP ? `transform:translateY(${outP * 46}px)` : ''}">
      <span style="font:400 9px 'Press Start 2P';color:#1A0A2E">START</span>
      <span style="margin-left:24px;font:600 13px Nunito;color:#1A0A2E">wayfinder-life-map.vercel.app — free, no signup, plans stay in your browser</span>
      <span style="margin-left:auto;font:400 9px 'Press Start 2P';color:#1A0A2E">${new Date(2001, 0, 1).toLocaleTimeString('en-US', { hour12: false })}</span>
    </div>`;
}

// ---- scenes 3-4: the map assembles (real example-plan copy) --------------
const NODES = [
  { id: 'now',    title: 'This is where I am',            kind: 'now',  x: 40,  y: 230 },  // 222x146 cards, per app layout
  { id: 'choose', title: 'Choose one meaningful project', kind: 'step', x: 310, y: 46,  when: 'Today' },
  { id: 'money',  title: 'Understand my monthly spending',kind: 'step', x: 310, y: 230, when: 'This week' },
  { id: 'room',   title: 'Make room for myself',          kind: 'step', x: 310, y: 414, when: 'This week' },
  { id: 'ship',   title: 'Share a first, small version',  kind: 'step', x: 580, y: 46,  when: 'This month' },
  { id: 'buffer', title: 'Build a financial buffer',      kind: 'knot', x: 580, y: 230 },
  { id: 'routine',title: 'Find a rhythm I can sustain',   kind: 'step', x: 580, y: 414, when: 'This month' },
  { id: 'year',   title: 'Build a life that feels like mine', kind: 'goal', x: 850, y: 230 },
];
const EDGES = [['now','choose'],['now','money'],['now','room'],['choose','ship'],['money','buffer'],['room','routine'],['ship','year'],['buffer','year'],['routine','year']];

const KIND_LABEL = { now: 'Where I am now', step: 'A little step', knot: 'Knot to untangle', goal: '1-year goal' };
const KIND_ICON = {
  now:   '<path d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20Z M16 8l-4 4-4 4 M12 12l4 4"/>',
  step:  '<path d="M7 13V5a1 1 0 0 1 1-1h8a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1H8a1 1 0 0 1-1-1v-2"/>',
  knot:  '<path d="M8 3a4 4 0 0 0-4 4c0 2 1 3 3 3s3-1 3-3a3 3 0 1 1 3 3c-2 0-3 1-3 3v5"/>',
  goal:  '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1"/>',
};

// timeline inside the work scene (8.5s)
const APPEAR = { now: 0.0, choose: 0.9, money: 1.3, room: 1.7, buffer: 2.4, ship: 2.8, routine: 3.2, year: 4.0 };
const ARROWS = [[0.5,'now','choose'],[0.65,'now','money'],[0.8,'now','room'],[2.1,'choose','ship'],[2.5,'money','buffer'],[2.9,'room','routine'],[3.6,'ship','year'],[3.9,'buffer','year'],[4.2,'routine','year']];
const DONE_AT = 6.2; // completing "This is where I am"
const TOAST_AT = 6.5;

function nodeCard(n, t, done) {
  const ap = APPEAR[n.id];
  if (ap === undefined) return '';
  const p = easeBack(clamp01((t - ap) / 0.5));
  if (p <= 0) return '';
  const kindColor = { now: '#FFD84D', step: '#FFF5DC', knot: '#C8A0FF', goal: '#B8F5D8' }[n.kind];
  return `<article style="position:absolute;left:${n.x}px;top:${n.y}px;width:222px;height:146px;
    background:#fff;border:2px solid #1A0A2E;box-shadow:3px 3px 0 #1A0A2E;box-sizing:border-box;
    transform:scale(${lerp(0.7, 1, p)});transform-origin:50% 50%;opacity:${clamp01(p * 2)}">
    <div style="margin:-10px -2px 0;background:#edf8fe;border-bottom:2px solid #1A0A2E;padding:5px 8px;
      display:flex;align-items:center;gap:5px">
      <svg class="icon" viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="#1A0A2E" stroke-width="1.6">${KIND_ICON[n.kind]}</svg>
      <span style="font:400 15px VT323;line-height:1.1;color:#1A0A2E">${KIND_LABEL[n.kind]}</span>
      <i style="margin-left:auto;width:16px;height:16px;border:1px solid #1A0A2E;background:${done ? '#B8F5D8' : '#fff'};display:inline-flex;align-items:center;justify-content:center">${done ? '<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#1A0A2E" stroke-width="2.5"><path d="M4 12l5 5L20 7"/></svg>' : ''}</i>
    </div>
    <h3 style="font:700 15px Nunito;color:#1A0A2E;line-height:1.35;padding:9px 10px 0;margin:0">${n.title}</h3>
    <div style="position:absolute;left:10px;right:10px;bottom:9px;display:flex;justify-content:space-between;align-items:center">
      <span style="font:600 10px Nunito;color:#67758b;letter-spacing:.4px;display:flex;gap:5px;align-items:center">
        <i style="width:7px;height:7px;border-radius:50%;background:${done ? '#5a8b73' : n.kind === 'knot' ? '#C8A0FF' : '#879db0'}"></i>
        ${done ? 'Complete' : n.kind === 'knot' ? 'Needs a closer look' : n.kind === 'goal' ? 'My north star' : 'Ready to begin'}
      </span>
      ${n.when && !done ? `<span style="font:600 10px Nunito;color:#3985ae">${n.when}</span>` : ''}
    </div>
  </article>`;
}

// dashed prerequisite curve, draw-on progress p (0..1)
function arrow(t, a, b, p) {
  const A = NODES.find(n => n.id === a), B = NODES.find(n => n.id === b);
  if (p <= 0) return '';
  const x1 = A.x + 222, y1 = A.y + 73, x2 = B.x - 7, y2 = B.y + 73;
  const bend = Math.max(45, Math.abs(x2 - x1) * 0.5);
  const d = `M${x1} ${y1} C${x1 + bend} ${y1},${x2 - bend} ${y2},${x2} ${y2}`;
  const total = 400;
  const shown = total * ease(p);
  const done = (t > DONE_AT && a === 'now');
  return `<path d="${d}" fill="none" stroke="${done ? '#5a8b73' : '#1A2A4A'}"
    stroke-width="2" stroke-dasharray="${shown} ${total}" marker-end="${p > 0.9 ? 'url(#ah)' : ''}"/>`;
}

function work(t) {
  const s = SCENES[2];
  const inP = local(t, s, 0, 0.4);
  const toast = t - s.start > TOAST_AT && (t - s.start) < TOAST_AT + 1.6;

  const edgesSVG = EDGES.map((e, i) => {
    const st = ARROWS[i][0];
    const p = clamp01((t - s.start - st) / 0.5);
    return arrow(t - s.start, e[0], e[1], p);
  }).join('');

  const cards = NODES.map(n => nodeCard(n, t - s.start, (t - s.start) > DONE_AT && n.kind === 'now'));

  const mapBody = `
    <svg style="position:absolute;left:0;top:0;width:1260px;height:700px;overflow:visible" viewBox="0 0 1260 700">
      <defs><marker id="ah" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto">
        <path d="M1 1l5 3-5 3" fill="none" stroke="#1A2A4A" stroke-width="1.5"/></marker></defs>
    </svg>
    <svg style="position:absolute;left:0;top:0;width:1260px;height:700px;overflow:visible" viewBox="0 0 1260 700">${edgesSVG}</svg>
    ${cards.join('')}`;

  const curX = lerp(120, 200, Math.sin((t - s.start) * 1.5) * 0.5 + 0.5);
  const curY = lerp(500, 700, (t - s.start) * 0.08 % 1);

  return gridBG(1) + `
  ${windowFrame({ x: 90, y: 110, w: 1740, h: 770, title: 'my-life.dag — your path, step by step',
    body: `<div style="position:absolute;left:16px;top:16px;width:1260px;height:700px">${mapBody}</div>
           <div style="position:absolute;right:24px;top:24px;width:400px">${pixelText('THE WHOLE PICTURE, WORKING BACKWARD', 15, '#1A0A2E')}</div>` })}
  <div style="position:absolute;left:112px;top:920px;opacity:${inP}">
    <span style="font:700 17px Nunito;color:#1A0A2E">A step is ready when all its prerequisites are complete. Blocked steps stay put.</span>
  </div>
  ${toast ? `<div style="position:absolute;left:50%;top:965px;transform:translateX(-50%);
    background:#FFF5DC;border:2px solid #1A0A2E;box-shadow:4px 4px 0 #1A0A2E;padding:10px 16px">
    <span style="font:400 10px 'Press Start 2P';color:#1A0A2E">A LITTLE FURTHER ALONG ✔</span></div>` : ''}
  <svg style="position:absolute;left:${curX + 800}px;top:${curY}px" width="26" height="26" viewBox="0 0 24 24">
    <path d="M4 2l14 12-6 1 3 6-2 1-3-6-4 4z" fill="#fff" stroke="#1A0A2E" stroke-width="1.5"/>
  </svg>`;
}

// ---- scene 5: punchline -------------------------------------------------
function punch(t) {
  const s = SCENES[3];
  const p = ease(local(t, s, 0.2, 0.8));
  const out = local(t, s, 2.7, 3.0);
  return `<div style="position:absolute;inset:0;background:#1A0A2E;opacity:${Math.min(1, local(t, s, 0, 0.25))}"></div>
  <div style="position:absolute;left:0;right:0;top:420px;text-align:center;opacity:${p};transform:translateY(${(1 - p) * 20}px)">
    ${pixelText('BECAUSE IT HAS NO SERVERS TO BETRAY YOU.', 38, '#FFD84D')}
    <div style="margin-top:26px;opacity:${p}">
      <span style="font:700 18px Nunito;color:#FF85C2">Your life, as a directed graph. Locally, forever.</span>
    </div>
  </div>
  ${sparkle(300 + p * 40, 300, 20, t * 30, '#FF3D9A')}`;
}

// ---- scene 6: endcard ---------------------------------------------------
function endcard(t) {
  const s = SCENES[4];
  const p = ease(local(t, s, 0, 0.5));
  const urlP = local(t, s, 0.6, 1.1);
  const body = `
    <div style="display:flex;align-items:center;gap:12px;margin-bottom:14px">
      ${pixelText('SAVE YOUR MAP AS', 13)}
      <span style="flex:1;border:2px solid #1A0A2E;background:#fff;padding:9px 10px;font:400 15px VT323;color:#1A0A2E">my-life.dag</span>
    </div>
    <div style="display:flex;gap:10px;justify-content:flex-end">
      <span style="border:2px solid #1A0A2E;background:#FFF5DC;padding:7px 12px;font:400 8px 'Press Start 2P'">CANCEL</span>
      <span style="border:2px solid #1A0A2E;background:#FFD84D;box-shadow:3px 3px 0 #1A0A2E;padding:7px 12px;font:400 8px 'Press Start 2P'">SAVE</span>
    </div>`;
  return gridBG(1) + `
  ${sparkle(1660, 150 + Math.sin(t * 3) * 6, 24, 25 * t)}
  ${sparkle(220, 700, 16, -20 * t, '#C8A0FF')}
  ${windowFrame({ x: 460, y: 330, w: 1000, h: 330, title: 'wayfinder — save as life. diagrams', scale: p, body })}
  <div style="position:absolute;left:0;right:0;top:780px;text-align:center;opacity:${urlP}">
    ${pixelText('WAYFINDER-LIFE-MAP.VERCEL.APP', 26, '#1A0A2E')}
    <div style="margin-top:14px"><span style="font:700 16px Nunito;color:#6B4C6B">Free · no signup · your plans stay in your browser</span></div>
  </div>`;
}

// ---- master ------------------------------------------------------------
const RENDERERS = { hook, reveal, work, punch, endcard };

window.RENDER = function (t) {
  T = t;
  const s = scene(t);
  let html = RENDERERS[s.id](t);

  // horizontal scanline shimmer over everything (subtle, CRT feel)
  html += `<div style="position:absolute;inset:0;pointer-events:none;
    background:repeating-linear-gradient(0deg,rgba(0,0,0,.035) 0 1px,transparent 1px 3px)"></div>`;

  const el = document.getElementById('stage');
  if (el) el.innerHTML = html;
};

window.READY = true;
