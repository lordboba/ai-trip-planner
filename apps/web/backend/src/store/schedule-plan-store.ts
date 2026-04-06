import type { SchedulePlan } from "../domain/schedule-plans.ts";

type GlobalStore = typeof globalThis & {
  __atlasSchedulePlans__?: Map<string, SchedulePlan>;
};

function getStore() {
  const globalStore = globalThis as GlobalStore;

  if (!globalStore.__atlasSchedulePlans__) {
    globalStore.__atlasSchedulePlans__ = new Map<string, SchedulePlan>();
  }

  return globalStore.__atlasSchedulePlans__;
}

export function saveSchedulePlan(plan: SchedulePlan) {
  const store = getStore();
  store.set(plan.id, plan);
  return plan;
}

export function getStoredSchedulePlan(planId: string) {
  return getStore().get(planId);
}
