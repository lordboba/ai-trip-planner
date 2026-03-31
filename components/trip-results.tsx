"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import type { TripPlan, TripRequest } from "@/lib/types";

type Props = {
  plan: TripPlan;
  request: TripRequest;
};

const timeIcons: Record<string, string> = {
  morning: "🌅",
  afternoon: "☀️",
  evening: "🌙",
};

export function TripResults({ plan, request }: Props) {
  const [activeDay, setActiveDay] = useState(0);
  const [view, setView] = useState<"itinerary" | "dashboard">("itinerary");
  const [agentTraceOpen, setAgentTraceOpen] = useState(false);

  const day = plan.dailyItinerary[activeDay];
  const totalActivities = plan.dailyItinerary.length * 3;

  return (
    <div>
      {/* Gradient Hero */}
      <section className="bg-gradient-to-br from-warm-900 via-warm-600 to-coral-deep px-4 py-10 md:py-14 relative">
        <div className="max-w-3xl mx-auto">
          <div className="flex items-center justify-between mb-6">
            <Link href="/plan" className="text-sm text-white/60 hover:text-white/90 transition-colors">
              ← Back to planning
            </Link>
            <div className="flex gap-2">
              <button type="button" onClick={() => setView(view === "itinerary" ? "dashboard" : "itinerary")}
                className="px-3 py-1.5 rounded-lg text-xs bg-white/10 text-white/80 hover:bg-white/20 transition-colors">
                {view === "itinerary" ? "📋 Dashboard" : "🗺️ Itinerary"}
              </button>
            </div>
          </div>

          <h1 className="text-3xl md:text-4xl font-extrabold text-white mb-2">
            {plan.destinationSummary.title}
          </h1>
          <p className="text-white/70 mb-4 text-sm md:text-base">
            {plan.dailyItinerary.length} days · {request.travelerProfile.budgetBand} · {request.travelerProfile.interests.slice(0, 3).join(" & ")} focus
          </p>
          <div className="flex flex-wrap gap-2">
            {request.travelerProfile.interests.slice(0, 4).map((interest) => (
              <span key={interest} className="px-3 py-1 rounded-lg text-xs bg-white/15 text-white">
                {interest}
              </span>
            ))}
          </div>

          <div className="absolute bottom-4 right-4 bg-warm-900 border border-warm-600 px-3 py-1 rounded-lg text-[10px] text-coral-light">
            Planned with Claude ✨
          </div>
        </div>
      </section>

      <div className="max-w-3xl mx-auto px-4 py-8">
        <AnimatePresence mode="wait">
          {view === "itinerary" ? (
            <motion.div key="itinerary" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }}>
              {/* Day Tabs */}
              <div className="flex gap-1 border-b border-warm-100 mb-6 overflow-x-auto">
                {plan.dailyItinerary.map((d, i) => (
                  <button key={d.date} type="button" onClick={() => setActiveDay(i)}
                    className={`px-4 py-3 text-sm font-semibold whitespace-nowrap transition-colors ${i === activeDay ? "text-coral border-b-2 border-coral" : "text-warm-400 hover:text-warm-600"}`}>
                    Day {i + 1}
                  </button>
                ))}
              </div>

              {/* Day Content */}
              {day && (
                <AnimatePresence mode="wait">
                  <motion.div key={activeDay} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12 }} transition={{ duration: 0.2 }}>
                    <div className="flex items-center gap-3 mb-6">
                      <div className="w-8 h-8 bg-coral rounded-full flex items-center justify-center text-white font-bold text-sm shrink-0">
                        {activeDay + 1}
                      </div>
                      <h2 className="text-lg font-bold text-warm-900">Day {activeDay + 1} — {day.dateLabel}</h2>
                      <span className="text-xs text-warm-400 ml-auto">{day.budgetEstimate}</span>
                    </div>

                    {/* Activity Cards */}
                    <div className="space-y-3">
                      {([["morning", day.morning], ["afternoon", day.afternoon], ["evening", day.evening]] as const).map(([timeOfDay, block], blockIndex) => (
                        <motion.div key={timeOfDay} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: blockIndex * 0.1, duration: 0.25 }}
                          className="flex gap-4 p-4 border border-warm-100 rounded-xl hover:shadow-md transition-shadow">
                          <div className="w-12 h-12 bg-coral-wash rounded-lg flex items-center justify-center text-xl shrink-0">
                            {timeIcons[timeOfDay]}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-[10px] font-semibold uppercase tracking-widest text-coral mb-0.5">{timeOfDay}</p>
                            <p className="font-bold text-warm-900 text-sm">{block.title}</p>
                            <p className="text-xs text-warm-400 mt-1 leading-relaxed">{block.note}</p>
                            {block.reservationSuggested && (
                              <div className="mt-2">
                                <span className="text-[10px] px-2 py-0.5 bg-coral-wash text-coral-deep rounded">🔖 Reservation</span>
                              </div>
                            )}
                          </div>
                        </motion.div>
                      ))}
                    </div>

                    {day.transitNotes && (
                      <p className="text-xs text-warm-400 mt-4 pt-3 border-t border-dashed border-warm-100">{day.transitNotes}</p>
                    )}
                  </motion.div>
                </AnimatePresence>
              )}

              {/* Lodging & Top Pick */}
              <div className="mt-10 grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="border border-warm-100 rounded-xl p-4">
                  <p className="text-xs font-semibold uppercase tracking-widest text-warm-400 mb-2">🏨 Lodging</p>
                  <p className="font-bold text-warm-900 text-sm">{plan.lodgingRecommendation.name}</p>
                  <p className="text-xs text-warm-400 mt-1">{plan.lodgingRecommendation.neighborhood}</p>
                  <p className="text-xs text-warm-400 mt-1">{plan.lodgingRecommendation.reason}</p>
                </div>
                {plan.diningList[0] && (
                  <div className="border border-warm-100 rounded-xl p-4">
                    <p className="text-xs font-semibold uppercase tracking-widest text-warm-400 mb-2">🍽️ Top Pick</p>
                    <p className="font-bold text-warm-900 text-sm">{plan.diningList[0].name}</p>
                    <p className="text-xs text-warm-400 mt-1">{plan.diningList[0].priceBand} · ⭐ {plan.diningList[0].rating}</p>
                    <p className="text-xs text-warm-400 mt-1">{plan.diningList[0].reasonToRecommend}</p>
                  </div>
                )}
              </div>

              {/* All Dining */}
              <div className="mt-6">
                <h3 className="text-sm font-bold text-warm-900 mb-3">All Dining Recommendations</h3>
                <div className="space-y-2">
                  {plan.diningList.map((place) => (
                    <div key={place.name} className="flex items-center justify-between p-3 border border-warm-100 rounded-xl">
                      <div>
                        <p className="font-semibold text-warm-900 text-sm">{place.name}</p>
                        <p className="text-xs text-warm-400">{place.reasonToRecommend}</p>
                      </div>
                      <div className="text-right shrink-0 ml-4">
                        <p className="text-xs font-semibold text-coral">⭐ {place.rating}</p>
                        <p className="text-[10px] text-warm-400">{place.priceBand}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* All Activities */}
              <div className="mt-6">
                <h3 className="text-sm font-bold text-warm-900 mb-3">Activity Recommendations</h3>
                <div className="space-y-2">
                  {plan.activityList.map((place) => (
                    <div key={place.name} className="flex items-center justify-between p-3 border border-warm-100 rounded-xl">
                      <div>
                        <p className="font-semibold text-warm-900 text-sm">{place.name}</p>
                        <p className="text-xs text-warm-400">{place.reasonToRecommend}</p>
                      </div>
                      <div className="text-right shrink-0 ml-4">
                        <p className="text-xs font-semibold text-coral">⭐ {place.rating}</p>
                        <p className="text-[10px] text-warm-400">{place.category}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </motion.div>
          ) : (
            /* Dashboard View */
            <motion.div key="dashboard" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }}>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
                <div className="bg-warm-50 rounded-xl p-4 text-center">
                  <div className="text-xl font-extrabold text-coral">{plan.dailyItinerary.length}</div>
                  <div className="text-xs text-warm-400">Days</div>
                </div>
                <div className="bg-warm-50 rounded-xl p-4 text-center">
                  <div className="text-xl font-extrabold text-coral">{totalActivities}</div>
                  <div className="text-xs text-warm-400">Activities</div>
                </div>
                <div className="bg-warm-50 rounded-xl p-4 text-center">
                  <div className="text-xl font-extrabold text-coral">{plan.diningList.length}</div>
                  <div className="text-xs text-warm-400">Restaurants</div>
                </div>
                <div className="bg-warm-50 rounded-xl p-4 text-center">
                  <div className="text-xl font-extrabold text-coral">
                    {request.travelerProfile.budgetBand === "lean" ? "$" : request.travelerProfile.budgetBand === "comfort" ? "$$" : "$$$"}
                  </div>
                  <div className="text-xs text-warm-400">Budget</div>
                </div>
              </div>

              <div className="space-y-2 mb-6">
                {plan.dailyItinerary.map((d, i) => (
                  <div key={d.date} className="flex items-center gap-3 p-3 bg-white border border-warm-100 rounded-xl">
                    <span className="text-sm font-bold text-coral w-12">Day {i + 1}</span>
                    <span className="text-sm font-semibold text-warm-900 flex-1">{d.dateLabel}</span>
                    <span className="text-xs text-warm-400">3 activities</span>
                  </div>
                ))}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-6">
                <div className="border border-warm-100 rounded-xl p-4">
                  <p className="text-xs font-semibold uppercase tracking-widest text-warm-400 mb-2">🏨 Lodging</p>
                  <p className="font-bold text-warm-900 text-sm">{plan.lodgingRecommendation.name}</p>
                  <p className="text-xs text-warm-400 mt-1">{plan.lodgingRecommendation.neighborhood} · {plan.lodgingRecommendation.reason}</p>
                </div>
                {plan.diningList[0] && (
                  <div className="border border-warm-100 rounded-xl p-4">
                    <p className="text-xs font-semibold uppercase tracking-widest text-warm-400 mb-2">🍽️ Top Pick</p>
                    <p className="font-bold text-warm-900 text-sm">{plan.diningList[0].name}</p>
                    <p className="text-xs text-warm-400 mt-1">⭐ {plan.diningList[0].rating} · {plan.diningList[0].priceBand}</p>
                  </div>
                )}
              </div>

              {/* Agent Trace Accordion */}
              <div className="border border-warm-100 rounded-xl overflow-hidden">
                <button type="button" onClick={() => setAgentTraceOpen(!agentTraceOpen)}
                  className="w-full flex items-center justify-between p-4 text-left hover:bg-warm-50 transition-colors">
                  <span className="text-sm font-semibold text-warm-900">🤖 Agent Trace</span>
                  <span className="text-warm-400 text-xs">{agentTraceOpen ? "▲" : "▼"}</span>
                </button>
                {agentTraceOpen && (
                  <div className="border-t border-warm-100 p-4 space-y-3">
                    {plan.agentTrace.map((agent) => (
                      <div key={agent.name}>
                        <p className="text-xs font-semibold uppercase tracking-widest text-coral mb-1">{agent.name}</p>
                        <p className="text-xs text-warm-400">{agent.summary}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="mt-10 text-center">
          <Link href="/plan" className="inline-block bg-coral text-white px-6 py-3 rounded-xl font-semibold hover:bg-coral-deep transition-colors">
            Plan another trip
          </Link>
        </div>
      </div>
    </div>
  );
}
