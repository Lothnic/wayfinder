import test from 'node:test';
import assert from 'node:assert/strict';
import { canConnect, isReady, blockers, validatePlan, layoutNodes } from '../dist/graph.js';

const n = (id, extra={}) => ({id,title:id,type:'step',notes:'',done:false,when:'none',horizon:1,x:0,y:0,...extra});
const e = (source,target) => ({source,target});
const plan = (nodes,edges=[]) => ({version:1,example:false,vision:'',notes:'',nodes,edges});

test('a diamond DAG allows shared dependencies and rejects a cycle through either branch',()=>{
  const nodes=['start','a','b','goal'].map(id=>n(id));
  const edges=[e('start','a'),e('start','b'),e('a','goal'),e('b','goal')];
  assert.equal(canConnect(nodes,edges,'goal','start'),false);
  assert.equal(canConnect(nodes,edges,'goal','a'),false);
  assert.equal(canConnect(nodes,edges,'a','b'),true);
  assert.equal(canConnect(nodes,edges,'a','a'),false);
  assert.equal(canConnect(nodes,edges,'a','goal'),false);
  assert.equal(canConnect(nodes,edges,'missing','goal'),false);
});
test('ready steps require all prerequisites and exclude completed steps and knots',()=>{
  const nodes=[n('a',{done:true}),n('b'),n('goal'),n('knot',{type:'knot'}),n('now',{type:'now'})];
  const edges=[e('a','goal'),e('b','goal')];
  assert.equal(isReady(nodes[2],nodes,edges),false);
  assert.deepEqual(blockers(nodes[2],nodes,edges).map(x=>x.id),['b']);
  nodes[1].done=true;
  assert.equal(isReady(nodes[2],nodes,edges),true);
  assert.equal(isReady(nodes[0],nodes,edges),false);
  assert.equal(isReady(nodes[3],nodes,edges),false);
  assert.equal(isReady(nodes[4],nodes,edges),false);
  assert.equal(isReady(n('independent'),nodes,edges),true);
});
test('backup import rejects dangling edges, duplicate IDs, cycles, and malformed data',()=>{
  assert.throws(()=>validatePlan(plan([n('a')],[e('a','missing')])));
  assert.throws(()=>validatePlan(plan([n('a'),n('a')])));
  assert.throws(()=>validatePlan(plan([n('')])));
  assert.throws(()=>validatePlan(plan([n('a'),n('b')],[e('a','b'),e('a','b')])));
  assert.throws(()=>validatePlan(plan([n('a'),n('b')],[e('a','b'),e('b','a')])));
  assert.throws(()=>validatePlan(plan([n('a',{x:Infinity})])));
  assert.throws(()=>validatePlan(plan([n('a',{when:'yesterday'})])));
  assert.throws(()=>validatePlan(plan([n('a',{title:'   '})])));
  assert.throws(()=>validatePlan({...plan([]),notes:{}}));
  const valid=plan([n('a'),n('b')],[e('a','b')]);
  assert.equal(validatePlan(valid),valid);
  assert.equal(validatePlan(plan([])).nodes.length,0);
});
test('layout handles unsorted dependencies and keeps connected layers ordered',()=>{
  const nodes=['goal','b','start','a'].map(id=>n(id));
  layoutNodes(nodes,[e('start','a'),e('start','b'),e('a','goal'),e('b','goal')]);
  const byId=Object.fromEntries(nodes.map(n=>[n.id,n]));
  assert.ok(byId.start.x<byId.a.x);
  assert.equal(byId.a.x,byId.b.x);
  assert.notEqual(byId.a.y,byId.b.y);
  assert.ok(byId.goal.x>byId.b.x);
  assert.deepEqual(layoutNodes([],[]),[]);
});

test('a large unsorted map can be laid out and round-tripped as a backup',()=>{
  const nodes=Array.from({length:2000},(_,i)=>n('step-'+i)).reverse();
  const edges=Array.from({length:1999},(_,i)=>e('step-'+i,'step-'+(i+1)));
  layoutNodes(nodes,edges);
  assert.ok(nodes[0].x>nodes[nodes.length-1].x);
  const restored=validatePlan(JSON.parse(JSON.stringify(plan(nodes,edges))));
  assert.equal(restored.nodes.length,2000);
  assert.equal(canConnect(nodes,edges,'step-1999','step-0'),false);
});
