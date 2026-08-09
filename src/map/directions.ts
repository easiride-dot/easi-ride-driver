import { MAP_ACCESS_TOKEN } from "./map-style";

export type RoutePoint = [number, number]; // [lat, lon]

/**
 * Geocode a free-text address via Mapbox Geocoding (public token, client-safe).
 * Returns [lat, lon] or null when nothing is found.
 */
export async function geocodeMapAddress(
  address: string
): Promise<RoutePoint | null> {
  if (!MAP_ACCESS_TOKEN || !address?.trim()) return null;

  const url =
    `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(address.trim())}.json` +
    `?limit=1&access_token=${encodeURIComponent(MAP_ACCESS_TOKEN)}`;

  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const data = await res.json();
    const feature = data?.features?.[0];
    if (!feature?.center) return null;
    // center is [lon, lat]
    return [feature.center[1], feature.center[0]];
  } catch {
    return null;
  }
}

export async function getMapboxDirections(
  start: RoutePoint,
  end: RoutePoint
): Promise<{ points: RoutePoint[]; distanceMeters: number; durationSeconds: number } | null> {
  if (!MAP_ACCESS_TOKEN) return null;

  const url =
    `https://api.mapbox.com/directions/v5/mapbox/driving/` +
    `${start[1]},${start[0]};${end[1]},${end[0]}` +
    `?geometries=geojson&overview=full&steps=false&access_token=${encodeURIComponent(MAP_ACCESS_TOKEN)}`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 10000);

  try {
    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok) return null;
    const data = await res.json();
    const route = data?.routes?.[0];
    if (!route || !route.geometry?.coordinates) return null;

    const points: RoutePoint[] = route.geometry.coordinates.map(
      ([lon, lat]: [number, number]) => [lat, lon]
    );

    return {
      points,
      distanceMeters: route.distance,
      durationSeconds: route.duration,
    };
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}