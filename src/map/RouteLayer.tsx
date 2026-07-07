import { useEffect, useMemo, useState } from "react";
import { Source, Layer } from "react-map-gl/maplibre";
import { ROUTE_SOURCE_ID, ROUTE_LAYER_ID, routeLayerStyle } from "./map-style";

interface RouteLayerProps {
  points: [number, number][];
}

export function RouteLayer({ points }: RouteLayerProps) {
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
    <Source id={ROUTE_SOURCE_ID} type="geojson" data={geojson}>
      <Layer
        {...routeLayerStyle}
        paint={{
          ...routeLayerStyle.paint,
          "line-opacity": 0.85 * opacity,
        }}
      />
    </Source>
  );
}
