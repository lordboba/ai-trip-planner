# Date Range Filter on `/plan` Page

## Summary

Add a start date and end date selector to the `/plan` page, positioned before the calendar import section. Users set their trip dates first, and only events within that window are imported. This scopes the data sent to the backend and the AI, making queries more efficient.

## UI

- Two `<input type="date">` fields in a side-by-side grid (2 columns), labeled "Start date" and "End date"
- Placed at the top of the card, above the "Import your trip calendar" heading
- Supports both manual keyboard entry and native browser calendar picker
- Styled with existing `inputClasses` (warm-50 bg, rounded-xl border, coral focus ring)
- Validation: end date must be >= start date; both fields required before the import button becomes active

## Form State

Add two fields to `FormState` in `planner-shell.tsx`:

```ts
startDate: string;  // ISO date string, e.g. "2026-04-05"
endDate: string;    // ISO date string, e.g. "2026-04-08"
```

Both default to `""`.

## Data Flow

1. User fills in start and end dates
2. User imports calendar (.ics upload or Google Calendar)
3. The import request (`POST /api/calendar/import`) includes `startDate` and `endDate` as additional fields in the FormData
4. The backend calendar import endpoint filters events: only events whose time range overlaps `[startDate, endDate]` are returned
5. The imported schedule preview displays only the filtered events
6. When submitting the plan, `startDate` and `endDate` are included in the `SchedulePlanRequest` payload (inside `preferences` or as top-level fields alongside `importedSchedule`) so the AI generation is scoped to the correct window

## Backend Changes

### `POST /api/calendar/import`

- Accept optional `startDate` and `endDate` fields from FormData
- After parsing the .ics file, filter `events` to only those where the event's time range overlaps with `[startDate 00:00, endDate 23:59]` in the calendar's timezone
- Return the filtered event list as before

### `SchedulePlanRequest` schema

- Add required `startDate: z.string()` and `endDate: z.string()` fields to `schedulePlanRequestSchema` (top-level, alongside `importedSchedule` and `preferences`)

## Validation Rules

- Both dates must be valid ISO date strings (YYYY-MM-DD)
- `endDate >= startDate`
- Both dates required before import is enabled
- If either date is cleared after an import, the imported schedule is reset (user must re-import)

## No New Dependencies

Native `<input type="date">` provides typing + calendar picker. No third-party date library needed.
