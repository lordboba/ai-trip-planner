import { NextResponse } from "next/server";
import { requireApiAccess } from "@/lib/server/access-gate-server";
import { fetchSchedulePlanRecord } from "@/lib/server/schedule-backend";
import { sanitizePlanForClient } from "@/lib/sanitize-plan-response";

export const maxDuration = 300;

export async function GET(request: Request, { params }: { params: Promise<{ planId: string }> }) {
  const unauthorized = await requireApiAccess(request);

  if (unauthorized) {
    return unauthorized;
  }

  const { planId } = await params;
  const stored = await fetchSchedulePlanRecord(planId);

  if (!stored) {
    return NextResponse.json({ error: "Schedule plan not found" }, { status: 404 });
  }

  return NextResponse.json(sanitizePlanForClient(stored));
}
