import { useEffect, useMemo, useRef, useState } from "react";
import { MapView, CameraController, LocationMarker, RouteLayer, MapControls } from "@/map";
import { MAP_CONFIG } from "@/map/map-style";
import { getMapboxDirections, type RoutePoint } from "@/map/directions";

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
  const [routePoints, setRoutePoints] = useState<RoutePoint[]>([]);
  const [tripRoutePoints, setTripRoutePoints] = useState<RoutePoint[]>([]);
  const lastRouteFetch = useRef(0);

  const driverPos = useMemo<RoutePoint | null>(
    () => (driverLat != null && driverLon != null ? [driverLat, driverLon] : null),
    [driverLat, driverLon]
  );

  const pickupPos = useMemo<RoutePoint | null>(
    () => (pickupLat != null && pickupLon != null ? [pickupLat, pickupLon] : null),
    [pickupLat, pickupLon]
  );

  const destPos = useMemo<RoutePoint | null>(
    () =>
      destinationLat != null && destinationLon != null
        ? [destinationLat, destinationLon]
        : null,
    [destinationLat, destinationLon]
  );

  const fitPoints = useMemo<RoutePoint[]>(() => {
    const pts: RoutePoint[] = [];
    if (driverPos) pts.push(driverPos);
    if (pickupPos && showPickup) pts.push(pickupPos);
    if (destPos && showDestination) pts.push(destPos);
    return pts;
  }, [driverPos, pickupPos, destPos, showPickup, showDestination]);

  // Fetch full trip route (pickup → destination) — static, fetched once
  useEffect(() => {
    if (!pickupPos || !destPos) {
      setTripRoutePoints([]);
      return;
    }

    const fetchTripRoute = async () => {
      const route = await getMapboxDirections(pickupPos, destPos);
      setTripRoutePoints(route && route.points.length > 1 ? route.points : [pickupPos, destPos]);
    };

    fetchTripRoute();
  }, [pickupPos, destPos]);

  // Fetch active navigation route (driver → pickup or driver → destination)
  useEffect(() => {
    const start = driverPos;
    const end = showPickup && pickupPos ? pickupPos : showDestination && destPos ? destPos : null;

    if (!start || !end) {
      setRoutePoints([]);
      return;
    }

    const now = Date.now();
    if (now - lastRouteFetch.current < 5000) return;

    const fetchRoute = async () => {
      lastRouteFetch.current = Date.now();
      const route = await getMapboxDirections(start, end);
      setRoutePoints(route && route.points.length > 1 ? route.points : [start, end]);
      onDurationChange?.(route ? route.durationSeconds : null);
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
        scrollZoom
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

        {/* Active navigation route (driver → pickup) */}
        {routePoints.length > 1 && (
          <RouteLayer points={routePoints} id="nav-route" color="#10b981" width={4} />
        )}

        {/* Trip route (pickup → destination) */}
        {tripRoutePoints.length > 1 && (
          <RouteLayer points={tripRoutePoints} id="trip-route" color="#3b82f6" width={5} />
        )}

        <MapControls />
      </MapView>
    </div>
  );
}
