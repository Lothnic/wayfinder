// Shared plan-file location. No clone required: visitors who install via
// npx get a per-user file under their home directory. WAYFINDER_PLAN
// overrides everything (used by developers running from a repo clone).
import { homedir } from 'node:os';
import { join } from 'node:path';

export function resolvePlanPath() {
  if (process.env.WAYFINDER_PLAN) return process.env.WAYFINDER_PLAN;
  return join(homedir(), '.wayfinder', 'wayfinder-plan.json');
}
