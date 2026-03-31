import { NextResponse } from "next/server";
import { fetchTripRecord } from "@/lib/server/trip-backend";

export const maxDuration = 300;

export async function GET(_: Request, { params }: { params: Promise<{ tripId: string }> }) {
  const { tripId } = await params;
  const stored = await fetchTripRecord(tripId);

  if (!stored) {
    return NextResponse.json({ error: "Trip not found" }, { status: 404 });
  }

  return NextResponse.json(stored);
}
