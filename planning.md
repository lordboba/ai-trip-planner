# AI Trip Planner Hackathon Plan

## Summary

This document defines the product direction and implementation brief for an AI trip planner that supports both OpenAI- and Claude-backed custom agents. The target end state is a production-deployed app that uses coordinated subagents to build personalized trips around a traveler's needs, constraints, and taste.

For the hackathon, the priority is a fast, polished, end-to-end demo rather than scale. "End to end" here means onboarding, preference capture, trip generation, review analysis, itinerary assembly, and booking or maps handoff links. It does not include direct booking transactions.

The recommended MVP path is a responsive website first, with a mobile app as a phase 2 client on top of the same backend and agent orchestration layer.

## 1. Vision

The product is a personalized AI trip planner that asks enough questions up front to understand the traveler, then uses coordinated subagents to build a trip plan that feels tailored rather than generic.

### User promise

- Users complete a "long onboarding" inspired by Cal AI, but shorter and more travel-specific.
- The system learns preferences once, then generates destination, neighborhood, hotel, food, activity, and pacing recommendations that fit the traveler.
- Agents analyze reviews, reconcile tradeoffs, and explain why specific choices fit this traveler instead of just listing highly rated places.

The product should feel like a thoughtful travel concierge, not a generic itinerary generator.

## 2. Product Options

| Dimension | Website MVP | Mobile App MVP |
| --- | --- | --- |
| Primary stack | `Next.js` + `TypeScript` + `Tailwind` + server actions or API routes | `Expo` + `React Native` + shared TypeScript API/backend |
| Strength for hackathon | Fastest to build, easiest to demo, simplest to deploy, fastest iteration on onboarding | Better long-term trip companion experience for travelers on the go |
| UX fit | Excellent for a longer onboarding flow and polished results pages | Strong for in-trip use, saved itineraries, notifications, and location-aware experiences |
| Distribution | Instant URL sharing with judges and users | Requires simulator or device testing and more demo logistics |
| Operational overhead | Lowest overhead, easiest Vercel deployment path | Higher overhead across auth, device testing, and build or release flow |
| Recommendation | Best first client for MVP | Best follow-on client after backend is stable |

### Website option

- Use `Next.js` with `TypeScript` and `Tailwind`.
- Implement backend behavior with server actions or API routes.
- Treat responsive mobile web as a first-class requirement so the demo works well on phones.
- Use this option to move fastest on onboarding, trip results, and production deployment on Vercel.

### Mobile app option

- Use `Expo` and `React Native`.
- Share the same backend contracts, trip schemas, and orchestration layer used by the website.
- Position this as the stronger long-term travel companion, especially once itinerary viewing, saved trips, and live travel utilities matter.
- Do not make this the first hackathon build because auth, iteration speed, release flow, and device testing will slow execution.

### Recommendation

- **Recommended MVP path: website first**
- Mobile app becomes phase 2 and reuses the same backend and agent orchestration layer.

## 3. User Experience

The onboarding should be longer than a typical travel app but still finish in a few minutes. The goal is to collect enough signal to produce a great trip without overwhelming the user.

### Onboarding design

- Target 8-10 screens with a clear progress indicator.
- Use adaptive follow-up questions only when an answer is ambiguous or materially affects planning quality.
- End with a profile summary confirmation step before generating the trip.
- Preserve a premium, guided feel similar to Cal AI's "long onboarding" model, but keep the sequence focused on travel outcomes.

### Required onboarding topics

1. Trip type: solo, couple, family, friends, work, mixed.
2. Dates or date flexibility.
3. Budget range and splurge tolerance.
4. Destination intent: fixed destination, shortlist, or "help me choose."
5. Preferred pace: relaxed, balanced, packed.
6. Interests: food, nightlife, nature, culture, shopping, wellness, adventure, family-friendly, hidden gems.
7. Hard constraints: dietary, accessibility, mobility, age constraints, pet needs, visa or transport limits.
8. Lodging style: hotel, boutique, hostel, Airbnb-style, luxury, budget.
9. Neighborhood vibe: central, quiet, trendy, local, walkable, scenic.
10. Must-have and hard-no preferences.
11. Optional loyalty programs or travel brands.
12. Surprise tolerance: safe or classic versus exploratory.

