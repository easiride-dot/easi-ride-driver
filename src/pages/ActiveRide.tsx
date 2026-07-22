import { useEffect, useState, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  MessageSquareWarning, ArrowLeft, Loader2, MapPin, Navigation,
  Phone, User, CheckCircle, Clock
} from "lucide-react";
import { toast } from "sonner";
import * as Drawer from "vaul";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/useAuth";
import { useGeolocation } from "@/hooks/useGeolocation";
import { useGeofence, ActiveRide } from "@/hooks/useGeofence";
import { ActiveRideMap } from "@/components/ActiveRideMap";
import { openWhatsApp, formatNLe, cn } from "@/lib/utils";

const STATUS_CONFIG: Record<
  string,
  { label: string; sublabel: string; color: string; bgColor: string }
> = {
  driver_assigned: {
    label: "Heading to Pickup",
    sublabel: "Drive to the pickup location",
    color: "text-blue-400", bgColor: "bg-blue-500/15",
  },
  driver_arrived: {
    label: "Arrived at Pickup",
    sublabel: "Waiting for passenger to board",
    color: "text-amber-400", bgColor: "bg-amber-500/15",
  },
  in_progress: {
    label: "En Route to Destination",
    sublabel: "Driving to drop-off",
    color: "text-emerald-400", bgColor: "bg-emerald-500/15",
  },
  completed: {
    label: "Ride Completed",
    sublabel: "Great ride!",
    color: "text-emerald-400", bgColor: "bg-emerald-500/15",
  },
  cancelled: {
    label: "Cancelled",
    sublabel: "This ride was cancelled",
    color: "text-destructive", bgColor: "bg-destructive/15",
  },
};

