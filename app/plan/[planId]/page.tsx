import { notFound } from "next/navigation";
import { TripResultsPage } from "@/components/trip-results-page";
import { requirePageAccess } from "@/lib/server/access-gate-server";
import { sanitizePlanForClient } from "@/lib/sanitize-plan-response";
import { fetchSchedulePlanRecord } from "@/lib/server/schedule-backend";

export const dynamic = "force-dynamic";

export default async function SchedulePlanPage({ params }: { params: Promise<{ planId: string }> }) {
  const { planId } = await params;
  await requirePageAccess(`/plan/${planId}`);
  const stored = await fetchSchedulePlanRecord(planId);

  if (!stored) {
    notFound();
  }

  return (
    <TripResultsPage
      initialPlan={sanitizePlanForClient(stored)}
      googleMapsApiKey={process.env.GOOGLE_PLACES_API_KEY ?? ""}
      googleMapsMapId={process.env.GOOGLE_MAPS_MAP_ID ?? "DEMO_MAP_ID"}
    />
  );
}
