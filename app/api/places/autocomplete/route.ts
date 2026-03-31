import { NextResponse } from "next/server";
import { z } from "zod";
import { autocompleteDestinationSearch, isGooglePlacesConfigured } from "@/backend/src/services/google-places";

const querySchema = z.object({
  input: z.string().trim().min(1).max(120),
  sessionToken: z.string().trim().min(1).max(120).optional(),
});

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const parsed = querySchema.safeParse({
    input: searchParams.get("input") ?? "",
    sessionToken: searchParams.get("sessionToken") ?? undefined,
  });

  if (!parsed.success) {
    return NextResponse.json({ suggestions: [], live: false, reason: "Invalid autocomplete query." }, { status: 400 });
  }

  if (!isGooglePlacesConfigured()) {
    return NextResponse.json({ suggestions: [], live: false, reason: "GOOGLE_PLACES_API_KEY is not configured." });
  }

  try {
    const suggestions = await autocompleteDestinationSearch(parsed.data.input, parsed.data.sessionToken);
    return NextResponse.json({ suggestions, live: true, reason: null });
  } catch (error) {
    return NextResponse.json({
      suggestions: [],
      live: false,
      reason: error instanceof Error ? error.message : "Autocomplete request failed.",
    });
  }
}
