import { useEffect, useMemo, useRef, useState } from "react";
import { MapView, CameraController, LocationMarker, RouteLayer, MapControls } from "@/map";
import { MAP_CONFIG } from "@/map/map-style";

const FREETOWN_CENTER: [number, number] = MAP_CONFIG.freetownCenter;

interface ActiveRideMapProps {
  driverLat: number | null;
  driverLon: number | null;
  driverHeading: number | null;
  pickupLat: number | null;
  pickupLon: number | null;
  destinationLat: number | null;
  destinationLon: number | null;
  showPickup?: boolean;
  showDestination?: boolean;
  onDurationChange?: (duration: number | null) => void;
}

export function ActiveRideMap({
  driverLat,
  driverLon,
  driverHeading,
  pickupLat,
  pickupLon,
  destinationLat,
  destinationLon,
  showPickup = true,
  showDestination = true,
  onDurationChange,
}: ActiveRideMapProps) {
  const [routePoints, setRoutePoints] = useState<[number, number][]>([]);
  const lastRouteFetch = useRef(0);

  const driverPos = useMemo<[number, number] | null>(
    () => (driverLat != null && driverLon != null ? [driverLat, driverLon] : null),
    [driverLat, driverLon]
  );

  const pickupPos = useMemo<[number, number] | null>(
    () => (pickupLat != null && pickupLon != null ? [pickupLat, pickupLon] : null),
    [pickupLat, pickupLon]
  );

  const destPos = useMemo<[number, number] | null>(
    () =>
      destinationLat != null && destinationLon != null
        ? [destinationLat, destinationLon]
        : null,
    [destinationLat, destinationLon]
  );

  const fitPoints = useMemo<[number, number][]>(() => {
    const pts: [number, number][] = [];
    if (driverPos) pts.push(driverPos);
    if (pickupPos && showPickup) pts.push(pickupPos);
    if (destPos && showDestination) pts.push(destPos);
    return pts;
  }, [driverPos, pickupPos, destPos, showPickup, showDestination]);

  useEffect(() => {
    const start = driverPos;
    const end = showPickup && pickupPos ? pickupPos : showDestination && destPos ? destPos : null;

    if (!start || !end) {
      setRoutePoints([]);
      return;
    }

    const now = Date.now();
    if (now - lastRouteFetch.current < 5000) return;
    lastRouteFetch.current = now;

    const fetchRoute = async () => {
      try {
        const url = `https://router.project-osrm.org/route/v1/driving/${start[1]},${start[0]};${end[1]},${end[0]}?overview=full&geometries=geojson`;
        const res = await fetch(url);
        const data = await res.json();

        if (data.code === "Ok" && data.routes?.[0]?.geometry?.coordinates) {
          const coords: [number, number][] = data.routes[0].geometry.coordinates.map(
            ([lon, lat]: [number, number]) => [lat, lon]
          );
          setRoutePoints(coords);
          onDurationChange?.(data.routes[0]?.duration || null);
        } else {
          setRoutePoints(start && end ? [start, end] : []);
          onDurationChange?.(null);
        }
      } catch {
        setRoutePoints(start && end ? [start, end] : []);
        onDurationChange?.(null);
      }
    };

    fetchRoute();
  }, [driverPos, pickupPos, destPos, showPickup, showDestination]);

  return (
    <div className="relative h-full w-full">
      <MapView
        initialViewState={{
          longitude: FREETOWN_CENTER[1],
          latitude: FREETOWN_CENTER[0],
          zoom: 14,
          pitch: 45,
          bearing: 0,
        }}
        scrollZoom={false}
        dragPan
        style={{ width: "100%", height: "100%" }}
      >
        <CameraController fitPoints={fitPoints} padding={60} />

        {driverPos && (
          <LocationMarker
            latitude={driverPos[0]}
            longitude={driverPos[1]}
            type="driver"
            heading={driverHeading}
          />
        )}

        {pickupPos && showPickup && (
          <LocationMarker
            latitude={pickupPos[0]}
            longitude={pickupPos[1]}
            type="pickup"
          />
        )}

        {destPos && showDestination && (
          <LocationMarker
            latitude={destPos[0]}
            longitude={destPos[1]}
            type="destination"
          />
        )}

        {routePoints.length > 1 && <RouteLayer points={routePoints} />}

        <MapControls />
      </MapView>
    </div>
  );
}
