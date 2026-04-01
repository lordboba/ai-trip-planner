# Date Range Filter Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add start/end date inputs to the `/plan` page so users scope which dates get imported and planned.

**Architecture:** Two `<input type="date">` fields are added to `PlannerShell` form state. The dates are sent with the calendar import request and used by the backend to filter events. The dates are also added to `SchedulePlanRequest` so the AI generation is scoped.

**Tech Stack:** React, Next.js, Zod, existing ICS parser

---

### Task 1: Add `startDate` and `endDate` to the Zod schema

**Files:**
- Modify: `backend/src/domain/schedule-plans.ts:109-112`

- [ ] **Step 1: Add date fields to `schedulePlanRequestSchema`**

In `backend/src/domain/schedule-plans.ts`, change `schedulePlanRequestSchema` from:

```ts
export const schedulePlanRequestSchema = z.object({
  importedSchedule: importedCalendarSchema,
  preferences: schedulePlanPreferencesSchema,
});
```

to:

```ts
export const schedulePlanRequestSchema = z.object({
  importedSchedule: importedCalendarSchema,
  preferences: schedulePlanPreferencesSchema,
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Expected YYYY-MM-DD"),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Expected YYYY-MM-DD"),
});
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit --pretty 2>&1 | head -30`
Expected: No new errors related to `startDate`/`endDate` (existing errors from other files are OK; the schema change itself should compile clean).

- [ ] **Step 3: Commit**

```bash
git add backend/src/domain/schedule-plans.ts
git commit -m "feat: add startDate and endDate to schedulePlanRequestSchema"
```

---

### Task 2: Add date filtering to the calendar import service

**Files:**
- Modify: `backend/src/services/calendar-import-service.ts:354-371`

- [ ] **Step 1: Add a `filterEventsByDateRange` function**

Add the following function above `importCalendarFromIcsText` in `backend/src/services/calendar-import-service.ts`:

```ts
function filterEventsByDateRange(
  events: readonly NormalizedCalendarEvent[],
  startDate: string | null,
  endDate: string | null,
): NormalizedCalendarEvent[] {
  if (!startDate || !endDate) return [...events];
  const rangeStart = `${startDate}T00:00:00.000Z`;
  const rangeEnd = `${endDate}T23:59:59.999Z`;
  return events.filter(
    (event) => event.endsAt > rangeStart && event.startsAt <= rangeEnd,
  );
}
```

- [ ] **Step 2: Update `importCalendarFromIcsText` signature and body**

Change the function signature to accept optional date range params, and filter events before returning:

```ts
export function importCalendarFromIcsText(input: {
  icsText: string;
  source?: "ics" | "google";
  startDate?: string | null;
  endDate?: string | null;
}) {
  const { events: rawEvents, warnings, calendarTimezone } = parseIcsEvents(input.icsText);
  const normalizedEvents = sortEvents(
    rawEvents.map((rawEvent) => normalizeRawEvent(rawEvent, calendarTimezone)),
  );
  const filteredEvents = filterEventsByDateRange(
    normalizedEvents,
    input.startDate ?? null,
    input.endDate ?? null,
  );
  const cityInference = inferCalendarCity(filteredEvents);

  return importedCalendarSchema.parse({
    source: input.source ?? "ics",
    importedAt: new Date().toISOString(),
    timezone: calendarTimezone,
    cityInference,
    warnings: filteredEvents.length > 0
      ? warnings
      : [...warnings, "No VEVENT entries were found in the uploaded calendar file."],
    events: filteredEvents,
  }) satisfies ImportedCalendar;
}
```

- [ ] **Step 3: Verify TypeScript compiles**

Run: `npx tsc --noEmit --pretty 2>&1 | head -30`
Expected: Clean compile — the new params are optional so existing callers are unaffected.

- [ ] **Step 4: Commit**

```bash
git add backend/src/services/calendar-import-service.ts
git commit -m "feat: add date range filtering to calendar import service"
```

---

### Task 3: Pass dates through the API route and backend bridge

**Files:**
- Modify: `app/api/calendar/import/route.ts:5-47`
- Modify: `lib/server/schedule-backend.ts:32-53`

- [ ] **Step 1: Extract dates from FormData in the API route**

In `app/api/calendar/import/route.ts`, update `readIcsText` to also return dates, and pass them through. Replace the entire file with:

```ts
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
```

- [ ] **Step 2: Update `importCalendarFile` in the backend bridge**

In `lib/server/schedule-backend.ts`, update the `importCalendarFile` function signature and pass dates through:

Change the function from:

```ts
export async function importCalendarFile(input: { icsText: string; source?: "ics" | "google" }) {
  const backendUrl = getBackendUrl();

  if (!backendUrl) {
    return importCalendarFromIcsText(input);
  }

  const response = await fetch(`${backendUrl}/api/calendar/import`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ ics: input.icsText, source: input.source ?? "ics" }),
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`External backend calendar import failed with status ${response.status}.`);
  }

  return importedCalendarSchema.parse(await response.json());
}
```

to:

```ts
export async function importCalendarFile(input: {
  icsText: string;
  source?: "ics" | "google";
  startDate?: string | null;
  endDate?: string | null;
}) {
  const backendUrl = getBackendUrl();

  if (!backendUrl) {
    return importCalendarFromIcsText(input);
  }

  const response = await fetch(`${backendUrl}/api/calendar/import`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      ics: input.icsText,
      source: input.source ?? "ics",
      startDate: input.startDate ?? null,
      endDate: input.endDate ?? null,
    }),
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`External backend calendar import failed with status ${response.status}.`);
  }

  return importedCalendarSchema.parse(await response.json());
}
```

