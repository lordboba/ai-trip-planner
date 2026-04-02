import { getGoogleAccessTokenFromCookies } from "./google-calendar-auth";

type CreateCalendarEventInput = {
  summary: string;
  description: string;
  location: string;
  startTime: string;
  endTime: string;
  timeZone: string;
};

export async function createGoogleCalendarEvent(
  input: CreateCalendarEventInput,
): Promise<{ success: boolean; eventId?: string }> {
  const accessToken = await getGoogleAccessTokenFromCookies();

  if (!accessToken) {
    return { success: false };
  }

  try {
    const response = await fetch(
      "https://www.googleapis.com/calendar/v3/calendars/primary/events",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          summary: input.summary,
          description: input.description,
          location: input.location,
          start: {
            dateTime: input.startTime,
            timeZone: input.timeZone,
          },
          end: {
            dateTime: input.endTime,
            timeZone: input.timeZone,
          },
        }),
        cache: "no-store",
      },
    );

    if (!response.ok) {
      console.error(`Google Calendar event creation failed with status ${response.status}.`);
      return { success: false };
    }

    const data = (await response.json()) as { id?: string };
    return { success: true, eventId: data.id };
  } catch (error) {
    console.error("Google Calendar event creation failed.", error);
    return { success: false };
  }
}
