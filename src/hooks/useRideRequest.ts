import { useEffect, useRef, useState, useCallback } from "react";
import { RealtimeChannel } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";
import { useAuth } from "./useAuth";

const playNotificationSound = () => {
  try {
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = "sine";
    osc.frequency.value = 800;
    gain.gain.value = 0.3;
    osc.start();
    osc.stop(ctx.currentTime + 0.15);
    setTimeout(() => {
      const osc2 = ctx.createOscillator();
      const gain2 = ctx.createGain();
      osc2.connect(gain2);
      gain2.connect(ctx.destination);
      osc2.type = "sine";
      osc2.frequency.value = 1000;
      gain2.gain.value = 0.3;
      osc2.start();
      osc2.stop(ctx.currentTime + 0.35);
      setTimeout(() => ctx.close(), 500);
    }, 200);
  } catch {}
};

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
  type?: string;
}

interface UseRideRequestOptions {
  enabled: boolean;
}

type InvitationPayload = {
  new?: Record<string, unknown>;
  old?: Record<string, unknown>;
  eventType?: string;
};

export function useRideRequest({ enabled }: UseRideRequestOptions) {
  const { user, driver } = useAuth();
  const [incomingRides, setIncomingRides] = useState<IncomingRide[]>([]);
  const channelRef = useRef<RealtimeChannel | null>(null);
  const checkPendingRef = useRef<(() => void) | null>(null);
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const removeRideFromQueueRef = useRef<(rideId: string) => void>(() => {});

  const incomingRide = incomingRides.length > 0 ? incomingRides[0] : null;
  const pendingCount = incomingRides.length;

  const removeRideFromQueue = useCallback((rideId: string) => {
    setIncomingRides((prev) => prev.filter((r) => r.id !== rideId));
  }, []);

  removeRideFromQueueRef.current = removeRideFromQueue;

  const clearIncoming = useCallback(() => {
    setIncomingRides([]);
  }, []);

  const prevCountRef = useRef(0);
  useEffect(() => {
    if (incomingRides.length > prevCountRef.current) {
      playNotificationSound();
      if (navigator.vibrate) {
        navigator.vibrate([200, 100, 200]);
      }
    }
    prevCountRef.current = incomingRides.length;
  }, [incomingRides.length]);

  const acknowledgeInvitation = useCallback(async (invitationId: string) => {
    const { error } = await supabase.rpc("acknowledge_invitation", { p_invitation_id: invitationId });
    if (error) console.error("acknowledgeInvitation failed:", error);
  }, []);

  useEffect(() => {
    if (!enabled || !user) {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = null;
      }
      setIncomingRides([]);
      return;
    }

    let cancelled = false;

    const handleInvitationChange = async (payload: InvitationPayload) => {
      try {
        const rideId =
          (payload.new?.ride_id as string | undefined) ??
          (payload.old?.ride_id as string | undefined);

        if (payload.eventType === "DELETE") {
          if (rideId) removeRideFromQueueRef.current(rideId);
          return;
        }

        const inv = payload.new;
        if (!inv) return;

        if (inv.status !== "pending") {
          if (rideId) removeRideFromQueueRef.current(rideId);
          return;
        }

        if (inv.driver_id !== user.id) return;

        if (!rideId) return;

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

        const newRide: IncomingRide = {
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
          type: ride.type,
        };

        setIncomingRides((prev) => {
          if (prev.some((r) => r.id === newRide.id)) return prev;
          return [...prev, newRide];
        });

        acknowledgeInvitation(inv.id as string);
      } catch (err) {
        console.error("handleInvitationChange error:", err);
      }
    };

    const checkForPending = async () => {
      try {
        const { data: pendingInvites } = await supabase
          .from("ride_invitations")
          .select("ride_id, id")
          .eq("driver_id", user.id)
          .eq("status", "pending")
          .order("created_at", { ascending: false });

        if (pendingInvites && pendingInvites.length > 0) {
          for (const invite of pendingInvites) {
            const { data: ride } = await supabase
              .from("rides")
              .select("*")
              .eq("id", invite.ride_id)
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

              setIncomingRides((prev) => {
                if (prev.some((r) => r.id === ride.id)) return prev;
                return [...prev, {
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
                  invitation_id: invite.id,
                  type: ride.type,
                }];
              });
            }
          }
        }
      } catch (err) {
        console.error("checkForPending failed:", err);
      }
    };

    checkPendingRef.current = checkForPending;
    checkForPending();

    const subscribeToInvitations = () => {
      if (cancelled) return;

      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }

      const channel = supabase
        .channel(`ride-invitations-${user.id}-${Date.now()}`)
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "ride_invitations",
            filter: `driver_id=eq.${user.id}`,
          },
          (payload) => {
            handleInvitationChange(payload as InvitationPayload);
          }
        )
        .subscribe((status) => {
          if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
            if (reconnectTimeoutRef.current) {
              clearTimeout(reconnectTimeoutRef.current);
            }
            reconnectTimeoutRef.current = setTimeout(() => {
              if (cancelled) return;
              checkPendingRef.current?.();
              subscribeToInvitations();
            }, 3000);
          }
        });

      channelRef.current = channel;
    };

    subscribeToInvitations();

    return () => {
      cancelled = true;
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = null;
      }
    };
  }, [enabled, user, acknowledgeInvitation]);

  const acceptRide = useCallback(
    async (rideId: string, invitationId?: string, studentUserId?: string) => {
      if (!user) return false;

      try {
        const { data, error } = await supabase.rpc("accept_ride", {
          p_ride_id: rideId,
          p_driver_id: user.id,
        });

        if (error) {
          console.error("Accept ride RPC error:", error);
          return false;
        }

        const result = data as {
          success: boolean;
          reason?: string;
          driver_name?: string;
          driver_phone?: string;
          vehicle?: string;
        };

        if (!result.success) {
          console.error("Accept ride failed:", result.reason);
          return false;
        }

        removeRideFromQueue(rideId);

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
      } catch (err) {
        console.error("Accept ride error:", err);
        return false;
      }
    },
    [removeRideFromQueue, driver, user]
  );

  const declineRide = useCallback(
    async (rideId: string) => {
      if (!user) return false;

      try {
        const { data, error } = await supabase.rpc("decline_ride_invitation", {
          p_ride_id: rideId,
          p_driver_id: user.id,
        });

        if (error) {
          console.error("Decline ride RPC error:", error);
          return false;
        }

        const result = data as { success: boolean; reason?: string };

        if (result.success) {
          removeRideFromQueue(rideId);
          return true;
        }

        console.error("Decline ride failed:", result.reason);
        return false;
      } catch (err) {
        console.error("Decline ride error:", err);
        return false;
      }
    },
    [removeRideFromQueue, user]
  );

  return { incomingRide, incomingRides, pendingCount, clearIncoming, acceptRide, declineRide };
}
