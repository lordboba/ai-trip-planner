import { NextResponse } from "next/server";
import { requireApiAccess } from "@/lib/server/access-gate-server";
import { getGoogleAccessTokenFromCookies } from "@/lib/server/google-calendar-auth";
import { importCalendarFile } from "@/lib/server/schedule-backend";

type CalendarImportInput = {
  icsText: string | null;
  startDate: string | null;
  endDate: string | null;
  source: "ics" | "google";
  googleAccessToken: string | null;
};

async function readCalendarImportInput(request: Request): Promise<CalendarImportInput> {
  const contentType = request.headers.get("content-type") ?? "";

  if (contentType.includes("multipart/form-data")) {
    const formData = await request.formData();
    const file = formData.get("file");
    const inline = formData.get("ics");
    const source = formData.get("source");
    const startDate = formData.get("startDate");
    const endDate = formData.get("endDate");

    const icsText = file instanceof File
      ? await file.text()
      : typeof inline === "string" && inline.trim()
        ? inline
        : null;

    return {
      icsText,
      startDate: typeof startDate === "string" ? startDate : null,
      endDate: typeof endDate === "string" ? endDate : null,
      source: source === "google" ? "google" : "ics",
      googleAccessToken: null,
    };
  }

  const body = (await request.json().catch(() => null)) as {
    ics?: string;
    startDate?: string;
    endDate?: string;
    source?: string;
    googleAccessToken?: string | null;
  } | null;

  return {
    icsText: body?.ics?.trim() || null,
    startDate: body?.startDate ?? null,
    endDate: body?.endDate ?? null,
    source: body?.source === "google" ? "google" : "ics",
    googleAccessToken: body?.googleAccessToken?.trim() || null,
  };
}

export const maxDuration = 300;

export async function POST(request: Request) {
  try {
    const unauthorized = await requireApiAccess(request);

    if (unauthorized) {
      return unauthorized;
    }

    const { icsText, startDate, endDate, source, googleAccessToken } = await readCalendarImportInput(request);

    if (source === "ics" && !icsText) {
      return NextResponse.json(
        { error: "Upload an .ics file or send calendar text in the request body." },
        { status: 400 },
      );
    }

    if (source === "google") {
      const token = googleAccessToken ?? await getGoogleAccessTokenFromCookies();

      if (!token) {
        return NextResponse.json(
          { error: "Google Calendar is not connected. Connect your Google account first." },
          { status: 401 },
        );
      }

      const imported = await importCalendarFile({
        source,
        startDate,
        endDate,
        googleAccessToken: token,
      });

      return NextResponse.json(imported);
    }

    const imported = await importCalendarFile({ icsText: icsText ?? undefined, source, startDate, endDate });
    return NextResponse.json(imported);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Calendar import failed.";
    const status = message.toLowerCase().includes("google calendar") ? 502 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
