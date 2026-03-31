# AI Trip Planner — Full Tailwind Redesign

## Overview

Complete visual redesign of the AI trip planner from custom CSS to Tailwind CSS. The goal is to transform the current editorial/field-notes aesthetic into an energetic, consumer-friendly product that encourages users to plan a vacation. The design is modern and sleek (not whimsical), with tasteful personality and noticeable animation delight.

## Tech Changes

- **Add Tailwind CSS v4** to the project (configured via `tailwind.config.ts`)
- **Add `framer-motion`** for card/page animations
- **Add Inter font** via `next/font/google`
- **Remove `globals.css`** entirely — all styling moves to Tailwind utility classes
- No component library (shadcn, etc.) — custom Tailwind only

## Design System

### Color Palette — "Vibrant Sunset"

| Token              | Value      | Usage                              |
|---------------------|------------|------------------------------------|
| `coral`            | `#FF6B42`  | Primary accent — CTAs, active states, highlights |
| `coral-light`      | `#FF9B7A`  | Hover states, soft backgrounds, gradient endpoints |
| `coral-deep`       | `#E8543A`  | Pressed states, emphasis, gradient endpoints |
| `coral-wash`       | `#FFF5F0`  | Light accent backgrounds           |
| `cream`            | `#FEFCFB`  | Page background                    |
| `warm-50`          | `#F5F1EE`  | Card surfaces, input backgrounds   |
| `warm-100`         | `#E8E3DF`  | Borders, dividers                  |
| `warm-400`         | `#8A7F79`  | Secondary/muted text               |
| `warm-600`         | `#3D3632`  | Body text                          |
| `warm-900`         | `#1A1614`  | Headings, dark backgrounds         |

### Typography

- **Font family:** Inter (via `next/font/google`) — single family for headings and body
- **Headings:** `font-bold` to `font-extrabold`, `warm-900`
- **Body:** `font-normal`, `warm-600`
- **Secondary:** `font-normal`, `warm-400`
- **Accent text:** `font-semibold`, `coral` — used for destination names, active labels

### Spacing & Radius

- Cards: `rounded-2xl` (16px)
- Buttons: `rounded-xl` (12px)
- Pills/chips: `rounded-full` (999px)
- Consistent spacing rhythm: `p-6`, `gap-4`, `space-y-4`

### Shadows

- Cards default: `shadow-sm`
- Cards hover: `shadow-md` (subtle lift)
- Floating card (onboarding): `shadow-xl` with low opacity
- No heavy drop shadows

## Pages

### Homepage (`/`)

**Layout: Gradient Hero + Search Bar**

- **Hero section:**
  - Full-width gradient background: `bg-gradient-to-br from-warm-900 via-warm-600 to-coral-deep`
  - Centered layout
  - Small uppercase label: "Powered by Claude AI" in `coral-light`
  - Large heading: "Where to next?" in white, `text-4xl font-extrabold`
  - Subtitle: "Describe your dream trip. Our AI handles the rest..." in white/70% opacity
  - Search-style input: frosted glass background (`bg-white/10 backdrop-blur`), rounded, with placeholder text ("Beach trip with friends in August...") and a coral "Go" button inside
  - The search input routes to `/plan` on submit (it sets initial context, not a real search)

- **Stats bar below hero:**
  - Light background (`cream`)
  - 3 stat cards in a row: "6 AI Agents", "50+ Destinations", "4.8★ Avg Rating"
  - Bordered cards with `coral` numbers
  - Subtitle text: "Personalized itineraries backed by real reviews"

- **No feature cards, no architecture section, no timeline** — keep it focused. The hero + stats + CTA is enough.

### Onboarding (`/plan`)

**Layout: Dark Background + Stacked Card Stack**

