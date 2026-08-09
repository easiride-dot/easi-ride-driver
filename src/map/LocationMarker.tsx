import { Marker } from "./gl";

interface LocationMarkerProps {
  latitude: number;
  longitude: number;
  type: "driver" | "pickup" | "destination";
  heading?: number | null;
}

// Top-down car silhouette with wheels + drop shadow, rotated by the driver's
// heading — reads as 3D on the tilted map (the Uber technique of a 2D sprite
// parked on the map at an angle).
function CarGlyph({ heading }: { heading?: number | null }) {
  const rotation = heading ?? 0;
  return (
    <div
      style={{ transform: `rotate(${rotation}deg)`, transition: "transform 0.3s ease" }}
      className="relative flex items-center justify-center h-14 w-14 drop-shadow-2xl z-50"
    >
      <svg width="42" height="42" viewBox="0 0 80 80">
        <ellipse cx="40" cy="46" rx="31" ry="34" fill="rgba(0,0,0,0.35)" />
        <rect x="8" y="12" width="9" height="15" rx="4" fill="#141414" />
        <rect x="63" y="12" width="9" height="15" rx="4" fill="#141414" />
        <rect x="8" y="52" width="9" height="15" rx="4" fill="#141414" />
        <rect x="63" y="52" width="9" height="15" rx="4" fill="#141414" />
        <path
          d="M 28 11 C 22 11 17 14 14 20 C 10 28 9 38 11 48 C 13 57 18 64 26 68 C 33 71 47 71 54 68 C 62 64 67 57 69 48 C 71 38 70 28 66 20 C 63 14 58 11 52 11 C 46 8 34 8 28 11 Z"
          fill="#ffffff"
          stroke="#111827"
          strokeWidth="2"
        />
        <polygon points="32,18 48,18 58,31 22,31" fill="#6B7C93" />
        <rect x="13" y="35" width="4.5" height="13" rx="2" fill="#6B7C93" />
        <rect x="62.5" y="35" width="4.5" height="13" rx="2" fill="#6B7C93" />
        <polygon points="24,49 56,49 50,59 30,59" fill="#6B7C93" />
        <rect x="10" y="38" width="5" height="7" rx="2.5" fill="#141414" />
        <rect x="65" y="38" width="5" height="7" rx="2.5" fill="#141414" />
        <rect x="24" y="14" width="6" height="4" rx="2" fill="#FFE08A" />
        <rect x="50" y="14" width="6" height="4" rx="2" fill="#FFE08A" />
        <rect x="24" y="63" width="6" height="4" rx="2" fill="#E23B3B" />
        <rect x="50" y="63" width="6" height="4" rx="2" fill="#E23B3B" />
      </svg>
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
        return <CarGlyph heading={heading} />;
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