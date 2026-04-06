import Link from "next/link";

export default function NotFound() {
  return (
    <main className="min-h-screen bg-cream flex items-center justify-center px-4">
      <div className="max-w-md text-center">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-warm-400 mb-3">
          Trip not found
        </p>
        <h1 className="text-3xl font-extrabold text-warm-900 mb-3">
          This itinerary could not be found.
        </h1>
        <p className="text-warm-400 mb-6">
          The trip may have expired, been deleted, or failed to persist. Generate a fresh plan from the onboarding flow.
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
