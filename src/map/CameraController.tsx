import { useEffect } from "react";
import { useMap } from "react-map-gl/maplibre";

interface CameraControllerProps {
  latitude?: number | null;
  longitude?: number | null;
  zoom?: number;
  pitch?: number;
  bearing?: number;
  fitPoints?: [number, number][];
  padding?: number;
}

export function CameraController({
  latitude,
  longitude,
  zoom = 15,
  fitPoints,
  padding = 60,
}: CameraControllerProps) {
  const { current: map } = useMap();

  useEffect(() => {
    if (!map) return;

    if (fitPoints && fitPoints.length > 0) {
      const bounds = fitPoints.reduce(
        (acc, [lat, lon]) => ({
          minLat: Math.min(acc.minLat, lat),
          maxLat: Math.max(acc.maxLat, lat),
          minLon: Math.min(acc.minLon, lon),
          maxLon: Math.max(acc.maxLon, lon),
        }),
        {
          minLat: fitPoints[0][0],
          maxLat: fitPoints[0][0],
          minLon: fitPoints[0][1],
          maxLon: fitPoints[0][1],
        }
      );

      if (fitPoints.length === 1) {
        map.flyTo({
          center: [bounds.minLon, bounds.minLat],
          zoom,
          duration: 1000,
        });
      } else {
        map.fitBounds(
          [
            [bounds.minLon, bounds.minLat],
            [bounds.maxLon, bounds.maxLat],
          ],
          { padding, maxZoom: 16, duration: 1000 }
        );
      }
    } else if (latitude != null && longitude != null) {
      map.flyTo({
        center: [longitude, latitude],
        zoom,
        duration: 1000,
      });
    }
  }, [latitude, longitude, zoom, fitPoints, padding, map]);

  return null;
}
