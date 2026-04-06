import { NextResponse } from "next/server";
import { requireApiAccess } from "@/lib/server/access-gate-server";
import { connectGoogleCalendar } from "@/lib/server/schedule-backend";

export async function POST(request: Request) {
  const unauthorized = await requireApiAccess(request);

  if (unauthorized) {
    return unauthorized;
  }

  const body = (await request.json().catch(() => null)) as {
    startDate?: string | null;
    endDate?: string | null;
  } | null;

  const result = await connectGoogleCalendar({
    startDate: body?.startDate ?? null,
    endDate: body?.endDate ?? null,
  });
  return NextResponse.json(result);
}
