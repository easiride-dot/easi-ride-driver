import { useEffect, useRef, useState, useCallback } from "react";
import { RealtimeChannel } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";
import { useAuth } from "./useAuth";

export interface IncomingRide {
  id: string;
  pickup: string;
  destination: string;
  pickup_latitude: number | null;
  pickup_longitude: number | null;
  destination_latitude: number | null;
  destination_longitude: number | null;
  distance_km: number | null;
  fare_amount: number | null;
  user_id: string;
  status: string;
  student_name?: string;
}

interface UseRideRequestOptions {
  enabled: boolean;
}

export function useRideRequest({ enabled }: UseRideRequestOptions) {
  const { user, driver } = useAuth();
  const [incomingRide, setIncomingRide] = useState<IncomingRide | null>(null);
  const channelRef = useRef<RealtimeChannel | null>(null);
  const checkPendingRef = useRef<(() => void) | null>(null);

  const clearIncoming = useCallback(() => setIncomingRide(null), []);

  useEffect(() => {
    if (!enabled || !user) {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
      return;
    }

    const handleRideUpdate = async (ride: Record<string, unknown>) => {
      if (ride.status !== "pending_driver_acceptance") return;

      let studentName = "Passenger";
      if (ride.user_id) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("full_name")
          .eq("id", ride.user_id as string)
          .single();
        if (profile?.full_name) {
          studentName = profile.full_name.split(" ")[0];
        }
      }

      setIncomingRide({
        id: ride.id as string,
        pickup: ride.pickup as string,
        destination: ride.destination as string,
        pickup_latitude: ride.pickup_latitude as number | null,
        pickup_longitude: ride.pickup_longitude as number | null,
        destination_latitude: ride.destination_latitude as number | null,
        destination_longitude: ride.destination_longitude as number | null,
        distance_km: ride.distance_km as number | null,
        fare_amount: ride.fare_amount as number | null,
        user_id: ride.user_id as string,
        status: ride.status as string,
        student_name: studentName,
      });
    };

    const checkForPending = () => {
      supabase
        .from("rides")
        .select("*")
        .eq("driver_id", user.id)
        .eq("status", "pending_driver_acceptance")
        .limit(1)
        .then(({ data }) => {
          if (data && data.length > 0) {
            handleRideUpdate(data[0] as unknown as Record<string, unknown>);
          }
        });
    };

    checkPendingRef.current = checkForPending;
    checkForPending();

    const channel = supabase
      .channel(`driver-rides-${user.id}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "rides",
          filter: `driver_id=eq.${user.id}`,
        },
        (payload) => {
          handleRideUpdate(payload.new as Record<string, unknown>);
        }
      )
      .subscribe();

    channelRef.current = channel;

    return () => {
      supabase.removeChannel(channel);
      channelRef.current = null;
    };
  }, [enabled, user]);

  const acceptRide = useCallback(
    async (rideId: string, studentUserId?: string) => {
      const { error } = await supabase
        .from("rides")
        .update({
          status: "driver_assigned",
          driver_accepted_at: new Date().toISOString(),
          eta_minutes: 5 + Math.floor(Math.random() * 10),
          updated_at: new Date().toISOString(),
        })
        .eq("id", rideId);

      if (error) return false;

      clearIncoming();

      if (studentUserId && driver) {
        try {
          await fetch(
            `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/send-push-notification`,
            {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                "x-api-key": import.meta.env.VITE_PUSH_NOTIFICATIONS_API_KEY,
              },
              body: JSON.stringify({
                userId: studentUserId,
                title: "Driver Assigned!",
                message: `${driver.full_name} is on the way in a ${driver.vehicle}`,
                type: "ride",
                url: "/dashboard",
              }),
            }
          );
        } catch (e) {
          console.warn("Push notification failed:", e);
        }
      }

      checkPendingRef.current?.();
      return true;
    },
    [clearIncoming, driver]
  );

  const declineRide = useCallback(
    async (rideId: string) => {
      const { error } = await supabase
        .from("rides")
        .update({
          status: "pool_locked_awaiting_driver",
          driver_declined_at: new Date().toISOString(),
          driver_id: null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", rideId);

      if (!error) {
        clearIncoming();
        return true;
      }
      return false;
    },
    [clearIncoming]
  );

  return { incomingRide, clearIncoming, acceptRide, declineRide };
}
