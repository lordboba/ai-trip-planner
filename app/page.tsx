import { cookies } from "next/headers";
import { HomeHero } from "@/components/home-hero";
import { ACCESS_COOKIE_NAME, hasValidAccessCookie, isAccessGateEnabled } from "@/lib/access-gate";

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
      <section className="bg-gradient-to-br from-warm-900 via-warm-600 to-coral-deep px-6 py-32 md:py-44 text-center">
        <HomeHero gateEnabled={gateEnabled} isUnlocked={isUnlocked} nextPath={next} />
      </section>
    </main>
  );
}
