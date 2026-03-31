import { notFound } from "next/navigation";
import { fetchTripRecord } from "@/lib/server/trip-backend";
import { TripResults } from "@/components/trip-results";

export const dynamic = "force-dynamic";

export default async function TripPage({ params }: { params: Promise<{ tripId: string }> }) {
  const { tripId } = await params;
  const stored = await fetchTripRecord(tripId);

  if (!stored) {
    notFound();
  }

  return <TripResults plan={stored.plan} request={stored.request} />;
}
