import { useNavigate, useLocation } from "react-router-dom";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/useAuth";
import { RideRequestModal } from "@/components/RideRequestModal";
import type { IncomingRide } from "@/hooks/useRideRequest";

export default function RideRequestPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, driver } = useAuth();

  const ride = (location.state as { ride?: IncomingRide })?.ride;

  if (!ride || !user) {
    navigate("/dashboard", { replace: true });
    return null;
  }

  const handleAccept = async () => {
    const { data, error } = await supabase.rpc("accept_ride", {
      p_ride_id: ride.id,
      p_driver_id: user.id,
    });
    if (error) {
      toast.error(error.message);
      return;
    }
    const result = data as { success: boolean; reason?: string; driver_name?: string; driver_phone?: string; vehicle?: string };
    if (!result.success) {
      toast.error(result.reason || "Could not accept ride.");
      return;
    }
    if (ride.user_id && driver) {
      fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/send-push-notification`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": import.meta.env.VITE_PUSH_NOTIFICATIONS_API_KEY,
        },
        body: JSON.stringify({
          userId: ride.user_id,
          title: "Driver Assigned!",
          message: `${driver.full_name} is on the way in a ${driver.vehicle}`,
          type: "ride",
          url: "/dashboard",
        }),
      }).catch(() => {});
    }
    navigate(`/ride/${ride.id}`, { replace: true });
  };

  const handleDecline = async () => {
    const { error } = await supabase.rpc("decline_ride_invitation", {
      p_ride_id: ride.id,
      p_driver_id: user.id,
    });
    if (error) {
      toast.error(error.message);
      return;
    }
    navigate("/dashboard", { replace: true });
  };

  return (
    <div className="min-h-screen bg-background">
      <RideRequestModal
        ride={ride}
        onAccept={handleAccept}
        onDecline={handleDecline}
      />
    </div>
  );
}
