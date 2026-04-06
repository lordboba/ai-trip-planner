import { NextResponse } from "next/server";
import { schedulePlanRequestSchema } from "@/backend/src/domain/schedule-plans";
import { requireApiAccess } from "@/lib/server/access-gate-server";
import { createSchedulePlanRecord } from "@/lib/server/schedule-backend";

export const maxDuration = 300;

export async function POST(request: Request) {
  const unauthorized = await requireApiAccess(request);

  if (unauthorized) {
    return unauthorized;
  }

  const body = await request.json().catch(() => null);
  const parsed = schedulePlanRequestSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid schedule plan payload." }, { status: 400 });
  }

  const created = await createSchedulePlanRecord(parsed.data);
  return NextResponse.json(created, { status: 201 });
}
