import { NextResponse } from "next/server";
import { tripRequestSchema } from "@/backend/src/domain/trips";
import { createTripRecord } from "@/lib/server/trip-backend";

export const maxDuration = 300;

export async function POST(request: Request) {
  const body = await request.json();
  const parsed = tripRequestSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid trip request payload." }, { status: 400 });
  }

  const created = await createTripRecord(parsed.data);

  return NextResponse.json(created);
}
