import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({
    status: "ok",
    service: "atlas-web-api",
    timestamp: new Date().toISOString(),
  });
}
