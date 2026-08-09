import { useEffect, useMemo, useState } from "react";
import { Source, Layer } from "./gl";

interface RouteLayerProps {
  points: [number, number][];
  id?: string;
  color?: string;
  width?: number;
}

const DEFAULT_INNER = "#3b82f6";
const DEFAULT_CASING = "#0f172a";

export function RouteLayer({ points, id = "route", color = DEFAULT_INNER, width = 6 }: RouteLayerProps) {
  const [opacity, setOpacity] = useState(0);

  const geojson = useMemo(() => {
    if (points.length < 2) return null;
    return {
      type: "Feature" as const,
      properties: {},
      geometry: {
        type: "LineString" as const,
        coordinates: points.map(([lat, lon]) => [lon, lat] as [number, number]),
      },
    };
  }, [points]);

  useEffect(() => {
    if (geojson) {
      requestAnimationFrame(() => setOpacity(1));
    } else {
      setOpacity(0);
    }
  }, [geojson]);

  if (!geojson) return null;

  const sourceId = `${id}-source`;
  const base = { type: "line" as const, source: sourceId };

  return (
    <Source id={sourceId} type="geojson" data={geojson}>
      {/* Casing — dark outline that makes the route pop on a tilted/dark map,
          the signature "Uber" route look. */}
      <Layer
        id={`${id}-casing`}
        {...base}
        layout={{ "line-cap": "round", "line-join": "round" }}
        paint={{
          "line-color": DEFAULT_CASING,
          "line-width": width + 2,
          "line-opacity": 0.9 * opacity,
        }}
      />
      {/* Inner colored line + subtle glow */}
      <Layer
        id={`${id}-line`}
        {...base}
        layout={{ "line-cap": "round", "line-join": "round" }}
        paint={{
          "line-color": color,
          "line-width": width,
          "line-opacity": 0.85 * opacity,
          "line-blur": width > 4 ? 0.5 : 0,
        }}
      />
    </Source>
  );
}