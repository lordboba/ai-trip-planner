import { notFound } from "next/navigation";
import { TripResultsPage } from "@/components/trip-results-page";
import { resolveTimelineEventMapPins } from "@/backend/src/services/google-places";
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

  const resolvedEventPins = await resolveTimelineEventMapPins({
    events: stored.timeline.filter((event) => event.locked),
    fallbackCity: stored.tripContext.cityInference.city ?? stored.request.importedSchedule.cityInference.city,
  });

  return (
    <TripResultsPage
      initialPlan={sanitizePlanForClient(stored)}
      googleMapsApiKey={process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? ""}
      googleMapsMapId={process.env.GOOGLE_MAPS_MAP_ID ?? "DEMO_MAP_ID"}
      resolvedEventPins={resolvedEventPins}
    />
  );
}
