import { useEffect, useRef, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { haversineMetres } from "@/lib/haversine";
import { GeolocationState } from "./useGeolocation";

export type RideStatus =
  | "pending"
  | "driver_assigned"
  | "accepted"
  | "driver_arrived"
  | "in_progress"
  | "completed"
  | "cancelled"
  | "pool_locked_awaiting_driver"
  | "paid_and_dispatched"
  | "pending_friend_commitment";

export interface ActiveRide {
  id: string;
  status: RideStatus;
  pickup: string;
  destination: string;
  pickup_latitude: number | null;
  pickup_longitude: number | null;
  destination_latitude: number | null;
  destination_longitude: number | null;
  distance_km: number | null;
  fare_amount: number | null;
  driver_id: string | null;
}

// Geofence thresholds in metres
const PICKUP_ARRIVE_THRESHOLD = 100;   // driver_arrived when ≤100m from pickup
const PICKUP_DEPART_THRESHOLD = 150;   // in_progress when >150m from pickup (passenger boarded)
const DESTINATION_ARRIVE_THRESHOLD = 100; // completed when ≤100m from destination

interface UseGeofenceOptions {
  ride: ActiveRide | null;
  geoState: GeolocationState;
  onStatusChange?: (newStatus: RideStatus) => void;
}

export function useGeofence({ ride, geoState, onStatusChange }: UseGeofenceOptions) {
  const processingRef = useRef(false);

  const transitionStatus = useCallback(
    async (rideId: string, newStatus: RideStatus, extraFields: Record<string, string>) => {
      if (processingRef.current) return;
      processingRef.current = true;

      try {
        const updatePayload: Record<string, unknown> = {
          status: newStatus,
          updated_at: new Date().toISOString(),
          ...extraFields,
        };

        const { error } = await supabase
          .from("rides")
          .update(updatePayload)
          .eq("id", rideId);

        if (!error) {
          onStatusChange?.(newStatus);
        } else {
          console.error("Geofence status update failed:", error);
        }
      } finally {
        // Small delay to prevent rapid re-triggers
        setTimeout(() => {
          processingRef.current = false;
        }, 3000);
      }
    },
    [onStatusChange]
  );

  useEffect(() => {
    if (!ride || !geoState.latitude || !geoState.longitude) return;

    const driverLat = geoState.latitude;
    const driverLon = geoState.longitude;

    const now = new Date().toISOString();

    // ── accepted → driver_arrived ──────────────────────────────────────
    if (
      ride.status === "accepted" &&
      ride.pickup_latitude != null &&
      ride.pickup_longitude != null
    ) {
      const distToPickup = haversineMetres(
        driverLat,
        driverLon,
        ride.pickup_latitude,
        ride.pickup_longitude
      );
      if (distToPickup <= PICKUP_ARRIVE_THRESHOLD) {
        transitionStatus(ride.id, "driver_arrived", { pickup_arrived_at: now });
      }
    }

    // ── driver_arrived → in_progress ──────────────────────────────────
    if (
      ride.status === "driver_arrived" &&
      ride.pickup_latitude != null &&
      ride.pickup_longitude != null
    ) {
      const distToPickup = haversineMetres(
        driverLat,
        driverLon,
        ride.pickup_latitude,
        ride.pickup_longitude
      );
      if (distToPickup > PICKUP_DEPART_THRESHOLD) {
        transitionStatus(ride.id, "in_progress", { in_progress_at: now });
      }
    }

    // ── in_progress → completed ────────────────────────────────────────
    if (
      ride.status === "in_progress" &&
      ride.destination_latitude != null &&
      ride.destination_longitude != null
    ) {
      const distToDest = haversineMetres(
        driverLat,
        driverLon,
        ride.destination_latitude,
        ride.destination_longitude
      );
      if (distToDest <= DESTINATION_ARRIVE_THRESHOLD) {
        transitionStatus(ride.id, "completed", { completed_at: now });
      }
    }
  }, [geoState.latitude, geoState.longitude, ride, transitionStatus]);
}
