# Tailwind Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace all custom CSS with Tailwind CSS and redesign every page with the Vibrant Sunset palette, framer-motion animations, and a consumer-product aesthetic.

**Architecture:** Full rip-and-replace of styling. Every page and component gets rewritten with Tailwind utility classes. No CSS modules, no custom CSS file (beyond Tailwind directives). framer-motion handles card transitions and staggered entrances.

**Tech Stack:** Tailwind CSS v4, framer-motion, Inter font via next/font/google, Next.js 16, React 19

---

## File Map

| Action | File | Responsibility |
|--------|------|---------------|
| Create | `tailwind.config.ts` | Vibrant Sunset custom theme tokens |
| Create | `postcss.config.mjs` | Tailwind PostCSS plugin |
| Modify | `app/globals.css` | Replace with Tailwind directives only |
| Modify | `app/layout.tsx` | Inter font setup, body classes |
| Modify | `app/page.tsx` | Gradient hero + search + stats homepage |
| Modify | `app/not-found.tsx` | Tailwind-styled 404 page |
| Modify | `app/plan/page.tsx` | Dark background wrapper |
| Modify | `components/planner-shell.tsx` | Dark BG + stacked cards + framer-motion |
| Create | `components/trip-results.tsx` | Client component for day tabs + dashboard toggle |
| Modify | `app/trip/[tripId]/page.tsx` | Server component wrapper, passes data to TripResults |
| Modify | `package.json` | Add tailwindcss, @tailwindcss/postcss, framer-motion |

---

### Task 1: Install Dependencies and Configure Tailwind

**Files:**
- Modify: `package.json`
- Create: `tailwind.config.ts`
- Create: `postcss.config.mjs`
- Modify: `app/globals.css`

- [ ] **Step 1: Install tailwindcss, @tailwindcss/postcss, and framer-motion**

```bash
cd /Users/tylerxiao/Documents/ai-trip-planner && pnpm add tailwindcss @tailwindcss/postcss framer-motion
```

- [ ] **Step 2: Create `postcss.config.mjs`**

```js
// postcss.config.mjs
const config = {
  plugins: {
    "@tailwindcss/postcss": {},
  },
};
export default config;
```

- [ ] **Step 3: Create `tailwind.config.ts`**

```ts
import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        coral: {
          DEFAULT: "#FF6B42",
          light: "#FF9B7A",
          deep: "#E8543A",
          wash: "#FFF5F0",
        },
        cream: "#FEFCFB",
        warm: {
          50: "#F5F1EE",
          100: "#E8E3DF",
          400: "#8A7F79",
          600: "#3D3632",
          900: "#1A1614",
        },
      },
      fontFamily: {
        sans: ["var(--font-inter)", "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [],
};

export default config;
```

- [ ] **Step 4: Replace `app/globals.css` with Tailwind directives**

```css
@import "tailwindcss";

@config "../tailwind.config.ts";
```

- [ ] **Step 5: Run dev server to verify Tailwind loads**

```bash
cd /Users/tylerxiao/Documents/ai-trip-planner && pnpm frontend:dev
```

Expected: Dev server starts without errors. Pages will look unstyled (all custom CSS removed) — that's correct at this stage.

- [ ] **Step 6: Commit**

```bash
git add package.json pnpm-lock.yaml postcss.config.mjs tailwind.config.ts app/globals.css
git commit -m "feat: install Tailwind CSS v4 and framer-motion, replace custom CSS"
```

---

### Task 2: Set Up Layout with Inter Font

**Files:**
- Modify: `app/layout.tsx`

- [ ] **Step 1: Update `app/layout.tsx` with Inter font and Tailwind body classes**

```tsx
import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

export const metadata: Metadata = {
  title: "Tripwise — AI Trip Planner",
  description: "AI-powered trip planning with personalized itineraries backed by real reviews.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={inter.variable}>
      <body className="bg-cream text-warm-600 font-sans antialiased">
        {children}
      </body>
    </html>
  );
}
```

- [ ] **Step 2: Verify font loads**

```bash
cd /Users/tylerxiao/Documents/ai-trip-planner && pnpm frontend:dev
```

Expected: Browser shows Inter font, cream background on all pages.

- [ ] **Step 3: Commit**

```bash
git add app/layout.tsx
git commit -m "feat: set up Inter font and base body styles"
```

---

### Task 3: Redesign Homepage

**Files:**
- Modify: `app/page.tsx`

- [ ] **Step 1: Rewrite `app/page.tsx` with gradient hero + search + stats**

```tsx
import Link from "next/link";

const stats = [
  { value: "6", label: "AI Agents" },
  { value: "50+", label: "Destinations" },
  { value: "4.8★", label: "Avg Rating" },
];

export default function HomePage() {
  return (
    <main className="min-h-screen">
      {/* Gradient Hero */}
      <section className="bg-gradient-to-br from-warm-900 via-warm-600 to-coral-deep px-4 py-24 md:py-32 text-center">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-coral-light mb-4">
          Powered by Claude AI
        </p>
        <h1 className="text-4xl md:text-6xl font-extrabold text-white mb-4">
          Where to next?
        </h1>
        <p className="text-white/70 max-w-md mx-auto mb-8 text-base md:text-lg">
          Describe your dream trip. Our AI handles the rest — from hidden gems to dinner reservations.
        </p>

        {/* Search-style CTA */}
        <div className="max-w-md mx-auto flex items-center gap-3 bg-white/10 backdrop-blur-md border border-white/20 rounded-2xl px-4 py-3">
          <span className="flex-1 text-left text-white/50 text-sm">
            Beach trip with friends in August...
          </span>
          <Link
            href="/plan"
            className="bg-coral text-white px-5 py-2 rounded-xl text-sm font-semibold hover:bg-coral-deep transition-colors shrink-0"
          >
            Go
          </Link>
        </div>
      </section>

      {/* Stats Bar */}
      <section className="bg-cream px-4 py-12 md:py-16">
        <div className="max-w-2xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            {stats.map((stat) => (
              <div
                key={stat.label}
                className="border border-warm-100 rounded-2xl p-5 text-center"
              >
                <div className="text-2xl font-extrabold text-coral">{stat.value}</div>
                <div className="text-sm text-warm-400 mt-1">{stat.label}</div>
              </div>
            ))}
          </div>
          <p className="text-center text-warm-400 text-sm">
            Personalized itineraries backed by Google Places reviews and location data
          </p>
        </div>
      </section>
    </main>
  );
}
```

