import { useMemo } from "react";
import Map, { useMap } from "react-map-gl/maplibre";
import type { MapProps } from "react-map-gl/maplibre";
import "maplibre-gl/dist/maplibre-gl.css";
import { DARK_STYLE, MAP_CONFIG } from "./map-style";

interface MapViewProps extends Omit<MapProps, "mapLib"> {
  children?: React.ReactNode;
  onLoad?: () => void;
}

export function MapView({ children, onLoad, ...props }: MapViewProps) {
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
      mapStyle={DARK_STYLE}
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

export { useMap };
