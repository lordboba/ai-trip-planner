import { NextResponse } from "next/server";
import { createTrip } from "@/backend/src/services/trip-service";
import type { TripRequest } from "@/lib/types";

export async function POST(request: Request) {
  const body = (await request.json()) as TripRequest;
  const stored = createTrip(body);

  return NextResponse.json({ tripId: stored.id });
}
