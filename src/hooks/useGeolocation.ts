import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "./useAuth";

export interface GeolocationState {
  latitude: number | null;
  longitude: number | null;
  accuracy: number | null;
  heading: number | null;
  speed: number | null;
  error: string | null;
  isWatching: boolean;
}

const WATCH_OPTIONS: PositionOptions = {
  enableHighAccuracy: true,
  maximumAge: 5000,
  timeout: 15000,
};

export function useGeolocation(rideId?: string | null) {
  const { user } = useAuth();
  const watchIdRef = useRef<number | null>(null);
  const [state, setState] = useState<GeolocationState>({
    latitude: null,
    longitude: null,
    accuracy: null,
    heading: null,
    speed: null,
    error: null,
    isWatching: false,
  });

  const upsertLocation = useCallback(
    async (pos: GeolocationPosition) => {
      if (!user) return;
      const { coords } = pos;

      try {
        await supabase.from("driver_locations").upsert(
          {
            driver_id: user.id,
            ride_id: rideId ?? null,
            latitude: coords.latitude,
            longitude: coords.longitude,
            accuracy: coords.accuracy,
            heading: coords.heading,
            speed: coords.speed,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "driver_id" }
        );
      } catch {
        // location upsert is best-effort
      }
    },
    [user, rideId]
  );

  const upsertRef = useRef(upsertLocation);
  upsertRef.current = upsertLocation;

  const startWatching = useCallback(() => {
    if (!navigator.geolocation) {
      setState((s) => ({
        ...s,
        error: "Geolocation is not supported by this browser.",
      }));
      return;
    }

    if (watchIdRef.current !== null) return;

    setState((s) => ({ ...s, isWatching: true, error: null }));

    watchIdRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        setState({
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
          heading: pos.coords.heading,
          speed: pos.coords.speed,
          error: null,
          isWatching: true,
        });
        upsertRef.current(pos);
      },
      (err) => {
        setState((s) => ({
          ...s,
          error: `Location error: ${err.message}`,
          isWatching: false,
        }));
      },
      WATCH_OPTIONS
    );
  }, []);

  const stopWatching = useCallback(() => {
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
    setState({
      latitude: null,
      longitude: null,
      accuracy: null,
      heading: null,
      speed: null,
      error: null,
      isWatching: false,
    });
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
      }
    };
  }, []);

  return { ...state, startWatching, stopWatching };
}
