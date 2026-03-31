import type { ItineraryDay, PlaceCandidate, TripPlan, TripRequest } from "../domain/trips.ts";

const cityCatalog = {
  lisbon: {
    title: "Lisbon, Portugal",
    neighborhood: "Principe Real",
    overview: "Lisbon wins on layered food culture, easy wandering, and enough elegance to feel like a splurge without becoming rigid.",
    dining: [
      {
        name: "Prado",
        source: "mock",
        category: "restaurant",
        rating: 4.8,
        priceBand: "$$$",
        reviewSnippets: ["Vegetable-forward and polished without feeling formal.", "A special dinner that still feels warm."],
        lat: 38.7115,
        lng: -9.132,
        reasonToRecommend: "Matches a traveler who wants one standout dinner, strong produce, and a room that feels design-led instead of stiff.",
      },
      {
        name: "Hello, Kristof",
        source: "mock",
        category: "cafe",
        rating: 4.7,
        priceBand: "$$",
        reviewSnippets: ["Coffee-first mornings and a calm neighborhood rhythm.", "Great reset point before a walking day."],
        lat: 38.7168,
        lng: -9.1491,
        reasonToRecommend: "Fits the coffee priority and gives the itinerary a softer morning anchor.",
      },
    ],
    activities: [
      {
        name: "Feira da Ladra + Alfama drift",
        source: "mock",
        category: "market",
        rating: 4.6,
        priceBand: "$",
        reviewSnippets: ["Best enjoyed without rushing.", "Feels local if you let the day unfold."],
        lat: 38.7152,
        lng: -9.1218,
        reasonToRecommend: "Supports a hidden-gems and wandering-heavy trip without locking the traveler into a rigid ticketed experience.",
      },
      {
        name: "Miradouro circuit",
        source: "mock",
        category: "scenic",
        rating: 4.7,
        priceBand: "$",
        reviewSnippets: ["Viewpoint hopping feels cinematic at golden hour.", "Pairs well with slow afternoons."],
        lat: 38.7137,
        lng: -9.1336,
        reasonToRecommend: "Adds city texture and scenic payoff without heavy logistics.",
      },
    ],
  },
  kyoto: {
    title: "Kyoto, Japan",
    neighborhood: "Higashiyama",
    overview: "Kyoto works when the traveler wants ritual, strong neighborhood identity, and a trip paced around quiet detail rather than nightlife volume.",
    dining: [
      {
        name: "K36 Rooftop Bar",
        source: "mock",
        category: "bar",
        rating: 4.6,
        priceBand: "$$$",
        reviewSnippets: ["Best reserved for one intentional evening.", "Atmosphere-led without turning chaotic."],
        lat: 35.0,
        lng: 135.7827,
        reasonToRecommend: "Works as a controlled splurge for a traveler who still wants mood and polish.",
      },
      {
        name: "Weekenders Coffee",
        source: "mock",
        category: "cafe",
        rating: 4.8,
        priceBand: "$$",
        reviewSnippets: ["Minimal but memorable.", "Excellent stop before market and shrine wandering."],
        lat: 35.0054,
        lng: 135.7594,
        reasonToRecommend: "Keeps the mornings sharp and aligns with travelers who care about coffee quality and neighborhood texture.",
      },
    ],
    activities: [
      {
        name: "Philosopher's Path morning",
        source: "mock",
        category: "walk",
        rating: 4.8,
        priceBand: "$",
        reviewSnippets: ["Best very early.", "A calm counterweight to busier temple zones."],
        lat: 35.0266,
        lng: 135.7982,
        reasonToRecommend: "Ideal for a relaxed or balanced pace with strong scenic payoff and low friction.",
      },
      {
        name: "Nishiki Market edit",
        source: "mock",
        category: "food market",
        rating: 4.5,
        priceBand: "$$",
        reviewSnippets: ["Go with a short list, not a checklist.", "Works best as a curated graze."],
        lat: 35.005,
        lng: 135.7649,
        reasonToRecommend: "Lets the food agent give variety without overstuffing the day.",
      },
    ],
  },
  mexicoCity: {
    title: "Mexico City, Mexico",
    neighborhood: "Roma Norte",
    overview: "Mexico City is the strongest fit for travelers who want density, food depth, strong neighborhoods, and a slightly more exploratory rhythm.",
    dining: [
      {
        name: "Meroma",
        source: "mock",
        category: "restaurant",
        rating: 4.8,
        priceBand: "$$$",
        reviewSnippets: ["Refined without losing warmth.", "Excellent one-night splurge."],
        lat: 19.4146,
        lng: -99.1701,
        reasonToRecommend: "A strong anchor dinner for a comfort-budget traveler who wants one high-conviction meal.",
      },
      {
        name: "Cicatriz Cafe",
        source: "mock",
        category: "cafe",
        rating: 4.6,
        priceBand: "$$",
        reviewSnippets: ["Lively but not overwhelming during the day.", "Good launch point for a Roma walk."],
        lat: 19.4141,
        lng: -99.1663,
        reasonToRecommend: "Keeps the itinerary social and design-forward without pushing into full nightlife mode.",
      },
    ],
    activities: [
      {
        name: "Roma to Condesa gallery drift",
        source: "mock",
        category: "walk",
        rating: 4.7,
        priceBand: "$",
        reviewSnippets: ["A city made for layered wandering.", "Best with room for detours."],
        lat: 19.4127,
        lng: -99.1699,
        reasonToRecommend: "Supports hidden gems, coffee stops, and neighborhood-first planning.",
      },
      {
        name: "Museo Frida Kahlo timed visit",
        source: "mock",
        category: "museum",
        rating: 4.5,
        priceBand: "$$",
        reviewSnippets: ["Worth booking ahead.", "Pairs well with a lighter afternoon."],
        lat: 19.3553,
        lng: -99.1626,
        reasonToRecommend: "Adds one structured cultural stop without over-formalizing the itinerary.",
      },
    ],
  },
} as const;