### UX behavior requirements

- Follow-up questions should appear only when needed to clarify high-impact ambiguity.
- Every answer should map into a normalized traveler profile rather than staying as loose text.
- The final profile summary should let the user confirm or edit key preferences before planning starts.
- The results page should feel editorial and explainable, not like a raw JSON dump.

### Output of onboarding

The onboarding produces a normalized traveler profile that becomes the shared input for all downstream agents.

## 4. Agent System

The app should use a shared provider abstraction so the same orchestration flow can run on OpenAI or Claude with minimal differences at the product layer.

### Core interfaces

#### `LLMProviderAdapter`

Common adapter interface that wraps model invocation for OpenAI and Anthropic with a shared shape for messages, tools, and structured outputs.

#### `TripRequest`

Normalized request object containing traveler profile, trip dates or date flexibility, destination context, hard constraints, budget guardrails, and planning metadata.

#### `PlaceCandidate`

Normalized place record containing source, category, rating, price band, review snippets, latitude or longitude, reason to recommend, and tags derived from review analysis.

#### `ItineraryDay`

Daily itinerary record containing date, morning block, afternoon block, evening block, transit notes, reservation flags, and budget estimate.

#### `TripPlan`

Final planner output containing destination summary, neighborhood and lodging recommendation, day-by-day itinerary, dining recommendations, activity recommendations, trip rationale, and booking or maps handoff links.

### Subagent layout

- `Profile Agent`: converts onboarding responses into a structured traveler profile and resolves missing or conflicting preferences.
- `Destination Agent`: proposes or validates destinations and neighborhoods based on taste, constraints, budget, and seasonality assumptions.
- `Lodging Agent`: recommends where to stay and explains the lodging and neighborhood fit.
- `Food & Reviews Agent`: fetches Yelp and secondary review data, summarizes sentiment, and ranks food, nightlife, and local business candidates.
- `Activities Agent`: finds attractions, experiences, and day-structure options that match pace and interests.
- `Itinerary Agent`: assembles recommendations into a coherent day-by-day plan with logical geographic flow.
- `Budget Agent`: checks the draft itinerary against the stated budget and flags conflicts or expensive choices.
- `Coordinator Agent`: orchestrates subagents, resolves disagreements, and emits the final `TripPlan`.

### Provider behavior

- Provider choice should be runtime-configurable per request or environment.
- The user experience must remain identical whether the request runs on OpenAI or Claude.
- Provider adapters should be swappable without changing onboarding, schemas, or UI contracts.

## 5. Review and Location Data Strategy

The planner should use external review and place data so recommendations are grounded in real-world signals rather than only model priors.

### Default source strategy

- **Primary review source for food, nightlife, and local businesses: Yelp Fusion API**
- **Secondary or fallback source for hotels, attractions, and broader international coverage: Google Places API**
- If Google Places is too heavy on cost or setup during the hackathon, evaluate **Foursquare** as the lighter alternative

### Why this combination

- Yelp is strong for restaurant and nightlife sentiment and often has richer opinionated review language.
- Yelp is weaker as a universal travel source, especially for hotels, attractions, and some non-US or lower-coverage markets.
- A second source reduces blind spots and lets the system compare consensus or contradictions across providers.

### Review-analysis requirements

- Agents must extract recurring positives and negatives from review text.
- Agents must detect mismatches with traveler preferences, such as a highly rated restaurant being too loud for a quiet traveler.
- Agents must prioritize explainable recommendations over raw star sorting.
- Final recommendations should explicitly say why a place fits this traveler.
- Review providers must normalize into a shared `PlaceCandidate` shape before ranking.