- [ ] **Step 2: Verify homepage renders correctly**

```bash
cd /Users/tylerxiao/Documents/ai-trip-planner && pnpm frontend:dev
```

Expected: Gradient hero with "Where to next?", frosted search bar, stats section below. "Go" button links to `/plan`.

- [ ] **Step 3: Commit**

```bash
git add app/page.tsx
git commit -m "feat: redesign homepage with gradient hero, search CTA, and stats"
```

---

### Task 4: Redesign 404 Page

**Files:**
- Modify: `app/not-found.tsx`

- [ ] **Step 1: Rewrite `app/not-found.tsx` with Tailwind**

```tsx
import Link from "next/link";

export default function NotFound() {
  return (
    <main className="min-h-screen bg-cream flex items-center justify-center px-4">
      <div className="max-w-md text-center">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-warm-400 mb-3">
          Trip not found
        </p>
        <h1 className="text-3xl font-extrabold text-warm-900 mb-3">
          This itinerary is no longer in memory.
        </h1>
        <p className="text-warm-400 mb-6">
          Trips are stored in-memory for this MVP. Generate a fresh plan from the onboarding flow.
        </p>
        <Link
          href="/plan"
          className="inline-block bg-coral text-white px-6 py-3 rounded-xl font-semibold hover:bg-coral-deep transition-colors"
        >
          Build a new trip
        </Link>
      </div>
    </main>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add app/not-found.tsx
git commit -m "feat: restyle 404 page with Tailwind"
```

---

### Task 5: Redesign Onboarding — Dark BG + Stacked Cards with framer-motion

**Files:**
- Modify: `app/plan/page.tsx`
- Modify: `components/planner-shell.tsx`

This is the largest task. The PlannerShell gets a full rewrite: dark background, centered white card with peeking stack behind it, framer-motion slide animations, and all form inputs restyled with Tailwind.

- [ ] **Step 1: Update `app/plan/page.tsx` to set dark background**

```tsx
import { PlannerShell } from "@/components/planner-shell";

export default function PlanPage() {
  return (
    <main className="min-h-screen bg-warm-900 flex flex-col items-center px-4 py-8 md:py-12">
      <PlannerShell />
    </main>
  );
}
```

- [ ] **Step 2: Rewrite `components/planner-shell.tsx` with Tailwind + framer-motion**

Replace the entire file with:

