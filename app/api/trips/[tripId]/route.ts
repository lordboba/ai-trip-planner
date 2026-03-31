import { NextResponse } from "next/server";
import { getTripById } from "@/backend/src/services/trip-service";

export async function GET(_: Request, { params }: { params: Promise<{ tripId: string }> }) {
  const { tripId } = await params;
  const stored = getTripById(tripId);

  if (!stored) {
    return NextResponse.json({ error: "Trip not found" }, { status: 404 });
  }

  return NextResponse.json(stored);
}
