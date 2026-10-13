# wayfinder-mcp — no-install agent connector for Wayfinder

Visitors to the Wayfinder site paste **one snippet** into their agent config.
No clone, no terminal, no account. The agent downloads this package with
`npx`, starts its own MCP server **and** its own loopback bridge, and the
site's Backup → Connect an agent dialog pushes/pulls the visitor's map.

## For visitors (nothing to install)

1. Open the site, go to **Backup → Connect an agent**, copy the snippet for
   your agent (OpenCode uses `opencode.json`; Claude Code uses `.mcp.json`;
   Cursor / Claude Desktop use their `mcpServers` config).
2. Restart the agent. The status in the dialog flips green by itself.
3. **Push to agent**, then describe what you want in plain words
   (*"break my knot 'Find clients' into 3 concrete steps and connect them"*).
4. **Pull from agent** to load the result (undoable with Ctrl/Command + Z).

Needs Node.js on the visitor's machine — agent hosts (OpenCode, Claude Code,
Cursor, Claude Desktop) already bring it. Data never leaves the machine:
the plan lives in `~/.wayfinder/wayfinder-plan.json`, the bridge binds
`127.0.0.1` only.

## The 30-second mental model (learning MCP)

- **MCP = Model Context Protocol.** An open standard for plugging tools/data
  into an AI agent. Three roles: **host** (your agent app), **client** (the
  connection inside it), **server** (this package, exposing tools).
- **Transport is stdio**: the agent launches `npx -y wayfinder-mcp` and talks
  JSON-RPC over stdin/stdout. No network, no auth dance.
- **Tools** are named functions with a JSON schema: `get_summary`,
  `get_plan`, `add_node`, `update_node`, `remove_node`, `connect`,
  `disconnect`, `complete_node`, `set_text`, `replace_plan`, `layout`.
  New nodes are auto-placed (after their prerequisites, nudged until free,
  so siblings never stack), and `layout` arranges the whole map by depth —
  agents should call it after building a fresh map.
- **Validation is shared** with the site: `graph.js` is a byte-identical copy
  of `wayfinder/dist/graph.js` (enforced by `npm run check`), so agent edits
  obey the same rules as the UI (version 1, ≤2000 nodes, ≤10000 edges,
  acyclic, no self/duplicate edges).
- **The bridge** (`bridge.js`) is *not* MCP — it is a tiny localhost HTTP
  server so the site (which cannot speak stdio) can push/pull the same plan
  file. It starts automatically inside the MCP server process
  (`WAYFINDER_NO_BRIDGE=1` disables it). It answers Chrome's private-network
  preflight so the **deployed site** can reach each visitor's own bridge.

## For the site owner: releasing a new version

Releases are manual (two commands, ~2 minutes). From `mcp/`:

1. Bump `version` in `mcp/package.json`.
2. Create a short-lived granular token: npmjs.com → Access Tokens → Generate New Token → Granular, scoped to `wayfinder-mcp`, Read + Write.
3. `npm config set //registry.npmjs.org/:_authToken 'paste-token-here' && npm publish --access public`
4. Revoke the token on the website and clear it locally: `npm config delete //registry.npmjs.org/:_authToken`

(Browser `npm login` tokens cannot publish — always use a granular token.)

## For developers (repo clone)

```sh
npm run mcp:install   # once: installs @modelcontextprotocol/sdk in mcp/
npm run bridge        # standalone bridge on http://127.0.0.1:5179
npm run mcp           # MCP server on stdio (bridge embedded)
npm run dev           # the site on http://127.0.0.1:5173
```

`WAYFINDER_PLAN=/path/to/plan.json` overrides the plan file (both server and
bridge honor it). `graph.js` here must stay identical to
`../wayfinder/dist/graph.js` — edit the original, copy it over, run
`npm --prefix mcp run check`.

Manual fallback (no agent): site Export → save JSON → agent edits the file →
site Import. Same schema throughout.

## Troubleshooting

- **Dialog never flips green?** The agent must be restarted after pasting the
  snippet; `npx` needs network once to download the package. If the browser
  asks about local-network access, allow it.
- **Agent says unknown tool?** Restart the agent; check the snippet pasted
  cleanly (no smart quotes).
- **Cycle/duplicate rejected?** Validation working as intended — ask the agent
  for a different prerequisite.
- **Port 5179 busy?** The server logs a warning and MCP tools still work; the
  standalone bridge (`npm run bridge`) covers the site in that case.
