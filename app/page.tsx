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
            Personalized itineraries backed by real reviews from Yelp and local sources
          </p>
        </div>
      </section>
    </main>
  );
}
