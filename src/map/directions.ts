export type RoutePoint = [number, number]; // [lat, lon]

const FUNCTIONS_BASE = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1`;

/**
 * Memoized POST helper for edge functions (Google-backed geocoding/routing).
 * The GOOGLE_MAPS_API_KEY secret lives only on the server, so it is never
 * exposed in this client bundle.
 */
async function callEdge<T = any>(
  name: string,
  body?: unknown
): Promise<T | null> {
  if (!FUNCTIONS_BASE.includes("supabase.co")) return null;
  try {
    const res = await fetch(`${FUNCTIONS_BASE}/${name}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: body ? JSON.stringify(body) : undefined,
    });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

/**
 * Geocode a free-text address via the geocode-location edge function
 * (Google Geocoding -> OSM/Nominatim fallback). Returns [lat, lon] or null.
 */
export async function geocodeMapAddress(
  address: string
): Promise<RoutePoint | null> {
  if (!address?.trim()) return null;
  const data = await callEdge<{ coords: { lat: number; lon: number } | null }>(
    "geocode-location",
    { query: address.trim() }
  );
  return data?.coords ? [data.coords.lat, data.coords.lon] : null;
}

/**
 * Fetch a driving route via the route edge function (Google Directions ->
 * OSRM -> straight-line fallback). Keeps the Mapbox-era return shape.
 */
export async function getMapboxDirections(
  start: RoutePoint,
  end: RoutePoint
): Promise<{ points: RoutePoint[]; distanceMeters: number; durationSeconds: number } | null> {
  const data = await callEdge<{
    distanceKm: number;
    durationMinutes: number;
    polyline: string | Array<{ lat: number; lon: number }>;
  }>("route", {
    originLat: start[0],
    originLon: start[1],
    destinationLat: end[0],
    destinationLon: end[1],
  });

  if (!data) {
    // Fallback: straight line so the map still renders something.
    return { points: [start, end], distanceMeters: 0, durationSeconds: 0 };
  }

  const coords = parsePolyline(data.polyline);
  const points: RoutePoint[] = coords.length > 1 ? coords : [start, end];
  return {
    points,
    distanceMeters: Math.round(data.distanceKm * 1000),
    durationSeconds: Math.round(data.durationMinutes * 60),
  };
}

function parsePolyline(
  polyline: string | Array<{ lat: number; lon: number }> | undefined
): RoutePoint[] {
  let arr: Array<{ lat: number; lon: number }> = [];
  if (Array.isArray(polyline)) {
    arr = polyline;
  } else if (typeof polyline === "string") {
    try {
      arr = JSON.parse(polyline);
    } catch {
      arr = [];
    }
  }
  return (Array.isArray(arr) ? arr : [])
    .filter((p) => typeof p?.lat === "number" && typeof p?.lon === "number")
    .map((p) => [p.lat, p.lon] as RoutePoint);
}