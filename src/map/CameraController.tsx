import { useEffect, useRef } from "react";
import { useMap } from "./gl";
import { MAP_CONFIG } from "./map-style";

interface CameraControllerProps {
  latitude?: number | null;
  longitude?: number | null;
  zoom?: number;
  pitch?: number;
  bearing?: number;
  fitPoints?: [number, number][];
  padding?: number;
}

// Round to ~3 decimals (~110m) so tiny GPS jitter doesn't re-trigger the camera.
function signature(point: [number, number]): string {
  return `${point[0].toFixed(2)},${point[1].toFixed(2)}`;
}

export function CameraController({
  latitude,
  longitude,
  zoom = 15,
  pitch = MAP_CONFIG.defaultPitch,
  bearing = MAP_CONFIG.defaultBearing,
  fitPoints,
  padding = 60,
}: CameraControllerProps) {
  const { current: map } = useMap();
  const fittedSig = useRef<string | null>(null);

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

      // Only refit when the points meaningfully change between calls. The driver
      // position streams in many times/second, so without this guard we'd spam
      // fitBounds/easeTo on every update.
      const sig = fitPoints.map(signature).join("|");
      if (fittedSig.current === sig) return;
      fittedSig.current = sig;

      if (fitPoints.length === 1) {
        map.flyTo({
          center: [bounds.minLon, bounds.minLat],
          zoom,
          pitch,
          bearing,
          duration: 1000,
        });
      } else {
        map.fitBounds(
          [
            [bounds.minLon, bounds.minLat],
            [bounds.maxLon, bounds.maxLat],
          ],
          {
            padding,
            maxZoom: 16,
            duration: 1000,
          }
        );
        // Preserve the tilted 3D view after fitting the bounds.
        map.easeTo({ pitch, bearing, duration: 400 });
      }
    } else if (latitude != null && longitude != null) {
      const sig = signature([latitude, longitude]);
      if (fittedSig.current === sig) return;
      fittedSig.current = sig;

      map.flyTo({
        center: [longitude, latitude],
        zoom,
        pitch,
        bearing,
        duration: 1000,
      });
    }
  }, [latitude, longitude, zoom, pitch, bearing, fitPoints, padding, map]);

  return null;
}