```tsx
"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { onboardingSteps } from "@/lib/onboarding";
import type {
  BudgetBand,
  DestinationIntent,
  LLMProvider,
  Pace,
  SurpriseTolerance,
  TripRequest,
  TripType,
} from "@/lib/types";

const interestOptions = [
  { label: "🍜 Food", value: "food" },
  { label: "🎉 Nightlife", value: "nightlife" },
  { label: "🌿 Nature", value: "nature" },
  { label: "🎨 Culture", value: "culture" },
  { label: "🛍️ Shopping", value: "shopping" },
  { label: "🧘 Wellness", value: "wellness" },
  { label: "🏔️ Adventure", value: "adventure" },
  { label: "👨‍👩‍👧 Family", value: "family-friendly" },
  { label: "💎 Hidden Gems", value: "hidden gems" },
];

const budgetOptions = [
  { icon: "🎒", label: "Lean", value: "lean" as const },
  { icon: "✨", label: "Comfort", value: "comfort" as const },
  { icon: "👑", label: "Luxury", value: "luxury" as const },
];

const providerCopy: Record<LLMProvider, string> = {
  openai: "Faster itinerary drafting and tool-first orchestration.",
  claude: "Strong long-form reasoning for taste and trip narrative.",
};

type FormState = {
  provider: LLMProvider;
  tripType: TripType;
  startDate: string;
  endDate: string;
  dateFlexibility: string;
  destinationIntent: DestinationIntent;
  destinationQuery: string;
  budgetBand: BudgetBand;
  splurgeTolerance: number;
  pace: Pace;
  interests: string[];
  constraintsNotes: string;
  lodgingStyle: string;
  neighborhoodVibe: string;
  mustHaves: string;
  hardNos: string;
  loyaltyPrograms: string;
  surpriseTolerance: SurpriseTolerance;
};

const initialState: FormState = {
  provider: "openai",
  tripType: "couple",
  startDate: "2026-06-14",
  endDate: "2026-06-18",
  dateFlexibility: "Weekend in June works too.",
  destinationIntent: "help-me-choose",
  destinationQuery: "",
  budgetBand: "comfort",
  splurgeTolerance: 60,
  pace: "balanced",
  interests: ["food", "culture", "hidden gems"],
  constraintsNotes:
    "Vegetarian-friendly dinners, walkable neighborhoods, no forced resort vibe.",
  lodgingStyle: "boutique hotel",
  neighborhoodVibe: "walkable and local",
  mustHaves: "Excellent coffee, one memorable dinner, room for wandering.",
  hardNos: "Tour buses, loud club districts, long transfers every day.",
  loyaltyPrograms: "None",
  surpriseTolerance: "balanced",
};

function toggleValue(values: string[], value: string) {
  return values.includes(value)
    ? values.filter((entry) => entry !== value)
    : [...values, value];
}

const slideVariants = {
  enter: (direction: number) => ({
    x: direction > 0 ? 200 : -200,
    opacity: 0,
    scale: 0.97,
  }),
  center: {
    x: 0,
    opacity: 1,
    scale: 1,
  },
  exit: (direction: number) => ({
    x: direction > 0 ? -200 : 200,
    opacity: 0,
    scale: 0.97,
  }),
};

export function PlannerShell() {
  const router = useRouter();
  const [stepIndex, setStepIndex] = useState(0);
  const [direction, setDirection] = useState(1);
  const [form, setForm] = useState<FormState>(initialState);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const destinationHint = useMemo(() => {
    if (form.destinationIntent === "fixed")
      return "Enter a city or region you already want.";
    if (form.destinationIntent === "shortlist")
      return "List a few options, separated by commas.";
    return "Leave blank if you want the planner to choose from your taste profile.";
  }, [form.destinationIntent]);

  const canContinue = useMemo(() => {
    if (stepIndex === 0) return Boolean(form.provider && form.tripType);
    if (stepIndex === 1)
      return Boolean(form.startDate && form.endDate && form.destinationIntent);
    if (stepIndex === 2) return form.interests.length > 0;
    return true;
  }, [form, stepIndex]);

  const totalSteps = onboardingSteps.length;

  function buildPayload(): TripRequest {
    const shortlist =
      form.destinationIntent === "shortlist"
        ? form.destinationQuery
            .split(",")
            .map((item) => item.trim())
            .filter(Boolean)
        : [];

    return {
      provider: form.provider,
      travelerProfile: {
        tripType: form.tripType,
        startDate: form.startDate,
        endDate: form.endDate,
        dateFlexibility: form.dateFlexibility,
        destinationIntent: form.destinationIntent,
        destinationQuery: form.destinationQuery,
        budgetBand: form.budgetBand,
        splurgeTolerance: form.splurgeTolerance,
        pace: form.pace,
        interests: form.interests,
        constraints: form.constraintsNotes
          .split(",")
          .map((item) => item.trim())
          .filter(Boolean),
        constraintsNotes: form.constraintsNotes,
        lodgingStyle: form.lodgingStyle,
        neighborhoodVibe: form.neighborhoodVibe,
        mustHaves: form.mustHaves,
        hardNos: form.hardNos,
        loyaltyPrograms: form.loyaltyPrograms,
        surpriseTolerance: form.surpriseTolerance,
      },
      destinationContext: {
        destinationQuery: form.destinationQuery,
        shortlist,
      },
      constraints: form.constraintsNotes
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean),
      createdAt: new Date().toISOString(),
    };
  }

  function nextStep() {
    setDirection(1);
    setStepIndex((current) => Math.min(current + 1, totalSteps - 1));
  }

  function previousStep() {
    setDirection(-1);
    setStepIndex((current) => Math.max(current - 1, 0));
  }

  function submitPlan() {
    setError(null);
    const payload = buildPayload();

    startTransition(async () => {
      try {
        const response = await fetch("/api/trips", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });

        if (!response.ok) throw new Error("Planner request failed.");

        const data = (await response.json()) as { tripId: string };
        router.push(`/trip/${data.tripId}`);
      } catch (submissionError) {
        setError(
          submissionError instanceof Error
            ? submissionError.message
            : "Unable to generate trip."
        );
      }
    });
  }

  return (
    <div className="w-full max-w-lg">
      {/* Progress */}
      <div className="flex items-center gap-3 mb-6">
        <span className="text-xs font-semibold text-coral-light">
          Step {stepIndex + 1} of {totalSteps}
        </span>
        <div className="flex-1 h-1 bg-warm-600 rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-coral to-coral-light rounded-full transition-all duration-300"
            style={{ width: `${((stepIndex + 1) / totalSteps) * 100}%` }}
          />
        </div>
      </div>

      {/* Stacked Card Container */}
      <div className="relative">
        {/* Peeking card 2 (furthest back) */}
        <div className="hidden md:block absolute top-3 left-4 right-4 h-full bg-warm-600 rounded-2xl opacity-30" />
        {/* Peeking card 1 */}
        <div className="hidden md:block absolute top-1.5 left-2 right-2 h-full bg-warm-600 rounded-2xl opacity-50" />

        {/* Main card */}
        <div className="relative bg-cream rounded-2xl shadow-xl p-6 md:p-8 min-h-[420px] flex flex-col">
          <AnimatePresence mode="wait" custom={direction}>
            <motion.div
              key={stepIndex}
              custom={direction}
              variants={slideVariants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ duration: 0.25, ease: "easeInOut" }}
              className="flex-1"
            >
              {/* Step title */}
              <div className="mb-6">
                <div className="text-2xl mb-1">
                  {["🧭", "📅", "💰", "🚧", "🏨", "✅"][stepIndex]}
                </div>
                <h2 className="text-xl font-extrabold text-warm-900 mb-1">
                  {onboardingSteps[stepIndex].title}
                </h2>
                <p className="text-sm text-warm-400">
                  {onboardingSteps[stepIndex].description}
                </p>
              </div>

              {/* Step 0: Provider & Trip Type */}
              {stepIndex === 0 && (
                <div className="space-y-5">
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-widest text-warm-600 mb-2">
                      Model provider
                    </label>
                    <div className="grid grid-cols-2 gap-3">
                      {(["openai", "claude"] as const).map((provider) => (
                        <button
                          key={provider}
                          type="button"
                          onClick={() =>
                            setForm((c) => ({ ...c, provider }))
                          }
                          className={`text-left p-3 rounded-xl border-2 transition-all ${
                            provider === form.provider
                              ? "border-coral bg-coral-wash"
                              : "border-warm-100 bg-warm-50 hover:border-warm-400"
                          }`}
                        >
                          <div className="font-semibold text-warm-900 text-sm">
                            {provider === "openai" ? "OpenAI" : "Claude"}
                          </div>
                          <div className="text-xs text-warm-400 mt-0.5">
                            {providerCopy[provider]}
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-widest text-warm-600 mb-2">
                      Trip type
                    </label>
                    <div className="flex flex-wrap gap-2">
                      {(
                        ["solo", "couple", "family", "friends", "work", "mixed"] as const
                      ).map((tripType) => (
                        <button
                          key={tripType}
                          type="button"
                          onClick={() =>
                            setForm((c) => ({ ...c, tripType }))
                          }
                          className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${
                            tripType === form.tripType
                              ? "bg-coral text-white"
                              : "bg-warm-50 text-warm-600 border border-warm-100 hover:border-warm-400"
                          }`}
                        >
                          {tripType}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* Step 1: Dates & Destination */}
              {stepIndex === 1 && (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label
                        htmlFor="startDate"
                        className="block text-xs font-semibold uppercase tracking-widest text-warm-600 mb-2"
                      >
                        Start date
                      </label>
                      <input
                        id="startDate"
                        type="date"
                        value={form.startDate}
                        onChange={(e) =>
                          setForm((c) => ({
                            ...c,
                            startDate: e.target.value,
                          }))
                        }
                        className="w-full px-3 py-2.5 rounded-xl bg-warm-50 border border-warm-100 text-warm-900 text-sm focus:outline-none focus:border-coral focus:ring-1 focus:ring-coral/30"
                      />
                    </div>
                    <div>
                      <label
                        htmlFor="endDate"
                        className="block text-xs font-semibold uppercase tracking-widest text-warm-600 mb-2"
                      >
                        End date
                      </label>
                      <input
                        id="endDate"
                        type="date"
                        value={form.endDate}
                        onChange={(e) =>
                          setForm((c) => ({
                            ...c,
                            endDate: e.target.value,
                          }))
                        }
                        className="w-full px-3 py-2.5 rounded-xl bg-warm-50 border border-warm-100 text-warm-900 text-sm focus:outline-none focus:border-coral focus:ring-1 focus:ring-coral/30"
                      />
                    </div>
                  </div>
                  <div>
                    <label
                      htmlFor="dateFlexibility"
                      className="block text-xs font-semibold uppercase tracking-widest text-warm-600 mb-2"
                    >
                      Date flexibility
                    </label>
                    <textarea
                      id="dateFlexibility"
                      rows={2}
                      value={form.dateFlexibility}
                      onChange={(e) =>
                        setForm((c) => ({
                          ...c,
                          dateFlexibility: e.target.value,
                        }))
                      }
                      className="w-full px-3 py-2.5 rounded-xl bg-warm-50 border border-warm-100 text-warm-900 text-sm focus:outline-none focus:border-coral focus:ring-1 focus:ring-coral/30 resize-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-widest text-warm-600 mb-2">
                      Destination intent
                    </label>
                    <div className="flex flex-wrap gap-2">
                      {(
                        [
                          ["fixed", "I already know"],
                          ["shortlist", "I have a shortlist"],
                          ["help-me-choose", "Help me choose"],
                        ] as const
                      ).map(([value, label]) => (
                        <button
                          key={value}
                          type="button"
                          onClick={() =>
                            setForm((c) => ({
                              ...c,
                              destinationIntent: value,
                            }))
                          }
                          className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${
                            value === form.destinationIntent
                              ? "bg-coral text-white"
                              : "bg-warm-50 text-warm-600 border border-warm-100 hover:border-warm-400"
                          }`}
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <label
                      htmlFor="destinationQuery"
                      className="block text-xs font-semibold uppercase tracking-widest text-warm-600 mb-2"
                    >
                      Destination notes
                    </label>
                    <input
                      id="destinationQuery"
                      placeholder={
                        form.destinationIntent === "shortlist"
                          ? "Lisbon, Mexico City, Kyoto"
                          : "Lisbon"
                      }
                      value={form.destinationQuery}
                      onChange={(e) =>
                        setForm((c) => ({
                          ...c,
                          destinationQuery: e.target.value,
                        }))
                      }
                      className="w-full px-3 py-2.5 rounded-xl bg-warm-50 border border-warm-100 text-warm-900 text-sm focus:outline-none focus:border-coral focus:ring-1 focus:ring-coral/30 placeholder:text-warm-400"
                    />
                    <p className="text-xs text-warm-400 mt-1.5">
                      {destinationHint}
                    </p>
                  </div>
                </div>
              )}

              {/* Step 2: Budget, Pace, Interests */}
              {stepIndex === 2 && (
                <div className="space-y-5">
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-widest text-warm-600 mb-2">
                      Budget
                    </label>
                    <div className="grid grid-cols-3 gap-3">
                      {budgetOptions.map((opt) => (
                        <button
                          key={opt.value}
                          type="button"
                          onClick={() =>
                            setForm((c) => ({
                              ...c,
                              budgetBand: opt.value,
                            }))
                          }
                          className={`p-3 rounded-xl border-2 text-center transition-all ${
                            opt.value === form.budgetBand
                              ? "border-coral bg-coral-wash"
                              : "border-warm-100 hover:border-warm-400"
                          }`}
                        >
                          <div className="text-xl">{opt.icon}</div>
                          <div
                            className={`text-xs font-semibold mt-1 ${
                              opt.value === form.budgetBand
                                ? "text-coral"
                                : "text-warm-600"
                            }`}
                          >
                            {opt.label}
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <label
                      htmlFor="splurgeTolerance"
                      className="block text-xs font-semibold uppercase tracking-widest text-warm-600 mb-2"
                    >
                      Splurge tolerance
                    </label>
                    <input
                      id="splurgeTolerance"
                      max={100}
                      min={0}
                      type="range"
                      value={form.splurgeTolerance}
                      onChange={(e) =>
                        setForm((c) => ({
                          ...c,
                          splurgeTolerance: Number(e.target.value),
                        }))
                      }
                      className="w-full accent-coral"
                    />
                    <p className="text-xs text-warm-400 mt-1">
                      {form.splurgeTolerance}% willing to splurge for one
                      standout experience.
                    </p>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-widest text-warm-600 mb-2">
                      Trip pace
                    </label>
                    <div className="flex gap-2">
                      {(["relaxed", "balanced", "packed"] as const).map(
                        (pace) => (
                          <button
                            key={pace}
                            type="button"
                            onClick={() =>
                              setForm((c) => ({ ...c, pace }))
                            }
                            className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${
                              pace === form.pace
                                ? "bg-coral text-white"
                                : "bg-warm-50 text-warm-600 border border-warm-100 hover:border-warm-400"
                            }`}
                          >
                            {pace}
                          </button>
                        )
                      )}
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-widest text-warm-600 mb-2">
                      Interests
                    </label>
                    <div className="flex flex-wrap gap-2">
                      {interestOptions.map((interest) => (
                        <button
                          key={interest.value}
                          type="button"
                          onClick={() =>
                            setForm((c) => ({
                              ...c,
                              interests: toggleValue(
                                c.interests,
                                interest.value
                              ),
                            }))
                          }
                          className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                            form.interests.includes(interest.value)
                              ? "bg-coral text-white"
                              : "bg-warm-50 text-warm-600 border border-warm-100 hover:border-warm-400"
                          }`}
                        >
                          {interest.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* Step 3: Constraints */}
              {stepIndex === 3 && (
                <div className="space-y-4">
                  <div>
                    <label
                      htmlFor="constraints"
                      className="block text-xs font-semibold uppercase tracking-widest text-warm-600 mb-2"
                    >
                      Constraints and accessibility notes
                    </label>
                    <textarea
                      id="constraints"
                      rows={4}
                      value={form.constraintsNotes}
                      onChange={(e) =>
                        setForm((c) => ({
                          ...c,
                          constraintsNotes: e.target.value,
                        }))
                      }
                      className="w-full px-3 py-2.5 rounded-xl bg-warm-50 border border-warm-100 text-warm-900 text-sm focus:outline-none focus:border-coral focus:ring-1 focus:ring-coral/30 resize-none"
                    />
                  </div>
                  <div>
                    <label
                      htmlFor="mustHaves"
                      className="block text-xs font-semibold uppercase tracking-widest text-warm-600 mb-2"
                    >
                      Must-haves
                    </label>
                    <textarea
                      id="mustHaves"
                      rows={2}
                      value={form.mustHaves}
                      onChange={(e) =>
                        setForm((c) => ({
                          ...c,
                          mustHaves: e.target.value,
                        }))
                      }
                      className="w-full px-3 py-2.5 rounded-xl bg-warm-50 border border-warm-100 text-warm-900 text-sm focus:outline-none focus:border-coral focus:ring-1 focus:ring-coral/30 resize-none"
                    />
                  </div>
                  <div>
                    <label
                      htmlFor="hardNos"
                      className="block text-xs font-semibold uppercase tracking-widest text-warm-600 mb-2"
                    >
                      Hard no
                    </label>
                    <textarea
                      id="hardNos"
                      rows={2}
                      value={form.hardNos}
                      onChange={(e) =>
                        setForm((c) => ({
                          ...c,
                          hardNos: e.target.value,
                        }))
                      }
                      className="w-full px-3 py-2.5 rounded-xl bg-warm-50 border border-warm-100 text-warm-900 text-sm focus:outline-none focus:border-coral focus:ring-1 focus:ring-coral/30 resize-none"
                    />
                  </div>
                </div>
              )}

              {/* Step 4: Lodging & Vibe */}
              {stepIndex === 4 && (
                <div className="space-y-4">
                  <div>
                    <label
                      htmlFor="lodgingStyle"
                      className="block text-xs font-semibold uppercase tracking-widest text-warm-600 mb-2"
                    >
                      Lodging style
                    </label>
                    <input
                      id="lodgingStyle"
                      value={form.lodgingStyle}
                      onChange={(e) =>
                        setForm((c) => ({
                          ...c,
                          lodgingStyle: e.target.value,
                        }))
                      }
                      className="w-full px-3 py-2.5 rounded-xl bg-warm-50 border border-warm-100 text-warm-900 text-sm focus:outline-none focus:border-coral focus:ring-1 focus:ring-coral/30"
                    />
                  </div>
                  <div>
                    <label
                      htmlFor="neighborhoodVibe"
                      className="block text-xs font-semibold uppercase tracking-widest text-warm-600 mb-2"
                    >
                      Neighborhood vibe
                    </label>
                    <input
                      id="neighborhoodVibe"
                      value={form.neighborhoodVibe}
                      onChange={(e) =>
                        setForm((c) => ({
                          ...c,
                          neighborhoodVibe: e.target.value,
                        }))
                      }
                      className="w-full px-3 py-2.5 rounded-xl bg-warm-50 border border-warm-100 text-warm-900 text-sm focus:outline-none focus:border-coral focus:ring-1 focus:ring-coral/30"
                    />
                  </div>
                  <div>
                    <label
                      htmlFor="loyaltyPrograms"
                      className="block text-xs font-semibold uppercase tracking-widest text-warm-600 mb-2"
                    >
                      Loyalty programs
                    </label>
                    <input
                      id="loyaltyPrograms"
                      value={form.loyaltyPrograms}
                      onChange={(e) =>
                        setForm((c) => ({
                          ...c,
                          loyaltyPrograms: e.target.value,
                        }))
                      }
                      className="w-full px-3 py-2.5 rounded-xl bg-warm-50 border border-warm-100 text-warm-900 text-sm focus:outline-none focus:border-coral focus:ring-1 focus:ring-coral/30"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-widest text-warm-600 mb-2">
                      Surprise tolerance
                    </label>
                    <div className="flex gap-2">
                      {(
                        [
                          ["classic", "Safe and classic"],
                          ["balanced", "Balanced"],
                          ["explorer", "Surprise me"],
                        ] as const
                      ).map(([value, label]) => (
                        <button
                          key={value}
                          type="button"
                          onClick={() =>
                            setForm((c) => ({
                              ...c,
                              surpriseTolerance: value,
                            }))
                          }
                          className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${
                            value === form.surpriseTolerance
                              ? "bg-coral text-white"
                              : "bg-warm-50 text-warm-600 border border-warm-100 hover:border-warm-400"
                          }`}
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* Step 5: Profile Summary */}
              {stepIndex === 5 && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div className="bg-warm-50 rounded-xl p-4">
                    <p className="text-xs font-semibold uppercase tracking-widest text-warm-400 mb-2">
                      Profile snapshot
                    </p>
                    <p className="font-bold text-warm-900 text-sm">
                      {form.tripType} trip / {form.budgetBand}
                    </p>
                    <p className="text-sm text-warm-400 mt-1">
                      {form.startDate} to {form.endDate}
                    </p>
                    <p className="text-sm text-warm-400 mt-1">
                      {form.destinationIntent === "help-me-choose"
                        ? "Planner-led destination selection"
                        : form.destinationQuery || "Destination to be clarified"}
                    </p>
                  </div>
                  <div className="bg-warm-50 rounded-xl p-4">
                    <p className="text-xs font-semibold uppercase tracking-widest text-warm-400 mb-2">
                      Taste profile
                    </p>
                    <p className="text-sm text-warm-600">
                      {form.interests.join(", ")}
                    </p>
                    <p className="text-sm text-warm-400 mt-1">
                      {form.neighborhoodVibe}
                    </p>
                    <p className="text-sm text-warm-400 mt-1">
                      {form.lodgingStyle}
                    </p>
                  </div>
                  <div className="bg-warm-50 rounded-xl p-4 md:col-span-2">
                    <p className="text-xs font-semibold uppercase tracking-widest text-warm-400 mb-2">
                      Constraints
                    </p>
                    <p className="text-sm text-warm-600">
                      {form.constraintsNotes}
                    </p>
                    <p className="text-sm text-warm-400 mt-2">
                      <strong className="text-warm-600">Must-haves:</strong>{" "}
                      {form.mustHaves}
                    </p>
                    <p className="text-sm text-warm-400 mt-1">
                      <strong className="text-warm-600">Hard no:</strong>{" "}
                      {form.hardNos}
                    </p>
                  </div>
                </div>
              )}
            </motion.div>
          </AnimatePresence>

          {/* Error */}
          {error && (
            <p className="text-red-600 text-sm mt-4">{error}</p>
          )}

          {/* Navigation */}
          <div className="flex gap-3 mt-6 pt-4 border-t border-warm-100">
            <button
              type="button"
              disabled={stepIndex === 0 || isPending}
              onClick={previousStep}
              className="px-5 py-2.5 rounded-xl text-sm font-semibold text-warm-400 hover:text-warm-600 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              ← Back
            </button>
            {stepIndex < totalSteps - 1 ? (
              <button
                type="button"
                disabled={!canContinue || isPending}
                onClick={nextStep}
                className="flex-1 py-2.5 rounded-xl text-sm font-semibold bg-coral text-white hover:bg-coral-deep disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                Continue →
              </button>
            ) : (
              <button
                type="button"
                disabled={isPending}
                onClick={submitPlan}
                className="flex-1 py-2.5 rounded-xl text-sm font-semibold bg-coral text-white hover:bg-coral-deep disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                {isPending ? "Generating itinerary..." : "Generate trip →"}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Verify onboarding flow**

```bash
cd /Users/tylerxiao/Documents/ai-trip-planner && pnpm frontend:dev
```

Expected: Dark background, centered white card with peeking cards behind, slide animations between steps, all 6 steps render correctly with styled inputs, navigation works.

- [ ] **Step 4: Commit**

```bash
git add app/plan/page.tsx components/planner-shell.tsx
git commit -m "feat: redesign onboarding with dark bg, stacked cards, and framer-motion"
```

---

### Task 6: Redesign Trip Results — Day Tabs + Dashboard Toggle

**Files:**
- Create: `components/trip-results.tsx`
- Modify: `app/trip/[tripId]/page.tsx`

The results page needs client-side interactivity (tab switching, dashboard toggle), so we split it: server component fetches data, client component handles the UI.

- [ ] **Step 1: Create `components/trip-results.tsx`**

```tsx
"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import type { TripPlan, TripRequest } from "@/lib/types";

type Props = {
  plan: TripPlan;
  request: TripRequest;
};

const timeIcons: Record<string, string> = {
  morning: "🌅",
  afternoon: "☀️",
  evening: "🌙",
};

export function TripResults({ plan, request }: Props) {
  const [activeDay, setActiveDay] = useState(0);
  const [view, setView] = useState<"itinerary" | "dashboard">("itinerary");
  const [agentTraceOpen, setAgentTraceOpen] = useState(false);

  const day = plan.dailyItinerary[activeDay];
  const totalActivities = plan.dailyItinerary.length * 3;

  return (
    <div>
      {/* Gradient Hero */}
      <section className="bg-gradient-to-br from-warm-900 via-warm-600 to-coral-deep px-4 py-10 md:py-14 relative">
        <div className="max-w-3xl mx-auto">
          <div className="flex items-center justify-between mb-6">
            <Link
              href="/plan"
              className="text-sm text-white/60 hover:text-white/90 transition-colors"
            >
              ← Back to planning
            </Link>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() =>
                  setView(view === "itinerary" ? "dashboard" : "itinerary")
                }
                className="px-3 py-1.5 rounded-lg text-xs bg-white/10 text-white/80 hover:bg-white/20 transition-colors"
              >
                {view === "itinerary" ? "📋 Dashboard" : "🗺️ Itinerary"}
              </button>
            </div>
          </div>

          <h1 className="text-3xl md:text-4xl font-extrabold text-white mb-2">
            {plan.destinationSummary.title}
          </h1>
          <p className="text-white/70 mb-4 text-sm md:text-base">
            {plan.dailyItinerary.length} days ·{" "}
            {request.travelerProfile.budgetBand} ·{" "}
            {request.travelerProfile.interests.slice(0, 3).join(" & ")} focus
          </p>
          <div className="flex flex-wrap gap-2">
            {request.travelerProfile.interests.slice(0, 4).map((interest) => (
              <span
                key={interest}
                className="px-3 py-1 rounded-lg text-xs bg-white/15 text-white"
              >
                {interest}
              </span>
            ))}
          </div>

          {/* Claude badge */}
          <div className="absolute bottom-4 right-4 bg-warm-900 border border-warm-600 px-3 py-1 rounded-lg text-[10px] text-coral-light">
            Planned with Claude ✨
          </div>
        </div>
      </section>

      <div className="max-w-3xl mx-auto px-4 py-8">
        <AnimatePresence mode="wait">
          {view === "itinerary" ? (
            <motion.div
              key="itinerary"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
            >
              {/* Day Tabs */}
              <div className="flex gap-1 border-b border-warm-100 mb-6 overflow-x-auto">
                {plan.dailyItinerary.map((d, i) => (
                  <button
                    key={d.date}
                    type="button"
                    onClick={() => setActiveDay(i)}
                    className={`px-4 py-3 text-sm font-semibold whitespace-nowrap transition-colors ${
                      i === activeDay
                        ? "text-coral border-b-2 border-coral"
                        : "text-warm-400 hover:text-warm-600"
                    }`}
                  >
                    Day {i + 1}
                  </button>
                ))}
              </div>

              {/* Day Header */}
              {day && (
                <AnimatePresence mode="wait">
                  <motion.div
                    key={activeDay}
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -12 }}
                    transition={{ duration: 0.2 }}
                  >
                    <div className="flex items-center gap-3 mb-6">
                      <div className="w-8 h-8 bg-coral rounded-full flex items-center justify-center text-white font-bold text-sm shrink-0">
                        {activeDay + 1}
                      </div>
                      <h2 className="text-lg font-bold text-warm-900">
                        Day {activeDay + 1} — {day.dateLabel}
                      </h2>
                      <span className="text-xs text-warm-400 ml-auto">
                        {day.budgetEstimate}
                      </span>
                    </div>

                    {/* Activity Cards */}
                    <div className="space-y-3">
                      {(
                        [
                          ["morning", day.morning],
                          ["afternoon", day.afternoon],
                          ["evening", day.evening],
                        ] as const
                      ).map(([timeOfDay, block], blockIndex) => (
                        <motion.div
                          key={timeOfDay}
                          initial={{ opacity: 0, y: 16 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{
                            delay: blockIndex * 0.1,
                            duration: 0.25,
                          }}
                          className="flex gap-4 p-4 border border-warm-100 rounded-xl hover:shadow-md transition-shadow"
                        >
                          <div className="w-12 h-12 bg-coral-wash rounded-lg flex items-center justify-center text-xl shrink-0">
                            {timeIcons[timeOfDay]}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-[10px] font-semibold uppercase tracking-widest text-coral mb-0.5">
                              {timeOfDay}
                            </p>
                            <p className="font-bold text-warm-900 text-sm">
                              {block.title}
                            </p>
                            <p className="text-xs text-warm-400 mt-1 leading-relaxed">
                              {block.note}
                            </p>
                            <div className="flex gap-2 mt-2">
                              {block.reservationSuggested && (
                                <span className="text-[10px] px-2 py-0.5 bg-coral-wash text-coral-deep rounded">
                                  🔖 Reservation
                                </span>
                              )}
                            </div>
                          </div>
                        </motion.div>
                      ))}
                    </div>

                    {/* Transit notes */}
                    {day.transitNotes && (
                      <p className="text-xs text-warm-400 mt-4 pt-3 border-t border-dashed border-warm-100">
                        {day.transitNotes}
                      </p>
                    )}
                  </motion.div>
                </AnimatePresence>
              )}

              {/* Dining & Activities below itinerary */}
              <div className="mt-10 grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Lodging */}
                <div className="border border-warm-100 rounded-xl p-4">
                  <p className="text-xs font-semibold uppercase tracking-widest text-warm-400 mb-2">
                    🏨 Lodging
                  </p>
                  <p className="font-bold text-warm-900 text-sm">
                    {plan.lodgingRecommendation.name}
                  </p>
                  <p className="text-xs text-warm-400 mt-1">
                    {plan.lodgingRecommendation.neighborhood}
                  </p>
                  <p className="text-xs text-warm-400 mt-1">
                    {plan.lodgingRecommendation.reason}
                  </p>
                </div>

                {/* Top dining pick */}
                {plan.diningList[0] && (
                  <div className="border border-warm-100 rounded-xl p-4">
                    <p className="text-xs font-semibold uppercase tracking-widest text-warm-400 mb-2">
                      🍽️ Top Pick
                    </p>
                    <p className="font-bold text-warm-900 text-sm">
                      {plan.diningList[0].name}
                    </p>
                    <p className="text-xs text-warm-400 mt-1">
                      {plan.diningList[0].priceBand} · ⭐{" "}
                      {plan.diningList[0].rating}
                    </p>
                    <p className="text-xs text-warm-400 mt-1">
                      {plan.diningList[0].reasonToRecommend}
                    </p>
                  </div>
                )}
              </div>

              {/* All dining */}
              <div className="mt-6">
                <h3 className="text-sm font-bold text-warm-900 mb-3">
                  All Dining Recommendations
                </h3>
                <div className="space-y-2">
                  {plan.diningList.map((place) => (
                    <div
                      key={place.name}
                      className="flex items-center justify-between p-3 border border-warm-100 rounded-xl"
                    >
                      <div>
                        <p className="font-semibold text-warm-900 text-sm">
                          {place.name}
                        </p>
                        <p className="text-xs text-warm-400">
                          {place.reasonToRecommend}
                        </p>
                      </div>
                      <div className="text-right shrink-0 ml-4">
                        <p className="text-xs font-semibold text-coral">
                          ⭐ {place.rating}
                        </p>
                        <p className="text-[10px] text-warm-400">
                          {place.priceBand}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* All activities */}
              <div className="mt-6">
                <h3 className="text-sm font-bold text-warm-900 mb-3">
                  Activity Recommendations
                </h3>
                <div className="space-y-2">
                  {plan.activityList.map((place) => (
                    <div
                      key={place.name}
                      className="flex items-center justify-between p-3 border border-warm-100 rounded-xl"
                    >
                      <div>
                        <p className="font-semibold text-warm-900 text-sm">
                          {place.name}
                        </p>
                        <p className="text-xs text-warm-400">
                          {place.reasonToRecommend}
                        </p>
                      </div>
                      <div className="text-right shrink-0 ml-4">
                        <p className="text-xs font-semibold text-coral">
                          ⭐ {place.rating}
                        </p>
                        <p className="text-[10px] text-warm-400">
                          {place.category}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </motion.div>
          ) : (
            /* Dashboard View */
            <motion.div
              key="dashboard"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
            >
              {/* Stats */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
                <div className="bg-warm-50 rounded-xl p-4 text-center">
                  <div className="text-xl font-extrabold text-coral">
                    {plan.dailyItinerary.length}
                  </div>
                  <div className="text-xs text-warm-400">Days</div>
                </div>
                <div className="bg-warm-50 rounded-xl p-4 text-center">
                  <div className="text-xl font-extrabold text-coral">
                    {totalActivities}
                  </div>
                  <div className="text-xs text-warm-400">Activities</div>
                </div>
                <div className="bg-warm-50 rounded-xl p-4 text-center">
                  <div className="text-xl font-extrabold text-coral">
                    {plan.diningList.length}
                  </div>
                  <div className="text-xs text-warm-400">Restaurants</div>
                </div>
                <div className="bg-warm-50 rounded-xl p-4 text-center">
                  <div className="text-xl font-extrabold text-coral">
                    {request.travelerProfile.budgetBand === "lean"
                      ? "$"
                      : request.travelerProfile.budgetBand === "comfort"
                        ? "$$"
                        : "$$$"}
                  </div>
                  <div className="text-xs text-warm-400">Budget</div>
                </div>
              </div>

              {/* Compact day list */}
              <div className="space-y-2 mb-6">
                {plan.dailyItinerary.map((d, i) => (
                  <div
                    key={d.date}
                    className="flex items-center gap-3 p-3 bg-white border border-warm-100 rounded-xl"
                  >
                    <span className="text-sm font-bold text-coral w-12">
                      Day {i + 1}
                    </span>
                    <span className="text-sm font-semibold text-warm-900 flex-1">
                      {d.dateLabel}
                    </span>
                    <span className="text-xs text-warm-400">3 activities</span>
                  </div>
                ))}
              </div>

              {/* Lodging + Top Pick */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-6">
                <div className="border border-warm-100 rounded-xl p-4">
                  <p className="text-xs font-semibold uppercase tracking-widest text-warm-400 mb-2">
                    🏨 Lodging
                  </p>
                  <p className="font-bold text-warm-900 text-sm">
                    {plan.lodgingRecommendation.name}
                  </p>
                  <p className="text-xs text-warm-400 mt-1">
                    {plan.lodgingRecommendation.neighborhood} ·{" "}
                    {plan.lodgingRecommendation.reason}
                  </p>
                </div>
                {plan.diningList[0] && (
                  <div className="border border-warm-100 rounded-xl p-4">
                    <p className="text-xs font-semibold uppercase tracking-widest text-warm-400 mb-2">
                      🍽️ Top Pick
                    </p>
                    <p className="font-bold text-warm-900 text-sm">
                      {plan.diningList[0].name}
                    </p>
                    <p className="text-xs text-warm-400 mt-1">
                      ⭐ {plan.diningList[0].rating} ·{" "}
                      {plan.diningList[0].priceBand}
                    </p>
                  </div>
                )}
              </div>

              {/* Agent Trace Accordion */}
              <div className="border border-warm-100 rounded-xl overflow-hidden">
                <button
                  type="button"
                  onClick={() => setAgentTraceOpen(!agentTraceOpen)}
                  className="w-full flex items-center justify-between p-4 text-left hover:bg-warm-50 transition-colors"
                >
                  <span className="text-sm font-semibold text-warm-900">
                    🤖 Agent Trace
                  </span>
                  <span className="text-warm-400 text-xs">
                    {agentTraceOpen ? "▲" : "▼"}
                  </span>
                </button>
                {agentTraceOpen && (
                  <div className="border-t border-warm-100 p-4 space-y-3">
                    {plan.agentTrace.map((agent) => (
                      <div key={agent.name}>
                        <p className="text-xs font-semibold uppercase tracking-widest text-coral mb-1">
                          {agent.name}
                        </p>
                        <p className="text-xs text-warm-400">
                          {agent.summary}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Footer CTA */}
        <div className="mt-10 text-center">
          <Link
            href="/plan"
            className="inline-block bg-coral text-white px-6 py-3 rounded-xl font-semibold hover:bg-coral-deep transition-colors"
          >
            Plan another trip
          </Link>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Update `app/trip/[tripId]/page.tsx` to use TripResults**

```tsx
import { notFound } from "next/navigation";
import { getStoredTrip } from "@/lib/trip-store";
import { TripResults } from "@/components/trip-results";

export const dynamic = "force-dynamic";

export default async function TripPage({
  params,
}: {
  params: Promise<{ tripId: string }>;
}) {
  const { tripId } = await params;
  const stored = getStoredTrip(tripId);

  if (!stored) {
    notFound();
  }

  return <TripResults plan={stored.plan} request={stored.request} />;
}
```

- [ ] **Step 3: Verify results page**

```bash
cd /Users/tylerxiao/Documents/ai-trip-planner && pnpm frontend:dev
```

Expected: Go through full onboarding flow → submit → see results page with gradient hero, day tabs, staggered activity cards, toggle to dashboard view, agent trace accordion.

- [ ] **Step 4: Commit**

```bash
git add components/trip-results.tsx app/trip/\[tripId\]/page.tsx
git commit -m "feat: redesign trip results with day tabs, dashboard toggle, and animations"
```

---

### Task 7: Final Typecheck and Cleanup

**Files:**
- All modified files

- [ ] **Step 1: Run typecheck**

```bash
cd /Users/tylerxiao/Documents/ai-trip-planner && pnpm typecheck
```

Expected: No type errors. If there are errors, fix them.

- [ ] **Step 2: Run the dev server and test full flow**

```bash
cd /Users/tylerxiao/Documents/ai-trip-planner && pnpm frontend:dev
```

Manual test checklist:
- Homepage: gradient hero, search bar links to /plan, stats visible
- Onboarding: dark bg, card stack, all 6 steps, slide animations, submit works
- Results: gradient hero, day tabs work, activity cards animate, dashboard toggle works, agent trace accordion works
- 404: styled correctly
- Mobile: responsive at <768px (hero stacks, tabs scroll, peeking cards hidden)

- [ ] **Step 3: Commit any fixes**

```bash
git add -A
git commit -m "fix: address typecheck issues and final polish"
```