export default function ActiveRidePage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { driver } = useAuth();

  const [ride, setRide] = useState<ActiveRide | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [etaSeconds, setEtaSeconds] = useState<number | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(true);
  const [snap, setSnap] = useState<number | string | null>(0.85);
  const [statusLoading, setStatusLoading] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const drawerRef = useRef<HTMLDivElement>(null);

  const geoState = useGeolocation(id);

  useEffect(() => {
    geoState.startWatching();
    return () => geoState.stopWatching();
  }, []);

  useEffect(() => {
    if (!id || !driver) return;

    const fetchRide = async () => {
      try {
        const { data, error } = await supabase
          .from("rides")
          .select("*")
          .eq("id", id)
          .eq("driver_id", driver.id)
          .single();

        if (error || !data) {
          setError("Ride not found or you are not assigned.");
          return;
        }

        let studentName = null;
        let studentPhone = null;
        if (data.user_id) {
          try {
            const { data: profileData } = await supabase
              .from("profiles")
              .select("full_name, phone")
              .eq("id", data.user_id)
              .maybeSingle();

            if (profileData) {
              studentName = profileData.full_name;
              studentPhone = profileData.phone;
            }
          } catch {}
        }

        if (data.status === "completed" || data.status === "cancelled") {
          navigate("/dashboard", { replace: true });
          return;
        }

        setRide({ ...data, student_name: studentName, student_phone: studentPhone } as ActiveRide);
      } catch {
        setError("Failed to load ride details.");
      } finally {
        setLoading(false);
      }
    };

    fetchRide();
  }, [id, driver]);

  useEffect(() => {
    if (!id) return;
    const channel = supabase
      .channel(`active-ride-${id}`)
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "rides", filter: `id=eq.${id}` },
        (payload) => {
          const updated = payload.new as Record<string, any>;
          if (updated.status === "completed" || updated.status === "cancelled") {
            navigate("/dashboard", { replace: true });
            return;
          }
          setRide((prev) => (prev ? { ...prev, ...updated } : null));
        }
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [id]);

  useGeofence({ ride, geoState, onStatusChange: (s) => setRide((prev) => (prev ? { ...prev, status: s } : null)) });

  const handleEmergency = () => {
    if (!window.confirm("Are you sure you want to send an emergency alert?")) return;
    openWhatsApp(undefined, `EMERGENCY: I am a driver (${driver?.full_name}, ${driver?.phone}). I need immediate assistance on ride ${id}.`);
  };

  const handleStatusChange = async (newStatus: string) => {
    if (!id) return;
    setStatusLoading(true);
    const { error } = await supabase.from("rides").update({ status: newStatus, updated_at: new Date().toISOString() }).eq("id", id);
    setStatusLoading(false);
    if (error) {
      console.error("Failed to update ride status:", error);
      toast.error("Failed to update status. Please try again.");
    }
  };

  const handleCancelRide = async () => {
    if (!driver || !id) return;
    setCancelling(true);
    const { error } = await supabase.rpc("cancel_ride", { ride_id: id, driver_user_id: driver.id });
    setCancelling(false);
    if (error) {
      console.error("Failed to cancel ride:", error);
      toast.error("Failed to cancel ride.");
    } else {
      navigate("/dashboard");
    }
  };

  if (loading) return (
    <div className="min-h-screen bg-background flex items-center justify-center gap-4">
      <Loader2 className="h-8 w-8 text-primary animate-spin" />
      <p className="text-sm text-muted-foreground uppercase tracking-widest">Loading ride...</p>
    </div>
  );

  if (error || !ride) return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6 text-center">
      <div className="h-16 w-16 rounded-full bg-destructive/10 flex items-center justify-center mb-4">
        <MessageSquareWarning className="h-8 w-8 text-destructive" />
      </div>
      <h2 className="text-xl font-display font-semibold mb-2">Error</h2>
      <p className="text-muted-foreground text-sm mb-8">{error || "Ride not found."}</p>
      <button onClick={() => navigate("/dashboard")} className="flex items-center gap-2 text-sm font-semibold text-primary hover:underline uppercase tracking-wider">
        <ArrowLeft className="h-4 w-4" /> Return to Dashboard
      </button>
    </div>
  );

  const isCompleted = ride.status === "completed" || ride.status === "cancelled";
  const config = STATUS_CONFIG[ride.status] ?? STATUS_CONFIG["driver_assigned"];
  const driverEarnings = ride.fare_amount ? Math.floor(ride.fare_amount * 0.8) : null;

  const formatEta = (seconds: number | null | undefined) => {
    if (!seconds) return null;
    const m = Math.ceil(seconds / 60);
    if (m < 1) return "< 1 min";
    return `${m} min`;
  };

  return (
    <div className="relative h-[100dvh] bg-black overflow-hidden">
      {/* Full-screen map */}
      <div className="absolute inset-0">
        <ActiveRideMap
          driverLat={geoState.latitude}
          driverLon={geoState.longitude}
          driverHeading={geoState.heading}
          pickupLat={ride.pickup_latitude}
          pickupLon={ride.pickup_longitude}
          destinationLat={ride.destination_latitude}
          destinationLon={ride.destination_longitude}
          showPickup={!isCompleted && ride.status !== "in_progress"}
          showDestination={!isCompleted}
          onDurationChange={setEtaSeconds}
        />
      </div>

      {/* Top header overlay */}
      <div className="absolute top-0 left-0 right-0 z-20 pt-12 pb-4 px-4 bg-gradient-to-b from-black/60 to-transparent pointer-events-none">
        <button
          onClick={() => navigate("/dashboard")}
          className="pointer-events-auto flex items-center justify-center h-10 w-10 rounded-full bg-background/80 backdrop-blur-md border border-hairline/50 shadow-elevated"
        >
          <ArrowLeft className="h-5 w-5 text-foreground" />
        </button>
      </div>

      {/* Draggable bottom drawer */}
      <Drawer.Root open={drawerOpen} onOpenChange={setDrawerOpen} dismissible={false} snapPoints={[0.35, 0.85]} activeSnapPoint={snap} setActiveSnapPoint={setSnap} modal={false}>
        <Drawer.Portal>
          <Drawer.Overlay className="fixed inset-0 bg-black/40" />
          <Drawer.Content
            ref={drawerRef}
            className="fixed bottom-0 left-0 right-0 z-30 flex flex-col rounded-t-3xl bg-[#1A1A1A] border-t border-hairline outline-none max-h-[85dvh] overflow-hidden"
            style={{ boxShadow: "0 -8px 30px rgba(0,0,0,0.3)" }}
          >
            {/* Drag handle */}
            <div className="mx-auto mt-3 mb-2 h-1.5 w-12 rounded-full bg-border flex-shrink-0" />

            <div className="flex-1 overflow-y-auto px-5 pb-8 space-y-4 min-h-0">
              {/* Status banner */}
              <div className={cn("flex items-center gap-3 rounded-2xl px-4 py-3", config.bgColor)}>
                <div className={cn("flex-shrink-0", config.color)}>
                  {ride.status === "in_progress" ? (
                    <Navigation className="h-5 w-5 animate-pulse" />
                  ) : (
                    <MapPin className="h-5 w-5" />
                  )}
                </div>
                <div className="flex-1">
                  <p className={cn("text-sm font-semibold", config.color)}>{config.label}</p>
                  <p className="text-xs text-muted-foreground">{config.sublabel}</p>
                </div>
                {!isCompleted && formatEta(etaSeconds) && (
                  <div className="text-right">
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground">ETA</p>
                    <p className="text-sm font-bold text-foreground">{formatEta(etaSeconds)}</p>
                  </div>
                )}
              </div>

              {/* Fare / Payment card */}
              {!isCompleted && (
                <div className="rounded-2xl bg-background border border-hairline p-4">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-xs text-muted-foreground">Trip fare</span>
                    <span className="font-display text-lg font-bold text-foreground">
                      {ride.fare_amount != null ? formatNLe(ride.fare_amount) : "—"}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>Your earnings (80%)</span>
                    <span className="font-semibold text-foreground">
                      {driverEarnings != null ? formatNLe(driverEarnings) : "—"}
                    </span>
                  </div>
                </div>
              )}

              {/* Completed: show earnings with green highlight */}
              {isCompleted && (
                <div className="rounded-2xl bg-emerald-500/10 border border-emerald-500/30 p-4 text-center">
                  <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground mb-1">Earned</p>
                  <p className="font-display text-3xl font-bold text-emerald-400">
                    {driverEarnings != null ? formatNLe(driverEarnings) : "—"}
                  </p>
                </div>
              )}

              {/* Passenger info */}
              {ride.student_name && (
                <div className="flex items-center gap-3 p-3 rounded-xl bg-background border border-hairline">
                  <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                    <User className="h-5 w-5 text-primary" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-[9px] uppercase tracking-[0.2em] text-muted-foreground mb-0.5">Passenger</p>
                    <p className="text-sm font-medium text-foreground">{ride.student_name}</p>
                  </div>
                  {ride.student_phone && (
                    <button onClick={() => window.open(`tel:${ride.student_phone}`, '_self')}
                      className="h-10 w-10 rounded-full bg-emerald-500/20 flex items-center justify-center shrink-0 hover:bg-emerald-500/30 transition-colors">
                      <Phone className="h-4 w-4 text-emerald-400" />
                    </button>
                  )}
                </div>
              )}

              {/* Pickup */}
              <div className="flex items-start gap-3 p-3 rounded-xl bg-background border border-hairline">
                <div className="mt-0.5 h-6 w-6 flex-shrink-0 rounded-full bg-emerald-500/20 flex items-center justify-center">
                  <MapPin className="h-3 w-3 text-emerald-400" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-[9px] uppercase tracking-[0.2em] text-muted-foreground mb-0.5">Pickup</p>
                  <p className="text-xs font-medium text-foreground leading-snug line-clamp-2">{ride.pickup}</p>
                </div>
              </div>

              {/* Destination */}
              <div className="flex items-start gap-3 p-3 rounded-xl bg-background border border-hairline">
                <div className="mt-0.5 h-6 w-6 flex-shrink-0 rounded-full bg-red-500/20 flex items-center justify-center">
                  <Navigation className="h-3 w-3 text-red-400" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-[9px] uppercase tracking-[0.2em] text-muted-foreground mb-0.5">Destination</p>
                  <p className="text-xs font-medium text-foreground leading-snug line-clamp-2">{ride.destination}</p>
                </div>
              </div>

              {/* Distance */}
              <div className="flex items-center justify-between p-3 rounded-xl bg-background border border-hairline">
                <span className="text-[9px] uppercase tracking-[0.2em] text-muted-foreground">Distance</span>
                <span className="text-sm font-bold text-foreground">
                  {ride.distance_km != null ? `${ride.distance_km.toFixed(1)} km` : "—"}
                </span>
              </div>

              {/* Action buttons */}
              {!isCompleted && (
                <div className="space-y-2 pt-2">
                  {ride.status === "driver_assigned" && (
                    <button onClick={() => handleStatusChange("driver_arrived")} disabled={statusLoading}
                      className="w-full flex items-center justify-center gap-2 h-14 rounded-2xl bg-amber-500 hover:bg-amber-600 transition-colors shadow-lg shadow-amber-500/20 disabled:opacity-50">
                      {statusLoading ? <Loader2 className="h-5 w-5 text-white animate-spin" /> : <Clock className="h-5 w-5 text-white" />}
                      <span className="text-sm font-bold text-white">Arrived at Pickup</span>
                    </button>
                  )}
                  {ride.status === "driver_arrived" && (
                    <button onClick={() => handleStatusChange("in_progress")} disabled={statusLoading}
                      className="w-full flex items-center justify-center gap-2 h-14 rounded-2xl bg-emerald-500 hover:bg-emerald-600 transition-colors shadow-lg shadow-emerald-500/20 disabled:opacity-50">
                      {statusLoading ? <Loader2 className="h-5 w-5 text-white animate-spin" /> : <Navigation className="h-5 w-5 text-white" />}
                      <span className="text-sm font-bold text-white">Start Ride</span>
                    </button>
                  )}
                  {ride.status === "in_progress" && (
                    <button onClick={() => handleStatusChange("completed")} disabled={statusLoading}
                      className="w-full flex items-center justify-center gap-2 h-14 rounded-2xl bg-emerald-500 hover:bg-emerald-600 transition-colors shadow-lg shadow-emerald-500/20 disabled:opacity-50">
                      {statusLoading ? <Loader2 className="h-5 w-5 text-white animate-spin" /> : <CheckCircle className="h-5 w-5 text-white" />}
                      <span className="text-sm font-bold text-white">Complete Ride</span>
                    </button>
                  )}
                  {(ride.status === "driver_assigned" || ride.status === "driver_arrived") && (
                    <button onClick={handleCancelRide} disabled={cancelling}
                      className="w-full flex items-center justify-center gap-2 h-12 rounded-2xl bg-destructive/10 hover:bg-destructive/20 border border-destructive/30 transition-colors disabled:opacity-50">
                      {cancelling ? <Loader2 className="h-5 w-5 text-destructive animate-spin" /> : <MessageSquareWarning className="h-5 w-5 text-destructive" />}
                      <span className="text-sm font-semibold text-destructive">Cancel Ride</span>
                    </button>
                  )}
                </div>
              )}

              {/* Emergency button */}
              {!isCompleted && (
                <button onClick={handleEmergency}
                  className="w-full flex items-center justify-center gap-2 h-12 rounded-2xl bg-destructive hover:bg-destructive/90 transition-colors shadow-[0_0_20px_rgba(239,68,68,0.3)]">
                  <MessageSquareWarning className="h-5 w-5 text-white" />
                  <span className="text-sm font-semibold text-white uppercase tracking-wider">Emergency</span>
                </button>
              )}
            </div>
          </Drawer.Content>
        </Drawer.Portal>
      </Drawer.Root>
    </div>
  );
}
