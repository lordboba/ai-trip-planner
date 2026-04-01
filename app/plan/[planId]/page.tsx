import { notFound } from "next/navigation";
import { SchedulePlanResults } from "@/components/schedule-plan-results";
import { requirePageAccess } from "@/lib/server/access-gate-server";
import { fetchSchedulePlanRecord } from "@/lib/server/schedule-backend";

export const dynamic = "force-dynamic";

export default async function SchedulePlanPage({ params }: { params: Promise<{ planId: string }> }) {
  const { planId } = await params;
  await requirePageAccess(`/plan/${planId}`);
  const stored = await fetchSchedulePlanRecord(planId);

  if (!stored) {
    notFound();
  }

  return <SchedulePlanResults initialPlan={stored} />;
}
