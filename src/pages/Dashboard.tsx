import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Power, Wifi, WifiOff, Car, Bell, BellRing, X } from "lucide-react";
import { toast } from "sonner";
import { cn, formatTime } from "@/lib/utils";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/useAuth";
import { useRideRequest } from "@/hooks/useRideRequest";
import { useGeolocation } from "@/hooks/useGeolocation";
import { RideRequestModal } from "@/components/RideRequestModal";
import { Badge } from "@/components/ui/badge";
import { subscribeToPushNotifications, getExistingPushSubscription } from "@/lib/pushNotifications";

export default function Dashboard() {
  const { user, driver } = useAuth();
  const navigate = useNavigate();
  const [isOnline, setIsOnline] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [toggling, setToggling] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date().toISOString());
  const [pushState, setPushState] = useState<"loading" | "prompt" | "enabled" | "unsupported">("loading");

  const { startWatching, stopWatching } = useGeolocation(null);
  const { incomingRide, acceptRide, declineRide } = useRideRequest({
    enabled: isOnline,
  });

  // Live clock
  useEffect(() => {
    const id = setInterval(() => setCurrentTime(new Date().toISOString()), 30000);
    return () => clearInterval(id);
  }, []);

  // Check for active session on mount
  useEffect(() => {
    if (!driver) return;
    supabase
      .from("driver_sessions")
      .select("id")
      .eq("driver_id", driver.id)
      .eq("is_active", true)
      .maybeSingle()
      .then(({ data }) => {
        if (data) {
          setSessionId(data.id);
          setIsOnline(true);
          startWatching();
        }
      });
  }, [driver, startWatching]);

  const goOnline = useCallback(async () => {
    if (!driver) return;
    setToggling(true);
    try {
      // Close any stale active sessions first
      await supabase
        .from("driver_sessions")
        .update({ is_active: false, ended_at: new Date().toISOString() })
        .eq("driver_id", driver.id)
        .eq("is_active", true);

      const { data, error } = await supabase
        .from("driver_sessions")
        .insert({ driver_id: driver.id, is_active: true })
        .select("id")
        .single();

      if (error) throw error;

      setSessionId(data.id);
      setIsOnline(true);
      startWatching();
      toast.success("You're online! Waiting for ride requests.");
    } catch {
      toast.error("Failed to go online. Try again.");
    } finally {
      setToggling(false);
    }
  }, [driver, startWatching]);

  const goOffline = useCallback(async () => {
    if (!sessionId) return;
    setToggling(true);
    try {
      await supabase
        .from("driver_sessions")
        .update({ is_active: false, ended_at: new Date().toISOString() })
        .eq("id", sessionId);

      setSessionId(null);
      setIsOnline(false);
      stopWatching();
      toast("You're offline.");
    } catch {
      toast.error("Failed to go offline. Try again.");
    } finally {
      setToggling(false);
    }
  }, [sessionId, stopWatching]);

  const handleToggle = () => {
    if (isOnline) {
      goOffline();
    } else {
      goOnline();
    }
  };

  const handleAcceptRide = async () => {
    if (!incomingRide) return;
    const ok = await acceptRide(incomingRide.id, incomingRide.user_id);
    if (ok) {
      toast.success("Ride accepted! Head to the pickup.");
      navigate(`/ride/${incomingRide.id}`);
    } else {
      toast.error("Failed to accept ride.");
    }
  };

  const handleDeclineRide = async () => {
    if (!incomingRide) return;
    await declineRide(incomingRide.id);
    toast("Ride declined.");
  };

  // Check push notification state
  useEffect(() => {
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
      setPushState("unsupported");
      return;
    }
    if (!import.meta.env.VITE_VAPID_PUBLIC_KEY) {
      setPushState("unsupported");
      return;
    }
    if (Notification.permission === "denied") {
      setPushState("unsupported");
      return;
    }
    getExistingPushSubscription().then((sub) => {
      setPushState(sub ? "enabled" : "prompt");
    });
  }, []);

  const enableNotifications = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    try {
      await subscribeToPushNotifications(user.id);
      setPushState("enabled");
      toast.success("Push notifications enabled");
    } catch {
      toast.error("Could not enable notifications. Check your browser settings.");
    }
  };

  const firstName = driver?.full_name?.split(" ")[0] ?? "Driver";
  const hour = new Date().getHours();
  const greeting =
    hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";

  return (
    <div className="min-h-screen bg-background pb-20">
      {/* Incoming ride modal */}
      {incomingRide && (
        <RideRequestModal
          ride={incomingRide}
          onAccept={handleAcceptRide}
          onDecline={handleDeclineRide}
        />
      )}

      {/* Header */}
      <div className="px-5 pt-14 pb-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
              {greeting}
            </p>
            <h1 className="text-2xl font-display font-bold text-foreground mt-0.5">
              {firstName}
            </h1>
          </div>
          <div className="flex items-center gap-2">
            {/* Online indicator dot */}
            {isOnline && (
              <span className="relative flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500" />
              </span>
            )}
            <div
              className={cn(
                "flex h-10 w-10 items-center justify-center rounded-2xl border transition-colors",
                isOnline
                  ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-400"
                  : "border-hairline bg-secondary text-muted-foreground"
              )}
            >
              {isOnline ? (
                <Wifi className="h-4 w-4" />
              ) : (
                <WifiOff className="h-4 w-4" />
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Main content */}
      <div className="px-5 space-y-5">
        {/* Push notification enable banner */}
        {pushState === "prompt" && (
          <div className="glass-card rounded-3xl p-4 border border-primary/20 bg-primary/5">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-primary/10">
                <BellRing className="h-5 w-5 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-foreground">Enable notifications</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Get instantly notified of new ride requests
                </p>
              </div>
              <button
                onClick={enableNotifications}
                className="shrink-0 rounded-xl bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground hover:bg-primary/90 transition-colors"
              >
                Enable
              </button>
            </div>
          </div>
        )}

        {/* GO ONLINE / OFFLINE toggle */}
        <div className="glass-card rounded-3xl p-6 shadow-elevated">
          <div className="flex flex-col items-center text-center">
            {/* Status pill */}
            <div
              className={cn(
                "flex items-center gap-2 px-4 py-1.5 rounded-full border mb-6 transition-all duration-300",
                isOnline
                  ? "border-emerald-500/40 bg-emerald-500/10"
                  : "border-hairline bg-secondary"
              )}
            >
              <span
                className={cn(
                  "h-1.5 w-1.5 rounded-full",
                  isOnline ? "bg-emerald-500" : "bg-muted-foreground"
                )}
              />
              <span
                className={cn(
                  "text-xs font-semibold uppercase tracking-[0.15em]",
                  isOnline ? "text-emerald-400" : "text-muted-foreground"
                )}
              >
                {isOnline ? "Online" : "Offline"}
              </span>
            </div>

            {/* Big toggle button */}
            <button
              id="btn-toggle-online"
              onClick={handleToggle}
              disabled={toggling}
              className={cn(
                "relative flex h-36 w-36 items-center justify-center rounded-full transition-all duration-500 shadow-elevated",
                isOnline
                  ? "bg-emerald-500 shadow-[0_0_60px_rgba(52,211,153,0.35)]"
                  : "bg-secondary border border-hairline",
                toggling && "opacity-70 cursor-not-allowed"
              )}
            >
              {/* Outer ring */}
              {isOnline && (
                <span className="absolute inset-0 rounded-full animate-ping-slow bg-emerald-500/20" />
              )}
              <div className="flex flex-col items-center gap-1">
                <Power
                  className={cn(
                    "h-10 w-10 transition-all duration-300",
                    isOnline ? "text-white" : "text-muted-foreground"
                  )}
                  strokeWidth={1.5}
                />
                <span
                  className={cn(
                    "text-xs font-bold uppercase tracking-[0.2em] transition-all duration-300",
                    isOnline ? "text-white" : "text-muted-foreground"
                  )}
                >
                  {toggling ? "..." : isOnline ? "GO OFFLINE" : "GO ONLINE"}
                </span>
              </div>
            </button>

            <p className="text-xs text-muted-foreground mt-6 max-w-[200px] leading-relaxed">
              {isOnline
                ? "You are visible to students. New rides will appear automatically."
                : "Tap to start receiving ride requests from students."}
            </p>
          </div>
        </div>

        {/* Vehicle info card */}
        {driver && (
          <div className="glass-card rounded-3xl p-5 shadow-soft">
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-2xl bg-primary/10 border border-primary/20">
                <Car className="h-6 w-6 text-primary" strokeWidth={1.5} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs uppercase tracking-[0.15em] text-muted-foreground">
                  Your Vehicle
                </p>
                <p className="text-base font-semibold text-foreground mt-0.5 truncate">
                  {driver.vehicle}
                </p>
                {driver.plate_number && (
                  <p className="text-xs text-muted-foreground font-mono">
                    {driver.plate_number}
                  </p>
                )}
              </div>
              <Badge
                variant={
                  driver.status === "active" ? "success" : "outline"
                }
                className="flex-shrink-0 uppercase text-[9px] tracking-wider"
              >
                {driver.status}
              </Badge>
            </div>
          </div>
        )}

        {/* Waiting state when online */}
        {isOnline && !incomingRide && (
          <div className="glass-card rounded-3xl p-6 shadow-soft text-center">
            <div className="flex flex-col items-center gap-3">
              <div className="relative">
                <div className="h-12 w-12 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center">
                  <Bell className="h-5 w-5 text-primary animate-pulse-slow" />
                </div>
              </div>
              <p className="text-sm font-medium text-foreground">
                Waiting for ride requests
              </p>
              <p className="text-xs text-muted-foreground max-w-[200px] leading-relaxed">
                Stay connected. New rides will appear as a full-screen notification.
              </p>
              <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
                {formatTime(currentTime)}
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
