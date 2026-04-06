import type { SchedulePlan } from "../domain/schedule-plans.ts";
import { getPostgres, hasPostgresConfigured } from "./postgres.ts";

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

export async function saveSchedulePlan(plan: SchedulePlan) {
  if (hasPostgresConfigured()) {
    return saveSchedulePlanToDatabase(plan);
  }

  const store = getStore();
  store.set(plan.id, plan);
  return plan;
}

export async function getStoredSchedulePlan(planId: string) {
  if (hasPostgresConfigured()) {
    return getStoredSchedulePlanFromDatabase(planId);
  }

  return getStore().get(planId);
}

async function saveSchedulePlanToDatabase(plan: SchedulePlan) {
  const sql = await getPostgres();

  await sql`
    insert into schedule_plans (id, created_at, updated_at, payload)
    values (${plan.id}::uuid, ${plan.createdAt}::timestamptz, now(), ${sql.json(plan)})
    on conflict (id) do update
    set
      updated_at = now(),
      payload = excluded.payload
  `;

  return plan;
}

async function getStoredSchedulePlanFromDatabase(planId: string) {
  const sql = await getPostgres();
  const rows = await sql<{ payload: SchedulePlan }[]>`
    select payload
    from schedule_plans
    where id = ${planId}::uuid
    limit 1
  `;

  return rows[0]?.payload ?? null;
}
