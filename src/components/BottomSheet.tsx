import { MapPin, Navigation, Clock, CheckCircle, Loader2 } from "lucide-react";
import { cn, formatNLe } from "@/lib/utils";
import type { RideStatus, ActiveRide } from "@/hooks/useGeofence";

interface BottomSheetProps {
  ride: ActiveRide;
  className?: string;
}

const STATUS_CONFIG: Record<
  RideStatus,
  {
    label: string;
    sublabel: string;
    icon: React.ElementType;
    color: string;
    bgColor: string;
  }
> = {
  accepted: {
    label: "Heading to Pickup",
    sublabel: "Drive to the pickup location",
    icon: Navigation,
    color: "text-blue-400",
    bgColor: "bg-blue-500/15",
  },
  driver_arrived: {
    label: "Arrived at Pickup",
    sublabel: "Waiting for passenger to board",
    icon: Clock,
    color: "text-amber-400",
    bgColor: "bg-amber-500/15",
  },
  in_progress: {
    label: "Ride in Progress",
    sublabel: "Heading to destination",
    icon: Navigation,
    color: "text-emerald-400",
    bgColor: "bg-emerald-500/15",
  },
  completed: {
    label: "Ride Completed",
    sublabel: "Well done! Great ride.",
    icon: CheckCircle,
    color: "text-emerald-400",
    bgColor: "bg-emerald-500/15",
  },
  pending: {
    label: "Pending",
    sublabel: "Awaiting assignment",
    icon: Loader2,
    color: "text-muted-foreground",
    bgColor: "bg-secondary",
  },
  driver_assigned: {
    label: "Assigned",
    sublabel: "Incoming ride",
    icon: Loader2,
    color: "text-muted-foreground",
    bgColor: "bg-secondary",
  },
  cancelled: {
    label: "Cancelled",
    sublabel: "This ride was cancelled",
    icon: MapPin,
    color: "text-destructive",
    bgColor: "bg-destructive/15",
  },
  pool_locked_awaiting_driver: {
    label: "Awaiting Driver",
    sublabel: "Pool locked",
    icon: Loader2,
    color: "text-muted-foreground",
    bgColor: "bg-secondary",
  },
  paid_and_dispatched: {
    label: "Dispatched",
    sublabel: "En route",
    icon: Navigation,
    color: "text-blue-400",
    bgColor: "bg-blue-500/15",
  },
  pending_friend_commitment: {
    label: "Pending",
    sublabel: "Friend commitment pending",
    icon: Loader2,
    color: "text-muted-foreground",
    bgColor: "bg-secondary",
  },
};

export function BottomSheet({ ride, className }: BottomSheetProps) {
  const config = STATUS_CONFIG[ride.status] ?? STATUS_CONFIG["pending"];
  const Icon = config.icon;

  const driverEarnings = ride.fare_amount
    ? Math.floor(ride.fare_amount * 0.8)
    : null;

  const isCompleted = ride.status === "completed";

  return (
    <div
      className={cn(
        "bg-[#1A1A1A] rounded-t-3xl border-t border-hairline px-5 pt-4 pb-8 flex flex-col gap-4",
        className
      )}
    >
      {/* Drag handle */}
      <div className="mx-auto h-1 w-10 rounded-full bg-border" />

      {/* Status banner */}
      <div
        className={cn(
          "flex items-center gap-3 rounded-2xl px-4 py-3",
          config.bgColor
        )}
      >
        <div className={cn("flex-shrink-0", config.color)}>
          <Icon
            className={cn(
              "h-5 w-5",
              ride.status === "in_progress" && "animate-pulse"
            )}
          />
        </div>
        <div>
          <p className={cn("text-sm font-semibold", config.color)}>
            {config.label}
          </p>
          <p className="text-xs text-muted-foreground">{config.sublabel}</p>
        </div>
        {/* Animated pulse for in_progress */}
        {ride.status === "in_progress" && (
          <div className="ml-auto">
            <span className="relative flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500" />
            </span>
          </div>
        )}
      </div>

      {/* Ride details grid */}
      <div className="grid grid-cols-2 gap-3">
        {/* Pickup */}
        <div className="col-span-2 flex items-start gap-3 p-3 rounded-xl bg-background border border-hairline">
          <div className="mt-0.5 h-6 w-6 flex-shrink-0 rounded-full bg-emerald-500/20 flex items-center justify-center">
            <MapPin className="h-3 w-3 text-emerald-400" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[9px] uppercase tracking-[0.2em] text-muted-foreground mb-0.5">
              Pickup
            </p>
            <p className="text-xs font-medium text-foreground leading-snug line-clamp-2">
              {ride.pickup}
            </p>
          </div>
        </div>

        {/* Destination */}
        <div className="col-span-2 flex items-start gap-3 p-3 rounded-xl bg-background border border-hairline">
          <div className="mt-0.5 h-6 w-6 flex-shrink-0 rounded-full bg-red-500/20 flex items-center justify-center">
            <Navigation className="h-3 w-3 text-red-400" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[9px] uppercase tracking-[0.2em] text-muted-foreground mb-0.5">
              Destination
            </p>
            <p className="text-xs font-medium text-foreground leading-snug line-clamp-2">
              {ride.destination}
            </p>
          </div>
        </div>

        {/* Distance */}
        <div className="p-3 rounded-xl bg-background border border-hairline text-center">
          <p className="text-[9px] uppercase tracking-[0.2em] text-muted-foreground mb-1">
            Distance
          </p>
          <p className="text-base font-bold font-display text-foreground">
            {ride.distance_km != null ? `${ride.distance_km.toFixed(1)} km` : "—"}
          </p>
        </div>

        {/* Earnings */}
        <div
          className={cn(
            "p-3 rounded-xl border text-center",
            isCompleted
              ? "bg-emerald-500/10 border-emerald-500/30"
              : "bg-background border-hairline"
          )}
        >
          <p className="text-[9px] uppercase tracking-[0.2em] text-muted-foreground mb-1">
            {isCompleted ? "Earned" : "You Earn"}
          </p>
          <p
            className={cn(
              "text-base font-bold font-display",
              isCompleted ? "text-emerald-400" : "text-foreground"
            )}
          >
            {driverEarnings != null ? formatNLe(driverEarnings) : "—"}
          </p>
        </div>
      </div>

      {/* GPS auto-transition note */}
      {!isCompleted && (
        <p className="text-center text-[10px] text-muted-foreground">
          Status updates automatically via GPS
        </p>
      )}
    </div>
  );
}
