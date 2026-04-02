"use client";

import { useEffect, useRef } from "react";
import { APIProvider, AdvancedMarker, Map, useMap } from "@vis.gl/react-google-maps";
import type { DayColor } from "@/lib/day-colors";

export type MapPin = {
  id: string;
  lat: number;
  lng: number;
  label: string;
  number: number;
  isSuggestion: boolean;
  dayColor: DayColor;
};

type TripMapProps = {
  apiKey: string;
  mapId: string;
  pins: MapPin[];
  routes: { dayColor: DayColor; waypoints: { lat: number; lng: number }[] }[];
  highlightedPinId: string | null;
  onPinClick: (pinId: string) => void;
  onPinHover: (pinId: string | null) => void;
  showLegend?: boolean;
  legendItems?: { color: string; label: string }[];
};

function RouteRenderer({ routes }: Pick<TripMapProps, "routes">) {
  const map = useMap();
  const polylinesRef = useRef<google.maps.Polyline[]>([]);

  useEffect(() => {
    for (const polyline of polylinesRef.current) {
      polyline.setMap(null);
    }
    polylinesRef.current = [];

    const googleMaps = typeof window === "undefined" ? null : window.google?.maps;

    if (!map || !googleMaps || routes.length === 0) {
      return undefined;
    }

    const directionsService = new googleMaps.DirectionsService();
    let cancelled = false;

    for (const route of routes) {
      if (route.waypoints.length < 2) {
        continue;
      }

      const origin = route.waypoints[0];
      const destination = route.waypoints[route.waypoints.length - 1];
      const intermediateWaypoints = route.waypoints.slice(1, -1).map((waypoint) => ({
        location: new googleMaps.LatLng(waypoint.lat, waypoint.lng),
        stopover: true,
      }));

      directionsService.route(
        {
          origin: new googleMaps.LatLng(origin.lat, origin.lng),
          destination: new googleMaps.LatLng(destination.lat, destination.lng),
          waypoints: intermediateWaypoints,
          travelMode: googleMaps.TravelMode.DRIVING,
        },
        (result: google.maps.DirectionsResult | null, status: google.maps.DirectionsStatus) => {
          if (cancelled || status !== googleMaps.DirectionsStatus.OK || !result) {
            return;
          }

          const polyline = new googleMaps.Polyline({
            path: result.routes[0]?.overview_path ?? [],
            strokeColor: route.dayColor.hex,
            strokeOpacity: 0.7,
            strokeWeight: 4,
            map,
          });

          polylinesRef.current.push(polyline);
        },
      );
    }

    return () => {
      cancelled = true;

      for (const polyline of polylinesRef.current) {
        polyline.setMap(null);
      }

      polylinesRef.current = [];
    };
  }, [map, routes]);

  return null;
}

function FitBounds({ pins }: Pick<TripMapProps, "pins">) {
  const map = useMap();

  useEffect(() => {
    const googleMaps = typeof window === "undefined" ? null : window.google?.maps;

    if (!map || !googleMaps || pins.length === 0) {
      return;
    }

    const bounds = new googleMaps.LatLngBounds();

    for (const pin of pins) {
      bounds.extend({ lat: pin.lat, lng: pin.lng });
    }

    map.fitBounds(bounds, { top: 60, right: 60, bottom: 60, left: 60 });
  }, [map, pins]);

  return null;
}

export function TripMap({
  apiKey,
  mapId,
  pins,
  routes,
  highlightedPinId,
  onPinClick,
  onPinHover,
  showLegend = false,
  legendItems = [],
}: TripMapProps) {
  if (!apiKey) {
    return (
      <div className="flex h-full min-h-[320px] items-center justify-center bg-[linear-gradient(180deg,#f8f2ec,#fff)] p-6 text-center">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-warm-400">Map unavailable</p>
          <p className="mt-3 max-w-sm text-sm leading-6 text-warm-600">
            Set `GOOGLE_PLACES_API_KEY` to enable the live itinerary map and route rendering.
          </p>
        </div>
      </div>
    );
  }

  const defaultCenter = pins[0]
    ? { lat: pins[0].lat, lng: pins[0].lng }
    : { lat: 35.6762, lng: 139.6503 };

  return (
    <APIProvider apiKey={apiKey} libraries={["marker"]}>
      <div className="relative h-full min-h-[320px] w-full bg-[linear-gradient(180deg,#f8f2ec,#fff)]">
        <Map
          defaultCenter={defaultCenter}
          defaultZoom={12}
          mapId={mapId}
          gestureHandling="greedy"
          disableDefaultUI={false}
          mapTypeControl={false}
          streetViewControl={false}
          fullscreenControl={false}
        >
          <FitBounds pins={pins} />
          <RouteRenderer routes={routes} />

          {pins.map((pin) => {
            const isHighlighted = highlightedPinId === pin.id;
            const isDimmed = highlightedPinId !== null && !isHighlighted;

            return (
              <AdvancedMarker
                key={pin.id}
                position={{ lat: pin.lat, lng: pin.lng }}
                clickable
                onClick={() => onPinClick(pin.id)}
                onMouseEnter={() => onPinHover(pin.id)}
                onMouseLeave={() => onPinHover(null)}
              >
                <div
                  className="flex flex-col items-center transition-opacity duration-200"
                  style={{ opacity: isDimmed ? 0.35 : 1 }}
                >
                  <div
                    className="flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold text-white shadow-md"
                    style={{
                      backgroundColor: pin.isSuggestion ? pin.dayColor.hex : "#3D3530",
                      border: pin.isSuggestion ? "2px dashed white" : "none",
                      boxShadow: isHighlighted
                        ? `0 0 0 4px ${pin.dayColor.hex}40`
                        : "0 4px 10px rgba(0, 0, 0, 0.25)",
                    }}
                  >
                    {pin.number}
                  </div>
                  <div className="mt-1 rounded-full bg-white/90 px-2 py-0.5 text-[10px] font-semibold text-warm-900 shadow-sm">
                    {pin.label}
                  </div>
                </div>
              </AdvancedMarker>
            );
          })}
        </Map>

        {pins.length === 0 && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <div className="rounded-2xl border border-white/60 bg-white/88 px-5 py-4 text-center shadow-sm backdrop-blur">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-warm-400">No mapped stops</p>
              <p className="mt-2 text-sm text-warm-600">Add suggestions to see pins and routes here.</p>
            </div>
          </div>
        )}

        {showLegend && legendItems.length > 0 && (
          <div className="absolute bottom-3 left-3 flex flex-wrap gap-3 rounded-xl bg-white/92 px-3 py-2 shadow-sm backdrop-blur">
            {legendItems.map((item) => (
              <div key={item.label} className="flex items-center gap-1.5">
                <div className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: item.color }} />
                <span className="text-[10px] font-medium text-warm-600">{item.label}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </APIProvider>
  );
}