function chooseCity(request: TripRequest) {
  const query = request.destinationContext.destinationQuery.toLowerCase();
  const shortlist = request.destinationContext.shortlist.map((item) => item.toLowerCase());
  const interests = request.travelerProfile.interests;

  if (query.includes("lisbon") || shortlist.some((item) => item.includes("lisbon"))) return cityCatalog.lisbon;
  if (query.includes("kyoto") || shortlist.some((item) => item.includes("kyoto"))) return cityCatalog.kyoto;
  if (query.includes("mexico") || shortlist.some((item) => item.includes("mexico"))) return cityCatalog.mexicoCity;

  if (interests.includes("nightlife") || interests.includes("hidden gems")) return cityCatalog.mexicoCity;
  if (interests.includes("nature") || request.travelerProfile.pace === "relaxed") return cityCatalog.kyoto;
  return cityCatalog.lisbon;
}

function formatDateLabel(date: Date) {
  return new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  }).format(date);
}

function buildDay(index: number, request: TripRequest, dining: readonly PlaceCandidate[], activities: readonly PlaceCandidate[]): ItineraryDay {
  const start = new Date(request.travelerProfile.startDate);
  start.setDate(start.getDate() + index);

  return {
    date: start.toISOString(),
    dateLabel: formatDateLabel(start),
    morning: {
      title: index === 0 ? `Neighborhood landing walk + ${dining[1]?.name ?? dining[0].name}` : activities[0].name,
      venue: activities[0].name,
      note: index === 0
        ? `Start gently so the trip reflects the ${request.travelerProfile.pace} pace instead of front-loading logistics.`
        : activities[0].reasonToRecommend,
      reservationSuggested: false,
    },
    afternoon: {
      title: activities[index % activities.length].name,
      venue: activities[index % activities.length].name,
      note: activities[index % activities.length].reasonToRecommend,
      reservationSuggested: activities[index % activities.length].category === "museum",
    },
    evening: {
      title: dining[index % dining.length].name,
      venue: dining[index % dining.length].name,
      note: dining[index % dining.length].reasonToRecommend,
      reservationSuggested: dining[index % dining.length].priceBand.includes("$$$"),
    },
    transitNotes: "Keep neighborhoods clustered to reduce transfers and preserve the feeling of discovery.",
    reservationFlags: [dining[index % dining.length].name],
    budgetEstimate: request.travelerProfile.budgetBand === "luxury" ? "$320-420" : request.travelerProfile.budgetBand === "comfort" ? "$180-260" : "$90-140",
  };
}

export function buildMockTripPlan(request: TripRequest): TripPlan {
  const city = chooseCity(request);
  const tripLength = (new Date(request.travelerProfile.endDate).getTime() - new Date(request.travelerProfile.startDate).getTime()) / 86400000;
  const dayCount = Math.max(3, Math.min(5, Math.round(tripLength) + 1 || 3));
  const dailyItinerary = Array.from({ length: dayCount }, (_, index) => buildDay(index, request, city.dining, city.activities));

  const providerVoice = request.provider === "openai"
    ? "The OpenAI path keeps the itinerary tight and tool-friendly, with explicit ranking logic."
    : "The Claude path leans into narrative reasoning and taste coherence across the full trip.";

  return {
    provider: request.provider,
    destinationSummary: {
      title: city.title,
      overview: `${city.overview} ${providerVoice}`,
    },
    lodgingRecommendation: {
      name: `${city.neighborhood} House`,
      neighborhood: city.neighborhood,
      reason: `Chosen for a ${request.travelerProfile.neighborhoodVibe} base, easy day structure, and compatibility with ${request.travelerProfile.lodgingStyle}.`,
    },
    dailyItinerary,
    diningList: city.dining,
    activityList: city.activities,
    bookingLinks: [
      {
        label: "Open lodging handoff",
        url: "https://www.booking.com/",
      },
      {
        label: "Open maps handoff",
        url: "https://maps.google.com/",
      },
    ],
    reviewStrategy: "Google Places is the sole place and review source for the phase-one app, covering restaurants, neighborhoods, hotels, and attractions through one integration.",
    shareSummary: `A ${request.travelerProfile.pace} ${request.travelerProfile.tripType} trip tuned for ${request.travelerProfile.interests.join(", ")} with a ${request.travelerProfile.budgetBand} budget and room for ${request.travelerProfile.mustHaves.toLowerCase()}.`,
    agentTrace: [
      {
        name: "Profile Agent",
        summary: `Locked in ${request.travelerProfile.tripType} travel, ${request.travelerProfile.pace} pacing, and the following hard edges: ${request.travelerProfile.hardNos}`,
      },
      {
        name: "Destination Agent",
        summary: `Selected ${city.title} because it best matches ${request.travelerProfile.interests.join(", ")} without violating the stated constraints.`,
      },
      {
        name: "Food & Reviews Agent",
        summary: "Weighted explainability over raw score, biasing toward places whose review language matches the traveler brief instead of generic top-rated options.",
      },
      {
        name: "Budget Agent",
        summary: `Kept the plan inside the ${request.travelerProfile.budgetBand} band while preserving one deliberate splurge opportunity.`,
      },
      {
        name: "Coordinator Agent",
        summary: `Merged the subagent outputs into a shareable plan that respects ${request.travelerProfile.constraintsNotes.toLowerCase()}`,
      },
    ],
  };
}