## 6. Hackathon Architecture

The hackathon version should use a production-capable but lightweight architecture. The objective is fast delivery with clean contracts, not premature scale work.

### Recommended stack

- Frontend: `Next.js`
- Backend: Next.js API routes or a thin Node service in the same repo
- Database: `Supabase Postgres`
- Auth: magic link or guest mode for demo, with user accounts optional
- Deployment: `Vercel`
- Background work: simple async job pattern or queue-lite approach only if needed
- Observability: basic logs and error tracking, not full-scale infrastructure

### Architectural principles

- Prefer managed services over custom infrastructure.
- Use structured schemas and typed outputs to keep agent coordination stable.
- Keep the agent orchestration layer provider-neutral.
- Focus engineering effort on onboarding quality, recommendation quality, and polished trip output.

### Suggested system shape

- Web client collects onboarding answers and displays trip results.
- Backend persists trip requests, orchestrates subagents, and normalizes external API results.
- Database stores user profiles, trip requests, generated plans, and cached place results where useful.
- External APIs provide location and review grounding.
- LLM provider adapter routes each run to OpenAI or Claude.

## 7. Scope Boundaries

### MVP includes

- Onboarding flow
- Provider-neutral agent orchestration
- Destination suggestion or validation
- Review-backed place recommendations
- Daily trip plan generation
- Shareable trip summary
- External booking or maps handoff links

### Explicit non-goals for the hackathon

- Full booking transactions
- Real-time pricing guarantees
- Large-scale personalization memory
- Complex collaboration features
- Offline mode
- Multi-region infrastructure

The MVP should feel complete for a demo while staying intentionally narrow.

## 8. Milestones

1. Set up the provider abstraction and shared trip schemas.
2. Build onboarding and traveler-profile persistence.
3. Integrate Yelp and the secondary place source.
4. Implement subagent orchestration and itinerary generation.
5. Ship a polished results page with booking and maps handoff links.
6. Deploy the website MVP.
7. If time remains, package the same backend for Expo and mobile.

## Public APIs and Interface Contracts

These decisions should be fixed early so later implementation does not improvise incompatible contracts.

- One provider-agnostic orchestration layer supports both OpenAI and Claude.
- All subagents consume normalized `TripRequest` input and return structured JSON-like outputs.
- Review providers normalize into a shared `PlaceCandidate` shape before ranking.
- Final planner output must conform to `TripPlan`.
- Provider adapters are swappable without changing onboarding, database schema, or UI contracts.

## Test Cases and Acceptance Criteria

The MVP should be considered successful when the following scenarios work:

- A user with a fixed destination and clear preferences receives a full itinerary with explainable recommendations.
- A user without a destination receives destination suggestions before itinerary generation.
- Quiet or budget-sensitive users are not routed to loud or premium options unless they explicitly opt in.
- If Yelp has sparse coverage or fails, the app falls back to the secondary location source.
- OpenAI-backed and Claude-backed runs both succeed through the same orchestration flow.
- Onboarding can be completed in a few minutes without feeling shallow.
- The final trip plan is shareable, coherent, and production-demo ready.

## Assumptions and Defaults

- Default recommendation is **website first**, not mobile first.
- Mobile remains a serious product option, but not the primary hackathon build.
- The MVP uses managed services and avoids custom infrastructure.
- "End to end" includes planning and booking handoff, not direct bookings.
- Yelp is included, but a secondary location or review source is required for coverage gaps.
- Immediate scale is out of scope; demo quality and personalization depth are the priorities.

## Recommended Next Step

1. Define TypeScript schemas for `TripRequest`, `PlaceCandidate`, `ItineraryDay`, and `TripPlan`.
2. Implement the provider abstraction for OpenAI and Anthropic.
3. Build the onboarding flow and save the traveler profile.
4. Add Yelp plus a secondary location source.
5. Wire the coordinator and subagents to generate the first demo itinerary.
