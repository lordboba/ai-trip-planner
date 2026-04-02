# Trip Results Page Redesign

## Problem

The current results page (`/plan/[planId]`) has four core issues:
1. **Information overload** — too much data dumped at once (metadata, stats, suggestions all visible)
2. **No spatial context** — places are listed but not shown on a map; locations feel abstract
3. **No trip overview** — it's a flat chronological list, not a cohesive trip experience
4. **Weak interactivity** — hard to compare suggestions, act on them, or customize the plan

## Solution

Replace the current single-scroll timeline + stats sidebar with a **tabbed day-by-day split view**: itinerary on the left, interactive route-aware map on the right, with an Overview tab as the trip homepage.

## Architecture

### Page Structure

```
/plan/[planId]
├── Top Bar (city name, dates, back link, export)
├── Day Tabs (Overview | Day 1 · Apr 5 | Day 2 · Apr 6 | ...)
└── Split View
    ├── Left Panel (~38%) — Itinerary
    │   ├── [Overview tab] Trip Summary Card + Day Preview Cards
    │   └── [Day tabs] Timeline of events + suggestions
    └── Right Panel (~62%) — Google Map
        ├── [Overview tab] All-day routes, color-coded, with legend
        └── [Day tabs] Single-day route with numbered pins
```

### Components

**New components to create:**
- `TripResultsPage` — top-level layout with tabs, replaces `SchedulePlanResults`
- `DayTab` — single day's itinerary timeline
- `OverviewTab` — trip summary card + day preview cards
- `SuggestionCard` — collapsed/expanded accordion card for AI suggestions
- `LockedEventCard` — compact card for imported calendar events
- `TripMap` — Google Maps JS SDK wrapper with pins, routes, and sync
- `DayTabs` — tab bar component with pill-style day navigation

**Removed:**
- `SchedulePlanResults` — replaced entirely by the new component tree
- `GoogleMapFrame` (iframe embed) — replaced by `TripMap` (JS SDK)
- Stats sidebar — eliminated; key stats moved to Overview summary card

### Map Integration

**Upgrade from Google Maps Embed API to Google Maps JavaScript SDK.**

- Library: `@vis.gl/react-google-maps` (Google's official React wrapper)
- Pins: Numbered `AdvancedMarkerElement`s — solid dark for locked events, dashed-border coral for suggestions
- Routes: Google Directions API to draw polyline paths between stops per day
- Day view: Map scoped to that day's pins + route, auto-fitted to bounds
- Overview: All days overlaid, each day's route in a distinct color (Day 1 coral, Day 2 blue, Day 3 green, etc.) with a legend

### Map ↔ Itinerary Sync

- **Hover itinerary item** → dims other pins, highlights matching pin with glow ring
- **Click map pin** → scrolls itinerary to that item and expands it (if suggestion)
- **Expand suggestion card** → map pans to center on that pin
- **Switch tabs** → map animates (pan + zoom) to new day's bounds, crossfade on itinerary

### Suggestion Cards (Accordion)

**Collapsed state (default):**
- Category icon, place name, star rating, category, time
- Chevron to indicate expandability
- One compact row per suggestion

**Expanded state (click to open):**
- "Why this spot" reasoning block
- Stats row: duration, time window, estimated cost
- Review snippet (italic)
- Transit note with transport icon
- Two action buttons: "Add to trip" (primary coral) and "Maps ↗" (secondary, opens Google Maps in new tab)

**Behavior:**
- Accordion pattern — one card expanded at a time
- Expanding a card collapses the previous one

### "Add to Trip" Flow

When user clicks "Add to trip":

1. POST to `/api/schedule-plans/[planId]/suggestions/[suggestionId]/add` (existing endpoint)
2. In parallel, create a Google Calendar event via Google Calendar API `events.insert`:
   - Title: place name
   - Start/end: suggestion's `startsAt`/`endsAt`
   - Location: place address
   - Description: Google Maps URI + review summary
   - Uses existing OAuth token from the calendar import flow
3. UI transition: suggestion card smoothly animates into locked event style:
   - Dashed border → solid border
   - Coral accent bar → solid dark bar
   - Green checkmark + "Added" badge appears
   - Small "Added to Google Calendar" confirmation line
4. Map pin transitions from dashed-coral to solid numbered pin

### Overview Tab

**Trip Summary Card (dark background):**
- 2x2 grid: days count, events count, suggestions count, estimated total budget
- User preference tags as pills (interests, pace, transport, budget band)

**Day Preview Cards:**
- One card per day with color-coded left border (matches map route color)
- All events/suggestions shown as mini pills — solid for locked, dashed for suggestions
- Click navigates to that day's tab
- Hover highlights that day's route on the overview map

### Tab Bar

- Pill-style tabs: "Overview" first, then "Day N · Mon DD" for each day
- Active tab uses coral gradient, inactive uses warm-50 background
- Horizontally scrollable if many days

## Backend Changes

### Remove Generation Metadata

Strip from `SchedulePlan` schema and API responses:
- `generation` field (provider, model, live, fallbackReason)
- `workflow.steps[].execution` details
- Keep `workflow.status` for internal use only — do not send to client

### Google Calendar Event Creation

Extend the existing suggestion `add` endpoint (or add a parallel call in the handler):
- Use Google Calendar API `events.insert` with the user's OAuth token
- Token is already available from the calendar import auth flow
- Calendar event fields: summary (place name), start/end times, location (address), description (Maps link + review summary)
- Fail silently if calendar write fails (don't block the suggestion add) — show a subtle error toast in the UI

### Remove Unused API

- Remove `/api/maps/embed` route — no longer needed after switching to JS SDK
- Remove `GoogleMapFrame` component

## Tech Stack

| Concern | Technology |
|---------|-----------|
| Maps | `@vis.gl/react-google-maps` + Google Maps JS SDK |
| Routes | Google Directions API |
| Animations | Framer Motion (existing) |
| Styling | Tailwind CSS (existing custom theme) |
| State | React useState + props (existing pattern) |
| Calendar write | Google Calendar API v3 `events.insert` |

## Color System

Per-day colors for map routes and day card borders:
- Day 1: coral (#FF6B42)
- Day 2: blue (#4a90d9)
- Day 3: green (#6bc96b)
- Day 4: purple (#9b6bd4)
- Day 5: amber (#d4a26b)
- Day 6+: cycle through palette

## Design Constraints

- Mobile: not in scope for this iteration. The split view is desktop-focused. A future pass can add responsive behavior (stacked layout on mobile).
- The existing data model (`SchedulePlan`, `suggestions`, `slots`, `timeline`) is sufficient — no new data structures needed beyond removing metadata fields.
- Google Maps JS SDK requires the existing `GOOGLE_PLACES_API_KEY` to also have Maps JavaScript API and Directions API enabled in Google Cloud Console.
