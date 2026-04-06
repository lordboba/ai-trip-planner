import { NextResponse } from "next/server";
import {
  consumeGooglePendingImportDateRange,
  exchangeGoogleCodeForTokens,
} from "@/lib/server/google-calendar-auth";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");

  if (!code || !state) {
    await consumeGooglePendingImportDateRange();
    return NextResponse.redirect(new URL("/plan?googleCalendar=error", url));
  }

  try {
    await exchangeGoogleCodeForTokens({ code, state });
    const redirectUrl = new URL("/plan?googleCalendar=connected", url);
    const pendingRange = await consumeGooglePendingImportDateRange();

    if (pendingRange.startDate && pendingRange.endDate) {
      redirectUrl.searchParams.set("startDate", pendingRange.startDate);
      redirectUrl.searchParams.set("endDate", pendingRange.endDate);
    }

    return NextResponse.redirect(redirectUrl);
  } catch {
    await consumeGooglePendingImportDateRange();
    return NextResponse.redirect(new URL("/plan?googleCalendar=error", url));
  }
}
