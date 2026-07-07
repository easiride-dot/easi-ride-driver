import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { MessageSquareWarning, ArrowLeft, Loader2 } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/useAuth";
import { useGeolocation } from "@/hooks/useGeolocation";
import { useGeofence, ActiveRide } from "@/hooks/useGeofence";
import { ActiveRideMap } from "@/components/ActiveRideMap";
import { BottomSheet } from "@/components/BottomSheet";
import { openWhatsApp } from "@/lib/utils";

export default function ActiveRidePage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { driver } = useAuth();
  
  const [ride, setRide] = useState<ActiveRide | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [etaSeconds, setEtaSeconds] = useState<number | null>(null);

  // Watch GPS and automatically upsert to driver_locations
  const geoState = useGeolocation(id);

  // Start watching on mount (stable refs, not geoState object)
  useEffect(() => {
    geoState.startWatching();
    return () => geoState.stopWatching();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Fetch initial ride state
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

        // Fetch passenger info separately to avoid RLS issues
        let studentName = null;
        let studentPhone = null;
        if (data.user_id) {
          const { data: profileData } = await supabase
            .from("profiles")
            .select("full_name, phone")
            .eq("id", data.user_id)
            .single();
          
          if (profileData) {
            studentName = profileData.full_name;
            studentPhone = profileData.phone;
          }
        }

        setRide({
          ...data,
          student_name: studentName,
          student_phone: studentPhone,
        } as ActiveRide);
      } catch (err) {
        setError("Failed to load ride details.");
      } finally {
        setLoading(false);
      }
    };

    fetchRide();
  }, [id, driver]);

  // Listen for realtime updates on this specific ride
  useEffect(() => {
    if (!id) return;

    const channel = supabase
      .channel(`active-ride-${id}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "rides",
          filter: `id=eq.${id}`,
        },
        (payload) => {
          setRide((prev) => (prev ? { ...prev, ...(payload.new as Partial<ActiveRide>) } : null));
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [id]);

  // Hook up Geofencing for automatic status transitions
  useGeofence({
    ride,
    geoState,
  });

  const handleEmergency = () => {
    openWhatsApp(
      undefined, // uses default support number
      `EMERGENCY: I am a driver (${driver?.full_name}, ${driver?.phone}). I need immediate assistance on ride ${id}.`
    );
  };

  const handleStatusChange = async (newStatus: string) => {
    try {
      const { error } = await supabase
        .from("rides")
        .update({ status: newStatus, updated_at: new Date().toISOString() })
        .eq("id", id);

      if (error) {
        console.error("Failed to update ride status:", error);
      }
    } catch (err) {
      console.error("Failed to update ride status:", err);
    }
  };

  const handleCancelRide = async () => {
    try {
      const { error } = await supabase
        .from("rides")
        .update({ 
          status: "cancelled", 
          driver_id: null,
          updated_at: new Date().toISOString() 
        })
        .eq("id", id);

      if (error) {
        console.error("Failed to cancel ride:", error);
      } else {
        navigate("/dashboard");
      }
    } catch (err) {
      console.error("Failed to cancel ride:", err);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-4">
        <Loader2 className="h-8 w-8 text-primary animate-spin" />
        <p className="text-sm text-muted-foreground uppercase tracking-widest">
          Loading ride...
        </p>
      </div>
    );
  }

  if (error || !ride) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6 text-center">
        <div className="h-16 w-16 rounded-full bg-destructive/10 flex items-center justify-center mb-4">
          <MessageSquareWarning className="h-8 w-8 text-destructive" />
        </div>
        <h2 className="text-xl font-display font-semibold mb-2">Error</h2>
        <p className="text-muted-foreground text-sm mb-8">{error}</p>
        <button
          onClick={() => navigate("/dashboard")}
          className="flex items-center gap-2 text-sm font-semibold text-primary hover:underline uppercase tracking-wider"
        >
          <ArrowLeft className="h-4 w-4" /> Return to Dashboard
        </button>
      </div>
    );
  }

  const isCompleted = ride.status === "completed" || ride.status === "cancelled";

  return (
    <div className="relative flex flex-col h-[100dvh] bg-background overflow-hidden">
      {/* Top Header - Overlays map */}
      <div className="absolute top-0 left-0 right-0 z-50 pt-12 pb-4 px-4 bg-gradient-to-b from-black/80 to-transparent pointer-events-none">
        <button
          onClick={() => navigate("/dashboard")}
          className="pointer-events-auto flex items-center justify-center h-10 w-10 rounded-full bg-background/80 backdrop-blur-md border border-hairline/50 shadow-elevated transition-colors hover:bg-secondary"
        >
          <ArrowLeft className="h-5 w-5 text-foreground" />
        </button>
      </div>

      {/* Map Section (60% height) */}
      <div className="flex-none h-[60dvh] relative z-0">
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

      {/* Bottom Sheet Section (40% height) */}
      <div className="flex-1 relative z-10 -mt-6">
        <BottomSheet 
          ride={ride} 
          className="h-full min-h-full" 
          onEmergency={handleEmergency}
          onStatusChange={handleStatusChange}
          etaSeconds={etaSeconds}
          onCancelRide={handleCancelRide}
        />
      </div>
    </div>
  );
}
