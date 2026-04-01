"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { TripResults } from "@/components/trip-results";
import { getSavedTripById, type SavedTripSnapshot } from "@/lib/browser-saved-trips";

type Props = {
  snapshotId: string;
};

export function LocalTripPage({ snapshotId }: Props) {
  const [snapshot, setSnapshot] = useState<SavedTripSnapshot | null | undefined>(undefined);

  useEffect(() => {
    setSnapshot(getSavedTripById(snapshotId));
  }, [snapshotId]);

  if (snapshot === undefined) {
    return (
      <main className="min-h-screen bg-cream px-4 py-12">
        <div className="mx-auto max-w-2xl rounded-3xl border border-warm-100 bg-white p-8 text-center shadow-[0_20px_60px_rgba(26,22,20,0.08)]">
          <p className="text-sm text-warm-400">Loading saved trip...</p>
        </div>
      </main>
    );
  }

  if (!snapshot) {
    return (
      <main className="min-h-screen bg-cream px-4 py-12">
        <div className="mx-auto max-w-2xl rounded-3xl border border-warm-100 bg-white p-8 text-center shadow-[0_20px_60px_rgba(26,22,20,0.08)]">
          <h1 className="text-2xl font-extrabold text-warm-900">Saved trip not found</h1>
          <p className="mt-3 text-sm text-warm-400">
            This browser does not have a local copy for that itinerary anymore.
          </p>
          <Link
            href="/plan"
            className="mt-6 inline-block rounded-xl bg-coral px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-coral-deep"
          >
            Back to planner
          </Link>
        </div>
      </main>
    );
  }

  return <TripResults plan={snapshot.plan} request={snapshot.request} tripId={snapshot.tripId} isLocalCopy />;
}
