import { cookies } from "next/headers";
import { HomeHero } from "@/components/home-hero";
import { ACCESS_COOKIE_NAME, hasValidAccessCookie, isAccessGateEnabled } from "@/lib/access-gate";

const stats = [
  { value: "6", label: "AI Agents" },
  { value: "50+", label: "Destinations" },
  { value: "4.8★", label: "Avg Rating" },
];

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const cookieStore = await cookies();
  const gateEnabled = isAccessGateEnabled();
  const isUnlocked = await hasValidAccessCookie(cookieStore.get(ACCESS_COOKIE_NAME)?.value);
  const { next } = await searchParams;

  return (
    <main className="min-h-screen">
      {/* Gradient Hero */}
      <section className="bg-gradient-to-br from-warm-900 via-warm-600 to-coral-deep px-4 py-24 md:py-32 text-center">
        <HomeHero gateEnabled={gateEnabled} isUnlocked={isUnlocked} nextPath={next} />
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