- [ ] **Step 3: Verify TypeScript compiles**

Run: `npx tsc --noEmit --pretty 2>&1 | head -30`
Expected: No new errors.

- [ ] **Step 4: Commit**

```bash
git add app/api/calendar/import/route.ts lib/server/schedule-backend.ts
git commit -m "feat: pass startDate/endDate through import API and backend bridge"
```

---

### Task 4: Add date inputs to `PlannerShell` and wire up the full flow

**Files:**
- Modify: `components/planner-shell.tsx`

- [ ] **Step 1: Add `startDate` and `endDate` to form state**

In `components/planner-shell.tsx`, update `FormState` and `initialState`:

Change:

```ts
type FormState = {
  provider: LLMProvider;
  budgetBand: BudgetBand;
  interests: string[];
  pace: Pace;
  transport: ScheduleTransportMode;
  comments: string;
};

const initialState: FormState = {
  provider: "openai",
  budgetBand: "comfort",
  interests: [],
  pace: "balanced",
  transport: "walk",
  comments:
    "Keep suggestions close to existing meetings and worth doing without extra logistics.",
};
```

to:

```ts
type FormState = {
  startDate: string;
  endDate: string;
  provider: LLMProvider;
  budgetBand: BudgetBand;
  interests: string[];
  pace: Pace;
  transport: ScheduleTransportMode;
  comments: string;
};

const initialState: FormState = {
  startDate: "",
  endDate: "",
  provider: "openai",
  budgetBand: "comfort",
  interests: [],
  pace: "balanced",
  transport: "walk",
  comments:
    "Keep suggestions close to existing meetings and worth doing without extra logistics.",
};
```

- [ ] **Step 2: Add date validation helper**

Add this below the `toggleValue` function:

```ts
function datesValid(startDate: string, endDate: string) {
  return startDate !== "" && endDate !== "" && endDate >= startDate;
}
```

- [ ] **Step 3: Send dates with the import request**

In the `importIcsFile` function, update the fetch body to include dates. Change:

```ts
        const formData = new FormData();
        formData.append("file", file);
        const response = await fetch("/api/calendar/import", {
          method: "POST",
          body: formData,
        });
```

to:

```ts
        const formData = new FormData();
        formData.append("file", file);
        formData.append("startDate", form.startDate);
        formData.append("endDate", form.endDate);
        const response = await fetch("/api/calendar/import", {
          method: "POST",
          body: formData,
        });
```

- [ ] **Step 4: Include dates in the schedule plan payload**

In `buildPayload`, change:

```ts
  function buildPayload(): SchedulePlanRequest | null {
    if (!importedSchedule) return null;
    return {
      importedSchedule,
      preferences: {
        provider: form.provider,
        budgetBand: form.budgetBand,
        interests: form.interests,
        pace: form.pace,
        transport: form.transport,
        comments: form.comments.trim(),
      },
    };
  }
```

to:

```ts
  function buildPayload(): SchedulePlanRequest | null {
    if (!importedSchedule) return null;
    return {
      importedSchedule,
      preferences: {
        provider: form.provider,
        budgetBand: form.budgetBand,
        interests: form.interests,
        pace: form.pace,
        transport: form.transport,
        comments: form.comments.trim(),
      },
      startDate: form.startDate,
      endDate: form.endDate,
    };
  }
```

- [ ] **Step 5: Disable import when dates are invalid**

Update the disabled condition on the file upload button. Change:

```ts
            disabled={isUploading}
```

(on the upload drop-zone button) to:

```ts
            disabled={isUploading || !datesValid(form.startDate, form.endDate)}
```

And update the Google Calendar connect button similarly. Change:

```ts
            disabled={isConnecting}
```

to:

```ts
            disabled={isConnecting || !datesValid(form.startDate, form.endDate)}
```

- [ ] **Step 6: Reset imported schedule when dates change**

Add a date change handler that clears the imported schedule:

```ts
  function handleDateChange(field: "startDate" | "endDate", value: string) {
    setForm((c) => ({ ...c, [field]: value }));
    setImportedSchedule(null);
    setUploadedFileName(null);
  }
```

- [ ] **Step 7: Add the date input UI**

Add the date range fields inside the card, right after the `{/* Upload hero */}` section's closing `</div>` (after line 258) and before the `{/* Primary: File upload drop zone */}` comment. Insert:

```tsx
          {/* Date range */}
          <div className="mb-5">
            <label className={labelClasses}>Trip dates</label>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="start-date" className="block text-xs text-warm-400 mb-1">
                  Start date
                </label>
                <input
                  id="start-date"
                  type="date"
                  value={form.startDate}
                  onChange={(e) => handleDateChange("startDate", e.target.value)}
                  className={inputClasses}
                />
              </div>
              <div>
                <label htmlFor="end-date" className="block text-xs text-warm-400 mb-1">
                  End date
                </label>
                <input
                  id="end-date"
                  type="date"
                  value={form.endDate}
                  min={form.startDate || undefined}
                  onChange={(e) => handleDateChange("endDate", e.target.value)}
                  className={inputClasses}
                />
              </div>
            </div>
            {form.startDate && form.endDate && form.endDate < form.startDate && (
              <p className="text-red-500 text-xs mt-1">End date must be on or after start date.</p>
            )}
          </div>
```

- [ ] **Step 8: Verify TypeScript compiles and UI renders**

Run: `npx tsc --noEmit --pretty 2>&1 | head -30`
Expected: No new errors.

Then run: `npm run dev` and manually verify the date inputs appear, disable import when empty, and dates flow through to the import request.

- [ ] **Step 9: Commit**

```bash
git add components/planner-shell.tsx
git commit -m "feat: add date range selector to planner shell"
```
