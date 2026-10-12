#!/usr/bin/env node
// Wayfinder MCP server (stdio).
// Lets a local agent (OpenCode, Claude Code, Cursor, Claude Desktop) read and
// edit the same DAG JSON the Wayfinder site imports/exports.
//
// Zero-install path (visitors): the published package runs via
//   command: ["npx", "-y", "wayfinder-mcp"]
// and keeps its plan in ~/.wayfinder/wayfinder-plan.json. The embedded
// bridge starts automatically so the site can push/pull live.
// Set WAYFINDER_NO_BRIDGE=1 to disable it, WAYFINDER_PLAN to override
// the file, WAYFINDER_BRIDGE_PORT to override the port (default 5179).
//
// Developer path (repo clone): WAYFINDER_PLAN=<repo>/mcp/wayfinder-plan.json node server.js

import { writeFileSync } from 'node:fs';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { validatePlan, canConnect, layoutNodes } from './graph.js';
import { resolvePlanPath } from './paths.js';
import { loadPlan, startBridge } from './bridge.js';

const PLAN_PATH = resolvePlanPath();

function savePlan(plan) {
  const valid = validatePlan(plan);
  writeFileSync(PLAN_PATH, JSON.stringify(valid, null, 2));
  return valid;
}

function summary(plan) {
  const ready = plan.nodes.filter((n) => {
    if (n.done || n.type === 'now' || n.type === 'knot') return false;
    return plan.edges
      .filter((e) => e.target === n.id)
      .every((e) => plan.nodes.find((x) => x.id === e.source)?.done);
  });
  return {
    file: PLAN_PATH,
    nodes: plan.nodes.length,
    edges: plan.edges.length,
    done: plan.nodes.filter((n) => n.done).length,
    knots: plan.nodes.filter((n) => n.type === 'knot' && !n.done).map((n) => ({ id: n.id, title: n.title })),
    ready: ready.slice(0, 20).map((n) => ({ id: n.id, title: n.title })),
  };
}

const TOOLS = [
  {
    name: 'get_summary',
    description: 'Counts, readiness, knots, and file path. Call first to orient.',
    inputSchema: { type: 'object', properties: {} },
  },
  {
    name: 'get_plan',
    description: 'Full plan JSON (nodes, edges, vision, notes). Same schema as site Export backup.',
    inputSchema: { type: 'object', properties: {} },
  },
  {
    name: 'add_node',
    description: 'Add one step/goal/knot. Returns the new node.',
    inputSchema: {
      type: 'object',
      required: ['title'],
      properties: {
        title: { type: 'string', maxLength: 160 },
        type: { type: 'string', enum: ['now', 'step', 'knot', 'goal'] },
        notes: { type: 'string', maxLength: 20000 },
        when: { type: 'string', enum: ['none', 'month', 'week', 'today'] },
        horizon: { type: 'number', enum: [1, 3, 5] },
        prerequisites: { type: 'array', items: { type: 'string' }, description: 'Node ids that must come first' },
      },
    },
  },
  {
    name: 'update_node',
    description: 'Patch title/type/notes/when/horizon of one node by id.',
    inputSchema: {
      type: 'object',
      required: ['id'],
      properties: {
        id: { type: 'string' },
        title: { type: 'string', maxLength: 160 },
        type: { type: 'string', enum: ['now', 'step', 'knot', 'goal'] },
        notes: { type: 'string', maxLength: 20000 },
        when: { type: 'string', enum: ['none', 'month', 'week', 'today'] },
        horizon: { type: 'number', enum: [1, 3, 5] },
      },
    },
  },
  {
    name: 'remove_node',
    description: 'Remove a node and its edges by id.',
    inputSchema: { type: 'object', required: ['id'], properties: { id: { type: 'string' } } },
  },
  {
    name: 'connect',
    description: 'Add a prerequisite edge source -> target. Rejected if it would cycle, duplicate, or self-connect.',
    inputSchema: {
      type: 'object',
      required: ['source', 'target'],
      properties: { source: { type: 'string' }, target: { type: 'string' } },
    },
  },
  {
    name: 'disconnect',
    description: 'Remove edge source -> target.',
    inputSchema: {
      type: 'object',
      required: ['source', 'target'],
      properties: { source: { type: 'string' }, target: { type: 'string' } },
    },
  },
  {
    name: 'complete_node',
    description: 'Mark done (or reopen with done=false). Blocked steps and knots need care: knots cannot complete.',
    inputSchema: {
      type: 'object',
      required: ['id'],
      properties: { id: { type: 'string' }, done: { type: 'boolean' } },
    },
  },
  {
    name: 'set_text',
    description: 'Set the vision or notes free-text field.',
    inputSchema: {
      type: 'object',
      required: ['field', 'text'],
      properties: { field: { type: 'string', enum: ['vision', 'notes'] }, text: { type: 'string', maxLength: 100000 } },
    },
  },
  {
    name: 'replace_plan',
    description: 'Replace the whole plan (e.g. after the user pushes from the site bridge). Validated; cycles rejected.',
    inputSchema: {
      type: 'object',
      required: ['plan'],
      properties: { plan: { type: 'object', description: 'Full version-1 plan JSON' } },
    },
  },
  {
    name: 'layout',
    description: 'Auto-arrange every node by graph depth (same as the site Arrange button). Call after building or importing a fresh map so nothing overlaps.',
    inputSchema: { type: 'object', properties: {} },
  },
];

const server = new Server({ name: 'wayfinder', version: '1.0.0' }, { capabilities: { tools: {} } });

server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: TOOLS }));

