import { NextResponse } from "next/server";
import { requireApiAccess } from "@/lib/server/access-gate-server";
import { connectGoogleCalendar } from "@/lib/server/schedule-backend";

export async function POST(request: Request) {
  const unauthorized = await requireApiAccess();

  if (unauthorized) {
    return unauthorized;
  }

  const result = await connectGoogleCalendar(request.headers.get("cookie") ?? undefined);
  return NextResponse.json(result);
}
