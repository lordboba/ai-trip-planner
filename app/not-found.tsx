import Link from "next/link";

export default function NotFound() {
  return (
    <main className="page-shell not-found-shell">
      <div className="info-card not-found-card">
        <p className="eyebrow">Trip not found</p>
        <h1>This mock itinerary is no longer in memory.</h1>
        <p>Generate a fresh plan from the onboarding flow.</p>
        <Link className="primary-link" href="/plan">
          Build a new trip
        </Link>
      </div>
    </main>
  );
}