server.setRequestHandler(CallToolRequestSchema, async (req) => {
  const { name, arguments: args = {} } = req.params;
  try {
    const plan = loadPlan(PLAN_PATH);
    const text = (obj) => ({ content: [{ type: 'text', text: JSON.stringify(obj, null, 2) }] });

    if (name === 'get_summary') return text({ plan: summary(plan) });
    if (name === 'get_plan') return text(plan);

    if (name === 'add_node') {
      const title = String(args.title || '').trim();
      if (!title) throw new Error('title is required');
      if (plan.nodes.length >= 2000) throw new Error('node limit (2000) reached');
      const id = `n-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
      const parents = (args.prerequisites || []).map(String);
      const node = {
        id,
        title: title.slice(0, 160),
        type: args.type || 'step',
        x: 55, y: 55, notes: String(args.notes || ''),
        done: false, when: args.when || 'none', horizon: args.horizon || 1,
      };
      const nodes = [...plan.nodes, node];
      const edges = [...plan.edges];
      for (const source of parents) {
        if (!canConnect(nodes, edges, source, id)) throw new Error(`cannot connect ${source} -> ${id} (missing, duplicate, or cycle)`);
        edges.push({ source, target: id });
      }
      // Auto-place after parents, like the site editor does.
      if (parents.length) {
        const ps = nodes.filter((n) => parents.includes(n.id));
        node.x = Math.max(...ps.map((p) => p.x)) + 270;
        node.y = ps.reduce((t, p) => t + p.y, 0) / ps.length;
      } else {
        // First free grid slot, so parentless nodes never stack on each other.
        let placed = false;
        for (let row = 0; row < 50 && !placed; row++) {
          for (let col = 0; col < 50 && !placed; col++) {
            const x = 55 + col * 270, y = 55 + row * 184;
            if (!nodes.some((n) => Math.abs(n.x - x) < 235 && Math.abs(n.y - y) < 165)) {
              node.x = x; node.y = y; placed = true;
            }
          }
        }
      }
      return text({ ok: true, node: savePlan({ ...plan, nodes, edges }).nodes.find((n) => n.id === id) });
    }

    if (name === 'update_node') {
      const node = plan.nodes.find((n) => n.id === args.id);
      if (!node) throw new Error(`unknown node ${args.id}`);
      for (const key of ['title', 'type', 'notes', 'when', 'horizon']) {
        if (args[key] !== undefined) node[key] = args[key];
      }
      savePlan(plan);
      return text({ ok: true, node });
    }

    if (name === 'remove_node') {
      const nodes = plan.nodes.filter((n) => n.id !== args.id);
      if (nodes.length === plan.nodes.length) throw new Error(`unknown node ${args.id}`);
      const edges = plan.edges.filter((e) => e.source !== args.id && e.target !== args.id);
      savePlan({ ...plan, nodes, edges });
      return text({ ok: true, removed: args.id });
    }

    if (name === 'connect') {
      if (plan.edges.length >= 10000) throw new Error('edge limit (10000) reached');
      if (!canConnect(plan.nodes, plan.edges, args.source, args.target)) {
        throw new Error('rejected: self-connection, duplicate, missing node, or cycle');
      }
      plan.edges.push({ source: args.source, target: args.target });
      savePlan(plan);
      return text({ ok: true, edge: { source: args.source, target: args.target } });
    }

    if (name === 'disconnect') {
      const before = plan.edges.length;
      plan.edges = plan.edges.filter((e) => !(e.source === args.source && e.target === args.target));
      if (plan.edges.length === before) throw new Error('edge not found');
      savePlan(plan);
      return text({ ok: true });
    }

    if (name === 'complete_node') {
      const node = plan.nodes.find((n) => n.id === args.id);
      if (!node) throw new Error(`unknown node ${args.id}`);
      const done = args.done !== false;
      if (done && node.type === 'knot') throw new Error('knots cannot complete: research it, split it, change kind to step');
      if (done) {
        const waiting = plan.edges.filter((e) => e.target === node.id).map((e) => plan.nodes.find((n) => n.id === e.source)).filter((n) => n && !n.done);
        if (waiting.length) throw new Error(`blocked by: ${waiting.map((w) => w.title).join(', ')}`);
        node.done = true;
      } else {
        // Reopen dependents, mirroring the site.
        const stack = [node.id];
        while (stack.length) {
          const n = plan.nodes.find((x) => x.id === stack.pop());
          if (n) { n.done = false; plan.edges.filter((e) => e.source === n.id).forEach((e) => stack.push(e.target)); }
        }
      }
      savePlan(plan);
      return text({ ok: true, node });
    }

    if (name === 'set_text') {
      if (!['vision', 'notes'].includes(args.field)) throw new Error('field must be vision or notes');
      plan[args.field] = String(args.text || '');
      savePlan(plan);
      return text({ ok: true, field: args.field });
    }

    if (name === 'replace_plan') {
      return text({ ok: true, plan: savePlan(args.plan) });
    }

    if (name === 'layout') {
      layoutNodes(plan.nodes, plan.edges);
      savePlan(plan);
      return text({ ok: true, nodes: plan.nodes.length });
    }

    throw new Error(`unknown tool ${name}`);
  } catch (err) {
    return { content: [{ type: 'text', text: `Error: ${err.message}` }], isError: true };
  }
});

// The site talks to the agent's file through this loopback bridge.
// It starts with the agent host, so visitors never run anything by hand.
if (!process.env.WAYFINDER_NO_BRIDGE) {
  const port = Number(process.env.WAYFINDER_BRIDGE_PORT || 5179);
  startBridge({
    port,
    planPath: PLAN_PATH,
    onError: (err) => console.error(`wayfinder bridge skipped (${err.message}); the site's manual import/export still works.`),
  });
}

await server.connect(new StdioServerTransport());
console.error(`wayfinder MCP ready. plan file: ${PLAN_PATH}`);
