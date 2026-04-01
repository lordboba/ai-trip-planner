import { NextResponse } from "next/server";
import { exchangeGoogleCodeForTokens } from "@/lib/server/google-calendar-auth";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");

  if (!code || !state) {
    return NextResponse.redirect(new URL("/?googleCalendar=error", url));
  }

  try {
    await exchangeGoogleCodeForTokens({ code, state });
    return NextResponse.redirect(new URL("/?googleCalendar=connected", url));
  } catch {
    return NextResponse.redirect(new URL("/?googleCalendar=error", url));
  }
}
