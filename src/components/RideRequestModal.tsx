import { useEffect, useRef, useState } from "react";
import { MapPin, Navigation, Clock, DollarSign, User, List } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { cn, formatNLe } from "@/lib/utils";
import type { IncomingRide } from "@/hooks/useRideRequest";

const COUNTDOWN_SECONDS = 30;

interface RideRequestModalProps {
  ride: IncomingRide;
  onAccept: () => Promise<void>;
  onDecline: () => Promise<void>;
  queuePosition?: number;
  queueTotal?: number;
}

export function RideRequestModal({ ride, onAccept, onDecline, queuePosition = 1, queueTotal = 1 }: RideRequestModalProps) {
  const [secondsLeft, setSecondsLeft] = useState(COUNTDOWN_SECONDS);
  const [isLoading, setIsLoading] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const autoDeclinedRef = useRef(false);

  useEffect(() => {
    setSecondsLeft(COUNTDOWN_SECONDS);
    autoDeclinedRef.current = false;

    timerRef.current = setInterval(() => {
      setSecondsLeft((prev) => {
        if (prev <= 1) {
          clearInterval(timerRef.current!);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    const autoDeclineTimer = setTimeout(() => {
      if (!autoDeclinedRef.current) {
        autoDeclinedRef.current = true;
        onDecline();
      }
    }, COUNTDOWN_SECONDS * 1000);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      clearTimeout(autoDeclineTimer);
    };
  }, [ride.id, ride.invitation_id, onDecline]);

  const handleAccept = async () => {
    if (timerRef.current) clearInterval(timerRef.current);
    setIsLoading(true);
    try {
      await onAccept();
    } catch {
      // handled by parent
    } finally {
      setIsLoading(false);
    }
  };

  const handleDecline = async () => {
    if (timerRef.current) clearInterval(timerRef.current);
    setIsLoading(true);
    try {
      await onDecline();
    } catch {
      // handled by parent
    } finally {
      setIsLoading(false);
    }
  };

  const progressValue = (secondsLeft / COUNTDOWN_SECONDS) * 100;
  const isUrgent = secondsLeft <= 10;

  return (
    <div className="fixed inset-0 z-[9999] flex flex-col">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />

      <div className="absolute bottom-0 left-0 right-0 animate-fade-up">
        <div className="bg-[#1A1A1A] rounded-t-3xl border-t border-hairline shadow-elevated overflow-hidden">
          <div className="relative h-1 w-full bg-secondary overflow-hidden">
            <div
              className={cn(
                "h-full transition-all duration-1000 ease-linear",
                isUrgent ? "bg-destructive" : "bg-primary"
              )}
              style={{ width: `${progressValue}%` }}
            />
          </div>

          <div className="px-6 pt-5 pb-8">
            {/* Header with queue indicator */}
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-3">
                <div>
                  <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground mb-1">
                    New Ride Request
                  </p>
                  <h2 className="text-2xl font-display font-bold text-foreground">
                    {ride.student_name}
                  </h2>
                  {ride.type && (
                    <span className="text-[10px] uppercase tracking-wider text-primary/80 mt-1 block">
                      {ride.type} ride
                    </span>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-3">
                {queueTotal > 1 && (
                  <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                    <List className="h-3 w-3" />
                    <span>{queuePosition}/{queueTotal}</span>
                  </div>
                )}
                <div
                  className={cn(
                    "flex h-14 w-14 flex-col items-center justify-center rounded-2xl border transition-colors duration-300",
                    isUrgent
                      ? "border-destructive/50 bg-destructive/10"
                      : "border-hairline bg-secondary"
                  )}
                >
                  <span
                    className={cn(
                      "text-2xl font-bold font-display tabular-nums leading-none",
                      isUrgent ? "text-destructive" : "text-foreground"
                    )}
                  >
                    {secondsLeft}
                  </span>
                  <span className="text-[8px] uppercase tracking-widest text-muted-foreground">
                    sec
                  </span>
                </div>
              </div>
            </div>

            {/* Ride details */}
            <div className="space-y-3 mb-5">
              <div className="flex items-start gap-3 p-3.5 rounded-2xl bg-background border border-hairline">
                <div className="mt-0.5 h-7 w-7 flex-shrink-0 rounded-full bg-emerald-500/20 flex items-center justify-center">
                  <MapPin className="h-3.5 w-3.5 text-emerald-400" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground mb-0.5">
                    Pickup
                  </p>
                  <p className="text-sm font-medium text-foreground leading-snug truncate">
                    {ride.pickup}
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3 p-3.5 rounded-2xl bg-background border border-hairline">
                <div className="mt-0.5 h-7 w-7 flex-shrink-0 rounded-full bg-red-500/20 flex items-center justify-center">
                  <Navigation className="h-3.5 w-3.5 text-red-400" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground mb-0.5">
                    Destination
                  </p>
                  <p className="text-sm font-medium text-foreground leading-snug truncate">
                    {ride.destination}
                  </p>
                </div>
              </div>
            </div>

            {/* Stats row */}
            <div className="grid grid-cols-2 gap-3 mb-6">
              <div className="p-3 rounded-2xl bg-background border border-hairline text-center">
                <div className="flex items-center justify-center gap-1.5 mb-1">
                  <Navigation className="h-3.5 w-3.5 text-muted-foreground" />
                  <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
                    Distance
                  </p>
                </div>
                <p className="text-lg font-bold font-display text-foreground">
                  {ride.distance_km != null ? `${ride.distance_km.toFixed(1)} km` : "—"}
                </p>
              </div>
              <div className="p-3 rounded-2xl bg-background border border-hairline text-center">
                <div className="flex items-center justify-center gap-1.5 mb-1">
                  <DollarSign className="h-3.5 w-3.5 text-muted-foreground" />
                  <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
                    You Earn
                  </p>
                </div>
                <p className="text-lg font-bold font-display text-emerald-400">
                  {ride.fare_amount != null
                    ? formatNLe(Math.floor(ride.fare_amount * 0.8))
                    : "—"}
                </p>
              </div>
            </div>

            {/* Action buttons */}
            <div className="space-y-3">
              <Button
                id="btn-accept-ride"
                size="xl"
                className="w-full rounded-2xl h-14 text-base font-semibold bg-white text-black hover:bg-white/90 shadow-cta"
                onClick={handleAccept}
                disabled={isLoading || secondsLeft === 0}
              >
                {isLoading ? "Accepting..." : "ACCEPT"}
              </Button>
              <Button
                id="btn-decline-ride"
                variant="outline"
                size="xl"
                className="w-full rounded-2xl h-14 text-base font-semibold border-hairline text-muted-foreground"
                onClick={handleDecline}
                disabled={isLoading || secondsLeft === 0}
              >
                DECLINE
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
