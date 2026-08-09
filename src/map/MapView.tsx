import { useMemo } from "react";
import type { MapProps } from "react-map-gl/mapbox";
import { Map, useMap } from "./gl";
import { glProvider } from "./gl";
import { resolveMapStyle, MAP_ACCESS_TOKEN, MAP_CONFIG } from "./map-style";
import { useTheme } from "@/hooks/useTheme";
import "maplibre-gl/dist/maplibre-gl.css";
import "mapbox-gl/dist/mapbox-gl.css";

interface MapViewProps extends Omit<MapProps, "mapLib"> {
  children?: React.ReactNode;
  onLoad?: () => void;
}

export function MapView({ children, onLoad, ...props }: MapViewProps) {
  const { theme } = useTheme();
  const mapStyle = resolveMapStyle(theme);

  const initialViewState = useMemo(
    () => ({
      longitude: MAP_CONFIG.freetownCenter[1],
      latitude: MAP_CONFIG.freetownCenter[0],
      zoom: MAP_CONFIG.defaultZoom,
      pitch: MAP_CONFIG.defaultPitch,
      bearing: MAP_CONFIG.defaultBearing,
    }),
    []
  );

  return (
    <Map
      mapStyle={mapStyle}
      mapboxAccessToken={MAP_ACCESS_TOKEN}
      initialViewState={initialViewState}
      minZoom={MAP_CONFIG.minZoom}
      maxZoom={MAP_CONFIG.maxZoom}
      attributionControl={false}
      reuseMaps
      {...props}
      onLoad={onLoad}
      style={props.style ?? { width: "100%", height: "100%" }}
    >
      {children}
    </Map>
  );
}

export { useMap, glProvider };