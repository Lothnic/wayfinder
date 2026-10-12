import { validatePlan } from './graph.js';

export const PLAN_KEY = 'wayfinder.plan.v1';

export function blankPlan() {
  return { version: 1, example: false, vision: '', notes: '', nodes: [], edges: [] };
}

export function readSavedPlan(storage) {
  let raw;
  try {
    raw = storage.getItem(PLAN_KEY);
  } catch {
    return { plan: blankPlan(), issue: 'unavailable', recovery: null };
  }
  if (raw === null) return { plan: blankPlan(), issue: null, recovery: null };
  try {
    return { plan: validatePlan(JSON.parse(raw)), issue: null, recovery: null };
  } catch {
    // Keep the original bytes available for download. Never silently replace them.
    return { plan: blankPlan(), issue: 'corrupt', recovery: raw };
  }
}

export function persistPlan(storage, plan) {
  try {
    storage.setItem(PLAN_KEY, JSON.stringify(plan));
    return true;
  } catch {
    return false;
  }
}
