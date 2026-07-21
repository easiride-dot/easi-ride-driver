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
  invitation_id?: string;
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
      setIncomingRide(null);
      return;
    }

    const handleNewInvitation = async (payload: { new: Record<string, unknown> }) => {
      const inv = payload.new;
      if (inv.status !== "pending") return;
      if (inv.driver_id !== user.id) return;

      const rideId = inv.ride_id as string;

      // Fetch ride details
      const { data: ride } = await supabase
        .from("rides")
        .select("*")
        .eq("id", rideId)
        .maybeSingle();

      if (!ride) return;

      let studentName = "Passenger";
      if (ride.user_id) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("full_name")
          .eq("id", ride.user_id)
          .maybeSingle();
        if (profile?.full_name) {
          studentName = profile.full_name.split(" ")[0];
        }
      }

      setIncomingRide({
        id: ride.id,
        pickup: ride.pickup,
        destination: ride.destination,
        pickup_latitude: ride.pickup_latitude,
        pickup_longitude: ride.pickup_longitude,
        destination_latitude: ride.destination_latitude,
        destination_longitude: ride.destination_longitude,
        distance_km: ride.distance_km,
        fare_amount: ride.fare_amount,
        user_id: ride.user_id,
        status: ride.status,
        student_name: studentName,
        invitation_id: inv.id as string,
      });
    };

    const checkForPending = async () => {
      try {
        const { data: pendingInvites } = await supabase
          .from("ride_invitations")
          .select("ride_id")
          .eq("driver_id", user.id)
          .eq("status", "pending")
          .limit(1);

        if (pendingInvites && pendingInvites.length > 0) {
          const rideId = pendingInvites[0].ride_id;
          const { data: ride } = await supabase
            .from("rides")
            .select("*")
            .eq("id", rideId)
            .maybeSingle();

          if (ride) {
            let studentName = "Passenger";
            if (ride.user_id) {
              const { data: profile } = await supabase
                .from("profiles")
                .select("full_name")
                .eq("id", ride.user_id)
                .maybeSingle();
              if (profile?.full_name) {
                studentName = profile.full_name.split(" ")[0];
              }
            }
            setIncomingRide({
              id: ride.id,
              pickup: ride.pickup,
              destination: ride.destination,
              pickup_latitude: ride.pickup_latitude,
              pickup_longitude: ride.pickup_longitude,
              destination_latitude: ride.destination_latitude,
              destination_longitude: ride.destination_longitude,
              distance_km: ride.distance_km,
              fare_amount: ride.fare_amount,
              user_id: ride.user_id,
              status: ride.status,
              student_name: studentName,
            });
          }
        }
      } catch {
        // silent
      }
    };

    checkPendingRef.current = checkForPending;
    checkForPending();

    // Listen for INSERT on ride_invitations for this driver
    const channel = supabase
      .channel(`ride-invitations-${user.id}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "ride_invitations",
          filter: `driver_id=eq.${user.id}`,
        },
        (payload) => {
          handleNewInvitation(payload as { new: Record<string, unknown> });
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
      if (!user) return false;

      // Get auth token
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;

      // Use API for atomic acceptance
      try {
        const apiBase = import.meta.env.VITE_API_URL || "";
        const response = await fetch(`${apiBase}/api/accept-ride`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify({ rideId }),
        });

        const result = await response.json();

        if (!result.success) {
          console.warn("Accept ride failed:", result.reason);
          return false;
        }

        clearIncoming();

        // Send push to student from the client as well (backup)
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
          } catch {
            // best-effort
          }
        }

        checkPendingRef.current?.();
        return true;
      } catch {
        return false;
      }
    },
    [clearIncoming, driver, user]
  );

  const declineRide = useCallback(
    async (rideId: string) => {
      if (!user) return false;

      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;

      try {
        const apiBase = import.meta.env.VITE_API_URL || "";
        const response = await fetch(`${apiBase}/api/decline-ride-invitation`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify({ rideId }),
        });

        const result = await response.json();
        if (result.success) {
          clearIncoming();
          return true;
        }
      } catch {
        // API unreachable
      }

      return false;
    },
    [clearIncoming, user]
  );

  return { incomingRide, clearIncoming, acceptRide, declineRide };
}
