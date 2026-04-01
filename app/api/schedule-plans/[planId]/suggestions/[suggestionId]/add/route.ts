import { NextResponse } from "next/server";
import { requireApiAccess } from "@/lib/server/access-gate-server";
import { addSuggestionToSchedulePlanRecord } from "@/lib/server/schedule-backend";

export const maxDuration = 300;

export async function POST(
  _: Request,
  { params }: { params: Promise<{ planId: string; suggestionId: string }> },
) {
  const unauthorized = await requireApiAccess();

  if (unauthorized) {
    return unauthorized;
  }

  const { planId, suggestionId } = await params;
  const updated = await addSuggestionToSchedulePlanRecord(planId, suggestionId);

  if (!updated) {
    return NextResponse.json(
      { error: "Schedule plan or suggestion was not found." },
      { status: 404 },
    );
  }

  return NextResponse.json(updated);
}
