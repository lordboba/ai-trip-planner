import { NextResponse } from "next/server";
import { requireApiAccess } from "@/lib/server/access-gate-server";
import { importCalendarFile } from "@/lib/server/schedule-backend";

type IcsInput = {
  icsText: string | null;
  startDate: string | null;
  endDate: string | null;
};

async function readIcsInput(request: Request): Promise<IcsInput> {
  const contentType = request.headers.get("content-type") ?? "";

  if (contentType.includes("multipart/form-data")) {
    const formData = await request.formData();
    const file = formData.get("file");
    const inline = formData.get("ics");
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
    };
  }

  const body = (await request.json().catch(() => null)) as {
    ics?: string;
    startDate?: string;
    endDate?: string;
  } | null;

  return {
    icsText: body?.ics?.trim() || null,
    startDate: body?.startDate ?? null,
    endDate: body?.endDate ?? null,
  };
}

export const maxDuration = 300;

export async function POST(request: Request) {
  const unauthorized = await requireApiAccess();

  if (unauthorized) {
    return unauthorized;
  }

  const { icsText, startDate, endDate } = await readIcsInput(request);

  if (!icsText) {
    return NextResponse.json(
      { error: "Upload an .ics file or send calendar text in the request body." },
      { status: 400 },
    );
  }

  const imported = await importCalendarFile({ icsText, source: "ics", startDate, endDate });
  return NextResponse.json(imported);
}
