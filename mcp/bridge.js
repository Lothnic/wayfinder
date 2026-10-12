#!/usr/bin/env node
// Wayfinder local bridge: lets the site talk to the same plan file
// the MCP server edits, for live push/pull without manual import/export.
//
// Standalone:  wayfinder-bridge [port]      default 5179, binds 127.0.0.1 only
// Embedded:    the MCP server (server.js) starts this automatically, so
//              visitors never run it by hand.
//
// Endpoints (JSON, CORS + private-network opt-in for the public site):
//   GET  /status  -> { ok, nodes, edges, file }
//   GET  /plan    -> full plan JSON
//   PUT  /plan    -> replace plan (validated, acyclic). Body = plan JSON.
//
// Security: binds loopback only, so only processes on your machine can reach
// it. Never expose this port publicly; it has no auth by design.

import { createServer } from 'node:http';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { validatePlan } from './graph.js';
import { resolvePlanPath } from './paths.js';

function blankPlan() {
  return { version: 1, example: false, vision: '', notes: '', nodes: [], edges: [] };
}

export function loadPlan(planPath) {
  if (!existsSync(planPath)) {
    mkdirSync(dirname(planPath), { recursive: true });
    writeFileSync(planPath, JSON.stringify(blankPlan(), null, 2));
    return blankPlan();
  }
  return validatePlan(JSON.parse(readFileSync(planPath, 'utf8')));
}

function readBody(req) {
  return new Promise((resolveBody, reject) => {
    let chunks = '';
    req.on('data', (c) => {
      chunks += c;
      if (chunks.length > 6 * 1024 * 1024) reject(new Error('body too large (6MB max)'));
    });
    req.on('end', () => resolveBody(chunks));
    req.on('error', reject);
  });
}

export function startBridge({ port = 5179, planPath = resolvePlanPath(), onError = null } = {}) {
  const server = createServer(async (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, PUT, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    // Lets the PUBLIC site reach this visitor's own loopback bridge.
    res.setHeader('Access-Control-Allow-Private-Network', 'true');
    if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return; }
    try {
      if (req.method === 'GET' && (req.url === '/' || req.url === '/status')) {
        const plan = loadPlan(planPath);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: true, nodes: plan.nodes.length, edges: plan.edges.length, file: planPath }));
      } else if (req.method === 'GET' && req.url === '/plan') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(loadPlan(planPath)));
      } else if (req.method === 'PUT' && req.url === '/plan') {
        const plan = validatePlan(JSON.parse(await readBody(req)));
        mkdirSync(dirname(planPath), { recursive: true });
        writeFileSync(planPath, JSON.stringify(plan, null, 2));
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: true, nodes: plan.nodes.length, edges: plan.edges.length }));
      } else {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: false, error: 'use GET /status, GET /plan, PUT /plan' }));
      }
    } catch (err) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: false, error: err.message }));
    }
  });
  server.on('error', (err) => {
    if (onError) onError(err);
    else throw err;
  });
  server.listen(port, '127.0.0.1', () => {
    console.error(`wayfinder bridge on http://127.0.0.1:${port}  (file: ${planPath})`);
  });
  return server;
}

const isMain = process.argv[1] && import.meta.url.endsWith(process.argv[1].split('/').pop());
if (isMain) {
  const port = Number(process.argv[2] || process.env.WAYFINDER_BRIDGE_PORT || 5179);
  startBridge({ port });
}
