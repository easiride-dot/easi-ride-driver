export const DARK_STYLE = "https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json";

export const MAP_CONFIG = {
  defaultZoom: 15,
  defaultPitch: 45,
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
