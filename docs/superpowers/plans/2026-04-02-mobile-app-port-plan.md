# Mobile App Port Plan (Monorepo)

## 1) Objective

Create a native mobile app port of the existing website in this monorepo, preserving core user journeys while adding:

1. A notification coordination tool (campaigns, transactional events, and user-level controls).
2. A mobile home-screen widget with interactive buttons that can adjust a planned trip and trigger backend API calls.

---

## 2) Product Scope

### In Scope (v1)

- iOS + Android mobile app shell and feature parity for critical website flows.
- Authentication/session continuity with backend.
- Mobile-optimized onboarding.
- Notification orchestration module (client + backend contracts).
- Interactive widget for trip actions:
  - View upcoming/planned trip snapshot.
  - Buttons for common trip adjustments (time, route preference, pause/resume, cancel).
  - Secure API calls to backend when widget buttons are tapped.

### Out of Scope (v1)

- Full redesign of existing web business logic.
- Large-scale recommendation/ranking algorithm changes.
- Multi-widget experiences beyond one high-value widget.
- Offline trip mutation conflict resolution beyond basic retry.

---

## 3) Proposed Monorepo Structure

```text
/apps
  /web                      # Existing web app
  /mobile                   # New React Native / Expo app
/packages
  /api-client               # Shared typed backend client
  /ui                       # Shared design tokens/components where possible
  /domain                   # Shared TS types/schemas (zod)
  /notifications            # Shared notification contracts/utilities
/docs
  mobile-app-port-plan.md   # This plan (or keep this file at repo root)
```

Notes:
- Keep backend contracts in shared packages to reduce drift.
- Keep platform-specific code isolated in `apps/mobile`.

---

## 4) Mobile Architecture

### Framework

- React Native with Expo (recommended for speed), unless existing org standards require bare RN.

### Layers

1. **Presentation layer**: Screens, navigation, widget config UI.
2. **Application layer**: Use-cases (plan trip, adjust trip, register notification topics).
3. **Data layer**: API client, local cache, secure token store.
4. **Integration layer**:
   - Push provider integration (APNs/FCM via Expo Notifications or native bridge).
   - Widget bridge (iOS WidgetKit + Android App Widget/Glance).

### Shared Contracts

- All request/response payloads validated with shared Zod schemas.
- Versioned API routes for widget actions to protect backward compatibility.

---

## 5) Feature Plan

## 5.1 Core Website Parity in Mobile

- Port top journeys first (read-only + high-conversion actions).
- Reuse backend endpoints; avoid parallel “mobile-only” logic unless absolutely needed.
- Add analytics events to compare web vs mobile funnel completion.

## 5.2 Onboarding (Mobile-First)

### Goals

- Fast first-run activation.
- Permission requests only with context.
- Clear value proposition before asking for push/widget permissions.

### Suggested Steps

1. Welcome + value summary.
2. Sign-in/sign-up.
3. Profile and preference capture needed for trip behavior.
4. Push notification soft prompt -> OS prompt.
5. Widget intro card (benefits + “Add widget” deep link/tutorial).
6. Success state with first actionable CTA.

### Success Metrics

- Onboarding completion rate.
- Push opt-in rate.
- Widget activation rate within first 24h.

## 5.3 Notification Coordination Tool

### Capability

- Centralized coordination for:
  - Transactional trip updates.
  - Reminder nudges.
  - User-configurable notification categories and quiet hours.

### Components

- **Mobile settings UI** for toggles and schedule preferences.
- **Backend preference endpoint** to persist categories/quiet windows.
- **Event router** mapping backend trip events -> notification templates/channels.
- **Idempotency keys** to avoid duplicate sends.

### Minimum API Surface

- `GET /v1/notification-preferences`
- `PUT /v1/notification-preferences`
- `POST /v1/device-tokens/register`
- `POST /v1/device-tokens/unregister`

## 5.4 Widget with Trip Adjustment Buttons

### Widget Use Case

From home screen, user can quickly adjust a planned trip without opening full app.

### Widget Actions (v1)

- **Delay trip** (+5 / +10 minutes).
- **Advance trip** (-5 minutes where valid).
- **Toggle route mode** (fastest ↔ eco or configured alternatives).
- **Pause/Resume trip notifications**.
- **Cancel trip** (confirmation-safe flow).

