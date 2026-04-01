"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

type Props = {
  gateEnabled: boolean;
  isUnlocked: boolean;
  nextPath?: string;
};

export function HomeHero({ gateEnabled, isUnlocked, nextPath }: Props) {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function submitCode() {
    setError(null);

    startTransition(async () => {
      try {
        const response = await fetch("/api/access/verify", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ code }),
        });

        if (!response.ok) {
          const data = (await response.json().catch(() => null)) as { error?: string } | null;
          throw new Error(data?.error ?? "Access code check failed.");
        }

        router.push(nextPath || "/plan");
        router.refresh();
      } catch (gateError) {
        setError(gateError instanceof Error ? gateError.message : "Access code check failed.");
      }
    });
  }

  const shouldShowGate = gateEnabled && !isUnlocked;

  return (
    <>
      <p className="text-xs font-semibold uppercase tracking-[0.25em] text-coral-light mb-6">
        Work trips, unlocked
      </p>
      <h1 className="max-w-md mx-auto text-3xl md:text-5xl font-extrabold text-white mb-6 leading-[1.15]">
        Hidden gems between your meetings.
      </h1>
      <p className="text-white/60 max-w-sm mx-auto mb-14 text-sm md:text-base leading-relaxed">
        Drop your work calendar in and we surface the best spots that fit your free hours.
      </p>

      {shouldShowGate ? (
        <div className="max-w-md mx-auto rounded-2xl border border-white/20 bg-white/10 p-4 text-left backdrop-blur-md">
          <label htmlFor="access-code" className="block text-xs font-semibold uppercase tracking-[0.18em] text-coral-light">
            Access code
          </label>
          <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center">
            <input
              id="access-code"
              type="password"
              value={code}
              onChange={(event) => setCode(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && !isPending) {
                  submitCode();
                }
              }}
              className="min-w-0 flex-1 rounded-xl border border-white/15 bg-white/90 px-4 py-3 text-sm text-warm-900 placeholder:text-warm-400 focus:outline-none focus:ring-2 focus:ring-coral/40"
              placeholder="Enter the team access code"
              autoComplete="current-password"
            />
            <button
              type="button"
              onClick={submitCode}
              disabled={!code.trim() || isPending}
              className="rounded-xl bg-coral px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-coral-deep disabled:cursor-not-allowed disabled:opacity-40"
            >
              {isPending ? "Checking..." : "Unlock"}
            </button>
          </div>
          <p className="mt-3 text-xs text-white/65">
            The planner stays locked until a valid code is entered.
          </p>
          {error && <p className="mt-2 text-xs text-red-200">{error}</p>}
        </div>
      ) : (
        <div className="max-w-md mx-auto flex items-center gap-3 bg-white/10 backdrop-blur-md border border-white/20 rounded-2xl px-4 py-3">
          <span className="flex-1 text-left text-white/50 text-sm">
            Conference week in Austin, a few hours free...
          </span>
          <Link
            href="/plan"
            className="bg-coral text-white px-5 py-2 rounded-xl text-sm font-semibold hover:bg-coral-deep transition-colors shrink-0"
          >
            Start planning
          </Link>
        </div>
      )}
    </>
  );
}
