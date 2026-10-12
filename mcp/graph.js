export function canConnect(nodes, edges, source, target) {
  if (source === target || !nodes.some(n => n.id === source) || !nodes.some(n => n.id === target)) return false;
  if (edges.some(e => e.source === source && e.target === target)) return false;
  const adjacency = new Map();
  for (const edge of edges) {
    if (!adjacency.has(edge.source)) adjacency.set(edge.source, []);
    adjacency.get(edge.source).push(edge.target);
  }
  const seen = new Set();
  const stack = [target];
  while (stack.length) {
    const id = stack.pop();
    if (id === source) return false;
    if (seen.has(id)) continue;
    seen.add(id);
    for (const next of adjacency.get(id) || []) stack.push(next);
  }
  return true;
}

export function isReady(node, nodes, edges) {
  if (node.done || node.type === 'now' || node.type === 'knot') return false;
  return edges.filter(e => e.target === node.id).every(e => nodes.find(n => n.id === e.source)?.done);
}

export function blockers(node, nodes, edges) {
  return edges.filter(e => e.target === node.id).map(e => nodes.find(n => n.id === e.source)).filter(n => n && !n.done);
}

export function validatePlan(value) {
  if (!value || value.version !== 1 || !Array.isArray(value.nodes) || !Array.isArray(value.edges) || value.nodes.length > 2000 || value.edges.length > 10000) throw new Error('Choose a Wayfinder backup file (version 1).');
  const ids = new Set();
  for (const n of value.nodes) {
    if (!n || typeof n.id !== 'string' || !n.id.trim() || n.id.length > 200 || ids.has(n.id) || typeof n.title !== 'string' || !n.title.trim() || n.title.length > 160 || typeof n.notes !== 'string' || n.notes.length > 20000 || !['now','step','knot','goal'].includes(n.type) || !['none','month','week','today'].includes(n.when) || ![1,3,5].includes(n.horizon) || typeof n.done !== 'boolean' || !Number.isFinite(n.x) || !Number.isFinite(n.y) || Math.abs(n.x) > 10000000 || Math.abs(n.y) > 10000000) throw new Error('This backup contains an invalid step. Your current map is unchanged.');
    ids.add(n.id);
  }
  const adjacency = new Map([...ids].map(id => [id, []]));
  const indegree = new Map([...ids].map(id => [id, 0]));
  const connections = new Set();
  for (const e of value.edges) {
    if (!e || typeof e.source !== 'string' || typeof e.target !== 'string' || !ids.has(e.source) || !ids.has(e.target) || e.source === e.target) throw new Error('This backup has an invalid connection. Your current map is unchanged.');
    const key = JSON.stringify([e.source, e.target]);
    if (connections.has(key)) throw new Error('This backup contains a duplicate connection. Your current map is unchanged.');
    connections.add(key);
    adjacency.get(e.source).push(e.target);
    indegree.set(e.target, indegree.get(e.target) + 1);
  }
  const queue = [...ids].filter(id => indegree.get(id) === 0);
  for (let index = 0; index < queue.length; index++) {
    for (const target of adjacency.get(queue[index])) {
      indegree.set(target, indegree.get(target) - 1);
      if (indegree.get(target) === 0) queue.push(target);
    }
  }
  if (queue.length !== ids.size) throw new Error('This backup contains a cycle. Your current map is unchanged.');
  if (typeof value.vision !== 'string' || value.vision.length > 100000 || typeof value.notes !== 'string' || value.notes.length > 100000 || typeof value.example !== 'boolean') throw new Error('This backup has invalid notes. Your current map is unchanged.');
  return value;
}

export function layoutNodes(nodes, edges) {
  const depths = new Map(nodes.map(n => [n.id, 0]));
  const indegree = new Map(nodes.map(n => [n.id, 0]));
  const adjacency = new Map(nodes.map(n => [n.id, []]));
  for (const {source, target} of edges) {
    if (!adjacency.has(source) || !adjacency.has(target)) continue;
    adjacency.get(source).push(target);
    indegree.set(target, indegree.get(target) + 1);
  }
  const queue = nodes.filter(n => indegree.get(n.id) === 0).map(n => n.id);
  for (let index = 0; index < queue.length; index++) {
    const id = queue[index];
    for (const target of adjacency.get(id)) {
      depths.set(target, Math.max(depths.get(target), depths.get(id) + 1));
      indegree.set(target, indegree.get(target) - 1);
      if (indegree.get(target) === 0) queue.push(target);
    }
  }
  const rows = new Map();
  for (const n of nodes) {
    const depth = depths.get(n.id) || 0;
    if (!rows.has(depth)) rows.set(depth, []);
    rows.get(depth).push(n);
  }
  const maxRows = Math.max(1, ...[...rows.values()].map(r => r.length));
  for (const [depth, row] of rows) row.forEach((n, i) => { n.x = 55 + depth * 270; n.y = 60 + (maxRows - row.length) * 92 + i * 184; });
  return nodes;
}
