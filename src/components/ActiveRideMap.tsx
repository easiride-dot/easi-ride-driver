import { useEffect, useMemo, useRef, useState } from "react";
import {
  MapContainer,
  TileLayer,
  Marker,
  Polyline,
  useMap,
} from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

// Freetown center as fallback
const FREETOWN_CENTER: [number, number] = [8.4844, -13.2344];

// ── Custom map icons ──────────────────────────────────────────────────────────

const getDriverIcon = (heading: number | null) => {
  const rotation = heading ?? 0;
  return L.divIcon({
    className: "custom-driver-marker",
    html: `
      <div style="transform: rotate(${rotation}deg); transition: transform 0.3s ease;" class="relative flex items-center justify-center h-12 w-12 drop-shadow-xl z-50">
        <div class="flex h-10 w-10 items-center justify-center rounded-full bg-blue-500 border-2 border-background shadow-lg">
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" class="text-white">
            <path d="M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10s-1.3-1.4-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H5c-.6 0-1.1.4-1.4.9l-1.4 2.9A3.7 3.7 0 0 0 2 12v4c0 .6.4 1 1 1h2"/>
            <circle cx="7" cy="17" r="2"/>
            <path d="M9 17h6"/>
            <circle cx="17" cy="17" r="2"/>
          </svg>
        </div>
      </div>
    `,
    iconSize: [48, 48],
    iconAnchor: [24, 24],
  });
};

const pickupIcon = L.divIcon({
  className: "custom-pickup-marker",
  html: `
    <div class="relative flex items-center justify-center h-10 w-10">
      <span class="animate-ping-slow absolute inline-flex h-8 w-8 rounded-full bg-emerald-500/20 opacity-75"></span>
      <div class="relative flex h-5 w-5 items-center justify-center rounded-full bg-emerald-500 border-2 border-background shadow-lg">
        <div class="h-2 w-2 rounded-full bg-background"></div>
      </div>
    </div>
  `,
  iconSize: [40, 40],
  iconAnchor: [20, 20],
});

const destinationIcon = L.divIcon({
  className: "custom-destination-marker",
  html: `
    <div class="relative flex items-center justify-center h-12 w-12 animate-fade-up">
      <div class="flex h-9 w-9 items-center justify-center rounded-full bg-red-500 border-2 border-white shadow-elevated">
        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5">
          <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
          <polyline points="9 22 9 12 15 12 15 22"/>
        </svg>
      </div>
    </div>
  `,
  iconSize: [48, 48],
  iconAnchor: [24, 24],
});

// ── Map auto-fitter ───────────────────────────────────────────────────────────

function MapAutoFitter({ coords }: { coords: [number, number][] }) {
  const map = useMap();

  useEffect(() => {
    if (coords.length === 0) return;
    if (coords.length === 1) {
      map.setView(coords[0], 15, { animate: true });
      return;
    }
    const bounds = L.latLngBounds(coords);
    map.fitBounds(bounds, { padding: [60, 60], maxZoom: 16 });
  }, [coords, map]);

  return null;
}

// ── Main component ────────────────────────────────────────────────────────────

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
  const [routePolyline, setRoutePolyline] = useState<[number, number][]>([]);
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

  // Points to fit in view
  const fitCoords = useMemo<[number, number][]>(() => {
    const pts: [number, number][] = [];
    if (driverPos) pts.push(driverPos);
    if (pickupPos && showPickup) pts.push(pickupPos);
    if (destPos && showDestination) pts.push(destPos);
    return pts;
  }, [driverPos, pickupPos, destPos, showPickup, showDestination]);

  // Fetch OSRM route
  useEffect(() => {
    const start = driverPos;
    const end = showPickup && pickupPos ? pickupPos : showDestination && destPos ? destPos : null;

    if (!start || !end) {
      setRoutePolyline([]);
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
          setRoutePolyline(coords);
          // Pass duration in seconds to parent
          onDurationChange?.(data.routes[0]?.duration || null);
        } else {
          setRoutePolyline(start && end ? [start, end] : []);
          onDurationChange?.(null);
        }
      } catch {
        setRoutePolyline(start && end ? [start, end] : []);
        onDurationChange?.(null);
      }
    };

    fetchRoute();
  }, [driverPos, pickupPos, destPos, showPickup, showDestination]);

  const center = driverPos ?? pickupPos ?? destPos ?? FREETOWN_CENTER;

  return (
    <MapContainer
      center={center}
      zoom={14}
      scrollWheelZoom={false}
      zoomControl={false}
      className="h-full w-full"
    >
      {/* Dark CARTO tiles matching easi-ride aesthetic */}
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
        url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
      />

      <MapAutoFitter coords={fitCoords} />

      {/* Driver position — car icon */}
      {driverPos && <Marker position={driverPos} icon={getDriverIcon(driverHeading)} />}

      {/* Pickup pin — green */}
      {pickupPos && showPickup && <Marker position={pickupPos} icon={pickupIcon} />}

      {/* Destination pin — red */}
      {destPos && showDestination && <Marker position={destPos} icon={destinationIcon} />}

      {/* OSRM route polyline */}
      {routePolyline.length > 1 && (
        <Polyline
          positions={routePolyline}
          pathOptions={{
            color: "#3b82f6",
            weight: 4,
            opacity: 0.85,
            lineCap: "round",
            lineJoin: "round",
          }}
        />
      )}
    </MapContainer>
  );
}
