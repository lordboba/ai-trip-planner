import Link from "next/link";
import { notFound } from "next/navigation";
import { getStoredTrip } from "@/lib/trip-store";

export const dynamic = "force-dynamic";

export default async function TripPage({ params }: { params: Promise<{ tripId: string }> }) {
  const { tripId } = await params;
  const stored = getStoredTrip(tripId);

  if (!stored) {
    notFound();
  }

  const { plan, request } = stored;

  return (
    <main className="page-shell results-shell">
      <section className="results-hero">
        <div>
          <p className="eyebrow">Generated itinerary</p>
          <h1>{plan.destinationSummary.title}</h1>
          <p className="hero-body">{plan.destinationSummary.overview}</p>
        </div>
        <div className="results-badges">
          <span>{request.provider === "openai" ? "OpenAI path" : "Claude path"}</span>
          <span>{request.travelerProfile.tripType}</span>
          <span>{request.travelerProfile.budgetBand}</span>
        </div>
      </section>

      <section className="results-grid">
        <article className="info-card highlight-card">
          <p className="card-kicker">Stay</p>
          <h2>{plan.lodgingRecommendation.name}</h2>
          <p>{plan.lodgingRecommendation.neighborhood}</p>
          <p>{plan.lodgingRecommendation.reason}</p>
        </article>

        <article className="info-card">
          <p className="card-kicker">Share summary</p>
          <p>{plan.shareSummary}</p>
          <div className="link-list compact-links">
            {plan.bookingLinks.map((link) => (
              <a href={link.url} key={link.label} target="_blank" rel="noreferrer">
                {link.label}
              </a>
            ))}
          </div>
        </article>
      </section>

      <section className="trip-columns">
        <article className="column-card itinerary-column">
          <div className="section-heading">
            <p className="eyebrow">Itinerary</p>
            <h2>Day-by-day plan</h2>
          </div>
          {plan.dailyItinerary.map((day) => (
            <div className="day-card" key={day.date}>
              <div className="day-header">
                <h3>{day.dateLabel}</h3>
                <span>{day.budgetEstimate}</span>
              </div>
              <div className="day-blocks">
                <div>
                  <p className="block-label">Morning</p>
                  <strong>{day.morning.title}</strong>
                  <p>{day.morning.note}</p>
                </div>
                <div>
                  <p className="block-label">Afternoon</p>
                  <strong>{day.afternoon.title}</strong>
                  <p>{day.afternoon.note}</p>
                </div>
                <div>
                  <p className="block-label">Evening</p>
                  <strong>{day.evening.title}</strong>
                  <p>{day.evening.note}</p>
                </div>
              </div>
              <p className="muted-line">{day.transitNotes}</p>
            </div>
          ))}
        </article>

        <article className="column-card">
          <div className="section-heading">
            <p className="eyebrow">Recommendations</p>
            <h2>Dining and activities</h2>
          </div>
          <div className="recommendation-stack">
            {plan.diningList.map((place) => (
              <div className="mini-card" key={place.name}>
                <div className="mini-card-head">
                  <h3>{place.name}</h3>
                  <span>{place.priceBand}</span>
                </div>
                <p>{place.reasonToRecommend}</p>
                <small>{place.reviewSnippets[0]}</small>
              </div>
            ))}
          </div>
          <div className="recommendation-stack second-stack">
            {plan.activityList.map((place) => (
              <div className="mini-card" key={place.name}>
                <div className="mini-card-head">
                  <h3>{place.name}</h3>
                  <span>{place.category}</span>
                </div>
                <p>{place.reasonToRecommend}</p>
                <small>{place.reviewSnippets[0]}</small>
              </div>
            ))}
          </div>
        </article>
      </section>

      <section className="grid-section agent-grid">
        {plan.agentTrace.map((agent) => (
          <article className="info-card" key={agent.name}>
            <p className="card-kicker">{agent.name}</p>
            <p>{agent.summary}</p>
          </article>
        ))}
      </section>

      <div className="footer-actions">
        <Link className="primary-link" href="/plan">
          Plan another trip
        </Link>
      </div>
    </main>
  );
}
