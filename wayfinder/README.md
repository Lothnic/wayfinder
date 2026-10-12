# Wayfinder

A personal DAG maker inspired by [Yacine Mahdid’s Wafflehouse method](https://www.yacinemahdid.com/p/how-to-stop-feeling-lost-in-tech).

Write a future you would feel proud of, work backward through 5-, 3-, and 1-year goals, and connect the small steps that get you there.

The frontend adapts the workspace’s `SKILL.md` and `DESIGN.md` into a minimal Y2K Blue layout: a faint grid, white panels, subtle pink accents, pixel headings, Nunito body text, and Lucide icons. Four tabs keep the map, vision, schedule, and notes together. Expand the map for more space; press Escape to restore it.

Use the moon/sun button beside Backup to switch between light and dark mode. The preference is remembered in this browser separately from your plan, and updates across open tabs. New visitors start in light mode.

## Run locally

Requires Python 3 and Node.js 24 for the npm scripts and tests. The app itself uses plain HTML, CSS, and JavaScript with no runtime dependencies or compilation step.

```sh
npm run dev
```

Open http://127.0.0.1:5173. Use an HTTP server rather than opening the HTML file directly, because the app uses JavaScript modules.

Click **How to use** beside the map introduction (also available under Backup) for a practical guide adapted from the linked Wafflehouse method. It explains the planning sequence, prerequisite arrows, knots, scheduling, and reviews, with buttons to open the relevant workspace.

## Use the workspace

- **My life map:** drag steps to arrange them; drag the background to pan. Use the zoom buttons, or Ctrl/Command + mouse wheel. Keyboard users can focus the map and use arrow keys to pan. Select a card to edit it.
- **Connections:** click the plus on a card’s right edge, then the next card. The first step becomes a prerequisite for the next. The editor also provides prerequisite checkboxes. Cycles, self-connections, and duplicate edges are prevented.
- **Readiness:** a step is ready when all its prerequisites are complete. Completing a blocked step is prevented. Reopening a step also reopens its dependent steps.
- **Knots:** mark unclear steps as knots. Research and split them into concrete actions, then change the kind to “A step.”
- **My vision:** reflect freely and add goals at 5-, 3-, and 1-year horizons. Goals also appear on the map and can be connected.
- **This week:** schedule steps for today, this week, or this month. Dependencies still determine whether they are ready.
- **Field notes:** keep discoveries and weekly reflections.
- **Backups:** use the Backup menu to import/export JSON. Imports are checked for valid data and an acyclic graph before replacement, and require confirmation.
- **Undo:** use the map’s undo button or Ctrl/Command + Z outside text fields. Up to 40 edits are kept during the current session.

New visitors start with a blank map. **Try an example** opens a labeled sample for exploring the editor. **Start a fresh map** clears the current plan after confirmation. It can be undone during the current session.

## AI agents (no-install connector)

Backup → **Connect an agent** pairs the site with a locally-running agent — no install: visitors paste one snippet into their agent config and the agent fetches the connector itself. Push sends this browser's map to the agent; Pull loads the agent's version (undoable). Setup, publishing, and the MCP mental model are in [mcp/README.md](../mcp/README.md). Without an agent, Export/Import moves the same JSON manually.

## Storage

Plans save automatically to `localStorage` in the current browser under `wayfinder.plan.v1`. There is no server database, account-based data sync, analytics, or AI service. The app’s optional Google Fonts request contains no plan content. Export backups before changing devices, clearing browser data, or using private browsing.

The hosting URL and the local development URL have separate storage. Move plans between them using export/import. If browser storage becomes unavailable, a persistent notice asks you to export your work. Unreadable saved data is retained for download until you explicitly replace it. Changes from another tab pause autosaving until you choose which version to keep.

## Checks

```sh
npm run check
npm test
```

The tests cover cycle prevention, shared prerequisites, readiness, malformed backups, a 2,000-node layout, browser saving failures, and saved-data recovery. Editing, scheduling, backups, reset, undo, map expansion, and conflicting changes across tabs were also exercised through a DOM integration check. Browser rendering could not be verified in the build environment because browser/socket access was blocked.

## Hosting

Deploy from the parent workspace directory using `npm run deploy` with an authenticated Vercel CLI. The root `vercel.json` publishes `wayfinder/dist`, runs syntax and regression checks, and applies security headers. No server, account system, database, or environment variables are needed. Any static host can also serve this directory’s `dist/` assets.

Functional icons are vendored from Lucide; their ISC/MIT notices are in `dist/LUCIDE-LICENSE.txt`.
