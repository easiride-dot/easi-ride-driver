import { glProvider } from "./gl";

// Mapbox Standard styles — dark is the classic Uber night look; light for day mode.
export const DARK_STYLE = "mapbox://styles/mapbox/dark-v11";
export const LIGHT_STYLE = "mapbox://styles/mapbox/light-v11";

// MapLibre fallback (CartoDB) — used when VITE_MAP_PROVIDER=maplibre or no
// Mapbox token is configured.
export const CARTO_DARK_STYLE = "https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json";
export const CARTO_LIGHT_STYLE = "https://basemaps.cartocdn.com/gl/positron-gl-style/style.json";

export function resolveMapStyle(theme: "light" | "dark"): string {
  if (glProvider === "mapbox") {
    return theme === "dark" ? DARK_STYLE : LIGHT_STYLE;
  }
  return theme === "dark" ? CARTO_DARK_STYLE : CARTO_LIGHT_STYLE;
}

export const MAP_ACCESS_TOKEN =
  (import.meta.env.VITE_MAPBOX_ACCESS_TOKEN as string | undefined) || undefined;

export const MAP_CONFIG = {
  // Slightly deeper pitch than before for a more dramatic "Uber" 3D feel.
  defaultZoom: 15,
  defaultPitch: 60,
  defaultBearing: 0,
  minZoom: 3,
  maxZoom: 20,
  freetownCenter: [8.4844, -13.2344] as [number, number],
} as const;

export const ROUTE_SOURCE_ID = "route";
export const ROUTE_LAYER_ID = "route-line";

export const routeLayerStyle = {
  id: ROUTE_LAYER_ID,
  type: "line" as const,
  source: ROUTE_SOURCE_ID,
  layout: {
    "line-cap": "round" as const,
    "line-join": "round" as const,
  },
  paint: {
    "line-color": "#ffffff",
    "line-width": 6,
    "line-opacity": 0.85,
    "line-blur": 2,
  },
};