- **Background:** Solid `warm-900` (#1A1614) — dark, makes the card pop
- **Progress indicator:** Top of screen, `coral-light` step label ("Step 3 of 6") with gradient progress bar (`from-coral to-coral-light`)
- **Card stack:**
  - Main card: white (`cream` bg), `rounded-2xl`, `shadow-xl`, centered, max-width ~420px
  - Two "peeking" cards behind: slightly offset, lower opacity, smaller scale — created with absolute positioning and transforms
  - Card content changes per step; peeking cards are decorative only

- **Card content per step:**
  1. **Provider & Trip Type** — Segmented control for provider, pill buttons for trip type with emoji labels
  2. **Dates & Destination** — Date inputs styled with Tailwind, destination intent pills, text input with warm-50 background
  3. **Budget, Pace, Interests** — Icon-based budget cards (🎒 Lean, ✨ Comfort, 👑 Luxury) with selected border highlight; pill chips for pace; interest grid with toggle chips (emoji + label)
  4. **Constraints** — Textarea inputs with warm-50 background, placeholder text
  5. **Lodging & Vibe** — Text inputs, pill selectors for surprise tolerance
  6. **Profile Summary** — Review cards with warm-50 background summarizing all inputs

- **Navigation buttons:** Back (ghost button, warm-400 text) + Continue (coral filled, white text, `rounded-xl`)
- **Animations (framer-motion):**
  - Card slides left on "Continue", slides right on "Back"
  - Fade + slight scale on card entrance
  - Peeking cards animate subtly when transitioning

### Trip Results (`/trip/[tripId]`)

**Default view: Visual Itinerary (Day Tabs + Bold Headers)**

- **Hero section:**
  - Same gradient as homepage: `from-warm-900 via-warm-600 to-coral-deep`
  - Back link, view toggle (📋 Dashboard / 🔗 Share) in top bar
  - Large destination name in white, `text-3xl font-extrabold`
  - Trip meta: "5 days · Comfort · Food & Culture focus" in white/70%
  - Interest tags as frosted glass pills
  - "Planned with Claude ✨" badge: small, positioned bottom-right of hero, dark bg with coral text, `rounded-lg`

- **Day tabs:**
  - Horizontal tab bar below hero
  - Active tab: `coral` text + `coral` bottom border (2px)
  - Inactive tabs: `warm-400` text
  - Tabs are scrollable horizontally on mobile

- **Day content (per tab):**
  - Bold header: numbered circle (coral bg, white number, `rounded-full`) + "Day 1 — Alfama & the Old City" in `text-lg font-bold`
  - Activity cards stacked vertically:
    - Bordered card (`warm-100` border, `rounded-xl`)
    - Left: emoji icon in `coral-wash` square (`rounded-lg`, 48px)
    - Right: time-of-day label (uppercase, `coral`, tiny), activity title (bold), description (warm-400), rating + map link pills
  - Staggered entrance animation on tab switch

- **Dashboard view (toggle):**
  - Stats row: Days, Activities, Restaurants, Budget — coral numbers in warm-50 cards
  - Compact day list: rows with Day number (coral), title, activity count
  - Lodging + Top Pick cards side by side
  - Agent trace in expandable accordion section

### 404 Page (`/not-found`)

- Simple centered layout on cream background
- "Trip not found" heading, explanation text, coral CTA back to homepage
- Keep existing copy about in-memory storage (MVP limitation)

## Animations (framer-motion)

| Element | Animation | Trigger |
|---------|-----------|---------|
| Onboarding card | Slide left/right + fade | Step navigation |
| Peeking cards | Subtle shift | Step navigation |
| Activity cards | Stagger fade-in from bottom | Tab switch / page load |
| Hero content | Fade in + slight rise | Page load |
| Stat cards | Stagger fade-in | Scroll into view |
| Card hover | `shadow-sm` → `shadow-md`, slight translateY | Hover |
| Tab underline | Slide to active tab | Tab click |
| Dashboard toggle | Crossfade between views | Toggle click |

## AI Branding

- **Subtle confidence** approach
- "Planned with Claude ✨" badge on results hero — small, not dominant
- Agent trace available in dashboard view as expandable accordion
- No AI branding in onboarding flow or homepage hero (stats mention "AI Agents" which is sufficient)

## Responsive Behavior

- **Breakpoint:** `md` (768px) for primary layout shifts
- Homepage: hero padding adjusts, stats stack on mobile
- Onboarding: card width becomes full-width minus padding on mobile, peeking cards hidden on small screens
- Results: day tabs scroll horizontally, activity cards stack naturally, dashboard stats wrap to 2x2 grid
- All interactive elements have appropriate touch targets (min 44px)

## Files to Modify

- `package.json` — add tailwindcss, framer-motion, @tailwindcss/postcss dependencies
- `tailwind.config.ts` — new file, custom theme with Vibrant Sunset palette
- `postcss.config.ts` — new file for Tailwind PostCSS plugin
- `app/globals.css` — replace entirely with Tailwind directives
- `app/layout.tsx` — add Inter font via next/font, update body classes
- `app/page.tsx` — homepage redesign (gradient hero + search + stats)
- `app/plan/page.tsx` — minimal changes (wrapper for PlannerShell)
- `app/trip/[tripId]/page.tsx` — results page redesign (tabs + bold headers + dashboard toggle)
- `app/not-found.tsx` — restyle with Tailwind
- `components/planner-shell.tsx` — full rewrite for dark bg + stacked cards + framer-motion animations

## Out of Scope

- Real LLM integration (stays mocked)
- Real API calls (Google Places)
- Database persistence
- Authentication / user accounts
- Share functionality
- Dark mode (can be added later with Tailwind's dark: prefix)
