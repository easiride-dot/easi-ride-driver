import { useEffect, useMemo, useState } from "react";
import { Source, Layer } from "react-map-gl/maplibre";

interface RouteLayerProps {
  points: [number, number][];
  id?: string;
  color?: string;
  width?: number;
}

export function RouteLayer({ points, id = "route", color = "#3b82f6", width = 6 }: RouteLayerProps) {
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

  return (
    <Source id={`${id}-source`} type="geojson" data={geojson}>
      <Layer
        id={`${id}-line`}
        type="line"
        source={`${id}-source`}
        layout={{
          "line-cap": "round",
          "line-join": "round",
        }}
        paint={{
          "line-color": color,
          "line-width": width,
          "line-opacity": 0.85 * opacity,
          "line-blur": 0,
        }}
      />
    </Source>
  );
}
