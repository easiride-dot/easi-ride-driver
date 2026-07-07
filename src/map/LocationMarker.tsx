import { Marker } from "react-map-gl/maplibre";

interface LocationMarkerProps {
  latitude: number;
  longitude: number;
  type: "driver" | "pickup" | "destination";
  heading?: number | null;
}

function DriverMarker({ heading }: { heading?: number | null }) {
  const rotation = heading ?? 0;
  return (
    <div
      style={{ transform: `rotate(${rotation}deg)`, transition: "transform 0.3s ease" }}
      className="relative flex items-center justify-center h-12 w-12 drop-shadow-xl z-50"
    >
      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-500 border-2 border-white shadow-lg">
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5">
          <path d="M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10s-1.3-1.4-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H5c-.6 0-1.1.4-1.4.9l-1.4 2.9A3.7 3.7 0 0 0 2 12v4c0 .6.4 1 1 1h2"/>
          <circle cx="7" cy="17" r="2"/>
          <path d="M9 17h6"/>
          <circle cx="17" cy="17" r="2"/>
        </svg>
      </div>
    </div>
  );
}

function PickupMarker() {
  return (
    <div className="relative flex items-center justify-center h-10 w-10">
      <span className="absolute inline-flex h-8 w-8 rounded-full bg-emerald-500/20 animate-ping" style={{ animationDuration: "2s" }} />
      <div className="relative flex h-5 w-5 items-center justify-center rounded-full bg-emerald-500 border-2 border-white shadow-lg">
        <div className="h-2 w-2 rounded-full bg-white" />
      </div>
    </div>
  );
}

function DestinationMarker() {
  return (
    <div className="relative flex items-center justify-center h-12 w-12 animate-fade-up">
      <div className="flex h-9 w-9 items-center justify-center rounded-full bg-red-500 border-2 border-white shadow-elevated">
        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5">
          <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
          <polyline points="9 22 9 12 15 12 15 22"/>
        </svg>
      </div>
    </div>
  );
}

export function LocationMarker({ latitude, longitude, type, heading }: LocationMarkerProps) {
  const marker = (() => {
    switch (type) {
      case "driver":
        return <DriverMarker heading={heading} />;
      case "pickup":
        return <PickupMarker />;
      case "destination":
        return <DestinationMarker />;
    }
  })();

  return (
    <Marker longitude={longitude} latitude={latitude} anchor="center">
      {marker}
    </Marker>
  );
}
