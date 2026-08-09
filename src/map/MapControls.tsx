import { useCallback, useState } from "react";
import { useMap } from "./gl";
import { MAP_CONFIG } from "./map-style";
import { Plus, Minus, Compass, Crosshair } from "lucide-react";

export function MapControls() {
  const { current: map } = useMap();
  const [bearing, setBearing] = useState(0);

  const handleZoomIn = useCallback(() => {
    map?.zoomIn({ duration: 300 });
  }, [map]);

  const handleZoomOut = useCallback(() => {
    map?.zoomOut({ duration: 300 });
  }, [map]);

  const handleResetNorth = useCallback(() => {
    map?.easeTo({ bearing: 0, pitch: MAP_CONFIG.defaultPitch, duration: 500 });
    setBearing(0);
  }, [map]);

  const handleLocate = useCallback(() => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        map?.flyTo({
          center: [pos.coords.longitude, pos.coords.latitude],
          zoom: 16,
          duration: 1000,
        });
      },
      () => {},
      { enableHighAccuracy: true, timeout: 5000 }
    );
  }, [map]);

  const btnClass =
    "flex h-9 w-9 items-center justify-center rounded-lg bg-white/90 dark:bg-[#1A1A1A]/90 backdrop-blur-md border border-gray-200 dark:border-hairline shadow-soft text-gray-700 dark:text-foreground hover:bg-white dark:hover:bg-[#2A2A2A] transition-colors";

  return (
    <div className="absolute bottom-4 right-4 z-10 flex flex-col gap-2">
      <button onClick={handleLocate} className={btnClass} title="Locate me">
        <Crosshair className="h-4 w-4" />
      </button>
      <button onClick={handleResetNorth} className={btnClass} title="Reset north">
        <Compass
          className="h-4 w-4"
          style={{ transform: `rotate(${bearing}deg)`, transition: "transform 0.3s ease" }}
        />
      </button>
      <button onClick={handleZoomIn} className={btnClass} title="Zoom in">
        <Plus className="h-4 w-4" />
      </button>
      <button onClick={handleZoomOut} className={btnClass} title="Zoom out">
        <Minus className="h-4 w-4" />
      </button>
    </div>
  );
}
