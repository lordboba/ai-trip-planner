import Link from "next/link";

const promisePoints = [
  "Long onboarding that earns better recommendations.",
  "Provider-neutral orchestration for OpenAI and Claude agents.",
  "Review-aware trip plans that explain why each pick fits.",
];

const sections = [
  {
    title: "Concierge-like intake",
    copy: "A guided, high-signal onboarding flow inspired by Cal AI, shortened for travel and tuned for taste, budget, pace, and constraints.",
  },
  {
    title: "Subagents with a shared brief",
    copy: "Destination, lodging, food, activities, and budget agents work from the same typed request before the coordinator assembles the final plan.",
  },
  {
    title: "Review-backed recommendations",
    copy: "Yelp-first restaurant sentiment, a second location source for coverage, and recommendation text that reflects the traveler instead of generic ranking.",
  },
];

export default function HomePage() {
  return (
    <main className="page-shell">
      <section className="hero-panel">
        <div className="hero-copy">
          <p className="eyebrow">Atlas Prototype / Website MVP</p>
          <h1>Trips shaped like a field note, not a spreadsheet.</h1>
          <p className="hero-body">
            This phase-one website prototype turns a long-form onboarding into a shareable itinerary, with a mock coordinator that already models the OpenAI and Claude split you want for production.
          </p>
          <div className="hero-actions">
            <Link className="primary-link" href="/plan">
              Start Planning
            </Link>
            <a className="secondary-link" href="#architecture">
              See the flow
            </a>
          </div>
        </div>
        <div className="hero-card stack-card">
          <p className="card-label">What this skeleton proves</p>
          <ul className="promise-list">
            {promisePoints.map((point) => (
              <li key={point}>{point}</li>
            ))}
          </ul>
          <div className="stamp-row">
            <span>OpenAI</span>
            <span>Claude</span>
            <span>Yelp-ready</span>
          </div>
        </div>
      </section>

      <section className="grid-section">
        {sections.map((section) => (
          <article className="info-card" key={section.title}>
            <p className="card-kicker">System layer</p>
            <h2>{section.title}</h2>
            <p>{section.copy}</p>
          </article>
        ))}
      </section>

      <section className="architecture-band" id="architecture">
        <div>
          <p className="eyebrow">End-to-end skeleton</p>
          <h2>Website-first now, mobile-ready later.</h2>
        </div>
        <div className="timeline-card">
          <div>
            <span className="timeline-dot" />
            <strong>1.</strong>
            <p>Long onboarding captures traveler signal.</p>
          </div>
          <div>
            <span className="timeline-dot" />
            <strong>2.</strong>
            <p>Mock coordinator normalizes the request and simulates subagent output.</p>
          </div>
          <div>
            <span className="timeline-dot" />
            <strong>3.</strong>
            <p>Results page renders lodging, dining, itinerary, and agent rationale.</p>
          </div>
        </div>
      </section>
    </main>
  );
}