### Technical Flow

1. Widget button tap triggers app intent / broadcast handler.
2. Handler validates auth/session and constructs signed request.
3. Call backend trip adjustment endpoint.
4. Backend returns updated trip state.
5. Widget timeline/state refreshes to reflect latest plan.
6. Optional confirmation notification shown to user.

### Widget API Endpoints (example)

- `POST /v1/trips/{tripId}/adjust-time`
- `POST /v1/trips/{tripId}/adjust-route`
- `POST /v1/trips/{tripId}/notification-state`
- `POST /v1/trips/{tripId}/cancel`

### Security Requirements

- Short-lived auth token for widget-triggered actions.
- Device binding for sensitive actions.
- Rate limiting + replay protection.
- Audit log for all widget action calls.

---

## 6) Delivery Phases

## Phase 0 — Discovery (1–2 weeks)

- Confirm top journeys for parity.
- Audit existing backend endpoints for mobile readiness.
- Define shared schema package boundaries.
- Finalize widget-supported trip actions and edge cases.

## Phase 1 — Foundations (2–3 weeks)

- Scaffold `apps/mobile`.
- Set up navigation, theming, auth/session, API client.
- Add telemetry and error reporting.

## Phase 2 — Core Parity + Onboarding (2–4 weeks)

- Implement priority screens.
- Deliver onboarding flow with guarded permission prompts.
- Add feature flags for staged rollout.

## Phase 3 — Notifications Coordination (2–3 weeks)

- Build settings UI + backend preference persistence.
- Register/unregister device tokens.
- Ship transactional notification routing for trip lifecycle.

## Phase 4 — Widget + Interactive Trip Controls (3–5 weeks)

- Implement iOS + Android widget baseline.
- Add interactive buttons and backend integration.
- Add state refresh and failure recovery UX.

## Phase 5 — Hardening + Launch (1–2 weeks)

- Load/performance tests for notification and widget action APIs.
- Security review (token handling, replay safety, abuse prevention).
- Beta rollout, monitor, and production release.

---

## 7) QA & Test Strategy

- Unit tests for domain logic and schema validation.
- Contract tests for shared API payloads.
- E2E tests for:
  - Onboarding completion.
  - Push opt-in + preference updates.
  - Widget button -> backend action -> UI/widget refresh.
- Manual matrix across iOS/Android versions for widget behavior.
- Chaos cases: network loss, stale tokens, duplicate taps.

---

## 8) Observability & Metrics

- Funnel: install -> onboarding complete -> trip planned -> widget enabled.
- Notification metrics: delivered, opened, acted upon, muted.
- Widget metrics: impressions, action taps, success/failure rate, latency.
- Reliability SLOs:
  - 99.9% success for trip-adjust APIs.
  - p95 widget action response under agreed threshold (e.g., <800ms backend processing).

---

## 9) Risks & Mitigations

- **Risk:** Widget platform differences increase complexity.  
  **Mitigation:** Start with shared action model + thin platform adapters.

- **Risk:** Notification fatigue from poor coordination.  
  **Mitigation:** User controls, quiet hours, and frequency caps.

- **Risk:** Insecure widget-triggered mutations.  
  **Mitigation:** Short-lived tokens, signed requests, replay protection, audit trails.

- **Risk:** Backend not ready for low-latency action calls.  
  **Mitigation:** Pre-launch performance testing and endpoint hardening.

---

## 10) Launch Checklist

- [ ] Mobile app parity for agreed critical journeys.
- [ ] Onboarding live with measured conversion baselines.
- [ ] Notification preference center and token lifecycle complete.
- [ ] Widget shipped with trip adjustment actions.
- [ ] Security controls validated.
- [ ] Dashboards and alerts configured.
- [ ] Staged rollout + rollback plan documented.

---

## 11) Open Decisions

1. Expo-managed vs bare React Native for widget requirements and native flexibility.
2. Exact set of trip adjustments permitted from widget in v1.
3. Whether destructive widget actions (trip cancel) require app-open confirmation.
4. Notification provider strategy (Expo-only vs direct APNs/FCM abstraction).
5. Data retention policy for notification events and widget action audits.
