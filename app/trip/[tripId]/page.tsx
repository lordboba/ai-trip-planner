import { notFound } from "next/navigation";
import { getStoredTrip } from "@/lib/trip-store";
import { TripResults } from "@/components/trip-results";

export const dynamic = "force-dynamic";

export default async function TripPage({ params }: { params: Promise<{ tripId: string }> }) {
  const { tripId } = await params;
  const stored = getStoredTrip(tripId);

  if (!stored) {
    notFound();
  }

  return <TripResults plan={stored.plan} request={stored.request} />;
}
