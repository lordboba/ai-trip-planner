import { NextResponse } from "next/server";
import { requireApiAccess } from "@/lib/server/access-gate-server";
import { addSuggestionToSchedulePlanRecord } from "@/lib/server/schedule-backend";
import { createGoogleCalendarEvent } from "@/lib/server/google-calendar-write";
import { sanitizePlanForClient } from "@/lib/sanitize-plan-response";
import { resolveTimeZone } from "@/lib/timezone";

export const maxDuration = 300;

export async function POST(
  request: Request,
  { params }: { params: Promise<{ planId: string; suggestionId: string }> },
) {
  const unauthorized = await requireApiAccess(request);

  if (unauthorized) {
    return unauthorized;
  }

  const body = (await request.json().catch(() => null)) as {
    googleAccessToken?: string | null;
  } | null;

  const { planId, suggestionId } = await params;
  const updated = await addSuggestionToSchedulePlanRecord(planId, suggestionId);

  if (!updated) {
    return NextResponse.json(
      { error: "Schedule plan or suggestion was not found." },
      { status: 404 },
    );
  }

  const addedSuggestion = updated.suggestions.find(
    (suggestion) => suggestion.id === suggestionId && suggestion.status === "added",
  );

  let calendarEventCreated = false;

  if (addedSuggestion) {
    const timeZone = resolveTimeZone(
      updated.tripContext.timezone ?? updated.request.importedSchedule.timezone,
    );
    const description = [
      addedSuggestion.message,
      addedSuggestion.agentReason,
      addedSuggestion.budgetReason,
      addedSuggestion.place.googleMapsUri,
      addedSuggestion.place.reviewSummary,
    ].filter(Boolean).join("\n\n");
    const result = await createGoogleCalendarEvent({
      summary: addedSuggestion.place.name,
      description,
      location: addedSuggestion.place.address ?? "",
      startTime: addedSuggestion.startsAt,
      endTime: addedSuggestion.endsAt,
      timeZone,
      accessToken: body?.googleAccessToken?.trim() || null,
    });

    calendarEventCreated = result.success;
  }

  return NextResponse.json({
    ...sanitizePlanForClient(updated),
    calendarEventCreated,
  });
}
